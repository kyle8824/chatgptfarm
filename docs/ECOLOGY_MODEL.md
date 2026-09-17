# ChatGPTFarm Ecology Model

The ecology layer should create a believable basin, not manufacture encounters for entertainment.

## Core rule

Wildlife behavior is generated from species tendencies, local habitat, time of day, weather, needs, fear, recent state, and bounded randomness. Animals are never moved toward Mara or Ivo simply to create an event. Encounters should be an emergent consequence of independent movement through shared space.

## White-tailed deer

- Activity is weighted toward early morning and evening rather than evenly across every hour.
- Individuals retain feeding/resting routines for multiple world hours instead of selecting a new behavior every heartbeat.
- Deer use a broader habitual range than cottontails, with separate feeding/resting movement emerging from habitat points.
- Moderate human proximity should usually produce alertness and withdrawal; close proximity can produce flight.

Reference: Michigan DNR field observations describe deer as most active and observable in early morning and late evening. Penn State Extension likewise describes habitual feeding/resting areas and early-morning/evening activity.

## Eastern cottontail

- Cottontails are strongly crepuscular and spend much of daylight concealed in cover.
- Their local habitat network is intentionally tight. They should not wander across the entire basin.
- They freeze when a possible threat is detected at moderate range and bolt only when pressure becomes close.
- Open drinking water is not treated as a routine requirement; succulent vegetation can satisfy much of their water need.
- Rain reduces ordinary above-ground activity.

Reference: Penn State Extension describes cottontails as most active around dawn/dusk, closely associated with brush/edge cover, generally using a small home range, and rarely ranging far from protective cover. NC State Extension notes that succulent plants and dew can provide daily water needs.

## Black bear

- Bears use the broadest terrestrial range in the current basin.
- They are solitary and forage over large areas.
- Human proximity produces avoidance at substantially greater distance than for the smaller species.
- A bear-human event is recorded only for genuinely close proximity; the simulation should not steer a bear toward camp to create drama.
- Human food attractants are not assumed to exist unless canonical world state eventually contains them.

Reference: Michigan DNR states that black bears naturally avoid people and prefer large continuous forest habitat; DNR material also describes much larger home ranges for bears than the smaller mammals represented here.

## Tracks and sign

Tracks are not guaranteed every time an animal moves. Creation probability depends on species, movement distance, and substrate. Damp ground close to the creek is much more likely to preserve visible sign than dry open meadow. Sign ages and fades, with active rain accelerating loss.

The renderer may display only the clearer/recent subset of canonical tracks. It must not create visual tracks that do not exist in ecology state.

## Behavior persistence

Every heartbeat should not equal a new decision. Routine behaviors are held for multiple world hours when conditions remain compatible. Immediate threats, urgent thirst, or other strong need changes can interrupt that state.

This persistence is essential for the world to look like animals inhabiting territory rather than tokens being randomly repositioned.

## Future extensions

Seasonality, reproduction, mortality, predation, denning, mast/berry cycles, and migration should only be added when the world has canonical season/date and resource ecology capable of supporting them. They should not be approximated by scripted set pieces.
