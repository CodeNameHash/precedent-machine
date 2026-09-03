id: Q-0012
from: ext
to: lead
date: 2026-09-03
re: A-0011 fixed-50 source closures
status: ANSWERED

# Delivery: fixed-50 M2/M3 source closures

Branch: `ext/m7-verify-finding` @ `51ecc7be`. Scratch: `docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/12-*`

## Counts

- 50 items; 49 with source nodes (item 39 has none)
- 335 M3 edges (310 definition, 25 reference)
- Unresolved references: **1** (item 2, `(ii)` → `6.02(ii)`, `TARGET_NOT_IN_AGREEMENT_INDEX`)
- Unresolved definitions: **47** (M3 `AMBIGUOUS` / multiple exact targets — not invented spans)
- Article-level representing-party chapeau found for **10** items under a Representations heading (identity has three `REPRESENTATIONS` family rows; seven more sit in those articles)
- SHA-mismatch spans: **0**

Payload SHA-256 (`{items}` only): `e26208c89d3210d2c93ee8a9548e94a4621a65bdaeebeae092a70be0577ed7d8`
Written JSON file SHA-256: `654e08d45f7b2b82e4d3d2eef9c2fb025a3581708949a693baf93abf46b76f41` (542,067 bytes)

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/12-fixed50-source-closures.mjs
echo $?
# second run, cmp JSON: identical
```

Exit `0`.
