import json
import math
import numpy as np
from PIL import Image, ImageDraw

# 1. Load meta and waterways
with open('public/data/terrain.json') as f:
    meta = json.load(f)

with open('public/data/waterways.json') as f:
    waterways = json.load(f)

BBOX = meta['bbox']
w_deg = BBOX['east'] - BBOX['west']
h_deg = BBOX['north'] - BBOX['south']
GRID_W = meta['grid_w']
GRID_H = meta['grid_h']

def lonlat_to_grid(lon, lat):
    x = (lon - BBOX['west']) / w_deg * GRID_W
    y = (BBOX['north'] - lat) / h_deg * GRID_H
    return x, y

print(f"Total waterways before filter: {len(waterways)}")

# Exclude the 3 marked extra stream features:
# 1. Far left north tributary (X ~ 72..94, Y ~ 258..298, indices 28, 29, 30, 31)
# 2. Middle-south vertical stream (X ~ 241..247, Y ~ 271..335, index 26)
# 3. South/southeast streams & Whitening Stream (indices 22, 23, 24, 25, 27, 33, 34, 35)
excluded_indices = {22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35}

filtered_waterways = []
for i, w in enumerate(waterways):
    if i in excluded_indices:
        print(f"Removing marked extra waterway [{i:02d}]: {w.get('name')} ({w.get('type')})")
        continue
    filtered_waterways.append(w)

print(f"Remaining genuine River Suir waterways: {len(filtered_waterways)}")

# Save updated waterways.json
with open('public/data/waterways.json', 'w') as f:
    json.dump(filtered_waterways, f, indent=2)

# 2. Create clean River Suir mask
river_mask_img = Image.new('L', (GRID_W, GRID_H), color=0)
draw_river = ImageDraw.Draw(river_mask_img)

for w in filtered_waterways:
    pts = w['pts']
    if len(pts) >= 2:
        poly = [lonlat_to_grid(lon, lat) for lon, lat in pts]
        draw_river.line(poly, fill=255, width=7)

river_mask_img.save('public/data/river_mask.png')
river_mask = np.array(river_mask_img) > 128
print(f"Clean River Suir mask saved. River cell count: {np.sum(river_mask)}")

# 3. Load pristine uncarved DEM elevation
with open('public/data/elevation.bin', 'rb') as f:
    elev = np.frombuffer(f.read(), dtype=np.float32).reshape((GRID_H, GRID_W)).copy()

# Carve riverbed ONLY along the clean River Suir channel
river_coords = np.argwhere(river_mask) # (y, x)
for y, x in river_coords:
    alpha = x / float(GRID_W)
    target_bed = 17.2 - alpha * 3.2 # gentle slope from 17.2m down to 14.0m
    elev[y, x] = min(elev[y, x], target_bed)

# Save newly hydro-conditioned elevation
with open('public/data/elevation_hydro.bin', 'wb') as f:
    f.write(elev.astype(np.float32).tobytes())
print("Saved clean elevation_hydro.bin")

# 4. Recompute normal map for terrain shading
dx = meta['dx']
dy = meta['dy']
dz_dy, dz_dx = np.gradient(elev, dy, dx)

normal_x = -dz_dx
normal_y = -dz_dy
normal_z = np.ones_like(elev)
norm = np.sqrt(normal_x**2 + normal_y**2 + normal_z**2)
normal_x /= norm
normal_y /= norm
normal_z /= norm

norm_r = ((normal_x * 0.5 + 0.5) * 255).astype(np.uint8)
norm_g = ((normal_y * 0.5 + 0.5) * 255).astype(np.uint8)
norm_b = ((normal_z * 0.5 + 0.5) * 255).astype(np.uint8)
norm_img = Image.merge('RGB', (Image.fromarray(norm_r), Image.fromarray(norm_g), Image.fromarray(norm_b)))
norm_img.save('public/data/terrain_normal.png')
print("Saved clean terrain_normal.png")
print("Extra rivers removal successfully completed!")
