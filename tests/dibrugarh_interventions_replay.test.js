import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    DIBRUGARH_INTERVENTIONS, 
    deployDykeReinforcement, 
    deployStormwaterPumps, 
    computeInterventionComparison,
    runSynchronizedReplay 
} from '../src/analysis/dibrugarh_interventions.js';

test('Dibrugarh Flood Interventions & Comparison Engine', async (t) => {
    await t.test('defines supported Dibrugarh interventions', () => {
        assert.ok(DIBRUGARH_INTERVENTIONS['dyke-reinforce']);
        assert.ok(DIBRUGARH_INTERVENTIONS['mobile-pumps']);
        assert.ok(DIBRUGARH_INTERVENTIONS['freehand-wall']);
        assert.equal(DIBRUGARH_INTERVENTIONS['dyke-reinforce'].id, 'dyke-reinforce');
        assert.equal(DIBRUGARH_INTERVENTIONS['mobile-pumps'].id, 'mobile-pumps');
        assert.equal(DIBRUGARH_INTERVENTIONS['freehand-wall'].id, 'freehand-wall');
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

    await t.test('detects adverse redirection if water is displaced to previously safe areas', () => {
        const baselineDepths = new Float32Array([0.5, 0.05]);
        const protectedDepths = new Float32Array([0.1, 0.35]); // Second structure gets flooded due to displacement
        const bldgElevations = [105.0, 105.2];

        const comp = computeInterventionComparison(baselineDepths, protectedDepths, bldgElevations);
        assert.equal(comp.structuresSaved, 1);
        assert.equal(comp.adverseRedirectionDetected, true);
        assert.ok(comp.maxAdverseDisplacement >= 0.2);
    });

    await t.test('executes synchronized simulation replay for dual runs', () => {
        let simSteps = 0;
        let baseSteps = 0;
        const mockSim = { step: (s) => { simSteps += s; }, totalSimTime: 360 };
        const mockBase = { step: (s) => { baseSteps += s; }, totalSimTime: 360 };

        const syncResult = runSynchronizedReplay(mockSim, mockBase, 60);
        assert.equal(syncResult.synchronized, true);
        assert.equal(simSteps, 60);
        assert.equal(baseSteps, 60);
    });

    await t.test('verifies main.js exports side-by-side replay and intervention handlers', async () => {
        const mainModule = await import('../src/main.js');
        assert.equal(typeof mainModule.setSideBySideReplay, 'function');
        assert.equal(typeof mainModule.runSynchronizedReplay, 'function');
        assert.equal(typeof mainModule.deployDykeReinforcement, 'function');
        assert.equal(typeof mainModule.deployStormwaterPumps, 'function');
        assert.equal(typeof mainModule.computeInterventionComparison, 'function');
        assert.ok(mainModule.DIBRUGARH_INTERVENTIONS);
    });
});
