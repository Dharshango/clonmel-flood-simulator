import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Town Switcher UI Component', async (t) => {
    // Pure unit testing of town switcher state logic and DOM generation
    const {
        createTownSwitcherHTML,
        parseTownFromHash,
        getActiveTown,
        setActiveTown,
        initTownSwitcher
    } = await import('../src/ui/town_switcher.js');

    await t.test('parseTownFromHash correctly parses valid and fallback towns', () => {
        assert.equal(parseTownFromHash('#town=dibrugarh'), 'dibrugarh');
        assert.equal(parseTownFromHash('#town=clonmel'), 'clonmel');
        assert.equal(parseTownFromHash(''), 'clonmel');
        assert.equal(parseTownFromHash('#'), 'clonmel');
        assert.equal(parseTownFromHash('#unknown'), 'clonmel');
        assert.equal(parseTownFromHash('#town=unknown'), 'clonmel');
    });

    await t.test('createTownSwitcherHTML renders expected buttons and labels', () => {
        const html = createTownSwitcherHTML('clonmel');
        assert.ok(html.includes('id="town-btn-clonmel"'), 'Contains Clonmel button');
        assert.ok(html.includes('id="town-btn-dibrugarh"'), 'Contains Dibrugarh button');
        assert.ok(html.includes('Clonmel, Ireland'), 'Contains Clonmel label');
        assert.ok(html.includes('Dibrugarh, Assam'), 'Contains Dibrugarh label');
        assert.ok(html.includes('town-pill-btn active'), 'Clonmel button is active');
    });

    await t.test('getActiveTown and setActiveTown update active town state', () => {
        setActiveTown('dibrugarh');
        assert.equal(getActiveTown(), 'dibrugarh');
        setActiveTown('clonmel');
        assert.equal(getActiveTown(), 'clonmel');
    });

    await t.test('initTownSwitcher binds clicks and triggers onTownChange callback', () => {
        // Mock lightweight DOM environment
        const listeners = {};
        const elements = {};

        function createMockElement(id) {
            const classSet = new Set();
            const el = {
                id,
                innerHTML: '',
                classList: {
                    add: (cls) => classSet.add(cls),
                    remove: (cls) => classSet.delete(cls),
                    contains: (cls) => classSet.has(cls)
                },
                getAttribute: (attr) => (attr === 'data-town-id' ? (id.includes('clonmel') ? 'clonmel' : 'dibrugarh') : null),
                addEventListener: (evt, handler) => {
                    listeners[id + ':' + evt] = handler;
                },
                click: () => {
                    if (listeners[id + ':click']) {
                        listeners[id + ':click']({ preventDefault: () => {} });
                    }
                }
            };
            elements[id] = el;
            return el;
        }

        const container = createMockElement('town-switcher-container');
        elements['town-switcher-container'] = container;
        const btnClonmel = createMockElement('town-btn-clonmel');
        const btnDibrugarh = createMockElement('town-btn-dibrugarh');

        const originalDoc = globalThis.document;
        const originalWin = globalThis.window;

        globalThis.document = {
            getElementById: (id) => elements[id] || null,
            querySelectorAll: (sel) => {
                if (sel === '.town-pill-btn' || sel === '#town-switcher-container .town-pill-btn') {
                    return [btnClonmel, btnDibrugarh];
                }
                return [];
            }
        };
        let hashChangeHandler = null;
        globalThis.window = {
            location: { hash: '#town=clonmel' },
            addEventListener: (evt, handler) => {
                if (evt === 'hashchange') hashChangeHandler = handler;
            }
        };

        try {
            let switchedTown = null;
            initTownSwitcher((townId) => {
                switchedTown = townId;
            });

            assert.equal(getActiveTown(), 'clonmel');

            // Simulate clicking Dibrugarh
            btnDibrugarh.click();
            assert.equal(switchedTown, 'dibrugarh');
            assert.equal(getActiveTown(), 'dibrugarh');
            assert.ok(btnDibrugarh.classList.contains('active'));
            assert.ok(!btnClonmel.classList.contains('active'));

            // Simulate hashchange event back to clonmel
            globalThis.window.location.hash = '#town=clonmel';
            if (hashChangeHandler) {
                hashChangeHandler();
            }
            assert.equal(switchedTown, 'clonmel');
            assert.equal(getActiveTown(), 'clonmel');
            assert.ok(btnClonmel.classList.contains('active'));
            assert.ok(!btnDibrugarh.classList.contains('active'));
        } finally {
            globalThis.document = originalDoc;
            globalThis.window = originalWin;
        }
    });
});
