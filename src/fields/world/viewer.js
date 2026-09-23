// つるせ などの 大きい マップ（schemaVersion 2）の エンジン。
// MAP/tsuruse-world-v2/viewer.js（区画ごとに SVG を よみこむ版）を もとに、アプリで つかう ために 次だけ たした：
//  - drawPlayer：じぶんで キャラを えがく（ドット絵の 男の子）
//  - startWalking：全体図を とばして すぐ あるきはじめる
//  - referenceUrl を なしに できる（ひかく用の 元地図 3.4MB を よまない）
//  - 通行範囲の 重ね絵は つかう ときだけ つくる（iPhone の メモリ たいさく）
//  - あるいた きょり・むき・うごいているか を drawPlayer に わたす
//  - loadTile：区画の 絵の よみこみかたを かえられる（アプリでは SVG を 1かいだけ 絵に して おく）
//  - artBg／artScale：ベクター調の 道路タイルの かわりに、イラスト背景（loadIllustratedMap）を つかう。
//    元データの ざひょう系（map.width など）と イラストの ざひょう系が ちがうので、artScale ぶん かんさんして えがく。
//    よみこみ じたいは WorldMap.tsx がわで すませて おき、ここでは できあがった artBg（draw を もつ）だけ うけとる。
//  - walkZoom：あるく ときの ズーム（map座標の 1単位あたり CSSピクセル）。しょうりゃく時 8。
//  - detailZoom：この ズーム いじょうで 詳細タイルに きりかえる。しょうりゃく時 6。
//    walkZoom より おおきい ねだんに すると、いつまでも したじ画像（ぼやけた 全体図）の
//    ままに なる バグに なるので、walkZoom を ひくく する ときは これも あわせて さげる。
//  - イラスト背景は「あるく」がめん では つかわない。区画ごとに べつべつに 生成された
//    ため、ぜんたいの いちは あっていても、道の かたちが ローカルに 少しずつ ずれていて、
//    ちかくで 見ながら あるくと 道から はずれて 見える。全体地図（見るだけ）では
//    きにならない ため、そちらだけ イラストを つかう。
//  - 見えている 区画が そろったら、したじの 全体図（8ばいに ひきのばし）は かかない（スマホで おもい）
//  - setOverview(true/false)：全体地図に きりかえる。マーカーは あかく てんめつ
//  - tiles.request は まいフレーム よばず、見ている 区画が かわった ときだけ よぶ（557この はいれつを まいフレーム なめると おもい）
//  - がめんの どこでも 指を すべらせると あるける（パッドが 指の ところへ）。タップは これまでどおり 道へ じどう移動
// それいがいの うごき（あたり判定・カメラ・道タップの 自動移動）は もとの まま。
import {TileStore} from './tile-store.js';
import {decodeRoads,isRoad,nearestRoad,move,findRoute} from './navigation.js';
export async function mountWorld(host,{map,gameUrl,referenceUrl,tileManifest,tileBaseUrl,resolveTile,loadTile=null,artBg=null,artScale=1,walkZoom=8,detailZoom=6,signal,onPosition=()=>{},drawPlayer=null,startWalking=false}){
 const load=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('地図を読み込めませんでした'));im.src=url;});
 const [game,reference]=await Promise.all([load(gameUrl),referenceUrl?load(referenceUrl):Promise.resolve(null)]);if(signal?.aborted)throw new DOMException('Aborted','AbortError');
 const tiles=new TileStore(tileManifest,{maxCache:12,resolve:resolveTile||(file=>new URL(file,tileBaseUrl).href),load:loadTile||undefined});
 const mask=decodeRoads(map);if(!isRoad(map,mask,map.spawn.x,map.spawn.y))throw Error('開始地点が通路外です');
 host.classList.add('world-view');host.innerHTML=`<canvas class="world-canvas" tabindex="0" aria-label="${map.name||''}の歩行地図"></canvas><header class="world-head"><div><small>TSURUSE / FIELD MAP</small><h1>鶴瀬駅周辺</h1></div><span>詳細マップ β</span></header><nav class="world-toolbar"><button data-a="walk">歩き始める</button><button data-a="overview">全体</button><button data-a="source">元地図</button><button data-a="collision">通行範囲</button><button data-a="select">開始地点を選ぶ</button></nav><div class="world-notice" aria-live="polite">全体図です。「歩き始める」で移動できます。</div><div class="world-zoom"><button data-a="plus" aria-label="拡大">＋</button><button data-a="minus" aria-label="縮小">−</button></div><div class="world-stick" aria-label="移動パッド"><i></i></div><div class="world-footer"><span class="world-position"></span><span>矢印 / WASD · 道をタップして移動</span></div>`;
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),stick=host.querySelector('.world-stick'),knob=stick.querySelector('i'),notice=host.querySelector('.world-notice');const events=new AbortController(),opts={signal:events.signal};
 let width=1,height=1,dpr=1,zoom=1,cx=map.width/2,cy=map.height/2,mode='overview',source=false,collision=false,route=[],routeIndex=0,last=0,raf=0,alive=true,paused=false,select=false,lastTileKey='';const tileSize=tileManifest?.tileSize||64;const player={...map.spawn};let travel=0,moving=false,facing=map.spawn.facing||'down',lastX=player.x,lastY=player.y;let vx=0,vy=0,pointer=null,drag=null;const keys=new Set();
 let overlay=null;function getOverlay(){if(overlay)return overlay;overlay=document.createElement('canvas');overlay.width=map.width;overlay.height=map.height;const oc=overlay.getContext('2d'),pixels=oc.createImageData(map.width,map.height);for(let i=0;i<mask.length;i++)if(mask[i]){pixels.data[i*4]=13;pixels.data[i*4+1]=222;pixels.data[i*4+2]=173;pixels.data[i*4+3]=190;}oc.putImageData(pixels,0,0);return overlay;}
 function message(s){notice.textContent=s;}function fit(){zoom=Math.min(width/map.width,(height-150)/map.height)*.95;cx=map.width/2;cy=map.height/2;}
 function resize(){width=host.clientWidth;height=host.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(mode==='overview')fit();}
 const ro=new ResizeObserver(resize);ro.observe(host);resize();
 function homeStick(){stick.style.left='';stick.style.top='';stick.style.bottom='';stick.classList.remove('floating');}
 function floatStick(x,y){const hr=host.getBoundingClientRect(),r=stick.getBoundingClientRect();stick.style.left=(x-hr.left-r.width/2)+'px';stick.style.top=(y-hr.top-r.height/2)+'px';stick.style.bottom='auto';stick.classList.add('floating');}
 function cancel(){vx=vy=0;keys.clear();pointer=null;knob.style.transform='translate(0px,0px)';homeStick();}
 function walk(){select=false;mode='walk';zoom=walkZoom;cx=player.x;cy=player.y;host.dataset.mode=mode;message('道をタップして移動。細い道は自動移動が便利です。');canvas.focus({preventScroll:true});}
 function showOverview(){cancel();route=[];mode='overview';host.dataset.mode=mode;fit();message('ドラッグで見渡せます。');}
 function zoomBy(scale){zoom=Math.max(.15,Math.min(walkZoom,zoom*scale));}
 for(const b of host.querySelectorAll('[data-a]'))b.addEventListener('click',()=>{const a=b.dataset.a;if(a==='walk')walk();if(a==='overview')showOverview();if(a==='source'){source=!source;b.textContent=source?'ゲーム表示':'元地図';}if(a==='collision'){collision=!collision;b.setAttribute('aria-pressed',String(collision));}if(a==='plus')zoomBy(1.5);if(a==='minus')zoomBy(1/1.5);if(a==='select'){select=true;cancel();route=[];mode='overview';host.dataset.mode=mode;fit();message('試したい道路を選んでください。開始位置だけを変更します。');}},opts);
 function screenWorld(x,y){const r=canvas.getBoundingClientRect();return{x:cx+(x-r.left-width/2)/zoom,y:cy+(y-r.top-height/2)/zoom};}
 canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx,cy,moved:false};canvas.setPointerCapture(e.pointerId);},opts);
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(mode==='walk'){const ddx=e.clientX-drag.x,ddy=e.clientY-drag.y,len=Math.hypot(ddx,ddy);if(!drag.moved&&len>8){drag.moved=true;route=[];floatStick(drag.x,drag.y);}if(drag.moved){const n=Math.max(38,len);vx=ddx/n;vy=ddy/n;knob.style.transform=`translate(${vx*38}px,${vy*38}px)`;}return;}const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;cx=drag.cx-dx/zoom;cy=drag.cy-dy/zoom;},opts);
 canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(moved){if(mode==='walk')cancel();return;}const point=screenWorld(e.clientX,e.clientY),target=nearestRoad(map,mask,point.x,point.y,Math.min(20,Math.max(2,12/zoom)));if(!target){message('この位置には読み取れた道路がありません。');return;}if(select){player.x=target.x;player.y=target.y;walk();return;}if(mode==='walk'){route=findRoute(map,mask,player,target)||[];routeIndex=0;message(route.length?'選んだ道路へ移動します。':'この道路への接続は元画像から確認できていません。');}else{cx=target.x;cy=target.y;zoom=4;}},opts);
 canvas.addEventListener('pointercancel',()=>{drag=null;if(mode==='walk')cancel();},opts);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(e.deltaY<0?1.15:1/1.15);},{...opts,passive:false});
 function updateStick(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,n=Math.max(38,Math.hypot(dx,dy));vx=dx/n;vy=dy/n;if(Math.hypot(dx,dy)<7)vx=vy=0;knob.style.transform=`translate(${vx*38}px,${vy*38}px)`;route=[];}
 stick.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;stick.setPointerCapture(pointer);updateStick(e);},opts);stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)updateStick(e);},opts);for(const t of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(t,e=>{if(e.pointerId===pointer)cancel();},opts);
 host.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){e.preventDefault();keys.add(k);route=[];}},opts);host.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()),opts);window.addEventListener('blur',cancel,opts);host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))cancel();},opts);document.addEventListener('visibilitychange',()=>{cancel();last=0;},opts);
 function frame(t){if(!alive)return;const dt=last?Math.min(.04,(t-last)/1000):0;last=t;
 moving=false;if(mode==='walk'&&!paused&&!document.hidden){let dx=vx+(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0),dy=vy+(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);const n=Math.max(1,Math.hypot(dx,dy));move(map,mask,player,dx/n*map.speed*dt,dy/n*map.speed*dt);
 let distance=map.speed*dt;while(routeIndex<route.length&&distance>0){const p=route[routeIndex],len=Math.hypot(p.x-player.x,p.y-player.y);if(len<.001){routeIndex++;continue;}const amount=Math.min(distance,len),oldX=player.x,oldY=player.y;move(map,mask,player,(p.x-player.x)/len*amount,(p.y-player.y)/len*amount);distance-=amount;if(Math.hypot(player.x-oldX,player.y-oldY)<amount*.5){route=[];break;}if(Math.hypot(p.x-player.x,p.y-player.y)<.01)routeIndex++;}
 cx=player.x;cy=player.y;{const mdx=player.x-lastX,mdy=player.y-lastY,md=Math.hypot(mdx,mdy);if(md>1e-4&&md<map.speed*.1){travel+=md;moving=true;facing=Math.abs(mdx)>Math.abs(mdy)?(mdx>0?'right':'left'):(mdy>0?'down':'up');}lastX=player.x;lastY=player.y;}onPosition({...player});}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#e9e5d8';ctx.fillRect(0,0,width,height);if(artBg&&!source&&mode!=='walk'){artBg.draw(ctx,{cx:cx*artScale,cy:cy*artScale,zoom:zoom/artScale,width,height,dpr});}else{ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);ctx.imageSmoothingEnabled=true;const detail=!source&&zoom>=detailZoom,view={left:cx-width/2/zoom,top:cy-height/2/zoom,right:cx+width/2/zoom,bottom:cy+height/2/zoom};if(detail){const tk=`${Math.floor(cx/tileSize)}_${Math.floor(cy/tileSize)}`;if(tk!==lastTileKey){lastTileKey=tk;tiles.request(view);}}if(!detail||!tiles.getStatus().ready)ctx.drawImage(source&&reference?reference:game,0,0,map.width,map.height);if(detail)tiles.draw(ctx,view);ctx.restore();}if(collision){ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);ctx.drawImage(getOverlay(),0,0);ctx.restore();}
 const px=width/2+(player.x-cx)*zoom,py=height/2+(player.y-cy)*zoom;
 if(mode==='walk'&&drawPlayer){drawPlayer(ctx,{x:px,y:py,facing,travel,moving,zoom});}else if(mode==='walk'){ctx.save();ctx.translate(Math.round(px),Math.round(py));ctx.fillStyle='#334a5566';ctx.beginPath();ctx.ellipse(0,0,7,3,0,0,7);ctx.fill();ctx.fillStyle='#315267';ctx.fillRect(-4,-4,3,5);ctx.fillRect(2,-4,3,5);ctx.fillStyle='#efd15b';ctx.fillRect(-6,-14,12,10);ctx.fillStyle='#f3c59d';ctx.fillRect(-4,-21,8,8);ctx.fillStyle='#dfce9b';ctx.fillRect(-7,-24,14,6);ctx.fillRect(-9,-19,18,3);ctx.strokeStyle='#866648';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(7,-8);ctx.lineTo(13,-25);ctx.stroke();ctx.strokeStyle='#f6ffff';ctx.beginPath();ctx.ellipse(15,-28,5,7,.25,0,7);ctx.stroke();ctx.restore();}else{const blink=.45+.55*Math.abs(Math.sin(t/280));ctx.save();ctx.beginPath();ctx.arc(px,py,10+blink*4,0,7);ctx.fillStyle=`rgba(224,60,60,${.22*blink})`;ctx.fill();ctx.beginPath();ctx.arc(px,py,6,0,7);ctx.fillStyle='#e03c3c';ctx.globalAlpha=blink;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();ctx.restore();}
 host.querySelector('.world-position').textContent=`${Math.round(zoom*100)}% · ${Math.floor(player.x)}, ${Math.floor(player.y)}${!source&&zoom>=detailZoom&&!tiles.getStatus().ready? (tiles.getStatus().failed?" · 区画を再読込中":" · 詳細読込中"):""}`;raf=requestAnimationFrame(frame);}
 host.dataset.mode=mode;if(startWalking)walk();raf=requestAnimationFrame(frame);
 return{getPosition:()=>({...player}),getTileStatus:()=>tiles.getStatus(),getMode:()=>mode,setOverview(value){if(value)showOverview();else walk();},setPaused(value){paused=!!value;cancel();route=[];},destroy(){alive=false;cancelAnimationFrame(raf);tiles.destroy();ro.disconnect();events.abort();host.innerHTML='';host.classList.remove('world-view');}};
}
