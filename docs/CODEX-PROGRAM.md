# Canonical corpus v2: governing architecture and certification programme

2026-07-20. Status: GOVERNING SPECIFICATION, EXECUTION BLOCKED. The prior
architecture at commit `9af34c5` was rejected by adversarial review. Programme
status derives only from the registry and generated status artefact below.
Prose cannot satisfy, waive or change a gate. Missing, stale, malformed or
unverifiable evidence is `OPEN` and blocks the affected work.

```yaml
programme_gate_registry:
  schema: canonical-programme-gates/v1
  specification_identity: CONTENT_DIGEST
  status_artifact: docs/certification/programme-gate-status.json
  status_source: GENERATED_STATUS_ARTEFACT_ONLY
  absent_status_effect: ALL_GATES_OPEN
  evidence_directory: docs/certification/evidence
  default_state: OPEN
  invalid_or_missing_evidence_state: OPEN
  default_permits_not_applicable: false
  allowed_states: [OPEN, PASS, FAIL, NOT_APPLICABLE]
  normally_satisfying_states: [PASS]
  work_class_references: TRANSITIVE_ALL_OF

  work_classes:
    specification_review:
      all_of: []
    emergency_containment:
      all_of: []
    implementation_planning:
      all_of:
        - G0_INDEPENDENT_SEMANTIC_REVIEW
        - G0_BEN_SPEC_APPROVAL
    isolation_boundary_setup:
      all_of:
        - G0_ZAYO_DISPOSITION
        - G0_CLAUDE_CREDENTIAL_ROTATION
        - G0_SUPABASE_SECRET_DISPOSITION
    snapshot_restore_and_preview:
      all_of:
        - isolation_boundary_setup
        - G0_STAGING_SUPABASE_ISOLATED
        - G0_STAGING_VERCEL_ISOLATED
        - G0_STAGING_ACCESS_PROTECTED
    canonical_work_start:
      all_of:
        - snapshot_restore_and_preview
        - G0_MARKET_STATS_CONTAINED
        - G0_BROAD_CORPUS_ROUTES_CONTAINED
        - G0_INDEPENDENT_SEMANTIC_REVIEW
        - G0_BEN_SPEC_APPROVAL
    production_import:
      all_of:
        - canonical_work_start
        - P9_SCOPE_EXACT
        - P9_REGISTRY_DISPOSITIONS
        - P9_MKT_WORK
        - P9_BEN_RUNBOOK
        - P9_NUMERIC
        - P9_RENDER_PARITY
        - P9_STRUCTURED_CLAIMS
        - P9_PARTY_LINT
        - P9_SECURITY_AUTH
        - P9_SHADOW_REEXTRACTION
        - P9_IDENTITY_AND_DRIFT
        - P9_BROWSER_A11Y_PERFORMANCE
        - P9_STAGING_SMOKE_AND_ROLLBACK
        - P9_DATABASE_SOAK
        - P9_BACKUP_RESTORE
        - P9_TRACEABILITY
        - P9_DEPLOYMENT_PARITY
    production_cutover:
      all_of:
        - production_import
        - P9_IMPORT_PARITY
        - P9_CUTOVER_AUTHORISATION
    programme_complete:
      all_of:
        - production_cutover
        - P9_POSTCUTOVER_SMOKE
        - P9_PROGRAMME_COMPLETION_ATTESTATION

  gates:
    - id: G0_MARKET_STATS_CONTAINED
      phase: 0
      permits_not_applicable: false
      evidence_contract: route-disabled-code-test-live-response/v1
    - id: G0_BROAD_CORPUS_ROUTES_CONTAINED
      phase: 0
      permits_not_applicable: false
      evidence_contract: broad-route-inventory-and-containment/v1
    - id: G0_ZAYO_DISPOSITION
      phase: 0
      permits_not_applicable: false
      evidence_contract: non-secret-owner-purpose-disposition/v1
    - id: G0_CLAUDE_CREDENTIAL_ROTATION
      phase: 0
      permits_not_applicable: false
      evidence_contract: non-secret-rotation-completion/v1
    - id: G0_SUPABASE_SECRET_DISPOSITION
      phase: 0
      permits_not_applicable: true
      not_applicable_only_if:
        gate: G0_ZAYO_DISPOSITION
        fact: recognised_authorised_traffic
        ben_approval_required: true
      evidence_contract: non-secret-rotation-or-approved-na/v1
    - id: G0_STAGING_SUPABASE_ISOLATED
      phase: environment
      permits_not_applicable: false
      evidence_contract: staging-project-credential-isolation/v1
    - id: G0_STAGING_VERCEL_ISOLATED
      phase: environment
      permits_not_applicable: false
      evidence_contract: preview-project-credential-isolation/v1
    - id: G0_STAGING_ACCESS_PROTECTED
      phase: environment
      permits_not_applicable: false
      evidence_contract: default-deny-preview-access-test/v1
    - id: G0_INDEPENDENT_SEMANTIC_REVIEW
      phase: governance
      permits_not_applicable: false
      evidence_contract: independent-semantic-review-disposition/v1
    - id: G0_BEN_SPEC_APPROVAL
      phase: governance
      permits_not_applicable: false
      evidence_contract: ben-approved-spec-digest/v1
    - id: P9_SCOPE_EXACT
      phase: 9
      evidence_contract: corpus-scope-set-equality/v1
    - id: P9_REGISTRY_DISPOSITIONS
      phase: 9
      evidence_contract: frozen-registry-full-disposition/v1
    - id: P9_MKT_WORK
      phase: 9
      evidence_contract: mkt-1-2-3-completion/v1
    - id: P9_BEN_RUNBOOK
      phase: 9
      evidence_contract: ben-runbook-completion/v1
    - id: P9_NUMERIC
      phase: 9
      evidence_contract: numeric-schema-backfill-certification/v1
    - id: P9_RENDER_PARITY
      phase: 9
      evidence_contract: render-parity-certification/v1
    - id: P9_STRUCTURED_CLAIMS
      phase: 9
      evidence_contract: claims-validation-persistence-enforcement/v1
    - id: P9_PARTY_LINT
      phase: 9
      evidence_contract: party-token-lint/v1
    - id: P9_SECURITY_AUTH
      phase: 9
      evidence_contract: route-action-auth-security/v1
    - id: P9_SHADOW_REEXTRACTION
      phase: 9
      evidence_contract: repeated-shadow-extraction/v1
    - id: P9_IDENTITY_AND_DRIFT
      phase: 9
      evidence_contract: identity-residual-recovery-drift/v1
    - id: P9_BROWSER_A11Y_PERFORMANCE
      phase: 9
      evidence_contract: browser-a11y-performance/v1
    - id: P9_STAGING_SMOKE_AND_ROLLBACK
      phase: 9
      evidence_contract: current-candidate-smoke-rollback/v1
    - id: P9_DATABASE_SOAK
      phase: 9
      evidence_contract: sixty-connection-load-soak/v1
    - id: P9_BACKUP_RESTORE
      phase: 9
      evidence_contract: backup-restore-corpus-rollback/v1
    - id: P9_TRACEABILITY
      phase: 9
      evidence_contract: bidirectional-trace-set-equality/v1
    - id: P9_IMPORT_PARITY
      phase: 9
      evidence_contract: inactive-production-import-parity/v1
    - id: P9_DEPLOYMENT_PARITY
      phase: 9
      evidence_contract: certified-executable-deployment-parity/v1
    - id: P9_CUTOVER_AUTHORISATION
      phase: 9
      evidence_contract: one-use-ben-cutover-authorisation/v1
    - id: P9_POSTCUTOVER_SMOKE
      phase: 9
      evidence_contract: postcutover-smoke-attestation/v1
    - id: P9_PROGRAMME_COMPLETION_ATTESTATION
      phase: 9
      evidence_contract: programme-completion-attestation/v1
```

Each evidence record contains gate ID, specification and code commits,
environment, evidence schema, immutable artefact references and digests,
validator version, measured value, governed threshold, result and required
review or approval identities. It never contains a secret. Only the
certification validator may generate the status artefact. A manual edit, stale
commit or environment, digest mismatch or impermissible `NOT_APPLICABLE` leaves
the gate open. Because the status artefact does not yet exist, every gate is
formally open despite the separately verified market-stats containment.

Production cutover and programme completion remain blocked until the Phase 9
certification and post-cutover attestation gates are mechanically green. The
factual review covered admin pages, registry typing, identity and lineage,
schema-shape documentation, comparison-layer normalisers and active query
routes. `docs/PLAN.md` work packages WP-R1 through WP-R10 fold into the phases
below.

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
- Piecemeal implementation is paused until every start gate in the authoritative
  state block is closed. Only the enumerated emergency P0 containment work may
  change application code while those gates are open. After the start gate,
  approved architectural slices proceed independently and leave `main`
  deployable.

## Binding target architecture

This section is normative. Later phases describe how to reach it. A product
row is not assumed to equal one source span, and a source span is not assumed
to contain only one semantic object. The system preserves source-backed facts
as separate objects and combines them by typed reference.

### 0. One authoritative contract source

- `lib/schema/canonical/contract-v2/manifest.json` and its closed, digest-listed
  file set form `CanonicalContractBundle`, the sole editable authority for legal
  concepts, parties, claim, relationship, result and metric definitions,
  correction slots, source-admission rules, units, normalisers, dependency DAGs,
  query schemas, serving-row schemas and certification-policy schemas. It has
  one versioned root manifest, a closed file set and one content fingerprint.
- Code, database constraints, generated types, query schemas, UI catalogues,
  compatibility registries and migration-map schemas and validators are
  generated one-way from that bundle. They are never reconciled back into it,
  and generated artefacts cannot be hand-edited. Legacy differences create
  reviewed proposals only.
- Instance-specific source-admission, deal, anchor, supersession and correction
  mappings are content-addressed governed data conforming to those generated
  schemas. They require the specified review and approval, are never generated
  merely because a legacy row exists and cannot define taxonomy or codebooks.
- Immutable governed configuration instances have disjoint authority.
  `CacheBudgetManifest` alone owns deployed cache TTLs, entries, bytes, release
  retention, fill quotas and rates. `CapacityManifest` alone owns fleet and
  per-class admission, admission-queue deadlines, fill leases, circuit
  parameters and database connection caps. `RouteBudgetManifest` alone owns
  deployed per-route calls, rows, bytes and execution deadlines.
  `CertificationPolicyManifest` alone owns certification methods,
  pass thresholds, risk lists and adjudication rules. The bundle defines their
  schemas and immutable protocol upper bounds, not duplicate deployed settings.
  None may define legal semantics, identities, metrics or codebooks.
- `OperationalPolicySet` ID hashes its schema version and the exact
  CacheBudgetManifest, CapacityManifest and RouteBudgetManifest IDs in that
  fixed order.
  CertificationPolicyManifest references that set. Compilation
  fails on duplicate field ownership, an instance above a protocol bound or any
  mismatched policy-set reference.
- Existing feature, taxonomy and market registries become classified migration
  inputs or generated compatibility outputs with final dispositions. During
  transition they may reject a compatibility write, but they cannot admit a
  canonical fact or become an alternate authoring authority.
- Every bundle change passes the Freeze Gate. The approved fingerprint is
  pinned into every family set, snapshot, release, QueryPlan and serving
  response. Compilation fails on duplicate keys, unknown codes, unresolved
  references, a dependency cycle or generated drift.

### 1. Immutable source and deterministic structure

- `SourceContent` stores the exact received bytes in immutable encrypted object
  storage. `source_content_id` is the domain-separated hash of source kind,
  byte length and exact-bytes SHA-256. `ORIGINAL_BYTES` admission requires those
  bytes to remain retrievable and hash-identical; a legacy-derived payload is a
  different source kind and content ID. Content deduplication shares only this
  immutable payload, never provenance or occurrence identity.
- `source_document_occurrence` stores one immutable receipt of a document and a
  required `source_content_id`. Its stable `source_occurrence_id` is the
  domain-separated hash of a versioned intake receipt containing source system,
  immutable external accession or Ben-approved import key, source version where
  available and source-content ID. Two source occurrences with identical bytes
  remain distinct when their receipts differ;
  a replay imports the original receipt rather than allocating a new database
  identity.
- The identity-bearing intake key is an immutable external accession or a
  Ben-approved import key. URL, filename, acquisition time, database UUID and
  run ID are provenance only. A legacy derived record uses a separate typed
  source kind and can never collide with `ORIGINAL_BYTES`.
- A `SourceAdmissionManifest` is required for every source occurrence before
  extraction. It records raw-source disposition, receipt and retrieval
  provenance, converter code and configuration, canonical-to-source map,
  admitted and excluded intervals, governed exclusion reasons, conversion-loss
  residuals and coverage proof. Source kind is `ORIGINAL_BYTES` or
  `LEGACY_DERIVED_SOURCE`; admission state is `VERIFIED`, `QUARANTINED` or
  `REJECTED`. A historic record without original bytes may not
  masquerade as an original source: it must be reacquired and verified, or be
  admitted only under an explicit versioned SourceAdmissionRule approved through
  the Freeze Gate, or given an approved exclusion. Unresolved source loss blocks
  release, and the legacy kind remains visible in every downstream manifest.
- `source_admission_manifest_id` is the domain-separated content hash of source
  occurrence, source kind and admission state, admission-rule version,
  source-content and canonical-text IDs, converter and source-map digests,
  admitted and excluded interval sets with reasons, conversion-loss residual IDs
  and the complete
  coverage-proof digest. Mutable review metadata and timestamps are provenance.
- `CanonicalTextContent` stores the exact immutable UTF-8 extraction bytes. Its
  content ID hashes encoding, byte length and exact bytes.
  `CanonicalTextOccurrence` references that content plus converter provenance;
  `canonical_text_id` is its occurrence ID and derives from
  `(source_occurrence_id, converter_version, converter_config_digest,
  canonical_text_content_id)`. The occurrence and content records contain the
  only permitted occurrence-to-content references, enforced by foreign keys;
  there is no fuzzy or separately mutable content edge. Downstream source-backed
  identity always uses `canonical_text_id` or `source_occurrence_id`, never a
  bare content hash. Identical canonical bytes may share content storage while
  their occurrences and evidence remain distinct.
- The authoritative coordinate system is half-open UTF-8 byte intervals
  `[start, end)` over the stored canonical text. Any UTF-16 browser indices are
  derived. The admission manifest identifies the exact interval universe over
  which completeness or absence may be asserted.
- `structural_span` records articles, sections, subsections, paragraphs and
  leaf spans. Leaf spans partition the canonical text for coverage accounting.
  Identity derives from `(canonical_text_id, structural_model_version, start,
  end, structural_kind, ordinal)`. Re-ingesting the same source with the same
  canonical-text and structural-model versions must reproduce the same
  boundaries, offsets, kinds and source-order ordinals.
- `SemanticSpan` is source geometry, not legal meaning. Its ID derives from
  `(canonical_text_id, absolute_start, absolute_end)`, so exact interval
  duplicates collapse. Semantic objects and evidence roles point to spans and
  may reuse or nest them; the span owns no copied source text.
- `Excerpt` may select one or several spans. Its ID derives from the ordered,
  deduplicated span IDs, excerpt purpose, transformation or redaction version
  and output-text hash. The stored output must be reproducible byte-for-byte
  from those spans and transformation. An unexplained mismatch is quarantined.
  By default all spans belong to one canonical-text occurrence and sort by
  offsets. A governed cross-source excerpt must declare component slots and
  their order in its ExcerptDefinition; lexical source IDs are not legal order.
- `governed_deal_key` is the domain-separated hash of
  `(deal_identity_schema_version, immutable_deal_seed)` in a
  `DealIdentityManifest`. The seed is one immutable external transaction ID or
  Ben-approved import identity. Buyer, seller, title, value, dates, aliases and
  environment-allocated UUIDs do not enter it. `DealAdmissionManifest`
  separately maps ordered source occurrences and document roles to that key.
  Source-membership changes revise the admission manifest without changing deal
  identity. Duplicate, merge or split decisions require an explicit reviewed
  supersession map.
- `deal_identity_manifest_id` is the content hash of the identity-schema
  version, immutable seed, governed deal key and any reviewed supersession
  references. `deal_admission_manifest_id` is the content hash of governed deal
  key, admission-contract version and the ordered complete set of
  `(document_role, source_occurrence_id, source_admission_manifest_id,
  source_ordinal)` mappings. A role or membership change creates a new admission
  manifest; no current database membership query may substitute for it.

### 2. Definitions-first semantic objects and stable identity

- Definitions are classified before provisions. A definition is a
  `ProvisionInstance(kind=definition)`, including a definition embedded in an
  operative clause or another definition.
- Each operative legal mechanism is a separate `ProvisionInstance`. A broad
  structural section may therefore produce several semantic instances, such
  as covenant compliance, representation accuracy and no-MAE conditions in
  one closing-conditions subsection.
- `source_anchor_id` equals the stable `SemanticSpan` occurrence ID. Multiple
  semantic objects may share one source anchor. It identifies where a candidate
  came from without asserting what it means or
  depending on a structural parser's boundaries.
- A `ProvisionInstance` and `ProvisionComponent` are exhaustive immutable
  occurrence records, not mutable entities with an unstated revision layer.
  Their IDs and canonical object digests cover every normative field they are
  permitted to own. All extracted legal attributes live in versioned claims or
  relationships. Changing an identity-bearing field creates an explicitly
  superseding occurrence; changing a legally material attribute creates a new
  ClaimRevision or RelationshipRevision.
- Provision identity is anchored to `(source_occurrence_id, canonical_text_id,
  document_hash, absolute_start, absolute_end, concept_key, party, ordinal)`.
  `document_hash` is the SourceContent exact-bytes hash, including its typed
  legacy-source domain when original bytes are unavailable; `party` is a governed
  `{ role, value }` attribution. This preserves the required document-hash and
  offset anchor without collapsing distinct occurrences or converter versions.
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
  canonical_text_id, absolute_start, absolute_end, component_key, ordinal)`.
  The ordinal is source order among distinct spans with the same component key
  inside the parent. Candidates with the same parent, offsets and component key
  are resolved as exact duplicates or quarantined before ordinal assignment;
  they are never given arbitrary different ordinals. A standalone legal
  mechanism remains its own `ProvisionInstance`. This lets one
  representation address limbs separately while keeping signing cleanup and an
  ongoing no-shop restriction as separate mechanisms.
- A `SourceClassificationSlot` identifies one semantic classification position
  as `(source_anchor_id, semantic_object_kind, slot_ordinal)`, independent of
  the current concept or party decision. It exists only to target reviewed
  classification changes. Adding a coexisting object and replacing an existing
  classification are different correction operations.
- Classification-slot ordinals sort by anchor interval, semantic-object kind and
  a reviewed anchor-local candidate key and digest that exclude the current
  concept, party and model output. Coexisting same-anchor objects receive
  distinct reviewed local keys before classification. Model or insertion order
  is invalid.
- Every contract definition that permits an ordinal compiles one total
  comparator. The default source comparator is document-role priority and
  source ordinal from DealAdmissionManifest, then `canonical_text_id`, start,
  end, object type and key, party role and value and the governed pre-ordinal
  candidate digest. A family-specific comparator may replace it only through
  the Freeze Gate. Exact pre-ordinal duplicates collapse; non-identical
  candidates still tied on the complete comparator are quarantined. Model,
  insertion, database iteration and run order are never tie-breakers.
- A `ScopeAssessmentOccurrence` gives a whole-concept assessment a stable
  non-fabricated subject identity derived from its governed source occurrence or
  DealAdmissionManifest subject, assessment definition and version, concept,
  governed party and the complete intended admitted-scope interval set. Every
  interval-set member is `(canonical_text_id, start, end)`, so a deal-level
  assessment may cover several admitted documents without mixing coordinate
  systems. Examination progress is revision content and never changes this
  logical occurrence ID.
- Any change to a source-anchor tuple, including a same-text boundary correction,
  requires an explicit reviewed anchor-migration map. Any change to a semantic
  or component identity creates a recorded superseding identity. Neither may be
  recovered by fuzzy matching.

### 3. Typed claims, evidence and explicit states

- Every extracted answer is a typed claim governed by a `ClaimDefinition`.
  `claim_occurrence_id` derives from subject type and stable subject occurrence
  ID, claim-definition key and version and a deterministic source-order ordinal
  for governed repeatable claims. It means “this expected assertion here”, not
  “this immutable answer”. A non-repeatable definition producing two logical
  occurrences is quarantined.
- Each answer is an immutable `ClaimRevision`. Its ID is the
  domain-separated content hash of claim occurrence, exact
  ScopeAssessmentRevision ID when its owner is a ScopeAssessmentOccurrence,
  state, raw and canonical values, unit, day basis, denominator, intended
  admitted scope, examination coverage, ordered
  `ClaimEvidence` edge IDs, applicability or failure payload and every
  extraction, normalisation and derivation version, plus ordered applied
  CorrectionApplication IDs. Run ID, timestamps and reviewer metadata remain
  provenance outside identity. Any change to state, value, scope, evidence or
  derivation produces a new revision ID.
- Claim state is exactly one of `PRESENT`, `ABSENT`, `NOT_APPLICABLE`,
  `NOT_EXAMINED` or `FAILED`. `ABSENT` is valid only when the complete
  applicable scope has been examined. Missing data is never silently treated
  as absence.
- Every claim occurrence is owned by exactly one `ProvisionInstance`,
  `ProvisionComponent` or `ScopeAssessmentOccurrence`. Cross-provision facts
  remain separate revisions and combine only in a `DerivedResult`.
- `ClaimEvidence` is many-to-many. Its deterministic edge ID derives from
  `(claim_occurrence_id, evidence_role, excerpt_id, ordinal)`. A ClaimRevision
  selects the exact ordered evidence-edge set it relies upon, so an evidence
  change changes the revision without creating a cycle. One claim may cite
  several excerpts only when they jointly establish its single proposition.
  Evidence roles include
  `OPERATIVE_TEXT`, `DEFINITION`, `EXCEPTION`, `CROSS_REFERENCE` and
  `DERIVATION_INPUT`.
- Evidence ordinals sort by the excerpt's governed document-role and source
  order, earliest start, final end, governed role and excerpt ID. Model,
  insertion and database iteration order never enter them.
- Every `PRESENT` or `ABSENT` claim records the examined scope. Every `PRESENT`
  claim has exact evidence. `ABSENT` instead requires non-empty examined scope,
  scope-coverage proof and extractor/version provenance; it does not require a
  fabricated positive quote. Missing evidence on a `PRESENT` claim, evidence
  outside the admitted scope, invalid taxonomy codes and unknown attributes
  block publication and enter quarantine as retained residuals.
- The `ClaimDefinition` selects the exact governed subject. A whole-provision
  claim attaches to its `ProvisionInstance`; a limb-scoped claim attaches to its
  `ProvisionComponent`; a whole-concept state attaches to its
  `ScopeAssessmentOccurrence`. The presence of a parent provision never reparents a
  component claim. An `ABSENT` claim does not fabricate a provision span.
- `ScopeAssessmentRevision` ID hashes its occurrence ID, coverage status,
  examined interval-set key, coverage-proof digest, assessor contract version,
  ordered source Excerpt IDs and state-specific applicability or failure inputs. Coverage status
  is `NOT_STARTED`, `PARTIAL`, `COMPLETE` or `FAILED`, independently of claim
  state. Examined intervals must be contained in intended scope and duplicate
  leaf coverage is invalid.
- `NOT_STARTED` has an empty examined set. `PARTIAL` has a strict non-empty
  subset of intended applicable leaves. `COMPLETE` covers every intended
  applicable leaf exactly once. `FAILED` records attempted coverage, canonical
  failure code and assessor version. A scope-owned `ABSENT` ClaimRevision also
  requires no qualifying present witness. A `PRESENT` existential claim may use
  partial coverage only when its ClaimDefinition declares one exact witness
  conclusive; a universal claim may not.
  `NOT_APPLICABLE` records the rule and source-backed facts;
  `NOT_EXAMINED` records intended scope, any partial coverage and reason;
  `FAILED` records intended scope, attempted extractor, canonical failure code
  and source-backed failure inputs. None is interchangeable with `ABSENT`.
- A non-`PRESENT` ClaimRevision carries no asserted scalar raw or canonical
  value. State-specific facts live in typed applicability, coverage or failure
  fields. A missing expected claim or component is a contract failure, not an
  implicit state.
- Conflicting revisions may coexist in staging quarantine, but one family set
  and DealSnapshot select exactly one ClaimRevision and, where applicable, one
  ScopeAssessmentRevision per occurrence. Unresolved multiplicity blocks
  certification.
- A substantive threshold inside one limb is not promoted into a general
  qualifier on the whole provision. Qualifier scope is part of the claim.

### 4. Typed relationships and multi-span result composition

- `RelationshipDefinition` governs typed edges including `CONTAINED_IN`,
  `USES_DEFINITION`, `APPLIES_TO`, `BRINGS_DOWN`, `EXCEPTED_BY`, `GOVERNS`,
  `ENFORCED_BY`, `TRIGGERS_REMEDY` and `MIRRORS`. Vocabulary changes pass the
  Freeze Gate.
- It declares permitted source and target object types, cardinality, required
  evidence roles, state rules and whether targets may be components or claims.
  `relationship_occurrence_id` derives from definition and version, typed
  `source_endpoint_occurrence_id`, governed target type and role, complete
  intended-scope interval set and source-order ordinal. Every state requires
  non-empty intended scope; a relationship without it is quarantined.
- `RelationshipEvidence` is a deterministic edge with ID derived from
  `(relationship_occurrence_id, evidence_role, excerpt_id, ordinal)`. Its
  definition governs permitted roles, and the universal compiled ordinal rule
  applies. Relationship evidence is not an untyped excerpt array.
- Each immutable `RelationshipRevision` hashes the occurrence ID, state,
  canonical raw scope, the exact source endpoint revision ID when that endpoint
  type is revisioned, ordered resolved target occurrence IDs and, for revisioned
  target types, their exact selected revision IDs, ordered RelationshipEvidence
  edge IDs, state-specific coverage, applicability or failure payload, resolver
  version and ordered applied CorrectionApplication IDs. `PRESENT` requires
  exact evidence and resolved endpoints. `ABSENT` requires coverage proof. `NOT_APPLICABLE`,
  `NOT_EXAMINED` and `FAILED` follow the same state invariants as claims. No
  unresolved target receives a fabricated object ID. Exact revisions collapse;
  conflicting revisions from one run are quarantined.
- `EXCEPTED_BY` is not legally self-explanatory. Its definition must also state
  governed legal effect, affected target component set, conditionality,
  precedence and whether the relationship narrows, overrides, suspends or
  supplies an alternative. A generic exception edge without those fields
  cannot publish.
- Fuzzy text matching may propose a relationship for review. It may not write
  a canonical edge or transfer claims between objects.
- `ResultDefinition` specifies a versioned lawyer-facing answer: its required
  and optional component claims, permitted relationships, ordering,
  normalisation rules and failure behaviour. It fixes maximum inline component,
  relationship, observation and evidence-reference cardinalities and bytes per
  slot and per row. A governed repeatable slot may use a bounded cursor-backed
  child collection with an exact total; required content may never be silently
  truncated. Exceeding an undeclared or hard cardinality is a contract failure.
- `derived_result_occurrence_id` derives from `(governed_deal_key,
  deal_admission_manifest_id, result_key, result_version, party_role,
  party_value, ordinal)`. A `DerivedResultRevision` then hashes that occurrence
  ID, composer version and ordered component-slot keys, ClaimRevision IDs,
  RelationshipRevision IDs and accepted component states. Exact revisions
  collapse and conflicting revisions are quarantined. It does not store a
  corpus release or snapshot ID; later manifests select it.
- Each governed slot has a stable `result_component_occurrence_id` from
  `(derived_result_occurrence_id, component_key)` and an immutable component
  revision hashing that occurrence ID, parent result revision, exact input
  revision IDs, component state and canonical component value. The result keeps provision,
  component, claim-revision, relationship-revision and evidence references. It
  has no fabricated source span and owns no copied source facts.
- Any expected component that is `FAILED` or `NOT_EXAMINED` blocks publication,
  whether the ResultDefinition labels it required or optional, unless its exact
  occurrence was excluded in the frozen scope manifest before extraction.
  “Optional” governs which valid terminal states complete the legal answer; it
  never permits skipped examination. The component remains visible to review
  and certification tooling.
- Each result component also declares its accepted terminal states and how each
  state affects the result. `ABSENT` may be a complete answer for a
  knowledge-qualifier component but not an acceptable substitute for a required
  bring-down. `NOT_APPLICABLE` is complete only where that component definition
  permits it.
- A result may combine the contract-bounded number of provisions and spans its
  definition permits. For example, one
  representation result may combine the signing representation, a separate
  closing-condition bring-down and an inline definition. Each displayed fact
  still opens its own source evidence.
- A DealSnapshot selects exactly one revision for every selected assessment,
  claim, relationship, derived-result and result-component occurrence.
  Unresolved multiplicity or an endpoint revision outside that same snapshot
  blocks certification.

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
- The only database entry point with canonical-object-table DML authority is the
  versioned `canonical_write` `SECURITY DEFINER` PostgreSQL RPC. Its generated
  operation schema permits `DEAL_RUN` and `CERTIFIED_RELEASE_IMPORT_BATCH` only.
  All canonical tables deny direct `INSERT`, `UPDATE` and `DELETE` to
  application, migration, release-builder, serving and importer roles. Facts are
  append-only; correction and supersession append new governed objects.
- Projection workers may write only generated serving and compatibility sinks.
  The Phase 9 activation and rollback RPCs may write only release-control and
  append-only event tables. None can write or transform canonical objects.
- Exact SourceContent and CanonicalTextContent payloads are uploaded first to a
  content-addressed, non-serving object namespace where overwrite and mutable
  generations are denied. A trusted verifier streams and hashes the stored bytes
  before creating an environment-local `BlobAvailabilityReceipt` for exact
  namespace, object generation, length and digest in state `AVAILABLE`.
  `canonical_write` locks that receipt and admits the reference in the same
  transaction only when receipt, envelope and immutable generation agree.
- A sole garbage-collection role locks the same receipt, proves zero canonical
  references, changes it to `TOMBSTONED`, commits, waits the governed grace
  period and only then deletes that exact generation. A writer's lock therefore
  wins before the reference or makes collection observe it. Replacement is
  always denied. A failed transaction may leave an unreachable deduplicated
  blob, never a canonical reference or visible source. Availability receipts
  are operational evidence and do not enter cross-environment semantic IDs.
- Canonical v2 uses new append-only tables without the legacy cardinality
  constraints. `provisions`, `provision_cards` and their feature JSON are lossy,
  compatibility projections from the canonical system's perspective. They are
  excluded from canonical closure and certification and cannot be a writer input
  or source of truth.
- A versioned `LegacyRelationManifest` classifies every pre-v2 relation as
  `MIGRATION_SOURCE`, `PROVENANCE_ONLY`, `COMPATIBILITY_SINK` or `RETIRED`.
  Before migration, an immutable content-addressed `LegacyMigrationSnapshot`
  freezes the exact source rows and checksums. Its ID hashes ordered relation
  schema fingerprints and `(relation, stable_row_key, row_payload_digest)`
  entries. Only an isolated migration role may read that snapshot, and it is
  disabled after certification. Live legacy relations designated as
  compatibility sinks are writeable only by the outbox projection role.
  Canonical writer, release-builder and serving roles are
  denied semantic reads from migration sources and DML against compatibility
  sinks. Compatibility-worker failure is visible and retryable but cannot roll
  back or alter canonical facts.
- `canonical_write(operation=DEAL_RUN)` accepts one schema-valid deal envelope,
  expected base snapshot and idempotency key in one `SERIALIZABLE` transaction.
  It locks the governed deal key, validates expected prior state
  and writes the complete source, semantic, revision, evidence, relationship,
  correction and manifest unit atomically. Sequential Supabase `.from()` calls
  cannot satisfy this contract. Failure at any injection point leaves zero
  partial canonical rows and no snapshot or release membership change.
- The RPC records an immutable writer-attempt envelope, then performs canonical
  writes inside a caught PostgreSQL subtransaction. Success writes one receipt
  and outbox event in the outer transaction. A caught validation or constraint
  failure rolls back every canonical write but commits one correlated failure
  receipt and failure outbox event. A transport failure before the database
  accepts the RPC is operational and cannot claim a canonical audit. A missing
  terminal receipt is quarantined and alerted, never interpreted as success.
- Exact idempotent replay returns the original terminal receipt without new
  rows. Reuse of an idempotency key with a different canonical request digest
  fails closed. `CERTIFIED_RELEASE_IMPORT_BATCH` uses the same RPC and insertion
  constraints, but may only copy checksum-verified immutable objects named by
  an authorised release bundle into an inactive namespace. It cannot derive,
  normalise, correct, supersede or select an active release.
- Corrections carry a `correction_slot_key`, governed target type and exact
  target ID and exact expected prior revision or immutable object digest. Each
  `CorrectionSlotDefinition` governs permitted target types, patch schema,
  allowed prior and output states and one effect:
  `CREATE_REVISION`, `SUPERSEDE_OCCURRENCE`, `RETIRE_OCCURRENCE` or
  `ADD_COEXISTING_OCCURRENCE`. A classification correction either supersedes a
  specified immutable ProvisionInstance, retires it or adds a coexisting object
  through a specified `SourceClassificationSlot`.
  Anchor-only replacement is prohibited because one anchor may support several
  semantic objects. A component correction supersedes the exact immutable
  component occurrence and expected object digest. Scope, claim and relationship
  corrections target their exact occurrence and prior revision IDs.
- A correction ID is the content hash of its governed target tuple, expected
  prior revision or object digest, canonical patch payload, correction-rule
  version, correction-slot key and ordered
  set of superseded correction IDs. Reviewer, execution and timestamp data
  remain provenance rather than identity inputs. Exact duplicates collapse;
  conflicting corrections against one expected prior state are quarantined.
- Before extraction, every active correction resolves through an ordered,
  reviewed migration chain to exactly one permitted current target. Zero or
  multiple targets block the family. `correction_application_id` hashes
  correction ID, correction-slot key, resolved occurrence ID, expected prior
  revision or object digest, migration-chain digest and application-rule
  version. Corrected revisions contain ordered CorrectionApplication IDs, and
  a superseding immutable occurrence records the application that created it.
- The correction-set digest hashes the ordered active correction IDs and their
  resolved CorrectionApplication IDs. A migration-map or resolution change
  therefore invalidates every affected family even when patch text is
  unchanged.
- Before rebuilding, a legacy-correction disposition manifest enumerates every
  existing correction row. Each row receives exactly one of
  `EXACTLY_MIGRATED`, `MANUALLY_RECREATED`, `DUPLICATE_OF`, `SUPERSEDED_BY`,
  `INVALID_REJECTED` or `UNMAPPABLE_BLOCKING`, with evidence, destination IDs
  where applicable and Ben disposition. `UNMAPPABLE_BLOCKING` blocks release.
  No legacy row may be carried forward by fuzzy text, current UUID resemblance
  or best effort.
- The canonical contract generates an acyclic ownership and dependency graph
  rooted in SourceContent and canonical-text occurrences, source and deal
  admission manifests, structural and classification outputs, scope slices,
  the contract fingerprint, CorrectionApplications and prerequisite family
  sets. It continues through ClaimRevisions, RelationshipRevisions,
  DerivedResultRevisions, normalisations, observations, aggregates and
  projections. Each materialised object stores its ordered direct input
  occurrence, revision and manifest IDs and dependency digest. Contract
  compilation rejects any extractor, normaliser, resolver, composer or
  projector read that is not a declared dependency edge.
  Any changed input invalidates every transitive dependent. Carry-forward is
  permitted only when both contract fingerprint and complete dependency-input
  digest are identical; referential closure alone is insufficient.
- Semantic relationships may be reciprocal or otherwise cyclic. They are data,
  not build-dependency edges. A relationship is built only after every permitted
  endpoint type exists, and a cross-family result belongs to a declared result
  family whose prerequisite closure includes every contributing family.
- Each extraction writes immutable objects under an `extraction_run_id`. A
  complete `DealSnapshot` manifest selects the DealIdentityManifest,
  DealAdmissionManifest, canonical text, contract version and one closed object
  set for every required family in that deal. A per-family reprocess creates a
  new complete snapshot by referencing certified unchanged family sets and the
  new family set; it never produces a partial deal view.
  Each family set carries its contract fingerprint. Carry-forward is permitted
  only when that fingerprint and dependency digest are certified identical;
  otherwise the family and all transitive dependants are rematerialised.
  Closure and freshness validation prove that every selected deal and source
  admission manifest, span, excerpt, provision, component, assessment revision,
  ClaimEvidence edge, ClaimRevision, RelationshipEvidence edge,
  RelationshipRevision, result revision, correction and CorrectionApplication
  resolves inside the snapshot and matches its declared inputs.
- Every family set records direct source-admission, deal-admission, scope-slice,
  contract, CorrectionApplication and prerequisite-family-set IDs. Freshness
  certification recomputes the complete transitive input digest rather than
  trusting a stored digest or matching row count.
- A certified family-set ID hashes ordered `canonical_text_id` and
  source-admission-manifest IDs, family key, contract fingerprint,
  deal-admission-manifest ID, scope-slice ID, correction-set digest, ordered
  CorrectionApplication IDs, ordered
  prerequisite family-set IDs, dependency digest and ordered canonical
  occurrence and revision IDs. A `DealSnapshot` ID hashes governed deal key,
  deal-identity-manifest ID, deal-admission-manifest ID, ordered source-admission
  manifests, contract version and ordered certified family-set IDs.
  Extraction-run and allocated database IDs remain provenance outside identity.
  Exact semantic reruns therefore reproduce family, result and snapshot IDs.
- `CorpusRelease` is an immutable manifest selecting exactly one certified
  `DealSnapshot` per included deal. Its correction-set reference is audit
  provenance for corrections already materialised into the selected objects,
  never a serving-time overlay or second truth path. This allows active and
  candidate corpora to coexist without copying or partially mutating live
  objects. Its ID is the content hash of the release-contract version, ordered
  governed deal key to `DealSnapshot` mappings, cohort-metadata version and
  correction-set digest and CorpusScopeManifest ID. Labels and build-run IDs
  are provenance, not identity inputs.
- After deterministic structure and a dry-run definitions/mechanism discovery
  pass, but before candidate claim extraction, freeze one immutable
  `CorpusScopeManifest`. The discovery pass writes no corpus facts. It creates
  many-to-many `DiscoveryCoverageEdge`s between admitted structural-leaf
  intervals and governed semantic occurrences or reviewed non-substantive
  dispositions. One occurrence may cross leaves, and one leaf may support
  nested, overlapping or party-specific occurrences. Boundaries from every edge
  form deterministic coverage atoms; each admitted byte belongs to one
  structural leaf and every atom has at least one explained semantic use or one
  non-substantive disposition. Multiple semantic uses do not multiply byte
  coverage. Unexplained gaps, crossings or incompatible dispositions block the
  freeze.
- `discovery_coverage_edge_id` hashes structural-leaf ID, exact intersected
  interval, target type and stable target or disposition ID, governed coverage
  role and source-order ordinal. Contract expansion turns the discovered
  semantic occurrences into expected claim and result slots. An edge cannot be
  manufactured from candidate claim rows.
- The manifest is the authoritative certification universe and contains
  stable-ID inventories for every SourceContent, source and canonical-text
  occurrence, source, deal-identity and deal-admission manifest, governed deal,
  admitted structural leaf, classification slot, coverage edge and disposition,
  required `(deal, family)` unit and scope slice, active correction, discovered
  semantic and component occurrence, expected assessment, claim, relationship,
  result and result-component occurrence, contract object, registry entry,
  route, internal or export job, request and result schema, cache policy, route
  budget, database index, RPC, materialised view, discovered test and approved
  exclusion.
- `corpus_scope_manifest_id` hashes the contract fingerprint, discovery and
  enumerator versions, OperationalPolicySet and CertificationPolicyManifest IDs
  and every complete ordered stable-ID inventory and approved exclusion above.
  For each required `(deal, family)` unit, a
  `scope_slice_id` hashes its schema version, contract fingerprint, governed
  deal key, family key and the exact ordered source, admission, leaf, coverage,
  semantic, expected-slot, active-correction and exclusion IDs relevant to the
  unit. The parent manifest contains the exact unit-to-slice mapping. An
  unrelated route inventory change can therefore change the parent scope and
  release without needlessly changing an identical family slice, while a family
  cannot select or infer a different scope.
- The expectation enumerator reads frozen source structure, reviewed discovery
  output and the contract, never candidate claim rows. The observation
  enumerator reads the completed candidate, built routes, generated schemas and
  collected test IDs, never the expected sets. For each inventory, `U` is the
  independently discovered universe, `X` the pre-approved exclusions and `A`
  the candidate's admitted set. Certification requires `X` to be a subset of
  `U`, `A = U - X`, `A` and `X` to be disjoint, zero duplicate IDs, zero
  unrecognised extras and an exact traceability row for every member of `U`.
  Equal counts cannot satisfy set equality.
- Every exclusion identifies the stable ID, governed reason, evidence and Ben
  approval before candidate extraction. A missing deal or family, omitted
  expected claim, `NOT_EXAMINED`, `FAILED` or newly discovered registry entry
  cannot make completeness pass by disappearing from the candidate. Changing
  scope or an exclusion creates a new manifest ID and invalidates all later
  candidate and certification artefacts.
- All content-addressed IDs and digests above use domain-separated SHA-256 over
  RFC 8785 canonical JSON with the governing schema version inside the payload.
  Object collections sort lexicographically by `(object_type, stable_id)`,
  family collections by `(family_key, family_set_id)`, release mappings by
  `(governed_deal_key, deal_snapshot_id)` and correction sets by
  `correction_id`. Exact duplicate entries collapse before hashing; duplicate
  logical keys with different values are quarantined. Null, absent and empty
  values remain distinct. Database iteration order and allocated row IDs never
  enter these hashes.
- Every named immutable manifest and attestation has an ID calculated over its
  complete normative payload by the same rules. Any field described as
  provenance is stored outside that payload. A manifest may reference only
  earlier identities in the acyclic order below; a digest cannot be filled in
  later or computed from a mutable row projection.
- The required acyclic identity order is: contract and intake receipt;
  SourceContent and source occurrence; CanonicalTextContent and occurrence;
  source admission, deal identity and deal admission; structural and semantic
  spans and excerpts; provision, component and classification-slot occurrences;
  assessment, claim, relationship, derived-result and result-component
  occurrences; discovery coverage; CacheBudget, Capacity and RouteBudget
  manifests; OperationalPolicySet; CertificationPolicyManifest; scope slices;
  CorpusScopeManifest;
  assessment revisions and ClaimEvidence; ClaimRevisions;
  RelationshipEvidence and RelationshipRevisions; derived-result and
  result-component revisions; family sets; deal snapshots; corpus releases;
  observations and aggregates. Each revision selects only earlier IDs.
  CorrectionApplication nodes may interleave only after their exact prior target
  and before the corrected revision or superseding occurrence; every correction
  edge points backwards and a cycle fails compilation. In particular, evidence
  binds to its occurrence before a revision selects it, results select revision
  IDs, and no family or source object includes a downstream release ID.
- `provisions.ai_metadata.features` may exist temporarily as a derived
  compatibility projection. It cannot remain an independently writable truth.
- Re-extraction builds an offline candidate corpus release. It never partially
  mutates the active corpus. Promotion and cutover follow the immutable,
  transactional ceremony in Phase 9.

### 7. Serving projection and one row contract

- A compact `market_observation` projection is indexed first by corpus release,
  governed deal key, concept, metric and party. Its unique identity is
  `(release_id, governed_deal_key, concept_key, metric_key, party_role,
  party_value, result_key,
  result_version, owner_type, owner_id, scope_type, scope_id, value_ordinal)`.
  `owner_type` is `CLAIM_REVISION` or `RESULT_COMPONENT_REVISION`, and its
  matching immutable revision ID is always non-null. `scope_type` identifies a
  `ProvisionInstance`, `ProvisionComponent`, `ScopeAssessmentOccurrence` or
  result-component occurrence, and its matching ID is always non-null.
- An allocated database `deal_id` may remain a foreign key and provenance field.
  It is not part of observation identity, bundle checksums or cross-environment
  parity.
- Each observation derives a `scope_interval_set_key` from the ordered,
  deduplicated half-open evidence or examined-scope intervals of its owner. This
  works for multi-span results and assessment revisions without inventing one
  anchor. `MetricDefinition` governs value ordering; its default stable order is
  interval-set key, owner type and ID, canonical serialisation and raw-value
  hash. An owner with no interval set requires an explicit governed ordering
  rule or is quarantined. Exact duplicate observations collapse before
  numbering, unexplained collisions are quarantined, and `value_ordinal` is
  assigned from zero in that order.
- Every observation carries state. Raw and normalised observations remain
  linked to ClaimRevision and evidence IDs, units, denominators and
  derivation versions. Serving never reconstructs provenance through a runtime
  text-hash join.
- Every `MetricDefinition` fixes its observation unit, permitted multiplicity,
  per-deal roll-up, weighting and compatible cohort strata. Aggregates report
  both subject count and distinct-deal count. A deal contributes once to a
  deal-weighted distribution; a subject-weighted distribution is permitted only
  when the metric expressly defines and labels it. Multiple values from one
  deal can never enter a distribution through accidental row multiplicity.
- Each metric also declares value dimension, raw schema and units, canonical
  unit, exact numeric representation, basis schema, conversion rule and version,
  display rounding, eligibility, denominator, exclusion taxonomy and aggregate
  algorithm. Identity, filtering and aggregation use integers, rational values
  or governed decimal strings, never binary floating point or display-rounded
  values. Different dimensions or unresolved bases cannot share a statistic.
- Money retains raw amount and currency. A deal-relative percentage requires a
  governed equity, enterprise or transaction-value denominator, denominator
  currency, source lineage and version. Currency conversion requires an exact
  versioned FX source and date. Missing, conflicting, non-positive or
  unconvertible denominators remain visible exclusions and never become zero.
- Duration retains magnitude, raw unit, basis, range bounds, inclusivity, start
  and end legal events, timezone, counting rule, calendar and derivation
  version where applicable. Seconds, minutes, hours and elapsed days convert
  exactly through seconds. Twenty-four elapsed hours equals one elapsed day.
  Business days remain business days unless exact anchored dates, a versioned
  business calendar and counting rule produce a separate derived elapsed value.
  Calendar days bridge to elapsed days only when anchor, timezone and
  inclusivity are resolved. Months and years do not convert to days without
  exact date anchors. “Promptly” and similar formulations remain categorical.
- Published market statistics are a census of the eligible active-release
  cohort. Random or stratified samples are permitted only for QA and load tests,
  with release, cohort hash, algorithm, seed and size recorded. A sample can
  never populate a result or cache labelled as a complete market statistic.
- Common aggregates are materialised. Arbitrary refined cohorts use one
  indexed, set-based SQL/RPC and a release-aware cache. A request never loads
  broad cards and claims into Node or makes corpus-proportional database calls.
- A compact release-keyed `result_serving_row` projection materialises each
  result's bounded inline slots, state counts, source-action references and
  refinable dimensions. Repeatable overflow slots use a separately indexed
  child projection keyed by release, result occurrence, component key and
  stable child cursor. The one serving RPC joins these projections set-wise;
  neither initial rows nor child pages perform per-component queries.
- Every result row, child row, market observation and aggregate has a canonical
  payload digest covering state, raw and canonical values, party, component and
  evidence references, cohort and denominator counts, refinable dimensions and
  derivation lineage. Release manifests inventory ordered
  `(serving_key, canonical_payload_digest)` pairs, never keys or counts alone.
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

- Numeric query-shape, payload, cursor and export values in this section are
  CanonicalContractBundle protocol bounds. Latency values are
  CertificationPolicyManifest pass thresholds. Exact deployed route, cache and
  capacity settings exist only in their three disjoint operational manifests
  and may be stricter, never looser, than a protocol bound.
- Natural-language prompts, the manual builder, saved queries and in-product
  launch actions compile to one versioned `QueryPlan`. They never address raw
  feature aliases or choose arbitrary cards. The plan contains corpus release,
  result and metric keys, component scope, party and legal context, cohort
  filters, selected dimensions, predicates, groupings, sort, cursor and page
  size. Ambiguity produces a refinement request, not an invented field.
- The predicate AST distinguishes the quantified universe from the predicate
  target. A selector returns typed deal, result, provision, component or claim
  occurrences; predicates may address that occurrence or a governed linked
  component. `STATE_IS` and `STATE_IN` operate on exact revision states,
  separately from scalar predicates. This makes “a present Capitalisation result
  whose knowledge-qualifier component is `ABSENT`” expressible without implying
  that the representation itself is absent.
- The AST supports scoped `EXISTS`, `NONE`, non-vacuous `ALL`, `NOT`, `AND` and
  `OR`, and declares whether operands attach to the same result, component,
  provision or deal. The plan also declares an `ELIGIBLE` or `APPLICABLE`
  universe. `NOT_APPLICABLE` is excluded from an applicable universe but remains
  queryable in an eligible universe. The scalar-member domain contains only
  compatible, canonically normalised `PRESENT` revisions. A certified `ABSENT`
  state contributes a complete empty scalar domain. `FAILED`, `NOT_EXAMINED`
  and present-but-unnormalisable or incompatible values make scalar-domain
  completeness unknown. Scalar operators never coerce another state to null,
  false or zero. `NOT` changes truth only for admitted scalar members; it cannot
  widen that domain and turn absence or failed examination into a value.
- Predicates over admitted members evaluate `TRUE`, `FALSE` or `UNKNOWN`. `NOT`
  maps true to false, false to true and unknown to unknown. `AND` and `OR` use
  strong Kleene logic. Each quantifier also receives an independent
  domain-completeness bit that `NOT` cannot change. `EXISTS` is true if any
  admitted member is true; it is false only when the domain is complete and no
  member is true or unknown; otherwise it is unknown. `NONE` is false if any
  member is true; it is true only when the domain is complete and no member is
  true or unknown; otherwise it is unknown. Non-vacuous `ALL` is false if any
  member is false or if the domain is complete and empty; it is true only for a
  complete, non-empty domain with no false or unknown member; otherwise it is
  unknown. Thus failed-only gives three unknowns, true-plus-failed gives
  `EXISTS=true`, `NONE=false`, `ALL=unknown`, false-plus-failed gives
  `unknown`, `unknown`, `false`, and certified absent-only gives `false`, `true`,
  `false`. If an `APPLICABLE` selector has a non-empty eligible set but
  every subject is `NOT_APPLICABLE`, the containing evaluation has status
  `NOT_APPLICABLE` and no Boolean result; this is not a fourth predicate truth
  value and cannot become vacuous `NONE=true`. A missing expected component has
  status `CONTRACT_ERROR`, not false. Only `BOOLEAN` evaluations participate in
  filtering. Every state, domain status and nested-Boolean branch is pinned by
  executable SQL goldens.
- Party-aware facets include Buyer, Seller and Either where appropriate, with
  the selected legal role explicit in both plan and output.
- Compilation validates the generated request schema and produces the complete
  plan without running the query. Each user action then executes that plan once
  and uses the returned result. Launchers, result pages, saved-query validation
  and redirects cannot execute and discard a duplicate corpus query.
- Generated schemas enforce maximum AST depth 6, 32 Boolean nodes, 16 branches
  in one `OR`, 20 predicates, 16 cohort filters, 100 values per `IN`, 30 selected
  columns, three groupings, ten facets, three sort keys, 2,048 bytes per literal
  and 64 KiB per normalised plan. Only governed indexed operator, metric, cohort
  and grouping combinations compile. An increase is a contract change requiring
  load recertification. An unsupported or over-budget plan returns typed
  `QUERY_TOO_COMPLEX` with refinements and zero corpus calls; it is never
  truncated or sent to the database for best effort. The serving RPC enforces
  the same limits independently of the compiler.
- One user action creates one `query_execution_id` and idempotency key. It makes
  at most one serving RPC. Navigation carries the validated response or fetches
  that immutable execution result by exact ID. Launcher validation, saved-query
  validation, redirects and result mounting cannot execute the plan again.
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
  denominator counts, selected quantifier universe and cardinality, all five
  state counts, excluded and unknown counts with reasons, source-deal references
  and provenance. CSV and other exports derive from that result contract.
- The server validates the result schema before cache insertion or response; an
  invalid result fails closed and enters operational quarantine rather than
  reaching a renderer. Clients use generated types, reject incompatible
  contract versions and do not guess missing fields. Contract tests cover every
  query intent, “What's market?”, evidence details, facets and exports.
- All failures use one versioned error envelope carrying contract version,
  stable code, HTTP status, category, request ID, resolved release where
  available, retryable flag, retry-after and safe user message. Request errors
  are 400, authentication and authorisation 401 or 403, expired cursors 410,
  unsupported or complex plans 422, admission 429, controller or circuit
  unavailability 503 and deadline expiry 504. An operational failure can
  never render as empty data, `ABSENT` or “No market data”. Serving routes do not
  retry a database operation. Interactive clients perform zero automatic
  retries. Idempotent background or export work may retry at most twice only
  when the envelope permits it, after the greater of retry-after and one second,
  with exponential full jitter, fresh admission and the same idempotency key.
  Mutations never retry automatically, and every retry consumes route budget.
- Canonical `FAILED` is an extraction state inside a valid result. It is never an
  operational error. Conversely, an operational failure never creates or
  substitutes any canonical state, denominator or fallback corpus result.
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
  hash, authorisation-scope digest, contract and signing-key versions, expiry,
  collation, explicit null ordering, complete sort tuple and final governed deal
  or observation ID. Cursors expire after 15 minutes. The default page is 50 and
  hard maximum 200 rows. Aggregate and facet counts cover the full cohort.
  Refining resets the cursor; sorting or paging cancels stale work and never
  materialises a cohort-wide deal-ID list in the browser.
- Issuing a cursor pins its release, result contract and access-policy generation
  until cursor expiry. A running export pins the same inputs until its governed
  deadline. Release retention cannot expire either reference early.
- The current and immediately prior cursor signing keys may overlap only for the
  cursor lifetime. Tampering, expiry, retired key or release, plan, contract,
  authorisation, collation or sort mismatch returns a typed cursor error and
  never silently restarts at page one.
- Initial JSON is capped at 1 MB uncompressed. Full agreement text and extended
  evidence load only by exact evidence ID from a source action. Full-query CSV
  and other exports execute server-side over a cursor stream or bounded
  asynchronous job; they never export only page one or require the browser to
  hydrate the full result. An export is capped at 25,000 rows, 100 MB
  uncompressed, 500-row chunks and ten minutes, with at most two concurrent
  export jobs fleet-wide and backpressure between chunks.
- The authoritative cache is shared across application instances. A process
  cache may exist only as a bounded L1 behind the same release, contract,
  authorisation and revocation checks. The shared fill leader publishes the
  schema-validated value before releasing its fenced lease; waiters read that
  shared value. A dead leader's expired lease and any stale fence can neither
  publish nor trigger sequential instance-by-instance fills.
- The cache key includes release ID, normalised plan hash and authorisation
  scope, plus page cursor where relevant. Before deployment, one
  `CacheBudgetManifest` fixes numeric value TTL, maximum key bytes, entries and
  bytes per release and authorisation class, fleet-wide maximum entries and
  bytes, maximum simultaneously cached release generations, per-scope fill
  quotas and fill rate, eviction policy, rollback retention and pinned-release
  retention. Eviction must preserve values required by unexpired cursors,
  running exports and the certified rollback window. Keys also include
  result-contract and access-policy generations;
  revocation is checked before a cached value is served. Unset limits fail
  startup. Empty results are cacheable. Errors, partial responses and
  schema-invalid results are not. A common aggregate hit performs zero serving
  database work.
- Shared cache, single-flight, admission and circuit state live in an external atomic
  control plane that does not use the constrained Supabase pool it protects.
  Admission and fill leases have TTLs and fencing tokens. Circuit definitions
  govern closed, open and half-open transitions, one-probe recovery and retry
  suppression. One versioned `CapacityManifest` fixes numeric global and
  per-class admission caps, queue bounds and deadlines, admission and fill-lease
  TTLs,
  failure window and threshold, open cooldown, half-open probe permits and
  connection reserve. Unset values fail startup; any change requires load
  recertification. If the control plane is unavailable, every database-using
  route and job fails closed before connection checkout. The sole exception is
  an authenticated one-shot rollback RPC through independently reserved
  database capacity that performs no corpus read. Per-process semaphores remain
  defence in depth only.
- Staging performance budgets are binding release gates: cached common-query
  API p95 at or below 500 ms, uncached refined-query API p95 at or below
  1.5 seconds, p99 at or below 2.5 seconds, and a usable first browser result at
  or below 2 seconds under the certified traffic profile. Query-plan CI rejects
  sequential scans of broad claim/card payloads, N+1 calls, unbounded responses
  and regressions beyond those budgets.
- Route call budgets are exact: one serving RPC for an ad hoc initial page,
  refinement, sort, result-child page or list page; one saved-plan lookup plus
  one serving RPC for a saved query; one exact-ID bounded query for an evidence
  detail; and one indexed bounded query for facet or field-value options. Evidence detail is
  capped at 20 IDs and 512 KB; option output is capped at 200 values and 256 KB.
  Query compilation performs no corpus read and may make at most one bounded
  catalogue lookup. Authentication is separately declared fixed overhead.
- Every active query and support route or job appears in the governed route
  `RouteBudgetManifest` with maximum database calls, rows and bytes returned, response
  or job deadline, admission class and cache policy. Export is the only path
  permitted multiple cursor calls, and its per-chunk budget and fleet-wide job
  cap above remain subject to shared admission control. Instrumented tests fail
  when any route exceeds its manifest.

## Tooth-to-tail execution path

This is the complete path from a received agreement to one published answer.
No stage may bypass validation or write a plausible replacement for a failed
earlier stage.

1. **Admit and freeze the source.** Record the immutable source receipt and raw
   disposition, generate canonical text through the pinned converter, preserve
   the occurrence-to-content map and certify the SourceAdmissionManifest. A
   legacy derived source is labelled and resolved, never silently promoted.
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
   set, creates the stable ClaimOccurrence and emits one immutable ClaimRevision
   in exactly one of the five states. Applicability is an outcome,
   not a pre-filter that permits omission. Raw wording and value, canonical
   value, scope and party travel together with exact evidence or examined-scope
   proof, as the emitted state requires.
6. **Link, do not flatten.** Create reviewed typed relationships among
   provisions, definitions, exceptions, conditions and remedies. Multi-span
   claims cite each contributing span. Cross-provision results keep component
   identities rather than copying their facts into one feature bag.
7. **Validate and quarantine.** Reproduce every quote from stored offsets,
   check concept, party, codebook, type, unit, scope, relationship and expected
   claim completeness and dependency freshness. Retain every unknown or invalid
   observation as a residual. Any unresolved residual, `FAILED` or
   `NOT_EXAMINED` expected slot blocks publication unless the frozen scope
   manifest contains an approved prior exclusion.
8. **Write once, transactionally.** Every semantic entry point submits one
   complete `DEAL_RUN` envelope to `canonical_write`. Its caught PostgreSQL subtransaction
   writes the canonical unit or rolls it all back while the outer transaction
   writes one correlated outcome receipt and outbox event. No application
   sequence of table calls can substitute for it.
9. **Compose lawyer-facing results.** A versioned `ResultDefinition` selects
   and orders exact claim and relationship revisions. It produces an immutable
   result revision and the shared row contract. The result has no invented
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

### Interim operating covenant

- The affirmative ordinary-course obligation, each enumerated negative
  restriction and any reciprocal Buyer covenant are separate party-specific
  ProvisionInstances. The lawyer-facing IOC result composes them; a section or
  table row is not itself the canonical provision identity.
- Each restricted act has governed components for action, object, threshold,
  cadence, efforts or materiality standard and exact exceptions. Per-item and
  aggregate thresholds remain distinct. A threshold inside one exception never
  becomes a cap or qualifier on the entire covenant.
- Disclosure-schedule, agreement-required, law, ordinary-course, budget and
  Buyer-consent treatments are separate components or relationships. Buyer
  consent is an override mechanism, not evidence that the prohibition is absent.
  Every exception relationship declares legal effect, target components,
  conditionality and precedence.
- Nested exceptions and inline definitions retain their own spans and evidence.
  A single IOC answer may therefore combine the chapeau, one enumerated act, a
  distant consent standard and a nested definition without copying any fact.
- Dollar thresholds retain raw amount and publish the governed deal-relative
  percentage. Market output compares the same act, party, threshold basis,
  cadence and exception effect. Presence prevalence is only secondary context.
- Golden fixtures must cover an operative threshold versus an exception
  threshold, per-item versus aggregate caps, an ordinary-course qualifier,
  Buyer-consent override, nested exceptions and two applicable observations in
  one deal. Reordering inputs cannot change result identity or deal weighting.

## Isolated programme environment

- The dedicated integration branch and worktree are established at
  `codex/canonical-corpus-v2` and `precedent-machine-canonical-v2`. This is an
  integration worktree of the existing repository, not a second repository or
  permanent fork.
- Isolation follows the gate registry. After the three security-disposition
  gates pass, create an empty separate Supabase staging project and a Vercel
  branch preview in `deal-corpus`, using staging-only credentials. Configure and
  verify Supabase network restrictions, least-privilege grants and RLS, fail-closed
  service-client configuration, default-deny application middleware and Vercel
  Deployment Protection or equivalent team-only access before restoring any
  production snapshot or connecting a data-bearing preview.
- Before restore, the complete preview route and action inventory is tested as
  both unauthenticated and authenticated non-admin identities. Every request
  denies by default. Until `P9_SECURITY_AUTH` passes, all externally reachable
  writer, ingest, correction, user or role, source export, import, promotion and
  cutover actions remain hard-disabled at middleware and database grants even
  for a team-authenticated preview user. A temporary explicit allowlist may open
  only read actions to Ben and named reviewers. Ben's local staging writer uses
  a short-lived non-web credential and has no preview route. Credential
  isolation alone does not satisfy access isolation. No production credential
  or browser-visible service credential is permitted.
- The restore procedure excludes or replaces production auth sessions, API and
  webhook secrets, scheduled jobs, outbound integrations, replication targets
  and production user invitations before any application connection is enabled.
  Egress is deny-by-default until a non-production destination is explicitly
  certified. Snapshot encryption, retention and destruction are recorded
  without placing secret material in certification evidence.
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
- One database-resident canonical release-state record controls both active
  release and exposure. Slice flags cannot expose candidate data independently.
  An application or deployment kill switch may only disable access. Phase 9's
  serialisable RPC changes pointer and exposure together and rolls them back
  together.
- After staging certification, the candidate is exported as a content-addressed
  release bundle with its CandidateReleaseManifest, DeploymentManifest,
  PreCutoverCertification and object checksums. Ben runs
  a dry-run-first canonical release importer locally to populate an inactive
  production release namespace, then verifies exact stable-ID set equality and
  checksums against staging. This promotion import is the only canonical corpus write to
  production before cutover; it performs no extraction, backfill, replay or
  mutation of the active release.
- Bundle payloads are copied first into an inactive content-addressed production
  object namespace and verified byte-for-byte into BlobAvailabilityReceipts.
  The database import locks and may reference only those exact available
  generations. Partial or orphaned uploads remain unreachable, cannot alter an
  existing digest and do not move release state.
- The importer is a governed `IMPORT` job that calls only
  `canonical_write(operation=CERTIFIED_RELEASE_IMPORT_BATCH)`. At most one runs
  fleet-wide, with one in-flight write RPC, batches capped at 500 objects and 5 MiB and a 30-second
  statement timeout. Each batch atomically writes its checkpoint under
  `(bundle_digest, batch_ordinal)`. Exact replay is a no-op; conflicting replay,
  mixed release IDs or checksum mismatch fails closed. A killed job resumes from
  the last checkpoint without duplication or pointer movement. It uses a
  reserved admission class and must pass concurrent-import soak testing or run
  only in a certified Ben-approved maintenance window.

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

The same emergency containment class now covers every active corpus-proportional
route discovered by the route enumerator. At minimum, `/api/query/run`,
`/api/query/interpret`, `/api/query/field-options`, `/api/saved-queries` and
`/api/compare/features`, `/api/compare/rep-materiality`, `/api/corpus-stats`,
`/api/corpus-stats-batch`, unscoped `/api/provisions` and
`/api/schema-coverage` are hard-closed or replaced by an authenticated,
externally admitted path with fixed database-call, row and byte ceilings proven
live across multiple instances. Process-local caching or inflight deduplication
does not pass. `/api/users` and any unauthenticated service-client mutation are
also closed pending the action-level authorisation contract. Each newly
discovered broad or unauthorised route enters this gate automatically. No
post-containment Phase 0 work starts until the inventory, code tests and live
responses close `G0_BROAD_CORPUS_ROUTES_CONTAINED`.

A contained route returns the typed `ROUTE_CONTAINED` envelope and performs zero
corpus reads. The named routes are a floor, not an allowlist. Static source and
built-route discovery plus instrumented cold execution must agree on the full
route-action set. No contained route reopens with a broad-card, broad-claim or
broad-provision Node fallback.

Security containment remains an explicit runbook gate: identify and record the
owner and purpose of the Zayo process responsible for the traffic. If it is not
recognised, Ben rotates the Supabase service secret immediately. The exposed
Claude credentials are treated as compromised and rotated regardless. No agent
inspects, reads or prints Keychain contents, and no secret value enters an
artefact, prompt or log. The repository currently contains no non-secret
completion record for the Zayo disposition or these rotations, so they remain
outstanding blockers rather than assumed complete. No post-containment Phase 0
work, canonical implementation or canonical data work starts until that
non-secret evidence is recorded. While those security gates are open, only
specification review, emergency containment and, after its own registry gates
pass, bounded implementation planning are permitted. Planning does not
authorise code, infrastructure or data work.

After `canonical_work_start` is `PASS`, produce the factual baseline and
comparability matrix. Every rendered row records concept, party, source,
attributes, shape, state semantics, normaliser
owner, comparison dimensions, UI consumers, representative deals and whether
each fact was extracted, inferred, corrected or recovered. Freeze the registry
snapshot digest and classify every entry it contains, including the currently
observed 704 and any subsequently discovered entry. Literal counts never define
the universe. The Phase 0 inventory of existing normalisers seeds the work.

### Phase 1: One governed canonical contract

Create the single `CanonicalContractBundle` authority defined in Section 0.
It governs `ProvisionConcept`, `ClaimDefinition`, `RelationshipDefinition`,
`ResultDefinition`, `MetricDefinition`, `CorrectionSlotDefinition`, source
admission, state rules, dependencies, QueryPlan and row contracts. Compile it
twice and require byte-identical outputs and fingerprint.

Classify every existing registry-like artefact as migration input, generated
compatibility output or retired. Migrate approved content into the bundle and
give every legacy entry a terminal disposition. No current hand registry remains
a canonical write gate or reverse-sync target. Direct edits to generated
registries, schemas, types, UI catalogues or database constraints fail CI with a
deterministic drift diff. The Freeze Gate controls bundle changes; Ben decides
taxonomy and codebooks after Fable or Claude 5.6 Sonnet review.

### Phase 2: Immutable source, spans, identity and lineage

Implement SourceContent, source and canonical-text occurrences,
SourceAdmissionManifest, DealIdentityManifest, DealAdmissionManifest, half-open
structural and semantic spans, excerpts, source anchors, provision instances,
components, discovery coverage and scope manifests, assessment, claim and
relationship occurrences and revisions, ClaimEvidence and RelationshipEvidence.
Replace the provisions-to-cards `spanHash` join with
explicit occurrence and revision lineage. Pin every algorithm, serialisation and
ordering rule. Fuzzy rematching is prohibited.

Exact reruns reproduce occurrence and revision IDs. A changed source receipt or
converter occurrence remains separately traceable even when canonical content
matches. A changed claim state, value, scope, evidence, correction or derivation
preserves its logical occurrence ID but must create a different ClaimRevision
and every dependent result, family, snapshot and release ID. Conflicting shadow
revisions are reconciled before certification, never treated as harmless
identity stability. Tests cover legacy source admission, one-byte boundary
changes, anchor migration, concept and party supersession, nested definitions,
multi-span evidence, assessment coverage, invalid crossing overlaps and
reciprocal party obligations.

### Phase 3: Definitions-first classification and typed extraction

Implement the execution path in order: definitions, legal mechanisms and
parties, expected typed claims, explicit states, relationships, validation and
quarantine. Enable residual capture. Unknown attributes, invalid taxonomy
codes, missing required claims and evidence failures remain visible and block
publication rather than being skipped or rendered plausibly.

Repair concept-aware deduplication, absolute quote offsets, party values at
write time, per-family reprocessing and contract-declared cross-family builds.
Fuzzy matches
may populate a review queue but cannot write canonical edges or move claims.
Bring-downs, exceptions, definitions, triggers and remedies become typed
relationships with exact legal effect. The compiled dependency DAG owns every
cross-family read and invalidates transitive dependants on any revision change.
Existing WP-R3, WP-R4, WP-R6, WP-R7 and WP-R8 work folds here.
Extend the existing evaluation harness with golden cases for every family,
including the QXO representation and no-shop examples above.

### Phase 4: Raw and canonical observations

Store raw and normalised observations together. Each observation carries unit,
day basis, denominator, derivation version and source lineage. Its full lineage
includes release, deal, result, concept, metric, party role and value, legal
trigger or context, exact claim and result revision IDs, evidence IDs,
canonical-text occurrence and offsets.
Normalisation occurs only after those semantic dimensions are resolved. A raw
alias such as `noticePeriod` or `matchingPeriod` never defines a cohort. QXO's
inbound notice, superior-proposal initial match and intervening-event period are
separate metrics even when legacy fields share a name or number.

Money observations retain exact source amount and currency but publish a
deal-relative
percentage as the primary comparable value, with an explicit equity,
enterprise or transaction-value denominator, currency and version. If currency
conversion is required, the metric pins the FX source and date. If no valid
denominator exists,
the raw amount remains visible and the percentage observation is excluded with
a reason: missing, non-positive, unknown or conflicting denominator basis. It
never becomes zero, borrows another basis or enters percentage statistics.
Percentage cohorts contain only identical denominator-basis strata and report
excluded counts and reasons.

Duration observations retain magnitude, unit, range, inclusivity, legal event
anchors, timezone, counting rule, calendar and basis. Conversion occurs only
inside an already-bound semantic metric: 24 elapsed hours is one elapsed day,
never one business day. Calendar or business days enter an elapsed stratum only
through the exact governed anchor and calendar rules in Section 7. Months and
years never become a fixed number of days without exact dates. Unknown basis is
unresolved; qualitative clocks remain categorical. No stratum is dropped and
every exclusion remains visible.

Each metric fixes whether the statistical unit is deal, provision, claim or
result component and how multiple values within one deal roll up. Published
statistics report both subject and distinct-deal denominators and never apply an
implicit first, minimum, maximum or majority rule.

Versioned normalisers belong to the claim or metric contract. Existing
table-config reconstruction moves into extraction or governed normalisers as each
data gap closes. Every temporary compatibility recovery emits a named counter;
the counter reaches zero before removal. The governed query-time derivation
pattern remains valid only when it emits typed value, basis, reason and lineage,
not a bare null. Party is identity, not a normaliser: missing or conflicting
party blocks publication and comparison rather than triggering text inference.

### Phase 5: One writer, corrections and candidate releases

Make every ingest, full extraction, per-family reprocess and correction flow
call `canonical_write(operation=DEAL_RUN)`. Application
roles have no direct canonical-object-table write grant. Validate the complete envelope,
expected base snapshot, idempotency key, revision closure and dependency
freshness before the snapshot becomes visible. Fault injection after every
write step must leave zero partial canonical rows and one correlated terminal
writer receipt. Compatibility projections, including
`provisions.ai_metadata.features`, are asynchronous one-way outbox sinks.

Disposition every legacy correction before rebuilding, then apply governed
corrections before revision hashing and validation. Every flow emits a complete
closure- and freshness-validated `DealSnapshot`. Per-family work carries
forward immutable family sets only when contract and full dependency-input
digests match; a changed input invalidates every transitive dependant.

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
Section 7: release, governed deal key, concept, metric, party, result key and
version, non-null owner revision ID, non-null scope occurrence ID and
deterministic value ordinal. Materialise common aggregates. Serve arbitrary
refined cohorts through one indexed, set-based SQL/RPC and a release-aware
cache. The number of database calls and rows returned to Node is bounded by
request shape, not corpus size. The database may perform an indexed set
aggregation over the selected cohort, but it may not return broad cards or
claims for application-side calculation.

Complete MKT-1, MKT-2 and MKT-3 on this path: provide source occurrence,
provision, claim/result revision and evidence lineage for every value, resolve
provision codes per row rather than by a section-wide dominant code, and pass
context through direct props rather than a global UI bridge. A legacy card link
is optional compatibility navigation,
never canonical lineage. Cohorts distinguish party role and value, beneficiary,
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

Replace process-local containment as the primary control with the external
atomic single-flight, fleet-wide admission and circuit control plane, plus
statement timeout and request deadline. Declare a fixed
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

Independent enumerators discover source and deal manifests, contract objects,
framework routes and jobs, database RPCs and indexes, test-runner cases and
candidate release objects. Pre-extraction universes require exact bidirectional
stable-ID set equality between independent discovery, the corresponding
CorpusScopeManifest inventory and the traceability matrix. Candidate closure
separately requires: selected revision occurrences exactly equal the expected
scope occurrences; the inactive namespace object set exactly equals the
CandidateReleaseManifest object set; and independently derived serving and
aggregate key-and-payload-digest pairs exactly equal the materialised pairs.
Every mapping is traced. A self-declared inventory, matching count or omitted
failed object cannot pass.

Add the existing eleven invariants to CI and release certification. Recovery
usage may only decrease. Identity drift, silent semantic changes, unrecognised
party tokens, invalid states, missing evidence, unresolved residuals and direct
compatibility writes fail mechanically. Complete the client-auth and security
decision before exposing serving routes. A generated action-level authorisation
matrix governs route and method, action, identity source, permitted role,
ownership or tenant scope, object predicate, CSRF and origin rule, rate and
admission class, database RPC and RLS policy and permitted credential class.
Identity and role are server-derived; caller-supplied user IDs never authorise
access. The default is deny. Admin, source, writer, correction, import,
promotion and cutover actions can never be public. State-changing requests
require approved origin and CSRF protection. Service-client configuration fails
closed and never falls back to an anonymous key; the browser never receives a
service credential. Route-level classification without action and object checks
does not pass `P9_SECURITY_AUTH`.

The following adversarial closure tests are mandatory traceability entries:

- `GATE-01`: absent, stale, malformed or mismatched gate evidence leaves work
  blocked; prose cannot change the result.
- `ID-CLAIM-01`: changing only claim state, value, evidence, scope, derivation or
  correction preserves occurrence ID, changes revision and rekeys every
  dependant through release.
- `ID-SOURCE-01`: distinct receipts or converters producing identical text keep
  distinct source actions and cannot cross-serve evidence.
- `BLOB-ATOMICITY-01`: delete-during-admission, stale availability receipt,
  object replacement and missing production-import payload all fail without a
  canonical reference; a concurrent admitted reference prevents tombstoning.
- `ID-OBJECT-01`: spans, excerpts, evidence, governed deals, family sets,
  snapshots and releases reproduce across databases with different UUIDs and
  insertion order.
- `ID-TOPOLOGY-01`: construction in a fresh database proves every identity and
  manifest reference already has its final digest; a forward reference or
  identity cycle fails before persistence.
- `ADMISSION-01`: every historical source has a terminal admission disposition;
  missing bytes, mapping, converter proof or one admitted leaf blocks release.
- `ASSESSMENT-01`: all five states over one intended scope preserve assessment
  occurrence, create exact revisions and reject an asserted stored scalar
  payload on a non-present claim.
- `WRITER-01`: fault injection after every writer stage leaves zero partial
  canonical rows and one correlated outcome; idempotent replay duplicates none.
- `CORRECTION-01`: every legacy correction is dispositioned, and one shared
  anchor cannot cause an anchor-only correction to alter two semantic objects.
- `DAG-01`: changing a REP revision invalidates its dependent bring-down,
  result, observation and aggregate while leaving unrelated families identical.
- `LEGACY-01`: QXO cleanup, ongoing restrictions, reciprocal obligations and
  bring-down tiers coexist despite legacy uniqueness constraints; poisoning a
  compatibility row changes no canonical output.
- `CONTRACT-01`: direct edits to generated registries fail, and every active key
  resolves once to the CanonicalContractBundle.
- `POLICY-AUTHORITY-01`: duplicate configuration ownership, a value above a
  protocol bound or any OperationalPolicySet mismatch among scope, candidate,
  deployment and certification fails compilation or certification.
- `METRIC-01`: 24 elapsed hours compares with one elapsed day; business days,
  months, ranges and qualitative clocks remain separate unless exact governed
  conversion exists; subject and deal denominators are both correct.
- `QUERY-STATE-01`: executable goldens cover every state, `NOT`, `EXISTS`,
  `NONE`, `ALL`, nested Boolean and same-component versus same-deal scope,
  including absent-only, failed-only, not-applicable-only,
  true-present-plus-failed, false-present-plus-failed, `NOT(scalar)` and
  “Capitalisation rep has no knowledge qualifier”.
- `QUERY-LIMIT-01`: every complexity limit accepts its maximum, rejects maximum
  plus one with zero corpus calls, and cannot be bypassed through direct RPC.
- `QUERY-EXEC-01`: browser and RPC instrumentation record one execution from
  launch through rendered result.
- `RESULT-CARDINALITY-01`: every inline and repeatable slot passes at its exact
  maximum; maximum plus one either uses its declared child cursor or fails the
  contract, never truncates; initial and child pages remain within byte limits
  and use one set-based RPC with zero N+1 calls.
- `SERVING-PAYLOAD-01`: changing one projected state, canonical value,
  denominator or evidence reference without changing its serving key fails
  independent key-and-payload-digest certification and import parity.
- `ERR-CURSOR-CACHE-01`: injected validation, auth, admission, circuit, timeout
  and result-contract failures use the exact error contract; cursor tampering,
  cross-scope replay and expiry fail; cache cannot cross auth, contract or
  release boundaries.
- `RETRY-01`: instrumentation proves one serving attempt and zero interactive
  retries; eligible background work makes at most two delayed attempts with
  fresh admission and one idempotency key; mutations make zero automatic
  retries.
- `CURSOR-PAGE-01`: 10,000 rows with duplicate and null sort values page exactly
  once with no omission or duplication, including current and prior signing-key
  overlap, expiry, revocation and retained-release lifetime.
- `CACHE-CAPACITY-01`: concurrent fills across the maximum retained releases and
  authorisation scopes cannot exceed fleet-wide entries, bytes, fill-rate or
  per-scope quotas and cannot evict data pinned by a live cursor, export or
  rollback window.
- `P0-ROUTE-01`: source, built-route and instrumented discovery agree, every
  unbounded route is contained, and `N` versus `10N` preserves fixed call and
  Node payload ceilings.
- `PREVIEW-AUTH-01`: every preview page and action denies unauthenticated access
  before and after snapshot restore; cross-user, forged-owner, forged-admin and
  CSRF attempts fail.
- `CAPACITY-LOAD-01`: normal, cold, all-miss, stampede, maximum-scale,
  controller-failure, latency, cancellation and importer profiles respect the
  measured connection reserve and recover without a retry storm. Cap-plus-one
  rejects before checkout, a dead fill leader expires, a stale fence cannot
  publish, maximum application instances still produce one shared fill,
  controller outage produces zero checkout and half-open state permits exactly
  one probe.
- `SCOPE-OMISSION-01`: separately omitting or adding one source, deal, family,
  claim, result, registry entry, route, schema, test or released row fails exact
  bidirectional set equality even when counts remain equal.
- `SCOPE-EXCLUSION-01`: inserting or changing an exclusion after scope freeze
  invalidates the candidate; `FAILED` or `NOT_EXAMINED` in any expected optional
  or required slot blocks; and moving a failed deal, family or slot into
  exclusions without pre-freeze evidence and Ben approval cannot pass.
- `DEPLOY-CUTOVER-01`: changing any certified executable input blocks
  promotion; concurrent or partially failed activation yields one complete old
  or new generation; authorisation replay fails; smoke failure rolls back and
  writes a separate immutable attestation.
- `PROGRAMME-COMPLETE-01`: passing smoke alone cannot open programme completion;
  only the exact completion attestation over every prior passing chain artefact
  satisfies its final registry gate, and any missing or mismatched reference
  fails closed.

### Phase 9: Candidate certification and production release

Phase 9 is an immutable attestation chain. Each artefact is RFC 8785 canonical
JSON, schema-validated and addressed by a domain-separated SHA-256 digest. No
artefact may be edited, appended to or overwritten after another artefact
references its digest. A correction creates a new artefact and invalidates every
downstream reference.

The chain is:

1. `OperationalPolicySet` and its three constituent manifests;
2. `CertificationPolicyManifest`;
3. `CorpusScopeManifest`;
4. `CandidateReleaseManifest`;
5. `DeploymentManifest`;
6. `PreCutoverCertification`;
7. `ProductionImportAttestation`;
8. `CutoverAuthorisation`;
9. `ActivationEvent`;
10. `PostCutoverSmokeAttestation`; and
11. `ProgrammeCompletionAttestation`.

`CandidateReleaseManifest` selects the exact OperationalPolicySet, certification
policy, contract and scope digests, CorpusRelease, ordered snapshots, canonical
objects and source payloads and the ordered serving-key and
canonical-payload-digest pairs for result rows, child rows, observations and
aggregates, plus bundle-file checksums.
`PreCutoverCertification` records every
gate required transitively by the `production_import` work class, candidate
release, OperationalPolicySet, policy, scope and deployment digests, code and
specification commits, environment, threshold, measured value, immutable
evidence, validator, reviewer and Ben approval where required. Import parity, cutover authorisation,
activation and post-cutover smoke produce their later chain artefacts and may
not be pre-attested. A missing required gate, digest mismatch, scope mismatch or
prose assertion fails closed.

`DeploymentManifest` binds the same OperationalPolicySet and certification-policy
digests, git commit, dependency-lock and build digests, immutable Vercel
deployment ID, generated contract and schema digests, applied migration set,
database introspection digest, RPCs, functions, indexes and materialised views,
action-authorisation matrix and the exact `RouteBudgetManifest`,
`CapacityManifest` and `CacheBudgetManifest` constituents,
feature-flag defaults, non-secret environment target and secret-reference
versions, and Supabase project, tier, region and pooler mode. Staging and
production differences require an explicit reviewed allowlist. Any unapproved
code, schema, RPC, index, configuration, flag or deployment change invalidates
certification.

Before candidate claim extraction, the CanonicalContractBundle fixes the
permitted policy schema and enums. One immutable
`CertificationPolicyManifest` references the exact OperationalPolicySet and
then fixes the high-risk-family list, registry disposition enum selection,
semantic-diff classifications, complete recovery-counter inventory,
certification methods and pass thresholds, soak-test formula and restore or
rollback success criteria. It cannot set a cache, route, circuit, admission or
connection configuration field owned by the OperationalPolicySet. Numeric
limits stated in this specification are immutable protocol bounds or required
certification thresholds, never a second deployed setting. Each environmental
test plan resolves its permitted numeric inputs before execution and is
referenced by the resulting evidence. A threshold or formula cannot be relaxed
after seeing a failure without a separately reviewed and Ben-approved policy
revision, which changes the scope digest and invalidates the candidate.

The pre-cutover gates are:

- both independent CorpusScopeManifest enumerators prove exact set equality for
  every source, deal, family, discovered semantic and expected assessment,
  claim, relationship and result occurrence, contract object, registry entry,
  route and job, schema, governed database object, test and traceability row;
- candidate-closure enumerators prove that selected revision occurrences equal
  those scope expectations, namespace objects equal CandidateReleaseManifest
  objects and independently recomposed serving and aggregate
  key-and-payload-digest pairs equal materialised pairs, with empty differences
  in both directions;
- every entry in the frozen registry digest has one passing terminal
  disposition: `ADOPTED_CANONICAL`, `MAPPED_ALIAS`, an acyclic `MERGED_INTO`
  chain ending in an adopted entry, `REJECTED_INVALID` or
  `DORMANT_NOT_APPLICABLE`. Rejected or dormant entries require evidence, Ben
  approval and zero active references. Pending, suggested, flagged, blank and
  deferred never pass. A newly discovered entry changes the digest and
  invalidates the candidate;
- MKT-1, MKT-2 and MKT-3 are complete;
- every outstanding item in the Ben runbook is complete;
- canonical numeric schema migration and backfill are complete;
- render-parity tooling is complete and green;
- structured-claims validation and persistence enforcement are active;
- party-token lint is green;
- the security and client-auth decision is implemented, including recorded
  completion of the credential actions in Phase 0 without recording secrets;
- the full corpus is shadow re-extracted twice, with a third run for every
  disagreement and every high-risk family. A third-run disagreement is not
  resolved by majority vote: it requires human adjudication, any necessary
  contract or extractor revision and a fresh confirming run for every affected
  unit;
- logical occurrence identity is exactly stable, identical payloads reproduce
  identical revision IDs, every identity-bearing payload difference produces a
  different revision ID, silent semantic drift is zero, unresolved residuals
  are zero and active compatibility-recovery counters are zero;
- full cross-view browser acceptance and visual regression have zero
  unexplained differences, accessibility has zero serious or critical
  violations, and the Section 8 API and browser performance budgets are green;
- current-production baseline smoke and staging-preview candidate smoke are
  green, and the post-cutover smoke and automatic rollback procedure have been
  rehearsed against staging;
- a database load and soak test proves market traffic cannot exhaust the
  Supabase Micro instance. Before testing, record actual `max_connections`,
  reserved and system occupancy, pooler mode and limits, idle baseline and p99
  non-test occupancy by role and source. Prove staging parity for tier, region,
  extensions, indexes, RPCs, pooler and relevant Vercel runtime settings. The
  test cannot assume all nominal connections are usable;
- the workload may never consume the final 20 connections or final one-third of
  measured `max_connections`, whichever reserve is larger. Serving is capped at
  30 and all application work at 40, but either cap is reduced when measured
  baseline and reserve require it. Database-side connections and waits are
  authoritative, not client semaphore counts. These are protocol upper bounds;
  the exact lower-or-equal deployed caps exist only in CapacityManifest, and the
  load gate reads that manifest rather than a second configuration;
- the normal profile measures trailing-30-day
  production peak as both maximum one-minute request rate and maximum one-minute
  in-flight concurrency, then fixes steady targets of at least five requests per
  second or three times the observed rate, whichever is higher, and at least 20
  in-flight requests or three times observed concurrency, whichever is higher.
  A seeded generator ramps for five minutes, holds those targets for 60 minutes
  and then holds twice the target request rate for a 15-minute burst across at
  least four application instances. The fixed traffic mix is 25% Review, 15%
  Corpus Context, 20% Compare and
  `DEAL_TO_MARKET`, 25% query initial/refine/page across all five intents, 10%
  evidence and facet/field-value requests, and 5% export and Admin/background
  work. Seventy percent of cacheable requests are repeated hits and 30% are
  unique misses. The manifest records concrete resolved rates, concurrency,
  fleet size, ramp, deterministic think-time distribution and route weights.
  All are recorded as resolved numeric inputs before execution;
- hostile profiles also run: 100% unique cold-cache misses at target rate for
  15 minutes; a cold-key stampede at twice target concurrency for five minutes
  across one, four and maximum configured instances; cache and controller
  outages; two-second database latency; locked-query timeout; 25% client
  cancellation; circuit open, cooldown and one half-open probe; the normal mix
  while the importer completes ten batches; and corpus fixtures at `N` and
  `10N` proving unchanged route call and Node row/byte ceilings;
- in the no-fault steady and target-rate all-miss profiles, at least 99.9% of
  requests return a schema-valid successful response and achieved throughput is
  at least 99.9% of the fixed target, with zero admission, circuit-open or
  database-timeout responses. The twice-target burst must sustain successful
  throughput at or above the steady target; excess work may receive bounded 429
  admission responses only before connection checkout. Latency percentiles pass
  only if the corresponding success and throughput floor passes;
- after any injected controller, cache, database-latency, lock, cancellation or
  worker-death fault ends, successful target throughput and the Section 8
  latency budgets recover within the greater of two configured circuit
  cooldowns or 60 seconds, without a queued or retry surge; and
- every normal and hostile profile has zero pool exhaustion, database-timeout
  leakage, connection-cap breach, retry storm or corpus-proportional call or
  Node-payload growth. Admission rejection occurs before checkout, recovery
  restores latency budgets, and one market request performs only its declared
  bounded calls. Indexed set aggregation inside Postgres remains permitted;
- backup restoration and active-corpus rollback are rehearsed successfully;
- independently discovered route, contract, source, deal, expected occurrence
  and test sets exactly equal their scope and traceability sets; selected
  released-object sets exactly equal CandidateReleaseManifest and traceability
  sets; and the released occurrence projection exactly equals scope, with zero
  unmanifested or untraced IDs; and
- the exact DeploymentManifest is certified for the executable production
  system.

The Ben-run corpus gate is self-contained. Each action below requires a stored
dry-run artefact, Ben's local `--apply` record where applicable and a post-write
verification linked from `PreCutoverCertification`. Every write-bearing action
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

After those gates, Ben imports only the bundle digest named by
`PreCutoverCertification` into an inactive production namespace. The importer
performs no extraction, normalisation, correction replay or semantic
transformation. `ProductionImportAttestation` records the bundle, scope,
certification and deployment digests, namespace, exact expected and imported
stable-ID and source-payload sets, empty set differences in both directions,
payload and object checksums, production BlobAvailabilityReceipt generations
and exact serving-key and payload-digest pairs, importer commit and Ben's apply
evidence. Count-only or key-only parity cannot pass, and the active release state
must remain unchanged.

Ben then issues one immutable, expiring, one-use `CutoverAuthorisation`. It
binds the certification and import attestations, target and expected current
release IDs, DeploymentManifest, expected release-state generation, production
environment and actor. Reuse, expiry or any mismatch fails closed.

One serialisable database RPC locks the singleton canonical release-state row,
validates and consumes the authorisation, changes `active_release_id` and
`exposure_enabled` together, increments generation and writes an append-only
`ActivationEvent`. Failure rolls back every change. An application or
environment switch may force exposure off but cannot enable it. Each request
resolves one generation and keeps it in every cache key, so it sees the complete
old or complete new release, never a hybrid.

The live smoke suite writes a separate immutable
`PostCutoverSmokeAttestation`. Failure invokes the rehearsed serialisable
rollback RPC against the expected generation, atomically restores prior release
and exposure and records a rollback event. A generation mismatch escalates and
never overwrites newer state. The programme completes only when a new immutable
`ProgrammeCompletionAttestation` references passing certification, import,
activation and smoke artefacts. Every earlier artefact remains byte-for-byte
unchanged. The completion validator creates it only after every other required
gate is passing; the status validator then, and only then, may mark
`P9_PROGRAMME_COMPLETION_ATTESTATION` as passed.

## Sequencing and ownership

- Generated programme-gate status is the sole sequencing authority. With the
  status artefact absent, only specification review and emergency containment
  are permitted. Thereafter each work class opens only through its registry
  dependencies. Bounded implementation planning requires
  `implementation_planning`; isolation-boundary setup requires its three
  security dispositions. A production-snapshot restore or data-bearing preview
  additionally requires isolated project identities and default-deny access
  protection. No post-containment factual baseline, canonical implementation or
  canonical data work begins until `canonical_work_start` is green.
- A stale, absent or invalid status artefact blocks work. No agent, reviewer,
  branch status, prose statement or prior approval may infer a pass. Fable or
  Claude 5.6 Sonnet must approve the legal-semantic, identity and extraction
  design, and Ben must approve the exact specification digest.
- Phase 0's factual baseline and Phase 1's contract follow. Phase 2 implements
  immutable identity. Phase 3 then extracts against that identity. Phases 4 and
  5 normalise and build candidate releases. Phase 6 builds the serving path.
  Phase 7 moves all surfaces to the shared contract. Phase 8 instruments and
  traces the system. Phase 9 alone authorises cutover.
- This programme is not implemented through one monolithic plan. After the gate
  registry permits planning, each emergency, environment, phase or
  independently shippable architectural slice receives its own bounded
  implementation plan, acceptance set and rollback. A later plan may depend on
  a certified earlier slice but cannot silently widen its scope or waive a gate.
- Agents draft. Fable or Claude 5.6 Sonnet reviews every legal-semantic,
  identity and extraction diff. Ben decides taxonomy and codebooks through the
  Freeze Gate. No such diff merges unreviewed.
- Completed slices land into `main` only behind disabled flags after review and
  mechanical gates. Every increment leaves `main` deployable. Candidate data
  stays in staging until the Phase 9 pre-promotion gates pass. Its subsequent
  content-addressed import stays inactive and inaccessible until atomic
  activation, and no slice flag may bypass the database release-state gate.
- The pause on piecemeal implementation remains until architecture review and
  environment isolation are complete. Later product work may proceed only as
  an approved architectural slice or a separately authorised emergency fix;
  neither may bypass canonical gates or introduce a second write path.
- The existing WP-R punchlist in docs/PLAN.md maps: R1/R2→Phase 5,
  R3/R8→Phase 3 data passes, R4→Phase 3, R5→Phase 5, R6→Phase 3,
  R7→Phase 3 (Fable-or-Claude-5.6-gated), R9→Phase 1 vocabulary work
  (Ben-gated), R10→independent cosmetic. Product work that touches shared rows
  also enters the Phase 8 traceability matrix.
