import urllib.request
import json
import math

# Test Open-Elevation or AWS elevation tile
lat = 27.48
lon = 94.91
url = f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lon}"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'FloodSimulator/1.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("Elevation API result:", res)
except Exception as e:
    print("Elevation API error:", e)

# Test AWS Terrain Tile (Terrarium or Mapzen)
# zoom 12
zoom = 12
lat_rad = math.radians(lat)
n = 2.0 ** zoom
xtile = int((lon + 180.0) / 360.0 * n)
ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
aws_url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{xtile}/{ytile}.png"
print("Testing AWS Terrarium tile URL:", aws_url)
try:
    req = urllib.request.Request(aws_url, headers={'User-Agent': 'FloodSimulator/1.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = resp.read()
        print("AWS Terrarium tile downloaded successfully! Size:", len(data))
except Exception as e:
    print("AWS tile error:", e)
