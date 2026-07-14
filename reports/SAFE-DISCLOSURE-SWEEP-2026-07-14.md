# Safe Disclosure Carve-Out Sweep (14d-9 / 14e-2 / stop-look-and-listen)

Read-only sweep of `provisions.full_text` across all 40 deals for case-insensitive markers `14d-9`, `14e-2`, `stop, look and listen` (the Rule 14d-9 / 14e-2(a) safe-disclosure carve-out that lets a target board communicate a position to stockholders — including a "stop, look and listen" communication — without that communication itself constituting a Change of Recommendation).

- Provisions scanned: 12,619 rows across 40 deals
- Deals with >=1 hit: 36 / 40
- Total matching provision rows: 101

### Deals with NO hit (4)

- ENDRA Life Sciences Inc. / Noble Africa LLC
- Rocket Companies, Inc. / Redfin Corporation
- Laboratory Corporation of America Holdings / Covance Inc.
- Global Net Lease, Inc. / Modiv Industrial, Inc.

## 1. Counts

| Metric | Count |
|---|---|
| Deals with the pattern somewhere in their provisions | 36 |
| Deals with NO hit | 4 |
| Total matching provision rows | 101 |
| Hits whose row category IS "Change of Recommendation" (pattern merged into the operative COR provision) | 45 |
| Hits filed under a DIFFERENT category (pattern sits in a separate provision) | 56 |
| Deals where the pattern is merged into the operative COR row for at least one hit | 31 |
| Deals where the pattern appears ONLY outside the operative-COR row (never merged in) | 5 |

### Deals where the pattern never appears inside the "Change of Recommendation" category

- Chevron Corporation / Anadarko Petroleum Corporation
- Creek Parent, Inc. / Catalent, Inc.
- Shire plc / Dyax Corp.
- Verizon Communications Inc. / Frontier Communications Parent, Inc.
- Sophos Inc. / SecureWorks Corp.

## 2. Non-"Change of Recommendation" categories the pattern was found under

| Category (current) | Count |
|---|---|
| Exceptions / Fiduciary Out | 5 |
| Information Supplied / Proxy Statement | 5 |
| Solicitation Prohibition | 4 |
| General Definitions Section | 3 |
| Willful Breach | 2 |
| No Conflict; Required Filings and Consents | 2 |
| Intervening Event | 2 |
| [PROPOSED] The Offer | 1 |
| [PROPOSED] Company Actions (Tender Offer) | 1 |
| No Conflict; Required Filings and Consents — Governmental Authorization | 1 |
| Uncovered text — No Solicitation by the Company (#2) | 1 |
| Uncovered text — No Solicitation by the Company (#3) | 1 |
| [PROPOSED] Company Actions (Tender Offer Support) | 1 |
| Directors and Officers — Directors | 1 |
| Uncovered text — Acquisition Proposals (#5) | 1 |
| Uncovered text — No Solicitation | 1 |
| [PROPOSED] No Solicitation; Change in Recommendation | 1 |
| Notice to Counterparty | 1 |
| Disclosure of Terms | 1 |
| Uncovered text — No Solicitation (#4) | 1 |
| [PROPOSED] Company Actions (Schedule 14D-9 / Stockholder List) | 1 |
| [PROPOSED] Interim Board Representation / Designee Rights | 1 |
| Consultation Rights | 1 |
| Information to Regulators | 1 |
| Company Board Recommendation | 1 |
| Uncovered text — No Solicitation (#3) | 1 |
| General Exceptions | 1 |
| [PROPOSED] No Change in Recommendation / Alternative Acquisition Agreement | 1 |
| Provision of Information to Bidder | 1 |
| Confidentiality Agreement Requirement | 1 |
| Stockholders Meeting | 1 |
| Uncovered text — No Solicitation by Parent (#2) | 1 |
| Superior Proposal Definition | 1 |
| Cease Existing Discussions | 1 |
| Uncovered text — Acquisition Proposals; Change in Recommendation (#2) | 1 |
| Stockholder / Transaction Litigation | 1 |
| The Merger — The Offer | 1 |
| [PROPOSED] Schedule 14D-9 Filing & SEC Disclosure | 1 |
| [PROPOSED] Certain Definitions | 1 |
| Uncovered text — Acquisition Proposals; Change of Recommendation (#2) | 1 |

## 3. Summary table (deal | provision | current category | has separate operative COR row)

"Has separate operative COR row" = TRUE if this deal has at least one OTHER provision row (category matching /change of|in recommendation|adverse recommendation/, without the 14d-9/14e-2/stop-look-and-listen markers) distinct from this hit.

| Deal (Acquirer / Target) | Provision | Type | Current category | Separate operative COR row exists? |
|---|---|---|---|---|
| Chevron Corporation / Anadarko Petroleum Corporation | 62303118 | NOSOL | Solicitation Prohibition | Yes |
| Chevron Corporation / Anadarko Petroleum Corporation | d222706a | NOSOL | Exceptions / Fiduciary Out | Yes |
| Sanofi / Bioverativ Inc. | eb454013 | REP-B | Information Supplied / Proxy Statement | Yes |
| Sanofi / Bioverativ Inc. | 373d50a6 | STRUCT | [PROPOSED] The Offer | Yes |
| Sanofi / Bioverativ Inc. | 6c06abe7 | STRUCT | [PROPOSED] Company Actions (Tender Offer) | Yes |
| Sanofi / Bioverativ Inc. | b2792984 | REP-T | No Conflict; Required Filings and Consents — Governmental Authorization | Yes |
| Sanofi / Bioverativ Inc. | 4cca9d1b | REP-T | Information Supplied / Proxy Statement | Yes |
| Sanofi / Bioverativ Inc. | c8bbc4ef | DEF | Willful Breach | Yes |
| Sanofi / Bioverativ Inc. | b1583cae | NOSOL | Change of Recommendation | Yes |
| Sanofi / Bioverativ Inc. | dfd4fbdc | NOSOL | Change of Recommendation | Yes |
| Apollo Global Management, Inc. / Bridge Investment Group Holdings Inc. | 916ccd5a | NOSOL | Change of Recommendation | Yes |
| Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. | 194dc8a4 | NOSOL | Change of Recommendation | Yes |
| Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. | 50d6bc95 | NOSOL | Change of Recommendation | Yes |
| Creek Parent, Inc. / Catalent, Inc. | 4ac4810e | NOSOL | Exceptions / Fiduciary Out | Yes |
| ConocoPhillips / Concho Resources Inc. | c30d81fe | NOSOL | Change of Recommendation | Yes |
| ConocoPhillips / Concho Resources Inc. | af1b8c9d | NOSOL | Exceptions / Fiduciary Out | Yes |
| ConocoPhillips / Concho Resources Inc. | dc5f2947 | NOSOL | Change of Recommendation | Yes |
| ConocoPhillips / Concho Resources Inc. | 87e7867d | NOSOL | Exceptions / Fiduciary Out | Yes |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | 8ffdb0a4 | SECTION-LEFTOVER | Uncovered text — No Solicitation by the Company (#2) | Yes |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | 6bd071c4 | SECTION-LEFTOVER | Uncovered text — No Solicitation by the Company (#3) | Yes |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | eef6e9f2 | NOSOL | Change of Recommendation | Yes |
| The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company | 43832816 | NOSOL | Change of Recommendation | Yes |
| Charter Communications, Inc. / Cox Enterprises, Inc. | 3985be7a | NOSOL | Change of Recommendation | Yes |
| General Dynamics Corporation / CSRA Inc. | 686b9d2c | STRUCT | [PROPOSED] Company Actions (Tender Offer Support) | Yes |
| General Dynamics Corporation / CSRA Inc. | 4d16e2c6 | STRUCT | Directors and Officers — Directors | Yes |
| General Dynamics Corporation / CSRA Inc. | 0e2a39bd | REP-T | No Conflict; Required Filings and Consents | Yes |
| General Dynamics Corporation / CSRA Inc. | f258418f | REP-T | Information Supplied / Proxy Statement | Yes |
| General Dynamics Corporation / CSRA Inc. | 0fb9313b | DEF | General Definitions Section | Yes |
| General Dynamics Corporation / CSRA Inc. | 32130215 | NOSOL | Change of Recommendation | Yes |
| Shire plc / Dyax Corp. | d29989a3 | SECTION-LEFTOVER | Uncovered text — Acquisition Proposals (#5) | Yes |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. | 35fd660e | NOSOL | Change of Recommendation | N/A (this row IS the COR row) |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. | c34e1fbe | NOSOL | Intervening Event | No |
| Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. | 2853a2b9 | SECTION-LEFTOVER | Uncovered text — No Solicitation | No |
| BCPE Pequod Buyer, Inc. / Envestnet, Inc. | 02a1841e | NOSOL | Change of Recommendation | Yes |
| Glow Midco, LLC / European Wax Center, Inc. | 6a672f76 | NOSOL | Change of Recommendation | Yes |
| Glow Midco, LLC / European Wax Center, Inc. | 20de6f29 | NOSOL | Change of Recommendation | Yes |
| Antlia Holdings LLC / Forest City Realty Trust, Inc. | ef0f1a0d | NOSOL | Change of Recommendation | Yes |
| Verizon Communications Inc. / Frontier Communications Parent, Inc. | 82d2b122 | COV | [PROPOSED] No Solicitation; Change in Recommendation | Yes |
| Hearts Parent, LLC / HireRight Holdings Corporation | dc1b5936 | NOSOL | Change of Recommendation | Yes |
| Hearts Parent, LLC / HireRight Holdings Corporation | 2a6b3192 | NOSOL | Notice to Counterparty | Yes |
| Hearts Parent, LLC / HireRight Holdings Corporation | 79414996 | NOSOL | Disclosure of Terms | Yes |
| Hewlett Packard Enterprise Company / Juniper Networks, Inc. | db50ebf9 | NOSOL | Change of Recommendation | Yes |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | 987e6e06 | SECTION-LEFTOVER | Uncovered text — No Solicitation (#4) | Yes |
| H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. | eec4421c | NOSOL | Change of Recommendation | Yes |
| Bespin Subsidiary, LLC / Landos Biopharma, Inc. | 6f7b6f3d | NOSOL | Change of Recommendation | Yes |
| SH Residential Holdings, LLC / M.D.C. Holdings, Inc. | 3449a5d8 | NOSOL | Change of Recommendation | Yes |
| Pfizer Inc. / Metsera, Inc. | a2d500e0 | NOSOL | Change of Recommendation | Yes |
| Pfizer Inc. / Metsera, Inc. | eb6cf88b | NOSOL | Change of Recommendation | Yes |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | 4360150c | NOSOL | Solicitation Prohibition | Yes |
| Rocket Companies, Inc. / Mr. Cooper Group Inc. | 042d581b | NOSOL | Change of Recommendation | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 76e1f23c | REP-B | Information Supplied / Proxy Statement | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 69ae2648 | STRUCT | [PROPOSED] Company Actions (Schedule 14D-9 / Stockholder List) | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | f5caa13b | STRUCT | [PROPOSED] Interim Board Representation / Designee Rights | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 9fbcfa1a | REP-T | No Conflict; Required Filings and Consents | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | b604c887 | REP-T | Information Supplied / Proxy Statement | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 39f2bdc6 | ANTI | Consultation Rights | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 271f5f4c | ANTI | Information to Regulators | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 0217641a | NOSOL | Change of Recommendation | Yes |
| Gilead Sciences, Inc. / Pharmasset, Inc. | 10cd452c | NOSOL | Change of Recommendation | Yes |
| Merck & Co., Inc. / Prometheus Biosciences, Inc. | 880dd175 | OTHER | Company Board Recommendation | Yes |
| Merck & Co., Inc. / Prometheus Biosciences, Inc. | 370ca4f5 | NOSOL | Change of Recommendation | Yes |
| Merck & Co., Inc. / Prometheus Biosciences, Inc. | 39a81f25 | NOSOL | Change of Recommendation | Yes |
| International Business Machines Corporation / Red Hat, Inc. | fb3378cd | NOSOL | Change of Recommendation | Yes |
| International Business Machines Corporation / Red Hat, Inc. | 169e2698 | SECTION-LEFTOVER | Uncovered text — No Solicitation (#3) | Yes |
| Sophos Inc. / SecureWorks Corp. | 4b323e4e | IOC-T | General Exceptions | Yes |
| Sophos Inc. / SecureWorks Corp. | 9f03cde0 | DEF | Willful Breach | Yes |
| Sophos Inc. / SecureWorks Corp. | 7ef729cc | IOC-T | [PROPOSED] No Change in Recommendation / Alternative Acquisition Agreement | Yes |
| Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. | 6cceffa3 | NOSOL | Change of Recommendation | Yes |
| Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. | 46623630 | NOSOL | Change of Recommendation | Yes |
| IonQ, Inc. / SkyWater Technology, Inc. | 69c594fd | NOSOL | Solicitation Prohibition | Yes |
| IonQ, Inc. / SkyWater Technology, Inc. | 0543c808 | NOSOL | Change of Recommendation | Yes |
| Marriott International, Inc. / Starwood Hotels & Resorts Worldwide, Inc. | b83704f3 | NOSOL | Change of Recommendation | Yes |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | 503aaf8f | NOSOL | Solicitation Prohibition | Yes |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | a1236fe3 | NOSOL | Exceptions / Fiduciary Out | Yes |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | cda1217e | NOSOL | Provision of Information to Bidder | Yes |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | f6dc0f2a | NOSOL | Confidentiality Agreement Requirement | Yes |
| Quikrete Holdings, Inc. / Summit Materials, Inc. | ef48cd8e | NOSOL | Change of Recommendation | Yes |
| SUP Parent Holdings, LLC / Superior Industries International, Inc. | db450d04 | NOSOL | Change of Recommendation | Yes |
| SUP Parent Holdings, LLC / Superior Industries International, Inc. | a6e97233 | NOSOL | Change of Recommendation | Yes |
| Zymeworks Inc. / Theravance Biopharma, Inc. | 8addc3a6 | NOSOL | Change of Recommendation | Yes |
| Zymeworks Inc. / Theravance Biopharma, Inc. | e2151f25 | NOSOL | Intervening Event | Yes |
| Zymeworks Inc. / Theravance Biopharma, Inc. | e078973b | COV | Stockholders Meeting | Yes |
| QXO, Inc. / TopBuild Corp. | 8e2bcf86 | SECTION-LEFTOVER | Uncovered text — No Solicitation by Parent (#2) | Yes |
| QXO, Inc. / TopBuild Corp. | 3f81800b | NOSOL | Change of Recommendation | Yes |
| QXO, Inc. / TopBuild Corp. | c6c09a55 | NOSOL | Change of Recommendation | Yes |
| QXO, Inc. / TopBuild Corp. | 1de6dcb8 | NOSOL | Superior Proposal Definition | Yes |
| QXO, Inc. / TopBuild Corp. | 693e32b4 | NOSOL | Cease Existing Discussions | Yes |
| QXO, Inc. / TopBuild Corp. | 49bd1a89 | NOSOL | Change of Recommendation | Yes |
| QXO, Inc. / TopBuild Corp. | c7f79cba | NOSOL | Change of Recommendation | Yes |
| Stanley Martin Homes, LLC / United Homes Group, Inc. | 5dce4346 | SECTION-LEFTOVER | Uncovered text — Acquisition Proposals; Change in Recommendation (#2) | Yes |
| Stanley Martin Homes, LLC / United Homes Group, Inc. | 30987598 | NOSOL | Change of Recommendation | Yes |
| Stanley Martin Homes, LLC / United Homes Group, Inc. | 22c5dabb | NOSOL | Change of Recommendation | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 9edd32e7 | COV | Stockholder / Transaction Litigation | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | c85c4d27 | STRUCT | The Merger — The Offer | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 0086072d | STRUCT | [PROPOSED] Schedule 14D-9 Filing & SEC Disclosure | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 6a194303 | DEF | General Definitions Section | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 44d30aa7 | DEF | General Definitions Section | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | d232d4fc | NOSOL | Change of Recommendation | Yes |
| Eli Lilly and Company / Verve Therapeutics, Inc. | 554d5633 | MISC | [PROPOSED] Certain Definitions | Yes |
| Amazon.com, Inc. / Whole Foods Market, Inc. | 67baf06e | SECTION-LEFTOVER | Uncovered text — Acquisition Proposals; Change of Recommendation (#2) | Yes |
| Amazon.com, Inc. / Whole Foods Market, Inc. | 947b38ce | NOSOL | Change of Recommendation | Yes |

## 4. Detail — excerpts (first 200 chars) and sibling COR rows

### Chevron Corporation / Anadarko Petroleum Corporation — 62303118

- **Type:** NOSOL  **Category:** Solicitation Prohibition
- **Excerpt:** "The Company and its Subsidiaries will not, and the Company will direct and use its reasonable best efforts to cause its and its Subsidiaries' respective officers, directors, employees, investment bank"
- **Other marker-free COR-category row(s) in this deal:** 212b5899 (Change of Recommendation), ee8a1f8a (Change of Recommendation)

### Chevron Corporation / Anadarko Petroleum Corporation — d222706a

- **Type:** NOSOL  **Category:** Exceptions / Fiduciary Out
- **Excerpt:** "Nothing contained in this Agreement shall prevent the Board of Directors of the Company from (i) complying with Rule 14e-2 under the Exchange Act with regard to an Acquisition Proposal or (ii) making "
- **Other marker-free COR-category row(s) in this deal:** 212b5899 (Change of Recommendation), ee8a1f8a (Change of Recommendation)

### Sanofi / Bioverativ Inc. — eb454013

- **Type:** REP-B  **Category:** Information Supplied / Proxy Statement
- **Excerpt:** "Section 5.07.                          Disclosure Documents.  None of the information supplied or to be supplied by Parent or Merger Sub specifically for inclusion or incorporation by reference in the"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — 373d50a6

- **Type:** STRUCT  **Category:** [PROPOSED] The Offer
- **Excerpt:** "Section 2.01.                          The Offer.\n\n(a)                                 Commencement of the Offer.  Provided that this Agreement shall not have been terminated in accordance with Sectio"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — 6c06abe7

- **Type:** STRUCT  **Category:** [PROPOSED] Company Actions (Tender Offer)
- **Excerpt:** "Section 2.02.                          Company Actions.\n\n(a)                                 Approval.  The Company hereby approves of and consents to the Transactions.  The Company agrees that no sha"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — b2792984

- **Type:** REP-T  **Category:** No Conflict; Required Filings and Consents — Governmental Authorization
- **Excerpt:** "Section 4.04.         Governmental Authorization.  The execution, delivery and performance by the Company of this Agreement and the consummation by the Company of the Transactions require no action by"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — 4cca9d1b

- **Type:** REP-T  **Category:** Information Supplied / Proxy Statement
- **Excerpt:** "Section 4.10.         Disclosure Documents.  None of the information supplied, or to be supplied, by the Company specifically for inclusion or incorporation by reference in the Offer Documents or any "
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — c8bbc4ef

- **Type:** DEF  **Category:** Willful Breach
- **Excerpt:** "\"Willful Breach\" means, with respect to any representation, warranty, agreement or covenant in this Agreement, an act or omission (including a failure to cure circumstances) where the breaching party "
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — b1583cae

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as set forth in this Section 6.02, neither the Company Board nor any committee thereof shall (i) (A) fail to make, withhold or withdraw (or modify, amend or qualify in a manner adverse to Paren"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Sanofi / Bioverativ Inc. — dfd4fbdc

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prohibit the Company or the Company Board, directly or indirectly through their respective Representatives, from (i) taking and disclosing to the stockholders"
- **Other marker-free COR-category row(s) in this deal:** a9b394d3 (Change of Recommendation), 65d6c32b (Change of Recommendation)

### Apollo Global Management, Inc. / Bridge Investment Group Holdings Inc. — 916ccd5a

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prohibit the Company, the Company Board or the Special Committee, directly or indirectly through its Representatives, from (i) taking and disclosing to the Co"
- **Other marker-free COR-category row(s) in this deal:** 0aea2954 (Change of Recommendation), 9c2b8ee8 (Change of Recommendation)

### Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. — 194dc8a4

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(c) No\nChange in Company Board Recommendation or Entry into an Alternative Acquisition Agreement. Except as provided by Section 5.3(d), at no time after the date hereof may the Company Board (or a com"
- **Other marker-free COR-category row(s) in this deal:** 700e9c20 (Change of Recommendation)

### Restaurant Brands International Inc. / Carrols Restaurant Group, Inc. — 50d6bc95

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(f) Certain Disclosures. Nothing in this Agreement will prohibit the Company or the Company Board (or a committee thereof including the Special Committee) from (i) taking and disclosing to the Company"
- **Other marker-free COR-category row(s) in this deal:** 700e9c20 (Change of Recommendation)

### Creek Parent, Inc. / Catalent, Inc. — 4ac4810e

- **Type:** NOSOL  **Category:** Exceptions / Fiduciary Out
- **Excerpt:** "(d) Nothing in this Section 5.03 or elsewhere in this Agreement shall prohibit the Company from (i) complying with its disclosure obligations under applicable Law or the rules and regulations of NYSE,"
- **Other marker-free COR-category row(s) in this deal:** f8efb0bc (Change of Recommendation)

### ConocoPhillips / Concho Resources Inc. — c30d81fe

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(d) Except as permitted by Section 6.3(e), the Company Board, including any committee thereof, agrees it shall not:\n\n (i) withhold, withdraw, qualify or modify, or publicly propose or announce any int"
- **Other marker-free COR-category row(s) in this deal:** 0a159716 (Change of Recommendation), 06eb5b2b (Change of Recommendation)

### ConocoPhillips / Concho Resources Inc. — af1b8c9d

- **Type:** NOSOL  **Category:** Exceptions / Fiduciary Out
- **Excerpt:** "(e) Notwithstanding anything in this Agreement to the contrary:\n\n(i) the Company Board may, after consultation with its outside legal counsel, make such disclosures as the Company Board determines in "
- **Other marker-free COR-category row(s) in this deal:** 0a159716 (Change of Recommendation), 06eb5b2b (Change of Recommendation)

### ConocoPhillips / Concho Resources Inc. — dc5f2947

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as permitted by\nSection 6.4(e), the Parent Board, including any committee thereof, agrees it shall not:\n\n (i) withhold, withdraw, qualify or modify, or publicly propose or announce any intentio"
- **Other marker-free COR-category row(s) in this deal:** 0a159716 (Change of Recommendation), 06eb5b2b (Change of Recommendation)

### ConocoPhillips / Concho Resources Inc. — 87e7867d

- **Type:** NOSOL  **Category:** Exceptions / Fiduciary Out
- **Excerpt:** "Notwithstanding anything in this Agreement to the contrary:\n\n(i) the Parent Board may, after consultation with its outside legal counsel, make such disclosures as the Parent Board determines in good f"
- **Other marker-free COR-category row(s) in this deal:** 0a159716 (Change of Recommendation), 06eb5b2b (Change of Recommendation)

### The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company — 8ffdb0a4

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation by the Company (#2)
- **Excerpt:** "The Company agrees that it and its Subsidiaries will not enter into any confidentiality agreement with any Person subsequent to the date hereof which prohibits the Company from providing any informati"
- **Other marker-free COR-category row(s) in this deal:** 88af83ef (Change of Recommendation), 6995569f ([PROPOSED] Adverse Recommendation Change / Change of Recommendation)

### The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company — 6bd071c4

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation by the Company (#3)
- **Excerpt:** "(f) Nothing contained in this Section 5.2 or in\nSection 6.6 shall prohibit the Company or the Company Board from (i) taking and disclosing to its stockholders a position contemplated by Rule 14e-2(a) "
- **Other marker-free COR-category row(s) in this deal:** 88af83ef (Change of Recommendation), 6995569f ([PROPOSED] Adverse Recommendation Change / Change of Recommendation)

### The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company — eef6e9f2

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as expressly permitted by this Section 5.2(d) or\nSection 5.2(e), the Company Board shall not (i) (A) fail to include the Company Recommendation in the Proxy Statement, (B) change, qualify, with"
- **Other marker-free COR-category row(s) in this deal:** 88af83ef (Change of Recommendation), 6995569f ([PROPOSED] Adverse Recommendation Change / Change of Recommendation)

### The Goodyear Tire & Rubber Company / Cooper Tire & Rubber Company — 43832816

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Section 5.2 or in Section 6.6 shall prohibit the Company or the Company Board from (i) taking and disclosing to its stockholders a position contemplated by Rule 14e-2(a) or R"
- **Other marker-free COR-category row(s) in this deal:** 88af83ef (Change of Recommendation), 6995569f ([PROPOSED] Adverse Recommendation Change / Change of Recommendation)

### Charter Communications, Inc. / Cox Enterprises, Inc. — 3985be7a

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "In addition, nothing contained herein shall prevent Columbus or its Board of Directors from (i) complying with Rule 14a-9, Rule 14d-9 or Rule 14e-2(a) and Item 1012(a) of Regulation M-A under the Exch"
- **Other marker-free COR-category row(s) in this deal:** 2f727519 (Change of Recommendation), a4c8dcd3 (Change of Recommendation), a0dbc707 (Change of Recommendation), 7a261f3c (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — 686b9d2c

- **Type:** STRUCT  **Category:** [PROPOSED] Company Actions (Tender Offer Support)
- **Excerpt:** "Section 2.2 Company Actions.\n\n (a) Approval. The Company hereby approves of and consents to the Transactions. The Company agrees that no Shares held by the Company or any of the Company Subsidiaries ("
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — 4d16e2c6

- **Type:** STRUCT  **Category:** Directors and Officers — Directors
- **Excerpt:** "Section 2.3 Directors.\n\n(a) After the Offer Closing, and at all times thereafter, subject to compliance with applicable Law and the rules and regulations of the NYSE, Merger Sub shall be entitled to e"
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — 0e2a39bd

- **Type:** REP-T  **Category:** No Conflict; Required Filings and Consents
- **Excerpt:** "Section 4.5 No Conflicts; Consents.\n\n(a) The execution and delivery by the Company of this Agreement do not, and the consummation of the Transactions and compliance with the terms hereof will not, con"
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — f258418f

- **Type:** REP-T  **Category:** Information Supplied / Proxy Statement
- **Excerpt:** "Section 4.7\nInformation Supplied. None of the information supplied or to be supplied by or on behalf of the Company for inclusion or incorporation by reference in the Offer Documents or the Proxy Stat"
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — 0fb9313b

- **Type:** DEF  **Category:** General Definitions Section
- **Excerpt:** "\"Schedule 14D-9\" has the meaning set forth in\nSection 2.2(b)."
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### General Dynamics Corporation / CSRA Inc. — 32130215

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(h) Nothing contained in this Agreement shall prohibit the Company or the Company Board, directly or indirectly through their respective Representatives, from (i) taking and disclosing to the stockhol"
- **Other marker-free COR-category row(s) in this deal:** 24ab9945 (Change of Recommendation), fd16aa2e (Uncovered text — No Solicitation by the Company and Company Change in Recommendation), de69db73 (Change of Recommendation)

### Shire plc / Dyax Corp. — d29989a3

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — Acquisition Proposals (#5)
- **Excerpt:** "(d) Certain Permitted Disclosure. Nothing contained in this Section 6.2 shall be deemed to prohibit the Company or the board of directors of the Company from (i) complying with its disclosure obligati"
- **Other marker-free COR-category row(s) in this deal:** dfdfe35a (Change of Recommendation), 8d7cc026 (Change of Recommendation)

### Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. — 35fd660e

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(d) Except as permitted by this Section 7.03, the Executive Committee and each committee of the Executive Committee or the Board of Directors of the Company (including the Special Committee) shall not"
- **Other marker-free COR-category row(s) in this deal:** none — this IS the deal's Change of Recommendation row

### Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. — c34e1fbe

- **Type:** NOSOL  **Category:** Intervening Event
- **Excerpt:** "(g) Notwithstanding anything in this Agreement to the contrary, until the earlier to occur of the termination of this Agreement pursuant to Article IX and the Company's receipt of the Company Stockhol"
- **Other marker-free COR-category row(s) in this deal:** none found

### Wildcat EGH Holdco, L.P. / Endeavor Group Holdings, Inc. — 2853a2b9

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation
- **Excerpt:** "receipt of the Company Stockholder Approval, but subject to the Company's, the Executive Committee's and the Special Committee's compliance with Section 7.03(h), the Executive Committee (acting upon t"
- **Other marker-free COR-category row(s) in this deal:** none found

### BCPE Pequod Buyer, Inc. / Envestnet, Inc. — 02a1841e

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as provided by Section 8.4(f), at no time after the date hereof may the Company Board:\n\n(i) withhold, withdraw, amend, qualify or modify, or publicly propose to withhold, withdraw, amend, quali"
- **Other marker-free COR-category row(s) in this deal:** e4e43d14 (Change of Recommendation)

### Glow Midco, LLC / European Wax Center, Inc. — 6a672f76

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(c) No Change in Company Board Recommendation or Entry into an Alternative Acquisition Agreement. Except as provided by Section 5.3(d), at no time after the date hereof may the Company Board (or a com"
- **Other marker-free COR-category row(s) in this deal:** 42fd2dd2 (Change of Recommendation), 01e46e09 (Change of Recommendation)

### Glow Midco, LLC / European Wax Center, Inc. — 20de6f29

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(f) Certain Disclosures. Nothing in this Agreement will prohibit the Company or the Company Board (or a committee thereof including the Special Committee) from (i) taking and disclosing to the Company"
- **Other marker-free COR-category row(s) in this deal:** 42fd2dd2 (Change of Recommendation), 01e46e09 (Change of Recommendation)

### Antlia Holdings LLC / Forest City Realty Trust, Inc. — ef0f1a0d

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(b) No Change of Recommendation or Alternative Acquisition Agreement. Except as expressly provided in this Section 7.2(b), the Company Board and each committee thereof will not:\n\n(i) withhold, withdra"
- **Other marker-free COR-category row(s) in this deal:** f7472f88 (Change of Recommendation), 2f95dd47 (Uncovered text — Acquisition Proposals; Change of Recommendation)

### Verizon Communications Inc. / Frontier Communications Parent, Inc. — 82d2b122

- **Type:** COV  **Category:** [PROPOSED] No Solicitation; Change in Recommendation
- **Excerpt:** "SECTION 5.02. Solicitation; Change in Recommendation.\n\n (a) Except as expressly permitted by this Section 5.02, the Company shall and shall cause each of its Subsidiaries and its and their respective "
- **Other marker-free COR-category row(s) in this deal:** d0ee0a92 (Change of Recommendation)

### Hearts Parent, LLC / HireRight Holdings Corporation — dc1b5936

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "No Change in Company Board Recommendation or Entry into an Alternative Acquisition Agreement. Except as provided by Section 5.3(d), at no time after the date hereof may the Company Board (or a committ"
- **Other marker-free COR-category row(s) in this deal:** 2af696dd (Change of Recommendation)

### Hearts Parent, LLC / HireRight Holdings Corporation — 2a6b3192

- **Type:** NOSOL  **Category:** Notice to Counterparty
- **Excerpt:** "Notice. From the date of this Agreement until the earlier to occur of the termination of this Agreement pursuant to Article VIII and the Effective Time, the Company will promptly (and, in any event, w"
- **Other marker-free COR-category row(s) in this deal:** 2af696dd (Change of Recommendation)

### Hearts Parent, LLC / HireRight Holdings Corporation — 79414996

- **Type:** NOSOL  **Category:** Disclosure of Terms
- **Excerpt:** "Such notice must include (i) the identity of the Person or \"group\" of Persons making such offers or proposals (unless, in each case, such disclosure is prohibited pursuant to the terms of any confiden"
- **Other marker-free COR-category row(s) in this deal:** 2af696dd (Change of Recommendation)

### Hewlett Packard Enterprise Company / Juniper Networks, Inc. — db50ebf9

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(c) Nothing contained in this Agreement, including in this Section 6.03, shall restrict the Board of Directors or the Company from (i) taking and disclosing to the stockholders of the Company a positi"
- **Other marker-free COR-category row(s) in this deal:** 4f1e446c (Change of Recommendation)

### H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. — 987e6e06

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation (#4)
- **Excerpt:** "(g)\n(i) Nothing contained in this Agreement (including this Section 5.05) will prohibit Kraft or the Kraft Subsidiaries or the Kraft Board or any committee thereof from (a) taking and disclosing to it"
- **Other marker-free COR-category row(s) in this deal:** d7327236 (Change of Recommendation)

### H.J. Heinz Holding Corporation / Kraft Foods Group, Inc. — eec4421c

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(f) Neither the Kraft Board nor any committee thereof will\n(i) withhold, withdraw or modify in a manner adverse to Heinz the recommendation to shareholders of Kraft that they give the Kraft Shareholde"
- **Other marker-free COR-category row(s) in this deal:** d7327236 (Change of Recommendation)

### Bespin Subsidiary, LLC / Landos Biopharma, Inc. — 6f7b6f3d

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(vii) Nothing in this Section 5.3 or elsewhere in this Agreement shall prohibit the Company from (1) taking and disclosing to the Company's stockholders a position contemplated by Rule 14e-2(a) promul"
- **Other marker-free COR-category row(s) in this deal:** 7d8997cd (Change of Recommendation), 3202a234 (Uncovered text — No Solicitation; Change in Recommendation), 6c601fb9 (Change of Recommendation), e5f5a44a (Change of Recommendation), 823f5b13 (Change of Recommendation)

### SH Residential Holdings, LLC / M.D.C. Holdings, Inc. — 3449a5d8

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing in this Agreement shall prohibit the Company or the Company Board of Directors from (i) disclosing to the Company Stockholders a position contemplated by Rules 14d-9 and 14e-2(a) promulgated u"
- **Other marker-free COR-category row(s) in this deal:** ce530a4c (Change of Recommendation), b374da59 (Change of Recommendation)

### Pfizer Inc. / Metsera, Inc. — a2d500e0

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(g) Nothing contained in this Section 5.02 or elsewhere in this Agreement shall prohibit the Company from (i) taking and disclosing to its stockholders a position contemplated by Rule 14d-9 or Rule 14"
- **Other marker-free COR-category row(s) in this deal:** 217de5c2 (Change of Recommendation)

### Pfizer Inc. / Metsera, Inc. — eb6cf88b

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(e) Neither the Company Board nor any committee thereof shall (i) (A) withdraw, amend, change, qualify or modify in a manner adverse to Parent or Merger Sub, or propose publicly to withdraw, amend, ch"
- **Other marker-free COR-category row(s) in this deal:** 217de5c2 (Change of Recommendation)

### Rocket Companies, Inc. / Mr. Cooper Group Inc. — 4360150c

- **Type:** NOSOL  **Category:** Solicitation Prohibition
- **Excerpt:** "Maverick and its Subsidiaries will not, and Maverick will direct and use its reasonable best efforts to cause its and its Subsidiaries' respective officers, directors, employees, investment bankers, c"
- **Other marker-free COR-category row(s) in this deal:** 55f12644 (Change of Recommendation)

### Rocket Companies, Inc. / Mr. Cooper Group Inc. — 042d581b

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prevent the Board of Directors of Maverick from (i) complying with Rule 14e-2 under the Exchange Act with regard to an Acquisition Proposal or (ii) making any"
- **Other marker-free COR-category row(s) in this deal:** 55f12644 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 76e1f23c

- **Type:** REP-B  **Category:** Information Supplied / Proxy Statement
- **Excerpt:** "(e) Information Supplied. None of the information supplied or to be supplied by Parent or Merger Sub for inclusion or incorporation by reference in (i) the Offer Documents or the Schedule 14D-9 will, "
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 69ae2648

- **Type:** STRUCT  **Category:** [PROPOSED] Company Actions (Schedule 14D-9 / Stockholder List)
- **Excerpt:** "1.2 Company Actions.\n\n (a) On the date the Offer Documents are first filed with the SEC, the Company shall file with the SEC a Tender Offer Solicitation/Recommendation Statement on Schedule 14D-9 with"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — f5caa13b

- **Type:** STRUCT  **Category:** [PROPOSED] Interim Board Representation / Designee Rights
- **Excerpt:** "1.3 Company Directors.\n\n (a) Effective upon the Acceptance Time and from time to time thereafter (but only for so long as Parent, Merger Sub and their Affiliates beneficially own at least a majority o"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 9fbcfa1a

- **Type:** REP-T  **Category:** No Conflict; Required Filings and Consents
- **Excerpt:** "(d) Governmental Filings; No Violations.\n\n (i) Other than (A) the filing of the Delaware Certificate of Merger, (B) compliance with applicable requirements of the Hart-Scott-Rodino Antitrust Improveme"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — b604c887

- **Type:** REP-T  **Category:** Information Supplied / Proxy Statement
- **Excerpt:** "(f) Information Supplied. None of the information supplied or to be supplied by the Company for inclusion or incorporation by reference in (i) the Offer Documents or the Schedule 14D-9 will, at the ti"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 39f2bdc6

- **Type:** ANTI  **Category:** Consultation Rights
- **Excerpt:** "Subject to applicable Law relating to the exchange of information, Parent and the Company shall have the right to review in advance, and to the extent practicable each shall consult with the other on "
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 271f5f4c

- **Type:** ANTI  **Category:** Information to Regulators
- **Excerpt:** "The Company and Parent each shall, upon request by the other, furnish the other with all information concerning itself, any of its respective Subsidiaries, directors, officers and stockholders and suc"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 0217641a

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Subject to Section 5.2(c) and Section 5.2(d), the Company Board shall not: (i) withhold, fail to include in the Schedule 14D-9, withdraw, qualify or modify, in a manner adverse to Parent and Merger Su"
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Gilead Sciences, Inc. / Pharmasset, Inc. — 10cd452c

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prohibit or restrict the Company or the Company Board from (i) disclosing to its stockholders a position contemplated by Rules 14d-9 and 14e-2(a) promulgated "
- **Other marker-free COR-category row(s) in this deal:** 96d31ad0 (Change of Recommendation), 516a7f40 (Change of Recommendation)

### Merck & Co., Inc. / Prometheus Biosciences, Inc. — 880dd175

- **Type:** OTHER  **Category:** Company Board Recommendation
- **Excerpt:** "5.3 Company Board Recommendation.\n\n(a) Subject to Section 5.3(b), neither the Company Board nor any committee thereof shall (i) withdraw, amend, modify or qualify in a manner adverse to Parent or Merg"
- **Other marker-free COR-category row(s) in this deal:** d4df3d31 (Change of Recommendation)

### Merck & Co., Inc. / Prometheus Biosciences, Inc. — 370ca4f5

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(a) Subject to Section 5.3(b), neither the Company Board nor any committee thereof shall (i) withdraw, amend, modify or qualify in a manner adverse to Parent or Merger Sub the Company Board Recommenda"
- **Other marker-free COR-category row(s) in this deal:** d4df3d31 (Change of Recommendation)

### Merck & Co., Inc. / Prometheus Biosciences, Inc. — 39a81f25

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(c) Notwithstanding anything herein to the contrary, nothing in this Agreement shall prohibit the Company or the Company Board (or a committee thereof) from (i) taking and disclosing to the Company St"
- **Other marker-free COR-category row(s) in this deal:** d4df3d31 (Change of Recommendation)

### International Business Machines Corporation / Red Hat, Inc. — fb3378cd

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Section 4.02 or elsewhere in this Agreement shall prohibit the Company from (i) taking and disclosing to its shareholders a position contemplated by Rule 14d-9 and Rule 14e-2"
- **Other marker-free COR-category row(s) in this deal:** 2291a7c5 (Change of Recommendation), 567cd8b2 (Change of Recommendation), 8e7fef90 (Change of Recommendation)

### International Business Machines Corporation / Red Hat, Inc. — 169e2698

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation (#3)
- **Excerpt:** "(f) Nothing contained in this Section 4.02 or elsewhere in this Agreement shall prohibit the Company from (i) taking and disclosing to its shareholders a position contemplated by Rule 14d-9 and Rule 1"
- **Other marker-free COR-category row(s) in this deal:** 2291a7c5 (Change of Recommendation), 567cd8b2 (Change of Recommendation), 8e7fef90 (Change of Recommendation)

### Sophos Inc. / SecureWorks Corp. — 4b323e4e

- **Type:** IOC-T  **Category:** General Exceptions
- **Excerpt:** "(g)\nNothing contained in this Agreement shall prohibit the Company, directly or indirectly, through its Representatives, from (i) taking and disclosing to the stockholders of the Company any position "
- **Other marker-free COR-category row(s) in this deal:** 4ffa2689 (Change of Recommendation)

### Sophos Inc. / SecureWorks Corp. — 9f03cde0

- **Type:** DEF  **Category:** Willful Breach
- **Excerpt:** "\"Willful\nBreach\" means, with respect to any representation, warranty, agreement or covenant in this Agreement, an act or omission (including a failure to cure circumstances) where the breaching party "
- **Other marker-free COR-category row(s) in this deal:** 4ffa2689 (Change of Recommendation)

### Sophos Inc. / SecureWorks Corp. — 7ef729cc

- **Type:** IOC-T  **Category:** [PROPOSED] No Change in Recommendation / Alternative Acquisition Agreement
- **Excerpt:** "(c)\nExcept as set forth in this Section 6.02 (including Sections 6.02(d), (e) and (g)), neither the Company Board nor any committee thereof shall (i) (A) withhold, withdraw (or modify, amend or qualif"
- **Other marker-free COR-category row(s) in this deal:** 4ffa2689 (Change of Recommendation)

### Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. — 6cceffa3

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(c) No Change in Company Board Recommendation or Entry into an Alternative Acquisition Agreement. Except as provided by\nSection 5.3(d), at no time after the date hereof may the Company Board:\n\n (i) (A"
- **Other marker-free COR-category row(s) in this deal:** dc916e66 (Change of Recommendation)

### Beach Acquisition Co Parent, LLC / Skechers U.S.A., Inc. — 46623630

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(e) Certain Disclosures. Nothing in this Agreement will prohibit the Company Board from (i) taking and disclosing to the Company Stockholders a position contemplated by Rule 14e-2(a) promulgated under"
- **Other marker-free COR-category row(s) in this deal:** dc916e66 (Change of Recommendation)

### IonQ, Inc. / SkyWater Technology, Inc. — 69c594fd

- **Type:** NOSOL  **Category:** Solicitation Prohibition
- **Excerpt:** "During the period between the date hereof and the Effective Time or the date, if any, on which this Agreement is validly terminated pursuant to Section 9.1, the Company shall not, and shall cause its "
- **Other marker-free COR-category row(s) in this deal:** 4330fd64 (Change of Recommendation)

### IonQ, Inc. / SkyWater Technology, Inc. — 0543c808

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prevent the Board of Directors of the Company from (A) complying with Rule 14e-2 under the Exchange Act with regard to an Acquisition Proposal or (B) making a"
- **Other marker-free COR-category row(s) in this deal:** 4330fd64 (Change of Recommendation)

### Marriott International, Inc. / Starwood Hotels & Resorts Worldwide, Inc. — b83704f3

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(d) Nothing contained in this Section 4.2 shall prohibit Starwood from taking and disclosing to its stockholders a position contemplated by Rule 14d-9 or Rule 14e-2(a) promulgated under the Exchange A"
- **Other marker-free COR-category row(s) in this deal:** 18be9c82 (Change of Recommendation), 21e6ffa7 (Change of Recommendation), 2b374cb6 (Change of Recommendation), 9843cdfd (Change of Recommendation (Parent))

### Quikrete Holdings, Inc. / Summit Materials, Inc. — 503aaf8f

- **Type:** NOSOL  **Category:** Solicitation Prohibition
- **Excerpt:** "Except as otherwise expressly permitted by the remainder of this Section 6.04, until the earlier to occur of the termination of this Agreement pursuant to ‎Article 10 and the Effective Time, the Compa"
- **Other marker-free COR-category row(s) in this deal:** 05bd08e8 (Change of Recommendation)

### Quikrete Holdings, Inc. / Summit Materials, Inc. — a1236fe3

- **Type:** NOSOL  **Category:** Exceptions / Fiduciary Out
- **Excerpt:** "Notwithstanding anything contained in this Section 6.04 to the contrary, at any time prior to receipt of the Company Stockholder Approval:\n\n(i) the\nCompany, directly or indirectly through its Represen"
- **Other marker-free COR-category row(s) in this deal:** 05bd08e8 (Change of Recommendation)

### Quikrete Holdings, Inc. / Summit Materials, Inc. — cda1217e

- **Type:** NOSOL  **Category:** Provision of Information to Bidder
- **Excerpt:** "(B) furnish to such Third Party or its Representatives nonpublic information relating to the Company or any of its Subsidiaries and afford access to the business, properties, assets, books or records "
- **Other marker-free COR-category row(s) in this deal:** 05bd08e8 (Change of Recommendation)

### Quikrete Holdings, Inc. / Summit Materials, Inc. — f6dc0f2a

- **Type:** NOSOL  **Category:** Confidentiality Agreement Requirement
- **Excerpt:** "furnish to such Third Party or its Representatives nonpublic information relating to the Company or any of its Subsidiaries and afford access to the business, properties, assets, books or records and "
- **Other marker-free COR-category row(s) in this deal:** 05bd08e8 (Change of Recommendation)

### Quikrete Holdings, Inc. / Summit Materials, Inc. — ef48cd8e

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(iii) (A) withhold (or qualify or modify in a manner adverse to Parent or Merger Sub), or publicly announce its intention to do the same, the Company Recommendation, or fail to include the Company Rec"
- **Other marker-free COR-category row(s) in this deal:** 05bd08e8 (Change of Recommendation)

### SUP Parent Holdings, LLC / Superior Industries International, Inc. — db450d04

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(d) No Change in Recommendation or Alternative Acquisition Agreement. Except as provided in Section 6.2(e) and Section 6.2(f), the Board shall not (i) (A) withhold, withdraw, qualify or modify (or pub"
- **Other marker-free COR-category row(s) in this deal:** 41ca6e69 (Change of Recommendation), e7c80d36 (Change of Recommendation)

### SUP Parent Holdings, LLC / Superior Industries International, Inc. — a6e97233

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(g) Certain Permitted Disclosure. Nothing contained in this Section 6.2 shall prohibit the Company or the Board from (i) disclosing to the Company's stockholders a position contemplated by Rule 14e-2("
- **Other marker-free COR-category row(s) in this deal:** 41ca6e69 (Change of Recommendation), e7c80d36 (Change of Recommendation)

### Zymeworks Inc. / Theravance Biopharma, Inc. — 8addc3a6

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(e) Nothing contained in this Section 6.3 shall be deemed to prohibit the Company or its Board of Directors from taking and disclosing to its shareholders a position contemplated by Rule 14d-9, Rule 1"
- **Other marker-free COR-category row(s) in this deal:** 83a0010c (Change of Recommendation), 7a707fa1 (Change of Recommendation)

### Zymeworks Inc. / Theravance Biopharma, Inc. — e2151f25

- **Type:** NOSOL  **Category:** Intervening Event
- **Excerpt:** "(d) Notwithstanding anything to the contrary set forth in this Agreement, at any time prior to obtaining the Company Requisite Vote, if an Intervening Event has occurred and the Board of Directors det"
- **Other marker-free COR-category row(s) in this deal:** 83a0010c (Change of Recommendation), 7a707fa1 (Change of Recommendation)

### Zymeworks Inc. / Theravance Biopharma, Inc. — e078973b

- **Type:** COV  **Category:** Stockholders Meeting
- **Excerpt:** "Section 6.2 Shareholders Meeting; Board Recommendation.\n\n(a) Subject to Section 6.3(c), the Company shall, as promptly as reasonably practicable following the date on which the SEC confirms that it ha"
- **Other marker-free COR-category row(s) in this deal:** 83a0010c (Change of Recommendation), 7a707fa1 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — 8e2bcf86

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — No Solicitation by Parent (#2)
- **Excerpt:** "xcept to the extent necessary to take any actions that Parent or any third party would otherwise be permitted to take pursuant to this Section 4.4 (and in such case only in accordance with the terms h"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — 3f81800b

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(d)Nothing contained in this Section 4.3 or in Section 4.10 shall prohibit the Company or the Company Board from taking and disclosing to its stockholders a position contemplated by Rule 14d-9 or Rule"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — c6c09a55

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as expressly permitted by Section 4.3(i) below, neither the Company Board or any committee thereof shall (i) (A) fail to include the Company Recommendation in the Joint Proxy Statement/Prospect"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — 1de6dcb8

- **Type:** NOSOL  **Category:** Superior Proposal Definition
- **Excerpt:** "(f)For purposes of this Agreement, \"Company Superior Proposal\" means a bona fide, unsolicited written Company Acquisition Proposal (i) that if consummated would result in a third party (or in the case"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — 693e32b4

- **Type:** NOSOL  **Category:** Cease Existing Discussions
- **Excerpt:** "Parent agrees that it will take the necessary steps promptly to inform its Subsidiaries and its Representatives of the obligations undertaken in this Section 4.4.\n\n(h)Except as expressly permitted by "
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — 49bd1a89

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as expressly permitted by Section 4.4(i) below, neither the Parent Board or any committee thereof shall (i) (A) fail to include the Parent Recommendation in the Joint Proxy Statement/Prospectus"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### QXO, Inc. / TopBuild Corp. — c7f79cba

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Section 4.4 or in Section 4.10 shall prohibit Parent or the Parent Board from taking and disclosing to its stockholders a position contemplated by Rule 14d-9 or Rule 14e-2(a)"
- **Other marker-free COR-category row(s) in this deal:** e4f9681f (Change of Recommendation), 952cd768 (Change of Recommendation), d33c84a4 (Change of Recommendation)

### Stanley Martin Homes, LLC / United Homes Group, Inc. — 5dce4346

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — Acquisition Proposals; Change in Recommendation (#2)
- **Excerpt:** "rd or a committee thereof believes in good faith to be bona fide and the Company Board or a committee thereof determines in good faith (after consultation with its outside legal counsel and financial "
- **Other marker-free COR-category row(s) in this deal:** 6c8874b5 (Change of Recommendation), c0457975 (Uncovered text — Acquisition Proposals; Change in Recommendation)

### Stanley Martin Homes, LLC / United Homes Group, Inc. — 30987598

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Except as set forth in this Section 6.02 (including Sections 6.02(d), (e) and (g)), neither the Company Board nor any committee thereof shall\n\n(i)\n\n (A) withhold, withdraw (or modify, amend or qualify"
- **Other marker-free COR-category row(s) in this deal:** 6c8874b5 (Change of Recommendation), c0457975 (Uncovered text — Acquisition Proposals; Change in Recommendation)

### Stanley Martin Homes, LLC / United Homes Group, Inc. — 22c5dabb

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "Nothing contained in this Agreement shall prohibit the Company, directly or indirectly, through its Representatives, from (i) taking and disclosing to the stockholders of the Company any position cont"
- **Other marker-free COR-category row(s) in this deal:** 6c8874b5 (Change of Recommendation), c0457975 (Uncovered text — Acquisition Proposals; Change in Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — 9edd32e7

- **Type:** COV  **Category:** Stockholder / Transaction Litigation
- **Excerpt:** "Section 6.12. Stockholder Litigation. The Company shall promptly notify Parent of any actions, suits, or claims instituted against the Company, its Subsidiary or any of their directors or officers, in"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — c85c4d27

- **Type:** STRUCT  **Category:** The Merger — The Offer
- **Excerpt:** "Section 1.1. The Offer.\n\n(a) Commencement and Term of the Offer.\n\n(i) Subject to the terms and conditions of this Agreement (and provided that this Agreement shall not have been terminated in accordan"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — 0086072d

- **Type:** STRUCT  **Category:** [PROPOSED] Schedule 14D-9 Filing & SEC Disclosure
- **Excerpt:** "Section 1.2. Company Consent; Schedule 14D-9. On the date of the filing of the Offer Documents, or as promptly thereafter as practicable (but in no event later than the first (1st) Business Day follow"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — 6a194303

- **Type:** DEF  **Category:** General Definitions Section
- **Excerpt:** "\"Cash and Cash Equivalents\" means the Company's and its Subsidiary's cash and cash equivalents which are highly liquid investments with a maturity of three (3) months or less from the date of purchase"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — 44d30aa7

- **Type:** DEF  **Category:** General Definitions Section
- **Excerpt:** "\"Change of Board Recommendation\" means (a) the withdrawal, qualification or modification (in a manner adverse to Parent or Purchaser) of the Company Board Recommendation or the public announcement of "
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — d232d4fc

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "(f) Nothing contained in this Agreement prohibits (i) the Company Board or a committee thereof from (A) taking and disclosing to the holders of Shares a position contemplated by Rule 14e-2 or Rule 14d"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Eli Lilly and Company / Verve Therapeutics, Inc. — 554d5633

- **Type:** MISC  **Category:** [PROPOSED] Certain Definitions
- **Excerpt:** "Section 9.3. Certain Definitions. For purposes of this Agreement the term:\n\n\"Acquisition Proposal\" means any inquiry, offer or proposal made or renewed by a Person or Group (other than Parent or Purch"
- **Other marker-free COR-category row(s) in this deal:** aba43008 (Change of Recommendation), 00c97e88 (Change of Recommendation), 6579d936 (Change of Recommendation), 298ec9f7 (Change of Recommendation)

### Amazon.com, Inc. / Whole Foods Market, Inc. — 67baf06e

- **Type:** SECTION-LEFTOVER  **Category:** Uncovered text — Acquisition Proposals; Change of Recommendation (#2)
- **Excerpt:** "\"Intervening Event\" means a change, effect, event, circumstance or development that was not known by the Company or the Company Board as of the date of this Agreement; provided, that in no event shall"
- **Other marker-free COR-category row(s) in this deal:** 6c6ae520 (Uncovered text — Acquisition Proposals; Change of Recommendation), c95b9c8d (Uncovered text — Acquisition Proposals; Change of Recommendation (#3)), 42ae3e17 (Change of Recommendation)

### Amazon.com, Inc. / Whole Foods Market, Inc. — 947b38ce

- **Type:** NOSOL  **Category:** Change of Recommendation
- **Excerpt:** "No Change of Recommendation or Alternative Acquisition Agreement. Except as permitted by Section 6.2(f) and\nSection 6.2(g), the Company Board, including any committee thereof, shall not:\n\n (i) withdra"
- **Other marker-free COR-category row(s) in this deal:** 6c6ae520 (Uncovered text — Acquisition Proposals; Change of Recommendation), c95b9c8d (Uncovered text — Acquisition Proposals; Change of Recommendation (#3)), 42ae3e17 (Change of Recommendation)

