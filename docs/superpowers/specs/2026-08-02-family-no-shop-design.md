# Family slice — No-shop / fiduciary exceptions (NOSOL native promotion)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit
returned AMEND (2 CRITICAL, 6 MATERIAL, 4 MINOR); all 12 findings folded
in below (0 rebutted). Amended sections: 1 (attribute identity), 2 (unit
corroboration, SEC-rule exclusion), 4 (corroboration tables, party
fields, PR flags), 5 (lexicon groundings, anti-noise pins), 6 (fixtures).
Re-audit of the amended sections precedes build (the P1 protocol:
spec-detail → audit → build → review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-slice
extension of the five-layer promotion structure).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template), `2026-08-02-lexical-disagreement-net-design.md` (lexicon
authoring), EXECUTION-LEDGER M3 protocol + extraction semantics rules 1–3
(implemented, never amended, here).

**Evidence base.** All concepts and patterns below are grounded in the
production corpus (Supabase project `tzulhdasmioeechxapdy`,
`provision_cards`): v1 subtype counts across 33 deals — NOSOL-PROHIBIT 46
cards / 33 deals, NOSOL-EXCEPT 37/33, NOSOL-NOTICE 39/32, NOSOL-MATCH
31/28, NOSOL-REMATCH 29/28 (plus RECOMMEND 66, INTERVENING 43, SUPERIOR
35, ACQPROPOSAL 33, CEASE 33 and seven further subtypes that stay OUT of
this slice — section "Out of scope"). Every quoted fragment in this spec
is verbatim from a production `primary_quote`; none is invented
(quotation glyphs are normalised for markdown — production bytes use
straight double quotes, e.g. `(the "Notice Period")` and `(d) "Last
Look".`; fixtures pin the actual bytes, this document renders curly
quotes). At build
time the acceptance fixtures re-pin every quote against LITERAL committed
fixture bytes, never against DB text (section 6).

## Deliverable (honest conversion semantics)

The native producer currently extracts ONE family (capitalisation). This
slice gives the no-shop family its own producer path so that no-shop
assertions arrive as TYPED proposals instead of open-world candidates —
five new generic claim keys resolving onto the five ALREADY-REGISTERED
NOSOL concepts (`NOSOL-PROHIBIT`, `NOSOL-EXCEPT`, `NOSOL-NOTICE`,
`NOSOL-MATCH`, `NOSOL-REMATCH`, `contract-bundle.js` lines 17–21) and
their already-registered claim definitions.

**What "conversion" honestly means here (P1 audit C-1/M-5, applied
verbatim).** NO recorded native runs exist for this family. There are no
open-world fixture clusters to convert, no closure_ids that could
"become" typed rows. The deliverable is therefore a **COVERAGE MAP built
forward, not backward**: hand-enumerated expected claims for the
committed no-shop fixture sections (section 6), each quote byte-verified
against the committed canonical text, driven through synthetic compiled
candidates in the pre-rerun harness. "The native producer extracts
no-shop" may only be claimed after the dated post-merge live rerun
handoffs — no report before then may state it (P1 audit M-5, verbatim).

## 1. Registry (`contract-bundle.js`) — NO new vocabulary; the additivity story is "zero"

Everything this slice publishes already exists in the compiled bundle:

- Concepts: `NOSOL-PROHIBIT`, `NOSOL-EXCEPT`, `NOSOL-NOTICE`,
  `NOSOL-MATCH`, `NOSOL-REMATCH` (v1, registered).
- Claim definitions: `NO_SHOP_PROHIBITED_ACTION` V2
  (`allowed_canonical_values` = `NO_SHOP_ACTION_CODES_V2`, 23 codes,
  lines 558–582); `NO_SHOP_EXCEPTION_PREREQUISITE` V2
  (`NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2`, 10 codes, lines 689–700);
  `NO_SHOP_NOTICE_PERIOD_DAYS`, `NO_SHOP_INITIAL_MATCH_PERIOD_DAYS`,
  `NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS` (all
  `NON_NEGATIVE_DECIMAL_STRING`, `canonical_value_required_when_present:
  true`).

So: **no new fixture-contract version, no concept edits, no definition
edits, `contract_vocabulary_digest` unchanged.** The additivity re-pin is
correspondingly strict: with no no-shop input, resolution output must be
byte-identical EXCEPT `mapping_table_version` (section 4 bump), the new
parser-version receipt fields, and the recomputed
`resolution_receipt_id` — documented as a field-level diff in the PR
(the P1 M-1 restatement, applied verbatim; skipping the version bump to
keep old pins green remains the named anti-pattern).

Governed attributes (schema-free on the claim's `attributes` object, per
the P1 verification that write-set attributes are schema-free except
`answer_provenance`; NEVER in the key):

- Period claims: `period_role` (`NOTICE | INITIAL_MATCH |
  SUBSEQUENT_MATCH` — redundant with the generic key by construction,
  carried for receipt legibility), `day_kind` (enum `BUSINESS_DAYS |
  CALENDAR_DAYS | UNSPECIFIED_DAYS` — section 2; **Ben ruled on
  2026-08-03 that bare "days" defaults to CALENDAR_DAYS**, while the
  verbatim bare unit phrase remains recorded so the default is visible), and
  `unit_phrase` (the verbatim unit text, e.g. "Business Days"), required
  to be a verbatim substring of the byte-verified quote — failure typed
  `PERIOD_UNIT_PHRASE_NOT_IN_QUOTE` → review (the P1 M-3 discipline).
- Action / prerequisite claims: `action_code` / `prerequisite_code`
  (the enum member — a gate, not a suggestion: out-of-enum routes to
  open world by an EXPLICIT `pushOpenWorld` with a typed reason in the
  handler, because the main loop's open-world routing keys on
  proposal_kind and will not catch it — P1 audit C-4's second half).
- Attribute identity pin: `day_kind`, `action_code`,
  `prerequisite_code` participate in claim identity/closure so two
  same-section claims never collide or dedupe. The load-bearing case is
  two prerequisite codes asserted on ONE exception (one section, one
  concept, one definition — only `prerequisite_code` distinguishes
  them; test 5's second half). (The initial five-day and renewed
  three-day windows are NOT an example of this pin: they resolve to
  DIFFERENT concepts — NOSOL-MATCH vs NOSOL-REMATCH — via different
  generic keys and could never collide regardless. Audit m-3.)

**Named seam to verify at build time:** the bundle validator's
`assertExact(input.parser_proposal_boundary, EXPECTED_PROPOSAL_BOUNDARY,
…)` (`contract-bundle.js` ~line 3253). If `EXPECTED_PROPOSAL_BOUNDARY`
enumerates proposal kinds or generic keys, adding this family's keys is
a validator-constant change inside this slice and is called out in the
PR; if it does not, nothing changes. Either way the fixture-shape
validator is not loosened.

## 2. Numeric parser: `no-shop-period-parse.js`

New pure module, the `measurement-date-parse.js` /
`share-count-parse.js` contract shape: `{outcome:'RESOLVED',
canonical_value, day_kind, unit_phrase, matched_text}` or
`{outcome:'ABSTAIN', reason}`. Never a throw on prose, **never
arithmetic, never unit conversion**.

Tokenizer and exclusions reuse the P1-pinned mechanics (maximal
digit-comma-dot runs; exclusions classified in order; grammar matched
against LITERAL committed fixture bytes including any zero-width/LTR
marks):

1. section references (LTR-tolerant grammar, shared with
   `share-count-parse.js`) — covers "Section 5.3(d)(ii)(2)",
   "Section 13(d)(3) of the Exchange Act";
2. SEC rule references — new exclusion this family, corpus-forced: the
   fiduciary-exception boilerplate quotes "Rule 14d-9, Rule 14e-2(a) or
   Item 1012(a) of Regulation M-A" (production NOSOL-EXCEPT card).
   Grammar (audit M-4 — a digit-letter-digit token alone cannot exclude
   "Item 1012(a)", whose citation number has no interior letter):
   `Rule`/`Item`/`Regulation` followed by a citation token of digits
   with OPTIONAL letter/hyphen suffixes AND optional parenthesised
   subdivision(s) — covers `14d-9`, `14e-2(a)`, AND `1012(a)`. "Item
   1012(a)" is its own pinned exclusion row in test 2;
3. calendar dates (reuse `CALENDAR_DATE_PATTERN`);
4. currency-prefixed literals;
5. clock times;
6. percentages — corpus-forced: Acquisition Proposal definitions are
   saturated with "20% or more", "15% or more" (a digit token
   immediately followed by `%` or by "percent");
7. **spelled-restatement collapse** — corpus-forced and family-specific:
   the dominant drafting form is "four (4) business days",
   "twenty-four (24) hours", "three (3) Business Days". A
   parenthesised digit group whose immediately preceding word sequence
   is spelled-number words (a frozen word list: one…twenty, thirty…
   ninety, hyphenated compounds) is ONE candidate — the digit form.
   This is a tokenization rule, not numeral conversion: the parser
   never computes a value from words; it only recognises that the
   digits restate the adjacent words so the pair is not
   `MULTIPLE_PERIOD_LITERALS`. The rule NEVER validates word↔digit
   agreement arithmetic ("five (3)" still yields the digit `3` as the
   candidate — a drafting mismatch is a legal-review matter that the
   quote itself surfaces to Ben, not something the parser adjudicates).

Then, on the survivors:

- **Unit corroboration is mandatory.** The single normative rule (audit
  C-1 — an earlier draft stated a ≤3-token window and strict adjacency
  simultaneously; the window is DELETED): the unit phrase must follow
  the candidate with **at most one intervening `)` token** (the
  spelled-restatement close-paren — after the collapse the surviving
  candidate in "four (4) business days" is the digit inside
  parentheses, so the closing `)` legitimately sits between digit and
  unit). Any other intervening token → ABSTAIN
  `PERIOD_UNIT_UNCORROBORATED`. Trailing possessives attached to the
  unit word itself ("Business Days'") are part of the unit token and do
  not intervene. Defined-term parentheticals come AFTER the unit in
  every corpus form ("four (4) business days in advance (the 'Notice
  Period')"), so "(the 'Notice Period')" appearing between candidate
  and unit is a veto, never admitted. Pinned fixtures: "four (4)
  business days" → RESOLVED; "5 Business Days'" → RESOLVED;
  "(the 'Notice Period')"-before-unit form → ABSTAIN
  `PERIOD_UNIT_UNCORROBORATED` (all three in test 2). The unit phrase:
  - `business day(s)` (case-insensitive) → RESOLVED,
    `day_kind: 'BUSINESS_DAYS'`;
  - `calendar day(s)` → RESOLVED, `day_kind: 'CALENDAR_DAYS'`;
  - bare `day(s)` → RESOLVED, `day_kind: 'CALENDAR_DAYS'`, preserving
    the verbatim bare `unit_phrase` (Ben ruling, 2026-08-03);
  - `hour(s)` → typed ABSTAIN **`PERIOD_UNIT_HOURS`** → review. This is
    the family's central legal pin: hour-denominated obligations
    ("within 24 hours", "within forty-eight (48) hours", "at least 96
    hours written notice" — all real production quotes) must NEVER be
    converted into a `*_PERIOD_DAYS` value. 24 elapsed hours is not
    "1 day" (and 96 hours is not "4 business days"); the legacy
    semantic schema already treats hour-bounds as qualifier codes
    (`NO_LATER_THAN_24_ELAPSED_HOURS`), not day counts. Conversion here
    is exactly the plausible-but-wrong output this programme exists to
    prevent.
  - anything else / no unit → typed ABSTAIN
    `PERIOD_UNIT_UNCORROBORATED`.
- Exactly-one rule: two or more surviving day-denominated candidates →
  ABSTAIN `MULTIPLE_PERIOD_LITERALS` (routes to review; the producer
  prompt is responsible for splitting — the parser never picks). Live
  corpus case pinned as a fixture: "…such period shall be three (3)
  Business Days instead of five (5) Business Days" (production
  NOSOL-REMATCH card) is TWO claims (renewed window + initial window)
  and must ABSTAIN as one quote.
- Zero survivors → ABSTAIN `NO_NUMERIC_LITERAL`.
- Spelled-only numbers → ABSTAIN `NON_LITERAL_NUMERAL`. This is a REAL,
  priced cost in this family, not a theoretical one: production quotes
  include "at least five Business Days in advance" and "the 'Notice
  Period' … will be three Business Days" with no digit restatement.
  Those claims queue for Ben. A spelled-number table is a possible
  later slice, Ben-ratified, never an implementer add (Known costs).
- Strict grouping per P1 (`^\d{1,3}(,\d{3})*$`; no decimals for day
  counts — a fractional day count ABSTAINs `MALFORMED_GROUPING`-class,
  typed `NON_INTEGER_PERIOD`, because "2.5 business days" is not a
  drafting form observed anywhere in 33 deals and resolving one would
  be an invented reading).
- No zero-pattern table this family: unlike cap-table zeros, there is
  no corpus form asserting a zero-day notice/match period as a positive
  quote. A `0` can therefore only arrive as a literal digit with a day
  unit; none observed; if one appears it resolves like any literal
  (M3 rule 1 is not implicated either way).
- Canonical form: digits with grouping commas stripped (`'4'`, `'10'`),
  round-tripping `canonicalValueAllowed`'s
  `NON_NEGATIVE_DECIMAL_STRING` regex.
- Module exports `NO_SHOP_PERIOD_PARSE_VERSION`, threaded into the
  resolution receipt (P1 audit M-6 pattern).

Enum-valued claims (`NO_SHOP_PROHIBITED_ACTION`,
`NO_SHOP_EXCEPTION_PREREQUISITE`) need **no value parser** — the value
IS the enum member and the bundle's `allowed_canonical_values` gate is
already the mechanical validator. What they need instead is
corroboration (section 4), because a wrong-but-in-enum code is the
failure mode enums cannot catch on their own.

## 3. Producer prompt + provider

**New prompt MODULE:
`lib/canonical-v2/native-producer/no-shop-producer-prompt.js`.** The
capitalisation prompt (`capitalisation-producer-prompt.js`) is NOT
edited — its `PROMPT_VERSION` does not move, its golden evals do not
re-run. The new module mints its own `PROMPT_ID`
(`no-shop-producer/v1`), its own `PROMPT_VERSION` (1), and its own
`CONTROLLED_VOCABULARIES`.

- Controlled vocabularies are the registry's, single-sourced: import
  `NO_SHOP_ACTION_CODES_V2` / `NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2`
  from `contract-bundle.js` if exported; if not exported (verify at
  build), a frozen copy plus a byte-equality test against the compiled
  bundle's claim definitions — drift between prompt vocabulary and
  registry gate is a silent corruption path and the test makes it loud.
- Response shape (the existing NOSOL-v1-inspired structure the
  capitalisation prompt's own header praises): four top-level arrays —
  `no_shop_action_assertions` (section_reference, action_code, party
  bound `covenant_obligor` verbatim phrase, verbatim quote),
  `exception_prerequisite_assertions` (section_reference,
  prerequisite_code, the exception's `permitted_action_context`
  verbatim phrase, verbatim quote), `period_assertions`
  (section_reference, period_role ∈ NOTICE / INITIAL_MATCH /
  SUBSEQUENT_MATCH, verbatim quote containing the number AND its unit),
  and `open_world_candidates` (unchanged shape).
- M3 rule 1 restated in the prompt: emit only evidence-backed
  positives; never assert an action is NOT prohibited or an exception
  is NOT present; ABSENT stays derived downstream, forever.
- PRESERVE-THE-NOVEL retained verbatim; plus the family-specific
  instruction set:
  - "When unsure which action/prerequisite code fits, or the drafting
    does not match any code, keep it in open_world_candidates —
    promotion narrows novelty, never forces fit." (Go-shop windows,
    intervening-event machinery, DADW/standstill waivers, superior- and
    acquisition-proposal DEFINITIONS are all expressly named in the
    prompt as open-world-for-now — section "Out of scope".)
  - Split instruction, corpus-motivated: "A sentence stating two
    periods ('three (3) Business Days instead of five (5) Business
    Days') is TWO period_assertions with two quotes." (Mirrors P1's
    compound-quote split rule; the parser ABSTAINs on the compound as
    the backstop.)
  - Period-role instruction states the legal distinction the
    corroboration table (section 4) enforces: NOTICE = obligation to
    tell the buyer upon RECEIPT of a proposal; INITIAL_MATCH = the
    advance-notice window before a recommendation change / termination
    during which the buyer may negotiate or match (even where the
    agreement labels it a "Notice Period" — the defined-term label does
    not decide the role); SUBSEQUENT_MATCH = the renewed window on
    material amendment or modification.
- `anthropic-provider.js`: five new generic claim keys, one
  proposal_kind `NO_SHOP` (≠ `OPEN_WORLD`):

  ```
  NATIVE_NO_SHOP_ACTION_CANDIDATE
  NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE
  NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE
  NATIVE_NO_SHOP_MATCH_PERIOD_CANDIDATE
  NATIVE_NO_SHOP_REMATCH_PERIOD_CANDIDATE
  ```

  Three period keys rather than one-key-plus-role-split because the
  three roles resolve to three DIFFERENT concepts (NOSOL-NOTICE /
  NOSOL-MATCH / NOSOL-REMATCH) and `RESOLUTION_UNCONDITIONAL` is a Map
  keyed on generic_claim_key alone (P1 audit M-2): distinct concepts
  get distinct keys so the table never needs a concept minted inside a
  handler. The provider maps `period_role` → key mechanically and
  rejects an unknown role as a typed provider error (fail-closed, the
  existing `NativeProducerAnthropicError` shape). Quote
  byte-verification (`locateQuoteBytes`) identical to existing
  proposals; a quote that does not reproduce from source bytes is never
  trusted with an invented offset.
- Section scoping: no-shop sections enter prompt scope via the existing
  section-scope mechanism (the P4-REIT convention: scope widens for the
  family's sections only; capitalisation extractions see zero change).
- Golden evals: there are NO recorded responses for this prompt.
  Recording happens on the slice's one documented fresh live run
  (subscription CLI, post-merge, its own dated handoff). Until then the
  pre-rerun harness drives resolver/registry layers with synthetic
  compiled candidates (section 6) — recorded-response fixtures are
  never hand-fabricated to simulate runs that did not happen.

## 4. Resolver wiring (`candidate-resolution.js`)

- FIVE unconditional resolution-table entries (distinct generic keys —
  no duplicate-key last-win risk; the table-validation test asserts no
  duplicates anyway):

  ```
  NATIVE_NO_SHOP_ACTION_CANDIDATE                → NOSOL-PROHIBIT / NO_SHOP_PROHIBITED_ACTION
  NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE→ NOSOL-EXCEPT   / NO_SHOP_EXCEPTION_PREREQUISITE
  NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE         → NOSOL-NOTICE   / NO_SHOP_NOTICE_PERIOD_DAYS
  NATIVE_NO_SHOP_MATCH_PERIOD_CANDIDATE          → NOSOL-MATCH    / NO_SHOP_INITIAL_MATCH_PERIOD_DAYS
  NATIVE_NO_SHOP_REMATCH_PERIOD_CANDIDATE        → NOSOL-REMATCH  / NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS
  ```

  `party_field`: `covenant_obligor`, `party_role`: `COVENANT_OBLIGOR`
  as table constants on ALL FIVE rows (audit m-2 — each resolution-table
  entry structurally requires concrete `party_field`/`party_role`, so
  "same as the host obligation" is not expressible as a table constant;
  the period obligations' obligor IS the covenant obligor in every
  corpus form). `MAPPING_TABLE_VERSION` 4 → 5.
- Dedicated handler per shape (the TEMPORAL/share-count pattern):
  corroboration → attribute verbatim checks → parser (periods only) →
  `canonicalValueAllowed` gate (a parser bug must not bypass the gate) →
  materiality. Every ABSTAIN routes to review with the typed reason.
- **Corroboration tables — frozen resolver constants binding label to
  quote text** (the P1 C-4 doctrine: a wrong-but-in-enum label must
  never publish under the wrong code; all patterns word-bounded per the
  lexicon rules, `/RSU/`-style case traps checked):

  *Action codes* (pattern must match the byte-verified quote; grounded
  verbs are verbatim from production NOSOL-PROHIBIT cards — "(1)
  solicit", "(i) initiate, solicit, propose, knowingly encourage, or
  knowingly facilitate"). Every stem is LEFT-BOUNDED with an explicit
  `\b` — the module adds no bounding of its own, and unbounded stems
  are the audit-M-2 gate-widener ("unsolicited" must never corroborate
  `SOLICIT_*`; "furtherance"/"Furthermore" must never corroborate
  `FURTHER_*`). One pattern per code (audit M-3 — a shared multi-code
  pattern lets a quote saying only "recommend" corroborate
  `ENTER_ALTERNATIVE_AGREEMENT`, the wrong-but-in-enum publish the
  table exists to stop):
  `SOLICIT_* /\bsolicit/i` · `INITIATE_* /\binitiat/i` ·
  `FACILITATE_* /\bfacilitat/i` · `ENCOURAGE_* /\bencourag/i` ·
  `FURNISH_NONPUBLIC_INFORMATION /\bfurnish|\bprovide|\bafford/i AND
  /\binformation/i` · `ENGAGE_IN_/CONTINUE_/PARTICIPATE_IN_ DISCUSSIONS
  /\bdiscussion/i` · `…NEGOTIATIONS /\bnegotiat/i` ·
  `AFFORD_ACCESS_TO_{PROPERTIES,BOOKS,RECORDS}
  /\baccess\b/i AND /\bpropert|\bbooks\b|\brecords\b/i` ·
  `GRANT_DGCL_SECTION_203_WAIVER /\bSection 203\b|\bDGCL\b|business
  combination statute/i` (the "203" digits are inside the pattern, not
  parsed) · `APPROVE_*_ALTERNATIVE_AGREEMENT /\bapprov/i` ·
  `RECOMMEND_*_ALTERNATIVE_AGREEMENT /\brecommend|\bdeclared? advisable/i` ·
  `ENTER_*_ALTERNATIVE_AGREEMENT /\benter/i` ·
  `PROPOSE_TO_*_ALTERNATIVE_AGREEMENT /\bpropos/i AND the base verb's
  own pattern (approve/recommend/enter as above)` ·
  `SUPPORT_ACQUISITION_PROPOSAL /\bsupport/i` ·
  `FURTHER_ACQUISITION_PROPOSAL /\bfurther\b/i` (fully bounded — blocks
  "furtherance"/"Furthermore").
  Mismatch → review, typed `NO_SHOP_ACTION_UNCORROBORATED`. Test 4's
  corroboration-veto fixtures include "unsolicited"-containing quotes
  (e.g. a `SOLICIT_*` code on a "bona fide unsolicited written
  proposal" quote → veto).

  *Prerequisite codes* (grounded verbatim in production NOSOL-EXCEPT
  cards — "prior to … receipt of the Company Stockholder Approval",
  "bona fide", "did not result from a material breach", "determines in
  good faith after consultation with", "constitutes, or could
  reasonably be expected to lead to, a Superior Proposal"):
  `WINDOW_SIGNING_TO_STOCKHOLDER_APPROVAL /\bprior to\b/i AND
  /\b(approval|vote)\b/i` ·
  `BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED /\bbona fide\b/i` ·
  `PROPOSAL_NOT_RESULTING_FROM_COVENANT_OBLIGOR_NO_SHOP_BREACH
  /did not result from|not solicited in violation|not resulting
  from/i` · `BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION
  /\bgood faith\b/i AND /Superior Proposal/` ·
  `BOARD_GOOD_FAITH_FIDUCIARY_DUTY_DETERMINATION /\bgood faith\b/i AND
  /\bfiduciar/i` · `OUTSIDE_FINANCIAL_ADVISER_AND_LEGAL_COUNSEL_
  CONSULTATION /financial advisor|financial adviser/i AND /legal
  counsel/i` · `OUTSIDE_LEGAL_COUNSEL_FIDUCIARY_CONSULTATION /legal
  counsel/i AND /\bfiduciar/i` · `SUBJECT_TO_INITIAL_PROPOSAL_NOTICE
  /\bsubject to\b|\bcompliance with\b/i AND /\bnotice\b|\bnotif/i`
  (strengthened per audit m-4 — bare `/notice|notif/i` was a
  near-vacuous veto, since essentially every no-shop exception
  paragraph contains "notice") ·
  `ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED
  /confidentiality agreement/i` · `NONPUBLIC_INFORMATION_PREVIOUSLY_OR_
  SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY
  /\bpreviously\b|\bprior to\b|substantially (concurrent|simultaneous)|
  \bsimultaneously\b/i`.
  Mismatch → review, typed `NO_SHOP_PREREQUISITE_UNCORROBORATED`.
  Priced-noise note (audit m-4): "bona fide" appears in 84 NOSOL-card
  quotes and in other families corpus-wide, so the
  `BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED` veto is knowingly
  weak — a mislabeled prerequisite whose quote happens to contain
  "bona fide" still resolves; the backstop is the same as the
  period-role veto's (v1↔v2 comparator + Ben's rank-50 queue).

  *Period roles* — the mislabel THIS family is most exposed to, because
  agreements name the matching window "the 'Notice Period'" (production
  NOSOL-MATCH card: "prior written notice to Parent, at least four (4)
  business days in advance (the 'Notice Period')") while the true
  notice obligation is hour-denominated ("promptly (and in any event
  within 24 hours) after receipt of any Acquisition Proposal, notify"):
  - `NOTICE` requires receipt-trigger language ANCHORED to proposal
    receipt (audit M-1 — the earlier `/(after|upon|of
    the)?\s*receipt/i` had a fully optional prefix group and so
    degenerated to bare `/receipt/i`, which match-window text
    routinely contains, letting the family's named central mislabel
    sail through):
    `/(after|upon|following)\s+(the\s+)?receipt of (any|an|such)
    (Acquisition|Takeover|Company Acquisition) Proposal/i` OR
    `/receives (any|an) (Acquisition|Takeover) Proposal/i` — the
    trigger is MANDATORY, not optional — AND `/\bnotif|\bnotice\b|
    \badvise/i`;
  - `INITIAL_MATCH` requires advance-of-action language:
    `/\bin advance\b|\bprior (written )?notice\b|\bbefore taking\b/i`
    AND `/\brecommendation\b|\bterminat|\bnegotiat|\bmatch/i`;
  - `SUBSEQUENT_MATCH` requires amendment language:
    `/\bamend|\bmodif|\brevis|change to the terms|new written
    notice/i`.
  Mismatch → review, typed `NO_SHOP_PERIOD_ROLE_UNCORROBORATED`. A
  quote satisfying BOTH the NOTICE and INITIAL_MATCH tables under its
  proposed role still resolves (corroboration is a veto on the
  proposed label, not a classifier); a quote satisfying only the OTHER
  role's table fails its own and queues.

- Out-of-enum `action_code`/`prerequisite_code` → explicit
  `pushOpenWorld`, typed reason (never the enum's problem to absorb).
- Materiality: **no new tier, no rank change.** `NOSOL-` already maps to
  `NO_SHOP_EXCEPTIONS`, rank 50, via the existing prefix table
  (`MATERIALITY_TABLE`, `candidate-resolution.js` ~line 451) — the
  ledger's own ranking. The
  `FIDUCIARY` tier (rank 40, empty prefixes) is NOT wired to anything
  here: fiduciary-exception claims ride NOSOL- at rank 50, and
  re-ranking them under FIDUCIARY is a Ben call this spec deliberately
  does not make (flagged one line in the PR body).
- **Second PR flag (audit M-6 — cross-deal conflation this slice would
  otherwise create silently):** `NO_SHOP_*_PERIOD_DAYS` canonical
  values are unit-blind bare digits (`'4'`) with `day_kind`
  attribute-only, per the pre-registered definitions. This slice is
  the FIRST publisher of these values, so any consumer keying on
  canonical_value alone (serving/market statistics, comparators) would
  equate 4 BUSINESS days with 4 calendar/unspecified days — a real
  economic difference (section 1's own argument in the hours context).
  PR body carries the line: "day_kind is attribute-only under the
  existing definitions; comparator and serving consumption of day_kind
  is a Ben call." Pinned here regardless of that call: the v1↔v2
  comparator for these three definitions MUST treat differing
  `day_kind` as material disagreement, never as agreement on the
  digit.
- Resolution receipt: `no_shop_period_parse_version` and the two
  corroboration-table versions thread into `receiptBody`, alongside the
  bumped `mapping_table_version` (audit M-6 pattern);
  `contract_vocabulary_digest` unchanged (section 1).

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` — same slice, mandatory)

The program invariant: the family lexicon grows in the SAME slice as the
family, because `LEXICON_FAMILY_UNCOVERED` blocks condition 2 and we do
not ship families pre-blocked when the patterns are knowable. Lexicon
version bump + content-hash re-pin; every entry carries a one-line
rationale; keys are the five registered concept keys (table-validation
test already enforces registration). Corpus groundings below are
verbatim production-quote fragments EXCEPT the two entries explicitly
labelled ungrounded (audit M-5). Regex bounding convention (audit C-2):
`lexical-disagreement-net.js` does NOT auto-bound `BOUNDED_REGEX`
patterns, so every `BOUNDED_REGEX` entry below carries its own explicit
`\b` prefix — "word-bounded" in this section always means the `\b` is
IN the printed pattern, never assumed from the module.

- **NOSOL-PROHIBIT** — `BOUNDED_REGEX
  /\bsolicit(s|ed|ing|ation|ations)?/i` (grounding: "(1)
  solicit", "not solicited in violation"); phrases "Acquisition
  Proposal", "Takeover Proposal", "Company Acquisition Proposal" (three
  separate pattern_ids — multi-form entries never share a literal `/`),
  "knowingly encourage", "knowingly facilitate", "no-shop" (grounding:
  "the No-Shop Period Start Date").
- **NOSOL-EXCEPT** — "Superior Proposal", "fiduciary duties" (both
  grounded; the production fragment "(b) Fiduciary Exception to No
  Solicitation Provision" grounds "fiduciary duties" and "Superior
  Proposal" co-occurrence, per audit M-5's reattribution), "fiduciary
  out" — **ungrounded market-standard tell: 0 corpus hits in
  `primary_quote` AND `region_full_text` across all provision_cards,
  retained as priced dead weight** (a dead pattern only narrows
  auto-pass; it is NOT a corpus grounding and the earlier misattributed
  grounding is withdrawn) — "bona fide", "unsolicited", "good faith"
  is EXCLUDED (priced: appears in efforts covenants, MAE definitions,
  and virtually every board-determination clause corpus-wide — the
  noise would pressure deletions, and deletions widen auto-pass; the
  retained tells co-occur in every production EXCEPT card examined).
- **NOSOL-NOTICE** — `BOUNDED_REGEX /\bnotif(y|ies|ied|ication)?/i`
  (grounding, verbatim production NOSOL-NOTICE card: "within 24 hours
  following the receipt thereof) notify Parent"); phrase "written
  notice". Priced: "written notice" also fires in match-window and
  administrative-notices text — veto-only cost is a queue item, never a
  wrong claim.
- **NOSOL-MATCH** — "right to match", "matching rights" —
  **ungrounded market-standard tell: 0 corpus hits, retained as priced
  dead weight (audit M-5)** — "Notice Period" (grounding: "(the
  'Notice Period')"), "last look" (grounding: "(d) 'Last Look'."),
  "days in advance" (grounding: "four (4) business days in advance",
  "five Business Days in advance").
- **NOSOL-REMATCH** — "material amendment", "material modification",
  "material revisions", "new written notice" (all four verbatim in
  production REMATCH cards: "in the event of any material amendment or
  material modification … shall be required to deliver a new written
  notice").
- **Priced exclusions (recorded blind spots, deletion-asymmetry
  doc-comment updated):** naked "proposal", "offer", "notice", "match",
  "encourage", "facilitate", "negotiate" — each floods sections far
  outside the family (e.g. "propose" in every covenant; "match" inside
  unrelated words is already blocked by word boundaries but "notice"
  fires in Article-IX notices boilerplate). The residual blind spot — a
  no-shop section whose ONLY tells are those naked words — is priced:
  no such section exists among the 33 production deals' cards examined
  (every one carries "Acquisition Proposal"/"Takeover Proposal" or a
  solicit-stem), and the v1 comparator plus open-world path cover the
  shape. Also excluded: "Intervening Event", "Change of Recommendation",
  "Adverse Recommendation Change" — real tells, but of NOSOL-INTERVENING
  / NOSOL-RECOMMEND, which have NO registered v2 concept; keying them
  under a covered family would make the wrong family's veto fire and
  misdirect review (a hit under the wrong family key is worse than an
  uncovered family, which at least blocks honestly).
- Anti-noise regression paragraph (lexicon test 8 convention) extends
  with three test sentences, each with its EXACT expected hit set
  pinned per sentence (audit C-2 — the earlier blanket pin "the
  solicit/notify stems DO fire there … the phrases must NOT fire" was
  self-contradictory: "unsolicited" is itself a NOSOL-EXCEPT phrase and
  fires on the second sentence, and a genuinely `\b`-bounded solicit
  stem cannot fire inside "unsolicited"):
  - "solicitation of proxies" → the NOSOL-PROHIBIT `\bsolicit` stem
    fires (known queue cost, pinned); no phrase entry fires.
  - "unsolicited communications" → the NOSOL-EXCEPT phrase
    "unsolicited" fires (known queue cost, pinned); the NOSOL-PROHIBIT
    `\bsolicit` stem does NOT fire (word boundary — "solicit" here
    begins mid-word).
  - "notify the other party pursuant to Section 9.02" → the
    NOSOL-NOTICE `\bnotif` stem fires (known queue cost, pinned); no
    other entry fires.
  All hits are known-queue costs, not silent surprises; all non-hits
  are asserted absent.

## 6. Acceptance tests (real-fixture-first; pre-rerun honesty pins)

No recorded native runs exist for this family. The P1 audit M-5 pins
apply verbatim: synthetic compiled candidates drive the
resolver/registry layers, pinned to REAL quotes byte-verified against
committed canonical text, clearly labeled as the pre-rerun harness; no
report before the dated post-merge live rerun handoffs may claim native
no-shop extraction.

1. **Fixture commitment.** Commit the no-shop governed-section canonical
   text for the three deals already in the native fixture set,
   byte-extracted from their committed source documents (never retyped,
   LTR/zero-width marks preserved). The COVERAGE MAP is hand-enumerated
   from those LITERAL bytes: expected action codes, prerequisite codes,
   and period values per section, each expected quote asserted to be a
   contiguous byte-substring of the committed text. Production-DB
   quotes in this spec are design grounding only — the tests never read
   the DB.
2. **Parser, table-driven:** "four (4) business days" → `'4'` /
   BUSINESS_DAYS (the one-intervening-`)` rule, audit C-1); "5 Business
   Days'" (trailing possessive) → `'5'` / BUSINESS_DAYS; "ten (10)
   business days" → `'10'`; bare-"days" form → CALENDAR_DAYS while
   preserving the bare unit phrase; a
   "(the 'Notice Period')"-before-unit form → `PERIOD_UNIT_UNCORROBORATED`
   (audit C-1 ABSTAIN fixture); "within 24 hours" and "within
   forty-eight (48) hours" and "96 hours" → `PERIOD_UNIT_HOURS`;
   "three (3) Business Days instead of five (5) Business Days" →
   `MULTIPLE_PERIOD_LITERALS`; "five Business Days" (spelled-only) →
   `NON_LITERAL_NUMERAL`; "Section 5.3(d)(ii)(2)", "Rule 14d-9",
   "Rule 14e-2(a)", and — as its own table row (audit M-4, the
   no-interior-letter citation) — "Item 1012(a) of Regulation M-A",
   "20% or more", dates, currency, clock times all excluded; the
   spelled-restatement collapse yields exactly one candidate; grouping
   and non-integer rejects.
3. **Registry:** compiled bundle byte-identical — zero vocabulary
   change asserted positively (digest pin unchanged).
4. **Resolution:** synthetic candidates per generic key resolve
   end-to-end onto the right concept/definition; every corroboration
   veto exercised with a real-quote fixture (an INITIAL_MATCH-worded
   quote proposed as NOTICE fails `NO_SHOP_PERIOD_ROLE_UNCORROBORATED`;
   a `SOLICIT_*` code on a furnish-information quote fails
   `NO_SHOP_ACTION_UNCORROBORATED`; a `SOLICIT_*` code on an
   "unsolicited"-containing quote fails `NO_SHOP_ACTION_UNCORROBORATED`
   — the `\b`-bounded stem must not match inside "unsolicited", audit
   M-2); attribute-verbatim failures typed;
   out-of-enum code exercises the explicit `pushOpenWorld` path;
   materiality rank 50 via the EXISTING prefix row (no table diff);
   review routing for every ABSTAIN class; additivity re-pin with
   field-level diff documented (section 1).
5. **Identity:** initial five-day and renewed three-day windows in one
   section mint distinct stable identities (distinct concepts via
   distinct generic keys — could never collide; asserted for receipt
   legibility); the LOAD-BEARING half (audit m-3): two prerequisite
   codes on ONE exception (same section, same concept, same
   definition) mint distinct identities via the `prerequisite_code`
   attribute-identity pin.
6. **Write-path:** one resolved claim of each definition travels
   adapter → validation → publishableWriteSet.
7. **Lexicon:** table validation (registered keys, bounded regexes ≤128
   static max, ids + rationales, content hash re-pinned); anti-noise
   paragraph (section 5); determinism permutation tests unchanged;
   multi-section fixture where the no-shop section's receipt now covers
   the five families and `LEXICON_FAMILY_UNCOVERED` still blocks
   NOSOL-INTERVENING-shaped claims (uncovered stays honest).
8. Full suite + build + forbidden-patterns; phase allowlist for the
   slice's files; quote verification at zero flags.
9. **Post-merge (its own dated handoff, not this slice's tests):** one
   documented fresh live run per fixture deal (subscription CLI);
   golden recordings minted from those runs only.

## Out of scope

- The twelve v1 NOSOL subtypes with no registered v2 concept:
  RECOMMEND, INTERVENING, SUPERIOR, ACQPROPOSAL, CEASE, DISCLOSE,
  NEGOTIATE, CONFID, INFORMATION, ENFORCE, WAIVER, WINDOW (go-shop —
  1 card / 1 deal). Their promotion is a registry-growing slice
  (concepts + definitions + Ben's taxonomy call on SUPERIOR/ACQPROPOSAL
  as DEFINITION-kind concepts vs covenant claims), not this wiring
  slice. The producer prompt names them open-world-for-now.
- `NO_SHOP_COPY_DELIVERY_PERIOD_DAYS` and the semantic-schema record
  shapes (`NO_SHOP_ACTION_OCCURRENCE`, `NO_SHOP_EXCEPTION_EFFECT`,
  `NO_SHOP_NOTICE_OBLIGATION` completeness machinery) — those remain
  the legacy-derived path's; the native producer does not mint
  semantic-schema records this slice.
- Hour-denominated notice obligations as publishable claims (typed
  review via `PERIOD_UNIT_HOURS`; an ELAPSED_HOURS definition is a
  future Ben adjudication).
- Spelled-number resolution table (`NON_LITERAL_NUMERAL` queue cost
  accepted).
- `FAMILY_MAPPING_TABLE` extension (separate Fable+Ben table edit with
  the wiring slice, per P1).
- Any re-ranking of fiduciary-exception materiality (rank-40 FIDUCIARY
  tier stays unwired; one-line PR flag).

## Known costs, stated up front

- Spelled-only day counts ("five Business Days in advance") ABSTAIN and
  queue — observed in production, so a real recurring queue item until
  a Ben-ratified spelled-number slice.
- Hour-denominated notice periods (the MOST COMMON notice form: 24/48/96
  hours) never publish under `NO_SHOP_NOTICE_PERIOD_DAYS`; they queue
  typed. The alternative — silent unit conversion — is the
  reads-as-correct corruption this family is most exposed to.
- The solicit/notify lexicon stems will fire in proxy-solicitation and
  administrative-notice text inside scanned sections; veto-only design
  means the cost is queue items, never wrong claims; queue data prices
  the refinement.
- Period-role corroboration is a veto, not a classifier: a mislabeled
  role whose quote happens to satisfy the proposed role's table can
  still resolve. The backstop is the v1↔v2 comparator (v1's
  NOSOL-MATCH/NOTICE cards disagree loudly on exactly this) and Ben's
  ranked queue at rank 50.
- Twelve subtypes stay open-world; the commonality report keeps
  presenting them until their registry slice — the honest family-by-
  family shape of the work.
