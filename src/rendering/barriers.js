import * as THREE from 'three';

export function createBarriersManager(scene, meta, simulator, elevArray) {
    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    
    const barrierGroup = new THREE.Group();
    scene.add(barrierGroup);
    
    const barrierList = [];
    
    // Premium Engineered Materials
    // 1. Flood Wall Materials (Aluminium flood plank panels + dark stainless steel cap + concrete foundation)
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // silver anodized structural aluminium
        metalness: 0.82,
        roughness: 0.32,
        depthTest: true,
        depthWrite: true
    });

    const wallCapMaterial = new THREE.MeshStandardMaterial({
        color: 0x334155, // dark marine-grade steel capping trim
        metalness: 0.88,
        roughness: 0.22,
        depthTest: true,
        depthWrite: true
    });

    const wallPostMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // heavy vertical H-beam support stanchion
        metalness: 0.75,
        roughness: 0.35,
        depthTest: true,
        depthWrite: true
    });

    const warningStripMaterial = new THREE.MeshStandardMaterial({
        color: 0xf59e0b, // amber reflector hazard strip at post crest
        roughness: 0.3,
        metalness: 0.2,
        emissive: 0xd97706,
        emissiveIntensity: 0.35,
        depthTest: true,
        depthWrite: true
    });

    const wallFootingMaterial = new THREE.MeshStandardMaterial({
        color: 0x475569, // deep underground concrete footing
        roughness: 0.9,
        metalness: 0.1,
        depthTest: true,
        depthWrite: true
    });

    // 2. Sandbag Bund Materials (Heavy burlap/hessian multi-tiered bund)
    const sandbagMaterial = new THREE.MeshStandardMaterial({
        color: 0xc2a649, // burlap sandbag tan/gold
        roughness: 0.94,
        metalness: 0.04,
        depthTest: true,
        depthWrite: true
    });

    const sandbagTier2Material = new THREE.MeshStandardMaterial({
        color: 0xa88f3c, // darker middle tier burlap
        roughness: 0.96,
        metalness: 0.03,
        depthTest: true,
        depthWrite: true
    });

    const sandbagBaseMaterial = new THREE.MeshStandardMaterial({
        color: 0x786227, // embedded damp riverbed base
        roughness: 0.98,
        metalness: 0.02,
        depthTest: true,
        depthWrite: true
    });
    
    function getElevationAtLonLat(lon, lat) {
        const u = (lon - bbox.west) / w_deg;
        const v = (lat - bbox.south) / h_deg;
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
        return (elevArray[gy * gridW + gx] || 18.0) * 1.2;
    }

    function lonlatToWorld(lon, lat) {
        const posX = ((lon - bbox.west) / w_deg - 0.5) * width_m;
        const posZ = -((lat - bbox.south) / h_deg - 0.5) * height_m;
        const elev = getElevationAtLonLat(lon, lat);
        return new THREE.Vector3(posX, elev, posZ);
    }
    
    function lonlatToGrid(lon, lat) {
        const gx = ((lon - bbox.west) / w_deg) * gridW;
        const gy = ((lat - bbox.south) / h_deg) * gridH; // in texture UV coords
        return { gx, gy };
    }
    
    /**
     * Add a watertight, glitch-free barrier polyline.
     * @param {Array<[number, number]>} pointsLonLat Array of [lon, lat] coordinates
     * @param {'wall'|'sandbags'} type Type of defense
     * @param {number} height Crest height in meters above local ground/water surface (default 2.8m for wall, 1.2m for sandbags)
     * @param {number} depth Foundation embedment depth in meters below riverbed/ground (default 2.0m for wall, 1.0m for sandbags)
     * @param {number} thickness Barrier thickness/base width in meters (default 1.2m for wall, 2.4m for sandbags)
     * @param {string} name Descriptive name
     */
    function addBarrierPolyline(
        pointsLonLat,
        type = 'wall',
        height = 2.8,
        depth = 2.0,
        thickness = null,
        name = 'Custom Barrier'
    ) {
        if (!pointsLonLat || pointsLonLat.length < 2) return;
        
        const isWall = type === 'wall';
        const effectiveThickness = thickness || (isWall ? 1.2 : 2.4);
        const effectiveHeight = Math.max(0.3, Number(height) || (isWall ? 2.8 : 1.2));
        const effectiveDepth = Math.max(0.3, Number(depth) || (isWall ? 2.0 : 1.0));
        
        const meshes = [];
        const widthCells = Math.max(2, isWall ? Math.round(effectiveThickness / 1.2) : Math.round(effectiveThickness / 1.0));
        
        // If drawing encloses an area (>= 3 points), protect the interior space
        if (pointsLonLat.length >= 3 && simulator && typeof simulator.protectPolygon === 'function') {
            const gridPts = pointsLonLat.map(p => lonlatToGrid(p[0], p[1]));
            simulator.protectPolygon(gridPts);
        }

        for (let i = 0; i < pointsLonLat.length - 1; i++) {
            const p0 = pointsLonLat[i];
            const p1 = pointsLonLat[i + 1];
            
            // 1. Rasterize into GPU shallow water solver (blocks flow physically)
            const g0 = lonlatToGrid(p0[0], p0[1]);
            const g1 = lonlatToGrid(p1[0], p1[1]);
            simulator.setBarrierSegment(g0.gx, g0.gy, g1.gx, g1.gy, effectiveHeight, widthCells);
            
            // 2. Compute 3D segment endpoints
            const w0 = lonlatToWorld(p0[0], p0[1]);
            const w1 = lonlatToWorld(p1[0], p1[1]);
            
            const fullVec = new THREE.Vector3().subVectors(w1, w0);
            const fullDist = Math.hypot(fullVec.x, fullVec.z);
            if (fullDist < 0.1) continue;
            
            // 3. Subdivide segment into ~2m sub-steps so the barrier strictly hugs bathymetry / riverbed contour
            // This guarantees the foundation follows uneven bed geometry with ZERO gaps, preventing any water clipping
            const numSteps = Math.max(1, Math.ceil(fullDist / 2.2));
            
            for (let s = 0; s < numSteps; s++) {
                const t0 = s / numSteps;
                const t1 = (s + 1) / numSteps;
                
                const lonA = p0[0] + t0 * (p1[0] - p0[0]);
                const latA = p0[1] + t0 * (p1[1] - p0[1]);
                const lonB = p0[0] + t1 * (p1[0] - p0[0]);
                const latB = p0[1] + t1 * (p1[1] - p0[1]);
                
                const sw0 = lonlatToWorld(lonA, latA);
                const sw1 = lonlatToWorld(lonB, latB);
                
                const subLen = Math.hypot(sw1.x - sw0.x, sw1.z - sw0.z);
                if (subLen < 0.05) continue;
                
                // Ground elevations along subsegment (scaled by 1.2x vertical terrain scale)
                const elev0 = sw0.y;
                const elev1 = sw1.y;
                const elevMin = Math.min(elev0, elev1);
                const elevMax = Math.max(elev0, elev1);
                
                // Physical watertight elevation boundaries:
                // Base extends DOWN into riverbed by effectiveDepth * 1.2 (guarantees penetration into bed)
                // Crest extends UP above highest ground by effectiveHeight * 1.2
                const baseY = elevMin - (effectiveDepth * 1.2);
                const crestY = elevMax + (effectiveHeight * 1.2);
                const totalH = Math.max(0.5, crestY - baseY);
                const midY = (crestY + baseY) * 0.5;
                
                const midX = (sw0.x + sw1.x) * 0.5;
                const midZ = (sw0.z + sw1.z) * 0.5;
                const targetPoint = new THREE.Vector3(sw1.x, midY, sw1.z);
                
                // Slight segment overlap (+0.12m) to prevent microscopic sliver gaps at subsegment joints
                const segOverlap = subLen + 0.12;

                if (isWall) {
                    // --- HIGH-FIDELITY FLOOD WALL ---
                    // A. Underground Concrete Footing (watertight anchor in riverbed)
                    const footingH = Math.max(0.8, (elevMin - baseY) + 0.2);
                    const footingMidY = baseY + footingH * 0.5;
                    const footingGeom = new THREE.BoxGeometry(effectiveThickness * 1.25, footingH, segOverlap);
                    const footingMesh = new THREE.Mesh(footingGeom, wallFootingMaterial);
                    footingMesh.position.set(midX, footingMidY, midZ);
                    footingMesh.lookAt(targetPoint);
                    footingMesh.castShadow = true;
                    footingMesh.receiveShadow = true;
                    barrierGroup.add(footingMesh);
                    meshes.push(footingMesh);

                    // B. Main Aluminium Barrier Wall
                    const wallGeom = new THREE.BoxGeometry(effectiveThickness, totalH, segOverlap);
                    const wallMesh = new THREE.Mesh(wallGeom, wallMaterial);
                    wallMesh.position.set(midX, midY, midZ);
                    wallMesh.lookAt(targetPoint);
                    wallMesh.castShadow = true;
                    wallMesh.receiveShadow = true;
                    barrierGroup.add(wallMesh);
                    meshes.push(wallMesh);

                    // C. Steel Capping Rail on Crest
                    const capH = 0.18 * 1.2;
                    const capGeom = new THREE.BoxGeometry(effectiveThickness * 1.15, capH, segOverlap + 0.05);
                    const capMesh = new THREE.Mesh(capGeom, wallCapMaterial);
                    capMesh.position.set(midX, crestY - capH * 0.5, midZ);
                    capMesh.lookAt(targetPoint);
                    capMesh.castShadow = true;
                    barrierGroup.add(capMesh);
                    meshes.push(capMesh);
                } else {
                    // --- MULTI-TIERED SANDBAG BUND ---
                    // Engineered trapezoidal profile: wide base embedded in riverbed, tapering to crest
                    // Tier 1: Embedded Base Tier
                    const tier1H = totalH * 0.42;
                    const tier1MidY = baseY + tier1H * 0.5;
                    const tier1Geom = new THREE.BoxGeometry(effectiveThickness * 1.5, tier1H, segOverlap);
                    const tier1Mesh = new THREE.Mesh(tier1Geom, sandbagBaseMaterial);
                    tier1Mesh.position.set(midX, tier1MidY, midZ);
                    tier1Mesh.lookAt(targetPoint);
                    tier1Mesh.castShadow = true;
                    tier1Mesh.receiveShadow = true;
                    barrierGroup.add(tier1Mesh);
                    meshes.push(tier1Mesh);

                    // Tier 2: Middle Bund Body
                    const tier2H = totalH * 0.38;
                    const tier2MidY = baseY + tier1H + tier2H * 0.5;
                    const tier2Geom = new THREE.BoxGeometry(effectiveThickness * 1.12, tier2H, segOverlap);
                    const tier2Mesh = new THREE.Mesh(tier2Geom, sandbagTier2Material);
                    tier2Mesh.position.set(midX, tier2MidY, midZ);
                    tier2Mesh.lookAt(targetPoint);
                    tier2Mesh.castShadow = true;
                    tier2Mesh.receiveShadow = true;
                    barrierGroup.add(tier2Mesh);
                    meshes.push(tier2Mesh);

                    // Tier 3: Upper Crest Tier
                    const tier3H = totalH * 0.28;
                    const tier3MidY = crestY - tier3H * 0.5;
                    const tier3Geom = new THREE.BoxGeometry(effectiveThickness * 0.78, tier3H, segOverlap);
                    const tier3Mesh = new THREE.Mesh(tier3Geom, sandbagMaterial);
                    tier3Mesh.position.set(midX, tier3MidY, midZ);
                    tier3Mesh.lookAt(targetPoint);
                    tier3Mesh.castShadow = true;
                    barrierGroup.add(tier3Mesh);
                    meshes.push(tier3Mesh);
                }
            }
            
            // 4. Place Structural Support Posts at polyline vertex junctions (for walls)
            if (isWall) {
                const postH = effectiveHeight * 1.2 + 0.4;
                const postDepth = effectiveDepth * 1.2;
                const totalPostH = postH + postDepth;
                const postElev = w0.y;
                const postMidY = postElev - postDepth + totalPostH * 0.5;
                
                const postGeom = new THREE.BoxGeometry(effectiveThickness * 1.35, totalPostH, effectiveThickness * 1.35);
                const postMesh = new THREE.Mesh(postGeom, wallPostMaterial);
                postMesh.position.set(w0.x, postMidY, w0.z);
                postMesh.castShadow = true;
                barrierGroup.add(postMesh);
                meshes.push(postMesh);
                
                // Orange Reflective Warning Cap
                const capStripGeom = new THREE.BoxGeometry(effectiveThickness * 1.38, 0.25, effectiveThickness * 1.38);
                const capStripMesh = new THREE.Mesh(capStripGeom, warningStripMaterial);
                capStripMesh.position.set(w0.x, postElev + effectiveHeight * 1.2 + 0.12, w0.z);
                barrierGroup.add(capStripMesh);
                meshes.push(capStripMesh);
            }
        }
        
        // Add final vertex post for wall
        if (isWall && pointsLonLat.length >= 2) {
            const pLast = pointsLonLat[pointsLonLat.length - 1];
            const wLast = lonlatToWorld(pLast[0], pLast[1]);
            const postH = effectiveHeight * 1.2 + 0.4;
            const postDepth = effectiveDepth * 1.2;
            const totalPostH = postH + postDepth;
            const postMidY = wLast.y - postDepth + totalPostH * 0.5;
            
            const postGeom = new THREE.BoxGeometry(effectiveThickness * 1.35, totalPostH, effectiveThickness * 1.35);
            const postMesh = new THREE.Mesh(postGeom, wallPostMaterial);
            postMesh.position.set(wLast.x, postMidY, wLast.z);
            postMesh.castShadow = true;
            barrierGroup.add(postMesh);
            meshes.push(postMesh);
            
            const capStripGeom = new THREE.BoxGeometry(effectiveThickness * 1.38, 0.25, effectiveThickness * 1.38);
            const capStripMesh = new THREE.Mesh(capStripGeom, warningStripMaterial);
            capStripMesh.position.set(wLast.x, wLast.y + effectiveHeight * 1.2 + 0.12, wLast.z);
            barrierGroup.add(capStripMesh);
            meshes.push(capStripMesh);
        }
        
        barrierList.push({
            name,
            type,
            height: effectiveHeight,
            depth: effectiveDepth,
            thickness: effectiveThickness,
            pointsLonLat,
            meshes
        });
        
        console.log(`Placed watertight ${name} (${type}, height=${effectiveHeight}m, depth=${effectiveDepth}m, thickness=${effectiveThickness}m)`);
    }
    
    function loadPresets(presets) {
        clearAll();
        for (let key in presets) {
            const p = presets[key];
            addBarrierPolyline(
                p.points,
                p.type || 'wall',
                p.height || 2.8,
                p.depth || 2.0,
                p.thickness || (p.type === 'sandbags' ? 2.4 : 1.2),
                p.name || 'Clonmel Quay Barrier'
            );
        }
    }
    
    function undoLast() {
        if (barrierList.length === 0) return;
        const last = barrierList.pop();
        for (let m of last.meshes) {
            barrierGroup.remove(m);
            if (m.geometry) m.geometry.dispose();
        }
        
        // Re-rasterize remaining barriers into simulator
        simulator.clearBarriers();
        for (let b of barrierList) {
            const isWall = b.type === 'wall';
            const widthCells = isWall ? Math.max(1, Math.round((b.thickness || 1.2) / 1.5)) : Math.max(2, Math.round((b.thickness || 2.4) / 1.2));
            for (let i = 0; i < b.pointsLonLat.length - 1; i++) {
                const p0 = b.pointsLonLat[i];
                const p1 = b.pointsLonLat[i + 1];
                const g0 = lonlatToGrid(p0[0], p0[1]);
                const g1 = lonlatToGrid(p1[0], p1[1]);
                simulator.setBarrierSegment(g0.gx, g0.gy, g1.gx, g1.gy, b.height, widthCells);
            }
        }
    }

    function getTotalLength() {
        let total = 0;
        for (let b of barrierList) {
            for (let i = 0; i < b.pointsLonLat.length - 1; i++) {
                const w0 = lonlatToWorld(b.pointsLonLat[i][0], b.pointsLonLat[i][1]);
                const w1 = lonlatToWorld(b.pointsLonLat[i + 1][0], b.pointsLonLat[i + 1][1]);
                total += Math.hypot(w1.x - w0.x, w1.z - w0.z);
            }
        }
        return Math.round(total);
    }
    
    function clearAll() {
        while (barrierGroup.children.length > 0) {
            const obj = barrierGroup.children[0];
            barrierGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
        }
        barrierList.length = 0;
        simulator.clearBarriers();
    }
    
    return {
        group: barrierGroup,
        barriers: barrierList,
        addBarrierPolyline,
        undoLast,
        getTotalLength,
        loadPresets,
        clearAll,
        lonlatToWorld,
        lonlatToGrid,
        getElevationAtLonLat
    };
}
