# Family — Closing conditions (COND-*, incl. bring-down tiers)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — 1 CRITICAL (C1), 3 MATERIAL
(M1, M3, M4), 5 MINOR (m1–m5) fixes applied; 1 parked for Fable (M2).
**Fable ruling on M2 (2026-08-02, at fold review): ACCEPTED as written.**
Keying the standing `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` entry on
`registered_claim_definition_key === 'REPRESENTATION_ACCURACY_STANDARD'`
(not on the `ALLOWED_VALUES_MEMBERSHIP` gate pin) is the correct scope: it
covers exactly the claims Ben's CLAIM-IDENTITY-APPROVALS-2026-08-01 item 2
ruling addressed, refuses to widen that approval to the family's other
membership-gated definitions, and keeps the revisit mechanical per the
`SOURCE_SCOPE_CERTIFICATION_ABSENT` precedent. Removal stays Ben-only via a
dated docs/acks/ ruling.
**Parent:** `2026-08-02-openworld-promotion-program.md` (five-layer promotion
structure and cross-slice invariants apply verbatim).
**Template:** `2026-08-02-p1-captable-numerics-design.md` (slice shape,
typed-abstain discipline, corroboration tables, coverage-map honesty pins);
wave-one folded exemplars `2026-08-02-family-termination-fee-design.md` and
`2026-08-02-family-termination-rights-design.md` (this spec writes against
the producer-prompt-registry seam the termination-rights spec defines — ALL
new families dispatch through it, never a capitalisation fallback).
**Protocol authority:** docs/codex-program/EXECUTION-LEDGER.md — M3 review
protocol + extraction semantics rules 1–3. This spec may not amend them.
**Approval authority honored, not redesigned:**
`docs/acks/CLAIM-IDENTITY-APPROVALS-2026-08-01.md` item 2 — the bring-down
tier MECHANICAL provenance decision (M2, option (b) approved,
revisit-before-auto-pass). Section 4 mechanizes the revisit pin; nothing in
this spec reopens the tag semantics.
**Materiality:** existing rank 70 tier `CLOSING_CONDITIONS`
(`candidate-resolution.js` ~455, `concept_key_prefixes: ['COND-']`). This
slice adds NO materiality tier and NO override entries; a test pins rank 70.
The M3 queue ordering already places closing conditions ahead of notices and
administrative clauses (EXECUTION-LEDGER, Ben review clause).

## Corpus grounding (production Supabase, project `tzulhdasmioeechxapdy`,
evidence pack read 2026-08-02; quotes below are pack ground truth, cited by
provision_card id)

v1 `provision_cards` with `provision_type = 'CLOSING_CONDITION'`: 609 cards.
Subtypes (cards/deals): null 74/27, COND-B-REP 47/36, COND-M-STOCKHOLDER
46/38, COND-M-LEGAL 43/38, COND-M-PREAMBLE 43/39, COND-B-PREAMBLE 40/36,
COND-M-REG 39/35, COND-S-PREAMBLE 38/34, COND-S-REP 38/33, COND-B-CERT
36/33, COND-B-COV 34/32, COND-S-CERT 32/31, COND-S-COV 32/31, COND-B-MAE
28/27, COND-M-S4 14/14, COND-M-LISTING 13/13, COND-FRUSTRATE 10/10,
COND-S-FUNDS 2/2. Rubric codes COND-B-DISSENT and COND-TAXOPINION: zero
cards anywhere — declared vocabulary with no corpus existence.

Grounding quotes this spec builds on (every corroboration pattern and
lexicon entry below traces to one of these; nothing is fabricated):

- Bring-down, target reps, tiered — card `066e1fd7-7131-4ecf-9592-d9f274e2e062`
  §8.02(a): "The representations and warranties of the Company Entities set
  forth in Section 4.02(a) … shall be true and correct in all respects as of
  the Closing Date"; card `ae155f39-f732-468d-9a9d-24f51f209aa0` §7.2(a):
  "the representations and warranties of the Company set forth in this
  Agreement, (w) other than those set forth in the first sentence of Section
  5.1(a) (Organization, Good Standing and Qualification) …".
- Bring-down, buyer reps — card `f10b6b21-cfb4-48de-9167-02d47981a891`
  §6.3(a): "Each of the representations and warranties made by Parent,
  Company Merger Sub, Parent OpCo and OpCo Merger Sub in Section 4.1(a) …
  (collectively, the "Parent Fundamental Representations") (x) that are
  qualified by materiality or by P…".
- No-MAE condition + continuing — card `c0d6b18f-553a-492f-97c2-89cc2f5ac94c`
  §7.02(d), evidence quote: "there shall not have occurred a Company
  Material Adverse Effect that is continuing".
- Compound multi-fact condition clause (the family's dominant hazard) —
  card `c5b50bfe-feda-404b-b5c1-92d2dc219d8a` §5.2(a): "(i)The Company shall
  have performed in all material respects all of its obligations hereunder …
  (ii)(A) the representations and warranties of the Company set forth in
  Section 3.1(f)(i)(B) (Absence of Certain Changes) shall be true and
  correct in all respects …" — covenant compliance, rep accuracy and the
  MAE-shaped rep in ONE numbered clause.
- Covenant compliance — card `3a0c665c-44d1-46cb-a1e0-126ad32547f2`
  (Kraft/Heinz): "Kraft shall have performed in all material respects all
  obligations required to be performed by it under this Agreement at or
  prior to the Closing Date"; card `84353d88-1ba6-4fcf-a9bf-a0da7cf6fd53`
  §6.3(b): "Each of Parent, Company Merger Sub, Parent OpCo and OpCo Merger
  Sub shall have performed or complied in all material respects with all
  obligations, agreements and covenants required by this Agreement".
- Antitrust — card `fa44d3ce-837c-41f6-b49e-3509592e5f66`: "The waiting
  period (including any extension thereof) applicable to the consummation of
  the Merger under the HSR Act shall have expired or been terminated, (ii)
  all filings with or permits, clearances, authorizations, consents, orders
  or approvals of or expirations of waiting periods required in those
  jurisdictions set forth in Section 7.1(b) of the Company Disclosu…";
  industry-specific non-HSR variant — card
  `ecb30ef5-120c-4aab-857c-475af33a6428` §6.1(b) (FCC/cable-franchise "LFA
  Approvals", percentage thresholds embedded in compound prose).
- Preamble (anti-noise fixture) — card
  `50f19dfa-2a29-4d37-873b-f3102a15c880`: "…subject to the fulfilment at or
  prior to the Closing of each of the following conditions, any or all of
  which may be waived in whole or in part by the Company…".

## Grounding corrections (verified against repo + evidence pack, 2026-08-02)

1. **The two dedicated bring-down tables are EMPTY.**
   `closing_condition_bring_down_tiers` (0 rows) and `provision_bring_downs`
   (0 rows) have full schemas and no data. The real v1 tier data is 239
   `claims` rows (`attribute='bringDownTiers'`), one JSON-stringified object
   PER TIER per row, grouped by `provision_instance_id` — any build that
   reads the dedicated tables finds nothing (pack §4, §5, defect 11). This
   slice neither reads nor writes either table; their disposition is a Ben
   data-hygiene call, flagged in Out of scope.
2. **The evidence pack's claim that `NATIVE_BRING_DOWN_TIER_CANDIDATE` "is
   not the closing-conditions rep bring-down" is wrong and is corrected
   here.** The key (anthropic-provider.js:93) resolves through the
   unconditional table entry at candidate-resolution.js ~332–338 to concept
   `COND-B-REP`, claim definition `REPRESENTATION_ACCURACY_STANDARD`, party
   role `CONDITION_OBLIGOR` — it IS a closing-condition claim, scoped today
   to the capitalisation rep's accuracy condition (the QXO §5.2(a)(ii)
   family) because only the capitalisation prompt runs. This family is the
   ONLY wave family that starts with a live, recorded, resolving native
   path; the slice generalizes it, it does not invent it.
3. **Registered v2 vocabulary today: `COND-B-REP` only** (contract-bundle.js
   ~2838, `EXPECTED_CONCEPT_KEYS_V1` — corrected cite per audit finding m1;
   the same "COND-B-REP only" fact also holds in the V2/V3 head rows).
   Every other v1 COND subtype has no registered concept. `COND-B-REP` is
   load-bearing in `TARGET_CAPITALISATION_BRING_DOWN` result/metric
   definitions and the reviewed serving slices — it is never edited or
   re-keyed here.
4. **Registered accuracy-standard vocabulary is FOUR codes**
   (`REPRESENTATION_ACCURACY_STANDARD` v1, contract-bundle.js ~117–126):
   `MAT_ALL_RESPECTS`, `MAT_ALL_RESPECTS_DE_MINIMIS`, `MAT_ALL_MATERIAL`,
   `MAT_MAE_QUALIFIED`. The v1 corpus claims also carry
   `MAT_MATERIALITY_SCRAPE` (aliased in `lib/bring-down-tiers.js`) and
   `MAT_MAE_AGGREGATE` (aliased NOWHERE — it falls through v1's own
   `TREATMENT_ALIASES`, pack defect 6). The capitalisation prompt already
   ruled both out of the code vocabulary
   (capitalisation-producer-prompt.js ~82–91: scrape travels as the tier's
   `scrape_quote` evidence field; "individually or in the aggregate" is
   aggregation phrasing inside an MAE-qualified standard, not a fifth
   code). This spec adopts those rulings verbatim for the new path; it does
   NOT widen the four-code enum, and it never aliases a v1 code into the
   enum at resolution (rule-3 nearest-fit). The `MAT_MAE_AGGREGATE` alias
   gap is flagged to the ingest-QA owner as a v1 defect, not fixed here.
5. **Bundle version numbering:** the two wave-one sibling specs each bind
   "V15". Frozen input versions are allocated at build time in merge order;
   this spec binds to "the next frozen version at this slice's merge", and
   every superset-diff acceptance test is written against CONTENT (sorted
   key sets), never the numeral.

## The M2 decision, honored (this section is normative for the whole spec)

F28-THIRD-LIVE-RUN item 2: bring-down tier claims carry a MECHANICAL
provenance tag on a model-chosen code; the value is gated by allowed-values
membership only. Ben approved option (b)
(CLAIM-IDENTITY-APPROVALS-2026-08-01 item 2): keep MECHANICAL, pin the gate
explicitly (`gate: 'ALLOWED_VALUES_MEMBERSHIP'`) so the tag never overstates
how the value was produced, and **revisit before auto-pass opens for the
family**. The implementation exists (candidate-resolution.js ~2500–2515,
`buildMechanicalAnswerProvenance({ extraPins: { gate:
'ALLOWED_VALUES_MEMBERSHIP' } })`).

What this slice does with it:

- The NEW conditions-path bring-down claims (section 4) resolve into the
  SAME claim definition with the SAME provenance construction, byte-for-byte
  the same pins. No second tag semantics, no "improved" derivation rule —
  the approved decision covers the generalized path because the epistemic
  situation is identical: the code is producer-chosen, gate-checked, not
  rule-derived.
- The revisit-before-auto-pass condition becomes MECHANICAL (the
  `SOURCE_SCOPE_CERTIFICATION_ABSENT` precedent from the lexical-net spec):
  resolution wiring adds a standing entry
  `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` to `unevaluated_conditions`
  on every claim whose `registered_claim_definition_key ===
  'REPRESENTATION_ACCURACY_STANDARD'` — both the existing
  capitalisation-path claims and the new conditions-path claims (both
  paths resolve into that same claim definition; section 4 keys the entry
  on the claim definition, not on the `ALLOWED_VALUES_MEMBERSHIP` gate pin,
  because the gate pin is also stamped on this slice's other
  membership-gated definitions — `COVENANT_COMPLIANCE_STANDARD` and the
  three presence definitions — and Ben's approval in
  CLAIM-IDENTITY-APPROVALS-2026-08-01 item 2 covers the bring-down tier
  provenance decision only; it does not widen to the rest of the family).
  It is removed only by a dated Ben ruling recorded in `docs/acks/`; until
  then the invariant "empty array = every protocol condition mechanically
  evaluated" stays true for this family, and no future auto-pass wiring can
  silently treat the tag as settled. This is an output CHANGE for existing
  capitalisation-path resolutions — deliberate, spec'd, and documented in
  the PR as a field-level diff (recorded provider-level response fixtures
  still replay byte-identically; only resolution output gains the entry).

## Deliverable (honest conversion semantics)

Governed, resolvable claims for the four workstreams in the family brief:
(a) bring-down accuracy tiers over ALL reps — generalizing the live
capitalisation-scoped path; (b) the no-MAE condition, including the
continuing requirement; (c) covenant-compliance standards; (d) the
antitrust/regulatory condition.

**Recorded-run state, stated honestly:** recorded native fixtures exist ONLY
for the capitalisation-scoped bring-down path (F28/Skechers/Modiv). No
recorded run has ever seen a conditions ARTICLE section, so — as with both
wave-one siblings — there are no open-world fixture rows to convert and no
closure_ids to track for (b)–(d). The deliverable is the five-layer
capability plus a pre-rerun harness: a COVERAGE MAP over committed
corpus-quote fixtures (the cards named above, committed as LITERAL bytes
from production with provenance headers: deal, provision_card id, retrieval
date, subtype — including NULL where true), each hand-enumerated with its
expected outcome. The P1 audit M-5 honesty pins apply verbatim: "the
pipeline natively extracts closing conditions" may be claimed only after
dated post-merge live-run handoffs (subscription CLI); until then the honest
claim is "the machinery exists, is proven on committed fixtures, and the
capitalisation bring-down sub-path is proven live".

**Fixture placement is load-bearing:** all committed condition-text fixtures
live under `tests/fixtures/canonical-v2/closing-conditions-fixtures/` so the
forbidden-patterns PROSE_CLASS_FINGERPRINTS exemption
(scripts/lint/forbidden-patterns.sh ~47–55) applies by construction — real
condition prose legitimately contains the burdensome-condition and
qualification/litigation fingerprints on one line, and a faithful recording
must not trip bug-fingerprints aimed at code regressions. No OTHER new file
in this slice may contain those strings; the one legitimate code-side home
of the burdensome-condition prompt text remains `lib/parser-v2/extract.js`
under its existing per-file exemption, which this slice does not touch.

## 1. Registry (`contract-bundle.js` → next frozen version)

Strictly additive spread of the current head version. **New concepts, all
FLAGGED FOR BEN in the PR body** (concept-key additions are taxonomy
decisions; this spec proposes, Ben settles — the 2026-07-23 convention):

- `COND-S-REP` — accuracy-of-buyer-reps condition (38 cards / 33 deals).
  **Key-style tension, named rather than hidden:** the ratified
  termination-rights precedent says party attribution is a governed
  attribute, never a key suffix (v2 chose party-agnostic `TERMR-BREACH` over
  v1's -T/-B). But `COND-B-REP` is already registered and load-bearing in
  frozen result/metric definitions, and splitting the SAME legal fact
  (rep-accuracy condition) across one legacy side-suffixed key and one new
  side-agnostic key would put two key styles under one claim definition and
  poison every cross-deal rollup keyed on concept. The lesser evil is the
  mirror key, with `rep_side` ALSO carried as a governed attribute (section
  1 attributes, below) so a future Ben-adjudicated re-key can collapse the
  suffixes without data loss. This is a legal-vocabulary ruling for Ben's
  eyes, placed in the registry section deliberately.
- `COND-MAE` — the no-MAE closing condition (28 target-side cards / 27
  deals, plus buyer-side mirrors sitting in the null-subtype "[PROPOSED]
  Absence of Parent Material Adverse Effect" population). Side-agnostic per
  the TERMR precedent — here there is no registered side-suffixed sibling
  to stay consistent with, so the ratified rule applies cleanly:
  `mae_party` is a governed attribute, never a suffix.
- `COND-COV` — covenant-compliance condition (66 cards across B/S sides,
  63 deal-sides). Side-agnostic for the same reason; the performing party
  is the claim's party (`CONDITION_OBLIGOR`), which IS the side.
- `COND-REG` — antitrust/regulatory closing condition (39 cards / 35
  deals). Mutual by drafting; no side dimension.

NOT added: `COND-M-STOCKHOLDER`, `COND-M-LEGAL`, `COND-M-S4`,
`COND-M-LISTING`, `COND-S-FUNDS`, `COND-FRUSTRATE` (real corpus families,
deliberately deferred to a follow-on slice — this slice holds to the family
brief's four workstreams so every layer stays reviewable); preambles
(article chapeau is structure, not a condition — the TERMR-PREAMBLE
precedent); CERT (the certificate is procedural machinery whose content is
a cross-reference to sibling conditions — see Known costs);
`COND-B-DISSENT` / `COND-TAXOPINION` (zero corpus cards; registering them
would be vocabulary with no grounding text, the exact fabrication this
programme forbids). On 2026-08-04, adjacent Codex session messages recorded
retirement of `DISSENT_THRESHOLD` as a comparable M3 field. The decision
register carries the exact timestamps, excerpts, and session-log line
references. Any future matching text is preserved as exact open-world
evidence. Reintroduction requires a stable grounded shape and separate
approval.

**Claim definitions** (three new; bring-down reuses the existing one):

```
NO_MAE_CONDITION_CLAIM_DEFINITION_V1
  claim_definition_key: 'NO_MAE_CONDITION'
  version: 1
  allowed_canonical_values: [true]          // presence claim,
  canonical_value_required_when_present: true  // KNOWLEDGE_QUALIFIER shape

NO_MAE_CONDITION_CONTINUING_CLAIM_DEFINITION_V1
  claim_definition_key: 'NO_MAE_CONDITION_CONTINUING'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true

COVENANT_COMPLIANCE_STANDARD_CLAIM_DEFINITION_V1
  claim_definition_key: 'COVENANT_COMPLIANCE_STANDARD'
  version: 1
  allowed_canonical_values: ['MAT_ALL_MATERIAL']   // enum, registry-hosted
  // NOTE (audit finding m2, pinned deliberate): MAT_ALL_MATERIAL is the
  // SAME token used by REPRESENTATION_ACCURACY_STANDARD's accuracy enum.
  // The reuse is intentional — both describe the same "in all material
  // respects" standard of legal compliance, just attached to different
  // claim definitions (rep accuracy vs. covenant compliance) — but any
  // analytics keyed on canonical value ALONE, without the claim
  // definition key, will conflate the two. Consumers must key on
  // (claim_definition_key, canonical_value), never canonical_value alone.
  canonical_value_required_when_present: true

REGULATORY_APPROVAL_CONDITION_CLAIM_DEFINITION_V1
  claim_definition_key: 'REGULATORY_APPROVAL_CONDITION'
  version: 1
  allowed_canonical_values: [true]
  canonical_value_required_when_present: true
```

No new canonical value types; no validator changes. New definitions and
concepts grow the expected-keys rows as sorted supersets (content-diffed
tests, prior rows byte-untouched).

**Enum decisions, pinned as legal rulings:**

- `COVENANT_COMPLIANCE_STANDARD` starts with ONE code. Every grounded
  corpus quote drafts "in all material respects" (cards `3a0c665c`,
  `84353d88`, `c5b50bfe`, and the pack's `covenantComplianceStandard` n=1).
  A flat "in all respects" covenant standard is market-plausible but has
  ZERO grounded quote bytes in the evidence pack — under the grounding rule
  it cannot ship; pinned destination (audit finding m4): an out-of-enum
  covenant standard routes to explicit `pushOpenWorld`, typed
  `COVENANT_STANDARD_OUT_OF_VOCABULARY` — the same pattern as
  `ACCURACY_STANDARD_OUT_OF_VOCABULARY` (section 4) and
  `APPROVAL_KIND_UNCORROBORATED`'s out-of-enum routing, never a bare
  "review" destination — and the enum grows only by reviewed diff with a
  corpus receipt. A one-code
  enum is not decoration: the corroboration gate (section 4) is what stops
  a mislabeled flat standard from publishing as material-qualified — the
  exact invisible-corruption shape this family feeds into market
  statistics.
- **`NO_MAE_CONDITION_CONTINUING` is a quoted PRESENT claim, never a
  boolean pair.** The v1 feature `continuingRequirement` stores `"true"` /
  `"false"` strings (pack §7) — the `"false"` half is a producer-asserted
  negative and is BANNED under M3 rule 1. The v2 shape: the producer emits
  the continuing claim only when the quote carries the continuing language
  ("that is continuing", card `c0d6b18f`); a deal without it simply has no
  such claim, and "no continuing requirement" belongs to future
  scope-closure derivation. Same ruling for every "no legend / no
  restriction / no burdensome condition"-style drafting in this family:
  quoted PRESENT claims only, or open world; the producer never asserts a
  negative.
- **No numeric promotion anywhere in this family this slice.** The corpus's
  only condition numerics are `dollarThreshold` (n=5, THREE coexisting
  value shapes — `"$275,000"`, `"5000000"`, `"3800002.59"`, pack §7),
  tender-offer minimums (free text with multiple percentage figures playing
  different semantic roles in one sentence, pack §8 item 7), and two
  declared-but-never-populated features (`dissentingSharesThreshold`,
  `mutualClosingDeadlineAfterConditionsDays` — zero claims corpus-wide).
  Nothing here has the grounding a typed parser needs; all of it stays open
  world, feeding the commonality report. Consequence: **this slice ships NO
  new value parser** — see section 2.

**Governed attributes (never in keys; all participate in claim identity so
same-section claims never collide or dedupe):**

- Bring-down (`REPRESENTATION_ACCURACY_STANDARD` via the new path):
  - `rep_side`: enum `TARGET_REPS | BUYER_REPS` — decides the
    COND-B-REP/COND-S-REP concept split; corroborated (section 4), never
    trusted from the label.
  - `covered_scope_ref`: verbatim phrase naming which reps the tier covers
    ("the representations and warranties of the Company Entities set forth
    in Section 4.02(a), …" — card `066e1fd7`'s cite-list shape is the
    corpus norm, pack §7). REQUIRED; must be a verbatim substring of the
    byte-verified quote (P1 M-3 discipline); failure → review, typed
    `COVERED_SCOPE_REF_NOT_IN_QUOTE`. No cross-deal scope canonicalization
    this slice (the share_class_ref precedent verbatim — Ben adjudicates
    over observed values later). Identity-bearing: 239 tier claims over
    ~100 rep-condition cards means multi-tier sections are the NORM, and
    two tiers in one section must never dedupe.
  - `scrape_quote`: optional verbatim materiality-scrape evidence, the
    capitalisation prompt's existing tier field carried over unchanged —
    evidence, never a code.
- `COND-MAE`: `mae_term_ref` — the verbatim defined-term phrase ("Company
  Material Adverse Effect"), required, substring-enforced, typed
  `MAE_TERM_REF_NOT_IN_QUOTE` on failure; `mae_party`: enum
  `TARGET | BUYER`, corroborated (section 4; BUYER queues unconditionally
  this slice — see there).
- `COND-COV`: `obligor_ref` — verbatim performing-party phrase ("Kraft",
  "Each of Parent, Company Merger Sub, Parent OpCo and OpCo Merger Sub"),
  required, substring-enforced, positionally corroborated (section 4).
- `COND-REG`: `approval_kind`: enum `HSR | SCHEDULED_APPROVALS` — the
  rubric's existing `ANTITRUST_APPROVAL_CODES` vocabulary, adopted rather
  than re-invented; corroborated (section 4). Out-of-enum → explicit
  `pushOpenWorld`, typed (the FCC/LFA shape is the live example and the
  designed outcome — an industry-specific approval metric forced into
  `SCHEDULED_APPROVALS` would be rule-3 nearest-fit forcing).

## 2. Value parsers: NONE — a ruled decision, not an omission

Every canonical value this slice produces is either a presence `true` or a
registry-hosted enum code gated by allowed-values membership. There is no
date, day-count, share-count or money value to parse:

- The bring-down standard and covenant standard are CODES; deriving them
  from prose by regex is exactly what the M2 decision declined to pretend
  happens — the tag says `ALLOWED_VALUES_MEMBERSHIP` because that is the
  only mechanical check performed, and this spec does not build a
  pseudo-parser to upgrade the tag's story.
- The family's numerics are unpromoted (section 1, third ruling), on the
  evidence of the pack's value-shape inventory: three currency shapes in a
  five-row sample, multi-role percentages inside single sentences, and two
  never-populated declared features. A parser without grounded shapes is a
  parser tested against fabrications.

Consequence pins: no new `*_PARSE_VERSION` receipt fields exist for this
family; the additivity re-pin (section 4) therefore has ONE fewer moving
part than the sibling slices; and any future numeric promotion here starts
with its own corpus receipt and its own typed-abstain parser module — never
by widening this slice's handlers.

## 3. Producer prompt + provider

- **New prompt module** `closing-conditions-producer-prompt.js`. The
  capitalisation prompt is NOT edited: its PROMPT_VERSION does not move, its
  `bring_down_conditions` response list and recorded fixtures stay
  byte-identical — this is the M2 pin's structural half (the existing tier
  path must keep replaying unchanged). New
  `PROMPT_ID 'native-producer-closing-conditions/v1'`, `PROMPT_VERSION 1`,
  bumped once per slice, never mid-slice.
- **Dispatch through `producer-prompt-registry.js`** — the seam specified
  in the termination-rights spec (its section 3), which this spec writes
  against and does not re-design: this family adds one frozen entry,
  `CLOSING_CONDITIONS → buildClosingConditionsProducerPrompt`. Unknown
  family → no prompt, no candidates, typed record — never a silent
  capitalisation fallback. Build-order dependency, named: whichever family
  slice merges first BUILDS the seam per that spec's text; the later one
  adds only its entry. The capitalisation byte-identical-replay test guards
  both orderings.
- **Section-family classifier extension:** classify a section
  `CLOSING_CONDITIONS` on section/article-title evidence only, regexes
  ported from and tested against the v1 title rules
  (`lib/parser-v2/classify.js` ~377–378 "conditions to/of/precedent…" and
  the COND article context at ~513–527). The classifier stamps the FAMILY
  only — party is never taken from titles (the v1 party-from-title split at
  ~514–525 is explicitly NOT ported; side is a corroborated governed
  attribute, section 4). Validated against ALL deals' section titles before
  dispatch (repo classify-rules convention). Known coverage hole, priced:
  tender-offer condition annexes carry section refs like "Annex-A" /
  "ANNEX-COND(i)" and category-label refs like bare "COND-M" (pack §8 item
  1); titles that fail the regexes classify UNKNOWN → no prompt → typed
  record. Tender-offer deals are under-covered this slice; the live-run
  handoffs measure the miss rate (see Known costs).
- **Scope fencing against the capitalisation prompt:** a deal's rep-accuracy
  condition (e.g. QXO §5.2(a)(ii)) can sit inside BOTH the capitalisation
  governed scope and a conditions article. Pin: sections inside the
  capitalisation governed scope keep the capitalisation prompt exclusively;
  the run computes the section_ref intersection and does NOT dispatch the
  conditions prompt to overlapping sections — typed record
  `SECTION_CLAIMED_BY_CAPITALISATION_SCOPE`, never two prompts over one
  section (which would mint colliding tier claims from two paths).
- **Response shape:** a `closing_condition_assertions` array — each element
  `{ section_reference, assertion_kind: 'BRING_DOWN_TIER' |
  'NO_MAE_CONDITION' | 'MAE_CONTINUING' | 'COVENANT_COMPLIANCE' |
  'REGULATORY_APPROVAL', verbatim quote }` plus per-kind fields:
  BRING_DOWN_TIER carries `accuracy_standard` (four-code vocabulary),
  `rep_side`, `covered_scope` (verbatim), optional `scrape_quote`;
  NO_MAE_CONDITION/MAE_CONTINUING carry `mae_term` (verbatim) and
  `mae_party`; COVENANT_COMPLIANCE carries `standard` and `obligor`
  (verbatim); REGULATORY_APPROVAL carries `approval_kind`. One element per
  legal fact: card `c5b50bfe`'s compound clause is at least THREE
  assertions (covenant compliance, rep-accuracy tier, MAE-shaped rep), each
  quoting its own sub-clause — the prompt owns the split so section 4's
  single-kind corroboration is satisfiable, exactly the P1 compound-sentence
  rule. PRESERVE-THE-NOVEL retained verbatim; when unsure of any enum or
  side, keep the assertion in `open_world_candidates`. The producer never
  asserts a negative (M3 rule 1): no "condition absent", no
  `continuing: false`, no burdensome-condition-absent — quoted positives or
  open world, nothing else.
- **Provider (`anthropic-provider.js`):** ONE new generic key,
  `NATIVE_CLOSING_CONDITION_CANDIDATE`, proposal_kind `CLOSING_CONDITION`
  (≠ OPEN_WORLD). `closing_condition_assertions` is NOT added to
  `REQUIRED_RESPONSE_LISTS` (the share_count precedent at ~83–89 verbatim:
  recorded responses predate the key; missing/non-array reads as empty
  list, never a schema failure). Quote byte-verification identical to
  existing proposals. `NATIVE_BRING_DOWN_TIER_CANDIDATE` and
  `shapeBringDownCondition` are untouched byte-for-byte.
- Golden evals: recorded responses are never hand-edited into the new
  shape; the first conditions-family recordings are minted by the first
  live runs, each its own dated handoff.

## 4. Resolver wiring (`candidate-resolution.js`)

- **ONE new `RESOLUTION_UNCONDITIONAL` entry** (P1 M-2: the Map is keyed on
  generic_claim_key alone): `NATIVE_CLOSING_CONDITION_CANDIDATE`,
  `deterministic_kind: null`, `attachment_position: null`,
  `registered_claim_definition_key: null`, `concept_key: null` (explicit,
  with the termination-rights build-time check that nothing reads
  `mapping.concept_key` before the handler's kind map runs),
  `party_field: 'condition_obligor'`, `party_role: 'CONDITION_OBLIGOR'` —
  matching the existing bring-down row's party vocabulary so one family
  mints one party role. The EXISTING `BRING_DOWN_TIER_CLAIM_KEY` entry is
  untouched byte-for-byte. `MAPPING_TABLE_VERSION` bumped;
  table-validation still asserts no duplicate generic keys.
- **Handler split on `assertion_kind`** via a frozen map:
  `BRING_DOWN_TIER → (rep_side ? COND-B-REP/COND-S-REP) ×
  REPRESENTATION_ACCURACY_STANDARD`; `NO_MAE_CONDITION → COND-MAE ×
  NO_MAE_CONDITION`; `MAE_CONTINUING → COND-MAE ×
  NO_MAE_CONDITION_CONTINUING`; `COVENANT_COMPLIANCE → COND-COV ×
  COVENANT_COMPLIANCE_STANDARD`; `REGULATORY_APPROVAL → COND-REG ×
  REGULATORY_APPROVAL_CONDITION`. Out-of-enum assertion_kind → explicit
  `pushOpenWorld`, typed reason (P1 C-4: the main loop's open-world routing
  keys on proposal_kind and will not catch it).
- **Full-table kind ambiguity rule (the TERMF audit C-3 device, REQUIRED
  here because this family has no parser to refuse compounds):** the
  handler runs ALL kinds' corroboration patterns (below) over the
  byte-verified quote, then reduces to the MAXIMAL matched-kind set — a
  matched kind whose corroborating span is a pattern-contained subset of
  another matched kind's corroborating span is dropped from the ambiguity
  count, not treated as a second, competing kind. This is a named,
  audit-required exception, not a general loosening: `MAE_CONTINUING`'s
  patterns are, by construction (`NO_MAE_CONDITION`'s pair AND
  `/is continuing/i`), a strict superset of `NO_MAE_CONDITION`'s patterns —
  every quote that corroborates `MAE_CONTINUING` necessarily also
  corroborates `NO_MAE_CONDITION`, so the pair `{NO_MAE_CONDITION,
  MAE_CONTINUING}` is pinned as the ONE subsumption exception this slice
  ships: when both match, the asserted kind is `MAE_CONTINUING`, and
  `/is continuing/i` is present, corroboration succeeds as
  `MAE_CONTINUING` (not `AMBIGUOUS_CONDITION_KIND`) — this is what lets
  `c0d6b18f` resolve into two claims (test 2). Every OTHER pattern pair
  in the table remains a genuine independent-kind ambiguity: patterns for
  ≥2 distinct, non-subsumed assertion kinds matching → review, typed
  `AMBIGUOUS_CONDITION_KIND` — UNLESS the assertion quotes a narrower
  contiguous sub-quote in which exactly one kind's patterns match. Card
  `c5b50bfe`'s full clause corroborates COVENANT_COMPLIANCE and
  BRING_DOWN_TIER simultaneously (a genuine, non-subsumed pair) and is the
  pinned regression fixture: the unsplit quote queues; the hand-enumerated
  sub-quotes resolve. Compound drafting is the NORM in this family (pack
  §8 item 8) — the resulting review rate is a named cost, never a reason
  to loosen.
- **Corroboration tables (frozen resolver constants; label must match quote
  text; every pattern grounded in a committed fixture quote):**
  - Kind patterns: `BRING_DOWN_TIER` ↔ /representations and warranties/i
    AND /true and correct/i (cards `066e1fd7`, `ae155f39`, `c5b50bfe`);
    `NO_MAE_CONDITION` ↔ /shall not have occurred/i AND
    /\bMaterial Adverse Effect\b/ (case-sensitive defined term; card
    `c0d6b18f`); `MAE_CONTINUING` ↔ the NO_MAE pair AND
    /is continuing/i (card `c0d6b18f`); `COVENANT_COMPLIANCE` ↔
    /performed( or complied)?/i AND /in all material respects/i (cards
    `3a0c665c`, `84353d88`); `REGULATORY_APPROVAL` ↔ /\bHSR Act\b/
    (case-sensitive) OR /waiting period/i OR
    /jurisdictions set forth in/i (card `fa44d3ce`). Asserted-kind
    mismatch → review, typed `CONDITION_KIND_UNCORROBORATED`.
  - `rep_side`: `TARGET_REPS` ↔ /of the Company(?!\s+Merger\s+Sub)(
    Entities)?\b/ (case-sensitive "Company"; grounded `066e1fd7`,
    `ae155f39`); `BUYER_REPS` ↔ /representations and warranties (made by|
    of) Parent\b/ (grounded `f10b6b21` "representations and warranties
    made by Parent, Company Merger Sub…" — note the buyer-side quote
    CONTAINS the token "Company" inside "Company Merger Sub"; the
    original `/representations and warranties of the Company( Entities)?/`
    draft was spoofable by "of the Company Merger Sub" word order — buyer
    drafting like "the representations and warranties of the Company
    Merger Sub and Parent…" would corroborate TARGET_REPS while the buyer
    pattern's contiguous "(made by| of) Parent" never fires, a resolved
    mislabeled claim. The negative lookahead `(?!\s+Merger\s+Sub)` closes
    that gap; this table MUST be corpus-validated against all 38
    COND-S-REP card bytes before freezing, per audit finding M3). Both
    match → review `AMBIGUOUS_REP_SIDE`; neither → review
    `REP_SIDE_UNCORROBORATED`. Entity-soup drafting (four merger subs)
    will queue some correct claims; priced.
  - `mae_party`: `TARGET` ↔ /\bCompany Material Adverse Effect\b/
    (case-sensitive; grounded `c0d6b18f`). `BUYER` — **NO corroboration
    pattern this slice; queues unconditionally**, typed
    `MAE_PARTY_UNCORROBORATED` (the TERMR NO_SOLICITATION_BREACH
    precedent verbatim): the buyer-side mirror exists in the corpus only
    as null-subtype card LABELS ("[PROPOSED] Absence of Parent Material
    Adverse Effect"), and labels are not agreement text; fabricating a
    "Parent Material Adverse Effect" pattern without quote bytes violates
    the grounding rule. Grounded text → reviewed diff, later.
  - `obligor_ref` positional gate (the TERMR C-2 device — every covenant
    condition names the counterparty's agreement too, so a substring gate
    alone passes a swapped obligor): the quote must match
    /\b(each of )?<obligor_ref> shall have performed/i anchored on the
    verbatim ref (both grounded grammatical forms: "Kraft shall have
    performed…", "Each of Parent, Company Merger Sub, Parent OpCo and
    OpCo Merger Sub shall have performed or complied…"). Failure →
    review, typed `OBLIGOR_REF_UNCORROBORATED`.
  - `approval_kind`: `HSR` ↔ /\bHSR Act\b/ (case-sensitive, word-bounded);
    `SCHEDULED_APPROVALS` ↔ /jurisdictions set forth in Section/ (grounded
    `fa44d3ce`; the pattern is matched against LITERAL committed fixture
    bytes — the pack quote truncates at "Disclosu", so no pattern may
    require the word "Disclosure"). The FCC/LFA card `ecb30ef5` matches
    neither → review, typed `APPROVAL_KIND_UNCORROBORATED` — the designed
    outcome for industry-specific regulatory shapes, permanently pinned as
    a regression fixture. Both kinds in one quote (the `fa44d3ce` clause
    carries HSR limb (i) AND scheduled limb (ii)) is TWO claims; the
    producer splits; an unsplit quote matching both →
    `AMBIGUOUS_APPROVAL_KIND` review.
- **Accuracy-standard gate + M2 pins:** BRING_DOWN_TIER canonical value =
  the producer's code, checked by `canonicalValueAllowed` against the
  registered four-code list; out-of-vocabulary codes (including v1's
  `MAT_MATERIALITY_SCRAPE` and `MAT_MAE_AGGREGATE`) → explicit
  `pushOpenWorld`, typed `ACCURACY_STANDARD_OUT_OF_VOCABULARY` — NEVER
  aliased in via `lib/bring-down-tiers.js`'s `TREATMENT_ALIASES` (that
  module is v1 recovery machinery; importing it here would smuggle
  nearest-fit into v2). Every resolved tier claim carries
  `buildMechanicalAnswerProvenance({ extraPins: { gate:
  'ALLOWED_VALUES_MEMBERSHIP' } })` — byte-identical pins to the existing
  path — plus the `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING`
  unevaluated-conditions entry, keyed strictly on
  `registered_claim_definition_key === 'REPRESENTATION_ACCURACY_STANDARD'`
  (M2 section above; both paths resolve into that definition — never keyed
  on the presence of the gate pin alone). The three other presence/enum
  definitions in this slice are ALSO membership-gated model choices where
  the code is producer-chosen (`COVENANT_COMPLIANCE_STANDARD`,
  `NO_MAE_CONDITION`, `NO_MAE_CONDITION_CONTINUING`,
  `REGULATORY_APPROVAL_CONDITION`): the same `gate:
  'ALLOWED_VALUES_MEMBERSHIP'` provenance-tag construction applies there
  for the same honesty reason — presence claims (`[true]`) carry that tag
  too, uniformly, one tag-construction story per family — but the
  `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` auto-pass-block does NOT
  extend to those other definitions. Ben's ack
  (CLAIM-IDENTITY-APPROVALS-2026-08-01 item 2) approved the bring-down
  tier provenance revisit only; keying the block on the gate pin instead
  of the claim definition would silently widen that approval to the whole
  family, which Known costs (below) explicitly disclaims. COVENANT_COMPLIANCE
  canonical value = the producer's code, checked by `canonicalValueAllowed`
  against the registered one-code enum; out-of-enum → explicit
  `pushOpenWorld`, typed `COVENANT_STANDARD_OUT_OF_VOCABULARY` (audit
  finding m4; same routing shape as `ACCURACY_STANDARD_OUT_OF_VOCABULARY`,
  never a bare "review" destination).
- **Pre-concept review routing:** review items minted before concept
  assignment carry conceptFamily `'COND-PENDING'` (the TERMF-PENDING
  precedent) — any `COND-*` token prefix-matches the existing
  CLOSING_CONDITIONS tier → rank 70; a bare null would rank UNCLASSIFIED
  99 and sort this family's predicted-common review classes below notices,
  inverting the M3 queue. `'COND-PENDING'` is a routing token only — never
  registered, never publishable.
- **Party:** `obligor_ref` (COND-COV) and the bring-down
  `condition_obligor` flow through the existing
  `resolveParty`/`PARTY_CAPACITY_LEXICON` path → role `CONDITION_OBLIGOR`;
  unresolvable → existing `PARTY_UNRESOLVED` review. COND-REG (mutual) and
  COND-MAE claims mint no counterparty tuple this slice — asserting a
  beneficiary that the quote does not name is an asserted party with no
  quote of its own (the TERMF payee ruling verbatim).
- **Identity:** assertion kind, rep_side, covered_scope_ref,
  accuracy-standard code, mae_party, approval_kind and obligor party all
  participate in claim identity/closure — a three-tier §7.2(a) with a
  de-minimis fundamental tier and an MAE-qualified general tier mints
  distinct, stable, non-deduping claims; so do HSR and scheduled-approval
  claims in one section.
- **Receipt + additivity (honest form, P1 M-1):** with no
  closing-condition input, resolution output must be byte-identical EXCEPT
  `mapping_table_version`, `contract_vocabulary_digest` (under the new
  bundle version), the recomputed `resolution_receipt_id` — AND, uniquely
  in this wave, the documented `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING`
  addition on existing capitalisation-path tier claims (a spec'd change,
  field-level diff in the PR, never smuggled). No parser-version fields
  exist to add (section 2). Skipping the version bump to keep old pins
  green is the named anti-pattern.

## 5. Lexicon additions (`LEXICAL_FAMILY_LEXICON` version bump; keys MUST be
registered concept keys — which is why all four new concepts land in this
same slice; every edit is a reviewed diff; explicit `\b` on every
case-sensitive defined-term regex per the TERMR boundary pin)

**Side-symmetric phrases, keyed under both sides (audit finding M4):**
corpus-verified as zero-side-discriminating noise if keyed to one side only
— "true and correct in all respects" appears in 11/38 COND-S-REP cards
despite being COND-B-REP-keyed, and `/\bFundamental Representations\b/`
appears in 5/47 COND-B-REP cards (Company-Fundamental-Representations
drafting) despite being COND-S-REP-keyed. Both phrases are therefore keyed
under BOTH concepts below. "qualified by materiality" is DROPPED outright
(n=2 across both rep subtypes — zero discriminating power, not worth
keying to either side).

- `COND-B-REP`: LITERAL_PHRASE "true and correct in all respects"
  (`066e1fd7`), "representations and warranties of the Company"
  (`066e1fd7`, `ae155f39`); BOUNDED_REGEX /\bFundamental Representations\b/
  (case-sensitive, cross-hit precedent — Company-Fundamental-Representations
  drafting corroborates this concept in 5/47 corpus cards).
- `COND-S-REP`: LITERAL_PHRASE "representations and warranties made by
  Parent" (`f10b6b21`), "true and correct in all respects" (cross-hit
  precedent — appears in 11/38 corpus cards);
  BOUNDED_REGEX /\bFundamental Representations\b/ (case-sensitive,
  `f10b6b21` "Parent Fundamental Representations"). "qualified by
  materiality" is NOT keyed here (dropped — see above).
- `COND-MAE`: BOUNDED_REGEX /\bMaterial Adverse Effect\b/ (case-sensitive);
  LITERAL_PHRASE "shall not have occurred", "that is continuing" (all
  `c0d6b18f`). **Priced cross-hit noise, pinned like TERMR's Outside-Date
  cost:** the MAE defined term verifiably appears inside bring-down tier
  drafting ("except where failure … would not have an MAE"-shaped
  standards) and MAE-definition sections — expected
  `LEXICAL_UNMATCHED_SIGNALS` hits outside COND-MAE candidate evidence.
  Accepted and recorded: the defined term is the family's strongest veto
  tell; deletion asymmetry applies; the anti-noise test pins one such hit
  as EXPECTED so a future silent deletion breaks a test.
- `COND-COV`: LITERAL_PHRASE "performed in all material respects"
  (`3a0c665c`, `c5b50bfe`), "performed or complied in all material
  respects" (`84353d88`), "obligations, agreements and covenants"
  (`84353d88`), "obligations required to be performed" (`3a0c665c`).
- `COND-REG`: BOUNDED_REGEX /\bHSR Act\b/ (case-sensitive); LITERAL_PHRASE
  "waiting period", "expired or been terminated" (all `fa44d3ce`).

Priced exclusions (deletion-asymmetry doc-comment applies; every miss costs
a missed VETO, never a wrong claim): naked "condition(s)", "satisfied",
"waived", "fulfillment"/"fulfilment", "Closing"/"Closing Date" — the
preamble fixture `50f19dfa` proves all of them sit in every conditions
chapeau with zero discriminating power, and predictable noise pressures
lexicon deletions, which widen auto-pass; naked "material" and
"materiality" (rep-section chapeau prose corpus-wide); "certificate" /
"officer's certificate" (CERT unpromoted; a certificate condition's only
tells are cross-references — recorded blind spot); "Governmental Entity",
"consents", "approvals" (ubiquitous defined terms; only the
antitrust-specific phrases cover COND-REG). Unregistered condition families
(stockholder approval, legal impediment, S-4, listing, funds, frustration)
have no lexicon keys because they have no registered concepts — they are
not `LEXICON_FAMILY_UNCOVERED` rows, they are outside the family domain
entirely until their follow-on slice registers them; named here so nobody
reads their absence as coverage.

## 6. Acceptance tests (real-fixture-first; pre-rerun harness per P1 M-5 for
everything except the capitalisation bring-down sub-path, which has live
recordings and must keep replaying)

0. **Fixture commit:** condition-section text for the named cards
   (`066e1fd7`, `ae155f39`, `f10b6b21`, `c0d6b18f`, `c5b50bfe`, `3a0c665c`,
   `84353d88`, `fa44d3ce`, `ecb30ef5`, `50f19dfa`) committed as LITERAL
   production bytes under
   `tests/fixtures/canonical-v2/closing-conditions-fixtures/` (the
   prose-fingerprint-exempt directory class — deliberate, documented in the
   fixture README), provenance headers recording true card ids and
   subtypes (including NULL where true — the TERMF m-2 discipline). Every
   test quote asserted a contiguous substring of committed bytes.
   **Note on `c5b50bfe` (audit finding m5):** this card is QXO/TopBuild
   §5.2(a), the very section the scope fence (section 3) excludes from the
   conditions prompt dispatch on that deal — the compound-ambiguity
   regression fixture built from it (test 2) is exercisable ONLY at the
   synthetic-candidate resolver layer, never as a dispatch-level/live-run
   fixture; the fixture README and test 2 must say so explicitly so nobody
   later writes a dispatch-level version of this regression that the scope
   fence would silently prevent from ever firing.
1. **Registry:** next version compiles; prior arrays untouched
   byte-for-byte; four concepts + three definitions validate with zero
   validator changes; expected-keys superset-diffs written against sorted
   content, not version numerals.
2. **Resolution (pre-rerun harness, synthetic candidates over committed
   bytes):** rep_side split — `066e1fd7`/`ae155f39` tiers → COND-B-REP,
   `f10b6b21` tier → COND-S-REP; a BUYER_REPS label on a target-reps quote
   → `REP_SIDE_UNCORROBORATED`; a quote containing both side patterns →
   `AMBIGUOUS_REP_SIDE`; covered_scope_ref not-in-quote typed; accuracy
   codes resolve under allowed-values with the M2 pins asserted
   (`answer_provenance.gate === 'ALLOWED_VALUES_MEMBERSHIP'` on EVERY
   resolved tier claim, both paths); `MAT_MAE_AGGREGATE` and
   `MAT_MATERIALITY_SCRAPE` exercise `pushOpenWorld`
   (`ACCURACY_STANDARD_OUT_OF_VOCABULARY`);
   `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` present in
   `unevaluated_conditions` on tier claims from BOTH the conditions path
   and a replayed capitalisation-path fixture; `c0d6b18f` resolves
   NO_MAE_CONDITION and NO_MAE_CONDITION_CONTINUING as two claims; a
   MAE_CONTINUING assertion whose quote lacks "is continuing" →
   `CONDITION_KIND_UNCORROBORATED`; mae_party BUYER →
   `MAE_PARTY_UNCORROBORATED` unconditionally; `3a0c665c`/`84353d88`
   resolve COVENANT_COMPLIANCE with obligor positional gate, and the SAME
   quote with `obligor_ref` swapped to the counterparty (present verbatim,
   wrong position) → `OBLIGOR_REF_UNCORROBORATED`, never a resolved swapped
   claim; `fa44d3ce` full quote → `AMBIGUOUS_APPROVAL_KIND`, its
   hand-enumerated HSR and scheduled sub-quotes resolve one claim each;
   `ecb30ef5` (FCC) → `APPROVAL_KIND_UNCORROBORATED` (permanent regression
   fixture); `c5b50bfe` full compound quote → `AMBIGUOUS_CONDITION_KIND`,
   its sub-quotes resolve; out-of-enum assertion_kind exercises explicit
   `pushOpenWorld`; materiality rank 70 asserted on a resolved claim AND a
   `COND-PENDING` review item; additivity re-pin with the documented
   field-level diff including the revisit-pending addition.
3. **Identity:** two same-section tiers differing only in
   covered_scope_ref/standard mint distinct stable identities; HSR +
   scheduled claims in one section never collide; NO_MAE and CONTINUING
   never dedupe; re-run is byte-stable.
4. **Provider + dispatch:** response missing `closing_condition_assertions`
   → empty list, not schema failure; recorded capitalisation fixtures
   replay byte-identically at the provider/prompt layer through the
   registry seam, with `NATIVE_BRING_DOWN_TIER_CANDIDATE` output unchanged;
   section-family classifier: conditions-article fixture titles classify
   CLOSING_CONDITIONS, rep/covenant/fee titles do NOT, validated against
   all deals' section titles; capitalisation-scope overlap → conditions
   prompt not dispatched, typed `SECTION_CLAIMED_BY_CAPITALISATION_SCOPE`;
   unknown-title annex fixture ("ANNEX-COND(i)") → typed unknown-family
   record, no prompt.
5. **Lexicon:** table validation (keys registered, explicit `\b` on
   case-sensitive regexes, static max ≤ 128, rationale per pattern, content
   hash re-pinned, version bump); anti-noise regression paragraph extended
   with the `50f19dfa` preamble chapeau (asserting the excluded tokens
   produce zero hits) and rep-section chapeau prose ("represents and
   warrants", "in all material respects" inside a covenant SECTION is
   allowed to hit COND-COV — that is a veto working, asserted as expected);
   one MAE-defined-term hit inside a bring-down tier quote pinned as an
   EXPECTED unmatched-signal (the priced cross-hit, deletion-proofed by
   test); one EXPECTED rep-side cross-hit per side-symmetric phrase pinned
   the same way (audit finding M4) — a COND-S-REP-side quote hitting the
   "true and correct in all respects" pattern asserted as expected under
   COND-B-REP AND COND-S-REP, and a COND-B-REP-side
   "Fundamental Representations" quote asserted as expected under both
   concepts; each surviving pattern hits its own grounding quote in
   committed fixtures.
6. Full suite + `npm run build` + forbidden-patterns (fixtures inside the
   exempt directory class; zero new exemption entries needed); phase
   allowlist for the slice's files.

## Out of scope

- Promotion of COND-M-STOCKHOLDER / COND-M-LEGAL / COND-M-S4 /
  COND-M-LISTING / COND-S-FUNDS / COND-FRUSTRATE (follow-on slice with its
  own grounding pass), CERT (cross-reference machinery — a certificate
  condition's content is citations to sibling conditions, card `479563d7`;
  resolving those is the relationship layer, not quote-local production),
  and both PREAMBLE shapes (structure).
- Every unpromoted v1 feature: burdensome-condition presence/scope (enum
  leakage observed in production — pack §7 — and its vocabulary collides
  with a lint fingerprint; its promotion needs its own reviewed slice),
  government-proceeding / enjoining-order details, closing-timing prose,
  tender-offer minimum conditions, dollar thresholds and de-minimis caps,
  dissenting-share thresholds, funds conditions, frustration modifiers,
  `citedProvisionNames` / `approvalDefinition` post-pass fields.
- The 74 null-subtype cards and "[PROPOSED]" categories: flagged to
  ingest-QA and the open-world commonality report — real content (buyer-MAE
  mirrors, financing conditions, closing-deliverables) needing NEW codes by
  Ben adjudication, not regex coverage of the existing 17 (pack defect 12).
- The two empty dedicated bring-down tables (drop vs. backfill is a Ben
  data-hygiene decision; this slice's claims flow through the standard
  write-set path only).
- `lib/bring-down-tiers.js` (v1 recovery machinery, untouched; its
  `MAT_MAE_AGGREGATE` alias gap is flagged, not fixed).
- The M2 revisit itself — Ben's ruling, recorded in docs/acks/ when made;
  this slice only keeps the pending state mechanical and loud.
- FAMILY_MAPPING_TABLE extension for v1↔v2 subtype mapping (separate
  Fable+Ben table edit with the wiring slice — the -B/-S side semantics
  make this table Ben-reviewed, never implementer-inferred).
- Live re-extraction runs (dated handoffs; until they land, no report may
  claim native closing-conditions extraction beyond the already-proven
  capitalisation bring-down sub-path); any M3 amendment; any
  scope-closure/ABSENT work.

## Known costs, stated up front

- **Compound clauses are this family's norm** (pack §8 item 8): until
  producers split reliably, `AMBIGUOUS_CONDITION_KIND` review volume will
  be material. With no parser to blame, the full-table kind check is the
  only compound defense — never loosened; two-strike escalation applies to
  prompt iteration.
- Buyer-side MAE conditions queue unconditionally (zero grounded quote
  bytes); a queued correct mirror beats a fabricated pattern.
- Industry-specific regulatory shapes (FCC/LFA class) queue as
  `APPROVAL_KIND_UNCORROBORATED` by design; the remedy is new adjudicated
  codes from the commonality report, never widening `SCHEDULED_APPROVALS`.
- Multi-entity party drafting ("Each of Parent, Company Merger Sub, Parent
  OpCo and OpCo Merger Sub") will cost `PARTY_UNRESOLVED` /
  `AMBIGUOUS_REP_SIDE` queue items; live-run handoffs measure the rate;
  new grammatical forms land by reviewed diff.
- Tender-offer condition annexes may not classify (title-regex hole, pack
  §8 item 1) — under-coverage is typed and measurable, never silent.
- The MAE defined-term lexicon pattern floods unmatched signals in
  MAE-adjacent sections; accepted (strongest veto tell; deletion asymmetry;
  pinned by test).
- Every bring-down tier claim in the family — old path and new — remains
  auto-pass-blocked by `BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING` until
  Ben's revisit. That is not a defect; it is the approved decision holding
  its own line.
