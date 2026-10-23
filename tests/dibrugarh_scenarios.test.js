import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    DIBRUGARH_SCENARIOS,
    applyDibrugarhScenario,
    getDibrugarhGaugeStatus,
    DIBRUGARH_SLIDER_LIMITS
} from '../src/simulation/dibrugarh_scenarios.js';

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

    await t.test('evaluates gauge status according to WRD Assam datums', () => {
        assert.equal(getDibrugarhGaugeStatus(104.20), 'NORMAL FLOW');
        assert.equal(getDibrugarhGaugeStatus(105.20), 'HIGH FLOW');
        assert.equal(getDibrugarhGaugeStatus(105.80), 'DANGER LEVEL EXCEEDED');
        assert.equal(getDibrugarhGaugeStatus(106.50), 'HISTORIC PEAK OVERTOPPING');
    });

    await t.test('enforces Dibrugarh slider boundary limits (103.0m to 107.5m MSL)', () => {
        assert.ok(DIBRUGARH_SLIDER_LIMITS);
        assert.equal(DIBRUGARH_SLIDER_LIMITS.stageMin, 103.0);
        assert.equal(DIBRUGARH_SLIDER_LIMITS.stageMax, 107.5);
    });

    await t.test('updates hudState when applying scenario', () => {
        const mockHudState = {
            sliderInflow: { value: 0 },
            valInflow: { textContent: '' },
            sliderRain: { value: 0 },
            valRain: { textContent: '' },
            sliderSurge: { value: 0 },
            valSurge: { textContent: '' },
            activeScenarioTag: { textContent: '' }
        };
        applyDibrugarhScenario('sept-1998-record', null, mockHudState);
        assert.equal(mockHudState.sliderInflow.value, 106.48);
        assert.equal(mockHudState.valInflow.textContent, '106.48 m MSL');
        assert.equal(mockHudState.sliderRain.value, 35);
        assert.equal(mockHudState.valRain.textContent, '35 mm/h');
        assert.equal(mockHudState.sliderSurge.value, 1.5);
        assert.equal(mockHudState.valSurge.textContent, '+1.50 m');
        assert.ok(mockHudState.activeScenarioTag.textContent.includes('1998'));
    });
});
