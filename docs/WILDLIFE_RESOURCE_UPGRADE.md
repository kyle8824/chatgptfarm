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

## Checkpoint 2: resources and open construction code

- Existing trees, resource patches, creek, regional berries and wildlife expose
  current server stats in the scene and journal. Additional mapped deposits
  have a once-only finite stock with initial/remaining/harvested accounting.
  They do not refill old accounts. Villagers discover the new nodes through
  actual proximity, and search when an unfinished plan lacks known materials.
- AI design calls now request source code, not a predefined building type.
  construction-js-1 is a bounded interpreted JavaScript subset with variables,
  functions, loops, arithmetic and part() output. It never runs in the Worker
  host, browser, eval or Function. Source and rejected attempts are persisted.
  /live/design/:id exposes generated source without resending it every frame.
- New programs use any descriptive purpose. Generic measured geometry grants
  rain cover, finite supply surfaces/enclosures, accessible sheltered rest and
  low deck walkability. A name alone cannot confer a function. Existing saved
  declarative projects remain supported without replacing their parts/work.
- AI may choose among reachable local clearings generated around its position
  as well as existing sites. Shapes are axis-aligned boxes and vertical round
  posts; timber, stone, reeds and supported clay daub are physical materials.
  New mechanics, arbitrary host code, rotating machinery and engineering-grade
  loads are not implemented. Limits: 48 emitted pieces, 160 material units,
  16,000 interpreter operations, 128 loop iterations, 8 function call levels.
- Actual shared use gives bounded trust/memory feedback. A designer observes
  use locally; spectator totals do not become omniscient villager memories.
  Later AI prompts carry the villager's own code and observed use feedback.
- Gathering, carrying and per-part work still supply all materials and labor.
  No piece appears built because its generator ran. Generic covered storage
  connects to the existing wood-moisture system and weather exposure.
- No increased AI-call caps or checkpoint frequency. Program/source additions
  are covered by the existing adaptive persistence byte budget.

Verification: open-construction-test exercises actual code interpretation,
invalid/host-access programs, measured capabilities, physical gather/assemble,
weather exposure, depletion, pure inspection, feedback and restart. Existing
settlement/design/runtime checks protect legacy work. Resource-browser-test
renders and selects real geometry on desktop and mobile in isolated CI.
