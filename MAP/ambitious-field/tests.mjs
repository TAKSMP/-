import fs from 'node:fs';import assert from 'node:assert/strict';import {canStand,movePlayer} from './field.js';
const m=JSON.parse(fs.readFileSync(new URL('./map.json',import.meta.url)));const step=5;
const cols=Math.ceil(m.width/step)+1,rows=Math.ceil(m.height/step)+1,free=new Uint8Array(cols*rows);
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)free[y*cols+x]=+canStand(m,x*step,y*step);
function index(p){return Math.round(p.y/step)*cols+Math.round(p.x/step);}
const seen=new Uint8Array(free.length),queue=[index(m.spawn)];seen[queue[0]]=1;
for(let i=0;i<queue.length;i++){let k=queue[i],x=k%cols,y=Math.floor(k/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+dx,ny=y+dy,j=ny*cols+nx;if(nx<0||nx>=cols||ny<0||ny>=rows||!free[j]||seen[j])continue;let valid=true;for(let t=1;t<=5;t++)if(!canStand(m,(x+dx*t/5)*step,(y+dy*t/5)*step))valid=false;if(valid){seen[j]=1;queue.push(j);}}}
for(const p of [...m.entrances,...m.checkpoints]){assert(canStand(m,p.x,p.y),`blocked ${p.id}`);assert(seen[index(p)],`unreachable ${p.id}`);console.log('PASS reachable',p.id);}
for(const [x,y]of[[500,350],[649,433],[741,804],[82,961]])assert(!canStand(m,x,y),`nonwalkable ${x},${y}`);
const p={...m.spawn};movePlayer(m,p,1500,0);assert(canStand(m,p.x,p.y));
console.log('PASS buildings, garage, courts, railway blocked; large move stays on walkable ground.');
fs.writeFileSync(new URL('./validation.json',import.meta.url),JSON.stringify({geometry:'passed',gridStep:step,sweptEdgeStep:1,reachableSamples:queue.length,entrances:m.entrances.map(p=>p.id),destinations:m.checkpoints.map(p=>p.id),browser:'not tested',mobileDevice:'not tested'},null,2));

for(const c of m.walkable.corridors.filter(c=>c.id.includes("entrance"))){for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i];for(let j=0;j<=100;j++){const t=j/100;assert(canStand(m,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),`entrance corridor blocked ${c.id}`);}}console.log("PASS direct entry corridor",c.id);}
