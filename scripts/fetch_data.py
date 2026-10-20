import os
import math
import json
import urllib.request
import urllib.parse
from PIL import Image
import numpy as np

os.makedirs('cache', exist_ok=True)
os.makedirs('public/data', exist_ok=True)

# Clonmel bounding box:
# Center approx: lat 52.355, lon -7.705
# Covering ~3.2 km (lon) by ~2.1 km (lat)
# Lat: 52.345 to 52.364 (range = 0.019 deg ~= 2.11 km)
# Lon: -7.730 to -7.680 (range = 0.050 deg ~= 3.40 km at lat 52.35)
BBOX = {
    'south': 52.345,
    'north': 52.364,
    'west': -7.730,
    'east': -7.680
}

print(f"Bounding box: {BBOX}")

# 1. Fetch OpenStreetMap data
osm_cache_file = 'cache/clonmel_osm.json'
if not os.path.exists(osm_cache_file):
    print("Fetching OpenStreetMap data from Overpass API...")
    bbox_str = f"{BBOX['south']},{BBOX['west']},{BBOX['north']},{BBOX['east']}"
    query = f"""[out:json][timeout:35];
(
  way["building"]({bbox_str});
  way["highway"]({bbox_str});
  way["waterway"]({bbox_str});
  relation["waterway"]({bbox_str});
  way["natural"="water"]({bbox_str});
);
out body;
>;
out skel qt;
"""
    overpass_urls = [
        'https://overpass-api.de/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
    ]
    success = False
    for url in overpass_urls:
        try:
            print(f"Trying {url}...")
            req = urllib.request.Request(
                url,
                data=urllib.parse.urlencode({'data': query}).encode('utf-8'),
                headers={'User-Agent': 'ClonmelFloodSimResearch/1.0'}
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                content = resp.read()
                with open(osm_cache_file, 'wb') as f:
                    f.write(content)
                print(f"Saved {len(content)} bytes to {osm_cache_file}")
                success = True
                break
        except Exception as e:
            print(f"Failed on {url}: {e}")
    if not success:
        print("Warning: Overpass fetch failed.")
else:
    print(f"Using cached OSM data from {osm_cache_file}")

# 2. Fetch Elevation Tiles (Terrarium)
# Zoom 14 gives ~5.8m per pixel, zoom 15 gives ~2.9m per pixel.
# Let's download zoom 14 tiles covering the bbox.
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
    return {'west': lon_w, 'east': lon_e, 'north': lat_n, 'south': lat_s}

min_tx, min_ty = latlon_to_tile(BBOX['north'], BBOX['west'], zoom)
max_tx, max_ty = latlon_to_tile(BBOX['south'], BBOX['east'], zoom)

print(f"Elevation tiles range: X [{min_tx} .. {max_tx}], Y [{min_ty} .. {max_ty}]")

tile_images = {}
for ty in range(min_ty, max_ty + 1):
    for tx in range(min_tx, max_tx + 1):
        tile_path = f"cache/terrarium_z{zoom}_{tx}_{ty}.png"
        if not os.path.exists(tile_path):
            url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{tx}/{ty}.png"
            print(f"Downloading {url}...")
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'ClonmelFloodSim/1.0'})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    with open(tile_path, 'wb') as f:
                        f.write(resp.read())
            except Exception as e:
                print(f"Failed to fetch tile {tx},{ty}: {e}")
        if os.path.exists(tile_path):
            tile_images[(tx, ty)] = Image.open(tile_path).convert('RGB')

print(f"Loaded {len(tile_images)} elevation tiles.")
