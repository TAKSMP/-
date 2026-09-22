import {createHash} from 'node:crypto';
import {TileStore,visibleTiles} from './tile-store.js';
import assert from 'node:assert/strict';import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync(new URL('./tiles.json',import.meta.url)));
for(const p of manifest.tiles){assert(fs.existsSync(new URL(p.file,import.meta.url)));const svg=fs.readFileSync(new URL(p.file,import.meta.url),'utf8');assert(svg.includes(`viewBox="${p.x*64} ${p.y*64} ${p.width} ${p.height}"`));assert(svg.includes(`width="${p.width*16}"`));}
assert.equal(new Set(manifest.tiles.map(p=>`${p.x}_${p.y}`)).size,manifest.tiles.length);
const map=JSON.parse(fs.readFileSync(new URL('./map.json',import.meta.url)));assert.equal(map.schemaVersion,3);
let active=0,peak=0,loads=0;const store=new TileStore(manifest,{resolve:x=>x,maxCache:12,concurrency:3,load:async()=>{loads++;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;return {};}});
for(const p of manifest.tiles.filter((p,i)=>i%35===0)){store.request({left:p.x*64,top:p.y*64,right:p.x*64+63,bottom:p.y*64+63});await new Promise(r=>setTimeout(r,18));assert(store.cache.size<=12);}
assert(peak<=3);assert(loads>12);store.destroy();assert.equal(store.cache.size,0);
let called=0;const failed=new TileStore(manifest,{resolve:x=>x,load:async()=>{called++;throw Error('offline');}});const p=manifest.tiles[0],view={left:p.x*64,top:p.y*64,right:p.x*64+1,bottom:p.y*64+1};failed.request(view);await new Promise(r=>setTimeout(r,10));const before=called;failed.request(view);await new Promise(r=>setTimeout(r,10));assert.equal(called,before);assert(failed.getStatus().failed>0);failed.destroy();
console.log(JSON.stringify({tileFiles:manifest.tiles.length,coordinateHeaders:true,nativeScale:16,collisionUnchanged:true,cacheLimitPassed:true,concurrencyPeak:peak,retryBackoff:true}));

assert.equal(createHash('sha256').update(fs.readFileSync(new URL('./terrain.bin',import.meta.url))).digest('hex'),'877739a5a384afa0e3eaa1494de850fbb5b114a993aaa4fe4127022cd8fddb75');
