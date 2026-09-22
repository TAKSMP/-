// Background-only renderer. No collision or navigation is supplied by this asset pack.
export async function loadIllustratedMap({baseUrl='./',manifest,resolve,onChange=()=>{}}={}){
 const root=new URL(baseUrl,document.baseURI),url=resolve||(p=>new URL(p,root).href);
 if(!manifest){const r=await fetch(url('manifest.json'));if(!r.ok)throw Error(`Map HTTP ${r.status}`);manifest=await r.json();}
 const load=p=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>no(Error(`Cannot load ${p}`));im.src=url(p);});
 const original=await load(manifest.baseImage),cache=new Map(),pending=new Set(),failures=new Map();let alive=true,wanted=[],queue=[];
 function pump(){while(alive&&pending.size<2&&queue.length){const t=queue.shift();pending.add(t.id);load(t.file).then(im=>{if(!alive)return;cache.set(t.id,im);failures.delete(t.id);while(cache.size>16)cache.delete(cache.keys().next().value);}).catch(()=>failures.set(t.id,Date.now()+5000)).finally(()=>{pending.delete(t.id);if(alive){onChange();pump();}});}}
 function draw(ctx,{cx,cy,zoom,width,height,dpr=1,originalOnly=false,boundaries=false}){
  if(!alive)return;const l=cx-width/2/zoom,r=cx+width/2/zoom,top=cy-height/2/zoom,b=cy+height/2/zoom;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#fbf9ec';ctx.fillRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(original,0,0,manifest.width,manifest.height);
  wanted=manifest.tiles.filter(t=>t.file&&t.x<r&&t.y<b&&t.x+t.width>l&&t.y+t.height>top);
  if(!originalOnly){queue=wanted.filter(t=>!cache.has(t.id)&&!pending.has(t.id)&&(failures.get(t.id)||0)<Date.now());pump();
   for(const t of wanted){const im=cache.get(t.id);if(!im)continue;ctx.drawImage(im,...t.sourceRect,t.x,t.y,t.width,t.height);}
  }
  if(boundaries){ctx.lineWidth=1/zoom;for(const t of manifest.tiles){ctx.strokeStyle=t.file?'#326d52':'#b9643c';ctx.strokeRect(t.x,t.y,t.width,t.height);ctx.font=`${12/zoom}px sans-serif`;ctx.fillStyle=ctx.strokeStyle;ctx.fillText(`${t.id} ${t.file?'詳細あり':'未生成'}`,t.x+4/zoom,t.y+15/zoom);}}
  ctx.restore();
 }
 return {manifest,draw,status:()=>({ready:wanted.every(t=>cache.has(t.id)),loading:pending.size,failed:failures.size}),destroy(){alive=false;queue=[];cache.clear();}};
}
