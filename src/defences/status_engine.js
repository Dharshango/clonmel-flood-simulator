/**
 * status_engine.js
 * 
 * Multi-Criteria Status Evaluation Engine for Clonmel Flood Defences.
 * Enforces strict separation between data verification, physical freeboard,
 * and operational deployment confirmation.
 */

import { DEFENCE_STATUSES } from './defence_model.js';

export class DefenceStatusEngine {
    constructor() {
        this.ruleVersion = '1.0.0-OPW-CLONMEL';
    }

    /**
     * Determines the operational decision-support status for an asset.
     * 
     * @param {Object} asset - The defence asset record
     * @param {Object} freeboardResult - Result from FreeboardAnalyzer
     * @param {Object} [scenarioOverrides] - User-applied hypothetical test overrides
     * @returns {Object} Comprehensive status assessment
     */
    evaluateStatus(asset, freeboardResult, scenarioOverrides = {}) {
        const op = asset.operational || {};
        const prov = asset.provenance || {};
        const isDemountable = op.isDemountable === true;
        const isPump = op.isPumpingStation === true;

        // Check for hypothetical scenario override
        const override = scenarioOverrides[asset.id];
        const isHypothetical = override !== undefined;

        // 1. Check for Operational Confirmation Requirements:
        // Demountable barrier with unconfirmed deployment
        if (isDemountable) {
            const deploymentStatus = isHypothetical && override.deploymentStatus 
                ? override.deploymentStatus 
                : (op.deploymentStatus || 'UNCONFIRMED_DEPLOYMENT');

            if (deploymentStatus === 'UNCONFIRMED_DEPLOYMENT') {
                return {
                    status: DEFENCE_STATUSES.OPERATIONAL_CONFIRMATION_REQUIRED,
                    statusCode: 'OPERATIONAL_CONFIRMATION_REQUIRED',
                    reason: 'Demountable barrier deployment unconfirmed in field — manual barrier erection required during flood alerts.',
                    isOperationalConfirmed: false,
                    isHypothetical,
                    ruleId: 'RULE_DEMOUNTABLE_UNCONFIRMED',
                    ruleVersion: this.ruleVersion
                };
            }
        }

        // Pumping station with unconfirmed SCADA telemetry
        if (isPump) {
            const pumpStatus = isHypothetical && override.operationalStatus 
                ? override.operationalStatus 
                : (op.operationalStatus || 'UNCONFIRMED_TELEMETRY');

            if (pumpStatus === 'UNCONFIRMED_TELEMETRY') {
                return {
                    status: DEFENCE_STATUSES.OPERATIONAL_CONFIRMATION_REQUIRED,
                    statusCode: 'OPERATIONAL_CONFIRMATION_REQUIRED',
                    reason: 'Stormwater pump station telemetry unconfirmed remotely — operational readiness requires local confirmation.',
                    isOperationalConfirmed: false,
                    isHypothetical,
                    ruleId: 'RULE_PUMP_TELEMETRY_UNCONFIRMED',
                    ruleVersion: this.ruleVersion
                };
            }
        }

        // 2. Check for Review Recommended:
        // Documented condition defects, severe freeboard erosion, or inspection flags
        if (op.conditionGrade && op.conditionGrade.includes('Review')) {
            return {
                status: DEFENCE_STATUSES.REVIEW_RECOMMENDED,
                statusCode: 'REVIEW_RECOMMENDED',
                reason: op.conditionNotes || 'Asset inspection log records condition review recommended.',
                isOperationalConfirmed: true,
                isHypothetical,
                ruleId: 'RULE_CONDITION_DEFECT_FLAG',
                ruleVersion: this.ruleVersion
            };
        }

        if (freeboardResult && freeboardResult.isCalculable) {
            if (freeboardResult.statusTag === 'NEGATIVE_FREEBOARD') {
                return {
                    status: DEFENCE_STATUSES.REVIEW_RECOMMENDED,
                    statusCode: 'REVIEW_RECOMMENDED',
                    reason: `Calculated water surface (${freeboardResult.waterLevelMOD}m OD) exceeds verified crest (${freeboardResult.crestElevationMOD}m OD).`,
                    isOperationalConfirmed: true,
                    isHypothetical,
                    ruleId: 'RULE_WATER_EXCEEDS_CREST',
                    ruleVersion: this.ruleVersion
                };
            }
            if (freeboardResult.statusTag === 'UNCERTAIN_OVERTOPPING_RISK') {
                return {
                    status: DEFENCE_STATUSES.REVIEW_RECOMMENDED,
                    statusCode: 'REVIEW_RECOMMENDED',
                    reason: `Freeboard buffer (${freeboardResult.freeboardM}m) overlaps combined survey/model uncertainty (±${freeboardResult.combinedUncertaintyM}m).`,
                    isOperationalConfirmed: true,
                    isHypothetical,
                    ruleId: 'RULE_UNCERTAINTY_OVERLAP',
                    ruleVersion: this.ruleVersion
                };
            }
        }

        // 3. Check for Monitoring Available:
        if (freeboardResult && freeboardResult.isCalculable) {
            return {
                status: DEFENCE_STATUSES.MONITORING_AVAILABLE,
                statusCode: 'MONITORING_AVAILABLE',
                reason: `Active freeboard monitoring verified (${freeboardResult.freeboardM}m positive margin).`,
                isOperationalConfirmed: true,
                isHypothetical,
                ruleId: 'RULE_MONITORING_ACTIVE',
                ruleVersion: this.ruleVersion
            };
        }

        // 4. Fallback to Data Verified if provenance is documented:
        if (prov.verificationStatus === 'VERIFIED_SOURCE') {
            return {
                status: DEFENCE_STATUSES.DATA_VERIFIED,
                statusCode: 'DATA_VERIFIED',
                reason: 'Physical geometry and crest attributes verified from OPW scheme records; real-time water comparison not currently active.',
                isOperationalConfirmed: false,
                isHypothetical,
                ruleId: 'RULE_DATA_VERIFIED_ONLY',
                ruleVersion: this.ruleVersion
            };
        }

        return {
            status: DEFENCE_STATUSES.INSUFFICIENT_DATA,
            statusCode: 'INSUFFICIENT_DATA',
            reason: 'Insufficient verified physical or operational attributes.',
            isOperationalConfirmed: false,
            isHypothetical,
            ruleId: 'RULE_INSUFFICIENT_DATA',
            ruleVersion: this.ruleVersion
        };
    }
}
