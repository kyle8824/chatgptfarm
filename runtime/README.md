# Persistent world runtime — deployment candidate, not live

The static viewer currently consumes GitHub snapshots. GitHub scheduled jobs have
run hours apart; playing one recorded transition cannot make that architecture a
continuous simulation. This service owns a shared, persisted action timeline.

## Run

Use Node 22+, one process, and a persistent disk (not Vercel function storage).
Start with `WORLD_DATA_DIR=/persistent/world PORT=8787 node runtime/server.mjs`.
`WORLD_SEED` defaults to `world/state.json` and is imported only when no checkpoint
exists. Preserve a copy of the latest canonical world before cutover.
`OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_REASONING_EFFORT` use the existing mind
adapter; absent credentials use the explicitly identified utility policy.
No credentials belong in the browser or repository. Model calls time out after
10 seconds so a hung request cannot hold the engine indefinitely.

Serve this process behind HTTPS. `WORLD_ORIGIN` defaults to
`https://www.chatgptfarm.com`. GET `/state` returns the world and active movement
interval; `/health` returns the current timeline status. Both are read-only.
The process advances without visitors. Each world hour lasts 150 seconds, matching
the current young-world pacing of two hours per five minutes.

A checkpoint contains the last completed world and its in-progress transition.
Future inventory, memories, resource changes and decision outcomes are withheld
until completion. The checkpoint is synced to disk and atomically replaced before
publishing. Startup restores it, catches up in bounded batches, and refuses a
second local writer. Do not run multiple replicas sharing separate disks.

## Cutover gates (not performed)

1. Provision a persistent host, HTTPS, automatic process restart and disk backups.
2. Stop the GitHub advance workflow, capture its final state, seed the runtime from
   that state, and verify matching world IDs, memories, DNA, inventories and time.
   Never leave two canonical writers active. Existing `/api/control` writes to
   GitHub; runtime control synchronization must be implemented before cutover.
3. Configure `window.CHATGPTFARM_RUNTIME_URL` before loading the Phaser script.
   The branch defaults to the existing source until explicitly configured. When
   configured, it fails visibly rather than reverting to a different GitHub world.
4. Verify sustained mobile viewing, object selection, pinch zoom, a second browser,
   a reload, restart and a save failure against the hosted service. Do not merge or
   call the live world fixed before these gates pass.

## Known unfinished work

The engine is still hourly and evaluates the next action at a transition boundary.
AI planning can delay the next transition by up to ten seconds per person. Buffered
planning and smaller physical simulation steps are needed for uninterrupted action.
Physiological action constraints, species-specific locomotion and task animations
still need work. The viewer currently interpolates shared paths and tilts sprites
for active tasks; this is not a finished natural-behavior renderer. Rest/hide/freeze
activities do not receive task animation. This PR does not solve those gaps by
pretending decorative motion is a complete simulation.

## Verification

`node scripts/runtime-test.mjs` checks real wildlife coordinate changes, shared
restart state, concurrent reads, withholding unfinished outcomes, failed writes,
and recovery after eight hours without viewers. `npm test` checks the existing
engine. These tests do not constitute live browser or deployment verification.
