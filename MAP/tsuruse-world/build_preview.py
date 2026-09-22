from pathlib import Path
import base64
r=Path(__file__).parent
nav=(r/'navigation.js').read_text().replace('export ','');viewer=(r/'viewer.js').read_text().split('\n',1)[1].replace('export ','');css=(r/'viewer.css').read_text();m=(r/'map.json').read_text()
def url(path,mime):return 'data:'+mime+';base64,'+base64.b64encode((r/path).read_bytes()).decode()
head='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>鶴瀬駅周辺 / 大型移動マップ</title><style>html,body{margin:0;height:100%;background:#e9e5d8}#app{height:100dvh}'+css+'</style><main id="app">地図を読み込み中…</main>'
script='\nconst map='+m+';mountWorld(document.querySelector("#app"),{map,gameUrl:"'+url('assets/game-map.png','image/png')+'",referenceUrl:"'+url('assets/reference.png','image/png')+'"}).then(api=>window.world=api).catch(e=>document.querySelector("#app").textContent=e.message);'
(r/'preview.html').write_text(head+'<script>'+nav+viewer+script+'</script></html>')
(r/'index.html').write_text(head+'<script type="module">import {mountWorld} from "./viewer.js";const map=await (await fetch("./map.json")).json();mountWorld(document.querySelector("#app"),{map,gameUrl:map.images.game,referenceUrl:map.images.reference}).then(api=>window.world=api).catch(e=>document.querySelector("#app").textContent=e.message);</script></html>')
