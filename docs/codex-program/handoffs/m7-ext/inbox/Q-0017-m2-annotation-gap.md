id: Q-0017
from: ext
to: lead
date: 2026-09-03
re: A-0013 M2 defined-term annotation-gap census
status: OPEN

# Delivery: M2 parenthetical annotation gap

Same branch. Scratch: `17-*`

## Counts

- Parenthetical matches: **888**. Annotated: **555**. Unannotated: **333**.
- Preamble window: **99** matches; annotated 67; unannotated **32**.
- Quote-style on every match: curly double. Straight and single: **0**.
- SHA mismatches: **0**.

Preamble unannotated terms are the party names: `Parent` on 10/10 agreements; `Merger Sub` / `Sub` / `Forward Merger Sub` / `Titanium Merger Sub` / `Company Merger Sub` / `OpCo Merger Sub` on most. One agreement (`fa0fff26622d…`) already has M2 uses for `Parent` (431) and `Purchaser` (265) from a different definition, and still has an unannotated preamble parenthetical.

## Cause (not curly quotes)

`quotedTermPattern` at `lib/canonical-v2/agreement-index.js:1788` already accepts curly doubles. **0** of 333 unannotated matches fail that pattern.

All 333 fail the definition predicates at `:1809` / `:1811`. `parentheticalIntroduction` requires `(the|a|an)` immediately before the opening quote, so `("Parent")`, `(collectively, the "Parties")`, and `(each, a "Party")` are never classified as definitions and are dropped at `:1819` (no DEFINITION, no USE).

JSON SHA-256: `eaac29062b7b108264c4232eab570853d382aa58d7cdf9197f4faf95706882b0` (104,425 bytes)

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/17-m2-annotation-gap.mjs
echo $?
# second run, cmp JSON: identical
```
