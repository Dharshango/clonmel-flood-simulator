# HydroVerse Geospatial Data Provenance & Manifest

**Standard:** Open Geospatial Consortium (OGC) Metadata Standards & FAIR Principles  
**Version:** 1.0.0 Production  
**Scope:** Clonmel (Ireland) and Dibrugarh (Assam, India) Hydrologic Datasets  

---

## 1. Data Governance Principles

HydroVerse enforces strict geographic isolation and data traceability:
1. **Zero Cross-Contamination**: Datasets for Clonmel and Dibrugarh reside in isolated directory structures (`public/data/` vs `public/data/dibrugarh/`) and use independent coordinate transformations and vertical datums.
2. **Attribution & Licensing**: All geospatial assets are sourced from open government bodies or OpenStreetMap contributors under permissive open licenses (ODbL, CC-BY, Open Government Licence).
3. **Hydro-Conditioning Integrity**: Raw digital elevation models (DEMs) are conditioned with burn-in river bathymetry and enforced flood defenses to prevent spurious overland pooling.

---

## 2. Location 1: Clonmel, County Tipperary, Ireland

### 2.1 Geographic Extent & Coordinate Systems
- **Catchment**: River Suir Basin
- **Bounding Box (WGS 84 / EPSG:4326)**:
  - Latitude: $52.3450^\circ\,\text{N}$ to $52.3640^\circ\,\text{N}$
  - Longitude: $-7.7280^\circ\,\text{W}$ to $-7.6840^\circ\,\text{W}$
- **Vertical Datum**: Malin Head Ordnance Datum (Poolbeg Malin OD)
- **Local Grid Coordinate System**: Irish Transverse Mercator (ITM / EPSG:2157) projected to normalized Cartesian meters centered at $(0, 0)$.

### 2.2 Elevation & Bathymetry Data
- **Source**: Copernicus DEM GLO-30 (European Space Agency) augmented by Office of Public Works (OPW) Ireland LiDAR tiles where available.
- **File**: `public/data/elevation_hydro.bin` / `elevation.bin`
- **Resolution**: $400 \times 300$ grid cells (~7.5m horizontal spacing).
- **Format**: IEEE 754 32-bit Floating Point binary raster (960,000 bytes).
- **Hydro-Conditioning**:
  - River Suir bed carved along centerline between 14.5 m and 18.2 m OD Malin.
  - Clonmel Flood Relief Scheme (FRS) quay walls enforced along The Quay and Suir Island up to 21.4 m OD.

### 2.3 Vector Infrastructure & Buildings
- **Source**: OpenStreetMap (OSM) Contributors under the Open Database License (ODbL).
- **Files**: `public/data/buildings.json`, `public/data/roads.json`, `public/data/waterways.json`
- **Counts**:
  - Building Footprints: **6,638** polygons with height, use classification, and footprint area.
  - Road Segments: **2,067** line strings categorized by highway type (primary, secondary, residential).
  - Waterways: River Suir main channel, Old Bridge mill races, and Suir Island secondary branches.

### 2.4 Hydrometric Telemetry & Defenses
- **Primary River Gauge**: OPW Station 16011 at Clonmel Old Bridge.
  - Normal Flow: $15 - 45\,\text{m}^3/\text{s}$ (Stage $0.8 - 1.4\,\text{m}$)
  - Bankfull Capacity: $180\,\text{m}^3/\text{s}$ (Stage $2.85\,\text{m}$)
  - Peak Historic (Storm Frank, Dec 2015): $420\,\text{m}^3/\text{s}$ (Stage $4.15\,\text{m}$ OD Malin)
- **Flood Defenses**: 12 monitored assets documented in `public/data/flood_defences.json` (North Quay Wall, Convent Wall, Denis Burke Embankment, Old Bridge Demountables).

---

## 3. Location 2: Dibrugarh, Assam, India

### 3.1 Geographic Extent & Coordinate Systems
- **Catchment**: Brahmaputra River Basin (Upper Assam Plains)
- **Bounding Box (WGS 84 / EPSG:4326)**:
  - Latitude: $27.4720^\circ\,\text{N}$ to $27.4950^\circ\,\text{N}$
  - Longitude: $94.8980^\circ\,\text{E}$ to $94.9350^\circ\,\text{E}$
- **Vertical Datum**: Meters Above Mean Sea Level (m MSL / Survey of India).
- **Local Grid Coordinate System**: Universal Transverse Mercator (UTM Zone 46N / EPSG:32646) projected to normalized Cartesian meters.

### 3.2 Elevation & Bathymetry Data
- **Source**: SRTM 30m Digital Elevation Model hydro-corrected with Indian Central Water Commission (CWC) cross-sections and local surveyor benchmarks.
- **File**: `public/data/dibrugarh/elevation_hydro.bin`
- **Resolution**: $400 \times 300$ grid cells (~8.0m horizontal spacing).
- **Format**: IEEE 754 32-bit Floating Point binary raster (960,000 bytes).
- **Elevation Range**: $100.5\,\text{m}$ (Brahmaputra low-water bed) to $108.5\,\text{m}$ MSL (Town ridge).
- **Hydro-Conditioning**:
  - Brahmaputra river channel hydro-enforced at the northern boundary.
  - Dibrugarh Town Protection (DTP) Dyke crest elevation rigidly enforced at **107.00 m MSL** along the riverfront, providing a verified 1.30 m freeboard over the official Danger Level.

### 3.3 Vector Infrastructure & Buildings
- **Source**: OpenStreetMap (OSM) Contributors and Assam State Disaster Management Authority (ASDMA) open GIS layers.
- **Files**: `public/data/dibrugarh/buildings.json`, `public/data/dibrugarh/roads.json`, `public/data/dibrugarh/defences.json`
- **Counts**:
  - Building Footprints: **2,465** structures including Dibrugarh Railway Station, Assam Medical College & Hospital (AMCH), DC Office, Municipal Board.
  - Road Corridors: **391** network segments including AT Road, Mancotta Road, and Dyke Road.
  - Critical Facilities: 8 high-priority municipal assets with monitored inundation vulnerability.

### 3.4 Hydrometric Telemetry & Defenses
- **Primary River Gauge**: Central Water Commission (CWC) / Water Resources Department (WRD) Assam Gauge at Dibrugarh Ghat.
  - Warning Level (WL): **104.70 m MSL**
  - Danger Level (DL): **105.70 m MSL**
  - Highest Flood Level (HFL, 03-09-1998): **106.48 m MSL**
  - DTP Dyke Crest: **107.00 m MSL** (0.52 m margin over 1998 HFL)
- **Monitored Defenses**: DTP Dyke Sections (North, Central, East), Sluice Gates (Maijan, Graham Bazar), Municipal High-Capacity Stormwater Pump Outfalls.

---

## 4. Dataset Verification & Validation Manifest

All datasets undergo automated binary checksum and schema validation on every test run:

| Location | Asset Path | File Type | Verification Test | Expected Checksum / Dimensions |
|---|---|---|---|---|
| Clonmel | `public/data/elevation_hydro.bin` | Float32 Binary | `tests/dam_break_validation.test.js` | 960,000 bytes ($400 \times 300 \times 4$) |
| Clonmel | `public/data/buildings.json` | GeoJSON FeatureCollection | `tests/defence_monitor.test.js` | 6,638 features, valid coordinates |
| Clonmel | `public/data/flood_defences.json` | JSON Asset Registry | `tests/defence_monitor.test.js` | 12 engineered flood defence assets |
| Dibrugarh | `public/data/dibrugarh/elevation_hydro.bin` | Float32 Binary | `tests/dibrugarh_data_integrity.test.js` | 960,000 bytes ($400 \times 300 \times 4$) |
| Dibrugarh | `public/data/dibrugarh/buildings.json` | JSON FeatureCollection | `tests/dibrugarh_data_integrity.test.js` | 2,465 features, valid coordinates |
| Dibrugarh | `public/data/dibrugarh/terrain.json` | JSON Grid Metadata | `tests/dibrugarh_data_integrity.test.js` | $400 \times 300$, bounds $27.472-27.495\,\text{N}$ |
| Dibrugarh | `public/data/dibrugarh/defences.json` | JSON Asset Registry | `tests/dibrugarh_data_integrity.test.js` | 5 defense assets, DTP dyke 107.0m MSL |

---

## 5. Licensing & Attribution Notice

- **Copernicus DEM**: © European Union, Copernicus Land Monitoring Service (CLMS) 2024.
- **OpenStreetMap Data**: © OpenStreetMap contributors, licensed under the Open Database License (ODbL).
- **OPW Hydro-Data**: Data provided by the Office of Public Works (Ireland) under Open Government Licence.
- **WRD Assam & CWC Data**: Publicly available hydrometric thresholds sourced from Central Water Commission (India) Flood Forecast Bulletins.
