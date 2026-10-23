/**
 * explainability_manager.js
 * 
 * Central State Orchestrator and Integration Manager
 * for the Explainable Flood Forecast Feature (Workspace 10).
 */

import { ForecastEvidenceAnalyzer } from './evidence_analyzer.js';
import { ForecastDiffEngine } from './forecast_diff_engine.js';
import { SpatialForecastExplainer } from './spatial_explainer.js';
import { SensitivityExplorer } from './sensitivity_explorer.js';
import { ForecastValidationAnalyzer } from './validation_analyzer.js';
import { ForecastNarrativeEngine } from './narrative_engine.js';

export class ExplainabilityManager {
    constructor(meta, elevArray, forecastManager) {
        this.meta = meta;
        this.elevArray = elevArray;
        this.forecastManager = forecastManager;

        // Sub-modules
        this.evidenceAnalyzer = new ForecastEvidenceAnalyzer();
        this.diffEngine = new ForecastDiffEngine();
        this.spatialExplainer = new SpatialForecastExplainer(meta, elevArray);
        this.sensitivityExplorer = new SensitivityExplorer(forecastManager?.hydrologyModel);
        this.validationAnalyzer = new ForecastValidationAnalyzer();
        this.narrativeEngine = new ForecastNarrativeEngine();

        // State
        this.currentSnapshot = null;
        this.diffResult = null;
        this.selectedLocation = { u: 0.53, v: 0.44, street: 'The Quay / Quay Street' };
        this.selectedLocationExplanation = null;
        this.activeEvidenceFilter = 'all';

        this.listeners = [];

        // Connect listener to forecastManager updates
        if (this.forecastManager) {
            this.forecastManager.onUpdate(() => this.syncWithForecastManager());
        }
    }

    onUpdate(fn) {
        this.listeners.push(fn);
    }

    notify() {
        for (const fn of this.listeners) {
            try { fn(this); } catch (e) { console.error('[ExplainabilityManager] listener error:', e); }
        }
    }

    /**
     * Synchronizes explainability data with the latest forecast cycle
     */
    syncWithForecastManager(simulator = null) {
        if (!this.forecastManager || !this.forecastManager.forecastPackage) return;

        // 1. Snapshot current run
        const snap = this.diffEngine.recordRunSnapshot(this.forecastManager);
        this.currentSnapshot = snap;

        // 2. Ensure baseline run exists for run-to-run diff comparison
        this.diffEngine.seedBaselineRunIfEmpty(snap);

        // 3. Compute diff between current and previous run
        if (this.diffEngine.runHistory.length >= 2) {
            this.diffResult = this.diffEngine.compareRuns(
                this.diffEngine.runHistory[0],
                this.diffEngine.runHistory[1]
            );
        }

        // 4. Update spatial explanation for selected location
        if (simulator) {
            this.updateSpatialExplanation(simulator);
        }

        this.notify();
    }

    /**
     * Selects and explains a new 3D location
     */
    selectLocation(u, v, street, simulator) {
        this.selectedLocation = { u, v, street };
        this.updateSpatialExplanation(simulator);
        this.notify();
    }

    updateSpatialExplanation(simulator) {
        if (!simulator) return;
        this.selectedLocationExplanation = this.spatialExplainer.explainLocation(
            this.selectedLocation.u,
            this.selectedLocation.v,
            simulator,
            this.selectedLocation.street
        );
    }

    /**
     * Sets active filter for the structured evidence table
     */
    setEvidenceFilter(filterKey) {
        this.activeEvidenceFilter = filterKey;
        this.notify();
    }

    /**
     * Runs an isolated sensitivity perturbation experiment
     */
    runSensitivityExperiment({ variable, factor = 1.0, offset = 0.0 }) {
        if (!this.currentSnapshot) return null;
        const res = this.sensitivityExplorer.runSensitivityExperiment(
            this.currentSnapshot,
            this.forecastManager,
            { variable, factor, offset }
        );
        this.notify();
        return res;
    }

    clearSensitivityExperiment() {
        this.sensitivityExplorer.clearExperiment();
        this.notify();
    }

    /**
     * Synthesizes the complete narrative
     */
    getNarrative() {
        return this.narrativeEngine.generateForecastNarrative({
            forecastPackage: this.forecastManager?.forecastPackage,
            evidenceAnalyzer: this.evidenceAnalyzer,
            diffResult: this.diffResult,
            validationAssessment: this.validationAnalyzer.evaluateReliabilityAssessment(this.forecastManager),
            selectedLocationExplanation: this.selectedLocationExplanation
        });
    }

    /**
     * Retrieves all structured evidence records
     */
    getEvidenceList() {
        return this.evidenceAnalyzer.extractEvidenceInventory(this.forecastManager);
    }

    /**
     * Retrieves discharge component breakdown for active lead time
     */
    getDischargeBreakdown(leadHours = null) {
        const h = leadHours !== null ? leadHours : (this.forecastManager?.currentLeadTimeHours || 0);
        return this.evidenceAnalyzer.decomposeDischargeComponents(
            h,
            this.forecastManager?.forecastPackage,
            this.forecastManager?.hydrologyModel
        );
    }

    /**
     * Retrieves reliability and validation assessment
     */
    getValidationAssessment() {
        return this.validationAnalyzer.evaluateReliabilityAssessment(this.forecastManager);
    }
}
