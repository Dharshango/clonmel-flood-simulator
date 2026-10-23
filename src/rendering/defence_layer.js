/**
 * defence_layer.js
 * 
 * Interactive 3D Three.js Layer for Clonmel Flood Defence Assets.
 * Renders permanent walls, demountable barrier gaps, earthen embankments,
 * pumping stations, and culvert penstocks with raycasting selection.
 */

import * as THREE from 'three';
import { DEFENCE_TYPES } from '../defences/defence_model.js';

export class Defence3DLayer {
    constructor(scene, meta, elevArray) {
        this.scene = scene;
        this.meta = meta;
        this.elevArray = elevArray;

        this.group = new THREE.Group();
        this.group.name = 'FloodDefenceLayer';
        this.scene.add(this.group);

        this.assetMeshes = new Map(); // assetId -> Array of Object3D
        this.interactivePickables = []; // for raycasting
        this.selectedAssetId = null;

        // Selection Highlight Mesh
        this.highlightGroup = new THREE.Group();
        this.group.add(this.highlightGroup);
    }

    /**
     * Converts lon/lat coordinates to Three.js world coordinates
     */
    geoToWorld(lon, lat, targetElevMOD = null) {
        const u = (lon - this.meta.bbox.west) / (this.meta.bbox.east - this.meta.bbox.west);
        const v = (lat - this.meta.bbox.south) / (this.meta.bbox.north - this.meta.bbox.south);
        const wx = (u - 0.5) * this.meta.width_m;
        const wz = -(v - 0.5) * this.meta.height_m;

        let wy = 20.0;
        if (targetElevMOD !== null) {
            wy = targetElevMOD * 1.2; // vertical scale matching terrain mesh
        } else if (this.elevArray) {
            const gx = Math.min(this.meta.grid_w - 1, Math.max(0, Math.floor(u * this.meta.grid_w)));
            const gy = Math.min(this.meta.grid_h - 1, Math.max(0, Math.floor((1.0 - v) * this.meta.grid_h)));
            const demElev = this.elevArray[gy * this.meta.grid_w + gx] || 20.0;
            wy = demElev * 1.2;
        }

        return new THREE.Vector3(wx, wy, wz);
    }

    /**
     * Populates the 3D scene with defence assets
     */
    loadAssets(assets) {
        this.clear();

        for (const asset of assets) {
            const typeConfig = DEFENCE_TYPES[asset.type.toUpperCase()] || DEFENCE_TYPES.PERMANENT_WALL;
            const meshes = [];

            if (asset.coordinates.length > 1) {
                // Line asset: wall, embankment, or demountable barrier
                const worldPoints = asset.coordinates.map(pt => this.geoToWorld(pt[0], pt[1]));
                const crestMOD = asset.physical?.crestElevationMOD;

                // Build extruded ribbon / wall geometry
                const wallMesh = this.createWallRibbonMesh(worldPoints, crestMOD, typeConfig, asset);
                wallMesh.userData = { assetId: asset.id, asset };
                this.group.add(wallMesh);
                meshes.push(wallMesh);
                this.interactivePickables.push(wallMesh);

                // For demountable barrier, add warning marker posts at ends
                if (asset.type === 'demountable_barrier') {
                    for (const pt of [worldPoints[0], worldPoints[worldPoints.length - 1]]) {
                        const postGeom = new THREE.CylinderGeometry(0.5, 0.5, 3.5, 12);
                        const postMat = new THREE.MeshStandardMaterial({
                            color: 0xf59e0b,
                            metalness: 0.8,
                            roughness: 0.3
                        });
                        const postMesh = new THREE.Mesh(postGeom, postMat);
                        postMesh.position.set(pt.x, pt.y + 1.75, pt.z);
                        postMesh.userData = { assetId: asset.id, asset };
                        this.group.add(postMesh);
                        meshes.push(postMesh);
                        this.interactivePickables.push(postMesh);
                    }
                }
            } else if (asset.coordinates.length === 1) {
                // Point asset: pumping station or culvert outfall
                const [lon, lat] = asset.coordinates[0];
                const pt = this.geoToWorld(lon, lat);

                const stationMesh = this.createPointAssetMesh(pt, typeConfig, asset);
                stationMesh.userData = { assetId: asset.id, asset };
                this.group.add(stationMesh);
                meshes.push(stationMesh);
                this.interactivePickables.push(stationMesh);
            }

            this.assetMeshes.set(asset.id, meshes);
        }
    }

    createWallRibbonMesh(worldPoints, crestMOD, typeConfig, asset) {
        const thickness = asset.type === 'embankment' ? 3.5 : asset.type === 'demountable_barrier' ? 1.0 : 1.6;
        const geom = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];

        for (let i = 0; i < worldPoints.length - 1; i++) {
            const p0 = worldPoints[i];
            const p1 = worldPoints[i + 1];

            const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
            const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

            const crestY0 = crestMOD ? crestMOD * 1.2 : p0.y + 2.5;
            const crestY1 = crestMOD ? crestMOD * 1.2 : p1.y + 2.5;

            // Offset corners for thickness
            const halfThick = thickness * 0.5;
            const c0_left = new THREE.Vector3().copy(p0).addScaledVector(normal, halfThick);
            const c0_right = new THREE.Vector3().copy(p0).addScaledVector(normal, -halfThick);
            const c1_left = new THREE.Vector3().copy(p1).addScaledVector(normal, halfThick);
            const c1_right = new THREE.Vector3().copy(p1).addScaledVector(normal, -halfThick);

            // Top crest corners
            const t0_left = new THREE.Vector3(c0_left.x, crestY0, c0_left.z);
            const t0_right = new THREE.Vector3(c0_right.x, crestY0, c0_right.z);
            const t1_left = new THREE.Vector3(c1_left.x, crestY1, c1_left.z);
            const t1_right = new THREE.Vector3(c1_right.x, crestY1, c1_right.z);

            // Ground base corners
            const b0_left = new THREE.Vector3(c0_left.x, p0.y - 1.0, c0_left.z);
            const b0_right = new THREE.Vector3(c0_right.x, p0.y - 1.0, c0_right.z);
            const b1_left = new THREE.Vector3(c1_left.x, p1.y - 1.0, c1_left.z);
            const b1_right = new THREE.Vector3(c1_right.x, p1.y - 1.0, c1_right.z);

            // Push top crest quad
            pushQuad(positions, t0_left, t0_right, t1_right, t1_left);
            // Push left exterior face quad
            pushQuad(positions, b0_left, t0_left, t1_left, b1_left);
            // Push right interior face quad
            pushQuad(positions, t0_right, b0_right, b1_right, t1_right);
        }

        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geom.computeVertexNormals();

        let mat;
        if (asset.type === 'demountable_barrier') {
            mat = new THREE.MeshStandardMaterial({
                color: 0xf59e0b,
                emissive: 0xd97706,
                emissiveIntensity: 0.35,
                metalness: 0.85,
                roughness: 0.25,
                side: THREE.DoubleSide
            });
        } else if (asset.type === 'embankment') {
            mat = new THREE.MeshStandardMaterial({
                color: 0x10b981,
                roughness: 0.85,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
        } else {
            mat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0284c7,
                emissiveIntensity: 0.15,
                roughness: 0.4,
                metalness: 0.6,
                side: THREE.DoubleSide
            });
        }

        return new THREE.Mesh(geom, mat);
    }

    createPointAssetMesh(pt, typeConfig, asset) {
        const pointGroup = new THREE.Group();
        pointGroup.position.set(pt.x, pt.y, pt.z);

        // Cylindrical housing
        const cylGeom = new THREE.CylinderGeometry(2.4, 2.8, 3.2, 16);
        const cylMat = new THREE.MeshStandardMaterial({
            color: typeConfig.colorHex,
            metalness: 0.7,
            roughness: 0.3
        });
        const cylMesh = new THREE.Mesh(cylGeom, cylMat);
        cylMesh.position.y = 1.6;
        pointGroup.add(cylMesh);

        // Pulsing Ring Beacon
        const ringGeom = new THREE.RingGeometry(2.8, 3.8, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: typeConfig.colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.65
        });
        const ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.position.y = 0.2;
        pointGroup.add(ringMesh);

        return pointGroup;
    }

    /**
     * Highlights the selected defence asset
     */
    selectAsset(assetId) {
        this.clearHighlight();
        this.selectedAssetId = assetId;

        const meshes = this.assetMeshes.get(assetId);
        if (!meshes || meshes.length === 0) return;

        for (const m of meshes) {
            // Add wireframe bounding box / halo
            const box = new THREE.BoxHelper(m, 0x38bdf8);
            box.material.linewidth = 2;
            this.highlightGroup.add(box);
        }
    }

    clearHighlight() {
        while (this.highlightGroup.children.length > 0) {
            const c = this.highlightGroup.children.pop();
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        }
        this.selectedAssetId = null;
    }

    /**
     * Raycasts mouse click for asset selection
     */
    pickAsset(raycaster) {
        if (!this.group.visible) return null;
        const intersects = raycaster.intersectObjects(this.interactivePickables, true);
        if (intersects.length > 0) {
            let hitObj = intersects[0].object;
            while (hitObj && !hitObj.userData?.assetId && hitObj.parent) {
                hitObj = hitObj.parent;
            }
            if (hitObj && hitObj.userData?.assetId) {
                return hitObj.userData.asset;
            }
        }
        return null;
    }

    setVisible(visible) {
        this.group.visible = visible;
        if (!visible) this.clearHighlight();
    }

    clear() {
        this.clearHighlight();
        while (this.group.children.length > 0) {
            const child = this.group.children.pop();
            if (child === this.highlightGroup) continue;
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.assetMeshes.clear();
        this.interactivePickables = [];
        this.group.add(this.highlightGroup);
    }
}

function pushQuad(arr, v0, v1, v2, v3) {
    // Triangle 1: v0, v1, v2
    arr.push(v0.x, v0.y, v0.z);
    arr.push(v1.x, v1.y, v1.z);
    arr.push(v2.x, v2.y, v2.z);
    // Triangle 2: v0, v2, v3
    arr.push(v0.x, v0.y, v0.z);
    arr.push(v2.x, v2.y, v2.z);
    arr.push(v3.x, v3.y, v3.z);
}
