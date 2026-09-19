# Living world rebuild — start here

Branch: `rebuild/survival-foundation`
Base: `25b8a7d5c7b1fdf0e883c64812b961a152462985`
Release status: **BLOCKED — implementation checkpoint, not a release candidate.**

## Instructions for the next model

Read this file first. Inspect the remote branch and working tree before editing. Never infer release readiness from a commit, passing syntax check, or previous chat claim.
Kyle authorizes releases of verified chunks. Another chat model may release a chunk only when its entry explicitly says READY, identifies the tested code commit, and has no outstanding release gates. Recheck that exact commit's CI and current main before merging. Record the merge and actual runtime deployment separately. Never reset or reseed the live world.
Checkpoint each coherent chunk to GitHub with updated evidence. If interrupted, continue from the last checkpoint rather than starting over. BLOCKED means do not release.

## Preserve

- Existing world, identities, memories, history, and accepted popup improvements.
- Do not promote `ui-clay-bank-redesign` or rejected clay graphics.
- Regional foraging: PR #8, head ad15c5a8c092506e75afe95fbfb6ce7c266fa044, unmerged at last check.
- Chronicle: feature/world-chronicle, commit 602935995d1e1ef38fcbe19ee96ae03032c4ada6. Foundation only.
- Keep those branches intact; integrate after foundation behavior is verified. Do not merge stale PR #5 wholesale.

## Product contract

Needs motivate action; there is no scripted shelter quest or guaranteed civilization progression. AI proposes plans and designs; engine-owned material constraints determine outcomes. Learning follows observations and results. Future villages have different resources, personal knowledge, and opportunities for voluntary exchange. Rendering is a replaceable view of persistent simulation state.

## Chunks and acceptance gates

- [ ] F1 Thermal causality: local fire benefit, shelter protection, explicit breakdown, tests for remote agents and cold/rain. Initial implementation in progress; coarse location semantics only.
- [ ] F2 Survival decisions: trace hunger to food acquisition/eating; bound memory bonuses; evaluate AI and fallback separately without forcing a shelter recipe.
- [ ] F3 Travel/action timing: reachable terrain, duration, arrival before effects; replace endpoint-based exposure with time spent at locations.
- [ ] F4 Materials/tools: finite components, properties, wear, operations, validated consumption and skill effects.
- [ ] F5 Construction experiment: restricted declarative designs, support/coverage checks, real labor, visible assemblies, failure and revision memory.
- [ ] F6 Durable completed-event archive and chronicle integration.
- [ ] F7 Integrate preserved region expansion; test long-run survival, reload and migration before second settlement.

## Release gates for each behavioral chunk

Focused causal tests; existing engine/runtime tests; CI/browser checks; explicit limitations; saved-state compatibility; verify authoritative deployment branch; live outcome verification without resetting state. Passing UI tests does not establish believable survival behavior.

## Latest checkpoint

F1: local thermal effects, exposure in AI perception/Decision DNA, warmth/cover-seeking options, removal of direct fire/rest heat bonuses implemented and tested. Still coarse hourly camp positions.

F2: capped accumulated memory utility contribution at 12; removed repetition penalties for critically low survival needs; increased urgency of food acquisition when no edible food is carried, and dry-fuel acquisition when cold without an existing fire or enough fuel. These are fallback preference changes, not compulsory AI actions or a shelter quest. AI retains its validated action choice.

Validation: complete npm test passed, including original smoke, thermal, warmth decisions, and new survival-decision-test.mjs. Tests cover 120 water memories not overriding urgent food gathering, actual inventory consumption before hunger recovery, repeated survival actions, absent supplies producing no food, urgent fuel, and deterministic AI adapter contracts. runtime-test.mjs passed. Fresh-world 72-hour fallback scenario still has zero depleted warmth/food/water agent-hours.

Read-only diagnostic scripts/survival-audit.mjs runs a COPY of world/state.json. Source at baseline is Day 6 22:00, not verified live Cloudflare state. Both people already have zero hydration and satiety; berries and dry wood are depleted. Before F2, a 72-hour copied rollout recorded warmth=9, hunger=96, hydration=0 zero-agent-hours; after F2: warmth=5, hunger=92, hydration=0 out of 144. This is still unacceptable food availability, not a passing survival result. Original state file was never changed.

Supply finding: two daily berry portions at +28 satiety each provide 56 total points/day; two people lose 201.6 points/day at 4.2/hour each. The existing accessible berry source alone cannot sustain them. Additional resources must become discoverable and usable, not silently refill inventories or reset hunger.

Release remains BLOCKED: unresolved saved-world scarcity and discovery/acquisition behavior, exact-commit CI/browser checks, and authoritative live runtime checks. Actual AI quality has not been evaluated (only deterministic adapters). Camp knowledge remains global; fire remains a boolean with random extinguishing; travel exposure is endpoint-based; scripted construction remains until F4/F5.

Next exact task: inspect preserved PR #8 region/site adapter and existing physical search/dig/hunt paths. Design a small food-access chunk using finite known/observable resources and personal discovery, with a copied saved-world scenario. Preserve memories and state. Integrate selectively, avoiding unrelated renderer or rejected clay changes. Do not hide supply failure by weakening survival checks.

Release handoff: once implementation blockers and pre-deployment checks pass, mark READY with exact code SHA and deployment instructions for another chat agent. Post-deploy live verification should then be recorded as a separate release outcome; do not require a deployment before authorizing the first deployment.
