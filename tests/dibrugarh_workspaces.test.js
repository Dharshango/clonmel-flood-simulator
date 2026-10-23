import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    DIBRUGARH_INFRASTRUCTURE, 
    DIBRUGARH_COMMUNITY_EVIDENCE, 
    DIBRUGARH_COMMAND_EXERCISES,
    getDibrugarhDefenceStatus,
    getDibrugarhForecastExplanation,
    bindDibrugarhWorkspaces
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

    await t.test('binds workspaces for Dibrugarh and restores Clonmel', () => {
        const mockWorkspaceManager = {
            infraManager: { facilities: [], selectedFacility: null, build3DMarkers: () => {} },
            evidenceManager: { reports: [], selectedReport: null, build3DMarkers: () => {} },
            exerciseManager: { scenario: null, reset: () => {} },
            updateView: () => {}
        };

        // Bind Dibrugarh
        bindDibrugarhWorkspaces(mockWorkspaceManager, 'dibrugarh');
        assert.equal(mockWorkspaceManager.infraManager.facilities, DIBRUGARH_INFRASTRUCTURE);
        assert.equal(mockWorkspaceManager.evidenceManager.reports, DIBRUGARH_COMMUNITY_EVIDENCE);
        assert.ok(mockWorkspaceManager.exerciseManager.scenario);
        assert.equal(mockWorkspaceManager.exerciseManager.scenario.id, 'dibrugarh-command-exercise');

        // Restore Clonmel
        bindDibrugarhWorkspaces(mockWorkspaceManager, 'clonmel');
        assert.notEqual(mockWorkspaceManager.infraManager.facilities, DIBRUGARH_INFRASTRUCTURE);
        assert.notEqual(mockWorkspaceManager.evidenceManager.reports, DIBRUGARH_COMMUNITY_EVIDENCE);
        assert.equal(mockWorkspaceManager.exerciseManager.scenario.id, 'clonmel-command-exercise-alpha');
    });

    await t.test('verifies main.js exports bindDibrugarhWorkspaces and workspace handlers', async () => {
        const mainModule = await import('../src/main.js');
        assert.equal(typeof mainModule.bindDibrugarhWorkspaces, 'function');
        assert.equal(typeof mainModule.updateDibrugarhWorkspace, 'function');
        assert.ok(mainModule.DIBRUGARH_INFRASTRUCTURE);
        assert.ok(mainModule.DIBRUGARH_COMMUNITY_EVIDENCE);
        assert.ok(mainModule.DIBRUGARH_COMMAND_EXERCISES);
    });
});
