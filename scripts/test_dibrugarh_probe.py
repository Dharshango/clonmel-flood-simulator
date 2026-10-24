import urllib.request
import json

url = 'https://overpass-api.de/api/interpreter'
query = """[out:json][timeout:25];
(
  node["place"="town"](27.45,94.88,27.52,94.95);
  way["highway"](27.47,94.90,27.49,94.93);
);
out count;
"""

req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'FloodSimulator/1.0'})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print('Overpass query successful! Count info:', data.get('elements', [{}])[0].get('tags', {}))
except Exception as e:
    print('Overpass query test error:', e)
