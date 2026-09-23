import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {householdWorld,campLayout} from '../shared/frontier.js';
import {configureTask,advanceLiveRoute,liveRoute,motionState} from './motion.mjs';
import {liveCandidates,retireObsoleteTask,rememberFailure} from './behavior.mjs';
import {candidateActions} from '../engine/decision.js';
import {freeTimeCandidates,finishFreeTime} from './free-time.mjs';
import {willingToRest} from './comfort.mjs';
import {thermalExposure} from '../engine/thermal.js';
import {workSettlement,settlementCandidates,findMaterialSource} from './settlement.mjs';
import {buildingSites,validateBlueprint,adoptBlueprint} from './blueprints.mjs';
import {makeStore} from './holdings.mjs';

const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
const r=w.agents.find(a=>a.name==='Ronan'),view=()=>householdWorld(w,r);
r.coordinates={x:-332.93329082927727,y:-322.9474553340321};r.locomotion={...motionState(r),speed:.3868,facing:2.3695};
r.task={id:'reported-ronan-route',actionId:'forage:ochre-vale:upland-berries',selected:{id:'forage:ochre-vale:upland-berries'},targetPosition:'ochre-vale:upland-berries',phase:'travel',workMinutes:0};
configureTask(view(),r);const journey=r.task,food=r.inventory.berries;let result;
for(let i=0;i<1200;i++){result=advanceLiveRoute(view(),r,journey,.6);if(result.arrived||result.blocked)break;}
assert(result.arrived||result.blocked,'reported route must arrive or stop, not orbit indefinitely');assert.equal(r.inventory.berries,food,'travel never grants berries');

// Successful route recomputation must not erase an inability to make progress.
const blocked=prepare(createWorld()),b=blocked.agents[0];blocked.agents=[b];b.coordinates={x:70,y:39};
const destination={x:73,y:39},task={actionId:'test-route',destination,path:liveRoute(blocked,b.coordinates,destination,b),pathIndex:1};
assert(task.path);let stalled;
for(let i=0;i<160;i++){
 // A route accepted again by a planner is not physical movement.
 b.coordinates={x:70,y:39};task.path=liveRoute(blocked,b.coordinates,destination,b);task.pathIndex=1;task.progressIndex=null;
 stalled=advanceLiveRoute(blocked,b,task,.6);if(stalled.blocked)break;
}
assert(stalled.blocked,'90 seconds without net journey progress retires repeated valid replans');rememberFailure(blocked,b,task,'Route made no progress');assert(b.liveFailures['test-route']);

const a=b;blocked.temperature=60;blocked.weather='clear';a.needs={hydration:90,hunger:90,energy:95,warmth:80};a.happiness.value=30;a.comfort.value=20;a.comfort.uncomfortableMinutes=100;
a.task={id:'saved-bad-break',actionId:'leisure:relax',label:'Relax',destination:{...a.coordinates},selected:{job:{kind:'relax'}},workMinutes:5};
assert(!willingToRest(blocked,a));retireObsoleteTask(blocked,a);assert.equal(a.task,null);
assert(!liveCandidates(blocked,a,candidateActions(blocked,a)).some(c=>c.id==='rest'||c.job?.kind==='relax'));
a.needs.energy=15;assert(willingToRest(blocked,a),'exhaustion permits rest even on uncomfortable ground');a.needs.energy=95;

// A reusable cord supports real elapsed practice, including checkpointing,
// but no new inventory and no experience before the session is completed.
a.inventory.cordage=4;a.freeTime.cooldowns={};
const drill=freeTimeCandidates(blocked,a).find(c=>c.job.kind==='practice_technique'&&c.job.item==='cordage');assert(drill);
const practice={selected:drill,requiredMinutes:drill.job.minutes,workMinutes:0};const inventory=structuredClone(a.inventory);
assert(!workSettlement(blocked,a,practice,6).done);assert(!a.craftPractice?.fiberwork);
const saved=JSON.parse(JSON.stringify(practice)),done=workSettlement(blocked,a,saved,6);assert(done.success);assert.equal(a.craftPractice.fiberwork.minutes,12);
workSettlement(blocked,a,saved,6);assert.equal(a.craftPractice.fiberwork.minutes,12,'completion cannot double-credit skill');finishFreeTime(blocked,a,saved,done);
assert.deepEqual(a.inventory,inventory);assert(!freeTimeCandidates(blocked,a).some(c=>c.job.practice));

// Fire heat is local, absent when extinguished, and fast enough for a short
// visit: 0 to 80 in under 30 world minutes / five real minutes at 6x speed.
const camp=campLayout(view());view().structures.fire=true;w.temperature=40;w.weather='rain';r.coordinates={x:camp.fire.x+2,y:camp.fire.y};
assert(thermalExposure(view(),r).net*30/60>=80);r.coordinates.x+=8;assert.equal(thermalExposure(view(),r).fireGain,0);view().structures.fire=false;r.coordinates.x-=8;assert.equal(thermalExposure(view(),r).fireGain,0);

// A completed site's leftovers remain finite and accessible. Fold an empty
// rack through actual labor, then assign that very rack to a nearby plan.
const s=makeStore(blocked,{ownerId:a.id,kind:'site',projectId:'old',position:{x:71,y:39},items:{stones:3}});
blocked.settlement.projects.push({id:'old',status:'complete',ownerId:a.id,access:'private',position:{x:71,y:39},parts:[],bounds:{minX:70,maxX:72,minZ:38,maxZ:40}});
assert(findMaterialSource(blocked,a,'stone').some(c=>c.storeId===s.id));assert(!settlementCandidates(blocked,a).some(c=>c.id==='fold_rack:'+s.id));s.items.stones=0;
const fold=settlementCandidates(blocked,a).find(c=>c.id==='fold_rack:'+s.id);assert(fold);a.coordinates={...fold.job.destination};const ft={selected:fold,requiredMinutes:1.5,workMinutes:0};assert(!workSettlement(blocked,a,ft,.75).done);assert(!s.folded);assert(workSettlement(blocked,a,ft,.75).success);assert(s.folded);
const before={id:s.id,position:{...s.position},count:blocked.settlement.stores.length};
const code="for(let x=0;x<2;x++)for(let z=0;z<2;z++)part({id:'mat'+x+z,kind:'deck',material:'reeds',center:[(x-.5)*.5,.04,(z-.5)*1.1],size:[.5,.08,1.1],requires:[]});";
const design=validateBlueprint(blocked,a,{build:true,name:'Soft resting mat',purpose:'comfort',rationale:'Improve uncomfortable ground rest',siteId:buildingSites(blocked,a).find(s=>!s.spansWater).id,access:'private',code});const p=adoptBlueprint(blocked,a,design,'isolated-test');
assert.equal(p.stockpileId,before.id);assert.deepEqual(s.position,before.position);assert.equal(blocked.settlement.stores.length,before.count);assert(s.folded,'adopting a drawing cannot unfold the rack');assert(settlementCandidates(blocked,a).some(c=>c.id==='unfold_rack:'+s.id));
console.log(JSON.stringify({result:'PASS bounded Ronan route, replanning watchdog, unhappy rest refusal, exhausted recovery, finite reusable practice, fast local heat and physical rack reuse',ronan:result}));
