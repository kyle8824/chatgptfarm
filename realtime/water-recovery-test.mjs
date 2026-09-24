import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {prepare,step} from './elapsed.mjs';
import {expandFrontier} from './frontier.mjs';
import {reorganizeLandscape} from './landscape-migration.mjs';
import {householdWorld} from '../shared/frontier.js';
import {chooseDestination,liveClear,liveRoute} from './motion.mjs';
import {withinWaterReach} from './water.mjs';
import {liveCandidates} from './behavior.mjs';
import {RealtimeController} from './world.mjs';

// Observed production position/task on September 24. Public state omits private
// memory/checkpoint fields: this is a regression fixture, not a world restore.
const w=prepare(createWorld());expandFrontier(w);reorganizeLandscape(w);
const a=w.agents.find(a=>a.name==='Ronan');
a.coordinates={x:-262.1740438698554,y:-221.0621746310501};a.position='creek';
a.needs={hunger:80,hydration:46,energy:45,warmth:60};a.suspendedTasks=[];
a.task={id:'observed-blocked-water',actionId:'drink',label:'Drink from the creek',selected:{id:'drink'},source:'fallback',targetPosition:'creek',destination:{...a.coordinates},origin:{...a.coordinates},path:[{...a.coordinates}],pathIndex:1,phase:'work',workMinutes:0,requiredMinutes:.75,liveSpaceVersion:1,liveWaterVersion:1};
const view=()=>householdWorld(w,a),original={...a.coordinates},task=a.task;
const start=performance.now();
const destination=chooseDestination(view(),a,'creek',{id:'drink'});
const searchMs=performance.now()-start;
assert(!withinWaterReach(view(),destination),'observed candidate bank routes are obstructed');
await step(w,6);
assert.notEqual(a.task,task,'unreachable water must end the failed task, not retry every physics step');
assert.equal(task.workMinutes,0,'no drinking credit at unreachable water');
assert(a.needs.hydration<46,'no invented hydration');
assert.deepEqual(a.coordinates,original,'failure does not teleport a villager');
assert(a.liveFailures.drink,'the failed attempt has a persisted retry cooldown');
assert(!liveCandidates(view(),a,[{id:'drink',label:'Drink',score:1000,reasons:[]}]).some(c=>c.id==='drink'),'cooldown suppresses another expensive attempt');
const restored=prepare(JSON.parse(JSON.stringify(w))),saved=restored.agents.find(x=>x.id===a.id);
assert.deepEqual(saved.liveFailures.drink,a.liveFailures.drink,'restart preserves failed-route memory');

// The entire destination selection has a CPU bound, not 80 separate full
// searches. The large threshold tolerates slow CI; the operation cap below is
// deterministic even on hosts whose clock does not advance during CPU work.
assert(searchMs<500,`one water destination search took ${searchMs.toFixed(0)}ms`);
const budget={remaining:0};
assert.equal(liveRoute(view(),a.coordinates,{x:a.coordinates.x+1,y:a.coordinates.y},a,budget),null,'exhausted shared budget never accepts unchecked edges');

// A normal reachable bank still gets a checked path. No terrain rule is relaxed.
a.coordinates={x:64,y:34};a.campId='willow-basin';a.task=null;
const reachable=chooseDestination(view(),a,'creek',{id:'drink'});
assert(withinWaterReach(view(),reachable),'nearby accessible drinking remains available');
const route=liveRoute(view(),a.coordinates,reachable,a);assert(route);
for(let i=1;i<route.length;i++)assert(liveClear(view(),route[i-1],route[i],a));

// A saved eight-person world containing this stuck task can recover elapsed
// time and retain its identity, people and material accounts through restart.
const map=new Map(),storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k),setAlarm:async n=>map.set('alarm',n),transaction:async f=>f(storage)};
let now=Date.UTC(2026,8,24);const c=new RealtimeController(storage,{now:()=>now,budgetNow:()=>0,yieldToHost:async()=>{}});
await c.initialize(restored);const id=c.record.createdAt,people=c.record.world.agents.map(a=>a.id);
now+=120000;const began=performance.now();let pulses=0;
while(c.record.lastWallTime<now&&pulses++<300)await c.pulse();
assert.equal(c.record.lastWallTime,now);assert.equal(c.runtime().status,'running');
await c.save();const reload=new RealtimeController(storage,{now:()=>now});await reload.load();
assert.equal(reload.record.createdAt,id);assert.deepEqual(reload.record.world.agents.map(a=>a.id),people);
assert.deepEqual(reload.record.world.wood,c.record.world.wood);
console.log(JSON.stringify({result:'PASS bounded unreachable water, persisted cooldown, no false drinking/teleport, reachable bank, eight-person elapsed recovery and restart',searchMs:Math.round(searchMs),recoveryMs:Math.round(performance.now()-began),pulses}));
