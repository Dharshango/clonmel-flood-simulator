# Task 6 Brief: Dibrugarh Flood Interventions & Side-by-Side Synchronized Replay

## Task Text from Plan
**Files:**
- Create: `src/analysis/dibrugarh_interventions.js`
- Modify: `src/main.js` (Intervention Lab hooks, side-by-side replay viewport)
- Test: `tests/dibrugarh_interventions_replay.test.js`

**Interfaces:**
- Consumes: Freehand drawing engine, DTP dyke polyline, SWE solver
- Produces: `deployDykeReinforcement()`, `deployStormwaterPumps()`, `runSynchronizedReplay()`, `computeInterventionComparison()`

## Steps:
1. Write failing test `tests/dibrugarh_interventions_replay.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    DIBRUGARH_INTERVENTIONS, 
    deployDykeReinforcement, 
    deployStormwaterPumps, 
    computeInterventionComparison 
} from '../src/analysis/dibrugarh_interventions.js';

test('Dibrugarh Flood Interventions & Comparison Engine', async (t) => {
    await t.test('defines supported Dibrugarh interventions', () => {
        assert.ok(DIBRUGARH_INTERVENTIONS['dyke-reinforce']);
        assert.ok(DIBRUGARH_INTERVENTIONS['mobile-pumps']);
        assert.ok(DIBRUGARH_INTERVENTIONS['freehand-wall']);
    });

    await t.test('reinforces DTP dyke by +0.8m crest elevation', () => {
        const mockDefences = [
            { id: 'dtp-sec-1', name: 'DTP Dyke Sector 1', crestElevation: 107.0 }
        ];
        const reinforced = deployDykeReinforcement(mockDefences, 0.8);
        assert.equal(reinforced[0].crestElevation, 107.8);
        assert.equal(reinforced[0].reinforced, true);
    });

    await t.test('deploys municipal stormwater pumps at sluice outfall', () => {
        const pumpConfig = deployStormwaterPumps('graham-bazaar-sluice', 15.0);
        assert.equal(pumpConfig.capacityM3s, 15.0);
        assert.equal(pumpConfig.active, true);
    });

    await t.test('computes synchronized comparison metrics between baseline and protected run', () => {
        const baselineDepths = new Float32Array([0.8, 0.6, 0.4, 0.0]);
        const protectedDepths = new Float32Array([0.1, 0.05, 0.4, 0.0]);
        const bldgElevations = [105.0, 105.2, 105.5, 106.0];

        const comp = computeInterventionComparison(baselineDepths, protectedDepths, bldgElevations);
        assert.equal(comp.structuresSaved, 2); // 2 buildings dropped below 0.15m hazard
        assert.ok(comp.maxDepthReduction >= 0.5);
        assert.equal(comp.adverseRedirectionDetected, false);
    });
});
```

2. Run test to verify: `node tests/dibrugarh_interventions_replay.test.js`

3. Create `src/analysis/dibrugarh_interventions.js`:
   - Export `DIBRUGARH_INTERVENTIONS`.
   - Export `deployDykeReinforcement(defences, boostMeters)`.
   - Export `deployStormwaterPumps(sluiceId, capacityM3s)`.
   - Export `computeInterventionComparison(baselineDepths, protectedDepths, bldgData)`.

4. Update `src/main.js`:
   - Wire Dibrugarh intervention options into Workspace 3 (Intervention Lab):
     - Toggle: "Reinforce DTP Dyke (+0.8m Crest)"
     - Toggle: "High-Capacity Sluice Pumps (15 m³/s)"
     - Freehand Flood Wall / Sandbag Drawing on Dibrugarh terrain
   - Side-by-side replay modal / dual viewport:
     - Compare original flood vs intervention run side-by-side with synchronized time scrubber
     - Display diff metrics: `Buildings Saved: N`, `Peak Depth Reduction: X.XX m`, `Road Cut-offs Avoided: Y`.

5. Run tests:
   `node tests/dibrugarh_interventions_replay.test.js`
   `node --test tests/*.test.js`

6. Commit:
   `git add src/analysis/dibrugarh_interventions.js src/main.js tests/dibrugarh_interventions_replay.test.js && git commit -m "feat(interventions): implement DTP dyke reinforcement, pump stations, and synchronized side-by-side replay for Dibrugarh"`
