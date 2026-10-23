/**
 * Central Flood Forecast Execution & State Orchestration Manager
 * 
 * Manages operational forecast cycles, timeline scrubbing (-24h to +48h),
 * scenario switching (P10, P50, P90), and hydrodynamic coupling to the 2D SWE solver.
 */

import { EnvironmentalDataService } from './data_service.js';
import { QualityControlEngine } from './quality_control.js';
import { CatchmentHydrologyModel } from './hydrology_model.js';
import { ForecastValidationService } from './validation_dashboard.js';

export class ForecastManager {
    constructor() {
        this.dataService = new EnvironmentalDataService();
        this.qcEngine = new QualityControlEngine();
        this.hydrologyModel = new CatchmentHydrologyModel();
        this.validationService = new ForecastValidationService();

        // Operational state
        this.isInitialized = false;
        this.isLoading = false;
        this.lastCycleTimestamp = null;
        this.feedStatus = 'INITIALIZING'; // LIVE_VERIFIED | CACHED_PROVISIONAL | OFFLINE_FALLBACK

        // Raw & QC data
        this.telemetry = null;
        this.qcResults = {};

        // Forecast outputs
        this.forecastPackage = null;
        this.activeScenario = 'p50'; // 'p10' | 'p50' | 'p90'
        this.currentLeadTimeHours = 0; // 0 to 48 hours
        
        // Listeners for UI reactive updates
        this.changeListeners = [];
    }

    onUpdate(fn) {
        this.changeListeners.push(fn);
    }

    notify() {
        for (const fn of this.changeListeners) {
            try { fn(this); } catch (e) { console.error('[ForecastManager] Listener error:', e); }
        }
    }

    /**
     * Executes a complete real-time forecasting cycle
     */
    async executeForecastCycle() {
        this.isLoading = true;
        this.notify();

        try {
            // 1. Ingest telemetry from OPW and Met Éireann
            const telemetry = await this.dataService.fetchAllTelemetry();
            this.telemetry = telemetry;

            // 2. Run quality control checks on all feeds
            const qcClonmel = this.qcEngine.validateRiverSeries(
                telemetry.stations.clonmel.records, 
                this.dataService.opwStations.clonmel
            );
            const qcKnocklofty = this.qcEngine.validateRiverSeries(
                telemetry.stations.knocklofty.records, 
                this.dataService.opwStations.knocklofty
            );
            const qcWeather = this.qcEngine.validatePrecipitation(
                telemetry.weather.series
            );

            this.qcResults = {
                clonmel: qcClonmel,
                knocklofty: qcKnocklofty,
                weather: qcWeather
            };

            // Determine platform operational feed status
            const hasLiveOPW = telemetry.stations.clonmel.isLive;
            const hasLiveWeather = telemetry.weather.isLive;
            if (hasLiveOPW && hasLiveWeather) {
                this.feedStatus = 'LIVE_VERIFIED';
            } else if (hasLiveOPW || hasLiveWeather) {
                this.feedStatus = 'PARTIAL_LIVE';
            } else {
                this.feedStatus = 'CACHED_PROVISIONAL';
            }

            // 3. Hydrological modeling & ensemble forecast generation
            const latestClonmel = qcClonmel.cleaned.length > 0 
                ? qcClonmel.cleaned[qcClonmel.cleaned.length - 1] 
                : telemetry.stations.clonmel.latest;
                
            const latestKnocklofty = qcKnocklofty.cleaned.length > 0 
                ? qcKnocklofty.cleaned[qcKnocklofty.cleaned.length - 1] 
                : telemetry.stations.knocklofty.latest;

            this.forecastPackage = this.hydrologyModel.generateForecastSeries(
                latestClonmel,
                latestKnocklofty,
                qcWeather.cleaned,
                48
            );

            this.lastCycleTimestamp = new Date().toISOString();
            this.isInitialized = true;
        } catch (err) {
            console.error('[ForecastManager] Forecast cycle error:', err);
            this.feedStatus = 'OFFLINE_FALLBACK';
        } finally {
            this.isLoading = false;
            this.notify();
        }

        return this.forecastPackage;
    }

    /**
     * Sets the active scenario (p10, p50, p90)
     */
    setScenario(scenarioKey) {
        if (['p10', 'p50', 'p90'].includes(scenarioKey)) {
            this.activeScenario = scenarioKey;
            this.notify();
        }
    }

    /**
     * Scrubs forecast timeline to a specific lead time in hours (0 to 48)
     * and couples the physical parameters into the SWE solver
     */
    seekForecastStep(leadTimeHours, simulator) {
        if (!this.forecastPackage || !this.forecastPackage.timeline) return;

        const maxHours = this.forecastPackage.horizonHours;
        const h = Math.max(0, Math.min(maxHours, Math.round(leadTimeHours)));
        this.currentLeadTimeHours = h;

        const step = this.forecastPackage.timeline[h];
        if (!step) return;

        // Select discharge and surge according to active scenario
        let targetQ = step.qP50;
        let targetSurge = step.surgeP50;
        let targetStage = step.stageP50;

        if (this.activeScenario === 'p10') {
            targetQ = step.qP10;
            targetSurge = 0.0;
            targetStage = step.stageP10;
        } else if (this.activeScenario === 'p90') {
            targetQ = step.qP90;
            targetSurge = step.surgeP90;
            targetStage = step.stageP90;
        }

        // Couple parameters directly into 2D hydrodynamic solver
        if (simulator) {
            simulator.params.riverInflow = targetQ;
            simulator.params.downstreamSurge = targetSurge;
            // Catchment precipitation is primarily represented by river inflow Q,
            // direct rain rate on urban grid is kept minimal unless local cloudburst occurs
            simulator.params.rainRate = Math.min(15.0, step.rainMmHr);

            // Calculate equivalent simulation time in seconds:
            // 48 forecast hours maps smoothly into solver hydrograph duration (21600s = 6h sim time)
            const simSeconds = (h / 48.0) * 21600.0;
            simulator.seekTime(simSeconds);
        }

        this.notify();

        return {
            step,
            targetQ,
            targetSurge,
            targetStage
        };
    }

    /**
     * Retrieves current active timestep data
     */
    getCurrentStep() {
        if (!this.forecastPackage || !this.forecastPackage.timeline) return null;
        return this.forecastPackage.timeline[this.currentLeadTimeHours] || this.forecastPackage.timeline[0];
    }
}
