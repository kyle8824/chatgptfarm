import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {RealtimeController} from './world.mjs';
import {liveClear,liveRoute} from './motion.mjs';
import {prepare} from './elapsed.mjs';

const seed=JSON.parse(await fs.readFile(new URL('../world/state.json',import.meta.url),'utf8'));
const map=new Map();let writes=0;
const storage={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>{writes++;map.set(k,structuredClone(v));},delete:async k=>map.delete(k),setAlarm:async n=>map.set('alarm',n),transaction:async fn=>fn(storage)};
let now=Date.UTC(2026,8,23),budget=0,yields=0;
const c=new RealtimeController(storage,{now:()=>now,budgetNow:()=>budget+=50,yieldToHost:async()=>{yields++;}});
await c.initialize(seed);const created=c.record.createdAt,initialCursor=c.record.lastWallTime,worldMinutes=w=>(w.day*24+w.hour)*60+w.minute,initialMinutes=worldMinutes(c.record.world);
now+=3600000;
let modelRequests=0;c.ai={run:async()=>{modelRequests++;throw Error('No inference during recovery');}};
await c.pulse();await c.requestDecisions();
assert(yields>0,'recovery yields to incoming events before continuing');
assert(c.record.lastWallTime-initialCursor<=10000,'one recovery burst cannot swallow an hour of work');
assert.equal(modelRequests,0,'old recovery state does not spend fresh model calls');
assert.equal(c.runtime().status,'catching-up');
const restarted=new RealtimeController(storage,{now:()=>now});await restarted.load();
assert.equal(restarted.record.createdAt,created);
assert.deepEqual(restarted.frame().agents,c.frame().agents,'partial recovery checkpoints retain exact tasks, supplies and positions');
let pulses=0,maxPulseMs=0;const began=performance.now();
while(c.record.lastWallTime<now&&pulses++<2000){const before=c.record.lastWallTime,start=performance.now();await c.pulse();maxPulseMs=Math.max(maxPulseMs,performance.now()-start);assert(c.record.lastWallTime>before&&c.record.lastWallTime<=now);}
assert.equal(c.record.lastWallTime,now,'bounded recovery eventually reaches the actual present');
assert(Math.abs(worldMinutes(c.record.world)-initialMinutes-360)<1e-6,'one elapsed hour advances exactly six simulated hours, without skipping time');
assert.equal(c.runtime().status,'running');assert.equal(c.record.createdAt,created);
await c.save();const saved=new RealtimeController(storage,{now:()=>now});await saved.load();assert.deepEqual(saved.frame().agents,c.frame().agents);
assert.equal(saved.runtime().computedThrough,now);assert.equal(saved.runtime().futureFrames,0);

// Analytic trunk checks must prevent crossing a narrow trunk between samples.
const w=prepare(seed);w.settlement.trees=[{id:'test-tree',position:{x:10.125,y:40},depleted:false}];
assert.equal(liveClear(w,{x:8,y:40.42},{x:12,y:40.42}),false);
w.settlement.trees[0].depleted=true;assert.equal(liveClear(w,{x:8,y:40.42},{x:12,y:40.42}),true);
w.settlement.trees[0].depleted=false;const route=liveRoute(w,{x:8,y:40},{x:12,y:40});assert(route?.length>2,'routing goes around the standing trunk');
for(let i=1;i<route.length;i++)assert(liveClear(w,route[i-1],route[i]),'every route edge respects current collisions');
console.log(JSON.stringify({result:'PASS bounded recovery, host yielding, elapsed-time conservation, no recovery AI calls, durable restart, trunk clearance',pulses,yields,writes,maxPulseMs:Math.round(maxPulseMs),recoveryMs:Math.round(performance.now()-began)}));
