import urllib.request
import os
import json

def cache_telemetry():
    out_dir = 'public/data/telemetry'
    os.makedirs(out_dir, exist_ok=True)

    headers = {'User-Agent': 'ClonmelFloodForecasting/1.0'}

    stations = [
        ('16011', 'Clonmel (River Suir)'),
        ('16148', 'Workhouse Bridge (Inlet)'),
        ('16139', 'Knocklofty (Upstream Early Warning)'),
        ('16010', 'Anner (Tributary)')
    ]

    for stn_id, name in stations:
        url = f'https://waterlevel.ie/data/day/{stn_id}_0001.csv'
        out_path = os.path.join(out_dir, f'opw_{stn_id}.csv')
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as resp:
                content = resp.read().decode('utf-8')
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                lines = content.strip().splitlines()
                print(f"Cached OPW Station {stn_id} ({name}): {len(lines)} readings -> {out_path}")
        except Exception as e:
            print(f"Failed to fetch OPW {stn_id}: {e}")

    # Fetch Met Eireann / Open-Meteo high-resolution forecast for Clonmel
    met_url = 'https://api.open-meteo.com/v1/forecast?latitude=52.355&longitude=-7.703&hourly=precipitation,rain,temperature_2m,wind_speed_10m,surface_pressure&forecast_days=3&timezone=Europe%2FDublin'
    met_path = os.path.join(out_dir, 'met_forecast.json')
    try:
        req = urllib.request.Request(met_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            with open(met_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            print(f"Cached Met Eireann 72h Forecast: {len(data['hourly']['time'])} hours -> {met_path}")
    except Exception as e:
        print(f"Failed to fetch Met forecast: {e}")

if __name__ == '__main__':
    cache_telemetry()
