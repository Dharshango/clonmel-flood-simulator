/**
 * defence_monitor.test.js
 * 
 * Unit tests for Flood Defence Performance Monitor:
 * - Schema validation
 * - Datum compatibility
 * - Freeboard calculation
 * - Uncertainty quantification
 * - Status classification rules
 * - Operational confirmation for demountables and pumps
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateDefenceAsset, DEFENCE_TYPES } from '../src/defences/defence_model.js';
import { FreeboardAnalyzer } from '../src/defences/freeboard_analyzer.js';
import { DefenceStatusEngine } from '../src/defences/status_engine.js';

describe('Flood Defence Asset Schema Validation', () => {
    it('validates a complete engineering asset record', () => {
        const asset = {
            id: 'OPW-CLM-W01',
            name: 'North Quay Wall',
            type: 'permanent_wall',
            coordinates: [[-7.705, 52.353], [-7.701, 52.353]],
            provenance: {
                sourceOrganisation: 'Office of Public Works (OPW)'
            }
        };
        const res = validateDefenceAsset(asset);
        assert.equal(res.isValid, true);
        assert.equal(res.errors.length, 0);
    });

    it('rejects an asset missing ID or coordinates', () => {
        const invalid = {
            name: 'Nameless Barrier',
            type: 'permanent_wall',
            coordinates: []
        };
        const res = validateDefenceAsset(invalid);
        assert.equal(res.isValid, false);
        assert.ok(res.errors.some(e => e.includes('Missing asset ID')));
        assert.ok(res.errors.some(e => e.includes('geometry coordinates')));
    });

    it('rejects an unrecognized asset type', () => {
        const invalid = {
            id: 'TEST-01',
            name: 'Invalid Type',
            type: 'laser_shield',
            coordinates: [[-7.70, 52.35]],
            provenance: { sourceOrganisation: 'OPW' }
        };
        const res = validateDefenceAsset(invalid);
        assert.equal(res.isValid, false);
        assert.ok(res.errors.some(e => e.includes('Unknown asset type')));
    });
});

describe('Freeboard Analyzer Preconditions & Calculations', () => {
    const mockMeta = {
        bbox: { west: -7.73, east: -7.68, south: 52.345, north: 52.364 },
        grid_w: 100,
        grid_h: 100,
        width_m: 3400,
        height_m: 2100
    };
    const mockElevArray = new Float32Array(10000).fill(20.0);
    const analyzer = new FreeboardAnalyzer(mockMeta, mockElevArray);

    it('calculates freeboard accurately when compatible elevations exist', () => {
        const asset = {
            id: 'W01',
            name: 'Quay Wall',
            type: 'permanent_wall',
            coordinates: [[-7.705, 52.353]],
            physical: {
                crestElevationMOD: 22.40,
                crestElevationDatum: 'Malin Head OD',
                groundElevationMOD: 20.0,
                surveyUncertaintyM: 0.05,
                designFreeboardM: 0.60
            }
        };

        const mockSimulator = {
            sampleWaterDepthAt: () => 1.20 // 20.0 ground + 1.20 depth = 21.20m OD water level
        };

        const res = analyzer.evaluateAssetFreeboard(asset, mockSimulator);
        assert.equal(res.isCalculable, true);
        assert.equal(res.crestElevationMOD, 22.40);
        assert.equal(res.waterLevelMOD, 21.20);
        // Freeboard = 22.40 - 21.20 = 1.20m
        assert.equal(res.freeboardM, 1.20);
        assert.equal(res.statusTag, 'POSITIVE_FREEBOARD');
    });

    it('detects overtopped condition (negative freeboard)', () => {
        const asset = {
            id: 'W01',
            name: 'Low Wall',
            type: 'permanent_wall',
            coordinates: [[-7.705, 52.353]],
            physical: {
                crestElevationMOD: 21.50,
                crestElevationDatum: 'Malin Head OD',
                groundElevationMOD: 20.0
            }
        };

        const mockSimulator = {
            sampleWaterDepthAt: () => 1.80 // 20.0 + 1.80 = 21.80m OD (exceeds 21.50m)
        };

        const res = analyzer.evaluateAssetFreeboard(asset, mockSimulator);
        assert.equal(res.isCalculable, true);
        assert.equal(res.freeboardM, -0.30);
        assert.equal(res.statusTag, 'NEGATIVE_FREEBOARD');
        assert.ok(res.statusLabel.includes('Overtopped'));
    });

    it('refuses calculation when datum is mismatched or unknown', () => {
        const asset = {
            id: 'W02',
            name: 'Foreign Datum Wall',
            type: 'permanent_wall',
            coordinates: [[-7.705, 52.353]],
            physical: {
                crestElevationMOD: 22.50,
                crestElevationDatum: 'Poolbeg OD' // incompatible with Malin Head OD
            }
        };

        const res = analyzer.evaluateAssetFreeboard(asset, null);
        assert.equal(res.isCalculable, false);
        assert.ok(res.reason.includes('datum mismatch'));
    });

    it('refuses calculation when crest elevation is missing', () => {
        const asset = {
            id: 'W03',
            name: 'Unsurveyed Wall',
            type: 'permanent_wall',
            coordinates: [[-7.705, 52.353]],
            physical: {
                crestElevationDatum: 'Malin Head OD'
                // crestElevationMOD omitted
            }
        };

        const res = analyzer.evaluateAssetFreeboard(asset, null);
        assert.equal(res.isCalculable, false);
        assert.ok(res.reason.includes('insufficient crest elevation data'));
    });
});

describe('Defence Status Engine Rules & Operational Dependencies', () => {
    const engine = new DefenceStatusEngine();

    it('enforces OPERATIONAL_CONFIRMATION_REQUIRED for unconfirmed demountable barriers', () => {
        const demountableAsset = {
            id: 'OPW-CLM-DB01',
            name: 'The Quay Demountable Barrier',
            type: 'demountable_barrier',
            operational: {
                isDemountable: true,
                deploymentStatus: 'UNCONFIRMED_DEPLOYMENT'
            },
            provenance: {
                verificationStatus: 'VERIFIED_SOURCE'
            }
        };

        const fb = { isCalculable: true, freeboardM: 0.85, statusTag: 'POSITIVE_FREEBOARD' };
        const status = engine.evaluateStatus(demountableAsset, fb);

        assert.equal(status.statusCode, 'OPERATIONAL_CONFIRMATION_REQUIRED');
        assert.equal(status.isOperationalConfirmed, false);
        assert.ok(status.reason.includes('Demountable barrier deployment unconfirmed'));
    });

    it('enforces OPERATIONAL_CONFIRMATION_REQUIRED for unconfirmed pump telemetry', () => {
        const pumpAsset = {
            id: 'OPW-CLM-PS01',
            name: 'Suir Island Pump Station',
            type: 'pumping_station',
            operational: {
                isPumpingStation: true,
                operationalStatus: 'UNCONFIRMED_TELEMETRY'
            },
            provenance: {
                verificationStatus: 'VERIFIED_SOURCE'
            }
        };

        const fb = { isCalculable: false };
        const status = engine.evaluateStatus(pumpAsset, fb);

        assert.equal(status.statusCode, 'OPERATIONAL_CONFIRMATION_REQUIRED');
        assert.equal(status.isOperationalConfirmed, false);
        assert.ok(status.reason.includes('pump station telemetry unconfirmed'));
    });

    it('flags REVIEW_RECOMMENDED when inspection notes record physical defects', () => {
        const assetWithDefect = {
            id: 'OPW-CLM-E03',
            name: 'Davis Road Embankment',
            type: 'embankment',
            operational: {
                conditionGrade: '3 - Fair (Review Recommended)',
                conditionNotes: 'Localized crest rutting noted on eastern chainage.'
            },
            provenance: { verificationStatus: 'VERIFIED_SOURCE' }
        };

        const fb = { isCalculable: true, freeboardM: 0.90, statusTag: 'POSITIVE_FREEBOARD' };
        const status = engine.evaluateStatus(assetWithDefect, fb);

        assert.equal(status.statusCode, 'REVIEW_RECOMMENDED');
        assert.ok(status.reason.includes('crest rutting'));
    });

    it('supports hypothetical scenario overrides and tracks isHypothetical', () => {
        const demountableAsset = {
            id: 'OPW-CLM-DB01',
            name: 'The Quay Demountable Barrier',
            type: 'demountable_barrier',
            operational: {
                isDemountable: true,
                deploymentStatus: 'UNCONFIRMED_DEPLOYMENT'
            }
        };

        const fb = { isCalculable: true, freeboardM: 0.85, statusTag: 'POSITIVE_FREEBOARD' };
        
        // Hypothetical override: assume council has deployed it
        const override = {
            'OPW-CLM-DB01': { deploymentStatus: 'CONFIRMED_DEPLOYED' }
        };
        const status = engine.evaluateStatus(demountableAsset, fb, override);

        assert.equal(status.isHypothetical, true);
        assert.equal(status.statusCode, 'MONITORING_AVAILABLE');
    });
});
