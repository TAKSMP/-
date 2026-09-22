const fs=require('node:fs'),sharp=require(process.env.SHARP_MODULE||'sharp');
(async()=>{const r=__dirname+'/',m=JSON.parse(fs.readFileSync(r+'manifest.json')),s=3.5,W=Math.round(m.width*s),H=Math.round(m.height*s),layers=[];
for(const t of m.tiles){const [x,y,w,h]=t.sourceRect;const left=Math.round(t.x*s),top=Math.round(t.y*s),width=Math.round((t.x+t.width)*s)-left,height=Math.round((t.y+t.height)*s)-top;
const input=await sharp(r+t.file).extract({left:Math.floor(x),top:Math.floor(y),width:Math.min(t.nativeWidth-Math.floor(x),Math.round(w)),height:Math.min(t.nativeHeight-Math.floor(y),Math.round(h))}).resize(width,height).png().toBuffer();layers.push({input,left,top});}
await sharp({create:{width:W,height:H,channels:3,background:'#fdfbee'}}).composite(layers).png().toFile(r+'map-art-review.png');
await sharp(r+'map-art-review.png').resize(1600).png().toFile(r+'overview-review.png');console.log({width:W,height:H});})();
