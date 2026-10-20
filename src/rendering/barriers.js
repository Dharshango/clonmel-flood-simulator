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
    
    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xcfd8dc, // aluminium/steel silver
        metalness: 0.8,
        roughness: 0.3
    });
    
    const sandbagMaterial = new THREE.MeshStandardMaterial({
        color: 0xc2a649, // burlap sandbag tan/gold
        roughness: 0.9,
        metalness: 0.05
    });
    
    function lonlatToWorld(lon, lat) {
        const posX = ((lon - bbox.west) / w_deg - 0.5) * width_m;
        const posZ = -((lat - bbox.south) / h_deg - 0.5) * height_m;
        const u = (lon - bbox.west) / w_deg;
        const v = (lat - bbox.south) / h_deg;
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
        const elev = (elevArray[gy * gridW + gx] || 18.0) * 1.2;
        return new THREE.Vector3(posX, elev, posZ);
    }
    
    function lonlatToGrid(lon, lat) {
        const gx = ((lon - bbox.west) / w_deg) * gridW;
        const gy = ((lat - bbox.south) / h_deg) * gridH; // in texture UV coords
        return { gx, gy };
    }
    
    function addBarrierPolyline(pointsLonLat, type = 'wall', height = 2.2, name = 'Custom Barrier') {
        if (!pointsLonLat || pointsLonLat.length < 2) return;
        
        const meshes = [];
        const isWall = type === 'wall';
        const mat = isWall ? wallMaterial : sandbagMaterial;
        const wallThickness = isWall ? 1.5 : 2.5; // in meters
        
        for (let i = 0; i < pointsLonLat.length - 1; i++) {
            const p0 = pointsLonLat[i];
            const p1 = pointsLonLat[i + 1];
            
            // Rasterize into GPU simulator
            const g0 = lonlatToGrid(p0[0], p0[1]);
            const g1 = lonlatToGrid(p1[0], p1[1]);
            simulator.setBarrierSegment(g0.gx, g0.gy, g1.gx, g1.gy, height, isWall ? 2 : 3);
            
            // 3D visual geometry
            const w0 = lonlatToWorld(p0[0], p0[1]);
            const w1 = lonlatToWorld(p1[0], p1[1]);
            
            const segVec = new THREE.Vector3().subVectors(w1, w0);
            const segLen = segVec.length();
            if (segLen < 0.1) continue;
            
            const midPoint = new THREE.Vector3().addVectors(w0, w1).multiplyScalar(0.5);
            midPoint.y += height * 0.5;
            
            const boxGeom = new THREE.BoxGeometry(wallThickness, height, segLen);
            const mesh = new THREE.Mesh(boxGeom, mat);
            mesh.position.copy(midPoint);
            
            // Orient along line segment
            mesh.lookAt(w1.clone().setY(midPoint.y));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            barrierGroup.add(mesh);
            meshes.push(mesh);
        }
        
        barrierList.push({
            name,
            type,
            height,
            pointsLonLat,
            meshes
        });
        
        console.log(`Placed ${name} (${type}, height=${height}m, segments=${pointsLonLat.length - 1})`);
    }
    
    function loadPresets(presets) {
        clearAll();
        for (let key in presets) {
            const p = presets[key];
            addBarrierPolyline(p.points, p.type, p.height, p.name);
        }
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
        loadPresets,
        clearAll,
        lonlatToWorld,
        lonlatToGrid
    };
}
