# ChatGPTFarm v0.1

A persistent artificial world built as a living testbed for Decision DNA.

## North star

> The world should become more believable because agents accumulate experience — not because developers manually add story content.

## What v0.1 proves

- One persistent agent: **Mara**
- Small physical environment: creek, food, wood, stones, weather, temperature, unexplored edges
- Internal needs: hydration, hunger, energy, warmth
- Limited inventory and resource depletion
- Actions chosen by a transparent utility model
- Persistent natural-language memories
- Learned behavior can alter later decisions
- Every consequential choice emits a Decision DNA record
- Each record contains candidate actions, factors, observation context, and leave-one-memory-out counterfactual tests
- World history persists in browser `localStorage`
- No backend, API key, framework, or database required for v0.1

## Simulation loop

`WORLD → PERCEPTION → MEMORY → DECISION → ACTION → CONSEQUENCE → MEMORY`

## Why the first agent is transparent instead of an LLM

The first milestone is not to generate interesting prose. It is to prove that the simulation loop and Decision DNA instrumentation are correct and inspectable. Once that foundation is trustworthy, a later version can add a constrained LLM policy and repeated stochastic counterfactual trials.

## Next milestones

1. Durable server-side world state
2. Scheduled autonomous ticks so the world continues when nobody is watching
3. Deterministic replay snapshots
4. Constrained LLM policy adapter
5. A second agent with separate perception, memory and communication
6. Guardian drift detection and diagnosis
7. Expanding world mechanics justified by emergent agent behavior

## Important constraint

Decision DNA should debug the **agent architecture**, not steer the story. Guardian can diagnose an overweighted memory or broken reasoning policy, but it should never decide that Mara ought to invent farming or build a house.