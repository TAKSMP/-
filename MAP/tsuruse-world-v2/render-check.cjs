// Development-only: requires sharp (npm install --no-save sharp).
const fs=require('node:fs');
const sharp=require(process.env.SHARP_MODULE||'sharp');
(async()=>{
 const root=__dirname+'/';
 await sharp(root+'assets/overview.svg').png().toFile(root+'assets/overview.png');
 await sharp(root+'assets/tiles/6_25.svg').png().toFile(root+'detail-preview.png');
 const whole=fs.readFileSync(root+'assets/overview.svg','utf8').replace(/width="2048" height="1885" viewBox="0 0 2048 1885"/,'width="2048" height="1024" viewBox="384 1600 128 64"');
 const expected=await sharp(Buffer.from(whole)).ensureAlpha().raw().toBuffer();
 const a=await sharp(root+'assets/tiles/6_25.svg').png().toBuffer(),b=await sharp(root+'assets/tiles/7_25.svg').png().toBuffer();
 const actual=await sharp({create:{width:2048,height:1024,channels:4,background:'#ece8db'}}).composite([{input:a,left:0,top:0},{input:b,left:1024,top:0}]).raw().toBuffer();
 let sum=0,max=0,edgeSum=0,n=0;
 for(let y=0;y<1024;y++)for(let x=0;x<2048;x++)for(let c=0;c<3;c++){const i=(y*2048+x)*4+c,d=Math.abs(actual[i]-expected[i]);sum+=d;max=Math.max(max,d);if(x>=1022&&x<=1025){edgeSum+=d;n++;}}
 const report={meanChannelError:sum/(2048*1024*3),maxChannelError:max,seamMeanError:edgeSum/n};
 if(report.seamMeanError>2)throw Error('Visible tile seam: '+JSON.stringify(report));
 fs.writeFileSync(root+'render-validation.json',JSON.stringify(report,null,2));console.log(report);
})();
