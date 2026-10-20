import numpy as np
import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

os.makedirs('evidence', exist_ok=True)
os.makedirs('tests', exist_ok=True)

def solve_dam_break_numerical(nx=600, length=1000.0, h0=10.0, dam_x=500.0, t_end=15.0, g=9.81, cfl=0.45):
    dx = length / nx
    x = np.linspace(dx/2.0, length - dx/2.0, nx)
    
    # State variables: h (depth), qx (discharge = h * u)
    h = np.zeros(nx, dtype=np.float64)
    h[x <= dam_x] = h0
    h[x > dam_x] = 0.0 # dry bed
    qx = np.zeros(nx, dtype=np.float64)
    
    initial_volume = np.sum(h) * dx
    
    t = 0.0
    step = 0
    
    while t < t_end:
        u = np.where(h > 1e-4, qx / h, 0.0)
        c = np.sqrt(g * np.maximum(h, 0.0))
        max_speed = np.max(np.abs(u) + c)
        dt = cfl * dx / max(max_speed, 1e-4)
        if t + dt > t_end:
            dt = t_end - t
            
        h_pad = np.pad(h, 1, mode='edge')
        qx_pad = np.pad(qx, 1, mode='edge')
        qx_pad[0] = -qx_pad[1]
        qx_pad[-1] = -qx_pad[-2]
        
        h_L, h_R = h_pad[:-1], h_pad[1:]
        qx_L, qx_R = qx_pad[:-1], qx_pad[1:]
        
        u_L = np.where(h_L > 1e-4, qx_L / h_L, 0.0)
        u_R = np.where(h_R > 1e-4, qx_R / h_R, 0.0)
        c_L, c_R = np.sqrt(g * np.maximum(h_L, 0.0)), np.sqrt(g * np.maximum(h_R, 0.0))
        
        # Wet-dry wave speeds
        s_L = np.where((h_L > 1e-4) & (h_R <= 1e-4), u_L - c_L, np.minimum(u_L - c_L, u_R - c_R))
        s_R = np.where((h_L > 1e-4) & (h_R <= 1e-4), u_L + 2.0*c_L, np.maximum(u_L + c_L, u_R + c_R))
        
        F_h_L, F_h_R = qx_L, qx_R
        F_q_L = np.where(h_L > 1e-4, qx_L**2 / h_L + 0.5 * g * h_L**2, 0.0)
        F_q_R = np.where(h_R > 1e-4, qx_R**2 / h_R + 0.5 * g * h_R**2, 0.0)
        
        denom = np.maximum(s_R - s_L, 1e-6)
        F_h = (s_R * F_h_L - s_L * F_h_R + s_L * s_R * (h_R - h_L)) / denom
        F_q = (s_R * F_q_L - s_L * F_q_R + s_L * s_R * (qx_R - qx_L)) / denom
        
        # Solid walls: no mass flux, wall exerts hydrostatic reaction
        F_h[0] = 0.0
        F_h[-1] = 0.0
        F_q[0] = 0.5 * g * h[0]**2
        F_q[-1] = 0.5 * g * h[-1]**2
        
        h = h - (dt / dx) * (F_h[1:] - F_h[:-1])
        qx = qx - (dt / dx) * (F_q[1:] - F_q[:-1])
        h = np.maximum(h, 0.0)
        dry = h < 1e-4
        h[dry] = 0.0
        qx[dry] = 0.0
        
        t += dt
        step += 1
        
    final_volume = np.sum(h) * dx
    volume_error_pct = abs(final_volume - initial_volume) / initial_volume * 100.0
    u_final = np.where(h > 1e-4, qx / h, 0.0)
    
    return x, h, u_final, initial_volume, final_volume, volume_error_pct, t, step

def ritter_analytical(x, dam_x, h0, t, g=9.81):
    c0 = np.sqrt(g * h0)
    x_rel = x - dam_x
    
    h_exact = np.zeros_like(x)
    u_exact = np.zeros_like(x)
    
    # 1. Undisturbed reservoir
    mask1 = x_rel <= -t * c0
    h_exact[mask1] = h0
    u_exact[mask1] = 0.0
    
    # 2. Rarefaction fan
    mask2 = (x_rel > -t * c0) & (x_rel < 2.0 * t * c0)
    term = 2.0 * c0 - x_rel[mask2] / t
    h_exact[mask2] = (1.0 / (9.0 * g)) * (term ** 2)
    u_exact[mask2] = (2.0 / 3.0) * (c0 + x_rel[mask2] / t)
    
    # 3. Dry bed downstream
    mask3 = x_rel >= 2.0 * t * c0
    h_exact[mask3] = 0.0
    u_exact[mask3] = 0.0
    
    return h_exact, u_exact

if __name__ == '__main__':
    print("Running Dam-Break Benchmark...")
    nx = 600
    length = 1000.0
    h0 = 10.0
    dam_x = 500.0
    t_end = 15.0
    g = 9.81

    x, h_num, u_num, v_init, v_final, vol_err, actual_t, steps = solve_dam_break_numerical(
        nx=nx, length=length, h0=h0, dam_x=dam_x, t_end=t_end, g=g
    )

    h_exact, u_exact = ritter_analytical(x, dam_x, h0, actual_t, g=g)

    # Compute error metrics over domain
    rmse_h = np.sqrt(np.mean((h_num - h_exact)**2))
    mae_h = np.mean(np.abs(h_num - h_exact))
    rel_rmse = rmse_h / h0 * 100.0

    print(f"Dam-break test results at t = {actual_t:.2f} s ({steps} steps):")
    print(f"  Initial Volume: {v_init:.4f} m^2")
    print(f"  Final Volume:   {v_final:.4f} m^2")
    print(f"  Mass Conservation Error: {vol_err:.6f}% (Requirement: < 1.0%)")
    print(f"  Depth RMSE:     {rmse_h:.4f} m ({rel_rmse:.2f}% of h0)")
    print(f"  Depth MAE:      {mae_h:.4f} m")

    assert vol_err < 1.0, f"Volume error {vol_err}% exceeds 1.0% limit!"
    assert rel_rmse < 5.0, f"RMSE {rel_rmse}% exceeds tolerance!"
    print(">>> DAM-BREAK AND MASS CONSERVATION TESTS PASSED! <<<")

    results = {
        'test_name': 'Ritter Dam-Break Analytical Comparison',
        'nx': nx,
        'length_m': length,
        'initial_depth_m': h0,
        'dam_location_m': dam_x,
        'time_s': round(actual_t, 3),
        'steps': steps,
        'initial_volume_m3': float(v_init),
        'final_volume_m3': float(v_final),
        'mass_conservation_error_percent': float(vol_err),
        'depth_rmse_m': float(rmse_h),
        'relative_rmse_percent': float(rel_rmse),
        'passed': True
    }

    with open('evidence/dam_break_validation.json', 'w') as f:
        json.dump(results, f, indent=2)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 8), dpi=150, sharex=True)

    ax1.plot(x, h_exact, 'r--', linewidth=2.5, label="Ritter Analytical Solution (Exact)")
    ax1.plot(x, h_num, 'b-', linewidth=1.8, label=f"SWE Numerical Solver (RMSE = {rmse_h:.3f} m, Rel RMSE = {rel_rmse:.2f}%)")
    ax1.axvline(dam_x, color='gray', linestyle=':', label='Dam Breach Location (x=500m)')
    ax1.set_title(f"Dam-Break Benchmark: SWE Finite-Volume Solver vs Ritter Exact Analytical Solution\nDomain = 1000m | t = {actual_t:.1f}s | Mass Error = {vol_err:.6f}% (< 1.0% limit)", fontsize=11, fontweight='bold')
    ax1.set_ylabel("Water Depth h (m)", fontsize=11)
    ax1.grid(True, linestyle='--', alpha=0.5)
    ax1.legend(loc='upper right', fontsize=10)
    ax1.set_ylim(-0.5, 11.0)

    ax2.plot(x, u_exact, 'r--', linewidth=2.5, label="Ritter Exact Velocity u(x,t)")
    ax2.plot(x, u_num, 'g-', linewidth=1.8, label="SWE Numerical Velocity u(x,t)")
    ax2.set_xlabel("Position Along Channel x (m)", fontsize=11)
    ax2.set_ylabel("Flow Velocity u (m/s)", fontsize=11)
    ax2.grid(True, linestyle='--', alpha=0.5)
    ax2.legend(loc='upper left', fontsize=10)
    ax2.set_ylim(-1.0, 22.0)

    plt.tight_layout()
    plt.savefig('evidence/dam_break_benchmark.png')
    plt.close()
    print("Saved evidence/dam_break_benchmark.png and evidence/dam_break_validation.json")
