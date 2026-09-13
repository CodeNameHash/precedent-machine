# Table shapes and vocabularies for Ben's check, 2026-09-12 (pass 2)

Status: DECIDED 2026-09-13, encoded in table-shapes.v3.json. This note originally superseded the pass-1 readout of the same name for every section below -- pass 1 got the sections and column headers right from `components/review/table-configs/*.config.js` but left most columns `verbatim` because the legacy code composes pills inside render functions, not in a label map a static parser can see. Pass 2 (`contracts/product/table-shapes.v2.json`, built by `scripts/product/build-table-shapes-pass2.js`) filled those columns from the print of the actual TopBuild / QXO review page you supplied (`docs/codex-program/notes/TopBuild-Review-2026-09-12.pdf`, text in `fixtures/product/topbuild-review/print-text.v1.json`), plus the label maps pass 1 never opened (`lib/employee-benefits.js`, `fiduciary-standard-labels.js`, `vote-standard.js`, `board-change-standard.js`, `ioc-exceptions.config.js`'s `FRAGMENT_NAME_PATTERNS`). Pass 3 (`contracts/product/table-shapes.v3.json`, built by `scripts/product/build-table-shapes-pass3.js`) applies your answers below, under "Ben's answers, 2026-09-13", as data on top of the pass-2 contract; the section tables below are regenerated to show the v3 shape.

**Order.** Sections below run in the order they appear in your print (page numbers noted per section), not the review page's left-nav mount order pass 1 used -- so this document reads the way your print reads. The four sections at the end (Approvals / Votes, Shareholder Meeting / Proxy, Antitrust / Regulatory, Advisers / Fees / Expenses) are carried over from pass 1 unchanged: nothing in this deal's print showed a distinct pill table for them, so there is no print evidence to add. That does not mean the underlying legacy config renders nothing on a different deal -- it means TopBuild's own review page does not exercise it.

**Never-invent guarantee.** Every vocabulary entry marked `(print p.N, row "...")` below is checked, by the generator itself, to appear verbatim (modulo the PDF's own line-wrapping) on that exact page of the committed print fixture -- the build throws rather than writes a label that isn't really there. Entries marked `(legacy label map)` come from a label map or classifier function read the same static way pass 1 read its config files (never `require()`d and executed). A **Proposed addition** is neither: it is new structure this task's Part 2 asked for, drawn from the V2 schema's families/subtypes/layer rules or from a legacy code path the print happens not to exercise on this deal -- always followed by the reason in *italics*, always kept out of the harvested vocabulary count.

**Reading each entry.** `render` is `vocabulary` (a pill from a closed set), `value` (a composed value, e.g. amount/period, with an optional `trigger` vocabulary for a fixed trigger set), `boolean`, `verbatim` (free text, no fixed vocabulary), or `term`. `rows_are: fixed list` means the table always shows the same named rows; `additional_fixed_row_labels` are Part-2 proposed rows the legacy code supports but this deal doesn't populate. `fill_from` names the FACT_COMPONENTS/V2 component kinds (`contracts/product/fact-components.v2.json`) a conclusions layer should validate that column's value against.

---

## Structure & Mechanics

- Section key: `structure-mechanics`
- Legacy config: `components/review/table-configs/structure-mechanics.config.js`
- Print pages: 1
- V2 family mapping: MERGER_STRUCTURE_CLOSING (confidence: high)

### Table: `structure-mechanics-table` (v3)

- Row subject: **Term**
- Rows: one per subject
- `per_step_structure`: applies when `dealStructure` is `DOUBLE_MERGER` -- Step 1 (`mergerFormStep1`, `survivingEntityStep1`), Step 2 (`mergerFormStep2`, `survivingEntityStep2`).
- Rows: `one per agreement`, rendered as an attribute grid (`layout: attribute grid`, TERM / PROVISION, one line per column, the legacy print p.1 shape). Ben, 2026-09-13 17:30 UTC, on the first Metsera V9 render as a wide per-fact table: "this doesn't look great...we designed something that was a bespoke grid here not this weird table?" Every structure fact fills the single row together; "See provision" on each line lists the facts behind it.

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Deal Structure (`dealStructure`) | vocabulary | "One-step merger" (`ONE_STEP_MERGER`, display variant "One Step Merger" (print p.1, row "Deal structure")); "Double merger (reverse triangular merger followed by a second-step forward merger)" (`DOUBLE_MERGER`, addition); "Tender offer with back-end merger" (`TENDER_OFFER_BACK_END_MERGER`, addition) | STANDARD |
| Merger Form (`signals`) | vocabulary_ref: `MERGER_FORM` (shared) | "Reverse triangular merger" (both; print p.1, row "Merger form"); "Forward triangular merger" (print p.1, row "Merger form"); "Forward merger" (legacy label map) | OPERATION, ACTOR, OBJECT |
| Merger Form — Step 1 (`mergerFormStep1`) — **proposed addition** | vocabulary_ref: `MERGER_FORM` (shared) | *(same shared vocabulary as Merger Form)* | OPERATION, ACTOR, OBJECT |
| Surviving Entity — Step 1 (`survivingEntityStep1`) — **proposed addition** | term | (the named surviving entity) | TERM |
| Merger Form — Step 2 (`mergerFormStep2`) — **proposed addition** | vocabulary_ref: `MERGER_FORM` (shared) | *(same shared vocabulary as Merger Form)* | OPERATION, ACTOR, OBJECT |
| Surviving Entity — Step 2 (`survivingEntityStep2`) — **proposed addition** | term | (the named surviving entity) | TERM |
| Closing Location (`closingLocation`) | verbatim | (free text / composed value) | OPERATION |
| Closing Timing (`closingTiming`) | verbatim | (free text / composed value) | OPERATION |
| Effective Time (`effectiveTime`) | verbatim | (free text / composed value) | OPERATION |
| Effects of Merger (`effectsOfMerger`) | vocabulary | "DGCL" (print p.1, row "Effects of merger"); "DLLCA" (print p.1, row "Effects of merger") | STANDARD |

  Ben's decision 2026-09-13 #1-#2: "One Step Merger" is wrong for a merger sub merging into the target followed by the surviving corporation merging into a second merger sub -- that is a **double merger** (Cadwalader, "Multiple Step Acquisitions"; the IRS Double Merger Ruling), whose second step agreements label a **Second-Step Forward Merger** (Law Insider sample clause language). "Two-step merger" is avoided as a name because it is also used for a tender offer followed by a back-end merger. TopBuild's own deal is recoded `DOUBLE_MERGER`; "One Step Merger" survives only as a display variant of `ONE_STEP_MERGER` for a deal that is genuinely one-step. Merger form now records Reverse triangular merger, Forward triangular merger and Forward merger as three distinct codes (previously "Reverse triangular merger" was harvested twice, once from the legacy label map and once from the print, as if they were different); the structure family records which form applies from the "merge with and into" language and which entity survives, one form and one surviving entity per step for a double merger.


## Consideration

- Section key: `consideration-hero`
- Legacy config: `components/review/table-configs/consideration-hero.config.js`
- Print pages: 4, 5
- V2 family mapping: CONSIDERATION (confidence: high)

v3 as regenerated 2026-09-13 (generator decision 18, Ben on Metsera: "cash election - (i) there is no cash election and (ii) you missed the CVR portion of the consideration"): the three legacy tables below were harvested from TopBuild, an election deal, and could only name "Cash Election" / "Stock Election" and election codes. They are replaced by a deal-agnostic set: `consideration-structure` (attribute grid for the deal: consideration type with codes All cash / All stock / Cash and stock (fixed mix) / Cash plus CVR / Stock plus CVR plus the three election codes; appraisal rights; withholding; without interest), `consideration-components` (one row per limb: form Cash / Acquirer stock / CVR / Cash election / Stock election / Other; amount or ratio; per; contingent on; defined as), `consideration-exchange-mechanics` (one row per paying-agent step: provision, timing, who), and the legacy `consideration-hero-election-mechanics` kept for election deals only, with guidance telling the extractor never to place a fact there when the agreement has no election. Every added label is marked as an addition with its reason. The legacy tables are recorded below as harvested.

### Table: `consideration-hero-summary` (legacy, replaced)

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Cash Election", "Stock Election"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | value / AMOUNT | (free text / composed value) | THRESHOLD, AMOUNT |

### Table: `consideration-hero-election-mechanics` — group header **ELECTION MECHANICS**

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: fixed list
- Fixed rows: "Election caps", "Election deadline", "Oversubscription / proration", "If no election"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |

### Table: `consideration-hero-table`

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Consideration type", "Appraisal rights", "Withholding"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Detail (`considerationType`) | vocabulary | "Mixed election" (print p.5, row "Consideration type") | STANDARD |
  Proposed addition codes for **Detail**:
  - "All-cash election" — *CONSIDERATION/ELECTION supports an all-cash deal with no stock election; not shown on this mixed-election deal but needed for the axis to be comparable across deals.*
  - "All-stock election" — *CONSIDERATION/ELECTION supports an all-stock deal with no cash election; same reasoning.*


## Equity Awards

- Section key: `equity-awards`
- Legacy config: `components/review/table-configs/equity-awards.config.js`
- Print pages: 15, 16, 17
- V2 family mapping: CONSIDERATION (confidence: high)

### Table: `equity-awards-table`

- Row subject: **Equity Type**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Consideration (`consideration`) | vocabulary | "Cash" (print p.15, row "Stock Options"); "Parent stock / rollover" (print p.15, row "RSUs"); "Cancelled — no consideration" (legacy label map) | STANDARD |
| Vesting Treatment (`vestingTreatment`) | vocabulary | "Cancelled — no consideration" (legacy label map); "Continues vesting (double-trigger protection)" (print p.15, row "PSUs"); "Assumed by Parent" (legacy label map); "Pro-rata acceleration" (legacy label map); "Rollover into Parent award" (legacy label map); "Fully vested (accelerated)" (print p.15, row "Restricted Stock Awards"); "Cancelled for cash consideration" (print p.15, row "Stock Options") | STANDARD |
| CVR Entitlement (`cvrEntitlement`) | vocabulary | *(all proposed -- see below)* | STANDARD |
  Proposed addition codes for **CVR Entitlement** (v3, Ben's decision 2026-09-13 #3):
  - "Entitled" — *CONSIDERATION/CVR_COMPONENT supports a CVR entitlement carried through to converted equity awards; this deal shows no CVR (all four rows print "—"), so only the absent/entitled axis is proposed, not a label drawn from this print.*
  - "Not entitled" — *complement of the above; matches the "—" seen on every row of this deal's CVR Entitlement column.*
  - "Entitled if a milestone brings the award into the money (spread over exercise price on cash plus CVR)" — *a milestone-linked entitlement; the extractor looks for the earn-in language that puts the award in the money, valued as the spread over the exercise price on cash plus CVR.*


## Representations & Warranties

v3 as regenerated 2026-09-13 (generator decision 20, Ben on Metsera): rows are the precedent's twenty representation names (TopBuild print pp.17-19) as a fixed list open to a new name when none fits; a limb of a representation is a sub-item (`row_detail`) shown under its rep, whose own line gives the overview; the bring-down column is derived from the CLOSING_CONDITIONS bring-down facts by cross-reference and is never coded from a representation. — Company

- Section key: `representations-qualifiers`
- Legacy config: `components/review/table-configs/representations-qualifiers.config.js`
- Print pages: 17, 18, 19
- V2 family mapping: REPRESENTATIONS (confidence: high)

### Table: `representations-qualifiers-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Bring-down Standard (`bringdown`) | vocabulary_ref: `BRING_DOWN_STANDARD` (shared with Closing Conditions) | `TRUE_IN_ALL_RESPECTS` (display variants: "Bringdown: In all respects", print p.18, row "Absence of Certain Changes or Events"; "TRUE IN ALL RESPECTS", print p.115); `TRUE_EXCEPT_DE_MINIMIS` (display variants: "Bringdown: De minimis", print p.17, row "Capitalization; Subsidiaries"; "TRUE EXCEPT FOR DE MINIMIS INACCURACIES", print p.115); `TRUE_IN_ALL_MATERIAL_RESPECTS` (display variants: "Bringdown: In all material respects", print p.17, row "Organization; Qualification; Standing"; "TRUE IN ALL MATERIAL RESPECTS", print p.115); `TRUE_EXCEPT_NO_MAE` (display variants: "Bringdown: MAE", print p.18, row "No Conflict; Required Filings and Consents"; "TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE", print p.115) | STANDARD, MATERIALITY_QUALIFIER |
| Qualifiers (`materiality`) | vocabulary | "MAE (aggregate) (partial)" (print p.17, row "Organization; Qualification; Standing"); "MAE (aggregate)" (print p.18, row "Litigation; Legal Proceedings"); "Material (to the rep) (partial)" (print p.17, row "Capitalization; Subsidiaries"); "Material (to the rep)" (print p.18, row "SEC Documents; Financial Statements"); "Knowledge-qualified (partial)" (print p.18, row "No Conflict; Required Filings and Consents"); "True in all material respects (partial)" (print p.19, row "Information Supplied / Proxy Statement") | STANDARD, MATERIALITY_QUALIFIER |
| Lookback (`lookback`) | value / PERIOD, `hover: 'date'` | a relative period computed from a date (e.g. "≈3.3 yrs"), the underlying date shown on hover | PERIOD, DATE |

  v3 (Ben's decision 2026-09-13 #4): the reps' own Bring-down Standard and the Closing Conditions bring-down tiers are the same four-tier concept, so both now reference one shared `BRING_DOWN_STANDARD` vocabulary by id, each code carrying both print renderings (the reps page's lower-case "Bringdown: X" pill and the Closing Conditions page's upper-case "TRUE ... " pill) as display variants of the same code. The rep's own qualifier standard (`materiality`) stays a separate column, unaffected. Decision #5: Lookback renders as a computed PERIOD value with the source date on hover, so deals compare on the same axis instead of a free-text date string.

## Representations & Warranties — Parent

- Section key: `parent-representations-qualifiers`
- Legacy config: `components/review/table-configs/representations-qualifiers.config.js`
- Print pages: 47, 48
- V2 family mapping: REPRESENTATIONS (confidence: high)

### Table: `parent-representations-qualifiers-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Bring-down Standard (`bringdown`) | vocabulary_ref: `BRING_DOWN_STANDARD` (shared with Closing Conditions) | `TRUE_IN_ALL_RESPECTS` (display variants: "Bringdown: In all respects", print p.18, row "Absence of Certain Changes or Events"; "TRUE IN ALL RESPECTS", print p.115); `TRUE_EXCEPT_DE_MINIMIS` (display variants: "Bringdown: De minimis", print p.17, row "Capitalization; Subsidiaries"; "TRUE EXCEPT FOR DE MINIMIS INACCURACIES", print p.115); `TRUE_IN_ALL_MATERIAL_RESPECTS` (display variants: "Bringdown: In all material respects", print p.17, row "Organization; Qualification; Standing"; "TRUE IN ALL MATERIAL RESPECTS", print p.115); `TRUE_EXCEPT_NO_MAE` (display variants: "Bringdown: MAE", print p.18, row "No Conflict; Required Filings and Consents"; "TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE", print p.115) | STANDARD, MATERIALITY_QUALIFIER |
| Qualifiers (`materiality`) | vocabulary | "MAE (aggregate) (partial)" (print p.17, row "Organization; Qualification; Standing"); "MAE (aggregate)" (print p.18, row "Litigation; Legal Proceedings"); "Material (to the rep) (partial)" (print p.17, row "Capitalization; Subsidiaries"); "Material (to the rep)" (print p.18, row "SEC Documents; Financial Statements"); "Knowledge-qualified (partial)" (print p.18, row "No Conflict; Required Filings and Consents"); "True in all material respects (partial)" (print p.19, row "Information Supplied / Proxy Statement") | STANDARD, MATERIALITY_QUALIFIER |
| Lookback (`lookback`) | value / PERIOD, `hover: 'date'` | a relative period computed from a date (e.g. "≈3.3 yrs"), the underlying date shown on hover | PERIOD, DATE |

  v3 (Ben's decision 2026-09-13 #4): the reps' own Bring-down Standard and the Closing Conditions bring-down tiers are the same four-tier concept, so both now reference one shared `BRING_DOWN_STANDARD` vocabulary by id, each code carrying both print renderings (the reps page's lower-case "Bringdown: X" pill and the Closing Conditions page's upper-case "TRUE ... " pill) as display variants of the same code. The rep's own qualifier standard (`materiality`) stays a separate column, unaffected. Decision #5: Lookback renders as a computed PERIOD value with the source date on hover, so deals compare on the same axis instead of a free-text date string.

## Material Contracts

- Section key: `material-contracts`
- Legacy config: `components/review/table-configs/material-contracts.config.js`
- Print pages: 65, 66
- V2 family mapping: MATERIAL_CONTRACTS (confidence: high)

### Table: `material-contracts-table`

- Row subject: **Contract Type**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Contract Type (`contractType`) | vocabulary | "M&A / acquisition agreements" (print p.65, row "M&A / acquisition agreements"); "Hedging and derivative contracts" (print p.65, row "Hedging and derivative contracts"); "Capital expenditure commitments" (print p.65, row "Capital expenditure commitments"); "Non-competition / non-solicitation agreements" (print p.65, row "Non-competition / non-solicitation agreements"); "Inbound IP licenses" (print p.65, row "Inbound IP licenses"); "Joint ventures / partnerships" (print p.65, row "Joint ventures / partnerships"); "Indebtedness contracts" (print p.65, row "Indebtedness contracts"); "Contracts above an aggregate-payments threshold" (print p.65, row "Contracts above an aggregate-payments threshold"); "Agreements with ROFO/ROFN" (print p.65, row "Agreements with ROFO/ROFN"); "Exclusivity / most-favored-nation / standstill" (print p.66, row "Exclusivity / most-favored-nation / standstill"); "M&A agreements with ongoing obligations" (print p.66, row "M&A agreements with ongoing obligations"); "Other material contracts" (print p.66, row "Other material contracts"); "Outbound IP licenses" (print p.66, row "Outbound IP licenses"); "Contracts above an aggregate-payments threshold" [info] (print p.66, row "Contracts above an aggregate-payments threshold"); "Settlement / consent agreements" (print p.66, row "Settlement / consent agreements"); "SEC Item 601(b) contracts" (print p.66, row "SEC Item 601(b) contracts"); "Supplier agreements" (print p.66, row "Supplier agreements"); "Real estate leases" (print p.66, row "Real estate leases") | STANDARD |
| Threshold (`threshold`) | value / AMOUNT | (free text / composed value) | THRESHOLD, AMOUNT |
| Not Covered (`uncoveredBucket`) | vocabulary | "Manufacturing agreements" [missing] (print p.66, row "Manufacturing agreements"); "Distribution / reseller agreements" [missing] (print p.66, row "Distribution / reseller agreements"); "Collaboration / R&D agreements" [missing] (print p.66, row "Collaboration / R&D agreements"); "Key employment / executive agreements" [missing] (print p.66, row "Key employment / executive agreements"); "Government contracts" [missing] (print p.66, row "Government contracts"); "Affiliate / related-party transactions" [missing] (print p.66, row "Affiliate / related-party transactions"); "Data privacy / security agreements" [missing] (print p.66, row "Data privacy / security agreements"); "Voting / registration-rights / stockholder agreements" [missing] (print p.66, row "Voting / registration-rights / stockholder agreements"); "IP development contracts" [missing] (print p.66, row "IP development contracts"); "Single source procurement contracts" [missing] (print p.66, row "Single source procurement contracts"); "Clinical research organization contracts" [missing] (print p.66, row "Clinical research organization contracts"); "Employee loans and advances" [missing] (print p.66, row "Employee loans and advances") | STANDARD |

  v3 (Ben's decision 2026-09-13 #7, confirming pass 2's reading): the two "Contracts above an aggregate-payments threshold" rows (`AGGREGATE_PAYMENTS_THRESHOLD_10M_PER_ANNUM`, page 65; `AGGREGATE_PAYMENTS_THRESHOLD_10M`, page 66) stay two distinct buckets sharing one header label -- the contract's own threshold decides the bucket, not the header text, and this table is never deduplicated by label.

## Material Adverse Effect

- Section key: `mae-definitions`
- Legacy config: `components/review/table-configs/mae-definitions.config.js`
- Print pages: 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84
- V2 family mapping: MAE_DEFINITION (confidence: high)

### Table: `mae-definitions-table`

- Row subject: **Party**
- Rows: fixed list
- Fixed rows: "Parent", "Company"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Test (`test`) | verbatim | (free text / composed value) | OPERATION |
| Provision (`limbSummary`) | vocabulary | "One limb — effect on the business, condition or results of operations" (print p.67, row "Parent") | STANDARD |

### Table: `mae-carveouts-parent` — group header **CARVE-OUTS — PARENT** (v3)

- Row subject: **Carve-out**
- Rows: one per subject (v3, Ben's decision 2026-09-13 #6: no forced shared fixed rows with the Company table)
- On this deal: "Failure to meet internal projections or forecasts", "Compliance with the terms of this Agreement", "Other carve-out", "Changes in GAAP or accounting principles", "Industry-wide conditions", "Announcement or pendency of the transaction", "General economic conditions", "Changes in the trading price or volume of stock", "Changes in applicable law or regulation", "Acts of war, armed hostilities, or terrorism"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Disproportionate Carveback (`disproportionateCarveback`) | vocabulary | "Yes" (print p.77, row "Changes in GAAP or accounting principles"); "Not established" (print p.77, row "Failure to meet internal projections or forecasts") | STANDARD |

### Table: `mae-carveouts-company` — group header **CARVE-OUTS — COMPANY** (v3)

- Row subject: **Carve-out**
- Rows: one per subject (v3, Ben's decision 2026-09-13 #6: no forced shared fixed rows with the Parent table)
- On this deal: "Failure to meet internal projections or forecasts", "Compliance with the terms of this Agreement", "Other carve-out", "Changes in GAAP or accounting principles", "Industry-wide conditions", "Announcement or pendency of the transaction", "General economic conditions", "Changes in the trading price or volume of stock", "Changes in applicable law or regulation", "Acts of war, armed hostilities, or terrorism"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Disproportionate Carveback (`disproportionateCarveback`) | vocabulary | "Yes" (print p.77, row "Changes in GAAP or accounting principles"); "Not established" (print p.77, row "Failure to meet internal projections or forecasts") | STANDARD |

  v3: Parent and Company happen to show the same ten carve-outs on this deal, but the table shape no longer forces that -- each party's table is `rows_are: 'one per subject'`, populated from whatever that party's MAE definition actually carves out, so a deal where the two parties diverge is not forced onto one shared fixed-row list.

## Interim Operating Covenants — Target

- Section key: `ioc-exceptions`
- Legacy config: `components/review/table-configs/ioc-exceptions.config.js`
- Print pages: 86, 87, 88
- V2 family mapping: INTERIM_OPERATING (confidence: high)

### Table: `ioc-exceptions-affirmative-covenants` — group header **AFFIRMATIVE COVENANTS**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Maintain leases & material property", "Conduct business in ordinary course", "Preserve business organization & relationships", "Maintain permits, franchises & authorizations"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`body`) | verbatim | (free text / composed value) | OPERATION |
| Efforts Standard (`effortsStandard`) | vocabulary | "Commercially reasonable efforts" (print p.86, row "Maintain leases & material property") | STANDARD, MATERIALITY_QUALIFIER |
| Qualifier (`qualifier`) | vocabulary | "Material items only" (print p.86, row "Maintain leases & material property"); "In all material respects" (print p.86, row "Conduct business in ordinary course") | STANDARD, MATERIALITY_QUALIFIER |

### Table: `ioc-exceptions-negative-covenants` — group header **NEGATIVE COVENANTS**

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Specific Restrictions (`specificRestrictions`) | vocabulary | "Acquisitions / business combinations" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Merger / consolidation / liquidation / recapitalization" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Asset sales / divestitures / licenses" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Real estate / leases" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Capital expenditures" (print p.87, row "Capital Expenditures"); "Loans / advances / capital contributions" (print p.87, row "Commitments"); "Indebtedness / financing" (print p.87, row "Indebtedness"); "Guarantees / third-party obligations" (print p.87, row "Indebtedness") | CONDITION |
| Exceptions (`exceptions`) | vocabulary | "Ordinary course of business" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Other specific exception (see text)" (print p.87, row "Mergers, Acquisitions, Dispositions"); "As contemplated by this Agreement" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Existing credit facilities or indebtedness" (print p.87, row "Mergers, Acquisitions, Dispositions"); "Transactions among wholly-owned subsidiaries" (print p.87, row "Issuance of Securities"); "Existing equity award exercises, vesting, or settlement" (print p.87, row "Issuance of Securities"); "Below monetary threshold" (print p.87, row "Capital Expenditures"); "Within budget / capex plan" (print p.87, row "Capital Expenditures"); "Below $10,000,000," (print p.87, row "Commitments"); "Trade payables in ordinary course" (print p.87, row "Indebtedness"); "Intercompany transactions" (print p.87, row "Indebtedness"); "Below $10,000,000" (print p.87, row "Settlement of Claims"); "As required by law" (print p.88, row "Accounting Changes"); "Pursuant to existing contracts as of signing" (print p.88, row "Compensation and Benefits"); "None specified" (print p.87, row "Charter / Bylaws Amendments") | EXCEPTION |

### Table: `ioc-exceptions-exceptions` — group header **EXCEPTIONS** (v3: `empty_band_is_error: true`)

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |

### Table: `ioc-exceptions-other-restrictions` — group header **OTHER RESTRICTIONS** (v3: `empty_band_is_error: true`)

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |
| Restriction (`fragmentName`) | vocabulary | "Tax matters" (legacy label map); "Specified-contract amendments" (legacy label map); "Insurance maintenance" (legacy label map) | CONDITION |

  v3 (Ben's decision 2026-09-13 #9): an empty Exceptions or Other Restrictions band is never a conscious omission -- if the agreement has content there, an empty band is an error to be surfaced, not silently treated as "nothing found". Both bands carry a table-level `empty_band_is_error: true` rule. The Specific Restrictions / Exceptions split on the negative-covenants table above already gives each restriction category its own two columns, each with its own vocabulary (from the print and `ioc-exceptions.config.js`'s `FRAGMENT_NAME_PATTERNS`); that shape is unchanged in v3.

## Interim Operating Covenants — Parent

- Section key: `parent-ioc-exceptions`
- Legacy config: `components/review/table-configs/ioc-exceptions.config.js`
- Print pages: 94
- V2 family mapping: INTERIM_OPERATING (confidence: high)

### Table: `parent-ioc-exceptions-affirmative-covenants` — group header **AFFIRMATIVE COVENANTS**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Maintain leases & material property", "Conduct business in ordinary course", "Preserve business organization & relationships", "Maintain permits, franchises & authorizations"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`body`) | verbatim | (free text / composed value) | OPERATION |
| Efforts Standard (`effortsStandard`) | vocabulary | "Commercially reasonable efforts" (print p.94, row "Maintain leases & material property") | STANDARD, MATERIALITY_QUALIFIER |
| Qualifier (`qualifier`) | vocabulary | "Material items only" (print p.94, row "Maintain leases & material property"); "In all material respects" (print p.94, row "Conduct business in ordinary course") | STANDARD, MATERIALITY_QUALIFIER |

### Table: `parent-ioc-exceptions-negative-covenants` — group header **NEGATIVE COVENANTS**

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Specific Restrictions (`specificRestrictions`) | vocabulary | "Merger / consolidation / liquidation / recapitalization" (print p.94, row "Mergers, Acquisitions, Dispositions") | CONDITION |
| Exceptions (`exceptions`) | vocabulary | "As contemplated by this Agreement" (print p.94, row "Mergers, Acquisitions, Dispositions"); "Transactions among wholly-owned subsidiaries" (print p.94, row "Issuance of Securities"); "Existing equity award exercises, vesting, or settlement" (print p.94, row "Issuance of Securities"); "Other specific exception (see text)" (print p.94, row "Issuance of Securities"); "Ordinary course of business" (print p.94, row "Dividends and Distributions"); "Tax withholding or similar mandated actions" (print p.94, row "Dividends and Distributions"); "None specified" (print p.94, row "Charter / Bylaws Amendments") | EXCEPTION |

### Table: `parent-ioc-exceptions-exceptions` — group header **EXCEPTIONS** (v3: `empty_band_is_error: true`)

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |

### Table: `parent-ioc-exceptions-other-restrictions` — group header **OTHER RESTRICTIONS** (v3: `empty_band_is_error: true`)

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |

  v3 (Ben's decision 2026-09-13 #9): same `empty_band_is_error: true` rule as the Target's Exceptions / Other Restrictions bands above.

## No-Shop Core Mechanics

- Section key: `nosol-noshop`
- Legacy config: `components/review/table-configs/nosol-noshop.config.js`
- Print pages: 97
- V2 family mapping: NO_SHOP (confidence: high)

### Table: `nosol-noshop-go-shop` — group header **GO-SHOP**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Go-shop"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`goShop`) | vocabulary | "None" (print p.97, row "Go-shop") | STANDARD |

### Table: `nosol-noshop-core-mechanics` — group header **NO-SHOP CORE MECHANICS**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Cease discussions", "No-shop / non-solicit restriction", "Representative control standard", "No-shop exceptions", "Don't-ask-don't-waive / standstill enforcement"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |
| Solicit (`solicit`) — **proposed addition** | boolean | present / absent | CONDITION |
| Initiate (`initiate`) — **proposed addition** | boolean | present / absent | CONDITION |
| Knowingly Encourage (`knowinglyEncourage`) — **proposed addition** | boolean | present / absent | CONDITION |
| Facilitate (`facilitate`) — **proposed addition** | boolean | present / absent | CONDITION |

  v3 (Ben's decision 2026-09-13 #10): the print's "No-shop / non-solicit restriction" row is one fused litany sentence ("Solicit / initiate or knowingly encourage or facilitate ... an Acquisition Proposal"), never per-verb pills. Ben confirmed the four verbs stay four *separate* present/absent columns (not one `prohibitedVerb` vocabulary column with four codes, as pass 2 had it, and not combined "knowingly encourage" / "facilitate" into one column) -- FACT_COMPONENTS/V2 LITANY carries the litany's members, so a present/absent column per prohibited verb is new structure the old page lacked, per Ben's "add to the table structure" instruction.


### Table: `nosol-noshop-notice` — group header **NOTICE**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Notice", "Notice period", "Notice content"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | value / PERIOD | (free text / composed value) | PERIOD |

## Fiduciary-Out Mechanics

- Section key: `nosol-fiduciary`
- Legacy config: `components/review/table-configs/nosol-fiduciary.config.js`
- Print pages: 97, 98
- V2 family mapping: NO_SHOP (confidence: high)

### Table: `nosol-fiduciary-table` — group header **FIDUCIARY-OUT / ENGAGEMENT** (v3)

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Engagement standard", "Final determination standard"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`), `full_text_on_click: true` | vocabulary | "Is a Superior Proposal" (legacy label map); "Constitutes or could lead to a Superior Proposal" (print p.97, row "Engagement standard (coded)"); "Constitutes or could reasonably be expected to lead to a Superior Proposal" (legacy label map); "Continues to constitute a Superior Proposal" (legacy label map) | STANDARD |

  v3 (Ben's decision 2026-09-13 #11): one "Engagement standard" row now shows the coded label (previously split across two rows, "Engagement standard" and "Engagement standard (coded)", because the print truncates the former mid-sentence with a "SEE PROVISION" marker); `full_text_on_click: true` lets the reader open the full sentence instead of only the coded pill.

### Table: `nosol-fiduciary-change-of-recommendation` — group header **CHANGE OF RECOMMENDATION**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Board change right", "Force the vote"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | boolean | (free text / composed value) | CONDITION |
| Prohibited Action (`prohibitedAction`) | vocabulary | "Withhold / withdraw / qualify / modify the Board Recommendation adverse to Parent" (print p.98, row "Change of Recommendation — prohibited actions"); "Fail to publicly reaffirm the Recommendation on request (within 10 business days)" (print p.98, row "Change of Recommendation — prohibited actions"); "Approve / endorse / recommend / declare advisable a proposal" (print p.98, row "Change of Recommendation — prohibited actions"); "Fail to include the Board Recommendation in the Proxy / 14D-9 / Info Statement" (print p.98, row "Change of Recommendation — prohibited actions"); "Enter into an LOI / acquisition / merger agreement (other than an ACA)" (print p.98, row "Change of Recommendation — prohibited actions"); "Fail to recommend against a tender / exchange offer within the required period (within 10 business days)" (print p.98, row "Change of Recommendation — prohibited actions") | CONDITION |

## Intervening Event Mechanics

- Section key: `nosol-intervening`
- Legacy config: `components/review/table-configs/nosol-intervening.config.js`
- Print pages: 98
- V2 family mapping: NO_SHOP (confidence: high)

### Table: `nosol-intervening-table` — group header **INTERVENING EVENT**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Intervening Event provision", "Definition", "Scope", "Exceptions", "Termination right"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`) | boolean | (free text / composed value) | CONDITION |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## Superior Proposal Definition and Standards

- Section key: `nosol-superior`
- Legacy config: `components/review/table-configs/nosol-superior.config.js`
- Print pages: 97, 98
- V2 family mapping: NO_SHOP (confidence: high)

### Table: `nosol-superior-table` — group header **SUPERIOR PROPOSAL**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Superior Proposal threshold", "Superior Proposal test", "Determiner"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`) | value / PERCENTAGE | (free text / composed value) | PERCENTAGE |

### Table: `nosol-superior-acquisition-proposal-definition` — group header **ACQUISITION PROPOSAL — DEFINITION**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Company Takeover Proposal", "Acceptable Confidentiality Agreement"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

### Table: `nosol-superior-matching-rights` — group header **MATCHING RIGHTS**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Initial match period", "Subsequent match period"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | value / PERIOD | (free text / composed value) | PERIOD |

## Votes / Approvals / SEC Filing / Meeting Requirements

- Section key: `votes-approvals-meeting`
- Legacy config: `components/review/table-configs/votes-approvals-meeting.config.js`
- Print pages: 114
- V2 family mapping: PROXY_MEETING (confidence: high)

### Table: `votes-approvals-meeting-table`

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Company stockholder approval", "Parent / Merger Sub approvals", "Proxy filing deadline", "Mailing", "Meeting", "Meeting record date", "Broker search"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Vote Standard (`voteStandard`) | vocabulary | "Two-thirds of outstanding shares" (legacy label map); "Majority of outstanding shares" (legacy label map); "Majority of voting power" (legacy label map); "Majority stockholder approval" (legacy label map) | STANDARD, PERCENTAGE |
| Value (`value`) | value / PERIOD, `trigger.per_row: true` | Proxy filing deadline row's own trigger: "after agreement date" (print p.114); Mailing row's own trigger: "after effectiveness" (print p.114); Meeting row's own trigger: "after mailing" (print p.114) | PERIOD |
| Requirement (`requirement`) | boolean | (free text / composed value) | CONDITION |

  v3 (Ben's decision 2026-09-13 #12): each row (Proxy filing deadline, Mailing, Meeting) carries its own trigger vocabulary keyed by row label (`trigger.by_row_label`), not one trigger set shared across all three rows as pass 2 had it.

### Table: `votes-approvals-meeting-adjournment`

- Row subject: **Adjournment Rights**
- Rows: fixed list
- Fixed rows: "Company adjournment rights", "Parent adjournment rights"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Permitted Reason (`permittedReason`) | vocabulary | "Supplemental disclosure" (print p.114, row "Adjournment rights"); "Absence of quorum" (print p.114, row "Adjournment rights") | STANDARD |
| Controlling Party (`controllingParty`) | vocabulary | "Company" (print p.114, row "Adjournment rights"); "Parent" (print p.114, row "Adjournment rights") | ACTOR |
| Restriction (`restriction`) | verbatim | (free text / composed value) | CONDITION |

## Closing Conditions

- Section key: `conditions`
- Legacy config: `components/review/table-configs/conditions.config.js`
- Print pages: 115
- V2 family mapping: CLOSING_CONDITIONS (confidence: high)

### Table: `conditions-table` — group header **MUTUAL CONDITIONS**

- Row subject: **Condition**
- Rows: fixed list
- Fixed rows: "Stockholder Approval", "No Legal Restraint", "Antitrust / Regulatory Clearance", "S-4 / Proxy Effective", "Stock Exchange Listing"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Vote Standard (`voteStandard`) | vocabulary | "Two-thirds of outstanding shares" (legacy label map); "Majority of outstanding shares" (legacy label map); "Majority of voting power" (legacy label map); "Majority stockholder approval" (legacy label map) | STANDARD, PERCENTAGE |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## Closing Conditions — Buyer

- Section key: `conditions-b`
- Legacy config: `components/review/table-configs/conditions-m.config.js`
- Print pages: 115
- V2 family mapping: CLOSING_CONDITIONS (confidence: high)

### Table: `conditions-b-table` — group header **BUYER'S CONDITIONS — TO PARENT / MERGER SUB'S OBLIGATION**

- Row subject: **Condition**
- Rows: fixed list
- Fixed rows: "Accuracy of Representations", "No Material Adverse Effect", "Officer's Certificate"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Standard (`standard`) | vocabulary_ref: `BRING_DOWN_STANDARD` (shared with the reps tables) | `TRUE_IN_ALL_RESPECTS` (display variant "TRUE IN ALL RESPECTS", print p.115, row "Accuracy of Representations"); `TRUE_EXCEPT_DE_MINIMIS` (display variant "TRUE EXCEPT FOR DE MINIMIS INACCURACIES", print p.115); `TRUE_IN_ALL_MATERIAL_RESPECTS` (display variant "TRUE IN ALL MATERIAL RESPECTS", print p.115); `TRUE_EXCEPT_NO_MAE` (display variant "TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE", print p.115) | STANDARD, MATERIALITY_QUALIFIER |
| Reference (`reference`) | verbatim | (free text / composed value) | CROSS_REFERENCE |
| Materiality Qualifiers Disregarded (`materialityQualifiersDisregarded`) | vocabulary | "Materiality qualifiers disregarded" (print p.115, row "Accuracy of Representations") | STANDARD, MATERIALITY_QUALIFIER |

## Closing Conditions — Seller

- Section key: `conditions-s`
- Legacy config: `components/review/table-configs/conditions-m.config.js`
- Print pages: 116
- V2 family mapping: CLOSING_CONDITIONS (confidence: high)

### Table: `conditions-s-table` — group header **TARGET'S CONDITIONS — TO THE COMPANY'S OBLIGATION**

- Row subject: **Condition**
- Rows: fixed list
- Fixed rows: "Accuracy of Representations", "Officer's Certificate"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Standard (`standard`) | vocabulary_ref: `BRING_DOWN_STANDARD` (shared with the reps tables) | `TRUE_IN_ALL_RESPECTS` (display variant "TRUE IN ALL RESPECTS", print p.115, row "Accuracy of Representations"); `TRUE_EXCEPT_DE_MINIMIS` (display variant "TRUE EXCEPT FOR DE MINIMIS INACCURACIES", print p.115); `TRUE_IN_ALL_MATERIAL_RESPECTS` (display variant "TRUE IN ALL MATERIAL RESPECTS", print p.115); `TRUE_EXCEPT_NO_MAE` (display variant "TRUE EXCEPT WHERE FAILURE WOULD NOT CAUSE AN MAE", print p.115) | STANDARD, MATERIALITY_QUALIFIER |
| Reference (`reference`) | verbatim | (free text / composed value) | CROSS_REFERENCE |
| Materiality Qualifiers Disregarded (`materialityQualifiersDisregarded`) | vocabulary | "Materiality qualifiers disregarded" (print p.115, row "Accuracy of Representations") | STANDARD, MATERIALITY_QUALIFIER |

## Closing Conditions — Mutual (removed in v3)

Section key `conditions-m` (table `conditions-m-table`, the "x of y standard conditions" checklist -- Condition Frustration / Prevention, Covenant Performance, Dissenting Shares Threshold, No Material Adverse Effect (Parent), Covenant Performance (Parent), Financing / Sufficient Funds, each a bare `presence` boolean) is **removed** in `table-shapes.v3.json` (Ben's decision 2026-09-13 #13): a coarse presence checklist adds no comparable detail over the richer Closing Conditions — Buyer/Seller tables above, so it is dropped rather than carried forward.

## Termination Rights

- Section key: `termination-rights`
- Legacy config: `components/review/table-configs/termination-rights.config.js`
- Print pages: 119, 120, 121, 122
- V2 family mapping: TERMINATION (confidence: high)

### Table: `termination-rights-mutual` — group header **MUTUAL / EITHER PARTY**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Mutual consent", "Outside / End Date", "Legal restraint / order", "Stockholder vote not obtained"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Written Consent (`writtenConsent`) | boolean | (free text / composed value) | CONDITION |
| Outside Date (`outsideDate`) | value / DATE | (free text / composed value) | DATE |
| Exercised By (`exercisedBy`) | vocabulary | "Either party may elect (not automatic)" (print p.120, row "Outside / End Date") | ACTOR |
| Vote Threshold (`voteThreshold`) | vocabulary | "Two-thirds of outstanding shares" (legacy label map); "Majority of outstanding shares" (legacy label map); "Majority of voting power" (legacy label map); "Majority stockholder approval" (legacy label map) | STANDARD, PERCENTAGE |

### Table: `termination-rights-buyer-may-terminate` — group header **BUYER / PARENT MAY TERMINATE**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Company (Target) breach", "Change of Recommendation"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Fault-Based Carve-Out (`faultBasedCarveOut`) | boolean | (free text / composed value) | EXCEPTION |
| Trigger (`trigger`) | vocabulary | "Adverse Recommendation Change" (print p.120, row "Change of Recommendation") | TRIGGER |
| Window (`window`) | vocabulary | "Pre-stockholder-vote only" (print p.120, row "Change of Recommendation") | PERIOD |
| Cure Period (`curePeriodValue`) — **proposed addition** | value / PERIOD | (free text / composed value) | PERIOD |
| Cure Period End (`curePeriodEnd`) — **proposed addition (v3: vocabulary)** | vocabulary | "Outside date"; "Fixed date"; "Earlier of notice period and outside date" | EXCEPTION |
| Curable or Not (`curableOrNot`) — **proposed addition (v3: vocabulary)** | vocabulary | "Curable"; "Not curable"; "Curable in part" | CONDITION |

  Proposed additions (v3, Ben's decision 2026-09-13 #14):
  - **Cure Period** (`curePeriodValue`, render: value/PERIOD) — *TERMINATION/BREACH supports a cure-period value distinct from the outside date; the print shows the breach right as a bare "No" fault-based-carve-out pill with the cure mechanics only in clause text (§6.3(b)).*
  - **Cure Period End** (`curePeriodEnd`, render: vocabulary, not a literal date) — *describes what the end point IS -- the outside date itself, a fixed date, or the earlier of a stated notice period and the outside date -- rather than the literal date value.*
  - **Curable or Not** (`curableOrNot`, render: vocabulary, not boolean) — *TERMINATION layer_rules calls out "curable or not" as its own branch, including a partial-cure case; not a distinct pill on this print.*
  - fill_from across this group of columns spans CONDITION (Curable or Not), PERIOD (Cure Period), EXCEPTION (Cure Period End) and CROSS_REFERENCE (Terminator-Breach Bar, below).


### Table: `termination-rights-company-may-terminate` — group header **COMPANY / TARGET MAY TERMINATE**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Parent (Buyer) breach"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Fault-Based Carve-Out (`faultBasedCarveOut`) | boolean | (free text / composed value) | EXCEPTION |
| Terminator-Breach Bar (`terminatorBreachBar`) — **proposed addition (v3: vocabulary)** | vocabulary | "Yes"; "No" | CROSS_REFERENCE |

  Proposed addition (v3, Ben's decision 2026-09-13 #14):
  - **Terminator-Breach Bar** (`terminatorBreachBar`, render: vocabulary Yes/No) — *TERMINATION/BREACH's own condition (Ben, plan 5B.8 note): no termination where the terminator primarily caused the outside date to be missed -- present in clause text (§6.2(a) proviso) but not a pill on this print.*


### Table: `termination-rights-remedies` — group header **REMEDIES (CROSS-REFERENCE)**

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Willful-breach carve-out", "Willful-breach carve-out to sole remedy", "Specific performance available to both parties"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | boolean | (free text / composed value) | CONDITION |

## Termination Fees

- Section key: `termination-fees`
- Legacy config: `components/review/table-configs/termination-fees.config.js`
- Print pages: 122
- V2 family mapping: TERMINATION_FEE (confidence: high)

### Table: `termination-fees-table`

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Company termination fee", "Reverse termination fee", "Sole and exclusive remedy", "Willful-breach carve-out", "Willful-breach carve-out to sole remedy", "Interest on late payment"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Amount (`amount`) | value / AMOUNT | (free text / composed value) | THRESHOLD, AMOUNT |
| Trigger (`trigger`) | verbatim | (free text / composed value) | TRIGGER |
| Payer (`payer`) — **proposed addition** | vocabulary | *(all proposed -- see below)* | ACTOR |
| Deeming Rule Present (`deemingRulePresent`) — **proposed addition** | boolean | (free text / composed value) | CONDITION |

  Proposed additions:
  - **Payer** (`payer`, render: vocabulary) — *TERMINATION_FEE/FEE_AMOUNT names a payer role; this print shows the fee amount and trigger prose only, payer is implied by which row (Company/Reverse) rather than stated as its own pill.*
  - **Deeming Rule Present** (`deemingRulePresent`, render: boolean) — *TERMINATION_FEE/FEE_TRIGGER supports a "deemed" trigger variant (e.g. deemed acceptance of a proposal); not distinguished on this print.*

  Proposed addition codes for **Payer**:
  - "Company" — *the "Company termination fee" row implies the Company as payer; not stated as its own pill on this print.*
  - "Parent" — *the "Reverse termination fee" row implies Parent as payer; same reasoning.*

  v3 (Ben's decision 2026-09-13 #15): Payer stays its own column (Company / Parent); Ben is indifferent between deriving it from the row label and coding it explicitly, but the explicit column keeps the comparison visible across deals.


## Tail Fee Mechanics

- Section key: `tail-fee`
- Legacy config: `components/review/table-configs/tail-fee.config.js`
- Print pages: 128
- V2 family mapping: TERMINATION_FEE (confidence: high)

### Table: `tail-fee-table`

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Tail window", "Threshold % for Company Takeover Proposal", "Termination scenarios", "Qualifying transaction scope"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Value (`value`) | value / PERIOD | (free text / composed value) | PERIOD |
| Tail Period (`tailPeriod`) — **proposed addition** | value / PERIOD | (free text / composed value) | PERIOD |

  Proposed addition:
  - **Tail Period** (`tailPeriod`, render: value/PERIOD) — *TERMINATION_FEE/TAIL_PERIOD names the tail window as its own component; already present as this table's "Tail window" row, promoted here as an explicit reusable column for cross-deal comparison rather than a fixed-row value only.*


## Employee Compensation and Benefits

- Section key: `employee-benefits`
- Legacy config: `components/review/table-configs/employee-benefits.config.js`
- Print pages: 128, 129
- V2 family mapping: EMPLOYEE_MATTERS (confidence: high)

### Table: `employee-benefits-table` (v3, `split_combined_elements: true`, `show_only_when_populated: true`)

- Row subject: **Benefit**
- Rows: fixed list -- all ten canonical benefit elements (`lib/employee-benefits.js`'s `COMP_ITEM_ORDER`): "Severance / change-in-control protection", "Other benefits", "Base salary", "Long-term incentive (LTI) / equity grants", "Target annual bonus / cash incentive", "Retirement / 401(k) benefits", "Earned annual bonus (pro-rata)", "Health and welfare benefits", "Paid time off / vacation", "Equity / stock awards (new grants)" -- but `show_only_when_populated: true` means a row renders only when the deal actually populates it; this deal populates only the first six.

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Reference Group (`comparison`) | vocabulary | "Company pre-closing arrangements" (legacy label map); "Similarly-situated buyer employees" (legacy label map) | OBJECT |
| Standard (`standard`) | vocabulary | "At target's pre-closing levels" (print p.129, row "Severance / change-in-control protection"); "In the aggregate (rebalancing permitted)" (print p.129, row "Other benefits"); "No less favorable than current" (print p.129, row "Base salary"); "At buyer's discretion" (print p.129, row "Long-term incentive (LTI) / equity grants") | STANDARD, MATERIALITY_QUALIFIER |
| Period (`period`) | value / PERIOD | (free text / composed value) | PERIOD |

  v3 (Ben's decision 2026-09-13 #17): the four elements pass 2 only proposed as additional rows (Earned annual bonus (pro-rata), Health and welfare benefits, Paid time off / vacation, Equity / stock awards (new grants)) are now part of the same fixed-row list as the six populated ones -- the canonical row set is all ten elements, `show_only_when_populated: true` renders only the ones the deal actually shows, and `split_combined_elements: true` records that where the agreement combines several elements in one sentence, the row split keeps each element on its own canonical row so the reference stays consistent across deals. Decision #16 (Reference Group "Not specified"): unchanged from pass 2 -- "Not specified" stays the absence of a Reference Group value (a buyer-discretion standard carries no comparison pill), not a third code.

### Table: `employee-benefits-other-protections` — group header **OTHER PROTECTIONS**

- Row subject: **Benefit**
- Rows: fixed list
- Fixed rows: "401(k) plan continuation", "Continued service crediting", "Eligibility / waiting-period waiver", "Severance protection"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Reference Group (`comparison`) | vocabulary | "All covered employees" (print p.129, row "401(k) plan continuation") | OBJECT |
| Standard (`standard`) | verbatim | (free text / composed value) | STANDARD, MATERIALITY_QUALIFIER |
| Period (`period`) | verbatim | (free text / composed value) | PERIOD |

## Miscellaneous / Boilerplate

- Section key: `misc-boilerplate`
- Legacy config: `components/review/table-configs/misc-boilerplate.config.js`
- Print pages: 129, 130, 131
- V2 family mapping: MISC_BOILERPLATE (confidence: high)

### Table: `misc-boilerplate-table`

- Row subject: **Term**
- Rows: fixed list
- Fixed rows: "Governing law", "Forum / jurisdiction", "Third-party beneficiaries", "Fee / expense allocation", "Specific performance", "Specific performance limitations", "Jury trial waiver", "Amendment formalities", "Severability", "Counterparts and electronic execution", "Assignment"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`) | vocabulary | "Yes" (print p.130, row "Specific performance") | STANDARD |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## No Other Reps / Fraud

- Section key: `no-other-reps-fraud`
- Legacy config: `components/review/table-configs/no-other-reps-fraud.config.js`
- Print pages: 142
- V2 family mapping: NO_OTHER_REPS_FRAUD (confidence: high)

### Table: `no-other-reps-fraud-table`

- Row subject: **Question**
- Rows: fixed list
- Fixed rows: "Buyer non-reliance", "Seller no-other-reps", "Seller non-reliance", "Buyer no-other-reps", "Fraud carve-out"

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Status (`status`) | vocabulary | "Yes" (print p.142, row "Buyer non-reliance"); "Silent" (print p.142, row "Fraud carve-out") | STANDARD |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |
  Proposed addition codes for **Status**:
  - "No" — *complement of Yes -- V2 NO_OTHER_REPS_FRAUD/FRAUD_CARVEOUT is a yes/no/silent axis; this deal never shows an explicit "No" but the vocabulary should carry the full axis.*


## Other Covenants

- Section key: `general-covenants`
- Legacy config: `components/review/table-configs/general-covenants.config.js`
- Print pages: 142
- V2 family mapping: GENERAL_COVENANTS (confidence: high)

### Table: `general-covenants-table`

- Row subject: **Provision**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Link (`detail`) | verbatim | (free text / composed value) | CROSS_REFERENCE |

## Defined Terms

- Section key: `defined-terms`
- Legacy config: *(none -- this table exists only in the print, not in any legacy config)*
- Print pages: 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180
- V2 family mapping: KEY_DEFINED_TERMS (confidence: low)
- **v3: `kind: 'reference_appendix'`, `excluded_from_fact_tables: true`** (Ben's decision 2026-09-13 #19): a reference appendix, not a fact table. Cross-deal comparison of a definition (e.g. how "Law" is defined across two deals) is a later feature, possibly soon.

### Table: `defined-terms-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Definition (`definition`) | verbatim | (free text / composed value) | DEFINED_TERM |

## Approvals / Votes

- Section key: `approvals-votes`
- Legacy config: `components/review/table-configs/approvals-votes.config.js`
- Print pages: *(no print evidence found in this deal)*
- V2 family mapping: TERMINATION (confidence: low)
- **v3: kept as a section** (Ben's decision 2026-09-13 #20) for deals whose print does carry this content, even though TopBuild's own print does not.

### Table: `approvals-votes-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Kind (`kind`) | verbatim | (free text / composed value) | OPERATION |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## Shareholder Meeting / Proxy / Tender-Offer SEC Matters

- Section key: `sec-meeting`
- Legacy config: `components/review/table-configs/sec-meeting.config.js`
- Print pages: *(no print evidence found in this deal)*
- V2 family mapping: PROXY_MEETING (confidence: high)
- **v3: kept as a section** (Ben's decision 2026-09-13 #20) for a deal shape (e.g. a pure tender offer) that would populate it.

### Table: `sec-meeting-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Subject (`subject`) | verbatim | (free text / composed value) | OPERATION |
| Provision (`signals`) | verbatim | (free text / composed value) | OPERATION |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## Antitrust / Regulatory

- Section key: `antitrust-regulatory`
- Legacy config: `components/review/table-configs/antitrust-regulatory.config.js`
- Print pages: *(no print evidence found in this deal)*
- V2 family mapping: ANTITRUST_REGULATORY (confidence: high)
- **v3: kept as a section** (Ben's decision 2026-09-13 #20) for a deal with a distinct antitrust efforts covenant that would populate it.

### Table: `antitrust-regulatory-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`) | verbatim | (free text / composed value) | OPERATION |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## Advisers / Fees / Expenses

- Section key: `advisers-fees-expenses`
- Legacy config: `components/review/table-configs/advisers-fees-expenses.config.js`
- Print pages: *(no print evidence found in this deal)*
- V2 family mapping: GENERAL_COVENANTS (confidence: low)
- **v3: kept as a section** (Ben's decision 2026-09-13 #20) for a deal whose print does carry this content, even though TopBuild's own print folds it into Other Covenants' link list instead.

### Table: `advisers-fees-expenses-table`

- Row subject: **Term**
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| Provision (`signals`) | verbatim | (free text / composed value) | OPERATION |
| Detail (`detail`) | verbatim | (free text / composed value) | OPERATION |

## No-Solicitation / No-Shop

- Section key: `nosol`
- Legacy config: `components/review/table-configs/nosol-section.config.js`
- Print pages: *(no print evidence found in this deal)*
- V2 family mapping: NO_SHOP (confidence: high)

### Table: `nosol-table`

- Row subject: *(no separate subject column -- one composed cell per row)*
- Rows: one per subject

| Column | Render | Vocabulary / value | fill_from |
|---|---|---|---|
| *(blank)* (`body`) | verbatim | (free text / composed value) | OPERATION |

---

## Open questions

1. **Structure & Mechanics.** The print labels this a "One Step Merger" (Deal structure row) even though the agreement text describes a merger sub merging into the Company followed by the surviving corporation merging into a second merger sub (i.e. two mergers). Is "One Step Merger" the legacy code's own vocabulary term for a double-dummy/forward-triangular structure (distinct from a literal single-step merger), or is this a labeling bug in the legacy table the pill vocabulary should not perpetuate?
2. **Consideration.** The print shows two distinct pill texts for merger form on the same row ("Reverse triangular merger" and "Forward triangular merger"), while the legacy `structure-mechanics.config.js` vocabulary only defines "Forward merger" (no "triangular") and "Reverse triangular merger". Should the legacy label be corrected to match the print's "Forward triangular merger", or are these two different concepts that happen to look similar?
3. **Equity Awards.** CVR Entitlement is "—" (not entitled) on all four rows of this deal. Is Entitled/Not entitled the right two-value axis for this column, or does a real CVR deal need a richer vocabulary (e.g. entitlement percentage, milestone-linked)?
4. **Representations & Warranties — Company/Parent.** This table now carries two independently-recorded bring-down vocabularies for the same four-tier concept: the reps page's own lower-case "Bringdown: X" pills, and the Closing Conditions page's upper-case "TRUE IN ALL RESPECTS"-style pills. Should these be unified into one shared vocabulary (with the two print renderings recorded as display variants of the same code), or kept as two genuinely separate columns because a rep's own bring-down and its Closing-Conditions bring-down can, on some deals, diverge?
5. **Representations & Warranties — Company/Parent.** Lookback is left `verbatim` (e.g. "Since Jan 1, 2023 (≈3.3 yrs)") rather than a vocabulary, since only two example values exist in this one deal and lookback dates are inherently deal-specific. Confirm that's right, or say what a cross-deal-comparable Lookback vocabulary should look like (e.g. a value_kind of DATE plus a separate reference-date/duration split).
6. **Material Adverse Effect.** The ten MAE carve-out categories and their disproportionate-carveback yes/no are harvested per party (Parent vs Company) as two separate tables with identical fixed rows. On this deal the two parties' carve-out lists are the same ten categories with matching carvebacks -- is that expected to always be a mirror-image list, or can a real deal give the two parties different carve-out sets (in which case this table should not force the same fixed_row_labels on both)?
7. **Material Contracts.** Two rows use the header phrase "Contracts above an aggregate-payments threshold" with two different dollar thresholds ($10,000,000 per annum vs $10,000,000 flat) on the same page. Confirm these are two distinct contract-type buckets that happen to share a name (I have not merged them), or say if this is a print/extraction duplication.
8. **Interim Operating Covenants.** This deal's print shows every negative-covenant row's own Exceptions/Specific-Restrictions pills fused inline with the category, not as two clean sub-columns -- the vocabulary in this readout is the union of every restriction category and exception phrase seen across all rows, attached at the table level rather than per row. Section 5B's eventual `conclusions` layer will need a per-row (per-fact) association, not just a table-level vocabulary; confirm this table shape is the right interim step.
9. **Interim Operating Covenants.** The print shows no populated rows in this deal for the legacy "EXCEPTIONS" (general/section-wide) or "OTHER RESTRICTIONS" bands -- both tables are carried over from pass 1 unchanged (verbatim, no vocabulary). Confirm whether those bands are simply empty on this deal, or whether the print omits content the underlying data actually has.
10. **No-Shop.** The prohibited-verb litany ("solicit, initiate or knowingly encourage or facilitate") is split into four Part-2 proposed present/absent columns (Solicit / Initiate / Knowingly encourage / Facilitate) since the print shows them fused into one sentence. Confirm this is the split you want, or whether "knowingly encourage" and "facilitate" should stay combined as they are in the print's own row label.
11. **No-Shop — Fiduciary-Out.** The print truncates "Engagement standard" mid-sentence with a "SEE PROVISION" marker rather than showing the full coded label; only "Engagement standard (coded)" shows the complete phrase. I have therefore recorded the "Engagement standard" row's vocabulary from the legacy label map only (not claimed as print evidence for text the print does not fully show). Confirm that reading is right.
12. **Votes / Approvals / SEC Filing / Meeting Requirements.** Proxy filing deadline / Mailing / Meeting are each a composed value ("30 business days after agreement date", etc.) modelled as one `value` column plus a shared `trigger` vocabulary (after agreement date / after effectiveness / after mailing). Confirm a single shared trigger vocabulary across all three rows is right, rather than each row needing its own independent trigger set.
13. **Closing Conditions.** The pass-1 "10 of 16 standard conditions present" checklist and its named-but-absent conditions (page 116) are recorded here only as the `conditions-m` table's fixed rows (Condition Frustration / Prevention, Covenant Performance, etc.) with a bare `boolean` "Coverage" column, since the print gives no further pill detail for them. Confirm that coarse a treatment is enough for this checklist, or whether it needs its own richer table.
14. **Termination Rights.** The print gives "Company (Target) breach" and "Parent (Buyer) breach" as two separate rows under two different group headers (Buyer/Parent May Terminate; Company/Target May Terminate) with only a "Fault-Based Carve-Out: No" pill each -- the cure mechanics, cure period and terminator-breach bar all live in clause text only. All three are recorded as Part-2 proposed addition columns; confirm that's the right scope rather than trying to parse the clause text into real values now.
15. **Termination Fees.** Payer is recorded as a Part-2 proposed addition (Company/Parent) rather than harvested, since the print states it only by which named row you're reading ("Company termination fee" vs "Reverse termination fee"), never as its own pill. Confirm whether Payer should instead be derived automatically from the row label rather than needing its own coded value.
16. **Employee Compensation and Benefits.** Long-term incentive (LTI) / equity grants and Retirement / 401(k) benefits both show Reference Group "Not specified" on the print. `lib/employee-benefits.js`'s own model treats "Not specified" as the ABSENCE of a reference group (a buyer-discretion standard carries no comparison pill at all) rather than a third vocabulary value, so I have left the Reference Group vocabulary at exactly the two legacy labels and left these two rows without a Reference Group value. Confirm that reading, or say if "Not specified" should be a real third code.
17. **Employee Compensation and Benefits.** Four benefit elements `lib/employee-benefits.js` supports (Earned annual bonus (pro-rata), Health and welfare benefits, Paid time off / vacation, Equity / stock awards (new grants)) are not populated on this deal and are recorded as proposed addition rows rather than real fixed rows. Confirm the main table's fixed-row list should eventually carry all ten canonical benefit elements (matching the legacy code's own `COMP_ITEM_ORDER`), not just the six this deal happens to populate.
18. **No Other Reps / Fraud.** "Silent" appears once (Fraud carve-out) alongside "Yes" everywhere else; "No" never appears on this deal and is recorded as a proposed addition to complete the axis. Confirm Yes/No/Silent is the right three-value Status vocabulary for this table's five fixed questions.
19. **Defined Terms.** This table exists only in the print (there is no `defined-terms.config.js` in `components/review/table-configs/`) -- it is mapped to the V2 `KEY_DEFINED_TERMS` family at low confidence because that family's subtypes (Acquisition Proposal, Superior Proposal, Intervening Event, Knowledge, Willful Breach, Acceptable Confidentiality Agreement) name only six specific terms, while this print glossary has 125. Confirm whether the full glossary belongs in the table-shapes contract at all, or whether it is out of scope for the pill-table model entirely (a reference appendix, not a fact table).
20. **Approvals / Votes; Antitrust / Regulatory; Advisers / Fees / Expenses; Shareholder Meeting / Proxy / Tender-Offer SEC Matters.** None of these four legacy-config sections show a distinct populated pill table in this deal's print (their content, where present at all, appears folded into Votes / Approvals / SEC Filing / Meeting Requirements or Other Covenants' link list instead). They are carried over from pass 1 unchanged. Confirm whether they are genuinely redundant with other sections on a two-step-merger-with-election deal like this one, or whether a different deal shape (e.g. a pure tender offer, or a deal with a distinct antitrust efforts covenant) would populate them and they should stay in the shape as-is.

## Ben's answers, 2026-09-13 01:00 UTC, and the decisions they set for pass 3

Ben answered the twenty questions above by dictation (verbatim in `BEN-NCS-REVIEW-COMMENTS-2026-09-09.md`, section 10). Decisions for the next generator pass, not hand-edits of the JSON:

1. Structure. "One Step Merger" is wrong for a merger sub merging into the target followed by the surviving corporation merging into a second subsidiary. Practitioners call this a **double merger** (Cadwalader, "Multiple Step Acquisitions", on the IRS Double Merger Ruling: a merger sub into the target followed by an upstream or second merger treated as one reorganisation) and agreements label the second step a **Second-Step Forward Merger** (sample clause language on Law Insider). "Two-step merger" is avoided because it also names a tender offer followed by a back-end merger. Deal structure vocabulary: One-step merger; Double merger (reverse triangular then second-step forward merger); Tender offer with back-end merger. Sources: https://www.cadwalader.com/uploads/books/bed5dd3bc69259182dbba45b0b7162b9.pdf and https://lawinsider.com/clause/two-step-merger.
2. Merger form. Reverse triangular merger (merger sub merges into the target, the target survives as a subsidiary; treated as a stock acquisition) and forward triangular merger (the target merges into the merger sub, the merger sub survives; treated as an asset acquisition) are distinct codes, plus Forward merger (target merges directly into the acquirer). A double merger carries one form per step (first step, second step). The structure family must record which is which from the words "with and into" and which entity survives. Sources: https://dealroom.net/faq/guide-to-forward-and-reverse-triangular-mergers and https://www.leoberwick.com/reverse-cash-mergers-reverse-triangular-mergers/.
3. Equity awards, CVR entitlement: Entitled; Not entitled; Entitled if a milestone brings the award into the money (spread over the exercise price on cash plus CVR). The extractor looks for that earn-in language.
4. Bring-down: one shared vocabulary for the reps table and the closing conditions (True in all respects; True except for de minimis inaccuracies; True in all material respects; True except where failure would not cause an MAE). The rep's own qualifier standard is a separate column.
5. Lookback: a relative period computed from the date (e.g. 3.3 years), the date on hover, so deals compare.
6. MAE carve-outs: parent and company tables are not forced to the same fixed rows.
7. Material contracts: rows with the same header and different thresholds stay separate buckets; the contract decides.
9. Interim covenants: an empty Exceptions or Other restrictions band is never a conscious omission. If the agreement has content there, an empty band is an error to be surfaced.
10. No-shop verbs: Solicit, Initiate, Knowingly encourage, Facilitate stay separate present/absent columns.
12. Votes: each row (proxy filing, mailing, meeting) has its own trigger set.
13. Closing conditions: drop the "x of y standard conditions" checklist.
16. Employee benefits: "Not specified" means nothing was found in the document; it stays the absence, not a third code.
17. Employee benefits rows: carry every benefit element actually found in the deal, none that is not; where the agreement combines elements in one sentence, split them into the table's rows so the reference is consistent across deals.
18. No other reps: Yes / No / Silent stands, subject to later findings.
19. Defined terms: a reference appendix, not a fact table. Cross-deal comparison of a definition (how "Law" is defined in two deals) is a later feature, possibly soon.

8. Interim covenants: two columns per negative-covenant row, Specific restrictions and Exceptions, each with its own pills.
11. No-shop fiduciary out: one Engagement standard row showing the coded label, full sentence on click.
14. Termination for breach: columns for Curable or not, Cure period, Cure period end (outside-date cap) and Terminator-breach bar, filled from the clause.
15. Termination fees: Payer as its own column (Company / Parent); Ben is indifferent, the column keeps the comparison explicit.
20. Approvals / Votes, Antitrust / Regulatory, Advisers / Fees / Expenses and Shareholder Meeting / Proxy / Tender Offer stay as sections for deals that carry that content.

All twenty questions are answered (Ben, 2026-09-13 01:10 UTC). Pass 3 encodes these decisions in the generator and regenerates the JSON.

### Decision 25 (MAE section), Ben 2026-09-13 19:50 UTC

Ben, on the rendered Metsera MAE section: "if there is no MAE for parent just say none. And in the carve outs column we need to use generic titles. And the disproportionate carve out must say yes or no. Then we should show how the disproportionate carve out is drafted at the bottom of the table". Encoded in `scripts/product/build-table-shapes-pass3.js` (`applyDecision25MaeSection`), superseding decision 6 above (decision 5 in the generator): the definitions table keeps its fixed Parent / Company rows and a row with no definition fact renders "None" (`absent_row_label`, shown only once another row is filled); both carve-out tables are fixed lists of the corpus taxonomy's 27 generic carve-out titles (the print's ten among them), open to a new title, with an "As drafted" verbatim column; the carve-back column is Yes / No only and a blank reads No (`absent_code`); the disproportionality carve-back fact is the table's footer (`footer_from_subtype`), never a row. Definition instances and underlying-cause restorations carry no readout.

### Decision 26 (verbatim detail columns), Ben 2026-09-13 20:05 UTC

Ben, on the mutual conditions table: "there is great detail here on the right but it isn't shown on the left (e.g. it doesn't say court of competent jurisdiction etc)"; on No Other Reps / Fraud: "the detail here isn't actually reassuring, I'd just say yes then have the tree ready to show the language etc". `applyDecision26DetailColumns`: the conditions detail column is `display: fact_text` (the fact's top-level own words in source order, the cited words remaining the click target) headed "As drafted"; the No Other Reps / Fraud table keeps only the status column, the pill opening the tree.

### Decision 27 (section order and the left rail), Ben 2026-09-13 20:20 UTC

Ben: "I'd use the ordering from the old app for the sections and the left hand side bar (and for the styling of that side bar)". `applyDecision27SectionOrder` runs last: sections are re-ordered to the old app's `SIDEBAR_GROUPS` (Structure, Consideration, Reps, Material Contracts, MAE, IOC, No-Sol, Antitrust, SEC / Meeting, Conditions, Termination Rights, Termination Fees, Employee Benefits, Other Covenants, Misc, No Other Reps, Definitions) and each carries `rail: { group, label, hex }` with the old app's group colour. `components/product/ProvisionRail.jsx` renders those groups with the old sidebar's `.rec-side-*` styling (eyebrow, dot, indented children, active row), sticky; the section heading dot takes the same colour.

### Decision 28 and 29 (structure grid), Ben 2026-09-13 20:40 and 20:50 UTC

"why does merger form appear twice?": the legacy Merger Form column is removed; the per-step form column is the form, and the grid reads deal structure, merger form, surviving entity, then closing mechanics (decision 28). "it's actually the combined fact that MS is merged with Company and Company survives that makes it a reverse triangular (for the purposes of showing the basis for our views)": the merger form columns carry `basis_kinds` ACTOR / OPERATION / OBJECT / TERM; a readout cites one component of every such kind the fact has or is dropped with a note (contract rule C10); the extractor is told so; the evidence sidebar quotes, marks and lights every cited component (decision 29).

### Decision 30 (equity awards), Ben 2026-09-13 21:10 UTC

"we should have the different types of option as sub items under the Company Stock Options and include Unvested (that do vest by their terms), Vested and then ones > the deal price". The equity awards table is a fixed list of instrument classes (Company Stock Option, RSU, PSU, Restricted Stock Award, ESPP, Warrant; open), and each treatment class is a sub-item from `detail_labels` (Vested; Unvested, vesting by its terms at the Effective Time; Unvested, not vesting by its terms; Out of the money; open), rendered in that order under the instrument row, which gives the overview. Supersedes decision 19's one-row-per-class.

### Decision 31 (representation limbs), Ben 2026-09-13 21:20 UTC

"the 'power and authority' should include 'to own...' etc otherwise it can be confused with power to enter contracts. Also - are these items in Term canonical and being used across all deals? They need to be so they can be compared". Rows were already canonical (decision 20); the sub-items were the model's own words. Both representation tables now carry `detail_labels_by_row`: a canonical limb list per representation, open to a new limb in the same style only when none fits. Seeded for Organization; Qualification; Standing (due organization, valid existence and good standing / corporate power and authority to own, lease and operate its properties and assets and to conduct its business / qualification or licensing / organizational documents made available / the same three for Subsidiaries) and Authority; Enforceability (power and authority to execute, deliver and perform / due authorization / board approval and recommendation / stockholder approval required / due execution and delivery, valid and binding / enforceability exceptions). **The other eighteen representations await Ben's limb vocabulary**; until then their limbs are open.

Also: a click selects one line, not every sub-item in the same column ("clicking one of the qualifications shouldn't cause the others to turn orange").

### Decision 32 (Material Contracts), Ben 2026-09-13 21:30 UTC

"why are there two contract type columns and what is not covered doing? also are there materiality qualifiers for any of these rather than just $ thresholds?" Rows are now the canonical categories (the print's covered and not-covered lists, open to a new one), a category with no fact reads Not covered, the clause's words sit in As drafted, and a Qualifier column codes the materiality standard (material to the Company taken as a whole / material / MAE standard, linked to the definition / not in the ordinary course) beside the dollar threshold. The coded Contract Type and Not Covered columns are gone. Decision 6's distinct thresholds are two facts on one row.

### Decision 33 (Consideration sources), Ben 2026-09-13 21:50 UTC

"On appraisal - why isn't (d) the provision that this attaches to"; "why is there a separate 'an amount of cash' row and also why does it say 'any CVR' with a citation into the exchange mechanic? The Merger Consideration definition was found and is clear and there is a clear covenant on what shares are converted into". The appraisal line is `display: fact_text` and `from_subtype_keys: [APPRAISAL_LINK]` (rule C12: another subtype's cell is dropped); the per-share table's rows come from the form code (`row_from_column`, canonical Cash / Parent stock / CVR rows) and take only component and package subtypes (`only_subtype_keys`, rule C11). The CONSIDERATION layer rule now says exchange procedures are EXCHANGE_MECHANICS whatever they mention and components come only from the conversion clause and the Merger Consideration definition. Also, on 3.04(b) rendered as votes rows ("this voting section is being pulled from a rep...!"): the PROXY_MEETING layer rule says board resolutions recited in a representation are representation facts, never votes, proxy or meeting facts.
