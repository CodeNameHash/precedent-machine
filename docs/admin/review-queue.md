# Review Queue

The Review Queue is the only place Ben has to approve canonical, destructive, unfreeze, or clarification decisions.

## Flow

1. Codex creates a JSON entry under `docs/review-queue/`.
2. The entry appears at `/admin/review-queue`.
3. Ben clicks one choice.
4. `/api/admin/review-queue/[id]/resolve` writes the resolution into the entry and appends one `REVIEW_QUEUE_RESOLUTION` line to `HANDOFF.md`.
5. Codex polls `HANDOFF.md` and acts on the selected `codex_action`.

## Entry shape

Entries follow `docs/review-queue/schema.json`.

Required fields:

- `id`
- `created_at`
- `kind`
- `title`
- `summary`
- `evidence`
- `choices`
- `resolution`
- `resolved_at`
- `resolved_by`

Open entries have `resolution`, `resolved_at`, and `resolved_by` set to `null`.

## Codex commands

Create an entry:

```sh
node scripts/review-queue/create.js --kind canonical --title "Approve mapping" --summary "Codex needs Ben to approve this mapping." --pr 123
```

Poll for a PR resolution:

```sh
node scripts/review-queue/poll.js --pr 123
```

Poll for a specific entry:

```sh
node scripts/review-queue/poll.js --id authorize-legacy-vocab-deletion
```

The poll command exits `0` when it finds a matching resolution and `1` when there is no matching resolution yet.

## Rules

- Mechanical PRs do not need queue entries.
- Canonical semantics go through the queue.
- Destructive deletes go through the queue.
- Frozen-file edits go through an unfreeze queue entry.
- Queue-entry carrier PRs can self-merge when they only add the request file and supporting docs.
