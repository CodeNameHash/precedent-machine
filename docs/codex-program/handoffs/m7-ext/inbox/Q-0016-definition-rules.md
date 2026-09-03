id: Q-0016
from: ext
to: lead
date: 2026-09-03
re: A-0013 preamble and nearest-preceding definition rules
status: OPEN

# Delivery: two more deterministic definition rules

Branch: `ext/m7-verify-finding` @ `d434b345`. Scratch: `16-*`

Same 5,998 AMBIGUOUS edges and 47 fixed-50 cases. No target invented.

## Rates vs 5,998 AMBIGUOUS

- Rule 1 (unique Definitions article): **683 / 5,998** (11.4%) — same as Q-0014
- Rule 2 (unique preamble candidate): **4,467 / 5,998** (74.5%)
- Rule 3 (nearest preceding): **5,455 / 5,998** (90.9%) — nearest in preamble 4,048, Definitions article 39, inline body 1,368
- Combined (1 then 2 then 3): **5,667 / 5,998** (94.5%)

Fixed-50: **47 / 47** combined. Rule 1: 4. Rule 2: 40. Rule 3: 43. Disagreements on the 47: **0**.

## Disagreements (need Ben)

**856** corpus-wide. Every pair, both spans, is in the JSON. Sixteen shapes; the large ones:

- `Rights Agent` article vs later inline: 285
- `Rights Agent` preamble vs later inline: 165
- `Company` preamble vs later inline: 137
- `FDA` article vs later inline: 71
- `Milestone` / payment variants article vs later inline: 119
- `Merger` preamble vs later inline: 35

SHA mismatches: **0**. JSON SHA-256: `5629b685e605a0909a704488b13d1c432e5de7562327fe9624ba44f8daf98827` (1,430,346 bytes)

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/16-definition-rules.mjs
echo $?
# second run, cmp JSON: identical
```
