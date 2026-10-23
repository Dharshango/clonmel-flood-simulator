import json

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

print(f"BBOX: {BBOX}")
for i, w in enumerate(waterways):
    pts = w['pts']
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    grid_pts = [lonlat_to_grid(lon, lat) for lon, lat in pts]
    xs = [p[0] for p in grid_pts]
    ys = [p[1] for p in grid_pts]
    print(f"[{i:02d}] {w.get('name')} ({w.get('type')}) count={len(pts)} "
          f"lon: {min(lons):.5f}..{max(lons):.5f}, lat: {min(lats):.5f}..{max(lats):.5f} | "
          f"grid X: {min(xs):.1f}..{max(xs):.1f}, Y: {min(ys):.1f}..{max(ys):.1f}")
