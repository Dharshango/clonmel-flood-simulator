import math
import os
import urllib.request
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import json

os.makedirs('evidence', exist_ok=True)
os.makedirs('cache/osm_tiles', exist_ok=True)

BBOX = {
    'south': 52.345,
    'north': 52.364,
    'west': -7.730,
    'east': -7.680
}

zoom = 14

def latlon_to_tile(lat, lon, z):
    x = int((lon + 180.0) / 360.0 * (1 << z))
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (1 << z))
    return x, y

def tile_bounds(x, y, z):
    n = 1 << z
    lon_w = x / n * 360.0 - 180.0
    lon_e = (x + 1) / n * 360.0 - 180.0
    lat_rad_n = math.atan(math.sinh(math.pi * (1.0 - 2.0 * y / n)))
    lat_n = math.degrees(lat_rad_n)
    lat_rad_s = math.atan(math.sinh(math.pi * (1.0 - 2.0 * (y + 1) / n)))
    lat_s = math.degrees(lat_rad_s)
    return lon_w, lon_e, lat_s, lat_n

min_tx, min_ty = latlon_to_tile(BBOX['north'], BBOX['west'], zoom)
max_tx, max_ty = latlon_to_tile(BBOX['south'], BBOX['east'], zoom)

# Stitch OSM map tiles
osm_img = Image.new('RGB', ((max_tx - min_tx + 1) * 256, (max_ty - min_ty + 1) * 256), color=(240, 240, 240))
for iy, ty in enumerate(range(min_ty, max_ty + 1)):
    for ix, tx in enumerate(range(min_tx, max_tx + 1)):
        tile_path = f"cache/osm_tiles/osm_{zoom}_{tx}_{ty}.png"
        if not os.path.exists(tile_path):
            url = f"https://tile.openstreetmap.org/{zoom}/{tx}/{ty}.png"
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'ClonmelFloodSimResearch/1.0 (academic flood modeling)'})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    with open(tile_path, 'wb') as f:
                        f.write(resp.read())
            except Exception as e:
                print(f"Failed to fetch tile {tx},{ty}: {e}")
        if os.path.exists(tile_path):
            tile = Image.open(tile_path)
            osm_img.paste(tile, (ix * 256, iy * 256))

# Crop OSM image to BBOX
w_lon, _, _, n_lat = tile_bounds(min_tx, min_ty, zoom)
_, e_lon, s_lat, _ = tile_bounds(max_tx, max_ty, zoom)

crop_x0 = int((BBOX['west'] - w_lon) / (e_lon - w_lon) * osm_img.width)
crop_x1 = int((BBOX['east'] - w_lon) / (e_lon - w_lon) * osm_img.width)
crop_y0 = int((n_lat - BBOX['north']) / (n_lat - s_lat) * osm_img.height)
crop_y1 = int((n_lat - BBOX['south']) / (n_lat - s_lat) * osm_img.height)

osm_cropped = osm_img.crop((crop_x0, crop_y0, crop_x1, crop_y1)).resize((600, 400), Image.Resampling.LANCZOS)
osm_cropped.save('evidence/clonmel_osm_reference.png')
print("Saved evidence/clonmel_osm_reference.png")
