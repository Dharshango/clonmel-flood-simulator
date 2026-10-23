/**
 * workspaces.js
 * 
 * Controller and UI View Manager for the 7 Hydroverse Workspaces:
 * 1. Live Flood Map
 * 2. Flood Time Machine
 * 3. Intervention Lab
 * 4. Critical Infrastructure Dependency Map
 * 5. Community Flood Evidence Network
 * 6. Emergency Command Exercise
 * 7. Science & Numerical SWE Validation
 */

import { AppState } from './state.js';
import { InfrastructureDependencyManager } from '../analysis/infrastructure_dependency.js';
import { CommunityEvidenceManager } from '../evidence/community_evidence.js';
import { EmergencyCommandExerciseManager } from '../exercise/command_exercise.js';
import { ForecastManager } from '../forecasting/forecast_manager.js';
import { DefencePerformanceManager } from '../defences/defence_manager.js';
import { ExplainabilityManager } from '../explainability/explainability_manager.js';

export class WorkspaceManager {
    constructor(elements, simulator, baselineSimulator, roadGraph, interventionEngine, validationMetrics, overlays, barriersManager, scene, meta, elevArray) {
        this.elements = elements;
        this.simulator = simulator;
        this.baselineSimulator = baselineSimulator;
        this.roadGraph = roadGraph;
        this.interventionEngine = interventionEngine;
        this.validationMetrics = validationMetrics;
        this.overlays = overlays;
        this.barriersManager = barriersManager;
        this.scene = scene;
        this.meta = meta;
        this.elevArray = elevArray;
        
        // Depth-over-time hydrograph history buffer (up to 75 samples)
        this.hydrographData = [];
        
        // Decision-Support Managers
        this.infraManager = new InfrastructureDependencyManager(scene, meta, roadGraph);
        this.evidenceManager = new CommunityEvidenceManager(scene, meta);
        this.exerciseManager = new EmergencyCommandExerciseManager(scene, simulator, roadGraph, barriersManager, interventionEngine);
        
        // Real-Time Flood Forecasting Manager
        this.forecastManager = new ForecastManager();
        this.forecastManager.onUpdate(() => this.updateForecastUI());
        
        // Flood Defence Performance Monitor Manager
        this.defenceManager = new DefencePerformanceManager(scene, meta, elevArray);
        this.defenceManager.onUpdate(() => this.updateDefenceUI());
        this.defenceManager.loadDefenceDataset();
        
        // Explainable Flood Forecast Manager
        this.explainabilityManager = new ExplainabilityManager(meta, elevArray, this.forecastManager);
        this.explainabilityManager.onUpdate(() => this.updateExplainableUI());
        
        // Active Filter States
        this.evidenceActiveFilter = 'all';
        
        this.initEventListeners();
        this.updateView();
    }
    
    initEventListeners() {
        this.initForecastControls();
        this.initDefenceControls();
        this.initExplainableControls();
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
                    
                    if (!isActive) {
                        let nextMode = 0;
                        if (AppState.overlays.depthHeatmap) nextMode = 1;
                        else if (AppState.overlays.arrivalTime) nextMode = 2;
                        else if (AppState.overlays.duration) nextMode = 3;
                        else if (AppState.overlays.unintendedConsequences) nextMode = 4;
                        else if (AppState.overlays.uncertainty) nextMode = 5;
                        this.overlays.setMode(nextMode);
                    } else {
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

        // 6. Infrastructure Category Filters (Feature 1)
        const infraChips = document.querySelectorAll('.infra-chip');
        infraChips.forEach(chip => {
            chip.addEventListener('click', () => {
                infraChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const cat = chip.dataset.filter;
                this.infraManager.setFilter(cat);
                this.updateInfraView();
            });
        });

        // 7. Community Evidence Filters & Review Actions (Feature 2)
        const evidenceChips = document.querySelectorAll('.evidence-chip');
        evidenceChips.forEach(chip => {
            chip.addEventListener('click', () => {
                evidenceChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.evidenceActiveFilter = chip.dataset.filter;
                this.updateEvidenceView();
            });
        });

        const btnEvVerify = document.getElementById('btn-ev-verify');
        const btnEvReject = document.getElementById('btn-ev-reject');
        if (btnEvVerify) {
            btnEvVerify.addEventListener('click', () => {
                if (this.evidenceManager.selectedReport) {
                    this.evidenceManager.updateReportStatus(this.evidenceManager.selectedReport.id, 'verified', 'Clonmel Flood Ops', 'Benchmark verified via field gauge survey.');
                    this.updateEvidenceView();
                }
            });
        }
        if (btnEvReject) {
            btnEvReject.addEventListener('click', () => {
                if (this.evidenceManager.selectedReport) {
                    this.evidenceManager.updateReportStatus(this.evidenceManager.selectedReport.id, 'rejected', 'Clonmel Flood Ops', 'Residual exceeds acceptable hydraulic tolerance.');
                    this.updateEvidenceView();
                }
            });
        }

        // 8. Emergency Command Exercise Navigation (Feature 3)
        const btnAdvance = document.getElementById('btn-exercise-advance');
        const btnRestart = document.getElementById('btn-exercise-restart');
        if (btnAdvance) {
            btnAdvance.addEventListener('click', () => {
                const totalPhases = this.exerciseManager.scenario.phases.length;
                if (this.exerciseManager.currentPhaseIdx >= totalPhases - 1) {
                    this.showDebriefModal();
                } else {
                    this.exerciseManager.advancePhase();
                    this.updateExerciseView();
                }
            });
        }
        if (btnRestart) {
            btnRestart.addEventListener('click', () => {
                this.exerciseManager.reset();
                this.simulator.seekTime(0);
                this.updateExerciseView();
            });
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
        const { leftPanels, rightPanels } = this.elements;
        
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
        
        // Workspace-specific 3D scene marker visibility & initialization
        if (ws === 'live') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            let mode = 0;
            if (AppState.overlays.depthHeatmap) mode = 1;
            else if (AppState.overlays.arrivalTime) mode = 2;
            else if (AppState.overlays.duration) mode = 3;
            else if (AppState.overlays.unintendedConsequences) mode = 4;
            else if (AppState.overlays.uncertainty) mode = 5;
            this.overlays.setMode(mode);
        } else if (ws === 'time') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.drawHydrographChart();
        } else if (ws === 'intervention') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.updateInterventionUI();
            if (AppState.overlays.unintendedConsequences) {
                this.overlays.setMode(4);
            }
        } else if (ws === 'impact') {
            this.infraManager.setVisible(true);
            this.evidenceManager.setVisible(false);
            this.updateInfraView();
        } else if (ws === 'evidence') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(true);
            this.updateEvidenceView();
        } else if (ws === 'exercise') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.updateExerciseView();
        } else if (ws === 'science') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.updateScienceView();
        } else if (ws === 'forecast') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.updateForecastUI();
        } else if (ws === 'defences') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            this.updateDefenceUI();
        } else if (ws === 'explainable') {
            this.infraManager.setVisible(false);
            this.evidenceManager.setVisible(false);
            if (this.defenceManager) this.defenceManager.setVisible(false);
            this.updateExplainableUI();
        }
        
        if (this.defenceManager) {
            this.defenceManager.setVisible(ws === 'defences');
        }
        
        this.updateOverlayLegend();
    }
    
    updateInfraView() {
        if (!this.infraManager) return;
        const evaluations = this.infraManager.update(this.simulator.totalSimTime, this.simulator);
        
        let accessibleCount = 0;
        let cautionCount = 0;
        let severedCount = 0;
        
        evaluations.forEach(ev => {
            if (ev.status === 'PASSABLE') accessibleCount++;
            else if (ev.status === 'CAUTION') cautionCount++;
            else severedCount++;
        });
        
        const elAcc = document.getElementById('infra-cnt-accessible');
        const elCaut = document.getElementById('infra-cnt-caution');
        const elSev = document.getElementById('infra-cnt-severed');
        if (elAcc) elAcc.textContent = accessibleCount;
        if (elCaut) elCaut.textContent = cautionCount;
        if (elSev) elSev.textContent = severedCount;
        
        // Render facilities scroll list
        const listEl = document.getElementById('infra-facilities-list');
        if (listEl) {
            const filter = this.infraManager.activeFilter;
            const filtered = evaluations.filter(ev => filter === 'all' || ev.facility.category === filter);
            const needsRebuild = !listEl.hasChildNodes() || this._lastInfraFilter !== filter || this._lastInfraSelectedId !== this.infraManager.selectedFacility?.id || listEl.children.length !== filtered.length;
            
            if (needsRebuild) {
                this._lastInfraFilter = filter;
                this._lastInfraSelectedId = this.infraManager.selectedFacility?.id;
                listEl.innerHTML = filtered.map(ev => {
                    const fac = ev.facility;
                    const isSelected = this.infraManager.selectedFacility?.id === fac.id;
                    let badgeClass = 'status-pill-green';
                    if (ev.status === 'CAUTION') badgeClass = 'status-pill-amber';
                    else if (ev.status === 'SEVERED' || ev.status === 'ISOLATED') badgeClass = 'status-pill-red';
                    
                    return `
                        <div class="infra-facility-item ${isSelected ? 'selected' : ''}" data-fac-id="${fac.id}">
                            <div class="fac-left">
                                <span class="fac-icon">${fac.icon || '📍'}</span>
                                <div class="fac-meta">
                                    <span class="fac-title">${fac.shortName || fac.name}</span>
                                    <span class="fac-road">${fac.ingressRoad}</span>
                                </div>
                            </div>
                            <div class="fac-right">
                                <span class="${badgeClass}">${ev.statusLabel}</span>
                                <span class="fac-depth">${ev.directDepthM > 0.02 ? ev.directDepthM.toFixed(2) + 'm' : 'Dry'}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Wire facility clicks
                listEl.querySelectorAll('.infra-facility-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const id = item.dataset.facId;
                        this.infraManager.highlightDependencies(id);
                        this._lastInfraSelectedId = id;
                        this.updateInfraView();
                    });
                });
            } else {
                // Update in place without recreating nodes
                filtered.forEach(ev => {
                    const item = listEl.querySelector(`[data-fac-id="${ev.facility.id}"]`);
                    if (item) {
                        const badge = item.querySelector('.status-pill-green, .status-pill-amber, .status-pill-red');
                        const depthEl = item.querySelector('.fac-depth');
                        if (badge) {
                            let badgeClass = 'status-pill-green';
                            if (ev.status === 'CAUTION') badgeClass = 'status-pill-amber';
                            else if (ev.status === 'SEVERED' || ev.status === 'ISOLATED') badgeClass = 'status-pill-red';
                            badge.className = badgeClass;
                            badge.textContent = ev.statusLabel;
                        }
                        if (depthEl) depthEl.textContent = ev.directDepthM > 0.02 ? ev.directDepthM.toFixed(2) + 'm' : 'Dry';
                    }
                });
            }
        }
        
        // Update selected facility deep-dive card
        const selFac = this.infraManager.selectedFacility;
        if (selFac) {
            const selEval = evaluations.find(e => e.facility.id === selFac.id) || evaluations[0];
            const nameEl = document.getElementById('infra-fac-name');
            const badgeEl = document.getElementById('infra-fac-badge');
            const elevEl = document.getElementById('infra-fac-elev');
            const roadEl = document.getElementById('infra-fac-road');
            const detourEl = document.getElementById('infra-fac-detour');
            const cascadeEl = document.getElementById('infra-fac-cascade');
            
            if (nameEl) nameEl.textContent = selFac.name;
            if (badgeEl) {
                let badgeClass = 'status-pill-green';
                if (selEval.status === 'CAUTION') badgeClass = 'status-pill-amber';
                else if (selEval.status === 'SEVERED' || selEval.status === 'ISOLATED') badgeClass = 'status-pill-red';
                badgeEl.className = badgeClass;
                badgeEl.textContent = selEval.statusLabel;
            }
            if (elevEl) elevEl.textContent = `${selFac.elevationOD.toFixed(1)}m OD (${selEval.directDepthM > 0.02 ? selEval.directDepthM.toFixed(2) + 'm water' : 'Dry Site'})`;
            if (roadEl) {
                roadEl.textContent = `${selFac.ingressRoad} (${selEval.ingressMaxDepthM > 0.02 ? (selEval.ingressMaxDepthM * 100).toFixed(0) + 'cm water' : 'Clear'})`;
                roadEl.style.color = selEval.ingressMaxDepthM >= 0.30 ? '#ef4444' : (selEval.ingressMaxDepthM >= 0.15 ? '#f59e0b' : '#34d399');
            }
            if (detourEl) detourEl.textContent = `${selFac.alternativeRoad} (+${selEval.detourDistKm.toFixed(1)} km detour)`;
            if (cascadeEl) cascadeEl.textContent = selEval.cascadingImpact;
        }
    }
    
    updateEvidenceView() {
        if (!this.evidenceManager) return;
        const reports = this.evidenceManager.reports;
        const activeFilter = this.evidenceActiveFilter || 'all';
        
        let verifiedCount = 0;
        let residualSum = 0;
        let residualCount = 0;
        
        reports.forEach(r => {
            if (r.verificationStatus === 'verified') verifiedCount++;
            const comp = this.evidenceManager.compareWithSimulation(r, this.simulator);
            if (comp) {
                residualSum += comp.residualDepthM;
                residualCount++;
            }
        });
        
        const meanResidual = residualCount > 0 ? (residualSum / residualCount) : 0.05;
        
        const totalEl = document.getElementById('ev-stat-total');
        const verEl = document.getElementById('ev-stat-verified');
        const resEl = document.getElementById('ev-stat-residual');
        if (totalEl) totalEl.textContent = reports.length;
        if (verEl) verEl.textContent = verifiedCount;
        if (resEl) resEl.textContent = `±${meanResidual.toFixed(2)}m`;
        
        // Populate reports feed
        const listEl = document.getElementById('evidence-reports-list');
        if (listEl) {
            const filtered = reports.filter(r => {
                const s = r.status || r.verificationStatus || 'verified';
                if (activeFilter === 'all') return true;
                if (activeFilter === 'verified') return s === 'verified';
                if (activeFilter === 'pending') return s === 'pending_review' || s === 'under_review';
                if (activeFilter === 'discrepant') return s === 'rejected';
                return true;
            });
            
            const needsRebuild = !listEl.hasChildNodes() || this._lastEvidenceFilter !== activeFilter || this._lastEvidenceReportsLen !== reports.length || this._lastEvidenceSelectedId !== this.evidenceManager.selectedReport?.id;
            
            if (needsRebuild) {
                this._lastEvidenceFilter = activeFilter;
                this._lastEvidenceReportsLen = reports.length;
                this._lastEvidenceSelectedId = this.evidenceManager.selectedReport?.id;
                
                listEl.innerHTML = filtered.map(r => {
                    const comp = this.evidenceManager.compareWithSimulation(r, this.simulator);
                    const isSelected = this.evidenceManager.selectedReport?.id === r.id;
                    const s = r.status || r.verificationStatus || 'verified';
                    let statusBadge = 'status-pill-green';
                    let statusLabel = 'VERIFIED';
                    if (s === 'pending_review' || s === 'under_review') {
                        statusBadge = 'status-pill-amber';
                        statusLabel = 'PENDING';
                    } else if (s === 'rejected') {
                        statusBadge = 'status-pill-red';
                        statusLabel = 'REJECTED';
                    }
                    const depthVal = r.reportedDepthM ?? r.depthM ?? 0;
                    
                    const simDepth = comp ? comp.simDepthM : 0.0;
                    const resM = comp ? comp.residualM : 0.0;
                    const agreementLabel = comp ? comp.agreement : 'COMPATIBLE';
                    let compatClass = 'COMPATIBLE';
                    if (resM <= 0.10) compatClass = 'EXACT';
                    else if (resM > 0.25) compatClass = 'DISCREPANT';
                    
                    return `
                        <div class="evidence-report-item ${isSelected ? 'selected' : ''}" data-report-id="${r.id}">
                            <div class="ev-item-header">
                                <span class="ev-item-title">${r.title}</span>
                                <span class="${statusBadge}">${statusLabel}</span>
                            </div>
                            <div class="ev-item-meta">
                                <span>Obs: <strong>${depthVal.toFixed(2)}m</strong></span>
                                <span>Sim: <strong style="color:#38bdf8;">${simDepth.toFixed(2)}m</strong></span>
                                <span class="ev-compat-pill ${compatClass}">${agreementLabel}</span>
                            </div>
                        </div>
                    `;
                }).join('');
                
                listEl.querySelectorAll('.evidence-report-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const repId = item.dataset.reportId;
                        const r = this.evidenceManager.reports.find(x => x.id === repId);
                        if (r) {
                            this.evidenceManager.selectedReport = r;
                            this._lastEvidenceSelectedId = r.id;
                            this.updateEvidenceView();
                        }
                    });
                });
            }
        }
        
        // Populate selected report card
        const selRep = this.evidenceManager.selectedReport || reports[0];
        if (selRep) {
            const comp = this.evidenceManager.compareWithSimulation(selRep, this.simulator);
            const titleEl = document.getElementById('ev-card-title');
            const badgeEl = document.getElementById('ev-card-badge');
            const repDepthEl = document.getElementById('ev-card-reported-depth');
            const simDepthEl = document.getElementById('ev-card-sim-depth');
            const resValEl = document.getElementById('ev-card-residual-val');
            const resFillEl = document.getElementById('ev-card-residual-fill');
            const notesEl = document.getElementById('ev-card-notes');
            
            const repStatus = selRep.status || selRep.verificationStatus || 'verified';
            const repDepthVal = selRep.reportedDepthM ?? selRep.depthM ?? 0;
            const simDepthVal = comp ? comp.simDepthM : 0.0;
            const resVal = comp ? comp.residualM : 0.0;
            const agreementText = comp ? comp.agreement : 'COMPATIBLE';
            
            if (titleEl) titleEl.textContent = selRep.title;
            if (badgeEl) {
                let badgeClass = 'status-pill-green';
                if (repStatus === 'pending_review' || repStatus === 'under_review') badgeClass = 'status-pill-amber';
                else if (repStatus === 'rejected') badgeClass = 'status-pill-red';
                badgeEl.className = badgeClass;
                badgeEl.textContent = repStatus.toUpperCase().replace('_', ' ');
            }
            if (repDepthEl) repDepthEl.textContent = `${repDepthVal.toFixed(2)} m`;
            if (simDepthEl) simDepthEl.textContent = `${simDepthVal.toFixed(2)} m`;
            if (resValEl) resValEl.textContent = `${resVal.toFixed(2)} m (${agreementText})`;
            if (resFillEl) {
                const fillPct = Math.min(100, (resVal / 0.50) * 100);
                resFillEl.style.width = `${fillPct}%`;
                resFillEl.className = `residual-bar-fill ${resVal <= 0.15 ? 'good' : 'bad'}`;
            }
            if (notesEl) notesEl.textContent = `${selRep.description || selRep.notes || ''} [Observer: ${selRep.observer || 'Citizen Observer'}]`;
        }
    }
    
    updateExerciseView() {
        if (!this.exerciseManager) return;
        const phase = this.exerciseManager.getCurrentPhase();
        const phaseIdx = this.exerciseManager.currentPhaseIdx;
        const totalPhases = this.exerciseManager.scenario.phases.length;
        
        const badgeEl = document.getElementById('exercise-phase-badge');
        const clockEl = document.getElementById('exercise-clock-text');
        const inflowEl = document.getElementById('exercise-inflow-text');
        const titleEl = document.getElementById('exercise-phase-title');
        const descEl = document.getElementById('exercise-phase-desc');
        
        if (badgeEl) badgeEl.textContent = `PHASE ${phaseIdx + 1} OF ${totalPhases}`;
        if (clockEl) clockEl.textContent = `T+${phase.clockTime}`;
        if (inflowEl) inflowEl.textContent = `Inflow: ${phase.riverInflow} m³/s`;
        if (titleEl) titleEl.textContent = phase.phaseName || phase.title || `Phase ${phaseIdx + 1}`;
        if (descEl) descEl.textContent = phase.brief || phase.scenarioDesc || '';
        
        // Update resources
        const res = this.exerciseManager.resources;
        const crewsEl = document.getElementById('res-crews');
        const pumpsEl = document.getElementById('res-pumps');
        const sandbagsEl = document.getElementById('res-sandbags');
        const trafficEl = document.getElementById('res-traffic');
        const boatsEl = document.getElementById('res-boats');
        
        if (crewsEl) crewsEl.textContent = res.barrierCrews ?? 0;
        if (pumpsEl) pumpsEl.textContent = (res.pumps15ms ?? res.drainagePumps ?? 0);
        if (sandbagsEl) sandbagsEl.textContent = (res.sandbagUnits ?? res.sandbagStockpiles ?? 0);
        if (trafficEl) trafficEl.textContent = (res.trafficTeams ?? res.trafficUnits ?? 0);
        if (boatsEl) boatsEl.textContent = res.rescueCraft ?? 0;
        
        // Populate tactical actions
        const actionsListEl = document.getElementById('exercise-actions-list');
        if (actionsListEl) {
            const needsRebuild = !actionsListEl.hasChildNodes() || this._lastExercisePhaseIdx !== phaseIdx;
            
            if (needsRebuild) {
                this._lastExercisePhaseIdx = phaseIdx;
                actionsListEl.innerHTML = phase.actions.map(action => {
                    const canAfford = this.exerciseManager.canExecuteAction(action);
                    const costChips = action.cost ? Object.entries(action.cost).map(([k, v]) => `<span class="res-cost-chip">${v} ${k}</span>`).join(' ') : '<span class="res-cost-chip free">Free</span>';
                    
                    return `
                        <div class="exercise-action-card">
                            <div class="action-top">
                                <span class="action-name">${action.name}</span>
                                <div class="action-costs">${costChips}</div>
                            </div>
                            <p class="action-consequence">${action.consequence}</p>
                            <button class="btn-execute-action ${canAfford ? 'primary-button' : 'btn-disabled'}" data-action-id="${action.id}" ${canAfford ? '' : 'disabled'}>
                                <span class="button-label">${canAfford ? 'Execute Command' : 'Insufficient Resources'}</span>
                            </button>
                        </div>
                    `;
                }).join('');
                
                actionsListEl.querySelectorAll('.btn-execute-action').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const actionId = btn.dataset.actionId;
                        const res = this.exerciseManager.executeAction(actionId);
                        if (res.success) {
                            this.updateExerciseView();
                        } else {
                            alert(res.message);
                        }
                    });
                });
            } else {
                // Update button disabled state in place
                actionsListEl.querySelectorAll('.btn-execute-action').forEach(btn => {
                    const actionId = btn.dataset.actionId;
                    const action = phase.actions.find(a => a.id === actionId);
                    if (action) {
                        const canAfford = this.exerciseManager.canExecuteAction(action);
                        btn.disabled = !canAfford;
                        btn.className = `btn-execute-action ${canAfford ? 'primary-button' : 'btn-disabled'}`;
                        const label = btn.querySelector('.button-label');
                        if (label) label.textContent = canAfford ? 'Execute Command' : 'Insufficient Resources';
                    }
                });
            }
        }
        
        // Populate ledger
        const ledgerEl = document.getElementById('exercise-decision-ledger');
        const ledgerCountEl = document.getElementById('exercise-ledger-count');
        const ledger = this.exerciseManager.decisionLedger;
        if (ledgerCountEl) ledgerCountEl.textContent = ledger.length;
        if (ledgerEl) {
            if (ledger.length === 0) {
                ledgerEl.innerHTML = `<div class="ledger-empty">No tactical commands executed yet in this scenario.</div>`;
            } else {
                ledgerEl.innerHTML = ledger.map(item => `
                    <div class="ledger-entry">
                        <div class="ledger-entry-head">
                            <span class="ledger-clock">T+${item.clockTime}</span>
                            <span class="ledger-name">${item.actionName}</span>
                        </div>
                        <span class="ledger-cons">${item.consequence}</span>
                    </div>
                `).join('');
            }
        }
        
        // Update Advance Button
        const advanceLbl = document.getElementById('btn-advance-label');
        if (advanceLbl) {
            if (phaseIdx < totalPhases - 1) {
                const nextPhase = this.exerciseManager.scenario.phases[phaseIdx + 1];
                advanceLbl.textContent = `Advance to Phase ${phaseIdx + 2} (T+${nextPhase.clockTime}) →`;
            } else {
                advanceLbl.textContent = `Conclude Exercise & View After-Action Debrief 🏁`;
            }
        }
    }
    
    showDebriefModal() {
        const modal = document.getElementById('exercise-debrief-modal');
        const contentEl = document.getElementById('debrief-modal-content');
        if (!modal || !contentEl) return;
        
        const debrief = this.exerciseManager.getDebriefReport();
        
        contentEl.innerHTML = `
            <div class="debrief-hero-box">
                <div class="debrief-score-circle">
                    <span class="score-val">${debrief.totalScore}</span>
                    <span class="score-max">/ 100</span>
                </div>
                <div class="debrief-rating-block">
                    <span class="rating-badge">${debrief.ratingBadge}</span>
                    <h4 class="rating-title">${debrief.rating}</h4>
                    <p class="rating-desc">${debrief.assessment}</p>
                </div>
            </div>

            <div class="debrief-pillars-grid">
                <div class="pillar-card">
                    <span class="pillar-lbl">Situational Info Review</span>
                    <strong class="pillar-score">${debrief.breakdown.infoReview}</strong>
                </div>
                <div class="pillar-card">
                    <span class="pillar-lbl">Resource Discipline</span>
                    <strong class="pillar-score">${debrief.breakdown.resourceMgmt}</strong>
                </div>
                <div class="pillar-card">
                    <span class="pillar-lbl">Infrastructure Preservation</span>
                    <strong class="pillar-score">${debrief.breakdown.preservation}</strong>
                </div>
                <div class="pillar-card">
                    <span class="pillar-lbl">Intervention Timeliness</span>
                    <strong class="pillar-score">${debrief.breakdown.timeliness}</strong>
                </div>
            </div>

            <div class="debrief-ledger-section">
                <span class="ledger-sec-title">Decision Audit Log (${debrief.decisionCount} Actions Executed)</span>
                <div class="debrief-ledger-list">
                    ${debrief.ledger.map(d => `
                        <div class="debrief-log-row">
                            <span class="log-time">T+${d.clockTime}</span>
                            <span class="log-action">${d.actionName}</span>
                            <span class="log-consequence">${d.consequence}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        modal.showModal();
        
        const closeBtn = document.getElementById('btn-close-debrief-modal');
        const closeBtnBottom = document.getElementById('btn-debrief-close');
        const restartBtn = document.getElementById('btn-debrief-restart');
        
        const closeModal = () => modal.close();
        if (closeBtn) closeBtn.onclick = closeModal;
        if (closeBtnBottom) closeBtnBottom.onclick = closeModal;
        if (restartBtn) {
            restartBtn.onclick = () => {
                modal.close();
                this.exerciseManager.reset();
                this.simulator.seekTime(0);
                this.updateExerciseView();
            };
        }
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
            legendEl.innerHTML = `
                <div class="legend-header"><span>INTERVENTION SPATIAL DIFFERENCE</span></div>
                <div class="legend-split-row">
                    <span class="pill-green">■ Green: Flood Alleviated (Protected)</span>
                    <span class="pill-magenta">■ Magenta: Surcharge Displaced</span>
                </div>
            `;
        } else if (mode === 5) {
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
            rain = 0; // Real-world fluvial river overtopping (no artificial mountain rain puddles)
            surge = 0.45;
            eventName = 'Storm Frank (December 2015)';
            eventDesc = 'Continuous heavy Atlantic depression. River Suir crested at 4.2m OD at Convent Bridge with severe commercial inundation across the Irishtown and Quay corridors.';
        } else if (eventKey === 'flood_2008') {
            inflow = 420;
            rain = 0; // Real-world fluvial river overtopping
            surge = 0.20;
            eventName = 'River Suir Flood (January 2008)';
            eventDesc = 'Overland flow overtopped the Old Bridge quay wall and severed vehicular traffic along the N24 and Western Road.';
        } else if (eventKey === 'flood_2000') {
            inflow = 480;
            rain = 0; // Real-world fluvial river overtopping
            surge = 0.50;
            eventName = 'Historic Benchmark Flood (November 2000)';
            eventDesc = 'Largest modern unmitigated flood event prior to the Clonmel Flood Relief Scheme. Over 350 properties severely flooded.';
        }
        
        this.simulator.params.riverInflow = inflow;
        this.simulator.params.rainRate = rain;
        this.simulator.params.downstreamSurge = surge;
        this.baselineSimulator.params.riverInflow = inflow;
        this.baselineSimulator.params.rainRate = rain;
        this.baselineSimulator.params.downstreamSurge = surge;
        
        this.simulator.reset();
        this.baselineSimulator.reset();
        this.hydrographData = [];
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
        
        if (stepIdx === 0) {
            this.simulator.params.riverInflow = 55;
            this.simulator.reset();
            this.barriersManager.clearAll();
        } else if (stepIdx === 1) {
            this.simulator.params.riverInflow = 450;
            this.simulator.reset();
        } else if (stepIdx === 2) {
            this.simulator.totalSimTime = 5400;
        } else if (stepIdx === 3) {
            this.setWorkspace('impact');
        } else if (stepIdx === 4) {
            this.setWorkspace('intervention');
            this.barriersManager.loadPresets(null);
        } else if (stepIdx === 5) {
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
        
        let maxDepth = 0.5;
        for (const pt of this.hydrographData) {
            if (pt.depthM > maxDepth) maxDepth = pt.depthM;
        }
        maxDepth = Math.max(1.0, maxDepth * 1.25);
        
        ctx.beginPath();
        for (let i = 0; i < this.hydrographData.length; i++) {
            const pt = this.hydrographData[i];
            const x = (i / (this.hydrographData.length - 1)) * (w - 20) + 10;
            const y = h - 10 - (pt.depthM / maxDepth) * (h - 25);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        
        const lastX = w - 10;
        ctx.lineTo(lastX, h - 10);
        ctx.lineTo(10, h - 10);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
        
        const currentDepth = this.hydrographData[this.hydrographData.length - 1].depthM;
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`Peak: ${maxDepth.toFixed(2)}m  Now: ${currentDepth.toFixed(2)}m`, w - 170, 18);
    }

    initForecastControls() {
        // Ensemble scenario buttons
        const btnP10 = document.getElementById('btn-scenario-p10');
        const btnP50 = document.getElementById('btn-scenario-p50');
        const btnP90 = document.getElementById('btn-scenario-p90');
        
        [btnP10, btnP50, btnP90].forEach(btn => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                const scen = btn.dataset.fscenario;
                this.forecastManager.setScenario(scen);
                this.forecastManager.seekForecastStep(this.forecastManager.currentLeadTimeHours, this.simulator);
            });
        });

        // Quick jump lead-time chips
        const leadChips = document.querySelectorAll('.lead-chip');
        leadChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const hours = parseInt(chip.dataset.hours, 10);
                this.seekForecastLeadTime(hours);
            });
        });

        // Refresh telemetry button
        const btnRefresh = document.getElementById('btn-refresh-telemetry');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', async () => {
                btnRefresh.classList.add('loading');
                await this.forecastManager.executeForecastCycle();
                btnRefresh.classList.remove('loading');
            });
        }

        // Scientific Validation Modal
        const btnOpenVal = document.getElementById('btn-open-validation-modal');
        const modalVal = document.getElementById('forecast-validation-modal');
        const btnCloseVal = document.getElementById('btn-close-val-modal');
        const btnValClose = document.getElementById('btn-val-modal-close');

        if (btnOpenVal && modalVal) {
            btnOpenVal.addEventListener('click', () => {
                modalVal.showModal();
            });
        }
        if (btnCloseVal && modalVal) {
            btnCloseVal.addEventListener('click', () => {
                modalVal.close();
            });
        }
        if (btnValClose && modalVal) {
            btnValClose.addEventListener('click', () => {
                modalVal.close();
            });
        }
    }

    seekForecastLeadTime(hours) {
        if (!this.forecastManager) return;
        this.forecastManager.seekForecastStep(hours, this.simulator);

        // Update active lead-time chip
        document.querySelectorAll('.lead-chip').forEach(chip => {
            const h = parseInt(chip.dataset.hours, 10);
            chip.classList.toggle('active', h === hours);
        });

        this.updateForecastUI();
    }

    updateForecastUI() {
        if (!this.forecastManager) return;
        const fm = this.forecastManager;

        // 1. Platform Feed Status Badge
        const badgeEl = document.getElementById('forecast-status-badge');
        const pulseDot = document.getElementById('fp-pulse-dot');
        if (badgeEl) {
            badgeEl.className = 'pill-tag';
            if (fm.feedStatus === 'LIVE_VERIFIED') {
                badgeEl.classList.add('success');
                badgeEl.textContent = 'LIVE VERIFIED';
            } else if (fm.feedStatus === 'PARTIAL_LIVE' || fm.feedStatus === 'CACHED_PROVISIONAL') {
                badgeEl.classList.add('info');
                badgeEl.textContent = 'CACHED PROVISIONAL';
            } else {
                badgeEl.classList.add('warning');
                badgeEl.textContent = 'OFFLINE FALLBACK';
            }
        }
        if (pulseDot) {
            pulseDot.className = 'fp-pulse-dot';
            if (fm.feedStatus === 'LIVE_VERIFIED') {
                // green default
            } else if (fm.feedStatus === 'CACHED_PROVISIONAL' || fm.feedStatus === 'PARTIAL_LIVE') {
                pulseDot.classList.add('provisional');
            } else {
                pulseDot.classList.add('fallback');
            }
        }

        // 2. Feed provenance & timestamp
        const tsLabel = document.getElementById('fp-timestamp-label');
        if (tsLabel && fm.lastCycleTimestamp) {
            const d = new Date(fm.lastCycleTimestamp);
            tsLabel.textContent = `Cycle: ${d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • OPW 15m Telemetry`;
        }

        // 3. Station 16011: River Suir at Clonmel
        if (fm.telemetry && fm.telemetry.stations && fm.telemetry.stations.clonmel) {
            const st16011 = fm.telemetry.stations.clonmel;
            const elStage = document.getElementById('fc-clonmel-stage');
            const elQ = document.getElementById('fc-clonmel-q');
            const elTrend = document.getElementById('fc-clonmel-trend');
            const elMargin = document.getElementById('fc-clonmel-margin');

            if (elStage && st16011.latest) elStage.textContent = `${st16011.latest.stage.toFixed(2)} m`;
            if (elQ && st16011.latest) {
                const q = fm.hydrologyModel.stageToDischarge(st16011.latest.stage);
                elQ.textContent = `${Math.round(q)} m³/s`;
            }
            if (elMargin && st16011.latest) {
                const margin = 2.45 - st16011.latest.stage;
                if (margin > 0) {
                    elMargin.textContent = `+${margin.toFixed(2)}m (Bank Safe)`;
                    elMargin.className = 'ro-val text-success';
                } else {
                    elMargin.textContent = `${Math.abs(margin).toFixed(2)}m (Overtopping)`;
                    elMargin.className = 'ro-val text-danger';
                }
            }
        }

        // 4. Station 16139: Knocklofty
        if (fm.telemetry && fm.telemetry.stations && fm.telemetry.stations.knocklofty) {
            const kl = fm.telemetry.stations.knocklofty;
            const elKlStage = document.getElementById('fc-knocklofty-stage');
            if (elKlStage && kl.latest) elKlStage.textContent = `${kl.latest.stage.toFixed(2)} m`;
        }

        // 5. Met Éireann Weather
        if (fm.telemetry && fm.telemetry.weather) {
            const w = fm.telemetry.weather;
            const elRainRate = document.getElementById('fc-rain-rate');
            const elCumRain = document.getElementById('fc-rain-cum24');
            const elWindBaro = document.getElementById('fc-wind-baro');

            if (elRainRate) elRainRate.textContent = `${(w.latestRainMm || 0.0).toFixed(1)} mm/h`;
            if (elCumRain && w.series) {
                const cum24 = w.series.slice(0, 24).reduce((acc, r) => acc + (r.precipitation_mm || 0), 0);
                elCumRain.textContent = `${cum24.toFixed(1)} mm`;
            }
            if (elWindBaro && w.series && w.series.length > 0) {
                const curW = w.series[0];
                elWindBaro.textContent = `${Math.round(curW.wind_speed_kmh || 14)} km/h • ${Math.round(curW.pressure_hpa || 1012)} hPa`;
            }
        }

        // 6. Active Scenario Button Highlights
        ['p10', 'p50', 'p90'].forEach(s => {
            const b = document.getElementById(`btn-scenario-${s}`);
            if (b) b.classList.toggle('active', fm.activeScenario === s);
        });

        const activeTag = document.getElementById('fc-chart-active-tag');
        if (activeTag) {
            if (fm.activeScenario === 'p10') activeTag.textContent = 'P10 LOW RUNOFF';
            else if (fm.activeScenario === 'p90') activeTag.textContent = 'P90 SEVERE WORST-CASE';
            else activeTag.textContent = 'P50 EXPECTED BASELINE';
        }

        // 7. Active Coupled SWE Parameters
        const currentStep = fm.getCurrentStep();
        if (currentStep) {
            const elCoupledQ = document.getElementById('fc-coupled-q');
            const elCoupledStage = document.getElementById('fc-coupled-stage');
            const elCoupledSurge = document.getElementById('fc-coupled-surge');
            const elCoupledRain = document.getElementById('fc-coupled-rain');

            let q = currentStep.qP50;
            let stage = currentStep.stageP50;
            let surge = currentStep.surgeP50;
            if (fm.activeScenario === 'p10') {
                q = currentStep.qP10;
                stage = currentStep.stageP10;
                surge = 0.0;
            } else if (fm.activeScenario === 'p90') {
                q = currentStep.qP90;
                stage = currentStep.stageP90;
                surge = currentStep.surgeP90;
            }

            if (elCoupledQ) elCoupledQ.textContent = `${Math.round(q)} m³/s`;
            if (elCoupledStage) elCoupledStage.textContent = `${stage.toFixed(2)} m`;
            if (elCoupledSurge) elCoupledSurge.textContent = `+${surge.toFixed(2)} m`;
            if (elCoupledRain) elCoupledRain.textContent = `${(currentStep.rainMmHr || 0).toFixed(1)} mm/h`;
        }

        // 8. Render Forecast Hydrograph Chart
        this.drawForecastHydrograph();
    }

    drawForecastHydrograph() {
        const canvas = document.getElementById('forecast-hydrograph-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const fm = this.forecastManager;
        if (!fm || !fm.forecastPackage || !fm.forecastPackage.timeline) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
            ctx.font = '11px "DM Sans", sans-serif';
            ctx.fillText('Ingesting OPW telemetry & Met Éireann forecast...', 15, h / 2);
            return;
        }

        const timeline = fm.forecastPackage.timeline;
        const padLeft = 32;
        const padRight = 12;
        const padTop = 14;
        const padBottom = 20;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        // Stage axis limits: 0.0m to 4.5m
        const minStage = 0.0;
        const maxStage = 4.5;

        const stageToY = (stage) => {
            const clamped = Math.max(minStage, Math.min(maxStage, stage));
            return padTop + (1.0 - (clamped - minStage) / (maxStage - minStage)) * chartH;
        };

        // Time mapping: Past 24h (-24 to 0) + Future 48h (0 to 48) => Total 72 hours
        const totalHours = 72;
        const hourToX = (hourRelNow) => {
            const normalized = (hourRelNow + 24) / totalHours;
            return padLeft + normalized * chartW;
        };

        // Grid lines (1m, 2m, 3m, 4m)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#64748b';
        ctx.font = '9px "JetBrains Mono", monospace';
        [1.0, 2.0, 3.0, 4.0].forEach(st => {
            const y = stageToY(st);
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(w - padRight, y);
            ctx.stroke();
            ctx.fillText(`${st}m`, 6, y + 3);
        });

        // Bankfull overtopping threshold line at 2.45m
        const yBankfull = stageToY(2.45);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(padLeft, yBankfull);
        ctx.lineTo(w - padRight, yBankfull);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ef4444';
        ctx.fillText('Bankfull 2.45m', w - padRight - 75, yBankfull - 3);

        // "Now" vertical line at x = hourToX(0)
        const xNow = hourToX(0);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xNow, padTop);
        ctx.lineTo(xNow, h - padBottom);
        ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Now', xNow - 9, h - 8);

        // 1. Shaded P10-P90 Uncertainty Envelope (Future 0 to 48h)
        ctx.beginPath();
        for (let i = 0; i < timeline.length; i++) {
            const st = timeline[i];
            const x = hourToX(st.leadTimeHours);
            const yP90 = stageToY(st.stageP90);
            if (i === 0) ctx.moveTo(x, yP90);
            else ctx.lineTo(x, yP90);
        }
        for (let i = timeline.length - 1; i >= 0; i--) {
            const st = timeline[i];
            const x = hourToX(st.leadTimeHours);
            const yP10 = stageToY(st.stageP10);
            ctx.lineTo(x, yP10);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.fill();

        // 2. Past Observed 24h Line (Solid Cyan)
        const observedHistory = fm.telemetry?.stations?.clonmel?.records || [];
        if (observedHistory.length > 0) {
            ctx.beginPath();
            const nowMs = Date.now();
            let isFirst = true;
            for (const rec of observedHistory) {
                const hourDiff = (rec.timeMs - nowMs) / 3600000;
                if (hourDiff >= -24 && hourDiff <= 0.1) {
                    const x = hourToX(hourDiff);
                    const y = stageToY(rec.stage);
                    if (isFirst) {
                        ctx.moveTo(x, y);
                        isFirst = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.0;
            ctx.stroke();
        }

        // 3. Forecast Line (Dashed Amber or Red/Blue depending on active scenario)
        ctx.beginPath();
        ctx.setLineDash([4, 3]);
        for (let i = 0; i < timeline.length; i++) {
            const st = timeline[i];
            const x = hourToX(st.leadTimeHours);
            let targetStage = st.stageP50;
            if (fm.activeScenario === 'p10') targetStage = st.stageP10;
            else if (fm.activeScenario === 'p90') targetStage = st.stageP90;

            const y = stageToY(targetStage);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = fm.activeScenario === 'p90' ? '#ef4444' : fm.activeScenario === 'p10' ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.setLineDash([]);

        // 4. Current Lead-Time Scrubber Marker
        const curLead = fm.currentLeadTimeHours || 0;
        const xMarker = hourToX(curLead);
        const curStep = fm.getCurrentStep();
        let curStage = curStep ? (fm.activeScenario === 'p10' ? curStep.stageP10 : fm.activeScenario === 'p90' ? curStep.stageP90 : curStep.stageP50) : 1.0;
        const yMarker = stageToY(curStage);

        // Vertical highlight line
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xMarker, padTop);
        ctx.lineTo(xMarker, h - padBottom);
        ctx.stroke();

        // Marker dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(xMarker, yMarker, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Lead time label
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillText(`+${curLead}h (${curStage.toFixed(2)}m)`, Math.min(w - 75, Math.max(padLeft, xMarker - 25)), padTop + 9);
    }

    initDefenceControls() {
        // Type filter chips
        const typeChips = document.querySelectorAll('.def-type-chip');
        typeChips.forEach(chip => {
            chip.addEventListener('click', () => {
                typeChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.defenceManager.setTypeFilter(chip.dataset.deftype);
            });
        });

        // Status filter chips
        const statusChips = document.querySelectorAll('.def-status-chip');
        statusChips.forEach(chip => {
            chip.addEventListener('click', () => {
                statusChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.defenceManager.setStatusFilter(chip.dataset.defstatus);
            });
        });

        // Hypothetical scenario sandbox mode toggle
        const toggleHypo = document.getElementById('toggle-hypothetical-mode');
        const hypoControls = document.getElementById('hypothetical-controls-row');
        if (toggleHypo && hypoControls) {
            toggleHypo.addEventListener('change', (e) => {
                hypoControls.classList.toggle('hidden', !e.target.checked);
                if (!e.target.checked) {
                    this.defenceManager.clearHypotheticalOverrides();
                }
            });
        }

        const btnFailDemountables = document.getElementById('btn-hypo-fail-demountables');
        if (btnFailDemountables) {
            btnFailDemountables.addEventListener('click', () => {
                // Set all demountable barriers to NOT_DEPLOYED
                this.defenceManager.assets.forEach(a => {
                    if (a.operational?.isDemountable) {
                        this.defenceManager.setHypotheticalOverride(a.id, {
                            deploymentStatus: 'NOT_DEPLOYED'
                        });
                    }
                });
            });
        }

        const btnHypoReset = document.getElementById('btn-hypo-reset');
        if (btnHypoReset) {
            btnHypoReset.addEventListener('click', () => {
                this.defenceManager.clearHypotheticalOverrides();
            });
        }
    }

    updateDefenceUI() {
        if (!this.defenceManager || !this.defenceManager.isLoaded) return;
        const dm = this.defenceManager;

        // Evaluate all assets against active simulation water levels
        const gaugeTel = this.forecastManager?.telemetry?.stations?.clonmel?.latest || null;
        const evaluations = dm.evaluateAll(this.simulator, gaugeTel);

        // 1. Overview Scorecard Metrics
        const total = dm.assets.length;
        let verifiedCount = 0;
        let monitoredCount = 0;
        let opCheckCount = 0;

        evaluations.forEach(ev => {
            if (ev.asset.provenance?.verificationStatus === 'VERIFIED_SOURCE') verifiedCount++;
            if (ev.freeboard.isCalculable) monitoredCount++;
            if (ev.status.statusCode === 'OPERATIONAL_CONFIRMATION_REQUIRED') opCheckCount++;
        });

        const elTot = document.getElementById('def-kpi-total');
        const elVer = document.getElementById('def-kpi-verified');
        const elMon = document.getElementById('def-kpi-monitored');
        const elOp = document.getElementById('def-kpi-opcheck');
        if (elTot) elTot.textContent = total;
        if (elVer) elVer.textContent = verifiedCount;
        if (elMon) elMon.textContent = monitoredCount;
        if (elOp) elOp.textContent = opCheckCount;

        // 2. Render Scrollable Asset Inventory List
        const listEl = document.getElementById('defence-assets-scroll-list');
        if (listEl) {
            const typeFilter = dm.activeTypeFilter;
            const statusFilter = dm.activeStatusFilter;

            const filtered = evaluations.filter(ev => {
                const matchType = typeFilter === 'all' || ev.asset.type === typeFilter;
                const matchStatus = statusFilter === 'all' || ev.status.statusCode === statusFilter;
                return matchType && matchStatus;
            });

            listEl.innerHTML = filtered.map(ev => {
                const a = ev.asset;
                const fb = ev.freeboard;
                const st = ev.status;
                const isSelected = dm.selectedAsset?.id === a.id;

                let fbLabel = 'Crest N/A';
                if (fb.isCalculable) {
                    fbLabel = fb.freeboardM >= 0 
                        ? `+${fb.freeboardM.toFixed(2)}m fb` 
                        : `${fb.freeboardM.toFixed(2)}m over`;
                }

                return `
                    <div class="def-asset-row-item ${isSelected ? 'selected' : ''}" data-def-id="${a.id}">
                        <div class="def-item-left">
                            <span class="def-item-icon">${a.type === 'demountable_barrier' ? '🛡️' : a.type === 'pumping_station' ? '⚙️' : a.type === 'embankment' ? '🌱' : a.type === 'outfall_penstock' ? '🚰' : '🧱'}</span>
                            <div class="def-item-meta">
                                <span class="def-item-title">${a.shortName || a.name}</span>
                                <span class="def-item-sub">${a.subScheme} • ${a.id}</span>
                            </div>
                        </div>
                        <div class="def-item-right">
                            <span class="${st.status.cssClass}">${st.status.label}</span>
                            <span class="def-item-crest">${fb.crestElevationMOD ? fb.crestElevationMOD.toFixed(2) + 'm OD' : ''} (${fbLabel})</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Wire click selection
            listEl.querySelectorAll('.def-asset-row-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.defId;
                    dm.selectAsset(id);
                });
            });
        }

        // 3. Render Selected Asset Deep-Dive Card
        const selAsset = dm.selectedAsset;
        if (selAsset) {
            const ev = evaluations.find(e => e.asset.id === selAsset.id) || {
                asset: selAsset,
                freeboard: dm.freeboardAnalyzer.evaluateAssetFreeboard(selAsset, this.simulator, gaugeTel),
                status: dm.statusEngine.evaluateStatus(selAsset, null, dm.scenarioOverrides)
            };

            const a = ev.asset;
            const fb = ev.freeboard;
            const st = ev.status;

            const elType = document.getElementById('def-card-type');
            const elName = document.getElementById('def-card-name');
            const elId = document.getElementById('def-card-id');
            const elStatusBadge = document.getElementById('def-card-status-badge');
            const elCrest = document.getElementById('def-card-crest');
            const elGround = document.getElementById('def-card-ground');
            const elLength = document.getElementById('def-card-length');
            const elDesignFb = document.getElementById('def-card-design-fb');

            if (elType) elType.textContent = a.type.replace('_', ' ').toUpperCase();
            if (elName) elName.textContent = a.name;
            if (elId) elId.textContent = `Asset ID: ${a.id} • ${a.subScheme} (${a.riverBank || 'River Corridor'})`;

            if (elStatusBadge) {
                elStatusBadge.className = st.status.cssClass;
                elStatusBadge.textContent = st.status.label;
            }

            if (elCrest) elCrest.textContent = a.physical?.crestElevationMOD ? `${a.physical.crestElevationMOD.toFixed(2)} m OD` : 'Unsurveyed';
            if (elGround) elGround.textContent = a.physical?.groundElevationMOD ? `${a.physical.groundElevationMOD.toFixed(2)} m OD` : 'N/A';
            if (elLength) elLength.textContent = a.physical?.lengthM ? `${a.physical.lengthM} m` : a.physical?.pumpCapacityM3S ? `${a.physical.pumpCapacityM3S} m³/s` : 'Point Asset';
            if (elDesignFb) elDesignFb.textContent = a.physical?.designFreeboardM ? `${a.physical.designFreeboardM.toFixed(2)} m` : 'N/A';

            // Freeboard box
            const elFbVal = document.getElementById('def-card-freeboard-val');
            const elFbFill = document.getElementById('def-card-freeboard-fill');
            const elWaterLevel = document.getElementById('def-card-water-level');
            const elUncertainty = document.getElementById('def-card-uncertainty');

            if (fb.isCalculable) {
                if (elFbVal) {
                    elFbVal.textContent = fb.freeboardM >= 0 ? `+${fb.freeboardM.toFixed(2)} m` : `${fb.freeboardM.toFixed(2)} m (Overtopped)`;
                    elFbVal.className = fb.freeboardM >= 0.50 ? 'fb-val text-success' : fb.freeboardM >= 0.15 ? 'fb-val text-amber' : 'fb-val text-danger';
                }
                if (elFbFill) {
                    const pct = Math.max(0, Math.min(100, (fb.freeboardM / 1.5) * 100));
                    elFbFill.style.width = `${pct}%`;
                    elFbFill.className = fb.freeboardM >= 0.50 ? 'residual-bar-fill good' : fb.freeboardM >= 0.15 ? 'residual-bar-fill caution' : 'residual-bar-fill alert';
                }
                if (elWaterLevel) elWaterLevel.textContent = `${fb.waterLevelMOD.toFixed(2)} m OD`;
                if (elUncertainty) elUncertainty.textContent = `±${fb.combinedUncertaintyM.toFixed(2)} m`;
            } else {
                if (elFbVal) {
                    elFbVal.textContent = 'Comparison N/A';
                    elFbVal.className = 'fb-val text-amber';
                }
                if (elWaterLevel) elWaterLevel.textContent = 'Insufficient data';
                if (elUncertainty) elUncertainty.textContent = 'N/A';
            }

            // Operational Dependency Notice
            const elOpText = document.getElementById('def-card-operational-text');
            if (elOpText) {
                if (a.operational?.isDemountable) {
                    const depStatus = dm.scenarioOverrides[a.id]?.deploymentStatus || a.operational.deploymentStatus;
                    elOpText.innerHTML = `<strong>Demountable Barrier:</strong> ${a.operational.deploymentProcedure}. Required: ${a.operational.requiredPersonnel}. Assembly: ~${a.operational.estimatedDeploymentTimeHours}h.<br><span style="color:${depStatus === 'CONFIRMED_DEPLOYED' ? '#34d399' : '#f59e0b'};">Status: ${depStatus.replace('_', ' ')}</span>`;
                } else if (a.operational?.isPumpingStation) {
                    elOpText.innerHTML = `<strong>Stormwater Pumping Station:</strong> ${a.physical.pumpConfiguration}. Backup: ${a.operational.backupPower}.<br><span style="color:#f59e0b;">Status: ${a.operational.operationalStatus.replace('_', ' ')} (${a.operational.telemetryNote})</span>`;
                } else {
                    elOpText.textContent = 'Permanent passive barrier. Continuous structural containment without manual deployment dependency.';
                }
            }

            // Maintenance / Condition notes
            const elCondGrade = document.getElementById('def-card-condition-grade');
            const elInspectNotes = document.getElementById('def-card-inspection-notes');
            if (elCondGrade) {
                elCondGrade.textContent = a.operational?.conditionGrade || 'Unrecorded';
                elCondGrade.className = a.operational?.conditionGrade?.includes('Review') ? 'def-cond-badge review' : 'def-cond-badge';
            }
            if (elInspectNotes) {
                elInspectNotes.textContent = `Last inspected: ${a.operational?.lastInspectionDate || 'N/A'} (${a.operational?.inspectionSource || 'OPW'}). Findings: ${a.operational?.conditionNotes || 'No defect notes.'}`;
            }

            // Provenance footer
            const elProv = document.getElementById('def-card-provenance');
            if (elProv) {
                elProv.textContent = `Source: ${a.provenance?.sourceOrganisation || 'OPW'} • ${a.provenance?.documentReference || 'Scheme Records'} • Datum: ${a.physical?.crestElevationDatum || 'Malin Head OD'}`;
            }
        }
    }

    initExplainableControls() {
        // Evidence filter chips
        const chips = document.querySelectorAll('.exp-ev-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                if (this.explainabilityManager) {
                    this.explainabilityManager.setEvidenceFilter(chip.dataset.evfilter);
                }
            });
        });

        // Sensitivity experiment buttons
        const btnRainUp = document.getElementById('btn-sens-rain-up');
        if (btnRainUp) {
            btnRainUp.addEventListener('click', () => {
                this.explainabilityManager.runSensitivityExperiment({
                    variable: 'precipitation',
                    factor: 1.20
                });
            });
        }

        const btnRainDown = document.getElementById('btn-sens-rain-down');
        if (btnRainDown) {
            btnRainDown.addEventListener('click', () => {
                this.explainabilityManager.runSensitivityExperiment({
                    variable: 'precipitation',
                    factor: 0.80
                });
            });
        }

        const btnStageUp = document.getElementById('btn-sens-stage-up');
        if (btnStageUp) {
            btnStageUp.addEventListener('click', () => {
                this.explainabilityManager.runSensitivityExperiment({
                    variable: 'upstream_stage',
                    offset: 0.30
                });
            });
        }

        const btnSoilSat = document.getElementById('btn-sens-soil-sat');
        if (btnSoilSat) {
            btnSoilSat.addEventListener('click', () => {
                this.explainabilityManager.runSensitivityExperiment({
                    variable: 'runoff_coefficient',
                    factor: 1.25
                });
            });
        }

        const btnSensReset = document.getElementById('btn-sens-reset');
        if (btnSensReset) {
            btnSensReset.addEventListener('click', () => {
                this.explainabilityManager.clearSensitivityExperiment();
            });
        }
    }

    updateExplainableUI() {
        if (!this.explainabilityManager) return;
        const em = this.explainabilityManager;
        const fc = this.forecastManager?.forecastPackage;

        // Ensure spatial explanation is updated with simulator without recursive notify loop
        em.updateSpatialExplanation(this.simulator);

        // 1. Run Badge & KPI Scorecard
        const elRunBadge = document.getElementById('exp-run-badge');
        if (elRunBadge && em.currentSnapshot) {
            elRunBadge.textContent = `RUN: ${em.currentSnapshot.runId}`;
        }

        if (fc && fc.peak) {
            const elPeakStage = document.getElementById('exp-kpi-peak-stage');
            const elPeakQ = document.getElementById('exp-kpi-peak-q');
            const elTiming = document.getElementById('exp-kpi-timing');
            const elRisk = document.getElementById('exp-kpi-risk');

            if (elPeakStage) elPeakStage.textContent = `${fc.peak.stage.toFixed(2)} m OD`;
            if (elPeakQ) elPeakQ.textContent = `${fc.peak.discharge.toFixed(1)} m³/s`;
            if (elTiming) elTiming.textContent = `+${fc.peak.leadTimeHours}h`;
            if (elRisk) {
                elRisk.textContent = fc.peak.riskTier;
                elRisk.className = fc.peak.riskTier === 'EMERGENCY' ? 'def-kpi-val text-danger' : fc.peak.riskTier === 'WARNING' ? 'def-kpi-val text-amber' : 'def-kpi-val text-success';
            }
        }

        // 2. Physical Inflow Decomposition
        const decomp = em.getDischargeBreakdown();
        if (decomp) {
            const elLeadLbl = document.getElementById('exp-decomp-lead-label');
            if (elLeadLbl) elLeadLbl.textContent = `LEAD: ${decomp.timeLabel} (${decomp.totalQ} m³/s)`;

            const elBarBase = document.getElementById('decomp-bar-base');
            const elBarWave = document.getElementById('decomp-bar-wave');
            const elBarRunoff = document.getElementById('decomp-bar-runoff');

            if (elBarBase) elBarBase.style.width = `${decomp.shares.baseflowPct}%`;
            if (elBarWave) elBarWave.style.width = `${decomp.shares.upstreamWavePct}%`;
            if (elBarRunoff) elBarRunoff.style.width = `${decomp.shares.runoffPct}%`;

            const elValBase = document.getElementById('decomp-val-base');
            const elValWave = document.getElementById('decomp-val-wave');
            const elValRunoff = document.getElementById('decomp-val-runoff');

            if (elValBase) elValBase.textContent = `${decomp.baseflowQ} m³/s (${decomp.shares.baseflowPct}%)`;
            if (elValWave) elValWave.textContent = `${decomp.upstreamWaveQ} m³/s (${decomp.shares.upstreamWavePct}%)`;
            if (elValRunoff) elValRunoff.textContent = `${decomp.runoffQ} m³/s (${decomp.shares.runoffPct}%)`;
        }

        // 3. Deterministic 5-Section Narrative Stack
        const narrative = em.getNarrative();
        const narrContainer = document.getElementById('exp-narrative-sections');
        if (narrContainer && narrative?.sections) {
            narrContainer.innerHTML = narrative.sections.map(sec => `
                <div class="exp-narrative-card">
                    <div class="exp-narr-header">
                        <span>ℹ️</span>
                        <span>${sec.title}</span>
                    </div>
                    <div class="exp-narr-body">
                        ${formatMarkdownText(sec.content)}
                    </div>
                </div>
            `).join('');
        }

        // 4. Run-to-Run Diff & Attribution Analysis
        const diff = em.diffResult;
        if (diff && diff.isComparable) {
            const d = diff.deltas;
            const elDiffStage = document.getElementById('exp-diff-delta-stage');
            const elDiffQ = document.getElementById('exp-diff-delta-q');
            const elDiffKl = document.getElementById('exp-diff-delta-kl');
            const elDiffRain = document.getElementById('exp-diff-delta-rain');
            const elAttrText = document.getElementById('exp-attribution-text');

            if (elDiffStage) {
                elDiffStage.textContent = `${d.peakStageM >= 0 ? '+' : ''}${d.peakStageM.toFixed(2)} m`;
                elDiffStage.className = d.peakStageM > 0.05 ? 'st-val text-amber' : d.peakStageM < -0.05 ? 'st-val text-success' : 'st-val';
            }
            if (elDiffQ) elDiffQ.textContent = `${d.peakQM3S >= 0 ? '+' : ''}${d.peakQM3S.toFixed(1)} m³/s`;
            if (elDiffKl) elDiffKl.textContent = `${d.upstreamKnockloftyM >= 0 ? '+' : ''}${d.upstreamKnockloftyM.toFixed(2)} m`;
            if (elDiffRain) elDiffRain.textContent = `${d.cumulativePrecipMm >= 0 ? '+' : ''}${d.cumulativePrecipMm.toFixed(1)} mm`;
            if (elAttrText) elAttrText.textContent = diff.attributionNarrative;
        }

        // 5. Location-Specific Spatial Explanation
        const loc = em.selectedLocationExplanation;
        if (loc && loc.isAvailable) {
            const elLocName = document.getElementById('exp-loc-name');
            const elLocBadge = document.getElementById('exp-loc-mechanism-badge');
            const elLocDepth = document.getElementById('exp-loc-depth');
            const elLocPeakDepth = document.getElementById('exp-loc-peak-depth');
            const elLocGround = document.getElementById('exp-loc-ground-elev');
            const elLocWater = document.getElementById('exp-loc-water-elev');
            const elLocDesc = document.getElementById('exp-loc-mechanism-desc');

            if (elLocName) elLocName.textContent = loc.locationName;
            if (elLocBadge) {
                elLocBadge.textContent = loc.inundationStatus.title;
                elLocBadge.className = loc.inundationStatus.mechanism === 'DIRECT_OVERTOPPING' ? 'status-pill-red' : loc.inundationStatus.mechanism === 'OVERLAND_FLOW_PATH' ? 'status-pill-amber' : 'status-pill-green';
            }
            if (elLocDepth) elLocDepth.textContent = `${loc.elevations.depthM.toFixed(2)} m`;
            if (elLocPeakDepth) elLocPeakDepth.textContent = `${loc.elevations.peakDepthM.toFixed(2)} m`;
            if (elLocGround) elLocGround.textContent = `${loc.elevations.groundElevOD.toFixed(2)} m OD`;
            if (elLocWater) elLocWater.textContent = `${loc.elevations.waterElevOD.toFixed(2)} m OD`;
            if (elLocDesc) elLocDesc.textContent = loc.inundationStatus.description;
        }

        // 6. Sensitivity Explorer Results
        const exp = em.sensitivityExplorer.activeExperiment;
        const sensBox = document.getElementById('exp-sens-results-box');
        if (sensBox) {
            if (exp && exp.isSuccess) {
                sensBox.classList.remove('hidden');
                const elTitle = document.getElementById('exp-sens-title');
                const elBadge = document.getElementById('exp-sens-delta-badge');
                const elConc = document.getElementById('exp-sens-conclusion');

                if (elTitle) elTitle.textContent = exp.variableLabel;
                if (elBadge) {
                    const dS = exp.results.deltaPeakStageM;
                    elBadge.textContent = `${dS >= 0 ? '+' : ''}${dS.toFixed(2)}m Peak Stage (${exp.results.deltaPeakQM3S >= 0 ? '+' : ''}${exp.results.deltaPeakQM3S} m³/s)`;
                }
                if (elConc) elConc.textContent = exp.scientificConclusion;
            } else {
                sensBox.classList.add('hidden');
            }
        }

        // 7. Structured Evidence Inventory List
        const evListEl = document.getElementById('exp-evidence-scroll-list');
        if (evListEl) {
            const allEv = em.getEvidenceList();
            const filter = em.activeEvidenceFilter;
            const filtered = filter === 'all' ? allEv : allEv.filter(e => e.evidenceType === filter);

            evListEl.innerHTML = filtered.map(item => `
                <div class="def-asset-row-item">
                    <div class="def-item-left">
                        <span class="def-item-icon">${item.evidenceType === 'observed_gauge' ? '🌊' : item.evidenceType === 'forecast_precipitation' ? '🌧️' : '📐'}</span>
                        <div class="def-item-meta">
                            <span class="def-item-title">${item.name}</span>
                            <span class="def-item-sub">${item.source} • ${item.relevance}</span>
                        </div>
                    </div>
                    <div class="def-item-right">
                        <span class="${item.qualityStatus.cssClass}">${item.qualityStatus.label}</span>
                        <span class="def-item-crest">${item.value} ${item.unit}</span>
                    </div>
                </div>
            `).join('');
        }
    }
}

function formatMarkdownText(text) {
    if (!text) return '';
    return text
        .split('**').map((part, i) => i % 2 === 1 ? `<strong>${part}</strong>` : part).join('')
        .split('*').map((part, i) => i % 2 === 1 ? `<em>${part}</em>` : part).join('');
}
