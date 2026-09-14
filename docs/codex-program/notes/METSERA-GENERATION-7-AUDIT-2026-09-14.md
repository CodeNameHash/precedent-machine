# Metsera generation 7: what was extracted, section by section, 2026-09-14

Ben, 2026-09-14: "look at all of the output yourself and analyze if you think it is right or wrong and if not, iterate to improve it"; "everything to be driven by coding and not just a layer on top so all edits need to be repeatable across corpus".

This note is the reading of run `8c53fb92-06c9-40f1-b6b3-f9da5cdf7b3d` (submitted as generation 6, stored as source generation 7), the second Metsera run on Claude Opus 5 through Claude Code in the Vercel sandbox and the run that tests generation 6's fixes (`METSERA-GENERATION-6-AUDIT-2026-09-14.md`). Submitted 16:35 UTC; every section complete at 22:09 UTC; READY at 22:50 UTC after two finalisation failures, both fixed in code (below). 937 proposals (916 VALID, 21 held), 9.85m input and 3.15m output tokens, one stop on Ben's Claude session limit (19:29 to 20:44 UTC, finding 34). The worker was updated four times during the run (f5c00f4, c616f56, 051bc2e, then d1eb05c8 and 94b20989 for finalisation), so sections read on the code of their hour; the plan's Q8 findings (25) to (39) record each read as it happened. The page: `https://deal-corpus-preview.vercel.app/review/product/8c53fb92-06c9-40f1-b6b3-f9da5cdf7b3d/provisions`.

## Verdict

Generation 6's three systematic defects are gone. Every split section carries its limb (a): 2.02(a) the paying agent, 3.09(a) the tax filings, 3.13(a) the material contracts, 3.17(a), 5.01's chapeau and covenant introductions, 5.02(a) the no-shop covenant, 6.03(a) the efforts covenant and the no-divestiture proviso, 6.05(a) the charter continuation. Readout-less facts on fixed rows default to their rows (7.02's tiers, the certificates). 7.01's Stockholder Approval condition is on the mutual conditions table. The summaries Ben asked for ("1. for now - yes") are on nearly every fact and read as one line each.

Two failures stopped finalisation after every section had completed, both in the pipeline rather than the extraction, both fixed for every run:

1. `DRAFT_NESTED_IDENTITY` on one 3.14 proposal. The section results are read 500 rows a page, and the component rows were ordered by (proposal_id, ordinal), which is not total: a child and a top-level sibling share an ordinal, the tie fell exactly across the 2,500-row page boundary, Postgres ordered the tied rows differently on the two pages, one row came back twice and one never, and the rebuilt tree no longer hashed to the proposal's id. Every paged order now ends in the table's own key; a store test pages a double that resolves ties differently on each page.
2. `DRAFT_COVERAGE_COMPLETENESS: 2.01:KEY_DEFINED_TERMS:OTHER_DEFINED_TERM_RECORDED`. Finding (29)'s schema fix added a required fact type mid-run; the six sections extracted before it (2.01, 2.03, 3.02, 3.03, 3.09, 3.12) carry no coverage assertion for it. Their stored extraction requests name every fact type the model was asked to cover, so a fact type absent from all of them is schema drift, not a coverage gap: the draft records it as a draft-level `SCHEMA_DRIFT_FACT_TYPE` issue (six on this run), the family's coverage of that fact type stays UNRESOLVED, and validation accepts the missing assertion only when the drift is evidenced and recorded. A missing assertion for a fact type the model was asked about is still a failure.

## Article I (Merger; Closing; Effective Time; Charter; Directors)

Finding (25). The grid's summaries hold ("Merger Sub merges with and into the Company at the Effective Time"; "Each Company share receives $47.50 cash plus one CVR"). Fixed from the read: the Other provisions Term and Summary had swapped; summaries naming a statute's section or an Article were dropped by the summary rule (now content); "$47.5" (cents kept).

## Article II (Consideration; Payment; Equity Awards)

Findings (25), (27). 2.01's six appraisal mechanics had no section and fell off the page: APPRAISAL_DISSENTERS_RIGHTS joins the consideration section as its Other provisions. 2.02's limb (a) is extracted, the chapeau in part 1 of 4. 2.03's award rows read as generation 6's did.

## Article III (Company representations)

Findings (27), (29), (31), (32). The capitalization table fills from 3.02 and 3.03 (800,000,000 authorised, 105,278,627 outstanding, 6,331,920 reserved, the option, RSA and ESPP counts, subsidiary equity), absences as its Other provisions block. 3.01 had "Except as disclosed in SEC filings" coded on its own row though the exception is the article introduction's: the General Exceptions row's codes are dropped from every other row at admission and on the page. 3.09's limb (a) and its Tax definitions (OTHER_DEFINED_TERM finally in the contract; the schema builder's duplicate `add` key) come through; 3.08's rows survive a malformed value cell (cell-level drop). 3.11 failed once on a link citing a span in no closure (now dropped with UNSUPPORTED_FACT_LINK) and completed at its third attempt with ERISA and Proceeding definitions. The Material Contracts table is the precedent's 26 categories with thresholds parsed from the words and no absent rows. 3.18's LIST_ELEMENTs outside a LIST build as TERMs. 3.12, 3.14 to 3.17, 3.19 to 3.22 on their rows with qualifiers and look-backs.

## Article IV (Parent representations)

Finding (33). Correct, with Merger Sub's 1,000 shares on their own capitalization row.

## Article V (Conduct of business; No solicitation)

Findings (33), (35). 5.01: the consent standard, general exceptions and ordinary course standard open the section as the general-terms table (Ben's covenant introductions); the affirmative covenants and 33 restriction rows with thresholds ($2,000,000 acquisitions and capex, $500,000 indebtedness), exceptions and sub-items; "specific restrictions govern" a fourth general-terms row; the two DIVIDENDS coordination facts on the Dividends and Distributions row. 5.02: limb (a) (solicit, negotiate, waive a standstill; representative control; 48-hour notice), the fiduciary-out, change-of-recommendation mechanics, the intervening event (four business days' notice, the excluded events), the 50% Superior Proposal threshold, the 20% Company Takeover Proposal definition, the matching rights. Ten facts were INVALID on legacy role and value checks with whole component trees: under the layered model those are NOTEs and the facts stay VALID. Nine facts without a readout (deemed breach, no restricting agreement, bidder information, once-only reaffirmation, three definitions) stay under "without a readout" or in Defined Terms: the model's readouts are the fix, not page rules. Ben's intervening event and no-shop comments are awaited.

## Article VI (Additional covenants)

Finding (36). 6.03's limb (a) yields fifteen facts: the Efforts standard row (Reasonable best efforts; the additional-instruments and ordinary-course carve-outs as sub-items) and the Remedy commitment row (No remedy required; clauses (A) to (F) as sub-items; the Company's conditioned-on-Closing undertaking as Remedy only if conditioned on Closing). 6.05's limb (a) fills the Charter and contract continuation row (assumption, survival, six years, no adverse amendment). 6.04's benefit rows, 6.06's five publicity sub-items, 6.10 and 6.11's proxy timetable with the adjournment reason Insufficient votes, 6.12 to 6.14 read correctly; 6.15 stays UNRESOLVED_UNUSUAL_PROVISION.

## Article VII (Conditions)

Findings (36), (37). 7.01's Stockholder Approval condition on the mutual table; 7.02's three bring-down tiers as sub-items with their standards and the sections they cover; 7.03's two tiers; the certificates; the frustration rule with a branch per party.

## Article VIII (Termination)

Finding (37). 8.01's rights with the 30-day cures and the earlier-of rule; the outside date row had both dates in both columns from the page's own value completion (now one component per value column per kind, as the extractor's completion). 8.02's fee, triggers, timing per trigger, exclusive remedy with the once-only clause as its line, interest and the 12-month tail; the willful-breach definition and its knowledge standard as Defined Terms entries. 8.05's board-action formalities.

## Article IX (General)

Finding (39). 9.01 (Survival: representations do not survive, specified covenants survive), 9.02 (Notices: writing, email, personal delivery, courier, the addresses and copies), 9.04 (Construction, eighteen rules), 9.05 (Severability), 9.06 (Counterparts), 9.07 (Entire agreement; No Other Reps: the Company's and Parent's disclaimers, the buyer non-reliance, the fraud carve-outs and the data-room liability as sub-items; the third-party beneficiary carve-outs for award holders and share holders as sub-items; the indemnified parties' enforcement right on the D&O table), 9.08 (Delaware), 9.09 (Assignment: Merger Sub to Parent or a wholly owned subsidiary, no relief, consent, void), 9.10 (the Delaware Court of Chancery forum with its mechanics; specific performance with the Company's right to compel the closing), 9.11 (Jury trial waiver), each on its Miscellaneous row. 9.03: the carve-outs on their fixed rows with the disproportionality answers (Yes for economic, industry, war, disaster, pandemic and law; No for the announcement, Parent-requested actions, projections); Knowledge on the reps table's second row (Actual knowledge; Officers); 28 OTHER_DEFINED_TERM facts, 17 as new Defined Terms entries and 11 already entered from the sections that use them. Three defects, each fixed in code:

- The Company MAE definition came back as one DEFINITION_PRONG fact for limb (ii) (the ability to consummate) and none for limb (i) (the effect on the business), so the derived limb summary said "One limb" for the Company again (generation 6 had both). The MAE_DEFINITION layer rule now asks for one prong fact per limb and never the consummation limb alone.
- The underlying-cause proviso ("the underlying facts giving rise or contributing to such failure or change may be taken into account") had no readout and no place. The carve-out tables' footer now takes both provisos (`footer_from_subtype.subtype_keys`), a footer fact needs no readout, and a footer-subtype fact with no readout resolves to its family's table, the party read from its own words. The footer is "Carve-back provisos as drafted".
- The scheduled-matters carve-out ((J), "the matters set forth on Section 9.03(a) of the Company Disclosure Letter") lost its summary because the summary rule read the Disclosure Letter section as a section of the agreement, and its "Other carve-out" row showed an empty provision cell. A Disclosure Letter section is content in a summary, and "Matters scheduled in the Disclosure Letter" is a fixed carve-out row. The stored generation 7 row stays empty (its summary was dropped at extraction); generation 8 carries it.

## Causes and fixes (all in code, applied to every agreement)

| Cause | Where seen | Fix |
| --- | --- | --- |
| Paged read of component rows in a non-total order | finalisation (3.14 proposal) | every `RESULT_TABLE_ORDER` ends in the table's key; tie-flipping store test |
| Required fact type added to the schema mid-run | finalisation (2.01, 2.03, 3.02, 3.03, 3.09, 3.12) | `SCHEMA_DRIFT_FACT_TYPE` draft issue, evidenced by the stored extraction requests; family coverage UNRESOLVED |
| Run FAILED at finalisation refused by the worker | wake after the fix | the existing finalisation retry (`product_phase3_retry_run`) returns the run to RUNNING / DRAFT_FINALIZATION; the wake then finalises |
| Summary rule refused a Disclosure Letter section | 9.03(J) | Disclosure Letter sections are content |
| Footer took one subtype; a no-readout footer fact had no table | 9.03 underlying-cause proviso | `subtype_keys`; footer before the readout gate; footer table resolved from the family |
| One prong fact for a two-limb definition | 9.03 Company MAE | layer rule: one DEFINITION_PRONG per limb |
| Carve-out with no fixed row | 9.03(J) | "Matters scheduled in the Disclosure Letter" row |
| Worker restarts leave leases | 3.11 and others | expire on their own; retried under their attempts (unchanged) |
| Claude session limit read as "claude exited 1" | 19:29 UTC | reason surfaced; worker stops on the usage limit |

## Open for generation 8's read

- The six drift sections (2.01, 2.03, 3.02, 3.03, 3.09, 3.12) were extracted without OTHER_DEFINED_TERM in the contract; their definitions (2.01's, 3.02's and 3.03's capital terms) are not facts. Generation 8 extracts them under the full contract. The drift issues are stored at draft level; the page does not yet show them.
- The stored generation 7 rows keep the defects fixed at extraction after their hour: 9.03's one-limb Company MAE and the empty scheduled-matters cell, 3.01's stripped-on-page codes, the readout-less no-shop facts.
- The tail fee's threshold and the general covenants Access row (generation 6's open items) stand as they were; the Access row lists its facts' summaries.
- Ben's intervening event and no-shop comments.
