/**
 * Real-Time Environmental Data Ingestion Service
 * 
 * Ingests live river levels from the OPW Hydrometric Network (waterlevel.ie)
 * and high-resolution meteorological forecasts for Clonmel (Met Éireann / ECMWF).
 * 
 * Features:
 * - Dedicated provider adapters with request timeouts
 * - Resilient proxy & local fallback cache for offline / CORS operation
 * - Provenance tracking and freshness status
 */

export class EnvironmentalDataService {
    constructor() {
        this.cache = new Map();
        this.opwStations = {
            clonmel: { id: '16011', name: 'Clonmel (River Suir)', lon: -7.6946, lat: 52.3515, datum: 'Poolbeg/Malin OD' },
            workhouse: { id: '16148', name: 'Workhouse Bridge (Inlet)', lon: -7.7168, lat: 52.3497, datum: 'Malin OD' },
            knocklofty: { id: '16139', name: 'Knocklofty (Upstream)', lon: -7.7893, lat: 52.3367, datum: 'Malin OD' },
            anner: { id: '16010', name: 'River Anner (Tributary)', lon: -7.6283, lat: 52.3820, datum: 'Malin OD' }
        };
    }

    /**
     * Parses an OPW CSV string into structured timestamped observations
     */
    parseOPWCSV(csvText, stationMeta) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];

        const records = [];
        // Header line: datetime,value
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 2) continue;

            const timeStr = parts[0].trim();
            const valStr = parts[1].trim();
            const val = parseFloat(valStr);

            if (isNaN(val)) continue;

            // OPW timestamps are local Irish time YYYY-MM-DD HH:MM
            const dateObj = new Date(timeStr.replace(' ', 'T') + ':00Z');
            
            records.push({
                stationId: stationMeta.id,
                stationName: stationMeta.name,
                timestamp: timeStr,
                date: dateObj,
                timeMs: dateObj.getTime(),
                stage: val, // meters
                units: 'm',
                datum: stationMeta.datum,
                lat: stationMeta.lat,
                lon: stationMeta.lon
            });
        }

        // Sort chronologically ascending
        records.sort((a, b) => a.timeMs - b.timeMs);
        return records;
    }

    /**
     * Fetches OPW river level time-series for a given station
     */
    async fetchOPWStation(key = 'clonmel') {
        const meta = this.opwStations[key] || this.opwStations.clonmel;
        const cacheKey = `opw_${meta.id}`;

        let csvText = null;
        let isLive = false;

        // 1. Try fetching live via proxy or direct URL
        const liveUrls = [
            `/api/opw/data/day/${meta.id}_0001.csv`,
            `https://waterlevel.ie/data/day/${meta.id}_0001.csv`
        ];

        for (const url of liveUrls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                const resp = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (resp.ok) {
                    csvText = await resp.text();
                    if (csvText && csvText.includes('datetime')) {
                        isLive = true;
                        break;
                    }
                }
            } catch (e) {
                // Ignore and try fallback
            }
        }

        // 2. If live failed, load local verified cache
        if (!csvText) {
            try {
                const fallbackUrl = `/data/telemetry/opw_${meta.id}.csv`;
                const resp = await fetch(fallbackUrl);
                if (resp.ok) {
                    csvText = await resp.text();
                }
            } catch (e) {
                console.warn(`[DataService] Could not load fallback OPW data for ${meta.id}:`, e);
            }
        }

        if (!csvText) {
            return {
                station: meta,
                status: 'UNAVAILABLE',
                records: [],
                latest: null,
                isLive: false
            };
        }

        const records = this.parseOPWCSV(csvText, meta);
        const latest = records.length > 0 ? records[records.length - 1] : null;

        // Calculate rate of rise over last 1 hour
        let rateOfRiseCmHr = 0.0;
        if (records.length >= 5) {
            const rLast = records[records.length - 1];
            const rPrev = records[records.length - 5]; // 4 intervals of 15m = 1 hour
            const dtHours = (rLast.timeMs - rPrev.timeMs) / 3600000;
            if (dtHours > 0.5) {
                rateOfRiseCmHr = ((rLast.stage - rPrev.stage) / dtHours) * 100.0;
            }
        }

        return {
            station: meta,
            status: isLive ? 'LIVE_VERIFIED' : 'CACHED_PROVISIONAL',
            records,
            latest: latest ? {
                ...latest,
                rateOfRiseCmHr: parseFloat(rateOfRiseCmHr.toFixed(1))
            } : null,
            count: records.length,
            isLive,
            retrievalTime: new Date().toISOString()
        };
    }

    /**
     * Ingests Met Éireann / ECMWF numerical weather forecast for Clonmel
     */
    async fetchMetForecast() {
        let forecastData = null;
        let isLive = false;

        const liveUrl = 'https://api.open-meteo.com/v1/forecast?latitude=52.355&longitude=-7.703&hourly=precipitation,rain,temperature_2m,wind_speed_10m,surface_pressure&forecast_days=3&timezone=Europe%2FDublin';

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);
            const resp = await fetch(liveUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
                forecastData = await resp.json();
                isLive = true;
            }
        } catch (e) {
            // Live forecast unavailable
        }

        if (!forecastData) {
            try {
                const resp = await fetch('/data/telemetry/met_forecast.json');
                if (resp.ok) {
                    forecastData = await resp.json();
                }
            } catch (e) {
                console.warn('[DataService] Could not load fallback weather forecast:', e);
            }
        }

        if (!forecastData || !forecastData.hourly) {
            return {
                status: 'UNAVAILABLE',
                hourly: [],
                isLive: false
            };
        }

        const hourly = forecastData.hourly;
        const count = hourly.time.length;
        const series = [];

        for (let i = 0; i < count; i++) {
            series.push({
                time: hourly.time[i],
                precipMm: hourly.precipitation[i] || 0.0,
                tempC: hourly.temperature_2m[i] || 10.0,
                windSpeedKmH: hourly.wind_speed_10m[i] || 15.0,
                surfacePressureHPa: hourly.surface_pressure[i] || 1013.25
            });
        }

        return {
            status: isLive ? 'LIVE_VERIFIED' : 'CACHED_PROVISIONAL',
            location: 'Clonmel (52.355°N, -7.703°W)',
            series,
            isLive,
            retrievalTime: new Date().toISOString()
        };
    }

    /**
     * Ingests full telemetry snapshot from all river stations and weather models
     */
    async fetchAllTelemetry() {
        const [clonmelData, workhouseData, knockloftyData, annerData, weatherData] = await Promise.all([
            this.fetchOPWStation('clonmel'),
            this.fetchOPWStation('workhouse'),
            this.fetchOPWStation('knocklofty'),
            this.fetchOPWStation('anner'),
            this.fetchMetForecast()
        ]);

        return {
            stations: {
                clonmel: clonmelData,
                workhouse: workhouseData,
                knocklofty: knockloftyData,
                anner: annerData
            },
            weather: weatherData,
            timestamp: new Date().toISOString()
        };
    }
}
