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
