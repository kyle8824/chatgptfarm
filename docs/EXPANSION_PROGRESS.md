# Expansion checkpoint

Status: implemented locally and engine-tested; NOT DEPLOYED. Branch: feature/region-foraging.
Base: 789c02f9ab088e150f2bab4a6834b7fd66c29ec8, latest main at checkout, including v1.6.5.

## Completed
- Additive region/site registry retains existing basin coordinates and saved world history.
- Upland berry thicket with independent finite supply, daily regrowth, per-person discovery and depletion memory.
- Survey and forage choices available to the AI decision menu and fallback policy; gathering yields actual existing berry inventory usable for eating/sharing.
- Site knowledge can transfer through the existing conversation memory system.
- Playback resolves new site coordinates; renderer uses independent site quantity.
- npm test includes migration/discovery/harvest/regrowth/reload tests.

## Verification actually run
- npm test / original smoke suite passed before adding the region test to the npm command.
- node scripts/regions-test.mjs passed separately.
- node scripts/runtime-test.mjs passed.
- 168-hour fallback run: both people learned the site, 22 forage actions, 59 eat-berries actions, no runtime exception. This is not proof of balanced survival or natural navigation.

## Remaining before release
- Run full CI/browser QA and inspect new-site terrain/path and popup availability. No browser visual verification yet.
- Verify Cloudflare deployment branch and current authoritative world; deploy engine to actual runtime, not only the Vercel viewer. Do not reinitialize or replace saved state.
- Region adapter is incremental: legacy actions remain singleton-based; multiple-region travel is not implemented.
- Existing travel is interpolated; new site does not introduce route finding.
- No chronicle reader or narrator yet. Existing discovery/action events are recorded as future source evidence.
- Preserve v1.6.5 UI, never merge older PR #5 wholesale.

## Next work / safe smaller tasks
1. Browser verification of thicket rendering, independent quantity and agent arrival.
2. Expand test coverage for social knowledge transfer and concurrent depletion.
3. Chronicle reader prototype in separate files with clearly labeled fixtures; no production story claims.
4. Add completed-event archive and significant-event selection before generating narrative.

Update this file with exact commits and test results at each checkpoint. See EXPANSION_CHRONICLE_HANDOFF.md for long-term design.
