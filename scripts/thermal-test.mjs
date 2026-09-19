import assert from 'node:assert/strict';
import {createWorld, finishHour, updateWeather, migrateWorld} from '../engine/core.js';
import {thermalExposure, applyThermalExposure} from '../engine/thermal.js';

const w = createWorld();
w.temperature = 40; w.weather = 'rain'; w.structures.fire = true;
const [near, far] = w.agents;
near.position = 'camp'; far.position = 'forest';
near.needs.warmth = far.needs.warmth = 20;
applyThermalExposure(w, near); applyThermalExposure(w, far);
assert(near.needs.warmth > 20, 'Nearby fire must permit recovery even in cold rain');
assert.equal(far.needs.warmth, 12, 'Remote fire cannot warm an exposed person');
w.structures.fire = false;
assert.equal(thermalExposure(w, near).fireGain, 0, 'Extinguished fire produces no heat');
w.structures.shelter = true;
assert.equal(thermalExposure(w, near).rainLoss, 0, 'Camp shelter blocks rain exposure');
assert.equal(thermalExposure(w, far).rainLoss, 3, 'Shelter does not protect remote people');
w.temperature = 65; w.weather = 'clear';
assert.equal(thermalExposure(w, near).net, 0, 'Shelter alone cannot generate heat');
w.structures.fire = true; near.needs.warmth = 99;
assert.equal(applyThermalExposure(w, near).appliedDelta, 1);
far.needs.warmth = 0; w.temperature = 40;
assert.equal(applyThermalExposure(w, far).after, 0);

// Weather observations must not apply bodily effects multiple times per tick.
w.hour = 6; w.weather = 'rain';
const before = w.agents.map(a => a.needs.warmth);
updateWeather(w); updateWeather(w);
assert.deepEqual(w.agents.map(a => a.needs.warmth), before);
near.needs.warmth = 20; w.temperature = 40; w.weather = 'rain';
finishHour(w);
assert.equal(near.needs.warmth, 27, 'Exactly one thermal update occurs per completed hour');
assert.equal(near.thermalExposure.appliedDelta, 7);
const restored = migrateWorld(JSON.parse(JSON.stringify(w)));
assert.deepEqual(restored.agents[0].thermalExposure, near.thermalExposure);
console.log('PASS local heat, cold/rain recovery, shelter, bounds, single hourly update, save migration');
