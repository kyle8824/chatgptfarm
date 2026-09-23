import {walkable} from '../engine/navigation.js';
import {conditionOf,qualityOf,activeParts,structurePerformance,cargoAllowance,clamp01} from '../shared/structure-performance.js';
import {addEvent,remember} from '../engine/core.js';
import {loadOf,clock} from './holdings.mjs';
const at=(p,part,q,pad=0)=>Math.abs(q.x-p.position.x-part.center[0])<=part.size[0]/2+pad&&Math.abs(q.y-p.position.y-part.center[2])<=part.size[2]/2+pad;
export const occupiesCrossing=(p,a)=>p.parts.some(x=>x.built&&x.kind==='deck'&&at(p,x,a.coordinates,.15));
export function workQuality(w,a,part){
 const skill=part.material==='timber'?'woodworking':part.material==='reeds'?'fiberwork':part.material==='stone'?'stoneworking':'clayworking',practice=a.craftPractice?.[skill]?.minutes||0;
 const tool=part.material==='timber'?(a.inventory.boundSharpTool?.12:a.inventory.sharpStone?.05:0):0;
 return Math.min(.96,.38+.32*Math.min(1,Math.sqrt(practice/240))+tool+(part.finish==='hewn'?.14:0)-Math.max(0,Math.min(.1,((part.woodWaterRatio||0)-.24)*.25)));
}
export function recordWorkmanship(w,a,part){part.durability={version:1,origin:'work',quality:workQuality(w,a,part),condition:1,builtAt:clock(w),useWear:0};}
export function noteStructureProblem(w,a,p,kind,detail){
 const key=a.id+':'+kind,prior=p.observations?.[key];if(prior&&clock(w)-prior.at<360)return;
 (p.observations??={})[key]={agentId:a.id,kind,detail,at:clock(w)};
 remember(w,a,`${p.name}: ${detail}`,{importance:8,tags:['construction','maintenance',kind],source:'structure:'+p.id});
 addEvent(w,'structure-problem',`${a.name} notices a problem with ${p.name}`,detail,{agentId:a.id,projectId:p.id});p.revision++;w.settlement.revision++;
}
export function noteCargoLimits(w,a){
 const cargo=loadOf(w,a).mass;
 for(const p of w.settlement?.projects||[])if((p.spansWater||p.purpose==='bridge')&&p.parts.some(x=>x.built)&&Math.hypot(a.coordinates.x-p.position.x,a.coordinates.y-p.position.y)<7){
  const rating=structurePerformance(p);if(rating.cargoKg<cargo)noteStructureProblem(w,a,p,'load-limit',`My ${cargo.toFixed(1)} kg load exceeds this crossing's current ${rating.cargoKg.toFixed(1)} kg cargo allowance. I need a safer route, a lighter load, or a stronger crossing.`);
 }
}
export function recordCrossingWear(w,a,from,to){
 const distance=Math.hypot(to.x-from.x,to.y-from.y);if(!distance)return;
 for(const p of w.settlement?.projects||[])if(p.spansWater||p.purpose==='bridge'){
  const part=p.parts.find(x=>x.built&&x.kind==='deck'&&at(p,x,to));if(!part)continue;
  const d=part.durability;if(d)d.useWear=(d.useWear||0)+distance*.00008*(1+loadOf(w,a).mass/18)/Math.max(.2,qualityOf(part));
  if(!occupiesCrossing(p,{coordinates:from})){p.crossings=(p.crossings||0)+1;}
 }
}
export function advanceStructures(w,seconds){
 const s=w.settlement;if(!s)return;s.wearSeconds=(s.wearSeconds||0)+seconds;if(s.wearSeconds<60)return;
 const elapsed=s.wearSeconds;s.wearSeconds=0;
 for(const p of s.projects){
  const occupied=w.agents.some(a=>!walkable(w,a.coordinates)&&occupiesCrossing(p,a));
  for(const part of p.parts.filter(x=>x.built)){
   // Activate at current time. Never invent past wear or earned skill on load.
   part.durability??={version:1,origin:'legacy-estimate',quality:qualityOf(part),condition:1,builtAt:clock(w),useWear:0};
   const d=part.durability,before=d.condition;if(before<=.12&&!(occupied&&(p.spansWater||p.purpose==='bridge')))continue;
   const weather=w.weather==='rain'?part.material==='clay'?3:1.8:1,base={timber:.035,reeds:.1,stone:.006,clay:.12}[part.material]||.04;
   d.condition=clamp01(before-elapsed/86400*base*weather*(part.sealant?.kind==='pine-resin'?.7:1)/Math.max(.2,d.quality)-(d.useWear||0));d.useWear=0;
   if(d.condition<=.12&&occupied&&(p.spansWater||p.purpose==='bridge')){d.condition=.121;p.closing=true;}
   else if(d.condition<=.12)d.condition=0;
   if(before>.12&&d.condition===0)addEvent(w,'structure-failed',`${part.id} in ${p.name} failed`,'The material remains at the site, but this component and its dependent pieces no longer provide support.',{projectId:p.id});
  }
  const rating=structurePerformance(p);p.performance=rating;
  if(p.closing&&!occupied){for(const part of p.parts)if(part.durability?.condition<=.121)part.durability.condition=0;p.closing=false;p.performance=structurePerformance(p);}
  const store=s.stores.find(x=>x.id===p.storeId);
  if(store){
   store.designCapacity??={mass:store.capacityKg,volume:store.capacityVolume,covered:store.covered,secured:store.secured,baseHeight:store.baseHeight};
   const base=store.designCapacity,r=p.performance;
   store.capacityKg=base.mass*r.storageFactor;store.capacityVolume=base.volume*r.storageFactor;
   store.coverage=base.covered?r.roofProtection:0;store.covered=!!base.covered&&store.coverage>0;store.secured=!!base.secured&&r.condition>=.35;
   store.baseHeight=r.storageFactor>0?base.baseHeight:.07;
   // Over-capacity contents remain real possessions. New deposits are refused;
   // failed storage leaves the same contents exposed at ground level.
  }
  for(const a of w.agents)if(Math.hypot(a.coordinates.x-p.position.x,a.coordinates.y-p.position.y)<8){
   if(p.performance.condition<.65)noteStructureProblem(w,a,p,'wear',`The structure is ${p.performance.status.toLowerCase()}; its weakest component has ${Math.round(p.performance.condition*100)}% condition. Repairs or a replacement would restore usefulness.`);
   if(store&&store.coverage>0&&store.coverage<.75&&w.weather==='rain')noteStructureProblem(w,a,p,'leaks','Rain gets through the roof and wets stored supplies. Better roofing or repairs could reduce exposure.');
  }
  p.revision++;s.revision++;
 }
}
export function requestMaintenance(w,a,id,reason){
 const p=w.settlement.projects.find(x=>x.id===id);
 if(!p||p.status!=='complete'||p.ownerId!==a.id&&p.access!=='shared')throw Error('This structure is not available for maintenance');
 if(structurePerformance(p).condition>=.95)throw Error('No worn component currently needs repair');
 p.maintenanceRequested={by:a.id,reason:String(reason||'Restore useful structure').slice(0,350),at:clock(w)};
 return p;
}
