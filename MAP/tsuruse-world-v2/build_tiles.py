"""Rebuild code-native SVG scenery from source-coordinate terrain; never upscale a bitmap.
Requires numpy, scipy and contourpy. Collision data is not modified.
"""
from pathlib import Path
import numpy as np, json, math, contourpy
from scipy import ndimage as nd
R=Path(__file__).parent
m=json.loads((R/'map.json').read_text());W,H=m['width'],m['height'];T=64;S=16
terrain=np.fromfile(R/'terrain.bin',np.uint8).reshape(H,W)
features=[]
def add(svg,bounds):features.append((svg,bounds))
def path(points):
 return 'M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+'Z'
def outlines(mask,ox=0,oy=0):
 # Pixel centers are at n+.5. Marching-squares gives continuous boundaries.
 pad=nd.gaussian_filter(np.pad(mask.astype(float),3),.5)
 gen=contourpy.contour_generator(x=np.arange(pad.shape[1])-2.5+ox,y=np.arange(pad.shape[0])-2.5+oy,z=pad,line_type='Separate')
 return gen.lines(.5)
def compound(mask,color):
 for p in outlines(mask):
  # These are separately filled only for coverage; use global compound path for holes below.
  pass
 points=outlines(mask)
 if points:add(f'<path fill="{color}" fill-rule="evenodd" d="'+''.join(path(p) for p in points)+'"/>',(0,0,W,H))
# Global land boundaries are compacted into one symbol and reused across tiles.
base=[]
for mask,color in [(terrain>0,'#d6dfa7'),(terrain==3,'#91be72'),(terrain==4,'#7fbabf'),(terrain==5,'#adb8b8')]:
 points=outlines(mask)
 base.append(f'<path fill="{color}" fill-rule="evenodd" d="'+''.join(path(p) for p in points)+'"/>')
# Rather than copy the whole world into each tile, slice each semantic mask locally with overlap.
labels,n=nd.label(terrain==2);objects=nd.find_objects(labels);palette=[('#647c93','#8da5b5','#445971'),('#aa755e','#c99775','#825746'),('#728f89','#a2b7a0','#506c66'),('#a49573','#d1c09a','#7e7259'),('#747b87','#9ca8b3','#545b68')]
roofs=0
for i,sl in enumerate(objects,1):
 if sl is None:continue
 y0,y1=sl[0].start,sl[0].stop;x0,x1=sl[1].start,sl[1].stop
 mask=labels[sl]==i
 if mask.sum()<5:continue
 ps=outlines(mask,x0,y0);d=''.join(path(p)for p in ps)
 if not d:continue
 color,light,dark=palette[(i*7)%len(palette)];cx=(x0+x1)/2;cy=(y0+y1)/2;bw=x1-x0;bh=y1-y0
 uid=f'r{i}';vertical=bh>bw
 ridge=f'M{cx:.2f} {y0}V{y1}' if vertical else f'M{x0} {cy:.2f}H{x1}'
 shade=f'<rect x="{cx}" y="{y0}" width="{bw}" height="{bh}" fill="{dark}"/>' if vertical else f'<rect x="{x0}" y="{cy}" width="{bw}" height="{bh}" fill="{dark}"/>'
 # Everything, including small dormers, remains inside its extracted building footprint.
 detail=f'<path d="{d}" fill="{color}" stroke="#46514c" stroke-width=".30"/>{shade}<path d="{ridge}" stroke="{light}" stroke-width=".22"/>'
 for yy in np.arange(y0+.5,y1,.85):detail+=f'<path d="M{x0} {yy:.2f}H{x1}" stroke="{light}" stroke-opacity=".25" stroke-width=".07"/>'
 if bw>4 and bh>4:
  detail+=f'<rect x="{cx-1:.2f}" y="{cy-1.4:.2f}" width="1.2" height=".75" rx=".08" fill="#c4dadd" stroke="{dark}" stroke-width=".15"/><path d="M{cx-.4:.2f} {cy-1.4:.2f}v.75" stroke="#748995" stroke-width=".1"/>'
 if bw>9 and bh>6:
  detail+=f'<rect x="{x0+1}" y="{y0+1}" width="2.6" height="1.7" rx=".12" fill="#d4d6c4" stroke="#68797a" stroke-width=".12"/><circle cx="{x0+1.7}" cy="{y0+1.8}" r=".4" fill="#869490"/>'
 svg=f'<defs><clipPath id="{uid}"><path d="{d}" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#{uid})">{detail}</g>'
 add(svg,(x0,y0,x1,y1));roofs+=1
# Deliberately non-colliding decorations: trees fit inside green pixels only.
dist=nd.distance_transform_edt(terrain==3);rng=np.random.default_rng(72026);trees=0
for yy in np.arange(2,H,3.4):
 for xx in np.arange(2,W,3.4):
  x=xx+rng.uniform(-.8,.8);y=yy+rng.uniform(-.8,.8);space=dist[min(H-1,int(y)),min(W-1,int(x))]
  if space<1.7 or rng.random()<.3:continue
  rad=min(space-.5,rng.uniform(1.15,2));uid=f't{trees}'
  svg=f'<g><ellipse cx="{x+.35:.2f}" cy="{y+.5:.2f}" rx="{rad:.2f}" ry="{rad*.76:.2f}" fill="#486c44" opacity=".28"/><path d="M{x:.2f} {y:.2f}v{rad:.2f}" stroke="#816945" stroke-width=".35"/><circle cx="{x:.2f}" cy="{y:.2f}" r="{rad:.2f}" fill="#3f8050"/><circle cx="{x-.24:.2f}" cy="{y-.30:.2f}" r="{rad*.82:.2f}" fill="#62a55e"/><circle cx="{x-.42:.2f}" cy="{y-.54:.2f}" r="{rad*.54:.2f}" fill="#91bd67"/><circle cx="{x+.6:.2f}" cy="{y-.25:.2f}" r="{rad*.40:.2f}" fill="#7bb35e"/></g>'
  add(svg,(x-rad,y-rad,x+rad+.4,y+rad+.5));trees+=1
# Bin detail geometry once, preserving order and global coordinates at tile boundaries.
cols=math.ceil(W/T);rows=math.ceil(H/T);bins={(x,y):[]for y in range(rows)for x in range(cols)}
for svg,(x0,y0,x1,y1) in features:
 for ty in range(max(0,int(y0//T)),min(rows-1,int(y1//T))+1):
  for tx in range(max(0,int(x0//T)),min(cols-1,int(x1//T))+1):bins[tx,ty].append(svg)
tiles=[]
for ty in range(rows):
 for tx in range(cols):
  x=tx*T;y=ty*T;tw=min(T,W-x);th=min(T,H-y)
  if not np.any(terrain[y:y+th,x:x+tw]):continue
  margin=4;lx=max(0,x-margin);ly=max(0,y-margin);ux=min(W,x+tw+margin);uy=min(H,y+th+margin);local=terrain[ly:uy,lx:ux]
  layers=[]
  for cls,color in [(0,'#d6dfa7'),(3,'#91be72'),(4,'#7fbabf'),(5,'#adb8b8')]:
   mask=local>0 if cls==0 else local==cls
   ps=outlines(mask,lx,ly)
   if ps:layers.append(f'<path fill="{color}" fill-rule="evenodd" d="'+''.join(path(p)for p in ps)+'"/>')
  # Fine gravel/pavement texture is vector and below all buildings, with no invented traffic markings.
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{tw*S}" height="{th*S}" viewBox="{x} {y} {tw} {th}"><rect x="{x}" y="{y}" width="{tw}" height="{th}" fill="#ece8db"/>'+''.join(layers)+''.join(bins[tx,ty])+'</svg>'
  name=f'{tx}_{ty}.svg';(R/'assets/tiles'/name).write_text(svg)
  tiles.append(dict(x=tx,y=ty,file='assets/tiles/'+name,width=tw,height=th))
manifest=dict(version=1,tileSize=T,pixelsPerSourceUnit=S,width=W,height=H,columns=cols,rows=rows,background='#ece8db',tiles=tiles)
(R/'tiles.json').write_text(json.dumps(manifest,separators=(',',':')))
# Overview includes the same scene at lower resolution; walking uses independently rendered SVG tiles.
(R/'assets/overview.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#ece8db"/>'+''.join(base)+''.join(s for s,b in features)+'</svg>')
m['schemaVersion']=3;m['tiles']='tiles.json';m['images']['game']='assets/overview.png';m['rendering']={'type':'svg-chunks','walkZoom':8,'maxZoom':8,'devicePixelRatioCap':2,'tileSizeSource':T,'tileNativeScale':S,'geometry':'source-coordinate marching squares','style':'procedural roof and tree illustration'}
m['notes']=[v for v in m['notes']if 'logicalWorldSize' not in v];m['notes'].append('歩行表示は座標を固定したSVG区画を都度読み込み。建物の屋根色・屋根細部・樹木は装飾であり、実際の外観とは異なります。')
(R/'map.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')))
(R/'build-summary.json').write_text(json.dumps(dict(tiles=len(tiles),roofs=roofs,trees=trees,worldSize=[W*8,H*8],nativeDetailScale=S,sourceRoadDataUnchanged=True),indent=2))
print(dict(tiles=len(tiles),roofs=roofs,trees=trees))
