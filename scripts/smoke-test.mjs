import { createWorld, tick, migrateWorld } from '../engine.js';

const world = migrateWorld(createWorld());
const fail = message => { throw new Error(message); };

for (let i = 0; i < 96; i++) {
  const dnas = tick(world);
  if (!Array.isArray(dnas) || dnas.length !== 2) fail(`tick ${i}: expected two Decision DNA records`);
  if (world.agents.length !== 2) fail(`tick ${i}: agent count changed`);
  for (const agent of world.agents) {
    for (const [name, value] of Object.entries(agent.needs)) {
      if (!Number.isFinite(value) || value < 0 || value > 100) fail(`tick ${i}: invalid ${agent.name}.${name}=${value}`);
    }
  }
  if (!Number.isFinite(world.day) || !Number.isFinite(world.hour)) fail(`tick ${i}: invalid world clock`);
}

if (world.dna.length < 2) fail('Decision DNA history was not produced');
if (world.history.length < 1) fail('World history was not produced');
if (!world.relationships['agent-ivo|agent-mara']) fail('Relationship state missing');
if (world.day < 4) fail('Simulation did not advance across multiple days');

console.log(`Smoke test passed: Day ${world.day} ${String(world.hour).padStart(2,'0')}:00 · ${world.history.length} history events · ${world.dna.length} DNA records`);
