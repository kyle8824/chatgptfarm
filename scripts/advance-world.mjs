import fs from 'node:fs';
import path from 'node:path';
import { tick } from '../engine.js';

const statePath = path.resolve('world/state.json');
const world = JSON.parse(fs.readFileSync(statePath, 'utf8'));

world.meta ||= { canonical: true, lastAdvancedAt: null, tickNumber: 0 };

const dna = tick(world);
world.meta.canonical = true;
world.meta.tickNumber = (world.meta.tickNumber || 0) + 1;
world.meta.lastAdvancedAt = new Date().toISOString();
world.meta.lastDecisionId = dna?.decision_id || null;

fs.writeFileSync(statePath, JSON.stringify(world, null, 2) + '\n');
console.log(`Advanced ChatGPTFarm to Day ${world.day}, ${String(world.hour).padStart(2,'0')}:00 via ${dna?.decision_id || 'no-decision'}`);
