# M2 defined-term annotation gap (Q-0017)

Parenthetical definitions are regex matches on `source_binding.canonical_text` of the form `(the "Company")`, `("Parent")`, `(collectively, the "Parties")`, `(each, a "Party")`, and the same shapes with curly or single quotes. A match is annotated when a sealed M2 `DEFINED_TERM_DEFINITION` overlaps the quoted span or the inner term span. Use counts are existing `DEFINED_TERM_USE` annotations whose `value` equals the term string. Raw occurrences use the same alphanumeric-boundary `indexOf` scan as `agreement-index.js:1840`.

## Annotator

- Quoted-term scan: `lib/canonical-v2/agreement-index.js:1788` — `const quotedTermPattern = /[\u201c"]([^\u201d"\n]{1,120})[\u201d"]/g;`. Accepts straight double and curly double quotes only. Omits straight and curly single quotes.
- Parenthetical-definition predicate: `lib/canonical-v2/agreement-index.js:1809` — `const parentheticalIntroduction = /\((?:the|an?)\s*$/i.test(prefix)`. Requires (the|a|an) immediately before the opening quote, so ("Parent"), (collectively, the "Parties"), and (each, a "Party") fail.
- Combined definition gate: `lib/canonical-v2/agreement-index.js:1811`.
- Drop if never a definition: `lib/canonical-v2/agreement-index.js:1819`.

The annotator's quote handling is not the main cause. 333 of 333 unannotated matches use a quote pair `quotedTermPattern` at lib/canonical-v2/agreement-index.js:1788 already accepts; they fail the definition predicates at lib/canonical-v2/agreement-index.js:1809 (`parentheticalIntroduction` requires `(the|a|an)` immediately before the quote, so `("Parent")`, `(collectively, the "Parties")`, and `(each, a "Party")` never become definitions) and are then dropped at lib/canonical-v2/agreement-index.js:1819. Quote-pattern rejects: 0.

## Corpus

- Matches: **888**. Annotated: **555**. Unannotated: **333**.
- Preamble window only: **99** matches; annotated **67**; unannotated **32**.
- Unannotated matches the annotator quote pattern rejects (line 1788): **0**.
- Unannotated matches the quote pattern accepts but the definition predicates reject (lines 1808–1813): **333**.
- SHA-verified reported spans: **4158**. Stored-hash mismatches: **0**.

## Per agreement

| Agreement | Matches | Annotated | Unannotated | Preamble unann. | Straight " | Curly “ ” | Single |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `06ec30164193` | 75 | 47 | 28 | 2 | 0 | 75 | 0 |
| `08fd217ea256` | 93 | 61 | 32 | 1 | 0 | 93 | 0 |
| `1d6bba9ac993` | 70 | 40 | 30 | 3 | 0 | 70 | 0 |
| `3888fa7618bb` | 118 | 79 | 39 | 3 | 0 | 118 | 0 |
| `b74ed1f02f2e` | 76 | 37 | 39 | 5 | 0 | 76 | 0 |
| `f783c4cdcaca` | 79 | 52 | 27 | 3 | 0 | 79 | 0 |
| `fb76ef57355b` | 125 | 82 | 43 | 5 | 0 | 125 | 0 |
| `f4a123d7c2bd` | 79 | 49 | 30 | 3 | 0 | 79 | 0 |
| `fa0fff26622d` | 75 | 53 | 22 | 4 | 0 | 75 | 0 |
| `aa72f3af2931` | 98 | 55 | 43 | 3 | 0 | 98 | 0 |

## Unannotated terms

### `06ec30164193`

Whole text: `Acquisition Agreement` (raw 6, M2 uses 0); `Canceled Shares` (raw 4, M2 uses 0); `Cash Bonus Plans` (raw 3, M2 uses 0); `Company Representatives` (raw 13, M2 uses 0); `Damages` (raw 4, M2 uses 0); `ERISA` (raw 10, M2 uses 0); `Effect` (raw 51, M2 uses 0); `Environmental Law` (raw 4, M2 uses 0); `Exchange Act` (raw 14, M2 uses 0); `GAAP` (raw 8, M2 uses 0); `Judgment` (raw 7, M2 uses 0); `Law` (raw 87, M2 uses 0); `Legal Proceedings` (raw 2, M2 uses 0); `Legal Restraints` (raw 3, M2 uses 0); `Liens` (raw 19, M2 uses 0); `Multiemployer Plan` (raw 3, M2 uses 0); `OFAC` (raw 3, M2 uses 0); `Parent` (raw 311, M2 uses 0); `Parent Common Stock` (raw 9, M2 uses 0); `Pension Plan` (raw 6, M2 uses 0); `Permits` (raw 4, M2 uses 0); `Permitted Liens` (raw 6, M2 uses 0); `Securities Act` (raw 3, M2 uses 0); `Sub` (raw 112, M2 uses 0); `Subsidiary Converted Shares` (raw 4, M2 uses 0); `Trademarks` (raw 3, M2 uses 0); `Transaction Litigation` (raw 8, M2 uses 0); `Welfare Plan` (raw 3, M2 uses 0)

Preamble only: `Parent` (raw 311, M2 uses 0); `Sub` (raw 112, M2 uses 0)

### `08fd217ea256`

Whole text: `AI Technology` (raw 4, M2 uses 0); `Alternative Financing` (raw 7, M2 uses 0); `Anti-Corruption Laws` (raw 7, M2 uses 0); `Cash Election Shares` (raw 4, M2 uses 0); `Collective Bargaining Agreement` (raw 5, M2 uses 0); `Company Board Recommendation` (raw 25, M2 uses 0); `Company Equity Awards` (raw 12, M2 uses 0); `Company Related Parties` (raw 3, M2 uses 0); `Copyrights` (raw 2, M2 uses 0); `D&O Insurance` (raw 9, M2 uses 0); `Data Protection Laws` (raw 3, M2 uses 0); `EDGAR` (raw 3, M2 uses 0); `Effect` (raw 56, M2 uses 0); `Enforceability Limitations` (raw 3, M2 uses 0); `Guarantor` (raw 9, M2 uses 0); `Indemnified Persons` (raw 7, M2 uses 0); `Intended Tax Treatment` (raw 18, M2 uses 0); `Lender Protective Provisions` (raw 3, M2 uses 0); `Marketing Material` (raw 2, M2 uses 0); `Merger Consideration` (raw 19, M2 uses 0); `Mixed Election Shares` (raw 8, M2 uses 0); `Non-Election Shares` (raw 3, M2 uses 0); `OFAC` (raw 2, M2 uses 0); `Owned Company Share` (raw 2, M2 uses 0); `Parent` (raw 417, M2 uses 0); `Patents` (raw 7, M2 uses 0); `Permits` (raw 6, M2 uses 0); `Registered Company Intellectual Property` (raw 6, M2 uses 0); `Remedies` (raw 5, M2 uses 0); `Tax Returns` (raw 5, M2 uses 0); `Trade Secrets` (raw 3, M2 uses 0); `Trademarks` (raw 4, M2 uses 0)

Preamble only: `Parent` (raw 417, M2 uses 0)

### `1d6bba9ac993`

Whole text: `.pdf` (raw 1, M2 uses 0); `Antitrust Authority` (raw 6, M2 uses 0); `Antitrust Laws` (raw 6, M2 uses 0); `Book-Entry Shares` (raw 9, M2 uses 0); `Certificates` (raw 12, M2 uses 0); `Company 401(k) Plans` (raw 4, M2 uses 0); `Company Common Stock` (raw 63, M2 uses 0); `Company Independent Petroleum Engineers` (raw 4, M2 uses 0); `Company Intellectual Property` (raw 3, M2 uses 0); `Company Material Real Property Lease` (raw 3, M2 uses 0); `Company Owned Real Property` (raw 3, M2 uses 0); `Company Permits` (raw 7, M2 uses 0); `Converted Shares` (raw 4, M2 uses 0); `D&O Insurance` (raw 3, M2 uses 0); `Debt Offer Documents` (raw 8, M2 uses 0); `Divestiture Action` (raw 10, M2 uses 0); `Effect` (raw 93, M2 uses 0); `Excluded Shares` (raw 4, M2 uses 0); `GAAP` (raw 11, M2 uses 0); `Goldman Sachs` (raw 5, M2 uses 0); `Indemnified Liabilities` (raw 3, M2 uses 0); `Letter of Transmittal` (raw 3, M2 uses 0); `Material Company Insurance Policies` (raw 5, M2 uses 0); `Merger Sub` (raw 94, M2 uses 0); `Parent` (raw 923, M2 uses 0); `Parent Common Stock` (raw 80, M2 uses 0); `Parent Permits` (raw 7, M2 uses 0); `Rights-of-Way` (raw 11, M2 uses 0); `Transaction Litigation` (raw 9, M2 uses 0); `e-mail` (raw 3, M2 uses 0)

Preamble only: `Merger Sub` (raw 94, M2 uses 0); `Parent` (raw 923, M2 uses 0); `Parent Common Stock` (raw 80, M2 uses 0)

### `3888fa7618bb`

Whole text: `.pdf` (raw 2, M2 uses 0); `Action` (raw 33, M2 uses 0); `Book-Entry Parent Shares` (raw 3, M2 uses 0); `Company D&O` (raw 3, M2 uses 0); `Company IT Systems` (raw 4, M2 uses 0); `Company Option` (raw 5, M2 uses 0); `Company Request` (raw 6, M2 uses 0); `Company Restricted Stock Award` (raw 3, M2 uses 0); `Company Transfers` (raw 2, M2 uses 0); `Contract` (raw 40, M2 uses 0); `D&O Insurance` (raw 2, M2 uses 0); `EDGAR` (raw 3, M2 uses 0); `ERISA` (raw 21, M2 uses 0); `Effect` (raw 95, M2 uses 0); `Environment` (raw 2, M2 uses 0); `Former Property` (raw 2, M2 uses 0); `Forward Merger Sub` (raw 97, M2 uses 0); `GAAP` (raw 21, M2 uses 0); `Government Antitrust Entity` (raw 8, M2 uses 0); `Laws` (raw 58, M2 uses 0); `Licenses` (raw 6, M2 uses 0); `Lien` (raw 6, M2 uses 0); `Major Customers` (raw 2, M2 uses 0); `Major Suppliers` (raw 2, M2 uses 0); `Material Intellectual Property` (raw 10, M2 uses 0); `Multiemployer Plans` (raw 2, M2 uses 0); `OFAC` (raw 2, M2 uses 0); `Order` (raw 10, M2 uses 0); `PSU Award` (raw 8, M2 uses 0); `Parent` (raw 1038, M2 uses 0); `Parent Benefit Plans` (raw 5, M2 uses 0); `Parent Intervening Event Recommendation Change` (raw 14, M2 uses 0); `Parent Request` (raw 6, M2 uses 0); `QXOBP` (raw 8, M2 uses 0); `RSU Award` (raw 7, M2 uses 0); `SOX` (raw 6, M2 uses 0); `Takeover Statute` (raw 3, M2 uses 0); `Titanium Merger Sub` (raw 115, M2 uses 0); `Transaction Litigation` (raw 7, M2 uses 0)

Preamble only: `Forward Merger Sub` (raw 97, M2 uses 0); `Parent` (raw 1038, M2 uses 0); `Titanium Merger Sub` (raw 115, M2 uses 0)

### `b74ed1f02f2e`

Whole text: `Affected Employees` (raw 8, M2 uses 0); `Antitrust Laws` (raw 6, M2 uses 0); `Appraisal Shares` (raw 4, M2 uses 0); `Behavioral Remedies` (raw 3, M2 uses 0); `Book-Entry Shares` (raw 13, M2 uses 0); `CSA` (raw 3, M2 uses 0); `CUI` (raw 4, M2 uses 0); `Certificate` (raw 25, M2 uses 0); `Company 401(k) Plans` (raw 3, M2 uses 0); `Company Director RSU Award` (raw 6, M2 uses 0); `Company Option` (raw 10, M2 uses 0); `Company Pension Plan` (raw 2, M2 uses 0); `Company RSU Award` (raw 9, M2 uses 0); `DLLCA` (raw 7, M2 uses 0); `Developed` (raw 3, M2 uses 0); `Divestiture Remedies` (raw 3, M2 uses 0); `ERISA Affiliate` (raw 3, M2 uses 0); `Effect` (raw 117, M2 uses 0); `FCLs` (raw 5, M2 uses 0); `Indemnified Liabilities` (raw 3, M2 uses 0); `Merger Subsidiary 1` (raw 36, M2 uses 0); `Notice or Order` (raw 3, M2 uses 0); `OCIs` (raw 2, M2 uses 0); `OFAC` (raw 2, M2 uses 0); `Parent` (raw 505, M2 uses 0); `Parent Preferred Stock` (raw 2, M2 uses 0); `Privacy Laws` (raw 2, M2 uses 0); `Proceeding` (raw 9, M2 uses 0); `Registered Company IP` (raw 9, M2 uses 0); `Rev. Proc. 2018-12` (raw 6, M2 uses 0); `SAM` (raw 2, M2 uses 0); `Sarbanes-Oxley Act` (raw 12, M2 uses 0); `Section 409A` (raw 12, M2 uses 0); `Significant Subsidiaries` (raw 5, M2 uses 0); `Specified Stockholder` (raw 4, M2 uses 0); `Standards Organizations` (raw 2, M2 uses 0); `Tax Proceeding` (raw 4, M2 uses 0); `Transaction Litigation` (raw 10, M2 uses 0); `Transactions` (raw 72, M2 uses 0)

Preamble only: `DLLCA` (raw 7, M2 uses 0); `Merger Subsidiary 1` (raw 36, M2 uses 0); `Parent` (raw 505, M2 uses 0); `Specified Stockholder` (raw 4, M2 uses 0); `Transactions` (raw 72, M2 uses 0)

### `f783c4cdcaca`

Whole text: `Assignee` (raw 7, M2 uses 0); `Company Systems` (raw 9, M2 uses 0); `Consent` (raw 5, M2 uses 0); `Continuing Company Employee` (raw 10, M2 uses 0); `Development Contract` (raw 2, M2 uses 0); `ERISA` (raw 20, M2 uses 0); `GAAP` (raw 8, M2 uses 0); `HIPAA` (raw 3, M2 uses 0); `Health Care Submissions` (raw 4, M2 uses 0); `Indemnified Party` (raw 20, M2 uses 0); `Legal Restraints` (raw 3, M2 uses 0); `Merger Sub` (raw 99, M2 uses 0); `OFAC` (raw 3, M2 uses 0); `Parent` (raw 425, M2 uses 0); `Patents` (raw 9, M2 uses 0); `Permitted Liens` (raw 5, M2 uses 0); `Post-Closing SEC Reports` (raw 5, M2 uses 0); `Privacy Obligations` (raw 4, M2 uses 0); `Proceeding` (raw 36, M2 uses 0); `Representatives` (raw 19, M2 uses 0); `Section 262` (raw 6, M2 uses 0); `Section 409A` (raw 7, M2 uses 0); `Transactions` (raw 72, M2 uses 0); `Union` (raw 5, M2 uses 0); `Voting Company Debt` (raw 4, M2 uses 0)

Preamble only: `Merger Sub` (raw 99, M2 uses 0); `Parent` (raw 425, M2 uses 0); `Transactions` (raw 72, M2 uses 0)

### `fb76ef57355b`

Whole text: `BMO` (raw 4, M2 uses 0); `Book-Entry Share` (raw 9, M2 uses 0); `Book-Entry Unit` (raw 9, M2 uses 0); `COBRA` (raw 3, M2 uses 0); `Certificate` (raw 39, M2 uses 0); `Company Financial Statements` (raw 5, M2 uses 0); `Company Fundamental Representations` (raw 3, M2 uses 0); `Company Leases` (raw 5, M2 uses 0); `Company Merger Sub` (raw 142, M2 uses 0); `Company Title Insurance Policy` (raw 3, M2 uses 0); `DLLCA` (raw 16, M2 uses 0); `ERISA` (raw 21, M2 uses 0); `Effect` (raw 90, M2 uses 0); `Enforcement Costs` (raw 6, M2 uses 0); `Excluded Shares` (raw 9, M2 uses 0); `Excluded Units` (raw 6, M2 uses 0); `GAAP` (raw 19, M2 uses 0); `Huntington` (raw 5, M2 uses 0); `IRS` (raw 9, M2 uses 0); `Indemnified Liabilities` (raw 2, M2 uses 0); `KeyBank` (raw 6, M2 uses 0); `MII` (raw 4, M2 uses 0); `MOP` (raw 5, M2 uses 0); `Material Company Space Lease` (raw 5, M2 uses 0); `New OP Units` (raw 3, M2 uses 0); `OpCo Merger Sub` (raw 124, M2 uses 0); `Parent` (raw 1074, M2 uses 0); `Parent Financial Statements` (raw 2, M2 uses 0); `Parent Fundamental Representations` (raw 3, M2 uses 0); `Parent OP Units` (raw 22, M2 uses 0); `Parent OpCo` (raw 186, M2 uses 0); `Parent Series A Preferred Stock` (raw 3, M2 uses 0); `Parent Series B Preferred Stock` (raw 3, M2 uses 0); `Parent Series D Preferred Stock` (raw 3, M2 uses 0); `Parent Series E Preferred Stock` (raw 3, M2 uses 0); `Participation Agreements` (raw 3, M2 uses 0); `Permit` (raw 7, M2 uses 0); `REIT Merger Sub` (raw 4, M2 uses 0); `Takeover Statutes` (raw 7, M2 uses 0); `Transaction Litigation` (raw 7, M2 uses 0); `Truist Bank` (raw 3, M2 uses 0); `WARN` (raw 4, M2 uses 0)

Preamble only: `Company Merger Sub` (raw 142, M2 uses 0); `DLLCA` (raw 16, M2 uses 0); `OpCo Merger Sub` (raw 124, M2 uses 0); `Parent` (raw 1074, M2 uses 0); `Parent OpCo` (raw 186, M2 uses 0)

### `f4a123d7c2bd`

Whole text: `Assignee` (raw 7, M2 uses 0); `Book-Entry Shares` (raw 11, M2 uses 0); `Certificates` (raw 17, M2 uses 0); `Company 401(k) Plans` (raw 3, M2 uses 0); `Company Representative` (raw 2, M2 uses 0); `Company Warrants` (raw 13, M2 uses 12); `Continuing Employee` (raw 9, M2 uses 0); `Corporation` (raw 70, M2 uses 0); `DGCL` (raw 29, M2 uses 28); `Delaware Law` (raw 9, M2 uses 0); `GAAP` (raw 9, M2 uses 0); `Guarantor` (raw 116, M2 uses 0); `Indemnified Persons` (raw 13, M2 uses 0); `Merger Sub` (raw 115, M2 uses 0); `Parent` (raw 454, M2 uses 0); `Patents` (raw 5, M2 uses 0); `Regulatory Authorizations` (raw 7, M2 uses 0); `Sanctioned Jurisdiction` (raw 3, M2 uses 0); `Section 409A` (raw 8, M2 uses 0); `Share` (raw 33, M2 uses 0); `Trade Secrets` (raw 4, M2 uses 0); `Transaction` (raw 42, M2 uses 0); `Transfer` (raw 15, M2 uses 0)

Preamble only: `Guarantor` (raw 116, M2 uses 0); `Merger Sub` (raw 115, M2 uses 0); `Parent` (raw 454, M2 uses 0)

### `fa0fff26622d`

Whole text: `Affiliate Transaction` (raw 3, M2 uses 0); `Book-Entry Share` (raw 15, M2 uses 0); `Company Common Stock` (raw 21, M2 uses 20); `Company Stock Option` (raw 7, M2 uses 0); `Company Systems` (raw 6, M2 uses 0); `Computershare` (raw 28, M2 uses 25); `Current Employee` (raw 15, M2 uses 0); `ERISA` (raw 17, M2 uses 0); `Healthcare Correspondence` (raw 2, M2 uses 0); `Labor Agreements` (raw 2, M2 uses 0); `Nasdaq` (raw 7, M2 uses 0); `OECD` (raw 5, M2 uses 0); `OFAC` (raw 5, M2 uses 0); `Parent` (raw 433, M2 uses 431); `Purchaser` (raw 267, M2 uses 265); `Relevant Products` (raw 2, M2 uses 0); `Sarbanes-Oxley` (raw 5, M2 uses 0); `Tender and Support Agreements` (raw 7, M2 uses 0); `WARN` (raw 3, M2 uses 0)

Preamble only: `Company Common Stock` (raw 21, M2 uses 20); `Parent` (raw 433, M2 uses 431); `Purchaser` (raw 267, M2 uses 265); `Tender and Support Agreements` (raw 7, M2 uses 0)

### `aa72f3af2931`

Whole text: `AI Technology` (raw 6, M2 uses 0); `Assumed Option` (raw 6, M2 uses 0); `Assumed Unit` (raw 4, M2 uses 0); `Book-Entry Share` (raw 4, M2 uses 0); `Class A Common Stock` (raw 11, M2 uses 0); `Class B Common Stock` (raw 5, M2 uses 0); `Class C Common Stock` (raw 5, M2 uses 0); `Company Common Stock` (raw 16, M2 uses 0); `Company Counsel` (raw 4, M2 uses 0); `Company Equity Interests` (raw 3, M2 uses 0); `Company Financial Statements` (raw 6, M2 uses 0); `Company Material Contract` (raw 16, M2 uses 0); `Company Preferred Stock` (raw 3, M2 uses 0); `Constituent Corporations` (raw 3, M2 uses 0); `Continuing Employee` (raw 11, M2 uses 0); `D&O Indemnification Agreements` (raw 4, M2 uses 0); `EU` (raw 4, M2 uses 0); `Electronic Delivery` (raw 5, M2 uses 0); `Fannie Mae` (raw 3, M2 uses 0); `Freddie Mac` (raw 3, M2 uses 0); `Ginnie Mae` (raw 3, M2 uses 0); `Hedge Counterparty` (raw 4, M2 uses 0); `Insurance Policies` (raw 5, M2 uses 0); `Leased Real Property` (raw 5, M2 uses 0); `Merger Consideration` (raw 12, M2 uses 0); `Merger Sub` (raw 114, M2 uses 0); `New Plans` (raw 2, M2 uses 0); `OFAC` (raw 3, M2 uses 0); `Open Source Technology` (raw 3, M2 uses 0); `Other Required Filings` (raw 3, M2 uses 0); `Parent` (raw 550, M2 uses 0); `Parent Equity Interests` (raw 3, M2 uses 0); `Parent Financial Statements` (raw 4, M2 uses 0); `Parent Preferred Stock` (raw 3, M2 uses 0); `Parent Representatives` (raw 4, M2 uses 0); `Processing` (raw 3, M2 uses 0); `Repurchase Obligations` (raw 4, M2 uses 0); `Security Incidents` (raw 2, M2 uses 0); `Stockholder Litigation` (raw 5, M2 uses 0); `Transactions` (raw 112, M2 uses 0); `UK` (raw 2, M2 uses 0); `UN` (raw 2, M2 uses 0)

Preamble only: `Merger Sub` (raw 114, M2 uses 0); `Parent` (raw 550, M2 uses 0); `Transactions` (raw 112, M2 uses 0)

