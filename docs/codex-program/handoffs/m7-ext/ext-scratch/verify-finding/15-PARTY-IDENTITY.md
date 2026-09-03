# Party-identity census (Q-0015)

Ten Work 3 agreements. M4 party is `legacy_party` on analysis claims; a party span is `legacy_claim_revision.party_source_span` or the equivalent fields inspected on the claim object. M2 party terms are the seed list plus every `DEFINED_TERM_DEFINITION` whose span sits in the preamble (AGREEMENT children before the first ARTICLE). M3 fact “kind” is the fact `role`. V2 can mint `APPLIES_TO` only from resolved `BOUND_ENTITY` relationships (`projectPartyEdges` in `m7-v2-deterministic-generator.js`).

- M4 claims: **2101**. With party: **1092**. With party span: **0**. With neither: **1009**.
- M3 `BOUND_ENTITY` relationships: **0** of 51.
- Fixed-50 items: **50**. Item 39 has no source node.
- Table SHA-256: `1984073e6ecb9d0b84b696607693910b0adca83cc814ffd18dedf43140629aa7`.

## Field cites

- M4 `legacy_party` assignment: `lib/canonical-v2/agreement-analysis.js:647` — `const legacyParty = clone(resolvedRecord.party ?? resolvedRecord.provision_instance?.party ?? null);`
- M4 `legacy_party` field: `lib/canonical-v2/agreement-analysis.js:668` — `legacy_party: legacyParty,`
- M4 `legacy_party: null` on the golden/fixture claim path: `lib/canonical-v2/agreement-analysis.js:1054` — `legacy_party: null,`
- Resolver `party_source_span`: `lib/canonical-v2/native-producer/candidate-resolution.js:6209` — `party_source_span: partySourceSpan,`
- V2 `BOUND_ENTITY` gate: `lib/canonical-v2/m7-v2-deterministic-generator.js:391` — `|| relationship.relationship_type !== 'BOUND_ENTITY'`

Inspected M4 claim objects: `legacy_party` is `{ capacity, role, value }` or null. No claim, `legacy_claim_revision`, or `legacy_party` object carries `party_source_span` / `party_span` / `source_span`. Evidence `absolute_start` / `absolute_end` and analysis `evidence_edges.source_span` are operative-text evidence, not a party span.

Seed terms `Parent`, `Merger Sub`, `Buyer`, `Purchaser`, and `Guarantor` have zero M2 definition/use annotations on most agreements. The preamble text does name Parent and Sub (often with curly quotes), but those strings are not present as `DEFINED_TERM_DEFINITION` values, so this census does not invent uses for them. One agreement annotates `Parent` and `Purchaser`.

## M3 relationship kinds

| Kind | Count |
| --- | ---: |
| `CAUSES_TO_PERFORM` | 2 |
| `CONTROLS` | 48 |
| `SUBSIDIARY_OF` | 1 |
| **Total** | 51 |

## Per-agreement counts

| Agreement | M4 claims | Party | Span | Neither | M2 party terms | M2 defs | M2 uses | M3 facts | CAPACITY | Party-naming facts | Relationships | BOUND_ENTITY |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 06ec30164193… | 155 | 121 | 0 | 34 | 11 | 6 | 1086 | 8742 | 169 | 137 | 5 | 0 |
| 08fd217ea256… | 209 | 139 | 0 | 70 | 12 | 7 | 1637 | 11638 | 182 | 233 | 6 | 0 |
| 1d6bba9ac993… | 236 | 158 | 0 | 78 | 12 | 7 | 1539 | 11880 | 96 | 252 | 8 | 0 |
| 3888fa7618bb… | 352 | 255 | 0 | 97 | 15 | 10 | 1823 | 15353 | 134 | 244 | 3 | 0 |
| aa72f3af2931… | 190 | 0 | 0 | 190 | 11 | 6 | 384 | 8645 | 107 | 302 | 3 | 0 |
| b74ed1f02f2e… | 236 | 177 | 0 | 59 | 10 | 5 | 1434 | 10903 | 167 | 163 | 6 | 0 |
| f4a123d7c2bd… | 190 | 0 | 0 | 190 | 12 | 10 | 1723 | 12062 | 159 | 378 | 5 | 0 |
| f783c4cdcaca… | 217 | 157 | 0 | 60 | 9 | 5 | 1745 | 10833 | 168 | 200 | 8 | 0 |
| fa0fff26622d… | 193 | 0 | 0 | 193 | 12 | 14 | 2117 | 11858 | 121 | 412 | 5 | 0 |
| fb76ef57355b… | 123 | 85 | 0 | 38 | 17 | 12 | 2830 | 12041 | 116 | 216 | 2 | 0 |
| **Total** | 2101 | 1092 | 0 | 1009 | — | 82 | 16318 | 113955 | 1419 | 2537 | 51 | 0 |

### Party terms per agreement

#### `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`

Preamble window bytes 0–8915 (8 AGREEMENT children). Preamble-defined terms: `Company`, `Company Board`, `Company Common Stock`, `DGCL`, `Merger`, `Neutral Platform Model`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | yes | 1 | 814 | 6727–6740 | yes |
| `Company Board` | — | yes | 1 | 39 | 7548–7567 | yes |
| `Company Common Stock` | — | yes | 1 | 62 | 8222–8248 | yes |
| `DGCL` | — | yes | 1 | 14 | 7045–7055 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 1 | 155 | 6896–6908 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Neutral Platform Model` | — | yes | 1 | 2 | 8451–8479 | yes |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Purchaser` | yes | — | 0 | 0 | — | — |

#### `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`

Preamble window bytes 0–8638 (13 AGREEMENT children). Preamble-defined terms: `Company`, `DGCL`, `Guaranty`, `Independent Committee`, `Merger`, `Party`, `Support Agreement`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | yes | 1 | 1224 | 5352–5365 | yes |
| `DGCL` | — | yes | 1 | 26 | 6063–6073 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Guaranty` | — | yes | 1 | 18 | 8249–8263 | yes |
| `Independent Committee` | — | yes | 1 | 4 | 5690–5717 | yes |
| `Merger` | — | yes | 1 | 275 | 5972–5984 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Party` | — | yes | 1 | 76 | 5441–5453 | yes |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Support Agreement` | — | yes | 1 | 14 | 7640–7663 | yes |

#### `1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116`

Preamble window bytes 0–7130 (8 AGREEMENT children). Preamble-defined terms: `Code`, `Company`, `Company Board`, `Merger`, `Merger Sub Board`, `Parent Board`, `Parent Stock Issuance`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Code` | — | yes | 1 | 30 | 6669–6679 | yes |
| `Company` | yes | yes | 1 | 1192 | 4456–4469 | yes |
| `Company Board` | — | yes | 1 | 53 | 4524–4543 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 1 | 199 | 4742–4754 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Merger Sub Board` | — | yes | 1 | 2 | 5874–5896 | yes |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Parent Board` | — | yes | 1 | 53 | 5170–5188 | yes |
| `Parent Stock Issuance` | — | yes | 1 | 10 | 5472–5499 | yes |
| `Purchaser` | yes | — | 0 | 0 | — | — |

#### `3888fa7618bbd9fd6530b657aaa18c7e85ff515acf80edb1fc78a190af86e9cb`

Preamble window bytes 0–8597 (11 AGREEMENT children). Preamble-defined terms: `Code`, `Company`, `Company Board`, `Company Shares`, `Integrated Transaction`, `Parent Board`, `Parent Share Issuance`, `Parent Shares`, `Treasury Regulations`, `party`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Code` | — | yes | 1 | 39 | 7654–7664 | yes |
| `Company` | yes | yes | 1 | 1394 | 3512–3525 | yes |
| `Company Board` | — | yes | 1 | 45 | 5408–5427 | yes |
| `Company Shares` | — | yes | 1 | 93 | 5883–5903 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Integrated Transaction` | — | yes | 1 | 5 | 7460–7488 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Parent Board` | — | yes | 1 | 41 | 4538–4556 | yes |
| `Parent Share Issuance` | — | yes | 1 | 12 | 4752–4779 | yes |
| `Parent Shares` | — | yes | 1 | 49 | 4698–4717 | yes |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Treasury Regulations` | — | yes | 1 | 4 | 7787–7813 | yes |
| `party` | — | yes | 1 | 141 | 3640–3651 | yes |

#### `aa72f3af29316df52ab5cb75eb2b0bb0a5b31036bd24c7f812241c5a688f4319`

Preamble window bytes 0–8410 (9 AGREEMENT children). Preamble-defined terms: `Agreement Date`, `Company Board`, `Merger`, `Reorganization Transactions`, `Transaction Agreement`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Agreement Date` | — | yes | 1 | 78 | 4945–4965 | yes |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | — | 0 | 0 | — | — |
| `Company Board` | — | yes | 1 | 41 | 6487–6506 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 2 | 227 | 5701–5713 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Reorganization Transactions` | — | yes | 1 | 23 | 7722–7755 | yes |
| `Transaction Agreement` | — | yes | 1 | 15 | 7603–7630 | yes |

#### `b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363`

Preamble window bytes 0–9904 (11 AGREEMENT children). Preamble-defined terms: `Company`, `DGCL`, `First Merger`, `Parent Common Stock Issuance`, `Voting Agreement`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | yes | 1 | 1395 | 5198–5211 | yes |
| `DGCL` | — | yes | 1 | 19 | 5822–5832 | yes |
| `First Merger` | — | yes | 1 | 7 | 5913–5931 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Parent Common Stock Issuance` | — | yes | 1 | 1 | 6511–6545 | yes |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Voting Agreement` | — | yes | 1 | 12 | 9377–9399 | yes |

#### `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`

Preamble window bytes 0–8253 (11 AGREEMENT children). Preamble-defined terms: `Company`, `Company Board`, `Company Board Recommendation`, `DGCL`, `Merger`, `Surviving Corporation`, `Voting Agreement`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | yes | 3 | 1386 | 5001–5014 | yes |
| `Company Board` | — | yes | 1 | 40 | 5914–5933 | yes |
| `Company Board Recommendation` | — | yes | 1 | 7 | 6512–6546 | yes |
| `DGCL` | — | yes | 1 | 28 | 5670–5680 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 1 | 208 | 5741–5753 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Surviving Corporation` | — | yes | 2 | 51 | 5838–5865 | yes |
| `Voting Agreement` | — | yes | 1 | 3 | 7496–7518 | yes |

#### `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`

Preamble window bytes 0–10582 (89 AGREEMENT children). Preamble-defined terms: `Company`, `DGCL`, `Merger`, `Voting and Support Agreements`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Company` | yes | yes | 2 | 1489 | 8283–8296 | yes |
| `DGCL` | — | yes | 1 | 9 | 8717–8727 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 1 | 240 | 8641–8653 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Purchaser` | yes | — | 0 | 0 | — | — |
| `Voting and Support Agreements` | — | yes | 1 | 7 | 9841–9876 | yes |

#### `fa0fff26622d0e90b47c3df527ccff91f4daa3db12f08d3832de76d8ae7541b5`

Preamble window bytes 0–9504 (107 AGREEMENT children). Preamble-defined terms: `CVR Agreement`, `Closing Amount`, `Company`, `Company Board`, `DGCL`, `Merger`, `Rights Agent`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `CVR Agreement` | — | yes | 1 | 19 | 6324–6343 | yes |
| `Closing Amount` | — | yes | 1 | 16 | 5992–6012 | yes |
| `Company` | yes | yes | 3 | 1031 | 5320–5333 | yes |
| `Company Board` | — | yes | 1 | 44 | 7472–7491 | yes |
| `DGCL` | — | yes | 1 | 28 | 6983–6993 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Merger` | — | yes | 3 | 111 | 6874–6886 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 1 | 431 | 308301–308313 | yes |
| `Purchaser` | yes | — | 1 | 265 | 310073–310088 | yes |
| `Rights Agent` | — | yes | 2 | 172 | 6457–6475 | yes |

#### `fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c`

Preamble window bytes 0–13156 (13 AGREEMENT children). Preamble-defined terms: `Class C Units`, `Class X Units`, `Company`, `Company Board`, `Company Common Stockholders`, `Company Merger`, `DRULPA`, `Intended Income Tax Treatment`, `MGCL`, `Parent Board`, `Partnership`, `Partnership Units`.

| Term | Seed | Preamble | Defs | Uses | First definition span | SHA verified |
| --- | --- | --- | ---: | ---: | --- | --- |
| `Buyer` | yes | — | 0 | 0 | — | — |
| `Class C Units` | — | yes | 1 | 14 | 8231–8250 | yes |
| `Class X Units` | — | yes | 1 | 14 | 8298–8317 | yes |
| `Company` | yes | yes | 1 | 2074 | 6253–6266 | yes |
| `Company Board` | — | yes | 1 | 38 | 8576–8595 | yes |
| `Company Common Stockholders` | — | yes | 1 | 26 | 9220–9253 | yes |
| `Company Merger` | — | yes | 1 | 276 | 7154–7174 | yes |
| `DRULPA` | — | yes | 1 | 10 | 7913–7925 | yes |
| `Guarantor` | yes | — | 0 | 0 | — | — |
| `Intended Income Tax Treatment` | — | yes | 1 | 6 | 12653–12688 | yes |
| `MGCL` | — | yes | 1 | 11 | 7374–7384 | yes |
| `Merger Sub` | yes | — | 0 | 0 | — | — |
| `Parent` | yes | — | 0 | 0 | — | — |
| `Parent Board` | — | yes | 1 | 2 | 9492–9510 | yes |
| `Partnership` | — | yes | 1 | 299 | 6342–6359 | yes |
| `Partnership Units` | — | yes | 1 | 60 | 8498–8521 | yes |
| `Purchaser` | yes | — | 0 | 0 | — | — |

## Fixed-50 source mix

| Sources | Items |
| --- | ---: |
| M2 | 21 |
| M2+M3 | 6 |
| M4 | 2 |
| M4+M2 | 13 |
| M4+M2+M3 | 3 |
| NONE | 4 |
| NO_SOURCE_NODE | 1 |

| Party-word location | Items |
| --- | ---: |
| ARTICLE_CHAPEAU_ONLY | 2 |
| NONE | 6 |
| NO_SOURCE_NODE | 1 |
| OWN_NODE | 41 |

| # | Family | Sources | M4 party | M2 terms | M3 | Location | Span |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | EMPLOYEE_MATTERS | M2+M3 | — | `Company` | 2 naming / 0 rel / 0 CAPACITY | OWN_NODE | 212249–212256 |
| 2 | TERMINATION | M4+M2 | Parent | `Company`, `Merger` | — | OWN_NODE | 229065–229072 |
| 3 | GENERAL_COVENANTS | M4+M2 | the Company | `Company`, `Company Common Stock` | — | OWN_NODE | 198801–198808 |
| 4 | CLOSING_CONDITIONS | M4+M2 | Either Principal Party | `Merger` | — | OWN_NODE | 219430–219436 |
| 5 | MAE_DEFINITION | M4+M2 | the Company and its Subsidiaries | `Company` | — | OWN_NODE | 243506–243513 |
| 6 | KEY_DEFINED_TERMS | NONE | — | — | — | NONE | — |
| 7 | REPRESENTATIONS | M2+M3 | — | `Company`, `Merger` | 4 naming / 0 rel / 0 CAPACITY | OWN_NODE | 39219–39226 |
| 8 | INTERIM_OPERATING | M4 | the Company | — | — | NONE | — |
| 9 | NO_SHOP | M4+M2 | the Company | `Company`, `Company Board` | — | OWN_NODE | 141026–141033 |
| 10 | DNO_INDEMNIFICATION | M2 | — | `Company`, `Merger` | — | OWN_NODE | 189821–189828 |
| 11 | NO_OTHER_REPS_FRAUD | M4+M2+M3 | Company | `Company` | 2 naming / 0 rel / 4 CAPACITY | OWN_NODE | 101608–101615 |
| 12 | ANTITRUST_REGULATORY | M4 | each | — | — | NONE | — |
| 13 | APPRAISAL_DISSENTERS_RIGHTS | M2 | — | `Company`, `DGCL` | — | OWN_NODE | 83738–83745 |
| 14 | CAPITALISATION | M2 | — | `Company`, `Merger` | — | OWN_NODE | 37011–37018 |
| 15 | CONSIDERATION | M2+M3 | — | `Company`, `Company Common Stock`, `DGCL`, `Merger` | 1 naming / 0 rel / 0 CAPACITY | OWN_NODE | 17741–17748 |
| 16 | DIVIDENDS | M2 | — | `Company`, `Merger` | — | OWN_NODE | 263826–263833 |
| 17 | FINANCING_COVENANTS | M2 | — | `Merger` | — | OWN_NODE | 283084–283090 |
| 18 | GUARANTY_FINANCING_PARTY | M2 | — | `Company`, `Merger` | — | OWN_NODE | 198114–198120 |
| 19 | MATERIAL_CONTRACTS | M4+M2 | the Company | `Company` | — | OWN_NODE | 56155–56162 |
| 20 | MERGER_STRUCTURE_CLOSING | M2 | — | `Company`, `DGCL` | — | OWN_NODE | 12826–12833 |
| 21 | MISC_BOILERPLATE | NONE | — | — | — | NONE | — |
| 22 | PROXY_MEETING | M2 | — | `Company`, `Company Board` | — | OWN_NODE | 153369–153376 |
| 23 | SPECIFIC_PERFORMANCE_REMEDIES | M2 | — | `Company`, `Merger` | — | OWN_NODE | 262374–262381 |
| 24 | TAX_MATTERS | M2+M3 | — | `Company`, `Merger` | 2 naming / 0 rel / 0 CAPACITY | OWN_NODE | 315330–315337 |
| 25 | TERMINATION_FEE | M4+M2 | the Company | `Company` | — | OWN_NODE | 193891–193898 |
| 26 | REPRESENTATIONS | M2 | — | `Company`, `Parent`, `Purchaser` | — | ARTICLE_CHAPEAU_ONLY | 53139–53146 |
| 27 | REPRESENTATIONS | M2 | — | `Merger` | 2 CAPACITY only | ARTICLE_CHAPEAU_ONLY | 32235–32241 |
| 28 | DNO_INDEMNIFICATION | M2 | — | `Company` | — | OWN_NODE | 283589–283596 |
| 29 | MAE_DEFINITION | M4+M2 | the Company | `Company`, `Merger` | — | OWN_NODE | 241895–241902 |
| 30 | NO_OTHER_REPS_FRAUD | M4+M2+M3 | Company | `Company`, `Voting Agreement` | 2 naming / 0 rel / 0 CAPACITY | OWN_NODE | 168685–168692 |
| 31 | NO_SHOP | M4+M2+M3 | the Parent Board | `Company`, `Parent Board` | 1 naming / 0 rel / 0 CAPACITY | OWN_NODE | 185802–185814 |
| 32 | KEY_DEFINED_TERMS | M2 | — | `Company` | — | OWN_NODE | 243127–243134 |
| 33 | MAE_DEFINITION | M4+M2 | the Company and its Subsidiaries | `Company` | — | OWN_NODE | 244448–244455 |
| 34 | MAE_DEFINITION | M4+M2 | the Company and its Subsidiaries | `Company` | — | OWN_NODE | 244897–244904 |
| 35 | MAE_DEFINITION | M4+M2 | the Company and its Subsidiaries | `Company` | — | OWN_NODE | 244161–244168 |
| 36 | MAE_DEFINITION | M4+M2 | the Company and its Subsidiaries | `Company` | — | OWN_NODE | 245468–245475 |
| 37 | MATERIAL_CONTRACTS | M4+M2 | the Company | `Company` | — | OWN_NODE | 56798–56805 |
| 38 | ANTITRUST_REGULATORY | NONE | — | — | — | NONE | — |
| 39 | — | NO_SOURCE_NODE | — | `Company` | — | NO_SOURCE_NODE | 229456–229463 |
| 40 | CLOSING_CONDITIONS | M2 | — | `Company`, `Merger` | — | OWN_NODE | 213144–213151 |
| 41 | CONSIDERATION | M2 | — | `Company`, `Merger` | — | OWN_NODE | 19516–19522 |
| 42 | DNO_INDEMNIFICATION | M2 | — | `Company`, `Surviving Corporation` | — | OWN_NODE | 189561–189568 |
| 43 | EMPLOYEE_MATTERS | M2 | — | `Company`, `Merger` | — | OWN_NODE | 104045–104052 |
| 44 | GENERAL_COVENANTS | M2+M3 | — | `Company` | 4 naming / 0 rel / 0 CAPACITY | OWN_NODE | 129402–129409 |
| 45 | INTERIM_OPERATING | M2+M3 | — | `Company` | 4 naming / 0 rel / 0 CAPACITY | OWN_NODE | 132994–133001 |
| 46 | KEY_DEFINED_TERMS | M2 | — | `Company` | — | OWN_NODE | 254023–254030 |
| 47 | MAE_DEFINITION | M2 | — | `Company`, `Merger` | — | OWN_NODE | 282309–282316 |
| 48 | MAE_DEFINITION | M2 | — | `Merger` | — | OWN_NODE | 286029–286035 |
| 49 | MERGER_STRUCTURE_CLOSING | M2 | — | `Company`, `DGCL`, `Merger`, `Surviving Corporation` | — | OWN_NODE | 8397–8401 |
| 50 | MISC_BOILERPLATE | NONE | — | — | — | NONE | — |

Item 39 is the parser-ambiguity member and has no `source_node_occurrence_id`. M4 intersecting claims and M3 target-node attachment therefore cannot fire. An M2 `Company` use still overlaps the identity source span (bytes 229456–229463); that is recorded on the row but the source mix stays `NO_SOURCE_NODE`.

