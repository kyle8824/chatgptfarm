# Durable evidence checkpoint — C1

Status: DEVELOPMENT CHECKPOINT / HOLD RELEASE. Code: 1213ee2714f49b8c77dad8ac2660405778b40624. No deployment or production writes.

Based on main 0f73f56, following released v1.6.7 / 46bcfc0293a1ab96c1920fde7038bd1040dda5ed. Read the full 30-page ChatGPTFarm-Architecture-Blueprint.pdf (19 September 2026); stages 3/C precede navigation and resumable work. This is part of C, not completion of cognitive parity or stage 4.

## Implemented

- Model adapter retains the exact serialized non-secret request body (instructions, input, dynamic schema, model and generation settings), output text, response ID, usage, timestamps and error category. Headers, credentials and arbitrary provider error bodies are excluded.
- Engine records the full supplied decision context, original proposal, validation result, selected command and explicit fallback category, including rejected AI actions. This is evidence of supplied input/output, not private reasoning or causal proof.
- Transition preparation removes full envelopes from the public capped DNA list and retains them privately in the persisted transition. Completed outcome evidence is not exposed ahead of its deadline.
- On transition completion, one compressed immutable segment of new events and decisions commits in the same Durable Object storage transaction as the promoted checkpoint, alarm and archive-outbox entry. Checksums detect corruption or conflicting retries. The archive rejects gaps and capture overflow instead of silently losing history.
- Archive records survive eviction, duplicate alarms and clearing/capping the hot history lists. Pre-upgrade transitions are explicitly marked legacy_summary_only. Coverage starts with the first completed transition recorded by this code; older lost history is not reconstructed.
- Authenticated GET /evidence?tick=<completed-tick> returns one verified local segment. Public /health exposes AI enabled/key-present flags, configured model, decision mode/reasons, archive coverage and clock conversion. No credentials are returned.
- Legacy DNA display says not tested when no intervention ran; a single replay no longer claims a memory was pivotal. Accepted Phaser scene/art is unchanged.

## Verification

Passed locally:

- npm test (including new exact-request, rejection/error, secret exclusion and private-outcome tests).
- node scripts/runtime-test.mjs.
- npm test --prefix cloudflare: atomic failure rollback of archive/outbox/checkpoint; duplicate/conflicting retries; reload; retention independent of hot lists; legacy migration; corruption; disabled/missing-key/exhausted-budget paths; existing controller downtime/pause/alarm suite.
- Both real workerd tests: actual SQLite archive/outbox persistence across restart, duplicate delivery, evidence endpoint authorization, alarms and existing controller behavior.
- Worker packaging dry run. Generated build-info was restored; no release/version bump.
- Ecology, living history and recovery QA.
- Read-only live snapshot at tick 468, Day 23 12:00, build v1.6.7 / 46bcfc0. Migration of a copy preserved agents (including inventories/memories/needs), relationships and history. Source was not modified. A 72-hour fallback audit returned zero depleted food/hydration/warmth hours, including the 12-hour recovery exclusion.

One copied live fallback transition produced 2 events / 2 decisions and approximately 6.6 KB compressed evidence (~3.6 MiB per wall day at 576 transitions/day). This single sample is not a capacity benchmark for model requests, richer worlds, or long-run growth.

Hosted exact-head CI/browser verification is pending at checkpoint creation. The production renderer is untouched; the existing PR browser gate will run once for the completed checkpoint. No paid model calls were made. Adapter tests mock provider responses and do not establish real-model quality.

## Remaining release gates / next work

1. External archive export/acknowledgment and backup policy: outbox entries are pending, no object-storage binding is provisioned, and no records are compacted. All evidence remains local to the existing Durable Object. Do not call this an independent backup or an unlimited archive. Add verified export/retry/checksum acknowledgment and capacity monitoring before declaring archive completion.
2. Cognitive parity: shared decision/plan/reflection integration is unfinished. Cloudflare still does not call reflection or experimental replay; health reports that. Do not turn on paid inference or increase budgets to make this checkpoint look complete.
3. Live AI diagnosis: pre-change /health confirmed zero calls and fallback, but cannot distinguish disabled flag from missing key. New diagnostics are tested locally, not deployed. Inspect actual settings through authorized Cloudflare access or verify diagnostics as part of an approved coherent release. Do not infer the root cause from the checked-in defaults.
4. Durable model-job handling remains necessary for stronger crash semantics: a crash before the next transition is saved can discard an attempted model response; the call reservation remains charged. Completed evidence describes committed outcomes, not an audit of every abandoned provider invocation.
5. Shared archive contract for non-authoritative local/legacy runners, authoritative settings controls, fair cognition budgeting and measured reflection remain C follow-up work. Full envelopes in those runners are still subject to their existing save retention; only Cloudflare has the new append-only archive.
6. Recheck current main and exact-head CI before release preparation. Preserve FarmWorld / preview-v1, accepted UI, current people/history and material authority. No rejected clay work.
7. After C, proceed to persistent travel/work, arrival before effects, incremental needs and urgent interruption. No part of this checkpoint claims to implement those behaviors.

Rollback/repair: checkpoint version remains 1 with additive transition evidence fields and independent storage keys. Existing readers ignore the extra fields. Reverting to old code would stop recording evidence and create a coverage gap; do not silently roll back the engine and later resume the archive. Use a forward repair or explicitly recorded coverage-epoch migration. A UI rollback must not roll back world history.
