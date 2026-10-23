/**
 * explanation_model.js
 * 
 * Formal Type Definitions, Schemas, Quality Flags, and Validation
 * for the Clonmel Explainable Flood Forecast Architecture.
 */

export const QUALITY_FLAGS = {
    LIVE_VERIFIED: {
        code: 'LIVE_VERIFIED',
        label: 'Live Verified',
        cssClass: 'qc-pill verified',
        description: 'Direct real-time telemetry passing all quality-control bounds.'
    },
    CACHED_PROVISIONAL: {
        code: 'CACHED_PROVISIONAL',
        label: 'Cached Provisional',
        cssClass: 'qc-pill provisional',
        description: 'Cached field observation within acceptable temporal validity limits.'
    },
    STALE_DATA: {
        code: 'STALE_DATA',
        label: 'Stale Input',
        cssClass: 'qc-pill stale',
        description: 'Input observation exceeds maximum allowable latency threshold.'
    },
    MISSING_FEED: {
        code: 'MISSING_FEED',
        label: 'Missing Feed',
        cssClass: 'qc-pill missing',
        description: 'Required telemetry stream unavailable; baseline default applied.'
    },
    OUT_OF_BOUNDS: {
        code: 'OUT_OF_BOUNDS',
        label: 'Range Outlier',
        cssClass: 'qc-pill range-error',
        description: 'Sensor reading exceeds physical instrument operating limits.'
    },
    SPIKE_FILTERED: {
        code: 'SPIKE_FILTERED',
        label: 'Spike Filtered',
        cssClass: 'qc-pill filtered',
        description: 'Sudden rate-of-change discontinuity detected and smoothed.'
    }
};

export const EVIDENCE_TYPES = {
    OBSERVED_GAUGE: 'observed_gauge',
    FORECAST_PRECIPITATION: 'forecast_precipitation',
    OBSERVED_PRECIPITATION: 'observed_precipitation',
    HYDROLOGICAL_PARAMETER: 'hydrological_parameter',
    NUMERICAL_GRID_PARAMETER: 'numerical_grid_parameter',
    BOUNDARY_CONDITION: 'boundary_condition',
    DERIVED_RUNOFF: 'derived_runoff',
    SENSITIVITY_PERTURBATION: 'sensitivity_perturbation'
};

/**
 * Validates a Forecast Evidence Record
 */
export function validateEvidenceRecord(record) {
    const errors = [];
    if (!record.id) errors.push('Missing evidence record ID');
    if (!record.name) errors.push('Missing evidence record name');
    if (!record.source) errors.push('Missing source provenance');
    if (typeof record.value !== 'number' || isNaN(record.value)) errors.push('Invalid or non-numeric evidence value');
    if (!record.unit) errors.push('Missing unit of measurement');
    if (!record.evidenceType) errors.push('Missing evidence type');

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates a Forecast Run Metadata Structure
 */
export function validateForecastRun(run) {
    const errors = [];
    if (!run.runId) errors.push('Missing forecast run ID');
    if (!run.modelVersion) errors.push('Missing model version');
    if (!run.creationTime) errors.push('Missing creation timestamp');
    if (!run.dataCutoffTime) errors.push('Missing input data cutoff timestamp');
    if (!run.peak) errors.push('Missing peak forecast prediction');
    if (!Array.isArray(run.timeline)) errors.push('Timeline must be an array of timesteps');

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates a Sensitivity Experiment Request
 */
export function validateSensitivityRequest(req) {
    const errors = [];
    if (!req.variable) errors.push('Missing sensitivity variable');
    if (typeof req.factor !== 'number' && typeof req.offset !== 'number') {
        errors.push('Sensitivity experiment must specify either factor or offset');
    }

    // Guardrails on permissible perturbation ranges
    if (req.variable === 'precipitation' && req.factor !== undefined) {
        if (req.factor < 0.2 || req.factor > 3.0) {
            errors.push('Precipitation scaling factor must be between 0.2x (-80%) and 3.0x (+200%)');
        }
    }
    if (req.variable === 'upstream_stage' && req.offset !== undefined) {
        if (req.offset < -1.5 || req.offset > 2.5) {
            errors.push('Upstream stage offset must be between -1.5m and +2.5m');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
