# Claim identity, qualifier classification and provenance

**Date:** 2026-08-01
**Approved by:** Ben (in-session, 2026-08-01), decision by decision; spec as
amended APPROVED by Ben 2026-08-01, including: Task 8 (recall and volume
instrumentation) stays in this slice; unenriched date claims publish with the
not-comparable mark; search defaults to "all results, with warnings" with one
clear control to switch.
**Status of prior audits:** the qualifier-kind classifier incorporates all
six amendments from the first Fable adversarial audit of 2026-08-01, plus
Ben's exception-connective refinement which supersedes the audit's blunt
co-occurrence rule. A second Fable audit (spec + whole pipeline) produced the
two-node limb model, the written binding algorithm, the widened corpus key,
the VERIFIED source pin, the corroborated-only auto-pass block, the staged
validator requirement, and Task 8.

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

The producer emits `limb_path` arrays (e.g. `["(ii)","(A)"]`). Real drafting
reuses one marker for several distinct assertions: the run-2 recording
carries THREE separate assertions under bare `["(ii)"]` (the measurement-date
chapeau, the Disclosure-Letter list representation, and the subsidiary-shares
representation). A single union-span component would conflate legally
distinct representations under one claim subject (2026-08-01 audit, finding
A1 — blocking). The resolver therefore mints TWO node kinds:

- **Path nodes** — one per distinct `limb_path`: content-derived id from
  (provision_instance_id, limb_path); explicit `parent_limb_component_id`
  (missing ancestors are minted; a path node's own span is null unless an
  assertion supplies one — spans live on assertion nodes, never invented);
  `ordinal_under_parent`; verbatim `limb_path`. Structure only.
- **Assertion nodes** — one per compiled assertion proposal: content-derived
  id from (path node id, assertion ordinal); parent is the path node; a real
  `SEMANTIC_SPAN/V1` covering exactly that assertion's own byte-verified
  evidence. Assertion nodes are the claim subjects. **Ordinal definition
  (round-2 audit, finding 3):** the ordinal is the assertion's rank among
  its siblings by (verified span start, span end), tie-broken by the hash of
  the normalised quote — NEVER producer emission order. Two runs emitting
  the same assertions in different array order mint identical ids; a
  permutation test enforces this.

Qualifier attachment rules over the tree (round-2 audit, finding 4 — all
four cases defined):

- Ambiguity counts ASSERTION children only; path-node children do not make
  an attachment ambiguous.
- Exactly one assertion child → the qualifier attaches to that assertion.
- Multiple assertion children → attaches to the path node with a typed
  `ASSERTION_SCOPE_AMBIGUOUS` reason, auto-pass blocked, routed to review.
  **Scope flow-down is SUSPENDED while the ambiguity is unresolved** — an
  ambiguous attachment governs nothing via traversal.
- Zero assertion children (a pure structural node over sub-limbs) → the
  qualifier is a chapeau of that node: it attaches to the path node and
  scope flows down to descendants.
- Review has a `GOVERNS_WHOLE_NODE` resolution outcome: a human ruling that
  the qualifier deliberately governs the whole node (e.g. the "As of April
  17, 2026" chapeau over (ii)(A)–(C)); flow-down enables on that ruling.

Never spread across siblings by default: the run-2 securities-law carve-out
governs only ONE of limb (ii)'s three assertions in the source text.

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
   co-occurrence rule).** Auto-binding connectives: "except", "except for",
   "except as", "other than", "excluding". "provided that" and "subject to"
   are NOT auto-binding — they can introduce independent obligations — so a
   multi-family quote containing them routes by the doubt rule instead. The
   binding algorithm (2026-08-01 audit, finding A2 — blocking; two
   implementers must produce the same classifier):
   - Tokenise the normalised quote tracking parenthetical depth.
   - A bound clause opens at a connective. A comma at the connective's own
     depth closes it ONLY when the continuation after that comma (up to the
     next boundary at the same depth) contains a lexicon marker or another
     connective; otherwise the bound clause extends through the comma
     (round-2 audit, finding 1 — blocking: the first-comma rule truncated
     the run-2 fixture's own "… Securities Act of 1933, as amended (the
     "Securities Act") or other applicable securities Laws" clause at the
     comma after "1933", and truncates any list exception "except for X, Y
     and Z, …" after X). Failing that, the clause closes at the FIRST of: a
     semicolon at the connective's depth, the close of the connective's
     enclosing parenthetical, or the end of the quote.
   - A connective inside a parenthetical binds within that parenthetical
     only. Nesting resolves innermost-first.
   - The host is the marker-bearing span immediately preceding the bound
     clause at the same depth. No preceding marker at that depth → the bound
     clause has no host → the quote routes by the doubt rule.
   - Defined outcomes for the known hard cases: "true and correct, except as
     provided in Section X, in all material respects" — the bound clause
     closes at the second comma; the trailing ACCURACY marker is OUTSIDE it
     and classifies. Nested "(other than …)" inside an "except for …" clause
     — inner binds within its parenthetical, outer binds to its own host.
     "Except as set forth in the Disclosure Letter …" — carries no marker;
     binding is a no-op and the clause routes as qualifier text unchanged.
   A marker inside a bound clause is part of the host's unit, never a
   separate qualifier: "true and correct, except for inaccuracies that are
   not material …" is ONE ACCURACY unit.
3. **Deterministic split.** If, after binding, two marker families fire on
   free-standing (unbound, non-overlapping) spans, code splits the quote.
   Split rules: parts must exactly partition the normalised quote at clause
   boundaries (commas/semicolons at depth zero); residue text without a
   marker stays with the adjacent host part, never dropped; every part
   re-verifies byte-exact against the admitted source (a part that fails
   verification voids the whole split → doubt rule); every part inherits the
   original qualifier's attachment position and `governs_path` unchanged.
   "true and correct in all material respects as of the Closing Date" splits
   into one ACCURACY and one TEMPORAL claim on the same attachment. Split
   applies pairwise to two OR MORE free-standing families; a three-family
   quote partitions the same way, each part classifying alone.
   **Measurement-date reachability, stated positively (round-2 audit,
   finding 2):** a TEMPORAL may reach the `REPRESENTATION_MEASUREMENT_DATE`
   mapping ONLY when (a) the whole quote fires TEMPORAL alone, or (b) the
   TEMPORAL part was split from an ACCURACY host. A TEMPORAL co-occurring
   with KNOWLEDGE or THRESHOLD in the same original quote dates the
   QUALIFIER, not the representation ("to the knowledge of the Company as
   of the date hereof" dates the knowledge): it never mints a measurement
   date; the date is preserved in the qualifier claim's `attributes` and
   the item routes per its host family.
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
   comes from a whitelist of exact normalised-phrase → code pairs, matched
   against the WHOLE normalised quote (round-2 audit, finding 9: whole-quote
   matching means at most one pair can match, so there is no precedence
   order). Zero matches → code null. Never nearest-fit. The initial pairs
   (Fable/Ben-governed, versioned with the lexicon): "true and correct in
   all respects" → `MAT_ALL_RESPECTS`; "true and correct in all respects,
   except for de minimis inaccuracies" (and the merged de-minimis phrasings)
   → `MAT_ALL_RESPECTS_DE_MINIMIS`; "true and correct in all material
   respects" → `MAT_ALL_MATERIAL`; the whole-rep "except as would not be
   material to the Company" form → `MAT_MATERIAL_TO_COMPANY`; the MAE-
   qualified form → `MAT_MAE_QUALIFIED`. Deal-specific variants that match
   no pair get code null and route to review — that is the intended intake
   for new whitelist pairs.

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
  **Consumer contract (Ben's ruling, 2026-08-01):** unenriched claims DO
  publish, carrying the mark. Any cross-deal date query MUST surface the
  count of deals it could not compare ("N deals not comparable for this
  field") — silent omission is forbidden. The mark ships in this slice's
  data model; the search-UI rendering of the count lands with the serving
  slice and is recorded here as a stated requirement so it cannot be
  silently dropped.
- **KNOWLEDGE → `KNOWLEDGE_QUALIFIER`.** Only when the KNOWLEDGE marker fires
  in the quote. Canonical value `true` per the registered definition; the
  knowledge standard (actual / constructive / after inquiry) is preserved in
  the claim's `attributes` so nothing is lost; promoting it into the
  definition is a future, evidence-backed decision for Ben.
- **THRESHOLD stays open world**, feeding the commonality report. Recorded
  rationale: the reviewed QXO slice itself proves blanket THRESHOLD mapping
  wrong (`limb_iv_outside_investment_materiality_is_not_general_qualifier`).

## 4. Ruling corpus

Every review-queue kind decision is stored as a ruling. The ruling KEY is
(exact normalised phrase, attachment position, concept family) — phrase
alone is too coarse: "in all material respects" ruled in a cap-rep chapeau
must not silently apply ITEM-attached in a different family (audit finding
A4). The record carries the ruled kind (and code where applicable), who
ruled, when, the provenance tag, and the lexicon version in force at ruling
time. The corpus is versioned like the lexicon and persisted as a
content-addressed JSON fixture in the repo, updated only through the
confirmation script — never hand-edited.

- Exact-key application: when a later quote normalises to a key with a
  VERIFIED ruling, code applies it. The application is MECHANICAL, linked to
  the originating VERIFIED ruling.
- **Lexicon-conflict flag:** on every application, code also runs the
  current lexicon. Only an AFFIRMATIVE different-kind fire is a conflict
  (lexicon abstention is not — round-2 audit, finding 10): a conflict routes
  to review with a typed `RULING_LEXICON_CONFLICT` reason. A stale ruling
  never permanently overrides a lexicon improvement.
- **Family for open-world items (round-2 audit, finding 8):** an unmapped or
  open-world item carries the concept family of its governing section-level
  provision in the ruling key. There is no null-family ruling.
- Near-match never applies. Anything not exact goes to review.
- The queue-shrinking benefit is a hypothesis, not a promise: recurring
  quotes often embed deal-specific dates and numbers, so the cross-deal
  exact-match rate must be MEASURED (see Recall and volume instrumentation)
  before it is relied on.

## 5. Provenance tags — MECHANICAL / AI / VERIFIED

Every stored answer (values, kinds, classifications, draft rulings) carries
exactly one source tag:

- **MECHANICAL** — produced by a written rule. Pins the rule and its version.
- **AI** — produced by a model, unconfirmed. Pins model, prompt version,
  skill/ruleset version. Always displayed with a health warning.
- **VERIFIED** — human approved (confirming either of the above, or
  correcting them). Pins reviewer, time, AND the source it was verified
  against: the canonical_text hash and the evidence excerpt id (audit
  finding A5 — "source text changes" must be detectable, and this repo has
  already lived a re-canonicalisation that shifted every offset).

Transitions: AI→VERIFIED and MECHANICAL→VERIFIED by human action. VERIFIED
never downgrades by itself. On source re-admission (a new canonical text for
the same filing), code compares the pinned hash: every VERIFIED answer whose
pin no longer matches routes back to review with a typed
`SOURCE_SUPERSEDED` reason — it is never silently carried forward and never
silently dropped. MECHANICAL answers re-derive on rule version bumps; the
old answer is kept, superseded and linked.

Surface consequences: the UI shows the tag everywhere; precedent search can
filter ("verified only" vs "all, with warnings"); open-world entries may be
shown as AI-tagged unregistered observations rather than hidden. **Search
default (Ben's ruling, 2026-08-01):** "all results, with warnings" while the
VERIFIED set is small, with exactly one clear control to switch to
"verified only". Warning-exposure should be logged so warning fatigue (audit
finding B7) becomes measurable rather than assumed.

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

## Citation guard and validator staging (audit amendments 5 and 6)

- **Corroborated-only citations never auto-pass.** Document-text
  corroboration is string presence, not node identity: a wrong citation can
  corroborate against a cross-reference to a different section anywhere in
  the agreement (audit finding B2). A candidate whose citation was accepted
  by corroboration alone (no tree construction) gets a typed
  `CITATION_CORROBORATED_ONLY` triage reason: it compiles, resolves and
  publishes with the fact visible, but it can never auto-pass and its
  citation surfaces as unconfirmed in review. Tree-constructed citations are
  unaffected.
- **`answer_provenance` is staged into the validator.** Requiring the field
  outright breaks every existing reviewed-slice write set and fixture (audit
  finding A6a). Stage 1 (this slice): the field is validated whenever
  present, and REQUIRED for write sets originating from the native producer;
  reviewed-slice write sets are untouched. Stage 2 (separate decision for
  Ben): backfill policy for stored rows, then the requirement becomes
  universal.

## Recall and volume instrumentation (audit-driven addition — for Ben's
confirmation, small and deterministic)

The audit's largest finding (B1) is that every gate is precision-only: run 2
silently dropped ~10 of 12 qualifiers and passed all gates at zero
residuals. Three cheap, deterministic instruments ship with this slice:

1. **Cross-run disagreement diff.** Both recorded F28 runs cover the same
   section. A deterministic comparator diffs two run receipts (limbs by
   path+span overlap, qualifiers by quote) and reports what each run
   proposed that the other did not. Standing gate on future paired runs;
   immediately runnable on the existing fixtures.
2. **Coverage proxies per governed section**, in the run receipt: share of
   governed-section bytes covered by verified assertion spans, and counts of
   marker occurrences in the SOURCE text ("as of", "except", "knowledge",
   "material") versus qualifiers the model emitted. A large gap is a typed
   `COVERAGE_SUSPECT` signal on the receipt — a recall smoke alarm, not a
   proof.
3. **Queue-volume dry run.** A script prices the review-queue and
   exact-match-corpus hit rates over a handful of deals BEFORE the 50-deal
   corpus is attempted (audit finding B6: one human verifier; the number has
   never been computed).

## Pinned implementation decisions (round-2 audit guess list — pinned so no
implementer guesses them)

- **Review-queue store:** the resolver's `review_queue` bucket is persisted
  by the run driver as a content-addressed `RESOLUTION_REVIEW_QUEUE/V1` JSON
  artifact alongside the run receipt. Tasks 4 and 7 read that artifact, not
  process memory.
- **Validator origin discriminator:** the write-set envelope gains
  `write_set_origin: 'NATIVE_PRODUCER' | 'REVIEWED_SLICE'`, set by the
  adapter. The staged `answer_provenance` requirement keys on it.
- **Typed reasons:** `ASSERTION_SCOPE_AMBIGUOUS`, `QUALIFIER_KIND_*`,
  `RULING_LEXICON_CONFLICT`, `SOURCE_SUPERSEDED`,
  `CITATION_CORROBORATED_ONLY` join the existing `triage.reasons` string
  enum in `candidate-resolution.js`; review-queue ordering keeps the
  existing materiality sort unchanged.
- **`MAPPING_TABLE_VERSION` becomes 3.** Version-2 receipts remain
  replayable; the receipt pins the version, per the existing pattern.
- **Model-hint absence:** a missing/null producer `kind` is ABSTENTION, not
  agreement and not disagreement — classification proceeds on the lexicon
  alone when exactly one family fires; otherwise the doubt rule.
- **Agreement date injection:** `measurement-date-parse.js` stays pure; the
  caller (`candidate-resolution.js`) injects the governed agreement date
  from the admitted source context's deal record. No governed date → the
  symbolic resolution abstains → open world.
- **Reviewer identity:** `scripts/confirm-kind-ruling.mjs` records the
  ruler from an explicit `--reviewer` argument; it refuses to write a
  ruling without one.
- Content-id derivation for new node/ruling ids follows the existing
  `contentId(domain, payload)` convention with new `/V1` domain strings, as
  everywhere else in `candidate-resolution.js`.

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
now resolves assertion nodes, date claims and knowledge claims instead of 22
open-world entries). The replay's asserted counts are an UNDER-EXTRACTION
baseline, not a target — the run-2 recording is itself missing ~10 of 12
qualifiers (audit finding A9); the test comments must say so. Then one fresh
live run so PROMPT_VERSION 4 meets real data, with the cross-run
disagreement diff run against it. Then a Fable adversarial audit of the diff
before Ben review.
