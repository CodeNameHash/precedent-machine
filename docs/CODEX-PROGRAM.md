# Canonical corpus v2: governing architecture and certification programme

2026-07-20. Status: GOVERNING SPECIFICATION, EXECUTION BLOCKED. The revision at
commit `5a60eb2` closed the first legal-semantic findings but its cold review
rejected a shared-oracle failure: discovery and scope compilation could agree on
the same under-inclusive reading, candidate relationship data could agree with
the same wrong expectation, and no immutable per-bundle Freeze Gate approval
object existed. This revision adds recoverable receipt-local intake and exact
cutoff and revocation proof, independently authored complete semantic-question
contracts, catalogue-blind open-world legal-dimension discovery, exact semantic
and composition reconciliation, and a staged writer with reusable local truth
behind an exact corpus barrier. It also adds an immutable
`ContractFreezeAttestation` and cutover-readiness linearisation. It remains
unapproved until the complete specification-root digest passes the gates in
[programme-gates.yaml](codex-program/programme-gates.yaml). Programme status
derives only from that registry and generated status authority: the status
artefact for ordinary gates and the exact status-plus-POST_COMPLETION terminal
pair for programme completion. Prose cannot
satisfy, waive or change a gate.
Missing, stale, malformed or unverifiable evidence is `OPEN` and blocks the
affected work.

## Governing specification file set

These files jointly constitute the governing specification. This file remains
the spine:

- `docs/CODEX-PROGRAM.md`: governing architecture, governance, phases and
  implementation sequence;
- [programme-gates.yaml](codex-program/programme-gates.yaml): sole authority for
  gates and work classes;
- [bootstrap-acceptance-source.json](codex-program/bootstrap-acceptance-source.json):
  root-independent, self-contained schemas, member universes and typed
  predicates for the ten genesis G0 gates and the pre-bundle P1 freeze gate. It
  carries the byte length, SHA-256 and UTF-8 source for the complete recursively
  resolved local runtime dependency closure, its ordered source-set digest and
  the exact validator-executable file inventory. An unresolved local import or
  omitted helper makes the source invalid;
- [canonical-contracts.md](codex-program/canonical-contracts.md): sole authority
  for detailed identities, state machines, writer grammars, release contracts
  and traceability contracts;
- [adversarial-tests.md](codex-program/adversarial-tests.md): sole authority for
  numbered adversarial tests; and
- [specification-manifest.json](codex-program/specification-manifest.json):
  ordered paths, byte lengths and SHA-256 values used to compute the detached
  domain-separated specification-root digest.

The root hashes one exact record for the manifest as member one, followed by
the five content-file records declared in it as members two through six. Each
record is UTF-8 path, NUL, ASCII decimal raw-byte length, NUL, lowercase
SHA-256 of the raw file bytes and LF. The hash input is the UTF-8 domain
separator and LF followed only by those six records. No raw bytes or implicit
records are appended. The derived root is reported by the verifier and stored
in review, approval and freeze evidence, not inside the manifest it commits. A
reference to the governing specification, its bytes or its digest means that
complete ordered six-file set, never one file in isolation.

Each evidence record contains gate ID, specification and code commits,
environment, evidence schema, immutable artefact references and digests,
validator version, measured value, governed threshold, result and required
review or approval identities. It never contains a secret. Only the
certification validator may generate the status artefact. Each gate entry also
fixes its typed evidence object, exact acceptance-claim keys and mandatory
adversarial tests. The validator must parse the named closed schema and
recompute those claims from its immutable member root; the identifier alone or
a supplied `PASS` is never evidence. The signed V2 status artefact binds the
complete ordered gate projection and its predecessor generation. A manual edit, stale
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

- Decision rights: Codex agents DRAFT; Fable or an independent 5.6 Sol reviewer
  using extra-high reasoning REVIEWS every diff that touches legal semantics,
  identity, or extraction behaviour;
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
  gate registry is closed. Only the enumerated emergency P0 containment work may
  change application code while those gates are open. The temporary
  `gate_status_bootstrap` work class is the only other exception. It permits only
  the governance amendment, trusted review-controller software and evidence
  schemas, gate evidence schemas, deterministic compilation and implementation
  of the bootstrap-frozen acceptance definitions, enumerators and predicates, the
  certification integrity validator, signing system, status
  publisher, `ProgrammeStatusPublicationHead` and their tests. It does not
  permit corpus extraction, reprocessing, writes, backfills, production data
  changes, release import or activation, product feature activation, or any
  change to a bootstrap-frozen acceptance AST, expected value, member universe,
  required test or trust-root fingerprint. Later P1 and P9 definitions are
  CanonicalContractBundle members and remain `OPEN` until Freeze Gate approval;
  bootstrap cannot create them. After
  the start gate,
  approved architectural slices proceed independently and leave `main`
  deployable.
  The bootstrap exception also permits collection and validation of the eight
  G0 containment, security-disposition and isolated-staging facts, including
  creation of the empty isolated staging boundary and default-deny preview
  access controls. It grants no staging corpus restore, replay or canonical
  data authority. Generation 1 recomputes the G0 gate projection and
  `canonical_work_start` from those validated evidence envelopes inside the
  proposed status; it does not require a predecessor status that cannot exist.
- Before canonical implementation, reproduce and freeze the complete
  specification-root digest after all mechanical checks. Five independent cold
  reviews must each record `PASS` against that exact root: architecture,
  legal-semantic, query-efficiency, open-world and release-propagation. The
  legal-semantic lane must be satisfied by Fable or an independent 5.6 Sol
  reviewer using extra-high reasoning. An ordinary Sol review remains advisory
  unless the recorded reviewer meets those exact model, reasoning and
  independence requirements. Run the broader Sol adversarial review
  concurrently. Reviewers receive no prior conclusions. Recheck the root before
  and after every review. Any edit or non-PASS result invalidates all five and
  requires the mechanical checks and complete review set again. Ben's approval
  must name the same root. No canonical implementation starts from an earlier
  reviewed root.
- `G0_EXACT_DIGEST_REVIEW_SET` evidence hashes its schema, the ordered six-file
  entries, each byte length and SHA-256, the specification-root digest,
  mechanical-check command and result digests, the five contract-ordered lane
  names, each immutable reviewer identity, eligibility, input root, terminal
  disposition and evidence digest, the root observed before and after each
  review, an empty intervening-edit set and terminal `PASS`. Reviewer eligibility
  is determined only by the machine-readable registry contract. A trusted
  review controller directly starts and observes each read-only review. It
  supplies exactly three task-payload members: the exact frozen specification
  bytes, one registered lane-specific cold prompt and the required output
  schema. It also starts the review under fixed controller runtime context. That
  context contains only the pinned platform instructions and tool schemas. It
  is not case-specific and contains no prior review finding or conclusion.
  These fixed runtime inputs are permitted and are not part of the
  controller-supplied task payload.
  The signed task manifest carries the exact ordered six specification members,
  including each repository path, one-based order, byte length, SHA-256 and
  canonical base64 source bytes, plus the canonical base64 output-schema bytes.
  The validator decodes those bytes, recomputes every length and SHA-256, derives
  the domain-separated specification root from the exact ordered records and
  recomputes the output-schema digest. A detached asserted root, manifest digest
  or schema digest has no authority.
  The controller record contains its controller ID and version, review runtime
  version and binary digest, fixed controller-context digest, the exact
  specification root, model identifier, reasoning level, immutable task,
  session and review IDs, registered prompt ID and digest, controller-supplied
  input-manifest digest, exact input-context digest and its before-and-after
  values, output digest, start and end times, reviewer principal and complete
  source-control identity set, disposition, edit-set root, parent-session
  state, the fact that no earlier review conclusions were inputs, a unique
  nonce, signature algorithm and key ID. The controller emits the signed
  immutable record into the closed evidence set. The validator deterministically
  enumerates that set, loads the exact record, verifies its signature against
  the frozen controller-key registry and compares every field with the review
  set.
  The reviewer principal is the exact controller run plus one fresh ephemeral
  CLI session. It is not the model family. The controller creates a new
  `CODEX_HOME`, does not resume a session and does not load project rules, user
  configuration, plugins, memory or prior-session content. The execution is
  read-only. The input-context digest must be equal before and after review.
  The controller process is the only process permitted to use the signing key.
  The key is inaccessible to the reviewer, review process, operator input and
  repository. The private key never enters the review environment, logs or
  checkout.
  The registry separately maps `FABLE_ELIGIBLE` and
  `SOL_5_6_EXTRA_HIGH_ELIGIBLE` to their reviewer identity, exact model rule and
  reasoning rule where applicable. Repository evidence, a CLI transcript or
  reviewer-supplied metadata cannot substitute for the controller record; an
  unavailable or unverifiable record is
  ineligible. Self-asserted metadata is invalid.
  Independence is not a reviewer assertion. The status validator creates a
  signed `ReviewerIndependenceAttestation` by comparing the controller record
  with the complete Git history for the committed reviewed bytes. The controller
  record maps the reviewer principal to its complete source-control identity
  set. The validator uses complete history, blame and copy tracing to find every
  commit that contributed a byte to the exact root and confirms that none maps
  to the reviewer principal. A missing or ambiguous identity mapping is
  ineligible. It separately enumerates every
  task input that the controller delivered to the review and the fixed runtime
  context. The only controller-supplied task inputs are the exact reviewed-root
  bytes, one root-bound lane-specific cold prompt with no prior conclusion and
  the required output schema. Any extra task input, changed or unknown runtime
  context or context with case-specific material is ineligible. The controller
  record is the authority for review execution, observable inputs and output.
  It does not prove a provider-internal build, a provider signature or the
  absence of hidden provider context, and it does not claim to do so. Formal
  evidence is controller execution evidence under this amended standard. Git
  history is supplementary authorship evidence only and cannot prove that a
  review occurred. Root freeze precedes the genesis review
  execution, and review start is the closed input cutoff. Any unsigned,
  unattributed or unenumerable review event makes the reviewer ineligible. The
  parent-session state must be genesis, and the authorship-event,
  prior-conclusion and reviewer-edit intersections must each be the exact empty
  root. Independence requires that the reviewer neither authored nor modified
  the reviewed root and received no prior conclusions. Exactly one PASS is required
  for each lane. `G0_BEN_SPEC_APPROVAL` foreign-keys that exact review-
  set evidence ID and payload digest and repeats the same ordered file entries
  and root. A stale review, different root, ineligible legal reviewer, missing
  lane or approval of unreviewed files is `OPEN`, never an inferred pass.

### Agent implementation protocol

- One integration owner controls shared schemas, generators, migrations, writer
  registries and merge sequencing.
- Each PR uses one isolated branch with the repository-approved prefix.
  Containment, governance, gate software and evidence remain separate PRs.
  Current executable CI accepts `wp/*`. This rule does not claim that `codex/*`
  works now, and it replaces any instruction to use one branch for all
  gate-recovery increments.
- Each agent receives a bounded work packet with fixed inputs, outputs,
  permitted files, forbidden changes and acceptance tests.
- Two agents cannot independently modify the same identity, registry, migration
  or writer authority.
- Agents cannot invent taxonomy, identity, state or serving rules during
  implementation.
- Completed slices land behind disabled flags and leave `main` deployable.
- Legal-semantic, identity and extraction diffs require review by Fable or an
  independent 5.6 Sol reviewer using extra-high reasoning.
- Ben retains taxonomy and codebook decisions through the Freeze Gate.
- Every request for Ben's approval, consent or Freeze Gate decision must be
  decision-complete and source-contextualised. It must identify the actual deal
  and provision, quote or show the controlling source language, define every
  internal label or shorthand, explain the current system treatment, state the
  proposed treatment and its concrete legal and product effects, and give the
  recommended alternative with the consequence of rejecting or deferring it.
  A bare taxonomy name, tier label, codebook value, digest or implementation
  summary is never sufficient approval context.

## Binding target architecture

This section is normative. Later phases describe how to reach it. A product
row is not assumed to equal one source span, and a source span is not assumed
to contain only one semantic object. The system preserves source-backed facts
as separate objects and combines them by typed reference.

The detailed identities, state machines, writer grammars, serving contracts and query contracts for sections 0 through 8 have one authoritative location: [canonical-contracts.md](codex-program/canonical-contracts.md#binding-target-architecture-detailed-contracts).

## Minimal future analysis seam, not a drafting subsystem

The exact extraction-envelope, reviewed-payload, graph-normaliser and corpus-adapter contract is in [the semantic extraction adapter and graph contract](codex-program/canonical-contracts.md#semantic-extraction-adapter-and-graph-contract).
- Every definition, exception, override, bring-down, trigger, remedy, cross-
  reference and cross-provision dependency remains an explicit graph
  relationship in both uses. Neither a corpus UI nor a future consumer may
  reconstruct it from neighbouring text, layout or rows.
- This programme deliberately does not add draft workspaces or branching,
  cross-version draft lineage, typed drafting operations, editable-span
  contracts, patch or conflict-resolution engines, Word tracked-change
  generation, draft semantic-diff attestations, automated language generation or
  draft-specific permissions or retention. Those are future downstream
  consumers and receive no implementation, storage or authority in this
  programme.

## Tooth-to-tail execution path

This is the complete path from a received agreement to one published answer.
No stage may bypass validation or write a plausible replacement for a failed
earlier stage.

1. **Freeze the governing contract.** Compile the closed bundle twice, compare
   both independently authored complete semantic-question contracts and require
   exact SemanticQuestionCatalogueReconciliation through pre-freeze semantic
   envelopes, payloads, reviews, attestations, governed mappings, complete stage
   roots and neutral-projection root, emit the reconciled
   RelationshipEffectFieldUniverses, prove their generic stage root byte-equals
   the RelationshipEffectFieldUniverseSetRoot, review the exact semantic and
   identity diff, select the passing exact-digest five-review set and Ben
   specification approval over the same specification root, obtain every bundle-specific
   eligible legal-semantic review and Ben decision, and issue one
   ContractFreezeAttestation for the exact
   fingerprint. No source-specific scope or extraction proceeds on a merely
   compilable or previously approved fingerprint.
2. **Durably capture and freeze the intake universe.** Upload and verify the raw
   envelope, then commit `INTAKE_CAPTURE/RECEIPT` before unpacking or
   classification. Under a signed current IntakeProcessingPolicyActivation and
   fenced fleet lease, run the dependency-disjoint bounded package readers and
   raw enumerator, account for every physical record and raw byte recursively, then
   append one immutable attempt and resolution without deleting any prior
   failure. Every receipt has exactly one root SubmissionExpansionManifest,
   including `NO_CONTAINER`; nested containers are bottom-up ArchiveAttemptNodes,
   never nested manifests. A later passing attempt or governed reviewed disposition may unblock
   a later cutoff, but the full chain remains. Reconcile the complete ledger,
   attempt, object, replacement and resolution state through two independent
   cutoff enumerators, prove their dependency independence, reconcile them with
   a third implementation, close every historical governance payload and build
   the complete selected-root and replacement-or-duplicate dependency graph.
   Freeze one exact IntakeCutoffAttestation only when every
   receipt in its generation prefix has a latest cutoff-eligible resolution
   bound to the same pair and effective policy. A crash, unreadable package or
   unresolved limit breach remains visible and blocking; cutoff creates no
   ledger event.
3. **Convert, independently verify and admit the source.** Generate canonical
   text through the pinned primary converter. A separate decoder or renderer
   and text or OCR pipeline proves every page, part, character and map or records
   a blocking discrepancy before SourceAdmissionManifest can be `VERIFIED`.
   Bind the original package bytes, member bytes, file type, hashes, converter
   and source map into ImmutableSourceDocument; extracted text alone is never the
   source. `DEAL_SCOPE_RUN/PREPARE_SOURCE_ADMISSION` closes that admission-only
   chain and returns its SourceAdmissionPreparationReceipt before any semantic
   action. The receipt-bound SemanticExtractionInputEnvelope may then produce
   one or more non-authoritative model transcripts; review freezes one exact
   ReviewedInferencePayload and the frozen SemanticGraphNormaliserDefinition
   deterministically creates the graph without granting corpus-write or
   publication authority.
   Establish the immutable DealIdentityManifest independently of document
   membership. A legacy derived source is labelled and resolved, never silently
   promoted.
4. **Freeze and reconcile deal-document membership.** The independent builder
   assigns every verified source occurrence to one deal and document role and
   independently derives its frozen comparator tuple and ordinal. The ordinary
   builder separately derives the complete DealAdmissionManifest without
   reading that output. AdmissionUniverseReconciliation compares every field in
   both directions. A missing amendment, schedule, version, comparator field,
   ordinal or ambiguous role blocks rather than disappearing. Where the source
   role is novel, the graph first supplies the source-role candidate,
   PRE_ADMISSION_SOURCE_ROLE occurrence, evidence, primitives and directly
   reviewed role disposition. Only then may the independent and ordinary
   membership manifests be built. Deal admission is followed, in order, by the
   ADMITTED_SEMANTIC successor, rekeyed evidence and primitives, admission
   transition and carried disposition. The pre-admission objects never feed
   impact, applicability or serving.
5. **Build structure and the text-only universe.** Produce reproducible
   articles, sections, paragraphs, leaf offsets and AdmittedCoverageAtoms.
   Verify that they cover the admitted bytes once, without gaps or overlaps,
   then hash the complete PotentialDependencyUniverse before semantic discovery.
6. **Resolve definitions first.** Detect the definitions article and then
   inline and nested definitions anywhere in the agreement. Create exact
   source-backed, concept-free definition and use cues first. Only mapped or
   governed-adopted cues become definition instances; unfamiliar cues enter the
   open-world review path without an invented `concept_key`.
7. **Classify legal mechanisms.** Within each structural region, identify each
   operative provision and child mechanism, assign concept and party, and
   anchor it to exact offsets. One section may yield several provisions. Two
   reciprocal obligations yield two party-specific provisions.
8. **Independently challenge subjects and legal questions from raw admitted
   text.** A catalogue-blind implementation first partitions every atom and
   identifies every possible proposition, mechanism, qualifier, exception,
   trigger, party, time, dependency or effect dimension. The firewalled
   challenger separately enumerates base subjects and expands only its
   independently authored full question contracts. After base reconciliation,
   every catalogue-blind signal maps to the frozen universe or becomes an exact
   OpenWorldSemanticCandidate with one of the closed kinds. Each candidate
   receives one final reviewed disposition and an independently reconciled
   SemanticImpactClosure; unresolved kind, disposition or closure blocks, while
   a reviewed source-specific candidate remains explicit and cannot be forced to
   a nearby key. The certifier then proves, in order, `B_base = O_base`, complete
   mapped and reviewed-open-world partition, `Q_independent = Q_ordinary`,
   `B_question_state = O_question_state` and `B_slot = O_slot`.
   Each worker sees only its registered semantic envelope; reviews and frozen
   authority are attached later through governed wrappers. Only then does the
   challenger partition admitted text per applicable slot.
   Discovery cannot tell either independent pass that an entire provision,
   chapeau, exception or defined term is non-substantive.
9. **Compile and reconcile legal scope.** The ordinary compiler expands
   every expected claim and relationship slot from the contract and discovery,
   independently of the challenge. It enumerates governing chapeaux, provisos,
   definitions, cross-references, schedules, exceptions, overrides, parties and
   temporal dependencies. Both paths emit a total state-by-field
   RelationshipEffectConstraint over the neutral FieldUniverse and close exact
   generic and byte-equal path-specific constraint set roots. The certifier
   compares only their implementation-neutral bodies through the registered
   reconciler and requires exact `R = E`, then compiles
   each ClaimScopeClosure to a fixed point.
10. **Independently challenge composition and freeze scope.** Each
   `DEAL_SCOPE_RUN` action sequence first closes source admission through
   PREPARE_SOURCE_ADMISSION and later completes semantic reconciliation,
   closures, deal composition and deal-local ExpectedOccurrenceSlots without
   writing any answer occurrence or revision. The composition challenger
   accounts for every reconciled claim and effect slot and every
   result, metric and query question without reading ordinary ResultDefinition,
   MetricDefinition, lineage or projector output. The certifier requires exact
   per-shard `K_contract(s) = D_contract(s)`, proves complete deal and global
   parent partitions and creates locality-preserving CompositionScopeClosures,
   ExpectedOccurrenceSlots and ExpectedResultInputLineageSlots. Bounded
   global preparation builds scope slices and inventory shards. One
   `CORPUS_SCOPE_FREEZE` set-compares the complete intake and DealScopeRun set,
   writes CorpusScopeManifest, proves every effective scope application selected
   through the complete reconciled applicability slices has exactly one current
   discharge and every `MULTI_SUBJECT_CORRECTION` dispatch has its exact
   composite receipt regardless of component cardinality,
   atomically closes the scope-build generation and advances
   CandidateInputHead.
   Only after that exact barrier may extraction materialise each selected
   non-revision occurrence identity, including ClaimOccurrences.
11. **Resolve pre-claim relationships.** Build only the relationships declared
   `PRE_CLAIM_SCOPE` from immutable semantic occurrences and source evidence.
   Strip expectation and governance IDs from each actual revision, attest the
   exact lossless CandidateRelationshipActualProjection, independently project
   its selected state and complete field set through the registered candidate
   chain and close its stage root. The dispatcher compares that root only with
   the expected neutral-projection root through the registered reconciler.
   Discharge every
   ClaimScopeDependencyExpectation with exactly one permitted relationship
   revision and prove `A_pre(c) = E_pre(c) = R_pre(c)`. A missing, partial,
   conflicting, co-wrong or failed dependency blocks the claim; it cannot be
   ignored to create absence.
12. **Unpack expected claims.** Extraction evaluates every expected slot, selects
   the already materialised stable ClaimOccurrence and emits one immutable ClaimRevision in exactly
   one of the five states. For a reconciled applicable question, claim state
   `NOT_APPLICABLE` is an evidenced outcome, not a pre-filter that permits
   omission; a catalogue-level `INAPPLICABLE` question remains visible in the
   total disposition maps. Raw wording and value, canonical value, scope, party,
   closure and dependency revisions travel together with exact evidence or
   complete examined-scope proof, as the emitted state requires.
13. **Resolve post-claim relationships, do not flatten.** Build reviewed typed
   effects among provisions, claims, definitions, exceptions, conditions and
   remedies only after their declared inputs exist. Multi-span claims cite each
   contributing span. Cross-provision results keep component identities and
   effect-bearing relationship revisions rather than copying facts into one
   feature bag. A family may then seal its complete staging output. Candidate
   release preparation subsequently builds the full stripped actual projection
   and registered stage root across both phases and proves
   `A_all = E = R` before any release can certify or publish.
14. **Compose lawyer-facing results.** A versioned ResultDefinition selects and
   orders exact claims, relationships and effect projections under its exact
   CompositionScopeClosure. Each component records ResultInputLineage. The
   immutable result has no invented source span; clicking a component returns
   to that component's own evidence. Candidate certification projects result,
   metric, row and query composition independently without reading either
   composition path. It first emits and attests separate lossless
   CandidateCompositionContractRealisationProjection and
   CandidateCompositionInstanceProjection objects and closes both registered
   candidate stage roots. One final reconciler compares only the
   occurrence-independent contract body with the equal K/D projection and
   requires `K_contract(s) = D_contract(s) = A_contract(s)` for every selected
   shard. The other proves disposition-aware, field-complete
   CandidateCompositionInstanceConformance. Both must pass. Two further
   implementation-disjoint walkers then build the bounded
   CompositionContractSetRecompositionRoots, the independence validator issues
   CompositionContractSetEnumeratorIndependenceAttestation and a third
   reconciler issues the terminal CompositionContractSetAttestation only after
   every neutral member and difference root agrees.
15. **Validate and quarantine.** Reproduce every quote from stored offsets and
    check concept, party, codebook, type, unit, closure, relationship effect,
    expected-slot completeness, result lineage and dependency freshness.
    Retain every unknown or invalid observation as a GovernedResidualObservation
    and require one final GovernedResidualDisposition and reconciled impact
    closure. Every substantive novel proposition additionally follows the
    OpenWorldCandidateDisposition path. “Zero unresolved residuals” means every residual and candidate
    has a final reviewed disposition, not that every unusual source item became a
    permanent taxonomy key. A failed closure, `FAILED`, unexplained
    `NOT_EXAMINED` state or unresolved candidate blocks its affected result. A
    reviewed incomplete result may publish as an explicit non-market Review
    projection with its governed novel-semantic reason. Only an incomplete row
    carrying a `NOT_EXAMINED` component is restricted to the exact
    `CONTRACT_EXPANSION_REEXAMINATION_PENDING` branch and a complete reconciled
    ApplicabilityReexaminationManifest. A fully examined source-specific
    exception, relationship or other candidate that changes a known result may
    instead produce the typed incomplete row without inventing
    `NOT_EXAMINED`. Unrelated complete results continue.
16. **Write only through complete transactional units.** Raw intake uses
    receipt-first append-only capture, processing attempts and resolutions.
    `INTAKE_CUTOFF_BUILD` opens one generation, materialises its six fixed
    prepared kinds in bounded batches, independently closes fixed-fanout
    inventory and preparation-receipt trees, seals them, then performs constant-
    size freeze DML against unchanged ledger, policy and revocation heads. The
    freeze appends no intake-ledger event because it selects rather than changes
    that prefix. An ordinary `DEAL_SCOPE_RUN` writes one
    complete pre-extraction governed-subject scope; its bounded multi-subject
    correction variant writes the complete fixed-point subject component, one
    receipt per subject and one composite receipt atomically.
    `CORPUS_SCOPE_FREEZE` publishes one global barrier
    from bounded shards. `DEAL_EXTRACTION_RUN` explicitly opens, abandons or
    freezes a generation; FAMILY_BUILD writes one complete deal-family set and
    receipt, and FINALISE_DEAL publishes a snapshot and frozen transition only
    after exact family-receipt equality. `CANDIDATE_RELEASE_FREEZE` opens one
    generation, builds and seals two independent CorpusRelease inventory trees
    and two independent output inventory trees,
    then performs fixed-size freeze DML against an unchanged CandidateInputHead.
    Failure rolls back only its current state-advancing stage and never an earlier
    committed receipt, scope or barrier. Each state-advancing ordinary action
    writes one correlated outcome receipt and, where its contract changes an
    operational stream, one outbox event. Content-addressed inventory-builder
    variants are bounded, idempotent, non-state-advancing writes authenticated by
    their later seal and create neither recursive head events nor receipts. The
    multi-subject variant writes only its contract-bounded subject-receipt set,
    composite receipt and one correlated outbox event. No application sequence of table calls can
    substitute.
17. **Build the market projection.** Candidate-release jobs materialise compact
    observations, relationship-aware shared rows, reviewed source-specific and
    incomplete Review rows, and common aggregates from certified claims and
    results. Only `COMPLETE` plus `COMPARABLE` enters a market cohort. The serving
    path reads this CorpusRelease-keyed,
    serving-namespace-qualified
    projection through bounded set-based queries and a release-aware cache.
18. **Compile and serve queries.** Every query surface creates one governed
    plan. Every request, cache hit, cursor page and export chunk first obtains a
    registered lease from the exact READY_CANONICAL ServingFenceVersion, then executes at
    most one bounded projection operation and returns the versioned
    shared row contract with stable pagination. An affected non-comparable row
    carries its exact reason and never suppresses independent deal rows. Evidence detail is lazy, and
    every result remains traceable through exact claim, relationship, closure
    and source lineage.

## QXO acceptance examples for the architecture

These are binding golden cases, not one-off display patches.
For each case, the expected dependency, relationship-effect, result-component,
metric, denominator, roll-up and query-dimension tuples are literal,
human-reviewed fixture data tied to the frozen source digest and exact source
coordinates. They are not generated by either challenger, discovery,
expectation or composition compiler, relationship resolver, result composer,
normaliser, projector, query compiler or contract output. Each golden includes
coherent-wrong mutations that change all ordinary semantic or composition
outputs together while leaving the literal fixture unchanged; those mutations
must fail `R = E`, a per-shard `K_contract(s) = D_contract(s)` check, candidate
contract equality or CandidateCompositionInstanceConformance.

### Target Capitalisation representation

- The signing instance is the Target representation at section 3.1(b), with
  child assertion spans for limbs (i) through (v). The analogous Buyer
  representation is a separate instance.
- The rep-level accuracy materiality qualifier is `ABSENT`. Limb (iv) separately
  contains a substantive threshold for non-subsidiary investments material to
  the Company group. That threshold must not render as a general rep qualifier.
- Knowledge qualifier and retrospective lookback are `ABSENT` after full-scope
  examination. April 17, 2026 is a measurement date, not a lookback.
- Each of those absence claims selects its independently frozen
  ClaimScopeClosure. The closure includes every applicable signing-representation
  chapeau, limb, proviso, defined-term use and cross-reference, records the exact
  party and temporal scope and cannot be narrowed to text selected because it
  lacks the searched phrase.
- The independent fixture marks the exact chapeau, each limb, proviso,
  definition use and cross-reference cells before comparing them with the
  ordinary scope compiler. Relabelling the chapeau non-substantive while
  co-changing the closure and candidate claim therefore fails `R = E` rather
  than certifying a false `ABSENT` qualifier.
- The bring-down is a separate closing-condition instance at section
  5.2(a)(ii). Tier B applies to sections 3.1(b)(i) and (iii), true except for
  De Minimis Inaccuracies. Tier C applies to sections 3.1(b)(ii), (iv) and (v),
  true in all material respects with materiality and MAE qualifications
  disregarded.
- The tier relationships preserve the raw contractual scope expression and its
  deterministic expansion to the exact limb `ProvisionComponent` IDs. They do
  not store the expansion as unverified free text. Each `BRINGS_DOWN` effect
  payload also fixes maker, condition obligor, beneficiary or right holder,
  measurement date, accuracy tier, scrape, exception and precedence.
- `De Minimis Inaccuracies` is a definition nested inside the closing-condition
  span. It retains its own identity and evidence.
- The lawyer-facing Capitalisation result combines the signing claims,
  bring-down tier claims and nested definition. Its ResultInputLineage and
  serving payload retain the exact ClaimScopeClosure, `USES_DEFINITION` and
  `BRINGS_DOWN` revisions and effect digests. It must never collapse those tiers
  to one MAE, de-minimis or material-respects pill. The independent composition
  fixture requires each signing qualifier, each Tier B and Tier C input and the
  nested definition, so co-changing ResultDefinition and the row projector to
  omit one still fails.

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
  and are linked by typed relationships. Each `GOVERNS`, `APPLIES_TO`,
  `EXCEPTED_BY` and `USES_DEFINITION` effect names its exact party, target
  components, conditions, temporal reach and precedence; containment or section
  proximity cannot supply that meaning.
- The independent fixture separately fixes the Target and Buyer party,
  representative-control reach, cleanup and ongoing targets, fiduciary
  exceptions, notice and match timing, definition uses and precedence. A
  co-wrong ordinary expectation and relationship payload cannot swap party,
  target or legal operation and still reconcile.
- The lawyer-facing Target No-shop result composes those components without
  copying cleanup claims into the ongoing restriction. Market output compares
  each act and treatment separately, by party, and carries the exact effect and
  ResultInputLineage digest for every treatment. Its independent composition
  requirements separately enumerate cleanup, prohibited acts, representative
  control, fiduciary exceptions, notice, matching, recommendation and definition
  effects rather than trusting the ordinary result's component list.
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
  Every exception relationship declares legal operation, target components,
  party and capacity, conditionality, temporal scope and precedence. Those
  effect fields and exact RelationshipRevision survive into ResultInputLineage
  and the shared serving payload.
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
- Those fixtures independently fix the affirmative chapeau, each restricted-act
  target and every consent, ordinary-course, schedule and law exception effect.
  Omitting one exception or treating consent as absence changes `E`, `A_pre(c)`
  or `A_all`
  while `R` remains unchanged and blocks the family.

### Termination-fee result

- Fee amount, currency, payor, payee or right holder and fee side are separate
  typed claims or relationship effects. The displayed and queried market metric
  uses the governed transaction-value denominator and publishes the percentage;
  raw dollars remain inspectable provenance, not the comparison scale.
- Each fee trigger is a `TRIGGERS_REMEDY` relationship joining the exact
  termination right, fee obligation and any tail, signing or competing-proposal
  condition across all contributing spans. A fee result may therefore combine
  two or more provisions without copying either into the other.
- The literal independent fixture fixes every trigger predicate, party, remedy,
  temporal tail, condition, exclusivity or cumulative treatment and evidence
  interval. The ordinary expectation and candidate effect must both match it.
  The shared query row exposes fee side, percentage, triggers and refinable deal
  dimensions through materialised indexed fields, never request-time graph
  traversal. The independent composition fixture requires the fee side,
  governed percentage denominator, every trigger and each general index
  refinement dimension; a co-wrong MetricDefinition, lineage, row schema and
  projector cannot replace the percentage with dollars or omit a trigger.

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
  The access attestation binds three separately enumerated immutable inventories:
  the source route-action inventory, built inventory and runtime-observed
  inventory. Their exact `(action_id, action_class)` sets and independently
  recomputed roots must agree with the complete runtime observation set. Action
  IDs are unique, every closed action class is covered, and any number of
  distinct actions may share one class. Omitting the same action from the
  attestation and runtime evidence still fails against the source or built
  inventory member.
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
- One database-resident V3 tagged canonical release-state record controls the
  exact active canonical release or one-time legacy baseline and exposure. Slice
  flags cannot expose candidate data independently.
  An application or deployment kill switch may only disable access. Phase 9's
  serialisable RPC compare-and-swaps the complete release, deployment, runtime,
  alias, schema, migration and exposure tuple. Transaction failure changes
  nothing; post-commit smoke failure disables exposure and cannot claim a
  partial prior tuple.
- After staging certification, the candidate is exported as a content-addressed
  release bundle. A ReleaseBundleEnvelope is created only after
  PreCutoverCertification. The sole normative schema, complete membership,
  identity formula and `bundle_digest` contract is the Phase 9 Normative
  ReleaseBundleEnvelope contract; no abbreviated member list or second formula
  applies here. The importer accepts only that bundle digest, verifies every
  member and rejects missing, extra or mismatched bytes. Ben runs the
  dry-run-first canonical release importer locally into an inactive namespace
  and verifies exact stable-ID and checksum parity before cutover. This
  promotion import is the only canonical corpus write to production before
  cutover; it performs no extraction, backfill, replay or mutation of the active
  release. PreCutoverCertification and the release envelope require only the
  pre-import gate set. Import parity and deployment parity are necessarily later:
  the importer first attests the inaccessible namespace, deployment parity then
  probes that exact namespace and deployed production plan, POST_IMPORT
  traceability covers both, and only then may CutoverAuthorisation issue.
- Bundle members import only to the three contract-derived inactive
  destinations: `C` to the corpus-object namespace, `B` to the corpus-blob
  namespace and `E` to the immutable promotion-evidence namespace.
  BlobAvailabilityReceipts and ProductionBlobAvailabilityRoot cover exactly
  `B`; `C` and `E` are certified by import-member parity, and the structural
  controls required to verify `E` are certified separately by support-control
  parity.
  The database import locks and may reference only exact available blob
  generations. Partial or orphaned carrier writes remain unreachable, cannot
  alter an existing digest and do not move release state.
- The importer is a governed `IMPORT` job that calls only
  `canonical_write(operation=CERTIFIED_RELEASE_IMPORT_BATCH)`. At most one runs
  fleet-wide, with one in-flight write RPC, batches capped at 500 objects and 5 MiB and a 30-second
  statement timeout. Each batch atomically writes its checkpoint under
  `(production_environment, ReleaseBundleEnvelope ID, bundle_digest,
  import_generation, batch_ordinal)`. `batch_class` is not part of that unique
  replay key. Exact replay is a no-op; conflicting replay,
  mixed CorpusRelease IDs or checksum mismatch fails closed. A killed job resumes from
  the last checkpoint without duplication or pointer movement. It uses a
  reserved admission class and must pass concurrent-import soak testing or run
  only in a certified Ben-approved maintenance window.

## Phases (Codex's structure, amended)

### First canonical build increment: one real vertical slice

This is the first implementation increment after the existing start gates and
contract freeze pass, not another pre-build review gate. It is one delivery
track implemented through ordered thin substeps across Phases 1 through 7. No
substep may consume an identity, contract, writer action or serving shape before
the phase that owns it has produced and tested it. It exercises one narrow path
containing:

- a representation with qualifiers and bring-down;
- an interim operating covenant with money and time normalisation;
- a no-shop with exceptions;
- multi-span composition;
- a nested definition;
- multiple valid values;
- a reviewed unfamiliar proposition; and
- row-level failure isolation, so one unfamiliar or broken row cannot suppress
  sibling provisions or navigation.

The exercised path is source package to canonical text and spans, definitions,
semantic graph, claims and relationships, validation or quarantine,
authoritative writer, candidate release, serving projection, one set-based
market query, then Review, Corpus Context, Compare and Query. Human-reviewed
fixture expectations must prove deterministic identities, authoritative-writer-
only DML, safe unfamiliar-proposition handling, bounded database work and row-
level rendering isolation. Only after this slice passes may provision-family
agents expand implementation in parallel. `P1_VERTICAL_SLICE_PASS` records that
post-implementation result and opens broad `candidate_scope_and_extraction`; it
is an expansion control, not permission to skip contract freeze or perform the
slice before its dependencies exist. The slice uses only its reviewed staging
fixture and does not authorise production writes.

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

Create the single `CanonicalContractBundle` authority defined in
[canonical contract section 0](codex-program/canonical-contracts.md#0-one-authoritative-contract-source).
It governs `ProvisionConcept`, `ClaimDefinition`, `ClaimScopeDefinition`,
`RelationshipDefinition`, `RelationshipEffectSchema`, `ResultDefinition`,
`ResultInputLineage`, `MetricDefinition`, independently authored
`IndependentSemanticQuestionCatalogue`,
`IndependentCompositionQuestionCatalogue`, `CorrectionSlotDefinition`, source
admission, `IntakeDispositionPolicy`, `IntakeTransitionDefinition`,
`SemanticStageRegistry`, `DealDocumentOrderingDefinition`, ImmutableSourceDocument,
SourceAdmissionPreparationReceipt, SemanticExtractionInputEnvelope,
SemanticInferenceTranscript, ReviewedInferencePayload,
SemanticGraphNormaliserDefinition, ValidatedSemanticGraph, every open-world
candidate, occurrence, candidate- and kind-supersession,
`OpenWorldCandidateAdmissionTransition`, candidate-audit-chain
root, effective-occurrence root, candidate-chain reconciliation, evidence, primitive-collection,
disposition, impact, the generated
`ApplicabilityEligibleMemberKindProducerRegistry`
(`APPLICABILITY_ELIGIBLE_MEMBER_KIND_PRODUCER_REGISTRY/V3`), every generated
`ApplicabilityReexaminationRequirementDefinition`, the closed
`ApplicabilityReexaminationRequirementSetRoot`, and the post-contract-freeze
local and corpus-wide applicability-re-examination instance schemas,
the closed candidate-kind, disposition, impact, completeness and comparability
enums, and the three-variant SharedServingRow contract, state
rules, dependencies,
QueryDefinitionSetRoot, QueryGoldenSuiteManifest,
the QueryGoldenCertificationAttestation schema, BlockedResultPreviewDefinition
and row contracts, ReleaseBundleControlPolicy and its closed context, event,
receipt, failure, abandonment and spool-erasure schemas,
AttemptAuditObjectRegistry and its closed attempt and terminal schemas,
PostActivationControlPolicy, PostActivationControlActionRegistry and their
closed context, event, head, receipt, failure-evidence and pass-commit schemas,
GlobalMutableAuthorityRegistry and
GeneratedLockPlanRegistry. QueryDefinitionSetRoot and QueryGoldenSuiteManifest bind only
the CanonicalBundleInputIdentity; create QueryGoldenCertificationAttestation
only against the compiled fingerprint and approved ContractFreezeAttestation.
Neither that attestation nor a BLOCKED_RESULT_PREVIEW instance is a
CanonicalContractBundle
member. Its later exact ID and payload digest travel only through the governed
tenth promotion-evidence slot and certified metadata projection. Runtime
QueryPlan and request instances are generated execution data, not bundle members. Compile it
twice and require byte-identical outputs and fingerprint.
Compile both complete semantic-question contracts independently through their
registered SemanticComputationInputEnvelope, payload and semantic object,
self-contained review, PRE_FREEZE_CONTRACT attestation, governed wrapper,
GovernedSemanticRecord mapping and SemanticStageOutputSetRoot. Reconcile them
through the registered third-reconciler chain and close its exact
NeutralStageProjection and SemanticNeutralProjectionSetRoot. From that neutral
projection, run the registered FIELD_UNIVERSE envelope, payload, review,
attestation, wrapper and mapping for every reconciled effect-schema key and
close the exact RelationshipEffectFieldUniverseSetRoot. ContractFreezeAttestation
must select every PRE_FREEZE_CONTRACT semantic root and that field-universe root.

Implement the immutable `ContractFreezeAttestation` and
`P1_CONTRACT_FREEZE_ATTESTED` gate. The validator must prove exact bundle,
generated-output, compile, cycle, drift and semantic-diff, exact passing
`G0_EXACT_DIGEST_REVIEW_SET` and `G0_BEN_SPEC_APPROVAL` identity over the same
specification-root digest, every bundle-specific eligible review and Ben-decision
identity and issue the exact status digest and monotonic
authorisation generation consumed by dispatcher and writer. No broad provision-
family ClaimScopeClosure, `DEAL_SCOPE_RUN`, `CORPUS_SCOPE_FREEZE`,
`DEAL_EXTRACTION_RUN`, source-specific candidate extraction, reprocess, backfill
or candidate release may execute outside `candidate_scope_and_extraction`. The
sole narrower exception is the reviewed staging fixture executed through
`vertical_slice_execution`; it cannot expand its deal, concept or family
inventory and cannot write production. A same-bundle reapproval preserves
source and semantic-occurrence identities but rekeys every
IntakeCutoffAttestation and every reviewed disposition, expectation, challenge,
composition, closure, scope, selection and release
artefact that binds the new attestation.

The applicability definition topology is generated before the bundle freezes:
`CanonicalBundleInputIdentity -> ApplicabilityEligibleMemberKindProducerRegistry/V3
-> ApplicabilityReexaminationRequirementDefinition entries ->
ApplicabilityReexaminationRequirementSetRoot -> generated-output manifest ->
CanonicalContractBundle fingerprint -> ContractFreezeAttestation`. The
registry, definitions and set root contain no candidate, CorpusRelease or final
bundle-fingerprint back-reference. Candidate-specific requirement instances,
entries, slices, subject applicability roots, reconciliations, manifests and metric projections are created
only after that freeze against the exact generated definitions. The generated
mutable-authority and lock-plan registries must also be total before freeze:
every mutable head and every creation-slot or pairwise exclusion domain has one
authority, complete stable lock key and global order, with no wildcard or
caller-selected lock set.

Classify every existing registry-like artefact as migration input, generated
compatibility output or retired. Migrate approved content into the bundle and
give every legacy entry a terminal disposition. No current hand registry remains
a canonical write gate or reverse-sync target. Direct edits to generated
registries, schemas, types, UI catalogues or database constraints fail CI with a
deterministic drift diff. The Freeze Gate controls bundle changes; Ben decides
taxonomy and codebooks after review by Fable or an independent 5.6 Sol reviewer
using extra-high reasoning.

Numbered `Phase N` headings are programme delivery phases.
`PRE_CLAIM_SCOPE` and `POST_CLAIM` are relationship-resolution stages;
`DEAL_SCOPE_RUN`, `CORPUS_SCOPE_FREEZE`, `DEAL_EXTRACTION_RUN` and
`CANDIDATE_RELEASE_FREEZE` are writer operations; SemanticStageRegistry names
are computation stages. None is a synonym for a numbered programme phase.

### Phase 2: Immutable source, identity, scope and lifecycle primitives

First implement the generic `canonical_write` kernel, its sole database grants,
closed action dispatch, envelope and programme-status validation, global lock
ordering, transaction boundary, idempotency and receipt primitive, dry-run mode
and fault-injection harness. Phase 2 implements `INTAKE_CAPTURE` and source-
admission actions on that kernel. Phase 3 adds only the scope, extraction and
family actions it owns. Phase 5 adds correction, candidate-release and freeze
actions. No phase creates another writer or invokes an action before the owning
phase has implemented it.

Implement IntakeProcessingPolicyActivation and its signed head,
ArchiveSafetyPolicyManifest and fleet intake admission, receipt-first
append-only `INTAKE_CAPTURE`, SubmissionReceipt,
ArchiveAttemptNode, IntakeProcessingAttempt, passing
SubmissionExpansionManifest, SourceContent, source occurrence,
IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution, both complete
cutoff-state enumerator manifests, CutoffEnumeratorIndependenceAttestation,
CutoffStateReconciliation, HistoricalIntakeGovernanceInventory,
IntakeEligibilityDependencyManifest, IntakeCutoffAttestation,
IntakeEligibilityRecheckAttestation, canonical-text occurrence,
ImmutableSourceDocument, CanonicalTextVerificationManifest,
SourceAdmissionApprovalAttestation, SourceAdmissionManifest,
DealIdentityManifest, SourceAdmissionPreparationReceipt,
SemanticExtractionInputEnvelope, SemanticInferenceTranscript,
ReviewedInferencePayload, SemanticGraphNormaliserDefinition,
GovernedResidualProducerRegistry, GovernedResidualObservation, both bounded
residual-universe roots, GovernedResidualUniverseReconciliation and manifest,
GovernedResidualDisposition and manifest, both impact projections and
reconciled GovernedResidualImpactClosure, and empty
GovernedResidualReviewQueueRoot,
ValidatedSemanticGraph and validation report, IndependentDealDocumentManifest,
DealAdmissionManifest,
AdmissionUniverseReconciliation, half-open
structural and semantic spans, AdmittedCoverageAtoms,
PotentialDependencyUniverse, excerpts, source anchors, provision instances,
components, discovery coverage, IndependentLegalDimensionDiscoveryManifest,
IndependentLegalDimensionMappingManifest, both semantic-question universe
manifests and their reconciliation, IndependentSemanticChallengeManifest,
OpenWorldSemanticCandidate, both OpenWorldCandidateOccurrence variants,
OpenWorldCandidateSupersession, OpenWorldCandidateKindSupersession,
OpenWorldCandidateAdmissionTransition,
OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot,
OpenWorldCandidateChainReconciliation,
OpenWorldEvidenceClosure,
OpenWorldPrimitiveObservation, OpenWorldPrimitiveRelationship and complete
OpenWorldPrimitiveCollectionRoot, OpenWorldCandidateDisposition and manifest,
empty OpenWorldReviewQueueRoot, both SemanticImpactWalkerOutputs,
SemanticImpactEnumeratorIndependenceAttestation, reconciled
SemanticImpactClosure, validators for the Phase 1 generated
ApplicabilityEligibleMemberKindProducerRegistry/V3,
ApplicabilityReexaminationRequirementDefinition set and its root, and the
post-contract-freeze ApplicabilityReexaminationRequirement, Entry, Slice and
ScopeSubjectApplicabilityRoot schemas,
ChallengeQuestionDispositions, OrdinaryQuestionDispositions,
every SemanticStageRegistry contract, SemanticComputationInputEnvelope,
SemanticComputationPayload, semantic-object ID, SemanticReviewInputEnvelope and
disposition, NonSemanticPayloadAttestation, governed-object ID, functional
GovernedSemanticRecord mapping, SemanticStageOutputSetRoot,
NeutralStageProjection and SemanticNeutralProjectionSetRoot. The fixed
RelationshipEffectFieldUniverseSetRoot and universes are Phase 1 inputs, not
recomputed here. Implement independent and ordinary
RelationshipEffectConstraints, their exact set roots and
relationship-semantic reconciliation,
RelationshipSemanticExpectations, ClaimScopeDependencyExpectations,
ClaimScopeClosures, independent and ordinary composition coverage dispositions,
requirements, locality shards, deal and global totality roots, shard and parent
reconciliations, CompositionContextKeyUniverseRoot, neutral content digest and
every reachable BoundedInventoryTree node,
CompositionScopeClosures, ExpectedOccurrenceSlots,
ExpectedResultInputLineageSlots, ScopeSubjectApplicabilityRoot,
DealScopeRunManifest, DealScopeRunReceipt,
CorpusScopeInventoryKindRegistry,
InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE), both bounded CorpusScopeInventoryRootSets,
their common neutral content digest, reconciliation and every reachable tree node,
  CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  CorrectionDischarge, ManifestMembershipRevision, CorrectionDischargeMap,
  MultiSubjectScopeCorrectionReceipt/V2, scope-correction ledgers and receipts,
  and the `MATERIALISE_SCOPE` discriminator and receipt-lineage schemas that
  distinguish `SINGLE_SUBJECT` from `MULTI_SUBJECT_CORRECTION` and bind every
  scope-materialisation receipt to the exact replacement
  ApplicabilityReexaminationEntry and Slice roots it follows,
CorpusScopeManifest,
CorpusScopeFreezeAttestation and CandidateInputEvent. These are immutable
schemas, identity validators and pre-extraction scope artefacts only. No actual
assessment, claim, relationship, result, lineage, observation or candidate
projection is materialised in this delivery phase. In particular, this phase
does not instantiate an applicability requirement, entry, slice,
ScopeSubjectApplicabilityRoot, candidate-wide
root, manifest or metric projection; it only enforces that every later instance
selects exactly one generated requirement definition and registry-assigned
producer.
Enforce durable receipt-first intake, recoverable immutable attempt and
resolution chains, revocation rechecks, exact cutoff,
independent package parser, decompressor, member, record and raw-byte
reconciliation, independently derived deal-document comparator and ordinal
equality, exact intake and deal-document reconciliation, independent
canonical-text verification, the build-time import firewalls between each
challenge and ordinary path, catalogue-blind legal-dimension discovery,
independent base-subject and complete question-universe enumeration, total
independent question-applicability disposition, and the exact
`B_base = O_base`, `Q_independent = Q_ordinary` with `W_open = PASS`,
`B_question_state = O_question_state`, `B_slot = O_slot`, `R = E`,
per-shard `K_contract(s) = D_contract(s)` and parent-partition reconciliation
contracts.
Replace the provisions-to-cards `spanHash` join with
explicit occurrence and revision lineage. Pin every algorithm, serialisation and
ordering rule. Fuzzy rematching is prohibited.

Exact reruns reproduce occurrence, closure, lineage and revision IDs. A changed
source receipt or converter occurrence remains separately traceable even when
canonical content matches. A changed scope definition, dependency expectation
or expected endpoint creates a new closure; a changed claim state, value,
evidence, selected relationship effect, correction or derivation creates a new
revision. A ProvisionInstance- or ProvisionComponent-owned claim retains its
logical occurrence while that governed subject is unchanged. A
ScopeAssessmentOccurrence changes when its identity-bearing closure set changes.
Every change rekeys its declared dependants through result, family, snapshot and
release. Conflicting shadow revisions are reconciled before certification,
never treated as harmless identity stability. Tests cover legacy source
admission, one-byte boundary changes, anchor migration, concept and party
supersession, nested and reused definitions, multi-span evidence, assessment
and dependency coverage, relationship effects, invalid crossing overlaps and
reciprocal party obligations.

### Phase 3: Definitions-first extraction and candidate conformance

Implement the execution path in order: ordinary definition, mechanism and party
candidates; catalogue-blind legal-dimension discovery; independent all-text
base-subject challenge; base-subject reconciliation; independent dimension
mapping; complete OpenWorldSemanticCandidate partition, kind resolution and
supersession, every required source-role admission transition and carried-
forward disposition, complete candidate-audit-chain root, independently rebuilt
effective-occurrence root and their reconciliation, evidence closure, primitive
collection, one final reviewed
disposition, two independent impact walks and reconciliation, local
selection of the exact post-contract-freeze
ApplicabilityReexaminationRequirement instance already created by
`CORPUS_SCOPE_FREEZE/OPEN_GENERATION` from the generated definition, then
ApplicabilityReexaminationEntry and Slice creation only by the exact operation,
action and discriminator assigned in
ApplicabilityEligibleMemberKindProducerRegistry/V3, with the selected
receipt-side DealScopeRunReceipt or FamilyBuildReceipt lineage required by that
mapping, then, for a scope materialisation, the aggregate-contract-bound
ScopeSubjectApplicabilityRoot after every required Entry and Slice and before
the subject manifest and receipt, and
exact empty release-
eligible OpenWorldReviewQueueRoot; independent and ordinary complete question-universe enumeration and
exact Q reconciliation; total question-disposition and slot reconciliation;
registered semantic computation, self-contained review, non-semantic
attestation, governed-wrapper and neutral-projection creation at every stage;
complete independent and ordinary RelationshipEffectConstraint matrices and
relationship-semantic reconciliation; RelationshipSemanticExpectation and
ClaimScopeDependencyExpectation compilation; challenge reconciliation and
ClaimScopeClosure compilation; independent and ordinary composition child,
shard and totality-root compilation, exact per-shard and parent reconciliation
and CompositionScopeClosure compilation;
deal-local ExpectedOccurrenceSlot creation; DealScopeRunManifest finalisation
and DealScopeRunReceipt commit;
bounded global scope preparation; CorpusScopeFreezeAttestation; post-barrier
non-revision occurrence materialisation; ExpectedResultInputLineageSlot
discharge;
pre-claim relationship effects, stripped candidate projection and registered
pre-claim candidate reconciliation; typed claims and explicit states;
post-claim relationships and evidence; ResultInputLineage, result and component
revisions and family sealing; extraction and family transitions and receipts,
FamilyExtractionManifest, DealExtractionRunManifest and
DealExtractionRunReceipt. Phase 3 also compiles and freezes the complete expected
candidate-conformance rules, output-kind registry, expected-key rules,
relationship and composition projections and reviewed-source-specific row
bijection rule. It does not create a CorpusRelease, market observation, source-
specific output row, candidate-output root or output reconciliation. Phase 4
creates the raw and canonical observations. Phase 5 then materialises the
candidate input chain, CorpusRelease, candidate conformance outputs,
ReviewedSourceSpecificOutputClosure, both bounded candidate-output root sets,
their independence attestation and reconciliation, validation and quarantine in
the contract-defined order. A scope-correction branch
  instead appends its application and applicability
  projection, commits the scope correction event, correction-ledger and subject-
  head CASs, CandidateInputEvent, CandidateInputHead CAS and
  CorrectionApplyReceipt, then opens a higher scope generation. It independently
  reconciles the complete CorrectionApplicabilitySlice, invokes
  `DEAL_SCOPE_RUN/MATERIALISE_SCOPE` with the V3 registry's mechanical
  discriminator rule, and creates or selects every required local
  ApplicabilityReexaminationEntry and complete Slice before any corrected
  primary or consistency output. It then creates exactly one
  ScopeSubjectApplicabilityRoot per affected subject over the complete
  applicable registry-entry and Entry/Slice sets before it creates the current
  CorrectionDischarges and CorrectionDischargeMap, subject manifests and
  receipts, including the composite receipt for every
  `MULTI_SUBJECT_CORRECTION` dispatch, and repeats the affected family, deal and
  later candidate steps. A post-scope correction does not reopen scope or call
  MATERIALISE_SCOPE: the next `DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE`
  owns its family Entries and Slices, corrected outputs, discharge, map and
  family result under the captured post-scope correction heads. Enable residual
capture. A family build certifies only the pre-claim relationship subset needed
to create its claims. Full relationship equality, candidate contract equality
and composition instance conformance are candidate-release outputs and cannot
be pulled forward into the family transaction.
Unknown attributes and taxonomy dimensions create the exact open-world candidate
and reviewed path in [the canonical contracts](codex-program/canonical-contracts.md#binding-target-architecture-detailed-contracts), never an invented key. Unresolved candidate kind,
disposition or impact, invalid frozen taxonomy codes, incomplete closure,
missing or conflicting dependencies, missing required claims or effect fields
and evidence failures remain visible and block only their dependency-closure
result, scope or contract tier. Authenticated pre-publication candidate Review
continues to render independently valid siblings beside a typed blocked preview,
but strict release certification rejects the blocked candidate. Production
continues to render the unchanged prior active release. Nothing is skipped,
partially published or rendered plausibly.

Repair concept-aware deduplication, absolute quote offsets, party values at
write time, per-family reprocessing and contract-declared cross-family builds.
Fuzzy matches
may populate a review queue but cannot write canonical edges or move claims.
Bring-downs, exceptions, definition uses, governing chapeaux, triggers and
remedies become typed relationships with exact legal effect, endpoint, party,
condition, temporal and precedence payloads. The compiled dependency DAG owns
every cross-family read and invalidates transitive dependants on any scope,
endpoint, effect or revision change.
Existing WP-R3, WP-R4, WP-R6, WP-R7 and WP-R8 work folds here.
Extend the existing evaluation harness with golden cases for every family,
including the QXO representation and no-shop examples above.

### Phase 4: Raw and canonical observations

Store raw and normalised observations together. Each observation carries unit,
day basis, denominator, derivation version and source lineage. Its full lineage
includes CorpusRelease, deal, result, concept, metric, party role, value and
capacity, legal trigger or context, exact ClaimScopeClosure, claim, relationship,
exact metric CompositionScopeClosure, result-component and result revision IDs,
ResultInputLineage and effect-payload
digests, evidence IDs, canonical-text occurrence and offsets.
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
through the exact governed anchor and calendar rules in
[canonical contract section 7](codex-program/canonical-contracts.md#7-serving-projection-and-one-row-contract). Months and
years never become a fixed number of days without exact dates. Unknown basis is
unresolved; qualitative clocks remain categorical. No stratum is dropped and
every exclusion remains visible.

Each metric fixes whether the statistical unit is deal, provision, claim or
result component and how multiple values within one deal roll up. Published
statistics report both subject and distinct-deal denominators and never apply an
implicit first, minimum, maximum or majority rule. A metric whose meaning or
eligibility depends on a relationship effect is result-component-owned and
retains ResultInputLineage; it cannot publish as a claim-owned shortcut.

Versioned normalisers belong to the claim or metric contract. Existing
table-config reconstruction moves into extraction or governed normalisers as each
data gap closes. Every temporary compatibility recovery emits a named counter;
the counter reaches zero before removal. The governed query-time derivation
pattern remains valid only when it emits typed value, basis, reason and lineage,
not a bare null. Party is identity, not a normaliser: missing or conflicting
party creates a `PARTY_OR_LEGAL_ROLE` candidate or makes only the affected
result incomplete or blocked and non-comparable, according to the reconciled
impact closure. It never triggers text inference, Buyer/Seller coercion or
suppression of unrelated rows.

Materialise the total canonical metric-slot partition from the release-scoped
MetricApplicabilityRequirementProjectionSet at candidate output: one exact
market observation when the owner is complete and comparable and every
intersecting applicability requirement is complete-examined, otherwise one
`MarketMetricSlotExclusion` with its typed reason and complete lineage. Candidate
and production enumerators prove the partition in both directions. Unrelated
re-examination requirements cannot exclude a slot, and exclusions never enter a
cohort or aggregate. Reviewed-source-specific rows never enter the metric-slot
partition. `ReviewedSourceSpecificOutputClosure` is built by direct independent
selection of the effective-terminal reviewed-source-specific occurrence set and
the candidate's reviewed-source-specific row set, proves their exact bijection
and zero metric bases, projection entries, observations and exclusions, and is
created only after both complete CandidateOutputInventoryRootSets and their
reconciliation. Its identity binds both root-set IDs, payload digests and the
reconciliation. It remains outside those root sets and is selected directly by
CandidateOutputSeal and CandidateReleaseManifest. Neither root set may depend on
the closure, and the closure may not depend on a MarketMetricSlotExclusion,
aggregate, CandidateOutputSeal, CandidateReleaseManifest or later trace
extension. This ordering prevents a source-specific closure cycle.

### Phase 5: Complete the one writer with corrections and candidate releases

Extend the Phase 2 `canonical_write` kernel and the Phase 3 scope, extraction and
family actions with the correction, candidate-release and freeze actions below.
All remain variants of the same RPC, grants, lock plan, transaction primitive and
receipt grammar. `INTAKE_CAPTURE` and source admission remain Phase 2 actions;
scope, non-publishing review, extraction and family materialisation remain Phase
3 actions. This phase neither reimplements nor replaces them. The Phase 3
`MATERIALISE_SCOPE/SINGLE_SUBJECT` action independently revalidates and selects digest-identical
release inputs and already scope-opened ApplicabilityReexaminationRequirement
instances, originates only the scope/source-admission Entries and complete
Slices assigned to its exact operation, action and discriminator by
ApplicabilityEligibleMemberKindProducerRegistry/V3, and cannot create source
admission, instantiate a requirement or rerun model inference. Its
mechanically derived `SINGLE_SUBJECT` discriminator creates one governed
subject's pre-extraction closure and expected slots. Phase 5 adds its bounded,
mechanically derived `MULTI_SUBJECT_CORRECTION`
discriminator rebuilds one complete fixed-point subject component and replaces
every affected Entry and Slice under the successor scope generation, retaining
exact predecessor and component DealScopeRunReceipt lineage under
`DEAL_SCOPE_RUN_RECEIPT_BINDS_DISCRIMINATOR`. The former
standalone multi-subject scope-materialisation action is retired;
the existing Phase 3 `CORPUS_SCOPE_FREEZE` publishes the global barrier from bounded inventory
shards; its `DEAL_EXTRACTION_RUN/FAMILY_BUILD` writes one complete family plus every
registry-assigned intersecting ApplicabilityReexaminationEntry and complete family Slice and binds
them through its manifest, transition and receipt;
explicit extraction OPEN and ABANDON transitions govern that work;
  its `FINALISE_DEAL` independently proves the full FamilyBuildReceipt set before a
FROZEN transition exposes one DealSnapshot; `CORRECTION_APPLY` advances exactly
  one scope or post-scope ledger and CandidateInputHead without corrected-object
  DML. The bounded `MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION` discriminator
  atomically rebuilds the complete fixed-point subject component derived by the
  V3 rule, including every membership or source-admission transition that
  requires fixed-point rebuilding regardless of cardinality and every other
  component containing more than one subject. That scope materialisation itself,
  not a later action, writes or selects every required Entry and Slice and each
  `ScopeSubjectApplicabilityRoot`, then the corrected outputs,
  CorrectionDischarges and exact CorrectionDischargeMap, then subject manifests,
  subject-head and CandidateInputHead transitions and one discriminator-bound
  subject receipt per rebuilt subject, and finally one V2 composite receipt over
  the complete subject-receipt and subject-root sets. A post-scope correction is
  instead materialised by FAMILY_BUILD in its separate outputs, family Entries
  and Slices, discharge, map, family-set, manifest, transition and receipt order.
  The bounded candidate
state machine seals and reconciles the two independent CorpusRelease inventory
root sets, selects the exact already scope-opened post-contract-freeze
  requirement set and complete registry-owned local Entries, Slices and
  ScopeSubjectApplicabilityRoots from those
sealed roots, builds both candidate-wide applicability-
reexamination roots, issues their independence attestation, writes the named
terminal reconciliation and manifest, then writes every
MetricApplicabilityRequirementProjection entry and the terminal set, and only
then issues the materialisation-time intake recheck, writes CandidateInputSeal
and creates CorpusRelease. The universal writer order is therefore the
sealed release-input roots, two applicability roots, independence,
reconciliation, manifest, projection entries and set, materialisation-time
recheck, CandidateInputSeal and CorpusRelease, only through
their closed
`NAMED_CONTROL(APPLICABILITY_REEXAMINATION)`
and `NAMED_CONTROL(METRIC_APPLICABILITY_REQUIREMENT_PROJECTION)` dispatches
selected directly by CandidateInputSeal. It then creates
the CorpusRelease-keyed output append head and both complete output root sets, before fixed-size
`CANDIDATE_RELEASE_FREEZE` DML. After freeze, only
`BUILD_CANDIDATE_RELEASE_PROJECTION` may close the object and blob roots and only
the two registered read-only validators plus the independence validator may
produce its embedded recheck proofs; only `ISSUE_INPUT_RECHECK` may verify those
proofs and create the current-candidate recheck before promotion.
Application roles have no direct canonical-object-table write grant.
Every state-changing dispatch also validates the generated
GlobalMutableAuthorityRegistry and GeneratedLockPlanRegistry. It locks the exact
registry-derived authority keys, including pairwise exclusion and creation-slot
keys, in one global order before validation and holds them through terminal DML;
a missing authority, undeclared pair, wildcard, caller-supplied lock key or
post-validation lock acquisition writes nothing.
Validate each stage's complete envelope, current authorisation and intake
revocation watermark, idempotency key, scope barrier, relationship effects,
result lineage, revision closure and dependency freshness before that stage
commits. Fault injection after every write step leaves zero partial rows in that
stage and the exact declared terminal receipt cardinality, including every
subject receipt plus one composite receipt for every
`MULTI_SUBJECT_CORRECTION` dispatch regardless of cardinality; it never rolls back or mutates
an earlier committed intake, scope or barrier stage.
Compatibility projections, including
`provisions.ai_metadata.features`, are asynchronous one-way outbox sinks.

Disposition every legacy correction before rebuilding, then apply governed
  corrections through the exact generated stage before scope or revision hashing
  and validation. Scope and post-scope ledgers, applications, applicability
  projections and slices, currentness events, discharges, maps and digests never
  combine. Historical discharges remain immutable, while only active applications'
  current discharges may enter a selecting map. Every flow emits a complete
closure- and freshness-validated `DealSnapshot`. Per-family work carries
forward immutable family sets only when contract and full dependency-input
digests match; a changed scope dependency, closure, endpoint, relationship
effect or other input invalidates every transitive dependant. A scope-changing
correction requires a higher DealScopeRun and CorpusScopeFreeze generation. A
value-, evidence- or post-scope-effect-only correction may reuse an unchanged
barrier but still requires a new FamilyExtractionManifest, DealSnapshot and
DealExtractionRunManifest. CandidateInputRecheckAttestation and a held
CandidatePromotionFence prevent any of those head changes during certification,
import, activation and smoke; expiry revokes rather than publishes.

Apply human corrections before candidate certification. Build releases offline
in staging and never partially mutate the live corpus. Run staged candidate
builds over QXO, Verve, Metsera, ten varied deals and then the full corpus. Each
stage requires a backup, dry-run diff, correction-preservation audit,
idempotence rerun and before/after semantic and market diff. WP-R1 and WP-R2
ride their first applicable candidate stages. Canonical numeric backfill occurs
here after its schema migration, never through a runtime error probe. The full
candidate produces the immutable release bundle used by the promotion importer;
production never reruns the candidate transformations.

Implement the release-bundle context lifecycle before permitting bundle
construction. `RELEASE_BUNDLE_CONTROL_BUILD` has exactly five top-level actions:
`PRECOMMIT_WALKERS`, `CLAIM_WALKER_ROLE`, `WRITE_WALKER_OUTPUT`,
`FINALISE_BUNDLE_CONTROLS` and `ABANDON_BUNDLE_CONTEXT`. Every action binds one
immutable ReleaseBundleControlContext and its CAS-linearised control head.
Each successful role spool is erased only after its terminal PASS output has
committed while the context remains `OPEN`. Exactly four role-bound success
receipts and their `SUCCESS_PRE_FINALISATION` set commit before the commitment
root, output set, governed roots, reconciliations, envelope or
`FINALISE_CONTEXT`. Finalisation revalidates and selects those already durable
controls, then atomically writes the envelope, `FINALISED` event, head and
receipt; it creates no spool erasure or erasure receipt.
A walker fault, expiry, partial ingest or trust revocation makes that context
non-finalisable; only `ABANDON_BUNDLE_CONTEXT` may close it with typed failure
evidence and an immutable abandonment terminal. Only failed or partial spool
bytes survive until irreversible abandonment; they are erased afterwards under
that terminal authority and receive `FAILED_AFTER_ABANDONMENT` receipts. A new
attempt uses a new context and cannot
reuse a claim, commitment, tree, output or envelope from the abandoned one.

### Phase 6: Market serving projection and bounded cohorts

Build the compact `market_observation` projection with the full identity from
[canonical contract section 7](codex-program/canonical-contracts.md#7-serving-projection-and-one-row-contract): CorpusRelease, governed deal key, concept, metric, party, result key and
version or marker, stable owner occurrence type and ID, stable scope type and
ID, governed value-slot key and ordinal. The exact selected owner revision is
mandatory payload lineage and never key identity. Each owner retains its
ClaimScopeClosure or ResultInputLineage, exact RelationshipRevision and effect
digests and source evidence. Build the same total metric-slot universe and
materialise exactly one `MarketMetricSlotExclusion` for every slot that cannot
produce an observation, including its exact intersecting applicability-
requirement set and typed reason. Neither unrelated expansion work nor a
manifest-wide state may suppress a slot. Materialise common aggregates whose input-set digests cover the
contributing observation payloads. Serve arbitrary
refined cohorts through one indexed, set-based SQL/RPC and a release-aware
cache. The number of database calls and rows returned to Node is bounded by
request shape, not corpus size. The database may perform an indexed set
aggregation over the selected cohort, but it may not return broad cards or
claims for application-side calculation.

Complete MKT-1, MKT-2 and MKT-3 on this path: provide source occurrence,
provision, claim, relationship, result revision, closure, effect and evidence
lineage for every value, resolve
provision codes per row rather than by a section-wide dominant code, and pass
context through direct props rather than a global UI bridge. A legacy card link
is optional compatibility navigation,
never canonical lineage. Cohorts distinguish party role, value and capacity, beneficiary,
seller-side and buyer-side fees, applicable deals, examined deals and present deals.
Presence prevalence remains a small secondary statistic; term treatments,
exceptions, triggers, distributions and source context are primary.

Every aggregate returns separate distinct-deal counts for eligible, applicable,
examined, present, comparable and excluded observations, with exclusion
reasons. Prevalence is present divided by examined eligible and applicable
deals. A term distribution uses distinct present deals with compatible
canonical observations.
`NOT_APPLICABLE` and present-but-unnormalisable observations remain explicit
with governed exclusion reasons and do not silently enter those denominators.
`FAILED` and ordinary unexplained `NOT_EXAMINED` remain visible only in candidate
Review and Admin and block their affected result from active serving. Active
Review may render a release-certified `REVIEWED_SOURCE_SPECIFIC` row and any
release-certified `INCOMPLETE_CANONICAL_RESULT` with its exact governed reason.
An incomplete row may carry `NOT_EXAMINED` only when that state is exactly
`CONTRACT_EXPANSION_REEXAMINATION_PENDING` under a complete reconciled
ApplicabilityReexaminationManifest and `NOT_CERTIFIED` comparability. The active
market-observation and cohort projections contain zero `FAILED` and zero
`NOT_EXAMINED`; unaffected complete rows remain releasable.

Replace process-local containment as the primary control with the external
atomic single-flight, fleet-wide admission and circuit control plane, plus
statement timeout and request deadline. Declare a fixed
maximum database-call count for every active route. The serving layer fails
closed when shared admission state is unavailable and retains enough connection
headroom for ingest, admin and rollback operations.

Production import certifies all four serving categories through the same exact
three semantic-parity roles. Alongside observation, cohort and aggregate root
pairs, it must produce `ProductionServingContractMetadataParityRootPair` by
independently reconstructing metadata from frozen inputs on the expected side
and from inactive physical columns on the physical side, then reconciling those
roots without source access. The expected reconstruction selects the exact
passing QueryGoldenCertificationAttestation from the tenth governed promotion-
evidence slot. The physical reconstruction ignores asserted metadata IDs and
digests when deriving canonical bytes. All four category pairs must pass before
ProductionImportAttestation or any serving grant can exist.

The market route may reopen only after its projection is certified, its
responses are safely cacheable and the Phase 9 database load gate passes.

### Phase 7: Shared results and row contract across every surface

Implement the versioned result composer and one shared row contract for Review,
Corpus Context, Compare, Query, Admin and exports. A row may combine multiple
provisions through typed relationships, including a representation plus
bring-down or a fee plus triggers, while preserving each component's state,
party, ClaimScopeClosure, exact relationship effect, ResultInputLineage and
evidence. Nested definitions remain independently inspectable.

The generated UI row family can render all five claim states, but SharedServingRow
contains only release-eligible states under its three closed variants.
Authorised candidate Review and Admin render explicit `ABSENT`,
`NOT_APPLICABLE`, `NOT_EXAMINED` and `FAILED`
instead of blanket “No market data”. Certified active Review may additionally
render release-certified `REVIEWED_SOURCE_SPECIFIC` and
`INCOMPLETE_CANONICAL_RESULT` rows; the contract-expansion branch above is the
only one that may carry `NOT_EXAMINED`. Corpus Context, Compare and Query may
show either row only as typed selected-deal context and exclude it from every
market cohort; exports preserve the same distinction. `BLOCKED`, `FAILED`, unresolved candidates and any other
`NOT_EXAMINED` are release-integrity failures, not empty results, and never
inhabit SharedServingRow. Candidate-only `FAILED` rendering and the generated
BLOCKED_RESULT_PREVIEW use their separate non-serving contracts. Every surface uses the same raw and canonical values,
bounded relationship-effect projections, market observations, denominator
labels, source roles and refinable dimensions. Display and sidebar components
may arrange the contract differently, but cannot reinterpret it or reconstruct
a missing effect. Existing active index filters and result-specific columns
remain available to refine output. The Query surface must additionally expose
the plan's columns, cohort, counts, exclusions, pagination and source actions
rather than reducing a result to a chart or presence count.
The `REVIEWED_SOURCE_SPECIFIC` variant is admitted only through the exact direct
ReviewedSourceSpecificOutputClosure selected by the candidate output and
release manifests. A client cannot infer that closure from zero observations or
an exclusion row, and a source-specific row never acquires a metric slot merely
to explain its non-comparability.

The browser contract is equally binding. Deal-to-market Compare uses three
non-overlapping regions: persistent left provision navigation, a bounded centre
review table and source-text region with Review-equivalent density, and an
independently collapsible right Corpus Context or market-detail panel. The
right panel never covers the application header or forces the centre table into
an unusable horizontal canvas. Every governed row with an authorised source or
detail action is keyboard and pointer clickable; a row without one renders its
typed no-detail reason instead of silently doing nothing. Definition full text
appears beneath the correct defined term in the same expandable cell, with the
same source action placement used elsewhere. A definition instance cannot
absorb a neighbouring or nested definition merely because their spans overlap.

Compare and Corpus Context lead with the treatment of the provision in the
selected deal and the distribution of comparable components across the cohort:
qualifiers, exceptions, triggers, notice and matching periods, fee side,
bring-down treatment and other ResultDefinition components. Presence prevalence
is a small secondary annotation. The selected deal's component values and
states are visually distinct without a redundant banner or duplicated provision
label. Duration graphics reconcile canonical units and visibly mark minimum,
maximum, median and mean with their day basis. Money graphics lead with the
governed deal-relative percentage and retain raw currency only as secondary
context. The manual query builder uses the Review visual system, and deal
selection accepts typeahead text as well as structured selection.

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
Each provision row and lazy detail panel has an independent render boundary. A
reviewed unfamiliar provision, a `BLOCKED_RESULT_PREVIEW` or a failure in either
renderer cannot unmount, blank or suppress the left navigation, other provisions
or their source actions. Browser acceptance must exercise that exact mixed
recognised, source-specific and pre-publication-preview deal. The target
candidate route is authenticated and staging-only; active Review and every
market surface remain pinned to the unchanged prior release.

Before an unfamiliar candidate has its final disposition, the authenticated
offline semantic-review screen renders the non-persisting
ValidatedSemanticGraph view: recognised source-local provisions remain separate
rows and the unfamiliar proposition receives one typed `REVIEW_PENDING`
placeholder with evidence. Each has its own render boundary. This view is not a
SharedServingRow, cannot be bundled, cached as corpus output or queried as
market data, and cannot affect the current active release. Failure to classify
that one proposition therefore never hides the other extracted provisions.
After a candidate-local composer has established a typed `BLOCKED` result, the
pure BlockedResultPreviewDefinition builder may generate the non-persisted
`BLOCKED_RESULT_PREVIEW` response for that authenticated request. It performs no
DML and creates no carrier, candidate output or release trace member. Attempted
candidate freeze must fail with zero active-pointer or namespace change.

### Phase 8: Operations, traceability and continuous gates

Repair Admin to read live canonical staging tables. Replace processing-flow
stubs with run metrics, expose quarantine and residual queues, distinguish
current from target stages, and show candidate certification, active release,
correction application and rollback state.

Create one machine-readable traceability matrix covering every active route,
row, concept, extraction rule, claim, normaliser, metric, cohort, component,
query definition, operator, request and result schema, golden fixture and
certification, index or materialised view,
cache policy and corpus-coverage result. It also covers every immutable object,
mutable-head tuple and transition used to create or certify those outputs,
including:

- [The detailed Phase 8 traceability contracts](codex-program/canonical-contracts.md#phase-8-traceability-contracts), which are the sole authority for exact traceability identities, registries, phase extensions and terminal topology.

Add every existing invariant to CI and release certification. Recovery
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

The mandatory numbered closure tests are preserved exactly once in [adversarial-tests.md](codex-program/adversarial-tests.md). They remain binding traceability entries for the phases and contracts referenced by each test.

### Phase 9: Candidate certification and production release

Phase 9 is an immutable attestation chain. Each artefact is RFC 8785 canonical
JSON, schema-validated and addressed by a domain-separated SHA-256 digest. No
artefact may be edited, appended to or overwritten after another artefact
references its digest. A correction creates a new artefact and invalidates every
downstream reference.

The chain is:

1. `ContractFreezeAttestation` for the exact bundle fingerprint;
2. `OperationalPolicySet` and its four constituent manifests;
3. `CertificationPolicyManifest`;
4. current `IntakeProcessingPolicyHead` and activation, complete allowed
   activation-chain payloads, the complete frozen CutoffBuild and sealed
   CutoffPreparation chains, both CutoffPreparedRootSets,
   CutoffPreparedReconciliation, both complete control-receipt trees,
   CutoffPreparationControlReceiptReconciliation and CutoffPreparationSeal,
   both cutoff manifests, independence and reconciliation evidence,
   historical-governance and eligibility-dependency manifests,
   `IntakeCutoffAttestation`, its initial-mode recheck and current post-cutoff
   `IntakeEligibilityRecheckAttestation`;
5. the exact `CORPUS_SCOPE_FREEZE/OPEN_GENERATION` transition and its
   `SCOPE_GENERATION_OPENED` receipt, which open and select the complete
   post-freeze `ApplicabilityReexaminationRequirement` instance set before any
   local applicability member; then every scope or source-admission Entry and
   Slice produced only by `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/SINGLE_SUBJECT` or
   `DEAL_SCOPE_RUN/MATERIALISE_SCOPE/MULTI_SUBJECT_CORRECTION`; then exactly one
   complete `ScopeSubjectApplicabilityRoot` per governed scope subject; then its
   selecting DealScopeRunManifest and DealScopeRunReceipt and every required
   MultiSubjectScopeCorrectionReceipt/V2; followed by `CorpusScopeManifest` and
   `CorpusScopeFreezeAttestation`;
6. after that scope barrier, every required
   `DEAL_EXTRACTION_RUN/FAMILY_BUILD/MATERIALISE` family Entry and Slice,
   family result set, FamilyExtractionManifest, FamilyBuildTransition and
   receipt, then every DealSnapshot, DealExtractionRunManifest and
   DealExtractionRunReceipt; then both sealed release-input roots and
   reconciliation, both complete
   applicability-universe roots and every reachable node,
   `ApplicabilityReexaminationEnumeratorIndependenceAttestation`,
   `ApplicabilityReexaminationReconciliation`,
   `ApplicabilityReexaminationManifest`, every
   `MetricApplicabilityRequirementProjection`, the terminal
   `MetricApplicabilityRequirementProjectionSet`, the fresh materialisation-
   time `IntakeEligibilityRecheckAttestation`, `CandidateInputSeal`, then
   `CorpusRelease`, candidate outputs,
   `ReviewedSourceSpecificOutputClosure`, `CandidateOutputSeal` and
   `CandidateReleaseManifest`;
7. `CandidateReleaseFreezeAttestation`, FROZEN `CandidateBuildTransition` and
   its terminal receipt;
8. candidate object and blob projection roots;
9. current `CandidateInputRecheckAttestation`, `CURRENT_CANDIDATE`
   PromotionEligibilityProof and held `CandidatePromotionFence` version;
10. `DeploymentManifest`;
11. `POST_FREEZE` TraceabilityExtension;
12. `PreCutoverCertification`;
13. the ten-entry PromotionEvidence slot root, including the actual passing
    `QueryGoldenCertificationAttestation` bytes, support roots, both bundle member root sets,
    pre-output bundle-enumerator independence, all four ROLE_LAUNCH proofs and
    the one final CONTEXT_SEAL WalkerTrustStatusProof, all four one-use run claims and
    signed WalkerOutputSpoolCommitments, role-bound bundle-walker output
    attestations, all four successful ReleaseBundleSpoolErasureReceipts and the
    `SUCCESS_PRE_FINALISATION` ReleaseBundleSpoolErasureReceiptSetAttestation,
    exact ReleaseBundleWalkerSpoolCommitmentRoot, the complete output-set
    attestation, reconciliation controls, the exact FINALISED
    `ReleaseBundleControlContext` event, tuple and receipt and
    `ReleaseBundleEnvelope`;
14. complete import event, head and receipt chain, pre-output import-enumerator
    independence, all six ROLE_LAUNCH proofs and the one final CONTEXT_SEAL
    WalkerTrustStatusProof, all six one-use run claims and role-bound import-walker output
    attestations, all six signed WalkerOutputSpoolCommitments, all six `IMPORT_SUCCESS`
    ProductionWalkerSpoolErasureReceipts and their receipt-set attestation,
    exact ProductionImportWalkerSpoolCommitmentRoot and complete output-set attestation,
    governed receipt, member
    and support parity controls, ProductionBlobAvailabilityRoot and importer
    CompositionContractSetRecompositionRoot with all reachable nodes,
    `ProductionImportSeal`, the unique semantic-parity terminal slot, exact
    binding to the already frozen role registry and the new independence
    attestation, all three one-use semantic role
    slots, fresh ROLE_LAUNCH proofs, claims, all three signed
    WalkerOutputSpoolCommitments and role-bound outputs, all three `SEMANTIC_SUCCESS`
    ProductionWalkerSpoolErasureReceipts and their receipt-set attestation,
    exact ProductionSemanticParitySpoolCommitmentRoot, neutral trees, expected
    and physical governed output roots, two-role output
    set, reconciler output, terminal three-role output set, fresh semantic-
    parity CONTEXT_SEAL proof, all four production parity root pairs, covering
    observation, cohort, aggregate and
    `ProductionServingContractMetadataParityRootPair`,
    ProductionSemanticParityAttestation and all
    their reachable nodes, `ProductionImportAttestation` and terminal ATTESTED
    head, event and receipt;
15. passing `DeploymentParityAttestation` over the exact ATTESTED inactive
    production namespace, live serving role, production statistics and physical
    plan roots;
16. `POST_IMPORT` TraceabilityExtension covering that exact import and
    deployment-parity evidence;
17. a fresh, one-use `ActivationDeploymentParityRecheck/V1` over the current
    production statistics, actual planner outputs and deployment generations;
    then the first-cutover `DeploymentReadinessMirror` or later-cutover signed
    `OngoingReleaseReadiness/V2` and ISSUED readiness slot, and exact
    `CutoverAuthorisation`;
18. exact acknowledged BLOCKED `ServingFenceVersion`; one atomic
    `ActivationEvent`, `PostActivationControlContext` and
    `PostActivationControlHead(AWAITING_READY)` transaction with its
    `OPEN_WITH_ACTIVATION` event and `PostActivationControlReceipt`;
19. the context-bound `READY_CANONICAL` ServingFenceVersion and
    `AWAITING_POST_ACTIVATION_TRACE` control-head transition within its fixed
    deadline;
20. `POST_ACTIVATION` TraceabilityExtension and the corresponding
    `AWAITING_SMOKE` control-head transition;
21. passing `PostCutoverSmokeAttestation`;
22. one unexpired `PostActivationPassCommitLease`, its
    `ISSUE_PASS_COMMIT_LEASE` event, successor AWAITING_SMOKE head and receipt;
23. the atomic `COMMIT_PASS` and `PASS_FIXED`
    terminal CAS that also releases the AVAILABLE `CandidatePromotionFence`
    successor and, for the first canonical cutover, writes
    `ESTABLISH_FIRST_CANONICAL_RELEASE` and the terminal
    CanonicalCutoverGenesisHead;
23. exact `P9_TRACEABILITY` prefix evidence, then
    `ProgrammeCompletionAttestation`;
24. immutable proposed terminal programme-status artefact and its exact
    `ProgrammeStatusPublicationHead` predecessor;
25. `CompletionTraceCutoff`, fixed POST_COMPLETION context and signed
    completion-readiness lease over that context;
26. `POST_COMPLETION` TraceabilityExtension; and
27. atomic publication of the exact proposed-status and POST_COMPLETION pair
    through `ProgrammeStatusPublicationHead`, only from the `PASS_FIXED`
    post-activation context.

[The detailed Phase 9 release and traceability contracts](codex-program/canonical-contracts.md#phase-9-release-and-traceability-contracts) are the sole authority for the exact lock, release-manifest, bundle, walker and pre-cutover contract definitions.

The pre-cutover gates are:

- the exact ContractFreezeAttestation validates against the selected bundle,
  generated outputs, review dispositions, reviewer eligibility and Ben approval;
  it selects every exact PRE_FREEZE_CONTRACT SemanticStageOutputSetRoot and
  SemanticNeutralProjectionSetRoot, the byte-equal
  RelationshipEffectFieldUniverseSetRoot and their empty missing, extra and
  duplicate proofs;
  every selected scope, candidate, deployment and release artefact carries that
  same frozen pair and `P1_CONTRACT_FREEZE_ATTESTED` is mechanically `PASS`;
- exact bidirectional comparison proves receipt-ledger and independent intake
  equality and independent deal-document versus source and deal admission
  equality; LedgerCutoffStateManifest and IndependentCutoffStateManifest prove
  exact full-prefix object and payload equality under a passing
  CutoffEnumeratorIndependenceAttestation and CutoffStateReconciliation; the
  HistoricalIntakeGovernanceInventory and its two independent walkers cover
  every referenced policy, status, review and approval payload; the
  IntakeEligibilityDependencyManifest proves separate selected roots and a
  complete acyclic transitive replacement and exact-duplicate edge closure; the exact
  IntakeCutoffAttestation inventories every historical attempt, resolution,
  link, policy and event and selects one latest cutoff-eligible head per receipt;
  it and a current IntakeEligibilityRecheckAttestation bind the exact current
  IntakeProcessingPolicyHead tuple, activation and complete allowed activation
  chain and prove no selected root or transitive dependency has been revoked;
  both package-reader dependency intersections
  are empty, every member, physical record and raw byte reconciles recursively
  within ArchiveSafetyPolicyManifest and CapacityManifest bounds, and
  every admitted source has
  a passing CanonicalTextVerificationManifest with complete raw-part, rendered,
  independent-text, canonical-character and source-map coverage and zero
  unresolved discrepancy, names the exact SourceAdmissionRule object digest and
  carries either its rule-authorised deterministic zero-exception proof or one
  current passing SourceAdmissionApprovalAttestation;
- the text-only atomiser independently reproduces every
  PotentialDependencyUniverse; import-graph evidence proves the challenge and
  ordinary paths share no semantic implementation, applicability predicate,
  complete question-rule payload or generated expected value; the
  catalogue-blind IndependentLegalDimensionDiscoveryManifest has a complete
  atom partition and `W_open = PASS`: every discovered signal is in exactly one
  mapped, effective open-world or blocking partition, every effective
  non-blocking occurrence has one final disposition and reconciled impact
  closure, all current effective-terminal unresolved roots and the release-
  selected review queue are empty,
  and a non-empty `REVIEWED_SOURCE_SPECIFIC` partition is expressly permitted;
  exact comparison proves `B_base = O_base`,
  `Q_independent = Q_ordinary` field by field, total
  `B_question_state = O_question_state` and `B_slot = O_slot`; every
  challenge partitions every reconciled slot's admitted bytes exactly once, has
  zero `BLOCKING_UNRESOLVED`; the SemanticStageRegistry is total for every used
  stage and path, every semantic worker consumed only its declared envelope
  bytes, every review and attestation is ordered and self-contained, every
  semantic-to-governed mapping is functional and every applicable SOURCE_BUILD
  SemanticStageOutputSetRoot and SemanticNeutralProjectionSetRoot has empty
  missing, extra and duplicate sets; the exact
  RelationshipEffectFieldUniverseSetRoot is byte-equal to its producing generic
  stage root, both path-specific RelationshipEffectConstraintSetRoots are
  byte-equal to their producing roots and total over every accepted state and
  field, and exact semantic comparison proves `R = E`;
- import-graph evidence proves the independent and ordinary composition paths
  share no implementation, generated definitions, defaults, lineage or
  projector output; total composition coverage has zero unresolved disposition,
  both complete path SemanticStageOutputSetRoots precede every registered
  reconciler, every passing shard and parent comparison emits the exact
  ExpectedCompositionContractProjection and
  SemanticNeutralProjectionSetRoot, and exact comparison proves
  `K_contract(s) = D_contract(s)` for every shard plus exact per-deal and global
  parent partition equality;
- both independent CorpusScopeManifest enumerators, bound by exact terminal-
  PASS `InventoryEnumeratorIndependenceAttestation(CORPUS_SCOPE)`, prove exact set equality for
  every ArchiveSafetyPolicyManifest, SubmissionReceipt, IntakeLedgerEvent,
  ArchiveAttemptNode, IntakeProcessingAttempt, SubmissionExpansionManifest,
  IntakeUniverseManifest, ReceiptReplacementLink, IntakeResolution, complete
  receipt-local chain and selected-resolution map, both cutoff-state manifests,
  CutoffEnumeratorIndependenceAttestation, CutoffStateReconciliation,
  HistoricalIntakeGovernanceInventory and every payload it reaches,
  IntakeEligibilityDependencyManifest roots and transitive edges, current
  IntakeProcessingPolicyHead, activation and complete allowed chain,
  IntakeCutoffAttestation, IntakeEligibilityRecheckAttestation and intake entry,
  ImmutableSourceDocument, SourceAdmissionPreparationReceipt,
  SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
  ReviewedInferencePayload, SemanticGraphNormaliserDefinition and
  ValidatedSemanticGraph and its validation report,
  CanonicalTextVerificationManifest and required
  SourceAdmissionApprovalAttestation,
  IndependentDealDocumentManifest, AdmissionUniverseReconciliation, source,
  deal, family, AdmittedCoverageAtom,
  PotentialDependencyUniverse, discovered semantic,
  IndependentSemanticQuestionCatalogue and its catalogue reconciliation,
  SemanticStageRegistry and every applicable semantic input envelope, payload,
  review, attestation, semantic and governed ID, functional mapping,
  SemanticStageOutputSetRoot, NeutralStageProjection and
  SemanticNeutralProjectionSetRoot, exact
  RelationshipEffectFieldUniverseSetRoot and both path-specific
  RelationshipEffectConstraintSetRoots,
  independent legal-dimension discovery and mapping, every OpenWorldSemanticCandidate and
  OpenWorldCandidateOccurrence, both supersession kinds,
  every OpenWorldCandidateAdmissionTransition and transition-bound historical
  disposition,
  OpenWorldCandidateAuditChainRoot, OpenWorldEffectiveOccurrenceRoot and
  OpenWorldCandidateChainReconciliation, evidence closure, every primitive and
  OpenWorldPrimitiveCollectionRoot, final dispositions and their total
  manifest, both impact-walker outputs,
  SemanticImpactEnumeratorIndependenceAttestation and reconciled SemanticImpactClosure,
  exact scope-generation opening transition and receipt, every selected local
  ApplicabilityReexaminationRequirement, then every registry-owned Entry and
  Slice and every ScopeSubjectApplicabilityRoot, followed by the
  exact empty OpenWorldReviewQueueRoot, both question-universe
  manifests and their reconciliation, ChallengeBaseSubject,
  ChallengeQuestionDisposition,
  OrdinaryQuestionDisposition, ChallengeQuestionSlot, OrdinaryQuestionSlot,
  independent per-slot
  challenge entry and disposition, base-subject, question-disposition and slot
  reconciliation,
  RelationshipSemanticExpectation, ClaimScopeDependencyExpectation,
  ClaimScopeClosure, every independent and ordinary composition disposition,
  requirement, locality shard, deal and global totality root, shard and parent
  reconciliation, ExpectedCompositionContractProjection,
  CompositionScopeClosure, ExpectedOccurrenceSlot,
  ExpectedResultInputLineageSlot, DealScopeRunManifest,
  DealScopeRunReceipt, frozen ScopeSubjectHead map and predecessor-chain proof,
  exact scope-correction ledger, subject-head, CorrectionApprovalAttestation,
  CorrectionApplication, CorrectionApplicabilityProjection,
  CorrectionApplyReceipt, CorrectionApplicabilitySlice, CorrectionDischarge,
  CorrectionDischargeMap and
  digest, MultiSubjectScopeCorrectionReceipt/V2, exact events, applicability-slice
  roots and scope-correction-set roots,
  scope slice, CorpusScopeInventoryKindRegistry, both
  CorpusScopeInventoryRootSets, their neutral content digest and reconciliation
  and every reachable tree node, relationship-effect slot,
  metric and query-dimension slot,
  contract object, registry entry,
  route and job, schema, governed database object, test and traceability row.
  Post-extraction effect payloads and lineage digests are candidate-closure
  universes, not scope or challenge universes;
- the exact CorpusScopeFreezeAttestation is committed and selects the complete
  DealScopeRunReceipt set and its one-to-one referenced DealScopeRunManifest
  set; its FROZEN ScopeBuildTransition, CandidateInputEvent and receipt are
  complete, and candidate-closure enumerators prove that actual
  occurrences equal every ExpectedOccurrenceSlot identity payload, selected
  revision occurrences equal those actuals, every required family has one
  terminal FamilyBuildTransition, receipt and FamilyExtractionManifest, every
  selected DealSnapshot has one exact FROZEN DealExtractionBuildTransition and
  DealExtractionRunManifest and receipt, and every current scope or post-scope
  correction event has a complete supersession result, every effective active
  CorrectionApplication selects one current passing
  CorrectionApprovalAttestation and exactly one passing CorrectionDischarge to
  its exact primary output in the current map, and every currently superseded
  application selects zero current discharges while its earlier release-bound
  historical discharges remain immutable;
  bundle-generated requirement definitions and metric-slot bases contain no
  frozen-pair or later-instance identity; both sealed release-input roots and
  reconciliation contain the opening receipt, every scope-opened post-freeze
  Requirement, every later registry-owned Entry and Slice and every
  ScopeSubjectApplicabilityRoot before
  either applicability enumerator runs; the two disjoint applicability
  enumerators then cover the complete requirement-set and eligible-instance
  universe; their independence attestation, named reconciliation and
  candidate-wide ApplicabilityReexaminationManifest pass; every projection
  entry is then built and the terminal
  MetricApplicabilityRequirementProjectionSet closes before the fresh
  materialisation-time IntakeEligibilityRecheckAttestation, CandidateInputSeal
  and CorpusRelease, in that exact order.
  The manifest exactly matches every local Entry, Slice and scope subject root. Each requirement is
  either fully `EXAMINED`, permitting otherwise
  eligible observations, or retains every earlier unexamined member as
  `NOT_EXAMINED`, forces the affected result to
  `INCOMPLETE_NOVEL_SEMANTIC` with `NOT_CERTIFIED` comparability and proves zero
  observations, prevalence, denominators, ranges and aggregates for that item;
  unrelated result closures remain independently eligible;
  both independent CorpusRelease inventory root sets, bound by exact terminal-
  PASS `InventoryEnumeratorIndependenceAttestation(CORPUS_RELEASE_INPUT)`, have one equal neutral content digest,
  distinct governed IDs and a passing reconciliation and are sealed against the
  still-current CandidateInputHead, and the two complete
  CandidateOutputInventoryRootSets, bound by exact terminal-PASS
  `InventoryEnumeratorIndependenceAttestation(CANDIDATE_OUTPUT)`, cover the exact fixed
  CandidateOutputKindRegistry, have one common neutral content digest and are
  sealed against the final CandidateOutputPreparationHead; every closure
  dependency is discharged, every claim's
  exact CandidateRelationshipProjectionAttestation, registered candidate stage
  root and reconciliation prove `A_pre(c) = E_pre(c) = R_pre(c)`, the full
  selected relationship projection, attestation, stage root and reconciliation
  prove `A_all = E = R`; the exact
  CandidateCompositionContractProjectionAttestation, registered contract stage
  root and reconciliation prove
  `K_contract = D_contract = A_contract`; and the exact
  CandidateCompositionInstanceProjectionAttestation, registered instance stage
  root and CandidateCompositionInstanceConformance pass every contextual
  cardinality, anti-join and field predicate; both
  CompositionContractSetRecompositionRoots, their complete tree closures,
  CompositionContractSetEnumeratorIndependenceAttestation and terminal
  CompositionContractSetAttestation are current and passing; every effect and
  lineage payload validates; every ServingExactDetailReference follows its
  complete contextual selection path, appears in exactly one authorised parent
  use, resolves to the selected release payload and has no missing, extra,
  duplicate, orphan or wrong-parent edge; the
  CandidateReleaseObjectProjectionRoot and CandidateReleaseBlobProjectionRoot
  have exact neutral-content parity with, respectively, the complete manifest-
  expanded object universe and referenced immutable-blob universe under the
  frozen projection definition, with empty differences; and every independently recomposed output
  kind, including serving, aggregate and exact-detail typed key-and-payload-
  digest members, equals its materialised kind. Every selected
  DerivedResultRevision has exactly one canonical or incomplete row, every
  effective reviewed-source-specific occurrence has exactly one source-specific
  row and every affected row has its complete `OPEN_WORLD_EVIDENCE` detail
  closure. Candidate output-kind roots contain only those rows and details;
  CandidateOutputSeal directly selects exactly one
  ReviewedSourceSpecificOutputClosure, and the manifest member tree expands it
  exactly once. That closure proves the row bijection and empty metric-basis,
  projection, observation and exclusion anti-joins. Source-specific and
  incomplete rows have zero market observations,
  while every eligible metric slot has an observation if and only if its owner
  is `COMPLETE` and `COMPARABLE` and its exact intersecting applicability
  requirements are `COMPLETE_EXAMINED`; every other canonical slot has exactly
  one MarketMetricSlotExclusion,
  with empty
  differences in both directions; CandidateReleaseFreezeAttestation binds only
  the earlier candidate roots, seals and PREPARED/FROZEN chain, while
  PreCutoverCertification separately binds the later
  CandidateReleaseObjectProjectionRoot and CandidateReleaseBlobProjectionRoot;
  the fresh
  CandidateInputRecheckAttestation binds the exact later FROZEN
  CandidateBuildHead tuple, transition and receipt and those same two terminal
  projection roots with independently revalidated manifest and blob equality,
  and the selected CandidatePromotionFence remains the same unexpired HELD
  version;
- every entry in the frozen registry digest has one passing terminal
  disposition: `ADOPTED_CANONICAL`, `MAPPED_ALIAS`, an acyclic `MERGED_INTO`
  chain ending in an adopted entry, `REJECTED_INVALID` or
  `DORMANT_NOT_APPLICABLE`. Rejected or dormant entries require evidence, Ben
  approval and zero active references. Pending, suggested, flagged, blank and
  deferred never pass. Discovery of an OpenWorldSemanticCandidate does not add a
  registry entry or change the frozen digest. Only an approved alias, adopted
  canonical item or other governed registry disposition changes the successor
  bundle digest and invalidates work compiled against that successor;
- MKT-1, MKT-2 and MKT-3 are complete;
- every outstanding item in the Ben runbook is complete;
- canonical numeric schema migration and backfill are complete;
- source-conversion fidelity and product render-parity tooling are complete and
  green;
- structured-claim and relationship-effect validation and persistence
  enforcement are active;
- party-token lint is green;
- the security and client-auth decision is implemented, including recorded
  completion of the credential actions in Phase 0 without recording secrets;
- the full corpus is shadow re-extracted twice, with a third run for every
  disagreement and every high-risk family. A third-run disagreement is not
  resolved by majority vote: it requires human adjudication, any necessary
  contract or extractor revision and a fresh confirming run for every affected
  unit;
- logical occurrence identity is exactly stable, identical closure, effect,
  lineage and revision payloads reproduce identical IDs or digests, every
  identity-bearing payload difference produces a different downstream identity
  or digest, silent semantic drift is zero, the two residual-universe roots and
  reconciliation cover every registered residual carrier, every residual and
  every effective open-world occurrence has exactly one final reviewed
  disposition and reconciled impact closure, the
  GovernedResidualReviewQueueRoot and every current effective-terminal
  unresolved root are empty, and active
  compatibility-recovery counters are zero. This “zero unresolved residuals”
  gate does not require the reviewed-source-specific partition to be empty or
  every unusual source proposition to become canonical;
- full cross-view browser acceptance and visual regression have zero
  unexplained differences, accessibility has zero serious or critical
  violations, and the [canonical contract section 8](codex-program/canonical-contracts.md#8-governed-query-compiler-and-fast-result-delivery)
  API and browser performance budgets are green;
- current-production baseline smoke and staging-preview candidate smoke are
  green. Before the first canonical cutover, the one-time
  LegacyBaselineRollbackTarget, its staging-only rollback rehearsal, V3 tagged
  state and genesis-head ceremony are mechanically green. The rehearsal forces
  first-candidate failure, restores the exact legacy tuple and variant under a
  higher generation, proves `READY_LEGACY_BASELINE` routing and closes the one
  fixed no-recovery branch and terminal. Post-cutover smoke, automatic exposure
  containment and the fresh historical-reactivation ceremony are also rehearsed
  against staging after CandidateInputHead advances beyond the retained prior
  canonical release. That rehearsal
  restores the exact prior complete field tuple under a higher state generation,
  proves current policy, revocation, dependency, namespace, deployment and
  schema eligibility, emits the exact failure terminal and demonstrates that an
  old CandidateInputRecheckAttestation is neither current nor used;
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
- the harness counts exactly one bounded `consume_admission_token` RPC for every
  request, including 100% warm-cache traffic, proves its generated controller-
  head and token-slot index plan and zero corpus-row reads, and measures its
  connection occupancy separately from route-specific serving RPCs. Race both
  containment BEGIN actions against sustained token consumption: every request
  linearises as admitted before BEGIN and enters the drained lease set, or is
  rejected after BEGIN with zero cache or corpus access. The combined admission
  and serving workload must remain within the same CapacityManifest caps and
  connection reserve;
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
  while the importer completes ten batches; and corpus fixtures at
  `N_capacity` and `10N_capacity` proving unchanged route call and Node row/byte
  ceilings;
- `N_capacity` is the exact eight-field deal, observation, metric-slot,
  aggregate, serving-row, cohort-member, indexed-row and indexed-byte tuple of
  the sealed CandidateReleaseManifest fixture selected for import. Cohort
  members and logical index entries are independently enumerated across the
  exact distinct query-visible relations and indexes selected by the frozen
  query registry. `10N_capacity` is a deterministic tenfold expansion inside
  one query-visible active serving namespace. It remints every deal and all
  dependent observations, metric slots, aggregates, serving rows, cohort
  memberships and index-eligible rows, preserves the candidate's metric, party,
  value-state and cohort-selectivity distributions, and makes each governed
  benchmark query address a cohort ten times the corresponding `N_capacity`
  cohort. Its first seven fields are exactly ten times `N_capacity`. Its indexed-
  byte field is the measured sum of the closed selected index set after
  canonical-order fixture loading and index rebuilding under the frozen
  PostgreSQL and index-build settings, never a multiplied byte estimate. A
  separate multi-namespace isolation fixture proves routing isolation but
  cannot satisfy the scale test. “Maximum scale” is one deterministic,
  physically loaded fixture, not the field-by-field tuple alone. Its first
  seven construction targets are the larger of the corresponding measured
  `10N_capacity` values and CapacityManifest maxima. Starting from the exact
  `10N_capacity` rows, the frozen builder chooses the unique canonical
  non-negative multiplicity vector over schema-valid expansion archetypes that
  jointly realises all seven targets in one namespace, preserves required
  quotient and worst-case-witness cells and applies the frozen exact-rational
  distribution objective and UTF-8 tie-break. Every row retains source and
  parent fixture lineage. The builder then inserts in canonical order, rebuilds
  the closed index set and measures the eighth indexed-byte value from
  `pg_relation_size` under the frozen settings. CapacityManifest cannot freeze
  unless a scratch build and two independent enumerators reproduce the exact
  lineage, distribution, relation, index, per-index byte and measured-tuple
  roots. The load manifest selects that exact MaximumScaleFixtureManifest and
  rebuilds it byte-for-byte. An unrealizable target, smaller or independently
  assembled fixture, changed distribution, unbound synthetic set or multiplied
  byte estimate cannot satisfy the soak gate;
- in the no-fault steady and target-rate all-miss profiles, at least 99.9% of
  requests return a schema-valid successful response and achieved throughput is
  at least 99.9% of the fixed target, with zero admission, circuit-open or
  database-timeout responses. The twice-target burst must sustain successful
  throughput at or above the steady target; excess work may receive bounded 429
  admission responses at the fixed admission RPC before cache access or any
  corpus-serving checkout. Latency percentiles pass
  only if the corresponding success and throughput floor passes;
- after any injected controller, cache, database-latency, lock, cancellation or
  worker-death fault ends, successful target throughput and the
  [canonical contract section 8](codex-program/canonical-contracts.md#8-governed-query-compiler-and-fast-result-delivery)
  latency budgets recover within the greater of two configured circuit
  cooldowns or 60 seconds, without a queued or retry surge; and
- every normal and hostile profile has zero pool exhaustion, database-timeout
  leakage, connection-cap breach, retry storm or corpus-proportional call or
  Node-payload growth. The test separately accounts for exactly one fixed
  admission RPC on every request, including cache hits, and at most one
  route-specific serving RPC on a miss; admission rejection performs no cache or
  corpus-serving checkout. Recovery restores latency budgets, and one market
  request performs only those declared bounded calls. Indexed set aggregation inside Postgres remains permitted;
- backup restoration, first-cutover legacy-baseline restoration and active-
  canonical-corpus rollback are rehearsed successfully, and each failure path
  demonstrates one branch, one absorbing outcome and one terminal slot;
- independently discovered route, contract, ArchiveSafetyPolicyManifest,
  SubmissionReceipt, IntakeLedgerEvent, ArchiveAttemptNode,
  IntakeProcessingAttempt, SubmissionExpansionManifest, SourceContent, source
  occurrence, IntakeUniverseManifest,
  ReceiptReplacementLink, IntakeResolution, complete chain and
  selected-resolution map, current IntakeProcessingPolicyHead, activation and
  complete allowed chain, both cutoff-state manifests,
  CutoffEnumeratorIndependenceAttestation, CutoffStateReconciliation,
  HistoricalIntakeGovernanceInventory and every reached payload,
  IntakeEligibilityDependencyManifest root and transitive edge,
  IntakeCutoffAttestation,
  current IntakeEligibilityRecheckAttestation and intake source,
  ImmutableSourceDocument, SourceAdmissionPreparationReceipt,
  SemanticExtractionInputEnvelope, complete SemanticInferenceTranscript set,
  ReviewedInferencePayload, SemanticGraphNormaliserDefinition and
  ValidatedSemanticGraph and validation report, CanonicalTextVerificationManifest,
  SourceAdmissionApprovalAttestation,
  IndependentDealDocumentManifest,
  AdmissionUniverseReconciliation, deal, AdmittedCoverageAtom,
  PotentialDependencyUniverse, IndependentSemanticQuestionCatalogue,
  SemanticQuestionCatalogueReconciliation, SemanticStageRegistry and every
  SemanticComputationInputEnvelope, payload, semantic object, review,
  attestation, governed wrapper, functional mapping,
  SemanticStageOutputSetRoot, NeutralStageProjection and
  SemanticNeutralProjectionSetRoot, exact
  RelationshipEffectFieldUniverseSetRoot and every universe, both path-specific
  RelationshipEffectConstraintSetRoots and every constraint,
  IndependentLegalDimensionDiscoveryManifest,
  IndependentLegalDimensionMappingManifest, every OpenWorldSemanticCandidate
  and occurrence, both supersession kinds, every
  OpenWorldCandidateAdmissionTransition and transition-bound historical
  disposition, OpenWorldCandidateAuditChainRoot,
  OpenWorldEffectiveOccurrenceRoot, OpenWorldCandidateChainReconciliation,
  OpenWorldEvidenceClosure, every primitive and
  OpenWorldPrimitiveCollectionRoot, final disposition and disposition manifest,
  exact empty OpenWorldReviewQueueRoot, both SemanticImpactWalkerOutputs,
  SemanticImpactEnumeratorIndependenceAttestation and SemanticImpactClosure,
  ApplicabilityEligibleMemberKindProducerRegistry/V3, every
  frozen-pair-independent requirement definition and metric-slot basis, exact
  scope-generation opening transition and receipt, every selected post-freeze
  ApplicabilityReexaminationRequirement, then every registry-owned Entry and
  Slice and every ScopeSubjectApplicabilityRoot, both
  sealed release-input root sets and reconciliation, both complete
  candidate-wide applicability roots and every reachable node, their
  independence attestation, ApplicabilityReexaminationReconciliation and
  ApplicabilityReexaminationManifest, every
  MetricApplicabilityRequirementProjection, terminal projection set and
  exact materialisation-time IntakeEligibilityRecheckAttestation,
  CandidateInputSeal and CorpusRelease in that order, both
  semantic-question universe
  manifests and their reconciliation, ChallengeBaseSubject,
  ChallengeQuestionDisposition, OrdinaryQuestionDisposition,
  ChallengeQuestionSlot, OrdinaryQuestionSlot, per-slot challenge entry and
  disposition, base-subject,
  question-disposition and slot reconciliation,
  RelationshipSemanticExpectation, scope dependency, semantic reconciliation,
  ClaimScopeClosure, every independent and ordinary composition disposition,
  requirement, locality shard, deal and global totality root, shard and parent
  reconciliation, ExpectedCompositionContractProjection,
  CompositionContextKeyUniverseRoot, neutral content digest and every reachable
  BoundedInventoryTree node,
  CompositionScopeClosure, ExpectedOccurrenceSlot,
  ExpectedResultInputLineageSlot, DealScopeRunManifest,
  DealScopeRunReceipt,
  scope slice, every CorrectionApprovalAttestation, CorrectionApplication,
  CorrectionApplicabilityProjection, CorrectionApplyReceipt,
  CorrectionApplicabilitySlice,
  ManifestMembershipRevision, CorrectionDischarge,
  CorrectionDischargeMap and digest, MultiSubjectScopeCorrectionReceipt/V2,
  correction event and head,
  CandidateInputEvent and head, CorpusScopeInventoryKindRegistry, both
  CorpusScopeInventoryRootSets, common neutral content digest,
  CorpusScopeInventoryReconciliation and every reachable BoundedInventoryTree
  node, CorpusScopeManifest,
  CorpusScopeFreezeAttestation, ScopeBuildTransition and receipt,
  FamilyBuildTransition and receipt, FamilyExtractionManifest, DealSnapshot,
  DealExtractionBuildTransition and receipt, DealExtractionRunManifest,
  CandidateRelationshipActualProjection and
  CandidateRelationshipProjectionAttestation, exact candidate relationship
  reconciliation, CandidateCompositionImplementationCatalogueRoot, neutral
  catalogue digest and every reachable catalogue and source-artefact tree node,
  CandidateCompositionContractRealisationProjection,
  CandidateCompositionContractProjectionAttestation, exact candidate contract
  reconciliation, CandidateCompositionInstanceProjection,
  CandidateCompositionInstanceProjectionAttestation and
  CandidateCompositionInstanceConformance, both
  CompositionContractSetRecompositionRoots and every reachable tree node,
  CompositionContractSetEnumeratorIndependenceAttestation and terminal
  CompositionContractSetAttestation, every CandidateBuildTransition and
  receipt, candidate input
  and output shard, root and seal, CandidateReleaseFreezeAttestation,
  CandidateInputRecheckAttestation, CandidatePromotionFence and
  ReleaseIntakeDependencyProjection, certified common
  `composition_contract_set_digest`, expected
  relationship-effect, metric and query-dimension slot, serving access registry,
  embedded-reference allowlist, denylist, all three SharedServingRow variants,
  their state, completeness, comparability and reason fields, every
  OPEN_WORLD_EVIDENCE detail payload, reference and parent edge, every metric-
  slot observation or MarketMetricSlotExclusion, serving key, direct
  ReviewedSourceSpecificOutputClosure selection and its exact-once manifest
  expansion,
  QueryDefinitionSetRoot and every definition, QueryGoldenSuiteManifest and
  fixture, QueryGoldenCertificationAttestation, certified request, result,
  cursor and error schemas, generated RPC and index contracts and golden test sets
  exactly equal their scope and
  traceability stable-ID and canonical-payload-digest sets; selected
  released-object, semantic-root, projection-attestation, actual
  relationship-effect payload and ResultInputLineage digest sets exactly equal
  the CandidateReleaseManifest-expanded and traceability sets; and the released occurrence projection exactly equals
  scope while released payload-digest projections exactly equal the candidate
  manifest, with zero unmanifested or untraced IDs; and
- the exact DeploymentManifest is certified for the executable production
  system. Deployment parity recomputes the complete production release-
  statistics root and obtains canonical plans from the actual production
  PostgreSQL planner for every certified execution class and worst-case witness
  under the deployed serving role, RPC, prepared-statement mode and
  configuration. Both roots and complete member sets must equal the certified
  roots before cutover. Live smoke repeats the same plan probe for every class
  it exercises and contains exposure on any drift.

Phase 9 cannot advance on prose conformance. The mechanical acceptance set must
also pass `APPLICABILITY-RELEASE-ORDER-01`,
`SOURCE-SPECIFIC-CLOSURE-ACYCLIC-01`, `QUERY-GOLDEN-EVIDENCE-SLOT-01`,
`RELEASE-BUNDLE-ABANDONMENT-01`, `RELEASE-BUNDLE-CONTEXT-RACE-01`,
`RELEASE-BUNDLE-SPOOL-GC-01`, `IMPORT-SEMANTIC-PARITY-01`,
`IMPORT-SEMANTIC-PARITY-INDEPENDENCE-01`,
`IMPORT-SERVING-METADATA-PARITY-01`, `IMPORT-LIFECYCLE-01`,
`LOCK-PAIRWISE-CREATION-SLOT-01`, `LOCK-ORDER-01`,
  `POST-ACTIVATION-CONTROLLER-01`, `POST-ACTIVATION-TRIGGER-01`,
  `CONTAINMENT-REVOCATION-CONVERGENCE-01`,
`POST-ACTIVATION-LATE-PASS-01`, `POST-ACTIVATION-FAULT-BOUNDARY-01`,
`LEGACY-RESTORATION-TRANSACTION-01` and
`LEGACY-RESTORATION-TRACE-UNION-01` against the same frozen pair and generated
registries. Any skipped, quarantined or manually waived result is a failure.

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

After those gates, import, parity, activation, containment, restoration and completion follow [the detailed Phase 9 release and traceability contracts](codex-program/canonical-contracts.md#phase-9-release-and-traceability-contracts).

## Sequencing and ownership

- Generated programme-gate status authority is the sole sequencing authority.
  Programme completion additionally requires its atomic terminal pair. With the
  status artefact absent, only specification review and emergency containment
  are normally permitted. The one-use `gate_status_bootstrap` exception has
  predecessor `NONE` and the registry-bound nonce
  `gate-status-bootstrap-2026-07-27-v1`. Its scope is the closed list in the gate
  registry. It expires when the protected publisher consumes that nonce
  during the first valid `ProgrammeGateStatusArtefact/V2` publication, at
  generation 1 from predecessor `NONE`, with `canonical_work_start: PASS`.
  Before that genesis publication, the same closed bootstrap authority permits
  only G0 containment and security evidence collection plus isolated empty-
  staging and preview-access boundary setup. The genesis publisher validates
  those envelopes and derives the proposed gate and work-class projection in
  one pass. It never reads `canonical_work_start` from an absent predecessor.
  It cannot be reused or reissued without another governing registry amendment.
  An owner statement cannot create or extend this authority. Thereafter each
  work class opens only through its registry dependencies. Bounded implementation
  planning requires
  `implementation_planning`; isolation-boundary setup requires its three
  security dispositions. A production-snapshot restore or data-bearing preview
  additionally requires isolated project identities and default-deny access
  protection. No post-containment factual baseline, canonical implementation or
  canonical data work begins until `canonical_work_start` is green.
- Ordinary status publication uses the repository-native
  `refs/heads/programme-status-publication-head` as its single publication head.
  A protected GitHub Action reads the exact predecessor Git object ID, validates
  the complete status projection and updates the ref with one compare-and-swap.
  A stale predecessor makes no ref change. The first V2 status is a genesis
  event at generation 1 with predecessor `NONE`. It includes all 35 gates once
  in registry order. Every unsupported P1 and P9 gate remains `OPEN`. Manual
  edits and owner-deemed states do not pass validation.
- `ProgrammeStatusPublicationHead` is only that Git ref. It is not a database
  row and is excluded from database lock plans. Programme completion first
  commits the immutable status-plus-POST_COMPLETION pair to a database
  `CompletionTerminalPairAttempt` keyed by status generation, exact Git
  predecessor and proposed-status digest; the protected publisher then revalidates that
  exact pair and advances the Git ref by compare-and-swap. Until the Git ref
  points to a status binding that pair, `programme_complete` remains `OPEN`.
  A failed Git update leaves a non-current immutable pair that may be retried
  against the same predecessor after full revalidation. If the Git head has
  advanced, the protected publisher appends an immutable stale-attempt
  abandonment and a fresh attempt is fully recomputed at the next generation.
  Old attempts never occupy a global one-use slot. No cross-system atomic
  transaction is claimed.
- The existing generation-4
  `docs/certification/programme-gate-status.json` file is a historical V1
  owner-deemed record. It is not a V2 predecessor, evidence source, publication
  head or executable authority. The first V2 publication uses
  `docs/certification/programme-gate-status-v2.json`.
- After contract freeze, `vertical_slice_execution` permits only the bounded
  reviewed staging fixture and the ordered thin Phase 1 through 7 path described
  above. `P1_VERTICAL_SLICE_PASS` requires its full source-to-UI and bounded-
  database acceptance evidence. Broad source-specific scope compilation,
  challenge, extraction, reprocessing, backfill and candidate-release work
  require `candidate_scope_and_extraction`, which cannot open until that slice
  passes. Generic machinery may be implemented earlier where its existing work
  class permits it, but no deal data may bypass these controls.
- A stale, absent or invalid status artefact blocks work. No agent, reviewer,
  branch status, prose statement or prior approval may infer a pass. Fable or an
  independent 5.6 Sol reviewer using extra-high reasoning must approve the
  legal-semantic, identity and extraction design, all five exact-digest cold-
  review lanes above must pass on the same specification root, and Ben must
  approve that exact root.
- Phase 0's factual baseline and Phase 1's contract follow. The first delivery
  track then builds one thin vertical slice in dependency order: Phase 2
  identity and writer kernel, Phase 3 scope and extraction writer actions, Phase
  4 normalisation, Phase 5 correction and candidate-release writer actions,
  Phase 6 serving and bounded query, and Phase 7 shared-row rendering. Passing
  that slice opens parallel family expansion through the same contracts. Phase
  8 instruments and traces the system. In Phase 9, certified import and parity open only
  `cutover_authorisation_issue`; Ben's exact authorisation then advances the
  successor status and readiness generation that alone opens
  `production_cutover` and activation.
- This programme is not implemented through one monolithic plan. After the gate
  registry permits planning, each emergency, environment, phase or
  independently shippable architectural slice receives its own bounded
  implementation plan, acceptance set and rollback. A later plan may depend on
  a certified earlier slice but cannot silently widen its scope or waive a gate.
- Agents draft. Fable or an independent 5.6 Sol reviewer using extra-high
  reasoning reviews every legal-semantic, identity and extraction diff. Ben
  decides taxonomy and codebooks through the Freeze Gate. No such diff merges
  unreviewed.
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
  R7→Phase 3 (reviewed by Fable or an independent 5.6 Sol reviewer using
  extra-high reasoning), R9→Phase 1 vocabulary work
  (Ben-gated), R10→independent cosmetic. Product work that touches shared rows
  also enters the Phase 8 traceability matrix.

## Binding cold-review closure

The later, detailed closure contract in
`docs/codex-program/canonical-contracts.md` section 10 controls any conflicting
earlier shorthand. In particular:

- the reviewed bootstrap acceptance source is the authoritative frozen source
  for ten genesis G0 definitions and the pre-bundle P1 definition, and the
  controller, runtime, prompt and validator allowlists are fixed in
  `programme-gates.yaml`;
- production blob availability has one registered verifier action and
  idempotent writer transaction before pre-seal root construction;
- CapacityManifest binds the deterministic, jointly realised
  MaximumScaleFixtureRecipe and its exact lineage, distribution and physical
  index-measurement roots. Database and API execution shapes use
  `DATABASE_API`; carried-response transitions use the disjoint
  `CLIENT_ONLY_NO_SQL_NO_API` registry and have a separate browser-only
  zero-effect timing obligation. Every class reconciles to its tagged golden
  and performance fixture, the originating serving RPC returns one bounded
  response without a result-page persistence write, and latency gates cover
  every interactive class without inventing SQL or API evidence for a client
  transition;
- residual contracts are CanonicalContractBundle members, source-specific
  publication binds the actual eligible legal review and selected PRESENT
  primitive, and scope- or contract-impacting novel propositions block only
  their governed occurrence and transitive closure while unaffected siblings
  continue to render;
- every successful activation produces a terminal PASS
  ReleaseActivationCertification. The first creates the genesis ongoing
  promotion head and is selected by programme completion. Later promotions use
  only deployment-controller-issued, trusted-signature
  `OngoingReleaseReadiness/V2`, an exact ISSUED-to-CONSUMED readiness-slot
  transition and exact-predecessor head CAS, and never increment the absorbing
  completed programme-status head. Cutover authority also selects a fresh
  ten-minute activation parity recheck that is consumed and currentness-tested
  before release-state DML. A deployment-parity failure after import attestation
  uses the existing `ABANDON_IMPORT` action's closed ATTESTED predecessor
  variant and cannot strand or activate the inactive namespace.
