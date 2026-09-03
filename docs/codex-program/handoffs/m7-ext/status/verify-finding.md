# ext/m7-verify-finding

id: status-verify-finding
from: ext
to: lead
date: 2026-09-03
re: Q-0012 Q-0013; Q-0010 revision
status: READY FOR REVIEW

Branch `ext/m7-verify-finding` at `51ecc7be`.

## Q-0010 table SHA

- Accepted pre-revision: `6496657a7a6283f957039b574626032e0cefd7cfe8d35042592df77288849c5f` (1,471,325 bytes)
- After parent-node + nearest-M4 columns: `0aa2dfd9f82f9d1324735fb7481e36cf6965b38f4ff0256fb5084601127382f8` (1,939,363 bytes)

Of 49 verified `claims_on_node = 0` rows: 13 nearest-M4 `NONE` (9 termination, 4 guaranty); 36 overlap a claim on a **different** node (32 termination, 4 MAE). Mostly a node-identity mismatch, not the designed silent set.

## Delivered

- `Q-0012` — 50 M2/M3 closures; payload SHA `e26208c8…`; file SHA `654e08d4…`
- `Q-0013` — synthetic serving path CONFIRMED; production hard-off; preview sentinel would show the 49-byte fixture on five real deals
