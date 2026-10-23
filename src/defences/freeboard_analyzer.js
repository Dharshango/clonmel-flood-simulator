/**
 * freeboard_analyzer.js
 * 
 * Physically Valid Crest Elevation vs Local Water Surface Freeboard Analysis.
 * Strict precondition enforcement and uncertainty quantification.
 */

export class FreeboardAnalyzer {
    constructor(meta, elevArray) {
        this.meta = meta;
        this.elevArray = elevArray;
        this.supportedDatum = 'Malin Head OD';
    }

    /**
     * Evaluates freeboard for a specific defence asset against simulated or observed water level.
     * 
     * @param {Object} asset - Defence asset record from flood_defences.json
     * @param {Object} simulator - Active SWESimulator instance (or null if offline)
     * @param {Object} [gaugeTelemetry] - Optional live OPW gauge reading
     * @returns {Object} Freeboard evaluation result
     */
    evaluateAssetFreeboard(asset, simulator, gaugeTelemetry = null) {
        // 1. Precondition Check A: Asset crest elevation must be available and numeric
        const physical = asset.physical || {};
        const crestElev = physical.crestElevationMOD;
        if (typeof crestElev !== 'number' || isNaN(crestElev)) {
            return {
                isCalculable: false,
                reason: 'Comparison unavailable — insufficient crest elevation data',
                freeboardM: null,
                waterLevelMOD: null,
                crestElevationMOD: null,
                datum: null,
                statusTag: 'NO_CREST_DATA'
            };
        }

        // 2. Precondition Check B: Vertical Datum compatibility
        const datum = physical.crestElevationDatum;
        if (!datum || datum !== this.supportedDatum) {
            return {
                isCalculable: false,
                reason: `Comparison unavailable — datum mismatch (${datum || 'Unknown'} vs ${this.supportedDatum})`,
                freeboardM: null,
                waterLevelMOD: null,
                crestElevationMOD: crestElev,
                datum: datum || 'Unknown',
                statusTag: 'DATUM_MISMATCH'
            };
        }

        // 3. Precondition Check C: Obtain local water surface elevation at asset location
        // Find center coordinate of asset
        let centerLon, centerLat;
        if (asset.coordinates.length === 1) {
            [centerLon, centerLat] = asset.coordinates[0];
        } else {
            const midIdx = Math.floor(asset.coordinates.length / 2);
            [centerLon, centerLat] = asset.coordinates[midIdx];
        }

        const u = (centerLon - this.meta.bbox.west) / (this.meta.bbox.east - this.meta.bbox.west);
        const v = (centerLat - this.meta.bbox.south) / (this.meta.bbox.north - this.meta.bbox.south);

        let localWaterSurfaceMOD = null;
        let groundElevMOD = physical.groundElevationMOD || 20.0;
        let localWaterDepthM = 0.0;
        let waterDataSource = 'SWE_HYDRODYNAMIC_GRID';

        if (simulator && typeof simulator.sampleWaterDepthAt === 'function') {
            localWaterDepthM = simulator.sampleWaterDepthAt(u, v);
            
            // Ground elevation from hydro DEM
            const gx = Math.min(this.meta.grid_w - 1, Math.max(0, Math.floor(u * this.meta.grid_w)));
            const gy = Math.min(this.meta.grid_h - 1, Math.max(0, Math.floor((1.0 - v) * this.meta.grid_h)));
            const demGround = this.elevArray ? this.elevArray[gy * this.meta.grid_w + gx] : groundElevMOD;
            if (demGround) groundElevMOD = demGround;

            // Water surface = ground elevation + depth
            localWaterSurfaceMOD = groundElevMOD + localWaterDepthM;
        } else if (gaugeTelemetry && typeof gaugeTelemetry.stage === 'number') {
            // River Suir at Clonmel gauge station (16011) zero datum is 16.035m OD
            // Water surface = zero datum + gauge stage
            const GAUGE_ZERO_OD = 16.035;
            localWaterSurfaceMOD = GAUGE_ZERO_OD + gaugeTelemetry.stage;
            waterDataSource = 'OPW_GAUGE_16011_EXTRAPOLATED';
        } else {
            return {
                isCalculable: false,
                reason: 'Comparison unavailable — no fresh simulated or observed water surface available',
                freeboardM: null,
                waterLevelMOD: null,
                crestElevationMOD: crestElev,
                datum: this.supportedDatum,
                statusTag: 'NO_WATER_LEVEL'
            };
        }

        // 4. Calculate Freeboard
        const freeboardM = parseFloat((crestElev - localWaterSurfaceMOD).toFixed(3));

        // 5. Calculate Uncertainty Bounds
        const surveyUncertainty = physical.surveyUncertaintyM || 0.05;
        const modelUncertainty = waterDataSource === 'SWE_HYDRODYNAMIC_GRID' ? 0.08 : 0.15;
        const combinedUncertaintyM = parseFloat(Math.hypot(surveyUncertainty, modelUncertainty).toFixed(3));

        // 6. Qualitative Status Classification (Non-judgmental, purely geometric)
        let statusTag = 'POSITIVE_FREEBOARD';
        let statusLabel = 'Freeboard Preserved';
        let statusClass = 'status-pill-green';

        if (freeboardM < 0.0) {
            statusTag = 'NEGATIVE_FREEBOARD';
            statusLabel = 'Water Exceeds Crest (Overtopped)';
            statusClass = 'status-pill-red';
        } else if (freeboardM <= combinedUncertaintyM) {
            statusTag = 'UNCERTAIN_OVERTOPPING_RISK';
            statusLabel = 'Critical / Freeboard Buffer Overlap';
            statusClass = 'status-pill-amber';
        } else if (freeboardM < (physical.designFreeboardM || 0.50)) {
            statusTag = 'ENCROACHED_BUFFER';
            statusLabel = 'Buffer Encroached';
            statusClass = 'status-pill-amber';
        }

        return {
            isCalculable: true,
            freeboardM,
            waterLevelMOD: parseFloat(localWaterSurfaceMOD.toFixed(2)),
            crestElevationMOD: parseFloat(crestElev.toFixed(2)),
            groundElevationMOD: parseFloat(groundElevMOD.toFixed(2)),
            localWaterDepthM: parseFloat(localWaterDepthM.toFixed(2)),
            combinedUncertaintyM,
            datum: this.supportedDatum,
            waterDataSource,
            statusTag,
            statusLabel,
            statusClass,
            designFreeboardM: physical.designFreeboardM || 0.50
        };
    }
}
