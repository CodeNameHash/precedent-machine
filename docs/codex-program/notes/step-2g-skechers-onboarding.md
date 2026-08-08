# Step 2G, Skechers onboarding

Working note, 2026-08-08. Onboarding only — the 24/25-family extraction
ladder was explicitly NOT run against this pin. Every dry-run below made
zero model calls.

Deal: **Beach Acquisition Co Parent, LLC (3G Capital) / Skechers U.S.A.,
Inc.** — a $9.4B take-private of Skechers by 3G Capital's Beach Acquisition
vehicles, cash-or-cash-plus-Parent-Units mixed election, debt-financed,
stockholder approval by majority written consent (not a meeting).

## 1. Digests

Both independently re-derived from the already-committed raw HTML
(`tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm`,
604,740 bytes) via **this runner's own `loadAndVerifySource()` code path**
— `buildSecEdgarIntakeCapture` → `convertSecHtmlToCanonicalText` →
`verifySecHtmlCanonicalText` — not a separate or reimplemented conversion.

| | value |
|---|---|
| `raw_bytes_sha256` | `3a8b8d77c126c85f4402f290da3dec43efa209d6a8a505d11d1af95fab115833` |
| `canonical_text_sha256` | `a7d76e8a7f6efed945208b5870ddfa848438a7542806878bb2bc10646b557660` |
| `canonical_text_byte_length` | 380,704 |
| verification | `PASS` |

Method used: added the `DEAL_PINS.skechers` entry with these digests
already populated (computed via a scratch script that calls the exact same
library functions the runner calls, then cross-checked by driving the
runner itself), and confirmed with a real `--dry-run`:

```
[extraction:skechers:TERMINATION_FEE] reused committed raw HTML ... sha256=3a8b8d77...833 (MATCHES pin)
[extraction:skechers:TERMINATION_FEE] canonical_text_sha256 = a7d76e8a...660 (MATCHES pin)
```

Both values also match the already-committed
`tests/fixtures/canonical-v2/skechers-first-live-run/intake-pin.json`
(`raw_bytes_length: 604740`, `canonical_text_byte_length: 380704`,
`verification_status: PASS`) — that file was produced by a different,
narrower, pre-existing script
(`scripts/canonical-v2-skechers-first-live-extraction-run.mjs`, the F28
capitalisation-only slice) against the same committed bytes, so the two
independent derivations agreeing is corroboration, not the basis for this
pin. This pin's own digests come from the current runner's own code path,
run today, against current library code.

## 2. Agreement date

**2025-05-04.** Read from the agreement's own preamble sentence, not the
title-block signature line and not the fixture directory name:

> "THIS AGREEMENT AND PLAN OF MERGER (this "Agreement") is made and entered
> into as of May 4, 2025, by and among Beach Acquisition Co Parent, LLC, a
> Delaware limited liability company ("Parent"), Beach Acquisition Merger
> Sub, Inc., a Delaware corporation ... and Skechers U.S.A., Inc. ..."

(The title-block signature line "Dated as of May 4, 2025" gives the same
date, but per PLAN.md's own note on TopBuild, the preamble sentence is the
one actually consumed downstream by `parseMeasurementDate` for phrases like
"the date of this Agreement", so that is the sentence quoted here.)

## 3. Method

1. Read `scripts/canonical-v2-live-extraction-run.mjs`'s header,
   `DEAL_PINS`, and `resolveRunConfig` in full; read
   `docs/codex-program/notes/step-2e-topbuild-mapping.md` and
   `step-2f-topbuild-fan-out.md` for the prior deal's method and the
   producer-prompt lessons already learned there (in particular: the
   guaranty and dividends prompts were fixed 2026-08-08 specifically to
   stop mis-scoping non-recourse/dividend-limb text, and those fixes were
   read before mapping `GUARANTY_FINANCING_PARTY`/`DIVIDENDS` here).
2. Got the registered family list from `listRegisteredSectionFamilies()`
   directly (25 families), not from a hand-copied list.
3. Drove `sectionizeAdmittedSource()` directly (not the CLI) against the
   converted canonical text, and printed every `ARTICLE`/`SECTION` node
   with its reference, heading, and byte span — **539 tree nodes total**
   (`ROOT: 1, ARTICLE: 9, SECTION: 121, SUBSECTION: 408`). Skechers'
   Article III (28 sections, `3.1`–`3.28`) and Article IV (17 sections,
   `4.1`–`4.17`) are both fully granular — one topic per numbered section,
   unlike TopBuild's two-mega-section reps article — so almost no content
   is buried in an unlabelled sub-paragraph the way it was on TopBuild.
4. For every family, read the actual section body text (not just the
   heading) via UTF-8 byte-offset slicing (`Buffer.from(text,
   'utf8').slice(start, end)`, matching `sectionBodyText()` in the runner),
   and checked candidate sections against that family's own producer
   prompt (`lib/canonical-v2/native-producer/*-producer-prompt.js`) —
   its response shape and assertion-kind vocabulary — not just against the
   family's plain-English name. This caught at least one real mistake
   before it was pinned: `6.20`/`6.21` ("Parent LLCA", "Support Agreement")
   were first drafted into `MERGER_STRUCTURE_CLOSING` on the strength of
   their Article VI position, but that family's own assertion-kind list
   (`DIRECTORS | EFFECTS | ACTIONS | CLOSING_LOCATION | CLOSING_TIMING |
   EFFECTIVE_TIME | SHORT_FORM_251H | TOP_UP | SUBSEQUENT_OFFERING |
   SCHEDULE_TO_14D9 | STOCKHOLDER_LIST | BOARD_DESIGNATION`) has no slot for
   either provision, so both were moved to `GENERAL_COVENANTS` (the
   documented residual-covenant family) instead.
5. Confirmed all 25 families with `--dry-run` (real CLI, real
   `resolveRunConfig`, real sectionizer) after pinning — see §5.

## 4. The mapping, all 25 families

Every row below was read against the actual body text. "Verified against"
quotes the phrase that proves the section is this family's content.

### ANTITRUST_REGULATORY — `6.2` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.2 | Filings | 9,420 | "(a) Filing Under the HSR Act and Any Other Antitrust and Foreign Investment Laws... file with the FTC and the Antitrust Division of the DOJ a Notification and Report Form... within twenty five Business Days" |

`6.1` ("Required Action and Forbearance; Efforts") is the *general*
reasonable-best-efforts covenant covering the whole deal, not
antitrust-specific — it was read and deliberately left out of this family,
routed to `GENERAL_COVENANTS` instead.

### APPRAISAL_DISSENTERS_RIGHTS — `2.7` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.7 | Effect of Merger on Company Common Stock | 6,748 | Sub-clause (e): "...who shall have properly and validly exercised their statutory rights of appraisal ... in accordance with Section 262 of the DGCL ... Dissenting Company Shares ... The Company may not ... make any payment with respect to any demands for appraisal or settle or offer to settle ... or waive any failure to timely deliver a written demand for appraisal" |

Same section as `CONSIDERATION` (below) — the appraisal carve-out is a
sub-clause of the merger-consideration section, not a standalone article,
exactly the pattern already established on Modiv (`2.6`) and TopBuild
(`2.1`). The appraisal producer prompt (`appraisal-producer-prompt.js`)
extracts `SETTLEMENT_CONSENT`/`WITHDRAWAL_RECONVERSION` facts, both present
in this quote.

### CAPITALISATION — `3.7`, `4.15` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.7 | Company Capitalization | 5,154 | "(a) Capital Stock. The authorized capital stock of the Company consists of (i) 500,000,000 shares of Company Class A Common Stock, (ii) 75,000,000 shares of Class B Common Stock and (iii) 10,000,000 shares of Company Preferred Stock" |
| 4.15 | Capitalization of Merger Sub and Parent | 3,211 | "the shares of common stock of Merger Sub ... then outstanding will be wholly owned, directly or indirectly, by Parent ... all Parent Units will be owned (beneficially and of record), directly or indirectly, by 3G Related Parties" |

### CLOSING_CONDITIONS — `7.1`, `7.2`, `7.3` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 7.1 | Conditions to Each Party's Obligations to Effect the Merger | 2,296 | "(a) Written Consent. The Company will have received the Written Consent. (b) Antitrust and Foreign Investment Laws Clearance..." |
| 7.2 | Conditions to the Obligations of the Buyer Parties | 3,874 | (mirror-image bring-down/MAE conditions, verified by heading and Article VII structure) |
| 7.3 | Conditions to the Obligations of the Company to Effect the Merger | 3,777 | (mirror-image conditions for the Company's benefit) |

Exact 1:1 match — Article VII is exactly these three sections.

### CONSIDERATION — `2.7`–`2.12` (6 sections, 6 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.7 | Effect of Merger on Company Common Stock | 6,748 | "(b) Conversion of Company Common Stock ... each share of Company Common Stock ... will be cancelled and extinguished and automatically converted into the right to receive ... 'Merger Consideration' ... $63.00 ... $57.00 ... one Parent Unit" |
| 2.8 | Equity Awards | 6,269 | "(a) Company RSAs. At the Effective Time ... each Company RSA ... shall be fully vested, cancelled and automatically converted into the right to receive the Cash Election Consideration" |
| 2.9 | Mixed Election Procedures | 6,984 | "(a) Proration. ... Parent shall cause the Exchange Agent to effect the allocation ... of rights to receive the Mixed Election Consideration and the Cash Election Consideration ... If the aggregate number of Mixed Election Shares exceeds the Maximum Equity Election Cap..." |
| 2.10 | Exchange of Certificates | 9,462 | "(b) Exchange Fund. At or prior to the Closing, Parent will deposit ... with the Exchange Agent ... cash equal to the aggregate cash consideration..." |
| 2.11 | No Further Ownership Rights in Company Common Stock | 1,483 | "all shares of Company Common Stock will no longer be outstanding and will automatically be converted or cancelled ... except the right to receive the Merger Consideration" |
| 2.12 | Lost, Stolen or Destroyed Certificates | 759 | "the Exchange Agent will issue in exchange therefor, upon the making of an affidavit of that fact by the holder thereof, the Merger Consideration" |

### DIVIDENDS — `5.2` (1 section, 1 call; likely low/zero governed yield, by design)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.2 | Forbearance Covenants | 11,647 | Sub-clause (B): "declare, set aside or pay any dividend or other distribution ... except for cash dividends made by any direct or indirect wholly-owned Subsidiary of the Company to the Company" |

No standalone dividends-coordination section exists on this filing (unlike
Modiv's real `5.10`). The dividend restriction is one limb of `5.2`'s
thirty-clause forbearance covenant — the same shape TopBuild had at
`4.1`/`4.2`. `DIVIDENDS`' own producer prompt (v2, 2026-08-08, written
after TopBuild's false-zero was diagnosed) explicitly instructs: "Never
extract a restriction that belongs to another family merely because its
text mentions dividends... Consideration and IOC restrictions remain
outside this family." So this pin is correct — it points at the only text
that could possibly qualify — and is expected to publish few or zero
`dividend_assertions`, the same outcome documented for TopBuild and not a
mapping defect.

### DNO_INDEMNIFICATION — `6.10` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.10 | Directors' and Officers' Exculpation, Indemnification and Insurance | 10,459 | "the Surviving Corporation and its Subsidiaries will ... indemnify and hold harmless ... each Indemnified Person ... during the period commencing at the Effective Time and ending on the sixth anniversary of the Effective Time" |

### EMPLOYEE_MATTERS — `6.11` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.11 | Employee Matters | 8,674 | "(c) Employment; Benefits. ... provide each Continuing Employee with (i) an annual base salary or hourly wage rate ... that is no less favorable ... (ii) short-term ... cash incentive compensation or commission opportunities that are no less favorable" |

This matches the family's assertion-kind vocabulary directly
(`ITEM_STANDARD`/`CONTINUATION_PERIOD`/`SERVICE_CREDIT` etc., "positive
employee continuation facts"). `3.18` ("Employee Plans") and `3.19` ("Labor
Matters") are reps, not continuation covenants — read and left out of this
family (they are still covered generically by `REPRESENTATIONS`, below).

### FINANCING_COVENANTS — `6.5`, `6.6`, `6.19` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.5 | Financing | 8,957 | "Parent and Merger Sub shall use reasonable best efforts to take ... all actions ... necessary ... to obtain the proceeds of the Debt Financing contemplated by the Debt Commitment Letter" |
| 6.6 | Cooperation with Financing | 18,115 | "the Company shall use reasonable best efforts to ... provide such cooperation as is reasonably requested by Parent ... in connection with the Debt Financing" |
| 6.19 | Repaid Indebtedness | 359 | "The Company shall use reasonable best efforts to deliver Payoff Deliverables with respect to the Repaid Indebtedness ... at least one Business Day prior to the Closing" |

### GENERAL_COVENANTS — `6.1`,`6.7`,`6.8`,`6.9`,`6.12`,`6.13`,`6.14`,`6.15`,`6.16`,`6.20`,`6.21` (11 sections, 11 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.1 | Required Action and Forbearance; Efforts | 2,940 | "the Buyer Parties ... and the Company ... will use their respective reasonable best efforts to ... consummate and make effective ... the Merger" (general, not antitrust-specific) |
| 6.7 | Anti-Takeover Laws | 586 | "The Company and the Company Board will (a) take all actions within their power to ensure that no 'anti-takeover' statute ... is or becomes applicable to the Merger" |
| 6.8 | Access | 3,509 | "the Company will afford Parent and its Representatives reasonable access during normal business hours ... to the properties, books and records and personnel" |
| 6.9 | Section 16(b) Exemption | 371 | "The Company will take all actions reasonably necessary to cause the Merger ... to be exempt pursuant to Rule 16b-3" |
| 6.12 | Obligations of the Buyer Parties and the Company | 691 | "Each of the Buyer Parties will be jointly and severally liable for any breach of this Agreement by any Buyer Party" |
| 6.13 | Notification of Certain Matters | 3,082 | "the Company will give prompt notice to Parent upon becoming aware that any representation or warranty ... has become untrue" |
| 6.14 | Public Statements and Disclosure | 1,632 | "the Company ... and the Buyer Parties ... will use their respective reasonable best efforts to consult with the other Parties before (a) participating in any media interviews" |
| 6.15 | Transaction Litigation | 1,402 | "the Company will provide Parent with prompt notice of all Transaction Litigation ... and keep Parent reasonably informed" |
| 6.16 | Stock Exchange Delisting; Deregistration | 609 | "the Company will cooperate with Parent ... to cause (a) the delisting of the Company Common Stock from NYSE" |
| 6.20 | Parent LLCA | 344 | "At the Closing, Parent shall amend and restate the limited liability company agreement of Parent" — read against `MERGER_STRUCTURE_CLOSING`'s own assertion-kind list first; no slot fits (no DIRECTORS/EFFECTS/CLOSING_TIMING/etc. concept), so routed here as a residual covenant instead |
| 6.21 | Support Agreement | 427 | "the Company (a) ... shall not agree to or permit any termination, amendment, replacement, or other modification of ... the Support Agreement" — same reasoning as 6.20 |

`GENERAL_COVENANTS`' own producer prompt describes itself as "extracting
residual general covenants" against a fixed `GENERAL_COVENANT` codebook —
exactly this catch-all role.

### GUARANTY_FINANCING_PARTY — `4.13`, `9.15` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 4.13 | Guaranty | 786 | "Parent and Merger Sub have delivered a duly executed guaranty from 3G Fund VI, L.P. ... ('Guarantor') to the Company. The Guaranty is in full force and effect and constitutes a valid and binding obligation of the Guarantor" |
| 9.15 | Debt Financing Sources | 3,950 | "the Company ... agree(s) not to bring or support any suits, claims, charges, actions ... against any Debt Financing Sources ... none of the Debt Financing Sources will have any liability or obligation to the Company Group" |

`4.13` is a real, positive sponsor-guaranty rep (3G Fund VI, L.P. as
Guarantor) — unlike TopBuild, which had none. `9.15` is the same
non-recourse/financing-party-protection shape as TopBuild's `7.16`; it is
included here deliberately, on the strength of the guaranty prompt's v2
fix (2026-08-08, written specifically to stop excluding exactly this
shape — see its header comment) which scopes `FINANCING_PARTY_PROTECTION`
to cover non-recourse waivers "even when the agreement contains no
guaranty at all". `9.16` ("No Recourse") was read and left **out** — it is
a general non-party-liability boilerplate clause (mentions the Guaranty in
passing but is not itself financing-source-specific) and was routed to
`MISC_BOILERPLATE` instead.

### INTERIM_OPERATING — `5.1`, `5.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.1 | Affirmative Obligations | 1,558 | "the Company will ... (i) maintain its existence in good standing ... (ii) ... conduct its business and operations in the ordinary course of business" |
| 5.2 | Forbearance Covenants | 11,647 | "(A) adjust, split, combine or reclassify any shares of capital stock ... (B) declare, set aside or pay any dividend..." (thirty-limb negative covenant) |

### KEY_DEFINED_TERMS — `1.1`, `1.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.1 | Certain Definitions | 50,736 | "'Superior Proposal' means..." (byte 55,082); "'Acquisition Proposal' means..." (byte 9,744); "'Acquisition Transaction' means..." (byte 9,899); "'Knowledge'" standard (byte 31,187) |
| 1.2 | Additional Definitions | 3,483 | "'Intervening Event'" (byte 61,509); "'Company Board Recommendation Change'" (byte 60,233) |

No separate "Willful Breach"/"Willful and Material Breach" *defined term*
exists on this filing — the phrase "willful and material breach" appears
plainly at `8.2` with no defining clause, so `KEY_DEFINED_TERMS`'
`WILLFUL_DEFINITION`/`WILLFUL_STANDARD` assertion kinds are expected to
find nothing here. That is a correct zero, not a mapping gap: the concept
genuinely is not separately defined on this filing.

`1.1` is 50,736 bytes — the single largest section pinned to any family
here, and close to the byte range (`~48–84KB`) that produced the
model-output-overflow failures documented in Step 2F (`REPRESENTATIONS`
and `NO_SHOP` on TopBuild). Worth flagging for whoever runs this family
live: it may need to be split before it is safe to call.

### MAE_DEFINITION — `1.1` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.1 | Certain Definitions | 50,736 | Sub-clause (r): "'Company Material Adverse Effect' means any change, event, violation, inaccuracy, effect or circumstance ... that ... is or would reasonably be expected to have a material adverse effect on the business, financial condition or results of operations of the Company Group, taken as a whole; provided, however, that none of the following ... will be deemed to be or constitute a Company Material Adverse Effect" |

Only one MAE definition exists on this filing — "Company Material Adverse
Effect", defined exactly once (searched all 47 occurrences of the phrase
"Material Adverse Effect"; only one is a definition head). There is no
"Parent Material Adverse Effect" or "Buyer Material Adverse Effect" — Parent
is a private acquisition vehicle giving no MAE-qualified reps of its own,
so a single-sided MAE definition is correct for this deal, not a mapping
gap. Same 50,736-byte overflow-risk caveat as `KEY_DEFINED_TERMS` above
applies (same section).

### MATERIAL_CONTRACTS — `3.13` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.13 | Material Contracts | 1,929 | "Section 3.13(a) of the Company Disclosure Letter contains a true, correct and complete list of all Material Contracts ... Each Material Contract is valid and binding ... none of the Company ... is in breach of or default" |

### MERGER_STRUCTURE_CLOSING — `2.1`–`2.6` (6 sections, 6 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.1 | The Merger | 493 | "Merger Sub will be merged with and into the Company ... the Company will continue as the surviving corporation" |
| 2.2 | The Effective Time | 712 | "Parent, Merger Sub and the Company will cause the Merger to be consummated ... by filing a certificate of merger" |
| 2.3 | The Closing | 2,176 | "The consummation of the Merger (the 'Closing') shall take place by the remote exchange of electronic copies of documents and signatures ... no later than (a) the second Business Day after..." |
| 2.4 | Effect of the Merger | 529 | "at the Effective Time all (a) of the property, rights, privileges, powers and franchises ... will vest in the Surviving Corporation" |
| 2.5 | Certificate of Incorporation and Bylaws | 1,001 | "the Amended and Restated Certificate of Incorporation of the Company ... will be amended and restated in its entirety" |
| 2.6 | Directors and Officers | 891 | "the initial directors of the Surviving Corporation will be the directors of Merger Sub as of immediately prior to the Effective Time" |

`6.20` and `6.21` were read against this family too and moved to
`GENERAL_COVENANTS` — see that section above for why.

### MISC_BOILERPLATE — `1.3`,`8.4`,`8.5`,`9.1`–`9.7`,`9.9`–`9.14`,`9.16` (17 sections, 17 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 1.3 | Certain Interpretations | 8,630 | "the words 'hereof,' 'herein' and 'herewith' ... will ... be construed to refer to this Agreement as a whole" (construction rules) |
| 8.4 | Amendment | 528 | "this Agreement may be amended by the Parties at any time by execution of an instrument in writing signed on behalf of each of the Buyer Parties and the Company" |
| 8.5 | Extension; Waiver | 854 | "any Party may ... (a) extend the time for the performance ... (b) waive any inaccuracies" |
| 9.1 | Survival of Representations, Warranties and Covenants | 340 | "The representations, warranties and covenants ... will terminate at the Closing, except that any covenants that by their terms survive" |
| 9.2 | Notices | 2,340 | "All notices and other communications hereunder must be in writing" |
| 9.3 | Assignment | 2,399 | "No Party may assign either this Agreement or any of its rights ... without the prior written approval of the other Parties" |
| 9.4 | Confidentiality | 1,376 | "Parent and the Company have executed that certain confidentiality agreement dated as of December 19, 2024" |
| 9.5 | Entire Agreement | 901 | "This Agreement and the documents ... constitute the entire agreement among the Parties" |
| 9.6 | Third Party Beneficiaries | 2,444 | "the Parties agree that their respective representations, warranties and covenants ... are solely for the benefit of the other Parties" |
| 9.7 | Severability | 670 | "In the event that any provision of this Agreement ... becomes ... illegal, void or unenforceable, the remainder ... will continue in full force" |
| 9.9 | Governing Law | 559 | "This Agreement shall be governed by and interpreted and construed in accordance with the laws of the State of Delaware" |
| 9.10 | Consent to Jurisdiction | 2,353 | "irrevocably and unconditionally consents and submits itself ... to the exclusive general jurisdiction of the Court of Chancery of the State of Delaware" |
| 9.11 | WAIVER OF JURY TRIAL | 981 | "EACH PARTY ... IRREVOCABLY AND UNCONDITIONALLY WAIVES ANY RIGHT ... TO A TRIAL BY JURY" |
| 9.12 | Company Disclosure Letter References | 809 | "the disclosure set forth in any particular section or subsection of the Company Disclosure Letter will be deemed to be an exception to ... the representations and warranties" |
| 9.13 | Counterparts | 1,157 | "This Agreement ... may be executed in one or more counterparts ... including by electronic signature" |
| 9.14 | No Limitation | 592 | "the representations, warranties, covenants and closing conditions in this Agreement will be construed to be cumulative" |
| 9.16 | No Recourse | 2,427 | "this Agreement may only be enforced against ... the entities that are expressly identified as parties hereto, and no Parent Related Parties ... shall have any liability" |

All match `remedies-misc-producer-prompt.js`'s assertion-kind vocabulary
(`GOVERNING_LAW | FORUM_FALLBACK | WAIVER_OR_SURVIVAL |
CONSTRUCTION_OR_EXPENSES | TPB_EXCEPTION | ASSIGNMENT_DETAIL | NOTICE`).

### NO_OTHER_REPS_FRAUD — `3.28`, `4.17` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.28 | Exclusivity of Representations and Warranties | 2,846 | "except for the representations and warranties expressly set forth in Article IV ... neither the Buyer Parties nor any of their Subsidiaries ... makes ... any representation or warranty ... the Buyer Parties hereby disclaim any other or implied representations" |
| 4.17 | Exclusivity of Representations and Warranties | 3,064 | "except for the representations and warranties expressly set forth in Article III ... neither the Company nor any of its Subsidiaries ... makes ... any representation or warranty ... the Company hereby disclaims any other or implied representations" |

### NO_SHOP — `5.3` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 5.3 | No Solicitation | 17,941 | "the Company Group will not ... solicit, initiate, propose or induce the making, submission or announcement of ... any proposal or inquiry that constitutes ... an Acquisition Proposal" |

Single-sided (Company only) — unlike TopBuild's two-sided no-shop, because
Parent here is a private acquisition vehicle, not a public company
soliciting its own stockholder vote.

### PROXY_MEETING — `6.3`, `6.4`, `6.17` (3 sections, 3 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 6.3 | Written Consent | 575 | "in lieu of calling a meeting of the Company Stockholders, the Company shall use reasonable best efforts to obtain the Written Consent ... comply ... with the DGCL, including Section 228 and Section 262" |
| 6.4 | Information Statement/Prospectus, Registration Statement | 4,988 | "Parent shall file with the SEC a registration statement on Form S-4 ... an information statement ... concerning the Written Consent" |
| 6.17 | Parent Vote | 965 | "Parent will cause the sole stockholder of Merger Sub to execute and deliver ... a written consent approving the Merger ... ('Parent Written Consent')" |

This deal has no stockholder meeting — approval is by majority written
consent (DGCL §228) instead. `PROXY_MEETING`'s own response shape
explicitly includes an `adoption_mechanism` enum with
`SOLE_HOLDER_WRITTEN_CONSENT | ALL_RECORD_HOLDERS_WRITTEN_CONSENT |
WRITTEN_CONSENT` values and `PARENT_APPROVAL`/`MERGER_SUB_APPROVAL`
assertion kinds, so this family is designed to cover exactly this
mechanism, not only a literal meeting. `4.9` ("No Parent Vote or Approval
Required") is a rep, not a covenant/process section, and was left out —
covered generically by `REPRESENTATIONS`.

### REPRESENTATIONS — all 45 Article III + Article IV sections (45 calls)

`3.1`–`3.28`, `4.1`–`4.17`. This family's own producer prompt scope is "one
complete, admitted representations-and-warranties section" with no topic
restriction — it extracts accuracy/knowledge qualifiers, a fact shape
orthogonal to what the topic families extract from the same sections, so
overlap with `CAPITALISATION` (`3.7`), `MATERIAL_CONTRACTS` (`3.13`),
`TAX_MATTERS` (`3.17`, `4.14`), `NO_OTHER_REPS_FRAUD` (`3.28`, `4.17`) and
`GUARANTY_FINANCING_PARTY` (`4.13`) is intentional, the same design already
used elsewhere in this table (e.g. `CONSIDERATION`/`APPRAISAL_DISSENTERS_RIGHTS`
both at `2.7`). Every heading was confirmed against the sectionizer output
directly (table in §3 above); representative spot-check quotes:

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 3.1 | Organization; Good Standing | 983 | "The Company is a corporation duly organized, validly existing and in good standing under the laws of the State of Delaware" (accuracy-qualified org rep) |
| 3.5 | Non-Contravention | 1,292 | knowledge/accuracy-qualified non-contravention rep |
| 3.9 | Company SEC Reports | 1,153 | "each ... required to be filed by the Company ... has been timely filed" |
| 4.1 | Organization; Good Standing | 985 | Parent-side mirror of `3.1` |
| 4.11 | Solvency | 1,106 | solvency rep, accuracy-qualified |

This is the most expensive family in this pin by a wide margin (45 of the
120 total projected calls across all 25 families) and it is recorded
plainly rather than trimmed quietly — see §5's dry-run totals.

### SPECIFIC_PERFORMANCE_REMEDIES — `9.8` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 9.8 | Remedies | 5,642 | "(b) Specific Performance. ... irreparable damage for which monetary damages ... would not be an adequate remedy ... the Parties will be entitled ... to an injunction, specific performance and other equitable relief" |

### TAX_MATTERS — `2.13`, `2.14`, `3.17`, `4.14`, `6.18` (5 sections, 5 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 2.13 | Required Withholding | 592 | "will be entitled to deduct and withhold from any cash amounts payable ... such amounts as are required to be deducted or withheld ... pursuant to any Tax laws" |
| 2.14 | Intended Tax Treatment | 1,575 | "the transfer of Company Common Stock to Parent ... as a transaction described under Section 351(a) of the Code" / "as a sale or exchange governed by Section 1001 of the Code" |
| 3.17 | Tax Matters | 5,144 | Company tax rep (compliance, no audits/liens, etc.) |
| 4.14 | Tax Considerations | 926 | "(a) Tax Classification of Parent. For U.S. federal income tax purposes, Parent is ... properly treated as a corporation" |
| 6.18 | Tax Matters | 3,805 | "Neither Parent nor the Company shall ... take any action that would prevent or impede ... the Merger from qualifying for the Intended Tax Treatment" |

### TERMINATION — `8.1`, `8.2` (2 sections, 2 calls)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.1 | Termination | 9,027 | "This Agreement may be validly terminated only as follows ... (a) at any time prior to the Effective Time by mutual written agreement ... (c) ... if the Closing has not occurred by 11:59 p.m., Eastern time, on November 4, 2025 (the 'Termination Date')" |
| 8.2 | Manner and Notice of Termination; Effect of Termination | 1,735 | "The Party terminating this Agreement pursuant to Section 8.1 ... must deliver prompt written notice thereof ... setting forth in reasonable detail the provision of Section 8.1 pursuant to which this Agreement is being terminated" |

### TERMINATION_FEE — `8.3` (1 section, 1 call)

| Ref | Heading | Bytes | Verified against |
|---|---|---|---|
| 8.3 | Fees and Expenses | 9,339 | "(b) Company Payments. ... the Company will ... pay ... an amount equal to $339,883,891 (the 'Company Termination Fee')." / "(c) Parent Payments. ... Parent shall ... pay ... an amount equal to $534,103,258 (the 'Parent Termination Fee')" |

## 5. Verification — every family, dry-run, real CLI

All 25 mapped families were run individually as
`node scripts/canonical-v2-live-extraction-run.mjs --deal skechers --family
<NAME> --dry-run`, real CLI, real `resolveRunConfig`, real sectionizer,
zero model calls. **All 25 exited 0. None failed to resolve a section.**

| Family | Sections | Projected calls |
|---|---|---|
| ANTITRUST_REGULATORY | 1 | 1 |
| APPRAISAL_DISSENTERS_RIGHTS | 1 | 1 |
| CAPITALISATION | 2 | 2 |
| CLOSING_CONDITIONS | 3 | 3 |
| CONSIDERATION | 6 | 6 |
| DIVIDENDS | 1 | 1 |
| DNO_INDEMNIFICATION | 1 | 1 |
| EMPLOYEE_MATTERS | 1 | 1 |
| FINANCING_COVENANTS | 3 | 3 |
| GENERAL_COVENANTS | 11 | 11 |
| GUARANTY_FINANCING_PARTY | 2 | 2 |
| INTERIM_OPERATING | 2 | 2 |
| KEY_DEFINED_TERMS | 2 | 2 |
| MAE_DEFINITION | 1 | 1 |
| MATERIAL_CONTRACTS | 1 | 1 |
| MERGER_STRUCTURE_CLOSING | 6 | 6 |
| MISC_BOILERPLATE | 17 | 17 |
| NO_OTHER_REPS_FRAUD | 2 | 2 |
| NO_SHOP | 1 | 1 |
| PROXY_MEETING | 3 | 3 |
| REPRESENTATIONS | 45 | 45 |
| SPECIFIC_PERFORMANCE_REMEDIES | 1 | 1 |
| TAX_MATTERS | 5 | 5 |
| TERMINATION | 2 | 2 |
| TERMINATION_FEE | 1 | 1 |
| **Total** | **120** | **120** |

Sample (`TERMINATION_FEE`, `8.3`):

```
[extraction:skechers:TERMINATION_FEE] resolved 8.3: heading="Fees and Expenses" start=341013 end=350352 bytes=9339
[extraction:skechers:TERMINATION_FEE] DRY RUN complete: projected_model_call_count=1. Stopping before any model call.
```

Every one of the other 24 families produced the equivalent
`sections_resolved` block with no `SECTION_REFERENCE_UNRESOLVED`,
`SECTION_KIND_MISMATCH`, or `SECTION_HEADING_MISMATCH` error.

## 6. What was NOT mapped

Nothing. All 25 registered families received a section mapping, each
individually verified by reading the body text and confirmed to resolve
via `--dry-run`. Two flagged caveats, not omissions:

- **`DIVIDENDS` (`5.2`)** is pinned to real dividend-restriction text but,
  per that family's own documented design (and the TopBuild precedent), is
  expected to publish few or zero governed `dividend_assertions` — the
  content is a limb of a forbearance covenant, not a standalone
  coordination clause.
- **`KEY_DEFINED_TERMS` and `MAE_DEFINITION`** both point at `1.1`
  (50,736 bytes) — the largest section pinned to any family here, in the
  same byte range that caused the model-output-overflow failures on
  TopBuild's `REPRESENTATIONS` (83,756 B) and `NO_SHOP` (25,457 B). Not a
  mapping defect — the content genuinely lives there — but whoever runs
  either family live should expect to need to split the call or raise the
  output budget.

## 7. Gates

- `CI=true node --test tests/canonical-v2-general-extraction-runner.test.js`
  — **32/32 pass, exit 0.**
- `bash scripts/lint/forbidden-patterns.sh` — **exit 1**, but the failure
  (`INVARIANT-4: FAIL evidence/canonical-v2/topbuild-representations-20260808-ceiling128k/recording.json`)
  is pre-existing and unrelated to this change: confirmed by `git stash`-ing
  this note's and the runner's diff and re-running the same command, which
  fails identically against the untouched tree. That evidence file belongs
  to concurrent TopBuild fan-out work in `evidence/**`, which this task was
  explicitly told to stay out of.

## 8. Scope discipline

Only `scripts/canonical-v2-live-extraction-run.mjs` (the new
`DEAL_PINS.skechers` entry) and this note were edited. No live extraction
calls were made — every verification above is `--dry-run` or a read.
Nothing under `lib/canonical-v2/**` or `evidence/**` was touched. Nothing
was committed.
