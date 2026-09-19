import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,migrateWorld} from '../engine.js';
import {advanceActionHour} from '../engine/persistent-actions.js';
import {beginActionTransition,snapshotActionTransition} from '../runtime/action-timeline.mjs';
import {findRoute,distance} from '../engine/navigation.js';
import {totals} from '../engine/wood-materials.js';
const force=id=>({decide:async c=>({choiceType:'known_action',actionId:id,goal:id,intent:id,decisionSummary:'Fixture choice',brainMode:'ai',model:'test-only',confidence:.8,referencedMemoryIds:[]})});
function isolated(){const w=createWorld();w.agents=w.agents.slice(0,1);const a=w.agents[0];Object.assign(a.needs,{hunger:65,hydration:65,energy:70,warmth:65});return w;}
let w=isolated(),a=w.agents[0];a.position='forest';a.coordinates={x:14,y:38};
let t=await beginActionTransition(w,0,150000,force('drink'));
let initial=snapshotActionTransition(t,0),travelling=snapshotActionTransition(t,10000),arrived=snapshotActionTransition(t,12500),drinking=snapshotActionTransition(t,25000);
assert.equal(initial.agents[0].task.phase,'travel');
assert.equal(travelling.agents[0].needs.hydration,65,'No water benefit during travel');
assert(arrived.agents[0].needs.hydration<65,'Travel costs water');
assert(drinking.agents[0].needs.hydration>arrived.agents[0].needs.hydration,'Drinking increases hydration after arrival');
assert(drinking.agents[0].needs.hydration<95,'Drinking is incremental');
w=isolated();a=w.agents[0];a.inventory.berries=1;a.needs.hunger=30;
t=await beginActionTransition(w,0,150000,force('eat_berries'));
const meal0=snapshotActionTransition(t,0).agents[0],meal5=snapshotActionTransition(t,12500).agents[0],meal10=snapshotActionTransition(t,25000).agents[0];
assert.equal(meal0.inventory.berries,1);assert.equal(meal5.inventory.berries,0);assert(meal5.needs.hunger>30&&meal5.needs.hunger<58);assert(meal10.needs.hunger>meal5.needs.hunger);
assert.deepEqual(snapshotActionTransition(structuredClone(t),20000),snapshotActionTransition(t,20000),'Restart shows exact partial meal');
w=isolated();a=w.agents[0];a.position='camp';a.coordinates={x:64,y:34};w.structures.fire=true;w.structures.shelter=true;a.needs.warmth=30;
t=await beginActionTransition(w,0,150000,force('seek_warmth'));
assert(snapshotActionTransition(t,12500).agents[0].needs.warmth>30);
assert(snapshotActionTransition(t,25000).agents[0].needs.warmth>snapshotActionTransition(t,12500).agents[0].needs.warmth);
// Long work persists and urgently yields without completing the construction.
w=isolated();a=w.agents[0];a.position='camp';a.coordinates={x:64,y:34};a.inventory.dryWood=4;a.needs.hydration=23;migrateWorld(w);
t=await beginActionTransition(w,0,150000,force('build_shelter'));
assert.equal(t.after.structures.shelter,false);assert(t.after.history.some(e=>e.type==='action-interrupted'));
assert(t.after.agents[0].suspendedTasks?.length||t.after.history.some(e=>e.type==='action-resumed'));
const ids=t.after.history.filter(e=>e.type==='action-interrupted').map(e=>e.actionId);assert(ids.every(Boolean));
// Resuming an AI task restores that task's source after a fallback interruption.
const retained=snapshotActionTransition(t,0).agents[0].task;
w=isolated();a=w.agents[0];a.position='camp';a.coordinates={x:64,y:34};a.suspendedTasks=[retained];a.mind.brainMode='fallback';a.mind.model=null;a.mind.fallbackReason='urgent_need';
const resumed=snapshotActionTransition(await beginActionTransition(w,0),0).agents[0];
assert.equal(resumed.task.id,retained.id);assert.equal(resumed.mind.brainMode,'ai');assert.equal(resumed.mind.model,'test-only');assert.equal(resumed.mind.fallbackReason,null);
// Array order never determines contention for the final portion.
w=createWorld();for(const a of w.agents){a.position='berries';a.coordinates={x:29,y:31};a.needs.hunger=25;}w.resources.berries=1;
const reversed=structuredClone(w);reversed.agents.reverse();
const x=await beginActionTransition(w,0,150000,force('eat_berries')),y=await beginActionTransition(reversed,0,150000,force('eat_berries'));
assert.deepEqual(x.after.agents.map(a=>[a.id,a.needs.hunger]).sort(),y.after.agents.map(a=>[a.id,a.needs.hunger]).sort());
assert(x.after.resources.berries>=0);
// A solid obstacle adds a real detour; the creek has no invented crossing.
w=isolated();const from={x:35,y:40},to={x:45,y:40};w.worldModel.objects.push({id:'test-obstacle',position:{x:40,y:40},physical:{blocksMovement:true},geometry:{radiusM:4}});
const path=findRoute(w,from,to);assert(path&&path.reduce((s,p,i)=>s+(i?distance(path[i-1],p):0),0)>distance(from,to));assert.equal(findRoute(w,{x:48,y:30},{x:48,y:10}),null);
// Existing saved world, conservation, real persistent execution for 72h.
const file=process.argv[2]||'world/state.json',raw=fs.readFileSync(file,'utf8');w=migrateWorld(JSON.parse(raw));const accounted=ledger=>totals(ledger).dryKg+ledger.sinks.reduce((n,s)=>n+s.dryKg,0);const initialMass=accounted(w.wood);const zero={hunger:0,hydration:0,warmth:0};
for(let hour=0;hour<72;hour++){await advanceActionHour(w);if(hour>=12)for(const a of w.agents)for(const k of Object.keys(zero))if(a.needs[k]===0)zero[k]++;}
assert(Object.values(zero).every(n=>n===0),JSON.stringify(zero));assert(Math.abs(accounted(w.wood)-initialMass)<1e-7);assert.equal(fs.readFileSync(file,'utf8'),raw);
console.log('PASS arrival before benefits, incremental meal/drink/warmth, restart, urgent interruption, contention, detours, current-copy survival and conserved wood');
