"""ダウンロードした タイルと 道路データから、アプリ用の map.json / tiles.json /
背景タイル / overview を つくる。
まえもって download_tiles.py と fetch_roads.py を じっこうして おくこと。
つかいかた: python3 build_map.py
"""
import json, math, os
from collections import deque
from PIL import Image, ImageDraw
import numpy as np

ZOOM = 19
CENTER = (35.8479, 139.5380)
HALF_TILES = 14
TILE_DIR = 'tiles_raw'
OUT_DIR = 'out'
SPAWN_LATLON = (35.849707, 139.536283)  # ユーザーが全体地図のスクリーンショットで指し示した地点（OSM上に「アンビシャスガーデン鶴瀬」の登録がないため）

WIDTH_BY_TYPE = {
    'motorway': 18, 'trunk': 18, 'motorway_link': 14, 'trunk_link': 14,
    'primary': 16, 'primary_link': 12,
    'secondary': 14, 'secondary_link': 10,
    'tertiary': 12, 'tertiary_link': 10,
    'unclassified': 8, 'residential': 8, 'living_street': 8,
    'service': 6,
    'footway': 6, 'path': 5, 'pedestrian': 6, 'cycleway': 6, 'steps': 5,
    'track': 5,
}

def latlon_to_tile(lat, lon, zoom):
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    xtile = (lon + 180.0) / 360.0 * n
    ytile = (1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    return xtile, ytile

def main():
    os.makedirs(f'{OUT_DIR}/tiles', exist_ok=True)
    cx, cy = latlon_to_tile(*CENTER, ZOOM)
    x0, x1 = int(cx - HALF_TILES), int(cx + HALF_TILES)
    y0, y1 = int(cy - HALF_TILES), int(cy + HALF_TILES)
    TS = 256
    cols, rows = x1 - x0 + 1, y1 - y0 + 1
    W, H = cols * TS, rows * TS

    # 1) がぞうを ならべる（タイルの まま コピー ＋ ごうせい がぞうも つくる）
    composite = Image.new('RGB', (W, H), (240, 240, 240))
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            col, row = x - x0, y - y0
            src = f'{TILE_DIR}/{x}_{y}.png'
            im = Image.open(src).convert('RGB')
            composite.paste(im, (col * TS, row * TS))
            im.save(f'{OUT_DIR}/tiles/{col}_{row}.png')

    ov = composite.resize((1024, 1024), Image.LANCZOS)
    ov.save(f'{OUT_DIR}/overview.jpg', 'JPEG', quality=87, optimize=True, progressive=True)

    def to_px(lat, lon):
        xt, yt = latlon_to_tile(lat, lon, ZOOM)
        return (xt - x0) * TS, (yt - y0) * TS

    # 2) 道路データを ラスタライズ
    roads = json.load(open('roads-overpass.json'))
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    for el in roads['elements']:
        if el['type'] != 'way' or 'geometry' not in el:
            continue
        hw = el.get('tags', {}).get('highway', 'residential')
        width = WIDTH_BY_TYPE.get(hw, 6)
        pts = [to_px(pt['lat'], pt['lon']) for pt in el['geometry']]
        if len(pts) < 2:
            continue
        draw.line(pts, fill=255, width=width, joint='curve')
        r = width / 2
        for (px, py) in pts:
            draw.ellipse([px - r, py - r, px + r, py + r], fill=255)

    arr = np.array(mask) > 127

    # 3) スポーン ちてんを きめる（もっとも ちかい 道の てん）
    sx0, sy0 = to_px(*SPAWN_LATLON)
    sx0, sy0 = int(sx0), int(sy0)
    best = None
    bd = 1e18
    for dy in range(-120, 121):
        for dx in range(-120, 121):
            x, y = sx0 + dx, sy0 + dy
            if 0 <= x < W and 0 <= y < H and arr[y, x]:
                d = dx * dx + dy * dy
                if d < bd:
                    bd = d
                    best = (x, y)
    sx, sy = best

    # れんけつせいの かくにん
    seen = np.zeros_like(arr, dtype=bool)
    q = deque([(sx, sy)])
    seen[sy, sx] = True
    cnt = 1
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and arr[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                cnt += 1
                q.append((nx, ny))
    total = int(arr.sum())
    print(f'とどく わりあい: {cnt}/{total} ({cnt/total*100:.1f}%)')

    # 4) RLE へんかん
    flat = arr.flatten().astype(np.uint8)
    idx = np.flatnonzero(flat)
    diffs = np.diff(idx)
    breaks = np.where(diffs != 1)[0]
    starts = np.concatenate(([0], breaks + 1))
    ends = np.concatenate((breaks, [len(idx) - 1]))
    runs = [[int(idx[s]), int(idx[e] - idx[s] + 1)] for s, e in zip(starts, ends)]

    map_json = {
        "schemaVersion": 2, "id": "tsuruse-osm", "name": "つるせ",
        "width": W, "height": H, "speed": 20,
        "spawn": {"x": float(sx), "y": float(sy), "facing": "down"},
        "images": {"game": "assets/overview.jpg"},
        "roadRuns": runs,
    }
    json.dump(map_json, open(f'{OUT_DIR}/map.json', 'w'), ensure_ascii=False, separators=(',', ':'))

    tiles = [{"x": c, "y": r, "file": f"assets/tiles/{c}_{r}.png", "width": TS, "height": TS}
             for c in range(cols) for r in range(rows)]
    tiles_json = {"version": 1, "tileSize": TS, "pixelsPerSourceUnit": 1,
                  "width": W, "height": H, "columns": cols, "rows": rows, "tiles": tiles}
    json.dump(tiles_json, open(f'{OUT_DIR}/tiles.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print('できた:', OUT_DIR)

if __name__ == '__main__':
    main()
