# Step 2G, Metsera onboarding

Working note, 2026-08-08. Onboarding only — the 24/25-family extraction
ladder was explicitly NOT run against this pin. Every dry-run below made
zero model calls.

Deal: **Pfizer Inc. / Metsera, Inc.** — a biopharma acquisition, $47.50/share
cash plus one contractual contingent value right (CVR) per share, agreement
dated **2025-09-21**. Pfizer self-funds (Section 4.09 "Available Funds");
there is no Debt Commitment Letter, no guarantor, and no financing-source
non-recourse clause anywhere in the filing. Stockholder approval is by a real
Company Stockholders Meeting (not written consent).

## 0. A worktree gap, and how it was closed

The brief for this task stated the raw HTML was already committed at
`tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm`
and that `docs/codex-program/notes/step-2g-skechers-onboarding.md` and a
`skechers` `DEAL_PINS` entry already existed in this worktree, as a worked
example to copy. Neither was true in this worktree: this worktree's branch
point (`8d2d9928`) predates the commit that fetched the four new deals'
source HTML (`e0177a25`, on `claude/codex-handoff-plan-status-77wn7n`, which
also carries the Skechers onboarding this worktree was told to expect but
does not have). Rather than re-fetch from EDGAR or guess, the exact fixture
bytes and the provenance note were read out of that already-existing commit
with `git show e0177a25:<path>` and written into this worktree unchanged —
never a new download, never a re-derivation. The raw file's sha256
(`d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`, 583,764
bytes) matches the brief's own pin exactly, confirming the bytes are
identical to what the brief described. The Skechers note and DEAL_PINS entry
were read the same way (`git show`), into a scratch directory only, purely
as a worked-example reference — never merged into this worktree's tracked
files, since this task's scope is the `metsera` entry only.

## 1. Digests

Both independently re-derived from the committed raw HTML via **this
runner's own `loadAndVerifySource()` code path** —
`buildSecEdgarIntakeCapture` → `convertSecHtmlToCanonicalText` →
`verifySecHtmlCanonicalText` — not a separate or reimplemented conversion.

| | value |
|---|---|
| `raw_bytes_sha256` | `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac` |
| `canonical_text_sha256` | `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3` |
| `canonical_text_byte_length` | 348,692 |
| verification | `PASS` |

Method used, exactly as instructed: added `DEAL_PINS.metsera` with a
placeholder `canonical_text_sha256`, ran one real `--dry-run`
(`--family KEY_DEFINED_TERMS --section-refs 1.1`, an arbitrary section
reference — the point was only to reach `loadAndVerifySource()`), read the
real value out of the script's own refusal:

```
[extraction:metsera:KEY_DEFINED_TERMS] reused committed raw HTML at .../metsera-raw-fetched.htm, sha256=d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac (MATCHES pin)
[extraction-run] FAILED: Error: CANONICAL_TEXT_HASH_MISMATCH: canonical text sha256 mismatch for deal "metsera": expected PLACEHOLDER_PENDING_DRY_RUN, got 4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3
```

then pinned that reported value and re-ran to confirm both hashes now read
`(MATCHES pin)`:

```
[extraction:metsera:ANTITRUST_REGULATORY] reused committed raw HTML at .../metsera-raw-fetched.htm, sha256=d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac (MATCHES pin)
[extraction:metsera:MATERIAL_CONTRACTS] canonical_text_sha256 = 4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3 (MATCHES pin)
```

(the two lines above are drawn from two different dry-runs in the 23-family
sweep in §5, both against the identical pin — the family tag in brackets
identifies which run emitted which line). Independently cross-checked a
second way: a standalone scratch script (not this runner, but calling the
exact same four library functions in the exact same order) reproduced
`4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3` and
`verification_status: PASS` outside the CLI entirely. Both derivations agree;
the pinned value comes from the runner's own code path, not the scratch
script.

## 2. Agreement date

**2025-09-21.** Given in the task brief and independently confirmed twice
against this filing's own text: the preamble ("AGREEMENT AND PLAN OF MERGER
dated as of September 21, 2025 among PFIZER INC., MAYFAIR MERGER SUB, INC.
and METSERA, INC.") and, separately, Section 9.04 ("Interpretation")'s own
construction clause: `The phrase "date hereof" or "date of this Agreement"
shall be deemed to refer to September 21, 2025.`

## 3. Method

1. Read this script's header, `DEAL_PINS`, and `resolveRunConfig` in full
   (module at `scripts/canonical-v2-live-extraction-run.mjs`), plus the
   Skechers onboarding note (read via `git show`, see §0) for the prior
   deal's method.
2. Got the registered family list from `listRegisteredSectionFamilies()`
   directly (25 families), never a hand-copied list — confirmed by running
   it: `ANTITRUST_REGULATORY, APPRAISAL_DISSENTERS_RIGHTS, CAPITALISATION,
   CLOSING_CONDITIONS, CONSIDERATION, DIVIDENDS, DNO_INDEMNIFICATION,
   EMPLOYEE_MATTERS, FINANCING_COVENANTS, GENERAL_COVENANTS,
   GUARANTY_FINANCING_PARTY, INTERIM_OPERATING, KEY_DEFINED_TERMS,
   MAE_DEFINITION, MATERIAL_CONTRACTS, MERGER_STRUCTURE_CLOSING,
   MISC_BOILERPLATE, NO_OTHER_REPS_FRAUD, NO_SHOP, PROXY_MEETING,
   REPRESENTATIONS, SPECIFIC_PERFORMANCE_REMEDIES, TAX_MATTERS, TERMINATION,
   TERMINATION_FEE`.
3. Drove `sectionizeAdmittedSource()` directly (not the CLI) against the
   converted canonical text, and dumped every node with its reference,
   heading, kind, and byte span to a scratch file — **282 tree nodes total**
   (`ROOT: 1, ARTICLE: 9, SECTION: 83, SUBSECTION: 189`). This filing's
   Article III (26 sections, `3.01`–`3.26`) and Article IV (9 sections,
   `4.01`–`4.09`) are both fully granular, one topic per numbered section.
   Article IX ("General Provisions") runs from byte 238,374 to the document
   end (348,692) but its own last numbered section (`9.11`) ends at
   270,449 — the remaining ~78KB is signature pages plus Exhibit A
   (Certificate of Incorporation) and Exhibit B (a full Form of CVR
   Agreement), read and confirmed to be exhibit content outside any
   `Article`/`Section` node, never assigned to any family.
4. For every family, read the actual section body text (not just the
   heading) via `utf8Slice` (byte-offset correct, matching `sectionBodyText`
   in the runner) and checked candidate sections against that family's own
   producer prompt where relevant. This caught real, deal-specific
   numbering that would have been wrong if copied from another deal — see
   the per-family notes below, especially the termination-fee section
   (`8.02`, not `8.03` — the section literally titled "Fees and Expenses" is
   pure boilerplate; the fee amount and triggers live in "Effect of
   Termination") and the three "first comparable definitions" that turned
   out to live outside the Definitions section.
5. Confirmed all 23 mapped families with `--dry-run` (real CLI, real
   `resolveRunConfig`, real sectionizer) after pinning — see §5.

## 4. The mapping, 23 of 25 families

Every row below was read against the actual body text of this filing.
"Verified against" quotes the phrase that proves the section is this
family's content.

### ANTITRUST_REGULATORY — `6.03` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.03 | Reasonable Best Efforts; Notification | 14,132 | "(b) ... file, within thirty (30) business days after the date of this Agreement, with the United States Federal Trade Commission (the "FTC") and the U.S. Department of Justice (the "DOJ") the Notification and Report form, if required under the HSR Act" |

Unlike Skechers (which split general efforts `6.1` from antitrust-specific
`6.2`), this filing merges both into one section — `6.03`'s own opening
sentence is the general reasonable-best-efforts covenant, and subsections
(b)–(g) are HSR/foreign-merger-control-specific. Also pinned under
`GENERAL_COVENANTS` below (same section, different extracted fact shape —
the same deliberate-overlap pattern already established for
`CONSIDERATION`/`APPRAISAL_DISSENTERS_RIGHTS` sharing `2.01`).

### APPRAISAL_DISSENTERS_RIGHTS — `2.01` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.01 | Effect on Capital Stock | 4,147 | Sub-clause (d): "shares of Company Common Stock ... held by any Person who is entitled to demand and properly demands appraisal ... pursuant to ... Section 262 of the DGCL ... shall not be converted into the Merger Consideration ... The Company shall serve prompt notice to Parent of any demands ... and any withdrawals of such demands ... shall not, without the prior written consent of Parent, make any payment with respect to, or settle or offer to settle" |

Same section as `CONSIDERATION` — appraisal is a sub-clause of the
merger-consideration section, matching the pattern already established on
Modiv, TopBuild and Skechers. Necessary-implication test satisfied: cites
DGCL Section 262 by name.

### CAPITALISATION — `3.02`, `4.02` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.02 | Capital Structure | 7,277 | "The authorized capital stock of the Company consists of 800,000,000 shares of Company Common Stock and 10,000,000 shares of preferred stock ... At the close of business on September 18, 2025 ... 105,278,627 shares of Company Common Stock were issued and outstanding" |
| 4.02 | Merger Sub | 623 | "(b) The authorized capital stock of Merger Sub consists of 1,000 shares of common stock, par value $0.01 per share, all of which have been validly issued, are fully paid and nonassessable and are owned by Parent" |

### CLOSING_CONDITIONS — `7.01`, `7.02`, `7.03`, `7.04` (4 sections, 4 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 7.01 | Conditions to Each Party's Obligation | 1,000 | "(a) Antitrust Clearance ... (b) No Legal Restraints ... (c) Stockholder Approval. The Company Stockholder Approval shall been duly obtained" |
| 7.02 | Additional Conditions to the Obligations of Parent and Merger Sub | 2,737 | bring-down/MAE conditions for Parent's benefit |
| 7.03 | Additional Conditions to the Obligations of the Company | 1,914 | mirror-image conditions for the Company's benefit |
| 7.04 | Frustration of Closing Conditions | 539 | standard frustration/prevention-of-own-condition clause |

Exact 1:1 match — Article VII is exactly these four sections. This is a
four-section closing-conditions article (unlike Skechers' three), which
lines up with `docs/core/OPERATING-RULES.md`'s own ruling "Closing
Conditions core taxonomy: adopt four."

### CONSIDERATION — `2.01`, `2.02`, `2.03` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.01 | Effect on Capital Stock | 4,147 | "(c) ... each issued and outstanding share of Company Common Stock shall be converted into the right to receive (i) $47.50 in cash, without interest (the "Closing Amount"), plus (ii) one (1) contractual contingent value right per share ... (a "CVR") ... (collectively, the "Merger Consideration")" |
| 2.02 | Payment of Merger Consideration | 8,920 | "Parent shall deposit or cause to be deposited with the Paying Agent ... cash necessary to pay the aggregate Closing Amount" |
| 2.03 | Treatment of Company Equity Awards | 7,418 | "each Company Stock Option ... shall be canceled at the Effective Time and the holder thereof shall then become entitled to receive ... (A) a cash payment ... and (B) one (1) CVR" |

CVR presence is tracked here per `docs/core/OPERATING-RULES.md`'s ruling
("CVR: presence only; build the CVR agreement later") — no separate CVR
family exists in the 25-family registry, and the ~78KB CVR Agreement text
appended as Exhibit B (see §3.3) is correctly outside every section node and
was not assigned anywhere.

### DIVIDENDS — `5.01` (1 section, 1 call; likely low/zero governed yield, by design)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.01 | Conduct of Business of the Company | 13,408 | Sub-clause (a)(i): "declare, set aside, authorize, establish a record date in respect of, accrue or pay any dividends on, or make any other distributions ... in respect of, any of its capital stock, other than dividends and distributions by a direct or indirect wholly owned Company Subsidiary to its parent" |

No standalone dividends-coordination section exists on this filing. The
restriction is one limb of `5.01`'s single combined affirmative/forbearance
covenant (this filing does not split affirmative and forbearance covenants
into separate sections the way Skechers did at `5.1`/`5.2`). Same shape as
Skechers/TopBuild — expected to publish few or zero `dividend_assertions`,
not a mapping defect.

### DNO_INDEMNIFICATION — `6.05` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.05 | Indemnification | 8,749 | "All rights to indemnification and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time ... shall be assumed by the Surviving Corporation ... and shall continue in full force and effect ... for the period beginning as of the Effective Time and ending six (6) years from the Effective Time" — plus (c)'s "tail" D&O insurance provisions |

### EMPLOYEE_MATTERS — `6.04` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.04 | Employee Matters | 4,966 | "(a) For a period of one year following the Effective Time, Parent shall provide or cause the Surviving Corporation to provide to each ... "Continuing Company Employee" ... (i) annual base salary or base wage that is no less favorable ... (iv) severance benefits that are no less favorable" |

`3.10` (Labor Relations) and `3.11` (Employee Benefits) are reps, not
continuation covenants — read and left out of this family, same reasoning
Skechers applied to its `3.18`/`3.19`.

### FINANCING_COVENANTS — UNMAPPED (correct zero)

Searched for "debt financing", "commitment letter", "financing sources": zero
hits anywhere in the filing. Pfizer self-funds — Section 4.09 ("Available
Funds") is the entire financing-assurance provision, and it is a
representation, not a covenant to arrange financing. There is no Debt
Commitment Letter, no marketing period, no financing-cooperation covenant to
extract. This is a correct, deliberate zero (per `CLAUDE.md`: "A family
returning zero can be correct"), not an omission from insufficient reading.

### GENERAL_COVENANTS — `6.02`,`6.03`,`6.06`,`6.07`,`6.08`,`6.09`,`6.12`,`6.13`,`6.14`,`6.15` (10 sections, 10 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.02 | Access to Information; Confidentiality | 2,680 | "the Company shall ... afford to Parent and to Parent's Representatives reasonable access ... to all their respective properties, books and records and Contracts" |
| 6.03 | Reasonable Best Efforts; Notification | 14,132 | subsections (f)/(g): general prompt-notice-of-breach and Parent-acquisition-restriction covenants, distinct from the antitrust-specific content also pinned above |
| 6.06 | Public Announcements | 1,427 | "Parent and Merger Sub ... and the Company ... shall consult with each other before issuing ... any press release" |
| 6.07 | Stockholder Litigation | 971 | "the Company shall promptly advise Parent of any Proceeding commenced ... by or on behalf of one or more stockholders" |
| 6.08 | Rule 16b-3 Matters | 489 | "The Company shall take all action ... to cause any dispositions ... by each individual who is a director or officer ... to be exempt under Rule 16b-3" |
| 6.09 | Merger Sub and Surviving Corporation Compliance | 209 | "Parent shall cause Merger Sub or the Surviving Corporation ... to comply with all of its respective obligations" |
| 6.12 | Nasdaq; Post-Closing SEC Reports | 1,714 | "the Company will cooperate with Parent ... to delist the Company Common Stock from the Nasdaq Stock Exchange" |
| 6.13 | Director Resignations | 365 | "the Company will use its reasonable best efforts to cause each director ... to execute and deliver a letter effectuating such director's resignation" |
| 6.14 | CVR Agreement | 781 | "Parent shall authorize and duly adopt, execute and deliver ... the CVR Agreement" |
| 6.15 | Specified Matters | 126 | "The Parties agree to the matters set forth on Section 6.15 of the Company Disclosure Letter" |

Residual-covenant catch-all, same role documented on Skechers/TopBuild.

### GUARANTY_FINANCING_PARTY — UNMAPPED (correct zero)

Searched for "guarant", "no recourse", "non-recourse", "related parties":
zero hits anywhere in the filing except in unrelated contexts (product
liability "breach of any guarantee, warranty" at `3.15`; ordinary-course debt
covenant limits at `5.01`). No sponsor guaranty, no financing-source
non-recourse clause. Consistent with `FINANCING_COVENANTS` above — an
unfinanced, strategic-acquirer deal has no guarantor to protect.

### INTERIM_OPERATING — `5.01` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.01 | Conduct of Business of the Company | 13,408 | "from the date of this Agreement to the Effective Time, the Company shall, and shall cause each Company Subsidiary to, conduct its business in the ordinary course" — followed by the (a)–(r) forbearance limbs |

Same section as `DIVIDENDS` (above) — one combined affirmative/forbearance
covenant section on this filing, matching the deliberate-overlap pattern.

### KEY_DEFINED_TERMS — `9.03`, `5.02`, `8.02` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.03 | Definitions | 17,579 | "'Company Material Adverse Effect' means" (byte 241,390); "'Parent Material Adverse Effect' means" (byte 253,270); "'knowledge' of any Person means, with respect to any matter in question, the actual knowledge of such Person's executive officers" |
| 5.02 | No Solicitation | 20,420 | "'Company Takeover Proposal' means" (byte 175,767); "'Superior Company Proposal' means" (byte 178,242); "'Intervening Event' means" (byte 177,322); "(any action described in this clause (i) being referred to herein as an 'Adverse Recommendation Change')" |
| 8.02 | Effect of Termination | 4,610 | "For purposes of this agreement, a 'willful and material breach' means a material breach of, or a material failure to perform, any representation, warranty or covenant set forth in this Agreement ... that is the consequence of an intentional act or intentional omission by a party with the actual knowledge that the taking of such act ... would result in such material breach" |

This is the one family where copying section numbers across deals would
have been badly wrong, and reading the actual definitions (not their
section headings) mattered most. Unlike Skechers/TopBuild, where the
"first comparable definitions" (Acquisition Proposal, Superior Proposal,
Intervening Event, Knowledge, Willful Breach — see
`docs/core/OPERATING-RULES.md`'s own ruling naming exactly these five) sit
together in one general Definitions article, on this filing three of the
five (the Company-Takeover-Proposal/Superior-Company-Proposal/
Intervening-Event trio) are defined **inline inside the No-Solicitation
section**, and a fourth (Willful Breach, here "willful and material
breach") is defined **inline inside Effect of Termination**, not in
Definitions at all. Only "knowledge" and the two MAE definitions actually
live in `9.03`. Mapping `KEY_DEFINED_TERMS` to `9.03` alone — the naive,
heading-driven guess — would have silently produced false zeros for four of
the five named concepts, not because the concepts are absent (they are
genuinely present and fully defined) but because they live somewhere else on
this filing. All three sections are also pinned to other families
(`5.02`→`NO_SHOP`, `8.02`→`TERMINATION`/`TERMINATION_FEE`) — same
deliberate-overlap pattern, extracting a different fact shape each time.

### MAE_DEFINITION — `9.03` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.03 | Definitions | 17,579 | "'Company Material Adverse Effect' means any change, event, condition, development, circumstance, effect or occurrence that, individually or in the aggregate, (i) has had, or would reasonably be expected to have, a material adverse effect on the business, assets, condition (financial or otherwise) or results of operations of the Company and the Company Subsidiaries, taken as a whole ... provided, however, that ... no change ... resulting from any of the following shall be taken into account" |

Unlike Skechers (Parent is a private acquisition vehicle with no MAE
qualifier of its own), **this filing defines both sides**: "Company Material
Adverse Effect" and "Parent Material Adverse Effect" are both present and
separately defined (Pfizer, as a public reporting company, gives its own
MAE-qualified reps in Article IV). Both definitions verified by byte offset
to fall inside this same `9.03` node (241,390 and 253,270, both within
[240,292, 257,871)).

### MATERIAL_CONTRACTS — `3.13` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.13 | Contracts | 9,491 | "Section 3.13(a) of the Company Disclosure Letter sets forth a true and complete list ... of: (i) each Contract that would be required to be filed by the Company as a 'material contract' pursuant to Item 601(b)(10) of Regulation S-K" |

### MERGER_STRUCTURE_CLOSING — `1.01`–`1.06` (6 sections, 6 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.01 | The Merger | 458 | "Merger Sub shall be merged with and into the Company at the Effective Time ... the Company shall continue as the surviving corporation" |
| 1.02 | Closing | 973 | "the closing (the 'Closing') of the Merger shall take place at the offices of Wachtell, Lipton, Rosen & Katz ... on the third (3rd) business day after" |
| 1.03 | Effective Time | 766 | "the Company shall file with the Secretary of State of the State of Delaware, a certificate of merger" |
| 1.04 | Effects of Merger | 105 | "The Merger shall have the effects set forth in Section 259 of the DGCL" |
| 1.05 | Certificate of Incorporation and By-laws | 758 | "the certificate of incorporation of the Surviving Corporation shall be amended and restated as set forth in Exhibit A" |
| 1.06 | Directors and Officers | 581 | "The directors of Merger Sub immediately prior to the Effective Time shall be the directors of the Surviving Corporation" |

Exact 1:1 match — Article I is exactly these six sections. No tender-offer
mechanics on this filing (real Stockholders Meeting, not a 251(h) short-form
or top-up option), so the `SHORT_FORM_251H`/`TOP_UP`/`SCHEDULE_TO_14D9`
assertion kinds are expected to find nothing here — a correct zero, not a
mapping gap.

### MISC_BOILERPLATE — `9.01`,`9.02`,`9.04`,`9.05`,`9.06`,`9.07`,`9.08`,`9.09`,`9.10`,`9.11`,`8.04` (11 sections, 11 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.01 | Nonsurvival of Representations and Warranties | 393 | "None of the representations and warranties in this Agreement ... shall survive the Effective Time" |
| 9.02 | Notices | 1,495 | "All notices, requests, claims, demands and other communications under this Agreement shall be in writing" |
| 9.04 | Interpretation | 2,865 | "The headings contained in this Agreement ... are for reference purposes only ... The phrase 'date hereof' or 'date of this Agreement' shall be deemed to refer to September 21, 2025" |
| 9.05 | Severability | 640 | "If any term or other provision of this Agreement is invalid, illegal or incapable of being enforced ... all other conditions and provisions ... shall nevertheless remain in full force and effect" |
| 9.06 | Counterparts | 472 | "This Agreement may be executed in one or more counterparts ... Delivery of an executed counterpart ... by electronic transmission shall be effective" |
| 9.07 | Entire Agreement; Third-Party Beneficiaries; No Other Representations or Warranties | 3,006 | sub-clause (a): "This Agreement, the Confidentiality Agreement, the Voting and Support Agreements and the CVR Agreement ... constitute the entire agreement ... are not intended to confer upon any Person other than the parties any rights or remedies" |
| 9.08 | Governing Law | 249 | "This Agreement shall be governed by, and construed in accordance with, the laws of the State of Delaware" |
| 9.09 | Assignment | 810 | "Neither this Agreement nor any of the rights, interests or obligations ... shall be assigned ... without the prior written consent of the other parties" |
| 9.10 | Specific Enforcement; Jurisdiction | 3,797 | sub-clause (b): "Each of the parties hereto hereby irrevocably submits to the exclusive jurisdiction of the Court of Chancery of the State of Delaware" |
| 9.11 | Waiver of Jury Trial | 739 | "Each party hereto hereby waives ... any right it may have to a trial by jury" |
| 8.04 | Amendment; Extension; Waiver | 1,404 | "This Agreement may not be amended, except by an instrument in writing signed on behalf of each of the parties" |

`9.07` and `9.10` are each pinned to a second family too (`NO_OTHER_REPS_FRAUD`
and `SPECIFIC_PERFORMANCE_REMEDIES` respectively) — both sections genuinely
combine two topics on this filing that other deals kept separate.

### NO_OTHER_REPS_FRAUD — `9.07` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.07 | Entire Agreement; Third-Party Beneficiaries; No Other Representations or Warranties | 3,006 | sub-clause (b): "Each of Parent and Merger Sub acknowledges that, except for the representations and warranties contained in Article III, neither the Company nor any Person on behalf of the Company makes any other express or implied representation or warranty ... Except in the case of fraud, neither the Company nor any other Person will have or be subject to any liability" |

Unlike Skechers/TopBuild/Modiv (separate Company-side and Parent-side
sections, e.g. `3.28`/`4.17`), this filing states the no-other-reps
disclaimer for **both** parties, mutually, in one shared section
(sub-clause (b) for the Company, sub-clause (c) for Parent/Merger Sub, both
quoted here as the same node).

### NO_SHOP — `5.02` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.02 | No Solicitation | 20,420 | "The Company shall not ... (i) directly or indirectly solicit, initiate or knowingly encourage or knowingly facilitate the making of any inquiry, offer or proposal which constitutes or is reasonably likely to lead to any Company Takeover Proposal" |

Single-sided (Company only) — Pfizer, as the buyer, gives no reciprocal
no-shop.

### PROXY_MEETING — `6.01`, `6.10`, `6.11` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.01 | Approval of the Merger | 169 | "Immediately following the execution of this Agreement, Parent, as sole stockholder of Merger Sub, shall adopt this Agreement" |
| 6.10 | Proxy Statement | 2,275 | "The Company will ... prepare and file with the SEC the Proxy Statement in preliminary form ... establishing a record date and completing a broker search pursuant to Section 14a-13 of the Exchange Act" |
| 6.11 | Stockholders Meeting | 1,143 | "The Company will ... duly call, give notice of, convene and hold a meeting of its stockholders (the 'Company Stockholders Meeting') for the purpose of seeking the Company Stockholder Approval" |

Real Stockholders Meeting (not written consent, unlike Skechers), which the
`PROXY_MEETING` family's own `adoption_mechanism` vocabulary is designed to
cover either way. `6.01` covers the `PARENT_APPROVAL`/`MERGER_SUB_APPROVAL`
assertion kinds (Parent's own sole-stockholder adoption of Merger Sub).

### REPRESENTATIONS — all 35 Article III + Article IV sections (35 calls)

`3.01`–`3.26`, `4.01`–`4.09`. This family's own scope is "one complete,
admitted representations-and-warranties section" with no topic restriction,
so overlap with `CAPITALISATION` (`3.02`, `4.02`), `MATERIAL_CONTRACTS`
(`3.13`), `TAX_MATTERS` (`3.09`) and `NO_OTHER_REPS_FRAUD`/`MISC_BOILERPLATE`
(`9.07`, technically Article IX not III/IV but conceptually adjacent) is
intentional, same design as Skechers/TopBuild. Every heading was confirmed
against the sectionizer output directly; representative spot-checks:

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.01 | Organization, Standing and Power | 2,139 | standard org/good-standing rep |
| 3.17 | Regulatory Matters | 9,470 | biopharma/FDA rep — "Health Care Submissions ... in compliance with applicable Laws, including applicable Drug Laws" — note this is a REPS-only topic despite the word "Regulatory" in its heading; it is NOT the antitrust family (that is `6.03`, a covenant, entirely different content) |
| 3.19 | Intellectual Property | 17,260 | largest rep section on this filing |
| 4.01 | Organization, Standing and Power | 395 | Parent-side mirror of `3.01` |
| 4.09 | Available Funds | 436 | "Parent and Merger Sub will have at the Effective Time available funds sufficient to pay all amounts required to consummate the Merger" — the deal's entire financing-assurance content, confirming §`FINANCING_COVENANTS`'s correct zero above |

This is the most expensive family in this pin (35 of the 84 total projected
calls across all 23 mapped families).

### SPECIFIC_PERFORMANCE_REMEDIES — `9.10` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.10 | Specific Enforcement; Jurisdiction | 3,797 | sub-clause (a): "the parties acknowledge and agree that irreparable damage would occur ... and that monetary damages, even if available, would not be an adequate remedy therefor ... the parties shall be entitled to an injunction or injunctions, or any other appropriate form of equitable relief" |

Same section as `MISC_BOILERPLATE`'s jurisdiction/forum-selection content
(sub-clause (b)) — this filing merges what Skechers kept as two separate
sections (`9.8` Remedies, `9.10` Jurisdiction).

### TAX_MATTERS — `3.09` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.09 | Taxes | 7,051 | "The Company and each Company Subsidiary have (i) duly and timely filed ... all material Tax Returns ... and (ii) timely paid ... all material Taxes" |

Searched for "intended tax treatment", "Section 351", "reorganization within
the meaning": zero hits. This is an all-cash-plus-CVR taxable deal with no
tax-free-reorganization structure, so there is no tax-treatment covenant and
no Parent-side tax rep to pin (Article IV has no Tax section at all) — a
correct, narrower scope than Skechers' five-section `TAX_MATTERS` mapping,
not an omission.

### TERMINATION — `8.01`, `8.02`, `8.05` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.01 | Termination | 4,479 | "This Agreement may be terminated at any time prior to the Effective Time: (a) by mutual written consent ... (d) by Parent, if at any time prior to the Company Stockholders Meeting, an Adverse Recommendation Change has occurred" |
| 8.02 | Effect of Termination | 4,610 | "In the event of termination of this Agreement ... this Agreement shall forthwith become void and have no effect, without any liability or obligation on the part of Parent or Merger Sub ... (except to the extent that such termination results from fraud or the willful and material breach ...)" |
| 8.05 | Procedure for Termination, Amendment, Extension or Waiver | 1,216 | sub-clause (a): "A termination of this Agreement pursuant to Section 8.01 ... shall, in order to be effective, require ... action by its Board of Directors" |

`8.05` included because `8.01`'s termination grounds fully self-describe
except for ground `(f)` ("by the Company ... in accordance with Section
8.05(b)"), whose actual fiduciary-out mechanics live only in `8.05(b)`.

### TERMINATION_FEE — `8.01`, `8.02`, `8.05` (3 sections, 3 calls; same three sections as `TERMINATION`, different extracted fact shape)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.01 | Termination | 4,479 | grounds `(b)(i)`, `(c)`, `(d)`, `(g)` are the fee-triggering termination rights cross-cited from `8.02(b)` |
| 8.02 | Effect of Termination | 4,610 | sub-clause (b): "then the Company shall pay (or cause to be paid) to Parent a fee of $190,000,000 (the 'Company Termination Fee')" |
| 8.05 | Procedure for Termination, Amendment, Extension or Waiver | 1,216 | sub-clause (b): "The Company may terminate this Agreement pursuant to Section 8.01(f) only if (i) the Company Board authorizes the Company to enter into a definitive written agreement constituting a Superior Company Proposal ... (iii) the Company has paid ... the fee due under Section 8.02" |

**This is the section this task's own instructions specifically warned
about.** The section literally titled "Fees and Expenses" (`8.03`, 324
bytes) is pure boilerplate ("all fees and expenses ... shall be paid by the
party incurring such fees or expenses") — it contains **no dollar figure and
no trigger**. The actual `$190,000,000` "Company Termination Fee," its three
triggering grounds, and the sole-and-exclusive-remedy/cap language are all
inside `8.02` ("Effect of Termination"), which is not the section a
heading-only guess would have picked. This is the same
bare-cross-reference-corroboration problem documented in this script's own
header for Modiv (Section 7.3 citing Section 7.1 with no operative
description) — here, `8.02(b)(i)` cites "Section 8.01(f)" and `8.02(b)(ii)`
cites "Section 8.01(d)" with no restated grounds, and `8.01(f)` itself
further cites `8.05(b)` for the actual fiduciary-out procedure. All three
sections are pinned together, under the same family, so the model has every
operative fact needed to corroborate each trigger rather than accepting a
bare citation. There is **no reciprocal "Parent Termination Fee"** on this
filing — unlike Skechers (which had one), Pfizer pays no termination fee to
Metsera under any ground; only the Company Termination Fee exists. Verified
by reading `8.02` in full: it names exactly one fee, payable in one
direction.

## 5. Verification — every mapped family, dry-run, real CLI

All 23 mapped families were run as `node
scripts/canonical-v2-live-extraction-run.mjs --deal metsera --family
<NAME> --dry-run`, real CLI, real `resolveRunConfig`, real sectionizer, zero
model calls. **All 23 exited 0. Zero occurrences of
`SECTION_REFERENCE_UNRESOLVED`, `SECTION_KIND_MISMATCH`,
`SECTION_HEADING_MISMATCH`, or any hash mismatch anywhere in the full sweep
log** (the sweep ran twice end-to-end due to a background-execution quirk in
this environment, not a script defect — both passes agree, which is stronger
evidence than one pass alone).

| Family | Sections | Projected calls |
|---|---|---|
| ANTITRUST_REGULATORY | 1 | 1 |
| APPRAISAL_DISSENTERS_RIGHTS | 1 | 1 |
| CAPITALISATION | 2 | 2 |
| CLOSING_CONDITIONS | 4 | 4 |
| CONSIDERATION | 3 | 3 |
| DIVIDENDS | 1 | 1 |
| DNO_INDEMNIFICATION | 1 | 1 |
| EMPLOYEE_MATTERS | 1 | 1 |
| GENERAL_COVENANTS | 10 | 10 |
| INTERIM_OPERATING | 1 | 1 |
| KEY_DEFINED_TERMS | 3 | 3 |
| MAE_DEFINITION | 1 | 1 |
| MATERIAL_CONTRACTS | 1 | 1 |
| MERGER_STRUCTURE_CLOSING | 6 | 6 |
| MISC_BOILERPLATE | 11 | 11 |
| NO_OTHER_REPS_FRAUD | 1 | 1 |
| NO_SHOP | 1 | 1 |
| PROXY_MEETING | 3 | 3 |
| REPRESENTATIONS | 35 | 35 |
| SPECIFIC_PERFORMANCE_REMEDIES | 1 | 1 |
| TAX_MATTERS | 1 | 1 |
| TERMINATION | 3 | 3 |
| TERMINATION_FEE | 3 | 3 |
| **Total** | **95** | **95** |

Sample (`TERMINATION_FEE`):

```
[extraction:metsera:TERMINATION_FEE] resolved 8.01: heading="Termination" start=226341 end=230820 bytes=4479
[extraction:metsera:TERMINATION_FEE] resolved 8.02: heading="Effect of Termination" start=230820 end=235430 bytes=4610
[extraction:metsera:TERMINATION_FEE] resolved 8.05: heading="Procedure for Termination, Amendment, Extension or Waiver" start=237158 end=238374 bytes=1216
[extraction:metsera:TERMINATION_FEE] DRY RUN complete: projected_model_call_count=3. Stopping before any model call.
```

## 6. What was NOT mapped

**Two of 25 registered families: `FINANCING_COVENANTS` and
`GUARANTY_FINANCING_PARTY`.** Both are correct zeros, not gaps from
insufficient reading — see their own entries in §4 for the searches that
established this (zero hits for "debt financing", "commitment letter",
"guarant[y]", "no recourse", "non-recourse" anywhere in the 348,692-byte
canonical text). Pfizer is a large-cap strategic acquirer self-funding the
deal (Section 4.09, "Available Funds"); there is no Debt Commitment Letter,
no sponsor guarantor, and no financing-source non-recourse clause to
extract. Neither family was given a `--dry-run` because neither has a
section to point at — pinning either to an arbitrary section (e.g. `4.09`)
would misrepresent a rep as a guaranty or financing covenant, which this
task's instructions specifically warn against ("Where you cannot confidently
identify a family's section, LEAVE IT OUT").

One flagged caveat within the 23 mapped families, not an omission:

- **`DIVIDENDS` (`5.01`)** is pinned to real dividend-restriction text but,
  per that family's own documented design and the Skechers/TopBuild
  precedent, is expected to publish few or zero governed
  `dividend_assertions` — the content is one limb of a combined
  affirmative/forbearance covenant section, not a standalone coordination
  clause.

## 7. Gates

- `CI=true node --test tests/canonical-v2-general-extraction-runner.test.js`
  — **32/32 pass, exit 0.**
- `bash scripts/lint/forbidden-patterns.sh` — **`INVARIANT-4: PASS`, exit
  0.**

## 8. Scope discipline

Only `scripts/canonical-v2-live-extraction-run.mjs` (the new
`DEAL_PINS.metsera` entry) and this note were edited, plus the two
already-existing files pulled in read-only via `git show` to close the
worktree gap documented in §0
(`tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm`
and `docs/codex-program/notes/four-deal-sources-2026-08-08.md`, both byte-for
-byte identical to the already-committed versions on
`claude/codex-handoff-plan-status-77wn7n`, never re-fetched or re-derived).
No live extraction calls were made — every verification above is
`--dry-run` or a read. Nothing under `lib/canonical-v2/**` or `evidence/**`
was touched. Nothing was committed, nothing was pushed.
