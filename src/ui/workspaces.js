/**
 * workspaces.js
 * 
 * Controller and UI View Manager for the 5 Hydroverse Workspaces:
 * 1. Live Flood Map
 * 2. Flood Time Machine
 * 3. Intervention Lab
 * 4. Impact Intelligence
 * 5. Science & Validation
 */

import { AppState } from './state.js';

export class WorkspaceManager {
    constructor(elements, simulator, baselineSimulator, roadGraph, interventionEngine, validationMetrics, overlays, barriersManager) {
        this.elements = elements;
        this.simulator = simulator;
        this.baselineSimulator = baselineSimulator;
        this.roadGraph = roadGraph;
        this.interventionEngine = interventionEngine;
        this.validationMetrics = validationMetrics;
        this.overlays = overlays;
        this.barriersManager = barriersManager;
        
        // Depth-over-time hydrograph history buffer (up to 60 samples)
        this.hydrographData = [];
        
        this.initEventListeners();
        this.updateView();
    }
    
    initEventListeners() {
        const { tabs, overlayToggles, scenarioBtns, historicalBtns, interventionControls, storyControls } = this.elements;
        
        // 1. Top Workspace Tabs
        if (tabs) {
            Object.entries(tabs).forEach(([workspaceKey, btn]) => {
                if (btn) {
                    btn.addEventListener('click', () => {
                        this.setWorkspace(workspaceKey);
                    });
                }
            });
        }
        
        // 2. Analytical Overlay Toggles (Live Map)
        if (overlayToggles) {
            overlayToggles.forEach(toggle => {
                toggle.addEventListener('click', () => {
                    const overlayKey = toggle.dataset.overlay;
                    const isActive = toggle.classList.toggle('active');
                    AppState.setOverlay(overlayKey, isActive);
                    
                    // Map overlay key to shader mode
                    if (!isActive) {
                        // Check if any other overlay is active
                        let nextMode = 0;
                        if (AppState.overlays.depthHeatmap) nextMode = 1;
                        else if (AppState.overlays.arrivalTime) nextMode = 2;
                        else if (AppState.overlays.duration) nextMode = 3;
                        else if (AppState.overlays.unintendedConsequences) nextMode = 4;
                        else if (AppState.overlays.uncertainty) nextMode = 5;
                        this.overlays.setMode(nextMode);
                    } else {
                        // Turn off mutually exclusive visual modes for clear rendering
                        overlayToggles.forEach(other => {
                            if (other !== toggle && other.dataset.overlay !== 'uncertainty') {
                                other.classList.remove('active');
                                AppState.overlays[other.dataset.overlay] = false;
                            }
                        });
                        
                        let mode = 1;
                        if (overlayKey === 'depthHeatmap') mode = 1;
                        else if (overlayKey === 'arrivalTime') mode = 2;
                        else if (overlayKey === 'duration') mode = 3;
                        else if (overlayKey === 'unintendedConsequences') mode = 4;
                        else if (overlayKey === 'uncertainty') mode = 5;
                        this.overlays.setMode(mode);
                    }
                    this.updateOverlayLegend();
                });
            });
        }
        
        // 3. Historical Events Library (Time Machine)
        if (historicalBtns) {
            historicalBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const eventKey = btn.dataset.event;
                    historicalBtns.forEach(b => b.classList.toggle('active', b === btn));
                    this.loadHistoricalEvent(eventKey);
                });
            });
        }
        
        // 4. Guided Story Mode Controls ("ONE STORM. TWO FUTURES.")
        if (storyControls) {
            if (storyControls.btnStart) {
                storyControls.btnStart.addEventListener('click', () => {
                    AppState.startStoryMode();
                    this.applyStoryStep(0);
                });
            }
            if (storyControls.btnNext) {
                storyControls.btnNext.addEventListener('click', () => {
                    const next = AppState.nextStoryStep();
                    this.applyStoryStep(next);
                });
            }
            if (storyControls.btnPrev) {
                storyControls.btnPrev.addEventListener('click', () => {
                    const prev = AppState.prevStoryStep();
                    this.applyStoryStep(prev);
                });
            }
            if (storyControls.btnClose) {
                storyControls.btnClose.addEventListener('click', () => {
                    AppState.endStoryMode();
                    this.updateStoryUI();
                });
            }
        }
        
        // 5. SuDS & Pump Infrastructure Toggles (Intervention Lab)
        if (interventionControls) {
            if (interventionControls.btnSuds) {
                interventionControls.btnSuds.addEventListener('click', () => {
                    const active = interventionControls.btnSuds.classList.toggle('active');
                    AppState.interventions.sudsPermeableSoil = active;
                    this.interventionEngine.setSudsActive(active, this.simulator);
                    this.updateInterventionUI();
                });
            }
            if (interventionControls.btnPumps) {
                interventionControls.btnPumps.addEventListener('click', () => {
                    const active = interventionControls.btnPumps.classList.toggle('active');
                    AppState.interventions.drainagePumps = active;
                    this.interventionEngine.setPumpsActive(active, this.simulator);
                    this.updateInterventionUI();
                });
            }
            if (interventionControls.btnDiffToggle) {
                interventionControls.btnDiffToggle.addEventListener('click', () => {
                    const active = interventionControls.btnDiffToggle.classList.toggle('active');
                    AppState.setOverlay('unintendedConsequences', active);
                    this.overlays.setMode(active ? 4 : 0);
                    this.updateOverlayLegend();
                });
            }
        }
    }
    
    setWorkspace(workspaceKey) {
        AppState.setWorkspace(workspaceKey);
        
        // Highlight active top tab
        if (this.elements.tabs) {
            Object.entries(this.elements.tabs).forEach(([k, btn]) => {
                if (btn) btn.classList.toggle('active', k === workspaceKey);
            });
        }
        
        this.updateView();
    }
    
    updateView() {
        const ws = AppState.currentWorkspace;
        const { leftPanels, rightPanels, bottomElements } = this.elements;
        
        // Show/hide corresponding left and right panel views
        if (leftPanels) {
            Object.entries(leftPanels).forEach(([k, panel]) => {
                if (panel) panel.classList.toggle('hidden', k !== ws);
            });
        }
        if (rightPanels) {
            Object.entries(rightPanels).forEach(([k, panel]) => {
                if (panel) panel.classList.toggle('hidden', k !== ws);
            });
        }
        
        // Workspace-specific initialization
        if (ws === 'live') {
            let mode = 0;
            if (AppState.overlays.depthHeatmap) mode = 1;
            else if (AppState.overlays.arrivalTime) mode = 2;
            else if (AppState.overlays.duration) mode = 3;
            else if (AppState.overlays.unintendedConsequences) mode = 4;
            else if (AppState.overlays.uncertainty) mode = 5;
            this.overlays.setMode(mode);
        } else if (ws === 'time') {
            this.drawHydrographChart();
        } else if (ws === 'intervention') {
            this.updateInterventionUI();
            if (AppState.overlays.unintendedConsequences) {
                this.overlays.setMode(4);
            }
        } else if (ws === 'impact') {
            this.updateImpactView();
        } else if (ws === 'science') {
            this.updateScienceView();
        }
        
        this.updateOverlayLegend();
    }
    
    updateOverlayLegend() {
        const legendEl = document.getElementById('overlay-legend');
        if (!legendEl) return;
        
        const mode = this.overlays.material.uniforms.u_mode.value;
        if (mode === 0) {
            legendEl.classList.add('hidden');
            return;
        }
        
        legendEl.classList.remove('hidden');
        if (mode === 1) {
            // Depth Heatmap Legend
            legendEl.innerHTML = `
                <div class="legend-header"><span>DEPTH HEATMAP</span><span class="legend-unit">Meters (m)</span></div>
                <div class="legend-bar depth-gradient"></div>
                <div class="legend-labels">
                    <span>0.05m Shallow</span>
                    <span>0.30m Hazard</span>
                    <span>&gt;1.0m Severe</span>
                </div>
            `;
        } else if (mode === 2) {
            // Arrival Time Legend
            legendEl.innerHTML = `
                <div class="legend-header"><span>FLOOD ARRIVAL TIME</span><span class="legend-unit">Hours</span></div>
                <div class="legend-bar arrival-gradient"></div>
                <div class="legend-labels">
                    <span>0h (Early)</span>
                    <span>2h - 4h (Mid)</span>
                    <span>&gt;5h (Late)</span>
                </div>
            `;
        } else if (mode === 3) {
            // Duration Legend
            legendEl.innerHTML = `
                <div class="legend-header"><span>FLOOD DURATION</span><span class="legend-unit">Hours Submerged</span></div>
                <div class="legend-bar duration-gradient"></div>
                <div class="legend-labels">
                    <span>&lt;1h Transient</span>
                    <span>2h - 4h Standing</span>
                    <span>&gt;6h Inundated</span>
                </div>
            `;
        } else if (mode === 4) {
            // Unintended Consequences / Difference
            legendEl.innerHTML = `
                <div class="legend-header"><span>INTERVENTION SPATIAL DIFFERENCE</span></div>
                <div class="legend-split-row">
                    <span class="pill-green">■ Green: Flood Alleviated (Protected)</span>
                    <span class="pill-magenta">■ Magenta: Surcharge Displaced</span>
                </div>
            `;
        } else if (mode === 5) {
            // Uncertainty
            legendEl.innerHTML = `
                <div class="legend-header"><span>HYDRAULIC UNCERTAINTY ENVELOPE</span></div>
                <div class="legend-labels">
                    <span>±15% Roughness Bounds (Wetting Perimeter)</span>
                </div>
            `;
        }
    }
    
    loadHistoricalEvent(eventKey) {
        AppState.historicalEvent = eventKey;
        
        let inflow = 450;
        let rain = 0;
        let surge = 0.0;
        let eventName = '';
        let eventDesc = '';
        
        if (eventKey === 'storm_frank_2015') {
            inflow = 465;
            rain = 65;
            surge = 0.45;
            eventName = 'Storm Frank (December 2015)';
            eventDesc = 'Continuous heavy Atlantic depression. River Suir crested at 4.2m OD at Convent Bridge with severe commercial inundation across the Irishtown and Quay corridors.';
        } else if (eventKey === 'flood_2008') {
            inflow = 420;
            rain = 40;
            surge = 0.20;
            eventName = 'River Suir Flood (January 2008)';
            eventDesc = 'Overland flow overtopped the Old Bridge quay wall and severed vehicular traffic along the N24 and Western Road.';
        } else if (eventKey === 'flood_2000') {
            inflow = 480;
            rain = 75;
            surge = 0.50;
            eventName = 'Historic Benchmark Flood (November 2000)';
            eventDesc = 'Largest modern unmitigated flood event prior to the Clonmel Flood Relief Scheme. Over 350 properties severely flooded.';
        }
        
        // Update simulation parameters
        this.simulator.params.riverInflow = inflow;
        this.simulator.params.rainRate = rain;
        this.simulator.params.downstreamSurge = surge;
        this.baselineSimulator.params.riverInflow = inflow;
        this.baselineSimulator.params.rainRate = rain;
        this.baselineSimulator.params.downstreamSurge = surge;
        
        // Reset and trigger simulation
        this.simulator.reset();
        this.baselineSimulator.reset();
        this.hydrographData = [];
        
        // Update UI info card
        const cardTitle = document.getElementById('hist-event-title');
        const cardDesc = document.getElementById('hist-event-desc');
        const cardInflow = document.getElementById('hist-inflow-val');
        if (cardTitle) cardTitle.textContent = eventName;
        if (cardDesc) cardDesc.textContent = eventDesc;
        if (cardInflow) cardInflow.textContent = `${inflow} m³/s`;
    }
    
    applyStoryStep(stepIdx) {
        const steps = AppState.storyMode.steps;
        if (stepIdx < 0 || stepIdx >= steps.length) return;
        
        const step = steps[stepIdx];
        const titleEl = document.getElementById('story-step-title');
        const descEl = document.getElementById('story-step-desc');
        const numEl = document.getElementById('story-step-num');
        
        if (titleEl) titleEl.textContent = step.title;
        if (descEl) descEl.textContent = step.desc;
        if (numEl) numEl.textContent = `Step ${stepIdx + 1} of ${steps.length}`;
        
        // Perform corresponding automated simulation action
        if (stepIdx === 0) {
            // Baseline 55 m³/s
            this.simulator.params.riverInflow = 55;
            this.simulator.reset();
            this.barriersManager.clearAll();
        } else if (stepIdx === 1) {
            // Storm surge 450 m³/s
            this.simulator.params.riverInflow = 450;
            this.simulator.reset();
        } else if (stepIdx === 2) {
            // Fast forward to 01:30 overtopping
            this.simulator.totalSimTime = 5400;
        } else if (stepIdx === 3) {
            // Show Impact intelligence workspace
            this.setWorkspace('impact');
        } else if (stepIdx === 4) {
            // Deploy Quay walls & Intervention Lab
            this.setWorkspace('intervention');
            this.barriersManager.loadPresets(null);
        } else if (stepIdx === 5) {
            // Show outcome comparison
            this.setWorkspace('time');
        }
        
        this.updateStoryUI();
    }
    
    updateStoryUI() {
        const storyCard = document.getElementById('story-mode-card');
        if (!storyCard) return;
        storyCard.classList.toggle('hidden', !AppState.storyMode.active);
    }
    
    updateInterventionUI() {
        const bldgStats = AppState.metrics;
        const roadStats = AppState.metrics;
        const scorecard = this.interventionEngine.generateScorecard(this.barriersManager, bldgStats, roadStats);
        
        const scWallLen = document.getElementById('sc-wall-length');
        const scSavedBldgs = document.getElementById('sc-saved-bldgs');
        const scProtRate = document.getElementById('sc-protect-rate');
        const scResilience = document.getElementById('sc-resilience-index');
        const scDeployTime = document.getElementById('sc-deploy-time');
        
        if (scWallLen) scWallLen.textContent = `${scorecard.defenses.wallLengthM.toLocaleString()} m`;
        if (scSavedBldgs) scSavedBldgs.textContent = scorecard.outcomes.savedBuildings.toLocaleString();
        if (scProtRate) scProtRate.textContent = `${scorecard.outcomes.protectionRatePct}%`;
        if (scResilience) scResilience.textContent = `${scorecard.outcomes.resilienceIndex} / 100`;
        if (scDeployTime) scDeployTime.textContent = `${scorecard.outcomes.deploymentTimeHrs} hrs`;
    }
    
    updateImpactView() {
        const roadAnalysis = this.roadGraph.analyze(this.simulator);
        if (!roadAnalysis) return;
        
        const hospStatus = document.getElementById('impact-hospital-status');
        const hospBadge = document.getElementById('impact-hospital-badge');
        const hospDist = document.getElementById('impact-hospital-dist');
        const roadsCutoffKm = document.getElementById('impact-roads-km');
        const roadsCutoffCount = document.getElementById('impact-roads-count');
        const sectorIsland = document.getElementById('sector-suir-island');
        const sectorQuay = document.getElementById('sector-the-quay');
        const sectorOldBridge = document.getElementById('sector-old-bridge');
        
        if (hospBadge && hospStatus) {
            if (roadAnalysis.hospital.accessible) {
                hospBadge.className = 'status-pill-green';
                hospBadge.textContent = 'ACCESSIBLE';
                hospStatus.textContent = roadAnalysis.hospital.routeCondition;
            } else {
                hospBadge.className = 'status-pill-red';
                hospBadge.textContent = 'SEVERED';
                hospStatus.textContent = roadAnalysis.hospital.routeCondition;
            }
        }
        if (hospDist) hospDist.textContent = `${roadAnalysis.hospital.distanceKm > 0 ? roadAnalysis.hospital.distanceKm : 1.4} km`;
        if (roadsCutoffKm) roadsCutoffKm.textContent = `${roadAnalysis.totalFloodedKm} km`;
        if (roadsCutoffCount) roadsCutoffCount.textContent = roadAnalysis.floodedEdgesCount;
        
        if (sectorIsland) sectorIsland.textContent = roadAnalysis.sectors.suirIslandCutoff ? 'ISOLATED' : 'Connected';
        if (sectorQuay) sectorQuay.textContent = roadAnalysis.sectors.quayCutoff ? 'INUNDATED' : 'Protected';
        if (sectorOldBridge) sectorOldBridge.textContent = roadAnalysis.sectors.oldBridgeCutoff ? 'CUT OFF' : 'Passable';
    }
    
    updateScienceView() {
        const massMetrics = this.validationMetrics.evaluateMassBalance(this.simulator);
        const massVal = document.getElementById('sci-mass-error');
        const massBadge = document.getElementById('sci-mass-badge');
        const massVol = document.getElementById('sci-current-volume');
        
        if (massVal) massVal.textContent = `${massMetrics.massErrorPct}%`;
        if (massBadge) {
            massBadge.className = massMetrics.passed ? 'status-pill-green' : 'status-pill-red';
            massBadge.textContent = massMetrics.passed ? 'PASSED (<1.0%)' : 'WARNING';
        }
        if (massVol) massVol.textContent = `${(massMetrics.currentVolumeM3 / 1000).toFixed(1)}k m³`;
    }
    
    sampleHydrograph(simSec, samplePoint) {
        if (!samplePoint) return;
        const h = samplePoint.h || 0.0;
        
        this.hydrographData.push({ timeSec: simSec, depthM: h });
        if (this.hydrographData.length > 75) {
            this.hydrographData.shift();
        }
        
        if (AppState.currentWorkspace === 'time') {
            this.drawHydrographChart();
        }
    }
    
    drawHydrographChart() {
        const canvas = document.getElementById('hydrograph-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        
        // Background gridlines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 10; y < h; y += 22) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();
        
        if (this.hydrographData.length < 2) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
            ctx.font = '11px "DM Sans", sans-serif';
            ctx.fillText('Accumulating depth hydrograph over simulation time...', 15, h / 2);
            return;
        }
        
        // Find max depth for scaling
        let maxDepth = 0.5;
        for (const pt of this.hydrographData) {
            if (pt.depthM > maxDepth) maxDepth = pt.depthM;
        }
        maxDepth = Math.max(1.0, maxDepth * 1.25);
        
        // Draw depth curve
        ctx.beginPath();
        for (let i = 0; i < this.hydrographData.length; i++) {
            const pt = this.hydrographData[i];
            const x = (i / (this.hydrographData.length - 1)) * (w - 20) + 10;
            const y = h - 10 - (pt.depthM / maxDepth) * (h - 25);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.strokeStyle = '#38bdf8'; // Cyan line
        ctx.lineWidth = 2.2;
        ctx.stroke();
        
        // Fill area under curve
        const lastX = w - 10;
        ctx.lineTo(lastX, h - 10);
        ctx.lineTo(10, h - 10);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Current depth readout
        const currentDepth = this.hydrographData[this.hydrographData.length - 1].depthM;
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`Peak: ${maxDepth.toFixed(2)}m  Now: ${currentDepth.toFixed(2)}m`, w - 170, 18);
    }
}
