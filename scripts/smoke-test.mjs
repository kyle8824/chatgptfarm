import { createWorld, tick, tickWithMind, migrateWorld, retrieveDecisionContext } from '../engine.js';

const fail = message => { throw new Error(message); };
const assertWorld = (world, label) => {
  if (world.agents.length !== 2) fail(`${label}: agent count changed`);
  for (const agent of world.agents) {
    for (const [name, value] of Object.entries(agent.needs)) {
      if (!Number.isFinite(value) || value < 0 || value > 100) fail(`${label}: invalid ${agent.name}.${name}=${value}`);
    }
    if (!agent.mind || !Array.isArray(agent.mind.recentActions)) fail(`${label}: mind state missing for ${agent.name}`);
  }
  if (!Number.isFinite(world.day) || !Number.isFinite(world.hour)) fail(`${label}: invalid world clock`);
};

const fallbackWorld = migrateWorld(createWorld());
for (let i = 0; i < 96; i++) {
  const dnas = tick(fallbackWorld);
  if (!Array.isArray(dnas) || dnas.length !== 2) fail(`fallback tick ${i}: expected two Decision DNA records`);
  assertWorld(fallbackWorld, `fallback tick ${i}`);
}
if (fallbackWorld.dna.length < 2) fail('Fallback Decision DNA history was not produced');
if (fallbackWorld.history.length < 1) fail('Fallback world history was not produced');
if (!fallbackWorld.relationships['agent-ivo|agent-mara']) fail('Relationship state missing');
if (fallbackWorld.day < 4) fail('Fallback simulation did not advance across multiple days');

const aiWorld = migrateWorld(createWorld());
const fakeMind = {
  async decide(context) {
    const novel = context.candidates.find(c => ['explore','gather_stones','experiment_stones','talk','seek_other'].includes(c.id));
    const chosen = novel || context.candidates[0];
    return {
      actionId: chosen.id,
      goal: 'Learn something that changes future choices',
      intent: chosen.label,
      decisionSummary: 'Synthetic test mind selected a physically valid affordance.',
      confidence: 0.81,
      referencedMemoryIds: context.memories.slice(0, 1).map(m => m.id),
      brainMode: 'ai',
      model: 'smoke-test-mind'
    };
  },
  async replay(context) { return { actionId: context.candidates[0].id }; }
};

for (let i = 0; i < 8; i++) {
  const dnas = await tickWithMind(aiWorld, fakeMind, { enableCounterfactualReplay: true });
  if (!Array.isArray(dnas) || dnas.length !== 2) fail(`AI tick ${i}: expected two DNA records`);
  if (!dnas.every(d => d.mind?.brain_mode === 'ai')) fail(`AI tick ${i}: DNA did not record AI brain mode`);
  assertWorld(aiWorld, `AI tick ${i}`);
}
if (aiWorld.meta.aiDecisions < 16) fail('AI decision counter did not advance');
if (!aiWorld.agents.every(a => a.mind.model === 'smoke-test-mind')) fail('AI mind state was not persisted');
if (!retrieveDecisionContext(aiWorld, aiWorld.agents[0]).candidates.length) fail('Decision context has no valid actions');

console.log(`Smoke test passed · fallback Day ${fallbackWorld.day} ${String(fallbackWorld.hour).padStart(2,'0')}:00 · AI ${aiWorld.meta.aiDecisions} decisions · ${fallbackWorld.history.length} history events · ${fallbackWorld.dna.length} DNA records`);
