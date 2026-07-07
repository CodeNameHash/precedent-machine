# BLOCKED-P0-B-TAIL

Date: 2026-07-07

## What was attempted

Completed Phase 0-B-tail locally and opened PR #132:

```text
https://github.com/CodeNameHash/precedent-machine/pull/132
```

Local checks passed:

- `npm test`: 930 passing.
- `npm run build`: pass.
- Schema artifact check: 684 entries, 0 duplicate keys, 0 entries missing from markdown, 0 empty alias arrays, 0 missing schema feature keys.
- `node scripts/ingest-qa.js --all`: revised gate clean, with 0 unverified quotes, 0 duplicate provisions, and the same 13 quarantined deals recorded in `docs/ingest/quarantine-baseline-2026-07-07.md`.

GitHub checks on PR #132:

- `test-and-build`: pass.
- `invariants`: pass.
- Vercel preview: pass.
- `phase-allowlist`: fail.

## What failed

The GitHub `phase-allowlist` job failed before it could evaluate the allowlist:

```text
fatal: ambiguous argument 'origin/main...HEAD': unknown revision or path not in the working tree.
fatal: ambiguous argument 'main...HEAD': unknown revision or path not in the working tree.
Unable to compute changed files against main
```

The workflow checks out the PR merge ref with `fetch-depth: 1`, so the job has neither `origin/main` nor local `main`. `scripts/ci/check-allowlist.js` currently requires one of those refs to compute changed files.

## What is missing

The CI allowlist harness needs an infrastructure fix, likely one of:

- Update `.github/workflows/ci.yml` so the `phase-allowlist` job fetches enough history and `origin/main`.
- Or update `scripts/ci/check-allowlist.js` so it can compute PR changed files in GitHub's shallow checkout environment.

## Why Phase 0-B-tail cannot fix it

Both likely fixes are outside the Phase 0-B-tail allowlist:

- `.github/workflows/ci.yml`
- `scripts/ci/check-allowlist.js`

Changing them inside this branch would bootstrap missing/broken infrastructure from inside the WP, which the master brief forbids.

## Current state

The Phase 0-B-tail artifacts are committed and pushed on:

```text
phase-0-B-tail/canonical-registry-artifacts
```

PR #132 is open but blocked on the pre-existing CI allowlist checkout issue.
