# ChatGPTFarm v0.4

A persistent artificial world where agents accumulate private experience, make bounded decisions, experiment with physical materials, teach one another, and leave a Decision DNA trail behind behavioral change.

Public world: https://www.chatgptfarm.com/

## North star

> The world should become more believable because agents accumulate experience — not because developers manually add story content.

Humans define physics, resources, constraints and the simulation contract. Agents determine what happens inside those rules.

## Current architecture

`WORLD → LOCAL PERCEPTION → MEMORY RETRIEVAL → MIND → VALID ACTION → PHYSICS → CONSEQUENCE → MEMORY → DECISION DNA`

The world engine owns truth. The AI mind never directly edits world state, invents resources, or decides whether an action physically succeeds. It receives only an agent's local perception, a bounded set of retrieved private memories, beliefs/traits, recent experience, current goal and the actions that are physically available.

The mind returns structured fields only:

- selected action ID
- current goal
- intent
- short decision summary
- confidence
- memory IDs that materially influenced the choice

No private chain-of-thought is stored or displayed.

## What exists now

- One shared canonical world persisted in `world/state.json`
- Automatic GitHub Actions heartbeat every ~5 minutes
- Accelerated origin phase so early history accumulates quickly
- Two agents: **Mara** and **Ivo**
- Separate perception, memories, beliefs, skills, experiments and inventories
- Needs: hydration, satiety, energy and warmth
- Weather, finite resources, structures and fog-of-war exploration
- Relationship state and deliberate knowledge/technique transfer
- Experimentation with stone, clay and reeds
- World-first discoveries while knowledge remains local to the discoverer
- Emergent sharp-stone, cordage, clay-vessel and related capability chains
- Repetition penalty and novelty pressure to prevent endless survival-loop optimization
- OpenAI model mind adapter with deterministic fallback
- Schema-constrained action proposals
- Invalid model actions are rejected and replaced with a physically valid fallback
- Per-decision Decision DNA context including retrieved memories and mind metadata
- Provisional model counterfactual replay with a referenced memory removed
- Daily model reflection hook for persistent beliefs/reflections
- Public **Mind Observatory** showing goals, intents, explicit decision summaries, beliefs, confidence and whether the AI overruled the fallback utility ranking
- Four-world-day deterministic smoke test plus API-free fake-mind tests before canonical heartbeat changes are committed

## Brain modes

### AI mind

When the repository has an `OPENAI_API_KEY` Actions secret, the scheduled runner uses the bounded model adapter in `mind.js`. The workflow currently requests `gpt-5.6-luna` with low reasoning effort for frequent decisions.

### Fallback brain

If the key is absent, a model request fails, the response is invalid, or the proposed action is not physically available, ChatGPTFarm continues using its deterministic fallback policy. The canonical world therefore never depends on model availability to keep living.

Every Decision DNA record states which brain mode made the choice.

## Turn on the real AI mind

Do **not** paste an API key into source code or into the public website.

In GitHub for `kyle8824/chatgptfarm`:

1. Open **Settings → Secrets and variables → Actions**.
2. Choose **New repository secret**.
3. Name it exactly `OPENAI_API_KEY`.
4. Paste an OpenAI API key as the secret value.
5. Save it.
6. Open **Actions → Advance ChatGPTFarm World → Run workflow** to trigger an immediate heartbeat, or wait for the next scheduled run.

After a successful model-driven heartbeat, `world/state.json` will report `mindConfigured: true`, `mindMode: "ai"`, the model name, and increasing `aiDecisions`. The public Mind Observatory will expose the non-sensitive decision metadata automatically.

## Decision DNA v0.4

Each consequential decision records:

- agent and world time
- local observation
- retrieved private memories
- physically available candidate actions
- selected action
- fallback utility rank and factors
- brain mode/model
- current goal and intent
- explicit decision summary
- confidence
- referenced memory IDs
- counterfactual memory replay results

For model decisions, a single-memory replay is currently marked **provisional**. A later version should repeat stochastic replays and compare action distributions before treating an influence estimate as strong evidence.

## Guardian rule

Decision DNA and Guardian debug the **agent architecture**, not the story.

Guardian may identify behavioral drift, stale or unusually influential memories, contradictory beliefs, suspicious sources, and counterfactual repairs. It should not decide that Mara ought to invent agriculture, that Ivo should befriend Mara, or what civilization should become.

## Growth rule

Add new physics because existing agent behavior creates a reason for them, not because a developer wants to reveal the next level.

Examples:

- repeated wet-fuel failures can justify a drying mechanism
- carrying limitations can justify containers
- long journeys can make portable water consequential
- repeated material experiments can reveal new affordances

There is no quest tree and no prescribed civilization.
