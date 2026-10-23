import * as THREE from 'three';

/**
 * Creates authentic 3D bridge structures for Clonmel, featuring the historic Old Bridge (Droichead Ársa),
 * Gashouse Bridge, and Workhouse Bridge.
 * 
 * Includes elevated roadway decks, limestone stone parapets/balustrades, and riverbed arch piers
 * so bridges span cleanly ABOVE water channels without plunging into the riverbed.
 */
export function createBridgesLayer(meta, elevArray, roadsData) {
    const group = new THREE.Group();
    group.name = 'bridges-layer';

    const bbox = meta.bbox;
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;

    // Helper to get 3D position from lon/lat
    function getGroundY(lon, lat) {
        const u = (lon - bbox.west) / w_deg;
        const v = (lat - bbox.south) / h_deg;
        const gx = Math.min(gridW - 1, Math.max(0, Math.floor(u * gridW)));
        const gy = Math.min(gridH - 1, Math.max(0, Math.floor((1.0 - v) * gridH)));
        return (elevArray[gy * gridW + gx] || 18.0) * 1.2;
    }

    function lonLatToWorld(lon, lat, yOverride = null) {
        const x = ((lon - bbox.west) / w_deg - 0.5) * width_m;
        const z = -((lat - bbox.south) / h_deg - 0.5) * height_m;
        const y = yOverride !== null ? yOverride : getGroundY(lon, lat);
        return new THREE.Vector3(x, y, z);
    }

    // Heritage materials
    // 1. Weathered Irish limestone masonry for parapets and piers
    const limestoneMat = new THREE.MeshStandardMaterial({
        color: 0x8e8a82,
        roughness: 0.88,
        metalness: 0.08,
        bumpScale: 0.05
    });

    // 2. Parapet coping stone (lighter limestone cap)
    const copingMat = new THREE.MeshStandardMaterial({
        color: 0xb5b0a6,
        roughness: 0.80,
        metalness: 0.05
    });

    // 3. Dark paved asphalt road deck
    const asphaltMat = new THREE.MeshStandardMaterial({
        color: 0x22262d,
        roughness: 0.75,
        metalness: 0.12
    });

    // 4. Concrete curbs & sidewalks
    const curbMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.85,
        metalness: 0.05
    });

    // 5. Riverbed pier base stone
    const pierMat = new THREE.MeshStandardMaterial({
        color: 0x69655f,
        roughness: 0.95,
        metalness: 0.04
    });

    /**
     * Builds an elevated 3D bridge span between points with deck, curbs, parapets, and arch piers
     */
    function buildBridgeSpan(name, points, deckWidth = 8.0, isArch = true, pierInterval = 14.0) {
        if (!points || points.length < 2) return;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i + 1];

            const dir = new THREE.Vector3().subVectors(p1, p0);
            const len = dir.length();
            if (len < 0.5) continue;

            const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
            const dirNorm = dir.clone().normalize();

            // Right-angle normal vector in horizontal plane
            const normal = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x).normalize();

            // Orientation quaternion for aligning boxes along bridge segment
            const forward = new THREE.Vector3(0, 0, 1);
            const rotQuat = new THREE.Quaternion().setFromUnitVectors(forward, dirNorm);

            // A. Road Deck (Asphalt surface)
            const deckThickness = 0.65;
            const deckGeom = new THREE.BoxGeometry(deckWidth, deckThickness, len);
            const deckMesh = new THREE.Mesh(deckGeom, asphaltMat);
            deckMesh.position.copy(mid);
            deckMesh.position.y -= deckThickness * 0.5;
            deckMesh.quaternion.copy(rotQuat);
            deckMesh.castShadow = true;
            deckMesh.receiveShadow = true;
            group.add(deckMesh);

            // B. Concrete Curbs / Sidewalks (left & right)
            const curbWidth = 0.75;
            const curbHeight = 0.22;
            const curbGeom = new THREE.BoxGeometry(curbWidth, curbHeight, len);

            const curbLeft = new THREE.Mesh(curbGeom, curbMat);
            const leftOffset = normal.clone().multiplyScalar((deckWidth - curbWidth) * 0.5);
            curbLeft.position.copy(mid).add(leftOffset);
            curbLeft.position.y += curbHeight * 0.5;
            curbLeft.quaternion.copy(rotQuat);
            group.add(curbLeft);

            const curbRight = new THREE.Mesh(curbGeom, curbMat);
            const rightOffset = normal.clone().multiplyScalar(-(deckWidth - curbWidth) * 0.5);
            curbRight.position.copy(mid).add(rightOffset);
            curbRight.position.y += curbHeight * 0.5;
            curbRight.quaternion.copy(rotQuat);
            group.add(curbRight);

            // C. Solid Stone Parapets (Masonry safety walls, left & right)
            const parapetHeight = 1.15;
            const parapetThick = 0.42;
            const parapetGeom = new THREE.BoxGeometry(parapetThick, parapetHeight, len);

            const parapetLeft = new THREE.Mesh(parapetGeom, limestoneMat);
            const pLeftOffset = normal.clone().multiplyScalar((deckWidth - parapetThick) * 0.5);
            parapetLeft.position.copy(mid).add(pLeftOffset);
            parapetLeft.position.y += parapetHeight * 0.5;
            parapetLeft.quaternion.copy(rotQuat);
            group.add(parapetLeft);

            const parapetRight = new THREE.Mesh(parapetGeom, limestoneMat);
            const pRightOffset = normal.clone().multiplyScalar(-(deckWidth - parapetThick) * 0.5);
            parapetRight.position.copy(mid).add(pRightOffset);
            parapetRight.position.y += parapetHeight * 0.5;
            parapetRight.quaternion.copy(rotQuat);
            group.add(parapetRight);

            // Parapet Coping Stones (beveled cap on top of wall)
            const copingGeom = new THREE.BoxGeometry(parapetThick + 0.10, 0.14, len);
            const capLeft = new THREE.Mesh(copingGeom, copingMat);
            capLeft.position.copy(mid).add(pLeftOffset);
            capLeft.position.y += parapetHeight + 0.07;
            capLeft.quaternion.copy(rotQuat);
            group.add(capLeft);

            const capRight = new THREE.Mesh(copingGeom, copingMat);
            capRight.position.copy(mid).add(pRightOffset);
            capRight.position.y += parapetHeight + 0.07;
            capRight.quaternion.copy(rotQuat);
            group.add(capRight);

            // D. Stone Piers & Arches (descending into riverbed)
            if (isArch && len >= 8.0) {
                const numPiers = Math.max(1, Math.round(len / pierInterval));
                const riverBedElev = 15.5 * 1.2; // approx 18.6m in 3D scene units

                for (let k = 1; k <= numPiers; k++) {
                    const frac = k / (numPiers + 1);
                    const pierPos = new THREE.Vector3().lerpVectors(p0, p1, frac);
                    const pierTopY = pierPos.y - deckThickness;
                    const pierBottomY = riverBedElev - 0.5;
                    const pierHeight = Math.max(2.0, pierTopY - pierBottomY);

                    // Solid cutwater stone pier
                    const pierThick = 2.4;
                    const pierSpanWidth = deckWidth - 0.5;
                    const pierGeom = new THREE.BoxGeometry(pierSpanWidth, pierHeight, pierThick);
                    const pierMesh = new THREE.Mesh(pierGeom, pierMat);
                    pierMesh.position.copy(pierPos);
                    pierMesh.position.y = pierBottomY + pierHeight * 0.5;
                    pierMesh.quaternion.copy(rotQuat);
                    group.add(pierMesh);

                    // Triangular Cutwater on upstream edge (deflects river current)
                    const cutwaterGeom = new THREE.CylinderGeometry(0.01, pierThick * 0.6, pierSpanWidth * 0.5, 3);
                    const cutwater = new THREE.Mesh(cutwaterGeom, pierMat);
                    cutwater.position.copy(pierPos);
                    cutwater.position.y = pierBottomY + pierHeight * 0.5;
                    cutwater.rotation.z = Math.PI / 2;
                    group.add(cutwater);
                }

                // Semicircular arch spandrels along outer faces
                const numArches = numPiers + 1;
                for (let a = 0; a < numArches; a++) {
                    const f0 = a / numArches;
                    const f1 = (a + 1) / numArches;
                    const a0 = new THREE.Vector3().lerpVectors(p0, p1, f0);
                    const a1 = new THREE.Vector3().lerpVectors(p1, p0, 1.0 - f1);
                    const aMid = new THREE.Vector3().addVectors(a0, a1).multiplyScalar(0.5);
                    const archLen = new THREE.Vector3().subVectors(a1, a0).length();

                    // Arch barrel underside
                    const archThick = 0.5;
                    const archHeight = Math.min(3.5, archLen * 0.35);
                    const archGeom = new THREE.BoxGeometry(deckWidth - 0.2, archThick, archLen * 0.7);
                    const archMesh = new THREE.Mesh(archGeom, limestoneMat);
                    archMesh.position.copy(aMid);
                    archMesh.position.y -= (deckThickness + archHeight * 0.5);
                    archMesh.quaternion.copy(rotQuat);
                    group.add(archMesh);
                }
            }
        }
    }

    // =========================================================================
    // 1. OLD BRIDGE (DROICHEAD ÁRSA) - THE HISTORIC CLONMEL STONE BRIDGE
    // =========================================================================
    // Span 1: North Arch Bridge (North Bank / Bridge St across North Channel to Suir Island North)
    const oldBridgeNorthPts = [
        lonLatToWorld(-7.7041113, 52.3519918, 27.2), // North Bank Bridge St landing
        lonLatToWorld(-7.7040938, 52.3519419, 25.8), // North Abutment
        lonLatToWorld(-7.7040851, 52.3517989, 23.6), // Main North Channel Arch Span
        lonLatToWorld(-7.7040745, 52.3517244, 22.1)  // Suir Island North landing
    ];
    buildBridgeSpan('Old Bridge (North Arch)', oldBridgeNorthPts, 8.2, true, 9.0);

    // Span 2: Suir Island Causeway (Traversing solid Suir Island between North & South bridges)
    // Paved heritage roadway following island ground contours
    const suirIslandCausewayPts = [
        lonLatToWorld(-7.7040745, 52.3517244, 22.0),
        lonLatToWorld(-7.7039891, 52.3514705, 21.9),
        lonLatToWorld(-7.7039635, 52.3513431, 21.8),
        lonLatToWorld(-7.7039281, 52.3511651, 21.8),
        lonLatToWorld(-7.7039076, 52.3510598, 21.7),
        lonLatToWorld(-7.7039943, 52.3509096, 21.7),
        lonLatToWorld(-7.7041073, 52.3508669, 21.6),
        lonLatToWorld(-7.7043271, 52.3506687, 21.6)  // Suir Island South Abutment
    ];
    // On the island, build as paved roadway with limestone parapets/curbs
    buildBridgeSpan('Old Bridge (Suir Island Causeway)', suirIslandCausewayPts, 8.0, false);

    // Span 3: South Arch Bridge (Suir Island South across South Channel to South Bank)
    const oldBridgeSouthPts = [
        lonLatToWorld(-7.7043271, 52.3506687, 21.6), // Suir Island South Abutment
        lonLatToWorld(-7.7044289, 52.3505119, 22.0), // South Channel Arch Span
        lonLatToWorld(-7.7044469, 52.3503912, 21.8), // Mid South Channel Pier
        lonLatToWorld(-7.7044093, 52.3501235, 21.7)  // South Bank Landing
    ];
    buildBridgeSpan('Old Bridge (South Arch)', oldBridgeSouthPts, 8.2, true, 12.0);

    // Span 4: Mill Race / Raheen Road approach span
    const oldBridgeApproachPts = [
        lonLatToWorld(-7.7044093, 52.3501235, 21.9),
        lonLatToWorld(-7.7043560, 52.3498339, 21.6),
        lonLatToWorld(-7.7043323, 52.3495482, 21.4)  // Connection to Raheen Rd
    ];
    buildBridgeSpan('Old Bridge (Raheen Approach)', oldBridgeApproachPts, 7.8, true, 10.0);

    // =========================================================================
    // 2. GASHOUSE BRIDGE (Downstream eastern river crossing)
    // =========================================================================
    const gashousePts = [
        lonLatToWorld(-7.6947774, 52.3522414, 22.4),
        lonLatToWorld(-7.6948220, 52.3519308, 22.2),
        lonLatToWorld(-7.6948666, 52.3516202, 22.0)
    ];
    buildBridgeSpan('Gashouse Bridge', gashousePts, 8.5, true, 15.0);

    // =========================================================================
    // 3. WORKHOUSE BRIDGE (Upstream western river crossing)
    // =========================================================================
    const workhousePts = [
        lonLatToWorld(-7.7166549, 52.3495644, 24.2),
        lonLatToWorld(-7.7167000, 52.3497950, 24.0),
        lonLatToWorld(-7.7167432, 52.3500255, 23.8)
    ];
    buildBridgeSpan('Workhouse Bridge', workhousePts, 8.5, true, 14.0);

    return {
        group
    };
}
