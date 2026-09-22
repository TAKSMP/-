import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decodeRoads,isRoad,nearestRoad,findRoute,move} from './navigation.js';
const map=JSON.parse(fs.readFileSync(new URL('./map.json',import.meta.url))),mask=decodeRoads(map);
assert.equal(mask.reduce((a,b)=>a+b,0),227599);
assert(isRoad(map,mask,map.spawn.x,map.spawn.y));
const tiles=JSON.parse(fs.readFileSync(new URL('./tiles.json',import.meta.url))).tiles;assert.equal(tiles.length,240);for(const t of tiles)assert(fs.existsSync(new URL(t.file,import.meta.url)));
let route;
search:for(let dy=-30;dy<=30;dy+=10)for(let dx=-30;dx<=30;dx+=10){const target=nearestRoad(map,mask,map.spawn.x+dx,map.spawn.y+dy,8);if(!target||Math.hypot(target.x-map.spawn.x,target.y-map.spawn.y)<10)continue;const candidate=findRoute(map,mask,map.spawn,target);if(candidate?.length>10){route=candidate;break search;}}
assert(route?.length>10);const p={...map.spawn};
for(const goal of route){let guard=0;while(Math.hypot(goal.x-p.x,goal.y-p.y)>.01){assert(guard++<100);const d=Math.hypot(goal.x-p.x,goal.y-p.y),n=Math.min(.15,d);move(map,mask,p,(goal.x-p.x)/d*n,(goal.y-p.y)/d*n);assert(isRoad(map,mask,p.x,p.y));}}
const v=JSON.parse(fs.readFileSync(new URL('./verification.json',import.meta.url)));assert.equal(v.roadPixelMismatches,0);assert.equal(v.decorationBoxesOverRoad,0);assert.equal(v.spriteUpscales,0);assert(v.seamTests.every(t=>t.differingPixels===0));console.log(JSON.stringify({pass:true,pathSteps:route.length,tiles:tiles.length}));
