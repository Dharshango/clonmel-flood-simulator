import * as THREE from 'three';

export function createBuildingsLayer(meta, buildingsData, elevArray) {
    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    
    const validBuildings = [];
    
    for (let i = 0; i < buildingsData.length; i++) {
        const b = buildingsData[i];
        const pts = b.pts;
        if (!pts || pts.length < 3) continue;
        
        let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
        let sumLon = 0, sumLat = 0;
        for (let p of pts) {
            minLon = Math.min(minLon, p[0]);
            maxLon = Math.max(maxLon, p[0]);
            minLat = Math.min(minLat, p[1]);
            maxLat = Math.max(maxLat, p[1]);
            sumLon += p[0];
            sumLat += p[1];
        }
        const cLon = sumLon / pts.length;
        const cLat = sumLat / pts.length;
        
        const posX = ((cLon - bbox.west) / w_deg - 0.5) * width_m;
        const posZ = -((cLat - bbox.south) / h_deg - 0.5) * height_m;
        
        const u = (cLon - bbox.west) / w_deg;
        const v = (cLat - bbox.south) / h_deg;
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
        const baseElevation = elevArray[gy * gridW + gx] * 1.2;
        
        const sizeX = Math.max(4.0, ((maxLon - minLon) / w_deg) * width_m);
        const sizeZ = Math.max(4.0, ((maxLat - minLat) / h_deg) * height_m);
        const height = Math.max(4.5, b.height || 6.5);
        
        validBuildings.push({
            id: b.id,
            name: b.name || 'Building',
            type: b.type,
            posX,
            posZ,
            baseY: baseElevation,
            sizeX,
            sizeZ,
            height,
            u,
            v,
            isFlooded: false,
            isSaved: false
        });
    }
    
    const count = validBuildings.length;
    console.log(`Creating 3D Instanced Buildings layer: ${count} buildings in architectural gray.`);
    
    const baseBoxGeom = new THREE.BoxGeometry(1, 1, 1);
    
    // Architectural gray material
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.55,
        metalness: 0.1,
        flatShading: true
    });
    
    const instancedMesh = new THREE.InstancedMesh(baseBoxGeom, buildingMaterial, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    // Status colors
    const floodedColor = new THREE.Color(0xe65100); // warm amber warning
    const savedColor   = new THREE.Color(0x10b981); // bright glowing emerald green
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
        const b = validBuildings[i];
        dummy.position.set(b.posX, b.baseY + b.height * 0.5, b.posZ);
        dummy.scale.set(b.sizeX, b.height, b.sizeZ);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        // Sleek architectural gray with micro-shading variation
        const tint = 0.50 + (i % 7) * 0.02;
        instancedMesh.setColorAt(i, new THREE.Color(tint, tint * 1.02, tint * 1.05));
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
    }
    
    // Function to update building colors based on water simulation
    function updateFloodStatus(simulator, baselineSimulator = null, sideBySide = false) {
        let floodedCount = 0;
        let savedCount = 0;
        
        for (let i = 0; i < count; i++) {
            const b = validBuildings[i];
            const sample = simulator.samplePoint(b.u, b.v);
            const isFloodedNow = sample.h > 0.08;
            b.isFlooded = isFloodedNow;
            
            if (isFloodedNow) {
                floodedCount++;
            }
            
            if (sideBySide && baselineSimulator) {
                const baseSample = baselineSimulator.samplePoint(b.u, b.v);
                const wasFloodedInBase = baseSample.h > 0.08;
                // If flooded without barrier, but dry with barrier: IT IS SAVED!
                b.isSaved = wasFloodedInBase && !isFloodedNow;
                if (b.isSaved) savedCount++;
            } else {
                b.isSaved = false;
            }
            
            if (b.isSaved) {
                instancedMesh.setColorAt(i, savedColor);
            } else if (b.isFlooded) {
                instancedMesh.setColorAt(i, floodedColor);
            } else {
                // Architectural gray
                const tint = 0.50 + (i % 7) * 0.02;
                instancedMesh.setColorAt(i, new THREE.Color(tint, tint * 1.02, tint * 1.05));
            }
        }
        
        if (instancedMesh.instanceColor) {
            instancedMesh.instanceColor.needsUpdate = true;
        }
        
        return { floodedCount, savedCount, totalBuildings: count };
    }
    
    return {
        mesh: instancedMesh,
        buildings: validBuildings,
        updateFloodStatus
    };
}
