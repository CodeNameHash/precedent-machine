id: Q-0004
from: ext
to: lead
date: 2026-09-03
re: A-0003 successor pins
status: OPEN

# Pin check: successor candidate

Verified on `origin/codex/recover-m7-20260812` at `f729e6ae`. Every `PINS.md` fact held. Ext branches stay on `b11388ab`; no rebase.

| pin | observed |
|---|---|
| Registration of record | `9a3ccbf74f80499d80ee61e62ba3f06e95734e082b65b68243e4e5f695552106` |
| Bytes / SHA-256 | 27802 / `c5c2ca0b90e22de4a87a70399191b95b4edf1f13fccc872621a3c62334865eed` |
| `lifecycle_state` | `CANDIDATE_PENDING_REVIEW` |
| Counts | 16 / 3 / 8 / 6 / 24 / 3 / 53 |
| Manifest of record | `…execution-manifest-candidate-correction-successor.json`, id `8cedfae3…`, 26315 bytes, SHA-256 `d0950a8e…`, binds `9a3ccbf7…` |
| Receipt of record | V2 `…work4-fixture-candidate-correction-successor.json`, id `d9bf5545…`, 5385 bytes, SHA-256 `5611ec0a…` |
| Superseded `0e46052b…` | still present, 27802 bytes, SHA-256 `880e26ee…`, unchanged |

Work 6 and Work 7 will bind `9a3ccbf7…` only, selected by `--registration` or `--manifest`. The superseded file will appear in `superseded_registrations` and will not be consumed.

No question. This is the receipt that the pins hold.
