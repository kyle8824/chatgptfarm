const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const API_URL = "https://api.openai.com/v1/responses";

const SYSTEM = `You are the bounded decision system for one autonomous person in ChatGPTFarm, a persistent artificial world.
You are not a narrator and you do not control physics. You may choose exactly one action from the supplied available_actions.
Use only the supplied perception, memories, beliefs, traits, current goal, recent history, and available actions. Never invent hidden places, resources, tools, skills, or facts.
Protect survival when a need is genuinely urgent, but do not behave like a repetitive utility bot. When immediate needs are stable, curiosity, experimentation, exploration, social learning, teaching, and long-term preparation are legitimate motives.
Preserve coherent goals across decisions when they still make sense, but abandon them when the world gives a strong reason.
A memory can influence you only if it appears in retrieved_memories. referenced_memory_ids must contain only memories that materially affected this choice.
Return a short explicit goal, intent, and decision summary. Do not provide private chain-of-thought or hidden reasoning.`;

const schemaFor = actionIds => ({
  type: "object",
  additionalProperties: false,
  properties: {
    action_id: { type: "string", enum: actionIds },
    goal: { type: "string", minLength: 1, maxLength: 180 },
    intent: { type: "string", minLength: 1, maxLength: 220 },
    decision_summary: { type: "string", minLength: 1, maxLength: 260 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    referenced_memory_ids: { type: "array", maxItems: 5, items: { type: "string" } }
  },
  required: ["action_id", "goal", "intent", "decision_summary", "confidence", "referenced_memory_ids"]
});

function outputText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) if (part?.type === "output_text" && typeof part.text === "string") return part.text;
  }
  return null;
}

function publicContext(context) {
  return {
    identity: {
      id: context.agent.id,
      name: context.agent.name,
      traits: context.agent.traits,
      beliefs: context.agent.beliefs,
      current_goal: context.agent.currentGoal,
      recent_actions: context.agent.recentActions
    },
    perception: context.perception,
    retrieved_memories: context.memories,
    recent_events: context.recentEvents,
    available_actions: context.candidates.map(c => ({ id: c.id, label: c.label }))
  };
}

async function callDecision(context, { replayNote = null } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const actionIds = context.candidates.map(c => c.id);
  if (!actionIds.length) throw new Error("No valid actions available");
  const payload = publicContext(context);
  if (replayNote) payload.counterfactual_replay = replayNote;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" },
      instructions: SYSTEM,
      input: JSON.stringify(payload),
      text: {
        format: {
          type: "json_schema",
          name: "chatgptfarm_decision",
          strict: true,
          schema: schemaFor(actionIds)
        }
      },
      max_output_tokens: 320
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI ${response.status}: ${body.slice(0, 220)}`);
  }
  const data = await response.json();
  const text = outputText(data);
  if (!text) throw new Error("OpenAI response contained no structured output text");
  const parsed = JSON.parse(text);
  const validMemoryIds = new Set(context.memories.map(m => m.id));
  return {
    actionId: parsed.action_id,
    goal: parsed.goal,
    intent: parsed.intent,
    decisionSummary: parsed.decision_summary,
    confidence: parsed.confidence,
    referencedMemoryIds: (parsed.referenced_memory_ids || []).filter(id => validMemoryIds.has(id)),
    brainMode: "ai",
    model: data.model || DEFAULT_MODEL,
    responseId: data.id || null
  };
}

const reflectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reflection: { type: "string", minLength: 1, maxLength: 320 },
    belief_key: { type: "string", minLength: 1, maxLength: 48 },
    belief: { type: "string", minLength: 1, maxLength: 220 },
    importance: { type: "integer", minimum: 5, maximum: 10 },
    tags: { type: "array", minItems: 1, maxItems: 5, items: { type: "string", maxLength: 30 } }
  },
  required: ["reflection", "belief_key", "belief", "importance", "tags"]
};

export function createOpenAIMind() {
  const enabled = !!process.env.OPENAI_API_KEY;
  return {
    enabled,
    model: DEFAULT_MODEL,
    async decide(context) { return callDecision(context); },
    async replay(context, { originalActionId, removedMemoryId }) {
      return callDecision(context, { replayNote: `This is a Decision DNA replay of the same decision context with memory ${removedMemoryId} removed. Choose naturally from the remaining evidence. The original action was ${originalActionId}; do not preserve or change it intentionally.` });
    },
    async reflect({ agent, events, memories }) {
      if (!enabled) return null;
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          reasoning: { effort: "low" },
          instructions: `You create one concise, explicit reflection for an autonomous person's persistent memory. Infer a useful belief from only the supplied experiences. Do not invent events. Do not output chain-of-thought.`,
          input: JSON.stringify({ name: agent.name, traits: agent.traits, current_goal: agent.mind?.currentGoal, recent_events: events, recent_memories: memories }),
          text: { format: { type: "json_schema", name: "chatgptfarm_reflection", strict: true, schema: reflectionSchema } },
          max_output_tokens: 300
        })
      });
      if (!response.ok) throw new Error(`Reflection API ${response.status}: ${(await response.text()).slice(0, 180)}`);
      const data = await response.json();
      const text = outputText(data);
      if (!text) throw new Error("Reflection response contained no text");
      return JSON.parse(text);
    }
  };
}
