# FAMILY_MAPPING_TABLE extension — rulings (2026-08-02)

Source: family-mapping review artifact (Ben) + corpus-evidence
investigation (Sonnet, read-only against production provision_cards,
Fable-reviewed) + Fable taxonomy rulings below. Ben's verbatim
decisions first:

| Subtype | Ben's ruling | Note |
|---|---|---|
| REP-B-VOTE | **MAP** | |
| REP-T-CONTROLS | **MAP** | |
| REP-T-NOLIAB | **MAP** | |
| REP-B-NOLIAB | **MAP** | |
| REP-T-PROXY | **MAP** | |
| REP-T-RPT | **MAP** | |
| REP-T-CONSENT | OPEN → resolved below | Ben: "I think these might be different — shareholder votes vs government approvals?" |
| REP-T-SANCTIONS | **MAP** | SANCTIONS/ANTICORR disambiguation on v1 backlog |
| REP-T-REGSTATUS | OPEN → resolved below | Ben: "I'd call this 40Act" |
| REP-B-ANTIRELIANCE | **SPLIT** | Ben: elements matter for the extra-contractual-fraud-exclusion analysis |

## Corpus evidence (full report in the 2026-08-02 investigation)

- **REP-T-CONSENT (19 cards / 17 deals):** 18 are purely governmental
  approvals. ONE deal (af4940e1/Skechers) drafted "Requisite
  Stockholder Approval" (§3.4) and "Requisite Governmental Approvals"
  (§3.6) as separate sections; v1 stamped BOTH `REP-T-CONSENT`,
  collapsing a distinction the drafters themselves made. No
  target-side stockholder-approval subtype exists anywhere in the
  vocabulary (buyer side has REP-B-VOTE). Ben's suspicion CONFIRMED.
- **REP-T-REGSTATUS (10 cards / 8 deals):** a per-industry grab-bag —
  Investment Company Act of 1940 (2 cards: a267309a, dfaa71fa/Modiv),
  Investment ADVISERS Act of 1940 (4 cards — a related but DISTINCT
  statute, easy to conflate under one "40Act" label), state insurance
  licensing (2), CFIUS/critical-technologies (1), plus one miscoded
  no-foreign-operations rep (ce061fd0 §3.26).
- **REP-B-ANTIRELIANCE (26) / REP-B-NOREP (18):** asymmetric lumping.
  NOREP is nearly a clean single-element bucket (14/18 pure
  no-other-reps). ANTIRELIANCE mixes four elements: no-other-reps,
  non-reliance, independent-investigation, and (2 cards corpus-wide)
  an express fraud carve-out. The rubric's feature schema already
  models these elements; the subtype never did.

## Fable rulings (pending Ben's confirm on 1-2)

**R1 — REP-T-CONSENT splits:** `REP-T-STOCKAPPROVAL` (target
stockholder vote required; mirrors REP-B-VOTE and fixes the T/B
asymmetry) + `REP-T-GOVAPPROVAL` (governmental consents/filings — the
de facto content of 18/19 cards). v1 reclassification of the 19 cards
is mechanical (one card moves; the Bonds misclassification df393645
§3.22 exits to backlog). NEEDS BEN CONFIRM.

**R2 — REP-T-REGSTATUS splits four ways by regime:** `REP-T-40ACT`
(Investment Company Act — Ben's "40Act", exactly the Modiv card),
`REP-T-ADVISERSACT` (Advisers Act/broker-dealer registration),
`REP-T-INSREG` (insurance licensing), `REP-T-CFIUS` (national-security
status). Rationale: different statutes, regulators and diligence
questions; a single "40Act" bucket would reproduce the lumping one
level down by conflating the ICA with the Advisers Act. Low per-subtype
counts accepted — low-frequency/high-materiality is what dedicated
subtypes are for. The ce061fd0 miscode exits to backlog. NEEDS BEN
CONFIRM (his instinct named the ICA cards; this ruling refines, not
contradicts).

**R3 — REP-B-ANTIRELIANCE/NOREP element split (Ben already ruled
SPLIT; this is the design):** four subtypes —
`REP-B-NOOTHERREPS` (disclaimer that no reps were made beyond the
express ones), `REP-B-NONRELIANCE` (buyer affirmatively not relying on
extra-contractual statements), `REP-B-INDEPINVEST` (buyer conducted
independent investigation — evidentiary/estoppel-flavored, analytically
separate), `REP-B-FRAUDCARVEOUT` (express preservation of fraud
remedies notwithstanding the disclaimers). REP-B-NOREP folds into
NOOTHERREPS (drafting-convention alias, not a distinct concept).
REP-T-NOREP gets the mirrored split in the same pass. The three
regex-flagged cards were Fable-confirmed from their quoted text:
ce061fd0 §4.12 and df393645 §4.15 carry no-other-reps + non-reliance;
0d38cc1f §4.12 is independent-investigation.
IMPORTANT SEMANTIC NOTE: the elements are recorded as separately
queryable FACTS; the legal conclusion ("extra-contractual fraud
excluded") is NOT encoded as a mechanical formula over them — carve-out
scope varies (compare 885edae5's broad "except in the case of fraud"
with a267309a's narrow express-reps-only preservation) and the
Abry-line analysis is a rubric/product-layer judgment, not a subtype
boolean.

## Execution

1. Table edit slice (with comparator wiring): the SEVEN Ben-mapped
   identity rows. The split subtypes join the table only AFTER the v1
   reclassification lands and cards actually carry them.
2. v1 reclassification slice (classify rules + scripts/reprocess.js
   per-type refresh): R1/R2/R3 splits + the backlog misclassifications
   (Bonds card; Foreign Matters card; SANCTIONS/ANTICORR
   disambiguation; the four [PROPOSED] null-subtype cards). Classify
   rules are spec-on-Fable, safety-checked against all deals' section
   titles per the repo rule.
3. Rubric metadata corrections ride along: stale `industries:
   ['energy']` tags on CONSENT/REGSTATUS.

## Security flag (separate from taxonomy, surfaced to Ben)

The investigation's Supabase advisory: 19 tables in the production
project have Row Level Security DISABLED (anon read/write exposure),
including provisions_archive_20260706, deal_topology,
termination_fee_triggers. Not acted on (read-only task). Needs its own
decision/slice.
