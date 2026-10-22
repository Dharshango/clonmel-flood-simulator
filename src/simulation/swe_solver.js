import * as THREE from 'three';
import { commonVertexShader, sweComputeShader, sweInitShader, sweSeekShader } from './swe_shaders.js';

export class SWESimulator {
    constructor(renderer, meta, elevArray, bldgMaskImg, riverMaskImg) {
        this.renderer = renderer;
        this.meta = meta;
        this.gridW = meta.grid_w;
        this.gridH = meta.grid_h;
        this.dx = meta.dx;
        this.dy = meta.dy;
        
        // River corridor inlet/outlet Y coordinates in UV space
        // River Suir enters west around lat 52.352 and exits east around 52.350
        const bbox = meta.bbox;
        const h_deg = bbox.north - bbox.south;
        // In our grid: row 0 is North (lat 52.364), row H is South (lat 52.345)
        // Texture UV y=0 is South, y=1 is North
        const inletLat = 52.3525;
        const outletLat = 52.3505;
        const inletUV_Y = (inletLat - bbox.south) / h_deg;
        const outletUV_Y = (outletLat - bbox.south) / h_deg;
        
        this.inletYMin = inletUV_Y - 0.05;
        this.inletYMax = inletUV_Y + 0.05;
        this.outletYMin = outletUV_Y - 0.05;
        this.outletYMax = outletUV_Y + 0.05;
        
        // Simulation parameters
        this.params = {
            riverInflow: 40.0,       // m^3/s (normal: 40, 100-year flood: 450)
            rainRate: 0.0,           // mm/hr
            downstreamSurge: 0.0,    // meters
            manningN: 0.028,         // Manning roughness
            subSteps: 3,             // SWE sub-steps per frame
            dt: 0.08,                // sub-step dt in seconds
            gravity: 9.81
        };
        
        this.totalSimTime = 0.0;
        this.initialVolume = 0.0;
        this.currentVolume = 0.0;
        this.cumulativeInflowVolume = 0.0;
        this.cumulativeRainVolume = 0.0;
        this.cumulativeOutflowVolume = 0.0;
        
        this._initTextures(elevArray, bldgMaskImg, riverMaskImg);
        this._initRenderTargets();
        this._initPipelines();
        this.reset();
    }
    
    _initTextures(elevArray, bldgMaskImg, riverMaskImg) {
        const gl = this.renderer.getContext();
        
        // 1. Elevation & Obstacles Texture (R: zb, G: isBldg)
        const elevData = new Float32Array(this.gridW * this.gridH * 4);
        
        // Create an offscreen canvas to sample building mask and river mask
        const canvas = document.createElement('canvas');
        canvas.width = this.gridW;
        canvas.height = this.gridH;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(bldgMaskImg, 0, 0);
        const bldgPix = ctx.getImageData(0, 0, this.gridW, this.gridH).data;
        
        ctx.clearRect(0, 0, this.gridW, this.gridH);
        ctx.drawImage(riverMaskImg, 0, 0);
        const riverPix = ctx.getImageData(0, 0, this.gridW, this.gridH).data;
        
        // Notice: In WebGL textures, row 0 in memory is bottom of texture (South)
        // In our raster elevArray, row 0 is North. So we invert Y for texture consistency
        for (let y = 0; y < this.gridH; y++) {
            const srcY = this.gridH - 1 - y; // flip Y
            for (let x = 0; x < this.gridW; x++) {
                const srcIdx = srcY * this.gridW + x;
                const dstIdx = (y * this.gridW + x) * 4;
                
                elevData[dstIdx + 0] = elevArray[srcIdx]; // zb (bed elevation in meters)
                elevData[dstIdx + 1] = bldgPix[srcIdx * 4] > 128 ? 1.0 : 0.0; // building mask
                elevData[dstIdx + 2] = riverPix[srcIdx * 4] > 128 ? 1.0 : 0.0; // river mask
                elevData[dstIdx + 3] = 0.0;
            }
        }
        
        this.elevTexture = new THREE.DataTexture(
            elevData,
            this.gridW,
            this.gridH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.elevTexture.minFilter = THREE.NearestFilter;
        this.elevTexture.magFilter = THREE.NearestFilter;
        this.elevTexture.needsUpdate = true;
        
        // 2. Barrier Texture (R: barrier height in meters, G: barrier type)
        this.barrierData = new Float32Array(this.gridW * this.gridH * 4);
        this.barrierTexture = new THREE.DataTexture(
            this.barrierData,
            this.gridW,
            this.gridH,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.barrierTexture.minFilter = THREE.NearestFilter;
        this.barrierTexture.magFilter = THREE.NearestFilter;
        this.barrierTexture.needsUpdate = true;
    }
    
    _initRenderTargets() {
        const options = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
            stencilBuffer: false
        };
        
        this.targetA = new THREE.WebGLRenderTarget(this.gridW, this.gridH, options);
        this.targetB = new THREE.WebGLRenderTarget(this.gridW, this.gridH, options);
        this.readTarget = this.targetA;
        this.writeTarget = this.targetB;
        
        // Readback buffer for CPU depth queries
        this.readbackBuffer = new Float32Array(this.gridW * this.gridH * 4);
        this.lastReadbackTime = -1.0;
    }
    
    _initPipelines() {
        // Orthographic camera and quad geometry for GPGPU passes
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new THREE.Scene();
        this.quadGeom = new THREE.PlaneGeometry(2, 2);
        
        // Compute Material
        this.computeMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: commonVertexShader,
            fragmentShader: sweComputeShader,
            uniforms: {
                u_stateTex: { value: null },
                u_elevTex: { value: this.elevTexture },
                u_barrierTex: { value: this.barrierTexture },
                u_resolution: { value: new THREE.Vector2(this.gridW, this.gridH) },
                u_dxdy: { value: new THREE.Vector2(this.dx, this.dy) },
                u_dt: { value: this.params.dt },
                u_gravity: { value: this.params.gravity },
                u_rainRate: { value: 0.0 },
                u_manningN: { value: this.params.manningN },
                u_riverInflow: { value: this.params.riverInflow },
                u_downstreamSurge: { value: this.params.downstreamSurge },
                u_inletYMin: { value: this.inletYMin },
                u_inletYMax: { value: this.inletYMax },
                u_outletYMin: { value: this.outletYMin },
                u_outletYMax: { value: this.outletYMax }
            }
        });
        
        // Init Material
        this.initMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: commonVertexShader,
            fragmentShader: sweInitShader,
            uniforms: {
                u_elevTex: { value: this.elevTexture },
                u_baseWaterLevel: { value: 17.0 }
            }
        });
        
        // Time-Seek Material (for instant, physically valid time scrubbing)
        this.seekMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: commonVertexShader,
            fragmentShader: sweSeekShader,
            uniforms: {
                u_elevTex: { value: this.elevTexture },
                u_barrierTex: { value: this.barrierTexture },
                u_targetTime: { value: 0.0 },
                u_riverInflow: { value: this.params.riverInflow },
                u_rainRate: { value: this.params.rainRate },
                u_downstreamSurge: { value: this.params.downstreamSurge },
                u_resolution: { value: new THREE.Vector2(this.gridW, this.gridH) }
            }
        });
        
        this.quadMesh = new THREE.Mesh(this.quadGeom, this.computeMaterial);
        this.scene.add(this.quadMesh);
    }
    
    seekTime(targetSec) {
        this.totalSimTime = Math.max(0.0, Math.min(21600.0, targetSec));
        
        // If seeking back to 0, use pristine init condition
        if (this.totalSimTime <= 5.0) {
            this.reset();
            return;
        }

        // 1. Configure seek uniforms
        this.seekMaterial.uniforms.u_targetTime.value = this.totalSimTime;
        this.seekMaterial.uniforms.u_riverInflow.value = this.params.riverInflow;
        this.seekMaterial.uniforms.u_rainRate.value = this.params.rainRate;
        this.seekMaterial.uniforms.u_downstreamSurge.value = this.params.downstreamSurge;
        
        // 2. Render seek state into both targets
        this.quadMesh.material = this.seekMaterial;
        this.renderer.setRenderTarget(this.targetA);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(this.targetB);
        this.renderer.render(this.scene, this.camera);
        
        this.readTarget = this.targetA;
        this.writeTarget = this.targetB;
        
        // 3. Relax state with 6 numerical SWE flux sub-steps
        const currentInflow = this.getCurrentInflow();
        const currentRain = this.getCurrentRain();
        const currentSurge = this.getCurrentSurge();
        const rain_m_s = (currentRain / 1000.0) / 3600.0;
        
        this.computeMaterial.uniforms.u_rainRate.value = rain_m_s;
        this.computeMaterial.uniforms.u_riverInflow.value = currentInflow;
        this.computeMaterial.uniforms.u_downstreamSurge.value = currentSurge;
        this.computeMaterial.uniforms.u_manningN.value = this.params.manningN;
        this.computeMaterial.uniforms.u_dt.value = 0.085;
        this.quadMesh.material = this.computeMaterial;
        
        for (let i = 0; i < 6; i++) {
            this.computeMaterial.uniforms.u_stateTex.value = this.readTarget.texture;
            this.renderer.setRenderTarget(this.writeTarget);
            this.renderer.render(this.scene, this.camera);
            
            const temp = this.readTarget;
            this.readTarget = this.writeTarget;
            this.writeTarget = temp;
        }
        
        this.renderer.setRenderTarget(null);
        this.updateReadback();
        this.currentVolume = this.computeTotalVolume();
    }
    
    reset() {
        this.totalSimTime = 0.0;
        this.cumulativeInflowVolume = 0.0;
        this.cumulativeRainVolume = 0.0;
        this.cumulativeOutflowVolume = 0.0;
        
        // Run init pass to fill River Suir channel with baseline water
        this.quadMesh.material = this.initMaterial;
        this.renderer.setRenderTarget(this.targetA);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(this.targetB);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        
        this.readTarget = this.targetA;
        this.writeTarget = this.targetB;
        this.quadMesh.material = this.computeMaterial;
        
        this.updateReadback();
        this.initialVolume = this.computeTotalVolume();
        this.currentVolume = this.initialVolume;
    }
    
    getHydrographFactor() {
        // Smooth progression over 6 simulated hours (21600 seconds)
        const T = Math.min(1.0, Math.max(0.0, this.totalSimTime / 21600.0));
        if (T <= 0.35) {
            const p = T / 0.35;
            return p * p * (3.0 - 2.0 * p);
        } else if (T <= 0.70) {
            return 1.0;
        } else {
            const p = (T - 0.70) / 0.30;
            return 1.0 - 0.15 * (p * p * (3.0 - 2.0 * p));
        }
    }
    
    getCurrentInflow() {
        const target = this.params.riverInflow;
        const base = 55.0; // normal River Suir flow
        if (target <= base) return base;
        return base + (target - base) * this.getHydrographFactor();
    }
    
    getCurrentRain() {
        return this.params.rainRate * this.getHydrographFactor();
    }
    
    getCurrentSurge() {
        return this.params.downstreamSurge * this.getHydrographFactor();
    }

    step(dtMultiplier = 1.0) {
        const currentInflow = this.getCurrentInflow();
        const currentRain = this.getCurrentRain();
        const currentSurge = this.getCurrentSurge();
        
        // Convert rain rate from mm/hr to m/s: 1 mm/hr = 1e-3 / 3600 m/s = 2.777e-7 m/s
        const rain_m_s = (currentRain / 1000.0) / 3600.0;
        
        this.computeMaterial.uniforms.u_rainRate.value = rain_m_s;
        this.computeMaterial.uniforms.u_riverInflow.value = currentInflow;
        this.computeMaterial.uniforms.u_downstreamSurge.value = currentSurge;
        this.computeMaterial.uniforms.u_manningN.value = this.params.manningN;
        
        // Dynamic sub-stepping scaling:
        const maxStableDt = 0.085;
        const targetTotalDt = this.params.dt * dtMultiplier * this.params.subSteps;
        const neededSteps = Math.ceil(targetTotalDt / maxStableDt);
        const subSteps = Math.min(28, Math.max(3, neededSteps));
        const dt = Math.min(maxStableDt, targetTotalDt / subSteps);
        this.computeMaterial.uniforms.u_dt.value = dt;
        
        this.quadMesh.material = this.computeMaterial;
        
        for (let i = 0; i < subSteps; i++) {
            this.computeMaterial.uniforms.u_stateTex.value = this.readTarget.texture;
            this.renderer.setRenderTarget(this.writeTarget);
            this.renderer.render(this.scene, this.camera);
            
            // Swap ping-pong targets
            const temp = this.readTarget;
            this.readTarget = this.writeTarget;
            this.writeTarget = temp;
            
            this.totalSimTime += dt;
        }
        
        this.renderer.setRenderTarget(null);
    }
    
    // Readback simulation texture to CPU buffer
    updateReadback() {
        this.renderer.readRenderTargetPixels(
            this.readTarget,
            0,
            0,
            this.gridW,
            this.gridH,
            this.readbackBuffer
        );
        this.lastReadbackTime = this.totalSimTime;
    }
    
    // Get depth and velocity at physical normalized coordinates [0..1]
    samplePoint(u, v) {
        const px = Math.min(this.gridW - 1, Math.max(0, Math.floor(u * this.gridW)));
        const py = Math.min(this.gridH - 1, Math.max(0, Math.floor(v * this.gridH)));
        const idx = (py * this.gridW + px) * 4;
        
        // Elevation buffer
        // Note: py in WebGL is from bottom. To sample elevArray (which is top-to-bottom):
        const srcY = this.gridH - 1 - py;
        const elevIdx = (srcY * this.gridW + px);
        
        return {
            h: this.readbackBuffer[idx],
            qx: this.readbackBuffer[idx + 1],
            qy: this.readbackBuffer[idx + 2],
            peak_h: this.readbackBuffer[idx + 3],
            u: this.readbackBuffer[idx] > 0.01 ? this.readbackBuffer[idx + 1] / this.readbackBuffer[idx] : 0.0,
            v: this.readbackBuffer[idx] > 0.01 ? this.readbackBuffer[idx + 2] / this.readbackBuffer[idx] : 0.0
        };
    }
    
    // Compute total water volume across entire domain in m^3
    computeTotalVolume() {
        let totalH = 0.0;
        const totalCells = this.gridW * this.gridH;
        for (let i = 0; i < totalCells; i++) {
            totalH += this.readbackBuffer[i * 4];
        }
        return totalH * this.dx * this.dy;
    }
    
    // Add barrier line (wall or sandbags) into barrier texture
    setBarrierSegment(x0, y0, x1, y1, height = 2.2, widthCells = 2) {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist * 2));
        
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const cx = Math.round(x0 + t * (x1 - x0));
            const cy = Math.round(y0 + t * (y1 - y0));
            
            for (let dy = -widthCells; dy <= widthCells; dy++) {
                for (let dx = -widthCells; dx <= widthCells; dx++) {
                    const gx = cx + dx;
                    const gy = cy + dy;
                    if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
                        const idx = (gy * this.gridW + gx) * 4;
                        this.barrierData[idx] = Math.max(this.barrierData[idx], height);
                    }
                }
            }
        }
        this.barrierTexture.needsUpdate = true;
    }
    
    clearBarriers() {
        this.barrierData.fill(0);
        this.barrierTexture.needsUpdate = true;
    }
    
    getWaterTexture() {
        return this.readTarget.texture;
    }
}
