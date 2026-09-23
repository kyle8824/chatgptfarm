import {naturalWorld} from '../shared/landscape.js';
import {otherAgent} from './core.js';
import {migrateWorld,clamp,finishHour,updateWeather,addEvent,remember} from './core.js';
import {selectPersistentAction,executeKnown,retrieveDecisionContext} from './runtime.js';
import {resolvePhysicalAction} from './physics.js';
import {thermalExposure} from './thermal.js';
import {coordForPosition,updateSpectatorState,recordSurfaceUse} from './spectator.js';
import {advanceWood} from './wood-runtime.js';
import {findRoute,advanceRoute,distance} from './navigation.js';

export const ACTION_STEP_MINUTES=5;
const consume={eat_berries:{item:'berries',gain:28,need:'hunger'},eat_cooked_meat:{item:'cookedMeat',gain:46,need:'hunger'},eat_tuber:{item:'tubers',gain:22,need:'hunger'}};
const duration=id=>consume[id]?10:id==='drink'?10:id==='rest'?60:id==='seek_warmth'?45:id==='seek_cover'?30:id==='build_shelter'?180:id==='dry_wood_by_fire'?60:/^survey:/.test(id)?35:/^physical:/.test(id)?60:30;
export function actionDestination(w,a,selected,proposal){
 const id=selected.id;
 if(/^(survey|forage):/.test(id))return id.slice(id.indexOf(':')+1);
 if(id.startsWith('physical:')){const c=retrieveDecisionContext(w,a),o=c.affordances.objects.find(x=>x.id===proposal?.primaryObjectId);return o?.kind==='place'?o.position:a.position;}
 if(consume[id])return id==='eat_berries'&&!a.inventory.berries?'berries':a.position;
 if(id==='rest'&&naturalWorld(w)&&distance(a.coordinates,coordForPosition('camp',w))>18)return a.position;
 if(id==='rest')return w.structures.shelter||w.structures.fire?'camp':'meadow';
 if(id==='share_food')return otherAgent(w,a)?.position||a.position;
 if(id==='seek_other')return otherAgent(w,a)?.position||a.position;
 return {drink:'creek',gather_berries:'berries',gather_dry_wood:'log',gather_wet_wood:'log',gather_stones:'stones',gather_clay:'clay',gather_reeds:'reeds',make_fire:'camp',build_shelter:'camp',dry_wood_by_fire:'camp',store_wet_wood:'camp',collect_dried_wood:'camp',seek_warmth:'camp',seek_cover:'camp',explore:'edge'}[id]||a.position;
}
function family(id){if(/^(eat_|retrieve_food:|forage:|survey:|gather_berries)/.test(id))return 'hunger';if(id==='drink')return 'hydration';if(/^(retrieve_fuel:|harvest_fuel:|seek_warmth|seek_cover|make_fire|dry_wood_by_fire|store_wet_wood|gather_.*wood|collect_dried_wood)/.test(id))return 'warmth';if(id==='rest'||id.startsWith('rest_at:'))return 'energy';return null;}
function urgentNeed(a){return Object.entries(a.needs).filter(([k,v])=>['hydration','hunger','warmth','energy'].includes(k)&&v<20).sort((a,b)=>a[1]-b[1]||a[0].localeCompare(b[0]))[0]?.[0]||null;}
function outcome(w,a,task,success,detail,status='completed'){
 const dna=w.dna.find(d=>d.decision_id===task.decisionId);if(dna)dna.physics.outcome={success,detail,status,workMinutes:task.workMinutes};
 addEvent(w,'action-completed',task.label,detail,{agentId:a.id,actionId:task.id,decisionId:task.decisionId,status,success});
}
function display(a){const t=a.task;if(!t)return;a.currentAction=t.phase==='travel'?`Traveling to ${t.targetPosition} · ${t.label}`:t.label;a.activeAction={id:t.id,decisionId:t.decisionId,actionId:t.actionId,label:a.currentAction,from:{...a.coordinates},to:{...t.destination},moving:t.phase==='travel',phase:t.phase,workMinutes:t.workMinutes,requiredMinutes:t.requiredMinutes};Object.assign(a.mind,{brainMode:t.source,model:t.model||null,fallbackReason:t.fallbackReason||null});a.mind.executionMode=t.source==='ai'?'model_plan':t.emergency?'emergency_rule':'fallback';}
async function startTask(w,a,mind,reason,emergency=false,options={}){
 const chosen=await selectPersistentAction(w,a,mind,reason,emergency?x=>family(x.id)===(options.urgentNeed||urgentNeed(a)):null,options.candidateTransform),targetPosition=actionDestination(w,a,chosen.selected,chosen.mindResult.physicalAction),destination=options.destinationResolver?options.destinationResolver(targetPosition,chosen.selected):targetPosition===a.position?{...a.coordinates}:coordForPosition(targetPosition,w),path=(options.routeFinder||findRoute)(w,a.coordinates,destination);
 const t={origin:{...a.coordinates},id:`A-${chosen.decisionId}`,decisionId:chosen.decisionId,actionId:chosen.selected.id,label:chosen.selected.label,selected:chosen.selected,proposal:chosen.mindResult.physicalAction,source:chosen.mindResult.brainMode,model:chosen.mindResult.model||null,fallbackReason:chosen.mindResult.fallbackReason||null,emergency,targetPosition,destination,path:path||[],pathIndex:1,phase:distance(a.coordinates,destination)>.01?'travel':'work',requiredMinutes:duration(chosen.selected.id),workMinutes:0,startedAt:{day:w.day,hour:w.hour,minute:w.minute||0}};
 t.decisionSummary=chosen.mindResult.decisionSummary;
 if(!path){outcome(w,a,t,false,'No traversable route to the selected destination.','blocked');a.currentAction='Route blocked';a.task=null;return;}
 a.task=t;display(a);
}
function interrupt(w,a,need){
 const task=a.task;
 // Retain suspended work. Its consumed food/work stays accounted; no refund.
 (a.suspendedTasks||=[]).push(structuredClone(task));a.task=null;
 addEvent(w,'action-interrupted',`${a.name} interrupts ${task.label}`,`Urgent ${need} requires attention. Completed work is retained.`,{agentId:a.id,actionId:task.id,decisionId:task.decisionId,need,workMinutes:task.workMinutes});
 const dna=w.dna.find(d=>d.decision_id===task.decisionId);if(dna)dna.physics.outcome={status:'interrupted',success:false,detail:`Interrupted for urgent ${need}; work retained.`};
}
function canResume(a){const need=urgentNeed(a);return a.suspendedTasks?.length&&(!need||a.suspendedTasks.some(t=>family(t.actionId)===need));}
function resume(w,a){
 const need=urgentNeed(a),index=need?a.suspendedTasks.findLastIndex(t=>family(t.actionId)===need):a.suspendedTasks.length-1,t=a.suspendedTasks[index],path=findRoute(w,a.coordinates,t.destination);if(!path)return false;
 a.suspendedTasks.splice(index,1);a.task={...t,path,pathIndex:1,phase:distance(a.coordinates,t.destination)>.01?'travel':'work'};
 addEvent(w,'action-resumed',`${a.name} resumes ${t.label}`,'Resuming retained work after urgent needs improved.',{agentId:a.id,actionId:t.id,decisionId:t.decisionId});display(a);return true;
}
function work(w,a,t,minutes){
 const id=t.actionId,food=consume[id];
 if(food){
  if(!t.portion){
   if(a.inventory[food.item]>0){a.inventory[food.item]--;t.portion={item:food.item,remaining:1};}
   else if(id==='eat_berries'&&a.position==='berries'&&w.resources.berries>0){w.resources.berries--;t.portion={item:'berries',remaining:1};}
   else return {done:true,success:false,detail:'The food is no longer available.'};
  }
  const used=Math.min(t.portion.remaining,minutes/t.requiredMinutes);t.portion.remaining-=used;a.needs[food.need]=clamp(a.needs[food.need]+food.gain*used);
 }else if(id==='drink'){
  if(!w.resources.creekWater)return {done:true,success:false,detail:'Water is no longer available.'};
  a.needs.hydration=clamp(a.needs.hydration+35*minutes/t.requiredMinutes);
 }else if(id==='rest')a.needs.energy=clamp(a.needs.energy+(w.structures.shelter&&a.position==='camp'?30:21)*minutes/t.requiredMinutes);
 t.workMinutes=Math.min(t.requiredMinutes,t.workMinutes+minutes);
 if(t.workMinutes<t.requiredMinutes)return {done:false};
 if(food||['drink','rest','seek_warmth','seek_cover'].includes(id)){
  if(id==='drink')remember(w,a,'The creek provides reliable drinking water.',{importance:8,tags:['water'],confidence:.96});
  return {done:true,success:true,detail:`${a.name} finished ${t.label.toLowerCase()} after ${t.workMinutes} minutes of activity.`};
 }
 if(id==='share_food'){
  const b=w.agents.find(x=>x.id!==a.id&&distance(x.coordinates,a.coordinates)<1.8);
  if(!b||a.inventory.berries<2)return {done:true,success:false,detail:'Food or recipient is no longer here.'};
  a.inventory.berries-=2;b.inventory.berries+=2;return {done:true,success:true,detail:`${a.name} gives two berry portions to ${b.name}.`};
 }
 if(id==='seek_other')return {done:true,success:true,detail:`${a.name} reached the other person's last observed location.`};
 const result=t.proposal?resolvePhysicalAction(w,a,retrieveDecisionContext(w,a),t.proposal,()=>retrieveDecisionContext(w,a)):executeKnown(w,a,t.selected);
 return {done:true,...result};
}
// One hour, twelve bounded steps. All decisions/effects are persisted before the
// viewer can see them; future substeps remain private until their simulation time.
export async function advanceActionHour(input,mind=null,{fallbackReason='utility_policy',onFrame=()=>{}}={}){
 const w=migrateWorld(input);w.meta.persistentActions=1;w.meta.actionRulesVersion='persistent-actions-1';w.minute=0;updateWeather(w);
 for(const a of w.agents)a.coordinates||=coordForPosition(a.position,w);
 const called=new Set();
 for(let minute=0;minute<60;minute+=ACTION_STEP_MINUTES){
  w.minute=minute;
  const agents=[...w.agents].sort((a,b)=>a.id.localeCompare(b.id));
  // Tie priority rotates per hour; array storage order is not a contention rule.
  if((w.day*24+w.hour)%2)agents.reverse();
  for(const a of agents){
   const urgent=urgentNeed(a);
   if(a.task&&urgent&&family(a.task.actionId)!==urgent&&a.task.requiredMinutes-a.task.workMinutes>10&&a.needs[urgent]+10<(a.needs[family(a.task.actionId)]??100))interrupt(w,a,urgent);
   if(!a.task){
    if(!(canResume(a)&&resume(w,a))){const useMind=!urgent&&!called.has(a.id)?mind:null;if(useMind)called.add(a.id);await startTask(w,a,useMind,urgent?'urgent_need':called.has(a.id)?'local_routine':fallbackReason,!!urgent);}
   }
   display(a);
  }
  onFrame(w,minute);
  for(const a of agents){
   const t=a.task;let positionBefore=a.position;
   if(t?.phase==='travel'){
    a.position='travel';positionBefore='travel';const move=advanceRoute(w,a,t,ACTION_STEP_MINUTES);
    a.motionPath=move.path;
    if(move.blocked){outcome(w,a,t,false,'Route became blocked.','blocked');a.task=null;}
    else if(move.arrived){a.position=t.targetPosition;t.phase='work';recordSurfaceUse(w,a,t.origin,t.destination,t.actionId);}
   }else if(t){
    a.motionPath=[{...a.coordinates},{...a.coordinates}];
    const result=work(w,a,t,ACTION_STEP_MINUTES);
    if(result.done){outcome(w,a,t,result.success!==false,result.detail);a.task=null;}
   }
   const ratio=ACTION_STEP_MINUTES/60,n=a.needs;
   n.hydration=clamp(n.hydration-(a.inventory.firedVessel>0?5.5:6.5)*ratio);n.hunger=clamp(n.hunger-4.2*ratio);n.energy=clamp(n.energy-2.8*ratio-(positionBefore==='travel'?.3:0));
   const exposure=thermalExposure(w,{...a,position:positionBefore});n.warmth=clamp(n.warmth+exposure.net*ratio);a.thermalExposure={...exposure,model:'elapsed-location-v2',minutes:ACTION_STEP_MINUTES};
  }
  advanceWood(w,w.day*24+w.hour+(minute+ACTION_STEP_MINUTES)/60);
 }
 w.minute=0;finishHour(w,{needs:false,wood:false});updateSpectatorState(w);
 w.meta.mindMode=w.agents.some(a=>a.mind.brainMode==='ai')?(w.agents.every(a=>a.mind.brainMode==='ai')?'ai':'mixed'):'fallback';
 onFrame(w,60);return w;
}
// Shared low-level elapsed-action primitives. Legacy hourly runner is unchanged.
export {family,urgentNeed,outcome,display,startTask,interrupt,canResume,resume,work};
