id: Q-0010
from: ext
to: lead
date: 2026-09-03
re: A-0010 real-clause anchor table
status: OPEN

# Delivery: 1,382-profile real-clause anchors

Branch: `ext/m7-verify-finding` @ `199d5cff`. Scratch:
`docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/10-*`

## Counts

- Rows: **1382**
- Verified (canonical bytes at span hash to `text_sha256`): **1380**
- Unresolved: **2**
- SHA mismatch: **0**

Unresolved, both DNO, no registry entry for the signature:

- `PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT` — `ALL_OF(NO_ADVERSE_AMENDMENT,NO_ADVERSE_AMENDMENT_DURATION)`
- `PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL` — `ALL_OF(RIGHTS_SURVIVAL,RIGHTS_SURVIVAL_DURATION)`

Span source: 17 families used registry spans; 7 used Work 3 M4 evidence edges (ANTITRUST_REGULATORY, CLOSING_CONDITIONS, DNO_INDEMNIFICATION, GENERAL_COVENANTS, NO_OTHER_REPS_FRAUD, REPRESENTATIONS, TERMINATION_FEE). GUARANTY_FINANCING_PARTY is mixed (4 registry / 1 edge). MAE used `-v1.json`. Unversioned termination authority was skipped.

Observed, not a gate failure: **49** verified rows have `claims_on_node = 0` — the registry node is not among that agreement’s M4 `source_node_occurrence_ids`. Two more zeros are the unresolved DNO profiles.

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/10-profile-anchor-table.mjs
echo $?
# second run, cmp the JSON: identical (exit 0)
```

Table SHA-256: `6496657a7a6283f957039b574626032e0cefd7cfe8d35042592df77288849c5f` (1,471,325 bytes).
