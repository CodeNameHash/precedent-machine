# Work 2 real-text attempt record

Schema note for the Phase 1 attempt record emitted once per governed occurrence.
The run script will write this JSON beside each agreement analysis. Ext does
not seal a receipt or write under `control/`.

## Per occurrence

| Field | Phase 1 content |
| --- | --- |
| `claim_occurrence_id` | M4 claim id |
| `node_occurrence_id` | that claim's M2 node |
| `closure` | authored-unit span plus `context_spans[]` when D2 is wired |
| `family_bridge_result` | `null` |
| `subtype_candidates` | `[]` (expected empty) |
| `ledger_entries` | modal / limb / proviso hits from the Q-0018 vocabulary |
| `parser_hit_or_abstain` | `null` |
| `party_candidates_with_spans` | recorded from the Q-0021 table; not proved |
| `definition_resolution` | rule id or unresolved pair |
| `disposition` | review-only while no single profile matches |
| `issue_codes` | the D2 set, as triggered |

## Issue codes

`MATERIAL_SPAN_UNMODELLED`, `DEPENDENCY_UNRESOLVED`, `PARTY_PROOF_UNPROVED`,
`SIGNATURE_MISMATCH`, `FAMILY_CORRECTION_PENDING`, `NO_SINGLE_PROFILE`.

Every occurrence emits a record, whatever the disposition.
