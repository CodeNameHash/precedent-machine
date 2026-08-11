# REPRESENTATIONS limb-assertion topic mining

Evidence-gathering note for the 2Y-H topic vocabulary decision. Written
2026-08-10 against `claude/codex-handoff-plan-status-77wn7n` @ `d600cea9`
(== `main`). **Mining only — no taxonomy proposed here.**

## 0. Denominator, established before anything else

Selector: `scripts/canonical-v2-corpus-review-artifact.mjs:isFinalCorpusRun`
= `name.includes('20260809-2xk') && name.endsWith('-final')`. 157 runs, 17 of
them `REPRESENTATIONS`.

Rows counted: `resolution.json` → `open_world[]` where
`reason === 'UNMAPPED_GENERIC_CLAIM_KEY'` and `claim_definition_key ===
'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'`.

**623 rows, independently recounted here, matching
`stage-2y-h-representation-topic-replay.json`'s asserted denominator.**

| deal | limb rows | reps runs |
|---|---:|---:|
| skechers | 153 | 4 (r1a–r1d) |
| metsera | 150 | 3 (r1a–r1c) |
| skywater | 139 | 4 (r1a–r1d) |
| concho | 134 | 4 (r1a–r1d) |
| topbuild | 31 | 1 |
| redhat | 16 | 1 |
| **modiv** | **0 in denominator** | 0 final runs |

**Correction to the brief: the 623 spans SIX deals, not seven.** Modiv's
latest representations run is `modiv-representations-20260809-2xk-r3`, which
does not end `-final`, so `isFinalCorpusRun` excludes it. That run does hold
**10 limb rows** (plus 3 qualifier candidates, 7 open-world propositions);
they are outside the 623 and outside the committed replay ledger. Deal-spread
below is therefore reported **out of 6**, with modiv noted separately where it
adds signal.

For the record, modiv's 10 limb subjects all fall inside clusters the other
six deals already establish (6 organisation/subsidiaries at §3.1, 4
non-contravention/consents at §3.4) — e.g. "organisation, existence and good
standing of Company Subsidiaries", "Governmental Entity consents, approvals,
permits, filings, registrations and notifications". **Adding modiv would lift
two clusters' deal-spread but introduce no new topic.**

`subject` is non-null on **609 of 623** (97.8%). 14 rows carry no subject.

---

## Executive summary — the five things that change the decision

1. **The topic vocabulary already exists, built and committed.**
   `lib/vocab/resolution/representation-topic-registry.js` holds 25
   `REP_TOPIC_V1_*` codes with a precedence table, tie-breaks, exclusions and
   a classifier; the same 25 are governed in `contract-bundle.js` as
   `REPRESENTATION_TOPIC_CODES_V1`, with a claim definition
   (`REPRESENTATION_TOPIC_PRESENT`), concepts (`REP-T-TOPIC`, `REP-B-TOPIC`)
   and a product projection. It has already been run over all 623 rows and
   the output is committed. **Designing a new list from scratch would be a
   rebuild.** (§4)

2. **The corpus broadly validates those 25 codes** — my independent clustering
   of all 623 subjects produced 28 clusters that map almost one-to-one onto
   them. The evidenced gaps are small and specific: no proxy/registration
   code, no anti-takeover code, labour not split from benefits. (§1, §4)

3. **The registry classifies on the wrong field.** It reads `raw_value` regex;
   the topic signal is in `subject`. **252 of the 299 rows it failed to
   classify have a clean or precedence-resolvable topic in `subject`.** Its
   single worst defect is that `material adverse effect` is an anchor for
   `BUSINESS_CONDUCT_CHANGES` — MAE appears in nearly every rep's exception
   clause, so 27 of that code's 33 wins are drafting convention, not topic.
   (§4)

4. **`lib/category-summary-features.js` has no representations rows at all.**
   15 categories, 182 rows, zero REPS/REP-T/REP-B key, and no machine-readable
   PW question numbers anywhere (PW ranges appear only in five prose
   comments). The module that *does* carry expected representation rows is
   `lib/rubric.js` (50 REP-T + 32 REP-B codes) via `lib/expected-sets.js`, and
   the three-way comparison runs cleanly against it: **39 of 50 REP-T rows
   have mined evidence, 11 do not (4 excluded by design, 2 present-but-absorbed,
   4 genuine zeros, 1 structural), and exactly 1 mined cluster has no home in
   the rubric.** (§3)

5. **The `subject_occurrence_id` join does not exist — the "86 of 86" figure in
   `route-to-good-extraction-2026-08-10.md` §1a does not reproduce.** Measured across all
   39 committed representations runs: **0 shared `subject_occurrence_id`
   between limb and qualifier claims**, because the two are minted with
   different `kind` discriminators. The join that does work is
   `governs_path` ↔ `limb_path` (92.6% reach) — but **only 14.8% of limbs get
   a full TERM + MATERIALITY + LOOKBACK row, and 43.3% stay bare presence
   checkboxes even after joining.** All 536 TEMPORAL qualifiers are uncoded.
   **This is the number that should move the value estimate.** (§5)

---

## 1. Mined topic clusters

### Method, stated so the numbers can be discounted correctly

`subject` is **effectively free text: 584 distinct values across 623 rows.**
Only 23 subject strings repeat at all, and the most repeated ("compliance with
Environmental Laws") occurs 3 times. **Verbatim subject grouping is useless.**

So clustering is by keyword rules applied to the **`subject` string first**
(the producer's own topic label), falling back to `raw_value`. 28 ordered
rules. Written by reading all 584 subjects, not by copying the existing
registry — the point was to see what the corpus says before looking at what
the code assumes.

**This is inference, not counting.** The rule set is mine; a different reader
would draw some boundaries elsewhere. What is *counted* and not inferred: the
623 denominator, the deal spread, the ambiguity histogram in §2, and every
number in §3–§5.

### The clusters

Sorted by deal-spread first, then volume, per the brief.

| proposed label | occurrences | deals | example subjects (verbatim) |
|---|---:|:---:|---|
| SEC_REPORTS_FINANCIAL_STATEMENTS | 47 | **6/6** | concho: "SEC filing and furnishing compliance"<br>metsera: "Compliance of Company SEC Documents with applicable securities-law requirements"<br>skywater: "internal control deficiencies or weaknesses" |
| LITIGATION_ORDERS_INVESTIGATIONS | 39 | **6/6** | concho: "Governmental investigations and reviews"<br>metsera: "Ongoing SEC review or investigation of Company SEC Documents"<br>redhat: "legal proceedings" |
| CORPORATE_ORGANISATION_STANDING | 38 | **6/6** | concho: "Organisation, standing and entity power"<br>metsera: "Company power, authority and qualifications"<br>redhat: "organisation and good standing" |
| LABOR_EMPLOYMENT | 31 | **6/6** | concho: "employee-organising activity or Proceeding"<br>metsera: "labor disruptions and organising activities"<br>redhat: "labour relations" |
| NONCONTRAVENTION_CONSENTS | 28 | **6/6** | concho: "Contractual violations, defaults, and encumbrances"<br>metsera: "Conflicts and violations arising from the agreement and transactions"<br>redhat: "noncontravention of other contracts" |
| ABSENCE_OF_CHANGES_ORDINARY_COURSE | 13 | **6/6** | concho: "conduct of business in the Ordinary Course"<br>metsera: "absence of Company Material Adverse Effect"<br>redhat: "absence of certain changes or events" |
| INTELLECTUAL_PROPERTY | 55 | 5/6 | concho: "ownership or use rights in Company Intellectual Property"<br>metsera: "rights to intellectual property"<br>redhat: "intellectual property infringement by Company" |
| TAX | 45 | 5/6 | metsera: "Tax Return filing and accuracy"<br>skechers: "Tax Returns"<br>topbuild: "Tax liens" |
| EMPLOYEE_BENEFIT_PLANS | 38 | 5/6 | concho: "list of Company Plans"<br>metsera: "Company Benefit Plan list"<br>skechers: "Employee Plan list" |
| COMPLIANCE_PERMITS | 30 | 5/6 | concho: "Violations of applicable Law"<br>metsera: "Status, suspension, cancellation and compliance of Company Permits"<br>skywater: "required permits" |
| CAPITALISATION_SECURITIES | 20 | 5/6 | concho: "issuance and grant compliance"<br>metsera: "issuances of Company Securities"<br>skechers: "required stockholder vote" |
| MATERIAL_CONTRACTS | 17 | 5/6 | concho: "Company Contracts list"<br>metsera: "Specified Contract list and copies"<br>redhat: "material contracts" |
| PROXY_REGISTRATION_DISCLOSURE | 12 | 5/6 | concho: "Registration Statement information"<br>metsera: "Proxy Statement accuracy and completeness"<br>skechers: "Information Statement disclosure" |
| DATA_PRIVACY_CYBER_IT | 36 | 4/6 | concho: "sufficiency of IT Assets"<br>metsera: "ownership and sufficiency of company systems"<br>skechers: "legal proceedings relating to AI Technology" |
| REAL_PROPERTY | 30 | 4/6 | concho: "title to Company real property"<br>metsera: "title to and leasehold interests in properties and assets"<br>skechers: "title to owned real property and tangible assets" |
| ENVIRONMENTAL | 28 | 4/6 | concho: "compliance with Environmental Laws"<br>metsera: "compliance with Environmental Laws"<br>skechers: "environmental notices, violations and liabilities" |
| AUTHORITY_ENFORCEABILITY | 11 | 4/6 | metsera: "Company Subsidiary power and authority"<br>skechers: "execution and delivery of the Agreement"<br>skywater: "Enforceability of agreement" |
| UNDISCLOSED_LIABILITIES | 9 | 4/6 | concho: "Company and Subsidiary liabilities"<br>metsera: "Liabilities or obligations with a Company Material Adverse Effect"<br>skechers: "liabilities" |
| ANTITAKEOVER_STOCKHOLDER_ACTION | 6 | 4/6 | concho: "Takeover Law and anti-takeover provision inapplicability"<br>metsera: "Company Board resolutions and takeover statutes"<br>skywater: "Board recommendation" |
| ANTI_CORRUPTION_SANCTIONS_TRADE | 15 | 3/6 | metsera: "violations of Anti-Corruption Laws"<br>skechers: "compliance with anti-money laundering laws, Sanctions and Trade Controls"<br>skywater: "Restricted Party status and ownership or control" |
| INSURANCE | 13 | 3/6 | concho: "effectiveness of material insurance policies"<br>metsera: "insurance policies in force"<br>skechers: "insurance policies" |
| BROKERS_ADVISERS_OPINIONS | 7 | 3/6 | concho: "receipt of financial advisor opinion"<br>metsera: "delivery of copies of agreements with specified financial advisors"<br>skywater: "Guggenheim fairness opinion" |
| TRANSACTION_PROCESS_EFFECTS | 6 | 3/6 | metsera: "Transaction effects on compensation and benefit obligations"<br>skechers: "consummation of the Merger"<br>skywater: "Effects on consummation of the Mergers and other Transactions" |
| REGULATED_PRODUCTS_HEALTHCARE | 18 | 2/6 | metsera: "Health Care Submissions"<br>metsera: "clinical and preclinical trials"<br>skywater: "notices of regulatory noncompliance" |
| CUSTOMERS_SUPPLIERS | 5 | 2/6 | skechers: "notices of cessation of supply by Material Relationships"<br>skywater: "Top Customer list"<br>skywater: "Top Supplier relationship and ability to supply or support" |
| GOVERNMENT_CONTRACTS | 13 | **1/6** | skywater: "copies of identified government contracts, bids and teaming agreements"<br>skywater: "notice of intent to revoke or suspend facility security clearances"<br>skywater: "pending solicitations or proposals restricted due to an organisational conflict of interest" |
| OIL_GAS_RESERVES | 7 | **1/6** | concho: "oil and gas reserve estimates"<br>concho: "factual reserve-report data"<br>concho: "hydrocarbon sale proceeds" |
| FINANCING_SOLVENCY | 6 | **1/6** | skechers: "Solvency"<br>skechers: "Equity Commitment Letter copy"<br>skechers: "Debt Commitment Letter copy" |

### What the deal-spread column actually says

- **Six clusters appear in all 6 deals** (SEC/financials, litigation,
  organisation, labour/employment, non-contravention, absence-of-changes) —
  196 rows, 31% of the corpus. These are the safest rows in the table.
- **Thirteen clusters at 4/6 or better** cover **433 rows = 69.5%**.
- **Three clusters are single-deal artefacts** and worth naming as such:
  GOVERNMENT_CONTRACTS is skywater alone (defence fab), OIL_GAS_RESERVES is
  concho alone (E&P), FINANCING_SOLVENCY is skechers alone (the only
  debt-financed deal in the set). **26 rows = 4.2% is one drafter's industry,
  not a market rep.** They will look like real topics on a count-ordered list
  and are not.
- The 4/6 clusters that miss deals miss them for **deal-specific reasons that
  read as correct abstention**, not extraction failure: redhat and topbuild
  have no environmental, real-property or privacy reps of this shape in their
  final runs, and both are far smaller runs (16 and 31 rows) than the four
  shard-split deals (134–153 rows). **Deal-spread is confounded with run
  size**; a 4/6 on a corpus where 2 deals contribute 47 of 623 rows is weaker
  evidence than 4/6 would be on a balanced corpus. Stated because it changes
  how much the column is worth.

---

## 2. The tail, named

**My rule set left zero rows unclustered — which is a warning, not a result.**
With 28 ordered rules and a raw_value fallback, everything lands somewhere.
The honest measure of the tail is not "how many were unclustered" but **how
strong the signal was on each row.** Counted:

| signal on `subject` | rows | share |
|---|---:|---:|
| matches exactly one cluster rule | **422** | 67.7% |
| matches two rules | 147 | 23.6% |
| matches three or more rules | 26 | 4.2% |
| matches no rule (fell back to `raw_value`) | 28 | 4.5% |
| — of which `subject` is null | 14 | 2.2% |

Of the 173 multi-match rows, **114 resolve cleanly** because exactly one hit
is a specific topic and the rest are generic buckets (litigation, compliance,
non-contravention, liabilities, organisation, authority, transaction-effects,
absence-of-changes) — a precedence table settles those. **59 are genuinely
hard**, matching two or more *specific* topics. Examples, verbatim:

- concho: "ERISA Plan qualification and penalties or taxes" → TAX + BENEFITS
- metsera: "Tax-qualified or registered Company Benefit Plans" → TAX + BENEFITS
- skechers: "wage withholding and payment liabilities" → TAX + LABOR + LIABILITIES
- concho: "title to Oil and Gas Properties" → REAL_PROPERTY + OIL_GAS
- skechers: "ownership of Company Intellectual Property" → IP + CAPITALISATION
- skywater: "unauthorised disclosure of classified information or cyber incidents involving CUI" → PRIVACY + GOVERNMENT_CONTRACTS
- metsera: "environmental authorizations" → ENVIRONMENTAL + PERMITS + AUTHORITY

These are not extraction defects. **They are limbs that genuinely straddle two
reps**, and every one of them is a case where a single-valued topic field
loses information a lawyer would want.

### The genuinely miscellaneous

**59 hard multi-matches + 28 no-subject-match = 87 rows, 14.0%**, need
something beyond a keyword rule. Within the 28:

- **14 have `subject: null`.** All 14 are readable from their raw text and
  section: 9 are concho §4.10 benefit-plan limbs, 3 are metsera §3.11 benefit-plan
  limbs, 2 are skywater §3.15 sexual-misconduct limbs. **These are a producer
  defect (subject not emitted on sub-limbs), not a taxonomy gap** — the parent
  limb in the same section carries the subject.
- 12 of the remaining 14 are ordinary topics my rules simply worded past
  ("SEC-document form compliance", "conduct of the Company Group's business",
  "title and ownership interests in properties and assets").
- **Two are genuinely not representation topics at all**: topbuild
  "Knowledge definition" (§3.1) — the raw value is the *definition of
  Knowledge*, a defined-term limb misfiled into REPRESENTATIONS — and concho
  "factual reserve-report data".

**Direct answer to the brief's question: no, a third of them are not
miscellaneous.** The unassignable-in-principle residue is **~2 rows**. The
residue that needs judgement rather than a keyword is **~87 rows (14%)**, and
**59 of those need a multi-topic or precedence answer, not a new code.** The
value estimate for this work should not be discounted for a large
miscellaneous tail; it should be discounted for **straddling limbs** and for
the **4.2% single-deal industry topics** in §1.

---

## 3. Cross-check against what the product already expects

### First, a correction: `lib/category-summary-features.js` has no representations rows

I read the whole file. It defines **15 category specs** — STRUCT, CONSID,
NOSOL, ANTI, TERMR, TERMR-B, TERMR-T, TERMF, MAE, COND-M, COND-B, COND-S,
IOC, COV, MISC — plus 9 aliases, **182 `{ label, keys }` rows in total**
(not ~200, and not "per family" — some families have none).

**There is no REPS, REP-T or REP-B key, and no alias creates one.** The only
mentions of representations in the file are three rows that live in *other*
categories and describe reps from the outside: `'Reps Including Prevent /
Delay Prong'` (ANTI), and `'Reps Bring-Down'` (COND-B and COND-S). Grep for
`REP` as a category key returns nothing.

So **the three-way comparison the brief asked for cannot be run against that
file** — the expected-row side is empty. Two incidental findings while there:

- `CATEGORY_SUMMARY_FEATURES['COND'] = CATEGORY_SUMMARY_FEATURES['COND-M']`
  resolves fine (COND-M *is* defined, at line 223 — my first grep missed the
  quoted keys; corrected).
- The file carries no PW question numbers as data. PW ranges appear only in
  section comments (`q120–q140` on NOSOL, `q41–q43, q82, q88–q99` on COND,
  `q163–q184` on MISC). **Nothing machine-readable ties a row to a PW
  question.** Any claim that this module "annotates rows with PW question
  numbers" is true only of prose comments on five section headers.

### The module that *does* hold expected representation rows

`lib/rubric.js`, surfaced through `lib/expected-sets.js`. Its header states
the purpose in terms that match the brief exactly: *"the 'here is the standard
set; which are present / missing?' checklist exists only for reps."*

`getCodesForType('REP-T')` → **50 codes with labels.**
`getCodesForType('REP-B')` → **32 codes.** `expected-sets.js` grades each
core/common/rare from corpus deal-fraction, with a hand-curated core list of
10 REP-T and 3 REP-B codes.

**That is the expected-row side of the comparison, and it is far richer than
`category-summary-features.js`.** The comparison below runs against it.

### The three-way comparison (REP-T, 50 expected rows)

**A. Expected rows WITH mined evidence — 39 of 50.**

| REP-T code | mined rows | deals | from cluster |
|---|---:|:---:|---|
| REP-T-IP | 55 | 5/6 | INTELLECTUAL_PROPERTY |
| REP-T-SEC / -FINSTMT / -CONTROLS | 47 | 6/6 | SEC_REPORTS_FINANCIAL_STATEMENTS |
| REP-T-TAX | 45 | 5/6 | TAX |
| REP-T-LIT | 39 | 6/6 | LITIGATION_ORDERS_INVESTIGATIONS |
| REP-T-ORG | 38 | 6/6 | CORPORATE_ORGANISATION_STANDING |
| REP-T-BENEFITS | 38 | 5/6 | EMPLOYEE_BENEFIT_PLANS |
| REP-T-PRIVACY | 36 | 4/6 | DATA_PRIVACY_CYBER_IT |
| REP-T-LABOR | 31 | 6/6 | LABOR_EMPLOYMENT |
| REP-T-COMPLY | 30 | 5/6 | COMPLIANCE_PERMITS |
| REP-T-PROPERTY | 30 | 4/6 | REAL_PROPERTY |
| REP-T-NOCONFLICT | 28 | 6/6 | NONCONTRAVENTION_CONSENTS |
| REP-T-ENV | 28 | 4/6 | ENVIRONMENTAL |
| REP-T-CAP | 20 | 5/6 | CAPITALISATION_SECURITIES |
| REP-T-FDA / -CLINICAL / -HEALTHCARE / -HEALTHLAWS / -PRODUCT | 18 | 2/6 | REGULATED_PRODUCTS_HEALTHCARE |
| REP-T-CONTRACTS / -MATERIAL-CONTRACTS | 17 | 5/6 | MATERIAL_CONTRACTS |
| REP-T-ANTICORR / -SANCTIONS | 15 | 3/6 | ANTI_CORRUPTION_SANCTIONS_TRADE |
| REP-T-NOCHANGE | 13 | 6/6 | ABSENCE_OF_CHANGES_ORDINARY_COURSE |
| REP-T-INSURANCE | 13 | 3/6 | INSURANCE |
| REP-T-PROXY | 12 | 5/6 | PROXY_REGISTRATION_DISCLOSURE |
| REP-T-AUTH | 11 | 4/6 | AUTHORITY_ENFORCEABILITY |
| REP-T-NOLIAB | 9 | 4/6 | UNDISCLOSED_LIABILITIES |
| REP-T-BROKERS / -FAIRNESS / -RPT | 7 | 3/6 | BROKERS_ADVISERS_OPINIONS |
| REP-T-OIL / -WELLS / -RESERVE | 7 | **1/6** | OIL_GAS_RESERVES |
| REP-T-TAKEOVER / -STOCKAPPROVAL | 6 | 4/6 | ANTITAKEOVER_STOCKHOLDER_ACTION |
| REP-T-TOP-CUSTOMERS / -SUPPLY | 5 | 2/6 | CUSTOMERS_SUPPLIERS |

**Note the granularity mismatch, which is the most actionable thing in this
table.** The rubric splits where the corpus does not, and vice versa. Five
rubric codes (FDA, CLINICAL, HEALTHCARE, HEALTHLAWS, PRODUCT) share a single
18-row cluster on two deals — **at this corpus size they cannot be told apart
by evidence.** SEC / FINSTMT / CONTROLS share 47 rows. OIL / WELLS / RESERVE
share 7. Meanwhile the corpus wants PROXY_REGISTRATION_DISCLOSURE split from
SEC reporting, and the rubric has that (REP-T-PROXY) — that one lines up.

**B. Expected rows with NO mined evidence — 11 of 50.** They are not all the
same kind of absence:

| REP-T code | why |
|---|---|
| REP-T-NOOTHERREPS | **excluded by design** — the replay ledger's `no_other_generic_rows` carve-out (6 rows), and `representations-product-projection.js` `EXCLUDED_CONCEPTS` names all four |
| REP-T-NONRELIANCE | same |
| REP-T-INDEPINVEST | same |
| REP-T-FRAUDCARVEOUT | same |
| REP-T-GOVAPPROVAL | **evidence exists, absorbed** — 16 rows across **6/6 deals** carry governmental-consent subjects ("Governmental Entity Consent", "Required governmental consents, registrations, declarations and filings"), which my cluster rules folded into NONCONTRAVENTION_CONSENTS. This is a genuine expected row that my clustering hid, not a corpus gap |
| REP-T-SUFFICIENCY | **evidence exists, absorbed** — 4 rows, 3/6 deals ("Sufficiency of intellectual property rights", "ownership and sufficiency of company systems", "sufficiency of IT Assets", "Rights-of-Way sufficient to conduct business"). Note it straddles IP, IT and real property |
| REP-T-40ACT | **genuine zero** — no Investment Company Act rep in these 6 deals |
| REP-T-ADVISERSACT | genuine zero |
| REP-T-INSREG | genuine zero |
| REP-T-CFIUS | genuine zero |
| REP-T-PREAMBLE | structural, not a topic |

So of the 11: **4 excluded by design, 2 present-but-absorbed, 4 genuine
absences at this corpus, 1 structural.** The only real coverage gap the
corpus reveals is **zero** — every REP-T code that a rep in these six
agreements actually contains has mined evidence behind it.

**C. Mined clusters with NO expected REP-T row — 3.**

| cluster | rows | deals | nearest existing home |
|---|---:|:---:|---|
| GOVERNMENT_CONTRACTS | 13 | **1/6** (skywater) | **none on either side.** Defence/procurement reps — security clearances, teaming agreements, cost-or-pricing data, organisational conflict of interest, CUI. No REP-T or REP-B code covers them |
| FINANCING_SOLVENCY | 6 | **1/6** (skechers) | exists on the **buyer** side: `REP-B-FUNDS`, `REP-B-SOLVENCY`. Not missing — mis-sided by my target-centric mapping |
| TRANSACTION_PROCESS_EFFECTS | 6 | 3/6 | exists on the buyer side: `REP-B-MERGESUB`, `REP-B-VOTE`, `REP-B-NOINTEREST` |

**Only one mined cluster has no home anywhere in the rubric: GOVERNMENT_CONTRACTS,
and it is a single-deal cluster.** That is the honest answer to "which mined
clusters have no expected row" — the rubric's 82 codes already cover
essentially everything the corpus produced.

**The party split matters here and is easy to miss.** 114 of 623 rows (18.3%)
name Parent, Buyer or Merger Sub in `party_making` or `subject`. Any topic
vocabulary that is scored only against REP-T will mis-score roughly a fifth of
the corpus.

---

## 4. `lib/taxonomy.js` — and the vocabulary that is not in it

### The direct answer: no

`lib/taxonomy.js` defines **67 top-level `const` vocabularies**. Enumerated:
EXCEPTION_CODES, KNOWLEDGE_QUALIFIER_CODES, UNDISCLOSED_LIABILITIES_EXCEPTION_CODES,
ABSENCE_OF_CHANGES_EXCEPTION_CODES, CONSENT_STANDARDS, EFFORTS_STANDARDS,
REPRESENTATIVES_STANDARDS, INTERVENING_EVENT_SCOPES, APPLIES_TO_PARTY,
ANTITRUST_CONTROL, BURDEN_COMMITMENT, BURDEN_BASELINE, LITIGATION_OBLIGATION,
CLEAR_SKIES_FAMILY, CONSULTATION_TIER, PULL_REFILE, TIMING_AGREEMENT,
ANTITRUST_APPROVAL_CODES, TERMINATION_PARTY, EQUITY_INSTRUMENTS,
EQUITY_TREATMENT, VESTING_STATUS, COMP_STANDARDS, COMP_ITEMS, MERGER_FORMS(_META),
MAE_CARVEOUT(_META), IOC_CATEGORY(_META), IOC_AFFIRMATIVE_STANDARD/SCOPE(_META),
COMMON_EXCEPTION(_META), ABSENCE_OF_CHANGES_TYPE(_META), REMEDY_TYPE(_META),
TERMF_TRIGGER(_META), KNOWLEDGE_PERSON(_META), KNOWLEDGE_STANDARDS,
SEC_FILING_EXCLUSION(_META), DEF_FAMILY_META, INTEREST_RATE_BASIS, GOVERNING_LAW,
SOLICITATION_ACT, SUPERIOR_DETERMINER, FORCE_THE_VOTE, INTERVENING_EVENT_TYPE(_META),
INFORMATION_SHARING_GRADE, COPIES_SCOPE, BIDDER_IDENTITY_REQUIREMENT,
ONGOING_UPDATES_STANDARD, ENGAGEMENT_NOTICE_TIMING, APPRAISAL_RIGHTS_STATUS,
ASSIGNMENT_PARENT_EXCEPTION, ASSIGNMENT_PROVISO, LIST_TAXONOMY_KEYS.

**None is a representation-topic vocabulary.** The only string containing
"REP" is `REPRESENTATIVES_STANDARDS` (who counts as a Representative for
no-shop purposes) — a false friend, not a topic list. The only `REP-T-*`
token in the file is `REP-T-MATERIAL` at line 683, inside an unrelated
comment.

### But the vocabulary the brief is looking for already exists — twice, elsewhere

**This is the finding to act on, and it is exactly the failure mode
`CLAUDE.md` warns about.**

**(i) `lib/vocab/resolution/representation-topic-registry.js` — 144 lines, a
complete 25-code representation-topic vocabulary with a working classifier.**
`lib/canonical-v2/representation-topic-registry.js` is a 3-line re-export
shim pointing at it. Codes, verbatim, stripped of the `REP_TOPIC_V1_` prefix:

```
ANTI_CORRUPTION_TRADE      AUTHORITY_ENFORCEABILITY   BUSINESS_CONDUCT_CHANGES
CAPITALISATION_SECURITIES  COMPLIANCE_PERMITS         CORPORATE_ORGANISATION
CUSTOMERS_SUPPLIERS        DATA_PRIVACY_TECHNOLOGY    EMPLOYMENT_BENEFITS
ENVIRONMENTAL              FINANCIAL_REPORTING        FINANCING
GOVERNMENT_CONTRACTS       INSURANCE                  INTELLECTUAL_PROPERTY
LIABILITIES                LITIGATION_ORDERS          MATERIAL_CONTRACTS
NONCONTRAVENTION_CONSENTS  REAL_PROPERTY              REGULATED_PRODUCTS
RELATED_PARTIES_ADVISERS   SEC_DISCLOSURE             TAX
TRANSACTION_PROCESS
```

It ships with more than a list: 18 `PRECEDENCE` pairs (specific beats
general), 3 `SUBJECT_TIE_BREAKS`, 2 `EXCLUSIONS`, a `NEAR_MISS_ANCHORS` map,
and 6 `UNCLASSIFIED_REASONS`. Registry digest
`sha256:2240a6cf…996e1f28`, version `REPRESENTATION_TOPIC_REGISTRY/V1`.

**(ii) The same 25 codes are already governed in the contract bundle.**
`lib/canonical-v2/contract-bundle.js` exports `REPRESENTATION_TOPIC_CODES_V1`
(the identical 25, sorted), a claim definition
`REPRESENTATION_TOPIC_PRESENT_CLAIM_DEFINITION_V1`, concepts `REP-T-TOPIC`
and `REP-B-TOPIC` in `EXPECTED_CONCEPT_KEYS_V25`, and
`REPRESENTATION_TOPIC_PRESENT` in `EXPECTED_CLAIM_KEYS_V40`.
`lib/canonical-v2/representations-product-projection.js` already projects that
claim into review / query / compare / market shapes with the registry binding
validated.

**So the routing key, its vocabulary, its claim definition, its concepts and
its product projection are all already built.** Also already built:
`lib/canonical-v2/native-producer/representation-topic-ladder.js` (4 rungs),
`lib/canonical-v2/representation-topic-review-ledger.js`, and
`scripts/stage-2y-h-representation-topic-replay.mjs`, which has already been
run over all 623 rows and committed its output.

### How the existing 25 codes compare to what the corpus produced

My 28 mined clusters and the registry's 25 codes are close to the same list.
The differences, all evidenced:

| difference | evidence |
|---|---|
| Registry merges SEC_DISCLOSURE and FINANCIAL_REPORTING as separate codes but has no proxy/registration code | 12 rows, 5/6 deals are proxy/S-4/information-statement disclosure, distinct from periodic SEC reporting; rubric agrees (`REP-T-PROXY`) |
| Registry has no anti-takeover code | 6 rows, 4/6 deals; rubric has `REP-T-TAKEOVER` |
| Registry has no oil-and-gas code | 7 rows, 1/6 deals; rubric has `REP-T-OIL/-WELLS/-RESERVE`. Single-deal — arguably correct to omit |
| Registry has `BUSINESS_CONDUCT_CHANGES`; corpus supports it | 13 rows, 6/6 deals |
| Registry splits EMPLOYMENT_BENEFITS into one code; corpus supports two | 38 benefit-plan rows (5/6) and 31 labour rows (6/6) are separable on subject; rubric splits them (`REP-T-BENEFITS` / `REP-T-LABOR`) |
| Registry's `RELATED_PARTIES_ADVISERS` conflates three rubric rows | brokers, fairness opinion and related-party transactions are `REP-T-BROKERS` / `-FAIRNESS` / `-RPT`; only 7 mined rows total, so the corpus cannot yet separate them |

### Measured: classifying on `subject` beats classifying on `raw_value`

The committed registry classifies on `raw_value` regex and uses `subject`
only as a tie-break in 3 narrow code pairs. Joining my subject-based
clustering to the committed replay ledger on `closure_id` (623 of 623 rows
matched) gives:

| registry outcome | subject gives one cluster | subject + precedence | subject ties | subject silent |
|---|---:|---:|---:|---:|
| CLASSIFIED (324) | 225 | 59 | 25 | 15 |
| NON_HIERARCHICAL_TIE (183) | **116** | **39** | 24 | 4 |
| NO_RAW_ANCHOR (116) | **81** | **16** | 10 | 9 |

**252 of the 299 rows the registry could not classify have a clean or
precedence-resolvable topic signal in `subject`.** Only 47 are hard on both
readings.

Where both assign a topic, they **agree on 215 and disagree on 69** (75.7%
agreement). The disagreements are not evenly spread — they concentrate on one
defect:

**`BUSINESS_CONDUCT_CHANGES` is an anchor magnet.** 27 of its 33 classified
rows won on the anchor `material adverse effect`, and that code appears in
roughly a quarter of the 183 tie combinations (the top ties are
`BUSINESS_CONDUCT_CHANGES` + CORPORATE_ORGANISATION 8, + EMPLOYMENT_BENEFITS
7, + COMPLIANCE_PERMITS 6, + LITIGATION_ORDERS 6, + REAL_PROPERTY 4,
+ LIABILITIES 4). **MAE appears in the exception clause of nearly every
representation**, so an anchor on it routes by drafting convention rather
than by topic. Verbatim misroutes: concho "governmental consents" →
BUSINESS_CONDUCT_CHANGES; concho "labour disruptions" →
BUSINESS_CONDUCT_CHANGES; concho "oil and gas reserve estimates" →
SEC_DISCLOSURE; metsera "privacy-obligation claims" → LIABILITIES.

`subject_corroborated` is true on only 206 of 324 classified rows, so the
registry's own corroboration signal disagrees with its verdict on 118.

---

## 5. The qualifier join — and a load-bearing correction

### `subject_occurrence_id` does not join limbs to qualifiers. It cannot.

The brief states, from `route-to-good-extraction-2026-08-10.md` §1a, that *"86 of 86
limb claims share a `subject_occurrence_id` with qualifier claims — 107 of
them"* on the Metsera representations run. **I could not reproduce this, and
the code says it is impossible.**

Measured across **all 39 committed representations runs** (every shard, every
vintage, not just the final ones), joining `compiled_candidates` limb claims
to qualifier claims on `subject_occurrence_id`:

**0 shared `subject_occurrence_id`. In every run. Including
`metsera-representations-r1b-20260809-2xk-final`, which has exactly 86 limbs
and 124 qualifiers — the run the figure appears to come from.**

The reason is in `lib/canonical-v2/native-producer/anthropic-provider.js`:

- limb claims (`shapeRepresentationLimbAssertionProposals`, line ~3546) mint
  `mintSubjectId({ kind: 'REPRESENTATION_INSTANCE', section_reference,
  party_making, chapeau_quote })` — one id per representation *instance*,
  shared by all its limbs;
- qualifier claims (`shapeRepresentationQualifierProposals`, line ~3640) mint
  `mintSubjectId({ kind: 'REPRESENTATION_QUALIFIER', section_reference,
  party_making, side, quote })` — **a different `kind`, plus the qualifier's
  own quote**, so one id per qualifier.

Different `kind` discriminator ⇒ the hashes can never collide. Confirmed by
the shape of the data: metsera r1b has 86 limbs over **33** distinct limb
subject-ids and 124 qualifiers over **62** distinct qualifier subject-ids,
with zero intersection.

The module header at line ~3605 says this deliberately: the representation
qualifier key is *"a DIFFERENT key from CAPITALISATION's
QUALIFIER_CLAIM_KEY… this family's committed qualifier identities must stay
byte-identical."*

**Consequence for the plan: the join key does NOT already exist in the data
model as claimed. It has to be built.**

### The join that does exist, and works

`(section_reference, party_making)` + `attachment.governs_path` ↔ `limb_path`,
which is exactly what `attachment` was designed for (`limb-components.js`
`resolveQualifierAttachment`; CHAPEAU governs every limb in the instance,
ITEM governs its own path, TRAILING governs the path it trails).

Run over the 623 final-run limbs:

| | limbs | share |
|---|---:|---:|
| in an instance that has any qualifier | 623 | 100% |
| with ≥1 CHAPEAU qualifier | 421 | 67.6% |
| with ≥1 ITEM/TRAILING qualifier on their own `limb_path` | 437 | 70.1% |
| **with any attached qualifier** | **577** | **92.6%** |

Attached qualifier population: 1,455 THRESHOLD, 666 KNOWLEDGE, 536 TEMPORAL,
515 ACCURACY. **There is no `MATERIALITY` qualifier kind** — the materiality
codes ride on ACCURACY and THRESHOLD `canonical_value`.

### Does the join fill the row? Mostly no.

This is the number the brief asked for, and it is the least comfortable one
in this note.

| cell | filled | share of 623 |
|---|---:|---:|
| TERM (`subject`) | 609 | 97.8% |
| MATERIALITY (any coded `MAT_*`) | 203 | **32.6%** |
| LOOKBACK (any TEMPORAL qualifier) | 233 | **37.4%** |
| KNOWLEDGE standard (coded) | 201 | 32.3% |
| **all three of TERM + MATERIALITY + LOOKBACK** | **92** | **14.8%** |
| TERM + MATERIALITY only | 108 | 17.3% |
| TERM + LOOKBACK only | 139 | 22.3% |
| **TERM only — still a bare presence checkbox** | **270** | **43.3%** |

Per deal, full three-cell rows: concho 15/134, metsera 31/150, redhat 1/16,
skechers 23/153, skywater 18/139, topbuild 4/31. **No deal exceeds 21%.**

Two further quality caveats, both counted:

- **TEMPORAL qualifiers are uncoded.** 536 attached TEMPORAL qualifiers,
  **0 with a non-null `canonical_value`.** The LOOKBACK cell can only render
  raw text ("currently", "as of the date of this Agreement", "since January 1,
  2023", and — showing the kind is loose — "timely filed (taking into account
  valid extensions)"). It is not comparable across deals without a temporal
  vocabulary that does not yet exist.
- **19 limbs receive conflicting materiality codes** from their attached
  qualifiers (e.g. `MAT_ALL_MATERIAL` + `MAT_MAE_QUALIFIED`), because CHAPEAU
  qualifiers broadcast to every limb in the instance. metsera §3.19 attaches
  **25 chapeau qualifiers to each of its limbs**. The MATERIALITY cell needs a
  precedence rule of its own, or it renders a contradiction.


### The join primitive that IS already built: `limb_component_trees`

`resolution.json` carries a `limb_component_trees` array
(`LIMB_COMPONENT_TREE/V1`) that mints a `limb_component_id` for every
`(provision_instance_id, limb_path)` node and links assertion nodes back by
`claim_occurrence_id`. Several reviewed slices already use exactly this as the
join key — `reviewed-material-contracts-slice.js`, `reviewed-ioc-capex-slice.js`
and `reviewed-termination-fee-slice.js` all set
`subject_occurrence_id: component.provision_component_id`.

**So the intended mechanism exists and is proven elsewhere in the codebase.**
Measured over the 17 final representations runs: **181 trees, 396 assertion
nodes, and 396 of the 623 limb claims (63.6%) already appear as an assertion
node** with a stable component id. Only **115 claims resolve** across all 17
runs, which is why none of this reaches a rendered row today.

**The honest restatement of §1a's claim:** the qualifiers are not "one join
away" on an existing key. The pieces are: a working attachment model
(`governs_path`, 92.6% reach), a working component-identity model
(`limb_component_trees`, 63.6% reach), and a proven pattern for binding the
two in other families. **What does not exist is the binding itself for
REPRESENTATIONS.** That is a build, not a query — and the 14.8% full-row rate
above caps what it can pay out even when built.

### The ten sampled joins

**Best case per cluster** (I deliberately selected the most-filled row in each
cluster, so this table is an upper bound, not a typical row):

| cluster | deal §sec | TERM | MATERIALITY | LOOKBACK | KNOW | #q |
|---|---|---|---|---|---|---:|
| SEC_REPORTS_FINANCIAL_STATEMENTS | redhat §3.01 | hedge counterparty adjustment rights | MAT_MAE_QUALIFIED | prior to the date of this Agreement | ACTUAL | 5 |
| LITIGATION_ORDERS_INVESTIGATIONS | concho §5.9 | Governmental investigations or reviews | MAT_MAE_QUALIFIED | currently | ACTUAL | 5 |
| CORPORATE_ORGANISATION_STANDING | skywater §3.4 | Company and Subsidiary organisational documents | — | as of the date of this Agreement | ACTUAL | 2 |
| INTELLECTUAL_PROPERTY | metsera §3.19 | exclusive rights restricting use of controlled IP | MAT_MAE_QUALIFIED | since January 1, 2023 | ACTUAL | 25 |
| TAX | skechers §3.17 | Tax Returns | MAT_MAE_QUALIFIED | timely filed (taking into account valid extensions) | — | 9 |
| EMPLOYEE_BENEFIT_PLANS | skechers §3.18 | Employee Plan list | MAT_MAE_QUALIFIED **+ MAT_MATERIAL_TO_COMPANY** | As of the date hereof | — | 6 |
| MATERIAL_CONTRACTS | redhat §3.01 | material contracts | MAT_MAE_QUALIFIED **+ MAT_ALL_MATERIAL** | — | ACTUAL | 7 |
| ENVIRONMENTAL | concho §4.18 | Releases and environmental liability notices | — | as of the date of this Agreement | ACTUAL | 8 |
| DATA_PRIVACY_CYBER_IT | metsera §3.19 | ownership and sufficiency of company systems | MAT_MAE_QUALIFIED | since January 1, 2023 | ACTUAL | 25 |
| REAL_PROPERTY | skywater §3.24 | list of Leased Real Property and Lease Agreements | MAT_MAE_QUALIFIED | currently | ACTUAL | 4 |

**Even at best case, 2 of 10 have no MATERIALITY, 1 has no LOOKBACK, and 2
render contradictory materiality.**

**Median case per cluster** — the honest picture of what a typical row looks
like:

| cluster | deal §sec | TERM | MATERIALITY | LOOKBACK | #q |
|---|---|---|---|---|---:|
| SEC_REPORTS_FINANCIAL_STATEMENTS | redhat §3.01 | financial statements | MAT_MAE_QUALIFIED + MAT_ALL_MATERIAL | — | 5 |
| LITIGATION_ORDERS_INVESTIGATIONS | metsera §3.06 | Ongoing SEC review or investigation of Company SEC Documents | — | — | 1 |
| CORPORATE_ORGANISATION_STANDING | concho §5.11 | facts or actions affecting Merger reorganisation qualification | — | — | 1 |
| INTELLECTUAL_PROPERTY | skywater §3.21 | Outbound License disclosure schedule | MAT_ALL_RESPECTS | — | 3 |
| TAX | skechers §3.17 | Tax liens | MAT_MAE_QUALIFIED | — | 8 |
| EMPLOYEE_BENEFIT_PLANS | skywater §3.15 | Company Benefit Plan documents | MAT_MAE_QUALIFIED | — | 2 |
| MATERIAL_CONTRACTS | skywater §3.20 | validity, binding effect, force, effect and enforceability of Material Contracts | MAT_MAE_QUALIFIED | — | 4 |
| ENVIRONMENTAL | concho §5.13 | Proceedings under Environmental Laws | — | — | 5 |
| DATA_PRIVACY_CYBER_IT | metsera §3.20 | privacy-obligation claims | — | — | 4 |
| REAL_PROPERTY | concho §4.15 | Company Material Real Property Leases | — | — | 7 |

**Nine of ten median rows have an empty LOOKBACK; five of ten have an empty
MATERIALITY as well.** The median joined row is TERM plus one cell, not a
full row.

---

## 6. What is counted and what is inferred

**Counted** (re-derivable from committed artefacts):
623 denominator and its per-deal split; 584 distinct subjects; 609 non-null;
the subject-hit histogram (422/147/26/28); the closure_id join to the replay
ledger (623/623); the registry×subject cross-table; 215/69 agreement;
27-of-33 MAE anchor; 0 shared `subject_occurrence_id` across 39 runs; the
`governs_path` join rates (421/437/577); all cell-fill percentages; 536
TEMPORAL qualifiers with 0 canonical values; 19 conflicting-materiality
limbs; 50 REP-T and 32 REP-B rubric codes; 15 categories and 182 rows in
`category-summary-features.js`; 67 vocabularies in `taxonomy.js`.

**Inferred** (my judgement, contestable):
the 28 cluster boundaries and their labels; the mapping from cluster to REP-T
code in §3; the "generic vs specific" split used to compute the 114
precedence-resolvable ties; the reading of which 11 REP-T absences are by
design versus genuine.

**Not attempted**, per the brief: no proposed final code list, no
`canonical_value` shape.
