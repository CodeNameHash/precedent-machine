# Step 2G: Red Hat onboarding (International Business Machines Corporation / Red Hat, Inc.)

Deal key `redhat`. Agreement date 2018-10-28 (preamble: "AGREEMENT AND PLAN OF
MERGER by and among INTERNATIONAL BUSINESS MACHINES CORPORATION SOCRATES
ACQUISITION CORP. and RED HAT, INC. Dated as of October 28, 2018"). By seven
years the oldest agreement in the corpus -- every other pinned deal is 2020
or later.

Source: `tests/fixtures/canonical-v2/redhat-first-live-run/redhat-raw-fetched.htm`,
464,782 bytes, raw-bytes sha256
`ae199e572529baeda02530a3fd7e9df050c5d9e7dcdfec5d7dd1ac162753696e` (matches
the pin given in the task and `docs/codex-program/notes/four-deal-sources-2026-08-08.md`
exactly). This file was not present on disk in this worktree at task start
(only the provenance note was, in a sibling worktree); it was recovered from
commit `e0177a25` ("feat: fetch four verified merger agreements..."), which
exists in the repository's object graph on a branch not merged into this
worktree, via `git show e0177a25:<path>` -- not re-fetched from EDGAR, not
reconstructed by hand. The recovered bytes hash to the exact pin above.

Canonical-text sha256: `dcdbf66142d25cbe56ed2bc1fbd26939aaf86056bf34188176c48b5944d31c5e`
(264,358 canonical bytes). Derived through the runner's own
`loadAndVerifySource` path (`buildSecEdgarIntakeCapture` ->
`convertSecHtmlToCanonicalText` -> `verifySecHtmlCanonicalText`): a
placeholder was pinned first, `--dry-run` was run once, and the script's own
`CANONICAL_TEXT_HASH_MISMATCH` error reported the real value, which was then
pinned verbatim. Independently re-derived a second time with a standalone
script that calls the same four library functions directly, for the same
result. Never hand-computed or reimplemented.

## Sectionizer facts

307 tree nodes (1 ROOT, 8 ARTICLE, 45 SECTION, 253 SUBSECTION). Section
numbering is `Section 1.01`-style throughout (not `Section 1.1`), Article I
through Article VIII, no split like Modiv/TopBuild's separate "Company
Letter" schedule references beyond the ordinary disclosure-letter
cross-references common to all these agreements.

24 families are registered (`listRegisteredSectionFamilies()`); this deal
maps 21 of them, with 3 correct zeros.

## Family mapping table

| Family | Section ref(s) | Heading | Byte length | Proving quote |
|---|---|---|---|---|
| ANTITRUST_REGULATORY | 5.03 | "Reasonable Best Efforts; Consultation and Notice" | 17,445 | "filings under the HSR Act and other registrations... with, or notices to, Governmental Entities" / "obtain prompt expiration or termination of any applicable waiting period... by the DOJ or FTC" |
| APPRAISAL_DISSENTERS_RIGHTS | 2.01(d) | "Statutory Right of Appraisal" (unheaded SUBSECTION; heading is the printed lettered-item text) | 3,034 | "exercised its statutory rights of appraisal... in accordance with Section 262 of the DGCL... (the "Dissenting Shares")"; (ii) "the Company shall not make any payment with respect to, or offer to settle or settle... any such demands" (without Parent's prior written consent) |
| CAPITALISATION | 3.01(c) | "Capital Structure" | 8,758 | "The authorized capital stock of the Company consists of 300,000,000 shares of Company Common Stock and 5,000,000..." |
| CLOSING_CONDITIONS | 6.01, 6.02, 6.03, 6.04 | "Conditions to Each Party's Obligation to Effect the Merger" / "Conditions to Obligations of Parent and Sub" / "Conditions to Obligation of the Company" / "Frustration of Closing Conditions" | 2,010 / 2,573 / 1,438 / 500 | Article VI heading itself: "CONDITIONS PRECEDENT" |
| CONSIDERATION | 2.01, 2.02, 5.04 | "Conversion of Capital Stock" / "Exchange of Certificates" / "Equity Awards" | 5,698 / 8,455 / 13,087 | "Each share of Company Common Stock... shall be converted into the right to receive $190.00 in cash, without interest (the "Merger Consideration")" (2.01(c)) |
| DIVIDENDS | -- unmapped -- | -- | -- | See "Unmapped families" below: genuine zero. |
| DNO_INDEMNIFICATION | 5.05 | "Indemnification, Exculpation and Insurance" | 2,979 | "Parent shall obtain... a "tail" insurance policy with a claims period of six (6) years... with respect to directors' and officers' liability insurance" |
| EMPLOYEE_MATTERS | 5.11 | "Employee Matters" | 6,360 | "For the period beginning on the Closing and ending on the first anniversary of the Closing (the "Continuation Period"), Parent shall provide... base salaries or wages that are no less favorable..." |
| FINANCING_COVENANTS | -- unmapped -- | -- | -- | See "Unmapped families" below: genuine zero. |
| GENERAL_COVENANTS | 5.02, 5.07, 5.08, 5.09, 5.10 | "Access to Information; Confidentiality" / "Public Announcements" / "Sub Compliance" / "Stock Exchange Delisting; Deregistration" / "Convertible Notes; Call Options and Warrants" | 2,113 / 1,463 / 116 / 612 / 10,690 | 5.08 in full: "Parent shall cause Sub to comply with all of Sub's obligations under this Agreement." (COV-MERGESUB, named almost verbatim in the heading) |
| GUARANTY_FINANCING_PARTY | -- unmapped -- | -- | -- | See "Unmapped families" below: genuine zero. |
| INTERIM_OPERATING | 4.01 | "Conduct of Business" | 14,605 | "the Company shall not, and shall not permit any of its Subsidiaries to: (i) (A) declare, set aside or pay any dividends on... (B) split, combine or reclassify..." |
| KEY_DEFINED_TERMS | 8.03 | "Definitions" | 13,561 | Whole alphabetised definitions section, (a) through (p) |
| MAE_DEFINITION | 8.03(l) | (lettered defined-term item inside 8.03) | 4,566 | "(l) "Material Adverse Effect" means any state of facts, change, development, event, effect, condition, occurrence, action or omission... that... would reasonably be expected to (i) result in a material adverse effect on the business, assets, properties, financial condition or results of operations of the Company..." |
| MATERIAL_CONTRACTS | 3.01(h), 3.01(i) | "Contracts." (heading, 15 bytes) + mislabeled body (see sectionizer-artefact note) | 15 / 8,406 | "(i) Section 3.01(h) of the Company Letter sets forth as of the date of this Agreement a complete and correct list of: (A) any "material contract" (as defined in Item 601(b)(10) of Regulation S-K...)" |
| MERGER_STRUCTURE_CLOSING | 1.01-1.07 | "The Merger" / "Closing" / "Effective Time of the Merger" / "Effects of the Merger" / "Certificate of Incorporation and Bylaws" / "Directors" / "Officers" | 440/984/846/502/1,752/284/283 | "Sub shall be merged with and into the Company at the Effective Time... the Company shall continue as the surviving corporation (the "Surviving Corporation")" |
| MISC_BOILERPLATE | 8.01, 8.02, 8.04-8.10, 8.12 | "Nonsurvival of Reps and Warranties" / "Notices" / "Exhibits; Interpretation" / "Counterparts" / "Entire Agreement; No Third-Party Beneficiaries" / "Governing Law" / "Assignment" / "Consent to Jurisdiction..." / "Waiver of Jury Trial" / "Severability" | 361/1,959/3,275/772/1,298/727/904/2,496/732/507 | Article VIII miscellany, e.g. 8.07: governing-law clause |
| NO_OTHER_REPS_FRAUD | 3.01(v), 3.02(f), 8.03(p) | "No Other Representations and Warranties" (both sides) + Willful Breach definition | 2,834 / 2,628 / 431 | "(v) No Other Representations and Warranties. (i) Except for the representations and warranties expressly set forth in this Section 3.01... neither the Company nor any other person... makes any express or implied representation or warranty..."; 8.03(p): "(p) "Willful Breach" means... an act or omission... that the breaching party intentionally takes... and knows... would... cause a material breach..." |
| NO_SHOP | 4.02 | "No Solicitation" | 18,634 | "the Company shall not... solicit, initiate or knowingly encourage... any Takeover Proposal..." |
| PROXY_MEETING | 5.01 | "Preparation of the Proxy Statement; Shareholders Meeting" | 9,072 | Section heading itself; standard proxy/meeting mechanics follow |
| REPRESENTATIONS | 3.01, 3.02 | "Representations and Warranties of the Company" / "...of Parent and Sub" | 76,042 / 10,162 | Whole of Article III, both parties' rep articles |
| SPECIFIC_PERFORMANCE_REMEDIES | 8.11 | "Enforcement" | 2,266 | "the parties hereto shall be entitled to an injunction or injunctions to prevent breaches of this Agreement and to enforce specifically the terms and provisions of this Agreement" |
| TAX_MATTERS | 3.01(m) | "Taxes" | 5,145 | "(m) Taxes. Except as would not reasonably be expected to have, individually or in the aggregate, a Material Adverse Effect..." |
| TERMINATION | 7.01, 7.02 | "Termination" / "Effect of Termination" | 6,882 / 887 | "This Agreement may be terminated, and the Merger contemplated hereby may be abandoned, at any time prior to the Effective Time... (a) by mutual written consent... (b) by either Parent or the Company, if..." |
| TERMINATION_FEE | 5.06, 7.01 | "Fees and Expenses" + "Termination" (grounds, bare-cited from 5.06) | 4,651 / 6,882 | "the Company shall pay (or cause to be paid) to Parent a fee equal to $975,000,000 (the "Termination Fee")" (5.06(b)) |

## Unmapped families -- both genuine zeros, not mapping failures

- **DIVIDENDS** -- the family (`dividends-producer-prompt.js`) extracts
  *coordination* covenants (e.g. record-date coordination between target and
  acquirer to avoid a double-dividend) and one-time pre-closing special
  dividends. Searched the full canonical text for `dividend`/`Dividend`: all
  4 occurrences are (a) an anti-dilution adjustment mechanic in 2.02(i)
  ("any stock dividend... the Merger Consideration... will be appropriately
  adjusted"), (b) an incidental mention inside the Capital Structure rep
  describing debt instruments whose value derives from dividends, and (c)/(d)
  the ordinary interim-operating restriction on paying dividends during the
  pendency of the deal, inside 4.01(a)(i)(A) (owned by INTERIM_OPERATING's
  IOC restriction_category=DIVIDEND, a different concept). No coordination
  mechanism and no special dividend anywhere in the agreement. **The 2018
  draft does not contain this provision** -- an all-cash deal with no
  special-dividend or dividend-coordination mechanic is unremarkable.
- **FINANCING_COVENANTS** -- searched for `Financing`: every occurrence
  (6 total) is either the pre-Article-I defined-terms cross-reference table
  entry ("Financing Sources | 8.11") or boilerplate protecting "Financing
  Sources" as third-party beneficiaries in 7.03/7.04/8.06/8.11 (lender
  litigation-forum and amendment-consent protections). There is no
  `OBTAIN_EFFORTS`/`COOPERATION_GRANT`/marketing-period covenant anywhere:
  no section obligates any party to use efforts to obtain acquisition
  financing. Consistent with public reporting that IBM funded the Red Hat
  acquisition from its own balance sheet plus a bridge facility it had
  already arranged, without a financing condition in the merger agreement.
  **The 2018 draft does not contain this provision** -- correct zero.
- **GUARANTY_FINANCING_PARTY** -- searched for `Guarant` (any casing, any
  form -- `guarantee`, `guaranty`, `guarantor`): zero occurrences anywhere in
  264,358 bytes of canonical text. There is no guarantor and no performance
  guaranty in this agreement (IBM, the acquirer, is itself the direct
  contracting Parent, not a shell backed by a separate guarantor). **The
  2018 draft does not contain this provision** -- correct zero.

## Sectionizer artefacts on this filing (mapping corrections, not zeros)

- **MATERIAL_CONTRACTS nested-lettering collision.** The agreement's own
  Section 3.01(h) ("Contracts.") opens with a single roman-numeral
  sub-paragraph "(i)" that itself contains lettered criteria (A) through
  (M). The deterministic sectionizer's letter-depth heuristic reads that
  "(i)" as 3.01's *next top-level letter sibling* (i.e. as if it were
  "3.01(i)", following "3.01(h)") rather than as 3.01(h)'s own child. As a
  result, what the agreement prints as "Section 3.01(h)(i)" through
  "3.01(h)(i)(M)" resolves in this tree under the references "3.01(i)"
  through "3.01(i)(M)" -- confirmed directly: after "3.01(i)(M)" the very
  next top-level letter node is "3.01(j) Environmental Matters", with no
  intervening real "(i)" topic, so the entire "3.01(i)" subtree IS the
  Contracts list, not a separate rep. This is the same shape as the
  Modiv "(z)"/"(aa)" collision documented in this file's own header
  ("WHY 8.12 AS ONE WHOLE SECTION..."). Worked around the same way: both
  "3.01(h)" (the heading) and "3.01(i)" (the mislabeled body) are pinned,
  rather than guessing a "3.01(h)(i)" reference string the sectionizer does
  not produce.
- **TERMINATION_FEE bare cross-citation.** Section 5.06(b) states four of
  its five fee triggers as bare cross-references into Section 7.01 (e.g.
  "this Agreement is terminated... pursuant to Section 7.01(c)") with no
  operative description of the ground at 5.06 itself -- the same shape that
  produced Modiv's original TRIGGER_UNCORROBORATED run. Section 7.01 is
  pinned alongside 5.06. Unlike Modiv, no third section is needed for the
  fee amount: "$975,000,000 (the "Termination Fee")" is stated directly and
  completely inside 5.06(b).

## GENERAL_COVENANTS -- partial coverage, stated explicitly

This family is a residual router over many follow-on covenant codes
(`GENERAL_COVENANT_FOLLOW_ON_OWNERS` in `lib/canonical-v2/p0-product-surface-routing.js`:
Section 16(b), access-to-information, consent-delivery, CVR, existing-debt,
listing/delisting, FDA communications, further-assurances, general
indemnification, litigation-notify, merger-sub, notification, payment-agent,
publicity, director-resignation, SEC-reporting, takeover-law). Five sections
were confidently matched by heading to five of those codes (5.02 Access to
Information -> COV-ACCESS, 5.07 Public Announcements -> COV-PUBLICITY, 5.08
Sub Compliance -> COV-MERGESUB, 5.09 Stock Exchange Delisting ->
COV-DELIST/COV-LIST, 5.10 Convertible Notes -> COV-DEBT). Section 5.12
("Restructuring") was read in full and left out deliberately: its content is
a pre-closing tax-restructuring indemnity that did not confidently match any
one follow-on code, and forcing it into scope risked a wrong pin rather than
an honest omission. This is a partial mapping of a family whose full scope
is legitimately broader than any one deal's headings will exhaustively prove
-- stated here rather than left implicit.

## Verification run

`node scripts/canonical-v2-live-extraction-run.mjs --deal redhat --family <F> --dry-run`
was run for all 21 mapped families. All 21 exited 0, resolved every pinned
section reference against the tree, and printed both:

    reused committed raw HTML at .../redhat-raw-fetched.htm, sha256=ae199e57...696e (MATCHES pin)
    canonical_text_sha256 = dcdbf661...31c5e (MATCHES pin)

Every resolved section's reported `heading` matched the heading expected
from reading the body text (e.g. CLOSING_CONDITIONS: 6.01 "Conditions to
Each Party's Obligation to Effect the Merger", 6.02 "Conditions to
Obligations of Parent and Sub", 6.03 "Conditions to Obligation of the
Company", 6.04 "Frustration of Closing Conditions"; MISC_BOILERPLATE: all
ten of 8.01/8.02/8.04-8.10/8.12 resolved with their correct headings; no
family had a `SECTION_REFERENCE_UNRESOLVED`, `SECTION_KIND_MISMATCH`, or
`SECTION_HEADING_MISMATCH` failure).

Gates:
- `CI=true node --test tests/canonical-v2-general-extraction-runner.test.js`
  -- 32/32 pass, exit 0.
- `bash scripts/lint/forbidden-patterns.sh` -- `INVARIANT-4: PASS`, exit 0.
