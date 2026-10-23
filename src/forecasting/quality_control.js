/**
 * Hydrometric and Meteorological Quality Control Engine
 * 
 * Implements strict verification rules:
 * - Physical boundary checks (e.g. 0.0m - 5.5m OD stage in Clonmel)
 * - Rate-of-change spike detection (flags unphysical instantaneous jumps)
 * - Sensor flatlining detection (flags frozen sensors)
 * - Stale observation watchdogs
 * - Quality audit logging for full traceability
 */

export class QualityControlEngine {
    constructor() {
        this.auditLog = [];
    }

    /**
     * Validates and cleans a series of river level observations
     */
    validateRiverSeries(records, stationMeta) {
        if (!records || records.length === 0) {
            return { cleaned: [], issues: ['NO_DATA'], qualityScore: 0.0 };
        }

        const cleaned = [];
        const issues = [];
        let spikeCount = 0;
        let outOfBoundsCount = 0;

        const MIN_STAGE = -0.20; // meters (drought baseline)
        const MAX_STAGE = 5.50;  // meters (catastrophic flood ceiling)
        const MAX_15M_DELTA = 0.40; // max physically plausible 15-min stage change (1.6 m/hr)

        let prevValid = null;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            let isValid = true;
            const flags = [];

            // 1. Boundary check
            if (r.stage < MIN_STAGE || r.stage > MAX_STAGE) {
                isValid = false;
                outOfBoundsCount++;
                flags.push(`OUT_OF_BOUNDS (${r.stage}m)`);
            }

            // 2. Spike check relative to previous valid reading
            if (isValid && prevValid !== null) {
                const delta = Math.abs(r.stage - prevValid.stage);
                const dtMinutes = (r.timeMs - prevValid.timeMs) / 60000;
                
                // If dt is within 30 minutes and delta exceeds physical threshold
                if (dtMinutes <= 30 && delta > MAX_15M_DELTA) {
                    isValid = false;
                    spikeCount++;
                    flags.push(`SPIKE_DETECTED (delta=${delta.toFixed(2)}m in ${dtMinutes}m)`);
                }
            }

            if (isValid) {
                cleaned.push({
                    ...r,
                    qcPassed: true
                });
                prevValid = r;
            } else {
                this.auditLog.push({
                    stationId: stationMeta.id,
                    timestamp: r.timestamp,
                    rawValue: r.stage,
                    reasons: flags
                });
            }
        }

        // 3. Flatline check over last 12 readings (3 hours)
        let isFlatlined = false;
        if (cleaned.length >= 12) {
            const recent = cleaned.slice(-12);
            const firstVal = recent[0].stage;
            const allSame = recent.every(x => Math.abs(x.stage - firstVal) < 0.001);
            if (allSame && firstVal > 1.5) { // Only suspect if elevated
                isFlatlined = true;
                issues.push('SENSOR_FLATLINED_RECENTLY');
            }
        }

        // 4. Stale observation check
        let isStale = false;
        if (cleaned.length > 0) {
            const lastTime = cleaned[cleaned.length - 1].timeMs;
            const now = Date.now();
            const ageHours = (now - lastTime) / 3600000;
            if (ageHours > 3.0) {
                isStale = true;
                issues.push(`STALE_DATA (${ageHours.toFixed(1)} hours old)`);
            }
        }

        if (spikeCount > 0) issues.push(`${spikeCount} spikes filtered`);
        if (outOfBoundsCount > 0) issues.push(`${outOfBoundsCount} out-of-bounds readings`);

        const qualityScore = records.length > 0 ? (cleaned.length / records.length) : 0.0;

        return {
            cleaned,
            issues,
            qualityScore: parseFloat(qualityScore.toFixed(3)),
            isStale,
            isFlatlined,
            lastValidTime: cleaned.length > 0 ? cleaned[cleaned.length - 1].timestamp : null
        };
    }

    /**
     * Validates weather forecast precipitation inputs
     */
    validatePrecipitation(series) {
        if (!series || series.length === 0) {
            return { cleaned: [], issues: ['NO_PRECIP_DATA'], qualityScore: 0.0 };
        }

        const cleaned = [];
        const issues = [];
        const MAX_HOURLY_RAIN = 120.0; // mm/h (extreme deluge threshold)

        for (const item of series) {
            let rain = item.precipMm;
            if (isNaN(rain) || rain < 0.0) {
                rain = 0.0;
            } else if (rain > MAX_HOURLY_RAIN) {
                issues.push(`EXCESSIVE_PRECIP_CAPPED (${rain}mm at ${item.time})`);
                rain = MAX_HOURLY_RAIN;
            }

            cleaned.push({
                ...item,
                precipMm: rain
            });
        }

        return {
            cleaned,
            issues,
            qualityScore: 1.0
        };
    }
}
