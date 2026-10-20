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
    float barrierE = texture(u_barrierTex, uv + vec2(texel.x, 0.0)).r;
    float barrierS = texture(u_barrierTex, uv - vec2(0.0, texel.y)).r;
    float barrierN = texture(u_barrierTex, uv + vec2(0.0, texel.y)).r;
    
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
        
        if (isBldgC > 0.5 || elevE.g > 0.5) {
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
        
        if (elevW.g > 0.5 || isBldgC > 0.5) {
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
        
        if (isBldgC > 0.5 || elevN.g > 0.5) {
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
        
        if (elevS.g > 0.5 || isBldgC > 0.5) {
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
    float source_qx = -u_gravity * hC * dz_dx;
    float source_qy = -u_gravity * hC * dz_dy;
    
    // --- Finite Volume Evolution ---
    float dt_dx = u_dt / u_dxdy.x;
    float dt_dy = u_dt / u_dxdy.y;
    
    float hNext  = hC  - dt_dx * (Fh_E - Fh_W) - dt_dy * (Gh_N - Gh_S);
    float qxNext = qxC - dt_dx * (Fq_E - Fq_W) + u_dt * source_qx;
    float qyNext = qyC - dt_dy * (Gq_N - Gq_S) + u_dt * source_qy;
    
    // Add uniform rain
    hNext += u_rainRate * u_dt;
    
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
    
    // Buildings: completely block water
    if (isBldgC > 0.5) {
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
