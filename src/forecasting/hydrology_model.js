/**
 * Catchment Hydrology, Stage-Discharge Rating, and Ensemble Forecasting Engine
 * 
 * Translates upstream hydrometric gauge observations and Met Éireann precipitation
 * forecasts into physical boundary conditions (inflow discharge Q(t) and downstream surge H(t))
 * to drive the 2D hydrodynamic SWE solver.
 */

export class CatchmentHydrologyModel {
    constructor() {
        // Calibrated rating curve parameters for Clonmel reach: Q = a * (h - h0)^b
        this.ratingParams = {
            h0: 0.28,  // zero-flow datum offset in meters
            a: 64.2,   // rating coefficient
            b: 1.82    // rating exponent
        };

        // Suir Catchment characteristics upstream of Clonmel
        this.catchmentAreaKm2 = 2173.0;
        this.catchmentLagHours = 7.5; // time-to-peak for Suir basin response
        this.runoffCoefficient = 0.42; // antecedent moisture conditioned runoff ratio
    }

    /**
     * Converts gauge stage h (meters) to river discharge Q (m³/s)
     */
    stageToDischarge(stage) {
        const effStage = Math.max(0.01, stage - this.ratingParams.h0);
        const Q = this.ratingParams.a * Math.pow(effStage, this.ratingParams.b);
        return Math.max(15.0, Q);
    }

    /**
     * Converts river discharge Q (m³/s) back to estimated water stage h (meters)
     */
    dischargeToStage(discharge) {
        const Q = Math.max(15.0, discharge);
        const effStage = Math.pow(Q / this.ratingParams.a, 1.0 / this.ratingParams.b);
        return effStage + this.ratingParams.h0;
    }

    /**
     * Synthesizes 48-hour future forecast hydrograph driven by:
     * 1. Current river baseflow from latest OPW gauge observations
     * 2. Upstream wave routing from Knocklofty (2.5h lead time)
     * 3. Catchment rainfall-runoff transformation of Met Éireann precipitation
     */
    generateForecastSeries(latestOPW, upstreamOPW, weatherSeries, horizonHours = 48) {
        const baseStage = latestOPW ? latestOPW.stage : 1.15;
        const currentQ = this.stageToDischarge(baseStage);

        const upstreamStage = upstreamOPW ? upstreamOPW.stage : baseStage;
        const upstreamQ = this.stageToDischarge(upstreamStage);

        // Extract hourly precipitation vector for the forecast horizon
        const rainHours = new Float32Array(horizonHours);
        if (weatherSeries && weatherSeries.length > 0) {
            for (let t = 0; t < Math.min(horizonHours, weatherSeries.length); t++) {
                rainHours[t] = weatherSeries[t].precipMm || 0.0;
            }
        }

        // Catchment unit hydrograph transfer function (Gamma distribution shape)
        // Tp = 7.5h, shape factor k = 2.5
        function unitHydrograph(t) {
            if (t <= 0) return 0;
            const alpha = 2.5;
            const beta = 3.0; // scale parameter
            const val = Math.pow(t, alpha - 1) * Math.exp(-t / beta);
            return Math.max(0, val);
        }

        // Normalize unit hydrograph area
        let uhSum = 0.0;
        for (let t = 1; t <= 48; t++) uhSum += unitHydrograph(t);
        const uhNorm = new Float32Array(49);
        for (let t = 1; t <= 48; t++) uhNorm[t] = unitHydrograph(t) / (uhSum || 1.0);

        // Convolve hourly rainfall into runoff discharge
        // 1 mm over 2173 km² = 2.173e6 m³ of water
        // With runoff coefficient 0.42 = ~0.912e6 m³ net runoff
        // Spread over 3600s = peak response scaling
        const runoffScaling = (this.catchmentAreaKm2 * 1000.0 * this.runoffCoefficient) / 3600.0;

        const runoffQ = new Float32Array(horizonHours);
        for (let t = 0; t < horizonHours; t++) {
            let sumQ = 0.0;
            for (let tau = 0; tau <= t; tau++) {
                const rain = rainHours[tau];
                const lag = t - tau;
                if (lag < 48) {
                    sumQ += rain * uhNorm[lag] * runoffScaling;
                }
            }
            runoffQ[t] = sumQ;
        }

        // Upstream wave propagation lag (2.5h from Knocklofty)
        const waveDeltaQ = Math.max(0.0, upstreamQ - currentQ);

        // Generate 3 scenarios: P10 (Low), P50 (Expected), P90 (Severe)
        const timeline = [];
        const startTime = Date.now();

        for (let h = 0; h <= horizonHours; h++) {
            const timeOffsetMs = h * 3600000;
            const forecastDate = new Date(startTime + timeOffsetMs);

            // Upstream wave attenuation factor
            const upstreamWaveFactor = Math.exp(-h / 12.0) * Math.min(1.0, h / 2.5);
            const upstreamContribution = waveDeltaQ * upstreamWaveFactor;

            // Direct baseflow recession
            const baseflowRecession = currentQ * Math.exp(-h / 72.0);

            // Catchment runoff response at hour h
            const netRunoff = h < horizonHours ? runoffQ[h] : runoffQ[horizonHours - 1];

            // 1. Expected scenario (P50)
            const qP50 = baseflowRecession + upstreamContribution + netRunoff;
            const stageP50 = this.dischargeToStage(qP50);

            // 2. Low / Optimistic scenario (P10): 75% runoff, minimal surge
            const qP10 = baseflowRecession + upstreamContribution * 0.7 + netRunoff * 0.70;
            const stageP10 = this.dischargeToStage(qP10);

            // 3. Severe / Worst-case scenario (P90): 135% runoff, +0.35m surge backwater
            const qP90 = baseflowRecession + upstreamContribution * 1.25 + netRunoff * 1.35;
            const stageP90 = this.dischargeToStage(qP90) + Math.min(0.35, (h / 24.0) * 0.35);

            // Downstream backwater surge
            const downstreamSurgeP50 = Math.max(0.0, (qP50 - 250.0) / 450.0) * 0.40;
            const downstreamSurgeP90 = downstreamSurgeP50 + 0.35;

            // Risk Tier Classification based on stage
            let riskTier = 'NORMAL';
            if (stageP50 >= 3.40) riskTier = 'EMERGENCY';      // Major overtopping
            else if (stageP50 >= 2.80) riskTier = 'WARNING';   // Bankfull overtopping
            else if (stageP50 >= 2.20) riskTier = 'WATCH';     // Accelerated bank rise

            timeline.push({
                leadTimeHours: h,
                timeMs: forecastDate.getTime(),
                timeLabel: `+${h}h`,
                dateString: forecastDate.toLocaleString('en-IE', { 
                    timeZone: 'Europe/Dublin', 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                rainMmHr: h < horizonHours ? rainHours[h] : 0.0,
                // Inflow discharges (m³/s)
                qP10: parseFloat(qP10.toFixed(1)),
                qP50: parseFloat(qP50.toFixed(1)),
                qP90: parseFloat(qP90.toFixed(1)),
                // River stages (meters)
                stageP10: parseFloat(stageP10.toFixed(2)),
                stageP50: parseFloat(stageP50.toFixed(2)),
                stageP90: parseFloat(stageP90.toFixed(2)),
                // Downstream surges (meters)
                surgeP50: parseFloat(downstreamSurgeP50.toFixed(2)),
                surgeP90: parseFloat(downstreamSurgeP90.toFixed(2)),
                riskTier
            });
        }

        // Locate peak flood timing
        let peakP50 = timeline[0];
        for (const item of timeline) {
            if (item.stageP50 > peakP50.stageP50) {
                peakP50 = item;
            }
        }

        return {
            horizonHours,
            timeline,
            peak: {
                leadTimeHours: peakP50.leadTimeHours,
                timeLabel: peakP50.timeLabel,
                dateString: peakP50.dateString,
                stage: peakP50.stageP50,
                discharge: peakP50.qP50,
                stageBand: [peakP50.stageP10, peakP50.stageP90],
                riskTier: peakP50.riskTier
            },
            currentConditions: {
                stage: baseStage,
                discharge: currentQ,
                upstreamStage,
                upstreamDischarge: upstreamQ
            }
        };
    }
}
