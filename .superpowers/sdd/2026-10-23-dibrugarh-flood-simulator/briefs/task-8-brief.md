# Task 8 Brief: Standard Dam-Break Benchmark & Mass Conservation Validation

## Task Text from Plan
**Files:**
- Create: `tests/dam_break_validation.test.js`
- Create: `scripts/run_mass_conservation_check.js`
- Output: `evidence/validation_report.json`

**Interfaces:**
- Consumes: SWE Kurganov-Petrova numerical solver formulation, analytical Ritter solution
- Produces: NRMSE error metric, mass conservation error percentage, `evidence/validation_report.json`

## Steps:
1. Write failing test `tests/dam_break_validation.test.js`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    computeRitterAnalyticalSolution, 
    run1DDamBreakNumerical, 
    computeMassConservationError 
} from '../scripts/run_mass_conservation_check.js';

test('Standard Dam-Break Benchmark & Mass Conservation Validation', async (t) => {
    const h0 = 10.0; // 10m reservoir depth
    const x0 = 500;  // dam location at 500m
    const t_eval = 10.0; // 10 seconds post-failure
    const L = 1000;  // 1000m flume
    const dx = 5.0;  // 5m grid

    await t.test('computes Ritter analytical solution accurately', () => {
        const sol = computeRitterAnalyticalSolution(h0, x0, t_eval, L, dx);
        assert.equal(sol.waveFrontX, x0 + 2 * t_eval * Math.sqrt(9.81 * h0));
        assert.equal(sol.tailX, x0 - t_eval * Math.sqrt(9.81 * h0));
        assert.ok(sol.h.length > 0);
    });

    await t.test('numerical Kurganov-Petrova dam-break matches analytical within reasonable tolerance', () => {
        const analytical = computeRitterAnalyticalSolution(h0, x0, t_eval, L, dx);
        const numerical = run1DDamBreakNumerical(h0, x0, t_eval, L, dx);
        
        // Compute L2 / NRMSE error
        let sqDiffSum = 0;
        let sqRefSum = 0;
        for (let i = 0; i < analytical.h.length; i++) {
            sqDiffSum += (numerical.h[i] - analytical.h[i]) ** 2;
            sqRefSum += analytical.h[i] ** 2;
        }
        const nrmse = Math.sqrt(sqDiffSum / sqRefSum);
        assert.ok(nrmse < 0.15, `NRMSE should be < 15%, was ${nrmse}`);
    });

    await t.test('enforces closed-system mass conservation error < 1.0%', () => {
        const numerical = run1DDamBreakNumerical(h0, x0, t_eval, L, dx);
        const err = computeMassConservationError(numerical.initialVolume, numerical.finalVolume);
        assert.ok(err < 1.0, `Mass conservation error must be < 1.0%, was ${err}%`);
    });
});
```

2. Run test to verify: `node tests/dam_break_validation.test.js`

3. Create `scripts/run_mass_conservation_check.js`:
   - Implement `computeRitterAnalyticalSolution(h0, x0, t, L, dx)`.
   - Implement `run1DDamBreakNumerical(h0, x0, t_eval, L, dx)` using the second-order Kurganov-Petrova central upwind scheme with minmod slope limiter and forward Euler / RK2 time integration.
   - Implement `computeMassConservationError(v0, v1)`.
   - When run as a script (`node scripts/run_mass_conservation_check.js`), compute the error metrics, display the validation table, and save results to `evidence/validation_report.json`.

4. Execute `node scripts/run_mass_conservation_check.js` and verify output.

5. Run test suite:
   `node tests/dam_break_validation.test.js`
   `node --test tests/*.test.js`

6. Commit:
   `git add scripts/run_mass_conservation_check.js tests/dam_break_validation.test.js evidence/validation_report.json && git commit -m "test(validation): add analytical dam-break benchmark and mass conservation test"`
