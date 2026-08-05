# Family spec — Employee matters / benefits continuation covenant (COV-EMPLOYEE)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED (adversarial audit
COV-EMPLOYEE, 2026-08-03: 1 CRITICAL + 6 MATERIAL + 4 MINOR findings, all
11 applied mechanically below; 0 parked for Fable) — per program
convention (spec-detail → audit → amend → re-audit §3/§4 → build →
review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-track sibling
of P1–P4; follows the five-layer promotion structure).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template, typed-abstain parsers, coverage-map anchored-overlap + honesty
pins), `2026-08-02-family-termination-rights-design.md` §3 (the
producer-prompt-registry dispatch seam — NOW BUILT at
`lib/canonical-v2/native-producer/producer-prompt-registry.js` +
`section-family-classifier.js`; this spec is written against the real
modules, and its stage-1 title rule lands in this family's own reviewed
diff per the registry header's own convention), `2026-08-02-family-
termination-fee-design.md` (full-table ambiguity corroboration),
`2026-08-02-family-ioc-design.md` (list-heavy limb machinery — this
family's per-item standards are the same shape), `2026-08-02-family-
consideration-design.md` (equity-award-treatment boundary),
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
vacuity ruling — checked explicitly in §3 against this family's dispatch
rules), `2026-08-02-lexical-disagreement-net-design.md` (lexicon rules),
EXECUTION-LEDGER M3 review protocol + extraction semantics rules 1–3
(implemented, never amended, here).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~523–534, carries no `COV-` prefix of any kind —
a claim resolved today ranks UNCLASSIFIED 99). This spec proposes a tier
(section 4), flagged for Ben, keyed on the EXACT concept key — never a
bare `COV-` prefix (the financing-covenants precedent: a bare prefix would
silently sweep every future COV-* family into one tier).

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack read 2026-08-02, own SELECT-only receipts 2026-08-03; every
quote below is verbatim from a production `primary_quote` or
`region_full_text`, cited by provision-card id; none is invented)

v1 `provision_cards`: `provision_type = 'COVENANT_OTHER'`,
`provision_subtype = 'COV-EMPLOYEE'` — **40 cards / 35 deals**, the entire
family population (32 deals ×1 card, 2 deals ×2, Kraft/Heinz deal
`c7c16365-…` ×4 — of which two are equity-plan-conversion sections and one
a "No Change in Control" section swept in by title, see defect 2 below).
Plus **3 confirmed unclassified siblings** (`provision_subtype = NULL`,
short_title "Unclassified — Employee Benefits"/"— Employee Matters":
`9b725fcb-…`, `470c560c-…`, `78851a99-…`) that are full-length on-pattern
employee-matters covenants — so 40/35 is a floor, not a ceiling. A fourth
employee-adjacent unclassified card also exists (`f20c88e2-…`, deal
`0a043659-…`, §7.18, bare short_title "Unclassified" — not
employee-flavored by short_title, which is the selection criterion for
the "3 confirmed" floor above); it is quoted below for its anniversary-
period form but stays outside the confirmed-floor count on that
criterion.

**There is exactly ONE taxonomy code for this family** (`lib/rubric.js`
2223–2230: `COV-EMPLOYEE`, "Employee Matters; Benefits", frequency
near-universal). No subcodes exist; the v1 rubric pushes granularity into
the `compensationItems` list-tagged field (per-item `standard_code` from
`COMP_STANDARDS`, per-item `item` from `COMP_ITEMS`, `lib/taxonomy.js`
392–413). The v2 design below mirrors that intent: one concept,
granularity in governed attributes. **No dedicated DB table exists for
this family** (evidence-pack `information_schema.tables` check) — nothing
to migrate onto, nothing v1-side is a write target here.

Grounding quotes this spec builds on (drafting patterns A–F from the
evidence pack, plus own receipts):

- **Pattern A — item-by-item "no less favorable"** (card `aa9d2dc2-…`,
  deal `00d49e6a-…`, §5.07): "For a period of twelve (12) months following
  the Effective Time, or if earlier, until the date of termination of the
  relevant Continuing Employee, (such period, the "Comparability Period"),
  Parent shall … provide … (i) a base salary or wage rate, target annual
  cash bonus or commission-based opportunity, and target equity award
  opportunity, that are no less favorable … (ii) severance benefits …
  no less favorable than those that would have been provided … and (iii)
  employee benefit plans and arrangements … no less favorable in the
  aggregate than those provided …"
- **Pattern B — split standard: cash "not less than", benefits
  "substantially comparable in the aggregate"** (card `75ac45c9-…`, deal
  `0d38cc1f-…`, §6.9): "For a period of twelve (12) months following the
  Effective Time (the "Post-Closing Benefits Continuation Period") …
  (i) base salary or wages that are not less than … (ii) commission and
  short-term incentive compensation target opportunities that … are no
  less than … (iii) employee welfare and other benefits (excluding defined
  benefit pension benefits, equity or equity based awards, deferred
  compensation benefits and retiree medical …) that are substantially
  comparable in the aggregate …"
- **Pattern C — dual benchmark / buyer discretion** (card `3cc69907-…`,
  deal `b57d0d65-…`, §4.9): "…employee benefits … that are, in the
  aggregate, either, in Parent's sole discretion, (A) substantially
  comparable to the employee benefits provided to each such Continuing
  Employee immediately prior to the Effective Time or (B) substantially
  comparable to those provided to similarly situated employees of Parent
  and its subsidiaries…"; and the conditional-switch variant (card
  `c571d12f-…`, deal `320a3899-…`, §6.4): "…substantially comparable in
  the aggregate to those benefits maintained for and provided to the
  Current Employees under the Company Plans … (or, to the extent a Current
  Employee becomes covered by an employee benefit plan or program of
  Parent …, substantially comparable to those benefits … provided to
  similarly situated employees of Parent …)".
- **Pattern D — schedule-deferred, no standard in the operative text**
  (card `fe2227f2-…`, deal `448e524f-…`, §6.7): "Parent shall provide, or
  shall cause to be provided to each employee … the wages, incentive bonus
  opportunities and benefits set forth on Schedule 6.7(a)."
- **Pattern E — non-comp headcount covenant under the same subtype**
  (card `290d77dc-…`, deal `0d38cc1f-…`, §6.17): "…TBIL shall (i) use its
  reasonable best efforts to continue to have three or more full-time
  employees based in Ireland … and (v) not purchase or acquire any
  Intellectual Property assets exceeding $250,000 in the aggregate."
- **Pattern F — equity-plan conversion mechanics misfiled here**
  (card `6d9affdf-…`, Kraft/Heinz §6.04): option/RSU adjustment-ratio
  arithmetic ("…rounded down to the nearest whole share, equal to the
  quotient determined by dividing…") — consideration-family substance.
- **Service credit** (own receipts 2026-08-03): card `677b6217-…` (deal
  `ce061fd0-…`): "cause to be granted to such Continuing Employee credit
  for all service with the Company Group prior to the Effective Time for
  purposes of eligibility to participate, vesting and for purposes of
  future vacation accrual and determining severance"; card `2aa1a9a9-…`
  (deal `eee4f270-…`): "credit for all service with the Company prior to
  the Effective Time for all purposes (including for eligibility to
  participate, vesting and entitlement to (or level of) benefits…"; card
  `367a4553-…` (deal `cf32899a-…`): "shall be credited with his or her
  years of service with the Company and its Subsidiaries or predecessors
  before the Effective Time". 31/40 cards match a service-credit shape.
- **Welfare-plan transition relief** (own receipts): waiver limb, card
  `677b6217-…`: "cause all waiting periods, pre-existing condition
  exclusions, evidence of insurability requirements and actively-at-work
  or similar requirements of such New Plan to be waived"; card
  `8fb045db-…` (deal `a267309a-…`): "waive any limitation on health and
  welfare coverage of any Company Employee … due to pre-existing
  conditions and/or waiting periods". Expense-credit limb, card
  `677b6217-…`: "full credit pursuant to such New Plan for purposes of
  satisfying all deductible, coinsurance, co-pay, offsets and maximum
  out-of-pocket requirements"; card `2aa1a9a9-…`: "full credit under such
  New Plan for purposes of satisfying all deductible, coinsurance and
  maximum out-of-pocket requirements". Counts: pre-existing 27/40,
  waiting-period 28/40, deductible 30/40.
- **No-third-party-beneficiary disclaimers** (own receipts; 26/40 cards):
  card `2aa1a9a9-…`: "no Continuing Employee (including any beneficiary or
  dependent thereof) shall be regarded for any purpose as a third party
  beneficiary of this Agreement"; card `677b6217-…`: "(iii) create any
  third party beneficiary rights in any Person"; card `8fb045db-…` drafts
  the hyphenated form "any third-party beneficiary, legal or equitable or
  other rights or remedies".
- **WARN Act** (own receipts; only 2/40 cards): `b67b57ee-…` ("(i) WARN
  Act. Cabot Parent shall periodically notify Columbus…") and
  `44877cfa-…` ("…that would trigger the notice requirements under the
  WARN Act…"). Below the coverage bar — open world (Registry section).

**Value-shape facts that shape the parser (evidence pack §3 + own
measured counts):**

- Duration drafting is inconsistent: "twelve (12) months" (modal),
  "eighteen (18) months" (card `2aa1a9a9-…`, deal `eee4f270-…`, §6.9),
  "the eighteen (18) month anniversary" (card `59afb9ac-…`, deal
  `ad35e712-…`, §5.8), bare "12 months" (card `78851a99-…`, deal
  `fc03e7e3-…`, §7.03(b)) — but ALSO digit-free forms: "one year" (card
  `44877cfa-…`, deal `13894e33-…`, §6.5), "one-year anniversary" (card
  `9b725fcb-…`, deal `bb5f062d-…`, §6.03), "until the first anniversary
  of the Effective Time" (card `1e1e489d-…`, deal `13211d88-…`, §6.11),
  "ending on the first anniversary of the Closing Date" (unclassified
  card `f20c88e2-…`, deal `0a043659-…`, §7.18). **Measured (own query
  2026-08-03): only 8/40 cards contain any digit-governed month form;
  ~19/40 draft year/anniversary phrasing with no month digit at all.**
  The family's headline numeric queues on the majority drafting this
  slice — priced in Known costs, never "fixed" by unit conversion
  (year→months is arithmetic; parsers never compute).
- Bonus proration is always a narrative date-fraction ("the numerator of
  which is the number of days between January 1, 2026 and the Closing
  Date … and the denominator of which is 365", card `44877cfa-…`, deal
  `13894e33-…`, §6.5(b); the 2011 ratio form, card `59afb9ac-…`, deal
  `ad35e712-…`, §5.8(f)) — never a bare percentage.
- Percentage caps attach to DIFFERENT concepts across deals with no
  stable anchor: 401(k) vesting "one hundred percent (100%) vest" (card
  `c571d12f-…`, deal `320a3899-…`, §6.4(c)) / "100% vested" (card
  `fe2227f2-…`, deal `448e524f-…`, §6.7(e)); bonus ceilings "shall not
  exceed 125% of…" (card `c571d12f-…`, deal `320a3899-…`, §6.4(d)) vs
  "equal to 150% of each employee's target" (card `fe2227f2-…`, deal
  `448e524f-…`, §6.7(d)).
- Word-only fractions with no digit: "one-third" cash / "two-thirds"
  equity (card `b67b57ee-…`, deal `df393645-…`, §5.7(g)(ii)–(iii)).
- **Zero COBRA/health-premium dollar or percentage figures exist in the
  family corpus** (evidence-pack zero-hit ILIKE scan). No field below
  assumes that shape exists.
- Day-count windows scattered through the same sections are NOTICE/
  delivery mechanics, not benefit durations ("sixty (60) days after the
  date hereof", card `b67b57ee-…`, deal `df393645-…`, §5.7(a); "120
  days", card `b67b57ee-…`, deal `df393645-…`, §5.7(e)(ii); "fifty (50)
  days following employment termination", card `b67b57ee-…`, deal
  `df393645-…`, §5.7(b)(vi)); "five (5) business days prior to the
  anticipated Effective Time" is a separate card, `fe2227f2-…` (deal
  `448e524f-…`), not part of the `df393645-…`/`b67b57ee-…` group.

**Corpus defects observed and pinned (v1 labels are UNTRUSTED input):**

1. The TBIL headcount covenant (`290d77dc-…`) and the Kraft equity-plan /
   no-change-in-control sections (`6d9affdf-…` and siblings) carry the
   COV-EMPLOYEE stamp with zero comp-continuation substance — the v1
   classifier stamped from title matching and bundled adjacent sections.
   The misfile inventory is not limited to those two: the 40 also include
   a "7.13 Incentive Equity Plan" card (`57e24749-…`, deal `65a3e3c8-…`;
   S-8/incentive-pool mechanics, consideration-adjacent — the same
   Pattern F substance class) and a "6.14 Approval of Compensation
   Arrangements" card (`72f0739b-…`, deal `555579a6-…`; Rule 14d-10
   golden-parachute-vote mechanics, zero continuation substance) — both
   caught by the corroboration gates below but neither previously pinned
   as a named regression fixture. Every corroboration table below exists
   because the corpus itself demonstrates label↔text drift inside this
   family; the TBIL and Kraft defects become permanent regression
   fixtures (test 3, the IOC `da8a7a2f-…` precedent), and
   `72f0739b-…` ("6.14 Approval of Compensation Arrangements") is added as
   a third `ITEM_UNCORROBORATED` regression fixture in the same test.
2. At least 3 real employee-matters covenants sit unclassified
   (`9b725fcb-…`, `470c560c-…`, `78851a99-…`) — undercounting by
   classification miss. The lexical net is precisely the mechanism that
   catches this shape going forward: a section carrying "Continuing
   Employee" text with no COV-EMPLOYEE candidate refuses ABSENT (test 6
   pins one such case as the veto working as designed).
3. `section_ref` for this family stores the v1 RUBRIC LABEL ("6.9 |
   Employee Matters; Benefits | …"), not the agreement's real heading
   (own query 2026-08-03: all 40 rows carry the label slot). Consequence
   one: fixture files commit AGREEMENT TEXT plus provenance ids (deal
   uuid, provision_card uuid, retrieval date) and NEVER v1 `section_ref`
   label strings (the IOC lint-fingerprint pin, applied as discipline even
   though no forbidden-pattern entry matches this family's label).
   Consequence two: the stage-1 title rule CANNOT be grounded in observed
   real headings from this table — see §3 for the honest dispatch design.

**Boundaries (BINDING — each pinned by an acceptance test; duplication is
an automatic audit CRITICAL):**

- **ERISA/benefits REPRESENTATIONS** belong to the rep families
  (`REP-T-BENEFITS` / `REP-B-BENEFITS`, `lib/rubric.js` 415/920, rank 55).
  This spec extracts covenant-side facts only; the stage-1 title rule
  never claims "…Plans"/"ERISA"-titled sections (test 5).
- **D&O indemnification** is its own sibling spec this wave. Its v1 title
  fingerprint (`lib/parser-v2/classify.js:307`, code `COV-DO`:
  "Indemnification of Directors and Officers" / "D&O Insurance" forms)
  must never classify EMPLOYEE_MATTERS (test 5). Its drafting shares the
  phrase "no less favorable" — a priced lexicon cross-hit (section 5),
  cited here, never modeled here.
- **Pre-closing compensation RESTRICTIONS** (no increases in comp,
  no new plans, during the interim period) are `IOC-COMP` —
  `2026-08-02-family-ioc-design.md` owns that concept, its corroboration
  patterns and its lexicon tells ("base salary", "severance",
  /\bBenefit Plan\b/) inside interim-operating sections. This family is
  the POST-closing obligation; the same-family-within-section reading
  (net spec, Ben-ratified) keeps the two lexicons from colliding, and
  this spec deliberately does not re-register IOC-COMP's tells (§5).
- **Equity-award conversion/treatment mechanics** (Pattern F, the Kraft
  §6.04/§6.11 misfiles) are consideration-family substance
  (`2026-08-02-family-consideration-design.md`); those quotes fail this
  family's corroborations by construction and queue — never resolve here.
- **No-third-party-beneficiary disclaimers inside these sections are
  boundary content: presence claims only, never a derived negative**
  (family charter, restating M3 rule 1): quoting the disclaimer sentence
  is a PRESENT claim with negative content (the P3/C2 shape); no producer
  or resolver branch ever emits "employees have no rights" as a derived
  conclusion, and the general MISC-article no-TPB provision of the whole
  agreement is NOT this claim — the claim is scoped to the disclaimer
  drafted inside the employee-matters section itself.

## Deliverable (honest conversion semantics)

**No recorded native-producer runs exist over employee-matters sections**
(recordings today: capitalisation — F28/Skechers/Modiv). Nothing to
"convert": no open-world fixture rows, no closure_ids to track. The
deliverable is the five-layer capability plus a pre-rerun harness:

1. Registry, resolver, parser, prompt module, provider key, classifier
   stage-1 rule and lexicon entries land fully tested against a COVERAGE
   MAP of synthetic compiled candidates pinned to REAL corpus quotes
   committed as fixture bytes (section 6).
2. "The pipeline natively extracts employee-matters covenants" may be
   claimed ONLY after dated post-merge live rerun handoffs (subscription
   CLI, one documented run per fixture deal). The P1 audit M-5 pins apply
   verbatim: no report before those handoffs may state family conversion,
   coverage, or recall. Until then the honest claim is "the machinery
   exists and is proven on committed fixtures".

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time (V15 today;
sibling family slices each take the next number when they land — the
superset-diff acceptance tests are against CONTENT (sorted key sets),
never the numeral; all prior version rows stay untouched byte-for-byte).

**Concepts.** ONE new concept, version 1, `{concept_key, version}` shape
only (the fixture-shape validator rejects anything else):

- `COV-EMPLOYEE` — post-closing employee compensation/benefits
  continuation covenant. 40 cards / 35 deals (floor). The single-code
  shape is deliberate and mirrors the v1 rubric's own design: the family
  has one near-universal section whose negotiated variance lives in
  per-item standards, not in sibling section types. Granularity is
  governed attributes, never key suffixes.

FLAGGED FOR BEN in the PR body under the 2026-07-23 concept-amendment
convention. Deliberately NOT added: a WARN-allocation concept (2/40 cards
— below any coverage bar; both receipts quoted above; the drafting stays
open world feeding the commonality report), a union/CBA concept (the
rubric carries a `unionContracts` field but the evidence pack and own
receipts surface no verbatim CBA covenant text — no grounding, no
concept), a post-protection-period concept (the rubric's
`postProtectionPeriodMonths`/`postProtectionStandard` fields have no
quoted corpus instance in the pack — a two-period quote ABSTAINs
`MULTIPLE_MONTH_COUNTS` to review by design), a 401(k)-treatment concept
(grounded text exists — "one hundred percent (100%) vest all participants
under the 401(k) Plan", `320a3899-…` §6.4(c) — but the drafting is
heterogeneous percent-attached mechanics with no stable anchor; open
world until Ben adjudicates its own shape), an annual-bonus-proration
concept (all observed formulas are narrative date-fractions, never a
numeric — promoting would force either free text or arithmetic; open
world).

**Claim definitions** (five; the family's facts are three presence claims,
one enum-attributed presence claim and one mechanical month count):

```
EMPLOYEE_COMP_ITEM_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'EMPLOYEE_COMP_ITEM_STANDARD'
  version: 1
  allowed_canonical_values: [true]             // presence claim; the legal
  canonical_value_required_when_present: true  // content is the attributes

BENEFITS_CONTINUATION_PERIOD_MONTHS_CLAIM_DEFINITION_V1
  claim_definition_key: 'BENEFITS_CONTINUATION_PERIOD_MONTHS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'  // existing type
  canonical_value_required_when_present: true

EMPLOYEE_SERVICE_CREDIT_CLAIM_DEFINITION_V1
  claim_definition_key: 'EMPLOYEE_SERVICE_CREDIT'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

WELFARE_PLAN_TRANSITION_RELIEF_CLAIM_DEFINITION_V1
  claim_definition_key: 'WELFARE_PLAN_TRANSITION_RELIEF'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

EMPLOYEE_MATTERS_TPB_DISCLAIMER_CLAIM_DEFINITION_V1
  claim_definition_key: 'EMPLOYEE_MATTERS_TPB_DISCLAIMER'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. All five grow the
expected-claim-keys row (sorted superset; content superset-diff test).

**Governed attributes (never in keys; all participate in claim identity
so two same-section claims never collide or dedupe):**

- `EMPLOYEE_COMP_ITEM_STANDARD`:
  - `comp_item`: enum `BASE_SALARY | TARGET_BONUS |
    EQUITY_AWARD_OPPORTUNITY | SEVERANCE | EMPLOYEE_BENEFITS` — the five
    corpus-grounded items (Patterns A/B/C quotes above). Corrected framing
    (own re-check 2026-08-03 against `lib/taxonomy.js` `COMP_ITEMS`:
    `BASE_SALARY`, `TARGET_BONUS`, `ANNUAL_BONUS_PAID`,
    `LONG_TERM_INCENTIVE`, `HEALTH_WELFARE`, `RETIREMENT`, `SEVERANCE`,
    `PTO`, `EQUITY_AWARDS`, `OTHER_BENEFITS`): this enum is a
    corpus-grounded set, RENAMED COUSINS of five of the rubric's ten
    `COMP_ITEMS` keys — NOT a literal subset. `EQUITY_AWARD_OPPORTUNITY`
    and `EMPLOYEE_BENEFITS` are not rubric keys at all; `HEALTH_WELFARE`
    and `EQUITY_AWARDS` map approximately to `EMPLOYEE_BENEFITS` and
    `EQUITY_AWARD_OPPORTUNITY` respectively, adjudicated at mapping time
    (`FAMILY_MAPPING_TABLE`, out of scope here, Ben-reviewed). The
    remaining rubric items with no committed grounding quote
    (`ANNUAL_BONUS_PAID`, `LONG_TERM_INCENTIVE`, `RETIREMENT`, `PTO`,
    `OTHER_BENEFITS`) stay open world — the enum is a gate, not a
    suggestion; out-of-enum → explicit `pushOpenWorld` with a typed reason
    (P1 C-4: the main loop's open-world routing keys on proposal_kind and
    will not catch it).
  - `standard_kind`: enum `NO_LESS_FAVORABLE | SUBSTANTIALLY_COMPARABLE |
    SUBSTANTIALLY_SIMILAR | DEFERRED_TO_SCHEDULE` — the family charter's
    enum-shaped comparability standard. `DEFERRED_TO_SCHEDULE` is the
    Pattern D state the evidence pack demands ("deferred to schedule,
    standard unknown" — an explicit typed value, never a guessed
    standard). These are the grounded subset of the rubric's seven
    `COMP_STANDARDS`; `IN_THE_AGGREGATE` is NOT a standard here (it is
    the aggregation dimension, below — the v1 flat enum conflates two
    dimensions the corpus drafts orthogonally: "no less favorable in the
    aggregate", Pattern A limb (iii), is NLF × AGGREGATE);
    `BUYER_DISCRETION`/`COMPARABLE_TO_BUYER_EMPLOYEES`/`TARGET_BASELINE`
    are the benchmark dimension, below.
  - `aggregation`: enum `AGGREGATE | ITEM_BY_ITEM`. AGGREGATE is
    corroborated by /in the aggregate/i PRESENT in the quote (32/40 cards
    carry the phrase — measured); ITEM_BY_ITEM by its ABSENCE (the TERMR
    ONE_PARTY absence-gate precedent). This is the family charter's
    "aggregate vs individual-element comparability" datum.
  - `benchmark`: enum `TARGET_PRE_CLOSING | BUYER_SIMILARLY_SITUATED |
    BUYER_CHOICE_OF_EITHER`. Required for every standard_kind EXCEPT
    `DEFERRED_TO_SCHEDULE`, where `aggregation` and `benchmark` MUST be
    absent — a deferred standard with a benchmark label is incoherent →
    review, typed `DEFERRED_ATTRIBUTES_INCOHERENT`.
- `BENEFITS_CONTINUATION_PERIOD_MONTHS`: `period_term_ref` — the verbatim
  defined-term phrase when the quote mints one ("Comparability Period",
  `aa9d2dc2-…`; "Post-Closing Benefits Continuation Period",
  `75ac45c9-…`). OPTIONAL (unlike TERMR's `deadline_term_ref`: the corpus
  drafts periods with no defined term at all — "for a period of 12 months
  following the Effective Time", card `3cc69907-…` (deal `b57d0d65-…`,
  §4.9) — corrected citation, own re-verification 2026-08-03: this string
  does NOT appear in `fc03e7e3-…`; `fc03e7e3-…`'s own no-defined-term
  drafting is a distinct surface, "For the period commencing at the
  Effective Time and ending on the date that is 12 months thereafter (or,
  if shorter, the employee's remaining period of employment)" (card
  `78851a99-…`, §7.03) — still digit-resolving `'12'` per §2's parser, but
  via different wording; test 1 pins both surfaces separately); when
  present it must be a verbatim substring of the byte-verified quote (P1
  M-3), failure → review, typed `PERIOD_TERM_REF_NOT_IN_QUOTE`. Cross-deal
  normalization of the term spellings is a Ben adjudication over observed
  values later.
- `WELFARE_PLAN_TRANSITION_RELIEF`: `relief_kind` — enum
  `PREEXISTING_AND_WAITING_WAIVER | EXPENSE_CREDIT`. Two distinct legal
  mechanics the corpus drafts as separate limbs (both quoted in Corpus
  grounding: the waiver limb waives pre-existing-condition exclusions/
  waiting periods/insurability requirements; the credit limb credits
  deductibles/coinsurance/co-pays/out-of-pocket maxima). Participates in
  identity — a waiver claim and a credit claim in the same section never
  collide or dedupe.

No party tuple is minted this slice (the IOC precedent: the obligor is
the chapeau's "Parent shall, and shall cause the Surviving Corporation…",
often outside the limb quote; a party asserted without quote evidence of
its own violates the verbatim discipline). FLAGGED FOR BEN as a
deliberate omission.

**Deliberately NOT promoted as claims (each a legal ruling, not an
omission; every one stays inside quotes as reviewer-visible evidence or
in open world):** bonus proration date-fractions (narrative, never
numeric — extracting "365" as a value would be corruption); percentage
caps/floors (100%/125%/150% attach to different concepts with no stable
anchor — evidence-pack warning 6); word-only fractions ("one-third"/
"two-thirds" — warning 7); COBRA/premium subsidies (ZERO corpus
instances — warning 8: no required field may be designed around that
shape from this corpus); WARN allocation (2/40); 401(k)
termination/continuation mechanics (the rubric's `continued401k` free
text — heterogeneous, open world); union/CBA treatment (no grounding);
the "or if earlier, until the date of termination of the relevant
Continuing Employee" early-end comparative (legal text for the reviewer,
never an operand — the earlier-of precedent verbatim).

## 2. Value parser: `benefits-period-parse.js`

New pure module, `measurement-date-parse.js` / `cure-period-parse.js`
contract shape: typed `{outcome:'RESOLVED', canonical_value,
matched_text}` / `{outcome:'ABSTAIN', reason}` — never a throw on prose,
never arithmetic, never repair, never unit conversion.
`BENEFITS_PERIOD_PARSE_VERSION` threaded into the resolution receipt
(P1 M-6).

- **RESOLVES: a literal digit run immediately governing a month word** —
  `month`/`months`/`Month`/`Months` (whitespace/parenthesis tolerant).
  Corpus forms: "12 months" (`fc03e7e3-…`) → `'12'`; the hybrid
  "twelve (12) months" (`aa9d2dc2-…`, `75ac45c9-…`) and "eighteen (18)
  months" (`eee4f270-…`) resolve on the PARENTHESIZED DIGIT (literal
  extraction, not repair); "the eighteen (18) month anniversary"
  (`ad35e712-…`) resolves `'18'` (the digit governs "month"; the
  anniversary noun follows).
- **Hybrid mismatch check (cure-period precedent verbatim):** if the word
  immediately preceding the parenthesized digit is a spelled numeral in a
  frozen word→value table (one…thirty-six, the plausible continuation
  range) and its value differs from the digit → ABSTAIN
  `SPELLED_DIGIT_MISMATCH` → review. A spelled numeral with NO adjacent
  digit is never looked up and resolved — the table exists only to detect
  contradiction (reading spelled numbers is one step from arithmetic).
- **Non-candidates by construction:** digits governing day words ("five
  (5) business days", "sixty (60) days", "120 days", "fifty (50) days"),
  calendar dates ("January 1, 2026", "October 1, 2011", "September 15,
  2026"), bare denominators ("365"), percentages ("100%", "125%",
  "150%"), currency literals ("$250,000"), section references, years —
  none governs a month word, so none is ever a candidate. Bare-numeral
  immunity is pinned by test 1 on literal committed bytes.
- **Two or more surviving month counts → ABSTAIN `MULTIPLE_MONTH_COUNTS`**
  → review (a quote spanning a protection period and a post-protection
  period is TWO facts; the producer splits, the parser never picks — P1
  rule verbatim; and the post-protection shape has no registered claim
  this slice, so its half stays open world).
- **Zero month candidates:** if the quote matches the frozen
  anniversary/year detection pattern
  (/\banniversar(y|ies)\b/i ∪ /\bone[\s-]?year\b/i ∪ /\bfirst
  anniversary\b/i — grounded: `bb5f062d-…`, `13894e33-…`, `13211d88-…`,
  `0a043659-…`) → ABSTAIN `ANNIVERSARY_OR_YEAR_PHRASED`; otherwise →
  ABSTAIN `NO_MONTH_COUNT`. **The parser NEVER converts a year phrase to
  `'12'`** — unit conversion is arithmetic, and "one year" vs "twelve
  months" vs "first anniversary of the Closing Date" (note: Closing Date,
  not Effective Time — `0a043659-…`) are legal readings for the reviewer.
  This is the family's dominant abstain path: measured 8/40 cards carry a
  digit-month form, ~19/40 draft year/anniversary only (Known costs).
- Canonical form: strict digits (`^\d+$` after extraction), decimal
  string; round-trips `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex.
- The parser never computes: "or if earlier, until the date of
  termination of the relevant Continuing Employee" (`aa9d2dc2-…`)
  resolves as the month count with the earlier-of structure preserved in
  the quoted evidence.

## 3. Producer prompt + dispatch

**New prompt module: `employee-matters-producer-prompt.js`** (own
`EMPLOYEE_MATTERS_PROMPT_VERSION = 1`, bumped once per slice, never
mid-slice). No existing prompt module is edited; recorded capitalisation
fixtures replay byte-identically.

**Dispatch: through `producer-prompt-registry.js`, mandatorily — the seam
is BUILT** (real module read 2026-08-03: frozen module-private Map, two
entries today — `CAPITALISATION`, `TERMINATION_FEE`; fail-closed null on
unknown family, no fallback). This slice adds ONE entry in its own
reviewed diff, per the registry header's own convention:
`EMPLOYEE_MATTERS → buildEmployeeMattersProducerPrompt`. A
capitalisation-fallback dispatch is a review-blocking defect.

**Section-family classifier extension
(`section-family-classifier.js`, real module read 2026-08-03: stage-1
title rules per family in that family's reviewed diff; stage-2 injectable
AI with `SECTION_FAMILY_AI_CLASSIFIED` provenance and the blocking
`SECTION_FAMILY_AI_UNVERIFIED` condition; unknown → no producer, fail
closed).** One stage-1 rule added to `STAGE_1_TITLE_RULES`:

- `EMPLOYEE_MATTERS` ↔ title matching /\bemployee matters\b/i ∪
  /\bcontinuing employees?\b/i ∪ /\bemployee benefits? matters\b/i ∪
  /\bemployee benefit matters\b/i, **guarded**: no match when the title
  also matches /\bplans?\b/i ∪ /ERISA/i (the rep-title guard — "Employee
  Benefit Plans"/"Employee Benefits; ERISA" are representation headings
  and must fall through, never dispatch here). The two added arms are
  PRE-WIDENED in this reviewed diff (audit MATERIAL-1, 2026-08-03): they
  are plans/ERISA-safe under the same guard and recover the real headings
  "Employee Benefit Matters" (`3cc69907-…`) and "Employment and Employee
  Benefits Matters" (`c571d12f-…`) at stage 1 (both previously
  stage-1-invisible under the original two-arm rule — see the vacuity
  check below). Grounding honesty: v1 has
  NO deterministic title rule for this family (`classify.js` carries
  none; COV-EMPLOYEE is AI-classified in v1 against the rubric aliases —
  "Employee Matters", "Post-Closing Employee Benefits", "Employee
  Covenants"), and `section_ref` stores the v1 label, not real headings
  (Corpus grounding defect 3), so this rule is authored from the rubric
  aliases plus `lib/parser-v2/extract.js:1604`'s own title-tell list
  ("Employee Matters", "Employee Benefits", "Continuing Employees",
  "Employee Plans") — with "Employee Plans" deliberately dropped (plans
  guard) and bare "Employee Benefits" deliberately left OUT of stage 1:
  rep sections are commonly titled exactly "Employee Benefits", and a
  bare-title rule would dispatch representations to a covenant producer.
  Bare-"Employee Benefits"-titled covenant sections reach this producer
  via STAGE 2 ONLY, carrying `SECTION_FAMILY_AI_CLASSIFIED` provenance
  and the blocking `SECTION_FAMILY_AI_UNVERIFIED` condition (never
  auto-pass until confirmed). Priced in Known costs.
- Ordering: the new rule appends AFTER the existing TERMINATION_FEE/
  TERMINATION rules (no title overlap: employee titles carry no
  "termination" fee/rights vocabulary; the D&O fingerprint
  `classify.js:307` — "Indemnification of Directors and Officers", "D&O
  Insurance" — matches neither alternation, pinned by test 5 so the
  sibling D&O spec's population is never claimed here).
- **REM-CAP vacuity check, run against this spec's own dispatch rules,
  MEASURED against real headings (own re-check 2026-08-03, correcting the
  spec's own draft self-check):** "Employee Matters; Benefits" is a v1
  RUBRIC LABEL, not a real section title (Corpus grounding defect 3) —
  citing it as this family's dominant real heading was itself an
  ungrounded claim. Measured against the actual first-line headings of
  `region_full_text`, the ORIGINAL (pre-widen) two-arm alternation
  (/\bemployee matters\b/i ∪ /\bcontinuing employees?\b/i, guarded)
  matched only **17/40** real headings; **23/40 — the majority — were
  stage-1-invisible**, including FOUR of this spec's own anchor fixtures:
  `fe2227f2-…` ("Employee Benefits"), `3cc69907-…` ("Employee Benefit
  Matters"), `c571d12f-…` ("Employment and Employee Benefits Matters"),
  `8fb045db-…` ("Employee Benefits") — plus "Benefit Plans", "Employees",
  "Employee", and bare-number headings. This is not dispatch vacuity in
  the REM-CAP sense (stage 2, carrying `SECTION_FAMILY_AI_CLASSIFIED`
  provenance plus the blocking `SECTION_FAMILY_AI_UNVERIFIED` condition,
  is a genuine working reach path for every stage-1 miss — unlike
  REM-CAP's dead end) — but the rule as first drafted would have shown a
  stage-1-invisible majority, including its own fixtures, on day one of
  the review-time script below. The rule above is therefore ALREADY
  WIDENED in this same reviewed diff with two guarded arms,
  /\bemployee benefits? matters\b/i and /\bemployee benefit matters\b/i
  (plans/ERISA-safe under the existing guard), which recover `3cc69907-…`
  and `c571d12f-…` at stage 1. Bare "Employee Benefits" (`fe2227f2-…`,
  `8fb045db-…`) stays OUT of stage 1 BY DESIGN (the rep-title collision
  risk named above) and reaches the producer via stage 2 only — priced
  explicitly in Known costs, not silently absorbed. No registered concept
  or claim definition in this spec has a grounded population that is
  dispatch-UNREACHABLE (stage 2 remains the backstop for every remaining
  miss); the review-time all-titles script (below) re-measures the
  stage-1 hit rate against real native-sectionizer titles BEFORE dispatch
  after this widen, and any further stage-1-invisible majority triggers
  the same widen-as-classifier-diff discipline — never a silent
  prompt-side workaround.
- `SECTION_FAMILY_CLASSIFIER_VERSION` bumps; threaded into the run
  receipt. Stage 1 is validated against ALL deals' section titles as a
  review-time script against live corpus data (the IOC precedent — live
  Supabase access, never stubbed into fixtures or promoted into
  `npm test`).

**Response shape:** an `employee_matters_assertions` array — each element
`{ section_reference, assertion_kind: 'ITEM_STANDARD' |
'CONTINUATION_PERIOD' | 'SERVICE_CREDIT' | 'WELFARE_RELIEF' |
'TPB_DISCLAIMER', comp_item + standard_kind + aggregation + benchmark
(ITEM_STANDARD only; aggregation/benchmark omitted when standard_kind is
DEFERRED_TO_SCHEDULE), period_term (optional verbatim,
CONTINUATION_PERIOD only), relief_kind (WELFARE_RELIEF only), verbatim
quote }` — plus the standard `open_world_candidates`. One element per
legal fact, and the prompt owns the family's defining split discipline
(the IOC limb discipline, verbatim in spirit):

- Pattern A's single sentence is ONE CONTINUATION_PERIOD assertion (quote
  the period phrase) plus N ITEM_STANDARD assertions, each quoting the
  sub-span carrying its own item's words — limb (i) alone bundles
  BASE_SALARY + TARGET_BONUS + EQUITY_AWARD_OPPORTUNITY and must become
  three assertions with three sub-quotes, or it ABSTAINs at corroboration
  (full-table ambiguity rule, section 4).
- Exclusion parentheticals are NOT item grants: "(excluding defined
  benefit pension benefits, equity or equity based awards, deferred
  compensation benefits and retiree medical…)" (`75ac45c9-…`) stays
  inside the EMPLOYEE_BENEFITS quote as evidence; the producer never
  mints an item assertion from words inside an excluding/other-than
  parenthetical (priced residual in Known costs).
- A waiver limb and an expense-credit limb are TWO WELFARE_RELIEF
  assertions with distinct relief_kind, each quoting its own limb.
- Quote the initial protection period alone; two-period drafting splits
  or queues (`MULTIPLE_MONTH_COUNTS`).
- PRESERVE-THE-NOVEL retained verbatim; when unsure of comp_item,
  standard_kind, aggregation or benchmark, the assertion stays in
  `open_world_candidates` — promotion narrows novelty, never forces fit.
- The producer never asserts a negative (M3 rule 1): "no severance
  obligation", "no service credit", "benefits not continued" are never
  emitted. The TPB_DISCLAIMER assertion is a quoted PRESENT claim of
  disclaimer text that exists (the P3/C2 positive-assertion-of-negative-
  content shape); derived ABSENT belongs to scope-closure, forever.

**Provider (`anthropic-provider.js`):** new generic key
`NATIVE_EMPLOYEE_MATTERS_CANDIDATE`, proposal_kind `EMPLOYEE_MATTERS`
(≠ OPEN_WORLD). `employee_matters_assertions` is deliberately NOT added
to `REQUIRED_RESPONSE_LISTS` (the share_count precedent verbatim: every
recorded pre-existing response fixture predates the key; missing/
non-array reads as empty list, never a schema failure). Quote
byte-verification identical to existing proposals. Golden evals:
recorded-response fixtures are never hand-edited to pretend old runs
emitted the new shape; the new shape enters recordings only via the dated
live-run handoffs.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE resolution-table entry** (P1 M-2: `RESOLUTION_UNCONDITIONAL` is a
  Map keyed on generic_claim_key alone):
  `NATIVE_EMPLOYEE_MATTERS_CANDIDATE` — `deterministic_kind: null`,
  `attachment_position: null`, `registered_claim_definition_key: null`
  (the handler makes the five-way definition split on `assertion_kind`),
  `concept_key: 'COV-EMPLOYEE'` (the SHARE_COUNT row shape — a
  single-concept family carries its concept on the row; no trigger/
  category map exists, so no pending-token routing is needed: every
  review item this family mints is stamped COV-EMPLOYEE from the row and
  ranks in the family tier from birth), `party_field: null`,
  `party_role: null` (no party minted this slice — pinned so an
  implementer doesn't improvise one; the IOC precedent).
  `MAPPING_TABLE_VERSION` bumps by one from head at build;
  table-validation test still asserts no duplicate generic keys.
- **comp_item corroboration table** (frozen resolver constant; labels
  must match quote text — the family's own TBIL/Kraft defects are the
  proof). Patterns word-bounded, case as shown, every one grounded in a
  cited committed quote:
  - `BASE_SALARY` ↔ /\bbase salary\b/i ∪ /\bwage rate\b/i ∪ /\bwages\b/i
    (`aa9d2dc2-…` "a base salary or wage rate"; `75ac45c9-…` "base salary
    or wages")
  - `TARGET_BONUS` ↔ /target annual cash bonus/i ∪
    /short-term incentive/i ∪ /\bcommission\b/i ∪
    /incentive compensation target/i (`aa9d2dc2-…` "target annual cash
    bonus or commission-based opportunity"; `75ac45c9-…` "commission and
    short-term incentive compensation target opportunities")
  - `EQUITY_AWARD_OPPORTUNITY` ↔ /equity award opportunit/i
    (`aa9d2dc2-…` "target equity award opportunity"). Deliberately NOT
    /equity or equity.based awards/i — that form is corpus-attested only
    inside an EXCLUSION parenthetical (`75ac45c9-…`) and corroborating it
    would let a carve-out mint a grant (priced in Known costs).
  - `SEVERANCE` ↔ /\bseverance\b/i (`aa9d2dc2-…` limb (ii),
    `677b6217-…`)
  - `EMPLOYEE_BENEFITS` ↔ /employee benefit plans/i ∪
    /employee welfare/i ∪ /\bemployee benefits\b/i (`aa9d2dc2-…` limb
    (iii), `75ac45c9-…` limb (iii), `c571d12f-…`, `3cc69907-…`)
- **Full-table ambiguity rule (TERMF C-3 via IOC, applied verbatim —
  multi-item limbs are this family's dominant drafting):** the handler
  runs the FULL item table over the quote; patterns for ≥2 DISTINCT items
  match → review, typed `AMBIGUOUS_ITEM_CORROBORATION` — UNLESS the
  assertion quotes a narrower sub-quote (verbatim contiguous substring,
  P1 overlap rule) in which exactly one item's patterns match; then that
  item resolves. Corpus reality check: Pattern A limb (i) at full width
  matches BASE_SALARY and TARGET_BONUS and EQUITY_AWARD_OPPORTUNITY →
  ambiguous, resolves per sub-quote. Asserted-item-matches-nothing →
  review, typed `ITEM_UNCORROBORATED` — the TBIL headcount quote
  (`290d77dc-…`) and the Kraft option-ratio quote (`6d9affdf-…`) fail
  exactly here and become permanent regression fixtures.
- **standard_kind corroboration** (measured recall priced — the TERMR M-2
  discipline; own counts 2026-08-03):
  - `NO_LESS_FAVORABLE` ↔ /no less favorable/i ∪ /not? less than/i
    (grounded `aa9d2dc2-…`; `75ac45c9-…` drafts both "not less than" and
    "no less than"). Combined family hit rate 28/40 cards.
  - `SUBSTANTIALLY_COMPARABLE` ↔ /substantially comparable/i (15/40;
    `75ac45c9-…`, `c571d12f-…`, `3cc69907-…`)
  - `SUBSTANTIALLY_SIMILAR` ↔ /substantially similar/i (3/40 — a real but
    thin corpus form; kept because the pattern is exact and the cost of
    omission is forced-fit into COMPARABLE, which is rule-3 corruption)
  - `DEFERRED_TO_SCHEDULE` ↔ /set forth (on|in) Schedule/i
    (`fe2227f2-…` "set forth on Schedule 6.7(a)")
  Mismatch or no match → review, typed `STANDARD_UNCORROBORATED`. ≥2
  distinct standards matching the quote → review, typed
  `AMBIGUOUS_STANDARD_CORROBORATION` unless a narrower sub-quote isolates
  one (Pattern B drafts NLF for cash limbs and SUBSTANTIALLY_COMPARABLE
  for the benefits limb in one sentence — the producer's limb split makes
  each sub-quote single-standard).
- **aggregation corroboration:** `AGGREGATE` requires /in the aggregate/i
  in the quote; `ITEM_BY_ITEM` requires its absence — **from the FULL
  assertion-bearing sentence / covering limb, never from the assertion's
  own possibly-truncated sub-quote alone** (audit MATERIAL-6, 2026-08-03:
  because sub-quotes may be any narrower contiguous substring, absence in
  a truncated sub-quote is not absence in the drafting — a producer that
  truncates Pattern A limb (iii) after "no less favorable" and before "in
  the aggregate" must not resolve ITEM_BY_ITEM; that is a WRONG resolved
  claim, not a queue item, and defeats the "false hit costs a queue,
  never a wrong claim" economics this family is built on). Concretely:
  before accepting an ITEM_BY_ITEM label the handler re-checks
  /in the aggregate/i against the full sentence or covering limb
  containing the assertion's sub-quote; if the phrase appears anywhere in
  that wider span while the sub-quote itself omits it, the label does NOT
  resolve → review, typed `AGGREGATION_UNCORROBORATED`. An AGGREGATE
  label where neither the quote nor its covering span carries the phrase,
  or an ITEM_BY_ITEM label where the covering span carries it → review,
  typed `AGGREGATION_UNCORROBORATED`. Ordering pin (the TERMR
  either-check precedent): the presence check runs first — Pattern A limb
  (iii) ("no less favorable in the aggregate") corroborates NLF ×
  AGGREGATE, and an ITEM_BY_ITEM label on it (at full width or truncated)
  fails.
- **benchmark corroboration:**
  - `BUYER_SIMILARLY_SITUATED` ↔ /similarly[\s-]situated employees of/i
    — WIDENED, audit MATERIAL-3 (2026-08-03): the original
    `(Parent|Purchaser|Buyer)`-enumerated alternation measured only 7/40
    PATTERN recall (the 13/40 figure was phrase frequency for "similarly
    situated" generally, not this pattern's own hit rate — the TERMR M-2
    distinction the family charter itself commits to). The corpus drafts
    named acquirers and hyphenated forms the enumeration missed —
    "similarly-situated employees of Heinz" (Kraft §6.05), Marriott/
    Starwood likewise — so the acquirer-name enumeration is dropped and
    the hyphen variant is folded in; the widened form measures 14/40.
    (`c571d12f-…`, `3cc69907-…`)
  - `TARGET_PRE_CLOSING` ↔ (/immediately prior to the Effective Time/i ∪
    /would have been provided/i ∪ /in effect immediately prior/i) AND the
    BUYER pattern ABSENT (`aa9d2dc2-…`, `75ac45c9-…`). Honest cost,
    named: the target-baseline phrase also appears in Continuing-Employee
    definitional prose ("who is an employee … immediately prior to the
    Effective Time", `aa9d2dc2-…`), so a definitional-only sub-quote can
    corroborate a mislabeled benchmark; mitigation is the item/standard
    gates running first on the same quote (a definitional sub-quote
    carries no item or standard pattern and dies earlier), priced below.
  - `BUYER_CHOICE_OF_EITHER` ↔ /sole discretion/i AND both the
    target-baseline and buyer patterns present (`3cc69907-…` "either, in
    Parent's sole discretion, (A) … (B) …"). Only 3/40 cards carry "sole
    discretion" — a thin, exact form.
  - Both benchmark patterns present WITHOUT /sole discretion/i → review,
    typed `AMBIGUOUS_BENCHMARK` — corpus-attested, not hypothetical: the
    `c571d12f-…` conditional-switch drafting ("…Company Plans … (or, to
    the extent … covered by an employee benefit plan … of Parent …,
    substantially comparable to those … of Parent…)") is a genuine legal
    reading (baseline switches on plan migration, which is neither a
    fixed benchmark nor an election) → Ben. Never resolve either side of
    an ambiguous benchmark.
  - `DEFERRED_TO_SCHEDULE` with any aggregation/benchmark label →
    review, typed `DEFERRED_ATTRIBUTES_INCOHERENT` (Registry section).
- **SERVICE_CREDIT corroboration** ↔ /credit for all service/i ∪
  /credited with .{0,40}years of service/i ∪
  /service .{0,40}taken into account/i ∪
  /credit for (all |prior )?service/i ∪
  /full credit for purposes of eligibility/i ∪ /service was credited/i
  — WIDENED, audit MATERIAL-2 (2026-08-03): the original three-pattern
  set hit only 10/40 cards against a measured 31/40 service-credit-shaped
  corpus; the three added patterns are grounded in additional corpus
  forms missed by the original set — "full credit for purposes of
  eligibility, vesting and benefit accrual" (`c4497b6c-…`), "credit for
  service with the Company Group" (no "all") (`03d8b835-…`), "credit for
  prior service" (`b67b57ee-…`), "service was credited to such Continuing
  Employee" (`9197e237-…`) — narrowing the priced recall gap (`677b6217-…`,
  `2aa1a9a9-…`, `367a4553-…`, `8fb045db-…`, `c4497b6c-…`, `03d8b835-…`,
  `b67b57ee-…`, `9197e237-…`). No match → review, typed
  `SERVICE_CREDIT_UNCORROBORATED`.
- **WELFARE_RELIEF corroboration**, keyed BY relief_kind (the P1
  zero-table kind-keying precedent — a right label on the wrong limb
  must not resolve):
  - `PREEXISTING_AND_WAITING_WAIVER` ↔ /pre-existing condition/i ∪
    /waiting periods?/i ∪ /evidence of insurability/i ∪
    /actively.at.work/i (`677b6217-…`, `2aa1a9a9-…`, `8fb045db-…`)
  - `EXPENSE_CREDIT` ↔ /\bdeductible\b/i ∪ /\bco.pay/i ∪
    /\bcoinsurance\b/i ∪ /out.of.pocket/i (`677b6217-…`, `2aa1a9a9-…`)
  Label/pattern mismatch → review, typed `RELIEF_KIND_UNCORROBORATED`.
  Both kinds' patterns in one quote → the producer should have split the
  limbs; review, typed `AMBIGUOUS_RELIEF_KIND` unless a narrower
  sub-quote isolates one.
- **TPB_DISCLAIMER corroboration** ↔ /third.party beneficiar/i
  (covers "third party beneficiary" and "third-party beneficiary," both
  corpus forms — `677b6217-…`, `2aa1a9a9-…`, `8fb045db-…`). No match →
  review, typed `TPB_UNCORROBORATED`. Note the corroboration-vs-lexicon
  split (TERMR-NOVOTE precedent): this pattern runs on the candidate's
  own quote where it is discriminating; it is deliberately NOT a lexicon
  pattern, because it fires in every MISC no-TPB section corpus-wide
  (section 5 exclusions).
- **Handler order** (SHARE_COUNT/TEMPORAL pattern): per-assertion_kind
  attribute-shape check (DEFERRED incoherence, missing required
  attributes) → corroborations (item full-table → standard → aggregation
  → benchmark for ITEM_STANDARD; kind-keyed for WELFARE_RELIEF; single
  patterns for SERVICE_CREDIT/TPB_DISCLAIMER) → `period_term_ref`
  verbatim check → per-assertion_kind branch: ITEM_STANDARD /
  SERVICE_CREDIT / WELFARE_RELIEF / TPB_DISCLAIMER resolve
  canonical_value `true`; CONTINUATION_PERIOD →
  `benefits-period-parse.js`. Every ABSTAIN routes to review with the
  parser's typed reason; RESOLVED values still pass
  `canonicalValueAllowed` (a parser bug must not bypass the gate).
  Out-of-enum comp_item / standard_kind / aggregation / benchmark /
  relief_kind / assertion_kind → explicit `pushOpenWorld`, typed reason.
- **Materiality: NEW tier proposed, FLAGGED FOR BEN — RANK COLLISION,
  UNRESOLVED (audit MATERIAL-4, 2026-08-03).**
  `{ rank: 80, label: 'EMPLOYEE_MATTERS', concept_key_prefixes:
  ['COV-EMPLOYEE'] }` — the exact key, never a bare `COV-` prefix (the
  financing-covenants precedent verbatim: a bare prefix silently sweeps
  every future COV-* family). Rank 80 sits between CLOSING_CONDITIONS
  (70) and NOTICES_ADMINISTRATIVE (90), and collides with nothing in the
  current CODE table (verified 2026-08-03 against ~523–534: 10, 20, 30,
  40, 50, 52, 55, 60, 70, 90 in code) — but it DOES collide with a
  same-wave SIBLING SPEC proposal: `2026-08-03-family-tax-matters-
  design.md` (~line 745) independently proposes `{ rank: 80, label:
  'TAX_MATTERS' }` on the same date. Both cannot land as written. The
  wave-level collision audit this spec originally ran was itself
  incomplete: 65 and 75 are proposed by the IOC and financing sibling
  specs, and dividends and D&O both also independently claim rank 85. The
  M3 ledger's explicit ordering does not name employee matters — the
  tier, and its rank relative to `TAX_MATTERS` and the rest of the
  2026-08-03 wave, is a Ben call, not an implementer default. This spec
  does NOT resolve the collision and does NOT select a replacement rank;
  Ben adjudicates ordering across the whole wave before any of these
  tiers land, and `2026-08-03-family-tax-matters-design.md`'s own
  collision statement needs the matching correction (out of scope for
  this file).
- **Receipt:** `benefits_period_parse_version` and the bumped
  `section_family_classifier_version` thread into `receiptBody`,
  alongside the bumped `mapping_table_version` and the new
  `contract_vocabulary_digest`.
- **Additivity re-pin, honest (P1 M-1 verbatim):** with no
  employee-matters input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the new parser-version field, and the recomputed
  `resolution_receipt_id`; documented in the PR with a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
a reviewed diff; keys MUST be registered concept keys — table-validation
enforces it, which is why `COV-EMPLOYEE` lands in the SAME slice)

New family key `COV-EMPLOYEE` (one-line rationale per entry in the table;
every pattern grounded in a committed, cited quote; the net-spec boundary
pin applies — case-sensitive defined-term regexes carry explicit `\b`
anchors as `BOUNDED_REGEX`, since `LITERAL_PHRASE` is case-insensitive):

- /\bContinuing Employees?\b/ (BOUNDED_REGEX, case-sensitive defined
  term; `aa9d2dc2-…`, `3cc69907-…`, `677b6217-…`; 24/40 family cards).
- /\bComparability Period\b/ (BOUNDED_REGEX, case-sensitive;
  `aa9d2dc2-…`).
- /\bBenefits Continuation Period\b/ (BOUNDED_REGEX, case-sensitive;
  `75ac45c9-…` — matches inside the longer minted term "Post-Closing
  Benefits Continuation Period").
- "no less favorable" (LITERAL_PHRASE; `aa9d2dc2-…`; 28/40 with the
  not-less-than variants — only the exact phrase is the pattern, the
  variants are corroboration-side).
- "substantially comparable" (LITERAL_PHRASE; `75ac45c9-…`,
  `c571d12f-…`, `3cc69907-…`; 15/40).
- "pre-existing condition" (LITERAL_PHRASE; `677b6217-…`, `8fb045db-…`;
  27/40), "waiting period" AND "waiting periods" (two separate
  pattern_ids per the net-spec multi-form rule; `677b6217-…`,
  `2aa1a9a9-…`).
- "credit for all service" (LITERAL_PHRASE; `677b6217-…`, `2aa1a9a9-…`),
  "years of service" (LITERAL_PHRASE; `367a4553-…`).

**Priced cross-hit noise, stated (the TERMR M-4 discipline; every entry
is veto-only — a false hit costs a queue item, never a wrong claim):**

- /\bContinuing Employees?\b/ verifiably fires in 32 DEFINITION cards
  (the `DEF-COMPANYEMPLOYEE` sibling population; own query 2026-08-03)
  and 3 COVENANT_OTHER cards — and those 3 are the UNCLASSIFIED real
  employee covenants (corpus defect 2): the unmatched-signal veto in
  those sections is the net doing exactly its job (refusing a
  COV-EMPLOYEE ABSENT where v1 missed the section). Definition-section
  hits are an accepted queue cost under the same-family reading; test 6
  pins one definition-section hit as an EXPECTED unmatched signal so a
  future silent deletion breaks a test.
- "no less favorable" fires in D&O-indemnification covenant drafting
  ("terms no less favorable" — the sibling COV-DO spec's population) and
  occasionally elsewhere. Accepted, recorded: it is this family's
  strongest standard tell (deletion asymmetry — removal widens
  auto-pass); the live-run handoffs measure the queue rate; narrowing is
  a reviewed lexicon diff, never a silent deletion.
- "years of service" can appear in pension-rep prose. Accepted at 2
  patterns' redundancy (the credit phrase is primary).

**Priced exclusions** (each a recorded blind spot; a miss costs a missed
VETO, never a wrong claim):

- Bare "employee"/"employees"/"benefits"/"compensation": present in
  essentially every rep, definition and covenant article — zero
  discriminating power, guaranteed flood.
- /\bBenefit Plan\b/, "employee benefit plans", "severance", "base
  salary": these are `IOC-COMP`'s registered lexicon tells (the IOC spec
  §5) and rep-side vocabulary; registering them under COV-EMPLOYEE too
  would raise COV-EMPLOYEE unmatched signals across every interim
  operating and benefits-rep section corpus-wide. The blind spot (an
  employee covenant whose ONLY tells are those words) is priced: every
  corpus card above carries a stronger family-specific tell.
- "third party beneficiary" / "third-party beneficiary": fires in every
  MISC no-TPB section of essentially every deal — corroboration-side
  only (section 4), never lexicon.
- "401(k)", "WARN", "COBRA": rep/definition cross-fire ("401(k)"), no
  registered claim consumer ("WARN" — 2/40, open world), zero corpus
  instances ("COBRA" — evidence-pack warning 8).
- "sole discretion": contract-wide boilerplate (assignment, amendment,
  conduct clauses); corroboration-side only.

**Forbidden-patterns check (run against
`scripts/lint/forbidden-patterns.sh` globalPatterns 2026-08-03):** the
fingerprint `term-cell.*Company pre-closing.*base salary` requires all
three substrings on one line; this spec's fixtures quote "base salary"
but never the term-cell/UI substrings — no collision, and the pin is: no
test, fixture or code line in this slice may combine those three
substrings; a collision is fixed by restructuring the file, never by a
new exemption entry. Fixture headers carry deal uuid + provision_card
uuid + retrieval date ONLY — no v1 `section_ref` label strings (Corpus
grounding defect 3; the IOC fixture discipline verbatim).

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled candidates
pinned to REAL corpus quotes, byte-verified against committed fixture
bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** employee-matters canonical text spanning at least
   six corpus deals, chosen to cover: Pattern A full sentence
   (`aa9d2dc2-…`, deal `00d49e6a-…`), Pattern B with its exclusion
   parenthetical (`75ac45c9-…`, deal `0d38cc1f-…`), the sole-discretion
   dual benchmark (`3cc69907-…`, deal `b57d0d65-…`), the
   conditional-switch benchmark (`c571d12f-…`, deal `320a3899-…`), the
   schedule-deferred section (`fe2227f2-…`, deal `448e524f-…`), the
   service-credit + welfare-relief + TPB deal sections (`677b6217-…`,
   `2aa1a9a9-…`, `8fb045db-…`), the bare-digit month form (card
   `78851a99-…`, deal `fc03e7e3-…`, both its bare "12 months" surface and
   its distinct "ending on the date that is 12 months thereafter"
   surface), the defined-term-optional period phrase corrected to its
   true card, "for a period of 12 months following the Effective Time"
   (card `3cc69907-…`, deal `b57d0d65-…`), one anniversary-phrased period
   (`13211d88-…` or `bb5f062d-…`), the third named misfile, "6.14 Approval
   of Compensation Arrangements" (`72f0739b-…`, deal `555579a6-…`), and
   the two defect exemplars (TBIL `290d77dc-…`, Kraft `6d9affdf-…`).
   Committed as LITERAL bytes from production `region_full_text`
   (typographic quotes included) — never retyped ASCII; headers per the
   §5 pin. Every test quote is asserted to be a contiguous substring of
   the committed bytes.
1. **Parser, table-driven:** "twelve (12) months" → `'12'`;
   "eighteen (18) months" → `'18'`; "the eighteen (18) month
   anniversary" → `'18'`; "12 months" → `'12'`; "twelve (18) months" →
   `SPELLED_DIGIT_MISMATCH`; "one year" / "one-year anniversary" /
   "until the first anniversary of the Effective Time" / "ending on the
   first anniversary of the Closing Date" → `ANNIVERSARY_OR_YEAR_PHRASED`
   (four distinct corpus phrasings, each on committed bytes); a
   protection + post-protection two-count quote →
   `MULTIPLE_MONTH_COUNTS`; a quote with no month or year language →
   `NO_MONTH_COUNT`; bare-numeral immunity on real bytes ("five (5)
   business days", "sixty (60) days", "120 days", "January 1, 2026",
   "365", "100%", "125%", "$250,000", section refs); the earlier-of
   employment-termination quote resolves `'12'` with the comparative
   untouched; canonical form round-trips
   `NON_NEGATIVE_DECIMAL_STRING`.
2. **Registry:** next version compiles; prior version arrays untouched
   byte-for-byte; the new concept and all five definitions validate with
   zero validator changes; expected-concept-keys AND expected-claim-keys
   superset-diff tests against CONTENT (sorted key sets), never the
   numeral.
3. **Resolution (pre-rerun harness):** synthetic candidates over
   committed bytes resolve end-to-end. Item machinery: Pattern A limb (i)
   at full width labelled BASE_SALARY → `AMBIGUOUS_ITEM_CORROBORATION`;
   its three sub-quotes resolve BASE_SALARY / TARGET_BONUS /
   EQUITY_AWARD_OPPORTUNITY respectively; the TBIL quote (`290d77dc-…`)
   labelled SEVERANCE → `ITEM_UNCORROBORATED` and the Kraft option-ratio
   quote (`6d9affdf-…`) labelled EQUITY_AWARD_OPPORTUNITY →
   `ITEM_UNCORROBORATED` (both permanent regression fixtures — the
   misfiled-section defects), joined by a third: the "6.14 Approval of
   Compensation Arrangements" quote (`72f0739b-…`, deal `555579a6-…`)
   labelled any comp_item → `ITEM_UNCORROBORATED` (audit MINOR-3
   regression fixture). Standards: limb (ii) resolves SEVERANCE ×
   NO_LESS_FAVORABLE × ITEM_BY_ITEM; limb (iii) resolves
   EMPLOYEE_BENEFITS × NO_LESS_FAVORABLE × AGGREGATE; Pattern B's
   benefits limb resolves SUBSTANTIALLY_COMPARABLE × AGGREGATE; an
   ITEM_BY_ITEM label on limb (iii) → `AGGREGATION_UNCORROBORATED`; audit
   MATERIAL-6 regression: a sub-quote truncating limb (iii) after "no less
   favorable" and before "in the aggregate," labelled ITEM_BY_ITEM, must
   NOT resolve — → `AGGREGATION_UNCORROBORATED` (never a resolved wrong
   claim), because the full limb (iii) sentence in the committed fixture
   carries the phrase; a
   SUBSTANTIALLY_COMPARABLE label on an NLF-only quote →
   `STANDARD_UNCORROBORATED`. Benchmarks: `3cc69907-…` resolves
   BUYER_CHOICE_OF_EITHER; `c571d12f-…` (both patterns, no sole
   discretion) → `AMBIGUOUS_BENCHMARK`; a BUYER_SIMILARLY_SITUATED label
   on Pattern A → `BENCHMARK_UNCORROBORATED` (buyer pattern absent).
   Deferred: `fe2227f2-…` resolves DEFERRED_TO_SCHEDULE with no
   aggregation/benchmark; the same assertion carrying a benchmark →
   `DEFERRED_ATTRIBUTES_INCOHERENT`. Service credit / welfare relief /
   TPB: each grounding quote resolves `true`; an EXPENSE_CREDIT label on
   the waiver limb → `RELIEF_KIND_UNCORROBORATED`; a one-quote
   waiver+credit span → `AMBIGUOUS_RELIEF_KIND`, its sub-limbs resolve;
   a TPB assertion quoting text without the beneficiary phrase →
   `TPB_UNCORROBORATED`, and the hyphenated `8fb045db-…` form resolves.
   Out-of-enum comp_item (e.g. PTO) exercises explicit `pushOpenWorld`;
   materiality rank 80 asserted BOTH on a resolved claim AND on a review
   item (concept stamped from the row — no pending token); every ABSTAIN
   class routes to review with its typed reason; additivity re-pin with
   documented field-level diff.
4. **Identity:** two same-section ITEM_STANDARD claims differing only in
   comp_item, or only in aggregation, mint distinct stable identities; a
   PREEXISTING_AND_WAITING_WAIVER and an EXPENSE_CREDIT claim in the same
   section never collide or dedupe; SERVICE_CREDIT and TPB_DISCLAIMER in
   the same section are distinct; re-run is byte-stable.
5. **Provider + dispatch:** response missing `employee_matters_assertions`
   → empty list, not schema failure; recorded capitalisation replays
   byte-identical through the registry with the EMPLOYEE_MATTERS entry
   present; unknown section family → no prompt dispatched, no candidates,
   typed record; classifier: "Employee Matters" and "Employee Matters;
   Benefits"-shaped titles classify EMPLOYEE_MATTERS with
   `SECTION_FAMILY_RULE_CLASSIFIED`; the two arms widened by audit
   MATERIAL-1 also classify EMPLOYEE_MATTERS at stage 1 with
   `SECTION_FAMILY_RULE_CLASSIFIED` on their real corpus headings —
   "Employee Benefit Matters" (`3cc69907-…`) and "Employment and Employee
   Benefits Matters" (`c571d12f-…`); "Employee Benefit Plans" and
   "Employee Benefits; ERISA" titles do NOT stage-1 classify (plans/ERISA
   guard — rep boundary); bare "Employee Benefits" does NOT stage-1
   classify and, with a stub stage-2 provider returning EMPLOYEE_MATTERS,
   carries `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
   `SECTION_FAMILY_AI_UNVERIFIED` blocking condition on its claims;
   "Indemnification of Directors and Officers" / "D&O Insurance" titles
   (the classify.js:307 COV-DO fingerprint) do NOT classify
   EMPLOYEE_MATTERS (sibling-spec boundary pin); existing
   TERMINATION/TERMINATION_FEE title classifications are byte-identical
   under the grown rule list. Separately, and NOT part of the committed
   test suite: the stage-1 rule is validated against ALL deals' section
   titles as a review-time script against live corpus data before the
   prompt is ever dispatched (the IOC precedent — requires live Supabase
   access, never stubbed into fixtures or promoted into `npm test`).
6. **Lexicon:** table validation (key registered; explicit `\b` on every
   case-sensitive defined-term regex; static max ≤ 128; rationale per
   pattern; content hash re-pinned); anti-noise regression paragraph
   extended with "represents and warrants", "Employee Benefit Plans"
   rep-chapeau prose, "termination of employment", "the sole discretion
   of Parent", and a MISC no-TPB sentence — asserted zero hits under the
   exclusions; each surviving pattern hits its own grounding quote in the
   committed fixtures; one EXPECTED unmatched-signal case pinned on a
   committed DEFINITION-section fixture carrying "Continuing Employee"
   (the priced cross-hit — a future silent deletion breaks this test);
   one unclassified-covenant-shaped fixture (Corpus defect 2) pinned as
   an unmatched-signal veto refusing ABSENT; determinism permutation
   tests green under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (no new exemption
   entries; the three-substring pin from §5 holds); phase allowlist for
   the slice's files.

## Out of scope

- WARN Act allocation (2/40 — open world; receipts `b67b57ee-…`,
  `44877cfa-…` recorded for the future adjudication), union/CBA
  treatment, 401(k) termination/vesting mechanics, annual-bonus proration
  formulas, LTI replacement-grant splits, percentage caps/floors, COBRA/
  premium machinery (zero corpus instances — designing for it is
  forbidden by evidence-pack warning 8), post-protection lesser-standard
  periods — all open world until adjudicated, each named with its
  grounding (or grounded absence) in sections 1–2.
- The 3 unclassified sibling cards (`9b725fcb-…`, `470c560c-…`,
  `78851a99-…`) — v1 ingest-QA hygiene, flagged to that lane, never
  silently absorbed; their sections enter this family only via a fresh
  native run through the classifier.
- ERISA/benefits representations (`REP-T-BENEFITS`/`REP-B-BENEFITS` — rep
  families), D&O indemnification (`COV-DO` sibling spec this wave),
  pre-closing comp restrictions (`IOC-COMP` — the IOC spec), equity-award
  conversion/treatment (consideration family; the Kraft misfiles), the
  agreement-wide MISC no-TPB provision — all cited boundaries, none
  modeled here (test pins in §6).
- v1 machinery: `lib/employee-benefits.js` (`EMPLOYEE_BENEFITS_CODES`),
  the rubric FEATURES schema and `compensationItems` extraction — the v1
  parser stays exactly as it is; this slice neither reuses nor edits it.
- `FAMILY_MAPPING_TABLE` extension for v1↔v2 mapping (separate Fable+Ben
  table edit with the wiring slice — the TBIL/Kraft misfile trap makes
  this table Ben-reviewed, never implementer-inferred).
- Party tuples for the obligor; cross-deal canonicalization of
  `period_term_ref` and item phrases; the live re-extraction runs (each
  its own dated handoff; until they land, NO report may claim native
  employee-matters extraction — M-5); any amendment to M3 protocol
  semantics; any scope-closure/ABSENT work.

## Known costs, stated up front

- **The headline numeric queues on the majority drafting.** Measured:
  only 8/40 cards carry a digit-governed month form; ~19/40 draft
  year/anniversary phrasing with no digit. Every one of those ABSTAINs
  `ANNIVERSARY_OR_YEAR_PHRASED` to review — a one-click Ben confirmation
  each — because year→month conversion is arithmetic and "first
  anniversary of the Closing Date" vs "of the Effective Time" is a legal
  reading. A queued correct period beats a computed one. The live-run
  handoffs measure the rate; if Ben wants anniversary forms resolved,
  that is a Ben-adjudicated parser extension in a reviewed diff, never an
  implementer default.
- **Multi-item limbs are the family's dominant drafting** (Pattern A's
  limb (i) bundles three items), so `AMBIGUOUS_ITEM_CORROBORATION` review
  volume will be material until producers reliably quote single-item
  sub-spans. Named cost of binding label to text — never a reason to
  loosen the full-table check.
- **Exclusion parentheticals are a priced residual risk:** the
  EQUITY_AWARD_OPPORTUNITY pattern deliberately excludes the
  "equity or equity based awards" carve-out form, but a producer that
  quotes an exclusion parenthetical containing "severance" or "employee
  benefits" could still corroborate an item from a carve-out. Mitigation
  is prompt discipline (§3) plus Ben's queue; the blind spot is recorded,
  and the fix if live data shows it is a corroboration-side
  negative-context gate in a reviewed diff.
- **Bare-"Employee Benefits" covenant titles dispatch via stage 2 only**,
  carrying `SECTION_FAMILY_AI_CLASSIFIED` + the blocking
  `SECTION_FAMILY_AI_UNVERIFIED` condition — no auto-pass until a human
  confirms the family. Accepted: the alternative (a bare-title stage-1
  rule) risks dispatching representation sections to a covenant producer,
  and a queued covenant beats a rep extracted under the wrong family. The
  all-titles review-time script measures the stage-1 miss rate before
  dispatch.
- **The conditional-switch benchmark (`c571d12f-…`) queues by design**
  (`AMBIGUOUS_BENCHMARK`): plan-migration-switching baselines are a real
  drafting shape that is neither TARGET_PRE_CLOSING nor an election; it
  feeds the open-world commonality report until Ben rules whether it
  deserves its own enum value.
- Case-sensitive defined-term lexicon patterns miss lower-case drafting;
  the standard phrases cover most shapes, and a miss costs a missed veto,
  never a wrong claim. The "Continuing Employee" definition-section
  cross-hits (32 DEF cards) queue under the same-family reading — priced,
  and partially a feature (the unclassified-covenant veto, Corpus
  defect 2).
- The parsers refuse compound quotes, so badly split producer output
  queues rather than resolves; two-strike escalation applies to prompt
  iteration, not to loosening the parsers.
