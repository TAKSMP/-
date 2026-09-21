import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canStand,movePlayer} from './field.js';
const map=JSON.parse(fs.readFileSync(new URL('./map.json',import.meta.url)));
assert(canStand(map,map.spawn.x,map.spawn.y));assert(!canStand(map,-1,500));assert(!canStand(map,715,680));
let samples=0;const path=map.walkable.corridors[0].points;
path.forEach((b,i)=>{if(!i)return;const a=path[i-1];for(let j=0;j<=20;j++){const t=j/20;assert(canStand(map,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t),`path ${i} ${t}`);samples++;}});
const p={...map.spawn};movePlayer(map,p,3000,0);assert(canStand(map,p.x,p.y));assert(p.x<map.width);
const step=6,seen=new Set(),queue=[[Math.round(map.spawn.x/step),Math.round(map.spawn.y/step)]];seen.add(queue[0].join(','));
for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,key=nx+','+ny;if(!seen.has(key)&&canStand(map,nx*step,ny*step)){seen.add(key);queue.push([nx,ny]);}}}
for(const z of map.zones)assert(queue.some(([x,y])=>x*step>=z.x&&x*step<=z.x+z.width&&y*step>=z.y&&y*step<=z.y+z.height),`zone unreachable: ${z.id}`);
console.log(`PASS: spawn, ${samples} perimeter samples, obstacles, swept movement, all ${map.zones.length} zones reachable.`);
