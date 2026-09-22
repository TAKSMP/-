from pathlib import Path
import json,base64
r=Path(__file__).parent
css=(r/'viewer.css').read_text();m=(r/'map.json').read_text();tiles=(r/'tiles.json').read_text()
def data(path,mime):return 'data:'+mime+';base64,'+base64.b64encode((r/path).read_bytes()).decode()
head='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>鶴瀬のまち / 分割マップ</title><style>html,body{margin:0;height:100%;background:#ece8db}#app{height:100dvh}'+css+'</style><main id="app">地図を読み込み中…</main>'
modules='\n'.join('\n'.join(line for line in (r/p).read_text().splitlines() if not line.startswith('import ')).replace('export ','')for p in ['navigation.js','tile-store.js','viewer.js'])
svg={p.relative_to(r).as_posix():p.read_text()for p in (r/'assets/tiles').glob('*.svg')}
script='const map='+m+';const tileManifest='+tiles+';const svg='+json.dumps(svg,separators=(',',':'))+';mountWorld(document.querySelector("#app"),{map,tileManifest,resolveTile:file=>"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg[file]),gameUrl:'+json.dumps(data('assets/overview.png','image/png'))+',referenceUrl:'+json.dumps(data('assets/reference.png','image/png'))+'}).then(api=>window.world=api).catch(e=>document.querySelector("#app").textContent=e.message);'
(r/'preview.html').write_text(head+'<script>'+modules+'\n'+script+'</script></html>')
(r/'index.html').write_text(head+'''<script type="module">
import {mountWorld} from './viewer.js';
try {
 const base=new URL('./',location.href);
 const read=async file=>{const r=await fetch(new URL(file,base));if(!r.ok)throw Error(`HTTP ${r.status}: ${file}`);return r.json();};
 const map=await read('map.json'),tileManifest=await read(map.tiles);
 window.world=await mountWorld(document.querySelector('#app'),{map,tileManifest,tileBaseUrl:base.href,gameUrl:new URL(map.images.game,base).href,referenceUrl:new URL(map.images.reference,base).href});
}catch(e){document.querySelector('#app').textContent='地図の読込に失敗しました。HTTPサーバーから開いてください。 '+e.message;}
</script></html>''')
