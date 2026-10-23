/**
 * dibrugarh_workspaces.js
 * 
 * Decision-Support Workspaces Parity for Dibrugarh (All 10 Workspaces):
 * 1. Live Flood Map
 * 2. Flood Time Machine
 * 3. Intervention Lab
 * 4. Critical Infrastructure Dependency Map
 * 5. Community Flood Evidence Network
 * 6. Emergency Command Exercise
 * 7. Science & Numerical SWE Validation
 * 8. Real-Time Flood Forecasting (WRD Assam Brahmaputra Gauging)
 * 9. Flood Defence Performance Monitor (DTP Dyke Freeboard & Sluices)
 * 10. Explainable Flood Forecast (Compound River Backwater + Pluvial Cloudburst)
 */

import { CLONMEL_INFRASTRUCTURE } from '../analysis/infrastructure_dependency.js';
import { INITIAL_COMMUNITY_EVIDENCE } from '../evidence/community_evidence.js';
import { EXERCISE_SCENARIO } from '../exercise/command_exercise.js';

// ============================================================================
// 1. Critical Infrastructure Assets for Dibrugarh
// ============================================================================

export const DIBRUGARH_INFRASTRUCTURE = [
    {
        id: 'dib-railway-station',
        name: 'Dibrugarh Town Railway Station (DBRT)',
        shortName: 'Railway Station',
        category: 'crossing',
        icon: '🚆',
        lon: 94.9180,
        lat: 27.4815,
        elevationOD: 105.8,
        elevationMSL: 105.8,
        ingressRoad: 'Station Road / AT Road',
        alternativeRoad: 'Mancotta Road',
        primaryCorridorEdges: ['Station Road', 'AT Road'],
        alternativeCorridorEdges: ['Mancotta Road'],
        serviceCoverage: 'Northeast Frontier Railway regional terminus, passenger rail transit & cargo freight yard',
        dependentFacilities: ['dib-amch-hospital', 'dib-thana-chariali'],
        provenance: {
            source: 'Northeast Frontier Railway & OpenStreetMap',
            license: 'Open Data',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    },
    {
        id: 'dib-at-road',
        name: 'AT Road (Assam Trunk Road) Commercial Corridor',
        shortName: 'AT Road Corridor',
        category: 'crossing',
        icon: '🛣️',
        lon: 94.9120,
        lat: 27.4830,
        elevationOD: 105.4,
        elevationMSL: 105.4,
        ingressRoad: 'Assam Trunk Road (NH-37)',
        alternativeRoad: 'Graham Bazaar Bypass / Circulating Road',
        primaryCorridorEdges: ['AT Road', 'Thana Chariali', 'Marwari Patty'],
        alternativeCorridorEdges: ['Graham Bazaar Road'],
        serviceCoverage: 'Primary arterial logistics corridor connecting Upper Assam to Dibrugarh town centre',
        dependentFacilities: ['dib-thana-chariali', 'dib-mancotta-substation'],
        provenance: {
            source: 'PWD Roads Assam / National Highway Authority',
            license: 'Public Infrastructure Directory',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    },
    {
        id: 'dib-graham-bazaar',
        name: 'Graham Bazaar Commercial Market Complex',
        shortName: 'Graham Bazaar',
        category: 'utilities',
        icon: '🏪',
        lon: 94.9085,
        lat: 27.4862,
        elevationOD: 104.9,
        elevationMSL: 104.9,
        ingressRoad: 'Graham Bazaar Main Road',
        alternativeRoad: 'DTP Dyke Crest Road',
        primaryCorridorEdges: ['Graham Bazaar Main Road', 'Dyke Patrol Road'],
        alternativeCorridorEdges: ['AT Road Connector'],
        serviceCoverage: 'Historic trade center and essential goods supply market for 45,000 residents',
        dependentFacilities: ['dib-mancotta-substation'],
        provenance: {
            source: 'Dibrugarh Municipal Corporation (DMC)',
            license: 'Municipal Asset Directory',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    },
    {
        id: 'dib-thana-chariali',
        name: 'Thana Chariali Emergency Operations Hub & Police Station',
        shortName: 'Thana Chariali Hub',
        category: 'emergency',
        icon: '🚓',
        lon: 94.9150,
        lat: 27.4828,
        elevationOD: 105.6,
        elevationMSL: 105.6,
        ingressRoad: 'Thana Chariali Circle / AT Road',
        alternativeRoad: 'Paltan Bazaar Road',
        primaryCorridorEdges: ['Thana Chariali Circle', 'AT Road', 'Paltan Bazaar Road'],
        alternativeCorridorEdges: ['Station Road'],
        serviceCoverage: 'Civil defense headquarters, traffic dispatch, emergency cordoning and police response',
        dependentFacilities: ['dib-amch-hospital', 'dib-at-road'],
        provenance: {
            source: 'Assam Police & District Disaster Management Authority (DDMA)',
            license: 'Emergency Services Directory',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    },
    {
        id: 'dib-mancotta-substation',
        name: 'Mancotta Road 33/11kV Electrical Substation',
        shortName: 'Mancotta Substation',
        category: 'utilities',
        icon: '⚡',
        lon: 94.9210,
        lat: 27.4780,
        elevationOD: 106.1,
        elevationMSL: 106.1,
        ingressRoad: 'Mancotta Road',
        alternativeRoad: 'Chowkidinghee Link Road',
        primaryCorridorEdges: ['Mancotta Road', 'Chowkidinghee Road'],
        alternativeCorridorEdges: ['Convoy Road'],
        serviceCoverage: 'Powers central town grid, municipal drainage pump stations, and communication relays',
        dependentFacilities: ['dib-graham-bazaar', 'dib-railway-station'],
        provenance: {
            source: 'Assam Power Distribution Company Limited (APDCL)',
            license: 'Utility Infrastructure Registry',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    },
    {
        id: 'dib-amch-hospital',
        name: 'Assam Medical College Hospital (AMCH) Emergency Access',
        shortName: 'AMCH Emergency Access',
        category: 'healthcare',
        icon: '🏥',
        lon: 94.9280,
        lat: 27.4765,
        elevationOD: 106.5,
        elevationMSL: 106.5,
        ingressRoad: 'AMCH Main Hospital Road / Barbarua Link',
        alternativeRoad: 'South Bypass / Mancotta Approach',
        primaryCorridorEdges: ['Hospital Road', 'Graham Bazaar Corridor'],
        alternativeCorridorEdges: ['South Bypass', 'Mancotta Road'],
        serviceCoverage: 'Premier tertiary hospital and trauma centre for Upper Assam, Arunachal Pradesh and eastern districts',
        dependentFacilities: ['dib-thana-chariali', 'dib-mancotta-substation'],
        provenance: {
            source: 'Directorate of Health Services Assam & AMCH Administration',
            license: 'Public Health Directory',
            verifiedDate: '2026-10-23',
            crs: 'EPSG:4326'
        }
    }
];

// ============================================================================
// 2. Community Flood Evidence Markers (PIB & ASDMA Historical Ground Truth)
// ============================================================================

export const DIBRUGARH_COMMUNITY_EVIDENCE = [
    {
        id: 'rep-dib-2024-01',
        title: 'July 2024 Cloudburst Inundation at Graham Bazaar Market',
        category: 'road_flooding',
        categoryLabel: 'Flash Flood Ponding',
        icon: '🌊',
        lon: 94.9090,
        lat: 27.4860,
        date: '2024-07-02',
        observedTime: '2024-07-02T09:30:00Z',
        submittedTime: '2024-07-02T10:15:00Z',
        reportedDepthM: 0.75,
        depthM: 0.75,
        locationName: 'Graham Bazaar / DTP Dyke Inward Slope',
        description: 'Severe pluvial waterlogging following 110mm/h cloudburst. Sluice gate into Brahmaputra closed due to river level reaching 105.4m MSL, trapping internal runoff.',
        photoUrl: '/thumbnails/dibrugarh_july2024_pib.png',
        status: 'verified',
        verificationStatus: 'verified',
        statusLabel: 'VERIFIED',
        source: 'Press Information Bureau (PIB) / ASDMA Flood Bulletin',
        reviewer: 'ASDMA Field Assessment Cell',
        reviewTime: '2024-07-02T12:00:00Z',
        reviewNotes: 'Cross-referenced against WRD Brahmaputra gauge telemetry and PIB photo evidence.',
        provenance: 'PIB / ASDMA Official Situation Report',
        observer: 'PIB Assam Correspondent'
    },
    {
        id: 'rep-dib-1998-01',
        title: 'Historic Record High Flood Level (HFL) Gauge Mark - Sept 1998',
        category: 'river_overtop',
        categoryLabel: 'River Overtopping Mark',
        icon: '📏',
        lon: 94.9050,
        lat: 27.4865,
        date: '1998-09-03',
        observedTime: '1998-09-03T16:00:00Z',
        submittedTime: '1998-09-03T18:00:00Z',
        reportedDepthM: 1.45,
        depthM: 1.45,
        locationName: 'DTP Dyke Central Gauging Pillar (Nagakhelia)',
        description: 'All-time historic High Flood Level of 106.48m MSL reached on Brahmaputra River, overtopping unprotected revetment spurs and reaching crest of earthen dyke.',
        photoUrl: '/thumbnails/asdma_1998_hfl.png',
        status: 'verified',
        verificationStatus: 'verified',
        statusLabel: 'VERIFIED',
        source: 'ASDMA / WRD Assam Historic Hydrology Archive',
        reviewer: 'Central Water Commission (CWC) Senior Hydrologist',
        reviewTime: '1998-09-04T08:00:00Z',
        reviewNotes: 'Surveyed benchmark bolt on DTP pillar confirmed at 106.48m MSL.',
        provenance: 'ASDMA / CWC Benchmark Archive',
        observer: 'WRD Senior Hydrographer'
    },
    {
        id: 'rep-dib-citizen-01',
        title: 'Thana Chariali Intersection Storm Drain Backup',
        category: 'standing_water',
        categoryLabel: 'Urban Waterlogging',
        icon: '🚗',
        lon: 94.9145,
        lat: 27.4825,
        date: '2024-07-03',
        observedTime: '2024-07-03T11:45:00Z',
        submittedTime: '2024-07-03T12:10:00Z',
        reportedDepthM: 0.38,
        depthM: 0.38,
        locationName: 'Thana Chariali / AT Road Roundabout',
        description: 'Silt accumulation in municipal culvert causing knee-deep water on western approach to Thana Chariali. Motorbikes and small autos stalled.',
        photoUrl: '',
        status: 'verified',
        verificationStatus: 'verified',
        statusLabel: 'VERIFIED',
        source: 'ASDMA Citizen Flood Watch Network',
        reviewer: 'Dibrugarh Municipal Corporation Task Force',
        reviewTime: '2024-07-03T14:30:00Z',
        reviewNotes: 'Municipal pump unit dispatched to clear choked siphon inlet.',
        provenance: 'ASDMA Community Observer Network',
        observer: 'Local Merchant Association'
    },
    {
        id: 'rep-dib-citizen-02',
        title: 'Mancotta Road Substation Approach Waterlogging',
        category: 'road_flooding',
        categoryLabel: 'Internal Ponding',
        icon: '⚠️',
        lon: 94.9205,
        lat: 27.4785,
        date: '2024-07-04',
        observedTime: '2024-07-04T15:20:00Z',
        submittedTime: '2024-07-04T15:45:00Z',
        reportedDepthM: 0.22,
        depthM: 0.22,
        locationName: 'Mancotta Road Link',
        description: 'Standing water covering sidewalk and southern carriageway. High clearance vehicles passable.',
        photoUrl: '',
        status: 'pending_review',
        verificationStatus: 'pending_review',
        statusLabel: 'PENDING',
        source: 'Citizen Report via DDMA Dibrugarh Portal',
        reviewer: 'Unassigned',
        reviewTime: null,
        reviewNotes: 'Awaiting field crew inspection.',
        provenance: 'Citizen Submission',
        observer: 'Ward 7 Resident'
    }
];

// ============================================================================
// 3. Emergency Command Exercises for Dibrugarh
// ============================================================================

export const DIBRUGARH_COMMAND_EXERCISES = [
    {
        id: 'dibrugarh-command-exercise',
        title: 'Dyke Breach Response Drill (Brahmaputra Peak Stage)',
        eventTitle: 'Brahmaputra River Influx (106.0m MSL + Storm Sluice Lock)',
        geographicArea: 'Dibrugarh Town Protection Dyke (DTP), Graham Bazaar, AT Road & AMCH Corridor',
        totalPhases: 4,
        initialResources: {
            barrierCrews: 4,     // Revetment geo-bag & dyke reinforcing teams
            pumps15ms: 3,        // High-capacity municipal axial dewatering pumps (15 m³/s)
            sandbagUnits: 6,     // Heavy boulder pitching & 150m geo-bag units
            trafficTeams: 4,     // Assam Police & SDRF road cordon units
            rescueCraft: 3       // NDRF motorized inflatable rescue boats
        },
        phases: [
            {
                phaseIndex: 0,
                simTimeSec: 0,
                clockTime: '00:00',
                riverInflow: 25000,
                phaseName: 'PHASE 1: Early Warning & Brahmaputra Rise',
                severity: 'ELEVATED RISK',
                severityColor: '#38bdf8',
                brief: 'CWC and WRD Assam issue high flood alert. Brahmaputra stage at Dibrugarh station rising rapidly from 104.2m MSL towards Danger Level (105.70m MSL). Town drainage sluices nearing backwater threshold.',
                actions: [
                    {
                        id: 'dib-act-1-gauge',
                        name: 'Audit WRD Gauge Telemetry & Sluice Pressure',
                        type: 'info',
                        description: 'Audit live river stage telemetry and inspect outfall flap gates along the DTP dyke.',
                        cost: {},
                        scoreImpact: { infoReview: 10, resourceMgmt: 0, preservation: 0, timeliness: 5 },
                        consequence: 'Brahmaputra stage confirmed at 105.20m MSL (+30cm/hr rising rate). Flap gates experiencing significant river pressure.'
                    },
                    {
                        id: 'dib-act-1-mobile-pumps',
                        name: 'Pre-position 15 m³/s Dewatering Pumps at Sluice Gates',
                        type: 'deployment',
                        description: 'Deploy trailer-mounted high-capacity pumps to Graham Bazaar town drain outfall.',
                        cost: { pumps15ms: 1 },
                        scoreImpact: { infoReview: 0, resourceMgmt: 5, preservation: 10, timeliness: 10 },
                        consequence: 'Mobile pump stations positioned and fueled at Graham Bazaar outfall, ready for emergency pumping.'
                    },
                    {
                        id: 'dib-act-1-dyke-patrol',
                        name: 'Deploy 24/7 DTP Dyke Inspection & Geo-Bag Crews',
                        type: 'deployment',
                        description: 'Mobilize WRD maintenance squads along the 9.5 km DTP dyke perimeter.',
                        cost: { barrierCrews: 1 },
                        scoreImpact: { infoReview: 5, resourceMgmt: 5, preservation: 5, timeliness: 5 },
                        consequence: 'Inspection crews dispatched with geo-textile bags and floodlights to monitor seepage along revetments.'
                    }
                ]
            },
            {
                phaseIndex: 1,
                simTimeSec: 5400,
                clockTime: '01:30',
                riverInflow: 38000,
                phaseName: 'PHASE 2: Danger Level Exceeded & Sluice Lockout',
                severity: 'HIGH THREAT',
                severityColor: '#f59e0b',
                brief: 'Brahmaputra has breached Danger Level at 105.80m MSL! Sluice gates are locked shut to prevent river backwater from inundating town. Concurrent 85 mm/h monsoon cloudburst triggers rapid pluvial ponding in Graham Bazaar and AT Road.',
                actions: [
                    {
                        id: 'dib-act-2-pump-discharge',
                        name: 'Engage 15 m³/s Forced Drainage Pumps',
                        type: 'physical_pump',
                        description: 'Start axial flow pumps to force internal storm runoff over the DTP dyke into the Brahmaputra.',
                        cost: { pumps15ms: 1 },
                        scoreImpact: { infoReview: 0, resourceMgmt: 5, preservation: 15, timeliness: 10 },
                        consequence: 'Pumps active! 15 m³/s forced evacuation reduces waterlogging in Graham Bazaar commercial sector by 0.45m.',
                        triggersSimulator: 'activate_pumps'
                    },
                    {
                        id: 'dib-act-2-dyke-reinforce',
                        name: 'Reinforce Low Crest Sector (+0.8m Geo-Bag Berm)',
                        type: 'physical_barrier',
                        description: 'Construct emergency +0.8m crest extension along Graham Bazaar dyke sector.',
                        cost: { barrierCrews: 1, sandbagUnits: 2 },
                        scoreImpact: { infoReview: 0, resourceMgmt: 5, preservation: 15, timeliness: 10 },
                        consequence: 'DTP dyke crest raised from 106.8m to 107.6m MSL! Freeboard margin restored to safety threshold against river wave overtopping.',
                        triggersSimulator: 'deploy_preset_walls'
                    },
                    {
                        id: 'dib-act-2-atroad-diversion',
                        name: 'Implement Emergency Traffic Diversion on AT Road',
                        type: 'traffic',
                        description: 'Deploy SDRF units to divert commercial traffic away from flooded low-lying AT Road.',
                        cost: { trafficTeams: 1 },
                        scoreImpact: { infoReview: 0, resourceMgmt: 5, preservation: 5, timeliness: 5 },
                        consequence: 'AT Road traffic successfully rerouted through Mancotta Bypass; avoids vehicle strandings and maintains emergency lane for AMCH.'
                    }
                ]
            },
            {
                phaseIndex: 2,
                simTimeSec: 10800,
                clockTime: '03:00',
                riverInflow: 42000,
                phaseName: 'PHASE 3: Peak River Surge & Critical Freeboard',
                severity: 'CRITICAL EMERGENCY',
                severityColor: '#ef4444',
                brief: 'Brahmaputra river level crests at 106.15m MSL (freeboard under 65 cm). Seepage detected at Nagakhelia dyke toe. Heavy runoff backing up around Thana Chariali.',
                actions: [
                    {
                        id: 'dib-act-3-toe-filter',
                        name: 'Install Inverted Sand Filter & Toe Relief Trench',
                        type: 'mitigation',
                        description: 'Place geotextile filter and sandbags on landward dyke toe to arrest piping without dislodging embankment soil.',
                        cost: { sandbagUnits: 2, barrierCrews: 1 },
                        scoreImpact: { infoReview: 0, resourceMgmt: 10, preservation: 15, timeliness: 10 },
                        consequence: 'Piping risk neutralized at Nagakhelia; clear filtered seepage safely drained into town culvert.'
                    },
                    {
                        id: 'dib-act-3-evacuate-lowlands',
                        name: 'Coordinate NDRF Boat Evacuation of Low-Lying Wards',
                        type: 'evacuation',
                        description: 'Deploy rescue craft to assist vulnerable households in low-lying riverside settlement pockets.',
                        cost: { rescueCraft: 2, trafficTeams: 1 },
                        scoreImpact: { infoReview: 5, resourceMgmt: 5, preservation: 15, timeliness: 10 },
                        consequence: '420 residents safely evacuated to designated relief shelters at higher ground.'
                    }
                ]
            },
            {
                phaseIndex: 3,
                simTimeSec: 16200,
                clockTime: '04:30',
                riverInflow: 32000,
                phaseName: 'PHASE 4: River Recession & Controlled Drainage',
                severity: 'RECOVERY PHASE',
                severityColor: '#10b981',
                brief: 'Brahmaputra stage recedes below 105.0m MSL. Internal ponding subsiding. Municipal priority shifts to post-flood sanitation and structure inspection.',
                actions: [
                    {
                        id: 'dib-act-4-open-sluices',
                        name: 'Inspect and Gradually Open Drainage Sluices',
                        type: 'sluice_operation',
                        description: 'Verify river stage differential and open flap gates to gravity drain residual water.',
                        cost: { barrierCrews: 1 },
                        scoreImpact: { infoReview: 5, resourceMgmt: 5, preservation: 10, timeliness: 5 },
                        consequence: 'Gravity drainage fully restored; town drain outflow operating at peak gravity clearance.'
                    },
                    {
                        id: 'dib-act-4-infrastructure-audit',
                        name: 'Conduct Rapid Infrastructure & Power Grid Assessment',
                        type: 'audit',
                        description: 'Inspect Mancotta Substation, AMCH hospital access, and railway embankment.',
                        cost: { trafficTeams: 1 },
                        scoreImpact: { infoReview: 10, resourceMgmt: 5, preservation: 5, timeliness: 5 },
                        consequence: 'All 6 critical infrastructure hubs confirmed operational without lasting structural failure.'
                    }
                ]
            }
        ]
    },
    {
        id: 'dib-cloudburst-drill',
        title: 'Monsoon Cloudburst Evacuation Drill',
        eventTitle: '110 mm/h Urban Flash Flood & Sluice Lockout',
        geographicArea: 'Dibrugarh Municipal Area, Graham Bazaar & Railway Station',
        totalPhases: 3,
        initialResources: {
            barrierCrews: 3,
            pumps15ms: 4,
            sandbagUnits: 4,
            trafficTeams: 3,
            rescueCraft: 2
        },
        phases: [
            {
                phaseIndex: 0,
                simTimeSec: 0,
                clockTime: '00:00',
                riverInflow: 20000,
                phaseName: 'PHASE 1: Severe Rainfall Warning',
                severity: 'HIGH THREAT',
                severityColor: '#f59e0b',
                brief: 'IMD Red Warning for heavy rainfall across Upper Assam. 110 mm/h cloudburst hits Dibrugarh core.',
                actions: []
            }
        ]
    }
];

// Convenience aliases
DIBRUGARH_COMMAND_EXERCISES.dykeBreach = DIBRUGARH_COMMAND_EXERCISES[0];
DIBRUGARH_COMMAND_EXERCISES.cloudburst = DIBRUGARH_COMMAND_EXERCISES[1];

// ============================================================================
// 4. Defence Performance Status Calculation (DTP Dyke Freeboard)
// ============================================================================

export function getDibrugarhDefenceStatus(stageMSL, defences = null) {
    let minCrest = 106.80; // Default DTP Dyke crest at Sector 2 Graham Bazaar (m MSL)
    if (defences && Array.isArray(defences) && defences.length > 0) {
        const crests = defences
            .map(d => d.crestElevation ?? d.physical?.crestElevationMOD)
            .filter(c => typeof c === 'number' && !isNaN(c));
        if (crests.length > 0) {
            minCrest = Math.min(...crests);
        }
    }
    const minFreeboardMeters = Number((minCrest - stageMSL).toFixed(2));
    let status = 'SAFE';
    if (minFreeboardMeters <= 0) {
        status = 'OVERTOPPED';
    } else if (minFreeboardMeters < 1.0) {
        status = 'CRITICAL_FREEBOARD';
    } else if (minFreeboardMeters < 1.5) {
        status = 'WARNING';
    } else if (minFreeboardMeters < 2.0) {
        status = 'CAUTION';
    }
    return {
        stageMSL,
        minCrestElevation: minCrest,
        minFreeboardMeters,
        status,
        dangerLevelMSL: 105.70,
        warningLevelMSL: 104.80,
        hflMSL: 106.48
    };
}

// ============================================================================
// 5. Forecast Explanation & Flood Driver Decomposition
// ============================================================================

export function getDibrugarhForecastExplanation(params = {}) {
    const stageMSL = typeof params.stageMSL === 'number' ? params.stageMSL : 105.50;
    const rainIntensity = typeof params.rainIntensity === 'number' ? params.rainIntensity : 65;

    // Compound physical driver decomposition
    // When rain is 65mm/h and river is 105.5m MSL:
    // Pluvial share > 40% (trapped runoff)
    // River backwater share > 30% (sluices forced closed)
    const rainWeight = rainIntensity * 0.8;
    const riverWeight = Math.max(0, (stageMSL - 103.0) * 15.0);
    const baseWeight = 10.0;
    const total = rainWeight + riverWeight + baseWeight;

    const pluvialSharePercent = Math.round((rainWeight / total) * 100);
    const riverBackwaterPercent = Math.round((riverWeight / total) * 100);
    const baseflowSharePercent = Math.max(0, 100 - pluvialSharePercent - riverBackwaterPercent);

    let primaryDriver = 'Monsoon Cloudburst with Closed Sluice Gates (River Backwater Stagnation)';
    if (stageMSL >= 106.40) {
        primaryDriver = 'Brahmaputra River Record Fluvial Influx (Overtopping Threat)';
    } else if (rainIntensity >= 50 && stageMSL >= 104.80) {
        primaryDriver = 'Monsoon Cloudburst with Closed Sluice Gates (River Backwater Stagnation)';
    } else if (rainIntensity >= 50) {
        primaryDriver = 'Urban Cloudburst Pluvial Inundation';
    } else {
        primaryDriver = 'Baseline Brahmaputra River Stage & Local Drainage';
    }

    return {
        stageMSL,
        rainIntensity,
        pluvialSharePercent,
        riverBackwaterPercent,
        baseflowSharePercent,
        primaryDriver,
        sluiceStatus: stageMSL >= 104.80 ? 'CLOSED_AGAINST_BACKWATER' : 'GRAVITY_DRAINING',
        riskTier: stageMSL >= 105.70 || rainIntensity >= 60 ? 'EMERGENCY' : (stageMSL >= 104.80 ? 'WARNING' : 'ADVISORY'),
        narrative: `Elevated Brahmaputra water level (${stageMSL.toFixed(2)}m MSL) forces town drainage sluices closed. Internal storm runoff from heavy cloudburst (${rainIntensity} mm/h) is trapped behind the DTP dyke.`
    };
}

// ============================================================================
// 6. Bind Workspaces to Active Town / Restore Clonmel
// ============================================================================

export function bindDibrugarhWorkspaces(workspaceManager, currentTown) {
    if (!workspaceManager) return;
    const townId = typeof currentTown === 'string' ? currentTown : (currentTown?.id || 'clonmel');

    if (townId === 'dibrugarh') {
        // 1. Critical Infrastructure Dependency Map
        if (workspaceManager.infraManager) {
            workspaceManager.infraManager.facilities = DIBRUGARH_INFRASTRUCTURE;
            workspaceManager.infraManager.selectedFacility = DIBRUGARH_INFRASTRUCTURE[0];
            if (typeof workspaceManager.infraManager.build3DMarkers === 'function') {
                workspaceManager.infraManager.build3DMarkers();
            }
        }

        // 2. Community Flood Evidence Network
        if (workspaceManager.evidenceManager) {
            workspaceManager.evidenceManager.reports = DIBRUGARH_COMMUNITY_EVIDENCE;
            workspaceManager.evidenceManager.selectedReport = DIBRUGARH_COMMUNITY_EVIDENCE[0];
            if (typeof workspaceManager.evidenceManager.build3DMarkers === 'function') {
                workspaceManager.evidenceManager.build3DMarkers();
            }
        }

        // 3. Emergency Command Exercise
        if (workspaceManager.exerciseManager) {
            workspaceManager.exerciseManager.scenario = DIBRUGARH_COMMAND_EXERCISES[0];
            if (typeof workspaceManager.exerciseManager.reset === 'function') {
                workspaceManager.exerciseManager.reset();
            }
        }

        // 4. Update workspace views if available
        if (typeof workspaceManager.updateView === 'function') {
            workspaceManager.updateView();
        }
    } else {
        // Restore Clonmel defaults
        if (workspaceManager.infraManager) {
            workspaceManager.infraManager.facilities = CLONMEL_INFRASTRUCTURE;
            workspaceManager.infraManager.selectedFacility = CLONMEL_INFRASTRUCTURE[0];
            if (typeof workspaceManager.infraManager.build3DMarkers === 'function') {
                workspaceManager.infraManager.build3DMarkers();
            }
        }

        if (workspaceManager.evidenceManager) {
            workspaceManager.evidenceManager.reports = INITIAL_COMMUNITY_EVIDENCE;
            workspaceManager.evidenceManager.selectedReport = INITIAL_COMMUNITY_EVIDENCE[0];
            if (typeof workspaceManager.evidenceManager.build3DMarkers === 'function') {
                workspaceManager.evidenceManager.build3DMarkers();
            }
        }

        if (workspaceManager.exerciseManager) {
            workspaceManager.exerciseManager.scenario = EXERCISE_SCENARIO;
            if (typeof workspaceManager.exerciseManager.reset === 'function') {
                workspaceManager.exerciseManager.reset();
            }
        }

        if (typeof workspaceManager.updateView === 'function') {
            workspaceManager.updateView();
        }
    }
}

// ============================================================================
// 7. Dynamic Workspace UI Updates for Dibrugarh
// ============================================================================

export function updateDibrugarhWorkspace(workspaceId, workspaceManager) {
    if (!workspaceManager) return;

    if (workspaceId === 'impact') {
        if (typeof workspaceManager.updateInfraView === 'function') {
            workspaceManager.updateInfraView();
        }
    } else if (workspaceId === 'evidence') {
        if (typeof workspaceManager.updateEvidenceView === 'function') {
            workspaceManager.updateEvidenceView();
        }
    } else if (workspaceId === 'exercise') {
        if (typeof workspaceManager.updateExerciseView === 'function') {
            workspaceManager.updateExerciseView();
        }
    } else if (workspaceId === 'forecast') {
        if (typeof workspaceManager.updateForecastUI === 'function') {
            workspaceManager.updateForecastUI();
        }
        if (typeof document !== 'undefined') {
            const stTitle = document.getElementById('fc-station-name');
            if (stTitle) stTitle.textContent = 'WRD Station 03 (Brahmaputra River at Dibrugarh)';
            const tsLabel = document.getElementById('fp-timestamp-label');
            if (tsLabel) tsLabel.textContent = 'Cycle: 06:00:00 • WRD Assam Telemetry';
        }
    } else if (workspaceId === 'defences') {
        if (typeof workspaceManager.updateDefenceUI === 'function') {
            workspaceManager.updateDefenceUI();
        }
    } else if (workspaceId === 'explainable') {
        if (typeof workspaceManager.updateExplainableUI === 'function') {
            workspaceManager.updateExplainableUI();
        }
        if (typeof document !== 'undefined') {
            const primaryDriverEl = document.getElementById('exp-primary-driver');
            if (primaryDriverEl) {
                const exp = getDibrugarhForecastExplanation({ stageMSL: 105.50, rainIntensity: 65 });
                primaryDriverEl.textContent = exp.primaryDriver;
            }
        }
    }
}
