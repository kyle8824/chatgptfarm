const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const API_URL = "https://api.openai.com/v1/responses";

const SYSTEM = `You are the bounded decision system for one autonomous person in ChatGPTFarm, a persistent artificial world.
You are not a narrator and you do not control physics. You can either choose one supplied known_action OR propose one bounded physical_action using only a supplied primitive verb, accessible object, optional second accessible object, and simple physical configuration.
The physics engine, not you, decides whether a physical attempt works. A physical proposal is an intention, not a guaranteed result.
Use only this person's perception, retrieved memories, beliefs, traits, recent history, known actions, accessible world objects, and environmental fields. Never invent hidden places, resources, tools, creatures, skills, or facts.
World objects may include geometry, material, physical properties, state, resolution and parent/child provenance. Treat those as observed facts only when supplied. You may reason about plausible consequences of those properties, but do not assume a recipe or technology that is not supported by experience.
Protect survival when a need is genuinely urgent. When immediate needs are stable, curiosity, experimentation, exploration, social learning, teaching, tool use, and long-term preparation are legitimate motives.
Preserve coherent goals when they still make sense, but abandon them when the environment gives a strong reason.
A memory can influence you only if it appears in retrieved_memories. referenced_memory_ids must contain only memories that materially affected the choice.
For known_action: set action_id to one supplied action id and set physical fields to none.
For physical_action: set action_id to __physical__, choose a primitive verb, accessible primary object, optional accessible secondary object, and a simple configuration. Use purpose only to describe what you are trying to learn or accomplish; do not claim success.
Return a short explicit goal, intent, and decision summary. Never provide private chain-of-thought or hidden reasoning.`;

function decisionSchema(context) {
  const actionIds = context.candidates.map(a => a.id);
  const objectIds = context.affordances.objects.map(o => o.id);
  const verbs = context.affordances.verbs;
  const configurations = context.affordances.configurations;
  return {
    type: "object", additionalProperties: false,
    properties: {
      choice_type: { type: "string", enum: ["known_action", "physical_action"] },
      action_id: { type: "string", enum: [...actionIds, "__physical__"] },
      physical_verb: { type: "string", enum: ["none", ...verbs] },
      primary_object_id: { type: "string", enum: ["none", ...objectIds] },
      secondary_object_id: { type: "string", enum: ["none", ...objectIds] },
      configuration: { type: "string", enum: configurations },
      purpose: { type: "string", maxLength: 180 },
      goal: { type: "string", minLength: 1, maxLength: 180 },
      intent: { type: "string", minLength: 1, maxLength: 220 },
      decision_summary: { type: "string", minLength: 1, maxLength: 260 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      referenced_memory_ids: { type: "array", maxItems: 5, items: { type: "string" } }
    },
    required: ["choice_type", "action_id", "physical_verb", "primary_object_id", "secondary_object_id", "configuration", "purpose", "goal", "intent", "decision_summary", "confidence", "referenced_memory_ids"]
  };
}

function outputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) for (const part of item?.content || []) if (part?.type === "output_text" && typeof part.text === "string") return part.text;
  return null;
}
const compactEntity=o=>o?.worldObject?{id:o.worldObject.id,type:o.worldObject.type,zone:o.worldObject.zone,geometry:o.worldObject.geometry,physical:o.worldObject.physical,material:o.worldObject.material,state:o.worldObject.state,resolution:o.worldObject.resolution,parent_id:o.worldObject.parentId,children:o.worldObject.childrenIds}:null;
function publicContext(context) {
  return {
    identity: {id: context.agent.id,name: context.agent.name,traits: context.agent.traits,beliefs: context.agent.beliefs,current_goal: context.agent.currentGoal,recent_actions: context.agent.recentActions},
    perception: context.perception,
    retrieved_memories: context.memories,
    recent_events: context.recentEvents,
    available_known_actions: context.candidates.map(c => ({ id: c.id, label: c.label })),
    environment: {world_model_version:context.affordances.worldModelVersion||null,fields:context.affordances.environmentFields||{}},
    physical_affordances: {
      primitive_verbs: context.affordances.verbs,
      configurations: context.affordances.configurations,
      accessible_objects: context.affordances.objects.map(o => ({id:o.id,label:o.label,kind:o.kind,quantity:o.quantity,properties:o.properties,supports:o.supports,entity:compactEntity(o)}))
    }
  };
}

function parseDecision(parsed, context, data) {
  const validMemoryIds = new Set(context.memories.map(m => m.id));
  const choiceType = parsed.choice_type === "physical_action" ? "physical_action" : "known_action";
  return {choiceType,actionId:choiceType === "physical_action" ? "__physical__" : parsed.action_id,physicalAction:choiceType === "physical_action" ? {verb: parsed.physical_verb,primaryObjectId: parsed.primary_object_id,secondaryObjectId: parsed.secondary_object_id,configuration: parsed.configuration,purpose: parsed.purpose || ""} : null,goal: parsed.goal,intent: parsed.intent,decisionSummary: parsed.decision_summary,confidence: parsed.confidence,referencedMemoryIds: (parsed.referenced_memory_ids || []).filter(id => validMemoryIds.has(id)),brainMode: "ai",model: data.model || DEFAULT_MODEL,responseId: data.id || null,usage:data.usage||null};
}

async function callDecision(context, { replayNote = null } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  if (!context.candidates.length && !context.affordances.objects.length) throw new Error("No bounded actions or affordances available");
  const payload = publicContext(context);if (replayNote) payload.counterfactual_replay = replayNote;
  const response = await fetch(API_URL, {signal: AbortSignal.timeout(10000),method: "POST",headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },body: JSON.stringify({model: DEFAULT_MODEL,reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" },instructions: SYSTEM,input: JSON.stringify(payload),text: { format: { type: "json_schema", name: "chatgptfarm_decision_v07", strict: true, schema: decisionSchema(context) } },max_output_tokens: 640})});
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 220)}`);
  const data = await response.json(), text = outputText(data);if (!text) {const reason = data?.incomplete_details?.reason ? ` (${data.incomplete_details.reason})` : '';throw new Error(`OpenAI response contained no structured output text${reason}`)}
  try { return parseDecision(JSON.parse(text), context, data); } catch (error) {const reason = data?.incomplete_details?.reason ? `; incomplete=${data.incomplete_details.reason}` : '';throw new Error(`Structured decision JSON could not be parsed${reason}: ${String(error?.message || error).slice(0, 120)}`)}
}

const reflectionSchema = {type: "object", additionalProperties: false,properties: {reflection: { type: "string", minLength: 1, maxLength: 320 },belief_key: { type: "string", minLength: 1, maxLength: 48 },belief: { type: "string", minLength: 1, maxLength: 220 },importance: { type: "integer", minimum: 5, maximum: 10 },tags: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", maxLength: 30 } }},required: ["reflection", "belief_key", "belief", "importance", "tags"]};

export function createOpenAIMind() {
  const enabled = !!process.env.OPENAI_API_KEY;
  return {enabled,model: DEFAULT_MODEL,async decide(context) { return callDecision(context); },async replay(context, { originalActionId, removedMemoryId }) {return callDecision(context, { replayNote: `Decision DNA replay: the same decision is being reconsidered with memory ${removedMemoryId} removed. The original selected descriptor was ${originalActionId}. Choose naturally from the remaining evidence; do not intentionally preserve or change it.` });},async reflect({ agent, events, memories }) {if (!enabled) return null;const response = await fetch(API_URL, {signal: AbortSignal.timeout(10000),method: "POST",headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },body: JSON.stringify({model: DEFAULT_MODEL,reasoning: { effort: "low" },instructions: `Create one concise explicit reflection for an autonomous person's persistent memory. Infer a useful belief from only the supplied experiences. Do not invent events, outcomes, recipes, or hidden facts. Do not output chain-of-thought.`,input: JSON.stringify({ name: agent.name, traits: agent.traits, current_goal: agent.mind?.currentGoal, recent_events: events, recent_memories: memories }),text: { format: { type: "json_schema", name: "chatgptfarm_reflection_v07", strict: true, schema: reflectionSchema } },max_output_tokens: 360})});if (!response.ok) throw new Error(`Reflection API ${response.status}: ${(await response.text()).slice(0, 180)}`);const data = await response.json(), text = outputText(data);if (!text) throw new Error(`Reflection response contained no text${data?.incomplete_details?.reason ? ` (${data.incomplete_details.reason})` : ''}`);const parsed=JSON.parse(text);parsed._usage=data.usage||null;return parsed;}}
}