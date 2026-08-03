# Family — Dividends & pre-closing distributions (DIVD-*)

**Date:** 2026-08-03. **Status:** AUDIT-AMENDED — adversarial audit
applied (1 CRITICAL, 4 MATERIAL, 3 MINOR fixed; 0 parked for Fable) per
program convention (spec-detail → audit → build → review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins).
**Wave exemplars bound:** `2026-08-02-family-termination-rights-design.md`
(the producer-prompt-registry seam — this family dispatches through it,
NEVER a capitalisation fallback; the seam is BUILT at head:
`lib/canonical-v2/native-producer/producer-prompt-registry.js` carries
CAPITALISATION and TERMINATION_FEE entries, so this slice adds ONE entry to
the existing frozen Map, it does not build the seam);
`2026-08-02-family-termination-fee-design.md` (money-parser discipline
INHERITED WHOLE — currency-prefixed-literal tokenizer, strict grouping,
the F-1 hybrid-magnitude and F-2 digit-run build-review pins, full-table
ambiguity corroboration, pre-concept review routing);
`2026-08-02-family-closing-conditions-design.md` (presence-claim shape;
"no parser is a ruled decision"; pinned co-resolution pairs; the M3-rule-1
ruling that modifiers stay inside the quote as evidence);
`2026-08-02-family-consideration-design.md` (this family's most important
boundary neighbour — exchange-fund mechanics, anti-dilution adjustment and
dividend equivalence are all its territory, cited never claimed);
`2026-08-02-family-ioc-design.md` (the OTHER critical neighbour:
IOC-DIVIDEND owns the negative restriction limb; this spec's polarity gate
exists because the two families share their entire surface vocabulary);
`2026-08-02-family-specific-performance-remedies-design.md` (the REM-CAP
vacuity ruling — applied here to the coordination day-count window: a
claim whose grounded quotes ALL abstain under the spec's own parser rules
is vacuous by design and must not ship);
`2026-08-02-family-financing-covenants-design.md` (the
`runStage1(title, article_context)` classifier signature and the
exact-keys materiality tier — both adopted).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Lexicon authority:** `2026-08-02-lexical-disagreement-net-design.md`
(word boundaries, case-sensitive defined terms, deletion asymmetry, priced
blind spots; static max ≤ 128; explicit `\b` on every case-sensitive
defined-term regex; `LEXICAL_FAMILY_LEXICON_VERSION` is 2 at head).
**Materiality:** no tier covers this family today (`MATERIALITY_TABLE`,
`candidate-resolution.js` ~523–534, carries no dividend prefix — a
resolved dividend claim would rank UNCLASSIFIED 99, below notices).
Section 4 proposes ONE exact-keys tier, flagged for Ben.

## Corpus grounding — population honesty first

**This family's grounding set is 7 COV-DIVIDEND cards + 1 mislabeled
affirmative card, across 8 deals, covering THREE functionally distinct
drafting patterns that the two shipping concepts model, plus one
unmodeled fourth pattern (audit CRITICAL-1). Two concepts ship, grounded
in the 7 cards under the single v1 subtype `COV-DIVIDEND`. The eighth
card — `0906ff1d-2c22-443e-96c3-556ae4b42600` (deal
`0a043659-68fb-4d20-98e6-b926aa758799`, §7.19 "Dividend Matters",
v1-labeled COVENANT_OTHER/subtype NULL/short_title "Unclassified") — is a
real, in-document dividend-titled affirmative covenant (a mandated
recurring per-share quarterly dividend plus a catch-up mechanic) that
v1's card-label population undercounted, because it was never filed as
COV-DIVIDEND; receipt 1's card-label query could not see it. It is
committed to the coverage map (test 0) with a hand-enumerated expected
outcome of open-world / `DIVIDEND_KIND_UNCORROBORATED` (test 3) — it is
not claimed by either shipping concept. Nothing else has a grounding
set.** This is deliberately not an "8–12 subtypes" spec; a two-concept
spec grounded in real cards beats a six-concept speculation, and the
audit should treat any padding it finds as a defect.

Evidence pack read 2026-08-02 (pack quotes are ground truth, cited by
provision_card id); six supplementary SELECT-only queries run 2026-08-03
by this spec's author against production Supabase (project
`tzulhdasmioeechxapdy`, `provision_cards`), receipts inline below.

The seven grounding cards, by functional pattern (plus the eighth,
mislabeled, non-grounding card — audit CRITICAL-1):

- **Quarterly-dividend coordination mechanic — 4 cards / 4 deals** (the
  family's only well-grounded pattern):
  - Card `3336d56b-292f-452a-9c48-af1285c80d11` (deal `a267309a…`,
    §6.21): "Parent and the Company shall each coordinate their record
    and payment dates for their regular quarterly dividends to ensure
    that the holders of Company Common Stock shall not receive two (2)
    dividends, or fail to receive one (1) dividend, in any quarter…" plus
    a one-sided declaration/record-date window ("no later than five (5)
    Business Days following the one (1) year anniversary of such dates
    for the corresponding quarter of the preceding year") and a
    closing-quarter proviso.
  - Card `9edec4a0-a947-4257-b732-42d469352843` (deal `c750afb9…`,
    §5.14 — Starwood/Marriott): coordination drafted as a per-quarter
    payment allocation — "(a) with respect to the calendar quarter
    immediately preceding … (b) with respect to the calendar quarter in
    which the Closing Date occurs, (i) Starwood does not declare or pay a
    regular quarterly dividend with respect to such quarter, and (ii) the
    stockholders of Marriott … receive a regular quarterly dividend from
    Marriott…" — same opening operative phrase, "shall each coordinate
    their record and payment dates".
  - Card `9d990944-08d9-430d-b70c-417898c37a18` (deal `cf32899a…`,
    §6.15): the conditional variant — "If Parent has resumed its
    quarterly dividend (and provided that Parent has provided prior
    written notice…)…" — and the ASYMMETRIC two-bound window ("(x) no
    later than five Business Days following and (y) no earlier than two
    Business Days preceding … the one year anniversary"; pack warning 4).
  - Card `c65d116a-c1f0-42c8-9d5b-849d6ddd69df` (deal `dc042001…`,
    §7.11): the §6.21 drafting nearly verbatim ("…in exchange therefor
    in the Combination"), one-sided window.
- **One-time pre-closing special dividend — 2 cards / 2 deals:**
  - Card `13bda3e5-efb2-411d-af33-f797b2b57f36` (deal `8cd0787f…`,
    §5.4): "Prior to the Maverick Effective Time, Maverick may declare a
    dividend (the \"Pre-Closing Dividend\") to the holders of Maverick
    Common Stock consisting of $2.00 per share in cash per share of
    Maverick Common Stock, with a record date (which shall be no later
    than one Business Day prior to the Maverick Effective Time)…" —
    permissive ("may declare").
  - Card `b4f19d27-b19d-4bbe-b8a7-4a3931663b6e` (deal `c7c16365…`,
    §6.15 — Kraft): "Prior to the Closing, Kraft shall declare in
    accordance with applicable Law a special cash dividend (the \"Special
    Dividend\") in an amount per share of Kraft Common Stock equal to
    $16.50 (the \"Special Dividend Per Share Amount\"), to holders of
    record … as of a record date immediately prior to the Closing." —
    mandatory ("shall declare").
- **REIT distribution permission — 1 card / 1 deal:** card
  `b67f22f5-4b12-438b-be51-aef32e5e58e7` (deal `dfaa71fa…`, §5.10 — the
  REIT deal): status-maintenance distributions citing "Sections 857 or
  4981 of the Code", zero MONEY literals (it does carry bare numerals —
  "Sections 857 or 4981", "5.1(c)"), plus a second sentence on
  declared-but-unpaid straddle distributions being "paid to the holders …
  on the Closing Date immediately prior to the Company Merger Effective
  Time". P4 boundary; not claimed (boundary 3).
- **Mislabeled affirmative dividend covenant — 1 card / 1 deal, NOT part
  of either shipping concept's grounding set (audit CRITICAL-1):** card
  `0906ff1d-2c22-443e-96c3-556ae4b42600` (deal `0a043659…`, §7.19
  "Dividend Matters"): "The Company shall, in each calendar quarter…,
  declare and pay a dividend in respect of each…Share of Class A Company
  Common Stock in a per-share amount equal to $0.06 per Share… (each, a
  \"Quarterly Dividend\")… the Company shall pay… a dividend (any such
  dividend, a \"Catch-Up Dividend\")…" — a MANDATED recurring per-share
  dividend with two inline defined terms, a catch-up mechanic, and a
  record-date window. Filed v1-side as COVENANT_OTHER/subtype
  NULL/short_title "Unclassified" rather than COV-DIVIDEND, which is why
  receipt 1's card-label query missed it even though the section IS
  dividend-titled in the real document. It dispatches under this slice's
  own bare `/\bdividends?\b/i` stage-1 rule (a covenants article, no
  declining article_context) and corroborates neither DIVD-COORD nor
  DIVD-SPECIAL's patterns ("shall, in each calendar quarter…, declare"
  has no "shall declare" bigram; no coordination phrase present), so it
  lands in permanent review as `DIVIDEND_KIND_UNCORROBORATED` /
  open-world on every pass by construction — never resolving, never
  publishing wrong, but an unmodeled fourth drafting pattern (recurring
  mandated, not one-time). Committed to the coverage map (test 0) with
  that hand-enumerated expected outcome (test 3). FLAGGED FOR BEN
  alongside DIVD-SPECIAL's low-N call in section 1 — this pattern bears
  directly on that ruling.

All 7 rows: `kind = 'cross-reference'`, `party_scope = 'MUTUAL'`,
`short_title = "Coordination of Dividends"` regardless of content (pack
warning 1 — the DB label collapses three patterns under one string), and
`defined_term`/`defined_value` NULL on every row despite explicit inline
parenthetical defined terms in two quotes (pack warning 5).

**Query receipts (SELECT-only, `provision_cards`, run 2026-08-03):**

1. **Dividend-titled cards corpus-wide** (`short_title` or `section_ref`
   ILIKE '%dividend%'): IOC-DIVIDEND 39/31, COV-DIVIDEND 7/7,
   CONSID-EXCHANGE 1/1 — nothing else. The one CONSID-EXCHANGE row is
   card `1000229f-ca2b-4f35-a963-72c890b63db2` (deal `86a01770…`, §2.13
   "No Dividends or Distributions"): "No dividends or other distributions
   with respect to the capital stock of the Surviving Corporation … with
   a record date on or after the Effective Time will be paid to the
   holder of any unsurrendered Certificates…" — exchange-fund mechanics,
   the classifier's grounded title-exclusion case (§3).
2. **"coordinate their record and payment dates"**: 4 cards / 4 deals,
   ALL COV-DIVIDEND — the four coordination cards exactly, zero
   cross-family noise. The cleanest single-phrase discriminator in any
   wave family.
3. **"Special Dividend" (case-sensitive)**: 13 cards, ALL in the Kraft
   deal `c7c16365…` — 1 COV-DIVIDEND (the grounding card) + 12 echoes
   across DEF-GENERAL (4), CONSID-EXCHANGE, CONSID-CONVERT,
   COVENANT_INTERIM_OPERATING/NULL, COV-EMPLOYEE, REP-T-FAIRNESS,
   MISC (2), DEFINITION/CONSID-EXCHANGE (corrected count — audit
   MINOR-1). The defined term propagates
   through the deal's consideration and definition machinery — the
   consideration-interplay boundary (boundary 2) and a priced lexicon
   cross-hit (§5).
4. **"Pre-Closing Dividend" (case-sensitive)**: 4 cards, ALL in the
   Maverick deal `8cd0787f…` — 1 COV-DIVIDEND + IOC-SPLIT +
   REP-T-FAIRNESS + card `4b5710b6-821e-4fbf-b9de-371929594a1f`
   (DEF-MERGERCONSID), whose primary_quote opens with the IDENTICAL
   §5.4 bytes ("Prior to the Maverick Effective Time, Maverick may
   declare a dividend (the \"Pre-Closing Dividend\")…") — the same text
   double-filed under a merger-consideration definition subtype. A v1
   duplicate-classification defect, flagged to ingest-QA (Grounding
   correction 3), and live proof that the special dividend enters the
   deal's consideration definition context (boundary 2).
5. **"dividend equivalent"**: 12 cards / spread across CONSID-EQUITY
   (4/4), IOC-DIVIDEND (2/1), REP/NULL (2/1), REP-T-CAP, DEF-EQUITYAWARD,
   IOC-ISSUE, DEF-GENERAL — equity-award/consideration territory
   throughout, zero COV-DIVIDEND hits. Grounds the classifier exclusion
   and lexicon exclusion (boundary 4).
6. **Serving vocabulary check** (repo, not DB):
   `TARGET_PAID_DIVIDEND_PER_SHARE` is a registered ConsiderationPackage
   `component_type` and `TARGET_PAID_DIVIDEND` a SourceDealFactOccurrence
   `value_type` in `lib/canonical-v2/shared-authority-contract-input-
   validator.js` (~1426, 1449, 1508), with the pinned contract flag
   `target_paid_dividend_automatically_added_to_offer_price: false`. The
   serving layer already models a target-paid dividend as a
   consideration-package component under the deal-identity spec
   (`2026-07-24-qxo-deal-identity-serving-dimensions-design.md`). This
   slice's covenant-side claims feed that layer; they never restate it
   (boundary 2).

## Grounding corrections (verified against repo + production DB,
2026-08-03)

1. **No registered v2 vocabulary exists for this family.** Verified: no
   `DIVD-` or dividend-shaped concept key anywhere in
   `lib/canonical-v2/` outside the serving-layer component vocabulary
   named in receipt 6 (which is consideration-package machinery, not a
   claim concept). Both concepts below are new and FLAGGED FOR BEN (the
   2026-07-23 convention: this spec proposes, Ben settles).
2. **No `FEATURES['COV-DIVIDEND']` entry exists in v1** — extraction
   falls back to the generic `FEATURES['COV']` type-level set
   (`lib/rubric.js` fallback ~5320–5357), so v1 carries NO structured
   dividend fields at all: no per-share amount, no coordination flag,
   nothing to map or compare against. The v1↔v2 comparator has only
   card-level presence to disagree with in this family; stated so nobody
   claims a field-level comparator surface that cannot exist.
3. **v1 defect flags for ingest-QA, never absorbed here:** (a) the
   `4b5710b6…` duplicate — §5.4's exact bytes filed both as COV-DIVIDEND
   and as DEF-MERGERCONSID (receipt 4); (a2) the `0906ff1d…` mislabeling
   — a real dividend-titled affirmative covenant (§7.19 "Dividend
   Matters") filed as COVENANT_OTHER/subtype NULL/short_title
   "Unclassified" rather than COV-DIVIDEND, which is why receipt 1's
   card-label population query could not see it (audit CRITICAL-1); (b)
   `defined_term`/`defined_value`
   NULL on all 7 rows despite parenthetical defined terms in the quote
   text (pack warning 5) — which is why `dividend_term_ref` below is
   parsed from `primary_quote` bytes and never read from those columns;
   (c) the uniform `short_title` collapsing three patterns (pack
   warning 1) — v1 labels are UNTRUSTED input throughout this spec.
4. **The family brief's "quarterly caps — numeric per-share amounts" has
   ZERO grounding inside this family.** No percentage figure and no
   quarterly dividend cap appears anywhere in the 7-card set (pack §4).
   The corpus's per-share dividend caps live inside interim-operating
   restriction CARVE-OUTS — the `dd0c39da…` per-share step-up cap
   ("$0.55 per share" … "may be increased to … $0.5775") that the IOC
   spec committed as its null-subtype drafting exemplar and whose parse
   ABSTAINs `MULTIPLE_MONEY_LITERALS` under the IOC parser. Ordinary-
   course-dividend caps are IOC-DIVIDEND proviso territory (boundary 1).
   FLAGGED FOR BEN as a family-brief deviation.
5. **Bundle version numbering:** this spec binds to "the next frozen
   version at this slice's merge"; every superset-diff acceptance test is
   written against CONTENT (sorted key sets), never the numeral.

## Cross-family boundaries (BINDING; duplication is an automatic audit
CRITICAL; each pin has a named acceptance test in section 6)

1. **IOC-DIVIDEND — the IOC family's registered concept, opposite
   polarity, identical vocabulary.** "No declaration or payment of
   dividends without consent" (39 cards/31 deals) resolves through the
   IOC slice; its lexicon already carries "declare, set aside",
   "dividend or other distribution", "pay any dividend", and its
   RESTRICTION_PRESENT machinery owns the negative limb AND its
   permitted-dividend carve-outs (including every quarterly/per-share
   cap — Grounding correction 4). This family is the AFFIRMATIVE
   mechanics only: a covenant that authorizes, mandates, or coordinates
   a dividend. The two families share every surface token ("dividend",
   "declare", "record date" — pack warning 8), which is why: (a)
   INTERIM_OPERATING-classified sections never dispatch here (the IOC
   producer owns them); (b) the resolver carries an explicit
   restriction-polarity gate (§4) so restriction text that leaks into a
   dividend assertion can never resolve as an affirmative claim; (c) the
   producer prompt names restriction language as NOT this family's
   assertion. Test 4.
2. **Consideration family — exchange-fund mechanics, anti-dilution
   adjustment, dividend equivalence, and the consideration-adjustment
   interplay. Cited, never redefined.** Four distinct shapes, all
   consideration territory: (a) exchange-fund "No Dividends or
   Distributions" unsurrendered-certificate mechanics (card `1000229f…`,
   receipt 1 — the grounded classifier title-exclusion); (b)
   CONSID-ADJUST anti-dilution (13/13 — "stock dividend" as an
   adjustment TRIGGER for merger-consideration math, `lib/rubric.js`
   ~284); (c) `dividendEquivalence` (v1 CONSID feature ~4052, and
   receipt 5's CONSID-EQUITY population) — the consideration spec
   already routes dividend equivalence to `open_world_candidates`; (d)
   the interplay where a pre-closing dividend enters the consideration
   definition (`4b5710b6…`, receipt 4) or propagates through
   exchange/conversion sections (Kraft, receipt 3), and the serving
   layer's `TARGET_PAID_DIVIDEND_PER_SHARE` package component (receipt
   6); (e) CVR share/no-rights denial headings (audit MATERIAL-3) —
   "No Voting, Dividends or Interest; No Equity or Ownership Interest
   in Parent…" (2 deals, §2.5) — "The CVRs shall not have any voting or
   dividend rights…" is CVR consideration mechanics, not a covenant; the
   classifier declines via the dedicated title exclusion (§3). This
   slice mints the covenant-side fact from covenant-section quote
   bytes; whether and how the dividend adjusts the merger consideration
   is the consideration family's claim surface and the deal-identity
   serving dimensions' derivation — never restated, never re-derived,
   no exchange-mechanics or CVR vocabulary anywhere in this slice's
   modules. Test 4.
3. **REIT required distributions — P4
   (`2026-08-02-openworld-promotion-program.md` §P4, Ben ruled: design
   now).** Card `b67f22f5…` (deal `dfaa71fa…` §5.10) is the corpus's ONE
   REIT distribution-permission card — status-maintenance distributions
   under Code §§857/4981. One deal is not a grounding set (the
   REM-NONRECOURSE precedent), and REIT machinery is P4's brief besides
   (the tax-matters spec's boundary 2 reasoning applies verbatim: REIT
   vocabulary in this corpus is essentially one deal). No REIT pattern,
   concept, or lexicon entry ships here; `b67f22f5…` is recorded as P4's
   candidate grounding card for the distribution-permission shape. The
   §5.10 section title ("Dividends") will dispatch to this producer
   under the bare title rule — by design the producer routes its REIT
   text to `open_world_candidates` (named in the prompt), typed, never
   forced into either registered concept. Test 4.
4. **Dividend equivalents on equity awards — consideration/equity-award
   territory** (receipt 5: CONSID-EQUITY 4/4, zero COV-DIVIDEND hits).
   Classifier declines /dividend equivalent/i titles; no lexicon entry;
   the consideration spec's open-world routing for equity-award
   treatment stands. Test 4.
5. **Final-partial-period / straddle-payment mechanics — one card, open
   world.** The family brief names it; the corpus grounds it exactly
   once (card `b67f22f5…`'s second sentence — declared-but-unpaid
   distributions paid on the Closing Date), inside the REIT card
   (boundary 3). One card is not a grounding set. Open world, recorded
   as the candidate grounding card; FLAGGED FOR BEN as a family-brief
   deviation.

## Deliverable (honest conversion semantics)

Governed, resolvable claims for: (a) the dividend-coordination covenant
as a presence claim; (b) the pre-closing special dividend as a presence
claim plus its per-share cash amount as a parsed numeric claim.

**No recorded native runs exist over dividend sections** — the producer
today extracts capitalisation plus the wave families' committed
harnesses. There are no open-world fixture rows to convert and no
closure_ids to track. The deliverable is the five-layer capability plus a
pre-rerun harness: a COVERAGE MAP over committed corpus-quote fixtures —
the 7 COV-DIVIDEND cards plus the two boundary cards named in test 0,
committed as LITERAL production bytes with provenance headers (deal uuid,
provision_card uuid, retrieval date, provision_type/subtype including the
`1000229f…` CONSID-EXCHANGE home and the `4b5710b6…` DEF-MERGERCONSID
duplicate where true — the TERMF m-2 discipline), each hand-enumerated
with its expected outcome. The P1 audit M-5 honesty pins apply verbatim:
"the pipeline natively extracts dividend covenants" may be claimed ONLY
after dated post-merge live-run handoffs (subscription CLI); until then
the honest claim is "the machinery exists and is proven on committed
fixtures".

**Fixture placement is load-bearing:** all committed fixtures live under
`tests/fixtures/canonical-v2/dividends-live-run/` (the forbidden-patterns
PROSE_CLASS_FINGERPRINTS-exempt directory class). Checked against
`scripts/lint/forbidden-patterns.sh` globalPatterns: this family's
vocabulary ("Pre-Closing Dividend", "Special Dividend", "coordinate their
record and payment dates", "record date", "regular quarterly dividends")
collides with no global or scoped fingerprint; no new exemption entries
are needed, and no spec prose, fixture, or module in this slice may
introduce fingerprinted vocabulary outside the exempt fixture directory.
Per the IOC lint pin, fixture headers carry deal uuid + provision_card
uuid + retrieval date ONLY — never v1 `section_ref` label strings.

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the head version at build time. **Two new
concepts, both FLAGGED FOR BEN in the PR body**, `{concept_key, version}`
shape only. The `DIVD-` prefix is new v2 vocabulary: v1's `COV-DIVIDEND`
is deliberately NOT reproduced as a concept key — the corpus proves the
single code collapses three functionally distinct patterns under one
label (pack warning 1; the COV-TAXMATTERS grab-bag ruling and the IOC
precedent that v1 bucket names are not v2 semantics).

- `DIVD-COORD` — dividend-coordination covenant: the mutual mechanic
  ensuring target holders receive exactly one dividend per quarter
  across the closing (record/payment-date synchronization, per-quarter
  payment allocation, closing-quarter provisos). Grounded 4 cards /
  4 deals (`3336d56b…`, `9edec4a0…`, `9d990944…`, `c65d116a…`), with a
  zero-noise corpus discriminator (receipt 2).
- `DIVD-SPECIAL` — one-time pre-closing special dividend
  authorization/mandate with a per-share cash amount. Grounded 2 cards /
  2 deals (`13bda3e5…`, `b4f19d27…`). **LOW-N, flagged as such: 2 deals
  is the smallest grounding set proposed anywhere in this program**
  (below even TAXM-FIRPTA's 3). It ships anyway, for stated reasons Ben
  can reject: the shape is legally uniform (a declared pre-closing cash
  dividend, a per-share dollar amount, a record date bounded by the
  effective time), the amount is exactly the P1-discipline numeric the
  family brief targets, both quotes carry inline defined terms that make
  the `dividend_term_ref` gate cheap and strong, and the fabrication
  surface is minimal (presence + one parsed literal). If Ben defers it,
  the frozen maps, lexicon and tests shrink mechanically and DIVD-COORD
  stands alone.

NOT added (each a legal ruling, not an omission):

- **A recurring mandated per-share dividend concept** (audit CRITICAL-1).
  One card in one deal (`0906ff1d…`, §7.19 "Dividend Matters" — a
  mandated quarterly per-share dividend plus a catch-up mechanic, two
  inline defined terms). Not added: one deal is not a grounding set, the
  same rule applied to the REIT and straddle boundaries below. FLAGGED
  FOR BEN alongside the DIVD-SPECIAL low-N call immediately below — a
  third deal with an affirmative per-share mandated dividend exists
  (recurring, not one-time), and this design never weighed it until the
  audit surfaced it. It resolves as open-world / `DIVIDEND_KIND_UNCORROBORATED`
  under this slice's own dispatch and corroboration rules as designed
  (committed as coverage-map fixture, test 3); if Ben expands
  DIVD-SPECIAL's low-N tolerance, this pattern should be reconsidered in
  the same review, not decided separately.
- **An ordinary-course/quarterly-dividend-cap concept.** Zero grounding
  in this family; the corpus's caps are IOC carve-outs (Grounding
  correction 4; boundary 1). FLAGGED FOR BEN as a family-brief
  deviation.
- **A REIT-distribution-permission concept** — boundary 3 (P4; one
  deal). FLAGGED FOR BEN per the P4 cross-reference.
- **A final-partial-period/straddle-payment concept** — boundary 5 (one
  card; open world). FLAGGED FOR BEN as a family-brief deviation.
- **A coordination-window day-count claim** (the "five Business Days
  following the one year anniversary" record-date discipline). Ruled out
  as REM-CAP-class vacuity AT DESIGN TIME: all three window-bearing
  quotes (`3336d56b…`, `9d990944…`, `c65d116a…`) are mixed-unit,
  multi-period-literal texts ("five (5) Business Days" alongside
  "one (1) year", plus `9d990944…`'s two-bound asymmetric window — pack
  warning 4), so under the inherited TERMF M-4 precedence rule
  (multiplicity first, any unit) every grounded quote would ABSTAIN
  `MULTIPLE_PERIOD_LITERALS`; a claim 100% of whose grounding abstains
  under its own parser is vacuous and must not ship. The window stays
  inside the DIVD-COORD quote as reviewer evidence. Consequence: **no
  day-count parser exists in this slice** (section 2).
- **`COV-DIVIDEND` as a concept** — the label-collapse ruling above.

**Claim definitions** (three; two presence, one numeric):

```
DIVIDEND_COORDINATION_COVENANT_CLAIM_DEFINITION_V1
  claim_definition_key: 'DIVIDEND_COORDINATION_COVENANT'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

PRE_CLOSING_SPECIAL_DIVIDEND_CLAIM_DEFINITION_V1
  claim_definition_key: 'PRE_CLOSING_SPECIAL_DIVIDEND'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

PRE_CLOSING_SPECIAL_DIVIDEND_PER_SHARE_AMOUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'PRE_CLOSING_SPECIAL_DIVIDEND_PER_SHARE_AMOUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New concepts and
definitions grow the expected-keys rows as sorted supersets
(content-diffed tests; prior rows byte-untouched).

**Design decisions, pinned as legal rulings:**

- **Presence and amount are TWO claims under DIVD-SPECIAL, pinned
  co-resolvable.** Both grounding sentences carry the authorization and
  the amount in one sentence, so both kinds' patterns matching one quote
  is the drafting's ordinary shape — the closing-conditions
  NO_MAE/CONTINUING co-resolution device, adopted via the tax-matters
  TREATMENT_PROTECTION/INTENDED_TREATMENT adaptation. The split earns
  its keep at the failure boundary: when the amount parse ABSTAINs (a
  compound quote, a spelled-out amount, a future formula-priced
  dividend), the presence claim still resolves and only the number
  queues — coverage degrades to a queue item, never to silence and
  never to a wrong number.
- **Declaration modality ("may declare" vs "shall declare") is NOT
  promoted.** It is a real legal distinction (permissive authorization
  vs mandated declaration — pack warning 3), grounded once on each side,
  and exactly the strength-gradation shape the tax-matters spec ruled
  qualifier-track material (P2 seam). It stays inside the quote as
  reviewer evidence; a modality enum on a 2-card set would be fabricated
  structure. Same ruling for `9d990944…`'s conditional gate ("If Parent
  has resumed its quarterly dividend…") on the coordination side —
  condition text stays in the quote.
- **The amount is per-share only, never aggregate.** Both grounded
  amounts are per-share ("$2.00 per share…", "an amount per share …
  equal to $16.50"); no aggregate-dividend dollar exists in the family's
  corpus. The parser enforces the per-share basis (section 2), so an
  aggregate or fund-level dollar can never resolve into this claim —
  and no arithmetic ever converts one into the other.

**Governed attributes (never in keys; participate in claim
identity/closure):**

- Both DIVD-SPECIAL claims: `dividend_term_ref` — REQUIRED verbatim
  defined-term phrase from the quote ("Pre-Closing Dividend",
  "Special Dividend"), enforced as a verbatim substring of the
  byte-verified quote (P1 M-3 discipline); failure → review, typed
  `DIVIDEND_TERM_NOT_IN_QUOTE`; an assertion with no identifiable term
  → review, typed `DIVIDEND_TERM_UNIDENTIFIED`, never resolves. This is
  the TERMF `fee_term_ref` gate transplanted: it is what stops a
  quarterly-coordination dividend, an exchange-fund distribution or any
  stray covenant dollar from publishing as a special dividend. REQUIRED
  is honest on this grounding set — both corpus cards carry the
  parenthetical term; a future termless special dividend queues, and
  relaxing to optional is a typed, Ben-reviewed design change. Parsed
  from quote bytes only — the DB `defined_term` columns are NULL on
  every family row (Grounding correction 3b) and are never read.
- `DIVIDEND_COORDINATION_COVENANT`: no attributes beyond the quote. The
  covenant is mutual in all four grounding cards (matching the uniform
  `party_scope='MUTUAL'`, for once truthfully); party dimensioning would
  add nothing and the quote carries the mechanics.
- No party tuple is minted anywhere in this slice: the special-dividend
  declarer is uniformly the target-side company in both grounding cards,
  and party structure on a 2-card set is fabricated structure (the
  TAXM-FIRPTA ruling). `currency` on the amount claim: fixed `'USD'`,
  stamped by the parser only when the literal is `$`-prefixed, never
  producer-asserted (TERMF rule verbatim).

M3 rule 1 restated for this family, because its neighbours make the
violation easy: the producer NEVER asserts "no dividends may be paid"
(IOC territory AND a negative), never asserts "no coordination clause
exists" (derived ABSENT, scope-closure, forever), and never reads the
exchange-fund sentence "No dividends or other distributions … will be
paid to the holder of any unsurrendered Certificates" (`1000229f…`) as
any dividend claim at all — it is consideration mechanics about
surrender procedure, not a covenant about dividends.

## 2. Value parser: `dividend-per-share-parse.js`

New pure module, `measurement-date-parse.js` /
`termination-fee-parse.js` contract shape: typed `{outcome:'RESOLVED',
canonical_value, matched_text, currency}` or `{outcome:'ABSTAIN',
reason}` — never a throw on prose, never arithmetic, never repair.
`DIVIDEND_PER_SHARE_PARSE_VERSION` threaded into the resolution receipt
(P1 M-6). ONE exported function — this family gets no other parser
(the day-count ruling in section 1 and the closing-conditions "no parser
is a ruled decision" precedent):

**`parsePerShareDividendAmount(quote)`** — the TERMF `parseFeeAmount`
discipline inherited whole, plus one family-specific gate:

- Candidate token: `[$€£]` optionally followed by whitespace, then a
  maximal digit-comma-dot run that must END ON A DIGIT (TERMF F-2 pin —
  a sentence comma after the literal is never swallowed). Bare numerals
  are never candidates — so "one Business Day", "five (5) Business
  Days", "two (2) dividends", "one (1) year", section numbers and dates
  never contaminate the count (every grounded quote contains such
  numerals). Section-reference/date/time exclusions inherited; grammar
  runs against LITERAL committed fixture bytes, never retyped ASCII.
- Precedence, pinned (TERMF M-4 discipline): multiplicity FIRST — two
  or more surviving money literals → ABSTAIN `MULTIPLE_MONEY_LITERALS`
  before any other outcome. **The Kraft quote is the named case:** its
  sentence carries exactly one money literal ($16.50), but the full
  §6.15 card INCLUDING both parenthetical defined terms is
  single-literal too — the multiplicity trap in this family is a future
  two-tranche dividend or an amount restated with an aggregate ("$16.50
  per share (approximately $9.5 billion in the aggregate)") — such a
  quote ABSTAINs and the producer splits to the per-share limb.
- Hybrid magnitude money ("$1.2 billion", "$45 mm") → ABSTAIN
  `HYBRID_MAGNITUDE_MONEY` (TERMF F-1 build-review pin inherited
  verbatim; checked after multiplicity).
- **Per-share basis gate (family-specific):** the quote must contain
  `/\bper share\b/i` — grounded "consisting of $2.00 per share in cash
  per share of Maverick Common Stock" (`13bda3e5…`) and "in an amount
  per share of Kraft Common Stock equal to $16.50" (`b4f19d27…`). This
  is a QUOTE-LEVEL presence check, deliberately not an adjacency check:
  the Kraft drafting puts "per share" BEFORE the literal, so any
  window/adjacency rule would break a grounding card at birth. Absent →
  ABSTAIN `NO_PER_SHARE_BASIS` → review. This gate is what makes an
  aggregate dollar structurally unresolvable as a per-share amount; the
  residual (an aggregate dollar in a sentence that also says "per
  share") is caught by the multiplicity rule when both literals appear,
  and priced in Known costs when it does not.
- Exactly one surviving `$` literal with STRICT 3-digit grouping
  (`^\d{1,3}(,\d{3})*(\.\d+)?$` after `$`-strip) → RESOLVED; canonical
  form: strip `$`, strip grouping commas, preserve the decimal
  as-written (`'2.00'`, `'16.50'` — never normalized to `'2'`; the
  as-written rule is what keeps the canonical value a byte-derivable
  function of the quote); must round-trip `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex; `currency: 'USD'`.
- Malformed grouping → ABSTAIN `MALFORMED_GROUPING` (no repair).
- `€`/`£` prefix → ABSTAIN `NON_USD_CURRENCY` (no FX, ever) → review.
- Zero money literals → ABSTAIN `NO_MONEY_LITERAL` (a coordination
  quote misrouted to the amount kind lands here by construction).
- Spelled-out money → ABSTAIN `NON_LITERAL_MONEY`.
- No zero-pattern table: a genuine $0.00 special dividend is not
  corpus-attested and would be a contradiction in terms; if one ever
  appears it ABSTAINs nowhere special — it resolves as `'0.00'` only if
  literally drafted, which review then sees at rank (section 4).

**No day-count parser and no percentage parser exist in this slice** —
the section-1 vacuity ruling and Grounding correction 4 respectively.
Any future numeric promotion here starts with its own corpus receipt and
its own typed-abstain module, never by widening this one.

## 3. Producer prompt + provider

- **New prompt module**
  `lib/canonical-v2/native-producer/dividends-producer-prompt.js`. The
  capitalisation and termination-fee prompts are NOT edited (their
  PROMPT_VERSIONs do not move; recorded fixtures replay
  byte-identically). New `PROMPT_ID 'native-producer-dividends/v1'`,
  `PROMPT_VERSION 1`, bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`, mandatorily.** The
  seam exists at head (CAPITALISATION + TERMINATION_FEE entries;
  fail-closed nulls; module-private frozen Map). This slice adds ONE
  entry in its own reviewed diff, per the module's own header
  convention: `DIVIDENDS → buildDividendsProducerPrompt`. Unknown
  family → no prompt, no candidates, typed record — never a silent
  capitalisation fallback.
- **Section-family classifier extension**
  (`section-family-classifier.js` — stage-1 rules are added per family
  in that family's reviewed diff; this is that diff for DIVIDENDS).
  Rules authored FRESH from the grounded section titles, using the
  financing-covenants `runStage1(title, article_context)` signature
  (build-order pin, adopted from the tax-matters spec verbatim: if a
  sibling slice extending the signature has landed, the extended
  signature exists; if this slice lands first, it extends the signature
  exactly per the financing spec's §3 and bumps
  `SECTION_FAMILY_CLASSIFIER_VERSION` — the seam amendment is built
  once, to that spec, whichever family arrives first):
  - `/\bcoordination of (quarterly )?dividends\b/i` — "Coordination of
    Quarterly Dividends" (§6.21, §5.14, §6.15, §7.11 in-document
    headings; pack warning 2 says the DB short_title and the real
    headings vary independently — the rules key on real heading shapes,
    both forms covered).
  - `/\b(pre-closing|special) dividend\b/i` — "Pre-Closing Dividend"
    (§5.4), "Special Dividend" (§6.15 Kraft).
  - Bare `/\bdividends?\b/i` — the deal `dfaa71fa…` §5.10 "Dividends"
    heading — with TWO grounded title exclusions, checked first, both
    declining:
    - `/\bno dividends?\b/i` — the exchange-fund heading "No Dividends
      or Distributions" (card `1000229f…`, §2.13 — receipt 1; boundary
      2). The TERMF_TITLE_PATTERN exclusion device, one pattern, one
      place.
    - `/\bno voting,? dividends\b/i` — the CVR share/no-rights denial
      heading "No Voting, Dividends or Interest; No Equity or Ownership
      Interest in Parent…" (2 deals, §2.5 CVR sections — "The CVRs
      shall not have any voting or dividend rights…"; audit MATERIAL-3).
      This heading matches bare `/\bdividends?\b/i` and is NOT caught by
      the "No Dividends or Distributions" exclusion above ("No Voting,
      Dividends" ≠ "No Dividends"), nor by `/dividend equivalent/i`; the
      resolver-side polarity gate also misses it (no declare/pay/set-
      aside token within 60 chars; "payable" does not match `\bpay\b`).
      A dedicated title exclusion is the only reliable stop. CVR
      consideration territory (boundary 2).
    - `/dividend equivalent/i` — equity-award treatment headings
      (receipt 5; boundary 4).
  - **Declines, pinned:** `article_context` of CONDITIONS,
    REPRESENTATIONS, or DEFINITIONS → decline ALL rules (the
    `4b5710b6…` DEF duplicate and the REP-T-FAIRNESS/DEF-GENERAL echo
    populations from receipts 3–4 must never dispatch here);
    INTERIM_OPERATING article_context → decline ALL rules (boundary 1 —
    conduct-of-business sections belong to the IOC producer, and every
    grounded card in this family lives OUTSIDE the interim-operating
    section: §5.4/§6.21/§5.14/§6.15/§6.15/§7.11 are standalone covenant
    sections). Vacuity check applied at design time (REM-CAP): all six
    reachable grounding cards' real headings match a rule under a
    non-declining context; the seventh (`b67f22f5…` §5.10 "Dividends")
    also dispatches, and its REIT content is open-world by prompt
    instruction (boundary 3) — reachable, never forced.
  - Stage 1 is validated against ALL deals' section titles before the
    prompt is ever dispatched (the repo classify-rules safety check) as
    a review-time script against live corpus data — never stubbed into
    fixtures or promoted into `npm test` (the IOC test-5 discipline).
    The known collision surface to verify is the REAL one: "No
    Dividends or Distributions" exchange sections, "No Voting, Dividends
    or Interest" CVR share/no-rights denial sections (audit
    MATERIAL-3), "Dividend Matters"-shaped affirmative-covenant sections
    that correctly DISPATCH and land in review rather than being
    excluded (audit CRITICAL-1), "Dividend Equivalents"-shaped
    equity-award headings, and any conduct-of-business sub-heading
    carrying "Dividends" inside interim-operating articles.
  - Stage 2 (AI-assisted) applies unchanged with
    `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
    `SECTION_FAMILY_AI_UNVERIFIED` auto-pass block.
- **Response shape:** a `dividend_assertions` array — each element
  `{ section_reference, assertion_kind: 'COORDINATION' |
  'SPECIAL_DIVIDEND_DECLARED' | 'SPECIAL_DIVIDEND_AMOUNT', verbatim
  quote }` plus per-kind fields: both SPECIAL kinds carry
  `dividend_term` (verbatim defined-term phrase). One element per legal
  fact, split discipline pinned in the prompt:
  - A special-dividend sentence grounds TWO assertions —
    SPECIAL_DIVIDEND_DECLARED and SPECIAL_DIVIDEND_AMOUNT — whose
    quotes may overlap on the shared sentence (the pinned co-resolution
    pair; both `13bda3e5…` and `b4f19d27…` are this shape).
  - A coordination section is ONE COORDINATION assertion; its window
    provisos, closing-quarter provisos and conditional gates stay
    inside the quote — they are never separate assertions and never
    numeric claims (the section-1 vacuity ruling).
  - A future multi-amount dividend quote (two tranches, per-share plus
    aggregate restatement) is SPLIT so each amount assertion quotes its
    own limb; unsplit it ABSTAINs `MULTIPLE_MONEY_LITERALS` by design.
  - PRESERVE-THE-NOVEL retained verbatim; named in the prompt as NOT
    this family's assertions: dividend/distribution RESTRICTIONS and
    their permitted-dividend carve-outs (IOC — boundary 1),
    exchange-fund/unsurrendered-share mechanics and anti-dilution
    adjustments (consideration — boundary 2), CVR share/no-dividend-
    rights denials (consideration — boundary 2; audit MATERIAL-3), REIT
    status-maintenance
    distributions and straddle-payment mechanics (open world —
    boundaries 3, 5), dividend equivalents on equity awards (boundary
    4). Open-world or silence, never forced fit. The producer never
    asserts a negative (M3 rule 1).
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_DIVIDENDS_CANDIDATE`, proposal_kind `DIVIDENDS`
  (≠ OPEN_WORLD). `dividend_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (the share_count precedent verbatim:
  recorded responses predate the key; missing/non-array reads as empty
  list, never a schema failure). Quote byte-verification identical to
  existing proposals. Golden evals: recorded responses are never
  hand-edited into the new shape; the first dividends recordings are
  minted by the first live runs, each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is
  keyed on generic_claim_key alone): `NATIVE_DIVIDENDS_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null`
  (explicit, with the TERMR build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: null` (no kind mints a party — section 1).
  `MAPPING_TABLE_VERSION` bumped; table-validation still asserts no
  duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `COORDINATION → DIVD-COORD × DIVIDEND_COORDINATION_COVENANT`;
  `SPECIAL_DIVIDEND_DECLARED → DIVD-SPECIAL ×
  PRE_CLOSING_SPECIAL_DIVIDEND`;
  `SPECIAL_DIVIDEND_AMOUNT → DIVD-SPECIAL ×
  PRE_CLOSING_SPECIAL_DIVIDEND_PER_SHARE_AMOUNT`.
  Out-of-enum assertion_kind → explicit `pushOpenWorld`, typed reason
  (P1 C-4: the main loop's open-world routing keys on proposal_kind and
  will not catch it).
- **Restriction-polarity gate, FIRST, before any kind corroboration —
  this family's primary corruption trap (pack warning 8):** the quote
  is checked against
  `/\b(shall|will) not\b[\s\S]{0,60}\b(declare|pay|set aside)\b/i` —
  measured, honestly, against all 39 IOC-DIVIDEND quotes (audit
  MATERIAL-2): it matches only 4 (`1f0fb14e…`, `62de07b7…`, `500f9100…`,
  `dab9e4c0…`). The corpus norm is stem-less verb-list sub-clause
  drafting ("(v) (A) declare, set aside, make or pay any dividend…")
  whose "shall not" stem lives outside the card's quote bytes, so
  `4171dec5…`, `3a2c477b…`, and `dd0c39da…` do NOT match this gate. The
  gate is a partial, honestly-4/39 backstop, used here as a
  review-router, never a resolver. The load-bearing backstop is
  corroboration, not this gate: verified 0 of 39 IOC-DIVIDEND quotes
  match ANY registered kind's corroboration pattern, so an
  uncaught restriction quote still cannot resolve — it lands in
  `DIVIDEND_KIND_UNCORROBORATED` review instead of
  `RESTRICTION_POLARITY_TEXT` review, but it never publishes an
  affirmative dividend claim off negative-covenant text either way. Any
  gate match → review, typed `RESTRICTION_POLARITY_TEXT`, never resolve
  — an IOC restriction limb that leaks into a dividend assertion (stage-2
  misclassification, a producer over-reach) can cost a queue item but can
  never publish an affirmative dividend claim off negative-covenant text.
  This gate is deliberately resolver-side despite the classifier
  declines, because classification and production are independent
  failure surfaces.
- **Full-table kind ambiguity rule (the TERMF C-3 device) with exactly
  ONE pinned co-resolution pair:** the handler runs ALL kinds'
  corroboration patterns over the assertion's single byte-verified
  quote. The pair `{SPECIAL_DIVIDEND_DECLARED, SPECIAL_DIVIDEND_AMOUNT}`
  is pinned co-resolvable — grounded necessity: both grounding
  sentences carry authorization and amount together, so both kinds
  matching one quote is the drafting's ordinary shape; each assertion
  resolves independently on its own kind. Every OTHER multi-kind match
  (COORDINATION patterns plus a SPECIAL pattern in one quote — no
  corpus card is this shape today, but a combined section is drafteable)
  → review, typed `AMBIGUOUS_DIVIDEND_ASSERTION_KIND`. Per the remedies
  M3 correction, there is NO resolver-side sub-quote search:
  corroboration runs over the assertion's own quote; the producer owns
  splits. Asserted-kind pattern mismatch → review, typed
  `DIVIDEND_KIND_UNCORROBORATED`.
- **Corroboration tables (frozen resolver constants; label must bind to
  quote text; every pattern grounded in a committed fixture quote):**
  - `COORDINATION` ↔ `/coordinate their record and payment dates/i`
    (grounded ALL FOUR coordination cards; receipt 2 proves the phrase
    hits exactly those four cards corpus-wide — zero cross-family
    noise) ∪ `/\breceive two (\(2\) )?dividends\b/i` (grounded
    `3336d56b…` "receive two (2) dividends"; `9d990944…`/`c65d116a…`
    "receive two dividends").
  - `SPECIAL_DIVIDEND_DECLARED` and `SPECIAL_DIVIDEND_AMOUNT` share ONE
    pattern set (they are one legal event's two claims):
    `/\bmay declare a dividend\b/i` (grounded `13bda3e5…`) ∪
    `/\bshall declare\b/i` (grounded `b4f19d27…` — "Kraft shall declare
    in accordance with applicable Law"; note the coordination cards
    contain "is declared"/"has been declared" but never the
    modal+declare bigram, so this pattern does not cross-fire on them —
    verified against all four coordination quotes) ∪
    `/\b(Pre-Closing|Special) Dividend\b/` (case-sensitive defined
    terms, grounded `13bda3e5…`, `b4f19d27…`). The AMOUNT kind is
    additionally gated by the parser — a pattern match with no
    resolvable literal ABSTAINs, it never resolves on corroboration
    alone.
- **Handler order per assertion:** polarity gate → full-table kind
  corroboration → `dividend_term_ref` verbatim-substring enforcement
  (SPECIAL kinds; `DIVIDEND_TERM_NOT_IN_QUOTE` /
  `DIVIDEND_TERM_UNIDENTIFIED`) → `dividend-per-share-parse.js` (AMOUNT
  kind only) → concept assignment → gates. Every ABSTAIN routes to
  review with the parser's typed reason; RESOLVED values still pass
  `canonicalValueAllowed` (a parser bug must not bypass the gate);
  presence claims carry
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` (the tax-matters uniform
  tag-construction story; no auto-pass-block entry rides on it).
- **Materiality: NEW tier proposed, flagged for Ben.** `{ rank: 85,
  label: 'DIVIDENDS', concept_key_prefixes: ['DIVD-COORD',
  'DIVD-SPECIAL'] }` — exact keys, deliberately never a bare `DIVD-`
  prefix (the financing-covenants discipline: a bare prefix would
  silently sweep every future DIVD-* concept into this tier without
  review). Rank placement is a Ben call with a named collision to
  adjudicate: head carries 70 (CLOSING_CONDITIONS) and 90
  (NOTICES_ADMINISTRATIVE); the unbuilt wave siblings propose 75
  (FINANCING_COVENANTS) and — BOTH — 80 (TAX_MATTERS and
  EMPLOYEE_MATTERS, a sibling-vs-sibling collision this spec does not
  resolve but must not worsen). **85 also collides with a sibling
  proposal, named here (audit MATERIAL-1):**
  `2026-08-03-family-dno-indemnification-design.md` proposes
  `{ rank: 85, label: 'DNO_INDEMNIFICATION' }` in the same wave, same
  day. This spec does not resolve that collision; per the D&O spec's own
  ordering note, it is a single Ben call at whichever PR lands last —
  dividends and D&O indemnification cannot both hold rank 85. Dividend
  mechanics sitting below tax/employee matters and above notices matches
  the ledger's ordering spirit, but 85 itself is a proposal on the
  table, not a settled number; the ledger's M3 queue ordering does not
  name dividends, so both the number and its collision with the D&O
  proposal are FLAGGED FOR BEN. **Pre-concept review routing (TERMF M-3):** review
  items minted before the kind map runs (polarity gate,
  `AMBIGUOUS_DIVIDEND_ASSERTION_KIND`, `DIVIDEND_KIND_UNCORROBORATED`)
  carry conceptFamily `'DIVD-COORD-PENDING'` — a routing token only,
  never registered, never publishable — which startsWith-matches the
  `DIVD-COORD` tier key → rank 85 instead of UNCLASSIFIED 99.
- **Identity:** `dividend_term_ref` and the claim definition key
  participate in claim identity/closure — the two DIVD-SPECIAL claims
  over one overlapping sentence never collide or dedupe, and a
  hypothetical deal with two named special dividends mints distinct
  stable claims per term.
- **Receipt + additivity (honest form, P1 M-1):** with no dividends
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the new `dividend_per_share_parse_version` field,
  the bumped `section_family_classifier_version` (if this slice extends
  the signature — the build-order pin), and the recomputed
  `resolution_receipt_id`; documented in the PR as a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` V2 → V3 at head;
version re-checked at build time; every edit a reviewed diff; keys MUST
be registered concept keys — which is why both concepts land in this
same slice; explicit `\b` on every case-sensitive defined-term regex;
static max ≤ 128; rationale per pattern)

- `DIVD-COORD`: LITERAL_PHRASE "coordinate their record and payment
  dates" (all four coordination cards; receipt 2 — exactly-four corpus
  hits, the family's zero-noise anchor); LITERAL_PHRASE
  "fail to receive one" (`3336d56b…` "fail to receive one (1)
  dividend", `9d990944…`/`c65d116a…` "fail to receive one dividend" —
  the shared prefix covers both variants); LITERAL_PHRASE
  "regular quarterly dividends" (`3336d56b…`, `9edec4a0…`, `9d990944…`,
  `c65d116a…`; priced cross-hit noise below — audit MATERIAL-4).
- `DIVD-SPECIAL`: BOUNDED_REGEX `/\bPre-Closing Dividend\b/`
  (case-sensitive defined term; `13bda3e5…`); BOUNDED_REGEX
  `/\bSpecial Dividend\b/` (case-sensitive defined term; `b4f19d27…`);
  LITERAL_PHRASE "special cash dividend" (`b4f19d27…`).

**Priced cross-hit noise, stated (the TERMR M-4 discipline), with query
receipts:** `/\bSpecial Dividend\b/` verifiably fires on 12
non-COV-DIVIDEND cards inside the Kraft deal (receipt 3, corrected —
consideration, definition, employee and rep echoes of the defined term;
audit MINOR-1), and `/\bPre-Closing Dividend\b/` on 3 non-COV-DIVIDEND
Maverick-deal cards (receipt 4) — expected `LEXICAL_UNMATCHED_SIGNALS`
hits outside DIVD candidate evidence, concentrated in exactly the deals
that HAVE special dividends. `"special cash dividend"` LITERAL_PHRASE
additionally fires on 2 non-COV-DIVIDEND cards, both DEF-GENERAL Kraft
§1.01 definitions of the same defined term — same deal-local class,
priced for the same reason (audit MINOR-2). `"regular quarterly
dividends"` LITERAL_PHRASE fires on 6 non-COV-DIVIDEND cards corpus-wide
(IOC-DIVIDEND 3, COVENANT_INTERIM_OPERATING/subtype NULL 2, DEF-GENERAL
1) — e.g. IOC-DIVIDEND card `dd0c39da…`'s permitted-dividend carve-out
"regular quarterly dividends in an amount not to exceed $0.55 per
share" — precisely the sibling-flood class the family's own "declare"
exclusion reasoning warns about (audit MATERIAL-4). Accepted and
recorded for all three patterns: the defined-term and phrase hits are
the family's strongest veto tells in precisely the deals/siblings where
they fire; deletion asymmetry applies; the anti-noise test pins one hit
per pattern as EXPECTED so a future silent deletion breaks a test.

**Priced exclusions** (each a recorded blind spot; veto-only design
means a miss costs a missed VETO, never a wrong claim):

- Bare "dividend"/"dividends": fires across IOC-DIVIDEND (39/31),
  CONSID-ADJUST (13/13), the exchange-fund card, "Dividend Date"-shaped
  defined terms (the TERMF C-3 boundary lesson), and the
  dividend-equivalent population (receipt 5) — guaranteed noise flood
  across four sibling families.
- "record date": exchange-agent and consideration mechanics
  corpus-wide (`1000229f…` itself contains it); zero family
  discrimination.
- "declare"/"declared"/"declare, set aside": the IOC lexicon already
  keys the restriction verb-strings to IOC-DIVIDEND; duplicating them
  here would flood both families' signals (the tax-matters IOC-overlap
  ruling verbatim).
- "distribution"/"distributions": REIT machinery (P4, boundary 3),
  exchange-fund mechanics, and partnership-unit prose.
- "dividend equivalent": receipt 5 — consideration/equity-award
  territory (boundary 4).
- Residual blind spot, named: a coordination covenant drafted WITHOUT
  the anchor phrase or the two-dividends phrase (e.g. pure
  Starwood-style per-quarter allocation with novel wording) is
  invisible to this lexicon; a miss costs a missed veto, the v1↔v2
  comparator covers the seven v1-carded deals, and coverage extends by
  reviewed diff when live runs surface the variant.

## 6. Acceptance tests (real-fixture-first; the P1 M-5
pre-rerun-harness honesty pins apply VERBATIM — no recorded native runs
exist for this family; every resolver/registry test drives synthetic
compiled candidates pinned to REAL corpus quotes, byte-verified against
committed fixture bytes, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** all seven COV-DIVIDEND cards (`13bda3e5…`,
   `3336d56b…`, `9edec4a0…`, `b4f19d27…`, `9d990944…`, `c65d116a…`,
   `b67f22f5…`) plus the mislabeled affirmative card `0906ff1d…`
   (COVENANT_OTHER/subtype NULL home, deal `0a043659…`, §7.19 real
   heading "Dividend Matters" — audit CRITICAL-1) plus the boundary
   cards — `1000229f…` (CONSID-EXCHANGE exchange-fund), the committed
   IOC-DIVIDEND restriction quote `1f0fb14e…` (the polarity gate's
   named, gate-matching committed fixture — audit MATERIAL-2), and
   optionally a second, stem-less IOC-DIVIDEND quote (e.g. `dd0c39da…`)
   pinned to `DIVIDEND_KIND_UNCORROBORATED` so both defense layers
   (gate and corroboration) carry regression fixtures — all committed
   under this family's fixture directory with their own provenance
   headers, independent of the IOC slice's fixtures so neither slice's
   tests depend on the other's build order — committed as LITERAL
   production bytes under
   `tests/fixtures/canonical-v2/dividends-live-run/`, provenance
   headers with deal uuid + provision_card uuid + retrieval date +
   provision_type/subtype (including `1000229f…`'s CONSID-EXCHANGE home
   and `0906ff1d…`'s COVENANT_OTHER/"Unclassified" home), NEVER v1
   `section_ref` label strings (the IOC lint pin — this family's uniform
   "Coordination of Dividends" short_title is exactly the label class
   that must stay out of headers). The `4b5710b6…` DEF-MERGERCONSID
   duplicate is NOT committed (its bytes are already the `13bda3e5…`
   fixture); it is recorded in the ingest-QA flag only. Every test quote
   asserted a contiguous substring of committed bytes.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; two concepts + three definitions validate with zero
   validator changes; expected-concept-keys AND expected-claim-keys
   superset-diffs written against sorted CONTENT, never the numeral; a
   test asserts the kind→(concept, definition) frozen map's values are
   all registered keys.
2. **Parser, table-driven over the coverage map:** `13bda3e5…` resolves
   `'2.00'` (decimal preserved as-written) with bare-numeral immunity
   asserted on its own bytes ("no later than one Business Day");
   `b4f19d27…` resolves `'16.50'` (per-share phrase BEFORE the literal —
   the anti-adjacency pin); all four coordination quotes ABSTAIN
   `NO_MONEY_LITERAL`; `b67f22f5…` (REIT, zero money literals — pack warning
   7; audit MINOR-3) ABSTAINs `NO_MONEY_LITERAL`; a synthetic two-literal quote built
   by concatenating the two committed amount limbs ABSTAINs
   `MULTIPLE_MONEY_LITERALS` and each committed single-amount limb
   resolves; `NO_PER_SHARE_BASIS` exercised on the `1000229f…`
   exchange-fund bytes with a synthetic literal appended (labeled
   synthetic); `HYBRID_MAGNITUDE_MONEY`, `NON_USD_CURRENCY`,
   `MALFORMED_GROUPING`, `NON_LITERAL_MONEY` each exercised; digit-run
   ends-on-digit pinned (F-2) against a sentence-comma case.
3. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** each of the four coordination cards resolves
   DIVIDEND_COORDINATION_COVENANT presence (including the `9d990944…`
   conditional variant and the `9edec4a0…` allocation variant — the
   drafting-variant spread is the point of committing all four);
   `13bda3e5…` and `b4f19d27…` each resolve BOTH DIVD-SPECIAL claims
   from overlapping quotes (the pinned co-resolution pair; never
   `AMBIGUOUS_DIVIDEND_ASSERTION_KIND`), with `dividend_term_ref`
   substring-enforced ("Pre-Closing Dividend" / "Special Dividend") and
   a deliberately corrupted term → `DIVIDEND_TERM_NOT_IN_QUOTE`, a
   missing term → `DIVIDEND_TERM_UNIDENTIFIED`; the committed
   IOC-DIVIDEND restriction quote `1f0fb14e…` (gate-matching, audit
   MATERIAL-2) asserted as any kind → `RESTRICTION_POLARITY_TEXT`
   review, never a resolved claim (the polarity gate's permanent
   regression fixture); if committed, the second, stem-less IOC-DIVIDEND
   quote asserted as any kind → `DIVIDEND_KIND_UNCORROBORATED` review
   (the corroboration backstop's own regression fixture, since it does
   NOT match the polarity gate); a COORDINATION assertion on the
   `13bda3e5…` quote → `DIVIDEND_KIND_UNCORROBORATED`; a SPECIAL
   assertion on a coordination quote → `DIVIDEND_KIND_UNCORROBORATED`
   (the modal+declare bigram check — "is declared"/"has been declared"
   must not corroborate); the `b67f22f5…` REIT quote asserted as any
   registered kind → `DIVIDEND_KIND_UNCORROBORATED` review, and routed
   via `open_world_candidates` when the producer follows the prompt; the
   `0906ff1d…` mislabeled affirmative card (audit CRITICAL-1) asserted
   as any registered kind → `DIVIDEND_KIND_UNCORROBORATED` review, and
   routed via `open_world_candidates` when the producer follows the
   prompt (the fourth-pattern regression fixture); out-of-enum
   assertion_kind exercises explicit `pushOpenWorld`;
   `answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'` asserted on
   every resolved presence claim; materiality rank 85 asserted BOTH on
   a resolved claim AND on a `'DIVD-COORD-PENDING'` review item;
   additivity re-pin with the documented field-level diff.
4. **Cross-family boundary pins (each named for its boundary):** (b-1)
   an INTERIM_OPERATING article_context fixture declines classification
   for every title rule, and the polarity-gate fixture from test 3
   stands as the resolver-side half; (b-2) the `1000229f…` "No
   Dividends or Distributions" title declines classification (the
   grounded exclusion); the CVR "No Voting, Dividends or Interest…"
   title also declines classification (the new exclusion, audit
   MATERIAL-3), and a grep-test asserts zero exchange-fund vocabulary
   ("unsurrendered", "Exchange Fund", "Certificates") AND zero CVR
   vocabulary ("CVR", "Contingent Value Right") in this slice's prompt,
   corroboration tables and lexicon; the `0906ff1d…` "Dividend Matters"
   title correctly DISPATCHES (not excluded, by design — audit
   CRITICAL-1) and its assertion lands in `DIVIDEND_KIND_UNCORROBORATED`
   review (test 3); (b-3) zero
   REIT tokens (REIT, "857", "4981", "Qualifying Income") in the
   compiled prompt text, corroboration tables and lexicon (asserted by
   grep over the slice's modules); (b-4) a "Dividend Equivalents" title
   declines classification; DEFINITIONS/REPRESENTATIONS/CONDITIONS
   article_context fixtures decline (the `4b5710b6…` duplicate's home
   class must never dispatch).
5. **Identity:** the two DIVD-SPECIAL claims over one overlapping
   sentence mint distinct, stable, non-deduping identities; two
   synthetic same-section special dividends with different
   `dividend_term_ref` values never collide or dedupe; re-run is
   byte-stable.
6. **Lexicon:** table validation (keys registered — the two new
   concepts; explicit `\b` on case-sensitive regexes; static max ≤ 128;
   rationale per pattern; content hash re-pinned; version bump);
   anti-noise regression paragraph extended with an IOC restriction
   sentence, the `1000229f…` exchange-fund sentence, a CONSID-ADJUST
   "stock dividend" adjustment sentence and a "dividend equivalent"
   equity-award sentence — asserted zero hits under the exclusions
   (bare "dividend"/"record date"/"declare" never entered the table);
   one EXPECTED unmatched-signal pinned for `/\bSpecial Dividend\b/`
   against a committed non-COV-DIVIDEND Kraft-deal quote (receipt 3;
   deletion-proofed by test); each surviving pattern hits its own
   grounding quote in committed fixtures; determinism permutation tests
   green under the grown table.
7. Full suite + `npm run build` + forbidden-patterns (fixtures inside
   the exempt directory class; zero new exemption entries — any
   collision is fixed by restructuring the offending file, never by
   widening FILE_PATTERN_EXEMPTIONS); phase allowlist for the slice's
   files; recorded capitalisation AND termination-fee fixtures replay
   byte-identically through the registry with the DIVIDENDS entry
   present; unknown family → no prompt, typed record; classifier
   fixtures per §3; the all-titles corpus validation runs as a
   review-time script (live Supabase; never stubbed into `npm test`).

## Out of scope

- Ordinary-course/quarterly dividend caps and every permitted-dividend
  carve-out inside interim-operating restrictions (boundary 1; IOC
  family; family-brief deviation flagged for Ben — Grounding
  correction 4).
- Exchange-fund/unsurrendered-share dividend mechanics, CONSID-ADJUST
  anti-dilution, dividend equivalence, and ALL
  consideration-adjustment math including whether a pre-closing
  dividend reduces or rides alongside the merger consideration
  (boundary 2; consideration family + deal-identity serving dimensions
  — `TARGET_PAID_DIVIDEND_PER_SHARE` is the serving layer's component,
  never restated here).
- REIT required/status-maintenance distributions (boundary 3; P4;
  `b67f22f5…` recorded as P4's candidate grounding card).
- Final-partial-period / straddle declared-but-unpaid payment
  mechanics (boundary 5; one card; open world; family-brief deviation
  flagged for Ben).
- The coordination record-date window as a numeric claim (the section-1
  vacuity ruling — evidence-in-quote only); any day-count or
  percentage parser.
- Declaration-modality and conditional-gate promotion (qualifier-track,
  P2 seam).
- `FAMILY_MAPPING_TABLE` extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit — the COV-DIVIDEND label collapse makes this
  table Ben-reviewed, never implementer-inferred).
- The `4b5710b6…` duplicate card and the NULL defined_term columns as
  cleanup targets (ingest-QA flags, never absorbed).
- Live re-extraction runs (dated handoffs; until they land, no report
  may claim native dividend extraction — M-5); any M3 amendment; any
  scope-closure/ABSENT work; cross-deal canonicalization of any
  verbatim phrase.

## Known costs, stated up front

- **The whole family is 7 deals.** Even at perfect conversion this
  slice adds at most a handful of claims per corpus pass; its value is
  (a) the special-dividend amount is a consideration-adjacent number
  Ben currently has NO structured field for anywhere (Grounding
  correction 2), and (b) the coordination presence claim closes a
  family the lexical net would otherwise leave uncovered
  (uncovered families block auto-pass — program invariant). The cost
  of the slice is scaled accordingly: two concepts, one small parser,
  three definitions.
- **DIVD-SPECIAL rests on 2 deals** — the program's smallest grounding
  set, flagged in section 1. Variant drafting (a formula-priced
  dividend, a termless special dividend, an aggregate-stated dividend)
  queues on typed reasons rather than resolving; coverage extends by
  reviewed diff. Ben may defer the concept entirely.
- **Coordination drafting variance is real** (four cards, three
  distinct shapes); the presence claim absorbs it, but the lexicon's
  residual blind spot (novel coordination wording) is priced in §5,
  and the window/proviso content is deliberately unstructured this
  slice.
- **The defined-term lexicon patterns fire deal-locally** (receipts
  3–4): expect `LEXICAL_UNMATCHED_SIGNALS` queue items in the Kraft and
  Maverick deals' consideration/definition sections — a handful of
  one-second confirmations in exactly the deals where the veto matters
  most; deletion asymmetry applies.
- **The per-share basis gate is quote-level, not adjacency-level:** a
  pathological quote carrying "per share" and a single unrelated
  aggregate dollar would resolve wrongly IF such drafting exists; not
  corpus-attested, the multiplicity rule catches the common restatement
  shape, and review at rank 85 sees every resolved amount this slice
  (no auto-pass exists for a family with no v1 field to agree with —
  the M3 auto-pass v1/v2-agreement leg cannot be satisfied, so every
  claim is Ben-reviewed until v2 history accumulates; stated so nobody
  reads "resolves" as "publishes unreviewed").
- **Known instance of a fourth drafting pattern, priced (audit
  CRITICAL-1):** card `0906ff1d-2c22-443e-96c3-556ae4b42600` (deal
  `0a043659…`, §7.19 "Dividend Matters") is a real affirmative dividend
  covenant — a mandated recurring per-share quarterly dividend plus a
  catch-up mechanic — that v1 mislabeled COVENANT_OTHER/subtype
  NULL/short_title "Unclassified", so the card-label population query
  (receipt 1) could not see it, even though the section IS
  dividend-titled in the actual document. It dispatches under this
  slice's own bare `/\bdividends?\b/i` stage-1 rule inside a covenants
  article_context, and corroborates neither DIVD-COORD nor
  DIVD-SPECIAL's patterns, so it lands in permanent review as
  `DIVIDEND_KIND_UNCORROBORATED` / open-world on every pass by
  construction — never resolving, never publishing wrong. This is an
  unmodeled fourth drafting pattern (recurring mandated, distinct from
  DIVD-SPECIAL's one-time shape), flagged for Ben in section 1 alongside
  the DIVD-SPECIAL low-N call. Stage-2-only reach remains possible for
  any OTHER mislabeled home not yet found by this audit; that residual
  is still typed, measurable under-coverage, and live-run handoffs
  measure it.
