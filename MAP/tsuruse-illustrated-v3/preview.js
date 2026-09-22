import {loadIllustratedMap} from './background.js';
export async function startPreview(options={}){
 const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');let width=1,height=1,dpr=1,zoom=1.7,cx=490,cy=751,originalOnly=false,boundaries=false,drag=null;
 const renderer=await loadIllustratedMap(options),m=renderer.manifest,select=document.querySelector('select');
 for(const t of m.tiles.filter(t=>t.file)){const op=document.createElement('option');op.value=t.id;op.textContent=`区画 ${t.id}`;select.append(op);}select.value='1_2';
 select.onchange=()=>{const t=m.tiles.find(t=>t.id===select.value);cx=t.x+t.width/2;cy=t.y+t.height/2;zoom=1.7;};
 function fit(){cx=m.width/2;cy=m.height/2;zoom=Math.min(width/m.width,height/m.height)*.95;}
 document.querySelector('#overview').onclick=fit;
 document.querySelector('#source').onclick=e=>{originalOnly=!originalOnly;e.target.textContent=originalOnly?'詳細版に戻す':'元画像と比較';};
 document.querySelector('#bounds').onclick=e=>{boundaries=!boundaries;e.target.setAttribute('aria-pressed',String(boundaries));};
 document.querySelector('#plus').onclick=()=>zoom=Math.min(5,zoom*1.25);document.querySelector('#minus').onclick=()=>zoom=Math.max(.2,zoom/1.25);
 canvas.onpointerdown=e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx,cy};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(drag?.id===e.pointerId){cx=drag.cx-(e.clientX-drag.x)/zoom;cy=drag.cy-(e.clientY-drag.y)/zoom;}};
 canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.2,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
 const resize=new ResizeObserver(()=>{width=canvas.clientWidth;height=canvas.clientHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);});resize.observe(canvas);
 let alive=true,raf;function frame(){if(!alive)return;renderer.draw(ctx,{cx,cy,zoom,width,height,dpr,originalOnly,boundaries});const s=renderer.status();document.querySelector('#status').textContent=`${originalOnly?'元画像':'詳細13区画'} · ${zoom.toFixed(2)}倍${s.loading?' · 読込中':''}${s.failed?' · 再読込待ち':''}${zoom*dpr>m.minimumNativeScale?' · 原寸以上に拡大中':''}`;raf=requestAnimationFrame(frame);}frame();
 return {destroy(){alive=false;cancelAnimationFrame(raf);resize.disconnect();renderer.destroy();}};
}
