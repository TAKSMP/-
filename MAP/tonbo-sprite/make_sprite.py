"""トンボの 元画像（12コマの シート）を、アプリで つかう 128px×12コマ（よこ3×たて4）に ととのえる。

  python3 MAP/tonbo-sprite/make_sprite.py

  れつ：0=まえ（した むき）、1=ひだり むき、2=みぎ むき、3=うしろ（うえ むき）  ← asagi.png と おなじ
  よこ：はねの ぱたぱた 3コマ
  1コマずつ はねの かたちが ちがうので、からだ（いろの こい ぶぶん）の まんなかを コマの まんなかに あわせ、
  シートぜんたいで おなじ ばいりつに して、コマごとに おおきさが ゆれない ように する。
"""
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'public' / 'fields'
CELL = 128
COLS, ROWS = 3, 4
SHEETS = {'usubakitonbo': 'usubakitonbo-source.png', 'ginyanma': 'ginyanma-source.png'}


def split_frames(img: Image.Image):
    a = np.array(img.convert('RGBA'))
    solid = a[..., 3] > 20
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    assert n == COLS * ROWS, f'コマの かずが {n}（12のはず）'
    frames = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        comp = (lab[sl] == i + 1)
        crop = a[sl].copy()
        crop[..., 3] = np.where(comp, crop[..., 3], 0)
        ys, xs = np.nonzero(crop[..., 3] > 20)
        cy, cx = ys.mean() + sl[0].start, xs.mean() + sl[1].start
        frames.append({'img': crop, 'cx': cx, 'cy': cy})
    frames.sort(key=lambda f: f['cy'])
    grid = []
    for r in range(ROWS):
        row = sorted(frames[r * COLS:(r + 1) * COLS], key=lambda f: f['cx'])
        grid.append(row)
    return grid


def body_center(crop: np.ndarray):
    """からだ＝いろの こい ぶぶん（はねは はいいろ・とうめいに ちかい）の じゅうしん"""
    rgb = crop[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    m = (crop[..., 3] > 200) & (sat > 0.45)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        ys, xs = np.nonzero(crop[..., 3] > 20)
    return xs.mean(), ys.mean()


def build(name: str, src: str):
    grid = split_frames(Image.open(HERE / src))
    info = []
    for row in grid:
        for f in row:
            h, w = f['img'].shape[:2]
            bx, by = body_center(f['img'])
            info.append((f, bx, by, w, h))
    # コマ から はみ出さない ばいりつ（しゃしんの まんなか＝からだ）
    half = CELL / 2 - 3
    scale = min(
        min(half / max(bx, 1), half / max(w - bx, 1), half / max(by, 1), half / max(h - by, 1))
        for _, bx, by, w, h in info
    )
    sheet = Image.new('RGBA', (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
    for idx, (f, bx, by, w, h) in enumerate(info):
        r, c = divmod(idx, COLS)
        im = Image.fromarray(f['img'], 'RGBA')
        nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
        im = im.resize((nw, nh), Image.LANCZOS)
        ox = round(c * CELL + CELL / 2 - bx * scale)
        oy = round(r * CELL + CELL / 2 - by * scale)
        sheet.alpha_composite(im, (ox, oy)) if ox >= 0 and oy >= 0 else sheet.paste(im, (ox, oy), im)
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{name}.png'
    sheet.save(path, optimize=True)
    print(name, 'scale', round(scale, 3), '->', path)


if __name__ == '__main__':
    for n, s in SHEETS.items():
        build(n, s)
