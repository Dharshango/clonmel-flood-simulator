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
        
        // Active Filter States
        this.evidenceActiveFilter = 'all';
        
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
}
