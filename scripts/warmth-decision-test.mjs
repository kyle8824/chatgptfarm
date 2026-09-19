import assert from 'node:assert/strict';
import {createWorld} from '../engine/core.js';
import {candidateActions, retrieveDecisionContext, tick, tickWithMind} from '../engine/runtime.js';

function scenario() {
  const w = createWorld();
  w.structures.fire = true;
  for (const a of w.agents) {
    a.position = 'forest';
    a.needs = {warmth: 0, energy: 90, hunger: 90, hydration: 90};
  }
  return w;
}
const w = scenario();
assert.equal(candidateActions(w,w.agents[0])[0].id,'seek_warmth');
const decisions = tick(w);
assert(decisions.every(d=>d.action==='seek_warmth'));
assert(w.agents.every(a=>a.position==='camp' && a.needs.warmth>0));
assert(decisions.every(d=>d.observation.thermal.fireGain===0), 'Decision sees pre-travel exposure');
assert(w.agents.every(a=>a.thermalExposure.fireGain===10), 'Outcome sees local fire');

const absent = scenario(); absent.structures.fire = false;
assert(!candidateActions(absent,absent.agents[0]).some(c=>c.id==='seek_warmth'));
absent.structures.shelter = true; absent.temperature = 40; absent.weather = 'rain';
assert(candidateActions(absent,absent.agents[0]).some(c=>c.id==='seek_cover'));
assert.equal(retrieveDecisionContext(absent,absent.agents[0]).perception.thermal.rainLoss,3);
absent.agents[0].needs.warmth = 90;
assert(!candidateActions(absent,absent.agents[0]).some(c=>c.id==='seek_cover'));

// Deterministic AI adapter fixture tests the contract, not a live model's judgment.
const ai = scenario();
await tickWithMind(ai,{decide:async c=>{
  assert(c.candidates.some(x=>x.id==='seek_warmth'));
  assert.equal(c.perception.thermal.fireGain,0);
  return {actionId:'seek_warmth',brainMode:'ai',model:'test-fixture'};
}});
assert(ai.agents.every(a=>a.needs.warmth>0 && a.mind.brainMode==='ai'));

const build = scenario(); build.structures.fire = false;
for(const a of build.agents)a.inventory.dryWood=2;
await tickWithMind(build,{decide:async()=>({actionId:'make_fire'})});
assert(build.agents.every(a=>a.needs.warmth===a.thermalExposure.appliedDelta),
  'Creating fire must not award instantaneous warmth in addition to exposure');
const rest = scenario(); rest.structures.shelter = true;
for(const a of rest.agents)a.needs.energy=10;
await tickWithMind(rest,{decide:async()=>({actionId:'rest'})});
assert(rest.agents.every(a=>a.needs.warmth===a.thermalExposure.appliedDelta),
  'Rest must not award extra warmth outside exposure');
console.log('PASS warmth choice, local outcome, shelter option, AI contract, no action heat double count');

const survival = createWorld(), zero = {warmth:0,hunger:0,hydration:0};
for(let hour=0;hour<72;hour++) {
  tick(survival);
  for(const a of survival.agents)for(const key of Object.keys(zero)) {
    if(a.needs[key]===0)zero[key]++;
  }
}
assert.deepEqual(zero,{warmth:0,hunger:0,hydration:0},
  'Baseline 72-hour fallback scenario must not reach depleted survival meters');
console.log('PASS baseline 72-hour fallback survival (not proof of live AI or long-run balance)');
