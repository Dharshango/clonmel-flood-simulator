# Task 7 Brief: Decision-Support Workspaces Parity for Dibrugarh (All 10 Workspaces)

## Task Text from Plan
**Files:**
- Create: `src/ui/dibrugarh_workspaces.js`
- Modify: `src/main.js` (workspace tab activation handlers)
- Test: `tests/dibrugarh_workspaces.test.js`

**Interfaces:**
- Consumes: Dibrugarh critical infrastructure assets, ASDMA evidence markers, DTP dyke chainage
- Produces: `DIBRUGARH_INFRASTRUCTURE`, `DIBRUGARH_COMMUNITY_EVIDENCE`, `DIBRUGARH_COMMAND_EXERCISES`, `updateDibrugarhWorkspace(workspaceId)`

## Steps:
1. Write failing test `tests/dibrugarh_workspaces.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    DIBRUGARH_INFRASTRUCTURE, 
    DIBRUGARH_COMMUNITY_EVIDENCE, 
    DIBRUGARH_COMMAND_EXERCISES,
    getDibrugarhDefenceStatus,
    getDibrugarhForecastExplanation
} from '../src/ui/dibrugarh_workspaces.js';

test('Dibrugarh Decision Workspaces Parity', async (t) => {
    await t.test('defines key critical infrastructure for Dibrugarh', () => {
        assert.ok(DIBRUGARH_INFRASTRUCTURE.length >= 5);
        const railway = DIBRUGARH_INFRASTRUCTURE.find(i => i.name.includes('Railway'));
        const atRoad = DIBRUGARH_INFRASTRUCTURE.find(i => i.name.includes('AT Road'));
        const graham = DIBRUGARH_INFRASTRUCTURE.find(i => i.name.includes('Graham Bazaar'));
        assert.ok(railway, 'Dibrugarh Town Railway Station present');
        assert.ok(atRoad, 'AT Road corridor present');
        assert.ok(graham, 'Graham Bazaar present');
    });

    await t.test('defines ASDMA and PIB July 2024 community flood evidence markers', () => {
        assert.ok(DIBRUGARH_COMMUNITY_EVIDENCE.length >= 4);
        const pib2024 = DIBRUGARH_COMMUNITY_EVIDENCE.find(e => e.date.includes('2024'));
        assert.ok(pib2024, 'July 2024 evidence marker present');
        assert.ok(pib2024.source.includes('PIB') || pib2024.source.includes('ASDMA'));
    });

    await t.test('calculates DTP dyke freeboard correctly in Defence Monitor', () => {
        const normal = getDibrugarhDefenceStatus(104.50);
        assert.ok(normal.minFreeboardMeters >= 2.0);
        assert.equal(normal.status, 'SAFE');

        const danger = getDibrugarhDefenceStatus(106.00);
        assert.ok(danger.minFreeboardMeters < 1.0);
        assert.equal(danger.status, 'CRITICAL_FREEBOARD');
    });

    await t.test('decomposes flood drivers in Explain Forecast', () => {
        const explanation = getDibrugarhForecastExplanation({ stageMSL: 105.50, rainIntensity: 65 });
        assert.ok(explanation.pluvialSharePercent > 40);
        assert.ok(explanation.riverBackwaterPercent > 30);
        assert.ok(explanation.primaryDriver.includes('Cloudburst') || explanation.primaryDriver.includes('Sluice'));
    });
});
```

2. Run test to verify: `node tests/dibrugarh_workspaces.test.js`

3. Create `src/ui/dibrugarh_workspaces.js`:
   - Export `DIBRUGARH_INFRASTRUCTURE` (Railway Station, AT Road Commercial Corridor, Graham Bazaar Market, Thana Chariali Junction, Mancotta Road Substation, AMCH Emergency Access).
   - Export `DIBRUGARH_COMMUNITY_EVIDENCE` (PIB July 2024 Flash Flood photo reports, ASDMA 1998 HFL flood gauge marks, Local citizen inundation logs).
   - Export `DIBRUGARH_COMMAND_EXERCISES` (Dyke Breach Response Drill, Monsoon Cloudburst Evacuation Drill).
   - Export `getDibrugarhDefenceStatus(stageMSL, defences)`.
   - Export `getDibrugarhForecastExplanation(params)`.
   - Export `bindDibrugarhWorkspaces(workspaceManager, currentTown)`.

4. Update `src/main.js`:
   - When Dibrugarh is active, pass Dibrugarh datasets to `WorkspaceManager` and workspace views (Impact, Evidence, Exercise, Forecast, Defences, Explain).
   - Ensure switching back to Clonmel seamlessly restores Clonmel's infrastructure (Town Hall, Hospital, etc.), evidence, OPW forecasts, and River Suir defence monitors.

5. Run tests:
   `node tests/dibrugarh_workspaces.test.js`
   `node --test tests/*.test.js`

6. Commit:
   `git add src/ui/dibrugarh_workspaces.js src/main.js tests/dibrugarh_workspaces.test.js && git commit -m "feat(workspaces): configure all 10 decision-support workspaces for Dibrugarh"`
