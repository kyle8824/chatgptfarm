from pathlib import Path
import re

# core.js
p=Path('engine/core.js'); src=p.read_text()
if "from'./ecology.js'" not in src:
    src="import{ensureEcology,advanceEcology}from'./ecology.js';\n"+src
src=src.replace("ensureWorldModel(w);return w}","ensureWorldModel(w);ensureEcology(w);return w}",1)
src=src.replace(" ensureWorldModel(w);return w;\n}"," ensureWorldModel(w);ensureEcology(w);return w;\n}",1)
src=src.replace("function environmentTick(w){", "function environmentTick(w){",1)
src=src.replace("export function finishHour(w){environmentTick(w);w.hour++;", "export function finishHour(w){environmentTick(w);advanceEcology(w);w.hour++;",1)
p.write_text(src)

# engine.js exports
p=Path('engine.js'); src=p.read_text()
if "./engine/ecology.js" not in src:
    src += "\nexport{ECOLOGY_VERSION,ensureEcology,advanceEcology,visibleWildlifeForAgent,wildlifeAIEnabled}from'./engine/ecology.js';\n"
p.write_text(src)

# decision.js wildlife perception
p=Path('engine/decision.js'); src=p.read_text()
if "visibleWildlifeForAgent" not in src.splitlines()[0:3]:
    src="import{visibleWildlifeForAgent}from'./ecology.js';\n"+src
old="knownPeople:b?[{name:b.name,trust:rel?.trust??0,familiarity:rel?.familiarity??0,affinity:rel?.affinity??50,nearby:b.position===a.position}]:[]},memories:"
new="knownPeople:b?[{name:b.name,trust:rel?.trust??0,familiarity:rel?.familiarity??0,affinity:rel?.affinity??50,nearby:b.position===a.position}]:[],wildlife:visibleWildlifeForAgent(w,a)},memories:"
if old not in src: raise SystemExit('decision perception anchor not found')
src=src.replace(old,new,1)
p.write_text(src)

# runtime.js: first sightings, per-person toggles, usage passthrough
p=Path('engine/runtime.js'); src=p.read_text()
if "visibleWildlifeForAgent" not in src:
    src="import{visibleWildlifeForAgent}from'./ecology.js';\n"+src
insert="""function recordWildlifeSightings(w,a){a.wildlifeSeen||={};for(const x of visibleWildlifeForAgent(w,a)){if(a.wildlifeSeen[x.species])continue;a.wildlifeSeen[x.species]={day:w.day,hour:w.hour,animalId:x.id};remember(w,a,`I saw ${x.label} nearby; it was ${x.behavior}.`,{importance:x.species==='bear'?9:6,tags:['animal','wildlife',x.species],source:`wildlife:${x.id}`,confidence:.9});addEvent(w,'wildlife',`${a.name} saw ${x.label}`,`${x.label} was ${x.behavior} about ${x.distance} world units away.`,{agentId:a.id,wildlifeId:x.id,species:x.species})}}\n"""
if 'function recordWildlifeSightings' not in src:
    anchor="function shareKnowledge(w,a,b){"
    src=src.replace(anchor,insert+anchor,1)
src=src.replace("confidence:clamp(Number.isFinite(result.confidence)?result.confidence:fb.confidence),referencedMemoryIds:","confidence:clamp(Number.isFinite(result.confidence)?result.confidence:fb.confidence),usage:result.usage||null,referencedMemoryIds:",1)
src=src.replace("referenced_memory_ids:m.referencedMemoryIds||[],physical_proposal:m.physicalAction||null},physics:","referenced_memory_ids:m.referencedMemoryIds||[],physical_proposal:m.physicalAction||null,usage:m.usage||null},physics:",1)
old="for(const live of w.agents){const a=snap.agents.find(x=>x.id===live.id),c=retrieveDecisionContext(snap,a),fb=fallback(a,c);let m=fb;if(mind?.decide){"
new="for(const live of w.agents){recordWildlifeSightings(w,live);const a=snap.agents.find(x=>x.id===live.id);a.memories=clone(live.memories);a.wildlifeSeen=clone(live.wildlifeSeen||{});const c=retrieveDecisionContext(snap,a),fb=fallback(a,c);let m=fb;const personAI=w.settings?.ai?.people?.[live.id]!==false;if(personAI&&mind?.decide){"
if old not in src: raise SystemExit('runtime AI loop anchor not found')
src=src.replace(old,new,1)
# counterfactual only for AI DNA already constrained by brain_mode, no extra patch needed
p.write_text(src)

# mind.js: attach token usage
p=Path('mind.js'); src=p.read_text()
old="return {choiceType,actionId:choiceType === \"physical_action\" ? \"__physical__\" : parsed.action_id,physicalAction:choiceType === \"physical_action\" ? {verb: parsed.physical_verb,primaryObjectId: parsed.primary_object_id,secondaryObjectId: parsed.secondary_object_id,configuration: parsed.configuration,purpose: parsed.purpose || \"\"} : null,goal: parsed.goal,intent: parsed.intent,decisionSummary: parsed.decision_summary,confidence: parsed.confidence,referencedMemoryIds: (parsed.referenced_memory_ids || []).filter(id => validMemoryIds.has(id)),brainMode: \"ai\",model: data.model || DEFAULT_MODEL,responseId: data.id || null};"
new="return {choiceType,actionId:choiceType === \"physical_action\" ? \"__physical__\" : parsed.action_id,physicalAction:choiceType === \"physical_action\" ? {verb: parsed.physical_verb,primaryObjectId: parsed.primary_object_id,secondaryObjectId: parsed.secondary_object_id,configuration: parsed.configuration,purpose: parsed.purpose || \"\"} : null,goal: parsed.goal,intent: parsed.intent,decisionSummary: parsed.decision_summary,confidence: parsed.confidence,referencedMemoryIds: (parsed.referenced_memory_ids || []).filter(id => validMemoryIds.has(id)),brainMode: \"ai\",model: data.model || DEFAULT_MODEL,responseId: data.id || null,usage:data.usage||null};"
if old not in src: raise SystemExit('mind parse anchor not found')
src=src.replace(old,new,1)
old2="return JSON.parse(text);}}\n}"
new2="const parsed=JSON.parse(text);parsed._usage=data.usage||null;return parsed;}}\n}"
if old2 not in src: raise SystemExit('reflection usage anchor not found')
src=src.replace(old2,new2,1)
p.write_text(src)

# advance-world.mjs: load owner control + usage ledger + per-person reflection toggle
p=Path('scripts/advance-world.mjs'); src=p.read_text()
old="const world = migrateWorld(JSON.parse(fs.readFileSync(statePath, 'utf8')));\nconst mind = createOpenAIMind();"
new="""const world = migrateWorld(JSON.parse(fs.readFileSync(statePath, 'utf8')));
const controlPath = path.resolve('world/control.json');
if (fs.existsSync(controlPath)) {
  try {
    const control = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
    world.settings ||= {}; world.settings.ai = { ...(world.settings.ai || {}), ...(control.ai || {}), people:{...(world.settings.ai?.people||{}),...(control.ai?.people||{})}, wildlife:{...(world.settings.ai?.wildlife||{}),...(control.ai?.wildlife||{}),individuals:{...(world.settings.ai?.wildlife?.individuals||{}),...(control.ai?.wildlife?.individuals||{})}} };
  } catch (error) { console.warn(`Control file ignored: ${error.message}`); }
}
const mind = createOpenAIMind();
const usage = world.meta.aiUsage ||= {calls:0,inputTokens:0,outputTokens:0,reasoningTokens:0,byActor:{}};
const addUsage=(actor,u)=>{if(!u)return;const input=Number(u.input_tokens||0),output=Number(u.output_tokens||0),reason=Number(u.output_tokens_details?.reasoning_tokens||0);usage.calls++;usage.inputTokens+=input;usage.outputTokens+=output;usage.reasoningTokens+=reason;const b=usage.byActor[actor]||={calls:0,inputTokens:0,outputTokens:0,reasoningTokens:0};b.calls++;b.inputTokens+=input;b.outputTokens+=output;b.reasoningTokens+=reason;};"""
if old not in src: raise SystemExit('advance control anchor not found')
src=src.replace(old,new,1)
old="allDnas.push(...dnas);\n}"
new="for(const d of dnas)addUsage(d.agent_id,d.mind?.usage);\n  allDnas.push(...dnas);\n}"
src=src.replace(old,new,1)
src=src.replace("for (const agent of world.agents) {\n    try {", "for (const agent of world.agents) {\n    if (world.settings?.ai?.people?.[agent.id] === false) continue;\n    try {",1)
src=src.replace("if (reflection) {\n        const key", "if (reflection) {\n        addUsage(`${agent.id}:reflection`, reflection._usage);\n        const key",1)
src=src.replace("world.meta.mindConfigured = mind.enabled;", "world.meta.mindConfigured = mind.enabled;\nworld.meta.aiControls = JSON.parse(JSON.stringify(world.settings?.ai||{}));\nworld.meta.ecologyVersion = world.ecologySystem?.version || null;",1)
p.write_text(src)

# smoke tests: ecology invariants and per-agent toggle
p=Path('scripts/smoke-test.mjs'); src=p.read_text()
src=src.replace("findWorldObject, WORLD_MODEL_VERSION }", "findWorldObject, WORLD_MODEL_VERSION, ensureEcology }",1)
old="if (!world.worldModel.fields?.temperature || !world.worldModel.fields?.soilMoisture) fail(`${label}: environmental fields missing`);"
new="if (!world.worldModel.fields?.temperature || !world.worldModel.fields?.soilMoisture) fail(`${label}: environmental fields missing`);\n  ensureEcology(world); if((world.ecologySystem?.wildlife||[]).length<8) fail(`${label}: living wildlife missing`); if(world.settings?.ai?.wildlife?.enabled!==false) fail(`${label}: wildlife AI should default off`);"
src=src.replace(old,new,1)
append="""
const toggleWorld=migrateWorld(createWorld());toggleWorld.settings.ai.people['agent-mara']=false;let toggleCalls=0;const toggleMind={async decide(context){toggleCalls++;const c=context.candidates[0];return{choiceType:'known_action',actionId:c.id,physicalAction:null,goal:'test',intent:c.label,decisionSummary:'toggle test',confidence:.7,referencedMemoryIds:[],brainMode:'ai',model:'toggle-test'}}};await tickWithMind(toggleWorld,toggleMind);if(toggleCalls!==1)fail(`Per-person AI toggle expected 1 model call, got ${toggleCalls}`);if(!toggleWorld.ecologySystem.wildlife.some(x=>x.movement&&x.movement.from&&x.movement.to))fail('Wildlife movement state missing');
"""
src=src.replace("console.log(`Smoke test passed",append+"\nconsole.log(`Smoke test passed",1)
p.write_text(src)
