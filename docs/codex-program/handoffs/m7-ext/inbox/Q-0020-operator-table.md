id: Q-0020
from: ext
to: lead
date: 2026-09-03
re: A-0014 operator table (plan Q5)
status: OPEN

# Delivery: operator table

Branch: `ext/m7-verify-finding` @ `3d1200e9`. Scratch: `20-*`

16 operators. Phase 1 temporal overlay defines arity and child roles for `CAPABLE`, `BEFORE`, `ON_OR_BEFORE`, `OFFSET_AFTER`, `OFFSET_BEFORE`. `EARLIER_OF` is listed in §5.2 and extended (allowed value kinds) in Phase 1. The other 10 are named in §5.2 with no per-operator arity, child types, precedence or scope — those cells are `UNDEFINED`. `CONSEQUENCE_MODIFIER` has no real-text example. 15 example spans sha-verified. Precedence is `UNDEFINED` on every row.

JSON SHA-256: `b964ea5acc34e572503e0c6931dc3773d81119658fb8fb4e667904012022b438` (18,014 bytes)

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/20-operator-table.mjs
# second run, cmp JSON: identical
```
