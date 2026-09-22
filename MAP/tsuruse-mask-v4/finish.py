from pathlib import Path
import json,shutil,base64,zipfile
import numpy as np
from PIL import Image
P=Path(__file__).resolve().parent
for name in ['viewer.js','viewer.css','navigation.js','tile-store.js','TsuruseWorld.jsx','index.html','package.json']:
 if not (P/name).exists():shutil.copy(P.parent/'tsuruse-world-v2'/name,P/name)
v=P/'viewer.js';v.write_text(v.read_text().replace('詳細マップ β','マスク固定版').replace('{resolve:resolveTile','{maxCache:12,resolve:resolveTile'))
v=P/'TsuruseWorld.jsx';v.write_text(v.read_text().replace("./fields/tsuruse/","./fields/tsuruse-mask/"))
m=np.array(Image.open(P/'roads-mask.png'))==255;h,w=m.shape;f=m.flatten().astype(int);e=np.flatnonzero(np.diff(np.r_[0,f,0]));runs=[[int(a),int(b-a)] for a,b in e.reshape(-1,2)]
manifest=json.loads((P/'manifest.json').read_text())
(P/'map.json').write_text(json.dumps(dict(version=4,width=w,height=h,spawn=dict(x=996.5,y=1005.5),speed=12,roadRuns=runs,images=dict(game='overview.png',reference='roads-mask.png'),tiles='tiles.json'),separators=(',',':')))
(P/'tiles.json').write_text(json.dumps(dict(version=4,tileSize=128,pixelsPerSourceUnit=16,width=w,height=h,columns=16,rows=15,tiles=[dict(x=t['x'],y=t['y'],file=t['file'],width=t['width']/16,height=t['height']/16) for t in manifest['tiles']]),separators=(',',':')))
data={}
for n in ['center','north','south']:
 data[n]=['data:image/png;base64,'+base64.b64encode((P/f'qa/{n}{suffix}.png').read_bytes()).decode() for suffix in ['','-mask-overlay']]
(P/'mask-check.html').write_text('''<!doctype html><html lang="ja"><meta charset="utf-8"><title>道路マスク照合</title><style>body{font:16px sans-serif;background:#eee;margin:20px}button,select{padding:10px}img{display:block;margin-top:16px;max-width:100%}img.native{max-width:none}</style><h1>道路マスク照合</h1><p>白黒マスクを50%重ねています。全240区画の画素検証結果は verification.json に収録。</p><select id="area"><option value="center">中央</option><option value="north">北部</option><option value="south">南部</option></select> <button id="toggle">背景だけを見る</button> <button id="size">原寸／画面に合わせる</button><img id="pic"><script>const data='''+json.dumps(data)+''';let overlay=1;const pic=document.querySelector('#pic'),area=document.querySelector('#area');function show(){pic.src=data[area.value][overlay]}area.onchange=show;document.querySelector('#toggle').onclick=()=>{overlay=1-overlay;document.querySelector('#toggle').textContent=overlay?'背景だけを見る':'マスクを重ねる';show()};document.querySelector('#size').onclick=()=>pic.classList.toggle('native');show();</script></html>''')
(P/'start-preview.command').write_text('#!/bin/sh\ncd "$(dirname "$0")"\npython3 -m http.server 8000 --bind 127.0.0.1\n');(P/'start-preview.command').chmod(0o755)
print('app files complete')
