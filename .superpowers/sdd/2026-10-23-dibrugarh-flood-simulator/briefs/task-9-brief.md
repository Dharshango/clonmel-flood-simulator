# Task 9 Brief: Performance Measurement, Evidence Folder & Demonstration Video

## Task Text from Plan
**Files:**
- Create: `scripts/verify_dibrugarh_system.js`
- Create: `scripts/record_dibrugarh_demo.js`
- Create: `evidence/DIBRUGARH_VALIDATION_REPORT.md`
- Output Files:
  - `evidence/dibrugarh_terrain_buildings.png`
  - `evidence/dibrugarh_normal_river.png`
  - `evidence/dibrugarh_peak_inundation.png`
  - `evidence/dibrugarh_freehand_wall_drawn.png`
  - `evidence/dibrugarh_side_by_side_replay.png`
  - `evidence/dibrugarh_local_flood_evidence.png`
  - `evidence/dibrugarh_readouts_and_telemetry.png`
  - `evidence/dibrugarh_reference_map_comparison.png`
  - `evidence/demo.mp4`
  - `evidence/DIBRUGARH_VALIDATION_REPORT.md`

## Steps:
1. Implement `scripts/verify_dibrugarh_system.js` using Puppeteer:
   - Launches Chrome with WebGL / GPU acceleration enabled (`--enable-webgl`, `--use-gl=angle`, `--use-angle=d3d11`).
   - Opens `http://127.0.0.1:5173/#town=dibrugarh`.
   - Transitions into 3D simulation.
   - Measures actual FPS (checks `fps-counter` over 60 frames, logs average, min, max).
   - Captures:
     - `evidence/dibrugarh_terrain_buildings.png` (3D buildings in Graham Bazaar, AT Road, HS Road, Mancotta Road)
     - `evidence/dibrugarh_normal_river.png` (Monsoon baseline scenario at 104.5m)
     - `evidence/dibrugarh_peak_inundation.png` (July 2024 / Sept 1998 scenario with red/yellow submerged structures)
     - `evidence/dibrugarh_freehand_wall_drawn.png` (user-drawn barrier along riverfront / Graham Bazaar)
     - `evidence/dibrugarh_side_by_side_replay.png` (synchronized replay comparing baseline vs intervention)
     - `evidence/dibrugarh_local_flood_evidence.png` (Community Evidence workspace with PIB / ASDMA markers)
     - `evidence/dibrugarh_readouts_and_telemetry.png` (HUD gauge readouts, WRD Station 03, click-for-depth)
   - Generates `evidence/dibrugarh_reference_map_comparison.png` comparing the 3D model geometry against OpenStreetMap cartography.

2. Implement `scripts/record_dibrugarh_demo.js`:
   - Connects to browser or records frame sequence of the simulation evolving, camera moving smoothly from Brahmaputra and DTP dyke toward Graham Bazaar/AT Road as flood propagates, freehand barrier being drawn, and side-by-side replay showing protected structures.
   - Converts frames or streams directly to `evidence/demo.mp4` using ffmpeg (or fluent-ffmpeg / image sequence compilation).

3. Write `evidence/DIBRUGARH_VALIDATION_REPORT.md`:
   - Location, bounding box, grid resolution (600×400), DEM source, OSM datasets.
   - Hydrology & WRD Brahmaputra Gauge (DL: 105.70 m, HFL: 106.48 m).
   - Numerical method: Kurganov-Petrova SWE solver, mass conservation error (0.000342%), NRMSE vs Ritter analytical solution (0.855%).
   - Validation against PIB July 2024 and 1998 HFL records.
   - Documented 3 Critique Rounds (issues found and resolutions).
   - Hardware performance measurements (FPS, GPU memory, simulation timestep).

4. Run verification and recording scripts.
5. Verify all evidence files and report exist and are non-empty.
6. Commit:
   `git add scripts/verify_dibrugarh_system.js scripts/record_dibrugarh_demo.js evidence/ && git commit -m "docs(evidence): complete Dibrugarh validation report, performance measurements, and demo recording"`
