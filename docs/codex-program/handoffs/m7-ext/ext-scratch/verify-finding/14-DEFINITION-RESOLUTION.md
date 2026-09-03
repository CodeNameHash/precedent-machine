# Definition-resolution census (Q-0014)

M3 resolution state is the edge field `state`. Observed values and `reason_code` companions are taken from the ten Work 3 compilations; candidate targets are the existing `target_definition_annotation_occurrence_ids` (owner nodes in `target_owner_node_occurrence_ids`). No AMBIGUOUS target is invented.

The Definitions article is the union of M2 `ARTICLE`/`SECTION` nodes whose heading matches `/definitions|defined terms|certain definitions/i`. The deterministic rule uniquely resolves an AMBIGUOUS edge when exactly one M2 `DEFINED_TERM_DEFINITION` of that exact term string (case-sensitive) lies inside that union, and that annotation is already an M3 candidate.

## M3 field names

- Resolution state: `state` — observed `AMBIGUOUS`, `RESOLVED`.
- Reason: `reason_code` — observed `MULTIPLE_EXACT_DEFINITION_TARGETS`, `UNIQUE_EXACT_DEFINITION_TARGET`.
- Term: `term`. Edge id: `definition_edge_id`.
- Candidate annotation ids: `target_definition_annotation_occurrence_ids`. Candidate owner nodes: `target_owner_node_occurrence_ids`.
- Selected target (RESOLVED only): `selected_definition_annotation_occurrence_id`.

## Corpus

- Definition edges: **40751**.
- State histogram: `AMBIGUOUS` 5998, `RESOLVED` 34753.
- AMBIGUOUS candidate-target-count histogram: 2→3167, 3→2528, 4→303.
- AMBIGUOUS edges whose every candidate lies inside the Definitions article: **15** / 5998 (0.3%).
- AMBIGUOUS edges with any candidate elsewhere: **5983** / 5998.
- Rule uniquely resolves **683** / 5998 AMBIGUOUS edges (683/5998 (11.4%)); **683/40751 (1.7%)** of all definition edges.
- Fixed-50 AMBIGUOUS (Q-0012 `state: AMBIGUOUS`, `unresolved: true`): **4** / 47 resolve.
- SHA-verified reported spans: **41513**. Stored-hash mismatches: **0**.

## Per agreement

| Agreement | Def. edges | RESOLVED | AMBIGUOUS | Other states | Rule / amb. | Rule / all | Definitions heading |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `06ec30164193` | 2334 | 2301 | 33 | 0 | 0/33 (0.0%) | 0/2334 (0.0%) | SECTION 8.03 "Definitions." |
| `08fd217ea256` | 4092 | 4092 | 0 | 0 | — | 0/4092 (0.0%) | ARTICLE ARTICLE I "DEFINITIONS & INTERPRETATIONS"; SECTION 1.1 "Certain Definitions."; SECTION 1.2 "Additional Definitions." |
| `1d6bba9ac993` | 3745 | 3732 | 13 | 0 | 0/13 (0.0%) | 0/3745 (0.0%) | ARTICLE ARTICLE I "CERTAIN DEFINITIONS"; SECTION 1.1 "Certain Definitions."; SECTION 9.1 "Schedule Definitions." |
| `3888fa7618bb` | 3561 | 3561 | 0 | 0 | — | 0/3561 (0.0%) | SECTION 7.12 "Definitions." |
| `aa72f3af2931` | 2585 | 2217 | 368 | 0 | 21/368 (5.7%) | 21/2585 (0.8%) | SECTION Exhibit-A "Certain Definitions" |
| `b74ed1f02f2e` | 3754 | 3754 | 0 | 0 | — | 0/3754 (0.0%) | — (none matched) |
| `f4a123d7c2bd` | 5140 | 3193 | 1947 | 0 | 348/1947 (17.9%) | 348/5140 (6.8%) | SECTION Exhibit-A "CERTAIN DEFINITIONS" |
| `f783c4cdcaca` | 4422 | 2459 | 1963 | 0 | 270/1963 (13.8%) | 270/4422 (6.1%) | SECTION 9.03 "Definitions." |
| `fa0fff26622d` | 5190 | 3562 | 1628 | 0 | 44/1628 (2.7%) | 44/5190 (0.8%) | SECTION 9.3 "Certain Definitions." |
| `fb76ef57355b` | 5928 | 5882 | 46 | 0 | 0/46 (0.0%) | 0/5928 (0.0%) | SECTION 8.5 "Interpretation; Certain Definitions."; SECTION 8.12 "Definitions." |

## Fixed-50 AMBIGUOUS edges (47)

| # | Term | Edge | Rule | Why not |
| ---: | --- | --- | --- | --- |
| 7 | Company | `0929f4f83707f3df1ac862c77785b0479de39c0562be0c6ebb1d8c6c10b70601` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 7 | Company Options | `09e7e4ee3438f0de2d9823d9ae8d97db06625b6d1ef716b7f353d9e323f86185` | resolves | — |
| 7 | Company | `1fafce63c37fbd2322fd1bd8d66172c1150e9e3331b851ac0d32ec5269299a8d` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 7 | Company | `656c8e1bcb9cfc002d08f4d43f6186bbd866651fd6fb1d9a80148272007571f7` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 7 | Company | `74605e147e3a4c2a2c7b5ce7782315903447020f03c41ea2197fea51b4f9bdcf` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 14 | Company | `2ce12e7bc20b6cd46d131f8df533abfaf01003445f458a3d30e01d93e7b6a668` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 14 | Company | `6b1dd4f413ff5dcae5ea35eac48feb5047486bef120ad6807d2d549f57238628` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 14 | Company | `cc7bf86b6900206ac1d5509a26e115ed0f136207049b609a8c694aa74d2dff70` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 14 | Company | `f4a12e787a159dfc29e5fa28e888c175517c76cef2a3f65d1b4601407c093dcc` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 28 | Surviving Company | `aa720c178843598377cfcf1d318fa8f95d570c8a21aaeb90c7c3c4b2e7601be1` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 28 | Surviving Company | `dcb45706aca4cd243040a78a029209cf37a419a64700523a61a8e9bfdc5e5835` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 29 | Company | `ddf6168278006343cb0a8c853ee7f66aebe1c8af5e1fae517c71905eaf720344` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 38 | Parties | `4d4edbd2b1629b85b2432e618ede434a6f53b060b795faf6ab9079e0caa5049f` | resolves | — |
| 38 | Parties | `93c2bec7cd25b95ff183fabc3cbd5d1e61979e6543c60c177b6a391fd006e1a9` | resolves | — |
| 40 | Company | `f47f7a3726044c8201e5f962baa5ce8a771a334ab3552e2ce063ab54150fd92b` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 41 | Company | `7965eb608694afe9296505bd05aa4ff4a9f5645135d00336382ee6d90d75cff3` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Company | `89d4bfd5e555ad6662b2c9547d7630e2adcc4c5179046666a55c0ec5119ea1e7` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Company | `a04d431b268fc25b8b8bcb928fd89646e5f5ae25abb5cdc24efc988702312497` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Company | `a1a43864ea3c423a55070b675f878d853e12615290b2c644737ccb3d2cef46cd` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Company | `c9e700fe6fe43d41c49bb3e9a4defe32dc60f6e57bb1186b996d7612b242d464` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Surviving Corporation | `d8327bd0c55612f3ecaa57e5ee1158c7f91f8a0327a1d92f3574bc5f51e6388a` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 42 | Company | `dae268b2845cb59564364cb8f9cffca70b7a04d636d5d796afd4fcdba8d47507` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 43 | Company | `3f1684d0b1078fa7582a56e9a1a95dbdd243a8b60a7dabe451b9b089d61c127f` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 43 | Company | `a74580a41aaad4bda8c19ab6c102c4cf5484256312bb18dd27cdcb5e2c38b909` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 44 | Company | `113de5cb67b00f63b3ae0e2e276fb921811aec511ecd33f18e4c632c56f90307` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 44 | Company | `52068d1d892ffd3d64fc5c7b5a73bcde84870c63835b42baf56b96ade094d3e3` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 44 | Company | `a91da29b06273375fb2b34996fc520e7c886a20721671248c7c842dbbb2339d8` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 44 | Company | `bbbda47208d6e58a575869904c038701feea444b6703016216717e93af53f747` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 44 | Company | `d2efd693010be94a524b662fa26ab3f64a124d476adfdfc2377bd594b277811a` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 45 | Company | `08a2d76cbac85f0d1aec1a120bbe511757c72746ca0b83d52618b18bd2324c57` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 45 | Company | `1e04f2e4cedde38854a710cfea798cf1fa14274b777ebbe9c3f5c3cc4b4ab775` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 45 | Company | `40780bfa1ba7e012fe55486dca5f6ce0f587849c40bb00f2e5562df69fd94e34` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 45 | Company | `9b2b69bffb12d013bee1b5634e101f2eeb07f329df358e6d5366b097c8245444` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 45 | Company | `a50ae516997288ce4854436b07de6a1d8fb6b98a249fa6265307c1cb579ad537` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 46 | Company | `3441c177ff3e0f144faa41db2f1d7895aad8b428a001b412a546e1aaea049f06` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 46 | Company | `3b944aa7c68aee4eb0f20c7380868368ed3e142554dd8333031ae824b965d7af` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `7896d1899bf4b12c1e496eccf84140f3c2ec9cc229da16d90c91faf3c5d72bf7` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `83f3e63e33b76cf7d365c05330d459696638531816b88f923ea2a17d6d8e14d0` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `bee7676041c19e3b8c2a5327097dea3c114545a4b3135c99d82f097309f04389` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `e4942bb4be12e6d75914d0e05447d23d130e6008875d09aa01b481a8e8cb0b07` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `fd92646343ce338f439e4ebce9449566b5e4aad117cd9127c0b8f050fe67e414` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 47 | Company | `ff23526602ab69011448816a58a46c64c4e3327b396fdf575dd1cabb3aabb393` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 48 | CVR | `d95993a2363f022455a4e9402dd9337143ca79119f234801c4ea84931f3dc2d6` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 49 | Surviving Corporation | `355a2a6f677c30540aebe2a2303402c2aff5cae43ae089bfa36263b431d22b91` | not | term_defined_inline_in_the_body: 2 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 49 | Company | `c4651d35874dd6dfb5e994c4561abb5430d620ac71fe96f282f2598505f561a8` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 49 | Company | `d2b61910e032dadc5acad2e358ad9b5674629b6a1b59ac328416d9fedea1b4a3` | not | term_defined_inline_in_the_body: 3 exact-term DEFINED_TERM_DEFINITION annotation(s) lie outside the Definitions article |
| 50 | Parties | `8fd11d4683d9db85e84fd4a336c4adabb16cc0c0637618cb093f5155a0339015` | resolves | — |

