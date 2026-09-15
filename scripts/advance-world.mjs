import fs from 'node:fs';
import path from 'node:path';
import { tick, migrateWorld } from '../engine.js';

const statePath = path.resolve('world/state.json');
const world = migrateWorld(JSON.parse(fs.readFileSync(statePath, 'utf8')));

// Early history should accumulate quickly enough to be watchable.
// As the world becomes richer, slow it down so each day carries more weight.
const hoursPerHeartbeat = world.day <= 3 ? 3 : world.day <= 10 ? 2 : 1;
const dnas = [];
for (let i = 0; i < hoursPerHeartbeat; i++) {
  dnas.push(...tick(world));
}

world.meta.canonical = true;
world.meta.tickNumber = (world.meta.tickNumber || 0) + 1;
world.meta.lastAdvancedAt = new Date().toISOString();
world.meta.lastDecisionIds = dnas.map(d => d.decision_id);
world.meta.heartbeatMinutes = 5;
world.meta.worldHoursPerHeartbeat = hoursPerHeartbeat;
world.meta.pacing = world.day <= 3 ? 'accelerated origin' : world.day <= 10 ? 'young world' : 'mature world';

fs.writeFileSync(statePath, JSON.stringify(world, null, 2) + '\n');
console.log(`Advanced ChatGPTFarm ${hoursPerHeartbeat} world hour(s) to Day ${world.day}, ${String(world.hour).padStart(2,'0')}:00 · ${world.agents.map(a=>a.name+': '+a.currentAction).join(' · ')}`);
