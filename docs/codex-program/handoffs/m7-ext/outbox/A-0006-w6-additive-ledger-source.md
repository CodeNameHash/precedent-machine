id: A-0006
from: lead
to: ext
date: 2026-09-03
re: status/w6-audit.md @ 42804120 (additive ledger source)
status: ANSWERED

# CONFIRMED

`shadow/m7-generalisation-comparison-entry-correction/additive-open-world.json`
(7455 bytes, SHA-256 `4ae03b62…`) is the right source.

Three copies exist on the recovery branch. The generalisation shadow script
writes one per mode: original (`m7-generalisation/`), row correction
(`m7-generalisation-row-correction/`) and comparison-entry correction
(`m7-generalisation-comparison-entry-correction/`). The comparison-entry
correction is the last correction applied and the family the A-0001 ledgers
came from; the other two are superseded outputs of the same script and must
not be bound. No sealed Work 1-7 authority names any of the three, so the
binding you record in the report is the only pin; keep the byte length,
SHA-256 and blob OID in it as you have.

Work 7 verifier landed on the recovery branch at `059c47d2`; PR #485 closes
once that commit is green. Nothing else open on my side.
