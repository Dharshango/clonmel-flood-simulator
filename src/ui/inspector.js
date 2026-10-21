import * as THREE from 'three';

export function createInspector(camera, terrainMesh, simulator, meta, elevArray, roadsData) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    
    // UI elements
    const cardEl = document.getElementById('inspector-card');
    const streetNameEl = document.getElementById('inspect-street-name');
    const depthEl = document.getElementById('inspect-depth');
    const elevEl = document.getElementById('inspect-elev');
    const velEl = document.getElementById('inspect-velocity');
    const badgeEl = document.getElementById('inspect-hazard-badge');
    const peakEl = document.getElementById('inspect-peak');
    
    // 3D pin marker (high contrast for dark theme)
    const pinGroup = new THREE.Group();
    const pinPoleGeom = new THREE.CylinderGeometry(0.8, 0.8, 12, 12);
    const pinPoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pinPole = new THREE.Mesh(pinPoleGeom, pinPoleMat);
    pinPole.position.y = 6;
    
    const pinHeadGeom = new THREE.SphereGeometry(3.5, 16, 16);
    const pinHeadMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.1, emissive: 0x007799 });
    const pinHead = new THREE.Mesh(pinHeadGeom, pinHeadMat);
    pinHead.position.y = 12;
    
    pinGroup.add(pinPole);
    pinGroup.add(pinHead);
    pinGroup.visible = false;
    
    let activePinPos = null;
    let activeUV = null;
    
    function findNearestStreet(lon, lat) {
        let bestDist = Infinity;
        let bestName = 'Clonmel Town';
        for (let r of roadsData) {
            if (!r.name || r.name === 'Unnamed Road' || r.name === 'Local Street') continue;
            for (let p of r.pts) {
                const dist = Math.hypot(p[0] - lon, p[1] - lat);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestName = r.name;
                }
            }
        }
        return bestDist < 0.003 ? bestName : 'Clonmel Town Centre';
    }
    
    function inspectAt(event, domElement) {
        const rect = domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const point = hit.point;
            
            // Convert 3D position back to UV
            const u = Math.min(1.0, Math.max(0.0, (point.x / width_m) + 0.5));
            const v = Math.min(1.0, Math.max(0.0, (-point.z / height_m) + 0.5));
            
            const lon = bbox.west + u * w_deg;
            const lat = bbox.south + v * h_deg;
            
            activePinPos = point.clone();
            activeUV = { u, v, lon, lat };
            
            pinGroup.position.copy(point);
            pinGroup.visible = true;
            
            const street = findNearestStreet(lon, lat);
            updateInspectCard(street);
            cardEl.style.display = 'block';
            
            return { point, u, v, lon, lat, street };
        } else {
            pinGroup.visible = false;
            cardEl.style.display = 'none';
            activeUV = null;
            return null;
        }
    }
    
    function updateInspectCard(streetOverride = null) {
        if (!activeUV) return;
        const sample = simulator.samplePoint(activeUV.u, activeUV.v);
        
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(activeUV.u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - activeUV.v) * gridH)));
        const groundElev = elevArray[gy * gridW + gx] || 18.0;
        
        const h = sample.h;
        const vel = Math.hypot(sample.u, sample.v);
        
        if (streetOverride) {
            streetNameEl.textContent = streetOverride;
        }
        
        depthEl.textContent = `${h.toFixed(2)} m`;
        elevEl.textContent = `${groundElev.toFixed(1)} m`;
        velEl.textContent = `${vel.toFixed(2)} m/s`;
        if (peakEl) peakEl.textContent = `${sample.peak_h.toFixed(2)} m`;
        
        // Hazard classification
        if (h < 0.05) {
            badgeEl.className = 'hazard-badge safe';
            badgeEl.textContent = 'Safe / Dry';
        } else if (h < 0.30) {
            badgeEl.className = 'hazard-badge low';
            badgeEl.textContent = 'Pedestrian Hazard (0-0.3m)';
        } else if (h < 0.80) {
            badgeEl.className = 'hazard-badge moderate';
            badgeEl.textContent = 'Vehicle Hazard / Roads Closed';
        } else {
            badgeEl.className = 'hazard-badge extreme';
            badgeEl.textContent = 'Extreme Danger / Structural Risk';
        }
    }
    
    function hide() {
        pinGroup.visible = false;
        cardEl.style.display = 'none';
        activeUV = null;
    }
    
    return {
        pinGroup,
        inspectAt,
        updateInspectCard,
        hide
    };
}
