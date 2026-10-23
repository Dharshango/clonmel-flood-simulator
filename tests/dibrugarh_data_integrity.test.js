import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('public/data/dibrugarh');

test('Dibrugarh Data Assets Integrity', async (t) => {
    await t.test('terrain.json exists and has correct dimensions and bounds', () => {
        const metaPath = path.join(dataDir, 'terrain.json');
        assert.ok(fs.existsSync(metaPath), 'terrain.json must exist');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        assert.equal(meta.grid_w, 600);
        assert.equal(meta.grid_h, 400);
        assert.equal(meta.river, 'Brahmaputra River');
        assert.ok(meta.min_elev >= 99.0 && meta.max_elev <= 115.0);
    });

    await t.test('elevation_hydro.bin has exact 960,000 bytes Float32 buffer', () => {
        const binPath = path.join(dataDir, 'elevation_hydro.bin');
        assert.ok(fs.existsSync(binPath), 'elevation_hydro.bin must exist');
        const stat = fs.statSync(binPath);
        assert.equal(stat.size, 600 * 400 * 4, 'Must be exactly 960,000 bytes');
    });

    await t.test('vector datasets (buildings, roads, waterways, defences) contain valid features', () => {
        const bldgs = JSON.parse(fs.readFileSync(path.join(dataDir, 'buildings.json'), 'utf8'));
        assert.ok(Array.isArray(bldgs) && bldgs.length > 200, 'Must have > 200 building footprints');
        
        const roads = JSON.parse(fs.readFileSync(path.join(dataDir, 'roads.json'), 'utf8'));
        assert.ok(Array.isArray(roads) && roads.length > 50, 'Must have road segments');

        const defences = JSON.parse(fs.readFileSync(path.join(dataDir, 'flood_defences.json'), 'utf8'));
        assert.ok(Array.isArray(defences) && defences.length > 0, 'Must have DTP dyke defences');
    });

    await t.test('raster masks exist', () => {
        assert.ok(fs.existsSync(path.join(dataDir, 'buildings_mask.png')));
        assert.ok(fs.existsSync(path.join(dataDir, 'river_mask.png')));
        assert.ok(fs.existsSync(path.join(dataDir, 'terrain_normal.png')));
    });
});
