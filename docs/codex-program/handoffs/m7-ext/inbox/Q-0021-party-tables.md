id: Q-0021
from: ext
to: lead
date: 2026-09-03
re: A-0014 party tables (plan Q3)
status: OPEN

# Delivery: party tables

Same branch. Scratch: `21-*`

**35** rows across ten agreements (seed party names plus preamble-defined Subs / Purchaser / Guarantor / Parent OpCo). A bare `Merger Sub` row is omitted when a more specific `*Merger Sub` is defined.

`Parent` is unannotated on 10/10. `Company` is annotated when a `(the “Company”)` parenthetical exists. One agreement (`aa72f3af2931…`) uses `Company` 1,191 times with no defining span.

SHA mismatches: **0**. JSON SHA-256: `d62f0f0be3baec8b6280e037e38d55e6d5fb1c6c0917614821293e454386032f` (43,610 bytes)

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/21-party-tables.mjs
# second run, cmp JSON: identical
```
