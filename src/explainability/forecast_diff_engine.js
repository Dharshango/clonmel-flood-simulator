/**
 * forecast_diff_engine.js
 * 
 * Traceable Forecast Run Comparison Engine.
 * Records forecast cycle snapshots and computes rigorous, attribution-conscious
 * diffs between consecutive forecast runs.
 */

export class ForecastDiffEngine {
    constructor(maxHistory = 10) {
        this.maxHistory = maxHistory;
        this.runHistory = [];
    }

    /**
     * Records a forecast run snapshot into the history buffer
     */
    recordRunSnapshot(forecastManager, customRunId = null) {
        if (!forecastManager || !forecastManager.forecastPackage) return null;

        const fc = forecastManager.forecastPackage;
        const tel = forecastManager.telemetry;
        const now = new Date();

        // Calculate cumulative rainfall from telemetry series
        let cumPrecip = 0.0;
        let peakHourlyPrecip = 0.0;
        (tel?.weather?.series || []).slice(0, 48).forEach(w => {
            const p = w.precipMm || 0.0;
            cumPrecip += p;
            if (p > peakHourlyPrecip) peakHourlyPrecip = p;
        });

        const runId = customRunId || `CLM-FC-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}`;

        const snapshot = {
            runId,
            modelVersion: 'Hydroverse-v1.4-SWE',
            creationTime: now.toISOString(),
            dataCutoffTime: tel?.stations?.clonmel?.latest?.timestamp || now.toISOString(),
            horizonHours: fc.horizonHours || 48,
            inputs: {
                clonmelStage: tel?.stations?.clonmel?.latest?.stage ?? 1.15,
                knockloftyStage: tel?.stations?.knocklofty?.latest?.stage ?? 1.45,
                cumulativePrecipMm: parseFloat(cumPrecip.toFixed(1)),
                peakHourlyPrecipMm: parseFloat(peakHourlyPrecip.toFixed(1))
            },
            outputs: {
                peakLeadHours: fc.peak?.leadTimeHours ?? 0,
                peakStageP50: fc.peak?.stage ?? 1.15,
                peakQP50: fc.peak?.discharge ?? 55.0,
                peakStageBand: fc.peak?.stageBand ?? [1.15, 1.15],
                riskTier: fc.peak?.riskTier ?? 'NORMAL'
            }
        };

        this.runHistory.unshift(snapshot);
        if (this.runHistory.length > this.maxHistory) {
            this.runHistory.pop();
        }

        return snapshot;
    }

    /**
     * Seeds initial synthetic baseline run for immediate comparison in UI
     * (representing the cycle from 6 hours earlier)
     */
    seedBaselineRunIfEmpty(currentSnapshot) {
        if (this.runHistory.length >= 2 || !currentSnapshot) return;

        const sixHoursAgo = new Date(Date.now() - 6 * 3600000);
        const baseline = {
            runId: `CLM-FC-PREV-${sixHoursAgo.getUTCHours()}00Z`,
            modelVersion: 'Hydroverse-v1.4-SWE',
            creationTime: sixHoursAgo.toISOString(),
            dataCutoffTime: new Date(Date.now() - 6.5 * 3600000).toISOString(),
            horizonHours: 48,
            inputs: {
                clonmelStage: Math.max(0.8, currentSnapshot.inputs.clonmelStage - 0.12),
                knockloftyStage: Math.max(0.9, currentSnapshot.inputs.knockloftyStage - 0.18),
                cumulativePrecipMm: Math.max(0.0, currentSnapshot.inputs.cumulativePrecipMm - 8.5),
                peakHourlyPrecipMm: Math.max(0.0, currentSnapshot.inputs.peakHourlyPrecipMm - 1.8)
            },
            outputs: {
                peakLeadHours: Math.max(0, currentSnapshot.outputs.peakLeadHours + 1),
                peakStageP50: Math.max(1.0, currentSnapshot.outputs.peakStageP50 - 0.22),
                peakQP50: Math.max(45.0, currentSnapshot.outputs.peakQP50 - 38.0),
                peakStageBand: [
                    Math.max(0.9, currentSnapshot.outputs.peakStageBand[0] - 0.18),
                    Math.max(1.1, currentSnapshot.outputs.peakStageBand[1] - 0.26)
                ],
                riskTier: currentSnapshot.outputs.peakStageP50 - 0.22 >= 2.80 ? 'WARNING' : 'NORMAL'
            }
        };

        this.runHistory.push(baseline);
    }

    /**
     * Compares two forecast runs (typically current vs previous)
     */
    compareRuns(runCurrent, runPrevious) {
        if (!runCurrent || !runPrevious) {
            return {
                isComparable: false,
                reason: 'Insufficient forecast history to perform run-to-run comparison.'
            };
        }

        // Output deltas
        const deltaPeakStage = runCurrent.outputs.peakStageP50 - runPrevious.outputs.peakStageP50;
        const deltaPeakQ = runCurrent.outputs.peakQP50 - runPrevious.outputs.peakQP50;
        const deltaLeadHours = runCurrent.outputs.peakLeadHours - runPrevious.outputs.peakLeadHours;

        // Input deltas
        const deltaKnocklofty = runCurrent.inputs.knockloftyStage - runPrevious.inputs.knockloftyStage;
        const deltaClonmel = runCurrent.inputs.clonmelStage - runPrevious.inputs.clonmelStage;
        const deltaPrecip = runCurrent.inputs.cumulativePrecipMm - runPrevious.inputs.cumulativePrecipMm;
        const deltaPeakHourlyPrecip = runCurrent.inputs.peakHourlyPrecipMm - runPrevious.inputs.peakHourlyPrecipMm;

        // Scientifically defensible attribution statement
        const stageDirection = deltaPeakStage > 0.03 ? 'higher' : deltaPeakStage < -0.03 ? 'lower' : 'substantially unchanged';
        const precipDirection = deltaPrecip > 0 ? 'higher' : deltaPrecip < 0 ? 'lower' : 'unchanged';
        const klDirection = deltaKnocklofty > 0 ? 'higher' : deltaKnocklofty < 0 ? 'lower' : 'unchanged';

        let attributionText = `Compared with previous forecast run (${runPrevious.runId}), the current run predicts a ${Math.abs(deltaPeakStage).toFixed(2)}m ${stageDirection} peak river stage (${runCurrent.outputs.peakStageP50.toFixed(2)}m vs ${runPrevious.outputs.peakStageP50.toFixed(2)}m OD). `;
        attributionText += `Concurrently, the upstream Knocklofty gauge reading is ${Math.abs(deltaKnocklofty).toFixed(2)}m ${klDirection} and total forecast precipitation is ${Math.abs(deltaPrecip).toFixed(1)}mm ${precipDirection}. `;
        attributionText += `While these input observations coincided with the updated prediction, descriptive comparison does not independently quantify each factor's exact causal share without controlled perturbation testing.`;

        return {
            isComparable: true,
            currentRunId: runCurrent.runId,
            previousRunId: runPrevious.runId,
            currentTime: runCurrent.creationTime,
            previousTime: runPrevious.creationTime,
            deltas: {
                peakStageM: parseFloat(deltaPeakStage.toFixed(2)),
                peakQM3S: parseFloat(deltaPeakQ.toFixed(1)),
                peakTimingHours: deltaLeadHours,
                upstreamKnockloftyM: parseFloat(deltaKnocklofty.toFixed(2)),
                localClonmelM: parseFloat(deltaClonmel.toFixed(2)),
                cumulativePrecipMm: parseFloat(deltaPrecip.toFixed(1)),
                peakHourlyPrecipMm: parseFloat(deltaPeakHourlyPrecip.toFixed(1))
            },
            attributionNarrative: attributionText
        };
    }
}
