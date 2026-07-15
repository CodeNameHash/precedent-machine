# Safe Disclosure Carve-out — Recategorization DRAFT (2026-07-15)

Prepared for Ben's review. **Nothing has been applied and nothing committed.**

Follow-up to `reports/SAFE-DISCLOSURE-SWEEP-2026-07-14.md`. Ben's decision: create category
**"Safe Disclosure Carve-out"** and recategorize the scattered (non-COR-category) rows carrying
the Rule 14d-9 / 14e-2(a) / "stop, look and listen" markers; leave the 45 rows where the carve-out
is merged inside the operative Change of Recommendation provision alone.

Live re-identification (read-only, 2026-07-15) found exactly the sweep's **56 scattered rows**
(marker in `full_text`, category ≠ "Change of Recommendation"). Every clause was read in full or
in marker context. Verdict: the safe-disclosure carve-out is the row's **primary concept in only
7 of the 56**; in the other 49 the marker is incidental to a genuinely different provision
(Schedule 14D-9 filing mechanics, information-supplied reps, definitions, no-shop covenants that
merely end with the carve-out sentence, COR restrictions whose "fail to recommend on a 14D-9"
prong trips the marker, etc.).

Decisions file: `scripts/curation/decisions/2026-07-15-safe-disclosure-DRAFT.json`

## 1. RECAT — 7 rows → "Safe Disclosure Carve-out"

| Deal | Provision | Old category → New | Clause justification |
|---|---|---|---|
| Shire plc / Dyax Corp. | d29989a3 | Uncovered text — Acquisition Proposals (#5) → Safe Disclosure Carve-out | Row is §6.2(d) "Certain Permitted Disclosure" in full: 14d-9/14e-2(a) positions + "stop-look-and-listen" under 14d-9(f), with deemed-COR proviso. Nothing else in the row. |
| ConocoPhillips / Concho Resources Inc. | 87e7867d | Exceptions / Fiduciary Out → Safe Disclosure Carve-out | Row is only §6.4(e)(i): Parent Board may make disclosures necessary to comply with 14d-9/14e-2(a), deemed-COR proviso. Pure carve-out (Parent side — see open questions). |
| Creek Parent, Inc. / Catalent, Inc. | 4ac4810e | Exceptions / Fiduciary Out → Safe Disclosure Carve-out | Row is §5.03(d) in full: 14e-2(a)/14d-9/Item 1012(a) positions, fiduciary-duty disclosures, "stop, look and listen" under 14d-9(f). Pure carve-out. |
| H.J. Heinz / Kraft Foods Group | 987e6e06 | Uncovered text — No Solicitation (#4) → Safe Disclosure Carve-out | Row is §5.05(g) in full: 14e-2(a)/14d-9 positions + "stop, look and listen" under 14d-9(b), plus the no-deemed-COR clause. Pure carve-out leftover. |
| IBM / Red Hat, Inc. | 169e2698 | Uncovered text — No Solicitation (#3) → Safe Disclosure Carve-out | Row is §4.02(f) in full: 14d-9/14e-2(a) positions + legally required disclosure, with COR-effect proviso. Pure carve-out. Same text also sits in COR-category row fb3378cd (merged set, untouched). |
| Sophos Inc. / SecureWorks Corp. | 4b323e4e | General Exceptions → Safe Disclosure Carve-out | Row is §6.02(g) in full: 14d-9/14e-2(a)/Item 1012(a) positions, "stop, look and listen" under 14d-9(f), required-by-law disclosures, and the factually-accurate-statement safe harbor. Trailing "Section 6.03" heading is a parse artifact. |
| Hearts Parent / HireRight Holdings | 79414996 | Disclosure of Terms → Safe Disclosure Carve-out | The sweep-flagged misclassification. Row = tail of the §5.3 notice covenant + "(f) Certain Disclosures" carve-out (14e-2(a)/14d-9 incl. "stop, look and listen" under 14d-9(f)). "Disclosure of Terms" is wrong either way — the notice text is about notifying Parent and is fully duplicated inside sibling 2a6b3192 (Notice to Counterparty); the row's distinctive content is the carve-out. |

## 2. EXCLUDED — 49 rows (marker incidental to a different concept)

### Schedule 14D-9 filing / tender-offer mechanics (STRUCT) — marker is the SEC filing, not the carve-out
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Eli Lilly / Verve | 0086072d | [PROPOSED] Schedule 14D-9 Filing & SEC Disclosure | §1.2: obligation to file/disseminate the Schedule 14D-9. |
| Eli Lilly / Verve | c85c4d27 | The Merger — The Offer | §1.1 offer commencement/extension mechanics; 14D-9 mentioned as a filing. |
| General Dynamics / CSRA | 686b9d2c | [PROPOSED] Company Actions (Tender Offer Support) | §2.2: file the 14D-9 with the recommendation. |
| General Dynamics / CSRA | 4d16e2c6 | Directors and Officers — Directors | §2.3 board designees; 14f-1 information mailed with the 14D-9. |
| Gilead / Pharmasset | 69ae2648 | [PROPOSED] Company Actions (Schedule 14D-9 / Stockholder List) | §1.2: file/disseminate the 14D-9. |
| Gilead / Pharmasset | f5caa13b | [PROPOSED] Interim Board Representation / Designee Rights | §1.3 designees; 14f-1 info in the 14D-9. |
| Sanofi / Bioverativ | 373d50a6 | [PROPOSED] The Offer | §2.01 offer mechanics; 14e-1(b)/14D-9 as filings. |
| Sanofi / Bioverativ | 6c06abe7 | [PROPOSED] Company Actions (Tender Offer) | §2.02: file the 14D-9. |

### Information-supplied / no-conflict representations — 14D-9 is a listed disclosure document
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| General Dynamics / CSRA | f258418f | Information Supplied / Proxy Statement | 10b-5-style rep over Offer Documents/14D-9. |
| General Dynamics / CSRA | 0e2a39bd | No Conflict; Required Filings and Consents | Filing list includes the 14D-9. |
| Gilead / Pharmasset | 76e1f23c | Information Supplied / Proxy Statement | REP-B info-supplied rep. |
| Gilead / Pharmasset | b604c887 | Information Supplied / Proxy Statement | REP-T info-supplied rep. |
| Gilead / Pharmasset | 9fbcfa1a | No Conflict; Required Filings and Consents | Governmental-filings rep listing the 14D-9. |
| Sanofi / Bioverativ | eb454013 | Information Supplied / Proxy Statement | §5.07 disclosure-documents rep. |
| Sanofi / Bioverativ | 4cca9d1b | Information Supplied / Proxy Statement | §4.10 disclosure-documents rep. |
| Sanofi / Bioverativ | b2792984 | No Conflict; Required Filings and Consents — Governmental Authorization | §4.04 filing list includes the 14D-9. |

### Definitions / defined-terms indexes — marker inside a definition or index table
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Eli Lilly / Verve | 44d30aa7 | General Definitions Section | "Change of Board Recommendation" definition; 14D-9 in the fail-to-recommend prong. |
| Eli Lilly / Verve | 6a194303 | General Definitions Section | Same definition plus "Cash and Cash Equivalents". |
| Eli Lilly / Verve | 554d5633 | [PROPOSED] Certain Definitions | Entire 45K-char §9.3 definitions section. |
| General Dynamics / CSRA | 0fb9313b | General Definitions Section | '"Schedule 14D-9" has the meaning set forth in Section 2.2(b).' |
| Sanofi / Bioverativ | c8bbc4ef | Willful Breach | Marker in the trailing defined-terms index table, not the definition. |
| Sophos / SecureWorks | 9f03cde0 | Willful Breach | Same — defined-terms index table. |

### No-shop / solicitation covenants where the carve-out is an embedded tail sentence
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Chevron / Anadarko | 62303118 | Solicitation Prohibition | Full no-shop covenant; carve-out sentence at tail, and the same sentence is standalone row d222706a. |
| IonQ / SkyWater | 69c594fd | Solicitation Prohibition | Full no-shop; 14e-2 compliance sentence at tail (also standalone in COR row 0543c808). |
| Rocket / Mr. Cooper | 4360150c | Solicitation Prohibition | Full no-shop; carve-out tail duplicated in COR row 042d581b. |
| Quikrete / Summit | 503aaf8f | Solicitation Prohibition | No-shop; marker is the fail-to-recommend-on-14D-9 COR prong. |
| Quikrete / Summit | a1236fe3 | Exceptions / Fiduciary Out | §6.04(b) fiduciary out (negotiate/furnish info) dominates; carve-out sentence near end. |
| Quikrete / Summit | cda1217e | Provision of Information to Bidder | Overlapping §6.04(b) window; primary concept is furnishing info under an Acceptable Confidentiality Agreement. |
| Quikrete / Summit | f6dc0f2a | Confidentiality Agreement Requirement | Same overlapping window, same reason. |
| Verizon / Frontier | 82d2b122 | [PROPOSED] No Solicitation; Change in Recommendation | Entire 21K-char §5.02; carve-out (e) is a small part of the whole section. |
| QXO / TopBuild | 8e2bcf86 | Uncovered text — No Solicitation by Parent (#2) | 12K-char parent no-shop leftover; carve-out (d) is a small interior part. (Deal's pure carve-out rows 3f81800b/c7f79cba are in the merged-COR set, untouched.) |

### COR restrictions / fiduciary-out provisions where the marker is a prong or exception, not the concept
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Chevron / Anadarko | d222706a | Exceptions / Fiduciary Out | First sentence is the 14e-2 carve-out, but ~70% of the row is the operative fiduciary out (furnish info / negotiate on Superior Proposals) — current category fits the majority. See open questions. |
| ConocoPhillips / Concho | af1b8c9d | Exceptions / Fiduciary Out | Company-side §6.3(e): prong (i) is the carve-out but prongs (ii)+ are the full fiduciary-out — the dominant concept. (Parent-side sibling 87e7867d, carve-out only, IS recatted.) |
| Merck / Prometheus | 880dd175 | Company Board Recommendation | This is the operative §5.3(a) COR restriction; "stop, look and listen" appears only in the not-deemed-COR proviso. See open questions — arguably belongs in "Change of Recommendation", not Safe Disclosure. |
| Sophos / SecureWorks | 7ef729cc | [PROPOSED] No Change in Recommendation / Alternative Acquisition Agreement | §6.02(c) COR restriction; 14D-9 in the fail-to-recommend prong. |
| QXO / TopBuild | 1de6dcb8 | Superior Proposal Definition | Definition + COR prongs; "stop, look and listen" only as an exception inside prong (C). |
| QXO / TopBuild | 693e32b4 | Cease Existing Discussions | Parent-side §4.4(h) COR restriction; marker inside prong (C) exception. |
| Zymeworks / Theravance | e078973b | Stockholders Meeting | §6.2 meeting + board-recommendation covenant; 14D-9 in fail-to-recommend prong. |
| Zymeworks / Theravance | e2151f25 | Intervening Event | §6.3(d) Intervening-Event COR right dominates; carve-out (e) tail is standalone in merged COR row 8addc3a6. |
| Wildcat / Endeavor | c34e1fbe | Intervening Event | §7.03(g) Intervening-Event COR right; carve-out (i) is a short tail. |
| Wildcat / Endeavor | 2853a2b9 | Uncovered text — No Solicitation | Leftover dominated by the Intervening-Event COR text; carve-out (i) tail. |
| Hearts / HireRight | 2a6b3192 | Notice to Counterparty | §5.3 notice covenant (full) with "(f) Certain Disclosures" appended; the notice is the primary concept and the carve-out is carried by recatted sibling 79414996. |
| Goodyear / Cooper Tire | 8ffdb0a4 | Uncovered text — No Solicitation by the Company (#2) | Confidentiality-agreement covenant + §5.2(d) COR restriction; "stop, look and listen" only inside prong (C) exception. |
| Stanley Martin / United Homes | 5dce4346 | Uncovered text — Acquisition Proposals; Change in Recommendation (#2) | 6K-char leftover dominated by fiduciary-out and notice text; carve-out (g) is a tail fraction. |

### Mixed leftovers where the carve-out is present but co-resident with other operative text
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Amazon / Whole Foods | 67baf06e | Uncovered text — Acquisition Proposals; Change of Recommendation (#2) | Majority (~60%) is the "Intervening Event" definition; §6.2(g) "Certain Permitted Disclosure" carve-out follows in full. Recatting would mislabel the definition. See open questions. |
| Goodyear / Cooper Tire | 6bd071c4 | Uncovered text — No Solicitation by the Company (#3) | Carve-out (f) is only ~25% of the row; (g) return/destroy-information + standstill enforcement and (h) breach attribution dominate. Carve-out text is already in merged COR row 43832816. See open questions. |

### Ancillary covenants — marker refers to the 14D-9 document only
| Deal | Provision | Category kept | Reason |
|---|---|---|---|
| Eli Lilly / Verve | 9edd32e7 | Stockholder / Transaction Litigation | §6.12; 14D-9 mentioned re settlement-disclosure exception. |
| Gilead / Pharmasset | 271f5f4c | Information to Regulators | Mutual info-furnishing for filings incl. the 14D-9. |
| Gilead / Pharmasset | 39f2bdc6 | Consultation Rights | Advance-review right over filings incl. the 14D-9. |

## 3. Dry-run result

`node scripts/curation/prune-cards.js --decisions scripts/curation/decisions/2026-07-15-safe-disclosure-DRAFT.json`

```
2026-07-15 Safe Disclosure Carve-out recat DRAFT (awaiting Ben review — do not apply) — 7 deal(s), dry-run
2026-07-15 Safe Disclosure Carve-out recat DRAFT (awaiting Ben review — do not apply) — 7 deal(s), overall CLEAN

deal 448e524f-19b0-4b5c-837b-7d5cabbc0fb0 — clean
  d29989a3  Uncovered text — Acquisition Proposals (#5)  recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal a267309a-fc22-4160-a652-1144fc64e9cf — clean
  87e7867d  Exceptions / Fiduciary Out                recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal bb5f062d-2818-4f9f-b968-ad9980445b6f — clean
  4ac4810e  Exceptions / Fiduciary Out                recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal c7c16365-c9cf-4bfb-93a6-1575084d717c — clean
  987e6e06  Uncovered text — No Solicitation (#4)     recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal 2b9a6571-6fe7-4aac-931d-a96ab227ea43 — clean
  169e2698  Uncovered text — No Solicitation (#3)     recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal bf31d586-c0bc-4ed2-8d46-e69451a05756 — clean
  4b323e4e  General Exceptions                        recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

deal 13211d88-4f16-4730-bb70-fb1ef6ab3735 — clean
  79414996  Disclosure of Terms                       recat-provision    PLANNED-RECAT-PROVISION   verify: —  write: UPDATE provisions.category -> "Safe Disclosure Carve-out"

Dry-run complete: no writes. Re-run with --apply --backup <path> to commit.
```

Overall CLEAN; no human-correction flags, no ambiguous/missing refs. Zero writes performed.

## 4. Open questions for Ben

1. **87e7867d (Concho, Parent side)** — pure carve-out but it covers the *Parent* Board in a merger-of-equals. Apply the "(Parent)" suffix convention ("Safe Disclosure Carve-out (Parent)") as done for TopBuild's "Solicitation Prohibition (Parent)"? Draft uses the plain name per your one-category instruction.
2. **79414996 (HireRight)** — recatted as directed, but it is a duplicate sub-window of 2a6b3192 (its whole text is contained there) and its "(f)" carve-out is truncated after clause (i). A prune/duplicate decision may be cleaner than a recat.
3. **67baf06e (Whole Foods)** — excluded, but it holds the deal's complete "(g) Certain Permitted Disclosure" carve-out alongside the Intervening Event definition. If you want the carve-out labeled for this deal, this row would need a split (or a recat that accepts mislabeling the definition).
4. **6bd071c4 (Goodyear/Cooper)** — excluded on majority-content grounds, but it opens with the complete (f) carve-out. The carve-out is also in merged-COR row 43832816, so nothing is lost; flagging in case you weigh "opens with the concept" over "majority of text".
5. **880dd175 (Prometheus)** — not a safe-disclosure row, but it is the deal's operative COR restriction filed under "Company Board Recommendation"; near-duplicate of COR-category row 370ca4f5. Separate misclassification worth a future decision.
6. **169e2698 (Red Hat)** — recatting creates the situation where the same clause text exists under both "Safe Disclosure Carve-out" (this row) and "Change of Recommendation" (fb3378cd, merged set left alone per your instruction). Same pattern would apply to any future duplicates.

## 5. Status

- Decisions file: `scripts/curation/decisions/2026-07-15-safe-disclosure-DRAFT.json` (7 recats)
- Dry-run: CLEAN, zero writes
- **NOT applied, NOT committed** — awaiting Ben's go. To apply after review:
  `node scripts/curation/prune-cards.js --decisions scripts/curation/decisions/2026-07-15-safe-disclosure-DRAFT.json --apply --backup reports/safe-disclosure-recat-backup-2026-07-15.json`
