/**
 * arrival_duration.js
 * 
 * Computes, tracks, and exposes physical spatial matrices for:
 * 1. Flood Arrival Time: First simulation second when water depth h >= 0.05m
 * 2. Flood Duration: Cumulative seconds cell has remained inundated (h >= 0.05m)
 * 3. Peak Flood Depth: Maximum depth reached over the event
 * 4. Recession Timing: When water receded below threshold after peaking
 */

import * as THREE from 'three';

export class ArrivalDurationTracker {
    constructor(gridW, gridH, bbox) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.bbox = bbox;
        this.numCells = gridW * gridH;
        
        // Matrices
        this.arrivalTime = new Float32Array(this.numCells).fill(-1.0); // -1 = not inundated
        this.duration = new Float32Array(this.numCells).fill(0.0);    // cumulative seconds
        this.peakDepth = new Float32Array(this.numCells).fill(0.0);   // meters
        this.recessionTime = new Float32Array(this.numCells).fill(-1.0);
        
        // Float textures for GPU visualization shaders
        this.arrivalTexture = new THREE.DataTexture(
            new Float32Array(this.numCells * 4),
            gridW, gridH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.arrivalTexture.minFilter = THREE.LinearFilter;
        this.arrivalTexture.magFilter = THREE.LinearFilter;
        
        this.durationTexture = new THREE.DataTexture(
            new Float32Array(this.numCells * 4),
            gridW, gridH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.durationTexture.minFilter = THREE.LinearFilter;
        this.durationTexture.magFilter = THREE.LinearFilter;
    }
    
    reset() {
        this.arrivalTime.fill(-1.0);
        this.duration.fill(0.0);
        this.peakDepth.fill(0.0);
        this.recessionTime.fill(-1.0);
        
        const arrData = this.arrivalTexture.image.data;
        const durData = this.durationTexture.image.data;
        arrData.fill(0);
        durData.fill(0);
        this.arrivalTexture.needsUpdate = true;
        this.durationTexture.needsUpdate = true;
    }
    
    /**
     * Called during simulation readback cycle (~5-10 Hz)
     * @param {Float32Array} readbackBuffer - RGBA buffer from WebGL SWE solver (R: h, G: qx, B: qy, A: peak)
     * @param {number} currentSimTime - Current simulation timestamp in seconds (0 to 21600)
     * @param {number} dtAdvance - Time advanced since last tracker update
     */
    update(readbackBuffer, currentSimTime, dtAdvance = 0.5) {
        if (!readbackBuffer || readbackBuffer.length < this.numCells * 4) return;
        
        const arrData = this.arrivalTexture.image.data;
        const durData = this.durationTexture.image.data;
        const threshold = 0.05; // 5 cm inundation threshold
        
        for (let i = 0; i < this.numCells; i++) {
            const h = readbackBuffer[i * 4 + 0];
            
            if (h >= threshold) {
                // First arrival
                if (this.arrivalTime[i] < 0) {
                    this.arrivalTime[i] = currentSimTime;
                    // Normalized for texture (0 to 1 over 6 hours = 21600s)
                    const normTime = Math.min(1.0, currentSimTime / 21600.0);
                    arrData[i * 4 + 0] = normTime;
                    arrData[i * 4 + 3] = 1.0; // active flag
                }
                
                // Cumulative duration
                this.duration[i] += dtAdvance;
                const normDur = Math.min(1.0, this.duration[i] / 21600.0);
                durData[i * 4 + 0] = normDur;
                durData[i * 4 + 3] = 1.0;
                
                // Peak depth
                if (h > this.peakDepth[i]) {
                    this.peakDepth[i] = h;
                }
            } else if (this.arrivalTime[i] >= 0 && this.recessionTime[i] < 0) {
                // Inundated previously, now receded
                if (currentSimTime > this.arrivalTime[i] + 300) {
                    this.recessionTime[i] = currentSimTime;
                }
            }
        }
        
        this.arrivalTexture.needsUpdate = true;
        this.durationTexture.needsUpdate = true;
    }
    
    /**
     * Query point telemetry by UV (0 to 1)
     */
    queryUV(u, v) {
        const x = Math.min(this.gridW - 1, Math.max(0, Math.floor(u * this.gridW)));
        const y = Math.min(this.gridH - 1, Math.max(0, Math.floor(v * this.gridH)));
        const idx = y * this.gridW + x;
        
        const arr = this.arrivalTime[idx];
        const dur = this.duration[idx];
        const peak = this.peakDepth[idx];
        const rec = this.recessionTime[idx];
        
        return {
            isFlooded: arr >= 0,
            arrivalTimeSec: arr,
            arrivalFormatted: arr >= 0 ? this._formatTime(arr) : 'Not inundated in this scenario',
            durationSec: dur,
            durationFormatted: dur > 0 ? this._formatDuration(dur) : '0 min',
            peakDepthM: peak,
            recessionFormatted: rec >= 0 ? this._formatTime(rec) : (arr >= 0 ? 'Water remaining' : 'N/A')
        };
    }
    
    _formatTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    _formatDuration(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m} min`;
    }
}
