import { useEffect, useRef, useState } from 'react';
import { ImageAttachment } from '../../types';
import { loadImage } from '../../api/images';
import { useOverlayFocus } from '../../hooks/useOverlayFocus';
export function ChatImage({ attachment, token }: { attachment: ImageAttachment; token: string }) {
 const [url,setUrl]=useState(''); const [error,setError]=useState(false); const [retry,setRetry]=useState(0); const [open,setOpen]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null); const viewer=useRef<HTMLDivElement>(null);
 useOverlayFocus(viewer,open,()=>setOpen(false),true,false,trigger);
 useEffect(()=>{
  const controller=new AbortController();let objectUrl='';let active=true;
  setUrl('');setError(false);
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   if(entries.some(entry=>entry.isIntersecting)){observer?.disconnect();void download();}
  },{rootMargin:'200px'});
  async function download(){try{
   const blob=await loadImage(attachment.attachmentId,token,controller.signal);
   if(!active)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }catch{if(active&&!controller.signal.aborted)setError(true);}}
  if(observer&&trigger.current)observer.observe(trigger.current);else void download();
  return()=>{active=false;observer?.disconnect();controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[attachment.attachmentId,token,retry]);
 return <>
  <button ref={trigger} className="chat-image" style={{aspectRatio:`${attachment.width}/${attachment.height}`}} type="button" aria-label="Open photo" disabled={!url} onClick={()=>setOpen(true)}>
   {url?<img src={url} alt="Shared photo" width={attachment.width} height={attachment.height} onError={()=>{setError(true);setUrl('');}}/>:<span role="status">{error?'Photo unavailable':'Loading photo...'}</span>}
  </button>
  {error?<button type="button" className="quiet-button" onClick={()=>setRetry(value=>value+1)}>Retry photo</button>:null}
  {open&&url?<div className="image-viewer-backdrop" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <div ref={viewer} className="image-viewer" role="dialog" aria-modal="true" aria-label="Photo viewer" tabIndex={-1}>
    <button type="button" aria-label="Close photo viewer" onClick={()=>setOpen(false)}>Close</button>
    <img src={url} alt="Shared photo enlarged"/>
   </div>
  </div>:null}
 </>;
}
