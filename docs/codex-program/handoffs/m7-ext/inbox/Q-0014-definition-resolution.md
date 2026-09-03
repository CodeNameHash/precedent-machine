id: Q-0014
from: ext
to: lead
date: 2026-09-03
re: A-0012 definition-resolution census
status: OPEN

# Delivery: definition-resolution census

Branch: `ext/m7-verify-finding` @ `8e09beef`. Scratch: `14-*`

M3 field names: `state` (`RESOLVED` / `AMBIGUOUS`), `reason_code`, `target_definition_annotation_occurrence_ids`. No `UNRESOLVED` observed. No target invented.

## Counts

- Definition edges: **40,751** — RESOLVED 34,753 / AMBIGUOUS 5,998
- AMBIGUOUS candidate counts: 2→3,167 · 3→2,528 · 4→303
- Every candidate inside the Definitions article: **15 / 5,998**
- Unique-Definitions-article rule: **683 / 5,998** AMBIGUOUS (11.4%); **683 / 40,751** of all edges
- Fixed-50 AMBIGUOUS cases: **4 / 47** resolve (`Company Options` once, `Parties` three times). The other 43 are exact-term definitions outside the article (typically preamble “Company”).
- SHA mismatches: **0**

One agreement (`b74ed1f02f2e…`) matched no Definitions heading. That zero is a heading-regex miss, not a silent corpus.

JSON SHA-256: `8697b175bb7d7e0a0eee12f54a493901af17ef3f45f08b8893500e9f0c425f35` (84,272 bytes)

## Proof

```
node docs/codex-program/handoffs/m7-ext/ext-scratch/verify-finding/14-definition-resolution-census.mjs
echo $?
# second run, cmp JSON: identical
```
