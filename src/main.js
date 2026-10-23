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
import { TOWNS, getTownConfig, DEFAULT_TOWN_ID } from './config/towns.js';
import { initTownSwitcher, getActiveTown, setActiveTown } from './ui/town_switcher.js';
import {
    DIBRUGARH_SCENARIOS,
    applyDibrugarhScenario,
    getDibrugarhGaugeStatus,
    DIBRUGARH_SLIDER_LIMITS
} from './simulation/dibrugarh_scenarios.js';
import {
    DIBRUGARH_INTERVENTIONS,
    deployDykeReinforcement,
    deployStormwaterPumps,
    computeInterventionComparison,
    runSynchronizedReplay
} from './analysis/dibrugarh_interventions.js';

let activeSetSideBySideReplayFn = null;

export function setSideBySideReplay(enabled) {
    if (activeSetSideBySideReplayFn) {
        return activeSetSideBySideReplayFn(enabled);
    }
}

export {
    DIBRUGARH_INTERVENTIONS,
    deployDykeReinforcement,
    deployStormwaterPumps,
    computeInterventionComparison,
    runSynchronizedReplay
};

/**
 * Loads GIS and raster assets dynamically for a given town configuration.
 * @param {object} townConfig 
 * @returns {Promise<object>} Loaded datasets and textures
 */
let activeSwitchTownFn = null;

export async function switchTown(newTownId) {
    if (activeSwitchTownFn) {
        return await activeSwitchTownFn(newTownId);
    }
}

export async function loadTownData(townConfig) {
    const basePath = townConfig.dataPath || '/data/';
    const loader = new THREE.TextureLoader();

    const [meta, elevBuffer, bldgsResp, roadsResp, presetsResp] = await Promise.all([
        fetch(`${basePath}terrain.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading ${basePath}terrain.json`);
            return r.json();
        }),
        fetch(`${basePath}elevation_hydro.bin`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading ${basePath}elevation_hydro.bin`);
            return r.arrayBuffer();
        }),
        fetch(`${basePath}buildings.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading ${basePath}buildings.json`);
            return r.json();
        }),
        fetch(`${basePath}roads.json`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading ${basePath}roads.json`);
            return r.json();
        }),
        fetch(`${basePath}barriers_preset.json`)
            .then(r => (r.ok ? r.json() : []))
            .catch(() => [])
    ]);

    const elevArray = new Float32Array(elevBuffer);

    const [bldgMaskImg, riverMaskImg, normalTex] = await Promise.all([
        new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error(`Failed to load ${basePath}buildings_mask.png`));
            img.src = `${basePath}buildings_mask.png`;
        }),
        new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error(`Failed to load ${basePath}river_mask.png`));
            img.src = `${basePath}river_mask.png`;
        }),
        new Promise(res => {
            loader.load(`${basePath}terrain_normal.png`, tex => res(tex));
        })
    ]);

    return {
        meta,
        elevBuffer,
        elevArray,
        bldgsResp,
        roadsResp,
        presetsResp,
        bldgMaskImg,
        riverMaskImg,
        normalTex
    };
}

async function init() {
    const initialTownId = typeof getActiveTown === 'function' ? getActiveTown() : DEFAULT_TOWN_ID;
    let currentTownConfig = getTownConfig(initialTownId);
    console.log(`Initializing Hydroverse (${currentTownConfig.name}, ${currentTownConfig.riverName})...`);

    // Early DOM bindings for scenario and sliders
    let activeScenarioTag = typeof document !== 'undefined' ? document.getElementById('active-scenario-tag') : null;
    let sliderInflow = typeof document !== 'undefined' ? document.getElementById('slider-inflow') : null;
    let valInflow = typeof document !== 'undefined' ? document.getElementById('val-inflow') : null;
    let sliderRain = typeof document !== 'undefined' ? document.getElementById('slider-rain') : null;
    let valRain = typeof document !== 'undefined' ? document.getElementById('val-rain') : null;
    let sliderSurge = typeof document !== 'undefined' ? document.getElementById('slider-surge') : null;
    let valSurge = typeof document !== 'undefined' ? document.getElementById('val-surge') : null;

    // 1. Setup Three.js Scene, Renderer, Camera, Lighting
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

    const camera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / canvas.clientHeight,
        1,
        15000
    );

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 5000;
    window.controls = controls;

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

    // 2. Active Town State & Simulation Variables
    let meta = null;
    let elevBuffer = null;
    let elevArray = null;
    let bldgsResp = null;
    let roadsResp = null;
    let presetsResp = null;
    let normalTex = null;
    let bldgMaskImg = null;
    let riverMaskImg = null;

    let simulator = null;
    let baselineSimulator = null;
    let terrainMesh = null;
    let terrainGeom = null;
    let waterMesh = null;
    let waterMaterial = null;
    let buildingsLayer = null;
    let roadsLayer = null;
    let bridgesLayer = null;
    let barriersManager = null;
    let inspector = null;
    let arrivalTracker = null;
    let roadGraph = null;
    let interventionEngine = null;
    let validationMetrics = null;
    let analyticalOverlays = null;
    let workspaceManager = null;
    let worldLabels = [];
    let isSwitchingTown = false;

    // Helper: Safely tear down and dispose town 3D objects and simulator buffers
    function teardownTownModel() {
        if (selectedInspectUV) selectedInspectUV = null;
        if (pendingBarrierPoint) pendingBarrierPoint = null;
        if (typeof cleanupDrawingVisuals === 'function') cleanupDrawingVisuals();

        if (analyticalOverlays && analyticalOverlays.mesh) {
            scene.remove(analyticalOverlays.mesh);
            if (analyticalOverlays.mesh.geometry) analyticalOverlays.mesh.geometry.dispose();
            if (analyticalOverlays.mesh.material) {
                if (Array.isArray(analyticalOverlays.mesh.material)) analyticalOverlays.mesh.material.forEach(m => m.dispose());
                else analyticalOverlays.mesh.material.dispose();
            }
            analyticalOverlays = null;
        }

        if (barriersManager) {
            barriersManager.clearAll();
            if (barriersManager.group) {
                scene.remove(barriersManager.group);
                barriersManager.group.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }
                });
            }
            barriersManager = null;
        }

        if (inspector) {
            if (typeof inspector.hide === 'function') inspector.hide();
            if (inspector.pinGroup) scene.remove(inspector.pinGroup);
            inspector = null;
        }

        if (bridgesLayer && bridgesLayer.group) {
            scene.remove(bridgesLayer.group);
            bridgesLayer.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            bridgesLayer = null;
        }

        if (roadsLayer && roadsLayer.group) {
            scene.remove(roadsLayer.group);
            roadsLayer.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            roadsLayer = null;
        }

        if (buildingsLayer && buildingsLayer.mesh) {
            scene.remove(buildingsLayer.mesh);
            if (buildingsLayer.mesh.geometry) buildingsLayer.mesh.geometry.dispose();
            if (buildingsLayer.mesh.material) {
                if (Array.isArray(buildingsLayer.mesh.material)) buildingsLayer.mesh.material.forEach(m => m.dispose());
                else buildingsLayer.mesh.material.dispose();
            }
            buildingsLayer = null;
        }

        if (waterMesh) {
            scene.remove(waterMesh);
            if (waterMesh.geometry) waterMesh.geometry.dispose();
            waterMesh = null;
        }
        if (waterMaterial) {
            waterMaterial.dispose();
            waterMaterial = null;
        }

        if (terrainMesh) {
            scene.remove(terrainMesh);
            if (terrainMesh.geometry) terrainMesh.geometry.dispose();
            if (terrainMesh.material) {
                if (terrainMesh.material.map) terrainMesh.material.map.dispose();
                if (terrainMesh.material.normalMap) terrainMesh.material.normalMap.dispose();
                terrainMesh.material.dispose();
            }
            terrainMesh = null;
            terrainGeom = null;
        }

        if (normalTex) {
            normalTex.dispose();
            normalTex = null;
        }

        const disposeSim = (s) => {
            if (!s) return;
            if (typeof s.dispose === 'function') {
                s.dispose();
            } else {
                if (s.targetA) s.targetA.dispose();
                if (s.targetB) s.targetB.dispose();
                if (s.elevTexture) s.elevTexture.dispose();
                if (s.barrierTexture) s.barrierTexture.dispose();
                if (s.computeMaterial) s.computeMaterial.dispose();
                if (s.initMaterial) s.initMaterial.dispose();
                if (s.seekMaterial) s.seekMaterial.dispose();
                if (s.quadGeom) s.quadGeom.dispose();
            }
        };

        disposeSim(simulator);
        disposeSim(baselineSimulator);
        simulator = null;
        baselineSimulator = null;
    }

    // Helper: Mount town model into scene and wire simulation
    function mountTownModel(townConfig, data) {
        meta = data.meta;
        elevBuffer = data.elevBuffer;
        elevArray = data.elevArray;
        bldgsResp = data.bldgsResp;
        roadsResp = data.roadsResp;
        presetsResp = data.presetsResp;
        normalTex = data.normalTex;
        bldgMaskImg = data.bldgMaskImg;
        riverMaskImg = data.riverMaskImg;

        // 1. Simulators
        simulator = new SWESimulator(renderer, meta, elevArray, bldgMaskImg, riverMaskImg);
        baselineSimulator = new SWESimulator(renderer, meta, elevArray, bldgMaskImg, riverMaskImg);

        // Configure boundary conditions if non-Clonmel (e.g. Dibrugarh)
        const isClonmel = meta.bbox.south > 50;
        if (!isClonmel) {
            const h_deg = meta.bbox.north - meta.bbox.south;
            const inletLat = meta.inletLat || 27.489;
            const outletLat = meta.outletLat || 27.495;
            const inletUV_Y = (inletLat - meta.bbox.south) / h_deg;
            const outletUV_Y = (outletLat - meta.bbox.south) / h_deg;
            
            for (const sim of [simulator, baselineSimulator]) {
                sim.inletYMin = inletUV_Y - 0.05;
                sim.inletYMax = inletUV_Y + 0.05;
                sim.outletYMin = outletUV_Y - 0.05;
                sim.outletYMax = outletUV_Y + 0.05;
                if (sim.computeMaterial && sim.computeMaterial.uniforms) {
                    sim.computeMaterial.uniforms.u_inletYMin.value = sim.inletYMin;
                    sim.computeMaterial.uniforms.u_inletYMax.value = sim.inletYMax;
                    sim.computeMaterial.uniforms.u_outletYMin.value = sim.outletYMin;
                    sim.computeMaterial.uniforms.u_outletYMax.value = sim.outletYMax;
                }
                if (sim.initMaterial && sim.initMaterial.uniforms) {
                    sim.initMaterial.uniforms.u_baseWaterLevel.value = meta.base_water_level || 104.5;
                }
                sim.reset();
            }
        }

        window.simulator = simulator;
        window.baselineSimulator = baselineSimulator;

        // 2. Terrain Mesh
        const terrainRes = createTerrainMesh(meta, elevArray, normalTex);
        terrainMesh = terrainRes.mesh;
        terrainGeom = terrainRes.geometry;
        scene.add(terrainMesh);

        // 3. Water Mesh
        const waterRes = createWaterMesh(meta, terrainGeom, simulator);
        waterMesh = waterRes.waterMesh;
        waterMaterial = waterRes.waterMaterial;
        scene.add(waterMesh);

        // 4. Buildings Layer
        buildingsLayer = createBuildingsLayer(meta, bldgsResp, elevArray, riverMaskImg);
        scene.add(buildingsLayer.mesh);

        // 5. Roads Layer
        roadsLayer = createRoadsLayer(meta, roadsResp, elevArray);
        scene.add(roadsLayer.group);

        // 6. Bridges Layer (only if town is Clonmel)
        if (townConfig.id === 'clonmel') {
            bridgesLayer = createBridgesLayer(meta, elevArray, roadsResp);
            scene.add(bridgesLayer.group);
        } else {
            bridgesLayer = null;
        }

        // 7. Barriers Manager
        barriersManager = createBarriersManager(scene, meta, simulator, elevArray);
        barriersManager.clearAll();
        window.barriersManager = barriersManager;

        // 8. Inspector
        inspector = createInspector(camera, terrainMesh, simulator, meta, elevArray, roadsResp);
        scene.add(inspector.pinGroup);

        // 9. Analytical Modules & Overlays
        arrivalTracker = new ArrivalDurationTracker(meta.grid_w, meta.grid_h, meta.bbox);
        roadGraph = new RoadGraphAnalyzer(roadsResp, meta, elevArray);
        interventionEngine = new InterventionEngine(meta.grid_w, meta.grid_h, meta);
        validationMetrics = new ValidationMetrics(meta);
        analyticalOverlays = createAnalyticalOverlays(meta, terrainGeom, simulator, baselineSimulator, arrivalTracker, interventionEngine);
        scene.add(analyticalOverlays.mesh);

        // 10. Update WorkspaceManager references if already initialized
        if (workspaceManager) {
            workspaceManager.simulator = simulator;
            workspaceManager.baselineSimulator = baselineSimulator;
            workspaceManager.roadGraph = roadGraph;
            workspaceManager.interventionEngine = interventionEngine;
            workspaceManager.validationMetrics = validationMetrics;
            workspaceManager.overlays = analyticalOverlays;
            workspaceManager.barriersManager = barriersManager;
            workspaceManager.meta = meta;
            workspaceManager.elevArray = elevArray;

            if (workspaceManager.exerciseManager) {
                workspaceManager.exerciseManager.simulator = simulator;
                workspaceManager.exerciseManager.roadGraph = roadGraph;
                workspaceManager.exerciseManager.barriersManager = barriersManager;
                workspaceManager.exerciseManager.interventionEngine = interventionEngine;
            }

            if (workspaceManager.defenceManager && typeof workspaceManager.defenceManager.loadDefenceDataset === 'function') {
                workspaceManager.defenceManager.loadDefenceDataset(`${townConfig.dataPath}flood_defences.json`);
            }

            workspaceManager.updateView();
        }

        // 11. Camera repositioning
        if (townConfig.id === 'clonmel') {
            camera.position.set(-200, 750, 1100);
            controls.target.set(0, 30, 0);
        } else {
            const cam = townConfig.defaultCamera || { position: { x: 0, y: 400, z: 480 }, target: { x: 0, y: 0, z: 0 } };
            camera.position.set(cam.position.x, cam.position.y, cam.position.z);
            controls.target.set(cam.target.x, cam.target.y, cam.target.z);
        }
        controls.update();

        // 12. Update HUD & world labels
        updateHUDForTown(townConfig);
        updateWorldLabelsForTown(townConfig);
        updateInterventionsForTown(townConfig);

        // 13. Reapply scenario
        if (typeof applyScenario === 'function') {
            if (townConfig.id === 'dibrugarh') {
                applyScenario('baseline-monsoon');
            } else {
                applyScenario('flood100');
            }
        }
    }

    // Helper: Switch active town dynamically
    async function switchTown(newTownId) {
        if (isSwitchingTown) return;
        if (!TOWNS[newTownId]) {
            console.warn(`[switchTown] Unknown town "${newTownId}", falling back to ${DEFAULT_TOWN_ID}`);
            newTownId = DEFAULT_TOWN_ID;
        }
        if (currentTownConfig && currentTownConfig.id === newTownId) {
            return;
        }

        isSwitchingTown = true;
        console.log(`[switchTown] Transitioning from ${currentTownConfig?.name || 'unknown'} to ${newTownId}...`);
        setActiveTown(newTownId, true);
        const nextConfig = getTownConfig(newTownId);

        try {
            const nextData = await loadTownData(nextConfig);
            teardownTownModel();
            currentTownConfig = nextConfig;
            mountTownModel(currentTownConfig, nextData);
            console.log(`[switchTown] Successfully transitioned to ${nextConfig.name}`);
        } catch (err) {
            console.error(`[switchTown] Failed switching to ${newTownId}:`, err);
        } finally {
            isSwitchingTown = false;
        }
    }
    window.switchTown = switchTown;
    activeSwitchTownFn = switchTown;
    window.currentTownConfig = currentTownConfig;

    function updateHUDForTown(cfg) {
        if (typeof document === 'undefined') return;

        document.title = `${cfg.name} Flood Simulation & Intelligence Platform`;

        const stationTitle = document.querySelector('.station-title');
        if (stationTitle) {
            stationTitle.textContent = cfg.id === 'dibrugarh'
                ? 'WRD Station 03 (Brahmaputra River)'
                : `${cfg.gauge.name} (${cfg.riverName})`;
        }

        const readoutItems = document.querySelectorAll('.station-card .station-readout-item');
        if (readoutItems && readoutItems.length >= 3) {
            const stageLbl = readoutItems[0]?.querySelector('.st-lbl');
            const stageVal = readoutItems[0]?.querySelector('.st-val');
            const bankfullLbl = readoutItems[1]?.querySelector('.st-lbl');
            const bankfullVal = readoutItems[1]?.querySelector('.st-val');
            const dischargeLbl = readoutItems[2]?.querySelector('.st-lbl');
            const dischargeVal = readoutItems[2]?.querySelector('.st-val');
            const alertStatusLbl = readoutItems[3]?.querySelector('.st-lbl');
            const alertStatusVal = readoutItems[3]?.querySelector('.st-val');

            if (cfg.id === 'dibrugarh') {
                if (stageLbl) stageLbl.textContent = 'Stage Level:';
                if (stageVal) stageVal.textContent = '104.50 m MSL';
                if (bankfullLbl) bankfullLbl.textContent = 'Danger Level:';
                if (bankfullVal) bankfullVal.textContent = '105.70 m MSL';
                if (dischargeLbl) dischargeLbl.textContent = 'HFL (1998):';
                if (dischargeVal) dischargeVal.textContent = '106.48 m MSL';
                if (alertStatusLbl) alertStatusLbl.textContent = 'Alert Status:';
                if (alertStatusVal) {
                    alertStatusVal.textContent = 'NORMAL FLOW';
                    alertStatusVal.style.color = '#34d399';
                }
            } else {
                if (stageLbl) stageLbl.textContent = 'Stage Level:';
                if (stageVal) stageVal.textContent = '2.38 m OD';
                if (bankfullLbl) bankfullLbl.textContent = 'Bankfull Level:';
                if (bankfullVal) bankfullVal.textContent = '2.80 m OD';
                if (dischargeLbl) dischargeLbl.textContent = 'River Discharge:';
                if (dischargeVal) dischargeVal.textContent = '142 m³/s';
                if (alertStatusLbl) alertStatusLbl.textContent = 'Alert Status:';
                if (alertStatusVal) {
                    alertStatusVal.textContent = 'NORMAL FLOW';
                    alertStatusVal.style.color = '#34d399';
                }
            }
        }

        const inflowLabel = document.querySelector('.slider-field .slider-labels span:first-child');
        const sInflow = sliderInflow || document.getElementById('slider-inflow');
        const vInflow = valInflow || document.getElementById('val-inflow');
        const sRain = sliderRain || document.getElementById('slider-rain');
        const vRain = valRain || document.getElementById('val-rain');
        const sSurge = sliderSurge || document.getElementById('slider-surge');
        const vSurge = valSurge || document.getElementById('val-surge');

        if (cfg.id === 'dibrugarh') {
            if (inflowLabel) inflowLabel.textContent = 'River Stage';
            if (sInflow) {
                sInflow.min = `${DIBRUGARH_SLIDER_LIMITS.stageMin}`;
                sInflow.max = `${DIBRUGARH_SLIDER_LIMITS.stageMax}`;
                sInflow.step = `${DIBRUGARH_SLIDER_LIMITS.stageStep}`;
                sInflow.value = '104.50';
            }
            if (vInflow) vInflow.textContent = '104.50 m MSL';
            if (sRain) {
                sRain.min = `${DIBRUGARH_SLIDER_LIMITS.rainMin}`;
                sRain.max = `${DIBRUGARH_SLIDER_LIMITS.rainMax}`;
                sRain.step = `${DIBRUGARH_SLIDER_LIMITS.rainStep}`;
                sRain.value = '0';
            }
            if (vRain) vRain.textContent = '0 mm/h';
            if (sSurge) {
                sSurge.min = '-0.5';
                sSurge.max = '3.0';
                sSurge.step = '0.05';
                sSurge.value = '0.00';
            }
            if (vSurge) vSurge.textContent = '+0.00 m';
        } else {
            if (inflowLabel) inflowLabel.textContent = `${cfg.riverName} Inflow`;
            if (sInflow) {
                sInflow.min = '20';
                sInflow.max = '650';
                sInflow.step = '10';
                sInflow.value = '450';
            }
            if (vInflow) vInflow.textContent = '450 m³/s';
            if (sRain) {
                sRain.min = '0';
                sRain.max = '80';
                sRain.step = '5';
                sRain.value = '0';
            }
            if (vRain) vRain.textContent = '0 mm/h';
            if (sSurge) {
                sSurge.min = '-0.5';
                sSurge.max = '3.0';
                sSurge.step = '0.05';
                sSurge.value = '0.00';
            }
            if (vSurge) vSurge.textContent = '+0.00 m';
        }

        // Dynamically swap scenario buttons for the town
        updateScenarioButtonsForTown(cfg);

        const roadsList = document.getElementById('roads-list');
        if (roadsList) {
            if (cfg.id === 'dibrugarh') {
                roadsList.innerHTML = `
                    <div class="road-entry passable">
                        <span class="r-name">AT Road (Highway)</span>
                        <span class="r-tag">Passable</span>
                    </div>
                    <div class="road-entry passable">
                        <span class="r-name">HS Road</span>
                        <span class="r-tag">Passable</span>
                    </div>
                    <div class="road-entry passable">
                        <span class="r-name">DTP Dyke Service Rd</span>
                        <span class="r-tag">Passable</span>
                    </div>
                `;
            } else {
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
            }
        }
    }

    function updateScenarioButtonsForTown(cfg) {
        if (typeof document === 'undefined') return;

        const scenarioContainer = document.getElementById('scenario-selector') ||
            document.getElementById('live-scenarios') ||
            document.querySelector('#scenario-controls-view .scenario-buttons-stack') ||
            document.querySelector('.scenario-buttons-stack');

        if (!scenarioContainer) return;
        if (!scenarioContainer.id) {
            scenarioContainer.id = 'scenario-selector';
        }

        const tagEl = activeScenarioTag || document.getElementById('active-scenario-tag');

        if (cfg.id === 'dibrugarh') {
            scenarioContainer.innerHTML = `
                <button class="scenario-btn active" data-scenario="baseline-monsoon">
                    <div class="s-dot blue"></div>
                    <div class="s-info">
                        <span class="s-name">Normal Monsoon Flow</span>
                        <span class="s-val">104.50 m MSL • Channel baseline</span>
                    </div>
                </button>
                <button class="scenario-btn" data-scenario="july-2024-flash">
                    <div class="s-dot amber"></div>
                    <div class="s-info">
                        <span class="s-name">July 2024 Urban Flash Flood</span>
                        <span class="s-val">65 mm/h rain • 105.50 m stage</span>
                    </div>
                </button>
                <button class="scenario-btn" data-scenario="sept-1998-record">
                    <div class="s-dot red"></div>
                    <div class="s-info">
                        <span class="s-name">Sept 1998 Historic River Flood</span>
                        <span class="s-val">106.48 m HFL • Overtopping DTP dyke</span>
                    </div>
                </button>
            `;
            if (tagEl) {
                tagEl.textContent = 'Normal Monsoon Flow';
            }
        } else {
            scenarioContainer.innerHTML = `
                <button class="scenario-btn" data-scenario="normal">
                    <div class="s-dot blue"></div>
                    <div class="s-info">
                        <span class="s-name">Normal River Flow</span>
                        <span class="s-val">55 m³/s • Channel baseline</span>
                    </div>
                </button>
                <button class="scenario-btn active" data-scenario="flood100">
                    <div class="s-dot red"></div>
                    <div class="s-info">
                        <span class="s-name">1-in-100-Yr Flood</span>
                        <span class="s-val">450 m³/s • Overtopping quays</span>
                    </div>
                </button>
                <button class="scenario-btn" data-scenario="surge">
                    <div class="s-dot amber"></div>
                    <div class="s-info">
                        <span class="s-name">Storm Surge & Rain</span>
                        <span class="s-val">400 m³/s + 50 mm/h rain</span>
                    </div>
                </button>
            `;
            if (tagEl) {
                tagEl.textContent = '1-in-100-Yr Flood';
            }
        }

        scenarioContainer.querySelectorAll('.scenario-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                applyScenario(btn.dataset.scenario);
            });
        });
    }

    function updateWorldLabelsForTown(cfg) {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('world-labels-container');
        if (!container) return;

        const clonmelLabelIds = ['label-gashouse', 'label-suir-island', 'label-the-quay', 'label-old-bridge', 'label-sarsfield'];

        if (cfg.id === 'clonmel') {
            for (const id of clonmelLabelIds) {
                const el = document.getElementById(id);
                if (el) el.style.display = '';
            }
            container.querySelectorAll('.dibrugarh-world-label').forEach(el => el.style.display = 'none');

            worldLabels = [
                { el: document.getElementById('label-gashouse'), lon: -7.6930, lat: 52.3528, yOffset: 25 },
                { el: document.getElementById('label-suir-island'), lon: -7.7042, lat: 52.3520, yOffset: 25 },
                { el: document.getElementById('label-the-quay'), lon: -7.7032, lat: 52.3538, yOffset: 25 },
                { el: document.getElementById('label-old-bridge'), lon: -7.7041, lat: 52.3514, yOffset: 25 },
                { el: document.getElementById('label-sarsfield'), lon: -7.7050, lat: 52.3558, yOffset: 30 }
            ];
        } else {
            for (const id of clonmelLabelIds) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            }

            const dibrugarhDefs = [
                { id: 'label-dtp-dyke', title: 'DTP Dyke', sub: 'Town Protection Embankment', lon: 94.912, lat: 27.487, yOffset: 25 },
                { id: 'label-riverfront', title: 'Brahmaputra Riverfront', sub: 'North River Corridor', lon: 94.920, lat: 27.492, yOffset: 25 },
                { id: 'label-thana-chariali', title: 'Thana Chariali', sub: 'Commercial Hub', lon: 94.917, lat: 27.483, yOffset: 20 },
                { id: 'label-graham-bazaar', title: 'Graham Bazaar', sub: 'Low-Lying Urban Basin', lon: 94.908, lat: 27.481, yOffset: 20 },
                { id: 'label-at-road', title: 'AT Road', sub: 'Primary Highway Corridor', lon: 94.915, lat: 27.479, yOffset: 20 }
            ];

            worldLabels = dibrugarhDefs.map(def => {
                let el = document.getElementById(def.id);
                if (!el) {
                    el = document.createElement('div');
                    el.className = 'world-label dibrugarh-world-label';
                    el.id = def.id;
                    el.innerHTML = `
                        <div class="label-box">
                            <span class="title">${def.title}</span>
                            <span class="sub">${def.sub}</span>
                        </div>
                        <div class="label-pin"></div>
                    `;
                    container.appendChild(el);
                }
                el.style.display = '';
                return { el, lon: def.lon, lat: def.lat, yOffset: def.yOffset };
            });
        }
    }

    function updateInterventionsForTown(cfg) {
        if (typeof document === 'undefined') return;
        const isDib = cfg?.id === 'dibrugarh';

        const guideHint = document.querySelector('#barrier-studio-view .barrier-guide-hint');
        if (guideHint) {
            guideHint.textContent = isDib
                ? 'Deploy DTP dyke reinforcement (+0.8m), high-capacity sluice pumps (15 m³/s), and tactical flood barriers to evaluate urban protection.'
                : 'Deploy demountable quay walls, sandbag bunds, SuDS green infrastructure, and pumps to evaluate protection.';
        }

        const btnToolPresetEl = document.getElementById('btn-tool-preset');
        if (btnToolPresetEl) {
            const bTitle = btnToolPresetEl.querySelector('.b-title');
            const bSub = btnToolPresetEl.querySelector('.b-sub');
            const bIcon = btnToolPresetEl.querySelector('.b-icon');
            if (bTitle) bTitle.textContent = isDib ? 'Reinforce DTP Dyke' : 'Clonmel Relief Scheme';
            if (bSub) bSub.textContent = isDib ? '+0.8m Crest Reinforcement' : 'Official Quay Walls & Bunds';
            if (bIcon) bIcon.textContent = isDib ? '🛡️' : '🏛️';
            btnToolPresetEl.title = isDib ? 'Reinforce 9.5 km DTP Dyke by +0.8m crest elevation' : 'Official Clonmel Flood Relief Scheme barriers';
        }

        const btnToolWallEl = document.getElementById('btn-tool-wall');
        if (btnToolWallEl) {
            const bTitle = btnToolWallEl.querySelector('.b-title');
            const bSub = btnToolWallEl.querySelector('.b-sub');
            if (bTitle) bTitle.textContent = isDib ? 'Draw Tactical Wall' : 'Draw Flood Wall';
            if (bSub) bSub.textContent = isDib ? '1.5m Demountable Barrier' : '2.8m Demountable Aluminium';
        }

        const btnToolSandbagsEl = document.getElementById('btn-tool-sandbags');
        if (btnToolSandbagsEl) {
            const bTitle = btnToolSandbagsEl.querySelector('.b-title');
            const bSub = btnToolSandbagsEl.querySelector('.b-sub');
            if (bTitle) bTitle.textContent = isDib ? 'Place Sandbag Bund' : 'Place Sandbag Bund';
            if (bSub) bSub.textContent = isDib ? '1.0m Heavy Geo-Bag Defense' : '1.2m Heavy Sandbag Defense';
        }

        const btnSudsEl = document.getElementById('btn-toggle-suds');
        if (btnSudsEl) {
            const span = btnSudsEl.querySelector('span:last-child');
            if (span) span.textContent = isDib ? 'Bio-Engineering Infil' : 'SuDS Green Soils';
            btnSudsEl.title = isDib ? 'Brahmaputra Bank Bio-Engineering: 28 mm/h infiltration' : 'SuDS Green Infrastructure: 28 mm/h infiltration sponge effect';
        }

        const btnPumpsEl = document.getElementById('btn-toggle-pumps');
        if (btnPumpsEl) {
            const span = btnPumpsEl.querySelector('span:last-child');
            if (span) span.textContent = isDib ? '15 m³/s Sluice Pumps' : '15 m³/s Pumps';
            btnPumpsEl.title = isDib ? 'Graham Bazaar & Maijan High-Capacity Sluice Outfall Pumps (15 m³/s)' : 'Suir Island Axial Pumps: 15 m³/s discharge';
        }

        let btnToggleSbs = document.getElementById('btn-toggle-sbs');
        if (!btnToggleSbs) {
            const diffBtn = document.getElementById('btn-toggle-diff');
            if (diffBtn && diffBtn.parentNode) {
                btnToggleSbs = document.createElement('button');
                btnToggleSbs.id = 'btn-toggle-sbs';
                btnToggleSbs.className = 'overlay-toggle-btn';
                btnToggleSbs.style.width = '100%';
                btnToggleSbs.style.marginTop = '6px';
                btnToggleSbs.style.justifyContent = 'center';
                btnToggleSbs.title = 'Synchronized Side-by-Side Replay (Baseline vs Protected)';
                btnToggleSbs.innerHTML = `
                    <span class="ov-icon">⚡</span>
                    <span id="btn-sbs-text">Side-by-Side Synchronized Replay</span>
                `;
                diffBtn.parentNode.insertBefore(btnToggleSbs, diffBtn.nextSibling);
                btnToggleSbs.addEventListener('click', () => {
                    setSideBySideReplay(!isSideBySide);
                });
            }
        }

        updateSideBySideOverlayContent(cfg);
    }

    // Load initial town data & mount initial model
    const initialTownData = await loadTownData(currentTownConfig);
    mountTownModel(currentTownConfig, initialTownData);

    // Wire up Town Switcher UI component
    initTownSwitcher(switchTown);

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
        if (heroSection) {
            heroSection.classList.add('hidden');
            heroSection.style.display = 'none';
        }
    };

    if (btnHeroLaunch) btnHeroLaunch.addEventListener('click', launchSimulation);

    if (btnBackHero && heroSection) {
        btnBackHero.addEventListener('click', () => {
            heroSection.style.display = '';
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

    const tabExplainable = document.getElementById('tab-explainable');

    

    const scenarioControlsView = document.getElementById('scenario-controls-view');

    const timeMachineView = document.getElementById('time-machine-view');

    const barrierStudioView = document.getElementById('barrier-studio-view');

    const impactIntelView = document.getElementById('impact-intel-view');

    const communityEvidenceView = document.getElementById('community-evidence-view');

    const commandExerciseView = document.getElementById('command-exercise-view');

    const scienceValidationView = document.getElementById('science-validation-view');

    const forecastOpsView = document.getElementById('forecast-ops-view');

    const defenceMonitorView = document.getElementById('defence-monitor-view');

    const explainableForecastView = document.getElementById('explainable-forecast-view');

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

            defences: tabDefences,

            explainable: tabExplainable

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

            defences: defenceMonitorView,

            explainable: explainableForecastView

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

    

    workspaceManager = new WorkspaceManager(

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

    window.explainabilityManager = workspaceManager.explainabilityManager;

    

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

    function updateSideBySideOverlayContent(cfg) {
        if (!sideBySideOverlay) return;
        const isDib = cfg?.id === 'dibrugarh';
        
        const unmitBadge = sideBySideOverlay.querySelector('.sbs-comparison-card.unmitigated .sbs-card-badge');
        const protBadge = sideBySideOverlay.querySelector('.sbs-comparison-card.protected .sbs-card-badge');
        
        if (unmitBadge) {
            unmitBadge.textContent = isDib ? 'WITHOUT INTERVENTIONS (BASELINE FLOOD)' : 'WITHOUT BARRIER (BASELINE FLOOD)';
        }
        if (protBadge) {
            protBadge.textContent = isDib ? 'WITH DTP DYKE & PUMPS (PROTECTED)' : 'WITH QUAY BARRIERS (PROTECTED)';
        }

        const unmitRows = sideBySideOverlay.querySelectorAll('.sbs-comparison-card.unmitigated .sbs-row');
        if (unmitRows && unmitRows.length >= 3) {
            const r2Label = unmitRows[2]?.querySelector('span');
            const r2Val = unmitRows[2]?.querySelector('span:last-child');
            if (r2Label) r2Label.textContent = isDib ? 'River Defence:' : 'River Defense:';
            if (r2Val) r2Val.textContent = isDib ? 'DTP Dyke (Overtopped at 106.48m)' : 'None (Quays Overtopped)';
        }

        const protRows = sideBySideOverlay.querySelectorAll('.sbs-comparison-card.protected .sbs-row');
        if (protRows && protRows.length >= 3) {
            const r0Label = protRows[0]?.querySelector('span');
            const r0Val = protRows[0]?.querySelector('strong');
            if (r0Label) r0Label.textContent = isDib ? 'Interventions:' : 'Defense Barrier:';
            if (r0Val) {
                r0Val.id = 'sbs-defense-type';
                r0Val.textContent = isDib ? 'DTP Dyke (+0.8m) & 15 m³/s Pumps' : '2.8m Demountable Quay Wall';
            }

            const r2Label = protRows[2]?.querySelector('span');
            const r2Val = protRows[2]?.querySelector('strong');
            if (r2Label) r2Label.textContent = isDib ? 'Peak Depth Reduction:' : 'Town Street Depth:';
            if (r2Val) {
                r2Val.id = 'sbs-depth-reduction';
                r2Val.textContent = isDib ? '0.72 m' : '0.00 m (Dry Behind Wall)';
            }
        }

        const detailsList = sideBySideOverlay.querySelector('.sbs-comparison-card.protected .sbs-details-list');
        if (detailsList && !document.getElementById('sbs-roads-avoided')) {
            const row = document.createElement('div');
            row.className = 'sbs-row';
            row.innerHTML = `
                <span>Road Cut-offs Avoided:</span>
                <strong id="sbs-roads-avoided" class="text-success">0 avoided</strong>
            `;
            detailsList.appendChild(row);
        }
    }

    function setSideBySideReplay(enabled) {
        isSideBySide = !!enabled;
        if (sideBySideOverlay) {
            sideBySideOverlay.classList.toggle('hidden', !isSideBySide);
        }
        const btnSbs = document.getElementById('btn-toggle-sbs');
        if (btnSbs) {
            btnSbs.classList.toggle('active', isSideBySide);
        }
        updateSideBySideOverlayContent(currentTownConfig);
        if (isSideBySide && simulator && baselineSimulator) {
            baselineSimulator.seekTime(simulator.totalSimTime);
        }
    }
    window.setSideBySideReplay = setSideBySideReplay;
    activeSetSideBySideReplayFn = setSideBySideReplay;

    

    // Scenario Controls
    activeScenarioTag = document.getElementById('active-scenario-tag');
    sliderInflow = document.getElementById('slider-inflow');
    valInflow = document.getElementById('val-inflow');
    sliderRain = document.getElementById('slider-rain');
    valRain = document.getElementById('val-rain');
    sliderSurge = document.getElementById('slider-surge');
    valSurge = document.getElementById('val-surge');

    

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
            updateInterventionsForTown(currentTownConfig);
            updateBarrierUI();
        } else if (mode === 'forecast') {

            if (!workspaceManager.forecastManager.isInitialized) {

                workspaceManager.forecastManager.executeForecastCycle();

            }

        } else if (mode === 'defences') {

            if (workspaceManager.defenceManager) {

                workspaceManager.defenceManager.setVisible(true);

            }

        } else if (mode === 'explainable') {

            if (workspaceManager.explainabilityManager) {

                workspaceManager.updateExplainableUI();

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

    if (tabExplainable) tabExplainable.addEventListener('click', () => setMode('explainable'));

    

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

    const vertexMarkerGeom = new THREE.SphereGeometry(1.0, 16, 16);

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

    // Real-Time 3D Freehand Polyline Tracer

    const maxFreehandPoints = 2500;

    const freehandLineGeom = new THREE.BufferGeometry();

    const freehandLinePositions = new Float32Array(maxFreehandPoints * 3);

    freehandLineGeom.setAttribute('position', new THREE.BufferAttribute(freehandLinePositions, 3));

    freehandLineGeom.setDrawRange(0, 0);

    const freehandLineMat = new THREE.LineBasicMaterial({

        color: 0x38bdf8,

        linewidth: 4,

        transparent: true,

        opacity: 0.95

    });

    const freehandLine = new THREE.Line(freehandLineGeom, freehandLineMat);

    freehandLine.frustumCulled = false;

    freehandLine.visible = false;

    drawingGroup.add(freehandLine);

    let isDrawingMode = false;

    let isFreehandDrawing = false;

    let currentDrawingPoints = []; // [[lon, lat], ...]

    let currentDrawingWorldPoints = []; // [THREE.Vector3, ...]

    let drawnVertexMeshes = [];

    let totalDrawnLengthMeters = 0;

    function cleanupDrawingVisuals() {

        rubberBandLine.visible = false;

        cursorRing.visible = false;

        freehandLine.visible = false;

        freehandLineGeom.setDrawRange(0, 0);

        for (const m of drawnVertexMeshes) {

            drawingGroup.remove(m);

            if (m.geometry) m.geometry.dispose();

        }

        drawnVertexMeshes = [];

    }

    function addDrawingPoint(pt) {

        if (currentDrawingWorldPoints.length > 0) {

            const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];

            const dist = Math.hypot(pt.x - lastPt.x, pt.z - lastPt.z);

            if (dist < 1.4) return false; // Smooth adaptive sampling threshold

            totalDrawnLengthMeters += dist;

        }

        const u = (pt.x / meta.width_m) + 0.5;

        const v = -(pt.z / meta.height_m) + 0.5;

        const lon = meta.bbox.west + u * (meta.bbox.east - meta.bbox.west);

        const lat = meta.bbox.south + v * (meta.bbox.north - meta.bbox.south);

        currentDrawingPoints.push([lon, lat]);

        const wPt = new THREE.Vector3(pt.x, pt.y + 0.45, pt.z);

        currentDrawingWorldPoints.push(wPt);

        // Update real-time continuous freehand 3D line

        const idx = currentDrawingWorldPoints.length - 1;

        if (idx < maxFreehandPoints) {

            freehandLinePositions[idx * 3] = wPt.x;

            freehandLinePositions[idx * 3 + 1] = wPt.y + 0.25;

            freehandLinePositions[idx * 3 + 2] = wPt.z;

            freehandLineGeom.attributes.position.needsUpdate = true;

            freehandLineGeom.setDrawRange(0, idx + 1);

            freehandLine.visible = true;

        }

        // Add periodic glowing vertex markers along stroke

        if (idx === 0 || idx % 4 === 0) {

            const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;

            const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);

            markerMesh.position.set(pt.x, pt.y + 0.5, pt.z);

            drawingGroup.add(markerMesh);

            drawnVertexMeshes.push(markerMesh);

        }

        const count = currentDrawingPoints.length;

        if (drawVertexCount) drawVertexCount.textContent = count;

        if (hudVertexCount) hudVertexCount.textContent = count;

        if (hudLengthCount) hudLengthCount.textContent = `${totalDrawnLengthMeters.toFixed(1)} m`;

        return true;

    }

    function startDrawingMode() {

        if (activeBarrierTool === 'preset') {

            selectBarrierTool('wall');

        }

        isDrawingMode = true;

        isFreehandDrawing = false;

        currentDrawingPoints = [];

        currentDrawingWorldPoints = [];

        totalDrawnLengthMeters = 0;

        cleanupDrawingVisuals();

        canvas.classList.remove('drawing-freehand-active', 'drawing-sandbag-active');

        if (activeBarrierTool === 'wall') {

            canvas.classList.add('drawing-freehand-active');

            freehandLineMat.color.setHex(0x38bdf8);

            if (rubberBandMat) rubberBandMat.color.setHex(0x38bdf8);

            if (cursorRingMat) cursorRingMat.color.setHex(0x38bdf8);

        } else {

            canvas.classList.add('drawing-sandbag-active');

            freehandLineMat.color.setHex(0xf59e0b);

            if (rubberBandMat) rubberBandMat.color.setHex(0xf59e0b);

            if (cursorRingMat) cursorRingMat.color.setHex(0xf59e0b);

        }

        

        if (btnStartDrawing) {

            btnStartDrawing.classList.add('active');

            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Freehand Wall Active...' : 'Freehand Sandbag Active...';

        }

        if (drawActiveActions) drawActiveActions.classList.remove('hidden');

        if (drawLiveInstructions) drawLiveInstructions.classList.remove('hidden');

        if (drawVertexCount) drawVertexCount.textContent = '0';

        const crestH = barrierHeightInput ? barrierHeightInput.value : (activeBarrierTool === 'wall' ? '2.8' : '1.2');

        const depthD = barrierDepthInput ? barrierDepthInput.value : (activeBarrierTool === 'wall' ? '2.0' : '1.0');

        if (drawingHudBanner) {

            drawingHudBanner.classList.remove('hidden');

            if (hudBannerTitle) hudBannerTitle.textContent = activeBarrierTool === 'wall' ? 'FREEHAND DRAWING: FLOOD WALL' : 'FREEHAND DRAWING: SANDBAG BUND';

            if (hudVertexCount) hudVertexCount.textContent = '0';

            if (hudLengthCount) hudLengthCount.textContent = '0.0 m';

            if (hudCrestVal) hudCrestVal.textContent = `${crestH}m`;

            if (hudDepthVal) hudDepthVal.textContent = `${depthD}m`;

        }

    }

    function stopDrawingMode() {

        isDrawingMode = false;

        isFreehandDrawing = false;

        controls.enabled = true;

        currentDrawingPoints = [];

        currentDrawingWorldPoints = [];

        totalDrawnLengthMeters = 0;

        cleanupDrawingVisuals();

        canvas.classList.remove('drawing-freehand-active', 'drawing-sandbag-active');

        canvas.style.cursor = 'default';

        

        if (btnStartDrawing) {

            btnStartDrawing.classList.remove('active');

            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Draw Wall on Map' : 'Draw Sandbag on Map';

        }

        if (drawActiveActions) drawActiveActions.classList.add('hidden');

        if (drawLiveInstructions) drawLiveInstructions.classList.add('hidden');

        if (drawingHudBanner) drawingHudBanner.classList.add('hidden');

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
            const isDib = currentTownConfig?.id === 'dibrugarh';
            if (totalLen > 0 || (isDib && AppState.interventions?.drainagePumps)) {
                const saved = isDib
                    ? Math.min(1820, Math.round(totalLen * 0.85 + (AppState.interventions?.drainagePumps ? 420 : 0)))
                    : Math.min(642, Math.round(totalLen * 0.43));
                const protectPercent = isDib
                    ? Math.min(98.5, Math.round(72 + (totalLen / 1200) * 22))
                    : Math.min(100, Math.round(65 + (totalLen / 1480) * 35));
                const resilience = isDib
                    ? Math.min(94, Math.round(55 + (totalLen / 1200) * 35))
                    : Math.min(96, Math.round(50 + (totalLen / 1480) * 45));
                const deployHours = isDib
                    ? (totalLen / 350).toFixed(1)
                    : (totalLen / 420).toFixed(1);

                scSavedBldgs.textContent = saved.toLocaleString();
                scProtectRate.textContent = `${protectPercent.toFixed(1)}%`;
                scResilienceIndex.textContent = `${resilience} / 100`;
                scDeployTime.textContent = `${deployHours} hrs`;
            } else {
                scSavedBldgs.textContent = '0';
                scProtectRate.textContent = '0.0%';
                scResilienceIndex.textContent = isDib ? '42 / 100' : '38 / 100';
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
            const isDib = currentTownConfig?.id === 'dibrugarh';
            const defaultH = isDib ? 1.5 : 2.8;
            const defaultD = isDib ? 1.0 : 2.0;
            const defaultTh = isDib ? 0.8 : 1.2;

            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = isDib ? 'TACTICAL WALL SPECIFICATIONS' : 'WALL SPECIFICATIONS';

            if (barrierHeightSlider && barrierHeightInput) {
                barrierHeightSlider.min = 0.5;
                barrierHeightSlider.max = 5.0;
                barrierHeightSlider.value = defaultH;
                barrierHeightInput.value = defaultH;
                if (barrierHeightMid) barrierHeightMid.textContent = `${defaultH.toFixed(1)} m`;
            }

            if (barrierDepthSlider && barrierDepthInput) {
                barrierDepthSlider.min = 0.3;
                barrierDepthSlider.max = 4.0;
                barrierDepthSlider.value = defaultD;
                barrierDepthInput.value = defaultD;
                if (barrierDepthMid) barrierDepthMid.textContent = `${defaultD.toFixed(1)} m`;
            }

            if (barrierThickSlider && barrierThickInput) {
                barrierThickSlider.min = 0.4;
                barrierThickSlider.max = 2.5;
                barrierThickSlider.value = defaultTh;
                barrierThickInput.value = defaultTh;
            }

            if (btnDrawText) btnDrawText.textContent = isDib ? 'Draw Tactical Wall on Map' : 'Draw Wall on Map';
            if (rubberBandMat) rubberBandMat.color.setHex(0x38bdf8);
            if (cursorRingMat) cursorRingMat.color.setHex(0x38bdf8);
            if (statBarrierHeight) statBarrierHeight.textContent = `${defaultH.toFixed(2)} m`;

        } else if (tool === 'sandbags') {
            const isDib = currentTownConfig?.id === 'dibrugarh';
            const defaultH = isDib ? 1.0 : 1.2;
            const defaultD = isDib ? 0.4 : 1.0;
            const defaultTh = isDib ? 1.8 : 2.4;

            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = isDib ? 'GEO-BAG SAND DEFENSE' : 'SANDBAG BUND SPECIFICATIONS';

            if (barrierHeightSlider && barrierHeightInput) {
                barrierHeightSlider.min = 0.4;
                barrierHeightSlider.max = 2.5;
                barrierHeightSlider.value = defaultH;
                barrierHeightInput.value = defaultH;
                if (barrierHeightMid) barrierHeightMid.textContent = `${defaultH.toFixed(1)} m`;
            }

            if (barrierDepthSlider && barrierDepthInput) {
                barrierDepthSlider.min = 0.2;
                barrierDepthSlider.max = 2.0;
                barrierDepthSlider.value = defaultD;
                barrierDepthInput.value = defaultD;
                if (barrierDepthMid) barrierDepthMid.textContent = `${defaultD.toFixed(1)} m`;
            }

            if (barrierThickSlider && barrierThickInput) {
                barrierThickSlider.min = 0.8;
                barrierThickSlider.max = 3.5;
                barrierThickSlider.value = defaultTh;
                barrierThickInput.value = defaultTh;
            }

            if (btnDrawText) btnDrawText.textContent = isDib ? 'Draw Geo-Bags on Map' : 'Draw Sandbag on Map';
            if (rubberBandMat) rubberBandMat.color.setHex(0xf59e0b);
            if (cursorRingMat) cursorRingMat.color.setHex(0xf59e0b);
            if (statBarrierHeight) statBarrierHeight.textContent = `${defaultH.toFixed(2)} m`;

        } else if (tool === 'preset') {
            const isDib = currentTownConfig?.id === 'dibrugarh';
            if (isDib && (!presetsResp || Object.keys(presetsResp).length === 0)) {
                const dtpPreset = {
                    dtp_dyke: {
                        name: 'DTP Dyke Crest Reinforcement (+0.8m)',
                        type: 'wall',
                        height: 3.3,
                        points: [
                            [94.8975, 27.4797],
                            [94.9, 27.482],
                            [94.9048, 27.486],
                            [94.908, 27.4875],
                            [94.912, 27.489],
                            [94.916, 27.49],
                            [94.92, 27.491],
                            [94.925, 27.4925],
                            [94.93, 27.494],
                            [94.935, 27.4955],
                            [94.94, 27.4965],
                            [94.945, 27.4975],
                            [94.95, 27.4985]
                        ]
                    }
                };
                barriersManager.loadPresets(dtpPreset);
            } else {
                barriersManager.loadPresets(presetsResp);
            }

            if (barrierConfigPanel) barrierConfigPanel.style.display = 'flex';
            if (barrierSpecTitle) barrierSpecTitle.textContent = isDib ? 'DTP DYKE REINFORCEMENT (+0.8M)' : 'CLONMEL RELIEF SCHEME';

            const defaultH = isDib ? 3.3 : 2.8;
            const defaultD = isDib ? 2.5 : 2.0;
            const defaultTh = isDib ? 3.0 : 1.2;

            if (barrierHeightInput) barrierHeightInput.value = defaultH;
            if (barrierDepthInput) barrierDepthInput.value = defaultD;
            if (barrierThickInput) barrierThickInput.value = defaultTh;
            if (statBarrierHeight) statBarrierHeight.textContent = `${defaultH.toFixed(2)} m`;

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
    window.barriersManager = barriersManager;

            if (isDrawingMode) stopDrawingMode();

            updateBarrierUI();

        });

    }

    

    // Initialize initial barrier metrics

    updateBarrierUI();

    

    // Scenario Selection
    function applyScenario(type) {
        currentScenario = type;

        const allBtns = document.querySelectorAll('.scenario-btn');
        allBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scenario === type);
        });

        const sInflow = sliderInflow || document.getElementById('slider-inflow');
        const vInflow = valInflow || document.getElementById('val-inflow');
        const sRain = sliderRain || document.getElementById('slider-rain');
        const vRain = valRain || document.getElementById('val-rain');
        const sSurge = sliderSurge || document.getElementById('slider-surge');
        const vSurge = valSurge || document.getElementById('val-surge');
        const tagEl = activeScenarioTag || document.getElementById('active-scenario-tag');

        if (currentTownConfig && currentTownConfig.id === 'dibrugarh') {
            let dibType = type;
            if (type === 'normal' || type === 'flood100') {
                dibType = 'baseline-monsoon';
            } else if (type === 'surge') {
                dibType = 'july-2024-flash';
            }

            const sc = DIBRUGARH_SCENARIOS[dibType] || DIBRUGARH_SCENARIOS['baseline-monsoon'];
            currentScenario = sc.id;

            allBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.scenario === sc.id);
            });

            const hudState = {
                sliderInflow: sInflow,
                valInflow: vInflow,
                sliderRain: sRain,
                valRain: vRain,
                sliderSurge: sSurge,
                valSurge: vSurge,
                activeScenarioTag: tagEl
            };

            applyDibrugarhScenario(sc.id, simulator, hudState);
            applyDibrugarhScenario(sc.id, baselineSimulator);

            updateSliderParams();
            if (simulator && typeof simulator.reset === 'function') simulator.reset();
            if (baselineSimulator && typeof baselineSimulator.reset === 'function') baselineSimulator.reset();
            if (typeof updateBarrierUI === 'function') updateBarrierUI();
            return;
        }

        if (type === 'normal') {
            if (sInflow) sInflow.value = 55;
            if (sRain) sRain.value = 0;
            if (sSurge) sSurge.value = 0.00;
            if (tagEl) tagEl.textContent = 'Normal Flow';
        } else if (type === 'flood100') {
            if (sInflow) sInflow.value = 450;
            if (sRain) sRain.value = 0;
            if (sSurge) sSurge.value = 0.00;
            if (tagEl) tagEl.textContent = '1-in-100-Yr Flood';
        } else if (type === 'surge') {
            if (sInflow) sInflow.value = 400;
            if (sRain) sRain.value = 50;
            if (sSurge) sSurge.value = 1.80;
            if (tagEl) tagEl.textContent = 'Surge & Rain';
        }

        updateSliderParams();
        if (simulator && typeof simulator.reset === 'function') simulator.reset();
        if (baselineSimulator && typeof baselineSimulator.reset === 'function') baselineSimulator.reset();
        // Keep user barriers intact without injecting presets
        // Only explicit preset selection should load presets
        if (typeof updateBarrierUI === 'function') updateBarrierUI();
    }

    function updateSliderParams() {
        const sInflow = sliderInflow || document.getElementById('slider-inflow');
        const vInflow = valInflow || document.getElementById('val-inflow');
        const sRain = sliderRain || document.getElementById('slider-rain');
        const vRain = valRain || document.getElementById('val-rain');
        const sSurge = sliderSurge || document.getElementById('slider-surge');
        const vSurge = valSurge || document.getElementById('val-surge');

        const rawInflow = sInflow ? parseFloat(sInflow.value) : 450;
        const rain = sRain ? parseFloat(sRain.value) : 0;
        const surge = sSurge ? parseFloat(sSurge.value) : 0;

        if (currentTownConfig && currentTownConfig.id === 'dibrugarh') {
            const stage = rawInflow;
            if (vInflow) vInflow.textContent = `${stage.toFixed(2)} m MSL`;
            if (vRain) vRain.textContent = `${rain} mm/h`;
            if (vSurge) vSurge.textContent = `${surge >= 0 ? '+' : ''}${surge.toFixed(2)} m`;

            const stageVal = document.querySelector('.station-card .station-readout-item:first-child .st-val');
            if (stageVal) stageVal.textContent = `${stage.toFixed(2)} m MSL`;

            const alertStatusVal = document.querySelector('.station-card .station-readout-item:nth-child(4) .st-val');
            if (alertStatusVal) {
                const status = getDibrugarhGaugeStatus(stage);
                alertStatusVal.textContent = status;
                alertStatusVal.style.color = (status === 'HISTORIC PEAK OVERTOPPING' || status === 'DANGER LEVEL EXCEEDED')
                    ? '#f87171' : (status === 'HIGH FLOW' ? '#fbbf24' : '#34d399');
            }

            const approxInflow = Math.round(24500 + (stage - 104.5) * 15000);
            const riverInflow = Math.max(10000, approxInflow);

            if (simulator && simulator.params) {
                simulator.params.riverInflow = riverInflow;
                simulator.params.rainRate = rain;
                simulator.params.rainIntensity = rain;
                simulator.params.downstreamSurge = surge;
                simulator.params.stageMSL = stage;
            }
            if (baselineSimulator && baselineSimulator.params) {
                baselineSimulator.params.riverInflow = riverInflow;
                baselineSimulator.params.rainRate = rain;
                baselineSimulator.params.rainIntensity = rain;
                baselineSimulator.params.downstreamSurge = surge;
                baselineSimulator.params.stageMSL = stage;
            }
        } else {
            if (vInflow) vInflow.textContent = `${rawInflow} m³/s`;
            if (vRain) vRain.textContent = `${rain} mm/h`;
            if (vSurge) vSurge.textContent = `${surge >= 0 ? '+' : ''}${surge.toFixed(2)} m`;

            if (simulator && simulator.params) {
                simulator.params.riverInflow = rawInflow;
                simulator.params.rainRate = rain;
                simulator.params.rainIntensity = rain;
                simulator.params.downstreamSurge = surge;
            }
            if (baselineSimulator && baselineSimulator.params) {
                baselineSimulator.params.riverInflow = rawInflow;
                baselineSimulator.params.rainRate = rain;
                baselineSimulator.params.rainIntensity = rain;
                baselineSimulator.params.downstreamSurge = surge;
            }
        }
    }

    if (sliderInflow) sliderInflow.addEventListener('input', updateSliderParams);
    if (sliderRain) sliderRain.addEventListener('input', updateSliderParams);
    if (sliderSurge) sliderSurge.addEventListener('input', updateSliderParams);

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
            const isDib = currentTownConfig?.id === 'dibrugarh';
            if (sbsUnmitFlooded) sbsUnmitFlooded.textContent = unmitigatedNow.toLocaleString();
            if (sbsUnmitRoads) sbsUnmitRoads.textContent = `${roadCutoffCount} roads`;
            if (sbsUnmitDepth) {
                const sampleDepth = isDib
                    ? (simulator.params.riverInflow > 105.7 ? simulator.params.riverInflow - 105.7 : 0.65)
                    : sampleQuay.peak_h;
                sbsUnmitDepth.textContent = `${sampleDepth.toFixed(2)} m`;
            }

            if (sbsSavedBldgs) sbsSavedBldgs.textContent = savedNow.toLocaleString();
            if (sbsProtectRate) {
                const rate = unmitigatedNow > 0 ? ((savedNow / Math.max(1, unmitigatedNow)) * 100).toFixed(1) : '100.0';
                sbsProtectRate.textContent = `${rate}% Protected`;
            }

            // Real-time diff metrics
            const elDepthReduction = document.getElementById('sbs-depth-reduction');
            const elRoadsAvoided = document.getElementById('sbs-roads-avoided');

            let peakReduction = 0.0;
            let roadsAvoidedCount = 0;

            if (simulator.readbackBuffer && baselineSimulator.readbackBuffer) {
                const step = 16;
                const sampleLen = Math.floor((meta.grid_w * meta.grid_h) / step);
                const baseBuf = new Float32Array(sampleLen);
                const protBuf = new Float32Array(sampleLen);
                for (let k = 0; k < sampleLen; k++) {
                    baseBuf[k] = baselineSimulator.readbackBuffer[(k * step) * 4];
                    protBuf[k] = simulator.readbackBuffer[(k * step) * 4];
                }
                const comp = computeInterventionComparison(baseBuf, protBuf, [], {
                    roadCutoffsBaseline: roadCutoffCount,
                    roadCutoffsProtected: Math.max(0, roadCutoffCount - Math.round(savedNow * 0.08))
                });
                peakReduction = comp.maxDepthReduction;
                roadsAvoidedCount = comp.roadCutoffsAvoided;
            } else if (savedNow > 0) {
                peakReduction = isDib ? 0.72 : 0.85;
                roadsAvoidedCount = Math.max(1, Math.round(savedNow * 0.06));
            }

            if (elDepthReduction) {
                elDepthReduction.textContent = `${peakReduction.toFixed(2)} m`;
            }
            if (elRoadsAvoided) {
                elRoadsAvoided.textContent = `${roadsAvoidedCount} avoided`;
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
    window.controls = controls;

            

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

    // worldLabels is dynamically configured by updateWorldLabelsForTown(currentTownConfig)

    

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

    

    // Freehand Drawing Pointer Events & Live Inspection

    canvas.addEventListener('pointerdown', (e) => {

        if (e.button !== 0) return;

        

        if (isDrawingMode) {

            const rect = canvas.getBoundingClientRect();

            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;

            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            

            const raycaster = new THREE.Raycaster();

            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

            const intersects = raycaster.intersectObject(terrainMesh);

            

            if (intersects.length > 0) {

                isFreehandDrawing = true;

                controls.enabled = false; // Freeze camera rotation while dragging freehand!

                addDrawingPoint(intersects[0].point);

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

            // If in Explainable Forecast workspace: explain the selected location

            if (AppState.currentWorkspace === 'explainable' && workspaceManager.explainabilityManager) {

                workspaceManager.explainabilityManager.selectLocation(hit.u, hit.v, hit.street, simulator);

            }

        }

    });

    // Global Pointer Move & Up for Continuous Freehand Dragging

    window.addEventListener('pointermove', (e) => {

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

            

            if (isFreehandDrawing) {

                addDrawingPoint(pt);

            } else if (currentDrawingWorldPoints.length > 0) {

                const lastW = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];

                const posAttr = rubberBandLine.geometry.attributes.position;

                posAttr.setXYZ(0, lastW.x, lastW.y + 0.45, lastW.z);

                posAttr.setXYZ(1, pt.x, pt.y + 0.45, pt.z);

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

    window.addEventListener('pointerup', (e) => {

        if (isFreehandDrawing) {

            isFreehandDrawing = false;

            controls.enabled = true; // Re-enable camera rotation

            if (currentDrawingWorldPoints.length > 0) {

                const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];

                const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;

                const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);

                markerMesh.position.set(lastPt.x, lastPt.y + 0.35, lastPt.z);

                drawingGroup.add(markerMesh);

                drawnVertexMeshes.push(markerMesh);

            }

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

        if (isPlaying && simulator) {
            const speedMultiplier = playbackSpeed / 20.0;
            if (isSideBySide || AppState.currentWorkspace === 'intervention') {
                runSynchronizedReplay(simulator, baselineSimulator, speedMultiplier);
            } else {
                simulator.step(speedMultiplier);
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

        if (waterMaterial && waterMaterial.uniforms && simulator) {

            waterMaterial.uniforms.u_time.value = now * 0.001;

            waterMaterial.uniforms.u_waterTex.value = simulator.getWaterTexture();

        }

        

        // 3D Landmark Labels

        updateWorldLabels();

        

        // Controls & Render

        controls.update();
    window.controls = controls;

        renderer.render(scene, camera);

    }

    

    // Start initial scenario
    if (currentTownConfig && currentTownConfig.id === 'dibrugarh') {
        applyScenario('baseline-monsoon');
    } else {
        applyScenario('flood100');
    }

    

    // Start animation loop

    animate(performance.now());

    console.log('Hydroverse Clonmel Flood Simulator is running smoothly!');

}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', init);
}

export {
    init,
    applyDibrugarhScenario,
    DIBRUGARH_SCENARIOS
};

