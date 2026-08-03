# Target and Parent representations: native family design

## Decision

This is one native family, `REPRESENTATIONS`. It owns representations made by
the Company/Target and Parent/Buyer. Party is an evidenced attribute, not a
separate legal taxonomy.

The approved basis is the M3 parity requirement and the live product surface.
This document is a Wave A design. It does not claim the family is complete.

## Product inventory

| Surface | Current source | What it exposes | Wave A disposition |
|---|---|---|---|
| Company rows | `components/review/table-configs/representations-qualifiers.config.js` `representationsQualifiersConfig` | one row per `REP-T-*` clause, qualifier pills, lookback and bring-down | native accuracy and knowledge qualifier proposals only |
| Parent rows | same file `parentRepresentationsConfig` | same for `REP-B-*` | same |
| General-exceptions side table | same file `buildGeneralExceptionsRow` | SEC-filing cut-off, exclusions, disclosure-letter reference | follow-on, no controlled vocabulary yet |
| Knowledge side table | same file `buildKnowledgeSummaryRow` | knowledge standard and persons | standard remains a linked Definition-family fact; person list is follow-on |
| Bring-down value | same file `resolveBringDown`, sourced from `conditions.config.js` | condition-derived closing accuracy standard | closing-conditions ownership, not duplicated here |
| Compare view | `pages/compare.js` `RepsCompare` | union of target and parent categories, materiality, knowledge and lookback | qualifier values become native candidates; category identity and lookback follow on |
| Material-contracts compare side table | `pages/compare.js` `MaterialContractsCompare` | target material-contract buckets and thresholds | material-contracts family owns it |
| Query fields | `lib/query/field-meta.js`, `lib/query/serving-registry-v1.json` | all legacy REP-T/REP-B feature fields | follow-on register below |
| Market rows | `lib/market-metrics/section-rows.js` and `lib/row-market-stats/families.js` | per-row market subterms for `REP-T`/`REP-B` | native qualifier fields only; the remaining rows are follow-on |
| Browser-derived values | `representations-qualifiers.config.js` `resolveDateLookback` and `resolveBringDown` | date-term lookback resolution and condition-linked standard | follow-on and cross-family respectively |

The adjacent `material-contracts` and `no-other-reps-fraud` tables remain
separate M3 blockers. This family must not absorb them merely because their
legacy codes start with `REP-T-` or `REP-B-`.

## Corpus evidence

The checked-in 25-deal migration audit reports 261 populated
`materialityQualifier` values across target, parent and IOC cards, and 107
populated `knowledgeQualifier` values across target and parent cards.
`lookbackDateISO` is populated 16 times, all on target representations.
It reports 49 populated `knowledgeStandard` values, but that is a
Definition-linked fact, not evidence that each representation is knowledge
qualified. The audit reports zero populated values for the new SEC-filing
preamble fields. That is an extraction gap, not evidence that the clauses are
absent.

Examples requiring future treatment are visible in the live UI code:

- `REP-T-PREAMBLE` and `REP-B-PREAMBLE` carry SEC-filing and disclosure-letter
  language.
- `REP-T-NOCHANGE` carries temporal lookback and absence-of-changes forms.
- `REP-B-FUNDS` and `REP-B-SOLVENCY` are parent-specific substantive
  representations.

No Ben taxonomy decision is required for Wave A. The first decision needed is
whether a cross-deal representation-subject catalogue should be closed or
open-world. It should be made after a corpus sample of the currently rendered
category labels and counts, not from the legacy code list alone.

## Wave A: qualifier extraction

The native producer dispatches only for headings that expressly say
“Representations and Warranties”. It emits positive, byte-backed
representation instances and separate qualifier objects.

It uses the existing controlled values:

- accuracy: `MAT_ALL_RESPECTS`, `MAT_ALL_RESPECTS_DE_MINIMIS`,
  `MAT_ALL_MATERIAL`, `MAT_MATERIAL_TO_COMPANY`, `MAT_MAE_QUALIFIED`;
- knowledge: `ACTUAL`, `CONSTRUCTIVE`, `AFTER_INQUIRY`.

The producer reports qualifier position, not legal scope. It never emits an
absence result. A substantive use of “material” is a threshold candidate, not
an accuracy standard. An unfamiliar qualifier becomes open-world evidence.

The implementation reuses the established representation proposal shaper.
This is intentional: it preserves one candidate format and one evidence gate
for target and parent qualifiers. It does not yet publish a replacement for a
legacy row. The M3 register stays blocked until fixture proof, lexical recall,
registry mapping and a native resolver are complete.

## Follow-on register

| Product value | Owner | Reason it is not Wave A |
|---|---|---|
| Representation category and one row per category | REPRESENTATIONS | Requires a corpus-backed subject catalogue or an explicit open-world row model. |
| SEC-filings exception, cut-off, excluded portions and carved-out reps | REPRESENTATIONS | Needs an adjudicated distinction between filing source, exception scope and excluded content. |
| Disclosure-letter treatment | REPRESENTATIONS | Needs a controlled distinction between disclosure qualifier, cross-reference and schedule-only evidence. |
| Knowledge persons and definition text | KEY_DEFINED_TERMS + REPRESENTATIONS link | The definition owns persons and standard. The rep owns only the use and attachment. |
| Absolute and symbolic lookbacks | REPRESENTATIONS | Requires an approved date/anchor model. Browser date resolution is not a native fact. |
| Materiality scrape | CLOSING_CONDITIONS relationship | It changes the closing test. It is not a representation qualifier. |
| Bring-down standard | CLOSING_CONDITIONS relationship | Derived from the condition and must stay cross-family. |
| Absence-of-changes limbs and cited IOC sections | REPRESENTATIONS + IOC link | Requires limb identity and a cited-covenant relationship. |
| Undisclosed-liabilities exceptions | REPRESENTATIONS | List structure and exception taxonomy are not yet approved. |
| Target material-contract buckets and thresholds | MATERIAL_CONTRACTS | Existing separate product table and separate legal subject. |
| Parent sufficient-funds, solvency, ownership, litigation and brokers | REPRESENTATIONS | Needs individual positive claim shapes, not brittle section-presence flags. |
| No-other-reps, non-reliance and fraud | NO_OTHER_REPS_FRAUD | Existing separate table and different legal effect. |

## Verification

Tests prove that both target and parent article headings dispatch to
`REPRESENTATIONS`, that the new producer is registered, and that the live
provider applies the existing byte-evidence shaper to a representation
qualifier response. A recorded multi-deal fixture and a lexical-recall net are
required before the Wave A checks can pass.
