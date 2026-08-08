# Step 2G, SkyWater onboarding

Working note, 2026-08-08. Onboarding only -- no live extraction (no model
calls) was run against this pin. Every dry-run below is `--dry-run`, real
CLI, real `resolveRunConfig`, real sectionizer, zero model calls.

Deal: **IonQ, Inc. / SkyWater Technology, Inc.** -- IonQ (a public quantum-
computing company, NYSE) acquires SkyWater Technology (a public
semiconductor foundry, Nasdaq) for cash-plus-stock ($15.00/share cash plus a
fixed exchange ratio of IonQ common stock). Agreement date **2026-01-25**,
read from the preamble sentence: "AGREEMENT AND PLAN OF MERGER dated as of
January 25, 2026 among IONQ, INC., IRIS MERGER SUBSIDIARY 1 INC., IRIS
MERGER SUBSIDIARY 2 LLC and SKYWATER TECHNOLOGY, INC."

## 1. Digests

| | value |
|---|---|
| `raw_bytes_sha256` | `d65d01126e1b5d6dca50b5811ee17071a4a9d23aaaffdbd6299619695cb8119a` |
| `canonical_text_sha256` | `ffee664a374a1c18c35dabb9458bcffc8e5014a305eefc184b102bbbe5bcc8f1` |
| `canonical_text_byte_length` | 360,595 |
| verification | `PASS` |

`raw_bytes_sha256` matches the value already given in this task's brief and
already recorded in `docs/codex-program/notes/four-deal-sources-2026-08-08.md`
(589,570 raw bytes) -- not re-derived, just confirmed by `sha256sum` against
the committed fixture.

`canonical_text_sha256` was **never hand-computed**. Method: added
`DEAL_PINS.skywater` with a placeholder canonical-text digest, ran

```
node scripts/canonical-v2-live-extraction-run.mjs --deal skywater \
  --family KEY_DEFINED_TERMS --section-refs 1.1 --dry-run
```

which resolves the raw bytes (matched immediately), then runs the script's
own `loadAndVerifySource()` -- `buildSecEdgarIntakeCapture` ->
`convertSecHtmlToCanonicalText` -> `verifySecHtmlCanonicalText` -- and
refuses on mismatch, reporting the digest it actually computed:

```
[extraction-run] FAILED: Error: CANONICAL_TEXT_HASH_MISMATCH: canonical
text sha256 mismatch for deal "skywater": expected
PLACEHOLDER_RUN_WITH_DRY_RUN_TO_LEARN_THE_REAL_VALUE, got
ffee664a374a1c18c35dabb9458bcffc8e5014a305eefc184b102bbbe5bcc8f1
```

That value was then pinned, and the same command re-run to confirm:

```
[extraction:skywater:KEY_DEFINED_TERMS] reused committed raw HTML at
.../skywater-raw-fetched.htm, sha256=d65d01126e...119a (MATCHES pin)
[extraction:skywater:KEY_DEFINED_TERMS] document_hash =
d65d01126e...119a
[extraction:skywater:KEY_DEFINED_TERMS] canonical_text_sha256 =
ffee664a374a1c18c35dabb9458bcffc8e5014a305eefc184b102bbbe5bcc8f1 (MATCHES pin)
[extraction:skywater:KEY_DEFINED_TERMS] sectionizer node count = 429, by
kind = {"ROOT":1,"ARTICLE":11,"SECTION":102,"SUBSECTION":315}
```

This is the runner's own code path, run today, against current library
code -- never a separate or reimplemented conversion.

## 2. The two-step merger structure

This is the first two-step merger in the corpus. Two merger subs:
**Iris Merger Subsidiary 1 Inc.** (Delaware corporation) and **Iris Merger
Subsidiary 2 LLC** (Delaware LLC). Article I is headed "THE MERGERS"
(plural), and Section 1.1 spells out both steps explicitly:

> "(i) at the Effective Time, Merger Subsidiary 1 shall be merged with and
> into the Company ... and the Company shall be the surviving corporation in
> the First Merger (the "First Surviving Corporation") and (ii) immediately
> following the Effective Time, ... at the Second Effective Time, the First
> Surviving Corporation shall be merged with and into Merger Subsidiary 2 ...
> with Merger Subsidiary 2 surviving the Second Merger (... the "Surviving
> Company")"

Two certificates of merger (First/Second), two effective times (`Effective
Time` and `Second Effective Time`, the latter always later per 1.1(b)), one
`Closing`. This double-step shape exists to secure tax-free reorganization
treatment for the stock portion of the consideration (Section 7.4's
"Threshold Percentage" / continuity-of-interest test under Treas. Reg.
§1.368-1(e) and Rev. Proc. 2018-12) despite the deal being economically a
cash-and-stock acquisition -- a merger straight into Parent's corporate
merger sub would not reliably qualify, but merging the First Surviving
Corporation down into a disregarded-entity LLC does. This ties
`MERGER_STRUCTURE_CLOSING` and `TAX_MATTERS` together structurally, not just
coincidentally.

**Which families the two-step structure actually touched, concretely:**

- **`MERGER_STRUCTURE_CLOSING`** (1.1, 1.2, 1.3): every one of these three
  sections carries BOTH steps in the same numbered section -- 1.1 has both
  effective times and both certificates of merger; 1.2 has both the First
  Surviving Corporation's charter/by-laws (from Merger Sub 1) AND the
  Surviving Company's certificate of formation/LLC agreement (from Merger
  Sub 2); 1.3 has both the First Surviving Corporation's directors/officers
  (from Merger Sub 1) and the Surviving Company's officers (from Merger Sub
  2). A mapping that used only "the first merger's section" would not have
  missed anything, because there is no second, separate section -- the
  drafters folded both steps into one Article I throughout. This is the
  answer to the brief's specific concern ("a mapping that silently covers
  only the first merger step") -- there was no second section to miss, but
  it was verified by reading each of 1.1/1.2/1.3 in full, not assumed.
- **`CONSIDERATION`** (1.4 principally): 1.4(a)-(d) converts Company Common
  Stock into Merger Consideration at the FIRST Effective Time; 1.4(e)
  separately (i) leaves Merger Sub 1's own shares outstanding as the First
  Surviving Corporation's shares, then (ii) at the Second Effective Time
  cancels those First-Surviving-Corporation shares with **no consideration**
  and leaves Merger Sub 2's LLC interests outstanding as the Surviving
  Company's interests. `consideration-producer-prompt.js`'s own instructions
  ("Never treat Merger Sub or Surviving Corporation internal share
  conversion as merger consideration") already anticipate exactly this
  shape -- the model is expected to extract 1.4(a)-(d) as real
  `PER_SHARE_CASH`/`EXCHANGE_RATIO` facts and correctly decline to treat
  1.4(e)'s internal step-two share cancellation as consideration. Whoever
  runs this family live should expect that outcome and not read a
  `open_world_candidates` or omission on 1.4(e) as a defect.
- **`CAPITALISATION`** (4.14, "Capitalization of Merger Subsidiaries"):
  covers both merger subs in one section -- Merger Subsidiary 1's stock is
  owned by Merger Subsidiary 2 (i.e. the LLC owns the corporation before the
  Mergers), which is itself a two-step-specific capitalisation fact absent
  from every single-merger-sub deal in the corpus.
- **`DNO_INDEMNIFICATION`** (6.3): the six-year D&O indemnification
  obligation runs against "the Surviving Company" -- the FINAL entity after
  the Second Merger, not the First Surviving Corporation -- confirming the
  indemnification survives through both steps to the ultimate surviving LLC.
- **`GENERAL_COVENANTS`** (6.2, "Obligations of Merger Subsidiaries"): a
  section that would not exist on a single-merger-sub deal -- Parent must
  cause EACH of the two Merger Subsidiaries to perform and consummate "the
  Mergers" (plural).
- **`APPRAISAL_DISSENTERS_RIGHTS`** (1.6): unlike every prior deal in this
  corpus (Modiv 2.7, TopBuild, Skechers 2.7 -- appraisal as a sub-clause of
  the consideration section), SkyWater's appraisal carve-out is its OWN
  numbered section (1.6), separate from 1.4. Not caused by the two-step
  structure itself, but a related structural difference worth flagging so
  nobody copies "appraisal is always a sub-clause" onto the next deal.

## 3. Section tree

`sectionizeAdmittedSource()` driven directly (not the CLI) against the
converted canonical text: **429 tree nodes total** (`ROOT: 1, ARTICLE: 11,
SECTION: 102, SUBSECTION: 315`). Eleven articles -- one more than a typical
single-step deal, driven by Article I covering `1.1`-`1.6` (six sections for
the two-step mechanics, equity awards and appraisal, where a single-step
deal usually needs three or four) and by a distinct `ARTICLE X`
("MISCELLANEOUS") followed by an `Annex-A` node ("CERTAIN DEFINED TERMS", a
node the sectionizer reads as `ARTICLE A` at the top level) rather than a
Certain-Definitions article numbered `1.x` or a late-numbered `8.x`/`9.x`
definitions section the way Modiv/TopBuild/Skechers have it.

Full ARTICLE-level list:

| Article | Heading | Bytes |
|---|---|---|
| I | THE MERGERS | 19,999 |
| II | EXCHANGE OF CERTIFICATES | 13,491 |
| III | REPRESENTATIONS AND WARRANTIES OF THE COMPANY | 127,790 |
| IV | REPRESENTATIONS AND WARRANTIES OF PARENT AND THE MERGER [SUBSIDIARIES] | 22,097 |
| V | COVENANTS OF THE COMPANY | 44,725 |
| VI | COVENANTS OF PARENT | 18,275 |
| VII | COVENANTS OF PARENT AND THE COMPANY | 22,500 |
| VIII | CONDITIONS TO THE MERGER | 5,863 |
| IX | TERMINATION | 5,962 |
| X | MISCELLANEOUS | 26,420 |
| Annex-A | CERTAIN DEFINED TERMS | 43,569 |

## 4. The mapping, 24 of 25 families

Every row below was read against the actual body text, byte-sliced with
`Buffer.from(text, 'utf8').slice(start, end)` (UTF-8 byte offsets, matching
the runner's own `sectionBodyText` pattern -- never `String.slice`).

### ANTITRUST_REGULATORY -- `7.1` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 7.1 | Reasonable Best Efforts | 8,859 | "submit ... the notifications required under the HSR Act ... within 20 Business Days"; "Parent shall control the strategy for obtaining any necessary clearance ... pursuant to any antitrust, competition or trade regulation law"; "proposing, negotiating, committing to and effecting ... the sale, divestiture or disposition of such businesses ... ('Divestiture Remedies')" |

Unlike Skechers (where the general-efforts and antitrust-specific content
were two different numbered sections, 6.1 vs 6.2), on this filing the
general "reasonable best efforts to consummate" opening clause and the
antitrust-specific HSR/strategy-control/burden content are the SAME section
-- there is no clean second section to split into `GENERAL_COVENANTS`,
and `GENERAL_COVENANTS`' own 17-code codebook has no code for "general
efforts to consummate" (verified against `GENERAL_COVENANT_FOLLOW_ON_OWNERS`
in `lib/canonical-v2/p0-product-surface-routing.js`), so 7.1 is pinned
solely to `ANTITRUST_REGULATORY`.

### APPRAISAL_DISSENTERS_RIGHTS -- `1.6` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.6 | Appraisal Rights | 2,263 | "shall not be converted into, or represent the right to receive, the Merger Consideration ... but instead shall represent only the right to receive such amounts as may be determined to be due ... in accordance with Section 262 of the DGCL"; (b) "the Company shall not make any payment with respect to, or offer to settle or settle, or approve the withdrawal of, any such demands" |

A standalone numbered section here, not a sub-clause of the consideration
section -- see section 2 above.

### CAPITALISATION -- `3.5`, `4.5`, `4.14` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.5 | Capitalization | 6,517 | "The authorized capital stock of the Company consists of 200,000,000 shares of Company Common Stock and 80,000,000 shares of Company Preferred Stock. As of ... January 22, 2026 ... there were outstanding (i) 48,625,689 shares" |
| 4.5 | Capitalization | 226 | "The authorized capital stock of Parent consists of 1,000,000,000 shares of Parent Common Stock, and 20,000,000 shares of preferred stock" |
| 4.14 | Capitalization of Merger Subsidiaries | 865 | "The authorized capital stock of Merger Subsidiary 1 consists solely of 1,000 shares ... owned by Merger Subsidiary 2 ... the limited liability company interests of Merger Subsidiary 2 ... owned directly by Parent" |

### CLOSING_CONDITIONS -- `8.1`, `8.2`, `8.3`, `8.4` (4 sections, 4 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.1 | Conditions to the Obligations of Each Party | 1,328 | "this Agreement shall have been adopted by the stockholders of the Company"; "any applicable waiting period ... under the HSR Act ... shall have expired or been terminated"; "the Form S-4 shall have been declared effective by the SEC" |
| 8.2 | Additional Conditions to the Obligations of Parent and the Merger Subsidiaries | 2,190 | mirror-image bring-down/MAE conditions for Parent's benefit |
| 8.3 | Additional Conditions to the Obligations of the Company | 1,923 | mirror-image conditions for the Company's benefit |
| 8.4 | Frustration of Closing Conditions | 384 | "None of the parties may rely ... on the failure of any condition ... if such failure was caused by such party's breach" |

Exact 1:1 match -- Article VIII is exactly these four sections (one more
than Skechers' three, because of the added `8.4` frustration clause).

### CONSIDERATION -- `1.4`, `1.5`, `2.1`, `2.2`, `2.3`, `2.4` (6 sections, 6 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.4 | Effect on Capital Stock | 4,728 | "each share of Company Common Stock ... shall ... be converted into ... the right to receive (1) an amount in cash ... equal to $15.00 ('Per Share Cash Consideration') and (2) such number of ... shares of Parent Common Stock equal to the Exchange Ratio" |
| 1.5 | Equity Awards | 6,943 | "each outstanding award of stock options ... shall ... constitute a stock option ... with respect to the number ... of shares of Parent Common Stock determined by multiplying ... by ... the Equity Award Exchange Ratio" |
| 2.1 | Surrender and Payment | 8,267 | Exchange Fund / Exchange Agent deposit and surrender mechanics |
| 2.2 | Fractional Shares | 2,994 | no fractional Parent Common Stock shares issued; cash paid in lieu |
| 2.3 | Lost Certificates | 870 | affidavit-and-indemnity replacement mechanic for lost certificates |
| 2.4 | Withholding Rights | 1,324 | "each of the First Surviving Corporation, the Surviving Company, Parent, the Company, Merger Subsidiary 1, Merger Subsidiary 2, the Exchange Agent ... shall be entitled to deduct and withhold" |

See section 2 above for how 1.4(e) (internal step-two share cancellation,
no consideration) is deliberately excluded by the family's own prompt
instructions even though it sits inside the pinned section.

### DIVIDENDS -- `5.1` (1 section, 1 call; likely low/zero governed yield, by design)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.1 | Conduct of the Company | 13,995 | Sub-clause (d)(ii): "declare, set aside or pay any dividend or other distribution payable in cash, stock or property with respect to its capital stock other than dividends or distributions paid by any Subsidiary of the Company to the Company" |

Same shape as TopBuild/Skechers: one limb of a thirty-ish-limb forbearance
covenant, not a standalone dividends-coordination section. Expected to
publish few or zero `dividend_assertions`, not a mapping defect.

### DNO_INDEMNIFICATION -- `6.3` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.3 | Director and Officer Liability | 7,650 | "from the Effective Time and until the six year anniversary of the Effective Time, Parent shall cause the Surviving Company and each of its Subsidiaries to indemnify, defend and hold harmless each ... Indemnified Person" |

Runs to "the Surviving Company" -- the post-Second-Merger entity, see
section 2 above.

### EMPLOYEE_MATTERS -- `6.5` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.5 | Employee Benefits | 8,099 | "Parent shall cause the Surviving Company to honor in accordance with their terms all benefits and obligations under the Company Benefit Plans ... The consummation of the Mergers shall constitute a 'Change in Control'" |

### FINANCING_COVENANTS -- `5.8` (1 section, 1 call; narrow, real content)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.8 | Treatment of Company Indebtedness | 1,729 | "deliver to Parent at least three Business Days prior to the Closing Date a copy of a payoff letter ... which payoff letter shall (i) indicate the total amount required to be paid to fully satisfy all principal, interest, prepayment premiums" |

This is a real, direct match to the family's own `PAYOFF_LEAD_TIME`
assertion kind -- but that is ALL this filing has for `FINANCING_COVENANTS`.
There is no acquisition-debt financing condition at all (see
`GUARANTY_FINANCING_PARTY` below): no `OBTAIN_EFFORTS`/`COOPERATION_GRANT`
content exists because Parent is not financing the deal with third-party
debt. Grepped the full canonical text for "financing", "commitment letter"
outside of this section -- no other hits describing acquisition financing.
Expect this family to produce at most a `PAYOFF_LEAD_TIME` fact and nothing
else, which is the correct, narrow outcome for this deal, not a mapping gap.

### GENERAL_COVENANTS -- `5.4`,`5.5`,`5.6`,`5.7`,`6.2`,`6.4`,`7.2`,`7.3`,`7.5`,`7.6`,`7.7`,`7.8`,`7.9` (13 sections, 13 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.4 | Resignation of Company Directors | 421 | "cause each director of the Company to deliver a written resignation ... effective at the Effective Time" (COV-RESIGN) |
| 5.5 | Other Actions | 243 | "the Company and Parent shall cooperate with each other to lift any injunctions or remove any other impediment to the consummation of the Transactions" -- no exact COV code, but a genuine residual covenant with no other family's vocabulary; included as the catch-all family's own stated role |
| 5.6 | Takeover Statutes | 480 | "the Company and its Board of Directors shall grant such approvals ... so that the Transactions may be consummated" (COV-TAKEOVER) |
| 5.7 | Stock Exchange Delisting; Deregistration | 615 | "cause (a) the delisting of the Company Common Stock from Nasdaq ... and (b) the deregistration ... pursuant to the Exchange Act" (COV-DELIST) |
| 6.2 | Obligations of Merger Subsidiaries | 278 | "Parent shall take all actions necessary to cause each of the Merger Subsidiaries to perform its respective obligations ... and to consummate the Mergers" (COV-MERGESUB; two-step-specific, see section 2) |
| 6.4 | Stock Exchange Listing | 231 | "Parent shall take all necessary action to cause the shares of Parent Common Stock ... to be listed on the NYSE" (COV-LIST) |
| 7.2 | Certain Filings | 1,223 | "in no event shall Parent ... or the Company ... be required to pay ... any fee ... to any third party to obtain any consent, approval or waiver" (COV-CONSENT) |
| 7.3 | Access to Information | 1,796 | "give Parent ... reasonable access to the offices, properties, books and records of the Company" (COV-ACCESS) |
| 7.5 | Public Announcements | 1,459 | "Parent and the Company shall consult with each other before issuing any press release" (COV-PUBLICITY) |
| 7.6 | Further Assurances | 730 | "the officers and directors of the Surviving Company shall be authorized to execute and deliver ... any deeds, bills of sale, assignments or assurances" (COV-FURTHER) |
| 7.7 | Notices of Certain Events | 1,007 | "Each of the Company and Parent shall promptly notify the other party of ... any written notice ... alleging that the consent of such Person is or may be required" (COV-NOTIFY) |
| 7.8 | Section 16(b) | 560 | "cause the Transactions ... to be exempt under Rule 16b-3" (COV-16B) |
| 7.9 | Transaction Litigation | 1,027 | "The Company shall promptly notify Parent of any stockholder demands, litigations, arbitrations" (COV-LITNOTIFY) |

Codes read against `GENERAL_COVENANT_FOLLOW_ON_OWNERS` in
`lib/canonical-v2/p0-product-surface-routing.js` (the same 17-code
codebook `general-covenants-producer-prompt.js` compiles from), not
invented.

### GUARANTY_FINANCING_PARTY -- UNMAPPED

No section pinned. See section 1's `default_section_refs_by_family` comment
in the script and `FINANCING_COVENANTS` above: no guaranty, no "Financing
Sources"/"Financing Parties" concept, no non-recourse/financing-party-
protection clause anywhere in the 360,595-byte canonical text (grepped for
"guarant", "debt financing", "financing sources", "commitment letter", "no
recourse", "non-recourse" -- every hit is unrelated: Pension Benefit
Guaranty Corporation, real-property lease guaranties, and guarantees of
pre-existing Company indebtedness being paid off at Closing under `5.8`).
IonQ is funding the cash consideration itself; there is no acquisition-debt
condition and no sponsor/guarantor structure for this family to describe.
Leaving it unmapped rather than pointing it at the nearest unrelated section.

### INTERIM_OPERATING -- `5.1`, `6.1` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.1 | Conduct of the Company | 13,995 | thirty-ish-limb Company forbearance covenant (MERGE/CONTRACT/COMP/DEBT/TAX/CHARTER/ISSUE/ACCOUNTING/SETTLE/DIVIDEND/CAPEX) |
| 6.1 | Conduct of Parent | 1,986 | Parent-side forbearance covenant -- "Parent shall not ... cause or permit any modifications ... to the organizational documents of Parent"; "reclassify, combine, adjust, split or subdivide any capital stock of Parent" |

Unusual for this family: Parent (IonQ) carries its OWN forbearance covenant
here, because Parent is issuing stock as part of the consideration and its
own capital structure matters to the deal economics. `ioc-producer-
prompt.js`'s own response shape has an explicit `attachment_scope:
"RESTRICTION_LIMB | PARENT_COVENANT | null"` field -- this family is
designed to cover exactly this two-sided shape, not only a Company-only
restriction.

### KEY_DEFINED_TERMS -- `Annex-A` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| Annex-A | CERTAIN DEFINED TERMS | 43,569 | "Superior Proposal" and "Acquisition Proposal" definitions; "Threshold Percentage"; "Change in the Company Recommendation" cross-reference resolved here |

The sectionizer reads this node as top-level `ARTICLE A` / reference
`Annex-A` (the filing's own printed heading is "CERTAIN DEFINED TERMS" as an
annex, not a numbered Article I definitions section the way Modiv/TopBuild
have it). Resolves cleanly via `findSectionByReference(tree, 'Annex-A')`
(confirmed in section 5's dry-run log below). 43,569 bytes -- close to the
`~48-84KB` range that produced the model-output-overflow failures
documented in Step 2F (TopBuild's `REPRESENTATIONS` and `NO_SHOP`). Flagging
for whoever runs this family live: it may need to be split or the output
budget raised.

### MAE_DEFINITION -- `Annex-A` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| Annex-A | CERTAIN DEFINED TERMS | 43,569 | "'Company Material Adverse Effect' means any state of facts, change, development, event, effect, condition or occurrence ..."; separately, "'Parent Material Adverse Effect' means ..." |

**Two-sided MAE** here (both Company and Parent definitions exist), unlike
Skechers' single-sided MAE (Skechers' Parent was a private acquisition
vehicle with no MAE-qualified reps of its own; here Parent is a public
operating company giving its own reps, so it carries its own MAE
definition too). Same 43,569-byte overflow-risk caveat as
`KEY_DEFINED_TERMS` above (same section).

### MATERIAL_CONTRACTS -- `3.20` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.20 | Material Contracts | 6,189 | "would be required to be filed by the Company as a 'material contract' (as such term is defined in item 601(b)(10) of Regulation S-K"; "includes any contingent payment obligations ... that would require payments ... that exceed, individually or in the aggregate, $1,000,000" |

### MERGER_STRUCTURE_CLOSING -- `1.1`, `1.2`, `1.3` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.1 | The Mergers | 3,819 | both effective times, both certificates of merger, "The closing of the Mergers (the 'Closing') shall take place ... on the third Business Day following the day on which the last ... of the conditions set forth in Article VIII ... shall be fulfilled or waived" |
| 1.2 | Certificate of Incorporation and By-Laws of the First Surviving Corporation and the Surviving Company | 1,200 | both the First Surviving Corporation's (from Merger Sub 1) and the Surviving Company's (from Merger Sub 2) governing documents |
| 1.3 | Directors and Officers of the Surviving Company | 1,024 | both the First Surviving Corporation's directors/officers (from Merger Sub 1) and the Surviving Company's officers (from Merger Sub 2) |

See section 2 above for the full two-step read.

### MISC_BOILERPLATE -- `10.1`-`10.4`, `10.7`-`10.15` (13 sections, 13 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 10.1 | Notices | 1,309 | notice-delivery mechanics (NOTICE) |
| 10.2 | Non-Survival of Representations and Warranties | 254 | reps/covenants terminate at Closing except as stated (WAIVER_OR_SURVIVAL) |
| 10.3 | Amendments; No Waivers | 1,074 | amendment-execution and no-waiver-by-delay mechanics (WAIVER_OR_SURVIVAL) |
| 10.4 | Expenses | 862 | each party bears its own expenses (CONSTRUCTION_OR_EXPENSES) |
| 10.7 | Successors and Assigns | 633 | no assignment without consent (ASSIGNMENT_DETAIL) |
| 10.8 | Governing Law | 181 | "governed by ... the laws of the State of Delaware" (GOVERNING_LAW) |
| 10.9 | Enforcement; Jurisdiction | 2,315 | exclusive Delaware Court of Chancery consent, waiver of inconvenient-forum objection (FORUM_FALLBACK) -- also pinned to `SPECIFIC_PERFORMANCE_REMEDIES`, see below |
| 10.10 | Waiver of Jury Trial | 213 | jury-trial waiver (WAIVER_OR_SURVIVAL) |
| 10.11 | Counterparts; Effectiveness | 540 | electronic-signature counterparts (CONSTRUCTION_OR_EXPENSES) |
| 10.12 | Entire Agreement | 1,316 | entire-agreement merger clause (CONSTRUCTION_OR_EXPENSES) |
| 10.13 | Captions | 158 | headings for convenience only (CONSTRUCTION_OR_EXPENSES) |
| 10.14 | Severability | 799 | invalid-provision severability (CONSTRUCTION_OR_EXPENSES) |
| 10.15 | Interpretation | 4,885 | construction rules ("hereof"/"herein" etc.) (CONSTRUCTION_OR_EXPENSES) |

No standalone Third-Party-Beneficiaries section on this filing (a TPB
carve-out exists, but only as a sub-clause inside `6.5` Employee Benefits,
which stays with `EMPLOYEE_MATTERS` instead) -- so `TPB_EXCEPTION` is
expected to produce zero facts here, a correct zero given no standalone
section exists for it.

### NO_OTHER_REPS_FRAUD -- `3.30`, `4.16` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.30 | No Additional Representations | 2,639 | "Except for the representations and warranties made in this Article III ... neither the Company nor any other Person makes any express or implied representation or warranty" |
| 4.16 | No Additional Representations | 2,781 | Parent-side mirror |

### NO_SHOP -- `5.2`, `5.3` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.2 | No Solicitation | 8,744 | "immediately cease and cause to be terminated ... any and all solicitation, encouragement, discussions or negotiations ... with respect to any Acquisition Proposal" |
| 5.3 | Company Stockholder Meeting; Proxy Material | 18,463 | Sub-clause (b): "The Board of Directors of the Company shall be permitted ... to (A) make a Change in the Company Recommendation in response to an Intervening Event ..." (the full "Match Period"/Superior-Proposal-Notice mechanism) |

**Important finding, not two-step-related but real:** the fiduciary-out /
Change-in-Company-Recommendation mechanism is filed under `5.3` (the
*meeting* section), not `5.2` (the no-solicit section) -- `5.2` itself
cross-references "Section 5.3(b)" for this carve-out. A mapping that used
only `5.2` for `NO_SHOP` (the pattern that would have been copied from
Modiv/TopBuild/Skechers, where recommendation-change language sits inside
the no-solicit section) would have silently produced zero
`RECOMMENDATION_CHANGE_ACTION`/`RECOMMENDATION_CHANGE_TRIGGER`/
`FIDUCIARY_ENGAGEMENT_STANDARD` facts on a deal that plainly has this
mechanism -- caught only by reading `5.3`'s body text in full rather than
trusting its heading.

### PROXY_MEETING -- `5.3` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.3 | Company Stockholder Meeting; Proxy Material | 18,463 | Sub-clause (f): "The Company shall, within 3 Business Days from the Form S-4 Clearance Date, duly call and give notice of a meeting of its stockholders ... The Company shall use its reasonable best efforts to hold the Company Stockholder Meeting ... within 40 days"; "the Company may not ... adjourn or postpone the Company Stockholder Meeting more than a total of three times" |

Same section as `NO_SHOP` -- see the finding above (matches the precedent
of one section serving two families, e.g. Skechers' `CONSIDERATION`/
`APPRAISAL_DISSENTERS_RIGHTS` both at `2.7`). No Parent stockholder vote
requirement anywhere in the filing (grepped "Parent stockholder"/"Parent
shareholder" -- no hits) -- single-sided like Skechers, but for a different
reason (there, Parent was private; here, Parent's own stock issuance
apparently does not trigger a shareholder-vote requirement).

### REPRESENTATIONS -- all 46 Article III + Article IV sections (46 calls)

`3.1`-`3.30`, `4.1`-`4.16`. Same "no topic restriction" design as
Skechers/TopBuild -- accuracy/knowledge-qualifier facts, orthogonal to what
the topic families extract from the same sections. Overlap with
`CAPITALISATION` (`3.5`, `4.5`, `4.14`), `MATERIAL_CONTRACTS` (`3.20`),
`NO_OTHER_REPS_FRAUD` (`3.30`, `4.16`) is intentional. Representative
spot-checks (every heading confirmed against the section-5 dry-run log
below):

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.1 | Corporate Existence and Power | 1,369 | "The Company is a corporation duly incorporated, validly existing and in good standing under the laws of the State of Delaware" |
| 3.29 | Reorganization | 335 | "the Company is not aware ... of the existence of any fact or circumstance that could reasonably be expected to prevent or impede the Mergers from qualifying for the Intended Tax Treatment" (rep, not covenant -- stays out of `TAX_MATTERS`) |
| 4.1 | Corporate Existence and Power | 1,805 | Parent-side mirror of `3.1` |
| 4.15 | Reorganization | 298 | Parent-side mirror of `3.29` |

This is the most expensive family in this pin (46 of the roughly 128 total
projected calls across all 24 mapped families), recorded plainly.

### SPECIFIC_PERFORMANCE_REMEDIES -- `10.9` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 10.9 | Enforcement; Jurisdiction | 2,315 | "irreparable damage would occur ... for which monetary damages would not be an adequate remedy ... each party agrees that the other party shall be entitled to an injunction or injunctions ... and to enforce specifically the terms and provisions hereof" |

Unlike every other deal in the corpus (Skechers `9.8`, a standalone
"Remedies" section), this filing has NO standalone remedies/specific-
performance section -- the injunction/specific-performance grant is folded
into the SAME section as the forum-selection/jurisdiction-consent language
(`10.9`, "Enforcement; Jurisdiction"). `10.9` is therefore pinned to BOTH
`SPECIFIC_PERFORMANCE_REMEDIES` and `MISC_BOILERPLATE` -- the same
one-section/two-family pattern as `NO_SHOP`/`PROXY_MEETING` above.

### TAX_MATTERS -- `7.4` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 7.4 | Tax Matters | 5,791 | "Neither Parent nor the Company shall ... take any action that would prevent or impede ... the Mergers from qualifying for the Intended Tax Treatment"; "the Company shall use reasonable best efforts to obtain from its tax advisor a tax opinion" (TAX_OPINION_COOPERATION); "each of Parent and the Company shall reasonably cooperate ... in good faith ... with respect to Tax matters relevant to integrating" (TRANSFER_COOPERATION) |

The reorganization reps (`3.29`, `4.15`) stay with `REPRESENTATIONS` only --
`tax-matters-producer-prompt.js`'s own instructions say "Extract governed
tax covenants" (covenants, not reps), so pinning the rep sections here too
would be wrong, not merely redundant.

### TERMINATION -- `9.1`, `9.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.1 | Termination | 5,398 | "This Agreement may be terminated and the Mergers may be abandoned at any time prior to the Effective Time ... if the Mergers have not been consummated by the twelve-month anniversary of the date of this Agreement (the 'End Date')" |
| 9.2 | Effect of Termination | 541 | termination-effect/survival-of-certain-provisions mechanics |

### TERMINATION_FEE -- `10.5` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 10.5 | Company Termination Fee | 2,841 | "the Company shall pay (or cause to be paid) to Parent ... $51,573,958.07 (the 'Termination Fee') ..." |

Single-sided (Company-payable only). Notably, this filing has **no Parent
reverse termination fee** -- instead, `10.6` ("Equity Investment", NOT
pinned to any family, see section 5 below) gives the Company the right to
force Parent to purchase $100,000,000 of newly-issued Company shares as its
"sole and exclusive remedy" if the deal fails solely because an antitrust
condition (`8.1(b)`/`8.1(c)`) is not satisfied by the End Date. This is a
real, deliberate substitute for a reverse termination fee, structured as an
equity purchase rather than a cash payment -- it does not fit
`TERMINATION_FEE`'s own `fee_amount_assertions`/`FEE_SIDE` vocabulary (no
dollar "fee", no SELLER/BUYER payer distinction), and it does not fit
`ANTITRUST_REGULATORY`'s vocabulary either (efforts/burden/strategy-control
facts, not a purchase-price remedy). Left unpinned to any family rather than
forced into the nearest available one -- flagging it here so it is not lost.

## 5. Verification -- every mapped family, dry-run, real CLI

All 24 mapped families were run individually as
`node scripts/canonical-v2-live-extraction-run.mjs --deal skywater --family
<NAME> --dry-run`, real CLI, real `resolveRunConfig`, real sectionizer, zero
model calls. **All 24 exited 0. None failed to resolve a section** (no
`SECTION_REFERENCE_UNRESOLVED`, `SECTION_KIND_MISMATCH`, or
`SECTION_HEADING_MISMATCH` in any of the 24 logs).

| Family | Sections | Projected calls |
|---|---|---|
| ANTITRUST_REGULATORY | 1 | 1 |
| APPRAISAL_DISSENTERS_RIGHTS | 1 | 1 |
| CAPITALISATION | 3 | 3 |
| CLOSING_CONDITIONS | 4 | 4 |
| CONSIDERATION | 6 | 6 |
| DIVIDENDS | 1 | 1 |
| DNO_INDEMNIFICATION | 1 | 1 |
| EMPLOYEE_MATTERS | 1 | 1 |
| FINANCING_COVENANTS | 1 | 1 |
| GENERAL_COVENANTS | 13 | 13 |
| INTERIM_OPERATING | 2 | 2 |
| KEY_DEFINED_TERMS | 1 | 1 |
| MAE_DEFINITION | 1 | 1 |
| MATERIAL_CONTRACTS | 1 | 1 |
| MERGER_STRUCTURE_CLOSING | 3 | 3 |
| MISC_BOILERPLATE | 13 | 13 |
| NO_OTHER_REPS_FRAUD | 2 | 2 |
| NO_SHOP | 2 | 2 |
| PROXY_MEETING | 1 | 1 |
| REPRESENTATIONS | 46 | 46 |
| SPECIFIC_PERFORMANCE_REMEDIES | 1 | 1 |
| TAX_MATTERS | 1 | 1 |
| TERMINATION | 2 | 2 |
| TERMINATION_FEE | 1 | 1 |
| **Total** | **~106 unique dispatches (3 sections double-counted: `5.3` under both NO_SHOP/PROXY_MEETING, `10.9` under both MISC_BOILERPLATE/SPECIFIC_PERFORMANCE_REMEDIES, `Annex-A` under both KEY_DEFINED_TERMS/MAE_DEFINITION)** | **109** |

Sample (`KEY_DEFINED_TERMS`, `Annex-A`):

```
[extraction:skywater:KEY_DEFINED_TERMS] reused committed raw HTML at
.../skywater-raw-fetched.htm, sha256=d65d01126e...119a (MATCHES pin)
[extraction:skywater:KEY_DEFINED_TERMS] canonical_text_sha256 =
ffee664a374a1c18c35dabb9458bcffc8e5014a305eefc184b102bbbe5bcc8f1 (MATCHES pin)
[extraction:skywater:KEY_DEFINED_TERMS] resolved Annex-A: heading="CERTAIN
DEFINED TERMS" start=317026 end=360595 bytes=43569
[extraction:skywater:KEY_DEFINED_TERMS] DRY RUN complete:
projected_model_call_count=1. Stopping before any model call.
```

Sample (`NO_SHOP`, the two-section fiduciary-out finding from section 4 above):

```
[extraction:skywater:NO_SHOP] resolved 5.2: heading="No Solicitation"
start=207311 end=216055 bytes=8744
[extraction:skywater:NO_SHOP] resolved 5.3: heading="Company Stockholder
Meeting; Proxy Material" start=216055 end=234518 bytes=18463
[extraction:skywater:NO_SHOP] DRY RUN complete:
projected_model_call_count=2. Stopping before any model call.
```

## 6. What was NOT mapped

- **`GUARANTY_FINANCING_PARTY`** -- no section pinned. See its entry in
  section 4 above: no guaranty, no financing-party-protection language
  anywhere in the filing.
- **Section `10.6` ("Equity Investment")** -- not pinned to any family. A
  real, deal-specific antitrust-failure remedy (Parent must buy $100M of
  Company stock) that does not fit any of the 25 families' governed
  vocabularies. See `TERMINATION_FEE` entry above.

Every other family (24 of 25) received a section mapping, individually
verified by reading the body text.

## 7. Gates

- `CI=true node --test tests/canonical-v2-general-extraction-runner.test.js`
  -- **32/32 pass, exit 0.**
- `bash scripts/lint/forbidden-patterns.sh` -- **`INVARIANT-4: PASS`, exit
  0.**

## 8. Scope discipline

Only `scripts/canonical-v2-live-extraction-run.mjs` (the new
`DEAL_PINS.skywater` entry) and this note were edited. No live extraction
calls were made -- every verification above is `--dry-run` or a read.
Nothing under `lib/canonical-v2/**` or `evidence/**` was touched. Nothing
was committed.

Two files were materialised into this worktree that existed on a sibling
branch (`claude/codex-handoff-plan-status-77wn7n`) but not yet on this
worktree's own branch: the committed raw HTML fixture
(`tests/fixtures/canonical-v2/skywater-first-live-run/skywater-raw-fetched.htm`,
589,570 bytes, `sha256=d65d01126e...119a`, matching the brief exactly) and
`docs/codex-program/notes/four-deal-sources-2026-08-08.md`, both pulled via
`git show <that commit>:<path>` (a read of already-committed content, not a
new fetch or a fabricated fixture) so this worktree could run its own
verification. Both are provenance/reference material the brief already
described as "already committed"; whoever merges the four `DEAL_PINS`
entries should confirm these two files land in the merge alongside them.
