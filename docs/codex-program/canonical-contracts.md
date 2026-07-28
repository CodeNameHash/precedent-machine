# Canonical corpus v2: detailed canonical contracts

This file is the sole authority for detailed identities, state machines, writer grammars, release contracts and traceability contracts. The governing architecture, governance, phases and implementation sequence remain in [the programme spine](../CODEX-PROGRAM.md).

## Binding target architecture: detailed contracts

### 0. One authoritative contract source

- `lib/schema/canonical/contract-v2/manifest.json` and its closed, digest-listed
  file set form `CanonicalContractBundle`, the sole editable authority for legal
  concepts, governed aliases, legal primitive definitions, parties, claim and
  claim-scope definitions, relationship and
  relationship-effect definitions, result and metric definitions, result-input
  lineage and ExpectedResultInputLineageSlot schemas, independently authored semantic-question and
  composition-question catalogues,
  correction slots, CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  ManifestMembershipRevision, CorrectionDischarge, CorrectionDischargeMap and
  MultiSubjectScopeCorrectionReceipt/V2 schema,
  IntakeDispositionPolicy, IntakeTransitionDefinition,
  source-admission rules, SourceAdmissionApprovalAttestation,
  SourceAdmissionPreparationReceipt,
  ExcerptDefinition,
  CandidateInputEvent, both correction-ledger and
  correction-head schemas, ScopeBuildHead, DealExtractionBuildHead,
  FamilyBuildHead and CandidateBuildHead state machines and transition receipts,
  CandidateInputSeal, CandidateOutputSeal, CandidateReleaseFreezeAttestation,
  CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot,
  CandidateInputRecheckEnumeratorRegistry,
  CandidateInputRecheckEnumerationProof and
  CandidateInputRecheckIndependenceProof embedded-proof schemas,
  CandidateInputRecheckAttestation, HistoricalReactivationEligibilityAttestation,
  PromotionEligibilityProof, CandidatePromotionFence,
  `LegacyBaselineRollbackTarget`, `LegacyBaselineRollbackRehearsalAttestation`,
  `LegacyBaselineRestorationAttestation`, `LegacyBaselineRestorationReceipt`,
  `LegacyBaselineRestorationReceiptHead`,
  `LegacyBaselineRestorationAbandonmentDecision`,
  `LegacyBaselineRestorationPostCommitPolicy`,
  `LegacyBaselineRestorationPostCommitContext`,
  `LegacyBaselineRestorationPostCommitEvent`,
  `LegacyBaselineRestorationPostCommitHead`,
  `LegacyBaselineRestorationPostCommitReceipt` and
  `LegacyBaselineRestorationPostCommitFailureEvidence`,
  `CanonicalCutoverGenesisEvent`,
  `CanonicalCutoverGenesisHead`, `FailureRecoveryBranch`,
  `FailureRecoveryBranchSlot`, `FailureRecoveryBranchHead`,
  `FailureRecoveryOutcome`,
  `PostActivationControlPolicy`, `PostActivationControlActionRegistry`,
  `PostActivationControlContext`,
  `PostActivationControlEvent`, `PostActivationControlHead`,
  `PostActivationControlReceipt`, `PostActivationFailureEvidence`,
  `PostActivationPassCommitLease`, `ActiveReleaseRevocationActionRegistry`,
  `ActiveReleaseRevocationReceipt`,
  `ContainmentReleaseTupleDisposition`,
  `TraceabilityFailureTerminalSlot` and
  ServingFenceVersion, TraceabilityExtension, FailureTraceabilityObjectRegistry
  and TraceabilityFailureTerminal schemas and the complete SemanticStageRegistry,
  SemanticStageOutputSetRoot, SemanticNeutralProjectionSetRoot,
  RelationshipEffectFieldUniverseSetRoot,
  RelationshipEffectConstraintSetRoot,
  CandidateRelationshipProjectionAttestation and
  CandidateCompositionContractProjectionAttestation,
  CandidateCompositionInstanceProjectionAttestation and
  CandidateCompositionInstanceConformance,
  CompositionContractSetRecompositionRoot,
  CompositionContractSetEnumeratorIndependenceAttestation and
  CompositionContractSetAttestation, CompositionContextKeyUniverse and
  CandidateCompositionImplementationCatalogue schemas, a
  DealDocumentOrderingDefinition, `ImmutableSourceDocument`,
  `SemanticExtractionInputEnvelope`, `SemanticInferenceTranscript`,
  `ReviewedInferencePayload`, `SemanticGraphNormaliserDefinition`,
  `ValidatedSemanticGraph`, its `DefinitionCue` and `DefinitionUseCue` graph-node
  schemas, units,
  `OpenWorldSemanticCandidate`, `OpenWorldCandidateOccurrence`,
  `OpenWorldCandidateSupersession`, `OpenWorldCandidateKindSupersession`,
  `OpenWorldCandidateAdmissionTransition`,
  `OpenWorldCandidateAuditChainRoot`, `OpenWorldEffectiveOccurrenceRoot`,
  `OpenWorldCandidateChainReconciliation`,
  `OpenWorldEvidenceClosure`, `OpenWorldPrimitiveObservation`,
  `OpenWorldPrimitiveRelationship`, `OpenWorldPrimitiveCollectionRoot`,
  `OpenWorldCandidateDisposition`,
  `ReviewedSourceSpecificPublicationDecision`,
  `OpenWorldCandidateDispositionManifest`, `OpenWorldReviewQueueRoot`,
  `SemanticImpactWalkerOutput`,
  `SemanticImpactEnumeratorIndependenceAttestation`, `SemanticImpactClosure`,
  `ApplicabilityEligibleMemberKindProducerRegistry`,
  `ApplicabilityReexaminationRequirementDefinition`,
  `ApplicabilityReexaminationRequirementSetRoot`,
  `ApplicabilityReexaminationRequirement`, `ApplicabilityReexaminationEntry`,
  `ApplicabilityReexaminationSlice`, `ScopeSubjectApplicabilityRoot`,
  `ApplicabilityReexaminationEnumeratorIndependenceAttestation`,
  `ApplicabilityReexaminationReconciliation`,
  `ApplicabilityReexaminationManifest`,
  `MetricApplicabilityRequirementProjection`,
  `MetricApplicabilityRequirementProjectionSet`,
  `ReviewedSourceSpecificOutputClosure`, `MarketMetricSlotExclusion` and
  `OpenWorldSimilarityProposal` schemas and the closed candidate-kind,
  candidate-disposition, `OpenWorldSemanticImpactDisposition`, result-completeness and market-
  comparability enums,
  normalisers, dependency DAGs, OperationActionRegistry,
  CanonicalPhysicalCarrierRegistry, CanonicalWriterDispositionRegistry,
  BoundedInventoryTree, InventoryEnumeratorIndependenceAttestation,
  CandidateManifestLaterObjectExclusionRegistry,
  ReleaseBundleMemberDispositionRegistry, PromotionEvidenceSlotRegistry,
  ReleaseBundleEnumeratorIndependenceAttestation,
  ReleaseBundleControlPolicy, ReleaseBundleControlContext,
  ReleaseBundleControlEvent, ReleaseBundleControlHead,
  ReleaseBundleControlReceipt,
  ReleaseBundleControlAbandonmentTerminal,
  ReleaseBundleControlFailureEvidenceSlot,
  ReleaseBundleControlFailureEvidence and
  ReleaseBundleSpoolErasureReceipt,
  ReleaseBundleSpoolErasureReceiptSetAttestation,
  ReleaseBundleWalkerRunClaim, ReleaseBundleWalkerOutputAttestation and
  ReleaseBundleWalkerOutputSetAttestation,
  ProductionImportEnumeratorIndependenceAttestation,
  ProductionImportFailureEvidenceSlot,
  ProductionImportFailureEvidence,
  ProductionImportAbandonmentTerminal,
  ProductionWalkerSpoolErasureReceipt,
  ProductionWalkerSpoolErasureReceiptSetAttestation and
  ProductionImportWalkerRunClaim, ProductionImportWalkerOutputAttestation and
  ProductionImportWalkerOutputSetAttestation and
  ProductionImportWalkerSpoolCommitmentRoot,
  ProductionSemanticParityRoleRegistry,
  ProductionSemanticParityEnumeratorIndependenceAttestation,
  ProductionSemanticParityRunSlot,
  ProductionSemanticParityRunClaim,
  ProductionSemanticParityRoleOutputRootSet,
  ProductionSemanticParityWalkerOutputAttestation,
  ProductionSemanticParityTwoRoleOutputSetAttestation,
  ProductionSemanticParityReconcilerOutputAttestation,
  ProductionSemanticParitySpoolCommitmentRoot,
  ProductionSemanticParityTerminalOutputSetAttestation and
  ProductionSemanticParityAttestation,
  ProductionServingContractMetadataParityRootPair,
  ProductionMarketObservationParityRootPair,
  ProductionMaterialisedCohortParityRootPair and
  ProductionMarketAggregateParityRootPair,
  ServingNamespaceHeader, `BlockedResultPreviewDefinition`,
  WalkerHarnessExecutionPolicy,
  WalkerSpoolErasureJournalEntry, WalkerSpoolErasureEvidence,
  WalkerOutputChunkDescriptor, WalkerOutputSpoolCommitment,
  ReleaseBundleWalkerSpoolCommitmentRoot,
  WalkerTrustStatusHead schema and transition
  policy, WalkerTrustStatusProof,
  GlobalMutableAuthorityRegistry, GeneratedLockPlanRegistry,
  ProgrammeStatusPublicationHead, AttemptAuditObjectRegistry,
  AttemptAuditTerminalSlot, AttemptAuditRequiredObjectRoot,
  AttemptAuditCoverageProjectionRoot, AttemptAuditReconciliation,
  AttemptAuditTerminal,
  TraceabilityPhaseObjectRegistry,
  traceability base and extension, production-import lifecycle and terminal
  programme-completion-pair schemas,
  `CanonicalBundleInputIdentity`, QueryDefinitionSetRoot,
  QueryGoldenSuiteManifest, the QueryGoldenCertificationAttestation schema,
  query and serving-key definitions,
  ServingCacheIdentityDefinition,
  CanonicalServingCacheIdentity, CanonicalServingCacheValue and
  ServingResponseBinding schemas, serving-row
  schemas, ServingObjectAccessRegistry, OfflineCertificationArtefactDenylist,
  ServingEmbeddedReferenceAllowlist and
  certification-policy schemas. It has one versioned root manifest, a closed
  file set and one content fingerprint.
- `CanonicalBundleInputIdentity` is the pre-freeze identity of the complete
  authored bundle input, before any generated root or bundle fingerprint exists.
  Its ID hashes `CANONICAL_BUNDLE_INPUT/V1`, schema and the root input-manifest
  ID and payload digest; the contract-ordered `(relative_path, object_kind,
  stable_id, canonical_bytes_digest)` entries for every authored definition,
  policy, schema and human-reviewed golden fixture; compiler-input and generator-
  input schema versions; per-kind counts; and fixed empty missing, extra,
  duplicate and conflicting-input roots. It excludes every generated output,
  QueryDefinitionSetRoot, QueryGoldenSuiteManifest, bundle fingerprint,
  ContractFreezeAttestation and QueryGoldenCertificationAttestation. The
  generated QueryDefinitionSetRoot and QueryGoldenSuiteManifest bind this
  identity and the exact authored members they inventory. The generated,
  pair-independent `ApplicabilityEligibleMemberKindProducerRegistry` is then
  compiled from this identity and the authored member-kind and producer rules;
  every generated `ApplicabilityReexaminationRequirementDefinition` binds that
  registry and this identity, and
  `ApplicabilityReexaminationRequirementSetRoot` closes the complete ordered
  definition universe. All three are generated bundle members. They precede the
  closed generated-output manifest, final fingerprint and freeze and contain no
  final bundle fingerprint, ContractFreezeAttestation, frozen pair,
  CorpusRelease, candidate generation or candidate object. The final
  CanonicalContractBundle fingerprint then hashes `CANONICAL_CONTRACT_BUNDLE/V3`,
  schema, this input identity, the closed generated-output manifest and its
  contract-ordered output IDs and canonical payload digests, including those
  three applicability members. No generated member may hash that final
  fingerprint unless it is expressly a post-compilation attestation outside the
  bundle.
- The governing taxonomy rule is: **the taxonomy is closed within a published
  corpus release but extensible between releases. Every discovered legal
  proposition requires a final disposition, but not every proposition must
  become a permanent cross-deal concept.** For a CorpusRelease, the complete
  substantive concept, governed-alias, claim, relationship, result, metric and
  query-key universe is exactly the universe in its frozen
  CanonicalContractBundle. No source instance, model, correction, similarity
  cluster, serving row or query may add a key, alias two propositions or create
  comparability inside that release. A later reviewed bundle may extend the
  universe; it creates a successor frozen pair and successor CorpusRelease and
  never mutates the taxonomy, rows or cohort membership of a historical release.
- `WalkerHarnessExecutionPolicy` is a frozen contract object, not runtime
  configuration. Its ID hashes `WALKER_HARNESS_EXECUTION_POLICY/V2`, schema,
  policy key and version and exact `RELEASE_BUNDLE` and `PRODUCTION_IMPORT`
  profiles. Each profile fixes the harness executable and reproducible-build
  digest, expected runtime measurement and measurement algorithm, sandbox
  runtime executable, configuration and policy digest, mandatory fork, clone,
  child-exec, re-entry, supervisor, network, IPC and persistent-state denials,
  transcript schema and canonicalisation, required launch, invocation, output
  and process-termination predicates, attestation-verifier executable and
  configuration, permitted algorithms, complete attestation trust-root and
  intermediate-key set with validity and revocation rules, and launch-token
  issuer executable, configuration, issuer trust chain, audience, context and
  role claims, maximum lifetime, one-use semantics and consumption-proof
  schema. Only public verification material and digests enter the policy. Its
  exact ID and payload digest enter the CanonicalContractBundle fingerprint and
  ContractFreezeAttestation; changing a harness, sandbox, trust root, token
  issuer or verifier requires a new frozen contract pair.
- Each profile also fixes one signed idempotent erasure protocol: the erasure-
  controller executable, reproducible-build and configuration digests; journal
  and evidence schemas; accepted signing keys and verification rules; stable
  request-key formula; maximum targets, journal entries, erase calls, post-
  erase readability probes, bytes and elapsed duration per context; and crash-
  replay and terminal-failure rules. A `WalkerSpoolErasureJournalEntry` hashes
  `WALKER_SPOOL_ERASURE_JOURNAL_ENTRY/V1`, schema, profile, complete bundle or
  import context, role and run claim, exact commitment or governed partial-
  stream identity, erasure mode, stable erasure-request key, exact predecessor
  journal entry or `GENESIS`, contiguous attempt ordinal, target chunk and byte
  bounds, trusted start time and one state: `STARTED`,
  `ERASE_CALL_COMMITTED`, `VERIFYING`, `PASS` or `FAIL`. The erasure controller
  signs every entry. A retry after coordinator, process or host failure must
  resume the same request key from its signed journal tip; it cannot allocate a
  new target identity, reset a bound or treat a missing acknowledgement as
  success.
- `WalkerSpoolErasureEvidence` hashes
  `WALKER_SPOOL_ERASURE_EVIDENCE/V1`, schema, exact terminal journal entry,
  target identity and pre-erasure digest and byte count, erase-call result,
  contract-ordered independent post-erasure open, stat and chunk-read probes,
  trusted completion time, cumulative calls, probes, bytes and duration and
  terminal `PASS` or `FAIL`. `PASS` requires every governed access path to
  return the policy's explicit unreadable-or-absent result and the signed
  journal to reach `PASS` within every frozen bound. A crash-replayed request
  returns the byte-identical terminal journal and evidence. Missing journal
  continuity, a still-readable byte, an exceeded bound, a changed request key
  or unverifiable evidence blocks the canonical erasure receipt and receipt-set
  attestation. The journal and evidence are inaccessible operational security
  records, never semantic, release, traceability or serving inputs; only their
  exact terminal IDs and payload digests may be selected by the lifecycle
  receipts below.
- Each harness profile also fixes maximum spool chunks, bytes, logical rows,
  walk duration, sealed-spool lifetime, bounded ingestion duration, terminal-
  commit duration and clock-skew margin. Before a role claim commits, the writer
  proves that the minimum remaining validity of its ROLE_LAUNCH proof, launch
  token, measurement attestation and complete trust chain is strictly greater
  than `maximum_walk_duration + maximum_ingestion_duration +
  maximum_terminal_commit_duration + clock_skew_margin`; otherwise no claim is
  written. The walker itself retains no persistent-state access. The harness
  alone may create one private per-claim ephemeral spool outside the sandbox,
  with no database, network, object-store or canonical-writer credential. It
  captures one stream into contract-bounded chained chunks, waits for exit and
  complete process-tree termination, consumes the launch token and signs a
  terminal spool commitment before canonical ingestion can begin.
- `WalkerOutputChunkDescriptor` hashes `WALKER_OUTPUT_CHUNK/V1`, profile,
  complete bundle or import context, role, run-claim ID, chunk ordinal,
  previous-chunk digest or `GENESIS`, canonical chunk-bytes digest, byte count
  and logical-row count. `WalkerOutputSpoolCommitment` hashes
  `WALKER_OUTPUT_SPOOL_COMMITMENT/V1`, the same context, exact ordered chunk-
  descriptor root, chunk count, total bytes, total rows, complete output-stream
  and transcript digests, launch and invocation counts, exit state, process-
  tree-termination and token-consumption proofs, signed `sealed_at`, signed
  `expires_at`, the exact frozen profile's sealed-spool-lifetime value and
  trusted-clock-evidence ID and payload digest, and terminal `PASS` or `FAIL`.
  `expires_at - sealed_at` must equal the frozen lifetime exactly, `sealed_at`
  cannot precede complete process-tree termination or token consumption, and
  the trusted clock must be admitted by the frozen verifier policy. The harness
  attestation key signs the commitment ID and therefore every time field and
  clock reference. An unsigned, pre-exit, over-limit, not-yet-sealed, expired,
  wrong-lifetime, untrusted-clock, wrong-role or non-PASS commitment cannot
  authorise output DML.
- Three fixed ordered roots close the persisted commitment universes without
  trusting output wrappers to imply physical presence.
  `ReleaseBundleWalkerSpoolCommitmentRoot` hashes
  `RELEASE_BUNDLE_WALKER_SPOOL_COMMITMENT_ROOT/V1`, the complete bundle context,
  independence attestation and exactly the four contract-ordered
  `(role, run_slot_id, run_claim_id, commitment_id, payload_digest, sealed_at,
  expires_at)` records. `ProductionImportWalkerSpoolCommitmentRoot` hashes
  `PRODUCTION_IMPORT_WALKER_SPOOL_COMMITMENT_ROOT/V1`, the complete import
  context, independence attestation and the corresponding six ordered import
  records. `ProductionSemanticParitySpoolCommitmentRoot` hashes
  `PRODUCTION_SEMANTIC_PARITY_SPOOL_COMMITMENT_ROOT/V1`, the complete semantic-
  parity terminal-slot context, role registry, independence attestation and the
  corresponding three ordered semantic-role records. Each root binds its exact
  cardinality and fixed empty missing, extra, duplicate, conflicting,
  wrong-role, wrong-slot, wrong-claim, expired and invalid-lifetime roots. A
  commitment or root from another profile, context, generation or role cannot
  satisfy closure.
- For all thirteen roles, the four bundle roles, six import roles and three
  production-semantic-parity roles, the canonical writer revalidates the signed
  commitment, `sealed_at`, `expires_at`, exact policy lifetime, trusted-clock
  evidence, current trusted time and the claim-selected ROLE_LAUNCH proof before
  every `SPOOL_COMMITMENT`, `TREE_BATCH` and `TERMINAL_OUTPUT` commit. The
  commitment must remain unexpired through the current transaction; an earlier
  successful batch never authorises a later batch or terminal commit after
  expiry. Every bundle-role validation also requires the exact
  `ReleaseBundleControlContext` and current head to remain `OPEN`; a terminal or
  wrong-context commitment writes nothing. Raw spool bytes remain unavailable
  to coordinators and walkers. Raw bytes may be erased only through the V2
  policy's signed journal and unreadability proof. A successful bundle role
  receives one `SUCCESS_AFTER_TERMINAL_OUTPUT`
  `ReleaseBundleSpoolErasureReceipt` while the context is still `OPEN`; all four
  such receipts close one `SUCCESS_PRE_FINALISATION` receipt-set attestation
  before any bundle root or envelope can be finalised. A failed bundle target
  receives one `FAILED_AFTER_ABANDONMENT` receipt only after the immutable
  abandonment terminal, event, head and lifecycle receipt exist. The
  `ABANDONED_CONTEXT` receipt set then partitions the complete four-role target
  universe between already committed success receipts and post-abandonment
  failure receipts. Import and semantic-parity success receipts analogously
  close their six-role `IMPORT_SUCCESS` and three-role `SEMANTIC_SUCCESS` sets;
  an unfinished production target is erasable only after the one immutable
  `ProductionImportAbandonmentTerminal`, and its complete mixed target universe
  closes the `IMPORT_GENERATION_ABANDONED` set. Walker failure, timeout,
  commitment expiry, partial ingestion, process death or a coordinator decision
  alone is not erasure authority.
- `WalkerTrustStatusProof` is a fresh signed operational proof under that frozen
  policy, with exactly two variants. `ROLE_LAUNCH` binds schema, profile,
  bundle, import or import-bound production-semantic-parity context, exact role
  and run slot, independence-attestation ID and payload digest, harness
  measurement, attestation-key and token-issuer
  chains, the current trust, revocation and key-status head IDs and payload
  digests, issued-at, short expiry, nonce and terminal `PASS`. It contains no
  output reference. Its ID and payload digest enter the one run claim and that
  role's output attestation. `CONTEXT_SEAL` is one closed tagged subunion under
  `WALKER_TRUST_STATUS_PROOF/V1`, keyed by exactly one of `RELEASE_BUNDLE`,
  `PRODUCTION_IMPORT` or `PRODUCTION_SEMANTIC_PARITY`. It is issued only after
  every output and every pre-seal success-erasure control for that context kind
  exists. Its common canonical payload binds schema, `CONTEXT_SEAL`, exact
  context kind and immutable context, the same frozen policy and profile, every
  ordered slot, ROLE_LAUNCH proof, claim and output ID and payload digest, the
  complete contract-declared terminal output-set references, freshly observed
  trust, revocation and key-status heads, issued-at, short expiry, nonce and
  terminal `PASS`. The `RELEASE_BUNDLE` arm additionally binds the four spool
  commitments and commitment root, four success-erasure receipts,
  `SUCCESS_PRE_FINALISATION` receipt set, output set, governed member and support
  roots and reconciliations. The `PRODUCTION_IMPORT` arm binds the six
  commitments and commitment root, six `IMPORT_SUCCESS` receipts and receipt
  set, output set, receipt, member and support reconciliations and pre-seal
  terminal roots. The `PRODUCTION_SEMANTIC_PARITY` arm binds the three
  commitments and commitment root, three `SEMANTIC_SUCCESS` receipts and receipt
  set, two-role and terminal output sets, role registry, independence
  attestation and every parity root-pair and difference-root digest. Its ID
  hashes `WALKER_TRUST_STATUS_PROOF/V1`, variant and that one complete
  context-kind payload. An unknown, omitted, mixed or cross-context arm fails
  before proof creation; there are no optional or caller-selected extension
  fields.
  the verifier signature covers the ID and is stored with the proof. The
  canonical writer revalidates the signature, chain, audience, context, role,
  current status heads and expiry immediately before claim, output, bundle-
  envelope, import-seal or semantic-parity terminal DML. A changed or revoked key, stale head, expired
  proof, reused nonce, wrong role or proof from the other context writes nothing.
  A launch proof cannot satisfy a seal and a seal proof cannot be reused across
  contexts or generations.
- The trust, revocation and key-status heads named by a
  `WalkerTrustStatusProof` are authoritative, database-resident operational
  heads with monotonic generations, immutable signed events and one generated
  authority order in GlobalMutableAuthorityRegistry. Every claim, terminal walker output,
  `FINALISE_BUNDLE_CONTROLS`, `SEAL_IMPORT` and semantic-parity `ATTEST_PARITY`
  transaction acquires shared row locks over the complete exact head set before
  final proof validation and holds them through commit. Every trust-root,
  intermediate-key, harness-key or
  token-issuer status change, including emergency revocation, acquires exclusive
  locks over the same rows before advancing a head. Thus validation and the
  authorised DML have one database linearisation interval: if the writer locks
  first, its bounded transaction commits before the later revocation; if the
  revoker locks first, the stale proof writes nothing. No tree generation,
  signature verification or other expensive work occurs while those locks are
  held, and a previously written non-terminal tree cannot authorise a later
  terminal output after revocation. Only the dedicated security-status
  controller may call the versioned `walker_trust_status_update` SECURITY
  DEFINER RPC, which verifies the signed status event, locks the affected heads
  exclusively, appends that immutable event and compare-and-swaps every exact
  predecessor head in one SERIALIZABLE transaction. Application, harness,
  importer, release-builder and canonical-writer roles have no direct status-
  head DML grant; a partial update, stale predecessor or unsigned event writes
  nothing.
- Code, database constraints, generated types, query schemas, UI catalogues,
  compatibility registries and migration-map schemas and validators are
  generated one-way from that bundle. They are never reconciled back into it,
  and generated artefacts cannot be hand-edited. Legacy differences create
  reviewed proposals only.
- The ordinary ResultDefinition and MetricDefinition subtree and the minimal
  `IndependentCompositionQuestionCatalogue` are distinct authored inputs inside
  the closed bundle. Neither is generated from, defaulted by, aliased to or
  permitted to import the other. They may share only governed stable concept,
  question, relationship-effect, result and metric keys. The Freeze Gate records
  separate authorship and eligible legal-semantic review evidence for the
  composition catalogue and rejects a catalogue question copied from generated
  ordinary composition output.
- The ordinary ClaimDefinition, ClaimScopeDefinition, RelationshipDefinition and
  RelationshipEffectSchema question projection and the separately authored
  `IndependentSemanticQuestionCatalogue` are also disjoint inputs. Neither may
  be generated from, defaulted by, aliased to or permitted to import the other.
  They may share only implementation-neutral question keys, primitive value and
  state schemas and stable concept, party and effect-field keys. The independent
  catalogue states its own complete subject applicability, legal proposition,
  qualifier, exception, trigger, party, capacity, temporal, dependency and
  relationship-effect questions. It cannot copy ordinary generated question
  output.
- Bundle compilation separately projects both authored question catalogues to
  one complete implementation-neutral question contract. It contains
  `(semantic_question_key, question_kind, proposition_or_effect_dimension,
  subject_domain, complete proposition-or-effect AST, complete applicability
  predicate AST, quantification and conclusive-witness rules, party_role,
  capacity, temporal scope, state semantics, positive-witness rules,
  negative-witness and absence-proof rules, evidence scope and roles,
  dependency-or-effect target, operation and selection rules, repeatability,
  cardinality, governed_ordinal and, for an effect question, the complete
  neutral relationship-effect field contract)`. That field contract enumerates
  every field key, canonical type, cardinality, applicability predicate AST,
  canonicalisation rule, permitted constraint operator, evidence roles,
  endpoint or source-expression rule and state-specific proof behaviour. Each
  path authors every normative field independently. An applicability, witness,
  absence, dependency or effect rule
  key may label a rule but cannot replace its complete canonical AST and
  semantics in the comparison projection. The paths may share only primitive
  schemas and stable comparison keys, never an evaluator, predicate
  implementation, default or normative rule payload.
  After validating both complete catalogue SemanticStageOutputSetRoots, the
  catalogue THIRD_RECONCILER input envelope hashes both ordered canonical
  comparison bodies, complete question-and-field key universe, registered
  comparison schema and semantic-stage-contract digest and bounds. The inner
  catalogue-reconciliation semantic ID hashes that envelope ID, exact
  differences and terminal state. The governed
  `SemanticQuestionCatalogueReconciliation` ID and attestation alone bind the
  contract fingerprint, both catalogue-root and SemanticStageOutputSetRoot IDs,
  path attestations and third-reconciler execution and review evidence.
  Duplicate keys, an alias, a missing or extra question or
  any field difference fails compilation. The reconciler cannot create a map or
  choose one answer. Ordinary definitions remain canonical truth only after
  this independent completeness challenge passes; the independent catalogue
  can never supply claims, effects or serving output.
- Every legal-semantic and composition computation uses three separate immutable
  records: `SemanticComputationInputEnvelope`, `SemanticComputationPayload` and
  `NonSemanticPayloadAttestation`. A semantic worker never writes its final
  governed manifest directly. The input envelope fixes worker class, path and
  stage; the exact permitted semantic input bytes and their payload digests;
  permitted implementation-neutral projections from already passed stages;
  primitive-schema versions; output schema; and finite cardinality bounds. It
  expressly excludes the frozen-pair identity, ContractFreezeAttestation,
  programme status, authorisation generation, other-path identity or payload,
  reconciliation identity or result, review evidence, candidate-release
  identity, run and time. Executable, model, prompt, configuration, dependency
  graph, sandbox and capability metadata live only in the non-semantic
  execution-and-attestation layer. The worker receives only the semantic bytes
  in its input envelope and may branch only on those bytes. It has no undeclared
  repository, database, environment, network, cache, object-store, metadata or
  prior-session access; a direct or transitive undeclared input is blocking.
- Worker paths are `CATALOGUE_BLIND`, `INDEPENDENT`, `ORDINARY`,
  `THIRD_RECONCILER` and `CANDIDATE_ACTUAL`. A catalogue-blind path receives
  only exact source text, source maps, PotentialDependencyUniverse and primitive
  schemas. An independent path receives its own catalogue, exact source, its own
  earlier payloads and an expressly declared neutral prior-stage projection. An
  ordinary path receives ordinary contract objects, exact source, its own
  earlier payloads and the corresponding neutral projection. Neither path may
  receive the other's identity, payload, difference, reconciliation object,
  review result or candidate actual. Where sequencing requires a prior pass, the
  worker receives only a non-inspectable pass capability, never the
  reconciliation payload or digest.
- `SemanticComputationPayload` hashes its exact semantic input-envelope ID and
  complete semantic output. It neither hashes nor exposes the frozen pair,
  ContractFreezeAttestation, cross-path reconciliation digest, other-path
  identity, review disposition or candidate-release identity. After the payload
  is final, a non-semantic attester validates the input envelope, exact
  executable, model, prompt and configuration digests, complete transitive
  dependency graph, runtime capability allowlist, sandbox and information-flow
  proof, prerequisite non-inspectable pass capabilities and review evidence. The
  information-flow proof scans the complete prompt, template, configuration,
  dependency and runtime-instruction bytes and proves they contain no
  source-specific or candidate-specific prohibited answer, other-path identity,
  reconciliation result or hidden semantic input.
  `NonSemanticPayloadAttestation` then hashes the semantic input envelope and
  payload, the applicable authority binding defined below, prerequisite
  reconciliation pass capabilities, all execution evidence and review evidence.
  It may bind metadata or reject, but cannot add, delete,
  reorder, map, classify or otherwise modify semantic content. A metadata-only
  change with identical permitted semantic bytes and output preserves both the
  input-envelope and computation-payload digests and rekeys only the
  attestation. A worker whose control flow reads attestation metadata fails even
  if its output happens to match.
- `NonSemanticPayloadAttestation` has three closed variants.
  `PRE_FREEZE_CONTRACT` binds the exact contract fingerprint and an explicit
  `NO_CONTRACT_FREEZE_ATTESTATION` marker because catalogue reconciliation must
  precede ContractFreezeAttestation. `SOURCE_BUILD` and `CANDIDATE_BUILD` bind the
  exact frozen pair and their applicable authorisation and stage evidence. A
  source or candidate variant without the pair, or a pre-freeze variant carrying
  a freeze ID, is invalid. This removes any identity cycle between catalogue
  reconciliation and contract freeze.
- Every named computed semantic or composition record has two identities.
  `semantic_object_id` is inside SemanticComputationPayload and hashes only its
  schema, path and stage, exact SemanticComputationInputEnvelope, complete
  semantic body and earlier semantic-object IDs or exact neutral-projection bytes
  and content digests expressly present as permitted semantic input. The worker
  never receives a NeutralStageProjection object ID. `governed_object_id` hashes
  record type and stable key, semantic-object ID and exact
  NonSemanticPayloadAttestation. `GovernedSemanticRecord` is functional from
  each governed wrapper to exactly one complete inner payload and permits at
  most one PASS wrapper per `(authority_binding, record_type, stable_key,
  semantic_object_id)`. Historical authority bindings may create several
  immutable wrappers for the same semantic object; a selected build chooses
  exactly one passing wrapper. A failed attestation creates no governed wrapper.
  No wrapper may add, delete, reorder or rewrite a field. A semantic worker may read
  only semantic-object and neutral-projection bytes, never a governed-object ID.
  Scope, release, traceability and certification inventories carry both IDs and
  the mapping proof.
- Unless a later clause expressly says `semantic_object_id`, its shorthand
  statement that a computed semantic record “ID hashes” a frozen pair,
  executable, configuration, review, authorisation or other governance evidence
  describes the outer `governed_object_id` and NonSemanticPayloadAttestation.
  The corresponding inner identity excludes those fields and replaces any
  predecessor governed ID with the predecessor semantic-object ID or declared
  NeutralStageProjection. No later shorthand may override this separation.
- After the dispatcher validates the two exact complete
  SemanticStageOutputSetRoots outside the reconciler, including every member's
  passing attestation and the roots' empty missing, extra and duplicate sets, it
  strips their complete payload sets to the implementation-neutral
  comparison-body bytes fixed by the registered comparison schema. It then
  creates one `THIRD_RECONCILER` SemanticComputationInputEnvelope containing
  only the canonically ordered comparison bodies and their content digests, the
  complete neutral key universe, registered comparison schema and
  semantic-stage-contract digest, primitive schema versions and finite bounds.
  The reconciler receives the semantic bytes named by that envelope, but not
  the envelope ID. It receives no path payload, semantic-object, attestation or
  governed ID, path label, execution, review or authority metadata. Its inner
  semantic ID hashes the exact input-envelope ID, differences and terminal
  state; its outer attestation binds the exact two path roots, their payloads and
  attestations. A candidate-final comparison analogously requires the complete
  candidate A SemanticStageOutputSetRoot and the exact expected
  SemanticNeutralProjectionSetRoot before constructing its reconciler envelope;
  its outer attestation binds both roots. It
  emits exact implementation-neutral differences and terminal state. On success
  it may expose one `NeutralStageProjection` containing only the complete equal
  canonical keys and values required by the next stage. It never exposes a
  path-specific payload, record identity, executable evidence, review evidence
  or difference set back to either path. Failure creates no repaired output.
  This pattern applies separately to catalogue-blind dimension discovery, both
  base-subject paths, legal-dimension mapping, both question-universe builders,
  both applicability evaluators, both slot builders, per-slot challenge,
  ordinary expectation compilation, both composition paths and candidate-actual
  enumeration. Base, question-universe, question-state, slot,
  relationship-semantic and composition reconciliations are third-reconciler
  stages.
- For every reconciliation named later, any path object, semantic-object,
  envelope, attestation, executable, review, frozen-pair or authority ID in a
  shorthand ID formula belongs only to the outer governed reconciliation and
  its NonSemanticPayloadAttestation. The inner reconciliation semantic ID hashes
  its registered `THIRD_RECONCILER` SemanticComputationInputEnvelope ID, exact
  differences and terminal state. That envelope itself hashes only the ordered
  implementation-neutral comparison bodies, complete key universe, registered
  comparison schema and semantic-stage-contract digest, primitive schemas and
  bounds. Thus a comparison-schema or stripping-rule change rekeys the inner
  reconciliation without exposing either path's identity or metadata.
- A downstream semantic worker can receive a successful earlier stage only as
  the exact `NeutralStageProjection` bytes declared in its own input envelope
  and a non-inspectable pass capability checked outside the worker. The
  projection contains the complete equal semantic keys and values needed by
  that stage, but no source-path label, object ID, payload digest, executable,
  reviewer, frozen-pair, status, reconciliation or difference metadata. It is
  impossible for ordinary, independent and candidate-actual paths to test which
  path produced a value or whether two earlier paths agreed. A third reconciler
  never calls a semantic worker and never becomes a shared semantic oracle.
- Every path-specific review has one immutable `SemanticReviewInputEnvelope`
  fixing review class, exact allowed payload bytes, prohibited input classes,
  reviewer prompt and tool manifest, reviewer identity and eligibility evidence.
  Review runs are self-contained and have no session history or unlisted access.
  `CATALOGUE_BLIND_REVIEW` may inspect only source, PotentialDependencyUniverse
  and its completed discovery payload. `INDEPENDENT_PATH_REVIEW` and
  `ORDINARY_PATH_REVIEW` may inspect only their own catalogue or definitions,
  source, neutral prior-stage projection and completed path payload.
  `THIRD_RECONCILIATION_REVIEW` may inspect both completed payloads and
  differences but can issue only `PASS` or `FAIL`; `CANDIDATE_ACTUAL_REVIEW`
  cannot create an expectation or fact. A `SemanticReviewDisposition` is
  created after the computation payload and is supplied only to the
  non-semantic attester. It can never be read by the worker whose output it
  reviews.
- The bundle generates one closed `SemanticStageRegistry`. For every semantic
  and composition stage it fixes permitted worker paths, exact input roles,
  whether each role is source bytes, own-path semantic bytes or neutral
  projection bytes, output type, complete implementation-neutral comparison-body
  schema, canonical field and key order, neutral-projection schema, deterministic
  stripping rule and permitted source binding, review class, attestation variant
  and finite cardinality. It also fixes left and right comparison-body order so
  swapping paths cannot alter a result. Unregistered stages or inputs fail before execution.
  `semantic_stage_contract_digest` hashes schema, stage, permitted paths,
  ordered input roles and source bindings, output schema, complete comparison
  schema, neutral-projection schema, stripping rule, canonical body order and
  bounds. Review class and authority-binding choice remain non-semantic
  attestation inputs.
  `semantic_computation_input_envelope_id` hashes schema, registered stage and
  exact semantic-stage-contract digest, path, ordered
  `(input_role, canonical_bytes_digest)` entries, primitive schema versions,
  output schema and bounds. `semantic_computation_payload_id` hashes
  that envelope ID and complete canonical output bytes.
  `semantic_review_input_envelope_id` hashes schema, review class, stage, exact
  allowed canonical payload-byte digests, prohibited classes, self-contained
  prompt and tool manifest and reviewer-eligibility evidence;
  `semantic_review_disposition_id` hashes that envelope, reviewed payload and
  `PASS` or `FAIL` with bounded reasons.
  `non_semantic_payload_attestation_id` hashes schema and variant, input envelope
  and payload IDs, applicable authority binding, exact execution and sandbox
  evidence, prerequisite pass capabilities, review disposition, terminal
  `PASS` or `FAIL` and bounded reason digest. Only `PASS` may create or select a
  governed wrapper. Terminal state is `PASS` if and only if the review
  disposition and every envelope, dependency, capability, sandbox,
  information-flow and prerequisite-pass check is current, matching and
  `PASS`; any failed, stale, missing or mismatched sub-proof forces `FAIL` and
  zero governed wrapper.
  `neutral_stage_projection_semantic_id` hashes schema, stage, exact
  semantic-stage-contract digest, complete equal
  canonical key-and-value bytes and terminal equality; its governed ID hashes
  that semantic ID and reconciler NonSemanticPayloadAttestation, which also
  binds the complete selected registry entry. Only its bytes
  and content digest, not either ID, may enter a later semantic input envelope.
- Every registered path or reconciler stage closes with one immutable
  `SemanticStageOutputSetRoot` for each declared authority binding and scope key.
  It hashes schema, exact authority binding and scope key, stage, path,
  semantic-stage-contract digest, exact expected stable-key universe and
  registry-declared cardinality, and the ordered
  `(stable_key, SemanticComputationInputEnvelope_id,
  SemanticComputationPayload_id, semantic_object_id,
  semantic_payload_digest, SemanticReviewInputEnvelope_id,
  SemanticReviewDisposition_id, NonSemanticPayloadAttestation_id,
  governed_object_id, GovernedSemanticRecord_mapping_digest)` entries. It also
  hashes explicit empty missing, extra and duplicate sets and the exact
  completeness proof. A reconciler stage that emits neutral outputs additionally
  closes one `SemanticNeutralProjectionSetRoot` hashing schema, exact authority
  binding and scope key, stage, producing reconciler path and
  SemanticStageOutputSetRoot ID, semantic-stage-contract digest, the exact
  expected neutral keys and ordered `(neutral_key, projection_content_digest,
  neutral_projection_semantic_id, neutral_projection_governed_id,
  attestation_id, mapping_digest)` entries, again with empty missing, extra and
  duplicate sets. These roots are certification inventories, not semantic
  worker inputs. A later worker receives only each declared neutral projection's
  bytes and content digest. ContractFreezeAttestation selects every
  PRE_FREEZE_CONTRACT root. Corpus scope selects those fixed pre-freeze roots and
  every SOURCE_BUILD root in its scope. CandidateOutputSeal and
  CandidateReleaseManifest select every CANDIDATE_BUILD root.
- `DealDocumentOrderingDefinition` fixes one complete total comparator for
  included deal documents: role priority, governed version or supersession
  ranking, one-based deal-global ordinal scope and index base, explicit-null
  treatment, canonical byte collation, exact-duplicate handling and the ordered
  comparator fields. Those fields are
  `(document_role_priority, governed_version_or_supersession_rank,
  source_system, immutable_accession_or_approved_import_key,
  source_version_or_explicit_null, recursive_package_member_path_and_ordinal,
  source_occurrence_id)`. Model, database, insertion, enumeration, worker and
  discovery order are prohibited. Exact duplicate rows collapse before sorting;
  the source-occurrence tie-breaker makes the remaining order total, and a
  duplicate logical key with conflicting values blocks. The ordinal is a stable
  ordering identity, not an inference of legal precedence.
- Every `evidence_contract` in the gate registry selects exactly one content-
  addressed `ProgrammeGateAcceptanceDefinition`, never an opaque label. That
  definition is bound to the exact specification root and, where applicable,
  frozen contract pair. It fixes the evidence-object JSON schema, subject type
  and identity fields, complete immutable-member universe and member-schema set,
  deterministic member-enumerator executable and configuration digests and one
  ordered typed predicate per claim. Each predicate fixes its exact input member
  types and paths, measurement executable and configuration digests, comparison
  operator and expected typed value. A missing, ambiguous, differently digested
  or unbound definition leaves the gate `OPEN`; a claim name alone has no
  acceptance meaning. The definition is not authored during bootstrap.
  `BOOTSTRAP_FROZEN` gates select the reviewed specification and exact closed
  validator-executable set. `BUNDLE_FROZEN` gates select an evidence-object
  schema, member-universe definition and predicate AST that are authored
  CanonicalContractBundle members and become immutable only through the passing
  ContractFreezeAttestation; they remain `OPEN` before that freeze and cannot be
  supplied by evidence, status or runtime callers. The tier mapping is total and
  frozen in the gate registry. A bundle-frozen definition cannot evaluate
  P1_CONTRACT_FREEZE_ATTESTED itself, which is bootstrap-frozen, so there is no
  circular self-certification. Each definition's ID is the domain-separated hash of those exact bytes
  and the frozen `programme-gate-predicate-dsl/v1` AST. That DSL permits only
  the operators and explicit typed expected values listed in the registry. No
  executable, bootstrap principal, evidence producer, request or owner
  statement may choose or weaken the AST. For bundle-frozen gates, Freeze Gate
  review and Ben approval cover the semantic diff of every new or changed
  evidence schema, member path, measurement, operator and expected value. Two implementation-disjoint compilers
  and a small reference interpreter must derive byte-identical acceptance-
  definition bytes and results before the definition is usable. Executable and
  configuration digests prove which conforming implementation ran; they are not
  semantic authority. The exact public-key fingerprints in the frozen trust-
  root set are also source members, so bootstrap cannot select its own
  validator, reviewer or publisher trust anchor. The common V2
  `ProgrammeGateEvidenceEnvelope` contains the
  gate and contract IDs, acceptance-definition ID and digest, exact six-member
  specification root, code commit, environment, evidence subject type, ID and
  payload digest, required typed object and payload digest, exact claim map,
  immutable member root, test-result root, validator executable and configuration digests,
  validator key, terminal state and signature. The status validator parses the
  payload with that exact registered schema, independently re-enumerates the
  complete member universe and recomputes every claim and measurement under its
  registered typed predicate, requires the claim keys to
  equal the gate entry, verifies every named test and the validator signature,
  and accepts only terminal `PASS`. A missing schema, unregistered predicate,
  request-supplied result, unknown or missing claim, stale subject, untrusted
  validator or unverifiable member leaves the gate `OPEN`.
- `TrustedReviewControllerRecord/V1` replaces the unavailable provider-record
  interface as the proof that a cold review occurred. The trusted controller
  directly controls and observes one read-only review execution. Its only
  controller-supplied task payload is the exact frozen specification bytes, one
  registered lane-specific cold prompt and the required output schema. The
  controller runtime may add only fixed pinned platform instructions and tool
  schemas. This fixed context is not case-specific and contains no prior review
  finding or conclusion. The controller records its ID and version, review
  runtime version and binary digest, fixed controller-context digest, exact
  model identifier, reasoning level, immutable task, session and review IDs,
  registered prompt ID and digest, controller-supplied input-manifest digest,
  exact input-context digest and its before-and-after values, output digest,
  start and end times, reviewer principal and its complete source-control
  identity set, disposition, empty reviewer edit-set root, genesis
  parent-session state, the fact that no earlier review conclusions were inputs,
  unique nonce, signature algorithm and key ID.
  The controller signs the immutable record and emits it into the closed
  evidence set. The validator deterministically enumerates that set, loads the
  exact record and verifies it against the frozen trusted-key registry. The
  controller process is the only process permitted to use the signing key. The
  key is inaccessible to the reviewer, review process, operator input and
  repository. The private key never enters the review environment, logs or
  checkout. A transcript, reviewer statement or user-supplied substitute cannot
  replace the controller record.
- The reviewer principal is the exact controller run plus one fresh ephemeral
  CLI session, not the model family. The controller creates a new `CODEX_HOME`,
  does not resume a session and does not load project rules, user configuration,
  plugins, memory or prior-session content. The review is read-only. The
  input-context digest must be byte-equal before and after execution. A changed
  or unknown fixed runtime context, case-specific runtime context or extra
  controller-supplied task input makes the review ineligible.
- The controller record is the authority for review execution,
  controller-observed task and fixed runtime inputs, output and timing. Complete
  Git history is supplementary authorship evidence.
  The controller record maps the reviewer principal to its complete
  source-control identity set. The validator requires the reviewed bytes to be
  committed and uses complete history, blame and copy tracing to find every
  commit that contributed a byte to the exact root. No contributing author may
  map to the reviewer principal. Git history alone cannot prove that a review
  occurred. A missing or ambiguous identity mapping, missing controller record,
  inaccessible execution facts, mutable review, prior conclusion input,
  non-empty edit set, ineligible model or reasoning level, untrusted key,
  invalid signature or incomplete history makes the review ineligible.
- Controller evidence does not prove a provider-internal build, provider
  signature or absence of hidden provider context. It makes none of those
  claims. Formal evidence is the signed controller execution evidence under this
  amended standard.
- `GateStatusBootstrapAuthority/V1` is a temporary one-use authority under
  `specification_review`. Its predecessor is `NONE`. Its identity binds the
  exact registry amendment, nonce `gate-status-bootstrap-2026-07-27-v1` and the
  closed permitted and prohibited action lists in the registry. It permits only the governance
  amendment, review-controller software and evidence schemas, deterministic
  compilation of the already frozen gate-acceptance source contracts,
  certification-integrity validator implementation, signing system, status publisher,
  `ProgrammeStatusPublicationHead`, the eight G0 evidence collections, empty
  isolated-staging boundary setup, preview access protection and their tests.
  It cannot choose, amend or approve an acceptance member universe, predicate,
  measurement, comparison operator, expected value, trust root or test
  requirement. Those semantics are part of the reviewed specification root
  before bootstrap begins. Compiled acceptance definitions and validator
  implementations are non-authoritative derived artefacts and must reproduce
  the frozen reference-interpreter result byte-for-byte.
  It cannot authorise a snapshot restore, corpus
  extraction, reprocessing, writes, backfills, production data changes, release
  import or activation, or product feature activation. An owner statement
  cannot create, widen or replace it.
- The protected publisher consumes the bootstrap nonce only when it publishes
  the first valid `ProgrammeGateStatusArtefact/V2`. That event must be generation
  1 from predecessor `NONE`, include all 35 registry gates once in registry
  order, leave every unsupported P1 and P9 gate `OPEN`, and derive
  `canonical_work_start: PASS` by recomputing the proposed G0 projection from
  validated evidence inside the genesis publication. It does not require or
  consult a predecessor status. The same successful
  compare-and-swap expires the authority. A failed validation or stale
  publication does not consume the nonce. Reuse is prohibited. Reissue requires
  another governing registry amendment.
- `ProgrammeGateStatusArtefact/V2` is the sole ordinary status projection. It
  hashes schema, exact specification root, code commit, environment, monotonic
  predecessor generation, the complete gate registry digest, and the ordered
  `(gate_id, state, evidence_envelope_id, evidence_payload_digest)` set, plus
  validator executable and configuration digests, key and signature. `PASS`
  requires a currently valid envelope under the preceding rule. For
  `P9_PROGRAMME_COMPLETION_ATTESTATION`, that envelope proves only the preterminal
  completion facts available before the proposed status exists. It never claims
  that POST_COMPLETION or atomic publication has already occurred.
  `NOT_APPLICABLE` is accepted only where the gate's complete registered
  predicate passes. Missing, duplicated, manually edited or unverifiable rows
  are `OPEN`. The terminal status-plus-POST_COMPLETION pair remains the sole
  programme-completion exception described below.
- `ProgrammeStatusPublicationHead/V1` uses the repository-native
  `refs/heads/programme-status-publication-head` Git ref as its sole mutable
  head. Only the protected GitHub Action can publish. It reads the exact current
  Git object ID, validates the complete successor and updates the ref with one
  compare-and-swap. The first expected predecessor is `NONE`. Every later
  publication names the exact predecessor object and generation. A stale
  predecessor, manual status edit, validation failure or partial output makes
  no ref change. The status file and head state are committed together, so no
  second publication head or owner-deemed projection can become authoritative.
  It is not a database row and is excluded from
  GlobalMutableAuthorityRegistry and GeneratedLockPlanRegistry.
- The existing generation-4
  `docs/certification/programme-gate-status.json` file is a historical V1
  owner-deemed record. It is not a V2 predecessor, evidence source, publication
  head or executable authority. The first V2 status is written to
  `docs/certification/programme-gate-status-v2.json`.

- `ShadowReextractionAttestation` hashes its schema, exact frozen contract pair,
  CandidateInputHead and CandidateBuildHead IDs and payload digests, candidate
  release and CandidateReleaseManifest IDs and payload digests, the candidate's
  complete semantic serving-output root, current
  correction-head set root, exact source-scope and expected-unit roots, both full
  extraction-run member and output roots, disagreement and high-risk-family
  universe roots, required third-run roots, every human-adjudication decision and
  every fresh post-adjudication confirming-run root and one candidate-to-
  confirmed-shadow semantic reconciliation. That reconciliation compares the
  complete source-backed result, component, claim, relationship, disposition,
  comparability and cohort-membership payloads under their canonical stable keys
  and has fixed empty missing, extra, duplicate, conflicting and different-value
  roots. Its other reconciliations prove
  that both full runs cover the exact candidate scope, every disagreement and
  high-risk unit received the required third run, no result was selected by
  majority, every disagreement was human-adjudicated, and every affected unit
  passed a fresh confirming run after any required contract or extractor change.
  The unresolved set and the set changed after confirmation must both be empty.
  Agreement between the shadow runs cannot pass unless their confirmed semantics
  also equal the bound candidate output exactly.
  Advancing any bound head, correction, scope, candidate, manifest, contract or
  extractor input makes the attestation stale and leaves
  `P9_SHADOW_REEXTRACTION` `OPEN`; `PreCutoverCertification` requires the
  attestation subject to equal its exact candidate and frozen pair.
- A schema-valid bundle is not authorised merely because it compiles. Before
  any source-specific scope freeze, candidate extraction, reprocess, backfill or
  release build, one immutable `ContractFreezeAttestation` must approve the
  exact bundle with disposition `APPROVED`. Its ID hashes the attestation schema and freeze-policy versions,
  exact bundle fingerprint and root-manifest digest, predecessor attestation or
  explicit genesis marker, canonical semantic-and-identity diff digest, compiler
  and generator versions, ordered generated-output digests, compile, cycle and
  drift report digests, exact ordered governing-specification file entries,
  byte lengths, SHA-256 values and domain-separated specification-root digest,
  passing `G0_EXACT_DIGEST_REVIEW_SET` evidence ID and payload digest and
  `G0_BEN_SPEC_APPROVAL` evidence ID and payload digest over that same root,
  immutable legal-semantic and identity review disposition
  IDs, separate independent-semantic-question and
  independent-composition-catalogue authorship, input-access and review
  disposition IDs, exact semantic-question-catalogue reconciliation and neutral
  projection digests, every PRE_FREEZE_CONTRACT SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot, exact
  RelationshipEffectFieldUniverseSetRoot, each
  independent reviewer's identity and eligibility-evidence digest,
  the ordered Ben-owned taxonomy and codebook decision IDs, and Ben's immutable
  bundle-approval-evidence ID. A qualifying legal-semantic review is by Fable or
  an independent 5.6 Sol reviewer using extra-high reasoning under
  [the programme governance](../CODEX-PROGRAM.md#governance-non-negotiable-applies-to-every-phase).
  Run IDs, timestamps and workflow status
  are provenance outside identity.
- `ContractFreezeAttestation` is an approval object outside the closed bundle.
  It contains no source, deal, candidate revision, snapshot or release reference;
  generated bundle outputs may embed the bundle fingerprint but never the
  attestation ID. A changed bundle byte, root manifest, generated output,
  semantic or identity diff, reviewer or eligibility proof, review disposition,
  Ben decision or approval evidence requires a new attestation. Conditional,
  missing, stale, mismatched or unverifiable approval is `OPEN` and blocks
  `candidate_scope_and_extraction`. It cannot be repaired by a later candidate
  artefact or a prose assertion.
- `candidate_scope_and_extraction` authorisation is parameterised by the exact
  frozen pair, programme-status artefact digest and monotonic status generation
  in the requested work envelope. A passing status record for a different pair
  or generation is stale for that request. The dispatcher validates it before
  source-specific semantic work; every `canonical_write` `DEAL_SCOPE_RUN`,
  `CORPUS_SCOPE_FREEZE`, `DEAL_EXTRACTION_RUN` and
  `CANDIDATE_RELEASE_FREEZE` action accepts the same three fields, locks
  the current mechanically mirrored authorisation generation and revalidates
  immediately before canonical DML commits. The signed database-row swap is the
  sole executable-authorisation linearisation point. A writer that acquired its
  lock first may finish under the old generation; the supersession waits and
  that output remains bound to the old pair and cannot enter a later candidate.
  Once the swap commits, no old-generation writer may start or commit. An old
  same-bundle attestation cannot remain ambiently executable.
  The receipt-first `INTAKE_CAPTURE/RECEIPT`, raw processing attempt and
  mechanically blocking resolution are deliberately outside this
  legal-semantic authorisation because they must durably record arrival and
  failure before classification. They have their own narrow intake-auth
  contract and cannot grant cutoff eligibility, create a cutoff, assign a deal,
  create canonical text or assert a semantic fact. Any `PASS`,
  `REPLACED_BY_REACQUISITION`, `REVIEWED_REJECTED` or
  `REVIEWED_OUT_OF_PROGRAMME_SCOPE` resolution binds and writer-revalidates the
  exact frozen pair, IntakeDispositionPolicy object digest, status digest and
  generation. A narrow
  emergency authority may append `REVOKED_BLOCKING` because it can only remove
  eligibility. The separate
  `INTAKE_CUTOFF_BUILD/CUTOFF_FREEZE` action does select a build and requires the same
  frozen pair and authorisation recheck as the source-specific writer stages.
- The database authorisation row is a generated, read-only operational replica,
  not a second gate authority. It stores the status artefact digest, generation,
  frozen pair, validator identity and validator signature. Only the status
  validator role may replace it; writer and dispatcher verify the signature and
  exact fields against the work envelope. A manually changed, unsigned, missing
  or lagging replica blocks work and cannot create a pass.
- Grant and revocation ordering is fail-closed. A new grant becomes executable
  only after its immutable status artefact exists and the validator activates
  the matching signed row. A revocation or supersession replaces the row with a
  higher `REVOKED` or replacement generation before publishing the later status
  view. The row can serialise execution but cannot originate, upgrade or waive a
  gate disposition.
- Every authorised source-specific build receives the frozen pair
  `(contract_fingerprint, contract_freeze_attestation_id)`. The exact pair is
  pinned into each ClaimScopeClosure, ExpectedOccurrenceSlot,
  DealScopeRunManifest, DealScopeRunReceipt, scope slice, CorpusScopeManifest,
  CorpusScopeFreezeAttestation, certified family set,
  FamilyExtractionManifest, DealSnapshot, DealExtractionRunManifest,
  CorpusRelease, QueryGoldenCertificationAttestation, serving payload
  and cache key, and every candidate, deployment, certification, import,
  ReleaseBundleEnvelope, cutover, activation, smoke and completion artefact.
  Content objects that do not select a build, including SubmissionReceipt,
  ArchiveAttemptNode, IntakeProcessingAttempt, SubmissionExpansionManifest, immutable source
  content, source occurrence, IntakeUniverseManifest, ReceiptReplacementLink,
  source geometry, semantic occurrence identity and the text-only dependency
  universe, hash only
  their exact source and governing contract-object digests and never the
  attestation ID. Every cutoff-eligible IntakeResolution,
  IntakeCutoffAttestation, source-specific question dispositions,
  semantic expectations, challenge and composition artefacts and closures do select an authorised
  build and bind the exact pair. QueryDefinitionSetRoot and
  QueryGoldenSuiteManifest instead bind the pre-freeze
  CanonicalBundleInputIdentity and never the frozen pair. A runtime QueryPlan resolves and carries that
  pair as operational execution state but is not a release member or certified
  trace row. A new attestation for unchanged contract bytes
  therefore preserves source and semantic-occurrence identities but rekeys all
  reviewed dispositions, expectations, closures, selections, releases and
  certification artefacts. The pair is constant release metadata in serving,
  not a per-row database join.
- Instance-specific source-admission, deal, anchor, supersession, scope
  dependency, ClaimScopeClosure, relationship-effect, ResultInputLineage and
  correction records are content-addressed governed data conforming to those
  generated schemas. They require the specified review and approval, are never
  generated merely because a legacy row exists and cannot define taxonomy or
  codebooks.
- Immutable governed configuration instances have disjoint authority.
  `ArchiveSafetyPolicyManifest` alone owns raw-container, member-count,
  recursion, decompression, expansion-ratio, path, metadata, CPU, wall-clock,
  memory, temporary-disk, subprocess, streaming, sandbox, network-denial and
  bounded diagnostic-retention limits and supported compression or encryption
  methods. `CacheBudgetManifest` alone owns deployed cache TTLs, entries, bytes,
  release retention, fill quotas and rates. `CapacityManifest` alone owns fleet
  and per-class admission, admission-queue deadlines, fill leases, circuit
  parameters, database connection caps and ServingFence admission-lease TTL,
  maximum live leases and drain deadline. `RouteBudgetManifest` alone owns
  deployed per-route calls, rows, bytes and execution deadlines, including each
  canonical-writer action and preparation batch deadline.
  Neither may choose those values independently: both select the same
  LeaseDeadlineCompatibilityAttestation, which proves the cross-manifest clock,
  lease, queue, execution, response-flush, cancellation and drain inequalities
  without taking ownership of either manifest's fields.
  `CertificationPolicyManifest` alone owns certification methods,
  pass thresholds, risk lists, adjudication rules, maximum frozen-candidate and
  CandidateInputRecheck ages and maximum promotion-hold duration. The bundle defines their
  schemas and immutable protocol upper bounds, not duplicate deployed settings.
  None may define legal semantics, identities, metrics or codebooks.
- `OperationalPolicySet` ID hashes its schema version and the exact
  ArchiveSafetyPolicyManifest, CacheBudgetManifest, CapacityManifest and
  RouteBudgetManifest IDs in that fixed order.
  CertificationPolicyManifest references that set. Compilation
  fails on duplicate field ownership, an instance above a protocol bound or any
  mismatched policy-set reference.
- `IntakeProcessingPolicyActivation` is the sole executable selection of intake
  processing policy. Its ID hashes schema, contiguous activation generation,
  predecessor activation or genesis, exact OperationalPolicySet and all four
  constituent IDs and payload digests, transition class, activation reason,
  authority-evidence digest, validator identity and validator-configuration
  digest. Its signed mutable singleton `IntakeProcessingPolicyHead` stores only
  current activation ID, generation and signature and is compare-and-swapped
  only by the policy-validator role. A request-supplied manifest, schema-valid
  policy or unselected OperationalPolicySet authorises nothing.
- A transition is `INTAKE_EQUIVALENT`, `DRAIN_COMPATIBLE` or
  `ARCHIVE_RESULT_INVALIDATING`. Route- or cache-only change with identical
  intake policy is equivalent. A capacity change is drain-compatible only after
  the linearizable fleet controller stops predecessor admission and produces a
  bounded zero-or-explicitly-carried predecessor-lease proof. An archive-policy
  change is result-invalidating. Every reader obtains a fenced fleet lease under
  the signed current activation before parsing and holds no database lock while
  it works. At canonical commit the writer locks and revalidates the policy
  head. Writer-first may commit under the old current activation; policy-CAS
  first makes a completed result blocking with `POLICY_SUPERSEDED`, creates no
  expansion, source or universe and requires a new attempt, except for an exact
  governed equivalent or drain-compatible transition. No transition rewrites an
  attempt.
- Before an `ARCHIVE_RESULT_INVALIDATING` policy activation, the validator uses
  ReleaseIntakeDependencyProjection to identify pending and active dependants.
  If any exist, or the projection is unavailable, it installs and acknowledges
  a higher BLOCKED ServingFenceVersion. Its database transaction then changes
  IntakeProcessingPolicyHead and atomically revokes the held
  CandidatePromotionFence and readiness and forces affected active exposure off
  through the matching ActiveReleaseRevocationActionRegistry entry. If its
  generated locks observe an awaiting post-activation or legacy post-commit
  controller, the same transaction must perform the mandatory revocation-
  evidence and BEGIN coupling; a pending controller must be joined through
  COMPLETE or the policy transaction writes zero DML.
  A failed transaction leaves serving blocked. Equivalent and certified
  drain-compatible transitions do not revoke an otherwise current candidate,
  but every later stage still records and proves the exact allowed transition
  chain.
- `IntakeTransitionDefinition` is a closed generated state machine over writer
  action, prior resolution state, new attempt outcome or no-attempt marker,
  processing-policy relation, authorisation state, eligibility-dependency state
  and requested successor state. It fixes every required and forbidden field.
  Unknown or unlisted transitions fail before DML; database constraints and the
  canonical writer validator are generated from this same definition.
- Existing feature, taxonomy and market registries become classified migration
  inputs or generated compatibility outputs with final dispositions. During
  transition they may reject a compatibility write, but they cannot admit a
  canonical fact or become an alternate authoring authority.
- Every bundle change passes the Freeze Gate and produces the attestation above.
  Compilation fails on duplicate keys, unknown codes, unresolved references, a
  dependency cycle or generated drift. A successful compile without the exact
  attestation never authorises corpus work.

### 1. Immutable source and deterministic structure

- `SourceContent` stores the exact received bytes in immutable encrypted object
  storage. `source_content_id` is the domain-separated hash of source kind,
  byte length and exact-bytes SHA-256. `ORIGINAL_BYTES` admission requires those
  bytes to remain retrievable and hash-identical; a legacy-derived payload is a
  different source kind and content ID. Content deduplication shares only this
  immutable payload, never provenance or occurrence identity.
- `ImmutableSourceDocument` is the extraction boundary object. It retains a
  retrievable reference to the actual original source-package bytes and, where
  applicable, the exact package-member bytes, declared and independently
  detected file type, byte length and content hash, SubmissionReceipt, root
  SubmissionExpansionManifest, source occurrence, converter executable and
  configuration digests, exact CanonicalTextOccurrence and complete source-map
  provenance. Its ID hashes content-addressed logical byte references, content
  digests and that complete immutable payload, never an environment-specific
  object-store locator, namespace or generation. Extracted plain text
  or a rendered page can never substitute for the original package. A converter
  change creates a new object while preserving the prior package and conversion
  chain.
- Model inference is an offline, non-authoritative proposal step, not the
  deterministic extraction boundary. Each attempt creates one immutable
  `SemanticInferenceTranscript` over the exact SemanticExtractionInputEnvelope
  ID and payload digest, attempt ordinal, exact request, response, tool and
  termination bytes and their ordered digests, model, prompt, executable,
  configuration and dependency digests and runtime provenance. Its ID is
  `H("SEMANTIC_INFERENCE_TRANSCRIPT/V1", schema, that complete payload)`. A
  transcript may disagree with another transcript, contain an invalid proposal
  or fail. It can neither write a ValidatedSemanticGraph nor establish a legal
  fact, canonical key, admission, absence, comparability or publication state.
  The frozen envelope fixes maximum attempts and per-attempt and aggregate
  transcript bytes; exceeding a bound is a retained blocking outcome, never
  truncation or silent attempt omission.
- One immutable `ReviewedInferencePayload` records the exact source-backed bytes
  selected for deterministic normalisation. Its ID hashes
  `REVIEWED_INFERENCE_PAYLOAD/V1`, schema, the exact
  SemanticExtractionInputEnvelope ID and payload digest, the complete ordered
  transcript ID-and-payload-digest set or the explicit
  `NO_MODEL_INFERENCE_USED` marker, exact reviewed proposal bytes, every retained
  and rejected proposal with source evidence and governed reason, every review-
  stage GovernedResidualObservation, reviewer identity and eligibility evidence and terminal
  review disposition. The reviewed bytes retain raw observed tokens, values,
  evidence spans and uncertainty. Review may reject or adjudicate a proposal but
  cannot silently invent missing source support. A changed transcript selection,
  reviewed byte, residual or disposition creates a new payload.
- The frozen `GovernedResidualProducerRegistry` is total over every intake,
  conversion, inference review, graph normalisation, discovery, taxonomy,
  validation, writer and candidate-certification boundary that may retain an
  unknown, invalid, conflicting, lossy or otherwise unconsumed observation. A
  `GovernedResidualObservation` stable ID hashes
  `GOVERNED_RESIDUAL_OBSERVATION/V1`, governing contract fingerprint, registered
  producer kind and version, exact immutable source or governed subject, ordered
  evidence spans or explicit no-span source reference, neutral residual kind,
  raw token or value digest and deterministic governed ordinal. Its payload
  retains the raw value or bytes, validation details, provenance and proposed
  object or candidate links. It excludes ContractFreezeAttestation, reviewer,
  disposition and impact IDs, so same-contract reapproval does not change the
  observed residual. An unregistered residual carrier, dropped error, generic
  string-only warning or unresolved ordinal is blocking.
- Before candidate sealing, two implementation-disjoint enumerators derive the
  residual universe from different authorities. The first walks every carrier
  named by GovernedResidualProducerRegistry. The second starts from the closed
  SemanticStageRegistry, CanonicalWriterDispositionRegistry, physical carrier
  schemas and generated stage-output and write-disposition manifests, derives
  every boundary and carrier capable of producing or retaining an unknown,
  invalid, conflicting, lossy or unconsumed observation, and then reads those
  carriers without consulting GovernedResidualProducerRegistry or the first
  enumerator. Contract freeze creates a
  `ResidualCapableBoundaryUniverse` from that second authority and requires
  bidirectional equality with the producer registry; an unregistered producer,
  residual-capable carrier or boundary is therefore detectable and blocking.
  For the exact intake cutoff, deal scope, extraction runs and candidate
  generation, the two bounded roots and a third
  `GovernedResidualUniverseReconciliation` must agree on the complete ordered
  residual ID-and-payload-digest set. `GovernedResidualUniverseManifest` hashes
  those roots, reconciliation, both authority roots, producer-registry digest,
  exact frozen pair and empty missing, extra, duplicate, unregistered-carrier,
  unregistered-producer and conflicting-payload roots. Counts, one review
  payload or the open-world candidate universe cannot substitute for this
  independent total inventory.
- Neither enumerator may take already emitted residuals as its expected
  universe. Before any semantic producer runs, an implementation-disjoint
  boundary recorder deterministically enumerates every admitted parser output,
  model observation, validator rejection, normaliser input and writer input
  from the immutable source and closed boundary schemas. It writes one
  `SemanticBoundaryAdmissionReceipt` per exact input atom, carrying source
  coordinates or a governed no-span source, raw digest, boundary kind and
  ordinal. Every receipt must terminate exactly once in a governed object, an
  open-world candidate, an affirmative non-substantive decision or a
  GovernedResidualObservation. A
  `SemanticBoundaryConsumptionReconciliation` compares that independent
  receipt root with the complete terminal-consumption root and carries empty
  missing, extra, duplicate and unconsumed roots. A proposition, exception,
  relationship, unknown attribute or error dropped before a producer or
  carrier therefore leaves an unconsumed receipt and blocks publication.
- Every universe member has exactly one final reviewed
  `GovernedResidualDisposition`: `COVERED_BY_GOVERNED_OBJECT`,
  `COVERED_BY_OPEN_WORLD_CANDIDATE`, `REVIEWED_NON_SUBSTANTIVE_OR_INVALID` or
  `REVIEWED_DUPLICATE`. The first two name the exact object or source-backed
  candidate without implying comparability. The duplicate names the earliest
  prior residual with the same producer contract, immutable governed subject,
  ordered evidence spans, neutral residual kind, raw-value digest, validation
  semantics and proposed-object links. Byte equality alone is insufficient.
  Duplicate chains are flattened to that earliest residual, cycles and forward
  links block, and the duplicate inherits the earlier residual's final
  disposition, exact governed link and reconciled impact closure. It may use a
  zero-effect closure only when the inherited closure is itself the reviewed
  zero-effect non-substantive branch. The non-substantive branch carries affirmative review
  evidence that no legal proposition or primitive was discarded. Pending,
  failed, not-examined, generic ignored and a fifth catch-all value are invalid.
  A final `GovernedResidualImpactClosure` either selects the mapped object's or
  candidate's reconciled impact closure and affected results, or proves a typed
  zero-effect branch for a reviewed non-substantive or duplicate residual. Two
  independent impact projections and a third reconciliation must agree. Every
  nonzero residual closure derives exactly one effective impact tier from the
  selected governed object or candidate:
  `ISOLATED_SOURCE_SPECIFIC`, `AFFECTS_CANONICAL_RESULT`,
  `AFFECTS_CORPUS_SCOPE` or `AFFECTS_CANONICAL_CONTRACT`. The same closed
  impact-to-publication mapping used for an open-world candidate applies to the
  residual; terminal review never neutralises a nonzero impact.
- `GovernedResidualDispositionManifest` partitions every member of
  GovernedResidualUniverseManifest exactly once by final disposition and exactly
  one reconciled impact closure. `GovernedResidualReviewQueueRoot` independently
  enumerates missing, duplicate, conflicting, invalid-link and unresolved-impact
  members. Scope or candidate work may display a typed affected-row preview, but
  candidate sealing requires its domain-separated empty root. These objects are
  written through the authoritative writer and propagate through scope,
  candidate input, CandidateReleaseManifest, bundle, import and traceability.
  Serving and query roles receive only the resulting governed row or explicit
  non-comparability state, never the residual review payload. “Zero unresolved
  residuals” means this complete partition and empty queue, not zero residual
  observations and not adoption of every unusual proposition into taxonomy.
- `SemanticGraphNormaliserDefinition` is a frozen CanonicalContractBundle object
  that fixes input and output schemas, canonical serialisation, normalisation and
  validation rules, executable and reproducible-build digest and finite node,
  edge, byte and runtime bounds. The deterministic normaliser receives only the
  exact SemanticExtractionInputEnvelope bytes, exact ReviewedInferencePayload
  bytes and this definition. It has no model, prompt, reviewer, network,
  database, corpus, release or mutable-cache access. Its output is the
  ValidatedSemanticGraph and validation report. The graph identity hashes all
  three input IDs and payload digests, the complete output and exact validation
  differences. The same three exact inputs must reproduce byte-identical graph
  bytes; a mismatch quarantines the graph. Independent model calls are compared
  as semantic proposals and disagreements require review or a new reviewed
  payload, never byte equality between model responses or majority vote.
- The intake boundary first writes one immutable `SubmissionReceipt` before it
  creates a source row, unpacks a container or assigns a deal. Its ID hashes the
  transport-envelope schema, source system and accession or approved import
  key, source version, byte length and complete raw transport payload digest.
  The receipt is committed through the intake-only writer operation below and
  is never part of a later deal transaction. A crash, unreadable package,
  failure to identify a deal or rejected source therefore leaves durable intake
  evidence rather than making the submission disappear.
- For a package, two separately implemented safe container readers create one
  immutable `IntakeProcessingAttempt`; only a reconciled passing attempt creates
  a `SubmissionExpansionManifest`. Their complete transitive parser
  and decompressor dependency graphs, including native libraries,
  runtime-loaded modules, subprocesses and services, must be disjoint. They may
  share only raw-byte I/O, cryptographic hashing and canonical-schema or
  serialisation primitives. Archive parsing, record recovery, path
  normalisation, traversal, compression and decompression code may not
  intersect, and the empty prohibited-intersection proof is machine checked.
- Each reader independently emits the ordered logical-member inventory,
  including path, compression method, flags, compressed and decompressed
  lengths, checksum and exact decompressed-bytes digest; a physical-record
  ledger with record kind and exact half-open raw-container interval; and a
  partition accounting for every raw byte exactly once as header, directory or
  index, member header, compressed payload, descriptor, metadata, padding,
  trailer, malformed-recovered record or blocking unknown. Gaps, overlaps,
  duplicate logical paths, unclassified bytes, inconsistent local and central
  records or decompression differences block. A policy-permitted
  malformed-but-readable record remains visible as `MALFORMED_RECOVERED` and
  passes only when both readers independently produce identical anomaly,
  record, interval and recovered-byte evidence.
- Every nested package is expanded recursively by both readers. Its parent
  compressed bytes remain in the parent's raw-byte partition, while the
  independently hashed decompressed payload is the child expansion subject.
  An encrypted, unreadable, truncated, unsupported or ambiguous member, reader
  disagreement, unsafe path, unknown byte without a governed disposition or
  incomplete recursion is a blocking attempt outcome. Recursive processing is
  represented inside one receipt-level attempt as bottom-up immutable
  `ArchiveAttemptNode` digests. A node ID hashes receipt, exact nested member
  path and source coordinates, decompressed-payload digest, both reader
  inventories and partitions, resource counters and ordered child-node IDs; it
  never references its parent or the root IntakeProcessingAttempt. Only the
  completed root attempt hashes its ordered root-node set and participates in
  the receipt-local attempt chain, so a nested package cannot create an identity
  cycle or a second receipt head.
- One passing receipt creates exactly one root `SubmissionExpansionManifest`.
  There are no nested expansion manifests or nested-expansion IDs. For a
  container, its ID hashes the exact receipt and passing attempt, container type,
  complete ordered bottom-up ArchiveAttemptNode inventory and root-node set,
  both unreconciled member inventories, physical-record ledgers, byte
  partitions and decompressed-member digests, both reader executable and
  configuration digests, both complete dependency graphs, the empty
  prohibited-intersection proof, exact bidirectional differences and passing
  disposition. Each member source occurrence references this root manifest,
  canonical nested member path, exact source coordinates and supporting
  ArchiveAttemptNode.
- A non-container creates the same root manifest with
  `container_type=NO_CONTAINER`, empty ArchiveAttemptNode and member inventories
  and one raw-byte partition entry `NON_CONTAINER_PAYLOAD` covering
  `[0, received_byte_length)`. Both readers and the independent raw enumerator
  independently agree on that classification, exact payload digest and complete
  partition. There is no optional, child or fabricated expansion marker.
- All three independent readers or enumerators enforce the same exact
  ArchiveSafetyPolicyManifest through separate code. They preflight declared
  sizes where available and re-enforce every bound while streaming, before
  allocating or persisting excess bytes. They never truncate and report
  success. They detect recursive digest cycles and record exact resource
  counters, first breached bound, member path and raw offset. Maximum raw bytes,
  member counts, recursive depth, per-member and aggregate decompressed bytes,
  expansion ratios, path and metadata size, CPU, wall time, memory, temporary
  disk and subprocess use are all finite. A policy or limit change creates a new
  attempt and never rewrites the prior failure.
- Before any reader starts, the intake work class validates the signed current
  IntakeProcessingPolicyHead and obtains a fenced fleet-wide lease under that
  activation's exact CapacityManifest. The shared control plane bounds concurrent
  receipt processors and aggregate reader memory, CPU, temporary disk and
  subprocess use across instances. All parsing and hashing occurs before the
  short canonical-write transaction and while holding no IntakeLedgerHead or
  receipt-head database lock. Admission failure records no fictional attempt;
  it is retried only by an explicitly scheduled background request with the
  same idempotency key, never by an immediate automatic retry.
- `intake_processing_attempt_id` hashes its schema and attempt-policy versions,
  exact SubmissionReceipt and raw-envelope digest, predecessor attempt or
  genesis marker, contiguous receipt-local attempt ordinal, attempt kind, exact
  IntakeProcessingPolicyActivation, ArchiveSafetyPolicyManifest and
  CapacityManifest, all three
  executable, configuration and transitive-dependency-graph digests, complete
  partial or complete member, record and raw-byte inventories, ordered
  ArchiveAttemptNode IDs, resource counters and first breached limit,
  discrepancy and failure codes, bounded diagnostic-artifact digests, exact
  CapacityManifest and canonical capacity-compliance proof digest, canonical request
  digest and one
  outcome: `RECONCILED_PASS`, `BLOCKING_RETRYABLE`,
  `BLOCKING_LIMIT_EXCEEDED`, `BLOCKING_UNREADABLE`,
  `BLOCKING_READER_DISAGREEMENT`, `BLOCKING_UNSUPPORTED_FORMAT` or
  `BLOCKING_POLICY_SUPERSEDED`. Every failed
  attempt remains immutable and addressable. It creates no expansion, source or
  universe object. Fleet lease ID, run, time and worker identity are provenance.
- Every attempt compare-and-swaps the exact receipt-local attempt head. A gap,
  stale predecessor, duplicate ordinal or fork fails before any attempt,
  expansion, source, universe, resolution or ledger event is written. Exact
  replay returns the prior operation receipt; changed policy, parser,
  configuration, raw inventory or outcome requires a successor attempt.
- One append-only receipt-local `IntakeResolution` chain selects effective
  treatment without hiding any attempt. Its ID hashes schema and policy,
  receipt, predecessor resolution or genesis, contiguous receipt-local
  generation, exact IntakeTransitionDefinition digest, singular optional
  selected attempt ID, ordered evidence-attempt IDs, passing root expansion and
  receipt-local universe IDs or explicit forbidden-field markers,
  ReceiptReplacementLink and exact replacement receipt's passing
  IntakeResolution where applicable, exact duplicate target receipt and passing
  IntakeResolution where applicable, exact IntakeProcessingPolicyActivation and
  generated policy-dependence class, governed reason
  and evidence, reviewer identity and eligibility, Ben approval where required,
  resolution executable and configuration digests, and, for every
  cutoff-eligible state, the exact frozen pair, IntakeDispositionPolicy object
  digest,
  programme-status digest, authorisation generation and writer recheck evidence
  or, for a blocking state, the explicit `NO_ELIGIBILITY_AUTHORISATION` marker,
  and one state: `PASS`,
  `BLOCKING_UNRESOLVED`, `BLOCKING_LIMIT_EXCEEDED`,
  `REPLACED_BY_REACQUISITION`, `REVIEWED_REJECTED`,
  `REVIEWED_OUT_OF_PROGRAMME_SCOPE` or `REVOKED_BLOCKING`. Every successor
  compare-and-swaps the exact receipt-local head. A gap, stale predecessor,
  duplicate generation or fork fails. A prior eligible state can change only
  through a reviewed `REVOKED_BLOCKING` successor. Existing cutoffs retain their
  historical selected heads as audit evidence, but later promotion stages must
  pass the current revocation-watermark check below.
- The generated transition table is total. `RECONCILED_PASS` under the current
  or expressly drain-compatible processing policy may produce only `PASS` and
  must select that exact new attempt, its one root expansion, complete source
  inventory and receipt-local universe. A result invalidated by a policy
  transition may produce only `BLOCKING_UNRESOLVED(POLICY_SUPERSEDED)` and no
  expansion, source or universe. `BLOCKING_LIMIT_EXCEEDED` maps only to the same
  resolution state; every other blocking outcome maps only to
  `BLOCKING_UNRESOLVED` with its exact reason. A new blocking attempt can never
  be paired with an older passing attempt.
- An eligible predecessor forbids another attempt or eligibility grant until
  `REVOKED_BLOCKING` commits. Revocation requires the exact eligible predecessor
  and governed revocation authority and forbids a new attempt, expansion,
  universe, replacement link or eligibility grant.
  `REPLACED_BY_REACQUISITION` requires a non-eligible predecessor or genesis,
  one exact replacement link and the current PASS head of its replacement.
  `REVIEWED_REJECTED(EXACT_DUPLICATE)` requires a non-eligible predecessor or
  genesis, exact raw-byte equality and the current PASS head of the retained
  receipt. Other rejection and out-of-scope rows require their exact closed
  reason, source evidence, independent evaluator, eligible review, Ben approval
  and current authorisation and forbid replacement or duplicate fields.
- Reauthorised `PASS` without a new attempt is permitted only after a
  `REVOKED_BLOCKING` reason confined to frozen-pair or IntakeDispositionPolicy
  authority. It must select the identical earlier passing attempt, expansion and
  universe after independent byte-, policy- and outcome revalidation. A
  processing-policy, source-integrity, parser or outcome revocation requires a
  successor attempt. A blocking resolution may proceed directly to a successor
  attempt. `ATTEMPT_AND_RESOLVE` and `REVIEWED_RESOLUTION` recheck current
  primary and dependency heads and enforce the entire generated cross-product
  atomically.
- `REVIEWED_REJECTED` and `REVIEWED_OUT_OF_PROGRAMME_SCOPE` require a generated
  policy-dependence class. `ARCHIVE_INDEPENDENT` is allowed only where positive
  envelope evidence proves parsing cannot affect the disposition;
  `ARCHIVE_DEPENDENT` is recreated or revalidated under the current archive
  policy. Unreadability, phrase absence, no deal match, a limit breach, policy
  violation or worker judgement never proves out-of-scope. A possibly relevant
  agreement, amendment, schedule or exhibit remains blocking until read or
  authoritatively reacquired.
- `REVIEWED_REJECTED(MALICIOUS_TRANSPORT)` is eligible only when authenticated
  provenance proves unauthorised non-programme traffic and independent evidence
  proves zero possibly unique legal content. Malware, unsafe path, expansion
  limit or malicious record inside an authenticated or possibly authentic
  programme submission never permits rejection. It remains blocking until
  safely read or replaced through ReceiptReplacementLink. A corrupt
  transmission replaced by different bytes likewise uses the replacement path.
- Different received bytes always create a new SubmissionReceipt. An immutable
  `ReceiptReplacementLink` hashes prior and replacement receipts, source system,
  accession or import key, both source versions, replacement sequence and
  reason, authority evidence, eligible review and Ben approval. A
  `REPLACED_BY_REACQUISITION` resolution is eligible only when the replacement
  receipt is inside the same cutoff, its selected latest resolution is `PASS`
  and evidence proves it is authoritative and contains every possibly unique
  legal byte. Otherwise the original remains blocking. Both receipts, every
  attempt, link and resolution remain visible; only verified replacement source
  occurrences may enter deal admission. The replacement receipt's PASS
  resolution exists before the link; the prior receipt's replacement resolution
  then hashes both. Neither receipt nor the replacement PASS points forward.
- `source_document_occurrence` stores one immutable receipt of a document and a
  required `source_content_id`. Its stable `source_occurrence_id` is the
  domain-separated hash of a versioned intake receipt containing source system,
  immutable external accession or Ben-approved import key, source version where
  available, exact SubmissionReceipt, exact root SubmissionExpansionManifest,
  optional member-path and supporting ArchiveAttemptNode identity or the
  explicit root `NO_CONTAINER` payload identity, exact passing
  IntakeProcessingAttempt and
  source-content ID. Two source occurrences with
  identical bytes remain distinct when their receipts differ; a replay imports
  the original receipt rather than allocating a new database identity.
- The identity-bearing intake key is an immutable external accession or a
  Ben-approved import key. URL, filename, acquisition time, database UUID and
  run ID are provenance only. A legacy derived record uses a separate typed
  source kind and can never collide with `ORIGINAL_BYTES`.
- An append-only receipt-ledger enumerator and a
  separately implemented object-store, accession and raw-container enumerator
  each produce a source inventory without reading SourceAdmissionManifest,
  DealAdmissionManifest or current corpus membership. `IntakeUniverseManifest`
  freezes their exact bidirectional equality over that one receipt, its
  accession and version, every member, source occurrence and SourceContent
  digest. The
  raw-container enumerator reads the original receipt bytes without consuming
  either package reader's output, and its parser and decompressor dependency
  graph is disjoint from both. It independently reproduces and reconciles the
  complete member inventory, physical-record ledger and raw-byte partition, not
  merely paths or counts. A missing, extra, replaced or unexpanded member,
  record, interval or byte is `BLOCKING_UNRESOLVED`.
- One passing IntakeUniverseManifest covers exactly one SubmissionReceipt, its
  one passing attempt, one root expansion and every SourceContent and source
  occurrence derived from that root. It contains no accession batch or unrelated
  receipt. A reviewed rejected or
  out-of-scope receipt instead retains its exact selected IntakeResolution and
  creates no fabricated source universe. CorpusScopeManifest inventories the
  complete set, while a deal and its PotentialDependencyUniverse bind only the
  ordered manifests that can belong to that deal. A later unrelated submission
  therefore cannot rekey an otherwise identical deal.
- `intake_universe_manifest_id` hashes its schema, exact SubmissionReceipt,
  ordered immutable receipt-scoped source-system, accession and object-store
  snapshot-slice IDs, each forbidden to contain another receipt,
  exact passing IntakeProcessingAttempt and
  SubmissionExpansionManifest, both complete inventory
  payload, physical-record and raw-byte-partition digests, all enumerator
  executable, configuration and transitive-dependency-graph digests, empty
  prohibited intersections, exact equality proof and complete
  reconciliation-disposition inventory. Neither a
  mutable current storage listing nor a row count can substitute for that frozen
  inventory. Any operational batch index is a rebuildable non-canonical query
  index with no stable ID, writer action, ledger event, eligibility effect or
  downstream reference.
- Every successful receipt, attempt-and-resolution or reviewed-resolution
  transaction appends an immutable
  `IntakeLedgerEvent` and advances a serialised monotonic `intake_generation`.
  An event ID hashes its schema, exact predecessor event or genesis marker,
  generation, action, SubmissionReceipt and every ArchiveAttemptNode, attempt,
  resolution, link and intake-object ID created by that action, request digest
  and terminal disposition. The mutable
  IntakeLedgerHead is only the locked pointer to that append-only chain. A gap,
  fork, duplicate generation or payload object absent from its event blocks.
- Before a corpus scope can freeze, two disjoint implementations build a
  `LedgerCutoffStateManifest` and `IndependentCutoffStateManifest` for the exact
  proposed generation. The first walks the append-only event prefix and
  event-to-created-object membership. The second independently enumerates the
  immutable receipt, object-store, intake-object, receipt-head
  history and ledger-event tables without reading the first manifest or its
  code, query helpers, database views or table registry. Both enumerate every
  ledger event and payload digest, SubmissionReceipt,
  ArchiveAttemptNode, IntakeProcessingAttempt, expansion, SourceContent, source
  occurrence, IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution,
  attempt and resolution predecessor edge and generation, receipt-local head,
  policy reference and selected-effective-head map at the cutoff. Their complete
  canonical projections must be exactly equal in both directions. Each manifest
  ID hashes schema, exact proposed generation and captured global heads, its
  closed inventory-kind registry, fixed BoundedInventoryTree root references
  and neutral root-set digest, executable and configuration digests and complete
  transitive dependency graph. Complete projections live only in the bounded
  tree nodes and never inline in the manifest or root. A source-only
  IntakeUniverseManifest does not substitute for this full cutoff-state proof.
  Both paths stream bounded shards; neither loads a broad prefix into application
  memory or performs one database call per receipt.
- `CutoffEnumeratorIndependenceAttestation` hashes both cutoff-manifest IDs,
  their complete dependency graphs, a governed shared-primitive allowlist and
  the exact empty prohibited intersection. Only database transport, raw
  immutable reads, canonical serialisation and cryptographic hashing may be
  shared. A third implementation then creates `CutoffStateReconciliation`; its
  ID hashes both manifests and the independence attestation, their fixed root-
  set content digests, fixed empty bidirectional-difference root references,
  duplicate and fork proofs,
  reconciler executable and configuration digests and terminal equality. It may
  compare or reject but cannot transform, fill or suppress an entry.
- `HistoricalIntakeGovernanceInventory` closes every governance reference
  reachable from that reconciled prefix. Its ID hashes schema, proposed cutoff
  generation, exact CutoffStateReconciliation and both independently reproduced
  BoundedInventoryTree root references over
  `(governance_object_type, stable_id, canonical_payload_digest)` entries for
  every referenced IntakeProcessingPolicyActivation,
  ArchiveSafetyPolicyManifest, CacheBudgetManifest, CapacityManifest,
  RouteBudgetManifest, OperationalPolicySet,
  CanonicalContractBundle, ContractFreezeAttestation, IntakeDispositionPolicy,
  IntakeTransitionDefinition, programme-status artefact and generation,
  authorisation evidence, review disposition, reviewer-eligibility proof, Ben
  approval and emergency-revocation authority. Two independent reference
  walkers each emit a fixed root reference over the exact transitive set. Each
  tree's separate enumerator attestation hashes executable and configuration
  digests and complete transitive dependency graph. The inventory ID also hashes both roots, their
  independence attestation and empty prohibited dependency intersection, exact
  fixed empty field-difference roots, duplicate and unresolved-reference proofs and the
  third reconciler's executable and configuration digests. Missing, extra and
  payload-mismatch sets must be empty. An unavailable historical payload cannot be
  replaced by a digest, current successor or prose description. These objects
  are audit inputs and cannot authorise current work.
- `IntakeEligibilityDependencyManifest` hashes the proposed generation,
  reconciled selected-effective-resolution-map root, both independent fixed
  BoundedInventoryTree roots for the selected receipt set and complete acyclic
  eligibility-edge set, and their reconciliation. Each selected-set member names one selected
  receipt and effective resolution. Every edge names a distinct subject receipt
  and resolution, dependency receipt and PASS resolution, and exactly one kind:
  `REPLACEMENT_TARGET` or `EXACT_DUPLICATE_TARGET`; self-edges are forbidden.
  Its ID also hashes both fixed root references and neutral content digests, each
  executable, configuration and transitive dependency graph, the exact empty
  prohibited intersection, third-reconciler identity, fixed empty field-
  difference roots and duplicate, cycle and reachability proofs. Members and
  edges live only in the bounded trees, never inline in the manifest.
  A missing, extra, revoked, non-PASS or outside-cutoff dependency blocks.
- One immutable `IntakeCutoffAttestation`
  selects an exact generation and hashes its schema, frozen contract pair,
  exact captured IntakeProcessingPolicyHead, IntakeLedgerHead and
  IntakeRevocationHead tuples, PREPARED CutoffBuildTransition and receipt,
  sealed CutoffPreparationHead tuple and terminal receipt, exact fresh passing
  `INITIAL_CUTOFF_FREEZE` IntakeEligibilityRecheckAttestation,
  CutoffPreparationSeal, both fixed CutoffPreparedRootSets and
  CutoffPreparedReconciliation, both control-receipt tree roots and exact
  CutoffPreparationControlReceiptReconciliation, exact LedgerCutoffStateManifest,
  IndependentCutoffStateManifest, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and
  IntakeEligibilityDependencyManifest IDs and canonical payload digests, all
  fixed BoundedInventoryTree root references selected by those objects, empty
  bidirectional-difference roots and latest-head eligibility proof. The
  corpus-sized ledger-event, source, intake-object, receipt-chain, governance,
  selected-effective-resolution, replacement, exact-duplicate and transitive-
  dependency members live exclusively under those roots and never inline in the
  attestation or freeze transaction. It selects exactly one latest head per
  receipt. Only `PASS`, `REPLACED_BY_REACQUISITION`, `REVIEWED_REJECTED` and
  `REVIEWED_OUT_OF_PROGRAMME_SCOPE` are cutoff eligible. A missing or forked
  chain, omitted historical failure, non-latest selection, blocking selected
  head, ineligible or outside-cutoff replacement, an eligible resolution bound
  to another frozen pair or IntakeDispositionPolicy, unsupported rejection or
  unexplained object blocks scope freeze. Every historical attempt validates
  against its own policy activation and manifests. A historical policy
  difference remains visible and does not itself block. A selected `PASS`
  attempt and every replacement or duplicate target PASS must use the current
  effective ArchiveSafetyPolicyManifest and must have committed under a valid
  activation or a certified intake-equivalent or drain-compatible chain. A
  selected reviewed disposition must be archive-independent or freshly
  revalidated under the current archive policy. An archive-result-invalidating
  transition requires a successor attempt and resolution.
- Every `REVOKED_BLOCKING` resolution also compare-and-swaps a monotonic
  singleton IntakeRevocationHead to the same immutable IntakeLedgerEvent, whose
  payload names the exact receipt, revoked resolution and new resolution IDs.
  An `IntakeEligibilityRecheckAttestation` has exactly one generated mode.
  `INITIAL_CUTOFF_FREEZE` hashes its schema, proposed cutoff generation, exact
  PREPARED CutoffBuildTransition and receipt, sealed CutoffPreparationHead tuple
  and terminal receipt, CutoffPreparationSeal and selected-effective-resolution-
  map root, but cannot reference the later IntakeCutoffAttestation, FROZEN
  transition or receipt. `POST_CUTOFF` instead hashes its schema, exact existing
  IntakeCutoffAttestation and the same selected-effective-resolution-map root.
  Both modes hash the exact
  IntakeEligibilityDependencyManifest and its selected-set and dependency-edge
  BoundedInventoryTree roots, observed
  revocation generation and head, exact current IntakeProcessingPolicyHead and
  activation, the complete governed transition chain from every selected
  attempt's activation to that head, and one indexed set-based anti-join proving
  no resolution in that complete set has a later revocation. It also proves each
  selected attempt remains valid under the current activation through only
  `INTAKE_EQUIVALENT` or certified `DRAIN_COMPATIBLE` transitions; any
  `ARCHIVE_RESULT_INVALIDATING` transition requires a new attempt and
  resolution. Its ID also hashes validator executable and configuration digests
  and terminal disposition. The mode discriminator and every mode-specific
  field enter the identity. No other mode or null substitution is permitted.
  IntakeCutoffAttestation selects exactly the fresh passing initial-mode
  attestation; every later scope, extraction, candidate, certification, import
  and activation stage selects a fresh passing post-cutoff attestation. Each
  creating stage locks the policy head before
  IntakeRevocationHead in its GeneratedLockPlanRegistry order. `DEAL_SCOPE_RUN`,
  `CORPUS_SCOPE_FREEZE`, `DEAL_EXTRACTION_RUN`, `CANDIDATE_RELEASE_FREEZE`,
  pre-cutover certification, production import and activation each lock or
  revalidate the current
  IntakeRevocationHead and bind a fresh matching attestation. A later unrelated
  revocation changes the watermark and requires a fresh proof; a revocation of
  selected intake blocks new promotion. If it affects the active release, the
  fail-closed serving-fence and release-state revocation protocol below applies
  before the revocation can commit. A policy-validator CAS to an
  `ARCHIVE_RESULT_INVALIDATING` activation first uses the same compact release
  dependency projection and fail-closed serving-fence protocol for any pending
  or active dependant, then commits the policy-head transition; an unavailable
  projection conservatively blocks all exposure and promotion.
- Every attempt and resolution locks IntakeLedgerHead; a revocation also locks
  IntakeRevocationHead after the receipt-local heads.
  `INTAKE_CUTOFF_BUILD/CUTOFF_FREEZE` locks and observes both exact existing
  heads, validates its sealed bounded preparation, writes its initial
  `INITIAL_CUTOFF_FREEZE` IntakeEligibilityRecheckAttestation, but neither
  appends an IntakeLedgerEvent
  nor advances either generation; its operation receipt supplies later audit
  without entering the selected prefix. An append
  serialises wholly before a cutoff and is included, or wholly after it at a
  higher generation. A later valid resolution can therefore release subsequent
  receipts without erasing the original blocker; it requires a new cutoff,
  scope and release. Corpus scope,
  candidate, release, certification, bundle and import artefacts bind the exact
  cutoff. Deal manifests, PotentialDependencyUniverse and family slices retain
  only their relevant IntakeUniverseManifest inputs, so later unrelated intake
  changes the next corpus scope and release without rekeying an existing deal's
  source or semantic identities.
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
- Primary conversion cannot verify itself. For every canonical-text occurrence,
  a separately implemented verifier reads the exact SourceContent directly and
  creates an immutable `CanonicalTextVerificationManifest` before the source
  can be `VERIFIED`. Its source-kind contract fixes an independent decoder or
  renderer, page, sheet, slide, package-part and visible-layer inventory,
  Unicode and ordering rules, tracked-change and annotation treatment, and an
  independent text or OCR pipeline. The verifier may receive the primary
  canonical text only at its final comparison step and cannot import the
  primary converter, source-map code, defaults or output parser. Build evidence
  proves distinct decoder or renderer and text-recognition dependency graphs;
  only byte I/O, cryptographic hashing and canonical serialisation primitives
  may be allowlisted as shared.
- The verification manifest hashes its schema and source-kind contract,
  SourceContent and canonical-text occurrence IDs, raw-part and rendered-page
  image digests, independent character, token, line and region inventories,
  exact page and offset alignment, verifier executable and configuration
  digests, every discrepancy and disposition and eligible human-review evidence
  where deterministic equality is unavailable. Every source region and every
  canonical character is accounted for exactly once. A discrepancy is
  `EXACT_MATCH`, `REVIEWED_RENDER_ONLY_DIFFERENCE` or
  `BLOCKING_UNRESOLVED`; a changed or omitted word, number, punctuation mark,
  page, footnote, table cell, visible tracked change or legal ordering can never
  be dismissed as formatting. A correction creates a new CanonicalTextOccurrence
  and verification manifest. A claimed zero-loss conversion with a verifier
  mismatch blocks admission. The manifest's terminal state is `PASS` only when
  both complete inventories reconcile, every discrepancy has an allowed final
  disposition and none is blocking; otherwise it is `FAIL`.
- A `SourceAdmissionManifest` is required for every source occurrence before
  extraction. It records raw-source disposition, receipt and retrieval
  provenance, converter code and configuration, canonical-to-source map,
  admitted and excluded intervals, governed exclusion reasons, conversion-loss
  residuals, exact CanonicalTextVerificationManifest where conversion occurred
  and coverage proof. Source kind is `ORIGINAL_BYTES` or
  `LEGACY_DERIVED_SOURCE`; admission state is
  `VERIFIED`, `QUARANTINED` or `REJECTED`. A historic record without original
  bytes may not masquerade as an original source: it must be reacquired and
  verified, admitted only under an explicit versioned SourceAdmissionRule
  approved through the Freeze Gate, or given an approved exclusion. Unresolved
  source loss blocks release, and the legacy kind remains visible in every
  downstream manifest. A `VERIFIED` state requires the exact canonical-text
  occurrence and verification manifest to pass with zero blocking discrepancy.
  `QUARANTINED` retains every partial object and residual. `REJECTED` may use
  explicit `NO_CANONICAL_TEXT` and `NO_VERIFICATION_MANIFEST` markers only with
  its exact governed rejection reason and evidence, and can never enter a
  DealAdmissionManifest as admitted text.
- Every SourceAdmissionManifest names the exact generated SourceAdmissionRule
  object key, version and canonical payload digest. An `ORIGINAL_BYTES`
  `VERIFIED` admission with zero excluded intervals, zero conversion loss and no
  reviewed discrepancy may select `NO_EXCEPTION_APPROVAL_REQUIRED` only when
  that exact rule declares the branch and a deterministic rule-evaluation proof
  covers every input and returns `PASS`. `QUARANTINED` may carry a deterministic
  blocking proof but can never enter scope. Every `LEGACY_DERIVED_SOURCE`,
  non-empty admitted exclusion or conversion-loss allowance, reviewed verifier
  discrepancy or `REJECTED` disposition instead requires one passing immutable
  `SourceAdmissionApprovalAttestation`.
- `source_admission_approval_attestation_id` hashes schema and policy version,
  frozen contract pair, exact SourceAdmissionRule object key, version and
  payload digest, source occurrence and source kind, proposed admission state,
  the complete proposed admission payload digest excluding this attestation,
  exact CanonicalTextVerificationManifest ID or explicit permitted marker,
  immutable review-disposition ID, reviewer identity and eligibility-evidence
  digest, required Ben-approval-evidence ID or the exact rule-declared
  `NO_BEN_APPROVAL_REQUIRED` marker, terminal `PASS` or `FAIL` and bounded reason
  digest. It is `PASS` only when every rule, review, eligibility and approval
  predicate is current and matching. Only a passing attestation may be selected
  by an exceptional admission; it cannot rewrite the proposed payload. Review
  annotations, execution metadata and timestamps remain provenance.
- `source_admission_manifest_id` is the domain-separated content hash of source
  occurrence, source kind and admission state, exact SourceAdmissionRule object
  key, version and payload digest,
  source-content and canonical-text ID or explicit marker, converter and
  source-map digests, CanonicalTextVerificationManifest ID or explicit marker,
  admitted and excluded interval sets with
  reasons, conversion-loss residual IDs, the complete coverage-proof digest and
  either the exact passing SourceAdmissionApprovalAttestation ID or the
  rule-declared no-exception marker and deterministic proof digest, plus the
  ordered applied scope-stage CorrectionApplication IDs. Mutable
  annotations and timestamps are provenance; review eligibility and approval
  evidence are identity-bearing through the attestation.
- `SourceAdmissionPreparationReceipt` is the immutable admission-only boundary
  between verified source intake and any semantic proposal. There is exactly one
  stable receipt slot per `(source occurrence, terminal
  SourceAdmissionManifest, proposed DealIdentityManifest or NON_DEAL_SUBJECT
  marker)`. Its ID hashes
  `SOURCE_ADMISSION_PREPARATION_RECEIPT/V1`, schema, that complete slot, the exact
  ImmutableSourceDocument, CanonicalTextContent and occurrence,
  CanonicalTextVerificationManifest, SourceAdmissionRule and any required
  SourceAdmissionApprovalAttestation, terminal SourceAdmissionManifest and exact
  DealIdentityManifest or marker IDs and canonical payload digests, every exact
  logical blob content ID, length and digest, writer executable and
  configuration digests and terminal `PASS`. It also carries fixed empty semantic-envelope,
  inference-transcript, reviewed-payload, graph, candidate, disposition,
  deal-admission, impact, applicability and serving-write roots. Exact replay of
  the same slot and payload returns the same receipt; a conflicting payload,
  second receipt for the slot or stale cutoff, policy, revocation, authorisation
  or blob generation writes nothing. Attempt, worker, time and idempotency key
  remain provenance outside identity. The creating cutoff, policy, revocation
  and authorisation observations and the environment-local
  BlobAvailabilityReceipt IDs and generations are also operation provenance,
  not local source identity inputs; every later consumer independently
  revalidates them under its own current context.
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
- `AdmittedCoverageAtom` is the semantic-free coverage unit. A pinned text-only
  atomiser intersects each verified admitted interval with its structural leaf
  and splits only on deterministic structural, UTF-8 code-point and lexical
  boundaries. It cannot inspect a concept, definition, provision, discovery
  disposition, model output or contract scope rule. Atom IDs hash atom-schema
  and atomiser versions, canonical-text and structural-leaf IDs, exact half-open
  interval and exact-bytes digest. For each source admission the ordered atoms
  partition every admitted byte exactly once and no excluded byte; a gap,
  overlap, altered byte or invalid UTF-8 boundary blocks all semantic work.
- `SemanticSpan` is source geometry, not legal meaning. Its ID derives from
  `(canonical_text_id, absolute_start, absolute_end)`, so exact interval
  duplicates collapse. Semantic objects and evidence roles point to spans and
  may reuse or nest them; the span owns no copied source text.
- Each frozen `ExcerptDefinition` fixes its key, version and payload digest,
  purpose, complete ordered component-slot registry, per-slot cardinality and
  source rules, comparator, duplicate policy and permitted transformation or
  redaction versions. `Excerpt` may select one or several spans. Its ID derives
  from the exact ExcerptDefinition key, version and payload digest, ordered
  duplicate-free `(component_slot_key, governed_slot_ordinal,
  semantic_span_id)` assignments, excerpt purpose, transformation or redaction
  version and output-text hash. A one-span excerpt uses the definition's fixed
  primary slot; a multi-span excerpt never falls back to an unordered or merely
  deduplicated span set. The stored output must be reproducible byte-for-byte
  from that exact mapping and transformation. An unexplained mismatch is
  quarantined. By default all spans belong to one canonical-text occurrence and
  assignments sort under the definition's source-coordinate comparator. A
  governed cross-source excerpt uses the definition's component-slot order;
  lexical source IDs are not legal order. Relabelling a slot or changing the
  definition therefore changes Excerpt, evidence, revision and serving-detail
  lineage even when the same bytes and span IDs remain.
- `governed_deal_key` is the domain-separated hash of
  `(deal_identity_schema_version, immutable_deal_seed)` in a
  `DealIdentityManifest`. The immutable seed is a closed tagged union. The
  `REGISTERED_EXTERNAL_TRANSACTION` branch contains a registry-governed issuer
  namespace key and version plus the issuer's exact immutable transaction ID;
  a bare external ID is invalid. The `BEN_APPROVED_IMPORT_IDENTITY` branch
  contains the canonical proposed-import seed itself: governed source namespace,
  immutable submitted transaction identifier and seed-schema version. The
  approval attestation authorises that seed but does not enter the seed or
  governed key. The manifest separately carries one immutable
  `DealIdentityApprovalAttestation` ID and payload digest. That signed
  attestation binds the exact proposed import seed,
  approving identity, approval scope, non-reuse nonce, any reviewed
  supersession references and terminal unconditional `APPROVED`; an owner
  statement or unsigned label cannot substitute. Buyer, seller, title, value,
  dates, aliases and
  environment-allocated UUIDs do not enter it. `DealAdmissionManifest`
  separately maps ordered source occurrences and document roles to that key.
  Source-membership changes revise the admission manifest without changing deal
  identity. The ordinary deal-admission builder may share the frozen
  DealDocumentOrderingDefinition, schemas, byte I/O, canonical serialisation and
  hashing only. Its transitive dependency graph must not contain the independent
  builder, its role or selection logic, comparator implementation, intermediate
  rows, comparator tuples, ordinals or output. Duplicate, merge or split
  decisions require an explicit reviewed supersession map.
- `deal_identity_manifest_id` is the content hash of the identity-schema
  version, complete tagged immutable seed, its registered issuer-authority
  object or exact DealIdentityApprovalAttestation ID and payload digest,
  governed deal key and any reviewed supersession references. Contract freeze
  fixes the external-issuer namespace registry and approval schema. Duplicate
  issuer namespaces, an unregistered issuer, reused approval nonce, missing
  approval, wrong seed binding or conflicting supersession makes the manifest
  invalid.
  `DealIdentitySeedSlot` is the sole mutable identity-allocation authority,
  keyed by `(deal_identity_schema_version, proposed_import_seed_digest)` for a
  Ben-approved import and by the registered issuer tuple for an external
  transaction. A serialisable compare-and-swap may bind that slot to exactly one
  governed deal key and one current manifest lineage. A second attestation or
  nonce for the same seed must resolve to that same key and may only create a
  reviewed authority successor; it cannot allocate another deal. Conflicting
  keys, simultaneous genesis claims or a proposed seed already governed under
  another branch perform zero identity DML and enter the duplicate-or-
  supersession review queue.
  The exact DealIdentityApprovalAttestation or registered external-issuer
  authority is selected by SourceAdmissionPreparationReceipt and every
  DealIdentityManifest consumer, and is inventoried through scope, candidate
  input, CandidateReleaseManifest, release bundle, production import and
  traceability. Serving roles cannot read either authority payload.
- After every relevant source has an exact CanonicalTextVerificationManifest and
  terminal SourceAdmissionManifest, and after the exact DealIdentityManifest
  exists, but before ordinary deal admission, a separate
  `IndependentDealDocumentManifest` uses disjoint subjects.
  `DEAL_DOCUMENT_UNIVERSE` is keyed by one exact
  DealIdentityManifest and assigns each relevant intake-universe source
  occurrence to its document role. `NON_DEAL_INTAKE_DISPOSITION` is keyed by an
  intake source that is not assigned to a deal. The independent builder uses the
  immutable receipt, source-system or package index,
  verified raw-source rendering, intrinsic document evidence and cross-document
  references. It cannot read or import DealAdmissionManifest construction code
  or output, comparator implementation, intermediate tuple or ordinal. Every
  entry has exactly one terminal disposition:
  `INCLUDE_AS_ROLE`, `INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE`,
  `EXACT_DUPLICATE_OF`, `NON_DOCUMENT_TRANSPORT`, `OUT_OF_PROGRAMME_SCOPE` or
  `BLOCKING_UNRESOLVED`. A support agreement, voting agreement, side letter,
  amendment, joinder, exhibit, schedule or other possibly relevant document
  cannot disappear because its role is absent from the frozen registry.
  A role candidate is reviewed before the final entry is chosen.
  `INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE` keeps the source in the deal and
  PotentialDependencyUniverse, carries the exact
  `SOURCE_OR_DOCUMENT_ROLE` OpenWorldSemanticCandidate and observed role tokens,
  and is terminal only for a `REVIEWED_SOURCE_SPECIFIC` role; it uses the
  contract-fixed `OPEN_WORLD_ROLE_UNMAPPED` ordering marker, which is
  not a canonical document-role key and conveys no legal precedence. Every
  source-backed cross-document reference resolves to exactly one intake source
  and governed role or reviewed open-world-role candidate, or creates a
  reference-only `BLOCKING_UNRESOLVED` entry
  keyed by its source coordinates; lack of a received file cannot erase the
  expectation. A non-include disposition requires exact evidence, an eligible
  independent review and Ben approval; an exact duplicate names the retained
  source occurrence and proves byte equality. Across the complete corpus, every
  cutoff-selected `PASS` source has exactly one included deal membership or one
  reviewed non-deal disposition, while every cutoff-selected rejection,
  out-of-scope or replacement resolution has exactly one matching non-admitted
  disposition. Unexplained zero or multiple memberships or a disposition that
  disagrees with the selected IntakeResolution blocks.
- An `INCLUDE_AS_ROLE` or `INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE` entry must
  reference the exact passing SourceAdmissionPreparationReceipt, verification
  and `VERIFIED` source admission. The
  entry generated from a role candidate additionally binds its exact pre-
  admission candidate occurrence and final reviewed disposition solely to decide
  document membership, but cannot bind a later admitted occurrence or
  SemanticImpactClosure. `MAPPED_EXISTING` or `MAPPED_ALIAS` produces
  `INCLUDE_AS_ROLE` and projects the existing frozen document role into the
  final included tuple while retaining candidate lineage.
  `ADOPTED_NEW_CANONICAL` is usable only under the successor frozen bundle that
  already contains the new role and likewise produces `INCLUDE_AS_ROLE`.
  `REVIEWED_SOURCE_SPECIFIC` alone produces
  `INCLUDE_WITH_OPEN_WORLD_ROLE_CANDIDATE` and retains
  `OPEN_WORLD_ROLE_UNMAPPED`. `REJECTED_NON_SUBSTANTIVE_OR_INVALID` rejects the
  proposed role cue, not the document: the source must still receive a separately
  proved existing role or remain `BLOCKING_UNRESOLVED`. It can never disappear
  or become out of scope from that disposition. After DealAdmissionManifest
  exists, the canonical writer must create the exact
  admitted candidate occurrence, mechanically rekeyed evidence and primitives,
  `OpenWorldCandidateAdmissionTransition` and carried-forward current
  disposition, in that order, as described below. The pre-
  admission occurrence and disposition remain immutable audit evidence and have
  no impact, applicability, serving or market authority. After
  PotentialDependencyUniverse exists, DealScopeRunManifest must select only the
  admitted candidate occurrence, transition, carried-forward current
  disposition, independently
  reconciled SemanticImpactClosure and every affected-result incompleteness
  contract before scope freeze. After complete included membership is frozen,
  the independent builder derives every DealDocumentOrderingDefinition
  comparator field directly from the immutable receipt, accession, recursive
  package position and reviewed role or version evidence, sorts canonical
  serialised bytes and assigns a contiguous one-based `source_ordinal`. Each
  included tuple contains receipt and accession/version identity, SourceContent,
  source occurrence, CanonicalTextVerificationManifest,
  SourceAdmissionManifest and DealIdentityManifest IDs, governed deal key,
  governed document role or exact open-world marker and candidate occurrence,
  version or supersession rank, ordering-definition digest,
  complete comparator tuple and its digest, source ordinal and disposition or
  exact-duplicate target. A missing comparator field, conflicting logical key,
  non-contiguous ordinal or unresolved tie blocks.
- `independent_deal_document_manifest_id` hashes its schema, exact
  subject variant, ordered relevant IntakeUniverseManifest IDs, exact governed
  DealIdentityManifest ID where applicable, complete ordered verification and
  source-admission IDs, complete tuples above, source-evidence and
  cross-document-reference digests, DealDocumentOrderingDefinition digest,
  independent enumerator executable, configuration and transitive-dependency
  graph digests, ordered review and Ben-approval evidence IDs and ordered
  applicable ManifestMembershipRevision and CorrectionApplication IDs.
- The ordinary builder independently freezes membership, derives the same
  comparator fields from its permitted inputs, sorts with the frozen definition
  and assigns the ordinal. `deal_admission_manifest_id` is the content hash of
  governed deal key, admission-contract and ordering-definition versions,
  ordinary executable, configuration and independence-evidence digests and the
  ordered complete ordinary projection containing every field in the included
  tuple above, plus ordered applicable ManifestMembershipRevision and
  CorrectionApplication IDs. A role, membership, comparator or ordinal change creates a new
  admission manifest; no current database membership query or independent-path
  row may substitute for it.
- After SourceAdmissionManifest and DealAdmissionManifest exist, one separately
  implemented `AdmissionUniverseReconciliation` projects them back to the exact
  intake and independent deal-document schemas. It requires exact equality in
  both directions and field by field for receipt, accession, version, bytes,
  source occurrence, admission and verification manifest, governed deal,
  document role or open-world marker and candidate occurrence, duplicate target,
  ordering-definition digest, every comparator input and digest and source
  ordinal, plus the exact cutoff-selected
  IntakeResolution, replacement link and terminal reviewed disposition for
  every non-admitted receipt. It compares the two supplied projections without
  recomputing, repairing, reordering or selecting either answer. Every
  reference-only expected source must resolve or remain blocking. A wholly
  omitted document, role swap, unlisted version, comparator-field difference,
  ordinal permutation or gap, duplicate mapped to the wrong retained source or
  self-declared “complete” deal manifest blocks before the text-only semantic
  universe is built.
- `admission_universe_reconciliation_id` hashes its schema, exact
  ordered relevant IntakeUniverseManifest and IndependentDealDocumentManifest
  IDs, complete
  SourceAdmissionManifest and DealAdmissionManifest projections, empty
  bidirectional difference sets, reconciler executable and configuration
  digests and terminal disposition proof.
- A scope-stage membership correction is the sole exception to rebuilding the
  two membership answers from raw evidence alone. Before either path reruns, the
  writer creates the exact approved ManifestMembershipRevision. Both builders
  may consume that common governed override, its CorrectionApplication and no
  other path output. Each rebuilt manifest hashes the revision and application;
  AdmissionUniverseReconciliation then still requires exact field equality.
  Neither builder may infer, broaden or copy the other's corrected answer.
- Before text-only discovery, two implementation-disjoint projectors derive one
  `PairNeutralDealDocumentProjectionRoot` from the independent manifest and one
  from the ordinary admission manifest. Each projects only the complete included
  source-occurrence and verified-text set under a separate
  `PairNeutralSourceOrderingDefinition`: source system, immutable accession or
  approved import key, source version or explicit null, recursive package path
  and ordinal, source occurrence, canonical text, structural offsets and exact
  byte digests. It creates `PairNeutralCoverageAtom` identities from those
  source-only fields. It excludes governed deal and document role, role priority,
  open-world marker, candidate content, every review or disposition value and
  ID, duplicate decision, the admission comparator and ordinal, frozen pair,
  correction and authorisation data, executable identity and every later
  semantic object. Membership remains a mandatory reconciled prerequisite, but
  no taxonomy or role decision is observable inside the neutral bytes.
  A third `PairNeutralDealDocumentReconciliation` requires byte-equal ordered
  roots and empty missing, extra, duplicate, ordering and field-difference roots.
  The governed manifests, their review evidence and
  AdmissionUniverseReconciliation remain mandatory prerequisites and release
  lineage, but they are not inputs to this pair-neutral content identity. A
  same source membership and bytes therefore preserve the pair-neutral roots
  across reapproval, role mapping, open-world disposition, taxonomy promotion,
  admission ordering or duplicate-handling changes. A source-membership,
  source-version, verified-text, structure or neutral-ordering change rekeys
  them.
- One immutable `PotentialDependencyUniverse` is built after verified deal
  admission and deterministic structure but before ordinary semantic discovery.
  The only earlier semantic proposal is the closed pre-admission source-role
  lane above, which has no impact, applicability or serving authority. Its ID
  hashes only its schema and
  text-only atomiser versions, both PairNeutralDealDocumentProjectionRoot IDs
  and payload digests, their reconciliation and common content digest, ordered
  source-content and CanonicalTextVerificationManifest semantic-content digests
  and the complete ordered
  `(pair_neutral_coverage_atom_id, canonical_text_id, structural_leaf_id, start,
  end, bytes_digest)` inventory. It deliberately excludes the contract
  fingerprint, ContractFreezeAttestation, governed admission-manifest or
  candidate-disposition ID, reviewer or approval evidence, semantic spans or
  occurrences, discovery edges, ClaimScopeDefinition, approved exclusions and
  every candidate or serving object. A source membership, source version,
  verified text, structural or atomiser change rekeys it; a role, disposition,
  taxonomy, semantic classification or scope-rule change cannot. This stable text-only universe is the independent baseline against
  which later claims that text is irrelevant are tested.

### 2. Definitions-first semantic objects and stable identity

- Definitions are detected before operative provisions, but detection does not
  require a canonical concept. `ValidatedSemanticGraph` first emits one
  source-backed `DefinitionCue` for every ordinary, inline or nested syntactic
  definition. Its stable ID hashes the source anchor, exact defined-term text
  and body spans, raw term digest, syntactic role and source-order ordinal. It
  carries no `concept_key`, governed alias or comparability claim. A
  `DefinitionUseCue` separately anchors each use span to that cue, so one novel
  definition used by three provisions retains three source-backed use edges.
  Only a definition mapped to an existing concept or alias, or adopted through a
  later approved bundle, becomes a `ProvisionInstance(kind=definition)` and
  typed `USES_DEFINITION` relationship. An unfamiliar definition instead feeds
  an `OpenWorldSemanticCandidate(candidate_kind=CONCEPT)` and its familiar
  definition and use primitives. If finally `REVIEWED_SOURCE_SPECIFIC`, those
  primitives and evidence publish through the source-specific row contract but
  no `ProvisionInstance`, canonical concept or market cohort is invented.
  DefinitionCue and DefinitionUseCue are immutable child nodes of the validated
  graph and travel with that graph's writer, inventory and trace lineage; they
  are not a second writable carrier or independent serving truth.
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
  document_hash, absolute_start, absolute_end, concept_key, party, ordinal)`,
  where `party` is the complete governed `(role, value, capacity)` tuple.
  `document_hash` is the SourceContent exact-bytes hash, including its typed
  legacy-source domain when original bytes are unavailable; `party` is a governed
  `{ role, value, capacity }` attribution. This preserves the required document-hash and
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
  end, object type and key, party role, value and capacity and the governed pre-ordinal
  candidate digest. A family-specific comparator may replace it only through
  the Freeze Gate. Exact pre-ordinal duplicates collapse; non-identical
  candidates still tied on the complete comparator are quarantined. Model,
  insertion, database iteration and run order are never tie-breakers.
- A `ScopeAssessmentOccurrence` gives a whole-concept assessment a stable
  non-fabricated subject identity derived from its governed source occurrence or
  DealAdmissionManifest subject, assessment definition and version, concept,
  governed party and the ordered `ClaimScopeClosure` IDs for its expected claim
  slots. A closure uses occurrence-independent subject inputs, so this does not
  create an identity cycle. Every interval-set member inside those closures is
  `(canonical_text_id, start, end)`, so a deal-level assessment may cover
  several admitted documents without mixing coordinate systems. Examination
  progress is revision content and never changes this logical occurrence ID.
- Any change to a source-anchor tuple, including a same-text boundary correction,
  requires an explicit reviewed anchor-migration map. Any change to a semantic
  or component identity creates a recorded superseding identity. Neither may be
  recovered by fuzzy matching.

### 3. Typed claims, evidence and explicit states

- Every extracted answer is a typed claim governed by a `ClaimDefinition`.
  Every ClaimDefinition references exactly one versioned
  `ClaimScopeDefinition`. It declares the governed base-subject rule, permitted
  document roles, party and capacity, temporal scope, proposition
  quantification, conclusive-witness rule, legal-dependency traversal rules,
  accepted dependency states and bounded closure cardinalities. A subject-only
  scope is valid only when independent dependency enumeration proves that the
  complete dependency set is empty. An extractor or contract author's bare
  assertion that there is no external dependency is not proof.
- Before the ordinary expectation compiler runs, a separately implemented
  challenger creates one immutable `IndependentSemanticChallengeManifest` for
  the exact PotentialDependencyUniverse and frozen contract pair. It receives
  the exact canonical text, the complete text-only universe, and the closed
  contract catalogues of possible ProvisionConcept and semantic-object kinds,
  plus only the separately authored IndependentSemanticQuestionCatalogue. It
  may share implementation-neutral comparison keys and primitive schemas but
  cannot read ordinary ClaimDefinition, ClaimScopeDefinition,
  RelationshipDefinition or RelationshipEffectSchema question prose. It also
  receives every SourceAdmissionManifest's exact excluded-interval,
  immutable SourceContent byte reference, source-to-canonical-map and
  conversion-loss inventory before subject discovery.
  It is not handed ordinary discovery's selected base subjects,
  definitions, parties or expected slots.
- Its catalogue input is the minimal RFC 8785 canonical payload bytes for the
  independent catalogue objects plus each object's verified digest, read
  directly from the closed bundle through a challenger-owned parser. It cannot
  import any ordinary question prose, ClaimScopeDefinition traversal code or
  output, generated contract code, generated expectations, defaults, aliases or
  test values. Certification
  inventories the exact challenger input-byte digests and
  proves the import graph contains no ordinary semantic package.
- The challenger independently creates a total `ChallengeBaseSubject` inventory
  with disjoint subject variants. `SOURCE_SPAN_SUBJECT` is keyed by exact source
  coordinates, semantic object kind, a source-only preclassification candidate
  key and raw-cue digest, deterministic base-subject ordinal, concept, party and
  capacity. `SOURCE_OCCURRENCE_ASSESSMENT` is keyed by exact source occurrence,
  document role, assessment definition and version, concept, party and capacity.
  `DEAL_ASSESSMENT` is keyed by exact DealAdmissionManifest, assessment
  definition and version, concept, party and capacity. Assessment variants are
  independently enumerated from the complete contract catalogue and admission
  manifest and have no fabricated source coordinates. Ordinary discovery
  separately creates the same three disjoint subject variants as
  `OrdinaryBaseSubject`; its assessment variants are enumerated from the
  complete catalogue and admission manifest rather than from discovered
  provision spans. `B_base` and `O_base` are the complete source-coordinate or
  assessment-identity projections of those independently built inventories.
- After exact `B_base = O_base`, each path independently expands its own authored
  catalogue across every reconciled base subject. The
  `IndependentSemanticQuestionUniverseManifest` and
  `OrdinarySemanticQuestionUniverseManifest` each hash schema, frozen pair,
  PotentialDependencyUniverse, exact base inventory, path-specific catalogue
  root and question payload IDs, exact SemanticQuestionCatalogueReconciliation,
  complete ordered subject-question entries,
  partition proof, executable and configuration digests and path-eligible review
  evidence. Each implementation-neutral entry is
  `(base_subject_tuple, semantic_question_key, question_kind,
  proposition_or_effect_dimension, complete proposition-or-effect AST,
  complete applicability predicate AST, quantification and conclusive-witness
  rules, party, capacity and temporal scope, state semantics, positive-witness,
  negative-witness and absence-proof rules, evidence scope and roles,
  dependency-or-effect target, operation and selection rules, repeatability,
  cardinality and governed_ordinal)`. Path-specific IDs and evidence are
  excluded only from the comparison projection.
- In parallel with base-subject discovery, a third, catalogue-blind
  implementation creates one `IndependentLegalDimensionDiscoveryManifest`
  directly from exact admitted text and PotentialDependencyUniverse. It cannot
  read either semantic-question catalogue, any ClaimDefinition,
  ClaimScopeDefinition, RelationshipDefinition, generated output, alias,
  fixture, base-subject classification or question-universe output. It uses
  only source-form cue primitives and broad, non-taxonomic dimension kinds:
  base proposition or mechanism, qualifier, exception, trigger, party or
  capacity, temporal condition, dependency and legal effect. Its complete atom
  partition gives every admitted atom exactly one coverage disposition:
  `DIMENSION_CANDIDATE`, `NO_LEGAL_DIMENSION_CUE` or
  `BLOCKING_UNRESOLVED`. A candidate disposition references the complete ordered
  set of atomic candidates touching that cell, so overlapping cues remain
  visible without counting the underlying atom twice.
- Each dimension candidate ID hashes schema, PotentialDependencyUniverse,
  exact source interval set, source-only cue digest, broad dimension kind and
  source comparator ordinal. The discovery-manifest ID additionally hashes the
  exact frozen pair, complete candidate inventory, atom partition, executable and configuration
  digests, transitive input-firewall proof and eligible independent-review
  evidence for every negative or candidate disposition. A gap, unexplained cue,
  catalogue-derived cue rule or unresolved cell blocks.
- The source-only discovery worker cannot observe or branch on the contract
  fingerprint, freeze-attestation digest, either catalogue digest or review
  disposition. A separate non-semantic attester wraps its completed payload with
  the frozen pair and review evidence when constructing the manifest. Changing
  that metadata rekeys the manifest but cannot change its candidate or atom
  partition; an input-dependency or information-flow test proves this boundary.
- Only after exact base-subject reconciliation, a separately implemented
  `IndependentLegalDimensionMappingManifest` maps each discovered atomic
  candidate through a complete non-empty ordered set of mapping edges to one or
  more reconciled base-subject and independent semantic-question pairs, or marks
  it `UNMAPPED_LEGAL_DIMENSION` or `BLOCKING_UNRESOLVED`. One candidate may govern
  several provisions, claims or effects, and several candidates may support the
  same subject-question pair; neither case permits copying or collapsing source
  evidence. Each mapping edge fixes its candidate, subject-question pair,
  dependency or effect role and deterministic edge ordinal. Its ID hashes the
  exact frozen pair, IndependentSemanticQuestionCatalogue root, base-subject
  reconciliation, both complete inputs, every candidate-to-subject-and-question
  mapping edge or mapping state, source evidence, governed reason, evaluator and
  configuration digests and eligible independent-review evidence for every
  mapping and state. It may read the independently authored question catalogue
  but not ordinary definitions or question-universe output. It cannot create or
  alias a question.
- `UNMAPPED_LEGAL_DIMENSION` is a required discovery signal, not a final legal
  disposition and not permission to force source text into the nearest known
  key. Every signal that may express an unmapped proposition, question,
  relationship, role, composition rule, basis, source role or multiplicity rule
  is assigned through a complete many-to-one partition to exactly one
  `OpenWorldSemanticCandidate`; every candidate has a non-empty supporting signal
  set. `candidate_kind` is exactly `CONCEPT`, `ATTRIBUTE_OR_QUESTION`,
  `RELATIONSHIP_OR_EFFECT`, `PARTY_OR_LEGAL_ROLE`, `RESULT_COMPOSITION`,
  `UNIT_OR_COMPARISON_BASIS`, `SOURCE_OR_DOCUMENT_ROLE`,
  `MULTIPLICITY_OR_CARDINALITY` or `UNRESOLVED_CANDIDATE_KIND`.
  `UNRESOLVED_CANDIDATE_KIND` is blocking. There is no `OTHER`, lossy fallback,
  nearest-key coercion or silent non-substantive default. An unassigned signal,
  many-candidate assignment without an exact partition rule, unresolved grouping
  tie or `BLOCKING_UNRESOLVED` signal also blocks.
- `source_package_hash` is the SHA-256 of the actual immutable original package
  bytes, not extracted text. An `OpenWorldEvidenceSpan` descriptor carries that
  package hash, exact CanonicalTextOccurrence and source-map digest, exact ordered
  canonical half-open offsets and source coordinates, exact-bytes digest,
  evidence role and source-order ordinal. Cross-document candidates designate
  one primary canonical-text occurrence and retain the package hash and
  occurrence for every additional span. A neutral proposition-or-mechanism body
  is a versioned source-backed AST whose leaves reproduce the cited words and
  whose operators express only non-taxonomic modality and logical structure.
  Its digest excludes every canonical key, similarity label and market result.
- `open_world_semantic_candidate_id` is exactly
  `H("OPEN_WORLD_SEMANTIC_CANDIDATE/V1", schema, candidate_kind,
  source_package_hash, primary CanonicalTextOccurrence ID and payload digest,
  exact ordered OpenWorldEvidenceSpan descriptor set, neutral proposition-or-
  mechanism digest, exact ordered observed party-token text and evidence
  digests, governed_source_ordinal)`. The ordinal follows the contract-fixed
  source-span, party-token and neutral-digest comparator. Model, similarity,
  insertion and discovery order are prohibited and a remaining non-identical tie
  blocks. The candidate schema has no canonical concept, attribute,
  relationship, party, result, metric, unit or alias key and rejects any such
  field if supplied. `OpenWorldCandidateOccurrence` has two disjoint source-
  lineage variants so identity order remains acyclic. `PRE_ADMISSION_SOURCE_ROLE`
  binds the candidate to source occurrence, ImmutableSourceDocument,
  SourceAdmissionManifest and proposed DealIdentityManifest, observed role
  tokens and an explicit
  `NO_DEAL_ADMISSION_YET` marker.
  `ADMITTED_SEMANTIC` instead binds those source objects to the exact
  DealAdmissionManifest, admitted document role or open-world role marker and
  governed deal. The admission manifest may reference only the pre-admission
  source-role variant; after reconciliation, the admitted variant may reference
  that manifest. Byte deduplication therefore never erases receipt, deal or
  admission lineage and no candidate creates an identity cycle.
- `open_world_candidate_occurrence_id` hashes
  `OPEN_WORLD_CANDIDATE_OCCURRENCE/V1`, schema, variant, exact candidate ID and
  payload digest, ImmutableSourceDocument, source occurrence, source-admission
  and canonical-text-occurrence IDs and payload digests, observed party-token
  set and governed source ordinal. `PRE_ADMISSION_SOURCE_ROLE` additionally
  hashes proposed DealIdentityManifest, observed role tokens and
  `NO_DEAL_ADMISSION_YET`; `ADMITTED_SEMANTIC` instead hashes the exact
  DealAdmissionManifest, governed deal and canonical role or
  `OPEN_WORLD_ROLE_UNMAPPED`. Supplying a field from the other variant, omitting
  a required field or using database, model, discovery or insertion order is
  schema-invalid. Creation of the pre-admission variant requires the current
  exact SourceAdmissionPreparationReceipt, but that operational receipt is not
  an occurrence-identity input; the occurrence already binds its immutable
  source admission, and an unrelated later cutoff cannot rekey local semantics.
- Every `PRE_ADMISSION_SOURCE_ROLE` occurrence used by an included
  `IndependentDealDocumentManifest` entry must cross exactly one immutable
  `OpenWorldCandidateAdmissionTransition` after the exact DealAdmissionManifest
  exists. The predecessor must be the sole reconciled effective terminal of its
  pre-admission candidate chain. Its successor is one `ADMITTED_SEMANTIC` occurrence for the same
  candidate, ImmutableSourceDocument, source occurrence, source-admission and
  canonical-text occurrence, observed
  party-token set and governed source ordinal. The successor additionally binds
  the governed deal and the exact admitted role or
  `OPEN_WORLD_ROLE_UNMAPPED`; no other field may change. The closed creation
  order is predecessor occurrence, predecessor evidence closure and primitive
  collection, final `DIRECT_REVIEW` predecessor disposition,
  IndependentDealDocumentManifest, DealAdmissionManifest, successor occurrence,
  mechanically rekeyed successor evidence closure and primitive collection,
  admission transition, then `ADMISSION_CARRY_FORWARD` successor disposition.
  The transition may hash those already complete successor bodies and the
  predecessor disposition body; the later carried disposition hashes the
  transition. No object may reference a later object in that order.
  `open_world_candidate_admission_transition_id` hashes
  `OPEN_WORLD_CANDIDATE_ADMISSION_TRANSITION/V1`, schema, frozen pair, exact
  predecessor occurrence ID and payload digest, its exact current pre-admission
  disposition ID and payload digest, the selecting IndependentDealDocumentManifest
  entry ID and payload digest, exact DealAdmissionManifest ID and payload digest,
  successor occurrence ID and payload digest, exact predecessor and admitted
  OpenWorldEvidenceClosure and OpenWorldPrimitiveCollectionRoot IDs and payload
  digests, and the carried-forward disposition-, evidence- and primitive-body
  digests with fixed empty candidate, source-lineage, evidence,
  primitive, disposition-body and cardinality difference roots. The disposition-
  body digest covers the final disposition value, every disposition-specific
  field, governed reason, legal-semantic review evidence, reviewer eligibility
  and required Ben authority, but excludes occurrence identity and carry-forward
  lineage. It therefore proves semantic equality without creating an identity
  cycle. The admitted evidence closure and every admitted primitive are
  mechanically rekeyed only from predecessor to successor occurrence; their
  examined intervals, spans, values, relationships, ordinals and payload bodies
  must otherwise remain byte-equal. Only those admitted objects may feed impact,
  applicability, serving or exact-detail evidence.
- `OpenWorldCandidateDisposition.disposition_origin` is exactly
  `DIRECT_REVIEW` or `ADMISSION_CARRY_FORWARD`. The latter is mandatory for the
  admitted successor above and hashes the exact transition and predecessor
  disposition in addition to the successor occurrence and byte-identical
  disposition-body digest. It cannot change or reopen the legal decision. Zero
  or multiple transitions, a non-source-role predecessor, a non-admitted
  successor, a changed candidate or source-lineage field, a changed disposition
  body or a directly reviewed replacement masquerading as carry-forward blocks.
  The transition supersedes the pre-admission occurrence for effective semantics:
  the predecessor occurrence and disposition remain audit-only, and the admitted
  occurrence with its carried-forward disposition is the sole effective terminal
  permitted to determine impact, applicability, serving and market eligibility
  under that disposition.
  A `PRE_ADMISSION_SOURCE_ROLE` occurrence and its `DIRECT_REVIEW` disposition
  may support only the document-membership decision. They are excluded from
  SemanticImpactWalkerOutput, SemanticImpactClosure,
  OpenWorldCandidateDispositionManifest, every applicability object, release-
  certified Review data, exact detail, serving and market output. Those objects
  may be built only from the admitted successor and carried disposition after
  the complete transition above.
- Because `candidate_kind` is identity-bearing, resolving an
  `UNRESOLVED_CANDIDATE_KIND` never edits or silently rekeys its candidate. An
  immutable `OpenWorldCandidateKindSupersession` selects exactly one successor
  candidate and successor occurrence with the same source-package hash,
  canonical-text occurrence,
  ordered evidence spans, neutral proposition-or-mechanism digest, observed
  party tokens and governed source ordinal and a newly reviewed non-unresolved
  kind. Its ID hashes both complete candidate IDs and payload digests, both exact
  predecessor and successor occurrence IDs and payload digests, the exact
  kind-only difference and review and authority evidence. The
  successor occurrence must be the same occurrence variant as its predecessor
  and must differ only through its successor candidate reference and derived
  payload digest. Its identity does not hash the later candidate-chain roots or
  terminal proof. The predecessor remains in the offline audit chain, only the
  successor occurrence may enter a final disposition manifest, and zero,
  multiple, payload-changing or cyclic successors block.
- A source-backed correction to evidence spans, neutral proposition body,
  observed party tokens or governed ordinal instead creates a new candidate and
  occurrence and one immutable `OpenWorldCandidateSupersession` of reason
  `SOURCE_BACKED_CORRECTION`. Its ID hashes predecessor and successor candidate
  and occurrence IDs and payload digests, exact changed-field set, Correction and
  passing approval, and proof that unchanged fields remain byte-equal. The
  `OpenWorldCandidateKindSupersession` is the closed `KIND_RESOLUTION`
  specialisation and permits only the candidate-kind field to differ. The
  effective-chain root has exactly one terminal occurrence, preserves every
  predecessor for audit and rejects a fork, merge, cycle or in-place edit.
- `OpenWorldCandidateAuditChainRoot` inventories every candidate, occurrence,
  candidate- or kind-supersession edge and source-role admission-transition edge
  in scope, including all predecessors and every transition-bound pre-admission
  disposition.
  `OpenWorldEffectiveOccurrenceRoot` is an independently rebuilt projection with
  exactly one unsuperseded terminal occurrence per chain.
  `open_world_candidate_audit_chain_root_id` hashes
  `OPEN_WORLD_CANDIDATE_AUDIT_CHAIN/V1`, schema, frozen pair, scope subject,
  complete ordered candidate and occurrence ID-and-payload-digest set, complete
  ordered general-, kind- and admission-transition ID-and-payload-digest sets,
  exact transition-bound historical-disposition set and fixed empty missing-
  member, extra-edge, fork, merge, cycle, orphan and invalid-admission-transition
  roots.
  `open_world_effective_occurrence_root_id` hashes
  `OPEN_WORLD_EFFECTIVE_OCCURRENCE/V1`, schema, the same frozen pair and scope
  subject, an implementation-disjoint traversal's exact ordered chain-root and
  terminal-occurrence ID-and-payload-digest set and fixed empty zero-terminal,
  multiple-terminal, fork, merge, cycle, orphan and non-terminal-selection
  roots. `OpenWorldCandidateChainReconciliation` hashes both roots and payload
  digests, the independently rebuilt member and terminal content digests, exact
  reachability and predecessor-preservation proofs and fixed empty difference,
  payload-changing-kind-edge, invalid-admission-transition, admitted-source-role-
  cardinality, pre-admission-effective-terminal and unresolved roots. For every
  scope selecting a DealAdmissionManifest it proves complete reachability, one
  terminal, no fork, merge, cycle, orphan or payload-changing kind-only edge and
  exactly one valid pre-admission-to-admitted transition for each included
  source-role candidate. Final disposition, review queue, impact walkers,
  applicability, serving and market eligibility partition or select only the
  reconciled effective-terminal root. Scope, release, bundle, import and trace
  carry both roots and the reconciliation, so excluding a predecessor from
  effective semantics never erases its audit lineage.
- `OpenWorldEvidenceClosure` fixes the complete candidate-local examination
  intervals and every required definition, chapeau, proviso, cross-reference,
  incorporated source and other dependency. Closed `LegalPrimitiveDefinition`
  objects permit independently source-backed `OpenWorldPrimitiveObservation`s
  and `OpenWorldPrimitiveRelationship`s. They preserve party and operative
  modality; time and conditions; knowledge and materiality qualifiers;
  exceptions and overrides; definitions and dependencies; precedence; triggers
  and remedies; and units, denominators and raw values. Each records raw and
  canonical value where a governed primitive normaliser applies, explicit claim
  state, unit or basis, exact closure, ordered evidence, endpoints, relationship
  role, derivation version and provenance. A complete ordered collection is
  retained for multiple fees, periods, standards, exceptions, roles or party-
  specific variants. No layer may select first, majority or apparently primary
  value unless one frozen legal rule expressly defines that operation. Familiar
  primitives or their combination never imply that the complete proposition has
  been canonically classified, aliased or made comparable.
- `open_world_evidence_closure_id` hashes
  `OPEN_WORLD_EVIDENCE_CLOSURE/V1`, schema, exact candidate occurrence, complete
  ordered examined interval and evidence-span descriptors, required definition,
  chapeau, proviso, cross-reference and incorporated-source refs, closure rule
  and fixed empty gap, dangling, conflict and unresolved roots. A primitive-
  observation stable key hashes `OPEN_WORLD_PRIMITIVE_OBSERVATION_SLOT/V1`, exact
  occurrence, LegalPrimitiveDefinition key and version, governed primitive-slot
  key, party role or observed-token digest, capacity, evidence-closure ID and
  deterministic governed ordinal. Its immutable payload and content ID also
  hash claim state, raw and canonical value, unit or basis, derivation,
  provenance and ordered evidence. A primitive-relationship key analogously
  hashes `OPEN_WORLD_PRIMITIVE_RELATIONSHIP_SLOT/V1`, occurrence, relationship-
  primitive definition and version, exact endpoint stable keys, relationship
  role and deterministic ordinal; its payload hashes modality, conditions,
  precedence, operation, trigger, remedy and evidence. Exact duplicates collapse
  only under the primitive's governed set rule. A non-identical comparator tie,
  undeclared duplicate or missing ordinal blocks.
- `OpenWorldPrimitiveCollectionRoot` hashes
  `OPEN_WORLD_PRIMITIVE_COLLECTION/V1`, schema, occurrence, evidence closure,
  complete contract-ordered `(primitive_kind, stable_key, immutable_id,
  canonical_payload_digest, governed_ordinal)` set, per-kind counts and fixed
  empty missing, duplicate, conflict and unresolved-multiplicity roots. Final
  disposition, impact, result completeness and serving projection must select
  this root rather than a first, majority or apparently primary primitive.
  Its frozen definition permits at most 2,048 primitive observations and
  relationships and 8 MiB of canonical member payload per candidate occurrence.
  Maximum-plus-one or byte overflow retains the complete source and a typed
  GovernedResidualObservation, blocks only the affected candidate or result and
  prevents candidate sealing; it is never truncated, sampled or treated as an
  empty collection.
- `OpenWorldCandidateDisposition` has exactly one final reviewed value:
  `MAPPED_EXISTING`, `MAPPED_ALIAS`, `ADOPTED_NEW_CANONICAL`,
  `REVIEWED_SOURCE_SPECIFIC` or
  `REJECTED_NON_SUBSTANTIVE_OR_INVALID`. Its ID hashes
  `OPEN_WORLD_CANDIDATE_DISPOSITION/V1`, schema, exact frozen pair, candidate and
  occurrence IDs and payload digests, disposition origin, disposition, every
  disposition-specific field or exact forbidden-field marker, governed reason, immutable legal-
  semantic review disposition, reviewer identity and eligibility proof and
  required Ben approval or the contract-declared
  `NO_BEN_TAXONOMY_DECISION_REQUIRED` marker, plus the exact transition and
  predecessor-disposition references for `ADMISSION_CARRY_FORWARD` or their
  forbidden-field markers for `DIRECT_REVIEW`. Pending, deferred, generic
  unmapped, failed, not examined and a sixth catch-all value are invalid.
  `REJECTED_NON_SUBSTANTIVE_OR_INVALID` additionally requires exactly one
  closed proof: `NO_SUBSTANTIVE_PROPOSITION`, with affirmative legal review that
  the complete evidence closure contains no independently supportable legal
  proposition or primitive; or `PRESERVED_BY_EXACT_CANDIDATE`, naming another
  final candidate whose evidence closure and primitive collection fully cover
  the signal without loss. An invalid model shape, weak confidence or proximity
  to a known concept is never enough. Missing proof, partial coverage or a
  genuinely novel proposition under the rejection branch keeps `W_open` false.
  `OpenWorldCandidateDispositionManifest` partitions every effective terminal
  candidate occurrence from the reconciled `OpenWorldEffectiveOccurrenceRoot`
  exactly once with empty missing, extra, duplicate, conflicting,
  invalid-carry-forward and unresolved roots. A transition-bound pre-admission
  disposition is retained through the audit-chain root but is not a second
  current manifest member. `OpenWorldReviewQueueRoot` independently enumerates current
  effective terminal occurrences lacking one final disposition; scope freeze and
  candidate release require its domain-separated empty root.
- `open_world_candidate_disposition_manifest_id` hashes
  `OPEN_WORLD_CANDIDATE_DISPOSITION_MANIFEST/V1`, schema, frozen pair, exact
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot and
  OpenWorldCandidateChainReconciliation IDs and payload digests, complete
  effective final-disposition
  root after correction supersession, counts by candidate kind and disposition,
  and fixed empty missing, extra, duplicate, conflicting, supersession-fork and
  unresolved roots. `OpenWorldReviewQueueRoot` hashes
  `OPEN_WORLD_REVIEW_QUEUE/V1`, schema, frozen pair, the same complete occurrence
  audit, effective-occurrence and reconciliation roots, exact unresolved
  effective-occurrence tree root and count and its
  reviewed-disposition anti-join proof. Empty and non-empty roots use distinct
  discriminators. A count, null lookup or self-declared worklist cannot prove
  closure.
- `MAPPED_EXISTING` names only exact keys and complete mappings already present
  in the selected frozen bundle. `MAPPED_ALIAS` names an exact governed alias and
  its one existing target. Adding an alias is a bundle change, never a
  source-level decision. `ADOPTED_NEW_CANONICAL` is valid only under a successor
  CanonicalContractBundle that already contains the approved new canonical item
  and every question, relationship, result, metric, unit, role or composition
  rule it requires. It selects that successor bundle and its new
  ContractFreezeAttestation. Adoption and a new alias require eligible Freeze
  Gate legal-semantic review and Ben's immutable taxonomy or codebook approval.
  No disposition mutates the release under which the candidate was discovered.
- A contract-impacting candidate does not need an impossible final disposition
  before the successor contract can exist. While it remains unresolved and
  unpublishable under the predecessor, Freeze Gate may create one
  `ContractAmendmentProposal` from its exact source-backed occurrence, evidence
  closure, primitive root, reconciled `AFFECTS_CANONICAL_CONTRACT` closure,
  proposed neutral semantics and immutable legal-semantic and Ben approvals.
  The proposal has no concept key, disposition, serving or cohort authority.
  The successor CanonicalContractBundle and its ContractFreezeAttestation bind
  the complete approved proposal-set root. Only after that freeze may affected
  spans and transitive dependants be reprocessed under the successor and
  receive `ADOPTED_NEW_CANONICAL` or another final disposition. A proposal
  omitted from the successor, a disposition created before freeze or a
  published unresolved predecessor candidate fails closed. This is the only
  contract-amendment bridge.
- A new canonical item or alias never authorises “reprocess the discovered
  spans” as its complete scope. Bundle compilation first creates a
  pair-independent applicability contract. During candidate preparation, the
  universal identity and execution order is strict: both sealed
  `CorpusReleaseInventoryRootSet`s and their reconciliation close every
  requirement instance, local entry, local slice and exactly one complete
  `ScopeSubjectApplicabilityRoot` for each governed scope subject; disjoint enumerators A and
  B then create their two complete bounded applicability roots; the registered
  independence validator then creates
  `ApplicabilityReexaminationEnumeratorIndependenceAttestation`; the third
  reconciler then creates only `ApplicabilityReexaminationReconciliation`; the
  separately dispatched `TERMINAL_MANIFEST` action then creates only
  `ApplicabilityReexaminationManifest`; bounded projection-entry batches then
  create every `MetricApplicabilityRequirementProjection`; `TERMINAL_SET` then
  creates `MetricApplicabilityRequirementProjectionSet`; and only then may
  `CandidateInputSeal` exist. The dependency graph and frozen definition rules
  derive the universe. The adopter, local producer, extractor, scheduler and
  caller cannot narrow it. No per-deal transaction, pre-scope closure or
  release-input inventory may hash or select a later global applicability root,
  independence proof, reconciliation, manifest, projection or seal.
- `ApplicabilityEligibleMemberKindProducerRegistry` is a deterministic
  generated bundle member. Its ID hashes
  `APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY/V3`, schema,
  `CanonicalBundleInputIdentity`, the complete contract-ordered entries, one
  aggregate scope-subject-root contract and
  fixed empty unknown, duplicate and conflicting-assignment roots. Each entry
  fixes one concrete `universe_member_kind`, schema, stable-key extractor, owner
  class, subject-key schema, local-slice rule, cardinality, sole operation and
  action, complete discriminator set and mechanical discriminator rule, exact
  Entry and Slice physical carriers, receipt policy and the per-kind creation-
  slot and lock authority. The only owner classes and mappings are:
  `SCOPE_OR_SOURCE_ADMISSION -> DEAL_SCOPE_RUN/MATERIALISE_SCOPE` with exactly
  `SINGLE_SUBJECT` or `MULTI_SUBJECT_CORRECTION`, exact
  `SCOPE_APPLICABILITY_ENTRY` and `SCOPE_APPLICABILITY_SLICE` carriers,
  `DEAL_SCOPE_RUN_RECEIPT_BINDS_DISCRIMINATOR`, and the generated scope-
  applicability creation slots; and
  `DEAL_FAMILY -> DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE`, exact
  `FAMILY_APPLICABILITY_ENTRY` and `FAMILY_APPLICABILITY_SLICE` carriers,
  `FAMILY_BUILD_RECEIPT_IS_RECEIPT`, and the generated family-applicability
  creation slots. For the first mapping, `MULTI_SUBJECT_CORRECTION` is derived
  if and only if the exact reconciled `CorrectionApplicabilitySlice` contains
  a membership or source-admission transition that requires fixed-point
  rebuilding, regardless of component cardinality, or the complete atomic
  fixed-point component contains more than one governed subject.
  `SINGLE_SUBJECT` is derived if and only if the complete selected component
  contains exactly one subject and no such membership or source-admission
  transition. The caller, correction, scheduler and writer cannot choose or
  override that discriminator. Both discriminators share the same
  per-kind creation-slot keys and lock authority, so competing single- and multi-
  subject requests for one logical Entry or Slice serialise and cannot create a
  second producer. Separately, the registry's singular aggregate scope-subject-
  root contract fixes the `SCOPE_SUBJECT_APPLICABILITY_ROOT` carrier, root schema
  and stable-key extractor, exactly-one cardinality per governed subject and
  subject-local input tuple, both mechanically derived MATERIALISE_SCOPE
  discriminators, sole aggregate creation slot and lock authority and
  `DEAL_SCOPE_RUN_RECEIPT_BINDS_DISCRIMINATOR` receipt policy. Per-kind entries
  own only their Entry and Slice carriers; none owns or stands in for the
  aggregate root. There is no wildcard, `OTHER`, inferred owner, correction-
  owned, carry-forward-owned, candidate-owned or second producer. The registry
  contains no final bundle fingerprint, ContractFreezeAttestation, frozen pair,
  requirement instance, release or candidate identity.
- For each authored taxonomy delta that requires corpus re-examination, the
  compiler creates one immutable
  `ApplicabilityReexaminationRequirementDefinition`. Its ID hashes
  `APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION/V1`, schema,
  CanonicalBundleInputIdentity, adopted contract-item stable key and version,
  exact predecessor contract-item reference or governed
  `INITIAL_CONTRACT_BASELINE` marker, complete applicability-predicate AST,
  affected-dependency-closure rule, exact registry ID and payload digest and the
  complete permitted registry-entry set. The generated
  `ApplicabilityReexaminationRequirementSetRoot` hashes
  `APPLICABILITY_REEXAMINATION_REQUIREMENT_DEFINITION_SET/V1`, schema, the same
  input identity and registry, the complete contract-ordered `(definition_id,
  canonical_payload_digest)` set, count and fixed empty missing, extra,
  duplicate, conflicting and unresolved roots. Registry, definitions and root
  precede the generated-output manifest, final
  `CANONICAL_CONTRACT_BUNDLE/V3` fingerprint and ContractFreezeAttestation.
  Local extraction, review and correction code cannot create, edit or infer a
  definition.
- After freeze, `CORPUS_SCOPE_FREEZE/OPEN_GENERATION` is the sole producer of
  exactly one `ApplicabilityReexaminationRequirement` instance for each member
  of that definition-set root. Its ID hashes
  `APPLICABILITY_REEXAMINATION_REQUIREMENT/V2`, schema, exact frozen pair,
  definition ID and payload digest, definition-set-root ID and payload digest
  and exact registry ID and payload digest. Its only carrier is
  `SCOPE_RELEASE_INPUT(APPLICABILITY_REEXAMINATION_REQUIREMENT)`, its writer
  disposition is exactly `RELEASE_INPUT`, and the successful
  `SCOPE_GENERATION_OPENED` transition receipt is its sole receipt and closes
  the definition-to-instance bijection with fixed empty missing, extra,
  duplicate and conflicting roots. Exact replay selects the same instances.
  Every other operation, action, carrier or direct insert is `PROHIBITED`.
  Later local producers may select an instance but cannot originate it.
- Each `ApplicabilityReexaminationEntry` key hashes
  `APPLICABILITY_REEXAMINATION_ENTRY/V2`, exact frozen pair, exact requirement
  instance ID and payload digest, exact producer-registry entry ID and payload
  digest, typed eligible-member key and governed ordinal. Its payload hashes the
  registry-declared producer action and, for a scope-owned member, its
  mechanically derived `SINGLE_SUBJECT` or `MULTI_SUBJECT_CORRECTION`
  discriminator, `EXAMINED` or `NOT_EXAMINED`, selected
  source, scope, claim, relationship, result, observation and dependency
  evidence, derivation version and reason. Each
  `ApplicabilityReexaminationSlice` ID hashes
  `APPLICABILITY_REEXAMINATION_SLICE/V2`, exact frozen pair, exact requirement
  instance, exact registry-entry set and payload digests, registry-declared
  producer, exact deal-family or scope/source-admission subject, complete
  ordered entry key and payload-digest set and fixed empty wrong-pair,
  wrong-definition, wrong-kind, wrong-producer, local-missing, duplicate,
  conflict and unresolved roots. No value or processing order supplies an
  ordinal. Only `DEAL_SCOPE_RUN/MATERIALISE_SCOPE` under the mechanically
  derived scope discriminator may originate a scope-owned Entry or Slice, and
  only `DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE` may originate a family-
  owned Entry or Slice. `CORRECTION_APPLY`, carry-forward and every candidate-
  preparation or freeze action may select a byte-identical existing local
  object when its contract requires it but cannot originate one. An
  unregistered kind, wrong owner, mixed-producer slice or local object from any
  other action performs zero canonical DML.
- `ApplicabilityReexaminationReconciliation` is the named candidate-wide
  control produced only by
  `CANDIDATE_RELEASE_FREEZE/PREPARE_INPUT_BATCH/APPLICABILITY_REEXAMINATION/TERMINAL_RECONCILIATION`.
  Its ID hashes `APPLICABILITY_REEXAMINATION_RECONCILIATION/V1`, schema,
  successor frozen pair, candidate generation and opening CandidateInputHead,
  exact terminal-PASS CorpusRelease input independence attestation, both sealed
  CorpusReleaseInventoryRootSet IDs and payload digests and exact
  CorpusReleaseInventoryReconciliation, complete requirement-definition-set
  root and exact post-freeze requirement-instance root selected by the sealed
  inputs, both
  independently generated eligible-universe and selected-entry root IDs and
  payload digests, exact
  ApplicabilityReexaminationEnumeratorIndependenceAttestation, contract-ordered
  per-requirement content digests and counts, dependency-closure roots and fixed
  empty missing, extra, duplicate, conflict, stale-contract and unresolved
  difference roots. It is carried only as
  `NAMED_CONTROL(APPLICABILITY_REEXAMINATION)`, has
  `TERMINAL_RECONCILIATION_IS_RECEIPT`, no outbox or serving grant and precedes
  the manifest. This action creates no manifest, projection or seal. Direct
  insertion, a self-reference, a manifest-generated reconciliation or any
  other action/carrier pairing is prohibited.
- `applicability_reexamination_manifest_id` hashes
  `APPLICABILITY_REEXAMINATION_MANIFEST/V1`, schema, successor frozen pair,
  exact candidate generation and opening CandidateInputHead tuple, exact
  terminal-PASS CorpusRelease input independence attestation, both sealed
  CorpusReleaseInventoryRootSet IDs and payload digests and exact
  CorpusReleaseInventoryReconciliation, complete ordered requirement-
  definition-set root, exact post-freeze requirement-instance root and count,
  both independent universe- and-entry root IDs and payload digests
  for that complete set,
  their ApplicabilityReexaminationEnumeratorIndependenceAttestation, exact
  ApplicabilityReexaminationReconciliation ID and payload digest, exact per-
  requirement and total eligible, examined and
  not-examined counts and terminal states,
  complete dependency-closure roots and fixed empty missing, extra, duplicate,
  conflicting, stale-contract and unresolved roots. It cannot hash the later
  CandidateInputSeal itself. Its terminal state is `COMPLETE_EXAMINED` only when
  every eligible member is `EXAMINED`, otherwise
  `COMPLETE_WITH_NOT_EXAMINED`; both require a complete reconciled universe.
  The overall state is audit summary only. `TERMINAL_MANIFEST` is the sole
  producer action and carrier for this manifest, selects the already committed
  reconciliation as its receipt-bearing predecessor and cannot create or amend
  that reconciliation. The manifest also carries one closed terminal state for
  every requirement ID. ResultDefinition and MetricDefinition
  compile only the frozen, requirement-ID-independent impact predicates and
  dependency-closure rules needed to decide intersection. They cannot name or
  hash a successor requirement, applicability root, manifest or projection.
  Observation eligibility requires
  `COMPLETE_EXAMINED` only for those exact per-requirement states. A
  `NOT_EXAMINED` member under an unrelated requirement cannot block the slot,
  while an omitted intersecting requirement or caller-supplied empty set blocks
  it. The manifest-wide summary is never used as a global observation gate.
  A new alias remaps and recertifies every affected instance. A new attribute or
  question re-examines every eligible instance of its concept or family. A new
  relationship or composition rule re-examines every result whose dependency
  closure may require it. A new concept re-examines every document in its
  governed applicability universe. A new party or document-role rule rebuilds
  source admission and every affected downstream deal. A new unit or comparison
  basis renormalises every potentially compatible observation.
- `metric_slot_definition_basis_key` hashes
  `MARKET_METRIC_SLOT_DEFINITION_BASIS/V1`, schema, exact MetricDefinition ID and
  payload digest, stable canonical owner occurrence type and ID,
  occurrence-independent member and scope-interval-set keys, governed party,
  value and capacity and governed slot ordinal. It contains no requirement,
  applicability-manifest, candidate-generation, CorpusRelease or projection ID.
  Only after the sealed release-input roots, global applicability roots,
  ApplicabilityReexaminationReconciliation and
  ApplicabilityReexaminationManifest exist does
  `CANDIDATE_RELEASE_FREEZE/PREPARE_INPUT_BATCH` with discriminator
  `METRIC_APPLICABILITY_REQUIREMENT_PROJECTION/{ENTRY_BATCH|TERMINAL_SET}` build
  the candidate-release-scoped mapping. One
  `MetricApplicabilityRequirementProjection` maps one exact canonical metric-
  slot definition-basis key to the complete contract-ordered intersecting
  ApplicabilityReexaminationRequirement ID and payload-digest set, its impact-
  intersection proof set and either its exact non-empty set digest or the
  governed `NO_INTERSECTING_REQUIREMENT` marker. Its ID hashes
  `METRIC_APPLICABILITY_REQUIREMENT_PROJECTION/V1`, schema, frozen pair,
  candidate generation and opening CandidateInputHead, both sealed release-
  input root-set IDs and payload digests, CorpusReleaseInventoryReconciliation,
  exact ApplicabilityReexaminationManifest ID and payload digest, basis key and
  that complete mapping payload.
- `MetricApplicabilityRequirementProjectionSet` hashes
  `METRIC_APPLICABILITY_REQUIREMENT_PROJECTION_SET/V1`, schema, the same release-
  input and applicability context, the complete canonical metric-slot-
  definition-basis root, complete ordered projection-entry root and
  `metric_applicability_requirement_projection_set_digest`, counts and fixed
  empty missing, extra, duplicate, conflicting-intersection, source-specific-
  owner and unresolved roots. The exact producer discriminators above and sole
  physical carrier
  `NAMED_CONTROL(METRIC_APPLICABILITY_REQUIREMENT_PROJECTION)` are generated in
  OperationActionRegistry, CanonicalPhysicalCarrierRegistry and
  CanonicalWriterDispositionRegistry. Bounded ENTRY_BATCH writes are receipt-
  bound; TERMINAL_SET is the terminal receipt. Neither carrier has an outbox,
  serving grant or direct DML path. CandidateInputSeal selects the terminal set
  ID, payload digest and set digest only after the manifest and every projection
  entry have committed. A missing, extra,
  caller-authored or bundle-embedded mapping blocks sealing.
- An earlier deal or instance not examined under the expanded contract is
  explicitly `NOT_EXAMINED`, never `ABSENT`. Until the complete
  ApplicabilityReexaminationManifest proves every eligible member for the exact
  intersecting requirements examined under that version, the affected result is
  `INCOMPLETE_NOVEL_SEMANTIC`, its comparability is `NOT_CERTIFIED`, and no
  prevalence, denominator, market range, absence statistic, aggregate or cache
  entry for that item may publish. Unaffected contract items and results outside
  the exact impact closure remain independently certifiable. Historical corpus
  releases and their original taxonomy, examination states and cohort membership
  remain immutable.
- `REVIEWED_SOURCE_SPECIFIC` means the item is real, source-backed and
  publishable in Review, but has no governed cross-deal cohort in that
  CorpusRelease. It requires a reviewed source-specific display label, exact
  evidence closure and complete publishable primitive set. It also requires one
  immutable `ReviewedSourceSpecificPublicationDecision`. That decision binds the
  exact candidate, disposition and primitive-collection root and selects exactly
  one source-backed primitive-observation occurrence as the display claim. The
  selected occurrence must be a member of that root, must have a publishable
  explicit claim state of `PRESENT`, and supplies the row's sole
  `source_claim_state`. `ABSENT`, `NOT_APPLICABLE`, `NOT_EXAMINED` and `FAILED`
  are prohibited for this variant; absence and applicability require a governed
  canonical question, while the latter two remain review-only states.
  Every other primitive remains in the complete ordered collection and child
  detail but cannot silently replace or aggregate the selected display claim.
  If no one primitive fairly represents the proposition, review must create a
  source-backed proposition claim with its own evidence and primitive linkage or
  leave the candidate unresolved; first, majority, most favourable and
  implementation-order selection are prohibited. The authoritative writer
  persists that decision transactionally with the disposition and propagates
  its exact ID and payload digest through candidate output, manifest, bundle,
  production import, traceability and SharedServingRow. It is never rendered
  as absence, failure, not examined, an empty canonical result or generic “No
  market data”. `REJECTED_NON_SUBSTANTIVE_OR_INVALID` retains the candidate,
  evidence, primitives, reason and review proof for audit but creates no Review
  serving row, canonical question, claim, result, metric or cohort member.
- Every candidate's reconciled SemanticImpactClosure carries exactly one
  independently validated `OpenWorldSemanticImpactDisposition` field:
  `ISOLATED_SOURCE_SPECIFIC`,
  `AFFECTS_CANONICAL_RESULT`, `AFFECTS_CORPUS_SCOPE` or
  `AFFECTS_CANONICAL_CONTRACT`. Two implementation-disjoint dependency walkers
  derive a `SemanticImpactClosure` from the frozen dependency and composition
  graphs, complete PotentialDependencyUniverse, source-admission and open-world
  source-role edges, every source-role admission transition, its effective
  admitted occurrence and carried-forward disposition, every candidate evidence, definition, cross-reference and
  primitive relationship, and complete source scope without accepting an
  extractor- or candidate-supplied affected set. The frozen graph is a floor,
  never proof that a novel edge does not exist. A third reconciler requires
  exact affected-node and transitive-edge equality and assigns the highest
  applicable impact tier. The closure identifies every affected subject,
  question, relationship, result component, result, family, source admission,
  observation, metric, cohort and contract object. The candidate, extractor,
  reviewer and similarity system cannot narrow that closure. If either walker
  cannot bound the closure or the walkers disagree, `ISOLATED_SOURCE_SPECIFIC`
  is prohibited and the candidate widens to the applicable result, corpus-scope
  or contract blocking tier until reconciliation succeeds.
- Each `SemanticImpactWalkerOutput` hashes
  `OPEN_WORLD_SEMANTIC_IMPACT_WALKER/V1`, schema, frozen pair, exact candidate
  occurrence, its exact effective `OpenWorldCandidateDisposition` ID and payload
  digest and disposition-specific mapped, alias, adopted, source-specific or
  rejected target-or-forbidden-field marker, evidence closure and
  OpenWorldPrimitiveCollectionRoot, proposed
  admission and PotentialDependencyUniverse, walker role, fixed-fanout affected-
  node and traversed-edge roots, counts, executable, configuration and complete
  transitive-dependency graph and terminal state. A
  `SemanticImpactEnumeratorIndependenceAttestation` binds the two roles and
  proves empty prohibited implementation, query, view, cache, intermediate and
  output intersections. `semantic_impact_closure_id` hashes
  `OPEN_WORLD_SEMANTIC_IMPACT_CLOSURE/V1`, schema, frozen pair, candidate
  occurrence, the same exact effective disposition ID, payload digest and
  disposition-specific target-or-forbidden-field marker, both walker outputs
  and payload digests, independence attestation,
  equal affected-node and edge content digests, exact
  OpenWorldSemanticImpactDisposition value, third-reconciler evidence and fixed
  empty missing, extra, conflict, unbounded and walker-difference roots. Only a
  terminal reconciled closure supplies the impact field used downstream.
- `REVIEWED_SOURCE_SPECIFIC` is not an escape hatch. It may pair with
  `ISOLATED_SOURCE_SPECIFIC` only when the reconciled SemanticImpactClosure proves
  no path to a known result, scope or contract object. If a novel exception,
  relationship, party, attribute, document or basis may change a known result,
  the affected result receives `INCOMPLETE_NOVEL_SEMANTIC` or `BLOCKED` according
  to its state contract and cannot be represented as complete merely because its
  familiar components were extracted. Unaffected results outside the exact
  transitive closure remain complete and render normally.
- A novel item is never a page-level failure boundary, but publication authority
  depends on its terminal state. `INCOMPLETE_NOVEL_SEMANTIC` is final, reviewed
  and release-certifiable and may produce an `INCOMPLETE_CANONICAL_RESULT`.
  `BLOCKED` is unresolved or invalid and may never enter a DealSnapshot selected
  by a CorpusRelease, CandidateOutputSeal, SharedServingRow, release bundle,
  production import, cache, Corpus Context, Compare or Query. Authenticated
  candidate Review and Admin may instead render a non-persisted, non-serving
  `BLOCKED_RESULT_PREVIEW` generated under BlockedResultPreviewDefinition beside every independently
  valid candidate sibling. The production Review continues to resolve the exact
  unchanged prior active release. A blocked candidate, renderer failure, missing
  market observation or unfamiliar key cannot change the active pointer or
  serving namespace and cannot blank, crash or suppress its sibling rows or
  provision navigation.
- `OpenWorldSimilarityProposal` is an optional offline review aid. It may record
  versioned embeddings or features, scores and proposed review groups, aliases or
  new canonical items, but it is neither a disposition nor a semantic input. It
  may never assign a mapping, merge candidates, establish legal equivalence,
  create a key or establish market comparability. Candidate, impact and
  disposition identities exclude it; serving and query roles have no read or
  resolver path to it.
- Every mapping-manifest candidate appears in exactly one disjoint partition:
  `MAPPED` with its complete non-empty edge set,
  `UNMAPPED_LEGAL_DIMENSION` with its exact OpenWorldSemanticCandidate
  assignment, or `BLOCKING_UNRESOLVED`. The one reconciled effective-terminal
  occurrence for every assigned candidate chain then has exactly one of the five
  reviewed dispositions and one reconciled impact disposition; historical
  predecessors remain audit-only. Mapped and adopted candidates must resolve to complete frozen
  question, relationship, composition, role, unit and scope entries as their kind
  requires. Reviewed-source-specific and rejected candidates remain a separate
  reviewed partition and never enter a canonical question or market cohort. An
  unmapped signal cannot become `INAPPLICABLE`, `NO_BASE_SUBJECT`,
  `NOT_LEGALLY_RELEVANT`, absence or silent non-exposure.
- `W_open = PASS` is the shorthand terminal proof that the complete discovery
  signal set has that exact mapped, open-world or blocking partition; every
  effective-terminal non-blocking OpenWorldCandidateOccurrence has exactly one
  final reviewed disposition and one reconciled SemanticImpactClosure; effective-terminal
  candidate-kind, disposition, impact, source-role and multiplicity unresolved
  roots are empty;
  and mapped and adopted entries resolve only to the selected frozen bundle.
  It also selects the complete GovernedResidualUniverseManifest,
  GovernedResidualDispositionManifest, every reconciled
  GovernedResidualImpactClosure and the empty GovernedResidualReviewQueueRoot;
  no residual may rely solely on candidate-occurrence totality. `W_open = PASS`
  does not mean the source-specific partition or residual-observation set is
  empty.
- The IndependentSemanticQuestionUniverseManifest additionally hashes the exact
  dimension-discovery and mapping manifests, complete open-world candidate,
  occurrence, primitive, closure, disposition, impact and SemanticImpactClosure
  manifests and their total partition. The OrdinarySemanticQuestionUniverseManifest
  cannot read or hash either independent payload. Their neutral question
  projections reconcile only after every mapped or adopted disposition resolves
  to the frozen question universe, every source-specific or rejected disposition
  is proven disjoint from it and OpenWorldReviewQueueRoot is empty.
- After validating the complete independent and ordinary question-universe
  SemanticStageOutputSetRoots and the separate complete reviewed open-world
  partition proof, the
  registered THIRD_RECONCILER input envelope hashes the canonical
  `Q_independent` and `Q_ordinary` comparison bodies, complete key universe,
  comparison schema, semantic-stage-contract digest and bounds. The inner
  reconciliation semantic ID hashes that envelope ID, exact differences and
  terminal state. The governed `semantic_question_universe_reconciliation_id`
  and attestation bind schema, frozen pair, exact
  IndependentLegalDimensionDiscoveryManifest and
  IndependentLegalDimensionMappingManifest IDs,
  OpenWorldCandidateDispositionManifest, reconciled SemanticImpactClosure set and
  empty OpenWorldReviewQueueRoot and their complete reviewed-partition proof,
  exact two universe-manifest and SemanticStageOutputSetRoot IDs
  and third-reconciler execution and review evidence. It requires exact
  `Q_independent = Q_ordinary`, zero duplicate logical keys, zero unresolved
  effective-terminal dimensions and exact disjoint mapped, reviewed-source-specific and rejected
  partitions in the IndependentLegalDimensionMappingManifest and
  OpenWorldCandidateDispositionManifest, with exactly one reconciled impact
  disposition per effective-terminal OpenWorldCandidateOccurrence and none for
  a superseded predecessor.
  It cannot create aliases, mappings, cardinality or
  questions. The dispatcher validates its governed pass outside both workers.
  Each applicability evaluator receives only a non-inspectable pass capability
  and the exact permitted NeutralStageProjection bytes and content digest in its
  semantic input envelope, never the reconciliation ID, terminal-state metadata
  or other path's payload.
- Before either path may emit a question slot, it creates a total applicability
  map over every reconciled `(complete base-subject tuple, semantic question)`
  pair. A
  `ChallengeQuestionDisposition` and separately implemented
  `OrdinaryQuestionDisposition` each have exactly one state: `APPLICABLE`,
  `INAPPLICABLE` or `BLOCKING_UNRESOLVED`. Each ID hashes its schema version,
  frozen contract pair, PotentialDependencyUniverse, complete base-subject
  tuple, canonical question key, exact path-specific question-universe entry and
  `semantic_question_universe_reconciliation_id`,
  state, exact source-evidence interval set, governed applicability reason and
  rule key, evaluator executable and configuration digests, eligible
  independent-review evidence ID and deterministic ordinal. The two paths may
  share only reconciled keys and primitive schemas, not question prose,
  evaluator code, intermediate output, selected evidence or dispositions.
- `INAPPLICABLE` is permitted only when the path's complete independently
  authored and reconciled applicability predicate AST, evaluated by that path's
  disjoint implementation against identified source-backed subject traits or the exact
  contract-declared assessment subject, proves that the question cannot govern
  that subject. Phrase absence, failure to find a witness, an extractor or
  candidate result, a proposed `ABSENT` state, a discovery disposition or lack
  of a base provision span can never make a question inapplicable. An unresolved
  predicate input is `BLOCKING_UNRESOLVED`, never `INAPPLICABLE`. Every
  `APPLICABLE` pair emits at least one `ChallengeQuestionSlot` or
  `OrdinaryQuestionSlot`, as applicable, and exactly the contract-governed
  repeatable cardinality; zero, duplicate or unexplained extra slots block.
  Each slot is keyed by the complete base-subject tuple, claim or effect
  question kind, exact path-specific semantic-question payload digest,
  dependency-rule or effect-slot
  key and governed repeatable ordinal. Its domain-separated ID additionally
  hashes its exact parent ChallengeQuestionDisposition or
  OrdinaryQuestionDisposition ID, respectively, so a changed evaluator,
  configuration or review input propagates even when the semantic comparison
  projection remains identical. Possible but unresolved base subjects,
  definitions, parties, applicability inputs or slots are blocking, not
  omissions. The logical cross-product and its complete disposition projection
  may be stored as canonical sorted columnar or rule-run artefacts and streamed
  by offline validators; it need not become one relational row per pair and is
  never expanded on a serving request.
- The preclassification candidate key hashes the exact raw-cue interval set,
  structural role, candidate kind and reviewed source-backed cue code while
  excluding concept, party, model output and insertion order. Challenger and
  ordinary discovery implement the same contract-defined source-only key schema
  separately and cannot read each other's keys. The ordinal follows the compiled
  source comparator plus raw-cue digest. Non-identical candidates still tied on
  the complete comparator are quarantined. Two coexisting objects on one anchor
  therefore remain distinct before either path classifies them.
- A source-occurrence or deal assessment question still partitions every
  admitted atom in its governed document or deal scope and independently derives
  every dependency and effect. Having no base provision span is a valid subject
  variant, not permission to skip the question or manufacture an `ABSENT` span.
- At this global layer every admitted atom byte is partitioned exactly once as
  `BASE_SUBJECT_TEXT`, `DEFINITION_TEXT`, `NO_BASE_SUBJECT` or
  `BLOCKING_UNRESOLVED`. `NO_BASE_SUBJECT` needs an exact interval, governed
  reason and eligible independent review evidence. Overlapping base subjects and
  definitions remain separate candidates while the underlying byte has one
  coverage disposition plus an ordered candidate-reference set. Canonical
  interval-run compression is permitted, but a gap, duplicate or unexplained
  atom blocks reconciliation.
- The global layer separately dispositions every source-excluded or
  conversion-loss interval before producing `B_base` or `B_slot`. Any possible
  provision, definition, component, party or capacity, or claim or effect
  question cue, and any interval whose relevance cannot be determined, creates
  `BLOCKING_UNRESOLVED`. Excluded or lost material never becomes examined text or
  a fabricated subject; it must be reacquired, readmitted or remain blocking.
  A prior source-exclusion approval cannot make the independent and ordinary
  base inventories agree vacuously.
- Ordinary discovery and contract expansion separately produce `O_base`,
  `Q_ordinary`, the total `O_question_state` projection and `O_slot`; the
  challenger produces `B_base`, `Q_independent`, the total
  `B_question_state` projection and `B_slot`. The question
  projections compare the complete subject-question key, semantic state,
  source evidence and governed reason, while deliberately excluding each
  implementation's executable digest and record ID. `B_slot` and `O_slot` are
  derived only from their reconciled `APPLICABLE` rows. Before per-slot scope
  compilation, third reconcilers require `B_base = O_base`,
  `Q_independent = Q_ordinary` with `W_open = PASS`,
  `B_question_state = O_question_state` and
  `B_slot = O_slot`, keyed field by
  field with empty differences in both directions. It projects ordinary source
  occurrence IDs back to immutable coordinates for comparison and compares
  assessment variants by their contract-declared occurrence or deal identity,
  never fabricated coordinates. A missing standalone provision, definition,
  party attribution, assessment subject or expected claim or effect question
  therefore cannot disappear from both ordinary discovery and the later scope
  universe. Only reconciled applicable question slots and base subjects proceed
  to the per-slot partition below.
- For each such slot the challenger reads only its exact independent
  semantic-question payload needed to state the legal question. It never reads
  the corresponding ordinary ClaimDefinition, RelationshipDefinition or
  RelationshipEffectSchema prose. It also receives the exact SourceAdmissionManifest
  excluded-interval and conversion-loss inventories solely to challenge whether
  excluded or undecodable source might affect that question. It independently derives party, capacity,
  temporal, conditional, precedence, operation, target and evidence semantics
  from the canonical text. It cannot read or import semantic-discovery
  classifications or dispositions, ClaimScopeDefinition traversal output,
  defined-term-use or cross-reference candidates, dependency expectations,
  closures, relationship-resolver output, candidate revisions, serving rows or
  expected values generated by any of those paths. The two implementations may
  share only the exact CanonicalTextOccurrence after its independent
  CanonicalTextVerificationManifest passes, immutable source-byte retrieval and
  RFC 8785 canonical serialisation. They share no decoder, renderer, OCR,
  source-map or semantic implementation. Build-time dependency tests enforce
  that firewall.
- For each slot, the challenger partitions the complete admitted byte range of
  every PotentialDependencyUniverse atom into non-overlapping coverage cells in
  exactly one of `BASE_EXAMINATION`, `REQUIRED_DEPENDENCY`, `REQUIRED_EFFECT`,
  `NOT_LEGALLY_RELEVANT` or `BLOCKING_UNRESOLVED`. Cells cover every atom byte
  exactly once; contiguous cells may be grouped only by retaining their exact
  ordered atom-and-interval set, slot and reason. A generic discovery label such
  as `non-substantive` cannot satisfy this claim-specific partition.
  The logical partition is stored as canonical interval runs and digest-listed
  entry sets, not one database row per byte or a serving-time slot-by-byte
  Cartesian product. Offline validators stream and compare those bounded files.
  `NOT_LEGALLY_RELEVANT` requires a governed slot-specific reason, exact source
  intervals and eligible independent-semantic-review evidence.
  Source-excluded bytes do not become examined partition cells. Any excluded or
  conversion-loss interval with a possible relevant cue, or whose relevance
  cannot be determined, creates `BLOCKING_UNRESOLVED`; its prior approval cannot
  convert it into non-relevance or examined evidence.
  `BLOCKING_UNRESOLVED` is mandatory when a possible endpoint, party, scope or
  operation cannot be resolved; the challenger never fabricates an occurrence
  or endpoint ID.
- Each required challenge entry independently records source coordinates,
  candidate and relationship kind, exact independent question payload digest
  and reconciled implementation-neutral relationship and effect keys,
  dependency-rule or effect-slot key,
  build phase, direction, occurrence-independent endpoint
  roles and target-selection set, party and capacity, conditions, temporal
  scope, precedence and conflict treatment, legal operation, raw-scope
  expansion, evidence intervals and the accepted terminal state and proof rules
  when it is a claim dependency. For an effect slot it also creates and selects
  the complete independent RelationshipEffectConstraint and every exact field
  constraint described in Section 4. Its ID hashes schema version, frozen contract
  pair, PotentialDependencyUniverse and DealAdmissionManifest IDs, base-subject
  tuple, exact ChallengeQuestionDisposition and ChallengeQuestionSlot IDs,
  expected slot key, canonical-text and atom IDs, exact coverage cells,
  candidate kind, raw-cue digest, the complete independently derived semantic
  tuple, challenger executable and configuration digests and deterministic
  ordinal. Its disposition ID additionally hashes the exact state, governed
  reason or required payload and independent review-evidence ID.
- `independent_semantic_challenge_manifest_id` hashes its schema version, frozen
  contract pair, PotentialDependencyUniverse ID, complete ordered
  ChallengeBaseSubject, exact IndependentLegalDimensionDiscoveryManifest,
  IndependentLegalDimensionMappingManifest and
  IndependentSemanticQuestionUniverseManifest,
  complete ordered ChallengeQuestionDisposition and ChallengeQuestionSlot
  inventories, ordered
  SourceAdmissionManifest and global and per-slot exclusion-challenge disposition
  IDs, every ordered per-slot challenge-entry, independent
  RelationshipEffectConstraint and disposition ID, the complete global and per-slot
  atom-to-cell partition-proof digests, challenger executable and configuration
  digests and independent review disposition. It contains no ClaimRevision,
  RelationshipRevision or serving object. It is build and certification
  evidence only, never a second source of canonical or serving truth.
- After base-subject, question-disposition and question-slot reconciliation, the
  ordinary expectation compiler reads the frozen contract,
  admitted source structure, reviewed definition and legal-mechanism discovery,
  exact defined-term-use and cross-reference candidates, source and deal
  admission manifests and pre-approved exclusions. It cannot read the challenge
  manifest. It creates one `RelationshipSemanticExpectation` for every expected
  relationship-effect slot, including each relationship capable of discharging
  claim scope. Its ID hashes the exact RelationshipDefinition and
  RelationshipEffectSchema object digests, base-subject tuple,
  exact OrdinaryQuestionDisposition and OrdinaryQuestionSlot IDs,
  expected-question-slot and effect-slot keys, build phase,
  direction, occurrence-independent source and target endpoint keys and roles,
  party and capacity, temporal scope, conditionality, precedence and conflict
  constraints, permitted legal operation, affected-target selection and
  cardinality, raw-scope expansion, exact PotentialDependencyUniverse ID,
  supporting atom IDs and evidence intervals, its complete ordinary
  RelationshipEffectConstraint, the compiled total comparator and ordinal and
  ordered applicable CorrectionApplication IDs.
  For a claim-like endpoint the key is the occurrence-independent subject tuple
  plus expected-claim-slot key, never a ClaimOccurrence, ClaimRevision, closure
  or resolver-selected endpoint. This expectation is frozen scope data, not a
  canonical assertion that the relationship is present.
- A `ClaimScopeDependencyExpectation` references exactly one
  RelationshipSemanticExpectation and adds only its governed subject tuple,
  expected-claim-slot key, exact ClaimDefinition and ClaimScopeDefinition object
  digests, dependency-rule slot, accepted terminal relationship states and
  state-specific proof and discharge requirements. Its ID hashes those fields,
  the exact relationship-semantic-expectation ID, deterministic ordinal and
  ordered applicable CorrectionApplication IDs. It
  does not copy independently mutable endpoint or effect semantics. The ordinary
  compiler creates one for every definition, governing chapeau, proviso,
  exception, cross-reference, incorporated schedule or document, applicability
  rule or other object required to determine the proposition. It never reads a
  candidate claim, candidate relationship state or serving row.
- Let `C` be the complete ordered global, applicability and per-slot challenge
  disposition map. For neutral key `k` and accepted terminal state `s`, `R(k,s)`
  is the independent path's complete state branch of its
  RelationshipEffectConstraint and `E(k,s)` is the ordinary compiler's
  independently created complete state branch. The key is
  `(base_subject_tuple, semantic_question_key, expected_question_slot_key,
  dependency_or_effect_slot_key, candidate_kind, relationship_definition_key,
  relationship_effect_schema_key, build_phase,
  governed_repeatable_ordinal)`. It contains no ordinary object digest,
  executable identity, review identity, occurrence, revision or candidate
  value. Duplicate non-repeatable keys fail, and values cannot be reassigned
  between parties, two definition uses or superficially similar slots.
- Before scope freeze, a third reconciler requires total, gap-free and
  duplicate-free question maps, `B_base = O_base`,
  `Q_independent = Q_ordinary` with `W_open = PASS`,
  `B_question_state = O_question_state`, `B_slot = O_slot`, complete `C`, zero
  unresolved fields and exact field-by-field `R(k,s) = E(k,s)` for every key and
  accepted state. It compares every normative field, every
  RelationshipEffectFieldUniverse member and every source-specific expected
  effect value or state-specific no-effect rule. A schema digest, object digest,
  label, count or shared payload digest cannot substitute. The
  independent constraint cannot read or hash an ordinary RelationshipDefinition
  or RelationshipEffectSchema object digest; those digests remain identity
  inputs to ordinary expectations and their dependants only.
- Before creating the relationship-semantic reconciler envelope, the dispatcher
  validates the exact independent and ordinary
  RelationshipEffectConstraintSetRoot IDs, registry-declared cardinalities,
  state-by-field totality proofs and empty missing, extra and duplicate sets.
  The registered `THIRD_RECONCILER` input envelope for relationship semantics
  then hashes the neutral RelationshipEffectFieldUniverse projection, exact
  independent and ordinary implementation-neutral constraint comparison bodies,
  the complete sorted `(k, accepted_state, field_key)` universe, registered
  comparison schema and semantic-stage-contract digest and bounds. The inner
  `relationship_semantic_reconciliation_semantic_id` hashes schema, that exact
  input-envelope ID, empty key, state and field differences in both directions
  and terminal equality. Its outer governed
  `relationship_semantic_reconciliation_id` hashes that semantic ID and
  NonSemanticPayloadAttestation, which alone binds the frozen pair, governed
  constraint semantic and governed IDs, exact two
  RelationshipEffectConstraintSetRoot IDs and their completeness proofs, exact
  path payload and attestation IDs,
  third reconciler executable and configuration and review
  evidence. The reconciler may compare or reject
  but cannot decorate `R` with an ordinary digest, select an ordinary object,
  repair a field, create a mapping or choose a legal answer. It projects every
  ordinary endpoint back to immutable source coordinates; zero or multiple
  endpoint mappings block.
  Both projections are partitioned by declared build phase, expected slot and
  accepted terminal state. For a closure `c`, `R_pre(c)` and `E_pre(c)` mean only its
  `PRE_CLAIM_SCOPE` dependency slots. `R` and `E` without a suffix mean the full
  pre-claim and post-claim expected relationship set.
- A `ClaimScopeClosure` is the immutable pre-extraction compilation of one
  governed subject, expected claim slot and ClaimScopeDefinition. Its ID hashes
  schema version, frozen contract pair, governed subject tuple,
  ClaimDefinition and ClaimScopeDefinition keys and versions,
  DealAdmissionManifest and ordered SourceAdmissionManifest IDs, ordered base
  semantic occurrence IDs, PotentialDependencyUniverse and
  IndependentSemanticChallengeManifest,
  IndependentLegalDimensionDiscoveryManifest and
  IndependentLegalDimensionMappingManifest IDs, exact relevant
  OpenWorldSemanticCandidate, occurrence, evidence-closure,
  OpenWorldCandidateDispositionManifest, the exact
  OpenWorldSemanticImpactDisposition value inside the reconciled
  SemanticImpactClosure, and that closure's ID and payload digest, exact independent and ordinary
  IndependentSemanticQuestionUniverseManifest and
  OrdinarySemanticQuestionUniverseManifest IDs and their exact
  SemanticQuestionUniverseReconciliation ID, ordered relevant challenge
  and ordinary question-disposition IDs, ordered relevant challenge and ordinary
  question-slot IDs, ordered per-slot challenge-disposition IDs, ordered
  RelationshipSemanticExpectation and
  ClaimScopeDependencyExpectation IDs, ordered relevant independent and ordinary
  RelationshipEffectConstraint IDs and exact
  relationship-semantic-reconciliation IDs, the exact `B_base = O_base`,
  `Q_independent = Q_ordinary` with `W_open = PASS`,
  `B_question_state = O_question_state`,
  `B_slot = O_slot` and `R = E`
  reconciliation digests,
  complete required-examination interval set, ordered approved exclusion IDs,
  ordered applicable CorrectionApplication IDs and closure-compiler version.
  It contains no candidate ClaimRevision or RelationshipRevision ID.
- Closure traversal proceeds to a fixed point over the governed dependency
  rules. It includes applicable parent and child mechanisms, governing
  chapeaux and provisos, inline and nested definitions, definitions used by
  several provisions, cross-references, incorporated schedules or documents,
  exceptions, overrides, party scope and temporal scope. Overlapping semantic
  objects remain separate dependency occurrences, while underlying structural
  leaves and coverage atoms are deduplicated so the same source interval is
  examined once. A dependency cycle is traversed to a deterministic
  deduplicated fixed point. An unresolved endpoint, unadmitted required source,
  unexplained relevant discovery residual, challenge partition gap or mismatch,
  bound breach or conflicting rule fails closure and enters quarantine.
- Each relationship capable of discharging a scope dependency has
  `build_phase=PRE_CLAIM_SCOPE`. During candidate extraction every
  ClaimScopeDependencyExpectation must be discharged by exactly one selected
  RelationshipRevision that names the exact dependency and relationship-semantic
  expectation IDs and matches its RelationshipDefinition,
  RelationshipEffectSchema, direction, endpoint roles, resolved target
  occurrence set, party and capacity, temporal scope, conditionality,
  precedence, legal operation, raw-scope expansion, affected-target rule and
  evidence scope. Before candidate review, a deterministic non-semantic stripper
  creates one `CandidateRelationshipActualProjection` from each selected
  RelationshipRevision. It contains only the neutral key, claimed terminal
  state, source-backed actual endpoint, operation, affected-target and effect
  fields, complete evidence intervals and the neutral
  RelationshipEffectFieldUniverse projection. It excludes every
  RelationshipSemanticExpectation, constraint, closure, frozen-pair,
  reconciliation, path, executable and review ID.
  `candidate_relationship_actual_projection_content_digest` hashes schema,
  registered stage and semantic-stage-contract digest, complete neutral key
  universe and canonical stripped bytes. Its
  `CandidateRelationshipProjectionAttestation` hashes that content digest,
  exact source RelationshipRevision IDs and canonical payload digests, complete
  source-to-projection coverage, empty omission and extra sets, stripping
  executable and configuration and applicable authority binding. It proves that
  stripping changed no permitted field. The `CANDIDATE_ACTUAL` worker receives exact admitted source,
  these stripped projections and primitive neutral schemas, but no full
  RelationshipRevision, independent or ordinary constraint, expectation object,
  reconciliation payload, path identity or review metadata. It independently emits one complete
  state-and-field candidate projection `A(k,s)` for each selected revision,
  using the same neutral key and selected terminal state. For `PRESENT`, `A`
  contains every resolved endpoint, operation, affected target and applicable
  effect field with exact source evidence. For a permitted non-present state it
  contains the complete state-specific proof and one `NOT_APPLICABLE` no-effect
  entry for every field-universe member, with no asserted operation, affected
  target, value or propagated legal effect. A third reconciler, and only that
  reconciler, compares the independently attested candidate payload with the
  already reconciled expected payload.
  Let `A_pre(c)` be the complete candidate projection for the selected
  pre-claim dependency states of closure `c`. Before the dependent claim can be
  created, pre-claim closure requires exact field-by-field
  `A_pre(c) = E_pre(c) = R_pre(c)`, one selected revision per expected dependency
  slot and no unmanifested selected slot, plus the state rules below. Full
  candidate-release closure later defines `A_all` in that same keyed,
  state-selected schema over both build phases and requires exact
  `A_all = E = R`. The ClaimScopeDefinition declares
  the terminal relationship states permitted for each dependency slot. A
  permitted non-`PRESENT` state must satisfy that state's exact independently
  frozen scope and proof rules; a schema-valid but mismatched effect cannot
  discharge the slot.
  `NOT_EXAMINED`, `FAILED`, a missing revision, unresolved target, partial
  assessment or multiplicity never discharges it.
- The successful independent-versus-ordinary stage exposes only one
  `ExpectedRelationshipNeutralProjection` containing the complete equal
  state-and-field comparison bodies. The candidate worker cannot read it. After
  the dispatcher validates the exact candidate A SemanticStageOutputSetRoot,
  CandidateRelationshipProjectionAttestation and expected
  SemanticNeutralProjectionSetRoot, the
  final reconciler receives only the complete implementation-neutral `A` body
  and that expected neutral body. The registered `THIRD_RECONCILER` input
  envelope hashes those ordered bodies, the build-phase partition, complete
  sorted `(k, selected_state, field_key)` universe, registered comparison schema
  and semantic-stage-contract digest and bounds.
  `candidate_relationship_reconciliation_semantic_id` hashes schema, that exact
  input-envelope ID, empty differences and terminal equality. Its governed
  `CandidateRelationshipReconciliation` ID hashes that
  semantic ID and NonSemanticPayloadAttestation, which binds the exact stripped
  CandidateRelationshipActualProjection and source RelationshipRevision sets,
  CandidateRelationshipProjectionAttestation, candidate payload and passing
  attestation, candidate A SemanticStageOutputSetRoot, expected neutral
  projection governed ID and SemanticNeutralProjectionSetRoot,
  both original path attestations, frozen pair, executable and review evidence.
  It cannot see or select either original path answer. One PRE_CLAIM_SCOPE
  reconciliation precedes the dependent ClaimRevision; one full reconciliation
  over both phases is candidate-release evidence.
- A ClaimRevision selects its exact ClaimScopeClosure and the ordered
  RelationshipRevision IDs that discharge that closure's dependency
  expectations. A ScopeAssessmentRevision selects the ordered closures for its
  expected claims and the same dependency revisions. A changed dependency
  expectation, interval, expected endpoint, admission, exclusion or closure rule
  changes the closure. A changed selected endpoint, relationship state or effect
  changes the discharging RelationshipRevision. Either change produces a new
  ClaimRevision and every transitive dependant.
- `ABSENT` is valid only when the selected ClaimScopeClosure compiled
  successfully before extraction, its challenge partition, `B_base = O_base`,
  `Q_independent = Q_ordinary` with `W_open = PASS`,
  `B_question_state = O_question_state`,
  `B_slot = O_slot` and `R = E` reconciliations remain exact, the candidate proves
  `A_pre(c) = E_pre(c) = R_pre(c)`, every
  dependency expectation is discharged in a state permitted by its
  ClaimScopeDefinition, examined intervals equal the complete
  required-examination interval set, every coverage proof passes and no
  qualifying present witness exists. Examination of only the base
  provision, component or candidate-selected anchors cannot support absence
  when the closure contains another dependency. Applicability cannot narrow a
  frozen closure after extraction starts. An approved corpus exclusion is not
  examined evidence. An excluded, unresolved, partially examined or failed
  required dependency produces `NOT_EXAMINED`, `FAILED` or a source-backed
  `NOT_APPLICABLE` as the state contract requires, never `ABSENT`.
  A reviewed open-world candidate whose SemanticImpactClosure intersects this
  claim or its result also prevents `ABSENT` unless it has been mapped or adopted
  under this frozen pair and the expanded closure has been completely
  re-examined. Source-specific display beside a familiar claim is not negative
  evidence for that claim.
- Each expected claim has a stable occurrence:
  `claim_occurrence_id` derives from subject type and stable subject occurrence
  ID, claim-definition key and version and a deterministic source-order ordinal
  for governed repeatable claims. It means “this expected assertion here”, not
  “this immutable answer”. A non-repeatable definition producing two logical
  occurrences is quarantined.
- After scope freeze and before any `PRE_CLAIM_SCOPE` relationship is resolved,
  materialise every selected deal-local ExpectedOccurrenceSlot, including each
  ClaimOccurrence and other non-revision occurrence identity. These records
  contain no answer state or value and may be referenced as typed endpoints.
  ClaimRevision extraction comes later. A pre-claim relationship may reference
  the ClaimOccurrence but never its not-yet-created revision.
- Each answer is an immutable `ClaimRevision`. Its ID is the
  domain-separated content hash of claim occurrence, exact
  ScopeAssessmentRevision ID when its owner is a ScopeAssessmentOccurrence,
  exact ClaimScopeClosure ID, ordered dependency-discharging
  RelationshipRevision IDs, expected-claim-slot key, state, raw and canonical
  values, unit, day basis, denominator, intended admitted scope, examination
  coverage, ordered
  `ClaimEvidence` edge IDs, applicability or failure payload and every
  extraction, normalisation and derivation version, plus ordered applied
  CorrectionApplication IDs. Run ID, timestamps and reviewer metadata remain
  provenance outside identity. Any change to state, value, scope, evidence or
  derivation produces a new revision ID.
- Claim state is exactly one of `PRESENT`, `ABSENT`, `NOT_APPLICABLE`,
  `NOT_EXAMINED` or `FAILED`. `ABSENT` is valid only under the complete frozen
  ClaimScopeClosure rules above. Missing data is never silently treated as
  absence.
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
- Every `PRESENT` or `ABSENT` claim records the examined scope and exact
  ClaimScopeClosure. Every `PRESENT` claim has exact evidence. `ABSENT` instead
  requires non-empty examined scope equal to the closure's complete
  required-examination interval set, dependency-discharge proof,
  scope-coverage proof and extractor/version provenance; it does not require a
  fabricated positive quote. Missing evidence on a `PRESENT` claim, evidence
  outside the admitted scope, invalid taxonomy codes and unknown attributes
  block publication and enter quarantine as retained residuals.
- The `ClaimDefinition` selects the exact governed subject. A whole-provision
  claim attaches to its `ProvisionInstance`; a limb-scoped claim attaches to its
  `ProvisionComponent`; a whole-concept state attaches to its
  `ScopeAssessmentOccurrence`. The presence of a parent provision never reparents a
  component claim. An `ABSENT` claim does not fabricate a provision span.
- `ScopeAssessmentRevision` ID hashes its occurrence ID, ordered
  ClaimScopeClosure IDs, ordered dependency-discharging RelationshipRevision
  IDs, coverage status, examined interval-set key, coverage-proof digest,
  assessor contract version, ordered source Excerpt IDs and state-specific
  applicability or failure inputs and ordered applied post-scope
  CorrectionApplication IDs. Coverage status is `NOT_STARTED`, `PARTIAL`,
  `COMPLETE` or `FAILED`, independently of claim state. Examined intervals must
  be contained in the deduplicated union of the selected closures and duplicate
  leaf coverage is invalid.
- `NOT_STARTED` has an empty examined set. `PARTIAL` has a strict non-empty
  subset of that required applicable union. `COMPLETE` covers every required
  applicable leaf or coverage atom in the union exactly once. `FAILED` records
  attempted coverage, canonical failure code and assessor version. A
  scope-owned `ABSENT` ClaimRevision also
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
  `ENFORCED_BY`, `TRIGGERS_REMEDY` and `MIRRORS`. Vocabulary and effect-schema
  changes pass the Freeze Gate.
- Every RelationshipDefinition selects exactly one closed, versioned
  `RelationshipEffectSchema` and one effect mode: `TYPED_LEGAL_EFFECT` or
  `NON_SEMANTIC`. The schema declares effect kind, direction, permitted source
  and target occurrence or revision types, endpoint semantic roles, party and
  capacity roles, affected-target selection and cardinality, conditionality,
  temporal scope, precedence and conflict rules, legal operation, propagation
  or non-propagation rules, required raw-scope representation, deterministic
  scope-resolution rule, evidence roles and build phase. Missing fields,
  unknown codes or a payload outside that closed schema fail compilation.
  There is no effectless generic semantic relationship.
- After SemanticQuestionCatalogueReconciliation passes, contract compilation
  emits one immutable neutral `RelationshipEffectFieldUniverse` for every
  reconciled effect-schema key from that equal catalogue projection. It is
  `PRE_FREEZE_CONTRACT` attested before ContractFreezeAttestation. Neither later
  path receives its governed ID or ordinary RelationshipEffectSchema object;
  each receives only the complete neutral field-universe bytes and content
  digest. Its semantic ID hashes schema, registered `FIELD_UNIVERSE` stage,
  SemanticComputationInputEnvelope ID, neutral schema key and version and
  complete ordered field contract, while its governed ID hashes that semantic ID and
  pre-freeze attestation. Every field contract fixes field
  key, canonical type, cardinality, applicability predicate AST,
  canonicalisation rule, permitted constraint operator, evidence roles,
  endpoint or source-expression rules and state-specific proof behaviour.
  Optionality never permits omission from this universe.
- The registered FIELD_UNIVERSE stage closes one
  `RelationshipEffectFieldUniverseSetRoot`. Its ID hashes schema, exact
  catalogue-reconciliation NeutralStageProjection content digest, FIELD_UNIVERSE
  semantic-stage-contract digest, exact producing FIELD_UNIVERSE
  SemanticStageOutputSetRoot ID and proof that its ordered relevant member
  projection is byte-equal to this specialised root's member set, the
  registry-declared complete ordered
  effect-schema-key universe and cardinality and, for every key, its neutral
  schema key and version, semantic-object ID and payload digest, review and
  passing pre-freeze attestation IDs, governed-object ID and
  GovernedSemanticRecord mapping digest. It also hashes empty missing, extra and
  duplicate key sets and the complete ordered field-contract payload-digest set.
  ContractFreezeAttestation selects this exact root. A missing field universe,
  duplicate key or catalogue key not represented exactly once blocks freeze.
- Each independent and ordinary path creates one pre-extraction
  `RelationshipEffectConstraint` for every expected relationship-effect slot.
  Its neutral key is `(base_subject_tuple, semantic_question_key,
  expected_question_slot_key, dependency_or_effect_slot_key, candidate_kind,
  relationship_definition_key, relationship_effect_schema_key, build_phase,
  governed_repeatable_ordinal)`. Its payload fixes the complete expected legal
  operation: relationship and effect kinds; direction; occurrence-independent
  source and target types, roles and keys; affected-target selection and
  cardinality; every party and capacity; condition predicate AST; temporal
  scope; precedence and conflict; propagation rules; raw-scope representation
  and deterministic expansion; accepted states and their proof rules; evidence
  roles and exact source intervals; and, for every accepted terminal state, one
  field constraint for every member of the selected field universe. The
  Cartesian product of accepted state and field key is total, even where a
  field has no legal effect in that state.
- Every state-and-field member has exactly one constraint state: `EXACT`,
  `NOT_APPLICABLE` or `BLOCKING_UNRESOLVED`. `EXACT` carries its governed
  operator and complete canonical expected value, expression, interval set or
  endpoint set. `NOT_APPLICABLE` carries the exact schema predicate and
  source-backed facts proving the field cannot govern this relationship in that
  terminal state. Every permitted non-`PRESENT` branch marks every legal-effect
  field `NOT_APPLICABLE`, carries the exact state-specific coverage,
  applicability or failure proof contract and asserts no operation, affected
  target or propagated legal effect. `PRESENT` supplies every applicable exact
  source-specific field and may mark a field `NOT_APPLICABLE` only where the
  field-universe predicate proves that result. Phrase absence, a missing
  candidate value or extractor failure proves nothing. Missing, duplicate,
  extra, unknown or unresolved state-and-field members block scope freeze.
- `relationship_effect_constraint_semantic_id` hashes schema, path,
  SemanticComputationInputEnvelope ID, neutral key `k`, complete ordered accepted
  state set and the sorted Cartesian `(state, field_key, constraint_state,
  operator, canonical_payload, proof_contract, source_intervals)` matrix. The
  path-specific governed constraint ID then hashes that semantic ID and its
  NonSemanticPayloadAttestation, which binds the exact governed
  RelationshipEffectFieldUniverse object, frozen pair and review evidence. No
  ordinary RelationshipDefinition or RelationshipEffectSchema object digest is
  inserted into the independent semantic payload.
- For each deal scope and path, all selected constraints close one immutable
  `RelationshipEffectConstraintSetRoot`. Its ID hashes schema, frozen pair,
  DealAdmissionManifest and path, exact constraint-stage contract digest, exact
  producing path-specific constraint SemanticStageOutputSetRoot ID and proof
  that its ordered relevant member projection is byte-equal to this specialised
  root's member set, exact selected RelationshipEffectFieldUniverseSetRoot, the registry-declared
  complete ordered neutral-key and accepted-state universe and cardinality and,
  for every neutral key, the complete ordered
  `(semantic_object_id, semantic_payload_digest, review_disposition_id,
  passing_attestation_id, governed_object_id,
  GovernedSemanticRecord_mapping_digest, state_field_matrix_digest)` tuple. It
  hashes empty missing, extra and duplicate neutral-key, state and field sets and
  a complete state-by-field Cartesian-product proof. The independent and
  ordinary roots are distinct and neither may read the other. Each
  DealScopeRunManifest selects its exact two roots; CorpusScopeManifest selects
  their complete ordered corpus set and their relationship-semantic
  reconciliations. A loose collection of constraints or count equality cannot
  satisfy scope freeze.
- Build phase is `PRE_CLAIM_SCOPE` or `POST_CLAIM`. A pre-claim relationship may
  use only immutable semantic, component, scope-dependency or claim occurrence
  IDs and source-backed evidence that exist before the dependent ClaimRevision;
  it may encode an exact conditional predicate by occurrence reference without
  claiming that the condition is factually satisfied. It may discharge a
  ClaimScopeDependencyExpectation. A contract that makes it depend on the
  ClaimRevision whose scope it controls is cyclic and fails compilation. A
  post-claim relationship may depend on exact earlier ClaimRevision or
  RelationshipRevision IDs only through the compiled dependency DAG.
- `CONTAINED_IN` is `NON_SEMANTIC` with legal operation `GEOMETRIC_ONLY`. It
  establishes source geometry and no automatic inheritance of concept, party,
  qualifier, exception, definition, claim, evidence or legal effect. A separate
  effect-bearing relationship is required for semantic use. `MIRRORS` is
  `NON_SEMANTIC` with legal operation `DISPLAY_SIMILARITY_ONLY`; it may support
  explicitly labelled navigation or display but cannot transfer a party,
  state, claim, value, evidence or effect or satisfy a legal result, metric,
  normaliser or predicate.
- `USES_DEFINITION` identifies the exact defined-term-use span, definition
  occurrence, governed term and sense, affected semantic objects, components
  or claim fields, application scope, recursive dependencies and applicable
  override or precedence rule. A nested definition remains a separate endpoint;
  one definition used by three provisions produces three separately keyed
  constraints referencing the same definition occurrence. Containment alone
  cannot substitute for a use edge, and no use may be omitted or reassigned.
- `BRINGS_DOWN` identifies the closing-condition occurrence, exact
  representation and limb targets, representation maker, condition obligor,
  beneficiary or right holder, measurement dates, accuracy standard,
  materiality or MAE scrape, exceptions and deterministic expansion of the raw
  contractual scope expression. QXO Tier B and Tier C therefore differ in
  complete field values, not labels. A free-text list of cited representations
  cannot publish.
- `APPLIES_TO`, `GOVERNS` and `ENFORCED_BY` identify the exact affected
  occurrence or component set, party and capacity, governing standard,
  conditions, temporal reach and precedence. They do not propagate an
  attribute to a parent, sibling or reciprocal party unless the effect payload
  names that target.
- `EXCEPTED_BY` identifies the exact affected target set, conditions,
  precedence and whether it narrows, overrides, suspends or supplies an
  alternative. An exception threshold applies only to the targets named by its
  effect payload.
- `TRIGGERS_REMEDY` identifies the complete trigger predicate, remedy or
  termination right, fee payor, payee or right holder, beneficiary, temporal
  and tail conditions, signing and competing-proposal conditions, exclusivity
  or cumulative effect, precedence and every condition necessary to activate
  the remedy. Multiple contributing spans remain separate endpoints and
  evidence; schema validity cannot hide an omitted tail or condition.
- A RelationshipDefinition also declares permitted source and target object
  types, cardinality, state rules and whether targets may be components or
  claims. Every source-specific relationship occurrence is the strict one-to-one
  realisation of one RelationshipSemanticExpectation.
  `relationship_occurrence_id` is the domain-separated derivation of that exact
  expectation ID and its resolved source-endpoint occurrence ID; no separately
  mutable definition, slot, target, party, scope or ordinal field may disagree
  with the expectation. Resolution maps every occurrence-independent endpoint
  key to exactly one permitted immutable occurrence or blocks publication.
  Every state requires non-empty intended scope. For a relationship
  that permits `ABSENT`, the expectation enumerator freezes its complete
  potential-endpoint and interval universe, reconciled against the independent
  semantic challenge, rather than candidate matches; candidate-selected scope
  cannot support absence.
- `RelationshipEvidence` is a deterministic edge with ID derived from
  `(relationship_occurrence_id, evidence_role, excerpt_id, ordinal)`. Its
  effect schema governs permitted roles, and the universal compiled ordinal
  rule applies. Relationship evidence is not an untyped excerpt array.
- Each immutable `RelationshipRevision` hashes the occurrence ID, exact
  RelationshipSemanticExpectation ID, state,
  canonical raw scope, the exact source endpoint revision ID when that endpoint
  type is revisioned, ordered resolved target occurrence IDs and, for revisioned
  target types, their exact selected revision IDs, RelationshipEffectSchema key
  and version, exact RelationshipEffectFieldUniverse ID, selected terminal-state
  branch of the ordinary RelationshipEffectConstraint, canonical effect payload
  and complete state-and-field payload digest, ordered
  ClaimScopeDependencyExpectation IDs it discharges, condition and precedence
  input occurrence or revision IDs, ordered RelationshipEvidence edge IDs,
  state-specific coverage, applicability or failure payload, resolver version
  and ordered applied CorrectionApplication IDs. A `PRESENT` revision requires
  exact effect-supporting evidence, resolved endpoints and a schema-valid effect
  payload whose affected targets equal its resolved target set and whose effect
  fields exactly satisfy every member of its own selected ordinary
  RelationshipEffectConstraint state branch. Named dependency expectations add
  discharge checks and cannot substitute for that complete branch. A
  `NON_SEMANTIC` revision
  carries only its governed non-propagating operation. A non-`PRESENT` revision
  carries no asserted legal effect. Every non-`PRESENT` revision selects its
  complete no-effect constraint branch, has one `NOT_APPLICABLE` entry per field
  universe member and carries no operation, target effect or value. `ABSENT` requires complete independently
  frozen coverage proof, examined potential-endpoint and interval sets exactly
  equal to the reconciled frozen universe, zero qualifying relationship witness,
  zero conflicting revision and the exact independently frozen zero-witness
  proof. Complete coverage with one ignored witness cannot satisfy absence.
  `NOT_APPLICABLE`, `NOT_EXAMINED` and `FAILED` follow the claim-state
  invariants. An unresolved endpoint or condition expression, target-set
  mismatch, missing effect field or conflicting precedence blocks publication.
  A pre-claim conditional predicate is complete when its source-backed
  expression and occurrence references are resolved; it is not treated as a
  factual condition outcome. No unresolved target receives a fabricated object
  ID. Exact revisions collapse; conflicting revisions from one run are
  quarantined.
- Fuzzy text matching may propose a relationship and effect payload for review.
  It may not write a canonical edge, discharge a scope dependency or transfer
  claims, parties, evidence or effects.
- `ResultDefinition` specifies a versioned lawyer-facing answer: its required
  and optional component claims, permitted relationships, ordering,
  normalisation rules and failure behaviour. It fixes maximum inline component,
  relationship, observation and evidence-reference cardinalities and bytes per
  slot and per row. A governed repeatable slot may use a bounded cursor-backed
  child collection with an exact total; required content may never be silently
  truncated. Exceeding an undeclared or hard cardinality is a contract failure.
- For every relationship slot, ResultDefinition gives every member of the
  selected RelationshipEffectFieldUniverse exactly one serving disposition:
  `INLINE_DIMENSION`, `CHILD_DIMENSION`, `QUERY_ONLY` or
  `NOT_RESULT_RELEVANT`. The first three declare type, source branch,
  multiplicity, index and row-contract field. The last carries a reviewed legal
  reason. Missing, duplicate or unknown field dispositions fail contract
  compilation; a projector cannot silently discard a valid effect field.
- Every ResultDefinition declares exact relationship slots and a bounded
  lawyer-facing projection for each permitted RelationshipEffectSchema. The
  projection includes every effect field necessary to answer the result's legal
  question. Each slot declares accepted relationship states and state-specific
  failure behaviour; `FAILED`, `NOT_EXAMINED`, missing or conflicting required
  relationship truth blocks publication. A `NON_SEMANTIC` relationship cannot
  satisfy an effect-bearing slot. A ResultDefinition may not replace an
  effect-bearing relationship with a display label or infer its effect from
  concept, section, containment or party similarity.
- Before CorpusScopeManifest freezes and before any candidate result or
  observation exists, a separately implemented composition challenger reads
  only the minimal IndependentCompositionQuestionCatalogue, the exact
  `B_base = O_base`, `Q_independent = Q_ordinary` with `W_open = PASS`,
  `B_question_state = O_question_state`, `B_slot = O_slot` and `R = E`
  reconciled semantic-slot
  projections, admission identities and source coordinates. It cannot read or
  import ordinary ResultDefinition, MetricDefinition, ResultInputLineage,
  composer, normaliser, projector, serving-row or query-schema code, generated
  output, aliases, defaults, fixtures or candidate values.
- The two composition paths use three disjoint subjects.
  `DEAL_RESULT_COMPOSITION` is keyed by exact deal, result key and version,
  party and capacity and owns every reconciled claim and relationship-effect
  slot needed by that result. `DEAL_METRIC_OBSERVATION` is keyed by exact deal,
  global metric-question key, party and capacity and owns the deal-level inputs
  from which one observation is derived. `CORPUS_METRIC_QUERY` is keyed only by
  the frozen metric or query-question key and version and owns cohort,
  aggregation and query behaviour. The complete global catalogue exists once
  per frozen pair, never once per deal.
- `composition_context_key` is the complete tagged pair
  `(composition_subject_key, owned_key)`. `composition_subject_key` is the full
  `DEAL_RESULT_COMPOSITION`, `DEAL_METRIC_OBSERVATION` or
  `CORPUS_METRIC_QUERY` subject tuple above. `owned_key` is unique only inside
  that subject. Every coverage map, child, shard, projection, expected slot,
  actual entry, difference and anti-join uses the complete pair. Reusing the
  same owned key under another deal, result, metric, party or capacity is valid;
  moving it between contexts produces one missing and one extra entry.
- Every independent and ordinary subject key first receives one explicit
  coverage disposition:
  `REQUIRED`, `REVIEWED_NOT_EXPOSED` or `BLOCKING_UNRESOLVED`.
  `REVIEWED_NOT_EXPOSED` requires a question-specific legal reason, exact source
  and semantic-slot evidence and eligible independent review; a missing witness,
  `ABSENT` answer, optional ordinary component or omitted ordinary definition
  cannot justify it. Thus a trigger, exception, bring-down tier, fee side,
  denominator or refinement dimension cannot disappear merely because no
  ordinary result or metric asks for it.
- Cardinality is disposition-aware at the contextual-key level. `REQUIRED`
  declares exactly one candidate materialisation in its exact output namespace.
  Repeatable answers use separately keyed governed requirement children and
  ordinals, not several actuals under one contextual key.
  `REVIEWED_NOT_EXPOSED` declares zero candidate materialisations and creates no
  ExpectedOccurrenceSlot or ExpectedResultInputLineageSlot in that context;
  the same legal fact may remain canonical truth or be required in another
  context. `BLOCKING_UNRESOLVED` creates no closure and blocks scope freeze.
  An optional legal answer or an accepted `ABSENT` or `NOT_APPLICABLE` state is
  still a `REQUIRED` materialisation, never implicit zero cardinality.
  The declared actual kind is part of the requirement payload. If a result
  component, observation, serving row and compiled query field are all required,
  each has its own contextual requirement key. A supporting lineage or evidence
  reference inside one actual is not silently counted as another actual.
- On each path, every coverage-disposition ID directly hashes its domain and
  schema, exact frozen contract pair, scope kind, complete
  `composition_context_key`,
  exact semantic-slot and catalogue-question payload digests where applicable,
  state, evidence, governed reason and rule, executable and configuration
  digests, review-evidence ID and deterministic ordinal. Omission is a partition
  gap, not implicit non-exposure. Every independent and ordinary requirement is
  a first-class child object whose ID directly hashes its domain and schema,
  exact frozen pair, exact parent coverage-disposition ID, complete
  `composition_context_key`, full normative requirement payload, relevant catalogue,
  semantic-slot, ResultDefinition, MetricDefinition and generated-schema
  payload digests for that path, source evidence or an explicit
  global-no-source marker, executable and configuration digests, review evidence
  and ordinal. No child may reference a shard, parent manifest, reconciliation
  or closure.
- In that identity formula the independent child may hash only its minimal
  catalogue and reconciled semantic-slot payloads; it cannot hash or inspect a
  ResultDefinition, MetricDefinition or generated schema. The ordinary child
  may hash the ordinary contract and generated-schema payloads but cannot hash
  or inspect the independent catalogue or child. The common
  `composition_context_key` and implementation-neutral value schema are the
  only comparison boundary.
- The full normative requirement payload fixes required or optional treatment,
  accepted terminal states and failure behaviour, relationship operation and
  every effect field, component order and cardinality, evidence and lineage,
  exact materialisation kind and output namespace, one occurrence-independent
  primary materialisation-use-key schema, complete bounded nested-use-key
  schemas and kind-specific stable-member and ordinal rules, raw and canonical value
  dimension and unit, denominator and fee side,
  conversion and derivation, per-deal roll-up and weighting, cohort strata and
  every filter, grouping, sort, export and bounded child-detail dimension. The
  ordinary compiler must emit the same first-class identity contract; an
  anonymous embedded requirement inventory is invalid.
- Children are partitioned into locality shards. An independent and ordinary
  deal shard is keyed by exact deal plus either result/version/party/capacity or
  metric-observation-question/party/capacity. An independent and ordinary global
  shard is keyed by one metric or query-question key and version. Each shard ID
  hashes its schema, frozen pair, complete shard key, ordered child IDs and exact
  contextual-key partition digest. A reviewed `NO_EXPOSED_RESULT` shard owns valid
  deal keys not exposed by any result; they may not be attached to an unrelated
  result. A shard may not reference its parent manifest.
- Four firewalled totality roots are then built:
  `IndependentDealCompositionManifest` and
  `OrdinaryDealCompositionManifest`, one of each per exact
  DealAdmissionManifest, and `IndependentGlobalCompositionManifest` and
  `OrdinaryGlobalCompositionManifest`, exactly one of each per frozen contract
  pair. A deal root hashes its schema and frozen pair, relevant intake,
  AdmissionUniverseReconciliation, DealAdmissionManifest,
  PotentialDependencyUniverse and semantic-reconciliation IDs, complete ordered
  deal-shard map and semantic-slot partition proof, and its path's executable,
  configuration and review evidence. A global root hashes no deal, admission,
  intake or PotentialDependencyUniverse input. It hashes its schema and pair,
  the independent catalogue payloads or ordinary MetricDefinition, query-schema
  and generated-schema payloads, complete ordered global-shard map and
  global-question partition proof, and path-specific executable, configuration
  and review evidence. Neither ordinary root, shard or child may read an
  independent object, and neither independent object may read ordinary
  definitions, generated output or candidate data.
- Let `K_contract(s)` be the independent implementation-neutral contract
  projection and `D_contract(s)` the ordinary contract projection for shard
  `s`. Path-specific object IDs, executable and review evidence and the common
  frozen pair are excluded from the projection; complete contextual keys and
  every occurrence-independent normative requirement above are
  compared field by field. Before comparison, the dispatcher validates the
  exact complete independent and ordinary SemanticStageOutputSetRoots for that
  shard. The registered THIRD_RECONCILER envelope hashes canonical K and D
  bodies, the complete contextual-key universe, comparison schema,
  semantic-stage-contract digest and bounds. The inner reconciliation semantic
  ID hashes that envelope ID, empty differences and terminal state. Its governed
  `composition_shard_reconciliation_digest(s)` binds the exact two shard IDs,
  their complete path-root IDs and attestations and third-reconciler governance
  evidence. A separate per-deal parent
  reconciliation proves identical complete deal-shard and semantic-slot
  partitions. One global parent reconciliation proves identical complete
  metric and query-question shard universes. Total coverage, zero blocking
  dispositions and exact equality are mandatory. Counts, labels, shared
  generated digests and reassignment between components, parties, fee sides,
  triggers, results, observations or metrics cannot pass.
- A passing K-versus-D shard and parent reconciliation emits only an
  `ExpectedCompositionContractProjection` containing the complete equal
  contextual keys and occurrence-independent normative contract bodies. Its
  semantic ID hashes its domain and schema, the registered
  `COMPOSITION_CONTRACT_THIRD_RECONCILER` stage-contract digest and input-envelope
  ID, complete ordered contextual-key contract bodies, exact empty differences
  and terminal `EQUAL`. Its semantic body contains no K or D path or object
  identity. The outer governed projection alone binds the path roots, frozen
  pair, execution and review evidence. No candidate worker receives either K or
  D payload, ID, attestation, difference or review result.
- After K/D contextual-key and parent equality, the dispatcher emits a bounded,
  payload-free `CompositionContextKeyUniverseShard` set and one
  `CompositionContextKeyUniverseRoot`. Shards are BoundedInventoryTree leaves
  over ordered key ranges, and fixed-fanout internal nodes close them to one
  fixed root reference. The neutral content digest hashes
  `COMPOSITION_CONTEXT_KEY_UNIVERSE_CONTENT/V2`, schema, that tree-root
  reference, key count and fixed empty missing, extra and duplicate tree roots.
  It contains no coverage disposition, output namespace, requirement, accepted
  state, cardinality, value, rule, reason, evidence, path identity or candidate
  fact. The governed root hashes `COMPOSITION_CONTEXT_KEY_UNIVERSE_ROOT/V2`,
  schema, frozen pair, exact K/D shard and parent key-set reconciliation IDs,
  neutral content digest, fixed tree-root reference, key count, enumerator
  executable and review evidence. Neither root nor content digest lists every
  key, shard ID or internal-node ID. CorpusScopeManifest selects the root and
  every reachable node. A candidate worker may receive only validated key-only
  tree nodes, root reference and neutral content digest, never the governed
  wrapper or any K, D or ExpectedCompositionContractProjection body. The key-
  only tree can force total enumeration but cannot tell the candidate what
  answer or rule to emit.
- `deal_composition_parent_reconciliation_digest(d)` and
  `global_composition_parent_reconciliation_digest` are governed reconciliation
  IDs. Each inner semantic ID hashes its registered THIRD_RECONCILER envelope,
  which contains only the complete canonical shard-key and owned-partition
  bodies, key universe, comparison schema, semantic-stage-contract digest and
  bounds, plus exact differences and terminal state. Each outer attestation
  alone binds the frozen pair, exact independent and ordinary parent-root and
  SemanticStageOutputSetRoot IDs, path attestations and third-reconciler
  execution and review evidence. A parent reconciler cannot create, move or
  repair a child or shard.
- One immutable `CompositionScopeClosure` has one of
  `DEAL_RESULT`, `DEAL_METRIC_OBSERVATION` or `GLOBAL_METRIC_QUERY` subject state.
  Its ID hashes its schema and frozen pair, complete subject, exact relevant
  independent and ordinary shard IDs and ordered child IDs, exact shard
  reconciliation digest, relevant source-claim, ClaimScopeClosure and
  relationship-effect-slot IDs, exact relevant OpenWorldCandidateOccurrence,
  final disposition, independently reconciled SemanticImpactClosure and
  ApplicabilityReexaminationRequirement and relevant local entry or slice IDs
  and payload digests, ordered applicable CorrectionApplication IDs
  and closure-compiler version. It never hashes a
  complete parent root, a sibling-sensitive membership proof, candidate
  revision, value, ResultInputLineage or serving payload. CorpusScopeManifest
  binds each closure to the relevant totality roots and independently verifies
  shard membership. A sibling shard or unrelated deal can therefore change the
  corpus release without rekeying an unaffected closure or family set.
  An impact closure intersecting this composition subject is part of the closure,
  not a sidebar annotation. Until discharged by the frozen contract and complete
  re-examination, it forces the affected result or metric to the exact incomplete
  or non-certified branch while leaving sibling closures unchanged.
- Before corpus scope freezes, create one immutable `ExpectedOccurrenceSlot`
  for every post-barrier non-revision occurrence the frozen scope requires.
  Its closed variants are `SCOPE_ASSESSMENT`, `CLAIM`, `RELATIONSHIP`,
  `DERIVED_RESULT`, `RESULT_COMPONENT`, `METRIC_OBSERVATION` and
  `QUERY_DIMENSION`. Its ID hashes schema, frozen pair, governed deal or global
  subject, owning family or global scope key, occurrence kind, complete
  occurrence-independent subject tuple, exact definition key and version,
  deterministic governed ordinal, relevant ClaimScopeClosure,
  RelationshipSemanticExpectation or CompositionScopeClosure IDs, and the
  complete deterministic expected-occurrence identity payload and expected
  occurrence ID, plus ordered applicable CorrectionApplication IDs. A
  relationship slot additionally hashes its exact expectation,
  endpoint roles and occurrence-independent endpoint keys. A deal-local
  `DEAL_SCOPE_RUN` creates deal slots; bounded `CORPUS_SCOPE_FREEZE` preparation
  creates only the global metric and query slots after the global composition
  closures exist.
- An ExpectedOccurrenceSlot is a frozen expectation, not an asserted occurrence
  or answer. CorpusScopeManifest inventories these slots and their precomputed
  expected IDs, never a not-yet-created ClaimOccurrence,
  ScopeAssessmentOccurrence, RelationshipOccurrence, result occurrence,
  metric occurrence or query-dimension occurrence. After the exact barrier,
  `DEAL_EXTRACTION_RUN` materialises each selected deal slot exactly once and
  `CANDIDATE_RELEASE_FREEZE` materialises each selected global slot exactly
  once. The inserted occurrence's canonical identity payload and ID must equal
  the slot's precomputed values byte for byte. Missing, extra, duplicate or
  differently resolved materialisation blocks. A changed closure may rekey the
  slot while preserving the expected occurrence ID when its identity-bearing
  subject, definition and ordinal are unchanged; the later revision still
  rekeys through the changed closure.
- `ExpectedResultInputLineageSlot` is an immutable scope-stage expectation for
  one governed input member of one future ResultInputLineage. It is created only
  for a `REQUIRED` result-component materialisation, after its
  CompositionScopeClosure and result-component ExpectedOccurrenceSlot and
  before DealScopeRunManifest. It asserts no candidate fact. Its ID is the
  domain-separated hash of `EXPECTED_RESULT_INPUT_LINEAGE_SLOT/V1`, schema,
  frozen contract pair, complete `composition_context_key`, result-component
  ExpectedOccurrenceSlot ID and precomputed occurrence ID,
  CompositionScopeClosure ID, ResultDefinition key and version,
  component-slot key, lineage-role key, source ExpectedOccurrenceSlot ID or
  occurrence-independent semantic or relationship-effect-slot key, accepted
  source occurrence and revision kinds and states, required relationship
  operation and RelationshipEffectFieldUniverse field dispositions, evidence
  roles, input cardinality, compiled total comparator and governed repeatable
  ordinal, plus ordered applicable CorrectionApplication IDs. It contains no
  ClaimRevision, RelationshipRevision,
  ResultInputLineage, result or component revision, candidate projection or
  conformance, manifest, root, receipt or mutable-head ID.
- Each actual lineage entry names exactly one
  ExpectedResultInputLineageSlot and its selected occurrence, revision, effect
  and evidence. ResultInputLineage hashes the exact expected-slot set and the
  ordered discharged entries. Candidate closure requires exactly one discharge
  per expected lineage slot, no extra or duplicate, a same-snapshot selected
  revision, a permitted state and exact effect and evidence satisfaction. The
  lineage slot does not enter CompositionScopeClosure because it already hashes
  that closure.
- Candidate certification uses two disjoint projections because a contract and
  a realised value are different semantic objects. First, a separately
  implemented enumerator receives only the validated
  CompositionContextKeyUniverse content and the sealed, actually deployed
  generated result and query schemas, normaliser, projector and operator
  catalogues, compiled-plan contracts, indexes and explicit generated negative
  materialisation rules. It builds bounded
  `CandidateCompositionImplementationCatalogueShard`s and one
  `CandidateCompositionImplementationCatalogueRoot`. Each entry binds one
  contextual key to the implementation rule independently reconstructed from
  those deployed artefacts. Catalogue shards and implementation-source-artefact
  inventory shards are BoundedInventoryTree leaves, and fixed-fanout nodes close
  each to one fixed root reference. A neutral catalogue-content digest hashes
  `CANDIDATE_COMPOSITION_IMPLEMENTATION_CATALOGUE_CONTENT/V2`, schema, key-
  universe neutral content digest, implementation-source-artefact tree root,
  catalogue tree root, entry count and fixed empty missing, extra and duplicate
  tree roots. The governed root hashes
  `CANDIDATE_COMPOSITION_IMPLEMENTATION_CATALOGUE_ROOT/V2`, schema, frozen pair,
  candidate generation, CandidateInputSeal, CorpusRelease, exact key-universe
  root, neutral catalogue-content digest, both fixed tree-root references,
  enumerator evidence and terminal `PASS`. Neither root inlines contextual keys,
  shard IDs, source-artefact IDs or ordered entry digests. The
  enumerator may use the key-only universe to demand an entry but cannot read K,
  D, ExpectedCompositionContractProjection, a coverage disposition, normative
  contract body, candidate value or another composition compiler's output.
  Missing explicit implementation for any key blocks; an output's absence
  cannot manufacture a negative rule.
- A deterministic stripper then reads only that catalogue and its exact
  generated source artefacts. It emits
  `CandidateCompositionContractRealisationProjection`, containing only the
  occurrence-independent implemented schema and rule tuple for every
  `composition_context_key`. A `REVIEWED_NOT_EXPOSED` context appears here as an
  explicit zero-materialisation rule although it appears in no serving schema
  or instance. The content digest hashes schema, the registered
  `CANDIDATE_COMPOSITION_CONTRACT_REALISATION` stage-contract digest, complete
  ordered contextual-key universe and canonical stripped contract bytes.
  `CandidateCompositionContractProjectionAttestation` hashes that digest, exact
  catalogue root, generated source-object IDs and payload digests and complete
  contextual implementation-use edges. An edge is keyed by composition context,
  source artefact ID, governed rule or field path and ordinal. One generic
  artefact may fan out to several distinct authorised contexts; duplicate edges,
  an unbound context or collapsing several source rules into one contextual edge
  fails. Empty omitted, extra, duplicate-edge and prohibited-field sets,
  stripper executable and configuration and authority binding are mandatory.
- After its registered candidate stage root passes, the contract THIRD_RECONCILER
  receives only the stripped candidate contract body and
  ExpectedCompositionContractProjection body. Its input envelope hashes those
  complete ordered bodies, contextual-key universes, registered comparison
  schema, stage-contract digest and bounds. The inner
  `candidate_composition_contract_reconciliation_semantic_id` hashes schema,
  that envelope ID, exact empty field differences and terminal `EQUAL`. The
  governed `candidate_composition_contract_reconciliation_id` hashes that
  semantic ID, passing NonSemanticPayloadAttestation, exact contract-projection
  attestation and root,
  expected projection and root, original path roots and reconciliations, frozen
  pair, execution and review evidence. The proof is exact
  `K_contract(s) = D_contract(s) = A_contract(s)` for every shard after both
  parent key-set equalities pass. Selected states, values, occurrence or
  revision IDs, lineage, evidence and aggregate counts are prohibited fields in
  all three contract bodies.
- Separately, an expectation-blind instance stripper projects every selected
  DerivedResultOccurrence and revision, ResultComponentOccurrence and revision,
  ResultInputLineage and entry, metric observation, query-dimension occurrence,
  result, child, observation and aggregate serving payload, generated result or
  query field and mandatory compiled-plan dimension into
  `CandidateCompositionInstanceProjection`. Every contract requirement declares
  one primary `materialisation_use_key` and the complete bounded nested-use key
  derivation rules. A use key hashes `COMPOSITION_MATERIALISATION_USE/V1`,
  composition context, actual kind, role or slot key, kind-specific stable
  member key and governed ordinal. The member key is the exact
  ExpectedResultInputLineageSlot ID for a lineage entry, precomputed occurrence
  ID for a canonical object, typed serving key for a serving row or generated
  field or dimension key plus ordinal. It never uses display value or insertion
  order. Each stripped instance is keyed by its exact materialisation-use key and carries only its
  selected state, raw and canonical value, unit and basis, effect, evidence,
  lineage and immutable candidate-source references. Its content digest hashes
  schema, the registered `CANDIDATE_COMPOSITION_INSTANCE` stage-contract digest,
  complete ordered materialisation-use-key universe and canonical bytes.
  `CandidateCompositionInstanceProjectionAttestation` hashes that digest, exact
  source IDs and payload digests, complete declared output-namespace coverage,
  and complete `CandidateCompositionContextualUseEdge` set. Each edge hashes its
  materialisation-use key, source-object type, stable source-object ID and
  payload digest, governed source field or member path and source-use ordinal.
  One immutable source object may fan out to several distinct authorised use
  edges; each expected use key has exactly one edge. Duplicate edges,
  many-source-to-one-use collapse, an unauthorised context or an unprojected
  contextual source field fails. Empty omission and extra sets, stripper
  executable and configuration and authority binding are mandatory. Runtime
  QueryPlan instances, K or D objects, expected projections and later
  CandidateOutputSeal or conformance objects are prohibited inputs.
- The registered `CANDIDATE_COMPOSITION_INSTANCE_CONFORMANCE` THIRD_RECONCILER
  receives only the attested stripped instances and the already reconciled
  expected contract bodies. It does not choose or repair a value. It passes only
  when there is no `BLOCKING_UNRESOLVED` context; each `REQUIRED`
  `composition_context_key` has exactly one primary actual in its declared
  namespace and exact equality between every declared nested-use key and actual
  use key;
  each `REVIEWED_NOT_EXPOSED` context has zero matching result, component,
  lineage, observation, aggregate, serving, generated-field or compiled-plan
  output under a complete contextual anti-join; and every actual satisfies its
  accepted state, value, unit, normalisation, relationship-effect, evidence,
  lineage, order, failure and cardinality predicates. A count-only or
  owned-key-only proof cannot pass.
- `candidate_composition_instance_conformance_semantic_id` hashes schema, the
  registered conformance input-envelope ID, ordered per-context validation
  outcomes, exact missing-required, unexpected-actual, non-exposed-actual,
  duplicate, cardinality, state, value, unit, effect, evidence and lineage
  violation sets and terminal state. Only all-empty violation sets can receive
  a passing governed `CandidateCompositionInstanceConformance`. Its ID hashes
  that semantic ID, passing NonSemanticPayloadAttestation,
  CandidateCompositionInstanceProjectionAttestation and stage
  root, ExpectedCompositionContractProjection and neutral root, exact
  CorpusScopeManifest, CompositionScopeClosure and expected occurrence and
  lineage-slot sets, original path roots and reconciliations, frozen pair,
  execution and review evidence. CandidateOutputSeal later inventories both
  candidate projections, both projection attestations, contract reconciliation
  and instance conformance together. These are sorted offline certification
  artefacts. Only closure and certified payload digests propagate to serving;
  no interactive request expands or joins a composition challenge, child,
  shard or root.
- During candidate output preparation, two disjoint implementations,
  `CONTRACT_SET_A` and `CONTRACT_SET_B`, independently stream the complete
  composition-contract-set projection into separate BoundedInventoryTrees. Each
  logical member has exactly one tagged form:
  `CONTEXT_CONTRACT(composition_context_key,
  canonical_equal_contract_body_digest,
  K_D_shard_reconciliation_semantic_id,
  candidate_composition_contract_reconciliation_id)`,
  `DEAL_PARENT_PARTITION(complete_deal_subject_key,
  deal_parent_reconciliation_id, canonical_partition_digest)` or
  `GLOBAL_PARENT_PARTITION(global_subject_key,
  global_parent_reconciliation_id, canonical_partition_digest)`. The projection
  contains every contextual key and every deal and global parent partition
  exactly once and no selected state, actual value, candidate revision, lineage
  value, observation, aggregate or serving payload.
- Each implementation creates one immutable
  `CompositionContractSetRecompositionRoot`. Its ID hashes
  `COMPOSITION_CONTRACT_SET_RECOMPOSITION_ROOT/V1`, schema, frozen contract pair,
  candidate generation, CandidateInputSeal, CorpusRelease, exact
  CompositionContextKeyUniverse ID and neutral content digest, enumerator role,
  fixed BoundedInventoryTree root reference, contextual and parent-member
  counts, neutral `composition_contract_set_digest`, fixed missing, extra,
  duplicate, conflicting-key and stale-reconciliation tree roots, enumerator
  executable and configuration digests, complete transitive dependency graph
  and terminal state. Tree-node identities include enumerator role; the neutral
  member projection and digest exclude it. The neutral digest is
  `H("COMPOSITION_CONTRACT_SET/V2", schema, frozen contract pair,
  CompositionContextKeyUniverse neutral content digest, complete logical-member-
  tree neutral content digest, contextual-member count, deal-parent count,
  global-parent count and fixed empty difference-root content digests)`.
- `CompositionContractSetEnumeratorIndependenceAttestation` hashes schema, both
  recomposition-root IDs and payload digests, both executable, configuration and
  complete transitive-dependency graphs, the governed shared-primitive allowlist
  and exact empty prohibited intersection, validator evidence and terminal
  state. Only immutable source-object reads, database transport, canonical
  serialisation and cryptographic hashing may be shared. The implementations may
  not share traversal code, query helpers, views, membership tables, cache,
  intermediate rows, tree nodes or output.
- A third implementation creates one immutable
  `CompositionContractSetAttestation`. Its ID hashes
  `COMPOSITION_CONTRACT_SET_ATTESTATION/V1`, schema, frozen contract pair,
  candidate generation, CandidateInputSeal, CorpusRelease, exact
  CompositionContextKeyUniverse ID and neutral content digest, both
  CompositionContractSetRecompositionRoot IDs, payload digests and fixed tree-
  root references, both independently computed contract-set digests and member
  counts, exact independence-attestation ID and payload digest, fixed
  bidirectional missing, extra, duplicate, conflicting-key, payload-mismatch and
  stale-reconciliation tree roots, third-reconciler executable and configuration
  digests and terminal `PASS` or `FAIL`. PASS requires byte-equal neutral member
  sets and digests, equal counts, every difference root empty and every
  referenced K/D and candidate contract reconciliation terminal and current,
  both recomposition roots terminal `PASS`, and the exact current
  CompositionContractSetEnumeratorIndependenceAttestation terminal `PASS`.
  Only a passing attestation may enter candidate output, sealing, serving
  metadata or promotion.
- The scalar composition-contract-set digest is a field of that attestation,
  never an independently trusted object. The two roots derive directly from
  certified composition objects, never CandidateOutputMembership, output
  inventories, the final attestation or ServingContractMetadata. The final
  attestation references no output head, inventory, seal, manifest or later
  artefact. ServingContractMetadata carries only its exact ID and certified
  common digest; no serving role may read or hydrate a recomposition tree or
  composition contract payload. Production import independently rebuilds a
  bounded logical-member tree and compares it only at final parity.
- `derived_result_occurrence_id` derives from `(governed_deal_key,
  deal_admission_manifest_id, result_key, result_version, party_role,
  party_value, party_capacity, ordinal)`. A `DerivedResultRevision` then hashes that occurrence
  ID, exact CompositionScopeClosure ID, composer version and ordered
  component-slot keys, ClaimRevision IDs,
  RelationshipRevision IDs, `ResultInputLineage` digests and accepted component
  states, exact result completeness, market comparability, governed reason IDs,
  every intersecting final OpenWorldCandidateDisposition and reconciled
  SemanticImpactClosure ID and ordered applied post-scope CorrectionApplication
  IDs. Exact
  revisions collapse and conflicting revisions are quarantined.
  It does not store a corpus release or snapshot ID; later manifests select it.
- Each governed slot has
  `result_component_occurrence_id = H("RESULT_COMPONENT_OCCURRENCE/V2", schema,
  derived_result_occurrence_id, component_slot_key,
  governed_repeatable_ordinal)`. A singleton uses ordinal one. A repeatable
  ordinal is precomputed before extraction by the ResultDefinition's compiled
  total comparator over occurrence-independent member keys and source
  coordinates. Exact pre-ordinal duplicates collapse; an unresolved tie is
  quarantined. Value, revision, insertion, database, worker and run order cannot
  supply the ordinal. ExpectedOccurrenceSlot precomputes this exact ID. Using
  `component_slot_key`, not a reusable component-definition key, prevents two
  slots with the same definition from colliding. If the complete repeatable
  member universe or comparator cannot be resolved before scope freeze, the
  context is `BLOCKING_UNRESOLVED`; candidate values cannot discover its
  identity later.
- Each result component has one ordered `ResultInputLineage` payload. Its digest
  is a domain-separated hash over its schema version, result-component
  occurrence, component-slot key, ResultDefinition key and version, exact
  CompositionScopeClosure ID, exact
  ordered ExpectedResultInputLineageSlot IDs and their discharged entries,
  semantic-owner occurrence IDs, ClaimScopeClosure IDs, ClaimRevision IDs,
  RelationshipRevision IDs, relationship-definition and effect-schema versions,
  RelationshipEffectFieldUniverse IDs, selected state-branch constraint and
  complete field-value digests, effect-payload digests, source and target party and capacity, affected
  provision and component IDs, evidence-edge IDs and source actions. Ordering
  follows ResultDefinition slot order and then each input definition's compiled
  total comparator; undeclared duplicates are invalid. It is generated only
  from the selected canonical revisions and is not independently editable. A
  changed closure, relationship, effect, endpoint, party, condition, precedence
  rule or evidence reference changes the lineage digest even when the displayed
  value is textually identical.
- An immutable result-component revision hashes its occurrence ID, parent
  result revision, exact input revision IDs, ResultInputLineage digest,
  component state, canonical component value and ordered applied post-scope
  CorrectionApplication IDs. It also carries the parent result's exact
  completeness, comparability and governed reason IDs, so a component or child
  row cannot detach familiar values from an incomplete legal answer. The result keeps provision,
  component, claim-revision, relationship-revision, effect and evidence
  references. It has no fabricated source span and owns no copied source facts.
- Claim state, result completeness and market comparability are three independent
  typed fields. Claim state remains exactly `PRESENT`, `ABSENT`,
  `NOT_APPLICABLE`, `NOT_EXAMINED` or `FAILED`. Result completeness is exactly
  `COMPLETE`, `INCOMPLETE_NOVEL_SEMANTIC` or `BLOCKED`. Market comparability is
  exactly `COMPARABLE`, `REVIEWED_SOURCE_SPECIFIC`, `MISSING_BASIS`,
  `INCOMPATIBLE_BASIS` or `NOT_CERTIFIED`. A schema, composer, renderer, query,
  cache or aggregate may not derive one field from another or collapse any value
  to null, false, absence, empty output or generic “No market data”.
- `COMPLETE` requires every required component to have a ResultDefinition-
  accepted terminal state and requires every reconciled SemanticImpactClosure
  touching the result to be fully discharged by a mapped or adopted frozen
  contract item. `ABSENT` may complete a knowledge-qualifier component but cannot
  substitute for a required bring-down. `NOT_APPLICABLE` completes only where the
  component definition permits it. “Optional” governs which valid terminal
  states complete the legal answer; it never permits skipped examination.
- `INCOMPLETE_NOVEL_SEMANTIC` is a positive, release-certified statement about
  the affected result, not permission to omit work. It requires one or more final
  reviewed OpenWorldCandidateDispositions, their reconciled
  SemanticImpactClosures, exact affected component slots and a typed incomplete
  reason. A `NOT_EXAMINED` component may appear in its Review projection only for
  the exact governed `CONTRACT_EXPANSION_REEXAMINATION_PENDING` branch with a
  complete ApplicabilityReexaminationManifest. It cannot contribute a market
  observation, denominator, aggregate or absence proof. Any other expected
  `NOT_EXAMINED`, any `FAILED`, unresolved candidate kind, missing evidence,
  unresolved multiplicity or incomplete impact closure makes the affected result
  `BLOCKED` and keeps it outside active serving.
- Comparability is decided after completeness. Only `COMPLETE` plus
  `COMPARABLE` may enter a canonical market cohort. A complete source-specific
  item uses `REVIEWED_SOURCE_SPECIFIC`; an unresolved denominator or day-count
  basis uses `MISSING_BASIS` or `INCOMPATIBLE_BASIS`; an incomplete result or a
  contract version without complete applicability re-examination uses
  `NOT_CERTIFIED`. Each non-comparable value carries its exact governed reason and
  evidence. It cannot be restated as zero observations or absence.
- One final, release-certifiable incomplete or non-comparable result does not
  poison its DealSnapshot or siblings. The snapshot selects the exact
  `INCOMPLETE_NOVEL_SEMANTIC` revision and every complete independent revision.
  Review renders both. Corpus Context, Compare and Query suppress only canonical
  cohort membership for the affected closure and return its typed completeness
  and comparability reason; other provisions, results and market rows render and
  execute normally. A `BLOCKED` revision is retained only in the candidate
  staging graph for authenticated pre-publication review. Release certification
  rejects it and leaves the prior active release untouched.
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
  `CONTAINED_IN` proves geometry only. Claim-scope closure traverses
  `USES_DEFINITION` or another expressly permitted effect-bearing relationship;
  it never infers semantic inheritance from nesting.
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
- The transactional unit follows the dependency boundary: one scope-selecting
  `DEAL_SCOPE_RUN` dispatch atomically writes a deal's complete pre-extraction
  provisions, components, excerpts and scope objects. Its admission-only first
  action closes verified source identity before semantic work. Its two preflight
  review variants append only bounded content-addressed offline review or
  disposition objects, select no scope and advance no canonical currentness
  head. One
  `FAMILY_BUILD` atomically writes that
  deal-family's complete claims, relationships, evidence and results; and no
  partial family or deal is selectable until FINALISE_DEAL. A corpus-wide
  transaction is prohibited. The sole exception is the contract-bounded
  `MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` dispatch below, which atomically rebuilds one
  complete connected affected-subject component so neither side of a
  reassignment can become current alone.
- The only database entry point with canonical-object-table DML authority is the
  versioned `canonical_write` `SECURITY DEFINER` PostgreSQL RPC. Its generated
  operation schema permits `CONTRACT_FREEZE`, `INTAKE_CAPTURE`, `INTAKE_CUTOFF_BUILD`,
  `DEAL_SCOPE_RUN`, `CORPUS_SCOPE_FREEZE`, `CORRECTION_APPLY`, `DEAL_EXTRACTION_RUN`,
  `CANDIDATE_RELEASE_FREEZE`, `RELEASE_BUNDLE_CONTROL_BUILD` and
  `CERTIFIED_RELEASE_IMPORT_BATCH` only.
  All canonical tables deny direct `INSERT`, `UPDATE` and `DELETE` to
  application, migration, release-builder, serving and importer roles. Facts are
  append-only; correction and supersession append new governed objects.
- CanonicalContractBundle generates a closed `OperationActionRegistry`,
  `CanonicalPhysicalCarrierRegistry` and total
  `CanonicalWriterDispositionRegistry` before any writer SQL is generated. For
  every `(operation, action_variant, discriminator, write_phase, physical_carrier,
  logical_type, schema_version, DML_verb)` tuple the disposition registry has
  exactly one entry: `RELEASE_INPUT(input_kind_registry_id, kind_entry_id)`,
  `CANDIDATE_OUTPUT(candidate_output_kind_entry_id)`,
  `NAMED_CONTROL(control_class)`, `OPERATIONAL_AUDIT(audit_class)` or
  `PROHIBITED`. Each non-prohibited entry also fixes producer action, stable-key
  and canonical-payload-digest extractors, namespace, maximum rows and bytes,
  receipt policy, outbox policy, bundle disposition and import disposition.
  There is no wildcard, inferred carrier, caller-selected type, `OTHER` or
  unclassified physical write.
- `canonical_write(operation=CONTRACT_FREEZE)` has exactly one action,
  `INITIALISE_CANDIDATE_PROMOTION_FENCE`. In one serialisable transaction it
  installs the approved ContractFreezeAttestation, genesis CandidateInputHead,
  genesis AVAILABLE CandidatePromotionFence and one idempotent receipt.
  OperationActionRegistry, CanonicalPhysicalCarrierRegistry,
  CanonicalWriterDispositionRegistry and GeneratedLockPlanRegistry contain that
  exact action and no other contract-freeze writer. Split installation, direct
  DML and a second genesis write are prohibited.
- `ReleaseBundleControlPolicy` is a generated frozen contract object. Its ID
  hashes `RELEASE_BUNDLE_CONTROL_POLICY/V1`, schema, the exact five-action set,
  lifecycle and event schemas, failure-evidence variants, role and carrier
  registries, bounded partial-state inventory kind, spool-erasure protocol,
  transition table, row, byte and duration bounds and generated lock-plan key.
  `ReleaseBundleControlContext` hashes
  `RELEASE_BUNDLE_CONTROL_CONTEXT/V1`, schema, policy, production environment,
  frozen pair, candidate generation, CandidateReleaseFreezeAttestation,
  candidate object and blob projection roots, held promotion-fence version,
  PromotionEvidenceSlotRoot and the canonical request digest. Its mutable
  `ReleaseBundleControlHead` has only `OPEN`, `FINALISED` or `ABANDONED`,
  contiguous generation, current
  `ReleaseBundleControlEvent` and payload digest. The genesis event is
  `CONTEXT_OPENED`; terminal events are `CONTEXT_FINALISED` and
  `CONTEXT_ABANDONED`. A `ReleaseBundleControlReceipt` has only
  `PRECOMMIT_WALKERS`, `FINALISE_BUNDLE_CONTROLS` and
  `ABANDON_BUNDLE_CONTEXT` lifecycle variants and hashes variant, context,
  exact before-and-after head tuples, selected immutable action result,
  request digest, writer evidence and terminal disposition. An event hashes its
  immutable predecessors and result, never the later head or receipt.
- For `RELEASE_BUNDLE_CONTROL_BUILD`, OperationActionRegistry contains exactly
  five top-level actions: `PRECOMMIT_WALKERS`, `CLAIM_WALKER_ROLE`,
  `WRITE_WALKER_OUTPUT`, `FINALISE_BUNDLE_CONTROLS` and
  `ABANDON_BUNDLE_CONTEXT`. `PRECOMMIT_WALKERS` alone creates the context in
  `OPEN`, its reason-independent ReleaseBundleControlFailureEvidenceSlot in
  `EMPTY`, its genesis event and receipt, PromotionEvidenceSlotRoot and the
  bundle-enumerator independence attestation, atomically. No later action may
  initialise or replace that slot. `CLAIM_WALKER_ROLE` alone writes
  one fresh ROLE_LAUNCH proof and one run claim. `WRITE_WALKER_OUTPUT` alone
  stores the signed terminal spool commitment, claimed neutral tree nodes and
  terminal walker-output attestation and, only after that output commits, the
  signed-journal-backed success erasure receipt for that same role.
  `FINALISE_BUNDLE_CONTROLS/CONTROL_SET` alone closes all four success receipts
  into the `SUCCESS_PRE_FINALISATION` set and then commits the fixed
  ReleaseBundleWalkerSpoolCommitmentRoot, output-set attestation, governed member
  and support roots and reconciliations while the context remains `OPEN`. Only
  after those controls commit may the trust verifier issue the fresh
  CONTEXT_SEAL proof. `FINALISE_BUNDLE_CONTROLS/FINALISE_CONTEXT` then stores
  that proof and ReleaseBundleEnvelope, appends `CONTEXT_FINALISED`, compare-and-
  swaps the head to `FINALISED` and writes its lifecycle receipt in one
  serialisable transaction.
  `ABANDON_BUNDLE_CONTEXT` alone creates the failure and abandonment controls
  below, performs authorised failed-target erasure and closes the operational
  attempt audit. These remain exactly five top-level actions; every lifecycle,
  erasure and audit step is a closed subphase, never a sixth action. A missing
  action, wildcard action or extra top-level action blocks contract freeze and
  DML.
- Every ReleaseBundleWalkerRoleSlot, ROLE_LAUNCH proof, run claim,
  WalkerOutputSpoolCommitment, neutral node, output attestation, erasure
  receipt, erasure-receipt-set attestation, output set, root, reconciliation,
  envelope and action receipt binds the exact context ID and applicable exact
  head tuple. Claims, spool ingestion, terminal outputs, success erasure and
  finalisation require and lock the exact `OPEN` tuple. Failed-target erasure,
  abandoned receipt-set closure and attempt-audit finalisation instead require
  and lock the exact `ABANDONED` tuple plus the abandonment terminal and
  lifecycle receipt. An `OPEN` predicate cannot authorise an abandonment phase,
  and an `ABANDONED` predicate cannot authorise a success or finalisation phase.
  `FINALISED` and `ABANDONED` are absorbing and reject every later claim, tree
  batch, output or cross-context reference. `FINALISE_BUNDLE_CONTROLS/CONTROL_SET`
  first commits the complete `SUCCESS_PRE_FINALISATION` set and every immutable
  root through bounded idempotent transactions under the locked `OPEN` tuple.
  Its completion authorises issuance of the CONTEXT_SEAL proof.
  `FINALISE_BUNDLE_CONTROLS/FINALISE_CONTEXT` then revalidates those durable
  prerequisites and the proof under the same still-current `OPEN` tuple, locks
  and proves the ReleaseBundleControlFailureEvidenceSlot still `EMPTY` and, in
  its sole terminal transaction, writes the proof and envelope before
  `CONTEXT_FINALISED`, the head CAS and lifecycle receipt.
  Neither the envelope nor any earlier control hashes that later event, head or
  receipt, so successful finalisation is acyclic. The run claim, signed spool
  commitment, bounded content-addressed tree-batch tuple, terminal output
  attestation and erasure receipt remain their declared dispatch receipts; they
  are not extra `ReleaseBundleControlReceipt` variants.
- `ReleaseBundleControlFailureEvidence` is a closed tagged union:
  `WALKER_FAILED`, `WALKER_TIMEOUT`, `SPOOL_COMMITMENT_EXPIRED`,
  `TRUST_OR_KEY_REVOKED`, `DEPENDENCY_INVALIDATED` or
  `EXPLICIT_AUTHORISED_CANCELLATION`. Its reason-independent
  `ReleaseBundleControlFailureEvidenceSlot` is keyed only by context and has
  states `EMPTY` or `FIXED`; the selected reason is excluded from slot identity.
  `FAILURE_EVIDENCE` locks that slot and the exact OPEN head, compare-and-swaps
  the slot to FIXED and writes exactly one evidence object atomically.
  `FINALISE_CONTEXT` locks the same two authorities and requires the slot still
  EMPTY, so a committed failure intent and successful finalisation cannot
  coexist. The evidence hashes the context and OPEN head,
  triggering typed evidence, trusted time, policy bound and an exact
  pre-evidence partial-state digest computed set-wise over the then-present role
  state. That digest expressly excludes the failure-evidence object and every
  later abandonment control. After the evidence commits,
  `ABANDON_BUNDLE_CONTEXT/PARTIAL_STATE_TREE_BATCH` independently inventories
  every partial role slot, claim, trust proof, spool commitment, ingested node,
  output and control, including that already committed failure evidence,
  through the policy's bounded `BoundedInventoryTree`; omission, extra state or
  a still-live writer blocks abandonment. The evidence never hashes that later
  tree. The immutable
  `ReleaseBundleControlAbandonmentTerminal` hashes that complete root, failure
  evidence and exact FIXED failure-evidence-slot tuple, fixed empty unaccounted
  and live-writer roots and terminal
  `ABANDONED`. `ABANDON_CONTEXT` then performs one serialisable order:
  abandonment terminal, `CONTEXT_ABANDONED` event, `ABANDONED` head CAS and
  `ABANDON_BUNDLE_CONTEXT` lifecycle receipt. Exact retry returns that receipt;
  a different reason or partial-state root conflicts and writes nothing. No
  erasure begins before that transaction commits.
- `ReleaseBundleSpoolErasureReceipt` hashes
  `RELEASE_BUNDLE_SPOOL_ERASURE_RECEIPT/V2`, schema, context, role, run slot and
  claim, exact commitment or governed partial-stream target, chunk and byte
  counts, exactly one mode, exact mode authority, terminal
  `WalkerSpoolErasureJournalEntry` and `WalkerSpoolErasureEvidence` IDs and
  payload digests, writer evidence and terminal `PASS`. The modes are exactly
  `SUCCESS_AFTER_TERMINAL_OUTPUT`, whose authority is that role's committed
  terminal-PASS output attestation while the context remains `OPEN`, and
  `FAILED_AFTER_ABANDONMENT`, whose authority is the committed abandonment
  terminal, event, `ABANDONED` head and lifecycle receipt. The unique target
  slot permits one receipt across both modes. The receipt cannot exist until
  its evidence proves the exact target unreadable.
- `ReleaseBundleSpoolErasureReceiptSetAttestation` hashes
  `RELEASE_BUNDLE_SPOOL_ERASURE_RECEIPT_SET_ATTESTATION/V1`, schema, exact
  context ID and mode-required context tuple, variant, exact governed erasure-
  target universe, contract-ordered success and failed partitions and, for each
  target, role, run slot and claim, commitment or governed partial-stream
  identity, terminal-output state, chunk count, byte count and receipt ID and
  payload digest; cumulative chunks and bytes; exact mode-authority root; and
  fixed empty missing, extra, duplicate, overlap, wrong-target, wrong-role,
  wrong-mode, wrong-prerequisite, journal-gap, incomplete-journal, failed-
  evidence and still-readable roots. It has exactly two
  variants. `SUCCESS_PRE_FINALISATION` requires the context still `OPEN`, four
  `SUCCESS_AFTER_TERMINAL_OUTPUT` receipts and an empty failed partition, and is
  required before any bundle spool root, output-set, governed root,
  reconciliation or envelope. `ABANDONED_CONTEXT` requires the exact
  `ABANDONED` controls, derives its target universe from the abandonment
  terminal's independently closed partial-state inventory and partitions every
  present commitment or governed partial stream between success receipts
  committed before abandonment and `FAILED_AFTER_ABANDONMENT` receipts
  committed afterwards. An unopened role is proved absent by that terminal and
  is not fabricated as an erasure target. Thus a partially successful abandoned
  attempt retains its earlier success receipts and creates failure receipts only
  for the complementary targets; no present target may be erased twice or
  omitted. Failure,
  timeout, expiry or a coordinator request without the committed mode authority
  provides no erasure authority.
- CanonicalPhysicalCarrierRegistry and CanonicalWriterDispositionRegistry map
  only the context, event, receipt, head and failure-evidence-slot transitions,
  failure evidence,
  abandonment terminal, spool-erasure receipt and receipt-set attestation,
  generated independence
  attestation, run claim, neutral inventory node, ROLE_LAUNCH and CONTEXT_SEAL
  WalkerTrustStatusProof, WalkerOutputSpoolCommitment, walker output, output
  set, ReleaseBundleWalkerSpoolCommitmentRoot, member root, support root,
  reconciliation, PromotionEvidenceSlotRoot and ReleaseBundleEnvelope carriers
  to `NAMED_CONTROL(RELEASE_BUNDLE_CONTROL)`; every other carrier and DML verb
  is `PROHIBITED`. The closed dispatch grammar is
  `PRECOMMIT_WALKERS/NONE/{OPEN_CONTEXT|PRECOMMIT}`,
  `CLAIM_WALKER_ROLE/<required_role>/NONE`,
  `WRITE_WALKER_OUTPUT/<required_role>/{SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE}`,
  `FINALISE_BUNDLE_CONTROLS/NONE/{CONTROL_SET|FINALISE_CONTEXT}` and
  `ABANDON_BUNDLE_CONTEXT/NONE/{FAILURE_EVIDENCE|PARTIAL_STATE_TREE_BATCH|ABANDON_CONTEXT|FAILED_SPOOL_ERASURE|SPOOL_ERASURE_RECEIPT_SET|ATTEMPT_AUDIT_TREE_BATCH|ATTEMPT_AUDIT_TERMINAL}`.
  `required_role` is exactly one of the four bundle roles. Each complete tuple
  fixes execution class, its exact `OPEN` or `ABANDONED` context predicate,
  bounded rows and bytes,
  stable-key and payload-digest extractors, receipt policy,
  `NO_SERVING_GRANT`, structural bundle/import disposition and no outbox.
  `WRITE_WALKER_OUTPUT/TREE_BATCH` alone may ingest bounded tree batches after
  its commitment; only `TERMINAL_OUTPUT` may create that role's output; and only
  `SUCCESS_SPOOL_ERASURE` may select its output, invoke the stable erasure
  request and create its success receipt. `CONTROL_SET` first creates the
  `SUCCESS_PRE_FINALISATION` erasure set and only then the walker-commitment,
  output, member, support and reconciliation controls. The abandonment phases
  are strictly ordered as failure evidence, partial-state tree, abandonment
  terminal then `CONTEXT_ABANDONED` event then head CAS then lifecycle receipt,
  failed-target erasure receipts, `ABANDONED_CONTEXT` receipt set, attempt-audit
  tree and attempt-audit terminal. Success-erasure phases require `OPEN`; every
  phase after `ABANDON_CONTEXT` requires `ABANDONED` and the exact terminal and
  receipt. No phase may satisfy the other's predicate.
  Generated SQL, carrier projections and writer disposition must reproduce this
  exact five-action grammar before contract freeze.
- For `CERTIFIED_RELEASE_IMPORT_BATCH`, OperationActionRegistry contains
  exactly eight top-level actions: `OPEN_IMPORT`,
  `VERIFY_PRODUCTION_BLOB_AVAILABILITY`, `IMPORT_MEMBER_BATCH`,
  `BUILD_IMPORT_PARITY_BATCH`, `SEAL_IMPORT`,
  `BUILD_IMPORT_SEMANTIC_PARITY_BATCH`, `ATTEST_IMPORT` and `ABANDON_IMPORT`.
  `OPEN_IMPORT/NONE/OPEN_CONTEXT` alone creates the controller lease, genesis
  event, OPEN head, `ProductionImportFailureEvidenceSlot(EMPTY)` and action
  receipt atomically; that subphase is the slot's sole `INIT_EMPTY` producer.
  `IMPORT_MEMBER_BATCH`, `SEAL_IMPORT` and `ATTEST_IMPORT` retain their closed
  lifecycle grammars. `BUILD_IMPORT_PARITY_BATCH` has exactly
  `PRECOMMIT_WALKERS/NONE/NONE`,
  `CLAIM_WALKER_ROLE/<import_role>/NONE`,
  `WRITE_WALKER_OUTPUT/<import_role>/{SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE}`,
  `FINALISE_IMPORT_PARITY/NONE/{SPOOL_ERASURE_RECEIPT_SET|CONTROL_SET}` and
  `BUILD_PRESEAL_CONTROLS/NONE/{TREE_BATCH|TERMINAL_ROOTS}`. `import_role` is
  one of the six frozen import roles. `IMPORT_SUCCESS` erasure receipts follow
  each terminal output; their exact six-role receipt-set attestation precedes
  the import commitment root, output set, governed roots and reconciliations.
  `BUILD_IMPORT_SEMANTIC_PARITY_BATCH` has exactly
  `PRECOMMIT_ROLES/NONE/NONE`, `CLAIM_ROLE/<semantic_role>/NONE`,
  `WRITE_ROLE_OUTPUT/<semantic_role>/{SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE}`,
  `FINALISE_TWO_ROLE_SET/NONE/NONE`,
  `FINALISE_TERMINAL_SET/NONE/{SPOOL_ERASURE_RECEIPT_SET|CONTROL_SET}` and
  `ATTEST_PARITY/NONE/TERMINAL_ATTESTATION`. `semantic_role` is exactly one of
  the frozen expected, physical and reconciler roles. Expected and physical
  outputs precede their two-role set; only that set authorises the reconciler;
  all three `SEMANTIC_SUCCESS` erasure receipts and their set precede the
  terminal three-role output set; and a fresh CONTEXT_SEAL proof then precedes
  the terminal parity attestation. CanonicalPhysicalCarrierRegistry gives every
  semantic-parity carrier one exact physical key including terminal slot and,
  where applicable, role, claim or tree coordinates.
  CanonicalWriterDispositionRegistry assigns each complete tuple to
  `NAMED_CONTROL(PRODUCTION_IMPORT_SEMANTIC_PARITY)` with the exact receipt and
  no-outbox policy below; every omitted, wildcard, cross-role or differently
  ordered tuple is `PROHIBITED`. The three registries must generate the same
  role, carrier and dispatch sets before contract freeze.
  `ABANDON_IMPORT` is the single import-generation abandonment authority and
  has exactly
  `NONE/{FAILURE_EVIDENCE|PARTIAL_STATE_TREE_BATCH|ABANDON_CONTEXT|FAILED_SPOOL_ERASURE|SPOOL_ERASURE_RECEIPT_SET|ATTEMPT_AUDIT_TREE_BATCH|ATTEMPT_AUDIT_TERMINAL}`.
  Its FAILURE_EVIDENCE phase alone creates ProductionImportFailureEvidence,
  PARTIAL_STATE_TREE_BATCH alone closes the inventory, and ABANDON_CONTEXT alone
  creates `ProductionImportAbandonmentTerminal`, then the
  `ABANDONED` import event and head, released controller head and lifecycle
  receipt in that order; only afterwards may it create
  `IMPORT_GENERATION_ABANDONED` erasure receipts, their complete set and the
  production-attempt audit. It covers unfinished import and semantic-parity
  targets in the one generation and precludes a second semantic-specific
  abandonment action. Generated RPC dispatch,
  SQL branches and every registry projection must equal this exact seven-action
  top-level set and each action's complete closed subgrammar. An eighth action,
  an omitted action, a semantic-parity phase attached to another action or a
  lifecycle phase attached to `BUILD_IMPORT_SEMANTIC_PARITY_BATCH` blocks
  contract freeze and runtime DML.
- `ProductionImportFailureEvidence` is the closed typed result of
  `ABANDON_IMPORT/FAILURE_EVIDENCE`. Its variants are exactly
  `IMPORT_WALKER_FAILED`, `IMPORT_WALKER_TIMEOUT`,
  `SPOOL_COMMITMENT_EXPIRED`, `TRUST_OR_KEY_REVOKED`,
  `DEPENDENCY_INVALIDATED`, `SEMANTIC_PARITY_FAILED` and
  `EXPLICIT_AUTHORISED_CANCELLATION`. Its reason-independent
  `ProductionImportFailureEvidenceSlot` is keyed only by complete import context
  and has states `EMPTY` or `FIXED`; the reason is excluded from slot identity.
  FAILURE_EVIDENCE locks that slot, the exact non-terminal import head and
  leased controller head and atomically fixes the slot and writes exactly one
  evidence object. SEAL_IMPORT and ATTEST_IMPORT lock the same slot and require
  it EMPTY, so a committed abandonment intent cannot coexist with either
  success transition. Its ID hashes
  `PRODUCTION_IMPORT_FAILURE_EVIDENCE/V1`, schema, complete import context,
  exact non-terminal import-head and leased controller-head tuples, variant,
  triggering typed evidence, trusted time, policy bound and an exact pre-
  evidence partial-state digest computed set-wise over the then-present import
  and semantic role state. That digest excludes this evidence object and every
  later abandonment control. `PARTIAL_STATE_TREE_BATCH` runs only after the
  evidence commits, includes it in the complete bounded inventory and cannot
  make the evidence hash that later tree. An unknown or generic reason writes
  nothing. CanonicalPhysicalCarrierRegistry and
  CanonicalWriterDispositionRegistry map the slot's `INIT_EMPTY` transition only
  to `OPEN_IMPORT/NONE/OPEN_CONTEXT`, its `EMPTY -> FIXED` transition and evidence
  only to `ABANDON_IMPORT/NONE/FAILURE_EVIDENCE`, and the partial-state nodes,
  abandonment terminal, lifecycle controls, failure erasure receipts and set,
  attempt-audit nodes, roots, reconciliation and terminal only to their exact
  `ABANDON_IMPORT` subphases with no outbox or serving grant; every other
  producer or phase is `PROHIBITED`.
- `ProductionImportAbandonmentTerminal` hashes
  `PRODUCTION_IMPORT_ABANDONMENT_TERMINAL/V1`, schema, production environment,
  frozen pair, ReleaseBundleEnvelope, import generation, exact non-terminal
  import-head and leased controller-head tuples, exact
  FIXED ProductionImportFailureEvidenceSlot tuple and exact
  ProductionImportFailureEvidence ID and payload digest,
  complete bounded partial-state and erasure-target inventory roots, all import
  and semantic role slots, claims, commitments, ingested nodes, terminal
  outputs, success erasure receipts and controls present at that tip, and fixed
  empty unaccounted, unknown-target and live-writer roots. It precedes and is
  selected by the `ABANDONED` event, import-head CAS, controller release and
  lifecycle receipt and hashes none of those later objects. The same generation
  can have no second abandonment terminal.
- `ProductionWalkerSpoolErasureReceipt` hashes
  `PRODUCTION_WALKER_SPOOL_ERASURE_RECEIPT/V1`, schema, complete import context,
  target class, role, run slot and claim, exact commitment or governed partial-
  stream target, chunks and bytes, exactly one erasure mode, exact mode
  authority, terminal signed erasure journal and unreadability-evidence IDs and
  payload digests, writer evidence and terminal `PASS`. The modes are exactly
  `IMPORT_SUCCESS`, authorised only by that import role's terminal-PASS output
  while the import head remains `OPEN`; `SEMANTIC_SUCCESS`, authorised only by
  that semantic role's terminal-PASS output while the import head remains
  `SEALED`; and `IMPORT_GENERATION_ABANDONED`, authorised only by the committed
  ProductionImportAbandonmentTerminal, `ABANDONED` event and heads and lifecycle
  receipt. One target slot admits one receipt across all modes.
- `ProductionWalkerSpoolErasureReceiptSetAttestation` hashes
  `PRODUCTION_WALKER_SPOOL_ERASURE_RECEIPT_SET_ATTESTATION/V1`, schema, complete
  import context and mode-required import-head tuple, variant, exact governed
  erasure-target universe, ordered success and abandonment partitions and, for
  each target, target class, role, run slot and claim, commitment or governed
  partial-stream identity, terminal-output state, chunk count, byte count and
  receipt ID and payload digest; cumulative chunks and bytes; exact mode-
  authority root; and fixed empty missing, extra, duplicate, overlap, wrong-
  target, wrong-class, wrong-role, wrong-mode, wrong-prerequisite, journal-gap,
  incomplete-journal, failed-evidence and still-readable roots. `IMPORT_SUCCESS`
  requires the six import targets and six
  matching success receipts before any ProductionImportWalkerSpoolCommitmentRoot
  or import output set. `SEMANTIC_SUCCESS` requires the three semantic targets
  and three matching success receipts before any
  ProductionSemanticParitySpoolCommitmentRoot or terminal three-role set.
  `IMPORT_GENERATION_ABANDONED` derives its target universe only from the
  abandonment terminal's independently closed partial-state inventory and
  partitions it between previously committed `IMPORT_SUCCESS` or
  `SEMANTIC_SUCCESS` receipts and complementary post-abandonment receipts. A
  target never opened by the harness is proved absent by the terminal and is
  not fabricated as an erasure target. A present partial stream cannot be
  omitted, and a successful target cannot receive a second abandonment receipt.
- `AttemptAuditObjectRegistry` is a generated frozen object with exactly two
  entries: `RELEASE_BUNDLE_ABANDONED` and `PRODUCTION_IMPORT_ABANDONED`. Each
  entry fixes its source context and abandonment terminal schema, lifecycle and
  erasure-set prerequisites, complete required-object, coverage-projection and
  attempt-audit logical-row schemas, their three BoundedInventoryTree kinds and
  limits, stable-key and row-digest extractors, sole operation/action/subphases
  and unique terminal-slot key. An
  `AttemptAuditTerminalSlot` hashes `ATTEMPT_AUDIT_TERMINAL_SLOT/V1`, schema,
  registry entry, production environment and exact abandoned context or import
  generation. Its mutable consumption state is the sole exactly-once authority.
  `AttemptAuditRequiredObjectRoot` and
  `AttemptAuditCoverageProjectionRoot` each hash the exact registry entry,
  source abandonment terminal, their complete bounded tree root and count and
  fixed empty unknown, extra and duplicate roots. `AttemptAuditReconciliation`
  hashes both roots, the complete bounded audit-row tree root and count and fixed
  empty missing, extra, duplicate, conflicting, wrong-context, wrong-variant,
  uncovered-erasure, later-object and prohibited-authority roots.
  `AttemptAuditTerminal` hashes `ATTEMPT_AUDIT_TERMINAL/V1`, schema, exact slot,
  registry entry and source abandonment terminal, terminal lifecycle receipt,
  erasure receipt-set attestation, exact required-object root, coverage-
  projection root, complete bounded audit-row tree root and count,
  reconciliation, closed evidence-derived reason, canonical request digest and
  fixed empty missing, extra, duplicate, wrong-context, wrong-variant,
  unclosed-erasure and unresolved roots and terminal `AUDIT_CLOSED`.
- The two `ATTEMPT_AUDIT_TREE_BATCH` phases alone write bounded attempt-audit
  required-object, coverage-projection and audit-row tree nodes. The matching
  `ATTEMPT_AUDIT_TERMINAL` phase alone validates those complete trees, locks and
  consumes its slot, writes both terminal root wrappers, the reconciliation and
  the terminal atomically. CanonicalPhysicalCarrierRegistry and
  CanonicalWriterDispositionRegistry classify those nodes, roots,
  reconciliation, slot transition and terminal only as
  `OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)`, with no outbox or serving
  grant. They are explicitly excluded from every candidate, release-bundle,
  production-import, traceability, completion and serving inventory and cannot
  authorise finalisation, import, recovery or publication. GeneratedLockPlanRegistry
  includes each terminal slot and its source terminal in one order. Direct DML,
  a cross-kind carrier, an audit before the abandonment receipt and erasure set,
  a second terminal or any use of an audit object as release or trace evidence
  is `PROHIBITED`.
- The exact generated SQL DML-target set must equal the registry projection whose
  disposition is not `PROHIBITED`, and database grants and trigger targets must
  reproduce that equality. Logical kind registries are compiled first, the
  global disposition registry second and specialised writer projections last.
  `CutoffPreparationWriteDispositionRegistry` is exactly its cutoff-preparation
  projection; `CandidateOutputWriteDispositionRegistry` is exactly its
  candidate-output-preparation projection; `CorpusScopeInventoryKindRegistry`
  is its exact scope-release-input kind projection; and
  `CorpusReleaseInventoryKindRegistry` is its exact sealed-release-input kind
  projection. None is an independent authority or a list of what a release
  happens to select. Adding, removing or changing one RPC DML branch, carrier,
  discriminator, privilege or registry entry without regenerating every equal
  projection blocks contract freeze and runtime DML.
- Projection workers may write only generated serving and compatibility sinks.
  The Phase 9 activation and rollback RPCs may write only release-control and
  append-only event tables. None can write or transform canonical objects.
- Exact SourceContent and CanonicalTextContent payloads are uploaded first to a
  content-addressed, non-serving object namespace where overwrite and mutable
  generations are denied. A trusted verifier streams and hashes the stored bytes
  before creating an environment-local `BlobAvailabilityReceipt` for exact
  namespace, object generation, length and digest in state `AVAILABLE`.
  `canonical_write` locks that availability receipt and admits the reference in
  the applicable intake or deal transaction only when receipt, envelope and
  immutable generation agree.
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
- Candidate currentness is linearised by one append-only `CandidateInputEvent`
  chain and signed mutable singleton `CandidateInputHead`. An event has exactly
  one kind: `SCOPE_GENERATION_OPENED`, `SCOPE_GENERATION_FROZEN`,
  `SCOPE_GENERATION_ABANDONED`, `SCOPE_SUBJECT_ADVANCED`,
  `DEAL_EXTRACTION_GENERATION_OPENED`,
  `DEAL_EXTRACTION_GENERATION_FROZEN`,
  `DEAL_EXTRACTION_GENERATION_ABANDONED`, `SCOPE_CORRECTION_ADVANCED` or
  `POST_SCOPE_CORRECTION_ADVANCED`. Its ID hashes schema, exact predecessor or
  genesis, contiguous input generation, changed head or contract-bounded ordered
  changed-head set and complete before and after head tuples, exact immutable
  transition-payload or DealScopeRunManifest IDs, canonical request
  digest and terminal disposition. The later operation receipt may hash the
  event, never conversely. The
  mutable head stores only generation, current event ID and signature. The
  canonical transaction that changes any named scope, extraction or correction
  head also appends the event and compare-and-swaps CandidateInputHead. Every
  successful ordinary or multi-subject DEAL_SCOPE_RUN appends exactly one
  `SCOPE_SUBJECT_ADVANCED` event over its complete ordered subject-head changes
  and advances the input head. An individual FAMILY_BUILD or idempotent replay
  does not advance it. No candidate stage may infer currentness by timestamps, maximum IDs or an
  application-side scan. A new receipt above the selected intake cutoff belongs
  to the next release and does not invalidate current candidate input. Any
  change to a cutoff-selected receipt or dependency is instead detected by the
  locked processing-policy and revocation heads and fresh
  IntakeEligibilityRecheckAttestation; any scope, extraction-generation or
  correction-head change advances CandidateInputHead.
- Corrections have exactly one immutable stage, selected by the generated
  CorrectionSlotDefinition: `SCOPE_CORRECTION` or `POST_SCOPE_CORRECTION`. A
  correction that can change source admission, deal membership, semantic
  occurrence or classification, question applicability, relationship
  expectation, claim-scope closure, composition closure, an open-world
  candidate or kind supersession, source-role admission transition, primitive,
  final disposition, semantic-impact
  seed or closure, applicability re-examination or
  deal-local ExpectedOccurrenceSlot is scope-stage. A correction confined to an actual
  revision value or state, evidence selection or post-scope relationship effect
  is post-scope. Unknown or mixed-stage patches are blocking; no writer may
  downgrade one because its observed output happens not to change.
- Scope-stage corrections form an append-only `ScopeCorrectionEvent` chain with
  a singleton `ScopeCorrectionLedgerHead` and one
  `ScopeCorrectionSubjectHead` per governed subject and correction slot.
  Post-scope corrections analogously use `PostScopeCorrectionEvent`, a singleton
  `PostScopeCorrectionLedgerHead` and one `PostScopeCorrectionSubjectHead` per
  governed deal, family and correction slot. Each event hashes its exact
  predecessor heads, correction, passing CorrectionApprovalAttestation and
  CorrectionApplication and CorrectionApplicabilityProjection IDs, complete
  supersession result, canonical request digest and disposition. The later
  operation receipt hashes the event, never conversely. A correction grant
  compare-and-swaps all applicable heads and CandidateInputHead in one
  serialisable transaction. Conflicting successors, gaps, forks or a stage
  mismatch write nothing. Scope correction heads are captured by the next
  DealScopeRun and its scope slice. Post-scope correction heads are captured by
  the next deal-extraction generation and relevant family set only. A scope
  slice never contains a post-scope correction, and a family cannot reinterpret
  a frozen scope through one.
- CanonicalContractBundle generates one `GlobalMutableAuthorityRegistry`; prose
  is not lock authority. Its ID hashes
  `GLOBAL_MUTABLE_AUTHORITY_REGISTRY/V1`, schema,
  CanonicalBundleInputIdentity, the complete ordered authority entries, the
  dependency-edge root and fixed empty missing, extra, duplicate, unbacked and
  unordered roots. Each entry fixes authority code, physical relation and key
  schema, immutable value-tuple schema, predecessor and CAS rule, shared and
  exclusive lock semantics, canonical key comparator, maximum cardinality and
  every operation/action allowed to read or advance it. Bidirectional closure
  is mandatory: every mutable head, singleton, one-use slot, receipt-resolution
  authority and DML target appears exactly once in the registry, and every
  registry entry is backed by exactly one generated relation, constraint and
  writer path.
- That closure includes work authorisation; every WalkerTrustStatusHead;
  IntakeProcessingPolicyHead; accession and import keys; DealIdentitySeedSlot;
  receipt attempt,
  resolution and replacement heads; IntakeLedgerHead; IntakeRevocationHead;
  CutoffBuildHead and CutoffPreparationHead; BlobAvailabilityReceipt;
  CandidatePromotionFence; CandidateInputHead; ScopeBuildHead; scope and post-
  scope correction ledger and subject heads; ScopeSubjectHead; source-membership
  keys; DealExtractionBuildHead; FamilyBuildHead; CandidateBuildHead;
  CandidateOutputPreparationHead; ReleaseBundleControlHead and every
  ReleaseBundleWalkerRoleSlot, ReleaseBundleControlFailureEvidenceSlot, bundle
  spool-erasure journal tip and target-
  receipt slot; ProductionImportControllerHead,
  ProductionImportHead, ProductionImportFailureEvidenceSlot and every
  ProductionImportWalkerRoleSlot; every
  ProductionSemanticParityRunSlot and terminal slot; every production spool-
  erasure journal tip and target-receipt slot; every AttemptAuditTerminalSlot;
  DeploymentReadinessMirror;
  canonical release state; CanonicalCutoverGenesisHead;
  OngoingReleasePromotionHead;
  PostActivationControlHead, PostActivationControl action-idempotency slot and
  PostActivationPassCommitLease consumption or revocation slot;
  FailureRecoveryBranchSlot, FailureRecoveryBranchHead and historical-
  reactivation attempt slot; LegacyBaselineRestoration action ordinal and
  receipt-chain head; LegacyBaselineRestorationPostCommitHead and its action-
  idempotency slots; TraceabilityFailureTerminalSlot; and every
  CompletionTerminalPairAttempt and its disposition slot. The repository-native
  `ProgrammeStatusPublicationHead` Git ref is
  expressly outside this database authority registry and its generated SQL lock
  plans. Adding any later database mutable authority without regenerating this
  closure blocks contract freeze and DML.
- `ProgrammeStatusPublicationHead` is the signed singleton repository Git-ref
  pointer to the immutable programme-status event chain. Its committed payload
  contains production environment, contiguous generation, current status-event
  ID and payload digest and one frozen-policy state. Only the protected GitHub
  status-publisher action may compare-and-swap the ref; terminal `COMPLETE` is
  absorbing. It is not a database authority or SQL lock target and never enters
  a semantic, release or result ID except through an expressly named captured
  status tuple. Direct update, maximum-timestamp selection and a second
  completion event are prohibited.
- The same compilation creates `GeneratedLockPlanRegistry`. For every complete
  OperationActionRegistry dispatch, activation, rollback, readiness,
  post-activation, restoration, recovery, failure-terminal and database
  completion-terminal-pair action, every spool-erasure journal, receipt and
  receipt-set phase and both
  attempt-audit terminal actions, it fixes the exact authority-entry set, key extractor, lock mode,
  bounded key cardinality and one unique canonical topological order. The
  authority dependency graph plus the frozen unsigned-key comparator must yield
  that one order; a cycle, incomparable pair, alternative legal order, missing
  authority or extra lock blocks compilation. Generated SQL acquires locks only
  from that plan and in that order. Database grants, RPC branches and lock plans
  are checked for bidirectional equality, so a hand-written lock or a declared
  plan with no SQL consumer also blocks.
  Any earlier policy field called a `generated lock-plan key` is only the
  pair-independent lookup key derived from that policy's authored action tuple
  and the frozen key schema. It never hashes a GeneratedLockPlanRegistry ID,
  plan ID or plan payload; this later registry maps the earlier key to the
  completed authority set and order, so no policy-to-plan back edge exists.
- Raw receipt capture and mechanically blocking actions may skip authorities
  only where their generated plan says so; they may never invent a shorter
  order. Expensive enumeration, hashing, model work, external calls and tree
  generation occur before the first database lock. Any database transaction
  that can alter active exposure, including ordinary revocation and either
  containment COMPLETE action, must first install and acknowledge the external
  BLOCKED serving fence and drain the applicable leases. That acknowledged
  fence is a generated pre-lock barrier in its lock plan, not a database lock,
  and no such exposure-mutating transaction may begin before it or call the
  external control plane while holding a lock. The two containment-owned BEGIN
  actions are the sole database-before-external exceptions: their bounded
  database-only transactions may change only the applicable controller head,
  failure and tuple disposition and lease slot, never exposure, readiness or
  promotion. After BEGIN commits and releases its locks, the controller performs
  BLOCKED and drain; only then may COMPLETE acquire its exposure-mutating lock
  plan. The adopted ordinary-revocation order remains external-before-database.
- Every normative reference to a mutable head means its immutable value tuple,
  including generation, current event or transition ID and that payload digest,
  never the database row identity. A manifest may hash that captured tuple but
  never a future head, event, transition or receipt.
- Every corpus-sized inventory in this programme uses the generated
  `BoundedInventoryTree/V1` contract. Each registered inventory kind defines
  one complete canonical logical-row tuple; a leaf member is `(stable_key,
  row_digest)`, where `row_digest` domain-separately hashes every field of that
  tuple, including all destination, carrier, path, length and transport fields
  when applicable. A leaf hashes schema, domain and complete
  immutable context, inventory kind and version, deterministic leaf ordinal and
  half-open key boundaries, ordered members, exact count and duplicate proof.
  An internal node hashes the same
  context, level and boundaries, ordered child `(node_id, payload_digest,
  lower_bound, upper_bound, member_count, subtree_node_count)` tuples, aggregate
  member count, `subtree_node_count = 1 + sum(child subtree_node_count)` and exact
  partition proof. A leaf has subtree-node count one. CanonicalContractBundle fixes unsigned integer widths,
  maximum row bytes, leaf rows and bytes, internal fanout and node bytes and,
  separately for each inventory kind, maximum total members, nodes and height.
  Internal fanout is at least three.
  Contract compilation proves for every kind that the internal-node byte cap is
  at least the fixed header plus `fanout * maximum_serialised_child_tuple_bytes`,
  including maximum key-boundary bytes; an unproved or later wider child schema
  blocks contract freeze.
  An oversize row, arithmetic overflow or any exceeded maximum blocks before a
  node is written. Every leaf and internal node is therefore bounded;
  additional admitted members add leaves or logarithmic levels, never one wider
  root payload.

  Shape is canonical. Members are strictly ordered by the kind comparator and
  duplicate keys are invalid. Greedy leaf packing takes the longest next prefix
  satisfying both row and byte caps; every non-final leaf is full under that
  rule and only the final leaf may be underfilled. At each level with `N > F`
  children and fanout `F`, the builder creates exactly `ceil(N/F)` consecutive
  parent groups whose sizes differ by at most one, puts the larger groups first
  and gives every group between two and `F` same-level children. With `2 <= N <=
  F`, one root contains all children. A single child is promoted only when it is
  the entire level, so an internal root is never unary and no branch becomes
  ragged. Every internal node's children have the same level and all leaves have
  equal depth. The first lower boundary is the
  domain-separated `MIN_SENTINEL`, the final upper boundary is
  `MAX_SENTINEL`; interior shared boundaries are the first member key of the
  right leaf. Every member satisfies `lower_bound <= key < upper_bound`, and
  the kind comparator places MIN strictly below every valid member and MAX
  strictly above it; neither sentinel is a valid member key. Each child's upper
  boundary byte-equals the next child's lower boundary. Gaps,
  overlaps, repeated nodes, repeated child references, unreachable extra nodes,
  non-final underfill, alternate root collapse or unequal depth are invalid.
  A distinct domain-separated empty root represents zero members and zero
  nodes. A root reference is the fixed tuple `(top_node_id,
  top_node_payload_digest, member_count, node_count, tree_height,
  boundary_digest)` and never a flat list of all leaves. Traversal rejects a
  root node count above the registered cap before descent, validates every
  subtree count, and requires the visited reachable-node count to equal the root
  count. It also proves the member and height maxima before visiting children.
  Both independent enumerators reproduce
  every node, boundary and count; bundle and import parity include and verify
  every reachable intermediate node and reject any physical node outside that
  closure. Any later reference to bounded shards and a root means
  leaf shards plus this fixed-fanout hierarchy unless a stricter named contract
  is stated.
- CanonicalContractBundle generates exactly one
  `InventoryEnumeratorIndependenceAttestation(stage_code)` for each paired
  inventory stage `CORPUS_SCOPE`, `CORPUS_RELEASE_INPUT` and
  `CANDIDATE_OUTPUT`. Its ID hashes
  `INVENTORY_ENUMERATOR_INDEPENDENCE/V1`, schema, frozen pair, stage code, both
  enumerator roles, executable and configuration digests, complete transitive-
  dependency graphs, governed shared-primitive allowlist, exact empty prohibited
  code, query, view, cache, intermediate-row and output intersections, validator
  evidence and terminal `PASS` or `FAIL`. It hashes no enumerated row, tree,
  root, reconciliation or candidate value and therefore precedes both walkers.
  Each corresponding governed root and reconciliation binds its exact terminal-
  PASS attestation. Distinct role labels or prose assertions cannot substitute
  for it. For these paired stages, enumerator role, executable, configuration,
  run evidence and independence-attestation identity are excluded from every
  BoundedInventoryTree row digest, node ID, root reference and neutral content
  digest. Identical logical content may therefore deduplicate to the same
  neutral tree. Only the governed kind-root and root-set wrappers bind role and
  evidence; their IDs must differ.
- `canonical_write(operation=INTAKE_CAPTURE)` is a narrow, append-only operation
  with non-semantic intake actions. Cutoff preparation and freeze use the
  separate bounded `INTAKE_CUTOFF_BUILD` lifecycle below.
  `RECEIPT` runs after
  raw-envelope upload and byte verification but before unpacking, conversion,
  source-row creation or deal assignment. In one `SERIALIZABLE` transaction it
  locks the immutable accession or import key and `IntakeLedgerHead`, inserts
  exactly one SubmissionReceipt and raw-envelope reference, appends its ledger
  event, advances `intake_generation` and commits. It does not require or select
  a legal-semantic contract pair. The ingress never acknowledges acceptance
  until this commit; a transport retry must reuse the same accession or import
  key and payload digest. After fleet admission, all readers complete and the
  proposed attempt payload is hashed without holding a database head lock.
  `ATTEMPT_AND_RESOLVE` then enters one brief commit transaction. A PASS first
  locks and revalidates the work-authorisation row, then the exact current
  IntakeProcessingPolicyHead. A mechanically blocking result starts at the
  policy head and carries the explicit no-authorisation marker. It then locks
  that receipt's attempt and resolution heads and every replacement or
  exact-duplicate target receipt head in canonical receipt order,
  IntakeLedgerHead and required blob-availability rows in its generated lock-plan order and
  atomically inserts the complete bottom-up ArchiveAttemptNode set, then one
  IntakeProcessingAttempt selecting its root-node set, then its `PASS` or
  blocking IntakeResolution and ledger event in that acyclic order. Both success
  and failure retain every completed or partial node named by the attempt. A pass
  also creates the exact SubmissionExpansionManifest, SourceContent, source
  occurrences and IntakeUniverseManifest; a failure creates none of those but
  retains bounded diagnostics. A PASS request must carry and revalidate the
  exact frozen pair, IntakeDispositionPolicy object digest, status digest and
  authorisation
  generation; a mechanically blocking request carries the explicit no-eligibility
  marker. `REVIEWED_RESOLUTION` appends a governed
  replacement, rejection, out-of-scope or revocation resolution and any
  ReceiptReplacementLink without creating a semantic or deal object. Every
  eligibility-granting reviewed request locks authorisation, current processing
  policy and all primary, replacement or exact-duplicate dependency receipt
  heads and revalidates their current states before DML. A revocation instead
  first uses ReleaseIntakeDependencyProjection to identify every pending or
  active dependant. If one exists, or the projection is unavailable, it blocks
  and acknowledges ServingFenceVersion before entering the database. The
  transaction then locks and advances IntakeRevocationHead, revokes any held
  CandidatePromotionFence and readiness version and atomically sets active
  `exposure_enabled=false` where affected. It may use only the narrow fail-closed
  emergency authority. No READY_CANONICAL fence may be published until a new cutoff,
  candidate and activation certify the replacement state. Each
  action advances the global ledger and has a distinct idempotency scope. Exact
  replay returns the original operation receipt; changed parser, policy,
  configuration or output creates a successor attempt, while idempotency-key
  reuse with different input fails. No action mutates an earlier intake object.
- `canonical_write(operation=INTAKE_CUTOFF_BUILD)` has only
  `OPEN_GENERATION`, bounded `PREPARE_CUTOFF_BATCH`, `SEAL_PREPARE`,
  `CUTOFF_FREEZE` and `ABANDON_GENERATION`. `CutoffBuildHead` stores contiguous
  cutoff-build generation, `OPEN`, `PREPARED`, `FROZEN` or `ABANDONED` and exact
  immutable CutoffBuildTransition ID. Its OPEN transition hashes frozen pair,
  proposed intake cutoff generation, exact captured IntakeProcessingPolicyHead,
  IntakeLedgerHead and IntakeRevocationHead tuples, authorisation, deadline and
  builder contract. PREPARED hashes its predecessor, CutoffPreparationSeal,
  exact SEALED CutoffPreparationHead tuple and terminal PREPARATION_SEALED
  receipt. FROZEN hashes PREPARED and IntakeCutoffAttestation. ABANDONED hashes
  its non-terminal predecessor, closed reason, exact ABANDONED
  CutoffPreparationHead tuple and terminal PREPARATION_ABANDONED receipt.
  Every named reference means its exact ID and canonical payload digest.
  Transition precedes head CAS,
  which precedes CutoffBuildTransitionReceipt.
- CanonicalContractBundle generates a fixed `CutoffPreparationKindRegistry`
  containing exactly LedgerCutoffStateManifest,
  IndependentCutoffStateManifest, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and
  IntakeEligibilityDependencyManifest. Every entry fixes its stable-key and
  payload-digest rules and a contract-fixed ordered set of named
  BoundedInventoryTree root slots, including the explicit empty-root rule for
  each slot. A separate total
  `CutoffPreparationWriteDispositionRegistry` classifies every physical carrier
  in the cutoff-preparation namespace, across bounded preparation, sealing and
  abandonment, as either
  `PREPARED_CUTOFF_PAYLOAD(exact kind entry)` or one named
  `CUTOFF_CONTROL_ARTEFACT` class for BoundedInventoryTree nodes,
  CutoffPreparationMembership, CutoffPreparationBatchManifest, preparation
  event, head, receipt, root set, reconciliation, control-receipt tree,
  CutoffPreparationControlReceiptReconciliation or seal.
  CutoffBuild transitions, heads and receipts, the initial recheck and
  IntakeCutoffAttestation belong to the separately closed build/freeze writer
  schema and cannot appear in this namespace. No carrier is both, and unknown, duplicate or
  unclassified write targets fail contract freeze and DML.
- A `CutoffPreparationMembership` key hashes schema, cutoff-build generation,
  exact kind-registry entry, stable prepared-payload ID and a generated member
  role of either `TOP_LEVEL_PAYLOAD` or `NAMED_ROOT_SLOT(exact slot key)`.
  Its payload repeats that key and carries the canonical payload or root-
  reference digest. A unique constraint on generation, kind and member key
  permits exact replay and rejects a conflicting payload. A
  `CutoffPreparationBatchManifest` hashes schema, frozen pair, cutoff-build
  generation, proposed cutoff and captured global-head tuples, exact expected
  preparation-head tuple, canonical request digest, complete ordered changed
  membership tuples, deterministic range and bound evidence, producer
  executable and configuration digests and terminal `PASS`. Its later append
  event, head tuple and receipt are forbidden identity inputs.
- `CutoffPreparationHead` is keyed by cutoff-build generation and contains only
  `OPEN`, `SEALED` or `ABANDONED`, contiguous sequence, current
  CutoffPreparationEvent or genesis and payload digest. A
  `PAYLOAD_APPENDED` event hashes schema, frozen pair, exact OPEN build
  transition, predecessor head, CutoffPreparationBatchManifest, changed
  prepared kinds and request digest. `PREPARATION_SEALED` hashes
  CutoffPreparationSeal; `PREPARATION_ABANDONED` hashes the closed reason and
  expected CutoffBuildHead. Each non-genesis event has exactly one later
  CutoffPreparationReceipt hashing its event, exact before-and-after preparation
  heads, action payload, current pre-transition CutoffBuildHead, request and
  writer evidence. No event or prepared payload hashes its later head,
  transition or receipt. Genesis is `OPEN`; PAYLOAD_APPENDED preserves `OPEN`;
  PREPARATION_SEALED permits exactly one `OPEN -> SEALED`;
  PREPARATION_ABANDONED permits exactly one `OPEN|SEALED -> ABANDONED`; and a
  SEALED or ABANDONED head accepts no payload append. A conflicting predecessor,
  gap, fork or second terminal event writes nothing.
- `OPEN_GENERATION` locks authorisation, current IntakeProcessingPolicyHead,
  IntakeLedgerHead, IntakeRevocationHead and CutoffBuildHead, captures those
  exact tuples and proposed cutoff, writes OPEN transition, build-head CAS,
  genesis OPEN CutoffPreparationHead and transition receipt in one fixed-size
  transaction. `PREPARE_CUTOFF_BATCH` has isolated
  `MATERIALISE_CUTOFF_PAYLOAD_BATCH`, `BUILD_CUTOFF_INVENTORY_BATCH` and
  `BUILD_CUTOFF_CONTROL_RECEIPT_TREE_BATCH` variants. Each computes outside
  locks and writes at most the contract-fixed rows and bytes. Only
  MATERIALISE_CUTOFF_PAYLOAD_BATCH may create prepared-payload tree nodes or a
  completed top-level prepared payload and membership. It then writes one batch
  manifest, appends one PAYLOAD_APPENDED event, compare-and-swaps the exact OPEN
  CutoffPreparationHead and writes its receipt. The two builder variants capture
  one exact OPEN preparation-head tuple and may write only inaccessible root-
  set, reconciliation or control-receipt tree controls. They do not create a
  prepared payload, membership or event and do not advance the head they
  certify. This prevents a receipt tree from recursively creating another
  receipt that it must contain. Every variant locks and revalidates the exact
  OPEN CutoffBuildHead and captured preparation head before its bounded DML;
  SEAL_PREPARE later requires that same captured head. Exact replay returns the
  existing content-addressed result; a changed payload at the same stable key
  writes nothing.
- The ledger and independent cutoff implementations first create their disjoint
  manifests. The registered third reconciler then creates the independence and
  reconciliation objects, after which the governance and eligibility walkers
  create the two remaining fixed kinds in dependency order. Two further
  independent closure walkers, neither of which reads the other's code, views,
  memberships or tree rows, enumerate all six completed kind payloads and every
  registered named root slot over the exact captured prefix. Each creates one fixed-size
  `CutoffPreparedRootSet` containing one entry per fixed registry kind with
  `(kind, stable_id, canonical_payload_digest, contract-ordered named root-slot
  references)`. Every registry-defined slot is present exactly once and uses an
  explicit empty root where appropriate; neither entry nor root set has corpus-
  variable cardinality. `CutoffPreparedReconciliation` hashes
  both root sets, per-kind root and payload equality and empty missing, extra,
  duplicate and conflicting-key sets. Two independent walkers also build and
  reconcile BoundedInventoryTrees over every PAYLOAD_APPENDED
  CutoffPreparationReceipt reachable from the captured preparation-head tip.
  `CutoffPreparationControlReceiptReconciliation` hashes both fixed tree roots,
  their equal neutral content digest and fixed empty missing, extra, duplicate,
  orphan-event and wrong-head difference roots.
  `CutoffPreparationSeal` hashes schema, frozen pair, build generation, proposed
  cutoff and captured global-head tuples, fixed kind and write-disposition
  registry IDs, captured OPEN preparation-head tuple, both prepared root sets,
  CutoffPreparedReconciliation, both control-receipt tree roots and exact
  CutoffPreparationControlReceiptReconciliation, writer and configuration
  digests and terminal `PASS`.
- `SEAL_PREPARE` locks the exact OPEN CutoffBuildHead and captured OPEN
  CutoffPreparationHead, verifies only those fixed root references,
  reconciliations and seal inputs, writes CutoffPreparationSeal, appends
  PREPARATION_SEALED, compare-and-swaps the preparation head to `SEALED`, writes
  its CutoffPreparationReceipt, writes PREPARED CutoffBuildTransition over that
  receipt and sealed head, compare-and-swaps CutoffBuildHead and writes the
  transition receipt. Corpus growth changes only bounded tree nodes and prepare
  batches, never this transaction's locks, rows or bytes.
- `CUTOFF_FREEZE` accepts the exact frozen pair, programme-status digest and
  prepared build, locks the canonical work-authorisation row, current
  IntakeProcessingPolicyHead, IntakeLedgerHead, IntakeRevocationHead,
  CutoffBuildHead and sealed CutoffPreparationHead and requires every current
  global-head tuple to equal OPEN's captured tuple. It validates only the two
  fixed CutoffPreparedRootSets, their reconciliation, control-receipt roots,
  CutoffPreparationControlReceiptReconciliation, CutoffPreparationSeal and
  PREPARED transition and receipt, creates one fresh
  `INITIAL_CUTOFF_FREEZE` IntakeEligibilityRecheckAttestation, writes one
  IntakeCutoffAttestation, the
  FROZEN CutoffBuildTransition, build-head CAS and transition receipt in the same
  fixed-size `SERIALIZABLE` transaction. The cutoff attestation selects the
  PREPARED transition and receipt, sealed preparation head and terminal receipt,
  initial recheck, prepared root sets and seal and hashes no later FROZEN
  transition or receipt. It appends no
  IntakeLedgerEvent and advances neither intake head. It cannot add, repair or
  dispose of an intake entry. A concurrent capture, attempt, resolution, policy
  change or revocation serialises before the freeze and makes the captured heads
  stale, or after the frozen linearisation point at a higher generation. If an
  unresolved capture commits first, freeze fails with zero attestation DML.
- `ABANDON_GENERATION` locks the expected non-terminal CutoffBuildHead and, when
  present, CutoffPreparationHead. It appends PREPARATION_ABANDONED, moves the
  preparation head to `ABANDONED`, writes its receipt, then writes the ABANDONED
  build transition, build-head CAS and transition receipt. Prepared payloads
  remain immutable and inaccessible. A higher build is required; no abandoned
  object may enter a cutoff.
- `canonical_write(operation=DEAL_SCOPE_RUN)` has exactly
  `PREPARE_SOURCE_ADMISSION`, `MATERIALISE_OPEN_WORLD_REVIEW`,
  `RECORD_OPEN_WORLD_DISPOSITIONS`, `MATERIALISE_SCOPE`,
  and `CERTIFY_SCOPE_CARRY_FORWARD`. This is the complete five-action set.
  `MATERIALISE_SCOPE` has exactly two mechanically
  derived discriminators, `SINGLE_SUBJECT` and
  `MULTI_SUBJECT_CORRECTION`; the other four actions use their declared closed
  non-scope discriminator and no second materialisation action exists.
  `PREPARE_SOURCE_ADMISSION` is the
  mandatory first action for each source subject. It consumes the exact cutoff,
  frozen pair, programme-status and authorisation generation, source occurrence,
  immutable source and blob-availability inputs, proposed source admission and
  exact DealIdentityManifest, its registered issuer authority or exact passing
  DealIdentityApprovalAttestation, or `NON_DEAL_SUBJECT` marker and idempotency
  key. In
  one bounded serialisable transaction it locks the authorisation row, current
  IntakeProcessingPolicyHead, IntakeRevocationHead and exact blob-availability
  receipts, revalidates the cutoff and source chain, and may write or select only
  CanonicalTextContent and occurrence, ImmutableSourceDocument,
  CanonicalTextVerificationManifest, any required
  SourceAdmissionApprovalAttestation, terminal SourceAdmissionManifest, exact
  validated DealIdentityManifest and its seed-authority evidence or marker and
  one SourceAdmissionPreparationReceipt. It
  creates no semantic envelope, inference transcript, reviewed payload, graph,
  candidate, disposition, deal-document or deal-admission manifest, structure,
  impact, applicability, scope, candidate-input event or serving row. The
  receipt is its sole operation receipt and it advances no scope or candidate
  head. Exact replay returns the same receipt; a stale head, second slot payload
  or different immutable output writes nothing.
  The next two variants consume the exact passing
  SourceAdmissionPreparationReceipt, exact cutoff,
  frozen pair, programme-status and authorisation generation, immutable source
  subject and idempotency key but neither select nor advance a scope generation.
  `MATERIALISE_OPEN_WORLD_REVIEW` may write only content-addressed
  SemanticExtractionInputEnvelope, SemanticInferenceTranscript,
  ReviewedInferencePayload, ValidatedSemanticGraph, open-world candidate,
  occurrence, candidate-supersession, kind-supersession,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot,
  OpenWorldCandidateChainReconciliation, evidence-closure, primitive,
  OpenWorldPrimitiveCollectionRoot and optional similarity-proposal
  objects into the offline review namespace. It may preserve unresolved
  candidates, but cannot write a final
  disposition, canonical occurrence, scope member, candidate-release member or
  serving row. The offline reviewer renders `ValidatedSemanticGraph` and its
  candidates through an exhaustive non-persisting view; there is no separate
  writable review-row carrier. `RECORD_OPEN_WORLD_DISPOSITIONS` may append only the exact final
  reviewed dispositions, source-specific publication selections for
  `REVIEWED_SOURCE_SPECIFIC` dispositions, both independent impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation, reconciled
  SemanticImpactClosures, disposition manifest and OpenWorldReviewQueueRoot. It
  cannot alter a candidate, primitive, mapping or contract key. Both variants are
  receipt-required, have no serving grant and create no CandidateInputEvent.
  For a pre-admission source-role occurrence, this action may record only its
  directly reviewed admission-decision disposition after predecessor evidence
  closure, primitive collection and signed source-specific publication
  selection are complete. That selection binds the neutral legal-semantic body
  and predecessor occurrence, not a future admitted ID. It cannot create an impact
  walker, impact closure, disposition manifest, applicability object, admitted
  occurrence, admitted evidence or primitive body, admission transition or
  carry-forward disposition before the exact DealAdmissionManifest exists.
  Neither review action may rerun a model while validating a stored graph. The
  selected graph is deterministically reproduced only from the receipt-bound
  SemanticExtractionInputEnvelope, exact ReviewedInferencePayload and frozen
  SemanticGraphNormaliserDefinition.
  The offline reviewer may render recognised graph rows and the explicit
  unresolved placeholder independently, so one unfamiliar proposition cannot
  crash or hide the other extracted provisions before corpus publication.
- The generated writer-disposition projection classifies
  SourceAdmissionPreparationReceipt and every admission-only object selected by
  it as `RELEASE_INPUT`, with `PREPARE_SOURCE_ADMISSION` as sole producer,
  `SOURCE_ADMISSION_PREPARATION_RECEIPT_IS_RECEIPT`, no outbox and no serving
  grant. Every preflight
  extraction-envelope, inference-transcript, reviewed-inference-payload,
  validated-graph, candidate,
  candidate-supersession, kind-supersession, candidate-audit-chain root,
  effective-occurrence root, candidate-chain reconciliation, evidence-closure,
  primitive and primitive-collection carrier is classified as
  `OPERATIONAL_AUDIT(OFFLINE_SEMANTIC_REVIEW)`. The exact scope-selecting
  dispatch revalidates and writes or selects digest-identical canonical carriers
  under separate `RELEASE_INPUT` tuples; preflight storage confers no membership
  and is never a release source by location. Preflight disposition, impact-
  walker, impact-closure and disposition-manifest tuples are also
  `OPERATIONAL_AUDIT(OFFLINE_SEMANTIC_REVIEW)`; MATERIALISE_SCOPE independently
  revalidates them into the canonical carrier. A source-role admission-transition
  carrier is `RELEASE_INPUT` only when the applicable scope-selecting action
  selects the exact DealAdmissionManifest; it is never an offline-review carrier. Final-disposition and impact
  carriers are likewise `RELEASE_INPUT` only when selected by their declared
  action. ApplicabilityEligibleMemberKindProducerRegistry,
  ApplicabilityReexaminationRequirementDefinition and
  ApplicabilityReexaminationRequirementSetRoot are generated frozen contract
  members. ApplicabilityReexaminationRequirement instances are `RELEASE_INPUT`
  only from `CORPUS_SCOPE_FREEZE/OPEN_GENERATION`, under their sole
  `SCOPE_RELEASE_INPUT(APPLICABILITY_REEXAMINATION_REQUIREMENT)` carrier and
  opening-transition receipt. ApplicabilityReexaminationEntry and Slice
  carriers bind the exact frozen pair, instance and registry entry and are
  `RELEASE_INPUT` only
  from the sole action assigned to their exact member kind by
  ApplicabilityEligibleMemberKindProducerRegistry:
  `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/SINGLE_SUBJECT` or
  `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION`, as mechanically
  required, for scope/source-admission kinds, or
  `DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE` for deal-family kinds. Each
  scope Entry and Slice has a receipt policy requiring the later
  DealScopeRunReceipt to select it and bind the same discriminator and per-kind
  creation slot. The separate aggregate `ScopeSubjectApplicabilityRoot` carrier
  has the same later-receipt policy, consumes the complete applicable
  scope/source-admission registry-entry set and uses its one aggregate creation
  slot. It is `RELEASE_INPUT` only from the exact
  scope-materialisation dispatch; carry-forward may only select a byte-identical
  existing root. No generic
  scope, extraction, correction or carry-forward tuple overlaps that authority.
  Global applicability tree nodes, roots, independence attestation,
  reconciliation and the one candidate-wide ApplicabilityReexaminationManifest
  are separate `CANDIDATE_RELEASE_FREEZE/PREPARE_INPUT_BATCH`
  `NAMED_CONTROL(APPLICABILITY_REEXAMINATION)` dispatch tuples.
  Their closed discriminator is
  `APPLICABILITY_REEXAMINATION/{ENUMERATOR_A_TREE_BATCH|ENUMERATOR_A_TERMINAL_ROOT|ENUMERATOR_B_TREE_BATCH|ENUMERATOR_B_TERMINAL_ROOT|INDEPENDENCE|TERMINAL_RECONCILIATION|TERMINAL_MANIFEST}`.
  The two terminal-root phases must commit before `INDEPENDENCE`; only
  `INDEPENDENCE` may create the independence attestation; only
  `TERMINAL_RECONCILIATION` may create the reconciliation and creates no
  manifest; and only `TERMINAL_MANIFEST` may create the manifest after selecting
  that reconciliation and creates no reconciliation. All phases have execution
  class `CONTENT_ADDRESSED_CONTROL_BUILDER`, no outbox and bounded exact result
  tuples. Tree and root batches and `TERMINAL_MANIFEST` have `NO_RECEIPT`;
  `INDEPENDENCE` has `ATTESTATION_IS_RECEIPT`; and
  `TERMINAL_RECONCILIATION` has `TERMINAL_RECONCILIATION_IS_RECEIPT`.
  The separate closed
  `METRIC_APPLICABILITY_REQUIREMENT_PROJECTION/{ENTRY_BATCH|TERMINAL_SET}`
  discriminator uses only
  `NAMED_CONTROL(METRIC_APPLICABILITY_REQUIREMENT_PROJECTION)` after the
  terminal manifest. CandidateInputSeal authenticates, in dependency order, the
  sealed release-input roots, both applicability roots, independence
  attestation, reconciliation, manifest, all projection entries and terminal
  projection set. No
  phase may create a candidate output or advance a head. A non-empty unresolved review-queue root and every similarity-
  proposal carrier are `OPERATIONAL_AUDIT(OFFLINE_SEMANTIC_REVIEW)` with no
  bundle, import or serving disposition; the separately discriminated exact
  empty OpenWorldReviewQueueRoot selected by MATERIALISE_SCOPE is
  `RELEASE_INPUT`. Reviewed source-specific and certified incomplete Review-row
  projections are concrete `CANDIDATE_OUTPUT` kinds. Unknown open-world carrier,
  discriminator, schema or attempted serving projection is `PROHIBITED`.
- The three scope-selecting dispatch forms,
  `MATERIALISE_SCOPE/SINGLE_SUBJECT`,
  `MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` and
  `CERTIFY_SCOPE_CARRY_FORWARD`, consume the exact cutoff, frozen pair,
  programme-status and authorisation generation, open scope-build generation,
  both independent correction-applicability enumerator outputs and proposed
  reconciled CorrectionApplicabilitySlice payload, expected prior subject-head
  set and idempotency key. The writer computes the proposed slice without
  DML, then locks the
  authorisation row, current IntakeProcessingPolicyHead, IntakeRevocationHead,
  CandidatePromotionFence, CandidateInputHead, then the singleton ScopeBuildHead,
  exact ScopeCorrectionLedgerHead and
  every applicability-slice-selected ScopeCorrectionSubjectHead, then the exact
  complete requested governed-deal and non-deal ScopeSubjectHeads and all affected
  source-membership keys in canonical order.
  It requires the promotion fence to remain `AVAILABLE`; `HELD` or `REVOKED`
  fails immediately without waiting or DML. It revalidates the complete enumerator outputs, proposed slice and all captured
  heads, binds a fresh IntakeEligibilityRecheckAttestation and only then creates
  or selects the exact slice before corrected-object DML.
  `MATERIALISE_SCOPE` must consume and select every exact
  SourceAdmissionPreparationReceipt and its admission-only object chain; it
  cannot create, replace or amend any member of that chain. It may write or
  select only digest-identical canonical carriers for
  SemanticExtractionInputEnvelope, SemanticInferenceTranscript,
  ReviewedInferencePayload, ValidatedSemanticGraph, both deal-document
  projections and reconciliation, structure, atoms,
  PotentialDependencyUniverse, independent and ordinary base subjects and
  catalogue-blind legal-dimension discovery, independent dimension mapping,
  every selected OpenWorldSemanticCandidate and occurrence, current
  OpenWorldCandidateSupersession and OpenWorldCandidateKindSupersession where
  applicable, every required OpenWorldCandidateAdmissionTransition and its
  transition-bound pre-admission and carried-forward admitted dispositions,
  OpenWorldCandidateAuditChainRoot,
  OpenWorldEffectiveOccurrenceRoot, OpenWorldCandidateChainReconciliation,
  evidence closure,
  primitive observation and relationship, OpenWorldPrimitiveCollectionRoot,
  final candidate disposition,
  every effective ReviewedSourceSpecificPublicationDecision,
  OpenWorldCandidateDispositionManifest, both impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation, reconciled SemanticImpactClosure,
  applicable post-freeze ApplicabilityReexaminationRequirement instances
  already created by the scope-generation opening action, and only the source-
  backed ApplicabilityReexaminationEntries and bounded local
  ApplicabilityReexaminationSlices whose scope/source-admission member kinds the
  ApplicabilityEligibleMemberKindProducerRegistry assigns to MATERIALISE_SCOPE,
  plus the exact empty
  OpenWorldReviewQueueRoot,
  source-specific semantic-question universes, base, question-universe,
  applicability and slot reconciliations, discovery, semantic challenge, expectations,
  every registered stage's SemanticComputationInputEnvelope,
  SemanticComputationPayload, review envelope and disposition,
  NonSemanticPayloadAttestation, semantic and governed IDs,
  GovernedSemanticRecord mapping and NeutralStageProjection, every applicable
  SOURCE_BUILD SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot,
  RelationshipEffectFieldUniverse reference, both path-specific
  RelationshipEffectConstraint sets and their exact set roots and
  relationship-semantic reconciliation,
  ClaimScopeClosures, deal-local composition children, shards, roots,
  reconciliations and closures, every deal-local ExpectedOccurrenceSlot,
  every deal-local ExpectedResultInputLineageSlot, the exact selected
  scope-stage CorrectionApprovalAttestations, CorrectionApplications and
  CorrectionApplicabilityProjections that change those objects, the exact
  reconciled CorrectionApplicabilitySlice, their exact
  declared corrected outputs, CorrectionDischarges, CorrectionDischargeMap and
  reviewed non-deal dispositions.
  Within that list, a requirement instance is selection-only. Each
  `MATERIALISE_SCOPE` discriminator may originate only the registry-assigned
  scope Entry and Slice members under their per-kind creation slots and the one
  aggregate-contract-bound `ScopeSubjectApplicabilityRoot` under its subject
  root slot; it writes
  nothing at the requirement carrier. `CERTIFY_SCOPE_CARRY_FORWARD`,
  `CORRECTION_APPLY` and every candidate action may select exact prior Entries
  and Slices and a byte-identical root but cannot originate any of them.
  Scope materialisation verifies the selected inference and graph bytes and may
  rerun only the frozen deterministic SemanticGraphNormaliserDefinition. It may
  not invoke a model, create new transcript bytes, seek a new review decision or accept a
  graph whose exact envelope, reviewed-payload or normaliser lineage differs from
  the offline reviewed objects.
  For an included open-world source role, the applicable scope-selecting action
  is the sole producer of the admitted occurrence, mechanically rekeyed admitted
  evidence closure and primitive collection, admission transition and carry-
  forward disposition: `MATERIALISE_SCOPE/SINGLE_SUBJECT` only for a one-subject
  rebuild with no membership or source-admission transition, or
  `MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` whenever the registry rule derives
  that discriminator, including for a one-subject source-admission transition.
  It writes or selects the admitted occurrence first,
  then its mechanically rekeyed evidence closure and primitive collection, then
  the transition and finally the carried disposition, all only after the
  DealAdmissionManifest,
  then rebuilds the audit-chain, effective-occurrence and disposition roots in
  the same scope operation. A transaction exposing both occurrence variants as
  effective, or either pre-admission occurrence or disposition as a serving row,
  writes nothing.
  After writing or selecting the terminal DealScopeRunManifest, each
  single-subject materialise or carry-forward dispatch compare-and-swaps its one
  ScopeSubjectHead, creates the exact
  `SCOPE_SUBJECT_ADVANCED` CandidateInputEvent over that manifest and before and
  after subject-head tuples, compare-and-swaps CandidateInputHead and only then
  writes the DealScopeRunReceipt. The event never hashes that later receipt.
  It cannot write an actual post-barrier occurrence, ClaimRevision,
  RelationshipRevision, evidence edge, ResultInputLineage, result revision,
  family set, DealSnapshot, CorpusRelease or candidate-release output object.
  The bundle fixes finite per-deal source, interval, atom, candidate, question,
  composition, slot, row, byte and transaction-time maxima. The complete
  request is validated against them before DML; exceeding one records a blocking
  outcome and requires governed repartitioning or a reviewed contract change,
  never truncation or an oversized best-effort transaction.
- `MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` is permitted only when the exact
  CorrectionApplicabilitySlice contains a membership or source-admission
  transition requiring fixed-point rebuilding, regardless of component
  cardinality, or its complete fixed-point subject component contains more than
  one subject. The complete selected component must be at or below the
  CanonicalContractBundle's fixed
  `max_scope_correction_subjects_per_transaction`. One application declares at
  most its old and new subjects, but overlapping active applications may enlarge
  the connected component. A role-only change that changes neither membership
  nor source admission rebuilds one subject under `SINGLE_SUBJECT`; a one-
  subject source-admission transition uses `MULTI_SUBJECT_CORRECTION`; and a
  deal-to-deal, deal-to-non-deal or non-deal-to-deal move rebuilds the complete
  affected component. In one serialisable transaction
  it must select the existing passing SourceAdmissionPreparationReceipt for
  every included source and cannot manufacture or revise source admission. It
  locks every component subject head, membership key, complete registry-derived
  per-kind applicability creation-slot set and one aggregate subject-root slot.
  For each component subject it independently enumerates the complete ordered
  applicable scope/source-admission registry-entry ID-and-payload-digest set and
  its complete current Entry-and-Slice stable-key set, originates
  each changed `ApplicabilityReexaminationEntry` and
  `ApplicabilityReexaminationSlice`, selects every required byte-identical
  unchanged object, and writes one `ScopeSubjectApplicabilityRoot` with exact
  expected-versus-actual reconciliation and fixed empty missing, extra,
  duplicate, conflicting, wrong-subject, wrong-contract and wrong-producer
  roots. Every required object and that root precede any corrected primary or
  consistency output. It then writes or selects
  every primary corrected object and independently rebuilds every complete
  deal-document and admission path, including any admitted occurrence, admitted
  evidence and primitive graph, OpenWorldCandidateAdmissionTransition,
  carried-forward disposition and every affected replacement scope object, and
  carries those exact local applicability objects through the subject's outputs,
  CorrectionDischarges, CorrectionDischargeMap and DealScopeRunManifest. A
  byte-identical Entry or Slice may be selected through the shared creation
  slot; neither the correction nor the discharge originates it. The dispatch
  creates or selects the current discharges and maps, writes one DealScopeRunManifest per
  subject, compare-and-swaps every component ScopeSubjectHead, creates one
  `SCOPE_SUBJECT_ADVANCED` CandidateInputEvent over the complete canonically
  ordered manifest set and before-and-after subject-head set, compare-and-swaps
  CandidateInputHead, writes one `DealScopeRunReceipt` per subject, each binding
  `MULTI_SUBJECT_CORRECTION`, and finally writes one
  `MultiSubjectScopeCorrectionReceipt/V2` over the ordered
  subject receipts, before and after heads, source-membership CAS proof,
  applicability slice and terminal PASS. Its ID is
  `H("MULTI_SUBJECT_SCOPE_CORRECTION_RECEIPT/V2", schema, frozen pair, exact
  cutoff, scope-build generation, CorrectionApplicabilitySlice ID, ordered
  component subject keys, ordered DealScopeRunManifest IDs, ordered
  DealScopeRunReceipt IDs, exact before-and-after ScopeSubjectHead tuples,
  source-membership CAS proof digest, exact CorrectionDischargeMap digest,
  complete ordered `ScopeSubjectApplicabilityRoot` set and fixed empty
  missing-subject, missing-required-member, extra-member, wrong-discriminator, wrong-slot,
  duplicate and cross-subject roots,
  canonical request digest, writer executable and configuration digests,
  terminal PASS)`. Any partial output, over-limit
  component, stale head, incomplete old/new membership pair or failed reconciliation rolls
  back all subject writes. Freeze can therefore observe the complete prior pair
  or complete successor pair, never one side.
  The historical receipt name does not impose a minimum cardinality: every
  dispatch whose derived discriminator is `MULTI_SUBJECT_CORRECTION`, including
  a one-subject source-admission transition, must create exactly one such
  composite receipt.
- A `ScopeSubjectApplicabilityRoot` ID hashes
  `SCOPE_SUBJECT_APPLICABILITY_ROOT/V1`, schema, frozen pair, exact governed
  subject, subject-local source-membership and correction-head tuples, exact
  CorrectionApplicabilitySlice, exact V3 producer-registry ID and payload
  digest, complete contract-ordered applicable scope/source-admission
  `(registry_entry_id, payload_digest)` set and mechanically derived
  discriminator, the complete
  registry-derived expected Entry-and-Slice stable-key set, the complete ordered
  actual `(logical_type, stable_key, immutable_id, canonical_payload_digest)`
  set and fixed empty missing, extra, duplicate, conflicting, wrong-subject,
  wrong-contract, wrong-producer, missing-entry, extra-entry, duplicate-entry
  and conflicting-entry roots. Exactly one such root may exist for the governed
  subject and subject-local input tuple. Only
  `DEAL_SCOPE_RUN/MATERIALISE_SCOPE` under that exact discriminator may create
  it. It is written after all selected Entries and Slices and before corrected
  outputs, and is selected by the subject manifest, subject receipt and, for
  `MULTI_SUBJECT_CORRECTION`, the composite receipt. A byte-identical unchanged
  Entry or Slice remains part of the expected and actual sets; unchanged does
  not mean optional. The root excludes cutoff and scope-build generation so a
  carry-forward action may select the identical local root when all subject-local
  inputs are byte-identical; the receipt binds that selection to its new global
  generation. A representative per-kind entry, one root per member kind,
  caller-selected entry set or second root producer is invalid.
- `CERTIFY_SCOPE_CARRY_FORWARD` writes no pre-extraction semantic, admission,
  composition, slot, slice or manifest object. It independently recomputes the
  complete local source-membership, selected receipt-local chain, admission,
  semantic, composition, slot and payload inventory under the new cutoff and
  current eligibility recheck. It may select an existing terminal
  DealScopeRunManifest only when the frozen pair and every local input and
  payload digest, every SourceAdmissionPreparationReceipt, inference transcript,
  ReviewedInferencePayload, SemanticGraphNormaliserDefinition and graph-lineage
  digest, SemanticStageOutputSetRoot,
  SemanticNeutralProjectionSetRoot, RelationshipEffectConstraintSetRoot,
  independently recomputed complete ScopeSubjectApplicabilityRoot and the
  complete CorrectionDischargeMap and digest are byte-identical;
  otherwise `MATERIALISE_SCOPE` is required.
  Every scope-selecting dispatch creates one new DealScopeRunReceipt per exact
  subject for its global cutoff and scope-build generation. The
  `MULTI_SUBJECT_CORRECTION` discriminator also
  creates its composite receipt. The carry-forward variant therefore certifies
  global inclusion without rewriting or rekeying unchanged local truth.
- A ScopeSubjectHead is keyed by scope-build generation and exact governed-deal
  or non-deal subject. Its immutable value tuple contains only that key, the
  exact selected DealScopeRunManifest ID and canonical payload digest. It hashes
  no later CandidateInputEvent or receipt. It has no more than one terminal
  DealScopeRunManifest in a generation. Exact replay returns the associated
  receipt; a changed request after it
  commits is rejected and requires a higher ScopeBuildHead generation. The
  expected prior subject head names the latest lower-generation manifest tuple or
  genesis and prevents a fork. Thus the freeze never has to choose among two
  current manifests for one subject, and scheduler order cannot select truth.
- A terminal `DealScopeRunManifest` has governed-deal and non-deal variants and
  hashes schema, frozen pair, exact local source-membership projection, relevant
  receipt, complete bottom-up ArchiveAttemptNode set, attempt, sole root
  SubmissionExpansionManifest, SourceContent, source occurrence, receipt-local
  IntakeUniverseManifest, replacement, resolution-chain and selected-head
  inventory, every selected SourceAdmissionManifest and required
  SourceAdmissionApprovalAttestation and SourceAdmissionPreparationReceipt,
  every selected SemanticExtractionInputEnvelope, complete ordered
  SemanticInferenceTranscript set, ReviewedInferencePayload,
  SemanticGraphNormaliserDefinition and ValidatedSemanticGraph with validation
  report and exact lineage,
  complete selected pre-extraction inventory, the exact
  `ScopeSubjectApplicabilityRoot` ID and payload digest and its complete
  expected-versus-actual reconciliation, every applicable
  PRE_FREEZE_CONTRACT and SOURCE_BUILD SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot, exact
  RelationshipEffectFieldUniverseSetRoot and both path-specific
  RelationshipEffectConstraintSetRoots, exact applicability-slice-selected scope-correction
  heads, events, CorrectionApprovalAttestations, CorrectionApplications,
  CorrectionApplicabilityProjections and exact CorrectionApplicabilitySlice,
  CorrectionDischarges and the complete CorrectionDischargeMap and digest and
  `scope_correction_set_digest`,
  executable and configuration digests and terminal proof. Every cutoff-selected
  PASS source belongs to exactly one deal or reviewed non-deal manifest, and
  every reviewed intake resolution has one matching non-admitted disposition.
  Competing assignments lock the same membership key and cannot both commit.
  The successful canonical operation receipt is a typed
  `DealScopeRunReceipt`. It hashes schema, action variant, exact
  dispatch discriminator, including the mechanically derived `SINGLE_SUBJECT`
  or `MULTI_SUBJECT_CORRECTION` for `MATERIALISE_SCOPE` and the contract's
  explicit non-materialisation marker for carry-forward, exact
  DealScopeRunManifest, exact ScopeBuildHead tuple comprising
  scope-build generation, cutoff, frozen pair, authorisation generation and
  required `OPEN` state, exact ScopeCorrectionLedgerHead and slice-selected subject
  heads, exact selected CorrectionApprovalAttestation and
  CorrectionApplicabilityProjection sets, exact CorrectionApplicabilitySlice, complete
  `ScopeSubjectApplicabilityRoot` ID and payload digest,
  CorrectionDischargeMap and digest and
  `scope_correction_set_digest`, resulting `SCOPE_SUBJECT_ADVANCED`
  CandidateInputEvent, IntakeEligibilityRecheckAttestation, exact prior
  lower-generation ScopeSubjectHead manifest tuple or genesis, exact committed
  before-and-after ScopeSubjectHead tuples,
  complete source-membership CAS result, authorisation evidence,
  writer executable and configuration digests and terminal `PASS`. The mutable
  ScopeBuildHead contains only that fixed generation tuple and `OPEN`, `FROZEN`
  or `ABANDONED` state; a scope run locks but does not increment it, and freeze
  atomically changes `OPEN` to `FROZEN`.
  Idempotency key, attempt, run, time, worker and lock-acquisition evidence are
  provenance outside receipt identity. The reusable local DealScopeRunManifest
  does not hash those global selection inputs. CorpusScopeFreezeAttestation
  later selects the exact DealScopeRunReceipt and its one referenced manifest.
  An unrelated new receipt therefore rekeys cutoff, DealScopeRunReceipt, scope
  barrier and release, not an unchanged deal's semantic root, family set or
  DealSnapshot.
- `canonical_write(operation=CORPUS_SCOPE_FREEZE)` has `OPEN_GENERATION`,
  `ABANDON_GENERATION`, bounded `PREPARE_BATCH` and final `COMMIT` actions.
  `OPEN_GENERATION` locks authorisation, IntakeProcessingPolicyHead,
  IntakeRevocationHead,
  CandidatePromotionFence, CandidateInputHead and ScopeBuildHead, rechecks the
  exact cutoff and frozen pair, binds a fresh passing
  IntakeEligibilityRecheckAttestation and advances to the next contiguous fixed
  generation tuple in `OPEN` state. Before local scope work, it deterministically
  instantiates the complete contract-ordered
  `ApplicabilityReexaminationRequirement` instance set for that frozen pair
  through the sole release-input carrier by enumerating every definition in the
  already generated `ApplicabilityReexaminationRequirementSetRoot`, proves the
  definition-to-instance bijection and binds both that definition-set root and
  the exact instance root and empty difference roots into the opening transition
  receipt. It appends the matching
  `SCOPE_GENERATION_OPENED` event and advances CandidateInputHead in the same
  transaction. It is permitted only after genesis or
  a `FROZEN` or `ABANDONED` predecessor. `ABANDON_GENERATION` takes the same
  locks and changes one exact `OPEN` generation to `ABANDONED` with a closed
  reason and immutable operation receipt, appends
  `SCOPE_GENERATION_ABANDONED` and atomically advances CandidateInputHead. It
  creates no barrier, and no receipt,
  shard, root or other object whose identity binds that abandoned generation may
  be selected later. A generation-independent content object may deduplicate in
  a later prepare only when that prepare independently recomputes its exact ID
  and payload; a local DealScopeRunManifest can be reused only through the
  independent carry-forward proof above. This is the only recovery from a wrong
  committed current-generation scope run; the replacement work uses a higher
  generation.
  `PREPARE_BATCH` writes immutable, inaccessible scope slices,
  global composition children, shards, roots, reconciliations and closures,
  CompositionContextKeyUniverseRoot, neutral content digest and every reachable
  BoundedInventoryTree node, their global
  ExpectedOccurrenceSlots, bounded `CorpusScopeInventoryShard`
  leaves, internal nodes, kind roots and root sets; none authorises extraction.
  CanonicalContractBundle generates a fixed
  `CorpusScopeInventoryKindRegistry` over every scope-release-input kind. The
  fixed kinds expressly include ImmutableSourceDocument,
  SourceAdmissionPreparationReceipt, SemanticExtractionInputEnvelope,
  SemanticInferenceTranscript, ReviewedInferencePayload,
  SemanticGraphNormaliserDefinition and ValidatedSemanticGraph, every open-world
  candidate, occurrence, current candidate- and kind-supersession, every
  source-role admission transition, evidence closure, primitive,
  candidate-audit-chain root, effective-occurrence root,
  candidate-chain reconciliation, primitive-collection root,
  final disposition, disposition manifest, impact-walker output,
  SemanticImpactEnumeratorIndependenceAttestation, SemanticImpactClosure,
  ApplicabilityReexaminationRequirement,
  ApplicabilityReexaminationEntry, ApplicabilityReexaminationSlice,
  ScopeSubjectApplicabilityRoot and the exact empty
  OpenWorldReviewQueueRoot. OpenWorldSimilarityProposal and every non-empty
  review queue are excluded offline carriers, not empty registry kinds. The
  shared context `C_scope` is schema, frozen pair, exact cutoff, scope-build
  generation, captured CandidateInputHead tuple, captured
  ScopeCorrectionLedgerHead tuple and registry ID. Each shard is one
  BoundedInventoryTree leaf over a deterministic key range and ordered stable-ID
  and canonical-payload-digest pairs. Fixed-fanout internal nodes close every
  kind to one root reference; no root lists child shard or node IDs.
- A neutral kind-content digest hashes
  `CORPUS_SCOPE_INVENTORY_KIND_CONTENT/V2`, `C_scope`, registry-entry ID,
  BoundedInventoryTree root reference and member count. Its governed
  `CorpusScopeInventoryKindRoot` additionally hashes enumerator role and
  the exact terminal-PASS
  `InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE)`. A neutral root-set content digest hashes
  `CORPUS_SCOPE_INVENTORY_ROOT_SET_CONTENT/V2`, `C_scope`, registry ID and the
  complete contract-ordered `(kind_code, kind_content_digest, member_count)`
  list, including an explicit empty-kind digest. Each governed
  `CorpusScopeInventoryRootSet` hashes that neutral digest, enumerator role, the
  same stage attestation and the fixed ordered `(kind_code, governed_kind_root_id,
  root_payload_digest)` list. Enumerator identity never enters tree-node or
  neutral content digests. Missing, duplicate or unknown kinds fail before
  COMMIT.
- The two independent enumerators build distinct governed roots over the same
  canonical projection reachable through that exact CandidateInputEvent-chain
  prefix. `CorpusScopeInventoryReconciliation` hashes both root-set IDs and
  payload digests, the exact terminal-PASS stage attestation, their common
  neutral content digest, fixed per-kind digest-
  and-count equality and fixed empty missing, extra, duplicate and conflicting-
  key tree roots. COMMIT requires the terminal-PASS stage attestation,
  byte-equal neutral content and this passing reconciliation; it never requires the
  governed root IDs to be equal.
  Before COMMIT, each independently enumerates and seals the complete cutoff
  universe, current-generation DealScopeRunReceipt, referenced
  DealScopeRunManifest, MultiSubjectScopeCorrectionReceipt/V2 and non-deal sets.
  Batch size, transaction rows and bytes are fixed by contract and cannot grow
  with corpus size.
  COMMIT locks the authorisation row, IntakeProcessingPolicyHead,
  IntakeRevocationHead,
  CandidatePromotionFence, CandidateInputHead, exact open ScopeBuildHead, exact
  ScopeCorrectionLedgerHead,
  creates a fresh passing IntakeEligibilityRecheckAttestation and binds it into
  the freeze. It first requires CandidateInputHead to equal the exact tuple bound
  by both prepared inventory root sets. Before the transaction, both enumerators build the complete
  ScopeCorrectionSubjectHead-map root at that exact ledger tuple. Every
  correction transition must lock and advance the singleton ledger atomically
  with its bounded subject-head set, so an unchanged locked ledger proves the
  prepared map cannot have changed. COMMIT revalidates the exact terminal-PASS
  stage independence attestation, both root sets, their common neutral content
  digest and CorpusScopeInventoryReconciliation and never
  locks one row per subject. It appends
  `SCOPE_GENERATION_FROZEN` and advances
  CandidateInputHead atomically with the head transition. Because every
  scope run locks that head first, a run that locked first must finish and be
  included and invalidates stale prepared root sets by advancing CandidateInputHead,
  while freeze locking first changes the head from `OPEN` to `FROZEN`
  and rejects later runs for that generation. COMMIT verifies only the two sealed
  root-set IDs and payload digests, common neutral content digest,
  reconciliation and fixed-size empty difference roots while holding locks; it
  never scans the corpus. Every
  selected receipt has
  exactly one referenced manifest, and every selected manifest has exactly one
  receipt for this cutoff and scope-build generation. Every selected receipt
  must capture the current scope-correction ledger and its exact
  applicability-slice-selected subject-head tuples; a later undischarged effective application
  makes COMMIT fail. Every selected MultiSubjectScopeCorrectionReceipt/V2 must
  name exactly its complete subject-receipt set and ordered
  ScopeSubjectApplicabilityRoot set; each subject receipt must bind
  `MULTI_SUBJECT_CORRECTION`, and no subject
  receipt from a dispatch with that discriminator may be selected without that
  composite receipt, regardless of component cardinality. One indexed set-based
  anti-join and canonical payload checks
  require bidirectional equality and unique source membership without loading
  broad objects into Node or holding one lock per deal.
- The final freeze transaction writes CorpusScopeManifest and one
  `CorpusScopeFreezeAttestation`. Its ID hashes schema, frozen pair, exact cutoff,
  exact IntakeEligibilityRecheckAttestation, scope-build generation and
  predecessor barrier or genesis, exact
  CorpusScopeManifest, exact prepared CandidateInputHead tuple, both independent
  complete CorpusScopeInventoryRootSets and payload digests, their common
  neutral content digest, exact
  InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE), exact
  CorpusScopeInventoryReconciliation, fixed-size
  empty-difference roots, source-membership uniqueness proof and
  ScopeSubjectHead-map and predecessor-chain root, exact prepared scope-slice, global-composition and
  CompositionContextKeyUniverse shard and root,
  ExpectedOccurrenceSlot and ExpectedResultInputLineageSlot root IDs,
  writer executable and configuration
  digests, authorisation evidence and terminal `FROZEN` state. The subsequent
  CandidateInputEvent hashes this attestation and changed ScopeBuildHead tuple;
  the attestation never hashes that later event or mutable CandidateInputHead.
  Complete receipt, manifest, non-deal, correction, source-approval and other
  corpus-sized member sets are selected exclusively through those sealed roots;
  neither the attestation payload nor its transaction inlines them.
  Failure leaves prepared objects unselected. A rebuild uses a higher generation
  and new barrier; no operation edits an old barrier.
- `canonical_write(operation=DEAL_EXTRACTION_RUN)` consumes the exact
  CorpusScopeFreezeAttestation, CorpusScopeManifest, relevant DealScopeRunManifest
  and scope slices, frozen pair, programme status, authorisation generation,
  action-specific expected heads and idempotency key. Its actions are
  `OPEN_GENERATION`, `ABANDON_GENERATION`, `FAMILY_BUILD` and `FINALISE_DEAL`.
  `DealExtractionBuildHead` stores only governed deal, current contiguous
  extraction generation, `OPEN`, `FROZEN` or `ABANDONED` and the exact current
  immutable `DealExtractionBuildTransition` ID. An `OPEN` transition hashes its
  prior terminal transition or genesis, exact barrier, frozen pair, scope-slice
  set, captured PostScopeCorrectionLedgerHead and per-deal subject-head tuples
  and root, deadline and authorisation evidence. An `ABANDONED` transition hashes
  the exact open predecessor and closed reason. A `FROZEN` transition hashes the
  exact open predecessor, complete FamilyBuildReceipt set, DealSnapshot and
  DealExtractionRunManifest. A generation can leave `OPEN` only once. No family
  or finalisation may use an inferred generation or a transition bound to another
  barrier. A head tuple is always `(deal, generation, state,
  current_transition_id, transition_payload_digest)` and never a mutable row ID.
- Every extraction action that can produce or select output locks and
  revalidates authorisation, current IntakeProcessingPolicyHead and
  IntakeRevocationHead in its generated lock-plan order and binds a fresh passing
  IntakeEligibilityRecheckAttestation. `OPEN_GENERATION` then locks
  CandidatePromotionFence, CandidateInputHead and the deal's
  DealExtractionBuildHead. It requires the current ScopeBuildHead to be the exact
  `FROZEN` barrier, then locks the exact PostScopeCorrectionLedgerHead and every
  subject head in the independently enumerated complete active
  application-to-DEAL_FAMILY projection for that deal before capturing them. It opens only after
  genesis or a terminal predecessor, writes the immutable OPEN transition,
  compare-and-swaps the head, appends
  `DEAL_EXTRACTION_GENERATION_OPENED` and advances CandidateInputHead in the same
  transaction, then writes the typed open receipt. `ABANDON_GENERATION` takes the
  same locks, writes the immutable ABANDONED transition, changes one exact
  `OPEN` generation to `ABANDONED`, appends
  `DEAL_EXTRACTION_GENERATION_ABANDONED` and advances CandidateInputHead. No
  abandonment receipt is written until those objects exist. No
  family manifest or prepared object bound to an abandoned generation is later
  selectable. Recovery always opens a higher generation.
- `FAMILY_BUILD` is bounded to one exact `(governed deal, extraction generation,
  family)` unit. It consumes both independent correction-applicability enumerator
  outputs and a proposed reconciled post-scope CorrectionApplicabilitySlice
  payload, plus the exact post-freeze
  ApplicabilityReexaminationRequirement instances whose definition-derived
  eligible-member universes
  intersect that deal-family and whose exact member-kind registry entries assign
  FAMILY_BUILD as sole producer. It computes the correction payload and complete
  required re-examination entry-key set without DML, then locks the open
  DealExtractionBuildHead, captured post-scope correction heads and exact
  `FamilyBuildHead`, which stores only state and current immutable
  `FamilyBuildTransition` ID and has at most one terminal transition for that
  tuple, revalidates both enumerator outputs, every captured head and the proposed
  slice, and only then creates or selects the exact slice before corrected-object
  DML. It has `MATERIALISE` and `CERTIFY_CARRY_FORWARD` variants. `MATERIALISE`
  materialises exactly the selected ExpectedOccurrenceSlots owned by the family,
  resolves pre-claim relationships, creates their stripped candidate-actual
  projections and passing pre-claim CandidateRelationshipReconciliation, then
  claims and assessments, post-claim
  relationships, evidence, ResultInputLineage and result and component revisions
  in compiled DAG order, closes every applicable pre-claim CANDIDATE_BUILD
  SemanticStageOutputSetRoot and SemanticNeutralProjectionSetRoot, writes one
  source-backed ApplicabilityReexaminationEntry for every registry-assigned
  deal-family member under every intersecting requirement and closes the
  corresponding complete family
  ApplicabilityReexaminationSlices, then writes one complete family set and terminal
  `FamilyExtractionManifest` in one serialisable transaction. It may read only
  exact certified prerequisite family sets declared by the DAG and the captured
  applicability-slice-selected post-scope correction head set. It cannot create or modify intake,
  admission, discovery, challenge, expectation, closure, scope or barrier
  objects, a requirement definition or instance, or a DealSnapshot. Requirement
  instances are selection-only; FAMILY_BUILD originates only its registry-
  assigned Entry and Slice members. When it selects a post-scope
  CorrectionApplication, it creates or selects that application's declared
  primary and consistency outputs, then every registry-required family Entry
  and complete Slice, then the current CorrectionDischarge and
  CorrectionDischargeMap, in that exact order in the same transaction before
  the family set.
- A family-manifest ID hashes schema, frozen pair, exact barrier, deal-extraction
  generation, fresh IntakeEligibilityRecheckAttestation, action variant,
  DealScopeRunManifest, scope slice, governed deal and family, exact
  CorrectionApplicabilitySlice and its
  selected subject-head, event and CorrectionApplicabilityProjection set, ordered
  prerequisite family-set IDs, ordered post-scope
  CorrectionApprovalAttestation, CorrectionApplication and CorrectionDischarge
  IDs and the complete CorrectionDischargeMap and digest, selected
  ExpectedOccurrenceSlots and ExpectedResultInputLineageSlots, every ordered
  intersecting ApplicabilityReexaminationRequirement ID, exact
  ApplicabilityReexaminationEntry key and payload digest and complete family
  ApplicabilityReexaminationSlice ID and payload digest, fixed empty local
  missing, extra, duplicate, conflicting and unresolved roots, complete
  occurrence, revision, evidence,
  candidate-actual projection and pre-claim reconciliation, lineage and
  result-output inventory, family-set ID, semantic-computation
  attestations, governed mappings, exact applicable CANDIDATE_BUILD semantic
  stage and neutral-projection roots, executable and configuration digests and
  terminal disposition.
  The writer then creates one terminal FamilyBuildTransition selecting that
  manifest and family set, compare-and-swaps FamilyBuildHead and finally writes
  `FamilyBuildReceipt`, which hashes the transition, manifest, exact before and
  after FamilyBuildHead tuples, open DealExtractionBuildTransition, canonical
  request digest, writer evidence and `PASS`. The family set and manifest do not
  hash the transition, receipt or mutable head. The transition and receipt bind
  the exact family re-examination entries and slices through the selected
  manifest and family-set payload digests; no later family or candidate action
  may manufacture them.
- `CERTIFY_CARRY_FORWARD` writes no occurrence, revision, evidence, lineage,
  result or family set. It independently recomputes the complete local input and
  dependency digest and may create a new FamilyExtractionManifest selecting an
  existing certified family set only when frozen pair, DealScopeRunManifest,
  scope slice, ExpectedOccurrenceSlots, applicability-slice-selected post-scope correction set and
  its exact CorrectionApplicabilitySlice, CorrectionDischargeMap and digests,
  prerequisite family sets, exact intersecting
  ApplicabilityReexaminationRequirements, entries and family slices, applicable
  candidate semantic-stage roots and every
  local payload digest are byte-identical.
  Any difference requires `MATERIALISE`. Exact replay returns the existing
  FamilyBuildReceipt; a changed request after terminal success requires a higher
  extraction generation.
- `FINALISE_DEAL` writes no claim, relationship, result or other family fact. It
  locks CandidatePromotionFence, CandidateInputHead, the exact open
  DealExtractionBuildHead and required FamilyBuildHeads, then independently
  enumerates the scope slices and requires one exact terminal
  FamilyBuildReceipt and referenced FamilyExtractionManifest for every required
  family, no extra family, exact prerequisite closure, exact slot materialisation
  and payload equality. A family build that locks first commits and is
  considered; finalisation that locks first freezes the head and rejects later
  family work. One indexed, set-based comparison performs the proof without
  loading broad objects into Node. The bundle fixes finite family, row, byte and
  transaction-time bounds.
- The same transaction writes the complete DealSnapshot and terminal
  `DealExtractionRunManifest`, then the immutable FROZEN
  DealExtractionBuildTransition, changes the head to `FROZEN`, appends
  `DEAL_EXTRACTION_GENERATION_FROZEN`, advances CandidateInputHead and only then
  writes `DealExtractionRunReceipt`. The run-manifest ID hashes schema, frozen pair, exact
  barrier and generation, finalisation's fresh IntakeEligibilityRecheckAttestation,
  DealScopeRunManifest, scope slices, governed deal, exact captured post-scope
  correction heads, passing CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice and
  CorrectionDischarge sets and
  complete CorrectionDischargeMap and digest and
  post-scope-correction-set digest, ordered FamilyBuildReceipt and
  FamilyExtractionManifest IDs,
  DealSnapshot ID, independent-enumerator and empty-difference proofs,
  executable and configuration digests and terminal disposition. The run
  receipt hashes the frozen transition, manifest, snapshot, exact before and
  frozen after head tuples, resulting CandidateInputEvent, canonical request digest, writer
  evidence and `PASS`; neither manifest nor snapshot hashes that later receipt or
  event. A rebuild uses a higher generation.
- DealExtractionRunManifest independently enumerates the complete effective
  post-scope application-to-DEAL_FAMILY edge set for that deal at its captured
  ledger head. The union of selected family CorrectionApplicabilitySlices must
  equal it in both directions, with one slice and one current discharge-map
  entry per active application and no family omission or duplicate.
- `canonical_write(operation=CANDIDATE_RELEASE_FREEZE)` has only
  `OPEN_GENERATION`, bounded `PREPARE_INPUT_BATCH`, `SEAL_INPUT`, bounded
  `PREPARE_OUTPUT_BATCH`, `SEAL_PREPARE`, bounded
  `PREPARE_FREEZE_CONTROL_BATCH`, `FREEZE`, bounded
  `BUILD_CANDIDATE_RELEASE_PROJECTION`, `ISSUE_INPUT_RECHECK` and
  `ABANDON_GENERATION` actions. `ISSUE_INPUT_RECHECK` is legal only after the
  two projection roots exist and is the sole producer of
  `CandidateInputRecheckAttestation`.
  `PREPARE_INPUT_BATCH` has a closed `RESIDUAL_CLOSURE` discriminator with
  `ENTRY_BATCH` and `TERMINAL_SET` phases. `ENTRY_BATCH` is the sole producer of
  GovernedResidualDisposition, both independent impact projections and
  GovernedResidualImpactClosure members for the sealed input residual universe.
  `TERMINAL_SET` is the sole producer of
  GovernedResidualDispositionManifest and GovernedResidualReviewQueueRoot after
  independently recomputing exact universe coverage and impact equality.
  CanonicalWriterDispositionRegistry admits only those logical types under
  those tuples, uses content-addressed batch or terminal-root receipts, emits no
  serving row or outbox, and blocks `SEAL_INPUT` unless the terminal queue root
  is the governed empty root. Direct DML, a DEAL_SCOPE_RUN substitute or another
  candidate action is prohibited.
  `CandidateBuildHead` stores only current contiguous candidate
  generation, `OPEN`, `INPUT_SEALED`, `PREPARED`, `FROZEN` or `ABANDONED` and
  exact current immutable `CandidateBuildTransition` ID. The OPEN transition
  hashes frozen pair, exact frozen scope barrier, opening CandidateInputHead
  tuple, captured `AVAILABLE` CandidatePromotionFence version, opened-at
  evidence and CertificationPolicyManifest deadline. The INPUT_SEALED
  transition hashes its exact predecessor, CandidateInputSeal and already
  materialised CorpusRelease. PREPARED hashes its exact predecessor,
  CandidateOutputSeal, final SEALED CandidateOutputPreparationHead tuple and
  terminal OUTPUT_SEALED CandidateOutputPreparationReceipt.
  FROZEN hashes its PREPARED predecessor and
  CandidateReleaseFreezeAttestation. ABANDONED hashes its non-terminal
  predecessor and closed reason and either the exact ABANDONED
  CandidateOutputPreparationHead tuple and terminal OUTPUT_ABANDONED receipt,
  or the generated `NO_OUTPUT_PREPARATION_HEAD` marker when abandonment occurs
  before an output head exists. Every named reference means its exact ID and
  canonical payload digest. Only one terminal transition is allowed, and a
  head tuple is generation, state, transition ID and transition payload digest.
- `OPEN_GENERATION` locks authorisation, IntakeProcessingPolicyHead,
  IntakeRevocationHead,
  CandidatePromotionFence, CandidateInputHead, the current frozen ScopeBuildHead
  and CandidateBuildHead. It rejects an open or stale scope generation, captures
  the exact `AVAILABLE` promotion version, input-head tuple and fixed deadline
  and writes the OPEN transition, head CAS and transition receipt in that order.
  A held or revoked fence fails
  immediately rather than queues. It does not
  scan deals or write a release. `PREPARE_INPUT_BATCH` then uses two disjoint
  enumerators to write the two independently derived complete bounded
  `CorpusReleaseInventoryShard`, tree and root sets over the exact current
  ScopeBuildHead and barrier; required deal set;
  current `FROZEN` DealExtractionBuildHead tuple and exact immutable FROZEN
  transition, DealExtractionRunReceipt, manifest and snapshot for each included
  deal; both correction ledger and
  subject-head roots; complete selected SourceAdmissionApprovalAttestation and
  scope- and post-scope CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice and
  CorrectionDischarge sets, exact CorrectionDischargeMaps and digests and the
  complete selected ScopeSubjectApplicabilityRoot stable-ID and payload-digest
  set and
  complete selected MultiSubjectScopeCorrectionReceipt/V2 stable-ID and
  payload-digest set; and every exact input payload digest. The release-inventory
  roots close the deal-to-snapshot, cutoff, intake-governance, correction,
  discharge and source-payload sets from which CorpusRelease identity is
  derived. They contain no CorpusRelease ID or candidate output. Shards have fixed
  non-overlapping key ranges and batch, row, byte and time limits. Neither
  enumerator reads the other's code, views, output or table registry.
- Only after both complete CorpusRelease input root sets and their
  CorpusReleaseInventoryReconciliation have closed, two further implementation-
  disjoint applicability enumerators consume those exact sealed roots and
  derive, for every post-freeze ApplicabilityReexaminationRequirement instance,
  the full eligible-instance universe from its generated definition,
  CorpusScopeManifest and all selected DealSnapshots and independently join
  every exact local Entry and Slice and every scope subject's exact
  `ScopeSubjectApplicabilityRoot`. They stream separate fixed-fanout roots.
  Both terminal roots must exist before an
  `ApplicabilityReexaminationEnumeratorIndependenceAttestation` proves their
  code, query, view, cache, intermediate and output closures disjoint. Only then
  may the third reconciler require byte-equal universes, entries, states and
  dependency closures and create the named
  ApplicabilityReexaminationReconciliation. It creates nothing else. The
  separate TERMINAL_MANIFEST producer selects that reconciliation and alone
  creates the candidate-wide ApplicabilityReexaminationManifest with complete
  empty missing, extra, duplicate, conflicting, stale-contract and unresolved
  roots. Bounded metric-applicability projection entry batches then map every
  canonical metric-slot definition basis to the exact intersecting requirement
  set, and only TERMINAL_SET closes
  MetricApplicabilityRequirementProjectionSet. CandidateInputSeal directly
  selects both sealed release-input roots and their reconciliation, both
  applicability roots, their independence attestation, exact
  ApplicabilityReexaminationReconciliation, terminal manifest, complete
  projection-entry root and terminal metric-applicability projection set as
  fixed named controls, while the CorpusRelease input roots inventory every
  Requirement, Entry, Slice and ScopeSubjectApplicabilityRoot. An
  incomplete but fully enumerated universe may carry explicit `NOT_EXAMINED`
  members for Review. A market slot is authorised only when every exact
  requirement in its release-scoped projection entry is
  `COMPLETE_EXAMINED`; unrelated requirements and the manifest-wide summary do
  not affect that slot.
- CanonicalContractBundle also generates a closed
  `CorpusReleaseInventoryKindRegistry` as the exact sealed-release-input
  projection of CanonicalWriterDispositionRegistry, including a concrete
  CorrectionApplyReceipt kind and concrete SourceAdmissionPreparationReceipt,
  SemanticInferenceTranscript and ReviewedInferencePayload kinds. It also
  includes the complete selected immutable source-document, exact frozen
  SemanticGraphNormaliserDefinition, validated-semantic-graph and reviewed
  open-world object set,
  including every candidate and occurrence, current general and kind
  supersession, every source-role admission transition and its transition-bound
  historical and current dispositions, complete OpenWorldCandidateAuditChainRoot,
  OpenWorldEffectiveOccurrenceRoot and OpenWorldCandidateChainReconciliation,
  final dispositions and manifest, both impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation and impact closures, every
  post-freeze applicability requirement instance, local entry, local slice and
  complete ScopeSubjectApplicabilityRoot, and the exact empty review queue. The candidate-
  wide applicability tree nodes, roots, independence attestation,
  reconciliation and ApplicabilityReexaminationManifest are
  `NAMED_CONTROL(APPLICABILITY_REEXAMINATION)`, not `RELEASE_INPUT` registry
  kinds. MetricApplicabilityRequirementProjection entries and terminal set are
  `NAMED_CONTROL(METRIC_APPLICABILITY_REQUIREMENT_PROJECTION)`. CandidateInputSeal
  and CandidateReleaseManifest select both control families directly after the
  sealed release-input roots in the universal order above.
  It excludes similarity proposals,
  historical superseded predecessors from effective-semantic kinds while
  retaining them and every supersession edge in the audit-chain kind, and
  non-empty review queues. It covers every input-side logical member class
  independently of what one candidate happens to select. For each
  fixed contract-ordered kind, both input enumerators build bounded
  CorpusReleaseInventoryShards over ordered stable-ID and canonical-payload-
  digest pairs, one kind root and one complete root set. Their shared context is
  schema, frozen pair, exact scope barrier, candidate generation, OPEN
  CandidateBuildTransition, opening CandidateInputHead tuple and
  CorpusReleaseInventoryKindRegistry ID. A shard content digest hashes
  `CORPUS_RELEASE_INVENTORY_SHARD_CONTENT/V1`, that context, registry-entry ID,
  deterministic shard ordinal and boundaries, ordered stable-ID and payload-
  digest pairs and count. Its content-addressed stable ID is enumerator-neutral
  and equals that complete content digest; role and the exact terminal-PASS
  `InventoryEnumeratorIndependenceAttestation(CORPUS_RELEASE_INPUT)` enter only
  the governed kind-root and root-set wrappers. Those shards are BoundedInventoryTree leaves; bounded internal nodes
  close them to one fixed root reference. A kind-root content digest hashes
  `CORPUS_RELEASE_INVENTORY_KIND_CONTENT/V1`, the context, registry-entry ID,
  fixed expected- and actual-tree root references, member count, fixed empty
  missing, extra, duplicate and conflicting-key tree roots and `PASS`; its stable
  ID additionally hashes enumerator role and the same stage attestation. It never lists all leaf
  or internal-node IDs. The neutral root-set content digest hashes
  `CORPUS_RELEASE_INVENTORY_ROOT_SET_CONTENT/V1`, the context, registry ID and
  every contract-ordered kind content digest and member count, including an
  explicit empty-kind digest. Each root-set ID hashes that content digest,
  enumerator role, the same stage attestation and every ordered kind-root ID and
  payload digest.
  The two root sets must have the same neutral content digest and empty missing,
  extra, duplicate and conflicting-key sets.
  `CorpusReleaseInventoryReconciliation` hashes both root-set IDs and payload
  digests, the exact terminal-PASS stage attestation, common neutral content
  digest, fixed-size per-kind digest-and-count
  equality and empty bidirectional differences. CandidateInputSeal selects the
  stage attestation, both root sets, their payload digests and that
  reconciliation, then both fixed applicability roots, their independence
  attestation, exact ApplicabilityReexaminationReconciliation, exact candidate-
  wide ApplicabilityReexaminationManifest, complete metric-projection-entry
  root, and exact MetricApplicabilityRequirementProjectionSet ID, payload digest and
  metric_applicability_requirement_projection_set_digest.
  An unknown input
  member kind, omitted empty kind or
  self-declared member list blocks sealing.
- For each correction-ledger and subject-head tuple, both input enumerators prove
  that every effective active application from a current scope event has exactly
  one passing discharge selected by the barrier and every effective active
  application from a current post-scope event has exactly one passing discharge
  selected by the deal's FROZEN extraction transition and receipt. Superseded
  applications have a complete terminal supersession path and zero discharges
  selected by the current maps; immutable historical discharges remain bound to
  their earlier manifests and releases.
  A missing, extra, duplicate, wrong-stage or wrong-output selection, or an
  effective application introduced by a later event without its selected
  discharge, fails the input root. The exact selected applicability-slice union must
  equal the independently enumerated active ledger-to-target projection in both
  directions, with no application split across slices.
- `SEAL_INPUT` locks authorisation, IntakeProcessingPolicyHead,
  IntakeRevocationHead, CandidatePromotionFence, CandidateInputHead and
  CandidateBuildHead, requires the promotion fence still equals the captured
  `AVAILABLE` version, the deadline has not passed and the input head still
  equals the opening tuple, and proves the exact
  InventoryEnumeratorIndependenceAttestation(CORPUS_RELEASE_INPUT) is terminal
  PASS and both complete CorpusRelease inventory root sets have equal neutral
  kind and root-set content, distinct governed IDs, a passing reconciliation
  and empty differences, one current frozen extraction receipt per required deal
  and no extra, stale, open or abandoned selection, then validates both
  applicability roots, independence, reconciliation, manifest, projection-entry
  root and projection set in that exact order against those sealed roots. It
  creates a fresh passing
  materialisation-time IntakeEligibilityRecheckAttestation and then writes, in
  order, immutable `CandidateInputSeal`, immutable inaccessible `CorpusRelease`,
  the INPUT_SEALED CandidateBuildTransition, CandidateBuildHead compare-and-swap,
  the genesis `OPEN` CandidateOutputPreparationHead bound to that transition and
  release, and the transition receipt. CorpusRelease hashes only the sealed
  input-side identity described below and no candidate output, later transition,
  receipt or mutable head. This is one fixed-size transaction and never locks
  every deal head. A concurrent scope,
  extraction-generation or correction-head transition either precedes the input
  snapshot and is included or advances CandidateInputHead and makes sealing
  fail.
- CanonicalContractBundle generates one closed `CandidateOutputKindRegistry`.
  It covers materialised candidate output payloads only. Contract freeze proves
  exact bidirectional equality between its entries, every CANDIDATE_BUILD output
  declared by SemanticStageRegistry, every candidate serving payload carrier in
  ServingObjectAccessRegistry and every candidate-output member schema declared
  by bundle and import contracts. Each entry fixes kind code and contract order,
  logical type and schema, physical carrier and discriminator, stable-key and
  canonical-payload-digest extractors, independently derived expected-key rule,
  cardinality, producer action and import disposition. The current closed set
  has concrete entries for candidate release mappings; release-intake dependency
  projections; every candidate semantic envelope, payload, review, attestation,
  semantic object, governed wrapper and mapping, neutral projection and stage
  root; relationship actual projections, projection attestations and
  reconciliations; every candidate composition catalogue shard and root,
  contract-realisation and instance projection and attestation, contract
  reconciliation and instance conformance; exactly two
  CompositionContractSetRecompositionRoots, one
  CompositionContractSetEnumeratorIndependenceAttestation and one terminal
  passing CompositionContractSetAttestation; canonical result rows and
  certified incomplete-result Review rows, each with its exact claim-state,
  result-completeness, market-comparability and governed-reason fields; reviewed
  source-specific serving rows, each with its exact
  ReviewedSourceSpecificPublicationDecision and derived source-claim state,
  market-comparability and governed-reason fields and with no result-
  completeness field because no canonical result exists; child rows, market
  observations and aggregates;
  one `MarketMetricSlotExclusion` for every excluded canonical metric slot;
  ServingExactDetailPayload, ServingExactDetailReference and
  ServingExactDetailParentEdge projections; and ServingContractMetadata. Pre-
  seal traceability and candidate-manifest membership are structural controls,
  never output kinds. Each generated per-stage or per-serving-carrier
  subtype is a concrete entry. There is no wildcard, `OTHER` kind or implicit
  carrier. Unknown, duplicate or unclassified output blocks contract freeze and
  candidate DML. Every registered kind receives a root in every candidate,
  including the exact domain-separated empty-kind root when zero members are
  expected. BlockedResultPreviewDefinition is contract metadata, not a candidate
  output kind; its generated preview has no carrier and therefore receives no
  empty kind root. Candidate certification instead proves the preview kind and
  carrier sets are both empty and that ServingContractMetadata carries the exact
  definition and denial markers.
- Its generated expected-key rules are bidirectional and state-sensitive. Every
  selected DerivedResultRevision produces exactly one `CANONICAL_RESULT` or
  `INCOMPLETE_CANONICAL_RESULT` row as its completeness requires; every selected
  `REVIEWED_SOURCE_SPECIFIC` occurrence produces exactly one source-specific
  row and participates in ReviewedSourceSpecificOutputClosure, but produces no
  canonical metric-slot definition basis. Every eligible canonical metric slot
  produces a market observation if and only if every exact intersecting
  applicability requirement is `COMPLETE_EXAMINED` and its owner-lineage branch
  is eligible. A `RESULT_RELATIONSHIP` owner requires its selected result and
  component to be `COMPLETE` and `COMPARABLE`. A `CLAIM_ONLY` owner instead
  requires a publishable present canonical ClaimRevision, complete
  ClaimScopeClosure, discharged pre-claim dependencies and the
  MetricDefinition's claim-only eligibility predicate; it carries
  `NO_RESULT_LINEAGE` and invents no result state. Every other canonical
  metric slot has exactly one `MarketMetricSlotExclusion`. Incomplete canonical
  rows remain in that canonical partition; source-specific rows do not. Both
  candidate-output enumerators and the production
  importer independently rederive these equalities. Missing rows, duplicate
  variants, an observation for an ineligible owner or a familiar-component-only
  row for an affected incomplete result blocks sealing.
- `ReviewedSourceSpecificOutputClosure` is a fixed-size candidate-output control,
  not an output kind or serving row. Its ID hashes
  `REVIEWED_SOURCE_SPECIFIC_OUTPUT_CLOSURE/V1`, schema, frozen pair,
  CandidateInputSeal, CorpusRelease, both CandidateOutputInventoryRootSet IDs
  and payload digests, their reconciliation, the complete expected reviewed-
  source-specific occurrence root and source-specific row-kind roots, and fixed
  empty source-specific-to-metric-basis, source-specific-to-projection,
  source-specific-to-observation, source-specific-to-exclusion, missing-row,
  extra-row and duplicate-row roots. Only SEAL_PREPARE may create it after both
  output enumerators agree. Its sole carrier is
  `CONTROL_ARTEFACT(REVIEWED_SOURCE_SPECIFIC_OUTPUT_CLOSURE)`; CandidateOutputSeal
  selects it. Production import independently rederives the same occurrence-to-
  row bijection and four empty anti-joins before serving DML. A
  MarketMetricSlotExclusion proves only the terminal state of a canonical metric
  slot and can never stand in for this source-specific closure.
  The reviewed-source-specific CandidateOutputInventoryKindRoot and every
  source-specific output shard contain row members only. They cannot contain,
  imply or substitute this closure, a control pointer or a nested manifest.
  CandidateOutputSeal selects the closure directly as one named control outside
  both output-root sets.
- A separate generated total `CandidateOutputWriteDispositionRegistry`
  classifies every logical object and physical carrier writable by
  the candidate-output preparation namespace, across materialisation,
  inventory building, sealing and abandonment, as exactly
  one of `INVENTORIED_OUTPUT(kind_registry_id)` or a named
  `CONTROL_ARTEFACT` class. Closed control classes are
  CandidateOutputMembership, CandidateOutputBatchManifest,
  CandidateOutputPreparationEvent, CandidateOutputPreparationHead,
  CandidateOutputPreparationReceipt, BoundedInventoryTree leaf or internal
  node, CandidateOutputInventoryKindRoot, CandidateOutputInventoryRootSet,
  CandidateOutputInventoryReconciliation, control-receipt tree,
  CandidateOutputControlReceiptReconciliation,
  ReviewedSourceSpecificOutputClosure, PreSealTraceabilityTree node,
  PreSealTraceabilityRoot, traceability reconciliation and CandidateOutputSeal.
  CorpusRelease inventory carriers are
  input-side and CandidateBuild transitions, heads and receipts belong to the
  separate candidate-build lifecycle; none can appear in the output-preparation
  namespace. Contract freeze proves
  that the INVENTORIED_OUTPUT projection equals CandidateOutputKindRegistry and
  that the CONTROL_ARTEFACT projection equals the generated writer schema,
  lifecycle and bundle/import control schema. No carrier is both; unknown,
  duplicate or unclassified carriers fail compilation and DML. Control
  artefacts authenticate outputs but never inventory themselves as output
  payloads.
- `CandidateOutputPreparationHead` is candidate-generation-local and contains
  only candidate generation, exact INPUT_SEALED transition and CorpusRelease,
  `OPEN`, `SEALED` or `ABANDONED`, contiguous append sequence, current
  CandidateOutputPreparationEvent or genesis and its payload digest. An event
  has exactly one kind: `MEMBERS_APPENDED`, `OUTPUT_SEALED` or
  `OUTPUT_ABANDONED`. Its ID hashes `CANDIDATE_OUTPUT_PREPARATION_EVENT/V1`,
  schema, kind, frozen pair, candidate generation, CorpusRelease, exact
  predecessor head tuple and canonical request digest. `MEMBERS_APPENDED`
  additionally hashes CandidateOutputBatchManifest and ordered changed-kind
  entries; `OUTPUT_SEALED` hashes CandidateOutputSeal and empty changes;
  `OUTPUT_ABANDONED` hashes the closed reason, exact expected CandidateBuildHead
  tuple and empty changes. A later head, transition or receipt may hash the
  event, never conversely. A `CandidateOutputMembership` key hashes
  `CANDIDATE_OUTPUT_MEMBER_KEY/V1`, schema, registry-entry ID, logical type and
  schema version and stable object ID or typed serving key. Its payload repeats
  that key and carries the canonical payload digest. A unique constraint on
  candidate generation, kind and member key permits exact replay and rejects a
  conflicting payload.
  Genesis is `OPEN`; MEMBERS_APPENDED preserves `OPEN`; OUTPUT_SEALED permits
  exactly one `OPEN -> SEALED`; OUTPUT_ABANDONED permits exactly one
  `OPEN|SEALED -> ABANDONED`; and `SEALED` or `ABANDONED` accepts no member
  append. A conflicting predecessor, gap, fork or second terminal event writes
  nothing.
  `CandidateOutputBatchManifest` hashes `CANDIDATE_OUTPUT_BATCH/V1`, schema,
  frozen pair, candidate generation, CandidateInputSeal, CorpusRelease, exact
  expected output-head tuple, canonical batch request digest, complete ordered
  `(kind_code, member_key, stable_id_or_serving_key,
  canonical_payload_digest)` changes, deterministic range and bound evidence,
  producer executable and configuration digests and terminal `PASS`. Its later
  append event, head tuple and operation receipt are forbidden identity inputs.
  `CandidateOutputPreparationReceipt` hashes its action, exact preparation
  event, optional batch manifest or output seal, exact before-and-after output-
  head tuples, exact pre-transition CandidateBuildHead tuple, canonical request digest,
  writer evidence and terminal disposition. It is written only after the head
  compare-and-swap and is never an input to an output object or event. Before
  sealing, two independent walkers derive one complete BoundedInventoryTree over
  every MEMBERS_APPENDED event and its exactly one receipt reachable from the
  captured OPEN output-head tip. `CandidateOutputControlReceiptReconciliation`
  hashes both fixed tree roots, equal neutral content digest and fixed empty
  missing, extra, duplicate, orphan-event and wrong-head difference roots.
  CandidateOutputSeal binds those two roots and reconciliation, never a flat
  receipt list. The one later OUTPUT_SEALED receipt is bound directly by the
  PREPARED CandidateBuildTransition; an OUTPUT_ABANDONED receipt is bound by the
  ABANDONED transition and can never enter a release.
- `PREPARE_OUTPUT_BATCH` reads only the exact sealed input, its terminal
  MetricApplicabilityRequirementProjectionSet and already materialised
  CorpusRelease and writes bounded, inaccessible candidate release mappings,
  certified observations, `MarketMetricSlotExclusion` objects and aggregates,
  canonical, reviewed source-specific
  and certified incomplete-result serving projections, candidate
  stripped CandidateRelationshipActualProjections and exact
  CandidateRelationshipProjectionAttestations,
  CandidateCompositionImplementationCatalogueRoot, neutral catalogue digest
  and every reachable catalogue and implementation-source-artefact tree node,
  CandidateCompositionContractRealisationProjections,
  CandidateCompositionInstanceProjections and their exact named projection
  attestations, candidate semantic and composition computation envelopes,
  payloads, reviews, attestations, full CandidateRelationshipReconciliation,
  candidate contract reconciliations and instance conformances, governed
  wrappers and mappings, neutral
  projections, and every applicable CANDIDATE_BUILD
  SemanticStageOutputSetRoot and SemanticNeutralProjectionSetRoot,
  both CompositionContractSetRecompositionRoots, their independence attestation,
  terminal CompositionContractSetAttestation and ServingContractMetadata. It has
  `MATERIALISE_OUTPUT_BATCH`, two isolated
  `BUILD_OUTPUT_INVENTORY_BATCH` variants and one
  `BUILD_PRE_SEAL_TRACEABILITY_BATCH` control-builder variant. Only materialisation creates
  candidate output or membership and advances CandidateOutputPreparationHead.
  Inventory and traceability variants capture one exact OPEN output-head tuple
  and write only inaccessible output inventory, control-receipt or pre-seal
  traceability tree nodes, roots and reconciliation inputs; those
  inventory containers are not output members and do not advance the head they
  certify. Every bounded materialisation commit locks and
  revalidates the captured `AVAILABLE` CandidatePromotionFence, exact
  `INPUT_SEALED` CandidateBuildHead and `OPEN` CandidateOutputPreparationHead,
  then writes or selects output objects and CandidateOutputMembership rows, one
  CandidateOutputBatchManifest, one `MEMBERS_APPENDED`
  CandidateOutputPreparationEvent, the output-head
  compare-and-swap and its CandidateOutputPreparationReceipt in that order.
  Expensive derivation
  occurs before those locks. `SEAL_PREPARE` locks and revalidates the captured
  promotion fence, unexpired CandidateBuildHead and exact output-head tuple
  captured by both independent output inventories. It requires exact
  key-and-payload equality, the exact terminal-PASS
  InventoryEnumeratorIndependenceAttestation(CANDIDATE_OUTPUT), one passing
  CompositionContractSetAttestation and a
  complete CandidateCompositionImplementationCatalogueRoot, verifies both pre-
  seal traceability roots and reconciliation, creates and validates the exact
  ReviewedSourceSpecificOutputClosure, proves every
  registered candidate-stage root and output kind has empty missing, extra,
  duplicate and conflicting-key sets, closes all shard ranges and writes an
  immutable `CandidateOutputSeal`. It then appends the terminal output-seal
  event, compare-and-swaps CandidateOutputPreparationHead to `SEALED`, writes
  the terminal CandidateOutputPreparationReceipt, writes the PREPARED
  CandidateBuildTransition over the seal, sealed output-head tuple and that
  receipt, compare-and-swaps CandidateBuildHead and writes the transition receipt.
  It performs no publication and no corpus-wide transaction.
- Two output enumerators share only the frozen contract, CandidateInputSeal,
  INPUT_SEALED transition, CorpusRelease and one captured OPEN
  CandidateOutputPreparationHead tuple. Enumerator A derives membership only
  from the complete batch-manifest and append-event chain. Enumerator B derives
  it directly from immutable candidate closure, physical carriers and expected
  slot and stage registries, without reading A's code, views, memberships,
  manifests or inventory tables. For every registry entry, each writes bounded
  `CandidateOutputInventoryShard`s sorted by member key. A shard content digest
  hashes `CANDIDATE_OUTPUT_INVENTORY_SHARD_CONTENT/V1`, schema, the complete
  shared context, registry-entry ID, deterministic shard ordinal and boundaries,
  ordered `(member_key, logical_type, stable_id_or_serving_key,
  canonical_payload_digest)` members and exact count. Its stable ID is that
  enumerator-neutral content digest. Enumerator role and the exact
  terminal-PASS `InventoryEnumeratorIndependenceAttestation(CANDIDATE_OUTPUT)`
  enter only the governed kind-root and root-set wrappers. Contract-fixed row and canonical-byte
  packing makes boundaries reproducible. Shards are BoundedInventoryTree leaves;
  bounded internal nodes reduce them to one fixed root reference per expected or
  actual set and each difference set.
- Each enumerator creates one `CandidateOutputInventoryKindRoot` per registry
  entry. Its content digest hashes
  `CANDIDATE_OUTPUT_INVENTORY_KIND_CONTENT/V1`, the shared context,
  registry-entry ID, independently derived fixed expected- and actual-tree root
  references, member count, fixed empty missing, extra, duplicate and
  conflicting-key tree roots and `PASS`. Its stable ID additionally hashes
  enumerator role and the same stage attestation. It never lists all leaf or internal-node IDs. A
  legitimate empty kind has the exact
  `EMPTY_KIND` digest; a required singleton or other expected member missing
  from an empty actual set fails.
- Each enumerator closes one fixed-size `CandidateOutputInventoryRootSet`. The
  neutral content digest hashes
  `CANDIDATE_OUTPUT_INVENTORY_ROOT_SET_CONTENT/V1`, schema, the shared context,
  CandidateOutputKindRegistry ID and the complete contract-ordered
  `(kind_code, kind_content_digest, member_count)` list. The root-set ID hashes
  `CANDIDATE_OUTPUT_INVENTORY_ROOT_SET/V1`, that context, enumerator role, the
  same stage attestation, the complete ordered `(kind_code, kind_root_id,
  kind_root_payload_digest)` list, neutral content digest and empty missing,
  extra and duplicate kind sets. Corpus growth changes only the bounded shards
  behind kind roots, never this list's cardinality. A named immutable
  `CandidateOutputInventoryReconciliation` hashes both root-set IDs and payload
  digests, the exact terminal-PASS stage attestation, the common neutral content
  digest, fixed-size per-kind digest-and-count
  equality and empty bidirectional differences.
- After both output root sets and both control-receipt trees exist, two
  independent trace walkers build bounded trees over every traceability row for
  the frozen contract, input, route, component, test, scope, candidate payload
  and output-preparation control that exists before sealing. The generated
  `PreSealTraceabilityExclusionRule` excludes only the trace trees' own nodes and
  roots and all objects that cannot yet exist. A separate closed-registry walker
  creates `PreSealTraceabilityRequiredObjectRoot`, and a separate trace-row
  projection creates `PreSealTraceabilityCoverageProjectionRoot`.
  `PreSealTraceabilityReconciliation` hashes both fixed trace roots, their equal
  neutral content digest, those required and covered roots and fixed empty
  missing, extra, duplicate, conflicting, untraced, wrong-phase and prohibited-
  self-reference roots. One immutable
  `PreSealTraceabilityRoot` hashes
  `PRE_SEAL_TRACEABILITY_ROOT/V1`, schema, frozen pair, candidate generation,
  CandidateInputSeal, CorpusRelease, captured OPEN
  CandidateOutputPreparationHead, CanonicalWriterDispositionRegistry,
  CandidateOutputKindRegistry, both trace-tree roots,
  PreSealTraceabilityRequiredObjectRoot,
  PreSealTraceabilityCoverageProjectionRoot, row count,
  reconciliation, self-exclusion-rule digest and terminal `PASS`. It is a named
  structural control, never a candidate output member, and neither tree may
  enumerate itself. CandidateOutputSeal hashes it directly.
- `CandidateOutputSeal` hashes
  schema, frozen pair, candidate generation, CandidateInputSeal, CorpusRelease,
  CandidateOutputKindRegistry ID, captured output-head tuple, both root-set IDs
  and payload digests, their exact equal neutral content digest,
  exact InventoryEnumeratorIndependenceAttestation(CANDIDATE_OUTPUT),
  CandidateOutputInventoryReconciliation, both control-receipt tree roots and
  CandidateOutputControlReceiptReconciliation, exact
  ReviewedSourceSpecificOutputClosure ID and payload digest, exact
  CompositionContractSetAttestation ID, payload digest and certified common
  composition-contract-set digest, PreSealTraceabilityRoot and reconciliation,
  writer and configuration digests and
  terminal `PASS`. It never hashes its later OUTPUT_SEALED event or head tuple.
- `PREPARE_FREEZE_CONTROL_BATCH` is available only against the exact PREPARED
  CandidateBuildHead, SEALED output head and terminal preparation receipt. Two
  independent `BUILD_CANDIDATE_MANIFEST_MEMBER_TREE_BATCH` walkers apply the
  frozen `CandidateReleaseObjectSetProjectionDefinition` to every already
  sealed input, candidate payload and required structural control that
  CandidateReleaseManifest must select. They build bounded trees and one
  `CandidateManifestMemberReconciliation` with equal neutral content and fixed
  empty missing, extra, duplicate, conflicting-payload and prohibited-later-
  object roots. `CandidateManifestMemberRoot` hashes
  `CANDIDATE_MANIFEST_MEMBER_ROOT/V1`, schema, frozen pair, candidate generation,
  exact PREPARED transition and receipt, SEALED output-head tuple and terminal
  receipt, CandidateOutputSeal, projection-definition digest, both fixed tree
  roots, member count, reconciliation, structural-exclusion-rule digest and
  terminal `PASS`.
  The projection definition follows CandidateOutputSeal's direct named-control
  edge and expands `ReviewedSourceSpecificOutputClosure` into the manifest-
  member universe exactly once as its own typed structural-control member. It
  does not discover the closure through a source-specific output root and may
  not add it again through CandidateOutputSeal, traceability or a generic
  control scan. Both walkers prove one closure member, one incoming expansion
  path and fixed empty missing, duplicate-path and nested-control roots.
- The candidate-manifest trees exclude their own nodes and root,
  CandidateReleaseManifest, CandidateReleaseFreezeAttestation, the later FROZEN
  transition and receipt, rechecks, promotion, deployment, bundle, import and
  live controls. They are content-addressed structural controls and do not
  advance CandidateBuildHead or emit receipts. FREEZE validates only their fixed
  roots and reconciliation. CandidateReleaseManifest hashes
  CandidateManifestMemberRoot instead of an inline payload-file list. A
  post-manifest CandidateReleaseObjectProjectionRoot and
  CandidateReleaseBlobProjectionRoot later recompute the exact expanded object
  and blob sets for bundle and import without entering manifest identity.
- `BUILD_CANDIDATE_RELEASE_PROJECTION` is the sole producer of those two
  post-manifest projections. It runs only against the exact `FROZEN`
  CandidateBuildHead, FROZEN transition and terminal receipt, exact
  CandidateReleaseManifest and CandidateReleaseFreezeAttestation, unchanged
  CandidateInputHead and the still-matching captured `AVAILABLE`
  CandidatePromotionFence version. Its closed write phases are `TREE_BATCH`
  and `TERMINAL_ROOTS`. CanonicalWriterDispositionRegistry admits only the
  bounded object- and blob-projection tree-node carriers and the two terminal
  root carriers as `NAMED_CONTROL(CANDIDATE_RELEASE_PROJECTION)` under those
  exact dispatch tuples; every other carrier, phase and DML verb is
  `PROHIBITED`. `TREE_BATCH` has
  `CONTENT_ADDRESSED_BATCH_TUPLE_IS_RECEIPT`, `TERMINAL_ROOTS` has
  `TERMINAL_ROOT_SET_IS_RECEIPT`, and neither has a lifecycle receipt, outbox,
  serving grant or authority to advance CandidateBuildHead. The terminal phase
  independently expands the manifest-selected object universe and referenced
  immutable-blob universe under the frozen projection definition, requires
  fixed empty missing, extra, duplicate, conflicting-payload and wrong-lineage
  roots, and writes both roots atomically. PreCutoverCertification must bind
  their exact IDs and payload digests. Both terminal roots must exist before
  CandidateInputRecheckAttestation is issued or the promotion fence can move
  from `AVAILABLE` to `HELD(CURRENT_CANDIDATE)`. A crash may resume the same
  content-addressed batches; a different manifest, projection definition,
  frozen head or terminal root set is a conflicting request and writes nothing.
- `FREEZE` is fixed-size DML. It locks authorisation,
  IntakeProcessingPolicyHead, IntakeRevocationHead,
  CandidatePromotionFence, CandidateInputHead and CandidateBuildHead, requires
  the fence still equals the captured `AVAILABLE` version, the deadline has not
  passed and the input head still equals the sealed opening tuple, binds a fresh
  passing IntakeEligibilityRecheckAttestation,
  validates the sealed input, existing CorpusRelease, both fixed-size candidate
  output root-set identities, their common content digest and exact
  CandidateOutputInventoryReconciliation, both control-receipt tree roots,
  CandidateOutputControlReceiptReconciliation and terminal OUTPUT_SEALED
  CandidateOutputPreparationReceipt, passing CompositionContractSetAttestation,
  PreSealTraceabilityRoot and exact CandidateManifestMemberRoot and
  reconciliation,
  and writes only the immutable CandidateReleaseManifest and
  `CandidateReleaseFreezeAttestation`, then the
  immutable FROZEN CandidateBuildTransition, head CAS and terminal transition
  receipt in that order. The freeze attestation hashes
  schema, candidate generation, frozen pair, exact scope barrier, opening and
  still-current CandidateInputHead tuple, both CorpusRelease inventory root sets
  and their independence and equality proofs,
  CandidateInputSeal, both output root-set IDs and payload
  digests, their common content digest and
  CandidateOutputInventoryReconciliation, both control-receipt tree roots,
  CandidateOutputControlReceiptReconciliation and terminal preparation receipt,
  CandidateOutputSeal, PreSealTraceabilityRoot, CandidateManifestMemberRoot,
  CorpusRelease and CandidateReleaseManifest IDs, fresh
  intake recheck, captured promotion-fence version, opened-at evidence, fixed
  deadline and measured age, authorisation, writer executable and configuration
  evidence and terminal state. Corpus-sized members remain in immutable shards addressed by
  the roots. No lock set, transaction row count or DML volume grows with corpus
  size.
- `ABANDON_GENERATION` may move any non-terminal candidate state to `ABANDONED`
  under the exact expected head, captured `AVAILABLE` promotion-fence version
  and reason. Deadline expiry must invoke this transition and can never extend,
  freeze or publish the generation. If an output head exists, the transaction
  first appends its terminal OUTPUT_ABANDONED event and compare-and-swaps it to
  `ABANDONED`, writes its CandidateOutputPreparationReceipt, and only then writes
  the ABANDONED CandidateBuildTransition over that receipt, head compare-and-
  swap and transition receipt. No late output batch can commit.
  Prepared shards and any materialised CorpusRelease remain inaccessible
  garbage and cannot be selected by another generation. Exact replay returns the
  original receipt; a changed request uses a higher generation. Candidate freeze
  cannot create or repair a deal-scope, extraction or correction object, and no
  application sequence of `.from()` calls can substitute for any writer stage.
- Every ScopeBuildHead `OPEN`, `FROZEN` or `ABANDONED` transition has one typed
  `ScopeBuildTransitionReceipt`; every DealExtractionBuildHead open or abandon
  transition has one `DealExtractionBuildTransitionReceipt`; and every
  CandidateBuildHead transition has one `CandidateBuildTransitionReceipt`.
  Each hashes its action, exact immutable payload created by that action, before
  and after head tuples, resulting CandidateInputEvent where that event exists,
  canonical request digest, writer evidence and disposition. The immutable
  payload and input event precede the receipt and never hash it. This gives every
  mutable lifecycle change a terminal replay target without putting run metadata
  into semantic identities.
- `CandidateInputRecheckEnumeratorRegistry` is a frozen bundle contract with
  exactly `OBJECT_BLOB_A` and `OBJECT_BLOB_B`. For each role it fixes one
  read-only validator executable, configuration, authenticated principal,
  complete dependency graph, input view and output schema. It also fixes a
  separate independence-validator executable and key, the permitted shared
  canonical serialisation and hashing primitives and fixed proof lifetime. The
  two role dependency graphs, queries, views, caches, intermediate rows and
  outputs must otherwise have empty intersections.
- Before dispatch, those two registered validators each produce one signed,
  bounded, non-persistent `CandidateInputRecheckEnumerationProof`. Its ID hashes
  `CANDIDATE_INPUT_RECHECK_ENUMERATION_PROOF/V1`, schema, exact enumerator-
  registry ID and payload digest, role, CandidateReleaseFreezeAttestation,
  FROZEN CandidateBuildHead tuple, object and blob projection-root IDs and
  payload digests, captured CandidateInputHead, complete independently
  enumerated manifest-expanded object and referenced-blob neutral roots and
  counts, fixed empty missing, extra, duplicate and conflicting-payload roots,
  executable, configuration and dependency digests, issued-at, expiry, trusted-
  clock evidence and terminal `PASS`. A third registered validator produces one
  signed `CandidateInputRecheckIndependenceProof` hashing
  `CANDIDATE_INPUT_RECHECK_INDEPENDENCE_PROOF/V1`, schema, registry, both role-
  keyed proof IDs and payload digests, exact empty prohibited implementation,
  query, view, cache, intermediate and output intersections, validator evidence,
  issued-at, expiry and terminal `PASS`.
- These three proofs are embedded canonical subpayloads of the later
  CandidateInputRecheckAttestation, not separately persisted canonical objects,
  carriers, receipts or trace rows. Their registered read-only validators are
  their sole producers and have no DML credential. The writer verifies their
  signatures, roles, registry, complete payloads, current trust and expiry and
  redoes the bounded terminal equality checks. Traceability maps their exact
  nested IDs and payload digests through the attestation row. A direct proof
  insert, caller-authored role, detached proof reference or a separately mutable
  evidence table is prohibited.
- `ISSUE_INPUT_RECHECK` has the sole carrier
  `CandidateInputRecheckAttestation`, classified as
  `NAMED_CONTROL(CANDIDATE_INPUT_RECHECK)` with
  `ATTESTATION_IS_RECEIPT`. Every other action, phase, carrier and direct DML
  path is prohibited. It may write no lifecycle head, corpus or semantic data,
  serving row, cache or outbox record. The two embedded role proofs and embedded
  independence proof reproduce the complete manifest-expanded object and
  referenced-blob universes and require equality to the exact
  CandidateReleaseObjectProjectionRoot and CandidateReleaseBlobProjectionRoot
  with fixed empty difference roots before dispatch.
- In one short serialisable transaction `ISSUE_INPUT_RECHECK` locks
  authorisation, the current `AVAILABLE` CandidatePromotionFence,
  CandidateInputHead and the exact FROZEN CandidateBuildHead in its generated lock-plan order.
  It revalidates the frozen transition and receipt, freeze attestation,
  projection roots, current input and build tuples, scope, extraction and
  correction roots, authorisation, maximum age and expiry, then inserts only the
  attestation. Exact replay returns the same attestation-as-receipt. A refresh
  after expiry creates a new content-addressed attestation; any changed head,
  root, authorisation or unavailable fence writes nothing.
- A `CandidateInputRecheckAttestation` hashes the exact
  CandidateReleaseFreezeAttestation, exact current FROZEN CandidateBuildHead
  tuple and its immutable FROZEN CandidateBuildTransition and terminal receipt,
  CandidateInputSeal and both CorpusRelease inventory root sets, exact
  CandidateReleaseObjectProjectionRoot and CandidateReleaseBlobProjectionRoot
  IDs and payload digests and their independently revalidated equality to the
  manifest-expanded object and referenced-blob universes, captured
  CandidateInputHead tuple,
  exact embedded OBJECT_BLOB_A and OBJECT_BLOB_B enumeration-proof IDs and
  payload digests and their embedded independence-proof ID and payload digest,
  independently recomposed current frozen scope,
  extraction and correction-head roots, empty differences and validator
  evidence, created-at evidence, fixed maximum age and expiry. The three proof
  signatures are stored and verified with the embedded proofs but do not enter
  semantic identity. Its final
  serialisable validation locks CandidateInputHead and CandidateBuildHead in
  generated lock-plan order and requires byte equality with the frozen input and candidate
  tuples and unexpired age. A changed head or expired
  recheck makes the attestation fail; it cannot bless a newer input by showing
  that selected objects still exist. Required identity order is release manifest
  and freeze, FROZEN transition and receipt, object and blob projection roots,
  independent enumeration evidence, `ISSUE_INPUT_RECHECK`, attestation,
  `CURRENT_CANDIDATE` PromotionEligibilityProof and only then the held promotion
  fence. The attestation never hashes later promotion, deployment, bundle or
  import artefacts.
- The generated OperationActionRegistry, CanonicalPhysicalCarrierRegistry,
  CanonicalWriterDispositionRegistry, SQL grants, authorisation matrix, route
  budget, GeneratedLockPlanRegistry, candidate dependency DAG, PromotionEvidenceSlotRegistry
  and traceability matrix each contain this exact `ISSUE_INPUT_RECHECK` action,
  sole carrier, receipt policy and ordering. No generic attestation writer may
  substitute for it. Candidate promotion and every current-candidate evidence
  slot require an unexpired action-produced attestation; historical reactivation
  forbids it.
- `PromotionEligibilityProof` is a closed schema-level tagged union embedded in
  every held promotion fence, readiness mirror, cutover authorisation and
  activation event. `CURRENT_CANDIDATE` selects the exact unexpired
  CandidateInputRecheckAttestation above and requires its frozen CandidateInputHead
  and CandidateBuildHead tuples to remain current. `HISTORICAL_REACTIVATION`
  instead selects one exact unexpired
  `HistoricalReactivationEligibilityAttestation` and the originating
  RollbackEvent. Each variant carries an explicit forbidden-field marker for
  the other variant; a null, caller-selected third variant or use of an old
  CandidateInputRecheckAttestation in the historical branch is invalid. The
  historical branch never asserts that the present CandidateInputHead equals
  the prior release's frozen input head.
- `HistoricalReactivationEligibilityAttestation` is a signed immutable
  operational-control object created only by the status-and-deployment
  validator while serving is BLOCKED, exposure is off and both promotion and
  readiness are REVOKED, and the exact FailureRecoveryBranchHead is
  `HISTORICAL_REACTIVATION_IN_PROGRESS` for the same one-use attempt. The
  validator's closed
  `ISSUE_HISTORICAL_REACTIVATION_ELIGIBILITY` action may append only this object
  and its operational-audit row under unique key `(production_environment,
  FailureRecoveryBranch, historical_reactivation_attempt_id,
  intended_prior_tuple_digest, observed_current_head_tuple)`;
  the signed attestation is its terminal receipt, direct insert is denied and a
  conflicting replay writes nothing. Its ID hashes
  `HISTORICAL_REACTIVATION_ELIGIBILITY/V1`, schema, production environment,
  exact FailureRecoveryBranch and in-progress head version, exact RollbackEvent,
  its intended prior complete tuple and the observed
  higher exposure-off tuple, the target prior tuple's complete immutable field
  set and the required successor release-state generation, the exact retained
  CandidateReleaseManifest, CorpusRelease, serving namespace and header,
  ServingContractMetadata, ProductionImportAttestation, DeploymentManifest and
  ReleaseBundleEnvelope, and one contract-ordered prior-PASS-evidence root over
  PreCutoverCertification, POST_IMPORT trace, consumed CutoverAuthorisation,
  ActivationEvent, READY_CANONICAL ServingFenceVersion, passing
  PostCutoverSmokeAttestation, released AVAILABLE promotion fence,
  POST_ACTIVATION trace and the target release's
  `ReleaseActivationCertification`. The historical proof never requires a
  ProgrammeCompletionAttestation or programme-status terminal pair.
  It also hashes the exact current IntakeProcessingPolicyHead and activation,
  IntakeRevocationHead, a fresh target-release `POST_CUTOFF`
  IntakeEligibilityRecheckAttestation, the target
  ReleaseIntakeDependencyProjection and an independently recomputed equal root
  with fixed empty missing, extra, revoked and policy-invalid differences,
  fresh byte and availability rechecks for the retained namespace, header,
  metadata and blobs, the observed current CandidateInputHead tuple, current
  provider-signed deployment, build, configuration, alias, schema and migration
  assertions, exact equality to every corresponding target-tuple field and
  separate contract-approved provider, runtime, schema and migration rollback-
  compatibility proofs, retention proof, validator
  executable and configuration digests, created-at evidence, fixed maximum age,
  expiry and terminal `PASS`. An unavailable namespace, pruned object, later
  selected dependency revocation, archive-result-invalidating policy transition,
  irreversible or incompatible schema, changed migration, provider mismatch,
  partial target tuple or prior non-PASS evidence blocks the attestation. It may
  not import, rebuild or rewrite the historical release and cannot certify a
  mixture of prior and current tuple fields.
- `PostActivationControlActionRegistry` is generated first from the authored
  post-activation policy input. Its ID hashes
  `POST_ACTIVATION_CONTROL_ACTION_REGISTRY/V2`, schema,
  CanonicalBundleInputIdentity, the policy-input key, version and payload digest
  and exactly seven
  actions: `OPEN_WITH_ACTIVATION`, `ADOPT_READY`,
  `ADOPT_POST_ACTIVATION_TRACE`, `ISSUE_PASS_COMMIT_LEASE`, `COMMIT_PASS`,
  `BEGIN_FAILURE_CONTAINMENT` and `COMPLETE_FAILURE_CONTAINMENT`. Each entry
  fixes its permitted predecessor and result states, required typed evidence,
  sole producer and physical carrier, head, lease and idempotency-slot effects,
  receipt policy, disposition-dependent external-barrier position, row and byte
  bounds and generated lock-plan key. `BEGIN_FAILURE_CONTAINMENT` fixes exactly
  one `fence_order`: `CONTAINMENT_OWNS_FENCE` places BEGIN before its new fence
  and drain, while `ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE` requires the complete
  registered ordinary fence and drain before the coupled BEGIN. It contains no final PostActivationControlPolicy ID or payload
  digest. There is no implicit stage adoption, generic failure action, wildcard
  or eighth action.
- `PostActivationControlPolicy` is then a generated frozen contract object. Its ID
  hashes `POST_ACTIVATION_CONTROL_POLICY/V1`, schema, exact
  PostActivationControlActionRegistry ID and payload digest, trusted-clock policy,
  maximum READY-publication, POST_ACTIVATION-trace, smoke and containment
  durations, exact evidence schemas, transition table, restart-adoption rules,
  pass-lease lifetime and fixed row, byte and retry bounds. The generated order
  is policy input -> action registry -> policy; neither object hashes a later
  context, event, head, receipt or runtime evidence.
- `OPEN_WITH_ACTIVATION` is the sole genesis producer. The activation
  transaction first appends its ActivationEvent, then atomically creates one
  immutable `PostActivationControlContext`, appends its `CONTEXT_OPENED` event,
  installs the signed singleton `PostActivationControlHead` in
  `AWAITING_READY`, and finally writes the action receipt. The context ID hashes
  `POST_ACTIVATION_CONTROL_CONTEXT/V1`, schema, policy, action registry,
  production environment, exact PromotionEligibilityProof variant, held
  promotion fence, readiness mirror, CutoverAuthorisation, ActivationEvent,
  activated release tuple and the three absolute stage deadlines. No other
  action or carrier may create a context or genesis head.
- `PostActivationControlHead` has exactly `AWAITING_READY`,
  `AWAITING_POST_ACTIVATION_TRACE`, `AWAITING_SMOKE`,
  `FAILURE_CONTAINMENT_PENDING`, `PASS_FIXED` and `FAILURE_FIXED`. Each immutable
  `PostActivationControlEvent` hashes the context, action-registry entry, exact
  predecessor-head tuple, one closed event kind and typed evidence, trusted-time
  evidence and resulting state; the later head hashes the event.
  `ADOPT_READY` alone moves `AWAITING_READY` to
  `AWAITING_POST_ACTIVATION_TRACE`, and `ADOPT_POST_ACTIVATION_TRACE` alone moves
  that state to `AWAITING_SMOKE`. A controller restart may call the same action
  only when the exact signed READY fence or trace extension binds this context
  and completed within its absolute deadline. It advances once and does not
  republish, rerun or reinterpret the artefact. READY evidence has a bounded
  expiry and cannot be adopted or used after it.
- `PostActivationControlReceipt` hashes
  `POST_ACTIVATION_CONTROL_RECEIPT/V1`, schema, exact action-registry entry,
  context, canonical request digest, exact before-head tuple or genesis marker,
  action event ID and payload digest, exact after-head tuple, selected immutable
  action result, before-and-after lease-slot state where applicable, trusted
  evidence, writer executable and configuration digests and terminal
  disposition. Every state-changing action appends its event, compare-and-swaps
  the head and then writes this receipt in one transaction; the event never
  hashes the later head or receipt. The action registry is the sole producer,
  CanonicalPhysicalCarrierRegistry gives the receipt one closed
  `NAMED_CONTROL(POST_ACTIVATION_CONTROL)` carrier, and every action is receipt-
  required with no serving grant or outbox. Exact replay returns the same
  receipt; a different request, evidence, predecessor, result or action against
  the same idempotency slot conflicts and writes nothing.
  CanonicalPhysicalCarrierRegistry and CanonicalWriterDispositionRegistry map a
  `ContainmentReleaseTupleDisposition` only to the applicable post-activation or
  legacy post-commit BEGIN action under its exact named-control carrier; every
  direct insert, caller-supplied variant and other producer is `PROHIBITED`.
- `PostActivationFailureEvidence` has exactly nine variants:
  `READY_PUBLICATION_FAIL`, `READY_PUBLICATION_TIMEOUT`,
  `POST_ACTIVATION_TRACE_FAIL`, `POST_ACTIVATION_TRACE_TIMEOUT`, `SMOKE_FAIL`,
  `SMOKE_TIMEOUT`, `SMOKE_CRASH`, `PASS_COMMIT_LEASE_EXPIRED` and
  `ACTIVE_RELEASE_REVOCATION`. A fail variant binds the exact signed
  controller, trace, smoke or supervisor failure; a timeout binds trusted time
  at or after the applicable absolute deadline and proves the required passing
  artefact absent under two bounded indexed checks.
  `PASS_COMMIT_LEASE_EXPIRED` binds the exact passing smoke, lease-issuance event
  and receipt, post-issuance `AWAITING_SMOKE` head, issued but unconsumed and
  unrevoked lease slot, trusted time at or after its expiry and independently
  proven absence of COMMIT_PASS receipt, PASS_FIXED head, AVAILABLE successor
  and first-cutover success effects. `ACTIVE_RELEASE_REVOCATION` binds the exact
  ActiveReleaseRevocationActionRegistry entry and cause evidence, acknowledged
  BLOCKED fence and drain, ordinary RollbackEvent and
  ActiveReleaseRevocationReceipt, observed awaiting control head and exact
  higher exposure-off tuple. Each ID hashes
  `POST_ACTIVATION_FAILURE_EVIDENCE/V1`, schema, context, exact current head,
  variant, stage inputs, evidence and policy. There is no generic failure reason
  or caller-selected variant. Only `SMOKE_FAIL` requires a failed smoke;
  `PASS_COMMIT_LEASE_EXPIRED` requires its exact passing smoke; no other variant
  may invent either merely to close traceability.
- A passing smoke permits issuance of one short-lived signed
  `PostActivationPassCommitLease` bound to the context, exact
  `AWAITING_SMOKE` predecessor head, passing READY, trace and smoke evidence,
  action request, nonce and expiry. `ISSUE_PASS_COMMIT_LEASE` alone creates it,
  appends `PASS_COMMIT_LEASE_ISSUED`, advances the head generation while
  retaining state `AWAITING_SMOKE`, and writes its receipt. The event selects
  the lease, while the lease hashes only earlier inputs and therefore creates no
  cycle. It has one consumption-or-revocation slot, cannot be reissued and has
  no authority after expiry. An issued lease reaching expiry unconsumed and
  unrevoked must produce `PASS_COMMIT_LEASE_EXPIRED` and enter the existing
  BEGIN-to-COMPLETE containment path; it cannot leave the controller awaiting
  indefinitely. `COMMIT_PASS` locks that exact current head and
  lease slot, active release tuple, CandidatePromotionFence, readiness head and,
  for first cutover, CanonicalCutoverGenesisHead in generated global order. It
  revalidates the context-bound exposure-on tuple, HELD promotion, READY
  evidence and every smoke input and, in one serialisable transaction, appends the `PASS_FIXED`
  event, compare-and-swaps the head, consumes the lease and writes its receipt
  before the policy's bounded database success objects. The receipt hashes the
  exact pre-effect success-plan digest and preceding event, head and lease
  tuples, never an ID or payload digest of a later AVAILABLE fence or genesis
  object. The AVAILABLE successor and any first-cutover establish event and
  terminal genesis head then hash that already complete receipt and are written
  later in the same transaction. An ordinary revocation locks the same control
  head before release and readiness state, so COMMIT winning first may complete
  before a later revocation, while revocation winning first makes COMMIT's
  revalidation fail with zero pass DML.
- `ActiveReleaseRevocationActionRegistry` is a generated frozen contract object.
  Its ID hashes `ACTIVE_RELEASE_REVOCATION_ACTION_REGISTRY/V1`, schema,
  CanonicalBundleInputIdentity, the complete ordered entries and fixed empty
  missing, extra, duplicate, conflicting and wildcard roots. Its cause codes are
  exactly `GATE`, `INTAKE_ELIGIBILITY`, `PROCESSING_POLICY`,
  `PROGRAMME_STATUS`, `SECURITY`, `READINESS_INTEGRITY`, `DEPLOYMENT`,
  `ALIAS_OR_TRAFFIC`, `RUNTIME_CONFIGURATION`, `DATABASE_SCHEMA` and
  `DATABASE_MIGRATION`. Each entry fixes typed trigger evidence, authoritative
  producer, permitted before-to-after tuple-field difference, named-control
  carrier, GeneratedLockPlan key, observed-controller classification and
  mandatory awaiting-controller coupling plan and receipt contract. It contains no final
  bundle fingerprint or runtime object. An unregistered cause, generic reason,
  wildcard field difference or producer substitution fails contract generation
  and runtime DML.
- `ContainmentReleaseTupleDisposition` is the closed release-state convergence
  contract shared by the post-activation and legacy post-commit controllers.
  Its ID hashes `CONTAINMENT_RELEASE_TUPLE_DISPOSITION/V1`, schema, controller
  kind and context, exact failure evidence, context-bound active-before tuple,
  exact release tuple locked by BEGIN, one closed variant, exactly one closed
  `fence_order` and its evidence. In `COMPLETE_OWNS_EXPOSURE_OFF_CAS`,
  `fence_order=CONTAINMENT_OWNS_FENCE`; the locked tuple is byte-equal to the active-
  before tuple and the disposition fixes the exact proposed higher exposure-off
  tuple digest that COMPLETE alone may install. In
  `ADOPT_PRIOR_EXPOSURE_OFF`,
  `fence_order=ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`; the locked tuple is already a strictly higher,
  exposure-off generation produced by one or more registered ordinary
  revocations. The disposition binds the complete contiguous ordered
  ActiveReleaseRevocationReceipt and `RollbackEvent(kind=ORDINARY_REVOCATION)`
  chain from the context-bound active-before tuple to the exact locked current
  tuple, every acknowledged BLOCKED fence and drain, and fixed empty gap, fork,
  overlap, stale-predecessor and illegal-field-difference roots;
  COMPLETE must preserve
  the tuple byte-for-byte. Every ordinary revocation that changes an active
  release tuple atomically appends that typed RollbackEvent and receipt. The
  receipt ID hashes `ACTIVE_RELEASE_REVOCATION_RECEIPT/V1`, schema, exact
  ActiveReleaseRevocationActionRegistry entry and payload digest, exact typed
  cause evidence, acknowledged fence and drain evidence,
  before-and-after readiness, promotion and release tuples, RollbackEvent ID and
  payload digest, exact observed active controller-head tuple set or explicit
  no-active-nonterminal-controller marker, required-coupling plan digest,
  canonical request, writer executable and configuration digests
  and terminal `PASS`; the event precedes and is selected by the receipt. The
  registered revocation action is their sole named-control producer and every
  other carrier or direct insert is prohibited. No
  caller-selected third variant, mismatched fence order, unreceipted update,
  lower generation, exposed tuple, partial field set or non-contiguous mixture
  of revocations is valid.
  If its generated locks observe an `AWAITING_*` post-activation head or either
  awaiting legacy post-commit head, that same serialisable ordinary-revocation
  transaction must, after the RollbackEvent and receipt, create the matching
  `ACTIVE_RELEASE_REVOCATION` or `LEGACY_ACTIVE_RELEASE_REVOCATION` evidence,
  adopted tuple disposition and invoke the existing registered BEGIN action to
  append its event, install the pending head and write its receipt. Those later
  objects select the revocation receipt; the receipt hashes only the earlier
  observed head and pre-effect coupling plan, so the order is acyclic. All
  release-state and controller effects commit or none do. An already-pending
  controller must be joined through its byte-identical COMPLETE action or the
  ordinary transaction writes zero database DML. A terminal controller or no
  active controller requires no new failure evidence. This coupling creates no
  new controller action and grants the revocation producer no direct controller-
  carrier authority.
- `BEGIN_FAILURE_CONTAINMENT` may start from any exact `AWAITING_*` head,
  including the post-issuance `AWAITING_SMOKE` generation selected by
  `PASS_COMMIT_LEASE_EXPIRED`. It validates and
  selects exactly one `PostActivationFailureEvidence`, locks the same head and
  lease slot as `COMMIT_PASS` and the current release tuple, derives exactly one
  `ContainmentReleaseTupleDisposition`, revokes any unconsumed lease, fixes the
  absolute containment deadline and exact required fence and drain scope in its event,
  compare-and-swaps the head to `FAILURE_CONTAINMENT_PENDING`, and writes its
  receipt in one database transaction. For
  `fence_order=CONTAINMENT_OWNS_FENCE`, it performs no external fence publication
  or drain and this database CAS occurs before its external `BLOCKED` work. For
  `fence_order=ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, only the registered
  ordinary-revocation transaction may invoke BEGIN, after its acknowledged
  BLOCKED fence, drain, exposure-off RollbackEvent and receipt and in the same
  atomic database commit; BEGIN performs no second fence, drain or release-state
  DML. The BEGIN head CAS is the pass-race linearisation point: if `COMMIT_PASS`
  commits first, BEGIN writes nothing; if BEGIN commits first, COMMIT can no
  longer consume the revoked lease or leave the pending state.
- Only `CONTAINMENT_OWNS_FENCE` publishes and acknowledges the higher `BLOCKED`
  ServingFenceVersion and drains the exact leases after the committed BEGIN
  receipt. The adopted order selects the already acknowledged ordinary fence
  and drain and must not publish a second one. Missing required evidence at the
  fixed deadline leaves the context pending and
  exposure fail-closed; it never authorises pass. That deadline governs alerting
  and escalation, not transition expiry. Late completion remains mandatory only
  for the identical pending head, trigger, BEGIN receipt, tuple disposition,
  fence and drain scope and must bind trusted
  `CONTAINMENT_DEADLINE_EXCEEDED` evidence. `COMPLETE_FAILURE_CONTAINMENT`
  alone consumes the exact pending head, BEGIN receipt, selected failure
  evidence, acknowledged fence, drain evidence and exact
  `ContainmentReleaseTupleDisposition`. Its transaction either compare-and-swaps
  the disposition's owned active-before tuple to its exact proposed exposure-off
  tuple and appends `RollbackEvent(kind=POST_ACTIVATION_CONTAINMENT)`, or proves
  the adopted prior exposure-off tuple remains byte-identical and selects its
  already complete ordinary-revocation RollbackEvent without release-state DML.
  It writes or selects the exact required higher REVOKED promotion and readiness
  versions and never rewinds an existing revocation. For
  a `CURRENT_CANDIDATE` context, that same serialisable transaction
  consumes the one-use
  `FailureRecoveryBranchSlot`, creates exactly one immutable
  `FailureRecoveryBranch`, installs its head at `OPEN`, appends the
  `FAILURE_FIXED` control event, compare-and-swaps the post-activation head and
  writes its receipt, in that order. The slot ID hashes
  `FAILURE_RECOVERY_BRANCH_SLOT/V1`, schema, production environment and
  PostActivationControlContext and is independent of failure reason. The branch
  ID hashes `FAILURE_RECOVERY_BRANCH/V2`, schema, slot, frozen pair, candidate
  generation, ActivationEvent, exact typed PostActivationFailureEvidence and
  selected containment-owned or adopted ordinary-revocation RollbackEvent and
  exposure-off tuple. Its smoke fields follow the selected trigger:
  `SMOKE_FAIL` requires the failed smoke, `PASS_COMMIT_LEASE_EXPIRED` requires
  the passing smoke and issuance chain, and every other trigger carries only its
  stage-applicable smoke or absence proof. Terminal reason, recovery choice and
  later outcome remain excluded. A historical-reactivation failure uses its
  existing in-progress branch and cannot consume a new slot or open a nested
  branch. Its transaction first completes the selected tuple-disposition path,
  appends its `FAILURE_FIXED` event, compare-and-swaps the control head and writes
  the COMPLETE receipt over a pre-outcome result plan. Only then does it create
  the failed-or-abandoned outcome and compare-and-swap the existing branch to
  `OUTCOME_FIXED`; that outcome root selects the already complete receipt and
  FAILURE_FIXED head, while the receipt hashes neither later branch object. No direct
  `AWAITING_READY`, `AWAITING_POST_ACTIVATION_TRACE` or `AWAITING_SMOKE` to
  `FAILURE_FIXED` transition exists. `PASS_FIXED` and `FAILURE_FIXED` are
  absorbing; late evidence has no publication, recovery or completion
  authority.
- `FailureRecoveryBranchHead` has only `OPEN`,
  `HISTORICAL_REACTIVATION_IN_PROGRESS` and `OUTCOME_FIXED`. Each version hashes
  schema, branch ID, contiguous generation, predecessor digest, state, exact
  selected historical attempt or forbidden-field marker and, only for
  OUTCOME_FIXED, one `FailureRecoveryOutcome` plus its complete evidence root.
  The outcomes remain `NO_HISTORICAL_REACTIVATION`,
  `HISTORICAL_REACTIVATION_SUCCEEDED` and
  `HISTORICAL_REACTIVATION_ABANDONED_OR_FAILED`. From OPEN, only
  `FIX_NO_HISTORICAL_REACTIVATION` or `BEGIN_HISTORICAL_REACTIVATION` may win.
  From in-progress, only the matching success or abandoned-or-failed CAS may
  win. `OUTCOME_FIXED` is absorbing.
- First-cutover legacy restoration has exactly two writer actions:
  `COMMIT_PASS` and `RECORD_FAIL`. The writer locks the branch and restoration-
  receipt-chain head, assigns the next contiguous ordinal and creates one
  `LegacyBaselineRestorationReceipt`. Its ID hashes
  `LEGACY_BASELINE_RESTORATION_RECEIPT/V1`, schema, branch, writer-assigned
  ordinal, predecessor receipt or genesis, action, exact
  LegacyBaselineRestorationAttestation, before and after release and genesis
  tuples, canonical request digest and transaction result. COMMIT_PASS accepts
  only PASS evidence and atomically restores the exact governed legacy database
  tuple under BLOCKED exposure before advancing the receipt chain and opening
  the post-commit controller below. RECORD_FAIL
  accepts only typed FAIL evidence, proves zero restoration mutation and
  advances the same chain. Exact replay returns the receipt; a retry after
  RECORD_FAIL receives a higher writer-assigned ordinal. No implicit attempt
  limit or failed attestation fixes the branch outcome.
  `LegacyBaselineRestorationReceiptHead` contains only branch, next ordinal and
  current receipt ID and payload digest; both actions compare-and-swap it, and no
  caller supplies an ordinal.
- `LegacyBaselineRestorationPostCommitPolicy` hashes
  `LEGACY_BASELINE_RESTORATION_POST_COMMIT_POLICY/V1`, schema, trusted-clock
  policy, READY and smoke deadlines, closed evidence schemas, fixed row, byte
  and retry bounds, generated lock-plan key and exactly five actions:
  `OPEN_WITH_RESTORATION_PASS`, `ADOPT_READY_LEGACY`,
  `ADOPT_LEGACY_SMOKE_AND_FIX`, `BEGIN_POST_COMMIT_ABANDONMENT` and
  `COMPLETE_POST_COMMIT_ABANDONMENT`. The successful restoration `COMMIT_PASS`
  transaction is the sole producer of `OPEN_WITH_RESTORATION_PASS`: after it
  writes the governed legacy tuple and `LegacyBaselineRestorationReceipt`, it
  creates one `LegacyBaselineRestorationPostCommitContext`, appends its genesis
  event, installs its head at `AWAITING_READY_LEGACY` and writes its post-commit
  receipt. The context ID hashes
  `LEGACY_BASELINE_RESTORATION_POST_COMMIT_CONTEXT/V1`, schema, policy,
  production environment, FailureRecoveryBranch, exact COMMIT_PASS receipt and
  passing restoration attestation, restored legacy tuple, acknowledged BLOCKED
  fence and absolute READY and smoke deadlines. RECORD_FAIL, retry code and a
  caller cannot create one.
- `LegacyBaselineRestorationPostCommitHead` has exactly
  `AWAITING_READY_LEGACY`, `AWAITING_LEGACY_SMOKE`, `ABANDONMENT_PENDING`,
  `LEGACY_READY_FIXED` and `LEGACY_ABANDONED_FIXED`. Each
  `LegacyBaselineRestorationPostCommitEvent` hashes the context, exact
  predecessor-head tuple, one of the five policy actions, typed evidence,
  trusted time and resulting state; the later head hashes the event.
  `LegacyBaselineRestorationPostCommitReceipt` hashes
  `LEGACY_BASELINE_RESTORATION_POST_COMMIT_RECEIPT/V1`, schema, context, action,
  canonical request digest, exact before head or genesis marker, event ID and
  payload digest, exact after head, selected immutable action result, writer
  evidence and terminal disposition. Every action writes event, head and
  receipt in that atomic order. The policy action is the sole producer; exact
  replay returns the receipt and any conflicting evidence, predecessor or
  result at the same action slot writes nothing.
- `ADOPT_READY_LEGACY` alone validates an exact bounded
  `READY_LEGACY_BASELINE` fence for this context and moves
  `AWAITING_READY_LEGACY` to `AWAITING_LEGACY_SMOKE`.
  `ADOPT_LEGACY_SMOKE_AND_FIX` alone validates the exact passing legacy smoke
  evidence by its deadline and, in one serialisable transaction, writes its
  success event, moves `AWAITING_LEGACY_SMOKE` to `LEGACY_READY_FIXED` and
  writes its action receipt before the genesis-return event and head and before
  the no-historical-reactivation branch-outcome CAS. The later objects select
  that receipt; the receipt hashes none of them.
  `LegacyBaselineRestorationPostCommitFailureEvidence`
  has exactly six variants: `LEGACY_READY_PUBLICATION_FAIL`,
  `LEGACY_READY_PUBLICATION_TIMEOUT`, `LEGACY_SMOKE_FAIL`,
  `LEGACY_SMOKE_TIMEOUT`, `LEGACY_SMOKE_CRASH` and
  `LEGACY_ACTIVE_RELEASE_REVOCATION`. The last binds the exact
  ActiveReleaseRevocationActionRegistry entry and cause, acknowledged ordinary
  BLOCKED fence and drain, RollbackEvent, ActiveReleaseRevocationReceipt,
  observed awaiting legacy head and higher exposure-off tuple. Its ID hashes
  `LEGACY_BASELINE_RESTORATION_POST_COMMIT_FAILURE_EVIDENCE/V1`, schema,
  context, exact current head, variant, stage inputs, variant-specific signed
  failure, trusted-time absence or registry-backed revocation evidence and
  policy. There is no generic failure reason.
- `BEGIN_POST_COMMIT_ABANDONMENT` selects exactly one such failure, locks the
  same post-commit head as the applicable success action and the current release
  tuple, derives exactly one `ContainmentReleaseTupleDisposition`, fixes the external
  reblock and drain deadline, appends its event, compare-and-swaps the head to
  `ABANDONMENT_PENDING` and writes its receipt. Under
  `CONTAINMENT_OWNS_FENCE` this occurs before any external reblock. Under
  `ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, only the registered ordinary-
  revocation transaction may invoke BEGIN, after its complete acknowledged
  ordinary fence, drain, RollbackEvent and receipt and in the same atomic
  database commit; it performs no second external or release-state effect.
  Thus READY adoption or smoke success and abandonment intent compete at one
  database CAS. Only the owned order publishes and acknowledges the higher
  BLOCKED fence and drains leases after BEGIN; the adopted order selects and
  preserves its already complete ordinary controls.
  `COMPLETE_POST_COMMIT_ABANDONMENT` alone consumes the pending head, BEGIN
  receipt, failure evidence, acknowledged BLOCKED fence, drain evidence and the
  exact tuple disposition. In one serialisable transaction it either performs
  the owned exact active-before to exposure-off CAS or byte-preservingly adopts
  the disposition's already complete ordinary revocation and RollbackEvent,
  then appends its event, moves the head to
  `LEGACY_ABANDONED_FIXED` and writes its receipt, in that order. Only that
  receipt proves the produced exposure-off tuple. The later
  POST_COMMIT_PASS_FAILURE abandonment decision selects that receipt and head,
  and only the still later branch-outcome CAS selects the decision. Missing
  fence or drain evidence leaves the controller pending and exposure fail-
  closed. The fixed containment deadline governs alerting and escalation, not a
  transition expiry: COMPLETE remains legal after it only for the identical
  pending head, trigger, BEGIN receipt, tuple disposition, fence and drain scope and must then bind
  trusted `CONTAINMENT_DEADLINE_EXCEEDED` evidence. It can never enable service
  or change the trigger. Both fixed states are absorbing, and there is no direct
  awaiting-to-abandoned transition.
- Abandoning legacy restoration requires an immutable
  `LegacyBaselineRestorationAbandonmentDecision`. Its ID hashes
  `LEGACY_BASELINE_RESTORATION_ABANDONMENT_DECISION/V2`, schema, branch, one
  closed variant, governed rationale, eligible decision-maker evidence, exact
  acknowledged BLOCKED fence and exposure-off tuple and variant-specific fixed
  empty forbidden-field roots. `PRE_COMMIT_FAILURE` binds the complete receipt-
  chain tip, at least one ordered RECORD_FAIL receipt, zero COMMIT_PASS receipt,
  zero post-commit context and an empty live-attempt root; it prevents every
  later retry or COMMIT_PASS. `POST_COMMIT_PASS_FAILURE` binds the exact
  COMMIT_PASS receipt, post-commit context, typed failure evidence, exact
  ContainmentReleaseTupleDisposition, BEGIN and COMPLETE receipts and terminal
  `LEGACY_ABANDONED_FIXED` head and has empty
  pre-commit failed-receipt and live-controller roots. No third variant or
  mixture is valid. A passing COMMIT_PASS can support restored legacy service
  only through terminal `LEGACY_READY_FIXED`; the receipt alone is insufficient.
- CanonicalPhysicalCarrierRegistry and CanonicalWriterDispositionRegistry map
  the post-commit policy, context, event, head transition, receipt, failure
  evidence and branch-bound ContainmentReleaseTupleDisposition only to
  `NAMED_CONTROL(LEGACY_BASELINE_RESTORATION_POST_COMMIT)`.
  GeneratedLockPlanRegistry places its head, restoration receipt-chain head,
  canonical release state, serving fence, readiness and recovery branch in one
  generated order for every action. Direct DML, action substitution, an
  awaiting-to-fixed shortcut, a success after abandonment intent or use of a
  post-commit object by a non-genesis restoration is `PROHIBITED`.
- `FailureTraceabilityObjectRegistry` has exactly six terminal topology
  variants: `NON_GENESIS_NO_HISTORICAL_REACTIVATION`, `LEGACY_RESTORED`,
  `LEGACY_RESTORATION_ABANDONED`,
  `HISTORICAL_ABANDONED_PRE_ACTIVATION`,
  `HISTORICAL_FAILED_AFTER_ACTIVATION` and `HISTORICAL_SUCCEEDED`. They
  respectively require the explicit no-recovery decision; the exact COMMIT_PASS
  restoration receipt plus one post-commit context, its ordered READY and smoke
  evidence, terminal `LEGACY_READY_FIXED` event, head and receipt; one
  `LegacyBaselineRestorationAbandonmentDecision/V2` whose closed evidence is
  either the complete PRE_COMMIT_FAILURE receipt chain or the exact
  POST_COMMIT_PASS_FAILURE context, failure evidence, pending and terminal
  events, heads and receipts;
  in-progress branch plus pre-ActivationEvent abandonment; historical
  PostActivationFailureEvidence plus BEGIN and COMPLETE containment receipts
  and terminal FAILURE_FIXED head; or historical PostActivationControlHead at
  PASS_FIXED plus consumed pass lease and COMMIT_PASS receipt. The first
  three map to `NO_HISTORICAL_REACTIVATION`, the next two to
  `HISTORICAL_REACTIVATION_ABANDONED_OR_FAILED`, and the last to
  `HISTORICAL_REACTIVATION_SUCCEEDED`. Every topology binds the originating
  ContainmentReleaseTupleDisposition; the post-commit-abandonment and
  historical-after-activation topologies additionally bind their distinct later
  dispositions. No open evidence variant or generic
  reason is permitted.
- The failure terminal is selected by one immutable
  `TraceabilityFailureTerminalSlot` whose identity is
  `H("TRACEABILITY_FAILURE_TERMINAL_SLOT/V1", schema,
  failure_recovery_branch_id)`. Terminal reason is a derived payload field, not
  part of the slot or wrapper uniqueness key. The slot remains unavailable
  until the exact branch head is OUTCOME_FIXED, then selects exactly one of the
  six closed topology variants. The validator may build one and only one
  TraceabilityFailureTerminal. It hashes the fixed branch-head version and
  complete variant evidence; the head hashes neither slot nor terminal.
  Competing reasons cannot create two wrappers, and terminal publication
  permanently rejects later branch mutation.
- Promotion then uses a signed singleton `CandidatePromotionFence` with an
  append-only version chain and states `AVAILABLE`, `HELD` or `REVOKED`. A
  version hashes schema, predecessor or genesis, contiguous generation, state,
  exact target candidate and release tuple or explicit no-candidate marker,
  observed current CandidateInputHead tuple, holder purpose, fixed expiry and
  immutable transition evidence. A `HELD` version additionally hashes the exact
  PromotionEligibilityProof. `CURRENT_CANDIDATE` also hashes the
  CandidateReleaseFreezeAttestation, exact FROZEN CandidateBuildHead tuple,
  transition and receipt and frozen pair. `HISTORICAL_REACTIVATION` instead
  hashes the FailureRecoveryBranch and exact
  `HISTORICAL_REACTIVATION_IN_PROGRESS` head version, the
  HistoricalReactivationEligibilityAttestation, originating
  RollbackEvent, exact exposure-off before tuple and exact retained target tuple;
  it forbids a CandidateBuildHead-currentness claim for the historical target.
  Its genesis `AVAILABLE` version is created only by the generated
  `CONTRACT_FREEZE/INITIALISE_CANDIDATE_PROMOTION_FENCE` action in the same
  serialisable transaction that first installs the approved
  ContractFreezeAttestation and genesis CandidateInputHead. It requires no
  existing fence, carries `NO_CANDIDATE`, generation 1 and the exact frozen
  contract pair, and its receipt is the sole genesis evidence. Exact replay
  returns that version; any second genesis or split transaction writes nothing.
  The controller signature is stored outside the version payload and covers its
  completed digest. Pre-cutover certification locks CandidatePromotionFence,
  CandidateInputHead and CandidateBuildHead in its generated lock-plan order and may compare-and-
  swap `AVAILABLE` to `HELD(CURRENT_CANDIDATE)` only when the candidate recheck
  is current and the build head still names its exact FROZEN transition and
  receipt. Separately, after rollback containment, the validator locks current
  policy and revocation heads, FailureRecoveryBranchHead,
  CandidatePromotionFence, CandidateInputHead, readiness and release state in
  generated lock-plan order and may compare-and-swap only the
  exact RollbackEvent-bound `REVOKED` version to
  `HELD(HISTORICAL_REACTIVATION)`. It requires exposure off, the attestation's
  branch head to remain byte-equal and in progress for the same attempt, the
  observed current CandidateInputHead to remain byte-equal to the locked current
  head, every current policy, dependency, provider and compatibility proof to
  remain valid and the exact exposure-off tuple to remain current. It never
  compares the current input head with the historical frozen input head. Both
  acquisitions are fail-fast and never queued. Every ordinary operation that would advance
  CandidateInputHead locks the fence first and requires `AVAILABLE`; it cannot
  wait behind or bypass a held promotion. Production import accepts only the
  current-candidate branch. Readiness, authorisation, activation and post-cutover
  smoke must carry and revalidate the same held version and exact eligibility
  variant. Only the winning PostActivation `COMMIT_PASS` action may install a higher
  `AVAILABLE` version; it hashes the PASS_FIXED context head, consumed
  PostActivationPassCommitLease, exact COMMIT_PASS receipt and exact passing READY, trace and smoke
  evidence. A passing smoke alone has no fence authority.
  `CANDIDATE_RELEASE_FREEZE/ABANDON_HELD_PROMOTION` is the sole pre-activation
  current-candidate abandonment action. It may install `AVAILABLE` only after
  proving no ActivationEvent
  exists for the held target or the acknowledged ServingFenceVersion is BLOCKED
  and database exposure is off, and it atomically appends the typed abandonment
  event, fence successor and receipt under the generated lock plan. After a
  failed activation has installed `REVOKED`, only
  `FAILURE_RECOVERY/RESTORE_CANDIDATE_PROMOTION_AVAILABILITY` may return the
  fence to `AVAILABLE`. It requires the exact failed attempt's terminal
  containment, passing legacy or historical restoration smoke, exposure on only
  for that restored prior tuple, fixed FailureRecoveryBranchHead and
  TraceabilityFailureTerminal, and writes the recovery event, no-candidate
  AVAILABLE successor and receipt atomically. Historical-reactivation abandonment instead
  installs a higher `REVOKED` version and records immutable typed abandonment
  evidence naming its originating RollbackEvent; the later failure terminal
  selects that evidence. An expired hold installs `REVOKED`, never automatically
  `AVAILABLE`, and forces the same fail-closed exposure proof. Emergency intake
  or security revocation likewise installs `REVOKED` and may never restore
  availability or publication. The fence prevents input drift during promotion;
  it is not a corpus-release authority and cannot make an uncertified candidate
  active.
- Every complete canonical-write dispatch tuple
  `(operation, action_variant, discriminator, write_phase, physical_carrier,
  logical_type, schema_version, DML_verb)` has exactly one generated
  `execution_class`, `receipt_policy` and outbox policy in
  CanonicalWriterDispositionRegistry. Different closed discriminators or write
  phases of one action may have different policies; no policy exists at an
  action-only wildcard. Later references to an action's policy mean this
  complete dispatch tuple. `STATE_ADVANCING` and `EVENT_APPENDING` dispatches
  record an immutable writer-attempt envelope, perform permitted writes
  inside a caught PostgreSQL subtransaction and require the registry-declared
  terminal operation receipt and outbox disposition. Success writes those
  controls in the outer transaction. A caught validation or constraint failure
  rolls back every canonical write but commits one correlated failure receipt
  and failure outbox event. A transport failure before the database accepts the
  RPC is operational and cannot claim a canonical audit. A missing required
  terminal receipt is quarantined and alerted, never interpreted as success.
- Only an exact generated `CONTENT_ADDRESSED_CONTROL_BUILDER` dispatch tuple writes no
  writer-attempt envelope, operation receipt, preparation event, mutable-head
  transition or outbox event. Its terminal success value is the exact content-
  addressed result tuple; exact replay returns that tuple without new rows and
  conflicting bytes at the same stable key write nothing. It may write only the
  immutable, inaccessible, bounded control carriers listed for that dispatch and
  must be authenticated by the later named seal or attestation. This policy
  applies only to CorpusScope PREPARE_BATCH controls, cutoff inventory and
  control-receipt builders, Candidate PREPARE_INPUT_BATCH inventory builders,
  Candidate PREPARE_INPUT_BATCH applicability-reexamination tree and terminal-
  manifest builders,
  the three inventory-enumerator-independence attestation builders,
  candidate-output inventory and control-receipt builders and the expressly
  registered traceability, manifest-member, candidate object/blob projection,
  and the expressly registered immutable, content-addressed subphases of
  `RELEASE_BUNDLE_CONTROL_BUILD`: independence, launch- and context-trust proof,
  neutral-node, output-set, member/support-root, reconciliation,
  PromotionEvidenceSlotRoot and envelope controls. ReleaseBundleControlContext,
  lifecycle event, head transition, action receipt, run claim, terminal output,
  finalisation, abandonment, failure evidence, spool-erasure receipt and
  receipt-set dispatches and attempt-audit terminal are receipt-required and
  never inherit that exemption. The exact release-bundle and production
  `ATTEMPT_AUDIT_TREE_BATCH` tuples alone use the content-addressed batch-tuple
  exemption for their `OPERATIONAL_AUDIT` nodes; that does not change their
  disposition or grant them release or trace authority. The exemption also covers the expressly registered
  import member/support/receipt parity, import walker independence, launch-
  trust proof, claim, output and output-set, ProductionBlobAvailability-root and importer
  CompositionContractSetRecompositionRoot builders and their reachable nodes,
  and the expressly registered post-seal semantic-parity role-registry-bound
  independence, launch-proof, one-use role-claim, neutral-node, role-output,
  output-set, reconciliation, context-seal and terminal-attestation builders.
  SEAL,
  FREEZE, ABANDON, lifecycle transition, semantic materialisation and every other
  dispatch remain receipt-required. No runtime or caller may claim the exemption.
- Exact idempotent replay returns the original terminal operation receipt
  without new rows. Reuse of an idempotency key with a different canonical
  request digest fails closed. `CERTIFIED_RELEASE_IMPORT_BATCH` uses the same RPC and insertion
  constraints, but may only copy checksum-verified immutable objects named by
  an authorised release bundle into an inactive namespace. It cannot derive,
  normalise, correct, supersede or select an active release.
- Corrections carry a `correction_slot_key`, exact typed proposed-target
  selector, exact expected prior revision or immutable object digest or
  governed genesis marker and exact stage. Each `CorrectionSlotDefinition`
  governs its one permitted stage,
  permitted target-reference variant, patch schema, allowed prior and output
  states, closed primary and consistency output-reference schemas, exact output
  cardinalities and one effect: `CREATE_REVISION`, `SUPERSEDE_OCCURRENCE`,
  `RETIRE_OCCURRENCE`, `ADD_COEXISTING_OCCURRENCE`,
  `SUPERSEDE_IMMUTABLE_OBJECT` or `CHANGE_MANIFEST_MEMBERSHIP`. Its
  `output_contract_digest` hashes those complete rules. A classification correction either supersedes a
  specified immutable ProvisionInstance, retires it or adds a coexisting object
  through a specified `SourceClassificationSlot`.
  Anchor-only replacement is prohibited because one anchor may support several
  semantic objects. A component correction supersedes the exact immutable
  component occurrence and expected object digest. Semantic-discovery,
  relationship-expectation, scope-dependency, closure, claim,
  relationship-effect and relationship corrections target their exact governed
  slot, occurrence or prior revision IDs. A scope-stage correction is applied
  before the corrected DealScopeRunManifest is built, then requires a higher
  scope-build generation and new CorpusScopeFreezeAttestation. It cannot patch a
  frozen scope or edit an independent challenge disposition in place. A
  post-scope correction may reuse an unchanged barrier only through a higher
  deal-extraction generation, new FAMILY_BUILD and FINALISE_DEAL. The generated
  stage classifier proves that its target and patch cannot change any scope
  identity or expected slot.
- An open-world correction targets exactly one `OpenWorldSemanticCandidate`,
  `OpenWorldCandidateOccurrence`, general or kind supersession, evidence
  closure, primitive or final-disposition input and its expected payload digest.
  A correction to evidence spans, neutral proposition body, observed party
  tokens, governed ordinal or another candidate-identity field creates a new
  candidate, a new occurrence and one `OpenWorldCandidateSupersession`; it never
  edits either predecessor in place. A candidate-kind correction creates the
  corresponding successor candidate and occurrence and exactly one
  `OpenWorldCandidateKindSupersession`. It may replace a reviewed disposition,
  but cannot write a canonical concept, alias, party, relationship, result,
  metric, unit or role key that is absent from the selected bundle. A mapping or
  adoption that needs such a key first requires a successor
  CanonicalContractBundle, Freeze Gate review and Ben approval. Every permitted
  open-world correction is scope-stage and its output contract requires the
  exact predecessor-to-successor effective-chain parity proof and, where any
  source-backed or candidate-identity field changes, a newly derived
  OpenWorldEvidenceClosure, complete OpenWorldPrimitiveObservation and
  OpenWorldPrimitiveRelationship set, OpenWorldPrimitiveCollectionRoot and one
  final reviewed disposition for the new terminal occurrence. It also requires a new
  complete `OpenWorldCandidateAuditChainRoot`, independently rebuilt
  `OpenWorldEffectiveOccurrenceRoot`, their reconciliation, disposition
  manifest, two fresh derived impact-walker outputs, a fresh
  SemanticImpactEnumeratorIndependenceAttestation and reconciliation, every
  affected local ApplicabilityReexaminationEntry and
  Slice and all
  transitive scope, result, family, snapshot, observation and release
  dependants. Patching only the displayed candidate or familiar components is
  prohibited. If the affected chain contains a pre-admission source-role
  occurrence, a correction to that occurrence, its disposition, document
  membership, admitted role or governed deal must also rebuild the exact
  IndependentDealDocumentManifest entry, DealAdmissionManifest, admitted
  occurrence, admitted evidence closure and primitive collection,
  OpenWorldCandidateAdmissionTransition and mechanically carried-forward
  admitted disposition before rebuilding both chain roots. The
  transition is a derived consistency output, never a direct patch target, and
  the predecessor occurrence and disposition remain immutable audit members.
  The two candidate-chain roots and reconciliation,
  SemanticImpactClosure, ApplicabilityReexaminationEntry and Slice, and the later
  corpus-wide ApplicabilityReexaminationManifest are derived consistency outputs
  and are never direct correction targets. The corrected scope selects exactly
  one immutable final disposition for each terminal occurrence in the reconciled
  `OpenWorldEffectiveOccurrenceRoot`; a predecessor retains audit lineage but
  has no current disposition, impact, applicability, serving or market
  authority. Selecting both predecessor and successor, selecting neither
  terminal occurrence, or accepting a fork, merge, cycle or orphan blocks.
- No object governed by a corpus-global `GLOBAL_METRIC_QUERY` subject is a
  correction target, including its CompositionScopeClosure,
  ExpectedOccurrenceSlots and ExpectedResultInputLineageSlots. Their definitions and
  exposure rules are contract and codebook decisions, so any change requires a
  new CanonicalContractBundle, Freeze Gate review and complete higher scope
  generation. The generated CorrectionSlotDefinition registry rejects a global
  target before a Correction or application is created.
- A correction ID is the content hash of its governed target tuple, exact
  expected prior revision or object digest or complete governed GENESIS_TARGET,
  canonical patch payload, correction-rule
  version, correction-slot key, exact stage and ordered
  set of superseded correction IDs. Reviewer, execution and timestamp data
  remain provenance rather than identity inputs. Exact duplicates collapse;
  conflicting corrections against one expected prior state are quarantined.
- Every Correction selected for application has exactly one passing immutable
  `CorrectionApprovalAttestation` for the applicable frozen pair and authority
  binding. Its ID hashes schema and approval-policy version, exact Correction ID
  and canonical payload digest, CorrectionSlotDefinition key, version and
  payload digest, target tuple, expected prior object or revision or complete
  governed GENESIS_TARGET, exact stage,
  immutable review-disposition ID, reviewer identity and eligibility-evidence
  digest, required Ben-approval-evidence ID or the exact slot-declared
  `NO_BEN_APPROVAL_REQUIRED` marker, frozen pair, authorisation evidence and
  terminal `PASS` or `FAIL` with bounded reason digest. `PASS` requires every
  target, stage, review, eligibility, approval and authority predicate to be
  current and matching. The attester cannot change the patch. Execution
  metadata, annotations and timestamps remain provenance. A failed, missing,
  stale or multiply selected attestation creates no CorrectionApplication.
- Every active correction resolves through an ordered, reviewed migration chain
  to exactly one permitted current target or one independently proved genesis
  slot. Zero or multiple targets block the applicable scope subject or family.
  Its `target_ref` is exactly one closed tagged variant:
  `IMMUTABLE_OBJECT(logical_type, stable_key, immutable_id,
  canonical_payload_digest)`,
  `MANIFEST_MEMBER(manifest_type, manifest_id, member_key,
  member_payload_digest)`,
  `OCCURRENCE(occurrence_type, occurrence_id, occurrence_payload_digest)` or
  `REVISION(revision_type, occurrence_id, revision_id,
  revision_payload_digest)`, or
  `GENESIS_TARGET(logical_type, correction_slot_key, governed_subject_type,
  stable_subject_key, creation_slot_key, exact_prior_universe_digest,
  absence_enumerator_a_proof_digest, absence_enumerator_b_proof_digest,
  absence_reconciliation_proof_digest)`. The last variant is valid only for a slot
  whose effect permits creation or coexistence. Two independent indexed
  enumerators must prove that the exact creation slot is absent under the
  captured ledger, scope or extraction head. These are embedded bounded proof
  payloads, not separately persisted canonical objects or forward references.
  Each proof digest hashes its independently enumerated complete prior-universe
  root, empty matching-target set and that enumerator's executable,
  configuration and transitive-dependency digests. The reconciliation proof
  digest hashes both proof digests, their exact equal universe digests, empty
  differences and an independently validated implementation-independence proof.
  `CORRECTION_APPLY` independently recomputes all three proof payloads before its
  transaction. After taking the exact target and correction-head locks it
  revalidates their captured heads and runs only the bounded indexed
  creation-slot anti-join before Correction DML; it never performs a broad
  enumeration while holding a lock. A
  count, null lookup or caller assertion cannot prove genesis. A deal-membership member key binds at least source
  occurrence, prior governed-deal key or `NON_DEAL`, document role or
  disposition and prior admission or disposition manifest.
  Each scope application also carries a complete ordered
  `affected_scope_subject_set` of typed `DEAL(governed_deal_key)` and
  `NON_DEAL(subject_key)` members derived by its slot resolver from the prior
  target and proposed successor. A role-only change has one member; a move has
  the deduplicated old and new subjects. Each post-scope application carries its
  exact primary `DEAL_FAMILY(governed_deal_key, family_key)` subject. Global
  composition subjects are prohibited as above.
  `correction_application_id` hashes schema, correction ID, exact passing
  CorrectionApprovalAttestation ID, CorrectionSlotDefinition key, version and
  payload digest, exact stage, complete target-ref digest, migration-chain
  digest, complete affected-subject set, subject-resolver and rule versions,
  output-contract digest and application-rule version. Source admission,
  membership, classification, closure, expected slot, occurrence and revision
  targets therefore cannot be substituted by equal text or an untyped digest.
- `CORRECTION_APPLY` creates one immutable `CorrectionApplicabilityProjection`
  after each application and before its event. Its ID hashes
  `CORRECTION_APPLICABILITY/V1`, schema, stage, CorrectionApplication ID and
  canonical payload digest, complete target ref, exact affected-subject set,
  one normalised subject edge per member, output-contract digest, resolver and
  version and empty missing, extra and duplicate subject sets. The event names
  this projection. A projection cannot add or remove a subject already hashed
  by the application.
- Before any corrected-object DML, two separately implemented indexed
  enumerators each start from the complete active application chains reachable
  through the exact captured subject-head set, follow their applicability
  projections and terminal supersession
  paths to a fixed point over intersecting affected subjects and emit the
  complete application, projection, subject-edge and supersession sets for the
  requested build-subject set. Their code identities, versions and canonical
  output digests are distinct request inputs. The authorised `DEAL_SCOPE_RUN` or
  `FAMILY_BUILD` writer independently reconciles them and creates or selects one
  immutable local `CorrectionApplicabilitySlice` before any corrected object.
  The singleton ledger head is a receipt and corpus-level completeness input,
  never a local-slice identity input. Its ID is
  `H("CORRECTION_APPLICABILITY_SLICE/V1", schema, stage, ordered captured
  subject-head tuples, exact canonical complete build-subject component,
  enumerator A identity, version and output digest, enumerator B identity,
  version and output digest, complete effective application, applicability-
  projection, subject-edge and terminal-supersession sets, complete ordered
  `(correction_event_id, event_payload_digest, correction_apply_receipt_id,
  receipt_payload_digest)` set, complete fixed-point
  affected-subject component, exact empty missing, extra, duplicate, split,
  orphan-event, wrong-application, wrong-stage, wrong-ledger-head, wrong-subject-
  head, wrong-CandidateInputEvent, receipt-semantic-binding-mismatch and bidirectional-difference
  sets, terminal PASS)`. Any request seed is excluded
  from identity and must expand to that same fixed-point component. A
  carry-forward action may
  select an existing slice only after independently reproducing every identity
  input. Each writer separately verifies under lock that those subject heads are
  the current heads indexed by the captured singleton ledger, but that global
  currentness proof rekeys only its receipt, extraction finalisation or corpus
  barrier. A local writer cannot declare relevance. A partial subject set, omitted
  application, extra application, duplicate edge or application split across
  slices fails before canonical DML. Across a completed scope generation, the
  selected slices' active-application union must equal the independently
  enumerated complete scope ledger-to-affected-subject union in both directions.
  Across each completed deal-extraction generation, the selected post-scope
  slices' union must equal the independently enumerated application-to-
  DEAL_FAMILY union for that exact deal in both directions.
  The local slice never claims corpus completeness. For scope corrections,
  CorpusScopeManifest and CorpusScopeFreezeAttestation bind the singleton ledger,
  both independent global union proofs and the exact local-slice partition. For
  post-scope corrections, the two independent CorpusRelease inventory root sets
  and CandidateInputSeal bind the singleton ledger, complete per-deal union and local
  slices. Those governed global proofs may rekey receipts, finalisation and the
  release while unchanged local slices, discharge maps, scope manifests, family
  sets and snapshots remain byte-identical.
- Every canonical schema eligible as a primary corrected output contains the
  complete ordered applied CorrectionApplication ID set as an identity-bearing
  field. Its generated identity formula hashes that field, even where a shorter
  formula elsewhere in this document omits it for readability. A retirement
  produces the slot-declared immutable typed retirement or supersession record,
  never a missing-row marker. All other changed objects are consistency or
  transitive dependency outputs, not additional untracked primary outputs.
  `CHANGE_MANIFEST_MEMBERSHIP` produces one immutable
  `ManifestMembershipRevision` per corrected member. Its ID hashes schema,
  exact target ref, successor member key and canonical payload, governing deal
  or non-deal subject, document role or disposition, evidence, rule version and
  ordered applied CorrectionApplication IDs. The independent and ordinary
  document manifests and AdmissionUniverseReconciliation select that exact
  governed override as an input; they remain consistency outputs and cannot be
  claimed as one shared primary output by several applications.
- A later `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/SINGLE_SUBJECT`, bounded
  `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` or
  `DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE`, never `CORRECTION_APPLY`,
  creates or selects the current immutable `CorrectionDischarge` after the
  declared primary and consistency outputs exist. Its ID is
  `H("CORRECTION_DISCHARGE/V1", schema, stage, CorrectionApplication ID,
  target-ref digest,
  CorrectionSlotDefinition payload digest,
  output-contract digest, ordered primary output refs, ordered consistency
  refs, evaluator and version, before-patch-after proof digest, exact empty
  missing, extra, duplicate, cardinality, target and payload-mismatch sets,
  terminal PASS)`. Each output ref is typed `(role, logical_type, stable_key,
  immutable_id, canonical_payload_digest)`. Every primary output carries the
  exact application ID and satisfies the slot's target, stage, prior-state,
  output-kind, cardinality and identity-transition rules. A membership
  correction's primary ref is its one ManifestMembershipRevision; its
  consistency refs are the complete canonically ordered set, for every old and
  new affected subject, of its independent and ordinary deal-document manifest
  or reviewed non-deal disposition, DealAdmissionManifest where applicable,
  AdmissionUniverseReconciliation, before-and-after membership projection and
  the complete multi-subject membership-CAS proof. No removal-side or
  addition-side output may be inferred from the other. Each current selecting manifest
  chooses exactly one passing discharge for each effective active application,
  and each selected discharge names exactly one such application. A later build
  may select the identical discharge when every bound output remains byte-equal
  or create a successor discharge for the same application when a declared
  primary or consistency output changes.
  Prior discharges remain immutable historical artefacts selected by their
  earlier manifests and releases. No primary output is claimed by two active
  applications in one current map. Every currently superseded application has
  exactly one terminal supersession path and zero discharges selected in the
  current map, without deleting or invalidating an earlier historical discharge. Missing,
  extra, duplicate, wrong-output, wrong-stage or wrong-payload discharge blocks
  the rebuilding transaction. A downstream manifest, family set or release does
  not count as a primary output merely because it changed transitively.
  Corrected outputs hash their applications but never the later discharge. Both
  correction branches share the order Correction, approval, application,
  applicability projection, event, ledger and subject-head CASs,
  CandidateInputEvent, CandidateInputHead CAS, CorrectionApplyReceipt and
  reconciled CorrectionApplicabilitySlice. The scope branch then selects the V3
  registry and complete applicable registry-entry set, derives the discriminator,
  locks every per-kind creation slot and the aggregate subject-root slot,
  writes or selects every required ApplicabilityReexaminationEntry and complete
  Slice and the `ScopeSubjectApplicabilityRoot`, writes corrected outputs,
  discharge, discharge map, selecting subject manifests and receipts and,
  where applicable, the multi-subject composite receipt. The post-scope family
  branch instead writes its replacement primary and consistency outputs first,
  then writes or selects every registry-required family Entry and complete Slice,
  then writes the discharge, discharge map, replacement family set, selecting
  manifest, transition and receipt. Neither branch may borrow the other's
  ordering or create an identity cycle.
- The canonical `CorrectionDischargeMap` is the complete ordered set of
  `(CorrectionApplication ID, CorrectionDischarge ID, ordered primary output
  refs)` for the effective active application set, sorted by unsigned canonical
  application-ID bytes. Its digest hashes
  `CORRECTION_DISCHARGE_MAP/V1`, schema, stage, exact
  CorrectionApplicabilitySlice ID, captured subject-head tuples and
  canonical complete build-subject component, every terminal supersession
  path, that ordered set and the exact empty missing, extra, duplicate,
  selected-inactive-discharge and
  multiply-claimed-output sets. It is recomputed from the ledger and corrected
  objects, never copied from a manifest under test.
- `canonical_write(operation=CORRECTION_APPLY)` has
  `APPLY_SCOPE_CORRECTION` and `APPLY_POST_SCOPE_CORRECTION` only. It locks
  authorisation, CandidatePromotionFence and CandidateInputHead, then the one
  stage's ledger and subject heads in its generated lock-plan order. It revalidates exact prior
  heads and target and computes the proposed active applicability-component
  change. A scope application that would create a connected component above the
  fixed writer bound performs zero correction DML and requires a reviewed
  contract change that increases or restructures the bound. Otherwise it appends
  the correction, CorrectionApprovalAttestation,
  application, CorrectionApplicabilityProjection and event in that order,
  advances those heads and
  CandidateInputHead and writes a typed terminal receipt in one
  serialisable transaction. It never writes a DealScopeRunManifest, family set
  or corrected object or CorrectionDischarge. Exact replay returns the receipt; any changed request
  requires a successor correction against the new exact head.
- A successful `CorrectionApplyReceipt` has exactly one tagged action variant,
  `APPLY_SCOPE_CORRECTION` or `APPLY_POST_SCOPE_CORRECTION`. Its ID hashes
  `CORRECTION_APPLY_RECEIPT/V1`, schema, variant, exact stage, frozen contract
  pair, exact Correction, passing CorrectionApprovalAttestation,
  CorrectionApplication and CorrectionApplicabilityProjection IDs and payload
  digests, exact ScopeCorrectionEvent or PostScopeCorrectionEvent ID and payload
  digest, exact before-and-after singleton correction-ledger-head tuples,
  complete contract-ordered before-and-after affected correction-subject-head
  tuples, resulting CandidateInputEvent ID and payload digest, exact before-and-
  after CandidateInputHead tuples, captured AVAILABLE CandidatePromotionFence
  version, authorisation evidence, canonical request digest, writer executable
  and configuration digests and terminal `PASS`. The scope variant requires only
  ScopeCorrection fields and the post-scope variant only PostScopeCorrection
  fields; an opposite-stage, missing, extra or null-substituted field is schema-
  invalid.
- Exactly one successful CorrectionApplyReceipt exists for each committed
  correction event and application, and each receipt names exactly one such pair.
  The event precedes correction-ledger and subject-head compare-and-swaps; the
  resulting CandidateInputEvent precedes CandidateInputHead compare-and-swap;
  the receipt follows every required CAS. No earlier object hashes the receipt,
  and it cannot reference a later CorrectionApplicabilitySlice, corrected
  output, CorrectionDischarge, CorrectionDischargeMap or selecting manifest.
  Exact replay returns it; conflicting replay writes nothing. A failed attempt
  uses a separately typed operational failure receipt with zero-canonical-DML
  proof and cannot enter correction eligibility or release closure.
- Both correction-applicability enumerators include the complete ordered
  `(correction_event_id, event_payload_digest, correction_apply_receipt_id,
  receipt_payload_digest)` set reachable from their captured ledger and subject-
  head ancestry, including terminal supersession paths. Every
  CorrectionApplicabilitySlice hashes that set and fixed empty missing, extra,
  duplicate, orphan-event, wrong-application, wrong-stage, wrong-ledger-head,
  wrong-subject-head, wrong-CandidateInputEvent and receipt-semantic-binding-
  mismatch roots.
  CorrectionApplyReceipt is an input-side release kind, never a candidate
  output. CorpusReleaseInventoryKindRegistry has one concrete receipt entry, and
  both release-input enumerators reproduce every selected historical and current
  receipt with empty missing, extra, duplicate, orphan, payload-mismatch,
  wrong-stage, wrong-ledger-head, wrong-subject-head, wrong-CandidateInputEvent
  and semantic-binding-mismatch sets.
- `scope_correction_set_digest` hashes the ordered applicability-slice-selected scope-stage
  correction, CorrectionApprovalAttestation, application, event and exact
  CorrectionApplyReceipt, terminal
  supersession path, CorrectionApplicabilityProjection and reconciled
  CorrectionApplicabilitySlice, subject-head and active-application
  CorrectionDischarge IDs, exact CorrectionDischargeMap and digest and empty
  missing, extra, duplicate, selected-inactive-discharge and
  multiply-claimed-output sets selected by a
  DealScopeRunManifest and each affected scope slice.
  `post_scope_correction_set_digest` analogously hashes only the captured
  post-scope correction, CorrectionApprovalAttestation, application, event and
  exact CorrectionApplyReceipt,
  terminal supersession path, applicability projection and reconciled slice,
  subject-head and active-application discharge IDs, exact CorrectionDischargeMap
  and digest and the same empty proof sets selected by an
  extraction generation and affected family set. A migration-map or resolution
  change advances the corresponding ledger and CandidateInputHead even when
  patch text is unchanged. There is no combined correction-set overlay and no
  serving-time correction application.
- Before rebuilding, a legacy-correction disposition manifest enumerates every
  existing correction row. Each row receives exactly one of
  `EXACTLY_MIGRATED`, `MANUALLY_RECREATED`, `DUPLICATE_OF`, `SUPERSEDED_BY`,
  `INVALID_REJECTED` or `UNMAPPABLE_BLOCKING`, with evidence, destination IDs
  where applicable and Ben disposition. `UNMAPPABLE_BLOCKING` blocks release.
  No legacy row may be carried forward by fuzzy text, current UUID resemblance
  or best effort.
- The canonical contract generates an acyclic ownership and dependency graph.
  Its source-independent branch is CanonicalContractBundle, exact
  SemanticQuestionCatalogueReconciliation, ContractFreezeAttestation and the
  immutable policy manifests and sets. Its intake branch is
  IntakeProcessingPolicyActivation, SubmissionReceipt, receipt ledger event,
  bottom-up ArchiveAttemptNodes, IntakeProcessingAttempt, the sole root
  SubmissionExpansionManifest, source content and occurrence and receipt-local
  IntakeUniverseManifest where present, IntakeResolution and the transaction's
  ledger event. A replacement branch
  places the replacement receipt's passing resolution first, then
  ReceiptReplacementLink, then the prior receipt's replacement resolution and
  event. The bounded cutoff-build and preparation lifecycle then follows the
  exact order specified below: prepared cutoff-state manifests precede
  independence, reconciliation, historical-governance and eligibility kinds;
  all fixed root and receipt-tree controls precede the seal and PREPARED build;
  PREPARED precedes the initial-mode eligibility recheck, which precedes
  IntakeCutoffAttestation, which precedes the FROZEN build transition and
  receipt.
  The
  source-specific branch then
  continues through canonical-text occurrence, ImmutableSourceDocument,
  independent verification, any required admission approval, source admission
  and deal identity, then SourceAdmissionPreparationReceipt. That receipt
  precedes SemanticExtractionInputEnvelope, any ordered
  SemanticInferenceTranscripts, one ReviewedInferencePayload, deterministic
  SemanticGraphNormaliserDefinition execution and ValidatedSemanticGraph. Any
  SOURCE_OR_DOCUMENT_ROLE candidate then precedes its
  PRE_ADMISSION_SOURCE_ROLE occurrence, predecessor evidence closure and
  primitive collection and final `DIRECT_REVIEW` role disposition, then
  IndependentDealDocumentManifest and deal admission. Deal admission precedes,
  in order, the ADMITTED_SEMANTIC occurrence, mechanically rekeyed admitted
  evidence closure and primitive collection, OpenWorldCandidateAdmissionTransition
  and `ADMISSION_CARRY_FORWARD` current disposition, then the rebuilt audit-chain,
  effective-occurrence and chain-reconciliation roots and
  AdmissionUniverseReconciliation, structure,
  AdmittedCoverageAtoms and PotentialDependencyUniverse.
- That universe feeds two parallel paths. The independent challenge derives its
  own base subjects and semantic-question universe directly from text and the
  independently authored catalogue. Ordinary discovery derives its own base
  subjects and semantic-question universe from ordinary definitions. Exact
  base and question-universe reconciliation precedes applicability; exact
  question-state and slot reconciliation precedes per-slot scope challenge.
  Catalogue-blind signals and any ordinary admitted source-local candidate
  precede their OpenWorldCandidateOccurrences. The special source-role lane
  follows the complete pre-admission and admitted ordering above; a kind
  supersession precedes its successor's
  disposition; candidate occurrences, evidence closures and primitive graph
  precede the two impact walkers, whose reconciled SemanticImpactClosure and
  final disposition manifest precede any affected completeness or comparability
  decision and each local ApplicabilityReexaminationEntry or Slice written by
  its registry-assigned sole producer; every complete scope-local set then
  precedes its ScopeSubjectApplicabilityRoot. After all DealSnapshots, both sealed
  CorpusRelease inventory root sets and their reconciliation precede the two
  corpus applicability enumerators; those roots precede the named
  ApplicabilityReexaminationReconciliation, which precedes the global
  ApplicabilityReexaminationManifest, then
  MetricApplicabilityRequirementProjectionSet, then CandidateInputSeal.
  Neither path reads the other's selected output. Every computed path object is
  ordered as SemanticComputationInputEnvelope, SemanticComputationPayload and
  semantic-object IDs, path review, NonSemanticPayloadAttestation and governed
  object, followed where applicable by third reconciliation and
  NeutralStageProjection. CorrectionApprovalAttestations and Scope
  CorrectionApplications and applicability projections interleave only after
  their exact Corrections and prior targets. Reconciled applicability slices
  precede replacement scope objects; CorrectionDischarges
  follow the direct corrected objects and precede their selecting manifests. The graph
  continues through discovery coverage, RelationshipEffectFieldUniverses,
  independent and ordinary RelationshipEffectConstraints and exact
  relationship-semantic reconciliation, RelationshipSemanticExpectations,
  ClaimScopeDependencyExpectations, ClaimScopeClosures, independent and ordinary
  composition coverage children, requirements, locality shards, totality roots,
  reconciliations and CompositionScopeClosures, then deal-local
  ExpectedOccurrenceSlots, DealScopeRunManifest and DealScopeRunReceipt. Bounded global composition,
  global ExpectedOccurrenceSlots, scope slices and inventory roots lead to
  CorpusScopeManifest and CorpusScopeFreezeAttestation. Scope correction event,
  CandidateInputEvent and receipt branches precede their replacement scope
  runs. Only after that barrier
  do actual non-revision occurrences, pre-claim RelationshipRevisions,
  ClaimRevisions, post-claim RelationshipRevisions, ResultInputLineage,
  DerivedResultRevisions, family sets, FamilyExtractionManifests and
  FamilyBuildReceipts exist. Post-scope CorrectionApprovalAttestations,
  applications, applicability projections, correction events and
  CandidateInputEvents precede reconciled applicability slices and replacement
  primary outputs; CorrectionDischarges follow those outputs and precede the
  replacement family set and manifest.
  An extraction OPEN transition, input event
  and receipt precede those families; DealSnapshot and DealExtractionRunManifest
  precede the FROZEN transition, next input event and DealExtractionRunReceipt.
  CandidateInputSeal then precedes CorpusRelease, which precedes every
  CorpusRelease-keyed output and both
  complete output inventory root sets and CandidateOutputSeal. Those precede
  CandidateReleaseManifest,
  CandidateReleaseFreezeAttestation and the FROZEN candidate transition and
  receipt, then CandidateReleaseObjectProjectionRoot and
  CandidateReleaseBlobProjectionRoot, the two embedded recheck-enumeration
  proofs and embedded independence proof, CandidateInputRecheckAttestation and
  held CandidatePromotionFence. Observations,
  aggregates and projections are selected inside that candidate chain. Prerequisite-family inputs enter
  only in the order authorised by the compiled acyclic family DAG; they are not
  roots. Each materialised object stores its ordered direct input occurrence,
  revision and manifest IDs and dependency digest. Contract compilation rejects
  any closure compiler, extractor, normaliser, resolver, composer or projector
  read that is not a declared dependency edge.
  Any changed input invalidates every transitive dependent. Carry-forward is
  permitted only when the frozen contract pair and complete dependency-input
  digest are identical; referential closure alone is insufficient.
- Semantic endpoint relationships may be reciprocal or otherwise cyclic as
  data, but their build dependencies are always acyclic. A pre-claim
  RelationshipRevision depends only on already-created semantic occurrences,
  frozen scope expectations and source evidence. A post-claim relationship is
  built only after every permitted endpoint revision exists. A fixed-point
  scope traversal deduplicates cyclic endpoint occurrences without creating a
  revision dependency cycle. A cross-family result belongs to a declared result
  family whose prerequisite closure includes every contributing family.
- Each family extraction writes immutable objects under an operational
  `extraction_run_id`; that run ID never enters semantic identity. A complete
  `DealSnapshot` selects the exact local DealScopeRunManifest and scope slices,
  DealIdentityManifest, ordered relevant
  SubmissionReceipt, IntakeLedgerEvent, ArchiveAttemptNode,
  IntakeProcessingAttempt, SubmissionExpansionManifest, SourceContent,
  ImmutableSourceDocument,
  source-occurrence, IntakeUniverseManifest, ReceiptReplacementLink,
  cutoff-selected IntakeResolution and receipt-local chain-proof IDs,
  IndependentDealDocumentManifest, AdmissionUniverseReconciliation,
  DealAdmissionManifest, ordered SourceAdmissionManifest and required
  SourceAdmissionApprovalAttestation and CanonicalTextVerificationManifest IDs,
  canonical text, frozen contract pair,
  its exact IndependentDealCompositionManifest and
  OrdinaryDealCompositionManifest and their parent reconciliation, and one
  closed object set for every required family in that deal. A per-family
  reprocess creates a new complete snapshot by referencing certified unchanged
  family sets plus the new family set; it never produces a partial deal view.
  Each family set carries its frozen contract pair. Carry-forward is permitted
  only when that pair and dependency digest are certified identical;
  otherwise the family and all transitive dependants are rematerialised.
  Closure and freshness validation prove that every selected deal and source
  intake, independent deal-document, admission-reconciliation and canonical-text
  verification manifest, deal and source admission manifest, admitted coverage
  atom, PotentialDependencyUniverse,
  selected OpenWorldSemanticCandidate and occurrence, current candidate- and kind-supersession,
  every source-role admission transition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot and
  OpenWorldCandidateChainReconciliation,
  evidence closure, primitive observation and relationship,
  OpenWorldPrimitiveCollectionRoot, final disposition,
  impact-walker outputs, SemanticImpactEnumeratorIndependenceAttestation,
  reconciled SemanticImpactClosure,
  ApplicabilityReexaminationRequirement and relevant local entries and slices,
  and empty OpenWorldReviewQueueRoot,
  span, excerpt, provision, component, IndependentSemanticChallengeManifest,
  exact per-deal independent and ordinary composition roots and parent
  reconciliation, relevant composition coverage children, requirements,
  locality shards, shard reconciliation and CompositionScopeClosure,
  RelationshipSemanticExpectation, ClaimScopeDependencyExpectation,
  ClaimScopeClosure, assessment revision,
  ClaimEvidence edge, ClaimRevision, RelationshipEvidence edge,
  RelationshipRevision and effect payload, ResultInputLineage, result revision,
  correction, CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice and
  CorrectionDischarge resolve inside the snapshot and match their declared
  inputs.
- Every family set records direct source-admission, deal-admission,
  DealScopeRunManifest, scope-slice,
  intake-universe, independent-deal-document, admission-reconciliation,
  canonical-text-verification, frozen-contract-pair, composition-closure,
  relevant open-world candidate, occurrence, current candidate- and kind-supersession,
  every source-role admission transition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot and
  OpenWorldCandidateChainReconciliation,
  primitive, final-disposition, impact-closure and the exact intersecting
  ApplicabilityReexaminationRequirement, Entry and complete family Slice refs,
  ExpectedOccurrenceSlot, exact inherited `scope_correction_set_digest`, captured
  `post_scope_correction_set_digest`, post-scope
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  CorrectionDischarge,
  exact CorrectionDischargeMap and digest and
  prerequisite-family-set IDs. Freshness
  certification recomputes the complete transitive input digest rather than
  trusting a stored digest or matching row count.
- A certified family-set ID hashes ordered `canonical_text_id`, exact relevant
  ImmutableSourceDocument and selected reviewed open-world object IDs and
  payload digests, and
  source-admission and canonical-text-verification-manifest IDs, exact
  ordered relevant IntakeUniverseManifest IDs, exact
  IndependentDealDocumentManifest and AdmissionUniverseReconciliation IDs,
  family key, frozen contract pair,
  exact DealScopeRunManifest,
  deal-admission-manifest ID, scope-slice, selected ExpectedOccurrenceSlot and
  relevant CompositionScopeClosure IDs, exact ordered intersecting
  ApplicabilityReexaminationRequirement, Entry and complete family Slice IDs and
  payload digests, exact scope- and post-scope-correction
  set digests, captured post-scope subject-head tuples, ordered
  post-scope CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice and
  CorrectionDischarge IDs and exact CorrectionDischargeMap and digest, ordered
  prerequisite family-set IDs, dependency digest and ordered canonical
  occurrence and revision IDs. A `DealSnapshot` ID hashes governed deal key,
  deal-identity-manifest ID, ordered relevant SubmissionReceipt,
  IntakeLedgerEvent, ArchiveAttemptNode, IntakeProcessingAttempt,
  SubmissionExpansionManifest, SourceContent, ImmutableSourceDocument, source occurrence,
  IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution and
  receipt-local chain-proof IDs,
  IndependentDealDocumentManifest and AdmissionUniverseReconciliation IDs,
  exact DealScopeRunManifest and scope-slice, selected reviewed open-world
  partition and impact-closure digests,
  deal-admission-manifest ID, ordered source-admission, required
  source-admission-approval-attestation and canonical-text-verification
  manifests, exact independent and ordinary
  per-deal composition-root IDs and their parent reconciliation, frozen contract
  pair, exact scope-correction roots inherited from its scope slices, captured
  post-scope correction roots, their complete CorrectionDischargeMaps and
  digests and ordered certified family-set IDs.
  Extraction-run and allocated database IDs remain provenance outside identity.
  Exact semantic reruns therefore reproduce family, result and snapshot IDs.
- `CorpusRelease` is an immutable manifest selecting exactly one certified
  `DealSnapshot`, exact terminal DealExtractionRunManifest, FROZEN
  DealExtractionBuildTransition and DealExtractionRunReceipt per included deal.
  Its separate scope- and post-scope-correction roots are audit provenance for
  corrections already materialised into the selected objects,
  never a serving-time overlay or second truth path. This allows active and
  candidate corpora to coexist without copying or partially mutating live
  objects. Its ID hashes `CORPUS_RELEASE/V2`, schema, release-contract version,
  frozen contract pair, exact CorpusScopeFreezeAttestation, cohort-metadata
  version, materialisation-time IntakeEligibilityRecheckAttestation and its
  observed signed IntakeProcessingPolicyHead tuple and permitted activation
  chain, CandidateInputSeal, both complete CorpusRelease inventory-root-set IDs and
  payload digests, exact
  InventoryEnumeratorIndependenceAttestation(CORPUS_RELEASE_INPUT), their common
  neutral content digest and fixed-size equality
  proof. Those sealed release-inventory roots contain the complete ordered
  deal-to-DealSnapshot mappings; FROZEN extraction transitions, manifests and
  receipts; cutoff and intake-governance objects; source payloads and admission
  objects; scope and post-scope correction roots, maps, discharges and receipts;
  and every other input-side member admitted by
  CorpusReleaseInventoryKindRegistry and selected by CandidateInputSeal. The
  CorpusRelease ID hashes no CandidateOutputSeal, output inventory, serving row,
  realised aggregate membership, composition-contract-set digest,
  ServingContractMetadata, CandidateReleaseManifest, later CandidateBuildTransition
  or receipt, CandidateInputRecheckAttestation, CandidatePromotionFence,
  deployment or serving-fence state. Labels, build-run IDs and mutable database
  row identities are provenance. Candidate generation and captured immutable
  head tuples enter only through the sealed input and inventory identities,
  never as inferred timestamps or mutable lookups.
- After source-universe and conversion verification, deterministic structure,
  the text-only PotentialDependencyUniverse, the two firewalled semantic paths
  and independent composition reconciliation above complete, but before
  candidate claim extraction, freeze one immutable `CorpusScopeManifest`. The
  ordinary discovery pass writes no candidate corpus facts. It creates many-to-many
  `DiscoveryCoverageEdge`s between pre-existing AdmittedCoverageAtom intervals
  and governed semantic occurrences or reviewed discovery dispositions. One
  occurrence may cross atoms, and one atom may support nested, overlapping or
  party-specific occurrences. Every admitted byte has an ordinary discovery
  explanation, but that explanation cannot create, delete, split, merge or
  dispose of an AdmittedCoverageAtom or change the independent challenge.
  Multiple semantic uses do not multiply byte coverage. Unexplained gaps,
  crossings or incompatible dispositions block the freeze.
- `discovery_coverage_edge_id` hashes PotentialDependencyUniverse and atom IDs,
  exact intersected interval, target type and stable target or disposition ID,
  governed coverage role and source-order ordinal. Contract expansion turns the
  discovered semantic occurrences into expected claim, relationship and result
  slots. An edge cannot be manufactured from a challenge entry or candidate
  row. A discovery `non-substantive` disposition is neither a challenge
  `NOT_LEGALLY_RELEVANT` disposition nor absence evidence.
- The manifest is the authoritative certification universe and contains
  stable-ID and payload-digest inventories for the exact
  current IntakeProcessingPolicyHead tuple and activation and complete allowed
  activation chain, ArchiveSafetyPolicyManifest and OperationalPolicySet; every
  SubmissionReceipt, IntakeLedgerEvent, ArchiveAttemptNode,
  IntakeProcessingAttempt,
  SubmissionExpansionManifest, SourceContent, ImmutableSourceDocument, source occurrence,
  IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution,
  receipt-local attempt and resolution chain, cutoff-selected effective
  resolution and selected map, LedgerCutoffStateManifest,
  IndependentCutoffStateManifest, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and every
  historical governance payload, IntakeEligibilityDependencyManifest and every
  selected root and transitive edge, exact IntakeCutoffAttestation and current
  IntakeEligibilityRecheckAttestation;
  every ImmutableSourceDocument and SourceAdmissionPreparationReceipt, selected
  corpus SemanticExtractionInputEnvelope, complete selected
  SemanticInferenceTranscript set, ReviewedInferencePayload,
  SemanticGraphNormaliserDefinition and ValidatedSemanticGraph with validation
  report and payload digest, and canonical-text occurrence,
  GovernedResidualProducerRegistry, every GovernedResidualObservation, both
  complete residual-universe roots, GovernedResidualUniverseReconciliation and
  GovernedResidualUniverseManifest, every GovernedResidualDisposition,
  GovernedResidualDispositionManifest, both residual-impact projections, every
  reconciled GovernedResidualImpactClosure and the exact empty
  GovernedResidualReviewQueueRoot,
  CanonicalTextVerificationManifest, SourceAdmissionManifest, every required
  SourceAdmissionApprovalAttestation,
  IndependentDealDocumentManifest, DealIdentityManifest,
  DealAdmissionManifest and AdmissionUniverseReconciliation, governed deal,
  admitted structural leaf, AdmittedCoverageAtom, PotentialDependencyUniverse,
  classification slot, coverage edge and disposition, required `(deal, family)`
  unit and scope slice, every scope-stage correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  CorrectionDischarge, ManifestMembershipRevision, CorrectionDischargeMap and
  digest, every selected MultiSubjectScopeCorrectionReceipt/V2 and its exact
  component-to-discriminator-bound-subject-receipt and per-subject
  applicability-root equality proof,
  ScopeCorrectionEvent and captured
  correction-head tuple, discovered semantic and component
  occurrence, IndependentSemanticChallengeManifest, ChallengeBaseSubject,
  IndependentSemanticQuestionCatalogue object and root,
  SemanticQuestionCatalogueReconciliation,
  IndependentLegalDimensionDiscoveryManifest,
  IndependentLegalDimensionMappingManifest,
  every OpenWorldSemanticCandidate, OpenWorldCandidateOccurrence and current
  OpenWorldCandidateSupersession, OpenWorldCandidateKindSupersession, every
  OpenWorldCandidateAdmissionTransition and its transition-bound historical
  disposition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot,
  OpenWorldCandidateChainReconciliation,
  OpenWorldEvidenceClosure,
  OpenWorldPrimitiveObservation, OpenWorldPrimitiveRelationship and
  OpenWorldPrimitiveCollectionRoot, final
  OpenWorldCandidateDisposition and OpenWorldCandidateDispositionManifest, both
  independent impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation and reconciled SemanticImpactClosure,
  every applicable ApplicabilityReexaminationRequirement, entry, local slice and
  ScopeSubjectApplicabilityRoot, and the exact empty
  OpenWorldReviewQueueRoot,
  IndependentSemanticQuestionUniverseManifest,
  OrdinarySemanticQuestionUniverseManifest,
  SemanticQuestionUniverseReconciliation and open-world legal-dimension
  disposition,
  ChallengeQuestionDisposition, OrdinaryQuestionDisposition,
  ChallengeQuestionSlot, OrdinaryQuestionSlot, per-slot challenge entry and disposition,
  base-subject, question-disposition and slot reconciliation,
  every SemanticComputationInputEnvelope, SemanticComputationPayload,
  semantic-object ID, SemanticReviewInputEnvelope, review disposition,
  NonSemanticPayloadAttestation, governed-object ID, one selected PASS governed
  wrapper and functional GovernedSemanticRecord mapping for every registered
  subject, path and stage, every applicable PRE_FREEZE_CONTRACT and SOURCE_BUILD
  SemanticStageOutputSetRoot, and every NeutralStageProjection and
  SemanticNeutralProjectionSetRoot for each semantic and composition stage,
  exact RelationshipEffectFieldUniverseSetRoot and every
  RelationshipEffectFieldUniverse, both complete path-specific
  RelationshipEffectConstraint sets and their exact set roots and
  relationship-semantic reconciliation,
  RelationshipSemanticExpectation,
  ClaimScopeDependencyExpectation, ClaimScopeClosure, every independent and
  ordinary deal and global
  composition root, locality shard, coverage disposition, requirement, shard
  and parent reconciliation, CompositionContextKeyUniverseRoot, neutral content
  digest and every reachable BoundedInventoryTree node, and
  CompositionScopeClosure, every
  ExpectedOccurrenceSlot, expected relationship-effect slot and
  ExpectedResultInputLineageSlot, every DealScopeRunManifest and
  DealScopeRunReceipt, scope slice,
  CorpusScopeInventoryKindRegistry,
  InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE), every
  CorpusScopeInventoryShard and
  reachable BoundedInventoryTree node, both independent kind roots and root
  sets, common neutral content digest and CorpusScopeInventoryReconciliation,
  contract object including SemanticStageRegistry, every ClaimScopeDefinition and
  RelationshipEffectSchema, registry entry, route, internal or export job,
  request and result schema, cache policy, route budget, database index, RPC,
  materialised view, discovered test and approved exclusion. Scope inventories
  contain scope-stage corrections, expectations and slots, never a post-scope
  correction, actual post-barrier occurrence,
  revision, effect payload, ResultInputLineage digest, family set,
  FamilyExtractionManifest, DealSnapshot or DealExtractionRunManifest.
- `corpus_scope_manifest_id` hashes schema, frozen contract pair, exact
  IntakeCutoffAttestation, current IntakeEligibilityRecheckAttestation,
  scope-build generation, exact captured CandidateInputHead tuple, both
  independent complete CorpusScopeInventoryRootSet IDs and payload digests,
  exact InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE),
  their common neutral content digest, exact
  CorpusScopeInventoryReconciliation, empty bidirectional-difference and source-
  membership-uniqueness proofs, CertificationPolicyManifest, discovery,
  enumerator and builder
  versions. Those root-set digests, rather than inline manifest arrays, cover the
  exact observed IntakeProcessingPolicyHead,
  current activation and complete permitted activation chain,
  ArchiveSafetyPolicyManifest,
  OperationalPolicySet, complete intake attempt, replacement, resolution-chain
  and selected-effective-resolution inventories, exact LedgerCutoffStateManifest
  and IndependentCutoffStateManifest, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and its complete
  payload set, IntakeEligibilityDependencyManifest and complete root and edge
  set, ordered IntakeUniverseManifest and ImmutableSourceDocument, every
  SourceAdmissionPreparationReceipt, selected corpus
  SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
  ReviewedInferencePayload, GovernedResidualProducerRegistry, complete
  GovernedResidualUniverseManifest and its two roots and reconciliation,
  GovernedResidualDispositionManifest, every reconciled residual impact closure
  and the exact empty GovernedResidualReviewQueueRoot,
  SemanticGraphNormaliserDefinition and
  ValidatedSemanticGraph with validation-report digests,
  CanonicalTextVerificationManifest, every required
  SourceAdmissionApprovalAttestation,
  IndependentDealDocumentManifest and AdmissionUniverseReconciliation IDs,
  PotentialDependencyUniverse, exact IndependentSemanticQuestionCatalogue root,
  SemanticQuestionCatalogueReconciliation, SemanticStageRegistry,
  IndependentLegalDimensionDiscoveryManifest,
  IndependentLegalDimensionMappingManifest,
  complete open-world candidate, occurrence, current candidate- and kind-supersession,
  every source-role admission transition,
  candidate-audit-chain root, effective-occurrence root and chain reconciliation,
  evidence-closure, primitive, primitive-collection, final-disposition, disposition-manifest,
  impact-walker, SemanticImpactEnumeratorIndependenceAttestation and
  SemanticImpactClosure inventories, every applicable
  ApplicabilityReexaminationRequirement, entry, local slice and
  ScopeSubjectApplicabilityRoot, and the exact empty
  OpenWorldReviewQueueRoot,
  IndependentSemanticQuestionUniverseManifest,
  OrdinarySemanticQuestionUniverseManifest,
  SemanticQuestionUniverseReconciliation and
  IndependentSemanticChallengeManifest IDs, every semantic computation,
  review, attestation, dual-ID mapping, SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot, exact
  RelationshipEffectFieldUniverseSetRoot and every selected
  RelationshipEffectFieldUniverse, both path-specific
  RelationshipEffectConstraintSetRoots and their complete constraints and
  relationship-semantic reconciliation,
  all four composition totality-root types and every parent reconciliation,
  CompositionContextKeyUniverseShard set and root,
  global and per-slot challenge-partition, base-subject, complete challenge and
  ordinary question-disposition, question-slot, semantic-reconciliation and
  per-shard `K_contract(s) = D_contract(s)` reconciliation digests, complete ordered
  DealScopeRunManifest, DealScopeRunReceipt and
  MultiSubjectScopeCorrectionReceipt/V2 inventories and exact
  component-to-discriminator-bound-subject-receipt and per-subject
  applicability-root equality proof, exact current
  ScopeSubjectHead map and predecessor-chain proof, exact
  ScopeCorrectionLedgerHead, subject-head, CorrectionApprovalAttestation,
  CorrectionApplication, CorrectionApplicabilityProjection,
  CorrectionApplyReceipt, CorrectionApplicabilitySlice, CorrectionDischarge, complete
  CorrectionDischargeMap and digest, event and scope-correction-set roots,
  complete ordered
  ExpectedOccurrenceSlot and ExpectedResultInputLineageSlot inventories and every
  complete ordered stable-ID inventory and approved exclusion above. The
  manifest and final COMMIT remain fixed-size regardless of corpus size.
  For each required `(deal, family)` unit, a
  `scope_slice_id` hashes its schema version, frozen contract pair, governed deal
  key, family key, exact DealScopeRunManifest and the exact ordered relevant
  SubmissionReceipt, IntakeLedgerEvent, ArchiveAttemptNode,
  IntakeProcessingAttempt, SubmissionExpansionManifest, SourceContent,
  ImmutableSourceDocument, SourceAdmissionPreparationReceipt, selected corpus
  SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
  ReviewedInferencePayload, SemanticGraphNormaliserDefinition and
  ValidatedSemanticGraph with validation report, source
  occurrence, IntakeUniverseManifest,
  ReceiptReplacementLink, cutoff-selected IntakeResolution,
  receipt-local attempt and resolution-chain proof,
  CanonicalTextVerificationManifest, source-admission and required
  SourceAdmissionApprovalAttestation,
  IndependentDealDocumentManifest, DealAdmissionManifest and
  AdmissionUniverseReconciliation IDs, ordered source, admission, leaf,
  AdmittedCoverageAtom, PotentialDependencyUniverse, coverage, semantic,
  ChallengeBaseSubject, relevant IndependentSemanticQuestionCatalogue objects,
  SemanticQuestionCatalogueReconciliation, SemanticStageRegistry,
  IndependentLegalDimensionDiscoveryManifest,
  IndependentLegalDimensionMappingManifest, relevant open-world candidate,
  occurrence, current candidate- and kind-supersession, every source-role
  admission transition, candidate-audit-chain
  root, effective-occurrence root, chain reconciliation, evidence closure, primitive,
  primitive-collection root, final
  disposition, impact-walker, SemanticImpactEnumeratorIndependenceAttestation,
  SemanticImpactClosure,
  ApplicabilityReexaminationRequirement and relevant local entries and slices,
  and empty OpenWorldReviewQueueRoot,
  independent and ordinary
  semantic-question universe, SemanticQuestionUniverseReconciliation,
  ChallengeQuestionDisposition,
  OrdinaryQuestionDisposition, ChallengeQuestionSlot, challenge-entry and
  disposition, base-subject, question-disposition and question-slot
  reconciliation, relevant semantic computation, review, attestation,
  dual-ID-mapping, SemanticStageOutputSetRoot, NeutralStageProjection and
  SemanticNeutralProjectionSetRoot IDs, exact
  RelationshipEffectFieldUniverseSetRoot and relevant universes, both relevant
  RelationshipEffectConstraint sets and their exact set roots and
  relationship-semantic reconciliation, RelationshipSemanticExpectation,
  ClaimScopeDependencyExpectation, ClaimScopeClosure, semantic reconciliation,
  relevant independent and ordinary composition coverage disposition,
  requirement, locality shard, shard reconciliation and
  CompositionScopeClosure,
  ExpectedOccurrenceSlot, expected relationship-effect slot,
  ExpectedResultInputLineageSlot, exact applicability-slice-selected scope-stage
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  CorrectionDischarge, CorrectionDischargeMap and digest, ScopeCorrectionEvent and subject-head IDs
  and `scope_correction_set_digest`,
  and exclusion IDs relevant to the
  unit. Each expected claim entry binds its ClaimDefinition and
  ClaimScopeDefinition versions, exact closure ID, complete potential-witness
  interval set and expected dependency slots. The parent manifest contains the
  exact unit-to-slice mapping. An
  unrelated route inventory change can therefore change the parent scope and
  release without needlessly changing an identical family slice, while a family
  cannot select or infer a different scope.
- CorpusScopeManifest independently enumerates the complete effective
  scope-application-to-affected-subject edge set at its captured ledger head.
  The union of its selected CorrectionApplicabilitySlices must equal that set in
  both directions; each application belongs to exactly one complete slice, and
  each slice's full subject component has terminal DealScopeRunReceipts. Equal
  counts, a self-declared local relevance filter or one corrected side of a
  membership transition cannot pass.
- The ordinary expectation enumerator reads frozen source structure, reviewed
  discovery output, source-backed use and cross-reference candidates and the
  contract, never the independent challenge, candidate ClaimRevisions,
  RelationshipRevisions or serving rows. It recomputes every semantic and
  dependency expectation, closure and potential-witness interval set rather
  than copying the scope manifest. The challenge implementation obeys the
  opposite firewall above. Only a third certification reconciler may read both
  immutable outputs, and it may compare or reject them but cannot transform one
  into the other. The manifest builder and certification scope enumerator are
  also separate implementations and cannot call, import or read each other's
  inventory output. Exact equality between their complete stable-ID inventories
  is required.
- The observation enumerator reads the completed candidate, built routes,
  generated schemas and collected test IDs, never the expected sets. For each
  ordinary identity inventory, `U` is the independently enumerated universe,
  `X` the pre-approved exclusions and `S` the candidate's selected set.
  Certification requires `X` to be a subset of `U`, `S = U - X`, `S` and `X` to
  be disjoint, zero duplicate IDs, zero unrecognised extras and an exact
  traceability row for every member of `U`. Equal counts cannot satisfy set
  equality. The independently derived base-subject and question universes must
  first prove `B_base = O_base`, `Q_independent = Q_ordinary` with
  `W_open = PASS`, total `B_question_state = O_question_state` and
  `B_slot = O_slot`. Separately, `C` must partition every
  `(expected_slot, admitted_atom_byte)` exactly once with no unresolved cell;
  scope freeze requires `R = E`, each dependent claim requires
  `A_pre(c) = E_pre(c) = R_pre(c)`, and full candidate-release closure requires
  the canonical selected-relationship projection `A_all = E = R`, exact
  `K_contract = D_contract = A_contract` and passing
  CandidateCompositionInstanceConformance, plus both terminal-PASS
  CompositionContractSetRecompositionRoots, passing enumerator-independence
  attestation and terminal passing CompositionContractSetAttestation, all with
  empty differences in both directions and exact field equality. Claim, relationship-effect and
  ResultInputLineage payloads remain candidate universes, not challenge
  dispositions.
- Candidate closure also proves that every `ABSENT` ClaimRevision selects the
  frozen expected closure and challenge, its examined intervals exactly equal
  that closure's required-examination interval set and every dependency slot is
  discharged by the exact selected permitted RelationshipRevision. Moving,
  deleting or relabelling ordinary discovery output cannot change
  PotentialDependencyUniverse or `C`; it instead creates a visible `R` versus
  `E` mismatch. Omitting an entire provision, definition, party or question
  creates a visible `B` versus `O` mismatch. Co-mutating a
  ClaimScopeDefinition, compiled expectation and
  RelationshipRevision cannot change `R` and therefore cannot pass.
- Every exclusion identifies the stable ID, governed reason, evidence and Ben
  approval before candidate extraction. A missing deal or family, omitted
  expected claim, `NOT_EXAMINED`, `FAILED` or newly discovered registry entry
  cannot make completeness pass by disappearing from the candidate. Changing
  scope or an exclusion creates a new manifest ID and invalidates all later
  candidate and certification artefacts. `X` is disjoint from evidence and from
  the challenge partition: an approved exclusion cannot delete an atom, satisfy
  a challenge disposition, discharge an expectation or support `ABSENT`.
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
- The required acyclic identity order begins with the closed authored bundle
  input set, then CanonicalBundleInputIdentity, QueryDefinitionSetRoot and
  QueryGoldenSuiteManifest; then the pair-independent
  ApplicabilityEligibleMemberKindProducerRegistry/V3; then every
  ApplicabilityReexaminationRequirementDefinition and their
  ApplicabilityReexaminationRequirementSetRoot; then
  GlobalMutableAuthorityRegistry, GeneratedLockPlanRegistry and
  SemanticStageRegistry; then the closed generated-output manifest and final
  `CANONICAL_CONTRACT_BUNDLE/V3` fingerprint. QueryGoldenCertificationAttestation follows
  ContractFreezeAttestation and can never point back into the bundle fingerprint.
  Each independent and ordinary catalogue computation
  then follows its registered input envelope, payload and semantic-object,
  self-contained review, PRE_FREEZE_CONTRACT NonSemanticPayloadAttestation,
  governed wrapper and GovernedSemanticRecord mapping. Those complete path
  wrappers precede the registered catalogue THIRD_RECONCILER input envelope,
  reconciliation payload and semantic object, review, pre-freeze attestation,
  governed SemanticQuestionCatalogueReconciliation and its
  NeutralStageProjection. That neutral projection precedes each registered
  FIELD_UNIVERSE input envelope, payload and semantic object, review, pre-freeze
  attestation, governed RelationshipEffectFieldUniverse wrapper and mapping.
  The complete FIELD_UNIVERSE SemanticStageOutputSetRoot precedes and feeds the
  byte-equal specialised RelationshipEffectFieldUniverseSetRoot, which precedes
  ContractFreezeAttestation.
  ArchiveSafetyPolicyManifest, CacheBudgetManifest, CapacityManifest and
  RouteBudgetManifest precede OperationalPolicySet, CertificationPolicyManifest
  and each IntakeProcessingPolicyActivation. SubmissionReceipt and its ledger
  event then precede bottom-up ArchiveAttemptNodes, IntakeProcessingAttempt, the
  sole root SubmissionExpansionManifest, SourceContent, source occurrences,
  receipt-local IntakeUniverseManifest, IntakeResolution and that action's
  ledger event. For reacquisition, the replacement receipt's passing resolution
  and event precede ReceiptReplacementLink, then the prior receipt's replacement
  resolution and event. Cutoff OPEN transition precedes CutoffBuildHead CAS and
  receipt; bounded prepared-payload trees and top-level payloads precede their
  PAYLOAD_APPENDED event, CutoffPreparationHead CAS and receipt; both complete
  prepared root sets precede CutoffPreparedReconciliation; all reachable payload
  receipts precede both complete control-receipt trees and
  CutoffPreparationControlReceiptReconciliation. LedgerCutoffStateManifest and
  IndependentCutoffStateManifest precede CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and
  IntakeEligibilityDependencyManifest. Those complete fixed kinds, root sets and
  receipt trees precede CutoffPreparationSeal, PREPARATION_SEALED event, sealed-
  head CAS and receipt, then PREPARED transition, build-head CAS and receipt.
  The initial-mode IntakeEligibilityRecheckAttestation follows PREPARED;
  IntakeCutoffAttestation follows that recheck; and only then may the FROZEN
  transition, build-head CAS and receipt exist.
- CanonicalTextContent and occurrence, ImmutableSourceDocument,
  CanonicalTextVerificationManifest, any required
  SourceAdmissionApprovalAttestation, source admission, DealIdentityManifest and
  SourceAdmissionPreparationReceipt precede any semantic inference or graph.
  For all ordinary source-specific semantics, deal admission,
  AdmissionUniverseReconciliation, structural spans, AdmittedCoverageAtoms and
  PotentialDependencyUniverse also precede governed semantic materialisation.
  The sole pre-deal-admission semantic exception is the admission-only
  `SOURCE_OR_DOCUMENT_ROLE` lane: exact envelope, transcript set, reviewed
  payload and deterministically normalised graph, candidate,
  PRE_ADMISSION_SOURCE_ROLE occurrence, evidence, primitives and direct reviewed
  disposition precede IndependentDealDocumentManifest and DealAdmissionManifest;
  the admitted successor, rekeyed evidence and primitives, transition and
  carried disposition follow in that order. This exception has no impact,
  applicability, serving or market edge. Within every registered semantic or
  composition stage the order is
  SemanticComputationInputEnvelope, SemanticComputationPayload and semantic
  objects, review envelope and disposition, NonSemanticPayloadAttestation,
  governed wrappers and functional GovernedSemanticRecord mappings, then the
  path's SemanticStageOutputSetRoot. A registered third-reconciler input
  envelope, computation payload and semantic object, review, attestation,
  governed reconciliation and mapping follow both complete path roots; any
  NeutralStageProjection and SemanticNeutralProjectionSetRoot follow that
  reconciliation. Catalogue-blind dimensions and both base subjects precede base
  reconciliation; mapping and both question universes precede question-universe
  reconciliation; both dispositions precede question-state reconciliation; both
  slot sets precede slot reconciliation; both complete
  RelationshipEffectConstraint sets, their generic path-specific
  SemanticStageOutputSetRoots and the byte-equal specialised
  RelationshipEffectConstraintSetRoots, in that order, precede
  relationship-semantic
  reconciliation, expectations, dependencies and ClaimScopeClosures. No worker
  references a later wrapper or a governed ID.
- A scope correction branch is exact prior scope target, Correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, ScopeCorrectionEvent, CandidateInputEvent,
  CandidateInputHead CAS, CorrectionApplyReceipt, reconciled
  CorrectionApplicabilitySlice, the V3 producer registry and complete applicable
  registry-entry set, mechanically derived `SINGLE_SUBJECT` or
  `MULTI_SUBJECT_CORRECTION` discriminator, every per-kind applicability
  creation-slot lock plus the aggregate subject-root slot, every registry-required local
  ApplicabilityReexaminationEntry and ApplicabilityReexaminationSlice,
  replacement scope objects, current CorrectionDischarges and
  CorrectionDischargeMap.
  Before any scope-local applicability object, the scope-generation OPEN action
  follows ContractFreezeAttestation and creates the complete post-freeze
  ApplicabilityReexaminationRequirement instance set and its opening receipt;
  registry-assigned local Entries and Slices may follow but cannot point back
  into the generated definition set. In multi-subject mode every required
  Entry and Slice in the complete component, including unchanged selections and
  each removal and addition side, precedes its reconciled
  ScopeSubjectApplicabilityRoot, and every subject root precedes every component
  discharge and manifest; correction, carry-
  forward and candidate actions cannot originate them.
  Deal-local composition children, shards, roots, reconciliations, neutral
  projections and closures precede ExpectedOccurrenceSlots and
  ExpectedResultInputLineageSlots and DealScopeRunManifest. ScopeSubjectHead CAS
  then precedes its `SCOPE_SUBJECT_ADVANCED` CandidateInputEvent and
  CandidateInputHead CAS, which precede DealScopeRunReceipt, followed where applicable by the
  discriminator-bound per-subject receipts and
  MultiSubjectScopeCorrectionReceipt/V2. Bounded
  global composition objects then precede global ExpectedOccurrenceSlots, scope
  slices, InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE),
  CorpusScopeInventoryShards and roots, CorpusScopeManifest and
  CorpusScopeFreezeAttestation. A scope FROZEN transition precedes its
  CandidateInputEvent and ScopeBuildTransitionReceipt. Every scope or extraction
  selector binds a fresh earlier IntakeEligibilityRecheckAttestation.
- After the barrier, an extraction OPEN transition precedes its
  CandidateInputEvent and open receipt. Actual occurrences and pre-claim
  RelationshipRevisions precede stripped CandidateRelationshipActualProjections,
  candidate payload and pre-claim CandidateRelationshipReconciliation, then
  ClaimRevisions, post-claim RelationshipRevisions, ResultInputLineage and result
  revisions. A post-scope correction branch is exact prior revision, Correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, PostScopeCorrectionEvent,
  CandidateInputEvent, CandidateInputHead CAS, CorrectionApplyReceipt, reconciled
  CorrectionApplicabilitySlice, replacement primary and consistency outputs,
  every registry-required family ApplicabilityReexaminationEntry and complete
  Slice, current CorrectionDischarge and CorrectionDischargeMap and replacement
  family output. Family set precedes
  FamilyExtractionManifest, FamilyBuildTransition and FamilyBuildReceipt.
  Complete family receipts precede DealSnapshot and DealExtractionRunManifest,
  which precede the FROZEN DealExtractionBuildTransition, CandidateInputEvent and
  DealExtractionRunReceipt.
- The candidate order is OPEN CandidateBuildTransition and receipt; bounded
  InventoryEnumeratorIndependenceAttestation(CORPUS_RELEASE_INPUT), then bounded
  independent CorpusRelease inventory shards, trees, roots and root sets and
  their reconciliation; applicability enumerator A terminal root; applicability
  enumerator B terminal root; ApplicabilityReexaminationEnumeratorIndependenceAttestation;
  ApplicabilityReexaminationReconciliation; ApplicabilityReexaminationManifest;
  every MetricApplicabilityRequirementProjection entry; terminal
  MetricApplicabilityRequirementProjectionSet; materialisation-time intake
  recheck; CandidateInputSeal; CorpusRelease;
  INPUT_SEALED transition, CandidateBuildHead CAS, genesis OPEN
  CandidateOutputPreparationHead and receipt; bounded CorpusRelease-keyed output
  objects, batch manifests, preparation events, output-head CAS operations and
  preparation receipts; candidate composition catalogue and projections,
  contract and instance reconciliations, both
  CompositionContractSetRecompositionRoots, independence and terminal set
  attestations and ServingContractMetadata;
  InventoryEnumeratorIndependenceAttestation(CANDIDATE_OUTPUT), then two
  complete candidate output inventory root sets,
  CandidateOutputInventoryReconciliation, both control-receipt tree roots and
  CandidateOutputControlReceiptReconciliation; pre-seal required-object,
  coverage-projection and trace roots and reconciliation;
  ReviewedSourceSpecificOutputClosure as a separate named control;
  CandidateOutputSeal selecting that control directly; terminal OUTPUT_SEALED event and SEALED output-head CAS;
  terminal CandidateOutputPreparationReceipt; PREPARED transition and receipt;
  candidate-manifest member trees, their exactly-once expansion of that closure,
  root and reconciliation;
  CandidateReleaseManifest;
  CandidateReleaseFreezeAttestation; FROZEN transition and receipt;
  candidate object and blob projection roots;
  CandidateInputRecheckAttestation; `CURRENT_CANDIDATE` PromotionEligibilityProof;
  and held CandidatePromotionFence version.
  DeploymentManifest precedes POST_FREEZE TraceabilityExtension, which precedes
  PreCutoverCertification;
  the `OPEN` ReleaseBundleControlContext genesis event, head and receipt select
  PromotionEvidenceSlotRoot and the pre-output bundle-enumerator independence
  attestation and precede all four one-use run claims; those claims precede their
  neutral walker trees, those trees precede the four role-bound walker-output
  attestations, each output precedes its one success spool-erasure receipt, and
  all four receipts precede the `SUCCESS_PRE_FINALISATION` receipt-set
  attestation. That set precedes the spool-commitment root, output-set
  attestation, governed member and support root sets and reconciliations, which then precede
  the fresh CONTEXT_SEAL proof, ReleaseBundleEnvelope, CONTEXT_FINALISED event,
  FINALISED head and receipt. On the alternative branch, the pre-evidence state
  digest precedes typed failure evidence, which precedes the complete partial-state inventory and the abandonment
  terminal, which precedes CONTEXT_ABANDONED event, ABANDONED head and receipt,
  then the complementary failed-target spool-erasure receipts, the mixed
  `ABANDONED_CONTEXT` receipt set, three attempt-audit trees, their two governed
  roots and reconciliation, and AttemptAuditTerminal.
  Earlier success receipts may appear only in that set's disjoint success
  partition; a FINALISED chain and abandonment chain cannot coexist. Import
  OPEN and bounded batch manifests, events, head
  updates and receipts precede the fixed receipt-prefix context. The pre-output
  ProductionImportEnumeratorIndependenceAttestation precedes all six one-use run
  claims; those claims precede their neutral walker trees, those trees precede
  the six role-bound walker-output attestations, each output precedes its one
  `IMPORT_SUCCESS` erasure receipt, and all six receipts precede their receipt-
  set attestation. That set precedes the spool-commitment root, output-set
  attestation, governed receipt, member and support roots and
  reconciliations. Those controls and the imported objects precede the bounded
  pre-seal tree nodes, ProductionBlobAvailabilityRoot and importer
  CompositionContractSetRecompositionRoot; both terminal roots precede
  ProductionImportSeal;
  SEAL_IMPORT event, SEALED head and receipt precede the unique production-
  semantic-parity terminal slot, closed role registry and enumerator-
  independence attestation. Those controls precede distinct one-use
  `SEMANTIC_EXPECTED` and `SEMANTIC_PHYSICAL` role claims, neutral trees and
  role-bound outputs and success erasure receipts; those two receipts and
  outputs precede their authoritative two-role
  output set. That set precedes the distinct `SEMANTIC_RECONCILER` claim,
  bounded difference trees, all four metadata, observation, cohort and aggregate
  parity root pairs and its role-bound output and success erasure receipt. All
  three success receipts precede the `SEMANTIC_SUCCESS` receipt-set attestation;
  that set and all three role outputs precede the spool-commitment root and terminal
  three-role output set, which precedes one fresh semantic-parity-context
  `CONTEXT_SEAL` proof and ProductionSemanticParityAttestation, which precedes
  ProductionImportAttestation; ATTEST_IMPORT event, ATTESTED head and receipt
  complete the success branch. On the alternative production-abandonment
  branch, the pre-evidence state digest precedes ProductionImportFailureEvidence,
  which precedes the complete partial-state inventory and the one
  ProductionImportAbandonmentTerminal, then the ABANDONED event, import-head
  CAS, controller release and lifecycle receipt, complementary
  `IMPORT_GENERATION_ABANDONED` erasure receipts, their mixed receipt set,
  three attempt-audit trees, their two governed roots and reconciliation, and
  AttemptAuditTerminal. That branch cannot reach
  ProductionImportSeal, ProductionSemanticParityAttestation or
  ProductionImportAttestation. The successful ATTEST_IMPORT controls
  precede POST_IMPORT TraceabilityExtension, pre-authorisation status and
  readiness, CutoverAuthorisation and activation readiness. The exact prior
  acknowledged BLOCKED ServingFenceVersion precedes ActivationEvent;
  `OPEN_WITH_ACTIVATION` then creates PostActivationControlContext,
  CONTEXT_OPENED event, AWAITING_READY head and receipt in that order.
  READY_CANONICAL evidence precedes the ADOPT_READY event,
  AWAITING_POST_ACTIVATION_TRACE head and receipt; POST_ACTIVATION
  TraceabilityExtension precedes the ADOPT_POST_ACTIVATION_TRACE event,
  AWAITING_SMOKE head and receipt; passing PostCutoverSmokeAttestation precedes
  the bounded PostActivationPassCommitLease, issuance event, successor
  AWAITING_SMOKE head and receipt. That exact head and lease precede the winning
  COMMIT_PASS event, PASS_FIXED head, lease consumption, action receipt and
  AVAILABLE promotion-fence successor and, for the first
  canonical cutover, the establish event and terminal genesis head. Those precede
  P9_TRACEABILITY prefix evidence, ProgrammeCompletionAttestation, proposed
  terminal status,
  CompletionTraceCutoff, fixed POST_COMPLETION context, signed completion-
  readiness lease, POST_COMPLETION and atomic terminal-pair publication in that
  order. At any `AWAITING_*` post-activation stage there are exactly two failure
  orders. In `CONTAINMENT_OWNS_FENCE`, exact typed failure evidence and the
  release-tuple lock precede the tuple disposition, BEGIN event, lease
  revocation, `FAILURE_CONTAINMENT_PENDING` head and BEGIN receipt; only that
  receipt authorises the new BLOCKED fence and drain, which precede the owned
  exposure-off CAS and containment RollbackEvent. In
  `ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, the complete registered ordinary
  BLOCKED fence and drain precede its exposure-off tuple, RollbackEvent and
  ActiveReleaseRevocationReceipt, which precede the revocation failure evidence,
  adopted disposition and BEGIN event, pending head and receipt; all database
  objects in that latter sequence commit atomically and no second fence exists.
  For `PASS_COMMIT_LEASE_EXPIRED`, the passing smoke, pass-commit lease,
  issuance event, successor AWAITING_SMOKE head and receipt, lease expiry and pass-effect absence proof
  precede its failure evidence and owned BEGIN. Both variants then precede
  the converged revoked promotion and readiness versions, consumed
  FailureRecoveryBranchSlot, FailureRecoveryBranch and OPEN branch-head
  creation, then the COMPLETE_FAILURE_CONTAINMENT event, FAILURE_FIXED head and
  COMPLETE receipt. A no-recovery decision CASes that branch head directly to
  OUTCOME_FIXED. A historical-reactivation branch first CASes
  it to `HISTORICAL_REACTIVATION_IN_PROGRESS`, then orders its fresh
  target-release intake recheck, independently recomputed
  dependency and availability roots, provider and schema compatibility proofs,
  HistoricalReactivationEligibilityAttestation,
  `HISTORICAL_REACTIVATION` PromotionEligibilityProof, held promotion fence,
  CUTOVER_READY mirror, CutoverAuthorisation, BLOCKED fence, ActivationEvent,
  new post-activation context, bounded receipt-backed READY, trace and smoke
  stages in that order; its COMMIT_PASS receipt and PASS_FIXED head, or its
  receipt-backed pending then FAILURE_FIXED containment, or explicit
  pre-activation abandonment, precedes the CAS to OUTCOME_FIXED on the existing
  branch and never opens a nested branch. On the
  genesis first-cutover branch, LegacyBaselineRollbackTarget and rehearsal
  precede activation, and typed containment precedes each ordered
  LegacyBaselineRestorationAttestation and writer-assigned
  LegacyBaselineRestorationReceipt. A COMMIT_PASS receipt precedes its
  LegacyBaselineRestorationPostCommitContext, genesis event,
  AWAITING_READY_LEGACY head and receipt. READY_LEGACY_BASELINE then precedes its
  adoption event, AWAITING_LEGACY_SMOKE head and receipt; passing legacy smoke
  precedes the success event, LEGACY_READY_FIXED head and receipt, then the no-
  historical-recovery fixed outcome. Alternatively, in the owned order a post-
  commit failure and release-tuple lock precede its
  ContainmentReleaseTupleDisposition, abandonment-intent event,
  ABANDONMENT_PENDING head and receipt, then the higher BLOCKED fence and drain,
  proposed after-tuple validation, exposure-off tuple CAS and RollbackEvent. In
  the adopted order, the registered ordinary fence and drain, exposure-off
  tuple, RollbackEvent and receipt precede the legacy revocation failure
  evidence, disposition and atomically coupled BEGIN event, pending head and
  receipt; they are preserved and no second fence exists. Both converge before the completion event,
  LEGACY_ABANDONED_FIXED head and receipt,
  `POST_COMMIT_PASS_FAILURE` abandonment decision and fixed outcome. The pre-
  commit alternative is one or more RECORD_FAIL receipts, then the explicit
  `PRE_COMMIT_FAILURE` abandonment decision and fixed outcome. In every branch
  the absorbing fixed head and exactly
  one of the six closed FailureTraceabilityObjectRegistry topology variants
  precede the single
  TraceabilityFailureTerminalSlot and its one TraceabilityFailureTerminal;
  terminal reason creates no independent topology edge or second wrapper. None
  enters or resumes that candidate's success chain.
- An intake action event references only objects already created in that action;
  CUTOFF_FREEZE creates no ledger event. Evidence binds to its occurrence before
  a revision selects it, results select earlier revisions and no source, family
  or manifest hashes a downstream release, transition, event, receipt or mutable
  head. DeploymentChangeIntent follows the readiness version it proposes to
  revoke and precedes the successor REVOKED version. Any contrary edge or
  scope-bearing relationship that depends on its dependent ClaimRevision fails
  before persistence.
- The mandatory semantic and composition edges are
  `authored bundle inputs -> CanonicalBundleInputIdentity ->
  QueryDefinitionSetRoot + QueryGoldenSuiteManifest +
  ApplicabilityEligibleMemberKindProducerRegistry/V3 ->
  ApplicabilityReexaminationRequirementDefinition set ->
  ApplicabilityReexaminationRequirementSetRoot + GlobalMutableAuthorityRegistry
  + GeneratedLockPlanRegistry + SemanticStageRegistry -> closed generated-output manifest ->
  CANONICAL_CONTRACT_BUNDLE/V3 fingerprint -> ContractFreezeAttestation ->
  QueryGoldenCertificationAttestation`;
  `ContractFreezeAttestation -> CORPUS_SCOPE_FREEZE/OPEN_GENERATION ->
  ApplicabilityReexaminationRequirement instances -> V3 registry-selected
  DEAL_SCOPE_RUN/MATERIALISE_SCOPE discriminator or
  DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE producer -> per-kind creation-slot
  locks -> registry-assigned local Entries and Slices`; on the scope branch the
  complete applicable registry-entry set and one aggregate subject-root slot
  then precede `ScopeSubjectApplicabilityRoot -> discriminator-bound
  DealScopeRunReceipt`, while on the family branch they precede
  `FamilyBuildReceipt`; both branches then precede both sealed
  CorpusReleaseInventoryRootSets and
  reconciliation -> applicability root A + applicability root B ->
  ApplicabilityReexaminationEnumeratorIndependenceAttestation ->
  ApplicabilityReexaminationReconciliation ->
  ApplicabilityReexaminationManifest -> MetricApplicabilityRequirementProjection
  entries -> MetricApplicabilityRequirementProjectionSet -> materialisation-time
  intake recheck -> CandidateInputSeal -> CorpusRelease`;
  `SemanticStageRegistry -> every registered SemanticComputationInputEnvelope`;
  `SemanticQuestionCatalogueReconciliation -> its NeutralStageProjection ->
  FIELD_UNIVERSE computation chains -> RelationshipEffectFieldUniverse ->
  FIELD_UNIVERSE SemanticStageOutputSetRoot -> byte-equal
  RelationshipEffectFieldUniverseSetRoot -> ContractFreezeAttestation`;
  `IndependentLegalDimensionDiscoveryManifest + base-subject reconciliation ->
  IndependentLegalDimensionMappingManifest`; independent question universe plus
  ordinary question universe plus `W_open = PASS` proof ->
  SemanticQuestionUniverseReconciliation -> question dispositions ->
  question-state reconciliation -> question slots -> question-slot
  reconciliation`;
  `RelationshipEffectFieldUniverseSetRoot -> independent and ordinary
  RelationshipEffectConstraint bodies -> their path-specific generic
  SemanticStageOutputSetRoots -> byte-equal specialised
  RelationshipEffectConstraintSetRoots -> relationship-semantic reconciliation
  -> ExpectedRelationshipNeutralProjection`; and
  `RelationshipSemanticExpectation -> ClaimScopeDependencyExpectation ->
  ClaimScopeClosure` and, separately,
  `RelationshipSemanticExpectation -> RelationshipRevision`, plus
  `composition coverage disposition -> composition requirement -> locality
  shard -> composition totality root`; `independent shard + ordinary shard ->
  contract reconciliation -> ExpectedCompositionContractProjection ->
  CompositionScopeClosure -> ExpectedOccurrenceSlot ->
  ExpectedResultInputLineageSlot -> actual occurrence and revision ->
  ResultInputLineage + DerivedResultRevision + result-component revision +
  market_observation`; and `composition totality roots ->
  parent reconciliation -> CorpusScopeManifest`; and
  `ExpectedOccurrenceSlot -> DealScopeRunManifest -> DealScopeRunReceipt ->
  scope inventory roots -> CorpusScopeManifest ->
  CorpusScopeFreezeAttestation -> actual occurrence -> revisions and lineage ->
  family set`; then
  `family set -> FamilyExtractionManifest -> FamilyBuildReceipt`;
  `complete FamilyBuildReceipt set -> DealSnapshot + DealExtractionRunManifest
  -> FROZEN DealExtractionBuildTransition -> DealExtractionRunReceipt`;
  `CandidateRelationshipActualProjection ->
  CandidateRelationshipProjectionAttestation -> registered candidate
  SemanticComputationInputEnvelope -> SemanticComputationPayload -> review ->
  passing NonSemanticPayloadAttestation -> governed candidate A wrapper and
  mapping -> candidate SemanticStageOutputSetRoot`; the dispatcher validates
  that root and the expected SemanticNeutralProjectionSetRoot, strips their
  bodies and creates the registered THIRD_RECONCILER envelope, payload, review,
  passing attestation, governed CandidateRelationshipReconciliation and mapping;
  and `CandidateCompositionContractRealisationProjection ->
  CandidateCompositionContractProjectionAttestation -> registered candidate
  contract stage root -> contract THIRD_RECONCILER -> passing candidate contract
  reconciliation`; separately, `CandidateCompositionInstanceProjection ->
  CandidateCompositionInstanceProjectionAttestation -> registered instance
  stage root -> conformance THIRD_RECONCILER -> passing
  CandidateCompositionInstanceConformance`; after every contextual and parent
  reconciliation is terminal, two independent contract-set enumerators build
  their separate bounded CompositionContractSetRecompositionRoots, the
  independence validator creates
  CompositionContractSetEnumeratorIndependenceAttestation and the third
  reconciler creates the terminal CompositionContractSetAttestation; that
  attestation, its common digest and the instance conformance enter
  ServingContractMetadata. Source-specific row shards and roots then precede
  the separate ReviewedSourceSpecificOutputClosure; CandidateOutputSeal selects
  that control directly; and CandidateManifestMemberRoot expands it through one
  and only one incoming control edge. CandidateOutputSeal inventories
  both complete composition paths, both recomposition roots, the independence
  attestation, terminal set attestation and metadata, and transitively
  authenticates every reachable control-tree node through those fixed roots,
  before CandidateReleaseManifest and
  CandidateReleaseFreezeAttestation. The two final composition reconcilers
  receive only the stripped contract or instance bodies and the expected
  contract body, while their outer attestations bind the governed wrappers and
  path evidence. A dependency
  expectation may reference its semantic expectation, and a relationship
  revision may name the dependency expectations it discharges. Neither semantic
  expectation nor challenge entry may reference a dependency expectation,
  closure or candidate revision. Neither composition path may reference a
  candidate result, observation, serving row or query-plan output. The independent challenges and
  ContractFreezeAttestation can invalidate selection and certification but are
  never read as claim, relationship, result, metric or serving truth.
- `provisions.ai_metadata.features` may exist temporarily as a derived
  compatibility projection. It cannot remain an independently writable truth.
- Re-extraction builds an offline candidate corpus release. It never partially
  mutates the active corpus. Promotion and cutover follow the immutable,
  transactional ceremony in Phase 9.

### 7. Serving projection and one row contract

- Every candidate materialises one compact
  `ReleaseIntakeDependencyProjection` keyed by candidate or corpus release,
  selected receipt and effective resolution, transitively required replacement
  or exact-duplicate receipt and PASS resolution, processing-policy activation
  and dependency kind. Its root digest is independently recomposed from the
  exact IntakeEligibilityDependencyManifest and CorpusRelease inventory roots and is
  selected by CandidateReleaseManifest and ProductionImportAttestation. It is
  control-plane evidence only: it can answer, in one indexed set-based lookup,
  whether a policy or intake revocation affects a pending or active release. It
  cannot answer a legal row, cohort or metric, and serving requests never join
  it. A missing, stale or unreadable projection is conservatively treated as
  affecting every pending and active release.
- A compact `market_observation` projection is indexed first by CorpusRelease ID,
  governed deal key, concept, metric and party. Its unique identity is
  `(corpus_release_id, metric_observation_occurrence_id)`. The occurrence ID hashes
  `METRIC_OBSERVATION_OCCURRENCE/V1`, schema, governed deal key, exact deal
  admission, concept and metric key and version, party role, value and capacity,
  result key and version or explicit marker, stable owner occurrence type and
  ID, scope type and stable scope ID, governed value-slot key and governed
  ordinal. `owner_type` is `CLAIM_OCCURRENCE` or
  `RESULT_COMPONENT_OCCURRENCE`; the exact selected owner revision is mandatory
  payload lineage, never serving-key identity. `scope_type` identifies a
  ProvisionInstance, ProvisionComponent, ScopeAssessmentOccurrence or
  result-component occurrence. The METRIC_OBSERVATION ExpectedOccurrenceSlot
  precomputes this occurrence ID before extraction.
- An allocated database `deal_id` may remain a foreign key and provenance field.
  It is not part of observation identity, bundle checksums or cross-environment
  parity.
- Canonical serving identities are domain-separated RFC 8785 digests and never
  use allocated database IDs, display text, insertion order or page position.
  `market_observation_serving_key` hashes `MARKET_OBSERVATION/V1`, CorpusRelease ID and
  metric-observation occurrence ID. `result_row_serving_key` hashes
  `RESULT_SERVING_ROW/V1`, CorpusRelease ID and derived-result occurrence ID.
  `reviewed_source_specific_row_serving_key` hashes
  `REVIEWED_SOURCE_SPECIFIC_ROW/V1`, CorpusRelease ID, exact
  effective-terminal `ADMITTED_SEMANTIC` OpenWorldCandidateOccurrence ID. A
  `PRE_ADMISSION_SOURCE_ROLE` occurrence is outside this key domain and cannot
  produce a serving key or row.
  `incomplete_result_review_row_serving_key` hashes
  `INCOMPLETE_RESULT_REVIEW_ROW/V1`, CorpusRelease ID, derived-result occurrence
  ID. Disposition, completeness, comparability and governed reason remain in the
  canonical payload digest, not stable row identity. These domains cannot collide, and no source-specific key contains or
  invents a canonical concept, result, metric, party or unit key.
  `child_collection_key` hashes `RESULT_CHILD_COLLECTION/V1`, CorpusRelease ID,
  derived-result occurrence ID, result key and version, slot key and child kind.
  `child_row_serving_key` hashes `RESULT_CHILD_ROW/V1`, child-collection key,
  stable result-component or relationship occurrence ID, child-projection key
  and governed identity ordinal. It never hashes the current revision or sort
  position. `child_collection_content_digest` hashes
  `RESULT_CHILD_COLLECTION_CONTENT/V1`, collection key, exact total and the
  complete ordered child-row key and canonical-payload-digest pairs. A child
  payload hashes the collection key, not the content digest, avoiding an
  identity cycle. Its parent payload and every child cursor hash the exact
  content digest and total.
  Source-specific and incomplete primitive overflow uses a separate
  `open_world_child_collection_key` hashing
  `OPEN_WORLD_CHILD_COLLECTION/V1`, CorpusRelease, parent shared-row kind and
  serving key, OpenWorldPrimitiveCollectionRoot ID and slot key. Its
  `open_world_child_row_serving_key` hashes that collection key, primitive kind,
  stable primitive key and governed ordinal. The content digest covers the exact
  ordered key-and-payload-digest set and total. These rows are separately indexed
  and use the same keyset child-page contract; no source-specific collection is
  inlined merely because it has no canonical ResultDefinition.
- CanonicalContractBundle generates a closed `ServingExactDetailActionDefinition`
  set. Each definition fixes source-action slot key and version, permitted
  parent kind, detail kind, typed canonical selection-path schema, contextual
  cardinality, comparator and duplicate policy, maximum references and encoded
  bytes, whole-document permission, object-level authorisation predicate, route,
  response schema and projection version. V1 parent kinds are `RESULT_ROW`,
  `INCOMPLETE_RESULT_REVIEW_ROW`, `REVIEWED_SOURCE_SPECIFIC_ROW`,
  `RESULT_CHILD_ROW` and `MARKET_OBSERVATION`; aggregates must first resolve to
  one of those parents. V1 detail kinds are `CLAIM_EVIDENCE`,
  `OPEN_WORLD_EVIDENCE`, `RELATIONSHIP_EVIDENCE`, `RELATIONSHIP_REVISION` and
  `SOURCE_DOCUMENT`. An OPEN_WORLD_EVIDENCE path starts from the parent-selected
  reviewed source-specific or incomplete row and traverses its exact final
  disposition, SemanticImpactClosure, OpenWorldEvidenceClosure, primitive and
  ordered source spans into the same response-safe excerpt and source payload
  machinery. It never exposes a raw discovery, review or similarity payload.
  A SOURCE_DOCUMENT action additionally fixes `pagination_mode =
  SOURCE_BYTE_CURSOR`, `source_chunk_unit = OCTET_RANGE`, positive maximum raw
  chunk bytes, `response_content_encoding = BASE64URL`, cursor-schema digest,
  cursor TTL, response-envelope maximum bytes and immutable carrier kind. The
  compiler proves encoded expansion plus envelope overhead stays within 512 KB.
  Unknown parent, action or detail kinds, unset bounds or a source action without
  that complete pagination contract fail compilation.
- A `selection_path_digest` hashes
  `SERVING_EXACT_DETAIL_SELECTION_PATH/V1`, schema, parent serving kind and key,
  action-definition key and version, complete contextual slot or use key and the
  ordered typed `(logical_type, stable_id, canonical_payload_digest,
  member_or_field_path, governed_ordinal)` path. A claim path traverses selected
  ClaimRevision, ClaimEvidence, Excerpt, every ordered SemanticSpan and exact
  source, including the ExcerptDefinition key, version and payload digest and
  each exact component-slot assignment. A relationship-evidence path starts at the parent-selected
  RelationshipRevision and follows its evidence path. A relationship-detail
  path terminates at that selected RelationshipRevision. A source-document path
  follows the parent-selected evidence or source action to the exact admitted
  source occurrence and content. Every edge is certified, never inferred from a
  matching deal, occurrence or text.
- An immutable CorpusRelease-keyed `ServingExactDetailPayload` ID hashes
  `SERVING_EXACT_DETAIL_PAYLOAD/V1`, schema, CorpusRelease ID, detail kind, exact
  typed terminal canonical object ID and payload digest, canonical response-safe
  body digest, complete source and admission lineage digest and encoded byte
  length. Evidence bodies contain the exact ExcerptDefinition key, version and
  payload digest, complete ordered excerpt-component slots, governed slot and
  span ordinals, SemanticSpan IDs, canonical-text and source-occurrence IDs,
  SourceAdmissionManifest IDs and payload digests, half-open UTF-8 intervals,
  exact-byte digests and transformation or redaction versions. Multi-span and
  cross-source evidence remains one detail payload in governed ExcerptDefinition
  component order. A relationship-revision body contains its complete serving-
  safe legal-effect state, endpoints, affected targets, conditions, temporal and
  precedence fields, effect digest and authorised evidence-reference IDs, but no
  expectation, correction or certification payload. A source-document body is
  an immutable admitted-content descriptor; large content uses bounded range or
  page chunks whose cursor remains bound to this payload, CorpusRelease, fence,
  authorisation and next position. No unrestricted object-store URL is exposed.
- A `ServingExactDetailReference` ID hashes
  `SERVING_EXACT_DETAIL_REFERENCE/V1`, schema, CorpusRelease ID, parent serving
  kind and key, exact ServingExactDetailActionDefinition ID and payload digest,
  contextual slot or use key, selection-path digest, detail kind, exact
  ServingExactDetailPayload ID and canonical payload digest, multiplicity-
  contract digest and governed ordinal. It never hashes the parent row payload
  digest. Detail payloads precede references; references precede the parent row,
  whose canonical payload carries the complete ordered `(action_slot,
  reference_id, detail_kind, governed_ordinal)` set. Two independent candidate
  enumerators prove exact bidirectional equality between parent source-action
  tuples and references, with empty orphan, wrong-parent, wrong-kind and wrong-
  path sets. Reuse under another parent, component, nested definition or cross-
  provision result creates another contextual reference; the immutable detail
  payload may deduplicate within the release. Non-identical comparator ties
  block publication, and exact duplicates collapse only under an expressly
  declared set contract.
- A `ServingExactDetailParentEdge` ID hashes
  `SERVING_EXACT_DETAIL_PARENT_EDGE/V1`, schema, CorpusRelease ID, parent serving
  kind and key, action slot key and version, reference ID, detail kind and
  governed ordinal. Its payload repeats that tuple plus selection-path and
  detail-payload digests. It hashes neither the parent payload digest nor a later
  inventory object. The generated exact-detail RPC joins this indexed edge to
  the CorpusRelease-keyed parent, reference and payload. Exact-detail payload,
  reference and edge IDs are distinct typed serving keys and cannot collide
  with result, child, observation or aggregate keys.
- `aggregate_variant_digest` hashes `MARKET_AGGREGATE_VARIANT/V1`, exact
  MetricDefinition ID, concept and owner or result scope, party role, value and
  capacity, value dimension, canonical unit and basis, per-deal roll-up,
  weighting and algorithm key and version. `aggregate_group_digest` hashes
  `MARKET_AGGREGATE_GROUP/V1` and the ordered dimension key and version,
  reducer key and version and canonical group-value tuples, or the exact
  `EMPTY_GROUP` marker. `cohort_digest` hashes `MARKET_COHORT/V1`, cohort-schema
  version, frozen contract pair, canonical cohort AST, statistical output grain,
  complete eligibility and applicability-state semantics, legal scope, party
  role, value and capacity semantics, denominator and per-deal roll-up rules,
  every referenced dimension, operator, quantifier and reducer key and version,
  and the relevant generated serving, query and canonical key-schema IDs and
  versions. Commutative AST nodes use the contract's canonical ordering;
  non-commutative structure, nesting and same-component versus same-deal scope
  remain identity-bearing. CorpusRelease ID and realised observation membership are
  excluded: CorpusRelease is an outer serving-key field, while the complete realised
  membership belongs only to the aggregate payload's
  `aggregate_input_set_digest`.
  `aggregate_serving_key` hashes `MARKET_AGGREGATE/V1`,
  CorpusRelease ID, aggregate-variant digest, cohort digest and aggregate-group
  digest. Counts, values, `aggregate_input_set_digest`, source revisions and display
  rounding are payload only. Every projection row carries exactly one typed
  serving key, and keys from different row kinds cannot collide.
- For each contract-declared common aggregate,
  `materialised_aggregate_slot_digest` hashes
  `MATERIALISED_AGGREGATE_SLOT/V1`, schema, exact MetricDefinition ID, governed
  common-cohort definition key and version, the complete aggregate-variant
  semantic inputs, group-definition key and version and canonical group-value
  tuple. It excludes the derived cohort digest, aggregate serving key, realised
  observation membership and aggregate value. It is a certification and parity
  control key, not a serving object or a new market identity. Candidate expected-
  key derivation and production import use the same frozen slot universe.
- Each observation derives a `scope_interval_set_key` from the ordered,
  deduplicated half-open evidence or examined-scope intervals of its owner. This
  works for multi-span results and assessment revisions without inventing one
  anchor. `MetricDefinition` governs value-slot ordering by
  occurrence-independent member key, interval-set key, stable owner occurrence
  type and ID and source coordinates. It never orders by selected revision,
  canonical value, raw-value hash, insertion or worker order. An owner with no
  stable comparator requires an explicit governed rule or is quarantined. Exact
  duplicate value-slot proposals collapse before scope freeze; an unresolved
  tie or a candidate value without its precomputed slot blocks publication.
- Every MetricDefinition declares `owner_lineage_mode=CLAIM_ONLY` or
  `RESULT_RELATIONSHIP`. `CLAIM_ONLY` is permitted only when the complete legal
  meaning, eligibility, value and normalisation derive from one ClaimOccurrence
  and its exact selected ClaimRevision,
  its ClaimScopeClosure and its dependency-discharging pre-claim relationships.
  Any metric that depends on a post-claim relationship, cross-provision result,
  trigger, remedy, bring-down, exception treatment or other relationship effect
  must use `RESULT_RELATIONSHIP`; its stable owner is the exact
  result-component occurrence and its payload selects the one
  ResultComponentRevision carrying that ResultInputLineage. Compilation and
  candidate certification reject a relationship-dependent claim-owned
  observation.
- Every observation carries state. A `CLAIM_ONLY` observation carries the stable
  ClaimOccurrence and that selected revision's
  ClaimScopeClosure ID, ordered dependency-discharging
  RelationshipRevision IDs and direct evidence lineage. A
  `RESULT_RELATIONSHIP` observation carries the stable result-component
  occurrence, its ResultInputLineage digest and exact selected
  result-component revision ID. Every observation also carries the exact
  metric CompositionScopeClosure ID, metric-slot definition-basis key, exact
  MetricApplicabilityRequirementProjection ID and payload digest and terminal
  `metric_applicability_requirement_projection_set_digest`. Raw and normalised observations remain
  linked to exact revision and evidence IDs, units, denominators and derivation
  versions. Serving never reconstructs provenance through a runtime text-hash
  join.
- The contract first derives a total canonical metric-slot universe. A
  `metric_slot_key` hashes `MARKET_METRIC_SLOT/V1`, schema, exact
  metric-slot definition-basis key, exact
  MetricApplicabilityRequirementProjection ID and payload digest and terminal
  `metric_applicability_requirement_projection_set_digest`. The basis supplies
  the MetricDefinition, canonical owner, member, interval, party, value,
  capacity and ordinal fields without depending on a post-freeze requirement.
  Only canonical owners enter this slot universe. A REVIEWED_SOURCE_SPECIFIC
  occurrence or row has no metric-slot definition basis, metric slot,
  projection entry, observation or exclusion bucket. For each canonical slot
  there is exactly one disjoint terminal output: a market observation or a
  `MarketMetricSlotExclusion`. The exclusion stable key hashes
  `MARKET_METRIC_SLOT_EXCLUSION/V1`, schema, CorpusRelease ID and exact
  metric-slot key. Its canonical payload is a closed owner-lineage tagged
  union. Both branches hash the frozen pair, metric and owner lineage, claim
  state, exact closed exclusion-reason code,
  source-backed raw value and unresolved basis where permitted, exact
  MetricApplicabilityRequirementProjection ID and payload digest, terminal
  `metric_applicability_requirement_projection_set_digest`, ordered intersecting
  requirement IDs and per-requirement manifest states, intersecting impact
  closures, governed reason and evidence IDs, derivation versions and explicit
  `NO_COHORT_MEMBERSHIP` and `NO_AGGREGATE_AUTHORITY` markers.
  `RESULT_RELATIONSHIP` additionally requires selected result and component
  revisions, result completeness and market comparability. `CLAIM_ONLY`
  instead requires the selected ClaimRevision, ClaimScopeClosure, pre-claim
  dependency-discharge set and explicit `NO_RESULT_LINEAGE`, and forbids
  selected-result, component, result-completeness and result-comparability
  fields, including null placeholders.
- `CANDIDATE_RELEASE_FREEZE/PREPARE_OUTPUT_BATCH/MATERIALISE_OUTPUT_BATCH` with
  discriminator `MARKET_METRIC_SLOT_EXCLUSION` is its sole producer. Its sole
  generated physical carrier is classified as the concrete
  `CANDIDATE_OUTPUT(MARKET_METRIC_SLOT_EXCLUSION)` kind, with stable-key and
  canonical-payload-digest extractors, exact one-per-excluded-slot cardinality,
  candidate-output batch receipt policy, ordinary corpus-object bundle role and
  `RECOMPUTE_COMPARE_IMPORT` production disposition. Import independently
  rederives the complete slot partition from imported canonical owners and the
  frozen contract, requires exact observation-or-exclusion key and payload
  equality, including the exact projection entry and set digest, and only then
  writes the exclusion into the inactive serving
  namespace. Direct DML, another producer, a null reason, an observation and
  exclusion for one slot, or neither output blocks sealing. The candidate and
  production roots and traceability matrix inventory the logical type, carrier,
  kind entry, producer, slot key, payload digest and import parity result.
- A `RESULT_RELATIONSHIP` market observation additionally requires its owner
  result and every required component to be `COMPLETE` and its exact market-
  comparability state to be `COMPARABLE`. A `CLAIM_ONLY` observation instead
  requires its selected ClaimRevision and ClaimScopeClosure to satisfy the
  preceding claim-only branch and has no result fields. Both branches require
  an `impact_clear_for_metric_slot=PASS` projection over the complete evidence,
  primitive and dependency closure. Any intersecting non-isolated residual or
  novel-concept impact fails that projection whether unresolved or finally
  dispositioned. Both branches also require every requirement in
  the slot's exact MetricApplicabilityRequirementProjection entry at
  `COMPLETE_EXAMINED` in the ApplicabilityReexaminationManifest. The manifest's
  unrelated per-requirement states and overall summary cannot exclude the slot.
  Reviewed source-specific values remain only as their Review rows and are
  excluded before metric-slot basis construction, with zero observations proved
  by ReviewedSourceSpecificOutputClosure rather than an exclusion record.
  Missing-basis, incompatible-basis, not-certified and incomplete
  canonical slots remain available through their release-certified Review rows
  and typed canonical exclusion partition. They
  cannot enter an observation, cohort denominator, aggregate input set or cache
  under another metric.
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
- Every aggregate carries its MetricDefinition ID, cohort digest and an
  `aggregate_input_set_digest` equal to
  `H("MARKET_AGGREGATE_INPUT_SET/V1", schema, aggregate serving key, exact
  ordered contributing market-observation serving-key and canonical-payload-
  digest pairs, exact count and empty duplicate set)`. It does not inline a corpus-sized lineage list in
  an interactive response. Two independent candidate-output enumerators
  recompose every cohort digest, aggregate key and
  `aggregate_input_set_digest`; production
  import repeats that derivation and requires exact key-and-payload equality.
  For every materialised common aggregate, the expected import derivation runs
  the frozen cohort AST set-wise over independently rederived expected market
  observations, orders the exact observation-serving-key and reconstructed-
  canonical-payload-digest pairs, recomputes the input-set digest, reruns the
  governed algorithm over unrounded canonical values and reconstructs the
  complete aggregate canonical payload. It reads neither the physical aggregate
  row nor a copied candidate inventory or aggregate digest.
- A compact CorpusRelease-keyed `result_serving_row` projection materialises each
  result's bounded inline slots, state counts, ResultInputLineage,
  relationship-effect projections, source-action references and refinable
  dimensions. Every row records an exact relationship total and a
  `relationship_set_digest`, the domain-separated hash of its schema version,
  ResultDefinition version, ordered RelationshipRevision IDs, states,
  effect-schema versions and exact RelationshipEffectFieldUniverse IDs and
  versions, selected-state
  field-projection and serving-disposition digests, payload digests, endpoint roles, evidence
  references, exact total and child-collection identity. Bounded inline
  relationship records carry
  RelationshipRevision ID, definition and effect-schema versions, state, exact
  RelationshipEffectFieldUniverse ID, endpoint IDs, affected party and component
  roles, effect-payload digest, the
  effect fields required to interpret the result and evidence or source
  actions. Repeatable overflow slots use separately indexed component and
  relationship child projections keyed by `child_row_serving_key`. A cursor is
  signed transport state, never row or collection identity. After the fixed
  admission-token RPC, the one route-specific serving RPC
  joins these projections set-wise;
  neither initial rows nor child pages perform per-component or
  per-relationship queries.
- Separate concrete projections materialise `reviewed_source_specific_serving_row`
  and `incomplete_result_review_row` under their distinct keys. The first carries
  only reviewed source-backed primitives, observed party tokens, exact evidence
  and impact closure. The second carries the affected canonical result and every
  familiar and novel component required to explain why it is incomplete. Both
  carry at most 16 primitive or explanatory component summaries inline, plus the
  exact logical total, complete collection digest and typed open-world child-
  collection reference. Remaining members use the separately indexed child
  projection, default page 50 and hard page maximum 200. They use the same bounded
  set-wise row RPC and exact-detail mechanism; neither may
  manufacture a market observation, canonical key or child value from the
  unfamiliar text.
- `BlockedResultPreviewDefinition` is the sole generated definition for the
  non-persisted `BLOCKED_RESULT_PREVIEW` candidate view. It fixes the pure
  builder executable, configuration and reproducible-build digests; exact
  authenticated candidate Review/Admin route and role set; contract-ordered
  input selector; input, output and evidence-access schemas; typed blocking-
  reason registry; deterministic ordering and cardinality bounds; and the
  literal markers `NO_RELEASE_AUTHORITY`, `NO_MARKET_AUTHORITY` and
  `NO_ACTIVE_POINTER`. The selector may read only immutable candidate-local
  objects already authorised for that reviewer: target candidate and build
  identities, affected ResultDefinition and governed ordinal, familiar
  component revisions, exact blocking candidate occurrence and disposition,
  failed claim state or unresolved dependency, SemanticImpactClosure and
  review-authorised evidence references. It cannot read active serving rows or
  infer a missing input.
- For each affected result, the builder computes `blocked_result_preview_id =
  H("BLOCKED_RESULT_PREVIEW/V1", schema, BlockedResultPreviewDefinition ID and
  payload digest, frozen pair, target candidate ID, candidate build-transition
  ID, affected ResultDefinition ID and governed ordinal, ordered familiar-
  component revision IDs and canonical payload digests, ordered blocking
  candidate-occurrence, disposition and SemanticImpactClosure IDs and payload
  digests, exact failed-state or unresolved-dependency IDs and payload digests,
  typed blocking-reason key, ordered authorised evidence-reference IDs and
  payload digests, and the three literal no-authority markers)`. Its
  `blocked_result_preview_payload_digest` hashes
  `BLOCKED_RESULT_PREVIEW_PAYLOAD/V1`, schema, that ID and the complete canonical
  display payload in the definition's field order. Same inputs produce byte-
  identical output; any changed input rekeys both values. Missing, extra,
  duplicate, conflicting or out-of-order input produces no preview and only the
  local `ROW_RENDER_FAILED` envelope.
- `BLOCKED_RESULT_PREVIEW` has no table, view, materialised view, object-store
  object, event, cache entry or other physical carrier. No OperationActionRegistry
  action may write it, and the CanonicalPhysicalCarrierRegistry and
  CandidateOutputKindRegistry must contain no preview carrier or kind. The
  builder is a bounded read-only operation with zero DML and zero outbox events;
  its returned bytes exist only for the authenticated response. Each preview and
  its lazy evidence panel has an independent render boundary, so builder or
  renderer failure cannot suppress recognised candidate siblings, navigation or
  another preview. Production Review and all market routes have no builder grant
  and continue to resolve the prior active release.
- The definition ID and payload digest, route denial and no-carrier invariant
  enter ServingContractMetadata, candidate certification, release-bundle and
  production-import contract parity and traceability. Only the definition
  propagates. A preview ID, payload digest or payload is forbidden from every
  candidate output root, CandidateOutputSeal, CandidateReleaseManifest,
  ReleaseBundleEnvelope, production namespace, observation, aggregate, corpus
  cache and release trace. Candidate and import certification prove the preview-
  carrier set is empty and that serving and query roles have no builder grant.
- The generated serving projection schema is the total join of each
  RelationshipEffectFieldUniverse with its ResultDefinition serving
  dispositions. Rows carry the exact universe ID and version and selected-state field
  projection digest. Serving may read only that generated schema and materialised
  candidate field values. It cannot read either path's
  RelationshipEffectConstraint, semantic computation or review payload,
  reconciliation differences or candidate-actual audit payload.
- Every result row and child row carries the exact result and result-component
  revision IDs, ordered ClaimRevision IDs, ordered RelationshipRevision IDs,
  ClaimScopeClosure and CompositionScopeClosure IDs, relationship-definition
  and effect-schema versions, exact RelationshipEffectFieldUniverse IDs,
  effect-payload digests, affected endpoint and party roles, evidence references
  and source actions required by its ResultDefinition. Full serving-safe
  relationship or evidence detail may load lazily only through a parent-carried
  ServingExactDetailReference. A bare RelationshipRevision, ClaimEvidence,
  RelationshipEvidence, Excerpt, source-occurrence or blob ID is never
  resolvable. No legal effect required to interpret the row may be omitted from
  its bounded effect projection.
- Every result row, child row, market observation and aggregate has a canonical
  payload digest covering the frozen contract pair, claim state, result
  completeness, market comparability, governed reason IDs, raw and canonical values, party, exact
  occurrence and revision lineage, ClaimScopeClosure and CompositionScopeClosure IDs,
  RelationshipRevision IDs, relationship states, RelationshipEffectFieldUniverse
  IDs, selected-state field-projection and serving-disposition digests,
  relationship-set and effect-payload digests, affected endpoints, exact relationship total, child
  child-collection key, content digest and total, component and evidence
  references, source actions and complete ordered exact-detail reference tuples,
  cohort and denominator counts, refinable dimensions and derivation lineage.
  Any relationship or effect revision changes the digest even when the display
  text and serving key remain unchanged. Each exact-detail payload, reference
  and parent edge has the separate closed canonical payload defined above.
  Release manifests inventory ordered
  `(serving_object_kind, serving_key, canonical_payload_digest)` pairs for
  canonical result rows, reviewed source-specific rows, incomplete-result Review
  rows, child rows, observations, aggregates, exact-detail payloads,
  exact-detail references and parent-reference edges, never keys or counts
  alone. Generated schemas, unique constraints, indexes, RPC results, caches,
  cursors, traceability and release/import parity use these exact typed keys.
  These are canonical logical identities only. Every production physical
  primary key, unique constraint, index prefix and foreign key over a serving
  object additionally includes `serving_namespace_id`; no global uniqueness or
  cross-object reference may be enforced on `(CorpusRelease ID, serving key)`
  alone.
- Review, Corpus Context, Compare, Query, Admin and exports consume one generated
  `SharedServingRow` tagged union. `CANONICAL_RESULT` is generated from a frozen
  ResultDefinition after exact composition reconciliation and passing instance
  conformance. `REVIEWED_SOURCE_SPECIFIC` is generated from one final reviewed
  OpenWorldCandidateDisposition, evidence closure, primitive set, independently
  reconciled SemanticImpactClosure and impact disposition and has
  explicit forbidden canonical-result, concept, metric and market-cohort fields.
  For a source-role candidate it additionally binds the exact
  OpenWorldCandidateAdmissionTransition and carried-forward admitted
  disposition; its pre-admission occurrence and disposition are audit lineage,
  never a second row.
  `INCOMPLETE_CANONICAL_RESULT` is generated from one affected canonical result
  whose `result_completeness` is `INCOMPLETE_NOVEL_SEMANTIC`,
  every intersecting final disposition and SemanticImpactClosure and its exact
  incomplete component slots. No generic, null-filled or `OTHER` row variant is
  permitted. A `FAILED` claim or result and a `BLOCKED` result are candidate-
  review states only and may never inhabit any SharedServingRow variant,
  including through a nullable state, generic error payload or incomplete-result
  row. Components and clients do not reconstruct legal relationships, scope
  closure or metric definitions independently.
- The common field set is only CorpusRelease, frozen pair, deal, row kind,
  serving-access, denylist and embedded-reference-allowlist digests, provenance,
  exact source actions and complete ordered ServingExactDetailReference tuples.
  `CANONICAL_RESULT` additionally requires canonical result and concept, complete
  party role, value and capacity, result and component states, exact
  ClaimRevision, RelationshipRevision, ClaimScopeClosure,
  CompositionScopeClosure and ResultInputLineage refs, bounded effects, raw and
  canonical values, `result_completeness=COMPLETE`, comparability and governed
  reason, refinable dimensions and, only when comparability is `COMPARABLE`,
  market observations, cohort and denominator. `INCOMPLETE_CANONICAL_RESULT`
  requires the same canonical identity and familiar component lineage, exact
  intersecting candidate, disposition and SemanticImpactClosure refs,
  `result_completeness=INCOMPLETE_NOVEL_SEMANTIC`,
  `market_comparability=NOT_CERTIFIED` and exact incomplete reason; it forbids
  observations, cohort and denominator. `REVIEWED_SOURCE_SPECIFIC` requires its
  candidate occurrence, final disposition, reviewed display label and reason,
  exact ReviewedSourceSpecificPublicationDecision and the source-claim state
  derived from its selected reviewed source-backed primitive occurrence,
  observed party tokens, OpenWorldPrimitiveCollectionRoot opaque ID and certified
  digest, exact primitive total, bounded inline prefix, open-world child-
  collection reference, exact impact value and SemanticImpactClosure, evidence refs and
  `market_comparability=REVIEWED_SOURCE_SPECIFIC`; it forbids canonical result,
  concept, metric, unit and party keys, result completeness, ResultInputLineage,
  observations, cohort, denominator and canonical refinements. An affected known
  result is represented separately by its incomplete row. No forbidden field may
  be present as null. A component remains individually inspectable even when
  several components form one row. An omitted, duplicated, stale, schema-invalid
  or impermissibly reordered lineage member fails server validation before cache
  insertion or rendering.
- The general `CANONICAL_RESULT` variant may use only `COMPARABLE`,
  `NOT_COMPARABLE` or `NOT_CERTIFIED` comparability values generated by its
  frozen ResultDefinition. `REVIEWED_SOURCE_SPECIFIC` is schema-invalid in that
  branch even when the underlying disposition has that value. The sole
  publication path is the separately tagged `REVIEWED_SOURCE_SPECIFIC` variant
  with its exact publication decision. No nullable, generic or canonical-result
  path may bypass that decision.
- Review and authorised Admin may render all three release-certified variants.
  Corpus Context, Compare and Query may return a source-specific or incomplete
  row only as typed selected-deal context with its exact non-comparability
  reason; they exclude it from canonical market cohorts, prevalence,
  distributions and aggregates. A later governed taxonomy version may admit it
  only after mapping or adoption and complete applicability re-examination.
- The browser uses an exhaustive generated variant switch and one error boundary
  per row and per lazy detail panel. A valid reviewed source-specific or
  incomplete row is ordinary data, never an exception. If one row renderer or
  detail action nevertheless fails operationally, that row shows a typed
  `ROW_RENDER_FAILED` or `DETAIL_UNAVAILABLE` envelope with no invented legal
  state, while every sibling provision, navigation item and independently valid
  row remains mounted, clickable and usable. A page-level error boundary may not
  replace a deal because one provision is unfamiliar, non-comparable or lacks a
  market observation.
- CanonicalContractBundle generates a total `ServingObjectAccessRegistry` over
  every logical object and schema and every physical table, view, RPC, function,
  object-store prefix and bundle-member carrier. Each has exactly one
  disposition: `SERVING_MATERIALISED_PROJECTION`,
  `SERVING_EXACT_SOURCE_DETAIL`, `SERVING_CONTROL_PLANE` or
  `OFFLINE_CERTIFICATION_ONLY`. Unknown, duplicate or unclassified carriers fail
  compilation. `OfflineCertificationArtefactDenylist` is exactly the complete
  `OFFLINE_CERTIFICATION_ONLY` projection, not an illustrative list. Its digest
  hashes each ordered logical type, schema version, carrier kind, carrier name
  or prefix and denied action.
- The denylist includes CanonicalContractBundle; every ordinary ClaimDefinition,
  ClaimScopeDefinition, RelationshipDefinition, RelationshipEffectSchema,
  ResultDefinition, MetricDefinition and ServingExactDetailActionDefinition
  payload; both independent catalogues;
  every expectation and ClaimScopeClosure or CompositionScopeClosure payload;
  ContractFreezeAttestation; CandidateReleaseManifest; all intake, source
  admission, correction approval, challenge, semantic, reconciliation,
  composition, scope, extraction, candidate-build, freeze, certification,
  ReleaseBundleEnvelope, every WalkerTrustStatusProof,
  ProductionSemanticParityRoleRegistry,
  ProductionSemanticParityEnumeratorIndependenceAttestation, every
  ProductionSemanticParityRunSlot, ProductionSemanticParityRunClaim,
  role-output root set, walker-output,
  two-role output-set, reconciler-output and terminal three-role output-set
  attestation, ProductionSemanticParityAttestation,
  ProductionMarketObservationParityRootPair,
  ProductionMaterialisedCohortParityRootPair,
  ProductionMarketAggregateParityRootPair,
  ProductionServingContractMetadataParityRootPair, ProductionImportAttestation, cutover and completion
  payloads except an expressly generated serving control-plane projection. It
  also includes every AttemptAuditObjectRegistry definition and every runtime
  `OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)` carrier, including every AttemptAudit
  tree node, required-object root, coverage-projection root, reconciliation and
  AttemptAuditTerminal; every ReleaseBundleControlAbandonmentTerminal and other
  abandonment carrier; every bundle, import and semantic-parity spool-erasure
  receipt and receipt-set attestation; and every failure or abandonment
  decision, event, head and receipt. No erasure, abandonment or audit carrier
  may receive a serving disposition, embedded-reference allowance, RPC path,
  object-store resolver or cache role.
  It
  specifically includes ExpectedCompositionContractProjection,
  CompositionContextKeyUniverseRoot and every reachable tree node,
  CandidateCompositionImplementationCatalogueRoot and every reachable
  catalogue and source-artefact tree node, both
  CompositionContractSetRecompositionRoots and their tree nodes,
  CompositionContractSetEnumeratorIndependenceAttestation and
  CompositionContractSetAttestation,
  ExpectedOccurrenceSlot, ExpectedResultInputLineageSlot, both candidate
  composition projections and projection attestations, candidate contract
  reconciliation, CandidateCompositionInstanceConformance and every Correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  ManifestMembershipRevision, CorrectionDischarge, CorrectionDischargeMap,
  MultiSubjectScopeCorrectionReceipt/V2 and correction event or head payload.
  It also includes every ImmutableSourceDocument and
  SourceAdmissionPreparationReceipt, SemanticExtractionInputEnvelope,
  SemanticInferenceTranscript, ReviewedInferencePayload,
  SemanticGraphNormaliserDefinition, ValidatedSemanticGraph, raw
  OpenWorldSemanticCandidate and occurrence, candidate- and kind-supersession,
  every OpenWorldCandidateAdmissionTransition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot,
  OpenWorldCandidateChainReconciliation, evidence
  closure, primitive graph and collection root, candidate-disposition and impact-walker payload,
  SemanticImpactClosure, ApplicabilityEligibleMemberKindProducerRegistry/V3, every
  ApplicabilityReexaminationRequirementDefinition and the requirement-set root,
  every ApplicabilityReexaminationRequirement, Entry,
  Slice, ScopeSubjectApplicabilityRoot, global tree node and root, independence attestation,
  ApplicabilityReexaminationReconciliation and
  Manifest, every MetricApplicabilityRequirementProjection and projection set,
  ReviewedSourceSpecificOutputClosure, every empty or non-empty OpenWorldReviewQueueRoot and
  OpenWorldSimilarityProposal. Only their separately
  generated reviewed, release-certified serving projections may receive a
  serving disposition.
  Serving, query,
  cache and client roles receive no payload read, join, resolver, object-store
  or import path to a denylisted carrier.
- A separately generated total `ServingEmbeddedReferenceAllowlist` hashes each
  generated serving-schema ID and field path, referenced denied type,
  `OPAQUE_ID` or `CERTIFIED_DIGEST` role, cardinality and byte bound. It permits
  only opaque scalar IDs or digests already required by the row contract,
  including ClaimScopeClosure, CompositionScopeClosure,
  RelationshipEffectFieldUniverse and ResultInputLineage IDs or digests,
  OpenWorldCandidateOccurrence, final disposition,
  OpenWorldPrimitiveCollectionRoot and SemanticImpactClosure IDs or certified
  digests,
  field-disposition and projection digests, composition-contract-set digest,
  frozen contract pair and denylist digest. Such a field has no foreign key,
  resolver, object-store path or runtime dereference.
- ServingExactDetailReference, ServingExactDetailParentEdge and bounded
  ServingExactDetailPayload carriers are
  `SERVING_MATERIALISED_PROJECTION`. Exact immutable source-byte carriers are
  `SERVING_EXACT_SOURCE_DETAIL` and are reachable only through the generated
  exact-detail RPC. The reference, edge and payload carriers themselves grant no
  generic serving-role `SELECT` or resolver; only generated parent-row RPCs may
  expose reference IDs and only the exact-detail RPC owner may join them.
  Canonical ClaimEvidence, RelationshipEvidence, Excerpt,
  RelationshipRevision, source-admission and historical revision carriers are
  `OFFLINE_CERTIFICATION_ONLY`; serving roles receive no direct table, view,
  generic resolver or object-store grant to them. The embedded-reference
  allowlist may expose their IDs only as `OPAQUE_ID`. Only a
  ServingExactDetailReference ID is resolvable, and detail payloads cannot be
  used for query filtering, grouping, sorting or aggregation.
- A bounded, release-state-neutral `ServingContractMetadata` projection contains
  only its exact candidate `CorpusRelease` ID and frozen contract pair, generated
  serving and query schema IDs and digests, complete cache-identity-definition
  set, exact QueryDefinitionSetRoot, QueryGoldenSuiteManifest and passing
  QueryGoldenCertificationAttestation IDs and payload digests, cache-value and
  response-binding schema digests,
  exact BlockedResultPreviewDefinition ID and payload digest, its authenticated-
  candidate-only route tag and the literal `NO_PHYSICAL_CARRIER`,
  SharedServingRow union and tag-schema version, exact per-variant required and
  forbidden field matrix and route and market-eligibility matrix,
  the exact passing CompositionContractSetAttestation ID and its independently
  recomposed certified `composition_contract_set_digest`, exposed stable keys
  and versions, operator,
  dimension and reducer descriptors, exact-detail action and response-schema
  digest, canonical key-schema versions and allowlist and denylist digests. Its
  ID hashes `SERVING_CONTRACT_METADATA/V1`, schema and
  that complete closed field set. It contains no active-release-state tuple,
  ActivationEvent or ServingFenceVersion reference. Candidate certification independently
  recomposes and validates every embedded value. PREPARE_OUTPUT_BATCH creates
  the final metadata only after its CorpusRelease and composition-contract-set
  attestation exist, and both output enumerators inventory it before
  CandidateOutputSeal; FREEZE only selects it through those roots. Import
  parity independently recomposes the same digest and rejects a copied-only,
  missing or mismatched value. Serving
  roles receive grants and imports only for the three serving dispositions and
  generated RPCs. The generated import graph, database grants and bundle
  classification must be byte-equal; unknown imports fail build and startup.
  Poisoning a denylisted payload cannot change a row or cache result. A digest
  mismatch may revoke readiness or exposure, but never supplies serving truth.
  At request admission, `admit_and_resolve_fence` supplies the complete live
  canonical release-state tuple and exact READY_CANONICAL ServingFenceVersion.
  It rejects an expired fence before cache lookup or admission-RPC checkout. While
  the matching PostActivationControlHead is non-terminal, that fence's expiry
  cannot exceed the context's frozen READY deadline; only `PASS_FIXED` permits
  an ordinary policy-bounded successor renewal. The fixed admission-token RPC,
  before cache lookup, requires the active serving-
  namespace header to bind the exact active CandidateReleaseManifest selector,
  this metadata ID and payload digest and this metadata's CorpusRelease lineage,
  and requires all shared contract and schema digests to match. The server never
  dereferences CandidateReleaseManifest payload to answer a request. No combined mutable or post-activation binding is
  persisted into, or selected by, CandidateReleaseManifest or ReleaseBundleEnvelope.
  Every READY fence also carries a `serving_epoch_id`. That ID hashes the exact
  ready variant, active release or legacy target, namespace and contract
  metadata, authorisation scope, access-policy and revocation generations,
  release-state tuple and provider, runtime and schema compatibility, but
  excludes fence version, renewal generation and expiry. A routine `PASS_FIXED`
  renewal for the byte-identical tuple preserves the epoch and may overlap its
  predecessor. Any release, target, namespace, contract, authorisation, policy,
  revocation, runtime, schema or compatibility change creates a new epoch and
  first blocks and drains the old one. Physical fence ID and generation remain
  request-admission and audit data, not cache, cursor or export identity.
  The access-registry, denylist and embedded-reference-allowlist digests
  propagate through CanonicalContractBundle,
  CandidateReleaseManifest, DeploymentManifest, ReleaseBundleEnvelope,
  ProductionImportAttestation, route and action matrix, RPCs, cache and result
  schemas and traceability. Candidate certification, release-bundle walking and
  production-import parity reject any preview instance or carrier while
  requiring byte-equal propagation of the definition and its route denial.
- Production semantic parity has exactly the three registered execution roles
  `SEMANTIC_EXPECTED`, `SEMANTIC_PHYSICAL` and `SEMANTIC_RECONCILER`, but those
  roles reconstruct and reconcile exactly four closed serving categories:
  serving-contract metadata, market observations, contract-declared
  materialised cohorts and materialised aggregates. A fourth governed root
  pair, `ProductionServingContractMetadataParityRootPair`, hashes
  `PRODUCTION_SERVING_CONTRACT_METADATA_PARITY_ROOT_PAIR/V1`, schema, the exact
  production-semantic-parity terminal slot, role registry, terminal-PASS
  expected-and-physical two-role output-set attestation and reconciler claim;
  the expected and physical neutral root references, content digests and counts;
  the complete one-row metadata key universe; and fixed empty missing, extra,
  duplicate, wrong-key, wrong-field, wrong-payload and forbidden-back-reference
  roots. Its
  sole neutral member is the exact `(ServingContractMetadata ID,
  canonical_payload_digest)` tuple. The producing roles must reconstruct the
  complete contract-ordered field values before deriving that tuple. It is a
  fourth category produced
  by the same three roles, never a fourth role or a separate trusted comparer.
- The expected role reconstructs the complete metadata bytes and ID only from
  the frozen serving and query schemas, exact QueryDefinitionSetRoot and
  QueryGoldenSuiteManifest, the exact passing
  QueryGoldenCertificationAttestation selected by its governed promotion-
  evidence slot, the SharedServingRow required/forbidden-field and route
  matrices, ServingObjectAccessRegistry, denylist, embedded-reference allowlist,
  composition-contract-set attestation and other metadata inputs fixed above.
  It cannot read stored ServingContractMetadata, an inactive metadata carrier,
  an asserted metadata ID or digest, or physical-role output. The physical role
  reads only the registered inactive ServingContractMetadata carrier and frozen
  field-encoding and canonicalisation schemas. It reconstructs canonical bytes,
  payload digest and ID from physical columns in contract order while treating
  stored ID and digest columns solely as assertions to test, never derivation
  inputs. It cannot call the expected builder or read an expected root. The
  reconciler reads only the authenticated expected and physical neutral roots
  and frozen comparison schema and has no source, canonical-owner, candidate,
  inactive-namespace or metadata-carrier capability.
- `ProductionServingContractMetadataParityRootPair` and every reachable
  difference node are bound by the reconciler output, terminal three-role set,
  ProductionSemanticParityAttestation, ProductionImportAttestation and
  POST_IMPORT traceability. The root pair, role outputs and evidence are
  `OFFLINE_CERTIFICATION_ONLY` and enter the exact generated denylist. Only the
  independently reconstructed, byte-equal ServingContractMetadata carrier may
  receive its generated serving-control-plane disposition. The passing
  QueryGoldenCertificationAttestation is transported after contract freeze as
  the tenth fixed governed promotion-evidence slot and is selected by exact ID
  and payload digest during expected reconstruction and import certification.
  It is never hashed into the CanonicalContractBundle fingerprint and never
  becomes a CanonicalContractBundle member merely because
  ServingContractMetadata refers to it; the later release bundle carries it
  only in the governed promotion-evidence destination.
- Presence prevalence is secondary context. The primary comparison is the
  treatment of each applicable claim, using the examined and applicable cohort
  as its denominator.

### 8. Governed query compiler and fast result delivery

- Numeric query-shape, payload, cursor and export values in this section are
  CanonicalContractBundle protocol bounds. Latency values are
  CertificationPolicyManifest pass thresholds. Exact deployed route, cache and
  capacity settings exist only in their three disjoint operational manifests
  and may be stricter, never looser, than a protocol bound.
- Query certification covers immutable definitions, not an unbounded history of
  user traffic. `QueryDefinitionSetRoot` inventories the exact query contract
  and version; output-grain, QueryDimension, predicate, quantifier, reducer,
  route and action definitions; request, result, cursor and error schemas;
  every ServingCacheIdentityDefinition; compiler executable, configuration and
  reproducible-build digests; generated SQL and RPC definitions; required
  indexes and materialised views; and route budgets. Its ID hashes
  `QUERY_DEFINITION_SET_ROOT/V2`, schema, exact CanonicalBundleInputIdentity ID
  and payload digest, contract-ordered member stable IDs and canonical payload
  digests, per-kind counts and fixed empty missing, extra, duplicate and
  conflicting-definition roots. It expressly excludes the bundle fingerprint,
  ContractFreezeAttestation and frozen pair.
- `QueryGoldenSuiteManifest` is generated from the human-reviewed golden
  fixtures in the governed bundle-input set. It inventories every fixture and
  its canonical plan AST, SQL and parameter-schema digest, result-schema digest,
  expected typed rows, cohort and aggregate semantics, error branch, index and
  plan requirement and test ID. Its ID hashes
  `QUERY_GOLDEN_SUITE_MANIFEST/V2`, schema, exact
  CanonicalBundleInputIdentity ID and payload digest, exact
  QueryDefinitionSetRoot ID and payload digest, the contract-ordered fixture IDs
  and canonical payload digests, per-kind counts and fixed empty missing, extra,
  duplicate and conflicting-fixture roots. QueryDefinitionSetRoot,
  QueryGoldenSuiteManifest and the attestation schema are bundle members and
  enter the CanonicalContractBundle fingerprint; no executed certification
  attestation does.
- `QueryGoldenCertificationAttestation` is created only after bundle compilation
  and ContractFreezeAttestation. Its ID hashes
  `QUERY_GOLDEN_CERTIFICATION/V2`, schema, exact bundle fingerprint and root-
  manifest digest, ContractFreezeAttestation ID and payload digest, exact
  QueryDefinitionSetRoot and QueryGoldenSuiteManifest IDs and payload digests,
  frozen fixture roots, executed actual plan, SQL and typed-result roots and
  digests, expected-versus-actual empty difference roots, index and performance
  proofs, validator executable, configuration and evidence digests and terminal
  `PASS`. It is external certification evidence: its ID, payload digest and
  exact frozen pair enter ServingContractMetadata, candidate certification,
  the tenth governed promotion-evidence slot, ReleaseBundleEnvelope,
  production-import parity and traceability, but neither the attestation nor any
  executed output enters the CanonicalContractBundle fingerprint. Promotion
  transports that exact external attestation through the evidence slot; it does
  not retroactively become a CanonicalContractBundle member, while the later
  release bundle carries it as that governed evidence member. A new bundle fingerprint, freeze
  attestation, query root, suite, executable output or proof requires a new
  attestation.
- Natural-language prompt instances, runtime QueryPlans,
  `serving_request_intent`, QueryPageRequests, cursor instances, execution
  records, admission leases and tokens, CanonicalServingCacheIdentity,
  CanonicalServingCacheValue and ServingResponseBinding instances and individual
  saved-query executions are operational only. Individual SavedQueryDefinition
  versions are user-owned operational data; their schema and compiler behaviour
  are certified, not their instances. Runtime objects carry the resolved frozen
  pair and release tuple and append to the separate operational audit. They are
  never candidate members, release trace rows or corpus truth and cannot mutate
  a completed trace. CompletionTraceCutoff may capture the operational-audit
  head at completion without purporting to enumerate later requests.
  Per-request admission-consumption records live in UTC-day Postgres partitions
  with exactly the current and preceding two partitions online. Before an older partition is dropped, an independent
  exporter writes its canonical member root, counts and hourly typed aggregates
  to immutable object storage and a signed
  `OperationalAuditPartitionArchiveReceipt`; only a verified receipt permits
  the generated partition-drop action. Raw rows are retained online for at most
  72 hours. Archive receipts and hourly aggregates use monthly partitions, have
  a fixed 400-day online retention, and are then exported and dropped under the
  same rule. `CapacityManifest` fixes maximum admission rate, per-row bytes,
  partition bytes, indexes, export deadline and emergency backpressure below the
  database storage and write ceilings. ServingResponseBinding is never written
  to Postgres. After the final wire bytes and digest exist, the runtime appends
  it to the external immutable operational-audit sink through a bounded local
  queue. This append is not a database call or route-serving dependency, carries
  no response authority and cannot delay or alter corpus data. CapacityManifest
  fixes queue entries, bytes and flush deadline; sink failure opens admission
  before the queue bound and drains or rejects later requests, never drops or
  fabricates a binding. A missing export, oversized row, late
  partition, unbounded index or failed drop opens the circuit before the bound
  is exceeded. CompletionTraceCutoff binds the current partition-head and
  archived-root tuple, not indefinite raw-row retention.
- Before fence admission, every serving action creates one tagged
  `serving_request_intent_digest` hashing `SERVING_REQUEST_INTENT/V1`, route and
  action definition, canonical caller-input digest, requested selector or saved-
  query ID plus caller-supplied expected immutable definition digest, encoded
  cursor digest or `FIRST_PAGE`, requested page or chunk
  bound, response-schema digest, authorisation-scope digest, request nonce and
  idempotency key or explicit `NONE`. The closed tags are query initial, query
  cursor, child cursor, facet, field values, INLINE detail, source initial,
  source cursor, saved-query execution, export start and export chunk. It
  contains no fetched saved-query template, active state or fence returned by
  admission. The admission token binds this intent. Any saved-query lookup
  occurs only after admission and must return that exact ID and definition
  digest. The post-admission QueryPageRequest, exact-detail request,
  export-chunk request or other generated execution request then hashes both the
  same intent and the resolved tuple and fence. RPC execution requires byte-
  equality among caller intent, token intent and execution-request intent. A
  cache identity may be derived only after that equality passes, but neither the
  request-intent nor execution-request digest is a cache-identity input. An
  unregistered tag, changed input after admission or cross-route token performs
  zero cache or database access.
- CanonicalContractBundle generates one total `ServingCacheIdentityDefinition`
  for every cacheable action. It classifies every request field exactly once as
  `CANONICAL_CONTENT_INPUT`, `SECURITY_OR_RELEASE_PARTITION` or `REQUEST_ONLY`.
  Unknown, omitted or multiply classified fields make the action non-cacheable.
  `REQUEST_ONLY` includes request nonce, idempotency key, request and execution
  IDs, admission token or lease, timestamps, cache hit or miss, encoded-cursor
  digest, cursor signature or MAC, issue and expiry times and signing-key
  metadata. Those values remain mandatory admission, transport and operational-
  audit inputs but are prohibited from every canonical cache identity and
  cached value.
- Natural-language prompts, the manual builder, saved queries and in-product
  launch actions compile to one versioned, cursor-free `QueryPlan`. They never
  address raw feature aliases or choose arbitrary cards.
  `query_semantics_digest` hashes `QUERY_SEMANTICS/V2`, query-contract version,
  exact active CandidateReleaseManifest ID and payload digest, active
  CorpusRelease ID, active serving-namespace ID and header digest, active
  ServingContractMetadata ID and payload digest, frozen contract pair, exact
  release-certified `composition_contract_set_digest`, generated serving and query schema
  digests, ServingObjectAccessRegistry, denylist and embedded-reference
  allowlist digests, output grain, result and metric keys and versions,
  component, party role, value and capacity and legal scope, canonical cohort
  AST, selected dimensions and reducer
  versions, predicates, groupings, facets, columns and complete sort contract.
  It excludes cursor, page size, request or execution ID, fence admission token,
  timestamps and signing metadata. Pagination never recompiles or mutates it.
  Every relationship-effect selector additionally carries exact
  RelationshipEffectFieldUniverse ID, field key and ResultDefinition
  serving-disposition and projection digest. The complete manifest selector,
  CorpusRelease lineage, namespace and header, metadata pair, frozen pair,
  authorisation scope and query-semantics digest enter cache and response metadata. The
  composition digest is copied from the bounded ServingContractMetadata whose
  CorpusRelease ID equals the admitted active CorpusRelease lineage, never
  hydrated by joining offline composition artefacts. Ambiguity produces a
  refinement request, not an invented field.
- An immutable `QueryPageRequest` has
  `query_page_request_digest` equal to the hash of `QUERY_PAGE_REQUEST/V2`,
  serving-request-intent digest, query-semantics digest, exact canonical release-state tuple digest and
  generation, exact READY ServingFence ID and generation, page kind, requested
  page size, `FIRST_PAGE` or exact cursor-payload digest and `child_scope` or
  `NONE`. Child scope is the parent
  result-row serving key, slot key, child-collection key,
  child-collection-content digest and exact total and is mandatory only for a
  child page. A requested size above the hard maximum fails before cache or
  database access and is never clamped.
- After complete cursor validation, `canonical_page_position_digest` hashes
  `QUERY_PAGE_POSITION/V1`, schema, page kind, output grain and either
  `FIRST_PAGE` or the decoded cursor kind, complete last-row sort tuple and last
  complete typed `query_selected_row_key`, plus `child_scope` or `NONE`. It
  excludes encoded transport, signature, issue, expiry and signing-key fields.
  `canonical_action_input_digest` for a query page hashes
  `QUERY_PAGE_CACHE_INPUT/V1`, schema, query-semantics digest, page kind,
  requested page size, canonical-page-position digest, child scope or `NONE`
  and the exact canonical facet, field-value or other action selector fields
  generated for that tag. Saved-query identity is replaced by its validated
  compiled semantics, so two authorised definitions with byte-identical
  semantics may share a body without sharing execution or audit identity.
- A `CanonicalServingCacheIdentity` hashes
  `CANONICAL_SERVING_CACHE_IDENTITY/V1`, schema, exact
  ServingCacheIdentityDefinition ID and version, route and action-definition ID
  and payload digest, exact CandidateReleaseManifest ID and payload digest,
  CorpusRelease ID, serving-namespace ID and header digest,
  ServingContractMetadata ID and payload digest, ProductionImportAttestation ID
  and payload digest, frozen contract pair, complete canonical release-state
  tuple digest and generation, exact `serving_epoch_id`,
  authorisation-scope digest, access-policy, revocation and result-contract
  generations, response-schema digest and canonical-action-input digest. Its
  schema expressly forbids serving-request-intent, QueryPageRequest,
  ServingExactDetailRequest or any other generated execution-request digest,
  request nonce, idempotency, request or execution
  ID, admission token or lease, timestamps and cursor transport or signing
  fields.
- Every relationship-effect field that a QueryPlan may select, filter, group or
  sort is present in the governed RelationshipEffectFieldUniverse, assigned a
  total non-`NOT_RESULT_RELEVANT` ResultDefinition disposition and materialised as a bounded typed serving
  dimension and covered by a governed index or materialised aggregate. An
  interactive request never recursively traverses the canonical relationship
  graph or loads relationship revisions into Node to evaluate a predicate.
  Undeclared or unindexed effect traversal is rejected at compilation.
- Every repeatable QueryDimensionDefinition has a total
  operator-by-multiplicity contract: output grain, canonical element equality,
  ordering and deduplication, completeness state, maximum cardinality and,
  separately for select, filter, group, facet, sort and export, exactly one of
  `SCALAR`, explicit `EXISTS`, `NONE` or non-vacuous `ALL` quantifier,
  `CANONICAL_SET` or governed reducer. Closed general reducers are
  `COUNT_DISTINCT`, `MIN`, `MAX` and `LEXICOGRAPHIC_CANONICAL_SET`; `MIN` and
  `MAX` require a compatible total order. `EXPLODE_DISTINCT` is permitted only
  for group or facet, with labelled multi-membership, distinct subject and deal
  counts and a warning that buckets need not sum to the cohort. `FIRST` or
  `LAST` is permitted only as a separately named legally meaningful
  source-order reducer in the authored definition. Implicit first, last,
  majority, row multiplication or order-dependent selection is forbidden.
  Reducer key and version and output grain enter composition requirements,
  generated schema and index, query-semantics digest, aggregate key and
  response. An incomplete or overflowed repeatable collection yields `UNKNOWN`
  for quantified filtering and an explicit excluded or unknown bucket for
  group, facet and sort unless its authored contract defines a complete bounded
  child collection. It can never reduce an observed prefix.
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
  executable SQL goldens. The five-state algebra is a total conformance contract
  for candidate Review/Admin and isolated compiler fixtures, not permission to
  publish a blocked state. A canonical market-cohort QueryPlan may select only
  `PRESENT`, `ABSENT` and permitted `NOT_APPLICABLE`; `FAILED` and
  `NOT_EXAMINED` have zero market-observation and predicate membership. A
  separate generated `SELECTED_DEAL_CONTEXT` output mode may return a release-
  certified `INCOMPLETE_CANONICAL_RESULT` carrying `NOT_EXAMINED` only under the
  exact `CONTRACT_EXPANSION_REEXAMINATION_PENDING` branch and complete
  ApplicabilityReexaminationManifest. It cannot be negated, coerced, filtered
  into a cohort or counted as examined. Any `FAILED`, other `NOT_EXAMINED` or
  unresolved row fails before cache insertion or active response.
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
- One user action creates one `query_execution_id` and idempotency key. After
  its mandatory admission-token RPC, it makes at most one route-specific
  serving RPC. In-app navigation carries the validated bounded response and
  performs no new database action. A direct load, reload or missing client
  response state is a new `query initial` action: after admission it compiles
  once and executes exactly one bounded set-based serving RPC. Launcher
  validation, saved-query validation and redirects cannot execute and discard
  a query before mounting the result. No result-page carrier, per-query result
  write, retention table or result-fetch intent exists.
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
    or an explicit certified non-comparable state. Blocked extraction states are
    visible only in authorised candidate Review/Admin and cannot enter this
    active result.
- “What's market?” and future query experiences compose these same operators.
  They do not create a sixth extraction or aggregation path. The canonical
  example “termination fees market check” returns percentage of the identified
  deal-value basis as the primary metric, raw dollars as source context,
  company/Target versus reverse/Buyer fee role and exact `TRIGGERS_REMEDY`
  effect projections for trigger predicate, remedy, payor, payee or right
  holder, tail, conditions and exclusivity or cumulative effect, plus evidence,
  exclusions and refinable deal dimensions. None of those fields is inferred
  from the fee label or neighbouring text at query time.
- Every request and result has a generated JSON schema and contract version.
  Every query execution, output and response carries the admitted
  ServingFenceVersion ID and generation, exact CandidateReleaseManifest ID and
  payload digest, CorpusRelease ID, serving-namespace ID and header digest,
  ServingContractMetadata ID and payload digest, ProductionImportAttestation ID
  and payload digest, canonical release-state tuple
  digest and generation, normalised query plan, total and page
  counts, stable cursor, columns, shared rows, component states, cohort and
  denominator counts, selected quantifier universe and cardinality, the three
  publishable state counts, certified-zero market-observation `FAILED` and
  `NOT_EXAMINED` counters, and a separate certified incomplete-context
  `NOT_EXAMINED` count and reason partition, excluded and unknown counts with reasons, source-deal references
  and exact scope, relationship-effect and ResultInputLineage provenance. CSV
  and other exports derive from that result contract.
- A `CanonicalServingCacheValue` hashes
  `CANONICAL_SERVING_CACHE_VALUE/V1`, schema, exact
  CanonicalServingCacheIdentity ID and payload digest, canonical response-body
  digest, exact row, object and byte counts and an unsigned typed continuation
  descriptor or terminal marker. Query continuation descriptors contain only
  the complete next-page sort tuple and typed selected-row key; source-page
  descriptors contain only the next byte, next page ordinal and
  `END_OF_DOCUMENT` state. The cached value contains no request or execution ID,
  nonce, idempotency key, admission artefact, issue or expiry time, signature or
  signed cursor. Empty valid bodies are cacheable; failures and partial bodies
  are not.
- Cache hit and miss use one generated response wrapper. Only after fresh
  admission, current authorisation and exact cache-identity equality does it
  combine the request-neutral value with the current request and execution
  metadata and sign a fresh cursor from the unsigned continuation descriptor.
  A source initial response uses its current initial-request digest; a source
  continuation inherits the already validated chain issue and expiry fields.
  One operational-audit-only `ServingResponseBinding` hashes
  `SERVING_RESPONSE_BINDING/V1`, schema, serving-request-intent digest,
  exact generated execution-request digest, admission lease or token
  audit reference, CanonicalServingCacheIdentity ID and payload digest,
  CanonicalServingCacheValue digest, request ID and execution ID or `NONE`, emitted
  continuation digest or terminal marker and complete wire-response digest. It
  grants no serving, cache or release authority and is not part of a certified
  corpus release.
- The server first validates the request-neutral body schema before cache
  insertion and then validates the complete wrapped response schema before
  sending any byte. An invalid body or wrapper fails closed and enters
  operational quarantine rather than reaching a renderer. Clients use generated
  types, reject incompatible contract versions and do not guess missing fields.
  Contract tests cover every query intent, “What's market?”, evidence details,
  facets and exports.
- All failures use one versioned error envelope carrying contract version,
  stable code, HTTP status, category, request ID, retryable flag, retry-after and
  safe user message. Its serving-identity field is `UNRESOLVED` before admission
  or the complete resolved CandidateReleaseManifest selector, CorpusRelease,
  namespace/header, metadata pair, ProductionImportAttestation pair, canonical
  state-tuple digest and generation
  and READY fence ID and generation after admission. A partial or bare
  `release_id` identity is schema-invalid. Request errors
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
- `SavedQueryDefinition` stores a cursor-free semantic template and
  `release_mode=PINNED(exact CandidateReleaseManifest ID and payload digest)` or
  `FOLLOW_ACTIVE`; a bare CorpusRelease or ambiguous `release_id` selector is
  schema-invalid. Each immutable version has a stable ID and canonical
  definition digest. It never stores a
  cursor, ServingFence version or previously resolved active tuple. Every run
  first obtains a fresh `admit_and_resolve_fence` over the saved-query ID and
  expected definition digest, then performs its one bounded ownership-and-
  digest lookup. A missing, changed or unauthorised definition fails before
  corpus access. `FOLLOW_ACTIVE` resolves and
  recompiles against that admitted active manifest selector and its underlying
  CorpusRelease. `PINNED` executes only when its manifest ID and payload digest
  equal the admitted active selector; otherwise it returns typed
  `RELEASE_NOT_ACTIVE` after exactly the mandatory admission-token RPC and one
  bounded saved-definition ownership-and-digest lookup, with zero cache access,
  zero route-specific serving RPC and zero corpus-row access. Historical
  serving requires a future separately certified fenced readable-release set.
  Plan and schema migrations reject stale incompatible templates. Migration,
  cache and response bind the newly admitted tuple; save-time validation never
  authorises execution. Read execution does not synchronously update analytics
  or other mutable counters.
- Common queries read materialised aggregates. Arbitrary refined cohorts issue
  one indexed set-based data RPC against the serving-namespace-qualified,
  CorpusRelease-keyed projection.
  Facet and field-value options use a bounded indexed dimension projection,
  never provisions or claims. Saved-query, authentication and evidence-detail
  lookups are fixed overhead and are
  declared per route; none scales with result rows. No request loads the full
  corpus, scans hydrated provisions in Node or performs per-deal, per-row or
  per-cell database work.
- `query_selected_row_key` hashes `QUERY_SELECTED_ROW/V1`, CorpusRelease ID, output
  grain and canonical subject key. The generated closed map is
  `DEAL -> governed_deal_key`, `RESULT -> result_row_serving_key`,
  `SHARED_ROW -> CANONICAL_RESULT(result_row_serving_key) |
  INCOMPLETE_CANONICAL_RESULT(incomplete_result_review_row_serving_key) |
  REVIEWED_SOURCE_SPECIFIC(reviewed_source_specific_row_serving_key)`,
  `PROVISION -> provision_instance_id`, `RESULT_COMPONENT ->
  result_component_occurrence_id`, `CLAIM -> claim_occurrence_id`,
  `RELATIONSHIP_CHILD -> child_row_serving_key`, `OBSERVATION ->
  market_observation_serving_key` and `AGGREGATE -> aggregate_serving_key`. If
  one grain permits several projected rows for a subject, its generated schema
  adds the governed projection or group key to the canonical subject key.
  `RESULT` is canonical-market only; selected-deal Review, Compare, Corpus
  Context and Query context use `SHARED_ROW`. The variant tag and full domain-
  separated serving key are final cursor fields, so pagination cannot collide or
  replay across canonical, incomplete or source-specific rows. Missing or
  unknown grain fails compilation.
- `cursor_payload_digest` hashes `QUERY_CURSOR/V2`, cursor schema, cursor kind,
  route and output grain, query-semantics digest, exact active
  CandidateReleaseManifest ID and payload digest, active CorpusRelease ID,
  active serving-namespace ID and header digest, active ServingContractMetadata
  ID and payload digest, frozen contract pair, exact
  `composition_contract_set_digest`, generated result and query
  schema digests, authorisation-scope digest, access-policy and revocation
  generations, exact `serving_epoch_id` and complete canonical
  release-state tuple digest and generation, requested page size, collation,
  explicit null ordering,
  complete user sort tuple, child scope or `NONE`, last complete typed
  query-selected-row key, issued time, expiry and signing-key version. The
  signature or MAC is outside and covers the complete digest. A cursor never
  enters query-semantics digest. Every selector grain ends on the full typed key,
  never merely deal ID. A cursor cannot replay across grain, and a child cursor
  cannot replay across parent, slot, collection digest or total. Cursors expire
  after 15 minutes. Default page size is 50 and the hard maximum is 200.
  Aggregate and facet counts cover the full cohort. Refining resets the cursor;
  sorting or paging cancels stale work and never materialises a cohort-wide
  deal-ID list in the browser.
- Issuing a cursor pins its manifest selector, CorpusRelease lineage, serving
  namespace and header, metadata pair, result contract and access-policy generation
  and exact serving epoch until cursor expiry. A routine same-epoch fence renewal
  preserves cursor, export and cache validity; each page or chunk still obtains
  fresh physical fence admission. A new-epoch transition rejects stale cursor
  work before cache or database access. A running export pins the same inputs
  until its governed deadline and reacquires request-specific admission for
  every chunk. Release retention cannot expire either reference early, and an
  export or cursor lifetime cannot exceed its epoch's certified retention.
  A cursor therefore rejects a different serving epoch or changed release-state
  tuple, but does not bind the replaceable physical fence ID within the same
  serving epoch.
- The current and immediately prior cursor signing keys may overlap only for the
  cursor lifetime. Tampering, expiry, retired key or release, plan, contract,
  authorisation, collation or sort mismatch returns a typed cursor error and
  never silently restarts at page one.
- Every list and child RPC fetches `requested_page_size + 1` under the complete
  keyset order. It emits no more than the requested size; the sentinel is never
  emitted or counted. A next cursor exists exactly when the sentinel exists and
  follows the last emitted typed key. Exactly page-size rows yields no cursor;
  page-size-plus-one yields one. Requesting hard-maximum-plus-one fails before
  cache or database access. The database-row budget is page-size-plus-one and
  the HTTP-row budget is page size.
- Generated row schemas declare worst-case encoded bytes. The compiler proves
  `envelope_max + page_size * row_max <= 1 MiB`; otherwise it returns
  `PAGE_BYTE_BUDGET` before corpus access. Runtime fully serialises and validates
  into a bounded cap-plus-one buffer before headers or cache publication;
  overflow returns `RESULT_TOO_LARGE` with zero partial response or cache.
  Initial JSON is capped at 1 MiB uncompressed. Full agreement text and extended
  evidence load only through the parent row's exact
  ServingExactDetailReference and generated action slot. Full-query CSV
  and other exports execute server-side over a cursor stream or bounded
  asynchronous job; they never export only page one or require the browser to
  hydrate the full result. An export is capped at 25,000 rows, 100 MB
  uncompressed, 500-row chunks and ten minutes, with at most two concurrent
  export jobs fleet-wide and backpressure between chunks. Export start obtains
  an exact total; more than 25,000 returns `EXPORT_TOO_LARGE` before creating a
  visible artefact. A chunk may use limit-plus-one only as a continuation
  sentinel and emits at most 500 rows. Output writes to an unreachable
  generation and is published only after exact row count, no more than 100 MiB,
  schema and checksum pass. A 25,001st row, byte-cap-plus-one, total mismatch or
  late sentinel fails the job and leaves zero visible or usable partial
  artefact. Truncation is forbidden.
- The authoritative cache is shared across application instances. A process
  cache may exist only as a bounded L1 behind the same complete active-state
  tuple, frozen contract pair,
  authorisation and revocation checks. The shared fill leader publishes the
  schema-validated value before releasing its fenced lease; waiters read that
  shared value. Every cache lookup and fill begins only after that request's
  registered serving-fence admission and database-token consumption. The fill
  lease binds the exact serving epoch; a new-epoch transition or stale leader can neither publish nor
  trigger sequential instance-by-instance fills.
- The cache key hashes `SERVING_CACHE/V3`, exact
  CanonicalServingCacheIdentity ID and payload digest, and no other request
  object. A hit is usable only after fresh admission, token consumption, current route and object-
  level authorisation and byte-equality to that identity. The request nonce,
  idempotency key, QueryPageRequest, ServingExactDetailRequest and encoded cursor
  can therefore differ while canonical content and every security or release
  partition remain identical. Before deployment, one
  `CacheBudgetManifest` fixes numeric value TTL, maximum key bytes, entries and
  bytes per release and authorisation class, fleet-wide maximum entries and
  bytes, maximum simultaneously cached release generations, per-scope fill
  quotas and fill rate, eviction policy, rollback retention and pinned-release
  retention. Eviction must preserve values required by unexpired cursors,
  running exports and the certified rollback window. Keys also include
  result-contract and access-policy generations;
  revocation is checked before a cached value is served. Unset limits fail
  startup. Empty results are cacheable. Errors, partial responses and
  schema-invalid results are not. A common aggregate hit performs zero corpus-
  serving database work beyond the one fixed-cost admission-token RPC required
  for every request.
- Shared cache, single-flight, admission and circuit state live in an external atomic
  control plane that does not use the constrained Supabase pool it protects.
  Admission and fill leases have TTLs and fencing tokens. Circuit definitions
  govern closed, open and half-open transitions, one-probe recovery and retry
  suppression. One versioned `CapacityManifest` fixes numeric global and
  per-class admission caps, queue bounds and deadlines, admission and fill-lease
  TTLs,
  failure window and threshold, open cooldown, half-open probe permits and
  connection reserve. Unset values fail startup; any change requires load
  recertification. Its database-call budgets separately count the mandatory one
  admission-token RPC and at most one route-specific serving RPC. Global
  admission caps reserve and bound the database capacity used by that first RPC
  across all Vercel instances; a process semaphore is defence in depth only. If
  the control plane is unavailable, every database-using
  route and job fails closed before connection checkout. The sole exception is
  an authenticated one-shot rollback RPC through independently reserved
  database capacity that performs no corpus read. Per-process semaphores remain
  defence in depth only.
- `CapacityManifest` and every `RouteBudgetManifest` select one
  `LeaseDeadlineCompatibilityAttestation`. It fixes a trusted clock source,
  measured maximum controller-to-database skew, maximum response-flush and
  cancellation grace, and proves for every route and export chunk that
  `lease_ttl >= queue_deadline + execution_deadline + response_flush +
  2*clock_skew + cancellation_grace` and that database `statement_timeout` is
  no greater than the remaining lease time minus those margins. The database
  rejects a token with insufficient remaining time before corpus access and
  rechecks the consumed lease after execution. Lease expiry aborts the request
  and suppresses later response bytes. A fence transition cannot activate its
  successor until the external old-epoch lease set is empty or expired beyond
  the full skew and cancellation margin and a fixed-cost database drain RPC
  proves no old-epoch token record, statement or transaction remains active.
  Missing clock evidence, a violated inequality or a failed drain is BLOCKED.
- Circuit state is fleet-wide and scoped by `(database_target, reserved_pool,
  route_or_job_class)`, with a separate pool-wide parent circuit for connection-
  level failures. Only connection-acquisition timeout, SQLSTATE class `08`,
  resource exhaustion class `53`, server shutdown or unavailable `57P01`,
  `57P02` or `57P03`, and server-enforced statement timeout `57014` count.
  User or compiler 4xx responses, query-complexity rejection, authentication or
  admission denial, cursor failure, client cancellation, cache miss and control-
  plane failure do not count. A complete eligible database operation is the
  only success signal. The CapacityManifest fixes consecutive and windowed trip
  rules, cooldown, exactly one fleet-wide half-open probe per scope, success-to-
  closed reset and failure-to-open reset. An unknown signal class fails closed
  without mutating the circuit; no Vercel instance keeps an authoritative local
  counter.
- Staging performance budgets are binding release gates: cached common-query
  API p95 at or below 500 ms, uncached refined-query API p95 at or below
  1.5 seconds, p99 at or below 2.5 seconds, and a usable first browser result at
  or below 2 seconds under the certified traffic profile. Query-plan CI rejects
  sequential scans of broad claim/card payloads, N+1 calls, unbounded responses
  and regressions beyond those budgets.
- `ServingExactDetailRequest` is exactly one tagged variant:
  `INLINE_BATCH`, `SOURCE_DOCUMENT_INITIAL` or `SOURCE_DOCUMENT_CURSOR`.
  Every non-cursor variant carries one common V2 envelope containing the exact
  CandidateReleaseManifest ID and payload digest, CorpusRelease,
  serving-namespace ID and header digest, ServingContractMetadata ID and payload
  digest, canonical release-state tuple digest and generation, READY
  ServingFence ID and generation, authorisation-scope digest and response-schema
  digest and exact serving-request-intent digest. `INLINE_BATCH` additionally contains parent serving kind and key,
  source-action slot and at most 20 non-paginated
  ServingExactDetailReference IDs; its request digest hashes
  `SERVING_EXACT_DETAIL_INLINE_REQUEST/V2`, schema, the complete common envelope
  and every additional field. `SOURCE_DOCUMENT_INITIAL` additionally contains one parent, one
  SOURCE_DOCUMENT action and reference, positive requested chunk bytes at or
  below the action maximum; it has no offset and
  starts at byte zero. Its digest hashes
  `SERVING_EXACT_DETAIL_SOURCE_REQUEST/V2`, schema, `INITIAL`, the complete
  common envelope and every additional field.
  SOURCE_DOCUMENT_CURSOR contains only one encoded signed cursor and response-
  schema digest plus the exact source-cursor serving-request-intent digest and
  cannot override parent, action, reference, position or chunk
  size. Bare canonical evidence, excerpt, revision, source-occurrence, blob,
  offset or object-store IDs are schema-invalid.
- Exact-detail canonical action inputs are separate from those request digests.
  `INLINE_BATCH` hashes `EXACT_DETAIL_INLINE_CACHE_INPUT/V1`, schema, parent
  serving kind and key, exact action-definition ID and payload digest, action
  slot and version and the complete reference set in the action's governed
  response order. `SOURCE_DOCUMENT_INITIAL` and `SOURCE_DOCUMENT_CURSOR` both
  hash `EXACT_DETAIL_SOURCE_PAGE_CACHE_INPUT/V1`, schema, parent kind and key,
  exact action-definition ID and payload digest, action slot and version,
  ServingExactDetailReference ID, start byte, chunk bytes and page ordinal.
  Initial uses start byte and page ordinal zero; cursor uses the completely
  verified decoded position. The contextual reference already commits to the
  selection path, detail payload and source lineage. Request-intent, request-
  digest, initial-request digest and cursor transport, timing and signing fields
  remain outside both canonical action-input digests.
- A source cursor payload hashes `SERVING_EXACT_DETAIL_SOURCE_CURSOR/V1`, schema,
  CandidateReleaseManifest ID and payload digest, CorpusRelease,
  serving-namespace ID and header digest, ServingContractMetadata ID and payload
  digest, exact corpus-blob-namespace ID bound by that header, parent kind and
  key, exact action-definition ID and payload digest,
  action slot and version, exact reference ID, selection-path digest, detail-
  payload ID and digest, source-occurrence and SourceContent IDs and payload
  digest, admitted byte length and content digest, immutable carrier-generation
  digest, authorisation-scope, access-policy and revocation generations,
  canonical release-state tuple digest and generation, exact `serving_epoch_id`,
  initial-request digest, chunk bytes, next-start byte, next-page
  ordinal, response-schema digest, inherited issue and expiry times and signing-
  key version. Its signature covers that digest. It contains no URL, credential,
  mutable locator or caller-selected offset. A continuation-request digest
  hashes `SERVING_EXACT_DETAIL_SOURCE_REQUEST/V2`, schema, `CURSOR`, cursor-
  payload digest, serving-request-intent digest and response-schema digest.
- A `ServingExactDetailSourcePage` returns the manifest ID and payload digest,
  CorpusRelease ID, serving-namespace ID and header digest, metadata ID and
  payload digest, exact corpus-blob-namespace ID, canonical release-state tuple
  digest and generation, exact `serving_epoch_id`, parent, action slot, reference,
  detail payload and SourceContent IDs, page
  ordinal, start byte, end byte exclusive, total byte length, BASE64URL chunk,
  raw-chunk digest and exactly `next_cursor` or `END_OF_DOCUMENT`.
  `end = min(start + chunk_bytes, total)`; a next cursor exists exactly when end
  is less than total and its next start equals end. Issue and expiry remain fixed
  across the chain, so exact cursor replay returns byte-identical page and
  continuation. Each page obtains fresh fence admission, consumes its token,
  rechecks object-level authorisation and performs exactly one fixed admission
  RPC plus at most one bounded detail RPC and one immutable-
  carrier conditional range read. The route buffers and validates generation,
  range and digest before returning headers or caching bytes.
- After `admit_and_resolve_fence` and its fixed token-consumption RPC, the
  generated security-definer detail RPC requires
  the manifest selector, serving namespace and header, metadata, CorpusRelease
  lineage and READY fence to equal the active tuple; requested parent and action
  slot to match; the active parent payload to contain every reference at its
  exact ordinal; reference, path, payload and source lineage to agree; and the
  caller's object-level predicate to pass. Every database serving-object read is
  qualified by serving namespace. A source action additionally verifies the
  immutable header payload, obtains its exact corpus-blob-namespace ID and
  returns only a carrier key qualified by that namespace; the conditional range
  read and response must retain it. INLINE_BATCH returns at most 20 references and 512 KB; a
  source page respects both its raw-chunk and 512 KB envelope caps. Maximum-plus-
  one, cursor tamper or expiry, skipped, overlapping, negative or out-of-range
  position, EOF mismatch, carrier mismatch, stale manifest, namespace, metadata,
  release, policy, revocation or serving epoch, forged ID, cross-parent or cross-action
  failure returns a typed error with zero detail bytes and no partial cache
  entry. A reference or cursor is not a bearer token. Before an exact-detail
  continuation, routine physical-fence renewal within the cursor's exact serving
  epoch is valid, but the page must obtain fresh admission under the current
  physical fence. The physical fence and token remain in
  `ServingResponseBinding` audit data, outside the request-neutral page. A changed
  serving epoch fails before cache or database access. Before an exact-detail
  cache lookup, the route re-evaluates the generated object predicate for the
  exact parent, action and reference set and then derives the shared
  CanonicalServingCacheIdentity from the canonical action input and complete
  security and release partition. A hit never substitutes for object-level
  authorisation.
- Route call budgets are exact. Every serving request first uses the one fixed
  admission-token RPC above; the following route-specific calls are additional:
  one serving RPC for an ad hoc initial page,
  refinement, sort, result-child page or list page; one saved-plan lookup plus
  one serving RPC for a saved query; one bounded exact-detail RPC for a reference
  set or source page, with at most one additional immutable-carrier range read
  for a source page; and one indexed bounded query for facet or field-value
  options. Exact detail is capped at 20 references and 512 KB; option output is capped at 200
  values and 256 KB. In-app navigation with a carried response uses no
  admission or database call; direct and reload navigation use the ordinary
  initial-page budget once.
  After token consumption, query compilation performs no corpus read and may make at
  most one bounded catalogue lookup. Authentication is separately declared
  fixed overhead.
- Every generated RPC also has an exact `RpcStatementBudget`. Each ordinary
  admission, serving, option, exact-detail or catalogue RPC executes one top-
  level parameterised SQL statement whose set-based plan may contain only its
  frozen finite CTE and function-call graph. Dynamic SQL, procedural row loops,
  recursive per-result calls and server-side cursors are forbidden. A saved-plan
  route's indexed ownership lookup is one separately budgeted statement. Export
  may repeat only its one-statement page plan once per governed chunk. The
  compiler records the exact statement-plan fingerprint and maximum nested
  statement count, which is one unless a route contract expressly names a fixed
  larger value. No value may depend on corpus, cohort, page or component count.
- Every active query and support route or job appears in the governed route
  `RouteBudgetManifest` with maximum database calls, top-level and nested SQL
  statements, rows and bytes returned, response or job deadline, admission class
  and cache policy. Export is the only path
  permitted multiple cursor calls, and its per-chunk budget and fleet-wide job
  cap above remain subject to shared admission control. Instrumented tests fail
  when any route exceeds its manifest. Staging enables
  `pg_stat_statements.track=all` or an equivalent database-owned statement
  counter and correlates query IDs to the request trace. Application call counts
  cannot substitute for measured server-side statement deltas.

## Semantic extraction adapter and graph contract

- Semantic extraction is separable from corpus admission and publication.
  `SemanticExtractionInputEnvelope` contains one exact ImmutableSourceDocument
  occurrence, source-map and verification payload, terminal
  SourceAdmissionManifest, the frozen
  CanonicalContractBundle and ContractFreezeAttestation, primitive schemas and
  bounded extraction configuration. It contains no CorpusRelease,
  CandidateReleaseManifest, active-release pointer, serving namespace,
  publication credential or market-cohort answer. A model may produce only an
  immutable SemanticInferenceTranscript proposal against that envelope. One
  reviewed payload then freezes the exact source-backed input to the pure
  normaliser. Neither the model nor reviewer may call the canonical writer,
  select corpus membership or publish a release.
  A separately authorised adapter may submit only their completed immutable
  objects to the closed review actions; it cannot alter their bytes.
  Corpus persistence of an envelope or any descendant nevertheless requires the
  exact current SourceAdmissionPreparationReceipt as an action prerequisite.
  That receipt is selected separately by scope and release lineage, not hashed
  into the source-local envelope, so an unrelated cutoff or membership context
  cannot rekey the same source graph.
- The frozen SemanticGraphNormaliserDefinition deterministically consumes the
  exact envelope and ReviewedInferencePayload bytes and emits one content-
  addressed `ValidatedSemanticGraph` containing every
  source-local provision observation, exact evidence, definition,
  OpenWorldSemanticCandidate and primitive, typed relationship, source-backed
  impact seed and any provisional governed-slot, party-role or normalisation
  proposal that the frozen contract permits. Each proposal remains explicitly
  provisional and retains observed party tokens, raw value and source-local
  state evidence. A one-document graph cannot assert deal- or corpus-level
  `ABSENT` or `NOT_APPLICABLE`, resolve Buyer or Seller without admission and
  party-role evidence, close a cross-document dependency, create a final
  ClaimRevision or claim that a governed result component is complete. The
  canonical writer path creates final component occurrences, ClaimRevision
  states, governed parties and result lineage only after source admission, full
  deal scope and dependency reconciliation. The graph does not
  emit a final impact tier, `SemanticImpactClosure`, result-completeness or
  market-comparability decision. Those are derived only after two governed,
  implementation-disjoint dependency walkers and a third reconciler traverse
  the exact proposed admission, PotentialDependencyUniverse, open-world graph
  and frozen contract. Corpus-wide affected-instance coverage is derived later
  by the independent ApplicabilityReexaminationManifest enumerators. Its validation report distinguishes semantic and
  schema validity from corpus-admission and publication eligibility. The graph
  ID hashes its extraction-input envelope, ReviewedInferencePayload and
  SemanticGraphNormaliserDefinition IDs and payload digests, complete ordered
  node and edge sets, validation rules and exact differences; it excludes corpus
  release and active state. Corpus and non-publishing normalisation over those
  same exact three inputs must produce byte-identical graph nodes, edges,
  component semantics and validation report. Separate model calls need not
  produce byte-identical transcripts. Their semantic differences remain visible
  and require explicit adjudication before a ReviewedInferencePayload is final.
- The corpus adapter may submit that graph only through the authoritative
  canonical writer, which independently revalidates source admission, exact
  frozen pair, scope, corrections, inventory and publication gates. A dry run or
  future private analysis uses separate storage and credentials and cannot reach
  canonical tables, candidate-release membership, production import or active-
  release controls. It can later compare its validated rows with a separately
  certified market release through the governed serving contract; it cannot
  become or amend that release.
  Scope materialisation, candidate release, bundle construction and production
  import consume the stored transcript digests, exact ReviewedInferencePayload
  bytes, graph-normaliser definition and graph lineage. None may invoke the
  model, replace the reviewed payload or accept a freshly inferred equivalent.
- CorpusScopeInventoryKindRegistry and CorpusReleaseInventoryKindRegistry each
  contain concrete, non-wildcard kinds for SourceAdmissionPreparationReceipt,
  SemanticInferenceTranscript and ReviewedInferencePayload; the frozen
  SemanticGraphNormaliserDefinition is carried as an exact contract member.
  CorpusScopeManifest, every relevant scope slice, CandidateReleaseManifest and
  CandidateInputSeal select their stable IDs and canonical payload digests.
  ReleaseBundleEnvelope carries their immutable payloads under the candidate
  object projection, production import reproduces the same typed members and
  graph lineage in the inactive namespace, and the traceability matrix links
  each receipt, transcript, reviewed payload and normaliser definition through
  graph, scope, release, bundle and import. Omission, substitution, digest drift
  or a transcript or payload available only outside that closed chain blocks
  release or import.
## Phase 8 traceability contracts

`TraceabilityPhaseObjectRegistry/V2` is the sole passing-phase coverage
authority. The
topology compiler generates it from the exact frozen dependency graph, physical-
carrier registry and writer-disposition registry, and two independent registry
enumerators must reproduce it byte-for-byte. Its ID hashes
`TRACEABILITY_PHASE_OBJECT_REGISTRY/V2`, schema, frozen pair, exact frozen
AttemptAuditObjectRegistry ID and payload digest, topology-compiler executable
and configuration digests and the complete contract-ordered records
`(phase, logical_type, schema_version, stable_key_extractor_id_and_digest,
cardinality_rule, authoritative_producer, physical_carrier,
required_presence_predicate, required_absence_predicate)`, plus per-phase and
per-type counts and fixed empty missing, extra, duplicate, conflicting,
unphased and multiply-phased roots. `phase` is exactly `PRE_SEAL`,
`POST_FREEZE`, `POST_IMPORT`, `POST_ACTIVATION` or `POST_COMPLETION`.
Cardinality is an exact constant, an exact closed keyed-universe function or a
closed tagged conditional whose selector is itself a registered predecessor;
there is no wildcard, illustrative family, caller-selected type, open-ended
optional record or prose-only exception. Every required-object root and every
phase reconciliation below is generated from this registry rather than from a
hand-maintained list. The AttemptAuditObjectRegistry schema and every frozen
attempt-audit logical-type definition are PRE_SEAL contract objects. Runtime
objects classified as `OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)`, including every
AttemptAudit tree node, required-object root, coverage-projection root,
reconciliation and AttemptAuditTerminal instance, are excluded from all five
passing phases. Generation requires fixed empty overlap and unclassified roots
between the five passing-phase carrier sets and the complete runtime attempt-
audit carrier set. The complete logical matrix is a human-readable projection
that consumes both registries, shows the separation explicitly and cannot add
or waive coverage. An attempt-audit object can satisfy no release, import,
traceability, activation, failure-terminal, completion or serving gate.

The matrix is one logical append-only chain, not one forward-referencing
candidate output. `PreSealTraceabilityRoot` is its bounded base. Each later
passing `TraceabilityExtension(kind=PASS_PHASE)` ID hashes
`TRACEABILITY_EXTENSION/V1`, schema, frozen
pair, candidate generation, exact phase, predecessor traceability ID and payload
digest, predecessor cumulative root and count, phase-required-object root,
phase-trace-coverage-projection root, fixed BoundedInventoryTree root over the
new canonical trace-row payloads, delta row count, exact empty predecessor/delta
intersection root, TraceabilityPhaseReconciliation, successor cumulative root
and count, phase-contract digest, producer evidence, self-exclusion-rule digest
and terminal `PASS`. The required-object root is independently generated from
the closed phase registry; the coverage root is independently projected from
the trace rows. `TraceabilityPhaseReconciliation` requires exact object-to-row
coverage and hashes fixed empty missing, extra, duplicate, conflicting,
untraced, wrong-phase and prohibited-self roots. The cumulative root is the
canonical disjoint union of predecessor and delta rows. It cannot be a copied
predecessor root or count, and an extension cannot reorder, replace or duplicate
an earlier row. The mandatory order is `PRE_SEAL -> POST_FREEZE -> POST_IMPORT ->
POST_ACTIVATION -> POST_COMPLETION`.

`TraceabilityExtension` is a closed union with one other variant,
`FAILURE_TERMINAL`. Its governed wrapper is
`TraceabilityFailureTerminal`, whose ID hashes
`TRACEABILITY_FAILURE_TERMINAL/V1`, schema, frozen pair, candidate generation,
exact TraceabilityFailureTerminalSlot, FailureRecoveryBranch and absorbing
`OUTCOME_FIXED` FailureRecoveryBranchHead IDs and payload digests, exact
PostActivationControlActionRegistry ID and payload digest,
PostActivationFailureEvidence ID, variant and payload digest, exact originating
ContainmentReleaseTupleDisposition ID and payload digest, exact originating
`BEGIN_FAILURE_CONTAINMENT` receipt and `FAILURE_CONTAINMENT_PENDING` head and
exact `COMPLETE_FAILURE_CONTAINMENT` receipt and `FAILURE_FIXED` head, exact
FailureTraceabilityObjectRegistry ID and payload digest, the evidence-derived
closed terminal reason and disposition, exact latest passing predecessor extension ID and
payload digest, predecessor cumulative root and count, independently generated
failure-required-object root, independently projected failure-coverage root,
fixed BoundedInventoryTree root over the new failure and containment trace rows,
delta count, exact empty predecessor/delta intersection root,
TraceabilityPhaseReconciliation, successor cumulative root and count,
failure-contract digest, producer evidence, self-exclusion-rule digest,
`terminal_integrity=PASS` and `terminal_disposition=FAILED` or `ABANDONED`.
`PostActivationFailureEvidence` is the required closed trigger union selected by
failure traceability; a failed PostCutoverSmokeAttestation is required only for
`SMOKE_FAIL`. `READY_PUBLICATION_FAIL`, `READY_PUBLICATION_TIMEOUT`,
`POST_ACTIVATION_TRACE_FAIL`, `POST_ACTIVATION_TRACE_TIMEOUT`, `SMOKE_TIMEOUT`
and `SMOKE_CRASH` instead bind their exact failing event, head, receipt and
deadline or crash proof and a typed `NO_FAILED_SMOKE_FOR_THIS_TRIGGER` absence
proof where smoke never completed. `PASS_COMMIT_LEASE_EXPIRED` requires the
exact passing smoke, issuance event and receipt, post-issuance head, expired
unconsumed lease slot and pass-effect absence proofs; it cannot carry
`NO_FAILED_SMOKE_FOR_THIS_TRIGGER`. `ACTIVE_RELEASE_REVOCATION` requires the
exact action-registry entry, cause evidence, ordinary BLOCKED fence and drain,
RollbackEvent, ActiveReleaseRevocationReceipt and higher exposure-off tuple,
plus only the smoke or absence evidence applicable to its observed head. No
branch may manufacture a failed or passing smoke merely to satisfy
traceability. Failure evidence alone never closes the controller: for
`CONTAINMENT_OWNS_FENCE`, every terminal proves tuple disposition, BEGIN receipt
and pending head before the containment-owned BLOCKED fence and drain; for
`ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, it proves the complete registered
ordinary fence, drain, event and receipt before failure evidence, disposition
and the atomically coupled BEGIN receipt and pending head. Both require the exact
COMPLETE receipt to select their effects before FAILURE_FIXED.

The generated FailureTraceabilityObjectRegistry accepts that exact trigger
evidence and has exactly six terminal evidence-topology variants. It fixes for
each the exact required and forbidden type, stable-key extractor and cardinality
records, including positive presence and independently enumerated absence
proofs. Within every applicable topology,
`PASS_COMMIT_LEASE_EXPIRED` adds the exact passing-smoke and lease-issuance
chain and pass-effect absence root; `ACTIVE_RELEASE_REVOCATION` and
`LEGACY_ACTIVE_RELEASE_REVOCATION` add their exact registry entry, cause,
ordinary fence and drain, RollbackEvent, ActiveReleaseRevocationReceipt and
exposure-off tuple in the disposition-declared order. These are conditional
required objects inside the existing six topologies, not new topology variants:

- `NON_GENESIS_NO_HISTORICAL_REACTIVATION` requires a non-genesis marker, the
  originating failure trigger, the common BEGIN-pending-COMPLETE containment
  chain, exposure-off tuple, FailureRecoveryBranch and fixed no-recovery
  decision. It forbids every legacy-
  restoration object and every historical-reactivation start, activation,
  smoke and AVAILABLE successor. Its derived reason is
  `POST_ACTIVATION_FAILURE_NO_RECOVERY` and disposition is `FAILED`.
- `LEGACY_RESTORED` requires the genesis marker, exact rollback target and
  passing rehearsal, the common BEGIN-pending-COMPLETE containment chain, one
  passing LegacyBaselineRestorationAttestation and restoration `COMMIT_PASS`
  receipt, the complete contiguous restoration-receipt chain including any
  earlier `RECORD_FAIL` attempts, and exactly one
  LegacyBaselineRestorationPostCommitContext. That context must have its
  ordered `OPEN_WITH_RESTORATION_PASS`, `ADOPT_READY_LEGACY` and
  `ADOPT_LEGACY_SMOKE_AND_FIX` events, heads and receipts, the exact READY fence
  and legacy smoke, terminal `LEGACY_READY_FIXED` head and exact genesis-head
  return. It forbids either restoration-abandonment decision variant and every
  historical-reactivation object. Its reason is
  `FIRST_CANONICAL_FAILURE_LEGACY_RESTORED` and disposition is `FAILED`.
- `LEGACY_RESTORATION_ABANDONED` requires the genesis marker, target, rehearsal,
  the common BEGIN-pending-COMPLETE containment chain, proven BLOCKED exposure
  and exactly one `LegacyBaselineRestorationAbandonmentDecision/V2`. Its
  `PRE_COMMIT_FAILURE` subvariant requires the complete contiguous failed
  restoration-receipt chain, at least one `RECORD_FAIL`, no `COMMIT_PASS` and no
  post-commit context. Its `POST_COMMIT_PASS_FAILURE` subvariant instead
  requires the exact `COMMIT_PASS` receipt, post-commit context and typed
  failure evidence, its exact ContainmentReleaseTupleDisposition,
  `BEGIN_POST_COMMIT_ABANDONMENT` receipt and
  `ABANDONMENT_PENDING` head, acknowledged reblock and drain, then
  `COMPLETE_POST_COMMIT_ABANDONMENT` receipt and terminal
  `LEGACY_ABANDONED_FIXED` head. Both prove no later live attempt and forbid
  `LEGACY_READY_FIXED`, historical reactivation and service exposure. Its reason is
  `FIRST_CANONICAL_FAILURE_LEGACY_RESTORATION_ABANDONED` and disposition is
  `ABANDONED`.
- `HISTORICAL_ABANDONED_PRE_ACTIVATION` requires the historical-reactivation
  start and exact pre-activation eligibility, dependency, compatibility and held-
  fence evidence followed by typed abandonment. It requires independently
  proven absence of a historical ActivationEvent, READY_CANONICAL fence, fresh
  smoke and AVAILABLE successor. Its reason is
  `HISTORICAL_REACTIVATION_ABANDONED_PRE_ACTIVATION` and disposition is
  `ABANDONED`.
- `HISTORICAL_FAILED_AFTER_ACTIVATION` requires the complete historical
  activation path through ActivationEvent, its distinct
  PostActivationControlActionRegistry-bound context and READY_CANONICAL, the
  exact later failure trigger, historical `BEGIN_FAILURE_CONTAINMENT` receipt
  and pending head, its distinct ContainmentReleaseTupleDisposition,
  acknowledged higher BLOCKED fence and lease drain,
  historical `COMPLETE_FAILURE_CONTAINMENT` receipt and FAILURE_FIXED head,
  second containment RollbackEvent and resulting exposure-off tuple. It forbids an AVAILABLE
  successor or success outcome. Its reason is
  `HISTORICAL_REACTIVATION_FAILED_AFTER_ACTIVATION` and disposition is `FAILED`.
- `HISTORICAL_SUCCEEDED` requires the complete historical activation path,
  passing fresh smoke, exact `ISSUE_PASS_COMMIT_LEASE` receipt, consumed
  PostActivationPassCommitLease, exact historical `COMMIT_PASS` receipt and
  `PASS_FIXED` PostActivationControlHead, AVAILABLE successor and fixed
  successful recovery outcome, and forbids abandonment or post-activation
  containment for that recovery attempt. Its reason is
  `POST_ACTIVATION_FAILURE_HISTORICAL_REACTIVATION_SUCCEEDED` and disposition is
  `FAILED` for the failed candidate whose branch is being closed.

All variants require the exact originating PostActivationControlContext and
PostActivationControlActionRegistry, complete append-only control event, head
and receipt chain, exact originating ContainmentReleaseTupleDisposition,
`BEGIN_FAILURE_CONTAINMENT` receipt and
`FAILURE_CONTAINMENT_PENDING` head, acknowledged common containment objects,
exact `COMPLETE_FAILURE_CONTAINMENT` receipt and `FAILURE_FIXED` head,
FailureRecoveryBranch and absorbing fixed branch head. No caller selects reason
or disposition. The registry derives both from
the variant after all presence and absence proofs pass. The terminal is built
only after that branch's outcome is fixed. Its latest passing trace predecessor
is exactly POST_IMPORT when no POST_ACTIVATION extension ever closed, proven by
the registered trace-head absence projection, and exactly POST_ACTIVATION when
that extension did close. It can never skip an existing POST_ACTIVATION PASS or
require one that the fault prevented.
FailureTraceabilityObjectRegistry expressly forbids AttemptAudit,
AttemptAuditTerminal and every other
`OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)` logical type in all six variants. Attempt-
audit evidence may explain an operational attempt to an administrator but can
never satisfy a failure required-object slot, absence proof, containment step,
branch outcome or terminal receipt.
Required-object and coverage
roots must reconcile bidirectionally with empty missing, extra, duplicate,
conflicting, wrong-branch and untraced roots. A failure terminal has no
traceability successor, cannot be used as a PASS_PHASE predecessor, cannot
satisfy `P9_PREIMPORT_TRACEABILITY` or `P9_TRACEABILITY`, and is expressly
ineligible for the programme-completion terminal pair. Its self-exclusion is
the only untraced object on that failed branch. The status-and-deployment trace
validator is its sole producer and may write it only through the closed
`BUILD_FAILURE_TRACE_TERMINAL` action. The trace-control disposition registry
maps exactly `TREE_BATCH/FailureTraceabilityTreeNode` and
`TERMINAL_FAILURE/TraceabilityFailureTerminal` to
`NAMED_CONTROL(FAILURE_TRACE_TERMINAL)` with contract-fixed row, byte and batch
limits. `TREE_BATCH` uses
`CONTENT_ADDRESSED_BATCH_TUPLE_IS_RECEIPT`; `TERMINAL_FAILURE` uses
`TERMINAL_WRAPPER_IS_RECEIPT`, is available only after every selected bounded
node exists and may write exactly one wrapper under unique key
`(TraceabilityFailureTerminalSlot ID)`. Terminal reason and outcome are payload
checks derived from the fixed head and selected evidence variant and cannot
create another key. The slot identity is reason- and disposition-independent,
so all races converge on one terminal key. Both phases are
content-addressed and have no corpus, semantic, serving, mutable-head,
lifecycle-receipt or outbox authority. Every other producer, action, phase,
carrier, DML verb and direct write is prohibited.

`P9_PREIMPORT_TRACEABILITY` certifies only the complete PRE_SEAL and
POST_FREEZE prefix, schemas and generated coverage contracts required to open
production import. It cannot stand in for later phases. `P9_TRACEABILITY`
certifies exact bidirectional coverage through the POST_ACTIVATION cumulative
root and the frozen complete required-object and coverage contracts for the
later POST_COMPLETION phase. It does not claim that smoke, completion or the
proposed terminal status has already been traced. The registry's terminal-pair
predicate separately requires the proposed status, completion lease and passing
POST_COMPLETION extension that actually adds those rows, avoiding both a
forward reference and a premature full-trace pass.

- `PRE_SEAL` covers TraceabilityPhaseObjectRegistry/V2 and its independent
  generation evidence; the frozen AttemptAuditObjectRegistry schema and all of
  its logical-type definitions but no runtime AttemptAudit or
  AttemptAuditTerminal instance; CanonicalBundleInputIdentity, the generated
  ActiveReleaseRevocationActionRegistry, the generated
  ApplicabilityEligibleMemberKindProducerRegistry/V3, every
  ApplicabilityReexaminationRequirementDefinition and
  ApplicabilityReexaminationRequirementSetRoot; every post-contract-freeze
  ApplicabilityReexaminationRequirement, registry-owned Entry and complete
  Slice and every ScopeSubjectApplicabilityRoot; both terminal sealed
  CorpusRelease input root sets and reconciliation;
  both candidate-wide applicability roots and every reachable node;
  ApplicabilityReexaminationEnumeratorIndependenceAttestation; the named
  ApplicabilityReexaminationReconciliation and Manifest; every
  MetricApplicabilityRequirementProjection entry and the terminal projection
  set; the materialisation-time intake recheck; CandidateInputSeal;
  CorpusRelease; the exact QueryGoldenCertificationAttestation; and
  all remaining candidate inputs and outputs created before CandidateOutputSeal
  except ReviewedSourceSpecificOutputClosure, whose first trace phase is the
  explicitly registered POST_FREEZE phase below.
  Its generated topology requires the same universal order: sealed release-
  input roots, two applicability roots, independence, reconciliation, manifest,
  projection entries and set, materialisation-time intake recheck,
  CandidateInputSeal and CorpusRelease.
- `POST_FREEZE` covers CandidateOutputSeal, terminal preparation controls,
  PREPARED transition and receipt, candidate-manifest controls,
  CandidateReleaseManifest, CandidateReleaseFreezeAttestation, FROZEN transition
  and receipt, CandidateInputRecheckAttestation, held promotion fence and
  DeploymentManifest. It also covers the exact direct
  ReviewedSourceSpecificOutputClosure selected by CandidateOutputSeal and
  CandidateReleaseManifest, including its source-specific row-bijection and
  zero-metric-authority proofs. PreCutoverCertification binds this extension.
- `POST_IMPORT` covers PreCutoverCertification, candidate object and blob
  projection roots and every reachable node, PromotionEvidenceSlotRegistry and
  ten-slot PromotionEvidenceSlotRoot, including the exact
  QueryGoldenCertificationAttestation evidence slot; the complete successful
  ReleaseBundleControlContext, event, head and receipt chain and its complete
  set of exactly four successful ReleaseBundleSpoolErasureReceipts and terminal
  `ReleaseBundleSpoolErasureReceiptSetAttestation`
  (`SUCCESS_PRE_FINALISATION`); the exact EMPTY
  ReleaseBundleControlFailureEvidenceSlot tuple and empty failure-evidence,
  partial-state-tree, abandonment-terminal and attempt-audit presence roots;
  the pre-output bundle-enumerator independence
  attestation, all four bundle ROLE_LAUNCH WalkerTrustStatusProofs, the bundle
  CONTEXT_SEAL WalkerTrustStatusProof, all four one-use bundle-walker run claims and output attestations,
  all four signed WalkerOutputSpoolCommitments and exact
  ReleaseBundleWalkerSpoolCommitmentRoot,
  the bundle-walker output-set attestation, governed bundle member and support
  root sets, their trees and reconciliations,
  ReleaseBundleEnvelope, the complete import lifecycle and batch-class
  manifests, production-import receipt-prefix context, the pre-output import-
  enumerator independence attestation, all six import ROLE_LAUNCH
  WalkerTrustStatusProofs, the import CONTEXT_SEAL WalkerTrustStatusProof, all six one-use import-walker run claims
  and output attestations, all six signed WalkerOutputSpoolCommitments and exact
  ProductionImportWalkerSpoolCommitmentRoot, the import-walker output-set attestation,
  the governed set of exactly six successful
  ProductionWalkerSpoolErasureReceipts and terminal
  `ProductionWalkerSpoolErasureReceiptSetAttestation(IMPORT_SUCCESS)`, governed
  control-receipt, member and support roots and
  reconciliations, ProductionBlobAvailabilityRoot and every reachable node,
  importer CompositionContractSetRecompositionRoot and every reachable node,
  ProductionImportSeal, the exact EMPTY ProductionImportFailureEvidenceSlot
  tuple and empty failure-evidence, partial-state-tree, abandonment-terminal and
  attempt-audit presence roots,
  ProductionSemanticParityRoleRegistry,
  ProductionSemanticParityEnumeratorIndependenceAttestation, its unique
  terminal slot, all three one-use role slots, ROLE_LAUNCH proofs, claims,
  all three signed WalkerOutputSpoolCommitments and exact
  ProductionSemanticParitySpoolCommitmentRoot, neutral trees, role-bound output
  and output-set attestations, the governed set of exactly three successful
  ProductionWalkerSpoolErasureReceipts and terminal
  `ProductionWalkerSpoolErasureReceiptSetAttestation(SEMANTIC_SUCCESS)`, and the semantic-
  parity CONTEXT_SEAL proof,
  ProductionMarketObservationParityRootPair,
  ProductionMaterialisedCohortParityRootPair,
  ProductionMarketAggregateParityRootPair,
  ProductionServingContractMetadataParityRootPair, every reachable semantic-parity and
  difference node and ProductionSemanticParityAttestation,
  ProductionImportAttestation and terminal ATTESTED head, event and receipt.
  CutoverAuthorisation binds it.
- `POST_ACTIVATION` covers the `CURRENT_CANDIDATE` PromotionEligibilityProof,
  readiness, authorisation, ServingFenceVersion and release-state transitions
  and ActivationEvent; the exact PostActivationControlPolicy,
  PostActivationControlActionRegistry and generated trigger registry;
  PostActivationControlContext; every append-only PostActivationControlEvent,
  PostActivationControlReceipt and head version through
  `AWAITING_POST_ACTIVATION_TRACE`. These are exactly the
  OPEN_WITH_ACTIVATION and ADOPT_READY progress receipts. The resulting passing
  extension is typed evidence consumed by ADOPT_POST_ACTIVATION_TRACE and
  therefore cannot cover that later action, event, AWAITING_SMOKE head or
  receipt. Those later adoption objects, ISSUE_PASS_COMMIT_LEASE, COMMIT_PASS
  and their effects belong to POST_COMPLETION on success;
  BEGIN_FAILURE_CONTAINMENT, its pending head, external containment and
  COMPLETE_FAILURE_CONTAINMENT belong only to the failure terminal. For the
  first canonical cutover it also covers the
  LegacyBaselineRollbackTarget, rehearsal, BLOCKED genesis fence,
  `REGISTER_LEGACY_BASELINE` and `BEGIN_FIRST_CANONICAL_CUTOVER` genesis events
  and all selected genesis-head versions through
  `FIRST_CANONICAL_IN_PROGRESS`; later cutovers carry the terminal
  `CANONICAL_ESTABLISHED` head and explicit non-genesis marker. The current-
  candidate PostCutoverSmokeAttestation is a later object that binds this exact
  extension as its predecessor; it is traced in POST_COMPLETION on success or in
  the failure terminal. Any registered trigger fault prevents the PASS commit,
  creates exactly one PostActivationFailureEvidence union member and reaches a
  BEGIN receipt and FAILURE_CONTAINMENT_PENDING head under its declared fence
  order: containment-owned external controls follow BEGIN, while registered
  ordinary-revocation controls precede the atomically coupled revocation
  evidence, disposition and BEGIN. Both require the COMPLETE receipt and
  FAILURE_FIXED head in the failure terminal.
  Historical reactivation does not reopen or append to the prior release's
  already terminal success matrix. Its ceremony is an append-only operational-
  audit branch selected by `HISTORICAL_REACTIVATION`; the failed candidate's
  later TraceabilityFailureTerminal closes over that complete branch.
- `POST_COMPLETION` covers the exact ADOPT_POST_ACTIVATION_TRACE event,
  AWAITING_SMOKE head and receipt that consume the predecessor POST_ACTIVATION
  extension; smoke; the exact `ISSUE_PASS_COMMIT_LEASE` event,
  same-state head advance and PostActivationControlReceipt, the exact
  PostActivationPassCommitLease, then the terminal `COMMIT_PASS` event,
  PostActivationControlReceipt and `PASS_FIXED` head and all of that action's
  atomic success effects, including ReleaseActivationCertification, the
  AVAILABLE promotion-fence successor and genesis or exact-predecessor ongoing
  promotion-head effect,
  the first-cutover `ESTABLISH_FIRST_CANONICAL_RELEASE` event and terminal
  CanonicalCutoverGenesisHead where applicable,
  exact P9_TRACEABILITY prefix evidence, ProgrammeCompletionAttestation, the
  immutable proposed terminal programme-status artefact, CompletionTraceCutoff,
  fixed POST_COMPLETION context and the
  completion-readiness lease bound to that pre-extension context. Executable programme status remains blocked from `COMPLETE`
  until this extension and that proposed status are atomically published as the
  terminal pair described in Phase 9.
  Every extension excludes its own nodes and root; its successor traces it. The
  terminal extension is the only untraced structural control. The closed
  traceability-control registry and structural validation govern that explicit
  exemption, preventing infinite self-enumeration. No substantive, serving,
  certification or completion object receives the exemption.

The complete logical matrix contains the base and every extension row and
includes:

- CanonicalContractBundle, every SemanticStageRegistry entry and stage-contract
  digest, all three InventoryEnumeratorIndependenceAttestation stage objects,
  TraceabilityPhaseObjectRegistry/V2 and both generation proofs,
  AttemptAuditObjectRegistry and every frozen attempt-audit schema definition,
  GlobalMutableAuthorityRegistry, GeneratedLockPlanRegistry,
  ClaimScopeDefinition, WalkerHarnessExecutionPolicy and both exact profiles,
  the frozen ProductionSemanticParityRoleRegistry,
  every ROLE_LAUNCH and CONTEXT_SEAL WalkerTrustStatusProof,
  ArchiveSafetyPolicyManifest and all operational and
  certification policy manifests;
- every IntakeProcessingPolicyActivation, signed IntakeProcessingPolicyHead and
  allowed activation-chain payload, SubmissionReceipt, IntakeLedgerEvent,
  ArchiveAttemptNode, IntakeProcessingAttempt, the sole root
  SubmissionExpansionManifest, SourceContent, source occurrence,
  receipt-local IntakeUniverseManifest, ReceiptReplacementLink,
  IntakeResolution, complete receipt-local chain and selected-resolution map,
  both cutoff-state manifests, CutoffEnumeratorIndependenceAttestation,
  CutoffStateReconciliation, HistoricalIntakeGovernanceInventory and every
  referenced historical policy, status, review and approval payload,
  IntakeEligibilityDependencyManifest with separate selected roots and exact
  replacement and duplicate dependency edges, CutoffPreparationKindRegistry,
  CutoffPreparationWriteDispositionRegistry, every CutoffBuildTransition and
  receipt, CutoffPreparationBatchManifest, CutoffPreparationEvent,
  CutoffPreparationMembership, CutoffPreparationHead tuple and receipt, both CutoffPreparedRootSets and
  CutoffPreparedReconciliation, every reachable BoundedInventoryTree node,
  both complete control-receipt trees and
  CutoffPreparationControlReceiptReconciliation,
  CutoffPreparationSeal, IntakeCutoffAttestation, every
  IntakeEligibilityRecheckAttestation and ReleaseIntakeDependencyProjection;
- ImmutableSourceDocument, SourceAdmissionPreparationReceipt,
  SemanticExtractionInputEnvelope, every selected SemanticInferenceTranscript,
  ReviewedInferencePayload, GovernedResidualProducerRegistry, every
  GovernedResidualObservation, both residual-universe roots,
  GovernedResidualUniverseReconciliation, GovernedResidualUniverseManifest,
  every GovernedResidualDisposition, GovernedResidualDispositionManifest, both
  residual-impact projections, every reconciled GovernedResidualImpactClosure
  and the exact empty GovernedResidualReviewQueueRoot,
  SemanticGraphNormaliserDefinition,
  ValidatedSemanticGraph and validation report, CanonicalTextVerificationManifest,
  IndependentDealDocumentManifest,
  AdmissionUniverseReconciliation, PotentialDependencyUniverse and every
  AdmittedCoverageAtom; both catalogue and question-universe paths,
  catalogue, base-subject, question-disposition and slot reconciliations,
  legal-dimension discovery and mapping and every challenge entry and
  disposition; every OpenWorldSemanticCandidate and occurrence, general and
  kind supersession, every OpenWorldCandidateAdmissionTransition,
  every transition-bound historical disposition,
  OpenWorldCandidateAuditChainRoot,
  OpenWorldEffectiveOccurrenceRoot and OpenWorldCandidateChainReconciliation,
  OpenWorldEvidenceClosure, primitive observation and relationship and
  OpenWorldPrimitiveCollectionRoot, final disposition and complete disposition
  manifest, exact empty OpenWorldReviewQueueRoot, both SemanticImpactWalkerOutputs,
  their independence attestation and reconciled SemanticImpactClosure,
  ActiveReleaseRevocationActionRegistry,
  ApplicabilityEligibleMemberKindProducerRegistry/V3, every
  ApplicabilityReexaminationRequirementDefinition and the exact
  ApplicabilityReexaminationRequirementSetRoot, every post-contract-freeze
  ApplicabilityReexaminationRequirement, Entry, Slice and
  ScopeSubjectApplicabilityRoot, both candidate-wide
  applicability roots and every reachable node, their independence attestation,
  exact ApplicabilityReexaminationReconciliation and
  ApplicabilityReexaminationManifest, every
  MetricApplicabilityRequirementProjection and the terminal projection set.
  Non-empty review
  queues and OpenWorldSimilarityProposals remain offline and are traced only by
  the offline operational-audit chain, never by a candidate release row;
- for every registered semantic stage, each SemanticComputationInputEnvelope,
  SemanticComputationPayload, semantic-object ID, self-contained
  SemanticReviewInputEnvelope and disposition, NonSemanticPayloadAttestation,
  governed-object ID, functional GovernedSemanticRecord mapping and
  NeutralStageProjection, SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot; exact
  RelationshipEffectFieldUniverseSetRoot and every
  RelationshipEffectFieldUniverse, complete independent and ordinary
  RelationshipEffectConstraint state-by-field matrix and exact set roots,
  relationship-semantic reconciliation, ExpectedRelationshipNeutralProjection,
  RelationshipSemanticExpectation, ClaimScopeDependencyExpectation and
  ClaimScopeClosure;
- every independent and ordinary composition disposition, requirement,
  locality shard, deal and global totality root, shard and parent
  reconciliation, ExpectedCompositionContractProjection,
  CompositionContextKeyUniverseRoot, its neutral content digest and every
  reachable BoundedInventoryTree node, and CompositionScopeClosure;
  every CandidateRelationshipActualProjection,
  CandidateRelationshipProjectionAttestation, registered candidate semantic
  envelope, payload, review, attestation and governed wrapper and
  CandidateRelationshipReconciliation; and every
  CandidateCompositionImplementationCatalogueRoot, its neutral catalogue
  digest and every reachable catalogue and implementation-source-artefact tree node,
  CandidateCompositionContractRealisationProjection,
  CandidateCompositionContractProjectionAttestation,
  CandidateCompositionInstanceProjection,
  CandidateCompositionInstanceProjectionAttestation, registered candidate
  semantic chain, candidate contract reconciliation and
  CandidateCompositionInstanceConformance, both
  CompositionContractSetRecompositionRoots and every reachable tree node,
  CompositionContractSetEnumeratorIndependenceAttestation, terminal
  CompositionContractSetAttestation and its certified common digest;
- every SourceAdmissionApprovalAttestation, ExpectedOccurrenceSlot,
  ExpectedResultInputLineageSlot,
  DealScopeRunManifest and receipt, scope slice,
  ScopeBuildTransition and receipt, ScopeBuildHead and ScopeSubjectHead tuple,
  CorpusScopeInventoryKindRegistry, both CorpusScopeInventoryRootSets, their
  common neutral content digest, CorpusScopeInventoryReconciliation and every
  reachable BoundedInventoryTree node, CorpusScopeManifest and
  CorpusScopeFreezeAttestation; every scope and post-scope Correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  CorrectionDischarge, ManifestMembershipRevision, CorrectionDischargeMap and
  digest, MultiSubjectScopeCorrectionReceipt/V2, event, ledger head, subject head
  and operation receipt;
  every CandidateInputEvent and CandidateInputHead tuple;
- every DealExtractionBuildTransition and receipt, FamilyBuildTransition and
  receipt, FamilyExtractionManifest, DealSnapshot, DealExtractionRunManifest
  and DealExtractionRunReceipt; every CandidateBuildTransition and receipt,
  CorpusReleaseInventoryKindRegistry, both CorpusRelease
  inventory shard, kind-root and root-set paths and
  CorpusReleaseInventoryReconciliation, CandidateInputSeal,
  CorpusRelease, CandidateOutputKindRegistry,
  CandidateOutputWriteDispositionRegistry, CandidateOutputMembership,
  CandidateOutputBatchManifest, CandidateOutputPreparationEvent,
  CandidateOutputPreparationReceipt
  and CandidateOutputPreparationHead tuple, both CandidateOutputInventoryShard,
  kind-root and root-set paths, every reachable BoundedInventoryTree node,
  CandidateOutputInventoryReconciliation, both complete output control-receipt
  trees and CandidateOutputControlReceiptReconciliation,
  CandidateOutputSeal,
  CandidateReleaseManifest, CandidateReleaseFreezeAttestation,
  CandidateInputRecheckEnumeratorRegistry, CandidateInputRecheckAttestation and
  its two embedded enumeration proofs and independence proof, every
  PromotionEligibilityProof,
  HistoricalReactivationEligibilityAttestation and CandidatePromotionFence
  version; every
  ServingObjectAccessRegistry, OfflineCertificationArtefactDenylist,
  ServingEmbeddedReferenceAllowlist, ServingExactDetailActionDefinition,
  each `CANONICAL_RESULT` and `INCOMPLETE_CANONICAL_RESULT` SharedServingRow
  with separate claim-state, result-completeness and market-comparability
  fields, each `REVIEWED_SOURCE_SPECIFIC` SharedServingRow with separate source-
  claim-state and market-comparability fields and an expressly absent result-
  completeness field, the source-specific
  direct-selection proof and ReviewedSourceSpecificOutputClosure, every market-
  observation eligibility or typed exclusion member, every market-observation occurrence,
  serving key and canonical payload digest, every materialised aggregate slot,
  cohort digest, aggregate serving key, canonical payload digest and
  `aggregate_input_set_digest`, ServingExactDetailPayload including
  `OPEN_WORLD_EVIDENCE`, ServingExactDetailReference and parent-reference edge,
  serving-key schema, CanonicalBundleInputIdentity,
  QueryDefinitionSetRoot and every definition member,
  QueryGoldenSuiteManifest and every golden case,
  QueryGoldenCertificationAttestation, request, result, cursor, error,
  CanonicalServingCacheIdentity, CanonicalServingCacheValue and
  ServingResponseBinding schemas, every ServingCacheIdentityDefinition and
  tests; BlockedResultPreviewDefinition, its pure-builder executable,
  configuration, route and role contract and no-carrier proof. Runtime
  BLOCKED_RESULT_PREVIEW responses are never stored or traced. Runtime
  QueryPlan, QueryPageRequest, cursor, cache and response-binding instances
  remain only in the separate operational audit;
- CandidateReleaseObjectProjectionRoot and
  CandidateReleaseBlobProjectionRoot and every reachable node,
  PromotionEvidenceSlotRegistry and ten-slot PromotionEvidenceSlotRoot,
  ReleaseBundleControlPolicy, the selected successful
  ReleaseBundleControlContext and its complete OPEN-to-FINALISED event, head and
  receipt chain, exactly four successful ReleaseBundleSpoolErasureReceipts and
  `ReleaseBundleSpoolErasureReceiptSetAttestation`
  (`SUCCESS_PRE_FINALISATION`),
  every WalkerTrustStatusHead tuple and immutable status event selected by a
  launch or seal proof,
  ReleaseBundleEnumeratorIndependenceAttestation, all four bundle ROLE_LAUNCH
  WalkerTrustStatusProofs and the one bundle CONTEXT_SEAL proof, all four
  ReleaseBundleWalkerRunClaims, signed WalkerOutputSpoolCommitments and
  ReleaseBundleWalkerSpoolCommitmentRoot and
  ReleaseBundleWalkerOutputAttestations,
  ReleaseBundleWalkerOutputSetAttestation, both ReleaseBundleMemberRootSets and
  ReleaseBundleMemberReconciliation, both PromotionEvidenceSupportRootSets and
  PromotionEvidenceSupportReconciliation, every reachable neutral member and
  support tree and ReleaseBundleEnvelope; every selected successful
  ProductionImportBatchManifest
  with its exact batch class, import event, head and receipt, fixed receipt-
  prefix context, ProductionImportEnumeratorIndependenceAttestation, all six
  import ROLE_LAUNCH WalkerTrustStatusProofs and the one import CONTEXT_SEAL proof,
  ProductionImportWalkerRunClaims, signed WalkerOutputSpoolCommitments and
  ProductionImportWalkerSpoolCommitmentRoot and
  ProductionImportWalkerOutputAttestations,
  ProductionImportWalkerOutputSetAttestation, exactly six successful
  ProductionWalkerSpoolErasureReceipts and
  `ProductionWalkerSpoolErasureReceiptSetAttestation(IMPORT_SUCCESS)`, both
  ProductionImportControlReceiptRoots, both ProductionImportMemberRootSets,
  both ProductionImportSupportRootSets and all three reconciliations, every
  reachable neutral import tree, ProductionBlobAvailabilityRoot and every
  reachable node, importer CompositionContractSetRecompositionRoot and every
  reachable node,
  ProductionSemanticParityEnumeratorIndependenceAttestation bound to the exact
  frozen ProductionSemanticParityRoleRegistry, its unique
  terminal slot and all three one-use semantic role slots, ROLE_LAUNCH proofs,
  run claims, signed WalkerOutputSpoolCommitments, neutral trees, governed
  ProductionSemanticParitySpoolCommitmentRoot, role-output roots and walker-output
  attestations, exactly three successful ProductionWalkerSpoolErasureReceipts,
  `ProductionWalkerSpoolErasureReceiptSetAttestation(SEMANTIC_SUCCESS)`, the
  two-role output set, reconciler output and terminal
  three-role output set, the semantic-parity CONTEXT_SEAL proof, all three
  production observation, cohort and aggregate parity root pairs,
  ProductionServingContractMetadataParityRootPair, every
  reachable parity and difference node and ProductionSemanticParityAttestation,
  ServingNamespaceHeader, ProductionImportSeal and ProductionImportAttestation;
  and
- every readiness-mirror and ServingFenceVersion transition, external admission
  lease and request-bound token, live-provider assertion, V3 tagged release-
  state transition, LegacyBaselineRollbackTarget,
  LegacyBaselineRollbackRehearsalAttestation,
  LegacyBaselineRestorationAttestation, receipt and V2 abandonment decision,
  LegacyBaselineRestorationPostCommitPolicy, every post-commit context, event,
  head, receipt and failure-evidence variant,
  CanonicalCutoverGenesisEvent and head
  version, PostActivationControlPolicy, exact PostActivationControlActionRegistry
  and trigger registry, every PostActivationControlContext, event,
  PostActivationControlReceipt and head,
  PostActivationPassCommitLease, every PostActivationFailureEvidence variant,
  activation, smoke, rollback, FailureRecoveryBranch, every branch-
  head version and fixed outcome, TraceabilityFailureTerminalSlot, historical-
  reactivation and completion artefact, each TraceabilityFailureTerminal, test
  case and suite.

An abandoned release-bundle context never enters POST_IMPORT and never uses a
post-activation TraceabilityFailureTerminal. Its
ReleaseBundleControlAbandonmentTerminal is lifecycle evidence, not the audit
closure. Exactly one `AttemptAuditTerminal` closes the corresponding registered
attempt after selecting the exact OPEN predecessor, partial-state inventory,
failure evidence, ABANDONED event, head and receipt, every spool-erasure target
and every ReleaseBundleSpoolErasureReceipt through the exact required-object
root, coverage-projection root, audit-row root and AttemptAuditReconciliation,
with fixed empty missing, extra, duplicate, unaccounted and success-branch
roots. The human matrix's separately
labelled AttemptAuditObjectRegistry projection displays that chain, while no
runtime member enters a passing traceability phase. Neither the abandonment
terminal nor AttemptAuditTerminal has release, promotion, import, traceability,
serving or programme-completion authority.

For every affected result, the matrix carries one executable chain from source
package and canonical occurrence, through SourceAdmissionPreparationReceipt,
SemanticExtractionInputEnvelope, the complete selected
SemanticInferenceTranscript set, ReviewedInferencePayload,
SemanticGraphNormaliserDefinition and graph signal to the open-world candidate.
For a source-role candidate the chain then names the pre-admission occurrence,
evidence and primitives, direct disposition, document-membership entry,
DealAdmissionManifest, admitted effective occurrence, mechanically rekeyed
evidence and primitives, admission transition and carried-forward current
disposition. It continues through the reconciled impact closure to the exact result
and component state, completeness, comparability and reason, serving-row
variant, market-observation eligibility or typed zero-observation exclusion and,
when eligible, exact observation occurrence, serving key and payload, each
materialised cohort and aggregate slot, aggregate key, input-set and payload,
route, component and adversarial test. For a source-role candidate it also proves
exactly one admitted source-specific row and zero pre-admission rows. The matrix
also carries that row's direct ReviewedSourceSpecificOutputClosure membership
and zero metric-basis, projection, observation and exclusion proofs. The matrix
separately carries the independent chain from each adopted contract item through
CanonicalBundleInputIdentity, producer registry, generated requirement
  definition and requirement-set root, its post-contract-freeze requirement
  instance, registry-owned local entries and slices, each subject's complete
  ScopeSubjectApplicabilityRoot, both sealed release-input
roots, both candidate-wide roots, independence, reconciliation, manifest, every
intersecting metric-projection entry and terminal set, materialisation-time
intake recheck, CandidateInputSeal, CorpusRelease and every downstream result.
A similarity proposal or non-empty queue may point only to offline review
evidence and cannot complete either chain.

That release matrix covers the exact certification, activation, smoke and
completion leases, tokens and provider assertions through one immutable
`CompletionTraceCutoff` carrying the captured operational-audit-head tuple. It
does not claim to close over ordinary requests created indefinitely after
completion. Later request admissions, revocations, deployments and rollbacks
append to the separate operational audit and may trigger a successor candidate,
containment or a historical-reactivation ceremony, but do not mutate or reopen
either release's certified matrix. POST_COMPLETION includes the cutoff and the
  one later completion-readiness lease explicitly. A registered post-activation
failure branch, whether or not smoke ran, has one identity independent of reason, one CAS-linearised head and one
absorbing fixed outcome. Only then does its reason-independent terminal slot
receive exactly one TraceabilityFailureTerminal with typed `FAILED` or
`ABANDONED` disposition over its exact failure, action-registry-bound progress
receipts, BEGIN receipt and FAILURE_CONTAINMENT_PENDING head, variant-ordered
external containment and any required ordinary revocation event and receipt,
COMPLETE receipt and FAILURE_FIXED head, first-cutover
legacy restoration and post-commit controller where applicable and any
attempted historical-reactivation PostActivationFailureEvidence union member.
Its predecessor is POST_IMPORT if
POST_ACTIVATION never closed and POST_ACTIVATION otherwise. It can never satisfy the passing
POST_COMPLETION chain.

Test coverage includes extraction goldens, identity stability, contract and
stage-registry enforcement, cross-view browser acceptance, visual regression,
accessibility, security, backup restoration, rollback, performance and database
load or soak tests. Contract generation and CI update or reject the matrix; it
is not a manually drifting report.

Independent enumerators discover receipts and their full governance history,
intake and dependency topology, source and deal manifests, canonical-text
verification, deal-document assignment, contract and semantic-stage objects,
framework routes and jobs, database RPCs and indexes, correction and lifecycle
heads, test-runner cases and candidate release objects. Before extraction,
bidirectional stable-ID and canonical-payload-digest equality is required among
independent discovery, the corresponding CorpusScopeManifest inventories and
the traceability matrix for every pre-extraction object listed above. The
comparison includes the current processing-policy head and complete allowed
activation chain, every historical governance payload, both independently
enumerated cutoff manifests and their independence attestation and
  reconciliation, the dependency manifest's separate selected roots and full
  acyclic transitive edge closure, the complete scope-correction ledger and
  subject-head set and every
  semantic inner object, outer governed wrapper, functional mapping,
  SemanticStageOutputSetRoot, SemanticNeutralProjectionSetRoot,
  RelationshipEffectFieldUniverseSetRoot and path-specific
  RelationshipEffectConstraintSetRoot. Empty
differences in both directions are mandatory.

The firewalled semantic certifier separately proves `B_base = O_base`,
`Q_independent = Q_ordinary` with `W_open = PASS`, total
`B_question_state = O_question_state`, `B_slot = O_slot`, a complete challenge
partition, complete RelationshipEffectFieldUniverse state-by-field coverage and
`R = E`. It proves every registered stage used the declared input roles and
ordering, every review was self-contained, every NonSemanticPayloadAttestation
passed the prohibited-input and non-interference checks, every governed object
maps functionally to one semantic object and every neutral projection is the
declared deterministic stripping of that object. The composition certifier
separately proves total coverage, every per-shard
`K_contract(s) = D_contract(s)`, exact parent partition equality and a complete
ExpectedCompositionContractProjection.

Candidate closure separately requires exact equality among the materialised
occurrence IDs and payloads and every ExpectedOccurrenceSlot; selected revision
occurrences and those materialised occurrences; current correction events,
effective application sets, complete CorrectionApplicabilityProjection and
reconciled CorrectionApplicabilitySlice sets, passing CorrectionDischarges and
exact primary output refs selected by the scope or extraction artefacts, plus
every required MultiSubjectScopeCorrectionReceipt/V2 and its exact subject-receipt
set; the frozen scope and
extraction transition, receipt, snapshot and manifest selected for every deal;
the complete post-scope correction ledger and subject-head set captured by each
selected extraction;
both sealed CorpusRelease inventory root sets and reconciliation, every
  definition-bound ApplicabilityReexaminationRequirement, registry-owned Entry
  and complete Slice and every ScopeSubjectApplicabilityRoot, both candidate-wide applicability roots, their independence
attestation, named reconciliation and manifest, every metric-projection entry
and terminal set, then the materialisation-time intake recheck,
CandidateInputSeal, CorpusRelease and the captured CandidateInputHead in that
exact order; and both CandidateOutputInventoryRootSets, their
common neutral content digest, reconciliation, sealed
CandidateOutputPreparationHead and CandidateOutputSeal. For every
relationship, the independently stripped candidate projection and its
named CandidateRelationshipProjectionAttestation must traverse the registered
candidate semantic chain and close its exact stage root before its comparison
body can prove `A_pre(c) = E_pre(c) = R_pre(c)` and then
`A_all = E = R`. Candidate composition must separately traverse its stripped
contract-realisation and instance projections, their named attestations and
registered stage roots before proving
`K_contract = D_contract = A_contract` and a passing
CandidateCompositionInstanceConformance, then build and reconcile both bounded
CompositionContractSetRecompositionRoots, prove enumerator independence and
require the terminal CompositionContractSetAttestation. Every relationship effect,
FieldUniverse serving
disposition and ResultInputLineage validates. Every exact-detail action,
selection path, payload, contextual reference and parent edge validates. The
inactive namespace object set
must exactly equal the CandidateReleaseManifest object set, and independently
derived per-kind output member keys and payload digests must exactly equal the
materialised pairs, including serving, aggregate, exact-detail and empty kinds.
CandidateReleaseFreezeAttestation,
CandidateInputRecheckAttestation and the held CandidatePromotionFence must bind
those exact roots and heads. Every mapping is traced. A self-declared inventory,
matching count or omitted failed object cannot pass.

## Phase 9 release and traceability contracts

Every database-backed Phase 9 operation/action/discriminator tuple, including
each bundle, import, semantic-parity, readiness, activation, post-activation,
containment, restoration, recovery, trace and completion-terminal-pair action,
must select exactly one generated entry in `GeneratedLockPlanRegistry`. The
repository Git-ref status publication is governed by its protected compare-and-
swap contract and is not a SQL action. Each generated entry names every
mutable authority from `GlobalMutableAuthorityRegistry`, the complete database
lock set and one global acquisition order, CAS predicates, external-fence and
lease preconditions, no-external-call-under-lock proof and terminal receipt
cardinality. Contract freeze rejects a missing, extra, caller-selected or cyclic
plan. Runtime compares the generated plan digest before the first mutation;
ad-hoc locking or an action not in the registry performs zero DML.

`ProgrammeStatusPublicationHead` is the sole mutable pointer for published
programme status. It is implemented by the repository-native
`refs/heads/programme-status-publication-head` Git ref. Ordinary status
publication is one protected compare-and-swap from the exact predecessor Git
object to one immutable successor status and emits its generated receipt.
Completion uses no cross-system transaction. A database serialisable
transaction first writes the proposed terminal status and POST_COMPLETION
extension as one immutable pair to an append-only
`CompletionTerminalPairAttempt` keyed by `(status_generation,
expected_git_predecessor_object_id, proposed_status_payload_digest)`. Neither
member can occupy an attempt alone. Exactly one attempt may become current. The
protected status publisher then revalidates the exact pair and advances the Git
ref by stale-safe compare-and-swap to a status commit that binds it. Until that
Git publication succeeds, the database pair is non-current and
`programme_complete` remains `OPEN`; a failed ref update may be retried only
after full revalidation. If the Git predecessor has advanced, the protected
publisher immutably marks that attempt `ABANDONED_STALE_PREDECESSOR`; a fresh
completion validation may then create a new attempt at the next status
generation against the new head. The new attempt must rebind and recompute its
status, completion context, readiness lease and POST_COMPLETION extension; it
cannot copy the stale pair. A unique partial index permits at most one `OPEN`
attempt per observed predecessor and at most one `PUBLISHED` attempt globally.
No programme status, readiness mirror or prose
assertion marks the programme complete unless the target
PostActivationControlHead is already terminal `PASS_FIXED`.

`ReleaseActivationCertification` is the release-scoped success authority for
every canonical release, including the first. It hashes the exact candidate,
PreCutoverCertification, import and POST_IMPORT trace, consumed
CutoverAuthorisation, ActivationEvent, READY_CANONICAL fence, POST_ACTIVATION
trace, passing smoke, consumed pass-commit lease, `PASS_FIXED` control head,
AVAILABLE promotion-fence successor, complete active tuple and the release's
passing rollback rehearsal. It is created atomically by the successful
`COMMIT_PASS` transaction with `PASS_FIXED`, the AVAILABLE fence and the
applicable genesis or exact-predecessor ongoing promotion-head effect. It
precedes any programme-completion artefact and contains no programme-status
generation or terminal-pair field.
The first release's ProgrammeCompletionAttestation selects this certification.
After the one-time programme head becomes absorbing `COMPLETE`, later canonical
releases use the separate `OngoingReleasePromotionHead`: an append-only,
serialisable database authority over the current certified release activation.
It is keyed once per production environment, is registered in
GlobalMutableAuthorityRegistry and GeneratedLockPlanRegistry, and permits only
an exact-predecessor compare-and-swap in the same transaction that creates the
successor terminal `PASS` ReleaseActivationCertification.
Each later promotion must satisfy the same candidate, import, cutover, smoke,
trace, rollback and release-activation contracts. Its successful `COMMIT_PASS`
compare-and-swaps that head from the exact current
ReleaseActivationCertification to the successor atomically with the new
certification and receipt. It does
not reopen, increment or depend on ProgrammeStatusPublicationHead. A prior
canonical release becomes a historical-reactivation target as soon as its own
ReleaseActivationCertification is current and its retention proof passes.
Both objects, every compare-and-swap receipt and every historical-reactivation
dependency are mandatory traceability-matrix members and operational release-
trace entries; they do not mutate the already completed programme trace.

For the first canonical cutover only, the precondition to step 16 is one
LegacyBaselineRollbackTarget, a current passing
LegacyBaselineRollbackRehearsalAttestation, V3 `LEGACY_BASELINE` release state,
`READY_LEGACY_BASELINE` ServingFenceVersion and CanonicalCutoverGenesisHead at
`READY_LEGACY_BASELINE`. Step 17's activation atomically moves that head to
`FIRST_CANONICAL_IN_PROGRESS`; step 18 publishes `READY_CANONICAL`. Passing step
20 permits steps 21 and 22 to fix the head at `CANONICAL_ESTABLISHED` before programme
completion. Any closed post-activation failure trigger before `PASS_FIXED`
follows exactly one disposition order: owned BEGIN then external BLOCKED and
drain, or registered ordinary BLOCKED and drain followed by the atomically
coupled revocation evidence, adopted disposition and BEGIN; both then follow the
same `COMPLETE_FAILURE_CONTAINMENT` branch below. For the first canonical
attempt, COMMIT_PASS reinstates the exact legacy V3 variant under BLOCKED and
opens its post-commit context. READY_LEGACY_BASELINE is then adopted and smoke
must pass before `ADOPT_LEGACY_SMOKE_AND_FIX` returns the genesis head to
`READY_LEGACY_BASELINE` and fixes success. A pre-commit failed attempt records no
release-state, genesis-head or ready-fence transition and may be retried at the
next writer-derived ordinal. Explicit abandonment over the latest failed
attempt fixes the recovery outcome, retains BLOCKED exposure and closes the one
failure terminal. No failed or partial restoration can be reported as rollback
success.

The exact pre-authorisation and successor programme-status artefacts and signed
DeploymentReadinessMirror versions are immutable digest-addressed predecessor
evidence carried by CutoverAuthorisation and ActivationEvent. They are not
additional corpus manifests or gate authorities and cannot be edited in place.
DeploymentChangeIntent and RollbackEvent are conditional transition evidence,
not success-chain members. A `FAILURE_FIXED` context, whether caused by ready
publication, trace, smoke, timeout, crash or containment failure, cannot satisfy
programme completion.

After `CANONICAL_ESTABLISHED`, historical reactivation is the sole closed
alternative to the failed target's release path; the first-cutover legacy
restoration above is the only exception. Historical reactivation never reruns
extraction, creates a replacement manifest or reimports a namespace. After
post-activation containment
has atomically committed the exact RollbackEvent, FailureRecoveryBranch and
`OPEN` FailureRecoveryBranchHead,
the revoked deployment controller may restore only the event's intended prior
provider, configuration, alias, schema and migration fields. The validator then
creates a fresh HistoricalReactivationEligibilityAttestation and
`HISTORICAL_REACTIVATION` PromotionEligibilityProof, advances the exact revoked
promotion fence to a purpose-bound HELD version, issues a new CUTOVER_READY
mirror and one-use CutoverAuthorisation, performs the ordinary BLOCKED,
ActivationEvent plus PostActivationControlContext and READY_CANONICAL sequence
against the exact current exposure-off tuple, and runs the same bounded trace,
smoke and terminal control for that historical attempt. The
reactivated after tuple repeats every immutable release, namespace, import,
deployment, runtime, configuration, alias, schema and migration field from the
intended prior tuple, sets `exposure_enabled=true` and uses only the required
higher release-state generation. A present CandidateInputHead later than the
prior release is permitted only because the historical eligibility proof binds
and freezes that exact present head; no stage compares it with, rewinds it to or
derives authority from the prior candidate's input head. `PASS_FIXED` releases
the held fence to AVAILABLE and fixes
`HISTORICAL_REACTIVATION_SUCCEEDED`; failure or abandonment retains BLOCKED
exposure, produces a higher REVOKED version and fixes
`HISTORICAL_REACTIVATION_ABANDONED_OR_FAILED`. A deliberate decision not to
attempt reactivation fixes `NO_HISTORICAL_REACTIVATION` directly from `OPEN`.
Exactly one TraceabilityFailureTerminal then closes the fixed branch over
containment and the complete outcome. None of these objects can make that failed candidate's
P9_TRACEABILITY, POST_COMPLETION or programme-completion predicates pass.
`P9_PROMOTION_ELIGIBILITY` is `PASS` only when the target-bound status
generation selects exactly one current union variant and its exact held fence.
For the historical variant, the immutable prior production-import and gate
evidence remains evidence for that retained target, while every mutable policy,
revocation, dependency, provider, schema, readiness and release-state predicate
is freshly evaluated. Evidence or status from the failed target cannot satisfy
the historical branch.

`CandidateReleaseManifest` selects, through exact immutable inventory roots, the
frozen contract pair,
OperationalPolicySet, certification policy, CorpusScopeManifest and scope
digests, CorpusRelease,
ordered snapshots, canonical objects and source payloads, including every
ArchiveSafetyPolicyManifest, SubmissionReceipt, IntakeLedgerEvent,
ArchiveAttemptNode, IntakeProcessingAttempt, SubmissionExpansionManifest,
SourceContent, ImmutableSourceDocument, SourceAdmissionPreparationReceipt,
selected corpus SemanticExtractionInputEnvelope, complete selected
SemanticInferenceTranscript set, ReviewedInferencePayload,
SemanticGraphNormaliserDefinition and ValidatedSemanticGraph with validation
report and payload digests, source occurrence, IntakeUniverseManifest,
ReceiptReplacementLink, IntakeResolution, complete
attempt and resolution chains and heads, selected-effective-resolution map,
LedgerCutoffStateManifest, IndependentCutoffStateManifest,
CutoffEnumeratorIndependenceAttestation, CutoffStateReconciliation,
HistoricalIntakeGovernanceInventory and every referenced historical policy,
status, review and approval payload, IntakeEligibilityDependencyManifest with
its separate selected roots and complete transitive replacement and
exact-duplicate edge closure, OperationActionRegistry,
CanonicalPhysicalCarrierRegistry, CanonicalWriterDispositionRegistry,
ProductionSemanticParityRoleRegistry,
CutoffPreparationKindRegistry,
CutoffPreparationWriteDispositionRegistry, frozen CutoffBuildTransition and
receipt, sealed CutoffPreparationHead tuple and terminal event and receipt,
both CutoffPreparedRootSets, CutoffPreparedReconciliation, control-receipt roots
and CutoffPreparationControlReceiptReconciliation and CutoffPreparationSeal,
whose sealed preparation-head tip recursively authenticates every earlier
CutoffPreparationMembership, batch manifest and event, while the control-
receipt trees independently authenticate every PAYLOAD_APPENDED receipt and the
PREPARED transition authenticates the terminal seal receipt,
exact IntakeProcessingPolicyHead tuple and
activation observed by candidate FREEZE and complete allowed activation-chain
payloads through that head,
IntakeCutoffAttestation, its exact initial-mode
IntakeEligibilityRecheckAttestation and the current post-cutoff recheck,
CanonicalTextVerificationManifest, every required
SourceAdmissionApprovalAttestation,
IndependentDealDocumentManifest, AdmissionUniverseReconciliation,
AdmittedCoverageAtom and PotentialDependencyUniverse ID and payload digest,
all three `InventoryEnumeratorIndependenceAttestation` stage objects,
IndependentSemanticQuestionCatalogue object and root,
SemanticQuestionCatalogueReconciliation, SemanticStageRegistry,
IndependentLegalDimensionDiscoveryManifest,
IndependentLegalDimensionMappingManifest,
every selected OpenWorldSemanticCandidate and OpenWorldCandidateOccurrence,
current OpenWorldCandidateSupersession and OpenWorldCandidateKindSupersession,
every OpenWorldCandidateAdmissionTransition and transition-bound historical
disposition,
every effective ReviewedSourceSpecificPublicationDecision,
OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot and
OpenWorldCandidateChainReconciliation,
OpenWorldEvidenceClosure,
OpenWorldPrimitiveObservation, OpenWorldPrimitiveRelationship and
OpenWorldPrimitiveCollectionRoot, final
OpenWorldCandidateDisposition and OpenWorldCandidateDispositionManifest, both
impact-walker outputs, SemanticImpactEnumeratorIndependenceAttestation,
reconciled SemanticImpactClosure, ApplicabilityEligibleMemberKindProducerRegistry/V3,
every bundle-generated, frozen-pair-independent
ApplicabilityReexaminationRequirementDefinition and metric-slot definition
  basis, exact scope-generation opening transition and receipt, every selected
  post-freeze ApplicabilityReexaminationRequirement, then every registry-owned
  ApplicabilityReexaminationEntry and ApplicabilityReexaminationSlice and every
  ScopeSubjectApplicabilityRoot, both sealed
release-input root sets and their reconciliation, then both complete
applicability-universe roots and every reachable node, exact
ApplicabilityReexaminationEnumeratorIndependenceAttestation,
ApplicabilityReexaminationReconciliation and
ApplicabilityReexaminationManifest, then every
MetricApplicabilityRequirementProjection entry and the terminal
MetricApplicabilityRequirementProjectionSet,
and the exact empty
OpenWorldReviewQueueRoot,
IndependentSemanticQuestionUniverseManifest,
OrdinarySemanticQuestionUniverseManifest, SemanticQuestionUniverseReconciliation
and `W_open = PASS` terminal proof, IndependentSemanticChallengeManifest,
ChallengeBaseSubject,
ChallengeQuestionDisposition, OrdinaryQuestionDisposition,
ChallengeQuestionSlot, OrdinaryQuestionSlot and per-slot entry and disposition
ID and payload digest,
exact `B_base = O_base`, `Q_independent = Q_ordinary` with `W_open = PASS`,
`B_question_state = O_question_state`, `B_slot = O_slot` and `R = E`
reconciliation digests,
every applicable PRE_FREEZE_CONTRACT, SOURCE_BUILD and CANDIDATE_BUILD
SemanticStageOutputSetRoot and SemanticNeutralProjectionSetRoot, exact
RelationshipEffectFieldUniverseSetRoot and every
RelationshipEffectFieldUniverse, both complete state-and-field
RelationshipEffectConstraint sets, their exact path-specific set roots and
relationship-semantic reconciliation,
every SemanticComputationInputEnvelope, SemanticComputationPayload,
NonSemanticPayloadAttestation, SemanticReviewInputEnvelope and review
disposition, every semantic-object ID, governed-object ID and functional
GovernedSemanticRecord mapping, every NeutralStageProjection and
ExpectedRelationshipNeutralProjection, every
CandidateRelationshipActualProjection and exact
CandidateRelationshipProjectionAttestation, every
pre-claim and full CandidateRelationshipReconciliation,
ExpectedCompositionContractProjection, exact
CompositionContextKeyUniverseRoot and neutral content digest and every
BoundedInventoryTree leaf and internal node reachable from it, exact
CandidateCompositionImplementationCatalogueRoot and neutral catalogue digest
and every catalogue and implementation-source-artefact tree node reachable from
its fixed roots,
CandidateCompositionContractRealisationProjection and exact
CandidateCompositionContractProjectionAttestation, candidate contract
reconciliation, CandidateCompositionInstanceProjection and exact
CandidateCompositionInstanceProjectionAttestation and
CandidateCompositionInstanceConformance, both
CompositionContractSetRecompositionRoots and every tree node reachable from
them, CompositionContractSetEnumeratorIndependenceAttestation and terminal
passing CompositionContractSetAttestation, with exact registered
subject-by-path-by-stage cardinality and
selected-PASS-wrapper completeness proofs,
RelationshipSemanticExpectation, ClaimScopeDependencyExpectation,
ClaimScopeClosure, every independent and ordinary composition disposition,
requirement, locality shard, deal and global totality root, shard and parent
reconciliation, CompositionScopeClosure, every ExpectedOccurrenceSlot and
ExpectedResultInputLineageSlot,
DealScopeRunManifest, DealScopeRunReceipt, frozen ScopeSubjectHead map and
predecessor-chain proof, scope slice, CorpusScopeInventoryKindRegistry, every
BoundedInventoryTree leaf and internal node reachable from both complete
CorpusScopeInventoryRootSets, both root sets, their common neutral content
digest, CorpusScopeInventoryReconciliation, CorpusScopeManifest and
CorpusScopeFreezeAttestation, exact scope- and post-scope-correction roots,
  every Correction, CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  ManifestMembershipRevision, CorrectionDischarge,
  CorrectionDischargeMap and digest, MultiSubjectScopeCorrectionReceipt/V2, event, subject head
  and ledger head, every
CandidateInputEvent and exact
CandidateInputHead tuple, all ScopeBuildTransitions and receipts, terminal
DealExtractionBuildHead tuples and transitions and receipts,
FamilyBuildTransition and FamilyBuildReceipt,
FamilyExtractionManifest, DealExtractionRunManifest and DealExtractionRunReceipt,
the current generation's OPEN, INPUT_SEALED and PREPARED
CandidateBuildTransitions and receipts, CorpusReleaseInventoryKindRegistry,
both independent CorpusRelease inventory shards, kind roots and root sets,
CorpusReleaseInventoryReconciliation, both complete applicability roots and
every reachable node, their independence attestation,
ApplicabilityReexaminationReconciliation, ApplicabilityReexaminationManifest,
every MetricApplicabilityRequirementProjection, the terminal
MetricApplicabilityRequirementProjectionSet, exact materialisation-time recheck,
then CandidateInputSeal and CorpusRelease,
CandidateOutputKindRegistry, CandidateOutputWriteDispositionRegistry, terminal
SEALED CandidateOutputPreparationHead tuple, its OUTPUT_SEALED event and
CandidateOutputPreparationReceipt, both control-receipt tree roots and
CandidateOutputControlReceiptReconciliation, both
independent CandidateOutputInventoryShards, kind roots and root sets, their
common neutral content digest and CandidateOutputInventoryReconciliation and
ReviewedSourceSpecificOutputClosure selected once directly by
CandidateOutputSeal, CandidateOutputSeal, ReleaseIntakeDependencyProjection,
exact candidate
`K_contract = D_contract = A_contract` reconciliation digest, exact
independently recomposed `composition_contract_set_digest` and passing
CandidateCompositionInstanceConformance, relationship-effect payload and
ResultInputLineage, ServingObjectAccessRegistry,
OfflineCertificationArtefactDenylist, ServingEmbeddedReferenceAllowlist,
ServingExactDetailActionDefinition set and ServingContractMetadata digests,
PreSealTraceabilityRoot and exact CandidateManifestMemberRoot, its common
neutral content digest and reconciliation. Typed serving-key
and canonical-payload-digest triples for result rows, child rows, observations,
aggregates, ServingExactDetailPayloads, ServingExactDetailReferences and parent-
reference edges live under their exact output-kind roots and are never inlined
in the manifest. Those roots expressly contain exactly one
`CANONICAL_RESULT` or `INCOMPLETE_CANONICAL_RESULT` triple for every selected
DerivedResultRevision, exactly one `REVIEWED_SOURCE_SPECIFIC` triple for every
effective admitted occurrence with that final disposition, including exactly one
for each transitioned source-role candidate and zero for every pre-admission
occurrence, and every required
`OPEN_WORLD_EVIDENCE` detail payload, reference and parent edge. Output-kind
roots contain rows only and never contain or select
ReviewedSourceSpecificOutputClosure. CandidateOutputSeal directly selects that
fixed-size closure exactly once and proves that source-specific rows have no
metric-slot branch. The output roots contain
`MarketMetricSlotExclusion` records only for ineligible canonical slots and prove
that a canonical observation exists if and only if its owner is `COMPLETE` and
`COMPARABLE` under its exact metric-applicability projection. The terminal output-head
tip recursively authenticates all
earlier membership, batch-manifest and preparation-event controls; the control-
receipt trees authenticate every earlier MEMBERS_APPENDED receipt. Those
corpus-sized histories are expanded only through the fixed references and are
never inlined in the manifest or FREEZE transaction. Every generic stage root, specialised legal root and named
projection-attestation inventory carries stable-ID and canonical-payload-digest
equality with empty missing, extra and duplicate sets. Corpus-sized inventories live in bounded content-addressed
shards selected by those roots; the manifest never inlines them. The candidate-
manifest member trees apply the generated closed
`CandidateManifestLaterObjectExclusionRegistry` and expressly exclude their own
nodes and root, CandidateReleaseManifest itself, CandidateReleaseFreezeAttestation,
FROZEN CandidateBuildTransition and receipt, CandidateInputRecheckAttestation,
every later CandidatePromotionFence version, DeploymentManifest, every
TraceabilityExtension, PreCutoverCertification,
CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot and
their reachable nodes, PromotionEvidenceSlotRegistry,
PromotionEvidenceSlotRoot, both PromotionEvidenceSupportRootSets and their
reconciliation, every ReleaseBundleMemberRootSet, the bundle-enumerator
attestation, all four bundle ROLE_LAUNCH WalkerTrustStatusProofs and the one
bundle CONTEXT_SEAL proof, all four bundle-walker run claims and output attestations, the
bundle-walker output-set attestation and member reconciliation,
all four bundle WalkerOutputSpoolCommitments, the
ReleaseBundleWalkerSpoolCommitmentRoot, ReleaseBundleControlContext and every
ReleaseBundleControlEvent, ReleaseBundleControlReceipt,
ReleaseBundleControlFailureEvidence, ReleaseBundleControlAbandonmentTerminal
and ReleaseBundlePartialStateTree, every ReleaseBundleSpoolErasureReceipt,
both ReleaseBundleSpoolErasureReceiptSetAttestation variants,
AttemptAuditTerminalSlot, every AttemptAudit tree, root and reconciliation and
AttemptAuditTerminal, ReleaseBundleEnvelope
and every import object, including all six import ROLE_LAUNCH
WalkerTrustStatusProofs and the one import CONTEXT_SEAL proof,
the ProductionSemanticParityEnumeratorIndependenceAttestation bound to the
already manifested frozen role registry, unique semantic-parity terminal slot,
all three semantic role slots, ROLE_LAUNCH
proofs, claims, outputs and output sets, the semantic-parity CONTEXT_SEAL proof,
all four production semantic parity categories, including
ProductionServingContractMetadataParityRootPair,
ProductionSemanticParityAttestation and their reachable nodes, plus every readiness, cutover,
activation, smoke, completion and terminal-status artefact. The exclusion
registry is generated before candidate work from object topology; omission,
addition or a generated topology mismatch blocks ContractFreezeAttestation.
`PreCutoverCertification` records every
gate required transitively by the `production_import` work class, candidate
release, exact CandidateReleaseFreezeAttestation, current
CandidateInputRecheckAttestation and held CandidatePromotionFence version,
frozen contract pair, exact G0_EXACT_DIGEST_REVIEW_SET and
G0_BEN_SPEC_APPROVAL evidence IDs and payload digests over the same governing-
specification root, OperationalPolicySet, exact current
IntakeProcessingPolicyHead tuple and activation and complete allowed activation
chain, OperationActionRegistry, GlobalMutableAuthorityRegistry,
GeneratedLockPlanRegistry, ProgrammeStatusPublicationHead schema and transition
policy, CanonicalPhysicalCarrierRegistry,
CanonicalWriterDispositionRegistry, WalkerHarnessExecutionPolicy ID and
payload digest and both profile digests, all three
InventoryEnumeratorIndependenceAttestation stage objects, both cutoff manifests and their
independence and reconciliation proofs,
historical-governance inventory and payload set, eligibility-dependency roots
and transitive edges, complete CutoffBuild and CutoffPreparation terminal chains,
both CutoffPreparedRootSets, CutoffPreparedReconciliation, both control-receipt
roots, CutoffPreparationControlReceiptReconciliation and CutoffPreparationSeal,
initial-mode and current post-cutoff intake rechecks, every verified original
source-package byte/hash/file-type/converter-lineage proof,
ImmutableSourceDocument, SourceAdmissionPreparationReceipt,
SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
ReviewedInferencePayload, SemanticGraphNormaliserDefinition and
ValidatedSemanticGraph with its validation report, complete
OpenWorldCandidateAuditChainRoot,
OpenWorldEffectiveOccurrenceRoot and OpenWorldCandidateChainReconciliation,
final-disposition manifest, exact empty review queue, both impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation and SemanticImpactClosure, every
  local applicability requirement, entry, slice and ScopeSubjectApplicabilityRoot, both sealed release-input
roots and reconciliation, both candidate-wide applicability roots and every
reachable node, their independence proof, exact
ApplicabilityReexaminationReconciliation and
ApplicabilityReexaminationManifest, every
MetricApplicabilityRequirementProjection, terminal
MetricApplicabilityRequirementProjectionSet, exact materialisation-time
IntakeEligibilityRecheckAttestation, CandidateInputSeal and CorpusRelease in
that order, and exact `W_open = PASS`; the complete
three-variant SharedServingRow, OPEN_WORLD_EVIDENCE and observation-eligibility
or typed-exclusion parity roots; passing `SOURCE-PACKAGE-DIGEST-01`,
`SEMANTIC-EXTRACTION-DRY-RUN-01`, `CANONICAL-WRITER-AUTHORITY-01`,
`SEMANTIC-GRAPH-PARITY-01`, `SEMANTIC-INFERENCE-BOUNDARY-01`,
`SEMANTIC-INFERENCE-NO-RERUN-01`, `SOURCE-ADMISSION-PREPARATION-01`,
`SOURCE-ROLE-ADMISSION-TOPOLOGY-01` and the exact
`MandatoryAdversarialTestCatalogueRoot`. That root is mechanically enumerated
from every backticked test identifier in
`docs/codex-program/adversarial-tests.md` under the frozen YAML rule and binds
each identifier, complete test-definition digest, executable digest and
terminal result. Its count and identifier-set digest must equal the values in
`mandatory_adversarial_test_binding`, and every member must be `PASS`.
Per-gate `required_adversarial_tests` are early local minima only; their union is
not the pre-cutover universe. No filename scan outside the selected catalogue,
test-name prefix, prose classification or later-discovered test may widen or
narrow that frozen set;
every PRE_FREEZE_CONTRACT,
SOURCE_BUILD and CANDIDATE_BUILD SemanticStageOutputSetRoot and
SemanticNeutralProjectionSetRoot, RelationshipEffectFieldUniverseSetRoot, both
path-specific RelationshipEffectConstraintSetRoots, all three named candidate
projection attestations, candidate contract reconciliation and instance
conformance, exact CompositionContextKeyUniverse and implementation-catalogue
bounded roots and neutral digests, both CompositionContractSetRecompositionRoots,
their complete tree nodes, CompositionContractSetEnumeratorIndependenceAttestation
and passing CompositionContractSetAttestation, CorpusScopeInventoryKindRegistry,
  both CorpusScopeInventoryRootSets, their reachable tree nodes and reconciliation,
  CandidateReleaseObjectProjectionRoot and
  CandidateReleaseBlobProjectionRoot, their neutral digests, counts and fixed
  empty difference roots,
  exact passing QueryGoldenCertificationAttestation ID, payload digest and
  immutable canonical bytes,
  ServingObjectAccessRegistry, denylist and embedded-reference
allowlist digests, ServingExactDetailActionDefinition and response-schema
digests, CandidateOutputKindRegistry, CandidateOutputWriteDispositionRegistry,
terminal output-head chain, both output and control-receipt root sets and
reconciliations, all lifecycle transitions, seals and roots, exact POST_FREEZE
TraceabilityExtension, scope and
deployment digests, code and
specification commits, environment, threshold, measured value, immutable
evidence, validator, reviewer and Ben approval where required. Import parity, cutover authorisation,
activation and post-cutover smoke produce their later chain artefacts and may
not be pre-attested. A missing required gate, digest mismatch, scope mismatch or
prose assertion fails closed.

#### Normative ReleaseBundleEnvelope contract, sole authority

Only after that certification exists may the two independent bundle enumerators
expand three disjoint closed universes. `C` is exactly every object selected by
CandidateReleaseManifest, excluding the manifest itself. `B` is exactly every
immutable blob generation referenced by `C`. `E` is exactly ten fixed
promotion-evidence slots: CandidateReleaseManifest,
CandidateReleaseFreezeAttestation, FROZEN CandidateBuildTransition, its receipt,
CandidateInputRecheckAttestation, held CandidatePromotionFence version,
DeploymentManifest, the exact `POST_FREEZE` TraceabilityExtension and
PreCutoverCertification, plus `QUERY_GOLDEN_CERTIFICATION` containing the
actual immutable canonical bytes of the exact passing
QueryGoldenCertificationAttestation. The required equality is
`ReleaseBundleMemberSet = C union B union E`, with every pairwise intersection
empty. The query-golden attestation is absent from `C` and `B` and appears
exactly once only in its `E` slot. ReleaseBundleEnvelope, bundle inventory nodes and roots, enumerator
attestations, run claims, walker-output and output-set attestations,
reconciliations, import events and ProductionImportAttestation are structural
controls, never members.

CanonicalContractBundle generates a closed
`ReleaseBundleMemberDispositionRegistry`. Every member schema maps to exactly
one source universe, destination domain and physical carrier: `C` maps to
`CORPUS_PAYLOAD/INACTIVE_CORPUS_OBJECT_NAMESPACE`, `B` to
`CORPUS_PAYLOAD/INACTIVE_CORPUS_BLOB_NAMESPACE`, and all ten `E` slots to
`PROMOTION_EVIDENCE/IMMUTABLE_PROMOTION_EVIDENCE_NAMESPACE`. Promotion evidence
has no serving grant. There is no `OTHER`, `IGNORE` or caller-selected
destination. `member_role` is exactly one of
`CONTRACT`, `POLICY`, `INTAKE_GOVERNANCE`, `SOURCE`, `SEMANTIC_SCOPE`,
`CORRECTION`, `CANDIDATE_CANONICAL`, `SERVING_PROJECTION`, `CERTIFICATION` or
`DEPLOYMENT`. A generated closed logical-type registry maps every permitted
logical type to exactly one role, lower-case ASCII type slug and permitted
encoding key and extension. An unknown, overlapping or conflicting source,
destination, type, role or encoding mapping blocks contract freeze and bundle
construction.

The generated mapping is explicit for the open-world seam. Original package
bytes, `ImmutableSourceDocument`, SourceAdmissionPreparationReceipt and their
immutable source-admission lineage are `SOURCE`.
SemanticGraphNormaliserDefinition is `CONTRACT`.
`SemanticExtractionInputEnvelope`, every selected
SemanticInferenceTranscript, ReviewedInferencePayload,
`ValidatedSemanticGraph`, every
candidate and occurrence, both supersession kinds, every source-role admission
transition and its transition-bound historical disposition, both candidate-chain roots
and their reconciliation, evidence closure, primitive graph and collection,
  final dispositions and manifest, both impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation and reconciled closure, every local
  applicability requirement, entry, slice and ScopeSubjectApplicabilityRoot, the complete
candidate-wide applicability controls and manifest, and the exact empty
OpenWorldReviewQueueRoot are `SEMANTIC_SCOPE`. The three `SharedServingRow`
variants and every response-safe `OPEN_WORLD_EVIDENCE` detail payload,
reference and parent edge are `SERVING_PROJECTION`. A non-empty review queue,
unresolved effective-terminal or review carrier, or OpenWorldSimilarityProposal is not in `C` and
has no bundle mapping. No registry default may infer a role from its table or
namespace.

`ReleaseBundleControlPolicy` defines one normative lifecycle per
`bundle_context_digest`. `ReleaseBundleControlContext` has an immutable stable
key and an append-only current tuple in exactly `OPEN`, `FINALISED` or
`ABANDONED`. `PRECOMMIT_WALKERS` creates the genesis
`ReleaseBundleControlEvent(CONTEXT_OPENED)`, `OPEN` tuple and exact
`ReleaseBundleControlReceipt` atomically. Every success-path bundle role slot,
claim, ROLE_LAUNCH proof, WalkerOutputSpoolCommitment, committed neutral-tree
node, batch receipt, terminal walker output,
`SUCCESS_AFTER_TERMINAL_OUTPUT` receipt, `SUCCESS_PRE_FINALISATION` receipt-set
attestation, output-set attestation, governed root, difference root and
CONTEXT_SEAL proof binds that exact still-current `OPEN` tuple. A
`FAILED_AFTER_ABANDONMENT` receipt, `ABANDONED_CONTEXT` receipt-set attestation,
attempt-audit control and AttemptAuditTerminal instead bind the exact
abandonment terminal, event, `ABANDONED` head and lifecycle receipt. A stale
tuple or the wrong state predicate performs zero DML.

The only success transition is one serialisable `OPEN -> FINALISED` CAS, but
successful spool erasure is a required pre-finalisation subphase rather than a
side effect of that CAS. The fixed acyclic order is: each role's signed
WalkerOutputSpoolCommitment, complete tree and terminal PASS output;
`WRITE_WALKER_OUTPUT/<role>/SUCCESS_SPOOL_ERASURE`; exactly four role-bound
`ReleaseBundleSpoolErasureReceipt(mode=SUCCESS_AFTER_TERMINAL_OUTPUT)` objects;
`ReleaseBundleSpoolErasureReceiptSetAttestation(mode=SUCCESS_PRE_FINALISATION)`
covering those four receipts exactly once; `ReleaseBundleWalkerSpoolCommitmentRoot`
and the terminal output-set attestation; governed member and support roots,
reconciliations, fresh CONTEXT_SEAL proof and complete physical-closure and
empty-difference proofs; `ReleaseBundleEnvelope`; then
`ReleaseBundleControlEvent(CONTEXT_FINALISED)`, FINALISED context tuple and the
terminal lifecycle receipt. The receipt-set attestation has fixed cardinality
four and empty missing, extra, duplicate, wrong-role, wrong-mode,
wrong-commitment and erased-before-output roots. No predecessor hashes a later
item in that order. The envelope hashes the OPEN predecessor tuple and every
already complete selected control, including all four erasure receipts and the
SUCCESS_PRE_FINALISATION set, but not its later event, FINALISED tuple or
receipt. The CONTEXT_FINALISED event hashes the envelope; the tuple hashes that
event; the receipt hashes the envelope, event and before-and-after tuples.
Import may open only from that exact event, tuple and receipt beside the
envelope.

The only failure transition is one irreversible `OPEN -> ABANDONED` CAS through
`ABANDON_BUNDLE_CONTEXT`. Before that CAS,
`FAILURE_EVIDENCE` computes an exact pre-evidence partial-state digest over all
then-present role state, excluding the failure-evidence object and every later
abandonment control, locks the exact OPEN head and reason-independent
ReleaseBundleControlFailureEvidenceSlot, and atomically fixes that slot and
writes `ReleaseBundleControlFailureEvidence` with the digest and closed reason.
FINALISE_CONTEXT locks the same authorities and requires the slot EMPTY.
`PARTIAL_STATE_TREE_BATCH` then performs two
bounded independent enumerations over all four role slots, claims, ROLE_LAUNCH
proofs, signed spool commitments, commitment chunks, partial and terminal
neutral nodes, batch receipts, the committed failure evidence, output
attestations, prior successful erasure receipts, partial governed roots,
candidate envelope or finalisation attempts and every remaining spool-erasure
target, and closes the exact `ReleaseBundlePartialStateTree`. The evidence does
not hash this later tree. The `ABANDON_CONTEXT` transaction then writes, in order, one
`ReleaseBundleControlAbandonmentTerminal`,
`ReleaseBundleControlEvent(CONTEXT_ABANDONED)`, the ABANDONED context tuple and
one terminal `ReleaseBundleControlReceipt`, and forbids every later claim,
output, node, envelope, finalisation or state transition. Only after that
committed lifecycle receipt may the writer erase each remaining inventoried
failed or partial spool and append its role-bound
`ReleaseBundleSpoolErasureReceipt(mode=FAILED_AFTER_ABANDONMENT)`. It then
writes exactly one
`ReleaseBundleSpoolErasureReceiptSetAttestation(mode=ABANDONED_CONTEXT)` over an
exact partition of the abandonment terminal's independently inventoried
present commitment or partial-stream targets: a target with a durable pre-
abandonment success receipt contributes that receipt, and every complementary
target contributes exactly one failure receipt bound to the abandonment
terminal, event, head and lifecycle receipt. An unopened role is proven absent
and is not fabricated as an erasure target. Mixed prior success and failure is
valid; overlap, omission, relabelling or a second receipt for one target is not.
Only after that set closes
may the writer produce
`AttemptAuditTerminal(variant=RELEASE_BUNDLE_ABANDONED)`. The OPEN predicate
for successful erasure and the ABANDONED predicate for failed erasure are
distinct generated predicates. A terminal PASS output can use only the former;
a partial or failed output can use only the latter.

The Phase 9 spool inventory is closed at exactly thirteen signed
WalkerOutputSpoolCommitments: four release-bundle roles, six production-import
roles and three production-semantic-parity roles. They reduce to exactly three
ordered roots: ReleaseBundleWalkerSpoolCommitmentRoot,
ProductionImportWalkerSpoolCommitmentRoot and
ProductionSemanticParitySpoolCommitmentRoot. A passing chain also contains
exactly thirteen success erasure receipts and exactly three success receipt-set
attestations: four bundle receipts in `SUCCESS_PRE_FINALISATION`, six import
receipts in `IMPORT_SUCCESS`, and three semantic receipts in
`SEMANTIC_SUCCESS`. PreCutoverCertification certifies the closed role, policy
and carrier definitions. ReleaseBundleEnvelope, ProductionImportSeal,
ProductionSemanticParityAttestation, ProductionImportAttestation and the
applicable TraceabilityExtension then inventory every role commitment, root,
success receipt and success set at the first phase in which each may exist. A missing, extra,
repeated-role, cross-context, expired, erased-before-authority or unrooted
commitment blocks finalisation, import or cutover.

All thirteen harness-owned spools use one crash-safe
`WalkerSpoolErasureJournal` protocol. Before removing bytes, the authenticated
harness durably appends and fsyncs an intent keyed by context, role, commitment
or partial-stream identity, erasure mode, exact byte length and content digest.
It then removes the bytes, fsyncs the containing storage boundary, verifies
absence and appends a durable completion record before the canonical writer may
create the erasure receipt. Recovery replays an incomplete intent under the
same key: present matching bytes are erased and verified; already absent bytes
are accepted only with the journal's committed intent and independently
verified expected identity; substituted bytes, an absent intent, a changed
mode or a second identity fails closed. Receipt creation is idempotent under
the journal key. A receipt can be reconstructed from a completed journal entry
and its already committed prerequisite, never from caller testimony, and no
successful or abandoned receipt-set attestation may close while one selected
journal entry is incomplete.

`bundle_context_digest` is exactly
`H("RELEASE_BUNDLE_CONTEXT/V1", schema, frozen pair, CandidateReleaseManifest
ID and payload digest, CandidateReleaseFreezeAttestation, FROZEN
CandidateBuildTransition and receipt, CandidateInputRecheckAttestation, held
CandidatePromotionFence version, DeploymentManifest, POST_FREEZE
TraceabilityExtension, PreCutoverCertification, exact passing
QueryGoldenCertificationAttestation ID and payload digest,
ReleaseBundleMemberDispositionRegistry, logical-type registry,
PromotionEvidenceSlotRegistry, ReleaseBundleControlPolicy,
CandidateReleaseObjectSetProjectionDefinition
and structural-layout-contract digest, exact WalkerHarnessExecutionPolicy ID
and payload digest and `RELEASE_BUNDLE` profile digest)`. It excludes every bundle member tree,
root set, projection root, PromotionEvidence root, enumerator-independence
attestation, run slot or claim, walker-output or output-set attestation,
reconciliation, envelope and `bundle_digest`; no later bundle object may enter
or alter it.

Each member has a neutral ownership key
`H("RELEASE_BUNDLE_OWNERSHIP/V2", logical_type, schema_version, stable_id)` and
a logical member key
`H("RELEASE_BUNDLE_LOGICAL_MEMBER/V2", destination_domain,
physical_destination, member_class_code, stable_id)`. Its logical tuple is
`(logical_member_key, neutral_ownership_key, destination_domain,
physical_destination, member_role, logical_type, schema_version, stable_id,
canonical_payload_digest)`. Its transport tuple appends
`(canonical_byte_length, content_digest, encoding_key, member_path)`.
`content_digest` is SHA-256 over the exact stored member bytes and length is the
exact byte length. `member_path` is generated only as
`v1/<role_slug>/<logical_type_slug>/<stable_id_token>.<encoding_extension>`,
where `stable_id_token` is lower-case hexadecimal
`H("BUNDLE_MEMBER_STABLE_ID_PATH/V1", canonical UTF-8 stable_id)`. Every
generated segment matches `[a-z0-9][a-z0-9._-]{0,127}`, and the complete path is
at most 1,024 UTF-8 bytes. Paths are relative POSIX paths. Empty segments,
leading slash, backslash, `.` or `..`, control or NUL bytes, non-ASCII bytes,
case variants, unregistered extensions and any alternate Unicode or path
normalisation are invalid, not aliases. Both `member_path` and
`(logical_type, stable_id)` are unique. Identical payload bytes do not permit a
duplicate member. Including destination in the logical key makes a move fail;
neutral ownership keys and empty pairwise-intersection roots prevent the same
object from being duplicated across destinations.

Members sort by unsigned UTF-8 bytes of `member_path`, then by the canonical
UTF-8 bytes of `member_role`, `logical_type` and `stable_id`. For every fixed
destination and registry class, each of two disjoint enumerators streams the
logical and transport tuples into fixed-fanout BoundedInventoryTrees, including
domain-separated empty roots. A governed `ReleaseBundleMemberRootSet` hashes
`RELEASE_BUNDLE_MEMBER_ROOT_SET/V3`, bundle-context digest, exact enumerator
role, its exact ReleaseBundleWalkerOutputAttestation ID and payload digest,
disposition and logical-type registry IDs and the fixed contract-ordered `(destination,
member_class_code, logical_tree_root_ref, transport_tree_root_ref, member_count,
empty_kind_digest)` list. `ReleaseBundleMemberReconciliation` hashes both
enumerators' root sets, exact terminal-PASS
`ReleaseBundleEnumeratorIndependenceAttestation`, exact terminal-PASS
`ReleaseBundleWalkerOutputSetAttestation`, common neutral logical and transport content digests,
complete per-kind equality and fixed empty missing, extra, duplicate,
conflicting-payload, wrong-destination, repeated-governed-root, repeated-run-
attestation, wrong-role and ownership-intersection roots. It requires exactly
the distinct `MEMBER_A` and `MEMBER_B` governed wrappers and output attestations,
each bound to the role-specific executable and configuration fixed by the
independence attestation.
Each root set also publishes fixed source-universe neutral digests for `C`, `B`
and `E` using the exact neutral row schemas below; the reconciliation requires
the two enumerators' corresponding digests and counts to match.
All persistent bundle-control writes call only
`canonical_write(operation=RELEASE_BUNDLE_CONTROL_BUILD)`, whose generated
actions are exactly `PRECOMMIT_WALKERS`, `CLAIM_WALKER_ROLE`,
`WRITE_WALKER_OUTPUT`, `FINALISE_BUNDLE_CONTROLS` and
`ABANDON_BUNDLE_CONTEXT`, cardinality five. It is a structural-control
builder with no corpus-payload or serving grant. Each claim or output action
locks and revalidates the exact `OPEN` context tuple and role slot and commits one
complete immutable control or nothing. `CLAIM_WALKER_ROLE` stores the exact
fresh ROLE_LAUNCH WalkerTrustStatusProof with its claim;
`WRITE_WALKER_OUTPUT` has only `SPOOL_COMMITMENT`, `TREE_BATCH`,
`TERMINAL_OUTPUT` and `SUCCESS_SPOOL_ERASURE` phases, revalidates and selects
that proof, and writes a success erasure receipt only in its role-bound final
phase. `FINALISE_BUNDLE_CONTROLS/CONTROL_SET` first writes the
SUCCESS_PRE_FINALISATION erasure-receipt set, then the commitment root, output
set, governed roots and reconciliations through their bounded idempotent
commits. `FINALISE_BUNDLE_CONTROLS/FINALISE_CONTEXT` then accepts only the fresh
CONTEXT_SEAL proof over those completed controls and performs the one terminal
success transaction above. `ABANDON_BUNDLE_CONTEXT` alone has the closed ordered phases
`FAILURE_EVIDENCE`, `PARTIAL_STATE_TREE_BATCH`, `ABANDON_CONTEXT`,
`FAILED_SPOOL_ERASURE`, `SPOOL_ERASURE_RECEIPT_SET`,
`ATTEMPT_AUDIT_TREE_BATCH` and `ATTEMPT_AUDIT_TERMINAL`; it performs the one
failure lifecycle transaction and the later idempotent erasure and audit
subphases. Every other action, phase, state, transition or DML verb is
prohibited.
`ReleaseBundleEnumeratorIndependenceAttestation` is a pre-output object and the
immutable control carrier permits exactly one for each `bundle_context_digest`;
byte-identical replay returns it and any different replacement conflicts. It
hashes `RELEASE_BUNDLE_ENUMERATOR_INDEPENDENCE/V2`, schema,
bundle-context digest, exact WalkerHarnessExecutionPolicy ID and payload digest,
exact `RELEASE_BUNDLE` profile digest, the closed role registry `MEMBER_A`, `MEMBER_B`, `SUPPORT_A` and
`SUPPORT_B`, each role's executable and configuration, all four complete
transitive dependency graphs, the governed shared-primitive allowlist, exact
empty prohibited-code, query, view, cache, intermediate-row and output
intersections, validator evidence, terminal state and four contract-ordered
one-use run slots. Each slot ID hashes
`RELEASE_BUNDLE_WALKER_RUN_SLOT/V1`, schema, bundle-context digest, role and the
role-mapped executable and configuration digests, exact
WalkerHarnessExecutionPolicy ID and payload digest and `RELEASE_BUNDLE` profile
digest. The attestation hashes no
produced tree, run claim, output attestation, governed root or reconciliation.

Before a walker starts, `CLAIM_WALKER_ROLE` atomically writes one immutable
`ReleaseBundleWalkerRunClaim` under unique key `(bundle_context_digest, role)`.
Its ID hashes `RELEASE_BUNDLE_WALKER_RUN_CLAIM/V3`, schema, that complete key,
exact current `OPEN` ReleaseBundleControlContext tuple and genesis receipt,
exact run-slot ID, independence-attestation ID and payload digest, input-
snapshot, executable and configuration digests, execution nonce, sandbox-policy
digest, exact frozen harness-policy and profile digests, harness measurement,
harness-attestation key ID, complete certificate and measurement-attestation
chain IDs and payload digests, token-issuer key and chain IDs and payload
digests, exact fresh `ROLE_LAUNCH` WalkerTrustStatusProof ID and payload digest,
signed token claims and the digest of a non-exportable one-use launch
token. The canonical writer verifies the complete dynamic key and measurement
chain to the frozen attestation roots, exact expected harness measurement,
validity and revocation state, revalidates the proof signature, current trust,
revocation and key-status heads and expiry, and verifies the token signature, issuer,
audience, context, role, lifetime and claim nonce against the frozen token-
service profile before committing. No token secret is persisted. A self-issued,
unknown, stale, revoked or policy-mismatched chain writes nothing. A second claim fails, including one
with different evidence.

The authenticated harness, not walker code, is the output producer. Only after
the claim commits may it consume the claim-bound token to perform exactly one
fresh sandbox launch; no database lock remains held. The sandbox denies fork or clone, child execution,
same-process re-entry, supervisor restart, network and IPC access and persistent
state. The walker receives one read-only canonical input stream and has no
signing key, canonical-writer credential or output-carrier access. The harness
directly captures exactly one terminal output stream through its owned pipe,
counts launches, walker invocations and terminal outputs, waits for exit,
terminates the complete process tree and consumes the token on every success,
failure, timeout or crash. Any count other than one launch, one invocation and
one terminal output, or any fork, child, restart, re-entry or surviving process,
produces terminal `FAIL` and can never relaunch that slot. A crash or terminal
failure blocks that bundle context; recovery requires a newly certified
candidate context.

Only after the harness has signed a terminal-PASS WalkerOutputSpoolCommitment
may `WRITE_WALKER_OUTPUT` ingest the harness-captured neutral tree batches. It
gives the coordinator no candidate-selection boundary and then writes the only
`ReleaseBundleWalkerOutputAttestation(role)` permitted by the authoritative
output carrier's same unique key. Before accepting each batch or terminal output,
the canonical writer revalidates the claim's dynamic key, harness measurement,
certificate and attestation chain, token issuer and signed claims through the
exact frozen verifier and policy profile, revalidates the claim-selected
ROLE_LAUNCH proof against current status and expiry, then verifies the signed
spool commitment, complete transcript and token-consumption proof. Every batch
selects the exact commitment, one contiguous chunk interval, exact descriptors
and bytes, preceding and following chain boundaries and a fixed batch tuple.
The writer rehashes each chunk and cumulative stream; duplicate, missing,
reordered, substituted, cross-role or coordinator-selected subsets fail. It hashes
`RELEASE_BUNDLE_WALKER_OUTPUT/V5`, schema, bundle-context digest, exact
`OPEN` ReleaseBundleControlContext tuple, exact
independence-attestation ID and payload digest, role, exact run-slot and run-
claim IDs and payload digests, the role-mapped executable and configuration
digests, exact WalkerHarnessExecutionPolicy ID and payload digest and
`RELEASE_BUNDLE` profile digest, complete validated dynamic trust-chain and
token-claim digest, the same exact ROLE_LAUNCH WalkerTrustStatusProof ID and
payload digest, exact WalkerOutputSpoolCommitment ID and payload digest,
complete neutral logical and transport tree-root references, content
digests and counts, canonical input-snapshot digest, the complete canonical
launch, input, output and exit transcript digest, launch count, invocation
count, terminal-output count, fork, child, re-entry and restart counts, exit
status, process-tree-termination proof, token-consumption proof, harness-
attestation key ID and signature, and terminal `PASS` or `FAIL`. It hashes no
governed root-set ID. Byte-identical replay returns the existing attestation;
changed output conflicts. The attestation is legal only after every committed
chunk is present exactly once and writer-recomputed root, counts and stream
digest equal the signed commitment. Partial content-addressed nodes remain
inaccessible after a crash. Raw spool bytes are erased only after the terminal
`ReleaseBundleWalkerOutputAttestation` commits and its ordinary erasure receipt
is durable in `SUCCESS_AFTER_TERMINAL_OUTPUT` mode, or after the exact
`ReleaseBundleControlContext` is irreversibly
ABANDONED and `ABANDON_BUNDLE_CONTEXT` issues the corresponding
ReleaseBundleSpoolErasureReceipt in `FAILED_AFTER_ABANDONMENT` mode. A failed
walker, expired commitment or partial
ingest retains its inaccessible spool until that abandonment; only the signed
commitment, writer batch receipts and exact erasure receipt persist after
authorised erasure.

After all four slots are consumed and the SUCCESS_PRE_FINALISATION erasure set
has closed, `ReleaseBundleWalkerOutputSetAttestation`
enumerates the authoritative slot, claim and output carriers by bundle context
and hashes `RELEASE_BUNDLE_WALKER_OUTPUT_SET/V1`, schema, bundle-context digest,
the exact still-current `OPEN` ReleaseBundleControlContext tuple, exact
independence-attestation ID and payload digest, exact
ReleaseBundleWalkerSpoolCommitmentRoot ID and payload digest and the exact contract-ordered
`(role, run_slot_id, run_claim_id, output_attestation_id, payload_digest,
terminal_state)` set, cardinality four and fixed empty missing-slot, unclaimed,
missing-output, extra-claim, extra-output, duplicate, conflicting, wrong-role,
unselected-output and non-PASS roots and terminal `PASS` or `FAIL`. Only all
empty difference roots and four PASS outputs yield `PASS`. The corresponding role-bound governed
wrappers hash their output attestations. Both reconciliations and
ReleaseBundleEnvelope bind this exact terminal-PASS set attestation; selected
outputs cannot hide another persisted attempt.

`ReleaseBundleSpoolErasureReceiptSetAttestation` hashes
the one `RELEASE_BUNDLE_SPOOL_ERASURE_RECEIPT_SET_ATTESTATION/V1` identity
defined in the binding architecture above; Phase 9 supplies no alternate
formula. For this context that formula includes the exact context ID and mode-
required tuple, variant, independently derived target universe, ordered success
and failed partitions and every target's role, slot, claim, commitment or
partial-stream identity, terminal-output state, chunk and byte counts and
receipt ID and payload digest; cumulative chunks and bytes; the exact mode-
authority root, including the abandonment terminal, event, head and lifecycle
receipt for `ABANDONED_CONTEXT`; and every fixed empty difference root named in
that contract. The success variant requires
four PASS outputs and four success receipts and precedes, so cannot hash, the
later commitment root or output-set attestation. The abandoned variant accepts
only the exact partition of the abandonment terminal's present-target universe
between earlier success receipts and complementary post-abandonment failure
receipts, with unopened role slots proven absent. It is a structural control,
never a bundle member or release input.

After all four outputs, success erasure receipts, SUCCESS_PRE_FINALISATION
receipt-set attestation, commitment root and output set exist, the trust verifier
instantiates the sole `RELEASE_BUNDLE` arm of the authoritative `CONTEXT_SEAL`
identity above. It provides no alternate formula.
The four per-role output and erasure commits and the
`FINALISE_BUNDLE_CONTROLS/CONTROL_SET` commits are already durable prerequisites;
they are not replayed inside finalisation. `FINALISE_BUNDLE_CONTROLS/FINALISE_CONTEXT`
acquires shared locks over the exact
proof-bound trust, revocation and key-status heads, revalidates the proof under
those locks and the exact still-OPEN ReleaseBundleControlContext, locks and
proves the ReleaseBundleControlFailureEvidenceSlot still EMPTY, then atomically
stores the proof and envelope, appends CONTEXT_FINALISED, compare-and-swaps the
FINALISED context tuple and writes its receipt before releasing the locks at
commit. A
trust or revocation-head change after walker output therefore
invalidates finalisation even if every output byte is unchanged, and no change
can interleave between final validation and envelope commit.

After CandidateReleaseManifest exists, deterministic content-addressed
projection builders create domain-separated
`CandidateReleaseObjectProjectionRoot` and
`CandidateReleaseBlobProjectionRoot` trees under the frozen
CandidateReleaseObjectSetProjectionDefinition. Their IDs hash the exact manifest
ID and payload digest, projection-definition digest, fixed tree root, count and
empty differences. The object wrapper publishes
`candidate_release_object_neutral_content_digest` over the complete ordered
`(neutral_ownership_key, logical_type, schema_version, stable_id,
canonical_payload_digest)` tuples. The blob wrapper publishes
`candidate_release_blob_neutral_transport_digest` over complete ordered blob
identity, immutable generation, byte-length and content-digest tuples. Both
bundle enumerators independently publish the same two neutral digests and
counts from their `C` and `B` trees. ReleaseBundleMemberReconciliation requires
each enumerator's `C` and `B` neutral digest and count to equal the corresponding
candidate projection digest and count, with fixed empty differences. Wrapper
and tree IDs remain domain-separated and are never compared for byte equality.

CanonicalContractBundle also generates one closed ordered
`PromotionEvidenceSlotRegistry` with exactly ten entries and one permitted
object type and state for each: `CANDIDATE_MANIFEST`, `CANDIDATE_FREEZE`,
`FROZEN_TRANSITION`, `FROZEN_TRANSITION_RECEIPT`, `INPUT_RECHECK`,
`HELD_PROMOTION_FENCE`, `DEPLOYMENT_MANIFEST`, `POST_FREEZE_TRACE` and
`PRECUTOVER_CERTIFICATION`, plus `QUERY_GOLDEN_CERTIFICATION`. The last entry
must contain the exact canonical attestation bytes selected by
PreCutoverCertification, not a pointer-only wrapper or copied digest. A
fixed-size `PromotionEvidenceSlotRoot` hashes the registry ID, all ten
contract-ordered `(slot_code, object_id, canonical_payload_digest,
canonical_byte_length, content_digest)` entries, cardinality ten, exact-once proof and
`promotion_evidence_neutral_content_digest`. A missing, extra, duplicate,
wrong-type, wrong-state, stale-digest, relabelled or reordered slot fails. These
post-manifest structural controls never enter manifest identity. Both bundle
enumerators' `E` neutral content digests and counts must equal this slot root's
neutral digest and cardinality, with fixed empty differences, before
ReleaseBundleMemberReconciliation may pass.

Two independent support walkers also build separate bounded neutral trees and
role-bound governed `PromotionEvidenceSupportRootSet`s over every canonical trace-row payload,
coverage-projection payload, reconciliation, BoundedInventoryTree node and
other structural-control payload transitively required to verify any of the ten
evidence anchors but not already in `C`, `B` or `E`. This necessarily includes
the complete POST_FREEZE trace extension support closure. Each support row
hashes its type, stable ID, canonical payload digest, structural carrier path,
byte length and content digest. Each governed root set hashes
`PROMOTION_EVIDENCE_SUPPORT_ROOT_SET/V2`, schema, bundle-context digest, exact
role `SUPPORT_A` or `SUPPORT_B`, the matching
ReleaseBundleWalkerOutputAttestation and its neutral tree-root references,
digest and count. `PromotionEvidenceSupportReconciliation` hashes both root
sets, exact ReleaseBundleEnumeratorIndependenceAttestation, exact terminal-PASS
ReleaseBundleWalkerOutputSetAttestation, the two exact
distinct role-mapped output attestations, their common neutral support digest
and fixed empty missing, extra, duplicate, repeated-governed-root, repeated-run-
attestation, wrong-role, orphan-anchor, wrong-type, wrong-path and conflicting-
payload roots. The support trees, root sets and reconciliation exclude themselves. They
are structural bundle closure, not ReleaseBundleMembers, and import only under
the non-serving `STRUCTURAL_CONTROL` prefix of the promotion-evidence namespace.
The structural-layout contract assigns support payloads, tree nodes, root sets
and reconciliations, the independence attestation, all four role-bound run
claims, all four signed WalkerOutputSpoolCommitments, the exact ordered
ReleaseBundleWalkerSpoolCommitmentRoot, walker-output attestations and
output-set attestation only to
`controls/v1/<control_type_slug>/<stable_id_token>.<encoding_extension>`.
This prefix is disjoint from member paths. It uses the same lower-case ASCII,
relative POSIX, segment and total-length bounds and rejects absolute, dot,
backslash, control, NUL, Unicode, case, encoding and normalisation aliases.
Every structural path and `(control_type, stable_id)` is unique and no
structural path may collide with a member path.

The sole `bundle_digest` is
`H("RELEASE_BUNDLE_ENVELOPE/V5", schema, frozen contract pair, exact
CandidateReleaseManifest ID and payload digest,
CandidateReleaseFreezeAttestation, CandidateInputRecheckAttestation, held
CandidatePromotionFence version, FROZEN CandidateBuildTransition and receipt,
DeploymentManifest, exact POST_FREEZE TraceabilityExtension,
PreCutoverCertification, exact passing QueryGoldenCertificationAttestation ID,
payload digest, canonical byte length and content digest, exact `OPEN`
ReleaseBundleControlContext tuple and genesis event and receipt,
ReleaseBundleControlPolicy, exact WalkerHarnessExecutionPolicy ID and payload
digest and `RELEASE_BUNDLE` profile digest, disposition and logical-type
registry IDs, both ReleaseBundleMemberRootSet IDs and payload digests, common
neutral content digests, ReleaseBundleEnumeratorIndependenceAttestation, all
four exact one-use run slots and ReleaseBundleWalkerRunClaims, all four exact
role-bound WalkerOutputSpoolCommitments, exact
ReleaseBundleWalkerSpoolCommitmentRoot, all four exact role-bound
SUCCESS_AFTER_TERMINAL_OUTPUT ReleaseBundleSpoolErasureReceipts, all four exact role-bound
ReleaseBundleWalkerOutputAttestations, exact terminal-PASS
ReleaseBundleWalkerOutputSetAttestation,
exact SUCCESS_PRE_FINALISATION
ReleaseBundleSpoolErasureReceiptSetAttestation,
exact fresh bundle-context `CONTEXT_SEAL` WalkerTrustStatusProof ID and payload
digest,
ReleaseBundleMemberReconciliation,
CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot,
PromotionEvidenceSlotRegistry, PromotionEvidenceSlotRoot,
candidate-release-object, candidate-release-blob and promotion-evidence neutral
content digests, both PromotionEvidenceSupportRootSets, their common neutral
support digest, PromotionEvidenceSupportReconciliation and structural-layout-
contract digest, exact EMPTY ReleaseBundleControlFailureEvidenceSlot tuple,
fixed empty ReleaseBundleControlFailureEvidence, ReleaseBundlePartialStateTree,
ReleaseBundleControlAbandonmentTerminal and
AttemptAuditTerminal(RELEASE_BUNDLE_ABANDONED) presence roots)`. The envelope
and bundle-tree nodes are not members. Physical closure is exactly the envelope
file, every payload path named by a member-tree leaf, every support payload path
and every structural tree node reachable from the member and support roots,
every tree node reachable from the candidate object and blob projection
wrappers, plus every fixed structural-control payload named by the envelope,
including both member root sets, bundle-enumerator independence attestation,
all four bundle-walker run claims, all four signed role-bound
WalkerOutputSpoolCommitments, the exact ordered
ReleaseBundleWalkerSpoolCommitmentRoot, all four successful
ReleaseBundleSpoolErasureReceipts, the exact SUCCESS_PRE_FINALISATION
ReleaseBundleSpoolErasureReceiptSetAttestation and all four output attestations, the
bundle-walker output-set attestation, every selected WalkerTrustStatusProof, member
reconciliation, candidate
object and blob projection wrappers,
PromotionEvidenceSlotRegistry and root, both support root sets and their
reconciliation, the structural layout and registry payloads not already in
`C`, and, outside the envelope digest but required for an importable physical
bundle, the exact CONTEXT_FINALISED event, FINALISED
ReleaseBundleControlContext tuple and terminal ReleaseBundleControlReceipt.
An ABANDONED bundle instead retains its abandonment terminal, failure evidence,
every ReleaseBundleSpoolErasureReceipt, its ABANDONED_CONTEXT receipt-set
attestation and its AttemptAuditTerminal and is never importable. Each control
uses its generated structural path. No other file is permitted,
and no envelope, tree node or support control can include itself.

Membership includes every historical-governance and allowed-policy-chain
payload, OperationActionRegistry, CanonicalPhysicalCarrierRegistry,
CanonicalWriterDispositionRegistry, WalkerHarnessExecutionPolicy and both exact
profiles, CutoffPreparationKindRegistry,
CutoffPreparationWriteDispositionRegistry, every build transition and receipt,
CutoffPreparationMembership, preparation batch manifest, event, head-chain
tuple and receipt, both prepared
root sets, CutoffPreparedReconciliation, both complete control-receipt trees,
CutoffPreparationControlReceiptReconciliation, every BoundedInventoryTree node and
CutoffPreparationSeal selected through the frozen cutoff controls, every
semantic-stage and specialised legal root selected by
  CandidateReleaseManifest, including ImmutableSourceDocument and the original
  source package, SourceAdmissionPreparationReceipt,
  SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
  ReviewedInferencePayload, SemanticGraphNormaliserDefinition and
  ValidatedSemanticGraph,
  every OpenWorldSemanticCandidate and occurrence, both supersession kinds,
  every OpenWorldCandidateAdmissionTransition and transition-bound historical
  disposition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot,
  OpenWorldCandidateChainReconciliation, OpenWorldEvidenceClosure, complete
  primitive collection, final disposition and disposition manifest, both impact
  outputs, SemanticImpactEnumeratorIndependenceAttestation and
  SemanticImpactClosure, ApplicabilityEligibleMemberKindProducerRegistry/V3, every
  frozen-pair-independent requirement definition and metric-slot basis, exact
  scope-generation opening transition and receipt, every selected post-freeze
  local applicability requirement, then every registry-owned entry and slice
  and every ScopeSubjectApplicabilityRoot, both sealed
  release-input root sets and reconciliation, both complete candidate-wide
  applicability roots and every reachable node, their independence attestation,
  exact ApplicabilityReexaminationReconciliation,
  ApplicabilityReexaminationManifest, every
  MetricApplicabilityRequirementProjection entry, terminal projection set,
  CandidateInputSeal and exact
  empty OpenWorldReviewQueueRoot,
  every SourceAdmissionApprovalAttestation, Correction,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  ManifestMembershipRevision, CorrectionDischarge, CorrectionDischargeMap and
  MultiSubjectScopeCorrectionReceipt/V2,
CorpusScopeInventoryKindRegistry, both complete CorpusScopeInventoryRootSets,
their common neutral content digest, CorpusScopeInventoryReconciliation and
every BoundedInventoryTree node reachable from those roots,
CompositionContextKeyUniverseRoot, its neutral content digest and every tree
node reachable from it, CandidateCompositionImplementationCatalogueRoot, its
neutral catalogue digest and every catalogue and source-artefact tree node
reachable from its roots, both CompositionContractSetRecompositionRoots and
every tree node reachable from them,
CompositionContractSetEnumeratorIndependenceAttestation and
CompositionContractSetAttestation, CorpusReleaseInventoryKindRegistry, both complete CorpusRelease inventory root
sets and every BoundedInventoryTree node reachable from them,
CandidateOutputKindRegistry, CandidateOutputWriteDispositionRegistry,
every CandidateOutputMembership, CandidateOutputBatchManifest,
CandidateOutputPreparationEvent and CandidateOutputPreparationReceipt, complete
CandidateOutputPreparationHead chain, both CandidateOutputInventory root sets,
CandidateOutputInventoryReconciliation, every BoundedInventoryTree node
reachable from those root sets, both complete control-receipt trees,
CandidateOutputControlReceiptReconciliation,
ReviewedSourceSpecificOutputClosure selected directly by CandidateOutputSeal,
and CandidateOutputSeal,
ServingObjectAccessRegistry, OfflineCertificationArtefactDenylist,
ServingEmbeddedReferenceAllowlist and ServingExactDetailActionDefinition
payloads, every canonical, incomplete and reviewed-source-specific
SharedServingRow payload, every ServingExactDetailPayload including
`OPEN_WORLD_EVIDENCE`, ServingExactDetailReference and
parent-reference edge under the sealed output root sets, PreSealTraceabilityRoot,
CandidateManifestMemberRoot and all their structural tree nodes. The manifest
member tree expands ReviewedSourceSpecificOutputClosure exactly once as a named
control selected by CandidateOutputSeal; no output-kind root may include it.
It also expands all candidate payload files and
every separately named immutable artefact above. The envelope excludes its own
bytes, contains no future import or cutover artefact and cannot be appended to.
The importer independently regenerates the registry mapping, paths, comparator,
lengths, digests, both fixed member root sets, common neutral content digests,
physical closure and reconciliation. It rejects any missing, extra, duplicate,
aliased, misordered, wrong-destination or byte-mismatched payload or structural
node before canonical DML.

`DeploymentManifest` binds the same frozen contract pair, OperationalPolicySet
and certification-policy digests, git commit, dependency-lock and build digests, immutable Vercel
deployment ID, generated contract and schema digests, applied migration set,
database introspection digest, RPCs, functions, indexes and materialised views,
action-authorisation matrix, ServingObjectAccessRegistry,
OfflineCertificationArtefactDenylist and ServingEmbeddedReferenceAllowlist
digests and the exact `RouteBudgetManifest`,
`CapacityManifest`, `CacheBudgetManifest` and `ArchiveSafetyPolicyManifest`
constituents and payload digests,
feature-flag defaults, non-secret environment target and secret-reference
versions, and Supabase project, tier, region and pooler mode. Staging and
production differences require an explicit reviewed allowlist. Any unapproved
code, schema, RPC, index, configuration, flag or deployment change invalidates
certification.

Before candidate claim extraction, the CanonicalContractBundle fixes the
permitted policy schema and enums. One immutable
`CertificationPolicyManifest` references the exact frozen contract pair and OperationalPolicySet and
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

After those gates, Ben imports only the exact `ReleaseBundleEnvelope` whose
`bundle_context_digest` binds that exact `PreCutoverCertification` and whose
ReleaseBundleControlContext has the one exact FINALISED event, tuple and
terminal receipt. OPEN or ABANDONED context state, a missing receipt, a
different envelope, or any later lifecycle fork performs zero import DML.
The generated OperationActionRegistry and RPC dispatch for
`CERTIFIED_RELEASE_IMPORT_BATCH` contain exactly eight bounded top-level
actions: `OPEN_IMPORT`, `VERIFY_PRODUCTION_BLOB_AVAILABILITY`,
`IMPORT_MEMBER_BATCH`, `BUILD_IMPORT_PARITY_BATCH`,
`SEAL_IMPORT`, `BUILD_IMPORT_SEMANTIC_PARITY_BATCH`, `ATTEST_IMPORT` and
`ABANDON_IMPORT`. Their complete closed subgrammars are the sole permitted
dispatches below and must equal the CanonicalPhysicalCarrierRegistry,
CanonicalWriterDispositionRegistry and generated SQL projections exactly. They
operate with an append-only import head and
exact `OPEN -> SEALED -> ATTESTED` success path, separate `OPEN -> ABANDONED`
and `SEALED -> ABANDONED` failure paths and receipts. Member
batches route `C`, `B` and `E` only through
ReleaseBundleMemberDispositionRegistry into the inactive corpus-object,
inactive corpus-blob and immutable promotion-evidence namespaces respectively.
The importer performs no extraction, normalisation, correction replay or
semantic transformation. The QUERY_GOLDEN_CERTIFICATION slot is transported as
the exact attestation bytes, rehashed against its slot entry and independently
validated against the frozen query roots. It is not reconstructed from a
digest-only record. Serving roles have no promotion-evidence grant, including
for that slot and its support closure.
Immediately before import the importer locks authorisation,
IntakeProcessingPolicyHead, IntakeRevocationHead and the current held
CandidatePromotionFence in global order and requires the exact current
CandidateInputRecheckAttestation and
a fresh passing IntakeEligibilityRecheckAttestation.

An environment-global `ProductionImportControllerHead` carries a monotonic
attempt generation and exactly `IDLE` or `LEASED(import_generation,
ReleaseBundleEnvelope)`. A partial unique constraint permits only one OPEN or
SEALED import attempt in that environment. `OPEN_IMPORT` compare-and-swaps IDLE
to its new LEASED generation only after verifying that the selected envelope's
exact `bundle_context_digest` binds the supplied PreCutoverCertification ID and
payload digest and that every envelope certification reference matches that
same object. It independently verifies the exact ReleaseBundleControlPolicy,
FINALISED event, context tuple and receipt, complete finalised physical closure
and absence of any ReleaseBundleControlAbandonmentTerminal. It also verifies the
envelope's WalkerHarnessExecutionPolicy ID,
payload digest and both profile digests against the exact frozen contract. An
out-of-band envelope choice, reverse reference or mismatch
performs zero import DML. A stale or second open also performs zero import DML.
That controller CAS, genesis import event, OPEN ProductionImportHead,
reason-independent ProductionImportFailureEvidenceSlot in `EMPTY` and
OPEN_IMPORT receipt commit in one SERIALIZABLE transaction; failure leaves all
five unchanged. No later action may initialise or replace that slot.
ATTEST_IMPORT or ABANDON_IMPORT releases the exact lease to a higher IDLE
generation in the same terminal transaction. External fleet admission occurs
before this database lock and remains defence in depth.

`ProductionImportHead` is a singleton per `(production environment,
ReleaseBundleEnvelope, import generation)` and is exactly `OPEN`, `SEALED`,
`ATTESTED` or `ABANDONED`. `OPEN_IMPORT` creates the genesis event, head,
ProductionImportFailureEvidenceSlot at `EMPTY` and terminal receipt in one
SERIALIZABLE transaction. Its event binds the envelope,
three contract-derived destination namespaces, PreCutoverCertification,
POST_FREEZE TraceabilityExtension, authorisation, current rechecks, held fence
and importer contract.

For the lifecycle dispatch, CanonicalWriterDispositionRegistry assigns
`ServingNamespaceHeader` exclusively to `ATTEST_IMPORT/NONE/NONE` as
`NAMED_CONTROL(PRODUCTION_IMPORT_NAMESPACE)`. Its stable key is the exact
production environment, ReleaseBundleEnvelope ID and digest and import
generation; its payload extractor is the closed header formula below. The same
dispatch is the sole producer of ProductionImportAttestation, the ATTEST_IMPORT
event, ATTESTED head, released controller head and terminal lifecycle receipt.
The header and attestation use
`TERMINAL_LIFECYCLE_RECEIPT_BINDS_OUTPUT`, have no outbox and receive no serving
grant merely by being written. Every other action, phase, carrier or DML verb
for the header is `PROHIBITED`.

Before each `IMPORT_MEMBER_BATCH`, the importer creates
one bounded immutable `ProductionImportBatchManifest` hashing
`PRODUCTION_IMPORT_BATCH_MANIFEST/V2`, production environment, bundle ID and
digest, import generation, exact `batch_class`, batch ordinal and predecessor
checkpoint, complete ordered carrier keys and payload and content digests,
exact destination namespace and physical keys, row and byte counts and
importer-contract digest. `batch_class` is exactly `MEMBER` or
`SUPPORT_CONTROL` and is part of manifest identity, the event and the committed
result digest, but not the unique ordinal replay key. That key is exactly
`(production_environment, ReleaseBundleEnvelope ID, bundle_digest,
import_generation, batch_ordinal)`. A `MEMBER` manifest may contain only
`C`, `B` or `E` rows admitted by ReleaseBundleMemberDispositionRegistry and
writes only to their three unreachable destination namespaces. A
`SUPPORT_CONTROL` manifest may contain only payloads authenticated by the
reconciled PromotionEvidenceSupportRootSets and writes only under the
promotion-evidence `STRUCTURAL_CONTROL` prefix. Cross-class rows, a caller-
selected class or destination, or replay of an ordinal under a different class
is a conflict and writes nothing. The action appends one event that hashes that
manifest and exact before-head, compare-and-swaps the head and writes one
receipt hashing the event, exact before and after head tuples and committed
row/result digest, all in one SERIALIZABLE transaction. Exact byte-identical
replay returns that receipt; a conflicting ordinal, class, checkpoint, manifest
or result writes nothing. Its head chain therefore recursively authenticates
every completed member or support-control event, but not the later receipts.

`ProductionImportEnumeratorIndependenceAttestation` is a pre-output object. The
immutable control carrier permits exactly one for
`(production_environment, ReleaseBundleEnvelope ID, bundle_digest,
import_generation)`; byte-identical replay returns it and any different
replacement conflicts. It hashes
`PRODUCTION_IMPORT_ENUMERATOR_INDEPENDENCE/V2`, schema, that complete import
context, exact WalkerHarnessExecutionPolicy ID and payload digest, exact
`PRODUCTION_IMPORT` profile digest, the closed role registry `IMPORT_RECEIPT_A`,
`IMPORT_RECEIPT_B`, `IMPORT_MEMBER_EXPECTED`, `IMPORT_MEMBER_ACTUAL`,
`IMPORT_SUPPORT_EXPECTED` and `IMPORT_SUPPORT_ACTUAL`, each role's exact
executable and configuration, all six complete transitive dependency graphs,
the governed shared-primitive allowlist, fixed empty prohibited-code, query,
view, cache, intermediate-row and output intersections, validator evidence,
terminal `PASS` or `FAIL` and six contract-ordered one-use run slots. Each slot
ID hashes `PRODUCTION_IMPORT_WALKER_RUN_SLOT/V1`, schema, production
environment, bundle ID and digest, import generation, role and the role-mapped
executable and configuration digests, exact WalkerHarnessExecutionPolicy ID and
payload digest and `PRODUCTION_IMPORT` profile digest. The attestation hashes no produced tree,
run claim, walker-output attestation, governed root or reconciliation.

Before a walker starts, the import harness uses `BUILD_IMPORT_PARITY_BATCH`
with exact discriminator tuple `(CLAIM_WALKER_ROLE, role)` to atomically write one immutable
`ProductionImportWalkerRunClaim` under unique key `(production_environment,
ReleaseBundleEnvelope ID, bundle_digest, import_generation, role)`. Its ID
hashes `PRODUCTION_IMPORT_WALKER_RUN_CLAIM/V3`, schema, that complete key, exact
run-slot ID, independence-attestation ID and payload digest, input-snapshot,
executable and configuration digests, execution nonce, sandbox-policy digest,
exact frozen harness-policy and profile digests, harness measurement, harness-
attestation key ID, complete certificate and measurement-attestation chain IDs
and payload digests, token-issuer key and chain IDs and payload digests, exact
fresh `ROLE_LAUNCH` WalkerTrustStatusProof ID and payload digest, signed token
claims and the digest of a non-exportable one-use launch token. The
canonical writer verifies the complete dynamic key and measurement chain to the
frozen attestation roots, exact expected harness measurement, validity and
revocation state, revalidates the proof signature, current trust, revocation and
key-status heads and expiry, and verifies token signature, issuer, audience, import
context, role, lifetime and claim nonce against the frozen token-service
profile before committing. No token secret is persisted. A self-issued,
unknown, stale, revoked or policy-mismatched chain writes nothing. A second
claim fails.

The authenticated import harness, not walker code, is the output producer. Only
after the claim commits may it consume the claim-bound token to perform exactly
one fresh sandbox launch; no database lock remains held. The sandbox denies fork or clone, child execution,
same-process re-entry, supervisor restart, network and IPC access and persistent
state. The walker receives one read-only canonical input stream and has no
signing key, canonical-writer credential or output-carrier access. The harness
directly captures exactly one terminal output stream through its owned pipe,
counts launches, walker invocations and terminal outputs, waits for exit,
terminates the complete process tree and consumes the token on every success,
failure, timeout or crash. Any count other than one launch, one invocation and
one terminal output, or any fork, child, restart, re-entry or surviving process,
produces terminal `FAIL` and can never relaunch that slot. A crash or terminal
failure requires that import generation to be abandoned.

`BUILD_IMPORT_PARITY_BATCH` with exact discriminator tuple
`(WRITE_WALKER_OUTPUT, role)`
may begin only after the harness signs a terminal-PASS
WalkerOutputSpoolCommitment. It ingests the harness-captured neutral tree
batches without a coordinator-visible candidate-selection boundary, then writes
the only `ProductionImportWalkerOutputAttestation(role)`
permitted by the authoritative output carrier's same unique complete-context-
and-role key. Before accepting a batch or terminal output, the canonical writer
revalidates the claim's dynamic key, harness measurement, certificate and
attestation chain, token issuer and signed claims through the exact frozen
verifier and policy profile, revalidates the claim-selected ROLE_LAUNCH proof
against current status and expiry, then verifies the signed spool commitment,
complete transcript and token-consumption proof. Each batch selects one exact
contiguous chunk interval, descriptors and bytes, prior and following chain
boundaries and fixed tuple; the writer rehashes every chunk and cumulative
stream. It hashes `PRODUCTION_IMPORT_WALKER_OUTPUT/V5`, schema, production
environment, bundle ID and digest, import generation, exact independence-
attestation ID and payload digest, role, exact run-slot and run-claim IDs and
payload digests, the role-mapped executable and configuration digests, exact
WalkerHarnessExecutionPolicy ID and payload digest, `PRODUCTION_IMPORT` profile
digest, complete validated dynamic trust-chain and token-claim digest, the same
exact ROLE_LAUNCH WalkerTrustStatusProof ID and payload digest, exact
WalkerOutputSpoolCommitment ID and payload digest, typed role-output descriptor,
canonical input-snapshot digest, complete
canonical launch, input, output and exit transcript digest, launch count,
invocation count, terminal-output count, fork, child, re-entry and restart
counts, exit status, process-tree-termination proof, token-consumption proof,
harness-attestation key ID and signature, and terminal `PASS` or `FAIL`. A
receipt descriptor contains the fixed receipt-prefix context and neutral
receipt-tree reference, digest and count. A member descriptor contains the
contract-ordered neutral logical and transport tree references, digests and
counts for every destination and kind. A support descriptor contains the
neutral support-tree reference, digest and count. The attestation hashes no
governed root-set ID or reconciliation. Byte-identical replay returns the
existing output; changed output conflicts. The output is legal only after every
committed chunk is ingested exactly once and the writer-recomputed roots, counts
and full-stream digest equal the signed commitment. Duplicate, missing,
reordered, substituted, cross-role or subset ingestion fails. Partial nodes are
inaccessible after a crash. Raw spool bytes are erased only by the common
journal protocol and one `ProductionWalkerSpoolErasureReceipt`. For an import
role, `mode=IMPORT_SUCCESS` requires its terminal PASS
`ProductionImportWalkerOutputAttestation` and the exact still-OPEN import head;
for a semantic role, `mode=SEMANTIC_SUCCESS` requires its terminal PASS role
output and the exact SEALED import head; and
`mode=IMPORT_GENERATION_ABANDONED` requires the committed
ProductionImportAbandonmentTerminal, CONTEXT_ABANDONED event, ABANDONED head,
released-controller head and lifecycle receipt. A failed walker, expired
commitment or partial ingest retains its inaccessible spool until abandonment.
The receipt binds role, commitment or partial-stream identity, exact byte count
and digest, journal intent and completion records, prerequisite and erasure
evidence. A changed mode or second receipt for the same role and context
conflicts.

After all six slots are consumed and the IMPORT_SUCCESS erasure set has closed,
`ProductionImportWalkerOutputSetAttestation` enumerates the authoritative slot,
claim and output carriers by complete import context and hashes
`PRODUCTION_IMPORT_WALKER_OUTPUT_SET/V1`, schema, complete import context, exact
independence-attestation ID and payload digest, exact
ProductionImportWalkerSpoolCommitmentRoot ID and payload digest and contract-ordered
`(role, run_slot_id, run_claim_id, output_attestation_id,
payload_digest, terminal_state)` set, cardinality six and fixed empty missing-
slot, unclaimed, missing-output, extra-claim, extra-output, duplicate,
conflicting, wrong-role, unselected-output and non-PASS roots and terminal
`PASS` or `FAIL`. Only all empty difference roots and six PASS outputs yield
`PASS`. Every governed
root wrapper below hashes its matching output attestation, and every
reconciliation, ProductionImportSeal and ProductionImportAttestation bind the
exact terminal-PASS output-set attestation. A selected six-role subset cannot
hide another persisted attempt.

`ProductionWalkerSpoolErasureReceiptSetAttestation` hashes
the one `PRODUCTION_WALKER_SPOOL_ERASURE_RECEIPT_SET_ATTESTATION/V1` identity
defined in the binding architecture above; Phase 9 supplies no alternate
formula. For this import context that formula includes the mode-required head,
variant, exact target universe, ordered success and abandonment partitions and
every target's class, role, slot, claim, commitment or partial-stream identity,
terminal-output state, chunk and byte counts and receipt ID and payload digest;
cumulative chunks and bytes; the exact mode-authority root; and every fixed
empty difference root named in that contract. `IMPORT_SUCCESS` has exactly six import roles and
must close before, and cannot hash, ProductionImportWalkerSpoolCommitmentRoot,
the import output set or ProductionImportSeal. `SEMANTIC_SUCCESS` has exactly
three semantic roles and must close before, and cannot hash,
ProductionSemanticParitySpoolCommitmentRoot, the semantic terminal set or
ProductionSemanticParityAttestation. `IMPORT_GENERATION_ABANDONED` covers only
the abandonment terminal's independently inventoried present commitment or
partial-stream targets and partitions each between any durable success receipt
and one complementary post-abandonment failure receipt. Unopened roles are
proven absent and do not receive fabricated erasure receipts.

Immediately before `SEAL_IMPORT`, after all six IMPORT_SUCCESS erasure receipts
and their receipt-set attestation have committed, the trust verifier instantiates
the sole `PRODUCTION_IMPORT` arm of the authoritative `CONTEXT_SEAL` identity
above. It provides no alternate formula. `SEAL_IMPORT` revalidates the
proof while holding shared locks over the then-current trust, revocation and
key-status heads and stores it atomically with ProductionImportSeal and the
SEALED transition before releasing those locks at commit. A revocation between
output acceptance and sealing therefore blocks the generation, and a
revocation cannot interleave between the final proof validation and seal DML.

After import batches, a fixed `production_import_receipt_prefix_context` tuple captures the
exact still-OPEN import-head tuple and its complete genesis-through-import-batch event
set. Control walker A traverses that captured prefix and performs exact event-to-
receipt lookups. Dependency-disjoint walker B performs an independent physical
range scan of receipts keyed to `(production environment,
ReleaseBundleEnvelope, import_generation)` and independently selects exactly
the closed prefix actions `OPEN_IMPORT` and `IMPORT_MEMBER_BATCH` across both
batch classes, without using
the event chain or A's query, code or rows. Each first builds one bounded neutral
receipt tree under that exact prefix-context tuple and emits its role-bound
walker-output attestation. Its governed `ProductionImportControlReceiptRoot`
hashes `PRODUCTION_IMPORT_CONTROL_RECEIPT_ROOT/V2`, schema, production
environment, bundle ID and digest, import generation, exact role
`IMPORT_RECEIPT_A` or `IMPORT_RECEIPT_B`, matching
ProductionImportWalkerOutputAttestation, exact prefix-context tuple and neutral
tree-root reference, digest and count. Both neutral trees reconcile against the
exact captured event set. A prefix-action receipt outside the
captured chain, or a captured event without one receipt, fails. The later
SEAL_IMPORT and ATTEST_IMPORT event, head and receipt tuples are expressly
outside this prefix and are bound individually by ProductionImportAttestation,
POST_IMPORT traceability and cutover evidence; ABANDON_IMPORT can never enter a
passing chain.
`ProductionImportControlReceiptReconciliation` hashes both roots, exact
terminal-PASS ProductionImportEnumeratorIndependenceAttestation, exact terminal-
PASS ProductionImportWalkerOutputSetAttestation, their common
neutral receipt-set digest, the two exact distinct role-mapped output
attestations, exact prefix-context tuple and fixed empty missing, extra,
duplicate, orphan-event, wrong-before-or-after-head, repeated-governed-root,
repeated-run-attestation and wrong-role roots. These receipt trees are
structural controls and do not inventory themselves. Byte-equal neutral roots
are required, but supplying one governed wrapper, output attestation or
execution record twice cannot satisfy both roles. `BUILD_IMPORT_PARITY_BATCH` is a
`CONTENT_ADDRESSED_CONTROL_BUILDER` whose generated discriminator tuple is
exactly `(PRECOMMIT_WALKERS, NONE, NONE)`,
`(CLAIM_WALKER_ROLE, <required_import_role>, NONE)`,
`(WRITE_WALKER_OUTPUT, <required_import_role>,
SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE)`,
`(FINALISE_IMPORT_PARITY, NONE,
SPOOL_ERASURE_RECEIPT_SET|CONTROL_SET)` or
`(BUILD_PRESEAL_CONTROLS, NONE, TREE_BATCH|TERMINAL_ROOTS)`, where the role is
one of the six fixed import roles. Every complete permitted dispatch tuple has
execution class `CONTENT_ADDRESSED_CONTROL_BUILDER`. Its
CanonicalWriterDispositionRegistry projection
maps only import independence-attestation, run-claim, neutral inventory-node,
ROLE_LAUNCH WalkerTrustStatusProof, WalkerOutputSpoolCommitment, walker-output,
ProductionWalkerSpoolErasureReceipt,
ProductionImportWalkerSpoolCommitmentRoot, output-set,
ProductionWalkerSpoolErasureReceiptSetAttestation, receipt-root,
member-root, support-root and
reconciliation carriers, ProductionBlobAvailabilityRoot and its reachable tree
nodes and the importer CompositionContractSetRecompositionRoot and its reachable
tree nodes to `NAMED_CONTROL(PRODUCTION_IMPORT_PARITY)` with exact attestation,
claim, content-addressed batch-tuple, terminal-output, finalised-control-set and
terminal-roots receipt policies on their complete dispatch tuples and no
outbox; every other carrier, discriminator or write phase is
`PROHIBITED`. Receipt mapping is exactly precommit to
`ATTESTATION_IS_RECEIPT`, claim to `RUN_CLAIM_IS_RECEIPT`, either `TREE_BATCH`
phase to `CONTENT_ADDRESSED_BATCH_TUPLE_IS_RECEIPT`, walker
`SPOOL_COMMITMENT` to `SPOOL_COMMITMENT_IS_RECEIPT`, walker
`TERMINAL_OUTPUT` to `OUTPUT_ATTESTATION_IS_RECEIPT`, finalise parity to
the erasure-set attestation itself for `SPOOL_ERASURE_RECEIPT_SET` and
`FINALISED_CONTROL_SET_IS_RECEIPT` for `CONTROL_SET`, and pre-seal `TERMINAL_ROOTS` to
`TERMINAL_ROOT_SET_IS_RECEIPT`; `SUCCESS_SPOOL_ERASURE` uses the erasure
receipt itself. `PRECOMMIT_WALKERS` alone writes the independence attestation;
`CLAIM_WALKER_ROLE` alone atomically stores the supplied fresh ROLE_LAUNCH proof
with one run claim;
`WRITE_WALKER_OUTPUT` alone stores the signed terminal spool commitment, then
writes claimed neutral tree nodes, the terminal output attestation and, only
after that PASS output, its role-bound IMPORT_SUCCESS erasure receipt after
revalidating that proof; and
`FINALISE_IMPORT_PARITY` alone writes the exact ordered
six-role IMPORT_SUCCESS erasure-receipt set attestation, then
ProductionImportWalkerSpoolCommitmentRoot and output-set attestation, governed receipt,
member and support roots and all three reconciliations.
`BUILD_PRESEAL_CONTROLS` alone writes bounded content-addressed tree batches and
the terminal ProductionBlobAvailabilityRoot and importer
CompositionContractSetRecompositionRoot. It writes only the pre-output independence
attestation, one-use run claims, signed spool commitments, the fixed ordered
commitment root, independently derived tree nodes, walker-output and output-set
attestations, six import success erasure receipts and their set attestation,
import-parity roots, receipt roots and
reconciliations, production-blob availability and importer-composition
recomposition nodes and roots, returns their exact content-addressed tuple, and writes no
import event, import head, lifecycle receipt or outbox row.
`SEAL_IMPORT`, outside that no-receipt control builder, is the sole action that
may atomically store the fresh import CONTEXT_SEAL WalkerTrustStatusProof with
ProductionImportSeal, its lifecycle event, head transition and receipt.

The generated import writer registry separately admits only these closed
`BUILD_IMPORT_SEMANTIC_PARITY_BATCH` dispatches against the exact SEALED head:
`(PRECOMMIT_ROLES, NONE, NONE)`;
`(CLAIM_ROLE, <semantic_role>, NONE)` for one exact registered role;
`(WRITE_ROLE_OUTPUT, SEMANTIC_EXPECTED, SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE)`;
`(WRITE_ROLE_OUTPUT, SEMANTIC_PHYSICAL, SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE)`;
`(FINALISE_TWO_ROLE_SET, NONE, NONE)`;
`(WRITE_ROLE_OUTPUT, SEMANTIC_RECONCILER, SPOOL_COMMITMENT|TREE_BATCH|TERMINAL_OUTPUT|SUCCESS_SPOOL_ERASURE)`;
`(FINALISE_TERMINAL_SET, NONE,
SPOOL_ERASURE_RECEIPT_SET|CONTROL_SET)`; and
`(ATTEST_PARITY, NONE, TERMINAL_ATTESTATION)`. The role placeholder is closed
to `SEMANTIC_EXPECTED`, `SEMANTIC_PHYSICAL` and `SEMANTIC_RECONCILER`; a
wildcard, caller-defined role or phase is invalid. `PRECOMMIT_ROLES` alone may
write the ProductionSemanticParityEnumeratorIndependenceAttestation and its
three immutable run slots. `CLAIM_ROLE` alone may atomically store the supplied
fresh role-bound `ROLE_LAUNCH` WalkerTrustStatusProof with one corresponding
ProductionSemanticParityRunClaim. `WRITE_ROLE_OUTPUT` alone may store that
claim's signed terminal spool commitment, then write its neutral tree batches
and one terminal role-bound output attestation, and only after a PASS output may
write that role's `SEMANTIC_SUCCESS` ProductionWalkerSpoolErasureReceipt.
`FINALISE_TWO_ROLE_SET` alone may wrap the expected and physical neutral roots
and write their authoritative two-role output-set attestation.
`SEMANTIC_RECONCILER` cannot be claimed before that terminal two-role set;
its output phases alone may write comparison, root-pair and difference nodes
and its terminal output attestation. `FINALISE_TERMINAL_SET` alone may write the
exact three-role SEMANTIC_SUCCESS erasure-receipt set attestation, then the
ordered ProductionSemanticParitySpoolCommitmentRoot and authoritative
three-role terminal output-set attestation. `ATTEST_PARITY` alone
may atomically store the supplied fresh semantic-parity-context `CONTEXT_SEAL`
WalkerTrustStatusProof and one ProductionSemanticParityAttestation after
revalidating both under shared locks on the complete current trust-status-head
set. It requires all three SEMANTIC_SUCCESS erasure receipts and their terminal
receipt-set attestation before either proof or parity attestation may commit.

Every permitted dispatch is
`NAMED_CONTROL(PRODUCTION_IMPORT_SEMANTIC_PARITY)` and a
`CONTENT_ADDRESSED_CONTROL_BUILDER`. Its carrier set is exactly the
independence attestation, run slots, ROLE_LAUNCH and CONTEXT_SEAL proofs,
role-bound claims, signed WalkerOutputSpoolCommitments, neutral trees,
ProductionWalkerSpoolErasureReceipts,
ProductionSemanticParitySpoolCommitmentRoot,
ProductionWalkerSpoolErasureReceiptSetAttestation, role-output wrappers and attestations,
two-role and terminal output-set attestations, reconciler comparison and
difference nodes, the four parity root-pair kinds and terminal parity
attestation. Receipt mapping is exactly precommit to
`ATTESTATION_IS_RECEIPT`, claim to `RUN_CLAIM_IS_RECEIPT`, either `TREE_BATCH`
to `CONTENT_ADDRESSED_BATCH_TUPLE_IS_RECEIPT`, each `SPOOL_COMMITMENT` to
`SPOOL_COMMITMENT_IS_RECEIPT`, each `TERMINAL_OUTPUT` to
`OUTPUT_ATTESTATION_IS_RECEIPT`, `FINALISE_TWO_ROLE_SET` and
`FINALISE_TERMINAL_SET/CONTROL_SET` to
`FINALISED_CONTROL_SET_IS_RECEIPT`,
`FINALISE_TERMINAL_SET/SPOOL_ERASURE_RECEIPT_SET` to the erasure-set
attestation itself, and terminal attestation to
`TERMINAL_ATTESTATION_IS_RECEIPT`; each `SUCCESS_SPOOL_ERASURE` uses its
erasure receipt, with no outbox and no serving grant. Every
other carrier, discriminator, phase, head state or DML verb is `PROHIBITED`; no
phase writes an import event, import head or lifecycle receipt.

After all `MEMBER` and `SUPPORT_CONTROL` batches, `ProductionImportSeal` hashes
`PRODUCTION_IMPORT_SEAL/V4`, schema, production environment, frozen pair,
ReleaseBundleEnvelope ID and digest, its four exact role-bound
WalkerOutputSpoolCommitments, ReleaseBundleWalkerSpoolCommitmentRoot, all four
successful ReleaseBundleSpoolErasureReceipts and the exact
SUCCESS_PRE_FINALISATION ReleaseBundleSpoolErasureReceiptSetAttestation, exact
CONTEXT_FINALISED event, FINALISED ReleaseBundleControlContext tuple and receipt, exact
WalkerHarnessExecutionPolicy ID and
payload digest and `PRODUCTION_IMPORT` profile digest, exact still-`OPEN` import-head tuple,
exact LEASED ProductionImportControllerHead tuple,
exact EMPTY ProductionImportFailureEvidenceSlot tuple and fixed empty
ProductionImportFailureEvidence, ProductionImportPartialStateTree and
ProductionImportAbandonmentTerminal presence roots,
complete recursively authenticated import-event chain, exact terminal-PASS
ProductionImportEnumeratorIndependenceAttestation, all six exact precommitted
run slots and role-bound ProductionImportWalkerRunClaims, all six exact
role-bound WalkerOutputSpoolCommitments, exact
ProductionImportWalkerSpoolCommitmentRoot and all six exact role-bound
ProductionImportWalkerOutputAttestations, all six exact role-bound
`IMPORT_SUCCESS` ProductionWalkerSpoolErasureReceipts, exact terminal-PASS
ProductionImportWalkerOutputSetAttestation and exact `IMPORT_SUCCESS`
ProductionWalkerSpoolErasureReceiptSetAttestation, both
ProductionImportControlReceiptRoots, their common neutral digest and
ProductionImportControlReceiptReconciliation, all three destination namespace
IDs, both ProductionImportMemberRootSets, their neutral logical and transport
digests and terminal-PASS ProductionImportReconciliation, both bundle
PromotionEvidenceSupportRootSets and their reconciliation, both
ProductionImportSupportRootSets and terminal-PASS
ProductionImportSupportReconciliation,
ProductionBlobAvailabilityRoot,
CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot,
PromotionEvidenceSlotRoot, exact independently rebuilt importer
CompositionContractSetRecompositionRoot terminal `PASS`, every root-local
difference set empty and byte-equality to the certified
CompositionContractSetAttestation common digest, exact fresh import-context
`CONTEXT_SEAL` WalkerTrustStatusProof ID and payload digest, exact current CandidateInputRecheckAttestation,
fresh IntakeEligibilityRecheckAttestation, held CandidatePromotionFence version,
importer executable and configuration digests and terminal `PASS`. `SEAL_IMPORT`
appends an event naming that seal, compare-and-swaps the exact `OPEN` head to
`SEALED`, and only then writes its receipt naming both head tuples and the seal,
all in one SERIALIZABLE transaction.

For that immutable SEALED context,
`production_semantic_parity_terminal_slot_id` hashes
`PRODUCTION_SEMANTIC_PARITY_TERMINAL_SLOT/V1`, schema, production environment,
frozen pair, ReleaseBundleEnvelope ID and payload digest, import generation,
exact ProductionImportSeal ID and payload digest and exact SEALED head tuple.
`ProductionSemanticParityRoleRegistry` hashes
`PRODUCTION_SEMANTIC_PARITY_ROLE_REGISTRY/V1`, schema, registry key and version,
exact `PRODUCTION_IMPORT` harness-profile digest and exactly three role records:
`SEMANTIC_EXPECTED`, `SEMANTIC_PHYSICAL` and `SEMANTIC_RECONCILER`. Each record
fixes its executable and configuration digests, complete transitive dependency
graph, database role and read capability, input schema, output descriptor,
neutral-tree schema, limits and required run-slot ordinal. The expected role
may read the frozen contract and imported canonical owners, selected revisions,
closures, result lineage and registered source and semantic carriers required
to derive the canonical expected projection. It cannot read the inactive
serving projection, stored serving keys or payload digests, physical-role
intermediate rows or either other role's output. The physical role may read
only the registered inactive physical source, semantic and serving carriers
and frozen field-encoding, identity and comparison schemas. It reconstructs
values from physical columns and cannot read an expected root, expected value,
candidate inventory, copied candidate root, canonical expected-projection API
or expected-role output. The reconciler may read only the terminal two-role
output set, its contract-ordered neutral root descriptors and key-universe
descriptors and the frozen comparison schemas. It has no source-package,
canonical-owner, inactive-namespace or candidate-release read capability.
Serving, importer, coordinator and either producing role cannot assume the
reconciler role.

Before either producing role is claimed,
`ProductionSemanticParityEnumeratorIndependenceAttestation` hashes
`PRODUCTION_SEMANTIC_PARITY_ENUMERATOR_INDEPENDENCE/V1`, schema, complete
terminal-slot context, exact role-registry ID and payload digest, all three
role-mapped executable and configuration digests and transitive dependency
graphs, database grants and credential identities, the governed shared-
primitive allowlist, and fixed empty prohibited code, query, view, cache,
credential, intermediate-row, output and mutable-state intersections. The
shared allowlist is restricted to canonical JSON, hashing, neutral-tree framing
and frozen schema decoding; it excludes selection, derivation, comparison and
database-access logic. It also hashes exactly three contract-ordered one-use
`ProductionSemanticParityRunSlot`s and terminal `PASS` or `FAIL`, but no claim, produced tree, role
output, root pair or attestation. Each slot hashes
`PRODUCTION_SEMANTIC_PARITY_RUN_SLOT/V1`, schema, complete terminal-slot
context, role, mapped executable and configuration digests, exact role-registry
ID and payload digest, exact
WalkerHarnessExecutionPolicy and `PRODUCTION_IMPORT` profile digests and the
role ordinal.

One `ProductionSemanticParityRunClaim` per role hashes
`PRODUCTION_SEMANTIC_PARITY_RUN_CLAIM/V2`, schema, complete terminal-slot
context, exact role and run slot, role-registry and independence-attestation
IDs and payload digests, role-specific input-snapshot digest, mapped executable
and configuration digests, execution nonce, sandbox and frozen harness-profile
digests, dynamic harness measurement and trust-chain digests, exact fresh
role-bound `ROLE_LAUNCH` WalkerTrustStatusProof ID and payload digest, signed
one-use token claims and token-consumption contract. The unique key is
`(production_semantic_parity_terminal_slot_id, role)`. Exact replay returns the
same claim; a second claimant, changed role, executable, configuration, input,
profile, proof or payload conflicts and writes nothing. Expected and physical
claims require the passing independence attestation. The reconciler claim also
requires the exact terminal two-role output-set attestation and binds its ID and
payload digest. A crash, timeout, failed terminal output or consumed token
cannot be retried under that role slot and requires abandonment of the import
generation.

The authenticated harness, not role code or the coordinator, owns each output
pipe and enforces the same one-launch, one-invocation, one-terminal-output,
process-tree termination, transcript-signature and token-consumption contract
and bounded authenticated spool protocol as the import walkers. No role-output
batch may begin before its signed terminal-PASS WalkerOutputSpoolCommitment.
Every batch is a contiguous committed chunk interval, and terminal output is
legal only after writer-recomputed roots, counts and stream digest equal that
commitment. For `SEMANTIC_EXPECTED` and `SEMANTIC_PHYSICAL`, a
`ProductionSemanticParityWalkerOutputAttestation`
hashes `PRODUCTION_SEMANTIC_PARITY_WALKER_OUTPUT/V2`, schema, complete terminal-
slot context, role registry, independence attestation, exact role, slot, claim,
ROLE_LAUNCH proof and mapped executable and configuration, role-specific input
snapshot, exact WalkerOutputSpoolCommitment ID and payload digest, complete
signed launch, input, output and exit transcript digest,
process and token-consumption proofs, the complete contract-ordered neutral
tree-root descriptor and terminal `PASS` or `FAIL`. Expected and physical
descriptors cover the same complete key universes and categories: original
source-package integrity and immutable-source lineage; extraction-envelope and
graph validation; open-world audit and effective chain, including source-role
admission transitions and carried-forward dispositions; final-disposition and
empty-queue closure; impact-walker independence and closure; applicability-
reexamination universes and states; all three SharedServingRow variants;
OPEN_WORLD_EVIDENCE payload, reference and parent-edge closure; metric-
observation eligibility and typed exclusion; every market-observation
occurrence, serving key and canonical payload; every contract-declared
materialised cohort; and every materialised aggregate variant, group, serving
key, input-set digest, unrounded result and canonical payload; plus the complete
ServingContractMetadata key and canonical payload. Observation, cohort,
aggregate and serving-contract metadata are exactly four terminal parity
categories even though the execution registry retains exactly three roles. A
`ProductionSemanticParityRoleOutputRootSet` is a governed wrapper over one such
role's neutral roots, exact claim and output attestation. Domain-separated
wrappers differ; corresponding neutral root identities, schemas and key-
universe descriptors must be comparable.

After both producing roles terminate,
`ProductionSemanticParityTwoRoleOutputSetAttestation` hashes
`PRODUCTION_SEMANTIC_PARITY_TWO_ROLE_OUTPUT_SET/V1`, schema, complete terminal-
slot context, role registry, independence attestation, exactly the expected and
physical slots, claims, ROLE_LAUNCH proofs, output attestations and governed
root sets, cardinality two, and fixed empty missing-slot, unclaimed, missing-
output, extra-claim, extra-output, duplicate, conflicting, wrong-role,
unselected-output and non-PASS roots. Its `PASS` proves two complete distinct
role executions and a common declared comparison universe; it does not prove
semantic equality. Reusing one executable outside the shared allowlist, one
credential, query, cache, intermediate tree, claim, proof or output for both
roles fails the independence or output-set attestation even when bytes match.

Only then may `SEMANTIC_RECONCILER` consume the two neutral root descriptors,
complete key universes and frozen comparison schemas. It performs a bounded
merge over those authenticated trees, writes the category root pairs and all
difference trees and emits one
`ProductionSemanticParityReconcilerOutputAttestation`. That attestation hashes
`PRODUCTION_SEMANTIC_PARITY_RECONCILER_OUTPUT/V2`, schema, complete terminal-
slot context, exact two-role output set, reconciler slot, claim, ROLE_LAUNCH
proof, exact WalkerOutputSpoolCommitment ID and payload digest, input digest,
mapped executable and configuration, complete signed
transcript and process proofs, every produced root-pair and difference-root ID
and payload digest and terminal `PASS` or `FAIL`. It cannot query either source
universe while reconciling. Only after all three SEMANTIC_SUCCESS receipts and
their set attestation close may
`ProductionSemanticParityTerminalOutputSetAttestation` hash
`PRODUCTION_SEMANTIC_PARITY_TERMINAL_OUTPUT_SET/V1`, schema,
complete context, role registry, independence attestation, exact two-role set,
exact ProductionSemanticParitySpoolCommitmentRoot ID and payload digest, all
three distinct slots, claims, launch proofs and terminal outputs, the
reconciler input binding, cardinality three and fixed empty missing, extra,
duplicate, conflicting, wrong-order, wrong-role, unselected and non-PASS roots.
Only three PASS outputs and empty difference roots yield terminal `PASS`.

Immediately after that terminal set and all three SEMANTIC_SUCCESS erasure
receipts and their receipt-set attestation, the trust verifier instantiates the
sole `PRODUCTION_SEMANTIC_PARITY` arm of the authoritative `CONTEXT_SEAL`
identity above. It provides no alternate formula and does not and cannot bind the later
ProductionSemanticParityAttestation. `ATTEST_PARITY` revalidates this proof,
the terminal set and the semantic erasure set while holding shared locks over the complete current trust-
status-head set, then stores that proof and the terminal attestation atomically.
This order prevents a context-seal cycle and makes revocation linear with the
only parity attestation that can be selected by `ATTEST_IMPORT`.

`ProductionMarketObservationParityRootPair` hashes
`PRODUCTION_MARKET_OBSERVATION_PARITY_ROOT_PAIR/V2`, schema, exact terminal
slot, role registry, two-role output-set attestation and reconciler run claim,
expected and physical root references, content digests and counts and its
difference roots. Each neutral member is the
exact `(metric_observation_occurrence_id, market_observation_serving_key,
canonical_observation_payload_digest)` tuple. The expected walker derives it
from imported canonical owners, selected revisions, closures, result lineage,
MetricDefinition and eligibility state without reading a physical
`market_observation` row or copied candidate inventory. The physical walker
reconstructs canonical observation payload bytes from the inactive serving-
namespace columns and independently rehashes occurrence ID, serving key and
payload; stored key and digest columns are assertions, never derivation inputs.

`ProductionMaterialisedCohortParityRootPair` hashes
`PRODUCTION_MATERIALISED_COHORT_PARITY_ROOT_PAIR/V2` with the same terminal,
two-role-set and reconciler-claim context,
paired roots and differences. Each neutral member is the exact
`(materialised_aggregate_slot_digest, aggregate_variant_digest,
aggregate_group_digest, rederived_cohort_digest)` tuple. The expected walker
recalculates `MARKET_COHORT/V1` from the frozen canonical AST and all stated
identity inputs. The physical side must map each imported aggregate to exactly
one contract slot and compare its stored cohort assertion with that independently
derived value; a digest cannot authenticate itself.

`ProductionMarketAggregateParityRootPair` hashes
`PRODUCTION_MARKET_AGGREGATE_PARITY_ROOT_PAIR/V2` with the same terminal,
two-role-set and reconciler-claim context,
paired roots and differences. Each neutral member is the exact
`(materialised_aggregate_slot_digest, aggregate_serving_key, cohort_digest,
aggregate_input_set_digest, canonical_aggregate_payload_digest)` tuple. The
expected walker executes the frozen cohort set-wise over the expected
observation root, orders the exact observation-key and reconstructed-payload-
digest pairs, recomputes `MARKET_AGGREGATE_INPUT_SET/V1`, reruns the governed
algorithm over unrounded canonical values and reconstructs the complete
aggregate payload. The physical walker reconstructs payload bytes from imported
serving columns, independently executes the same cohort over its separately
rebuilt physical observation root and rehashes key, input-set and payload. Neither
walker reads a copied candidate aggregate root or trusts a stored derived
digest.

`ProductionServingContractMetadataParityRootPair` hashes
`PRODUCTION_SERVING_CONTRACT_METADATA_PARITY_ROOT_PAIR/V1`, schema, the same
terminal slot, role registry, two-role output-set and reconciler-claim context,
expected and physical neutral root references, content digests and counts and
fixed missing, extra, duplicate, wrong-key, wrong-field, wrong-payload and
forbidden-back-reference difference roots. Each neutral member is the exact
`(ServingContractMetadata stable ID, canonical payload digest)` tuple. The
expected role independently derives the complete payload from the frozen
contract, imported canonical definitions, generated access and denylist
registries, query definitions and golden-certification evidence, without
reading the inactive ServingContractMetadata row, stored key or stored digest.
The physical role reconstructs the same canonical payload only from the
inactive namespace's typed metadata columns and treats stored key and digest
columns as assertions. The reconciler receives only the two authenticated
neutral roots and frozen comparison schema and has no source, canonical-object
or inactive-namespace grant. The pair hashes the SEALED import context and
never ServingNamespaceHeader, ProductionSemanticParityAttestation or
ProductionImportAttestation. ServingNamespaceHeader is created later and may
therefore hash this already complete pair without a back-reference cycle.

The terminal `ProductionSemanticParityAttestation` hashes
`PRODUCTION_SEMANTIC_PARITY/V4`, schema, production environment, frozen pair,
ReleaseBundleEnvelope ID and digest, import generation, exact ProductionImportSeal
and SEALED head tuple, exact production-semantic-parity terminal slot and
ProductionSemanticParityRoleRegistry and
ProductionSemanticParityEnumeratorIndependenceAttestation IDs and payload
digests, all three contract-ordered run-slot, fresh ROLE_LAUNCH proof, run-claim
and signed WalkerOutputSpoolCommitment IDs and payload digests, exact
ProductionSemanticParitySpoolCommitmentRoot, all three role-output IDs and
payload digests, all three exact role-bound `SEMANTIC_SUCCESS`
ProductionWalkerSpoolErasureReceipts and exact `SEMANTIC_SUCCESS`
ProductionWalkerSpoolErasureReceiptSetAttestation, exact terminal-PASS two-role output-set,
reconciler-output and three-role terminal-output-set attestation IDs and payload
digests, exact fresh semantic-parity-context `CONTEXT_SEAL`
WalkerTrustStatusProof ID and payload digest, the
contract-ordered paired root references, content digests and counts for every
category above, including exact ProductionMarketObservationParityRootPair,
ProductionMaterialisedCohortParityRootPair and
ProductionMarketAggregateParityRootPair and
ProductionServingContractMetadataParityRootPair IDs and payload digests,
original
package byte/hash/file-type/converter checks,
expected-role independently recomputed and physical imported validation-report
digests, complete per-kind equality
and fixed empty missing, extra, duplicate, conflicting, wrong-lineage,
wrong-terminal-occurrence, invalid-admission-transition,
pre-admission-serving-row, duplicate-admitted-source-role-row,
non-empty-review-queue, impact-difference,
applicability-state, wrong-row-variant, orphan-evidence, observation-eligibility,
missing-observation, extra-observation, duplicate-observation-occurrence,
duplicate-observation-key, wrong-observation-key, wrong-observation-payload,
wrong-observation-lineage, unknown-aggregate-slot, duplicate-aggregate-slot,
wrong-cohort, wrong-variant, wrong-group, wrong-observation-membership, wrong-
aggregate-key, wrong-aggregate-input-set, wrong-subject-count, wrong-deal-count,
wrong-denominator, wrong-exclusion, wrong-algorithm-output, wrong-aggregate-
payload and wrong-serving-contract-metadata difference roots, and terminal
`PASS`. The terminal action may write
only the CONTEXT_SEAL proof and that attestation after every reachable bounded
node, authoritative output set, semantic success erasure receipt and its set
attestation exists. That proof is the sole authoritative
`PRODUCTION_SEMANTIC_PARITY` CONTEXT_SEAL arm defined above, not an alternate
formula. It hashes the terminal output set and semantic
erasure set and never the later attestation; the attestation hashes the proof, so neither
object is self-authenticating or cyclic.
`ATTEST_IMPORT` independently enumerates and rehashes the fixed role, claim,
output-set, root-pair and difference-root references, requires the same still-
SEALED head, exact unique terminal slot, three distinct one-use role claims and
outputs, fresh valid context seal, exact EMPTY
ProductionImportFailureEvidenceSlot and terminal `PASS`, and selects that slot's
exact one attestation ID and payload digest. A copied candidate root,
count-only comparison, shared expected and physical execution, a reconciler
with source access, competing role claim or unregistered parity carrier cannot
satisfy it.

The immutable ProductionImportAttestation is created only from that seal, exact
passing ProductionSemanticParityAttestation, `SEALED` head, `SEAL_IMPORT` event
and receipt, the exact ServingNamespaceHeader computed from the imported
namespaces and passing roots, all thirteen successful erasure receipts and
their three success receipt-set attestations, and independently enumerated
EMPTY ProductionImportFailureEvidenceSlot and absence of
ProductionImportFailureEvidence, ProductionImportPartialStateTree,
ProductionImportAbandonmentTerminal and the import attempt-audit terminal. In
one SERIALIZABLE `ATTEST_IMPORT` transaction,
the writer revalidates the unique semantic-parity terminal slot and all header
inputs, writes the ServingNamespaceHeader, writes the
ProductionImportAttestation that selects it, appends one event naming both,
compare-and-swaps the exact `SEALED` head to `ATTESTED`, releases the exact
controller lease to its higher IDLE generation and finally writes the terminal
receipt over every preceding output and before/after tuple. Failure at any point
rolls back all six effects. The header cannot hash the later attestation, and
the attestation cannot hash that later event, head, controller head or receipt;
CutoverAuthorisation and POST_IMPORT traceability must bind them beside it.
`ABANDON_IMPORT` is legal only from the exact `OPEN` or `SEALED` head and has
the closed ordered subphases `FAILURE_EVIDENCE`,
`PARTIAL_STATE_TREE_BATCH`, `ABANDON_CONTEXT`, `FAILED_SPOOL_ERASURE`,
`SPOOL_ERASURE_RECEIPT_SET`, `ATTEMPT_AUDIT_TREE_BATCH` and
`ATTEMPT_AUDIT_TERMINAL`. `FAILURE_EVIDENCE` first computes the exact pre-
evidence partial-state digest excluding itself and every later abandonment
control, locks the exact non-terminal import and leased controller heads and
reason-independent ProductionImportFailureEvidenceSlot, and atomically fixes
that slot and writes one typed `ProductionImportFailureEvidence`. SEAL_IMPORT
and ATTEST_IMPORT lock the same authorities and require the slot EMPTY.
`PARTIAL_STATE_TREE_BATCH` then closes the bounded inventory over all nine
import and semantic role slots, claims, proofs, commitments, partial streams,
neutral nodes, terminal outputs, that committed failure evidence, any already
durable IMPORT_SUCCESS or SEMANTIC_SUCCESS erasure receipts, parity controls,
namespaces and incomplete seal or attestation attempts. The evidence does not
hash that later tree. `ProductionImportAbandonmentTerminal` hashes
`PRODUCTION_IMPORT_ABANDONMENT_TERMINAL/V1`, schema, complete import context,
exact predecessor head, controller lease, exact FIXED
ProductionImportFailureEvidenceSlot tuple and exact
ProductionImportFailureEvidence ID and payload digest, complete bounded
inventory roots including the independently closed
`ProductionImportPartialStateTree`, all nine role dispositions and every
remaining erasure target.
It has a reason-independent unique key `(production_environment,
ReleaseBundleEnvelope ID, bundle_digest, import_generation)`.

The lifecycle transaction writes, in order, that terminal,
`ProductionImportEvent(CONTEXT_ABANDONED)`, the ABANDONED head, a higher IDLE
ProductionImportControllerHead releasing the exact lease and the terminal
lifecycle receipt over all before-and-after tuples. It performs no corpus-
serving mutation and forbids every later member, parity, seal, header,
attestation or success transition. Only after that receipt commits may the
writer erase every remaining inventoried spool through
`ProductionWalkerSpoolErasureReceipt(mode=IMPORT_GENERATION_ABANDONED)`. It
then writes one present-target
`ProductionWalkerSpoolErasureReceiptSetAttestation(mode=IMPORT_GENERATION_ABANDONED)`
whose membership is the exact disjoint partition of the terminal's inventoried
present commitments and partial streams between prior durable success receipts
and complementary post-abandonment failure receipts. Unopened role slots have
proof of absence and no erasure receipt. Mixed prior import or semantic
successes are valid; an overlap, omission or relabelling is not. It then closes
the bounded attempt-audit tree and finally
writes `AttemptAuditTerminal(variant=PRODUCTION_IMPORT_ABANDONED)`. Exact replay
returns the existing subphase receipts and terminal; a stale head, missing
receipt, duplicate generation, extra member after sealing, changed reason or
conflicting replay writes nothing and cannot attest.

Abandoned bundle construction and abandoned production import share one closed
operational attempt-audit contract. `AttemptAuditObjectRegistry` has exactly
two entries, `RELEASE_BUNDLE_ABANDONED` and
`PRODUCTION_IMPORT_ABANDONED`. `AttemptAuditTerminalSlot` hashes
`ATTEMPT_AUDIT_TERMINAL_SLOT/V1`, schema, exact registry entry, production
environment and the exact bundle-context digest or production-import context.
Variant is determined by that typed
context; failure reason, disposition, failure evidence and erasure outcome are
excluded from slot identity. Each context has one slot and at most one terminal.

For each variant, two bounded independent enumerators derive the complete
registry-required object universe and the complete canonical audit-row
projection. They close `AttemptAuditRequiredObjectRoot`,
`AttemptAuditCoverageProjectionRoot` and a bounded audit-row tree.
`AttemptAuditReconciliation` proves exact bidirectional coverage with fixed
empty missing, extra, duplicate, conflicting, wrong-context, wrong-variant,
uncovered-erasure, later-object and prohibited-authority roots. The release-
bundle variant requires the exact failure evidence and bounded inventory,
ReleaseBundleControlAbandonmentTerminal, CONTEXT_ABANDONED event, head and
lifecycle receipt, every role's success-or-failure erasure receipt partition
over the inventoried present-target universe and the ABANDONED_CONTEXT receipt-
set attestation. The production-import
variant requires the corresponding ProductionImportAbandonmentTerminal,
CONTEXT_ABANDONED event, ABANDONED head, released controller head and lifecycle
receipt, the exact present-target partition and the
IMPORT_GENERATION_ABANDONED set.
`AttemptAuditTerminal` uses the one `ATTEMPT_AUDIT_TERMINAL/V1` identity defined
in the binding architecture above; Phase 9 supplies no alternate formula. It
therefore hashes the exact slot and registry entry, source abandonment terminal,
terminal lifecycle receipt, erasure receipt-set attestation, required-object,
coverage-projection and audit-row roots and counts, reconciliation, closed
evidence-derived reason, canonical request digest, every fixed empty difference
root named in that contract and terminal `AUDIT_CLOSED`. It excludes its own ID
and every later object. The matching ABANDON action's
`ATTEMPT_AUDIT_TREE_BATCH` subphase alone writes the three kinds of bounded
content-addressed tree nodes. Its `ATTEMPT_AUDIT_TERMINAL` subphase alone writes
the required-object and coverage root wrappers and reconciliation, consumes the
slot and writes the terminal atomically.

Every slot, node, root, reconciliation and terminal is classified only as
`OPERATIONAL_AUDIT(ABANDONED_ATTEMPT)` in a physically separate audit carrier.
The CandidateManifestLaterObjectExclusionRegistry and every bundle/import
member registry classify them as later excluded structural audit objects;
OfflineCertificationArtefactDenylist and ServingObjectAccessRegistry deny them,
and the trace topology classifies them outside every passing trace phase. They
have no authority to create or satisfy a passing TraceabilityExtension,
`TraceabilityFailureTerminal` or `FailureTraceabilityTerminal`, release member,
corpus release, serving row, promotion fence, readiness, cutover, programme-
completion gate or terminal status. A passing bundle envelope or production
import attestation instead proves the applicable abandonment and attempt-audit
presence roots empty. The terminal is operational closure of discarded work,
not recovery or failure-trace authority.

Two independent physical member walkers that read neither copied bundle
membership nor each other's code or rows build fixed-fanout neutral logical and
transport trees for every registered destination and kind, including explicit
empty roots. `IMPORT_MEMBER_EXPECTED` reads bundle payload bytes and bundle-tree
paths. `IMPORT_MEMBER_ACTUAL` reads the three physical destination namespaces.
After each emits its role-bound output attestation, its governed
`ProductionImportMemberRootSet` hashes
`PRODUCTION_IMPORT_MEMBER_ROOT_SET/V2`, schema, production environment, bundle
ID and digest, import generation, exact role, matching
ProductionImportWalkerOutputAttestation, disposition and kind registries and
the fixed contract-ordered list of neutral logical and transport tree-root
references, digests and counts.

Separate independent support walkers rebuild the neutral expected support
closure from bundle bytes and the neutral actual support closure from the
promotion-evidence structural-control carrier. After each emits its role-bound
output attestation, its governed `ProductionImportSupportRootSet` hashes
`PRODUCTION_IMPORT_SUPPORT_ROOT_SET/V2`, schema, production environment, bundle
ID and digest, import generation, exact role `IMPORT_SUPPORT_EXPECTED` or
`IMPORT_SUPPORT_ACTUAL`, matching ProductionImportWalkerOutputAttestation and
the neutral support-tree reference, digest and count.

`ProductionImportSupportReconciliation` hashes both governed support root sets,
the exact terminal-PASS ProductionImportEnumeratorIndependenceAttestation, the
exact terminal-PASS ProductionImportWalkerOutputSetAttestation, the two exact
distinct role-mapped output attestations, their common neutral support
digest and count, equality of that digest and count to both bundle support
walkers' reconciled neutral digest and count, and fixed empty missing, extra,
duplicate, repeated-governed-root, repeated-run-attestation, wrong-role, orphan-
anchor, wrong-path and conflicting-payload roots. One
`ProductionImportReconciliation` hashes both governed member root sets, the
exact terminal-PASS ProductionImportEnumeratorIndependenceAttestation, the
exact terminal-PASS ProductionImportWalkerOutputSetAttestation, the two exact
distinct role-mapped output attestations, common neutral logical and
transport content digests, per-kind equality, union-equals-bundle proof, empty
pairwise neutral-ownership intersections and fixed empty missing, extra,
duplicate, conflicting-payload, wrong-destination, repeated-governed-root,
repeated-run-attestation and wrong-role roots. It requires both expected and
actual `C` neutral content digests to equal
`candidate_release_object_neutral_content_digest`, both `B` neutral transport
digests to equal `candidate_release_blob_neutral_transport_digest`, and both `E`
neutral content digests to equal `promotion_evidence_neutral_content_digest`.
Domain-separated governed wrapper IDs must differ; neutral tree identities,
digests and counts must equal. Reusing one governed wrapper, output attestation
or execution record for both roles fails even when the neutral roots correctly
match.

The expected and actual ProductionImportMemberRootSets cover exactly the three bundle
member universes `C union B union E`, including every explicit empty registered
kind, and nothing else. Their semantic object universe is therefore exactly the
CandidateReleaseManifest-expanded object projection, referenced immutable blob
projection and ten-slot promotion-evidence projection already defined by the
envelope. ReleaseBundleEnvelope, bundle and import trees and roots,
reconciliations, namespace headers, import manifests, events, heads, receipts,
seals, attestations, BlobAvailabilityReceipts, importer evidence and Ben apply
evidence are not member rows and cannot enter or self-authenticate those root
sets. The reconciled PromotionEvidenceSupportRootSets separately authenticate the structural
payloads required to verify the ten evidence anchors. A bounded
`ProductionBlobAvailabilityRoot` separately authenticates production
BlobAvailabilityReceipts for every imported `B` member with exact namespace,
content identity, generation, byte length and digest, plus fixed empty missing,
extra, duplicate and wrong-generation roots. ProductionImportSeal and
ProductionImportAttestation bind that root and all remaining fixed structural
controls directly or through their named bounded control roots.

The three destination namespace IDs are contract-derived, never caller chosen:
`H("PRODUCTION_IMPORT_NAMESPACE/V1", schema, production_environment_key,
ReleaseBundleEnvelope ID and digest, import_generation, destination_code)`, where
`destination_code` is exactly `CORPUS_OBJECT`, `CORPUS_BLOB` or
`PROMOTION_EVIDENCE`. `serving_namespace_id` is the `CORPUS_OBJECT` namespace
ID. The importer rejects an existing namespace, header or row unless the entire
immutable namespace payload is byte-identical for exact replay; a different
bundle or import generation cannot collide or mix rows with an earlier attempt.

Canonical objects use physical keys `(corpus_object_namespace_id, logical_type,
schema_version, stable_id)`. Serving rows retain their CorpusRelease-keyed
canonical serving keys but use `(serving_namespace_id, serving_object_kind,
canonical_serving_key)`. Blobs use `(corpus_blob_namespace_id, SourceContent ID,
immutable_carrier_generation_digest)`. The ten evidence members use
`(promotion_evidence_namespace_id, slot_code, logical_type, stable_id)`, and
evidence-support controls use the disjoint `STRUCTURAL_CONTROL` carrier prefix.
CanonicalPhysicalCarrierRegistry fixes the exact key schema for every carrier;
all physical primary, unique and foreign-key constraints include the applicable
namespace ID. A missing namespace field, cross-namespace foreign key or
unregistered key form is invalid. These are physical isolation keys, not
additional release authorities. An immutable
`ServingNamespaceHeader` hashes `IMPORTED_SERVING_NAMESPACE/V1`, schema,
environment, all three namespace IDs, import generation, manifest selector, CorpusRelease,
ServingContractMetadata ID and payload digest, exact
ProductionServingContractMetadataParityRootPair ID and payload digest and proof
that its expected and physical singleton both equal those header metadata
fields, CandidateOutputSeal, exact independently rederived
ReviewedSourceSpecificOutputClosure, candidate-
output neutral inventory digest, ReleaseBundleEnvelope digest, imported serving-
object and blob root digests and terminal `PASS`. It cannot hash the later
ProductionImportAttestation and deliberately does not hash the already complete
ProductionSemanticParityAttestation, preventing a reverse edge into the parity
chain. The semantic-parity attestation first binds the pair, the header then
binds that same pair, and ProductionImportAttestation finally binds the parity
attestation, pair and header in forward order.

`ProductionImportAttestation` hashes `PRODUCTION_IMPORT_ATTESTATION/V7`, schema,
production environment, frozen pair, ReleaseBundleEnvelope ID and digest,
exact FINALISED ReleaseBundleControlContext event, tuple and receipt,
all four envelope-authenticated role-bound WalkerOutputSpoolCommitments and
ReleaseBundleWalkerSpoolCommitmentRoot, all four successful
ReleaseBundleSpoolErasureReceipts and exact SUCCESS_PRE_FINALISATION
ReleaseBundleSpoolErasureReceiptSetAttestation,
exact WalkerHarnessExecutionPolicy ID and payload digest and
`PRODUCTION_IMPORT` profile digest,
disposition and kind registries, both bundle root sets and reconciliation,
CandidateReleaseObjectProjectionRoot, CandidateReleaseBlobProjectionRoot,
PromotionEvidenceSlotRegistry, PromotionEvidenceSlotRoot, both bundle
PromotionEvidenceSupportRootSets and PromotionEvidenceSupportReconciliation,
exact imported QUERY_GOLDEN_CERTIFICATION attestation bytes and zero-serving-
grant proof,
ProductionImportEnumeratorIndependenceAttestation,
all six exact one-use run slots and ProductionImportWalkerRunClaims, all six
exact role-bound WalkerOutputSpoolCommitments, exact
ProductionImportWalkerSpoolCommitmentRoot, all six exact role-bound
ProductionImportWalkerOutputAttestations, all six exact `IMPORT_SUCCESS`
ProductionWalkerSpoolErasureReceipts, exact terminal-PASS
ProductionImportWalkerOutputSetAttestation and exact `IMPORT_SUCCESS`
ProductionWalkerSpoolErasureReceiptSetAttestation,
exact fresh import-context `CONTEXT_SEAL` WalkerTrustStatusProof ID and payload
digest,
all three destination namespace IDs, both ProductionImportMemberRootSets and
ProductionImportReconciliation, both ProductionImportSupportRootSets and
ProductionImportSupportReconciliation, both
ProductionImportControlReceiptRoots and
ProductionImportControlReceiptReconciliation,
ProductionBlobAvailabilityRoot, every equality, difference and
disjointness root, exact production-semantic-parity terminal slot,
ProductionSemanticParityRoleRegistry and
ProductionSemanticParityEnumeratorIndependenceAttestation IDs and payload
digests, all three exact one-use run slots, fresh ROLE_LAUNCH proofs, role-bound
ProductionSemanticParityRunClaims, all three exact role-bound
WalkerOutputSpoolCommitments, exact
ProductionSemanticParitySpoolCommitmentRoot and
ProductionSemanticParityWalkerOutputAttestations, all three exact
`SEMANTIC_SUCCESS` ProductionWalkerSpoolErasureReceipts and exact
`SEMANTIC_SUCCESS` ProductionWalkerSpoolErasureReceiptSetAttestation, both governed expected and
physical ProductionSemanticParityRoleOutputRootSets, exact terminal-PASS
ProductionSemanticParityTwoRoleOutputSetAttestation,
ProductionSemanticParityReconcilerOutputAttestation and
ProductionSemanticParityTerminalOutputSetAttestation, exact fresh semantic-
parity CONTEXT_SEAL WalkerTrustStatusProof and
ProductionSemanticParityAttestation IDs and payload digests binding regenerated semantic-graph validation,
open-world audit/effective-chain, final-disposition, empty-queue, impact and
applicability-reexamination parity roots, exact three-variant SharedServingRow,
OPEN_WORLD_EVIDENCE, independently rederived
ReviewedSourceSpecificOutputClosure and market-observation eligibility or exclusion parity
roots, exact ProductionMarketObservationParityRootPair,
ProductionMaterialisedCohortParityRootPair and
ProductionMarketAggregateParityRootPair and
ProductionServingContractMetadataParityRootPair IDs and payload digests and every
observation-key, observation-payload, cohort, aggregate-key, aggregate-input-set
and aggregate-payload and serving-contract-metadata difference roots, exact
CompositionContractSet importer recomposition root and
equality to the candidate attestation, ProductionImportSeal, exact SEALED import-
head tuple, SEAL_IMPORT event and receipt, exact ServingNamespaceHeader ID and
payload digest, current intake and
candidate rechecks, held CandidatePromotionFence version, importer executable
and configuration digests, Ben apply evidence, exact EMPTY
ProductionImportFailureEvidenceSlot tuple and fixed empty
ProductionImportFailureEvidence, ProductionImportPartialStateTree,
ProductionImportAbandonmentTerminal and
AttemptAuditTerminal(PRODUCTION_IMPORT_ABANDONED) presence roots and terminal
`PASS`. Count-only,
key-only, display-value-only or copied-root parity cannot pass, and the active
release state must remain unchanged.

The `POST_IMPORT` TraceabilityExtension independently reconstructs the four
semantic-parity category identities and complete difference-root sets from the
terminal three-role output set. It must select
ProductionServingContractMetadataParityRootPair, prove its expected and
physical singleton equality to the exact ServingNamespaceHeader metadata
fields, and trace that pair, the other three pairs, all thirteen spool
commitments, all thirteen success erasure receipts, all three success receipt-
set attestations, all three spool roots, the applicability controls and projection
set, and ReviewedSourceSpecificOutputClosure. It receives no source or serving
grant and cannot reuse a copied ProductionImportAttestation list as its
enumeration input.

The importer independently regenerates both cutoff-preparation registries from
CanonicalContractBundle, then every fixed named cutoff root slot, prepared root
set and control-receipt tree and their reconciliations from imported immutable
intake and lifecycle objects. It independently regenerates every
CorpusReleaseInventoryKindRegistry entry, tree node, kind root, root set and
reconciliation from the imported sealed input. It likewise regenerates every
CandidateOutputKindRegistry and
CandidateOutputWriteDispositionRegistry entry, member key and canonical payload
digest, deterministic shard, internal-node and kind-root content digest, both
root-set identities, both output control-receipt trees and reconciliations and
the common neutral content digest from the imported inactive namespace and
bundle, including the explicit empty roots. It independently verifies the exact
original source-package bytes, length, file type, package hash, immutable-source
identity, converter provenance and canonical source map, then revalidates the
SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
ReviewedInferencePayload, SemanticGraphNormaliserDefinition,
ValidatedSemanticGraph and validation report. It reproduces the graph only by
running the frozen deterministic normaliser over the imported exact envelope
and reviewed payload bytes. It cannot invoke a model, create a replacement
transcript or adjudicate a different payload;
rebuilds the complete open-world candidate audit chain, every source-role
admission transition, effective-terminal occurrence root and reconciliation;
proves the final-disposition partition, exact carried-forward disposition-body
equality and exact empty review queue over that effective root; recomputes both
semantic-impact walkers, their independence attestation and closure; verifies
the frozen-pair-independent requirement definitions and metric-slot bases; then
reconstructs, in the universal order, the sealed release-input roots and
reconciliation, both complete applicability roots and every node, independence
attestation, reconciliation, manifest, every projection entry, projection set
and CandidateInputSeal. It rejects any reverse edge or object appearing before
its predecessor. It then rederives every canonical, incomplete and
reviewed-source-specific row,
including exactly one admitted source-role row and zero pre-admission rows per
transitioned source-role candidate,
every response-safe `OPEN_WORLD_EVIDENCE` payload, reference and parent edge,
and independently reconstructs ReviewedSourceSpecificOutputClosure exactly once
from the occurrence-to-row bijection and four empty anti-joins, without a
serving grant. It then rederives each metric-slot eligibility or typed exclusion,
proving source-specific and
incomplete rows have zero observations and observations exist only for
`COMPLETE` plus `COMPARABLE` owners. From those independently rederived owners
and slots it reconstructs every expected metric-observation occurrence ID,
market-observation serving key and canonical payload. For every frozen
materialised-aggregate slot it independently recomputes variant, group and
cohort digests, executes the cohort set-wise over that expected observation
universe, derives the exact ordered contributing key-and-payload set and input-
set digest, reruns the governed algorithm and reconstructs aggregate serving key
and canonical payload. The expected role also derives ServingContractMetadata
from the frozen contract and imported canonical inputs. Separate physical
walkers reconstruct observations, aggregates and metadata from inactive typed
columns rather than trusting stored derived digests. The source-free reconciler
requires all four paired roots and difference sets to be empty. It also
regenerates every exact-
detail selection path and parent-reference edge from imported parent rows,
selected canonical objects and action definitions, and independently builds a
new CompositionContractSetRecompositionRoot directly from imported certified
composition objects before comparing its neutral digest to the candidate
CompositionContractSetAttestation. Every physical candidate-output lookup is
qualified by the new serving namespace. Copied inventory, control-receipt,
composition-set, reference or parent-edge rows cannot prove parity. Any missing,
extra, duplicate, conflicting, orphan, stale-manifest, wrong-destination or
wrong-parent member found by the pre-seal controls blocks ProductionImportSeal.
A source, semantic or serving mismatch found by the post-seal semantic-parity
builder leaves the existing seal inert, blocks ProductionSemanticParityAttestation
and ProductionImportAttestation and requires correction in a new import
generation or abandonment of this one.

Cutover has a separate executable readiness linearisation point. The canonical
release-state tuple hashes `CANONICAL_RELEASE_STATE/V3`, schema, one closed
variant tag, the complete variant payload, common provider deployment identity,
runtime-build and runtime-configuration digests, production alias or traffic
generation, database-schema and migration generations, `exposure_enabled` and
release-state generation. `CANONICAL_RELEASE` carries exact active
CandidateReleaseManifest ID and payload digest, CorpusRelease ID, serving-
namespace ID and header digest, ServingContractMetadata ID and payload digest,
ProductionImportAttestation ID and payload digest and DeploymentManifest ID and
payload digest, and carries an explicit forbidden-legacy-target marker.
`LEGACY_BASELINE` instead carries one exact LegacyBaselineRollbackTarget ID and
payload digest, its legacy dataset or release selector, serving contract and
health-policy digests and explicit forbidden markers for every canonical-
release field. A null tag, mixed payload, inferred default or third variant is
invalid. In the canonical variant, CandidateReleaseManifest is the sole active
output authority; CorpusRelease remains separate immutable input lineage and
serving namespace is only physical isolation. No transition may update or
restore only a subset or infer a committed field later from mutable provider
state.

Before the first canonical activation, the deployment controller captures one
immutable `LegacyBaselineRollbackTarget` for the current production system. Its
ID hashes `LEGACY_BASELINE_ROLLBACK_TARGET/V1`, schema, production environment,
capture cutoff and independent provider and database assertions, exact legacy
deployment, build, non-secret configuration references, alias or traffic,
schema and migration generations, dataset or release selector, serving and
authentication contract digests, health and smoke policy, content-addressed
deployment and restoration inputs, retention proof, restoration executable and
configuration digests and a domain-separated `LegacyBaselineStatePayload`
containing every legacy variant and common tuple field except the target's own
ID and release-state generation. The initial `LEGACY_BASELINE` V3 tuple then
binds that completed target and the byte-equal state payload, avoiding a digest
cycle. Secret values are neither captured nor hashed. The target is one-time
per production environment, immutable and usable only while the first-
canonical-cutover head has not reached `CANONICAL_ESTABLISHED`.

That target is eligible only after a passing
`LegacyBaselineRollbackRehearsalAttestation` created in the isolated staging
environment. It hashes the exact target, production-snapshot lineage with
non-production credentials, staging provider and database parity proofs, the
same restoration executable and configuration, a forced canonical-like
activation failure, exact BLOCKED-to-legacy restoration sequence, resulting
variant-matching tuple, `READY_LEGACY_BASELINE` fence, complete legacy smoke and
render checks, measured restore time against a fixed budget, fault-injection
results, created-at evidence, expiry and terminal `PASS`. It cannot be produced
by a production run, by a rehearsal against production or by comparing only
counts or health status.

One signed singleton `CanonicalCutoverGenesisHead` governs only the transition
from legacy production to the first successful canonical release. Its closed
states are `READY_LEGACY_BASELINE`, `FIRST_CANONICAL_IN_PROGRESS` and terminal
`CANONICAL_ESTABLISHED`. Each CAS appends one immutable
`CanonicalCutoverGenesisEvent` hashing schema, production environment,
contiguous generation, predecessor head digest, exact target and current
unexpired rehearsal, attempt ID, before and after states and the complete
  transition evidence. Initialisation first installs a signed `BLOCKED` serving-
  fence genesis, blocks and drains legacy admissions; one serialisable
  transaction then installs the exact target-bound V3
  `LEGACY_BASELINE` tuple, appends `REGISTER_LEGACY_BASELINE` and installs the
  head at `READY_LEGACY_BASELINE`. Only after commit may the controller publish
  the exact `READY_LEGACY_BASELINE` fence over that event and head. Beginning an attempt moves
`READY_LEGACY_BASELINE` to `FIRST_CANONICAL_IN_PROGRESS` in the same database
transaction that activates the first canonical tuple. Passing canonical smoke
is necessary but not sufficient: only the same transaction that consumes the
one-use PostActivationPassCommitLease and fixes the exact control head at
`PASS_FIXED` CASes that in-progress attempt to `CANONICAL_ESTABLISHED`, after
which the legacy target has no cutover or exposure authority. Any typed post-
activation failure follows exactly one registered containment order below and
reaches `FAILURE_FIXED` only through `COMPLETE_FAILURE_CONTAINMENT`. A passing legacy restoration then returns the
same head to `READY_LEGACY_BASELINE` at a higher generation only after its
post-commit READY and smoke controller reaches `LEGACY_READY_FIXED`, allowing a
later new candidate attempt without rewriting the target or the failed branch. A
stale attempt, missing event, fork, skipped generation or transition from
`CANONICAL_ESTABLISHED` writes nothing.

Genesis events never hash their successor head or a later ActivationEvent. The
begin-attempt event hashes the consumed CutoverAuthorisation, proposed canonical
tuple and exact pre-transition heads; the successor head hashes that event, and
the later ActivationEvent hashes both genesis-head tuples and the event. A
restoration event similarly hashes the already complete
LegacyBaselineRestorationAttestation, the locked predecessor
LegacyBaselineRestorationReceiptHead tuple and writer-derived attempt ordinal.
The resulting receipt hashes that event and the successor head; neither event
nor successor head hashes the receipt. This fixes one acyclic order for every
head transition.

On a first-attempt `FAILURE_FIXED`, restoration is permitted only while the
serving fence is BLOCKED, the failed canonical V3 tuple is exposure-off and the
same FailureRecoveryBranch head remains OPEN. The restoration writer retains
exactly two attempt actions, `COMMIT_PASS` and `RECORD_FAIL`. Both lock the
branch, restoration-receipt-chain tip, genesis head and release state in their
GeneratedLockPlan, derive the next contiguous attempt ordinal inside the
writer, and create one `LegacyBaselineRestorationReceipt` over that ordinal and
predecessor receipt. The caller cannot provide or reserve an ordinal.

`COMMIT_PASS` accepts only a complete PASS
LegacyBaselineRestorationAttestation. Before its transaction, the controller
restores and independently verifies the external deployment, runtime,
configuration, alias, schema and migration while the fence remains BLOCKED.
The serialisable transaction revalidates fresh provider assertions, persists
the attestation, restores every governed database selector and the complete
target-bound `LEGACY_BASELINE` tuple at a higher generation, appends
`RESTORE_LEGACY_BASELINE`, writes its LegacyBaselineRestorationReceipt and
atomically opens one `LegacyBaselineRestorationPostCommitContext` with
`LegacyBaselineRestorationPostCommitHead(AWAITING_READY_LEGACY)`, genesis event
and action receipt. It does not return CanonicalCutoverGenesisHead to
READY_LEGACY_BASELINE or fix the recovery branch. The context hashes the exact
branch and head, target, rehearsal, COMMIT_PASS attestation and receipt,
restored tuple, acknowledged BLOCKED fence, generated lock plans and immutable
READY publication, legacy smoke, abandonment-containment and terminal
deadlines. No deadline is caller supplied or extendable.

The post-commit head states are exactly `AWAITING_READY_LEGACY`,
`AWAITING_LEGACY_SMOKE`, `ABANDONMENT_PENDING`, terminal
`LEGACY_READY_FIXED` and terminal `LEGACY_ABANDONED_FIXED`. After COMMIT_PASS,
the external controller may publish only the exact target-bound
READY_LEGACY_BASELINE fence before the fixed READY deadline. The generated
`ADOPT_READY_LEGACY` action validates that fence and CASes
AWAITING_READY_LEGACY to AWAITING_LEGACY_SMOKE. One source-backed passing legacy
smoke permits `ADOPT_LEGACY_SMOKE_AND_FIX` to win a serialisable CAS from
AWAITING_LEGACY_SMOKE to LEGACY_READY_FIXED; the same transaction first writes
the success event, terminal post-commit head and action receipt, then appends
the genesis return event, CASes CanonicalCutoverGenesisHead to
READY_LEGACY_BASELINE and finally fixes the branch at
NO_HISTORICAL_REACTIVATION. The later genesis and branch objects select the
already complete receipt, which hashes neither. Only this complete terminal state is
`LEGACY_RESTORED`. A new first-canonical attempt requires the exact
LEGACY_READY_FIXED head and receipt, fixed branch outcome, returned genesis
head, matching READY_LEGACY_BASELINE fence and passing legacy smoke. COMMIT_PASS
alone grants none of those authorities.

The closed post-commit failure union has exactly six variants:
`LEGACY_READY_PUBLICATION_FAIL`, `LEGACY_READY_PUBLICATION_TIMEOUT`,
`LEGACY_SMOKE_FAIL`, `LEGACY_SMOKE_TIMEOUT`, `LEGACY_SMOKE_CRASH` and
`LEGACY_ACTIVE_RELEASE_REVOCATION`. A trusted deadline closes a controller
crash. The revocation variant binds the exact registered cause, acknowledged
ordinary BLOCKED fence and drain, ordinary RollbackEvent and receipt, observed
awaiting legacy head and higher exposure-off tuple.
`BEGIN_POST_COMMIT_ABANDONMENT` first locks the exact non-terminal
post-commit head and current release tuple, derives the exact
`ContainmentReleaseTupleDisposition` and compare-and-swaps the head to
ABANDONMENT_PENDING. Under `CONTAINMENT_OWNS_FENCE`, that CAS competes with
ADOPT_LEGACY_SMOKE_AND_FIX and makes the database serving path non-admitting
before the controller publishes a higher BLOCKED fence and drains legacy leases
without a database lock. Under
`ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, the registered revocation has already
completed those external controls and its ordinary transaction atomically
writes the exposure-off event and receipt, legacy revocation evidence, adopted
disposition and BEGIN event, pending head and receipt; it performs no second
fence, drain or release-state change. `COMPLETE_POST_COMMIT_ABANDONMENT` is legal only from that
pending head and revalidates the exact BLOCKED acknowledgement, drain evidence,
locked tuple disposition and current tuple. Its serialisable transaction
either performs the owned exact higher exposure-off CAS and writes its
containment RollbackEvent, or preserves and selects the disposition's already
complete ordinary-revocation tuple, event and receipt, then writes the
completion event, terminal LEGACY_ABANDONED_FIXED head and action
receipt, then writes LegacyBaselineRestorationAbandonmentDecision/V2 with
`subvariant=POST_COMMIT_PASS_FAILURE` and finally fixes the branch outcome, in
that order. The decision selects the receipt and head; the branch outcome
selects the decision; neither is hashed backwards. Completion after the fixed
containment deadline remains mandatory and additionally binds trusted
CONTAINMENT_DEADLINE_EXCEEDED evidence. A failed containment-owned external block leaves the
database path non-admitting and the head pending; retry may complete only the
same trigger, predecessor, tuple disposition, fence and drain scope, even after
the deadline.

`RECORD_FAIL` accepts only typed pre-commit FAIL evidence and advances only the
restoration receipt chain. It performs no release-state, genesis-head,
post-commit, promotion, readiness or serving-fence transition. After at least
one RECORD_FAIL and before any COMMIT_PASS, abandonment uses
LegacyBaselineRestorationAbandonmentDecision/V2 with
`subvariant=PRE_COMMIT_FAILURE`, the complete failed-receipt root and exact
absence of a post-commit context. The PRE_COMMIT_FAILURE and
POST_COMMIT_PASS_FAILURE payloads have disjoint required and forbidden fields;
neither can masquerade as the other. Both require governed rationale,
decision-maker evidence, the acknowledged BLOCKED fence and exposure-off tuple
and fix `LEGACY_RESTORATION_ABANDONED`. `LEGACY_RESTORED` requires
LEGACY_READY_FIXED; `LEGACY_RESTORATION_ABANDONED` accepts exactly one of the
two decision subvariants. Exact action replay returns the original event, head
and receipt under `(post_commit_context, action, predecessor_head)`; changed
evidence conflicts. `LegacyBaselineRestorationPostCommitPolicy` has exactly the
five actions `OPEN_WITH_RESTORATION_PASS`, `ADOPT_READY_LEGACY`,
`ADOPT_LEGACY_SMOKE_AND_FIX`, `BEGIN_POST_COMMIT_ABANDONMENT` and
`COMPLETE_POST_COMMIT_ABANDONMENT`; COMMIT_PASS is the sole caller of the first
and no sixth action or direct transition exists. Historical recovery uses the
separate closed variants `HISTORICAL_ABANDONED_PRE_ACTIVATION`,
`HISTORICAL_FAILED_AFTER_ACTIVATION` and `HISTORICAL_SUCCEEDED`; a
pre-activation abandonment requires absence of ActivationEvent, while a
post-activation failure requires the historical PostActivationFailureEvidence
and second containment. No variant can be inferred from a generic reason or a
mandatory failed smoke. This one-time legacy path is unavailable after
CANONICAL_ESTABLISHED; later failures use historical reactivation.

A signed singleton `DeploymentReadinessMirror` stores `CUTOVER_READY`,
`ACTIVATION_READY` or `REVOKED`, a monotonic readiness generation, predecessor
mirror digest or explicit genesis marker, exact current programme-status
artefact digest and generation,
the mechanically evaluated work-class disposition, frozen contract pair,
CandidateReleaseManifest ID and payload digest, CorpusRelease, serving-
namespace ID and header digest, ServingContractMetadata ID and payload digest,
ProductionImportAttestation ID and payload digest, exact terminal ATTESTED ProductionImportHead,
ATTEST_IMPORT event and receipt, exact released IDLE
ProductionImportControllerHead tuple, DeploymentManifest and current
CandidateReleaseFreezeAttestation, exact PromotionEligibilityProof and its
variant-selected CandidateInputRecheckAttestation or
HistoricalReactivationEligibilityAttestation, held CandidatePromotionFence
version, closed first-cutover-or-established-canonical marker and exact
CanonicalCutoverGenesisHead, plus LegacyBaselineRollbackTarget and current
rehearsal only for the first-cutover variant, current target-release
IntakeEligibilityRecheckAttestation ID,
exact IntakeProcessingPolicyHead and activation and observed IntakeRevocationHead,
provider-signed
immutable Vercel deployment identity, runtime-build and non-secret
configuration-reference digests, production alias or traffic generation and
database schema and migration generations, exact expected current
release-state tuple and digest and exact proposed after-tuple digest. It is an operational replica, never
a second gate authority. Only the status-and-deployment validator may replace
it, and every replacement is signed and append-only audited.
Each readiness-mirror digest hashes its schema, complete fields above,
predecessor or genesis marker, validator identity and, for `REVOKED`, exact
revocation reason plus prepared successor-status digest or
DeploymentChangeIntent ID. A historical CUTOVER_READY successor additionally
hashes the exact RollbackEvent and HistoricalReactivationEligibilityAttestation.
The validator signature covers that digest. Missing,
duplicate-generation, forked or unverifiable versions are `REVOKED`.
Before issuing any `CUTOVER_READY` version, the validator locks authorisation,
IntakeProcessingPolicyHead, IntakeRevocationHead and the current held
CandidatePromotionFence in global order, revalidates the exact
PromotionEligibilityProof and creates the fresh passing target-release
IntakeEligibilityRecheckAttestation named by that version. The current-candidate
variant revalidates CandidateInputRecheckAttestation and both current heads; it
also revalidates the genesis head, target and rehearsal when the expected before
tuple is `LEGACY_BASELINE`, or terminal `CANONICAL_ESTABLISHED` for a later
cutover. The
historical variant revalidates HistoricalReactivationEligibilityAttestation,
its originating RollbackEvent, independently recomputed dependency root,
retained namespace and blob availability, current provider and schema assertions
and equality of the locked current CandidateInputHead to the attestation's
observed current tuple, never to the historical frozen tuple. A changed policy,
revocation, candidate-input, compatibility proof or promotion-fence head after
that point makes the mirror stale and requires the ordinary revocation and
successor-readiness ceremony.

Every gate, intake-eligibility, status, deployment, alias, configuration, schema
or migration revocation resolves to exactly one
ActiveReleaseRevocationActionRegistry entry and uses one serialisable compare-
and-swap against the exact current readiness digest and generation. Its generated
lock plan also locks every active
PostActivationControlHead and LegacyBaselineRestorationPostCommitHead before
readiness or release state. If either is pending, the ordinary path may not
advance release, readiness or promotion independently: it must byte-identically
join the matching controller's fixed trigger, BEGIN receipt, tuple disposition,
fence and drain scope and invoke that controller's COMPLETE action, or perform
  zero database DML while external admission remains BLOCKED. If the locks
observe an awaiting post-activation or legacy post-commit head, the ordinary
path must atomically couple its exposure-off transition to that controller: it
writes the ordinary RollbackEvent and ActiveReleaseRevocationReceipt, the
matching typed revocation failure evidence, adopted tuple disposition and the
existing BEGIN action's event, pending head and receipt, in that acyclic order.
The external BLOCKED fence and drain precede this transaction; no second fence
is created. With no active non-terminal controller, or only an absorbing
terminal controller, the transaction installs a higher signed
`REVOKED` row whose predecessor is that exact digest and whose payload hashes
the exact prior acknowledged higher BLOCKED ServingFenceVersion. This locked row swap is
the sole executable cutover-revocation linearisation point. For a status change,
the validator first creates but does not publish the immutable successor status,
CAS-installs `REVOKED` binding its digest, and only after commit publishes that
status generation through the ordinary ProgrammeStatusPublicationHead CAS. A
stale predecessor, duplicate generation, fork
or publication in the reverse order fails closed. If activation locked first it
may commit before the later revocation; if revocation commits first, stale
activation performs zero release-state DML. A revocation that follows activation
and invalidates the active tuple also locks release state, forces exposure off
and appends `RollbackEvent(kind=ORDINARY_REVOCATION)` plus its
ActiveReleaseRevocationReceipt in that same database transaction. An awaiting
controller is therefore pending when the revocation commits, never left without
a legal terminal path. If BEGIN had already committed, the ordinary action must
join its exact COMPLETE or write zero DML, so a later tuple generation cannot
strand it.

The deployment controller is the sole principal permitted to change production
alias, traffic, environment references or migrations. It first creates an
immutable `DeploymentChangeIntent` binding the current readiness row and exact
proposed change, CAS-installs a higher `REVOKED` row binding that intent, then
performs the change and verifies provider and database state. Historical
restoration must reproduce every intended-prior-tuple provider, runtime,
configuration, alias, schema and migration field before eligibility can pass;
compatibility without exact field equality cannot enable exposure. A failed or
partial change remains revoked. It may publish a higher signed `CUTOVER_READY`
generation only when
`cutover_authorisation_issue=PASS`. All production DDL
passes through the migration role and an event trigger advances the database
schema generation transactionally; direct application-role DDL is denied. An
out-of-band provider or configuration change cannot inherit readiness: each
runtime proves a provider-signed immutable deployment and build identity at
boot and on its serving RPC, and a different identity fails closed even before
the controller records the event. Detection triggers the same higher-generation
revocation CAS; no cached mirror or status pointer can inherit prior readiness.

Ben then issues one immutable, expiring, one-use `CutoverAuthorisation`. It
binds the frozen contract pair, certification and import attestations, target
CandidateReleaseManifest selector, target serving namespace and header,
target ServingContractMetadata ID and payload digest, exact
ProductionImportAttestation ID and payload digest, underlying CorpusRelease
lineage and exact expected current complete release-
state tuple, exact terminal ATTESTED ProductionImportHead, ATTEST_IMPORT event
and receipt, exact released IDLE ProductionImportControllerHead tuple, exact
POST_IMPORT TraceabilityExtension, ReleaseBundleEnvelope,
DeploymentManifest ID and payload digest, exact PromotionEligibilityProof and,
for `HISTORICAL_REACTIVATION`, the HistoricalReactivationEligibilityAttestation,
originating RollbackEvent and intended prior complete tuple,
exact current IntakeEligibilityRecheckAttestation and IntakeRevocationHead,
exact current IntakeProcessingPolicyHead and activation,
CandidateReleaseFreezeAttestation, the variant-selected recheck or eligibility
attestation and held CandidatePromotionFence version,
the variant-selected readiness authority described below, provider deployment,
runtime build and configuration, alias or traffic generation, database schema
and migration generations, expected release-state
generation, exact complete before-tuple digest, exact proposed complete
after-tuple digest, production environment and actor. For the first canonical
cutover it additionally binds the exact LegacyBaselineRollbackTarget, unexpired
passing LegacyBaselineRollbackRehearsalAttestation, current
CanonicalCutoverGenesisHead at `READY_LEGACY_BASELINE`, its complete event-chain
root and the proposed first-attempt ID; the expected before tuple must be the
matching exposed `LEGACY_BASELINE` variant and the proposed tuple must be
`CANONICAL_RELEASE`. Later cutovers carry an explicit
`NOT_FIRST_CANONICAL_CUTOVER` marker and require the genesis head to be terminal
`CANONICAL_ESTABLISHED`. The authorisation is a closed tagged union.
`FIRST_CANONICAL_CUTOVER` requires the exact current pre-authorisation
programme-status digest and generation and signed `CUTOVER_READY` mirror digest
and readiness generation; every ongoing-authority field is absent.
`NOT_FIRST_CANONICAL_CUTOVER` requires the exact current
`OngoingReleasePromotionHead` predecessor and fresh
`OngoingReleaseReadiness` ID and payload digest; every programme-status and
`DeploymentReadinessMirror` field is absent. Reuse, expiry or any mismatch
fails closed.

For `FIRST_CANONICAL_CUTOVER`, that exact authorisation is the evidence for
`P9_CUTOVER_AUTHORISATION`. The status validator may then publish one higher
status generation through ProgrammeStatusPublicationHead and one signed
`ACTIVATION_READY` mirror whose predecessor is
the authorisation-bound `CUTOVER_READY` digest, whose work-class disposition is
`production_cutover=PASS`, whose exact CutoverAuthorisation ID is present and
whose deployment, configuration, alias, schema, release, import and intake
eligibility fields are otherwise byte-identical. This single permitted successor avoids a digest
cycle between the authorisation and the status artefact. Any other gate or
environmental change revokes readiness and requires a new Ben authorisation.
For `NOT_FIRST_CANONICAL_CUTOVER`, no programme-status or readiness-mirror
successor exists. The exact `OngoingReleaseReadiness` is the sole readiness
authority and remains bound to the authorisation and its current promotion-head
predecessor.

One serialisable database RPC locks current IntakeProcessingPolicyHead,
IntakeRevocationHead, the held CandidatePromotionFence, signed
DeploymentReadinessMirror and programme-status head only for
`FIRST_CANONICAL_CUTOVER`, or the exact `OngoingReleaseReadiness` and current
`OngoingReleasePromotionHead` only for `NOT_FIRST_CANONICAL_CUTOVER`. It also
locks the CanonicalCutoverGenesisHead when the authorisation selects the
first-cutover variant and the singleton canonical release-state row in
generated global order, then revalidates the exact policy
activation, authorisation-bound
PromotionEligibilityProof and target-release IntakeEligibilityRecheckAttestation with a
set-based no-later-revocation proof and signature. The first variant revalidates
the `ACTIVATION_READY` state, exact authorised predecessor mirror and
CutoverAuthorisation ID, still-current programme-status digest and generation
and mechanical `production_cutover=PASS`. The later variant revalidates the
exact current promotion-head predecessor, unexpired readiness object, current
policy and revocation heads, successor candidate, deployment tuple and
Ben-authorised scope, and consumes that readiness in the same transaction.
Both variants revalidate byte-identical deployment,
runtime-configuration, alias, database schema, migration, release and import
fields, exact locked before-tuple and proposed after-tuple digests and every
other authorisation field. For `HISTORICAL_REACTIVATION`, the locked before
tuple must be the RollbackEvent-bound exposure-off tuple and every proposed
after-tuple field other than `exposure_enabled` and the required higher
release-state generation must be byte-equal to the event's intended prior
tuple; exposure must change from false to true. No current CandidateInputHead
field is copied into that target tuple. The request must originate from the
matching provider-signed runtime identity and carry a nonce-bound, one-use live
provider assertion for the exact production alias or traffic generation; a
different or stale identity fails before release-state DML. The RPC then
consumes the authorisation and compare-and-swaps the exact complete before tuple
to the exact complete after tuple in one transaction. For the first canonical
cutover the same transaction locks the exact genesis head, appends its
`BEGIN_FIRST_CANONICAL_CUTOVER` event and CASes it from
`READY_LEGACY_BASELINE` to `FIRST_CANONICAL_IN_PROGRESS`; either both state
changes and the event commit or none does. It writes an append-only
`ActivationEvent`. Its ID hashes schema version, frozen contract pair, exact
consumed CutoverAuthorisation and, for the first canonical cutover, exact
CanonicalCutoverGenesisEvent and before and after genesis-head tuples, or the
explicit later-cutover marker, then ProductionImportAttestation, exact terminal
ATTESTED ProductionImportHead, ATTEST_IMPORT event and receipt, POST_IMPORT
TraceabilityExtension, exact released IDLE ProductionImportControllerHead tuple,
ReleaseBundleEnvelope and DeploymentManifest IDs, the exact selected
first-cutover programme-status and readiness-mirror authority or later-cutover
`OngoingReleaseReadiness` and promotion-head predecessor, exact
PromotionEligibilityProof, its selected
CandidateInputRecheckAttestation or HistoricalReactivationEligibilityAttestation,
exact originating RollbackEvent where required, exact
IntakeEligibilityRecheckAttestation and observed IntakeProcessingPolicyHead
and activation, IntakeRevocationHead, CandidateReleaseFreezeAttestation and
held CandidatePromotionFence version, exact prior acknowledged BLOCKED
ServingFenceVersion, provider deployment,
exact consumed live-provider-assertion digest, runtime-configuration, alias,
database schema and migration generations,
production environment, exact canonical before and after tuples and their
digests. No event field may be inferred from provider state after commit.
Timestamps and database transaction IDs are provenance. Failure rolls back every
change. An application or environment switch may force exposure off but cannot
enable it.

The activation transaction also creates exactly one immutable
`PostActivationControlContext`, appends its genesis
`PostActivationControlEvent`, installs
`PostActivationControlHead(AWAITING_READY)` atomically with ActivationEvent and
the release-state CAS and writes the genesis
`PostActivationControlReceipt`. The context hashes the activation, complete before and
after tuples, intended-prior tuple, target kind, PostActivationControlPolicy,
exact generated lock plans, READY publication deadline, POST_ACTIVATION trace
deadline and smoke deadline.
None is caller supplied or extendable after activation. Its non-terminal head
states are exactly `AWAITING_READY`, `AWAITING_POST_ACTIVATION_TRACE` and
`AWAITING_SMOKE`, plus `FAILURE_CONTAINMENT_PENDING`; its terminal states are exactly `PASS_FIXED` and
`FAILURE_FIXED`. Each progress event adopts the exact already complete stage
artefact, before-and-after head tuples and current deadline evidence, and is
followed by one action receipt. It cannot re-execute or reinterpret an adopted
stage.

READY_CANONICAL is bounded by the context's READY expiry and is invalid after
that instant even if the external fence version remains readable. After
AWAITING_POST_ACTIVATION_TRACE, a current-candidate passing POST_ACTIVATION
extension, or the historical variant's exact bounded operational-audit cutoff
and `NO_SUCCESS_TRACE_EXTENSION` proof, advances to AWAITING_SMOKE. One
matching passing PostCutoverSmokeAttestation permits the
controller to issue one short-lived, single-use
`PostActivationPassCommitLease` binding the exact context,
`AWAITING_SMOKE` head, READY fence, trace, smoke, active tuple, deadline and
nonce. `ISSUE_PASS_COMMIT_LEASE` alone creates it, appends its issuance event,
advances the AWAITING_SMOKE head generation without changing state and writes
the issuance receipt. Consuming that lease in the generated `COMMIT_PASS`
serialisable action locks the control head, lease, active tuple, promotion,
readiness and applicable genesis or current ongoing-promotion head in generated
order, revalidates exact
context-bound exposure, HELD/READY and smoke evidence, appends the PASS event, CASes
`AWAITING_SMOKE -> PASS_FIXED`, consumes the lease and writes the immutable PASS
action receipt over the exact pre-effect success plan. The receipt hashes no
later successor object. Using that fixed receipt identity, the same transaction
writes the terminal `ReleaseActivationCertification` and AVAILABLE
CandidatePromotionFence successor. For the first cutover it also writes the
establish event, terminal genesis head and generation-one
`OngoingReleasePromotionHead`. For every later promotion or historical
reactivation it writes the immutable `OngoingReleasePromotionReceipt` and
exact-predecessor ongoing-head successor. The certification and head effects
are mandatory `COMMIT_PASS` effects, not later actions. A stale, expired or
already consumed lease, stale ongoing head, or ordinary revocation that wins
any shared lock first writes no PASS_FIXED head, certification, AVAILABLE fence
or promotion-head effect.

The closed failure-trigger union has exactly nine variants:
`READY_PUBLICATION_FAIL`, `READY_PUBLICATION_TIMEOUT`,
`POST_ACTIVATION_TRACE_FAIL`, `POST_ACTIVATION_TRACE_TIMEOUT`, `SMOKE_FAIL`,
`SMOKE_TIMEOUT`, `SMOKE_CRASH`, `PASS_COMMIT_LEASE_EXPIRED` and
`ACTIVE_RELEASE_REVOCATION`. A READY or trace controller crash is closed by its trusted
deadline and timeout proof; it cannot create a generic trigger. Each trigger produces immutable
`PostActivationFailureEvidence` over observed external and database state.
The lease-expiry trigger proves the exact passing smoke and issuance chain,
expired unconsumed and unrevoked slot and absence of every pass effect. The
revocation trigger proves the exact registered cause, ordinary fence and drain,
RollbackEvent, receipt, observed awaiting head and exposure-off tuple.
Containment then uses exactly two generated actions.

`BEGIN_FAILURE_CONTAINMENT` first locks the exact eligible non-terminal
PostActivationControlHead and the same pass-lease consumption slot used by
`COMMIT_PASS`, plus the current release tuple. In one serialisable transaction it
revalidates the typed trigger and deadline, derives the exact
`ContainmentReleaseTupleDisposition`, revokes any unconsumed pass lease, appends the begin event, CASes
that exact head to `FAILURE_CONTAINMENT_PENDING` and writes its action receipt.
Under `CONTAINMENT_OWNS_FENCE` it performs no external call, RollbackEvent,
branch creation, release-state change or final failure transition; the CAS must
win against COMMIT_PASS before the controller publishes BLOCKED. Under
`ADOPT_PRIOR_ORDINARY_REVOCATION_FENCE`, only the registered revocation may
invoke BEGIN as the final controller subphase of the same transaction after its
ordinary fence, drain, exposure-off event, receipt, failure evidence and
disposition; BEGIN performs no second external or release-state effect. In both
orders the head CAS is the pass-race linearisation point.
Once pending, PASS_FIXED is unreachable. `admit_and_resolve_fence` and every
canonical or legacy cache path treat the pending context as non-admitting even
if a stale external READY version remains observable, so no cache or corpus
read can use that READY generation during containment.

After a `CONTAINMENT_OWNS_FENCE` BEGIN commits and releases every database lock,
the controller installs and acknowledges the exact higher BLOCKED fence and
drains all leases against the absolute containment deadline fixed by the BEGIN
event and receipt. The adopted order selects its already complete ordinary
fence and drain and creates no second one. Missing or late required evidence leaves serving blocked but does not expire
the transition; late completion must bind trusted
`CONTAINMENT_DEADLINE_EXCEEDED` and the byte-identical pending head, trigger,
tuple disposition, fence and drain scope. `COMPLETE_FAILURE_CONTAINMENT`
then locks the exact pending head, current tuple, promotion and readiness heads,
revalidates those inputs and either performs the disposition-owned exposure-off
CAS and appends `RollbackEvent(kind=POST_ACTIVATION_CONTAINMENT)`, or preserves
and selects the exact already complete ordinary-revocation tuple, event and
receipt. It writes or selects the exact higher REVOKED versions without
rewinding them. For
`CURRENT_CANDIDATE`, that same transaction consumes the one-use
FailureRecoveryBranchSlot and creates the unique FailureRecoveryBranch and
`OPEN` branch head. For `HISTORICAL_REACTIVATION`, it instead selects the exact
existing in-progress branch and proves that no new branch or slot was created.
It then appends the failure control event and CASes the
context from FAILURE_CONTAINMENT_PENDING to `FAILURE_FIXED`, and finally writes
the completion action receipt over a pre-outcome result plan. Only after that
receipt exists does the historical variant create its failed-or-abandoned
outcome and CAS the existing branch to `OUTCOME_FIXED` later in the same
transaction; the outcome root selects the receipt and FAILURE_FIXED head, while
the receipt hashes neither later branch object. Smoke evidence is trigger-
specific: `SMOKE_FAIL` selects the failed smoke,
`PASS_COMMIT_LEASE_EXPIRED` selects the passing smoke and issuance chain, and no
other trigger fabricates one. A containment-owned external block or drain failure leaves the context pending and
all serving non-admitting; it can retry only the same fixed trigger, BEGIN
receipt, tuple disposition and observed predecessor, including after the fixed
deadline with the required deadline-exceeded evidence. Exactly one of COMMIT_PASS and
BEGIN_FAILURE_CONTAINMENT can win the shared-head CAS, and only the winning
BEGIN may complete to FAILURE_FIXED. Any
late trace, smoke PASS or pass lease after FAILURE_FIXED is retained only as
operational evidence and has zero promotion, readiness, release or completion
authority.

PostActivationControlPolicy contains exactly the seven closed actions
`OPEN_WITH_ACTIVATION`, `ADOPT_READY`, `ADOPT_POST_ACTIVATION_TRACE`,
`ISSUE_PASS_COMMIT_LEASE`, `COMMIT_PASS`,
`BEGIN_FAILURE_CONTAINMENT` and `COMPLETE_FAILURE_CONTAINMENT`. Every action
uses `PostActivationControlReceipt`; its idempotency key is
`(PostActivationControlContext, action, exact predecessor head,
adopted artefact or trigger identity)`. Its event precedes its head CAS and its
receipt follows the CAS; the receipt hashes exact before-and-after tuples,
deadline evidence and transaction result. Byte-identical replay returns the
same receipt. A changed trigger, predecessor, deadline proof or result
conflicts. BEGIN's fixed containment deadline cannot be extended by replay, and
a pending context can progress only through COMPLETE_FAILURE_CONTAINMENT.
- Before that activation RPC, the deployment controller compare-and-swaps the
  globally linearizable external serving fence from its exact predecessor to a
  signed `BLOCKED` version and waits for the prior admission generation to stop
  and its bounded in-flight admissions to drain or expire. It then performs the
  database activation. Only after the committed ActivationEvent exists may it
  compare-and-swap the same blocked version to `READY_CANONICAL` for that exact
  event before the context deadline and then atomically adopt that fence through
  the `AWAITING_READY -> AWAITING_POST_ACTIVATION_TRACE` control-head
  transition. A failed
  database activation leaves the fence blocked and creates no context. A failed
  ready publication, timeout or controller crash is a closed failure trigger;
  it cannot be retried indefinitely or bypass the BEGIN then BLOCKED/drain then
  COMPLETE containment branch.
- Each immutable `ServingFenceVersion` hashes schema, contiguous fence
  generation, predecessor or genesis and one closed state: `BLOCKED`,
  `READY_CANONICAL` or `READY_LEGACY_BASELINE`. It also hashes the complete V3
  release-state tuple digest and generation, variant-matching deployment,
  runtime-build, configuration, alias, schema, migration and readiness
  generations, exact `serving_epoch_id` for either READY variant, reason,
  controller identity and signing-key version. BLOCKED carries no serving epoch.
  `READY_CANONICAL` requires a `CANONICAL_RELEASE` tuple and exact
  ActivationEvent, PostActivationControlContext and bounded READY expiry, plus
  all active CandidateReleaseManifest, CorpusRelease,
  namespace/header, ServingContractMetadata, ProductionImportAttestation and
  DeploymentManifest fields. `READY_LEGACY_BASELINE` requires a
  `LEGACY_BASELINE` tuple, exact LegacyBaselineRollbackTarget and either the
  genesis-initialisation event or one passing
  LegacyBaselineRestorationAttestation and COMMIT_PASS receipt with the exact
  post-commit context at AWAITING_READY_LEGACY. The later ADOPT_READY_LEGACY
  action selects that fence, and continued admission requires the same context
  to be at AWAITING_LEGACY_SMOKE or LEGACY_READY_FIXED; the fence cannot require
  or hash the later genesis-head return event. It carries explicit forbidden markers
  for ActivationEvent and every canonical release field. `BLOCKED` carries the
  applicable event or attestation only as containment provenance and cannot
  admit. The controller signature is stored outside the payload and covers the
  completed version digest. The database release state remains canonical; a
  ready fence can admit only its exact already committed matching tuple and
  cannot create or repair one. Missing, forked, stale, unverifiable, mixed-
  variant or unavailable fence state is BLOCKED. Elsewhere in this programme an
  unqualified “READY fence” means the variant-matching `READY_CANONICAL` or
  `READY_LEGACY_BASELINE`; canonical candidate, historical-reactivation, smoke
  and completion chains require `READY_CANONICAL`.
- Every HTTP, RPC, export and background serving request, including a potential
  cache hit, calls `admit_and_resolve_fence` exactly once before any cache lookup,
  database checkout or corpus read. The linearizable external call validates the local
  provider-signed runtime identity and atomically registers a bounded external
  admission lease carrying a signed, request-nonce-bound, single-use token, the
  exact variant-matching ready fence ID and generation, serving-request-intent
  digest, exact serving epoch, authorisation-scope digest, complete canonical release-state tuple
  digest and generation, variant tag and complete variant payload, issued-at,
  expiry and one-use database-token identity. For `READY_CANONICAL`, it also
  carries CandidateReleaseManifest ID and payload digest, CorpusRelease lineage,
  serving-namespace ID and header digest and ServingContractMetadata ID and
  payload digest. For `READY_LEGACY_BASELINE`, it instead carries the exact
  LegacyBaselineRollbackTarget and legacy serving-contract digest and forbids
  canonical corpus fields. The lease remains live
  through the final response byte or export chunk. Immediately after external
  admission and before any cache lookup, every request invokes exactly one
  fixed-cost `consume_admission_token` database RPC. That RPC locks the one-use
  token slot and the exact applicable post-activation or legacy post-commit
  controller head in generated order, revalidates the token, fence and complete
  release tuple, rejects every pending or failure-fixed controller state and
  atomically consumes the token into a request-bound consumption record. BEGIN
  locks the same controller head. If token consumption wins, its already
  registered external lease may finish and must be included in the later drain;
  if BEGIN wins, consumption returns typed unavailable with zero cache or corpus
  access. Consuming the token does not release the external lease; completion,
  cancellation or bounded expiry does. External BLOCKED, unavailable or
  mismatch returns typed unavailable before the admission RPC; controller-state
  rejection occurs inside only that fixed RPC before touching cache or corpus
  data. A process may retain transport connections
  but cannot cache a ready decision across requests, renew it locally or admit
  from a background poll.
  The admission and route-budget manifests must share the exact passing
  LeaseDeadlineCompatibilityAttestation. Runtime and database use its clock-skew,
  queue, execution, flush and cancellation bounds; a token with less than the
  route's certified remaining lifetime is rejected. On expiry the runtime
  aborts the database operation and suppresses any later byte. New-epoch
  readiness waits for both the external old-epoch lease drain and the fixed-cost
  database proof that no old-epoch consumed token, statement or transaction is
  active.
- The admitted serving epoch and complete tuple enter every cache key. The
  physical fence generation remains in the request receipt and response audit
  metadata. A cache hit is usable only after that request's external admission
  and database-token consumption and only for the byte-identical tuple. Under
  `READY_CANONICAL`, on a miss the sole canonical serving RPC selects the exact
  already-consumed request-bound token record, proves its external lease remains
  live and rechecks the
  complete active tuple, ActivationEvent,
  exact manifest selector, CorpusRelease lineage, namespace header, metadata ID
  and digest, ProductionImportAttestation, DeploymentManifest, provider
  deployment, runtime build and configuration, alias or traffic, database
  schema, migration and exposure generation before reading the release. Every
  corpus predicate and physical serving key is qualified by the admitted
  serving-namespace ID, and every returned row must carry the admitted
  CorpusRelease lineage. The RPC never dereferences CandidateReleaseManifest
  payload. A mismatch performs no corpus read and triggers a
  controller block. Under `READY_LEGACY_BASELINE`, the canonical serving RPC is
  prohibited and the deployment controller routes only to the target-bound
  legacy serving contract; that runtime selects the same consumed variant-bound
  token record and revalidates the exact legacy tuple and target before its own cache or data
  access. Thus a request sees one complete legacy or canonical system, never a
  hybrid, and a cache hit is linearised just as strictly as a miss.
- Every revocation capable of invalidating an active release, including intake,
  processing-policy, security, readiness and deployment,
  revocation, first installs and acknowledges a higher BLOCKED ServingFenceVersion.
  Only then does its database transaction lock both containment-controller heads
  before readiness, promotion and release state. With no active non-terminal
  controller it revokes the authorities, sets `exposure_enabled=false` and
  writes the typed ordinary-revocation RollbackEvent and
  ActiveReleaseRevocationReceipt atomically. With an awaiting controller, that
  same transaction must also create the matching revocation failure evidence,
  adopted disposition and registered BEGIN event, pending head and receipt, all
  or none. With a pending
  controller it may only join that exact COMPLETE action or perform zero
  database DML. If that transaction fails, serving remains blocked;
  if fence control is unavailable, request admission already fails closed and no
  exposure-enabling transition may run. No database transaction may publish
  a ready state. Restoration always requires either a fresh certified canonical
  activation or the first-cutover LegacyBaselineRestorationAttestation and the
  corresponding BLOCKED-to-ready sequence above. A containment-owned typed post-
  activation or post-COMMIT_PASS legacy failure is the sole database-before-
  external order: BEGIN first wins the database PASS race, fixes the owned tuple
  disposition and installs a non-admitting pending head, then BLOCKED and drain
  occur. The adopted order retains ordinary external-before-database ordering
  and couples BEGIN into that ordinary transaction. COMPLETE either performs the
  owned exposure-off transition or preserves the adopted ordinary transition.
- Except for the two containment-owned BEGIN paths, an external fence transition and
  its lease-drain acknowledgement always occur before the first database lock.
  No code may call or wait on the external
  control plane while holding a database lock. Generated lock-plan tests enforce
  both directions of that boundary.

The live smoke suite writes a separate immutable
`PostCutoverSmokeAttestation`. Its ID hashes schema and smoke-policy versions,
frozen contract pair, exact ActivationEvent, PostActivationControlContext and
current `AWAITING_SMOKE` head, exact active
CandidateReleaseManifest ID and payload digest, CorpusRelease ID, serving-
namespace ID and header digest, ServingContractMetadata ID and payload digest,
ProductionImportAttestation, exact complete after tuple and digest,
DeploymentManifest, programme-status and readiness generations, exact held
CandidatePromotionFence, exact PromotionEligibilityProof, READY_CANONICAL
ServingFenceVersion, provider runtime identity and
release-state digest, ordered smoke-test IDs, immutable
evidence digests, measured results and terminal `PASS` or `FAIL` disposition. A
`CURRENT_CANDIDATE` smoke additionally hashes the exact POST_ACTIVATION
TraceabilityExtension ID and payload digest. A `HISTORICAL_REACTIVATION` smoke
instead hashes the originating RollbackEvent,
HistoricalReactivationEligibilityAttestation, exact append-only operational-
audit cutoff through its READY_CANONICAL fence and an explicit
`NO_SUCCESS_TRACE_EXTENSION` marker; it cannot reuse or append to the target
release's old POST_ACTIVATION or POST_COMPLETION extension.
A
passing smoke proves every returned response carried that same manifest,
CorpusRelease, namespace/header, metadata, tuple and fence identity. A smoke
result for another activation, selector, namespace, generation or deployment
cannot be reused. A FAIL disposition, timeout or crash enters the exact closed
failure-trigger union and generic containment transaction above. A PASS
disposition binds the exact `AWAITING_SMOKE` head but has no direct promotion
or genesis authority. If its issued pass-commit lease expires unconsumed, with
or without controller death, `PASS_COMMIT_LEASE_EXPIRED` deterministically
enters BEGIN then COMPLETE containment; the context cannot remain indefinitely
awaiting COMMIT. Only the one-use
PostActivationPassCommitLease transaction may atomically install the AVAILABLE
CandidatePromotionFence, perform the first-cutover genesis transition where
applicable and CAS the context to `PASS_FIXED`. A generation or field mismatch
writes nothing, and a late PASS cannot defeat an already committed
`FAILURE_CONTAINMENT_PENDING` or `FAILURE_FIXED` CAS.

Provider alias, runtime configuration or schema restoration then occurs only
under the revoked deployment-controller process. After the first canonical
attempt, the legacy tuple may be exposed again only through the exact
LegacyBaselineRollbackTarget, rehearsal and passing
LegacyBaselineRestorationAttestation described above. After any later cutover,
the prior canonical tuple may be exposed again only through the exact
HistoricalReactivationEligibilityAttestation, purpose-bound held fence, fresh
target-release intake recheck and separately issued CutoverAuthorisation.
Until the applicable ceremony completes, exposure remains off.
No rollback path may combine the prior release with target deployment,
configuration, alias, schema or migration fields, and no field may be restored
from mutable provider state without a fresh signed assertion. Passing historical
smoke restores availability but does not complete the failed candidate; its
TraceabilityFailureTerminal remains ineligible for programme completion. On the
ordinary current-candidate success path, the programme completes only when a
new immutable `PostCutoverSmokeAttestation` and
`ProgrammeCompletionAttestation` both carry the same frozen contract pair.
`ProgrammeCompletionAttestation` hashes
`PROGRAMME_COMPLETION_ATTESTATION/V1`, schema, frozen pair, exact predecessor-
chain root from ContractFreezeAttestation through candidate, deployment,
POST_FREEZE trace, certification, ReleaseBundleEnvelope, import, POST_IMPORT
trace, consumed cutover authorisation, its exact pre-authorisation and successor
status and readiness versions, ActivationEvent, READY_CANONICAL ServingFenceVersion,
POST_ACTIVATION TraceabilityExtension and passing PostCutoverSmokeAttestation,
exact consumed PostActivationPassCommitLease and terminal
ISSUE_PASS_COMMIT_LEASE event, successor head and receipt, exact COMMIT_PASS
event and receipt, PostActivationControlHead at `PASS_FIXED`, released AVAILABLE
CandidatePromotionFence successor, exact terminal
CanonicalCutoverGenesisHead and its complete event-chain root, complete active-state
tuple and generation, exact current pre-completion programme-status and
readiness predecessors, exact current ProgrammeStatusPublicationHead tuple,
exact passing P9_TRACEABILITY prefix evidence and its
POST_COMPLETION phase-contract digest, completion-policy digest, validator
executable and evidence digests and terminal `PASS`. Every earlier artefact remains byte-for-
byte unchanged. It cannot hash POST_COMPLETION or any later status publication.

The completion validator first produces exact passing `P9_TRACEABILITY`
evidence for the cumulative prefix through POST_ACTIVATION and the frozen
POST_COMPLETION phase contract. It creates ProgrammeCompletionAttestation only
after every predecessor gate other than `P9_TRACEABILITY` and
`P9_PROGRAMME_COMPLETION_ATTESTATION` is formally `PASS`, and after exact
passing `P9_TRACEABILITY` prefix evidence exists. It binds that exact trace
evidence and requires the target PostActivationControlHead to remain
`PASS_FIXED`. The status validator then creates, but does not publish, one immutable
proposed successor programme-status artefact that marks both final gates passed
and binds the prefix-trace evidence, completion attestation and exact
ProgrammeStatusPublicationHead predecessor. It then
captures CompletionTraceCutoff and computes
`H("POST_COMPLETION_CONTEXT/V1", schema, frozen pair, POST_ACTIVATION ID,
payload digest and cumulative root, passing smoke, AVAILABLE successor,
P9_TRACEABILITY prefix evidence, ProgrammeCompletionAttestation, proposed
status ID and payload digest, exact proposed ProgrammeStatusPublicationHead
successor tuple, CompletionTraceCutoff, active-state tuple and
generation, READY_CANONICAL ServingFence ID and generation and POST_COMPLETION phase-
contract digest)`. Before database locking, the validator obtains one bounded,
signed completion-readiness lease from the exact current READY_CANONICAL ServingFence
binding that context digest, active-state tuple and generation, request nonce,
issue and expiry. It never binds the future extension ID. POST_COMPLETION is
built only after the lease and covers the smoke, AVAILABLE successor, completion
attestation, proposed status and head, cutoff, context and exact lease ID and
payload digest. Fence revocation blocks new leases and follows the
ordinary drain-before-database-lock rule; no external call occurs while a
database lock is held. One final serialisable compare-and-swap locks and
revalidates the exact pre-completion status, readiness mirror, AVAILABLE
CandidatePromotionFence, IntakeProcessingPolicyHead, IntakeRevocationHead and
active-state tuple and `PASS_FIXED` PostActivationControlHead, verifies that the
pair is bound to the previously captured ProgrammeStatusPublicationHead
predecessor, verifies the signed lease and consumes its exact one-use
database token without contacting the external control plane, then writes the terminal pair
`(proposed_status_id, proposed_status_payload_digest,
POST_COMPLETION_extension_id, POST_COMPLETION_payload_digest,
status_generation)` to a fresh empty `CompletionTerminalPairAttempt`. It writes no
later immutable database receipt or status artefact and does not update a Git
ref under the database lock. After commit, the protected GitHub publisher reads
and revalidates the exact attempt, status and extension and compare-and-swaps
ProgrammeStatusPublicationHead from its captured predecessor to the proposed
terminal status commit. `programme_complete` evaluates that Git head and its
bound database pair, including the extension's
coverage reconciliation and cumulative root, never the proposed status alone.
A stale database predecessor, revocation-first race, partial pair, later
untraced status or missing extension performs zero pair DML. A stale Git
predecessor performs zero ref change, leaves the immutable pair non-current and
requires the protected publisher to append its
`ABANDONED_STALE_PREDECESSOR` disposition. A later attempt is permitted only
after that disposition and complete recomputation against the new Git head;
neither an occupied old attempt nor its immutable members can block the fresh
attempt. Completion
locking first may write the pair before a later revocation, which
then follows the ordinary blocking and exposure-off path.

### 10. Binding cold-review closure amendment

This subsection is later and more specific than any conflicting earlier
sentence. It closes the enumerated architecture, query, open-world and release
authorities below. A compiler, writer or validator that implements the earlier
ambiguous reading instead of this subsection fails contract freeze.

#### Bootstrap gate acceptance

For the ten genesis G0 gates and `P1_CONTRACT_FREEZE_ATTESTED`, the
`bootstrap_compiled_registry_binding` in `programme-gates.yaml` selects
`bootstrap-acceptance-source.json` as an authoritative, root-independent
member of the reviewed specification, not an informational implementation
pointer. Its exact SHA-256 binds the complete evidence and member JSON schemas,
subject types and identity fields, immutable member universes, enumerator
source and digests, ordered predicate definitions, exact member types and JSON
pointers, measurement source, comparison operators and typed expected values.
The committed generator proves that those reviewed bytes reproduce exactly
from the corresponding runtime schemas and sources. The compiler receives only
that bound source, the exact reviewed specification root and the frozen gate
descriptor. It emits exactly eleven
`ProgrammeGateAcceptanceDefinition/V1` instances in the declared order. The
first ten form the genesis G0 status set; the eleventh is the pre-bundle P1
definition and is not genesis status evidence. The
definition ID and digest are the domain-separated hash of every required field,
including the exact specification root. A missing, extra, duplicate, reordered
or byte-different source member or output definition leaves every affected gate
`OPEN`. Runtime input cannot select or alter a schema, member, path, predicate,
operator or expected value.

The same YAML member freezes the sole eligible controller ID and version, Codex
runtime version and entrypoint digest, model and reasoning level, five
lane-specific prompt IDs and digests, validator key and configuration, and the
closed runtime-context derivation. Run-local working, HOME, CODEX_HOME and TMP
paths vary only under the one controller-created run root and are inputs to the
signed context digest; all non-path context fields are frozen constants.
Unknown fields, another path root, another binary, prompt, model, controller or
validator are ineligible. No post-review allowlist choice exists.

#### Residual and open-world authority

`CanonicalContractBundle` also includes the complete
`GovernedResidualProducerRegistry`, `GovernedResidualObservation`,
`GovernedResidualDisposition`, `GovernedResidualImpactClosure` and
`GovernedResidualReviewQueueRoot` schemas, enums, producer mappings, identity
rules and writer actions. They are authored and Freeze-Gate reviewed with the
other bundle members. No residual producer, disposition or empty-queue rule may
be added after freeze.

`ReviewedSourceSpecificPublicationDecision` hashes its schema, frozen pair,
exact candidate occurrence, effective `REVIEWED_SOURCE_SPECIFIC`
`OpenWorldCandidateDisposition` ID and payload digest, legal-semantic reviewer
principal, reviewer-eligibility proof ID and digest, review disposition and
review time, primitive-collection root, selected PRESENT primitive occurrence,
representativeness decision `FAIR_SOURCE_BACKED_DISPLAY` and exact evidence
closure. The reviewer must be eligible under the bundle's legal-semantic review
policy and must sign the exact selection. The authoritative writer revalidates
that proof. Its closed signed payload includes
`signature_algorithm=Ed25519`, reviewer key ID, trust-registry digest,
signed-payload digest, signature, signing time and nonce. Validation resolves
the key from the frozen legal-reviewer trust registry, verifies role, domain,
validity and revocation at signing and verification time and recomputes the
payload digest. For an ordinary admitted occurrence,
`RECORD_OPEN_WORLD_DISPOSITIONS` writes the decision transactionally with the
disposition. For a pre-admission source-role occurrence it writes only the
signed neutral selection. `MATERIALISE_SCOPE` later revalidates that signature
and atomically writes the admitted occurrence, carried-forward disposition and
effective ReviewedSourceSpecificPublicationDecision, rekeying only occurrence
identity and proving the legal-semantic body, primitive selection and evidence
closure are byte-identical. An unsigned, differently reviewed, cross-wired or
implementation-selected primitive blocks only that candidate's publication.
The effective decision ID and payload digest are required members of scope
inventory, CandidateInputSeal, the applicable candidate-output root,
CandidateReleaseManifest, ReleaseBundleEnvelope, production-import parity,
traceability and SharedServingRow.

The same impact-to-state mapping is closed for every reconciled open-world
candidate and every nonzero `GovernedResidualImpactClosure`:

- `ISOLATED_SOURCE_SPECIFIC` may publish only the reviewed source-specific row.
- `AFFECTS_CANONICAL_RESULT` forces every affected result to
  `INCOMPLETE_NOVEL_SEMANTIC`, forces every intersecting claim-only or
  result-owned metric-slot impact-clearance projection to `FAIL`, and excludes
  those slots until the governed closure is repaired.
- `AFFECTS_CORPUS_SCOPE` forces the candidate occurrence and affected scope
  generation to `BLOCKED`, prevents `CorpusScopeFreezeAttestation` and
  `CandidateInputSeal`, and cannot satisfy `W_open`.
- `AFFECTS_CANONICAL_CONTRACT` forces the candidate occurrence and candidate
  generation to `BLOCKED`, prevents certification under the predecessor
  contract, scope freeze, `CandidateInputSeal` and `CandidateOutputSeal`. It may
  feed only the ContractAmendmentProposal bridge above. It does not prevent the
  approved successor ContractFreezeAttestation. Publication remains blocked
  until the successor freezes, affected spans and transitive dependants are
  reprocessed and every effective candidate receives a final disposition. It
  does not retroactively invalidate or mutate the immutable predecessor
  ContractFreezeAttestation that authorised discovery.

`W_open` therefore requires zero members in either blocking impact tier in
addition to final reviewed dispositions and empty unresolved roots. These
failures are occurrence and transitive-impact scoped. Valid sibling provisions
outside the reconciled impact closure continue through writing, candidate
review and Review rendering; no unfamiliar proposition creates a page-level or
deal-level renderer failure. A terminal disposition is not impact clearance:
every canonical market slot also requires an explicit
`impact_clear_for_metric_slot=PASS` projection over its full claim, result,
evidence and dependency closure.

#### Blob availability writer

`VERIFY_PRODUCTION_BLOB_AVAILABILITY` is the sole producer action for a
production `BlobAvailabilityReceipt`. It is present in
`OperationActionRegistry`, `CanonicalPhysicalCarrierRegistry`,
`CanonicalWriterDispositionRegistry`, `GlobalMutableAuthorityRegistry` and
`GeneratedLockPlanRegistry` as the second of exactly eight
`CERTIFIED_RELEASE_IMPORT_BATCH` top-level actions. It requires the exact OPEN
import generation created by `OPEN_IMPORT`; its only subphase is
`VERIFY_GENERATION/NONE/AVAILABLE_RECEIPT`. The external uploader may write only an exact
generation to the non-serving content-addressed namespace. It has no database
role. The trusted verifier streams that generation, recomputes namespace,
length and digest, then calls one idempotent writer RPC keyed by
`(environment, namespace, object_digest, object_generation)`. That transaction
locks the receipt key and writes exactly one immutable AVAILABLE receipt or
returns its byte-equal predecessor. Conflict, overwrite, missing generation or
digest mismatch writes nothing.

`BUILD_PRODUCTION_BLOB_AVAILABILITY_ROOT` then enumerates exactly one AVAILABLE
receipt for every production-import `B` member and no other receipt. It writes
bounded neutral tree batches and one terminal root. `BUILD_PRESEAL_CONTROLS`
may select only that terminal root. `IMPORT_MEMBER_BATCH` locks and revalidates
each selected receipt in the same import transaction. Receipt creation is
therefore a bounded pre-seal operation, never an intake/deal side effect or an
application-side import write.

#### Query capacity, benchmark and execution-result closure

`CapacityManifest` additionally owns exact maximum deal, observation,
metric-slot, aggregate, serving-row, cohort-member, indexed-row and indexed-byte
cardinalities for the certified release, plus the maximum number of release
namespaces used by load certification. Each value is a positive integer at or
below the protocol bound. The maximum-scale fixture is mechanically the
field-by-field maximum of `10N` and those declared values. The load manifest
records both inputs and the derived tuple; any smaller component fails
`P9_DATABASE_SOAK`.

`SupportedQueryShapeRegistry` is generated from the closed query grammar and
ServingObjectAccessRegistry. It enumerates every active route and action, request
variant, QueryPlan family, metric and party dimension, filter field, operator
and value type, sort and direction, initial and cursor page, facet and
field-value request, saved-query lookup, carried-response navigation,
inline exact-detail batch and source-document initial and cursor page. It is a
versioned CanonicalContractBundle member with a closed JSON schema. Each row
hashes route and action definition, request-variant schema, plan family, output
grain, metric and party dimension, field, operator, value class, sort,
page/action class, response schema and applicable index or aggregate contract.
Rows are UTF-8 sorted by that tuple; the domain-separated row root and count are
bound by `QUERY_DEFINITION_SET_ROOT/V2`. Two implementation-disjoint compilers,
one walking the query grammar and one walking route/action plus serving-access
registries, must emit byte-identical row sets with empty missing, extra,
duplicate and unsupported roots. Golden fixtures and submitted benchmark rows
are never authority for registry membership.

Infinite literal values are partitioned in a selected release by deterministic
indexed frequency. Null, invalid and typed boundary minimum or maximum take
precedence. Every other valid literal is `ordinary-selective` when its exact
matching subject count divided by the eligible cohort count is at most 0.10,
and `ordinary-unselective` when it is greater than 0.10. Zero matches are
selective. Counts come from the release-certified dimension projection and
denominator, use no sampled statistics and are recorded before load begins.
These rules are total and mutually exclusive. `QueryGoldenSuiteManifest`
contains at least one fixture for every
valid registry class and one refusal fixture for every invalid class.
`QueryGoldenCertificationAttestation` requires exact equality between the
registry class root and fixture-coverage root with empty missing, extra,
duplicate and unsupported roots. The soak manifest selects that same root and
runs every class at N and maximum scale under the applicable traffic profile.
A hand-picked benign subset cannot satisfy either gate.

Facet and field-value option sets are never silently truncated. Each response
contains at most 200 UTF-8 ordered values and 256 KiB plus exact total-distinct
count and either a signed continuation cursor or `END`. The cursor binds the
release, dimension, filter semantics, last complete typed option key and access
policy. Each page is one indexed bounded option RPC. Facet counts still cover
the full cohort. An unpageable, over-byte or cursor-mismatched option set returns
a typed refusal before corpus access; it cannot return an undocumented prefix.

Query result delivery has no persistent result carrier. The route-specific
serving RPC returns the bounded page it constructs and performs no per-query
result write. A carried-response navigation is a client transition over those
same validated bytes. A direct load, reload or missing carried response starts
one ordinary initial-page action and therefore receives the same admission,
compiler, one-RPC and response bounds as any other initial page. Saved-query
lookup resolves the stored plan identity and then executes that plan once.

The binding performance matrix covers every `SupportedQueryShapeRegistry`
class. Cache-eligible lookup classes must meet API p95 at or below 500 ms.
Every uncached initial or cursor page, facet,
field-value option, saved-query resolution, exact-detail batch and
source-document page must meet API p95 at or below 1.5 seconds and p99 at or
below 2.5 seconds. Every browser interaction must show its usable result,
detail, facet, option or next page within 2 seconds. These thresholds apply at N
and maximum scale subject to the existing success and throughput floors; a
missing class measurement fails `P9_BROWSER_A11Y_PERFORMANCE` and
`P9_DATABASE_SOAK`.

#### Release activation and later promotions

`CanonicalContractBundle` also includes the schemas and writer grammar for
`ReleaseActivationCertification`, `OngoingReleasePromotionHead`,
`OngoingReleasePromotionReceipt` and `OngoingReleaseReadiness`.
`COMMIT_PASS` is the sole producer of `ReleaseActivationCertification`. Its
single serialisable transaction revalidates the exact candidate, import and
POST_IMPORT trace, consumed CutoverAuthorisation, ActivationEvent,
READY_CANONICAL fence, POST_ACTIVATION trace, passing smoke, consumed pass
lease, active tuple and rollback rehearsal. It then writes the PASS event,
`PASS_FIXED` control head, consumed lease, action receipt, immutable terminal
`PASS` certification and AVAILABLE fence successor as one atomic result.
Failure writes none of them. The first `ProgrammeCompletionAttestation` must
select the certification's exact ID and payload digest, and the binding
completion chain includes it as a `COMMIT_PASS` effect before
ProgrammeCompletionAttestation.

For the first cutover that same transaction creates the production
environment's genesis `OngoingReleasePromotionHead` if and only if no head
exists. Genesis stores generation 1, current certification ID and payload
digest and the first active-release tuple. A conflicting existing head blocks
the complete `COMMIT_PASS` transaction. For every later promotion or historical
reactivation, the transaction locks the exact current head, writes one
immutable `OngoingReleasePromotionReceipt` and compare-and-swaps the head by
one to the certification it creates. A stale predecessor writes no PASS_FIXED,
certification, AVAILABLE fence, receipt or head successor.

After the one-time programme status becomes absorbing COMPLETE, later releases
and historical reactivations do not create a programme-status generation or
`DeploymentReadinessMirror`. They use `OngoingReleaseReadiness`, whose identity
binds the exact current OngoingReleasePromotionHead predecessor, successor
candidate and certification inputs, fresh policy and revocation heads,
deployment tuple, expiry and Ben-authorised cutover scope. For
`NOT_FIRST_CANONICAL_CUTOVER`, `CutoverAuthorisation` must select that readiness
object and its current head predecessor; any programme-status or readiness-
mirror field is prohibited. The sole activation RPC locks, revalidates and
consumes that readiness and locks its exact promotion-head predecessor in the
same activation transaction. First cutover instead locks and consumes the
programme status and DeploymentReadinessMirror authority. Each variant
prohibits every field and lock owned only by the other. This tagged union
removes the contradictory requirement to increment an absorbing
programme-status head and prevents stale ongoing readiness.
