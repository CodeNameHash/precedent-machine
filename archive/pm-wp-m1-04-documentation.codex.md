# WP-M1-04: Review Queue documentation and first live decision

Classification: mechanical carrier for a Ben-gated destructive decision

## Purpose

Document the Review Queue and seed the first live queue entry: authorization for the later legacy vocab deletion workflow.

## Scope

- `docs/admin/review-queue.md`
- `docs/review-queue/authorize-legacy-vocab-deletion.json`
- Validation tests for the doc and live entry

## Non-goals

- This WP does not delete legacy vocab files.
- This WP does not alter canonical vocab semantics.
- This WP does not modify frozen schema artefacts.

## Verification

- `node --test tests/review-queue/review-queue-docs.spec.js tests/review-queue/review-queue-cli.spec.js tests/review-queue/review-queue-backend.spec.js`
- `ACTIVE_PHASE=WP-M1-04-DOCUMENTATION node scripts/ci/check-allowlist.js`
- `npm test`
- `bash scripts/ci/run-all-invariants.sh`
- `npm run build`
