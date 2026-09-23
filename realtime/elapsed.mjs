import {workEconomy} from './regional-economy.mjs';
import {observeLandscape} from './frontier-knowledge.mjs';
import {householdWorld} from '../shared/frontier.js';
import {observePeople} from './frontier.mjs';
import {ensureLife,advanceLife,isAdult} from './life.mjs';
import {advanceChild,workParenting} from './parenting.mjs';
import {advanceStructures,noteCargoLimits} from './structure-lifecycle.mjs';
import {observeResourceSites} from './resource-sites.mjs';
import {migrateWorld,clamp,finishHour,updateWeather,addEvent} from '../engine/core.js';
import {family,outcome,display,startTask,interrupt,work} from '../engine/persistent-actions.js';
import {thermalExposure} from '../engine/thermal.js';
import {coordForPosition,recordSurfaceUse,updateSpectatorState} from '../engine/spectator.js';
import {advanceWood} from '../engine/wood-runtime.js';
import {chooseDestination,configureTask,liveRoute,advanceLiveRoute,separateBodies,faceInteraction} from './motion.mjs';
import {liveUrgency,liveCandidates,retireObsoleteTask,resumeLiveTask,rememberFailure} from './behavior.mjs';
import {advanceExploration} from './exploration.mjs';
import {withinWaterReach} from './water.mjs';
import {ensureSettlement,enforceCarry,syncHoldings,clock} from './holdings.mjs';
import {workSettlement,noticeMissingSupplies,recordStructureUse} from './settlement.mjs';
import {builtCover,coverEffectiveness} from './structures.mjs';
import {ensureFreeTime,advanceFreeTime,beginFreeTime,finishFreeTime,isFreeTimeJob,workFreeTime} from './free-time.mjs';
import {ensureComfort,isRestingTask,workComfortRest} from './comfort.mjs';
import {updateThermalGoal,advanceThermalReturn} from './thermal-return.mjs';

export function prepare(seed){
 const w=migrateWorld(structuredClone(seed));delete w.runtime;
 w.meta.persistentActions=1;w.meta.actionRulesVersion='realtime-2';w.minute=Number(w.minute||0);
 for(const a of w.agents){a.coordinates||=coordForPosition(a.position,w);delete a.runtimeMotion;ensureFreeTime(a);ensureComfort(a);}
 ensureSettlement(w);ensureLife(w);
 return w;
}
// No loop into future time, no transition.after, no future frames. The caller
// supplies ONLY elapsed duration. At most 6 simulated seconds per physics step.
export async function step(w,seconds,{mind=null,fallbackReason='no_provider',wallTime=Date.now()}={}){
 if(!(seconds>0&&seconds<=6.000001))throw Error('Invalid elapsed step');
 ensureSettlement(w);ensureLife(w);advanceLife(w);
 observeResourceSites(w);const minutes=seconds/60;
 observePeople(w);const root=w;
 const agents=[...w.agents].sort((a,b)=>a.id.localeCompare(b.id));
 if((w.day*24+w.hour)%2)agents.reverse();
 for(const a of agents){
  const w=householdWorld(root,a);observeLandscape(w,a);
  if(!isAdult(w,a))continue;
  advanceFreeTime(w,a,seconds);
  ensureComfort(a);a.restSupport=null;
  updateThermalGoal(w,a);retireObsoleteTask(w,a);if(!a.task)noteCargoLimits(w,a);
  noticeMissingSupplies(w,a);
  const urgent=liveUrgency(w,a);
  if(a.task&&urgent&&family(a.task.actionId)!==urgent&&a.task.requiredMinutes-a.task.workMinutes>0.1&&(['hydration','hunger','energy'].includes(urgent)&&a.needs[urgent]<20||a.needs[urgent]+10<(a.needs[family(a.task.actionId)]??100)))interrupt(w,a,urgent);
  if(!a.task&&!resumeLiveTask(w,a,urgent))await startTask(w,a,mind,urgent?'urgent_need':fallbackReason,!!urgent,{urgentNeed:urgent,onRouteFailure:t=>rememberFailure(w,a,t,'No safe route to the selected destination.'),candidateTransform:c=>liveCandidates(w,a,c),destinationResolver:(target,selected)=>chooseDestination(w,a,target,selected),routeFinder:(world,from,to)=>liveRoute(world,from,to,a)});
  configureTask(w,a);
  if(a.task)beginFreeTime(w,a,a.task);
  const t=a.task,from={...a.coordinates};if(t&&!t.liveTiming&&t.workMinutes===0){const id=t.actionId;t.requiredMinutes=t.selected?.job?.minutes??(id==='drink'?.75:id.startsWith('eat_')?1:/^(gather_|forage:)/.test(id)?4:id==='talk'?3:id==='seek_other'?.1:t.requiredMinutes);t.liveTiming=true;}if(t&&a.liveThought?.actionId===t.actionId&&t.source==='ai')a.liveThought.status='acting';let positionBefore=a.position;if(t?.actionId==='drink')t.interactionReady=withinWaterReach(w,a.coordinates);
  if(t?.selected?.job?.kind==='return_warmth'){
   positionBefore=t.phase==='travel'?'travel':a.position;const result=advanceThermalReturn(w,a,t,seconds);if(result.done){outcome(w,a,t,result.success,result.detail);if(!result.success)rememberFailure(w,a,t,result.detail);a.task=null;}
  }else if(t?.actionId==='explore'){
   positionBefore='travel';const result=advanceExploration(w,a,t,seconds);if(result.done){outcome(w,a,t,result.success,result.detail);if(!result.success)rememberFailure(w,a,t,result.detail);a.task=null;}
  }else if(t?.actionId==='drink'&&t.phase==='work'&&!withinWaterReach(w,a.coordinates)){
   // Reposition an old saved task or a body displaced away from the bank.
   // No hydration or work progress is awarded until water is in reach.
   faceInteraction(w,a,seconds);t.waterRetry=(t.waterRetry||0)-seconds;
   if(t.waterRetry<=0){configureTask(w,a,{force:true});t.waterRetry=3;}
  }else if(t?.phase==='travel'){
   a.position='travel';positionBefore='travel';const movement=advanceLiveRoute(w,a,t,seconds);
   if(movement.blocked){outcome(w,a,t,false,'Route changed while travelling.','blocked');rememberFailure(w,a,t,'Route remains blocked; try another useful task before retrying.');a.task=null;}
   else if(movement.arrived){a.position=t.targetPosition;t.phase='work';recordSurfaceUse(w,a,t.origin,t.destination,t.actionId);}
  }else if(t){faceInteraction(w,a,seconds);const result=['trade','regional_craft'].includes(t.selected?.job?.kind)?workEconomy(w,a,t,minutes):t.selected?.job?.kind==='care'?workParenting(w,a,t,minutes):isRestingTask(t)?workComfortRest(w,a,t,minutes):isFreeTimeJob(t)?workFreeTime(w,a,t,minutes):t.selected?.job?workSettlement(w,a,t,minutes):work(w,a,t,minutes);if(isRestingTask(t)&&t.workMinutes>0&&t.selected?.job?.projectId)recordStructureUse(w,a,w.settlement.projects.find(p=>p.id===t.selected.job.projectId),'rest');if(result.done){finishFreeTime(w,a,t,result);outcome(w,a,t,result.success!==false,result.detail);if(result.success===false)rememberFailure(w,a,t,result.detail);if(['talk','seek_other'].includes(t.actionId))a.socialUntil=clock(w)+90;if(t.actionId==='seek_cover')a.coverUntil=clock(w)+45;a.task=null;}}
  enforceCarry(w,a);
  const ratio=seconds/3600,n=a.needs;
  n.hydration=clamp(n.hydration-(a.inventory.firedVessel>0?5.5:6.5)*ratio);n.hunger=clamp(n.hunger-4.2*ratio*(a.life.pregnancy?1.2:1));n.energy=clamp(n.energy-2.8*ratio*(a.life.pregnancy?1.15:1)-(positionBefore==='travel'?3.6*ratio:0));
  const exposure=thermalExposure(w,{...a,position:positionBefore});if(builtCover(w,a.coordinates)&&!exposure.sheltered){exposure.sheltered=true;const protection=coverEffectiveness(w,a.coordinates);exposure.rainLoss*=1-protection;exposure.shelterProtection=Math.min(exposure.coldLoss,2*protection);exposure.net=exposure.fireGain+exposure.shelterProtection-exposure.coldLoss-exposure.rainLoss;}n.warmth=clamp(n.warmth+exposure.net*ratio);a.thermalExposure={...exposure,model:'elapsed-location-live',minutes};
  if(a.task){display(a);if(a.task.actionId==='explore'){a.currentAction='Exploring the surrounding valley';a.activeAction.label=a.currentAction;}if(a.task.actionId==='drink'&&a.task.phase==='work'&&!a.task.interactionReady){a.currentAction='Waiting for access to water';a.activeAction.label=a.currentAction;}}else{a.activeAction=null;a.currentAction='Choosing next action';}
  // Past positions only. Viewer may interpolate these; never predicts a target.
  delete a.runtimeMotion;
 }
 for(const a of agents)if(!isAdult(w,a))advanceChild(householdWorld(w,a),a,seconds);
 separateBodies(w,seconds);for(const a of w.agents)if(a.life?.carriedBy){const p=w.agents.find(p=>p.id===a.life.carriedBy);if(p)a.coordinates={...p.coordinates};}
 advanceStructures(w,seconds);
 w.minute+=minutes;
 advanceWood(w,w.day*24+w.hour+w.minute/60);
 syncHoldings(w);
 if(w.minute>=60-1e-8){w.minute=Math.max(0,w.minute-60);finishHour(w,{needs:false,wood:false,ecology:false});updateSpectatorState(w);}
 w.meta.tickNumber=(w.meta.tickNumber||0)+1;w.meta.lastAdvancedAt=new Date(wallTime).toISOString();
 for(const d of w.dna||[])delete d.evidence;
 return w;
}
export function applyEvent(w,event){
 if(event.type!=='rain')throw Error('Unsupported preview event');
 w.weather='rain';w.liveWeatherUntil=w.day*24+w.hour+w.minute/60+1;
 addEvent(w,'preview-weather','Rain begins now','Owner-triggered rain in the isolated preview; no future history was computed.',{});
}
