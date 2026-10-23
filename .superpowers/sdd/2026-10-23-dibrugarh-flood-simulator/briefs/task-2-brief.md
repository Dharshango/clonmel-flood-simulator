# Task 2 Brief: Dibrugarh Geospatial Data Pipeline

## Task Text from Plan
**Files:**
- Create: `scripts/build_dibrugarh_data.py`
- Output: `public/data/dibrugarh/` (`terrain.json`, `elevation_hydro.bin`, `buildings.json`, `roads.json`, `waterways.json`, `flood_defences.json`, `buildings_mask.png`, `river_mask.png`, `terrain_normal.png`)
- Test: `tests/dibrugarh_data_integrity.test.js`

**Interfaces:**
- Consumes: OpenStreetMap API (`https://api.openstreetmap.org/api/0.6/map?bbox=94.898,27.472,94.935,27.495`), AWS Terrarium elevation tiles / Open-Elevation.
- Produces: Standard 600×400 Float32 elevation grid, GeoJSON-aligned vector files, and 8-bit PNG masks.

## Steps:
1. Write failing data integrity test `tests/dibrugarh_data_integrity.test.js`:
```javascript
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
```

2. Run test to verify it fails (`node tests/dibrugarh_data_integrity.test.js`).
3. Implement `scripts/build_dibrugarh_data.py`:
   - Create `public/data/dibrugarh/`.
   - Fetch real OSM data from `https://api.openstreetmap.org/api/0.6/map?bbox=94.898,27.472,94.935,27.495` (parse nodes, ways, tags).
   - Fetch elevation tiles or compute realistic DEM based on AWS Terrarium / Copernicus DEM (elevations 104m-110m MSL, river channel carved to ~101.5-102.5m, DTP dyke crest at ~107.0m).
   - Write out `terrain.json`, `elevation_hydro.bin` (binary Float32Array 600*400), `buildings.json`, `roads.json`, `waterways.json`, `flood_defences.json`, `buildings_mask.png`, `river_mask.png`, `terrain_normal.png`.
   - Note: Pillow (PIL) is available in Python 3.11 for generating PNGs.
4. Execute `python scripts/build_dibrugarh_data.py`.
5. Run test to verify it passes (`node tests/dibrugarh_data_integrity.test.js`).
6. Commit: `git add scripts/build_dibrugarh_data.py public/data/dibrugarh/ tests/dibrugarh_data_integrity.test.js && git commit -m "feat(data): build real geospatial terrain, buildings, roads, and DTP dyke for Dibrugarh"`.
