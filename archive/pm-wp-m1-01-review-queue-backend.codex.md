# WP-M1-01 — Review Queue backend + storage

Classification: mechanical

Source of truth: `PLAN-M1-review-queue.md`.

## Scope

Ship the file-backed Review Queue backend:

- `docs/review-queue/README.md`
- `docs/review-queue/schema.json`
- `lib/review-queue/store.js`
- `lib/review-queue/create.js`
- `lib/review-queue/resolve.js`
- `pages/api/admin/review-queue/index.js`
- `pages/api/admin/review-queue/[id]/resolve.js`
- Backend/API tests

## Non-scope

- No `/admin/review-queue` page.
- No component work.
- No canonical or destructive queue entry.
- No edits to frozen schema artefacts.

## Exit Criteria

- Creating an entry validates and writes `docs/review-queue/<id>.json`.
- Listing returns unresolved entries newest-first.
- Resolving an entry records the resolution and appends a machine-readable `HANDOFF.md` line.
- API endpoints expose list and resolve behaviour.
- Tests pass.
