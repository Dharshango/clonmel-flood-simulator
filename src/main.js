import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SWESimulator } from './simulation/swe_solver.js';
import { createTerrainMesh, createWaterMesh } from './rendering/terrain.js';
import { createBuildingsLayer } from './rendering/buildings.js';
import { createRoadsLayer } from './rendering/roads.js';
import { createBarriersManager } from './rendering/barriers.js';
import { createInspector } from './ui/inspector.js';
import { exportPeakDepthMap } from './ui/export_map.js';

async function init() {
    console.log('Initializing Free Board (Clonmel, River Suir)...');
    
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
    scene.background = new THREE.Color(0x080b12);
    scene.fog = new THREE.FogExp2(0x080b12, 0.00035);
    
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
    const buildingsLayer = createBuildingsLayer(meta, bldgsResp, elevArray);
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
    
    // UI Elements
    const tabLive = document.getElementById('tab-live');
    const tabBarrier = document.getElementById('tab-barrier');
    const tabCompare = document.getElementById('tab-compare');
    const sideBySideOverlay = document.getElementById('side-by-side-overlay');
    const sbsLeftStat = document.getElementById('sbs-left-stat');
    const sbsRightStat = document.getElementById('sbs-right-stat');
    
    const activeScenarioTag = document.getElementById('active-scenario-tag');
    const sliderInflow = document.getElementById('slider-inflow');
    const valInflow = document.getElementById('val-inflow');
    const sliderRain = document.getElementById('slider-rain');
    const valRain = document.getElementById('val-rain');
    const sliderSurge = document.getElementById('slider-surge');
    const valSurge = document.getElementById('val-surge');
    
    const btnToggleWall = document.getElementById('btn-toggle-wall');
    const btnClearBarriers = document.getElementById('btn-clear-barriers');
    const barrierStatusText = document.getElementById('barrier-status-text');
    
    // Readouts
    const readoutStreet = document.getElementById('readout-street');
    const readoutDepthVal = document.getElementById('readout-depth-val');
    const readoutHazardTag = document.getElementById('readout-hazard-tag');
    const readoutElev = document.getElementById('readout-elev');
    const readoutFlow = document.getElementById('readout-flow');
    const readoutCoords = document.getElementById('readout-coords');
    
    const statFloodedBldgs = document.getElementById('stat-flooded-bldgs');
    const statRoadsCutoff = document.getElementById('stat-roads-cutoff');
    const statSavedBldgs = document.getElementById('stat-saved-bldgs');
    const statPeakDepth = document.getElementById('stat-peak-depth');
    const roadsCountBadge = document.getElementById('roads-count-badge');
    const roadsList = document.getElementById('roads-list');
    const btnExportMap = document.getElementById('btn-export-map');
    
    // Bottom Bar
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const btnReset = document.getElementById('btn-reset');
    const floodClockText = document.getElementById('flood-clock-text');
    const timelineProgressFill = document.getElementById('timeline-progress-fill');
    const timelineScrubber = document.getElementById('timeline-scrubber');
    const btnCycleCamera = document.getElementById('btn-cycle-camera');
    const fpsCounter = document.getElementById('fps-counter');
    
    // Selected Inspection Point (defaults to Quay Street)
    let selectedInspectUV = { u: 0.53, v: 0.44, street: 'The Quay / Quay Street' };
    
    // Mode Navigation: Live, Barrier, Compare
    function setMode(mode) {
        activeMode = mode;
        tabLive.classList.toggle('active', mode === 'live');
        tabBarrier.classList.toggle('active', mode === 'barrier');
        tabCompare.classList.toggle('active', mode === 'compare');
        
        if (mode === 'live') {
            isSideBySide = false;
            sideBySideOverlay.classList.add('hidden');
        } else if (mode === 'barrier') {
            isSideBySide = false;
            sideBySideOverlay.classList.add('hidden');
            barriersManager.loadPresets(presetsResp);
            updateBarrierUI();
        } else if (mode === 'compare') {
            isSideBySide = true;
            sideBySideOverlay.classList.remove('hidden');
            barriersManager.loadPresets(presetsResp);
            updateBarrierUI();
        }
    }
    
    tabLive.addEventListener('click', () => setMode('live'));
    tabBarrier.addEventListener('click', () => setMode('barrier'));
    tabCompare.addEventListener('click', () => setMode('compare'));
    
    function updateBarrierUI() {
        const hasBarriers = (barriersManager.activeBarriers && barriersManager.activeBarriers.length > 0);
        if (hasBarriers) {
            barrierStatusText.className = 'status-pill-green';
            barrierStatusText.textContent = 'ACTIVE';
        } else {
            barrierStatusText.className = 'status-pill-green';
            barrierStatusText.style.background = 'rgba(239, 68, 68, 0.2)';
            barrierStatusText.style.color = '#f87171';
            barrierStatusText.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            barrierStatusText.textContent = 'NONE';
        }
    }
    
    btnToggleWall.addEventListener('click', () => {
        barriersManager.loadPresets(presetsResp);
        updateBarrierUI();
    });
    
    btnClearBarriers.addEventListener('click', () => {
        barriersManager.clearAll();
        updateBarrierUI();
    });
    
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
    
    btnReset.addEventListener('click', () => {
        simulator.reset();
        baselineSimulator.reset();
        barriersManager.loadPresets(presetsResp);
        inspector.hide();
        updateBarrierUI();
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
    
    btnCycleCamera.addEventListener('click', () => {
        triggerCameraTransition(cameraVantageIndex + 1);
    });
    
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
    
    // Click for Depth Inspection
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const hit = inspector.inspectAt(e, canvas);
        if (hit) {
            selectedInspectUV = { u: hit.u, v: hit.v, street: hit.street, lon: hit.lon, lat: hit.lat };
            readoutCoords.textContent = `${hit.lat.toFixed(4)}°N, ${Math.abs(hit.lon).toFixed(4)}°W`;
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
            fpsCounter.textContent = `${fps} FPS`;
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
            
            // Side-by-Side overlay stats
            if (isSideBySide) {
                sbsLeftStat.textContent = `Flooded: ${unmitigatedNow} Buildings`;
                sbsRightStat.textContent = `Saved: ${savedNow} (${((savedNow / Math.max(1, unmitigatedNow)) * 100).toFixed(1)}% Safe)`;
            }
            
            // Flood Clock & Scrubber
            const simSec = simulator.totalSimTime;
            const simHrs = (simSec / 3600).toFixed(1);
            floodClockText.textContent = `T + ${simHrs} hrs`;
            
            const progressPct = Math.min(100, (simSec / 86400) * 100);
            timelineProgressFill.style.width = `${progressPct}%`;
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
    console.log('Free Board Clonmel Flood Simulator is running smoothly!');
}

window.addEventListener('DOMContentLoaded', init);
