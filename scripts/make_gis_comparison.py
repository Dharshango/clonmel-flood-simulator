import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# 1. Load elevation
with open('public/data/terrain.json') as f:
    meta = json.load(f)

with open('public/data/elevation.bin', 'rb') as f:
    elev = np.frombuffer(f.read(), dtype=np.float32).reshape((meta['grid_h'], meta['grid_w']))

with open('public/data/buildings.json') as f:
    buildings = json.load(f)

with open('public/data/roads.json') as f:
    roads = json.load(f)

with open('public/data/waterways.json') as f:
    waterways = json.load(f)

bbox = meta['bbox']
w_deg = bbox['east'] - bbox['west']
h_deg = bbox['north'] - bbox['south']

def lonlat_to_xy(lon, lat):
    x = (lon - bbox['west']) / w_deg * meta['grid_w']
    y = (bbox['north'] - lat) / h_deg * meta['grid_h']
    return x, y

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7), dpi=150)

# Left: Real OSM reference map
osm_ref = Image.open('evidence/clonmel_osm_reference.png')
ax1.imshow(osm_ref, extent=[bbox['west'], bbox['east'], bbox['south'], bbox['north']], aspect='auto')
ax1.set_title("OpenStreetMap Official Cartography\nClonmel & River Suir Corridor (~3.4 km x 2.1 km)", fontsize=11, fontweight='bold')
ax1.set_xlabel("Longitude (°W)")
ax1.set_ylabel("Latitude (°N)")
ax1.grid(True, linestyle=':', alpha=0.4)

# Right: Loaded Real Elevation + 6,638 OSM Building Footprints + River Network
im = ax2.imshow(elev, extent=[bbox['west'], bbox['east'], bbox['south'], bbox['north']], cmap='terrain', origin='upper', aspect='auto')
cbar = fig.colorbar(im, ax=ax2, fraction=0.046, pad=0.04)
cbar.set_label("Elevation Above Sea Level (m)", fontsize=10)

# Overlay buildings
b_count = 0
for b in buildings:
    pts = np.array(b['pts'])
    if len(pts) >= 3:
        ax2.fill(pts[:, 0], pts[:, 1], color='#333333', alpha=0.75, linewidth=0.5, edgecolor='#111111')
        b_count += 1

# Overlay River Suir
for w in waterways:
    pts = np.array(w['pts'])
    if len(pts) >= 2:
        ax2.plot(pts[:, 0], pts[:, 1], color='#0077be', linewidth=2.5, alpha=0.9)

# Overlay prominent roads
for r in roads:
    if r.get('type') in ['primary', 'secondary', 'tertiary', 'trunk']:
        pts = np.array(r['pts'])
        if len(pts) >= 2:
            ax2.plot(pts[:, 0], pts[:, 1], color='#ffaa00', linewidth=1.2, alpha=0.7)

ax2.set_title(f"Clonmel 3D Simulation Mesh: Real DEM + {len(buildings):,} OSM Building Footprints\nRiver Suir Bathymetry & Street Grid (600x400 cells, dx=5.7m)", fontsize=11, fontweight='bold')
ax2.set_xlabel("Longitude (°W)")
ax2.set_ylabel("Latitude (°N)")
ax2.grid(True, linestyle=':', alpha=0.4)

plt.tight_layout()
plt.savefig('evidence/clonmel_terrain_map_comparison.png')
plt.close()
print("Saved evidence/clonmel_terrain_map_comparison.png")
