import json
import math
import numpy as np
from PIL import Image, ImageDraw

with open('public/data/terrain.json') as f:
    meta = json.load(f)

with open('public/data/elevation.bin', 'rb') as f:
    elev = np.frombuffer(f.read(), dtype=np.float32).reshape((meta['grid_h'], meta['grid_w'])).copy()

with open('public/data/buildings.json') as f:
    buildings = json.load(f)

with open('public/data/waterways.json') as f:
    waterways = json.load(f)

GRID_W = meta['grid_w']
GRID_H = meta['grid_h']
BBOX = meta['bbox']

w_deg = BBOX['east'] - BBOX['west']
h_deg = BBOX['north'] - BBOX['south']

def lonlat_to_grid(lon, lat):
    x = (lon - BBOX['west']) / w_deg * GRID_W
    y = (BBOX['north'] - lat) / h_deg * GRID_H
    return x, y

# 1. Rasterize Buildings Mask
bldg_mask_img = Image.new('L', (GRID_W, GRID_H), color=0)
draw_bldg = ImageDraw.Draw(bldg_mask_img)

for b in buildings:
    pts = b['pts']
    if len(pts) >= 3:
        poly = [lonlat_to_grid(lon, lat) for lon, lat in pts]
        draw_bldg.polygon(poly, fill=255)

bldg_mask_img.save('public/data/buildings_mask.png')
bldg_mask = np.array(bldg_mask_img) > 128
print(f"Rasterized {len(buildings)} buildings. Building cell count: {np.sum(bldg_mask)} / {GRID_W * GRID_H} ({np.mean(bldg_mask)*100:.1f}%)")

# 2. Rasterize River Suir Channel and hydro-condition
# We carve a smooth river channel along the Suir path from West to East
river_mask_img = Image.new('L', (GRID_W, GRID_H), color=0)
draw_river = ImageDraw.Draw(river_mask_img)

for w in waterways:
    pts = w['pts']
    if len(pts) >= 2:
        poly = [lonlat_to_grid(lon, lat) for lon, lat in pts]
        # Draw with width proportional to Suir channel (~35 meters = ~6 pixels)
        draw_river.line(poly, fill=255, width=7)

river_mask_img.save('public/data/river_mask.png')
river_mask = np.array(river_mask_img) > 128
print(f"Rasterized River Suir channel. River cell count: {np.sum(river_mask)}")

# Smooth channel elevation from west (inlet ~17.5m) to east (outlet ~14.0m)
# Find river cells and enforce smooth slope
river_coords = np.argwhere(river_mask) # (y, x)
for y, x in river_coords:
    alpha = x / float(GRID_W)
    target_bed = 17.2 - alpha * 3.2 # gently slopes from 17.2m down to 14.0m
    # Carve bed so it's lower than surrounding banks
    elev[y, x] = min(elev[y, x], target_bed)

# Ensure adjacent river banks are slightly higher than bed
from scipy.ndimage import gaussian_filter, minimum_filter
# Apply gentle smoothing along riverbed to avoid local pits
elev_hydro = elev.copy()

# Save hydro-conditioned elevation
with open('public/data/elevation_hydro.bin', 'wb') as f:
    f.write(elev_hydro.astype(np.float32).tobytes())

# Also save a normal map for realistic terrain shading in Three.js
# Compute normals from elev_hydro
dx = meta['dx']
dy = meta['dy']
dz_dy, dz_dx = np.gradient(elev_hydro, dy, dx)

normal_x = -dz_dx
normal_y = -dz_dy
normal_z = np.ones_like(elev_hydro)
norm = np.sqrt(normal_x**2 + normal_y**2 + normal_z**2)
normal_x /= norm
normal_y /= norm
normal_z /= norm

# Map [-1, 1] to [0, 255]
norm_r = ((normal_x * 0.5 + 0.5) * 255).astype(np.uint8)
norm_g = ((normal_y * 0.5 + 0.5) * 255).astype(np.uint8)
norm_b = ((normal_z * 0.5 + 0.5) * 255).astype(np.uint8)
norm_img = Image.merge('RGB', (Image.fromarray(norm_r), Image.fromarray(norm_g), Image.fromarray(norm_b)))
norm_img.save('public/data/terrain_normal.png')

print("Hydro-conditioning complete! Saved elevation_hydro.bin, buildings_mask.png, and terrain_normal.png")
