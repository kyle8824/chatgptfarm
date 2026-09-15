export const WORLD_VERSION = "0.3";

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const noise = (day, hour, salt = 0) => {
  const x = Math.sin((day * 24 + hour + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const pairKey = (a, b) => [a, b].sort().join("|");
const hasTag = (m, t) => m.tags?.includes(t);

function makeAgent(id, name, position, needs, traits) {
  return {
    id,
    name,
    position,
    needs,
    inventory: { berries: 0, dryWood: 0, wetWood: 0, stones: 0, clay: 0, reeds: 0, sharpStone: 0, rawClayVessel: 0, firedVessel: 0, cordage: 0 },
    memories: [], beliefs: {}, traits, skills: {}, experiments: {}, currentAction: "Waking up"
  };
}

export function createWorld() {
  const mara = makeAgent("agent-mara", "Mara", "meadow", { hydration: 66, hunger: 72, energy: 82, warmth: 62 }, { curiosity: 0.78, cooperation: 0.68, caution: 0.54 });
  const ivo = makeAgent("agent-ivo", "Ivo", "forest", { hydration: 74, hunger: 68, energy: 78, warmth: 58 }, { curiosity: 0.62, cooperation: 0.77, caution: 0.46 });
  return {
    version: WORLD_VERSION, day: 1, hour: 6, temperature: 49, weather: "clear",
    resources: { berries: 18, dryWood: 12, wetWood: 6, stones: 24, clay: 10, reeds: 14, creekWater: true },
    structures: { shelter: false, fire: false, cache: false, dryingRack: false },
    discovered: { creek: true, berries: true, fallenLog: true, stoneField: true, east: false, west: false, clayBank: false, reedBed: false },
    agents: [mara, ivo],
    relationships: { [pairKey(mara.id, ivo.id)]: { trust: 34, familiarity: 12, affinity: 50, lastInteraction: null, sharedMemories: 0, techniquesShared: 0 } },
    discoveries: [], history: [], dna: [], seq: { event: 1, memory: 1, decision: 1, discovery: 1 },
    meta: { canonical: true, lastAdvancedAt: null, tickNumber: 0 }
  };
}

export function migrateWorld(w) {
  if (!w.agents) {
    const old = w.agent || makeAgent("agent-mara", "Mara", "meadow", { hydration: 66, hunger: 72, energy: 82, warmth: 62 }, { curiosity: 0.78, cooperation: 0.68, caution: 0.54 });
    old.traits ||= { curiosity: 0.78, cooperation: 0.68, caution: 0.54 };
    const ivo = makeAgent("agent-ivo", "Ivo", "forest", { hydration: 74, hunger: 68, energy: 78, warmth: 58 }, { curiosity: 0.62, cooperation: 0.77, caution: 0.46 });
    w.agents = [old, ivo]; delete w.agent;
  }
  w.version = WORLD_VERSION;
  w.relationships ||= { [pairKey("agent-mara", "agent-ivo")]: { trust: 34, familiarity: 12, affinity: 50, lastInteraction: null, sharedMemories: 0, techniquesShared: 0 } };
  const rel = w.relationships[pairKey("agent-mara", "agent-ivo")]; if (rel && rel.techniquesShared === undefined) rel.techniquesShared = 0;
  w.resources ||= {}; Object.assign(w.resources, { berries: w.resources.berries ?? 18, dryWood: w.resources.dryWood ?? 12, wetWood: w.resources.wetWood ?? 6, stones: w.resources.stones ?? 24, clay: w.resources.clay ?? 10, reeds: w.resources.reeds ?? 14, creekWater: w.resources.creekWater ?? true });
  w.structures ||= {}; Object.assign(w.structures, { shelter: w.structures.shelter ?? false, fire: w.structures.fire ?? false, cache: w.structures.cache ?? false, dryingRack: w.structures.dryingRack ?? false });
  w.discovered ||= {}; Object.assign(w.discovered, { creek: w.discovered.creek ?? true, berries: w.discovered.berries ?? true, fallenLog: w.discovered.fallenLog ?? true, stoneField: w.discovered.stoneField ?? true, east: w.discovered.east ?? false, west: w.discovered.west ?? false, clayBank: w.discovered.clayBank ?? false, reedBed: w.discovered.reedBed ?? false });
  w.discoveries ||= []; w.history ||= []; w.dna ||= []; w.seq ||= { event: 1, memory: 1, decision: 1, discovery: 1 }; w.seq.discovery ||= 1; w.meta ||= { canonical: true, lastAdvancedAt: null, tickNumber: 0 };
  for (const a of w.agents) {
    a.traits ||= { curiosity: 0.6, cooperation: 0.6, caution: 0.5 }; a.memories ||= []; a.beliefs ||= {}; a.skills ||= {}; a.experiments ||= {}; a.inventory ||= {};
    for (const [key, value] of Object.entries({ berries: 0, dryWood: 0, wetWood: 0, stones: 0, clay: 0, reeds: 0, sharpStone: 0, rawClayVessel: 0, firedVessel: 0, cordage: 0 })) if (a.inventory[key] === undefined) a.inventory[key] = value;
  }
  return w;
}

export function addEvent(w, type, title, detail, meta = {}) {
  w.history.unshift({ id: `E-${String(w.seq.event++).padStart(5, "0")}`, day: w.day, hour: w.hour, type, title, detail, ...meta });
  w.history = w.history.slice(0, 500);
}

export function remember(w, a, text, { importance = 5, tags = [], source = null, confidence = 0.75 } = {}) {
  const hit = a.memories.find(m => m.text === text);
  if (hit) { hit.confidence = clamp(hit.confidence + 0.04, 0, 1); hit.lastSeen = `${w.day}:${w.hour}`; return hit; }
  const prefix = a.id.endsWith("ivo") ? "I" : "M";
  const m = { id: `M-${prefix}${String(w.seq.memory++).padStart(3, "0")}`, text, importance, tags, source: source || `experience:${w.day}-${w.hour}`, confidence, lastSeen: `${w.day}:${w.hour}` };
  a.memories.unshift(m); a.memories = a.memories.slice(0, 80); addEvent(w, "learn", `${a.name} formed a memory`, text, { agentId: a.id, memoryId: m.id }); return m;
}

const memoryBoost = (a, tag) => a.memories.filter(m => hasTag(m, tag)).reduce((s, m) => s + m.importance * m.confidence, 0);
const otherAgent = (w, a) => w.agents.find(x => x.id !== a.id);
const relationship = (w, a, b) => w.relationships[pairKey(a.id, b.id)];
const knows = (a, skill) => (a.skills?.[skill] || 0) > 0;

function recordDiscovery(w, a, key, title, detail, effect) {
  let existing = w.discoveries.find(d => d.key === key);
  if (!existing) {
    existing = { id: `DISC-${String(w.seq.discovery++).padStart(3, "0")}`, key, title, detail, effect, firstAgentId: a.id, firstAgentName: a.name, day: w.day, hour: w.hour };
    w.discoveries.unshift(existing);
    addEvent(w, "discovery", `WORLD DISCOVERY · ${title}`, `${a.name} is the first to discover: ${detail}`, { agentId: a.id, discoveryId: existing.id, discoveryKey: key });
  }
  return existing;
}

function learnSkill(w, a, key, level, memoryText, discovery = null) {
  a.skills[key] = Math.max(a.skills[key] || 0, level);
  if (memoryText) remember(w, a, memoryText, { importance: 9, tags: ["technique", key], confidence: 0.94 });
  if (discovery) recordDiscovery(w, a, key, discovery.title, discovery.detail, discovery.effect);
}

export function observe(w, a) {
  const b = otherAgent(w, a), rel = b ? relationship(w, a, b) : null;
  const nearby = [w.discovered.creek && "creek with drinkable water", w.resources.berries > 0 && `${w.resources.berries} berry portions`, w.resources.dryWood > 0 && "dry branches", w.resources.wetWood > 0 && "damp branches", w.discovered.stoneField && `${w.resources.stones} loose stones`, w.discovered.clayBank && w.resources.clay > 0 && "a bank of sticky clay", w.discovered.reedBed && w.resources.reeds > 0 && "tall flexible reeds", w.structures.shelter && "a crude shelter", w.structures.fire && "a small fire", w.structures.cache && "a food cache", w.structures.dryingRack && "a branch drying rack", b && b.position === a.position && `${b.name} nearby`].filter(Boolean);
  return { time: `Day ${w.day}, ${String(w.hour).padStart(2, "0")}:00`, weather: w.weather, temperature: w.temperature, nearby, needs: { ...a.needs }, inventory: { ...a.inventory }, skills: { ...a.skills }, knownPeople: b ? [{ name: b.name, trust: rel?.trust ?? 0, familiarity: rel?.familiarity ?? 0, lastKnownPosition: b.position }] : [] };
}

function experimentReadiness(a, key) { const attempts = a.experiments?.[key] || 0; return Math.min(14, attempts * 2.2) + a.traits.curiosity * 10 - a.traits.caution * 2; }

function candidateActions(w, a) {
  const n = a.needs, r = w.resources, inv = a.inventory, s = w.structures, mb = t => memoryBoost(a, t), c = [], b = otherAgent(w, a), rel = b ? relationship(w, a, b) : null;
  const comfortable = n.hydration > 45 && n.hunger > 45 && n.energy > 42 && n.warmth > 38;
  if (r.creekWater) c.push({ id: "drink", label: "Drink from the creek", score: (100 - n.hydration) * 1.45 + mb("water") * 0.8, reasons: [["thirst", 100 - n.hydration], ["memory: water", mb("water")]] });
  if (r.berries > 0) c.push({ id: "eat_berries", label: "Eat wild berries", score: (100 - n.hunger) * 1.2 + mb("berries") * 0.65, reasons: [["hunger", 100 - n.hunger], ["memory: berries", mb("berries")]] });
  if (r.berries > 0 && inv.berries < 5) c.push({ id: "gather_berries", label: "Gather berries", score: 16 + (100 - n.hunger) * 0.22 + mb("store-food") * 0.7, reasons: [["future hunger", (100 - n.hunger) * 0.22], ["memory: store food", mb("store-food")]] });
  const woodToolBonus = knows(a, "sharp-edge") ? 6 : 0;
  if (r.dryWood > 0) c.push({ id: "gather_dry_wood", label: knows(a, "sharp-edge") ? "Cut dry branches with sharp stone" : "Gather dry branches", score: 13 + (100 - n.warmth) * 0.26 + mb("dry-wood") * 0.8 + (!s.shelter ? 6 : 0) + woodToolBonus, reasons: [["cold", (100 - n.warmth) * 0.26], ["tool advantage", woodToolBonus], ["no shelter", !s.shelter ? 6 : 0]] });
  if (r.wetWood > 0) c.push({ id: "gather_wet_wood", label: "Gather damp branches", score: 9 + (100 - n.warmth) * 0.18 - mb("wet-wood-bad") * 1.8, reasons: [["cold", (100 - n.warmth) * 0.18], ["memory: wet wood", -mb("wet-wood-bad") * 1.8]] });
  if (w.discovered.stoneField && r.stones > 0 && inv.stones < 4) c.push({ id: "gather_stones", label: "Gather loose stones", score: 7 + a.traits.curiosity * 8 + (knows(a, "sharp-edge") ? -5 : 2), reasons: [["curiosity", a.traits.curiosity * 8], ["unknown potential", knows(a, "sharp-edge") ? -5 : 2]] });
  if (w.discovered.clayBank && r.clay > 0 && inv.clay < 3) c.push({ id: "gather_clay", label: "Gather sticky clay", score: 8 + a.traits.curiosity * 9 + (knows(a, "clay-shaping") ? 4 : 0), reasons: [["curiosity", a.traits.curiosity * 9], ["known clay use", knows(a, "clay-shaping") ? 4 : 0]] });
  if (w.discovered.reedBed && r.reeds > 0 && inv.reeds < 5) c.push({ id: "gather_reeds", label: "Gather flexible reeds", score: 7 + a.traits.curiosity * 8 + (knows(a, "cordage") ? 4 : 0), reasons: [["curiosity", a.traits.curiosity * 8], ["known reed use", knows(a, "cordage") ? 4 : 0]] });
  if (inv.dryWood >= 2 && !s.fire) c.push({ id: "make_fire", label: "Try to make a fire", score: 21 + (100 - n.warmth) * 0.8 + mb("fire") * 0.75, reasons: [["cold", (100 - n.warmth) * 0.8], ["memory: fire", mb("fire")]] });
  if (inv.wetWood >= 2 && !s.fire) c.push({ id: "make_fire_wet", label: "Try a fire with damp wood", score: 15 + (100 - n.warmth) * 0.65 - mb("wet-wood-bad") * 1.5, reasons: [["cold", (100 - n.warmth) * 0.65], ["memory: wet wood", -mb("wet-wood-bad") * 1.5]] });
  if (inv.dryWood >= 4 && !s.shelter) c.push({ id: "build_shelter", label: "Build a crude shelter", score: 19 + (100 - n.warmth) * 0.38 + mb("shelter") * 0.7 + (knows(a, "cordage") ? 8 : 0), reasons: [["exposure", (100 - n.warmth) * 0.38], ["cordage", knows(a, "cordage") ? 8 : 0]] });
  if (inv.berries >= 3 && !s.cache) c.push({ id: "make_cache", label: "Make a food cache", score: 10 + mb("store-food") * 0.9 + (100 - n.hunger) * 0.16, reasons: [["stored food", inv.berries * 2], ["memory: store food", mb("store-food")]] });
  if (inv.dryWood >= 3 && !s.dryingRack && mb("wet-wood-bad") > 3) c.push({ id: "make_drying_rack", label: "Build a rack to dry wet wood", score: 12 + mb("wet-wood-bad") * 0.55 + a.traits.curiosity * 5, reasons: [["failure memory", mb("wet-wood-bad") * 0.55], ["curiosity", a.traits.curiosity * 5]] });
  if (comfortable && inv.stones >= 2 && !knows(a, "sharp-edge")) c.push({ id: "experiment_stones", label: "Experiment by striking stones together", score: 10 + experimentReadiness(a, "stone-striking"), reasons: [["curiosity", a.traits.curiosity * 10], ["prior attempts", (a.experiments?.["stone-striking"] || 0) * 2.2]] });
  if (comfortable && inv.clay >= 2 && !knows(a, "clay-shaping")) c.push({ id: "experiment_clay", label: "Experiment with wet clay", score: 9 + experimentReadiness(a, "clay-shaping"), reasons: [["curiosity", a.traits.curiosity * 10], ["prior attempts", (a.experiments?.["clay-shaping"] || 0) * 2.2]] });
  if (comfortable && inv.reeds >= 3 && !knows(a, "cordage")) c.push({ id: "experiment_reeds", label: "Twist and braid flexible reeds", score: 9 + experimentReadiness(a, "reed-twisting"), reasons: [["curiosity", a.traits.curiosity * 10], ["prior attempts", (a.experiments?.["reed-twisting"] || 0) * 2.2]] });
  if (inv.clay >= 2 && knows(a, "clay-shaping") && inv.rawClayVessel < 1) c.push({ id: "shape_clay_vessel", label: "Shape clay into a hollow vessel", score: 18 + a.skills["clay-shaping"] * 5, reasons: [["known technique", a.skills["clay-shaping"] * 5]] });
  if (inv.rawClayVessel > 0 && s.fire && !knows(a, "fired-clay")) c.push({ id: "experiment_fire_clay", label: "Place the clay vessel near the fire", score: 18 + a.traits.curiosity * 12 + mb("fire") * 0.2, reasons: [["curiosity", a.traits.curiosity * 12], ["fire experience", mb("fire") * 0.2]] });
  if (inv.reeds >= 3 && knows(a, "cordage") && inv.cordage < 2) c.push({ id: "make_cordage", label: "Twist reeds into cordage", score: 14 + a.skills.cordage * 5, reasons: [["known technique", a.skills.cordage * 5]] });
  if (n.energy < 48) c.push({ id: "rest", label: s.shelter ? "Rest in the shelter" : "Rest in the meadow", score: (100 - n.energy) * 1.1 + mb("rest") * 0.4, reasons: [["fatigue", 100 - n.energy], ["memory: rest", mb("rest")]] });
  c.push({ id: "explore", label: "Explore beyond the known basin", score: 8 + a.traits.curiosity * 13 + mb("exploration") * 0.22 - (100 - n.energy) * 0.16, reasons: [["curiosity", a.traits.curiosity * 13], ["memory: exploration", mb("exploration") * 0.22], ["fatigue penalty", -(100 - n.energy) * 0.16]] });
  if (b) {
    const same = b.position === a.position;
    const teachable = Object.keys(a.skills || {}).find(skill => knows(a, skill) && !knows(b, skill));
    if (same && teachable) c.push({ id: `teach:${teachable}`, label: `Show ${b.name} the ${teachable.replaceAll("-", " ")} technique`, score: 11 + a.traits.cooperation * 12 + (rel?.trust || 0) * 0.08 + (rel?.familiarity || 0) * 0.05, reasons: [["cooperation", a.traits.cooperation * 12], ["trust", (rel?.trust || 0) * 0.08], ["familiarity", (rel?.familiarity || 0) * 0.05]] });
    c.push({ id: same ? "talk" : "seek_other", label: same ? `Talk with ${b.name}` : `Look for ${b.name}`, score: (same ? 9 : 4) + a.traits.cooperation * 8 + (rel?.familiarity || 0) * 0.06 + mb("social") * 0.28, reasons: [["cooperation", a.traits.cooperation * 8], ["familiarity", (rel?.familiarity || 0) * 0.06], ["social memory", mb("social") * 0.28]] });
    if (same && inv.berries >= 2 && b.needs.hunger < 50) c.push({ id: "share_food", label: `Share berries with ${b.name}`, score: 9 + a.traits.cooperation * 12 + (50 - b.needs.hunger) * 0.45 + (rel?.trust || 0) * 0.08, reasons: [["cooperation", a.traits.cooperation * 12], [`${b.name} hunger`, (50 - b.needs.hunger) * 0.45], ["trust", (rel?.trust || 0) * 0.08]] });
  }
  return c.map(x => ({ ...x, score: +x.score.toFixed(3) }));
}

export function chooseAction(w, a, excludedMemoryId = null) { let removed = null; if (excludedMemoryId) { const i = a.memories.findIndex(m => m.id === excludedMemoryId); if (i >= 0) removed = a.memories.splice(i, 1)[0]; } const candidates = candidateActions(w, a).sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)); if (removed) a.memories.unshift(removed); return { winner: candidates[0], candidates }; }

function createDNA(w, a, choice) {
  const id = `D-${String(w.seq.decision++).padStart(5, "0")}`, memories = [...a.memories].slice(0, 12);
  const counterfactuals = memories.map(m => { const replay = chooseAction(w, a, m.id), sameCandidate = replay.candidates.find(x => x.id === choice.winner.id); return { removed_memory: m.id, memory_text: m.text, original_action: choice.winner.id, counterfactual_action: replay.winner.id, action_changed: replay.winner.id !== choice.winner.id, score_delta: +(choice.winner.score - (sameCandidate?.score ?? 0)).toFixed(3) }; });
  const dna = { protocol: "Decision DNA 0.3-farm", decision_id: id, day: w.day, hour: w.hour, agent_id: a.id, agent_name: a.name, observation: observe(w, a), action: choice.winner.id, action_label: choice.winner.label, winner_score: choice.winner.score, candidates: choice.candidates.slice(0, 10), factors: choice.winner.reasons.filter(x => Math.abs(x[1]) > 0.01), memory_counterfactuals: counterfactuals };
  w.dna.unshift(dna); w.dna = w.dna.slice(0, 350); return dna;
}

function shareKnowledge(w, speaker, listener) { const candidate = speaker.memories.find(m => m.importance >= 6 && !listener.memories.some(x => x.text === m.text)); if (!candidate) return null; const copy = remember(w, listener, `${speaker.name} told me: ${candidate.text}`, { importance: Math.max(4, candidate.importance - 1), tags: [...(candidate.tags || []), "social"], source: `social:${speaker.id}:${candidate.id}`, confidence: Math.max(0.55, candidate.confidence - 0.12) }); relationship(w, speaker, listener).sharedMemories++; return copy; }

function teachTechnique(w, teacher, learner, skill) {
  if (!knows(teacher, skill) || knows(learner, skill)) return false;
  learner.skills[skill] = Math.max(0.55, (teacher.skills[skill] || 1) * 0.72);
  remember(w, learner, `${teacher.name} showed me how to ${skill.replaceAll("-", " ")}.`, { importance: 9, tags: ["technique", skill, "social"], source: `teaching:${teacher.id}:${skill}`, confidence: 0.86 });
  const rel = relationship(w, teacher, learner); rel.trust = clamp(rel.trust + 5); rel.familiarity = clamp(rel.familiarity + 7); rel.affinity = clamp(rel.affinity + 2); rel.techniquesShared++; rel.lastInteraction = `${w.day}:${w.hour}`;
  addEvent(w, "culture", `${teacher.name} taught ${learner.name}`, `${teacher.name} demonstrated the ${skill.replaceAll("-", " ")} technique. Knowledge moved from one mind to another.`, { agentId: teacher.id, otherAgentId: learner.id, skill }); return true;
}

function attemptExperiment(w, a, key, baseChance, success, failure) {
  a.experiments[key] = (a.experiments[key] || 0) + 1; const attempts = a.experiments[key]; const chance = Math.min(0.92, baseChance + attempts * 0.12 + a.traits.curiosity * 0.08); const roll = noise(w.day, w.hour, a.id.length * 31 + key.length * 17 + attempts * 7);
  if (roll < chance) { success(attempts); return true; } failure(attempts); return false;
}

function execute(w, a, action) {
  const n = a.needs, r = w.resources, inv = a.inventory, s = w.structures, b = otherAgent(w, a), rel = b ? relationship(w, a, b) : null; let detail = ""; a.currentAction = action.label;
  if (action.id.startsWith("teach:")) { const skill = action.id.slice(6), ok = b && b.position === a.position && teachTechnique(w, a, b, skill); detail = ok ? `${a.name} spends the hour demonstrating a technique to ${b.name}.` : `${a.name} tries to demonstrate a technique, but the moment does not come together.`; addEvent(w, "action", action.label, detail, { agentId: a.id, actionId: action.id }); return; }
  switch (action.id) {
    case "drink": n.hydration = clamp(n.hydration + (inv.firedVessel > 0 ? 42 : 35)); a.position = "creek"; detail = `${a.name} drinks from the creek until the pressure of thirst eases.`; remember(w, a, "The creek provides reliable drinking water.", { importance: 8, tags: ["water"], confidence: 0.96 }); break;
    case "eat_berries": if (inv.berries > 0) inv.berries--; else r.berries = Math.max(0, r.berries - 1); n.hunger = clamp(n.hunger + 28); a.position = "berries"; detail = `${a.name} eats tart red berries and hunger recedes.`; remember(w, a, "The red berries in the meadow are edible and reduce hunger.", { importance: 7, tags: ["berries", "food"], confidence: 0.9 }); break;
    case "gather_berries": r.berries = Math.max(0, r.berries - 2); inv.berries += 2; n.energy = clamp(n.energy - 4); a.position = "berries"; detail = `${a.name} gathers two portions of berries for later.`; if (inv.berries >= 4) remember(w, a, "Keeping berries in reserve could protect against later hunger.", { importance: 6, tags: ["store-food"], confidence: 0.78 }); break;
    case "gather_dry_wood": { const amount = knows(a, "sharp-edge") ? 3 : 2; r.dryWood = Math.max(0, r.dryWood - amount); inv.dryWood += amount; n.energy = clamp(n.energy - (knows(a, "sharp-edge") ? 4 : 6)); a.position = "log"; detail = knows(a, "sharp-edge") ? `${a.name} uses a sharp stone edge to cut branches more efficiently, bringing back ${amount}.` : `${a.name} breaks dry branches from the fallen tree and carries them back.`; remember(w, a, "Dry branches are useful for heat and building.", { importance: 5, tags: ["dry-wood"], confidence: 0.74 }); break; }
    case "gather_wet_wood": r.wetWood = Math.max(0, r.wetWood - 2); inv.wetWood += 2; n.energy = clamp(n.energy - 7); a.position = "log"; detail = `${a.name} collects damp branches from beneath the fallen log.`; break;
    case "gather_stones": r.stones = Math.max(0, r.stones - 2); inv.stones += 2; n.energy = clamp(n.energy - 4); a.position = "stones"; detail = `${a.name} selects two palm-sized stones and carries them back, unsure what they may be good for.`; remember(w, a, "Some stones fracture differently from others when struck.", { importance: 4, tags: ["stone", "experiment"], confidence: 0.62 }); break;
    case "gather_clay": r.clay = Math.max(0, r.clay - 2); inv.clay += 2; n.energy = clamp(n.energy - 4); a.position = "clay"; detail = `${a.name} digs sticky clay from the creek bank and carries a heavy lump back.`; remember(w, a, "Wet creek-bank clay holds a shape when pressed.", { importance: 5, tags: ["clay", "experiment"], confidence: 0.7 }); break;
    case "gather_reeds": r.reeds = Math.max(0, r.reeds - 3); inv.reeds += 3; n.energy = clamp(n.energy - 4); a.position = "reeds"; detail = `${a.name} cuts and gathers long flexible reeds from the wet ground.`; remember(w, a, "Long reeds bend without immediately breaking.", { importance: 5, tags: ["reeds", "experiment"], confidence: 0.72 }); break;
    case "make_fire": inv.dryWood -= 2; s.fire = true; n.warmth = clamp(n.warmth + 30); a.position = "camp"; detail = `${a.name} gets dry twigs to catch. A small fire begins to hold.`; remember(w, a, "Dry wood catches flame and provides strong warmth.", { importance: 9, tags: ["fire", "dry-wood"], confidence: 0.94 }); break;
    case "make_fire_wet": inv.wetWood -= 2; n.energy = clamp(n.energy - 8); n.warmth = clamp(n.warmth - 3); a.position = "camp"; detail = `${a.name} tries damp wood. It smokes, sputters, and the flame dies.`; remember(w, a, "Damp wood smokes and fails to sustain a fire; dry fuel works better.", { importance: 10, tags: ["wet-wood-bad", "fire", "dry-wood"], confidence: 0.98 }); break;
    case "build_shelter": inv.dryWood -= 4; s.shelter = true; n.energy = clamp(n.energy - (knows(a, "cordage") ? 12 : 18)); a.position = "camp"; detail = knows(a, "cordage") ? `${a.name} lashes branches together with cordage, making a noticeably sturdier shelter.` : `${a.name} leans branches against a forked trunk and makes a crude windbreak.`; remember(w, a, "A branch shelter reduces exposure and gives a safer place to rest.", { importance: 9, tags: ["shelter", "rest"], confidence: 0.91 }); break;
    case "make_cache": inv.berries -= 3; s.cache = true; n.energy = clamp(n.energy - 5); a.position = "camp"; detail = `${a.name} tucks gathered food into a shaded stone-lined cache near camp.`; remember(w, a, "A shaded cache can keep gathered food separate from immediate meals.", { importance: 7, tags: ["store-food"], confidence: 0.86 }); break;
    case "make_drying_rack": inv.dryWood -= 3; s.dryingRack = true; n.energy = clamp(n.energy - 9); a.position = "camp"; detail = `${a.name} props branches into a rack that keeps damp wood off the ground and exposed to moving air.`; remember(w, a, "Keeping wet wood raised and exposed to air helps it dry.", { importance: 9, tags: ["drying", "wet-wood-bad"], confidence: 0.88 }); recordDiscovery(w, a, "drying-rack", "Raised drying rack", "Wet fuel can be improved by keeping it off the ground and exposed to air.", "Wet wood can gradually become usable dry fuel."); break;
    case "experiment_stones": inv.stones = Math.max(0, inv.stones - 1); n.energy = clamp(n.energy - 5); a.position = "camp"; attemptExperiment(w, a, "stone-striking", 0.18, attempts => { inv.sharpStone += 1; learnSkill(w, a, "sharp-edge", 1, "Striking certain stones together can knock off a thin sharp flake.", { title: "Sharp stone edge", detail: `After ${attempts} experiment${attempts === 1 ? "" : "s"}, ${a.name} produced a deliberately useful sharp stone flake.`, effect: "Cutting branches costs less energy and produces more usable wood." }); detail = `${a.name} strikes one stone against another. A thin flake shears away with an unexpectedly sharp edge. ${a.name} keeps it.`; }, attempts => { detail = `${a.name} spends the hour striking and turning stones. Chips break away, but nothing seems reliably useful yet.`; remember(w, a, `Stone-striking attempt ${attempts}: angle and stone shape seem to change how flakes break away.`, { importance: 5, tags: ["stone", "experiment", "sharp-edge"], confidence: 0.64 + Math.min(0.2, attempts * 0.04) }); }); break;
    case "experiment_clay": n.energy = clamp(n.energy - 4); a.position = "camp"; attemptExperiment(w, a, "clay-shaping", 0.22, attempts => { learnSkill(w, a, "clay-shaping", 1, "Wet clay can be pinched and coiled into stable hollow shapes.", { title: "Shaped clay", detail: `After ${attempts} attempt${attempts === 1 ? "" : "s"}, ${a.name} learned to make wet clay hold a hollow form.`, effect: "Raw clay vessels can now be formed for further experimentation." }); detail = `${a.name} presses and coils the clay until a rough hollow cup finally holds its walls instead of slumping flat.`; }, attempts => { detail = `${a.name} kneads and presses the clay. The shape slumps and cracks, but each failure reveals how wet and thick the walls can be.`; remember(w, a, `Clay-shaping attempt ${attempts}: wall thickness and moisture determine whether a hollow shape collapses.`, { importance: 5, tags: ["clay", "experiment", "clay-shaping"], confidence: 0.64 + Math.min(0.2, attempts * 0.04) }); }); break;
    case "experiment_reeds": inv.reeds = Math.max(0, inv.reeds - 1); n.energy = clamp(n.energy - 4); a.position = "camp"; attemptExperiment(w, a, "reed-twisting", 0.2, attempts => { learnSkill(w, a, "cordage", 1, "Twisting reed fibers in opposing directions makes a stronger cord than a single reed.", { title: "Twisted cordage", detail: `After ${attempts} experiment${attempts === 1 ? "" : "s"}, ${a.name} made a flexible cord that survives a hard pull.`, effect: "Cordage can reinforce construction and become a component in future tools." }); inv.cordage += 1; detail = `${a.name} twists two bundles in opposite directions. For the first time, the strands lock together instead of unraveling.`; }, attempts => { detail = `${a.name} twists reeds into a rough strand, but it loosens when pulled. The failed braid is discarded.`; remember(w, a, `Reed-twisting attempt ${attempts}: simple braids loosen under load; tension and twist direction matter.`, { importance: 5, tags: ["reeds", "experiment", "cordage"], confidence: 0.64 + Math.min(0.2, attempts * 0.04) }); }); break;
    case "shape_clay_vessel": inv.clay -= 2; inv.rawClayVessel += 1; n.energy = clamp(n.energy - 5); a.position = "camp"; detail = `${a.name} uses the learned clay technique to shape a small hollow vessel and leaves it near camp.`; break;
    case "experiment_fire_clay": inv.rawClayVessel -= 1; n.energy = clamp(n.energy - 3); a.position = "camp"; attemptExperiment(w, a, "firing-clay", 0.28, attempts => { inv.firedVessel += 1; learnSkill(w, a, "fired-clay", 1, "A dry clay vessel hardened permanently when heated beside a sustained fire.", { title: "Fired clay vessel", detail: `On firing attempt ${attempts}, ${a.name}'s clay vessel survives the heat and becomes hard, water-resistant ceramic.`, effect: "Water can be carried away from the creek, increasing safe exploration range." }); detail = `${a.name} moves the dry clay vessel closer to the fire. Hours later it cools hard and rings faintly when tapped. Water no longer immediately softens it.`; }, attempts => { detail = `${a.name} heats the clay vessel near the fire. A crack races through the wall and the vessel breaks.`; remember(w, a, `Clay-firing attempt ${attempts}: heating too quickly can crack a vessel; dryness and heat distance may matter.`, { importance: 7, tags: ["clay", "fire", "experiment", "fired-clay"], confidence: 0.76 }); }); break;
    case "make_cordage": inv.reeds -= 3; inv.cordage += 1; n.energy = clamp(n.energy - 5); a.position = "camp"; detail = `${a.name} deliberately twists gathered reeds into another length of usable cordage.`; break;
    case "rest": n.energy = clamp(n.energy + (s.shelter ? 30 : 21)); n.warmth = clamp(n.warmth + (s.shelter ? 8 : -3)); a.position = s.shelter ? "camp" : "meadow"; detail = s.shelter ? `${a.name} rests beneath the shelter, protected from the wind.` : `${a.name} rests in the grass. Energy returns, but the open air steals warmth.`; remember(w, a, s.shelter ? "Rest is more effective inside the shelter." : "Rest restores energy, though exposed ground is cold.", { importance: 5, tags: ["rest"], confidence: 0.8 }); break;
    case "explore": n.energy = clamp(n.energy - (inv.firedVessel > 0 ? 8 : 12)); a.position = "edge"; if (!w.discovered.east) { w.discovered.east = true; w.discovered.clayBank = true; detail = `${a.name} follows the creek east. Beyond the ridge, exposed orange-gray earth sticks heavily to wet fingers: a clay bank.`; remember(w, a, "East of the meadow, the creek exposes sticky clay-rich soil.", { importance: 7, tags: ["exploration", "clay"], confidence: 0.9 }); addEvent(w, "world", "New place discovered · Clay bank", `${a.name} expanded the known world to the east.`, { agentId: a.id }); } else if (!w.discovered.west) { w.discovered.west = true; w.discovered.reedBed = true; detail = `${a.name} scouts west and finds dense forest opening onto marshy ground filled with tall flexible reeds and animal tracks.`; remember(w, a, "West of camp is a marshy reed bed beside denser forest and animal tracks.", { importance: 7, tags: ["exploration", "reeds", "animals"], confidence: 0.88 }); addEvent(w, "world", "New place discovered · Reed marsh", `${a.name} expanded the known world to the west.`, { agentId: a.id }); } else { detail = inv.firedVessel > 0 ? `${a.name} carries water farther beyond the familiar basin, extending the day's safe exploration before turning back.` : `${a.name} traces the basin boundary, reinforcing the mental map but finding nothing immediately useful.`; remember(w, a, inv.firedVessel > 0 ? "Carrying water allows longer journeys away from the creek." : "Repeated exploration makes the basin's boundaries more familiar.", { importance: inv.firedVessel > 0 ? 7 : 3, tags: ["exploration", "water"], confidence: 0.74 }); } break;
    case "seek_other": if (b) { a.position = b.position; n.energy = clamp(n.energy - 5); detail = `${a.name} follows signs of movement and finds ${b.name} near the ${b.position}.`; remember(w, a, `I can intentionally find ${b.name} by checking familiar places and recent traces.`, { importance: 4, tags: ["social"], confidence: 0.72 }); } break;
    case "talk": if (b && b.position === a.position) { const shared = shareKnowledge(w, a, b); rel.familiarity = clamp(rel.familiarity + 5); rel.trust = clamp(rel.trust + 2); rel.affinity = clamp(rel.affinity + 1); rel.lastInteraction = `${w.day}:${w.hour}`; detail = shared ? `${a.name} and ${b.name} talk. ${a.name} shares an experience that ${b.name} had not known.` : `${a.name} and ${b.name} spend time together, comparing the day's observations.`; remember(w, a, `Talking with ${b.name} helps us compare what each of us has learned.`, { importance: 5, tags: ["social"], confidence: 0.8 }); } break;
    case "share_food": if (b && b.position === a.position && inv.berries >= 2) { inv.berries -= 2; b.needs.hunger = clamp(b.needs.hunger + 24); rel.trust = clamp(rel.trust + 7); rel.affinity = clamp(rel.affinity + 4); rel.familiarity = clamp(rel.familiarity + 3); rel.lastInteraction = `${w.day}:${w.hour}`; detail = `${a.name} gives two portions of gathered berries to ${b.name}. ${b.name} eats immediately.`; remember(w, a, `Sharing food with ${b.name} strengthened our trust.`, { importance: 7, tags: ["social", "sharing"], confidence: 0.9 }); remember(w, b, `${a.name} shared stored food with me when I was hungry.`, { importance: 8, tags: ["social", "sharing"], confidence: 0.94 }); } break;
  }
  addEvent(w, "action", action.label, detail, { agentId: a.id, actionId: action.id });
}

function environmentTick(w) {
  for (const a of w.agents) { const n = a.needs; n.hydration = clamp(n.hydration - (a.inventory.firedVessel > 0 ? 5.5 : 6.5)); n.hunger = clamp(n.hunger - 4.2); n.energy = clamp(n.energy - 2.8); const cold = w.temperature < 50 ? 5 : w.temperature < 58 ? 2 : 0; n.warmth = clamp(n.warmth - cold + (w.structures.fire ? 6 : 0) + (w.structures.shelter ? 2 : 0)); }
  if (w.structures.dryingRack && w.resources.wetWood > 0 && noise(w.day, w.hour, 78) > 0.45) { w.resources.wetWood--; w.resources.dryWood++; addEvent(w, "world", "Wood dried on the rack", "A damp branch left raised in moving air has become usable dry fuel."); }
  if (w.structures.fire && noise(w.day, w.hour, 44) > 0.74) { w.structures.fire = false; addEvent(w, "world", "The fire fades", "Without more fuel, the small fire burns down to ash."); }
}

function updateWeather(w) { const x = noise(w.day, w.hour, 9); if (w.hour === 5 || w.hour === 12 || w.hour === 18) w.weather = x > 0.72 ? "rain" : x > 0.46 ? "cloudy" : "clear"; const daylight = Math.sin(((w.hour - 6) / 24) * Math.PI * 2); w.temperature = Math.round(52 + 10 * daylight - (w.weather === "rain" ? 7 : w.weather === "cloudy" ? 3 : 0)); if (w.weather === "rain") { w.resources.wetWood = Math.min(10, w.resources.wetWood + 1); for (const a of w.agents) a.needs.warmth = clamp(a.needs.warmth - 3); } }
function regrow(w) { w.resources.berries = Math.min(20, w.resources.berries + 2); w.resources.reeds = Math.min(18, w.resources.reeds + 1); }

export function tick(input) {
  const w = migrateWorld(input); updateWeather(w); const dnas = [];
  for (const a of w.agents) { const choice = chooseAction(w, a); const dna = createDNA(w, a, choice); dnas.push(dna); execute(w, a, choice.winner); }
  environmentTick(w); w.hour++; if (w.hour >= 24) { w.hour = 0; w.day++; regrow(w); } updateWeather(w); return dnas;
}
