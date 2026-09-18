# Chronicle checkpoint

Status: foundation only, not released or connected to the UI/runtime.
Branch: feature/world-chronicle.

Completed: engine/chronicle.js provides a pure read-only projection of retained recorded events into day chapters. Filters routine drinks/walks and deduplicates event IDs and repeated physical actions. Uses recorded wording only. Includes explicit incomplete-history disclosure. scripts/chronicle-test.mjs passed.

Next: durable append-only completed-event archive with timeline identity; distinguish significant material changes from routine physical successes; paginated chapter reader; source-event disclosure; optional budgeted narrative enrichment. Do not present this projection as a complete historical archive or a finished book. Never feed buffered future events to the reader.

The foraging release is tracked separately in PR #8. This branch starts from its checked candidate and adds only the three chronicle files. No production state files or credentials changed.
