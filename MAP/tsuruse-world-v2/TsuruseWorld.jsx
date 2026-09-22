import {useEffect,useRef} from 'react';
import {mountWorld} from './viewer.js';
import './viewer.css';
export default function TsuruseWorld({assetBase='./fields/tsuruse/',paused=false,onPosition,onError}){
 const host=useRef(null),instance=useRef(null),callbacks=useRef({onPosition,onError}),pause=useRef(paused);callbacks.current={onPosition,onError};pause.current=paused;
 useEffect(()=>{instance.current?.setPaused(paused);},[paused]);
 useEffect(()=>{const abort=new AbortController();let disposed=false;const base=new URL(assetBase,document.baseURI);
 (async()=>{const response=await fetch(new URL('map.json',base),{signal:abort.signal});if(!response.ok)throw Error(`Map HTTP ${response.status}`);const map=await response.json();const tr=await fetch(new URL(map.tiles,base),{signal:abort.signal});if(!tr.ok)throw Error(`Tiles HTTP ${tr.status}`);const tileManifest=await tr.json();if(disposed)return;const api=await mountWorld(host.current,{map,tileManifest,tileBaseUrl:base.href,signal:abort.signal,gameUrl:new URL(map.images.game,base).href,referenceUrl:new URL(map.images.reference,base).href,onPosition:p=>callbacks.current.onPosition?.(p)});if(disposed){api.destroy();return;}instance.current=api;api.setPaused(pause.current);})().catch(e=>{if(disposed||e.name==='AbortError')return;if(host.current)host.current.textContent='地図を読み込めませんでした';callbacks.current.onError?.(e);});
 return()=>{disposed=true;abort.abort();instance.current?.destroy();instance.current=null;};
 },[assetBase]);return <div ref={host} style={{height:'100dvh',width:'100%'}}/>;
}
