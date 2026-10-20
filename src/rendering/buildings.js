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
    
    // Warm architectural cream material
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.50,
        metalness: 0.05,
        flatShading: true
    });
    
    const instancedMesh = new THREE.InstancedMesh(baseBoxGeom, buildingMaterial, count);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    // Status colors matching user reference:
    // Cream: normal dry buildings
    // Yellow: partially affected by water overflowing the quays (0.05m <= h < 0.40m)
    // Red: completely endangered in deep/rushing flood (h >= 0.40m)
    // Green: saved by barrier in comparison mode
    const yellowPartialColor = new THREE.Color(0xfacc15); // bright amber/yellow
    const redEndangeredColor = new THREE.Color(0xef4444); // bright alert red
    const savedColor         = new THREE.Color(0x10b981); // bright glowing emerald green
    
    // Helper to generate warm cream color for building i
    function getCreamColor(i) {
        const v = (i % 7) * 0.012;
        return new THREE.Color(0.91 + v, 0.88 + v, 0.82 + v); // warm architectural cream
    }
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
        const b = validBuildings[i];
        dummy.position.set(b.posX, b.baseY + b.height * 0.5, b.posZ);
        dummy.scale.set(b.sizeX, b.height, b.sizeZ);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        // Warm cream building color
        instancedMesh.setColorAt(i, getCreamColor(i));
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.needsUpdate = true;
    }
    
    // Function to update building colors based on water simulation
    function updateFloodStatus(simulator, baselineSimulator = null, sideBySide = false) {
        let floodedCount = 0;
        let endangeredCount = 0;
        let partialCount = 0;
        let savedCount = 0;
        
        for (let i = 0; i < count; i++) {
            const b = validBuildings[i];
            
            // Sample building footprint (center + edges) so water rushing through any edge marks it
            const du = (b.sizeX / width_m) * 0.45;
            const dv = (b.sizeZ / height_m) * 0.45;
            
            let maxH = simulator.samplePoint(b.u, b.v).h;
            maxH = Math.max(maxH, simulator.samplePoint(b.u - du, b.v).h);
            maxH = Math.max(maxH, simulator.samplePoint(b.u + du, b.v).h);
            maxH = Math.max(maxH, simulator.samplePoint(b.u, b.v - dv).h);
            maxH = Math.max(maxH, simulator.samplePoint(b.u, b.v + dv).h);
            
            // Mark building only if water reaches/rushes through it (h >= 0.05m)
            const isFloodedNow = maxH >= 0.05;
            b.isFlooded = isFloodedNow;
            b.depth = maxH;
            
            if (isFloodedNow) {
                floodedCount++;
                if (maxH >= 0.40) {
                    endangeredCount++;
                    b.status = 'endangered';
                } else {
                    partialCount++;
                    b.status = 'partial';
                }
            } else {
                b.status = 'safe';
            }
            
            if (sideBySide && baselineSimulator) {
                let baseMaxH = baselineSimulator.samplePoint(b.u, b.v).h;
                baseMaxH = Math.max(baseMaxH, baselineSimulator.samplePoint(b.u - du, b.v).h);
                baseMaxH = Math.max(baseMaxH, baselineSimulator.samplePoint(b.u + du, b.v).h);
                baseMaxH = Math.max(baseMaxH, baselineSimulator.samplePoint(b.u, b.v - dv).h);
                baseMaxH = Math.max(baseMaxH, baselineSimulator.samplePoint(b.u, b.v + dv).h);
                
                const wasFloodedInBase = baseMaxH >= 0.05;
                // If flooded without barrier, but dry with barrier: IT IS SAVED!
                b.isSaved = wasFloodedInBase && !isFloodedNow;
                if (b.isSaved) {
                    savedCount++;
                    b.status = 'saved';
                }
            } else {
                b.isSaved = false;
            }
            
            if (b.isSaved) {
                instancedMesh.setColorAt(i, savedColor);
            } else if (b.status === 'endangered') {
                instancedMesh.setColorAt(i, redEndangeredColor);
            } else if (b.status === 'partial') {
                instancedMesh.setColorAt(i, yellowPartialColor);
            } else {
                // Architectural cream
                instancedMesh.setColorAt(i, getCreamColor(i));
            }
        }
        
        if (instancedMesh.instanceColor) {
            instancedMesh.instanceColor.needsUpdate = true;
        }
        
        return { 
            floodedCount, 
            endangeredCount, 
            partialCount, 
            savedCount, 
            totalBuildings: count 
        };
    }
    
    return {
        mesh: instancedMesh,
        buildings: validBuildings,
        updateFloodStatus
    };
}
