# Metsera generation 6: what was extracted, section by section, 2026-09-14

Ben, 2026-09-14: "look at all of the output yourself and analyze if you think it is right or wrong and if not, iterate to improve it"; "everything to be driven by coding and not just a layer on top so all edits need to be repeatable across corpus".

This note is the reading of run `0764b437-baa0-4a8d-b714-1975a1bb60f0` (submitted as generation 5, stored as source generation 6), the first Metsera run on Claude Opus 5 through Claude Code in the Vercel sandbox. It ran from 10:55 UTC to 15:52 UTC with three retries for the worker defects of findings (16) to (19) and finished READY: 85 of 85 sections, none failed, 817 proposals (799 VALID, 18 INVALID), 7.6m input and 3.1m output tokens. The worker carried commit 8fa3b9be from 12:56 UTC, so the sections before that point were extracted on earlier code and the code fixes made during the run (findings (16) to (23) in the plan's Q8 entry) apply from generation 7. Sections were read as they completed, against the agreement text, from the rendered table view and the per-fact dump, and every defect found is fixed in code.

## Verdict

The Claude provider is usable: after the stream-json join and the compact-JSON prompt no section failed on output shape, and the split kept every part inside the output cap. The extraction is fuller than generation 5 (817 proposals against a run that stopped at 49 sections) and the readouts land on the precedent's rows. Three defects are systematic and were invisible on the page until the sections were read against the text:

1. Every split section lost its limb (a). When (a) runs on from the heading line the structure keeps it as the section's own text, the split sent it to every part as context, and no part extracted it. Ten sections: 2.02(a) the paying agent, 3.09(a), 3.11(a), 3.13(a) the material contracts list, 3.17(a), 3.19(a), 5.01's "shall not" chapeau, 5.02(a) the no-shop covenant, 6.03(a) the reasonable best efforts covenant and the no-divestiture proviso, 6.05(a) the charter indemnification continuation. Fixed: the section's own opening words lead the first part (finding 20).
2. Proposals returned without a readout fell under "without a readout" though their rows are fixed (7.02's second bring-down tier, the buyer's officer certificate). Fixed: the row follows from the fact type and the party's table from the statement's words, at extraction and on the page (finding 21).
3. A quote cited on a span id that exists nowhere made the whole fact INVALID though the words are the section's own (7.01's Stockholder Approval condition). Fixed: such a quote resolves against the section (finding 21).

## Article I (Merger; Closing; Effective Time; Charter; Directors)

Right: the merger form, closing, effective time, charter and by-laws, directors and officers, each on the Structure & Mechanics grid with the other provisions grouped by term beneath it.

## Article II (Consideration; Payment; Equity Awards)

Right: 2.01 the $47.50 cash and one CVR per share, cancelled and treasury shares, appraisal shares; 2.03 each award class with its treatment. Merger Sub's capital had merged into Common Stock as "0.01": its own row on the capitalization table, and a count column never reads a money amount (finding 19's page work). 2.02 lost its limb (a), the paying agent (defect 1).

## Article III (Company representations)

Right, limb by limb, with the qualifier and look-back coded: 3.01 to 3.08, 3.10, 3.12, 3.14 to 3.16, 3.18, 3.20 to 3.26. The article introduction's exceptions sit on the General Exceptions row (SEC Filings with the one-business-day cut-off and the excluded portions; Disclosure Letter) and the knowledge definition on the Knowledge row (Standard: actual knowledge; Persons: executive officers), the layout Ben asked for ("move it over to what we had in the old version"). 3.09's tax-asset disclaimer had filled the No Other Reps table (a subject-limited disclaimer is the representation's exclusion; held at extraction by the section heading and on the page by its words). "Six year" look-back (units plural), "forty-eight (48) hours" read as 8 hours (parenthetical digits win). 3.03 and 3.15 one fact each INVALID on a LITANY built with children (now taken as members, finding 23). The (a) limbs of 3.09, 3.11, 3.13, 3.17 and 3.19 are missing (defect 1).

## Article IV (Parent representations)

Right: 4.01 to 4.09 on the Parent table. IV-INTRO had fallen into the Company table (a readout naming a retired table is none). 4.04 one fact INVALID on a LITANY with children (finding 23).

## Article V (Conduct of business; No solicitation)

5.01: the interim covenants as rows of the interim operating table, each limb its own fact; the chapeau ("shall not, without Parent's consent") is missing as a fact of its own (defect 1). 5.02: the no-shop's exceptions, notice periods (48 hours), match rights and recommendation-change mechanics read correctly; 5.02(a), the prohibition itself, is missing (defect 1); the takeover proposal threshold "twenty percent (20)% or more" was held on the odd "(20)%" (parsed now, finding 23).

## Article VI (Additional covenants)

6.01, 6.02, 6.06 to 6.09, 6.12 to 6.14: right, on the Other Covenants rows named from the subtype with the model's labels as sub-items (litigation notification with the Company's control of the defence and Parent's consent to settlement; public announcements with the two carve-outs; the CVR Agreement's four obligations). 6.03: filing deadline (30 business days), Parent's strategy control, consultation, information sharing with the outside-counsel restriction, the pull-and-refile bar with Parent's one-time withdrawal, the non-impediment covenant, third-party consents, and 6.03(d)'s deemed condition on the conditions table; the Efforts standard and Remedy commitment rows are empty because 6.03(a) was never extracted (defect 1). 6.04: every benefit element on its row with comparison, standard and the one-year period; service credit, the waivers and the disclaimers on the other-protections rows. 6.05: indemnification for six years, advancement, the tail with the 300% cap, successor assumption, third-party enforcement; 6.05(a), the charter and contract continuation, missing (defect 1; the row is backed by 6.05(e) alone). 6.10 and 6.11: the proxy deadline (10 business days), mailing, the meeting within 30 days of mailing, the record date and broker search, Parent's review, the adjournment for insufficient votes with the 15-day cap (the reason had no code; INSUFFICIENT_VOTES added). 6.15 (a bare cross-reference to the disclosure letter) UNRESOLVED_UNUSUAL_PROVISION, correctly.

## Article VII (Conditions)

7.01: No Legal Restraint and the two regulatory clearances as sub-items; Stockholder Approval INVALID on an unknown span id (defect 3). 7.02: the MAE tier and the de minimis tier of the bring-down as sub-items, covenant performance in all material respects, no continuing MAE; the all-material-respects tier and the officer's certificate without a readout (defect 2). 7.03: both tiers, covenant performance, the certificate. 7.04: both frustration branches on the mutual table.

## Article VIII (Termination)

8.01: mutual consent, the outside date (March 21, 2026, extended automatically to June 21, 2026 when only the regulatory conditions are open), final legal restraint, vote failure; Parent's termination for the Company's breach with the 30-day cure and the earlier-of rule, and for a recommendation change; the Company's for Parent's breach and for a Superior Proposal with the fee payable concurrently. The outside date row shows both dates in both columns: the omitted-cell completion read each fact's one DATE into both DATE columns (fixed for generation 7, finding 21). 8.02: the agreement void, no liability except fraud or willful and material breach (defined), surviving provisions, the $190,000,000 fee on the two direct triggers and the twelve-month tail, payment timing per trigger, the fee as sole and exclusive remedy, enforcement costs and prime-rate interest. The tail's 50% variant of the takeover proposal definition and the willful breach definition sit under "without a readout" (open, below). 8.03 and 8.04 on the boilerplate rows.

## Article IX (General)

9.01 to 9.11 on the boilerplate rows: survival, notices, construction, severability, counterparts, entire agreement and the third-party beneficiary carve-outs, governing law, assignment, the Delaware forum with its nine mechanics as sub-items, specific performance with the bond waiver and the Company's right to force the closing, jury waiver. 9.03: both MAE definitions with the carve-outs on the fixed rows and the disproportionality answers (Yes for economic, industry, war, disaster, pandemic and law; No for the announcement, Parent-requested actions, projections and the disclosure letter), the carve-back as the footer; the limb summary said "One limb" for the Company (two limbs) and nothing for Parent: now derived from the prong facts (finding 22). 9.07: the no-other-reps table's four rows.

## Causes and fixes (all in code, applied to every agreement)

| Cause | Where seen | Fix |
| --- | --- | --- |
| Claude Code's `result` is the last text block | 3.02 | stream-json output joined across text blocks |
| Output over the 64k cap, continuation as a second object | 3.09, 3.02, 3.06 | split at 5,000 bytes and three limbs into parts of about 3,500 bytes; compact-JSON prompt; CLAUDE_OUTPUT_TRUNCATED |
| Renewals queued behind one that never returned; stale errcode retried by PostgREST | 2.02 | 60 s renewal timeout, independent ticks, logged outcomes; P0001 |
| Split parts refused by the invocation identity check, failure record swallowed | 2.02, 3.09, 3.11 | part identity from the request's part number (three migrations); `recordSectionFailure` |
| Limb (a) in the chapeau span, sent as context only | every split section | the local chapeau leads the first part, which is told to treat it as a limb |
| Quote on an unknown span id | 7.01, 5.01 | resolved against the section when verbatim there |
| Proposal without a readout on a fixed-row table | 7.02 | `fact_type_rows` + `statement_words`; `defaultConclusions` at extraction and on the page |
| Value column completed from a component another column of the same kind already reads | 8.01 | a component is read into one value column per kind |
| Vocabulary too narrow | 6.11 adjournment reason; 9.03 limb summary | INSUFFICIENT_VOTES, PARENT_REQUEST; the limb summary derived from the prong facts |
| Odd number forms | 5.02 "(20)%"; 5.02 "forty-eight (48) hours"; 3.11 "6 year" | percentage and period parsers |
| LITANY with children | 3.03, 3.15, 4.04 | children taken as members |
| Subject-limited disclaimer on the No Other Reps table | 3.09 | held by the heading at extraction, by its words on the page |
| Merger Sub's capital merged into Common Stock | 4.02 | its own security class; COUNT never from a money amount |
| Intro and knowledge facts on the wrong rows; readout naming a retired table | III-INTRO, IV-INTRO, 9.03 | page rules: General Exceptions and Knowledge rows; retired table readout is none |
| One column-made sub-item under a one-fact row | 7.02 | stands only beside another |

## Open for generation 7's read

- The tail fee's threshold (8.02's 20% to 50% variant of the takeover proposal definition) is a KEY_DEFINED_TERMS fact and the tail-fee table takes TERMINATION_FEE only; the willful breach definition (8.02(a)) likewise sits under "without a readout".
- The general covenants Access row joins every standard of its twelve facts; with `headline.summary` on every fact from generation 7 the Summary column will list twelve summaries. A row with that many facts needs sub-items the model did not name.
- The stored generation 6 rows keep the defects fixed at extraction (6.03's efforts and remedy rows, the (a) limbs, 8.01's doubled dates, 7.01's stockholder approval); generation 7 is the reading that tests the fixes.
