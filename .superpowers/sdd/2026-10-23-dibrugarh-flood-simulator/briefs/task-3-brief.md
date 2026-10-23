# Task 3 Brief: Town Switcher UI Component & Header Integration

## Task Text from Plan
**Files:**
- Create: `src/ui/town_switcher.js`
- Modify: `index.html` (mount `#town-switcher-container` directly beneath workspace tabs in `#top-nav`)
- Modify: `src/style.css` (add segmented pill switcher styles)
- Test: `tests/town_switcher_ui.test.js`

**Interfaces:**
- Consumes: `TOWNS`, `getTownConfig`, `DEFAULT_TOWN_ID` from `src/config/towns.js`
- Produces: `initTownSwitcher(onTownChange)`, `getActiveTown()`, `setActiveTown(townId)`

## Steps:
1. Write failing UI test `tests/town_switcher_ui.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Town Switcher UI Component', async (t) => {
    // Simple pure unit testing of town switcher state logic and DOM generation
    const { createTownSwitcherHTML, parseTownFromHash, getActiveTown, setActiveTown } = await import('../src/ui/town_switcher.js');

    assert.equal(parseTownFromHash('#town=dibrugarh'), 'dibrugarh');
    assert.equal(parseTownFromHash('#town=clonmel'), 'clonmel');
    assert.equal(parseTownFromHash(''), 'clonmel');

    const html = createTownSwitcherHTML('clonmel');
    assert.ok(html.includes('id="town-btn-clonmel"'), 'Contains Clonmel button');
    assert.ok(html.includes('id="town-btn-dibrugarh"'), 'Contains Dibrugarh button');
    assert.ok(html.includes('Clonmel, Ireland'), 'Contains Clonmel label');
    assert.ok(html.includes('Dibrugarh, Assam'), 'Contains Dibrugarh label');
});
```

2. Run test to verify it fails (`node tests/town_switcher_ui.test.js`).
3. Implement `src/ui/town_switcher.js`:
   - `createTownSwitcherHTML(activeTownId)`
   - `parseTownFromHash(hash)`
   - `initTownSwitcher(onTownChange)`
   - `getActiveTown()`, `setActiveTown(townId)`
4. Update `index.html`:
   - Inside `#top-nav`, add `<div id="town-switcher-container" class="town-switcher-wrap"></div>` right below `<nav class="header-modes center-modes">...</nav>`.
5. Update `src/style.css`:
   - Add `.town-switcher-wrap`, `.town-pill-btn`, `.town-pill-btn.active`, `.town-pill-flag` styles.
6. Run test to verify it passes (`node tests/town_switcher_ui.test.js`).
7. Commit: `git add src/ui/town_switcher.js index.html src/style.css tests/town_switcher_ui.test.js && git commit -m "feat(ui): add glassmorphic Town Switcher pill bar below workspace tabs"`
