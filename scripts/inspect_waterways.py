import json
import numpy as np

with open('public/data/terrain.json') as f:
    meta = json.load(f)

with open('public/data/waterways.json') as f:
    waterways = json.load(f)

with open('public/data/elevation.bin', 'rb') as f:
    elev = np.frombuffer(f.read(), dtype=np.float32).reshape((meta['grid_h'], meta['grid_w']))

print(f"Loaded elevation {elev.shape}")
print(f"Number of waterways: {len(waterways)}")
for w in waterways:
    name = w.get('name')
    wtype = w.get('type')
    n_pts = len(w.get('pts', []))
    print(f"Waterway: {name}, type={wtype}, points={n_pts}")
