# Task 5 Brief: Dibrugarh Hydrological Scenarios & Gauge Telemetry Integration

## Task Text from Plan
**Files:**
- Create: `src/simulation/dibrugarh_scenarios.js`
- Modify: `src/main.js` (HUD scenario buttons and slider bindings for Dibrugarh)
- Test: `tests/dibrugarh_scenarios.test.js`

**Interfaces:**
- Consumes: WRD Brahmaputra Gauge datums, SWE solver parameters
- Produces: `DIBRUGARH_SCENARIOS`, `applyDibrugarhScenario(scenarioId, solver, hudState)`

## Steps:
1. Write failing test `tests/dibrugarh_scenarios.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIBRUGARH_SCENARIOS, applyDibrugarhScenario } from '../src/simulation/dibrugarh_scenarios.js';

test('Dibrugarh Hydrological Scenarios', async (t) => {
    await t.test('defines baseline monsoon scenario below Danger Level', () => {
        const baseline = DIBRUGARH_SCENARIOS['baseline-monsoon'];
        assert.ok(baseline);
        assert.equal(baseline.stageMSL, 104.50);
        assert.equal(baseline.rainfallRate, 0);
        assert.equal(baseline.sluiceGates, 'open');
    });

    await t.test('defines July 2024 urban flash flood with cloudburst and closed sluices', () => {
        const july2024 = DIBRUGARH_SCENARIOS['july-2024-flash'];
        assert.ok(july2024);
        assert.equal(july2024.stageMSL, 105.50);
        assert.equal(july2024.rainfallRate, 65);
        assert.equal(july2024.sluiceGates, 'closed');
        assert.ok(july2024.affectedLocalities.includes('Graham Bazaar'));
        assert.ok(july2024.affectedLocalities.includes('AT Road'));
    });

    await t.test('defines Sept 1998 record flood overtopping DTP dyke at 106.48m HFL', () => {
        const sept1998 = DIBRUGARH_SCENARIOS['sept-1998-record'];
        assert.ok(sept1998);
        assert.equal(sept1998.stageMSL, 106.48);
        assert.equal(sept1998.overtopDyke, true);
    });

    await t.test('applies scenario parameters to mock SWE solver', () => {
        const mockSolver = {
            params: { riverInflow: 0, rainIntensity: 0, downstreamSurge: 0 },
            totalSimTime: 0
        };
        applyDibrugarhScenario('july-2024-flash', mockSolver);
        assert.equal(mockSolver.params.rainIntensity, 65);
        assert.ok(mockSolver.params.riverInflow > 0);
    });
});
```

2. Run test to verify: `node tests/dibrugarh_scenarios.test.js`

3. Create `src/simulation/dibrugarh_scenarios.js`:
   - Export `DIBRUGARH_SCENARIOS` with full hydrological parameters, descriptions, and affected localities.
   - Export `applyDibrugarhScenario(scenarioId, solver, hudState)`.
   - Export helper `getDibrugarhGaugeStatus(stageMSL)` returning status (`NORMAL FLOW`, `HIGH FLOW`, `DANGER LEVEL EXCEEDED`, `HISTORIC PEAK OVERTOPPING`) based on WRD Assam datums.

4. Update `src/main.js`:
   - In `mountTownModel`, check if town is Dibrugarh:
     - Dynamically swap scenario preset cards in `#live-scenarios` or `#scenario-selector`:
       - Card 1: Normal Monsoon Flow (104.50 m MSL)
       - Card 2: July 2024 Urban Flash Flood (65 mm/h rain, 105.50 m stage)
       - Card 3: Sept 1998 Historic River Flood (106.48 m HFL)
     - Connect scenario card clicks to `applyDibrugarhScenario`.
     - Update slider labels and limits: River stage slider (103.0m to 107.5m MSL).
     - Update gauge HUD: Station `WRD Station 03 (Brahmaputra River) | LIVE 15m`, Danger Level `105.70 m MSL`, HFL `106.48 m MSL`.
   - When switching back to Clonmel, restore Clonmel's River Suir scenario cards and OPW Station 16011 readouts.

5. Run test to verify:
   `node tests/dibrugarh_scenarios.test.js`
   `node --test tests/*.test.js`

6. Commit:
   `git add src/simulation/dibrugarh_scenarios.js src/main.js tests/dibrugarh_scenarios.test.js && git commit -m "feat(scenarios): add Dibrugarh monsoon, July 2024 flash flood, and 1998 record inundation scenarios"`
