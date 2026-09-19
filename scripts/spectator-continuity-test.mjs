import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {tick,tickWithMind} from '../engine/runtime.js';
import {beginTransition,snapshotTransition} from '../runtime/timeline.mjs';
const seed=createWorld();
delete seed.regions;
seed.worldModel.objects=seed.worldModel.objects.filter(o=>!o.id.startsWith('willow-basin:'));
for(const a of seed.agents){a.needs={hunger:0,hydration:90,warmth:90,energy:90};a.mind.currentGoal='Talk instead of seeking food';}
const original=structuredClone(seed);
const transition=await beginTransition(seed,1000);
assert.deepEqual(seed,original,'Preparing a transition must not mutate the saved input');
const view=snapshotTransition(transition,1000);
assert.equal(Object.keys(view.regions.sites).length,3);
for(const id of Object.keys(view.regions.sites))assert(view.worldModel.objects.some(o=>o.id===id),'Habitat is visible before its first action');
assert.deepEqual(view.agents.map(a=>a.needs),original.agents.map(a=>a.needs),'Do not expose future nourishment');
for(const a of view.agents){assert.equal(a.mind.currentGoal,a.activeAction.label);assert.equal(a.currentAction,a.activeAction.label);}
for(const advance of [tick,tickWithMind]){
 const w=structuredClone(seed);await advance(w);
 for(const a of w.agents){assert.equal(a.mind.currentGoal,a.currentAction);assert(/berries|plants/i.test(a.currentAction),'Critical hunger with safe alternatives must prioritize food');}
}
console.log('PASS habitat before travel, private outcomes, input purity, truthful fallback goals, urgent food');
