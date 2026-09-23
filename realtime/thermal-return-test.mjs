import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {candidateActions} from '../engine/decision.js';
import {distance} from '../engine/navigation.js';
import {householdWorld} from '../shared/frontier.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {liveWalkable,liveClear} from './motion.mjs';
import {liveCandidates,liveUrgency} from './behavior.mjs';
import {updateThermalGoal,returnCamp,returnCandidate} from './thermal-return.mjs';
import {beginReturnRoute,advanceReturnRoute,RETURN_ROUTE_EXPANSIONS,RETURN_ROUTE_LIMIT} from './return-route.mjs';
import {explorationMotivation} from './exploration.mjs';
import {progressRatio,progressText} from '../web/live/task-view.js';

const observed={x:-57.912250642628294,y:-100.86658348973592};
function fixture(){
 const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
 const a=w.agents.find(a=>a.id==='agent-mara');w.agents=[a];
 a.coordinates={...observed};a.position='travel';a.needs={hydration:98,hunger:98,energy:55,warmth:0};
 a.task=null;a.suspendedTasks=[];a.locomotion=null;a.inventory.berries=2;
 w.weather='rain';w.temperature=38;w.liveWeatherUntil=w.day*24+w.hour+6;
 return {w,a};
}
// The entire long route obeys existing collision/terrain checks, with a hard
// per-step limit. The partially explored search survives JSON checkpoints.
let {w,a}=fixture(),search=beginReturnRoute(a.coordinates,{x:64,y:34}),result;
for(let i=0;i<5;i++){result=advanceReturnRoute(w,a,search);assert(result.expanded<=RETURN_ROUTE_EXPANSIONS);}
const checkpoint=JSON.parse(JSON.stringify(search));
function route(s){let r;do{r=advanceReturnRoute(w,a,s);assert(r.expanded<=RETURN_ROUTE_EXPANSIONS);}while(!r.path&&!r.blocked);return r;}
const planned=route(search),restored=route(checkpoint);assert(planned.path);assert.deepEqual(restored.path,planned.path);
for(let i=1;i<planned.path.length;i++)assert(liveClear(w,planned.path[i-1],planned.path[i],a));
assert(search.expanded<=RETURN_ROUTE_LIMIT);
const trapped=fixture();
for(let i=0;i<12;i++){const angle=i*Math.PI/6;trapped.w.worldModel.objects.push({id:`ring-${i}`,position:{x:observed.x+Math.cos(angle)*4,y:observed.y+Math.sin(angle)*4},geometry:{radiusM:3},physical:{blocksMovement:true}});}
assert(liveWalkable(trapped.w,trapped.a.coordinates));
const confined=beginReturnRoute(trapped.a.coordinates,{x:64,y:34});let obstruction;
do{obstruction=advanceReturnRoute(trapped.w,trapped.a,confined);assert(obstruction.expanded<=RETURN_ROUTE_EXPANSIONS);}while(!obstruction.path&&!obstruction.blocked);
assert(obstruction.blocked);assert(!obstruction.path,'a closed obstruction never produces a shortcut');

// Unknown settlements cannot attract someone across the world. After a real
// encounter a nearer camp is usable, regardless of ancestry/provider identity.
const stranger=w.frontier.homes.find(h=>h.id==='flint-heights');
a.coordinates={x:stranger.x+20,y:stranger.y};updateThermalGoal(w,a);
assert.equal(returnCamp(w,a).id,'willow-basin');delete a.thermalGoal;
a.knownCamps=[stranger.id];updateThermalGoal(w,a);assert.equal(returnCamp(w,a).id,stranger.id);assert.equal(a.householdId,'willow-basin');

// Reproduce the reported journey. Arrival alone grants no warmth; the actual
// fire is required. The world and return intent survive a saved-state reload.
({w,a}=fixture());w.structures.fire=true;w.wood.legacyFireUntil=w.day*24+w.hour+6;
const view=()=>householdWorld(w,a);updateThermalGoal(w,a);
assert.equal(liveUrgency(view(),a),'warmth');
assert(!liveCandidates(view(),a,candidateActions(view(),a)).some(c=>c.id==='explore'));
let returned=false,warmed=false,journeyId=null,walked=0;
for(let i=0;i<700;i++){
 const before={...a.coordinates};await step(w,6);const moved=distance(before,a.coordinates);walked+=moved;
 assert(moved<5,'physical elapsed movement, never a teleport');assert(liveWalkable(w,a.coordinates));
 if(a.task?.actionId.startsWith('return_warmth:')){
  journeyId??=a.task.id;assert.equal(a.task.id,journeyId,'the journey persists instead of restarting');
 }
 if(i===15){const goal=structuredClone(a.thermalGoal);w=prepare(JSON.parse(JSON.stringify(w)));a=w.agents[0];assert.deepEqual(a.thermalGoal,goal);}
 if(distance(a.coordinates,{x:64,y:34})<=8)returned=true;
 if(a.needs.warmth>0){assert(a.thermalExposure.fireGain>0,'only nearby physical heat increases warmth');assert(returned);}
 if(a.needs.warmth>1){warmed=true;break;}
}
assert(returned&&warmed);assert(walked>distance(observed,{x:64,y:34}));
a.needs.warmth=21;updateThermalGoal(w,a);assert(!explorationMotivation(w,a).allowed,'a tiny recovery does not launch another expedition');
a.needs.warmth=45;updateThermalGoal(w,a);assert(!a.thermalGoal);assert(explorationMotivation(w,a).allowed);

// Urgent local food can pause a zero-warmth journey, then resume it without
// losing consumed food or sending the person back to the original position.
({w,a}=fixture());await step(w,6);const original=a.task.id;
for(let i=0;i<50;i++)await step(w,6);
const mealPosition={...a.coordinates},berries=a.inventory.berries;a.needs.hunger=11;
await step(w,6);assert.equal(a.task?.actionId,'eat_berries');assert(a.suspendedTasks.some(t=>t.id===original));
let resumed=false;
for(let i=0;i<100;i++){await step(w,6);if(a.task?.id===original){resumed=true;break;}}
assert(resumed);assert(a.needs.hunger>35);assert.equal(a.inventory.berries,berries-1);assert(distance(a.coordinates,mealPosition)<2);
assert.equal(a.thermalGoal.campId,'willow-basin');
for(const [need,id]of [['hydration','drink'],['energy','rest']]){
 const f=fixture();await step(f.w,6);f.a.needs[need]=11;await step(f.w,6);assert.equal(f.a.task?.actionId,id,`${need} may interrupt a cold journey`);
}

// No safe route means a recorded cooldown, never false arrival or heat.
({w,a}=fixture());w.worldModel.objects.push({id:'blocked-return-fixture',position:{...a.coordinates},geometry:{radiusM:200},physical:{blocksMovement:true}});
const from={...a.coordinates};await step(w,6);const candidate=returnCandidate(householdWorld(w,a),a);
assert.equal(candidate,null);assert(a.liveFailures['return_warmth:willow-basin']);assert.deepEqual(a.coordinates,from);assert.equal(a.needs.warmth,0);
const failedCount=w.history.filter(e=>e.type==='action-completed'&&e.actionId&&e.title.includes('Return to Willow Basin')).length;
for(let i=0;i<20;i++)await step(w,6);
assert.equal(w.history.filter(e=>e.type==='action-completed'&&e.actionId&&e.title.includes('Return to Willow Basin')).length,failedCount,'blocked routing is not retried every step');

// A cold, extinguished camp still offers a return for shelter/fuel; no remote
// fire status or success is invented by that candidate.
({w,a}=fixture());w.structures.fire=false;updateThermalGoal(w,a);assert(returnCandidate(w,a));
const screen={task:{phase:'planning',actionId:'return_warmth:willow-basin'}};assert.match(progressText(screen),/safe walking route/);
screen.task={phase:'travel',progress:{kind:'return_warmth',distance:20,targetDistance:100,camp:'Willow Basin'}};
assert.equal(progressRatio(screen),.2);assert.match(progressText(screen),/20 m walked toward Willow Basin/);
console.log(JSON.stringify({result:'PASS cold return from observed Mara position; bounded safe routing; checkpoint and task persistence; real fire warming; food/water/rest interruptions; known camps; cold hysteresis; blocked cooldown; honest journey progress',routeNodes:planned.path.length,expanded:search.expanded,walked}));
