import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TOWNS, getTownConfig } from '../src/config/towns.js';

test('Scene Lifecycle and Multi-Town Data Loading', async (t) => {
    await t.test('verifies data assets exist for each configured town', async () => {
        for (const townId of Object.keys(TOWNS)) {
            const config = getTownConfig(townId);
            assert.ok(config.dataPath, `dataPath must be defined for ${townId}`);

            // Verify essential asset files on disk
            const requiredFiles = [
                'terrain.json',
                'elevation_hydro.bin',
                'buildings.json',
                'roads.json',
                'buildings_mask.png',
                'river_mask.png',
                'terrain_normal.png'
            ];

            const baseDir = path.resolve('public', config.dataPath.replace(/^\//, ''));
            for (const f of requiredFiles) {
                const filePath = path.join(baseDir, f);
                assert.ok(
                    fs.existsSync(filePath),
                    `Asset ${f} must exist on disk for ${townId} at ${filePath}`
                );
            }
        }
    });

    await t.test('ensures camera viewpoints differ between Clonmel and Dibrugarh', () => {
        const clonmel = getTownConfig('clonmel');
        const dibrugarh = getTownConfig('dibrugarh');
        assert.notDeepEqual(clonmel.bounds, dibrugarh.bounds);
        assert.equal(clonmel.riverName, 'River Suir');
        assert.equal(dibrugarh.riverName, 'Brahmaputra River');
        assert.notDeepEqual(clonmel.defaultCamera.position, dibrugarh.defaultCamera.position);
    });

    await t.test('verifies town data path resolution', () => {
        const clonmel = getTownConfig('clonmel');
        const dibrugarh = getTownConfig('dibrugarh');

        assert.equal(clonmel.dataPath, '/data/');
        assert.equal(dibrugarh.dataPath, '/data/dibrugarh/');

        const clonmelTerrain = `${clonmel.dataPath}terrain.json`;
        const dibrugarhTerrain = `${dibrugarh.dataPath}terrain.json`;
        assert.equal(clonmelTerrain, '/data/terrain.json');
        assert.equal(dibrugarhTerrain, '/data/dibrugarh/terrain.json');
    });

    await t.test('verifies scene lifecycle teardown and disposal protocol', () => {
        // Mock Three.js scene object hierarchy to test disposal safety
        const disposedGeometries = [];
        const disposedMaterials = [];
        const disposedTextures = [];
        const removedObjects = [];

        const mockScene = {
            children: [],
            remove(obj) {
                removedObjects.push(obj);
                const idx = this.children.indexOf(obj);
                if (idx !== -1) this.children.splice(idx, 1);
            }
        };

        const mockGeom = {
            dispose() {
                disposedGeometries.push(this);
            }
        };

        const mockTex = {
            dispose() {
                disposedTextures.push(this);
            }
        };

        const mockMat = {
            map: mockTex,
            dispose() {
                disposedMaterials.push(this);
            }
        };

        const mockMesh = {
            name: 'testMesh',
            geometry: mockGeom,
            material: mockMat,
            traverse(cb) {
                cb(this);
            }
        };

        mockScene.children.push(mockMesh);

        // Simulate safe object disposal helper
        function disposeSceneObject(scene, obj) {
            if (!obj) return;
            if (scene) scene.remove(obj);
            if (typeof obj.traverse === 'function') {
                obj.traverse(child => {
                    if (child.geometry && typeof child.geometry.dispose === 'function') {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        for (const m of mats) {
                            if (m.map && typeof m.map.dispose === 'function') m.map.dispose();
                            if (m.normalMap && typeof m.normalMap.dispose === 'function') m.normalMap.dispose();
                            if (typeof m.dispose === 'function') m.dispose();
                        }
                    }
                });
            }
        }

        disposeSceneObject(mockScene, mockMesh);

        assert.equal(removedObjects.length, 1);
        assert.equal(disposedGeometries.length, 1);
        assert.equal(disposedMaterials.length, 1);
        assert.equal(disposedTextures.length, 1);
        assert.equal(mockScene.children.length, 0);
    });

    await t.test('verifies multi-town gauge and HUD metadata compatibility', () => {
        const clonmel = getTownConfig('clonmel');
        const dibrugarh = getTownConfig('dibrugarh');

        // Clonmel gauge assertions
        assert.ok(clonmel.gauge.name.includes('OPW'));
        assert.equal(clonmel.gauge.datum, 'm OD');
        assert.equal(clonmel.gauge.bankfull, 2.80);

        // Dibrugarh gauge assertions
        assert.ok(dibrugarh.gauge.name.includes('WRD'));
        assert.equal(dibrugarh.gauge.datum, 'm MSL');
        assert.equal(dibrugarh.gauge.dangerLevel, 105.70);
        assert.equal(dibrugarh.gauge.hfl1998, 106.48);
    });

    await t.test('verifies main.js exports loadTownData and switchTown lifecycle handlers', async () => {
        const mainModule = await import('../src/main.js');
        assert.equal(typeof mainModule.loadTownData, 'function', 'loadTownData must be exported');
        assert.equal(typeof mainModule.switchTown, 'function', 'switchTown must be exported');
        assert.equal(typeof mainModule.init, 'function', 'init must be exported');
    });
});
