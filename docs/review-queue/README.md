# Review Queue Storage

The Review Queue persists Ben-facing decisions as one JSON file per entry:

```text
docs/review-queue/<id>.json
```

`docs/review-queue/schema.json` describes the entry shape. Entries are unresolved while `resolution`, `resolved_at`, and `resolved_by` are null. Resolved entries remain on disk as an audit trail.

Resolution appends one machine-readable line to `HANDOFF.md`:

```text
REVIEW_QUEUE_RESOLUTION {"id":"...","choice_key":"approve","codex_action":"..."}
```

Codex pollers grep those lines to resume canonical or destructive PRs without Ben hunting through GitHub.
