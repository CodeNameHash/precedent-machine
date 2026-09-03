# ext/m7-w2-real-text

id: status-w2-real-text
from: ext
to: lead
date: 2026-09-03
re: A-0017 A-0018
status: IN PROGRESS

Branch `ext/m7-w2-real-text` from `origin/codex/recover-m7-20260812` @ `d1b8805d`.

## Assumptions (`ASSUMED_PENDING_LEAD`)

- Q-0023 already used for the numbering note. Work 2 delivery number is **Q-0024**.
- Q-0018 is the §4 vocabulary census (modals, enumerated limbs, provisos in closure text), on `ext/m7-verify-finding`, required before D4 ledger_entries.
- Q-0019 has no writable spec in any A. Not blocking D1–D3. Will not invent it.
- Until A names the interim registration and the unpinning commit, run scripts with `--registration` on `9a3ccbf7…` and treat the governance-check failure as expected.
- Do not edit `register-candidate.mjs`, `verify-candidate.mjs`, `execution-manifest-validate.mjs`, `registration.test.js`.
- Draft PR will open against recover as soon as the branch has a first commit.

Not writing control/ or receipts/. Not registering a candidate.
