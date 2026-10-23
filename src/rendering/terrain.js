import * as THREE from 'three';

export function createTerrainMesh(meta, elevArray, normalTexture) {
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    
    // Geometry with 1 vertex per grid cell
    const segsX = Math.min(300, gridW - 1);
    const segsY = Math.min(200, gridH - 1);
    const geometry = new THREE.PlaneGeometry(width_m, height_m, segsX, segsY);
    geometry.rotateX(-Math.PI / 2); // horizontal X-Z plane
    
    const pos = geometry.attributes.position;
    const uvs = geometry.attributes.uv;
    
    // Sample elevations
    for (let i = 0; i < pos.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        
        // In UV: u is [0..1] West to East, v is [0..1] South to North
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
        const elev = elevArray[gy * gridW + gx];
        
        // Exaggeration factor: 1.2x for natural river valley legibility
        pos.setY(i, elev * 1.2);
    }
    
    geometry.computeVertexNormals();
    
    // Refined slate gray ground material with normal mapping for topography & riverbanks
    const terrainMaterial = new THREE.MeshStandardMaterial({
        color: 0x242a35, // sleek slate gray ground
        roughness: 0.88,
        metalness: 0.08,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(0.75, 0.75),
        flatShading: false
    });
    
    const mesh = new THREE.Mesh(geometry, terrainMaterial);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    
    return { mesh, geometry, material: terrainMaterial };
}

export function createWaterMesh(meta, terrainGeometry, simulator) {
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    
    const waterVertexShader = `
    uniform sampler2D u_waterTex;      // R: h, G: qx, B: qy, A: peak_h
    uniform vec2 u_resolution;
    uniform float u_time;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vDepth;
    
    // Smooth 4-tap bilinear sampling function
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
        
        // Physical water surface elevation:
        // Smooth continuous lift without geometric cliff tearing or glitches
        float lift = smoothstep(0.005, 0.05, h) * (h * 1.2 + 0.08);
        pos.y += lift;
        
        if (h > 0.03) {
            // Soft gentle surface wave
            float wave = sin(position.x * 0.015 + u_time * 0.9) * cos(position.z * 0.015 - u_time * 0.7) * 0.03;
            pos.y += wave;
        }
        
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normal;
        
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
    `;
    
    const waterFragmentShader = `
    uniform sampler2D u_waterTex;      // R: h, G: qx, B: qy, A: peak_h
    uniform sampler2D u_elevTex;       // R: zb, G: bldg_mask, B: river_mask
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_lightPos;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vDepth;
    
    // Smooth 4-tap bilinear sampling
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
        vec4 water = sampleSmooth(u_waterTex, vUv);
        float h = water.r;
        
        vec4 elev = sampleSmooth(u_elevTex, vUv);
        float isRiver = elev.b; // 1.0 inside River Suir bed, 0.0 on flood plains / streets
        bool isSuirIsland = (vUv.x >= 0.47 && vUv.x <= 0.57 && vUv.y >= 0.28 && vUv.y <= 0.37);
        
        // In natural river channel or Suir Island flood, render water depths > 0.02m
        if (isRiver > 0.1 || (isSuirIsland && h > 0.02)) {
            if (h < 0.02) discard;
        } else {
            // Discard any moisture on upland hills (elev > 22.0m OD)
            if (elev.r > 22.0) discard;
            // On low-lying floodplain (elev <= 22.0m), require true flood depth (> 0.06m)
            if (h < 0.06) discard;
        }
        
        // 1. Natural River Suir Channel: Pure, silky, vibrant royal sapphire-azure blue (ZERO glitch, zero orange in river)
        vec3 suirDeep = vec3(0.04, 0.22, 0.82); // deep royal sapphire blue
        vec3 suirMid  = vec3(0.12, 0.48, 0.96); // vibrant azure blue
        vec3 suirBlue = mix(suirMid, suirDeep, smoothstep(0.30, 2.20, h));
        
        // 2. Overland Flooding (When water overflows out of the river into town streets/quays)
        // Flooded overflow regions display the requested orangish-yellow warning tone in the flood area
        vec3 floodOrangeYellow = vec3(0.96, 0.58, 0.08); // warm orangish-yellow for flood spill
        vec3 rainSpreadBlue    = vec3(0.14, 0.52, 0.94); // pure silky blue for rain spread
        
        // When water overflows onto dry ground / streets (isRiver < 0.35):
        // Only actual significant flood spills (h > 0.18m) turn to orangish-yellow warning
        vec3 overlandColor = mix(rainSpreadBlue, floodOrangeYellow, smoothstep(0.18, 0.42, h));
        
        // Inside River Suir or across flooded Suir Island: vibrant sapphire-azure river flood water!
        vec3 waterColor = mix(overlandColor, suirBlue, smoothstep(0.20, 0.65, isRiver));
        if (isSuirIsland) {
            waterColor = suirBlue;
        }
        
        // Kinetic flow streamlines along river Suir
        vec2 q = water.gb;
        float speed = length(q) / max(0.05, h);
        float streamPattern = sin((vWorldPosition.x * 0.05 - vWorldPosition.z * 0.025) + u_time * (1.2 + speed * 0.4));
        float streamGlint = smoothstep(0.45, 0.95, streamPattern) * min(0.12, speed * 0.08);
        waterColor += vec3(streamGlint);
        
        // Gentle, calm, low-frequency wave normal perturbation
        float w1 = sin(vWorldPosition.x * 0.018 + u_time * 0.8) * cos(vWorldPosition.z * 0.018 - u_time * 0.6);
        float w2 = sin(vWorldPosition.x * 0.035 - vWorldPosition.z * 0.030 + u_time * 1.1);
        float ripple = (w1 * 0.6 + w2 * 0.4) * 0.04;
        
        vec3 N = normalize(vNormal + vec3(ripple, 1.0, ripple));
        vec3 L = normalize(u_lightPos - vWorldPosition);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 H = normalize(L + V);
        
        // Diffuse lighting
        float NdotL = max(0.0, dot(N, L));
        
        // Soft subtle specular highlight (silky water surface glisten)
        float spec = pow(max(0.0, dot(N, H)), 48.0) * 0.35;
        
        // Gentle Fresnel rim glint
        float fresnel = pow(1.0 - max(0.0, dot(V, N)), 2.5) * 0.18;
        
        // Feathered alpha edge: smoothly blends into terrain without any jagged stair-steps
        float alpha = smoothstep(0.010, 0.06, h) * 0.94;
        
        vec3 finalColor = waterColor * (0.82 + 0.18 * NdotL) + vec3(spec + fresnel);
        
        gl_FragColor = vec4(finalColor, alpha);
    }
    `;
    
    const waterGeom = terrainGeometry.clone();
    
    const waterMaterial = new THREE.ShaderMaterial({
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        uniforms: {
            u_waterTex: { value: simulator.getWaterTexture() },
            u_elevTex: { value: simulator.elevTexture },
            u_resolution: { value: new THREE.Vector2(meta.grid_w, meta.grid_h) },
            u_time: { value: 0.0 },
            u_lightPos: { value: new THREE.Vector3(800, 1500, 600) }
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    
    const waterMesh = new THREE.Mesh(waterGeom, waterMaterial);
    
    return { waterMesh, waterMaterial };
}
