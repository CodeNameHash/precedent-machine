# Step 2G, Concho onboarding

Working note, 2026-08-08. Onboarding only -- no live extraction ladder was
run against this pin. Every dry-run below made zero model calls.

Deal: **ConocoPhillips / Concho Resources Inc.** -- an all-stock,
two-sided (merger-of-equals-shaped) combination of two Permian Basin oil
and gas producers, exchange-ratio consideration (no cash election), no
acquisition debt financing, both companies hold their own stockholder vote
off one Joint Proxy Statement/Form S-4, and ConocoPhillips gains one Concho
director seat post-close.

## 1. Digests

Raw-bytes digest was given (already verified against the committed
fixture); the canonical-text digest was independently re-derived through
**this runner's own `loadAndVerifySource()` code path**
(`buildSecEdgarIntakeCapture` -> `convertSecHtmlToCanonicalText` ->
`verifySecHtmlCanonicalText`), never reimplemented or copied from anywhere
else.

| | value |
|---|---|
| `raw_bytes_sha256` | `3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6` |
| `raw_bytes_length` | 552,099 |
| `canonical_text_sha256` | `30d929c76ab9cd2bddecf3f2df2f2ec107146c2ae31b241110c9923ef03e3be5` |
| `canonical_text_byte_length` | 351,804 |
| verification | `PASS` |

Method used, exactly the instructed route: added `DEAL_PINS.concho` with a
placeholder `canonical_text_sha256`, ran

```
node scripts/canonical-v2-live-extraction-run.mjs --deal concho --family TERMINATION_FEE --section-refs 1.1 --dry-run
```

which refused with `CANONICAL_TEXT_HASH_MISMATCH: ... expected
PLACEHOLDER..., got 30d929c76...3be5`. Pinned that reported `got` value
verbatim, then re-ran the identical command:

```
[extraction:concho:TERMINATION_FEE] reused committed raw HTML at .../concho-raw-fetched.htm, sha256=3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6 (MATCHES pin)
[extraction:concho:TERMINATION_FEE] document_hash = 3c1c08272e7a742ee1ded0d5e2563213a1a44fadeaad55b18c427cac86bed8f6
[extraction:concho:TERMINATION_FEE] canonical_text_sha256 = 30d929c76ab9cd2bddecf3f2df2f2ec107146c2ae31b241110c9923ef03e3be5 (MATCHES pin)
[extraction:concho:TERMINATION_FEE] DRY RUN complete: projected_model_call_count=1. Stopping before any model call.
```

Independently corroborated: I also drove `sectionizeAdmittedSource()`
directly (not through the CLI) against the same converted canonical text
via a scratch script that calls the identical library functions
(`buildSecEdgarIntakeCapture` -> `convertSecHtmlToCanonicalText`), and it
reported the same `canonical_text_sha256` and `canonical_text_byte_length`
-- a second, independent call path agreeing with the runner's own, not the
basis for the pin (the runner's own dry-run output above is that), just
corroboration.

**Fixture note:** `tests/fixtures/canonical-v2/concho-first-live-run/concho-raw-fetched.htm`
was not present in this worktree at task start (this worktree's branch
predates the commit that added the four new-deal fixtures on a sibling
branch); it was pulled in from that commit (`e0177a25`, "feat: fetch four
verified merger agreements for Metsera, Concho, Red Hat and SkyWater") and
independently re-verified byte-for-byte against the raw-bytes digest given
in the task before use. `docs/codex-program/notes/four-deal-sources-2026-08-08.md`
was pulled in from the same commit for provenance/cross-reference; its
`concho` row's raw bytes (552,099) and sha256 match exactly.

## 2. Agreement date

**2020-10-18.** Read from the agreement's own preamble sentence:

> "AGREEMENT AND PLAN OF MERGER among CONOCOPHILLIPS, FALCON MERGER SUB
> CORP. and CONCHO RESOURCES INC. Dated as of October 18, 2020"

(Given as already-verified in the task; independently reconfirmed against
the fixture's own text before pinning.)

## 3. Method

1. Read `scripts/canonical-v2-live-extraction-run.mjs`'s header, `DEAL_PINS`
   (as it stood before this change: only `modiv` and `topbuild` pinned in
   this worktree's branch -- the task's reference to a pre-existing
   `skechers` entry did not hold in this worktree; see "What this worktree
   actually had" below) and `resolveRunConfig` in full.
2. Got the registered family list from `listRegisteredSectionFamilies()`
   directly (25 families), not from a hand-copied list.
3. Drove `sectionizeAdmittedSource()` directly against the converted
   canonical text and dumped every `ARTICLE`/`SECTION` node with its
   reference, heading and byte span -- **441 tree nodes total** (`ROOT: 1,
   ARTICLE: 10, SECTION: 109, SUBSECTION: 321`). Full ARTICLE/SECTION list
   in the mapping table below.
4. For every family, read the actual section body text (not just the
   heading) via the runner's own `utf8Slice(text, start, end)` helper
   (`lib/canonical-v2/canonical-bytes.js`) -- UTF-8 byte offsets, never
   UTF-16 `slice`/`indexOf` -- and checked candidate sections against that
   family's own producer prompt (`lib/canonical-v2/native-producer/*-producer-prompt.js`,
   its response shape and assertion-kind vocabulary), not just the plain
   English family name.
5. Confirmed every mapped family with `--dry-run` (real CLI, real
   `resolveRunConfig`, real sectionizer) after pinning -- see (pending)
   section below, filled in once the sweep finishes.

### What this worktree actually had

The task described the `skechers` entry as already present at
`DEAL_PINS` line ~288 and the file
`docs/codex-program/notes/step-2g-skechers-onboarding.md` as already
committed. Neither was in this worktree's checked-out branch -- only
`modiv` and `topbuild` were pinned, and no `step-2g-*` note existed on this
branch's own history. Both exist on other branches in this repository
(`step-2g-skechers-onboarding.md` at commit `584d1213`, and the Skechers
`DEAL_PINS` entry presumably on whatever branch that commit's sibling work
landed on). Per the codebase's own standing instruction to verify rather
than trust a claim about what already exists, I read the Skechers note
from `584d1213` directly (`git show 584d1213:docs/codex-program/notes/step-2g-skechers-onboarding.md`)
as the worked example rather than assuming it was already merged into this
branch, and did not rely on any `DEAL_PINS.skechers` entry that is not
actually present in this file as I found it.

## 4. The mapping

Concho's Article IV is the Company's 27-section representations article
(`4.1`-`4.27`); Article V is Parent's 19-section representations article
(`5.1`-`5.19`); Article VI is 21 covenant sections (`6.1`-`6.21`); Article
IX is 13 general-provisions sections (`9.1`-`9.13`). Actual definitions
(including "Material Adverse Effect" itself, with its full carve-out
proviso, and "Willful and Material Breach") live in a section referenced
as `Annex-A` at the tail of the document (bytes 309,662-349,102, 39,440
bytes) -- Article I's `1.1`/`1.2` are a one-sentence pointer to Annex A
plus a "terms defined elsewhere" locator table, not the definitions
themselves.

24 of 25 registered families received a mapping; 1 was deliberately left
unmapped (below). Every row's "Verified against" is a phrase read directly
from that section's body text via `utf8Slice`, not inferred from the
heading alone.

### ANTITRUST_REGULATORY -- `6.8` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.8 | HSR and Other Approvals | 9,182 | "the Parties shall proceed to prepare and file with the appropriate Governmental Entities and other third parties all authorizations, consents, notifications, certifications, registrations, declarations and filings that are necessary in order to consummate the Transactions" |

### APPRAISAL_DISSENTERS_RIGHTS -- `3.4` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.4 | No Appraisal Rights | 132 | "In accordance with the DGCL, no appraisal rights shall be available with respect to the Transactions." |

The entire section is a negative statement -- this is an all-stock merger,
and DGCL Section 262's "market-out" exception removes appraisal rights
for that structure. The appraisal producer prompt's own instructions say
"Never assert a negative", so this family is expected to publish zero
`appraisal_assertions`/`mechanics` on this deal. That is the correct
result of a real, deliberately-read section, not a missing mapping --
exactly the "family returning zero can be correct" pattern documented for
this repository (c.f. `DIVIDENDS` on debt-financed take-privates).

### CAPITALISATION -- `4.2`, `5.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.2 | Capital Structure | 4,403 | "the authorized capital stock of the Company consists of (i) 300,000,000 shares of Company Common Stock and (ii) 10,000,000 shares of preferred stock... At the close of business on October 16, 2020: (A) 196,305,223 shares of Company Common Stock were issued and outstanding" |
| 5.2 | Capital Structure | 4,767 | Parent-side mirror of `4.2` (authorized/outstanding Parent Common Stock and Preferred Stock counts) |

### CLOSING_CONDITIONS -- `7.1`, `7.2`, `7.3`, `7.4` (4 sections, 4 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 7.1 | Conditions to Each Party's Obligation to Consummate the Merger | 1,570 | "(a) Stockholder Approvals. The Company Stockholder Approval and the Parent Stockholder Approval shall have been obtained" |
| 7.2 | Additional Conditions to Obligations of Parent and Merger Sub | 3,079 | mirror-image bring-down/MAE conditions for Parent's benefit |
| 7.3 | Additional Conditions to Obligations of the Company | 3,128 | mirror-image bring-down/MAE conditions for the Company's benefit |
| 7.4 | Frustration of Closing Conditions | 373 | (a party may not invoke a condition its own breach caused) |

Article VII is exactly these four sections -- 1:1 match.

### CONSIDERATION -- `3.1`, `3.2`, `3.3` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.1 | Effect of the Merger on Capital Stock | 4,023 | "each share of common stock... of the Company... issued and outstanding immediately prior to the Effective Time... shall be converted into the right to receive... the 'Merger Consideration'" (Exchange Ratio into Parent Common Stock -- no cash election exists on this deal) |
| 3.2 | Treatment of Equity Compensation Awards | 5,705 | equity award (Company Restricted Stock Award / Performance Unit Award) conversion mechanics |
| 3.3 | Payment for Securities; Exchange | 16,157 | Exchange Agent, Exchange Fund, Certificates/Book-Entry Shares mechanics |

`3.4` ("No Appraisal Rights") sits in the same Article III consideration
run but is routed to `APPRAISAL_DISSENTERS_RIGHTS` instead (see above) --
the same one-topic-per-numbered-section pattern already used elsewhere in
this table.

### DIVIDENDS -- `6.21` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.21 | Coordination of Quarterly Dividends | 1,246 | "Parent and the Company shall each coordinate their record and payment dates for their regular quarterly dividends to ensure that the holders of Company Common Stock shall not receive two (2) dividends, or fail to receive one (1) dividend, in any quarter" |

Unlike the debt-financed take-privates in this corpus (Modiv, Skechers,
TopBuild), where the dividend restriction is one limb of a forbearance
covenant, Concho has a real, standalone dividend-coordination section --
expected to publish real `dividend_assertions`, not a documented zero.

### DNO_INDEMNIFICATION -- `6.10` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.10 | Indemnification; Directors' and Officers' Insurance | 7,876 | "from the Effective Time, Parent and the Surviving Corporation shall, jointly and severally, indemnify, defend and hold harmless each Person who is now, or has been at any time prior to the date of this Agreement... a director or officer of the Company" |

### EMPLOYEE_MATTERS -- `6.9` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.9 | Employee Matters | 6,691 | "Parent shall cause each individual who is employed as of the Closing Date by the Company... and who remains employed by Parent... to be provided with (i) a total target cash compensation opportunity... that is no less favorable than that provided to similarly situated employees of Parent" |

`4.10` ("Compensation; Benefits") and `4.11`/`5.10` ("Labor Matters") are
reps, not continuation covenants -- read and left out of this family,
still covered generically by `REPRESENTATIONS`.

### FINANCING_COVENANTS -- `6.17` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.17 | Certain Indebtedness | 11,208 | "(a)... the Company and its Subsidiaries shall use commercially reasonable efforts to deliver to Parent at least three (3) Business Days prior to the Closing Date a draft payoff letter (and, at least one (1) Business Day prior to the Closing Date, a payoff letter that has been executed by the applicable agent for the lenders thereunder)" |

There is no acquisition debt financing on this all-stock deal -- zero hits
anywhere in the filing for "Debt Commitment Letter", "Financing Sources"
or "Debt Financing". `6.17` is instead about paying off the Company's
*existing* credit facility and running note tender/exchange/consent
solicitations at Parent's direction and expense at Closing. Mapped here
on the strength of the family's own `PAYOFF_LEAD_TIME` assertion kind
(`financing-producer-prompt.js`), which exists specifically for payoff-letter
lead-time covenants of this shape, and on the direct precedent of
Skechers' `6.19` ("Repaid Indebtedness") being pinned to this same family
for the same reason. (The general-covenants codebook also has a `COV-DEBT`
/ `EXISTING_DEBT_COVENANTS` follow-on code that could plausibly claim this
section if dispatched under `GENERAL_COVENANTS` instead; `FINANCING_COVENANTS`
was chosen as the more specific, directly-registered family and the one
with precedent on this exact content shape.)

### GENERAL_COVENANTS -- `6.7`,`6.11`,`6.12`,`6.14`,`6.15`,`6.16`,`6.19`,`6.20` (8 sections, 8 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.7 | Access to Information | 5,621 | "the Company will afford Parent and its Representatives reasonable access" (mirrored for Parent elsewhere in the same section) |
| 6.11 | Transaction Litigation | 1,096 | "In the event any Proceeding by any Governmental Entity or other Person is commenced... that questions the validity or legality of the Transactions... the Company or Parent, as applicable, shall promptly notify the other Party" |
| 6.12 | Public Announcements | 2,411 | "The initial press release with respect to the execution of this Agreement shall be a joint press release... No Party shall... issue any public announcements... without the prior written approval of the other Party" |
| 6.14 | Reasonable Best Efforts; Notification | 1,984 | "each of the Parties shall use reasonable best efforts to take, or cause to be taken, all actions... to consummate and make effective, the Transactions" (general efforts covenant, not antitrust-specific -- `6.8` covers that) |
| 6.15 | Section 16 Matters | 607 | "Parent, Merger Sub and the Company shall take all such steps as may be required to cause any dispositions of equity securities... to be exempt" (Rule 16b-3) |
| 6.16 | Stock Exchange Listing and Delistings | 1,339 | "Parent shall take all action necessary to cause the Parent Common Stock to be issued in the Merger to be approved for listing on the NYSE" |
| 6.19 | Takeover Laws | 385 | "None of the Parties will take any action that would cause the Transactions to be subject to requirements imposed by any Takeover Laws" |
| 6.20 | Obligations of Merger Sub | 188 | "Parent shall take all action necessary to cause Merger Sub and the Surviving Corporation to perform their respective obligations under this Agreement" |

These map to the `GENERAL_COVENANT` codebook's own dedicated codes
(`COV-ACCESS`, `COV-LITNOTIFY`, `COV-PUBLICITY`, `COV-NOTIFY`, `COV-16B`,
`COV-DELIST`/`COV-LIST`, `COV-TAKEOVER`, `COV-MERGESUB` respectively) --
exactly the catch-all role this family's own prompt describes itself as
filling.

### INTERIM_OPERATING -- `6.1`, `6.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.1 | Conduct of Company Business Pending the Merger | 14,006 | ordinary-course affirmative/negative covenant, Company side |
| 6.2 | Conduct of Parent Business Pending the Merger | 7,065 | ordinary-course affirmative/negative covenant, Parent side (shorter -- ConocoPhillips is the much larger, continuing entity, so its own forbearance list is narrower) |

### KEY_DEFINED_TERMS -- `Annex-A` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| Annex-A | Certain Definitions | 39,440 | "'Company Competing Proposal' means..."; "'Company Intervening Event' means..."; "'Willful and Material Breach'... shall mean a material breach..."; "'Business Day' means..." |

Article I's `1.1` (179 bytes) is a single sentence pointing to Annex A;
`1.2` (2,966 bytes) is a "terms defined elsewhere" locator table (term ->
the section where it is *used*, not defined) -- neither carries the
definitions themselves, so neither is pinned here. All substantive defined
terms live in the `Annex-A` node.

### MAE_DEFINITION -- `Annex-A` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| Annex-A | Certain Definitions | 39,440 | "'Material Adverse Effect' means, when used with respect to any Party, any fact, circumstance, effect, change, event or development... that (a) would prevent, materially delay or materially impair the ability of such Party... to consummate the Transactions or (b) has, or would have, a material adverse effect on the financial condition, business, or results of operations of such Party..." followed by a nine-item carve-out proviso (general economic conditions, oil & gas industry conditions, COVID-19, etc.) |

This filing defines **one shared, party-agnostic "Material Adverse
Effect"** ("when used with respect to any Party") rather than two separate
"Company MAE"/"Parent MAE" definitions. `4.1` and `5.1` each merely
*label* the term when first invoked ("...a material adverse effect on the
Company (a 'Company Material Adverse Effect')") -- the actual definition
with its full carve-out list lives only in `Annex-A`, so that is the
section pinned, not `4.1`/`5.1`. Same 39,440-byte section as
`KEY_DEFINED_TERMS` and `TERMINATION_FEE` above/below -- worth flagging
for whoever runs this family live given the model-output-overflow
failures documented elsewhere in this corpus for sections in a similar
byte range.

### MATERIAL_CONTRACTS -- `4.19` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.19 | Material Contracts | 7,309 | "Schedule 4.19(a) of the Company Disclosure Letter... sets forth a true and complete list, as of the date of this Agreement, of: (i) each 'material contract' (as such term is defined in Item 601(b)(10) of Regulation S-K...)" |

One-sided: Article V (Parent reps, `5.1`-`5.19`) has no Material Contracts
rep at all -- read and confirmed absent, not an oversight. ConocoPhillips
gives no equivalent disclosure in this filing.

### MERGER_STRUCTURE_CLOSING -- `2.1`-`2.7` (7 sections, 7 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.1 | The Merger | 553 | "Merger Sub shall be merged with and into the Company" |
| 2.2 | Closing | 1,436 | closing date/mechanics |
| 2.3 | Effect of the Merger | 622 | statutory effects of the merger |
| 2.4 | Certificate of Incorporation of the Surviving Corporation | 475 | Annex B form adopted at Effective Time |
| 2.5 | Bylaws of the Surviving Corporation | 309 | bylaws provision |
| 2.6 | Directors and Officers of the Surviving Corporation | 549 | initial directors/officers of Surviving Corporation |
| 2.7 | Directors of Parent | 801 | "the size of the Parent Board is increased by one (1) member, and... the Company's current Chairman and Chief Executive Officer... is appointed to the Parent Board" |

`2.7` is a merger-of-equals-specific board seat grant absent from a plain
acquisition -- confirmed against the family's `DIRECTORS` assertion kind.

### MISC_BOILERPLATE -- `9.1`,`9.2`,`9.3`,`9.4`,`9.5`,`9.6`,`9.7`,`9.8`,`9.9`,`9.10`,`9.12`,`9.13` (12 sections, 12 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.1 | Schedule Definitions | 222 | "All capitalized terms in the Company Disclosure Letter and the Parent Disclosure Letter shall have the meanings ascribed to them herein (including in Annex A)" |
| 9.2 | Survival | 1,025 | survival of reps/covenants past Closing |
| 9.3 | Notices | 1,417 | notice mechanics/addresses |
| 9.4 | Rules of Construction | 6,805 | construction/interpretation rules |
| 9.5 | Counterparts | 451 | counterparts/electronic signature |
| 9.6 | Entire Agreement; No Third Party Beneficiaries | 1,101 | entire-agreement + TPB exception |
| 9.7 | Governing Law; Venue; Waiver of Jury Trial | 3,082 | "SHALL BE GOVERNED BY AND CONSTRUED IN ACCORDANCE WITH THE LAWS OF THE STATE OF DELAWARE... THE PARTIES IRREVOCABLY SUBMIT TO THE JURISDICTION OF THE COURT OF CHANCERY" |
| 9.8 | Severability | 1,373 | severability clause |
| 9.9 | Assignment | 492 | assignment restriction |
| 9.10 | Affiliate Liability | 1,332 | "No Company Affiliate shall have any liability or obligation to Parent or Merger Sub of any nature whatsoever... other than for fraud, and Parent and Merger Sub hereby waive and release all claims" (non-recourse-to-affiliates, mirrored for Parent Affiliates) |
| 9.12 | Amendment | 435 | amendment mechanics |
| 9.13 | Extension; Waiver | 1,487 | extension/waiver mechanics |

`9.10` ("Affiliate Liability") is this filing's non-recourse clause -- the
same role Skechers' `9.16` ("No Recourse") played, routed to the same
family there. It does not map cleanly onto any single `MISC_BOILERPLATE`
assertion kind (`GOVERNING_LAW | FORUM_FALLBACK | WAIVER_OR_SURVIVAL |
CONSTRUCTION_OR_EXPENSES | TPB_EXCEPTION | ASSIGNMENT_DETAIL | NOTICE`),
so it may publish few or zero governed facts from this call -- flagged,
not hidden. `9.11` ("Specific Performance") is deliberately excluded from
this list -- see `SPECIFIC_PERFORMANCE_REMEDIES` below.

### NO_OTHER_REPS_FRAUD -- `4.27`, `5.19` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.27 | No Additional Representations | 2,683 | "Except for the representations and warranties made in this Article IV, neither the Company nor any other Person makes any express or implied representation or warranty..." |
| 5.19 | No Additional Representations | 2,572 | Parent-side mirror of `4.27` |

### NO_SHOP -- `6.3`, `6.4` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.3 | No Solicitation by the Company | 20,274 | "the Company and its officers and directors will... immediately cease, and cause to be terminated, any discussion or negotiations with any Person... with respect to any inquiry, proposal or offer that constitutes... a Company Competing Proposal" |
| 6.4 | No Solicitation by Parent | 20,165 | mirror-image no-shop covenant running against Parent (this is a two-sided, merger-of-equals-shaped deal, not a one-sided acquisition) |

### PROXY_MEETING -- `6.5`, `6.6` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.5 | Preparation of Joint Proxy Statement and Registration Statement | 4,909 | "Parent will promptly furnish to the Company such data and information... for the purpose of including such data and information in the Joint Proxy Statement and any amendments or supplements thereto" |
| 6.6 | Stockholders Meetings | 10,245 | "The Company shall take all action necessary... to duly give notice of, convene and hold... a meeting of its stockholders for the purpose of obtaining the Company Stockholder Approval" |

Both companies hold a stockholder meeting off one Joint Proxy
Statement/Form S-4 (stock consideration requires Parent registration) --
`6.6`'s text covers both the Company's and Parent's meetings in one
section (verified by reading the whole section, not just its heading).

### REPRESENTATIONS -- all 46 Article IV + Article V sections (46 calls)

`4.1`-`4.27`, `5.1`-`5.19`. Same design already used elsewhere in this
table: this family extracts accuracy/knowledge qualifiers, orthogonal to
what topic families extract from the same sections, so overlap with
`CAPITALISATION` (`4.2`/`5.2`), `MATERIAL_CONTRACTS` (`4.19`), `TAX_MATTERS`
(`4.12`/`5.11`) and `NO_OTHER_REPS_FRAUD` (`4.27`/`5.19`) is intentional.
Every heading was confirmed against the sectionizer dump directly (see the
full ARTICLE/SECTION table above); representative spot-checks:

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.1 | Organization, Standing and Power | 1,626 | accuracy-qualified org rep, defines "Company Material Adverse Effect" label by cross-reference to the shared `Annex-A` definition |
| 4.17 | Oil and Gas Matters | 6,786 | "Except as would not reasonably be expected to have... a Company Material Adverse Effect... property... reflected in the Company Reserve Reports" (oil-and-gas-specific rep -- reserve reports, independent petroleum engineers; no registered family targets this topic specifically, so it is covered only generically here) |
| 4.16 | Rights-of-Way | 1,466 | another oil-and-gas-specific rep with no dedicated topic family |
| 5.16 | Ownership of Company Common Stock | 230 | Parent's own-stock-ownership rep |

This is the most expensive family in this pin by a wide margin (46 of the
~131 total projected calls across all 24 mapped families).

### SPECIFIC_PERFORMANCE_REMEDIES -- `9.11` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.11 | Specific Performance | 1,853 | "the Parties agree that irreparable damage, for which monetary damages would not be an adequate remedy, would occur... the Parties shall be entitled to an injunction or injunctions, or any other appropriate form of specific performance or equitable relief" |

### TAX_MATTERS -- `4.12`, `5.11`, `6.18` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.12 | Taxes | 5,590 | Company tax compliance rep |
| 5.11 | Taxes | 295 | "Neither Parent nor any of its Subsidiaries is aware of the existence of any fact... that would reasonably be expected to prevent or impede the Merger from qualifying as a 'reorganization' within the meaning of Section 368(a) of the Code" (narrow reorg-qualification-only rep, much shorter than the Company's full tax rep -- read and confirmed, not truncated) |
| 6.18 | Tax Matters | 1,273 | "Each of Parent, Merger Sub and the Company will... use its reasonable best efforts to cause the Merger to qualify... as a 'reorganization' within the meaning of Section 368(a) of the Code" (tax covenant) |

No standalone "Intended Tax Treatment" definition section exists (unlike
Skechers' `2.14`) -- the Section 368(a) reorganization intent is stated
directly in the rep and covenant text instead.

### TERMINATION -- `8.1`, `8.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.1 | Termination | 3,726 | full, self-contained termination grounds (a)-(f), including "(e) by Parent, if the Company... shall have Willfully and Materially Breached the obligations set forth in Section 6.3(b)" |
| 8.2 | Notice of Termination; Effect of Termination | 973 | "The Party terminating this Agreement... must deliver prompt written notice thereof" |

### TERMINATION_FEE -- `8.1`, `8.3`, `Annex-A` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.1 | Termination | 3,726 | states every fee-relevant ground with a real operative description (not a bare cross-reference the way Modiv's `7.1` was), e.g. "(c) by Parent, prior to... the time the Company Stockholder Approval is obtained, if the Company Board... shall have effected a Company Change of Recommendation" |
| 8.3 | Expenses and Other Payments | 10,635 | "(b) If Parent terminates this Agreement pursuant to Section 8.1(c) (Company Change of Recommendation) or Section 8.1(e) (No Solicitation by the Company), then the Company shall pay Parent the Company Termination Fee..." |
| Annex-A | Certain Definitions | 39,440 | "'Company Termination Fee' means $300,000,000." / "'Parent Termination Fee' means $450,000,000." / "'Company Expenses' means $142,500,000." |

Same "whole definitions annex, not a narrow sub-clause" pattern Modiv used
for its `8.12` pin -- the two termination-fee dollar figures live inside
the same 39,440-byte `Annex-A` node as every other defined term, and there
is no more specific sub-node the sectionizer resolves for just those two
definitions. `8.1` is included (not just `8.3`) because `8.3`'s fee
triggers are themselves cross-references into `8.1`'s termination
grounds -- same three-section shape as Modiv's `TERMINATION_FEE` pin
(trigger article + fee-mechanics section + definitions).

## 5. What was left unmapped

**`GUARANTY_FINANCING_PARTY` -- not mapped.** Zero hits anywhere in the
552,099-byte raw filing (and the 351,804-byte canonical text) for
"Guaranty", "Guarantee", "Financing Sources", "Debt Financing", "Debt
Commitment Letter", "Non-Recourse" or "No Recourse" (checked
programmatically, not by skimming). This is an all-stock strategic
combination between two public operating companies -- ConocoPhillips is
paying in its own stock, not borrowed cash, so there is no debt commitment
letter, no sponsor guaranty, and no financing-source non-recourse
provision to extract. Per this codebase's own standing note that "a
family returning zero can be correct", the honest action here is to leave
the family unmapped entirely (no section to point it at) rather than pin
it to the nearest unrelated text (`9.10`'s general non-recourse-to-affiliates
clause was considered and rejected for this role -- it protects
stockholders/directors/officers generally, not financing sources
specifically, and the family's own `FINANCING_PARTY_PROTECTION` mechanics
surface is scoped to lender/financing-source protection by the prompt's
own instructions).

## 6. Verification -- every mapped family, dry-run, real CLI

All 24 mapped families were run individually as
`node scripts/canonical-v2-live-extraction-run.mjs --deal concho --family
<NAME> --dry-run`, real CLI, real `resolveRunConfig`, real sectionizer,
zero model calls. **All 24 exited 0. None failed to resolve a section; no
`SECTION_REFERENCE_UNRESOLVED`, `SECTION_KIND_MISMATCH` or
`SECTION_HEADING_MISMATCH` occurred for any of them.**

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
| FINANCING_COVENANTS | 1 | 1 |
| GENERAL_COVENANTS | 8 | 8 |
| INTERIM_OPERATING | 2 | 2 |
| KEY_DEFINED_TERMS | 1 | 1 |
| MAE_DEFINITION | 1 | 1 |
| MATERIAL_CONTRACTS | 1 | 1 |
| MERGER_STRUCTURE_CLOSING | 7 | 7 |
| MISC_BOILERPLATE | 12 | 12 |
| NO_OTHER_REPS_FRAUD | 2 | 2 |
| NO_SHOP | 2 | 2 |
| PROXY_MEETING | 2 | 2 |
| REPRESENTATIONS | 46 | 46 |
| SPECIFIC_PERFORMANCE_REMEDIES | 1 | 1 |
| TAX_MATTERS | 3 | 3 |
| TERMINATION | 2 | 2 |
| TERMINATION_FEE | 3 | 3 |
| **Total (24 families)** | **106** | **106** |
| `GUARANTY_FINANCING_PARTY` | unmapped | 0 |

Sample (`TERMINATION_FEE`):

```
[extraction:concho:TERMINATION_FEE] resolved 8.1: heading="Termination" start=273223 end=276949 bytes=3726
[extraction:concho:TERMINATION_FEE] resolved 8.3: heading="Expenses and Other Payments" start=277922 end=288557 bytes=10635
[extraction:concho:TERMINATION_FEE] resolved Annex-A: heading="Certain Definitions" start=309662 end=349102 bytes=39440
[extraction:concho:TERMINATION_FEE] DRY RUN complete: projected_model_call_count=3. Stopping before any model call.
```

Full per-family dry-run transcripts (all 24) are in
`/tmp/claude-0/-home-user-precedent-machine/3942dbbb-1014-51f3-a689-d0286bab5211/scratchpad/concho-dryrun-results.log`
(scratch, not committed).

## 7. Gates

- `CI=true node --test tests/canonical-v2-general-extraction-runner.test.js`
  -- **32/32 pass, exit 0.**
- `bash scripts/lint/forbidden-patterns.sh` -- **`INVARIANT-4: PASS`, exit 0.**

## 8. Scope discipline

Only `scripts/canonical-v2-live-extraction-run.mjs` (the new
`DEAL_PINS.concho` entry) and this note were edited, as instructed. The two
fixture files this task's own deliverable depended on but that were
missing from this worktree's branch
(`tests/fixtures/canonical-v2/concho-first-live-run/concho-raw-fetched.htm`
and `docs/codex-program/notes/four-deal-sources-2026-08-08.md`) were pulled
in from the commit that originally added them and independently
byte-verified before use -- see "Fixture note" in section 1. No live
extraction calls were made -- every verification above is `--dry-run` or a
read. Nothing under `lib/canonical-v2/**` or `evidence/**` was touched.
Nothing was committed, nothing was pushed.
