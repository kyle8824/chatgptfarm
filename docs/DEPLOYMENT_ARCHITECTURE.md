# ChatGPTFarm deployment architecture

## Authorities

- `main/world/state.json` is the canonical persistent timeline. Heartbeats advance this file; releases must preserve it.
- Renderer milestone versions (for example `v1.6.3`) describe the Phaser presentation/behavior release.
- World-model versions (for example `object-field-0.9`) describe canonical simulation schema. They are intentionally separate version systems.

## Production flow

1. The scheduled `Advance ChatGPTFarm World` workflow advances canonical state and commits `world/state.json` to `main`.
2. Heartbeat commits remain part of the permanent world history but are ignored by Vercel's build step. A heartbeat must never require a site rebuild.
3. Code releases are integrated onto a branch created from the newest `main` heartbeat. `world/state.json` is never replaced by a stale feature-branch copy.
4. After validation, the release branch is merged forward to `main`. Schema migrations must be idempotent and operate on the existing canonical state.
5. `/` is the current Phaser living-world renderer. `/legacy.html` preserves the previous Pixi Object World for emergency comparison only.

## CI contract

Production CI is read-only. It validates committed source, ecology/living-history invariants, the renderer cutover, and browser behavior. It does not apply patch scripts and does not commit generated source.

This separation keeps code releases from rewinding history and keeps autonomous heartbeats from churning deployment history.
