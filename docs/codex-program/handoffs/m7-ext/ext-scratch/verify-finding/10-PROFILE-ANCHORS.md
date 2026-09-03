# Q-0010 profile anchors

Rows: **1382**. Verified: **1380**. Unresolved: **2**. SHA mismatch: **0**.

Accepted pre-revision table SHA-256: `6496657a7a6283f957039b574626032e0cefd7cfe8d35042592df77288849c5f` (1,471,325 bytes).

Verified means the SHA-256 of the canonical UTF-8 bytes at the span equals `text_sha256`. Unresolved means no registry match or no usable span. Parent and nearest-M4 fields do not change verification.

## Unresolved profiles

- `PROFILE:DNO_INDEMNIFICATION:NO_ADVERSE_AMENDMENT` (DNO_INDEMNIFICATION): NO_REGISTRY_ENTRY_FOR_SIGNATURE. Signature `ALL_OF(NO_ADVERSE_AMENDMENT,NO_ADVERSE_AMENDMENT_DURATION)`.
- `PROFILE:DNO_INDEMNIFICATION:RIGHTS_SURVIVAL` (DNO_INDEMNIFICATION): NO_REGISTRY_ENTRY_FOR_SIGNATURE. Signature `ALL_OF(RIGHTS_SURVIVAL,RIGHTS_SURVIVAL_DURATION)`.

## Per family

| Family | Profiles | Verified | Unresolved | SHA mismatch | Registry spans | M4 edges |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ANTITRUST_REGULATORY | 70 | 70 | 0 | 0 | 0 | 70 |
| APPRAISAL_DISSENTERS_RIGHTS | 5 | 5 | 0 | 0 | 5 | 0 |
| CLOSING_CONDITIONS | 57 | 57 | 0 | 0 | 0 | 57 |
| CONSIDERATION | 7 | 7 | 0 | 0 | 7 | 0 |
| DIVIDENDS | 1 | 1 | 0 | 0 | 1 | 0 |
| DNO_INDEMNIFICATION | 33 | 31 | 2 | 0 | 0 | 31 |
| EMPLOYEE_MATTERS | 27 | 27 | 0 | 0 | 27 | 0 |
| FINANCING_COVENANTS | 5 | 5 | 0 | 0 | 5 | 0 |
| GENERAL_COVENANTS | 54 | 54 | 0 | 0 | 0 | 54 |
| GUARANTY_FINANCING_PARTY | 5 | 5 | 0 | 0 | 4 | 1 |
| INTERIM_OPERATING | 113 | 113 | 0 | 0 | 113 | 0 |
| KEY_DEFINED_TERMS | 76 | 76 | 0 | 0 | 76 | 0 |
| MAE_DEFINITION | 4 | 4 | 0 | 0 | 4 | 0 |
| MATERIAL_CONTRACTS | 116 | 116 | 0 | 0 | 116 | 0 |
| MERGER_STRUCTURE_CLOSING | 103 | 103 | 0 | 0 | 103 | 0 |
| MISC_BOILERPLATE | 114 | 114 | 0 | 0 | 114 | 0 |
| NO_OTHER_REPS_FRAUD | 36 | 36 | 0 | 0 | 0 | 36 |
| NO_SHOP | 365 | 365 | 0 | 0 | 365 | 0 |
| PROXY_MEETING | 31 | 31 | 0 | 0 | 31 | 0 |
| REPRESENTATIONS | 70 | 70 | 0 | 0 | 0 | 70 |
| SPECIFIC_PERFORMANCE_REMEDIES | 8 | 8 | 0 | 0 | 8 | 0 |
| TAX_MATTERS | 17 | 17 | 0 | 0 | 17 | 0 |
| TERMINATION | 45 | 45 | 0 | 0 | 45 | 0 |
| TERMINATION_FEE | 20 | 20 | 0 | 0 | 0 | 20 |

## node_kind

- (null): 2
- CHAPEAU: 132
- LIMB: 472
- PARAGRAPH: 132
- QUALIFICATION: 98
- SECTION: 18
- SENTENCE: 528

## claims_on_node

- 0: 51
- 1: 745
- 2: 329
- 3: 77
- 4: 77
- 5: 30
- 6: 12
- 7: 27
- 8: 8
- 10: 10
- 16: 16

## Verified rows with claims_on_node = 0

Verified zero-claim rows: **49**. Nearest M4 claim NONE: **13**. Overlapping M4 claim: **36**. Of those overlapping, identity mismatch (nearest claim `source_node_occurrence_id` ≠ registry node): **36**.

| Family | Zero-claim verified | NONE | Overlapping | Identity mismatch |
| --- | ---: | ---: | ---: | ---: |
| GUARANTY_FINANCING_PARTY | 4 | 4 | 0 | 0 |
| MAE_DEFINITION | 4 | 0 | 4 | 4 |
| TERMINATION | 41 | 9 | 32 | 32 |

