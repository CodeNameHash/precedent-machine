# WP-M1-02: Review Queue page

Classification: mechanical

## Purpose

Add the admin UI for Review Queue entries created by WP-M1-01.

## Scope

- Render unresolved queue entries from `GET /api/admin/review-queue`.
- Show evidence links and per-entry choices.
- Resolve entries through `POST /api/admin/review-queue/[id]/resolve`.
- Register the page in the admin navigation.

## Non-goals

- No canonical approvals are created by this WP.
- No destructive actions are performed by this WP.
- No frozen schema, vocab, parser, or database artefacts are changed.

## Verification

- `node --test tests/admin/review-queue.spec.js tests/admin/nav-registry.spec.js`
- `ACTIVE_PHASE=WP-M1-02-REVIEW-QUEUE-PAGE node scripts/ci/check-allowlist.js`
- `npm test`
- `bash scripts/ci/run-all-invariants.sh`
- `npm run build`
