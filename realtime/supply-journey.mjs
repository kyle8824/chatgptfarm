import {distance} from '../engine/navigation.js';
import {clock,roomFor} from './holdings.mjs';
import {knownPlace} from './frontier-knowledge.mjs';
import {beginReturnRoute,advanceReturnRoute} from './return-route.mjs';
import {advanceLiveRoute,liveRoute,motionState} from './motion.mjs';
import {interactionPoint,workSettlement} from './settlement.mjs';

const permitted=(a,p)=>p&&(p.ownerId===a.id||p.access==='shared'||!p.ownerId);
export function supplyTripCandidate(w,a,p,source,quantity,{score=72,deliver=false}={}){
 if(!p||!permitted(a,p)||!knownPlace(w,a,p)||Math.min(a.needs.hydration,a.needs.hunger,a.needs.energy)<30||a.needs.warmth<20||!roomFor(w,a,source.item))return null;
 const store=source.storeId&&w.settlement.stores.find(s=>s.id===source.storeId),node=source.nodeId&&w.resourceSites.nodes.find(n=>n.id===source.nodeId);
 if(source.storeId&&(!permitted(a,store)||!knownPlace(w,a,store)))return null;
 if(source.nodeId&&(!node||!(node.knownBy||[]).includes(a.id)&&distance(a.coordinates,node.position)>=9))return null;
 if(!(quantity>0))return null;
 const sourceId=source.storeId||source.nodeId||source.treeId||source.sourceId||source.item,id=`supply_trip:${p.id}:${sourceId}:${source.item}`;
 const failure=a.liveFailures?.[id];if(failure&&clock(w)-failure.at<failure.retryMinutes)return null;
 return {id,label:`Fetch ${source.item} and return to ${p.name}`,score:score-Math.min(18,distance(a.coordinates,source.position)*.035),reasons:[['obtain missing construction supplies and return',score]],job:{kind:'supply_trip',projectId:p.id,source:{...source},quantity:Math.min(quantity,roomFor(w,a,source.item)),deliver,destination:{...a.coordinates},minutes:30}};
}
export function pendingSupplyTrips(w,a){
 return (a.suspendedTasks||[]).filter(t=>t.selected?.job?.kind==='supply_trip').filter(t=>{
  const p=w.settlement.projects.find(p=>p.id===t.selected.job.projectId),f=a.liveFailures?.[t.actionId];return permitted(a,p)&&(!f||clock(w)-f.at>=f.retryMinutes);
 }).map(t=>({...t.selected,score:110,job:{...t.selected.job,destination:{...a.coordinates}}}));
}
export async function advanceSupplyJourney(w,a,t,seconds){
 const j=t.selected.job,p=w.settlement.projects.find(p=>p.id===j.projectId),stock=w.settlement.stores.find(s=>s.id===p?.stockpileId);
 const fail=detail=>({done:true,success:false,detail});
 if(!permitted(a,p)||!permitted(a,stock))return fail('The construction site is no longer available. Carried supplies are retained.');
 const journey=t.supplyJourney??={stage:'collect',walked:0,collected:{}};
 const source=j.source,store=source.storeId?w.settlement.stores.find(s=>s.id===source.storeId):null,node=source.nodeId?w.resourceSites.nodes.find(n=>n.id===source.nodeId):null;
 if(journey.stage==='collect'&&(source.storeId&&(!permitted(a,store)||!(store.items[source.item]>0))||source.nodeId&&(!node||node.remaining<=0)))return fail('The remembered supplies were exhausted or are no longer available.');
 const goal=journey.stage==='collect'?(store?.position||node?.position||source.position):stock.position;
 const radius=(journey.stage==='collect'?store?.radius:stock.radius)||.8;
 if(!journey.route){
  if(distance(a.coordinates,goal)>radius+2){
   journey.search??=beginReturnRoute(a.coordinates,goal,{arrivalRadius:radius+1.2});
   const r=advanceReturnRoute(w,a,journey.search,{maxExpansions:8});t.phase='planning';motionState(a).speed=0;
   t.progress={kind:'supply',stage:journey.stage,label:p.name,distance:journey.walked};
   if(r.blocked)return fail('No safe supply route was found within the bounded search. Try another source before retrying this one.');
   if(!r.path)return {done:false};
   journey.route={path:r.path,pathIndex:1,destination:r.path.at(-1)};delete journey.search;
  }else{
   const destination=interactionPoint(w,a,goal,{radius:radius+.65,extra:[a.coordinates],accept:q=>distance(q,goal)<=radius+1.05});
   if(!destination)return fail('The final approach to these supplies is blocked.');
   const path=liveRoute(w,a.coordinates,destination,a);if(!path)return fail('No safe final approach to the supplies.');
   journey.localDestination=destination;journey.route={path,pathIndex:1,destination};
  }
 }
 const from={...a.coordinates},movement=advanceLiveRoute(w,a,journey.route,seconds);journey.walked+=distance(from,a.coordinates)*(w.worldModel.bounds.metersPerUnit||2);
 t.phase='travel';a.position='travel';t.destination=journey.route.destination;
 t.progress={kind:'supply',stage:journey.stage,label:p.name,distance:journey.walked};
 if(movement.blocked)return fail('The supply route stopped making progress; carried supplies remain with the villager.');
 if(!movement.arrived)return {done:false};
 if(!journey.localDestination){delete journey.route;return {done:false};}
 t.phase='work';a.position=journey.stage==='collect'?'supply source':'construction site';
 // Arrival uses this step's elapsed movement budget; labor starts next step.
 if(distance(from,a.coordinates)>1e-8)return {done:false};
 if(journey.stage==='collect'){
  const job={...source,projectId:p.id,quantity:j.quantity,destination:journey.localDestination,position:goal,minutes:source.kind==='harvest'?6:source.kind==='take'?.5:2};
  journey.collection??={selected:{job},requiredMinutes:job.minutes,workMinutes:0};journey.collection.selected.job=job;
  const before={...a.inventory},r=workSettlement(w,a,journey.collection,seconds/60);t.workMinutes=journey.collection.workMinutes;
  if(!r.done)return r;if(r.success===false)return r;
  for(const [key,n]of Object.entries(a.inventory))if(n>(before[key]||0))journey.collected[key]=n-(before[key]||0);
  journey.stage='return';delete journey.route;delete journey.localDestination;delete journey.search;return {done:false};
 }
 if(j.deliver){
  for(const [item,n]of Object.entries(journey.collected)){
   const count=Math.min(n,a.inventory[item]||0);if(!count)continue;
   const job={kind:'deliver',projectId:p.id,storeId:stock.id,item,quantity:count,destination:journey.localDestination};
   journey.delivery??={selected:{job},requiredMinutes:.5,workMinutes:0};journey.delivery.selected.job=job;
   const r=workSettlement(w,a,journey.delivery,seconds/60);if(!r.done)return r;if(r.success===false)return r;journey.collected[item]=0;delete journey.delivery;return {done:false};
  }
 }
 return {done:true,success:true,detail:`Returned to ${p.name} after physically collecting supplies. ${j.deliver?'Materials were delivered to its rack.':'Tools and crafting inputs remain carried for the next building step.'}`};
}
