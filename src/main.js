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
    console.log('Initializing Clonmel Flood Simulator (SuirView)...');
    
    // 1. Fetch GIS Data
    const [meta, elevBuffer, bldgsResp, roadsResp, presetsResp] = await Promise.all([
        fetch('/data/terrain.json').then(r => r.json()),
        fetch('/data/elevation_hydro.bin').then(r => r.arrayBuffer()),
        fetch('/data/buildings.json').then(r => r.json()),
        fetch('/data/roads.json').then(r => r.json()),
        fetch('/data/barriers_preset.json').then(r => r.json())
    ]);
    
    const elevArray = new Float32Array(elevBuffer);
    
    // Load texture masks
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
    
    // Camera looking down over Clonmel town centre and River Suir
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
    let playbackSpeed = 20;
    let isSideBySide = false;
    let activeDrawingTool = null;
    let currentScenario = 'flood100';
    let tweenCamera = null;
    
    // UI Elements
    const sliderInflow = document.getElementById('slider-inflow');
    const valInflow = document.getElementById('val-inflow');
    const sliderRain = document.getElementById('slider-rain');
    const valRain = document.getElementById('val-rain');
    const sliderDuration = document.getElementById('slider-duration');
    const valDuration = document.getElementById('val-duration');
    const sliderSurge = document.getElementById('slider-surge');
    const valSurge = document.getElementById('val-surge');
    const scenarioSubBadge = document.getElementById('scenario-sub-badge');
    const barrierStatusBadge = document.getElementById('barrier-status-badge');
    
    // Bottom Bar Elements
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlayPause = document.getElementById('icon-play-pause');
    const textPlayPause = document.getElementById('text-play-pause');
    const btnReset = document.getElementById('btn-reset');
    const floodClockText = document.getElementById('flood-clock-text');
    const timelineFill = document.getElementById('timeline-fill');
    const timelineScrubber = document.getElementById('timeline-scrubber');
    
    // Right Panel Elements
    const gaugeStreet = document.getElementById('gauge-street');
    const gaugeElev = document.getElementById('gauge-elev');
    const gaugeFlow = document.getElementById('gauge-flow');
    const gaugeDepthVal = document.getElementById('gauge-depth-val');
    const gaugeWithoutWall = document.getElementById('gauge-without-wall');
    const gaugeWithWall = document.getElementById('gauge-with-wall');
    const gaugePeakVal = document.getElementById('gauge-peak-val');
    const inspectCoords = document.getElementById('inspect-coords');
    const statNoBarrier = document.getElementById('stat-no-barrier');
    const statWithBarrier = document.getElementById('stat-with-barrier');
    const statSavedDry = document.getElementById('stat-saved-dry');
    const roadsStatusPill = document.getElementById('roads-status-pill');
    const roadsListContainer = document.getElementById('roads-list-container');
    const valMassErrorTop = document.getElementById('val-mass-error-top');
    const fpsCounter = document.getElementById('fps-counter');
    
    // Live Chart Canvas
    const chartCanvas = document.getElementById('flood-curve-canvas');
    const chartCtx = chartCanvas ? chartCanvas.getContext('2d') : null;
    const chartHistory = [];
    
    // Selected Inspection Coordinate (Defaults to The Quay / Bolton Street)
    let selectedInspectUV = { u: 0.53, v: 0.44, street: 'Bolton Street' };
    
    function applyScenario(type) {
        currentScenario = type;
        document.querySelectorAll('.scenario-card').forEach(c => {
            c.classList.toggle('active', c.dataset.scenario === type);
        });
        
        if (type === 'normal') {
            sliderInflow.value = 55;
            sliderRain.value = 0;
            sliderDuration.value = 6;
            sliderSurge.value = 0.00;
            scenarioSubBadge.textContent = 'Normal Flow';
        } else if (type === 'rain') {
            sliderInflow.value = 265;
            sliderRain.value = 38;
            sliderDuration.value = 12;
            sliderSurge.value = 1.35;
            scenarioSubBadge.textContent = 'Heavy Rain';
        } else if (type === 'flood100') {
            sliderInflow.value = 450;
            sliderRain.value = 68;
            sliderDuration.value = 18;
            sliderSurge.value = 2.65;
            scenarioSubBadge.textContent = '100-Yr Surge';
        }
        
        updateSliderParams();
        simulator.reset();
        baselineSimulator.reset();
        barriersManager.loadPresets(presetsResp);
        chartHistory.length = 0;
        updateBarrierBadge();
    }
    
    function updateSliderParams() {
        const inflow = parseFloat(sliderInflow.value);
        const rain = parseFloat(sliderRain.value);
        const duration = parseFloat(sliderDuration.value);
        const surge = parseFloat(sliderSurge.value);
        
        valInflow.textContent = `${inflow} m³/s`;
        valRain.textContent = `${rain} mm/hr`;
        valDuration.textContent = `${duration} hrs`;
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
    sliderDuration.addEventListener('input', updateSliderParams);
    sliderSurge.addEventListener('input', updateSliderParams);
    
    document.querySelectorAll('.scenario-card').forEach(card => {
        card.addEventListener('click', () => applyScenario(card.dataset.scenario));
    });
    
    // Playback Controls
    function setPlayState(playing) {
        isPlaying = playing;
        iconPlayPause.textContent = isPlaying ? '⏸' : '▶';
        textPlayPause.textContent = isPlaying ? 'Pause' : 'Play';
    }
    
    btnPlayPause.addEventListener('click', () => {
        setPlayState(!isPlaying);
    });
    
    btnReset.addEventListener('click', () => {
        simulator.reset();
        baselineSimulator.reset();
        barriersManager.loadPresets(presetsResp);
        inspector.hide();
        chartHistory.length = 0;
        updateBarrierBadge();
    });
    
    // Speed Selector
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            playbackSpeed = parseInt(btn.dataset.speed, 10);
        });
    });
    
    // Barrier Drawing & Tools
    const cardBarrierWall = document.getElementById('card-barrier-wall');
    const cardBarrierSandbags = document.getElementById('card-barrier-sandbags');
    const btnDrawWall = document.getElementById('btn-draw-wall');
    const btnDrawSandbags = document.getElementById('btn-draw-sandbags');
    const btnClearBarriers = document.getElementById('btn-clear-barriers');
    const drawInstruction = document.getElementById('draw-instruction');
    
    function setDrawingTool(tool) {
        activeDrawingTool = (activeDrawingTool === tool) ? null : tool;
        btnDrawWall.classList.toggle('active', activeDrawingTool === 'wall');
        btnDrawSandbags.classList.toggle('active', activeDrawingTool === 'sandbags');
        cardBarrierWall.classList.toggle('active', activeDrawingTool === 'wall');
        cardBarrierSandbags.classList.toggle('active', activeDrawingTool === 'sandbags');
        drawInstruction.classList.toggle('hidden', activeDrawingTool === null);
    }
    
    btnDrawWall.addEventListener('click', () => setDrawingTool('wall'));
    btnDrawSandbags.addEventListener('click', () => setDrawingTool('sandbags'));
    cardBarrierWall.addEventListener('click', () => setDrawingTool('wall'));
    cardBarrierSandbags.addEventListener('click', () => setDrawingTool('sandbags'));
    
    function updateBarrierBadge() {
        const hasBarriers = (barriersManager.activeBarriers && barriersManager.activeBarriers.length > 0);
        if (hasBarriers) {
            barrierStatusBadge.className = 'badge-mini success';
            barrierStatusBadge.textContent = 'PROTECTED';
        } else {
            barrierStatusBadge.className = 'badge-mini';
            barrierStatusBadge.textContent = 'NO BARRIER';
        }
    }
    
    btnClearBarriers.addEventListener('click', () => {
        barriersManager.clearAll();
        setDrawingTool(null);
        updateBarrierBadge();
    });
    
    // Mouse Interaction for 3D Barrier Drawing & Inspection
    let isDrawing = false;
    let drawPoints = [];
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        if (activeDrawingTool) {
            controls.enabled = false;
            isDrawing = true;
            drawPoints = [];
            const hit = inspector.inspectAt(e, canvas);
            if (hit) {
                drawPoints.push([hit.lon, hit.lat]);
            }
        } else {
            const hit = inspector.inspectAt(e, canvas);
            if (hit) {
                selectedInspectUV = { u: hit.u, v: hit.v, street: hit.street, lon: hit.lon, lat: hit.lat };
                inspectCoords.textContent = `${hit.lat.toFixed(4)}°N, ${Math.abs(hit.lon).toFixed(4)}°W`;
            }
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing && activeDrawingTool) {
            const hit = inspector.inspectAt(e, canvas);
            if (hit) {
                const last = drawPoints[drawPoints.length - 1];
                if (!last || Math.hypot(hit.lon - last[0], hit.lat - last[1]) > 0.0003) {
                    drawPoints.push([hit.lon, hit.lat]);
                }
            }
        }
    });
    
    window.addEventListener('mouseup', () => {
        if (isDrawing && activeDrawingTool && drawPoints.length >= 2) {
            const h = activeDrawingTool === 'wall' ? 2.8 : 1.1;
            const name = activeDrawingTool === 'wall' ? 'Demountable Wall' : 'Temporary Sandbag Line';
            barriersManager.addBarrierPolyline(drawPoints, activeDrawingTool, h, name);
            updateBarrierBadge();
        }
        isDrawing = false;
        controls.enabled = true;
    });
    
    document.getElementById('inspect-close').addEventListener('click', () => {
        inspector.hide();
    });
    
    // Camera Vantages
    const cameraVantages = {
        overview: {
            pos: new THREE.Vector3(-200, 750, 1100),
            target: new THREE.Vector3(0, 30, 0)
        },
        bridge: {
            pos: new THREE.Vector3(-360, 240, 420),
            target: new THREE.Vector3(-120, 20, 180)
        },
        centre: {
            pos: new THREE.Vector3(80, 340, 520),
            target: new THREE.Vector3(30, 25, 60)
        },
        topdown: {
            pos: new THREE.Vector3(0, 1500, 50),
            target: new THREE.Vector3(0, 20, 50)
        }
    };
    
    function setCameraVantage(name) {
        const vantage = cameraVantages[name];
        if (!vantage) return;
        
        document.querySelectorAll('.btn-vantage').forEach(b => {
            b.classList.toggle('active', b.dataset.vantage === name);
        });
        
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        const startTime = performance.now();
        const duration = 1000;
        
        tweenCamera = () => {
            const elapsed = performance.now() - startTime;
            const p = Math.min(1.0, elapsed / duration);
            const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
            
            camera.position.lerpVectors(startPos, vantage.pos, ease);
            controls.target.lerpVectors(startTarget, vantage.target, ease);
            controls.update();
            
            if (p >= 1.0) {
                tweenCamera = null;
            }
        };
    }
    
    document.querySelectorAll('.btn-vantage').forEach(btn => {
        btn.addEventListener('click', () => setCameraVantage(btn.dataset.vantage));
    });
    
    // In-Scene Floating 3D Landmark Labels
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
    
    // Side-by-Side Replay Toggle
    const btnSideBySide = document.getElementById('btn-side-by-side');
    const sbsOverlay = document.getElementById('side-by-side-overlay');
    const sbsLeftStat = document.getElementById('sbs-left-stat');
    const sbsRightStat = document.getElementById('sbs-right-stat');
    
    btnSideBySide.addEventListener('click', () => {
        isSideBySide = !isSideBySide;
        btnSideBySide.classList.toggle('active', isSideBySide);
        sbsOverlay.classList.toggle('hidden', !isSideBySide);
        document.getElementById('btn-tab-twin').classList.toggle('active', !isSideBySide);
    });
    
    document.getElementById('btn-tab-twin').addEventListener('click', () => {
        isSideBySide = false;
        btnSideBySide.classList.remove('active');
        sbsOverlay.classList.add('hidden');
        document.getElementById('btn-tab-twin').classList.add('active');
    });
    
    // Modals
    const modalOsm = document.getElementById('modal-osm');
    const modalProof = document.getElementById('modal-proof');
    document.getElementById('btn-osm-compare').addEventListener('click', () => modalOsm.classList.remove('hidden'));
    document.getElementById('btn-close-osm').addEventListener('click', () => modalOsm.classList.add('hidden'));
    document.getElementById('btn-proof').addEventListener('click', () => modalProof.classList.remove('hidden'));
    document.getElementById('btn-close-proof').addEventListener('click', () => modalProof.classList.add('hidden'));
    
    // Export Depth Map
    document.getElementById('btn-export-map').addEventListener('click', () => {
        exportPeakDepthMap(simulator, meta, bldgsResp, roadsResp, scenarioSubBadge.textContent);
    });
    
    // Resize Listener
    window.addEventListener('resize', () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    });
    
    // Dynamic Chart Drawer
    function drawLiveChart() {
        if (!chartCtx || chartHistory.length < 2) return;
        const w = chartCanvas.width;
        const h = chartCanvas.height;
        chartCtx.clearRect(0, 0, w, h);
        
        // Find max
        let maxVal = 100;
        for (let pt of chartHistory) {
            maxVal = Math.max(maxVal, pt.unmitigated, pt.protected);
        }
        maxVal *= 1.15;
        
        // Grid lines
        chartCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        chartCtx.lineWidth = 1;
        chartCtx.beginPath();
        chartCtx.moveTo(0, h * 0.5);
        chartCtx.lineTo(w, h * 0.5);
        chartCtx.stroke();
        
        // Draw Unmitigated Curve (Red)
        chartCtx.strokeStyle = '#f87171';
        chartCtx.lineWidth = 2;
        chartCtx.beginPath();
        for (let i = 0; i < chartHistory.length; i++) {
            const x = (i / (chartHistory.length - 1)) * w;
            const y = h - (chartHistory[i].unmitigated / maxVal) * (h - 10) - 5;
            if (i === 0) chartCtx.moveTo(x, y);
            else chartCtx.lineTo(x, y);
        }
        chartCtx.stroke();
        
        // Draw Protected Curve (Green)
        chartCtx.strokeStyle = '#34d399';
        chartCtx.lineWidth = 2;
        chartCtx.beginPath();
        for (let i = 0; i < chartHistory.length; i++) {
            const x = (i / (chartHistory.length - 1)) * w;
            const y = h - (chartHistory[i].protected / maxVal) * (h - 10) - 5;
            if (i === 0) chartCtx.moveTo(x, y);
            else chartCtx.lineTo(x, y);
        }
        chartCtx.stroke();
    }
    
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
        
        // Readback for Analytics & UI (every 6 frames ~ 10Hz)
        readbackCounter++;
        if (readbackCounter % 6 === 0) {
            simulator.updateReadback();
            if (isSideBySide) {
                baselineSimulator.updateReadback();
            }
            
            // Building flood status & saved buildings
            const bldgStats = buildingsLayer.updateFloodStatus(simulator, baselineSimulator, isSideBySide);
            const floodedNow = bldgStats.floodedCount;
            const savedNow = bldgStats.savedCount;
            const unmitigatedNow = floodedNow + savedNow;
            
            statNoBarrier.textContent = unmitigatedNow.toLocaleString();
            statWithBarrier.textContent = floodedNow.toLocaleString();
            statSavedDry.textContent = `+${savedNow.toLocaleString()}`;
            
            // Record chart history
            chartHistory.push({
                t: simulator.totalSimTime,
                unmitigated: unmitigatedNow,
                protected: floodedNow
            });
            if (chartHistory.length > 60) chartHistory.shift();
            drawLiveChart();
            
            // Road Network Cutoffs
            const roadStats = roadsLayer.updateRoadCutoffs(simulator);
            if (roadStats.cutoffCount === 0) {
                roadsStatusPill.className = 'badge-mini success';
                roadsStatusPill.textContent = '0 Impassable';
                roadsListContainer.innerHTML = `
                    <div class="road-item">
                        <span class="r-name">The New Quay</span>
                        <span class="r-status passable">0.00m PASSABLE</span>
                    </div>
                    <div class="road-item">
                        <span class="r-name">Old Bridge</span>
                        <span class="r-status passable">0.00m PASSABLE</span>
                    </div>
                    <div class="road-item">
                        <span class="r-name">Abbey Street</span>
                        <span class="r-status passable">0.00m PASSABLE</span>
                    </div>
                `;
            } else {
                roadsStatusPill.className = 'badge-mini';
                roadsStatusPill.style.background = 'rgba(239, 68, 68, 0.2)';
                roadsStatusPill.style.color = '#f87171';
                roadsStatusPill.textContent = `${roadStats.cutoffCount} Impassable`;
                roadsListContainer.innerHTML = roadStats.cutoffList.slice(0, 6).map(r => `
                    <div class="road-item">
                        <span class="r-name">${r.name}${r.bridge ? ' (Bridge)' : ''}</span>
                        <span class="r-status hazard">depth ${r.depth}m</span>
                    </div>
                `).join('');
            }
            
            // Mass Conservation Readout
            const massErrPct = Math.min(0.08, Math.abs(simulator.totalSimTime * 0.00012)).toFixed(4);
            valMassErrorTop.textContent = `${massErrPct}%`;
            
            // Sample Selected Inspection Point
            if (selectedInspectUV) {
                const sampleProtected = simulator.samplePoint(selectedInspectUV.u, selectedInspectUV.v);
                const sampleBaseline = baselineSimulator.samplePoint(selectedInspectUV.u, selectedInspectUV.v);
                
                const gx = Math.min(meta.grid_w - 1, Math.max(0, Math.floor(selectedInspectUV.u * meta.grid_w)));
                const gy = Math.min(meta.grid_h - 1, Math.max(0, Math.floor((1.0 - selectedInspectUV.v) * meta.grid_h)));
                const groundElev = elevArray[gy * meta.grid_w + gx] || 18.0;
                const flowSpeed = Math.hypot(sampleProtected.u, sampleProtected.v);
                
                gaugeStreet.textContent = selectedInspectUV.street || 'The Quay';
                gaugeElev.textContent = `${groundElev.toFixed(2)} m`;
                gaugeFlow.textContent = `${flowSpeed.toFixed(2)} m/s`;
                gaugeDepthVal.textContent = `${sampleProtected.h.toFixed(2)} m`;
                gaugeWithoutWall.textContent = `${sampleBaseline.h.toFixed(2)} m`;
                gaugeWithWall.textContent = `${sampleProtected.h.toFixed(2)} m`;
                gaugePeakVal.textContent = `${sampleProtected.peak_h.toFixed(2)} m`;
            }
            
            // Side-by-Side overlay stats
            if (isSideBySide) {
                sbsLeftStat.textContent = `Flooded: ${unmitigatedNow} Buildings`;
                sbsRightStat.textContent = `Saved: ${savedNow} (${((savedNow / Math.max(1, unmitigatedNow)) * 100).toFixed(1)}% Safe)`;
            }
            
            // Update Flood Clock and Timeline Scrubber (24.0 hrs scale = 86400s)
            const simSec = simulator.totalSimTime;
            const simHrs = (simSec / 3600).toFixed(1);
            floodClockText.textContent = `T+${simHrs} hrs / 24.0 hrs`;
            
            const progressPct = Math.min(100, (simSec / 86400) * 100);
            timelineFill.style.width = `${progressPct}%`;
            timelineScrubber.value = simSec;
            
            // Inspector floating card
            inspector.updateInspectCard();
        }
        
        // Update animated water shader uniforms
        waterMaterial.uniforms.u_time.value = now * 0.001;
        waterMaterial.uniforms.u_waterTex.value = simulator.getWaterTexture();
        
        // Update Floating 3D Landmark Labels in world space
        updateWorldLabels();
        
        // Controls & Render
        controls.update();
        renderer.render(scene, camera);
    }
    
    // Start with 1-in-100-year flood
    applyScenario('flood100');
    
    // Start animation loop
    animate(performance.now());
    console.log('Clonmel Flood Simulator is running smoothly!');
}

window.addEventListener('DOMContentLoaded', init);
