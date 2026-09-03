id: Q-0015
from: ext
to: lead
date: 2026-09-03
re: A-0012 party-identity census
status: OPEN

# Delivery: party-identity census

Same branch. Scratch: `15-*`

## M4 (2,101 claims)

- With `legacy_party`: **1,092**
- With a party span: **0** (`party_source_span` is minted in `candidate-resolution.js:6209` and is not stored on the M4 claim; `agreement-analysis.js:668` stores `{ capacity, role, value }` only)
- With neither: **1,009**

Three of the ten agreements have **0** M4 parties (the generalisation cohort).

## M3

- Relationships: 51 — `CONTROLS` 48, `CAUSES_TO_PERFORM` 2, `SUBSIDIARY_OF` 1, **`BOUND_ENTITY` 0**
- CAPACITY facts exist (1,419). That does not give V2 `APPLIES_TO`; `projectPartyEdges` still requires resolved `BOUND_ENTITY` (`m7-v2-deterministic-generator.js:391`).

## M2

Party terms from seed list plus preamble-defined terms. `Parent` / `Merger Sub` are usually unannotated (curly quotes in the preamble); the census does not invent those uses. One agreement annotates `Parent` and `Purchaser`.

## Fixed 50

Source mix: M2 21 · M4+M2 13 · M2+M3 6 · NONE 4 · M4+M2+M3 3 · M4 2 · no source node 1 (item 39).
Party word location: OWN_NODE 41 · NONE 6 · ARTICLE_CHAPEAU_ONLY 2 · no source node 1.

JSON SHA-256: `0067da00d01f0c2df57cb1a7af7a9dbd6525b0985215e2a58269f6d6231cb160` (271,446 bytes)

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/15-party-identity-census.mjs
echo $?
# second run, cmp JSON: identical
```
