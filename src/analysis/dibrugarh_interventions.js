/**
 * dibrugarh_interventions.js
 * 
 * Dibrugarh Flood Interventions & Synchronized Dual-Simulation Replay Engine
 * 
 * Supports:
 * 1. DTP Dyke Crest Reinforcement (+0.8m MSL crest elevation boost)
 * 2. High-Capacity Sluice Gate Mobile/Fixed Pump Stations (15 m³/s at Graham Bazaar & Maijan)
 * 3. Freehand Flood Wall & Sandbag Barrier Placement on Dibrugarh Terrain
 * 4. Dual-Simulation Synchronized Replay & Difference Metrics Comparison
 */

/**
 * Registry of supported Dibrugarh flood mitigation interventions
 */
export const DIBRUGARH_INTERVENTIONS = {
    'dyke-reinforce': {
        id: 'dyke-reinforce',
        name: 'DTP Dyke Crest Reinforcement (+0.8m Crest)',
        description: 'Reinforce 9.5 km Dibrugarh Town Protection Dyke crest elevation by +0.8m with geo-bag revetment and boulder pitching against Brahmaputra overtopping.',
        defaultBoostM: 0.8,
        type: 'embankment',
        targetSectors: ['Nagakhelia', 'Graham Bazaar', 'Panchali', 'Maijan'],
        authority: 'Water Resources Department (WRD), Assam'
    },
    'mobile-pumps': {
        id: 'mobile-pumps',
        name: 'High-Capacity Sluice Pumps (15 m³/s)',
        description: 'Deploy 15 m³/s heavy-duty axial mobile and fixed dewatering pumps at Graham Bazaar and Maijan sluice outfalls to clear internal urban runoff during high river stages.',
        defaultCapacityM3s: 15.0,
        sluiceId: 'graham-bazaar-sluice',
        type: 'pump',
        dischargeTarget: 'Brahmaputra Main Channel'
    },
    'freehand-wall': {
        id: 'freehand-wall',
        name: 'Tactical Demountable Flood Wall',
        description: 'Interactive freehand wall drawn along AT Road, Thana Chariali, or Brahmaputra riverfront.',
        defaultHeightM: 1.5,
        defaultDepthM: 1.0,
        defaultThicknessM: 0.8,
        type: 'wall'
    },
    'sandbag-line': {
        id: 'sandbag-line',
        name: 'Emergency Sandbag Bund',
        description: 'Rapidly placed geo-bag sand bunds (1.0m height) for localized low-lying ward protection.',
        defaultHeightM: 1.0,
        defaultDepthM: 0.4,
        defaultThicknessM: 1.8,
        type: 'sandbags'
    }
};

/**
 * Reinforces DTP dyke by increasing crest elevation by boostMeters.
 * Handles both plain engineering objects and GeoJSON defence structures.
 * 
 * @param {Array<Object>} defences - Array of flood defence asset records
 * @param {number} [boostMeters=0.8] - Elevation increase in meters
 * @returns {Array<Object>} Reinforced defences array with updated crest elevation
 */
export function deployDykeReinforcement(defences, boostMeters = 0.8) {
    if (!Array.isArray(defences)) return [];

    return defences.map(d => {
        const copy = JSON.parse(JSON.stringify(d));
        copy.reinforced = true;
        copy.boostMeters = boostMeters;

        if (typeof copy.crestElevation === 'number') {
            copy.crestElevation = Math.round((copy.crestElevation + boostMeters) * 1000) / 1000;
        }

        if (copy.physical && typeof copy.physical.crestElevationMOD === 'number') {
            copy.physical.crestElevationMOD = Math.round((copy.physical.crestElevationMOD + boostMeters) * 1000) / 1000;
            copy.physical.reinforced = true;
            copy.physical.boostMeters = boostMeters;
            if (typeof copy.physical.wallHeightAboveGroundM === 'number') {
                copy.physical.wallHeightAboveGroundM = Math.round((copy.physical.wallHeightAboveGroundM + boostMeters) * 1000) / 1000;
            }
            if (typeof copy.physical.designFreeboardM === 'number') {
                copy.physical.designFreeboardM = Math.round((copy.physical.designFreeboardM + boostMeters) * 1000) / 1000;
            }
        }

        if (copy.operational) {
            copy.operational.reinforced = true;
            copy.operational.interventionStatus = 'REINFORCED';
        }

        return copy;
    });
}

/**
 * Configures and deploys high-capacity municipal stormwater pumps at a sluice outfall.
 * 
 * @param {string} [sluiceId='graham-bazaar-sluice'] 
 * @param {number} [capacityM3s=15.0] 
 * @param {boolean} [active=true] 
 * @returns {Object} Pump deployment configuration
 */
export function deployStormwaterPumps(sluiceId = 'graham-bazaar-sluice', capacityM3s = 15.0, active = true) {
    const isGrahamBazaar = sluiceId === 'graham-bazaar-sluice';
    return {
        sluiceId,
        capacityM3s: Number(capacityM3s) || 15.0,
        active: active !== false,
        name: isGrahamBazaar 
            ? 'Graham Bazaar Stormwater Sluice Outfall Pump Station' 
            : `Stormwater Pump Station (${sluiceId})`,
        location: isGrahamBazaar ? [94.912, 27.489] : [94.925, 27.498],
        targetBasin: 'Brahmaputra River',
        dischargeRateM3s: Number(capacityM3s) || 15.0,
        deployedAt: Date.now()
    };
}

/**
 * Computes synchronized comparison metrics between baseline unmitigated flood run
 * and intervention protected flood run.
 * 
 * @param {Float32Array|Array<number>} baselineDepths - Water depths in unmitigated run
 * @param {Float32Array|Array<number>} protectedDepths - Water depths in protected run
 * @param {Array<number|Object>} bldgElevations - Building elevations or building records
 * @param {Object} [options] - Optional thresholds and parameters
 * @returns {Object} Comparison metrics summary
 */
export function computeInterventionComparison(baselineDepths, protectedDepths, bldgElevations = [], options = {}) {
    const hazardThreshold = options.hazardThresholdM ?? 0.15; // 15 cm inundation damage threshold
    const adverseThreshold = options.adverseThresholdM ?? 0.05; // 5 cm increase flags adverse displacement

    const count = Math.min(baselineDepths.length, protectedDepths.length);
    let structuresSaved = 0;
    let baselineFlooded = 0;
    let protectedFlooded = 0;
    let maxDepthReduction = 0.0;
    let totalDepthReduction = 0.0;
    let adverseCount = 0;
    let maxAdverseDisplacement = 0.0;

    for (let i = 0; i < count; i++) {
        const dBase = baselineDepths[i];
        const dProt = protectedDepths[i];

        const isBaseFlooded = dBase >= hazardThreshold;
        const isProtFlooded = dProt >= hazardThreshold;

        if (isBaseFlooded) baselineFlooded++;
        if (isProtFlooded) protectedFlooded++;

        // Saved: was flooded in baseline, but dropped below hazard threshold in protected run
        if (isBaseFlooded && !isProtFlooded) {
            structuresSaved++;
        }

        const reduction = dBase - dProt;
        if (reduction > 0) {
            totalDepthReduction += reduction;
            if (reduction > maxDepthReduction) {
                maxDepthReduction = reduction;
            }
        } else if (-reduction > adverseThreshold) {
            // Water level increased in protected run (water displaced / backwater surcharge)
            adverseCount++;
            const displacement = -reduction;
            if (displacement > maxAdverseDisplacement) {
                maxAdverseDisplacement = displacement;
            }
        }
    }

    const adverseRedirectionDetected = adverseCount > 0;
    const avgDepthReduction = baselineFlooded > 0 ? totalDepthReduction / baselineFlooded : 0.0;
    const protectionRatePct = baselineFlooded > 0 
        ? Math.round((structuresSaved / baselineFlooded) * 1000) / 10 
        : 100.0;

    const roadCutoffsBaseline = options.roadCutoffsBaseline ?? Math.round(baselineFlooded * 0.05);
    const roadCutoffsProtected = options.roadCutoffsProtected ?? Math.round(protectedFlooded * 0.05);
    const roadCutoffsAvoided = Math.max(0, roadCutoffsBaseline - roadCutoffsProtected);

    return {
        structuresSaved,
        totalBaselineFlooded: baselineFlooded,
        totalProtectedFlooded: protectedFlooded,
        maxDepthReduction: Math.round(maxDepthReduction * 1000) / 1000,
        averageDepthReduction: Math.round(avgDepthReduction * 1000) / 1000,
        adverseRedirectionDetected,
        adverseCount,
        maxAdverseDisplacement: Math.round(maxAdverseDisplacement * 1000) / 1000,
        protectionRatePct,
        roadCutoffsAvoided,
        roadCutoffsBaseline,
        roadCutoffsProtected
    };
}

/**
 * Synchronizes playback between primary protected simulator and unmitigated baseline simulator.
 * 
 * @param {Object} simulator 
 * @param {Object} baselineSimulator 
 * @param {number} [stepSeconds=60] 
 * @returns {Object} Synchronization status
 */
export function runSynchronizedReplay(simulator, baselineSimulator, stepSeconds = 60) {
    if (simulator && typeof simulator.step === 'function') {
        simulator.step(stepSeconds);
    }
    if (baselineSimulator && typeof baselineSimulator.step === 'function') {
        baselineSimulator.step(stepSeconds);
    }

    const currentTime = simulator?.totalSimTime ?? baselineSimulator?.totalSimTime ?? 0;

    return {
        synchronized: true,
        stepSeconds,
        currentTime,
        simTime: simulator?.totalSimTime ?? 0,
        baselineTime: baselineSimulator?.totalSimTime ?? 0
    };
}
