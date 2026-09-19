# Living world rebuild — start here

Architecture map: [BLUEPRINT_IMPLEMENTATION.md](BLUEPRINT_IMPLEMENTATION.md). Read this alongside the latest checkpoint at the end of this file. The full Heavy blueprint has been reviewed; later sections remain in the implementation plan. User clarification: live-world outcomes are not manipulated for experiments; Decision DNA experiments use isolated copies.

Branch: `rebuild/survival-foundation`
Base: `25b8a7d5c7b1fdf0e883c64812b961a152462985`
Release status: **RELEASED v1.6.6 — runtime e614106; live verification passed at tick 448.**

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

F1/F2: local thermal effects, warmth/cover-seeking, exposure in AI context, bounded memory utilities, urgent food/fuel acquisition, critical repeat-action exemption implemented. Direct fire/rest heat bonuses removed.

Food access chunk: selectively adapted PR #8 region/site engine and coordinate/render quantity plumbing. Added three finite berry habitats (upland, woodland margin, eastern meadow), capacity 12 and regrowth 3/day each. People search habitat locations, identify familiar edible berries, remember private availability, and consume actual harvested inventory. No new art: existing berry-bush rendering reused; independent site quantities are displayed. Renderer changes are limited to resource quantities and associated QA; rejected clay branch excluded. Original PR #8 and chronicle remain preserved; do not merge PR #8 wholesale now because this branch incorporates and extends part of it.

Fuel finding: depleted dry-wood observations previously blocked return for 18 hours despite wood drying during that interval. Reinspection allowed after 4 hours (still no remote knowledge of actual quantity). This fixed the thermal regression introduced when people spent more time accessing food.

Validation: full npm test passed (original smoke, thermal, warmth decisions, survival decisions, forage-site tests). Region tests cover personal discovery, shared last-portion contention, independent resource pools, idempotent migration/regrowth, save reload, river clearance, fuel reinspection, and copied saved-state survival without modifying the source file. Runtime tests passed earlier; rerun status for this checkpoint is recorded below after completion.

72-hour COPY of baseline Day 6 22:00 world (not a verified current live snapshot): before food access, zero-agent-hours warmth=5, hunger=92, hydration=0; after food access + fuel reinspection, warmth=0, hunger=4, hydration=0 out of 144. After the first 12 hours, no zero survival meters in this scenario. Fresh-world regression also passes. This does not prove live AI judgment, all weather scenarios, or long-run population balance.

Release status: BLOCKED pending exact-commit CI/browser verification, authoritative runtime state/deployment identification, and migration check against that current state. Implementation checkpoint only; do not ask another model to invent ecology or visuals to make it releasable.

## Narrow release-agent handoff

Until this file says READY, do not merge or deploy PR #10. Do not modify game balance, generate artwork, reset world state, change secrets, or merge other feature branches as part of release.
When READY: verify named code SHA and CI; merge only this PR preserving newer accepted popup changes; deploy to the existing authoritative runtime without reseeding; verify public version, advancing ticks, retained identities/history and site quantities. Record failures and stop rather than improvising fixes. Record actual release result separately from Git merge.

## Next development work

1. Run exact-commit CI/browser checks. Inspect authoritative Cloudflare snapshot read-only and check additive migration against a copy.
2. Validate actual AI perception/choice integration; deterministic adapter tests are not model-quality evidence.
3. Before release resolve any viewer projection or site-action issues found; keep tests truthful.
4. Then F3 timing/navigation, followed by materials and construction experiment. Broader food variety (roots, seasonal plants, hunting) needs real identification/tool/ecology constraints and dedicated chunks. Do not claim berry habitats provide that variety.
5. Reconcile social transfer of site knowledge and food-pressure summaries in the viewer; current site discovery is personal but not yet shared by conversation.

Limits remain: shared camp knowledge, boolean fire/random extinguishing, coarse endpoint travel exposure, predefined search habitat locations and scripted legacy construction. No production state or UI artwork was changed.

## Release verification — supersedes earlier next steps

Code checked: c469168042ef7cd37dd08a98d43c5e2a4d31e297. Browser/recovery verify run 35414596230 PASSED; Cloudflare runtime validate run 35414596208 PASSED. Local runtime-test.mjs PASSED. PR #10 mergeable. Main-domain HTML still v1.6.5; no release performed.

Fetched current public Cloudflare /state read-only: tick 374, Day 19 14:00, lastAdvancedAt 2026-09-19T02:09:09.533Z. Migration of a COPY preserved exact IDs, needs, inventories, memories and history. A 72-hour candidate rollout after a 12-hour recovery window recorded 47 zero-warmth agent-hours, zero hunger/hydration zero-hours. This FAILS the current-state survival gate despite the older Day 6 fixture passing.

Starting resources: berries=0, dryWood=0, wetWood=0; shelter=true, fire=false. Mara carried dryWood=1/wetWood=58; Ivo dryWood=1/wetWood=65. Weather drying acts on world resources only; carried damp branches cannot dry. This is a concrete fuel-use gap, not a graphics task or reason to refill inventories.

HOLD RELEASE. Next: implement elapsed-time drying for carried/stored damp wood with weather/cover constraints, conserved quantities, save-safe timing and no double application after reload. Expose useful drying choices/observations where appropriate. Test a depleted-world scenario matching the above, then repeat the actual current-state rollout. Do not assume this alone fixes all thermal behavior; inspect decisions and effects. Rerun affected CI for the new SHA. Do not merge, deploy, reseed, or ask a release agent to invent this fix.

## Blueprint Chunk A — observation/time repair (latest checkpoint)

Implemented: affordance and wildlife observation functions no longer run initialization/migration; weather and environmental field sampling are pure exported functions; weather sampling no longer creates wet branches. Moisture/trace weathering moved to explicit advanceObjectEnvironment over a clock interval with a persisted watermark. Repeated migrations/synchronization do not weather objects or overwrite already recorded tree moisture. Runtime refreshes compatibility projections after executing actions, rather than during observations.

New tests pass: full-world equality across repeated observations in clear/cloudy/rain; frozen-world reads and samplers; repeat migration; no wood creation from weather sampling; one completed hour changes moisture once; duplicate/reloaded interval does not repeat effects; two hourly intervals match one two-hour constant-weather interval. Existing smoke, thermal, survival-decision tests passed. Runtime and Cloudflare controller tests passed, including downtime and failed writes. No renderer changes in this chunk.

KNOWN FAILING GATES, intentionally retained: removing accidental rain-created fuel exposes fresh-world warmth depletion (24 zero-warmth agent-hours in its 72-hour fixture) and copied Day 6 recovery warmth depletion (17 after recovery). Food/hydration remain nonzero after recovery. npm test therefore FAILS and this branch MUST NOT release. Earlier passing CI belongs to c469168, not this code. Do not weaken these tests or restore wood creation during weather reads to make CI green.

Chunk A is a checkpoint, not completion of all invariants: compatibility state synchronization still exists at explicit mutation/migration boundaries; component/material conservation, private remote knowledge, and arbitrary fractional-time integration remain future work. The new process preserves the existing coarse moisture rates and is not the unified material system.

Next task is blueprint Chunk B: conserved legacy wood batches with moisture and elapsed drying across ground/carried/stored locations; remove competing material authorities gradually. Preserve Day 19 inventory quantities and owners. Keep unknown provenance unknown. Build tested physical options (cover/spreading/storage) rather than adding a scripted drying-rack quest. Re-run the unchanged survival failures plus current live-state copy after that work. Keep release HOLD until gates pass.

## Blueprint Chunk B1 — tested raw-wood module (latest checkpoint)

Added engine/wood-materials.js and scripts/wood-materials-test.mjs. This is an ISOLATED module, NOT yet authoritative or connected to runtime actions. It does not fix the live fuel failure yet. HOLD remains, including the earlier failing survival tests.

Model: deterministic legacy import preserves raw dry/wet branch counts and holders, explicitly assuming 1 kg dry wood per legacy unit and water/dry-mass ratios .12/.55 (not historical measurements). Batches have stable IDs and split lineage; location is ground/carried/stored. Covered/uncovered moisture follows an elapsed exponential approximation using temperature, humidity and airflow. Tracks atmospheric water exchange separately from conserved dry wood. Transfer preserves quantities; explicit consumption records its sink and operation ID, with retry conflict checking. Rates require calibration before integration/release.

Focused test PASSED: Day 19 fixture imports 125 branches (2 dry + 123 damp) with original owners; transfers conserve material; covered wet wood dries while rain rewets exposed fuel; partitioned half-hour updates match one daily interval; duplicate/reloaded updates do nothing; invalid exposure/transfer is atomic; consumed wood and water remain accounted. Source world is not mutated. No new graphics, production changes or paid AI calls.

NEXT B2 integration checklist (do not just call integrateWood from finishHour):
1. Inventory every raw-wood write in core/runtime/physical-world/physical-materials and tests; choose ledger authority once, with numeric counts only projected for compatibility.
2. Implement transfers for gathering and unloading, accounted burn consumption, and real output accounts for poles/structures. Do NOT classify construction as a disappearance sink. Reconcile detached component IDs with batches; avoid duplicate material.
3. Versioned migration of existing counts and detached objects with explicit ambiguity policy; never silently double import represented branches or delete excess holdings.
4. Replace ground-only drying and conflicting object-moisture writes with one integration path; resolve actual holder exposure/cover before elapsed updates. Preserve weather/time watermarks across restart.
5. Give agents feasible storage/spreading options and observations without compulsory recipe progression. Existing cover is only a transitional coarse geometry model.
6. Wire focused module tests into npm test with integration tests, restore unchanged failing survival gates through physical processes, and verify current-state copy. Rates and supplies must not be tuned solely to force survival.

## Blueprint Chunk B2 — material command checkpoint

Implemented and tested transactional wood commands: gathering transfers existing batches; competing claims cannot overdraw supplies; retry IDs prevent duplicate application and reject conflicting retries. Cutting a branch into a pole and allocating wood to a shelter component retain material in output accounts, including moisture. Burning accepts dry raw branches and records consumption. These are material-account operations, not yet physical construction or autonomous behavior.

Added legacy carried-component reconciliation: detached wood entity IDs are associated with already counted inventory branches rather than imported a second time. Historical entity mass disagreement is explicitly retained as migration metadata; original counted mass is preserved. Unmatched entities stop migration instead of silently deleting or duplicating material. Reconciliation is idempotent.

Validation: wood-materials-test.mjs and wood-commands-test.mjs PASS, including saved-state import without source modification, retry/conflict handling, insufficient-supply atomicity, wet pole moisture, construction retention, burn accounting and entity reconciliation.

RELEASE HOLD. This module is still isolated from runtime. No production changes. Existing survival failures remain unresolved. Next: connect all raw wood consumers together (runtime gathering/fire/shelter, physical cutting/detaching/placing, environment drying/regrowth) to one authority; account for finite parent material when detaching; preserve output identity through later crafting; then connect elapsed exposure, agent options and integration tests. Do not enable ledger projection while legacy writes remain active, since it would silently overwrite those writes. Do not declare this checkpoint ready for a release agent.

## v1.6.6 candidate — integrated survival/material runtime (supersedes isolation status)

Wood ledger is now authoritative after migration. Gathering, physical branch detachment/placing/taking, raw branch shaping, pole/pointed-pole/composite transformations, shelter allocation, fuel storage and fire loading preserve wood mass. Compatibility inventory counts are projections. Legacy worked items and placed detached pieces have explicit one-branch mass assumptions; carried detached identities alias counted units. Resolved attached branch geometry claims the existing finite log supply, not extra wood. Trunk geometry remains an unmodeled material source; do not claim arbitrary harvesting is complete.

Elapsed weather affects ground, carried and stored wood. Shelter protects stored fuel. Random ground-only drying, weather-created wet wood and daily spontaneous dry wood have been removed. A small fire consumes .25 kg dry fuel/hour. Existing legacy fires retain one explicit hour of unknown historical heat on migration. Drying one branch beside fire is available both as an action and a heat primitive; .30 kg water/hour total is shared between actors, with atmospheric water accounted. Rates and heat transfer are coarse modeling assumptions, not validated thermodynamics. Stored damp material can be brought to the nearby fire, and locally stored dry fuel can feed ignition. No world resources or needs are refilled to make tests pass.

Fallback choices now consider preparing damp fuel when heat/cover exists, protecting dry supplies during rain, and lower confidence in repeatedly searching a previously depleted dry-wood supply. These remain utility heuristics, not persistent AI plans, generic construction, or proof of live model judgment. All former survival assertions remain unchanged. Smoke crafting fixture now obtains its branch through the material API instead of writing a projected counter.

Local validation PASSED: npm test (including all three wood suites, pure observations, smoke, thermal and unchanged survival/forage assertions); runtime timeline restart/concurrency/failure/downtime checks; Cloudflare controller alarms/pause/restart/failed-write checks; actual workerd persistence/alarm test; ecology, history and recovery QA. Cloudflare packaging dry run passed before adding build identity/settings preservation; exact candidate CI remains required.

Public state fetched read-only at tick 439, Day 22 07:00, updated 2026-09-19T04:51:39.533Z. A 72-hour COPY under fallback recorded warmth=0, hydration=0 depleted agent-hours, food=5 during initial recovery (both started at zero food). After the existing 12-hour recovery window, all three depleted counters were zero. The older Day 19 copy also recovers. Source state remains unchanged. Run scripts/survival-audit.mjs <snapshot-file> --assert-recovery for the explicit gate; never write the simulated copy to production.

Release preparation: v1.6.6 cache/version identifiers, runtime /health and /state build identity generated from deployment checkout SHA. Wrangler keeps dashboard variables and no longer overwrites AI_ENABLED/model/budget with preview defaults (code defaults still apply for new installs). Existing FarmWorld / preview-v1 identity and secrets unchanged. Reference: https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth .

STATUS: CANDIDATE, NOT YET RELEASED. Await exact-commit CI/browser checks and verified deployment path. Main observed 25b8a7d5c7b1fdf0e883c64812b961a152462985; no other model's clay changes included. Do not reset the Durable Object, seed from the audit copy, or claim this is the complete open-world blueprint. Remaining blueprint work includes real travel/labor, learned plans/skills, generic assemblies, richer ecology, scalable archives and visual modernization.

Release ownership: automatic schedule/push triggers removed from legacy GitHub advance-world workflow. Manual execution requires explicit WORLD_RUNTIME=github-legacy configuration; absent that, it cannot create a parallel world or spend on old-world AI calls. Cloudflare remains the public authority.

## Release gate completed

READY: code 8e72759ab3c8ee9d83601a3560e60dfcf06712ce passed Cloudflare Runtime Validation run 35422782393 and Living World Recovery QA run 35422782454. Both completed successfully. The next commit only records evidence and a public-state export; runtime code is unchanged. Recheck its CI before merging. Latest Day 22 10:00 copy also passed the 72-hour recovery gate. Deployment must still be verified separately. See docs/releases/v1.6.6.md.

## RELEASED — resume here

v1.6.6 is live. Engine release/PR #10 merge: e61410696ff6285efcd22bf0f65e6c711310b026. Cloudflare /health and /state confirm that SHA. Vercel and main-domain HTML confirm v1.6.6. Final PR CI passed at 9e19a63. A stale post-merge v1.6.3 text assertion was repaired in 8711d03 (production validation now PASS; no engine change).

At tick 448, the new ledger is persisted and mass balances; world time advanced from predeployment tick 442, original identities and recent histories remain. Public reads do not alter the ledger. Details and evidence: docs/releases/v1.6.6.md and v1.6.6-live-verification.json. Source world was never reseeded or replaced. All earlier HOLD entries describe superseded checkpoints.

The runtime still reports fallback decisions / zero AI calls. Dashboard configuration was preserved, not changed. Next phase must verify the actual AI path and durable completed-event/decision evidence before claiming learned autonomous planning. Follow the full blueprint, especially subsequent travel/labor and personal learning stages. Do not discard accepted UI, the new wood authority, regional foraging, or existing people/history.

## v1.6.7 continuity fixes — candidate, not released

User observed late berry habitat, waiting between transitions, stale goals and confusing satiety. Fallback goals now derive from the actual chosen action in both runtime paths. Transition preparation migrates a private copy BEFORE copying before/after, making new habitat visible before movement without publishing outcomes or mutating the prior checkpoint. Browser requests the next transition at its deadline (12-second polling remains fallback), retries late responses at one-second minimum intervals, restores the HUD after connection recovery, and reports genuine late updates. Hunger is 100 minus legacy satiety, with reversed warning colors and WATCH ranking. Internal save semantics unchanged.

Read-only live history confirmed Day 22 14:00 talk/wood decisions at zero satiety before regional foraging became available; subsequent search/forage/eat decisions still carried stale warmth goals. Existing survival tests cover food priority and finite supplies. The update does not claim continuous-time physiology, real physical travel/labor, or active AI. Those remain blueprint work.

Release gates: exact candidate CI/mobile browser QA and worker deployment identity still required. Preserve FarmWorld/preview-v1, history and dashboard settings. Never reseed.

## v1.6.7 RELEASED — current resume point

PR #11 merged as 46bcfc0293a1ab96c1920fde7038bd1040dda5ed. Both candidate checks, postmerge validate/visual, Workers Builds and Vercel passed. Main page and runtime confirm v1.6.7. Live tick 459 confirms both new fallback goals match actual actions after predeployment buffered decisions finished. World continued from tick 456; identities and recent memories preserved. Evidence: docs/releases/v1.6.7.md and v1.6.7-live-verification.json.

No blocker to this release remains. Next substantive work is still the full blueprint: truthful cognition/decision evidence, physical travel and labor, incremental needs effects and learned plans. Runtime still uses fallback; do not claim live AI or continuous physical action resolution. User feedback specifically prioritizes believable food seeking, existing visible habitat and uninterrupted lived activity.

## C1 durable evidence — development checkpoint after v1.6.7

Branch: foundation/durable-decision-evidence. Tested code 1213ee2. HOLD RELEASE; no production changes. Full blueprint read. Exact decision inputs/proposals/validation and completed event segments now have atomic Cloudflare persistence, retry/conflict protection and an archive outbox. Public AI diagnostics distinguish configuration and budget/error paths; authenticated evidence reads exclude unfinished outcomes. Existing identities, art, world and material rules preserved.

Full checkpoint, tests and remaining gates: [checkpoints/durable-evidence.md](checkpoints/durable-evidence.md). Local engine/runtime/real-workerd tests and current tick-468 copied-state survival passed. Hosted CI pending when written. External archival is not configured; reflection/plan parity and live AI configuration diagnosis remain unfinished. Do not call stage C complete, increase AI spend, merge or deploy this checkpoint as a release. Next integrate those C prerequisites, then resumable physical travel/work and incremental effects. Production remains v1.6.7.
