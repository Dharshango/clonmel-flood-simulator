import * as THREE from 'three';

export function createRoadsLayer(meta, roadsData, elevArray) {
    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    
    const roadObjects = [];
    const group = new THREE.Group();
    
    // We sample prominent roads and bridges
    for (let r of roadsData) {
        const pts = r.pts;
        if (!pts || pts.length < 2) continue;
        
        const linePoints = [];
        const samples = [];
        
        for (let p of pts) {
            const lon = p[0];
            const lat = p[1];
            
            const posX = ((lon - bbox.west) / w_deg - 0.5) * width_m;
            const posZ = -((lat - bbox.south) / h_deg - 0.5) * height_m;
            
            const u = (lon - bbox.west) / w_deg;
            const v = (lat - bbox.south) / h_deg;
            const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
            const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
            const elev = (elevArray[gy * gridW + gx] || 18.0) * 1.2;
            
            // Offset slightly above terrain (0.4m)
            linePoints.push(new THREE.Vector3(posX, elev + 0.4, posZ));
            samples.push({ u, v, lon, lat, name: r.name });
        }
        
        const geom = new THREE.BufferGeometry().setFromPoints(linePoints);
        const mat = new THREE.LineBasicMaterial({
            color: 0x334155, // clean dark slate road on black ground
            linewidth: 2,
            transparent: true,
            opacity: 0.85
        });
        
        const line = new THREE.Line(geom, mat);
        group.add(line);
        
        roadObjects.push({
            id: r.id,
            name: r.name || 'Local Street',
            type: r.type,
            bridge: r.bridge === 'yes',
            samples,
            line,
            material: mat,
            isCutOff: false,
            maxDepth: 0.0
        });
    }
    
    function updateRoadCutoffs(simulator) {
        let cutoffCount = 0;
        const cutoffList = [];
        
        const normalColor = new THREE.Color(0x334155);
        const bridgeColor = new THREE.Color(0x64748b);
        const cutoffColor = new THREE.Color(0xef4444); // warning red
        
        for (let ro of roadObjects) {
            let maxD = 0.0;
            for (let s of ro.samples) {
                const sample = simulator.samplePoint(s.u, s.v);
                if (sample.h > maxD) {
                    maxD = sample.h;
                }
            }
            ro.maxDepth = maxD;
            
            // Impassable threshold: 0.15m (6 inches)
            const cutoff = maxD >= 0.15;
            ro.isCutOff = cutoff;
            
            if (cutoff) {
                cutoffCount++;
                ro.material.color.copy(cutoffColor);
                ro.material.opacity = 1.0;
                
                if (ro.name && ro.name !== 'Unnamed Road' && ro.name !== 'Local Street') {
                    cutoffList.push({
                        name: ro.name,
                        depth: maxD.toFixed(2),
                        bridge: ro.bridge
                    });
                }
            } else {
                ro.material.color.copy(ro.bridge ? bridgeColor : normalColor);
                ro.material.opacity = 0.75;
            }
        }
        
        // Remove duplicates in cutoff list
        const uniqueCutoffs = [];
        const seen = new Set();
        for (let item of cutoffList) {
            if (!seen.has(item.name)) {
                seen.add(item.name);
                uniqueCutoffs.push(item);
            }
        }
        
        return { cutoffCount, cutoffList: uniqueCutoffs };
    }
    
    return {
        group,
        roads: roadObjects,
        updateRoadCutoffs
    };
}
