# Deploy the Cloudflare preview from your phone

This deploys a separate preview. It does not replace chatgptfarm.com, change DNS,
or stop the existing GitHub world. The preview copies the latest saved world once
and advances its own history. We will verify it before planning a production cutover.

## Cloudflare dashboard

Open https://dash.cloudflare.com/ in your phone browser. Under **Workers & Pages**,
create a **Worker** and choose the option to import/connect a Git repository.
Select `kyle8824/chatgptfarm` and use these settings (labels may vary):

| Setting | Value |
| --- | --- |
| Project / Worker name | `chatgptfarm-runtime-preview` |
| Branch | `repair/continuous-runtime` |
| Root directory | `cloudflare` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Use Workers, not a static Pages project: this deployment contains a Durable Object.
The repository config creates its SQLite-backed storage binding automatically.
Use the free plan. No custom domain or paid upgrade is needed for this preview.

If the import flow initially selects main, change its branch to
`repair/continuous-runtime` before running the build. Keep other-branch deployments
disabled for this preview Worker so another branch cannot replace it.

## Set the setup password

After deployment, open the Worker's **Settings → Variables and Secrets**.
Add **Secret** `ADMIN_KEY` with a long, unique password you choose. Save and deploy
that change. Do not post it to GitHub or send it in chat.

Leave `AI_ENABLED=false` initially. This avoids paid API calls while verifying
hosting and makes the preview's rule-based decision source explicit.

## Start and inspect

1. Open the provided `https://chatgptfarm-runtime-preview.…workers.dev/setup.html`.
2. Enter your `ADMIN_KEY` password and tap **Start preview from saved world**.
3. Tap **Watch preview**. The same Worker serves both the viewer and world state.
4. Visit `/health`: `initialized` should be true. After about five seconds,
   `planned` should become true. The tick should increase about every 150 seconds,
   including while the viewing tab is closed.
5. Send the public workers.dev address back in this chat so we can verify the hosted
   preview. Do not send the password.

The setup page also has Pause and Resume. Repeated Start attempts cannot overwrite
an existing preview. Redeploying preserves the preview's Durable Object state.
Changing the Worker name, class migration, or object name can create different
storage; keep those names unchanged.

## Optional AI after the hosting check

In Worker settings, add Secret `OPENAI_API_KEY`, then set `AI_ENABLED=true`.
The default limit is 100 attempted decision calls per UTC day, configurable with
`AI_CALLS_PER_DAY` (0 disables calls; maximum 2000). After that limit, decisions
use the existing fallback policy. Calls are reserved in durable storage before
sending requests. This is a request-count limit, not a dollar spending limit.
AI API billing is separate from Cloudflare hosting. No key is required for the
initial hosting test.

## What this preview does and does not prove

The adapter saves compressed checkpoints and their next alarm atomically. It buffers
one future action, survives instance eviction, retries after failures, and catches
up after downtime without issuing a burst of paid model requests. Completed state
is held separately from in-progress movement. Each viewer follows the same timeline.

Natural task/species animation and stronger physiological constraints remain work.
The engine is still hourly underneath; this is a hosting and persistence preview,
not the completed living-world experience. Existing GitHub AI controls do not yet
control this separate preview. Production cutover needs one canonical writer,
a final current-world import, control integration, and hosted mobile verification.

## Maintainer verification

From repository root:

```
npm ci --prefix cloudflare
npm test
node scripts/runtime-test.mjs
npm test --prefix cloudflare
npm run test:worker --prefix cloudflare
npm run check --prefix cloudflare
```

The workerd test exercises the compiled Worker with real SQLite Durable Object storage,
automatic alarms, authentication, and a process restart.

Free-plan limits still apply; measure storage writes and requests in the preview
before claiming the workload can run indefinitely for free.

The dry run validates Cloudflare bundling and bindings without deploying. The
controller test covers alarm retries, eviction, actual coordinate changes,
duplicate initialization/delivery, pause/resume, failed writes, and eight-hour
catch-up. None of these local checks is a substitute for the hosted checks above.
