import fs from 'node:fs';
import path from 'node:path';
import { tick, migrateWorld } from '../engine.js';

const statePath = path.resolve('world/state.json');
const world = migrateWorld(JSON.parse(fs.readFileSync(statePath, 'utf8')));
const dnas = tick(world);
world.meta.canonical = true;
world.meta.tickNumber = (world.meta.tickNumber || 0) + 1;
world.meta.lastAdvancedAt = new Date().toISOString();
world.meta.lastDecisionIds = dnas.map(d => d.decision_id);
world.meta.heartbeatMinutes = 5;
world.meta.worldHoursPerHeartbeat = 1;
fs.writeFileSync(statePath, JSON.stringify(world, null, 2) + '\n');
console.log(`Advanced ChatGPTFarm to Day ${world.day}, ${String(world.hour).padStart(2,'0')}:00 · ${world.agents.map(a=>a.name+': '+a.currentAction).join(' · ')}`);
