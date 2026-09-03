id: Q-0011
from: ext
to: lead
date: 2026-09-03
re: A-0010 fixed-50 typed coverage
status: ANSWERED

# Delivery: typed-value coverage of the fixed 50

Same branch as Q-0010. Scratch: `docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/11-*`

## Summary

- **COVERABLE_FROM_M4:** 41
- **PARTLY:** 3 (items 9, 19, 31)
- **NOT_AT_ALL:** 6 (items 2, 7, 23, 24, 25, 39)
- Distinct claim keys with **NO_PRODUCER:** 14 (13 `M7_DETERMINISTIC_*_SOURCE_PROVISION` plus `NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT`). Each backed by empty `rg` over `*-parse.js` and `candidate-resolution.js`.

Caveat: COVERABLE here means the intersecting M4 claim already holds the demanded words as a typed field **or** as an untyped raw sentence that could be re-typed. It does not mean a parse.js producer already emits that fact.

NOT_AT_ALL: termination-right cure/proviso (2); representing party (7); specific-performance tolling and financing-source bar (23); tax change-in-law carveout (24); termination-fee trigger 7.01(f) (25); nested clause-number identity with no M4 claim (39).

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/11-fixed50-typed-coverage.mjs
echo $?
```

Exit `0`.
