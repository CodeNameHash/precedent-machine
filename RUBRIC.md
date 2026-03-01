# Provision Rubric — Canonical Codes for Cross-Deal Comparison

Derived from 6 precedent agreements:
- **A** — Pfizer / Seagen (2023)
- **B** — Tiffany / LVMH (2019)
- **C** — Pfizer / Metsera (2025)
- **D** — Diamondback / Endeavor (2024)
- **F** — Goodyear / Cooper Tire (2021)
- **G** — Heinz / Kraft (2015)

Each code represents a **specific concept** that can be compared across deals, regardless of section numbering, ordering, or exact wording.

---

## Classification Modes

Most provision types use **single-code** classification: one provision = one code.

**NOSOL** and **ANTI** use **multi-code** classification: a single passage of text may be tagged with multiple codes, and the same concept may be spread across multiple passages. This reflects how these provisions are actually drafted — as dense, interlocking paragraphs where solicitation prohibition, fiduciary out, notice, and matching rights are woven together rather than cleanly separated. The comparison engine should allow overlapping text spans across codes within these categories.

---

## STRUCT — Merger Structure & Mechanics

| Code | Label | A | B | C | D | F | G |
|------|-------|---|---|---|---|---|---|
| STRUCT-MERGER | The Merger | x | x | x | x | x | x |
| STRUCT-CLOSING | Closing | x | x | x | x | x | x |
| STRUCT-EFFTIME | Effective Time | x | x | x | x | x | x |
| STRUCT-EFFECTS | Effects of the Merger | - | x | x | x | x | x |
| STRUCT-CHARTER | Certificate of Incorporation / Bylaws | x | x | x | x | x | x |
| STRUCT-DIRECTORS | Directors and Officers | x | x | x | x | x | - |
| STRUCT-ACTIONS | Subsequent Actions | x | - | - | - | x | - |

## CONSID — Consideration & Securities Treatment

| Code | Label | A | B | C | D | F | G |
|------|-------|---|---|---|---|---|---|
| CONSID-CONVERT | Conversion of Shares / Effect on Capital Stock | x | x | x | x | x | x |
| CONSID-EXCHANGE | Exchange of Certificates / Payment Mechanics | x | x | x | - | x | x |
| CONSID-EQUITY | Treatment of Equity Awards / Stock Plans | x | x | x | - | x | - |
| CONSID-DISSENT | Dissenting / Appraisal Rights | x | - | - | - | x | - |
| CONSID-WITHHOLD | Withholding Rights | x | - | - | x | - | - |
| CONSID-ADJUST | Anti-Dilution Adjustments | - | x | - | x | x | - |

## REP-T — Representations & Warranties (Target / Company)

| Code | Label | A | B | C | D | F | G |
|------|-------|---|---|---|---|---|---|
| REP-T-ORG | Organization; Qualification; Standing | x | x | x | x | x | x |
| REP-T-CAP | Capitalization; Subsidiaries | x | x | x | x | x | x |
| REP-T-AUTH | Authority; Enforceability | x | x | x | x | x | x |
| REP-T-NOCONFLICT | No Conflict; Required Filings and Consents | x | x | x | x | x | x |
| REP-T-SEC | SEC Documents; Financial Statements | x | x | x | - | x | x |
| REP-T-FINSTMT | Financial Statements; No Liabilities (non-SEC filers) | - | - | - | x | - | - |
| REP-T-NOCHANGE | Absence of Certain Changes or Events | x | x | x | x | x | x |
| REP-T-NOLIAB | No Undisclosed Liabilities | x | - | - | - | x | - |
| REP-T-LIT | Litigation; Legal Proceedings | x | x | x | x | x | x |
| REP-T-COMPLY | Compliance with Laws; Permits; Licenses | x | x | x | x | x | x |
| REP-T-BENEFITS | Employee Benefit Plans; ERISA | x | x | x | - | x | x |
| REP-T-LABOR | Labor Matters; Relations | x | x | x | x | x | - |
| REP-T-TAX | Taxes; Tax Returns | x | x | x | x | x | x |
| REP-T-CONTRACTS | Material Contracts | x | x | x | x | x | x |
| REP-T-IP | Intellectual Property | x | x | x | x | x | x |
| REP-T-PROPERTY | Real Property; Personal Property; Title | x | x | x | x | x | - |
| REP-T-ENV | Environmental Matters | x | x | x | x | x | x |
| REP-T-INSURANCE | Insurance | x | x | x | - | x | - |
| REP-T-BROKERS | Brokers; Finders | x | x | x | x | x | x |
| REP-T-ANTICORR | Anti-Corruption; Sanctions | x | - | x | - | - | x |
| REP-T-PRIVACY | Data Privacy; Information Security; Cybersecurity | x | x | x | - | x | - |
| REP-T-TAKEOVER | Takeover Statutes; Anti-Takeover | x | x | - | - | x | x |
| REP-T-FAIRNESS | Opinion of Financial Advisor | x | x | x | x | x | x |
| REP-T-RPT | Related Party / Affiliate / Interested-Party Transactions | x | x | x | x | x | x |
| REP-T-PROXY | Information Supplied / Proxy Statement | x | - | x | x | x | - |
| REP-T-NOREP | No Other Representations or Warranties | x | x | - | x | x | x |
| REP-T-PRODUCT | Product Liability; Product Recall; Quality & Safety | x | - | x | - | x | x |
| REP-T-SUPPLY | Suppliers | x | - | - | - | - | - |
| REP-T-FDA | FDA / Healthcare Regulatory | x | - | x | - | - | - |
| REP-T-CONTROLS | Internal Controls; Disclosure Controls | - | x | - | - | - | x |
| REP-T-SANCTIONS | Global Trade Control Laws; Sanctions | - | - | x | - | - | - |
| REP-T-OIL | Oil & Gas Leases; Rights-of-Way | - | - | - | x | - | - |
| REP-T-WELLS | Wells and Equipment | - | - | - | x | - | - |
| REP-T-RESERVE | Reserve Reports | - | - | - | x | - | - |
| REP-T-REGSTATUS | Regulatory Status | - | - | - | x | - | - |
| REP-T-CONSENT | Consents and Approvals (separate from No Conflict) | - | - | - | x | - | - |

## REP-B — Representations & Warranties (Buyer / Parent)

| Code | Label | A | B | C | D | F | G |
|------|-------|---|---|---|---|---|---|
| REP-B-ORG | Organization; Qualification; Standing | x | x | x | x | x | x |
| REP-B-AUTH | Authority; Enforceability | x | x | x | x | x | x |
| REP-B-NOCONFLICT | No Conflict; Required Filings and Consents | x | x | x | x | x | x |
| REP-B-LIT | Litigation; Legal Proceedings | x | x | x | x | x | x |
| REP-B-BROKERS | Brokers; Finders | x | x | x | x | x | x |
| REP-B-FUNDS | Sufficient / Available Funds; Financing | x | x | x | x | x | - |
| REP-B-MERGESUB | Merger Sub; No Prior Activities | x | - | x | x | x | x |
| REP-B-PROXY | Information Supplied / Proxy Statement | x | - | x | - | x | x |
| REP-B-VOTE | Vote / Approval Required | x | - | - | - | x | - |
| REP-B-NOINTEREST | No Interested Stockholder; Ownership of Stock | x | x | x | - | x | - |
| REP-B-NOREP | No Other Representations or Warranties | x | x | - | x | x | x |
| REP-B-CAP | Capitalization (public buyer) | - | - | - | x | x | x |
| REP-B-SEC | SEC Documents; Financial Statements (public buyer) | - | - | - | x | x | x |
| REP-B-NOCHANGE | Absence of Certain Changes (public buyer) | - | - | - | x | x | x |
| REP-B-NOLIAB | No Undisclosed Liabilities (public buyer) | - | - | - | - | x | - |
| REP-B-TAX | Taxes (public buyer) | - | - | - | x | x | x |
| REP-B-COMPLY | Compliance with Laws (public buyer) | - | - | - | x | x | x |
| REP-B-BENEFITS | Employee Benefit Plans (public buyer) | - | - | - | - | x | x |
| REP-B-ENV | Environmental (public buyer) | - | - | - | x | - | - |
| REP-B-IP | Intellectual Property (public buyer) | - | - | - | x | - | - |
| REP-B-CONTRACTS | Material Contracts (public buyer) | - | - | - | x | - | - |
| REP-B-SOLVENCY | Solvency | - | - | - | - | x | - |
| REP-B-LABOR | Labor Matters (public buyer) | - | x | - | x | - | - |
| REP-B-EQUITY | Equity Investment | - | - | - | - | - | x |
| REP-B-FAIRNESS | Opinion of Financial Advisor (buyer) | - | - | - | x | - | x |
| REP-B-NORIGHTS | No Rights Plan | - | - | - | x | - | - |

## IOC — Interim Operating Covenants (sub-clauses)

These are the (a)/(b)/(c) sub-clauses within the "Conduct of Business" section. Canonical codes for the restrictions typically imposed:

| Code | Label | Description |
|------|-------|-------------|
| IOC-ORDINARY | Ordinary Course Obligation | General obligation to conduct business in the ordinary course |
| IOC-CHARTER | Charter / Bylaws Amendments | No amendments to certificate of incorporation or bylaws |
| IOC-MERGE | Mergers, Acquisitions, Dispositions | No mergers, acquisitions, sales of material assets |
| IOC-ISSUE | Issuance of Securities | No issuance, sale, or pledge of equity securities |
| IOC-REPURCHASE | Share Repurchases | No repurchase or redemption of equity securities |
| IOC-DIVIDEND | Dividends and Distributions | No declaration or payment of dividends |
| IOC-SPLIT | Stock Splits / Reclassifications | No splits, combinations, subdivisions, reclassifications |
| IOC-DEBT | Indebtedness | No incurrence of indebtedness or guarantees |
| IOC-LIEN | Liens and Encumbrances | No creation of liens on material assets |
| IOC-CAPEX | Capital Expenditures | Restrictions on capital expenditures |
| IOC-COMP | Compensation and Benefits | No increases in compensation, bonuses, new plans |
| IOC-HIRE | Hiring and Termination | Restrictions on hiring/firing above certain levels |
| IOC-SETTLE | Settlement of Claims | No settlement of material litigation |
| IOC-TAX | Tax Elections and Filings | No material changes in tax elections, methods, or filings |
| IOC-ACCOUNTING | Accounting Changes | No changes in accounting methods or principles |
| IOC-CONTRACT | Material Contracts | No entry into, modification, or termination of material contracts |
| IOC-IP | Intellectual Property | No licensing, transfer, or abandonment of material IP |
| IOC-INSURANCE | Insurance Policies | No cancellation or material change to insurance |
| IOC-REALPROP | Real Property | No acquisition, sale, or lease of real property |
| IOC-WAIVE | Waiver of Rights | No waiver or release of material claims or rights |
| IOC-AFFILIATE | Affiliate Transactions | No entry into transactions with affiliates |
| IOC-ENVIRO | Environmental | No actions that would create material environmental liability |
| IOC-COMMIT | Commitments | No agreement or commitment to do any of the foregoing |

## NOSOL — No-Solicitation / No-Shop (multi-code)

> **Multi-code category.** A single paragraph may be tagged with multiple NOSOL codes, and the same concept may appear across multiple paragraphs. The comparison engine should support overlapping text spans.

| Code | Label | Description |
|------|-------|-------------|
| NOSOL-PROHIBIT | Solicitation Prohibition | Core no-shop / no-solicitation restriction |
| NOSOL-CEASE | Cease Existing Discussions | Obligation to cease and terminate pre-signing discussions |
| NOSOL-EXCEPT | Exceptions / Fiduciary Out | Conditions under which board may engage with unsolicited proposals |
| NOSOL-SUPERIOR | Superior Proposal Definition | Definition and criteria for what constitutes a "superior proposal" |
| NOSOL-ACQPROPOSAL | Acquisition Proposal Definition | Definition of "acquisition proposal" / "competing proposal" |
| NOSOL-NOTICE | Notice to Counterparty | Obligation to promptly notify buyer of receipt of competing proposals |
| NOSOL-DISCLOSE | Disclosure of Terms | Obligation to share identity of bidder and material terms of proposals |
| NOSOL-MATCH | Matching Rights | Buyer's right to match or improve offer before board acts |
| NOSOL-NEGOTIATE | Negotiation Period | Specific time period for buyer to negotiate/match (e.g. 4 business days) |
| NOSOL-REMATCH | Subsequent Matching / Amendment Rights | Re-matching rights on material amendments to competing proposal |
| NOSOL-RECOMMEND | Change of Recommendation | Board's right and process to withdraw or change its recommendation |
| NOSOL-INTERVENING | Intervening Event | Rights related to intervening events distinct from competing proposals |
| NOSOL-WINDOW | Go-Shop / Window Shop | Active solicitation window period (if any); post-window transition |
| NOSOL-ENFORCE | Enforcement of Standstills | Obligation to enforce or not waive existing standstill/NDA obligations |
| NOSOL-WAIVER | Standstill Waiver / Don't-Ask-Don't-Waive | Whether target can waive standstills; DADW provisions |
| NOSOL-INFORMATION | Provision of Information to Bidder | Conditions for providing non-public information to a third-party bidder |
| NOSOL-CONFID | Confidentiality Agreement Requirement | Requirement for acceptable confidentiality agreement with bidder |

## ANTI — Antitrust / Regulatory Efforts (multi-code)

> **Multi-code category.** Antitrust provisions are often drafted as long, interlocking sections where filing obligations, efforts standards, and remedy caps are interleaved. A single passage may be tagged with multiple ANTI codes.

| Code | Label | Description |
|------|-------|-------------|
| ANTI-FILING | HSR / Regulatory Filings | Obligation to promptly make HSR and other antitrust filings |
| ANTI-EFFORTS | Standard of Efforts | Efforts standard — reasonable best efforts, commercially reasonable, etc. |
| ANTI-COOPERATE | Cooperation | Mutual cooperation obligations in dealing with regulators |
| ANTI-INFO | Information to Regulators | Obligation to provide information and documents to regulators |
| ANTI-BURDEN | Burden Cap / Divestiture Limits | Limits on required divestitures, hold-separates, behavioral remedies, or other burdensome conditions; hell-or-high-water is the absence of any such cap |
| ANTI-NOACTION | No Inconsistent Action | Prohibition on actions that would impede or delay regulatory clearance |
| ANTI-FOREIGN | Foreign Regulatory Approvals | Non-US antitrust/regulatory filings and approvals (EU, China, etc.) |
| ANTI-INTERIM | Interim Compliance | Operating restrictions during regulatory review period |
| ANTI-NOTIFY | Notification of Developments | Obligation to notify counterparty of material regulatory developments |
| ANTI-LITIGATION | Litigation Against Regulators | Obligation (or right) to litigate/challenge adverse regulatory action |
| ANTI-CONSULT | Consultation Rights | Right to review and comment on filings and communications with regulators |
| ANTI-TIMING | Timing Agreements | Agreements on timing of filings, pull-and-refile, extensions |

## COND — Conditions to Closing

Conditions are grouped by whose obligation they condition: both parties (M), buyer only (B), or seller/target only (S).

### Conditions to Both Parties (Mutual)

| Code | Label | Description |
|------|-------|-------------|
| COND-M-LEGAL | No Legal Impediment | No injunction, order, or law preventing closing |
| COND-M-REG | Regulatory Approvals | HSR expiration/termination and other required regulatory approvals |
| COND-M-STOCKHOLDER | Stockholder Approval | Company stockholder vote obtained |
| COND-M-S4 | Form S-4 Effectiveness | Registration statement effective (stock deals) |
| COND-M-LISTING | Stock Exchange Listing | Buyer shares approved for listing (stock deals) |

### Conditions to Buyer's Obligation

| Code | Label | Description |
|------|-------|-------------|
| COND-B-REP | Accuracy of Target Reps | Target's representations are true and correct (at specified standard) |
| COND-B-COV | Target Covenant Compliance | Target has performed its covenants in all material respects |
| COND-B-MAE | No Target MAE | No material adverse effect on the target since signing |
| COND-B-CERT | Officer's Certificate (Target) | Delivery of target officer's certificate confirming reps/covenants |
| COND-B-DISSENT | Dissenting Shares Threshold | Dissenting shares below specified threshold (if applicable) |

### Conditions to Seller's / Target's Obligation

| Code | Label | Description |
|------|-------|-------------|
| COND-S-REP | Accuracy of Buyer Reps | Buyer's representations are true and correct (at specified standard) |
| COND-S-COV | Buyer Covenant Compliance | Buyer has performed its covenants in all material respects |
| COND-S-CERT | Officer's Certificate (Buyer) | Delivery of buyer officer's certificate confirming reps/covenants |
| COND-S-FUNDS | Availability of Funds | Buyer has funds available to pay merger consideration |

### Condition Modifiers

| Code | Label | Description |
|------|-------|-------------|
| COND-FRUSTRATE | Frustration of Conditions | Party cannot invoke failure of condition it caused |
| COND-TAXOPINION | Tax Opinion | Receipt of required tax opinions as condition |

## TERMR — Termination Rights

| Code | Label | Description |
|------|-------|-------------|
| TERMR-MUTUAL | Mutual Termination | Termination by mutual written consent |
| TERMR-OUTSIDE | Outside Date | Termination if closing hasn't occurred by outside date |
| TERMR-EXTENSION | Outside Date Extension | Automatic or optional extension of the outside date |
| TERMR-LEGAL | Legal Impediment | Termination due to final, non-appealable injunction or legal bar |
| TERMR-VOTE | Stockholder Vote Failure | Termination if stockholder approval not obtained at meeting |
| TERMR-BREACH-T | Target Breach | Buyer's right to terminate for target's uncured material breach |
| TERMR-BREACH-B | Buyer Breach | Target's right to terminate for buyer's uncured material breach |
| TERMR-SUPERIOR | Superior Proposal | Target's right to terminate to accept a superior proposal |
| TERMR-RECOMMEND | Change of Recommendation | Buyer's right to terminate upon target board's change of recommendation |

## TERMF — Termination Fees & Expenses

| Code | Label | Description |
|------|-------|-------------|
| TERMF-TARGET | Company Termination Fee | Fee payable by the target company (amount and trigger) |
| TERMF-REVERSE | Reverse Termination Fee | Fee payable by the buyer (amount and trigger) |
| TERMF-EXPENSE | Expense Reimbursement | Expense reimbursement obligations on termination |
| TERMF-TAIL | Tail Provision | Fee triggered by subsequent alternative transaction within specified period |
| TERMF-EFFECT | Effect of Termination | Consequences and limitations on liability post-termination |
| TERMF-SOLE | Sole and Exclusive Remedy | Fee as sole remedy / liability cap provision |

## DEF — Definitions

Key defined terms that are substantively negotiated and vary across deals. Each term gets its own code for cross-deal comparison.

### Core Negotiated Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-MAE | Material Adverse Effect | Core MAE definition — what constitutes an MAE on the company |
| DEF-MAE-CARVEOUT | MAE Carve-Outs | Enumerated exceptions (market conditions, industry changes, law changes, etc.) |
| DEF-MAE-DISPROP | MAE Disproportionate Impact | "Except to the extent disproportionately affected" qualifier on carve-outs |
| DEF-SUPERIOR | Superior Proposal | Definition of what constitutes a "superior proposal" |
| DEF-ACQPROPOSAL | Acquisition Proposal | Definition of "acquisition proposal" / "takeover proposal" / "competing transaction" |
| DEF-INTERVENING | Intervening Event | Definition of "intervening event" (if the concept exists in the deal) |
| DEF-KNOWLEDGE | Knowledge | Knowledge standard — actual knowledge, constructive knowledge, inquiry obligation |
| DEF-ORDINARY | Ordinary Course of Business | Meaning of "ordinary course" and any "consistent with past practice" qualifier |
| DEF-BURDENSOME | Burdensome Condition | Definition of what constitutes a "burdensome condition" for regulatory remedies |
| DEF-WILLFUL | Willful Breach | Definition of "willful breach" or "intentional breach" (impacts liability caps) |

### Structural / Entity Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-SUBSIDIARY | Subsidiary | Definition of subsidiary and what entities are included |
| DEF-AFFILIATE | Affiliate | Definition of affiliate |
| DEF-PERSON | Person | Definition of person (natural persons, entities, governmental authorities) |
| DEF-REPRESENTATIVE | Representatives | Definition of who constitutes "representatives" (advisors, agents, etc.) |
| DEF-COMPANY | Company / Target | Definition of the target entity and its coverage |

### Financial / Contractual Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-LIEN | Lien | Definition of lien, mortgage, pledge, encumbrance |
| DEF-PERMITLIEN | Permitted Liens | Exceptions to lien restrictions (statutory liens, tax liens, etc.) |
| DEF-CONTRACT | Contract | What constitutes a "contract" under the agreement |
| DEF-MATCONTRACT | Material Contract | Criteria for what makes a contract "material" |
| DEF-INDEBTEDNESS | Indebtedness | Definition of indebtedness for covenant and condition purposes |
| DEF-BUSINESSDAY | Business Day | Business day definition (jurisdiction, exclusions) |

### Securities & Equity Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-MERGERCONSID | Merger Consideration | Definition of the consideration payable per share |
| DEF-EQUITYAWARD | Company Equity Awards | What equity instruments are covered (options, RSUs, PSUs, warrants) |
| DEF-DISSENTING | Dissenting Shares | Definition and treatment of dissenting/appraisal shares |

### Regulatory Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-GOVAUTH | Governmental Authority | What bodies constitute a governmental authority |
| DEF-LAW | Law | Definition of "law" (statutes, regulations, orders, etc.) |
| DEF-PERMIT | Permit | Definition of permits, licenses, authorizations |
| DEF-REQUIREDAPPROVAL | Required Approvals | Specific regulatory approvals needed for closing |

### Employee / Benefits Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-BENEFITPLAN | Company Benefit Plan | What employee plans are covered |
| DEF-COMPANYEMPLOYEE | Company Employees | Which employees are covered by post-closing obligations |

### Tax Definitions

| Code | Label | Description |
|------|-------|-------------|
| DEF-TAX | Tax / Taxes | Definition of taxes |
| DEF-TAXRETURN | Tax Return | Definition of tax returns |

### General / Interpretive

| Code | Label | Description |
|------|-------|-------------|
| DEF-GENERAL | General Definitions Section | Main definitions section or cross-reference table |
| DEF-INTERP | Interpretation / Construction | Rules of interpretation (including, without limitation, etc.) |
| DEF-MADE-AVAILABLE | Made Available | What "made available" or "furnished" means (data room, SEC filings) |
| DEF-DISCLOSURELETTER | Company Disclosure Letter | Scope and effect of the disclosure letter/schedules |

## COV — Other Covenants (Additional Agreements)

| Code | Label | Description |
|------|-------|-------------|
| COV-ACCESS | Access to Information; Confidentiality | Buyer's access to target's books, records, personnel |
| COV-PROXY | Proxy Statement Preparation | Preparation and filing of proxy statement |
| COV-MEETING | Stockholders Meeting | Obligation to hold and recommend at stockholder meeting |
| COV-PUBLICITY | Public Announcements; Disclosure | Coordination of public communications |
| COV-INDEMN | Indemnification; D&O Insurance | Post-closing D&O indemnification and insurance tail |
| COV-EMPLOYEE | Employee Matters; Benefits | Post-closing employee benefit obligations |
| COV-TAKEOVER | Takeover Laws | Obligation to prevent anti-takeover statutes from applying |
| COV-NOTIFY | Notification of Certain Matters | Obligation to notify of material developments |
| COV-LITNOTIFY | Stockholder / Transaction Litigation | Coordination on stockholder litigation |
| COV-16B | Rule 16b-3 / Section 16 Matters | Section 16 exemption for insider transactions |
| COV-RESIGN | Director Resignations | Company director resignations at closing |
| COV-FINANCING | Financing; Financing Cooperation | Buyer financing and target's cooperation obligations |
| COV-DELIST | Stock Exchange Delisting; Deregistration | Post-closing delisting and deregistration |
| COV-LIST | Stock Exchange Listing | Listing of new shares (stock-for-stock) |
| COV-FURTHER | Further Assurances | General obligation to take further actions |
| COV-SECREPORT | Post-Closing SEC Reports | Post-closing SEC reporting obligations |
| COV-TAXMATTERS | Tax Matters | Tax-related covenants and cooperation |
| COV-DEBT | Treatment of Existing Indebtedness / Notes | Handling of target's existing debt |
| COV-MERGESUB | Merger Sub Compliance | Obligations regarding merger sub |
| COV-DIVIDEND | Coordination of Dividends | Coordination of dividend payments pre-closing |
| COV-CONSENT | Delivery of Written Consents | Delivery of required consents |
| COV-PAYOFF | Payoff Letters | Delivery of payoff letters |
| COV-CVR | CVR Agreement | Contingent value rights agreement |

## MISC — Miscellaneous / General Provisions

| Code | Label | Description |
|------|-------|-------------|
| MISC-SURVIVAL | No Survival / Nonsurvival | Survival (or not) of representations post-closing |
| MISC-NOTICES | Notices | Notice addresses and mechanics |
| MISC-ENTIRE | Entire Agreement | Integration / entire agreement clause |
| MISC-GOVLAW | Governing Law | Choice of governing law |
| MISC-JURISD | Jurisdiction; Venue | Submission to jurisdiction and venue |
| MISC-JURY | Waiver of Jury Trial | Jury trial waiver |
| MISC-ASSIGN | Assignment; Successors | Assignment restrictions and successors |
| MISC-SEVER | Severability | Severability of invalid provisions |
| MISC-COUNTER | Counterparts | Execution in counterparts |
| MISC-SPECIFIC | Specific Performance; Enforcement | Right to specific performance |
| MISC-THIRDPARTY | Third-Party Beneficiaries | No third-party beneficiary rights (with exceptions) |
| MISC-AMEND | Amendment; Modification | Process for amending the agreement |
| MISC-WAIVER | Waiver; Extension | Waiver mechanics |
| MISC-EXPENSES | Expenses (if separate from TERMF) | General expense allocation |
| MISC-CONSTRUCT | Rules of Construction; Interpretation | Interpretive provisions |

---

## Code Frequency Summary

**Universal (all 6 deals):**
STRUCT-MERGER, STRUCT-CLOSING, STRUCT-EFFTIME, STRUCT-CHARTER, CONSID-CONVERT, REP-T-ORG, REP-T-CAP, REP-T-AUTH, REP-T-NOCONFLICT, REP-T-NOCHANGE, REP-T-LIT, REP-T-COMPLY, REP-T-TAX, REP-T-CONTRACTS, REP-T-IP, REP-T-ENV, REP-T-BROKERS, REP-T-FAIRNESS, REP-T-RPT, REP-B-ORG, REP-B-AUTH, REP-B-NOCONFLICT, REP-B-LIT, REP-B-BROKERS, DEF-MAE, DEF-KNOWLEDGE, MISC-NOTICES, MISC-GOVLAW, MISC-JURY, MISC-SEVER, MISC-COUNTER, MISC-SPECIFIC

**Near-universal (5/6 deals):**
STRUCT-DIRECTORS, CONSID-EXCHANGE, CONSID-EQUITY, REP-T-SEC, REP-T-BENEFITS, REP-T-LABOR, REP-T-PROPERTY, REP-T-NOREP, REP-B-FUNDS, REP-B-NOREP, COV-EMPLOYEE, COV-INDEMN, COV-PUBLICITY, ANTI-EFFORTS, COND-M-LEGAL, COND-M-STOCKHOLDER, TERMR-MUTUAL, TERMR-OUTSIDE, MISC-ENTIRE, MISC-ASSIGN

**Industry-specific (1-2 deals):**
REP-T-FDA, REP-T-SUPPLY, REP-T-OIL, REP-T-WELLS, REP-T-RESERVE, REP-B-SOLVENCY, REP-B-EQUITY, COV-CVR

---

## Notes for Implementation

1. **AI Classification**: Each parsed provision should be classified against this rubric using AI. The prompt should include the code, label, and description to match against.

2. **Unknown Handling**: If a provision doesn't match any code, assign `UNKNOWN` and flag for manual recoding on the recode page.

3. **Multi-Code (NOSOL, ANTI)**: These categories allow a single text passage to carry multiple codes with overlapping character ranges. The AI classifier should return all applicable codes for a given passage, not just the "best" one.

4. **Single-Code (all others)**: Most categories use single-code assignment. If a provision covers multiple concepts, assign the primary code. Do not artificially split — the text stays as one provision.

5. **Industry Codes**: Sector-specific codes (REP-T-OIL, REP-T-FDA, etc.) remain in the rubric. The comparison view shows "N/A" or "Not Applicable" for deals in other sectors.

6. **Sub-clause vs. Section Codes**: IOC, NOSOL, and ANTI codes apply at the (a)/(b)/(c) sub-clause level (or paragraph level for multi-code). All other codes apply at the section level.

7. **Definitions**: DEF codes are special — they may be scattered across a single massive "Definitions" section, an annex, or inline throughout the agreement. The parser should extract individual defined terms and classify each one.

8. **Conditions Split**: COND codes use M/B/S prefixes to distinguish whose obligation is conditioned. This is critical because the same concept (e.g., accuracy of reps) has different significance depending on which party's closing it conditions.
