import * as THREE from 'three';

export function createBuildingsLayer(meta, buildingsData, elevArray, riverMaskImg = null) {
    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    
    // Rasterize river mask to identify river channel vs overland ground/street cells
    const isRiverCell = new Uint8Array(gridW * gridH);
    if (riverMaskImg) {
        const rCanvas = document.createElement('canvas');
        rCanvas.width = gridW;
        rCanvas.height = gridH;
        const rCtx = rCanvas.getContext('2d');
        rCtx.drawImage(riverMaskImg, 0, 0);
        const rPix = rCtx.getImageData(0, 0, gridW, gridH).data;
        for (let y = 0; y < gridH; y++) {
            const srcY = gridH - 1 - y; // flip Y for WebGL texture alignment (y=0 is South)
            for (let x = 0; x < gridW; x++) {
                isRiverCell[y * gridW + x] = rPix[(srcY * gridW + x) * 4] > 128 ? 1 : 0;
            }
        }
    }
    
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
        const groundElev = elevArray[gy * gridW + gx] || 18.0;
        const baseElevation = groundElev * 1.2;
        
        const sizeX = Math.max(4.0, ((maxLon - minLon) / w_deg) * width_m);
        const sizeZ = Math.max(4.0, ((maxLat - minLat) / h_deg) * height_m);
        const height = Math.max(4.5, b.height || 6.5);
        
        const uMin = (minLon - bbox.west) / w_deg;
        const uMax = (maxLon - bbox.west) / w_deg;
        const vMin = (minLat - bbox.south) / h_deg;
        const vMax = (maxLat - bbox.south) / h_deg;
        
        // Grid bounds for the footprint plus 1-cell contact border (water touching walls)
        const gx0 = Math.max(0, Math.floor(uMin * gridW) - 1);
        const gx1 = Math.min(gridW - 1, Math.ceil(uMax * gridW) + 1);
        const gy0 = Math.max(0, Math.floor(vMin * gridH) - 1);
        const gy1 = Math.min(gridH - 1, Math.ceil(vMax * gridH) + 1);
        
        const cellMap = new Map(); // key: gy * gridW + gx -> { gx, gy }
        
        function addCell(cx, cy) {
            const k = cy * gridW + cx;
            if (!cellMap.has(k)) {
                cellMap.set(k, { gx: cx, gy: cy });
            }
        }
        
        // 1. Perimeter border cells (where water in streets contacts the building walls)
        for (let x = gx0; x <= gx1; x++) {
            addCell(x, gy0);
            addCell(x, gy1);
        }
        for (let y = gy0; y <= gy1; y++) {
            addCell(gx0, y);
            addCell(gx1, y);
        }
        // 2. All polygon footprint vertices
        for (let p of pts) {
            const pu = (p[0] - bbox.west) / w_deg;
            const pv = (p[1] - bbox.south) / h_deg;
            const pgx = Math.min(gridW - 1, Math.max(0, Math.floor(pu * gridW)));
            const pgy = Math.min(gridH - 1, Math.max(0, Math.floor(pv * gridH)));
            addCell(pgx, pgy);
        }
        // 3. Center cell
        const cgx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const cgy = Math.min(gridH - 1, Math.max(0, Math.floor(v * gridH)));
        addCell(cgx, cgy);
        
        const cellCount = cellMap.size;
        const sampleOffsets = new Int32Array(cellCount);
        const cellElevs = new Float32Array(cellCount);
        const isRiverArr = new Uint8Array(cellCount);
        
        let cIdx = 0;
        for (let entry of cellMap.values()) {
            const cellKey = entry.gy * gridW + entry.gx;
            sampleOffsets[cIdx] = cellKey * 4;
            const srcY = gridH - 1 - entry.gy;
            cellElevs[cIdx] = elevArray[srcY * gridW + entry.gx] || 18.0;
            isRiverArr[cIdx] = isRiverCell[cellKey];
            cIdx++;
        }
        
        validBuildings.push({
            id: b.id,
            name: b.name || 'Building',
            type: b.type,
            posX,
            posZ,
            baseY: baseElevation,
            groundElev,
            sizeX,
            sizeZ,
            height,
            u,
            v,
            sampleOffsets,
            cellElevs,
            isRiverArr,
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
    
    // Status colors:
    // Cream: normal dry buildings
    // Yellow: partially affected by water (0.05m <= h < 0.40m)
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
        
        const buf = simulator.readbackBuffer;
        const baseBuf = (sideBySide && baselineSimulator) ? baselineSimulator.readbackBuffer : null;
        
        for (let i = 0; i < count; i++) {
            const b = validBuildings[i];
            const offsets = b.sampleOffsets;
            const cellElevs = b.cellElevs;
            const isRiverArr = b.isRiverArr;
            const len = offsets.length;
            const gElev = b.groundElev;
            
            let maxH = 0.0;
            const isClonmel = bbox.south > 50.0;
            const isHighland = isClonmel ? (gElev > 22.5) : (gElev > 108.5);
            if (!isHighland) {
                for (let k = 0; k < len; k++) {
                    const off = offsets[k];
                    const h = buf[off];
                    if (h >= 0.08) {
                        const isRiver = isRiverArr[k] === 1;
                        const cellElev = cellElevs[k];
                        const wse = cellElev + h;
                        // River channel water only floods if water surface elevation overtops bank.
                        // Overland street water floods by direct local depth or overtopping.
                        const overtop = isRiver ? (wse - gElev) : Math.max(h, wse - gElev);
                        if (overtop > maxH) {
                            maxH = overtop;
                        }
                    }
                }
            }
            
            // Mark building only if overland flood water actually reaches doorstep (overtop >= 0.10m)
            const isFloodedNow = maxH >= 0.10;
            b.isFlooded = isFloodedNow;
            b.depth = maxH;
            
            if (isFloodedNow) {
                floodedCount++;
                if (maxH >= 0.35) {
                    endangeredCount++;
                    b.status = 'endangered';
                } else {
                    partialCount++;
                    b.status = 'partial';
                }
            } else {
                b.status = 'safe';
            }
            
            if (baseBuf && !isHighland) {
                let baseMaxH = 0.0;
                for (let k = 0; k < len; k++) {
                    const off = offsets[k];
                    const h = baseBuf[off];
                    if (h >= 0.08) {
                        const isRiver = isRiverArr[k] === 1;
                        const cellElev = cellElevs[k];
                        const wse = cellElev + h;
                        const overtop = isRiver ? (wse - gElev) : Math.max(h, wse - gElev);
                        if (overtop > baseMaxH) baseMaxH = overtop;
                    }
                }
                const wasFloodedInBase = baseMaxH >= 0.10;
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
