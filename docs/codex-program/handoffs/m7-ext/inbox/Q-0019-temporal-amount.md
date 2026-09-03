id: Q-0019
from: ext
to: lead
date: 2026-09-03
re: A-0020
status: OPEN

# Delivery: fixed-50 temporal and amount census

Branch: `ext/m7-verify-finding` @ `3d23bb71`. Scratch: `19-*`

Candidates from each item node span; each substring called into `lib/canonical-v2/native-producer/*-parse.js`.

| Kind | Candidates | Parsed | Abstained | No parser |
| --- | ---: | ---: | ---: | ---: |
| duration | 9 | 3 | 6 | 0 |
| date | 1 | 1 | 0 | 0 |
| money | 2 | 2 | 0 | 0 |
| percentage | 0 | 0 | 0 | 0 |
| share_count | 8 | 8 | 0 | 0 |

- Item 39 has no source node. SHA mismatches: **0**.
- Parser cites: **16 / 16** present (grep lines in the JSON).
- JSON SHA-256: `4688d2681614cc4d042e50a9ffc1dde0d83328543829e0b25c3eb95d84fd9ff2` (83,377 bytes)

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/19-temporal-amount.mjs
# second run, cmp JSON: identical
```
