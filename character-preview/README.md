# Character study 01

An original browser-rendered art and animation prototype for Mara, Ivo and a white-tailed doe. This is separate from the production world; it does not connect to LiveValley, request world state, perform AI calls or save anything. All animation here is a deliberately controlled preview. The production characters are unchanged.

The source is in this directory. Run `npm ci --prefix character-preview` and `npm run build --prefix character-preview` from the repository root. The resulting self-contained static viewer in `vercel-public/character-preview/` is served by Vercel at `/character-preview/`, independently of Cloudflare world storage. Commit the generated viewer with source changes. Do not change the root rewrite or replace the production renderer to publish this study.

## Shared art direction

Softly shaped faces, inset almond eyes, adult proportions, sculpted hair clumps, practical clothing, matte surfaces and warm daylight. Wildlife uses similarly smooth silhouettes with recognizable anatomy rather than box bodies. All geometry is original code-authored mesh work. No external model licenses, generated-image stand-ins, large textures, strand-hair effects or cloth simulation are involved. These are working procedural models, not yet a finished imported/skin-weighted GLB asset set.

Static pieces are merged per moving joint into a shared vertex-color material. The initial budgets are 20,000 triangles and 16 meshes per person and 10,000 triangles and 16 meshes per deer. The current two people plus deer use roughly 44,000 model triangles and 42 model draw calls before shadow passes. The production baseline measured from `web/live/people.js` is Mara: 14,384 triangles / 51 visible meshes, Ivo: 13,928 / 52. This preview is Mara: 18,324 / 14, Ivo: 17,012 / 14, deer: 8,952 / 14. These mesh counts describe geometry organization, not a proven frame-rate improvement. Lighting, vegetation, shadow passes and pixel density also cost GPU time and must be included when evaluating performance.

Balanced mode caps device pixel ratio at 1.35 with a 1024 shadow map. Detail mode caps it at 2 with a 2048 shadow map. The optional twelve-model load is a rendering stress sample, not a simulation population or proof of full-world performance. Frame rates are measured in the viewer's own browser. CI uses software rendering and mobile viewport emulation, not a physical phone. Long sessions on the target Samsung phone and integration with the complete valley are still required before choosing final settings. A future bear and other species should use this same material/geometry approach and be evaluated as part of the total visible scene, with simpler distant models when needed.

## Before production integration

Review the actual models from all sides. Refine contact animations (feet, held supplies, hands at the creek), merge them with the existing state-driven action animation and selection contract, and verify them with animals and the complete environment. Preserve world identifiers, collision/body clearance, storage and server simulation. A successful art preview does not establish production behavior or phone performance.
