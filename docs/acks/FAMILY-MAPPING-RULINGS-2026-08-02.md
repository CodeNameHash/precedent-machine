# FAMILY_MAPPING_TABLE extension — Ben's rulings (2026-08-02)

Source: family-mapping review artifact; proposal in the 2026-08-02
triage/proposal cycle over the Skechers/Modiv v1 snapshots. Verbatim
decisions:

| Subtype | Ruling | Note |
|---|---|---|
| REP-B-VOTE | **MAP** | |
| REP-T-CONTROLS | **MAP** | |
| REP-T-NOLIAB | **MAP** | |
| REP-B-NOLIAB | **MAP** | |
| REP-T-PROXY | **MAP** | |
| REP-T-RPT | **MAP** | |
| REP-T-CONSENT | **OPEN** | Ben: "I think these might be different — the first 'requisite shareholder approval' looks like it's about the shareholder votes required? And the 2nd is about government approvals?" |
| REP-T-SANCTIONS | **MAP** | (SANCTIONS/ANTICORR disambiguation stays on the v1-classification backlog) |
| REP-T-REGSTATUS | **OPEN** | Ben: "I'd call this 40Act" |
| REP-B-ANTIRELIANCE | **SPLIT** | Ben: "needs splitting up between the different parts of the rep — it's important for the analysis of whether all of the elements to exclude extra-contractual fraud have been put in place" |

## Execution

1. The SEVEN mapped subtypes go into the reviewed table edit
   (identity rows), which ships with the comparator-wiring slice.
2. The three OPEN/SPLIT items get a corpus-evidence investigation
   (all deals' provision_cards, read-only) before any mapping:
   - REP-T-CONSENT: does v1 lump stockholder-approval reps and
     governmental-approval reps under one subtype corpus-wide? If so,
     the disposition is a v1 reclassification split (two subtypes),
     not an identity map of the lump.
   - REP-T-REGSTATUS: Ben's naming instinct (40Act) implies the
     subtype should be split by regulatory regime; investigate what
     the label covers across the corpus (energy regulatory vs
     Investment Company Act vs other).
   - REP-B-ANTIRELIANCE: split into its component elements per Ben's
     product rationale — the extra-contractual-fraud-exclusion
     analysis requires each element (no-other-reps, non-reliance,
     and any express fraud carve-out language) as a separate,
     queryable concept. Overlap with REP-B-NOREP resolved in the
     same pass.
3. None of the three OPEN subtypes is mapped in the interim — they
   remain typed V1_CARD_UNMAPPED (fail-closed), documented as
   expected.
