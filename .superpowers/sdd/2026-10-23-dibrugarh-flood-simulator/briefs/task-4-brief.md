# Task 4 Brief: Dynamic 3D Scene & Simulation Switching Lifecycle in `src/main.js`

## Task Text from Plan
**Files:**
- Modify: `src/main.js`
- Test: `tests/scene_lifecycle.test.js`

**Interfaces:**
- Consumes: `getTownConfig`, `TOWNS` from `src/config/towns.js`, `initTownSwitcher`, `getActiveTown` from `src/ui/town_switcher.js`
- Produces: `switchTown(townId)`, `loadTownData(townConfig)`, dynamic Three.js & SWE solver rebuild, clean WebGL texture disposal.

## Steps:
1. Write integration/unit test `tests/scene_lifecycle.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS, getTownConfig } from '../src/config/towns.js';

test('Scene Lifecycle and Multi-Town Data Loading', async (t) => {
    await t.test('verifies data assets exist for each configured town', async () => {
        for (const townId of Object.keys(TOWNS)) {
            const config = getTownConfig(townId);
            assert.ok(config.dataPath, `dataPath must be defined for ${townId}`);
        }
    });

    await t.test('ensures camera viewpoints differ between Clonmel and Dibrugarh', () => {
        const clonmel = getTownConfig('clonmel');
        const dibrugarh = getTownConfig('dibrugarh');
        assert.notDeepEqual(clonmel.bounds, dibrugarh.bounds);
        assert.equal(clonmel.riverName, 'River Suir');
        assert.equal(dibrugarh.riverName, 'Brahmaputra River');
    });
});
```

2. Run test to verify: `node tests/scene_lifecycle.test.js`

3. In `src/main.js`:
   - Import `getTownConfig`, `TOWNS` from `./config/towns.js`.
   - Import `initTownSwitcher`, `getActiveTown`, `setActiveTown` from `./ui/town_switcher.js`.
   - Determine active town at startup: `const initialTownId = getActiveTown(); const currentTown = getTownConfig(initialTownId);`.
   - Load town assets dynamically using `currentTown.dataPath + filename` (`terrain.json`, `elevation_hydro.bin`, `buildings.json`, `roads.json`, `buildings_mask.png`, `river_mask.png`, `terrain_normal.png`, with fallback for `barriers_preset.json`).
   - Store loaded Three.js scene objects (`terrainMesh`, `buildingsMesh`, `roadsGroup`, etc.) in a manager or state so they can be removed and disposed cleanly.
   - Implement `switchTown(newTownId)`:
     - Sets active town in UI.
     - Fetches new town data.
     - Removes and disposes old meshes.
     - Rebuilds terrain, buildings, and roads for the new town.
     - Resets SWE simulator with new elevation buffer, grid dimensions, and boundary conditions.
     - Repositions camera to `townConfig.defaultCamera`.
     - Updates HUD readouts (station name, gauge datums, coordinates).
   - Hook up `initTownSwitcher(switchTown)`.

4. Run tests and verify zero regressions on Clonmel:
   `node tests/scene_lifecycle.test.js`
   `node --test tests/*.test.js`

5. Commit:
   `git add src/main.js tests/scene_lifecycle.test.js && git commit -m "feat(engine): implement dynamic town model loading and seamless switching between Clonmel and Dibrugarh"`
