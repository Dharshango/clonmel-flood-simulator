/**
 * defence_manager.js
 * 
 * Central State Orchestrator and Decision-Support Manager
 * for the Clonmel Flood Defence Performance Monitor.
 */

import { validateDefenceAsset } from './defence_model.js';
import { FreeboardAnalyzer } from './freeboard_analyzer.js';
import { DefenceStatusEngine } from './status_engine.js';
import { Defence3DLayer } from '../rendering/defence_layer.js';

export class DefencePerformanceManager {
    constructor(scene, meta, elevArray) {
        this.meta = meta;
        this.elevArray = elevArray;

        this.freeboardAnalyzer = new FreeboardAnalyzer(meta, elevArray);
        this.statusEngine = new DefenceStatusEngine();
        this.layer3D = new Defence3DLayer(scene, meta, elevArray);

        this.assets = [];
        this.selectedAsset = null;
        this.activeTypeFilter = 'all';
        this.activeStatusFilter = 'all';

        // Explicit Scenario Hypothesis testing overrides: { assetId -> { deploymentStatus, operationalStatus } }
        this.scenarioOverrides = {};
        this.isHypotheticalMode = false;

        this.listeners = [];
        this.isLoaded = false;
    }

    onUpdate(fn) {
        this.listeners.push(fn);
    }

    notify() {
        for (const fn of this.listeners) {
            try { fn(this); } catch (e) { console.error('[DefenceManager] listener error:', e); }
        }
    }

    async loadDefenceDataset() {
        try {
            const resp = await fetch('/data/flood_defences.json');
            const data = await resp.json();

            const validAssets = [];
            for (const raw of data.assets || []) {
                const val = validateDefenceAsset(raw);
                if (val.isValid) {
                    validAssets.push(raw);
                } else {
                    console.warn(`[DefenceManager] Skipping invalid asset ${raw.id}:`, val.errors);
                }
            }

            this.assets = validAssets;
            this.metadata = data.metadata || {};
            this.layer3D.loadAssets(this.assets);

            // Default select the primary North Quay Wall
            if (this.assets.length > 0) {
                this.selectedAsset = this.assets[0];
                this.layer3D.selectAsset(this.selectedAsset.id);
            }

            this.isLoaded = true;
            this.notify();
        } catch (err) {
            console.error('[DefenceManager] Failed to load defence dataset:', err);
        }
    }

    /**
     * Evaluates all assets with current simulation / river condition
     */
    evaluateAll(simulator, gaugeTelemetry = null) {
        if (!this.isLoaded) return [];

        return this.assets.map(asset => {
            const fbResult = this.freeboardAnalyzer.evaluateAssetFreeboard(asset, simulator, gaugeTelemetry);
            const statusResult = this.statusEngine.evaluateStatus(asset, fbResult, this.scenarioOverrides);

            return {
                asset,
                freeboard: fbResult,
                status: statusResult
            };
        });
    }

    selectAsset(assetId) {
        const found = this.assets.find(a => a.id === assetId);
        if (found) {
            this.selectedAsset = found;
            this.layer3D.selectAsset(assetId);
            this.notify();
        }
    }

    setTypeFilter(filterKey) {
        this.activeTypeFilter = filterKey;
        this.notify();
    }

    setStatusFilter(statusKey) {
        this.activeStatusFilter = statusKey;
        this.notify();
    }

    /**
     * Sets a hypothetical testing assumption (e.g. Demountable gate not deployed)
     */
    setHypotheticalOverride(assetId, overrides) {
        if (!overrides) {
            delete this.scenarioOverrides[assetId];
        } else {
            this.scenarioOverrides[assetId] = {
                ...this.scenarioOverrides[assetId],
                ...overrides
            };
        }
        this.isHypotheticalMode = Object.keys(this.scenarioOverrides).length > 0;
        this.notify();
    }

    clearHypotheticalOverrides() {
        this.scenarioOverrides = {};
        this.isHypotheticalMode = false;
        this.notify();
    }

    setVisible(visible) {
        this.layer3D.setVisible(visible);
    }
}
