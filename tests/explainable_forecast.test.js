/**
 * explainable_forecast.test.js
 * 
 * Comprehensive Unit Test Suite for Explainable Flood Forecast Feature.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
    validateEvidenceRecord,
    validateForecastRun,
    validateSensitivityRequest,
    QUALITY_FLAGS,
    EVIDENCE_TYPES
} from '../src/explainability/explanation_model.js';

import { ForecastEvidenceAnalyzer } from '../src/explainability/evidence_analyzer.js';
import { ForecastDiffEngine } from '../src/explainability/forecast_diff_engine.js';
import { SpatialForecastExplainer } from '../src/explainability/spatial_explainer.js';
import { SensitivityExplorer } from '../src/explainability/sensitivity_explorer.js';
import { CatchmentHydrologyModel } from '../src/forecasting/hydrology_model.js';
import { ForecastNarrativeEngine } from '../src/explainability/narrative_engine.js';
import { ForecastValidationAnalyzer } from '../src/explainability/validation_analyzer.js';

describe('Forecast Evidence Schema Validation', () => {
    it('validates a complete evidence record', () => {
        const record = {
            id: 'EVID-OPW-16009',
            name: 'Knocklofty Gauge',
            source: 'OPW Hydrometric Station 16009',
            value: 1.85,
            unit: 'm',
            evidenceType: EVIDENCE_TYPES.OBSERVED_GAUGE
        };
        const res = validateEvidenceRecord(record);
        assert.strictEqual(res.isValid, true);
        assert.strictEqual(res.errors.length, 0);
    });

    it('rejects an evidence record missing required fields or non-numeric value', () => {
        const invalidRecord = {
            id: 'EVID-BAD',
            name: 'Missing fields',
            value: 'not-a-number'
        };
        const res = validateEvidenceRecord(invalidRecord);
        assert.strictEqual(res.isValid, false);
        assert.ok(res.errors.length >= 2);
    });

    it('enforces sensitivity request bounds', () => {
        const validReq = { variable: 'precipitation', factor: 1.25 };
        assert.strictEqual(validateSensitivityRequest(validReq).isValid, true);

        const extremeReq = { variable: 'precipitation', factor: 4.5 };
        assert.strictEqual(validateSensitivityRequest(extremeReq).isValid, false);

        const extremeOffset = { variable: 'upstream_stage', offset: 5.0 };
        assert.strictEqual(validateSensitivityRequest(extremeOffset).isValid, false);
    });
});

describe('Discharge Decomposition and Component Shares', () => {
    const analyzer = new ForecastEvidenceAnalyzer();
    const hydrology = new CatchmentHydrologyModel();

    it('accurately decomposes total inflow into baseflow, wave, and runoff', () => {
        const mockPackage = {
            horizonHours: 48,
            currentConditions: { stage: 1.20, discharge: 60.0, upstreamStage: 2.10, upstreamDischarge: 140.0 },
            timeline: [
                { leadTimeHours: 0, timeLabel: '+0h', dateString: 'Oct 23, 18:00', qP50: 60.0, stageP50: 1.20 },
                { leadTimeHours: 12, timeLabel: '+12h', dateString: 'Oct 24, 06:00', qP50: 180.0, stageP50: 2.30 }
            ]
        };

        const decomp0 = analyzer.decomposeDischargeComponents(0, mockPackage, hydrology);
        assert.strictEqual(decomp0.leadTimeHours, 0);
        assert.ok(decomp0.shares.baseflowPct >= 95, 'At lead 0, baseflow should dominate');

        const decomp12 = analyzer.decomposeDischargeComponents(12, mockPackage, hydrology);
        assert.strictEqual(decomp12.leadTimeHours, 12);
        assert.ok(decomp12.shares.baseflowPct < 100);
        assert.ok(decomp12.shares.upstreamWavePct >= 0);
        assert.ok(decomp12.shares.runoffPct >= 0);
        // Total percentages sum to 100%
        const sumPct = decomp12.shares.baseflowPct + decomp12.shares.upstreamWavePct + decomp12.shares.runoffPct;
        assert.strictEqual(sumPct, 100);
    });
});

describe('Forecast-Run Diff Engine and Attribution Guardrails', () => {
    const diffEngine = new ForecastDiffEngine();

    const runA = {
        runId: 'CLM-FC-CYCLE-1',
        modelVersion: 'Hydroverse-v1.4-SWE',
        creationTime: '2026-10-23T12:00:00Z',
        dataCutoffTime: '2026-10-23T11:45:00Z',
        inputs: {
            clonmelStage: 1.15,
            knockloftyStage: 1.40,
            cumulativePrecipMm: 22.0,
            peakHourlyPrecipMm: 3.5
        },
        outputs: {
            peakLeadHours: 18,
            peakStageP50: 2.45,
            peakQP50: 210.0,
            peakStageBand: [2.10, 2.80],
            riskTier: 'WATCH'
        }
    };

    const runB = {
        runId: 'CLM-FC-CYCLE-2',
        modelVersion: 'Hydroverse-v1.4-SWE',
        creationTime: '2026-10-23T18:00:00Z',
        dataCutoffTime: '2026-10-23T17:45:00Z',
        inputs: {
            clonmelStage: 1.25,
            knockloftyStage: 1.70,
            cumulativePrecipMm: 32.5,
            peakHourlyPrecipMm: 5.2
        },
        outputs: {
            peakLeadHours: 16,
            peakStageP50: 2.85,
            peakQP50: 295.0,
            peakStageBand: [2.40, 3.25],
            riskTier: 'WARNING'
        }
    };

    it('correctly calculates output and input deltas between runs', () => {
        const diff = diffEngine.compareRuns(runB, runA);
        assert.strictEqual(diff.isComparable, true);
        assert.strictEqual(diff.deltas.peakStageM, 0.40);
        assert.strictEqual(diff.deltas.peakQM3S, 85.0);
        assert.strictEqual(diff.deltas.peakTimingHours, -2);
        assert.strictEqual(diff.deltas.upstreamKnockloftyM, 0.30);
        assert.strictEqual(diff.deltas.cumulativePrecipMm, 10.5);
    });

    it('attribution narrative explicitly avoids unproven causal claims', () => {
        const diff = diffEngine.compareRuns(runB, runA);
        assert.ok(diff.attributionNarrative.includes('descriptive comparison does not independently quantify'));
    });
});

describe('Spatial Forecast Explainer Mechanism Classification', () => {
    const meta = {
        width_m: 2000,
        height_m: 1400,
        grid_w: 128,
        grid_h: 128,
        bbox: { west: -7.7300, east: -7.6700, south: 52.3420, north: 52.3680 }
    };
    const elevArray = new Float32Array(128 * 128).fill(19.0);

    const explainer = new SpatialForecastExplainer(meta, elevArray);

    it('correctly classifies a dry location', () => {
        const mockSimDry = {
            samplePoint: () => ({ h: 0.0, peak_h: 0.0, u: 0.0, v: 0.0 })
        };
        const res = explainer.explainLocation(0.53, 0.44, mockSimDry, 'The Quay');
        assert.strictEqual(res.inundationStatus.mechanism, 'DRY');
        assert.strictEqual(res.elevations.depthM, 0.0);
    });

    it('identifies overland flow when flood depth and velocity are present', () => {
        const mockSimWet = {
            samplePoint: () => ({ h: 0.45, peak_h: 0.65, u: 0.4, v: 0.3 })
        };
        const res = explainer.explainLocation(0.20, 0.20, mockSimWet, 'Inland Street');
        assert.strictEqual(res.inundationStatus.mechanism, 'OVERLAND_FLOW_PATH');
        assert.strictEqual(res.elevations.depthM, 0.45);
        assert.ok(res.elevations.speedMps > 0.35);
    });
});

describe('Sensitivity Explorer Isolated Perturbations', () => {
    const hydrology = new CatchmentHydrologyModel();
    const explorer = new SensitivityExplorer(hydrology);

    const baselineSnapshot = {
        runId: 'BASE-RUN-01',
        inputs: { clonmelStage: 1.15, knockloftyStage: 1.45, cumulativePrecipMm: 25.0, peakHourlyPrecipMm: 4.0 },
        outputs: { peakLeadHours: 14, peakStageP50: 2.30, peakQP50: 180.0, peakStageBand: [2.0, 2.6], riskTier: 'WATCH' }
    };

    const mockForecastManager = {
        telemetry: {
            weather: {
                series: Array(48).fill(0).map((_, i) => ({ precipMm: i < 12 ? 2.5 : 0.0 }))
            }
        }
    };

    it('computes isolated precipitation sensitivity without altering baseline', () => {
        const res = explorer.runSensitivityExperiment(baselineSnapshot, mockForecastManager, {
            variable: 'precipitation',
            factor: 1.50 // +50% rain
        });

        assert.strictEqual(res.isSuccess, true);
        assert.strictEqual(res.isHypotheticalExperiment, true);
        assert.ok(res.results.deltaPeakStageM > 0, 'Higher precipitation must increase peak stage');
        assert.ok(res.results.deltaPeakQM3S > 0, 'Higher precipitation must increase peak Q');
        assert.strictEqual(baselineSnapshot.outputs.peakStageP50, 2.30, 'Baseline state must remain unaltered');
    });

    it('rejects an invalid variable or out-of-bounds perturbation', () => {
        const res = explorer.runSensitivityExperiment(baselineSnapshot, mockForecastManager, {
            variable: 'precipitation',
            factor: 10.0 // Out of bounds factor
        });
        assert.strictEqual(res.isSuccess, false);
    });
});

describe('Deterministic 5-Section Narrative Synthesis', () => {
    const narrativeEngine = new ForecastNarrativeEngine();
    const evidenceAnalyzer = new ForecastEvidenceAnalyzer();

    const mockPackage = {
        horizonHours: 48,
        currentConditions: { stage: 1.15, discharge: 55.0, upstreamStage: 1.45, upstreamDischarge: 85.0 },
        timeline: [
            { leadTimeHours: 14, timeLabel: '+14h', dateString: 'Oct 24, 08:00', qP50: 240.0, stageP50: 2.65, stageBand: [2.35, 2.95] }
        ],
        peak: {
            leadTimeHours: 14,
            timeLabel: '+14h',
            dateString: 'Oct 24, 08:00',
            stage: 2.65,
            discharge: 240.0,
            stageBand: [2.35, 2.95],
            riskTier: 'WATCH'
        }
    };

    it('generates all 5 required structural narrative sections', () => {
        const narrative = narrativeEngine.generateForecastNarrative({
            forecastPackage: mockPackage,
            evidenceAnalyzer,
            diffResult: null,
            validationAssessment: null,
            selectedLocationExplanation: null
        });

        assert.strictEqual(narrative.sections.length, 5);
        assert.ok(narrative.sections[0].title.includes('What the Model Predicts'));
        assert.ok(narrative.sections[1].title.includes('What Evidence Supports It'));
        assert.ok(narrative.sections[2].title.includes('What Changed'));
        assert.ok(narrative.sections[3].title.includes('What Remains Uncertain'));
        assert.ok(narrative.sections[4].title.includes('How This Should Be Interpreted'));

        // Check values are embedded
        assert.ok(narrative.sections[0].content.includes('2.65m OD'));
        assert.ok(narrative.sections[0].content.includes('240.0 m³/s'));
        assert.ok(narrative.sections[4].content.includes('Tipperary County Council'));
    });
});
