import {naturalWorld} from '../shared/landscape.js';
import {distance} from '../engine/navigation.js';
import {coordForPosition} from '../engine/spectator.js';
import {clock} from './holdings.mjs';
import {advanceLiveRoute,motionState} from './motion.mjs';
import {beginReturnRoute,advanceReturnRoute} from './return-route.mjs';
import {knownCampProtection} from './frontier-knowledge.mjs';

export const coldRecovery=a=>a.needs.warmth<20||!!a.thermalGoal&&a.needs.warmth<45;
function usefulCamps(w,a){
 return (w.frontier?.homes||[]).filter(h=>h.id===a.householdId||a.knownCamps?.includes(h.id)).filter(h=>{
  const seen=knownCampProtection(w,a,h);
  return seen.shelter||seen.fire||seen.fuel||a.inventory.dryWood>=1||(a.inventory.dryWood||0)+(a.inventory.wetWood||0)>=4;
 });
}
export const usefulReturnCamp=(w,a,id)=>usefulCamps(w,a).some(h=>h.id===id);
export function updateThermalGoal(w,a){
 if(a.needs.warmth>=45){delete a.thermalGoal;return;}
 if(!naturalWorld(w)||!coldRecovery(a))return;
 // A starting camp is known. Other camps must actually have been encountered;
 // ancestry does not forbid choosing a nearer camp or keep someone there.
 const known=usefulCamps(w,a),h=known.find(h=>h.id===a.thermalGoal?.campId)||known.sort((h,j)=>distance(a.coordinates,h)-distance(a.coordinates,j))[0];
 a.thermalGoal={...a.thermalGoal,campId:h?.id||null,startedAt:a.thermalGoal?.startedAt??clock(w)};
}
export function returnCamp(w,a){
 if(!naturalWorld(w)||!coldRecovery(a))return null;
 const known=usefulCamps(w,a);
 // A newly encountered nearby camp can replace the old destination.
 return known.find(h=>distance(a.coordinates,h)<18)||known.find(h=>h.id===a.thermalGoal?.campId)||known.sort((h,j)=>distance(a.coordinates,h)-distance(a.coordinates,j))[0]||null;
}
export function returnCandidate(w,a){
 const h=returnCamp(w,a);if(!h||distance(a.coordinates,h)<=18)return null;
 // Let a bounded, useful supply/work trip finish before returning. Otherwise
 // crossing the camp radius interrupts the same unfinished errand forever.
 const j=a.task?.selected?.job;
 // Finish a bounded local food errand before returning. Otherwise a cold
 // villager crosses the camp radius, turns back, resumes the same forage and
 // repeats indefinitely without ever reaching the berries or getting warm.
 const protection=knownCampProtection(w,a,h),heatReady=protection.fire||protection.fuel||a.inventory.dryWood>=1;
 if(!heatReady&&a.task&&/^(forage:|survey:|gather_berries|retrieve_food:|eat_)/.test(a.task.actionId)){
  const foodGoal=j?.destination||coordForPosition(a.task.targetPosition,w);
  if(foodGoal&&distance(foodGoal,h)<=45&&distance(a.coordinates,h)<=50)return null;
 }
 if(j?.destination&&(j.coldPreparation||j.projectId||j.practice||/^(harvest_fuel:|tool_supply:)/.test(a.task.actionId))&&['harvest','gather','take','fallen','craft','assemble','repair','deliver'].includes(j.kind)&&distance(j.destination,h)<=45&&distance(a.coordinates,h)<=50)return null;
 const id=`return_warmth:${h.id}`,failure=a.liveFailures?.[id];
 if(failure&&clock(w)-failure.at<failure.retryMinutes)return null;
 return {id,label:`Return to ${h.name} to recover warmth`,score:160,reasons:[['cold requires a return to a known camp',160]],explanation:'Return to a known camp, then use real shelter and fuel. Pause for urgent food, water or rest.',job:{kind:'return_warmth',campId:h.id,destination:{...a.coordinates},minutes:30}};
}
export function advanceThermalReturn(w,a,t,seconds){
 const camp=w.frontier?.homes.find(h=>h.id===t.selected.job.campId);
 if(!camp||!coldRecovery(a))return {done:true,success:true,detail:'The cold-weather return is no longer needed.'};
 if(distance(a.coordinates,camp)<=8.2){a.campId=camp.id;a.position='camp';a.thermalGoal={...a.thermalGoal,campId:camp.id};return {done:true,success:true,detail:`Reached ${camp.name} on foot. Shelter and fuel still have to be used to recover warmth.`};}
 if(!t.returnJourney){t.returnJourney={search:beginReturnRoute(a.coordinates,camp),travelled:0};t.phase='planning';}
 const journey=t.returnJourney;
 if(journey.search){
  const m=motionState(a);m.vx=m.vy=m.speed=0;
  const result=advanceReturnRoute(w,a,journey.search);
  if(result.blocked)return {done:true,success:false,detail:'No safe return route was found within the bounded search; remember the obstruction before retrying.'};
  if(!result.path)return {done:false};
  t.path=result.path;t.destination={...result.path.at(-1)};t.pathIndex=1;t.phase='travel';t.progressIndex=null;
  journey.total=result.path.slice(1).reduce((n,p,i)=>n+distance(p,result.path[i]),0);delete journey.search;
 }
 const from={...a.coordinates},movement=advanceLiveRoute(w,a,t,seconds);
 journey.travelled+=distance(from,a.coordinates);a.position='travel';
 const scale=w.worldModel.bounds.metersPerUnit||2;
 t.progress={kind:'return_warmth',distance:journey.travelled*scale,targetDistance:journey.total*scale,camp:camp.name};
 if(movement.blocked)return {done:true,success:false,detail:'The return route became blocked; remember the obstruction before retrying.'};
 return {done:false};
}
