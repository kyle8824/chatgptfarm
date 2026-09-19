import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,migrateWorld} from '../engine/core.js';
import {tickWithMind} from '../engine/runtime.js';
import {totals} from '../engine/wood-materials.js';
import {ensureWood,gatherWood,storeWood,storedFuel,collectStoredFuel,advanceWood,fuelFire,transformWood,claimBranch,placeBranch,dryWoodByFire,takeBranch} from '../engine/wood-runtime.js';
import {instantiateObjectComponents,findWorldObject} from '../engine/world-model.js';

function conservation(w){
  const t=totals(w.wood),s=w.wood.sinks.reduce((n,b)=>({dryKg:n.dryKg+b.dryKg,waterKg:n.waterKg+b.waterKg}),{dryKg:0,waterKg:0});
  assert(Math.abs(t.dryKg+s.dryKg-w.wood.initialDryKg)<1e-8,'Wood dry mass is conserved');
  assert(Math.abs(t.waterKg+s.waterKg-w.wood.initialWaterKg-w.wood.environmentWaterExchangeKg)<1e-8,'Water has an explicit environmental account');
}
const raw=createWorld();raw.resources.dryWood=0;raw.resources.wetWood=0;raw.structures.shelter=true;
raw.agents[0].inventory.dryWood=1;raw.agents[0].inventory.wetWood=58;
raw.agents[1].inventory.dryWood=1;raw.agents[1].inventory.wetWood=65;
const w=migrateWorld(raw),before=JSON.stringify(w);
ensureWood(w);assert.equal(JSON.stringify(w),before,'Migration repeats without changing material');
assert.equal(totals(w.wood).units,125);
for(const a of w.agents)assert(storeWood(w,a));
assert.equal(w.agents[0].inventory.wetWood,0);
assert.equal(w.resources.wetWood,0,'Storage does not refill ground');
w.weather='clear';w.temperature=65;
const start=w.wood.lastHour;advanceWood(w,start+48);
assert.equal(storedFuel(w),125,'Stored material becomes real usable fuel');
const once=JSON.stringify(w.wood);advanceWood(w,start+48);assert.equal(JSON.stringify(w.wood),once);
const restored=JSON.parse(JSON.stringify(w));advanceWood(restored,start+48);assert.deepEqual(restored.wood,w.wood);
const a=w.agents[0];assert(collectStoredFuel(w,a));assert.equal(a.inventory.dryWood,2);
fuelFire(w,a);assert.equal(a.inventory.dryWood,0);assert(w.structures.fire);
advanceWood(w,start+52);assert(w.structures.fire,'2 kg fuel supports eight hours at modeled rate');
advanceWood(w,start+56);assert.equal(w.structures.fire,false,'Finite fuel expires deterministically');
conservation(w);

const wet=migrateWorld(createWorld()),person=wet.agents[0];gatherWood(wet,person,'wetWood',1);
const mass=totals(wet.wood).dryKg;transformWood(wet,person,'wetWood','pole');transformWood(wet,person,'woodPole','pointedPole');transformWood(wet,person,'pointedPole','boundSharpTool');
assert.equal(person.inventory.boundSharpTool,1);assert.equal(totals(wet.wood).dryKg,mass);
assert(wet.wood.batches.find(b=>b.form==='boundSharpTool').waterKg>.5,'Crafting does not dry wet wood');conservation(wet);

const heated=migrateWorld(createWorld()),[first,second]=heated.agents;
gatherWood(heated,first,'dryWood',1);gatherWood(heated,first,'wetWood',1);gatherWood(heated,second,'wetWood',1);
assert.equal(dryWoodByFire(heated,first),false,'No drying heat without a fire');fuelFire(heated,first);
const water=totals(heated.wood).waterKg;
assert(dryWoodByFire(heated,first));assert.equal(dryWoodByFire(heated,second),false,'Actors share finite drying heat');
assert(Math.abs(water-totals(heated.wood).waterKg-.30)<1e-8);
assert.equal(first.inventory.dryWood,0,'Very damp branch needs more than one exposure');
heated.hour++;advanceWood(heated,heated.day*24+heated.hour);
assert(dryWoodByFire(heated,first).dry);conservation(heated);

const tree=migrateWorld(createWorld()),p=tree.agents[0];instantiateObjectComponents(tree,'OBJ-TREE-001');
const branch=findWorldObject(tree,'OBJ-TREE-001-BRANCH-1');const supply=tree.resources.dryWood+tree.resources.wetWood;
assert(claimBranch(tree,p,branch));assert.equal(tree.resources.dryWood+tree.resources.wetWood,supply-1);
assert(placeBranch(tree,p,branch,'camp'));assert.equal(p.inventory.dryWood+p.inventory.wetWood,0);assert.equal(takeBranch(tree,p,branch),false);p.position='camp';assert(takeBranch(tree,p,branch));assert.equal(takeBranch(tree,p,branch),false);conservation(tree);

// Exercise real action execution, including two actors claiming shared supplies.
const live=createWorld();live.resources.dryWood=2;live.resources.wetWood=0;
for(const actor of live.agents)actor.position='log';
const ds=await tickWithMind(live,{decide:async()=>({actionId:'gather_dry_wood'})});
assert.equal(live.resources.dryWood,0);assert.equal(live.agents.reduce((n,a)=>n+a.inventory.dryWood,0),2);
assert.equal(ds.filter(d=>d.physics.outcome.success).length,1);conservation(live);

const source=fs.readFileSync('world/state.json','utf8'),saved=JSON.parse(source);
const owners=saved.agents.map(a=>({id:a.id,dryWood:a.inventory.dryWood,wetWood:a.inventory.wetWood}));
migrateWorld(saved);assert.deepEqual(saved.agents.map(a=>({id:a.id,dryWood:a.inventory.dryWood,wetWood:a.inventory.wetWood})),owners);
assert.equal(fs.readFileSync('world/state.json','utf8'),source);conservation(saved);
console.log('PASS runtime migration, covered drying, reload, finite fire, crafting conservation, component supply, action contention and saved owners');
