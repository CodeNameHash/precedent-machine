# Family — Termination fees (TERMF-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit of
2026-08-02 returned 3 CRITICAL, 6 MATERIAL, 5 MINOR findings; all folded
into this revision (fixture-byte corrections C-1/M-1/M-6/m-2, acceptance
re-pins C-2/M-2/M-4, design amendments C-3/M-3/m-3/m-4, one-line
corrections M-5/m-1/m-5). No fail-closed behavior weakened; no rebuttals —
every finding verified sound.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice-spec shape,
audit amendments inherited as conventions).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol and extraction semantics rules 1–3. This spec may not amend them.

## Grounding corrections (verified against repo + production DB, 2026-08-02)

The family brief named two artifacts that DO NOT EXIST under those names;
building against them would be exactly the plausible-but-wrong failure this
programme exists to prevent:

1. **"Rubric codes TERMFEE-\*"** — no `TERMFEE` token exists anywhere in the
   repo. The real v1 vocabulary is: `provision_type = 'TERMINATION_FEE'`
   with subtypes `TERMF-*` (`lib/termf.js`, `lib/taxonomy.js`), and the
   trigger taxonomy `TERMF_TRIGGER_META` (`lib/taxonomy.js` ~935–981):
   `SUPERIOR_PROPOSAL, RECOMMENDATION_CHANGE, NO_SOLICIT_BREACH,
   NAKED_NO_VOTE, TAIL, NO_VOTE, OUTSIDE_DATE, COMPANY_BREACH, PARENT_BREACH,
   ANTITRUST_FAILURE, FINANCING_FAILURE, OTHER`.
2. **"Materiality tier TERMINATION_FEES"** — no such tier. The resolver's
   `MATERIALITY_TABLE` (`candidate-resolution.js` ~446–457) already carries
   `{ rank: 20, label: 'FEES', concept_key_prefixes: ['TERMF-'] }`, straight
   from the ledger's own ranking. **This slice adds NO materiality tier and
   NO definition-key override entries** — every claim below resolves under a
   `TERMF-` concept and inherits rank 20 by the existing prefix match. A
   test pins rank 20 so a refactor cannot silently drop it.

Production corpus (project `tzulhdasmioeechxapdy`, `provision_cards`,
2026-08-02): 210 TERMINATION_FEE cards across 40 deals. Subtype counts:
TERMF-EFFECT 44, TERMF-SOLE 37, TERMF-TARGET 36, TERMF-TAIL 32,
TERMF-EXPENSE 25, TERMF-REVERSE 15, TERMF-RTF-ANTI 3, TERMF-REIMBURSE 2,
null 16. This slice promotes the numeric/enum core of **TERMF-TARGET,
TERMF-REVERSE and TERMF-TAIL only** (all three are already registered v2
concepts — V1 and V3 of the contract bundle). The other five subtypes are
prose/remedy families with no registered v2 concept and are out of scope.

## Deliverable (honest conversion semantics)

Governed, resolvable, publishable claims for: (a) the termination-fee dollar
amount, per side; (b) the fee trigger as an enum-valued, quote-grounded
claim; (c) the tail period in months.

**No recorded native runs exist for this family.** There are no TERMF
open-world fixture candidates to convert, so — unlike P1 — there is no
closure_id conversion story at all, and none may be claimed. The deliverable
is a **COVERAGE MAP over committed corpus-quote fixtures**: verbatim
`primary_quote` texts copied from the production v1 cards named below, each
committed as a fixture file with provenance (deal, provision_card id,
retrieval date), each hand-enumerated with its expected parse outcome. The
pre-rerun harness honesty pins from P1 audit M-5 apply verbatim: acceptance
tests drive registry/resolver layers with synthetic compiled candidates
pinned to those committed quote bytes, clearly labeled as the pre-rerun
harness; "the family extracts live" may only be claimed after the dated
post-merge live-run handoffs, and no report before then may state it.

Fixture quotes (retrieved from production 2026-08-02; committed verbatim,
byte-verified in tests — representative subset, full list enumerated in the
fixture directory):

- Bioverativ (TERMF-TARGET): "the Company shall pay Parent a fee in the
  amount of $326,000,000 (the "Termination Fee")"
- European Wax Center (TERMF-REVERSE): "Parent shall pay or cause to be paid
  to the Company (as directed by the Company) an amount equal to $19,000,000
  (the "Parent Termination Fee")"
- Forest City (TERMF-REVERSE): "Parent shall pay or cause to be paid to the
  Company … an aggregate amount equal to $488,000,000 (the "Parent
  Termination Paymen[t]" — note the term is "Payment", not "Fee")
- Dyax (defined term, two-sided): ""Termination Fee" means (x) with respect
  to a payment required to be made by the Company an amount equal to
  $180,000,000 and (y) with respect to a payment required to be made by
  Parent an amount equal to $280,000,000." — the flagship COMPOUND quote:
  two claims, parser ABSTAINs. (Bytes corrected per audit M-1: the DB text
  carries NO commas around the amounts; an earlier draft inserted three.
  The fixture-integrity test — test 1 — is the gate that catches exactly
  this class of drift.)
- Cooper Tire (TERMF-TAIL): "at any time on or prior to the first
  anniversary of such termination the Company or any of its Subsidiaries
  enters into a definitive agreement with respect to any Company Takeover
  Proposal"
- Concho (TERMF-TARGET trigger text): "If Parent terminates this Agreement
  pursuant to Section 8.1(c) (Company Change of Recommendation) … then the
  Company shall pay Parent the Company Termination Fee"
- Covance (TERMF-REVERSE trigger + pay limb — committed bytes EXTENDED per
  audit M-6: the trigger text alone carries zero payment-direction text and
  would queue `FEE_SIDE_UNCORROBORATED`; the committed fixture spans the
  card through the pay limb so fee_side corroborates): "the Company
  terminates this Agreement pursuant to Section 7.01(d) because of a
  failure by Parent to comply with its obligations under Section 5.03(c)"
  … "then Parent shall pay the Company a termination fee equal to
  $305,000,000 (the "Parent Termination Fee")" (both from the same card;
  the fixture file commits the contiguous card span covering both limbs)
- Anadarko (defined term / TERMF-TARGET): "the Company shall pay (or cause
  to be paid) to Parent (by wire transfer of immediately available funds),
  (x) in the case described in clause (i) or (iii), $1,000,000,000 (the
  "Termination Fee")" — quote corrected per audit C-1: the previously
  listed "payable by the Company … wire transfer" text was FABRICATED
  (appears on no committed card). SELLER corroboration on this quote runs
  through "Company shall pay", not any "payable by" phrasing.
- Carrols / Prometheus / Concho / Cooper defined-term amounts:
  $9,500,000 / $325,364,166 + $650,728,333 / $300,000,000 + $450,000,000 /
  $83,401,678 — non-round amounts exercise strict grouping.
- CSRA (defined term, cross-reference only): ""Termination Fee" has the
  meaning set forth in Section 8.4(f)" — the pinned NO_MONEY_LITERAL case.

Provenance corrections (audit m-2): the Bioverativ $326,000,000 and Cooper
Tire $83,401,678 defined-term quotes live on `provision_subtype` NULL cards
(the v1-hygiene population flagged in Known costs), NOT on the labeled
TERMF-TARGET cards — fixture headers must record the true card ids and the
NULL subtype. Prometheus's literal bytes are `$ 325,364,166` (space after
`$`): the parser grammar already tolerates `$` + whitespace, and the
coverage map and fixture commit the LITERAL bytes, never retyped ASCII.

## 1. Registry (`contract-bundle.js` → V15)

Strictly additive spread of V14. **New concepts: none** — `TERMF-TARGET`,
`TERMF-TAIL` (V1) and `TERMF-REVERSE` (V3) already exist. New claim
definitions:

```
TERMINATION_FEE_AMOUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_FEE_AMOUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

TERMINATION_FEE_TRIGGER_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_FEE_TRIGGER'
  version: 1
  allowed_canonical_values: [                            // enum, registry-hosted
    'CHANGE_IN_RECOMMENDATION_TERMINATION',
    'NO_SOLICIT_BREACH_TERMINATION',
    'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
    'OUTSIDE_DATE_TERMINATION',
    'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
    'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
    'SUPERIOR_PROPOSAL_TERMINATION',
  ]
  canonical_value_required_when_present: true

TERMINATION_FEE_TAIL_PERIOD_MONTHS_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'
  canonical_value_required_when_present: true
```

The trigger enum is the six codes ALREADY registered in
`TERMINATION_FEE_TRIGGER_PATH/V2.allowed_trigger_codes` — never a parallel
vocabulary — plus exactly one addition, `SUPERIOR_PROPOSAL_TERMINATION`
(the company fiduciary-out termination; corpus-grounded: Bioverativ
§8.01(d)(i) fee, Carrols §8.1(h) — cite corrected per audit M-5; Carrols
§8.1(b) is the Legal Impediment termination, and a wrong section cite
inside a registry-section legal ruling is exactly the plausible-but-wrong
artifact this program hunts. The earlier "v1's most-populated trigger
code" clause is dropped per audit m-5 — asserted without a query receipt).
The trigger-path schema itself is NOT edited — its six-code list governs
pathway expressions in the reviewed serving slices and stays frozen; the
claim enum is a superset, reconciled when a superior-proposal pathway is
designed (out of scope). Unlike P1's count_kind (which the fixture-shape
validator forced into a resolver constant), `allowed_canonical_values` is a
supported definition field (precedent: `NO_SHOP_PROHIBITED_ACTION`), so the
enum lives in the registry where Ben reviews it.

**Two enum decisions, pinned as legal rulings:**

- **`NAKED_NO_VOTE` is deliberately EXCLUDED.** "Naked" means the fee is
  payable on vote failure WITHOUT a competing-proposal precondition — a
  claim about the ABSENCE of a condition. Under M3 rule 1 the producer never
  asserts a negative; nakedness is a DERIVED classification for the (future)
  scope-closure machinery, computed from the presence/absence of a
  corroborated tail/proposal condition. A producer that emits
  `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` is correct on both a naked and
  a conditioned no-vote fee; a producer taught to emit NAKED_NO_VOTE would
  publish an invisible, authoritative-looking negative. This is the family's
  primary corruption trap and the reason this ruling is in the registry
  section, not a footnote.
- **v1's `ANTITRUST_FAILURE` / `FINANCING_FAILURE` are NOT promoted.** The
  corpus shapes (Frontier's regulatory reverse fee, Covance's
  conditions-unsatisfied fee) are COMPOSED triggers (outside-date or breach
  termination + an unsatisfied-condition state), not single quote-local
  events. Forcing them into one enum value would be rule-3 nearest-fit
  forcing. They stay open world, feeding the commonality report. Priced.

Governed attributes (never in keys — one definition, side-dimensioned, the
P1/measurement-date precedent), all participating in claim identity/closure:

- `fee_side`: enum `SELLER | BUYER` (frozen resolver constant — matches the
  existing `fee_side` vocabulary in the V3/V4 metric-operation bindings).
  SELLER = company pays (TERMF-TARGET); BUYER = parent pays (TERMF-REVERSE).
  On `TERMINATION_FEE_AMOUNT` and `TERMINATION_FEE_TRIGGER`; not on the
  tail-period claim (the tail is a condition on the company-side fee).
  Side-bearing-tail detection, made implementable per audit m-4: the tail
  handler runs the BUYER fee_side corroboration patterns over the tail
  quote; any BUYER-side match → review, typed `TAIL_SIDE_BEARING`, never
  resolve. That typed reason + trigger condition IS the gate — "route to
  review" with no mechanism is not a spec.
- `fee_term_ref` (`TERMINATION_FEE_AMOUNT` only): the verbatim defined-term
  phrase from the quote ("Termination Fee", "Company Termination Fee",
  "Parent Termination Fee", "Parent Termination Payment"). REQUIRED, and
  enforced as a verbatim substring of the byte-verified quote (P1 M-3
  discipline); failure → review, typed `FEE_TERM_NOT_IN_QUOTE`. An amount
  with no identifiable fee term routes to review typed
  `FEE_TERM_UNIDENTIFIED`, never resolves — this is the gate that stops an
  expense-reimbursement or purchase-price dollar publishing as a
  termination fee. **Honest consequence, pinned per audit M-2 (Dyax-shape
  defined terms):** the defined term ""Termination Fee"" sits BEFORE limb
  (x), so a contiguous sub-quote of limb (y) can never contain it without
  also swallowing limb (x)'s $180,000,000 (→ `MULTIPLE_MONEY_LITERALS`).
  The $280M BUYER claim therefore lands in `FEE_TERM_UNIDENTIFIED` review
  this slice EVEN WITH a perfectly-splitting producer; the SELLER limb's
  sub-quote (which starts at the defined term and stops before "and (y)")
  resolves normally. Defined-term-limb amounts on the far side of the term
  queue on fee_term this slice — that is the designed outcome, not a bug;
  any relaxation is a typed, Ben-reviewed design change, never implementer
  discretion.
- `payer_party`: verbatim party phrase ("the Company", "Parent") — feeds
  the existing `resolveParty`/`PARTY_CAPACITY_LEXICON` path, minting party
  role `FEE_PAYER`; unresolvable → existing `PARTY_UNRESOLVED` review.
- `currency`: fixed `'USD'` this slice, stamped by the parser only when the
  literal is `$`-prefixed. Never producer-asserted.

**Corroboration tables (frozen resolver constants — label must match quote
text, the P1 C-4 discipline; every pattern below is grounded in a committed
fixture quote):**

`fee_side` ↔ payment-direction text (NEVER termination-direction text — "the
Company terminates … Parent shall pay the Company" is a BUYER fee whose
quote contains "the Company" twice; keying on pay-verbs, not terminate-verbs,
is what makes Covance/EWC resolve correctly — noting per audit M-6 that
Covance resolves only on its EXTENDED committed fixture, which includes the
"then Parent shall pay the Company" pay limb; the trigger text alone has no
pay-verb and queues `FEE_SIDE_UNCORROBORATED`):

- `SELLER` ↔ `/\bCompany (shall|will) pay\b/i` ∪
  `/payment required to be made by the Company/i` ∪
  `/Company Termination Fee/`
- `BUYER` ↔ `/\bParent (shall|will) pay\b/i` ∪
  `/payment required to be made by Parent/i` ∪
  `/Parent Termination Fee/` ∪ `/Parent Termination Payment/`
- DROPPED limbs (audit C-1/C-2): `/payable by the Company/i`,
  `/payable by Parent/i` and the `fails to pay` alternatives are removed —
  none of those strings appears in ANY committed fixture quote, so under
  this section's own grounding rule they may not ship. They may be
  re-added only with a corpus query receipt attached to the PR.
- Neither side matches → review, typed `FEE_SIDE_UNCORROBORATED`. BOTH
  sides match → review, typed `AMBIGUOUS_FEE_SIDE`, never resolve either.
  The committed two-sided fixture is Concho's §8.3(e)/(f) tail region,
  which contains BOTH "the Company shall pay Parent the Company
  Termination Fee" and "Parent shall pay the Company the Parent
  Termination Fee" (byte-verified). Re-pin per audit C-2: Envestnet's
  mutual suit-costs clause ("if the Company or Parent, as the case may be,
  fails to timely pay any amount due pursuant to Section 10.3") is an
  out-of-scope TERMF-EXPENSE card and, against this frozen table, matches
  NEITHER side — it is DROPPED as the ambiguity fixture; if fixtured at
  all it pins `FEE_SIDE_UNCORROBORATED`, never `AMBIGUOUS_FEE_SIDE`.

`TERMINATION_FEE_TRIGGER` code ↔ quote text (every pattern word-bounded —
audit C-3: the earlier draft's boundary-free, hair-trigger limbs like bare
`/solicit/` and `/end date/` fired on "solicited"/"breaches its
obligations" tail prose and inside "Dividend Date"):

- `CHANGE_IN_RECOMMENDATION_TERMINATION` ↔
  `/\bchange (in|of) recommendation\b|\badverse recommendation\b/i`
  (Concho's "(Company Change of Recommendation)" parenthetical)
- `NO_SOLICIT_BREACH_TERMINATION` ↔ `/\bno[- ]solicitation\b/i`
  (Concho "(No Solicitation by the Company)"; the bare `/solicit/` limb is
  dropped — it matches "solicited"/"solicitation" prose corpus-wide)
- `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` ↔
  `/\b(stockholder|shareholder) approval\b|\bstockholders.? meeting\b/i`
  (Anadarko "Company Stockholder Approval shall not theretofore have been obtained")
- `OUTSIDE_DATE_TERMINATION` ↔ `/\boutside date\b|\bend date\b/i`
  (Frontier "Outside Date"; Concho "(End Date)"; the boundary stops
  "Dividend Date")
- `COUNTERPARTY_COVENANT_BREACH_TERMINATION` ↔
  `/\bbreach(es|ed)?\b|\bcomply with its obligations\b|\bfail(s|ed)? to perform\b/i`
  (Covance "failure by Parent to comply with its obligations")
- `INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION` ↔ `/\bintervening event\b/i`
- `SUPERIOR_PROPOSAL_TERMINATION` ↔ `/\bsuperior proposal\b/i`

**Trigger ambiguity rule (audit C-3 — mirrors `AMBIGUOUS_FEE_SIDE`; this
family's quotes are multi-trigger as the NORM, not the edge):** matching
only the asserted code's patterns cannot bind label to text — Concho's
recommendation-change quote also contains "(No Solicitation by the
Company)", and Frontier's TERMF-TARGET quote simultaneously corroborates
STOCKHOLDER_APPROVAL_FAILURE, OUTSIDE_DATE and
COUNTERPARTY_COVENANT_BREACH. A producer that swaps two plausible codes on
such a quote would pass single-code corroboration and mint an
identity-bearing wrong enum — the exact wrong-but-in-enum corruption P1
C-4 exists to stop. Therefore the handler runs the FULL pattern table over
the quote: if patterns for ≥2 DISTINCT enum codes match, the claim routes
to review, typed `AMBIGUOUS_TRIGGER_CORROBORATION` — UNLESS the producer's
assertion quotes a narrower sub-quote (verbatim contiguous substring of
the parent quote, P1 overlap rule) in which exactly one code's patterns
match; then that single code resolves. The resulting extra review rate on
multi-trigger quotes is a named known cost alongside
`TRIGGER_UNCORROBORATED` (see Known costs) — never a reason to loosen.

A trigger quote that cites ONLY a section number ("terminated by the Company
pursuant to Section 8.01(d)(i)" — Bioverativ) fails corroboration → review,
typed `TRIGGER_UNCORROBORATED`. This is the honest outcome: resolving a bare
cross-reference to its legal content is relationship machinery
(`TRIGGERED_BY` + citation resolution), not quote-local production. The
resulting review rate is a named known cost, not a defect. Out-of-enum
trigger codes route to open world via an EXPLICIT `pushOpenWorld` with a
typed reason in the handler (P1 C-4: the main loop's open-world routing keys
on proposal_kind and will not catch it).

## 2. Value parser: `termination-fee-parse.js`

New pure module, `measurement-date-parse.js` / `share-count-parse.js`
contract shape: typed `{outcome:'RESOLVED', canonical_value, matched_text,
currency}` or `{outcome:'ABSTAIN', reason}` — never a throw on prose, never
arithmetic, never repair. `TERMINATION_FEE_PARSE_VERSION` threaded into the
resolution receipt (P1 M-6). Two exported functions:

**`parseFeeAmount(quote)`** — the P1 tokenizer INVERTED: P1 excluded
currency-prefixed literals and counted bare numerals; this parser counts
ONLY currency-prefixed literals and ignores bare numerals entirely (so
"no later than three (3) Business Days", "two (2) Business Days", section
numbers, dates, "50%" thresholds and interest-rate prose never contaminate
a fee quote's count — all real fixture quotes contain such numerals).

- Candidate token: `[$€£]` optionally followed by whitespace, then a maximal
  digit-comma-dot run. Section-reference/date/time exclusions from P1 are
  inherited (LTR-mark-tolerant grammar, matched against LITERAL committed
  fixture bytes, never retyped ASCII).
- Exactly one surviving `$` literal with STRICT 3-digit grouping
  (`^\d{1,3}(,\d{3})*(\.\d+)?$` after `$`-strip) → RESOLVED; canonical form:
  strip `$`, strip grouping commas, preserve any decimal as-written
  (`'326000000'`, `'325364166'`); must round-trip `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex; `currency: 'USD'`.
- Malformed grouping → ABSTAIN `MALFORMED_GROUPING` (no repair).
- `€`/`£` prefix → ABSTAIN `NON_USD_CURRENCY` (no FX, ever) → review.
- Two or more surviving money literals → ABSTAIN `MULTIPLE_MONEY_LITERALS`
  (the Dyax two-sided defined term: TWO claims; the producer prompt is
  responsible for splitting; the parser never picks).
- Zero money literals → ABSTAIN `NO_MONEY_LITERAL` (the CSRA
  cross-reference-only definition).
- Spelled-out money ("three hundred million dollars") → ABSTAIN
  `NON_LITERAL_MONEY`.
- **Hybrid magnitude money ("$91.5 million", "$1.2 billion", "$45 mm") →
  ABSTAIN `HYBRID_MAGNITUDE_MONEY` (Fable build review 2026-08-03, F-1 —
  this spec originally pinned only the pure spelled-out form; the hybrid
  form is neither pure-literal nor pure-spelled, and resolving its bare
  digits is a wrong-survivor RESOLVED of the P1 F-4 class. The parser
  never multiplies prose into a number.) Checked after multiplicity, so
  "$91.5 million (i.e., $91,500,000)" stays `MULTIPLE_MONEY_LITERALS`.**
- **Tokenizer pin (F-2, same review): the digit-comma run must end on a
  digit, so the sentence comma in "$280,000,000, payable …" is never
  swallowed into the run (a bare `[\d,]*` turns the most common fee
  drafting shape into a spurious `MALFORMED_GROUPING`).**
- NO zero-pattern table for this family: a genuine $0 termination fee is
  not corpus-attested; "no more than one termination fee" (Carrols) is
  anti-double-dip prose (TERMF-RTF-ANTI territory), never a fee amount.

**`parseTailPeriodMonths(quote)`** —

- RESOLVES only a literal digit month count: `12 months` or the
  belt-and-braces form `twelve (12) months` (the parenthesized DIGIT is the
  literal; the word is ignored, never trusted alone).
- Word-only periods ("twelve months") → ABSTAIN `NON_LITERAL_NUMERAL`.
- `/anniversary/i` present (Cooper's "first anniversary of such
  termination") → ABSTAIN `ANNIVERSARY_PHRASE` → review. Converting "first
  anniversary" to 12 is legally sound but it is INTERPRETATION, and a
  mechanical parser that interprets once will be extended to interpret
  twice; Ben confirms these in review at trivial cost.
- Day/year units ("365 days", "one year" with digits) → ABSTAIN
  `NON_MONTH_UNIT` — never unit arithmetic.
- **Precedence, pinned (audit M-4 — the committed tail fixtures are ALL
  mixed-unit, so leaving this to the implementer repeats the exact class
  P1's re-audit `AMBIGUOUS_LITERAL_AND_ZERO` finding had to pin):** the
  multiplicity check runs FIRST, counting period literals of ANY unit
  (months, days, years, Business Days). ≥2 period literals of any unit →
  ABSTAIN `MULTIPLE_PERIOD_LITERALS`, before `NON_MONTH_UNIT` or RESOLVED
  can apply. Concho's tail card ("seven (7) Business Days" twice alongside
  "twelve (12) months" four times) and the Frontier/Carrols mixed quotes
  therefore ABSTAIN `MULTIPLE_PERIOD_LITERALS`; the producer splits to the
  "(ii) within twelve (12) months…" limb, whose sub-quote resolves `'12'`.
  Exactly one period literal in a non-month unit → `NON_MONTH_UNIT`. Zero
  → `NO_PERIOD_LITERAL`. (`/anniversary/i` is checked before all of this,
  as above.)

**Percent-of-deal-value claims are NOT parsed and NOT produced.** The
existing `SELLER_/BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE` definitions
are DERIVED metrics (fee ÷ deal value — arithmetic) owned by the serving
metric-operation bindings; a producer/parser that computed them would
violate the never-arithmetic rule. They are named here only so no
implementer "helpfully" wires them to the new parser.

## 3. Producer prompt + provider

- **New prompt module** `lib/canonical-v2/native-producer/termination-fee-producer-prompt.js`
  — `capitalisation-producer-prompt.js` is NOT edited (its PROMPT_VERSION
  does not move; the three recorded capitalisation fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-termination-fee/v1'`,
  `PROMPT_VERSION 1`. Response shape: `fee_amount_assertions`
  (section_reference, fee_side, payer phrase, fee-term phrase, verbatim
  quote), `fee_trigger_assertions` (section_reference, fee_side,
  trigger_code from the enum, verbatim quote), `tail_period_assertions`
  (section_reference, verbatim quote), `open_world_candidates`. The
  PRESERVE-THE-NOVEL instruction is copied verbatim; the prompt explicitly
  says: when unsure of trigger_code or fee_side, keep it in
  `open_world_candidates`; a compound quote stating two amounts or two
  sides must be SPLIT into two assertions, each quoting its own limb.
  Prompt scope: termination/fee article sections via the existing
  section-scope mechanism; capitalisation sections see zero prompt change.
- **Run wiring (pinned per audit m-3 — implementer-guess risk):**
  `native-extraction-run` schedules the two prompt modules as SEPARATE
  prompt executions per run — the capitalisation module over its existing
  section scope, the termination-fee module over the termination/fee
  article scope — each recorded in the run manifest under its own
  PROMPT_ID/PROMPT_VERSION. The three new response lists belong to the
  termination-fee module's OWN response schema; this is deliberately NOT
  the share_count precedent (which added lists to the SAME capitalisation
  response) — the provider dispatches on PROMPT_ID to select the expected
  list set for each recorded/live response. Recorded capitalisation
  responses replay byte-identically because their module and schema are
  untouched.
- **`anthropic-provider.js`**: three new generic keys, each with a
  non-OPEN_WORLD proposal_kind —
  `NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE` / `FEE_AMOUNT`,
  `NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE` / `FEE_TRIGGER`,
  `NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE` / `FEE_TAIL_PERIOD`.
  Quote byte-verification identical to existing proposals. The three new
  response lists are NOT added to `REQUIRED_RESPONSE_LISTS` (the
  share_count_assertions strict-additivity precedent, provider ~83–89):
  recorded capitalisation responses predate them; missing/non-array reads
  as empty, never a schema failure.
- Golden evals: there are no recorded responses for this family to reshape.
  The first recorded fixtures are minted BY the first live runs
  (subscription CLI), each documented as its own dated handoff. Until then
  the pre-rerun harness (section 5) is the only test surface, and is
  labeled as such.

## 4. Resolver wiring (`candidate-resolution.js`)

- THREE entries in `RESOLUTION_UNCONDITIONAL` — one per generic key, so the
  Map's key-uniqueness is structural; the table-validation test still
  asserts no duplicate generic keys (P1 M-2). As with P1's SHARE_COUNT
  entry, `registered_claim_definition_key` is set where unambiguous
  (`TERMINATION_FEE_TAIL_PERIOD_MONTHS` for the tail key) and the
  amount/trigger entries carry their single definition key directly —
  no definition split exists in this family; what splits is the CONCEPT:
  the table's `concept_key` for the amount and trigger entries is null,
  and the dedicated handler assigns `TERMF-TARGET` (fee_side SELLER) or
  `TERMF-REVERSE` (fee_side BUYER) ONLY AFTER fee_side corroboration
  passes; every uncorroborated/ambiguous side routes to review before any
  concept is minted. Tail entry: concept fixed `TERMF-TAIL`.
  **Pre-concept review routing (audit M-3):** review items take
  `concept_key: mapping ? mapping.concept_key : conceptFamily` and
  `materialityFor` prefix-matches it — with a bare null concept_key, every
  `TRIGGER_UNCORROBORATED` / `FEE_SIDE_UNCORROBORATED` /
  `AMBIGUOUS_FEE_SIDE` / `AMBIGUOUS_TRIGGER_CORROBORATION` / `FEE_TERM_*`
  item (this family's PREDICTED-COMMON review classes) would rank
  UNCLASSIFIED 99 and sort fee reviews below notices, inverting the M3
  queue ordering — and this spec's own ban on override-map entries closes
  that patch. So the handler passes conceptFamily `'TERMF-PENDING'` on
  every review item minted before concept assignment: any `TERMF-*` token
  prefix-matches the existing FEES tier's `TERMF-` prefix → rank 20 (the
  same triage device as the SHARE_COUNT entry's deliberate
  `concept_key: REP-T-CAP`). `'TERMF-PENDING'` is a routing token only —
  never a registered concept, never publishable.
  `MAPPING_TABLE_VERSION` 4 → 5.
- Dedicated handlers (TEMPORAL/share-count pattern): corroboration checks →
  attribute verbatim checks (`fee_term_ref`) → `termination-fee-parse.js`
  (amount/tail) or enum + corroboration only (trigger; no parse — the
  canonical value IS the enum code) → concept assignment → gates. Every
  ABSTAIN routes to review with the parser's typed reason; RESOLVED values
  still pass `canonicalValueAllowed` (a parser bug must not bypass the
  gate); out-of-enum trigger/fee_side → explicit `pushOpenWorld`, typed.
- Materiality: existing `FEES` tier, rank 20, via the `TERMF-` prefix —
  no new tier, no override-map entries (see Grounding corrections).
- Party: `payer_party` through `resolveParty` → role `FEE_PAYER`; the
  payee tuple is NOT minted this slice (it is derivable but would be an
  asserted party with no quote of its own; the V3/V4 serving bindings
  already carry governed payer/payee tuples for the metrics layer).
- Resolution receipt: `termination_fee_parse_version` threads into
  `receiptBody` alongside the bumped `mapping_table_version` and the V15
  `contract_vocabulary_digest`.
- Additivity re-pin, stated honestly (P1 M-1): with no termination-fee
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under V15), the
  new parser-version field, and the recomputed `resolution_receipt_id`;
  field-level diff documented in the PR. Skipping the version bump to keep
  old pins green is the named anti-pattern.
- Identity: `fee_side`, `fee_term_ref` and the trigger code participate in
  claim identity/closure — a section granting both a Company fee and a
  Parent fee (Concho §8.3, Dyax) mints distinct, stable, non-deduping
  claims.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` V1 → V2)

Uncovered families block auto-pass, so the lexicon grows in this same slice
(program invariant). Keys are the registered concept keys — `TERMF-TARGET`,
`TERMF-REVERSE`, `TERMF-TAIL`. Version bump 1 → 2; content hash re-pinned;
every entry carries a one-line rationale. All patterns grounded in the
committed fixture quotes; word-boundary rule applies throughout.

- `TERMF-TARGET` (`LITERAL_PHRASE`): "termination fee" (fires on
  "Termination Fee" / "Company Termination Fee" alike — veto-only, so
  double-side coverage is a feature, see below); "liquidated damages"
  (Bridge: "not a penalty, but rather is liquidated damages"); "fee in the
  amount of" (Bioverativ).
- `TERMF-REVERSE` (`LITERAL_PHRASE`): "parent termination fee",
  "parent termination payment" (Forest City — the term is "Payment"; a
  fee-only pattern would blind the net to that deal's reverse fee),
  "reverse termination fee" (explicitly UNGROUNDED market vocabulary —
  audit m-1: it matches ZERO `primary_quote` bytes corpus-wide and appears
  only in v1 card labels, e.g. Frontier's section_ref; the earlier "appears
  in v1 card prose" rationale was false. Retained deliberately because the
  net scans agreement text, not card prose, and market drafting uses the
  phrase; veto-only, so a pattern that never fires costs nothing),
  and "termination fee" AGAIN under this family — deliberately duplicated:
  in a section carrying only a company fee, the TERMF-REVERSE copy is
  unmatched and vetoes a careless `ABSENT` on the reverse fee (and vice
  versa). Veto-only design makes the duplication pure safety.
- `TERMF-TAIL` (`LITERAL_PHRASE`): "anniversary of such termination"
  (Cooper), "enters into a definitive agreement" (Cooper),
  "publicly withdrawn" (Concho), "becomes publicly known" (Bridge/Cooper),
  "acquisition proposal" (Anadarko/Bridge/Carrols — noisy in NOSOL-governed
  sections, but an unmatched TERMF-TAIL hit there costs a queue item, never
  a wrong claim; priced).
- **Priced exclusions, ruled here:** the naked token "fee" (chapeau-level
  expense prose in every agreement — noise that pressures deletions, and
  deletions widen auto-pass); the naked token "tail" (not corpus-attested
  in the fee sections; v1's `/\btail\b/i` synonym serves display, not
  veto); "wire transfer" and "immediately available funds" (pure payment
  mechanics, appear in consideration sections corpus-wide). Residual blind
  spot: a fee clause whose only tells are payment mechanics — priced; the
  v1↔v2 comparator covers that shape (all 40 deals have v1 TERMF cards to
  disagree with).

## 6. Acceptance tests (real-fixture-first; pre-rerun harness per P1 M-5)

1. Fixture integrity: every committed corpus quote byte-verifies against
   its fixture file; provenance (deal, provision_card id, 2026-08-02)
   recorded in the fixture header; tests run on the LITERAL committed
   bytes.
2. Parser, table-driven over the coverage map: every fixture amount
   resolves to its exact canonical value (`'326000000'`, `'19000000'`,
   `'488000000'`, `'9500000'`, `'325364166'`, `'650728333'`, `'300000000'`,
   `'450000000'`, `'83401678'`, `'1000000000'`); Dyax compound ABSTAINs
   `MULTIPLE_MONEY_LITERALS` and its two hand-enumerated split sub-quotes
   (each a contiguous substring of the committed parent quote, P1
   overlap rule) resolve to `'180000000'` / `'280000000'`; CSRA ABSTAINs
   `NO_MONEY_LITERAL`; bare-numeral immunity ("three (3) Business Days",
   "two (2) Business Days", section refs, "50%") asserted on real quotes;
   `NON_USD_CURRENCY`, `MALFORMED_GROUPING`, `NON_LITERAL_MONEY` each
   exercised; the Prometheus case runs on the literal `$ 325,364,166`
   bytes (space after `$` — audit m-2); tail: Cooper ABSTAINs
   `ANNIVERSARY_PHRASE`; the Concho tail card (mixed "seven (7) Business
   Days" ×2 + "twelve (12) months" ×4) and the Frontier/Carrols mixed
   quotes each ABSTAIN `MULTIPLE_PERIOD_LITERALS` (audit M-4), and
   Concho's hand-enumerated "(ii) within twelve (12) months…" split limb
   resolves `'12'`; word-only ABSTAINs, single-day-unit ABSTAINs
   `NON_MONTH_UNIT`.
3. Registry: V15 compiles; V14 arrays untouched byte-for-byte; all three
   definitions validate with zero validator changes; trigger enum equals
   the six trigger-path codes + `SUPERIOR_PROPOSAL_TERMINATION` exactly
   (a test diffs the two lists so drift is loud).
4. Resolution (synthetic compiled candidates pinned to committed quotes —
   labeled pre-rerun harness): fee_side corroboration → correct concept
   (Bioverativ → TERMF-TARGET; EWC/Forest City → TERMF-REVERSE; Covance's
   extended fixture → TERMF-REVERSE via its pay limb, audit M-6);
   Concho's two-sided §8.3(e)/(f) region → `AMBIGUOUS_FEE_SIDE` review
   (re-pinned per audit C-2 — Envestnet is dropped as the ambiguity case;
   its mutual suit-costs clause matches neither side and would pin
   `FEE_SIDE_UNCORROBORATED`); Bioverativ section-cite trigger →
   `TRIGGER_UNCORROBORATED` review; Concho FULL trigger quote (which also
   contains "(No Solicitation by the Company)") →
   `AMBIGUOUS_TRIGGER_CORROBORATION` review, and the narrowed
   "(Company Change of Recommendation)" sub-quote → resolves
   `CHANGE_IN_RECOMMENDATION_TERMINATION` (audit C-3); out-of-enum trigger
   exercises explicit `pushOpenWorld`; `FEE_TERM_UNIDENTIFIED` (named
   case: the Dyax $280M BUYER split limb, audit M-2) and
   `FEE_TERM_NOT_IN_QUOTE` each exercised; a BUYER-pattern tail quote →
   `TAIL_SIDE_BEARING` review (audit m-4); materiality rank 20 asserted
   BOTH on a resolved claim AND on a pre-concept review item carrying
   conceptFamily `'TERMF-PENDING'` (audit M-3 — the refactor-proof pin);
   every ABSTAIN class routes to review with its typed reason; additivity
   re-pin with documented field-level diff.
5. Identity: Concho's $300M SELLER + $450M BUYER same-article claims mint
   distinct stable identities; re-run is byte-stable.
6. Lexicon: table validation (keys registered, rationales present, content
   hash re-pinned, V2 version bump); anti-noise regression paragraph
   extended with "detail", "retail" (word-boundary proof for any future
   "tail" temptation) asserting zero hits; determinism permutation tests
   green under the grown table; a TERMF-REVERSE-only section fixture shows
   the duplicated "termination fee" pattern vetoing TERMF-TARGET ABSENT.
7. Full suite + build + forbidden-patterns; phase allowlist for the
   slice's files.

## Out of scope

TERMF-EXPENSE / TERMF-SOLE / TERMF-EFFECT / TERMF-RTF-ANTI / TERMF-REIMBURSE
promotions (no registered v2 concepts; expense caps and sole-remedy
semantics are their own future slices); percent-of-deal-value derivation
(existing serving metric bindings; arithmetic never enters this slice);
NAKED_NO_VOTE derivation (scope-closure machinery); section-cross-reference
trigger resolution (relationship machinery); editing
`TERMINATION_FEE_TRIGGER_PATH/V2` or any reviewed serving slice; non-USD
currencies / FX; the live extraction runs (each a dated handoff; until they
land, NO report may claim this family extracts natively);
`FAMILY_MAPPING_TABLE` extension (separate Fable+Ben table edit with the
wiring slice, per P1).

## Known costs, stated up front

- Section-cite-only trigger quotes are COMMON (Bioverativ-style drafting):
  expect a high `TRIGGER_UNCORROBORATED` review rate initially. The remedy
  is the citation-resolution relationship layer, never loosening
  corroboration.
- Multi-trigger quotes are the NORM in this family, so
  `AMBIGUOUS_TRIGGER_CORROBORATION` review volume will be material until
  producers learn to quote the single trigger limb (audit C-3). Like
  `TRIGGER_UNCORROBORATED`, this rate is a named cost of binding label to
  text — never a reason to loosen the full-table check.
- Two-sided defined terms (Dyax) ABSTAIN until the producer splits them; a
  producer that fails to split costs a queue item, never a wrong number —
  and per audit M-2 a producer that splits SUCCESSFULLY also costs one:
  the far-side limb ($280M BUYER) queues `FEE_TERM_UNIDENTIFIED` this
  slice because no contiguous sub-quote can carry the defined term without
  a second money literal. Both outcomes are queue items, never wrong
  numbers.
- "first anniversary" tails all queue (`ANNIVERSARY_PHRASE`) — a handful of
  one-second Ben confirmations, priced against the interpretation-creep
  alternative.
- The duplicated "termination fee" lexicon pattern and "acquisition
  proposal" under TERMF-TAIL will queue false vetoes in fee-adjacent
  sections; queue data measures the rate; remedies are reviewed lexicon
  refinements, never module-side heuristics (deletion asymmetry applies).
- 16 null-subtype v1 TERMINATION_FEE cards exist in production; they are
  v1 hygiene, not this slice's input, and are flagged to the ingest-QA
  owner rather than silently absorbed here.
