# v1.6 Weather Memory

Goal: weather must leave temporary canonical history in the basin instead of existing only as a one-tick visual effect.

## Rules
- Canonical simulation owns wetness and creek response.
- Rain raises surface wetness and creek level; clear/cloudy conditions dry them gradually rather than instantly.
- Ecology uses the canonical wetness state when deciding how likely tracks are to form and how they decay.
- Renderer visualizes the canonical field only; it does not invent rain aftermath.
- Decision DNA continues to receive only bounded agent perception; no new global weather omniscience is introduced.

## First slice
- `environmentState.surfaceWetness` (0..1)
- `environmentState.creekLevel` (relative 0..1)
- `environmentState.lastRainAt`
- persistent soil-moisture and water-depth fields derived from those values
- track suitability tied to wetness/substrate
- dynamic wet-bank / puddle presentation derived from the canonical field
- QA proving rain aftermath persists after weather returns to clear and then dries gradually
