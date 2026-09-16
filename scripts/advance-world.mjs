import fs from 'node:fs';
import path from 'node:path';
import { tickWithMind, migrateWorld, remember } from '../engine.js';
import { createOpenAIMind } from '../mind.js';

// Safe to invoke after API billing changes; API failure falls back without stopping the world.
const statePath = path.resolve('world/state.json');
const world = migrateWorld(JSON.parse(fs.readFileSync(statePath, 'utf8')));
const controlPath = path.resolve('world/control.json');
if (fs.existsSync(controlPath)) {
  try {
    const control = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
    world.settings ||= {}; world.settings.ai = { ...(world.settings.ai || {}), ...(control.ai || {}), people:{...(world.settings.ai?.people||{}),...(control.ai?.people||{})}, wildlife:{...(world.settings.ai?.wildlife||{}),...(control.ai?.wildlife||{}),individuals:{...(world.settings.ai?.wildlife?.individuals||{}),...(control.ai?.wildlife?.individuals||{})}} };
  } catch (error) { console.warn(`Control file ignored: ${error.message}`); }
}
const mind = createOpenAIMind();
const usage = world.meta.aiUsage ||= {calls:0,inputTokens:0,outputTokens:0,reasoningTokens:0,byActor:{}};
const addUsage=(actor,u)=>{if(!u)return;const input=Number(u.input_tokens||0),output=Number(u.output_tokens||0),reason=Number(u.output_tokens_details?.reasoning_tokens||0);usage.calls++;usage.inputTokens+=input;usage.outputTokens+=output;usage.reasoningTokens+=reason;const b=usage.byActor[actor]||={calls:0,inputTokens:0,outputTokens:0,reasoningTokens:0};b.calls++;b.inputTokens+=input;b.outputTokens+=output;b.reasoningTokens+=reason;};
const startDay = world.day;
const hours = world.day < 3 ? 3 : world.day < 10 ? 2 : 1;
const allDnas = [];

for (let i = 0; i < hours; i++) {
  const dnas = await tickWithMind(world, mind.enabled ? mind : null, {
    enableCounterfactualReplay: mind.enabled && i === hours - 1
  });
  for(const d of dnas)addUsage(d.agent_id,d.mind?.usage);
  allDnas.push(...dnas);
}

if (mind.enabled && world.day > startDay) {
  for (const agent of world.agents) {
    if (world.settings?.ai?.people?.[agent.id] === false) continue;
    try {
      const events = world.history
        .filter(e => e.agentId === agent.id || e.otherAgentId === agent.id)
        .slice(0, 16)
        .map(e => ({ day: e.day, hour: e.hour, type: e.type, title: e.title, detail: e.detail }));
      const memories = agent.memories.slice(0, 10).map(m => ({ id: m.id, text: m.text, importance: m.importance, tags: m.tags }));
      const reflection = await mind.reflect({ agent, events, memories });
      if (reflection) {
        addUsage(`${agent.id}:reflection`, reflection._usage);
        const key = String(reflection.belief_key || 'daily-reflection').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 48);
        agent.beliefs[key] = reflection.belief;
        remember(world, agent, reflection.reflection, {
          importance: reflection.importance,
          tags: ['reflection', ...(reflection.tags || [])],
          source: `reflection:day-${startDay}`,
          confidence: 0.84
        });
      }
    } catch (error) {
      console.warn(`Reflection failed for ${agent.name}: ${error.message}`);
    }
  }
}

world.meta.canonical = true;
world.meta.tickNumber = (world.meta.tickNumber || 0) + 1;
world.meta.lastAdvancedAt = new Date().toISOString();
world.meta.lastDecisionIds = allDnas.map(d => d.decision_id).slice(-world.agents.length);
world.meta.heartbeatMinutes = 5;
world.meta.worldHoursPerHeartbeat = hours;
world.meta.pacing = world.day < 3 ? 'accelerated origin' : world.day < 10 ? 'young world' : 'mature world';
world.meta.mindConfigured = mind.enabled;
world.meta.aiControls = JSON.parse(JSON.stringify(world.settings?.ai||{}));
world.meta.ecologyVersion = world.ecologySystem?.version || null;
world.meta.mindModel = mind.enabled ? mind.model : null;
world.meta.mindMode = mind.enabled ? (allDnas.some(d => d.mind?.brain_mode === 'ai') ? 'ai' : 'fallback') : 'fallback';

fs.writeFileSync(statePath, JSON.stringify(world, null, 2) + '\n');
console.log(`Advanced ChatGPTFarm ${hours}h to Day ${world.day}, ${String(world.hour).padStart(2,'0')}:00 · mind=${world.meta.mindMode}${world.meta.mindModel ? ':' + world.meta.mindModel : ''} · ${world.agents.map(a=>a.name+': '+a.currentAction).join(' · ')}`);
