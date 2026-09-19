# ChatGPTFarm deployment authority

The live world is owned by the existing Cloudflare Worker `chatgptfarm`, Durable Object class `FarmWorld`, object name `preview-v1`. Never rename or reseed it. `world/state.json` is a legacy/export fixture, not the current live authority. The legacy GitHub advance workflow is disabled unless WORLD_RUNTIME is explicitly configured as github-legacy.

The Vercel-hosted `chatgptfarm.com` viewer reads the public Worker state at `chatgptfarm.kyle8824.workers.dev`. Site builds and runtime builds are separate; a merge alone is not evidence of deployment. Check Worker /health and /state.runtime.build against the release merge, and check the main-domain HTML version. Preserve dashboard settings with keep_vars and existing secrets.

The runtime commits its checkpoint and alarm atomically. v1.6.8 adds persistent tasks and five-minute elapsed substeps within the existing hourly save cadence; future substeps remain private. Completed diagnostic events/decisions commit in the same transaction and retain a bounded 256-transition window. Permanent external archival is deferred and must not be represented as complete.

Production CI is read-only. Release a verified coherent candidate from current main; record exact code, CI, merge, actual deployment and live continuity separately. Accepted UI changes do not authorize rolling back simulation history. Use forward repair for action-schema problems.
