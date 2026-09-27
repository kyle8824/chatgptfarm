# Construction lab

`/live/build-lab/` is an isolated, browser-owned experiment. It imports the farm's actual compiler, site validation, staged construction, finite inventories, movement, survival, comfort, thermal and rendering modules. No production world snapshot is mutated, no second live world runs on the server, and no simulation loop runs when the lab is idle.

Choose a scenario, compare planning instructions, request one design, inspect validation, adopt it, advance bounded simulated time, and measure use. Manual JSON construction programs also work. Six comparisons and the current experiment persist in browser storage; JSON exports retain inputs, model responses, usage, validation, baseline state and measured outcomes. Credentials are never saved/exported. AI output is nondeterministic, but restoring a baseline restores the same starting state. The lab is a controlled single-person fixture, not proof of social emergence or long-term production balance.

The optional nearby-site experiment adds three candidate footprints around camp. Each still goes through the production `issuedLocalSite` clearance/route checks. It does not change `buildingSites` in the live world. Geometry preview and predicted labels do not grant functions; actual completed pieces and use are measured separately. Directed rest tests are labeled experimenter actions, not autonomous AI decisions. Regular action selection uses the existing rule engine between explicit AI design calls.

## AI and budget

The public Worker routes `/live/build-lab/api/*` to a separate `BuildLab` Durable Object. It has no production-world bindings in its service logic and never calls Cloudflare AI. Existing `ADMIN_KEY` authenticates each request, and existing OpenAI model/key/rates are reused. Paid provider usage still shares the OpenAI account and its rate limits. It does not consume/reset the farm's application-level AI budget.

Hard maximums: **$0.10 per UTC day and 12 calls**, 15-second cooldown, 3,500 output tokens, 90 KB request body. Optional `BUILD_LAB_DAILY_USD` and `BUILD_LAB_DAILY_CALLS` can lower these limits but cannot raise them. A durable conservative reservation precedes inference. Unknown outcomes retain reservations; request IDs are idempotent; no automatic retries. Usage mismatches halt further requests. Provider credentials remain server-side.

Use the same owner password originally configured as the Worker's `ADMIN_KEY`. The lab displays budget/model after authentication. API access fails closed if credentials or pricing configuration are missing. Browser editing/simulation needs no key.

## Verification

`node build-lab/test.mjs` verifies actual finite construction/use, retained additions, site switches, validation parity, durable budgeting, authentication and failures.

`node build-lab/build.mjs` bundles the lab using existing Cloudflare dependencies. `node build-lab/dev-server.mjs` serves a LOCAL TEST ONLY provider at localhost:4186 with password `local-lab-test-key`; this server is never deployed. `node build-lab/browser-test.mjs` verifies the UI/API/assembly/use/persistence flow with that clearly labeled provider fixture. It never spends real API credits. CI separately verifies the real Worker runtime and binding configuration.

The lab is built by `cloudflare/build.mjs` and published with the existing runtime release. `/live/*` is already proxied by the public domain, so the static Vercel branch needs no release. The existing live-world journal links to the lab.
