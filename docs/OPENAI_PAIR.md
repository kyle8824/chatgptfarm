# OpenAI planning for Mara and Ivo

The live Worker assigns Willow Basin's household (Mara and Ivo, and inherited
household membership) to OpenAI. The other three households use Cloudflare Llama.
This is independent of where people travel or settle. Deployment configuration
overrides the earlier saved Ochre assignment without rewriting ancestry or quotas.

## Activation

In Cloudflare, open **Workers & Pages → chatgptfarm → Settings → Variables and
Secrets**. Add a **Secret** named `OPENAI_API_KEY`, then save/deploy it. Keep its
value out of source files, logs and chat. GitHub's Actions secret is separate from
the Worker's runtime secret.

The September 23 read-only GitHub Actions check confirmed that `OPENAI_API_KEY`
exists and can access `gpt-5.6-luna` (HTTP 200). It made no paid generation request.
The live Worker's `/health` reported `providerConfigured:false`. GitHub does not
have `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` secrets for an automated
transfer. A valid model-access response does not prove remaining account credit.

Non-secret settings are deployed from `cloudflare/wrangler.jsonc`:

| Setting | Value |
| --- | --- |
| `OPENAI_HOUSEHOLD` | `willow-basin` |
| `OPENAI_MODEL` | `gpt-5.6-luna` |
| `OPENAI_REASONING_EFFORT` | `none` |
| `OPENAI_DAILY_USD` | `0.10` |
| `OPENAI_INPUT_USD_PER_MILLION` | `0.20` |
| `OPENAI_OUTPUT_USD_PER_MILLION` | `1.20` |

Model availability, structured output support, `none` reasoning and the base
token rates were checked against the
[official GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
Reasoning is disabled to leave the existing small output allowance for the actual
decision JSON. Action/design output ceilings remain 180/2,600 tokens.

## Existing limits are preserved

- Each household shares at most 24 requests per UTC day: 18 action and 6 design.
- Global ceilings are 96 total and 24 design requests per UTC day.
- Per-person eligibility remains every 30 real minutes for actions and 60 for
  designs. Existing failure cooldowns remain unchanged.
- Actual requests also require available choices/sites, adult eligibility,
  appropriate needs and remaining reserved dollar allowance.
- Switching providers does not clear consumed requests or failed reservations.
  Willow's historical 42 total / 24 design count on September 23 exceeds the
  subsequently introduced household share; it is preserved. New calls wait for
  the normal 00:00 UTC reset even after the key is attached.
- The original archived simulation stays disabled. No paid tests, forced model
  decisions, budget resets or world-state resets are performed by this release.

## Viewer and verification

The selected person's model appears below the camera selectors. Their inspector
shows assigned provider/model, configuration or allowance status, household usage,
and the source/model of the current action separately. A previously saved Llama
action is not relabeled as an OpenAI decision. Routine behavior still runs between
model requests.

`/live/health` exposes missing configuration **names only**, never values. Check
that Willow reports OpenAI, the other three report Cloudflare, and Willow's
`missingConfiguration` becomes empty after activation. `configured` proves runtime
settings are present; a later successful recorded request is needed to prove
generation. Do not confuse the read-only model check with a live villager call.
