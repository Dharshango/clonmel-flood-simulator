/**
 * sensitivity_explorer.js
 * 
 * Controlled, Isolated Sensitivity and Perturbation Analysis Engine.
 * Allows safe exploration of how changes in precipitation or upstream river levels
 * propagate through the hydrological model without overwriting the live forecast.
 */

import { validateSensitivityRequest } from './explanation_model.js';

export class SensitivityExplorer {
    constructor(hydrologyModel) {
        this.hydrologyModel = hydrologyModel;
        this.activeExperiment = null;
    }

    /**
     * Executes a safe, reproducible sensitivity experiment against a baseline forecast
     */
    runSensitivityExperiment(baselineSnapshot, forecastManager, { variable, factor = 1.0, offset = 0.0 }) {
        const val = validateSensitivityRequest({ variable, factor, offset });
        if (!val.isValid) {
            return {
                isSuccess: false,
                errors: val.errors
            };
        }

        if (!baselineSnapshot || !forecastManager) {
            return {
                isSuccess: false,
                errors: ['Baseline forecast snapshot required to compute sensitivity experiment']
            };
        }

        const tel = forecastManager.telemetry;
        const weatherSeries = tel?.weather?.series || [];

        // 1. Prepare perturbed inputs
        let perturbedWeather = weatherSeries.map(w => ({ ...w }));
        let perturbedClonmelStage = baselineSnapshot.inputs.clonmelStage;
        let perturbedKnockloftyStage = baselineSnapshot.inputs.knockloftyStage;

        let variableLabel = '';
        if (variable === 'precipitation') {
            variableLabel = factor > 1.0 
                ? `Precipitation +${Math.round((factor - 1.0) * 100)}%` 
                : `Precipitation -${Math.round((1.0 - factor) * 100)}%`;
            perturbedWeather = weatherSeries.map(w => ({
                ...w,
                precipMm: (w.precipMm || 0.0) * factor
            }));
        } else if (variable === 'upstream_stage') {
            variableLabel = offset >= 0 
                ? `Upstream Knocklofty Stage +${offset.toFixed(2)}m` 
                : `Upstream Knocklofty Stage ${offset.toFixed(2)}m`;
            perturbedKnockloftyStage = Math.max(0.3, perturbedKnockloftyStage + offset);
        } else if (variable === 'runoff_coefficient') {
            variableLabel = factor > 1.0 
                ? `Runoff Ratio +${Math.round((factor - 1.0) * 100)}% (Saturated Soil)` 
                : `Runoff Ratio -${Math.round((1.0 - factor) * 100)}% (Dry Soil)`;
            // Handled by scaling precipitation output
            perturbedWeather = weatherSeries.map(w => ({
                ...w,
                precipMm: (w.precipMm || 0.0) * factor
            }));
        }

        // 2. Run isolated hydrology model forecast calculation
        const dummyOPW = { stage: perturbedClonmelStage };
        const dummyUpstream = { stage: perturbedKnockloftyStage };
        const perturbedForecast = this.hydrologyModel.generateForecastSeries(
            dummyOPW,
            dummyUpstream,
            perturbedWeather,
            48
        );

        // 3. Compare with baseline
        const basePeakStage = baselineSnapshot.outputs.peakStageP50;
        const basePeakQ = baselineSnapshot.outputs.peakQP50;
        const basePeakLead = baselineSnapshot.outputs.peakLeadHours;

        const expPeakStage = perturbedForecast.peak.stage;
        const expPeakQ = perturbedForecast.peak.discharge;
        const expPeakLead = perturbedForecast.peak.leadTimeHours;

        const deltaStage = expPeakStage - basePeakStage;
        const deltaQ = expPeakQ - basePeakQ;
        const deltaTiming = expPeakLead - basePeakLead;

        const experimentResult = {
            isSuccess: true,
            experimentId: `SENS-EXP-${Date.now().toString(36).toUpperCase()}`,
            timestamp: new Date().toISOString(),
            isHypotheticalExperiment: true,
            disclaimer: 'SENSITIVITY EXPERIMENT ONLY — This isolated run tests model response under controlled assumptions and does NOT represent an operational real-world forecast.',
            baselineRunId: baselineSnapshot.runId,
            perturbedVariable: variable,
            variableLabel,
            parameters: { factor, offset },
            results: {
                baselinePeakStage: basePeakStage,
                experimentPeakStage: expPeakStage,
                deltaPeakStageM: parseFloat(deltaStage.toFixed(2)),
                baselinePeakQ: basePeakQ,
                experimentPeakQ: expPeakQ,
                deltaPeakQM3S: parseFloat(deltaQ.toFixed(1)),
                baselinePeakLeadHours: basePeakLead,
                experimentPeakLeadHours: expPeakLead,
                deltaPeakTimingHours: deltaTiming
            },
            scientificConclusion: `An isolated perturbation of ${variableLabel} produces a ${deltaStage >= 0 ? '+' : ''}${deltaStage.toFixed(2)}m change in peak river stage (${expPeakStage.toFixed(2)}m OD) and ${deltaQ >= 0 ? '+' : ''}${deltaQ.toFixed(1)} m³/s in peak inflow discharge. This quantifies model sensitivity to this specific factor while all other variables remain fixed.`
        };

        this.activeExperiment = experimentResult;
        return experimentResult;
    }

    clearExperiment() {
        this.activeExperiment = null;
    }
}
