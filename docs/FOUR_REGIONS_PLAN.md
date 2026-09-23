# Four regions and model comparison

Approved by Kyle on 2026-09-23. Continue incrementally from the existing live
world. Preserve its identity, people, inventory, projects, clock and history.

## Intended result

- One continuous world around 4–5 times the current width and length (16–25
  times the area), with four separated home basins and substantial wilderness.
- Mara and Ivo retain their existing valley; three unrelated adult duos begin
  in distant viable regions. First contact is discovered, never scheduled.
- Physical rivers, ravines and terraces; useful crossings and climbing routes
  must be constructed from real supplies. Distance, provisioning and load
  limits make expeditions consequential.
- Locally distinctive useful materials with implemented properties and
  processing. Every initial region can meet elementary survival needs.
- Independent households, personal surnames, persistent ancestry and significant
  historical records. Romance and births remain autonomous.
- Physical barter after actual encounters, with local knowledge, ownership and
  finite goods. No remote transfers or advance knowledge of other settlements.
- Three Llama households and one OpenAI household for an observational model
  comparison. Each person retains separate memory and decisions. Identical
  world rules and decision opportunities; record model, outcomes and usage.

## Order and release gates

1. Repair repeated rejected designs; verify design → gather → craft → build,
   plus informative reasons when a project cannot proceed.
2. Generalize the map, physical geography, local resource accounts and routing.
   Preview journeys and mobile rendering before enabling the expansion.
3. Add households, founder records, surnames, kinship, local discovery and a
   persistent chronicle; preserve the original valley and identifiers.
4. Integrate materials, expedition goals, crossings and physical exchange.
5. Add provider routing and usage budgets. Keep the existing 30-minute action
   and 60-minute design cadence. The existing 96-total/24-design daily budget
   cannot fund eight adults at every opportunity: make allocation explicit.
   Do not silently raise the limits or enable paid calls without a configured
   credential and an explicit bounded budget.
6. Exercise eight adults and descendants, save/reload and catch-up, mobile
   rendering, first contact and supply conservation before each live release.

## Known limits before expansion

The initial construction blocker is invalid model designs, not an absence of
the building engine. The latest six observed proposals were rejected for
ownership or lexical-binding errors. Existing terrain height is mostly visual;
the navigation model is planar. Several routines assume one camp or two people.
General add-ons to completed designs, climbing and barter need implementation.
Current recent journals are bounded and are not a permanent lineage archive.

The selected biological year remains 60 world days (10 real days at 6×).
A newborn reaches 18 after 180 real days. Natural mortality is not implemented.
No model upgrade, cadence change, world reset or forced family milestone is
authorized merely to make a demonstration succeed.

## Implemented release

PR #47 repairs rejected design retries. PR #48 implements a 500 × 500 world
(25 times the original area), an additive versioned migration, four independent
households, observed first contact, useful regional materials, physical barter,
supported climbing and crossing routes, surnames and persistent ancestry.

Migration is gated by `FOUR_REGIONS_ENABLED=true`. Once migrated, the saved
world remains expanded even if the flag is removed; it is not a reset switch.
Existing identifiers, people, supplies, projects, clock and creation timestamp
are retained. Three new homes get finite starting supplies, not replenishment.

The global daily cap remains 96 calls including 24 designs, allocated as 24
calls / 6 designs per household. Action/design eligibility remains 30/60 real
minutes. Ochre Vale uses the OpenAI Responses adapter only when all settings
are present: `OPENAI_API_KEY` (secret), `OPENAI_MODEL`, `OPENAI_DAILY_USD`,
`OPENAI_INPUT_USD_PER_MILLION`, and `OPENAI_OUTPUT_USD_PER_MILLION`.
Optional `OPENAI_REASONING_EFFORT` must suit that model. Missing configuration
keeps local autonomous behavior active and makes no provider call. Token costs
are conservative reservations reconciled with returned usage; failures retain
reservations. This is an observational comparison, not a controlled experiment.

Verification covers a full world day with eight adults, additive save/reload,
finite supply conservation, an autonomous new-home resting-mat build after a
fixture proposal, actual proximity-based contact and barter, and completed
supported treads opening a previously blocked climb. Real workerd exercises
alarms, WebSockets and durable restart; browser fixtures exercise all four
regions on mobile and desktop. Provider HTTP is mocked: no paid OpenAI call
or live autonomous inter-household meeting is claimed by these checks.

Long-distance settlement growth remains emergent. Rivers require physical
crossings; ridges and ravines can also be circumvented through wilderness.
Climbing currently supports built treads, not animated vertical rope ladders.
Automatic whole-building extensions and natural mortality remain future work.
