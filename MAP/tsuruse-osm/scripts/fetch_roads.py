"""Overpass API で 道路データを とる。
つかいかた: python3 fetch_roads.py > roads-overpass.json
"""
import math, sys, urllib.request

ZOOM = 19
CENTER = (35.8479, 139.5380)
HALF_TILES = 14

def tile_to_latlon(x, y, zoom):
    n = 2 ** zoom
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon

def latlon_to_tile(lat, lon, zoom):
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    xtile = (lon + 180.0) / 360.0 * n
    ytile = (1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile

cx, cy = latlon_to_tile(*CENTER, ZOOM)
x0, x1 = int(cx - HALF_TILES), int(cx + HALF_TILES) + 1
y0, y1 = int(cy - HALF_TILES), int(cy + HALF_TILES) + 1
lat_n, lon_w = tile_to_latlon(x0, y0, ZOOM)
lat_s, lon_e = tile_to_latlon(x1, y1, ZOOM)

query = f"""[out:json][timeout:60];
(
  way["highway"]["highway"!~"^(proposed|construction|abandoned|platform|elevator)$"]({lat_s:.6f},{lon_w:.6f},{lat_n:.6f},{lon_e:.6f});
);
out geom;
"""
req = urllib.request.Request(
    'https://overpass-api.de/api/interpreter',
    data=urllib.parse.urlencode({'data': query}).encode(),
    headers={'User-Agent': 'chomushi-app-kids-game/1.0'},
)
import urllib.parse
with urllib.request.urlopen(req, timeout=90) as r:
    sys.stdout.buffer.write(r.read())
