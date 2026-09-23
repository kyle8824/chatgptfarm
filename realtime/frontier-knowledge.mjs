import {regionFor} from '../shared/frontier.js';
export function knownPlace(w,a,o){return !w.frontier||o.ownerId===a.id||!!a.landmarks?.[o.id]||Math.hypot(a.coordinates.x-o.position.x,a.coordinates.y-o.position.y)<9;}
export function observeLandscape(w,a){
 if(!w.frontier)return;
 a.landmarks??={};const now=(w.day*24+w.hour)*60+(w.minute||0);
 for(const o of [...w.settlement.trees,...w.settlement.stores,...w.settlement.projects])if(Math.hypot(a.coordinates.x-o.position.x,a.coordinates.y-o.position.y)<9)a.landmarks[o.id]={seenAt:now,position:{...o.position}};
 a.regionId=regionFor(a.coordinates)?.id||'wilderness';
}
