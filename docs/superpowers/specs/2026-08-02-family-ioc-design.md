# Family spec — Interim operating covenants (IOC-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit applied
(1 CRITICAL, 3 MATERIAL, 5 MINOR fixed; 0 parked for Fable) per program
convention (spec-detail → audit → build → review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-track
sibling of P1–P4; follows the five-layer promotion structure).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template, typed-abstain parsers, coverage-map anchored-overlap + honesty
pins), `2026-08-02-family-termination-rights-design.md` (the
producer-prompt-registry dispatch seam — this family dispatches through
it, NEVER a capitalisation fallback), `2026-08-02-family-termination-fee-
design.md` (full-table ambiguity corroboration, pre-concept review
routing), `2026-08-02-lexical-disagreement-net-design.md` (lexicon rules),
EXECUTION-LEDGER M3 review protocol + extraction semantics rules 1–3
(implemented, never amended, here).
**Materiality:** no IOC tier exists today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~446–457, carries no `IOC-` prefix). This spec
proposes one (section 4), flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`,
read 2026-08-02 — evidence pack attached to this slice; every quote below
is verbatim from a production `primary_quote`, cited by provision-card id;
none is invented)

v1 `provision_cards` with `provision_type = 'COVENANT_INTERIM_OPERATING'`:
**1158 cards / 40 deals / 34 tagged subtypes + null.** Load-bearing counts:
IOC-MERGE 131/37, IOC-COMMIT 70/36, IOC-CONTRACT 64/33, IOC-COMP 54/35,
IOC-DEBT 51/35, IOC-TAX 49/34, IOC-CHARTER 48/36, IOC-ISSUE 43/35,
IOC-ACCOUNTING 41/37, IOC-SETTLE 39/35, IOC-DIVIDEND 39/31, IOC-CAPEX
37/32. The single largest bucket is **null subtype: 169 cards / 33 deals**
(v1 flagged-but-unmapped provisions whose `section_ref` carries the literal
label slot `[PROPOSED] Unclassified`) — v1 hygiene, flagged to the
ingest-QA owner, never silently absorbed here (Out of scope).

**Three corpus facts that shape the whole design:**

1. **`kind` is `cross-reference` for 966/1158 (~83%)** of the family's
   cards. Most IOC cards are cross-referencing structures (IOC-COMMIT's
   catch-all "do any of the actions described in Section 5.1(a) through
   Section 5.1(v)", card `53a5f7a0-…`), so a value pass over quote-local
   text alone structurally cannot see thresholds living in referenced
   sub-clauses. This slice promotes quote-local facts ONLY; cross-referenced
   values are relationship machinery, priced in Known costs — the TERMF
   `TRIGGER_UNCORROBORATED` precedent verbatim.
2. **`party_scope` is uniformly `'MUTUAL'` (1158/1158)** — zero
   discriminating signal. Target- vs buyer-side attribution lives in the
   section TITLE (the v1 classifier's IOC-T/IOC-B split,
   `lib/parser-v2/classify.js` ~117–147) and in `section_ref` placeholder
   strings (`IOC-T | …`, e.g. deal `cf32899a-…`; `IOC-B | …`, e.g. deal
   `320a3899-…`). Any design
   branching on `party_scope` is corrupt on arrival; side is carried here
   as a classifier-stamped governed attribute (section 3), never read from
   v1 columns.
3. **Multi-category limbs are the NORM, not the edge.** Card `3a2c477b-…`
   (labelled IOC-CHARTER) restricts charter amendments AND stock splits AND
   dividends in one lettered limb; card `dd0c39da-…` (dividend cap — flagged
   explicitly: `provision_subtype = NULL`, `section_ref` carries
   `[PROPOSED] Unclassified`; used throughout this spec ONLY as a
   drafting-shape/parser/lexicon exemplar, never as one of the 39 tagged
   IOC-DIVIDEND cards) also restricts redemptions and repurchases; card
   `da8a7a2f-…` is labelled IOC-ACCOUNTING but quotes Material-Contract
   restriction text — a live label↔text defect inside this family. v1
   labels are UNTRUSTED input; every corroboration table below exists
   because the corpus itself demonstrates the drift, and the `da8a7a2f-…`
   defect becomes a permanent regression fixture (test 4).

**Vocabulary mismatches, named (registered keys win — the TERMR-NOVOTE
precedent):**

- The compiled bundle registers `IOC-GENERAL-EXCEPT` (v1,
  `contract-bundle.js` line 16); the v1 rubric spells the same idea
  `IOC-GENERAL-EXCEPTIONS` (`lib/rubric.js` CODES). Any mapping layer uses
  the REGISTERED spelling; the rubric spelling never enters v2 vocabulary.
- The rubric's `IOC-T`/`IOC-B` pseudo-types normalize to `IOC` at lookup
  (`lib/rubric.js:4930`). They are SECTION-SIDE markers, not concepts, and
  never become concept keys here — side is a governed attribute.
- `ioc_positive_obligations` / `ioc_negative_obligations` (Supabase, RLS
  on) both hold **0 rows** and carry `obligation_kind` CHECK-constrained
  text (not a Postgres enum type — `obligation_kind` is TEXT+CHECK; the
  negative-side CHECK carries 16 values) far coarser than the 36-code
  rubric taxonomy (no REPURCHASE/SPLIT/REALPROP/WAIVE/AFFILIATE/pharma
  codes — they'd all collapse to `'OTHER'`; note `ioc_positive_obligations`
  DOES carry `MAINTAIN_INSURANCE` among its own CHECK-constrained values).
  Those
  tables are NOT this slice's write target and their enums are NOT this
  slice's category vocabulary; any future migration onto them is a
  separate, Ben-reviewed many-to-one mapping.

**Lint fingerprint, pinned before anything else.** IOC-MERGE's v1 taxonomy
fallback label — the exact three-word section-title string matched by the
`Mergers,\s*Acquisitions,\s*Dispositions` entry in
`scripts/lint/forbidden-patterns.sh` `globalPatterns` — is a bug
fingerprint for a past duplicated-label regression. Its ONLY reviewed
exemption routes are `lib/parser-v2/extract.js`,
`tests/audit-fix-batch-ui.test.js`, `tests/provision-table-configs.test.js`
(FILE_PATTERN_EXEMPTIONS) and the prose-class carve-out for
`tests/fixtures/canonical-v2/*-live-run*/` recordings. Therefore, in this
slice: fixture files commit AGREEMENT TEXT plus provenance ids (deal uuid,
provision_card uuid, retrieval date) and NEVER v1 `section_ref` label
strings (which embed that label, the `IOC-T`/`IOC-B` placeholders, and
`[PROPOSED] Unclassified`); no lexicon pattern, corroboration pattern,
test name or code comment reproduces the label. A new exemption entry is
NOT an acceptable fix for a collision — restructure the fixture instead.

## Deliverable (honest conversion semantics)

**No recorded native-producer runs exist over IOC sections** — the
producer today extracts capitalisation (and, per the sibling wave-one
specs when they land, termination sections). There is nothing to
"convert": no open-world fixture rows, no closure_ids to track. The
deliverable is the five-layer capability plus a pre-rerun harness:

1. Registry, resolver, parser, prompt module, provider key, section-family
   classifier extension and lexicon entries land fully tested against a
   COVERAGE MAP of synthetic compiled candidates pinned to REAL corpus
   quotes committed as fixture bytes (section 6).
2. "The pipeline natively extracts interim operating covenants" may be
   claimed ONLY after dated post-merge live rerun handoffs (subscription
   CLI, one documented run per fixture deal). The P1 audit M-5 pins apply
   verbatim: no report before those handoffs may state family conversion,
   coverage, or recall. Until then the honest claim is "the machinery
   exists and is proven on committed fixtures".

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time (V14 today;
the wave-one family slices each take the next number when they land — the
superset-diff tests make the ordering mechanical; all prior version rows
stay untouched byte-for-byte).

**Concepts.** One of the twelve promoted categories is ALREADY registered:
`IOC-CAPEX` (V1, line 15). Ten new concepts, version 1,
`{concept_key, version}` shape only (the fixture-shape validator rejects
anything else) — each named with its rubric CODES key, each grounded in
the cited corpus cards:

- `IOC-MERGE` — M&A / disposition restrictions (131 cards / 37 deals;
  `d4a16e7f-…`, `2d51200c-…`, `ffe804d5-…`)
- `IOC-CONTRACT` — Material Contract restrictions (64/33; `0d7aeabc-…`,
  `563510fb-…`, `6b78b3a9-…`)
- `IOC-COMP` — compensation/benefits restrictions (54/35; `01ccb717-…`,
  `628f0978-…`, `aa09c049-…`)
- `IOC-DEBT` — indebtedness restrictions (51/35; `e92c390b-…`,
  `affcafb2-…`, `0b0aa5a1-…`)
- `IOC-TAX` — tax election/filing restrictions (49/34; `623821e4-…`,
  `37b76c19-…`)
- `IOC-CHARTER` — charter/bylaws amendment restrictions (48/36;
  `3a2c477b-…`, `4b9149f4-…`, `ab03e623-…`)
- `IOC-ISSUE` — securities issuance restrictions (43/35; `00088c48-…`,
  `d049b109-…`, `cbe720aa-…`)
- `IOC-ACCOUNTING` — accounting-change restrictions (41/37; `4cb66862-…`,
  `8fe0129f-…`)
- `IOC-SETTLE` — litigation settlement restrictions (39/35; `45fea063-…`,
  `9ca3960a-…`, `a99c303b-…`)
- `IOC-DIVIDEND` — dividend/distribution restrictions (39/31;
  `1f0fb14e-…`, `4171dec5-…`, `728fdd66-…`)

This grows the expected-concept-keys row to its next sorted superset. All
ten are FLAGGED FOR BEN in the PR body under the 2026-07-23 concept-
amendment convention — concept-key additions are taxonomy decisions; this
spec proposes, never settles. Deliberately NOT added:

- `IOC-COMMIT` (70 cards) — the corpus shows the v1 "Commitments" bucket
  is TWO unrelated things: the agree-to-do-any-of-the-foregoing catch-all
  (`53a5f7a0-…`), which is STRUCTURE restating every other restriction and
  carries no independent market datum (the TERMR-PREAMBLE precedent —
  structure stays out of the claim vocabulary), and loans/advances/
  investments restrictions (`8435c3b9-…`, `9407d771-…`), a distinct legal
  concept with no clean v1 code of its own. Promoting IOC-COMMIT would
  fuse them — rule-3 nearest-fit forcing. The loans/investments shape
  stays open world, feeding the commonality report until Ben adjudicates
  its own concept. Priced.
- `IOC-POSITIVE-PREAMBLE` / `IOC-NEGATIVE-PREAMBLE` / `IOC-ORDINARY` /
  `IOC-GENERAL-EXCEPTIONS`(rubric spelling) — preamble/chapeau structure
  and carve-out machinery, not restrictions (Out of scope; the registered
  `IOC-GENERAL-EXCEPT` concept is untouched and unpromoted).
- The long tail (OTHER-AFFIRMATIVE, IP, NEWLINE, AFFILIATE, REPURCHASE,
  SPLIT, REALPROP, HIRE, LIEN, NOACTION, INSURANCE, WAIVE, MAINTAIN,
  PRESERVE, EXISTENCE) and the three pharma-industry codes
  (IOC-CLINICAL/PRODUCT/REGAUTH, ≤6 deals each) — below the coverage bar
  for a first slice; their drafting stays open world. The 36-code rubric
  taxonomy also carries `IOC-AFFIRMATIVE` and `IOC-ENVIRO`, both with
  **zero corpus cards** — not tagged on any v1 `provision_card`, so they
  contribute no corpus evidence either way and are not part of the open-
  world drafting stays-open-world list above; noted here only so the
  rubric-vs-corpus code counts reconcile.

**Claim definitions** (two; the family's facts are one presence claim and
one mechanical dollar value):

```
IOC_RESTRICTION_PRESENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'IOC_RESTRICTION_PRESENT'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

IOC_RESTRICTION_THRESHOLD_AMOUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'IOC_RESTRICTION_THRESHOLD_AMOUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'  // existing type
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. Both definitions grow
the expected-claim-keys row (sorted superset; superset-diff test).

**Named, fenced off:** `IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE`
(registered V1, governed by `MONEY_DENOMINATOR_PRECISION_POLICY_V1`) is a
DERIVED serving metric — threshold ÷ deal value is ARITHMETIC and belongs
to the serving metric-operation bindings. The promoted
`IOC_RESTRICTION_THRESHOLD_AMOUNT` (category CAPEX) is exactly its future
numerator input. No producer or parser in this slice computes, emits, or
touches the percent definition — it is named here only so no implementer
"helpfully" wires it to the new parser (the TERMF percent-of-deal-value
fence, verbatim).

**Governed attributes (never in keys; all participate in claim identity
so two same-section restrictions never collide or dedupe):**

- `restriction_category`: enum `MERGE | CONTRACT | COMP | DEBT | TAX |
  CHARTER | ISSUE | ACCOUNTING | SETTLE | DIVIDEND | CAPEX` — the eleven
  promoted categories, mapped to concepts by a frozen resolver map
  (section 4). The enum is a gate, not a suggestion: out-of-enum →
  explicit `pushOpenWorld` with a typed reason (P1 C-4 — the main loop's
  open-world routing keys on proposal_kind and will not catch it). A
  producer unsure of category keeps the assertion in
  `open_world_candidates`; the 22 further rubric codes are exactly the
  novelty the open-world path preserves.
- `covenant_side`: enum `TARGET | BUYER`. **Stamped by the deterministic
  section-family classifier (section 3), NEVER producer-asserted and NEVER
  read from v1 columns** — `party_scope` is constant `'MUTUAL'` corpus-wide
  and carries no signal, and limb quotes routinely name no party at all
  (the chapeau does: "Columbus shall, and shall c…", card `508890ee-…`).
  Participates in identity: a target-side and a buyer-side dividend
  restriction in the same deal are different market data points. No party
  tuple is minted this slice (a party asserted without quote evidence of
  its own would violate the verbatim discipline; the TERMF payee
  precedent) — FLAGGED FOR BEN as a deliberate omission.
- `IOC_RESTRICTION_THRESHOLD_AMOUNT` additionally: `threshold_basis` —
  enum `INDIVIDUAL | AGGREGATE`, corroborated against the parser's
  `matched_text` context (section 4). **This is the family's primary
  numeric-corruption trap:** the corpus co-locates two semantically
  distinct thresholds in one limb ("not exceeding $250,000 individually or
  $1,000,000 in the aggregate", card `cdf1901c-…`; "$150,000,000 in the
  aggregate", card `e92c390b-…`). An extractor that grabs the first number
  silently publishes the wrong basket. `threshold_basis` participates in
  claim identity — an individual cap and an aggregate cap in the same limb
  never collide or dedupe.
- `currency`: fixed `'USD'` this slice, stamped by the parser only when
  the literal is `$`-prefixed. Never producer-asserted.

**Deliberately NOT promoted as claims (each a legal ruling, not an
omission):**

- **Consent standards** ("such consent not to be unreasonably withheld,
  conditioned or delayed", card `508890ee-…`) — qualifier-like per the
  family's own shape: a consent standard modifies the restriction it
  attaches to, exactly as a knowledge qualifier modifies a rep. Promoting
  it as a standalone claim here would mint a parallel qualifier vocabulary
  alongside P2's `QUALIFIER_KINDS` machinery. It waits for a P2-track
  qualifier kind (Out of scope), and until then the drafting stays inside
  the restriction quotes as reviewer-visible evidence.
- **Percentages and ratios** — three literal encodings coexist, sometimes
  in one clause ("fifteen percent (15%) for any individual or four percent
  (4%) in the aggregate", card `628f0978-…`; bare "110%" capex tolerance,
  card `cdf1901c-…`; "at least 85% … received in cash", card
  `ffe804d5-…`), the recurring 110% is BUDGET-RELATIVE (percent OF an
  extrinsic budget, not an absolute value), and the "4.50x" leverage
  multiple (card `0b0aa5a1-…`) is defined entirely by cross-reference to a
  1999/2019 credit agreement outside the corpus — an uninterpretable
  numeric under quote-local semantics. All stay open world.
- **Day counts / notice windows** — at least four unit grammars ("60
  days", "three Business Days", "10-day period", "30 days' notice") plus
  inverted framings ("upon notice of 90 days or less" caps the notice
  OFFERED, it is not a forward deadline). Open world; the TERMR cure/notice
  split showed how expensive a premature day-count promotion is.
- **Salary-tier bright lines** ("annual base salary of $150,000 or more",
  card `628f0978-…`) — a dollar GATE selecting which employees a
  restriction covers, not a basket the restriction permits. Asserting it
  as a threshold amount would corrupt the basket statistic. The parser's
  one-literal rule makes the `628f0978-…` limb ABSTAIN anyway (three
  co-located `$150,000` gates); a single-gate quote that slips through is
  caught by basis corroboration (neither INDIVIDUAL nor AGGREGATE pattern
  matches "or more" gate drafting) → review. Priced.
- **Per-unit rates** ("$17,000 per restaurant on an annual basis", card
  `e14cabe0-…`; "$0.55 per share", card `dd0c39da-…`) — a rate, not a
  basket; no basis pattern matches → `THRESHOLD_BASIS_UNCORROBORATED`
  review by construction. The Kraft per-share cap additionally carries a
  scheduled step-up ("may be increased to … $0.5775") and ABSTAINs
  `MULTIPLE_MONEY_LITERALS` before basis is ever reached.

M3 rule 1 restated for this family, because its drafting invites the
violation: the producer NEVER asserts "this deal does not restrict X", and
carve-out prose ("nothing in this Section 5.1 shall prohibit any
transactions between the Company and one or more of the wholly owned
Company Subsidiaries", card `53a5f7a0-…`) is EXCEPTION text, not a
negative to emit — it stays inside the restriction quote as evidence.
Derived ABSENT ("no dividend restriction in this deal") belongs to the
future scope-closure machinery, forever.

## 2. Value parser: `ioc-threshold-parse.js`

New pure module, `measurement-date-parse.js` / `termination-fee-parse.js`
contract shape: typed `{outcome:'RESOLVED', canonical_value, matched_text,
currency}` / `{outcome:'ABSTAIN', reason}` — never a throw on prose, never
arithmetic, never repair. `IOC_THRESHOLD_PARSE_VERSION` threaded into the
resolution receipt (P1 M-6).

`parseThresholdAmount(quote)` — the TERMF `parseFeeAmount` discipline:
counts ONLY currency-prefixed literals; bare numerals (section refs,
"(A)"–"(D)" limb letters, day counts, record-date "2 days", percentage
numerals, "fifteen percent (15%)" parentheticals, years like "2024") are
never candidates.

- Candidate token: `[$€£]` optionally followed by whitespace, then a
  maximal digit-comma-dot run. The tokenizer boundary is non-`[0-9,.]`…
  with the trailing-punctuation pin made explicit: the corpus runs dollar
  figures straight into enumerations — a genuine trailing comma AFTER the
  literal ("in excess of $3,000,000 individually, or $10,000,000, in the
  aggregate;", card `d7f48dc9-…`) and a trailing semicolon ("does not
  exceed $300,000,000;", card `ffe804d5-…`); card `9ca3960a-…` shows the
  companion shape — the figure running INTO an enumeration with the comma
  BEFORE the literal ("not to exceed, in the aggregate $10,000,000 for any
  single Action"), demonstrating why the tokenizer must not treat a
  preceding comma as part of the candidate either — so a candidate ending
  in `,` or `.` followed by non-digit strips the trailing punctuation from
  the TOKEN (tokenizer boundary handling, not value repair) — evidence-pack warning
  #4, pinned by test 2 on literal committed bytes.
- Exactly one surviving `$` literal with STRICT 3-digit grouping
  (`^\d{1,3}(,\d{3})*(\.\d+)?$` after `$`-strip) → RESOLVED. Canonical
  form: strip `$`, strip grouping commas, preserve any decimal as-written
  (`'10000000'`, `'250000'`, `'0.55'`); must round-trip
  `canonicalValueAllowed`'s `NON_NEGATIVE_DECIMAL_STRING` regex;
  `currency: 'USD'`.
- Malformed grouping → ABSTAIN `MALFORMED_GROUPING` (no repair).
- `€`/`£` → ABSTAIN `NON_USD_CURRENCY` (no FX, ever) → review.
- Two or more surviving money literals → ABSTAIN `MULTIPLE_MONEY_LITERALS`
  — the family's DOMINANT compound shapes, all corpus-attested: dual
  individual/aggregate baskets ("$250,000 individually or $1,000,000 in
  the aggregate", `cdf1901c-…`), multi-proviso limbs ("$300,000,000" basket
  plus "$50,000,000" guarantee cap, `ffe804d5-…`), scheduled step-ups
  ("$0.55 … increased to … $0.5775", `dd0c39da-…`), repeated salary gates
  (`628f0978-…`). The producer splits into per-basket assertions each
  quoting its own contiguous sub-quote (P1 overlap rule); the parser never
  picks.
- Zero money literals → ABSTAIN `NO_MONEY_LITERAL`.
- Spelled-out money → ABSTAIN `NON_LITERAL_MONEY`.
- NO zero-pattern table: a genuine $0 basket is not corpus-attested;
  "without material liability" is qualifier prose, never an amount.
- `threshold_basis` is NOT decided here — the parser returns
  `matched_text` plus the governing clause window around the literal; the
  resolver corroborates the label against it (section 4).

The parser never computes: on card `f75d5aba-…`, the split sub-limb (i)
sub-quote "in excess of $2,000,000 over the aggregate amount of Capital
Expenditures set forth in the Company's budget" resolves as the literal
`'2000000'` with the budget-relative structure preserved in the quoted
evidence — the "over budget" comparative is legal text for the reviewer,
not an operand. This is resolution on the SPLIT sub-limb only: the full
card carries a second money literal in a separate lettered limb ("(ii) …
in excess of $25,000,000;"), so the parent limb at full width ABSTAINs
`MULTIPLE_MONEY_LITERALS` like the family's other compound shapes — it is
not a single-literal example until split.

## 3. Producer prompt + dispatch

**New prompt module: `ioc-producer-prompt.js`** (own
`IOC_PROMPT_VERSION = 1`, bumped once per slice, never mid-slice). The
capitalisation prompt is NOT edited; its recorded fixtures replay
byte-identically.

**Dispatch: through `producer-prompt-registry.js`, mandatorily.** The
termination-rights spec §3 defines the seam (frozen Map
`section_family → prompt module`; unknown family → NO prompt, no
candidates, fail closed — never a silent capitalisation fallback). This
slice adds one entry: `INTERIM_OPERATING → buildIocProducerPrompt`.
Build-order pin: if the termination-rights slice has landed, this is a
one-entry registry diff; if this slice lands FIRST, it builds the registry
and the `native-extraction-run.js` refactor exactly per that spec's §3
(byte-identical capitalisation replay through the registry, acceptance
test 6 there), then adds its own entry — the seam is built once, to that
spec, whichever family arrives first. A capitalisation-fallback dispatch
is a review-blocking defect, not a shortcut.

**Section-family classifier extension.** The deterministic native-side
classifier gains `INTERIM_OPERATING` classification on section-title
evidence only, ported from and tested against the v1
`lib/parser-v2/classify.js` IOC-T/IOC-B title rules (~117–147) — with the
v1 rule ORDER preserved exactly, because the order is load-bearing:
"interim operations of Parent" (TopBuild §4.2) MUST match before the bare
`interim oper` catch, or the acquirer's covenants stamp TARGET (the
documented QXO/TopBuild trap in classify.js's own comments); the by-phrased
"Conduct of Business BY Parent" variants precede the bare "Conduct of
Business" default. The classifier emits the side —
`INTERIM_OPERATING_TARGET` / `INTERIM_OPERATING_BUYER` — and the run
stamps `covenant_side` from it onto every assertion in the section.
Documented default, pinned with its risk: a bare "Conduct of Business"
title with no party named classifies TARGET (the v1 default; ~all corpus
instances are target-side per classify.js's comment) — a deal that titles
its BUYER covenant bare is a priced misattribution risk carried from v1,
recorded in Known costs, and the classifier is validated against ALL
deals' section titles before the prompt is ever dispatched (the
classify-rules safety check from repo conventions). Own
`SECTION_FAMILY_CLASSIFIER_VERSION` bump, threaded into the run receipt.

**Response shape:** an `ioc_restriction_assertions` array — each element
`{ section_reference, assertion_kind: 'RESTRICTION_PRESENT' |
'THRESHOLD_AMOUNT', restriction_category, threshold_basis (THRESHOLD_AMOUNT
only), verbatim quote }` — plus the standard `open_world_candidates`. One
element per legal fact, and the prompt owns the family's defining split
discipline:

- A lettered limb bundling several categories (card `3a2c477b-…`: charter
  amendment + split + dividend in one limb) is N RESTRICTION_PRESENT
  assertions, each quoting the sub-span carrying its own category's
  operative words.
- A restriction with a basket is TWO assertions (the grant, the amount),
  each with its own single-fact quote; a dual individual/aggregate basket
  is TWO threshold assertions ("$250,000 individually" / "$1,000,000 in
  the aggregate" sub-quotes of `cdf1901c-…`) — so the parser's one-literal
  rule is satisfiable, exactly as the P1 compound-sentence rule.
- Quote the RESTRICTION limb, not the chapeau, for category evidence; but
  never assert side or carve-out scope — side is classifier-stamped, and
  carve-outs stay inside the quote as evidence.
- PRESERVE-THE-NOVEL retained verbatim; when unsure of
  restriction_category or threshold_basis, the assertion stays in
  `open_world_candidates` — promotion narrows novelty, never forces fit.
  The producer never asserts a negative (M3 rule 1): "not restricted",
  "permitted", "no basket" are never emitted.

**Provider (`anthropic-provider.js`):** new generic key
`NATIVE_IOC_RESTRICTION_CANDIDATE`, proposal_kind `IOC_RESTRICTION`
(≠ OPEN_WORLD). `ioc_restriction_assertions` is deliberately NOT added to
`REQUIRED_RESPONSE_LISTS` (the share_count precedent at ~83–89 verbatim:
every recorded pre-existing response fixture predates the key;
missing/non-array reads as empty list, never a schema failure). Quote
byte-verification identical to existing proposals. Golden evals:
recorded-response fixtures are never hand-edited to pretend old runs
emitted the new shape; the new shape enters recordings only via the dated
live-run handoffs.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE resolution-table entry** (P1 M-2: `RESOLUTION_UNCONDITIONAL` is a
  Map keyed on generic_claim_key alone):
  `NATIVE_IOC_RESTRICTION_CANDIDATE`, same unconditional-Map shape as the
  REAL SHARE_COUNT row — `deterministic_kind: null`, `attachment_position:
  null`, `registered_claim_definition_key: null` are shared with
  SHARE_COUNT (the handler makes the definition split on
  `assertion_kind`), but the IOC row deliberately DIVERGES from
  SHARE_COUNT by also nulling `concept_key` (with the build-time check
  that nothing reads `mapping.concept_key` before the handler's category
  map runs), `party_field`, and `party_role` — SHARE_COUNT's real row
  carries `concept_key: QUALIFIER_CONCEPT_KEY` (REP-T-CAP),
  `party_field: 'party_making'`, `party_role: 'REPRESENTATION_MAKER'`,
  none of which apply here because the handler owns the concept split and
  no party is minted this slice (pinned so an implementer doesn't
  improvise one). The concept split is made in the
  handler on `attributes.restriction_category` via a frozen map:
  `MERGE→IOC-MERGE, CONTRACT→IOC-CONTRACT, COMP→IOC-COMP, DEBT→IOC-DEBT,
  TAX→IOC-TAX, CHARTER→IOC-CHARTER, ISSUE→IOC-ISSUE,
  ACCOUNTING→IOC-ACCOUNTING, SETTLE→IOC-SETTLE, DIVIDEND→IOC-DIVIDEND,
  CAPEX→IOC-CAPEX`. Out-of-enum → explicit `pushOpenWorld`, typed reason.
  `MAPPING_TABLE_VERSION` bumps by one from head at build; the
  table-validation test still asserts no duplicate generic keys.
- **restriction_category corroboration table** (frozen resolver constant;
  labels must match quote text — the family's own `da8a7a2f-…` defect is
  the proof). Patterns word-bounded, case as shown, every one grounded in
  a cited committed quote:
  - `CAPEX` ↔ /\bcapital expenditures?\b/i (`cdf1901c-…`, `f75d5aba-…`,
    `9a96d6ae-…`)
  - `DEBT` ↔ /\bindebtedness\b/i ∪ /\bdebt securities\b/i (`e92c390b-…`,
    `affcafb2-…`, `0b0aa5a1-…`)
  - `DIVIDEND` ↔ /\bdividends?\b/i ∪ /declare, set aside/i (`1f0fb14e-…`,
    `4171dec5-…`, `dd0c39da-…`)
  - `SETTLE` ↔ /\b(settle|compromise)\b/i AND /\bActions?\b/
    (case-sensitive defined term) — the AND-pair (TERMR VOTE precedent)
    is what separates litigation settlement from tax settlement: card
    `37b76c19-…` settles "claim by a Government Entity for Taxes" with no
    "Action" and must NOT corroborate SETTLE (`45fea063-…`, `9ca3960a-…`,
    `a99c303b-…` all carry "Action")
  - `COMP` ↔ /\bcompensation\b/i ∪ /\bBenefit Plan\b/ ∪ /\bEmployee Plan\b/
    (defined terms case-sensitive; `01ccb717-…`, `628f0978-…`,
    `aa09c049-…`)
  - `ISSUE` ↔ /\bissue, (deliver|sell)\b/i ∪ /\bissuance\b/i
    (`00088c48-…`, `d049b109-…`, `cbe720aa-…`)
  - `CHARTER` ↔ /certificate of incorporation|certificate of formation|
    bylaws|governing documents/i (`3a2c477b-…`, `4b9149f4-…`,
    `ab03e623-…`). Bare "charter" DROPPED from the alternation (unlike
    the other four alternates, it is not `\b`-bound in this listing and
    the corpus shows it firing inside 4 non-CHARTER IOC quotes —
    IOC-DIVIDEND `e99a7b8d-…`, IOC-REPURCHASE `ce4efa11-…`, IOC-COMMIT
    `3b4e5806-…`, and one null-subtype card — pure
    `AMBIGUOUS_CATEGORY_CORROBORATION` noise the other four alternates
    already cover for all three grounding cards without it.
  - `MERGE` ↔ /\bmerge with\b/i ∪ /\bconsolidation with\b/i ∪
    /including by merger/i ∪ /\bbusiness combinations?\b/i ∪
    /acquire a substantial portion of the assets/i ∪
    /transfer, sell, lease/i (`d4a16e7f-…`, `2d51200c-…`, `ffe804d5-…`).
    **Trap, pinned:** never a bare /merger/i or /\bMergers?\b/ — "the
    Mergers", "Merger Subs" and "Merger Consideration" appear inside
    CHARTER quotes (`4b9149f4-…`, `ab03e623-…`) and corpus-wide; a bare
    merger token floods every category with false MERGE ambiguity.
  - `CONTRACT` ↔ /\bMaterial Contract\b/ (case-sensitive; `0d7aeabc-…`,
    `563510fb-…`, `6b78b3a9-…`)
  - `ACCOUNTING` ↔ /accounting (policies|practices|procedures)/i ∪
    /\bGAAP\b/ (case-sensitive acronym; `4cb66862-…`, `8fe0129f-…`)
  - `TAX` ↔ /\bTax elections?\b/ ∪ /election relating to Taxes/ ∪
    /\bTax Returns?\b/ ∪ /method of Tax accounting/ (case-sensitive on the
    defined term "Tax"; `623821e4-…`, `37b76c19-…`)
- **Full-table ambiguity rule (TERMF C-3, applied verbatim — this family's
  quotes are multi-category as the NORM):** the handler runs the FULL
  pattern table over the quote; patterns for ≥2 DISTINCT categories match
  → review, typed `AMBIGUOUS_CATEGORY_CORROBORATION` — UNLESS the
  producer's assertion quotes a narrower sub-quote (verbatim contiguous
  substring, P1 overlap rule) in which exactly one category's patterns
  match; then that single category resolves. Corpus reality check: card
  `3a2c477b-…` (charter+split+dividend limb) matches CHARTER and DIVIDEND
  → ambiguous at full width, resolves per sub-limb; card `affcafb2-…`
  (DEBT) also mentions "issue or sell warrants … debt securities" but
  "issue or sell" does not match the ISSUE comma-forms — pinned as a
  near-miss test. Asserted-category-matches-nothing → review, typed
  `CATEGORY_UNCORROBORATED`; the `da8a7a2f-…` mislabel (ACCOUNTING label,
  Material-Contract text) fails exactly here and becomes the permanent
  regression fixture.
- **threshold_basis corroboration** (against the parser's `matched_text`
  window): `INDIVIDUAL` ↔ /individually/i ∪ /for any single/i ∪
  /for any individual/i (grounded: "not exceeding $250,000 individually",
  `cdf1901c-…`; "for any single Action", `9ca3960a-…`); `AGGREGATE` ↔
  /in the aggregate/i (grounded: `cdf1901c-…`, `e92c390b-…`, `9ca3960a-…`).
  Label matches neither → review, typed `THRESHOLD_BASIS_UNCORROBORATED`
  (catches per-unit rates and salary gates by construction). BOTH match →
  review, typed `AMBIGUOUS_THRESHOLD_BASIS` — corpus-attested, not
  hypothetical: card `9ca3960a-…` drafts "in the aggregate $10,000,000 for
  any single Action" (both patterns in one window); the parser resolves
  the literal but the basis is a legal reading → Ben. Never resolve either
  side of an ambiguous basis.
- **Handler order** (SHARE_COUNT/TEMPORAL pattern): category corroboration
  (full-table ambiguity rule) → basis checks (THRESHOLD_AMOUNT only) →
  per-assertion_kind branch: RESTRICTION_PRESENT resolves canonical_value
  `true`; THRESHOLD_AMOUNT → `ioc-threshold-parse.js`. Every ABSTAIN
  routes to review with the parser's typed reason; RESOLVED values still
  pass `canonicalValueAllowed` (a parser bug must not bypass the gate).
- **Materiality: NEW tier proposed, flagged for Ben.**
  `{ rank: 65, label: 'INTERIM_OPERATING', concept_key_prefixes:
  ['IOC-'] }` — between CONSIDERATION (60) and CLOSING_CONDITIONS (70);
  the ledger's explicit ordering names termination rights, fees, MAE,
  fiduciary, no-shop, consideration and closing conditions ahead of
  notices and does not name IOC, so a wrong tier here is a Ben call, not
  an implementer default. Rank 65 collides with nothing in the current
  table (verified against ~446–457). Prefix-tier only — no override-map
  entries, no `materialityFor` signature change. **Pre-concept review
  routing (TERMF M-3, applied verbatim):** review items minted BEFORE the
  category map runs (`CATEGORY_UNCORROBORATED`,
  `AMBIGUOUS_CATEGORY_CORROBORATION`, basis reasons, parser ABSTAINs on
  category-less failures) carry conceptFamily `'IOC-PENDING'` — a routing
  token only, never a registered concept, never publishable — so the
  `IOC-` prefix match ranks them 65 instead of UNCLASSIFIED 99.
- **Receipt:** `ioc_threshold_parse_version` and the bumped
  `section_family_classifier_version` thread into `receiptBody`, alongside
  the bumped `mapping_table_version` and the new
  `contract_vocabulary_digest`.
- **Additivity re-pin, honest (P1 M-1 verbatim):** with no IOC input,
  resolution output must be byte-identical EXCEPT `mapping_table_version`,
  `contract_vocabulary_digest` (under the new bundle version), the new
  parser-version field, and the recomputed `resolution_receipt_id`;
  documented in the PR with a field-level diff. Skipping the version bump
  to keep old pins green is the named anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
a reviewed diff; keys MUST be registered concept keys — table-validation
enforces it, which is why the ten new concepts land in the SAME slice)

New family keys and patterns (one-line rationale per entry in the table;
every pattern grounded in a committed, cited quote; the net-spec boundary
pin applies — case-sensitive defined-term regexes carry explicit `\b`
anchors as `BOUNDED_REGEX`, since `LITERAL_PHRASE` is case-insensitive):

- `IOC-CAPEX`: "capital expenditure", "capital expenditures"
  (LITERAL_PHRASE; `cdf1901c-…`), /\bCapital Budget\b/ (BOUNDED_REGEX,
  case-sensitive defined term; `9a96d6ae-…`).
- `IOC-DEBT`: "indebtedness for borrowed money" (`affcafb2-…`),
  "incur, assume, endorse, guarantee" (`e92c390b-…`), /\bIndebtedness\b/
  (BOUNDED_REGEX, case-sensitive; `e92c390b-…`, `0b0aa5a1-…`).
- `IOC-DIVIDEND`: "declare, set aside" (verbatim in `1f0fb14e-…`,
  `4171dec5-…`, `3a2c477b-…`), "dividend or other distribution"
  (`1f0fb14e-…`), "pay any dividend" (`dd0c39da-…`).
- `IOC-SETTLE`: "compromise or settle" (`9ca3960a-…`),
  "settle, release, waive or compromise" (`45fea063-…`),
  "waive, release, settle or compromise" (`a99c303b-…`).
- `IOC-COMP`: /\bBenefit Plan\b/, /\bEmployee Plan\b/ (BOUNDED_REGEX,
  case-sensitive; `01ccb717-…`, `628f0978-…`), "severance"
  (`628f0978-…`), "base salary" (`628f0978-…`, `aa09c049-…`).
- `IOC-ISSUE`: "issue, deliver" (`00088c48-…`, `d049b109-…`),
  "issue, sell, pledge" (`cbe720aa-…`), "rights, warrants or options"
  (`00088c48-…`, `cbe720aa-…`).
- `IOC-CHARTER`: "certificate of incorporation" (`3a2c477b-…`,
  `4b9149f4-…`), "certificate of formation" (`ab03e623-…`), "bylaws"
  (`3a2c477b-…`), "governing documents" (`3a2c477b-…`).
- `IOC-MERGE`: "merge with" (`d4a16e7f-…`), "consolidation with"
  (`d4a16e7f-…`), "including by merger" (`2d51200c-…`),
  "business combination" (`2d51200c-…`), "transfer, sell, lease"
  (`ffe804d5-…`). **Never** the v1 taxonomy fallback label (the lint
  fingerprint — see the pin in Corpus grounding), and **never** bare
  "merger"/"acquire" (see exclusions).
- `IOC-CONTRACT`: /\bMaterial Contract\b/ (BOUNDED_REGEX, case-sensitive;
  `0d7aeabc-…`, `563510fb-…`, `6b78b3a9-…`).
- `IOC-ACCOUNTING`: "accounting policies" (`4cb66862-…`, `8fe0129f-…`),
  "accounting procedures" (`8fe0129f-…`), "GAAP" (LITERAL_ACRONYM,
  case-sensitive; both).
- `IOC-TAX`: /\bTax Returns?\b/, /\bTax election\b/ (BOUNDED_REGEX,
  case-sensitive; `37b76c19-…`), "election relating to Taxes"
  (`623821e4-…`), "method of Tax accounting" (`623821e4-…`).
- `IOC-GENERAL-EXCEPT` (registered, unpromoted): **deliberately
  UNCOVERED this slice** — it mints no claims here, and a lexicon entry
  without a promoted claim shape would be pattern-authoring without a
  consumer. Typed `LEXICON_FAMILY_UNCOVERED`, never silently clean; blocks
  condition 2 for that family only (the ratified same-family reading).
  Priced and recorded (the TERMR-NOSOL-BREACH precedent).

**Priced cross-hit noise, stated (the TERMR M-4 discipline):** IOC
sections bundle every category into one governed section, so
same-section cross-hits are structural: a section whose candidates cover
DIVIDEND but whose charter limb also says "declare, set aside" raises
`LEXICAL_UNMATCHED_SIGNALS` for IOC-DIVIDEND only if no DIVIDEND candidate
covers that limb — which is exactly the missed-proposition veto working as
designed. Test 7 pins one expected unmatched-signal case (a committed
section fixture with a deliberately withheld category's candidate) so a
future silent lexicon deletion breaks a test. If live-run queue data shows
flooding, narrowing is a reviewed lexicon diff, never a silent deletion
(deletion asymmetry).

**Priced exclusions** (each a recorded blind spot; veto-only design means
a miss costs a missed VETO, never a wrong claim):

- "ordinary course" / "consistent with past practice": present in
  essentially every limb of every category (chapeau and carve-out
  boilerplate) — zero per-category discrimination, guaranteed noise flood.
- Bare "merger"/"Merger"/"acquire"/"acquisition": "the Mergers"/"Merger
  Sub"/"Merger Consideration" appear inside CHARTER quotes (`4b9149f4-…`)
  and corpus-wide; "otherwise acquire" appears in DIVIDEND redemption
  drafting (`dd0c39da-…`).
- Bare "Contract"/"contract": only the defined term /\bMaterial Contract\b/
  discriminates.
- Bare "consent" / "prior written consent": preamble boilerplate in every
  deal's chapeau (`508890ee-…`) — and consent standards are out of scope
  besides.
- Bare "Taxes"/"Tax": fires in efforts covenants, reps and definitions
  corpus-wide; only the election/return/method phrases are patterns.
- Bare "settle"/"compromise" without the Action pair: tax-settlement and
  insurance prose would flood; the AND-pair lives in the corroboration
  table, and the lexicon carries the longer settle-verbs phrases instead.

## 6. Acceptance tests (real-fixture-first; the P1 M-5 pre-rerun-harness
honesty pins apply VERBATIM — no recorded native runs exist for this
family; every resolver/registry test drives synthetic compiled candidates
pinned to REAL corpus quotes, byte-verified against committed fixture
bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** IOC-section canonical text spanning at least four
   corpus deals, chosen to cover: a dual individual/aggregate capex basket
   (`cdf1901c-…`), an aggregate debt basket (`e92c390b-…`), the ambiguous-
   basis settlement basket (`9ca3960a-…`), the multi-category charter limb
   (`3a2c477b-…`), the per-share step-up dividend cap (`dd0c39da-…`, kept
   as the flagged null-subtype drafting exemplar — see Corpus grounding),
   the mislabelled accounting/contract card (`da8a7a2f-…`), a Material
   Contract limb (`0d7aeabc-…`), the trailing-comma-after-literal dual
   capex basket (`d7f48dc9-…`, deal `6369cc9c-…`: "in excess of $3,000,000
   individually, or $10,000,000, in the aggregate;"), and one buyer-side
   section (deal `dfaa71fa-…` card `ab03e623-…`, a Parent charter
   covenant) for the classifier side split. Committed as LITERAL bytes
   from production
   (typographic quotes, embedded straight quotes in defined terms like
   `("Capital Expenditures")`, trailing `;` and `,` after dollar figures
   included) — never retyped ASCII. Fixture headers carry deal uuid +
   provision_card uuid + retrieval date ONLY — no v1 `section_ref` label
   strings (the lint-fingerprint pin; a fixture whose header reproduces a
   v1 label slot is a review-blocking defect). Every test quote is
   asserted to be a contiguous substring of the committed bytes.
1. **Parser, table-driven:** "$10,000,000," (trailing-comma context from
   card `d7f48dc9-…`: "…individually, or $10,000,000, in the aggregate;")
   → `'10000000'`; "$150,000,000" → `'150000000'`;
   "$2,000,000" → `'2000000'`; the `cdf1901c-…` full limb ($250,000 +
   $1,000,000 + bare "110%") → `MULTIPLE_MONEY_LITERALS` with the
   hand-enumerated split sub-quotes resolving `'250000'` / `'1000000'`
   (each a contiguous substring of the committed parent bytes, P1 overlap
   rule); `ffe804d5-…` ($300,000,000 + $50,000,000) →
   `MULTIPLE_MONEY_LITERALS`; `dd0c39da-…` ($0.55 + $0.5775) →
   `MULTIPLE_MONEY_LITERALS`, and its single-literal "$0.55 per share"
   sub-quote resolves `'0.55'` (decimal preserved) with basis queueing at
   the resolver; `628f0978-…` (three $150,000 gates) →
   `MULTIPLE_MONEY_LITERALS`; bare-numeral immunity asserted on real
   bytes ("fifteen percent (15%)", "110%", "2 days", section refs, limb
   letters, "calendar year 2023"); trailing-punctuation tokenizer pin
   ("$300,000,000;" from `ffe804d5-…` and "$10,000,000," from
   `d7f48dc9-…` both resolve clean); zero literals →
   `NO_MONEY_LITERAL`; `NON_USD_CURRENCY`, `MALFORMED_GROUPING`,
   `NON_LITERAL_MONEY` each exercised.
2. **Registry:** next version compiles; prior version arrays untouched
   byte-for-byte; ten new concepts and both definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diff tests; a test asserts the category→concept frozen map's
   eleven values are all registered concept keys.
3. **Resolution (pre-rerun harness):** synthetic candidates over committed
   bytes resolve end-to-end: correct concept per category; the
   `da8a7a2f-…` mislabel (ACCOUNTING label, Material-Contract text) →
   `CATEGORY_UNCORROBORATED` review (the corpus defect as a permanent
   regression test); the `3a2c477b-…` full limb labelled CHARTER →
   `AMBIGUOUS_CATEGORY_CORROBORATION` (DIVIDEND patterns also match), and
   its narrowed charter sub-quote resolves IOC-CHARTER; the `affcafb2-…`
   near-miss ("issue or sell" does NOT match the ISSUE comma-forms) →
   resolves DEBT unambiguously; basis: `cdf1901c-…` splits corroborate
   INDIVIDUAL/AGGREGATE respectively, the `9ca3960a-…` dual-pattern window
   ("in the aggregate … for any single Action") →
   `AMBIGUOUS_THRESHOLD_BASIS`, "$17,000 per restaurant"
   (`e14cabe0-…`) → `THRESHOLD_BASIS_UNCORROBORATED`; out-of-enum
   restriction_category exercises explicit `pushOpenWorld`; materiality
   rank 65 asserted BOTH on a resolved claim AND on a pre-concept review
   item carrying conceptFamily `'IOC-PENDING'`; every ABSTAIN class routes
   to review with its typed reason; additivity re-pin with documented
   field-level diff.
4. **Identity:** two same-section restrictions differing only in
   restriction_category mint distinct stable identities; an INDIVIDUAL and
   an AGGREGATE threshold from the same limb never collide or dedupe; a
   TARGET-side and BUYER-side claim under the same concept never collide
   (covenant_side in identity); re-run is byte-stable.
5. **Provider + dispatch:** response missing `ioc_restriction_assertions`
   → empty list, not schema failure; recorded capitalisation replays
   byte-identical through the registry with the IOC entry present; unknown
   section family → no prompt dispatched, no candidates, typed record;
   section-family classifier: v1 IOC-T fixture titles classify
   `INTERIM_OPERATING_TARGET`, the TopBuild-trap title "Interim Operations
   of Parent" and the by-phrased "Conduct of Business by Parent" forms
   classify `INTERIM_OPERATING_BUYER` (rule-order regression), REP-article
   guards hold; `covenant_side` stamps through to claim attributes.
   Separately, and NOT part of the committed test suite: the classifier is
   validated against ALL deals' section titles as a **review-time script**
   run against live corpus data before the prompt is ever dispatched (the
   NOSOL solicitation-check precedent, `classify.js` comment) — it
   requires live Supabase access and must not be stubbed into fixtures or
   promoted into `npm test`.
6. **Lexicon:** table validation (keys registered — including the ten new
   concepts; explicit `\b` on every case-sensitive defined-term regex;
   static max ≤ 128; rationale per pattern; content hash re-pinned);
   anti-noise regression paragraph extended with "in the ordinary course
   of business consistent with past practice", "prior written consent",
   "the Mergers", "Merger Consideration", "otherwise acquire", "represents
   and warrants" — asserted zero hits under the exclusions; each surviving
   pattern hits its own grounding quote in the committed fixtures; one
   expected unmatched-signal fixture (withheld-candidate section) pinned;
   `IOC-GENERAL-EXCEPT` asserted `LEXICON_FAMILY_UNCOVERED`; determinism
   permutation tests green under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (the merge-label
   fingerprint stays clean by construction — no new exemption entries;
   any collision is fixed by restructuring the offending file, never by
   widening FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's
   files.

## Out of scope

- The 169 null-subtype cards and the `[PROPOSED] Unclassified` label slot
  — v1 ingest-QA hygiene, flagged to that lane, never absorbed here.
- IOC-COMMIT (structure + an unadjudicated loans/investments concept —
  see Registry), the preamble codes, IOC-ORDINARY, the affirmative-
  obligation codes (OTHER-AFFIRMATIVE, MAINTAIN, PRESERVE, EXISTENCE,
  INSURANCE), the long-tail negative codes (IP, AFFILIATE, REPURCHASE,
  SPLIT, REALPROP, HIRE, LIEN, NOACTION, WAIVE, NEWLINE) and the pharma
  codes (CLINICAL, PRODUCT, REGAUTH) — open world until adjudicated.
- Consent standards and efforts standards (qualifier-track; P2 seam),
  ordinary-course / required-by-law / pandemic carve-outs and permitted-
  exception structures (`IOC-GENERAL-EXCEPT` stays unpromoted), schedule
  references, materiality qualifiers.
- Percentages, budget-relative tolerances (110%), leverage ratios
  (4.50x), day counts and notice windows, salary-tier gates, per-unit
  rates — all named with their grounding in section 1; open world.
- Cross-referenced threshold resolution (the 83% cross-reference kind) —
  relationship machinery (`CONTAINED_IN`/`EXCEPTED_BY`), not quote-local
  production.
- The `ioc_positive_obligations` / `ioc_negative_obligations` tables (0
  rows; coarser enums) — untouched; any future use is a separate
  Ben-reviewed mapping.
- v1 machinery: `stampIocRestrictionComponents`,
  `normalizeIocLimbEffortsStandards`, `IOC_CATEGORY_CODES`,
  `restrictionComponents` — the v1 parser's deterministic post-passes stay
  exactly as they are; this slice neither reuses nor edits them.
- `FAMILY_MAPPING_TABLE` extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit with the wiring slice — the IOC-T/IOC-B side trap,
  the COMMIT split and the GENERAL-EXCEPT spelling mismatch make this
  table Ben-reviewed, never implementer-inferred).
- Party tuples for the restricted party; cross-deal canonicalization of
  any verbatim phrase; the live re-extraction runs (each its own dated
  handoff; until they land, NO report may claim native IOC extraction —
  M-5); any amendment to M3 protocol semantics; any scope-closure/ABSENT
  work; derivation of `IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE`
  (serving-side arithmetic, existing policy).

## Known costs, stated up front

- **Multi-category limbs are the family's dominant drafting**, so
  `AMBIGUOUS_CATEGORY_CORROBORATION` review volume will be material until
  producers reliably quote single-category sub-spans. Named cost of
  binding label to text (the TERMF multi-trigger precedent) — never a
  reason to loosen the full-table check. The live-run handoffs measure the
  rate.
- **~83% cross-reference kind means threshold recall is structurally
  partial this slice**: baskets living in referenced sub-clauses (the
  IOC-COMMIT catch-all shape) are invisible to quote-local production.
  The remedy is the relationship layer, never a prompt instruction to
  paraphrase referenced text.
- Dual-basket, step-up, and multi-proviso limbs all ABSTAIN until the
  producer splits them; a producer that fails to split costs a queue item,
  never a wrong number. Per-unit rates and salary gates queue on basis by
  construction — a handful of short Ben confirmations, priced against the
  interpretation-creep alternative.
- The bare-"Conduct of Business"-defaults-TARGET classifier rule is a
  carried v1 risk: a deal titling its buyer covenant bare would stamp
  `covenant_side: TARGET`. Mitigated by the all-titles validation run and
  the corpus observation (classify.js's own comment) that ~all bare
  instances are target-side; any observed exception is a classifier diff
  with its own version bump, not a producer patch.
- Ten new concepts in one slice is the largest single Ben concept flag of
  the family track — deliberately batched (each backed by ≥31 deals) so
  the taxonomy decision is made once over the family's real shape rather
  than dribbled across slices. If Ben trims the list, the frozen category
  map and lexicon shrink with it mechanically; nothing else changes.
- Case-sensitive defined-term patterns (Material Contract, Tax Returns,
  Benefit Plan, Indebtedness) miss lower-case drafting variants; priced —
  the case-insensitive companion phrases cover most shapes, and a miss
  costs a missed veto, never a wrong claim.
- `IOC-GENERAL-EXCEPT` stays lexicon-uncovered and condition-2-blocked
  until it is promoted with real claim shapes — honest shape of the work.
