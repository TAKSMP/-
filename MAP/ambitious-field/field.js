/** Coordinates are source-image pixels. Player position means feet, not sprite center. */
export function pointInPolygon(x,y,p) {
  let inside=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++) {
    const [ax,ay]=p[i],[bx,by]=p[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}
function segmentDistance(x,y,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/length)):0;
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
export function inShape(x,y,s){
  if(s.type==='ellipse') return ((x-s.x)/s.rx)**2+((y-s.y)/s.ry)**2<=1;
  return x>=s.x && y>=s.y && x<=s.x+s.width && y<=s.y+s.height;
}
function clearPoint(map,x,y){
  if(x<0||y<0||x>map.width||y>map.height) return false;
  let allowed=map.walkable.polygons.some(p=>pointInPolygon(x,y,p.points));
  if(!allowed) allowed=map.walkable.corridors.some(p=>p.points.some((b,i)=>i>0&&segmentDistance(x,y,p.points[i-1],b)<=p.radius));
  return allowed&&!map.obstacles.some(s=>inShape(x,y,s));
}
export function canStand(map,x,y,radius=map.player.radius){
  if(!clearPoint(map,x,y)) return false;
  for(let i=0;i<8;i++) if(!clearPoint(map,x+Math.cos(i*Math.PI/4)*radius,y+Math.sin(i*Math.PI/4)*radius)) return false;
  return true;
}
export function movePlayer(map,p,dx,dy){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
  for(let i=0;i<steps;i++){
    if(canStand(map,p.x+dx/steps,p.y)) p.x+=dx/steps;
    if(canStand(map,p.x,p.y+dy/steps)) p.y+=dy/steps;
  }
  return p;
}
export async function createField(host,{map,imageUrl,onZoneEnter=()=>{},drawPlayer=null,signal=null}={}){
  if(!map||map.schemaVersion!==1) throw new Error('Unsupported map schema');
  if(!canStand(map,map.spawn.x,map.spawn.y)) throw new Error('Spawn is blocked');
  const img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('背景画像を読み込めませんでした'));img.src=imageUrl||map.background;});
  if(img.naturalWidth!==map.width||img.naturalHeight!==map.height) throw new Error('Map/image size mismatch');
  if(signal?.aborted) throw new DOMException('Aborted','AbortError');
  host.classList.add('yuyuu-field');
  host.innerHTML='<canvas aria-label="アンビシャス 歩行フィールド" tabindex="0"></canvas><div class="field-hud"><strong></strong><span>十字キー・WASD / 左下のパッドで歩く</span></div><div class="field-tools"><button type="button" data-action="debug">通行範囲</button><button type="button" data-action="reset">入口へ</button></div><div class="field-stick" role="group" aria-label="移動パッド"><i></i><b>＋</b></div><output class="field-zone" aria-live="polite"></output>';
  host.querySelector('strong').textContent=map.name;
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),stick=host.querySelector('.field-stick'),knob=stick.querySelector('i'),zoneText=host.querySelector('output');
  const p={...map.spawn},keys=new Set(),abort=new AbortController(),opts={signal:abort.signal};
  let running=true,paused=false,raf=0,last=0,debug=false,axis={x:0,y:0},pointer=null,w=1,h=1,dpr=1,zoneId=null,travel=0;
  const resize=()=>{w=Math.max(1,host.clientWidth);h=Math.max(1,host.clientHeight);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function resetInput(){keys.clear();axis={x:0,y:0};pointer=null;knob.style.transform='translate(0px,0px)';}
  function axisFrom(e){const r=stick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy),max=42;
    axis=length<9?{x:0,y:0}:{x:dx/Math.max(max,length),y:dy/Math.max(max,length)};
    knob.style.transform=`translate(${axis.x*max}px,${axis.y*max}px)`;
  }
  stick.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;stick.setPointerCapture(pointer);canvas.focus({preventScroll:true});axisFrom(e);e.preventDefault();},opts);
  stick.addEventListener('pointermove',e=>{if(e.pointerId===pointer)axisFrom(e);},opts);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId===pointer)resetInput();},opts);
  const accepted=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
  host.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(accepted.includes(k)){e.preventDefault();keys.add(k);}},opts);
  host.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key);},opts);
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}),opts);
  host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))resetInput();},opts);
  window.addEventListener('blur',resetInput,opts);
  document.addEventListener('visibilitychange',()=>{resetInput();last=0;},opts);
  host.querySelector('[data-action=reset]').addEventListener('click',()=>{Object.assign(p,map.spawn);resetInput();zoneId=null;canvas.focus();},opts);
  host.querySelector('[data-action=debug]').addEventListener('click',()=>{debug=!debug;},opts);
  function shape(s){ctx.beginPath();if(s.type==='ellipse')ctx.ellipse(s.x,s.y,s.rx,s.ry,0,0,Math.PI*2);else ctx.rect(s.x,s.y,s.width,s.height);ctx.fill();}
  function render(t){
    if(!running)return;
    const dt=last?Math.min((t-last)/1000,.05):0;last=t;
    let vx=axis.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),vy=axis.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
    const n=Math.hypot(vx,vy);if(n>1){vx/=n;vy/=n;}
    if(!paused&&!document.hidden){const oldX=p.x,oldY=p.y;movePlayer(map,p,vx*map.player.speed*dt,vy*map.player.speed*dt);travel+=Math.hypot(p.x-oldX,p.y-oldY);if(n>.1)p.facing=Math.abs(vx)>Math.abs(vy)?(vx>0?'right':'left'):(vy>0?'down':'up');}
    const zone=map.zones.find(z=>inShape(p.x,p.y,z));
    if((zone?.id||null)!==zoneId){zoneId=zone?.id||null;zoneText.textContent=zone?.name||'';if(zone)onZoneEnter({...zone},{x:p.x,y:p.y});}
    const zoom=map.camera.zoom,viewW=w/zoom,viewH=h/zoom;
    let cx=p.x-viewW/2,cy=p.y-viewH/2;
    if(map.camera.clampToMap){cx=viewW>=map.width?(map.width-viewW)/2:Math.max(0,Math.min(map.width-viewW,cx));cy=viewH>=map.height?(map.height-viewH)/2:Math.max(0,Math.min(map.height-viewH,cy));}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#b8d88a';ctx.fillRect(0,0,w,h);ctx.scale(zoom,zoom);ctx.translate(-cx,-cy);ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0);
    if(debug){ctx.fillStyle='#28eaff55';for(const poly of map.walkable.polygons){ctx.beginPath();poly.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}ctx.strokeStyle='#28eaff66';ctx.lineCap='round';ctx.lineJoin='round';for(const c of map.walkable.corridors){ctx.lineWidth=c.radius*2;ctx.beginPath();c.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}ctx.fillStyle='#ff254f99';map.obstacles.forEach(shape);}
    if(drawPlayer){ctx.save();drawPlayer(ctx,{...p,travel,moving:n>.1&&!paused});ctx.restore();}
    else {const x=Math.round(p.x),y=Math.round(p.y),step=n>.1&&!paused?Math.sin(travel*.35)*2:0;ctx.fillStyle='#233b4166';ctx.beginPath();ctx.ellipse(x,y,9,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#314c5f';ctx.fillRect(x-6,y-7+step,4,7);ctx.fillRect(x+2,y-7-step,4,7);ctx.fillStyle='#f8d668';ctx.fillRect(x-8,y-20,16,13);ctx.fillStyle='#efc5a0';ctx.fillRect(x-6,y-29,12,10);ctx.fillStyle='#386869';ctx.fillRect(x-8,y-32,16,7);ctx.fillRect(x-10,y-27,20,3);ctx.fillStyle='#344552';if(p.facing!=='up'){const eye=p.facing==='left'?-4:p.facing==='right'?4:-3;ctx.fillRect(x+eye,y-23,2,2);if(p.facing==='down')ctx.fillRect(x+3,y-23,2,2);}}
    raf=requestAnimationFrame(render);
  }
  raf=requestAnimationFrame(render);
  return {setPosition(x,y){if(!canStand(map,x,y))throw new Error("通行できない位置です");p.x=x;p.y=y;zoneId=null;resetInput();},getPosition:()=>({...p}),setPaused(value){paused=!!value;resetInput();},setDebug(value){debug=!!value;},destroy(){running=false;cancelAnimationFrame(raf);observer.disconnect();abort.abort();host.innerHTML='';host.classList.remove('yuyuu-field');}};
}
