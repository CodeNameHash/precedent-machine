# Definition-resolution rules (Q-0016)

Same 5,998 AMBIGUOUS M3 definition edges as Q-0014, plus the 47 fixed-50 AMBIGUOUS cases. No target is invented: every selected annotation is already in `target_definition_annotation_occurrence_ids`.

- Rule 1 (Q-0014): unique exact-term `DEFINED_TERM_DEFINITION` inside the Definitions-article union, and that annotation is an M3 candidate.
- Rule 2: exactly one M3 candidate definition lies in the Q-0015 preamble window (AGREEMENT children before the first ARTICLE).
- Rule 3: the unique candidate whose verified span ends at or before the use and is nearest to it. Location of that nearest is preamble / Definitions article / inline body.
- Combined: Rule 1, then Rule 2, then Rule 3; first hit wins.

## Corpus-wide rates (vs 5,998 AMBIGUOUS)

- Rule 1: **683/5998 (11.4%)**.
- Rule 2: **4467/5998 (74.5%)**.
- Rule 3: **5455/5998 (90.9%)** — nearest in preamble 4048, Definitions article 39, inline body 1368.
- Combined: **5667/5998 (94.5%)**.
- Rule disagreements (two rules pick different candidate ids): **856**.
- SHA-verified reported spans: **31808**. Stored-hash mismatches: **0**.

## Per agreement

| Agreement | AMBIGUOUS | R1 | R2 | R3 | Combined | Disagreements |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `06ec30164193` | 33 | 0/33 (0.0%) | 0/33 (0.0%) | 16/33 (48.5%) | 16/33 (48.5%) | 0 |
| `08fd217ea256` | 0 | — | — | — | — | 0 |
| `1d6bba9ac993` | 13 | 0/13 (0.0%) | 0/13 (0.0%) | 12/13 (92.3%) | 12/13 (92.3%) | 0 |
| `3888fa7618bb` | 0 | — | — | — | — | 0 |
| `aa72f3af2931` | 368 | 21/368 (5.7%) | 227/368 (61.7%) | 295/368 (80.2%) | 320/368 (87.0%) | 20 |
| `b74ed1f02f2e` | 0 | — | — | — | — | 0 |
| `f4a123d7c2bd` | 1947 | 348/1947 (17.9%) | 1437/1947 (73.8%) | 1851/1947 (95.1%) | 1942/1947 (99.7%) | 322 |
| `f783c4cdcaca` | 1963 | 270/1963 (13.8%) | 1489/1963 (75.9%) | 1840/1963 (93.7%) | 1918/1963 (97.7%) | 261 |
| `fa0fff26622d` | 1628 | 44/1628 (2.7%) | 1314/1628 (80.7%) | 1395/1628 (85.7%) | 1413/1628 (86.8%) | 253 |
| `fb76ef57355b` | 46 | 0/46 (0.0%) | 0/46 (0.0%) | 46/46 (100.0%) | 46/46 (100.0%) | 0 |

## Fixed-50 AMBIGUOUS edges (47)

| # | Term | Combined | R1 | R2 | R3 nearest | Selected span |
| ---: | --- | --- | --- | --- | --- | --- |
| 7 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 7 | Company Options | rule_1_unique_definitions_article | yes | not | not | Company Options @ 263017–263038 (definitions_article) |
| 7 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 7 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 7 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 14 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 14 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 14 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 14 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 28 | Surviving Company | rule_3_nearest_preceding | not | not | inline_body | Surviving Company @ 13648–13671 (inline_body) |
| 28 | Surviving Company | rule_3_nearest_preceding | not | not | inline_body | Surviving Company @ 13648–13671 (inline_body) |
| 29 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 8283–8296 (preamble) |
| 38 | Parties | rule_1_unique_definitions_article | yes | not | not | Parties @ 286328–286341 (definitions_article) |
| 38 | Parties | rule_1_unique_definitions_article | yes | not | not | Parties @ 286328–286341 (definitions_article) |
| 40 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 41 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 42 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 42 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 42 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 42 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 42 | Surviving Corporation | rule_2_unique_preamble_candidate | not | yes | preamble | Surviving Corporation @ 5838–5865 (preamble) |
| 42 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 43 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 43 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 44 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 44 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 44 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 44 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 44 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 45 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 45 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 45 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 45 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 45 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 46 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 46 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 47 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 48 | CVR | rule_3_nearest_preceding | not | not | inline_body | CVR @ 12840–12849 (inline_body) |
| 49 | Surviving Corporation | rule_2_unique_preamble_candidate | not | yes | preamble | Surviving Corporation @ 5838–5865 (preamble) |
| 49 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 49 | Company | rule_2_unique_preamble_candidate | not | yes | preamble | Company @ 5001–5014 (preamble) |
| 50 | Parties | rule_1_unique_definitions_article | yes | not | not | Parties @ 286328–286341 (definitions_article) |

## Rule disagreements (need Ben if the two spans are legally different targets)

Corpus-wide disagreements: **856**. Fixed-50 disagreements: **0**. Every pair, with both spans, is in the JSON `disagreements` array.

| Term | Rule / location pair | Edges |
| --- | --- | ---: |
| Affiliate | rule_1:definitions_article vs rule_3:inline_body | 7 |
| Company Options | rule_1:definitions_article vs rule_3:inline_body | 2 |
| Company | rule_2:preamble vs rule_3:inline_body | 137 |
| DGCL | rule_1:definitions_article vs rule_3:inline_body | 7 |
| FDA | rule_1:definitions_article vs rule_3:inline_body | 71 |
| Merger | rule_2:preamble vs rule_3:inline_body | 35 |
| Milestone Payment Amount | rule_1:definitions_article vs rule_3:inline_body | 12 |
| Milestone Payment Date | rule_1:definitions_article vs rule_3:inline_body | 26 |
| Milestone Payment | rule_1:definitions_article vs rule_3:inline_body | 32 |
| Milestone Payments | rule_1:definitions_article vs rule_3:inline_body | 5 |
| Milestone | rule_1:definitions_article vs rule_3:inline_body | 44 |
| Parties | rule_1:definitions_article vs rule_3:inline_body | 21 |
| Rights Agent | rule_1:definitions_article vs rule_3:inline_body | 285 |
| Rights Agent | rule_2:preamble vs rule_3:inline_body | 165 |
| Surviving Corporation | rule_2:preamble vs rule_3:inline_body | 6 |
| control | rule_1:definitions_article vs rule_3:inline_body | 1 |

