# Expansion and Chronicle — durable handoff
Updated: 2026-09-18
Status: DESIGN / IMPLEMENTATION NOT STARTED. No simulation or UI release made by this checkpoint.

## User direction
Preserve the latest UI cleanup from the other model. Make the starting basin a small part of a world intended to grow over years. Add meaningful environmental opportunities, not forced quests or decorative motion. AI agents choose actions under real world constraints. Add a readable, book-like chronicle of significant actual events. Save progress frequently so another chat can work on bounded tasks.

## Verified source checkpoint
Reviewed main at d7acaec0547448d2433e3e32cdcdb3fd3beefeea.
- engine/decision.js uses fixed resource zones and a short action menu; repetition penalties already exist.
- engine/affordances.js enumerates fixed known zones and named object IDs.
- cloudflare/world.mjs owns a separately persisted timeline; initialization refuses replacement.
- docs/DEPLOYMENT_ARCHITECTURE.md still describes GitHub as canonical; runtime/README.md describes an older pre-cutover state. These documents alone do not establish current production authority.
- PR #5 feature/character-inspector remains open at inspection. Do NOT blindly merge it: user reports newer UI changes elsewhere.
- Existing local chatgptfarm-live worktree has unrelated modifications. Do not reset, overwrite, or publish it wholesale.
Release baseline resolved: GitHub confirms PR #7 merged as a28b3faefb1cbfc309a64a1fa88b98e174d29b43; current main/index.html identifies LIVING WORLD · v1.6.5 with JS/CSS revision 001605000. User reports Vercel, Cloudflare validation and browser QA passed and canonical state preserved; those checks were not independently rerun in this checkpoint.
Preserve popup closing, AGENTS NOW panel, memory-chain prevention, object/campfire information, bare AI indicators/model information, live status wording, removal of stale action labels, and shelter layering. PR #5 is older work, not the expansion baseline. Start from latest main including subsequent world heartbeats. Confirm actual production state source and writer before any migration.

## Proposed milestone: a richer starting region
1. Introduce a backward-compatible region/site registry: stable region IDs, stable site IDs, positions local to region, typed resources and material properties. Wrap the existing basin without changing its coordinates, identities or history.
2. Replace singleton resource assumptions incrementally with discoverable site instances. Knowledge is agent-local; AI must not see undiscovered global resources.
3. Deliver one complete opportunity loop before adding many features: discover alternative forage -> inspect/test -> harvest -> eat/share/store -> record consequences and knowledge. Existing species/resources can be reused initially.
4. Add useful camp projects after that: drying wet wood, food storage, shelter maintenance. Inputs, time, weather, durability and failures must affect real state. No automatic scripted construction sequence.
5. Expand to adjacent regions through geographic reachability and agent knowledge, not arbitrary quest gates. Keep nearby simulation detailed; design bounded coarse updates for distant regions. Do not simulate an entire continent every tick or send it all to the model.

## Chronicle contract
Working title: The Chronicle of Willow Basin.
- Event ledger is authoritative; prose is a derived, read-only presentation.
- Entries carry stable event IDs, world/timeline ID, region, simulation time, participants, type, verified outcome and causal references.
- Publish only completed outcomes, never buffered future plans.
- Select first discoveries, useful inventions, consequential failures, major relationship changes, migrations and environmental changes. Deduplicate routine activity and repeated retries.
- Group into chapters with short titles and a readable narrative. Provide expandable source events.
- Do not invent dialogue, emotions, motives, ancient history or success. Motives may be attributed only when recorded in the decision.
- Backfill only from retained evidence; label gaps instead of inventing missing history.
- Store generated prose once, idempotently, with source IDs and narrator version. Use bounded batches and a separate narrative budget; narration failures never block simulation.
- Archive older events/chapters in paginated storage; do not grow the frequently fetched world snapshot indefinitely.
- Reading the chronicle must never advance time or change decisions.

## Small independent tasks for another model
A. Chronicle reading UI against an explicit fixture: chapter list, readable mobile page, source-event disclosure. No changes to engine/runtime/state; fixture visibly marked.
B. Unit tests for event selection and deduplication against agreed event fixtures.
C. Accessibility/mobile fixes on confirmed current UI branch, without changing simulation.
D. Correct deployment documentation after checking actual production routing and writer.
Use separate branches; record exact touched files. Do not concurrently edit shared engine/runtime files.

## Acceptance gates
- Existing save migrates twice with no resets or duplicate sites.
- Agents can discover and use a second site without global knowledge leakage.
- New activities consume/produce real inventory and valid spatial movement; no decorative substitutes.
- Multi-day seeded runs quantify repeated failed attempts, action diversity, visited sites and survival; do not demand variety at the expense of survival.
- Chronicle entries resolve to completed source events; retries/restarts do not duplicate chapters.
- Simulation, runtime persistence and mobile interaction checks pass before release.
- Preserve production history. Never seed from a stale feature branch.

## Checkpoint protocol
After each completed/tested unit and before release: commit work to its task branch and update this file with branch, commit, changed files, tests actually run, failures, deployment status and exact next step. Mark untested/incomplete work explicitly. Never record secrets. Commit early; usage limits can interrupt without warning.

## Next exact step
Release identification is complete. Reconcile production authority, then create a fresh expansion branch from latest main (v1.6.5 or newer) and implement the region/site compatibility layer with migration tests. First user-visible milestone: a second discoverable forage site with real harvesting, knowledge and consequences. Chronicle reader can proceed independently against fixtures.
