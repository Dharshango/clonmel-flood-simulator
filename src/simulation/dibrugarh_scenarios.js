/**
 * dibrugarh_scenarios.js
 * Hydrological scenario configurations and gauge telemetry integration for Dibrugarh.
 * Incorporates Water Resources Department (WRD) Assam datums:
 * - Warning / High Flow Level: ~105.00 m MSL
 * - Danger Level (DL): 105.70 m MSL
 * - Highest Flood Level (HFL, Sept 1998): 106.48 m MSL
 */

export const DIBRUGARH_GAUGE_DATUMS = {
    stationName: 'WRD Station 03 (Brahmaputra River)',
    river: 'Brahmaputra River',
    datumUnit: 'm MSL',
    warningLevel: 105.00,
    dangerLevel: 105.70,
    hfl1998: 106.48,
    zeroLevel: 0.00
};

export const DIBRUGARH_SLIDER_LIMITS = {
    stageMin: 103.0,
    stageMax: 107.5,
    stageStep: 0.05,
    rainMin: 0,
    rainMax: 100,
    rainStep: 5,
    inflowMin: 10000,
    inflowMax: 60000,
    inflowStep: 500
};

export const DIBRUGARH_SCENARIOS = {
    'baseline-monsoon': {
        id: 'baseline-monsoon',
        name: 'Normal Monsoon Flow',
        tag: 'Normal Monsoon Flow',
        stageMSL: 104.50,
        rainfallRate: 0,
        riverInflow: 24500,
        downstreamSurge: 0.0,
        sluiceGates: 'open',
        overtopDyke: false,
        badgeColor: 'blue',
        badgeClass: 'blue',
        subtitle: '104.50 m MSL • Channel baseline',
        description: 'Brahmaputra in active monsoon flow within primary channel; DTP dyke freeboard safe (~1.2m margin).',
        affectedLocalities: []
    },
    'july-2024-flash': {
        id: 'july-2024-flash',
        name: 'July 2024 Urban Flash Flood',
        tag: 'July 2024 Flash Flood',
        stageMSL: 105.50,
        rainfallRate: 65,
        riverInflow: 36000,
        downstreamSurge: 0.8,
        sluiceGates: 'closed',
        overtopDyke: false,
        badgeColor: 'amber',
        badgeClass: 'amber',
        subtitle: '65 mm/h rain • 105.50 m stage',
        description: 'Monsoon cloudburst (65 mm/h) coupled with high river stage (105.50m MSL) forcing town sluice gates shut, causing severe backwater urban inundation.',
        affectedLocalities: [
            'Graham Bazaar',
            'AT Road',
            'Mancotta Road',
            'Naliapool',
            'Thana Chariali',
            'Santipara'
        ]
    },
    'sept-1998-record': {
        id: 'sept-1998-record',
        name: 'Sept 1998 Historic River Flood',
        tag: 'Sept 1998 Record Flood',
        stageMSL: 106.48,
        rainfallRate: 35,
        riverInflow: 52000,
        downstreamSurge: 1.5,
        sluiceGates: 'closed',
        overtopDyke: true,
        badgeColor: 'red',
        badgeClass: 'red',
        subtitle: '106.48 m HFL • Overtopping DTP dyke',
        description: 'Historical peak Brahmaputra flood (106.48m MSL HFL) exceeding DTP dyke crest and inundating riverfront settlements.',
        affectedLocalities: [
            'Graham Bazaar',
            'AT Road',
            'DTP Dyke Service Rd',
            'Maijan',
            'Panchali',
            'Naliapool',
            'Marwari Patty'
        ]
    }
};

/**
 * Returns gauge telemetry classification status based on stage MSL.
 * @param {number} stageMSL 
 * @returns {'NORMAL FLOW' | 'HIGH FLOW' | 'DANGER LEVEL EXCEEDED' | 'HISTORIC PEAK OVERTOPPING'}
 */
export function getDibrugarhGaugeStatus(stageMSL) {
    if (stageMSL >= DIBRUGARH_GAUGE_DATUMS.hfl1998) {
        return 'HISTORIC PEAK OVERTOPPING';
    }
    if (stageMSL >= DIBRUGARH_GAUGE_DATUMS.dangerLevel) {
        return 'DANGER LEVEL EXCEEDED';
    }
    if (stageMSL >= DIBRUGARH_GAUGE_DATUMS.warningLevel) {
        return 'HIGH FLOW';
    }
    return 'NORMAL FLOW';
}

/**
 * Applies a selected Dibrugarh hydrological scenario to the SWE solver and optional HUD state.
 * @param {string} scenarioId 
 * @param {object} solver 
 * @param {object} [hudState] 
 * @returns {object|null} The applied scenario configuration
 */
export function applyDibrugarhScenario(scenarioId, solver, hudState = null) {
    const sc = DIBRUGARH_SCENARIOS[scenarioId];
    if (!sc) {
        console.warn(`[applyDibrugarhScenario] Unknown scenario: ${scenarioId}`);
        return null;
    }

    if (solver && solver.params) {
        solver.params.rainIntensity = sc.rainfallRate;
        solver.params.rainRate = sc.rainfallRate;
        solver.params.riverInflow = sc.riverInflow;
        solver.params.downstreamSurge = sc.downstreamSurge;
        solver.params.stageMSL = sc.stageMSL;
        if (typeof solver.reset === 'function') {
            solver.reset();
        }
    }

    if (hudState) {
        if (hudState.sliderInflow) {
            hudState.sliderInflow.value = sc.stageMSL;
        }
        if (hudState.valInflow) {
            hudState.valInflow.textContent = `${sc.stageMSL.toFixed(2)} m MSL`;
        }
        if (hudState.sliderRain) {
            hudState.sliderRain.value = sc.rainfallRate;
        }
        if (hudState.valRain) {
            hudState.valRain.textContent = `${sc.rainfallRate} mm/h`;
        }
        if (hudState.sliderSurge) {
            hudState.sliderSurge.value = sc.downstreamSurge;
        }
        if (hudState.valSurge) {
            hudState.valSurge.textContent = `${sc.downstreamSurge >= 0 ? '+' : ''}${sc.downstreamSurge.toFixed(2)} m`;
        }
        if (hudState.activeScenarioTag) {
            hudState.activeScenarioTag.textContent = sc.tag || sc.name;
        }
    }

    return sc;
}
