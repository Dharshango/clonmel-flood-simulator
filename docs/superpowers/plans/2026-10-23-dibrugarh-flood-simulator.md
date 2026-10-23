# Dibrugarh Flood Simulator & Multi-Town Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authentic, real-time, physics-based 3D flood simulator for Dibrugarh, Assam, India on the Brahmaputra River with interactive scenarios, freehand interventions, and synchronized side-by-side replay, accessible via a Town Switcher alongside Clonmel without altering Clonmel in any way.

**Architecture:** A config-driven multi-town framework decouples town-specific datasets (`/data/` for Clonmel; `/data/dibrugarh/` for Dibrugarh), Three.js geographic meshes, and SWE boundary conditions. A glassmorphic Town Switcher rendered below the workspace tabs swaps active models cleanly with zero GPU memory leaks, preserving Clonmel 100%.

**Tech Stack:** JavaScript (ES Modules), WebGL2 (2D SWE GPGPU solver), Three.js (0.183.2), HTML5 Canvas/CSS3, Python 3.11 (geospatial data conditioning), Puppeteer-Core (testing & evidence).

**Spec:** `docs/superpowers/specs/2026-10-23-dibrugarh-flood-simulator-design.md`

## Global Constraints

- Never modify Clonmel's data (`/data/*`), geometry, bathymetry, or simulation parameters.
- Dibrugarh study area: `27.472° N` to `27.495° N`, `94.898° E` to `94.935° E` (~3.5 km × 2.2 km).
- Dibrugarh elevations: Reconstructed from real AWS Terrarium / Copernicus DEM (range ~102.5 m to 110.5 m MSL).
- Dibrugarh gauge datums: Water Resources Department (WRD) Assam — Danger Level = `105.70 m MSL`, Historical Highest Flood Level (HFL) = `106.48 m MSL` (3 Sept 1998).
- Mass conservation error target under closed-boundary test: `< 1.0%`.
- Maintain 60+ FPS on NVIDIA RTX 3050 GPU at 1920×1080 resolution.

---

### Task 1: Town Configuration Registry & Multi-Town Framework

**Files:**
- Create: `src/config/towns.js`
- Test: `tests/towns_config.test.js`

**Interfaces:**
- Consumes: None (foundational configuration module)
- Produces: `TOWNS` dictionary, `getTownConfig(townId)`, `DEFAULT_TOWN_ID`

- [ ] **Step 1: Write failing unit test for `src/config/towns.js`**

Create `tests/towns_config.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS, getTownConfig, DEFAULT_TOWN_ID } from '../src/config/towns.js';

test('Towns Configuration Registry', async (t) => {
    await t.test('defines Clonmel with existing paths and datums', () => {
        const clonmel = getTownConfig('clonmel');
        assert.ok(clonmel, 'Clonmel configuration must exist');
        assert.equal(clonmel.id, 'clonmel');
        assert.equal(clonmel.dataPath, '/data/');
        assert.equal(clonmel.riverName, 'River Suir');
        assert.equal(clonmel.gauge.datum, 'm OD');
    });

    await t.test('defines Dibrugarh with dedicated paths and Assam datums', () => {
        const dibrugarh = getTownConfig('dibrugarh');
        assert.ok(dibrugarh, 'Dibrugarh configuration must exist');
        assert.equal(dibrugarh.id, 'dibrugarh');
        assert.equal(dibrugarh.dataPath, '/data/dibrugarh/');
        assert.equal(dibrugarh.riverName, 'Brahmaputra River');
        assert.equal(dibrugarh.gauge.datum, 'm MSL');
        assert.equal(dibrugarh.gauge.dangerLevel, 105.70);
        assert.equal(dibrugarh.gauge.hfl1998, 106.48);
        assert.deepEqual(dibrugarh.bounds, {
            south: 27.472,
            north: 27.495,
            west: 94.898,
            east: 94.935
        });
    });

    await t.test('defaults to Clonmel for backwards compatibility', () => {
        assert.equal(DEFAULT_TOWN_ID, 'clonmel');
        assert.equal(getTownConfig('unknown').id, 'clonmel');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/towns_config.test.js`  
Expected: FAIL (`Cannot find module '../src/config/towns.js'`)

- [ ] **Step 3: Implement `src/config/towns.js`**

Create `src/config/towns.js`:
```javascript
/**
 * towns.js - Multi-Town Configuration Registry
 * Decouples geospatial metadata, DEM paths, gauge datums, and camera defaults.
 */

export const TOWNS = {
    clonmel: {
        id: 'clonmel',
        name: 'Clonmel',
        region: 'County Tipperary, Ireland',
        dataPath: '/data/',
        riverName: 'River Suir',
        gauge: {
            name: 'OPW Station 16011',
            datum: 'm OD',
            bankfull: 2.80,
            danger: 3.60,
            unit: 'm OD'
        },
        defaultCamera: {
            position: { x: 0, y: 350, z: 450 },
            target: { x: 0, y: 0, z: 0 }
        },
        bounds: {
            south: 52.345,
            north: 52.364,
            west: -7.730,
            east: -7.680
        },
        studyAreaMeters: { width: 3402, height: 2114 },
        elevationRange: [15.6, 122.0]
    },
    dibrugarh: {
        id: 'dibrugarh',
        name: 'Dibrugarh',
        region: 'Assam, India',
        dataPath: '/data/dibrugarh/',
        riverName: 'Brahmaputra River',
        gauge: {
            name: 'WRD Brahmaputra Gauge',
            datum: 'm MSL',
            dangerLevel: 105.70,
            hfl1998: 106.48,
            normalMonsoon: 104.50,
            unit: 'm MSL'
        },
        defaultCamera: {
            position: { x: 0, y: 400, z: 480 },
            target: { x: 0, y: 0, z: 0 }
        },
        bounds: {
            south: 27.472,
            north: 27.495,
            west: 94.898,
            east: 94.935
        },
        studyAreaMeters: { width: 3500, height: 2200 },
        elevationRange: [102.5, 111.0]
    }
};

export const DEFAULT_TOWN_ID = 'clonmel';

export function getTownConfig(townId) {
    return TOWNS[townId] || TOWNS[DEFAULT_TOWN_ID];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/towns_config.test.js`  
Expected: PASS (all 3 assertions pass)

- [ ] **Step 5: Commit**

```bash
git add src/config/towns.js tests/towns_config.test.js
git commit -m "feat(config): add multi-town configuration registry for Clonmel and Dibrugarh"
```

---

### Task 2: Dibrugarh Geospatial Data Pipeline

**Files:**
- Create: `scripts/build_dibrugarh_data.py`
- Output: `public/data/dibrugarh/` (`terrain.json`, `elevation_hydro.bin`, `buildings.json`, `roads.json`, `waterways.json`, `flood_defences.json`, `buildings_mask.png`, `river_mask.png`, `terrain_normal.png`)
- Test: `tests/dibrugarh_data_integrity.test.js`

**Interfaces:**
- Consumes: OpenStreetMap API (`https://api.openstreetmap.org/api/0.6/map?bbox=...`), AWS Terrarium elevation tiles
- Produces: Standard 600×400 Float32 elevation grid, GeoJSON-aligned vector files, and 8-bit PNG masks.

- [ ] **Step 1: Write failing data integrity test**

Create `tests/dibrugarh_data_integrity.test.js`:
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
        assert.ok(meta.min_elev >= 100.0 && meta.max_elev <= 115.0);
    });

    await t.test('elevation_hydro.bin has exact 960,000 bytes Float32 buffer', () => {
        const binPath = path.join(dataDir, 'elevation_hydro.bin');
        assert.ok(fs.existsSync(binPath), 'elevation_hydro.bin must exist');
        const stat = fs.statSync(binPath);
        assert.equal(stat.size, 600 * 400 * 4, 'Must be exactly 960,000 bytes');
    });

    await t.test('vector datasets (buildings, roads, waterways, defences) contain valid features', () => {
        const bldgs = JSON.parse(fs.readFileSync(path.join(dataDir, 'buildings.json'), 'utf8'));
        assert.ok(Array.isArray(bldgs) && bldgs.length > 500, 'Must have > 500 building footprints');
        
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

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dibrugarh_data_integrity.test.js`  
Expected: FAIL (`no such file or directory, public/data/dibrugarh/terrain.json`)

- [ ] **Step 3: Implement `scripts/build_dibrugarh_data.py`**

Write a Python script that:
1. Downloads real OSM vector data for `(27.472, 94.898, 27.495, 94.935)`.
2. Downloads AWS Terrarium elevation tiles and samples into a 600×400 Float32 grid.
3. Hydro-conditions the Brahmaputra channel (< 102.5 m) and DTP Dyke crest (~107.0 m).
4. Generates `buildings.json`, `roads.json`, `waterways.json`, `flood_defences.json`, `terrain.json`, `elevation_hydro.bin`, `buildings_mask.png`, `river_mask.png`, and `terrain_normal.png`.

- [ ] **Step 4: Execute `scripts/build_dibrugarh_data.py` and run data integrity test**

Run:
```bash
python scripts/build_dibrugarh_data.py
node tests/dibrugarh_data_integrity.test.js
```
Expected: PASS (all 4 test suites pass)

- [ ] **Step 5: Commit**

```bash
git add scripts/build_dibrugarh_data.py public/data/dibrugarh/ tests/dibrugarh_data_integrity.test.js
git commit -m "feat(data): build real geospatial terrain, buildings, roads, and DTP dyke for Dibrugarh"
```

---

### Task 3: Town Switcher UI Component & Header Integration

**Files:**
- Create: `src/ui/town_switcher.js`
- Modify: `index.html` (add town switcher mount in `#top-nav`)
- Modify: `src/style.css` (add segmented pill switcher styles)
- Test: `tests/town_switcher_ui.test.js`

**Interfaces:**
- Consumes: `TOWNS` from `src/config/towns.js`
- Produces: `initTownSwitcher(onTownChange)`, `setActiveTown(townId)`, `getActiveTown()`

- [ ] **Step 1: Write failing UI test for Town Switcher**

Create `tests/town_switcher_ui.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('Town Switcher UI Component', async (t) => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
        <div id="town-switcher-container"></div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;

    const { initTownSwitcher, getActiveTown, setActiveTown } = await import('../src/ui/town_switcher.js');

    let switchedTown = null;
    initTownSwitcher((townId) => {
        switchedTown = townId;
    });

    const btnClonmel = document.getElementById('town-btn-clonmel');
    const btnDibrugarh = document.getElementById('town-btn-dibrugarh');

    assert.ok(btnClonmel, 'Clonmel button rendered');
    assert.ok(btnDibrugarh, 'Dibrugarh button rendered');
    assert.equal(getActiveTown(), 'clonmel');

    btnDibrugarh.click();
    assert.equal(switchedTown, 'dibrugarh');
    assert.equal(getActiveTown(), 'dibrugarh');
    assert.ok(btnDibrugarh.classList.contains('active'));
    assert.ok(!btnClonmel.classList.contains('active'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/town_switcher_ui.test.js`  
Expected: FAIL (`Cannot find module '../src/ui/town_switcher.js'`)

- [ ] **Step 3: Implement `src/ui/town_switcher.js` and styling in `src/style.css`**

Create `src/ui/town_switcher.js` supporting active town state, click events, URL hash persistence (`#town=clonmel` / `#town=dibrugarh`), and DOM rendering.  
Add CSS rules in `src/style.css` for `.town-switcher-bar`, `.town-pill-btn`, `.town-pill-btn.active`.  
Mount `#town-switcher-container` in `index.html` directly under `.header-modes.center-modes`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/town_switcher_ui.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/town_switcher.js index.html src/style.css tests/town_switcher_ui.test.js
git commit -m "feat(ui): add glassmorphic Town Switcher pill bar below workspace tabs"
```

---

### Task 4: Dynamic 3D Scene & Simulation Switching Lifecycle in `src/main.js`

**Files:**
- Modify: `src/main.js`
- Test: `tests/scene_lifecycle.test.js`

**Interfaces:**
- Consumes: `getTownConfig` from `src/config/towns.js`, `initTownSwitcher` from `src/ui/town_switcher.js`
- Produces: `switchTown(townId)`, `loadTownData(townConfig)`, dynamic Three.js & SWE solver rebuild.

- [ ] **Step 1: Write integration test for town switching lifecycle**

Create `tests/scene_lifecycle.test.js` verifying that loading Dibrugarh switches data paths to `/data/dibrugarh/`, correctly updates camera position, resets SWE textures, and switching back to Clonmel restores Clonmel data without errors.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/scene_lifecycle.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement dynamic scene teardown & rebuild in `src/main.js`**

Refactor `init()` in `src/main.js`:
- Extract town asset loading into `loadTownData(townConfig)`.
- Implement `teardownTownModel()` disposing existing terrain geometry, instanced building meshes, normal textures, and defence layers.
- Implement `mountTownModel(townConfig, data)` instantiating the new town's terrain, buildings, roads, river channel, and boundary conditions.
- Connect `initTownSwitcher(switchTown)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/scene_lifecycle.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main.js tests/scene_lifecycle.test.js
git commit -m "feat(engine): implement dynamic town model loading and seamless switching between Clonmel and Dibrugarh"
```

---

### Task 5: Dibrugarh Hydrological Scenarios & Gauge Telemetry Integration

**Files:**
- Create: `src/simulation/dibrugarh_scenarios.js`
- Modify: `src/main.js` (HUD gauge readouts and scenario switching)
- Test: `tests/dibrugarh_scenarios.test.js`

**Interfaces:**
- Consumes: WRD Brahmaputra Gauge datums, SWE solver parameters
- Produces: `DIBRUGARH_SCENARIOS`, `applyDibrugarhScenario(scenarioId, solver)`

- [ ] **Step 1: Write failing test for Dibrugarh scenarios**

Create `tests/dibrugarh_scenarios.test.js` testing:
1. Baseline Monsoon (Stage 104.50 m MSL, river within channel).
2. July 2024 Urban Flash Flood (65 mm/h rain, 105.50 m stage, closed sluice gates).
3. September 1998 Record Flood (106.48 m MSL HFL overtopping dyke).
4. Slider boundary enforcement (103.0 m to 107.5 m MSL).

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dibrugarh_scenarios.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement `src/simulation/dibrugarh_scenarios.js` and HUD updates**

Create `src/simulation/dibrugarh_scenarios.js`:
- Define hydrographs and boundary conditions.
- Update HUD telemetry box dynamically: when Dibrugarh is active, display `WRD Station (Brahmaputra) | Danger Level: 105.70 m MSL | HFL: 106.48 m MSL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/dibrugarh_scenarios.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/simulation/dibrugarh_scenarios.js src/main.js tests/dibrugarh_scenarios.test.js
git commit -m "feat(scenarios): add Dibrugarh monsoon, July 2024 flash flood, and 1998 record inundation scenarios"
```

---

### Task 6: Dibrugarh Flood Interventions & Side-by-Side Synchronized Replay

**Files:**
- Create: `src/analysis/dibrugarh_interventions.js`
- Modify: `src/main.js` (Intervention Lab hooks, side-by-side replay viewport)
- Test: `tests/dibrugarh_interventions_replay.test.js`

**Interfaces:**
- Consumes: Freehand drawing engine, DTP dyke polyline, SWE solver
- Produces: `deployDykeReinforcement()`, `deployStormwaterPumps()`, `runSynchronizedReplay()`

- [ ] **Step 1: Write failing test for interventions and side-by-side replay**

Create `tests/dibrugarh_interventions_replay.test.js` testing:
- Freehand wall and sandbag barrier placement on Dibrugarh terrain.
- DTP dyke reinforcement (+0.8 m elevation).
- Sluice gate pump station activation.
- Side-by-side replay synchronization (identical timestep and rainfall forcing, computing dry buildings preserved and depth delta).

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dibrugarh_interventions_replay.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement `src/analysis/dibrugarh_interventions.js` and dual simulation replay**

Implement:
- DTP dyke height boost in defence raster.
- Municipal pump sink terms in urban drainage nodes.
- Synchronized dual-run comparator calculating buildings saved and road cuts prevented.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/dibrugarh_interventions_replay.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analysis/dibrugarh_interventions.js src/main.js tests/dibrugarh_interventions_replay.test.js
git commit -m "feat(interventions): implement DTP dyke reinforcement, pump stations, and synchronized side-by-side replay for Dibrugarh"
```

---

### Task 7: Decision-Support Workspaces Parity for Dibrugarh (All 10 Workspaces)

**Files:**
- Create: `src/ui/dibrugarh_workspaces.js`
- Modify: `src/main.js` (workspace tab activation handlers)
- Test: `tests/dibrugarh_workspaces.test.js`

**Interfaces:**
- Consumes: Dibrugarh critical infrastructure assets, ASDMA evidence markers, DTP dyke chainage
- Produces: `updateDibrugarhWorkspace(workspaceId)`

- [ ] **Step 1: Write failing test for workspace parity**

Create `tests/dibrugarh_workspaces.test.js` verifying that all 10 workspaces load their corresponding Dibrugarh datasets:
1. Live Map, 2. Time Machine, 3. Intervention Lab, 4. Infrastructure Impact, 5. Community Evidence, 6. Command Exercise, 7. Science & Validation, 8. Forecast Ops, 9. Defence Monitor, 10. Explain Forecast.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/dibrugarh_workspaces.test.js`  
Expected: FAIL

- [ ] **Step 3: Implement `src/ui/dibrugarh_workspaces.js`**

Implement Dibrugarh-specific data bindings for:
- Critical infrastructure (Railway station, AT Road, Graham Bazaar, AMCH corridor).
- ASDMA and PIB July 2024 geotagged flood evidence markers.
- Defence Monitor tracking DTP dyke freeboard against Brahmaputra stage.
- Explain Forecast decomposing pluvial vs river backwater impact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/dibrugarh_workspaces.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/dibrugarh_workspaces.js src/main.js tests/dibrugarh_workspaces.test.js
git commit -m "feat(workspaces): configure all 10 decision-support workspaces for Dibrugarh"
```

---

### Task 8: Standard Dam-Break Benchmark & Mass Conservation Validation

**Files:**
- Create: `tests/dam_break_validation.test.js`
- Create: `scripts/run_mass_conservation_check.js`
- Output: `evidence/validation_report.json`

**Interfaces:**
- Consumes: GPU SWE numerical solver, analytical Ritter/Stoker dam-break solution
- Produces: Normalized root-mean-square error (NRMSE), mass balance percentage error.

- [ ] **Step 1: Write dam-break benchmark validation test**

Create `tests/dam_break_validation.test.js` comparing the numerical solver water profile against the 1D analytical dam-break solution, verifying error within tolerance and closed-system mass conservation error `< 1.0%`.

- [ ] **Step 2: Run test to verify it passes and logs validation metrics**

Run: `node tests/dam_break_validation.test.js`  
Expected: PASS (Mass balance error < 1.0%, analytical agreement documented)

- [ ] **Step 3: Commit**

```bash
git add tests/dam_break_validation.test.js scripts/run_mass_conservation_check.js
git commit -m "test(validation): add analytical dam-break benchmark and mass conservation test"
```

---

### Task 9: Performance Measurement, Evidence Folder & Demonstration Video

**Files:**
- Create: `scripts/record_dibrugarh_demo.js`
- Create: `scripts/verify_dibrugarh_system.js`
- Output:
  - `evidence/dibrugarh_terrain_buildings.png`
  - `evidence/dibrugarh_normal_river.png`
  - `evidence/dibrugarh_peak_inundation.png`
  - `evidence/dibrugarh_freehand_wall_drawn.png`
  - `evidence/dibrugarh_side_by_side_replay.png`
  - `evidence/dibrugarh_local_flood_evidence.png`
  - `evidence/demo.mp4`
  - `evidence/DIBRUGARH_VALIDATION_REPORT.md` (including 3 critique rounds)

- [ ] **Step 1: Implement full system verification and capture script**

Create `scripts/verify_dibrugarh_system.js` and `scripts/record_dibrugarh_demo.js` to execute headless browser sweeps, measure FPS, log GPU performance, capture all signature shots, and record `evidence/demo.mp4`.

- [ ] **Step 2: Execute verification script and generate all visual evidence**

Run:
```bash
node scripts/verify_dibrugarh_system.js
node scripts/record_dibrugarh_demo.js
```
Expected: All screenshots, demo recording, and performance metrics saved to `evidence/`.

- [ ] **Step 3: Document three critique rounds in `evidence/DIBRUGARH_VALIDATION_REPORT.md`**

Record:
- Critique Round 1: Geospatial precision & river dyke boundary.
- Critique Round 2: Pluvial drainage congestion vs river overtopping balance.
- Critique Round 3: Side-by-side replay legibility and decision-maker transparency.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_dibrugarh_system.js scripts/record_dibrugarh_demo.js evidence/
git commit -m "docs(evidence): complete Dibrugarh validation report, performance measurements, and demo recording"
```
