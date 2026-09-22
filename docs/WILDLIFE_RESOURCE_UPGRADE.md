# Wildlife and resource upgrade checkpoints

Authority stays LiveValley / LIVE_VALLEY / live-valley-v1. No reset, new world,
namespace, checkpoint cadence, extra AI call, or population replacement.

## Checkpoint 1: wildlife

- Shared bear, cottontail and representative creek fish models in the live
  renderer and permanent workshop. Existing people and deer are preserved.
- Server-owned elapsed movement, persisted per-animal random state, decisions,
  fear decay, local compatible-deer associations, personal space, cottontail
  freeze/flight/cover, solitary bear retreat and cornered warning, channel fish.
- Hunger, energy and thirst progress in simulated hours. Drinking requires bank
  reach. Ground browsing is an abstract vegetation supply in this stage.
- Existing fish entities represent schools; their small visual followers are
  members of that aggregate, not newly spawned persistent animals.
- No combat, reproduction, seasonal rut, migration or predator kill simulation.
  These are bounded species rules, not wildlife language-model calls.
- Model budgets: bear <12k triangles /14 meshes, rabbit <9k /14, fish <3k /14.
  Balanced renderer pixel ratio remains capped at 1.35. No phone-fps promise.

Biological references (rules are simplified for this small simulated valley):
- https://animaldiversity.org/accounts/Sylvilagus_floridanus/
- https://animaldiversity.org/accounts/Odocoileus_virginianus/
- https://www.nps.gov/subjects/bears/black-bears.htm
- https://www.nps.gov/subjects/bears/safety.htm

Verification: realtime/wildlife-test.mjs, realtime/visual-assets-test.mjs and
character-preview/browser-test.mjs. Browser CI screenshots must be reviewed
before release. Isolated fixtures never seed or write the production world.

## Next checkpoint

Selectable natural objects and wildlife; real resource quantities and gathering
sources in construction; extend useful construction choices without free parts.
