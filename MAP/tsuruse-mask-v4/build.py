from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import numpy as np
from scipy import ndimage as nd
import random,math,json,hashlib
from concurrent.futures import ThreadPoolExecutor
P=Path(__file__).resolve().parent
S=16;T=128;N=S*T;ROAD=(133,155,169);BASE=(231,231,207)
mask=np.array(Image.open(P/'roads-mask.png'))==255
H,W=mask.shape
assert (W,H)==(2048,1885)
assert hashlib.sha256((P/'roads-mask.png').read_bytes()).hexdigest()=='898491eec3488486f91f4b599b7537c37062f7619735143f3e7834f980cb7000'
rows=math.ceil(H/T);cols=math.ceil(W/T)
atlas=Image.open(P/'assets/atlas.png').convert('RGBA');sprites=[]
(P/'assets/sprites').mkdir(exist_ok=True)
for i in range(16):
 x=i%4;y=i//4
 im=atlas.crop((round(x*atlas.width/4),round(y*atlas.height/4),round((x+1)*atlas.width/4),round((y+1)*atlas.height/4)))
 im=im.crop(im.getchannel('A').getbbox());sprites.append(im);im.save(P/f'assets/sprites/{i}.png')
g=Image.open(P/'assets/ground.png').convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
ground=Image.new('RGB',(1024,1024));ground.paste(g,(0,0));ground.paste(ImageOps.mirror(g),(512,0));ground.paste(ImageOps.flip(g),(0,512));ground.paste(ImageOps.flip(ImageOps.mirror(g)),(512,512));ground.save(P/'assets/ground-repeat.png')
distance=nd.distance_transform_edt(~mask);land=distance<=45;occupied=mask.copy();rng=random.Random(20260922);instances=[]
def place(cx,cy,kind,size):
 i=rng.randrange(0,8) if kind=='house' else rng.randrange(8,12) if kind=='tree' else rng.randrange(12,16)
 src=sprites[i];scale=min(1,size*S/max(src.size));pw=round(src.width*scale);ph=round(src.height*scale);sw=math.ceil(pw/S);sh=math.ceil(ph/S)
 x=int(cx-sw/2);y=int(cy-sh/2);m=int(kind=='house')
 if x-m<0 or y-m<0 or x+sw+m>W or y+sh+m>H:return
 if occupied[y-m:y+sh+m,x-m:x+sw+m].any() or not land[y:y+sh,x:x+sw].all():return
 occupied[y:y+sh,x:x+sw]=True
 instances.append(dict(sprite=i,kind=kind,x=x*S,y=y*S,width=pw,height=ph,nativeWidth=src.width,nativeHeight=src.height))
points=[(x+rng.randrange(-3,4),y+rng.randrange(-3,4)) for y in range(8,H-8,6) for x in range(8,W-8,6)];rng.shuffle(points)
for x,y in points:
 if 3.5<distance[y,x]<38 and rng.random()<.97:place(x,y,'house',rng.choice([6,7,8,9,10]))
points=[(x+rng.randrange(-2,3),y+rng.randrange(-2,3)) for y in range(5,H-5,6) for x in range(5,W-5,6)];rng.shuffle(points)
for x,y in points:
 if 2<distance[y,x]<43 and rng.random()<.64:place(x,y,'tree' if rng.random()<.7 else 'garden',rng.choice([3,4,5,6,7]))
(P/'placements.json').write_text(json.dumps(instances,separators=(',',':')))
counts={k:sum(p['kind']==k for p in instances) for k in ['house','tree','garden']};print(counts,flush=True)
cache={key:sprites[key[0]].resize((key[1],key[2]),Image.Resampling.LANCZOS) for key in {(p['sprite'],p['width'],p['height']) for p in instances}}
bins={(x,y):[] for y in range(rows) for x in range(cols)}
for p in instances:
 for y in range(max(0,(p['y']-16)//N),min(rows-1,(p['y']+p['height']+15)//N)+1):
  for x in range(max(0,(p['x']-16)//N),min(cols-1,(p['x']+p['width']+15)//N)+1):bins[x,y].append(p)
def render(tx,ty,ext=0):
 ox=tx*N-ext;oy=ty*N-ext;tw=min(T,W-tx*T)*S+2*ext;th=min(T,H-ty*T)*S+2*ext
 im=Image.new('RGB',(tw,th),BASE)
 for y in range(oy//1024*1024,oy+th,1024):
  for x in range(ox//1024*1024,ox+tw,1024):im.paste(ground,(x-ox,y-oy))
 xs=np.clip((np.arange(tw)+ox)//S,0,W-1);ys=np.clip((np.arange(th)+oy)//S,0,H-1)
 a=np.array(im);a[~land[ys[:,None],xs[None,:]]]=BASE;im=Image.fromarray(a)
 candidates=bins[tx,ty] if not ext else [p for p in instances if p['x']-16<ox+tw and p['y']-16<oy+th and p['x']+p['width']+16>ox and p['y']+p['height']+16>oy]
 draw=ImageDraw.Draw(im)
 for p in candidates:
  if p['kind']=='house':draw.rounded_rectangle((p['x']-ox-12,p['y']-oy-12,p['x']-ox+p['width']+12,p['y']-oy+p['height']+12),radius=14,fill=(183,182,149))
 for p in candidates:
  sp=cache[p['sprite'],p['width'],p['height']];im.paste(sp,(p['x']-ox,p['y']-oy),sp)
 rm=mask[ys[:,None],xs[None,:]];a=np.array(im);acc=np.all(a==ROAD,axis=2)&~rm;a[acc,0]=132;a[rm]=ROAD
 return Image.fromarray(a),rm

def build(coord):
 tx,ty=coord;file=f'tiles/{tx}_{ty}.webp';path=P/file
 try:
  im=Image.open(path).convert('RGB');im.load();rm=np.repeat(np.repeat(mask[ty*T:min(H,(ty+1)*T),tx*T:min(W,(tx+1)*T)],S,0),S,1)
 except Exception:
  im,rm=render(tx,ty);tmp=path.with_suffix('.tmp');im.save(tmp,'WEBP',lossless=True,method=1);tmp.replace(path)
 decoded=np.array(Image.open(path).convert('RGB'));mismatch=int(np.count_nonzero(np.all(decoded==ROAD,axis=2)!=rm))
 return dict(x=tx,y=ty,file=file,width=im.width,height=im.height,mismatch=mismatch,roadPixels=int(rm.sum()),sha256=hashlib.sha256(path.read_bytes()).hexdigest())
if __name__=='__main__':
 tiles=[]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for t in pool.map(build,[(x,y) for y in range(rows) for x in range(cols)]):
   tiles.append(t)
   if len(tiles)%24==0:print('tiles',len(tiles),'/240',flush=True)
 seams=[]
 for x,y in [(7,7),(8,8),(6,10),(10,3),(3,11)]:
  im,_=render(x,y,16);saved=Image.open(P/f'tiles/{x}_{y}.webp').convert('RGB');a=np.array(im.crop((16,16,16+saved.width,16+saved.height)));seams.append(dict(x=x,y=y,differingPixels=int(np.any(a!=np.array(saved),axis=2).sum())))
 overlap=0
 for p in instances:
  m=int(p['kind']=='house');overlap+=int(mask[p['y']//S-m:math.ceil((p['y']+p['height'])/S)+m,p['x']//S-m:math.ceil((p['x']+p['width'])/S)+m].any())
 overview=Image.new('RGB',(W,H),BASE)
 for t in tiles:
  im=Image.open(P/t['file']);overview.paste(im.resize((im.width//S,im.height//S),Image.Resampling.LANCZOS),(t['x']*T,t['y']*T))
 overview.save(P/'overview.png')
 for label,x,y in [('center',7,8),('north',10,2),('south',4,11)]:
  im=Image.open(P/f'tiles/{x}_{y}.webp').convert('RGB');im.save(P/f'qa/{label}.png');im.resize((800,800)).save(P/f'qa/{label}-preview.jpg')
  m=Image.fromarray(mask[y*T:(y+1)*T,x*T:(x+1)*T].astype('uint8')*255).resize(im.size,Image.Resampling.NEAREST).convert('RGB');Image.blend(im,m,.5).save(P/f'qa/{label}-mask-overlay.png')
 _,components=nd.label(mask,np.ones((3,3)));report=dict(sourceRoadPixels=int(mask.sum()),nativeRoadPixels=sum(t['roadPixels'] for t in tiles),roadPixelMismatches=sum(t['mismatch'] for t in tiles),decorationBoxesOverRoad=overlap,spriteUpscales=sum(p['width']>p['nativeWidth'] or p['height']>p['nativeHeight'] for p in instances),seamTests=seams,components=components,counts=counts,totalTiles=len(tiles),nativeWidth=W*S,nativeHeight=H*S)
 assert report['roadPixelMismatches']==overlap==report['spriteUpscales']==0 and all(s['differingPixels']==0 for s in seams)
 (P/'verification.json').write_text(json.dumps(report,indent=2));(P/'manifest.json').write_text(json.dumps(dict(version=4,width=W,height=H,pixelsPerUnit=S,nativeWidth=W*S,nativeHeight=H*S,tileSizeSource=T,tileSizeNative=N,roadColor=ROAD,mask='roads-mask.png',overview='overview.png',tiles=tiles),indent=2));print(json.dumps(report),flush=True)
