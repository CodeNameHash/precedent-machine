# Canonical corpus v2: adversarial tests

This file is the sole authority for numbered adversarial tests in the governing specification. The governing architecture, governance, phases and implementation sequence remain in [the programme spine](../CODEX-PROGRAM.md).

The following adversarial closure tests are mandatory traceability entries:

- `GATE-01`: absent, stale, malformed or mismatched gate evidence leaves work
  blocked; prose cannot change the result. The formal legal-semantic lane accepts
  only Fable or an independent 5.6 Sol reviewer using extra-high reasoning. An
  ordinary Sol review is advisory unless the recorded reviewer meets those exact
  model, reasoning and independence requirements. Missing or mutable provider
  attestation, a self-asserted model or reasoning label, an author reviewing the
  root they changed, prior conclusions, a non-empty reviewer edit set or a
  before-and-after root mismatch is ineligible and leaves the gate open. The
  validator must fetch the record from the authenticated provider API, verify
  its signature and certificate chain to the frozen trust roots, consume its
  single-use nonce and match every field. A repository file, CLI transcript,
  copied provider response, unverifiable key or unavailable provider record is
  advisory only. Mutating any manifest byte, including an identifier-continuity
  count or digest, must change the detached five-member specification root and
  invalidate every earlier review and approval. Every gate must reject an
  unknown evidence schema, wrong typed object, missing or extra acceptance
  claim, unbacked boolean `PASS`, untrusted validator or missing mandatory-test
  result. Reviewer independence must be recomputed from the provider session
  graph and authorship and prior-conclusion registries; a fresh-looking session
  or empty edit set alone cannot pass.
- `VERTICAL-SLICE-01`: before the slice passes, the gate registry permits only
  its fixed reviewed staging fixture through `vertical_slice_execution` and
  blocks broad `candidate_scope_and_extraction`. The fixture must traverse the
  frozen source, Phase 2 writer kernel, identity, definition, semantic graph, claims, relationships,
  validation, writer, candidate release, serving projection and shared-row UI
  contracts for the representation, IOC, no-shop, multi-span, nested-definition,
  multiple-value and reviewed-unfamiliar-proposition cases. One failed row
  leaves siblings navigable. One market request uses the indexed set-based path
  with bounded statements and rows. Omitting a phase-owned dependency, widening
  fixture scope, performing production DML or opening family expansion before
  `P1_VERTICAL_SLICE_PASS` fails.
- `ID-CLAIM-01`: changing only claim state, value, evidence, selected closure,
  dependency-discharge revision, derivation or correction preserves occurrence
  ID where the governed subject is unchanged, changes revision and rekeys every
  dependant through release.
- `ID-SOURCE-01`: distinct receipts or converters producing identical text keep
  distinct source actions and cannot cross-serve evidence.
- `BLOB-ATOMICITY-01`: delete-during-admission, stale availability receipt,
  object replacement and missing production-import payload all fail without a
  canonical reference; a concurrent admitted reference prevents tombstoning.
- `ID-OBJECT-01`: spans, excerpts, evidence, governed deals, family sets,
  snapshots and releases reproduce across databases with different UUIDs and
  insertion order.
- `ID-RESULT-CAPACITY-01`: two results with the same deal, admission, result
  definition, party role and value and ordinal but different governed legal
  capacities have distinct DerivedResultOccurrence IDs, component occurrences,
  serving and child keys, exact-detail parent contexts, query rows and cursor
  endpoints. Omitting or changing capacity at any dependent layer fails
  composition, inventory and query parity.
- `ID-TOPOLOGY-01`: construction in a fresh database proves every identity and
  manifest reference already has its final digest; a forward reference, a
  pre-claim relationship depending on its dependent ClaimRevision or any other
  identity cycle fails before persistence. It rejects an independent
  deal-document manifest built before final verification, source admission or
  deal identity, either deal-document builder reading the other's code, rows,
  comparator tuple or ordinal, a composition child referencing a shard or
  parent, a shard referencing its parent, a reconciliation created before both
  inputs and any pre-output semantic or composition closure referencing later
  candidate output. It also rejects an attempt
  before its ArchiveSafetyPolicyManifest, a parent ArchiveAttemptNode referenced
  by its child, a cutoff event naming its own cutoff, a cutoff payload or
  receipt-tree builder that advances the head it is certifying, a cutoff manifest before
  its BoundedInventoryTree nodes, CutoffPreparationSeal before both prepared
  root sets, CutoffPreparedReconciliation, control-receipt roots or
  CutoffPreparationControlReceiptReconciliation, PREPARED cutoff transition
  before the PREPARATION_SEALED receipt, initial-mode eligibility recheck before
  PREPARED or after IntakeCutoffAttestation, IntakeCutoffAttestation before that
  initial recheck or the complete prepared cutoff chain, or the FROZEN cutoff
  transition before IntakeCutoffAttestation, ContractFreezeAttestation
  before SemanticQuestionCatalogueReconciliation, applicability before base and
  Q reconciliation, a DealScopeRunReceipt before its DealScopeRunManifest, a
  DealScopeRunReceipt before its resulting `SCOPE_SUBJECT_ADVANCED` event and
  CandidateInputHead CAS, an event that hashes a later subject or composite
  receipt, a composite receipt before every component subject receipt, a scope
  inventory root before every selected DealScopeRunReceipt, an actual
  occurrence before the scope barrier, a DealSnapshot before every selected
  family set, or a DealExtractionRunManifest before both its DealSnapshot and
  every selected FamilyExtractionManifest. It rejects a CorrectionDischarge
  before every named primary and consistency output, a corrected output that
  hashes its later discharge, or a selecting manifest built before the complete
  CorrectionDischargeMap. The enforced correction prefix is application,
  applicability projection, event, correction-ledger and subject-head CASs,
  CandidateInputEvent, CandidateInputHead CAS and CorrectionApplyReceipt. For a
  scope correction the remainder is reconciled applicability slice, V3 registry
  and complete applicable entry set, mechanically derived discriminator,
  per-kind applicability creation-slot locks and one aggregate subject-root slot,
  every required ApplicabilityReexaminationEntry and complete Slice,
  every `ScopeSubjectApplicabilityRoot`, corrected outputs, discharge, map,
  subject manifests, ScopeSubjectHead CAS,
  `SCOPE_SUBJECT_ADVANCED` event, CandidateInputHead CAS, subject receipts and,
  for every `MULTI_SUBJECT_CORRECTION` dispatch regardless of cardinality,
  composite receipt before barrier. For a post-scope correction the remainder is
  reconciled applicability slice, replacement outputs, every required family
  Entry and complete Slice, discharge, map, family set, manifest, transition and
  receipt. It rejects any
  omitted, reversed or cyclic edge in that chain. It also rejects a
  ContractFreezeAttestation before every PRE_FREEZE_CONTRACT stage root and the
  RelationshipEffectFieldUniverseSetRoot, a constraint before its field
  universe, a relationship reconciliation before both complete constraint set
  roots, a candidate reconciler before its stripped-projection attestation and
  complete candidate stage root, a lineage slot before its closure and
  result-component occurrence slot, a lineage slot referencing an actual,
  revision or lineage, a component ordinal derived from candidate data, or a
  candidate projection or conformance referencing the later CandidateOutputSeal,
  any paired scope, release-input or candidate-output inventory root before its
  exact terminal-PASS InventoryEnumeratorIndependenceAttestation,
  either candidate-wide applicability root before both sealed release-input root
  sets and reconciliation, applicability independence before both roots, named
  reconciliation before independence, manifest before reconciliation, a metric-
  projection entry before the manifest, projection set before every entry or
  materialisation-time intake recheck before that set, CandidateInputSeal before
  that recheck or CorpusRelease before CandidateInputSeal,
  a CorpusRelease before both release-inventory root sets, the materialisation-
  time recheck or CandidateInputSeal, any CorpusRelease-keyed output or
  ServingContractMetadata before CorpusRelease, metadata before its composition-
  contract-set attestation, a parent serving row before its exact-detail payloads
  and references, a CandidateOutputSeal before both complete output root sets or
  both control-receipt roots, an output append event that hashes its later
  receipt, or a PREPARED candidate transition before the terminal
  OUTPUT_SEALED receipt,
  a candidate transition receipt before its
  transition and head CAS, CandidateReleaseFreezeAttestation before both seals
  and roots, CandidateInputRecheckAttestation before the FROZEN candidate
  transition and receipt, READY_CANONICAL ServingFenceVersion before
  ActivationEvent or smoke before READY_CANONICAL; a PostActivationControlContext
  before ActivationEvent, an action receipt before its event and head CAS,
  ADOPT_POST_ACTIVATION_TRACE before the POST_ACTIVATION trace it consumes, pass
  lease before its issue action, COMMIT_PASS before that lease and receipt, a
  containment-owned external BLOCKED publication before the
  BEGIN_FAILURE_CONTAINMENT receipt, or an adopted ordinary-revocation BEGIN
  without its exact prior registered fence, drain, RollbackEvent and receipt,
  COMPLETE_FAILURE_CONTAINMENT before the pending head, BEGIN receipt,
  acknowledgement and drain, or FAILURE_FIXED before COMPLETE. It also rejects
  a legacy post-commit context before restoration COMMIT_PASS, READY adoption
  before that context's genesis receipt, smoke adoption before READY, a
  containment-owned reblock before BEGIN_POST_COMMIT_ABANDONMENT, an adopted
  legacy BEGIN without its exact prior ordinary-revocation chain, or abandonment
  fixation before COMPLETE.
  It also rejects a bundle or
  import run claim before its precommitted
  slot, a spool commitment before its one-use claim, neutral trees before their
  signed terminal-PASS spool commitment, a walker-output attestation
  before its neutral trees, an output-set attestation before every authoritative
  slot, claim and output, a role-bound governed root before its matching output
  attestation, a success erasure receipt before its role output, the four-role
  bundle erasure set attestation before all four receipts or finalisation before
  that set, the six-role import set before all six receipts or ProductionImportSeal
  before that set, the three-role semantic set before all three receipts or
  ProductionSemanticParityAttestation before that set, an independence
  attestation that hashes later output, a
  ReleaseBundleEnvelope before the four-role output set and reconciliations or
  any committed or externally visible ReleaseBundleEnvelope not atomically
  paired with its exact FINALISED event, head and receipt, a
  ProductionImportSeal before the six-role output set and reconciliations, or a
  ProductionImportAttestation before all four semantic-parity category root
  pairs, including ProductionServingContractMetadataParityRootPair.
  Composition construction is dispositions, requirements, shards,
  parent roots, K/D contract reconciliation,
  ExpectedCompositionContractProjection, CompositionScopeClosure,
  ExpectedOccurrenceSlot, ExpectedResultInputLineageSlot, actual occurrence and
  revision, lineage, result and component revision, candidate contract and
  instance projections and attestations, contract reconciliation and instance
  conformance, both CompositionContractSetRecompositionRoots, their independence
  attestation, terminal CompositionContractSetAttestation,
  ServingContractMetadata and CandidateOutputSeal. Reversing any of those edges
  fails topology. Same-bundle reapproval changes every composition
  child, shard, root, reconciliation and closure because each path binds the
  exact frozen pair.
- `PRECLAIM-OCCURRENCE-01`: after scope freeze, the exact selected
  ExpectedOccurrenceSlot materialises its precomputed ClaimOccurrence without a
  revision and it becomes a typed endpoint of one
  `PRE_CLAIM_SCOPE` relationship. The relationship resolves before the later
  ClaimRevision; a missing occurrence, forward reference or dependency on that
  revision fails before persistence.
- `RELEASE-BUNDLE-01`: CandidateReleaseManifest hashes exactly its eligible
  sealed input, candidate-output and named-control closure through fixed roots,
  including required input-side receipts and composition controls, and cannot
  hash itself, CandidateReleaseFreezeAttestation, the later
  FROZEN CandidateBuildTransition or receipt, recheck, promotion fence or any
  other later artefact. ReleaseBundleEnvelope is
  created after the exact deployment and certification, hashes every member
  once, excludes itself and contains no forward reference. Missing, extra,
  reordered or altered members, duplicate logical identities or paths, a role,
  type, encoding, length or path mismatch, a missing candidate object/blob
  projection tree node and a different envelope ID all fail
  before production import. Identical member bytes under two identities remain
  two required members, while the same identity twice fails. Reusing one
  Original source packages and ImmutableSourceDocuments remain `SOURCE`;
  validated graphs, open-world audit and effective chains, dispositions, impact
  and re-examination closure remain `SEMANTIC_SCOPE`; the three row variants and
  response-safe open-world details remain `SERVING_PROJECTION`. A non-empty
  effective review queue or similarity proposal fails membership, while a
  superseded unresolved-kind predecessor remains required through its audit
  chain. Reusing one
  governed member root, support root, walker-output attestation or execution
  record under both bundle-walker roles fails even when the neutral roots,
  digests and counts correctly match. A second claim for one role, changed
  output replay, extra persisted output or omission from the authoritative
  four-role output-set attestation fails and cannot be repaired by selecting the
  preferred run.
- `RELEASE-BUNDLE-ABANDONMENT-01`: generated operation, carrier, disposition and
  SQL registries contain exactly five top-level release-bundle actions:
  PRECOMMIT_WALKERS, CLAIM_WALKER_ROLE, WRITE_WALKER_OUTPUT,
  FINALISE_BUNDLE_CONTROLS and ABANDON_BUNDLE_CONTEXT, and the last has exactly
  the seven ordered phases FAILURE_EVIDENCE, PARTIAL_STATE_TREE_BATCH,
  ABANDON_CONTEXT, FAILED_SPOOL_ERASURE, SPOOL_ERASURE_RECEIPT_SET,
  ATTEMPT_AUDIT_TREE_BATCH and ATTEMPT_AUDIT_TERMINAL. Inject walker failure,
  timeout, expired commitment, partial ingest, trust revocation and finalisation
  fault. The affected ReleaseBundleControlContext cannot finalise or emit an
  envelope. FAILURE_EVIDENCE must bind the acyclic pre-evidence digest,
  PARTIAL_STATE_TREE_BATCH must close the later inventory including that
  evidence, and only ABANDON_CONTEXT may atomically write the abandonment
  terminal, event, head and lifecycle receipt. Failed-target erasure, its set
  and the attempt-audit trees, roots, reconciliation and terminal follow only
  through their declared phases.
  Omitting the fifth action, retaining the former four-action registry, using a
  generic ABANDON or permitting another carrier or action writes nothing.
- `RELEASE-BUNDLE-CONTEXT-RACE-01`: race FINALISE_CONTEXT against
  FAILURE_EVIDENCE and ABANDON_CONTEXT, two
  finalisers, two abandoners and a late walker output against both terminal
  paths. The shared reason-independent failure-evidence slot and OPEN-head lock
  permit either an EMPTY-slot finalisation or one FIXED failure intent followed
  by abandonment, never both. Exactly one CAS-linearised FINALISED or ABANDONED context wins with its
  complete event, head and receipt or none do; the opposite terminal, a late
  output and a second envelope write nothing. A new attempt has a new immutable
  context and rejects every prior run claim, commitment, node, output, root,
  receipt and envelope even when candidate inputs are byte-identical.
- `RELEASE-BUNDLE-SPOOL-GC-01`: for all four bundle roles, race spool erasure
  against terminal-output commit, finalisation, abandonment and a stale context.
  Successful spools remain until their signed commitment, neutral tree and
  terminal output attestation have committed; exactly four role-bound success
  erasure receipts in mode `SUCCESS_AFTER_TERMINAL_OUTPUT` and
  `ReleaseBundleSpoolErasureReceiptSetAttestation(SUCCESS_PRE_FINALISATION)`
  must then commit before finalisation. Finalisation selects that attestation
  and all four receipts alongside the exact
  ReleaseBundleWalkerSpoolCommitmentRoot. Fault injection between every per-
  role output, erasure receipt, CONTROL_SET commit and FINALISE_CONTEXT commit
  preserves the complete prior durable subphase and exact replay resumes from
  it; no terminal transaction re-creates an earlier receipt, set or root.
  Premature, partial, repeated, wrong-
  context or coordinator-directed erasure fails. Crash replay returns the same
  receipt or set attestation, and authorised erasure leaves every signed
  commitment, root and batch receipt required for traceability.
- `RELEASE-BUNDLE-FAILED-SPOOL-POST-ABANDON-01`: inject a walker failure or
  finalisation fault after zero, one, several and all four successful role
  erasure receipts. Every failed or partial spool remains physically present
  until ABANDON_BUNDLE_CONTEXT commits its immutable abandonment terminal.
  Only then may the registered garbage collector erase each remaining spool and
  issue its role-bound `FAILED_AFTER_ABANDONMENT` erasure receipt; one
  `ReleaseBundleSpoolErasureReceiptSetAttestation(ABANDONED_CONTEXT)` closes the
  exact union of earlier success receipts and post-abandonment receipts with
  empty missing, extra, duplicate and wrong-authority roots, and one
  AttemptAuditTerminal selects that set attestation. A
  success receipt is never rewritten, a retained failed spool is never treated
  as success, crash replay is idempotent and none of this branch enters
  POST_IMPORT or any passing trace phase.
- `PROMOTION-EVIDENCE-01`: the ten fixed slot codes occur exactly once with the
  required object type, state and payload digest, including the tenth exact
  QueryGoldenCertificationAttestation slot. Omitting, duplicating,
  relabelling, reordering or substituting a slot fails. Both independent support
  walkers reproduce every POST_FREEZE trace-row payload and reachable support
  control with equal neutral digest and count; a missing, extra, orphan,
  wrong-path or payload-swapped support file, structural/member path collision or
  attempted serving grant fails envelope and import certification.
- `BUNDLE-IMPORT-DESTINATION-01`: independently swap or duplicate a `C`, `B` or
  `E` object across destinations, mix rows from two import generations, alter a
  namespace-derived physical key, copy an expected governed root, walker-output
  attestation or execution record as actual, create a second run claim or an
  unselected output for any import role, relabel any of the six import walker
  roles or preserve counts while substituting one payload. Sharing prohibited walker code, query,
  view, cache, intermediate rows or output fails the import-enumerator
  independence attestation. Neutral C/B/E and support comparisons,
  ownership disjointness and physical enumeration must fail. Domain-separated
  wrapper IDs are never required to equal; only their declared neutral content
  digests and counts are compared.
- `WALKER-ONE-USE-01`: for each of the four bundle roles, six import roles and
  three production-semantic-parity roles,
  atomically claim its precommitted slot, race a second claimant, replay the
  same claim from a second process, attempt same-process re-entry, a fork or
  child execution, supervisor restart, two walker invocations, two candidate
  terminal outputs, replay the identical captured output, attempt a changed
  output and persist an extra or wrong-role output. Exactly one claim, one
  harness launch, one walker invocation, one directly captured terminal stream,
  one terminated process tree and one byte-identical replayable output may
  exist under the authoritative context-and-role key. Substituting the frozen
  harness measurement, sandbox policy, verifier, attestation trust root or
  token-service profile, using a self-issued, unknown, stale or revoked dynamic
  harness key, or presenting a token from the wrong issuer, audience, context,
  role or nonce fails before launch. Transcript mutation,
  invocation or output count other than one, non-zero fork, child, re-entry or
  restart count, missing token consumption or a surviving process fails. A
  failed, timed-out or crashed claimed slot cannot be retried in the same
  context. Missing, extra, conflicting, unselected or non-PASS slot, claim or
  output evidence prevents the applicable output-set attestation,
  reconciliation, envelope, import seal or semantic-parity terminal
  attestation. The reconciler's claim additionally fails before the terminal
  expected-and-physical two-role set exists.
- `WALKER-SPOOL-AUTHENTICITY-01`: for every four-role bundle, six-role import
  and three-role production-semantic-parity slot, exercise zero, exact-maximum and maximum-plus-one chunk, byte and row
  limits; unsigned, pre-exit, expired and wrong-role commitments; read before
  seal; missing, altered or unsigned `sealed_at`, `expires_at`, policy lifetime
  or trusted-clock evidence; a not-yet-valid seal, wrong lifetime and expiry
  immediately before each commitment, batch and terminal-output transaction;
  truncation, duplicate, reorder, substitution, wrong prior digest,
  cross-role chunk and coordinator-selected subset; changed bytes with preserved
  counts; crash mid-ingest; exact batch replay; stale or reused spool; failure to
  retain a failed or partial spool until irreversible terminal abandonment;
  premature erasure before the context's governed terminal-success or
  abandonment authority; for bundle contexts, success erasure before the exact
  role output attestation or abandonment erasure before
  ReleaseBundleControlAbandonmentTerminal; failure to
  erase governed spool bytes after the applicable success-output or
  abandonment authority and exact
  erasure receipt;
  missing, extra, reordered, duplicated, wrong-role or wrong-context commitment
  in each exact four-, six- and three-role commitment root; and output
  attestation before complete equality.
  Only a signed terminal-PASS commitment whose full chained stream is ingested
  exactly once may yield an output attestation. Claim creation also fails unless
  the frozen maximum walk, ingest, terminal-commit and skew bound fits strictly
  within every proof and trust-chain validity horizon. Each output set,
  ReleaseBundleEnvelope, ProductionImportSeal, ProductionSemanticParityAttestation
  and ProductionImportAttestation must bind the applicable exact ordered
  commitment root; output-wrapper references alone cannot satisfy physical
  commitment closure.
- `PRODUCTION-SPOOL-GC-01`: for all six import and three production-semantic-
  parity roles, require signed terminal commitments and role outputs before
  success erasure. The six import receipts close exactly one
  `ProductionWalkerSpoolErasureReceiptSetAttestation(IMPORT_SUCCESS)` before
  ProductionImportSeal; the three semantic receipts close exactly one
  `ProductionWalkerSpoolErasureReceiptSetAttestation(SEMANTIC_SUCCESS)` before
  ProductionSemanticParityAttestation and ATTEST_IMPORT. Both attestations and
  all nine receipts enter POST_IMPORT with the exact import and semantic
  commitment roots. On ABANDON_IMPORT, successful receipts already committed
  remain immutable, every failed or partial spool is retained until the
  abandonment terminal and erased only afterwards, and AttemptAuditTerminal
  selects the
  `ProductionWalkerSpoolErasureReceiptSetAttestation(IMPORT_GENERATION_ABANDONED)`
  that closes the mixed receipt set. Exercise crash before and after each byte erase,
  receipt, set attestation, seal and abandonment step; replay is exact and no
  audit object can substitute for a success receipt or passing attestation.
- `WALKER-TRUST-REVOCATION-01`: for every bundle, import and production-
  semantic-parity role, revoke or
  expire the harness key, token issuer, trust chain or status head separately
  before claim, between claim and output and between the final output and
  envelope, import seal or semantic-parity terminal attestation. The
  ROLE_LAUNCH proof blocks the first two races and the fresh CONTEXT_SEAL proof
  blocks the last. For each CONTEXT_SEAL arm, change `context_kind`, omit or
  substitute its success-erasure receipt set or another context's terminal
  control, or mix one arm's terminal fields into another; every case produces
  zero finalisation DML. Reusing a proof across role,
  profile, context or generation, changing its signed head, nonce or expiry, or
  omitting its ID or payload digest from a claim, output, envelope, seal or
  attestation produces zero finalisation DML. Pause each claim, terminal-output,
  bundle-finalisation, import-seal and semantic-parity ATTEST_PARITY transaction
  after proof validation but before DML and race an exclusive status-head
  revocation. The shared/exclusive
  head locks permit only the complete old commit followed by revocation or the
  revocation followed by zero writer DML; validation followed by revocation
  followed by a stale commit is impossible. Direct status-head DML by any
  non-controller role, an unsigned event, stale predecessor or partial
  multi-head revocation also writes nothing.
- `IMPORT-PRESEAL-CONTROLS-01`: build both bounded pre-seal control trees through
  exact maximum and maximum-plus-one batches, then independently omit, add,
  duplicate, reorder or substitute one BlobAvailabilityReceipt, composition
  member, leaf, internal node or terminal root, change namespace or import
  generation and attempt direct or wrong-discriminator DML. Only
  `BUILD_PRESEAL_CONTROLS/{TREE_BATCH|TERMINAL_ROOTS}` may write these carriers;
  maximum plus one and every mutation fail before ProductionImportSeal. The
  terminal ProductionBlobAvailabilityRoot and importer
  CompositionContractSetRecompositionRoot and every reachable node must appear
  in POST_IMPORT trace and exact omission coverage.
- `IMPORT-SEMANTIC-PARITY-01`: after SEALED import, independently omit, alter,
  duplicate or cross-wire one original-package integrity row, graph-validation
  result, audit/effective candidate edge, source-role admission transition or
  carried-forward disposition, empty-queue member,
  impact or applicability entry, SharedServingRow variant, OPEN_WORLD_EVIDENCE
  edge, observation eligibility/exclusion or one observation, cohort or
  aggregate parity member, or ServingContractMetadata field. Each mutation changes the
  corresponding independently rebuilt root and prevents a passing
  ProductionSemanticParityAttestation and ATTEST_IMPORT. Copying candidate
  inventory or output roots, preserving counts, invoking the builder before
  SEALED, writing an unregistered node or omitting the terminal attestation also
  fails with zero import-head or serving-state change. Racing two `CLAIM_ROLE`
  payloads for one context and role yields exactly one role claim; changing
  executable, configuration, input capability, profile or ROLE_LAUNCH proof
  under that slot, mixing a node from another role claim, racing two role
  outputs, two terminal sets or two terminal attestations, or selecting any
  object outside the unique terminal slot fails closed and cannot be repaired
  by choosing a preferred run.
- `IMPORT-SEMANTIC-PARITY-INDEPENDENCE-01`: independently make expected and
  physical share prohibited code, a database role, credential, query, view,
  cache, intermediate row or output; permit expected to read inactive serving
  values, physical to read expected roots or canonical expected values, or the
  reconciler to read any source, canonical-owner or inactive-namespace row;
  swap role labels; reuse one slot, claim, ROLE_LAUNCH proof, transcript or
  output for two roles; claim the reconciler before the terminal two-role set;
  omit or add a role; or preserve every final compared byte while violating one
  isolation edge. Each mutation fails the independence, role-output or output-
  set controls before ProductionSemanticParityAttestation. Attempting to issue
  the semantic-parity CONTEXT_SEAL before the terminal three-role set, making
  that proof hash the later parity attestation, omitting the proof from the
  attestation, reusing the earlier import-seal proof or revoking a selected key
  between proof validation and terminal DML also writes no parity attestation.
  The only passing order is independent expected and physical claims and
  outputs, authoritative two-role set, distinct reconciler claim and output,
  terminal three-role set, fresh CONTEXT_SEAL and terminal attestation.
- `IMPORT-MARKET-PARITY-01`: independently alter an observation occurrence,
  serving key, canonical value, state, party, unit or basis, selected revision,
  lineage or payload; a cohort AST, legal scope, party, value or capacity
  semantics, operator, quantifier, reducer or cohort digest; one contributing
  observation pair; or an aggregate key, input-set digest, subject or deal
  count, denominator, exclusion partition, unrounded result or payload. Every
  mutation changes its expected-versus-physical pair or a fixed difference root
  and blocks ProductionSemanticParityAttestation, ProductionImportAttestation
  and POST_IMPORT. Preserving counts, coherently changing a stored key and stored
  digest, copying candidate roots or changing display rounding cannot hide a
  semantic mismatch. Release-materialised common aggregates pass this gate;
  runtime refined cohorts use the same formulas through SQL goldens,
  `COHORT-DIGEST-01`, result validation and load certification.
- `IMPORT-SERVING-METADATA-PARITY-01`: keep exactly three semantic roles and
  require exactly four category root pairs. The expected role reconstructs
  ServingContractMetadata from frozen schemas, query roots, the exact tenth-slot
  QueryGoldenCertificationAttestation, row/access/composition contracts and
  other governed inputs without reading stored metadata. The physical role
  reconstructs canonical bytes, ID and digest from inactive carrier columns
  while ignoring asserted ID and digest columns. Independently mutate one input,
  one physical field, only an asserted ID or digest, category count, root member
  or difference node; copy expected bytes into physical output; give the
  reconciler source access; or omit
  ProductionServingContractMetadataParityRootPair from the terminal parity,
  import attestation, denylist or POST_IMPORT trace. Every mutation blocks
  ProductionSemanticParityAttestation and ATTEST_IMPORT with zero serving grant.
- `IMPORT-LIFECYCLE-01`: inject failure before and after every import manifest,
  row write, event, head CAS, spool erasure and receipt. The generated operation,
  carrier, disposition and SQL registries contain exactly seven top-level
  actions: `OPEN_IMPORT`, `IMPORT_MEMBER_BATCH`,
  `BUILD_IMPORT_PARITY_BATCH`, `SEAL_IMPORT`,
  `BUILD_IMPORT_SEMANTIC_PARITY_BATCH`, `ATTEST_IMPORT` and `ABANDON_IMPORT`.
  OPEN_IMPORT/NONE/OPEN_CONTEXT is the sole `INIT_EMPTY` producer for
  ProductionImportFailureEvidenceSlot and creates it atomically with the lease,
  genesis event, OPEN head and receipt; direct insert, missing initialisation or
  initialisation by ABANDON_IMPORT fails registry equality and writes nothing.
  Pre-seal and post-seal abandonment use the same exact seven ordered subphases:
  FAILURE_EVIDENCE, PARTIAL_STATE_TREE_BATCH, ABANDON_CONTEXT,
  FAILED_SPOOL_ERASURE, SPOOL_ERASURE_RECEIPT_SET,
  ATTEMPT_AUDIT_TREE_BATCH and ATTEMPT_AUDIT_TERMINAL, never eighth and ninth
  top-level actions. The first locks and fixes the reason-independent
  ProductionImportFailureEvidenceSlot and binds an acyclic evidence pre-state
  digest; the second closes the later inventory including that evidence. Race
  FAILURE_EVIDENCE against SEAL_IMPORT and ATTEST_IMPORT: the shared slot and
  head locks permit only the complete success transition with EMPTY slot or the
  FIXED failure intent followed by abandonment. Race two envelopes for
  the environment-global controller lease. The outcome is the exact prior state or one complete successor
  transaction. A stale CAS, conflicting batch ordinal, missing or wrong-head
  receipt, a cross-class row, caller-selected batch class or destination,
  same-ordinal replay with `MEMBER` changed to `SUPPORT_CONTROL` or conversely,
  or omission of environment, envelope identity, bundle digest or import
  generation from the unique replay key fails. The same ordinal in a distinct
  import generation remains independent. An extra orphan prefix-action
  receipt, shared control-receipt query or
  code that omits the same prefix receipt on both paths, unsealed extra row,
  missing support, blob-availability or importer-composition proof,
  unattached attestation, direct or non-ATTEST creation of a
  ServingNamespaceHeader, a header or ProductionImportAttestation without the
  other in the same ATTEST transaction, ATTESTED head without receipt or post-seal member
  blocks ProductionImportSeal, POST_IMPORT and cutover. Success requires the
  exact six import erasure receipts and IMPORT_SUCCESS set before SEAL and the
  exact three semantic erasure receipts and SEMANTIC_SUCCESS set before ATTEST.
  Abandonment retains every failed or partial spool through its terminal, then
  records post-abandon erasures and closes the exact attempt-audit trees, roots,
  reconciliation and one AttemptAuditTerminal without
  entering POST_IMPORT. Legitimate SEAL and
  ATTEST receipts remain outside the captured OPEN import-batch-prefix roots and pass
  only through their individually bound successor tuples.
- `TRACE-EXTENSION-01`: for PRE_SEAL and every later phase, omit, add, duplicate,
  conflict, rephase, reorder or self-reference one required object or trace row,
  or overlap a predecessor key. Required-object, coverage, difference,
  disjointness and cumulative roots must fail. The exact chain ends with the
  smoke, AVAILABLE successor, P9_TRACEABILITY prefix evidence, completion
  attestation, proposed terminal status, cutoff, context and lease covered by
  POST_COMPLETION; only that terminal extension receives the governed self-
  exclusion. Separately fail smoke, BEGIN-pending-COMPLETE containment, the genesis legacy-
  restoration path and successful, failed and abandoned historical-reactivation
  branches. Exactly one domain-separated TraceabilityFailureTerminal must
  reproduce every failure, BLOCKED fence, revoked head, exposure-off tuple,
  RollbackEvent, FailureRecoveryBranch, complete head chain, fixed outcome,
  terminal slot and branch object. Omitting or
  cross-wiring one object, selecting a PASS_PHASE discriminator, using the
  failure terminal as a predecessor, placing it in the completion pair or
  substituting any AttemptAudit or AttemptAuditTerminal for a variant-required
  object, receipt or absence proof fails.
  Direct insert, a non-validator producer, wrong carrier or phase, maximum-plus-
  one batch, premature terminal wrapper, forged receipt, a second wrapper using
  a different reason or disposition and any corpus, serving, head or outbox
  write each fail with no terminal object.
- `TRACE-PHASE-COVERAGE-01`: regenerate TraceabilityPhaseObjectRegistry/V2 from the
  frozen topology twice and require exact phase, logical type, schema, stable-key
  extractor and cardinality equality with no wildcard. PRE_SEAL must include
  AttemptAuditObjectRegistry and its frozen definitions, plus the complete
  applicability definition and instance chain through projection set,
  materialisation-time recheck, CandidateInputSeal and CorpusRelease;
  POST_FREEZE must include ReviewedSourceSpecificOutputClosure; and POST_IMPORT
  must include exactly four bundle, six import and three semantic-parity spool
  commitments, their three roots, exactly four, six and three corresponding
  success erasure receipts, the SUCCESS_PRE_FINALISATION, IMPORT_SUCCESS and
  SEMANTIC_SUCCESS receipt-set attestations, and
  ProductionServingContractMetadataParityRootPair. POST_ACTIVATION must contain
  exactly the OPEN and READY-adoption progress receipts and must exclude the
  later trace-adoption chain that consumes that extension. POST_COMPLETION must
  contain that trace-adoption event, AWAITING_SMOKE head and receipt, then the
  issue-lease and COMMIT_PASS receipts and all success effects. A failure
  terminal instead must contain the trace-adoption chain only when it occurred,
  plus the exact BEGIN
  receipt and pending head, external containment evidence and COMPLETE receipt
  and FAILURE_FIXED head. Omit, rephase, duplicate or
  wildcard any member, substitute an illustrative family for exact types, or
  preserve counts while changing a stable key. Add any runtime AttemptAudit
  node, root, reconciliation or terminal instance to a passing phase, or make the passing-phase
  and runtime-attempt carrier overlap or unclassified roots non-empty. Registry generation, required-
  object roots and bidirectional trace reconciliation all fail.
- `ATTEMPT-AUDIT-01`: regenerate AttemptAuditObjectRegistry and
  TraceabilityPhaseObjectRegistry/V2 independently, then exercise successful,
  failed, timed-out, crashed and abandoned bundle, import and semantic-parity
  paths, including a crash during spool erasure and replay. The audit registry
  contains exactly `RELEASE_BUNDLE_ABANDONED` and
  `PRODUCTION_IMPORT_ABANDONED`. Every runtime
  `OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)` object is classified exactly once and each
  abandoned governed context has three complete bounded trees, its required-
  object and coverage roots and reconciliation, and one absorbing
  AttemptAuditTerminal selecting its exact events, receipts, retained-or-erased
  spool disposition and terminal outcome; a successful context has no attempt-
  audit terminal. Only ATTEMPT_AUDIT_TREE_BATCH may write their nodes and only
  ATTEMPT_AUDIT_TERMINAL may atomically write their roots, reconciliation, slot
  consumption and terminal.
  The human matrix consumes both registries, but all five passing-phase overlap
  roots and both registries' unclassified roots remain empty. Attempt audit is
  denied by serving access, excluded from release and failure topology, and can
  satisfy no seal, import, trace, activation, rollback, completion or publication
  predicate. Reusing an audit terminal as a lifecycle receipt, success-erasure
  attestation or TraceabilityFailureTerminal fails without canonical DML.
- `ADMISSION-01`: every historical source has a terminal admission disposition;
  missing bytes, mapping, converter proof or one admitted leaf blocks release.
- `SOURCE-ADMISSION-GOVERNANCE-01`: every admission selects the exact
  SourceAdmissionRule key, version and payload digest. An exceptional or legacy
  admission without exactly one current passing SourceAdmissionApprovalAttestation
  writes no SourceAdmissionManifest. Changing only its review disposition,
  reviewer eligibility, Ben evidence or rule digest preserves source bytes but
  rekeys the attestation, admission, deal and scope manifests, candidate roots,
  release bundle and import attestation. An ordinary zero-exception admission
  may use the no-approval marker only when its exact rule and deterministic
  complete proof permit it.
- `SOURCE-ADMISSION-PREPARATION-01`: only
  `DEAL_SCOPE_RUN/PREPARE_SOURCE_ADMISSION` may create the admission-only chain
  and SourceAdmissionPreparationReceipt. Omit or alter one source, verification,
  approval, admission, deal-identity, blob-generation or head input; attempt
  semantic, deal-admission, scope, CandidateInputEvent or serving DML; call either
  review action without the passing receipt; or ask MATERIALISE_SCOPE to create
  admission; or use a different producer, carrier or receipt policy. Each
  attempt writes nothing. Exact replay returns one identical
  receipt, while conflicting replay in the same stable slot is rejected. Omitting
  or substituting that receipt in DealScopeRunManifest, either inventory
  registry, candidate release, bundle, production import or traceability also
  fails the applicable set-equality or lineage gate.
- `INTAKE-UNIVERSE-01`: omit or replace one received agreement, amendment,
  schedule, exhibit, archive member or source version, or swap two document
  roles while keeping every ordinary admission and downstream semantic object
  internally consistent. Receipt-ledger versus independent intake equality or
  independent deal-document versus DealAdmission equality fails before
  PotentialDependencyUniverse. Counts and an ordinary “complete” flag cannot
  pass; every non-admitted receipt has an exact cutoff-selected eligible
  IntakeResolution and matching governed disposition.
- `INTAKE-DURABILITY-01`: crash after receipt commit but before unpacking,
  attempt resolution or deal assignment. The receipt remains in the ledger and
  blocks every cutoff that includes its generation until a latest eligible
  resolution exists. Same-byte restart reuses it; different bytes create a new
  linked receipt. A later valid resolution can unblock only a later cutoff and
  never deletes the failure.
- `INTAKE-CUTOFF-RACE-01`: race receipt capture, attempt-and-resolution append
  and cutoff freeze. A completed append serialises before and is fully included,
  or after at a higher generation. If capture wins but its resolution has not
  committed, freeze writes no attestation. A pending, forked, omitted,
  above-cutoff or altered receipt prevents scope-stage selection. A global head
  change after OPEN makes the prepared build stale; no amount of completed
  preparation can bless it.
- `INTAKE-CUTOFF-LIFECYCLE-01`: exercise OPEN, every bounded payload batch,
  PREPARATION_SEALED, PREPARED, CUTOFF_FREEZE, FROZEN and ABANDONED. Every
  non-genesis preparation event has exactly one receipt after its head CAS;
  PREPARED binds the terminal seal receipt. The initial-mode eligibility recheck
  binds PREPARED and cannot bind the later cutoff attestation; that attestation
  binds the initial recheck and the later FROZEN transition binds the
  attestation. A missing kind, receipt, tree node, stale predecessor, fork,
  second terminal state, identity cycle or prepared object from an abandoned
  build fails before IntakeCutoffAttestation.
- `INTAKE-CUTOFF-BOUNDED-01`: increase the cutoff from zero through maximum leaf
  and internal-node boundaries and another tree level. Only bounded
  BoundedInventoryTree nodes and PREPARE_CUTOFF_BATCH count grow. SEAL_PREPARE
  and CUTOFF_FREEZE retain constant locks, rows and bytes and inspect only fixed
  root references, reconciliations, heads, seal and terminal receipt. A flat
  shard list, inline corpus member or maximum-plus-one node is rejected.
- `INTAKE-CUTOFF-CLOSURE-01`: every PREPARE_CUTOFF_BATCH carrier has exactly one
  prepared-payload or named control disposition, and every other cutoff-
  preparation lifecycle carrier has exactly one named control disposition.
  Every fixed kind has every contract-fixed named root slot, including explicit
  empty roots, and both enumerators and control-receipt walkers agree. A control-
  tree builder that advances the preparation head or recursively creates a
  receipt is rejected. Omitting, adding or payload-swapping one ledger,
  governance, dependency, batch or receipt member fails seal, attestation,
  bundle and import parity even when counts remain equal.
- `INTAKE-POLICY-HEAD-RACE-01`: race every cutoff, scope, extraction, candidate,
  import and activation recheck against a processing-policy-head transition.
  The operation either binds the exact prior head and complete permitted chain
  before the CAS, or observes the successor and performs zero stale DML. An
  `ARCHIVE_RESULT_INVALIDATING` transition blocks the serving fence first and
  atomically revokes every affected promotion, readiness and exposure state.
- `INTAKE-CUTOFF-INDEPENDENCE-01`: the ledger and independent cutoff enumerators
  share no code, views, membership table, iteration order or cached output.
  Omitting, adding, reordering or changing one object or payload on either path,
  including while preserving counts, prevents the independence attestation,
  CutoffStateReconciliation and IntakeCutoffAttestation.
- `INTAKE-RECEIPT-LOCALITY-01`: every passing receipt has exactly one
  receipt-local IntakeUniverseManifest and every manifest names exactly one
  receipt. A batch root, cross-receipt member, swapped same-byte member or
  occurrence borrowed from another receipt fails cutoff and trace equality.
- `INTAKE-EXPANSION-TOPOLOGY-01`: NO_CONTAINER and recursively packaged fixtures
  each produce exactly one root SubmissionExpansionManifest. Nested packages
  are complete bottom-up ArchiveAttemptNodes, never nested expansion manifests.
  A child before its dependencies, missing physical record, second root or
  partial failure node set fails the attempt transaction.
- `INTAKE-TRANSITION-TOTALITY-01`: generated IntakeTransitionDefinition tests
  every disposition and action against every prior state. Undefined,
  multiply-defined, self-referential or impermissibly state-restoring
  transitions write nothing; each permitted transition has one deterministic
  successor and exact authority and evidence requirements.
- `INTAKE-HISTORICAL-GOVERNANCE-01`: two independent reference walkers reproduce
  every historical policy, status, review, approval, cache, route, capacity and
  archive payload reachable from the cutoff. Removing or substituting one
  payload, edge or digest fails HistoricalIntakeGovernanceInventory even when
  the selected current heads and source bytes are unchanged.
- `INTAKE-DEPENDENCY-CLOSURE-01`: selected eligibility roots are disjoint from
  the acyclic replacement and exact-duplicate edge sets, and every transitive
  target has the required passing resolution. A self-edge, cycle, unreachable
  edge, omitted dependency, revoked target or equal-count edge reassignment
  blocks the dependency manifest, recheck and release projection.
- `ACTIVE-INTAKE-REVOCATION-ATOMICITY-01`: revoking any receipt, dependency or
  processing policy selected by an active release first acknowledges a higher
  BLOCKED ServingFenceVersion, then in one database transaction revokes
  promotion and readiness and sets exposure off. Fault injection at every
  boundary can leave serving blocked, but never leaves an admitted affected
  release or publishes READY_CANONICAL.
- `NO-INTAKE-SERVING-JOIN-01`: every active serving plan performs zero joins to
  receipt, attempt, resolution, cutoff, governance, dependency or
  ReleaseIntakeDependencyProjection tables. Poisoning those tables cannot alter
  a served legal value; it can only block later certification or trigger the
  separate control-plane revocation path.
- `INTAKE-BLOCK-RETRY-PASS-01`: retain a blocking attempt and resolution, append
  a later independently reconciled pass, preserve the complete predecessor
  chain and freeze only the later cutoff selecting that pass.
- `INTAKE-BLOCK-REJECT-01`: reviewed rejection passes only for a closed permitted
  reason with exact evidence, independent evaluator, eligible review, Ben
  approval and frozen-pair authorisation. A corrupt replacement or resource
  limit alone fails rejection.
- `INTAKE-OUT-OF-SCOPE-01`: positive intrinsic or authenticated programme-scope
  evidence may pass. Unreadability, phrase absence, no deal match, limit breach
  or worker judgement emits or retains a blocking resolution.
- `INTAKE-RESOLUTION-CAS-01`: stale attempt or resolution predecessor, duplicate
  ordinal, fork and concurrent resolver cause one CAS winner and zero canonical
  rows from every loser.
- `INTAKE-ELIGIBLE-REVOCATION-01`: PASS or reviewed eligibility can change only
  through REVOKED_BLOCKING. The old cutoff remains auditable, but every later
  scope, candidate, certification, import and activation recheck fails until a
  new eligible chain and cutoff exist. An active affected release becomes
  exposure-off. Revoking a replacement or exact-duplicate target PASS also
  invalidates every receipt whose eligibility depends on it.
- `INTAKE-REACQUISITION-01`: exact replay preserves receipt identity. Changed
  bytes require a new receipt and ReceiptReplacementLink; unproven authority or
  complete-content equivalence leaves the original blocking.
- `INTAKE-REPLACEMENT-CUTOFF-01`: replacement outside the cutoff, a non-passing
  replacement, omitted prior receipt, missing unique-byte proof or later
  revocation of the replacement fails eligibility.
- `ARCHIVE-ZIP-BOMB-01`: aggregate and per-member expansion limits abort
  streaming before excess allocation, retain bounded proof and consume no more
  than the fleet admission budget.
- `INTAKE-CAPACITY-01`: the fleet-wide reader limit passes at its exact maximum;
  maximum plus one is rejected before parser start with no database head lock,
  no partial attempt and no immediate retry. Aggregate memory, CPU, temporary
  disk and subprocess counters remain within CapacityManifest.
- `ARCHIVE-DEPTH-01`: maximum recursion passes; maximum plus one blocks with a
  bottom-up ArchiveAttemptNode proof and no partial source admission.
- `ARCHIVE-POLICY-01`: a policy change preserves the historical attempt under
  its original policy. `INTAKE_EQUIVALENT` and `DRAIN_COMPATIBLE` transitions
  follow their generated rules; an `ARCHIVE_RESULT_INVALIDATING` change requires
  a successor attempt for every selected PASS and the serving-fence containment
  above. Historical policy difference alone does not poison the cutoff, but a
  currently invalidating transition cannot be ignored.
- `INTAKE-CUTOFF-RESOLUTION-RACE-01`: a resolution append before cutoff is the
  selected latest head; an append after cutoff receives a higher generation.
  CUTOFF_FREEZE never appends an event or advances either head.
- `INTAKE-FAILURE-PRESERVATION-01`: candidate export and production import
  reproduce every failed attempt, resolution, policy, bounded diagnostic digest,
  chain edge, head and event membership exactly.
- `INTAKE-CUTOFF-CYCLE-01`: reject any construction in which cutoff hashes a
  ledger event that names that same cutoff. Its operation receipt remains
  outside the selected event prefix.
- `PACKAGE-EXPANSION-INDEPENDENCE-01`: reject any direct or transitive shared
  parser or decompressor dependency, raw-byte gap or overlap, ignored padding or
  trailer, local-versus-directory disagreement, duplicate path, decompression
  mismatch, encrypted, truncated, unsupported or ambiguous record. A governed
  malformed-but-readable fixture passes only when both readers and the third
  raw-container enumerator independently reproduce the anomaly, physical
  record, exact byte partition and recovered member bytes. Two nested package
  levels must expand fully; preserving counts while omitting one member or
  physical record fails.
- `DEAL-DOCUMENT-ORDINAL-01`: reversed insertion, enumeration and worker order
  reproduce identical independent and ordinary rows. Swapping two same-role
  schedule or version ordinals while preserving membership and counts, omitting
  one comparator field, changing a role or version rank, using runtime order,
  importing the other builder or creating a conflicting duplicate key fails
  field-by-field reconciliation. Changing the ordering definition, verification
  or admission identity or comparator input rekeys both manifests,
  reconciliation and downstream scope.
- `SOURCE-FIDELITY-01`: primary conversion drops or reorders one page, footnote,
  table cell or visible tracked change, changes one word, number or punctuation
  mark, shifts a source map or falsely reports zero loss. The independent
  decoder, render or OCR inventory remains unchanged, verification blocks
  `VERIFIED` admission and no semantic path starts. A corrected canonical text
  rekeys verification and every dependant.
- `FREEZE-ATTESTATION-01`: a missing, conditional, stale or ineligible review or
  Ben approval blocks `candidate_scope_and_extraction`. The architecture,
  legal-semantic, query-efficiency, open-world and release-propagation lanes must
  each PASS over the byte-identical post-check specification root, the legal lane
  must use Fable or an independent 5.6 Sol reviewer using extra-high reasoning,
  with immutable provider evidence for the exact model ID or build, provider
  reasoning value, session, review, input, prompt, output, before-and-after root
  and empty edit set, and Ben's
  approval must foreign-key that exact review set. One missing lane, advisory-
  only substitution, before/after digest mismatch, intervening edit or approval
  of another digest keeps both G0 gates open. Changing one bundle byte,
  independent semantic-question catalogue byte or complete question-rule field,
  its authorship or input-access proof, SemanticQuestionCatalogueReconciliation,
  semantic-diff digest, generated-output digest, reviewer eligibility proof, Ben
  taxonomy decision or approval-evidence ID invalidates the attestation and every
  scope, selection, release and certification dependant. Same-bundle reapproval
  preserves immutable source, span and semantic-occurrence identities but
  changes the frozen pair and every IntakeCutoffAttestation, question
  disposition, expectation, challenge, composition, closure, selection and
  later artefact.
- `FREEZE-INFLIGHT-01`: a candidate job starts with the current frozen pair,
  status digest and generation while a supersession races it. If the writer
  locks first, it may commit only under the old pair and the later candidate
  cannot select that output; if the signed row swap commits first, dispatcher or
  writer rejects the stale envelope with zero writes. No old-generation commit
  may occur after the swap linearisation point, and a passing status for another
  pair or generation never authorises the request.
- `CUTOVER-STATUS-TOPOLOGY-01`: construct the exact acyclic sequence
  pre-authorisation status and `CUTOVER_READY` mirror, CutoverAuthorisation,
  successor status citing that authorisation, `ACTIVATION_READY` mirror and
  ActivationEvent. No object hashes a future digest. A successor that changes
  any field beyond the exact gate evidence, status generation, predecessor and
  readiness state, or that omits the authorisation ID, cannot activate.
  Construct each DeploymentChangeIntent only after its current readiness and
  each successor `REVOKED` row only after that intent; publishing a revoking
  status before the row swap fails.
- `CHALLENGE-PARTITION-01`: removing, duplicating, replacing or impermissibly
  reordering one admitted atom, coverage cell, challenge entry or disposition
  fails the complete partition proof even when all counts and visible labels are
  preserved. Changing ordinary discovery or ClaimScopeDefinition leaves the
  PotentialDependencyUniverse and challenger input bytes unchanged.
- `PAIR-NEUTRAL-MEMBERSHIP-01`: issue a new eligible freeze attestation and
  review evidence for identical source membership and verified bytes. Governed
  role, open-world disposition, taxonomy promotion, admission comparator,
  ordinal and evidence may all rekey, while both
  PairNeutralDealDocumentProjectionRoots, their reconciliation,
  PotentialDependencyUniverse and challenger input remain byte-identical.
  Changing source membership, source version, verified text, structure or the
  source-only neutral order rekeys the neutral roots. Including a governed deal
  role, role priority, open-world marker, candidate content, admission
  comparator or ordinal, disposition, reviewer, approval, correction, frozen-
  pair or executable ID in either neutral projection fails.
- `CHALLENGE-INPUT-01`: the challenger receives the exact minimal canonical
  bundle-object bytes and verified digests through its own parser. Importing an
  ordinary generated semantic package, question or applicability predicate,
  expectation, default, alias, shared rule implementation or generated fixture
  fails the transitive dependency firewall; changing one input byte changes the
  challenge identity. Catalogue-blind dimension discovery importing either
  catalogue, definition path or catalogue-derived negative-cue rule, or
  observing and branching on the bundle fingerprint, freeze digest or review
  result, also fails.
- `SEMANTIC-QUESTION-UNIVERSE-01`: independently remove or alter one qualifier,
  exception, trigger, proposition, effect, applicability AST, witness rule,
  absence proof, evidence scope, target rule, cardinality or ordinal on either
  authored path. Catalogue reconciliation fails before freeze. At source scope,
  omit or move one equal-count question between base subjects and exact
  `Q_independent = Q_ordinary` fails before applicability. Importing one shared
  predicate implementation fails even if both outputs match. A valid reviewed
  question change rekeys catalogue reconciliation, freeze, question universes,
  dispositions, slots, closure, scope, candidate, import and certification.
- `SEMANTIC-STAGE-REGISTRY-01`: an unknown or duplicate stage, undeclared input
  role, role-order change, source-binding change, output- or comparison-schema
  change, stripping-rule change or maximum-plus-one cardinality fails before
  semantic execution. A valid stage-contract change rekeys its input envelopes,
  inner semantic objects, reconciliations and downstream governed dependants.
- `SEMANTIC-ENVELOPE-ALLOWLIST-01`: for every registered stage and path, the
  generated envelope contains exactly the declared ordered roles, byte digests,
  primitive schemas, output schema and bounds. Adding, omitting, retyping or
  rebinding one role, or supplying an unregistered neutral projection, fails
  before worker start and creates no payload.
- `SEMANTIC-ENVELOPE-FIREWALL-01`: undeclared repository, database, environment,
  network, cache, object-store or session access, or direct or prompt-, config-
  or dependency-transitive access to another path, freeze, review, expectation
  or candidate answer, produces zero governed writes. The recorded information-
  flow proof must detect the prohibited byte even when output happens to match.
- `SEMANTIC-REVIEW-ORDER-01`: a review before its completed payload, a worker
  reading its own review, a reviewer using prior-session or cross-path state or
  an attester changing the semantic bytes fails. Only a self-contained eligible
  review of the exact completed payload may precede a passing attestation and
  governed wrapper.
- `SEMANTIC-ATTESTER-NONTRANSFORM-01`: for every semantic stage, ask the
  non-semantic attester to add, delete, reorder, map or classify one field. It
  must fail and create no governed object. Metadata-only changes preserve the
  complete inner chain and rekey only review, attestation and governed layers.
- `SEMANTIC-RECONCILER-01`: both complete SemanticStageOutputSetRoots are
  required before comparison. Missing, extra or duplicate root members,
  comparison fields, key-universe members or bounds fail. The reconciler cannot
  repair, alias, map, default or choose an answer, and receives no path or audit
  metadata.
- `SEMANTIC-RECONCILER-SYMMETRY-01`: reverse completion and arrival order while
  preserving the registry-fixed left and right body order. Input-envelope,
  reconciliation and neutral-projection identities remain identical. Swapping
  canonical left and right roles, leaking path labels or changing comparison
  order fails the stage contract.
- `SEMANTIC-STAGE-ORDER-01`: every path and reconciler is constructed in exact
  envelope, payload and semantic-object, review, passing attestation, governed
  wrapper, mapping, output-root and neutral-projection-root order. A forward
  reference or cherry-picked passing subset fails before persistence.
- `SEMANTIC-METADATA-NONINTERFERENCE-01`: vary executable, model, prompt,
  configuration, sandbox, reviewer, authority and run metadata independently
  while holding semantic input and output bytes fixed. All inner identities and
  neutral bytes remain fixed; the applicable outer identities rekey. Any worker
  control-flow or output change proves prohibited interference and blocks.
  A source-inference model or prompt change necessarily rekeys its
  SemanticInferenceTranscript; it may leave a graph fixed only when the exact
  independently reviewed payload and normaliser inputs remain unchanged.
- `REL-EFFECT-UNIVERSE-01`: remove or alter each field key, canonical type,
  cardinality, applicability AST, canonicalisation rule, constraint operator,
  evidence role, endpoint rule or state-proof rule in turn. Catalogue
  reconciliation or RelationshipEffectFieldUniverseSetRoot completeness fails;
  exact maximum passes and maximum plus one blocks before freeze. Substituting
  an internally complete specialised root whose ordered member projection is not
  byte-equal to its named producing SemanticStageOutputSetRoot fails even when
  counts match.
- `REL-EFFECT-STATE-MATRIX-01`: for every accepted terminal state and field,
  delete, duplicate, add, reorder or change its EXACT, NOT_APPLICABLE or
  BLOCKING_UNRESOLVED branch. The applicable constraint set root and `R = E`
  fail. Every permitted non-PRESENT state has a complete no-effect row and
  PRESENT cannot use NOT_APPLICABLE without its exact predicate proof.
  An internally complete path-specific constraint root whose ordered member
  projection differs from its named producing SemanticStageOutputSetRoot also
  fails even when cardinality is unchanged.
- `REL-CONSTRAINT-NEUTRAL-KEY-01`: swap two same-count parties, repeated
  definition uses, effect slots or ordinals while preserving the global value
  multiset. The neutral-key and per-root equality proofs fail. No ordinary
  object, path, reviewer or candidate ID may enter the neutral key.
- `REL-CONSTRAINT-BRINGDOWN-01`: independently mutate each QXO bring-down tier,
  materiality scrape, diminishing-inaccuracy limb, date, condition party,
  endpoint, operation or evidence interval. The exact constraint field and
  downstream relationship reconciliation fail even when display text is
  unchanged.
- `REL-CONSTRAINT-DEFINITION-01`: a nested or multiply used definition keeps one
  definition occurrence and separately keyed use constraints. Omitting one use,
  transferring an inner definition's effect to its container or swapping
  precedence or affected targets fails the state-by-field comparison.
- `REL-CONSTRAINT-FEE-01`: seller-side and buyer-side fee, payor, payee or right
  holder, trigger, tail, remedy, denominator basis and party are independent
  fields. Swapping any one or retaining only the dollar amount fails constraint,
  lineage, observation and query certification.
- `REL-CONSTRAINT-NONPRESENT-01`: exercise every permitted non-PRESENT state for
  a relationship. It must carry the exact state proof, zero asserted operation,
  target, value or propagated effect and one NOT_APPLICABLE no-effect entry for
  every universe field; omission or a leaked PRESENT value blocks.
- `CANDIDATE-ACTUAL-FIREWALL-01`: either candidate worker reading a full
  RelationshipRevision, candidate output, constraint, expectation, K or D
  payload, path ID, reconciliation or review metadata fails. Removing or
  changing one field from either stripped projection or its projection
  attestation also fails its A root and final reconciliation.
- `CANDIDATE-ACTUAL-STRIPPING-01`: each deterministic stripper is lossless over
  every permitted neutral field and removes every forbidden expectation,
  constraint, K/D, frozen-pair, path, execution and review identifier. A missing
  source object, many-to-one source mapping, extra projected row or retained
  forbidden field fails the named projection attestation and writes no A root.
- `REL-EFFECT-PROPAGATION-01`: a valid semantic effect-field change rekeys the
  RelationshipEffectFieldUniverse semantic and governed IDs, producing generic
  root, RelationshipEffectFieldUniverseSetRoot, ContractFreezeAttestation, both
  constraint paths and set roots and every downstream scope, candidate and
  release dependant. A source-specific expected value or evidence change
  preserves the universe and freeze but rekeys the affected path constraint and
  root, relationship reconciliation, expectation, closure and downstream
  dependants. A candidate selected-state or actual-effect change preserves the
  universe and expected constraints but rekeys CandidateRelationshipActualProjection,
  CandidateRelationshipProjectionAttestation, candidate envelope, payload,
  stage root and reconciliation, selected revision, lineage, serving row, query
  projection and release. A metadata-only change preserves all applicable inner
  semantic IDs and values while rekeying only review, attestation, governed and
  certification layers.
- `SERVING-EFFECT-PROJECTION-01`: a missing, stale or wrong field-universe ID or
  version, serving-disposition digest, selected-state projection digest or
  materialised candidate value fails before cache insertion or query execution.
  Any attempt to repair it from a constraint, expectation, reconciliation or
  candidate audit payload is denied by the exact offline-artefact denylist.
- `FIELD-UNIVERSE-SERVING-01`: every field-universe member has exactly one
  ResultDefinition disposition and the generated serving schema carries its
  exact universe ID, selected-state projection and disposition digests. Missing,
  duplicate, QUERY_ONLY-as-inline or NOT_RESULT_RELEVANT-as-queryable fields fail
  schema generation and release certification.
- `SEMANTIC-OPEN-WORLD-01`: add source text expressing a previously unknown
  legal proposition, qualifier, exception, trigger or effect while both
  catalogues omit it. Catalogue-blind discovery emits a stable
  OpenWorldSemanticCandidate and retains every supportable primitive without
  inventing a canonical key. Omitting, relabelling, coercing or negatively
  disposing the cue, or making discovery catalogue-aware, fails its total atom
  partition and input firewall. `W_open = PASS` requires one terminal occurrence,
  one final disposition and one reconciled impact closure, not an empty source-
  specific partition. A shared definition cue used by three operative
  provisions retains all three dependency edges without duplicating the cue;
  omitting or collapsing any edge fails even when counts are preserved.
- `OPEN-WORLD-REP-ATTRIBUTE-01`: place a previously unseen substantive
  attribute inside an otherwise known representation with familiar knowledge
  and materiality primitives. The attribute becomes
  `ATTRIBUTE_OR_QUESTION`; the primitives remain source-backed, but the rep
  cannot be certified complete or comparable until the impact closure is
  discharged. The system refuses to force it into the nearest existing
  attribute.
- `OPEN-WORLD-RELATIONSHIP-01`: connect two known provisions through a novel
  exception or legal effect. The source-backed
  `RELATIONSHIP_OR_EFFECT` candidate preserves endpoints, operation,
  precedence, condition and evidence. If the edge changes a known result, that
  result is incomplete or blocked and zero familiar-component-only market row
  may publish.
- `OPEN-WORLD-PARTY-01`: add an operative obligation for a novel legal role.
  The observed token and source evidence produce `PARTY_OR_LEGAL_ROLE`; no
  Buyer, Seller or Target key is inferred. Only the affected closure is
  incomplete or blocked, while independently complete provisions still render.
- `OPEN-WORLD-BASIS-01`: supply a fee denominator or duration day-count basis
  absent from the frozen contract. Raw amount or duration and all familiar
  primitives remain visible, but no percentage, converted duration, compatible
  cohort or statistic publishes until the basis is governed and the full
  applicability universe is re-examined.
- `OPEN-WORLD-COMPOSITION-01`: make a lawyer-facing result require a combination
  of otherwise recognised spans that no frozen ResultDefinition permits. A
  `RESULT_COMPOSITION` candidate retains all components and relationships but
  cannot manufacture the registered result, silently drop a span or publish the
  familiar subset as complete.
- `OPEN-WORLD-SOURCE-ROLE-01`: admit a relevant support agreement, voting
  agreement, side letter, amendment, exhibit or schedule whose role is unknown.
  It remains in the deal under `OPEN_WORLD_ROLE_UNMAPPED`, creates a
  `SOURCE_OR_DOCUMENT_ROLE` candidate and blocks only dependent results. Its
  directly reviewed pre-admission occurrence and disposition authorise the
  document-membership decision; after DealAdmissionManifest, exactly one
  admitted occurrence and mechanically rekeyed evidence and primitive body
  precede exactly one OpenWorldCandidateAdmissionTransition and a carried-
  forward disposition with a byte-identical legal-semantic body. The audit root retains both
  occurrences and the historical disposition, the effective root selects only
  the admitted occurrence, and output closure proves exactly one admitted
  `REVIEWED_SOURCE_SPECIFIC` row and zero pre-admission rows. Omitting,
  duplicating or cross-wiring the transition, changing the carried-forward
  disposition body, selecting the predecessor as effective or rendering rows for
  both variants fails scope, release and import parity. Rejecting the role cue
  cannot delete or mark the document out of scope.
- `SOURCE-ROLE-ADMISSION-TOPOLOGY-01`: require the exact order
  SourceAdmissionPreparationReceipt, source-role candidate, pre-admission
  occurrence, predecessor evidence and primitive collection, direct reviewed
  disposition, IndependentDealDocumentManifest, DealAdmissionManifest, admitted
  occurrence, rekeyed evidence and primitive collection, transition and carried
  disposition. Reverse one edge, omit one body, hash the later carried
  disposition into the transition, build impact or applicability from the
  predecessor, or render or serve it. The cycle, topology, carrier and release
  validators fail before scope selection.
- `OPEN-WORLD-MULTIPLICITY-01`: provide several valid fees, periods, standards,
  exceptions or party-specific variants. The complete ordered collection and
  governed ordinals survive extraction, release, import and rendering. First,
  majority, minimum, maximum or apparent-primary selection without an express
  frozen rule fails certification.
- `OPEN-WORLD-ISOLATED-01`: a genuinely isolated proposition receives
  `REVIEWED_SOURCE_SPECIFIC` and `ISOLATED_SOURCE_SPECIFIC`, produces one
  release-certified Review row with explicit non-comparability and evidence,
  and produces no canonical concept, market observation, cohort member or
  generic “No market data” state.
- `OPEN-WORLD-IMPACT-ESCAPE-01`: label a novel exception, relationship, party,
  attribute or source document source-specific while it can change a known
  result. Both impact walkers must reach that result. A claimed isolated tier,
  a complete familiar-component row or a market observation fails closure and
  candidate sealing.
- `OPEN-WORLD-ADOPTION-NOT-EXAMINED-01`: adopt a new concept, attribute,
  relationship, role or basis in a successor bundle. Every earlier eligible
  member lacking examination under that version is `NOT_EXAMINED`, never
  `ABSENT`; the affected result is incomplete and not certified while unrelated
  results remain eligible.
- `OPEN-WORLD-PREVALENCE-BLOCK-01`: omit one eligible member, local entry, slice,
  ScopeSubjectApplicabilityRoot or transitive dependency from the two applicability enumerators. The manifest
  cannot reach `COMPLETE_EXAMINED`, and prevalence, denominator, market range,
  absence statistic, aggregate and cache population for that item are all
  blocked.
- `APPLICABILITY-BUNDLE-GENERATION-01`: compile the same authored bundle input
  twice and require byte-identical CanonicalBundleInputIdentity,
  ApplicabilityEligibleMemberKindProducerRegistry/V3, its singular aggregate
  scope-subject-root contract, complete
  ApplicabilityReexaminationRequirementDefinition set,
  ApplicabilityReexaminationRequirementSetRoot, generated-output manifest and
  bundle fingerprint in that order. Add, omit, duplicate or mutate a member-
  kind producer, aggregate-root contract or requirement definition; introduce a wildcard; or insert a
  final fingerprint, frozen pair, candidate or CorpusRelease back-reference.
  Compilation fails before ContractFreezeAttestation and creates no post-freeze
  requirement instance.
- `APPLICABILITY-FAMILY-PRODUCER-01`: for an affected family, only
  `DEAL_EXTRACTION_RUN/FAMILY_BUILD` creates the exact local
  ApplicabilityReexaminationEntries and complete family Slices before its family
  set and manifest, with exact FamilyBuildReceipt lineage. Omit, add, duplicate
  or mutate an entry, slice,
  requirement, transition selection or receipt binding and family finalisation,
  carry-forward, candidate sealing and import fail. A later candidate action
  cannot repair the family output.
- `APPLICABILITY-ELIGIBLE-PRODUCER-REGISTRY-01`: enumerate every frozen
  eligible-member kind and require exactly one registry entry. Scope/source-
  admission kinds can originate Entries and Slices only in MATERIALISE_SCOPE
  under the mechanically derived `MULTI_SUBJECT_CORRECTION` discriminator if
  the reconciled slice contains a membership or source-admission transition
  requiring fixed-point rebuilding, regardless of cardinality, or the complete
  component contains more than one subject. `SINGLE_SUBJECT` is permitted only
  for an exactly one-subject component with no such transition. Deal-family
  kinds originate only in FAMILY_BUILD/MATERIALISE. A correction replaces each
  affected Entry and Slice under the successor scope generation. A fixture with
  at least two applicable scope/source-admission member kinds must produce one
  aggregate root over the complete contract-ordered entry set, never one root
  per kind or a representative-kind root. Every subject
  DealScopeRunReceipt binds its exact discriminator and
  `ScopeSubjectApplicabilityRoot`, while
  `MULTI_SUBJECT_SCOPE_CORRECTION_RECEIPT/V2` binds
  the complete ordered subject-receipt and applicability-root set. An unknown kind, duplicate
  mapping, wrong action or discriminator, mixed-producer slice, object written
  by CORRECTION_APPLY or generic scope/extraction authority performs zero
  canonical DML.
- `APPLICABILITY-RELEASE-ORDER-01`: require all scope-opened requirement
  instances, registry-owned local Entries and Slices and every complete
  ScopeSubjectApplicabilityRoot inside both terminal
  CorpusRelease input root sets and their reconciliation, then both global
  applicability roots, their independence attestation, named reconciliation,
  manifest, every MetricApplicabilityRequirementProjection entry, terminal set,
  materialisation-time intake recheck, CandidateInputSeal and CorpusRelease in
  that exact universal order. Reverse or omit one edge, instantiate a
  requirement after either sealed root, omit, mutate or reverse the order of a
  subject root or one of its registry-entry bindings, let candidate preparation
  originate or repair a local object, or let a global enumerator read an unsealed local table,
  and topology plus sealing fail.
- `APPLICABILITY-PRODUCER-EXCLUSIVITY-01`: for every generated eligible-member
  kind, race its registry-assigned MATERIALISE_SCOPE discriminator or
  FAMILY_BUILD producer against candidate preparation, CORRECTION_APPLY and
  direct DML. Race aggregate-root creation across both MATERIALISE_SCOPE
  discriminators, carry-forward, candidate preparation, CORRECTION_APPLY and
  direct DML. Exactly the assigned per-kind producer may create each Entry and
  complete Slice, and only the mechanically derived MATERIALISE_SCOPE dispatch
  may win the single aggregate subject-root slot, before the sealed input roots;
  a correction replacement is valid only
  through MATERIALISE_SCOPE with the mechanically correct discriminator and
  exact predecessor and receipt lineage, and all later stages can only select it. A shared producer,
  mixed-producer slice, duplicate creation slot or successful late repair fails
  authority, lock, root and receipt reconciliation.
- `APPLICABILITY-SUBJECT-ROOT-01`: build a governed subject with multiple
  applicable scope/source-admission member kinds. Omit, add, duplicate,
  cross-wire, reorder or mutate one registry-entry binding or Entry/Slice
  member; use only one representative entry; create one root per kind or two
  aggregate roots; or switch the derived discriminator. Every case fails before
  subject-manifest or receipt DML. Only one root over the complete ordered
  applicable entry set passes.
- `APPLICABILITY-RECONCILIATION-PRODUCER-01`: only the closed
  `TERMINAL_RECONCILIATION` dispatch may write the named
  ApplicabilityReexaminationReconciliation after both independent roots and
  before the manifest. Direct insertion, one enumerator, self-reference,
  mismatched universe, a manifest-first order or another carrier/action fails.
- `APPLICABILITY-METRIC-INTERSECTION-01`: two unrelated expansion requirements
  affect disjoint metrics. `NOT_EXAMINED` under requirement A blocks only slots
  whose post-freeze MetricApplicabilityRequirementProjection includes A; fully
  examined B slots remain eligible. ResultDefinition and MetricDefinition bytes
  remain independent of both requirement IDs. An omitted intersecting
  requirement, invented empty set, swapped projection or set digest, manifest-
  wide gate or unrelated global block fails certification.
- `SOURCE-SPECIFIC-METRIC-BOUNDARY-01`: a reviewed-source-specific occurrence
  produces exactly one Review row and ReviewedSourceSpecificOutputClosure, but
  zero metric-slot bases, projection entries, metric slots, observations and
  MarketMetricSlotExclusions. Adding any one, or using an exclusion as the proof
  of zero observations, fails candidate sealing and independent import parity.
- `SOURCE-SPECIFIC-CLOSURE-ACYCLIC-01`: independently enumerate the effective-
  terminal reviewed-source-specific occurrence set and candidate row set, then
  close and reconcile both complete CandidateOutputInventoryRootSets, then build
  one direct ReviewedSourceSpecificOutputClosure that binds both root-set IDs,
  payload digests and their reconciliation before CandidateOutputSeal selects
  it. The closure is outside both roots and neither root depends on it. Graph
  inspection proves the closure depends on neither metric-slot basis,
  MarketMetricSlotExclusion, aggregate, CandidateOutputSeal,
  CandidateReleaseManifest nor trace extension. Replacing direct selection with
  zero-observation inference, omitting either root binding, adding any forbidden
  or reverse edge or selecting a stale row fails closure and candidate sealing
  while unrelated canonical rows remain releasable.
- `OPEN-WORLD-RELEASE-IMMUTABILITY-01`: promote a candidate into a later
  CanonicalContractBundle, re-examine its complete governed universe and publish
  a later CorpusRelease. The prior bundle, candidate disposition, examination
  states, serving rows and cohort membership remain byte-identical and
  addressable; no in-place mutation or backfilled absence is permitted.
- `SOURCE-PACKAGE-DIGEST-01`: preserve the exact original package bytes, file
  type, length, SHA-256 and converter provenance. A one-byte package change,
  substituted derivative, altered source map or digest mismatch changes source
  identity or blocks validation even when extracted plain text is identical.
- `SEMANTIC-EXTRACTION-DRY-RUN-01`: invoke the pure extractor with an immutable
  source occurrence, passing SourceAdmissionPreparationReceipt, frozen contract
  and exact ReviewedInferencePayload but no CorpusRelease, corpus credential or
  publication state. The deterministic normaliser returns a validated source-
  local graph and performs zero corpus DML, release selection, market lookup,
  model invocation or active-pointer read.
- `CANONICAL-WRITER-AUTHORITY-01`: attempt corpus DML from the extractor, dry-
  run role, reviewer, similarity process, UI, application table grant or direct
  SQL path. Every attempt is denied. Only the declared canonical writer action
  may select revalidated graph content into scope, candidate and release
  carriers.
- `SEMANTIC-GRAPH-PARITY-01`: corpus and non-publishing runs over the same exact
  SemanticExtractionInputEnvelope, ReviewedInferencePayload and
  SemanticGraphNormaliserDefinition produce byte-identical source-local graph
  nodes, edges, provisional slots, primitives and validation report. Corpus-
  level claim state, governed party, completeness and comparability are then
  derived only after admission and scope, never smuggled into either graph.
- `SEMANTIC-INFERENCE-BOUNDARY-01`: run two independent model calls over the same
  envelope and permit different transcript bytes. Neither transcript is compared
  for byte parity or becomes a legal fact. Every semantic disagreement remains
  in the ReviewedInferencePayload adjudication inventory. Mutating one selected
  transcript byte, reviewed byte, source-evidence mapping, residual, reviewer
  disposition or normaliser definition rekeys the payload or graph and cannot be
  hidden by a matching final display value.
- `SEMANTIC-INFERENCE-NO-RERUN-01`: deny model, prompt service and inference
  credentials to MATERIALISE_SCOPE, candidate release, bundle and production-
  import roles. Each stage must reproduce the exact transcript-set,
  ReviewedInferencePayload, normaliser-definition and graph lineage selected by
  its predecessor. A model call, freshly inferred equivalent, omitted transcript,
  substituted payload or graph with the right visible rows but wrong lineage
  blocks scope, release, bundle, import or traceability.
- `OPEN-WORLD-SIMILARITY-NO-AUTHORITY-01`: similarity clustering may group the
  candidates above and propose an alias or concept. Varying or deleting its
  output changes no candidate, disposition, impact, serving or market identity;
  an automatic merge, key assignment or comparability decision is rejected.
- `OPEN-WORLD-DISPOSITION-TOTALITY-01`: every terminal occurrence has exactly
  one of the five final dispositions and every historical predecessor has none
  in the effective partition. A transitioned pre-admission source-role
  predecessor retains its exact transition-bound disposition in audit only.
  Missing, duplicate, conflicting, sixth-value,
  forked, merged, cyclic or orphaned chains fail both the independently rebuilt
  effective root and release sealing.
- `RESIDUAL-TOTALITY-01`: seed one residual in every registered producer kind,
  including a validation residual with no open-world candidate. Both independent
  universe roots and their reconciliation must enumerate the same complete set;
  each member receives exactly one of the four final dispositions and one
  reconciled impact closure. Dropping or duplicating a residual, using an
  unregistered carrier, mapping without exact object or candidate lineage,
  asserting zero effect without review evidence, leaving an unresolved impact or
  treating candidate totality as residual totality keeps
  GovernedResidualReviewQueueRoot non-empty and blocks candidate sealing while
  independently valid sibling previews remain renderable.
- `OPEN-WORLD-KIND-SUPERSESSION-01`: an effective-terminal
  `UNRESOLVED_CANDIDATE_KIND` blocks. Resolving it creates a new candidate and
  occurrence plus one exact kind-only supersession; the predecessor remains in
  the audit root but has no current disposition, impact or serving authority.
  In-place rekeying, a payload-changing kind edge, zero or multiple terminals,
  fork, merge, cycle or orphan fails reconciliation and release.
- `OPEN-WORLD-IMPACT-INDEPENDENCE-01`: each impact walker receives the exact
  effective disposition and complete candidate graph but not the other's code,
  rows or output. A co-wrong shared affected set, copied root, disagreement or
  unbounded closure cannot yield an impact disposition or isolated status.
- `OPEN-WORLD-STATUS-AXES-01`: independently permute claim state, result
  completeness and market comparability through every schema-valid combination.
  Renderer, query, cache and aggregate retain all three fields. Any conversion
  to null, false, absence, zero or generic “No market data” fails.
- `OPEN-WORLD-RELEASE-PROPAGATION-01`: delete or alter one candidate, effective-
  chain member, source-role admission transition, evidence primitive,
  disposition, impact, local re-examination
  entry, candidate-wide manifest, SharedServingRow or OPEN_WORLD_EVIDENCE edge.
  Scope, candidate release, bundle and production-import parity identify the
  exact missing or conflicting member and publish nothing.
- `OPEN-WORLD-SERVING-ACCESS-01`: serving and query roles can read only the
  release-certified canonical, incomplete or source-specific row and authorised
  response-safe evidence projection. Raw candidates, graph, review queue,
  disposition review payload, impact audit, re-examination controls and
  similarity proposals remain denied even when an opaque ID is present.
- `OPEN-WORLD-UI-ISOLATION-01`: one deal contains recognised canonical rows, a
  reviewed source-specific row, an affected incomplete result and a lazy detail
  action that throws. Review still mounts the provision navigation and every
  sibling row; Compare, Corpus Context and Query return the affected item only
  as typed selected-deal context and continue returning unrelated market rows.
  The failed row or panel alone shows `ROW_RENDER_FAILED` or
  `DETAIL_UNAVAILABLE`; no page-level crash or blank deal is accepted. A
  separate offline-review fixture contains one unresolved effective candidate
  beside recognised ValidatedSemanticGraph rows. The non-persisting reviewer
  shows a typed `REVIEW_PENDING` unfamiliar-proposition placeholder and every
  recognised sibling, with zero release, serving or market authority; the
  unresolved item cannot crash or suppress that offline view.
- `BLOCKED-PREPUBLICATION-ISOLATION-01`: a target candidate contains recognised
  siblings and one `BLOCKED` result. Authenticated candidate Review renders all
  siblings and a typed `BLOCKED_RESULT_PREVIEW` for only the affected result;
  active Review, Compare, Corpus Context and Query remain on the exact prior
  release. No preview enters a serving root, observation, aggregate, cache or
  bundle. A preview-renderer exception leaves siblings and navigation mounted,
  and attempted candidate freeze fails with zero active-pointer or namespace
  change.
- `BLOCKED-PREVIEW-CONSTRUCTION-01`: two authenticated candidate Review/Admin
  requests over identical ordered inputs produce byte-identical preview IDs,
  payload digests and bytes. Mutating any component, blocker, reason, evidence
  reference or build identity rekeys the preview; missing, duplicate or
  conflicting input produces only the affected row's `ROW_RENDER_FAILED`.
  Database, object-store, cache and outbox instrumentation records zero writes,
  the physical-carrier and candidate-output registries contain no preview kind,
  and serving or query roles cannot invoke the builder. Injecting a preview,
  `FAILED` row or `BLOCKED` row into SharedServingRow, a candidate root, bundle,
  import or release trace fails certification while recognised siblings remain
  rendered.
- `SCOPE-BASE-OMISSION-01`: ordinary discovery omits an entire standalone
  provision, nested or reused definition, party attribution or contract-declared
  claim or effect question and labels its text non-substantive. Independent
  `B_base` or `B_slot` remains unchanged, exact equality with `O_base` or
  `O_slot` fails, and no per-slot closure is allowed to start.
- `SCOPE-COEXISTING-BASE-01`: two non-identical legal mechanisms share the same
  anchor, semantic kind, concept and party. Their distinct source-only
  preclassification keys, raw-cue digests and deterministic ordinals survive in
  both base inventories. Omitting or collapsing either fails `B_base = O_base`
  even when counts are preserved elsewhere; a tied comparator quarantines both.
- `SCOPE-EXCLUDED-BASE-01`: a standalone QXO-style provision, nested definition,
  party cue or effect question exists only in a source-excluded or
  conversion-loss interval. The global exclusion challenge blocks before
  `B_base` or `B_slot` reconciliation; prior exclusion approval and empty
  ordinary discovery cannot make the scope pass.
- `SCOPE-DEAL-ASSESSMENT-01`: the contract declares a whole-deal concept
  assessment for a deal with no qualifying provision span. Both paths emit the
  exact `DEAL_ASSESSMENT` base subject without coordinates, disposition every
  catalogue question and partition every admitted deal atom for each applicable
  slot. The expected occurrence remains in scope and may become `ABSENT` only
  after complete closure and zero-witness proof. Omitting the assessment,
  narrowing it to discovered spans or fabricating an anchor fails reconciliation.
- `SCOPE-QUESTION-APPLICABILITY-01`: mutate an expected materiality, knowledge,
  lookback, exception or relationship-effect question from `APPLICABLE` to
  `INAPPLICABLE` solely because its phrase or witness is absent. The total
  question-disposition maps or eligible review evidence disagree, the expected
  slot remains required and scope freeze fails. Omitting the pair from both
  positive slot inventories cannot pass.
- `QUESTION-DISPOSITION-PROPAGATION-01`: changing only the ordinary or challenge
  evaluator, model, prompt, configuration, reviewer or authority metadata while
  preserving byte-identical permitted semantic inputs and output preserves the
  SemanticComputationInputEnvelope, SemanticComputationPayload,
  semantic-object IDs and NeutralStageProjection bytes and content digest. It
  rekeys the review, NonSemanticPayloadAttestation, governed wrapper, selected
  disposition and governed dependants through certification. A semantic input,
  output, comparison schema, stripping rule or semantic-stage-contract change
  rekeys the inner chain. The implementation-neutral
  `B_question_state = O_question_state` comparison may remain equal but cannot
  suppress governed identity propagation.
- `SCOPE-CHALLENGE-INDEPENDENCE-01`: the ordinary path omits or labels
  non-substantive the only qualifying chapeau, proviso, nested definition,
  cross-reference, schedule or exception. The independent challenge remains
  unchanged and `R = E` fails before closure, so a co-changed claim cannot become
  `ABSENT`.
- `SCOPE-COHERENT-WRONG-01`: discovery, ClaimScopeDefinition, dependency
  expectation, closure and candidate claim are co-mutated to the same wrong
  scope, party, time or accepted state. The literal source-coordinate fixture
  and independent `R` remain unchanged; exact reconciliation fails.
- `REL-COHERENT-WRONG-01`: the ordinary RelationshipSemanticExpectation and
  RelationshipRevision are co-mutated to agree on the wrong endpoint, party,
  capacity, condition, time, precedence, legal operation, target set or evidence
  interval. It also swaps two Target and Buyer or reused-definition slots while
  preserving the global multiset, and substitutes relationship kind,
  RelationshipDefinition or RelationshipEffectSchema with an otherwise similar
  tuple. Per-key reconciliation against the independent required-effect tuple
  remains unchanged and
  `A_pre(c) = E_pre(c) = R_pre(c)` or `A_all = E = R`, as applicable, fails.
- `REL-ABSENT-ZERO-WITNESS-01`: the potential-endpoint coverage is complete but
  contains a present QXO IOC consent override, no-shop exception, definition use
  or termination-fee trigger. Relationship `ABSENT` fails unless the examined
  endpoint universe is exact and the independently frozen proof establishes zero
  qualifying witnesses and zero conflicting revisions.
- `COMPOSITION-COHERENT-WRONG-01`: co-mutate ResultDefinition,
  MetricDefinition, ResultInputLineage builder, generated row schema, projector
  and query compiler to omit or misassign one QXO signing qualifier, bring-down
  tier, no-shop exception, IOC override, termination-fee trigger, fee side,
  percentage denominator, roll-up or refinement dimension. The independently
  authored `K_contract(s)` remains unchanged, so K-to-D or candidate-contract
  equality fails even when rendered rows agree with all ordinary generated
  outputs.
- `COMPOSITION-COVERAGE-01`: every reconciled claim and relationship-effect slot
  and every catalogue metric and query question has exactly one independent
  composition coverage disposition. Removing, duplicating or relabelling one as
  `REVIEWED_NOT_EXPOSED` without exact reason, evidence and eligible review
  blocks scope freeze; component, party, fee-side and metric permutations fail
  per-contextual-key equality.
- `COMPOSITION-SHARD-PARTITION-01`: omission, duplication or reassignment of one
  semantic key between result or observation shards fails the per-deal parent
  reconciliation. A reviewed non-exposure without the reserved shard and exact
  evidence fails. Duplicating the global catalogue per deal, or omitting or
  duplicating one global question, fails singleton parent reconciliation. One
  qualifier or relationship effect reused by several results remains several
  valid contextual use cells, not illegal duplicate ownership.
- `COMPOSITION-SHARD-KDA-01`: co-mutating ordinary definitions and candidate
  contract realisation in one shard leaves its independent K unchanged.
  Omitting, duplicating, flattening or substituting one shard in the candidate
  contract union, or reassigning equal-count contextual keys between shards,
  fails. Adding an unrelated deal
  changes corpus scope, release and relevant aggregate inputs but preserves
  every existing unrelated deal shard and closure and all global semantic shard
  identities.
- `COMPOSITION-CONTRACT-VS-INSTANCE-01`: a contract requires percentage, fee
  side, trigger and lineage while a valid instance supplies 3.5%, Seller side
  and its exact trigger and lineage. Instance conformance passes although the
  value is not byte-equal to the contract body. Co-changing D contract and A
  contract while K remains fixed fails contract equality.
- `COMPOSITION-DISPOSITION-CARDINALITY-01`: `REQUIRED` instances in `PRESENT`,
  accepted `ABSENT` and accepted `NOT_APPLICABLE` states each materialise their
  exact one frozen contextual key; missing, duplicate or extra fails.
  `REVIEWED_NOT_EXPOSED` creates zero expected occurrence and lineage slots.
  Injecting a result, component, lineage, observation, aggregate, serving row,
  generated field or compiled-plan output under that context fails the complete
  anti-join. Relabelling optional as zero cardinality fails.
- `COMPOSITION-CONTEXT-KEY-01`: reuse one owned key under two results, parties,
  deals and metric subjects without collision. Moving one candidate record
  between contexts yields one missing and one extra even when counts match. One
  immutable ClaimRevision, RelationshipRevision, definition field, effect field
  or generated operator may serve several contexts only through the complete
  distinct authorised contextual-use-edge set. Cloning it, collapsing those
  uses into one edge, mapping several source objects to one use key or adding an
  unrequired edge fails.
- `RESULT-LINEAGE-SLOT-01`: omit, duplicate, swap or discharge one
  ExpectedResultInputLineageSlot from a component with at least two input
  entries, or discharge one with the wrong occurrence, revision, state, effect,
  evidence or snapshot, and fail candidate closure. Each entry uses its exact
  lineage-slot ID as a distinct materialisation-use key. Canonical ordering
  reproduces its lineage digest under source and database reorder.
- `COMPOSITION-IMPLEMENTATION-CATALOGUE-01`: from one key-only universe
  containing required and reviewed-not-exposed contexts, independently rebuild
  the candidate catalogue from sealed deployed artefacts and an explicit
  generated negative-materialisation rule. Omitting, duplicating, reassigning
  or fabricating an entry, inferring non-exposure from missing output, or any
  static or dynamic read of K, D, an expected contract body, disposition,
  evidence or another compiler output fails. Mutating only an expected body
  cannot alter the candidate catalogue; mutating the deployed implementation
  artefact must alter it and expose any K/D/A mismatch.
- `COMPOSITION-CONTRACT-SET-ATTESTATION-01`: two implementation-disjoint
  enumerators build separate bounded CompositionContractSetRecompositionRoots
  over the frozen pair, complete contextual keys, equal contract bodies, K/D and
  candidate reconciliation identities and parent partitions. A third
  reconciler verifies their byte-equal neutral member sets, equal common digest,
  empty difference roots and a passing
  CompositionContractSetEnumeratorIndependenceAttestation before creating the
  terminal CompositionContractSetAttestation. Omission, addition, contextual-
  key reassignment, equal-count substitution, copied traversal code, stale
  reconciliation, stale parent digest, root or tree-node substitution, or
  disagreement between enumerators fails CandidateOutputSeal,
  CandidateReleaseManifest, serving materialisation, bundle or production
  import. Changing only a realised value or selected revision preserves both
  recomposition neutral digests and the attested common digest while changing
  instance and payload proofs.
- `RESULT-COMPONENT-REPEATABLE-ID-01`: two components using one definition in
  one result have distinct slot keys or governed ordinals and stable occurrence
  IDs under input reorder. A value or revision change preserves occurrence ID;
  moving slot or result or changing governed ordinal rekeys. An unresolved
  comparator tie quarantines.
- `COMPOSITION-PROPAGATION-01`: a semantic K/D contract change rekeys the
  affected child, shard, root, contract reconciliation,
  ExpectedCompositionContractProjection, closure, occurrence and lineage slots,
  scope, barrier, both CompositionContractSetRecompositionRoot identities,
  CompositionContractSetEnumeratorIndependenceAttestation, terminal
  CompositionContractSetAttestation, conformance and release. A candidate-only instance change
  preserves K/D and scope expectations but rekeys lineage or revision, instance
  projection and attestation, conformance, serving payload and release.
  Governance-only metadata preserves inner semantic bodies and rekeys the
  governed and certification layers.
- `ASSESSMENT-01`: all five states over one frozen ClaimScopeClosure preserve
  assessment occurrence, create exact revisions and reject an asserted stored
  scalar payload on a non-present claim. Complete coverage must equal the
  closure's required-examination interval set and exact discharged dependency
  revisions.
- `SCOPE-CLOSURE-01`: one fixture places the only relevant qualifier, exception
  or applicability fact respectively in a governing chapeau, inline definition,
  definition nested inside another definition, cross-referenced provision,
  proviso and incorporated schedule. Complete examination of the base provision
  alone cannot produce `ABSENT`. Removing each dependency in turn, including
  while preserving counts by adding an irrelevant interval, fails scope freeze
  or candidate closure.
- `SCOPE-CLOSURE-MULTIUSE-01`: one definition governs three operative
  provisions and contains a nested definition. Each ClaimScopeClosure references
  the same exact definition occurrences without copying them, counts each
  structural leaf once and remains identity-stable under input reordering.
  Changing either definition, one use endpoint or precedence rule changes every
  affected closure and no unaffected closure.
- `SCOPE-CLOSURE-STATE-01`: a dependency expectation is tested with one
  permitted `PRESENT` revision, permitted source-backed `NOT_APPLICABLE`,
  `ABSENT`, `NOT_EXAMINED`, `FAILED`, missing and duplicate revisions. Only
  states expressly accepted by ClaimScopeDefinition discharge the slot. No
  partial, failed, missing or conflicting dependency can support `ABSENT`.
  Substituting the wrong expectation ID, party, capacity, temporal scope,
  condition, precedence, legal operation, affected target or evidence scope
  also fails discharge even when the RelationshipRevision is otherwise
  schema-valid.
- `SCOPE-CLOSURE-FREEZE-01`: the closure enumerator reads no candidate claim or
  relationship state. Adding, removing or changing a dependency expectation,
  interval, source admission or exclusion after freeze changes the scope
  manifest and invalidates the candidate. A corpus exclusion can never count as
  examined evidence.
- `WRITER-01`: fault injection after every writer transaction leaves either its
  complete predecessor or complete successor and one correlated canonical
  receipt or registered AttemptAuditTerminal outcome; idempotent replay
  duplicates none. A multi-transaction operation may retain only its already
  complete, receipt-bound subphases, never rows from a partly committed
  subphase. Failure never rolls back an earlier committed receipt, attempt,
  resolution, scope run or corpus barrier. No stage may compensate by
  writing another stage's object types. This includes each
  RELEASE_BUNDLE_CONTROL_BUILD precommit, claim, bounded tree/output and
  finalisation discriminator.
- `WRITER-SCOPE-ACTION-COUNT-01`: the generated operation, action, disposition
  and SQL registries expose exactly five top-level `DEAL_SCOPE_RUN` actions:
  `PREPARE_SOURCE_ADMISSION`, `MATERIALISE_OPEN_WORLD_REVIEW`,
  `RECORD_OPEN_WORLD_DISPOSITIONS`, `MATERIALISE_SCOPE` and
  `CERTIFY_SCOPE_CARRY_FORWARD`. MATERIALISE_SCOPE has exactly the closed
  `SINGLE_SUBJECT` and `MULTI_SUBJECT_CORRECTION` discriminators. Reintroducing
  a standalone multi-subject materialisation action, counting a discriminator as a
  sixth action, omitting either discriminator or permitting another action to
  produce a scope Entry, Slice, ScopeSubjectApplicabilityRoot or receipt fails
  generation before DML.
- `WRITER-SCOPE-BARRIER-01`: any actual occurrence, revision, family set or
  extraction manifest attempted before the exact committed
  CorpusScopeFreezeAttestation performs zero canonical writes. Missing,
  duplicate, cutoff-mismatched or generation-mismatched DealScopeRunReceipts,
  or a receipt whose referenced manifest payload differs, prevent the barrier.
- `WRITER-SCOPE-GENERATION-01`: opening skips no generation and binds one exact
  cutoff, frozen pair and authorisation generation. A mixed-input scope run,
  prepare or freeze fails. An abandoned generation can create no barrier and no
  generation-bound receipt, shard, root or other object from it can enter a
  higher generation. A generation-independent prepared object must be
  independently recomputed byte for byte, and a reusable local
  DealScopeRunManifest may be selected only after
  `CERTIFY_SCOPE_CARRY_FORWARD` proves identical local inputs. Recovery advances
  to a new generation and uses fresh run receipts.
- `WRITER-SCOPE-RACE-01`: race a new or successor DealScopeRun against scope
  freeze. The run commits before the head closes and is exactly included, or is
  rejected into a higher generation. Exact inclusion means its
  DealScopeRunReceipt and referenced DealScopeRunManifest are both present once;
  omission from a frozen root is impossible. A run committed after both prepared
  roots advances CandidateInputHead and makes COMMIT reject those roots without
  a corpus scan under lock; freeze locking first rejects the run with zero
  canonical DML.
- `WRITER-SCOPE-SUBJECT-CAS-01`: two changed requests for one deal or non-deal
  subject and scope-build generation yield one ScopeSubjectHead winner. The
  loser writes no canonical row, and no enumerator or freeze chooses by arrival,
  worker or database order. A changed successor requires a higher generation.
- `WRITER-SOURCE-MEMBERSHIP-RACE-01`: concurrent scope runs assigning one
  cutoff-selected source to different deals cannot both commit; the loser writes
  no canonical rows.
- `MUTABLE-AUTHORITY-CLOSURE-01`: regenerate GlobalMutableAuthorityRegistry from
  every mutable head, controller, readiness mirror, fence, status and publication
  carrier. Each has exactly one authorised operation/action and one stable
  authority-key extractor, and the registry complement against
  CanonicalPhysicalCarrierRegistry is empty. Delete, duplicate, alias or leave
  unclassified one mutable carrier; give two actions authority; or attempt a
  state change through a content-addressed builder or direct DML. Contract
  compilation or the writer fails before any head, event, receipt or outbox
  mutation.
- `LOCK-PAIRWISE-CREATION-SLOT-01`: GeneratedLockPlanRegistry contains every
  authority key, every declared pairwise-exclusion key and every governed
  creation-slot key with one total order. Race two source-to-deal assignments,
  two correction GENESIS_TARGET creations for one slot, creation against
  supersession, candidate freeze against correction, bundle finalise against
  abandonment and activation against revocation. Exactly one complete
  transaction wins or both write nothing. Omitting either member of a pair,
  locking only the existing row for an absent creation target, deriving the slot
  from caller text, taking locks after validation or reversing global order
  fails generated-plan parity and performs zero canonical DML.
- `STAGE-TOPOLOGY-01`: reject any scope object that references extraction output,
  any actual occurrence before the barrier, any family fact written by
  FINALISE_DEAL and any candidate freeze that repairs scope or extraction.
- `EXTRACTION-SCOPE-BINDING-01`: swapping cutoff, eligibility recheck, barrier,
  barrier-selected DealScopeRunReceipt, scope manifest, DealScopeRunManifest,
  scope slice, deal, family, expected slot or authorisation generation performs
  zero writes.
- `CORRECTION-STAGE-01`: a scope-changing correction cannot reuse the old
  barrier. A value-only correction preserves an unchanged expected occurrence
  ID but creates the required new revision, FamilyExtractionManifest,
  DealSnapshot and DealExtractionRunManifest. Misclassifying either direction
  blocks finalisation.
- `CORRECTION-DISCHARGE-01`: apply separate scope corrections to a
  SourceAdmissionManifest, deal-membership member, ClaimScopeClosure and
  ExpectedOccurrenceSlot and a post-scope correction to each permitted revision
  kind. Every target-ref variant resolves exactly, every direct corrected output
  hashes its application and every current selecting manifest has one passing
  discharge per effective active application. Omitting,
  duplicating, swapping or reusing a discharge for another application or
  non-identical output, keeping the same counts while
  naming the wrong output or payload, claiming one output for two applications,
  or selecting a discharge for a currently superseded application fails. The
  corrected output never hashes the later discharge, and a carry-forward passes
  only with byte-identical applicability slices and discharge maps. Application A is
  first discharged into release one, then B supersedes A and release two
  selects only B's discharge. A's immutable historical discharge remains valid
  and traceable to release one but is absent from release two's current map.
- `CORRECTION-GENESIS-01`: every existing-object target-ref variant and one
  permitted GENESIS_TARGET reproduce their exact application IDs. Missing,
  single-enumerator, stale-universe, wrong-subject or false absence proof and a
  genesis request under a non-creation slot perform zero application DML.
- `CORRECTION-APPLICABILITY-01`: independent indexed enumerators derive equal
  complete active application, projection, subject-edge, terminal
  supersession and exact `(correction event, CorrectionApplyReceipt)` sets for
  scope and post-scope fixtures. Omitting an application
  as “irrelevant”, adding an unrelated application, truncating one affected
  subject, splitting an application across slices or exceeding the fixed
  connected-component bound fails before corrected-object DML. The selected
  slice union equals the ledger-to-target universe in both directions. A
  missing, duplicate, cross-stage, wrong-application, wrong-before-or-after-head
  or failed-attempt receipt fails before slicing or candidate release.
- `CORRECTION-MEMBERSHIP-TRANSITION-01`: role-only, one-subject
  source-admission, deal-A-to-deal-B, deal-to-non-deal and non-deal-to-deal
  fixtures rebuild the exact complete applicability component in one
  serialisable MATERIALISE_SCOPE action. The role-only one-subject fixture,
  which changes neither membership nor source admission, must derive
  SINGLE_SUBJECT. The one-subject source-admission fixture and every membership
  or source-admission transition requiring fixed-point rebuilding must derive
  MULTI_SUBJECT_CORRECTION regardless of component cardinality; every other
  component larger than one must also derive MULTI_SUBJECT_CORRECTION. Both old and new
  deal-document and admission paths reconcile, every subject gets one terminal
  manifest, every changed and byte-identical applicable Entry and Slice, exactly
  one complete ScopeSubjectApplicabilityRoot and discriminator-bound
  DealScopeRunReceipt, and one
  `MULTI_SUBJECT_SCOPE_CORRECTION_RECEIPT/V2` binds every subject receipt and
  every ScopeSubjectApplicabilityRoot for every
  `MULTI_SUBJECT_CORRECTION` dispatch,
  including the one-subject fixture. Racing freeze or
  either subject-head CAS yields the complete prior state or complete successor
  state with zero partial writes. Omitting the composite receipt from the scope
  inventory, candidate input, candidate release, release bundle or production
  import fails exact set parity.
- `CORRECTION-GLOBAL-TARGET-01`: a correction targeting any GLOBAL_METRIC_QUERY
  governed object, including its CompositionScopeClosure, ExpectedOccurrenceSlot
  or ExpectedResultInputLineageSlot, is rejected by the
  generated slot registry before Correction DML. The same semantic change can
  proceed only as a reviewed CanonicalContractBundle revision and higher full
  scope generation.
- `CORRECTION-LEDGER-SPLIT-01`: every CorrectionSlotDefinition maps to exactly
  one ledger. A scope event can enter only a later scope run and barrier; a
  post-scope event can enter only a later extraction and family result. A mixed,
  duplicated, downgraded or combined correction root blocks before canonical
  DML, and serving never applies either ledger as an overlay.
- `CORRECTION-CURRENTNESS-RACE-01`: race each scope or post-scope correction-head
  CAS against scope freeze, extraction finalisation, candidate input sealing and
  candidate freeze. The change is fully captured and discharged, or advances
  CandidateInputHead and makes the stale operation fail. No old correction head
  can be blessed because its objects still exist.
- `DEAL-EXTRACTION-LIFECYCLE-01`: exercise OPEN, every bounded FAMILY_BUILD,
  FINALISE_DEAL, FROZEN and ABANDONED transitions. A missing or extra family,
  wrong barrier or correction head, stale transition, second terminal state or
  family output after abandonment fails. FROZEN selects the complete receipts,
  snapshot and run manifest and then advances CandidateInputHead.
- `HEAD-RECEIPT-TOPOLOGY-01`: every ScopeBuild, DealExtractionBuild,
  FamilyBuild and CandidateBuild transition payload and any CandidateInputEvent
  exist before the head CAS, and the head CAS exists before its typed receipt.
  Every candidate output object precedes its batch manifest and append event,
  the event precedes CandidateOutputPreparationHead CAS and the CAS precedes its
  receipt. CandidateOutputSeal precedes the terminal seal event and SEALED head
  CAS, which precede its terminal CandidateOutputPreparationReceipt and then the
  PREPARED transition, CandidateBuildHead CAS and receipt. Every non-genesis
  preparation event has exactly one receipt.
  No immutable payload hashes its later head, event or receipt. Fault injection
  and replay yield one final head tuple and one terminal receipt, never a fork.
- `CANDIDATE-BOUNDED-01`: increasing corpus size may increase only the number of
  bounded CorpusRelease inventory, output and post-manifest projection tree
  nodes and their preparation batches. OPEN, SEAL_INPUT, SEAL_PREPARE, FREEZE,
  each projection `TERMINAL_ROOTS`, `ISSUE_INPUT_RECHECK` and ABANDON have
  constant lock and DML bounds; each batch honours fixed row, byte
  and time limits. Maximum plus one blocks or starts another shard, never widens
  the freeze transaction or truncates inventory. Crash after each batch resumes
  idempotently; expiry abandons the generation and leaves prepared shards
  inaccessible to every later generation.
- `CANDIDATE-RELEASE-ORDER-01`: both sealed release-inventory root sets and
  their reconciliation, including every already scope-opened requirement
  instance and registry-owned local Entry and Slice, precede both applicability
  roots. Those roots precede independence, named reconciliation, manifest,
  every metric-projection entry, terminal set, the materialisation-time intake
  recheck, CandidateInputSeal and CorpusRelease in that exact order;
  CorpusRelease precedes every CorpusRelease-keyed mapping, result row, child row,
  observation, aggregate, exact-detail object and ServingContractMetadata;
  CandidateOutputSeal and CandidateReleaseManifest follow all of them. Cycle
  lint rejects every reverse dependency, and FREEZE cannot create, replace or
  mutate a requirement instance, local Entry or Slice or CorpusRelease.
- `CANDIDATE-OUTPUT-CLOSURE-01`: deleting, adding, renaming or duplicating one
  CandidateOutputKindRegistry entry or physical carrier, omitting an empty kind,
  omitting a required singleton or changing one stable-key or payload-digest
  extractor fails contract freeze or both root-set equality. CandidateOutputSeal,
  CandidateReleaseManifest, bundle and import contain the same exact fixed kind
  universe and neutral root-set content digest. Every output-preparation
  expected-key derivation proves one canonical or incomplete row per selected
  DerivedResultRevision, one source-specific row per effective admitted
  occurrence with that disposition, exactly one such row per transitioned
  source-role candidate and zero rows for its pre-admission occurrence, complete
  direct ReviewedSourceSpecificOutputClosure membership, with that closure
  outside both output roots but binding both completed root sets and their
  reconciliation and carrying no metric-partition dependency,
  OPEN_WORLD_EVIDENCE edges, zero observations for
  source-specific and incomplete rows, and an observation if and only if its
  metric owner is `COMPLETE` and `COMPARABLE` and every exact intersecting
  applicability requirement is `COMPLETE_EXAMINED`; every remaining canonical
  metric slot has exactly one `MarketMetricSlotExclusion`. Every output-preparation
  lifecycle write carrier has exactly one INVENTORIED_OUTPUT or named CONTROL_ARTEFACT
  disposition; overlap, omission or an invented control class fails.
- `CANDIDATE-PROJECTION-WRITER-01`: after candidate freeze, build the object and
  blob projections through empty, one-row, exact-boundary and maximum-plus-one
  batches. Only
  `BUILD_CANDIDATE_RELEASE_PROJECTION/{TREE_BATCH|TERMINAL_ROOTS}` may write
  their registered nodes and roots, and neither phase advances a lifecycle
  head. Direct DML, a pre-FROZEN invocation, a stale CandidateInputHead or
  promotion fence, wrong manifest, phase, carrier or projection definition,
  an omitted or extra object or blob and a conflicting terminal replay all
  fail. Issuing CandidateInputRecheckAttestation or acquiring
  `HELD(CURRENT_CANDIDATE)` before both roots exist also fails; the recheck must
  bind and independently validate both. PreCutoverCertification cannot pass
  unless it selects the same two exact terminal roots and every reachable node
  has the declared producer.
- `CANDIDATE-INPUT-RECHECK-PRODUCER-01`: only
  `CANDIDATE_RELEASE_FREEZE/ISSUE_INPUT_RECHECK` may create a
  CandidateInputRecheckAttestation, and its attestation is its receipt. Direct
  insertion, a wrong carrier, missing projection root, one enumerator,
  non-independent enumeration, missing, forged, expired, swapped-role or
  detached embedded proof, unregistered validator, stale CandidateInputHead,
  non-FROZEN build head,
  unavailable promotion fence, expired input, head advance during enumeration
  or promotion before the produced attestation writes nothing. Exact replay
  returns the same attestation; a valid refresh after expiry creates a new one
  without mutating a lifecycle head.
- `METRIC-SLOT-EXCLUSION-CONTRACT-01`: independently enumerate the complete
  canonical metric-slot universe and partition it into observations and
  MarketMetricSlotExclusions. Delete, duplicate, overlap or substitute one slot,
  reason, owner lineage, applicability-requirement-set digest, carrier, kind
  entry, payload digest or import disposition and candidate sealing, bundle or
  production parity fails at the exact member. A slot under one unexamined
  intersecting requirement is excluded; the same slot is not excluded by an
  unrelated unexamined requirement. No exclusion enters a cohort or aggregate.
- `CANDIDATE-OUTPUT-RACE-01`: race a final output batch against both inventory
  enumerators, SEAL_PREPARE, abandonment and FREEZE. A batch that commits first
  advances CandidateOutputPreparationHead and invalidates stale roots; sealing
  or abandonment that wins first rejects the batch with zero output DML. Exact
  replay returns one receipt, while changed-payload replay fails. Removing,
  adding or swapping one MEMBERS_APPENDED receipt fails the two control-receipt
  trees; each terminal event writes its receipt before its CandidateBuild
  transition. FREEZE compares only the sealed head, output and control-receipt
  roots, neutral digests, reconciliations, terminal receipt and seal,
  with lock and DML work constant as corpus size grows.
- `CANDIDATE-PROMOTION-RACE-01`: race CandidateInputHead advancement against
  input sealing, candidate freeze, promotion-fence acquisition, import,
  readiness and activation, and race a successor CandidateBuildHead OPEN against
  recheck and hold acquisition. Exactly one serialisation wins. A stale candidate
  performs zero publication DML, while a held fence makes every ordinary input
  mutation fail immediately rather than queue. After rollback, also race the
  exact REVOKED-to-HELD historical-reactivation CAS against current-head,
  revocation, dependency, readiness and exposure-off-tuple changes. The
  attestation may observe an advanced current input head, but acquisition passes
  only while that observed head remains current and never rewinds it.
- `PROMOTION-HOLD-EXPIRY-01`: expiry of a HELD CandidatePromotionFence installs
  only a higher REVOKED version. It never restores AVAILABLE or exposure.
  Abandonment may release the hold only after proving no activation exists or
  an acknowledged BLOCKED serving fence and exposure-off state.
- `SERVING-FENCE-CACHE-01`: every request, including a warm cache hit, obtains
  one fresh request-nonce-bound admission for the exact READY fence and retains
  its lease through the last response byte, then consumes the token through the
  fixed admission RPC before cache access. Race that RPC against each BEGIN
  action on the same generated controller-head lock. Admission-first may finish
  under its exact old tuple and is included in drain; BEGIN-first rejects token
  consumption and performs zero cache or corpus read. A stale fence generation,
  tuple, cursor, fill, export chunk, reused token or omitted consumption record
  fails before cache or corpus access. In a READY-to-BLOCKED race no new
  admission starts after the winning BEGIN or external block, and expired or
  unregistered work fails. A process-local READY cache cannot pass.
- `CACHE-CANONICAL-IDENTITY-01`: two requests with byte-identical canonical
  semantics and security and release partitions but distinct nonce,
  idempotency, request and execution IDs produce distinct intent, execution-
  request and response-binding digests, one CanonicalServingCacheIdentity and
  one shared fill. Each receives a valid request-bound response and independently
  signed cursor. Changing page position or size, child scope, facet or action
  selector, exact-detail parent, action, reference, byte position or chunk size,
  response schema, authorisation scope, policy or revocation generation,
  manifest, namespace, import attestation, state tuple or serving epoch changes
  cache identity. Routine physical-fence renewal inside the same epoch does not.
  Injecting any request-only field or signed cursor into the cached
  value fails schema validation; an exact-detail hit cannot bypass its object
  predicate. Replaying one source cursor returns the same page and continuation,
  while separate initial chains may reuse cached bytes but receive their own
  correctly bound cursor chains.
- `SERVING-METADATA-ACYCLIC-01`: candidate ServingContractMetadata contains its
  CorpusRelease and static certified digests but no active-state, ActivationEvent
  or fence reference. It carries the bundle-internal query root and suite, the
  post-freeze external QueryGoldenCertificationAttestation and
  BlockedResultPreviewDefinition, but no preview instance or carrier. Its
  query attestation is transported later through the tenth promotion-evidence
  slot and remains excluded from the bundle fingerprint. The expected and
  physical metadata parity roles must reconstruct this same reference without
  either trusting stored metadata identity assertions or creating a reverse
  bundle edge. Its
  CorpusRelease and composition-contract-set attestation
  already exist when PREPARE_OUTPUT_BATCH constructs it, and both output root sets
  select it before CandidateOutputSeal. Construction succeeds before bundle and activation. At
  request time, a metadata CorpusRelease mismatch against the admitted READY
  tuple fails before cache lookup or database checkout; substituting the prior
  active manifest over the same CorpusRelease, or independently substituting
  manifest payload digest, namespace, header, metadata payload digest or import
  attestation, or adding a future fence reference fails identity and topology
  validation.
- `EXACT-DETAIL-RELEASE-01`: a contextual detail handle is the canonical
  ServingExactDetailReference ID plus the complete V2 manifest, namespace,
  metadata, state-tuple and fence request envelope. An R1 handle fails after R2
  activation even when its canonical reference ID and immutable payload bytes
  survive because two manifests select the same CorpusRelease. A successor
  CorpusRelease rekeys the canonical reference; a different manifest over the
  same CorpusRelease requires a new namespace-bound handle and request envelope.
- `EXACT-DETAIL-HISTORICAL-01`: after a correction supersedes revision A with B,
  A's stored revision and evidence cannot resolve under the successor release;
  only parent-selected B references pass.
- `EXACT-DETAIL-FORGED-ID-01`: bare, random, bit-flipped and payload-substituted
  evidence, excerpt, revision, source, blob, payload and reference IDs return
  zero detail bytes.
- `EXACT-DETAIL-CROSS-PARENT-01`: a valid reference for parent or action A fails
  with parent or action B. A separately generated B reference to legitimately
  shared immutable evidence passes.
- `EXACT-DETAIL-MULTISPAN-01`: dropping, adding, duplicating or reordering one
  span, source or cross-source component, relabelling one component slot or
  changing only the ExcerptDefinition key, version or payload digest changes
  Excerpt, evidence, revision, selection-path and detail identity and fails
  inventory parity. The complete governed slot-to-span order passes.
- `EXACT-DETAIL-NESTED-USE-01`: one definition or evidence object reused by
  nested and cross-provision components receives distinct contextual references
  without copying canonical source facts or losing its complete selection path.
- `EXACT-DETAIL-PARENT-PAYLOAD-01`: removing a parent-carried reference, changing
  its ordinal or adding an orphan reference fails bidirectional parent-edge
  closure before publication.
- `SOURCE-DOCUMENT-PAGINATION-01`: exact maximum chunk size passes and maximum
  plus one performs zero cache, database or carrier reads. Cursor bit flips,
  expiry, retired keys, cross-manifest, serving-namespace, corpus-blob-namespace,
  metadata, parent, action,
  slot, reference, payload or source substitution, negative, overflowing,
  skipped, overlapping or out-of-range positions, carrier-generation or length
  mismatch and EOF/cursor disagreement return zero detail bytes and no cache
  entry. Cursor replay returns the same page and continuation. Concatenating all
  pages reproduces the admitted content length and digest, and each page uses
  exactly one fixed admission RPC plus at most one bounded detail RPC and one
  immutable-carrier range read.
- `ACTIVE-MANIFEST-NAMESPACE-01`: import two candidate manifests over one
  CorpusRelease into different derived namespaces. Only the manifest, namespace,
  header, metadata and import-attestation tuple selected by the active state is
  readable. Independently splice each one of those fields, reuse an old cursor
  or detail handle, or cross-link an otherwise identical serving key and fail
  before cache or corpus access. Both inactive namespaces remain immutable and
  coexist without a uniqueness collision.
- `EXACT-DETAIL-INVENTORY-01`: omission, addition, wrong kind or payload change
  at either candidate output root, CandidateOutputSeal, manifest, bundle or
  import fails exact set equality, including for an otherwise empty kind.
- `EXACT-DETAIL-AUTH-01`: a structurally valid active-release reference for an
  unauthorised tenant, deal or parent returns no metadata or detail.
- `EXACT-DETAIL-FENCE-RACE-01`: READY-to-BLOCKED transition prevents new detail
  resolution and invalidates stale detail cache work under the same lease rules
  as every other corpus response.
- `EXACT-DETAIL-DENYLIST-01`: serving-role direct canonical-table, generic
  resolver and object-store access all fail; opaque canonical IDs cannot be
  dereferenced outside the generated exact-detail RPC.
- `EXACT-DETAIL-BOUNDS-01`: 20 references and the exact 512 KB cap pass; either
  maximum plus one fails with zero partial response or cache artefact. Bounded
  source-document chunks retain manifest selector, CorpusRelease, namespace,
  metadata, state tuple, fence, parent and authorisation scope.
- `SERVING-FENCE-OUTAGE-01`: unavailable, forked, stale or unverifiable fence
  control returns typed unavailable before cache lookup, connection checkout or
  corpus read. It cannot publish READY, and recovery admits only the exact
  committed ActivationEvent and complete canonical release-state tuple.
- `LOCK-ORDER-01`: generated plans for every writer, correction, import,
  readiness, activation, trust-status update, trust revocation and rollback
  action follow the one declared database lock order, including shared
  WalkerTrustStatusHead locks for proof-authorised writer commits and exclusive
  locks for head advancement. Any inversion fails before DML. External serving-fence
  transition and lease drain occur before the first database lock, and no code
  waits on that control plane while holding one.
- `BOUNDED-WRITER-01`: increasing corpus size does not increase one scope-freeze
  COMMIT transaction's lock count or DML, one DEAL_SCOPE_RUN's finite per-deal
  row, byte and time bound, one FAMILY_BUILD's deal-family bound or
  FINALISE_DEAL's database calls and Node payload. Maximum plus one blocks
  before canonical DML and cannot truncate. A
  MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION dispatch is
  bounded by `max_scope_correction_subjects_per_transaction`; exact maximum
  commits atomically and maximum plus one performs zero correction or scope DML.
  Prepared shard counts may grow, but
  each batch remains within the fixed row and byte contract.
- `CANONICAL-WRITER-DISPOSITION-01`: generated operation actions, complete
  discriminator and write-phase dispatch tuples, physical carriers, DML
  targets, grants and specialised writer registries exactly equal
  the total CanonicalWriterDispositionRegistry projection. Removing, adding,
  overlapping or wildcarding one tuple, changing its producer, key or digest
  extractor, bounds, receipt, outbox, bundle or import disposition, or executing
  a `PROHIBITED` tuple fails contract generation before runtime. Omitting
  RELEASE_BUNDLE_CONTROL_BUILD, omitting any of its five actions, adding a
  sixth action or permitting any bundle-control carrier outside its exact five
  generated actions fails the
  closed operation-schema equality. Assigning receipt policy only at action
  level, exposing other than the exact five DEAL_SCOPE_RUN actions or two
  MATERIALISE_SCOPE discriminators, retaining a standalone multi-subject scope
  action, exposing other than the exact seven import actions, omitting either
  `WRITE_WALKER_OUTPUT` phase or any import pre-seal
  dispatch, or omitting, wildcarding or widening any post-seal semantic-parity
  PRECOMMIT_ROLES, role-specific CLAIM_ROLE, role-specific TREE_BATCH or
  TERMINAL_OUTPUT, either output-set finalisation or ATTEST_PARITY terminal-
  attestation dispatch tuple also fails.
- `BOUNDED-TREE-CANONICAL-01`: independent builders reproduce byte-identical
  empty, one-row, boundary-full, `F`, `F+1`, multi-level and maximum-size trees.
  Alternate packing or root collapse, ragged or mixed child levels, non-final
  underfill, gap, overlap, wrong shared boundary, repeated or unreachable node,
  forged low or high subtree-node count, incomplete row digest, oversize row,
  maximum-plus-one member, node or height and integer or byte overflow all fail
  before a root is accepted.
- `GOVERNED-INVENTORY-ROOT-INDEPENDENCE-01`: each pair of CorpusScope,
  CorpusRelease-input and CandidateOutput enumerators produces byte-equal
  neutral leaf and internal-node IDs, tree-root references, kind and root-set
  content digests but distinct governed kind-root and root-set IDs because its
  enumerator evidence differs. Each seal accepts only neutral
  equality plus the named passing reconciliation. Comparing governed IDs,
  omitting either evidence identity, copying one enumerator's output or changing
  one row while preserving counts fails before the relevant manifest or seal is
  written. Any prohibited shared code, query, view, cache, intermediate row or
  output fails the stage independence attestation even when both neutral
  digests happen to match. Injecting enumerator role, executable, run evidence
  or independence-attestation identity into a neutral node or root reference
  also fails compilation.
- `CARRY-FORWARD-01`: adding an unrelated eligible receipt produces a new
  cutoff, DealScopeRunReceipt, scope barrier, FamilyExtractionManifest,
  DealExtractionRunManifest and release, while unchanged DealScopeRunManifest,
  local semantic objects, family sets and DealSnapshot remain byte-identical and
  no family fact is rewritten. Changing any local input or dependency makes
  CERTIFY_CARRY_FORWARD fail and requires MATERIALISE.
- `CORRECTION-01`: every legacy correction is dispositioned, and one shared
  anchor cannot cause an anchor-only correction to alter two semantic objects.
- `CORRECTION-APPROVAL-01`: every applied correction selects exactly one current
  passing CorrectionApprovalAttestation. Changing only review disposition,
  reviewer eligibility, Ben evidence or authorisation preserves Correction ID
  but rekeys the approval, application, applicability projection, event,
  CorrectionApplyReceipt,
  reconciled applicability slice, corrected primary output, discharge,
  CorrectionDischargeMap, correction-set digest and, for every application whose
  reconciled slice derives `MULTI_SUBJECT_CORRECTION`, including a one-subject
  source-admission transition,
  MultiSubjectScopeCorrectionReceipt/V2, affected scope or
  extraction roots, candidate release and import attestation. A
  missing, failed, stale or multiply selected approval produces no application;
  non-identity execution annotations preserve all semantic IDs.
- `CORRECTION-APPLY-RECEIPT-01`: each committed scope and post-scope correction
  event has exactly one successful CorrectionApplyReceipt written after every
  required ledger, subject and CandidateInputHead compare-and-swap. Missing,
  extra, duplicate, cross-stage, wrong-application, wrong-before-or-after-head,
  wrong CandidateInputEvent or payload-substituted receipts fail applicability
  slicing, release-input equality, CandidateReleaseManifest, bundle, import and
  traceability. Writing the receipt early, making an earlier object hash it or
  selecting a failed-attempt receipt fails topology. Exact replay returns the
  original receipt ID and creates no new canonical row.
- `DAG-01`: changing a REP revision or selected relationship effect invalidates
  its dependent claim, bring-down, result, observation and aggregate. Changing a
  definition-use dependency expectation additionally changes the affected
  closure. A one-path composition-requirement change fails K to D equality and
  creates no closure. A reviewed matching deal-requirement change on both paths
  changes only their children, local shards, per-deal roots and reconciliations,
  affected closure, DealScopeRunManifest, DealScopeRunReceipt, barrier, family,
  result, lineage, observation, aggregate, CorpusScopeManifest and release.
  Sibling shards and family sets and every other deal remain byte-identical.
  A matching reviewed global-requirement change on both paths changes its global
  shards, roots, reconciliations and affected global closure while sibling
  global and every deal shard remain identical. Unrelated families remain
  identical.
- `DAG-SCOPE-01`: a `PRE_CLAIM_SCOPE` relationship depending on its dependent
  ClaimRevision fails compilation. A definition-use expectation change
  invalidates the ClaimScopeClosure and all dependants. A selected
  relationship-effect change preserves an otherwise identical closure but
  changes the RelationshipRevision, ClaimRevision, DerivedResult, observation
  and aggregate. Unrelated families remain identical.
- `REL-EFFECT-SCHEMA-01`: for every active RelationshipDefinition, deleting each
  required effect field in turn, using an unknown effect code, supplying an
  impermissible endpoint, mismatching affected and resolved target sets,
  omitting evidence or leaving a condition or precedence input unresolved fails
  validation and publication.
- `REL-NO-INHERITANCE-01`: `CONTAINED_IN` alone transfers no definition,
  qualifier, exception, party, claim or evidence. `MIRRORS` alone transfers no
  party-specific fact or evidence. Adding the exact required semantic edge
  enables only its declared targets.
- `REL-QXO-01`: QXO Capitalisation preserves the Target signing limbs, Tier B
  and Tier C targets, dates, materiality scrape, De Minimis Inaccuracies and
  condition parties through exact `BRINGS_DOWN` and `USES_DEFINITION` effect
  payloads. Swapping one limb, tier, party, date or scrape fails even when the
  rendered pill is unchanged.
- `REL-NOSHOP-IOC-FEE-01`: QXO Company and Parent cleanup, ongoing restrictions,
  representative control, fiduciary engagement, notice, matching and
  Acquisition Proposal definitions retain separate effect payloads and parties;
  IOC consent remains an override rather than absence; termination-fee triggers
  retain exact payor, payee or right holder, tail and remedy effect. Any party,
  target, precedence or legal-operation swap fails.
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
- `METRIC-LINEAGE-01`: a claim-only scalar may publish from its ClaimRevision,
  ClaimScopeClosure, metric CompositionScopeClosure and pre-claim dependency
  lineage. Adding a termination-fee trigger,
  bring-down, exception treatment or any post-claim relationship dependency
  forces `RESULT_RELATIONSHIP` ownership and exact ResultInputLineage. A
  relationship-dependent claim-owned observation fails compilation and
  candidate certification.
- `COHORT-DIGEST-01`: independently recompose materialised and refined cohort
  digests while permuting only canonical commutative AST order. Changing Boolean
  nesting, same-component versus same-deal scope, eligibility or applicability
  semantics, legal or party scope, a dimension, operator, quantifier, reducer or
  relevant schema version changes the digest. Changing only realised membership
  preserves cohort digest but changes `aggregate_input_set_digest` and aggregate payload.
  Import parity rejects every stale or near-collision key.
- `QUERY-STATE-01`: executable goldens cover every state, `NOT`, `EXISTS`,
  `NONE`, `ALL`, nested Boolean and same-component versus same-deal scope,
  including absent-only, failed-only, not-applicable-only,
  true-present-plus-failed, false-present-plus-failed, `NOT(scalar)` and
  “Capitalisation rep has no knowledge qualifier”. Failed and not-examined
  cases run only through isolated evaluator and authorised candidate-review
  fixtures. Active RPC goldens retain claim state, result completeness and market
  comparability as separate typed fields, accept release-certified source-
  specific and incomplete rows only in `SELECTED_DEAL_CONTEXT`, give them zero
  scalar, filter, cohort or aggregate authority, certify blocked-state counts at
  zero and reject an injected blocked row before cache or response.
- `QUERY-LIMIT-01`: every complexity limit accepts its maximum, rejects maximum
  plus one with zero corpus calls, and cannot be bypassed through direct RPC.
- `QUERY-TRACE-BOUNDARY-01`: removing or changing one dimension, operator,
  quantifier, reducer, route, schema, generated SQL golden, fixture, expected
  typed row, required index or route budget blocks query certification. Inserting
  a runtime QueryPlan, request, cursor, cache entry, response binding or saved-
  query execution into candidate or trace roots fails. A request executed after
  programme completion does not mutate or reopen release traceability. The same
  certified definition set compiles every runtime form to its governed
  semantics; an invalid or malicious request may fail operationally but cannot
  alter the certified contract or release.
- `QUERY-BUNDLE-ACYCLIC-01`: compile the authored input set twice and require
  byte-equal CanonicalBundleInputIdentity, QueryDefinitionSetRoot,
  QueryGoldenSuiteManifest and bundle fingerprint. Graph inspection proves the
  query root and suite contain neither frozen pair, bundle fingerprint nor
  ContractFreezeAttestation, and that no generated member points back to the
  final fingerprint. Adding any such edge, omitting a governed fixture or
  changing an authored query member fails compilation before freeze.
- `QUERY-GOLDEN-EXTERNAL-01`: no QueryGoldenCertificationAttestation exists
  before ContractFreezeAttestation. The post-freeze run binds the exact bundle,
  freeze, query root and suite and its executed outputs; changing any one rekeys
  or fails it. Bundle fingerprint recomputation excludes the attestation and
  executed outputs, while ServingContractMetadata, candidate certification,
  release-bundle walking, import parity and traceability all require the exact
  passing external attestation and reject a stale or substituted one.
- `QUERY-GOLDEN-EVIDENCE-SLOT-01`: PromotionEvidenceSlotRegistry contains one
  and only one tenth slot whose type, stable ID and payload digest equal the
  exact passing QueryGoldenCertificationAttestation selected by
  ServingContractMetadata. Both bundle support walkers and both import support
  walkers reproduce its bytes and path. Omitting, duplicating, relabelling or
  substituting it, retaining a nine-slot root, hashing it into the bundle
  fingerprint, or allowing expected metadata parity to select another copy
  fails envelope, import, metadata parity and traceability certification.
- `QUERY-EXEC-01`: browser and RPC instrumentation record one execution from
  launch through rendered result.
- `CROSS-VIEW-SURFACE-01`: browser goldens cover QXO Review and Compare, the
  query builder and Eli Lilly definitions. Compare retains visible left
  provision navigation, a Review-density centre region and a collapsible right
  panel at every supported viewport; the panel never overlaps the header and
  collapse restores centre width. Every authorised row is keyboard and pointer
  actionable, while a non-actionable row shows its typed reason. Market detail
  leads with governed component distributions and selected-deal treatments,
  renders presence as secondary, converts 24 elapsed hours to one elapsed day,
  marks minimum, maximum, median and mean, and renders money primarily as the
  correct deal-relative percentage with raw currency secondary. Definition text
  expands beneath its own term; Eli Lilly Acting Holders does not absorb
  Assignee, Change of Control or any adjacent definition, while an actual nested
  definition remains independently addressable. The manual builder matches
  Review styling and deal selection accepts typed typeahead. Visual regression,
  responsive layout, focus order, keyboard operation and accessible names all
  pass from the same shared row payload. A mixed deal containing canonical,
  reviewed-source-specific and incomplete rows preserves every sibling and left-
  navigation action when the unfamiliar row or its lazy detail renderer throws;
  only that boundary displays the typed failure envelope.
- `QUERY-REL-EFFECT-01`: filters and groupings over termination-fee trigger,
  no-shop exception and bring-down effect fields use the governed typed
  projection and one indexed set-based RPC. Query plans that require recursive
  graph traversal, application-side relationship hydration or an unindexed
  effect field fail compilation before a corpus read.
- `RESULT-CARDINALITY-01`: every inline and repeatable slot passes at its exact
  maximum, including relationship-effect and ExpectedResultInputLineageSlots; maximum
  plus one either uses its declared child cursor or fails the contract, never
  truncates; initial and child pages remain within byte limits and use one
  set-based RPC with zero per-component or per-relationship calls.
- `SOURCE-SPECIFIC-CARDINALITY-01`: a reviewed-source-specific row passes with
  exactly 16 inline primitives and separately pages the remainder through its
  open-world child collection at page 50 and hard maximum 200. Maximum-plus-one
  page size fails before corpus access. A candidate at 2,048 primitive members
  and 8 MiB passes; either cap plus one retains a GovernedResidualObservation,
  blocks only that candidate and never truncates or suppresses sibling rows.
  Parent total, collection digest, child ordering, keyset cursor and one set-
  based RPC must agree for source-specific and incomplete rows.
- `RESULT-LINEAGE-01`: changing only a ClaimScopeClosure,
  CompositionScopeClosure, RelationshipRevision, effect payload, endpoint,
  party, precedence rule or evidence changes ResultInputLineage, result-component and DerivedResult
  revision IDs. Canonically reordered identical inputs reproduce the same IDs.
- `SERVING-PAYLOAD-01`: changing one projected state, canonical value,
  denominator, ClaimScopeClosure, CompositionScopeClosure, relationship revision,
  effect or evidence
  reference without changing its serving key fails independent
  key-and-payload-digest certification and import parity.
- `SERVING-LINEAGE-01`: changing a relationship effect while preserving the
  serving key and visible display text changes the result-row, child-row,
  observation and aggregate payload digests. Independent key-and-payload
  certification and production import parity reject the stale payload.
- `ROW-LINEAGE-OMISSION-01`: removing, duplicating or impermissibly reordering
  one ClaimRevision, RelationshipRevision, ClaimScopeClosure,
  CompositionScopeClosure, effect digest or
  evidence reference fails server result-schema validation before cache or
  rendering. Review, Corpus Context, Compare, Query, Admin and CSV expose
  identical lineage for the same component.
- `ROW-LINEAGE-CARDINALITY-01`: relationship-effect and
  ExpectedResultInputLineageSlots
  pass at the exact inline maximum, use the declared child cursor at the
  repeatable maximum and fail above an undeclared hard maximum. Initial and
  child rows use one set-based RPC with zero per-relationship queries and no
  truncation.
- `NO-SECOND-SERVING-TRUTH-01`: serving, query, cache and client roles cannot
  read any member of the exact generated OfflineCertificationArtefactDenylist.
  ServingObjectAccessRegistry complement equality, database grants and static
  and dynamic import graphs are byte-equal and cover every logical and physical
  carrier. Opaque allowlisted IDs work but every attempted dereference fails.
  The test specifically covers CanonicalContractBundle, all ordinary
  definitions, both catalogues, every expectation and closure,
  ContractFreezeAttestation, CandidateReleaseManifest, both candidate
  composition projections and attestations, contract reconciliation and
  instance conformance, both CompositionContractSetRecompositionRoots and their
  reachable tree nodes, CompositionContractSetEnumeratorIndependenceAttestation
  and CompositionContractSetAttestation, every WalkerTrustStatusProof,
  ProductionSemanticParityRoleRegistry and independence attestation, every
  semantic-parity run claim, role-output root, walker-output, output-set and
  reconciler-output attestation, every production observation, cohort and
  aggregate parity root, ProductionServingContractMetadataParityRootPair and
  ProductionSemanticParityAttestation. Poisoning any denylisted
  intake, semantic, relationship, composition, scope or candidate audit object
  after candidate certification cannot alter a row, observation, aggregate or
  cache response and only invalidates later certification by digest mismatch.
  After the fixed admission-token RPC, the same QueryPlan still executes one bounded set-based serving RPC with zero
  denylisted joins or per-result calls, using only the generated schema carrying
  the exact universe ID and materialised candidate values.
- `ERR-CURSOR-CACHE-01`: injected validation, auth, admission, circuit, timeout
  and result-contract failures use the exact error contract; cursor tampering,
  cross-scope replay and expiry fail; cache cannot cross auth, contract or
  manifest-selector, CorpusRelease, namespace/header, metadata, state-tuple or
  serving-epoch boundaries. Routine byte-identical fence renewal preserves the
  epoch and therefore valid cursors, exports and cache identities; a release,
  policy, authorisation or compatibility change creates a new epoch and rejects
  the old work.
- `SHADOW-REEXTRACTION-01`: bind both complete extraction runs, every third run,
  adjudication and confirming run to one exact frozen pair, CandidateInputHead,
  CandidateBuildHead, CandidateReleaseManifest, correction-head root and source-
  scope root. A 2-to-1 result never establishes truth. Every disagreement is
  human-adjudicated and every affected unit receives a fresh confirming run after
  the adjudicated contract and extractor inputs are fixed. Advancing any bound
  candidate input, correction, scope, manifest, contract or extractor input,
  omitting a unit, selecting a majority result, retaining an unresolved result or
  changing a result after confirmation leaves the gate `OPEN`. Two shadow runs
  that agree with each other but differ from the candidate on any result,
  component, claim, relationship, open-world disposition, comparability state or
  cohort membership also fail the exact candidate-to-shadow reconciliation.
- `RETRY-01`: instrumentation proves one admission-token attempt and at most one
  route-specific serving attempt with zero interactive
  retries; eligible background work makes at most two delayed attempts with
  fresh admission and one idempotency key; mutations make zero automatic
  retries.
- `SERVING-KEY-01`: occurrence-based result, child-collection, child-row,
  observation, aggregate and query-selected-row keys reproduce across databases
  and remain stable only under a selected-revision, display or insertion-order
  change that leaves every stated identity input fixed; their payload digests
  still change where required. Exact-detail payload, reference and parent-edge
  keys reproduce only when every field in their respective formulas is
  identical. A successor CorpusRelease, selected-revision or selection-path
  change rekeys the affected exact-detail objects. A different
  CandidateReleaseManifest over the same CorpusRelease may preserve those
  canonical IDs but must use a distinct serving namespace, header and contextual
  request handle. A semantic occurrence, slot,
  governed ordinal, group or scope change rekeys exactly its dependants. Typed
  inventories, unique constraints, collision and permutation tests use the same
  generated key map.
- `CURSOR-SCOPE-01`: every selector grain rejects replay across grain, parent,
  slot, child collection, content digest, total, CandidateReleaseManifest ID or
  digest, CorpusRelease, namespace or header, metadata pair, import attestation,
  authorisation, access-policy, fence, schema or page size. The cursor ends on the complete
  typed selected-row key and contains no self-reference to QueryPlan.
- `CURSOR-PAGE-01`: zero, one, `n-1`, `n`, `n+1` and `2n` rows with duplicate
  and null sort values page exactly once for deal, result, provision, component,
  claim, observation, aggregate and child grains, with no omission or
  duplication. It also covers current and prior signing-key overlap, expiry,
  revocation and active-release lifetime.
- `SAVED-QUERY-FENCE-01`: follow-active plans before and after activation and a
  pinned plan equal to active pass under a fresh fence. Pinned not equal to
  active returns `RELEASE_NOT_ACTIVE` with zero cache, database or corpus calls;
  stale cache and save-time validation cannot authorise it. A missing,
  unauthorised, replaced or digest-mismatched saved-query definition fails its
  single post-admission lookup before cache or corpus access, and a token for
  one saved-query ID or immutable version cannot execute another.
- `REPEATABLE-DIMENSION-01`: permutations, duplicates, empty, incomplete and
  maximum-plus-one repeatables require the declared operation-specific
  quantifier, set or reducer and match SQL goldens. Implicit first, min, max,
  majority and accidental row explosion fail; EXPLODE buckets are labelled and
  report distinct subject and deal counts.
- `PAGE-EXPORT-CAP-01`: page sentinel boundaries, 1 MiB minus one, exact and
  plus one bytes, 24,999, 25,000 and 25,001 export rows and 100 MiB minus one,
  exact and plus one bytes produce the declared result or typed failure with no
  partial HTTP, cache or export artefact and no truncation.
- `SERVING-DENYLIST-CLOSURE-01`: every generated registry carrier has exactly
  one disposition; deleting, renaming or reclassifying any denied logical type,
  database carrier or bundle prefix fails compilation, grants and import-graph
  checks. A poisoned denied payload never affects a serving response.
- `RELEASE-BUNDLE-SCHEMA-01`: documentation and generated-schema lint find
  exactly one normative ReleaseBundleEnvelope schema, role/type registry, path
  grammar, comparator, four-role one-use run-slot and output-set contract and
  identity formula. A second field list or generated
  mismatch fails. Absolute, dot-segment, backslash, mixed-case, Unicode,
  over-length, extension-alias and percent-encoded path variants fail; random
  input ordering produces the same canonical tuple order and bundle digest.
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
  measured connection reserve and recover without a retry storm. Database-owned
  instrumentation proves every request stays within its exact top-level and
  nested SQL-statement budget; `N` versus `10N` leaves that count unchanged, and
  a dynamic statement, procedural row loop or unregistered query ID fails. Cap-plus-one
  rejects before checkout, a dead fill leader expires, a stale fence cannot
  publish, maximum application instances still produce one shared fill,
  controller outage produces zero checkout and half-open state permits exactly
  one fleet-wide probe. The lease TTL and every route or chunk deadline satisfy
  the frozen skew, flush and cancellation inequalities; maximum-minus-one
  passes, maximum-plus-one fails before corpus access, and transition waits for
  both external lease drain and the database no-active-old-epoch proof. Each
  counted database failure trips its exact route or pool scope; 4xx, compiler,
  auth, admission, cursor, client-cancel, cache and control-plane signals never
  trip it. Half-open success closes and eligible failure reopens the same scope.
- `SCOPE-OMISSION-01`: separately omitting or adding one source, deal, family,
  ArchiveSafetyPolicyManifest, SubmissionReceipt, IntakeLedgerEvent,
  ArchiveAttemptNode, IntakeProcessingAttempt, SubmissionExpansionManifest,
  IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution, chain edge,
  selected-resolution entry, IntakeProcessingPolicyActivation or head-chain
  payload, cutoff-state manifest, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory or referenced
  governance payload, IntakeEligibilityDependencyManifest root or edge,
  CutoffPreparationKindRegistry or write-disposition entry, CutoffBuildTransition
  or receipt, CutoffPreparationMembership, CutoffPreparationBatchManifest,
  event, head tuple or receipt,
  CutoffPreparedRootSet, CutoffPreparedReconciliation, control-receipt tree,
  CutoffPreparationControlReceiptReconciliation, CutoffPreparationSeal,
  IntakeCutoffAttestation, IntakeEligibilityRecheckAttestation or intake entry,
  CanonicalTextVerificationManifest or required
  SourceAdmissionApprovalAttestation,
  independent deal-document or admission-reconciliation entry,
  AdmittedCoverageAtom, PotentialDependencyUniverse, any of the three
  InventoryEnumeratorIndependenceAttestation stage objects,
  TraceabilityPhaseObjectRegistry/V2 entry or frozen
  AttemptAuditObjectRegistry definition, GlobalMutableAuthorityRegistry entry
  or GeneratedLockPlanRegistry entry,
  IndependentSemanticQuestionCatalogue object,
  SemanticStageRegistry entry or contract digest, any semantic input envelope,
  payload, semantic-object ID, review envelope or disposition, attestation,
  governed-object ID or mapping, SemanticStageOutputSetRoot,
  NeutralStageProjection, SemanticNeutralProjectionSetRoot,
  SemanticQuestionCatalogueReconciliation,
  RelationshipEffectFieldUniverse or RelationshipEffectFieldUniverseSetRoot,
  independent or ordinary RelationshipEffectConstraint or its exact set root,
  legal-dimension candidate or
  disposition, IndependentSemanticQuestionUniverseManifest,
  OrdinarySemanticQuestionUniverseManifest or Q reconciliation,
  ChallengeBaseSubject,
  ChallengeQuestionDisposition, OrdinaryQuestionDisposition,
  ChallengeQuestionSlot, OrdinaryQuestionSlot, challenge entry or disposition, base-subject,
  question-disposition or slot reconciliation, RelationshipSemanticExpectation,
  ClaimScopeDependencyExpectation, ClaimScopeClosure,
  ApplicabilityEligibleMemberKindProducerRegistry/V3 entry,
  ApplicabilityReexaminationRequirementDefinition or requirement-set root,
  post-contract-freeze ApplicabilityReexaminationRequirement, Entry or Slice,
  either candidate-wide applicability root or reachable node, its independence
  attestation, named reconciliation or manifest, any
  MetricApplicabilityRequirementProjection or terminal projection set,
  independent or ordinary composition disposition, requirement, locality shard,
  totality root, shard or parent reconciliation,
  ExpectedCompositionContractProjection, CompositionContextKeyUniverseRoot,
  its neutral digest or any reachable tree node, CompositionScopeClosure,
  ExpectedOccurrenceSlot, ExpectedResultInputLineageSlot, DealScopeRunManifest,
  DealScopeRunReceipt or frozen
  ScopeSubjectHead-map entry, any CorrectionApprovalAttestation,
  CorrectionApplication, CorrectionApplicabilityProjection,
  CorrectionApplyReceipt, CorrectionApplicabilitySlice, CorrectionDischarge,
  ManifestMembershipRevision, CorrectionDischargeMap and digest,
  MultiSubjectScopeCorrectionReceipt/V2,
  correction event or head, CandidateInputEvent
  or CandidateInputHead tuple, CorpusScopeInventoryKindRegistry entry, either
  CorpusScopeInventoryRootSet, its common neutral digest, reconciliation or any
  reachable scope-inventory tree node,
  CorpusScopeManifest or CorpusScopeFreezeAttestation, ScopeBuildTransition or
  receipt, DealExtractionBuildTransition or receipt, FamilyBuildTransition or
  receipt, FamilyExtractionManifest, DealSnapshot,
  DealExtractionRunManifest or DealExtractionRunReceipt,
  CandidateRelationshipActualProjection,
  CandidateRelationshipProjectionAttestation or reconciliation,
  CandidateCompositionImplementationCatalogueRoot, its neutral catalogue
  digest or any reachable catalogue or source-artefact tree node,
  CandidateCompositionContractRealisationProjection,
  CandidateCompositionContractProjectionAttestation,
  CandidateCompositionInstanceProjection,
  CandidateCompositionInstanceProjectionAttestation, candidate contract
  reconciliation, either CompositionContractSetRecompositionRoot or reachable
  tree node, CompositionContractSetEnumeratorIndependenceAttestation,
  CompositionContractSetAttestation, its certified common digest or
  CandidateCompositionInstanceConformance,
  CandidateBuildTransition or receipt, CandidateOutputKindRegistry or
  CandidateOutputWriteDispositionRegistry entry,
  CandidateOutputMembership, batch manifest, preparation event, preparation
  receipt, output-head
  tuple, candidate input, CorpusRelease inventory or candidate output shard,
  kind root, root set, reachable BoundedInventoryTree node, reconciliation,
  output control-receipt tree or CandidateOutputControlReceiptReconciliation,
  or seal, CorpusRelease,
  ServingExactDetailActionDefinition,
  ServingExactDetailPayload, ServingExactDetailReference or parent edge,
  ReviewedSourceSpecificOutputClosure,
  CandidateReleaseFreezeAttestation, CandidateInputRecheckAttestation,
  CandidatePromotionFence or ReleaseIntakeDependencyProjection,
  CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot,
  PromotionEvidenceSlotRegistry or PromotionEvidenceSlotRoot,
  ReleaseBundleControlContext, event, head, receipt, failure evidence,
  abandonment terminal, successful spool-erasure receipt or
  ReleaseBundleSpoolErasureReceiptSetAttestation,
  ReleaseBundleEnumeratorIndependenceAttestation,
  ReleaseBundleWalkerRunClaim, WalkerOutputSpoolCommitment,
  ReleaseBundleWalkerSpoolCommitmentRoot, ReleaseBundleWalkerOutputAttestation,
  ReleaseBundleWalkerOutputSetAttestation, ReleaseBundleMemberRootSet,
  ReleaseBundleMemberReconciliation, PromotionEvidenceSupportRootSet,
  PromotionEvidenceSupportReconciliation, ReleaseBundleEnvelope,
  ProductionImportBatchManifest or its batch class,
  ProductionImportEnumeratorIndependenceAttestation,
  ProductionImportWalkerRunClaim, ProductionImportWalkerSpoolCommitmentRoot,
  ProductionImportWalkerOutputAttestation,
  ProductionImportWalkerOutputSetAttestation,
  ProductionWalkerSpoolErasureReceipt or either
  ProductionWalkerSpoolErasureReceiptSetAttestation,
  ProductionImportControlReceiptRoot, ProductionImportMemberRootSet,
  ProductionImportSupportRootSet, ProductionImportControlReceiptReconciliation,
  ProductionImportReconciliation, ProductionImportSupportReconciliation,
  ProductionBlobAvailabilityRoot or reachable node, importer
  CompositionContractSetRecompositionRoot or reachable node,
  ProductionImportSeal or
  ProductionSemanticParityRoleRegistry,
  ProductionSemanticParityEnumeratorIndependenceAttestation, run slot, claim,
  WalkerOutputSpoolCommitment, ProductionSemanticParitySpoolCommitmentRoot,
  role output, output-set or reconciler attestation,
  ProductionMarketObservationParityRootPair,
  ProductionMaterialisedCohortParityRootPair,
  ProductionMarketAggregateParityRootPair,
  ProductionServingContractMetadataParityRootPair,
  ProductionSemanticParityAttestation, ProductionImportAttestation,
  PostActivationControlActionRegistry, PostActivationControlContext, event,
  head, PostActivationControlReceipt, pass-commit lease or
  PostActivationFailureEvidence, LegacyBaselineRestorationPostCommitPolicy,
  context, event, head, receipt or failure evidence, V2 restoration-abandonment
  decision, claim,
  relationship effect,
  metric, query dimension, result, registry entry,
  WalkerHarnessExecutionPolicy or profile,
  route, schema, test or
  released row fails exact bidirectional set equality even when counts remain
  equal.
- `SCOPE-EXCLUSION-01`: inserting or changing an exclusion after scope freeze
  invalidates the candidate; `FAILED` or unexplained `NOT_EXAMINED` in any
  expected optional or required slot blocks. The sole `NOT_EXAMINED` publication
  path is an incomplete non-market Review row under a complete reconciled
  `CONTRACT_EXPANSION_REEXAMINATION_PENDING` manifest, never a scope exclusion;
  moving a failed deal, family or slot into
  exclusions without pre-freeze evidence and Ben approval cannot pass. An
  exclusion never discharges a dependency or counts as examined evidence.
- `DEPLOY-CUTOVER-01`: changing any certified executable input blocks
  promotion; concurrent or partially failed activation yields one complete old
  or new generation; a self-referential or forward-referential release bundle
  fails; authorisation replay fails; every typed post-activation READY, trace or
  smoke failure first commits its BEGIN receipt and pending head, then disables
  exposure through the acknowledged higher BLOCKED fence and drain before the
  COMPLETE receipt may fix the selected containment outcome through its owned
  tuple CAS or exact prior-revocation adoption. A crash at any point
  remains fail-closed and never claims a partial prior tuple.
  Re-exposing the prior tuple requires the historical eligibility, purpose-bound
  hold and full fresh authorisation and activation ceremony. Smoke from another activation, release,
  generation or DeploymentManifest cannot satisfy completion even when the
  frozen contract pair is identical. Gate revocation, Vercel alias repointing,
  selected-intake revocation, environment-reference change and database schema
  or migration change are each raced between CutoverAuthorisation and activation
  commit. The readiness
  generation changes or the locked recheck fails with zero release-state change;
  a stale or replayed live-provider assertion fails, and an out-of-band runtime
  identity mismatch serves zero corpus data.
- `READINESS-CAS-01`: stale predecessors, duplicate generations, forks and two
  concurrent revokers cannot produce two current mirrors. Gate expiry, selected
  intake revocation, status revocation, alias repoint, environment-reference
  change and schema migration
  each CAS a higher signed `REVOKED` row before status publication or external
  change. Activation locking first may finish; revocation locking first causes
  zero activation DML.
- `ROLLBACK-FULL-TUPLE-01`: ActivationEvent reproduces the exact complete before
  and after tuples. Mutating deployment, provider identity, runtime build,
  configuration, alias, schema, migration, CandidateReleaseManifest selector,
  CorpusRelease, namespace, header, metadata pair or ProductionImportAttestation
  individually makes partial restore
  impossible. Failure injection after every database transition yields the
  unchanged after tuple or a higher exposure-off tuple, never an old release
  under target environment fields. A newer generation prevents overwrite, and
  all target-generation cache entries become unusable. Every ordinary
  exposure-off transition also produces its exact typed RollbackEvent and
  ActiveReleaseRevocationReceipt; an unreceipted higher tuple cannot be adopted
  by containment.
- `CONTAINMENT-REVOCATION-CONVERGENCE-01`: race every cause in the exact
  ActiveReleaseRevocationActionRegistry before, during and after each post-
  activation and legacy BEGIN from every awaiting state, including a
  post-issuance AWAITING_SMOKE head with no earlier failure trigger. If
  revocation wins the awaiting-head lock, its one database commit must write the
  ordinary event and receipt, matching `ACTIVE_RELEASE_REVOCATION` or
  `LEGACY_ACTIVE_RELEASE_REVOCATION` evidence, `ADOPT_PRIOR_EXPOSURE_OFF`
  disposition and existing BEGIN action's pending head and receipt; COMPLETE
  must preserve the exact higher tuple. A second revocation then sees pending
  and must join COMPLETE or write zero DML. If BEGIN commits first, the ordinary writer
  must join the exact COMPLETE action or perform zero database DML; it cannot
  create a newer tuple that strands the pending head. The owned variant alone
  performs its fixed CAS. A missing receipt, chain gap or fork, changed field,
  wrong generation, cross-controller event, third variant or post-BEGIN independent revocation
  fails closed. Both legal interleavings reach the same absorbing controller
  state and never re-enable exposure. A revocation that commits an exposure-off
  tuple while leaving an observed awaiting controller non-terminal fails the
  atomic-coupling invariant.
- `POST-ACTIVATION-CONTROLLER-01`: create ActivationEvent,
  PostActivationControlContext, `AWAITING_READY` head and OPEN_WITH_ACTIVATION
  receipt atomically, then require the sole controller to use the exact seven-
  entry PostActivationControlActionRegistry. The success path is ADOPT_READY,
  ADOPT_POST_ACTIVATION_TRACE, ISSUE_PASS_COMMIT_LEASE and COMMIT_PASS. The
  failure path from any AWAITING state is BEGIN_FAILURE_CONTAINMENT,
  `FAILURE_CONTAINMENT_PENDING`, variant-ordered acknowledged external containment and
  COMPLETE_FAILURE_CONTAINMENT. Each action appends one event, advances one
  head and writes one receipt in that order. A missing receipt, stale
  predecessor, skipped state, generic failure action, eighth action, direct
  awaiting-to-FAILURE_FIXED edge, duplicate context, direct head DML or another
  writer performs zero control, fence or release-state mutation. Programme
  completion accepts only the exact COMMIT_PASS receipt and PASS_FIXED context.
- `POST-ACTIVATION-CONTROL-RECEIPT-01`: exercise all seven action-registry
  entries from each permitted and forbidden predecessor. Every permitted action
  writes its immutable event, compare-and-swaps the exact head and then writes
  one PostActivationControlReceipt binding before and after heads, action
  result, lease-slot effects and canonical request. Fault injection at each
  boundary yields the complete predecessor or complete successor. Exact replay
  returns the same receipt; conflicting replay, an event that hashes its later
  head or receipt, a head without its receipt, a receipt from another action or
  any action-only wildcard writes nothing. For COMMIT_PASS, the receipt follows
  the PASS_FIXED head and lease consumption but precedes, and is selected by,
  the AVAILABLE successor and any genesis-establish objects; it hashes only the
  pre-effect success plan. POST_ACTIVATION traces only the
  OPEN_WITH_ACTIVATION and ADOPT_READY receipts. On success, POST_COMPLETION
  traces the later ADOPT_POST_ACTIVATION_TRACE event, AWAITING_SMOKE head and
  receipt before the issue-lease and COMMIT_PASS receipts and success effects;
  on failure, the exact failure terminal traces that later adoption chain if it
  exists. For historical COMPLETE, the failure event, FAILURE_FIXED head and
  receipt precede the failed-or-abandoned outcome and OUTCOME_FIXED branch CAS;
  the receipt hashes only its pre-outcome result plan.
- `POST-ACTIVATION-CONTAINMENT-PENDING-01`: for every failure trigger and every
  AWAITING predecessor, race COMMIT_PASS against BEGIN_FAILURE_CONTAINMENT.
  BEGIN must atomically revoke any unconsumed lease, write its receipt and fix
  one tuple disposition and FAILURE_CONTAINMENT_PENDING. For the owned order
  those objects precede the higher BLOCKED fence and drain; for the adopted
  order the registered ordinary fence, drain, RollbackEvent and receipt precede
  the atomically coupled revocation evidence, disposition and BEGIN, with no
  second fence. Pause and crash before and after BEGIN, fence publication,
  acknowledgement, drain, each owned and adopted tuple path and COMPLETE. Missing external
  evidence leaves the controller pending and fail-closed. Only COMPLETE may
  consume the exact BEGIN receipt and pending head, perform the bounded
  containment effects and write the COMPLETE receipt and FAILURE_FIXED head;
  only that receipt proves the final selected exposure-off tuple. Pause through
  and beyond the fixed containment deadline; the identical pending transition
  remains completable only with trusted CONTAINMENT_DEADLINE_EXCEEDED evidence
  and cannot strand or enable service.
  Direct awaiting-to-failure, containment-owned external work before BEGIN, an
  adopted order with missing or cross-context ordinary controls, pass after
  BEGIN, COMPLETE with stale or cross-context evidence and replay with changed
  evidence all write no contradictory state.
- `POST-ACTIVATION-TRIGGER-01`: exercise every closed trigger at its governed
  boundary: `READY_PUBLICATION_FAIL`, `READY_PUBLICATION_TIMEOUT`,
  `POST_ACTIVATION_TRACE_FAIL`, `POST_ACTIVATION_TRACE_TIMEOUT`, `SMOKE_FAIL`,
  `SMOKE_TIMEOUT`, `SMOKE_CRASH`, `PASS_COMMIT_LEASE_EXPIRED` and
  `ACTIVE_RELEASE_REVOCATION`. Exactly one trigger produces the matching
  PostActivationFailureEvidence union member, which must be selected first by
  the BEGIN receipt and later by the COMPLETE receipt before FAILURE_FIXED. Only
  SMOKE_FAIL requires a failed PostCutoverSmokeAttestation;
  PASS_COMMIT_LEASE_EXPIRED requires the passing smoke, issuance chain, expired
  slot and pass-effect absence proof; ACTIVE_RELEASE_REVOCATION requires its
  complete registry-backed ordinary chain. An earlier trigger or unfinished
  smoke requires the typed no-failed-smoke absence proof. Unknown,
  duplicate, caller-selected or stage-inapplicable triggers fail closed.
- `POST-ACTIVATION-LATE-PASS-01`: pause each READY, trace, smoke, pass-lease,
  COMMIT_PASS, AVAILABLE and first-cutover establish transaction and race the
  registered BEGIN action and every ActiveReleaseRevocationActionRegistry cause.
  The shared control-head, tuple, promotion and readiness locks allow only one
  predecessor-valid linearisation. The lock winner may commit its one complete
  predecessor-valid transition. Pause an issued lease past expiry with and
  without controller death and require deterministic
  PASS_COMMIT_LEASE_EXPIRED BEGIN-to-COMPLETE fixation. If ordinary revocation
  wins while the head is awaiting, its database commit must include the typed
  revocation evidence and coupled pending head, not merely make COMMIT fail;
  once FAILURE_CONTAINMENT_PENDING, every late
  pass, AVAILABLE, establish and programme-completion write fails, and once
  FAILURE_FIXED it remains failed. Once PASS_FIXED, every late BEGIN or COMPLETE
  fails. A stale passing smoke or lease from another context never closes the race.
- `POST-ACTIVATION-FAULT-BOUNDARY-01`: inject a database fault before and after
  every event, head CAS, receipt, fence, release-state, smoke, trace and pass-
  lease write, and before and after every BEGIN, external-containment and
  COMPLETE step, in the post-activation controller. Each action leaves the exact
  predecessor tuple or one complete successor tuple with its declared terminal
  receipt. No partial READY exposure, unheaded event, head without receipt,
  orphan or terminally stranded expired pass lease, containment-owned external
  work without a pending head, adopted ordinary controls without the atomically
  coupled pending head, AVAILABLE fence after BEGIN or untraceable failure
  evidence is possible; retry is exact
  replay or a new governed successor.
- `LEGACY-RESTORATION-TRANSACTION-01`: for each writer-derived restoration
  ordinal, inject failure before and after every tuple-field, attestation,
  restoration receipt and post-commit controller-genesis write. First restore and independently verify the
  retained external deployment, runtime, configuration, alias, schema and
  migration under BLOCKED exposure. Success then revalidates those proofs and
  atomically restores the exact database selector and complete higher V3
  `LEGACY_BASELINE` release-state tuple under BLOCKED exposure, writes one
  passing LegacyBaselineRestorationAttestation and COMMIT_PASS receipt and opens
  exactly one LegacyBaselineRestorationPostCommitContext at
  AWAITING_READY_LEGACY with its genesis receipt. It does not itself return the
  genesis head or publish READY_LEGACY_BASELINE. RECORD_FAIL writes no
  post-commit context. Database failure changes none of
  those database authorities and records only its immutable failed attempt; any
  already restored external state remains inaccessible behind BLOCKED. Two restorers,
  stale ordinals, partial tuples and mixed canonical/legacy values cannot win.
- `LEGACY-RESTORATION-POST-COMMIT-01`: after COMMIT_PASS, exercise the exact
  five-action LegacyBaselineRestorationPostCommitPolicy. The success chain is
  OPEN_WITH_RESTORATION_PASS, ADOPT_READY_LEGACY and
  ADOPT_LEGACY_SMOKE_AND_FIX, each with event, head and receipt, ending only at
  LEGACY_READY_FIXED and its receipt before genesis-head return, no-recovery fixation and the
  LEGACY_RESTORED topology. Race each success action against
  BEGIN_POST_COMMIT_ABANDONMENT. In the owned order BEGIN must fix
  ABANDONMENT_PENDING and its receipt before the higher BLOCKED reblock and
  drain. In the adopted order, exercise every ordinary-revocation cause from
  both awaiting legacy states and require the ordinary fence, drain, event and
  receipt, `LEGACY_ACTIVE_RELEASE_REVOCATION` evidence, adopted disposition and
  BEGIN pending head and receipt in the one required order and atomic database
  commit, with no second fence. Only COMPLETE may consume
  those effects and the exact tuple disposition, either perform the owned CAS or
  preserve an adopted prior revocation, and write the completion event,
  LEGACY_ABANDONED_FIXED head and receipt. The resulting V2 abandonment decision
  must be exactly POST_COMMIT_PASS_FAILURE and must follow that receipt; branch
  fixation follows the decision. Pause before and after the fixed containment
  deadline. The same pending context remains completable after the deadline only
  with trusted CONTAINMENT_DEADLINE_EXCEEDED evidence and the identical trigger,
  tuple disposition, fence and drain scope; it may never strand or enable service. Separately,
  one or more RECORD_FAIL receipts with no COMMIT_PASS or post-commit context
  admit only PRE_COMMIT_FAILURE. Mixing variants, direct awaiting-to-fixed
  transitions, success after BEGIN, containment-owned abandonment before BEGIN,
  an adopted BEGIN without its complete registry-backed revocation chain, crash replay,
  missing receipt or a third decision variant fails closed.
- `LEGACY-RESTORATION-TRACE-UNION-01`: build all six
  FailureTraceabilityObjectRegistry terminal evidence variants and require each registry-declared
  presence and absence proof, distinct derived reason and disposition and the
  same reason-independent terminal-slot formula. A terminal selects POST_IMPORT
  as predecessor when the controller failed before POST_ACTIVATION closed and
  POST_ACTIVATION otherwise. Every variant carries the originating BEGIN
  receipt, ContainmentReleaseTupleDisposition,
  FAILURE_CONTAINMENT_PENDING head, acknowledged containment,
  COMPLETE receipt and FAILURE_FIXED head. LEGACY_RESTORED additionally carries
  the post-commit success controller; LEGACY_RESTORATION_ABANDONED carries
  exactly one V2 PRE_COMMIT_FAILURE or POST_COMMIT_PASS_FAILURE decision;
  HISTORICAL_FAILED_AFTER_ACTIVATION carries a second BEGIN-pending-COMPLETE
  chain; HISTORICAL_SUCCEEDED carries ISSUE_PASS_COMMIT_LEASE and COMMIT_PASS
  receipts. Every applicable `ACTIVE_RELEASE_REVOCATION` or
  `LEGACY_ACTIVE_RELEASE_REVOCATION` branch carries its exact action-registry
  entry, cause, fence, drain, ordinary RollbackEvent, receipt and exposure-off
  tuple in the declared adopted order; lease expiry carries its passing smoke,
  issuance chain and pass-effect absence proofs. Requiring failed smoke for a pre-smoke fault, accepting a legacy-
  ready fence on abandonment, accepting historical activation on pre-activation
  abandonment, omitting either containment receipt or adding an object
  forbidden by the variant fails both evidence and trace reconciliation.
- `FAILURE-RECOVERY-RACE-01`: force one canonical smoke failure and prove its
  BEGIN transaction writes one pending head and receipt or none, then prove only
  COMPLETE can consume acknowledged containment and atomically write one
  RollbackEvent, one FailureRecoveryBranch, one `OPEN` branch head, one
  FAILURE_FIXED head and one COMPLETE receipt. Race COMMIT_PASS against BEGIN,
  COMPLETE against crash replay and no-recovery fixation against
  historical-reactivation start, two starts, success against abandonment, two
  outcome fixers, terminal construction against each fixer and two terminal
  builders carrying different derived reasons. Exactly one permitted head CAS
  wins, `OUTCOME_FIXED` is absorbing and exactly one reason-independent terminal
  slot and wrapper result exist. COMPLETE-before-BEGIN, terminal-before-fixed, head mutation after terminal,
  reactivation after no-recovery, a second attempt after abandonment, outcome
  replacement and a wrapper keyed by reason all fail with no branch, serving or
  trace mutation. Exact replay returns the original head or wrapper.
- `FIRST-CANONICAL-LEGACY-ROLLBACK-01`: start from the current production-shaped
  legacy fixture, create one LegacyBaselineRollbackTarget, restore its snapshot
  into isolated staging and pass the complete rollback rehearsal. Initialise
  V3 `LEGACY_BASELINE`, `READY_LEGACY_BASELINE` and the genesis head; activate
  the first candidate under `FIRST_CANONICAL_IN_PROGRESS`, publish
  `READY_CANONICAL` and force smoke failure. The originating BEGIN receipt and
  pending head must precede BLOCKED exposure and drain; the COMPLETE receipt
  and FAILURE_FIXED head must atomically open one recovery branch before the
  exact legacy deployment, data selector,
  configuration, alias, schema and migration tuple is restored under a higher
  generation. A passing LegacyBaselineRestorationAttestation, genesis-head
  COMMIT_PASS receipt, post-commit READY and smoke receipts,
  LEGACY_READY_FIXED, genesis-head return and `READY_LEGACY_BASELINE` must precede
  `NO_HISTORICAL_REACTIVATION`, the exact `LEGACY_RESTORED` failure-evidence
  variant and the one failure terminal. Mutate each target,
  rehearsal, provider assertion, tuple field, variant tag, fence state, smoke
  result and head predecessor independently; omit the retained bytes; mix
  canonical and legacy fields; race two initialisers or two restorers; or run
  the rehearsal against production. Every case leaves BLOCKED exposure and no
  passing restoration. A governed irrecoverable-restoration fixture writes one
  terminal FAIL attestation and V2 PRE_COMMIT_FAILURE abandonment, fixes
  `NO_HISTORICAL_REACTIVATION`, selects only
  `LEGACY_RESTORATION_ABANDONED`, leaves exposure BLOCKED and creates exactly one
  `ABANDONED` failure terminal; retry and readiness then fail. A separate
  COMMIT_PASS-then-post-commit-failure fixture must reach ABANDONMENT_PENDING,
  complete reblock and drain, reach LEGACY_ABANDONED_FIXED and select only the
  POST_COMMIT_PASS_FAILURE decision before the same topology variant. In the separate
  successful-restoration fixture, after a later first candidate passes smoke and fixes
  `CANONICAL_ESTABLISHED`, reuse of the legacy target or any
  `READY_LEGACY_BASELINE` transition writes nothing.
- `RELEASE-STATE-V3-01`: exercise both tagged variants and all three serving-
  fence states. A canonical token reaches only the canonical set-based serving
  RPC; a legacy token reaches only the exact target-bound legacy runtime. Null,
  mixed, wrong-variant, stale-generation and cross-fence payloads fail before
  cache or data access. Blocking either ready state drains its own leases, and
  no cache entry or admission token survives the variant or generation change.
- `HISTORICAL-REACTIVATION-ADVANCED-HEAD-01`: activate release R1, complete its
  immutable PASS chain, advance CandidateInputHead through R2 scope, extraction
  and correction changes, activate R2 and force its smoke to fail. After the
  RollbackEvent, unique FailureRecoveryBranch, `OPEN` head and exposure-off tuple
  commit, CAS the head to `HISTORICAL_REACTIVATION_IN_PROGRESS` and revalidate R1's retained namespace
  and exact prior PASS evidence against current policy, revocation and dependency
  heads, restore its exact deployment, runtime, configuration, alias, schema and
  migration fields, acquire `HELD(HISTORICAL_REACTIVATION)` from REVOKED and
  reactivate every R1 tuple field under one higher state generation. The old R1
  CandidateInputRecheckAttestation must fail the current-candidate branch and
  must not appear as historical authority; the historical proof binds the
  advanced current head without equating or rewinding it. Mutate each current
  policy, revocation, dependency, retained byte, namespace/header, prior PASS
  evidence, provider assertion, schema-compatibility proof, before tuple and
  target field independently and require zero exposure-enabling DML. Passing
  fresh smoke releases AVAILABLE, fixes `HISTORICAL_REACTIVATION_SUCCEEDED` and
  selects `HISTORICAL_SUCCEEDED` only with the exact issue-lease and COMMIT_PASS
  receipts. Abandonment before ActivationEvent remains
  exposure-off and selects `HISTORICAL_ABANDONED_PRE_ACTIVATION`; failure after
  ActivationEvent requires second containment and selects
  `HISTORICAL_FAILED_AFTER_ACTIVATION` only after its distinct
  BEGIN-pending-COMPLETE receipt chain. The latter two may share the governed
  failed-or-abandoned recovery outcome but never the evidence variant, reason or
  disposition. All three variants produce one complete terminal through the
  same reason-independent slot and cannot satisfy programme_complete.
- `PROGRAMME-COMPLETE-01`: passing smoke alone cannot open programme completion;
  the exact POST_ACTIVATION extension, passing P9_TRACEABILITY prefix evidence,
  passing smoke, AVAILABLE promotion successor and ProgrammeCompletionAttestation
  must precede an immutable proposed terminal status. The
  `P9_PROGRAMME_COMPLETION_ATTESTATION` evidence envelope proves only those
  preterminal facts and does not claim later POST_COMPLETION coverage or atomic
  publication. Only a passing
  POST_COMPLETION extension covering those final objects and that status, plus
  atomic publication of their exact pair, satisfies the final registry
  predicate. Any missing, mismatched, reordered, partial, stale or later
  untraced status reference fails closed.
