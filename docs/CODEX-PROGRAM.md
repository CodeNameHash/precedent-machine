# Canonicalization program: revised plan (response to the Codex review)

2026-07-20. Status: adopted as the governing spine, with the amendments
below. Canonical implementation and canonical data work remain blocked until
non-secret completion evidence records the Zayo disposition, rotation of the
exposed Claude credentials and, if Zayo is unrecognised, rotation of the
Supabase service secret; the isolated programme environment exists; this
architecture has received the required independent semantic review and Ben has
approved it. Production cutover and programme completion remain blocked until
the Phase 9 certification gates are mechanically green. The Codex
architectural review was independently fact-checked against the repo and
live production (five verification passes: admin pages, registry typing,
identity/lineage, the schema-shape docs, and a full inventory of
comparison-layer normalisers). This document is the governing plan; the
review's phase structure is kept, its factual base is corrected where
verification found nuance, and governance + sequencing rules are added.
docs/PLAN.md's work packages (WP-R1..R10) fold into the phases noted.

## Verification results (what we confirmed, corrected, or sharpened)

CONFIRMED as stated:
- provisions ↔ provision_cards has no FK in either direction; the only
  join is content-addressed best-effort (lib/query/prov.js, spanHash).
  Nuance kept for the record: claims → provision_cards IS a real
  DB-enforced FK (schema-05-claims.sql:32); the fragile seam is
  specifically provisions↔cards, and every downstream tool re-derives it
  by text matching.
- No concept_key exists anywhere in schema or code (grep: zero hits
  outside design prose). Cross-deal identity is the (type, category)
  string pair in the query engine and a subtype-string priority chain in
  the review UI; compareRowUnion's ROW_FAMILY map is an enumerated
  allowlist over KNOWN drift, not a key. The 2026-07-20 incidents
  (four deals with 50–89% null subtypes; the 'Unclassified' vs
  '[PROPOSED] Unclassified' sentinel matching zero of 475 real cards)
  are direct consequences.
- /admin/processing-flow metrics are hardcoded stubs (STAGE_METRICS_STUB,
  stub:true) and stage descriptions cover the target file-based pipeline,
  not the live Postgres path.
- /admin/schema-loss zeros are structural: residual capture is disabled
  by default (RESIDUAL_CAPTURE_ENABLED unset), Dimension A
  unconditionally returns empty clusters, and Dimension B reads a static
  artefact that is stale on the deployment (the committed local file has
  200 flagged entries while production shows 0).
- /admin/registry counts verified EXACTLY: 704 total / 455 pending /
  59 flagged / 29 suggested (+46 approved / 7 rejected). The active
  contract is not frozen.
- Registry typing errors are real: discussionInitiationNoticeHours
  data_type FLOAT_PERCENT; terminationFeePercentEquityValue,
  feePercentage, reverseFeePercentage, tailFeeThresholdPct all
  data_type USD_AMOUNT.
- The normaliser accumulation is real and "probably an understatement":
  dozens of regex/text-mining reconstructions in table configs exist
  because party_scope is baked MUTUAL, section subjects are unstored,
  mechanisms are stored as prose, and stored shapes drift.
- The general query route is also corpus-proportional on a cold serverless
  instance. `pages/api/query/run.js` calls `lib/query/context-cache.js`, which
  pages every `provisions` row including `full_text`, loads all deals and then
  runs the five executors over hydrated arrays in Node. Its 60-second cache is
  process-local, so another Vercel instance pays the full load again.
- The five active query kinds have request-payload schemas but no governed
  result schemas. Executor objects and the page render switch are the current
  response contract. Query performance and output parity therefore need the
  same canonical contract work as Review and Compare, not a UI-only fix.
- One launch currently executes `/api/query/run`, discards the response and
  navigates to a result page that executes it again. Results are unpaginated,
  carry full quotes and are sorted or exported from the hydrated browser object.
- Query kinds also disagree on legal selection and missing-value semantics:
  some choose the first or majority family provision, show-all treats
  uncaptured as false, and numeric predicates can coerce null to zero. The
  canonical query work must replace those rules, not merely accelerate them.

CORRECTED (the plan below rests on these, not the review's wording):
1. /admin/taxonomy does not "report an error": it is SILENTLY OFFLINE
   (getServiceSupabase() null branch: env vars unset on that deployment;
   status "offline", counts 0). The pseudo-claims-from-ai_metadata claim
   is TRUE (the page's own source label admits it) and the real claims
   table it should read exists and is populated.
2. The unit/type errors do NOT live in lib/schema/features.js (its
   `unit` fields are correct: percent fields say percent). They live in
   the DERIVED market registry's data_type
   (docs/market-registry/generated-v1*.json), which /admin/registry
   renders. Fix the derivation and the derived rows; do not "correct"
   the hand registry, which is right.
3. lib/unelide-quote.js is query-layer (lib/queries/review-deal.js),
   not presentation; already on the right side of the line the review
   draws.
4. lib/query/derived-fields.js is NOT a compatibility shim. It is the
   governed query-time-derived-field pattern the target architecture
   wants MORE of (one entry, feePctOfDealValue, computed from two
   canonical fields). Phase 4 should promote this pattern, not migrate
   it away.
5. lib/party-scope.js is shared write+render infrastructure, not a
   comparison-layer patch. Fixing it changes ingestion, so it belongs
   in Phase 3, not Phase 4.
6. Seven registry-like artefacts exist (hand feature registry gating DB
   writes; generated feature/tag registry; 54 taxonomy dicts of which
   only 2 went through the freeze-gate JSON process; frozen vocab files;
   canonical-registry-v1.md; normalized-v1.json; market registry +
   reviewer state). "Not one coherent contract" is confirmed; Phase 1's
   "do not create another registry" is therefore binding.

## Governance (non-negotiable, applies to every phase)

- Decision rights: Codex agents DRAFT; Fable or Claude 5.6 Sonnet REVIEWS
  every diff that touches legal semantics, identity, or extraction behavior;
  Ben DECIDES taxonomy values, codebook vocabularies, and freeze-gate changes. A
  plausible-but-wrong legal answer is the worst failure class, worse
  than no output. Nothing merges unreviewed.
- Every Codex prompt is self-contained (no session history, no secrets)
  and carries the repo primer from docs/PLAN.md.
- Corpus writes run only on Ben's machine, dry-run-first, using the
  established delivery-script pattern (embedded human-reviewed tables,
  paginated reads, per-deal diffs, --apply).
- Mechanical gates on every PR: npm test, npm run build, INVARIANT lint
  (post-commit), golden evals (node scripts/eval.js) for anything
  touching extraction, drift tests for anything touching registries.
- Piecemeal implementation is paused until this written architecture has the
  required independent review, Ben approves it and the isolated environment is
  verified. The emergency containment increment is the sole exception. After
  that gate, only approved architectural slices proceed, each independently
  shippable and leaving `main` deployable.

## Binding target architecture

This section is normative. Later phases describe how to reach it. A product
row is not assumed to equal one source span, and a source span is not assumed
to contain only one semantic object. The system preserves source-backed facts
as separate objects and combines them by typed reference.

### 1. Immutable source and deterministic structure

- `source_document` stores the immutable received document, its cryptographic
  raw-source hash and source metadata. A separate immutable `canonical_text`
  record stores the exact text used for extraction, its converter version and
  its own cryptographic hash. Reprocessing never rewrites either record.
- `canonical_text_id` comprises the raw-source hash, converter version and
  canonical-text hash. The authoritative coordinate system is half-open UTF-8
  byte intervals `[start, end)` over that stored canonical text. Any UTF-16
  indices needed by the browser are derived, never authoritative.
- `structural_span` records articles, sections, subsections, paragraphs and
  leaf spans. Leaf spans partition the canonical text for coverage accounting.
  Identity derives from `(canonical_text_id, structural_model_version, start,
  end, structural_kind, ordinal)`. Re-ingesting the same source with the same
  canonical-text and structural-model versions must reproduce the same
  boundaries, offsets, kinds and source-order ordinals.
- Each `semantic_span` is one exact interval in that same text. Semantic spans
  may contain other semantic spans. A claim or result may refer to several
  spans through evidence and relationships; the spans themselves do not own
  copied or rewritten source text.

### 2. Definitions-first semantic objects and stable identity

- Definitions are classified before provisions. A definition is a
  `ProvisionInstance(kind=definition)`, including a definition embedded in an
  operative clause or another definition.
- Each operative legal mechanism is a separate `ProvisionInstance`. A broad
  structural section may therefore produce several semantic instances, such
  as covenant compliance, representation accuracy and no-MAE conditions in
  one closing-conditions subsection.
- `source_anchor_id` is immutable across re-extraction of the same canonical
  text and derives only from `(canonical_text_hash, absolute_start,
  absolute_end)`. Multiple semantic objects may share one source anchor. It
  identifies where a candidate came from without asserting what it means or
  depending on a structural parser's boundaries.
- Provision identity is anchored to `(document_hash, absolute_start,
  absolute_end, concept_key, party, ordinal)`, where `document_hash` is the
  canonical-text hash and `party` is a governed `{ role, value }` attribution.
  This semantic identity is versioned and also points to `source_anchor_id`.
  The ordinal is deterministically assigned by source order, never by an LLM.
- Party roles distinguish, for example, representation maker, covenant
  obligor, fee payor and right holder. Beneficiary, protected party and subject
  party remain explicit attributions or relationships. A non-party object such
  as a definition uses a governed no-party role and value approved through the
  Freeze Gate. It never defaults to `MUTUAL` or borrows surrounding text.
- Reciprocal obligations are separate instances. `MUTUAL` may be a derived
  display result when both party-specific obligations exist; it is not a
  canonical party value for either obligation.
- A `ProvisionComponent` gives every non-independent child assertion or limb a
  stable identity anchored to `(parent_provision_instance_id,
  canonical_text_hash, absolute_start, absolute_end, component_key, ordinal)`.
  The ordinal is source order among distinct spans with the same component key
  inside the parent. Candidates with the same parent, offsets and component key
  are resolved as exact duplicates or quarantined before ordinal assignment;
  they are never given arbitrary different ordinals. A standalone legal
  mechanism remains its own `ProvisionInstance`. This lets one
  representation address limbs separately while keeping signing cleanup and an
  ongoing no-shop restriction as separate mechanisms.
- A `ScopeAssessment` gives whole-concept states a stable non-fabricated subject
  identity derived from canonical-text hash, ordered examined structural-span
  IDs, concept, governed party and assessment-definition version.
- Any change to a source-anchor tuple, including a same-text boundary correction,
  requires an explicit reviewed anchor-migration map. Any change to a semantic
  or component identity creates a recorded superseding identity. Neither may be
  recovered by fuzzy matching.

### 3. Typed claims, evidence and explicit states

- Every extracted answer is a typed `Claim` governed by a `ClaimDefinition`.
  It carries raw value, canonical value, unit, day basis, denominator,
  derivation version, source lineage and the applicable concept and party.
- Claim state is exactly one of `PRESENT`, `ABSENT`, `NOT_APPLICABLE`,
  `NOT_EXAMINED` or `FAILED`. `ABSENT` is valid only when the complete
  applicable scope has been examined. Missing data is never silently treated
  as absence.
- Every claim is owned by exactly one subject: a `ProvisionInstance`, a
  `ProvisionComponent`, or a source-backed scope assessment used for a
  whole-concept state. Cross-provision facts remain separate claims and combine only
  in a `DerivedResult`.
- Claim identity derives from subject type and ID, claim-definition key and
  version, and a deterministic source-order ordinal for governed repeatable
  claims. A non-repeatable ClaimDefinition producing two claims is quarantined.
- `claim_evidence` is many-to-many. One owned claim may cite several spans only
  when those spans jointly establish that subject's single proposition.
  Evidence roles include
  `OPERATIVE_TEXT`, `DEFINITION`, `EXCEPTION`, `CROSS_REFERENCE` and
  `DERIVATION_INPUT`.
- Every `PRESENT` or `ABSENT` claim records the examined scope. Every `PRESENT`
  claim has exact evidence. `ABSENT` instead requires non-empty examined scope,
  scope-coverage proof and extractor/version provenance; it does not require a
  fabricated positive quote. Missing evidence on a `PRESENT` claim, evidence
  outside the admitted scope, invalid taxonomy codes and unknown attributes
  block publication and enter quarantine as retained residuals.
- The `ClaimDefinition` selects the exact governed subject. A whole-provision
  claim attaches to its `ProvisionInstance`; a limb-scoped claim attaches to its
  `ProvisionComponent`; a whole-concept state attaches to its
  `ScopeAssessment`. The presence of a parent provision never reparents a
  component claim. An `ABSENT` claim does not fabricate a provision span.
- `NOT_APPLICABLE` records the applicability rule and facts;
  `NOT_EXAMINED` records the intended scope and reason; `FAILED` records the
  attempted extractor and failure provenance. None is interchangeable with
  `ABSENT`.
- A substantive threshold inside one limb is not promoted into a general
  qualifier on the whole provision. Qualifier scope is part of the claim.

### 4. Typed relationships and multi-span result composition

- `RelationshipDefinition` governs typed edges including `CONTAINED_IN`,
  `USES_DEFINITION`, `APPLIES_TO`, `BRINGS_DOWN`, `EXCEPTED_BY`, `GOVERNS`,
  `ENFORCED_BY`, `TRIGGERS_REMEDY` and `MIRRORS`. Vocabulary changes pass the
  Freeze Gate.
- It declares permitted source and target object types, cardinality, required
  evidence roles, state rules and whether targets may be components or claims.
  A relationship instance stores a typed source ID, governed target type and
  role, state, provenance, raw scope expression, any resolved target IDs and
  resolver version.
  A `PRESENT` relationship requires exact evidence and resolved endpoints;
  other states carry the corresponding scope proof or failure provenance.
- Relationship identity derives from `(relationship_definition_key,
  relationship_definition_version, source_type, source_id, target_type,
  target_role, intended_scope_interval_set_key, state,
  relationship_input_hash, ordinal)`. Every state requires a non-empty intended
  source-scope interval set; a relationship without one is quarantined. The
  state-specific input hash covers the canonical raw scope plus: resolved
  target IDs and evidence for `PRESENT`; coverage proof for `ABSENT`;
  applicability rule and facts for `NOT_APPLICABLE`; intended scope and reason
  for `NOT_EXAMINED`; or extractor version, canonical failure code and any
  unresolved raw target expression for `FAILED`. The ordinal follows the
  earliest intended-scope interval and then the input hash. No unresolved
  target receives a fabricated object ID. Exact tuple duplicates collapse;
  incompatible duplicates are quarantined. Resolver and extraction-run IDs are
  provenance, not identity inputs, so an exact rerun produces the same ID.
- Fuzzy text matching may propose a relationship for review. It may not write
  a canonical edge or transfer claims between objects.
- `ResultDefinition` specifies a versioned lawyer-facing answer: its required
  and optional component claims, permitted relationships, ordering,
  normalisation rules and failure behaviour.
- A `DerivedResult` identity derives from `(canonical_text_hash, result_key,
  result_version, party_role, party_value, result_input_set_hash, ordinal)`.
  `result_input_set_hash` is the deterministic hash of ordered component-slot
  keys, claim IDs and relationship IDs admitted by the `ResultDefinition`; the
  ordinal follows the earliest ordered input interval and then that hash. Exact
  tuple duplicates collapse and conflicting duplicates are quarantined. The
  result stores its claim, provision and `ProvisionComponent` IDs, relationship
  paths and component states. It does not store a corpus release or snapshot ID;
  snapshot and release membership are manifest relationships derived after the
  result exists. Each governed component slot has a stable
  `DerivedResultComponent` identity from `(derived_result_id, component_key)`.
  The result has no fabricated source span and owns no copied source facts.
- If a required component is `FAILED` or `NOT_EXAMINED`, the result cannot
  publish as complete. The failed component remains visible to review and
  certification tooling.
- Each result component also declares its accepted terminal states and how each
  state affects the result. `ABSENT` may be a complete answer for a
  knowledge-qualifier component but not an acceptable substitute for a required
  bring-down. `NOT_APPLICABLE` is complete only where that component definition
  permits it.
- A result may combine any number of provisions and spans. For example, one
  representation result may combine the signing representation, a separate
  closing-condition bring-down and an inline definition. Each displayed fact
  still opens its own source evidence.

### 5. Nested and overlapping spans

- Structural leaf spans remain a non-overlapping partition for completeness
  accounting. Semantic and evidence spans are an interval graph and may nest.
- Valid containment includes a provision containing an inline definition and
  a definition containing a second definition. Parent and child retain their
  own identities and are joined by `CONTAINED_IN` and semantic-use edges.
- The same bytes may support several claims or semantic objects when their
  concepts or parties differ. Each use is explicit. Exact duplicate objects
  remain prohibited.
- Proper containment and explicitly classified shared evidence are valid.
  Unexplained crossing overlaps, dangling relationships and offsets that do
  not reproduce the quoted source are quarantined.
- Coverage accounting counts the underlying structural leaf once. Nested
  semantic uses do not create false duplicate coverage.

### 6. One writer, candidate releases and corrections

- One authoritative canonical writer serves ingest, full extraction,
  per-family reprocess and correction flows. No alternate production write
  path may manufacture canonical facts.
- Provision instances, excerpts, claims, evidence and relationships are
  validated first and then written transactionally per deal and extraction
  run. A failed object rolls back the deal/run publication unit and remains in
  quarantine with its residuals.
- The failed attempt envelope and retained residuals are recorded in a separate
  audit transaction, so rollback of the canonical publication transaction
  cannot erase the reason it was blocked.
- Corrections carry a governed target type and exact target ID, the affected
  field or relationship and the expected prior semantic or contract version.
  Source-backed classification corrections target `source_anchor_id`; scoped
  absence or examination corrections may target `ScopeAssessment`; component,
  claim and relationship corrections target those exact subjects. They survive
  ordinary re-extraction through recorded supersession. If a target's identity
  tuple changes, a reviewed target-migration map is required; no correction can
  fuzzy-rematch or become a serving-time overlay.
- A correction ID is the content hash of its governed target tuple, expected
  prior version, canonical patch payload, correction-rule version and any
  superseded correction ID. Reviewer, execution and timestamp data remain
  provenance rather than identity inputs. Exact duplicate corrections collapse;
  conflicting corrections against one expected prior state are quarantined.
- Each extraction writes immutable objects under an `extraction_run_id`. A
  complete `DealSnapshot` manifest selects the canonical text, contract version
  and one closed object set for every required family in that deal. A per-family
  reprocess creates a new complete snapshot by referencing certified unchanged
  family sets and the new family set; it never produces a partial deal view.
  Each family set carries its contract fingerprint. Carry-forward is permitted
  only when that fingerprint is certified compatible with the snapshot's pinned
  contract version; otherwise the family is rematerialised before the snapshot
  can certify.
  Closure validation proves that every selected provision, component, claim,
  evidence edge, relationship and result resolves inside the snapshot.
- A certified family-set ID is the content hash of its canonical-text hash,
  family key, contract fingerprint and ordered canonical object IDs. A
  `DealSnapshot` ID is the content hash of its canonical-text ID, contract
  version and ordered certified family-set IDs. Extraction-run and allocated
  database IDs remain provenance outside those identity hashes. Family sets and
  results therefore exist before the snapshot; the snapshot exists before a
  release selects it; and exact semantic reruns produce the same family-set,
  result and snapshot IDs without a construction cycle.
- `CorpusRelease` is an immutable manifest selecting exactly one certified
  `DealSnapshot` per included deal. Its correction-set reference is audit
  provenance for corrections already materialised into the selected objects,
  never a serving-time overlay or second truth path. This allows active and
  candidate corpora to coexist without copying or partially mutating live
  objects. Its ID is the content hash of the release-contract version, ordered
  governed deal key to `DealSnapshot` mappings, cohort-metadata version and
  correction-set digest. Labels and build-run IDs are provenance, not identity
  inputs.
- All content-addressed IDs and digests above use domain-separated SHA-256 over
  RFC 8785 canonical JSON with the governing schema version inside the payload.
  Object collections sort lexicographically by `(object_type, stable_id)`,
  family collections by `(family_key, family_set_id)`, release mappings by
  `(governed_deal_key, deal_snapshot_id)` and correction sets by
  `correction_id`. Exact duplicate entries collapse before hashing; duplicate
  logical keys with different values are quarantined. Null, absent and empty
  values remain distinct. Database iteration order and allocated row IDs never
  enter these hashes.
- `provisions.ai_metadata.features` may exist temporarily as a derived
  compatibility projection. It cannot remain an independently writable truth.
- Re-extraction builds an offline candidate corpus release. It never partially
  mutates the active corpus. Certification publishes by one atomic
  active-release pointer swap through a master exposure gate; rollback reverses
  that pointer and gate.

### 7. Serving projection and one row contract

- A compact `market_observation` projection is indexed first by corpus release,
  governed deal key, concept, metric and party. Its unique identity is
  `(release_id, governed_deal_key, concept_key, metric_key, party_role,
  party_value, result_key,
  result_version, owner_type, owner_id, scope_type, scope_id, value_ordinal)`.
  `owner_type` is `CLAIM` or `DERIVED_RESULT_COMPONENT`, and its matching ID is
  always non-null. `scope_type` identifies a `ProvisionInstance`,
  `ProvisionComponent`, `ScopeAssessment` or `DerivedResultComponent`, and its
  matching ID is always non-null.
- An allocated database `deal_id` may remain a foreign key and provenance field.
  It is not part of observation identity, bundle checksums or cross-environment
  parity.
- Each observation derives a `scope_interval_set_key` from the ordered,
  deduplicated half-open evidence or examined-scope intervals of its owner. This
  works for multi-span results and `ScopeAssessment`s without inventing one
  anchor. `MetricDefinition` governs value ordering; its default stable order is
  interval-set key, owner type and ID, canonical serialisation and raw-value
  hash. An owner with no interval set requires an explicit governed ordering
  rule or is quarantined. Exact duplicate observations collapse before
  numbering, unexplained collisions are quarantined, and `value_ordinal` is
  assigned from zero in that order.
- Every observation carries state. Raw and normalised observations remain
  linked to the underlying claims, evidence IDs, units, denominators and
  derivation versions. Serving never reconstructs provenance through a runtime
  text-hash join.
- Common aggregates are materialised. Arbitrary refined cohorts use one
  indexed, set-based SQL/RPC and a release-aware cache. A request never loads
  broad cards and claims into Node or makes corpus-proportional database calls.
- Review, Corpus Context, Compare, Query and Admin consume one shared row
  contract produced from `ResultDefinition`. Components do not reconstruct
  legal relationships or metric definitions independently.
- The row contract carries release, deal, result, concept and party identity;
  result and component state; raw and canonical display values; evidence and
  source actions; market observations; cohort and denominator; refinable
  dimensions; and provenance. A component remains individually inspectable
  even when several components form one row.
- Presence prevalence is secondary context. The primary comparison is the
  treatment of each applicable claim, using the examined and applicable cohort
  as its denominator.

### 8. Governed query compiler and fast result delivery

- Natural-language prompts, the manual builder, saved queries and in-product
  launch actions compile to one versioned `QueryPlan`. They never address raw
  feature aliases or choose arbitrary cards. The plan contains corpus release,
  result and metric keys, component scope, party and legal context, cohort
  filters, selected dimensions, predicates, groupings, sort, cursor and page
  size. Ambiguity produces a refinement request, not an invented field.
- The predicate AST distinguishes deal-level `AND` and `OR` from scoped
  component predicates; supports `EXISTS`, `NONE` and `ALL`; and declares
  whether combined predicates must attach to the same result, component,
  provision or merely the same deal. Scalar operators never coerce `ABSENT`,
  `NOT_APPLICABLE`, `NOT_EXAMINED` or `FAILED` into values. Party-aware facets
  include Buyer, Seller and Either where appropriate, with the selected role
  explicit in the plan and output.
- Quantification uses the complete admitted subject set for the declared scope
  inside each eligible deal and follows one three-valued truth table. `EXISTS`
  is true when at least one `PRESENT` comparable subject satisfies the predicate.
  `NONE` is true only when the scope is completely examined and no subject
  satisfies it; a certified whole-concept `ABSENT` therefore satisfies `NONE`.
  `ALL` is non-vacuous: it is true only when at least one `PRESENT` comparable
  subject exists and every admitted subject satisfies the predicate. A
  `NOT_EXAMINED` or `FAILED` subject makes an otherwise undecided quantifier
  unknown and excluded with reason; `NOT_APPLICABLE` is outside the applicable
  universe and reported separately. `FALSE AND UNKNOWN` is false, `TRUE AND
  UNKNOWN` is unknown, `TRUE OR UNKNOWN` is true and `FALSE OR UNKNOWN` is
  unknown. A negative comparison over multiple subjects has no implicit
  quantifier and must be resolved or clarified.
- Compilation validates the generated request schema and produces the complete
  plan without running the query. Each user action then executes that plan once
  and uses the returned result. Launchers, result pages, saved-query validation
  and redirects cannot execute and discard a duplicate corpus query.
- The five current product intents are views over this plan, not five separate
  truth systems:
  - `DEAL_COMPARE` returns the same governed results across selected deals and
    computes deltas only between compatible component values.
  - `PROVISION_CROSS_CUT` returns selected result components across a cohort,
    retaining multiple scoped treatments instead of choosing an arbitrary
    first or majority provision.
  - `MARKET_RANGE` returns the treatment distribution, denominators,
    exclusions and source deals for one governed metric and semantic scope.
  - `FILTER_THEN_LIST` evaluates indexed predicates over explicit states and
    canonical observations, then returns the requested result and deal columns.
    A missing value never masquerades as an `ABSENT` match.
  - `DEAL_TO_MARKET` compares one deal's result components with a single
    precomputed or set-based cohort response. It never requests market data
    once per row, and it is generated from the governed result registry rather
    than a hard-coded field allowlist. Every row receives either market analysis
    or an explicit non-comparable or extraction state.
- “What's market?” and future query experiences compose these same operators.
  They do not create a sixth extraction or aggregation path. The canonical
  example “termination fees market check” returns percentage of the identified
  deal-value basis as the primary metric, raw dollars as source context,
  company/Target versus reverse/Buyer fee role, triggers, evidence, exclusions
  and refinable deal dimensions.
- Every request and result has a generated JSON schema and contract version.
  Every output carries the release ID, normalised query plan, total and page
  counts, stable cursor, columns, shared rows, component states, cohort and
  denominator counts, excluded counts and reasons, source-deal references and
  provenance. CSV and other exports derive from that result contract.
- The server validates the result schema before cache insertion or response; an
  invalid result fails closed and enters operational quarantine rather than
  reaching a renderer. Clients use generated types, reject incompatible
  contract versions and do not guess missing fields. Contract tests cover every
  query intent, “What's market?”, evidence details, facets and exports.
- Saved queries explicitly choose either a pinned corpus release or
  follow-latest behaviour, and every run reports the resolved release. Plan and
  schema migrations reject stale incompatible saved plans. Read execution does
  not synchronously update analytics or other mutable counters.
- Common queries read materialised aggregates. Arbitrary refined cohorts issue
  one indexed set-based data RPC against the release-keyed projection.
  Facet and field-value options use a bounded indexed dimension projection,
  never provisions or claims. Saved-query, authentication and evidence-detail
  lookups are fixed overhead and are
  declared per route; none scales with result rows. No request loads the full
  corpus, scans hydrated provisions in Node or performs per-deal, per-row or
  per-cell database work.
- List output uses a signed stable cursor bound to release, normalised plan
  hash, sort tuple and final deal or observation ID, with a default page of 50
  and a hard maximum of 200 rows. Aggregate and facet counts cover the full
  cohort, not merely the visible page. Refining resets the cursor; sorting or
  paging cancels stale work and never materialises a cohort-wide deal-ID list in
  the browser.
- Initial JSON is capped at 1 MB uncompressed. Full agreement text and extended
  evidence load only by exact evidence ID from a source action. Full-query CSV
  and other exports execute server-side over a cursor stream or bounded
  asynchronous job; they never export only page one or require the browser to
  hydrate the full result. An export is capped at 25,000 rows, 100 MB
  uncompressed, 500-row chunks and ten minutes, with at most two concurrent
  export jobs fleet-wide and backpressure between chunks.
- The cache key includes release ID, normalised plan hash and authorisation
  scope, plus page cursor where relevant. Shared single-flight fill prevents a
  multi-instance cache stampede; release publication invalidates by pointer
  rather than deleting keys. A common-aggregate cache hit performs zero serving
  database work, and empty results are cacheable.
- Fleet-wide admission control, query deadlines, database statement timeouts
  and a shared circuit state enforce one total serving budget across Vercel
  instances. If the shared controller is unavailable, market and
  arbitrary-cohort execution fails closed. Per-process semaphores remain defence in
  depth, not the primary control.
- Staging performance budgets are binding release gates: cached common-query
  API p95 at or below 500 ms, uncached refined-query API p95 at or below
  1.5 seconds, p99 at or below 2.5 seconds, and a usable first browser result at
  or below 2 seconds under the certified traffic profile. Query-plan CI rejects
  sequential scans of broad claim/card payloads, N+1 calls, unbounded responses
  and regressions beyond those budgets.
- Route call budgets are exact: one serving RPC for an ad hoc initial page,
  refinement, sort or page; one saved-plan lookup plus one serving RPC for a
  saved query; one exact-ID bounded query for an evidence detail; and one
  indexed bounded query for facet or field-value options. Evidence detail is
  capped at 20 IDs and 512 KB; option output is capped at 200 values and 256 KB.
  Query compilation performs no corpus read and may make at most one bounded
  catalogue lookup. Authentication is separately declared fixed overhead.
- Every active query and support route or job appears in the governed route
  budget manifest with maximum database calls, rows and bytes returned, response
  or job deadline, admission class and cache policy. Export is the only path
  permitted multiple cursor calls, and its per-chunk budget and fleet-wide job
  cap above remain subject to shared admission control. Instrumented tests fail
  when any route exceeds its manifest.

## Tooth-to-tail execution path

This is the complete path from a received agreement to one published answer.
No stage may bypass validation or write a plausible replacement for a failed
earlier stage.

1. **Freeze the source.** Receive the agreement, generate canonical text with
   a versioned deterministic converter, hash it and store both immutably.
2. **Build structure.** Produce reproducible articles, sections, paragraphs
   and leaf offsets. Verify that the leaves cover the admitted document once,
   without gaps or overlaps.
3. **Resolve definitions first.** Classify the definitions article and then
   inline and nested definitions anywhere in the agreement. Create exact
   source-backed definition instances and definition-use candidates.
4. **Classify legal mechanisms.** Within each structural region, identify each
   operative provision and child mechanism, assign concept and party, and
   anchor it to exact offsets. One section may yield several provisions. Two
   reciprocal obligations yield two party-specific provisions.
5. **Unpack expected claims.** The concept's `ClaimDefinition` expectation set
   states what must be tested. Extraction evaluates every definition in that
   set and emits exactly one of the five states. Applicability is an outcome,
   not a pre-filter that permits omission. Raw wording and value, canonical
   value, scope and party travel together with exact evidence or examined-scope
   proof, as the emitted state requires.
6. **Link, do not flatten.** Create reviewed typed relationships among
   provisions, definitions, exceptions, conditions and remedies. Multi-span
   claims cite each contributing span. Cross-provision results keep component
   identities rather than copying their facts into one feature bag.
7. **Validate and quarantine.** Reproduce every quote from stored offsets,
   check concept, party, codebook, type, unit, scope, relationship and expected
   claim completeness. Retain every unknown or invalid observation as a
   residual. Any unresolved residual or required failed claim blocks candidate
   publication for that deal/run.
8. **Write once, transactionally.** The canonical writer persists the source
   objects, provisions, excerpts, claims, evidence, relationships and applied
   corrections in one transaction for that deal and run. Other ingest and
   correction entry points call this writer rather than writing their own
   shapes.
9. **Compose lawyer-facing results.** A versioned `ResultDefinition` selects
   and orders component claims through permitted relationships. It produces a
   derived result and the shared row contract. The result has no invented
   source span; clicking a component returns to that component's evidence.
10. **Build the market projection.** Candidate-release jobs materialise compact
    observations and common aggregates from certified claims and results. The
    serving path reads this release-keyed projection through bounded set-based
    queries and a release-aware cache.
11. **Compile and serve queries.** Every query surface creates a governed plan,
    executes one bounded projection operation and returns the versioned shared
    row contract with stable pagination. Evidence detail is lazy, and each
    result remains traceable to its component claims and source.

## QXO acceptance examples for the architecture

These are binding golden cases, not one-off display patches.

### Target Capitalisation representation

- The signing instance is the Target representation at section 3.1(b), with
  child assertion spans for limbs (i) through (v). The analogous Buyer
  representation is a separate instance.
- The rep-level accuracy materiality qualifier is `ABSENT`. Limb (iv) separately
  contains a substantive threshold for non-subsidiary investments material to
  the Company group. That threshold must not render as a general rep qualifier.
- Knowledge qualifier and retrospective lookback are `ABSENT` after full-scope
  examination. April 17, 2026 is a measurement date, not a lookback.
- The bring-down is a separate closing-condition instance at section
  5.2(a)(ii). Tier B applies to sections 3.1(b)(i) and (iii), true except for
  De Minimis Inaccuracies. Tier C applies to sections 3.1(b)(ii), (iv) and (v),
  true in all material respects with materiality and MAE qualifications
  disregarded.
- The tier relationships preserve the raw contractual scope expression and its
  deterministic expansion to the exact limb `ProvisionComponent` IDs. They do
  not store the expansion as unverified free text.
- `De Minimis Inaccuracies` is a definition nested inside the closing-condition
  span. It retains its own identity and evidence.
- The lawyer-facing Capitalisation result combines the signing claims,
  bring-down tier claims and nested definition. It must never collapse those
  tiers to one MAE, de-minimis or material-respects pill.

### No-shop / non-solicit restriction

- Target section 4.3(a)(ii) and Buyer section 4.4(a)(ii) are separate ongoing
  restrictions with different obligated and protected parties. A reciprocal or
  mutual label is derived only after both are established.
- Target section 4.3(a)(i) and Buyer section 4.4(a)(i) are separate
  signing-cleanup `ProvisionInstance`s, each with its own party, claims and evidence:
  cease existing activity; request return or destruction within one business
  day; terminate data-room access.
- The ongoing restriction separately claims each prohibited act: solicit or
  initiate; knowingly encourage or facilitate; discuss or negotiate; furnish
  information or access; enter, recommend or support an alternative agreement.
- The chapeau's representative-control standard explicitly governs the cleanup
  and ongoing mechanisms. Fiduciary engagement, standstill, notice, matching,
  recommendation and Acquisition Proposal definition objects remain separate
  and are linked by typed relationships.
- The lawyer-facing Target No-shop result composes those components without
  copying cleanup claims into the ongoing restriction. Market output compares
  each act and treatment separately, by party.
- The Buyer No-shop result is composed from the Buyer provision and its own
  linked components. It may mirror the Target result for display, but it never
  borrows Target claims or evidence.
- The known QXO failure, where fragment containment attached `NOSOL-CEASE`
  claims to the `NOSOL-PROHIBIT` card, must be rejected because concept,
  party, evidence and span scope do not agree and the claims lack exact
  claim-level evidence.

## Isolated programme environment

- The dedicated integration branch and worktree are established at
  `codex/canonical-corpus-v2` and `precedent-machine-canonical-v2`. This is an
  integration worktree of the existing repository, not a second repository or
  permanent fork.
- Before canonical implementation or data work begins, create a separate
  Supabase staging project restored from a production snapshot and a branch
  preview in the Vercel `deal-corpus` project using staging-only credentials.
  Both remain pending until their project identities and credential isolation
  are mechanically verified without printing secrets.
- Re-extraction, backfill, corpus replay, migration rehearsal and load or soak
  testing run only against staging. They never run against production.
- Database-changing scripts remain dry-run-first and Ben-run locally, even
  when their target is staging. Agents prepare code, deterministic artefacts
  and diffs; they do not execute corpus writes.
- Completed architectural slices may land in `main` only after their required
  reviews and gates, behind disabled feature flags. Each slice leaves `main`
  deployable. Candidate corpus data and the serving projection remain isolated
  in staging until every pre-promotion Phase 9 certification gate has passed and
  Ben has authorised promotion. The authorised import then copies only the
  certified bundle into an inactive, inaccessible production namespace; it does
  not expose the candidate.
- One master canonical-v2 exposure gate controls all candidate reads. Slice
  flags cannot expose candidate data independently in production. Production
  cutover is one atomic active-release pointer swap plus that reversible master
  gate. Rollback restores both the prior release pointer and application path.
- After staging certification, the candidate is exported as a content-addressed
  release bundle with the certification manifest and object checksums. Ben runs
  a dry-run-first canonical release importer locally to populate an inactive
  production release namespace, then verifies counts, identities and checksums
  against staging. This promotion import is the only canonical corpus write to
  production before cutover; it performs no extraction, backfill, replay or
  mutation of the active release.

## Phases (Codex's structure, amended)

### Phase 0: Emergency containment and factual baseline

The emergency containment code increment shipped to `main` in PR #316. It
hard-closes `/api/market-stats` in code, removes the `canonical_numeric`
error-probe read, eliminates immediate retry behaviour, bounds per-process request
and database-query concurrency and adds a circuit breaker. A live POST to the
production alias `https://precedent-machine.vercel.app/api/market-stats` on
2026-07-20 ET returned HTTP 503 with `MARKET_STATS_DISABLED`, confirming the
closed route is deployed. The Vercel project is `deal-corpus`; the production
alias retains the earlier hostname. The process-local guards are temporary
containment only because Vercel has multiple instances.

The route remains closed until Phase 6 provides bounded set-based projection
reads, release-aware caching and the Phase 9 load proof. The former broad-card
and broad-claim Node loading path is not an acceptable reopening path.

Security containment remains an explicit runbook gate: identify and record the
owner and purpose of the Zayo process responsible for the traffic. If it is not
recognised, Ben rotates the Supabase service secret immediately. The exposed
Claude credentials are treated as compromised and rotated regardless. No agent
inspects, reads or prints Keychain contents, and no secret value enters an
artefact, prompt or log. The repository currently contains no non-secret
completion record for the Zayo disposition or these rotations, so they remain
outstanding blockers rather than assumed complete. No post-containment Phase 0
work, canonical implementation or canonical data work starts until that
non-secret evidence is recorded. Finalising and reviewing this governing plan
is not canonical implementation and is the only work permitted while the gate
is open.

Then produce the factual baseline and comparability matrix. Every rendered row
records concept, party, source, attributes, shape, state semantics, normaliser
owner, comparison dimensions, UI consumers, representative deals and whether
each fact was extracted, inferred, corrected or recovered. Classify every one
of the 704 registry entries to a final disposition, not merely the active
subset. The Phase 0 inventory of existing normalisers seeds the work.

### Phase 1: One governed canonical contract

Extend the existing canonical model, without creating an eighth registry, to
govern `ProvisionConcept`, `ClaimDefinition`, `RelationshipDefinition`,
`ResultDefinition` and `MetricDefinition`. The contract defines exact types,
allowed states, applicable parties, expected claims, relationship endpoints,
units, denominators, normalisers, result components and release versions.
Generated `QueryPlan` request and result schemas, predicate operators and
serving-row schemas are contract outputs, not another hand-maintained registry.

During transition, the hand feature registry remains the write gate only where
the canonical writer derives its compatibility projection. Generators reconcile
the hand registry, taxonomy dictionaries and market registry in both directions
with drift tests. The Freeze Gate controls every vocabulary or codebook change;
Ben decides those changes after Fable or Claude 5.6 Sonnet review. Review-table
components reference governed result and metric keys and cease manufacturing
their own legal or metric specifications.

### Phase 2: Immutable source, spans, identity and lineage

Implement `source_document`, immutable versioned canonical text, half-open
structural and semantic spans, source anchors, provision instances, components,
excerpts, claims, evidence joins and typed relationships. Replace the
provisions-to-cards `spanHash` best-effort join with explicit source-backed
identity. Pin the structural algorithm/version and deterministic ordering rules.
Corrections target exact governed subjects and expected semantic versions. Any
target-tuple change requires a reviewed migration map, while semantic changes
record supersession. Fuzzy rematching is prohibited.

Re-ingesting the same document with the same converter and contract versions
must reproduce raw and canonical-text hashes, structural offsets, source
anchors, component identities and provision identities exactly. Provision identity uses
`(canonical_text_hash, absolute_start, absolute_end, concept_key, party,
ordinal)`, where party includes its governed role and value, never LLM wording.
Claim content may disagree across shadow runs and must be reconciled; identity
may not drift. Tests include same-text boundary correction and anchor migration,
correction-driven concept and party supersession, nested definitions,
addressable child assertions, shared and multi-span evidence, invalid crossing
overlaps and reciprocal party-specific obligations.

### Phase 3: Definitions-first classification and typed extraction

Implement the execution path in order: definitions, legal mechanisms and
parties, expected typed claims, explicit states, relationships, validation and
quarantine. Enable residual capture. Unknown attributes, invalid taxonomy
codes, missing required claims and evidence failures remain visible and block
publication rather than being skipped or rendered plausibly.

Repair concept-aware deduplication, absolute quote offsets, party values at
write time, per-family reprocessing and cross-family post-passes. Fuzzy matches
may populate a review queue but cannot write canonical edges or move claims.
Bring-downs, exceptions, definitions, triggers and remedies become typed
relationships. Existing WP-R3, WP-R4, WP-R6, WP-R7 and WP-R8 work folds here.
Extend the existing evaluation harness with golden cases for every family,
including the QXO representation and no-shop examples above.

### Phase 4: Raw and canonical observations

Store raw and normalised observations together. Each observation carries unit,
day basis, denominator, derivation version and source lineage. Its full lineage
includes release, deal, result, concept, metric, party role and value, legal
trigger or context, claim and component IDs, canonical-text hash and offsets.
Normalisation occurs only after those semantic dimensions are resolved. A raw
alias such as `noticePeriod` or `matchingPeriod` never defines a cohort. QXO's
inbound notice, superior-proposal initial match and intervening-event period are
separate metrics even when legacy fields share a name or number.

Dollar observations retain the source amount but publish a deal-relative
percentage as the primary comparable value, with an explicit equity,
enterprise or transaction-value denominator. If no valid denominator exists,
the raw amount remains visible and the percentage observation is excluded with
a reason: missing, non-positive, unknown or conflicting denominator basis. It
never becomes zero, borrows another basis or enters percentage statistics.
Percentage cohorts contain only identical denominator-basis strata and report
excluded counts and reasons.

Duration observations retain the raw clock and publish canonical days plus day
basis. Conversion occurs only inside an already-bound semantic metric: 24
elapsed hours becomes one elapsed day, never one business day. Elapsed hours
and elapsed or calendar days may share an elapsed-day stratum when the governed
metric permits it. Business days remain a separate stratum unless a certified
calendar rule expressly converts them. Unknown basis is unresolved. No stratum
is dropped, and every exclusion remains visible. Relative dates record their
anchor event and derived interval.

Versioned normalisers belong to the claim or metric contract. Existing
table-config reconstruction moves into extraction or governed normalisers as each
data gap closes. Every temporary compatibility recovery emits a named counter;
the counter reaches zero before removal. The governed query-time derivation
pattern remains valid only when it emits typed value, basis, reason and lineage,
not a bare null. Party is identity, not a normaliser: missing or conflicting
party blocks publication and comparison rather than triggering text inference.

### Phase 5: One writer, corrections and candidate releases

Make every ingest, full extraction, per-family reprocess and correction flow
call the same canonical writer. Validate before persistence and write provision
instances, components, excerpts, claims, evidence and relationships
transactionally per deal/run. Derive `provisions.ai_metadata.features` from
canonical facts only. Every flow emits a complete closure-validated
`DealSnapshot`; per-family work carries forward unchanged certified family sets
by immutable reference only when their contract fingerprints pass snapshot
compatibility certification.

Apply human corrections before candidate certification. Build releases offline
in staging and never partially mutate the live corpus. Run staged candidate
builds over QXO, Verve, Metsera, ten varied deals and then the full corpus. Each
stage requires a backup, dry-run diff, correction-preservation audit,
idempotence rerun and before/after semantic and market diff. WP-R1 and WP-R2
ride their first applicable candidate stages. Canonical numeric backfill occurs
here after its schema migration, never through a runtime error probe. The full
candidate produces the immutable release bundle used by the promotion importer;
production never reruns the candidate transformations.

### Phase 6: Market serving projection and bounded cohorts

Build the compact `market_observation` projection with the full identity from
Section 7: release, deal, concept, metric, party, result key and version,
non-null owner type and ID, non-null scope type and ID, and deterministic value
ordinal. Materialise common aggregates. Serve arbitrary refined cohorts through one indexed,
set-based SQL/RPC and a release-aware cache. The number of database calls and
rows returned to Node is bounded by request shape, not corpus size. The database may
perform an indexed set aggregation over the selected cohort, but it may not
return broad cards or claims for application-side calculation.

Complete MKT-1, MKT-2 and MKT-3 on this path: provide source deal and card
lineage for every value, resolve provision codes per row rather than by a
section-wide dominant code, and pass context through direct props rather than
a global UI bridge. Cohorts distinguish party role and value, beneficiary,
seller-side and buyer-side fees, applicable deals, examined deals and present deals.
Presence prevalence remains a small secondary statistic; term treatments,
exceptions, triggers, distributions and source context are primary.

Every aggregate returns separate distinct-deal counts for eligible, applicable,
examined, present, comparable and excluded observations, with exclusion
reasons. Prevalence is present divided by examined eligible and applicable
deals. A term distribution uses distinct present deals with compatible
canonical observations.
`NOT_APPLICABLE`, `NOT_EXAMINED`, `FAILED` and present-but-unnormalisable
observations remain visible but do not silently enter those denominators.

Replace process-local containment as the primary control with the shared
single-flight cache fill, fleet-wide admission budget, statement timeout,
request deadline and shared circuit policy specified above. Declare a fixed
maximum database-call count for every active route. The serving layer fails
closed when shared admission state is unavailable and retains enough connection
headroom for ingest, admin and rollback operations.

The market route may reopen only after its projection is certified, its
responses are safely cacheable and the Phase 9 database load gate passes.

### Phase 7: Shared results and row contract across every surface

Implement the versioned result composer and one shared row contract for Review,
Corpus Context, Compare, Query and Admin. A row may combine multiple provisions
through typed relationships, including a representation plus bring-down or a
fee plus triggers, while preserving each component's state, party and evidence.
Nested definitions remain independently inspectable.

All surfaces render explicit `ABSENT`, `NOT_APPLICABLE`, `NOT_EXAMINED` and
`FAILED` states instead of blanket “No market data”. They use the same raw and
canonical values, market observations, denominator labels, source roles and
refinable dimensions. Display and sidebar components may arrange the contract
differently, but cannot reinterpret it. Existing active index filters and
result-specific columns remain available to refine output. The Query surface
must additionally expose the plan's columns, cohort, counts, exclusions,
pagination and source actions rather than reducing a result to a chart or
presence count.

Natural-language, manual and saved forms of the same request must compile to
the same plan and return semantically identical rows. Golden query tests include
termination-fee market checks with fee side and triggers, no-shop treatment and
exception distributions, scoped notice and matching periods, rep plus
bring-down composition, dollar thresholds as deal-relative percentages, and filters
refined by all returned and general index dimensions. Client and server validate
the same generated request schema. “What's market?” must compile to an
executable plan with governed result or metric selections, render actual market
rows and allow chart buckets and columns to refine that plan; navigation copy or
an empty cross-cut payload is not acceptance.

### Phase 8: Operations, traceability and continuous gates

Repair Admin to read live canonical staging tables. Replace processing-flow
stubs with run metrics, expose quarantine and residual queues, distinguish
current from target stages, and show candidate certification, active release,
correction application and rollback state.

Create one machine-readable traceability matrix covering every active route,
row, concept, extraction rule, claim, normaliser, metric, cohort, component,
query-plan operator, request and result schema, index or materialised view,
cache policy, corpus-coverage result and every test case and suite. Test coverage
includes extraction goldens, identity stability, contract enforcement,
cross-view browser acceptance, visual regression, accessibility, security,
backup restoration, rollback, performance and database load or soak tests.
Contract generation and CI update or reject that matrix; it is not a manually
drifting report.

Add the existing eleven invariants to CI and release certification. Recovery
usage may only decrease. Identity drift, silent semantic changes, unrecognised
party tokens, invalid states, missing evidence, unresolved residuals and direct
compatibility writes fail mechanically. Complete the client-auth and security
decision before exposing serving routes. At minimum, every route is classified
in a governed manifest as public, authenticated user, admin or internal job;
the default is deny; the browser never receives a service credential; service
credentials stay server-side; and any route whose classification Ben has not
approved remains inaccessible.

### Phase 9: Candidate certification and production release

The programme cannot be called complete, and the active release pointer cannot
move, until the pre-cutover gates below are mechanically green. One generated,
schema-validated `release-certification` manifest is authoritative. For each
gate it records the release and commit, governed threshold, measured value,
status, immutable artefact digest, environment, reviewer and Ben approval where
required. A prose assertion or missing artefact cannot pass a gate.

Before the candidate runs, the governed contract fixes the high-risk-family
list, registry disposition enum, semantic-diff classifications, complete
recovery-counter inventory, browser and accessibility thresholds, performance
budgets, soak traffic profile and restore/rollback success criteria. Those
thresholds cannot be relaxed after seeing a failure without a separately
reviewed and Ben-approved manifest revision.

The pre-cutover gates are:

- all 704 registry entries have a final disposition;
- MKT-1, MKT-2 and MKT-3 are complete;
- every outstanding item in the Ben runbook is complete;
- canonical numeric schema migration and backfill are complete;
- render-parity tooling is complete and green;
- structured-claims validation and persistence enforcement are active;
- party-token lint is green;
- the security and client-auth decision is implemented, including recorded
  completion of the credential actions in Phase 0 without recording secrets;
- the full corpus is shadow re-extracted twice, with a third run for every
  disagreement and every high-risk family;
- identity is exactly stable, silent semantic drift is zero, unresolved
  residuals are zero and active compatibility-recovery counters are zero;
- full cross-view browser acceptance and visual regression have zero
  unexplained differences, accessibility has zero serious or critical
  violations, and the Section 8 API and browser performance budgets are green;
- current-production baseline smoke and staging-preview candidate smoke are
  green, and the post-cutover smoke and automatic rollback procedure have been
  rehearsed against staging;
- a database load and soak test proves market traffic cannot exhaust the
  60-connection Supabase Micro instance. The manifest measures trailing-30-day
  production peak as both maximum one-minute request rate and maximum one-minute
  in-flight concurrency, then fixes steady targets of at least five requests per
  second or three times the observed rate, whichever is higher, and at least 20
  in-flight requests or three times observed concurrency, whichever is higher.
  A seeded generator ramps for five minutes, holds those targets for 60 minutes
  and then holds twice the target request rate for a 15-minute burst across at
  least four application instances.
- The fixed traffic mix is 25% Review, 15% Corpus Context, 20% Compare and
  `DEAL_TO_MARKET`, 25% query initial/refine/page across all five intents, 10%
  evidence and facet/field-value requests, and 5% export and Admin/background
  work. Seventy percent of cacheable requests are repeated hits and 30% are
  unique misses. The manifest records concrete resolved rates, concurrency,
  fleet size, ramp, deterministic think-time distribution and route weights.
  Active serving connections remain at or below 30, and total database
  connections across serving, export, Admin and background work never exceed 40,
  leaving 20 reserved. There are zero pool-exhaustion events or database
  timeouts and all declared error and latency budgets remain intact. One market
  request produces no corpus-proportional number of calls
  and returns no broad corpus payload to the application; an approved indexed
  set aggregation inside Postgres is permitted;
- backup restoration and active-corpus rollback are rehearsed successfully;
  and
- the traceability matrix is complete and mechanically agrees with the active
  routes, contract, tests and certified corpus release.

The Ben-run corpus gate is self-contained. Each action below requires a stored
dry-run artefact, Ben's local `--apply` record where applicable and a post-write
verification linked from the certification manifest. Every write-bearing action
targets the staging candidate only; any earlier instruction to apply a repair
directly to the production corpus is superseded. Read-only production checks
remain permitted.

1. code intervening-event classifications;
2. code information-sharing classifications;
3. run the four mass-null classify repairs for Summit, Catalent, Juniper and
   ENDRA;
4. canonicalise duplicate codes;
5. apply the per-deal corrections in `reports/query-field-conflicts.md`;
6. verify Gilead/Pharmasset cards serve and refresh its corpus cache; and
7. code appraisal-rights classifications.

After those staging gates, export and Ben-import the certified release into the
inactive production namespace. A promotion gate compares the production object
counts, identities, checksums and projection aggregates with the certified
staging bundle and proves the active pointer and old product path are unchanged.
Only then publish by atomic active-release pointer swap and enable the master
exposure gate. Run the candidate-specific live production smoke suite. Any
failure automatically restores the prior pointer and master gate. The programme
is complete only after that post-cutover smoke passes and its evidence is
appended to the certification manifest, not merely after a successful candidate
build.

## Sequencing and ownership

- The emergency route closure is deployed, live-verified and remains in force.
  The Zayo disposition and credential-rotation evidence remain open Phase 0
  actions. The current step is finalising and reviewing this written plan. No
  post-containment Phase 0 work, canonical implementation or canonical data work
  begins until the security evidence is recorded. No canonical rebuild begins
  until Fable or Claude 5.6 Sonnet has also reviewed the legal-semantic, identity
  and extraction design and Ben has approved the written specification.
- Complete the isolated Supabase staging project and staging-only Vercel
  `deal-corpus` branch preview next. Record their non-secret project identities
  and prove that no production credential is present before data work.
- Phase 0's factual baseline and Phase 1's contract follow. Phase 2 implements
  immutable identity. Phase 3 then extracts against that identity. Phases 4 and
  5 normalise and build candidate releases. Phase 6 builds the serving path.
  Phase 7 moves all surfaces to the shared contract. Phase 8 instruments and
  traces the system. Phase 9 alone authorises cutover.
- Agents draft. Fable or Claude 5.6 Sonnet reviews every legal-semantic,
  identity and extraction diff. Ben decides taxonomy and codebooks through the
  Freeze Gate. No such diff merges unreviewed.
- Completed slices land into `main` only behind disabled flags after review and
  mechanical gates. Every increment leaves `main` deployable. Candidate data
  stays in staging until the Phase 9 pre-promotion gates pass. Its subsequent
  content-addressed import stays inactive and inaccessible until atomic cutover,
  and no slice flag may bypass the master exposure gate.
- The pause on piecemeal implementation remains until architecture review and
  environment isolation are complete. Later product work may proceed only as
  an approved architectural slice or a separately authorised emergency fix;
  neither may bypass canonical gates or introduce a second write path.
- The existing WP-R punchlist in docs/PLAN.md maps: R1/R2→Phase 5,
  R3/R8→Phase 3 data passes, R4→Phase 3, R5→Phase 5, R6→Phase 3,
  R7→Phase 3 (Fable-or-Claude-5.6-gated), R9→Phase 1 vocabulary work
  (Ben-gated), R10→independent cosmetic. Product work that touches shared rows
  also enters the Phase 8 traceability matrix.
