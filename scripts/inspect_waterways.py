import json
import numpy as np

with open('public/data/terrain.json') as f:
    meta = json.load(f)

with open('public/data/waterways.json') as f:
    waterways = json.load(f)

BBOX = meta['bbox']
w_deg = BBOX['east'] - BBOX['west']
h_deg = BBOX['north'] - BBOX['south']
GRID_W, GRID_H = meta['grid_w'], meta['grid_h']

def to_grid(lon, lat):
    return (lon - BBOX['west']) / w_deg * GRID_W, (BBOX['north'] - lat) / h_deg * GRID_H

for i, w in enumerate(waterways):
    pts = [to_grid(p[0], p[1]) for p in w['pts']]
    min_x = min(p[0] for p in pts)
    max_x = max(p[0] for p in pts)
    min_y = min(p[1] for p in pts)
    max_y = max(p[1] for p in pts)
    name = w.get('name')
    wtype = w.get('type')
    print(f"[{i:02d}] {name} ({wtype}) -> X: {min_x:5.1f}..{max_x:5.1f}, Y: {min_y:5.1f}..{max_y:5.1f}")
