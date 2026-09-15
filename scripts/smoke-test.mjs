import { createWorld, tick, tickWithMind, migrateWorld, retrieveDecisionContext, buildAffordanceView } from '../engine.js';

const fail = message => { throw new Error(message); };
const assertWorld = (world, label) => {
  if (world.agents.length !== 2) fail(`${label}: agent count changed`);
  for (const agent of world.agents) {
    for (const [name, value] of Object.entries(agent.needs)) if (!Number.isFinite(value) || value < 0 || value > 100) fail(`${label}: invalid ${agent.name}.${name}=${value}`);
    if (!agent.mind || !Array.isArray(agent.mind.recentActions)) fail(`${label}: mind state missing for ${agent.name}`);
  }
  if (!Number.isFinite(world.day) || !Number.isFinite(world.hour)) fail(`${label}: invalid world clock`);
  if (world.meta.physicsVersion !== 'affordance-0.5') fail(`${label}: physics version missing`);
};

const fallbackWorld = migrateWorld(createWorld());
for (let i = 0; i < 96; i++) {
  const dnas = tick(fallbackWorld);
  if (!Array.isArray(dnas) || dnas.length !== 2) fail(`fallback tick ${i}: expected two Decision DNA records`);
  assertWorld(fallbackWorld, `fallback tick ${i}`);
}
if (fallbackWorld.day < 4) fail('Fallback simulation did not advance across multiple days');
if (!fallbackWorld.history.length || !fallbackWorld.dna.length) fail('Fallback history/DNA missing');

const aiWorld = migrateWorld(createWorld());
const fakeMind = {
  async decide(context) {
    const creek = context.affordances.objects.find(o => o.id === 'place:creek');
    if (creek) return {
      choiceType: 'physical_action', actionId: '__physical__',
      physicalAction: { verb: 'move', primaryObjectId: creek.id, secondaryObjectId: 'none', configuration: 'none', purpose: 'Move deliberately toward a known water source.' },
      goal: 'Test a bounded physical intention', intent: 'Move to the creek using the primitive movement layer.',
      decisionSummary: 'Synthetic mind selected an accessible place through the physical affordance interface.',
      confidence: 0.84, referencedMemoryIds: context.memories.slice(0, 1).map(m => m.id), brainMode: 'ai', model: 'smoke-test-mind'
    };
    const chosen = context.candidates[0];
    return { choiceType: 'known_action', actionId: chosen.id, physicalAction: null, goal: 'Stay functional', intent: chosen.label, decisionSummary: 'Fallback synthetic known action.', confidence: 0.7, referencedMemoryIds: [], brainMode: 'ai', model: 'smoke-test-mind' };
  },
  async replay(context) {
    const chosen = context.candidates[0];
    return { choiceType: 'known_action', actionId: chosen.id, physicalAction: null };
  }
};

for (let i = 0; i < 4; i++) {
  const dnas = await tickWithMind(aiWorld, fakeMind, { enableCounterfactualReplay: true });
  if (!dnas.every(d => d.mind?.brain_mode === 'ai')) fail(`AI tick ${i}: DNA did not record AI brain mode`);
  if (!dnas.every(d => d.physics?.version === 'affordance-0.5')) fail(`AI tick ${i}: physics version missing from DNA`);
  assertWorld(aiWorld, `AI tick ${i}`);
}
if (aiWorld.meta.aiDecisions < 8) fail('AI decision counter did not advance');
if (!aiWorld.dna.some(d => d.mind?.physical_proposal?.verb === 'move')) fail('No physical proposal recorded in DNA');
if (!aiWorld.history.some(e => e.type === 'physical')) fail('No physical action reached world history');

const chainWorld = migrateWorld(createWorld());
const mara = chainWorld.agents[0];
mara.position = 'camp';
mara.inventory.dryWood = 1;
mara.inventory.sharpStone = 1;
mara.inventory.cordage = 1;
const physicalMind = proposal => ({
  async decide() { return { choiceType: 'physical_action', actionId: '__physical__', physicalAction: proposal, goal: 'Experiment with material properties', intent: proposal.purpose, decisionSummary: 'Synthetic emergence-chain action.', confidence: 0.9, referencedMemoryIds: [], brainMode: 'ai', model: 'chain-test' }; }
});
await tickWithMind(chainWorld, physicalMind({ verb: 'cut', primaryObjectId: 'carried_dry_branch', secondaryObjectId: 'sharp_stone', configuration: 'straight', purpose: 'Make the branch straighter and easier to control.' }));
if (chainWorld.agents[0].inventory.woodPole < 1) fail('Cutting branch did not produce a worked pole');
await tickWithMind(chainWorld, physicalMind({ verb: 'bind', primaryObjectId: 'wood_pole', secondaryObjectId: 'sharp_stone', configuration: 'bound', purpose: 'See whether cordage can hold stone and wood together under force.' }));
if (chainWorld.agents[0].inventory.boundSharpTool < 1) fail('Binding materials did not produce a composite tool');
if (!chainWorld.discoveries.some(d => d.key === 'bound-composite-tool')) fail('Composite-tool world discovery missing');

const view = buildAffordanceView(chainWorld, chainWorld.agents[0]);
if (!Array.isArray(view.objects) || !view.verbs.includes('combine')) fail('Affordance view incomplete');

const boundaryWorld = migrateWorld(createWorld());
const boundaryAgent = boundaryWorld.agents[0];
boundaryAgent.position = 'camp';
boundaryAgent.memories.unshift({ id:'M-boundary', text:'West of camp is a marshy reed bed.', importance:7, confidence:.9, tags:['reeds','exploration'] });
const boundaryContext = retrieveDecisionContext(boundaryWorld, boundaryAgent);
const distantReeds = boundaryContext.affordances.objects.find(o => o.id === 'place:reed_bed');
if (!distantReeds || !distantReeds.supports.includes('move') || distantReeds.supports.includes('search')) fail('Distant-place locality boundary failed');
if (!('satiety' in boundaryContext.perception.needs) || ('hunger' in boundaryContext.perception.needs)) fail('Model physiology still exposes ambiguous hunger semantics');

console.log(`Smoke test passed · fallback Day ${fallbackWorld.day} ${String(fallbackWorld.hour).padStart(2,'0')}:00 · AI ${aiWorld.meta.aiDecisions} decisions · physical world ${chainWorld.discoveries.length} discovery records`);