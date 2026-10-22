/**
 * state.js
 * 
 * Centralized Shared State Management across all 5 Hydroverse Workspaces:
 * 1. Live Flood Map
 * 2. Flood Time Machine
 * 3. Intervention Lab
 * 4. Impact Intelligence
 * 5. Science & Validation
 */

export const AppState = {
    // Current Active Workspace
    currentWorkspace: 'live', // 'live' | 'time' | 'intervention' | 'impact' | 'science'
    
    // Simulation Scenario
    scenario: 'flood100', // 'normal' | 'flood100' | 'surge' | 'custom'
    inflow: 450,          // m³/s
    rain: 0,              // mm/h
    surge: 0.0,           // m
    
    // Historical Event Mode
    historicalEvent: null, // null | 'storm_frank_2015' | 'flood_2008' | 'flood_2000'
    
    // Active Overlays
    overlays: {
        depthHeatmap: false,
        arrivalTime: false,
        duration: false,
        uncertainty: false,
        unintendedConsequences: false
    },
    
    // Interventions
    interventions: {
        wallHeight: 2.8,        // meters
        sandbagHeight: 1.2,     // meters
        sudsPermeableSoil: false, // SuDS Green Infrastructure
        drainagePumps: false,     // Suir Island axial pump station (15 m³/s)
        activeTool: 'wall'        // 'wall' | 'sandbags' | 'preset' | null
    },
    
    // Selected Asset / Location Inspector
    selectedAsset: {
        id: null,
        name: 'Quay Street / Riverfront',
        type: 'street',
        lon: -7.7032,
        lat: 52.3538,
        groundElev: 18.4,
        waterDepth: 0.0,
        flowSpeed: 0.0,
        status: 'safe',
        arrivalTime: -1, // seconds (-1 = not inundated)
        duration: 0,     // seconds
        peakDepth: 0.0,
        history: []      // time-depth array for sparkline/chart
    },
    
    // Telemetry & Impact Metrics
    metrics: {
        floodedBuildings: 0,
        endangeredBuildings: 0,
        partialBuildings: 0,
        savedBuildings: 0,
        roadsCutoffCount: 0,
        roadsCutoffKm: 0.0,
        totalFloodedAreaHa: 0.0,
        peakTownDepth: 0.0,
        hospitalAccessible: true,
        suirIslandCutoff: false,
        oldBridgeCutoff: false,
        massBalanceErrorPct: 0.28,
        fps: 60,
        stepLatencyMs: 0.8
    },
    
    // Story Mode ("ONE STORM. TWO FUTURES.")
    storyMode: {
        active: false,
        currentStep: 0,
        steps: [
            { id: 'baseline', title: '1. River Suir Baseline', desc: 'Clonmel under normal 55 m³/s dry conditions.' },
            { id: 'storm_onset', title: '2. Storm Inflow Surge', desc: '1-in-100-year storm swells upstream inflow to 450 m³/s.' },
            { id: 'quay_overtop', title: '3. Quay Overtopping', desc: 'River water overtops The Quay and enters historic streets.' },
            { id: 'impact', title: '4. Critical Disruption', desc: 'Over 120 structures and road connections threatened.' },
            { id: 'intervention', title: '5. Quay Barrier Deployment', desc: '2.8m demountable flood walls deployed along riverfront.' },
            { id: 'outcomes', title: '6. Quantified Protection', desc: 'Structures protected safe (green); road network restored.' }
        ]
    },
    
    setWorkspace(workspaceKey) {
        this.currentWorkspace = workspaceKey;
        this.notify('workspace_changed', workspaceKey);
    },
    
    setOverlay(overlayKey, active) {
        if (this.overlays.hasOwnProperty(overlayKey)) {
            this.overlays[overlayKey] = active;
            this.notify('overlay_changed', { overlayKey, active });
        }
    },
    
    startStoryMode() {
        this.storyMode.active = true;
        this.storyMode.currentStep = 0;
        this.notify('story_started', 0);
    },
    
    nextStoryStep() {
        if (this.storyMode.currentStep < this.storyMode.steps.length - 1) {
            this.storyMode.currentStep++;
            this.notify('story_step', this.storyMode.currentStep);
        }
        return this.storyMode.currentStep;
    },
    
    prevStoryStep() {
        if (this.storyMode.currentStep > 0) {
            this.storyMode.currentStep--;
            this.notify('story_step', this.storyMode.currentStep);
        }
        return this.storyMode.currentStep;
    },
    
    endStoryMode() {
        this.storyMode.active = false;
        this.notify('story_ended', null);
    },

    // Listeners for reactive updates
    _listeners: new Set(),
    
    subscribe(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    },
    
    notify(event, data) {
        for (const cb of this._listeners) {
            try { cb(event, data); } catch (e) { console.error('State subscriber error:', e); }
        }
    }
};
