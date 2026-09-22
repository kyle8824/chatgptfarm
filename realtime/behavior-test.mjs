import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {prepare,step} from './elapsed.mjs';
import {BODY_DISTANCE,chooseDestination,liveRoute,liveWalkable,advanceLiveRoute,motionState} from './motion.mjs';
import {liveUrgency} from './behavior.mjs';
import {distance} from '../engine/navigation.js';
import {actionDestination} from '../engine/persistent-actions.js';
const seed=JSON.parse(await fs.readFile(new URL('../world/state.json',import.meta.url),'utf8'));
const w=prepare(seed);w.weather='clear';w.temperature=49;w.structures.shelter=true;w.structures.fire=false;
// Reproduce the reported condition: overlapping campers, no fuel, cold at zero,
// and all other needs deteriorating. This fixture is never deployed as state.
w.wood.batches=w.wood.batches.filter(b=>b.form!=='branch');w.wood.legacyFireUntil=null;w.resources.dryWood=w.resources.wetWood=0;
for(const [i,a]of w.agents.entries()){
 a.coordinates={x:64,y:34};a.position='camp';a.needs={warmth:0,hydration:9,hunger:7,energy:5};a.inventory.dryWood=a.inventory.wetWood=0;a.inventory.berries=i===0?2:0;
 a.resourceObservations={dryWood:{band:'depleted',day:w.day,hour:w.hour},wetWood:{band:'depleted',day:w.day,hour:w.hour}};
 a.task={id:`stuck-${i}`,decisionId:'old',actionId:'seek_cover',label:'Take cover in the camp shelter',targetPosition:'camp',destination:{x:64,y:34},origin:{x:64,y:34},path:[],pathIndex:1,phase:'work',workMinutes:5,requiredMinutes:30,selected:{id:'seek_cover',label:'Take cover in the camp shelter'},source:'fallback'};
 a.suspendedTasks=[];
 assert.equal(liveUrgency(w,a),'hydration');
}
const originalIds=w.agents.map(a=>a.id),maximum=w.agents.map(()=>({hydration:0,hunger:0,energy:0})),positions=new Set();let minimum=Infinity,invalid=0;
console.time('four simulated hours');
for(let i=0;i<24000;i++){
 await step(w,.6);if(i>20){minimum=Math.min(minimum,distance(w.agents[0].coordinates,w.agents[1].coordinates));invalid+=w.agents.filter(a=>!liveWalkable(w,a.coordinates)).length;}
 for(const [j,a]of w.agents.entries()){for(const k of ['hydration','hunger','energy'])maximum[j][k]=Math.max(maximum[j][k],a.needs[k]);positions.add(`${Math.round(a.coordinates.x)},${Math.round(a.coordinates.y)}`);}
}
console.timeEnd('four simulated hours');
assert.deepEqual(w.agents.map(a=>a.id),originalIds);assert(minimum>=BODY_DISTANCE-.025,`bodies stay separate: ${minimum}`);assert.equal(invalid,0,'no walking through water, fire or roof sides');
for(const m of maximum){assert(m.hydration>30,`water recovered: ${JSON.stringify(m)}`);assert(m.hunger>25,`food recovered: ${JSON.stringify(m)}`);assert(m.energy>20,`rest recovered: ${JSON.stringify(m)}`);}
assert(positions.size>30,'purposeful travel across multiple locations');assert(Object.keys(w.liveGround.cells).length>20,'actual traveled ground is recorded');
// Two people approaching head-on pass without collision or indefinite waiting.
const crossing=prepare(seed);crossing.structures.shelter=true;const [a,b]=crossing.agents;
for(const [person,x,to]of [[a,42,56],[b,56,42]]){person.coordinates={x,y:40};person.position='travel';person.locomotion=null;person.task={actionId:'drink',targetPosition:'creek',destination:{x:to,y:40},path:[{x,y:40},{x:to,y:40}],pathIndex:1,phase:'travel',liveSpaceVersion:1};}
let closest=Infinity;for(let i=0;i<1600;i++){for(const p of crossing.agents){if(p.task.phase==='travel'){const r=advanceLiveRoute(crossing,p,p.task,.1);if(r.arrived)p.task.phase='work';}}closest=Math.min(closest,distance(a.coordinates,b.coordinates));}
assert(closest>=BODY_DISTANCE-1e-6,`head-on clearance ${closest}`);assert.equal(a.task.phase,'work');assert.equal(b.task.phase,'work');
assert(distance(a.coordinates,{x:56,y:40})<.2,'first walker reaches the intended destination');assert(distance(b.coordinates,{x:42,y:40})<.2,'second walker reaches the intended destination');
// Returning to a resource selects usable space instead of a single shared dot.
const destinations=[];for(let i=0;i<8;i++){const p=chooseDestination(w,w.agents[0],'creek',{id:'drink'});assert(liveWalkable(w,p));assert(liveRoute(w,w.agents[0].coordinates,p));destinations.push(p);motionState(w.agents[0]).arrivals.push(p);}
assert(new Set(destinations.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`)).size>4);
const foodBefore=w.agents.map(a=>a.inventory.berries);actionDestination(w,w.agents[0],{id:'share_food'});assert.deepEqual(w.agents.map(a=>a.inventory.berries),foodBefore,'choosing a destination never transfers food');
console.log(JSON.stringify({result:'PASS starving cold campers recover water, food and rest; body/structure separation; head-on passing; varied interaction points; real ground wear; pure destination selection',minimumSeparation:minimum,headOnSeparation:closest,maximumNeeds:maximum,visitedCells:positions.size,groundCells:Object.keys(w.liveGround.cells).length}));
