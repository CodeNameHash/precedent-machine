# Table shapes and vocabularies for Ben's check, 2026-09-12

Status: DRAFT_FOR_BEN_REVIEW. This is a machine-generated first pass over every table on today's review page (`components/review/table-configs/*.config.js`), produced by `scripts/product/build-table-shapes.js`, which writes `contracts/product/table-shapes.v1.json`. This document is the plain-English readout of that JSON, in the same order the review page mounts the sections. Correct anything wrong here; the JSON is regenerated from the legacy configs, not from this document, so a correction belongs in the generator or in a decision recorded here for the next person to encode, not as a hand-edit of the JSON.

**Why this exists.** The published page and the Query page (plan Phase 5B) need to show each provision the way the review page shows it today: a small table of headline pills per subject, with the verbatim layered facts underneath. The V2 legal schema (`contracts/product/legal-schema.v2.json`) has families and subtypes but no table shapes or pill vocabularies -- those only exist today as React rendering code in `components/review/table-configs/`. This document (and the JSON behind it) is the extracted, reviewable version of that code.

**How it was built.** Every legacy config was read as source text and parsed (not `require()`'d and executed -- these modules compute their pills from live deal data fed through closures, not from an exported value, so running them with no deal to feed would either crash or produce nothing meaningful, and would make the output depend on side effects rather than being a deterministic function of the source). All 34 files under `table-configs/` parsed cleanly, so every section below was extracted the same way; none needed the text-scraping fallback the build brief anticipated for React-only files. What follows is exactly what the source declares: column headers verbatim, and vocabulary drawn only from label maps the config actually defines (`*_META` / `*_LABELS` objects) or from a classifier function whose only possible outputs are a fixed set of literal label strings (e.g. `vote-standard.js`'s `voteStandard()`). Nothing here is invented; where a column's real vocabulary could not be safely attributed, it is marked verbatim and flagged as a question rather than guessed.

**Reading each entry.** Each `##` section below is one legacy config (or one instance of it, where a single file builds several near-identical sections -- e.g. Closing Conditions — Mutual/Buyer/Seller are three calls into the same factory in `conditions-m.config.js`). "Proposed V2 family" is a judgment call, not a derived fact -- confidence `low` means the title/content didn't map cleanly onto one of the 25 V2 families and needs your call. Each `###` is one table; a `group_header` line under a table name means the legacy config visually bands that table's rows under an uppercase label (rendered via CSS on a mixed-case string, which is reproduced here as the site displays it). "Rows: a fixed list" means the config always shows the same named rows (e.g. "Base salary") rather than one row per matching provision. Questions are marked **Q**, numbered in reading order.

**What this pass could not reach.** A number of sections (flagged below) render one composed "Provision" or "Detail" cell per row rather than a set of separately named pill columns -- the legacy code builds several small badges inside one cell (`renderSignals`/`signalFor`, or a single `body` column in the IOC-exceptions and no-solicitation tables) using data assembled earlier, in a different function, than the column definition itself. Static analysis can see that these cells render pills and can list every label map the file defines, but cannot safely say which map belongs to which composed line without guessing -- an earlier draft of the generator tried unioning all of a file's harvested labels onto such a column and it visibly produced a wrong answer (attaching `representations-qualifiers.config.js`'s materiality-qualifier labels onto the unrelated Lookback column), so that approach was dropped. These are flagged as open questions rather than filled in with a guess. Two related gaps: (1) a few columns' real vocabulary lives in a library outside `components/review/table-configs/` (e.g. Employee Compensation and Benefits' "Reference Group" column is actually a closed pair -- "Similarly-situated buyer employees" / "Company pre-closing arrangements" -- defined in `lib/employee-benefits.js`, which this generator was scoped to leave unread); (2) `ioc-exceptions.config.js` exports classifier functions (`scopeMaterialityPillFor`, `effortsStandardPillFor`) that return `{label, tone}` objects rather than bare label strings, which this generator's classifier-harvesting pass does not open up. Both are good candidates for a second, narrower extraction pass once you've confirmed the shapes below are right.

**Decisions made without asking.** The first column of every table is always modelled as the `term_column` (the row's subject), with the remaining columns carried in `columns` -- true for every table below. A column with a blank header in the legacy source (e.g. Employee Compensation and Benefits' hidden `detail` column, which the site relocates behind a "see text" link rather than showing in the grid) is dropped, since it isn't one of "the columns the site shows." Where a vocabulary map was matched to a column by comparing words in the column's header against the map's variable name rather than by an exact, unambiguous name, treat it as a first guess to confirm rather than a certainty -- Fiduciary-Out Mechanics' "Provision" column below is the clearest example: its two harvested labels look right for a fiduciary-out table, but the match was by keyword scoring, not by a map named for that column.

## Consideration

- Legacy config: `components/review/table-configs/consideration-hero.config.js`
- Proposed V2 family: CONSIDERATION (confidence: high)

### Table: Consideration

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Equity Awards

- Legacy config: `components/review/table-configs/equity-awards.config.js`
- Proposed V2 family: CONSIDERATION (confidence: high)

### Table: Equity Awards

- Row subject column: **Equity Type**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Consideration | shows a pill from a fixed vocabulary | Cash [present]; Parent stock / rollover [info]; Cancelled — no consideration [missing] |
| Vesting Treatment | shows a pill from a fixed vocabulary | Cancelled — no consideration [missing]; Continues vesting (double-trigger protection) [warning]; Assumed by Parent [info]; Pro-rata acceleration [info]; Rollover into Parent award [info]; Fully vested (accelerated) [present]; Cancelled for cash consideration [present] |
| CVR Entitlement | shows free text lifted verbatim from the extraction | (none extracted) |

## Structure & Mechanics

- Legacy config: `components/review/table-configs/structure-mechanics.config.js`
- Proposed V2 family: MERGER_STRUCTURE_CLOSING (confidence: high)

### Table: Structure & Mechanics

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows a pill from a fixed vocabulary | Forward merger; Reverse triangular merger |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Closing Conditions

- Legacy config: `components/review/table-configs/conditions.config.js`
- Proposed V2 family: CLOSING_CONDITIONS (confidence: high)

### Table: Closing Conditions

- No separate row-subject column -- Question Q1: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

## Closing Conditions — Mutual

- Legacy config: `components/review/table-configs/conditions-m.config.js`
- Proposed V2 family: CLOSING_CONDITIONS (confidence: high)

### Table: Closing Conditions — Mutual

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q2: the legacy config gives two different columns the identical header "Provision" (one renders a status pill, the other renders the clause detail) -- is the second one meant to say "Detail", or is the repeated header intentional?

## Closing Conditions — Buyer

- Legacy config: `components/review/table-configs/conditions-m.config.js`
- Proposed V2 family: CLOSING_CONDITIONS (confidence: high)

### Table: Closing Conditions — Buyer

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q3: the legacy config gives two different columns the identical header "Provision" (one renders a status pill, the other renders the clause detail) -- is the second one meant to say "Detail", or is the repeated header intentional?

## Closing Conditions — Seller

- Legacy config: `components/review/table-configs/conditions-m.config.js`
- Proposed V2 family: CLOSING_CONDITIONS (confidence: high)

### Table: Closing Conditions — Seller

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q4: the legacy config gives two different columns the identical header "Provision" (one renders a status pill, the other renders the clause detail) -- is the second one meant to say "Detail", or is the repeated header intentional?

## Approvals / Votes

- Legacy config: `components/review/table-configs/approvals-votes.config.js`
- Proposed V2 family: TERMINATION (confidence: low)
- Question Q5: this section's title and content did not map cleanly onto one V2 family (candidate: TERMINATION). Which family should own it, or does it need a new one?

### Table: Approvals / Votes

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Kind | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Votes / Approvals / SEC Filing / Meeting Requirements

- Legacy config: `components/review/table-configs/votes-approvals-meeting.config.js`
- Proposed V2 family: PROXY_MEETING (confidence: high)

### Table: Votes / Approvals / SEC Filing / Meeting Requirements

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

## Shareholder Meeting / Proxy / Tender-Offer SEC Matters

- Legacy config: `components/review/table-configs/sec-meeting.config.js`
- Proposed V2 family: PROXY_MEETING (confidence: high)

### Table: Shareholder Meeting / Proxy / Tender-Offer SEC Matters

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Subject | shows free text lifted verbatim from the extraction | (none extracted) |
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Termination Rights

- Legacy config: `components/review/table-configs/termination-rights.config.js`
- Proposed V2 family: TERMINATION (confidence: high)

### Table: Termination Rights

- No separate row-subject column -- Question Q6: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

## Termination Fees

- Legacy config: `components/review/table-configs/termination-fees.config.js`
- Proposed V2 family: TERMINATION_FEE (confidence: high)

### Table: Termination Fees

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

## Tail Fee Mechanics

- Legacy config: `components/review/table-configs/tail-fee.config.js`
- Proposed V2 family: TERMINATION_FEE (confidence: high)

### Table: Tail Fee Mechanics

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

## No-Solicitation / No-Shop

- Legacy config: `components/review/table-configs/nosol-section.config.js`
- Proposed V2 family: NO_SHOP (confidence: high)

### Table: No-Solicitation / No-Shop

- No separate row-subject column -- Question Q7: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

## No-Shop Core Mechanics

- Legacy config: `components/review/table-configs/nosol-noshop.config.js`
- Proposed V2 family: NO_SHOP (confidence: high)

### Table: No-Shop Core Mechanics

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q8: column 'Provision' renders pills but this generator found 2 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## Fiduciary-Out Mechanics

- Legacy config: `components/review/table-configs/nosol-fiduciary.config.js`
- Proposed V2 family: NO_SHOP (confidence: high)

### Table: Fiduciary-Out Mechanics

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows a pill from a fixed vocabulary | Constitutes or could reasonably be expected to lead to a Superior Proposal; Constitutes or could lead to a Superior Proposal |

## Intervening Event Mechanics

- Legacy config: `components/review/table-configs/nosol-intervening.config.js`
- Proposed V2 family: NO_SHOP (confidence: high)

### Table: Intervening Event Mechanics

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q9: column 'Provision' renders pills but this generator found 4 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## Superior Proposal Definition and Standards

- Legacy config: `components/review/table-configs/nosol-superior.config.js`
- Proposed V2 family: NO_SHOP (confidence: high)

### Table: Superior Proposal Definition and Standards

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |

## Interim Operating Covenants — Target

- Legacy config: `components/review/table-configs/ioc-exceptions.config.js`
- Proposed V2 family: INTERIM_OPERATING (confidence: high)

### Table: Interim Operating Covenants — Target -- NEGATIVE COVENANTS

- No separate row-subject column -- Question Q10: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Target -- AFFIRMATIVE COVENANTS

- No separate row-subject column -- Question Q11: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Target -- EXCEPTIONS

- No separate row-subject column -- Question Q12: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Target -- OTHER RESTRICTIONS

- No separate row-subject column -- Question Q13: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

## Interim Operating Covenants — Parent

- Legacy config: `components/review/table-configs/ioc-exceptions.config.js`
- Proposed V2 family: INTERIM_OPERATING (confidence: high)

### Table: Interim Operating Covenants — Parent -- NEGATIVE COVENANTS

- No separate row-subject column -- Question Q14: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Parent -- AFFIRMATIVE COVENANTS

- No separate row-subject column -- Question Q15: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Parent -- EXCEPTIONS

- No separate row-subject column -- Question Q16: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

### Table: Interim Operating Covenants — Parent -- OTHER RESTRICTIONS

- No separate row-subject column -- Question Q17: this table renders one composed cell per row rather than a flat term/columns pill table. What should the term/columns split be for this table under the V2 model?
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| (blank header) | shows free text lifted verbatim from the extraction | (none extracted) |

## Other Covenants

- Legacy config: `components/review/table-configs/general-covenants.config.js`
- Proposed V2 family: GENERAL_COVENANTS (confidence: high)

### Table: Other Covenants

- Row subject column: **Provision**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Link | shows free text lifted verbatim from the extraction | (none extracted) |

## Employee Compensation and Benefits

- Legacy config: `components/review/table-configs/employee-benefits.config.js`
- Proposed V2 family: EMPLOYEE_MATTERS (confidence: high)

### Table: Employee Compensation and Benefits

- Row subject column: **Benefit**
- Rows: a fixed list of 5 items
  - Fixed rows, in order: Base salary; Target annual bonus / cash incentive; Health and welfare benefits; Severance / change-in-control protection; Long-term incentive (LTI) / equity grants

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Reference Group | shows free text lifted verbatim from the extraction | (none extracted) |
| Standard | shows free text lifted verbatim from the extraction | (none extracted) |
| Period | shows free text lifted verbatim from the extraction | (none extracted) |

## Antitrust / Regulatory

- Legacy config: `components/review/table-configs/antitrust-regulatory.config.js`
- Proposed V2 family: ANTITRUST_REGULATORY (confidence: high)

### Table: Antitrust / Regulatory

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q18: column 'Provision' renders pills but this generator found 3 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## Representations & Warranties — Company

- Legacy config: `components/review/table-configs/representations-qualifiers.config.js`
- Proposed V2 family: REPRESENTATIONS (confidence: high)

### Table: Representations & Warranties — Company

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Qualifiers | shows free text lifted verbatim from the extraction | (none extracted) |
| Lookback | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q19: column 'Lookback' renders pills but this generator found 2 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## Representations & Warranties — Parent

- Legacy config: `components/review/table-configs/representations-qualifiers.config.js`
- Proposed V2 family: REPRESENTATIONS (confidence: high)

### Table: Representations & Warranties — Parent

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Qualifiers | shows free text lifted verbatim from the extraction | (none extracted) |
| Lookback | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q20: column 'Lookback' renders pills but this generator found 2 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## No Other Reps / Fraud

- Legacy config: `components/review/table-configs/no-other-reps-fraud.config.js`
- Proposed V2 family: NO_OTHER_REPS_FRAUD (confidence: high)

### Table: No Other Reps / Fraud

- Row subject column: **Question**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Status | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Material Adverse Effect

- Legacy config: `components/review/table-configs/mae-definitions.config.js`
- Proposed V2 family: MAE_DEFINITION (confidence: high)

### Table: Material Adverse Effect

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

- Question Q21: column 'Provision' renders pills but this generator found 2 candidate vocabulary maps in the file and none named-matched this column -- left 'verbatim' rather than guess; needs Ben's review to identify the real vocabulary and, likely, split this into per-signal sub-columns

## Material Contracts

- Legacy config: `components/review/table-configs/material-contracts.config.js`
- Proposed V2 family: MATERIAL_CONTRACTS (confidence: high)

### Table: Material Contracts

- Row subject column: **Contract Type**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Threshold | shows a computed value (AMOUNT) | (none extracted) |
| Evidence | shows free text lifted verbatim from the extraction | (none extracted) |

## Advisers / Fees / Expenses

- Legacy config: `components/review/table-configs/advisers-fees-expenses.config.js`
- Proposed V2 family: GENERAL_COVENANTS (confidence: low)
- Question Q22: this section's title and content did not map cleanly onto one V2 family (candidate: GENERAL_COVENANTS). Which family should own it, or does it need a new one?

### Table: Advisers / Fees / Expenses

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

## Miscellaneous / Boilerplate

- Legacy config: `components/review/table-configs/misc-boilerplate.config.js`
- Proposed V2 family: MISC_BOILERPLATE (confidence: high)

### Table: Miscellaneous / Boilerplate

- Row subject column: **Term**
- Rows: one row per matching provision/subject

| Column | What it shows | Vocabulary (pill text) |
|---|---|---|
| Provision | shows free text lifted verbatim from the extraction | (none extracted) |
| Detail | shows free text lifted verbatim from the extraction | (none extracted) |

