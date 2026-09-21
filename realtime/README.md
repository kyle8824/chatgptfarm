# Live valley (/live/)

An independent continuation of the existing ChatGPTFarm world. The original
`FarmWorld` class, `WORLD` binding, `preview-v1` object, original root viewer,
and canonical world file remain intact. Never replace either world with a seed
on reload or deploy, and never import the live fork back into the original.

## Execution contract

- `LiveValley` owns one authoritative in-memory simulation and SQLite checkpoint.
- A 100 ms server timer executes only elapsed wall time at 6x simulation speed.
  Each substep is at most 100 ms wall time / 0.6 simulated seconds.
- A separately persisted one-second Durable Object alarm advances and saves the
  world with no viewers, and wakes it after eviction. Platform scheduling is
  best effort, not hard real-time. Catch-up is limited to past elapsed time.
- WebSocket packets contain current executed positions, needs and actions.
  The viewer smooths only between received positions for up to 100 ms. There
  is no future-state timeline, prerecorded action sequence or database poll.
- Persistence checkpoints normally occur each second. A crash can lose the
  unsaved fraction of a second, then catch up from the last saved wall cursor.
  Alarms and checkpoint data commit together. Connection/lag are exposed.
- No clock or physics runs in the browser. A closed browser cannot pause the
  server. The viewer stops character movement when frames stop arriving and
  shows a connection interruption instead of a green live status.
- Wildlife positions also advance on the server. Cosmetic water, cloud,
  limb and rain animations are rendered locally.

## Fork and history

The first request copies the current original world using its internal binding.
The complete imported snapshot is compressed into immutable `origin:*` storage
keys before initialization. People, memories, inventory, material quantities,
structures and world time come from that copy. Hot historical material sinks
are summed without changing accounted mass; duplicate suspended tasks are
collapsed. The complete pre-migration record remains in the origin archive.

This fork has capped working history inherited from the engine. It is not an
unlimited audit archive or independent disaster-recovery backup. Do not claim
those features are implemented.

## Cognition

Workers AI binding `AI` supplies `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Each person
requests a proposal every 30 wall minutes (failed calls retry after two minutes), with a total hard cap of
96 calls per UTC day. Requests have bounded input and 180 output tokens. Calls
are reserved durably before sending. Calls never block physical simulation.
Only a currently available action can be applied at a task boundary; urgent
needs and NPC rules continue between calls. Failed or stale proposals do not
become AI-controlled actions. UI/health show actual calls, successes, applied
proposals and errors. A configured binding is not proof of successful inference.

This is bounded model planning plus an NPC survival system. Reflection, open-ended structure
creation, richer ecology and long-term survival balance remain unfinished.
The valley renderer is stylized 3D, not photorealistic. Trees/terrain dressing
outside known resources are scenery, not a complete individual-tree ecosystem.

## Operation

Production remains the existing Worker `chatgptfarm`, deployed by Workers Builds
from `repair/continuous-runtime`. Build: `npm ci --prefix cloudflare` then
`node cloudflare/build.mjs`; existing deploy uses `cloudflare/wrangler.jsonc`.
The additive migration creates `LiveValley` without renaming/deleting `FarmWorld`.
The new route is `/live/`; diagnostics are `/live/health`, `/live/state`, and
`/live/geometry`. WebSocket path is `/live/ws`. There is no public reset/edit API.

Tests: `npm test`, `node realtime/test.mjs`, `node realtime/workerd-test.mjs`.
The `Realtime world verification` workflow additionally uses the actual workerd
server and a browser to check desktop/mobile rendering, person and animal
positions, inspection, journal, and progression after every browser closes.
Screenshots and measured results are in its `realtime-world-evidence` artifact.
Source CI is not hosted verification. Verify the deployed route after publishing.
