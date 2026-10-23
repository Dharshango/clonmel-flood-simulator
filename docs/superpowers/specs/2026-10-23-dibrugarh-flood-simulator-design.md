# Engineering Design Specification: Dibrugarh, Assam Flood Simulator & Multi-Town Framework

**Feature:** Standalone Flood Simulator for Dibrugarh, Assam, India on the Brahmaputra River with Town Switcher Framework  
**Date:** 2026-10-23  
**Status:** Approved  
**Location:** Dibrugarh, Assam, India (Brahmaputra River Corridor)  
**Architecture:** Additive, isolated, config-driven multi-town architecture preserving Clonmel 100%

---

## 1. Executive Summary & Problem Statement

Dibrugarh, Assam, situated on the south bank of the mighty Brahmaputra River, faces severe flood hazards stemming from two distinct, interacting physical mechanisms:
1. **Riverine Overtopping / Dyking Vulnerability**: Extreme monsoon discharge in the Brahmaputra River elevating water levels past the official Water Resources Department (WRD) Danger Level (105.70 m MSL) and historic peak (106.48 m MSL recorded 3 September 1998), stressing the Dibrugarh Town Protection (DTP) dyke.
2. **Pluvial Urban Flash Flooding & Drainage Congestion**: Localized extreme cloudburst events (such as the Press Information Bureau documented flood in July 2024), where intense rainfall coincides with high river stages. During such events, river sluice gates are closed to prevent Brahmaputra backflow, trapping urban stormwater inside the city and submerging key commercial and residential areas including Graham Bazaar, AT Road, HS Road, Thana Chariali, RKB Path, Mancotta Road, and Jhalukpara.

The goal of this project is to build an authentic, real-time, physics-based 3D flood simulator for Dibrugarh with interactive scenarios, user-placed interventions (freehand walls, dyke reinforcements, and pump stations), synchronized side-by-side replay, and decision-support readouts across all 10 workspaces.

Crucially, **the existing Clonmel simulation is preserved 100% untouched**. A new **Town Switcher** interface allows seamless navigation between Clonmel, Ireland and Dibrugarh, Assam, India.

---

## 2. Multi-Town Architecture & Town Switcher

### 2.1 Town Configuration Registry (`src/config/towns.js`)
A centralized configuration maps each town to its isolated assets, datums, camera perspectives, and hydrographs:

```javascript
export const TOWNS = {
  clonmel: {
    id: 'clonmel',
    name: 'Clonmel',
    region: 'County Tipperary, Ireland',
    dataPath: '/data/',
    riverName: 'River Suir',
    gauge: {
      name: 'OPW Station 16011',
      datum: 'm OD',
      bankfull: 2.80,
      danger: 3.60
    },
    defaultCamera: { x: 0, y: 350, z: 450, target: [0, 0, 0] },
    studyAreaMeters: { width: 3402, height: 2114 },
    elevationRange: [15.6, 122.0]
  },
  dibrugarh: {
    id: 'dibrugarh',
    name: 'Dibrugarh',
    region: 'Assam, India',
    dataPath: '/data/dibrugarh/',
    riverName: 'Brahmaputra River',
    gauge: {
      name: 'WRD Brahmaputra Gauge',
      datum: 'm MSL',
      dangerLevel: 105.70,
      hfl1998: 106.48,
      normalMonsoon: 104.50
    },
    defaultCamera: { x: 0, y: 400, z: 480, target: [0, 0, 0] },
    studyAreaMeters: { width: 3500, height: 2200 },
    elevationRange: [102.5, 111.0]
  }
};
```

### 2.2 Top Navigation Town Switcher UI
A dedicated segmented control is rendered directly below the workspace tabs inside `#top-nav`:
- `[ Clonmel, Ireland ]`
- `[ Dibrugarh, Assam, India ]`

Selecting a town updates `currentTown`, synchronizes the URL hash (`#town=dibrugarh` / `#town=clonmel`), cleanly unloads previous WebGL textures and Three.js geometry, loads the selected town's assets, and updates telemetry widgets and camera viewpoints.

---

## 3. Geospatial Data Pipeline for Dibrugarh

### 3.1 Study Area Extents
- **Bounding Box**:
  - South: `27.472° N`
  - North: `27.495° N`
  - West: `94.898° E`
  - East: `94.935° E`
- **Geographic Coverage**:
  - Northern boundary: Active channel of the Brahmaputra River.
  - Riverfront: The historic Dibrugarh Town Protection (DTP) Dyke.
  - Urban Localities: Graham Bazaar, AT Road, HS Road, Thana Chariali, RKB Path, Mancotta Road, and Jhalukpara.
  - Southern/Eastern boundary: Internal drainage outfalls and railway corridor.
- **Grid Dimensions**: `600 × 400` cells (\(\Delta x \approx 5.83\,\text{m}\), \(\Delta y \approx 5.50\,\text{m}\)).

### 3.2 Dataset Reconstruction Pipeline (`scripts/build_dibrugarh_data.py`)
1. **Digital Elevation Model (DEM)**:
   - Acquired from AWS Terrarium / Copernicus DEM (global 30 m resolution sampled into 600×400 Float32 grid).
   - Natural ground elevations across the urban core: 104.8 m to 109.5 m MSL.
   - River Suir/Brahmaputra hydro-conditioning:
     - Riverbed carved below 102.5 m MSL.
     - DTP Dyke crest explicitly elevated along the south bank to 107.0 m MSL.
     - Internal natural drainage corridors conditioned for stormwater flow.
   - Outputs: `/data/dibrugarh/elevation_hydro.bin` (960,000 bytes Float32), `/data/dibrugarh/terrain.json`, `/data/dibrugarh/terrain_normal.png`.
2. **OpenStreetMap Vector Geometry**:
   - Direct download via OpenStreetMap API for bounding box `(27.472, 94.898, 27.495, 94.935)`.
   - Building footprints: 2,800+ structures transformed to local grid coordinates with height extrusion (`/data/dibrugarh/buildings.json`).
   - Road network: Categorized into primary highways (AT Road), municipal arterials (HS Road, Mancotta Road, RKB Path), residential roads, and dyke service roads (`/data/dibrugarh/roads.json`).
   - Waterway vectors: Brahmaputra riverfront boundary and drainage channels (`/data/dibrugarh/waterways.json`).
   - Flood defences: DTP Dyke polyline with structural height and sluice gate locations (`/data/dibrugarh/flood_defences.json`).
   - Raster masks: `/data/dibrugarh/buildings_mask.png` and `/data/dibrugarh/river_mask.png`.

---

## 4. Physics-Based Hydrodynamic SWE Simulation

### 4.1 Numerical Formulation
The simulation computes the 2D Shallow Water Equations (SWE) on WebGL2 framebuffers using the well-balanced Kurganov-Petrova central-upwind scheme with dry/wet state tracking and Manning's bottom friction:
- **Depth and Momentum Flux**:
  \[
  \mathbf{U} = \begin{bmatrix} h \\ hu \\ hv \end{bmatrix}, \quad
  \mathbf{F}(\mathbf{U}) = \begin{bmatrix} hu \\ hu^2 + \frac{1}{2}gh^2 \\ huv \end{bmatrix}, \quad
  \mathbf{G}(\mathbf{U}) = \begin{bmatrix} hv \\ huv \\ hv^2 + \frac{1}{2}gh^2 \end{bmatrix}
  \]
- **Bottom Friction**:
  \[
  \tau_{bx} = \frac{g n^2 u \sqrt{u^2 + v^2}}{h^{1/3}}, \quad \tau_{by} = \frac{g n^2 v \sqrt{u^2 + v^2}}{h^{1/3}}
  \]
  Manning's \(n = 0.025\) for Brahmaputra riverbed, \(0.018\) for paved asphalt, \(0.045\) for unpaved floodplains.
- **Mass Conservation**:
  Continuous volume tracking:
  \[
  \text{Mass Balance Error} = \frac{|\Delta V_{\text{sim}} - (V_{\text{in}} + V_{\text{rain}} - V_{\text{out}} - V_{\text{infil}})|}{V_{\text{total}}} \times 100\%
  \]
  Target error under closed-boundary validation test: \(< 1.0\%\).

### 4.2 Local Scenarios & Gauges
1. **Baseline Monsoon Inflow**:
   - Brahmaputra stage: **104.50 m MSL** (Below Danger Level).
   - Inflow discharge: 15,000 m³/s scaled to model boundary.
   - River stays confined in main channel; city streets dry; normal sluice gravity drainage.
2. **July 2024 Urban Flash Flood (Cloudburst & Backwater)**:
   - High river stage: **105.50 m MSL** (0.2 m below DL).
   - Sluice gates closed to prevent Brahmaputra backflow into the city.
   - Localized 3-hour cloudburst: 65 mm/h rainfall.
   - Stormwater pools in natural low-lying areas behind the dyke, submerging Graham Bazaar, AT Road, HS Road, Mancotta Road, and Thana Chariali up to 0.45 m–0.85 m depth.
3. **September 1998 Historic River Flood (Record Peak)**:
   - Brahmaputra stage reaches **106.48 m MSL** (Official HFL, exceeding 105.70 m DL).
   - River overtops lower segments of the DTP dyke.
   - Direct overland river inundation sweeps south into the town core.
4. **Interactive Sliders**:
   - River Stage (103.0 m to 107.5 m MSL).
   - Rainfall Intensity (0 to 100 mm/h).
   - Sluice Gate Outflow toggle / discharge rate.

---

## 5. Flood Barriers, Interventions & Synchronized Replay

### 5.1 Interventions
1. **Freehand Drawing Mode**:
   - Continuous mouse-drag stroke on the 3D terrain to construct custom barriers (walls and sandbags).
   - User-defined height (0.5 m to 3.0 m), thickness (0.5 m to 2.5 m), and material permeability.
2. **DTP Dyke Crest Reinforcement**:
   - One-click structural elevation (+0.8 m) along the northern riverfront to protect against 106.5 m+ river surges.
3. **Municipal Drainage Pump Stations**:
   - Deployable high-capacity axial pumps (5 m³/s to 20 m³/s) at urban drainage outfalls to pump trapped runoff over the dyke into the river during closed-gate rainstorms.

### 5.2 Synchronized Side-by-Side Replay
- Dual-viewport replay running identical rainfall, river stage, and simulation timestep side-by-side:
  - **Left**: Baseline Flood (unprotected).
  - **Right**: Protected Flood (with intervention).
- Real-time differential metrics:
  - Water depth delta (\(\Delta d = d_{\text{baseline}} - d_{\text{protected}}\)).
  - Number of buildings preserved dry (avoiding Yellow \(\ge 0.15\,\text{m}\) and Red \(\ge 0.50\,\text{m}\) danger).
  - Length of road network cut-offs averted.
  - Identification of adverse redirected flooding.

---

## 6. Workspaces Feature Parity for Dibrugarh

All 10 decision-support workspaces fully support Dibrugarh:
1. **Live Map**: Interactive depth inspection, peak depth raster export, danger level flags.
2. **Time Machine**: Historic scrubbing across July 2024 and September 1998 events.
3. **Intervention Lab**: Freehand drawing tool, DTP dyke reinforcement, mobile pumps.
4. **Infrastructure Impact**: Monitored critical infrastructure:
   - Dibrugarh Town Railway Station
   - Graham Bazaar Commercial Hub
   - AT Road Transport Artery
   - Dibrugarh Municipal Board & District Emergency Operations Centre
   - Local power sub-stations
5. **Community Evidence**: Geotagged historical flood markers and ASDMA verification records.
6. **Command Exercise**: Flood contingency drills, breach management, and evacuation routes.
7. **Science & Validation**: Mass conservation telemetry, dam-break verification benchmarks.
8. **Forecast Ops**: Operational stage forecasting telemetry with warning thresholds.
9. **Defence Monitor**: Real-time DTP dyke freeboard calculation against river stage.
10. **Explain Forecast**: Transparent decomposition of river backwater vs pluvial rainfall accumulation.

---

## 7. Verification & Acceptance Criteria

1. **Real Data Integrity**:
   - Real DEM terrain and OSM building footprints load cleanly for Dibrugarh.
   - Side-by-side reference map comparison confirming accurate street geography.
2. **Scientific & Mass Conservation Validation**:
   - Standard dam-break benchmark passes within documented tolerance.
   - Closed-system mass balance error \(< 1.0\%\).
3. **Local Event Evaluation**:
   - Comparison against PIB July 2024 reported localities and 1998 WRD gauge records.
4. **Interactive Controls & Interventions**:
   - Freehand barrier drawing, sliders, and synchronized side-by-side replay execute with identical boundary forcing.
5. **Zero Clonmel Regression**:
   - Clonmel model and data remain 100% intact and functional.
6. **Performance Target**:
   - 60+ FPS at 1920×1080 on RTX 3050 GPU.
7. **Evidence & Critique**:
   - Evidence folder with screenshots, `demo.mp4`, validation report, and three documented critique rounds.
