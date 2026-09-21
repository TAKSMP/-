import { useEffect, useRef } from 'react';
import { createField } from './field.js';
import './field.css';
/** Copy map.json + assets/ into public/fields/yuyuu/; copy JS/CSS/JSX into src/fields/. */
export default function YuyuuField({assetBase='./fields/yuyuu/',onZoneEnter,onError,paused=false}) {
  const host=useRef(null),engine=useRef(null),zoneCallback=useRef(onZoneEnter),errorCallback=useRef(onError),pause=useRef(paused);
  zoneCallback.current=onZoneEnter;errorCallback.current=onError;pause.current=paused;
  useEffect(()=>{engine.current?.setPaused(paused);},[paused]);
  useEffect(()=>{
    let disposed=false;const abort=new AbortController();
    const base=new URL(assetBase,document.baseURI);
    (async()=>{const response=await fetch(new URL('map.json',base),{signal:abort.signal});if(!response.ok)throw Error(`Map HTTP ${response.status}`);const map=await response.json();if(disposed)return;
      const field=await createField(host.current,{map,signal:abort.signal,imageUrl:new URL(map.background,base).href,onZoneEnter:(...args)=>zoneCallback.current?.(...args)});
      if(disposed){field.destroy();return;}engine.current=field;field.setPaused(pause.current);
    })().catch(e=>{if(disposed||e.name==='AbortError')return;if(host.current)host.current.textContent='フィールドを読み込めませんでした。';errorCallback.current?.(e);});
    return()=>{disposed=true;abort.abort();engine.current?.destroy();engine.current=null;};
  },[assetBase]);
  return <div ref={host} style={{width:'100%',height:'100dvh'}} />;
}
