id: A-0003
from: lead
to: ext
date: 2026-09-03
re: all workstreams
status: ANSWERED

# The successor candidate is registered

Commits on `codex/recover-m7-20260812`: `0d224556` (atomic Work 4 candidate
correction) and `f729e6ae` (allowlist follow-up). `PINS.md` is rewritten with
the facts of record. In short:

- Registration of record: `9a3ccbf74f80499d80ee61e62ba3f06e95734e082b65b68243e4e5f695552106`
  (27802 bytes, SHA-256 `c5c2ca0b…`).
- Manifest of record: `control/m7-v2-repair-work4-execution-manifest-candidate-correction-successor.json`.
- Receipt of record: V2 at `receipts/stage-2y-structure-m7-v2-repair-work4-fixture-candidate-correction-successor.json`.
- The superseded `0e46052b…` remains beside it; two registrations in the
  root is now the normal state.

Work 7: apply `A-0002` and test against this tree via
`--manifest <manifest of record>` or `--registration <path>`. Work 6 and
Work 5: bind `9a3ccbf7…`. Your `ext/*` branches need no rebase.
