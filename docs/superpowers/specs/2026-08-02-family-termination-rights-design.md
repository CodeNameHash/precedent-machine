# Family spec — Termination rights (TERMR-*)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit
2026-08-02 returned AMEND (3 CRITICAL, 4 MATERIAL, 6 MINOR); all findings
folded below (fixes applied; one audit sub-claim rebutted with evidence at
m-1/Drop Dead Date). Ready for build per program convention
(spec-detail → audit → build → review).
**Parent:** `2026-08-02-openworld-promotion-program.md` (family-track sibling
of P1–P4; follows the five-layer promotion structure).
**Conventions bound:** `2026-08-02-p1-captable-numerics-design.md` (slice
template), `2026-08-02-lexical-disagreement-net-design.md` (lexicon rules),
EXECUTION-LEDGER M3 review protocol + extraction semantics rules 1–3 (this
spec may not amend them).
**Materiality:** rank 10 `TERMINATION_RIGHTS` — the protocol's TOP review
tier. Nothing in this family is low-stakes; every ambiguity here errs toward
review, never toward publish.

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`,
read 2026-08-02)

v1 `provision_cards` with `provision_type = 'TERMINATION_RIGHT'`:

| v1 subtype | cards | deals |
| --- | --- | --- |
| (null) | 76 | 19 |
| TERMR-PREAMBLE | 53 | 40 |
| TERMR-RECOMMEND | 40 | 35 |
| TERMR-BREACH-B | 36 | 30 |
| TERMR-OUTSIDE | 35 | 35 |
| TERMR-MUTUAL | 35 | 35 |
| TERMR-BREACH-T | 34 | 32 |
| TERMR-SUPERIOR | 32 | 31 |
| TERMR-VOTE | 30 | 26 |
| TERMR-LEGAL | 28 | 28 |
| TERMR-EXTENSION | 1 | 1 |

Representative primary_quote texts (verbatim from production; every concept,
corroboration pattern and lexicon entry below is grounded in one of these or
a sibling quote — no fabricated examples):

- OUTSIDE: "the Merger has not been consummated on or before November 22,
  2021 (the \"Outside Date\")"; "shall not have occurred by 11:59 p.m.,
  Eastern time, on November 30, 2024 (the \"Termination Date\")"; "on or
  before 5:00 p.m. Houston time, on April 30, 2021(such date, the \"End
  Date\")"; "on or before December 31, 2016 (the \"Outside Date\")".
- MUTUAL: "by mutual written consent of the Company and Parent by action of
  their respective boards of directors."
- BREACH (cure periods): "which is not cured within the earlier of (1) the
  Outside Date and (2) 30 days following written notice to Parent"; "shall
  not have been cured within 30 days after written notice thereof"; "written
  notice of such breach, delivered at least 45 days prior to such
  termination (or such shorter period of time…)".
- VOTE: "if the Company Shareholder Approval shall not have been obtained by
  reason of the failure to obtain the required vote at a duly held Company
  Shareholders M[eeting]"; "the Company Stockholders' Meeting (including any
  adjournments thereof) shall have concluded and the Company Stockholder
  Approval shall not have been obtained".
- LEGAL: "any permanent injunction or other judgment or order issued by a
  Governmental Authority of competent jurisdiction … preventing the
  consummation of the Merger".
- SUPERIOR: "the Company Board has determined that an Acquisition Proposal
  constitutes a Superior Proposal … (y) the Company pays, or causes to be
  paid, to Parent the Termination Fee".
- RECOMMEND: "(d) by Parent in the event that: …" (section titled "Change of
  Recommendation").

**Corpus defect observed and pinned:** the longest TERMR-VOTE card (deal
`8cd0787f…`, section "9.1(y) | Stockholder Vote Failure") quotes
outside-date EXTENSION machinery ("the End Date will be automatically
extended to April 30, 2026 …"), not a vote-failure right. v1 labels are
UNTRUSTED input to this design: every corroboration table below exists
because the corpus itself demonstrates label↔text drift inside this family.

**Vocabulary mismatch, named:** the v1 rubric says TERMR-VOTE /
TERMR-BREACH-T / TERMR-BREACH-B; the registered v2 vocabulary
(contract-bundle.js V2_ADDED_CONCEPTS, Ben-approved 2026-07-23) says
TERMR-NOVOTE and a single party-agnostic TERMR-BREACH. The registered keys
win. Party attribution (who terminates) is a GOVERNED ATTRIBUTE, never a key
suffix — and the v1 suffix trap is pinned for implementers: in v1,
`TERMR-BREACH-T` names the BREACHING party (target breach → BUYER
terminates; see `lib/parser-v2/extract.js` ~196–201 and ~260–264). Any
mapping that reads -T as "target terminates" inverts the legal substance of
30+ deals. The v2 design never reproduces the suffix; it carries the
terminator explicitly.

## Deliverable (honest conversion semantics)

There are NO recorded native-producer runs over termination sections — the
producer today extracts only capitalisation sections (F28/Skechers/Modiv
recordings). So this family has NOTHING to "convert": no open-world fixture
rows, no closure_ids to track. The deliverable is the five-layer capability
plus a pre-rerun harness:

1. Registry, resolver, parsers, prompt module, provider keys and lexicon
   entries land fully tested against a COVERAGE MAP of synthetic compiled
   candidates pinned to REAL corpus quotes committed as fixture bytes
   (section 6).
2. "The pipeline natively extracts termination rights" may be claimed ONLY
   after dated post-merge live rerun handoffs (subscription CLI, one
   documented run per fixture deal). The P1 audit M-5 pins apply verbatim:
   no report before those handoffs may state family conversion, coverage,
   or recall. Until then the honest claim is "the machinery exists and is
   proven on committed fixtures".

## 1. Registry (`contract-bundle.js` → V15)

Strictly additive spread of V14 (`FIXTURE_CONTRACT_INPUT_V15`), following
the V13→V14 pattern at ~2829.

**Concepts.** Six of the eight trigger families are ALREADY registered:
`TERMR-OUTSIDE`, `TERMR-BREACH`, `TERMR-NOVOTE`, `TERMR-NOSOL-BREACH` (V2,
Ben-approved 2026-07-23) and `TERMR-RECOMMEND`, `TERMR-SUPERIOR` (V1). New
concepts, version 1, `{concept_key, version}` shape only (the fixture-shape
validator at ~3255 rejects anything else):

- `TERMR-MUTUAL` — termination by mutual written consent. 35 deals.
- `TERMR-LEGAL` — termination for permanent legal restraint/injunction
  preventing consummation. 28 deals.

This grows `EXPECTED_CONCEPT_KEYS_V3` → `EXPECTED_CONCEPT_KEYS_V4` (sorted
superset; V15's version-shape row uses V4, all prior rows untouched
byte-for-byte). Both new concepts are FLAGGED FOR BEN in the PR body under
the same convention as the 2026-07-23 concept amendment — concept-key
additions are taxonomy decisions, and this spec proposes rather than
settles them. NOT added: `TERMR-EXTENSION` (n=1, and the single card quotes
a boilerplate "Extension; Waiver" section — a v1 misclassification, flagged
in Out of scope), `TERMR-PREAMBLE` (the article chapeau is structure, not a
right — the P1 precedent that limb structure stays out of the claim
vocabulary applies).

**Claim definitions** (three; the family's facts are one presence claim and
two mechanical values):

```
TERMINATION_RIGHT_GRANT_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_RIGHT_GRANT'
  version: 1
  allowed_canonical_values: [true]          // presence claim, the
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

TERMINATION_OUTSIDE_DATE_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_OUTSIDE_DATE'
  version: 1
  canonical_value_type: 'ISO_8601_DATE_STRING'   // existing type
  canonical_value_required_when_present: true

TERMINATION_CURE_PERIOD_DAYS_CLAIM_DEFINITION_V1
  claim_definition_key: 'TERMINATION_CURE_PERIOD_DAYS'
  version: 1
  canonical_value_type: 'NON_NEGATIVE_DECIMAL_STRING'  // existing type
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes.

Three new claim definitions also grow the expected-claim-keys row (audit
m-4): `EXPECTED_CLAIM_KEYS_V15` — sorted superset of the V14 row at
contract-bundle.js ~2901, all prior rows untouched byte-for-byte, same
pattern as the concept-keys growth above; covered by the test 3
superset-diff.

**Governed attributes (never in keys; all participate in claim identity so
two same-section rights never collide or dedupe):**

- `trigger_kind`: enum `MUTUAL_CONSENT | OUTSIDE_DATE | VOTE_FAILURE |
  BREACH | LEGAL_RESTRAINT | SUPERIOR_PROPOSAL | RECOMMENDATION_CHANGE |
  NO_SOLICITATION_BREACH` — the eight registered-concept triggers. The enum
  is a gate, not a suggestion: out-of-enum → explicit `pushOpenWorld` with
  a typed reason (the P1 C-4 precedent; the main loop's open-world routing
  keys on proposal_kind and will not catch it).
- `terminating_party_scope`: enum `EITHER_PARTY | ONE_PARTY`. **This is the
  legal substance the family exists to capture** — a mutual right and a
  one-sided right are different market data points. Corroborated against
  quote text (section 4), never trusted from the label.
- `terminating_party_ref`: verbatim party phrase from the quote ("either
  Parent or the Company", "the Company", "Parent"). Required; must be a
  verbatim substring of the byte-verified quote (P1 M-3 precedent), failure
  → review, typed `TERMINATING_PARTY_REF_NOT_IN_QUOTE`. No cross-deal party
  canonicalization this slice.
- `TERMINATION_OUTSIDE_DATE` additionally: `deadline_term_ref` — the
  verbatim defined-term phrase ("Outside Date", "End Date", "Termination
  Date"), required, verbatim-substring-enforced, typed
  `DEADLINE_TERM_REF_NOT_IN_QUOTE` on failure. Cross-deal normalization of
  the three defined-term spellings is a Ben adjudication over observed
  values later, not an implementer guess now (the share_class_ref
  precedent, verbatim).
- `TERMINATION_CURE_PERIOD_DAYS` additionally: `day_kind` — enum
  `CALENDAR | BUSINESS`, corroborated (section 4) — AND `period_kind` —
  enum `CURE | NOTICE`, participating in claim identity (audit M-1). The
  corpus refutes a cure-only reading: only 18/70 v1 breach cards contain
  "cured within" while 65/70 mention "notice" — the notice-delivery window
  ("written notice of such breach, delivered at least 45 days prior to
  such termination") is the DOMINANT drafting, and it is a different legal
  fact from a cure period. Without the split, the cross-deal cure
  statistic this value feeds is systematically polluted, silently, once
  nets are clean. `period_kind` is corroborated against the parser's
  `matched_text` context (section 4); a cure claim and a notice claim in
  the same section never collide or dedupe.

## 2. Value parsers (two pure modules, `measurement-date-parse.js` contract
shape: typed `{outcome:'RESOLVED', …}` / `{outcome:'ABSTAIN', reason}` —
never a throw on prose, never arithmetic, never repair)

### 2a. `termination-deadline-parse.js`

Resolves the outside date. Reuses the CALENDAR grammar of
`measurement-date-parse.js` (literal "<Month> <Day>, <Year>",
real-month-length validation, leap years — "February 30, 2026" ABSTAINs
`INVALID_CALENDAR_DATE`, never wraps). The SYMBOLIC path is NOT reused:
there is no governed source for an outside date other than its own literal
text; symbolic phrases ABSTAIN `NO_CALENDAR_DATE`.

- The byte-verified quote must contain EXACTLY ONE calendar date after the
  pinned exclusions. Exclusions (P1 tokenizer discipline): section
  references; clock times — the corpus deadlines carry "11:59 p.m.,
  Eastern time, on November 30, 2024" and "5:00 p.m. Houston time, on
  April 30, 2021" (note: NO space before "(such date" in the committed
  bytes — tests run on literal fixture bytes, never retyped ASCII);
  currency literals.
- Two or more surviving dates → ABSTAIN `MULTIPLE_CALENDAR_DATES` → review.
  This is the extension-proviso case, observed live: "the End Date will be
  automatically extended to April 30, 2026" inside an initial-deadline
  section. The parser NEVER picks the operative deadline between an
  initial and an extended date — that is a legal reading, and the producer
  prompt is responsible for quoting the initial-deadline sentence alone
  (section 3). Extension mechanics themselves are out of scope.
- Zero dates → ABSTAIN `NO_CALENDAR_DATE` (covers definitional
  cross-references like "\"End Date\" has the meaning set forth in Section
  8.2(a)" — observed in corpus; a pointer is not a date).
- Canonical form: `YYYY-MM-DD`, round-trips `ISO_8601_DATE_STRING`.
- Versioned `TERMINATION_DEADLINE_PARSE_VERSION`, threaded into the
  resolution receipt (P1 M-6 precedent).

### 2b. `cure-period-parse.js`

Resolves breach-cure / notice-period day counts.

- RESOLVES: a literal integer immediately governing a day word —
  corpus forms "30 days following written notice", "cured within 30 days
  after written notice", "45 days prior to such termination". Candidate
  tokens are digit runs whose next word (whitespace/parenthesis tolerant)
  is a day word — `day`/`days`/`Days`/`Business Day`/`Business Days`/
  `business day`/`business days` (singular and bare-capitalized forms
  included per audit m-5; a missed variant is a harmless
  ABSTAIN→review, but cheap to pin); all other numerics (section
  refs, dates, clock times, currency) are excluded by the P1 exclusion
  grammar and are not candidates.
- The hybrid form "thirty (30) days": the parenthesized DIGIT is the
  candidate (literal extraction, not repair). If the immediately preceding
  word is a spelled numeral in a frozen word→value table (one…ninety, the
  plausible cure-period range) and its value differs from the digit →
  ABSTAIN `SPELLED_DIGIT_MISMATCH` → review. A spelled numeral with NO
  adjacent digit → ABSTAIN `NON_LITERAL_NUMERAL` (never a lookup-and-
  resolve: the table exists only to detect contradiction, not to read
  numbers — reading spelled numbers is one step from arithmetic).
- Two or more surviving day counts → ABSTAIN `MULTIPLE_DAY_COUNTS` → review
  (a quote spanning both a cure period and a notice period is TWO claims;
  the producer splits, the parser never picks — P1 rule verbatim). Zero →
  ABSTAIN `NO_DAY_COUNT`.
- Neither `day_kind` nor `period_kind` is decided here — the parser
  returns `matched_text` including the day word plus surrounding context
  (the governing clause window around the day count); the resolver
  corroborates both labels against it (section 4).
- Canonical form: decimal string, no grouping expected at this magnitude;
  strict digits (`^\d+$` after extraction). Versioned
  `CURE_PERIOD_PARSE_VERSION`, threaded into the receipt.

Neither parser ever computes: "the earlier of (1) the Outside Date and
(2) 30 days following written notice" resolves as the 30-day count with the
earlier-of structure preserved in the quoted evidence — the comparative is
legal text for the reviewer, not an operand.

## 3. Producer prompt + provider

**New prompt MODULE: `termination-producer-prompt.js`.** The
capitalisation prompt is NOT edited (its PROMPT_VERSION does not move; its
recorded fixtures stay byte-identical).

**Dispatch seam — designed HERE, because it does not exist yet (audit C-3).**
The earlier draft cited "the existing section-scope mechanism (the P4 REIT
precedent)"; that was wrong on both counts — P4 is an unbuilt design-only
slice (only P1 has landed; the bundle tops out at V14), and
`native-extraction-run.js` hard-requires `buildCapitalisationProducerPrompt`
(lines ~143, ~387): one prompt, one governed scope, no per-family selection
seam. The `lib/parser-v2/classify.js` TERMR/TERMF split belongs to the v1
parser — a different pipeline — and the native
`deterministic-sectionizer.js` carries no family classification at all.
This slice therefore builds the seam explicitly:

- **`producer-prompt-registry.js`** — a frozen Map
  `section_family → prompt module` with exactly two entries this slice:
  `CAPITALISATION → buildCapitalisationProducerPrompt` (unchanged,
  byte-identical behavior for capitalisation sections — recorded fixtures
  replay byte-identical, acceptance test 6) and
  `TERMINATION → buildTerminationProducerPrompt`. Unknown family → the
  section is NOT sent to any producer (fail closed: no prompt, no
  candidates, no silent fallback to the capitalisation prompt).
- **Native-side section-family classifier — two-stage, AI-assisted with
  flagged provenance (BEN RULING 2026-08-02, amending the original
  title-rules-only design):**
  1. STAGE 1, deterministic: title regexes ported from, and tested
     against, the v1 `lib/parser-v2/classify.js` TERMR/TERMF title split
     (~498-510, incl. the TERMF exclusion so fee sections never reach
     this prompt). A stage-1 match classifies with provenance
     `SECTION_FAMILY_RULE_CLASSIFIED`.
  2. STAGE 2, AI-assisted: sections stage 1 leaves unmatched MAY be
     classified by a bounded model call (same provider seam disciplines:
     typed failure on malformed response, never an empty success). An
     AI classification carries provenance
     `SECTION_FAMILY_AI_CLASSIFIED`, which travels — run receipt,
     every downstream candidate's extraction_provenance, and the
     review-queue item — so the flag is VISIBLE IN OUTPUT per Ben's
     ruling, mirroring the existing MECHANICAL/AI/VERIFIED provenance
     tag convention. AI-classified sections' claims NEVER auto-pass
     while the classification is unverified (a typed
     `SECTION_FAMILY_AI_UNVERIFIED` condition in
     `unevaluated_conditions`, cleared only by a human confirming the
     family or a later rule-classified re-run agreeing).
  3. AI declines / no confident family / unknown family → the section
     is dispatched to NO producer (fail closed, unchanged).
  Its own `SECTION_FAMILY_CLASSIFIER_VERSION` (and the stage-2 prompt's
  own version), threaded into the run receipt alongside the prompt
  versions. Stage 1 is validated against ALL deals' section titles (the
  classify-rules safety check) before dispatch; stage 2's accuracy is
  measured against stage-1-classified sections as a golden baseline
  (agreement rate reported per run) before Ben relies on the flag.
- `native-extraction-run.js` is refactored to select prompts through the
  registry; the hard-required capitalisation import becomes one registry
  entry. This refactor is in-slice, spec'd here, and covered by test 6's
  byte-identical capitalisation replay.

- Own `TERMINATION_PROMPT_VERSION = 1`, bumped once per slice, never
  mid-slice.
- Response shape: a `termination_right_assertions` array — each element
  `{ section_reference, assertion_kind: 'RIGHT_GRANT' | 'OUTSIDE_DATE' |
  'CURE_PERIOD', trigger_kind, terminating_party_scope,
  terminating_party (verbatim phrase), deadline_term (verbatim, OUTSIDE_DATE
  only), day_kind and period_kind (CURE_PERIOD only), verbatim quote }`. One element per
  legal fact: a breach right with a cure period is TWO elements (the grant,
  the cure count) each with its own single-fact quote — the prompt owns the
  split so the parsers' one-candidate rules are satisfiable, exactly as the
  P1 compound-sentence rule.
- Prompt instructions pinned: quote the INITIAL deadline sentence for
  outside dates (extension provisos are separate open-world candidates);
  when unsure of trigger_kind or party scope, keep the assertion in
  `open_world_candidates` — PRESERVE-THE-NOVEL is retained verbatim;
  promotion narrows novelty, never forces fit. The producer never asserts
  a negative (M3 rule 1): "no termination right for X" is never emitted;
  absence stays with the future scope-closure machinery.
- **Provider (`anthropic-provider.js`):** new generic key
  `NATIVE_TERMINATION_RIGHT_CANDIDATE`, proposal_kind `TERMINATION_RIGHT`
  (≠ OPEN_WORLD). `termination_right_assertions` is deliberately NOT added
  to `REQUIRED_RESPONSE_LISTS` — the share_count precedent at ~83–89
  verbatim: every recorded pre-existing response fixture predates the key;
  missing/non-array reads as empty list, never a schema failure. Quote
  byte-verification identical to existing proposals.
- Golden evals: recorded-response fixtures are never hand-edited to
  pretend old runs emitted the new shape; the new shape enters recordings
  only via fresh live runs (the dated handoffs of the Deliverable section).

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE resolution-table entry** (P1 audit M-2: `RESOLUTION_UNCONDITIONAL`
  is a Map keyed on generic_claim_key alone; two entries would silently
  last-win): `NATIVE_TERMINATION_RIGHT_CANDIDATE`, deterministic_kind null,
  attachment_position null, `registered_claim_definition_key: null` (the
  SHARE_COUNT precedent at ~344–362 — the handler makes the definition
  split; the table entry only distinguishes "route to handler" from "no
  entry, open world"). Row shape pinned against the REAL SHARE_COUNT row
  (audit m-3): the precedent row also carries `concept_key`,
  `party_field`, `party_role` — this row pins `concept_key: null`
  explicitly (with a build-time check that nothing reads
  `mapping.concept_key` before the handler's trigger map runs),
  `party_field: 'terminating_party'`,
  `party_role: 'TERMINATION_RIGHT_HOLDER'`. The concept split is made in the handler on
  `attributes.trigger_kind` via a frozen map:
  `MUTUAL_CONSENT→TERMR-MUTUAL, OUTSIDE_DATE→TERMR-OUTSIDE,
  VOTE_FAILURE→TERMR-NOVOTE, BREACH→TERMR-BREACH,
  LEGAL_RESTRAINT→TERMR-LEGAL, SUPERIOR_PROPOSAL→TERMR-SUPERIOR,
  RECOMMENDATION_CHANGE→TERMR-RECOMMEND,
  NO_SOLICITATION_BREACH→TERMR-NOSOL-BREACH`. Out-of-enum trigger_kind →
  explicit `pushOpenWorld`, typed reason. The definition split is made on
  `assertion_kind` (RIGHT_GRANT / OUTSIDE_DATE / CURE_PERIOD); OUTSIDE_DATE
  assertions with trigger_kind ≠ OUTSIDE_DATE, and CURE_PERIOD assertions
  with trigger_kind ∉ {BREACH, NO_SOLICITATION_BREACH} → review, typed
  `ASSERTION_TRIGGER_INCOHERENT` (a cure period hanging off a mutual-
  consent right is a label error, not a resolvable claim).
  `MAPPING_TABLE_VERSION` 4 → 5; table-validation test still asserts no
  duplicate generic keys.
- **trigger_kind corroboration table** (frozen; labels could mislabel —
  the corpus's own TERMR-VOTE/extension defect is the proof). The
  byte-verified quote must match the kind's pattern; mismatch → review,
  typed `TRIGGER_KIND_UNCORROBORATED`. Patterns grounded in the quoted
  corpus text above, word-bounded, case as shown:
  - `MUTUAL_CONSENT` ↔ /mutual written (consent|agreement)/i — the
    "agreement" alternative added per audit M-2: "by mutual written
    agreement of Parent and the Company" is a recurring verified corpus
    form; /mutual written consent/i alone matched only 24/35 mutual deals.
  - `OUTSIDE_DATE` ↔ "Outside Date" | "End Date" | "Termination Date"
    (case-sensitive defined-term literals) | /not (been )?(consummated|
    occurred) on or (before|prior to)/i
  - `VOTE_FAILURE` ↔ /(Stock|Share)holder Approval/ (case-sensitive) AND
    /not (have )?been obtained|shall not have been obtained|not obtained/i
  - `BREACH` ↔ /breached|failed to perform|breach of|breach by/i — the
    noun forms added per audit M-2: /breached|failed to perform/i alone
    matched only 28/70 v1 breach quotes; the dominant corpus drafting is
    the noun form ("there shall have been a breach of any of the
    covenants or failure to be true…").
  - `LEGAL_RESTRAINT` ↔ /injunction|restrain|prohibit|preventing the
    consummation/i — `restrain` and `prohibit` are PREFIX STEMS exempt
    from the word-bound rule (audit m-6): word-bounded they would miss
    the corpus noun forms "restraint or prohibition"; un-bounded stems
    achieve the measured 27/28 recall.
  - `SUPERIOR_PROPOSAL` ↔ "Superior Proposal" (case-sensitive)
  - `RECOMMENDATION_CHANGE` ↔ /Adverse Recommendation|Change of
    Recommendation|Change in Recommendation|Company Board Recommendation/
    (case-sensitive) — /Change in Recommendation/ (6 cards) added per
    audit M-2; the head alternative /Adverse Recommendation/ already
    covers the 14 "Adverse Recommendation Change" cards. The three
    original literals alone hit only 26/40.
  - `NO_SOLICITATION_BREACH` ↔ **NO corroboration pattern this slice —
    always review**, typed `TRIGGER_KIND_UNCORROBORATED` (audit M-3). The
    earlier draft's /Section 6\.02/ alternative was a silently-WIDENING
    gate: corroboration PASS resolves and publishes, so in any deal where
    6.02 is not the no-shop, a mislabelled quote containing /breach/i
    plus an incidental "Section 6.02" cross-reference would mint
    TERMR-NOSOL-BREACH at rank 10. Since the family has ZERO grounded
    corpus text (section 5 — no v1 subtype exists), the resolver is
    symmetric with the lexicon: this trigger_kind queues unconditionally
    until grounded text exists and a corroboration pattern is authored in
    a reviewed diff.
  **Measured residual review rates, priced (audit M-2):** even with the
  recall fixes above, corroboration on correctly-labelled claims is not
  free — the pre-fix measurements were BREACH 28/70, MUTUAL 24/35,
  RECOMMEND 26/40 (~40–60% review in the top-rank family); the added
  patterns close the measured gaps, and the live-run handoffs re-measure
  the residual rate as a recorded cost, alongside the chapeau-scope cost
  already priced in Known costs.
  The observed corpus defect resolves correctly under this table: the
  extension-machinery quote labelled VOTE_FAILURE fails the VOTE pattern
  pair → review, exactly where a mislabeled top-tier provision belongs.
- **Party scope corroboration** (party attribution is legal substance;
  a mutual right recorded as one-sided corrupts the market statistic this
  family feeds):
  1. `EITHER_PARTY` ↔ /by either/i or /mutual written (consent|agreement)/i
     present in the quote (the "agreement" alternative per audit M-2 —
     without it the "by mutual written agreement" deals double-queue,
     failing both the MUTUAL corroboration and this pattern pair).
  2. `ONE_PARTY` is corroborated ONLY when ALL THREE hold:
     (a) the either-pattern is ABSENT; (b) `terminating_party_ref`
     resolves via the existing `PARTY_CAPACITY_LEXICON`/`resolveParty`
     (party_field `terminating_party`, new party_role
     `TERMINATION_RIGHT_HOLDER`); and (c) — audit C-2, the positional
     gate — the byte-verified quote matches `by <ref>` or
     `<ref> may terminate` (word-bounded, anchored on the verbatim
     `terminating_party_ref`; both grammatical forms verified in corpus:
     "(e) by the Company, if…", "Columbus may terminate"). Failure of (c)
     → review, typed `TERMINATING_PARTY_REF_UNCORROBORATED`. Rationale:
     every breach quote names BOTH parties by construction ("(f) by
     Parent, if there shall have been a breach … on the part of the
     Company"), so the verbatim-substring gate and `resolveParty` alone
     pass a producer that SWAPS terminator and breaching party — the
     exact -T/-B inversion this spec pins as corrupting the legal
     substance of 30+ deals. The positional gate makes the swap fail:
     the breaching party's phrase does not sit in the `by <ref>` /
     `<ref> may terminate` position.
     Ordering pin: the either-check runs FIRST — "by either Parent or the
     Company" contains both one-sided party words, and first-match party
     resolution would silently mint a one-sided TARGET right from a mutual
     quote. A ONE_PARTY label on a quote containing the either-pattern →
     review, typed `PARTY_SCOPE_UNCORROBORATED`.
  3. `EITHER_PARTY` claims do not call `resolveParty` (it resolves one
     party; a mutual right has two). They mint party
     `{role: 'TERMINATION_RIGHT_HOLDER', capacity:
     'EITHER_PRINCIPAL_PARTY', value: <the verbatim
     terminating_party_ref>}` — e.g. `value: 'either Parent or the
     Company'`. All THREE keys are required (audit C-1):
     `validate-write-set.js:793–801` enforces the provision party as
     exactly `{capacity, role, value}`, each a non-empty string, and
     `resolveParty` always mints all three — a two-key party would throw
     "party must match its closed contract" on every one of the 35
     mutual-consent deals. `value` is already verbatim-enforced via the
     `terminating_party_ref` substring gate, so no new validation is
     needed. `EITHER_PRINCIPAL_PARTY` remains a NEW governed capacity
     value, strictly additive, FLAGGED FOR BEN in the PR body (same
     convention as the REPRESENTATIONS materiality-tier flag): inventing
     a capacity is a vocabulary call this module is making, not one
     already made.
     `resolveParty` returning null on ONE_PARTY → review,
     `PARTY_UNRESOLVED`, unchanged.
- **Handler order** (the SHARE_COUNT/TEMPORAL pattern): trigger_kind
  corroboration → party-scope corroboration → attribute verbatim checks →
  assertion/trigger coherence → per-assertion_kind branch: RIGHT_GRANT
  resolves canonical_value `true`; OUTSIDE_DATE →
  `termination-deadline-parse.js`; CURE_PERIOD → `cure-period-parse.js`
  with day_kind corroboration (BUSINESS requires /business day/i inside
  the parser's `matched_text`; CALENDAR requires its absence; mismatch →
  review, typed `DAY_KIND_UNCORROBORATED`) AND period_kind corroboration
  (audit M-1: `CURE` requires a cure verb governing the count —
  /cured? within|cure/i in the parser's `matched_text` context — note
  "30 days following written notice" IS a cure form when governed by
  "not cured within"; `NOTICE` requires the notice-delivery shape
  /notice .{0,120}prior to/i with NO cure verb governing the count —
  the corpus form "written notice of such breach, delivered at least 45
  days prior to such termination"; mismatch or neither-corroborated →
  review, typed `PERIOD_KIND_UNCORROBORATED`). Every ABSTAIN routes to review
  with the parser's typed reason; RESOLVED values still pass
  `canonicalValueAllowed` (a parser bug must not bypass the gate).
- **Materiality: NO new tier.** `TERMR-` already prefix-matches rank 10
  `TERMINATION_RIGHTS` (MATERIALITY_TABLE, ~447) — the ledger's own top
  tier, verbatim. No override map, no `materialityFor` signature change.
  Every claim and every review item in this family sorts first in Ben's
  queue by existing machinery.
- **Receipt:** `termination_deadline_parse_version` and
  `cure_period_parse_version` thread into `receiptBody`, alongside bumped
  `mapping_table_version` and the V15 `contract_vocabulary_digest`.
- **Additivity re-pin, honest (P1 M-1 verbatim):** with no termination
  input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under V15), the
  two new parser-version fields, and the recomputed
  `resolution_receipt_id`; documented in the PR with a field-level diff.
  Skipping the version bump to keep old pins green is the named
  anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; every edit
is a reviewed diff; keys MUST be registered concept keys — table-validation
enforces it, which is why TERMR-MUTUAL/TERMR-LEGAL land in the SAME slice)

New family keys and patterns (each entry carries a one-line rationale in
the table; every pattern is grounded in quoted corpus text above.
**Boundary pin (audit m-2):** the net module's `scanBoundedRegex`
deliberately does NOT impose word boundaries on `BOUNDED_REGEX` — "this
module does not silently impose one" — so every case-sensitive
defined-term pattern below is AUTHORED with explicit `\b` anchors (e.g.
/\bTermination Date\b/); a boundary-free defined-term literal is a
review-blocking table-validation failure. Defined-term capitals use
`BOUNDED_REGEX` as case-sensitive literals since `LITERAL_PHRASE` is
case-insensitive):

- `TERMR-MUTUAL`: "mutual written consent", "mutual written agreement"
  (LITERAL_PHRASE — the agreement form per audit M-2, grounded in the
  recurring verified corpus form "by mutual written agreement of Parent
  and the Company").
- `TERMR-OUTSIDE`: /\bOutside Date\b/, /\bEnd Date\b/,
  /\bTermination Date\b/ (BOUNDED_REGEX, case-sensitive — lower-case "end
  date" in prose must not fire); LITERAL_PHRASE "not been consummated on
  or before", "not have occurred on or before". **Priced cross-hit noise
  (audit M-4):** "Outside Date"/"End Date" verifiably appear inside
  breach CURE clauses ("the earlier of (1) the Outside Date and (2) 30
  days following written notice" — this spec's own quoted evidence) and
  extension parentheticals; those hits sit outside OUTSIDE candidate
  evidence and will raise `LEXICAL_UNMATCHED_SIGNALS` → veto/queue on
  the dominant breach drafting. This is an ACCEPTED, recorded cost this
  slice — the defined terms are the family's strongest veto tells and a
  deletion would widen auto-pass (deletion asymmetry); the live-run
  handoffs measure the queue rate, and if it floods, narrowing to the
  deadline prose phrases is a reviewed lexicon diff, never a silent
  deletion. Test 7's anti-noise paragraph pins the expectation explicitly
  (the earlier-of cure sentence is asserted as an EXPECTED unmatched-
  signal hit, not a clean miss).
  /Drop Dead Date/ from the earlier draft is REMOVED — see the m-1
  rebuttal note at the end of this section.
- `TERMR-NOVOTE`: "shall not have been obtained", "failure to obtain the
  required vote" (LITERAL_PHRASE — narrowed to the FAILURE phrases per
  audit M-4). The earlier draft's bare /(Stock|Share)holder Approval/
  defined terms are dropped: they appear in 74 non-VOTE TERMR v1 cards
  (SUPERIOR/RECOMMEND conditions "prior to obtaining the Company
  Stockholder Approval"; mutual parentheticals "whether prior to or after
  the receipt of the Requisite Stockholder Approval") and would flood
  `LEXICAL_UNMATCHED_SIGNALS` inside the family's own sections. Note the
  trigger-kind CORROBORATION pattern for VOTE_FAILURE (section 4) keeps
  the Approval-term AND failure-phrase pair — corroboration runs on the
  candidate's own quote where the pairing is discriminating; the lexicon
  runs across whole sections where it is not.
- `TERMR-BREACH`: "breached or failed to perform", "written notice of such
  breach", "not cured within", "cured within", "incapable of being cured"
  (LITERAL_PHRASE).
- `TERMR-LEGAL`: "permanent injunction", "preventing the consummation",
  "restraint or prohibition" (LITERAL_PHRASE).
- `TERMR-SUPERIOR`: /\bSuperior Proposal\b/ (case-sensitive).
- `TERMR-RECOMMEND`: /\bAdverse Recommendation\b/ (also covers the 14
  "Adverse Recommendation Change" cards), /\bChange of Recommendation\b/,
  /\bChange in Recommendation\b/ (6 cards, per audit M-2),
  /\bCompany Board Recommendation\b/ (case-sensitive).
- `TERMR-NOSOL-BREACH`: **deliberately UNCOVERED this slice** — no v1
  subtype exists for it, so there is zero corpus quote text to ground a
  pattern in, and fabricating one violates the grounding rule this
  programme runs on. It stays `LEXICON_FAMILY_UNCOVERED` (typed, never
  silently clean; blocks condition 2 for that family only, per the
  ratified same-family reading) until real corpus text is observed and a
  grounded pattern is authored in a reviewed lexicon diff. Priced and
  recorded.

Priced exclusions (deletion-asymmetry doc-comment applies; every one is a
recorded blind spot, and the veto-only design means a miss costs a missed
VETO, never a wrong claim):

- Naked "terminate"/"termination"/"terminated": appears in every
  effect-of-termination, fee, cross-reference and no-shop sentence in
  Article VIII and beyond — predictable noise floods, which pressures
  lexicon deletions, which widen auto-pass (the net spec's own argument).
  The blind spot (a termination right whose ONLY tell is the naked verb)
  is priced: every corpus quote above carries a stronger tell.
- Naked "breach": fires in every representation/covenant section
  ("material breach" chapeau language); only the multi-word breach phrases
  above are patterns.
- "Governmental Authority", "order": ubiquitous defined terms; only the
  restraint-specific phrases cover TERMR-LEGAL.
- "Effective Time": appears in the preamble of essentially every
  termination section ("at any time prior to the Effective Time") AND
  everywhere else in the agreement — zero discriminating power.

**REBUTTAL (audit m-1, partial).** The audit correctly caught that
/Drop Dead Date/ was claimed grounded "in quoted corpus text above" while
appearing in no quote in the evidence block, but its proposed fix ("quote
the one production TERMR card that contains it") is itself unimplementable:
re-verification against production (2026-08-02, SELECT-only,
case-insensitive across `primary_quote`, `region_full_text`,
`short_title`, `defined_term`, `defined_value`) finds ZERO cards of ANY
provision type containing "Drop Dead Date" — the only "drop dead" hits in
the corpus are "drop dead device" inside Malicious Code/Contaminant
DEFINITION cards. There is no grounding text, so under this programme's
own rule the pattern cannot exist: /Drop Dead Date/ is REMOVED from the
lexicon (priced as a recorded blind spot like the others in this list — a
deal drafting "Drop Dead Date" loses only a veto, never gains a wrong
claim) rather than retro-grounded on a card that does not exist.

## 6. Acceptance tests (real-fixture-first; the pre-rerun harness honesty
pins from P1 audit M-5 apply VERBATIM — no recorded native runs exist for
this family, so every resolver/registry test drives synthetic compiled
candidates pinned to REAL corpus quotes, byte-verified against committed
fixture text, clearly labeled as the pre-rerun harness)

0. **Fixture commit:** termination-section canonical text for at least
   three corpus deals (one carrying each of: a clock-time outside date, a
   30-day and a 45-day cure form, a mutual-consent section, a vote-failure
   section, the extension-proviso defect quote) committed as LITERAL bytes
   from production `region_full_text` (typographic quotes, no-space
   "2021(such date" included) — never retyped ASCII. Every test quote is
   asserted to be a contiguous substring of the committed bytes.
1. **Deadline parser:** table-driven — each corpus outside-date quote
   resolves to its exact ISO date ("November 22, 2021"→`2021-11-22`,
   "November 30, 2024"→`2024-11-30`, "April 30, 2021"→`2021-04-30`,
   "December 31, 2016"→`2016-12-31`); clock times excluded; the
   definitional pointer quote ABSTAINs `NO_CALENDAR_DATE`; a quote
   containing both an initial and extended date ABSTAINs
   `MULTIPLE_CALENDAR_DATES`; "February 30, 2026" ABSTAINs invalid.
2. **Cure parser:** "30 days following written notice" → `'30'`
   (period_kind CURE corroborates when governed by "not cured within");
   "45 days prior to such termination" → `'45'` — and the resolver-level
   assertion that this quote corroborates ONLY period_kind `NOTICE`, never
   `CURE` (audit M-1: it is a notice-delivery window; a CURE label on it →
   `PERIOD_KIND_UNCORROBORATED` review); earlier-of quote resolves
   `'30'` with the comparative untouched; "thirty (30) days" → `'30'`;
   "thirty (45) days" → `SPELLED_DIGIT_MISMATCH`; spelled-only →
   `NON_LITERAL_NUMERAL`; two counts → `MULTIPLE_DAY_COUNTS`; zero →
   `NO_DAY_COUNT`; singular "1 Business Day" and bare "Days" forms
   resolve (audit m-5).
3. **Registry:** V15 compiles; V14 arrays untouched byte-for-byte; both
   new concepts and all three definitions validate with zero validator
   changes; EXPECTED_CONCEPT_KEYS_V4 superset-diff test AND
   EXPECTED_CLAIM_KEYS_V15 superset-diff test (audit m-4).
4. **Resolution (pre-rerun harness):** synthetic candidates over committed
   bytes resolve end-to-end: correct concept per trigger_kind; the
   extension-defect quote labelled VOTE_FAILURE → `TRIGGER_KIND_
   UNCORROBORATED` review (the corpus defect as a permanent regression
   test); "by either Parent or the Company" labelled ONE_PARTY →
   `PARTY_SCOPE_UNCORROBORATED`; mutual claim mints the full three-key
   party `{role: 'TERMINATION_RIGHT_HOLDER', capacity:
   'EITHER_PRINCIPAL_PARTY', value: <verbatim ref>}` AND the minted
   provision passes `validate-write-set.js`'s closed party contract
   (audit C-1 — the write-path validator runs in the test, not a mock),
   never calls resolveParty; v1-suffix inversion guard: a target-breach
   quote ("if the Company shall have breached … by Parent") resolves with
   BUYER as terminator; **inverted-label regression (audit C-2):** the
   SAME breach quote with `terminating_party_ref` set to the BREACHING
   party (present verbatim in the quote, resolvable by resolveParty, but
   not in the `by <ref>` / `<ref> may terminate` position) → review,
   typed `TERMINATING_PARTY_REF_UNCORROBORATED` — never a resolved
   inverted right; `NO_SOLICITATION_BREACH` trigger_kind → review
   unconditionally (audit M-3); day_kind cross-label →
   `DAY_KIND_UNCORROBORATED`; period_kind cross-label (CURE label on the
   45-day notice quote) → `PERIOD_KIND_UNCORROBORATED` (audit M-1);
   assertion/trigger incoherence typed;
   out-of-enum trigger_kind exercises explicit `pushOpenWorld`; materiality
   rank 10 on every resolved claim AND every review item; additivity
   re-pin with documented field-level diff.
5. **Identity:** two same-section rights differing only in trigger_kind or
   terminating_party_scope mint distinct stable identities; buyer-breach
   and target-breach cure claims never collide; a CURE claim and a NOTICE
   claim in the same section never collide or dedupe (period_kind in
   identity, audit M-1).
6. **Provider + dispatch:** response missing
   `termination_right_assertions` → empty list, not schema failure;
   existing recorded capitalisation replays byte-identical THROUGH the
   new prompt registry (audit C-3 — the refactored
   `native-extraction-run.js` path, not the old hard-required import);
   unknown section family → no prompt dispatched, no candidates, typed
   record (never a silent capitalisation fallback); section-family
   classifier: TERMR fixture titles classify TERMINATION, TERMF fee
   titles do NOT, validated against all deals' section titles.
7. **Lexicon:** table validation (keys registered, explicit `\b` on every
   case-sensitive defined-term regex — audit m-2, static max ≤ 128,
   rationale per pattern, content hash pinned); anti-noise
   regression paragraph extended with "at any time prior to the Effective
   Time", "this Agreement may be terminated" (chapeau), "material breach"
   rep-chapeau prose, and (audit M-4) the mutual parenthetical "whether
   prior to or after the receipt of the Requisite Stockholder Approval"
   and the SUPERIOR condition "prior to obtaining the Company Stockholder
   Approval" — asserting NOVOTE stays silent on both under the narrowed
   failure-phrase patterns; the earlier-of cure sentence ("the earlier of
   (1) the Outside Date and (2) 30 days following written notice") is
   pinned as an EXPECTED TERMR-OUTSIDE unmatched-signal hit (the priced
   cross-hit cost, asserted so a future silent deletion breaks a test);
   each surviving pattern hits its own grounding quote in the committed
   fixtures; TERMR-NOSOL-BREACH asserted `LEXICON_FAMILY_UNCOVERED`.
8. Full suite + `npm run build` + forbidden-patterns; phase allowlist for
   the slice's files.

## Out of scope

- Outside-date EXTENSION mechanics (automatic and elective) — two-date
  provisos ABSTAIN to review by design; the extension shape feeds the
  open-world commonality report until it has its own adjudicated concept.
  The lone v1 `TERMR-EXTENSION` card (an "Extension; Waiver" boilerplate
  section) is flagged as a v1 misclassification for the ingest-QA lane,
  not modeled.
- `TERMR-PREAMBLE` (article chapeau — structure, not a right) and the 76
  null-subtype v1 cards (a v1 data-quality question for ingest QA, not a
  v2 vocabulary question).
- Termination FEES (`TERMF-*`, rank 20) — separate family, separate spec;
  the SUPERIOR quote's fee-payment condition stays inside the grant quote
  as evidence, never becomes a fee claim here.
- Fiduciary-out mechanics beyond the trigger label (match rights, notice
  windows on SUPERIOR/RECOMMEND) — open world.
- Cross-deal canonicalization of deadline_term_ref and party phrases (Ben
  adjudication over observed values, later).
- The live re-extraction runs (each its own dated handoff; until they
  land, NO report may claim native termination-rights extraction — M-5).
- FAMILY_MAPPING_TABLE extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit with the wiring slice — the BREACH-T/-B inversion
  trap makes this table Ben-reviewed, never implementer-inferred).
- Any amendment to M3 protocol semantics; any scope-closure/ABSENT work.

## Known costs, stated up front

- Every mutual right in a deal whose quote says "by either Parent or the
  Company if" with sub-clauses (the corpus's dominant 8.1(b) drafting)
  needs the producer to attribute the chapeau's party scope to each
  sub-clause assertion; a producer that quotes only the sub-clause loses
  the either-pattern and the scope corroboration sends it to review. Cost:
  review volume on the most common drafting shape, at rank 10. Accepted —
  a queued mutual right beats a silently one-sided one; prompt guidance
  (quote through the chapeau) mitigates, and the live-run handoffs will
  measure the rate.
- `TERMR-NOSOL-BREACH` stays lexicon-uncovered and therefore
  condition-2-blocked until grounded text exists — and, symmetrically
  (audit M-3), `NO_SOLICITATION_BREACH` trigger_kind queues
  unconditionally at the resolver: zero grounded corpus text means zero
  auto-published claims for this concept this slice. Honest shape of the
  work.
- ONE_PARTY rights whose quote drafts the terminator outside the two
  corroborated grammatical positions (`by <ref>`, `<ref> may terminate`)
  queue as `TERMINATING_PARTY_REF_UNCORROBORATED` (audit C-2). Priced:
  both forms are the verified corpus norm; a queued correct right beats a
  published inverted one at rank 10; the live-run handoffs measure the
  rate and any new grammatical form is added by reviewed diff.
- Case-sensitive defined-term patterns miss lower-case drafting variants
  ("outside date" uncapitalized); priced — the deadline prose patterns
  ("not been consummated on or before") cover that shape, and a miss costs
  a missed veto, never a wrong claim.
- The parsers refuse compound quotes (multiple dates/counts), so badly
  split producer output queues rather than resolves; two-strike escalation
  applies to prompt iteration, not to loosening the parsers.
