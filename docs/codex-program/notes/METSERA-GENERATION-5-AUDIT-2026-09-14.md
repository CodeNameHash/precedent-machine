# Metsera generation 5: what was extracted, section by section, 2026-09-14

Ben, 2026-09-14: "look at all of the output yourself and analyze if you think it is right or wrong and if not, interate to improve it"; "What terrifies me atm is that you actually don't know what the fuck you have extracted".

This note is the reading of run `42a597b2-0f9e-4405-8ac5-e0535a51dc1a` (submitted as generation 4, stored as source generation 5; the worker at codex head 2d0cd85, so it carries decision 34 and the Q6 long-section split but none of the code fixes made while it ran). Sections were read as they completed, against the agreement text, from the per-fact dump (components, headline, readout) and the run's issues and model calls. Every defect found is fixed in code for generation 6 and recorded in the plan's Q8 entry as findings (1) to (13). Sections not yet read are marked.

## Verdict so far

The layered model does what it was built to do where the model's citations hold: each representation limb is one fact whose tree runs from the inherited qualifiers (article introduction, chapeau) through the subject to the operative words; the readout puts it on the old app's row with a row_detail naming the limb and codes the qualifier and look-back. The Material Contract definition comes out one category per clause on the fixed rows. The losses are systematic and mechanical, not legal: quotes cited on the wrong span or with an occurrence index past the end (whole sections INVALID), readouts dropped on punctuation between components or on as-drafted paraphrase, two facts on one sentence held as a duplicate, and representations the router called immaterial because the catalogue lists no representation fact type. Each has a code fix.

## Article I (Merger; Closing; Effective Time; Charter; Directors)

Right: 1.01 the merger form with the three basis components (merging party, "with and into", survivor); 1.02 closing time and place with every alternative; 1.03 effective time; 1.05 charter and by-laws. Wrong: 1.04 INVALID on an unresolved cross-reference to "Section 259 of the DGCL" (finding 2, statutory references exempt); 1.06 directors and officers INVALID on an occurrence index past the last occurrence (finding 1); the 1.02 closing timing readout dropped on a paraphrased as-drafted cell (finding 3).

## Article II (Consideration; Payment; Equity Awards)

Right: 2.01 $47.50 cash plus one CVR, cancelled and treasury shares, the appraisal shares; 2.03 each award class. Wrong: 2.02 (8.9k bytes, seven limbs) one 13-minute call and one fact (finding 4, the split threshold is 8k); 2.03 awards labelled EMPLOYEE_MATTERS with invented rows and seven as-drafted readouts dropped (findings 5 and 3); Merger Sub's share conversion coded as a per-share row (finding 6); the appraisal line's source invalid (finding 7).

## Article III (Company representations)

Right, limb by limb, with row_detail naming each limb and the qualifier coded: 3.01 organization and standing; 3.02 capitalisation as limbs (authorized, outstanding, reserved, awards, absence); 3.06 SEC documents and controls; 3.07 financial statements; 3.09 to 3.12 (benefit plans, labour, taxes, real property and title); 3.13 the Material Contract definition, one category per clause on the fixed rows, and the no-default representation; 3.14 litigation; 3.15 product liability; 3.16 permits and compliance; 3.17 healthcare regulatory (26 limbs); 3.18 environmental (12); 3.20 data privacy (9); 3.25 anti-corruption; 3.26 trade controls.

Wrong or missing: 3.04 (authority, board approval, takeover statutes), 3.22 (brokers) and 3.23 (fairness opinions) routed IMMATERIAL because the router reads the catalogue's allowed fact types and REPRESENTATIONS lists only the knowledge qualifier and the accuracy standard; 3.08 (absence of changes) routed to INTERIM_OPERATING alone (finding 12: routing widened by the article heading and the residual pass). 3.05 consents limb became an ANTITRUST_REGULATORY filing with an invented code (finding 9). Thirteen of 3.13's twenty-seven categories lost their readout on the punctuation between the category and its nested exception (finding 10); the two limbs of the no-default representation and of the valid-and-binding representation held as duplicates (finding 11). 3.21 (insurance) all five facts INVALID on occurrence indices past the end (finding 1). 3.24 one fact with LIST_ELEMENTs outside a LIST and 3.16 one component with no byte range (model-side, left). 3.06 two look-back values invented by the model (dropped, correctly).

## Article IV (Parent representations)

Right: 4.01 organization; 4.02 Merger Sub's capital as limbs; 4.04 no conflicts with each consent exception as its own limb; 4.05 information supplied; 4.07 litigation. Missing: IV-INTRO, 4.03 (authority), 4.06 (brokers), 4.08 (Section 203), 4.09 (funds), all IMMATERIAL routings of a representation (finding 12).

## Article V (Conduct of business; No solicitation)

Not yet read (5.01 extracted in parts under the Q6 split; 5.02 running).

## Article VI (Additional covenants)

6.01: Parent's adoption as sole stockholder came back twice, as a Merger Sub obligation and as an empty transaction step (finding 13). 6.02: access, the privilege and trade-secret carve-out, the alternative-arrangements effort, reimbursement, confidentiality; five as-drafted readouts dropped (finding 3); the joint-defence proviso labelled ANTITRUST_REGULATORY (the overlay now keeps that family to the regulatory covenant, finding 9). 6.04: every benefit element on its own row (base salary, target bonus, LTI, severance, other benefits) with the comparison group, the standard and the one-year period coded; service credit, the duplication carve-out, no plan amendment, no right to continued employment; the no-third-party-beneficiary sentences came back as MISC_BOILERPLATE (the overlay now keeps the employee covenant's disclaimers on the other-protections rows). 6.05: the six-year continuation, the survival of charter and contract rights, the tail policy with the premium cap coded, the substitute-policy right, advancement, successor assumption on each of the three triggers, third-party enforcement; one fact INVALID on an occurrence index (finding 1); eleven as-drafted readouts dropped (finding 3). 6.03 (regulatory efforts) not yet read.

## Articles VII to IX

Not yet read.

## Causes and fixes (all in code, applied to every agreement)

| Cause | Where seen | Fix |
| --- | --- | --- |
| Quote cited on a sibling span or with an occurrence index past the end | 1.06, 2.01, 3.21, 4.05 | `resolveEvidenceQuote` relocates the quote across the section and clamps the occurrence, recording both on the evidence context |
| Statutory cross-reference must resolve | 1.04 | `isExternalReference` exempts DGCL, U.S.C., Code, Act, Rule and Regulation references |
| As-drafted cell paraphrased | 1.02, 2.03, 6.02 | A `display: fact_text` column needs only its citation (rule C4) |
| Long section in one call | 2.02 | Split threshold 8k bytes |
| Award treatment as EMPLOYEE_MATTERS; Merger Sub shares as a per-share row; consents limb as an antitrust filing; Tax definitions forced into Acquisition Proposal | 2.03, 2.01, 3.05, 3.09 | Overlay rules per family; OTHER_DEFINED_TERM subtype |
| Appraisal line from an invalid source | 2.01 | Derived cell takes APPRAISAL_LINK else the appraisal family, never an invalid fact |
| Readout dropped on punctuation between cited components | 3.13 | Verbatim cells compared word by word over the cited components in source order |
| Two facts on one sentence held as duplicates | 3.13, 3.03, 3.06, 3.09, 3.16, 3.18, 3.26, 6.02 | A collision whose candidates have distinct component footprints is re-keyed and stays valid |
| Representation routed IMMATERIAL or to a covenant family alone | 3.04, 3.08, 3.22, 3.23, IV-INTRO, 4.03, 4.06, 4.08, 4.09 | Routing widened by the article heading and the residual pass, never narrowed |
| One sentence under two families | 6.01 | Overlay: a covenant in the additional agreements article is never a transaction step |
| Section lost on one failed lease renewal | 5.01 | The heartbeat retries a transient renewal failure while the lease has time; a stale renewal still loses the section at once |
