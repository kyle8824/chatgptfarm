# Structure workshop

Permanent page: `/structure-workshop/`. Shared renderer:
`shared/visuals/structure-model.js`, also used by `SettlementView` in the world.
The workshop reads a world snapshot once on open and on explicit Refresh. It
never opens a socket, runs simulation time, executes construction source, or
sends a mutation to the Worker. The last readable catalog is cached on the
device and clearly labeled when offline. A separate authored example is always
marked as an example; it is not evidence of a production villager decision.

Each project has a linkable ID, rationale, measured physical functions, original
code, access, recorded use feedback, material accounting and assembly pieces.
Finished-design and recorded-progress views use the exact same physical parts.
Required/used/site/missing quantities use simulation material units, not kg.

Appearance drafts change only four material colors, timber shade variation and
roughness. They never alter mesh coordinates or physical project fields. Drafts
persist locally; Export/Import uses a strict appearance schema bound to the
project ID and full immutable design signature. Progress does not invalidate a
look, but changed geometry/materials/dependencies do. There is deliberately no
public endpoint for promoting a draft into the live world.

To release an approved look: add its exported document to `STRUCTURE_LOOKS` in
`shared/visuals/structure-looks.js`, keyed by project ID, in both deploy branches.
The shared renderer applies it only when the design signature matches. Rebuild
and test the workshop, release both branches, and verify the published assets.
This is the same review/release process used for the people and animal models.

Build: `npm ci --prefix character-preview && node structure-workshop/build.mjs`.
Static output lives under `vercel-public/structure-workshop`; it works while
the authoritative world is quota-blocked. No hosting identity or budgets change.
Checks: `node structure-workshop/test.mjs` and the isolated browser workflow.
Actual WebGL runs in CI; do not try to launch local Chromium in this workspace.
