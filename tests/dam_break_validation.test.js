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
