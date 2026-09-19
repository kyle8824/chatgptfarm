# Elapsed live-world preview — NOT production

Separate branch `preview/elapsed-live-world`. Production main, deployment branch, Worker and FarmWorld / preview-v1 are untouched.

## What is implemented and tested

`elapsed.mjs` advances only an elapsed duration, limited to six simulated seconds per step. It retains unfinished actions. It does not create a transition.after, next-hour buffer, or future frames. Needs, food portions, travel and work change during actual execution. New needs and route conditions are checked on the next step. Current engine recipes, ecology and visuals remain coarse; this is a runtime correction, not finished open-ended cognition.

`controller.mjs` owns a persisted wall-clock cursor. Independent one-second Durable Object alarms advance only to observed wall time at 6x simulation speed. Snapshot reads are pure. Atomic checkpoints preserve current state and the next wakeup. Downtime catches up past elapsed time in bounded chunks. It never runs into future time. `worker.mjs` targets a separate `chatgptfarm-live-lab` Worker, `LivePreviewWorld` class and `isolated-live-lab-v1` object. It has no production bindings. Owner events require PREVIEW_ADMIN_KEY.

Tests: `node live-preview/test.mjs`; `node live-preview/workerd-test.mjs` with cloudflare dependencies installed. Both passed: no future state, partial meals, restart, urgent interruption after starting work, new rain, pure reads, real workerd autonomous alarms without visitors, authenticated events and restart persistence. Wrangler packaging dry-run passed.

## Current deployment limitation

The autonomous server is NOT deployed. The existing Workers Builds connection is locked to the production Worker; no separate Cloudflare deployment credential is available. Do not remove or bypass its Worker identity check and do not repoint production. A separate Worker connection or authenticated deploy is needed. Then run `node live-preview/build.mjs` and `wrangler deploy --config live-preview/wrangler.jsonc`. Never use cloudflare/wrangler.jsonc for this preview.

The root preview page instead runs the exact elapsed-step engine in a browser Worker, saving the separate copy in IndexedDB. It is explicitly labeled as browser-hosted and pauses when closed. It is not proof of a deployed autonomous server. It never calls or writes the production runtime. The bundled snapshot is a read-only copied spectator state (tick 486); its future diverges and must never be imported back into production.

AI is NOT configured in either preview. NPC utility rules choose actions. Model credentials are a separate dependency, and neither mocked tests nor fallback behavior count as proof of working live AI.

## Promotion status

NOT READY FOR PRODUCTION. Kyle requested a separate demonstration before choosing whether to promote. No merge or promotion is authorized by this preview. Remaining gates: separate server deployment; hosted unattended progression and event tests; configured bounded AI calls and truthful failure status; broader survival/balance review. No promise that enabling AI alone delivers learning or generic construction.
