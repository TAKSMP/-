"""Build coordinate-locked semantic map data from the supplied screenshot. No gap filling."""
from pathlib import Path
from PIL import Image
from scipy import ndimage as nd
import numpy as np,json,shutil,sys
root=Path(__file__).parent
source=Path(sys.argv[1]) if len(sys.argv)>1 else root/'assets/reference.png'
if source.resolve()!=(root/'assets/reference.png').resolve():shutil.copyfile(source,root/'assets/reference.png')
a=np.asarray(Image.open(source).convert('RGB')).astype(np.int16);h,w=a.shape[:2];r,g,b=a.transpose(2,0,1)
coverage=np.any(a<250,axis=2);coverage=nd.binary_fill_holes(coverage)
road=(np.max(abs(a-[157,174,190]),axis=2)<=45)&(b-r>=19)&(b-g>=7)&(g-r>=7)
labels,n=nd.label(road,np.ones((3,3)));sizes=np.bincount(labels.ravel());sizes[0]=0
keep=sizes>=20;road=keep[labels]
# Exact source-derived geometry; do not bridge text, stitching gaps, waterways or railways.
buildings=(np.max(abs(a-[224,226,229]),axis=2)<=7)&~road
parks=(np.max(abs(a-[185,237,203]),axis=2)<=24)&(g-r>28)&(g-b>13)&~road
water=(b-r>30)&(g-r>23)&(abs(b-g)<25)&(r>100)&~parks&~road
classes=np.zeros((h,w),dtype=np.uint8);classes[coverage]=1;classes[buildings]=2;classes[parks]=3;classes[water]=4;classes[road]=5
classes.tofile(root/'terrain.bin')
def runs(mask):
 flat=mask.ravel().astype(np.int8);edges=np.flatnonzero(np.diff(np.r_[0,flat,0]));return [[int(x),int(y-x)]for x,y in zip(edges[::2],edges[1::2])]
def rowpath(mask):
 parts=[]
 for y,row in enumerate(mask):
  e=np.flatnonzero(np.diff(np.r_[0,row.astype(np.int8),0]))
  for x,z in zip(e[::2],e[1::2]):parts.append(f'M{x} {y}h{z-x}v1H{x}z')
 return ''.join(parts)
components=[]
for label in np.flatnonzero(keep):
 ys,xs=np.where(labels==label);cx,cy=xs.mean(),ys.mean();i=np.argmin((xs-cx)**2+(ys-cy)**2)
 components.append(dict(id=int(label),pixels=int(sizes[label]),sample=[int(xs[i]),int(ys[i])],bounds=[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())]))
components.sort(key=lambda p:-p['pixels'])
spawn=components[0]['sample']
# Choose an existing road near southwest station area. Name is generic: station exact location is unverified.
y,x=np.where(road);i=np.argmin((x-430)**2+(y-1660)**2);spawn=[int(x[i])+.5,int(y[i])+.5]
m=dict(schemaVersion=2,id='tsuruse-world',name='鶴瀬駅周辺',width=w,height=h,worldScale=8,logicalWorldSize=[w*8,h*8],coordinates='source image pixels; x right, y down',terrainFile='terrain.bin',terrainEncoding='uint8 row-major; index=y*width+x',terrainClasses={'0':'unmapped','1':'land','2':'building','3':'green area (access unverified)','4':'water-colored feature','5':'road candidate'},walkableClass=5,spawn=dict(x=spawn[0],y=spawn[1]),speed=12,roadRuns=runs(road),components=components,images=dict(game='assets/game-map.png',reference='assets/reference.png'),notes=['道路色を抽出した画像ベースの通行候補。実地・公道・立体交差の確認済みデータではありません。','位置・曲がり方は元画像の座標に固定。文字や継ぎ目の欠けは自動接続しません。','草地・公園の入場可否は画像で判断できないため、この版では道路候補だけ歩行可能。','20画素未満の孤立領域は文字混入を抑えるため除外。細い道の欠落や文字の誤抽出が残る可能性があります。','logicalWorldSizeは8倍表示時の論理寸法で、元画像の情報解像度は2048×1885です。'])
(root/'map.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':')))
review=dict(status='requires-review',disconnectedRoadComponents=len(components),totalRoadPixels=int(road.sum()),largestComponentPixels=components[0]['pixels'],policy='No automatic connections. Disconnected components are not necessarily map errors.',components=components)
(root/'review-points.json').write_text(json.dumps(review,ensure_ascii=False,indent=2))
s=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" shape-rendering="crispEdges"><rect width="{w}" height="{h}" fill="#e9e5d8"/>'
for mask,color in [(coverage,'#d9e3be'),(parks,'#9bcf83'),(water,'#81bec8'),(buildings,'#879b9e')]:s+=f'<path fill="{color}" d="{rowpath(mask)}"/>'
# Roof highlight stays INSIDE source building footprints.
highlight=buildings&~nd.binary_erosion(buildings,structure=np.array([[0,1,0],[0,1,0],[0,0,0]],bool));s+=f'<path fill="#92a7ad" d="{rowpath(highlight)}"/>'
roof_labels,roof_count=nd.label(buildings)
for k,color in enumerate(['#8197a6','#a98977','#b49c78','#6b9690']):
 roof_mask=buildings&(roof_labels%4==k)
 s+=f'<path fill="{color}" d="{rowpath(roof_mask)}"/>'
# Highlights are restricted to the existing footprint, never on roads.
s+=f'<path fill="#b4bdb2" d="{rowpath(highlight)}"/>'
s+=f'<path fill="#728791" d="{rowpath(road)}"/>'
inner=nd.binary_erosion(road,structure=np.ones((3,3)));s+=f'<path fill="#b8c4c1" d="{rowpath(inner)}"/></svg>'
(root/'assets/game-map.svg').write_text(s)
(root/'build-summary.json').write_text(json.dumps(dict(sourceSize=[w,h],logicalWorldSize=[w*8,h*8],roadPixels=int(road.sum()),components=len(components),spawn=spawn,coordinateDriftPixels=0),indent=2))
print(json.dumps(dict(width=w,height=h,roadPixels=int(road.sum()),components=len(components),largest=[c['pixels']for c in components[:3]],spawn=spawn)))

# After rebuilding, rasterize assets/game-map.svg to assets/game-map.png before running the viewer.
