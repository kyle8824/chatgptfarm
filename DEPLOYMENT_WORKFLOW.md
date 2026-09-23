# Deployment workflow

Vercel automatic Git deployments are enabled only for `main`. The `**: false`
rule covers development branches, including names with slashes; `main: true`
keeps production releases enabled. Keep this `git.deploymentEnabled` block in
both `main` and `repair/continuous-runtime`, and in any branch revived from an
older commit, before pushing it. The configuration is read from the pushed
branch, so old branches without it can still trigger previews.

Run focused logic checks and builds in the workspace. Browser verification
workflows start their own temporary server in GitHub Actions and upload their
screenshots; they do not require a Vercel deployment. Saving development
commits and running those workflows should not publish another preview.

Use hosted previews only when phone feedback or hosting-specific verification
is needed. A manual Vercel deployment can still create a preview when access
is available. Merge or fast-forward a tested set of changes to `main` for one
production release. Runtime releases still use the existing Cloudflare Workers
Builds integration on `repair/continuous-runtime`; these are separate from
Vercel deployments. Do not deploy runtime changes merely to run a test.

Do not replace this with an Ignored Build Step to conserve deployment count:
that cancels after deployment creation and still counts against deployment
limits. No routing, world identity, or simulation state is changed by this
configuration.
