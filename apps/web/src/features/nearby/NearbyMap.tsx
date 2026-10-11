import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { NearbyUser } from '../../types';
type Props={center:{latitude:number;longitude:number};people:NearbyUser[];selected:number|null;onSelect:(id:number)=>void;visible:boolean};
export function NearbyMap({center,people,selected,onSelect,visible}:Props){
 const ownMarker=useRef<L.Marker|null>(null);
 const node=useRef<HTMLDivElement>(null);const map=useRef<L.Map|null>(null);const layer=useRef<L.LayerGroup|null>(null);
 const [tileFailure,setTileFailure]=useState(false);const callback=useRef(onSelect);callback.current=onSelect;
 useEffect(()=>{
  if(!node.current)return;
  const instance=L.map(node.current,{zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,scrollWheelZoom:false,minZoom:3,maxZoom:15}).setView([center.latitude,center.longitude],12);
  map.current=instance;layer.current=L.layerGroup().addTo(instance);
  const tiles=import.meta.env.VITE_NEARBY_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  L.tileLayer(tiles,{maxZoom:19,attribution:import.meta.env.VITE_NEARBY_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>setTileFailure(true)).addTo(instance);
  const own=L.marker([center.latitude,center.longitude],{icon:L.divIcon({className:'nearby-own-marker',html:'<span aria-hidden="true">&#9679;</span>',iconSize:[24,24]}),title:'Your location (only visible to you)'}).addTo(instance);
  ownMarker.current=own;
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.invalidateSize({pan:false}));observer?.observe(node.current);
  return()=>{observer?.disconnect();own.remove();ownMarker.current=null;instance.remove();map.current=null;layer.current=null;};
 },[]);
 useEffect(()=>{ownMarker.current?.setLatLng([center.latitude,center.longitude]);if(map.current)map.current.setView([center.latitude,center.longitude],map.current.getZoom(),{animate:false});},[center.latitude,center.longitude]);
 useEffect(()=>{
  const current=layer.current;if(!current)return;current.clearLayers();
  const areas=new Map<string,NearbyUser[]>();
  for(const person of people)if(person.mapArea)areas.set(person.mapArea.key,[...(areas.get(person.mapArea.key)||[]),person]);
  for(const users of areas.values()){
   const area=users[0].mapArea!;const active=users.some(person=>person.userId===selected);
   const marker=L.marker([area.centerLatitude,area.centerLongitude],{icon:L.divIcon({className:`nearby-area-marker${active?' selected':''}`,html:`<span>${users.length}</span>`,iconSize:[44,44]}),title:`Approximate area: ${users.length} members`,alt:'Select approximate area'});
   marker.on('click',()=>callback.current(users[0].userId));current.addLayer(marker);
  }
 },[people,selected]);
 useEffect(()=>{if(visible)map.current?.invalidateSize({pan:false});},[visible]);
 function fit(){if(!map.current)return;const points:L.LatLngTuple[]=[[center.latitude,center.longitude],...people.flatMap(person=>person.mapArea?[[person.mapArea.centerLatitude,person.mapArea.centerLongitude] as L.LatLngTuple]:[])];map.current.fitBounds(L.latLngBounds(points),{maxZoom:12,padding:[24,24],animate:false});}
 return <section className="nearby-map-panel" aria-label="Nearby map"><div className="nearby-map-controls"><button type="button" onClick={fit}>Fit areas</button><span>Markers show approximate areas, not exact positions.</span></div><div ref={node} className="nearby-map" aria-label="Interactive map"/>{tileFailure?<p role="status">Map tiles unavailable. You can still use the list and area markers.</p>:null}</section>;
}
