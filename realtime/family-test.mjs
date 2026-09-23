import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createWorld,pairKey} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {clock,loadOf} from './holdings.mjs';
import {ensureLife,ageYears,advanceLife,lifeSummary,setAgingYearDays,pregnancyProgress,romanceEligible,willingRomance,completeRomance,familyReadiness,relationshipsFor,DAY} from './life.mjs';
import {parentingCandidates,workParenting,advanceChild} from './parenting.mjs';
import {freeTimeCandidates,workFreeTime} from './free-time.mjs';
import {liveCandidates} from './behavior.mjs';
import {candidateActions} from '../engine/decision.js';
import {RealtimeController} from './world.mjs';

const at=(w,minutes)=>{w.day=Math.floor(minutes/DAY);w.hour=Math.floor(minutes%DAY/60);w.minute=minutes%60;};
const world=()=>{const w=prepare(createWorld());w.temperature=65;w.weather='clear';w.structures.shelter=true;for(const [i,a]of w.agents.entries()){a.coordinates={x:70+i*1.6,y:39};a.task=null;a.needs={hunger:95,hydration:95,energy:95,warmth:85};}return w;};
const readyPair=w=>{const [a,b]=w.agents,r=w.relationships[pairKey(a.id,b.id)];Object.assign(r,{trust:90,familiarity:90,affinity:90});return [a,b,r];};
const waitLove=w=>{at(w,clock(w)+13*60);for(const a of w.agents){a.freeTime.cooldowns.social=0;a.freeTime.company=40;a.freeTime.enjoyment=40;}};

// Existing relationship history and adult ages survive migration and reload.
const old=createWorld(),oldRel=old.relationships[pairKey('agent-mara','agent-ivo')];Object.assign(oldRel,{trust:82,familiarity:77,affinity:68,sharedMemories:12});old.day=94;
const initial=prepare(old);assert.deepEqual(initial.agents.map(a=>ageYears(initial,a)),[26,28]);assert.equal(initial.relationships[pairKey('agent-mara','agent-ivo')].trust,82);assert.equal(initial.relationships[pairKey('agent-mara','agent-ivo')].sharedMemories,12);assert.equal(initial.relationships[pairKey('agent-mara','agent-ivo')].romance.status,'none');
assert.deepEqual(prepare(JSON.parse(JSON.stringify(initial))).agents.map(a=>a.life),initial.agents.map(a=>a.life));
const w=world(),[a,b,r]=readyPair(w);assert(willingRomance(w,a,b,'courtship'));assert(!willingRomance(w,a,b,'commitment'));assert.equal(r.romance.feelings[a.id],0);
const chosen=freeTimeCandidates(w,a).find(c=>c.job.kind==='courtship');assert(chosen,'courtship is a genuine autonomous choice');
const task={id:'date-1',actionId:chosen.id,label:chosen.label,selected:chosen,phase:'work',workMinutes:0,requiredMinutes:20};a.coordinates={...chosen.job.destination};a.task=task;
assert(!workFreeTime(w,a,task,10).done);const progress=JSON.parse(JSON.stringify(w));const pa=progress.agents[0];assert.equal(pa.task.workMinutes,10);const result=workFreeTime(progress,pa,pa.task,10);assert(result.success);const feelings=structuredClone(progress.relationships[pairKey(a.id,b.id)].romance.feelings);workFreeTime(progress,pa,pa.task,10);assert.deepEqual(progress.relationships[pairKey(a.id,b.id)].romance.feelings,feelings,'a saved completed date cannot grant feelings twice');
b.task=null;a.task=null;const refusal=world(),[ra,rb,rr]=readyPair(refusal);rr.trust=10;assert(!willingRomance(refusal,ra,rb,'courtship'));rr.trust=90;rb.life.ageAtEpoch=17;assert(!romanceEligible(refusal,ra,rb));rb.life.ageAtEpoch=28;rb.life.parents=[ra.id];assert(!romanceEligible(refusal,ra,rb));
// Completed mutual dates build distinct feelings before a partnership.
for(let i=0;i<6;i++){waitLove(w);assert(completeRomance(w,a,b,'courtship').success);}
waitLove(w);assert(completeRomance(w,a,b,'commitment').success);assert.equal(a.life.partnerId,b.id);assert.equal(b.life.partnerId,a.id);
assert(!familyReadiness(w,a,b).ready,'a new couple has not established a stable family plan');
at(w,clock(w)+4*DAY);assert(familyReadiness(w,a,b).ready);a.life.familyWish=10;assert(!familyReadiness(w,a,b).ready,'one partner declining blocks a family plan');a.life.familyWish=65;
assert(completeRomance(w,a,b,'family_plan').success);assert(!a.life.pregnancy,'talking about a family does not produce a pregnancy');
for(let i=0;i<25&&!a.life.pregnancy;i++){at(w,clock(w)+DAY+1);if(r.romance.familyAgreedUntil<=clock(w)){assert(completeRomance(w,a,b,'family_plan').success);at(w,clock(w)+13*60);}assert(completeRomance(w,a,b,'private_time').success);}
assert(a.life.pregnancy,'seeded repeated mutually agreed attempts can conceive');assert.equal(a.life.pregnancy.dueAt-a.life.pregnancy.conceivedAt,45*DAY);
// Aging can change later without rewriting the world or existing progress.
at(w,clock(w)+22.5*DAY);const ages=w.agents.map(a=>ageYears(w,a)),p=a.life.pregnancy,half=pregnancyProgress(w,p),physical={day:w.day,hour:w.hour,minute:w.minute,coords:structuredClone(a.coordinates),inventory:structuredClone(a.inventory)};
assert(Math.abs(half-.5)<1e-9);setAgingYearDays(w,28);assert.deepEqual(w.agents.map(a=>ageYears(w,a)),ages);assert.equal(pregnancyProgress(w,p),half);assert.equal(p.dueAt-clock(w),10.5*DAY);assert.deepEqual({day:w.day,hour:w.hour,minute:w.minute,coords:a.coordinates,inventory:a.inventory},physical);
at(w,clock(w)+7*DAY);assert(Math.abs(ageYears(w,a)-ages[0]-.25)<1e-9);setAgingYearDays(w,60);
const pregnant=prepare(JSON.parse(JSON.stringify(w)));assert.deepEqual(pregnant.agents[0].life.pregnancy,p);
const pregnancyFixture=structuredClone(w);at(w,p.dueAt-.01);advanceLife(w);assert.equal(w.agents.length,2);at(w,p.dueAt);advanceLife(w);assert.equal(w.agents.length,3);const baby=w.agents[2];assert.equal(ageYears(w,baby),0);assert.deepEqual(baby.life.parents,[a.id,b.id]);assert.equal(a.life.pregnancy,null);assert.equal(baby.life.carriedBy,a.id);assert.equal(relationshipsFor(w,a).find(r=>r.id===baby.id).romance,null);assert(loadOf(w,a).mass>=3.5);
const births=w.history.filter(e=>e.type==='birth').length,restarted=prepare(JSON.parse(JSON.stringify(w)));advanceLife(restarted);assert.equal(restarted.agents.length,3);assert.equal(restarted.history.filter(e=>e.type==='birth').length,births,'reload cannot duplicate a birth');
assert(!romanceEligible(w,a,baby));assert(!familyReadiness(w,a,b).ready,'an infant needs care before another planned pregnancy');
// Real care requires reach and resources; infants never enter adult jobs.
baby.needs.hunger=baby.needs.hydration=25;const care=parentingCandidates(w,a).find(c=>c.job.mode==='nurse');assert(care);const ct={selected:care,workMinutes:0,requiredMinutes:5},parentFood=a.needs.hunger;
const nurse=workParenting(w,a,ct,5);assert(nurse.success);assert(baby.needs.hunger>=60);assert(a.needs.hunger<parentFood);
advanceChild(w,baby,6);assert.equal(baby.task,null);assert.deepEqual(baby.coordinates,a.coordinates);
const newbornFixture=structuredClone(w);
// Toddlers grow, leave the carrier, receive finite food and remain dependents.
at(w,clock(w)+60*DAY);advanceLife(w);assert.equal(baby.life.stage,'toddler');assert.equal(baby.life.carriedBy,null);baby.coordinates={x:a.coordinates.x+1.6,y:a.coordinates.y};baby.needs.hunger=20;a.inventory.berries=1;const feed=parentingCandidates(w,a).find(c=>c.job.mode==='feed');assert(feed);a.coordinates={...feed.job.destination};const ft={selected:feed,workMinutes:0,requiredMinutes:4};assert(workParenting(w,a,ft,4).success);assert.equal(a.inventory.berries,0);assert.equal(baby.needs.hunger,48);assert(workParenting(w,a,{selected:feed,workMinutes:0,requiredMinutes:4},4).success===false);
const failed={selected:{job:{...feed.job,destination:{...a.coordinates}}},workMinutes:0,requiredMinutes:4};baby.coordinates={x:90,y:60};const untouched=baby.needs.hunger;assert.equal(workParenting(w,a,failed,31).success,false);assert.equal(baby.needs.hunger,untouched,'no feeding at a distance');
const toddlerFixture=structuredClone(w);baby.life.ageAtEpoch=18;baby.life.ageEpoch=clock(w);advanceLife(w);assert.equal(baby.life.stage,'adult');assert(!romanceEligible(w,a,baby),'growing up never removes kinship');assert(!romanceEligible(w,b,baby));
// Real elapsed selection gives a hungry baby priority without granting supplies.
const careWorld=structuredClone(newbornFixture),mother=careWorld.agents[0],child=careWorld.agents[2];for(const p of careWorld.agents.slice(0,2)){p.task=null;p.suspendedTasks=[];p.needs={hunger:95,hydration:95,energy:95,warmth:85};}child.needs.hunger=child.needs.hydration=20;
assert(liveCandidates(careWorld,mother,candidateActions(careWorld,mother)).some(c=>c.job?.kind==='care'));
let careSteps=0;while(child.needs.hunger<48&&careSteps++<1000)await step(careWorld,6);assert(child.needs.hunger>=48,JSON.stringify({task:mother.task,needs:child.needs,steps:careSteps}));assert.equal(child.task,null);assert(!child.inventory.boundSharpTool);assert.equal(careWorld.agents.length,3);
// A dependent walks with a caregiver to real water instead of receiving it remotely.
const waterWorld=structuredClone(toddlerFixture),wa=waterWorld.agents[0],wb=waterWorld.agents[1],wc=waterWorld.agents[2];
for(const [i,p]of waterWorld.agents.entries()){p.coordinates={x:50+i*1.6,y:24};p.task=null;p.suspendedTasks=[];p.needs={hunger:90,hydration:90,energy:90,warmth:80};}wc.needs.hydration=25;wc.youth={attention:90};
let waterSteps=0;while(wc.needs.hydration<55&&waterSteps++<2500)await step(waterWorld,6);
assert(wc.needs.hydration>=55,JSON.stringify({steps:waterSteps,child:wc.coordinates,needs:wc.needs,parents:waterWorld.agents.slice(0,2).map(p=>({position:p.coordinates,task:p.task}))}));
assert(wc.coordinates.y<23,'child physically approached the creek');
const saved=new Map(),storage={get:async k=>saved.get(k),put:async(k,v)=>saved.set(k,v),delete:async k=>saved.delete(k),setAlarm:async()=>{},transaction:async f=>f(storage)},controller=new RealtimeController(storage);await controller.initialize(careWorld);const frame=controller.frame();assert.equal(frame.agents[0].relationships.find(r=>r.id===child.id).status,'Child');assert.equal(frame.agents[2].life.stage,'infant');
const reload=new RealtimeController(storage);await reload.load();assert.deepEqual(reload.frame().agents.map(a=>a.life),frame.agents.map(a=>a.life));
await fs.mkdir('realtime-qa',{recursive:true});await fs.writeFile('realtime-qa/family-fixtures.json',JSON.stringify({relationships:initial,couple:pregnancyFixture,newborn:newbornFixture,toddler:toddlerFixture}));
console.log(JSON.stringify({result:'PASS preserved relationships; adult ages; mutual courtship and replay; kinship and adult eligibility; family choice; pregnancy; rate changes preserve progress and world clock; durable birth exactly once; finite physical care; autonomous parenting; child/adult transition; public family state',careSteps,waterSteps,initialAges:initial.agents.map(a=>ageYears(initial,a)),baby:child.name}));
