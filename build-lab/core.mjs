import {createWorld,remember} from '../engine/core.js';
import {prepare,step} from '../realtime/elapsed.mjs';
import {buildingSites,designContext,validateBlueprint,adoptBlueprint,DESIGN_SYSTEM} from '../realtime/blueprints.mjs';
import {restSurfaces} from '../realtime/rest-surfaces.mjs';
import {restPlace,comfortCandidates} from '../realtime/comfort.mjs';
import {thermalExposure} from '../engine/thermal.js';
import {coverEffectiveness} from '../realtime/structures.mjs';
import {constructionBlockers,bindingBudget} from '../shared/craft.js';
import {clock} from '../realtime/holdings.mjs';
import {fuelFire} from '../engine/wood-runtime.js';
import {HOME_REGIONS,campsOf} from '../shared/frontier.js';
import {configureTask} from '../realtime/motion.mjs';

export const LAB_VERSION=1;
export const SCENARIOS={
 cold:{name:'Cold evening',description:'A tired person has a working fire, uncomfortable ground, and limited carried supplies.',temperature:44,weather:'clear',warmth:42,energy:58,comfort:25,fire:true,reeds:4,cordage:2,practice:16},
 rain:{name:'Wet camp',description:'Rain makes exposed rest unpleasant. No finished shelter or furniture is provided.',temperature:54,weather:'rain',warmth:55,energy:58,comfort:25,fire:false,reeds:4,cordage:2,practice:16},
 novice:{name:'New builder',description:'Little practice, no finished tool, and few prepared bindings. Prerequisites must be earned.',temperature:65,weather:'clear',warmth:80,energy:72,comfort:30,fire:false,reeds:3,cordage:0,practice:0},
 comfortable:{name:'Comfortable afternoon',description:'Needs are comfortable. The designer may defer building or identify another worthwhile improvement.',temperature:68,weather:'clear',warmth:85,energy:85,comfort:80,fire:false,reeds:4,cordage:2,practice:16}
};
const bounded=(x,fallback,min,max)=>Number.isFinite(Number(x))?Math.min(max,Math.max(min,Number(x))):fallback;
export function settings(input={}){
 const scenario=Object.hasOwn(SCENARIOS,input.scenario)?input.scenario:'cold',base=SCENARIOS[scenario];
 return {scenario,nearbySites:input.nearbySites===true,temperature:bounded(input.temperature,base.temperature,10,90),weather:['clear','rain','snow'].includes(input.weather)?input.weather:base.weather,
 warmth:bounded(input.warmth,base.warmth,0,100),energy:bounded(input.energy,base.energy,0,100),comfort:bounded(input.comfort,base.comfort,0,100),
 fire:typeof input.fire==='boolean'?input.fire:base.fire,reeds:Math.floor(bounded(input.reeds,base.reeds,0,8)),cordage:Math.floor(bounded(input.cordage,base.cordage,0,6)),practice:bounded(input.practice,base.practice,0,60)};
}
export function freshExperiment(input={}){
 const config=settings(input),seed=createWorld(),a=seed.agents[0];seed.agents=[a];seed.relationships={};
 seed.weather=config.weather;seed.temperature=config.temperature;seed.environmentState.surfaceWetness=config.weather==='rain'?.9:.2;
 a.coordinates={x:64,y:37};a.position='camp';a.needs={hunger:90,hydration:90,energy:config.energy,warmth:config.warmth};
 Object.assign(a.inventory,{berries:2,reeds:config.reeds,cordage:config.cordage,sharpStone:config.practice?1:0,boundSharpTool:config.practice>=12?1:0,dryWood:config.fire?2:0});
 a.craftPractice=Object.fromEntries(['woodworking','fiberwork','stoneworking'].map(k=>[k,{minutes:config.practice,attempts:0,successes:0}]));
 a.skills=config.practice?{woodworking:true,fiberwork:true,stoneworking:true}:{};
 a.comfort={value:config.comfort,uncomfortableMinutes:config.comfort<40?30:0,lastRest:null,lastMemoryAt:null};
 const w=prepare(seed);a.householdId='willow-basin';const person=w.agents[0];person.householdId='willow-basin';
 // A one-person controlled fixture, using the same coordinate-based heat
 // model as the frontier world. This is never a production snapshot/reset.
 w.frontier={version:1,size:100,homes:[{...HOME_REGIONS[0],provider:'openai'}],firstContacts:{}};
 if(config.fire)fuelFire(w,person,2);
 remember(w,person,SCENARIOS[config.scenario].description,{importance:8,tags:['lab','experience']});
 return {version:LAB_VERSION,config,world:w,elapsedMinutes:0,observations:[],proposal:null,validation:null,activeRunId:null};
}
export function siteChoices(lab){
 const w=lab.world,a=w.agents[0],sites=buildingSites(w,a).filter(s=>!s.spansWater&&!s.climbsTerrain);
 if(lab.config.nearbySites)for(const position of [{x:67,y:33},{x:63,y:37},{x:59,y:33}]){
  const site={id:`local-${position.x}-${position.y}`,position,width:4,depth:4,experimental:true};
  // Use the existing issued-site validation; do not relax clearance/routes.
  try{validateBlueprint(w,a,{build:true,name:'Site clearance probe',purpose:'probe',rationale:'Site availability only',siteId:site.id,code:"part({id:'probe',kind:'deck',material:'stone',center:[0,.04,0],size:[.08,.08,.08],requires:[]});"},site);if(!sites.some(s=>s.id===site.id))sites.push(site);}catch{}
 }
 return sites;
}
function exposureAt(w,a,position){
 const exposure=thermalExposure(w,{...a,coordinates:position}),cover=coverEffectiveness(w,position);
 if(cover&&!exposure.sheltered){exposure.rainLoss*=1-cover;exposure.shelterProtection=Math.min(exposure.coldLoss,2*cover);exposure.net=exposure.fireGain+exposure.shelterProtection-exposure.coldLoss-exposure.rainLoss;}
 return exposure;
}
export function measures(lab){
 const w=lab.world,a=w.agents[0],projects=w.settlement.projects,rest=[];
 for(const p of projects)for(const s of restSurfaces(p)){
  const place=restPlace(w,{...a,coordinates:s.position},{projectId:p.id,surfaceId:s.id});if(!place)continue;
  rest.push({projectId:p.id,surfaceId:s.id,position:s.position,posture:s.posture,comfort:place.score,cover:place.shelter,heatPerHour:exposureAt(w,a,s.position).net});
 }
 return {needs:{...a.needs},comfort:a.comfort.value,lastRest:structuredClone(a.comfort.lastRest),elapsedMinutes:lab.elapsedMinutes,projects:projects.length,completed:projects.filter(p=>p.status==='complete').length,
 builtParts:projects.reduce((n,p)=>n+p.parts.filter(x=>x.built).length,0),totalParts:projects.reduce((n,p)=>n+p.parts.length,0),
 workMinutes:projects.reduce((n,p)=>n+p.parts.reduce((m,q)=>m+q.workMinutes,0),0),rest,bindings:projects.map(p=>({id:p.id,...bindingBudget(p)})),
 practice:structuredClone(a.craftPractice||{}),action:a.currentAction,position:{...a.coordinates}};
}
export function requestContext(lab){
 const w=lab.world,a=w.agents[0],context=designContext(w,a);
 return {...context,sites:siteChoices(lab),weather:w.weather,temperature:w.temperature,experiment:{scenario:lab.config.scenario,elapsedMinutes:lab.elapsedMinutes},
 spatialContext:{person:{...a.coordinates},fires:campsOf(w).map(c=>({position:c.fire,burning:!!c.structures.fire,heatRadius:4})),
  sites:siteChoices(lab).map(s=>({id:s.id,position:s.position,heatPerHour:exposureAt(w,a,s.position).net,distanceFromPerson:Math.hypot(s.position.x-a.coordinates.x,s.position.y-a.coordinates.y)}))},
 measuredUse:lab.observations.slice(-4),actualRestSurfaces:measures(lab).rest,
 previousRejection:lab.validation?.ok===false?lab.validation.error:null,previousProgram:lab.validation?.ok===false?lab.proposal?.code:null};
}
export function promptFor(variant='context',instruction=''){
 const baseline=variant==='baseline';
 return DESIGN_SYSTEM+(baseline?'':`\nLAB EXPERIMENT: Choose a persistent practical improvement from experience. Compare two feasible alternatives and deferring before choosing. Consider rest, heat, weather, access, labor, materials and existing useful pieces together. Use spatialContext and measuredUse; a completed structure is not proof of benefit. Extend an existing useful structure where appropriate, or explain why a replacement is better. Do not follow a building catalog or required progression. Do not prefer a chair, bed, hut or any named object by default. Add fields problem:string, alternatives:[{option:string,tradeoff:string}], expectedBenefit:string, successCheck:string. Expected benefits are hypotheses; the simulator measures actual use.`)
  +(instruction.trim()?`\nExperimental planning instruction (does not change physics or grant capabilities): ${instruction.trim().slice(0,1500)}`:'');
}
export function validateProposal(lab,raw){
 try{
  if(raw?.build===false){lab.proposal=structuredClone(raw);return lab.validation={ok:true,deferred:true,message:raw.rationale||'The designer chose to defer building.'};}
  if(typeof raw?.code!=='string'||raw.code.length>14000)throw Error('A construction program of at most 14,000 characters is required.');
  const p=validateBlueprint(lab.world,lab.world.agents[0],raw,siteChoices(lab).find(s=>s.id===raw.siteId));lab.proposal=structuredClone(raw);
  const existing=p.extendsProjectId?lab.world.settlement.projects.find(x=>x.id===p.extendsProjectId)?.parts.length||0:0,newParts=p.parts.slice(existing),bill={};
  for(const part of newParts)bill[part.material]=(bill[part.material]||0)+part.materialUnits;
  return lab.validation={ok:true,project:p,bill,workMinutes:newParts.reduce((n,p)=>n+p.requiredMinutes,0),bindings:bindingBudget(p),
   blockers:newParts.flatMap(part=>constructionBlockers(lab.world.agents[0],part,p).map(message=>({partId:part.id,message}))),
   labels:p.affordances?.labels||[],message:'Geometry accepted. Functions shown here are predictions until parts are built and used.'};
 }catch(e){lab.proposal=raw?structuredClone(raw):null;return lab.validation={ok:false,error:e.message};}
}
export function adoptProposal(lab){
 if(!lab.proposal||lab.proposal.build===false)throw Error('No build proposal to adopt.');
 // Revalidate against the current experiment; elapsed work may change sites.
 const p=validateBlueprint(lab.world,lab.world.agents[0],lab.proposal,siteChoices(lab).find(s=>s.id===lab.proposal.siteId));
 const adopted=adoptBlueprint(lab.world,lab.world.agents[0],p,lab.proposal.labModel||'manual experiment');
 lab.validation=null;lab.proposal=null;return adopted;
}
export async function advanceExperiment(lab,minutes,{yieldEvery=50,onFrame=()=>{},shouldStop=()=>false}={}){
 if(!Number.isFinite(minutes)||minutes<0||minutes>60)throw Error('Run between 0 and 60 simulated minutes at once.');
 const before=measures(lab);let remaining=minutes*60,index=0;
 while(remaining>1e-7&&!shouldStop()){const seconds=Math.min(6,remaining);await step(lab.world,seconds,{fallbackReason:'lab rules; AI only for requested designs',wallTime:Date.UTC(2026,0,1)+Math.round((lab.elapsedMinutes*60+seconds)*1000)});remaining-=seconds;lab.elapsedMinutes+=seconds/60;
  if(++index%yieldEvery===0){onFrame();await new Promise(resolve=>setTimeout(resolve,0));}
 }
 const after=measures(lab),observation={kind:'elapsed simulation',minutes:after.elapsedMinutes-before.elapsedMinutes,before,after,at:clock(lab.world)};lab.observations.push(observation);lab.observations=lab.observations.slice(-12);return observation;
}
export function selectRestTest(lab,projectId,surfaceId){
 const w=lab.world,a=w.agents[0],candidate=comfortCandidates(w,a,{relax:true}).find(c=>c.job.projectId===projectId&&c.job.surfaceId===surfaceId);
 if(!candidate)throw Error('That completed surface is not reachable or available.');
 if(a.task)(a.suspendedTasks??=[]).push(structuredClone(a.task));
 candidate.job={...candidate.job,minutes:10};
 a.task={id:'lab-rest-'+clock(w),actionId:candidate.id,label:'Controlled use test',selected:candidate,source:'lab-directed',targetPosition:a.position,workMinutes:0,requiredMinutes:10,phase:'travel',origin:{...a.coordinates}};
 configureTask(w,a);return candidate;
}
