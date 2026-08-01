# Claim identity, qualifier classification and provenance

**Date:** 2026-08-01
**Approved by:** Ben (in-session, 2026-08-01), decision by decision
**Status of prior audit:** the qualifier-kind classifier section incorporates
all six amendments from the Fable adversarial audit of 2026-08-01, plus Ben's
exception-connective refinement which supersedes the audit's blunt
co-occurrence rule.

## Purpose

Close the gap recorded in the 2026-08-01 handoff: the native extractor proves
plumbing but publishes nothing, because the producer's generic claim keys have
almost no registered resolution. Close it without registering any new claim
definition and without letting any model assign canonical identity.

Five pieces, all in the resolver layer plus one producer-prompt cleanup:

1. Limb identity with explicit parent links.
2. A deterministic, versioned qualifier-kind classifier.
3. Two new mappings into ALREADY-REGISTERED claim definitions.
4. A ruling corpus that turns review decisions into mechanical rules.
5. A three-tag provenance model (MECHANICAL / AI / VERIFIED) on every stored
   answer.

Plus: producer controlled-vocabulary cleanup (PROMPT_VERSION 4).

## Non-goals — explicitly out of scope

- No new claim definitions. Zero. New vocabulary comes later, from
  commonality-report evidence plus Ben's approval.
- No change to the auto-pass block in `candidate-resolution.js`. It stays
  closed until the v1/v2 comparator and lexical-disagreement nets exist.
- No relationship resolution.
- No model call anywhere in the resolver. Every resolver decision remains a
  pure function of its inputs.
- The `REPRESENTATIONS` materiality rank 55 stays flagged as unadopted.

## 1. Limb identity

The producer emits `limb_path` arrays (e.g. `["(ii)","(A)"]`). The resolver
mints one limb component row per distinct limb path within a governed
representation:

- `limb_component_id` — content-derived, minted by code from
  (provision_instance_id, limb_path). Never model-supplied.
- `parent_limb_component_id` — explicit link to the parent limb's component
  (null for top-level limbs). The tree is real links, not only path strings.
- `ordinal_under_parent` — position among siblings.
- `limb_path` — kept verbatim for display and citation.
- A real `SEMANTIC_SPAN/V1` covering the union of that limb's byte-verified
  assertion evidence. Where multiple proposals share a limb path, the span is
  the union of their verified spans; the component is minted once.

Ben's requirement: a limb may be a representation in its own right (e.g.
(a) no-conflict, (b) authority under one section heading). Therefore:

- A claim's subject may be a limb component, not only the section-level
  provision. Materiality, knowledge, date and accuracy claims attach at
  either level under identical rules.
- Concept-family resolution is permitted at limb level. The section-level
  provision keeps its family; a limb may carry a different one when a future
  mapping resolves it. (No limb-level family mapping ships in this slice —
  the capability ships; `REP-T-CAP` remains the only family the producer
  emits.)
- Qualifier scope flows down the parent links: a qualifier attached to limb
  (ii) governs (ii)(A), (ii)(B), (ii)(C). Scope queries traverse the tree.

The existing `BRINGS_DOWN` target contract already addresses
`PROVISION_COMPONENT` / `REPRESENTATION_LIMB` rows; this section supplies the
mechanical mint for them from native-producer output.

## 2. Deterministic qualifier-kind classifier

Motivation (recorded): the model classified the identical clause ACCURACY in
live run 1 and THRESHOLD in live run 2. Identity must not be keyed on an
unstable model field.

### The lexicon

A fixed marker table, `QUALIFIER_KIND_LEXICON_VERSION`-stamped, pinned in
every resolution receipt alongside `MAPPING_TABLE_VERSION`:

- KNOWLEDGE: "to the knowledge of", "known to", "aware of" family.
- TEMPORAL: "as of" + either a calendar date the code parses, or a member of
  a closed symbolic-date list: "the date hereof", "the date of this
  Agreement", "the Closing Date", "the Effective Time" (extensible only by
  lexicon version bump).
- ACCURACY: "true and correct", "correct and complete" (as a truth standard),
  "in all respects", "in all material respects" family.
- THRESHOLD: "material to …", monetary and percentage thresholds, de minimis
  carve-outs.

Rules, in order:

1. **Normalise first.** Quotes pass through `zero-width-normalise.js` before
   marker matching. Comparison only; stored text never changes.
2. **Exception-connective binding (Ben's rule, supersedes the audit's
   co-occurrence rule).** Code first locates exception connectives: "except",
   "other than", "excluding", "provided that", "subject to". A clause
   introduced by a connective is BOUND to the phrase it modifies. A marker
   inside a bound clause is part of the host's unit, never a separate
   qualifier. "true and correct, except for inaccuracies that are not
   material …" is ONE ACCURACY unit; the inner "material" does not fire
   THRESHOLD.
3. **Deterministic split.** If, after binding, two marker families fire on
   free-standing (unbound, non-overlapping) spans, code splits the quote into
   parts. Each part must re-verify byte-exact against the admitted source.
   Each part then classifies alone. "true and correct in all material
   respects as of the Closing Date" splits into one ACCURACY and one TEMPORAL
   claim.
4. **Single-family fire + model agreement → kind set.** The model's `kind` is
   a hint only.
5. **Doubt routing is asymmetric.** Doubt at the ACCURACY boundary (lexicon
   fires ACCURACY and model disagrees; model claims ACCURACY and lexicon
   abstains or disagrees; entangled ACCURACY/THRESHOLD that binding cannot
   settle) → review queue with typed reason `QUALIFIER_KIND_DISAGREEMENT` /
   `QUALIFIER_KIND_UNCLASSIFIED`. Doubt among KNOWLEDGE / THRESHOLD /
   TEMPORAL only → open world, as today. Rationale: only ACCURACY is
   identity-bearing under the current table; the queue is reserved for the
   one decision that can corrupt identity.
6. **Identity keys on kind AND attachment position.** Only a
   representation-level (CHAPEAU) ACCURACY qualifier may resolve to
   `REPRESENTATION_ACCURACY_STANDARD`. An ITEM-attached (limb-level) ACCURACY
   qualifier goes to review — never minted as a rep-level claim.
7. **Code derivation by exact phrase only.** The controlled ACCURACY code
   comes from a whitelist of exact normalised-phrase → code pairs with a
   stated precedence order. Zero matches → code null. Two or more → code
   null and review. Never nearest-fit.

### Governance

Lexicon and whitelist edits are identity-semantics changes: Fable-tier,
Ben-reviewed. A version bump must state the supersession policy for stored
claims resolved under older versions (re-derive with supersession links, or
block cross-version comparison for the affected family). Receipts pin the
version, so every stored resolution is traceable to the exact rules that
produced it.

## 3. Two mappings into already-registered definitions

- **TEMPORAL → `REPRESENTATION_MEASUREMENT_DATE`.** Only when code itself
  produces the ISO date: a parsed calendar date from the quote, or a symbolic
  date resolved deterministically from deal metadata (e.g. "the date hereof"
  → the agreement date, when that date is already governed data). The model
  never supplies the canonical value. Unresolvable → open world. Every claim
  minted this way is marked unenriched and NOT comparable across deals until
  the enrichment pass (the existing signing-anchor derivation) mints an
  enriched revision. Extract-then-enrich is Ben's approved model.
- **KNOWLEDGE → `KNOWLEDGE_QUALIFIER`.** Only when the KNOWLEDGE marker fires
  in the quote. Canonical value `true` per the registered definition; the
  knowledge standard (actual / constructive / after inquiry) is preserved in
  the claim's `attributes` so nothing is lost; promoting it into the
  definition is a future, evidence-backed decision for Ben.
- **THRESHOLD stays open world**, feeding the commonality report. Recorded
  rationale: the reviewed QXO slice itself proves blanket THRESHOLD mapping
  wrong (`limb_iv_outside_investment_materiality_is_not_general_qualifier`).

## 4. Ruling corpus

Every review-queue kind decision is stored as a ruling: exact normalised
phrase, ruled kind (and code where applicable), who ruled, when, and the
provenance tag of the ruling. The corpus is versioned like the lexicon.

- Exact-match application: when a later quote normalises to a phrase with a
  VERIFIED ruling, code applies it. That application is MECHANICAL (the tag
  names who produced this answer; the rule's record points to the verified
  ruling that created it).
- Near-match never applies. Anything not exact goes to review.
- The corpus is the classifier's own precedent system; the queue shrinks as
  drafting repetition accumulates.

## 5. Provenance tags — MECHANICAL / AI / VERIFIED

Every stored answer (values, kinds, classifications, draft rulings) carries
exactly one source tag:

- **MECHANICAL** — produced by a written rule. Pins the rule and its version.
- **AI** — produced by a model, unconfirmed. Pins model, prompt version,
  skill/ruleset version. Always displayed with a health warning.
- **VERIFIED** — human approved (confirming either of the above, or
  correcting them). Pins reviewer and time.

Transitions: AI→VERIFIED and MECHANICAL→VERIFIED by human action. VERIFIED
never downgrades by itself; it changes only if the source text changes or a
human re-rules. MECHANICAL answers re-derive on rule version bumps; the old
answer is kept, superseded and linked.

Surface consequences: the UI shows the tag everywhere; precedent search can
filter ("verified only" vs "all, with warnings"); open-world entries may be
shown as AI-tagged unregistered observations rather than hidden.

**The invariant that does not move:** tags cover answers, never identity.
Which claim definitions exist, and which registered key a claim resolves to,
remains MECHANICAL or VERIFIED only. No AI-assigned identity, tagged or not.

### AI review drafter (the one new AI use)

A cheap model (Codex per routing rules), driven by a skill file containing
the kind definitions, the exception-connective rule and the ruling corpus,
drafts a recommended ruling for each queued quote, with reasons anchored to
the quoted words. The draft populates the answer field immediately,
AI-tagged. Ben confirms or corrects; the confirmation — not the draft —
enters the corpus as VERIFIED. A wrong draft costs one correction and cannot
corrupt data.

## 6. Producer vocabulary cleanup — PROMPT_VERSION 4

`ACCURACY_STANDARD` controlled vocabulary changes, all ruled by Ben
2026-08-01:

- REMOVE `MAT_MATERIAL_INLINE` — superseded by limb-attached THRESHOLD
  qualifiers (richer: quote, span, attachment). v1 taxonomy keeps the code;
  the future differential net maps v1 `MAT_MATERIAL_INLINE` ↔ v2
  limb-attached THRESHOLD.
- REMOVE `MAT_MATERIALITY_SCRAPE` — a bring-down property; the bring-down
  structures already carry a scrape field; not a rep-qualifier code.
- REMOVE `MAT_NO_QUALIFIER` — an absence assertion; absence comes from code
  with a coverage proof (the reviewed-slice pattern), never from the model.
- REMOVE `MAT_MAE_AGGREGATE` — aggregation is a qualifier property, not a
  separate accuracy standard; "individually or in the aggregate" is captured
  as an attribute on the MAE-qualified claim.
- MERGE `MAT_DE_MINIMIS` into `MAT_ALL_RESPECTS_DE_MINIMIS`.

Final list (5): `MAT_ALL_RESPECTS`, `MAT_ALL_RESPECTS_DE_MINIMIS`,
`MAT_ALL_MATERIAL`, `MAT_MATERIAL_TO_COMPANY`, `MAT_MAE_QUALIFIED`.

`KNOWLEDGE_STANDARD` and `QUALIFIER_POSITION` vocabularies are unchanged.
The v1 taxonomy (`lib/taxonomy.js`) is untouched.

## Error handling

House rule throughout: nothing fails silently. Every gate failure is a typed
reason carried in the data (`QUALIFIER_KIND_DISAGREEMENT`,
`QUALIFIER_KIND_UNCLASSIFIED`, split-part verification failures as evidence
residuals, unresolvable symbolic dates as open-world routing). Receipts pin
every version that participated in a decision.

## Testing

Test-first, house pattern: every rule above lands with a test that fails for
the right reason before the fix. Mechanical gates before merge: `npm test`,
`npm run build`, replay of BOTH recorded F28 fixtures (expected: run-2 replay
now resolves limb components, date claims and knowledge claims instead of 22
open-world entries). Then one fresh live run so PROMPT_VERSION 4 meets real
data. Then a Fable adversarial audit of the diff before Ben review.
