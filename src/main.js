import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SWESimulator } from './simulation/swe_solver.js';
import { createTerrainMesh, createWaterMesh } from './rendering/terrain.js';
import { createBuildingsLayer } from './rendering/buildings.js';
import { createRoadsLayer } from './rendering/roads.js';
import { createBarriersManager } from './rendering/barriers.js';
import { createInspector } from './ui/inspector.js';
import { exportPeakDepthMap } from './ui/export_map.js';
import { initHydroverseHero } from './ui/hydroverse_hero.js';

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
    
    // Barriers Manager
    const barriersManager = createBarriersManager(scene, meta, simulator, elevArray);
    barriersManager.loadPresets(presetsResp);
    
    // Inspector
    const inspector = createInspector(camera, terrainMesh, simulator, meta, elevArray, roadsResp);
    scene.add(inspector.pinGroup);
    
    // 4. State Management
    let isPlaying = true;
    let playbackSpeed = 300; // default 300x for fast fluid feedback
    let activeMode = 'live'; // 'live', 'barrier', 'compare'
    let isSideBySide = false;
    let currentScenario = 'flood100';
    let tweenCamera = null;
    let cameraVantageIndex = 0;
    let activeBarrierTool = 'wall';
    let pendingBarrierPoint = null;
    
    // UI Elements - Hero Section
    const heroSection = document.getElementById('hero-section');
    const btnHeroLaunch = document.getElementById('btn-hero-launch');
    const btnHeroLaunchCta = document.getElementById('btn-hero-launch-cta');
    const btnBackHero = document.getElementById('btn-back-hero');
    const heroBg = initHydroverseHero();
    
    const launchSimulation = () => {
        if (heroSection) heroSection.classList.add('hidden');
    };
    if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', launchSimulation);
    if (btnHeroLaunchCta) btnHeroLaunchCta.addEventListener('click', launchSimulation);
    if (btnBackHero && heroSection) {
        btnBackHero.addEventListener('click', () => {
            heroSection.classList.remove('hidden');
        });
    }
    
    // Top Tabs & Panels
    const tabLive = document.getElementById('tab-live');
    const tabBarrier = document.getElementById('tab-barrier');
    const tabCompare = document.getElementById('tab-compare');
    const scenarioControlsView = document.getElementById('scenario-controls-view');
    const barrierStudioView = document.getElementById('barrier-studio-view');
    const sideBySideOverlay = document.getElementById('side-by-side-overlay');
    
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
    
    // Mode Navigation: Live, Barrier, Compare
    function setMode(mode) {
        activeMode = mode;
        pendingBarrierPoint = null;
        tabLive.classList.toggle('active', mode === 'live');
        tabBarrier.classList.toggle('active', mode === 'barrier');
        tabCompare.classList.toggle('active', mode === 'compare');
        
        if (mode === 'live') {
            isSideBySide = false;
            scenarioControlsView.classList.remove('hidden');
            barrierStudioView.classList.add('hidden');
            sideBySideOverlay.classList.add('hidden');
        } else if (mode === 'barrier') {
            isSideBySide = false;
            scenarioControlsView.classList.add('hidden');
            barrierStudioView.classList.remove('hidden');
            sideBySideOverlay.classList.add('hidden');
            if (barriersManager.barriers.length === 0) {
                barriersManager.loadPresets(presetsResp);
            }
            updateBarrierUI();
        } else if (mode === 'compare') {
            isSideBySide = true;
            scenarioControlsView.classList.remove('hidden');
            barrierStudioView.classList.add('hidden');
            sideBySideOverlay.classList.remove('hidden');
            if (barriersManager.barriers.length === 0) {
                barriersManager.loadPresets(presetsResp);
            }
            updateBarrierUI();
        }
    }
    
    tabLive.addEventListener('click', () => setMode('live'));
    tabBarrier.addEventListener('click', () => setMode('barrier'));
    tabCompare.addEventListener('click', () => setMode('compare'));
    
    function updateBarrierUI() {
        const count = barriersManager.barriers.length;
        const totalLen = barriersManager.getTotalLength();
        if (statBarrierLength) {
            statBarrierLength.textContent = `${totalLen.toLocaleString()} m`;
        }
        if (barrierStatusText) {
            if (count > 0) {
                barrierStatusText.className = 'status-pill-green';
                barrierStatusText.style.background = 'rgba(16, 185, 129, 0.2)';
                barrierStatusText.style.color = '#34d399';
                barrierStatusText.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                barrierStatusText.textContent = `${count} BARRIER${count > 1 ? 'S' : ''}`;
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
        pendingBarrierPoint = null;
        [btnToolWall, btnToolSandbags, btnToolPreset].forEach(b => {
            if (b) b.classList.toggle('active', b.dataset.tool === tool);
        });
        
        if (tool === 'wall') {
            if (statBarrierHeight) statBarrierHeight.textContent = '2.80 m';
        } else if (tool === 'sandbags') {
            if (statBarrierHeight) statBarrierHeight.textContent = '1.20 m';
        } else if (tool === 'preset') {
            barriersManager.loadPresets(presetsResp);
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
            pendingBarrierPoint = null;
            updateBarrierUI();
        });
    }
    
    if (btnClearBarriers) {
        btnClearBarriers.addEventListener('click', () => {
            barriersManager.clearAll();
            pendingBarrierPoint = null;
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
        inspector.hide();
        pendingBarrierPoint = null;
        updateBarrierUI();
        if (timelineProgressFill) timelineProgressFill.style.width = '0%';
        if (scrubberKnob) scrubberKnob.style.left = '0%';
        if (floodClockText) floodClockText.textContent = '00:00';
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

    // Timeline Scrubber Interaction
    timelineScrubber.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        simulator.totalSimTime = val;
        baselineSimulator.totalSimTime = val;
        const pct = Math.min(100, (val / 21600) * 100);
        timelineProgressFill.style.width = `${pct}%`;
        if (scrubberKnob) scrubberKnob.style.left = `${pct}%`;
        const totalHours = Math.floor(val / 3600);
        const totalMins = Math.floor((val % 3600) / 60);
        floodClockText.textContent = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
    });

    // Speed Controls: 60x, 300x, 900x, Max
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playbackSpeed = parseInt(btn.dataset.speed, 10);
        });
    });
    
    // Camera Vantage Presets
    const cameraVantages = [
        { name: 'Overview', pos: new THREE.Vector3(-200, 750, 1100), target: new THREE.Vector3(0, 30, 0) },
        { name: 'Old Bridge', pos: new THREE.Vector3(-360, 240, 420), target: new THREE.Vector3(-120, 20, 180) },
        { name: 'Town Centre', pos: new THREE.Vector3(80, 340, 520), target: new THREE.Vector3(30, 25, 60) },
        { name: 'Top-Down', pos: new THREE.Vector3(0, 1500, 50), target: new THREE.Vector3(0, 20, 50) }
    ];
    
    function triggerCameraTransition(index) {
        cameraVantageIndex = index % cameraVantages.length;
        const v = cameraVantages[cameraVantageIndex];
        
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
            // Toggle between 3D overview (0) and Top-Down ordnance (3)
            triggerCameraTransition(cameraVantageIndex === 3 ? 0 : 3);
        });
    }

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
        { el: document.getElementById('label-old-bridge'), lon: -7.7075, lat: 52.3516, yOffset: 25 },
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
    
    // Click for Depth Inspection & Interactive Barrier Placement
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        // If in Barrier mode and drawing tool is active (wall or sandbags)
        if (activeMode === 'barrier' && (activeBarrierTool === 'wall' || activeBarrierTool === 'sandbags')) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
            const intersects = raycaster.intersectObject(terrainMesh);
            
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Convert world (pt.x, pt.z) to lon, lat
                const u = (pt.x / meta.width_m) + 0.5;
                const v = -(pt.z / meta.height_m) + 0.5;
                const lon = meta.bbox.west + u * (meta.bbox.east - meta.bbox.west);
                const lat = meta.bbox.south + v * (meta.bbox.north - meta.bbox.south);
                
                if (!pendingBarrierPoint) {
                    pendingBarrierPoint = [lon, lat];
                } else {
                    const height = activeBarrierTool === 'wall' ? 2.8 : 1.2;
                    const toolName = activeBarrierTool === 'wall' ? 'Demountable Wall' : 'Sandbag Bund';
                    barriersManager.addBarrierPolyline([pendingBarrierPoint, [lon, lat]], activeBarrierTool, height, toolName);
                    pendingBarrierPoint = [lon, lat];
                    updateBarrierUI();
                }
                return;
            }
        }
        
        // Default: Click for Depth Inspection
        const hit = inspector.inspectAt(e, canvas);
        if (hit) {
            selectedInspectUV = { u: hit.u, v: hit.v, street: hit.street, lon: hit.lon, lat: hit.lat };
            readoutCoords.textContent = `${hit.lat.toFixed(4)}°N, ${Math.abs(hit.lon).toFixed(4)}°W`;
        }
    });

    // Right click cancels ongoing drawing polyline
    canvas.addEventListener('contextmenu', (e) => {
        if (activeMode === 'barrier') {
            e.preventDefault();
            pendingBarrierPoint = null;
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
            
            if (isSideBySide) {
                baselineSimulator.step(speedMultiplier);
            }
        }
        
        // Readback for Analytics & Readouts (every 6 frames ~ 10Hz)
        readbackCounter++;
        if (readbackCounter % 6 === 0) {
            simulator.updateReadback();
            if (isSideBySide) {
                baselineSimulator.updateReadback();
            }
            
            // Building flood status
            const bldgStats = buildingsLayer.updateFloodStatus(simulator, baselineSimulator, isSideBySide);
            const floodedNow = bldgStats.floodedCount;
            const savedNow = bldgStats.savedCount;
            const unmitigatedNow = floodedNow + savedNow;
            
            statFloodedBldgs.textContent = floodedNow.toLocaleString();
            if (statEndangeredBldgs) statEndangeredBldgs.textContent = bldgStats.endangeredCount.toLocaleString();
            if (statPartialBldgs) statPartialBldgs.textContent = bldgStats.partialCount.toLocaleString();
            statSavedBldgs.textContent = savedNow.toLocaleString();
            
            // Road Network Cutoffs
            const roadStats = roadsLayer.updateRoadCutoffs(simulator);
            statRoadsCutoff.textContent = roadStats.cutoffCount;
            roadsCountBadge.textContent = roadStats.cutoffCount;
            
            if (roadStats.cutoffCount === 0) {
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
                roadsList.innerHTML = roadStats.cutoffList.slice(0, 5).map(r => `
                    <div class="road-entry hazard">
                        <span class="r-name">${r.name}${r.bridge ? ' (Bridge)' : ''}</span>
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
            }
            
            // Sample Peak Town Depth
            const sampleQuay = simulator.samplePoint(0.53, 0.44);
            statPeakDepth.textContent = `${sampleQuay.peak_h.toFixed(2)} m`;
            
            // Side-by-Side overlay stats: Rigorous comparison between Unmitigated Baseline and Protected
            if (isSideBySide) {
                if (sbsUnmitFlooded) sbsUnmitFlooded.textContent = unmitigatedNow.toLocaleString();
                if (sbsUnmitRoads) sbsUnmitRoads.textContent = `${roadStats.cutoffCount} roads`;
                if (sbsUnmitDepth) sbsUnmitDepth.textContent = `${sampleQuay.peak_h.toFixed(2)} m`;
                
                if (sbsSavedBldgs) sbsSavedBldgs.textContent = savedNow.toLocaleString();
                if (sbsProtectRate) {
                    const rate = unmitigatedNow > 0 ? ((savedNow / Math.max(1, unmitigatedNow)) * 100).toFixed(1) : '100.0';
                    sbsProtectRate.textContent = `${rate}% Protected`;
                }
            }
            
            // Flood Clock & Scrubber (Matches User Reference Image 4: 00:00 of 06:00 simulated)
            const simSec = simulator.totalSimTime;
            const totalHours = Math.floor(simSec / 3600);
            const totalMins = Math.floor((simSec % 3600) / 60);
            floodClockText.textContent = `${String(totalHours).padStart(2, '0')}:${String(totalMins).padStart(2, '0')}`;
            
            const progressPct = Math.min(100, (simSec / 21600) * 100);
            timelineProgressFill.style.width = `${progressPct}%`;
            if (scrubberKnob) scrubberKnob.style.left = `${progressPct}%`;
            timelineScrubber.value = simSec;
            
            // Update floating inspector
            inspector.updateInspectCard();
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
