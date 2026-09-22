export function decodeRoads(map){const mask=new Uint8Array(map.width*map.height);for(const [start,length]of map.roadRuns){if(start<0||length<1||start+length>mask.length)throw Error('Invalid RLE');mask.fill(1,start,start+length);}return mask;}
export function isRoad(map,mask,x,y){const ix=Math.floor(x),iy=Math.floor(y);return ix>=0&&iy>=0&&ix<map.width&&iy<map.height&&mask[iy*map.width+ix]===1;}
export function nearestRoad(map,mask,x,y,radius=8){let found=null,dist=Infinity;for(let j=Math.max(0,Math.floor(y-radius));j<=Math.min(map.height-1,y+radius);j++)for(let i=Math.max(0,Math.floor(x-radius));i<=Math.min(map.width-1,x+radius);i++){const d=(i+.5-x)**2+(j+.5-y)**2;if(d<dist&&d<=radius*radius&&mask[j*map.width+i]){dist=d;found={x:i+.5,y:j+.5};}}return found;}
export function move(map,mask,p,dx,dy){const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.15));for(let i=0;i<count;i++){const x=p.x+dx/count,y=p.y+dy/count;if(isRoad(map,mask,x,y)){p.x=x;p.y=y;}else if(isRoad(map,mask,x,p.y))p.x=x;else if(isRoad(map,mask,p.x,y))p.y=y;}return p;}
export function findRoute(map,mask,start,end){
 const w=map.width,h=map.height,s=Math.floor(start.y)*w+Math.floor(start.x),goal=Math.floor(end.y)*w+Math.floor(end.x);
 if(!mask[s]||!mask[goal])return null;
 const prev=new Int32Array(w*h);prev.fill(-1);const q=new Int32Array(mask.length);let head=0,tail=1;q[0]=s;prev[s]=s;
 while(head<tail&&prev[goal]<0){const v=q[head++],x=v%w,y=Math.floor(v/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,j=ny*w+nx;if(nx<0||ny<0||nx>=w||ny>=h||!mask[j]||prev[j]>=0)continue;prev[j]=v;q[tail++]=j;}}
 if(prev[goal]<0)return null;
 const path=[];for(let p=goal;p!==s;p=prev[p])path.push({x:p%w+.5,y:Math.floor(p/w)+.5});path.push({x:s%w+.5,y:Math.floor(s/w)+.5});return path.reverse();
}
