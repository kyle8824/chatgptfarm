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

## Verified checkpoint — 2026-09-19

Candidate `682e8ed60a2248f5fa8ce14f1f7d4cc3f4e7a205` passed GitHub Actions run 35429764312, including the actual mobile browser and real workerd tests. Artifact `elapsed-preview-evidence` includes the mobile screenshot and browser report.

Browser-only preview URL: https://chatgptfarm-h6tmzuztq-kyle8824.vercel.app (existing Vercel authentication applies; sign in with the project-owning account). Its application source is identical to candidate; the subsequent commit added tests only. Cloud browser reached the login wall; functional browser verification was performed in CI against the exact source, not claimed against the authenticated deployment.

Verified unchanged production refs: main `88e0a6599dc5aef612b781e9a814ece94c9c395e`, repair/continuous-runtime `17a473447f7e68f27684ad891aade214bc2f597a`. No production deploy, merge, reseed or runtime write performed.

User's full request remains INCOMPLETE: no remotely deployed unattended preview server, no connected live AI. The step engine has an adapter interface but asynchronous/bounded model decision scheduling is still required in the live controller. Do not describe this as only needing to flip AI_ENABLED. The preview is useful evidence of elapsed execution, not fulfillment of the autonomous AI world request.

## Visible-motion correction — 2026-09-19

Kyle reported nobody moved in repeated visits. Earlier QA proved changing needs but did not assert rendered travel. Replaying the seed showed a very short initial walk followed by roughly 100 seconds drinking at 6x, with Mara doing longer stationary work. This explains a static-looking opening but is not proof of the cause on Kyle's device.

Candidate 977731e7d0a30f7e92638aaad36fa8ba0d6ee4a8 adds visible work progress, selectable 6x/24x clock, stopped/error status and worker request timeouts. The renderer interpolates between received positions for elapsed-only snapshots. No future positions are computed. Browser QA now selects 24x and requires a villager's actual canvas position to move >30 pixels within 45 seconds, then verifies changing needs, immediate rain, restart and no page errors. Run 35438965050 PASSED including real workerd tests. Vercel deployed successfully.

Updated preview: https://chatgptfarm-61sxcvyfy-kyle8824.vercel.app . The previous immutable deployment URL does not receive this fix. Vercel login still applies. The deployed page has not been interactively verified through that login; exact-source browser QA passed in CI. Autonomous hosting and connected AI remain incomplete. Production unchanged.
