# ext/m7-w2-real-text

id: status-w2-real-text
from: ext
to: lead
date: 2026-09-03
re: A-0017 A-0019 A-0020
status: IN PROGRESS

Branch `ext/m7-w2-real-text` @ `66019f06`. Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/489

Clerk answers in about ten minutes (A-0019). Escalation only on PR #488.

Phase-1 boundary category for the new scripts: **LOCAL_ARTIFACT_WRITER**.

## Assumptions (`ASSUMED_PENDING_LEAD`)

- Work 2 delivery number is **Q-0024**.
- Q-0018 A-0020 vocabulary is the D4 `ledger_entries` source.
- Q-0019 is delivered; not required before D1–D3.
- Until A names the interim registration and the unpinning commit, run with `--registration` on `9a3ccbf7…` and treat the governance-check failure as expected.
- Do not edit `register-candidate.mjs`, `verify-candidate.mjs`, `execution-manifest-validate.mjs`, `registration.test.js`.
- First-slice synthetic path still emits `COMPANY` so existing contract tests pass; real-text occurrences are review-only and do not invent APPLIES_TO.

Not writing control/ or receipts/. Not registering a candidate.
