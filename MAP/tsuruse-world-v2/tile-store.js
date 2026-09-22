// Independent SVG chunks, bounded decoded-image cache, capped concurrent I/O.
export function visibleTiles(manifest,view,padding=0){
 const t=manifest.tileSize, x0=Math.max(0,Math.floor(view.left/t)-padding),y0=Math.max(0,Math.floor(view.top/t)-padding),x1=Math.min(manifest.columns-1,Math.floor(view.right/t)+padding),y1=Math.min(manifest.rows-1,Math.floor(view.bottom/t)+padding);
 const cx=(view.left+view.right)/2/t,cy=(view.top+view.bottom)/2/t;
 return manifest.tiles.filter(p=>p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1).sort((a,b)=>Math.hypot(a.x+.5-cx,a.y+.5-cy)-Math.hypot(b.x+.5-cx,b.y+.5-cy));
}
export class TileStore {
 constructor(manifest,{resolve,load,maxCache=24,concurrency=3}={}){
  this.manifest=manifest;this.resolve=resolve;this.load=load||((url,signal)=>new Promise((yes,no)=>{const im=new Image();const abort=()=>{im.src='';no(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',abort,{once:true});im.onload=()=>{signal.removeEventListener('abort',abort);yes(im);};im.onerror=()=>{signal.removeEventListener('abort',abort);no(Error('Tile load failed'));};im.src=url;}));
  this.maxCache=maxCache;this.concurrency=concurrency;this.cache=new Map();this.pending=new Set();this.failed=new Map();this.queue=[];this.wanted=new Set();this.alive=true;this.abort=new AbortController();
 }
 key(p){return `${p.x}_${p.y}`;}
 request(view){
  if(!this.alive)return;
  const required=visibleTiles(this.manifest,view),extra=visibleTiles(this.manifest,view,1).filter(p=>!required.includes(p)).slice(0,4);
  this.wanted=new Set(required.map(p=>this.key(p)));
  const candidates=[...required,...extra].slice(0,this.maxCache);
  this.queue=candidates.filter(p=>{const k=this.key(p);return !this.cache.has(k)&&!this.pending.has(k)&&(this.failed.get(k)||0)<Date.now();});
  this.trim();this.pump();
 }
 trim(){while(this.cache.size>this.maxCache){const k=[...this.cache.keys()].find(k=>!this.wanted.has(k))||this.cache.keys().next().value;this.cache.get(k)?.close?.();this.cache.delete(k);}}
 pump(){while(this.alive&&this.pending.size<this.concurrency&&this.queue.length){const p=this.queue.shift(),key=this.key(p);this.pending.add(key);this.load(this.resolve(p.file),this.abort.signal).then(im=>{if(!this.alive){im.close?.();return;}this.cache.set(key,im);this.failed.delete(key);this.trim();}).catch(()=>{if(this.alive)this.failed.set(key,Date.now()+5000);}).finally(()=>{this.pending.delete(key);this.pump();});}}
 draw(ctx,view){for(const p of visibleTiles(this.manifest,view)){const k=this.key(p),im=this.cache.get(k);if(!im)continue;this.cache.delete(k);this.cache.set(k,im);ctx.drawImage(im,p.x*this.manifest.tileSize,p.y*this.manifest.tileSize,p.width,p.height);}}
 getStatus(){return {cached:this.cache.size,loading:this.pending.size,failed:this.failed.size,ready:[...this.wanted].every(k=>this.cache.has(k))};}
 destroy(){this.alive=false;this.abort.abort();this.queue=[];for(const im of this.cache.values())im.close?.();this.cache.clear();}
}
