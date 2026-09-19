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

F1 code checkpoint: engine/thermal.js now owns hourly cold/rain/fire/shelter effects. Fire heats camp occupants only; shelter reduces cold and blocks rain at camp; weather observation no longer applies repeated bodily rain damage. Each agent records the latest before/after and contributing effects. No UI changes, world-state files, or clay graphics changed.

Verified locally: focused thermal scenarios passed; existing npm test (syntax + smoke) passed; runtime-test.mjs passed (timeline, wildlife, restart, concurrent reads, save failure, downtime). The focused test was also added to npm test. No production deployment or browser verification performed.

RELEASE BLOCKERS: removing remote fire heat increases exposure for traveling people. Add and verify a deliberate warmth-seeking option and assess survival before release. Existing make_fire/rest direct warmth bonuses still need reconciliation with the thermal model. Need AI perception of exposure, decision traces, and balanced scenario tests. Hourly endpoint location is an approximation, not continuous distance or travel exposure. Fire remains a legacy boolean with stochastic extinguishing, not a fuel simulation. Do not call this foundation complete.

Next exact task: inspect candidateActions/retrieveDecisionContext and runtime executeKnown. Provide a feasible warmth-seeking choice without imposing a shelter quest; expose current thermal conditions; test cold people choose an available remedy and that outcomes are physically local. Then reconcile direct action heat effects and run the release gates above.
