import {economyCandidates} from './regional-economy.mjs';
import {parentingCandidates,familyFoodNeed} from './parenting.mjs';
import {candidateActions} from '../engine/decision.js';
import {actionDestination,family,outcome,display} from '../engine/persistent-actions.js';
import {coordForPosition} from '../engine/spectator.js';
import {distance} from '../engine/navigation.js';
import {storedFuel} from '../engine/wood-runtime.js';
import {addEvent,relationship,otherAgent} from '../engine/core.js';
import {configureTask} from './motion.mjs';
import {settlementCandidates} from './settlement.mjs';
import {clock as liveClock,roomFor} from './holdings.mjs';
import {explorationMotivation} from './exploration.mjs';
import {freeTimeCandidates} from './free-time.mjs';

const clock=w=>(w.day*24+w.hour)*60+(w.minute||0);
const resourceFor={gather_dry_wood:'dryWood',gather_wet_wood:'wetWood',gather_berries:'berries',gather_stones:'stones',gather_clay:'clay',gather_reeds:'reeds'};
export function liveUrgency(w,a){
 const n=a.needs;
 // An unfixable cold deficit must not indefinitely veto water, food and rest.
 // Shelter reduces exposure; it does not generate heat.
 if(n.hydration<12)return 'hydration';if(n.hunger<12)return 'hunger';if(n.energy<12)return 'energy';
 const heatAvailable=w.structures.fire||a.inventory.dryWood>0||storedFuel(w)>0;
 if(n.warmth<20&&heatAvailable)return 'warmth';
 return ['hydration','hunger','energy'].filter(k=>n[k]<20).sort((x,y)=>n[x]-n[y])[0]||null;
}
function knownUnavailable(w,a,id){
 const failed=a.liveFailures?.[id];if(failed&&clock(w)-failed.at<failed.retryMinutes)return true;
 const key=resourceFor[id],seen=a.resourceObservations?.[key];
 if(key&&seen?.band==='depleted'){const renewable=['dryWood','wetWood','berries','reeds'].includes(key);if(!renewable||(w.day-seen.day)*24+w.hour-seen.hour<(key==='dryWood'?4:18))return true;}
 return false;
}
export function liveCandidates(w,a,candidates){
 const filtered=candidates.filter(c=>!['store_wet_wood','collect_dried_wood','talk','seek_other'].includes(c.id)&&(c.id!=='make_fire'||a.inventory.dryWood>0)&&(c.id!=='dry_wood_by_fire'||a.inventory.wetWood>0)&&(c.id!=='seek_cover'||(a.coverUntil||0)<clock(w))&&(!w.frontier||!resourceFor[c.id]||w.resources[resourceFor[c.id]]>0)&&!knownUnavailable(w,a,c.id)&&(!resourceFor[c.id]||!w.settlement||roomFor(w,a,resourceFor[c.id])>0)&&(!['share_food'].includes(c.id)||(a.socialUntil||0)<clock(w)));
 // Retain a real, safe fallback if every remembered resource is unavailable.
 if(!filtered.length)filtered.push({id:'rest',label:w.structures.shelter?'Rest in the shelter':'Rest in the meadow',score:1,reasons:[['no useful reachable resource action',1]]});
 const ordinary=filtered.map(c=>{
  const target=actionDestination(w,a,c),goal=coordForPosition(target,w),trip=c.id==='explore'?12:target===a.position?0:distance(a.coordinates,goal),need=family(c.id),n=a.needs[need];
  const immediate=/^eat_/.test(c.id)&&Object.entries(a.inventory).some(([k,v])=>['berries','cookedMeat','tubers'].includes(k)&&v>0);
  const comfortPenalty=need&&n>70?(n-70)*1.2:0;
  // Travel has a cost. Equally useful nearby resources should not lose a fixed
  // alphabetical tie to the same distant thicket on every decision.
  const other=otherAgent(w,a),trust=other?relationship(w,a,other)?.trust??34:34,socialPenalty=['talk','seek_other','share_food'].includes(c.id)?Math.max(0,35-trust)*(c.id==='share_food'?1.6:.7):0;
  const score=c.score-trip*(a.needs.energy<25?.45:.24)-comfortPenalty-socialPenalty+(immediate&&a.needs.hunger<35?20:0);
  return {...c,label:c.id==='explore'?'Explore the surrounding valley':c.label,score,reasons:[...(c.reasons||[]),['travel effort',-trip*.24]]};
 });
 const familyNeed=familyFoodNeed(w,a);
 const exploration=explorationMotivation(w,a),all=[...ordinary,...settlementCandidates(w,a),...freeTimeCandidates(w,a),...parentingCandidates(w,a),...economyCandidates(w,a)].filter(c=>c.id!=='explore'||exploration.allowed).map(c=>c.id==='explore'?{...c,score:c.score-exploration.penalty,explanation:exploration.reason,reasons:[...(c.reasons||[]),['remembered exploration yield',-exploration.penalty]]}:c).map(c=>familyNeed&&/^(gather_berries|forage:|survey:|retrieve_food:)/.test(c.id)?{...c,score:c.score+familyNeed,explanation:'Collect finite food for a dependent child.'}:c).sort((x,y)=>y.score-x.score||x.id.localeCompare(y.id));
 return all.length?all.filter((c,i)=>all.findIndex(x=>x.id===c.id)===i):[{id:'rest',label:'Rest and reconsider',score:1,reasons:[['no useful available action',1]]}];
}
export function rememberFailure(w,a,t,detail){
 const key=resourceFor[t.actionId];if(key)a.resourceObservations??={};
 if(key&&w.resources[key]<=0)a.resourceObservations[key]={band:'depleted',quantity:0,day:w.day,hour:w.hour};
 (a.liveFailures??={})[t.actionId]={at:clock(w),retryMinutes:t.selected?.job||/route/i.test(detail)?10:key==='dryWood'?240:180,detail};
 const entries=Object.entries(a.liveFailures).sort((a,b)=>b[1].at-a[1].at).slice(0,16);a.liveFailures=Object.fromEntries(entries);
}
export function retireObsoleteTask(w,a){
 const t=a.task;if(!t)return;
 let reason;if(['store_wet_wood','collect_dried_wood'].includes(t.actionId))reason='Storage now requires a physical visit to its container; choosing a handling task.';
 if(knownUnavailable(w,a,t.actionId))reason='The remembered resource is unavailable; reconsidering another useful action.';
 if(t.actionId==='seek_cover'&&t.phase==='work'){
  // Taking cover is accomplished on arrival. Remaining there is a location,
  // not a compulsory repeating half-hour task that blocks drinking/eating.
  t.requiredMinutes=Math.min(t.requiredMinutes,t.workMinutes+.5);
  if(a.position==='camp'&&['hydration','hunger','energy'].some(k=>a.needs[k]<35))reason='Already under cover; attending to other needs.';
 }
 if(t.actionId==='seek_warmth'&&!w.structures.fire)reason='The fire is out; this task can no longer warm anyone.';
 if(t.actionId==='seek_other'){
  const other=otherAgent(w,a);
  if(other&&distance(a.coordinates,other.coordinates)<2.1){a.socialUntil=clock(w)+90;outcome(w,a,t,true,`${a.name} found ${other.name} nearby; the search is finished.`);a.task=null;return;}
  if(t.phase==='work'){reason='The other person moved away; reconsidering instead of waiting at an old location.';a.socialUntil=clock(w)+30;}
 }
 if(reason){outcome(w,a,t,false,reason,'superseded');a.task=null;}
}
export function resumeLiveTask(w,a,urgent){
 const ranked=liveCandidates(w,a,candidateActions(w,a));
 a.suspendedTasks=(a.suspendedTasks||[]).filter(t=>!knownUnavailable(w,a,t.actionId)&&!(t.actionId==='seek_warmth'&&!w.structures.fire)&&!(t.actionId==='seek_cover'&&a.position==='camp'));
 const index=a.suspendedTasks.findLastIndex(t=>ranked.some(c=>c.id===t.actionId)&&(urgent?family(t.actionId)===urgent:ranked[0]?.id===t.actionId));
 if(index<0)return false;const t=a.suspendedTasks[index];a.task=t;configureTask(w,a,{force:true});if(!a.task.path.length){a.task=null;return false;}
 a.suspendedTasks.splice(index,1);addEvent(w,'action-resumed',`${a.name} resumes ${t.label}`,'Useful unfinished work is retained; its destination is checked for space.',{agentId:a.id,actionId:t.id,decisionId:t.decisionId});display(a);return true;
}
