import { useEffect, useRef } from 'react';
import { createField } from './field.js';
import './field.css';
/** Copy map.json + assets/ into public/fields/ambitious/; copy JS/CSS/JSX into src/fields/. */
export default function AmbitiousField({assetBase='./fields/ambitious/',onZoneEnter,onError,paused=false,entry='north'}) {
  const host=useRef(null),engine=useRef(null),zoneCallback=useRef(onZoneEnter),errorCallback=useRef(onError),pause=useRef(paused);
  zoneCallback.current=onZoneEnter;errorCallback.current=onError;pause.current=paused;
  useEffect(()=>{engine.current?.setPaused(paused);},[paused]);
  useEffect(()=>{
    let disposed=false;const abort=new AbortController();
    const base=new URL(assetBase,document.baseURI);
    (async()=>{const response=await fetch(new URL('map.json',base),{signal:abort.signal});if(!response.ok)throw Error(`Map HTTP ${response.status}`);const map=await response.json();const spawn=map.entrances.find(p=>p.id===entry);if(spawn)map.spawn={...spawn,facing:"down"};if(disposed)return;
      const field=await createField(host.current,{map,signal:abort.signal,imageUrl:new URL(map.background,base).href,onZoneEnter:(...args)=>zoneCallback.current?.(...args)});
      if(disposed){field.destroy();return;}engine.current=field;field.setPaused(pause.current);
    })().catch(e=>{if(disposed||e.name==='AbortError')return;if(host.current)host.current.textContent='フィールドを読み込めませんでした。';errorCallback.current?.(e);});
    return()=>{disposed=true;abort.abort();engine.current?.destroy();engine.current=null;};
  },[assetBase,entry]);
  return <div ref={host} style={{width:'100%',height:'100dvh'}} />;
}
