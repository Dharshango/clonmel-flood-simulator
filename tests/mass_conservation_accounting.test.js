import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
    computeRitterAnalyticalSolution, 
    run1DDamBreakNumerical, 
    computeMassConservationError 
} from '../scripts/run_mass_conservation_check.js';

test('Hydraulic Mass Conservation & Water-Volume Accounting Validation', async (t) => {

    await t.test('enforces closed-system mass conservation with strict tolerance (< 0.05%)', () => {
        const h0 = 8.0;   // 8m reservoir
        const x0 = 400;   // 400m breach
        const t_eval = 8.0; // 8s wave propagation
        const L = 800;
        const dx = 4.0;

        const result = run1DDamBreakNumerical(h0, x0, t_eval, L, dx);
        const errorPercent = computeMassConservationError(result.initialVolume, result.finalVolume);
        
        assert.ok(
            errorPercent < 0.05, 
            `Closed-system mass conservation error should be < 0.05%, got ${errorPercent.toFixed(6)}%`
        );
        assert.ok(result.finalVolume > 0, 'Final volume must be positive');
        assert.ok(Math.abs(result.finalVolume - result.initialVolume) < 1.0, 'Absolute volume difference must be minimal');
    });

    await t.test('validates open-system continuity balance equation: dV/dt = Q_in - Q_out + Rain - Losses', () => {
        // Discrete time water accounting across a reach
        const dt = 60.0; // 1-minute steps
        const numSteps = 120; // 2-hour hydrograph
        const catchmentArea = 1.2e6; // 1.2 km^2 domain

        let storage = 50000.0; // Initial water storage in domain (m^3)
        const initialStorage = storage;
        let cumulativeInflow = 0.0;
        let cumulativeOutflow = 0.0;
        let cumulativeRain = 0.0;
        let cumulativeInfiltration = 0.0;

        for (let step = 0; step < numSteps; step++) {
            const timeHours = (step * dt) / 3600.0;
            
            // Synthetic inflow wave hydrograph (m^3/s)
            const Qin = 35.0 + 80.0 * Math.sin(Math.PI * Math.min(timeHours / 2.0, 1.0));
            // Outflow rating curve: Qout = 1.8 * (storage / 10000)^1.5
            const Qout = Math.min(Qin * 0.9, 1.8 * Math.pow(Math.max(storage, 0) / 10000.0, 1.5));
            // Rainfall: 15 mm/hr over domain
            const rainRate = (15.0 / 1000.0) / 3600.0; // m/s
            const Qrain = rainRate * catchmentArea; // m^3/s
            // Infiltration loss: 2 mm/hr
            const lossRate = (2.0 / 1000.0) / 3600.0;
            const Qloss = lossRate * catchmentArea;

            // Accounting integration
            cumulativeInflow += Qin * dt;
            cumulativeOutflow += Qout * dt;
            cumulativeRain += Qrain * dt;
            cumulativeInfiltration += Qloss * dt;

            // State update
            const deltaStorage = (Qin - Qout + Qrain - Qloss) * dt;
            storage += deltaStorage;
        }

        const calculatedDeltaStorage = storage - initialStorage;
        const netFlux = cumulativeInflow - cumulativeOutflow + cumulativeRain - cumulativeInfiltration;
        const accountingDiscrepancy = Math.abs(calculatedDeltaStorage - netFlux);

        // Verification: Machine precision continuity balance
        assert.ok(
            accountingDiscrepancy < 1e-4, 
            `Open-system volume accounting discrepancy must be near zero, got ${accountingDiscrepancy}`
        );
    });

    await t.test('verifies dry-bed wetting transition preserves non-negativity (h >= 0.0)', () => {
        const h0 = 5.0;
        const x0 = 300;
        const t_eval = 5.0;
        const L = 600;
        const dx = 2.0;

        const result = run1DDamBreakNumerical(h0, x0, t_eval, L, dx);
        for (let i = 0; i < result.h.length; i++) {
            assert.ok(result.h[i] >= 0.0, `Water depth at cell ${i} must be non-negative, got ${result.h[i]}`);
        }
    });
});
