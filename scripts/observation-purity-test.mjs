import assert from 'node:assert/strict';
import {createWorld,migrateWorld,sampleWeather,updateWeather,finishHour} from '../engine/core.js';
import {retrieveDecisionContext} from '../engine/decision.js';
import {buildAffordanceView} from '../engine/affordances.js';
import {ensureWorldModel,sampleEnvironmentalFields,updateEnvironmentalModel,advanceObjectEnvironment} from '../engine/world-model.js';
import {visibleWildlifeForAgent,visibleWildlifeTracesForAgent,visibleWildlifeSignsForAgent,wildlifeAIEnabled} from '../engine/ecology.js';

function fixture(weather='clear'){
  const w=createWorld();w.structures.shelter=true;w.weather=weather;
  migrateWorld(w);
  w.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct=50;
  return w;
}
function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
for(const weather of ['clear','cloudy','rain']){
  const w=fixture(weather),before=JSON.stringify(w);
  for(let i=0;i<5;i++)for(const a of w.agents){
    retrieveDecisionContext(w,a);buildAffordanceView(w,a);
    visibleWildlifeForAgent(w,a);visibleWildlifeTracesForAgent(w,a);visibleWildlifeSignsForAgent(w,a);wildlifeAIEnabled(w);
  }
  assert.equal(JSON.stringify(w),before,'All observation paths preserve the entire world');
  const frozen=freeze(structuredClone(w));
  sampleWeather(frozen);sampleEnvironmentalFields(frozen);
  for(const a of frozen.agents)retrieveDecisionContext(frozen,a);
  migrateWorld(w);const migrated=JSON.stringify(w);
  for(let i=0;i<3;i++)migrateWorld(w);
  assert.equal(JSON.stringify(w),migrated,'Repeated current migration has no physical evolution');
  const moisture=w.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct;
  for(let i=0;i<3;i++){ensureWorldModel(w);updateEnvironmentalModel(w);}
  assert.equal(w.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct,moisture);
}
const rain=fixture('rain'),counts=structuredClone(rain.resources);
updateWeather(rain);updateWeather(rain);
assert.deepEqual(rain.resources,counts,'Sampling rain cannot create wood');
const w=fixture(),stamp=w.day*24+w.hour,shelter=()=>w.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001');
advanceObjectEnvironment(w,stamp+1);assert.equal(shelter().material.moisturePct,48.2);
advanceObjectEnvironment(w,stamp+1);assert.equal(shelter().material.moisturePct,48.2,'Duplicate interval must not dry twice');
const restored=migrateWorld(JSON.parse(JSON.stringify(w)));
advanceObjectEnvironment(restored,stamp+1);
assert.equal(restored.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct,48.2);
assert.throws(()=>advanceObjectEnvironment(w,stamp),/backwards/);
const one=fixture(),parts=fixture();advanceObjectEnvironment(one,stamp+2);
advanceObjectEnvironment(parts,stamp+1);advanceObjectEnvironment(parts,stamp+2);
assert.equal(one.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct,parts.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct);
const actual=fixture();finishHour(actual);
assert.equal(actual.worldModel.objects.find(o=>o.id==='OBJ-SHELTER-001').material.moisturePct,48.2,'Completed hour integrates once');
console.log('PASS frozen observations, repeated migration, no rain-created wood, explicit time, retry/reload, interval partition');
