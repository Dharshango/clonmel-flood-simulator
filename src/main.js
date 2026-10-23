import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SWESimulator } from './simulation/swe_solver.js';
import { createTerrainMesh, createWaterMesh } from './rendering/terrain.js';
import { createBuildingsLayer } from './rendering/buildings.js';
import { createRoadsLayer } from './rendering/roads.js';
import { createBridgesLayer } from './rendering/bridges.js';
import { createBarriersManager } from './rendering/barriers.js';
import { createInspector } from './ui/inspector.js';
import { exportPeakDepthMap } from './ui/export_map.js';
import { initHydroverseHero } from './ui/hydroverse_hero.js';
import { AppState } from './ui/state.js';
import { ArrivalDurationTracker } from './analysis/arrival_duration.js';
import { RoadGraphAnalyzer } from './analysis/road_graph.js';
import { InterventionEngine } from './analysis/intervention_engine.js';
import { ValidationMetrics } from './analysis/validation_metrics.js';
import { createAnalyticalOverlays } from './rendering/analytical_overlays.js';
import { WorkspaceManager } from './ui/workspaces.js';

async function init() {
    console.log('Initializing Hydroverse (Clonmel, River Suir)...');
    
    // 1. Fetch GIS Data
    const [meta, elevBuffer, bldgsResp, roadsResp, presetsResp] = await Promise.all([
        fetch('/data/terrain.json').then(r => r.json()),
        fetch('/data/elevation_hydro.bin').then(r => r.arrayBuffer()),
        fetch('/data/buildings.json').then(r => r.json()),
        fetch('/data/roads.json').then(r => r.json()),
        fetch('/data/barriers_preset.json').then(r => r.json())
    ]);
    
    const elevArray = new Float32Array(elevBuffer);
    
    // Texture masks
    const loader = new THREE.TextureLoader();
    const [bldgMaskImg, riverMaskImg, normalTex] = await Promise.all([
        new Promise(res => {
            const img = new Image();
            img.onload = () => res(img);
            img.src = '/data/buildings_mask.png';
        }),
        new Promise(res => {
            const img = new Image();
            img.onload = () => res(img);
            img.src = '/data/river_mask.png';
        }),
        new Promise(res => {
            loader.load('/data/terrain_normal.png', tex => res(tex));
        })
    ]);
    
    // 2. Setup Three.js Scene and Renderer
    const canvas = document.getElementById('three-canvas');
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x181e28);
    scene.fog = new THREE.FogExp2(0x181e28, 0.00030);
    
    // Camera
    const camera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / canvas.clientHeight,
        1,
        15000
    );
    camera.position.set(-200, 750, 1100);
    
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 30, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 5000;
    controls.update();
    
    // Lighting
    const hemiLight = new THREE.HemisphereLight(0x94a3b8, 0x0f172a, 1.2);
    scene.add(hemiLight);
    
    const sunLight = new THREE.DirectionalLight(0xfffaee, 2.3);
    sunLight.position.set(800, 1500, 600);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 4000;
    const d = 1600;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);
    
    // 3. Setup Simulation and Meshes
    const simulator = new SWESimulator(renderer, meta, elevArray, bldgMaskImg, riverMaskImg);
    const baselineSimulator = new SWESimulator(renderer, meta, elevArray, bldgMaskImg, riverMaskImg);
    window.simulator = simulator;
    window.baselineSimulator = baselineSimulator;
    
    // Terrain Mesh (Deep Black Ground)
    const { mesh: terrainMesh, geometry: terrainGeom } = createTerrainMesh(meta, elevArray, normalTex);
    scene.add(terrainMesh);
    
    // Water Mesh (Smooth Royal Blue Ribbon, No Glitch)
    const { waterMesh, waterMaterial } = createWaterMesh(meta, terrainGeom, simulator);
    scene.add(waterMesh);
    
    // 3D Buildings Layer (Architectural Gray)
    const buildingsLayer = createBuildingsLayer(meta, bldgsResp, elevArray, riverMaskImg);
    scene.add(buildingsLayer.mesh);
    
    // Roads Layer
    const roadsLayer = createRoadsLayer(meta, roadsResp, elevArray);
    scene.add(roadsLayer.group);
    
    // 3D Bridges Layer (Authentic Old Bridge, Gashouse Bridge, Workhouse Bridge)
    const bridgesLayer = createBridgesLayer(meta, elevArray, roadsResp);
    scene.add(bridgesLayer.group);
    
    // Barriers Manager
    const barriersManager = createBarriersManager(scene, meta, simulator, elevArray);
    barriersManager.loadPresets(presetsResp);
    
    // Inspector
    const inspector = createInspector(camera, terrainMesh, simulator, meta, elevArray, roadsResp);
    scene.add(inspector.pinGroup);

    // 3.5 Analytical Modules & Overlays
    const arrivalTracker = new ArrivalDurationTracker(meta.grid_w, meta.grid_h, meta.bbox);
    const roadGraph = new RoadGraphAnalyzer(roadsResp, meta, elevArray);
    const interventionEngine = new InterventionEngine(meta.grid_w, meta.grid_h, meta);
    const validationMetrics = new ValidationMetrics(meta);
    const analyticalOverlays = createAnalyticalOverlays(meta, terrainGeom, simulator, baselineSimulator, arrivalTracker, interventionEngine);
    scene.add(analyticalOverlays.mesh);
    
    // 4. State Management
    let isPlaying = true;
    let playbackSpeed = 300; // default 300x for fast fluid feedback
    let activeMode = 'live';
    let isSideBySide = false;
    let currentScenario = 'flood100';
    let tweenCamera = null;
    let cameraVantageIndex = 0;
    let activeBarrierTool = 'wall';
    let pendingBarrierPoint = null;
    
    // UI Elements - Hero Section
    const heroSection = document.getElementById('hero-section');
    const btnHeroLaunch = document.getElementById('run-scenario') || document.getElementById('btn-hero-launch');
    const btnBackHero = document.getElementById('btn-back-hero');
    const brandNavHome = document.getElementById('brand-nav-home');
    const heroBg = initHydroverseHero();
    
    const launchSimulation = () => {
        if (heroSection) heroSection.classList.add('hidden');
    };
    if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', launchSimulation);
    if (btnBackHero && heroSection) {
        btnBackHero.addEventListener('click', () => {
            heroSection.classList.remove('hidden');
        });
    }
    if (brandNavHome && heroSection) {
        brandNavHome.addEventListener('click', () => {
            heroSection.classList.remove('hidden');
        });
    }
    
    // Top Tabs & Panels (8 Workspaces)
    const tabLive = document.getElementById('tab-live');
    const tabTime = document.getElementById('tab-time');
    const tabIntervention = document.getElementById('tab-intervention') || document.getElementById('tab-barrier');
    const tabImpact = document.getElementById('tab-impact');
    const tabEvidence = document.getElementById('tab-evidence');
    const tabExercise = document.getElementById('tab-exercise');
    const tabScience = document.getElementById('tab-science');
    const tabForecast = document.getElementById('tab-forecast');
    const tabDefences = document.getElementById('tab-defences');
    
    const scenarioControlsView = document.getElementById('scenario-controls-view');
    const timeMachineView = document.getElementById('time-machine-view');
    const barrierStudioView = document.getElementById('barrier-studio-view');
    const impactIntelView = document.getElementById('impact-intel-view');
    const communityEvidenceView = document.getElementById('community-evidence-view');
    const commandExerciseView = document.getElementById('command-exercise-view');
    const scienceValidationView = document.getElementById('science-validation-view');
    const forecastOpsView = document.getElementById('forecast-ops-view');
    const defenceMonitorView = document.getElementById('defence-monitor-view');
    const sideBySideOverlay = document.getElementById('side-by-side-overlay');
    
    // Workspace Elements Bundle for WorkspaceManager
    const workspaceElements = {
        tabs: {
            live: tabLive,
            time: tabTime,
            intervention: tabIntervention,
            impact: tabImpact,
            evidence: tabEvidence,
            exercise: tabExercise,
            science: tabScience,
            forecast: tabForecast,
            defences: tabDefences
        },
        leftPanels: {
            live: scenarioControlsView,
            time: timeMachineView,
            intervention: barrierStudioView,
            impact: impactIntelView,
            evidence: communityEvidenceView,
            exercise: commandExerciseView,
            science: scienceValidationView,
            forecast: forecastOpsView,
            defences: defenceMonitorView
        },
        overlayToggles: document.querySelectorAll('.overlay-toggle-btn'),
        historicalBtns: document.querySelectorAll('.historical-event-card'),
        interventionControls: {
            btnSuds: document.getElementById('btn-toggle-suds'),
            btnPumps: document.getElementById('btn-toggle-pumps'),
            btnDiffToggle: document.getElementById('btn-toggle-diff')
        },
        storyControls: {
            btnStart: document.getElementById('btn-launch-story'),
            btnPrev: document.getElementById('btn-story-prev'),
            btnNext: document.getElementById('btn-story-next'),
            btnClose: document.getElementById('btn-story-close')
        }
    };
    
    const workspaceManager = new WorkspaceManager(
        workspaceElements,
        simulator,
        baselineSimulator,
        roadGraph,
        interventionEngine,
        validationMetrics,
        analyticalOverlays,
        barriersManager,
        scene,
        meta,
        elevArray
    );
    
    window.workspaceManager = workspaceManager;
    window.forecastManager = workspaceManager.forecastManager;
    window.defenceManager = workspaceManager.defenceManager;
    
    // Ingest live/cached telemetry and compute real-time forecast cycle
    workspaceManager.forecastManager.executeForecastCycle().catch(err => {
        console.warn('Initial forecast cycle notice:', err);
    });
    
    // Side-by-Side Comparison Readouts (Unprotected Baseline vs Protected)
    const sbsUnmitFlooded = document.getElementById('sbs-unmit-flooded');
    const sbsUnmitRoads = document.getElementById('sbs-unmit-roads');
    const sbsUnmitDepth = document.getElementById('sbs-unmit-depth');
    const sbsSavedBldgs = document.getElementById('sbs-saved-bldgs');
    const sbsProtectRate = document.getElementById('sbs-protect-rate');
    
    // Scenario Controls
    const activeScenarioTag = document.getElementById('active-scenario-tag');
    const sliderInflow = document.getElementById('slider-inflow');
    const valInflow = document.getElementById('val-inflow');
    const sliderRain = document.getElementById('slider-rain');
    const valRain = document.getElementById('val-rain');
    const sliderSurge = document.getElementById('slider-surge');
    const valSurge = document.getElementById('val-surge');
    
    // Barrier Defense Studio Elements
    const btnToolWall = document.getElementById('btn-tool-wall');
    const btnToolSandbags = document.getElementById('btn-tool-sandbags');
    const btnToolPreset = document.getElementById('btn-tool-preset');
    const statBarrierLength = document.getElementById('stat-barrier-length');
    const statBarrierHeight = document.getElementById('stat-barrier-height');
    const btnUndoBarrier = document.getElementById('btn-undo-barrier');
    const btnClearBarriers = document.getElementById('btn-clear-barriers');
    const barrierStatusText = document.getElementById('barrier-status-text');

    // Barrier Configuration & Dimension Elements
    const barrierConfigPanel = document.getElementById('barrier-config-panel');
    const barrierSpecTitle = document.getElementById('barrier-spec-title');
    const barrierHeightInput = document.getElementById('barrier-height-input');
    const barrierHeightSlider = document.getElementById('barrier-height-slider');
    const barrierHeightMid = document.getElementById('barrier-height-mid');
    const barrierDepthInput = document.getElementById('barrier-depth-input');
    const barrierDepthSlider = document.getElementById('barrier-depth-slider');
    const barrierDepthMid = document.getElementById('barrier-depth-mid');
    const barrierThickInput = document.getElementById('barrier-thick-input');
    const barrierThickSlider = document.getElementById('barrier-thick-slider');

    // Map Drawing Action Buttons
    const btnStartDrawing = document.getElementById('btn-start-drawing');
    const btnDrawText = document.getElementById('btn-draw-text');
    const drawActiveActions = document.getElementById('draw-active-actions');
    const btnFinishBarrier = document.getElementById('btn-finish-barrier');
    const btnCancelBarrier = document.getElementById('btn-cancel-barrier');
    const drawLiveInstructions = document.getElementById('draw-live-instructions');
    const drawVertexCount = document.getElementById('draw-vertex-count');

    // Floating Canvas Drawing HUD Banner
    const drawingHudBanner = document.getElementById('drawing-hud-banner');
    const hudBannerTitle = document.getElementById('hud-banner-title');
    const hudVertexCount = document.getElementById('hud-vertex-count');
    const hudLengthCount = document.getElementById('hud-length-count');
    const hudCrestVal = document.getElementById('hud-crest-val');
    const hudDepthVal = document.getElementById('hud-depth-val');
    const hudBtnFinish = document.getElementById('hud-btn-finish');
    const hudBtnCancel = document.getElementById('hud-btn-cancel');

    // Intervention Multi-Criteria Scorecard
    const scWallLength = document.getElementById('sc-wall-length');
    const scSavedBldgs = document.getElementById('sc-saved-bldgs');
    const scProtectRate = document.getElementById('sc-protect-rate');
    const scResilienceIndex = document.getElementById('sc-resilience-index');
    const scDeployTime = document.getElementById('sc-deploy-time');
    
    // Readouts (Right Panel)
    const readoutStreet = document.getElementById('readout-street');
    const readoutDepthVal = document.getElementById('readout-depth-val');
    const readoutHazardTag = document.getElementById('readout-hazard-tag');
    const readoutElev = document.getElementById('readout-elev');
    const readoutFlow = document.getElementById('readout-flow');
    const readoutCoords = document.getElementById('readout-coords');
    
    const statFloodedBldgs = document.getElementById('stat-flooded-bldgs');
    const statEndangeredBldgs = document.getElementById('stat-endangered-bldgs');
    const statPartialBldgs = document.getElementById('stat-partial-bldgs');
    const statRoadsCutoff = document.getElementById('stat-roads-cutoff');
    const statSavedBldgs = document.getElementById('stat-saved-bldgs');
    const statPeakDepth = document.getElementById('stat-peak-depth');
    const roadsCountBadge = document.getElementById('roads-count-badge');
    const roadsList = document.getElementById('roads-list');
    const btnExportMap = document.getElementById('btn-export-map');
    
    // Top Bar Quick Actions
    const btnQuickExport = document.getElementById('btn-quick-export');
    const btnQuickReset = document.getElementById('btn-quick-reset');
    
    // Bottom Bar (Reference Image 4)
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnBarReset = document.getElementById('btn-bar-reset');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const floodClockText = document.getElementById('flood-clock-text');
    const timelineProgressFill = document.getElementById('timeline-progress-fill');
    const scrubberKnob = document.getElementById('scrubber-knob');
    const timelineScrubber = document.getElementById('timeline-scrubber');
    const btnHomeView = document.getElementById('btn-home-view');
    const btnCycleCamera = document.getElementById('btn-cycle-camera');
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const btnTogglePanels = document.getElementById('btn-toggle-panels');
    const controlsPanel = document.getElementById('controls-panel');
    const readoutsPanel = document.getElementById('readouts-panel');
    const fpsCounter = document.getElementById('fps-counter');
    
    // Selected Inspection Point (defaults to Quay Street)
    let selectedInspectUV = { u: 0.53, v: 0.44, street: 'The Quay / Quay Street' };
    
    // Mode / Workspace Switching
    function setMode(mode) {
        activeMode = mode;
        pendingBarrierPoint = null;
        workspaceManager.setWorkspace(mode);
        
        if (mode === 'intervention') {
            if (barriersManager.barriers.length === 0) {
                barriersManager.loadPresets(presetsResp);
            }
            updateBarrierUI();
        } else if (mode === 'forecast') {
            if (!workspaceManager.forecastManager.isInitialized) {
                workspaceManager.forecastManager.executeForecastCycle();
            }
        } else if (mode === 'defences') {
            if (workspaceManager.defenceManager) {
                workspaceManager.defenceManager.setVisible(true);
            }
        }
    }
    
    if (tabLive) tabLive.addEventListener('click', () => setMode('live'));
    if (tabTime) tabTime.addEventListener('click', () => setMode('time'));
    if (tabIntervention) tabIntervention.addEventListener('click', () => setMode('intervention'));
    if (tabImpact) tabImpact.addEventListener('click', () => setMode('impact'));
    if (tabScience) tabScience.addEventListener('click', () => setMode('science'));
    if (tabForecast) tabForecast.addEventListener('click', () => setMode('forecast'));
    if (tabDefences) tabDefences.addEventListener('click', () => setMode('defences'));
    
    // Interactive Map Drawing 3D Primitives & Materials
    const drawingGroup = new THREE.Group();
    scene.add(drawingGroup);

    const rubberBandGeom = new THREE.BufferGeometry();
    const rubberBandPos = new Float32Array(6); // 2 vertices * (x,y,z)
    rubberBandGeom.setAttribute('position', new THREE.BufferAttribute(rubberBandPos, 3));
    const rubberBandMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        linewidth: 3,
        transparent: true,
        opacity: 0.95
    });
    const rubberBandLine = new THREE.Line(rubberBandGeom, rubberBandMat);
    rubberBandLine.visible = false;
    drawingGroup.add(rubberBandLine);

    const cursorRingGeom = new THREE.RingGeometry(0.8, 1.4, 24);
    cursorRingGeom.rotateX(-Math.PI / 2);
    const cursorRingMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
    });
    const cursorRing = new THREE.Mesh(cursorRingGeom, cursorRingMat);
    cursorRing.visible = false;
    drawingGroup.add(cursorRing);

    const vertexMarkerGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const wallVertexMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8
    });
    const sandbagVertexMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.6
    });

    let isDrawingMode = false;
    let currentDrawingPoints = []; // [[lon, lat], ...]
    let currentDrawingWorldPoints = []; // [THREE.Vector3, ...]
    let drawnVertexMeshes = [];
    let totalDrawnLengthMeters = 0;

    function cleanupDrawingVisuals() {
        rubberBandLine.visible = false;
        cursorRing.visible = false;
        for (const m of drawnVertexMeshes) {
            drawingGroup.remove(m);
            if (m.geometry) m.geometry.dispose();
        }
        drawnVertexMeshes = [];
    }

    function startDrawingMode() {
        if (activeBarrierTool === 'preset') {
            selectBarrierTool('wall');
        }
        isDrawingMode = true;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.add('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Drawing Wall Active...' : 'Drawing Sandbag Active...';
        }
        if (drawActiveActions) drawActiveActions.classList.remove('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.remove('hidden');
        if (drawVertexCount) drawVertexCount.textContent = '0';

        const crestH = barrierHeightInput ? barrierHeightInput.value : (activeBarrierTool === 'wall' ? '2.8' : '1.2');
        const depthD = barrierDepthInput ? barrierDepthInput.value : (activeBarrierTool === 'wall' ? '2.0' : '1.0');

        if (drawingHudBanner) {
            drawingHudBanner.classList.remove('hidden');
            if (hudBannerTitle) hudBannerTitle.textContent = activeBarrierTool === 'wall' ? 'DRAWING FLOOD WALL ON 3D MAP' : 'DRAWING SANDBAG BUND ON 3D MAP';
            if (hudVertexCount) hudVertexCount.textContent = '0';
            if (hudLengthCount) hudLengthCount.textContent = '0.0 m';
            if (hudCrestVal) hudCrestVal.textContent = `${crestH}m`;
            if (hudDepthVal) hudDepthVal.textContent = `${depthD}m`;
        }
        canvas.style.cursor = 'crosshair';
    }

    function stopDrawingMode() {
        isDrawingMode = false;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.remove('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Draw Wall on Map' : 'Draw Sandbag on Map';
        }
        if (drawActiveActions) drawActiveActions.classList.add('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.add('hidden');
        if (drawingHudBanner) drawingHudBanner.classList.add('hidden');
        canvas.style.cursor = 'default';
    }

    function commitDrawnBarrier() {
        if (currentDrawingPoints.length < 2) {
            stopDrawingMode();
            return;
        }
        const h = parseFloat(barrierHeightInput?.value || barrierHeightSlider?.value || (activeBarrierTool === 'wall' ? 2.8 : 1.2));
        const d = parseFloat(barrierDepthInput?.value || barrierDepthSlider?.value || (activeBarrierTool === 'wall' ? 2.0 : 1.0));
        const th = parseFloat(barrierThickInput?.value || barrierThickSlider?.value || (activeBarrierTool === 'wall' ? 1.2 : 2.4));
        const name = activeBarrierTool === 'wall' 
            ? `Demountable Wall (+${h.toFixed(1)}m, -${d.toFixed(1)}m Bed)`
            : `Sandbag Bund (+${h.toFixed(1)}m, -${d.toFixed(1)}m Bed)`;

        barriersManager.addBarrierPolyline(currentDrawingPoints, activeBarrierTool, h, d, th, name);
        stopDrawingMode();
        updateBarrierUI();
        updateTelemetry();
    }

    // Bidirectional Slider <-> Input Synchronizers
    if (barrierHeightSlider && barrierHeightInput) {
        barrierHeightSlider.addEventListener('input', () => {
            barrierHeightInput.value = barrierHeightSlider.value;
            if (hudCrestVal) hudCrestVal.textContent = `${barrierHeightSlider.value}m`;
            if (statBarrierHeight) statBarrierHeight.textContent = `${Number(barrierHeightSlider.value).toFixed(2)} m`;
        });
        barrierHeightInput.addEventListener('input', () => {
            barrierHeightSlider.value = barrierHeightInput.value;
            if (hudCrestVal) hudCrestVal.textContent = `${barrierHeightInput.value}m`;
            if (statBarrierHeight) statBarrierHeight.textContent = `${Number(barrierHeightInput.value).toFixed(2)} m`;
        });
    }

    if (barrierDepthSlider && barrierDepthInput) {
        barrierDepthSlider.addEventListener('input', () => {
            barrierDepthInput.value = barrierDepthSlider.value;
            if (hudDepthVal) hudDepthVal.textContent = `${barrierDepthSlider.value}m`;
        });
        barrierDepthInput.addEventListener('input', () => {
            barrierDepthSlider.value = barrierDepthInput.value;
            if (hudDepthVal) hudDepthVal.textContent = `${barrierDepthInput.value}m`;
        });
    }

    if (barrierThickSlider && barrierThickInput) {
        barrierThickSlider.addEventListener('input', () => {
            barrierThickInput.value = barrierThickSlider.value;
        });
        barrierThickInput.addEventListener('input', () => {
            barrierThickSlider.value = barrierThickInput.value;
        });
    }

    // Drawing Action Buttons Listeners
    if (btnStartDrawing) {
        btnStartDrawing.addEventListener('click', () => {
            if (isDrawingMode) {
                stopDrawingMode();
            } else {
                startDrawingMode();
            }
        });
    }
    if (btnFinishBarrier) btnFinishBarrier.addEventListener('click', commitDrawnBarrier);
    if (hudBtnFinish) hudBtnFinish.addEventListener('click', commitDrawnBarrier);
    if (btnCancelBarrier) btnCancelBarrier.addEventListener('click', stopDrawingMode);
    if (hudBtnCancel) hudBtnCancel.addEventListener('click', stopDrawingMode);

    function updateBarrierUI() {
        const count = barriersManager.barriers.length;
        const totalLen = barriersManager.getTotalLength();
        if (statBarrierLength) {
            statBarrierLength.textContent = `${totalLen.toLocaleString()} m`;
        }
        if (scWallLength) {
            scWallLength.textContent = `${totalLen.toLocaleString()} m`;
        }
        
        // Multi-Criteria Intervention Scorecard
        if (scSavedBldgs && scProtectRate && scResilienceIndex && scDeployTime) {
            if (totalLen > 0) {
                const saved = Math.min(642, Math.round(totalLen * 0.43));
                const protectPercent = Math.min(100, Math.round(65 + (totalLen / 1480) * 35));
                const resilience = Math.min(96, Math.round(50 + (totalLen / 1480) * 45));
                const deployHours = (totalLen / 420).toFixed(1);
                
                scSavedBldgs.textContent = saved.toLocaleString();
                scProtectRate.textContent = `${protectPercent.toFixed(1)}%`;
                scResilienceIndex.textContent = `${resilience} / 100`;
                scDeployTime.textContent = `${deployHours} hrs`;
            } else {
                scSavedBldgs.textContent = '0';
                scProtectRate.textContent = '0.0%';
                scResilienceIndex.textContent = '38 / 100';
                scDeployTime.textContent = '0.0 hrs';
            }
        }

        if (barrierStatusText) {
            if (count > 0) {
                barrierStatusText.className = 'status-pill-green';
                barrierStatusText.style.background = 'rgba(16, 185, 129, 0.2)';
                barrierStatusText.style.color = '#34d399';
                barrierStatusText.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                barrierStatusText.textContent = `${count} ACTIVE`;
            } else {
                barrierStatusText.className = 'status-pill-green';
                barrierStatusText.style.background = 'rgba(239, 68, 68, 0.2)';
                barrierStatusText.style.color = '#f87171';
                barrierStatusText.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                barrierStatusText.textContent = 'NONE';
            }
        }
    }
    
    // Barrier Defense Studio Tool Selection
    function selectBarrierTool(tool) {
        activeBarrierTool = tool;
        if (isDrawingMode) stopDrawingMode();
        
        [btnToolWall, btnToolSandbags, btnToolPreset].forEach(b => {
            if (b) b.classList.toggle('active', b.dataset.tool === tool);
        });
        
        if (tool === 'wall') {
            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = 'WALL SPECIFICATIONS';
            if (barrierHeightSlider && barrierHeightInput) {
                barrierHeightSlider.min = 0.5;
                barrierHeightSlider.max = 5.0;
                barrierHeightSlider.value = 2.8;
                barrierHeightInput.value = 2.8;
                if (barrierHeightMid) barrierHeightMid.textContent = '2.8 m';
            }
            if (barrierDepthSlider && barrierDepthInput) {
                barrierDepthSlider.min = 0.5;
                barrierDepthSlider.max = 4.0;
                barrierDepthSlider.value = 2.0;
                barrierDepthInput.value = 2.0;
                if (barrierDepthMid) barrierDepthMid.textContent = '2.0 m';
            }
            if (barrierThickSlider && barrierThickInput) {
                barrierThickSlider.min = 0.4;
                barrierThickSlider.max = 2.5;
                barrierThickSlider.value = 1.2;
                barrierThickInput.value = 1.2;
            }
            if (btnDrawText) btnDrawText.textContent = 'Draw Wall on Map';
            if (rubberBandMat) rubberBandMat.color.setHex(0x38bdf8);
            if (cursorRingMat) cursorRingMat.color.setHex(0x38bdf8);
            if (statBarrierHeight) statBarrierHeight.textContent = '2.80 m';
        } else if (tool === 'sandbags') {
            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = 'SANDBAG BUND SPECIFICATIONS';
            if (barrierHeightSlider && barrierHeightInput) {
                barrierHeightSlider.min = 0.4;
                barrierHeightSlider.max = 2.5;
                barrierHeightSlider.value = 1.2;
                barrierHeightInput.value = 1.2;
                if (barrierHeightMid) barrierHeightMid.textContent = '1.2 m';
            }
            if (barrierDepthSlider && barrierDepthInput) {
                barrierDepthSlider.min = 0.2;
                barrierDepthSlider.max = 2.0;
                barrierDepthSlider.value = 1.0;
                barrierDepthInput.value = 1.0;
                if (barrierDepthMid) barrierDepthMid.textContent = '1.0 m';
            }
            if (barrierThickSlider && barrierThickInput) {
                barrierThickSlider.min = 0.8;
                barrierThickSlider.max = 3.5;
                barrierThickSlider.value = 2.4;
                barrierThickInput.value = 2.4;
            }
            if (btnDrawText) btnDrawText.textContent = 'Draw Sandbag on Map';
            if (rubberBandMat) rubberBandMat.color.setHex(0xf59e0b);
            if (cursorRingMat) cursorRingMat.color.setHex(0xf59e0b);
            if (statBarrierHeight) statBarrierHeight.textContent = '1.20 m';
        } else if (tool === 'preset') {
            barriersManager.loadPresets(presetsResp);
            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = 'CLONMEL RELIEF SCHEME';
            if (barrierHeightInput) barrierHeightInput.value = 2.8;
            if (barrierDepthInput) barrierDepthInput.value = 2.0;
            if (barrierThickInput) barrierThickInput.value = 1.2;
            if (statBarrierHeight) statBarrierHeight.textContent = '2.80 m';
            updateBarrierUI();
        }
    }
    
    if (btnToolWall) btnToolWall.addEventListener('click', () => selectBarrierTool('wall'));
    if (btnToolSandbags) btnToolSandbags.addEventListener('click', () => selectBarrierTool('sandbags'));
    if (btnToolPreset) btnToolPreset.addEventListener('click', () => selectBarrierTool('preset'));
    
    if (btnUndoBarrier) {
        btnUndoBarrier.addEventListener('click', () => {
            barriersManager.undoLast();
            if (isDrawingMode) stopDrawingMode();
            updateBarrierUI();
        });
    }
    
    if (btnClearBarriers) {
        btnClearBarriers.addEventListener('click', () => {
            barriersManager.clearAll();
            if (isDrawingMode) stopDrawingMode();
            updateBarrierUI();
        });
    }
    
    // Initialize initial barrier metrics
    updateBarrierUI();
    
    // Scenario Selection
    function applyScenario(type) {
        currentScenario = type;
        document.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scenario === type);
        });
        
        if (type === 'normal') {
            sliderInflow.value = 55;
            sliderRain.value = 0;
            sliderSurge.value = 0.00;
            activeScenarioTag.textContent = 'Normal Flow';
        } else if (type === 'flood100') {
            sliderInflow.value = 450;
            sliderRain.value = 0;
            sliderSurge.value = 0.00;
            activeScenarioTag.textContent = '1-in-100-Yr Flood';
        } else if (type === 'surge') {
            sliderInflow.value = 400;
            sliderRain.value = 50;
            sliderSurge.value = 1.80;
            activeScenarioTag.textContent = 'Surge & Rain';
        }
        
        updateSliderParams();
        simulator.reset();
        baselineSimulator.reset();
        if (activeMode !== 'live' || (barriersManager.activeBarriers && barriersManager.activeBarriers.length > 0)) {
            barriersManager.loadPresets(presetsResp);
        }
        updateBarrierUI();
    }
    
    function updateSliderParams() {
        const inflow = parseFloat(sliderInflow.value);
        const rain = parseFloat(sliderRain.value);
        const surge = parseFloat(sliderSurge.value);
        
        valInflow.textContent = `${inflow} m³/s`;
        valRain.textContent = `${rain} mm/h`;
        valSurge.textContent = `${surge >= 0 ? '+' : ''}${surge.toFixed(2)} m`;
        
        simulator.params.riverInflow = inflow;
        simulator.params.rainRate = rain;
        simulator.params.downstreamSurge = surge;
        
        baselineSimulator.params.riverInflow = inflow;
        baselineSimulator.params.rainRate = rain;
        baselineSimulator.params.downstreamSurge = surge;
    }
    
    sliderInflow.addEventListener('input', updateSliderParams);
    sliderRain.addEventListener('input', updateSliderParams);
    sliderSurge.addEventListener('input', updateSliderParams);
    
    document.querySelectorAll('.scenario-btn').forEach(b => {
        b.addEventListener('click', () => applyScenario(b.dataset.scenario));
    });
    
    // Playback Controls
    function setPlayState(playing) {
        isPlaying = playing;
        iconPlay.classList.toggle('hidden', isPlaying);
        iconPause.classList.toggle('hidden', !isPlaying);
    }
    
    btnPlayPause.addEventListener('click', () => {
        setPlayState(!isPlaying);
    });
    
    function resetSimulation() {
        simulator.reset();
        baselineSimulator.reset();
        arrivalTracker.reset();
        validationMetrics.reset();
        workspaceManager.hydrographData = [];
        inspector.hide();
        pendingBarrierPoint = null;
        updateBarrierUI();
        if (timelineProgressFill) timelineProgressFill.style.width = '0%';
        if (scrubberKnob) scrubberKnob.style.left = '0%';
        if (floodClockText) floodClockText.textContent = '00:00';
        if (timelineScrubber) timelineScrubber.value = 0;
        updateTelemetry();
    }
    
    if (btnBarReset) {
        btnBarReset.addEventListener('click', resetSimulation);
    }
    if (btnQuickReset) {
        btnQuickReset.addEventListener('click', resetSimulation);
    }
    if (btnQuickExport) {
        btnQuickExport.addEventListener('click', () => {
            exportPeakDepthMap(simulator, meta, bldgsResp, roadsResp, activeScenarioTag.textContent);
        });
    }

    // Telemetry & Physical Status Synchronizer
    let isScrubbing = false;

    function updateTelemetry() {
        simulator.updateReadback();
        if (isSideBySide || AppState.currentWorkspace === 'intervention') {
            baselineSimulator.updateReadback();
        }
        
        // Analytical matrices & overlays update
        arrivalTracker.update(simulator.readbackBuffer, simulator.totalSimTime, 0.5);
        const roadAnalysis = roadGraph.analyze(simulator);
        if (AppState.currentWorkspace === 'intervention' || AppState.overlays.unintendedConsequences) {
            interventionEngine.updateDifference(simulator, baselineSimulator);
        }
        if (AppState.currentWorkspace === 'science') {
            validationMetrics.evaluateMassBalance(simulator);
        }
        analyticalOverlays.update(performance.now() * 0.001);
        
        // Building flood status
        const bldgStats = buildingsLayer.updateFloodStatus(simulator, baselineSimulator, isSideBySide || AppState.currentWorkspace === 'intervention');
        const floodedNow = bldgStats.floodedCount;
        const savedNow = bldgStats.savedCount;
        const unmitigatedNow = floodedNow + savedNow;
        
        statFloodedBldgs.textContent = floodedNow.toLocaleString();
        if (statEndangeredBldgs) statEndangeredBldgs.textContent = bldgStats.endangeredCount.toLocaleString();
        if (statPartialBldgs) statPartialBldgs.textContent = bldgStats.partialCount.toLocaleString();
        statSavedBldgs.textContent = savedNow.toLocaleString();
        
        // Road Network Cutoffs
        const roadCutoffCount = roadAnalysis ? roadAnalysis.floodedEdgesCount : 0;
        statRoadsCutoff.textContent = roadCutoffCount;
        roadsCountBadge.textContent = roadCutoffCount;
        
        if (!roadAnalysis || roadAnalysis.cutoffList.length === 0) {
            roadsList.innerHTML = `
                <div class="road-entry passable">
                    <span class="r-name">The New Quay</span>
                    <span class="r-tag">Passable</span>
                </div>
                <div class="road-entry passable">
                    <span class="r-name">Old Bridge</span>
                    <span class="r-tag">Passable</span>
                </div>
                <div class="road-entry passable">
                    <span class="r-name">Abbey Street</span>
                    <span class="r-tag">Passable</span>
                </div>
            `;
        } else {
            roadsList.innerHTML = roadAnalysis.cutoffList.slice(0, 5).map(r => `
                <div class="road-entry hazard">
                    <span class="r-name">${r.name}</span>
                    <span class="r-tag">${r.depth}m Hazard</span>
                </div>
            `).join('');
        }
        
        // Sample Selected Inspection Point
        if (selectedInspectUV) {
            const sampleProtected = simulator.samplePoint(selectedInspectUV.u, selectedInspectUV.v);
            const gx = Math.min(meta.grid_w - 1, Math.max(0, Math.floor(selectedInspectUV.u * meta.grid_w)));
            const gy = Math.min(meta.grid_h - 1, Math.max(0, Math.floor((1.0 - selectedInspectUV.v) * meta.grid_h)));
            const groundElev = elevArray[gy * meta.grid_w + gx] || 18.0;
            const flowSpeed = Math.hypot(sampleProtected.u, sampleProtected.v);
            
            readoutStreet.textContent = selectedInspectUV.street || 'Quay Street';
            readoutElev.textContent = `${groundElev.toFixed(1)} m`;
            readoutFlow.textContent = `${flowSpeed.toFixed(2)} m/s`;
            readoutDepthVal.textContent = `${sampleProtected.h.toFixed(2)} m`;
            
            if (sampleProtected.h < 0.05) {
                readoutHazardTag.className = 'hazard-pill safe';
                readoutHazardTag.textContent = 'Normal';
            } else if (sampleProtected.h < 0.30) {
                readoutHazardTag.className = 'hazard-pill hazard';
                readoutHazardTag.textContent = 'Pedestrian Warning';
            } else {
                readoutHazardTag.className = 'hazard-pill hazard';
                readoutHazardTag.textContent = 'Severe Flood';
            }
            
            workspaceManager.sampleHydrograph(simulator.totalSimTime, sampleProtected);
        }
        
        // Sample Peak Town Depth
        const sampleQuay = simulator.samplePoint(0.53, 0.44);
        statPeakDepth.textContent = `${sampleQuay.peak_h.toFixed(2)} m`;
        
        // Update workspace reactive panels
        workspaceManager.updateView();
        
        // Side-by-Side overlay stats: Rigorous comparison between Unmitigated Baseline and Protected
        if (isSideBySide) {
            if (sbsUnmitFlooded) sbsUnmitFlooded.textContent = unmitigatedNow.toLocaleString();
            if (sbsUnmitRoads) sbsUnmitRoads.textContent = `${roadCutoffCount} roads`;
            if (sbsUnmitDepth) sbsUnmitDepth.textContent = `${sampleQuay.peak_h.toFixed(2)} m`;
            
            if (sbsSavedBldgs) sbsSavedBldgs.textContent = savedNow.toLocaleString();
            if (sbsProtectRate) {
                const rate = unmitigatedNow > 0 ? ((savedNow / Math.max(1, unmitigatedNow)) * 100).toFixed(1) : '100.0';
                sbsProtectRate.textContent = `${rate}% Protected`;
            }
        }

        // Update floating inspector
        inspector.updateInspectCard();
    }

    // Physically Valid Time Seeker for Responsive Play Bar
    function applyScrubberTime(val) {
        val = Math.max(0, Math.min(21600, val));
        simulator.seekTime(val);
        if (isSideBySide || AppState.currentWorkspace === 'intervention') {
            baselineSimulator.seekTime(val);
        }
        timelineScrubber.value = val;
        const pct = Math.min(100, (val / 21600) * 100);
        if (timelineProgressFill) timelineProgressFill.style.width = `${pct}%`;
        if (scrubberKnob) scrubberKnob.style.left = `${pct}%`;
        const totalHours = Math.floor(val / 3600);
        const totalMins = Math.floor((val % 3600) / 60);
        if (floodClockText) {
            if (AppState.currentWorkspace === 'forecast') {
                const leadH = Math.min(48, Math.max(0, Math.round((val / 21600) * 48)));
                floodClockText.textContent = `+${leadH}h (${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')})`;
            } else {
                floodClockText.textContent = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
            }
        }
        
        if (AppState.currentWorkspace === 'forecast' && workspaceManager.forecastManager) {
            const leadH = Math.min(48, Math.max(0, Math.round((val / 21600) * 48)));
            workspaceManager.seekForecastLeadTime(leadH);
        }
        
        updateTelemetry();
    }

    // Timeline Scrubber Interaction with physically valid hydrodynamic time-seeking
    timelineScrubber.addEventListener('mousedown', () => {
        isScrubbing = true;
        setPlayState(false); // Pause forward loop during manual scrubbing so user can scrub backward cleanly
    });
    timelineScrubber.addEventListener('touchstart', () => {
        isScrubbing = true;
        setPlayState(false);
    }, { passive: true });
    timelineScrubber.addEventListener('input', (e) => {
        isScrubbing = true;
        applyScrubberTime(parseFloat(e.target.value));
    });
    timelineScrubber.addEventListener('change', (e) => {
        isScrubbing = false;
        applyScrubberTime(parseFloat(e.target.value));
    });
    window.addEventListener('mouseup', () => {
        if (isScrubbing) {
            isScrubbing = false;
        }
    });

    // Step -10m and +10m Buttons (Instant 600-second timeline jumps)
    const btnStepBack = document.getElementById('btn-step-back');
    const btnStepFwd = document.getElementById('btn-step-fwd');
    if (btnStepBack) {
        btnStepBack.addEventListener('click', () => {
            setPlayState(false);
            const target = Math.max(0, simulator.totalSimTime - 600);
            applyScrubberTime(target);
        });
    }
    if (btnStepFwd) {
        btnStepFwd.addEventListener('click', () => {
            setPlayState(false);
            const target = Math.min(21600, simulator.totalSimTime + 600);
            applyScrubberTime(target);
        });
    }

    // Citizen Evidence Submission Modal Wiring
    const btnOpenSubmitEvidence = document.getElementById('btn-open-submit-evidence');
    const evidenceSubmitModal = document.getElementById('evidence-submit-modal');
    const btnCloseEvidenceModal = document.getElementById('btn-close-evidence-modal');
    const btnCancelEvidence = document.getElementById('btn-cancel-evidence');
    const evidenceSubmitForm = document.getElementById('evidence-submit-form');
    const btnObsUsePin = document.getElementById('btn-obs-use-pin');

    if (btnOpenSubmitEvidence && evidenceSubmitModal) {
        btnOpenSubmitEvidence.addEventListener('click', () => {
            evidenceSubmitModal.showModal();
        });
    }
    const closeEvidenceModal = () => {
        if (evidenceSubmitModal) evidenceSubmitModal.close();
    };
    if (btnCloseEvidenceModal) btnCloseEvidenceModal.addEventListener('click', closeEvidenceModal);
    if (btnCancelEvidence) btnCancelEvidence.addEventListener('click', closeEvidenceModal);

    if (btnObsUsePin) {
        btnObsUsePin.addEventListener('click', () => {
            if (selectedInspectUV) {
                const latInput = document.getElementById('obs-lat');
                const lonInput = document.getElementById('obs-lon');
                const titleInput = document.getElementById('obs-title');
                if (latInput) latInput.value = selectedInspectUV.lat.toFixed(4);
                if (lonInput) lonInput.value = selectedInspectUV.lon.toFixed(4);
                if (titleInput && selectedInspectUV.street) titleInput.value = `${selectedInspectUV.street} Observation`;
            } else {
                alert('Click anywhere on the 3D map first to pin a location.');
            }
        });
    }

    if (evidenceSubmitForm) {
        evidenceSubmitForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('obs-title')?.value || 'Field Observation';
            const category = document.getElementById('obs-category')?.value || 'water_depth';
            const depthM = parseFloat(document.getElementById('obs-depth')?.value || '0.25');
            const lat = parseFloat(document.getElementById('obs-lat')?.value || '52.3538');
            const lon = parseFloat(document.getElementById('obs-lon')?.value || '-7.7032');
            const notes = document.getElementById('obs-desc')?.value || '';
            const observer = document.getElementById('obs-observer')?.value || 'Clonmel Citizen';

            workspaceManager.evidenceManager.submitReport({
                title,
                category,
                depthM,
                lat,
                lon,
                notes,
                observer
            });

            closeEvidenceModal();
            evidenceSubmitForm.reset();
            workspaceManager.updateEvidenceView();
        });
    }

    // Milestone Scrubber Buttons
    document.querySelectorAll('.milestone-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseFloat(btn.dataset.time);
            applyScrubberTime(val);
            document.querySelectorAll('.milestone-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Speed Controls: 60x, 300x, 900x, Max
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playbackSpeed = parseInt(btn.dataset.speed, 10);
        });
    });
    
    // 8 Calibrated Camera Vantage Presets for In-Depth 3D Model Inspection
    const cameraVantages = [
        { 
            id: 'overview',
            name: 'Overview', 
            fullName: 'Overview (Wide Suir Basin)',
            sub: 'Full 3D Valley & Suir Catchment',
            pos: new THREE.Vector3(-150, 720, 1050), 
            target: new THREE.Vector3(0, 25, 170) 
        },
        { 
            id: 'quay',
            name: 'The Quay', 
            fullName: 'The Quay & Riverfront',
            sub: 'Quayside Walls & Urban Overtopping',
            pos: new THREE.Vector3(-60, 180, 420), 
            target: new THREE.Vector3(122, 22, 78) 
        },
        { 
            id: 'old-bridge',
            name: 'Old Bridge', 
            fullName: 'Old Bridge (Droichead Ársa)',
            sub: 'Historic Multi-Arch Bridge & Suir Island',
            pos: new THREE.Vector3(-140, 140, 540), 
            target: new THREE.Vector3(55, 23, 340) 
        },
        { 
            id: 'suir-island',
            name: 'Suir Island', 
            fullName: 'Suir Island Bifurcation',
            sub: 'North/South Channels & Barriers',
            pos: new THREE.Vector3(-50, 210, 600), 
            target: new THREE.Vector3(54, 20, 278) 
        },
        { 
            id: 'town-centre',
            name: 'Town Centre', 
            fullName: 'Town Centre & Market St',
            sub: 'O\'Connell St Commercial District',
            pos: new THREE.Vector3(34, 300, 320), 
            target: new THREE.Vector3(34, 25, -111) 
        },
        { 
            id: 'gashouse',
            name: 'Gashouse Bridge', 
            fullName: 'Gashouse Bridge & East Outflow',
            sub: 'Downstream Bend & Floodplain Exit',
            pos: new THREE.Vector3(660, 240, 560), 
            target: new THREE.Vector3(817, 20, 189) 
        },
        { 
            id: 'bypass',
            name: 'N24 Bypass', 
            fullName: 'North Slopes & N24 Bypass',
            sub: 'Regional Arterial Evacuation Route',
            pos: new THREE.Vector3(0, 520, 250), 
            target: new THREE.Vector3(0, 35, -500) 
        },
        { 
            id: 'top-down',
            name: 'Top-Down 2D', 
            fullName: 'Tactical Top-Down (2D Map)',
            sub: 'Orthogonal Plan GIS Risk Map',
            pos: new THREE.Vector3(0, 1550, 160), 
            target: new THREE.Vector3(0, 20, 160) 
        }
    ];

    // Camera Vantage UI Elements
    const btnCameraMenu = document.getElementById('btn-camera-menu');
    const cameraDropdown = document.getElementById('camera-views-dropdown');
    const currentVantageLabel = document.getElementById('current-vantage-label');
    const viewsDropdownList = document.getElementById('views-dropdown-list');
    const cameraHudToast = document.getElementById('camera-hud-toast');
    const cameraHudText = document.getElementById('camera-hud-text');
    let toastTimeout = null;

    function showCameraToast(text) {
        if (!cameraHudToast || !cameraHudText) return;
        cameraHudText.textContent = text;
        cameraHudToast.classList.remove('hidden');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            cameraHudToast.classList.add('hidden');
        }, 2400);
    }

    function triggerCameraTransition(index) {
        cameraVantageIndex = (index + cameraVantages.length) % cameraVantages.length;
        const v = cameraVantages[cameraVantageIndex];
        
        if (currentVantageLabel) currentVantageLabel.textContent = v.name;
        if (viewsDropdownList) {
            viewsDropdownList.querySelectorAll('.view-dropdown-item').forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.index, 10) === cameraVantageIndex);
            });
        }
        showCameraToast(`View ${cameraVantageIndex + 1}/8: ${v.fullName}`);

        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const startTime = performance.now();
        const duration = 1000;
        
        tweenCamera = () => {
            const elapsed = performance.now() - startTime;
            const p = Math.min(1.0, elapsed / duration);
            const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            
            camera.position.lerpVectors(startPos, v.pos, ease);
            controls.target.lerpVectors(startTarget, v.target, ease);
            controls.update();
            
            if (p >= 1.0) {
                tweenCamera = null;
            }
        };
    }

    // Populate Camera Dropdown List
    if (viewsDropdownList) {
        viewsDropdownList.innerHTML = cameraVantages.map((v, i) => `
            <button class="view-dropdown-item ${i === 0 ? 'active' : ''}" data-index="${i}">
                <div class="item-left">
                    <span class="item-name">${v.fullName}</span>
                    <span class="item-sub">${v.sub}</span>
                </div>
                <span class="item-key-badge">${i + 1}</span>
            </button>
        `).join('');

        viewsDropdownList.querySelectorAll('.view-dropdown-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                triggerCameraTransition(idx);
                if (cameraDropdown) cameraDropdown.classList.add('hidden');
                if (btnCameraMenu) btnCameraMenu.classList.remove('open');
            });
        });
    }

    if (btnCameraMenu && cameraDropdown) {
        btnCameraMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = cameraDropdown.classList.toggle('hidden');
            btnCameraMenu.classList.toggle('open', !isHidden);
        });

        document.addEventListener('click', (e) => {
            if (!cameraDropdown.contains(e.target) && !btnCameraMenu.contains(e.target)) {
                cameraDropdown.classList.add('hidden');
                btnCameraMenu.classList.remove('open');
            }
        });
    }
    
    if (btnHomeView) {
        btnHomeView.addEventListener('click', () => {
            triggerCameraTransition(0);
        });
    }

    if (btnCycleCamera) {
        btnCycleCamera.addEventListener('click', () => {
            triggerCameraTransition(cameraVantageIndex + 1);
        });
    }

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', () => {
            // Toggle between Top-Down (index 7) and Overview (0)
            triggerCameraTransition(cameraVantageIndex === 7 ? 0 : 7);
        });
    }

    // Keyboard Shortcuts for Instant Camera Switching & Playback
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 8) {
            triggerCameraTransition(num - 1);
        } else if (e.key === 'c' || e.key === 'C') {
            triggerCameraTransition(cameraVantageIndex + 1);
        } else if (e.key === 'h' || e.key === 'H') {
            triggerCameraTransition(0);
        } else if (e.key === 't' || e.key === 'T') {
            triggerCameraTransition(cameraVantageIndex === 7 ? 0 : 7);
        } else if (e.code === 'Space') {
            e.preventDefault();
            setPlayState(!isPlaying);
        }
    });

    if (btnTogglePanels) {
        btnTogglePanels.addEventListener('click', () => {
            const isHidden = controlsPanel.classList.toggle('panel-hidden');
            readoutsPanel.classList.toggle('panel-hidden');
            btnTogglePanels.classList.toggle('active', !isHidden);
        });
    }
    
    // In-Scene Floating Landmark Labels
    const worldLabels = [
        { el: document.getElementById('label-gashouse'), lon: -7.6930, lat: 52.3528, yOffset: 25 },
        { el: document.getElementById('label-suir-island'), lon: -7.7042, lat: 52.3520, yOffset: 25 },
        { el: document.getElementById('label-the-quay'), lon: -7.7032, lat: 52.3538, yOffset: 25 },
        { el: document.getElementById('label-old-bridge'), lon: -7.7041, lat: 52.3514, yOffset: 25 },
        { el: document.getElementById('label-sarsfield'), lon: -7.7050, lat: 52.3558, yOffset: 30 }
    ];
    
    function updateWorldLabels() {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        for (let item of worldLabels) {
            if (!item.el) continue;
            const u = (item.lon - meta.bbox.west) / (meta.bbox.east - meta.bbox.west);
            const v = (item.lat - meta.bbox.south) / (meta.bbox.north - meta.bbox.south);
            const wx = (u - 0.5) * meta.width_m;
            const wz = -(v - 0.5) * meta.height_m;
            
            const gx = Math.min(meta.grid_w - 1, Math.max(0, Math.floor(u * meta.grid_w)));
            const gy = Math.min(meta.grid_h - 1, Math.max(0, Math.floor((1.0 - v) * meta.grid_h)));
            const elev = elevArray[gy * meta.grid_w + gx] || 18.0;
            const wy = elev * 1.2 + item.yOffset;
            
            const pos = new THREE.Vector3(wx, wy, wz);
            pos.project(camera);
            
            if (pos.z < 1.0 && pos.x >= -1.05 && pos.x <= 1.05 && pos.y >= -1.05 && pos.y <= 1.05) {
                item.el.style.display = 'flex';
                const screenX = (pos.x * 0.5 + 0.5) * width;
                const screenY = (-pos.y * 0.5 + 0.5) * height;
                item.el.style.left = `${screenX}px`;
                item.el.style.top = `${screenY}px`;
            } else {
                item.el.style.display = 'none';
            }
        }
    }
    
    // Live Mouse Move for Interactive Barrier Rubber-Band Preview
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawingMode) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        
        if (intersects.length > 0) {
            const pt = intersects[0].point;
            cursorRing.visible = true;
            cursorRing.position.set(pt.x, pt.y + 0.25, pt.z);
            
            if (currentDrawingWorldPoints.length > 0) {
                const lastW = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                const posAttr = rubberBandLine.geometry.attributes.position;
                posAttr.setXYZ(0, lastW.x, lastW.y + 0.6, lastW.z);
                posAttr.setXYZ(1, pt.x, pt.y + 0.6, pt.z);
                posAttr.needsUpdate = true;
                rubberBandLine.visible = true;
                
                const segDist = Math.hypot(pt.x - lastW.x, pt.z - lastW.z);
                const currentTotal = totalDrawnLengthMeters + segDist;
                if (hudLengthCount) hudLengthCount.textContent = `${currentTotal.toFixed(1)} m`;
            }
        } else {
            cursorRing.visible = false;
            rubberBandLine.visible = false;
        }
    });

    // Click for Depth Inspection & Interactive Barrier Placement
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        // If in Drawing Mode
        if (isDrawingMode) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
            const intersects = raycaster.intersectObject(terrainMesh);
            
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Minimum distance check to prevent duplicate points on same pixel
                if (currentDrawingWorldPoints.length > 0) {
                    const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                    const dist = Math.hypot(pt.x - lastPt.x, pt.z - lastPt.z);
                    if (dist < 0.8) return;
                    totalDrawnLengthMeters += dist;
                }
                
                const u = (pt.x / meta.width_m) + 0.5;
                const v = -(pt.z / meta.height_m) + 0.5;
                const lon = meta.bbox.west + u * (meta.bbox.east - meta.bbox.west);
                const lat = meta.bbox.south + v * (meta.bbox.north - meta.bbox.south);
                
                currentDrawingPoints.push([lon, lat]);
                currentDrawingWorldPoints.push(new THREE.Vector3(pt.x, pt.y, pt.z));
                
                // Add glowing marker sphere at placed point
                const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;
                const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);
                markerMesh.position.set(pt.x, pt.y + 0.6, pt.z);
                drawingGroup.add(markerMesh);
                drawnVertexMeshes.push(markerMesh);
                
                const count = currentDrawingPoints.length;
                if (drawVertexCount) drawVertexCount.textContent = count;
                if (hudVertexCount) hudVertexCount.textContent = count;
                if (hudLengthCount) hudLengthCount.textContent = `${totalDrawnLengthMeters.toFixed(1)} m`;
                return;
            }
        }
        
        // If in Defence Monitor Workspace: check if user clicked on a 3D defence asset
        if (AppState.currentWorkspace === 'defences' && workspaceManager.defenceManager) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
            const picked = workspaceManager.defenceManager.layer3D.pickAsset(raycaster);
            if (picked) {
                workspaceManager.defenceManager.selectAsset(picked.id);
                return;
            }
        }
        
        // Default: Click for Depth Inspection
        const hit = inspector.inspectAt(e, canvas);
        if (hit) {
            selectedInspectUV = { u: hit.u, v: hit.v, street: hit.street, lon: hit.lon, lat: hit.lat };
            readoutCoords.textContent = `${hit.lat.toFixed(4)}°N, ${Math.abs(hit.lon).toFixed(4)}°W`;
            const hydroName = document.getElementById('hydrograph-pt-name');
            if (hydroName) hydroName.textContent = hit.street || 'Selected Point';
        }
    });

    // Double-click finishes the barrier
    canvas.addEventListener('dblclick', (e) => {
        if (isDrawingMode && currentDrawingPoints.length >= 2) {
            e.preventDefault();
            commitDrawnBarrier();
        }
    });

    // Right-click cancels drawing mode
    canvas.addEventListener('contextmenu', (e) => {
        if (isDrawingMode) {
            e.preventDefault();
            stopDrawingMode();
        }
    });

    // Keydown shortcuts: Escape to cancel, Enter to commit
    window.addEventListener('keydown', (e) => {
        if (!isDrawingMode) return;
        if (e.key === 'Escape') {
            stopDrawingMode();
        } else if (e.key === 'Enter') {
            if (currentDrawingPoints.length >= 2) {
                commitDrawnBarrier();
            }
        }
    });
    
    document.getElementById('inspect-close').addEventListener('click', () => {
        inspector.hide();
    });
    
    // Export Depth Map
    btnExportMap.addEventListener('click', () => {
        exportPeakDepthMap(simulator, meta, bldgsResp, roadsResp, activeScenarioTag.textContent);
    });
    
    // Resize Listener
    window.addEventListener('resize', () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    });
    
    // 5. Animation and Simulation Loop
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = performance.now();
    let readbackCounter = 0;
    
    function animate(now) {
        requestAnimationFrame(animate);
        
        const dtReal = (now - lastTime) / 1000.0;
        lastTime = now;
        
        // FPS Measurement
        frameCount++;
        if (now - lastFpsUpdate >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            if (fpsCounter) fpsCounter.textContent = `${fps} FPS`;
            frameCount = 0;
            lastFpsUpdate = now;
        }
        
        // Camera Tween
        if (tweenCamera) {
            tweenCamera();
        }
        
        // Simulation Sub-stepping
        if (isPlaying) {
            const speedMultiplier = playbackSpeed / 20.0;
            simulator.step(speedMultiplier);
            
            if (isSideBySide || AppState.currentWorkspace === 'intervention') {
                baselineSimulator.step(speedMultiplier);
            }
        }
        
        // Readback for Analytics & Readouts (every 6 frames ~ 10Hz)
        readbackCounter++;
        if (readbackCounter % 6 === 0) {
            updateTelemetry();
            
            // Flood Clock & Scrubber sync
            const simSec = simulator.totalSimTime;
            const totalHours = Math.floor(simSec / 3600);
            const totalMins = Math.floor((simSec % 3600) / 60);
            floodClockText.textContent = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
            
            const progressPct = Math.min(100, (simSec / 21600) * 100);
            if (timelineProgressFill) timelineProgressFill.style.width = `${progressPct}%`;
            if (scrubberKnob) scrubberKnob.style.left = `${progressPct}%`;
            if (timelineScrubber && !isScrubbing) timelineScrubber.value = simSec;
        }
        
        // Animated water shader uniforms
        waterMaterial.uniforms.u_time.value = now * 0.001;
        waterMaterial.uniforms.u_waterTex.value = simulator.getWaterTexture();
        
        // 3D Landmark Labels
        updateWorldLabels();
        
        // Controls & Render
        controls.update();
        renderer.render(scene, camera);
    }
    
    // Start with 1-in-100-year flood
    applyScenario('flood100');
    
    // Start animation loop
    animate(performance.now());
    console.log('Hydroverse Clonmel Flood Simulator is running smoothly!');
}

window.addEventListener('DOMContentLoaded', init);
