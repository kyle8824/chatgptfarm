import {migrateWorld,clamp,finishHour,updateWeather,addEvent} from '../engine/core.js';
import {family,urgentNeed,outcome,display,startTask,interrupt,canResume,resume,work} from '../engine/persistent-actions.js';
import {thermalExposure} from '../engine/thermal.js';
import {coordForPosition,recordSurfaceUse,updateSpectatorState} from '../engine/spectator.js';
import {advanceWood} from '../engine/wood-runtime.js';
import {advanceRoute} from '../engine/navigation.js';

export function prepare(seed){
 const w=migrateWorld(structuredClone(seed));delete w.runtime;
 w.meta.persistentActions=1;w.meta.actionRulesVersion='realtime-2';w.minute=Number(w.minute||0);
 for(const a of w.agents){a.coordinates||=coordForPosition(a.position,w);delete a.runtimeMotion;}
 return w;
}
// No loop into future time, no transition.after, no future frames. The caller
// supplies ONLY elapsed duration. At most 6 simulated seconds per physics step.
export async function step(w,seconds,{mind=null,fallbackReason='no_provider',wallTime=Date.now()}={}){
 if(!(seconds>0&&seconds<=6.000001))throw Error('Invalid elapsed step');
 const minutes=seconds/60;
 const agents=[...w.agents].sort((a,b)=>a.id.localeCompare(b.id));
 if((w.day*24+w.hour)%2)agents.reverse();
 for(const a of agents){
  const urgent=urgentNeed(a);
  if(a.task&&urgent&&family(a.task.actionId)!==urgent&&a.task.requiredMinutes-a.task.workMinutes>0.1&&a.needs[urgent]+10<(a.needs[family(a.task.actionId)]??100))interrupt(w,a,urgent);
  if(!a.task&&!(canResume(a)&&resume(w,a)))await startTask(w,a,mind,urgent?'urgent_need':fallbackReason,!!urgent);
  const t=a.task,from={...a.coordinates};if(t&&a.liveThought?.actionId===t.actionId&&t.source==='ai')a.liveThought.status='acting';let positionBefore=a.position;
  if(t?.phase==='travel'){
   a.position='travel';positionBefore='travel';const movement=advanceRoute(w,a,t,minutes);
   if(movement.blocked){outcome(w,a,t,false,'Route changed while travelling.','blocked');a.task=null;}
   else if(movement.arrived){a.position=t.targetPosition;t.phase='work';recordSurfaceUse(w,a,t.origin,t.destination,t.actionId);}
  }else if(t){const result=work(w,a,t,minutes);if(result.done){outcome(w,a,t,result.success!==false,result.detail);a.task=null;}}
  const ratio=seconds/3600,n=a.needs;
  n.hydration=clamp(n.hydration-(a.inventory.firedVessel>0?5.5:6.5)*ratio);n.hunger=clamp(n.hunger-4.2*ratio);n.energy=clamp(n.energy-2.8*ratio-(positionBefore==='travel'?3.6*ratio:0));
  const exposure=thermalExposure(w,{...a,position:positionBefore});n.warmth=clamp(n.warmth+exposure.net*ratio);a.thermalExposure={...exposure,model:'elapsed-location-live',minutes};
  if(a.task)display(a);else{a.activeAction=null;a.currentAction='Choosing next action';}
  // Past positions only. Viewer may interpolate these; never predicts a target.
  delete a.runtimeMotion;
 }
 w.minute+=minutes;
 advanceWood(w,w.day*24+w.hour+w.minute/60);
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
