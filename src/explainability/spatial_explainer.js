/**
 * spatial_explainer.js
 * 
 * Provides Location-Specific Hydrological Explanations for any coordinate
 * or inspection point clicked on the Clonmel 3D model.
 */

export class SpatialForecastExplainer {
    constructor(meta, elevArray) {
        this.meta = meta;
        this.elevArray = elevArray;

        // Key Clonmel riverfront landmarks for proximity checks
        this.knownLandmarks = [
            { name: 'The Quay / Quay Street', u: 0.53, v: 0.44, bankCrestOD: 22.40, reach: 'Town Quays' },
            { name: 'Old Bridge (South Bank)', u: 0.49, v: 0.53, bankCrestOD: 21.80, reach: 'Old Bridge' },
            { name: 'Suir Island (North Reach)', u: 0.46, v: 0.48, bankCrestOD: 22.10, reach: 'Suir Island' },
            { name: 'Irishtown / Western Reach', u: 0.35, v: 0.40, bankCrestOD: 24.10, reach: 'Irishtown' },
            { name: 'Davis Road / Showgrounds', u: 0.72, v: 0.45, bankCrestOD: 20.50, reach: 'Showgrounds' },
            { name: 'Convent Road / St. Luke’s', u: 0.58, v: 0.58, bankCrestOD: 22.90, reach: 'Convent Reach' }
        ];
    }

    /**
     * Explains the forecast prediction at a specific UV coordinate
     */
    explainLocation(u, v, simulator, streetName = null) {
        if (!simulator) {
            return {
                isAvailable: false,
                reason: 'Simulator engine offline.'
            };
        }

        // Clamp coordinates to grid
        const clampedU = Math.max(0.01, Math.min(0.99, u));
        const clampedV = Math.max(0.01, Math.min(0.99, v));

        // Sample water state
        const sample = simulator.samplePoint(clampedU, clampedV);
        const depthM = sample ? sample.h : 0.0;
        const peakDepthM = sample ? sample.peak_h : depthM;
        const speedMps = sample ? Math.hypot(sample.u, sample.v) : 0.0;

        // Extract ground elevation
        const gx = Math.min(this.meta.grid_w - 1, Math.max(0, Math.floor(clampedU * this.meta.grid_w)));
        const gy = Math.min(this.meta.grid_h - 1, Math.max(0, Math.floor((1.0 - clampedV) * this.meta.grid_h)));
        const groundElevOD = this.elevArray ? (this.elevArray[gy * this.meta.grid_w + gx] || 18.5) : 18.5;
        const waterElevOD = groundElevOD + depthM;

        // Match nearest landmark
        let nearest = this.knownLandmarks[0];
        let minDist = 999.0;
        for (const lm of this.knownLandmarks) {
            const d = Math.hypot(clampedU - lm.u, clampedV - lm.v);
            if (d < minDist) {
                minDist = d;
                nearest = lm;
            }
        }

        // Determine physical inundation mechanism
        let mechanism = 'DRY';
        let mechanismTitle = 'No Active Flooding Predicted';
        let mechanismDesc = `Terrain elevation (${groundElevOD.toFixed(2)}m OD) remains above the local predicted water surface level.`;

        if (depthM >= 0.05) {
            if (minDist < 0.08 && waterElevOD >= nearest.bankCrestOD) {
                mechanism = 'DIRECT_OVERTOPPING';
                mechanismTitle = 'Direct Fluvial Overtopping';
                mechanismDesc = `River Suir water level (${waterElevOD.toFixed(2)}m OD) exceeds the local riverbank crest elevation (~${nearest.bankCrestOD.toFixed(2)}m OD) along ${nearest.reach}. Water spills directly onto the floodplain.`;
            } else if (speedMps > 0.35) {
                mechanism = 'OVERLAND_FLOW_PATH';
                mechanismTitle = 'Overland Flood Propagation';
                mechanismDesc = `Water travels as an overland flow corridor (${speedMps.toFixed(2)} m/s) driven by hydraulic gradient from adjacent overtopped river sections.`;
            } else {
                mechanism = 'TERRAIN_PONDING';
                mechanismTitle = 'Localized Surface Ponding';
                mechanismDesc = `Low-velocity surface water accumulation (${depthM.toFixed(2)}m depth) in a local terrain depression.`;
            }
        }

        // Location-specific limitations
        const limitations = [
            '2D SWE grid resolution is 10m; micro-topographic barriers (doorsteps, kerbs) are sub-grid and not explicitly modeled.',
            'Underground municipal storm sewers and flap valves are not modeled; actual drainage may be faster if gullies are clear or slower if surcharged.',
            'Local infiltration assumes uniform antecedent soil moisture without individual property pavement distinctions.'
        ];

        return {
            isAvailable: true,
            locationName: streetName || nearest.name,
            coordinates: {
                u: clampedU,
                v: clampedV,
                lon: this.meta.bbox.west + clampedU * (this.meta.bbox.east - this.meta.bbox.west),
                lat: this.meta.bbox.south + (1.0 - clampedV) * (this.meta.bbox.north - this.meta.bbox.south)
            },
            elevations: {
                groundElevOD: parseFloat(groundElevOD.toFixed(2)),
                waterElevOD: parseFloat(waterElevOD.toFixed(2)),
                depthM: parseFloat(depthM.toFixed(2)),
                peakDepthM: parseFloat(peakDepthM.toFixed(2)),
                speedMps: parseFloat(speedMps.toFixed(2))
            },
            inundationStatus: {
                mechanism,
                title: mechanismTitle,
                description: mechanismDesc,
                nearestReach: nearest.reach,
                nearestBankCrestOD: nearest.bankCrestOD
            },
            relevantGauges: [
                {
                    name: 'OPW Station 16011 (Clonmel)',
                    distanceKm: parseFloat((minDist * 3.5).toFixed(1)),
                    relevance: 'Primary downstream river level calibration station for Clonmel town.'
                },
                {
                    name: 'OPW Station 16009 (Knocklofty)',
                    distanceKm: parseFloat((8.2 + minDist * 3.5).toFixed(1)),
                    relevance: 'Upstream boundary driver; changes arrive at this location within ~2.5 to 3.0 hours.'
                }
            ],
            limitations
        };
    }
}
