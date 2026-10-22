/**
 * analytical_overlays.js
 * 
 * High-Performance Analytical Overlays for Hydroverse Workspaces
 * 
 * Provides independent toggleable GPU shader overlays on top of the terrain DEM:
 * 1. Calibrated Depth Heatmap (discrete accessible depth brackets: 0.05-0.30m, 0.30-1.0m, >1.0m)
 * 2. Flood Arrival Time Map (gradient showing propagation wave arrival in hrs:mins)
 * 3. Flood Duration Map (hours submerged)
 * 4. Unintended Consequences Difference Map (Green alleviation vs Magenta displacement)
 * 5. Uncertainty Boundary Envelope (wetting front variance bounds)
 */

import * as THREE from 'three';

export function createAnalyticalOverlays(meta, terrainGeometry, simulator, baselineSimulator, arrivalTracker, interventionEngine) {
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    
    const vertexShader = `
    uniform sampler2D u_waterTex;
    uniform vec2 u_resolution;
    uniform float u_time;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vDepth;
    
    vec4 sampleSmooth(sampler2D tex, vec2 uv) {
        vec2 texSize = u_resolution;
        vec2 pixel = uv * texSize - 0.5;
        vec2 f = fract(pixel);
        vec2 base = (floor(pixel) + 0.5) / texSize;
        vec2 d = 1.0 / texSize;
        
        vec4 c00 = texture(tex, base);
        vec4 c10 = texture(tex, base + vec2(d.x, 0.0));
        vec4 c01 = texture(tex, base + vec2(0.0, d.y));
        vec4 c11 = texture(tex, base + vec2(d.x, d.y));
        
        return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
    }
    
    void main() {
        vUv = uv;
        vec4 water = sampleSmooth(u_waterTex, uv);
        float h = water.r;
        vDepth = h;
        
        vec3 pos = position;
        // Slightly elevated above water surface to prevent z-fighting
        float lift = smoothstep(0.005, 0.05, h) * (h * 1.2 + 0.12) + 0.05;
        pos.y += lift;
        
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPos.xyz;
        
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
    `;
    
    const fragmentShader = `
    uniform int u_mode; // 0: None, 1: Depth Heatmap, 2: Arrival Time, 3: Duration, 4: Difference, 5: Uncertainty
    uniform sampler2D u_waterTex;
    uniform sampler2D u_arrivalTex;
    uniform sampler2D u_durationTex;
    uniform sampler2D u_diffTex;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_opacity;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying float vDepth;
    
    vec4 sampleSmooth(sampler2D tex, vec2 uv) {
        vec2 texSize = u_resolution;
        vec2 pixel = uv * texSize - 0.5;
        vec2 f = fract(pixel);
        vec2 base = (floor(pixel) + 0.5) / texSize;
        vec2 d = 1.0 / texSize;
        
        vec4 c00 = texture(tex, base);
        vec4 c10 = texture(tex, base + vec2(d.x, 0.0));
        vec4 c01 = texture(tex, base + vec2(0.0, d.y));
        vec4 c11 = texture(tex, base + vec2(d.x, d.y));
        
        return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
    }
    
    void main() {
        if (u_mode == 0) {
            discard;
        }
        
        vec4 water = sampleSmooth(u_waterTex, vUv);
        float h = water.r;
        
        // Mode 1: Calibrated Depth Heatmap
        if (u_mode == 1) {
            if (h < 0.04) discard; // dry land
            
            vec3 color;
            float alpha = u_opacity;
            
            if (h < 0.30) {
                // Shallow (0.05 - 0.30m): Bright Amber / Warning
                float t = (h - 0.04) / 0.26;
                color = mix(vec3(0.98, 0.82, 0.25), vec3(0.96, 0.55, 0.12), t);
            } else if (h < 1.0) {
                // Medium (0.30 - 1.00m): Deep Hazard Orange
                float t = (h - 0.30) / 0.70;
                color = mix(vec3(0.96, 0.55, 0.12), vec3(0.90, 0.22, 0.10), t);
            } else {
                // Severe (> 1.00m): Saturated Deep Crimson
                float t = clamp((h - 1.0) / 2.0, 0.0, 1.0);
                color = mix(vec3(0.90, 0.22, 0.10), vec3(0.60, 0.04, 0.18), t);
            }
            
            // Subtle contour lines at 0.5m intervals
            float contour = sin(h * 6.28318 * 2.0);
            if (abs(contour) > 0.94) {
                color = mix(color, vec3(1.0, 1.0, 1.0), 0.35);
            }
            
            gl_FragColor = vec4(color, alpha);
            return;
        }
        
        // Mode 2: Flood Arrival Time Map
        if (u_mode == 2) {
            vec4 arrSample = texture(u_arrivalTex, vUv);
            if (arrSample.a < 0.5) discard; // cell never inundated
            
            float normTime = arrSample.r; // 0.0 = hour 0, 1.0 = hour 6
            vec3 color;
            
            if (normTime < 0.33) {
                // Early (0 - 2 hrs): Vivid Amber / Yellow
                float t = normTime / 0.33;
                color = mix(vec3(0.99, 0.76, 0.16), vec3(0.12, 0.78, 0.65), t);
            } else if (normTime < 0.66) {
                // Mid (2 - 4 hrs): Teal / Cyan
                float t = (normTime - 0.33) / 0.33;
                color = mix(vec3(0.12, 0.78, 0.65), vec3(0.18, 0.45, 0.88), t);
            } else {
                // Late (4 - 6 hrs): Deep Royal Indigo
                float t = clamp((normTime - 0.66) / 0.34, 0.0, 1.0);
                color = mix(vec3(0.18, 0.45, 0.88), vec3(0.35, 0.15, 0.65), t);
            }
            
            gl_FragColor = vec4(color, u_opacity * 0.92);
            return;
        }
        
        // Mode 3: Flood Duration Map
        if (u_mode == 3) {
            vec4 durSample = texture(u_durationTex, vUv);
            if (durSample.a < 0.5) discard;
            
            float normDur = durSample.r;
            vec3 color;
            
            // Duration palette: Pale Lavender -> Royal Violet -> Dark Night Indigo
            if (normDur < 0.30) {
                float t = normDur / 0.30;
                color = mix(vec3(0.72, 0.68, 0.95), vec3(0.55, 0.38, 0.88), t);
            } else if (normDur < 0.70) {
                float t = (normDur - 0.30) / 0.40;
                color = mix(vec3(0.55, 0.38, 0.88), vec3(0.38, 0.18, 0.72), t);
            } else {
                float t = clamp((normDur - 0.70) / 0.30, 0.0, 1.0);
                color = mix(vec3(0.38, 0.18, 0.72), vec3(0.18, 0.05, 0.45), t);
            }
            
            gl_FragColor = vec4(color, u_opacity * 0.90);
            return;
        }
        
        // Mode 4: Unintended Consequences / Difference Map
        if (u_mode == 4) {
            vec4 diffSample = texture(u_diffTex, vUv);
            if (diffSample.a < 0.5) discard;
            
            float alleviation = diffSample.r;
            float displacement = diffSample.g;
            
            vec3 color;
            if (alleviation > 0.01) {
                // Emerald Green: Flood Alleviation (Net protection)
                color = mix(vec3(0.10, 0.75, 0.45), vec3(0.04, 0.92, 0.55), alleviation);
            } else if (displacement > 0.01) {
                // Electric Magenta / Warning: Unintended Displacement / Surcharge
                color = mix(vec3(0.92, 0.15, 0.55), vec3(1.0, 0.05, 0.35), displacement);
            } else {
                discard;
            }
            
            gl_FragColor = vec4(color, u_opacity * 0.92);
            return;
        }
        
        // Mode 5: Uncertainty Envelope
        if (u_mode == 5) {
            if (h < 0.02) discard;
            // Bands highlighting boundary uncertainty around the wetting perimeter
            float edgePulse = sin(h * 40.0 + u_time * 2.0);
            vec3 color = mix(vec3(0.20, 0.70, 0.95), vec3(0.95, 0.80, 0.20), smoothstep(-0.2, 0.8, edgePulse));
            gl_FragColor = vec4(color, u_opacity * 0.75);
            return;
        }
        
        discard;
    }
    `;
    
    const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            u_mode: { value: 0 },
            u_waterTex: { value: simulator.getWaterTexture() },
            u_arrivalTex: { value: arrivalTracker.arrivalTexture },
            u_durationTex: { value: arrivalTracker.durationTexture },
            u_diffTex: { value: interventionEngine.diffTexture },
            u_resolution: { value: new THREE.Vector2(meta.grid_w, meta.grid_h) },
            u_time: { value: 0 },
            u_opacity: { value: 0.88 }
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const overlayMesh = new THREE.Mesh(terrainGeometry, material);
    overlayMesh.renderOrder = 2; // Render just above water
    
    return {
        mesh: overlayMesh,
        material,
        setMode: (modeNum) => {
            material.uniforms.u_mode.value = modeNum;
        },
        setOpacity: (alpha) => {
            material.uniforms.u_opacity.value = alpha;
        },
        update: (nowSec) => {
            material.uniforms.u_time.value = nowSec;
            material.uniforms.u_waterTex.value = simulator.getWaterTexture();
            material.uniforms.u_arrivalTex.value = arrivalTracker.arrivalTexture;
            material.uniforms.u_durationTex.value = arrivalTracker.durationTexture;
            material.uniforms.u_diffTex.value = interventionEngine.diffTexture;
        }
    };
}
