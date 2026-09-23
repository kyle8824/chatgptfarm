import {regionFor} from '../shared/frontier.js';
export function knownPlace(w,a,o){return !w.frontier||o.ownerId===a.id||!!a.landmarks?.[o.id]||Math.hypot(a.coordinates.x-o.position.x,a.coordinates.y-o.position.y)<9;}
function campProtection(w,a,h,at){
 const root=w.rootWorld||w,s=h.id==='willow-basin'?root.structures:h.structures;
 const fuel=root.settlement?.stores.some(store=>Math.hypot(store.position.x-h.x,store.position.y-h.y)<18&&(store.ownerId===a.id||!store.ownerId||store.access==='shared')&&knownPlace(w,a,store)&&store.items.dryWood>=1);
 return {shelter:!!s?.shelter,fire:!!s?.fire,fuel:!!fuel,at};
}
export function knownCampProtection(w,a,h){
 // Upgrade legacy camp IDs once. Later changes are learned on a real visit,
 // rather than exposing remote fire or store changes on every decision.
 a.campKnowledge??={};return a.campKnowledge[h.id]??=campProtection(w,a,h,null);
}
export function observeLandscape(w,a){
 if(!w.frontier)return;
 a.landmarks??={};const now=(w.day*24+w.hour)*60+(w.minute||0);
 for(const o of [...w.settlement.trees,...w.settlement.stores,...w.settlement.projects])if(Math.hypot(a.coordinates.x-o.position.x,a.coordinates.y-o.position.y)<9)a.landmarks[o.id]={seenAt:now,position:{...o.position}};
 for(const h of w.frontier.homes)if(Math.hypot(h.x-a.coordinates.x,h.y-a.coordinates.y)<18){a.knownCamps??=[];if(!a.knownCamps.includes(h.id))a.knownCamps.push(h.id);a.campId=h.id;(a.campKnowledge??={})[h.id]=campProtection(w,a,h,now);}
 a.regionId=regionFor(a.coordinates,w)?.id||'wilderness';
}
