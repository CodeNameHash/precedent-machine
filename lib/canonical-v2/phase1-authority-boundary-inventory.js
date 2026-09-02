'use strict';

const PHASE1_BASE_COMMIT = '6c446b171537768a6560534ff6338e048b4eb7cc';

const PURE_PROPOSAL_SOURCES = Object.freeze([
  // Browser-only view state: a sessionStorage-backed toggle deciding whether
  // collapsed clause text is exposed to the browser's find-in-page. It reaches
  // none of the seven scanned capabilities. sessionStorage is not
  // filesystem_write: it is per-tab browser memory, discarded on close, never
  // touching the repository or any server. Classified here rather than under
  // PRODUCTION_PATH_PURE_ANALYSIS because that class additionally forbids any
  // module dependency, and this one imports React.
  'components/review-v2/clauseSearchMode.js',
  'components/review-v2/SevenFamilyV1Surface.jsx',
  'components/review/table-configs/canonical-v2-preview-lane.js',
  // Termination Rights V2 review grouping/renderer. React-only view of
  // already-assembled review rows. No filesystem, database, network, or
  // model capabilities. Same class as the preview lane above.
  'components/review/table-configs/termination-rights-review-groups.js',
  // Filesystem-driven pages/api/** enumerator for the S2 auth-coverage test
  // (tests/auth-route-enforcement.test.js: a route "nobody remembered to
  // classify" is refused automatically). Capability-free, and -- unlike
  // every other file added for the S2 authentication layer -- genuinely not
  // live: its own header says it is "never imported by middleware.js or any
  // page; only by tests/auth-route-enforcement.test.js and, if regenerated,
  // docs/API-ROUTE-CLASSIFICATION.md's route list", independently confirmed
  // by grepping the whole tree for its only importers. That is what earns it
  // PURE_PROPOSAL rather than the new LIVE_REQUEST_AUTHORIZATION class below:
  // it is test/doc-support tooling FOR the live mechanism, not part of it.
  'lib/auth/route-scan.js',
  'lib/canonical-v2/antitrust-v1-surface-disposition.js',
  'lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js',
  'lib/canonical-v2/calibration-harness.js',
  'lib/canonical-v2/certification-policy-manifest-proposal.js',
  'lib/canonical-v2/company-employee-definition-owner-routing.js',
  'lib/canonical-v2/content-reviewed-definition-reclassification-contract.js',
  'lib/canonical-v2/corpus-source-discovery-capture.js',
  'lib/canonical-v2/dark-bridge-gate.js',
  'lib/canonical-v2/dark-integration-preflight.js',
  'lib/canonical-v2/deal-identity-allocation-readiness.js',
  'lib/canonical-v2/deal-identity-persistence-controller-interface.js',
  'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  'lib/canonical-v2/decision-reconciliation-proposal.js',
  // Rebuilds an extraction run's admitted-source chain from the committed raw
  // HTML the run names, so the canonical writer can verify the lineage rather
  // than accept the caller's assertion of it (PLAN.md Step 2B). Filesystem
  // READS only -- one raw HTML file and one source-reference.json, both named
  // by the run -- and pure derivation thereafter. Writes nothing.
  'lib/canonical-v2/admitted-source-chain-rebuild.js',
  // The serving-side governed/ungoverned boundary added for Ben's decision 2
  // (2026-08-07). None of the seven capabilities. Classified here rather than
  // PRODUCTION_PATH_PURE_ANALYSIS for the reason that class states at the top
  // of this file: it forbids any module dependency, and this imports one.
  // The distinction is about dependencies, not about liveness -- this file is
  // live product behaviour, since it decides whether a row is shown to a
  // lawyer as a governed claim. An adversarial review broke its original
  // absence-based check by execution the same day; it now requires
  // schema_version CLAIM_REVISION/V1 outright.
  'lib/canonical-v2/open-world-evidence-serving.js',
  'lib/canonical-v2/open-world-promotion-candidates.js',
  // Step 2X-G promotion gate: deal-count recurrence (3–4), confidence,
  // fail-closed collision against 2X-J CONSUME. Reads the dispositions
  // markdown (filesystem READ only) when loading consume vocabularies;
  // never writes. Callers that land a promotion still own the resolver
  // edit. Cannot be PRODUCTION_PATH_PURE_ANALYSIS (module deps + fs read).
  'lib/canonical-v2/open-world-promotion-gate.js',
  'lib/canonical-v2/open-world-promotion-review-packet.js',
  // Step 2X-F detector harness adapter: rebuilds admitted source + calls
  // extractTransactionSteps. Reads evidence only; no writes.
  'lib/canonical-v2/sections-for-transaction-detector.js',
  'lib/canonical-v2/source-map-payload-store.js',
  // Step 2X-I model/detector topology merge. Pure derivation over claim rows
  // + detector steps; no I/O. Module deps (topology-detector) keep it out of
  // PRODUCTION_PATH_PURE_ANALYSIS. Not yet wired to review UI or Postgres.
  'lib/canonical-v2/deal-topology-from-claims.js',
  'lib/canonical-v2/derived-comparison.js',
  // DERIVED_LIMB/V1 identity helper (design stub). Mints a content id from
  // { canonical_text_id, marker_start_byte } only. Depends on
  // ./canonical-bytes so it cannot be PRODUCTION_PATH_PURE_ANALYSIS. Not
  // wired into any live mint path — annotation/design only until the
  // marker-start stability gate opens (DECISIONS.md §15).
  'lib/canonical-v2/derived-limb-identity.js',
  'lib/canonical-v2/durable-artifact-root.js',
  'lib/canonical-v2/general-covenants-dark-bridge.js',
  'lib/canonical-v2/governed-identity-proposal-packet.js',
  'lib/canonical-v2/governed-identity-readiness-descriptor.js',
  'lib/canonical-v2/governed-identity-trust-contracts.js',
  'lib/canonical-v2/human-anchor-review.js',
  // Reads an extraction run's evidence directory, re-validates its write-set
  // against the current contract, and hands it to the canonical writer
  // (PLAN.md Step 2B write half). Filesystem READS only -- it writes nothing
  // itself; the repository it is handed owns any persistence, and the caller
  // supplies it. Defaults to dryRun so calling it without thinking does not
  // write.
  'lib/canonical-v2/evidence-to-write-set-bridge.js',
  'lib/canonical-v2/identity-consumer-closure-audit.js',
  'lib/canonical-v2/identity-human-review-projection.js',
  'lib/canonical-v2/legacy-card-bridge.js',
  'lib/canonical-v2/merger-structure-closing-product-projection.js',
  'lib/canonical-v2/metsera-comprehensive-selection-review.js',
  'lib/canonical-v2/metsera-pilot-extension-proposal.js',
  'lib/canonical-v2/metsera-pilot-extension-readiness.js',
  'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  'lib/canonical-v2/native-producer/family-absence-coverage-attestation.js',
  'lib/canonical-v2/native-producer/family-detection-profiles.js',
  'lib/canonical-v2/native-producer/candidate-governing-context.js',
  'lib/canonical-v2/native-producer/corroboration-ladder.js',
  'lib/canonical-v2/native-producer/duplicate-suppression.js',
  // Derives a family -> [section_reference] proposal for a document by
  // sectionizing it and running the stage-1 deterministic classifier over
  // the dispatchable nodes (PLAN.md Step 2A). Reads only: no filesystem
  // write, no database, no network, no model call. Its output is a proposal
  // for a human to review before anything is pinned, which is what earns
  // PURE_PROPOSAL. Cannot be PRODUCTION_PATH_PURE_ANALYSIS because that
  // class forbids module dependencies and this imports four. Same class as
  // full-corpus-routing-prompt-cost-audit.js below, which does the same
  // composition for a fixed audit cohort and is this module's precedent.
  'lib/canonical-v2/native-producer/family-section-ref-generator.js',
  'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js',
  // Step 2X-A structure-context service + placement annotation. Composes
  // subclauses.js / utf8 helpers; cannot be PRODUCTION_PATH_PURE_ANALYSIS.
  // Derived structure annotates only — never gates model input or
  // corroboration (DECISIONS.md §15).
  'lib/canonical-v2/native-producer/governing-structure.js',
  'lib/canonical-v2/native-producer/structure-placement.js',
  'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
  'lib/canonical-v2/native-producer/general-covenant-corroboration.js',
  // PLAN.md Step 3I ("payment timing"). A pilot-only sidecar, same shape and
  // same authority class as its pre-existing sibling `modiv-termination-fee-
  // source-parser.js` (predates PHASE1_BASE_COMMIT, so uncatalogued here,
  // but identical in kind: regexes the admitted source text directly
  // against Modiv's own hardcoded sentences, gated on every expected
  // fee-trigger branch being present first). Cannot be PRODUCTION_PATH_PURE_
  // ANALYSIS because that class forbids module dependencies and this
  // imports one (`../canonical-bytes`, for `contentId`). No filesystem,
  // network, database, provider, signing, external-process or deployment
  // capability -- pure string/regex derivation from a caller-supplied
  // string, same as `ioc-mechanic-resolution.js` immediately above.
  'lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-parser.js',
  // Record/replay wrappers around an Anthropic client, so an extraction run
  // can be re-scored against fixed model output instead of a fresh sample
  // (PLAN.md Stage 2's blocking prerequisite; Ben ruled 2026-08-06 for a
  // replay path over a tolerance policy). No filesystem access of its own --
  // the recorder hands the finished recording to a caller-supplied sink, and
  // the replayer is given a parsed recording, so the writing stays with the
  // script that owns it. It wraps a client the caller already holds; it
  // never constructs one and never reads a credential.
  'lib/canonical-v2/native-producer/provider-record-replay.js',
  'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js',
  'lib/canonical-v2/native-producer/replay-invalidation-planner.js',
  'lib/canonical-v2/native-producer/representation-qualifier-dispatch-measurement.js',
  'lib/canonical-v2/native-producer/representation-topic-ladder.js',
  'lib/canonical-v2/native-producer/same-deal-defined-term-resolution.js',
  'lib/canonical-v2/native-producer/semantic-safety-preflight.js',
  'lib/canonical-v2/native-producer/sole-remedy-resolution.js',
  'lib/canonical-v2/native-producer/unified-prompt-budget-preflight.js',
  'lib/canonical-v2/neutral-defined-term-comparison-consumer.js',
  'lib/canonical-v2/no-other-reps-fraud-dark-bridge.js',
  'lib/canonical-v2/no-other-reps-fraud-review-projection.js',
  'lib/canonical-v2/no-shop-product-projection.js',
  'lib/canonical-v2/operational-policy-set-proposal.js',
  'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
  'lib/canonical-v2/publication-disposition.js',
  'lib/canonical-v2/publication-serving-filter.js',
  'lib/canonical-v2/representation-topic-registry.js',
  'lib/canonical-v2/representation-topic-review-ledger.js',
  'lib/canonical-v2/phase1-authority-boundary-inventory.js',
  // Content-based provision -> current-section attribution (span accounting
  // spec, Part 3 rollout gate 1). Deterministic, no LLM, capability-free.
  // Depends on ./span-claims so it cannot be PRODUCTION_PATH_PURE_ANALYSIS
  // (that class additionally requires a dependency-free leaf); used only by
  // its own test and by scripts/span-residual-baseline.js, an offline
  // analysis script -- never imported by a page or API route, so it is not
  // live product behaviour the way lib/parse-money.js below is.
  'lib/parser-v2/attribute-provision-section.js',
  'lib/query/dark-authority-fence.js',
  // The review-parity harness: it compares the legacy and Canonical V2 views of
  // a family and reports whether they say the same thing. It proposes a
  // verdict and changes nothing -- no database, no network, no writes. The two
  // CLI entry points that do write are classified as artefact writers below.
  'lib/review-parity/case-file.js',
  'lib/review-parity/compare.js',
  'lib/review-parity/mapping.js',
  'lib/review-parity/normalise.js',
  'lib/review-parity/rendered-row-preview-contract.js',
  'lib/review-parity/rendered-row-preview.js',
  'lib/review-parity/report.js',
  'lib/review-parity/run.js',
  'lib/review-parity/views.js',
  'lib/canonical-v2/representations-dark-bridge.js',
  'lib/canonical-v2/review-preview-assembly.js',
  'lib/canonical-v2/routine-primary-source-disposition-policy.js',
  'lib/canonical-v2/source-intake-readiness.js',
  'lib/canonical-v2/source-verification-state.js',
  'lib/canonical-v2/stage-2y-joint-sweep.js',
  'lib/canonical-v2/source-exception-approval-contract.js',
  'lib/canonical-v2/source-universe-inventory-candidate.js',
  'lib/canonical-v2/source-universe-inventory-planner.js',
  // Same species as dark-bridge-gate.js, canonical-v2-preview-lane.js and
  // review-preview-assembly.js already in this list: env-gated preview/serving
  // machinery that is unreachable in production, reads files and hashes them,
  // and exercises none of the seven authority capabilities.
  'lib/canonical-v2/termination-fee-serving-source.js',
  'lib/canonical-v2/termination-rights-review-attachment.js',
  'lib/canonical-v2/termination-rights-review-rows.js',
  'lib/canonical-v2/termination-rights-review-serving-source.js',
  'lib/canonical-v2/topbuild-legal-text-delta.js',
  'lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet.js',
  'lib/canonical-v2/topbuild-section-delta-review-queue.js',
  'lib/canonical-v2/topbuild-two-occurrence-review-packet.js',
  'lib/canonical-v2/v1-capture-evidence-proposal.js',
  'lib/canonical-v2/v1-replay-evidence-proposal.js',
  'lib/canonical-v2/v1-trusted-capture-control-contracts.js',
  'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js',
  'scripts/canonical-v2-corpus-source-discovery-capture.js',
  // Offline analysis harness for the citation-scope design question
  // (docs/codex-program/notes/citation-scope-design.md): reproduces the
  // committed source-admission pipeline against the already-committed raw
  // HTML fixture and the deterministic sectionizer, and reads three
  // already-committed recorded-response fixtures. No writeFileSync
  // anywhere in the file; no live network fetch (the capture step reuses
  // local bytes and re-verifies the pinned hash, the same "no live fetch"
  // shape the live run script's own Step 1 already uses); no model call;
  // no child_process. Reports findings to stdout only -- same species as
  // lib/review-parity/report.js above (proposes/reports, changes nothing).
  'scripts/canonical-v2-citation-scope-resolution-harness.mjs',
  // Shared, capability-free stop gate for every deferred Phase B live model
  // route. It makes no call and writes nothing; live executors must pass it
  // before they reach provider or child-process authority.
  'scripts/stage-2y-phase-b-live-authority.mjs',
  // Step 2X-G / 2X-L1 offline scanners: read committed evidence, report to
  // stdout (optional --json). No writeFileSync on the default path.
  'scripts/audit/step-2x-g-open-world-promotion-scan.js',
  'scripts/canonical-v2-redhat-reps-limb-disposition.mjs',
  'scripts/lint/resolution-registry-duplicates.js',
  'scripts/plan-v1-render-capture.js',
  'scripts/reprocess/v1-apply-guard.js',
  // Step 2X-B HOLD scaffolds: V1 presentation / legacy assertion matchers
  // consulted as report-only second chances. Capability-free; imported by
  // the resolver (GC) or corpus-pass report scripts. Cannot be
  // PRODUCTION_PATH_PURE_ANALYSIS (module deps on rubric / normalisers).
  'lib/vocab/general-covenant-rubric-presentation.js',
  'lib/vocab/guaranty-assertion-legacy.js',
  'lib/vocab/resolution/closing-condition-kinds-registry.js',
  'lib/vocab/resolution/general-covenant-registry.js',
  'lib/vocab/resolution/interim-operating-registry.js',
  'lib/vocab/resolution/material-contract-registry.js',
  'lib/vocab/resolution/materiality-qualifier-registry.js',
  'lib/vocab/resolution/party-capacity-registry.js',
  'lib/vocab/resolution/registry-fingerprint.js',
  'lib/vocab/resolution/registry-substrate-manifest.js',
  'lib/vocab/resolution/registry-values.js',
  'lib/vocab/resolution/representation-topic-registry.js',
  'lib/vocab/tax-cooperation-legacy.js',
  // Citation-following implementation (docs/codex-program/notes/citation-
  // scope-design.md Part 6; docs/codex-program/notes/citation-following-
  // implementation.md), same species as sole-remedy-resolution.js and
  // ioc-mechanic-resolution.js already in this list: deterministic quote
  // classification (bare-citation-trigger-parser.js has zero dependencies
  // at all) and dispatch orchestration (native-extraction-run-citation-
  // followup.js composes runNativeExtraction -- itself PRODUCTION_PATH_
  // PURE_ANALYSIS-adjacent proposal machinery, not a live capability --
  // and the deterministic sectionizer). Neither performs a live model call
  // itself, writes a file, opens a network connection, signs anything,
  // spawns a process, or touches a database; both propose candidates and
  // a merged run receipt for a caller to act on, exactly like every other
  // resolver-support module in this list.
  'lib/canonical-v2/native-producer/bare-citation-trigger-parser.js',
  'lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js',
  // MAE clause_label verification (docs/codex-program/notes/mae-clause-
  // label.md): same species as bare-citation-trigger-parser.js immediately
  // above -- deterministic string-position logic (zero dependencies, zero
  // requires at all) that candidate-resolution.js calls to decide whether a
  // clause_label/prong_label genuinely denotes a candidate's own quote,
  // before that candidate is allowed to resolve. It never reads a file,
  // calls a model, opens a network connection, signs anything, spawns a
  // process, or touches a database; it proposes a verification verdict for
  // the resolver to act on, exactly like every other resolver-support
  // module in this list.
  'lib/canonical-v2/native-producer/mae-clause-label-parse.js',
  'lib/canonical-v2/agreement-analysis-consolidation.js',
  'lib/canonical-v2/agreement-analysis.js',
  'lib/canonical-v2/agreement-index.js',
  'lib/canonical-v2/agreement-inline-structure.js',
  'lib/canonical-v2/agreement-projection.js',
  'lib/canonical-v2/context-compilation.js',
  'lib/canonical-v2/family-adapter.js',
  'lib/canonical-v2/family-compound-adapter.js',
  'lib/canonical-v2/family-role-schema-authority.js',
  'lib/canonical-v2/m7-deterministic-generalisation.js',
  'lib/canonical-v2/m7-source-admission.js',
  'lib/canonical-v2/m7-v2-antitrust-regulatory-authoring.js',
  'lib/canonical-v2/m7-v2-appraisal-dissenters-rights-authoring.js',
  'lib/canonical-v2/m7-v2-closing-conditions-authoring.js',
  'lib/canonical-v2/m7-v2-consideration-authoring.js',
  'lib/canonical-v2/m7-v2-contract.js',
  'lib/canonical-v2/m7-v2-deterministic-generator.js',
  'lib/canonical-v2/m7-v2-dividends-authoring.js',
  'lib/canonical-v2/m7-v2-dno-indemnification-authoring.js',
  'lib/canonical-v2/m7-v2-employee-matters-authoring.js',
  'lib/canonical-v2/m7-v2-financing-covenants-authoring.js',
  'lib/canonical-v2/m7-v2-general-covenants-authoring.js',
  'lib/canonical-v2/m7-v2-guaranty-financing-party-authoring.js',
  'lib/canonical-v2/m7-v2-interim-operating-authoring.js',
  'lib/canonical-v2/m7-v2-key-defined-terms-authoring.js',
  'lib/canonical-v2/m7-v2-mae-definition-authoring.js',
  'lib/canonical-v2/m7-v2-material-contracts-authoring.js',
  'lib/canonical-v2/m7-v2-merger-structure-closing-authoring.js',
  'lib/canonical-v2/m7-v2-misc-boilerplate-authoring.js',
  'lib/canonical-v2/m7-v2-no-other-reps-fraud-authoring.js',
  'lib/canonical-v2/m7-v2-no-shop-authoring.js',
  'lib/canonical-v2/m7-v2-profile-authoring.js',
  'lib/canonical-v2/m7-v2-proxy-meeting-authoring.js',
  'lib/canonical-v2/m7-v2-representations-authoring.js',
  'lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js',
  'lib/canonical-v2/m7-v2-tax-matters-authoring.js',
  'lib/canonical-v2/m7-v2-termination-fee-authoring.js',
  'lib/canonical-v2/seven-family-grouping-preview-source.js',
  'lib/canonical-v2/seven-family-v1-preview-deal.js',
  'lib/canonical-v2/seven-family-v2-review-evidence.js',
  'lib/canonical-v2/structure-representation-topics.js',
  'pages/design/canonical-v2-seven-family.js',
  'scripts/lib/stage-2y-structure-context-prototype.mjs',
  'scripts/lib/stage-2y-structure-m7-v2-family-package-fixture-closure.mjs',
  'scripts/lib/stage-2y-structure-semantic-prototype.mjs',
  'scripts/lib/stage-2y-structure-source-prototype.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-verify-candidate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work1-validate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work2-validate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work3-validate.mjs',
  'scripts/stage-2y-structure-m7-v2-work3-fixture-proof-crosscheck.mjs',
]);

// A PURE_PROPOSAL file in every respect but one. Validating a *proposed*
// future evidence-acceptance contract requires checking that a submitted
// collector signature actually verifies -- crypto.createPublicKey and
// crypto.verify, over a public key and a signature that both arrive as
// plain function arguments (validateCollectorAuthority,
// verifyCaptureSignature), never anything this module holds, generates, or
// reads from the environment itself. It never calls crypto.sign,
// crypto.createPrivateKey or crypto.createSign -- it consumes a signature,
// it never produces one -- and both collectEvidenceRecords() and
// validateV1RenderedSurfaceArtifactSet() fail closed unconditionally today
// (TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED /
// STATIC_EVIDENCE_INCOMPLETE), so there is no live path through this module
// yet -- the same "proposes and changes nothing" shape as every other
// PURE_PROPOSAL file. Recorded as its own class rather than widening
// PURE_FORBIDDEN_CAPABILITIES for the whole ~80-file PURE_PROPOSAL group,
// which would hand every one of those files an unreviewed signing allowance
// none of them asked for or need. Permits exactly `signing`; every other
// one of the seven stays forbidden, and the test independently proves the
// verify-only shape -- no crypto.sign/createPrivateKey/createSign anywhere
// in the source -- not just the bare capability name.
const PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES = Object.freeze([
  'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
]);

const LOCAL_ARTIFACT_WRITERS = Object.freeze([
  'lib/canonical-v2/metsera-comprehensive-selection-review-writer.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer.js',
  'lib/canonical-v2/source-intake-readiness-writer.js',
  'scripts/reprocess/v1-apply-backup.js',
  'scripts/reprocess/v1-apply-receipt.js',
  'scripts/reprocess/v1-apply-sequence.js',
  // Writes the review-parity case fixtures under tests/fixtures/. Its V2 side
  // replays a committed provider response through the real producer chain --
  // the provider passed to runNativeExtraction is an inline pure function over
  // that fixture, so there is no model call, no network and no credential.
  'scripts/review-parity-build-cases.js',
  // Writes the parity report as canonical JSON. Reads only otherwise.
  'scripts/review-parity-check.js',
  // Writes a family -> [section_reference] PROPOSAL as JSON under
  // docs/codex-program/notes/ (PLAN.md Step 2A). Reads a committed raw HTML
  // fixture, rebuilds canonical text from it, and refuses to proceed unless
  // the resulting sha256 matches the pinned one -- so it cannot generate a
  // map from bytes that are not the admitted source. No model call, no
  // network, no database, no credential. The library it drives
  // (lib/canonical-v2/native-producer/family-section-ref-generator.js) is
  // PURE_PROPOSAL; this script is the writer around it, which is the same
  // split as full-corpus-routing-prompt-cost-audit.js and its -writer.js.
  'scripts/canonical-v2-generate-family-section-refs.mjs',
  // Writes evidence/canonical-v2/baseline-manifest.json: what each committed
  // run WOULD publish if imported, which is not what the run claimed it
  // published (PLAN.md Stage 2's ladder needs the former as its yardstick).
  // Reads run directories, imports each against an in-memory repository with
  // dryRun, and writes one JSON file. No model call, no network, no database,
  // no credential -- the repository never leaves the process.
  'scripts/canonical-v2-baseline-manifest.mjs',
  // Writes only the sealed Step 2X-K blind sample, private answer key and
  // score under an operator-selected local output directory. Reads committed
  // evidence and resolves it in memory. No provider, network, database,
  // credential, child process or production authority.
  'scripts/canonical-v2-step-2x-k-blind-successor.mjs',
  // Replays committed recordings through the in-memory resolver, then writes
  // only the recovered blind score and its local matching trace.
  'scripts/canonical-v2-20260808-blind-current-rescore.mjs',
  // Reads final local evidence and writes one self-contained HTML review file.
  'scripts/canonical-v2-corpus-review-artifact.mjs',
  // The ONLY thing that may ever write __fixtures__/canonical-v2/qxo-
  // termination-fee-reviewed-excerpts.generated.js (see that file's own
  // header). Reads the reviewed .txt, writes the generated module;
  // tests/qxo-termination-fee-excerpt-module.test.js fails the moment the
  // checked-in output stops matching what running this script right now
  // would produce, so drift from a hand-edit or a stale regen cannot pass
  // silently.
  'scripts/generate-qxo-termination-fee-excerpt-module.js',
  // Same species as generate-qxo-termination-fee-excerpt-module.js
  // immediately above: reads source files under lib/ and components/ (no
  // database, no network, no model call, no child process, no signing) and
  // writes exactly one generated artefact, docs/codex-program/generated/
  // system-inventory.json. tests/codex-program-generated-docs.test.js
  // fails the moment the checked-in output stops matching what running
  // this script right now would produce, the same drift guard as its
  // sibling above.
  'scripts/generate-codebase-inventory.js',
  'scripts/write-current-source-intake-readiness.js',
  'scripts/write-full-corpus-routing-prompt-cost-audit.js',
  'scripts/write-governed-identity-proposal-packet.js',
  'scripts/write-topbuild-legal-text-delta.js',
  'scripts/write-topbuild-section-delta-review-queue.js',
  'scripts/write-topbuild-two-occurrence-review-packet.js',
  // Step 2X free-phase audit writers: optional --write of notes under
  // docs/codex-program/notes/. Read evidence only otherwise; no network,
  // database, provider, or credential.
  'scripts/audit/step-2x-j-vocab-inventory.js',
  'scripts/canonical-v2-corroboration-collision-report.mjs',
  'scripts/canonical-v2-marker-start-stability.mjs',
  'scripts/canonical-v2-second-chance-would-resolve-report.mjs',
  'scripts/audit/stage-2y-open-world-promotion-candidates.mjs',
  'scripts/audit/stage-2y-open-world-promotion-review-packet.mjs',
  'scripts/canonical-v2-corpus-review-live-successor.mjs',
  'scripts/stage-2y-0-human-anchor-review.mjs',
  'scripts/stage-2y-0-joint-sweep.mjs',
  'scripts/stage-2y-a-context-availability-census.mjs',
  'scripts/stage-2y-a-material-contracts-gate.mjs',
  'scripts/stage-2y-a-material-contracts-pin-comparison.mjs',
  'scripts/stage-2y-a-resolution-set-diff.mjs',
  'scripts/stage-2y-cd-known-loss-adjustment.mjs',
  'scripts/stage-2y-cd-measurement.mjs',
  'scripts/stage-2y-d-defined-term-replay.mjs',
  'scripts/stage-2y-e-numeral-ladder-replay.mjs',
  'scripts/stage-2y-f-concept-coverage-simulation.mjs',
  'scripts/stage-2y-f-lexical-classification.mjs',
  'scripts/stage-2y-g-duplicate-suppression-evidence.mjs',
  'scripts/stage-2y-h-representation-topic-replay.mjs',
  'scripts/stage-2y-h-representation-topic-review.mjs',
  'scripts/stage-2y-i-qualifier-dispatch-measurement.mjs',
  'scripts/stage-2y-k-ownership-ledger.mjs',
  'scripts/stage-2y-k-residual-a.mjs',
  'scripts/stage-2y-k-residual-b.mjs',
  'scripts/stage-2y-l-per-family-diff.mjs',
  'scripts/stage-2y-l-target-cohort-audit.mjs',
  'scripts/stage-2y-registry-near-miss.mjs',
  'scripts/stage-2y-f28-receipt-pin-comparison.mjs',
  // Renders every resolved claim through the real Review V2 config path and
  // writes the rendered-rows artefact. Report-only by construction: it reads
  // committed evidence, calls no model, touches no disposition, and its only
  // writes are the two files it names.
  'scripts/stage-2y-rendered-rows-artefact.mjs',
  'scripts/stage-2y-resolution-set-diff.mjs',
  'scripts/stage-2y-restamp-unresolved-register.mjs',
  // Later M2-M7 generators write local candidate, review, and receipt files.
  // They have no network, model, database, signing, process, or deployment authority.
  'scripts/bootstrap-appraisal-dissenters-rights-work3-from-financing.mjs',
  'scripts/bootstrap-consideration-work3-from-tax-matters.mjs',
  'scripts/bootstrap-dividends-work3-from-appraisal.mjs',
  'scripts/bootstrap-employee-matters-work3-from-proxy-meeting.mjs',
  'scripts/bootstrap-interim-operating-work3-from-antitrust.mjs',
  'scripts/bootstrap-interim-operating-work3-from-employee-matters.mjs',
  'scripts/bootstrap-key-defined-terms-work3-from-consideration.mjs',
  'scripts/bootstrap-material-contracts-work3-from-employee-matters.mjs',
  'scripts/bootstrap-merger-structure-closing-work3-from-interim-operating.mjs',
  'scripts/bootstrap-misc-boilerplate-work3-from-interim-operating.mjs',
  'scripts/bootstrap-no-shop-work3-from-key-defined-terms.mjs',
  'scripts/bootstrap-specific-performance-remedies-work3-from-consideration.mjs',
  'scripts/bootstrap-tax-matters-work3-from-financing.mjs',
  'scripts/codex-program/build-legal-board-bucket-presentation.js',
  'scripts/fix-interim-operating-bindings.mjs',
  'scripts/fix-key-defined-terms-bootstrap.mjs',
  'scripts/fix-key-defined-terms-test.mjs',
  'scripts/fix-no-shop-bindings.mjs',
  'scripts/fix-specific-performance-remedies-bindings.mjs',
  'scripts/generate-red-hat-termination-rights-serving-module.mjs',
  'scripts/stage-2y-agreement-index-m2-finalise.mjs',
  'scripts/stage-2y-agreement-index-shadow.mjs',
  'scripts/stage-2y-m7-generalisation-cohort-finalise.mjs',
  'scripts/stage-2y-m7-lawyer-sample-finalise.mjs',
  'scripts/stage-2y-structure-corpus-compare.mjs',
  'scripts/stage-2y-structure-family-compare.mjs',
  'scripts/stage-2y-structure-generalisation-shadow.mjs',
  'scripts/stage-2y-structure-m1-finalise.mjs',
  'scripts/stage-2y-structure-m5-approve.mjs',
  'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-antitrust-regulatory-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-appraisal-dissenters-rights-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-closing-conditions-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-closing-conditions-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-closing-conditions-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-closing-conditions-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-consideration-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-consideration-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-consideration-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-consideration-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-dividends-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-dividends-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-dividends-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-dividends-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-dividends-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-item42-successor-session.mjs',
  'scripts/stage-2y-structure-m7-v2-dno-indemnification-work3-authorities.mjs',
  'scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-employee-matters-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-employee-matters-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-employee-matters-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-employee-matters-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-financing-covenants-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-financing-covenants-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-financing-covenants-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-financing-covenants-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-general-covenants-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-general-covenants-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-general-covenants-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-general-covenants-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-general-covenants-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-grouping-successor-session.mjs',
  'scripts/stage-2y-structure-m7-v2-guaranty-financing-party-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-guaranty-financing-party-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-guaranty-financing-party-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-guaranty-financing-party-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-guaranty-financing-party-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-interim-operating-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-interim-operating-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-interim-operating-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-interim-operating-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-key-defined-terms-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-add-override.mjs',
  'scripts/stage-2y-structure-m7-v2-lawful-work3-fixture-refresh-overrides.mjs',
  'scripts/stage-2y-structure-m7-v2-mae-definition-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-mae-definition-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-mae-definition-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-mae-definition-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-material-contracts-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-material-contracts-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-material-contracts-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-material-contracts-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-material-contracts-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-merger-structure-closing-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-merger-structure-closing-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-merger-structure-closing-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-merger-structure-closing-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-merger-structure-closing-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-misc-boilerplate-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-misc-boilerplate-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-misc-boilerplate-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-misc-boilerplate-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-misc-boilerplate-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-no-other-reps-fraud-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-no-shop-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-no-shop-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-no-shop-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-no-shop-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-proxy-meeting-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-proxy-meeting-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-proxy-meeting-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-proxy-meeting-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-proxy-meeting-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-register-candidate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work1-finalise.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work2-finalise.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work3-finalise.mjs',
  'scripts/stage-2y-structure-m7-v2-representations-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-representations-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-representations-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-representations-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-representations-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-specific-performance-remedies-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-tax-matters-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-tax-matters-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-tax-matters-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-tax-matters-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-tax-matters-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase2-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-fee-authoring-phase4-authority.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-fee-ben-inventory-disposition.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-fee-family-profile-package.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-fee-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-outside-date-extension-disposition.mjs',
  'scripts/stage-2y-structure-migration-control.mjs',
  'scripts/stage-2y-structure-prototype.mjs',
]);

const RECORDED_PROVIDER_REPLAY_WRITERS = Object.freeze([
  'scripts/stage-2y-corroboration-ladder.mjs',
]);

const LIVE_MODEL_ADJUDICATION_RUNS = Object.freeze([
  'scripts/stage-2y-f-terra-adjudication.mjs',
]);

// A report-only experiment that calls both subscription model CLIs directly
// and writes only local evidence. It is not an extraction run: its blocked-row
// RESOLVED label is a proposed governed placement, and it does not invoke the
// resolver, adapter, projection, serving path, or publication path.
const LIVE_MODEL_EXPERIMENT_RUNS = Object.freeze([
  'scripts/stage-2y-phase-b-model-experiment.mjs',
]);

// The V2 experiment invokes both subscription model CLIs as literal child
// processes. The capability scanner records the child-process authority but
// cannot infer that a string argument names a model provider, so keep this
// direct-CLI shape separate and verify both executable names in its test.
const LIVE_MODEL_CLI_EXPERIMENT_RUNS = Object.freeze([
  'scripts/stage-2y-phase-b-v2-model-experiment.mjs',
]);

const LIVE_EXTRACTION_ORCHESTRATORS = Object.freeze([
  'scripts/stage-2y-l-live-batch.mjs',
  'scripts/stage-2y-phase-b-sol-financing-continuation.mjs',
  'scripts/stage-2y-phase-b-sol-probe.mjs',
]);

// Phase 1's fourth kind, and the first that is neither scaffolding nor
// governance machinery: pure decision logic that the PRODUCT path calls
// unconditionally. lib/agreement-revision-classifier.js decides whether an SEC
// exhibit is an original agreement, a restatement, an amendment or something a
// human must look at; lib/edgar-catalog.js requires it at module load and acts
// on its verdict during ingest, behind no environment gate.
//
// It is recorded separately rather than folded into PURE_PROPOSAL because this
// register's job is to say what Phase 1 put where. PURE_PROPOSAL is enforced as
// "exercises no authority capability" and already contains modules that live
// consumers call, but every one of those is proposal, preview or containment
// machinery. Filing live ingest logic beside them would let the register be
// read as "Phase 1 added no product behaviour", which is not true.
//
// The class is strictly harder to satisfy than PURE_PROPOSAL, not softer. Its
// members take the same full capability scan AND must declare no module
// dependencies at all: the capability scan is textual and per-file, so purity
// that rests on an import is purity the scan never checked. A leaf module that
// imports nothing cannot reach a capability transitively.
const PRODUCTION_PATH_PURE_ANALYSIS_SOURCES = Object.freeze([
  'lib/agreement-revision-classifier.js',
  // The one shared "parse a dollar amount out of a string" primitive
  // (2026-08-05 consolidation of six independent, inconsistent copies --
  // see that file's header for the full backstory and the live cross-
  // surface disagreement it closes). Called unconditionally from the live
  // review renderer (pages/review-v1/[id].js's parseDollarAmount) and the
  // live query engine (lib/query/derived-fields.js's parseUsdAmount) among
  // others, so it belongs beside agreement-revision-classifier.js, not in
  // PURE_PROPOSAL: this IS product behaviour, not scaffolding. Zero module
  // dependencies (pure string/regex/math, no require/import at all) and
  // zero of the seven capabilities.
  'lib/parse-money.js',
  // Negation-boundary guard (docs/codex-program/notes/negation-reversal.md):
  // decides whether the text immediately governing a candidate quote's
  // start carries a negation ("would not", "in no event", a closed "no
  // <noun>" list, ...) the quote itself does not include -- the check that
  // closes the "have a Company Material Adverse Effect" cut out of "...
  // would not have a Company Material Adverse Effect..." class of defect.
  // Called unconditionally, behind no environment gate, from
  // lib/verification.js's quoteAppearsIn/sanitizeFeatureQuotes, which
  // lib/parser-v2/store.js calls at real ingestion to decide which quotes
  // survive into the stored feature bag -- live product behaviour, the same
  // shape as lib/parse-money.js and lib/agreement-revision-classifier.js
  // immediately above, not proposal/preview scaffolding. Zero module
  // dependencies (pure string/regex logic, no require/import at all) and
  // zero of the seven capabilities.
  'lib/negation-boundary-guard.js',
  // The two corroboration lexicons added by PLAN.md Step 3G (2026-08-07):
  // named pattern lists deciding whether a quote's own operative text
  // supports the covenant code, or the tax cooperation kind, that the model
  // assigned to it. Same species as lib/parse-money.js and
  // lib/negation-boundary-guard.js above -- pure string and regex, zero
  // module dependencies (no require or import at all, counted rather than
  // assumed) and zero of the seven capabilities -- and live product
  // behaviour rather than scaffolding, since candidate-resolution.js calls
  // both unconditionally on the resolve path, behind no environment gate.
  // They are separate files, in the shape of ioc-corroboration.js, so the
  // vocabularies can be widened without editing a 10,150-line resolver:
  // General Covenants previously corroborated against lib/rubric.js's
  // display labels, which are presentation strings for a person browsing a
  // rubric, and the family resolved zero because real drafting never
  // restates them.
  'lib/canonical-v2/native-producer/tax-cooperation-corroboration.js',
  // Stage B display-note adapter: copies already-authorised B9e display text
  // onto matching Termination Rights review facts. No require/import and
  // none of the seven capabilities. Live product path via the review
  // serving attacher.
  'lib/canonical-v2/termination-rights-review-stage-b-notes.js',
]);

const READ_ONLY_GIT_INSPECTORS = Object.freeze([
  'lib/canonical-v2/successor-m1-readiness-packet.js',
  'lib/canonical-v2/v1-render-capture-preflight.js',
  // Step 2X derived-limb marker-start survey: `git show` of historical
  // subclauses.js blobs only. The survey writer compiles the returned
  // source in memory and owns any note/snapshot writes.
  'lib/canonical-v2/marker-start-git-baseline.js',
  'scripts/stage-2y-structure-m5-preparation-validate.mjs',
  'scripts/stage-2y-structure-migration-validate.mjs',
]);

// Local evidence or workflow-output writers that also inspect repository state
// through literal, read-only Git commands. Kept separate from both
// LOCAL_ARTIFACT_WRITER and READ_ONLY_GIT_INSPECTOR so neither class gains
// authority it does not use.
const READ_ONLY_GIT_ARTIFACT_WRITERS = Object.freeze([
  // Reads `git diff` only and writes only the GitHub Actions GITHUB_OUTPUT file.
  'scripts/ci/baseline-manifest-impact.js',
  // Reads immutable Git tree/blob objects and writes only the local CI cache marker.
  'scripts/ci/baseline-checkpoint.js',
  'scripts/audit/canonical-v2-termination-render-diagnosis.mjs',
  'scripts/stage-2y-h-representation-topic-compare.mjs',
  'scripts/stage-2y-registry-substrate-replay.mjs',
  'scripts/stage-2y-context-compilation-m3-finalise.mjs',
  'scripts/stage-2y-context-compilation-shadow.mjs',
  'scripts/stage-2y-structure-analysis-m4-finalise.mjs',
  'scripts/stage-2y-structure-analysis-shadow.mjs',
  'scripts/stage-2y-structure-family-aggregate.mjs',
  'scripts/stage-2y-structure-m5-correct.mjs',
  'scripts/stage-2y-structure-m5-preparation-finalise.mjs',
  'scripts/stage-2y-structure-m6-project.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work0-finalise.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work0-validate.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work1-7-authority-validate.mjs',
]);

const LOCAL_SUBPROCESS_ARTIFACT_WRITERS = Object.freeze([
  'scripts/ci/run-unit-test-shard.js',
  'scripts/stage-2y-structure-m7-v2-repair-work1-recover.mjs',
  'scripts/stage-2y-structure-m7-v2-repair-work2-recover.mjs',
  'scripts/stage-2y-structure-m7-v2-termination-family-package-seal-receipt.mjs',
]);

// The frozen Work3 closure-amendment generator now inspects the exact archived
// review target and its live remote ancestry. It writes nothing. Keep it out of
// both READ_ONLY_GIT_INSPECTOR, whose ordinary Git allow-list excludes the one
// pinned ls-remote observation, and every artefact-writer class.
const REMOTE_GIT_REVIEW_INSPECTORS = Object.freeze([
  'scripts/stage-2y-structure-m7-v2-work3-closure-amendment-candidate.mjs',
]);

// Applies the externally reviewed Work3 closure amendment. It performs only
// pinned read-only Git observations, including one live ls-remote, then writes
// the create-once application receipt and successor manifest locally.
const REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS = Object.freeze([
  'scripts/stage-2y-structure-m7-v2-repair-work3-closure-apply.mjs',
]);

const REMOTE_SOURCE_ADMISSION_WRITERS = Object.freeze([
  'scripts/stage-2y-generalisation-source-admit.mjs',
]);

const LOCAL_REVIEW_SERVER_WRITERS = Object.freeze([
  'scripts/stage-2y-m7-lawyer-review-server.mjs',
]);

// Phase 1's fifth kind: a standalone, human-invoked script that drives one
// real LLM call end to end -- through the Claude Code subscription CLI, no
// ANTHROPIC_API_KEY, no metered billing -- against an already-admitted,
// already-committed source, and writes its receipts/telemetry/resolution/
// validation evidence to local output files. This is the same species as the
// F28/Modiv/Skechers live-extraction-run scripts already in scripts/ (all of
// them predate the Phase 1 base commit, which is the only reason none of
// them needed a class here before now): it exercises `provider` (a real
// model-call authority, not a proposal) and `external_process` (spawns the
// `claude` CLI) alongside `filesystem_write`, so it cannot honestly be
// PURE_PROPOSAL (which permits none of the seven capabilities) or
// LOCAL_ARTIFACT_WRITER (which permits filesystem_write alone). It never
// touches a database, never reaches the network live (it reuses committed
// HTML and asserts the pinned hash), never signs, and never deploys or
// activates anything.
//
// Renamed from `canonical-v2-modiv-termination-fee-scope-correction-run.mjs`
// to `canonical-v2-live-extraction-run.mjs` (2026-08-06). The script was
// generalised to run any of the 25 registered families against any deal
// pinned in its own `DEAL_PINS` table well before this rename; the old name,
// describing one scope correction for one deal and one family, was left in
// place at generalisation time specifically to avoid re-touching this
// classification. That was the wrong trade -- it was then run against all 25
// families under a name that still claimed a single one-off correction,
// which is a provenance problem, not a cosmetic one. The rename is the
// correction; this entry's classification is not, because generalising
// which family or deal a run targets never changed what the script is
// capable of doing. It is still exactly `provider` + `external_process` +
// `filesystem_write`, nothing more, both before and after.
const LIVE_EXTRACTION_RUN_SOURCES = Object.freeze([
  'scripts/canonical-v2-live-extraction-run.mjs',
]);

// PLAN.md Step 4A's proof harness, and **the first source in this programme
// that carries the `database` capability at all**. It stands up a local
// Postgres container, applies supabase/canonical-v2-foundation.sql, composes
// a write-set from a committed evidence directory through the ordinary
// bridge, and calls public.canonical_v2_write durably so that the JS writer
// and the 8,686-line SQL reimplementation can be compared on the same data.
// That comparison is the entire point: Step 4A found that they disagree, and
// the disagreement (no branch for STRUCTURAL_PROVISION_INSTANCE/V1, which
// rejects six of fifteen claim-publishing families) is now Step 4A1.
//
// It is exactly `database` + `filesystem_write`: it connects with `pg` and
// reads/writes local files. No provider (it never calls a model -- it reads
// already-committed evidence), no external_process, no network, no signing,
// no deployment.
//
// **What does and does not bound this, stated exactly rather than
// reassuringly.** OPERATING-RULES.md permits an import to be built and proved
// offline or against a non-production database, and Step 4A is written on
// that permission: no credential, nothing real touched. What enforces it is
// that no production credential exists in this repository -- the connection
// string comes from LOCAL_CANONICAL_V2_DB_URL or an explicit argument, so
// *structurally* nothing in this file would stop someone pointing it at a
// real database. That is a property of the class, not an oversight in the
// file, and it is why this class is deliberately narrow, named for what it is
// for, and holds one script. Running this against anything but a local
// container is a separate act needing its own authorisation, exactly as
// OPERATING-RULES.md says of any real import.
const LOCAL_DATABASE_PROOF_SOURCES = Object.freeze([
  'scripts/canonical-v2-local-durable-write.js',
  // Step 4A2's conditional-fee harness and Step 4A3's adapter proof, same
  // shape as the line above: local container, committed evidence, no
  // credential.
  'scripts/canonical-v2-local-conditional-fee-write.js',
  'scripts/canonical-v2-step-4a3-conditional-fee-adapter-proof.js',
  'scripts/canonical-v2-local-staging-read-proof.js',
  // Step 2C's end-to-end proof: writes a run, then drives the real
  // termination-fees table config against the database and asserts the Modiv
  // headline reaches the served payload. Same terms as the harnesses above --
  // local container, committed evidence, no credential -- and it never
  // touches Supabase.
  'scripts/canonical-v2-modiv-termination-fee-serving-proof.js',
  // Step 2C1's two-deal isolation proof. It writes a SECOND, synthetic deal's
  // own source chain and one conditional-fee row beside Modiv's real six, then
  // asserts each deal's scoped read returns only its own. Same terms as the
  // harnesses above: local container, no credential. The synthetic deal is
  // constructed in the script rather than drawn from any real filing.
  'scripts/canonical-v2-conditional-fee-two-deal-isolation-proof.js',
  // Step 2B2's grant-boundary proof for the hosted read surface Fable ruled.
  // It stands up its own throwaway container, applies the new definer-function
  // file, and proves the boundary by attempting the same read as anon,
  // service_role, canonical_v2_writer and canonical_v2_serving -- all refused
  // -- and as canonical_v2_staging_reader, which succeeds. That is the first
  // read in this programme not resting on the table-owner shortcut. No hosted
  // database and no credential: the roles are created locally by the script.
  'scripts/canonical-v2-staging-read-hosted-grant-boundary-proof.js',
  // Step 2D1 defect 5's contract check: diffs a committed resolution.json
  // against the same deal read back, field by field, through canonicalJson.
  // It lives in scripts/ rather than tests/ because it needs a live Postgres
  // container, matching this repository's existing convention for keeping
  // live-DB proofs out of npm test's glob. Local container, committed
  // evidence, no credential.
  'scripts/canonical-v2-reader-resolution-contract-check.js',
  // Step 2B's read half. Unlike every entry above it this is library code
  // rather than a proof script, and it is the narrower half of the class: it
  // issues SQL but **never constructs a connection** -- the caller supplies
  // the client, so this file holds no connection string, reads no credential
  // and cannot choose which database it talks to. That is deliberate, and it
  // is what makes the hosted question a separate decision (DECISIONS.md
  // decision 1, ruled by Fable 2026-08-07: definer functions granted to a
  // dedicated role) rather than something this module could quietly settle by
  // pointing itself somewhere.
  'lib/canonical-v2/local-staging-deal-reader.js',
]);

// Phase 1's sixth kind, and the first that is genuinely LIVE on every
// request rather than proposal, preview, containment, analysis, inspection
// or writer machinery: the session/credential mechanism behind S2
// (ROADMAP.md "put a login in front of the application") -- middleware.js's
// one enforcement point (lib/auth/gate.js), the cookie primitive underneath
// it (lib/auth/cookies.js), the credential check and open-redirect guard
// beside it (lib/auth/credentials.js, lib/auth/safe-next-path.js), and the
// three API routes that wire them to the browser. It reads secrets from the
// environment (SESSION_SECRET, AUTH_PASSWORD) and makes the one security
// decision that gates the entire application: whether a given request
// proceeds.
//
// It cannot honestly be PURE_PROPOSAL -- that class means "not live", and
// this runs on every real request today. Same full scan as PURE_PROPOSAL,
// all seven capabilities forbidden -- this mechanism has no legitimate
// reason to touch a database, the network, a model provider, a signing
// primitive, a deployment, a child process, or the filesystem -- but
// recorded as live, because it is.
//
// The session-token HMAC itself (lib/auth/session.js) is deliberately NOT
// in this array; see LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES below. The
// 2026-08-05 AST rewrite of the capability scan (tests/canonical-v2-
// phase1-authority-boundary.test.js) closed the exact gap an earlier
// version of this comment relied on: the scan now resolves
// `getSubtle().sign(...)`/`.verify(...)` back to Web Crypto's
// `crypto.subtle`, so session.js's own HMAC correctly registers as
// `signing`. That is not a false positive to explain away -- signing the
// session token really is what the file exists to do -- so it gets its own
// narrower class with `signing` permitted, instead of widening this
// array's all-seven-forbidden boundary, which would hand gate.js,
// credentials.js, cookies.js and safe-next-path.js a signing allowance none
// of them need or has been reviewed for.
const LIVE_REQUEST_AUTHORIZATION_SOURCES = Object.freeze([
  'lib/auth/cookies.js',
  'lib/auth/credentials.js',
  'lib/auth/gate.js',
  'lib/auth/safe-next-path.js',
  'pages/api/auth/login.js',
  'pages/api/auth/logout.js',
  'pages/api/auth/session.js',
]);

// The one member of the session/credential mechanism (see the class comment
// above) that must itself sign and verify: the session-token HMAC
// everything else in that class depends on. Web Crypto's
// `crypto.subtle.sign`/`.verify`, reached through this file's own
// `getSubtle()` wrapper -- HMAC-SHA256 only, over the session claims,
// nothing else (see lib/auth/session.js's own header for why Web Crypto
// specifically: it is the one crypto surface both the Next.js Edge runtime
// and the Node API routes implement identically). Recorded as its own
// class rather than widening LIVE_REQUEST_AUTHORIZATION_FORBIDDEN_
// CAPABILITIES for the whole group -- the same reasoning as
// LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES below, singled out rather than
// folded in so the rest of the mechanism keeps its tighter, zero-capability
// boundary. Permits exactly `signing`; every other one of the seven stays
// forbidden. The test enforces the narrower shape the class comment
// claims, not just the bare capability name: this file must never require
// Node's `crypto` module, which is the only way to reach
// `crypto.sign`/`createSign`/`createPrivateKey`/`createVerify` -- none of
// which Web Crypto's ambient `crypto.subtle` exposes.
const LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES = Object.freeze([
  'lib/auth/session.js',
]);

// The one client-side member of the same live authorization surface: the
// login page itself, live on a real route the moment a session is missing
// (middleware.js redirects here). Same "genuinely live, not a proposal"
// reasoning as LIVE_REQUEST_AUTHORIZATION_SOURCES above, but this is a React
// page that calls its own same-origin /api/auth/session and /api/auth/login
// over a browser fetch to check for and establish a session -- the one
// capability (`network`) the rest of that group correctly forbids itself.
// Recorded as its own class, not folded into LIVE_REQUEST_AUTHORIZATION_SOURCES,
// so the mechanism's own files keep the tighter, zero-capability boundary:
// widening that boundary for all nine to accommodate this one page's own
// browser fetch calls would be a real loosening of what the session/
// credential mechanism itself is permitted to do.
const LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES = Object.freeze([
  'pages/login.js',
]);

// Phase 1's seventh kind: a reviewed, tested REPAIR for a route the July
// security review graded critical, deliberately held dormant behind
// lib/broad-corpus-containment.js. The live pages/api/** file for each of
// these still resolves to createBroadCorpusContainedHandler(...) (503), and
// tests/broad-corpus-containment.test.js independently, mechanically proves
// each one imports nothing of theirs (exactly one require(), zero imports,
// and none of supabase/anthropic/createClient/process.env/fetch/readFile/
// `from(` appear in the live route source at all) -- un-containing these
// routes is separate, later work (ROADMAP.md "Do not... turn them on"); this
// register only has to account for what already exists on disk.
//
// That independent proof is what makes it honest to record real,
// capability-bearing code as still safe: unlike every class above, these
// files are NOT capability-free -- users.js's is_admin self-grant fix and
// reprocess-cond.js's now-authenticated-by-the-global-gate destructive
// reprocess each obtain their own service-role Supabase client as their
// actual repaired functionality, and from-url.js does too, on top of
// driving the SSRF-guarded fetch (see
// CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES below for that fetch
// itself) -- so PURE_PROPOSAL would be false for all three. They are also
// proven unreachable today, so LIVE_REQUEST_AUTHORIZATION's "this runs on
// every request" framing would be equally false. `database` is therefore
// the one capability this class permits; every other one of the seven
// stays forbidden even for held-dormant code.
const CONTAINED_ROUTE_REPAIR_SOURCES = Object.freeze([
  'lib/broad-corpus/contained-routes/from-url.js',
  'lib/broad-corpus/contained-routes/reprocess-cond.js',
  'lib/broad-corpus/contained-routes/users.js',
]);

// The SSRF-guarded fetch that from-url.js (above) drives, split into its
// own class rather than widening CONTAINED_ROUTE_REPAIR_FORBIDDEN_
// CAPABILITIES: this is the one route-repair file whose repaired
// functionality IS reaching the network, and it never obtains a Supabase
// client at all -- `database` would be unjustified slack here, not a
// needed permission, so this class permits `network` alone rather than
// inheriting the sibling class's `database` allowance. fetchUrl()
// restricts every request, including every redirect hop it follows, to
// https://sec.gov and https://*.sec.gov (see this file's own header for
// the SSRF finding it repairs); the test drives the real exported
// isAllowedIngestUrl guard against a battery of adversarial hosts to prove
// that, rather than trusting the capability name alone.
const CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES = Object.freeze([
  'lib/broad-corpus/contained-routes/from-url-fetch.js',
]);

const REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES = Object.freeze({
  DARK_INTEGRATION_CURRENT_ENVIRONMENT_VERIFICATION: 'lib/canonical-v2/dark-integration-preflight.js',
  GOVERNED_IDENTITY_FROZEN_KEY_REGISTRY_AMENDMENT: 'lib/canonical-v2/governed-identity-trust-contracts.js',
  GOVERNED_IDENTITY_LITERAL_KEY_REGISTRY_PATCH: 'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  SOURCE_INTAKE_TRUSTED_AUTHORITY_VERIFIER: 'lib/canonical-v2/source-intake-readiness.js',
  SUCCESSOR_M1_TRUSTED_CONTROLLER_VERIFICATION: 'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
});

const EXPLICIT_NEW_SOURCE_CLASSES = Object.freeze({
  PURE_PROPOSAL: PURE_PROPOSAL_SOURCES,
  PURE_PROPOSAL_SIGNATURE_VERIFICATION: PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES,
  LOCAL_ARTIFACT_WRITER: LOCAL_ARTIFACT_WRITERS,
  RECORDED_PROVIDER_REPLAY_WRITER: RECORDED_PROVIDER_REPLAY_WRITERS,
  LIVE_MODEL_ADJUDICATION_RUN: LIVE_MODEL_ADJUDICATION_RUNS,
  LIVE_MODEL_EXPERIMENT_RUN: LIVE_MODEL_EXPERIMENT_RUNS,
  LIVE_MODEL_CLI_EXPERIMENT_RUN: LIVE_MODEL_CLI_EXPERIMENT_RUNS,
  LIVE_EXTRACTION_ORCHESTRATOR: LIVE_EXTRACTION_ORCHESTRATORS,
  READ_ONLY_GIT_INSPECTOR: READ_ONLY_GIT_INSPECTORS,
  READ_ONLY_GIT_ARTIFACT_WRITER: READ_ONLY_GIT_ARTIFACT_WRITERS,
  LOCAL_SUBPROCESS_ARTIFACT_WRITER: LOCAL_SUBPROCESS_ARTIFACT_WRITERS,
  REMOTE_GIT_REVIEW_INSPECTOR: REMOTE_GIT_REVIEW_INSPECTORS,
  REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITER: REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS,
  REMOTE_SOURCE_ADMISSION_WRITER: REMOTE_SOURCE_ADMISSION_WRITERS,
  LOCAL_REVIEW_SERVER_WRITER: LOCAL_REVIEW_SERVER_WRITERS,
  PRODUCTION_PATH_PURE_ANALYSIS: PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN: LIVE_EXTRACTION_RUN_SOURCES,
  LOCAL_DATABASE_PROOF: LOCAL_DATABASE_PROOF_SOURCES,
  LIVE_REQUEST_AUTHORIZATION: LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SESSION: LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT: LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR: CONTAINED_ROUTE_REPAIR_SOURCES,
  CONTAINED_ROUTE_REPAIR_GUARDED_FETCH: CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES,
});

function classifyChangedProductionSources({
  changedSources,
  existedAtBase,
  explicitClasses = EXPLICIT_NEW_SOURCE_CLASSES,
}) {
  if (!Array.isArray(changedSources) || typeof existedAtBase !== 'function') {
    throw new TypeError('changedSources and existedAtBase are required.');
  }
  const changed = [...new Set(changedSources)].sort();
  const changedSet = new Set(changed);
  const assignments = new Map(changed.map((relativePath) => [relativePath, []]));
  for (const [classification, paths] of Object.entries(explicitClasses)) {
    if (!Array.isArray(paths)) throw new TypeError(`${classification} must be an array.`);
    for (const relativePath of paths) {
      if (!changedSet.has(relativePath)) throw new Error(`CLASSIFIED_SOURCE_NOT_CHANGED: ${relativePath}`);
      if (existedAtBase(relativePath)) throw new Error(`PREEXISTING_SOURCE_EXPLICITLY_CLASSIFIED: ${relativePath}`);
      assignments.get(relativePath).push(classification);
    }
  }
  for (const relativePath of changed) {
    if (existedAtBase(relativePath)) assignments.get(relativePath).push('MODIFIED_PREEXISTING');
    const classes = assignments.get(relativePath);
    if (classes.length !== 1) {
      throw new Error(`${classes.length === 0 ? 'UNCLASSIFIED_CHANGED_SOURCE' : 'MULTIPLY_CLASSIFIED_CHANGED_SOURCE'}: ${relativePath}`);
    }
  }
  return Object.freeze(changed.map((relativePath) => Object.freeze({
    path: relativePath,
    classification: assignments.get(relativePath)[0],
  })));
}

module.exports = {
  PHASE1_BASE_COMMIT,
  PURE_PROPOSAL_SOURCES,
  PURE_PROPOSAL_SIGNATURE_VERIFICATION_SOURCES,
  LOCAL_ARTIFACT_WRITERS,
  RECORDED_PROVIDER_REPLAY_WRITERS,
  LIVE_MODEL_ADJUDICATION_RUNS,
  LIVE_MODEL_EXPERIMENT_RUNS,
  LIVE_MODEL_CLI_EXPERIMENT_RUNS,
  LIVE_EXTRACTION_ORCHESTRATORS,
  READ_ONLY_GIT_INSPECTORS,
  READ_ONLY_GIT_ARTIFACT_WRITERS,
  LOCAL_SUBPROCESS_ARTIFACT_WRITERS,
  REMOTE_GIT_REVIEW_INSPECTORS,
  REMOTE_GIT_REVIEW_GATED_ARTIFACT_WRITERS,
  REMOTE_SOURCE_ADMISSION_WRITERS,
  LOCAL_REVIEW_SERVER_WRITERS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN_SOURCES,
  LOCAL_DATABASE_PROOF_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_SESSION_SOURCES,
  LIVE_REQUEST_AUTHORIZATION_CLIENT_SOURCES,
  CONTAINED_ROUTE_REPAIR_SOURCES,
  CONTAINED_ROUTE_REPAIR_GUARDED_FETCH_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  classifyChangedProductionSources,
};
