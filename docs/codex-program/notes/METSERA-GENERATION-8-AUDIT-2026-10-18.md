# Metsera generation 8: what was extracted, section by section, 2026-10-18

Ben, 2026-09-14: "look at all of the output yourself and analyze if you think it is right or wrong and if not, iterate to improve it"; "everything to be driven by coding and not just a layer on top so all edits need to be repeatable across corpus".

This note is the reading of run `72d94dd2-cb59-49cf-8f46-c89d161b7769` (submitted as generation 7, stored as source generation 8), the third Metsera run on Claude Opus 5 through Claude Code in the Vercel sandbox and the run that tests generation 7's fixes (`METSERA-GENERATION-7-AUDIT-2026-09-14.md`) and Ben's comments on the no-shop, intervening event and consideration pages (plan findings (42), (44), (47)). Woken 02:07 UTC; 84 sections complete by 07:57 UTC, when 9.03 failed its three attempts; 9.03 complete on a retry at about 09:50 UTC under work package 9's paragraph split; one finalisation failure, fixed in code (below); READY at 10:28 UTC. 974 proposals (961 VALID, 13 held), 10.88m input and 3.62m output tokens, 313 model calls (93 routing, 90 residual, 130 extraction). The worker was updated during the run for work packages 5 to 9 (findings (53), (55), (58), (60), (63)) and once for finalisation (d2a3ef9), so sections read on the code of their hour; the plan's Q8 findings (52) to (65) record each read as it happened. The page: `https://deal-corpus-preview.vercel.app/review/product/72d94dd2-cb59-49cf-8f46-c89d161b7769/provisions`.

## Verdict

Generation 7's three Article IX defects are gone and Ben's comments are answered by the extraction, not by page rules. The Company MAE definition is two prong facts on one row (the effect on the business; the ability to consummate by the Outside Date); the carve-back provisos sit under the carve-out table as its footer; the scheduled-matters carve-out has its row and its summary. The no-shop notice table is 5.02(d)'s mechanics on their own rows; the Board determination standard is coded from its words; the subsequent match period reads two business days, as the clause deems it; the six no-shop permissions have rows; the material-contract representation's limbs sit under the Material Contracts row; the Tax Matters row carries 2.02's transfer-tax allocation. Every fact on the page has a home: none is listed without a placement.

Two failures stopped the run after the extraction was otherwise complete, both in the pipeline, both fixed for every run:

1. 9.03 (the definitions section) failed three attempts: a 30-minute timeout, then two answers of 115,712 and 124,260 output tokens that passed the Claude CLI's output cap and came back as two text blocks. 9.03 has no lettered limbs, and the long-section split only cut a section with three or more operative children, so every generation had sent it as one call; generation 7's 108,331-token answer had just fitted. A limbless long section now splits by its paragraphs into parts of the usual size, each definition whole in exactly one part (finding (63)). The retry extracted 9.03 as seven parts (13,680 to 40,992 output tokens each): 53 facts, none held.
2. `DRAFT_PROPOSAL_VALIDATION` on one 6.03 fact at finalisation: the RECOMMENDATION_CHANGE fact for 6.03(a)(C) ("Neither the Company Board nor any committee thereof shall ... approve, recommend or declare advisable ... any Company Takeover Proposal") was VALID under generation 7's soft-legacy rule (its component tree compiled; the legacy permitted_trigger role was missing and recorded as a note), and the finalisation check still demanded every legacy role. Finalisation now accepts a missing required role only against the section's recorded MISSING_REQUIRED_ROLE note for the same family, subtype and section; without the note the fact fails as before (finding (65)).

## Article I (Merger; Closing; Effective Time; Charter; Directors)

Finding (52). As generation 7: the merger, the Closing on the third business day after the Article VII conditions, the Effective Time, the charter and bylaws, the directors and officers, each on its row with a summary. 1.03's filing summary was dropped at 16 words against the 15-word cap; the cap now tolerates 18 while the extractor is still asked for 15 (finding (53)), and the stored row falls back to its label-built term.

## Article II (Consideration; Payment; Equity Awards)

Findings (52), (54). The consideration grid ($47.50 cash plus one CVR, the Appraisal Shares, the award treatment), the paying agent (2.02 in four parts, the chapeau in part 1), the appraisal mechanics as the section's Other provisions. New this generation: 2.02's transfer-tax allocation fact is on the Tax Matters row (the three families without a table in the shapes, TAX_MATTERS, FINANCING_COVENANTS and GUARANTY_FINANCING_PARTY, now have sections and rows from the subtype; finding (53)). Ben's comment on the consideration tree ("hitting 'show detail' doesn't add much" and the indentation of (i) and (ii)) is page work, with the UI points listed under open items.

## Article III (Company representations)

Findings (52), (54), (56). The capitalization table from 3.02 and 3.03 with the absences as its Other provisions and the definitions in Defined Terms (the drift sections of generation 7 are extracted under the full contract). 3.09's limb (a) and Tax definitions; 3.11's plans and definitions; the material contracts list at 23 categories with thresholds from the words. New this generation: 3.13(b) and (c)'s representations about the material contracts (validity, no default, the disclosure list) sit under the reps table's Material Contracts row with their MAE and materiality cells (finding (55)); a second definition fact for a term already entered merges into the Defined Terms entry instead of being dropped. The 13 held facts of the run are here and in 8.03, 9.07: eleven are 3.19's and 3.21's knowledge qualifiers and accuracy standards and 3.01's, 3.09's accuracy standards whose component trees did not compile (INVALID_FACT_COMPONENTS, 20 notes, mostly 3.19), one is 3.02's issued-and-outstanding count, and two are 8.03's and 9.07's boilerplate mechanics; each is held for review with its reason. 3.11's and 3.21's summaries naming "Company Disclosure Letter Section 3.11(a)" were dropped as section references: the summary rule read only the "Section x of the Company Disclosure Letter" form; the prefixed form is content from this commit, the stored rows keep their label-built terms.

## Article IV (Parent representations)

Finding (56). Correct, with IV-INTRO's joint-and-several qualification on the Parent table's General Exceptions row and Merger Sub's 1,000 shares on their capitalization row.

## Article V (Conduct of business; No solicitation)

Findings (57), (59), (61), (65). 5.01 as generation 7's: the general-terms table, the affirmative covenants, the restriction rows with their thresholds, exceptions and sub-items. 5.02 against Ben's comments: the notice table is 5.02(d)'s mechanics on its rows (Initial notice within 48 hours of an officer's or director's knowledge; Notice contents: identity, a copy of a written proposal; Ongoing updates: status and developments, draft documentation, 48 hours; Notice of a decision to engage, 48 hours; Oral proposals; No agreement restricting information to Parent, Yes); "Representative breach is Company breach" Yes under the control standard; the intervening table's Board determination standard row filled from 5.02(f) and coded from its words; the fiduciary and change-of-recommendation tables with the once-only reaffirmation as a sub-item; the subsequent match period 2 business days, re-read from its cited words ("the references to four (4) business days will be deemed two (2) business days") and marked as re-read; the six permissions (contact to clarify, telling a bidder the no-shop's terms, the required-by-law and factual-disclosure permissions, negotiation with a qualifying proposal, the takeover-statute carve-out) on their rows. The 6.03(a)(C) prohibition on approving a Company Takeover Proposal is the recommendation-change fact finalisation first refused (above).

## Article VI (Additional covenants)

Findings (59), (61). 6.03's efforts and remedy rows with their sub-items (54 facts; the ordinary-course communications carve-out a sub-item through its twin), 6.05's indemnification rows with the willful-breach definition as a Defined Terms entry, 6.04's benefit rows, 6.06's publicity sub-items, 6.10 and 6.11's proxy timetable, 6.12 to 6.14; 6.15 stays UNRESOLVED_UNUSUAL_PROVISION. Three 6.04 summaries and two 6.03 summaries were dropped for naming their own section ("Section 6.04 creates no employee rights"); that is the rule working, the extractor's wording is the fix.

## Article VII (Conditions)

Finding (59). The mutual table with the Stockholder Approval condition; 7.02's three bring-down tiers as sub-items; 7.03's two tiers; the certificates; the frustration rule per party.

## Article VIII (Termination)

Finding (59). 8.01's rights with the 30-day cures and the earlier-of rule, the outside date on one row; 8.02's fee, triggers, timing, exclusive remedy, interest and the 12-month tail; 8.05's formalities.

## Article IX (General)

Findings (61), (62), (63), (64), (65). 9.01, 9.02, 9.04 to 9.11 on their Miscellaneous, No Other Reps and D&O rows as generation 7's. 9.03, read against the text after its retry as seven paragraph parts (53 facts, none held):

- The Company MAE definition is two DEFINITION_PRONG facts on the Company row: limb (i), the material adverse effect on the business, assets, condition or results of operations of the Company and the Company Subsidiaries taken as a whole; limb (ii), preventing or materially impairing the Company's consummation of the Merger by the Outside Date. The Parent row's one limb (the ability to consummate) stays "One limb".
- The carve-outs on their fixed rows with the disproportionality answers the proviso gives ("except in the case of clause (A), (B), (C), (D), (E) or (I)"): Yes for industry (A), general economic (B), law or GAAP (C), war and terrorism (D), disasters (E) and pandemics (I); No for the failure to meet projections (F), the announcement or performance of the Transactions (G) with the actions the covenants require and the loss of relationships split out as their own rows, Parent-requested actions (H) and the Disclosure Letter matters (J). The (G) proviso that the announcement carve-out does not apply to representations addressing the consequences of the announcement is an "Other carve-out" row.
- The two carve-back provisos are the table's footer, as drafted: the disproportionality clause and the underlying-cause clause ("the underlying facts giving rise or contributing to such failure or change may be taken into account").
- The scheduled-matters carve-out ((J)) is on its "Matters scheduled in the Disclosure Letter" row with its summary.
- Knowledge on the reps qualifiers table (Actual knowledge; Officers). 33 OTHER_DEFINED_TERM facts in Defined Terms (Affiliate, business day, Contract, control, COVID-19 and COVID-19 Measures, the CVR terms, the Drug and Trade Control Laws, the Good Practice Requirements, Governmental Entity, Judgment, Law, Person, Personal Information, Processing, Security Breach, the Restricted lists, Standard Contracts, subsidiary, the ESPP and award terms). One defect, fixed in code: the Rights Agent summary carries one Han character inside the English ("Parent's选 alternative"), the model's slip; a summary with a letter from another script now drops with a note and the fact keeps its label-built term (the stored generation 8 row keeps the slip).

## Causes and fixes (all in code, applied to every agreement)

| Cause | Where seen | Fix |
| --- | --- | --- |
| A limbless long section sent as one extraction call | 9.03 (three attempts: a timeout, two outputs past the cap) | paragraph split for limbless long sections (`limblessSectionParts`, `extraction_part.mode: 'paragraphs'`); a second answer object fails the call at once as the output cap; the timeout path reports the output received |
| Finalisation demanded every legacy role of a VALID soft-legacy fact | 6.03(a)(C) recommendation-change fact | `validateAgreementDraft` accepts a missing required role against the section's recorded MISSING_REQUIRED_ROLE note |
| Summary cap at the asked-for 15 words | 1.03, III-INTRO, 8.01 | `HEADLINE_SUMMARY_MAX_WORDS = 18`, the extractor still asked for 15 |
| Three families with no table | 2.02's transfer-tax allocation | Tax Matters and Financing sections with rows from the subtype |
| Material-contract representation limbs with no row | 3.13(b), (c) | sub-items of the reps table's Material Contracts row |
| A second definition fact dropped by the Defined Terms dedup | 3.09 Tax, 3.11 Company Benefit Plan | merge into the entry |
| Period parser took the first number of a deemed clause | 5.02 subsequent match period (4 for 2) | the deemed number; the page re-reads a stored value from its cited words (`reparsed`) |
| Board determination standard rows with no code | 5.02(f) | codes from the words |
| Six no-shop facts with no row | 5.02 permissions | `fact_type_rows_when` rows |
| Definition facts listed again under the section | 5.02's 45 KEY_DEFINED_TERMS facts | Defined Terms placement is a placement |
| Sandbox session timeout under a six-hour generation | the worker died at about 06:10 UTC | the worker keeps its session alive (keepalive); the run route logs its configuration failure code |
| Summary rule read "Company Disclosure Letter Section 3.21" as a section reference | 3.11, 3.21 | the prefixed form is content |
| A letter from another script in a summary | 9.03 Rights Agent | dropped with a note |

## Open for the next read

- The stored generation 8 rows keep what was fixed after their hour: 1.03's, III-INTRO's, 3.11's, 3.21's and 8.01's label-built terms where the summary was dropped; the Rights Agent slip.
- Ben's UI comments stand for the page work: "see provision" scrolling the main body; the sidebar's "provision" and "clause" labels; the Summary and Period columns; the pills; "show detail" repeating the row; the (i) and (ii) indentation in the consideration tree. The substance comments on the no-shop (what information is shared, when, orally) are on the page from this generation's notice table.
- The 13 held facts (3.19's knowledge qualifiers above all) are the extractor's component trees, not a page rule: the INVALID_FACT_COMPONENTS reasons are stored with each.
- 51 family fact types stand UNRESOLVED at draft level (the coverage bookkeeping where a routed section answered NOT_FOUND for a fact type another section carries); the next read compares the list with generation 7's draft.
- Supabase's preview branch returned Cloudflare 520s twice while finalisation was writing (10:28 and 10:29 UTC); both reads succeeded on retry. Watched, not fixed.
- Next runs: NCS on the Anthropic API after a prompt-cache breakpoint (finding (46): $127.93 a generation uncached on Opus 5, about $97 cached); then Olaplex and Apogee.
