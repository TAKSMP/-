"""OSM標準タイルを ダウンロードする（つるせ用の 設定ずみ）。
つかいかた: python3 download_tiles.py
"""
import math, os, time, urllib.request

ZOOM = 19
CENTER = (35.8479, 139.5380)  # (lat, lon)
HALF_TILES = 14  # へん (HALF_TILES*2+1) タイル
OUT_DIR = 'tiles_raw'
HEADERS = {'User-Agent': 'chomushi-app-kids-game/1.0 (personal non-commercial project)'}
SERVERS = ['a', 'b', 'c']

def latlon_to_tile(lat, lon, zoom):
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    xtile = (lon + 180.0) / 360.0 * n
    ytile = (1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    cx, cy = latlon_to_tile(*CENTER, ZOOM)
    x0, x1 = int(cx - HALF_TILES), int(cx + HALF_TILES)
    y0, y1 = int(cy - HALF_TILES), int(cy + HALF_TILES)
    total = (x1 - x0 + 1) * (y1 - y0 + 1)
    print(f'はんい: x {x0}..{x1} y {y0}..{y1} ({total}まい)')
    n = 0
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            out = f'{OUT_DIR}/{x}_{y}.png'
            if os.path.exists(out):
                n += 1
                continue
            srv = SERVERS[(x + y) % 3]
            url = f'https://{srv}.tile.openstreetmap.org/{ZOOM}/{x}/{y}.png'
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10) as r:
                data = r.read()
            with open(out, 'wb') as f:
                f.write(data)
            n += 1
            if n % 100 == 0:
                print(f'{n}/{total}')
            time.sleep(0.05)  # サーバーに はいりょ
    print('かんりょう', n, '/', total)

if __name__ == '__main__':
    main()
