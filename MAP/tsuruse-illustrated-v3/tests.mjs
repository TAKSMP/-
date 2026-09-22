import fs from 'node:fs';import assert from 'node:assert/strict';import {loadIllustratedMap} from './background.js';
const m=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url)));assert.equal(m.generatedCount,13);assert.equal(m.pendingCount,0);
for(const t of m.tiles){assert(fs.existsSync(new URL(t.file,import.meta.url)));const [x,y,w,h]=t.sourceRect;assert(x>=0&&y>=0&&x+w<=t.nativeWidth+.001&&y+h<=t.nativeHeight+.001);assert(t.nativePixelsPerMapUnit>=3.5);}
globalThis.document={baseURI:'https://example.test/fields/'};let active=0,peak=0,loads=0;
globalThis.Image=class{set src(v){loads++;active++;peak=Math.max(peak,active);setTimeout(()=>{active--;this.onload();},1);}};
const api=await loadIllustratedMap({manifest:m});const ctx=new Proxy({},{get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});const view={cx:650,cy:601,zoom:.3,width:1000,height:1000};api.draw(ctx,view);
for(let i=0;i<30&&!api.status().ready;i++)await new Promise(r=>setTimeout(r,3));assert(api.status().ready);assert.equal(loads,14);for(let i=0;i<5;i++)api.draw(ctx,view);assert.equal(loads,14,'whole-map view must not thrash cache');assert(peak<=2);api.destroy();
console.log(JSON.stringify({files:13,cropBounds:true,densityMinimum:m.minimumNativeScale,concurrencyPeak:peak,allViewNoReloadLoop:true,browser:'not tested',roadAlignment:'not verified'}));
