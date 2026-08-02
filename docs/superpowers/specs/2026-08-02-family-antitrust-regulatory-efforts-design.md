# Family — Antitrust / regulatory efforts (ANTI-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED (2 CRITICAL, 5 MATERIAL, 5
MINOR findings applied mechanically from the 2026-08-02 adversarial audit;
0 parked). RECEIPT RE-RUN GATE: PASSED 2026-08-02 — the corrected
provision_type-filtered receipts were re-run read-only against production
(tzulhdasmioeechxapdy) and every one reproduced exactly: the 13-row/353-card
corpus grounding table byte-for-byte, and the corrected
COMMERCIALLY_REASONABLE_EFFORTS receipt (four ANTI-EFFORTS grounding cards
8116d793/6751e0ab/5b65d2cc/6ca75363 retained; the two out-of-family
COVENANT_INTERIM_OPERATING cards d9b46458/21e6844a the unfiltered join had
wrongly surfaced excluded). Fable reviewed the re-run at fold: the audit's
correction is confirmed applied; the build gate is CLEAR. Normal program
convention (build → Fable review) still applies to the build itself.
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-track sibling
of P1–P4; five-layer promotion structure and cross-slice invariants apply
verbatim).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template, typed-abstain parsers, coverage-map anchored-overlap + honesty
pins), `2026-08-02-family-termination-fee-design.md` and
`2026-08-02-family-termination-rights-design.md` (wave-one folded exemplars;
the termination-rights spec defines the producer-prompt-registry seam — this
family dispatches through that seam, never a capitalisation fallback),
`2026-08-02-lexical-disagreement-net-design.md` (lexicon rules),
EXECUTION-LEDGER M3 review protocol + extraction semantics rules 1–3 (this
spec implements, and may not amend, them).
**Materiality:** no existing tier covers `ANTI-` (verified:
`MATERIALITY_TABLE`, `candidate-resolution.js` ~446–457, has no ANTI prefix;
this family would sort UNCLASSIFIED rank 99 behind notices). Section 4
proposes a new tier, flagged for Ben.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`;
evidence pack of 2026-08-02 + this spec's own SELECT-only receipts of
2026-08-02)

v1 `provision_cards` with `provision_type = 'ANTITRUST_REGULATORY'`
(353 cards, 12 subtypes + null):

| v1 subtype | cards | deals |
| --- | --- | --- |
| ANTI-COOPERATE | 43 | 29 |
| ANTI-EFFORTS | 42 | 29 |
| ANTI-INFO | 39 | 25 |
| ANTI-BURDEN | 32 | 27 |
| ANTI-FILING | 31 | 26 |
| ANTI-CONSULT | 30 | 26 |
| ANTI-NOTIFY | 26 | 25 |
| ANTI-LITIGATION | 25 | 22 |
| (null) | 23 | 9 |
| ANTI-NOACTION | 22 | 21 |
| ANTI-FOREIGN | 20 | 18 |
| ANTI-TIMING | 13 | 13 |
| ANTI-INTERIM | 7 | 7 |

No `ANTI-*` concept exists in the compiled bundle (verified:
`EXPECTED_CONCEPT_KEYS_*`, `contract-bundle.js` ~2838–2861, carries none),
no ANTI-family DB tables exist, and the extracted values live in generic
`claims` rows keyed by `provision_instance_id` joined to
`provision_cards.provision_instance_id` — join via `provision_instance_id`;
`claims.source_provision_id` is non-null on every ANTI-family claim (and
corpus-wide) but references the unstable `provisions` table and must not be
used to reach `provision_cards`. Everything this slice registers is new vocabulary —
every concept and enum member below is therefore FLAGGED FOR BEN in the PR
body (concept-key additions are taxonomy decisions; this spec proposes, Ben
settles).

**v1 label↔text drift, observed and pinned (this family's version of the
TERMR extension defect — labels are UNTRUSTED input to this design):**

- The Verizon/Frontier carve-out paragraph (card `aaa49795`) is the
  `primary_quote` of an ANTI-LITIGATION card while the same clause text also
  backs the ANTI-BURDEN card `05835387`; the M.D.C. Holdings control/consult
  paragraph backs both an ANTI-COOPERATE card (`41d2ae58`) and an
  ANTI-TIMING card (`143c8f3b`). One contract clause, multiple subtype
  labels — every corroboration table below exists because the corpus itself
  demonstrates the drift.
- Goodyear/Cooper Tire's timing claim (card `c08e88c1`) is v1-tagged
  `BARRED_MUTUAL_CONSENT` while its quote carries "not to be unreasonably
  withheld, conditioned or delayed" — the discriminating text of the
  ADJACENT enum value. Sophos/SecureWorks (`1ea551b2`) tags
  `BARRED_MUTUAL_CONSENT` on a joint-strategy quote ("shall jointly devise
  and implement the strategy … including determining whether to stay, toll
  or extend") that contains no prohibition at all. Both are permanent
  regression fixtures in section 6.
- The identical hell-or-high-water formula ("take any and all
  steps/action … to avoid or eliminate each and every impediment under
  any/every Antitrust Law") is v1-tagged `effortsStandard =
  HELL_OR_HIGH_WATER` on Sanofi/Bioverativ (card `b97f9cb0`) and
  `burdenCommitment = EXPRESS_HOHW` on BCPE/Envestnet (card `b13ddeeb`) —
  the same legal fact filed under two different v1 attributes in two deals.
  Section 1 resolves this with a registry ruling.

**Query receipts (SELECT-only, 2026-08-02, run for this spec):** three
queries over `claims ⋈ provision_cards ⋈ deals` retrieved verbatim evidence
for every enum value the evidence pack lacked quotes for: FLAT efforts
(cards `32303372`, `9446ad42` Kraft/Heinz; `00247ce8` Catalent; `0d37ef0e`
Metsera), BEST_EFFORTS (`afbb034f` Chevron/Anadarko),
COMMERCIALLY_REASONABLE_EFFORTS (`8116d793` ENDRA/Noble Africa; `6751e0ab`
Verve; `5b65d2cc` Metsera; `6ca75363` Frontier — re-cited to
`provision_type='ANTITRUST_REGULATORY'` cards after the audit found the
original unfiltered join surfaced two out-of-family COVENANT_INTERIM_OPERATING
cards, `d9b46458` ENDRA and `21e6844a` Forest City, as false grounding; these
receipts must be re-run with the provision_type filter applied before build),
EXPRESS_HOHW (`b13ddeeb` Envestnet), the HOHW-tagged efforts card
(`b97f9cb0` Bioverativ), NO_LITIGATION_ONLY / EXPRESS_NONE (`aa0b1eaa`
SecureWorks; `537be110` Zymeworks/Theravance), TIME_BOUNDED (`3428e47d`
Forest City; `622b5586` Covance; `1ae37d6e` Concho; `aaa49795` Frontier),
NAMED_ASSET_CARVEOUT (`346ca513` Merck/Prometheus), the Marriott/Starwood
$700 million cap (`9c65007c`), and all four timingAgreement values
(`3cdc7395`, `7c393fce`, `95b5ba1a`, `18f2a5bd`, `d3293e39`, `d9d17905`,
`143c8f3b`, `c08e88c1`, `1ea551b2`, `57fac5c6`, `f763e769`). A fourth probe
confirmed the literal phrase "hell or high water" appears in ZERO ANTI
`primary_quote`s — it is market vocabulary, not corpus drafting (matters
for the lexicon, section 5). PRECEDENT_COMPARABILITY, BUYER_DISCRETION,
RIGHT_NOT_OBLIGATION, MERITS_GATED, WITH_SYNERGIES and DE_MINIMIS_FLOOR
returned ZERO claims rows — those v1 taxonomy values have no corpus
observations and are NOT registered (below).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for the family's negotiated core: (a) the
efforts standard as an enum; (b) the burden commitment (cap architecture)
as an enum, with the defined-term ref ("Burdensome Condition", "Detriment")
carried verbatim; (c) the express dollar divestiture cap, where one exists;
(d) the litigation-defense obligation as an enum; (e) the timing-agreement
restriction as an enum; (f) the HSR filing deadline as a literal day count.

**No recorded native runs exist for this family.** There are no open-world
fixture candidates to convert, no closure_ids to track, and nothing that
may be described as "converted". The deliverable is the five-layer
capability plus the pre-rerun harness: a COVERAGE MAP over committed
corpus-quote fixtures (verbatim `primary_quote` / `region_full_text` bytes
from the production cards cited above, committed with provenance — deal,
card id, retrieval date — never retyped ASCII), hand-enumerated with
expected outcomes, driving synthetic compiled candidates through
registry/resolver layers. The P1 audit M-5 pins apply verbatim: "the
pipeline natively extracts regulatory-efforts provisions" may be claimed
ONLY after dated post-merge live rerun handoffs (subscription CLI, one
documented run per fixture deal); no report before those handoffs may state
family conversion, coverage, or recall.

**The v1 defect this family's numeric work exists to fix, named:** v1's
`hsrFilingDeadlineBusinessDays` is declared `type: 'duration'` in the
rubric yet stores bare digit strings ("10", "25") in some deals and full
prose sentences in others (Whole Foods, Anadarko, Kraft), and v1's
`divestitureCap` is declared `currency` yet is populated on exactly 1 of 32
ANTI-BURDEN cards. The v2 design replaces both with typed-abstain parsers
that either resolve a literal or queue with a typed reason — never a
prose-in-a-number-field row again.

## 1. Registry (`contract-bundle.js` → next fixture-contract version)

Strictly additive spread of the current head version (V14 as of this
writing; sibling family slices are queued on the same file — the version
number and `MAPPING_TABLE_VERSION` are allocated at build time in merge
order, per the MAE-slice convention; never renumbered in a spec, never a
silent-last-win).

**New concepts — five, version 1, `{concept_key, version}` shape only (the
fixture-shape validator rejects anything else). The v1 subtype keys are
reused verbatim so the future FAMILY_MAPPING_TABLE rows are rename-free:**

- `ANTI-EFFORTS` — standard of efforts for regulatory clearance. 42 cards /
  29 deals.
- `ANTI-BURDEN` — burden cap / divestiture limits. 32 cards / 27 deals.
- `ANTI-LITIGATION` — obligation (or express non-obligation) to litigate
  against regulators. 25 cards / 22 deals.
- `ANTI-TIMING` — timing-agreement / pull-and-refile restrictions. 13
  cards / 13 deals.
- `ANTI-FILING` — regulatory filing deadline. 31 cards / 26 deals.

NOT registered this slice: `ANTI-COOPERATE`, `ANTI-CONSULT`, `ANTI-INFO`,
`ANTI-FOREIGN`, `ANTI-NOTIFY`, `ANTI-NOACTION`, `ANTI-INTERIM` (prose/
process families — control-of-strategy and consultation-tier promotion is a
named future slice; see Out of scope), and no concept for the 23
null-subtype cards (v1 hygiene, flagged to the ingest-QA owner). This grows
`EXPECTED_CONCEPT_KEYS` to the next sorted superset (prior rows untouched
byte-for-byte) and the expected-claim-keys row likewise; both superset
diffs are acceptance-tested (TERMR m-4 pattern).

**Claim definitions (six):**

```
REGULATORY_EFFORTS_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_EFFORTS_STANDARD'
  version: 1
  allowed_canonical_values: [
    'REASONABLE_BEST_EFFORTS',
    'BEST_EFFORTS',
    'COMMERCIALLY_REASONABLE_EFFORTS',
    'REASONABLE_EFFORTS',
    'FLAT_OBLIGATION',
  ]
  canonical_value_required_when_present: true

REGULATORY_BURDEN_COMMITMENT_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_BURDEN_COMMITMENT'
  version: 1
  allowed_canonical_values: [
    'ANTI_HOHW',              // express cap/carve-out: "shall not be required to …"
    'BURDENSOME_CONDITION',   // MAE-style defined-term cap ("Burdensome Condition", "Detriment")
    'CAPPED_QUANTITATIVE',    // express dollar cap
    'EXPRESS_HOHW',           // express any-and-all-impediments commitment
    'NO_LITIGATION_ONLY',     // carve-out limited to litigation obligations
    'NAMED_ASSET_CARVEOUT',   // enumerated obligations/assets excluded
  ]
  canonical_value_required_when_present: true

REGULATORY_DIVESTITURE_CAP_AMOUNT_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_DIVESTITURE_CAP_AMOUNT'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true

REGULATORY_LITIGATION_OBLIGATION_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_LITIGATION_OBLIGATION'
  version: 1
  allowed_canonical_values: [
    'MANDATORY_DEFEND',   // affirmative obligation to contest/defend through appeal
    'TIME_BOUNDED',       // obligation bounded by the Outside/End Date
    'EXPRESS_NONE',       // quoted express non-obligation ("no party shall be required to … defend")
  ]
  canonical_value_required_when_present: true

REGULATORY_TIMING_RESTRICTION_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_TIMING_RESTRICTION'
  version: 1
  allowed_canonical_values: [
    'BARRED_MUTUAL_CONSENT',
    'NOT_UNREASONABLY_WITHHELD',
    'BUYER_ONLY_RESTRICTED',
    'BUYER_OPTION_CONSULT',
  ]
  canonical_value_required_when_present: true

HSR_FILING_DEADLINE_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'HSR_FILING_DEADLINE_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'   // existing type
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. Named seam to verify at
build time (no-shop/MAE convention): if `EXPECTED_PROPOSAL_BOUNDARY` /
`KNOWN_VERSION_SHAPES` enumerate proposal kinds or shapes, the additions are
validator-constant changes called out in the PR; the fixture-shape validator
is never loosened.

**Four enum decisions, pinned as legal rulings (the registry section is
where they live because a wrong call here corrupts the product):**

1. **`SILENT_NO_CAP` is deliberately EXCLUDED** from the burden enum, and
   `SILENT` from the litigation enum. Both are v1 codes asserting the
   AGREEMENT SAYS NOTHING — claims about the absence of a provision. Under
   M3 rule 1 the producer never asserts a negative; silence is DERIVED by
   the (future) scope-closure machinery, which must prove the complete
   governed scope was examined. This exclusion is the family's primary
   corruption trap: "no cap, silent" is the single most market-significant
   burden datum (it reads as the strongest buyer commitment), so a wrong
   one is invisible and authoritative-looking — exactly the case M3 rule 1
   exists for. Mirrors the TERMF `NAKED_NO_VOTE` ruling verbatim.
2. **`EXPRESS_NONE` is RETAINED** in the litigation enum: it is a quoted
   PRESENT claim with negative content ("no party shall be required to …
   defend any claim asserted in court" — SecureWorks card `aa0b1eaa`,
   byte-verifiable text), the P3/C2 shape, distinct from derived ABSENT.
   Corroboration (section 4) requires the express non-obligation text.
3. **Hell-or-high-water is a BURDEN fact, not an efforts verb.** v1 files
   the identical any-and-all-impediments formula under `effortsStandard`
   (Bioverativ) in one deal and `burdenCommitment` (Envestnet) in another —
   the drift documented above. v2 models it ONCE: `EXPRESS_HOHW` under
   `REGULATORY_BURDEN_COMMITMENT`. The efforts enum carries only the five
   verb-phrase standards; an efforts assertion proposing a HOHW-style value
   is out-of-enum and routes open world. Envestnet is the both-facts deal:
   its section carries both an EXPRESS_HOHW burden claim and a
   REASONABLE_BEST_EFFORTS efforts claim ("use reasonable best efforts to
   take any and all action…", card `b13ddeeb`). Bioverativ's HOHW
   paragraph (card `b97f9cb0`, "take any and all steps nec[essary]…")
   converts to an EXPRESS_HOHW burden claim ALONE — neither its
   `primary_quote` nor its `region_full_text` contains "reasonable best
   efforts" (or any efforts noun), so no companion efforts claim is
   quotable from that section; that deal's RBE facts, if any, live in
   other sections/cards. FLAGGED FOR BEN — this is a taxonomy merge,
   proposed not settled.
4. **Zero-observation v1 codes are NOT registered:**
   `PRECEDENT_COMPARABILITY`, `BUYER_DISCRETION` (burden),
   `RIGHT_NOT_OBLIGATION`, `MERITS_GATED` (litigation), `WITH_SYNERGIES`,
   `DE_MINIMIS_FLOOR` (baseline) each returned zero corpus claims (query
   receipt above). Registering an enum value with no grounded text would
   ship a value whose corroboration cannot be authored under this
   programme's grounding rule — the TERMR /Drop Dead Date/ lesson applied
   prospectively. When the first real example lands, the addition is a
   cheap, Ben-reviewed registry diff; until then the shape routes open
   world and feeds the commonality report.

**Governed attributes (never in keys; all participate in claim
identity/closure so two same-section claims never collide or dedupe — the
cross-subtype quote-duplication defect makes this load-bearing here):**

- ALL six definitions: `obligor_party_scope` — enum `MUTUAL | ONE_PARTY`
  (frozen resolver constant). The family's covenants are dominantly mutual
  (v1 `appliesToParty`: PARTY_MUTUAL 36, PARTY_PARENT 12, PARTY_COMPANY 4);
  a one-sided efforts covenant recorded as mutual (or vice versa) corrupts
  the market statistic. Corroborated against quote text (section 4), never
  trusted from the label.
- ALL six: `obligor_party_ref` — verbatim party phrase from the quote
  ("each of the parties hereto", "Each of Parent and the Company",
  "Parent", "the Company"). REQUIRED; must be a verbatim substring of the
  byte-verified quote (P1 M-3 discipline); failure → review, typed
  `OBLIGOR_REF_NOT_IN_QUOTE`. MUTUAL claims mint party `{role:
  'REGULATORY_COVENANT_OBLIGOR', capacity: 'EITHER_PRINCIPAL_PARTY', value:
  <verbatim ref>}` — all three keys, the TERMR C-1 closed-contract rule.
  `EITHER_PRINCIPAL_PARTY` is the capacity the TERMR slice proposes; if
  TERMR lands first this slice reuses it, otherwise this slice mints it
  with the identical FLAGGED-FOR-BEN note (whichever lands second cites the
  first — never two definitions of one capacity). ONE_PARTY claims resolve
  via `resolveParty` / `PARTY_CAPACITY_LEXICON` (party_field
  `obligor_party`, new party_role `REGULATORY_COVENANT_OBLIGOR`);
  unresolvable → existing `PARTY_UNRESOLVED` review.
- `REGULATORY_BURDEN_COMMITMENT` additionally:
  - `burden_term_ref` — OPTIONAL verbatim defined-term phrase where the
    drafting mints one ("Burdensome Condition" — Frontier card `05835387`;
    "Detriment" — Skechers card `352b5c19`, Mr. Cooper card `b782c8cb`).
    Substring-of-quote enforced when present, typed
    `BURDEN_TERM_REF_NOT_IN_QUOTE` on failure; REQUIRED when the canonical
    value is `BURDENSOME_CONDITION` (a defined-term cap with no defined
    term is incoherent) — absence there → review, typed
    `BURDEN_TERM_REF_MISSING`. No cross-deal normalization of the term
    spellings this slice (the share_class_ref precedent — Ben adjudication
    over observed values later).
  - `burden_baseline` — OPTIONAL enum `TARGET_ONLY | BUYER_ONLY |
    COMBINED_ENTITY | SIZE_NORMALIZED` (the four corpus-observed values;
    §7 counts 9/5/8/6). Never required — its absence from a claim means
    nothing (M3 rule 1; a producer that omits it is not asserting the
    baseline is undefined). When asserted, corroborated (section 4).
- `REGULATORY_DIVESTITURE_CAP_AMOUNT` additionally: `currency` — fixed
  `'USD'`, stamped by the parser only when the literal is `$`-prefixed;
  never producer-asserted (TERMF precedent).
- `HSR_FILING_DEADLINE_DAYS` additionally:
  - `day_kind` — enum `BUSINESS | CALENDAR`, corroborated against the
    parser's `matched_text` (section 4). The corpus drafts both ("ten (10)
    Business Days" — M.D.C. card `8bb5215c`; "45 calendar days" —
    Frontier).
  - `filing_regime_ref` — the verbatim statute phrase, REQUIRED, and this
    slice accepts ONLY "HSR Act" (verbatim substring of the byte-verified
    quote; failure → review, typed `FILING_REGIME_REF_NOT_IN_QUOTE`; a
    non-HSR regime ref → review, typed `NON_HSR_FILING_REGIME` — ex-HSR
    and foreign deadlines are out of scope, see below). Rationale: the
    corpus's ex-HSR deadline text is near-universally prose ("as promptly
    as reasonably practicable"), packs multiple regimes with mixed units
    into one span (Frontier mixes an absolute date, two 45-calendar-day
    counts and a catch-all), or points at disclosure schedules
    (SecureWorks, Envestnet). Forcing those into a day-count claim would
    be rule-3 nearest-fit forcing.

## 2. Value parser: `antitrust-regulatory-parse.js`

New pure module, `measurement-date-parse.js` contract shape: typed
`{outcome:'RESOLVED', canonical_value, matched_text, …}` /
`{outcome:'ABSTAIN', reason}` — never a throw on prose, never arithmetic,
never repair. One `ANTITRUST_REGULATORY_PARSE_VERSION`, threaded into the
resolution receipt (P1 M-6). Two exported functions:

**`parseDivestitureCapAmount(quote)`** — the TERMF money grammar with one
family-specific addition:

- Candidate token: `[$€£]` optionally followed by whitespace, then a
  maximal digit-comma-dot run; P1 exclusions (section refs, dates, clock
  times) inherited; matching runs against LITERAL committed fixture bytes.
- Exactly one surviving `$` literal with STRICT 3-digit grouping →
  RESOLVED (strip `$` and grouping commas; round-trips
  `NON_NEGATIVE_DECIMAL_STRING`); `currency: 'USD'`.
- **`SCALED_MONEY_LITERAL` — the family's flagship ABSTAIN, forced by the
  corpus's ONLY dollar cap.** Marriott/Starwood (card `9c65007c`) drafts
  the cap as "greater than $700 million in lost value" — a `$` literal
  followed by a scale word. A digit-only extractor would resolve `'700'`,
  wrong by six orders of magnitude and published as authoritative. Rule: a
  candidate `$` literal whose next word (whitespace-tolerant) is a scale
  word from a frozen table (`million`, `billion`, `thousand`,
  case-insensitive, word-bounded) → ABSTAIN `SCALED_MONEY_LITERAL` →
  review. Scale-word multiplication is arithmetic and never happens. The
  honest consequence, stated: this slice resolves ZERO corpus divestiture
  caps mechanically — the one quantitative cap in 40 deals queues as a
  typed one-second Ben confirmation. The machinery exists for full-digit
  drafting ("$326,000,000"-style is corpus-attested in the TERMF family)
  and prices the interpretation-creep alternative, exactly like TERMF's
  `ANNIVERSARY_PHRASE`.
- Two or more surviving money literals → ABSTAIN `MULTIPLE_MONEY_LITERALS`
  (producer splits; parser never picks). Zero → `NO_MONEY_LITERAL`
  (qualitative MAE-style caps — the dominant corpus shape, 7 of 8
  cap-bearing deals — are burden-commitment enum claims, never pseudo-
  numbers; a producer that emits a cap-amount assertion over a qualitative
  cap queues here). Spelled money → `NON_LITERAL_MONEY`. `€`/`£` →
  `NON_USD_CURRENCY`. Malformed grouping → `MALFORMED_GROUPING`.

**`parseFilingDeadlineDays(quote)`** — the TERMR day-count grammar (the
two specs share the grammar by construction; if the TERMR slice's
`cure-period-parse.js` lands first, extracting a shared helper is a
build-time call flagged in the PR — never import-and-widen, never two
divergent grammars silently):

- RESOLVES: a literal integer immediately governing a day word (`day(s)`,
  `Business Day(s)`, `business day(s)`, `calendar day(s)`). Corpus forms:
  "within ten (10) Business Days after the execution of this Agreement"
  (M.D.C. card `8bb5215c`), "no later than 10 Business Days … no later
  than 45 Business Days" (Cooper Tire card `6d6cd671`), "within fifteen
  (15) Business Days" (Envestnet card `3632e1a3`), "within ten (10)
  Business Days after the date hereof" (Zymeworks card `616b310a`),
  "within thirty (30) business days" (Metsera card `aed19be1`).
- Hybrid "ten (10)": the parenthesized DIGIT is the candidate; a frozen
  spelled-numeral table (one…ninety) exists ONLY to detect contradiction —
  "ten (45)" → ABSTAIN `SPELLED_DIGIT_MISMATCH`; a spelled numeral with NO
  adjacent digit → ABSTAIN `NON_LITERAL_NUMERAL`. The live case: Skechers
  (card `4f05fd8c`) drafts "within twenty five Business Days" with no
  parenthesized digit — it queues `NON_LITERAL_NUMERAL` by design (reading
  spelled numbers is one step from arithmetic; TERMR rule verbatim).
- Two or more surviving day counts → ABSTAIN `MULTIPLE_DAY_COUNTS` (the
  Cooper Tire 10-BD/45-BD pack, and every Frontier-style multi-agency
  span: the producer splits per deadline; the parser never picks which
  deadline is "the" HSR one). Zero → `NO_DAY_COUNT` (covers
  absolute-date-only drafting — "no later than December 31, 2024" — and
  pure adverbial drafting — "as promptly as reasonably practicable";
  calendar dates are excluded tokens via `CALENDAR_DATE_PATTERN`, never
  day counts).
- `day_kind` is NOT decided here — the parser returns `matched_text`
  including the day word plus governing context; the resolver corroborates
  (section 4).
- Canonical form: strict digits, decimal string.

Neither function ever computes; comparatives ("the earlier of…") and
provisos survive in quoted evidence for the reviewer.

## 3. Producer prompt + provider

**New prompt MODULE:
`lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt.js`**
— own `PROMPT_ID 'native-producer-antitrust-regulatory/v1'`,
`PROMPT_VERSION 1`, bumped once per slice, never mid-slice. The
capitalisation prompt is NOT edited; recorded capitalisation fixtures
replay byte-identically.

**Dispatch — through the producer-prompt-registry seam, mandatorily.** The
TERMR spec designs `producer-prompt-registry.js` (frozen Map
`section_family → prompt module`; unknown family → NO producer, fail
closed, never a capitalisation fallback) plus the two-stage section-family
classifier (stage 1 deterministic title rules with provenance
`SECTION_FAMILY_RULE_CLASSIFIED`; stage 2 bounded AI classification with
visible `SECTION_FAMILY_AI_CLASSIFIED` provenance and the
`SECTION_FAMILY_AI_UNVERIFIED` unevaluated condition — BEN RULING
2026-08-02). This slice:

- adds ONE registry entry: `ANTITRUST_REGULATORY →
  buildAntitrustRegulatoryProducerPrompt`. If the TERMR slice has not
  landed at build time, THIS slice builds the seam exactly as the TERMR
  spec defines it and TERMR adds its entry later — whichever lands second
  adds an entry; there is never a second dispatch mechanism.
- ports its stage-1 title rules from the v1 `lib/parser-v2/classify.js`
  ANTI rules (~153–199) INCLUDING their ordering pins, which are the
  hard-won safety content: the anti-takeover-statute rule fires BEFORE the
  generic ANTI rule (a "State Takeover Statutes" rep must not be yanked
  into this family — the v1 comment at ~158 records the regression), and
  the `notInArticle: ['REP-T','REP-B']` exclusions are preserved so a
  "Regulatory Matters" representation never reaches this producer. Stage 1
  is validated against ALL deals' section titles before dispatch (the
  classify-rules safety check — this is the review for these rules).

**Response shape:** a `regulatory_efforts_assertions` array — each element
`{ section_reference, assertion_kind: 'EFFORTS_STANDARD' |
'BURDEN_COMMITMENT' | 'DIVESTITURE_CAP_AMOUNT' | 'LITIGATION_OBLIGATION' |
'TIMING_RESTRICTION' | 'HSR_FILING_DEADLINE', canonical proposal (enum
member for the enum kinds), obligor_party_scope, obligor_party
(verbatim phrase), burden_term_ref / burden_baseline (BURDEN kinds,
optional as governed above), day_kind + filing_regime phrase
(HSR_FILING_DEADLINE only), verbatim quote }` — plus
`open_world_candidates` (PRESERVE-THE-NOVEL retained verbatim). One
element per legal fact, each with its own single-fact quote — the prompt
owns the split so the parsers' one-candidate rules are satisfiable:

- A burden paragraph carrying both an efforts standard and a cap (the
  dominant drafting — Skechers, Envestnet) is TWO+ assertions.
- A Frontier-style multi-agency deadline span is one assertion PER
  deadline, each quoting its own limb; only the HSR limb is an
  `HSR_FILING_DEADLINE` assertion — the FCC/PUC limbs stay open world.
- The prompt explicitly forbids negative-shaped values: "never emit an
  assertion that a cap, deadline, or obligation is absent, silent, or
  'not stated' — v1's `filingDeadline` attribute stored value `No fixed
  filing deadline stated.` (Covance, 2 claims; NOT the
  `hsrFilingDeadlineBusinessDays` attribute) is the named anti-pattern;
  absence belongs to scope-closure machinery, not to you" (M3 rule 1,
  producer side).
- When unsure of any enum value or scope, keep the assertion in
  `open_world_candidates` — promotion narrows novelty, never forces fit.

**Provider (`anthropic-provider.js`):** ONE new generic key
`NATIVE_REGULATORY_EFFORTS_CANDIDATE`, proposal_kind `REGULATORY_EFFORTS`
(≠ OPEN_WORLD) — the TERMR one-key/handler-split precedent (the six shapes
share the obligor attribute contract; the definition split is mechanical
on `assertion_kind`). `regulatory_efforts_assertions` is deliberately NOT
added to `REQUIRED_RESPONSE_LISTS` (share_count precedent, provider
~83–89): recorded pre-existing responses predate the key; missing/
non-array reads as empty list, never a schema failure. Quote
byte-verification identical to existing proposals. Malformed elements are
typed provider errors; an out-of-enum canonical is NOT a provider error —
it passes through and the RESOLVER routes it open world with a typed
reason, so novel drafting surfaces in the commonality report instead of
dying as a retry (MAE precedent).

Golden evals: no recorded responses exist for this prompt; recordings are
minted only by the slice's documented fresh live runs (subscription CLI,
dated handoffs). Recorded-response fixtures are never hand-fabricated.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE resolution-table entry** (P1 M-2: `RESOLUTION_UNCONDITIONAL` is a
  Map keyed on generic_claim_key alone):
  `NATIVE_REGULATORY_EFFORTS_CANDIDATE`, `concept_key: null` (build-time
  check that nothing reads `mapping.concept_key` before the handler's
  kind map runs — TERMR m-3 row-shape pin), `registered_claim_definition_key:
  null`, `party_field: 'obligor_party'`, `party_role:
  'REGULATORY_COVENANT_OBLIGOR'`. The handler assigns concept AND
  definition from a frozen `assertion_kind` map:
  `EFFORTS_STANDARD → ANTI-EFFORTS / REGULATORY_EFFORTS_STANDARD;
  BURDEN_COMMITMENT → ANTI-BURDEN / REGULATORY_BURDEN_COMMITMENT;
  DIVESTITURE_CAP_AMOUNT → ANTI-BURDEN / REGULATORY_DIVESTITURE_CAP_AMOUNT;
  LITIGATION_OBLIGATION → ANTI-LITIGATION / REGULATORY_LITIGATION_OBLIGATION;
  TIMING_RESTRICTION → ANTI-TIMING / REGULATORY_TIMING_RESTRICTION;
  HSR_FILING_DEADLINE → ANTI-FILING / HSR_FILING_DEADLINE_DAYS`.
  Out-of-enum assertion_kind or canonical → explicit `pushOpenWorld`,
  typed reason (P1 C-4 — the main loop's open-world routing keys on
  proposal_kind and will not catch it). **Pre-concept review routing (TERMF
  M-3 device):** review items minted before concept assignment carry
  conceptFamily `'ANTI-PENDING'` — a routing token only, never a
  registered concept, never publishable — so they prefix-match the new
  tier below instead of ranking UNCLASSIFIED 99. `MAPPING_TABLE_VERSION`
  bumps by one from build-time head; table-validation test still asserts
  no duplicate generic keys.

- **Corroboration tables (frozen resolver constants; label must match the
  byte-verified quote — every pattern grounded in a cited card; mismatch →
  review with the typed reason named per table). Corroboration is a VETO
  on the proposed label, not a classifier (no-shop/MAE pin verbatim).**

  `REGULATORY_EFFORTS_STANDARD` ↔ quote (typed
  `EFFORTS_STANDARD_UNCORROBORATED`). The four qualified standards nest
  textually ("reasonable best efforts" contains "best efforts"), so the
  narrower labels carry NEGATIVE GUARDS — without them a BEST_EFFORTS
  label on a reasonable-best-efforts quote would pass:
  - `REASONABLE_BEST_EFFORTS` ↔ /reasonable best efforts/i (LabCorp card
    `d8f25d6e`; 71 corpus claims — the market default).
  - `COMMERCIALLY_REASONABLE_EFFORTS` ↔ /commercially reasonable
    efforts/i (ENDRA/Noble Africa card `8116d793` "7.6. Commercially
    Reasonable Efforts…"; Verve card `6751e0ab`; Metsera card `5b65d2cc`;
    Frontier card `6ca75363` — all four are `ANTITRUST_REGULATORY` cards,
    re-cited after the audit found the spec's original citation,
    `d9b46458`/`21e6844a`, resolved to two out-of-family
    COVENANT_INTERIM_OPERATING cards under an unfiltered join; re-run any
    receipt queries for this value with `provision_type=
    'ANTITRUST_REGULATORY'`).
  - `BEST_EFFORTS` ↔ /best efforts/i AND NOT /reasonable best efforts/i
    (Chevron/Anadarko card `afbb034f`).
  - `REASONABLE_EFFORTS` ↔ /reasonable efforts/i AND NOT /reasonable best
    efforts|commercially reasonable efforts/i (Skechers card `352b5c19` —
    "will use reasonable efforts", a real, negotiated, weaker standard).
  - `FLAT_OBLIGATION` ↔ NO /efforts/i match anywhere in the quote AND
    /take,?( or cause to be taken,)? all .{0,40}(actions?|steps|things)|all
    things necessary,? proper,? or advisable|all things necessary to
    consummate/i (Kraft/Heinz card `32303372` "shall … take, or cause to
    be taken, all actions" / "all things necessary to consummate" — the
    sole clean in-family grounding this slice; the comma-form alternation
    is required because the corpus drafts "take, or cause to be taken,"
    with a comma after "take" that the unextended literal pattern misses).
    `9446ad42` (Kraft) and `00247ce8` (Catalent) both contain "reasonable
    best efforts" / "commercially reasonable efforts" in the same quote
    and therefore FAIL the negative-efforts guard by design — retained
    ONLY as named queue-expected fixtures (test 4), never cited as
    grounding. `0d37ef0e` (Metsera) is DROPPED as grounding entirely: its
    quote is the state-takeover-statute covenant ("take all action
    necessary to ensure that no state takeover statute…"), the precise
    wrong-taxonomy content the stage-1 ordering pin (section 3) exists to
    keep out of this family — mechanically passing the regex is not a
    reason to ground a regulatory-efforts value on it. The corpus's FLAT
    drafting carries no "efforts" noun at all — an unqualified covenant is
    STRONGER than an efforts covenant, and a regex anchored on qualified-
    efforts phrases misses it entirely (evidence-pack warning 9, sharpened
    by the query receipts: the tell is the absence of "efforts", not a
    bare "efforts").

  `REGULATORY_BURDEN_COMMITMENT` ↔ quote (typed
  `BURDEN_COMMITMENT_UNCORROBORATED`):
  - `ANTI_HOHW` ↔ /(shall|will) not be required to|neither .{0,120}(shall|
    will) be required|in no event (shall|will) .{0,160}be required/i
    (Antlia card `4f3151dc` "neither the Company nor any of its
    Subsidiaries will be required to"; Frontier card `05835387` "in no
    event shall (x) Parent or any of its Affiliates be required to take
    any actions").
  - `BURDENSOME_CONDITION` ↔ the claim's own `burden_term_ref` present
    verbatim in the quote AND matching a frozen defined-term list this
    slice: /\bBurdensome Condition\b/ or /\bDetriment\b/, case-sensitive,
    explicit word bounds (Frontier `05835387`; Skechers `352b5c19`;
    Mr. Cooper `b782c8cb`). A new defined-term spelling queues (typed
    `BURDEN_TERM_UNRECOGNISED`) until added by reviewed diff.
  - `CAPPED_QUANTITATIVE` ↔ a `$` money token present in the quote,
    scaled or grouped (Marriott card `9c65007c` "greater than $700 million
    in lost value"). Note the enum claim CORROBORATES on the scaled form
    even though the AMOUNT claim abstains on it — the enum records that a
    dollar cap exists; the amount waits for review. Two facts, two gates.
  - `EXPRESS_HOHW` ↔ /take any and all (steps|actions?) .{0,60}(necessary
    )?to avoid or eliminate each and every impediment/i (Envestnet card
    `b13ddeeb`; Bioverativ card `b97f9cb0` — both deals draft the formula
    near-verbatim).
  - `NO_LITIGATION_ONLY` ↔ /(not|no party shall) be required to
    .{0,200}(defend|litigate|contest)/i (SecureWorks card `aa0b1eaa` —
    sole grounding). Zymeworks card `537be110` is DROPPED as grounding:
    its `primary_quote` is the bare sub-limb "(y) litigate (or defend)
    against any Action or investigation …" with no "not/no party shall be
    required to" chapeau anywhere in the quote, so the pattern fails on it
    by design; retained ONLY as a named queue-expected fixture
    (chapeau-loss) in test 4.
  - `NAMED_ASSET_CARVEOUT` — **NO corroboration pattern this slice; always
    review**, typed `BURDEN_COMMITMENT_UNCORROBORATED` (TERMR M-3
    device). The single v1 observation (Merck/Prometheus card `346ca513`)
    quotes a consent-fee/liability carve-out, not a named asset — the v1
    label↔text fit is itself questionable, so no pattern can be honestly
    authored from it. Queues unconditionally until grounded text exists.
  - `burden_baseline`, when asserted: `SIZE_NORMALIZED` ↔ /business the
    size of|notionally/i (Frontier `05835387` "materiality determined by
    reference to a business the size of the Company and its Subsidiaries";
    the Concho description records the same architecture). `COMBINED_
    ENTITY` / `TARGET_ONLY` / `BUYER_ONLY` — NO corroboration pattern this
    slice: `COMBINED_ENTITY`'s only discriminating shape (both parties'
    names/roles inside one loss/effect clause — Marriott `9c65007c` "lost
    value to Marriott and its subsidiaries and Starwood and its
    subsidiaries") is not authorable as a frozen resolver constant, since
    party names vary per deal and this slice does not anchor on the
    deal's resolved party refs at runtime; `TARGET_ONLY` / `BUYER_ONLY`
    likewise have no discriminating grounded pattern that survives the
    ubiquitous "taken as a whole" (it appears in every baseline shape).
    All three always review when asserted, typed
    `BURDEN_BASELINE_UNCORROBORATED`.

  `REGULATORY_LITIGATION_OBLIGATION` ↔ quote (typed
  `LITIGATION_OBLIGATION_UNCORROBORATED`):
  - `MANDATORY_DEFEND` ↔ /vigorously (contest|oppose|pursu)|oppose fully
    and vigorously|defend(ing)? through litigation|contest, resist and
    litigate|avenues of administrative and judicial appeal/i (Goodyear
    card `5d53350b` "vigorously contest, resist and litigate … vigorously
    pursuing all available avenues of administrative and judicial appeal";
    IBM/Red Hat card `a678fd05` "oppose fully and vigorously, including by
    defending through litigation"). **Pattern-authoring pin (evidence-pack
    warning 10):** the corpus drafting for this obligation NEVER uses the
    words of the v1 display label — any implementer who keys the pattern
    on the label's own vocabulary instead of the drafting verbs above will
    match essentially nothing. The v2 token is the CODE
    `MANDATORY_DEFEND`; the v1 display label is referenced only by its
    source location (see Lint-fingerprint discipline below).
  - `TIME_BOUNDED` ↔ the MANDATORY_DEFEND verb set AND /(on or )?(before|
    prior to) the (Outside|End) Date/ (Frontier card `aaa49795` "defending
    through litigation … that would prevent the Closing on or prior to
    the Outside Date"; Covance card `622b5586` — the two cards that
    verifiably pass both the verb set and the date-bound match). Forest
    City (`3428e47d`) and Concho (`1ae37d6e`) are REMOVED as grounding:
    `3428e47d` drafts "defend any lawsuits" / "contest and resist" (no
    MANDATORY_DEFEND verb-set match) and `1ae37d6e` drafts "take promptly
    any and all steps necessary to vacate, modify or suspend such
    injunction … prior to the End Date" (also no verb-set match); both are
    retained ONLY as named queue-expected fixtures (test 4). Ordering pin:
    TIME_BOUNDED is checked as its OWN label —
    a MANDATORY_DEFEND label on a date-bounded quote still resolves
    (corroboration is a veto, and the bound narrows, not contradicts); a
    TIME_BOUNDED label on a quote with no date bound fails.
  - `EXPRESS_NONE` ↔ /(not|no party shall|shall not) be required to
    .{0,200}(defend|litigate|contest)/i (SecureWorks `aa0b1eaa` — sole
    grounding; Zymeworks `537be110` is a named queue-expected fixture
    only, per the `NO_LITIGATION_ONLY` entry above — its bare sub-limb
    quote carries no chapeau and fails this pattern too). A quote matching
    BOTH the mandatory verb set and the express-none shape → review, typed
    `AMBIGUOUS_LITIGATION_OBLIGATION` (never resolve either — the
    SecureWorks drafting shows "defend" appears inside the non-obligation
    sentence).

  `REGULATORY_TIMING_RESTRICTION` ↔ quote (typed
  `TIMING_RESTRICTION_UNCORROBORATED`). All labels first require a
  restriction shape: /(shall not|neither .{0,120}shall|No
  party shall|agree(s)? not to|without the prior written consent|except
  with the prior written consent)/i — grounded in every cited timing card
  EXCEPT the Sophos joint-strategy quote (`1ea551b2`) and the M.D.C. card
  (`143c8f3b`), both of which fail it and queue by design (harmless for
  `143c8f3b` because `BUYER_OPTION_CONSULT` always reviews regardless —
  see below); the Sophos failure is the v1 label-drift defect resolving
  correctly:
  - `BARRED_MUTUAL_CONSENT` ↔ /consent of the other/i AND NOT
    /unreasonably withheld/i (Skechers `3cdc7395`; Carrols `f763e769`;
    Verve `57fac5c6`; Metsera `18f2a5bd`'s bar limb). Mr. Cooper
    (`7c393fce`) is REMOVED as grounding here: its quote drafts "prior
    written consent (email being sufficient, and which consent shall not
    be unreasonably withheld, conditioned or delayed) of the other party"
    — the parenthetical breaks the literal "consent of the other" match
    AND the quote itself contains "unreasonably withheld", the same
    consent-with-URW-rider architecture pinned as the Goodyear `c08e88c1`
    label-drift defect immediately below; the parenthetical-gap is priced
    as a pattern cost (Known costs), not treated as grounding here. The
    Goodyear card (`c08e88c1`) carries the unreasonably-withheld rider and
    therefore FAILS this label → review — the second label-drift defect as
    a permanent regression test.
  - `NOT_UNREASONABLY_WITHHELD` ↔ /unreasonably withheld/i (HireRight
    `95b5ba1a`; Metsera `18f2a5bd`; IonQ `d3293e39`; Covance `0a24fe41`;
    Mr. Cooper `7c393fce` — moved from `BARRED_MUTUAL_CONSENT` per the
    parenthetical-gap finding above; its quote verifiably corroborates
    this label).
  - `BUYER_ONLY_RESTRICTED` ↔ /consent of Parent/ AND NOT /consent of the
    other/i (Frontier card `d9d17905` — "The Company shall not commit …
    without the prior written consent of Parent").
  - `BUYER_OPTION_CONSULT` — **NO corroboration pattern this slice; always
    review.** The single observation (M.D.C. card `143c8f3b`) is the
    cross-listed control/consult paragraph, not a discrete timing
    restriction; no honest pattern exists yet.

  `HSR_FILING_DEADLINE_DAYS`: `day_kind` `BUSINESS` requires /business
  day/i inside the parser's `matched_text`; `CALENDAR` requires its
  absence AND (/calendar day/i or bare /days?/i); mismatch → review, typed
  `DAY_KIND_UNCORROBORATED` (TERMR pattern verbatim). `filing_regime_ref`
  gates as in section 1.

- **Party-scope corroboration** (ordering pin from TERMR verbatim — the
  mutual check runs FIRST): `MUTUAL` ↔ /each of (Parent and the Company|
  the parties)|each of the parties hereto|the [Pp]arties (hereto )?(shall|
  agree)|[Nn]either (Parent|the Company|[A-Z][a-zA-Z]+) nor/i present in
  the quote (LabCorp `d8f25d6e` "each of the parties hereto agrees";
  Pfizer `9da19175` "Each of Parent and the Company shall"; Verve
  `57fac5c6` "Neither Parent nor the Company shall"; Marriott `9c65007c`
  "neither Starwood nor Marriott"). A ONE_PARTY label on a quote matching
  the mutual pattern → review, typed `OBLIGOR_SCOPE_UNCORROBORATED`.
  `ONE_PARTY` is corroborated only when (a) the mutual pattern is absent,
  (b) `resolveParty` resolves the ref, and (c) the positional gate holds:
  the byte-verified quote matches `<ref> shall`, `<ref> will` or
  `<ref> agrees` anchored on the verbatim `obligor_party_ref` (Envestnet
  `b13ddeeb` "Parent shall"; Frontier `d9d17905` "The Company shall not") —
  the TERMR C-2 anti-inversion gate: regulatory covenants routinely name
  BOTH parties ("the Company … without the prior written consent of
  Parent"), and without the positional anchor a producer that swaps
  obligor and consent-holder passes the substring gate. Failure → review,
  typed `OBLIGOR_REF_UNCORROBORATED`.

- **Handler order** (TEMPORAL/share-count pattern): assertion_kind map →
  enum-membership FIRST (MAE M-2 ordering — out-of-enum must reach
  `pushOpenWorld`, not a corroboration throw) → label corroboration →
  party-scope corroboration → attribute verbatim checks → per-kind branch:
  enum kinds resolve the canonical directly (the value IS the enum
  member); `DIVESTITURE_CAP_AMOUNT` → `parseDivestitureCapAmount`;
  `HSR_FILING_DEADLINE` → `parseFilingDeadlineDays` + day_kind
  corroboration. Every ABSTAIN routes to review with the parser's typed
  reason; RESOLVED values still pass `canonicalValueAllowed` (a parser bug
  must not bypass the gate).

- **Cross-subtype-duplication guard, structural:** the same quote span may
  legitimately back a BURDEN claim and a LITIGATION claim (the Frontier
  clause does exactly this — its litigation limb and its carve-out limb
  are one paragraph). Identity carries claim_definition_key + canonical +
  the governed attributes, so the two claims never collide or dedupe; and
  a LITIGATION label on a span whose quote carries NO litigation verb
  fails its corroboration and queues — the observed v1 cross-listing
  cannot silently mint a wrong litigation row.

- **Materiality: ONE new tier, FLAGGED FOR BEN** (P1 rank-52 convention —
  this is a proposed legal ranking, not a ledger-derived one; the ledger's
  M3 ordering does not name this family):
  `{ rank: 65, label: 'REGULATORY_EFFORTS', concept_key_prefixes:
  ['ANTI-'] }` — between CONSIDERATION (60) and the rank-70 conditions
  tier, on the argument that the burden-commitment and litigation terms
  are first-order deal-certainty economics that determine whether the
  regulatory conditions can be met. `'ANTI-PENDING'` review items
  prefix-match it. No definition-key override entries. A test pins the
  rank on a resolved claim AND on a pre-concept review item (TERMF M-3
  refactor-proof pin). Verified non-collision: no existing concept key
  starts with `ANTI-`, and `TERMF-RTF-ANTI` matches the `TERMF-` prefix
  first.

- Receipt: `antitrust_regulatory_parse_version` threads into
  `receiptBody` alongside the bumped `mapping_table_version` and the new
  bundle `contract_vocabulary_digest`.

- **Additivity re-pin, honest (P1 M-1 verbatim):** with no
  regulatory-efforts input, resolution output byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest`, the new
  parser-version field, and the recomputed `resolution_receipt_id`;
  field-level diff documented in the PR. Skipping the version bump to keep
  old pins green is the named anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; keys MUST
be registered concept keys — which is why all five concepts land in this
same slice; every edit a reviewed diff; explicit `\b` on every
case-sensitive defined-term regex per the TERMR m-2 boundary pin; every
entry carries a one-line rationale; multi-form entries are separate
pattern_ids)

- `ANTI-EFFORTS`: LITERAL_PHRASE "reasonable best efforts" (`d8f25d6e`),
  "commercially reasonable efforts" (`8116d793` — re-cited in-family; the
  spec's original citation `d9b46458` is an out-of-family
  COVENANT_INTERIM_OPERATING card, see section 4), "best efforts"
  (`afbb034f` — nests inside the first; a hit is a hit, veto-only makes
  the double-fire harmless), "take, or cause to be taken, all actions"
  (`32303372` — the FLAT tell), "all things necessary, proper, or
  advisable" (`00247ce8`).
- `ANTI-BURDEN`: BOUNDED_REGEX /\bBurdensome Condition\b/ (case-sensitive;
  `05835387`), /\bDetriment\b/ (case-sensitive — the lower-case common
  noun must not fire; `352b5c19`, `b782c8cb`); LITERAL_PHRASE "hold
  separate" (`4f3151dc`, `9c65007c`), "shall not be required to"
  (`4f3151dc`), "avoid or eliminate each and every impediment"
  (`b13ddeeb`, `b97f9cb0` — the express-HOHW tell); "hell or high water"
  RETAINED as explicitly UNGROUNDED market vocabulary (query receipt: zero
  ANTI primary_quotes contain it) under the TERMF "reverse termination
  fee" precedent — the net scans agreement text and market drafting uses
  the phrase; veto-only, a pattern that never fires costs nothing.
- `ANTI-LITIGATION`: LITERAL_PHRASE "vigorously contest" (`5d53350b`),
  "defending through litigation" (`a678fd05`, `aaa49795`), "judicial
  appeal" (`5d53350b`, `a678fd05`).
- `ANTI-TIMING`: BOUNDED_REGEX /\bpull(ing)?[- ]and[- ]refil(e|ing)\b/i
  (three corpus surface forms: "pull and refile" `18f2a5bd`/`44be02e6`,
  '"pull-and-refile"' `d3293e39`, "pulling and refiling" `7c393fce`);
  LITERAL_PHRASE "stay, toll or extend" (`d9d17905`, `c08e88c1`) and
  "stay, toll, or extend" (`7c393fce` — serial-comma variant, separate
  pattern_id), "timing agreement" (`d9d17905`, `d3293e39`).
- `ANTI-FILING`: LITERAL_PHRASE "Notification and Report Form"
  (`4f05fd8c`, `aed19be1`); BOUNDED_REGEX /\bHSR Act\b/ (case-sensitive).
  **Priced cross-hit noise (the TERMR-OUTSIDE M-4 treatment):** "HSR Act"
  verifiably saturates EVERY subtype's sections in this family (timing,
  cooperation, information cards all quote it — this spec's own cited
  quotes prove it). Unmatched ANTI-FILING hits in non-filing sections will
  raise `LEXICAL_UNMATCHED_SIGNALS` → queue for ANTI-FILING scope there.
  ACCEPTED, recorded cost: a deadline can lurk in any HSR-mentioning
  section, the veto is the family's strongest deadline tell, and deletion
  would widen auto-pass (deletion asymmetry). The live-run handoffs
  measure the queue rate; narrowing is a reviewed lexicon diff, never a
  silent deletion. Test 7 pins one such expected unmatched hit.

Priced exclusions (each a recorded blind spot; veto-only design means a
miss costs a missed VETO, never a wrong claim): naked "efforts" (every
covenant article), "antitrust" / "Antitrust Laws" (saturates the family
and beyond — zero discriminating power inside it), "Governmental
Authority" / "Governmental Entity" (ubiquitous defined terms), "waiting
period" alone ("waiting period" appears in cooperation and condition
sections corpus-wide; the timing phrases above carry the signal),
"divest" / "divestiture" naked stems (fire in the conditions article and
in TERMF-RTF-ANTI fee text; "hold separate" carries the burden signal),
"filing" / "approval" (hopeless noise).

## 6. Acceptance tests (real-fixture-first; the pre-rerun-harness honesty
pins from P1 audit M-5 apply VERBATIM — no recorded native runs exist, so
every resolver/registry test drives synthetic compiled candidates pinned
to REAL corpus quotes committed as fixture bytes, labeled as the pre-rerun
harness)

0. **Fixture commit:** governed-section canonical text for at least four
   corpus deals covering: a mutual RBE efforts section (LabCorp), a
   defined-term cap with size-normalized baseline (Frontier `05835387` +
   `aaa49795` — one deal exercising burden, litigation TIME_BOUNDED, and
   the cross-subtype duplication in one region), the scaled dollar cap
   (Marriott `9c65007c`), a FLAT-obligation section (Kraft/Heinz), the
   hybrid and spelled filing deadlines (M.D.C. `8bb5215c`, Skechers
   `4f05fd8c`, Cooper Tire `6d6cd671`), and the timing label-drift cards
   (Goodyear `c08e88c1`, Sophos `1ea551b2`). Committed as LITERAL bytes
   from production `region_full_text`/`primary_quote` with provenance
   headers (deal, card id, 2026-08-02) — never retyped; every test quote
   asserted to be a contiguous substring of the committed bytes. Fixture
   directory placement per the Lint-fingerprint discipline section.
1. **Money parser:** Marriott bytes → ABSTAIN `SCALED_MONEY_LITERAL`
   (asserting specifically that `'700'` is NEVER resolved — the
   six-orders-of-magnitude regression pin); a synthetic full-digit cap
   quote built from committed TERMF-family bytes resolves exactly;
   `MULTIPLE_MONEY_LITERALS`, `NO_MONEY_LITERAL` (a qualitative
   Detriment-cap quote), `NON_LITERAL_MONEY`, `NON_USD_CURRENCY`,
   `MALFORMED_GROUPING` each exercised.
2. **Day parser:** "ten (10) Business Days" → `'10'`; "fifteen (15)" →
   `'15'`; "thirty (30) business days" → `'30'`; Skechers "twenty five
   Business Days" → `NON_LITERAL_NUMERAL` (the honesty case — the
   corpus's own spelled form queues); "ten (45)" → `SPELLED_DIGIT_
   MISMATCH`; Cooper Tire's 10-BD + 45-BD span → `MULTIPLE_DAY_COUNTS`
   with its hand-enumerated HSR sub-limb (contiguous substring, P1
   overlap rule) resolving `'10'`; absolute-date-only and
   promptly-only quotes → `NO_DAY_COUNT`.
3. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; all six definitions validate with zero validator
   changes; concept-keys and claim-keys superset-diff tests; the burden
   enum has exactly six members and contains NEITHER silent code (a test
   literally asserts `SILENT_NO_CAP` and `SILENT` are absent — the M3
   rule-1 ruling as a pin).
4. **Resolution (pre-rerun harness):** each enum value resolves on its
   grounding quote (as re-scoped in section 4 after the audit — the named
   queue-expected fixture cards, e.g. `9446ad42`/`00247ce8`/`0d37ef0e` for
   FLAT_OBLIGATION, `537be110` for NO_LITIGATION_ONLY/EXPRESS_NONE, and
   `3428e47d`/`1ae37d6e` for TIME_BOUNDED, are pinned to resolve to
   REVIEW via their typed reason, never to the label) with correct
   concept/definition/rank-65; the Metsera `18f2a5bd` BARRED_MUTUAL_CONSENT
   citation is pinned explicitly as split-dependent (only the quote's bar
   limb, not the whole card quote, is expected to resolve BARRED — a
   whole-quote proposal contains "unreasonably withheld" and must veto);
   every corroboration veto exercised, including at least: BEST_EFFORTS
   proposed on the LabCorp RBE quote → `EFFORTS_STANDARD_UNCORROBORATED`
   (the nesting guard); FLAT_OBLIGATION proposed on a quote containing
   "efforts" → fails; the Goodyear BARRED label → fails on the
   unreasonably-withheld rider; the Mr. Cooper BARRED label → fails on the
   parenthetical-gap/unreasonably-withheld rider (moved from grounding to
   regression fixture per the audit); the Sophos joint-strategy quote and
   the M.D.C. `143c8f3b` quote → each fails the restriction shape; a
   LITIGATION label on the Frontier BURDEN carve-out limb →
   `LITIGATION_OBLIGATION_UNCORROBORATED` (the cross-listing defect as a
   permanent regression); the SecureWorks quote proposed MANDATORY_DEFEND
   → `AMBIGUOUS_LITIGATION_OBLIGATION` or corroboration failure, never a
   resolved mandatory obligation over express-none text; `NAMED_ASSET_
   CARVEOUT`, `BUYER_OPTION_CONSULT`, and `burden_baseline` values
   `COMBINED_ENTITY`/`TARGET_ONLY`/`BUYER_ONLY` → review unconditionally;
   a mutual quote labelled ONE_PARTY → `OBLIGOR_SCOPE_UNCORROBORATED`; the
   Frontier timing quote with obligor_party_ref set to "Parent" (the
   consent-holder, present verbatim, resolvable) →
   `OBLIGOR_REF_UNCORROBORATED` (the positional anti-inversion gate);
   out-of-enum canonical and assertion_kind each exercise explicit
   `pushOpenWorld`; `FILING_REGIME_REF_NOT_IN_QUOTE` and
   `NON_HSR_FILING_REGIME` (an FCC-limb assertion) exercised; materiality
   rank 65 on a resolved claim AND an `'ANTI-PENDING'` review item;
   additivity re-pin with documented field-level diff.
5. **Identity:** a burden claim and a litigation claim over the same
   Frontier span mint distinct stable identities; two same-section
   efforts claims differing only in obligor_party_scope never collide;
   the mutual party mints the full three-key
   `{role, capacity: 'EITHER_PRINCIPAL_PARTY', value}` and passes
   `validate-write-set.js`'s closed party contract in-test (TERMR C-1).
6. **Provider + dispatch:** response missing
   `regulatory_efforts_assertions` → empty list, not schema failure;
   recorded capitalisation fixtures replay byte-identically THROUGH the
   prompt registry; unknown section family → no prompt, no candidates,
   typed record; stage-1 classifier: ANTI fixture titles classify
   ANTITRUST_REGULATORY, "State Takeover Statutes" and "Regulatory
   Matters" REP titles do NOT (the ported v1 ordering pins as tests),
   validated against all deals' section titles.
7. **Lexicon:** table validation (registered keys, explicit `\b`,
   bounded regexes ≤128 static max, rationale per pattern, content hash
   re-pinned); determinism permutations; anti-noise paragraph extended
   with "best of its knowledge" and "reasonable best estimate" prose
   (asserting the efforts phrases stay silent), lower-case "detriment"
   and "burdensome" prose (case-sensitivity proof), and a
   waiting-period-mentioning conditions sentence (asserting ANTI-TIMING
   stays silent without the restriction phrases); one committed
   cooperation-section fixture pins the /\bHSR Act\b/ cross-hit as an
   EXPECTED ANTI-FILING unmatched signal (the priced cost, asserted so
   a future silent deletion breaks a test); each surviving pattern hits
   its own grounding quote in the committed fixtures.
8. Full suite + `npm run build` + forbidden-patterns; phase allowlist
   for the slice's files; quote verification at zero flags.
9. **Post-merge (dated handoffs, not this slice's tests):** one
   documented fresh live run per fixture deal; recordings minted from
   those runs only; only then may any report describe native extraction
   of this family.

## Lint-fingerprint discipline (this family's vocabulary collides with
two checked-in bug-fingerprints — handled by design, not by accident)

`scripts/lint/forbidden-patterns.sh` `globalPatterns` includes two
prose-class fingerprints that live inside this family's legitimate
vocabulary: the v1 display label of `LITIGATION_OBLIGATION.MANDATORY_DEFEND`
(defined once, correctly, at `lib/taxonomy.js:257`, with existing
file-pattern exemptions for `lib/taxonomy.js` and
`tests/anti-regulatory-efforts.test.js` only), and the
burdensome/condition line-pattern. Pins for the build:

1. **Code over label, everywhere.** All v2 artifacts — registry enum,
   resolver constants, prompt text, test assertions — use the CODE
   `MANDATORY_DEFEND`. No new file reproduces the v1 display label; the
   spec itself references it only by source location. This costs nothing
   (the code is the load-bearing token) and it is also the legally
   correct authoring rule: the corpus drafting never uses the label's
   words (section 4), so nothing mechanical should key on them.
2. **Fixture bytes go through the reviewed exemption route.** The
   committed corpus-text fixtures (test 0) are verbatim recorded
   production provision text — the exact artifact class the lint's
   `RECORDED_LIVE_RUN_DIR` + `PROSE_CLASS_FINGERPRINTS` exemption exists
   for (its own comment: "recorded production provision_cards text …
   verbatim merger-agreement prose"). Real agreement text in this family
   CAN put the fingerprinted words on one line. The build therefore
   extends the exemption — adding this family's fixture directory to the
   lint's recorded-artifact alternation (or a `FILE_PATTERN_EXEMPTIONS`
   row per file), as its own reviewed, commented diff in the same PR —
   and NEVER (a) paraphrases or retypes a quote to dodge the lint (a
   literal-bytes violation), (b) names a non-live-run directory
   "live-run" to inherit the exemption dishonestly, or (c) deletes or
   weakens a pattern. `scripts/lint/` edits are themselves out of the
   scanner's walk, so the exemption diff cannot self-trip.
3. Docs under `docs/` are outside the scanner's walk; this spec still
   follows rule 1 as hygiene, because spec prose gets copied into code
   by implementers.

## Out of scope

- `ANTI-COOPERATE` / `ANTI-CONSULT` control-and-consultation promotion
  (`controllingParty` CONTROL_PARENT 31 / consultationTier 70 corpus
  claims — a strong second slice, with its own tagged-value taxonomy at
  `lib/taxonomy.js` `ANTITRUST_CONTROL`; not this one), `ANTI-INFO`,
  `ANTI-FOREIGN`, `ANTI-NOTIFY`, `ANTI-NOACTION`, `ANTI-INTERIM` (prose
  families; no registered v2 concepts).
- Ex-HSR and foreign filing deadlines (mixed units, multi-regime packs,
  disclosure-schedule pointers — open world; the Frontier FCC/PUC limbs
  and the SecureWorks/Envestnet schedule cross-references are named
  examples), and any `foreignFilingsRequired`-style list claim (the v1
  field mixes statutes, agencies and export-control regimes — evidence-
  pack warning 8; promoting it would launder that mixture into a
  governed list).
- Derived nakedness/silence facts: no-cap-silent, no-litigation-silent,
  clear-skies flags, `pullAndRefileRight` booleans — all scope-closure
  territory (M3 rule 1).
- The Metsera one-time-parent-withdrawal proviso and all pull-and-refile
  EXCEPTION mechanics (the restriction claim carries the proviso in its
  quoted evidence; the exception shape feeds the commonality report).
- Efforts-standard-differs-by-remedy (`effortsStandardDiffersByRemedy`),
  burdensome-condition-in-termination-trigger interactions, and any
  cross-family join to the conditions or termination families
  (relationship machinery).
- Template-level dedup for the precedent product (the ANTI-NOACTION/
  ANTI-NOTIFY shared-template observation — a commonality-report/serving
  concern, not extraction).
- Divestiture-cap scale-word interpretation ($700 million → 700000000 is
  a one-second Ben confirmation, never parser arithmetic).
- Cross-deal normalization of `burden_term_ref` and party phrases; the
  live re-extraction runs (dated handoffs); `FAMILY_MAPPING_TABLE`
  extension (separate Fable+Ben table edit); any amendment to M3
  semantics; any scope-closure/ABSENT work.

## Known costs, stated up front

- **Zero mechanical divestiture-cap resolutions this slice.** The only
  corpus dollar cap is scale-word drafted and ABSTAINs by design. The
  cap-amount machinery is priced as insurance for full-digit drafting
  plus a typed queue item today; the burden-commitment enum carries the
  market data meanwhile. Stating a cap-extraction capability in any
  report before a live run resolves one is the M-5 violation.
- `NAMED_ASSET_CARVEOUT` and `BUYER_OPTION_CONSULT` queue unconditionally
  (no honest corroboration exists); zero auto-published claims for those
  values this slice. Honest shape of the work.
- The `/\bHSR Act\b/` lexicon pattern raises expected unmatched-signal
  queue items across this family's non-filing sections — accepted,
  measured at the live-run handoffs, narrowed only by reviewed diff.
- Multi-deadline and multi-fact quotes ABSTAIN until the producer splits
  them; badly split output queues rather than resolves; two-strike
  escalation applies to prompt iteration, never to loosening the
  parsers.
- The FLAT_OBLIGATION negative-guard corroboration (no "efforts" in the
  quote) means a producer quoting a FLAT covenant THROUGH an adjacent
  efforts sentence queues — prompt guidance (quote the operative
  obligation sentence alone) mitigates; the queue rate is measured.
- Mutual covenants quoted at sub-clause level (losing the "each of the
  parties" chapeau) fail scope corroboration and queue — the TERMR
  chapeau cost, same mitigation, same measurement.
- v1 label drift is now a measured input, not a surprise: the four
  pinned drift cards (two timing, one cross-listing pair) all queue
  under this design. Queue volume from drift is the cost of not
  trusting v1 labels; the alternative is publishing them.
