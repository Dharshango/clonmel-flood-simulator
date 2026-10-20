import os
import math
import json
import numpy as np
from PIL import Image

# Exact Clonmel bounding box
BBOX = {
    'south': 52.345,
    'north': 52.364,
    'west': -7.730,
    'east': -7.680
}

# 1. Parse OSM
print("Parsing OSM data...")
with open('cache/clonmel_osm.json', 'r', encoding='utf-8') as f:
    osm_data = json.load(f)

nodes = {}
for el in osm_data.get('elements', []):
    if el['type'] == 'node':
        nodes[el['id']] = (el['lon'], el['lat'])

print(f"Loaded {len(nodes)} OSM nodes.")

buildings = []
roads = []
waterways = []

for el in osm_data.get('elements', []):
    if el['type'] == 'way':
        tags = el.get('tags', {})
        pts = [nodes[nid] for nid in el.get('nodes', []) if nid in nodes]
        if not pts:
            continue
            
        if 'building' in tags:
            # Estimate height based on building:levels or building type
            levels = tags.get('building:levels', '2')
            try:
                levels = float(levels)
            except:
                levels = 2.0
            height = levels * 3.2
            name = tags.get('name', tags.get('addr:street', ''))
            buildings.append({
                'id': el['id'],
                'name': name,
                'type': tags.get('building', 'yes'),
                'height': round(height, 1),
                'pts': pts
            })
        elif 'highway' in tags:
            roads.append({
                'id': el['id'],
                'name': tags.get('name', tags.get('ref', 'Unnamed Road')),
                'type': tags.get('highway'),
                'bridge': tags.get('bridge', 'no'),
                'pts': pts
            })
        elif 'waterway' in tags or tags.get('natural') == 'water':
            waterways.append({
                'id': el['id'],
                'name': tags.get('name', 'River Suir'),
                'type': tags.get('waterway', tags.get('natural')),
                'pts': pts
            })

print(f"Extracted {len(buildings)} buildings, {len(roads)} road segments, {len(waterways)} waterway features.")

# Let's inspect prominent streets
sample_streets = set(r['name'] for r in roads if r['name'] and 'Unnamed' not in r['name'])
print(f"Sample streets in Clonmel: {list(sample_streets)[:15]}")

# 2. Process Elevation
# Zoom 14 tiles
zoom = 14
def tile_bounds(x, y, z):
    n = 1 << z
    lon_w = x / n * 360.0 - 180.0
    lon_e = (x + 1) / n * 360.0 - 180.0
    lat_rad_n = math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n)))
    lat_n = math.degrees(lat_rad_n)
    lat_rad_s = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (y + 1) / n)))
    lat_s = math.degrees(lat_rad_s)
    return lon_w, lon_e, lat_s, lat_n

min_tx, min_ty = 7840, 5384
max_tx, max_ty = 7842, 5386

# Stitch tiles (3 columns, 3 rows = 768 x 768 pixels)
stitched_img = Image.new('RGB', (3 * 256, 3 * 256))
for iy, ty in enumerate(range(min_ty, max_ty + 1)):
    for ix, tx in enumerate(range(min_tx, max_tx + 1)):
        p = f"cache/terrarium_z{zoom}_{tx}_{ty}.png"
        tile = Image.open(p)
        stitched_img.paste(tile, (ix * 256, iy * 256))

# Stitched coverage bounds
w_lon, _, _, n_lat = tile_bounds(min_tx, min_ty, zoom)
_, e_lon, s_lat, _ = tile_bounds(max_tx, max_ty, zoom)

# Convert RGB to Terrarium elevation: (R * 256 + G + B / 256) - 32768
rgb_arr = np.array(stitched_img, dtype=np.float32)
elev_stitched = (rgb_arr[:, :, 0] * 256.0 + rgb_arr[:, :, 1] + rgb_arr[:, :, 2] / 256.0) - 32768.0

print(f"Elevation stitched size: {elev_stitched.shape}, range: {elev_stitched.min():.1f}m to {elev_stitched.max():.1f}m")

# Now crop/resample to BBOX:
# Target grid resolution: e.g. 600 width x 400 height
# Calculate dimensions in meters:
mean_lat = (BBOX['south'] + BBOX['north']) / 2.0
deg_lat_m = 111132.954 - 559.822 * math.cos(2 * math.radians(mean_lat))
deg_lon_m = 111412.84 * math.cos(math.radians(mean_lat))

extent_x_m = (BBOX['east'] - BBOX['west']) * deg_lon_m
extent_y_m = (BBOX['north'] - BBOX['south']) * deg_lat_m
print(f"Clonmel physical extent: {extent_x_m:.1f} m (E-W) x {extent_y_m:.1f} m (N-S)")

GRID_W = 600
GRID_H = 400
dx = extent_x_m / GRID_W
dy = extent_y_m / GRID_H
print(f"Grid resolution: {GRID_W} x {GRID_H}, dx = {dx:.2f} m, dy = {dy:.2f} m")

# Sample stitched elevation into grid
grid_lons = np.linspace(BBOX['west'], BBOX['east'], GRID_W)
grid_lats = np.linspace(BBOX['north'], BBOX['south'], GRID_H) # row 0 is North

# Pixel coordinates in stitched image:
# x_pix = (lon - w_lon) / (e_lon - w_lon) * stitched_img.width
# y_pix = (n_lat - lat) / (n_lat - s_lat) * stitched_img.height
pix_x = (grid_lons - w_lon) / (e_lon - w_lon) * stitched_img.width
pix_y = (n_lat - grid_lats) / (n_lat - s_lat) * stitched_img.height

pix_x = np.clip(pix_x, 0, stitched_img.width - 1).astype(int)
pix_y = np.clip(pix_y, 0, stitched_img.height - 1).astype(int)

PX, PY = np.meshgrid(pix_x, pix_y)
elev_grid = elev_stitched[PY, PX]

# Let's inspect river profile in Clonmel:
# In Clonmel, River Suir is around 14m to 19m elevation.
# The surrounding hills to the south (Comeragh foothills) rise to ~60-100m,
# and hills to the north rise to ~40-60m.
print(f"Grid elevation range: min={elev_grid.min():.2f}m, max={elev_grid.max():.2f}m, mean={elev_grid.mean():.2f}m")

# Save elevation grid as raw Float32 binary file and normalized 16-bit PNG for fast loading in WebGL
elev_grid_f32 = elev_grid.astype(np.float32)
with open('public/data/elevation.bin', 'wb') as f:
    f.write(elev_grid_f32.tobytes())

# Save terrain metadata
terrain_meta = {
    'bbox': BBOX,
    'width_m': extent_x_m,
    'height_m': extent_y_m,
    'grid_w': GRID_W,
    'grid_h': GRID_H,
    'dx': dx,
    'dy': dy,
    'min_elev': float(elev_grid.min()),
    'max_elev': float(elev_grid.max()),
    'town': 'Clonmel, County Tipperary, Ireland',
    'river': 'River Suir'
}

with open('public/data/terrain.json', 'w') as f:
    json.dump(terrain_meta, f, indent=2)

with open('public/data/buildings.json', 'w') as f:
    json.dump(buildings, f)

with open('public/data/roads.json', 'w') as f:
    json.dump(roads, f)

with open('public/data/waterways.json', 'w') as f:
    json.dump(waterways, f)

# Also let's extract Quay coordinates for Clonmel Quay wall preset
# Clonmel Quays: Quay Street, The Quay, Old Bridge, Convent Road, Suir Island
quay_roads = [r for r in roads if any(k in r['name'].lower() for k in ['quay', 'bridge', 'convent', 'suir island'])]
print(f"Found {len(quay_roads)} quay/bridge road segments in Clonmel.")

# Generate pre-configured Clonmel Flood Relief Scheme barrier segments along the north and south quays
# North Quay: along Quay St from Old Bridge towards Gashouse Bridge (approx lon -7.712 to -7.698, lat 52.353)
# South Quay / Denis Burke Park: along south bank (approx lon -7.708 to -7.696, lat 52.3515)
barrier_presets = {
    'north_quay_wall': {
        'name': 'North Quay Demountable Wall (The Quay / Quay St)',
        'type': 'wall',
        'height': 2.2,
        'points': [
            [-7.7120, 52.3526],
            [-7.7095, 52.3528],
            [-7.7070, 52.3530],
            [-7.7040, 52.3532],
            [-7.7010, 52.3530],
            [-7.6980, 52.3525]
        ]
    },
    'south_quay_wall': {
        'name': 'South Bank Flood Barrier (Denis Burke Park / Old Bridge)',
        'type': 'wall',
        'height': 2.0,
        'points': [
            [-7.7115, 52.3518],
            [-7.7085, 52.3519],
            [-7.7055, 52.3520],
            [-7.7020, 52.3520],
            [-7.6990, 52.3516]
        ]
    },
    'suir_island_barriers': {
        'name': 'Suir Island Perimeter Sandbags',
        'type': 'sandbags',
        'height': 1.2,
        'points': [
            [-7.7085, 52.3524],
            [-7.7060, 52.3525],
            [-7.7040, 52.3526],
            [-7.7035, 52.3522]
        ]
    }
}

with open('public/data/barriers_preset.json', 'w') as f:
    json.dump(barrier_presets, f, indent=2)

print("Data processing complete!")
