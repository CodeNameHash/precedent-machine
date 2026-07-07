# WP-M1-03: Codex-side Review Queue helpers

Classification: mechanical

## Purpose

Give Codex simple CLI commands for creating Review Queue entries and polling HANDOFF resolutions.

## Scope

- `scripts/review-queue/create.js`
- `scripts/review-queue/poll.js`
- `scripts/review-queue/README.md`
- Tests for create and poll behaviour

## Non-goals

- No live Review Queue entries are created by this WP.
- No canonical values, frozen schema artefacts, parser logic, or renderer semantics are changed.

## Verification

- `node --test tests/review-queue/review-queue-cli.spec.js tests/review-queue/review-queue-backend.spec.js`
- `ACTIVE_PHASE=WP-M1-03-CODEX-HELPERS node scripts/ci/check-allowlist.js`
- `npm test`
- `bash scripts/ci/run-all-invariants.sh`
- `npm run build`
