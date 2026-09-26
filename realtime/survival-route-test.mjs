import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {householdWorld} from '../shared/frontier.js';
import {candidateActions} from '../engine/decision.js';
import {liveCandidates,rememberFailure} from './behavior.mjs';
import {chooseDestination,liveWalkable,liveClear,configureTask} from './motion.mjs';
import {withinWaterReach} from './water.mjs';
import {advanceSurvivalRoute} from './survival-route.mjs';
import {distance} from '../engine/navigation.js';

function fixture(){
 const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
 const a=w.agents.find(a=>a.name==='Tessa');w.agents=[a];
 a.coordinates={x:-304.96987183121695,y:-283.9599313734205};a.position='travel';
 a.needs={hunger:0,hydration:0,warmth:0,energy:30.65};a.task=null;a.suspendedTasks=[];a.locomotion=null;
 a.siteKnowledge={};for(const k of Object.keys(a.inventory))a.inventory[k]=0;
 a.knownCamps=[a.householdId];w.weather='cloudy';w.temperature=49;
 const site=w.regions.sites['wild-food-325-140'];a.siteKnowledge[site.id]={quantity:site.quantity,observedHour:w.day*24+w.hour};
 return {w,a,site};
}
const {w,a,site}=fixture();
const bank=chooseDestination(householdWorld(w,a),a,'creek',{id:'drink'});
assert(withinWaterReach(w,bank),'a blocked nearest bank must not hide a reachable farther bank');
assert(liveClear(w,a.coordinates,bank,a),'the reported position has a safe direct bank approach');
const initialFood=site.quantity,initialPosition={...a.coordinates};
let drank=false,ate=false,planned=false,saved=false,maxStep=0;
for(let i=0;i<1600;i++){
 const previous={...a.coordinates},hydration=a.needs.hydration,berries=a.inventory.berries;
 await step(w,6);maxStep=Math.max(maxStep,distance(previous,a.coordinates));
 assert(liveWalkable(w,a.coordinates),'recovery stays on walkable ground');
 if(a.needs.hydration>hydration){assert(withinWaterReach(w,a.coordinates),'hydration only rises at water');drank=true;}
 if(a.inventory.berries>berries)assert(distance(a.coordinates,site.position)<=6,'finite food is collected at the site');
 if(a.task?.survivalJourney){
  planned=true;assert.equal(a.task.workMinutes,0,'planning never credits remote foraging work');
  if(!saved&&a.task.survivalJourney.search.expanded>16){
   const copy=structuredClone(w),ca=copy.agents[0],before=ca.task.survivalJourney.search.expanded;
   const result=advanceSurvivalRoute(householdWorld(copy,ca),ca,ca.task);
   assert(result.expanded<=8,'fallback routing has a per-step work bound');
   assert(!ca.task.survivalJourney||ca.task.survivalJourney.search.expanded>before,'a checkpoint resumes its existing search');saved=true;
  }
 }
 if(a.needs.hunger>20){ate=true;break;}
}
assert(drank&&ate,'the observed zero-needs traveler must walk, drink, gather and eat');
assert(planned&&saved,'a long food approach uses bounded resumable route planning');
assert(site.quantity<initialFood,'food recovery consumes the actual finite patch');
assert(distance(initialPosition,a.coordinates)>30&&maxStep<8,'recovery uses physical steps, not teleportation');
assert(a.needs.warmth<5,'routing does not manufacture heat');

const blocked=fixture(),v=householdWorld(blocked.w,blocked.a);
rememberFailure(v,blocked.a,{actionId:'drink'},'No safe water route.');
const offered=liveCandidates(v,blocked.a,candidateActions(v,blocked.a));
assert(offered.length&&offered.every(c=>/^(forage:|survey:|eat_)/.test(c.id)),'another critical need gets priority during a water-route cooldown');
const unknown=Object.values(blocked.w.regions.sites).find(s=>s.id!==blocked.site.id&&distance(s.position,blocked.a.coordinates)>50);
assert(!offered.some(c=>c.id==='forage:'+unknown.id),'routing does not reveal unknown distant food');
blocked.a.task={actionId:'forage:'+blocked.site.id,selected:{id:'forage:'+blocked.site.id},targetPosition:blocked.site.id,liveSpaceVersion:1,phase:'work',workMinutes:0};
configureTask(v,blocked.a);
assert.notEqual(blocked.a.task.phase,'work','old false-arrival tasks migrate to physical travel or planning');
console.log(JSON.stringify({result:'PASS observed Tessa pose: reachable bank, physical finite food recovery, bounded checkpointed routing, critical fallback, no remote work/heat/teleportation',needs:a.needs,foodUsed:initialFood-site.quantity,maxStep}));
