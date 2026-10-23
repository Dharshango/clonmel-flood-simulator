/**
 * towns.js - Multi-Town Configuration Registry
 * Decouples geospatial metadata, DEM paths, gauge datums, and camera defaults.
 */

export const TOWNS = {
    clonmel: {
        id: 'clonmel',
        name: 'Clonmel',
        region: 'County Tipperary, Ireland',
        dataPath: '/data/',
        riverName: 'River Suir',
        gauge: {
            name: 'OPW Station 16011',
            datum: 'm OD',
            bankfull: 2.80,
            danger: 3.60,
            unit: 'm OD'
        },
        defaultCamera: {
            position: { x: 0, y: 350, z: 450 },
            target: { x: 0, y: 0, z: 0 }
        },
        bounds: {
            south: 52.345,
            north: 52.364,
            west: -7.730,
            east: -7.680
        },
        studyAreaMeters: { width: 3402, height: 2114 },
        elevationRange: [15.6, 122.0]
    },
    dibrugarh: {
        id: 'dibrugarh',
        name: 'Dibrugarh',
        region: 'Assam, India',
        dataPath: '/data/dibrugarh/',
        riverName: 'Brahmaputra River',
        gauge: {
            name: 'WRD Brahmaputra Gauge',
            datum: 'm MSL',
            dangerLevel: 105.70,
            hfl1998: 106.48,
            normalMonsoon: 104.50,
            unit: 'm MSL'
        },
        defaultCamera: {
            position: { x: 0, y: 400, z: 480 },
            target: { x: 0, y: 0, z: 0 }
        },
        bounds: {
            south: 27.472,
            north: 27.495,
            west: 94.898,
            east: 94.935
        },
        studyAreaMeters: { width: 3500, height: 2200 },
        elevationRange: [102.5, 111.0]
    }
};

export const DEFAULT_TOWN_ID = 'clonmel';

export function getTownConfig(townId) {
    return TOWNS[townId] || TOWNS[DEFAULT_TOWN_ID];
}
