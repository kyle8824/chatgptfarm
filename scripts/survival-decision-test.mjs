import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {candidateActions,tick,tickWithMind} from '../engine/runtime.js';

function hungry() {
  const w=createWorld();
  for(const a of w.agents){
    a.position='forest';
    a.needs={hunger:0,hydration:90,warmth:90,energy:90};
    a.memories=Array.from({length:120},(_,i)=>({id:`test-${i}`,text:'Water is useful',tags:['water'],importance:10,confidence:1}));
    a.mind.recentActions=Array(6).fill('gather_berries');
  }
  return w;
}
const w=hungry();
assert.equal(candidateActions(w,w.agents[0])[0].id,'gather_berries',
  'Food acquisition beats redundant drinking even with many water memories');
const start=w.resources.berries;
const gather=tick(w);
assert(gather.every(d=>d.action==='gather_berries'));
assert.equal(w.resources.berries,start-4);
assert(w.agents.every(a=>a.inventory.berries===2 && a.needs.hunger===0),
  'Gathering creates food inventory, not free satiety');
const eat=tick(w);
assert(eat.every(d=>d.action==='eat_berries'));
assert(w.agents.every(a=>a.inventory.berries===1 && a.needs.hunger>0));

const depleted=hungry();depleted.resources.berries=0;
for(const a of depleted.agents){a.position='berries';a.resourceObservations={berries:{band:'depleted',day:depleted.day,hour:depleted.hour}};}
assert(!candidateActions(depleted,depleted.agents[0]).some(c=>c.id==='gather_berries'));
tick(depleted);
assert(depleted.agents.every(a=>a.inventory.berries===0 && a.needs.hunger===0),
  'Decision improvements must not manufacture food when supply is exhausted');

const critical=hungry();
critical.agents[0].inventory.berries=2;
critical.agents[0].mind.recentActions=Array(6).fill('eat_berries');
assert.equal(candidateActions(critical,critical.agents[0])[0].id,'eat_berries');

const cold=hungry();cold.structures.fire=false;
for(const a of cold.agents){a.needs.hunger=70;a.needs.warmth=5;a.mind.recentActions=Array(6).fill('gather_dry_wood');}
assert.equal(candidateActions(cold,cold.agents[0])[0].id,'gather_dry_wood',
  'Urgent fuel acquisition must outrank topping up food when no fire is available');

const ai=hungry();
await tickWithMind(ai,{decide:async c=>({actionId:c.candidates[0].id,model:'contract-fixture'})});
assert(ai.agents.every(a=>a.inventory.berries===2));
await tickWithMind(ai,{decide:async c=>({actionId:c.candidates[0].id,model:'contract-fixture'})});
assert(ai.agents.every(a=>a.needs.hunger>0));
console.log('PASS urgent food acquisition, bounded memories, repeat survival, finite supplies, AI adapter');
