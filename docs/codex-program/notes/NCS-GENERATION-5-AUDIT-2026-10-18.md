# NCS generation 5: what was extracted, section by section, 2026-10-18

Ben, 2026-09-14: "look at all of the output yourself and analyze if you think it is right or wrong and if not, iterate to improve it"; "everything to be driven by coding and not just a layer on top so all edits need to be repeatable across corpus".

This note is the reading of run `51577c57-41b1-4b75-bcdf-c84ef2558589` (submitted as generation 4, stored as source generation 5), the first NCS run on the Anthropic API provider (`lib/product/anthropic-api-model.js`, the two-block cached prompt, the workspace header) and the first run under the sandbox pool (finding (140)). Woken 13:27 UTC; the stops of the day (the output cap on 5.1 at 64,000 tokens three times, the model-config identity mismatch, the part-identity migration, the residual-paragraph rule, the workspace-scoped key) are plan findings (74) to (93) and (160) to (163); READY at 20:48 UTC. 1,037 proposals (1,015 VALID, 22 held), 104 sections, 393 model calls (118 routing, 118 residual, 157 extraction), 12.79m input tokens (6.37m uncached, 4.68m read from the cache, 1.73m written to it) and 3.80m output tokens; the pipeline's stored cost $145.68. The worker ran the code of its 18:55 UTC wake, so rules merged later today (work package 18 (a) to (e), finding (94) and (95)) apply to the stored rows only where they are page rules. The page: `https://deal-corpus-preview.vercel.app/review/product/51577c57-41b1-4b75-bcdf-c84ef2558589/provisions`.

Against generation 4 (run 39456f2d, prompt V8, finding (101)): 850 VALID and 145 held there, 1,015 VALID and 22 held here; the holds fall from 92 INVALID_FACT_COMPONENTS and 45 DUPLICATE_FACT_OCCURRENCE to 22 INVALID_FACT_COMPONENTS and no duplicates.

## Verdict

The agreement reads on the page. The mixed-election consideration is the deal's row (Mixed election; appraisal rights present; without interest), with the three exchange ratios (0.5537 share, 0.1371 cash, 0.2392 mixed), the Cash Consideration formula, the Maximum Cash Election Amount and the Excess Cash Amount in Defined Terms; the election mechanics table carries the deadline (five Business Days' notice, delayed with the Closing), the default (Share Consideration), the revocation and the Exchange Agent's discretion. The Company MAE carve-outs sit on their fixed rows with the disproportionality answers the proviso gives (Yes for industry, economy, law and GAAP, war and pandemics; No for projections, stock price, the announcement and Parent-requested actions), the two carve-back provisos as the table's footer and the Disclosure Letter matters on their row. The no-shop tables read as drafted: cease discussions immediately, the 48-hour notices and updates with unredacted materials, the bona fide unsolicited proposal before the Written Consent, the Board's fiduciary-duty standard, the Acceptable Confidentiality Agreement. The Tolling Period (the Irish High Court hearing to sanction Rewind) is on the Outside Date row with its day-for-day extension and its bar on termination, and in Defined Terms. The termination rights, the bring-down tiers, the officer's certificate and the no-MAE condition are on their rows.

Twenty-two facts are held, all with a reason, and eight VALID facts have no readout. Every hold has a code fix in work package 18 or 19 (below); none needs a re-run to be judged.

## What is held, and the rule for each

| Section | Held | Reason stored | Rule |
| --- | --- | --- | --- |
| 3.4 | 10 STATUS_REPRESENTATION facts (authority, the Board's approval and recommendation, the Written Consent as the only approval, enforceability) | "byte range missing" with UNKNOWN_SOURCE_COMPONENT: each cites the Article III chapeau quote on span id `3d0f0a06...`, which no span of the run carries; the closure's chapeau span is `3d0f7a06...`, one hex character away. The model mistyped the id. | Work package 19 (a): an inherited-origin quote on an unknown span id is taken from the one closure span of an allowed kind that holds it verbatim (work package 18 (a) did this for a known span); the quote is the evidence, ids are never matched by distance. |
| 4.7 | 3 DOCUMENT_REPRESENTATION facts (the S-4 and the Information Statement) | "byte range missing": the INTRO quote cited on the Article III span, held by the Article IV chapeau | Work package 18 (a), merged after the wake: VALID on the next generation (finding (94) counted these three). |
| 2.1, 3.2, 4.2 | Mixed Election Stock's cash (a formula), no preferred stock outstanding, no treasury shares | "AMOUNT needs a canonical value": a formula and two none-counts | Work package 14 (finding (87)), merged after the wake: VALID on the next generation. |
| 5.11 | The tail premium's Base Amount, "the last aggregate annual premium paid by the Company" | "AMOUNT needs a canonical value": a reference quantity with no number | Work package 18 (b), REFERENCE form: VALID on the next generation (finding (94)). |
| 6.2 | 2 BRINGDOWN facts (the specified representations true in all respects; the organisation, authority, no-conflict and brokers representations in all material respects) | "LIST without LIST_ELEMENT children": the list "Section 3.9(c), Section 3.20, Section 3.21" has CROSS_REFERENCE children | Work package 19 (b): a list of cross-references is the list of the representations covered by the tier; the validator or the extractor decides, the rule that keeps the stored facts VALID preferred. |
| 6.4 | 3 FRUSTRATION facts (Parent, Merger Sub and the Company may not rely on a condition failure their own breach caused) | "CROSS_REFERENCE must resolve" on "this Article VI" (resolves_to null) | Work package 19 (c): an Article reference resolves to the article node as a Section reference resolves to its section. These three holds are the FRUSTRATION_BREACH_STANDARD entry among the draft-level REQUIRED_FACT_TYPE_UNRESOLVED issues. |

The eight VALID facts without a readout (6.1 and 6.3's general closing conditions and the tax opinion, 7.1's Support Agreement and Written Consent non-delivery termination rights, 7.2's remedy entitlement, 7.3's construction clause, 7.5's cumulative rights) are subtypes with no row in the shapes; work package 19 (d) gives each its row. Metsera generation 8 had none without a readout.

## Notes on the run (not holds)

- CONCLUSIONS_MISSING, 140 notes: 44 on 8.3's defined terms and 9 on 2.1's, 4 on 3.24's (a definition fact carries no table readout, by design, and the note says so for each); 36 on 2.3's exchange mechanics and 10 on 2.5's election mechanics, which the page places on the consideration-structure row and the election table from the subtype. The note is correct and the facts are placed; the count is the cost of writing one note per fact without a readout the model wrote. No change.
- CONCLUSIONS_CELLS_DROPPED, 31: the representations' "Except as set forth in the Disclosure Letter" and "Except as disclosed in SEC filings" materiality codes dropped from the per-representation rows (3.5, 3.9, 3.12, 3.18, 3.22), because the general-exception rows of the qualifiers table carry them once for the whole article; 5.1's six and 5.11's two are the same rule on the covenant rows. Working as decided.
- HEADLINE_SUMMARY_DROPPED, 12: every one a summary naming a section ("Section 5.16 confers no rights on employees", "Parent's Sections 4.1, 4.2(a), 4.3 and 4.4(a)(i) representations must be true"); the rows keep their label-built terms. 6.3's two name the representations a bring-down tier covers, which is the fact's substance; the extractor's wording is the fix (the same observation as Metsera's 6.04), not the rule.
- LONG_SECTION_SPLIT, 20 sections split into parts; UNSUPPORTED_FACT_LINK 7 (6.3's five REQUIRES links from one fact cite a span the closure lacks; 3.16's and 8.3's one each); RELATIONSHIP_NOT_ALLOWED 3 on 5.2 (DEFINED_BY and EXTENDS between no-shop facts); VALUE_NON_LITERAL_NUMERAL 3 on 5.3 and one on 1.2; COMPONENT_SPAN_RELOCATED 5 (6.1, 6.3, 8.3: work package 13 (a) moving a chapeau quote to the span that holds it). Each is a note beside a VALID fact.
- UNRESOLVED_UNUSUAL_PROVISION, 25, the product doing its job: 5.17's fifteen (the registration rights, now Ben's decision in finding (163): a table at the bottom of the Consideration section, work package 19 (f)); and ten provisions that are unusual: 1.2's Tolling Period blackout and its bar on termination; 5.19's mandatory assignment and novation of the whole Agreement from Parent to a US entity and 7.1's termination right if the novation fails; 6.3's Canadian and Alberta tax-deposit condition; 7.3's VAT warranty on the fee and its mandatory election to accept or decline; 8.3's "Rewind" (the Irish scheme of arrangement redomiciling Parent), "Registration Statement" and "Registrable Securities". These stay for Ben as unusual provisions; they are not extraction defects.
- Draft-level REQUIRED_FACT_TYPE_UNRESOLVED, 3: REPRESENTATION_ACCURACY_STANDARD (the qualifiers table carries the bring-down standard on the general-exception rows: "True except for de minimis inaccuracies"; the required type is a separate fact the extractor did not write, to read against 6.2's words on the next generation), TAIL_PREMIUM_CAP_OFF_AGREEMENT (5.11's cap is the Base Amount in the Disclosure Letter, held above), FRUSTRATION_BREACH_STANDARD (6.4's three holds).
- Coverage: 4,089 FOUND, 2,986 NOT_FOUND, 84 UNRESOLVED (the 25 unusual provisions, the holds, and 5.17's fifteen).

## Section by section

### Article I (Merger; Closing; Effective Time)

1.1 and 1.3 to 1.7 on the structure row (one-step reverse triangular merger, the Company surviving; the Effective Time; the charter, bylaws, directors and officers). 1.2's nine facts: the Closing at 10:00 a.m. Central on the second Business Day after the Article VI conditions, remotely by electronic exchange, at Baker Botts in Houston, or when the parties agree; the Tolling Period on the Outside Date row and in Defined Terms. Correct.

### Article II (Consideration; Elections; Exchange; Awards)

2.1's 24 facts: the package, the three exclusions (treasury and Parent-held shares; the adjustment clause authorising nothing prohibited; Rewind causing no adjustment), the Share and Mixed Election conversions, the ratios and formulas in Defined Terms, the Section 368(a)(2)(E)(ii) cash cap on the Tax Matters row, the dividend link on the dividends restriction row. The one hold is the Mixed Election cash (a formula). 2.5's sixteen election facts on the election table and the deal row; 2.2's award treatment; 2.3's exchange mechanics on the deal row with their notes. The Mixed Share Consideration Value is in Defined Terms and, under work package 16, linked from the mixed row by its words.

### Article III (Company representations)

3.1 (24 facts): the organisation representations under their qualifiers rows, the two general exceptions (Disclosure Letter; SEC filings, "True except for de minimis inaccuracies" as the bring-down), the MAE prongs and carve-outs as in the verdict. 3.2 and 3.3: the capitalization table (11,250,000 Common Stock authorised and the rest of the grid) with fourteen absences as the table's Other provisions. 3.4: all ten status representations held by the mistyped span id (above); the section's substance is on the page only through its summaries. 3.5 to 3.29: the per-representation rows with their materiality cells, the material contracts list, the Tax and benefit-plan definitions in Defined Terms. 3.24's definitions and 3.14's, 3.12's carry the CONCLUSIONS_MISSING note by design.

### Article IV (Parent representations)

4.1 to 4.6 on the Parent table; 4.2's capitalization row (1,356,000,000 authorised, 71,891,401 issued as of May 28, 2026) with one none-count held; 4.7's three S-4 and Information Statement representations held by the Article III chapeau citation (VALID under work package 18 (a)).

### Article V (Covenants)

5.1 split into parts: the general terms, the affirmative covenants, the restriction rows with their thresholds and exceptions (Repeat Precision dividends on the dividends row). 5.2 (27 facts) as in the verdict. 5.3 to 5.16: the efforts, access, notification, employee, indemnification (5.11's tail with its held Base Amount), takeover-law, Section 16, listing and publicity covenants; 5.14's twelve publicity facts read as eight sub-items under work package 18 (c) (Announcement release 2; Consultation and review 2; Consistent with prior statements 1; the four carve-outs 6; Law or exchange exception 1). 5.17 (41 facts): 32 general-covenant facts and nine capitalization facts on the Parent Ordinary Shares; the sub-items of finding (95) show (Effectiveness and amendments 5, Indemnification 8, Resale registration 3, Rule 144 and legend removal 3, Listing and reporting 2, Expenses 1, Stockholder information and approval 1) but the row move to "Registration rights" does not happen on the stored rows, and the home Ben chose is a table at the bottom of the Consideration section: work package 19 (f) and (g). 5.19's novation is an unusual provision for Ben.

### Article VI (Conditions)

6.1 mutual, 6.2 Parent's (the performance covenant, the de minimis tier on 3.2(a), the MAE tier with qualifiers disregarded, the certificate, no MAE; the two specified-representation tiers held by their cross-reference list), 6.3 the Company's (the tax-deposit condition unusual), 6.4 frustration held by "this Article VI". The general conditions and the tax opinion have no row yet (work package 19 (d)).

### Article VII (Termination)

7.1 (16 facts): mutual consent, the Outside Date, the legal restraint, the recommendation change until the Written Consent, the Company and Parent breach rights with 30-day cures capped at the Outside Date, the notice formality; the Support Agreement and Written Consent non-delivery rights have no row yet. 7.2 and 7.3: the effect of termination, the fee, its triggers and timing, the VAT warranty and the mandatory election (unusual). 7.5 cumulative rights without a row.

### Article VIII (General)

8.1 to 8.12 on the Miscellaneous, No Other Reps and remedies rows; 8.3's 44 definitions in Defined Terms (Rewind, Registration Statement and Registrable Securities unusual); one DEFINED_BY link on a Tax Return definition cites a span outside the closure (a note).

## Causes and fixes (all in code, applied to every agreement)

| Cause | Where seen | Fix |
| --- | --- | --- |
| A chapeau quote cited on a span id the run does not know (one hex character off) | 3.4, ten facts | Work package 19 (a): relocation by the verbatim quote to the one allowed closure span, unknown_span noted |
| A chapeau quote cited on the wrong known span | 4.7, three facts | Work package 18 (a), finding (94) (merged) |
| A formula or none-count as an AMOUNT | 2.1, 3.2, 4.2 | Work package 14, finding (87) (merged) |
| A reference quantity as an AMOUNT | 5.11 | Work package 18 (b), finding (94) (merged) |
| A list of cross-references as a LIST | 6.2, two facts | Work package 19 (b) |
| An Article reference that does not resolve | 6.4, three facts | Work package 19 (c) |
| Subtypes with no row in the shapes | 6.1, 6.3, 7.1, 7.2, 7.3, 7.5, eight facts | Work package 19 (d) |
| Registration rights on the covenants table, and the row rule not applying to stored rows | 5.17 | Work package 19 (f) and (g), on Ben's finding (163) |
| The output cap at 64,000 tokens on a long part | 5.1, three attempts | Work package 15 (the documented 128,000 maximum; parts halve after a cap failure), findings (81), (83) (merged, in this run's worker) |

## For Ben

- The ten publicity sub-item labels of finding (94) (c) and the seven registration-rights labels of finding (95) are the code's proposals; the names are yours.
- The ten unusual provisions above (Tolling Period, novation, the tax-deposit condition, the VAT warranty and mandatory election, Rewind and the registration terms) are shown as unusual on the page; say if any is a provision the schema should carry as a fact type.
- Question (g) of work package 18 (the capitalization facts of 5.17) is still open.
