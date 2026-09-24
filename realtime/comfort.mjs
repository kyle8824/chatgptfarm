import {knownPlace} from './frontier-knowledge.mjs';
import {naturalWorld} from '../shared/landscape.js';
import {clamp,remember} from '../engine/core.js';
import {distance} from '../engine/navigation.js';
import {clock} from './holdings.mjs';
import {coverEffectiveness} from './structures.mjs';
import {shelterLocal,CAMP} from './layout.mjs';
import {liveWalkable,liveRoute,motionState} from './motion.mjs';
import {restSurfaces} from './rest-surfaces.mjs';

export const ensureComfort=a=>a.comfort??={value:55,uncomfortableMinutes:0,lastRest:null,lastMemoryAt:null};
function protection(w,p){const q=shelterLocal(p,w);return Math.max(w.structures.shelter&&Math.abs(q.x)<CAMP.shelter.halfWidth&&Math.abs(q.y)<CAMP.shelter.halfLength?.85:0,coverEffectiveness(w,p));}
function available(w,a,p,s){
 if(p.ownerId!==a.id&&p.access!=='shared')return false;
 if(w.agents.some(b=>b.id!==a.id&&!b.life?.carriedBy&&(distance(b.coordinates,s.position)<1.1||b.task?.selected?.job?.surfaceId===s.id&&b.task.selected.job.projectId===p.id)))return false;
 // A stocked supply platform is not an empty bed or seat.
 if(w.settlement.stores.some(store=>store.projectId===p.id&&Object.values(store.items).some(n=>n>0)))return false;
 return liveWalkable(w,s.position);
}
export function restPlace(w,a,job=null){
 const shelter=protection(w,a.coordinates),wet=(w.weather==='rain'?1:w.environmentState?.surfaceWetness??.2)*(1-shelter),cold=Math.max(0,55-w.temperature)*.35;
 let support=null,project=null;
 if(job?.surfaceId){project=w.settlement.projects.find(p=>p.id===job.projectId);support=project&&restSurfaces(project).find(s=>s.id===job.surfaceId);if(!support||!available(w,a,project,support)||distance(a.coordinates,support.position)>.3)return null;}
 const score=clamp((support?.comfort??(shelter?32:25))+shelter*6-wet*(support?.height>.2?10:23)-cold);
 return {score,description:support?`${support.soft?'Soft':'Firm'} ${support.label}${shelter>.5?' under cover':''}`:`${wet>.5?'Wet':wet>.25?'Damp':'Bare'} ground${shelter>.5?' under the shelter':''}`,shelter,wet,projectId:project?.id||null,surfaceId:support?.id||null,partIds:support?.partIds||[],height:support?.height||0,posture:support?.posture||'ground',heading:support?.heading??null};
}
export function comfortContext(w,a){const c=a.comfort||{value:55,uncomfortableMinutes:0,lastRest:null};return {value:Math.round(c.value),lastRest:c.lastRest,uncomfortableMinutes:Math.round(c.uncomfortableMinutes),improvementWanted:c.uncomfortableMinutes>=15&&c.value<60,goal:c.uncomfortableMinutes>=15&&c.value<60?'Find or make a dry, supported, more comfortable place to rest.':null};}
export function comfortCandidates(w,a,{relax=false}={}){
 if(!relax&&a.needs.energy>=65)return [];
 const result=[];
 for(const p of w.settlement?.projects||[])for(const s of restSurfaces(p)){
  if(naturalWorld(w)&&(!knownPlace(w,a,p)||distance(a.coordinates,s.position)>40))continue;
  if(!available(w,a,p,s)||!liveRoute(w,a.coordinates,s.position,a))continue;
  const place=restPlace(w,{...a,coordinates:s.position},{projectId:p.id,surfaceId:s.id});if(!place)continue;
  const score=relax?9+(100-(a.freeTime?.enjoyment??55))*.12+(100-a.needs.energy)*.18+place.score*.27:(100-a.needs.energy)*1.1+place.score*.3;
  result.push({id:`${relax?'relax_on':'rest_on'}:${p.id}:${s.id}`,label:`${relax?'Relax':'Rest'} on ${p.name}`,score:score-distance(a.coordinates,s.position)*.25,reasons:[['physical resting comfort',place.score]],job:{kind:relax?'relax':'rest',projectId:p.id,surfaceId:s.id,destination:{...s.position},minutes:relax?20:60,reason:`Use the ${s.label} in ${p.name}; its support, material, condition and exposure determine rest quality.`}});
 }
 return result;
}
export const isRestingTask=t=>t?.actionId==='rest'||['rest','relax'].includes(t?.selected?.job?.kind);
export function willingToRest(w,a,job=null,position=a.coordinates){
 if(a.needs.energy<=30)return true;
 const place=restPlace(w,{...a,coordinates:position},job);if(!place)return false;
 // Once exhaustion required a real rest, do not reconsider at 30.001 energy.
 // A saved task carries this commitment through interruption and restart.
 if(isRestingTask(a.task)&&a.task.recoveryTarget&&a.needs.energy<a.task.recoveryTarget)return true;
 // Exhaustion can justify bad ground. Low spirits and discomfort otherwise
 // motivate a change, instead of another fully-rested quiet-time timer.
 return place.score>=45||((a.happiness?.value??55)>=55&&a.needs.energy<65);
}
export function usefulRestChoice(w,a,c){
 if(c.id!=='rest'&&!['rest','relax'].includes(c.job?.kind))return true;
 return willingToRest(w,a,c.job,c.job?.destination||a.coordinates);
}
export function workComfortRest(w,a,t,minutes){
 const j=t.selected?.job,place=restPlace(w,a,j);
 if(j?.kind==='rest'&&j.projectId&&!j.surfaceId&&!coverEffectiveness(w,a.coordinates))return {done:true,success:false,detail:'This structure no longer provides shelter at the resting place.'};
 if(!place){a.restSupport=null;return {done:true,success:false,detail:'The resting surface is occupied, obstructed, damaged, or out of reach.'};}
 const c=ensureComfort(a),spent=Math.min(minutes,Math.max(0,t.requiredMinutes-t.workMinutes)),relax=j?.kind==='relax';
 if(!relax&&a.needs.energy<=30)t.recoveryTarget??=65;
 a.restSupport=place;
 if(place.heading!==null)motionState(a).facing=place.heading;
 a.needs.energy=clamp(a.needs.energy+spent/60*(relax?10+place.score*.15:18+place.score*.32));
 c.value=clamp(c.value+(place.score-c.value)*Math.min(1,spent/40));
 if(place.score<55)c.uncomfortableMinutes=Math.min(720,c.uncomfortableMinutes+spent);else c.uncomfortableMinutes=Math.max(0,c.uncomfortableMinutes-spent*2);
 c.lastRest={at:clock(w),score:Math.round(place.score),description:place.description,projectId:place.projectId};
 if(place.score<55&&c.uncomfortableMinutes>=15&&(c.lastMemoryAt===null||clock(w)-c.lastMemoryAt>=360)){
  c.lastMemoryAt=clock(w);remember(w,a,`Resting on ${place.description.toLowerCase()} feels uncomfortable (${Math.round(place.score)}/100). I would benefit from a drier, softer, supported resting place.`,{importance:8,tags:['comfort','construction','rest'],confidence:.95});
 }
 if(place.projectId){const p=w.settlement.projects.find(p=>p.id===place.projectId);for(const id of place.partIds){const part=p.parts.find(p=>p.id===id);if(part.durability)part.durability.useWear=(part.durability.useWear||0)+spent*.00002;}}
 t.workMinutes+=spent;
 return {done:t.workMinutes>=t.requiredMinutes,success:true,detail:`${a.name} ${relax?'relaxed':'rested'} on ${place.description.toLowerCase()} at ${Math.round(place.score)}/100 comfort.`};
}
