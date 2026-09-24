import {shelterWood} from '../engine/wood-runtime.js';
import {addEvent,clamp,remember} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {campLayout} from '../shared/frontier.js';
import {clock} from './holdings.mjs';

// Keep the original shelter cost and 180-minute work requirement. Unlike the
// old final-action toggle, material investment and shared work survive meals,
// another builder taking over, and checkpoint reloads.
export function workPrimitiveShelter(w,a,t,minutes){
 if(w.structures.shelter)return {done:true,success:true,detail:'The camp shelter is already complete.'};
 const camp=campLayout(w);
 if(Math.min(distance(a.coordinates,camp.shelter),distance(a.coordinates,camp.fire))>6)return {done:true,success:false,detail:'The shelter must be built at the camp.'};
 let build=w.structures.shelterConstruction;
 if(!build){
  if((a.inventory.dryWood||0)+(a.inventory.wetWood||0)<4)return {done:true,success:false,detail:'Four branches must be carried here before assembly can start.'};
  shelterWood(w,a);
  build=w.structures.shelterConstruction={invested:true,workMinutes:Math.min(180,t.workMinutes||0),requiredMinutes:180,startedAt:clock(w),contributions:{}};
 }
 const spent=Math.min(minutes,180-build.workMinutes);build.workMinutes+=spent;build.contributions[a.id]=(build.contributions[a.id]||0)+spent;
 t.workMinutes=build.workMinutes;t.requiredMinutes=180;
 a.needs.energy=clamp(a.needs.energy-spent/180*18);
 if(build.workMinutes<180)return {done:false};
 w.structures.shelter=true;build.completedAt=clock(w);a.position='camp';
 remember(w,a,'The branch shelter is complete after setting up its frame and adding cover.',{importance:8,tags:['construction','shelter']});
 addEvent(w,'construction-complete','A crude shelter is finished','Carried branches and accumulated work formed the frame and weather cover.',{agentId:a.id});
 return {done:true,success:true,detail:`${a.name} finished the branch shelter after its frame and covering were assembled.`};
}
