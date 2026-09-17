# ChatGPTFarm Renderer Truth Contract

The renderer is a projection of the canonical simulation. It may make the world more legible, atmospheric, and visually compelling. It may not create gameplay facts.

## Authority boundaries

1. **Canonical world state owns reality.**
   Terrain, structures, resources, wildlife, tracks, weather, agent locations, discoveries, actions, and consequences must exist in canonical state before the renderer depicts them as real.

2. **Decision DNA owns behavioral provenance.**
   A visible agent action or intent cue must resolve to the current canonical Decision DNA record. The renderer must not infer a different choice, motive, or outcome from animation.

3. **Physics owns consequences.**
   Rendering an interaction does not make it successful. Success/failure and world mutations come from the deterministic engine/physics outcome recorded by Decision DNA.

4. **Presentation offsets are non-canonical.**
   Small screen-space/world-pixel offsets may keep sprites from visually overlapping structures or one another. They must never be written back as canonical coordinates or used by perception, physics, memory, or Decision DNA.

5. **Ambient decoration cannot impersonate mechanics.**
   Wind, smoke, water shimmer, bird silhouettes, grass motion, shadows, and similar atmosphere may be procedural when they communicate no new mechanical fact. Tracks, shelters, fires, discoveries, tool use, wildlife encounters, injuries, resources, and constructed objects are not ambient decoration and must be state-backed.

## Decision DNA renderer contract

At minimum the renderer/QA must preserve alignment with:

- `decision_id`
- `agent_id`
- `action` / `action_label`
- `mind.intent`
- `mind.brain_mode`
- `baseline_policy_action`
- `deviated_from_policy`
- `physics.outcome`
- counterfactual records when present

The renderer may summarize these fields for spectators, but must not rewrite their meaning.

## Living-world projections

State-backed world storytelling should be preferred over dashboard UI. Examples:

- canonical wildlife traces rendered using their real position, heading, species, age, and clarity;
- an agent's latest action/intent shown adjacent to that agent using the latest Decision DNA record;
- canonical structures changing appearance only when their underlying state changes;
- world discoveries becoming visible only after discovery state/events exist;
- wildlife behavior and movement matching the ecology simulation rather than looping decorative animations.

## QA invariants

Every substantial renderer iteration should fail QA if any of the following occur:

- scene construction does not finish;
- `renderEntities()` or movement helpers disappear;
- expected agents/wildlife are missing;
- rendered wildlife traces differ from canonical active traces;
- the visible latest-decision cue points at a different Decision DNA ID than canonical state;
- trees or other solid decoration occupy canonical water in violation of occupancy rules;
- required art assets silently fall back when the iteration expects them;
- browser/runtime errors occur;
- presentation changes mutate canonical world state.

## North star

**The renderer may make reality beautiful; it may not create reality.**

The product should feel increasingly like a living place because the simulation produces richer facts worth seeing, not because the renderer invents a scripted game on top of the simulation.
