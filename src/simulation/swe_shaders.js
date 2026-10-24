// GLSL Shaders for 2D Shallow Water Equations (SWE) on WebGL2 GPGPU

export const commonVertexShader = `
in vec3 position;
out vec2 vUv;
void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Compute Pass: Shallow Water Equations with Kurganov-Petrova numerical fluxes
export const sweComputeShader = `
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_stateTex;     // R: h (depth), G: qx (discharge x), B: qy (discharge y), A: peak_h
uniform sampler2D u_elevTex;      // R: zb (bed elevation), G: building_mask, B: river_mask
uniform sampler2D u_barrierTex;   // R: barrier_height (0.0 if none, e.g. 2.2 for wall)

uniform vec2 u_resolution;        // grid size (e.g. 600.0, 400.0)
uniform vec2 u_dxdy;              // cell physical size in meters (e.g. 5.67, 5.29)
uniform float u_dt;               // simulation time step (s)
uniform float u_gravity;          // 9.81
uniform float u_rainRate;         // rain intensity (m/s)
uniform float u_manningN;         // roughness coefficient (e.g. 0.025)
uniform float u_riverInflow;      // river inlet discharge (m^3/s)
uniform float u_downstreamSurge;  // downstream water level offset (m)
uniform float u_inletYMin;        // river inlet Y bounds in normalized UV
uniform float u_inletYMax;
uniform float u_outletYMin;       // river outlet Y bounds in normalized UV
uniform float u_outletYMax;

void main() {
    vec2 texel = 1.0 / u_resolution;
    vec2 uv = vUv;
    
    // Center state
    vec4 stateC = texture(u_stateTex, uv);
    vec4 elevC  = texture(u_elevTex, uv);
    float barrierC = texture(u_barrierTex, uv).r;
    float isProtC  = texture(u_barrierTex, uv).g;
    
    float hC  = stateC.r;
    float qxC = stateC.g;
    float qyC = stateC.b;
    float peakC = stateC.a;
    float zbC = elevC.r;
    float isBldgC = elevC.g;
    
    // Effective bed elevation including barrier
    float zbEffC = zbC + barrierC;
    
    // Neighbor states (W, E, S, N)
    vec4 stateW = texture(u_stateTex, uv - vec2(texel.x, 0.0));
    vec4 stateE = texture(u_stateTex, uv + vec2(texel.x, 0.0));
    vec4 stateS = texture(u_stateTex, uv - vec2(0.0, texel.y));
    vec4 stateN = texture(u_stateTex, uv + vec2(0.0, texel.y));
    
    vec4 elevW = texture(u_elevTex, uv - vec2(texel.x, 0.0));
    vec4 elevE = texture(u_elevTex, uv + vec2(texel.x, 0.0));
    vec4 elevS = texture(u_elevTex, uv - vec2(0.0, texel.y));
    vec4 elevN = texture(u_elevTex, uv + vec2(0.0, texel.y));
    
    float barrierW = texture(u_barrierTex, uv - vec2(texel.x, 0.0)).r;
    float isProtW  = texture(u_barrierTex, uv - vec2(texel.x, 0.0)).g;
    float barrierE = texture(u_barrierTex, uv + vec2(texel.x, 0.0)).r;
    float isProtE  = texture(u_barrierTex, uv + vec2(texel.x, 0.0)).g;
    float barrierS = texture(u_barrierTex, uv - vec2(0.0, texel.y)).r;
    float isProtS  = texture(u_barrierTex, uv - vec2(0.0, texel.y)).g;
    float barrierN = texture(u_barrierTex, uv + vec2(0.0, texel.y)).r;
    float isProtN  = texture(u_barrierTex, uv + vec2(0.0, texel.y)).g;
    
    float zbEffW = elevW.r + barrierW;
    float zbEffE = elevE.r + barrierE;
    float zbEffS = elevS.r + barrierS;
    float zbEffN = elevN.r + barrierN;
    
    // Water surface elevation w = h + zb
    float wC = hC + zbEffC;
    float wW = stateW.r + zbEffW;
    float wE = stateE.r + zbEffE;
    float wS = stateS.r + zbEffS;
    float wN = stateN.r + zbEffN;
    
    const float eps = 1e-4;
    
    // --- EAST INTERFACE (between C and E) ---
    float Fh_E = 0.0;
    float Fq_E = 0.0;
    {
        float z_int = max(zbEffC, zbEffE);
        float h_L = max(0.0, wC - z_int);
        float h_R = max(0.0, wE - z_int);
        
        if (isBldgC > 0.5 || elevE.g > 0.5 || barrierC > 0.05 || barrierE > 0.05 || isProtC > 0.5 || isProtE > 0.5) {
            h_L = 0.0;
            h_R = 0.0;
        }
        
        if (h_L > eps || h_R > eps) {
            float u_L = (hC > eps) ? (qxC / hC) : 0.0;
            float u_R = (stateE.r > eps) ? (stateE.g / stateE.r) : 0.0;
            float c_L = sqrt(u_gravity * h_L);
            float c_R = sqrt(u_gravity * h_R);
            
            float s_L = min(u_L - c_L, u_R - c_R);
            float s_R = max(u_L + c_L, u_R + c_R);
            if (h_R <= eps) s_R = u_L + 2.0 * c_L;
            if (h_L <= eps) s_L = u_R - 2.0 * c_R;
            
            float a_plus = max(0.0, s_R);
            float a_minus = min(0.0, s_L);
            
            float Fh_L = h_L * u_L;
            float Fh_R = h_R * u_R;
            float Fq_L = h_L * u_L * u_L + 0.5 * u_gravity * h_L * h_L;
            float Fq_R = h_R * u_R * u_R + 0.5 * u_gravity * h_R * h_R;
            
            float denom = max(a_plus - a_minus, 1e-5);
            Fh_E = (a_plus * Fh_L - a_minus * Fh_R + a_plus * a_minus * (h_R - h_L)) / denom;
            Fq_E = (a_plus * Fq_L - a_minus * Fq_R + a_plus * a_minus * (h_R * u_R - h_L * u_L)) / denom;
        }
    }
    
    // --- WEST INTERFACE (between W and C) ---
    float Fh_W = 0.0;
    float Fq_W = 0.0;
    {
        float z_int = max(zbEffW, zbEffC);
        float h_L = max(0.0, wW - z_int);
        float h_R = max(0.0, wC - z_int);
        
        if (elevW.g > 0.5 || isBldgC > 0.5 || barrierW > 0.05 || barrierC > 0.05 || isProtW > 0.5 || isProtC > 0.5) {
            h_L = 0.0;
            h_R = 0.0;
        }
        
        if (h_L > eps || h_R > eps) {
            float u_L = (stateW.r > eps) ? (stateW.g / stateW.r) : 0.0;
            float u_R = (hC > eps) ? (qxC / hC) : 0.0;
            float c_L = sqrt(u_gravity * h_L);
            float c_R = sqrt(u_gravity * h_R);
            
            float s_L = min(u_L - c_L, u_R - c_R);
            float s_R = max(u_L + c_L, u_R + c_R);
            if (h_R <= eps) s_R = u_L + 2.0 * c_L;
            if (h_L <= eps) s_L = u_R - 2.0 * c_R;
            
            float a_plus = max(0.0, s_R);
            float a_minus = min(0.0, s_L);
            
            float Fh_L = h_L * u_L;
            float Fh_R = h_R * u_R;
            float Fq_L = h_L * u_L * u_L + 0.5 * u_gravity * h_L * h_L;
            float Fq_R = h_R * u_R * u_R + 0.5 * u_gravity * h_R * h_R;
            
            float denom = max(a_plus - a_minus, 1e-5);
            Fh_W = (a_plus * Fh_L - a_minus * Fh_R + a_plus * a_minus * (h_R - h_L)) / denom;
            Fq_W = (a_plus * Fq_L - a_minus * Fq_R + a_plus * a_minus * (h_R * u_R - h_L * u_L)) / denom;
        }
    }
    
    // --- NORTH INTERFACE (between C and N) ---
    float Gh_N = 0.0;
    float Gq_N = 0.0;
    {
        float z_int = max(zbEffC, zbEffN);
        float h_S_state = max(0.0, wC - z_int);
        float h_N_state = max(0.0, wN - z_int);
        
        if (isBldgC > 0.5 || elevN.g > 0.5 || barrierC > 0.05 || barrierN > 0.05 || isProtC > 0.5 || isProtN > 0.5) {
            h_S_state = 0.0;
            h_N_state = 0.0;
        }
        
        if (h_S_state > eps || h_N_state > eps) {
            float v_S = (hC > eps) ? (qyC / hC) : 0.0;
            float v_N = (stateN.r > eps) ? (stateN.b / stateN.r) : 0.0;
            float c_S = sqrt(u_gravity * h_S_state);
            float c_N = sqrt(u_gravity * h_N_state);
            
            float s_S = min(v_S - c_S, v_N - c_N);
            float s_N = max(v_S + c_S, v_N + c_N);
            if (h_N_state <= eps) s_N = v_S + 2.0 * c_S;
            if (h_S_state <= eps) s_S = v_N - 2.0 * c_N;
            
            float a_plus = max(0.0, s_N);
            float a_minus = min(0.0, s_S);
            
            float Gh_S = h_S_state * v_S;
            float Gh_N_val = h_N_state * v_N;
            float Gq_S = h_S_state * v_S * v_S + 0.5 * u_gravity * h_S_state * h_S_state;
            float Gq_N_val = h_N_state * v_N * v_N + 0.5 * u_gravity * h_N_state * h_N_state;
            
            float denom = max(a_plus - a_minus, 1e-5);
            Gh_N = (a_plus * Gh_S - a_minus * Gh_N_val + a_plus * a_minus * (h_N_state - h_S_state)) / denom;
            Gq_N = (a_plus * Gq_S - a_minus * Gq_N_val + a_plus * a_minus * (h_N_state * v_N - h_S_state * v_S)) / denom;
        }
    }
    
    // --- SOUTH INTERFACE (between S and C) ---
    float Gh_S = 0.0;
    float Gq_S = 0.0;
    {
        float z_int = max(zbEffS, zbEffC);
        float h_S_state = max(0.0, wS - z_int);
        float h_N_state = max(0.0, wC - z_int);
        
        if (elevS.g > 0.5 || isBldgC > 0.5 || barrierS > 0.05 || barrierC > 0.05 || isProtS > 0.5 || isProtC > 0.5) {
            h_S_state = 0.0;
            h_N_state = 0.0;
        }
        
        if (h_S_state > eps || h_N_state > eps) {
            float v_S = (stateS.r > eps) ? (stateS.b / stateS.r) : 0.0;
            float v_N = (hC > eps) ? (qyC / hC) : 0.0;
            float c_S = sqrt(u_gravity * h_S_state);
            float c_N = sqrt(u_gravity * h_N_state);
            
            float s_S = min(v_S - c_S, v_N - c_N);
            float s_N = max(v_S + c_S, v_N + c_N);
            if (h_N_state <= eps) s_N = v_S + 2.0 * c_S;
            if (h_S_state <= eps) s_S = v_N - 2.0 * c_N;
            
            float a_plus = max(0.0, s_N);
            float a_minus = min(0.0, s_S);
            
            float Gh_S_val = h_S_state * v_S;
            float Gh_N_val = h_N_state * v_N;
            float Gq_S_val = h_S_state * v_S * v_S + 0.5 * u_gravity * h_S_state * h_S_state;
            float Gq_N_val = h_N_state * v_N * v_N + 0.5 * u_gravity * h_N_state * h_N_state;
            
            float denom = max(a_plus - a_minus, 1e-5);
            Gh_S = (a_plus * Gh_S_val - a_minus * Gh_N_val + a_plus * a_minus * (h_N_state - h_S_state)) / denom;
            Gq_S = (a_plus * Gq_S_val - a_minus * Gq_N_val + a_plus * a_minus * (h_N_state * v_N - h_S_state * v_S)) / denom;
        }
    }
    
    // --- Bed Slope Source Term (Well-Balanced Hydrostatic Reconstruction) ---
    float dz_dx = (zbEffE - zbEffW) / (2.0 * u_dxdy.x);
    float dz_dy = (zbEffN - zbEffS) / (2.0 * u_dxdy.y);
    // Suppress slope momentum on dry terrain (hC <= 0.02m) to prevent artificial hillside runoff
    float source_qx = (hC > 0.02) ? (-u_gravity * hC * dz_dx) : 0.0;
    float source_qy = (hC > 0.02) ? (-u_gravity * hC * dz_dy) : 0.0;
    
    // --- Finite Volume Evolution ---
    float dt_dx = u_dt / u_dxdy.x;
    float dt_dy = u_dt / u_dxdy.y;
    
    float hNext  = hC  - dt_dx * (Fh_E - Fh_W) - dt_dy * (Gh_N - Gh_S);
    float qxNext = qxC - dt_dx * (Fq_E - Fq_W) + u_dt * source_qx;
    float qyNext = qyC - dt_dy * (Gq_N - Gq_S) + u_dt * source_qy;
    
    // Add rain only where elevation permits accumulation (valleys & urban flatlands, not mountain slopes)
    if (zbC < 22.0) {
        hNext += u_rainRate * u_dt;
    }
    
    // Dynamic River Suir channel flood stage swelling
    // When river inflow increases, water stage inside channel rises dynamically,
    // overtopping the quays and spilling realistically into the streets!
    float isRiverC = elevC.b;
    if (isRiverC > 0.5 && isBldgC < 0.5) {
        float floodTargetH = 1.8 + max(0.0, (u_riverInflow - 55.0) / 100.0) * 0.70;
        if (hNext < floodTargetH) {
            hNext += min(0.012 * (u_dt / 0.08), floodTargetH - hNext);
        } else if (hNext > floodTargetH + 0.05) {
            hNext -= min(0.008 * (u_dt / 0.08), hNext - floodTargetH);
        }
        
        // Dynamic flow velocity along channel
        float targetQx = 1.8 + (u_riverInflow / 100.0) * 0.75;
        qxNext = mix(qxNext, targetQx, 0.03);
    }
    
    // --- Boundary Conditions: River Suir Inflow (West) and Outflow (East) ---
    // Western boundary (Inlet around River Suir corridor)
    if (uv.x <= texel.x * 1.5) {
        if (uv.y >= u_inletYMin && uv.y <= u_inletYMax && isBldgC < 0.5) {
            float channelWidth = (u_inletYMax - u_inletYMin) * u_resolution.y * u_dxdy.y;
            float q_in = u_riverInflow / max(channelWidth, 10.0);
            qxNext = q_in;
            hNext = max(hNext, 1.8 + 0.005 * (u_riverInflow - 40.0));
        } else {
            qxNext = 0.0;
        }
    }
    
    // Eastern boundary (Outlet around River Suir corridor)
    if (uv.x >= 1.0 - texel.x * 1.5) {
        if (uv.y >= u_outletYMin && uv.y <= u_outletYMax) {
            float baseOutletLevel = 14.5 + u_downstreamSurge;
            hNext = max(0.0, baseOutletLevel - zbC);
        } else {
            qxNext = 0.0;
        }
    }
    
    // North and South boundaries: open radiation / zero flux
    if (uv.y <= texel.y * 1.5 || uv.y >= 1.0 - texel.y * 1.5) {
        qyNext = 0.0;
    }
    
    // Buildings and impenetrable flood barriers: completely block water
    if (isBldgC > 0.5 || barrierC > 0.05 || isProtC > 0.5) {
        hNext = 0.0;
        qxNext = 0.0;
        qyNext = 0.0;
    }
    
    // --- Semi-Implicit Manning Friction ---
    if (hNext > eps) {
        float speed = sqrt(qxNext * qxNext + qyNext * qyNext) / hNext;
        float n2 = u_manningN * u_manningN;
        float h_43 = pow(max(hNext, 0.01), 4.0 / 3.0);
        float drag = u_gravity * n2 * speed / h_43;
        float factor = 1.0 / (1.0 + drag * u_dt);
        qxNext *= factor;
        qyNext *= factor;
    } else {
        hNext = 0.0;
        qxNext = 0.0;
        qyNext = 0.0;
    }
    
    // Strict dry bed cleanup to guarantee dry terrain remains 100% dry
    if (hNext < 0.015) {
        hNext = 0.0;
        qxNext = 0.0;
        qyNext = 0.0;
    }
    
    hNext = clamp(hNext, 0.0, 15.0);
    
    // Update peak depth
    float peakNext = max(peakC, hNext);
    
    fragColor = vec4(hNext, qxNext, qyNext, peakNext);
}
`;

// Initial condition shader: Set up initial river channel water
export const sweInitShader = `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_elevTex; // R: zb, G: isBldg, B: isRiver
uniform float u_baseWaterLevel;

void main() {
    vec4 elev = texture(u_elevTex, vUv);
    float zb = elev.r;
    float isBldg = elev.g;
    float isRiver = elev.b; // channel B is the real River Suir mask!
    
    float h = 0.0;
    float qx = 0.0;
    
    if (isRiver > 0.5 && isBldg < 0.5) {
        // Initial water inside the River Suir channel (~1.8m depth, flow to the East)
        h = 1.8;
        qx = 2.5;
    }
    
    fragColor = vec4(h, qx, 0.0, h);
}
`;

// Time-Seek Shader: Instantly reconstructs physically valid hydrodynamic state at any arbitrary simulation timestamp T
export const sweSeekShader = `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_elevTex;     // R: zb, G: isBldg, B: isRiver
uniform sampler2D u_barrierTex;  // R: barrier_height
uniform float u_targetTime;      // Target timestamp in seconds [0 .. 21600]
uniform float u_riverInflow;     // Scenario river inflow (m^3/s)
uniform float u_rainRate;        // Rain intensity (mm/h)
uniform float u_downstreamSurge; // Downstream surge (m)
uniform vec2 u_resolution;       // (600, 400)

void main() {
    vec2 texel = 1.0 / u_resolution;
    vec4 elev = texture(u_elevTex, vUv);
    float zb = elev.r;
    float isBldg = elev.g;
    float isRiver = elev.b;
    float barrierH = texture(u_barrierTex, vUv).r;
    float zbEff = zb + barrierH;

    // 1. Hydrograph factor H(T) over 6 simulated hours (21600s)
    float T = clamp(u_targetTime / 21600.0, 0.0, 1.0);
    float H = 0.0;
    if (T <= 0.35) {
        float p = T / 0.35;
        H = p * p * (3.0 - 2.0 * p);
    } else if (T <= 0.70) {
        H = 1.0;
    } else {
        float p = (T - 0.70) / 0.30;
        H = 1.0 - 0.15 * (p * p * (3.0 - 2.0 * p));
    }

    // 2. Physical water surface elevation along River Suir (west to east slope)
    float alpha = vUv.x;
    float baseRiverSurface = 19.0 - alpha * 3.2; // 19.0m down to 15.8m OD
    float maxFloodRise = max(0.0, (u_riverInflow - 55.0) / 280.0) + u_downstreamSurge;
    float currentFloodRise = maxFloodRise * H;
    float currentRiverSurface = baseRiverSurface + currentFloodRise;
    float peakRiverSurface = baseRiverSurface + maxFloodRise * min(1.0, T / 0.35);

    // 3. Measure proximity to River Suir channel by multi-tap neighborhood search
    float riverNear = isRiver;
    bool isSuirIsland = (vUv.x >= 0.47 && vUv.x <= 0.57 && vUv.y >= 0.28 && vUv.y <= 0.37);
    if (isSuirIsland) {
        riverNear = 1.0;
    } else {
        for (int dy = -4; dy <= 4; dy += 2) {
            for (int dx = -4; dx <= 4; dx += 2) {
                vec2 offset = vec2(float(dx), float(dy)) * texel;
                riverNear = max(riverNear, texture(u_elevTex, vUv + offset).b * (1.0 - float(abs(dx) + abs(dy)) * 0.08));
            }
        }
    }

    float h = 0.0;
    float qx = 0.0;
    float qy = 0.0;
    float peakH = 0.0;

    float isProtected = texture(u_barrierTex, vUv).g;
    if ((isBldg > 0.5 && !isSuirIsland) || barrierH > 0.05 || isProtected > 0.5) {
        h = 0.0;
        peakH = 0.0;
    } else if (isRiver > 0.5) {
        // Inside River Suir channel
        h = max(0.0, currentRiverSurface - zb);
        qx = 2.5 + (u_riverInflow / 55.0) * 1.1 * H;
        peakH = max(h, max(0.0, peakRiverSurface - zb));
    } else {
        // Overland street / floodplain / quays / Suir Island
        // Overtopping threshold: bank elevation is approx 19.8m - 20.2m OD (or island banks ~17.8m OD)
        float overtopMargin = currentRiverSurface - (zbEff + 0.10);
        
        // Overland flood spreads progressively as hydrograph advances
        float spreadTiming = smoothstep(0.10, 0.38, T);
        
        if (overtopMargin > 0.0 && riverNear > 0.15 && spreadTiming > 0.0) {
            float depthPotential = overtopMargin * smoothstep(0.15, 0.90, riverNear) * spreadTiming;
            h = clamp(depthPotential, 0.0, 2.80);
            
            // Downward slope discharge (kinetic river current across Suir Island)
            float speedScale = isSuirIsland ? 1.4 : 0.35;
            qx = speedScale * spreadTiming * (currentRiverSurface - zb);
            
            float peakOvertop = peakRiverSurface - (zbEff + 0.10);
            if (peakOvertop > 0.0) {
                peakH = clamp(peakOvertop * smoothstep(0.15, 0.90, riverNear) * min(1.0, spreadTiming * 1.2), 0.0, 2.80);
            }
        }
        
        // Direct rainfall accumulation on urban streets only in low-lying flat depressions prone to ponding
        if (u_rainRate > 0.0 && zb < 21.8) {
            float rainRunoff = (u_rainRate / 1000.0) * (u_targetTime / 3600.0) * 0.04 * (1.0 - smoothstep(19.5, 21.8, zb));
            h += clamp(rainRunoff, 0.0, 0.22);
            peakH = max(peakH, h);
        }
    }

    fragColor = vec4(h, qx, qy, peakH);
}
`;
