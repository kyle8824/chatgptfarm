# Llama free-compute allowance

Kyle requested using close to the free Workers AI allowance instead of stopping
each duo at 24 calls. The replacement is a shared **9,500-neuron UTC-day target**
for this world's Llama calls, leaving 500 neurons below the published 10,000 free
allocation. No Cloudflare plan, paid overage setting, OpenAI model, OpenAI dollar
ceiling, world state, material supply or need meter is changed by this policy.

Cloudflare's pricing table, checked 2026-09-23, lists this exact model
`@cf/meta/llama-3.3-70b-instruct-fp8-fast` at 26,668 neurons per million input
tokens and 204,805 per million output tokens:
https://developers.cloudflare.com/workers-ai/platform/pricing/

## Accounting and migration

- Reserve the full bounded request before calling the provider, inside the
  existing serialized durable checkpoint. Prompt UTF-8 bytes plus 1,024 framing
  tokens bound the input, capped at the model's 24,000-token context. Reserve the
  complete output ceiling (180 action / 2,600 design tokens).
- Returned usage reconciles the reservation once, including paid compute from
  rejected designs and invalid decisions. Missing/failed usage retains the full
  reservation. Reported usage exceeding its bounds is charged in full and pauses
  further calls for that day. Unsupported models are not silently priced as Llama.
- Daily aggregates survive restarts and diagnostic request-list trimming.
  Results crossing midnight settle their original reservation day. Observing
  health, frames or tomorrow's eligibility does not mutate the budget.
- On upgrade, existing token records are counted. Missing historical requests,
  including calls removed from counters by the earlier authorized OpenAI reset,
  close the rest of that UTC day conservatively. The next UTC day opens normally.
  This is not a usage reset or a claim that the account already spent 9,500 neurons.

## Scheduling

The shared pool releases 1,200 neurons at midnight, then the remaining 8,300
gradually over the day. Before 18:00 UTC, 40% of released capacity is protected
for actions and 50% for designs, with 10% available to either. After 18:00 UTC,
either purpose may consume the other's unused portion. One bounded request can
borrow ahead of its paced share, but its full reservation must always fit below
the hard daily target. This avoids starving larger design requests behind cheap
actions. Candidate households with lower recorded usage of that kind get first
consideration; there are no household neuron or call-count ceilings.

Successful planning intervals stay at 30 minutes for actions and 60 for designs.
Failed Llama requests use those same intervals, replacing the old 2-minute action
and 3-minute design retries. Current useful projects, need checks, pending tasks
and physical validation still determine which requests are useful/eligible.
Unused free capacity is not an instruction to make meaningless requests.

OpenAI keeps its original 24 total / 18 action / 6 design calls per household and
configured dollar cap, including its existing retry behavior. It is independent
of the Llama computation ledger and no longer blocked by Llama's global call count.

## Visibility and limits

Player details show household calls and approximate shared Llama neuron usage,
including pending/unverified reservations and reset status. The connection panel
no longer claims a 96-call global maximum. Health distinguishes pacing, exhausted
free-compute capacity, unverified migration history and a token-bound mismatch.

This is **this world's token-derived estimate**, not authenticated Cloudflare
account billing analytics. Other Workers AI applications on the same Cloudflare
account share its free allocation. No account-wide spend guarantee or billing
setting is created by this change. A 500-neuron margin is not a replacement for
account-level monitoring if other apps begin using Workers AI. No paid provider
calls are made by tests.

The isolated full-day budget fixture supplies representative token counts and
demand from six Llama villagers. It verifies materially more ordinary planning,
continued design capacity, use of over 8,500 but never more than 9,500 neurons,
durable reservations, failures, result duplication, midnight settlement,
retention, migration and independent OpenAI limits. Its call counts are fixture
results, not forecasts or claims of completed real-world construction.
