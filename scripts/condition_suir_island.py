import json
import math
import numpy as np
from PIL import Image

def condition_suir_island():
    with open('public/data/terrain.json') as f:
        meta = json.load(f)

    BBOX = meta['bbox']
    w_deg = BBOX['east'] - BBOX['west']
    h_deg = BBOX['north'] - BBOX['south']
    GRID_W = meta['grid_w']
    GRID_H = meta['grid_h']

    # Load river mask and elevation
    river_mask_img = Image.open('public/data/river_mask.png')
    river_mask = np.array(river_mask_img) > 128

    with open('public/data/elevation_hydro.bin', 'rb') as f:
        elev = np.frombuffer(f.read(), dtype=np.float32).reshape((GRID_H, GRID_W)).copy()

    # Suir Island grid window
    gx0 = int((-7.7058 - BBOX['west']) / w_deg * GRID_W) # ~290
    gx1 = int((-7.7020 - BBOX['west']) / w_deg * GRID_W) # ~336
    gy0 = int((BBOX['north'] - 52.3517) / h_deg * GRID_H) # ~258
    gy1 = int((BBOX['north'] - 52.3506) / h_deg * GRID_H) # ~282

    print(f"Conditioning Suir Island grid window: X [{gx0}..{gx1}], Y [{gy0}..{gy1}]")

    # For every non-river cell on Suir Island, set realistic island ground elevation
    # Sloping gently from west (17.75m) to east (17.45m), safely above normal river stage (17.35m)
    # but submerged during floods (>18.5m)
    modified_count = 0
    for y in range(gy0, gy1 + 1):
        for x in range(gx0, gx1 + 1):
            if river_mask[y, x]:
                continue # leave river bed untouched
            
            # Distance along island west to east
            fx = (x - gx0) / float(gx1 - gx0)
            target_island_elev = 17.75 - fx * 0.30 # 17.75m down to 17.45m
            
            # Smoothly transition down if previous elev was artificially elevated (>18.0m)
            if elev[y, x] > target_island_elev:
                elev[y, x] = target_island_elev
                modified_count += 1

    print(f"Successfully conditioned {modified_count} Suir Island ground cells to 17.45m-17.75m OD.")

    # Save updated elevation_hydro.bin
    with open('public/data/elevation_hydro.bin', 'wb') as f:
        f.write(elev.astype(np.float32).tobytes())
    print("Saved public/data/elevation_hydro.bin")

    # Recompute normal map for seamless 3D terrain lighting
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
    print("Saved public/data/terrain_normal.png")

if __name__ == '__main__':
    condition_suir_island()
