/**
 * intervention_engine.js
 * 
 * Intervention Intelligence Engine for Workspace 3 (Intervention Lab)
 * 
 * Manages:
 * 1. Physical defenses: Flood walls (2.8m), Sandbag bunds (1.2m)
 * 2. SuDS Green Infrastructure (permeable soil infiltration detention)
 * 3. Urban Drainage Pumps (Suir Island 15 m³/s axial pump station)
 * 4. Spatial Difference Engine (Alleviation vs Unintended Water Displacement)
 * 5. Multi-Criteria Intervention Scorecard
 */

import * as THREE from 'three';

export class InterventionEngine {
    constructor(gridW, gridH, meta) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.meta = meta;
        this.numCells = gridW * gridH;
        
        // Difference texture for GPU shader (R: alleviation magnitude, G: displacement magnitude, B: net diff, A: active flag)
        this.diffTexture = new THREE.DataTexture(
            new Float32Array(this.numCells * 4),
            gridW, gridH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.diffTexture.minFilter = THREE.LinearFilter;
        this.diffTexture.magFilter = THREE.LinearFilter;
        
        // Active intervention toggles
        this.sudsActive = false;
        this.sudsInfiltrationMmH = 28.0; // permeable detention infiltration
        this.pumpsActive = false;
        this.pumpDischargeRate = 15.0;   // 15 m³/s axial flow capacity
        
        // Scorecard cache
        this.currentScorecard = null;
    }
    
    setSudsActive(active, simulator) {
        this.sudsActive = active;
        if (simulator) {
            // SuDS enhances ground infiltration in SWE solver parameters
            simulator.params.infiltrationRate = active ? this.sudsInfiltrationMmH : 0.0;
        }
    }
    
    setPumpsActive(active, simulator) {
        this.pumpsActive = active;
        if (simulator) {
            // Pumps actively extract water from Suir Island depression and return it to downstream main channel
            simulator.params.pumpDischarge = active ? this.pumpDischargeRate : 0.0;
        }
    }
    
    /**
     * Compute spatial difference between protected simulation and unmitigated baseline
     * @param {SWESimulator} protectedSim 
     * @param {SWESimulator} baselineSim 
     * @returns {Object} Difference analysis summary
     */
    updateDifference(protectedSim, baselineSim) {
        if (!protectedSim || !baselineSim) return null;
        
        const protBuf = protectedSim.readbackBuffer;
        const baseBuf = baselineSim.readbackBuffer;
        if (!protBuf || !baseBuf) return null;
        
        const diffData = this.diffTexture.image.data;
        const threshold = 0.04; // 4 cm difference threshold
        
        let totalAlleviatedCells = 0;
        let totalDisplacedCells = 0;
        let maxAlleviation = 0.0;
        let maxDisplacement = 0.0;
        
        const cellAreaM2 = (this.meta.dx || 5.67) * (this.meta.dy || 5.28);
        
        for (let i = 0; i < this.numCells; i++) {
            const hProt = protBuf[i * 4 + 0];
            const hBase = baseBuf[i * 4 + 0];
            const diff = hProt - hBase; // < 0 means flood reduced; > 0 means water displaced
            
            const idx4 = i * 4;
            
            if (diff <= -threshold) {
                // Alleviation (Green)
                const mag = Math.min(1.0, -diff / 2.0);
                diffData[idx4 + 0] = mag; // Alleviation
                diffData[idx4 + 1] = 0.0;
                diffData[idx4 + 2] = -diff;
                diffData[idx4 + 3] = 1.0;
                totalAlleviatedCells++;
                if (-diff > maxAlleviation) maxAlleviation = -diff;
            } else if (diff >= threshold) {
                // Displacement / Backwater Surcharge (Magenta / Red)
                const mag = Math.min(1.0, diff / 2.0);
                diffData[idx4 + 0] = 0.0;
                diffData[idx4 + 1] = mag; // Displacement
                diffData[idx4 + 2] = diff;
                diffData[idx4 + 3] = 1.0;
                totalDisplacedCells++;
                if (diff > maxDisplacement) maxDisplacement = diff;
            } else {
                diffData[idx4 + 0] = 0.0;
                diffData[idx4 + 1] = 0.0;
                diffData[idx4 + 2] = 0.0;
                diffData[idx4 + 3] = 0.0;
            }
        }
        
        this.diffTexture.needsUpdate = true;
        
        const alleviatedAreaHa = (totalAlleviatedCells * cellAreaM2) / 10000;
        const displacedAreaHa = (totalDisplacedCells * cellAreaM2) / 10000;
        
        return {
            alleviatedAreaHa: parseFloat(alleviatedAreaHa.toFixed(1)),
            displacedAreaHa: parseFloat(displacedAreaHa.toFixed(1)),
            maxAlleviation: parseFloat(maxAlleviation.toFixed(2)),
            maxDisplacement: parseFloat(maxDisplacement.toFixed(2))
        };
    }
    
    /**
     * Generate multi-criteria intervention scorecard comparing current options
     */
    generateScorecard(barriersManager, bldgStats, roadStats) {
        const wallCount = barriersManager ? barriersManager.barriers.filter(b => b.type === 'wall').length : 0;
        const sandbagCount = barriersManager ? barriersManager.barriers.filter(b => b.type === 'sandbags').length : 0;
        const totalWallLength = barriersManager ? barriersManager.getTotalLength() : 0;
        
        const savedBldgs = bldgStats ? bldgStats.savedCount : 0;
        const floodedBldgs = bldgStats ? bldgStats.floodedCount : 0;
        const totalThreatened = savedBldgs + floodedBldgs;
        const protectionEfficiency = totalThreatened > 0 ? (savedBldgs / totalThreatened) * 100 : 100;
        
        // Cost & Deployment Effort Estimation (OPW Standard Schedule)
        // Demountable walls: ~€1,850/m, deployment time ~3.5h for 1.5km
        // Sandbags: ~€45/m, deployment time ~8.0h (manual labour intensive)
        const wallCostEur = totalWallLength * 1850;
        const deploymentHours = wallCount > 0 ? 3.5 : (sandbagCount > 0 ? 8.0 : 0.0);
        
        // Resilience Index (0-100)
        let resilienceScore = 40; // baseline vulnerability
        if (totalWallLength > 500) resilienceScore += 35;
        if (this.sudsActive) resilienceScore += 12;
        if (this.pumpsActive) resilienceScore += 13;
        resilienceScore = Math.min(100, resilienceScore);
        
        this.currentScorecard = {
            defenses: {
                wallLengthM: totalWallLength,
                wallType: wallCount > 0 ? 'Demountable Aluminium (2.8m)' : (sandbagCount > 0 ? 'Sandbag Bunds (1.2m)' : 'None'),
                sudsActive: this.sudsActive,
                pumpsActive: this.pumpsActive
            },
            outcomes: {
                savedBuildings: savedBldgs,
                floodedRemaining: floodedBldgs,
                protectionRatePct: parseFloat(protectionEfficiency.toFixed(1)),
                hospitalSecured: roadStats ? roadStats.hospital?.accessible : true,
                deploymentTimeHrs: deploymentHours,
                resilienceIndex: resilienceScore
            }
        };
        
        return this.currentScorecard;
    }
}
