import urllib.request
import json

mirrors = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
]

query = """[out:json][timeout:15];
(
  node["amenity"](27.47,94.90,27.49,94.93);
);
out count;
"""

for url in mirrors:
    print(f"Testing mirror: {url}...")
    try:
        req = urllib.request.Request(url, data=query.encode('utf-8'), headers={'User-Agent': 'DibrugarhFloodModel/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"Success on {url}! Result:", data.get('elements', [{}])[0].get('tags', {}))
            break
    except Exception as e:
        print(f"Failed {url}: {e}")
