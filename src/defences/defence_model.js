/**
 * defence_model.js
 * 
 * Typed Data Model and Spatial Helpers for Clonmel Flood Defence Assets.
 * Follows OPW & Mott MacDonald engineering classifications.
 */

export const DEFENCE_TYPES = {
    PERMANENT_WALL: {
        id: 'permanent_wall',
        label: 'Permanent Flood Wall',
        icon: '🧱',
        colorHex: 0x38bdf8, // Steel Cyan
        colorCss: '#38bdf8'
    },
    DEMOUNTABLE_BARRIER: {
        id: 'demountable_barrier',
        label: 'Demountable Barrier',
        icon: '🛡️',
        colorHex: 0xf59e0b, // Warning Amber
        colorCss: '#f59e0b'
    },
    EMBANKMENT: {
        id: 'embankment',
        label: 'Earthen Embankment',
        icon: '🌱',
        colorHex: 0x10b981, // Earth Emerald
        colorCss: '#10b981'
    },
    PUMPING_STATION: {
        id: 'pumping_station',
        label: 'Stormwater Pumping Station',
        icon: '⚙️',
        colorHex: 0x06b6d4, // Cyan Mechanism
        colorCss: '#06b6d4'
    },
    OUTFALL_PENSTOCK: {
        id: 'outfall_penstock',
        label: 'Culvert Outfall / Flap Valve',
        icon: '🚰',
        colorHex: 0xa855f7, // Violet Valve
        colorCss: '#a855f7'
    }
};

export const DEFENCE_STATUSES = {
    MONITORING_AVAILABLE: {
        id: 'MONITORING_AVAILABLE',
        label: 'Monitoring Active',
        cssClass: 'status-pill-green',
        dotClass: 'green'
    },
    DATA_VERIFIED: {
        id: 'DATA_VERIFIED',
        label: 'Data Verified',
        cssClass: 'status-pill-blue',
        dotClass: 'blue'
    },
    REVIEW_RECOMMENDED: {
        id: 'REVIEW_RECOMMENDED',
        label: 'Review Recommended',
        cssClass: 'status-pill-amber',
        dotClass: 'amber'
    },
    OPERATIONAL_CONFIRMATION_REQUIRED: {
        id: 'OPERATIONAL_CONFIRMATION_REQUIRED',
        label: 'Operational Check Required',
        cssClass: 'status-pill-orange',
        dotClass: 'orange'
    },
    INSUFFICIENT_DATA: {
        id: 'INSUFFICIENT_DATA',
        label: 'Insufficient Data',
        cssClass: 'status-pill-gray',
        dotClass: 'gray'
    },
    HISTORICAL_ONLY: {
        id: 'HISTORICAL_ONLY',
        label: 'Historical Only',
        cssClass: 'status-pill-purple',
        dotClass: 'purple'
    }
};

/**
 * Validates asset schema integrity
 */
export function validateDefenceAsset(asset) {
    const errors = [];
    if (!asset.id) errors.push('Missing asset ID');
    if (!asset.name) errors.push('Missing asset name');
    if (!asset.type || !DEFENCE_TYPES[asset.type.toUpperCase()]) errors.push(`Unknown asset type: ${asset.type}`);
    if (!asset.coordinates || !Array.isArray(asset.coordinates) || asset.coordinates.length === 0) {
        errors.push('Missing or invalid geometry coordinates');
    }
    if (!asset.provenance || !asset.provenance.sourceOrganisation) {
        errors.push('Missing source provenance metadata');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
