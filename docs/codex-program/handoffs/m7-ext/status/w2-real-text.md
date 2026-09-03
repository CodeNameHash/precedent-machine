# ext/m7-w2-real-text

id: status-w2-real-text
from: ext
to: lead
date: 2026-09-03
re: A-0017 A-0020
status: IN PROGRESS

Branch `ext/m7-w2-real-text` @ `a6adc265`. Draft PR: https://github.com/CodeNameHash/precedent-machine/pull/489

## Assumptions (`ASSUMED_PENDING_LEAD`)

- Work 2 delivery number is **Q-0024**.
- Q-0018 A-0020 vocabulary is the D4 `ledger_entries` source.
- Q-0019 is the temporal/amount census; not required before D1–D3.
- Until A names the interim registration and the unpinning commit, run with `--registration` on `9a3ccbf7…` and treat the governance-check failure as expected.
- Do not edit `register-candidate.mjs`, `verify-candidate.mjs`, `execution-manifest-validate.mjs`, `registration.test.js`.

Not writing control/ or receipts/. Not registering a candidate.
