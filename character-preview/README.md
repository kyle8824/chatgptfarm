# Permanent model workshop

`/character-preview/` remains available independently of the running world and Cloudflare storage. It previews controlled animations, never connects to LiveValley, and never saves or advances the simulation.

The canonical assets and touch controls are `shared/visuals/models.js` and `shared/visuals/map-controls.js`. Both this workshop and `web/live/scene.js` import those modules. `character-preview/models.js` is only a compatibility re-export. Keep the shared files identical on the Worker deployment branch (`repair/continuous-runtime`) and Vercel branch (`main`) when releasing improvements. The live task adapter in `web/live/people.js` adds actual drinking, work, rest, carrying and selection behavior; workshop animations do not drive the simulation.

Run `npm ci --prefix character-preview` and `npm run build --prefix character-preview`. Commit the generated `vercel-public/character-preview/` assets on `main`, which Vercel serves without a build command. Preserve the root Worker rewrite. Both URLs with and without the trailing slash work.

## Controls

One finger pans. Two fingers pan by moving their midpoint, zoom by changing their separation, and rotate by twisting. All three work simultaneously. The point beneath their midpoint stays anchored through the transform; adding/removing a finger rebases without a camera jump. The world uses the terrain plane; the workshop uses a plane through the subject so close-up views remain usable. Mouse left-drag pans, right-drag orbits/tilts, and the wheel zooms. The preview retains named front/side/back views.

## Geometry and performance

The accepted people retain their geometry and appearance. Separate backpack and ankle groups support actual carrying and planted feet. Mara uses 18,324 triangles / 17 meshes; Ivo 17,012 / 17. The deer uses 9,228 / 13. Its torso and neck form one connected deforming surface, with leg roots embedded inside the body. Moving the head cannot expose a neck-cylinder cap. Static surfaces are merged per animated group and share a vertex-color material. The budget is 20,000 triangles / 18 meshes per person and 10,000 / 16 per deer, before shadow passes.

Balanced mode caps device pixel ratio at 1.35 with a 1024 shadow map; Detail uses up to 2 and 2048. The full valley also caps pixel ratio at 1.35, retaining its 2048 map for the larger scene. All geometry is original procedural mesh work; there are no external model downloads, large textures, cloth simulation or strand-hair effects. A future bear and other species should share this approach and be evaluated in the complete scene. The twelve-model load option remains a rendering stress sample, not a live population.

Verification renders the actual models and full valley in Chromium on desktop/mobile viewports, exercises combined touch gestures, tests selection and task poses, and captures all-around deer grazing views. CI software-rendering FPS is not a physical-phone benchmark. The user's earlier 60 fps workshop reading does not establish the full world's frame rate; sustained device testing remains relevant as the world grows.
