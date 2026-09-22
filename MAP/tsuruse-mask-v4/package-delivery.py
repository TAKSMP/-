from pathlib import Path
import zipfile
P=Path(__file__).resolve().parent
for suffix,south in [('main',False),('south-tiles',True)]:
 path=P.parent/f'tsuruse-mask-v4-{suffix}.zip'
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
  for f in sorted(P.rglob('*')):
   if not f.is_file() or '__pycache__' in f.parts:continue
   rel=f.relative_to(P);is_tile=rel.parts[0]=='tiles';is_south=is_tile and int(f.stem.split('_')[1])>=8
   if south:
    if is_south:z.write(f,'south-tiles/'+f.name)
   elif not is_south:z.write(f,'tsuruse-mask-v4/'+rel.as_posix())
 print(path.name,path.stat().st_size,flush=True)
