'use strict';

const PHASE1_BASE_COMMIT = '6c446b171537768a6560534ff6338e048b4eb7cc';

const PURE_PROPOSAL_SOURCES = Object.freeze([
  'components/review/table-configs/canonical-v2-preview-lane.js',
  'lib/canonical-v2/antitrust-v1-surface-disposition.js',
  'lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js',
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
  'lib/canonical-v2/derived-comparison.js',
  'lib/canonical-v2/durable-artifact-root.js',
  'lib/canonical-v2/general-covenants-dark-bridge.js',
  'lib/canonical-v2/governed-identity-proposal-packet.js',
  'lib/canonical-v2/governed-identity-readiness-descriptor.js',
  'lib/canonical-v2/governed-identity-trust-contracts.js',
  'lib/canonical-v2/identity-consumer-closure-audit.js',
  'lib/canonical-v2/identity-human-review-projection.js',
  'lib/canonical-v2/legacy-card-bridge.js',
  'lib/canonical-v2/metsera-comprehensive-selection-review.js',
  'lib/canonical-v2/metsera-pilot-extension-proposal.js',
  'lib/canonical-v2/metsera-pilot-extension-readiness.js',
  'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  'lib/canonical-v2/native-producer/family-absence-coverage-attestation.js',
  'lib/canonical-v2/native-producer/family-detection-profiles.js',
  'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js',
  'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
  'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js',
  'lib/canonical-v2/native-producer/replay-invalidation-planner.js',
  'lib/canonical-v2/native-producer/semantic-safety-preflight.js',
  'lib/canonical-v2/native-producer/sole-remedy-resolution.js',
  'lib/canonical-v2/native-producer/unified-prompt-budget-preflight.js',
  'lib/canonical-v2/neutral-defined-term-comparison-consumer.js',
  'lib/canonical-v2/no-other-reps-fraud-dark-bridge.js',
  'lib/canonical-v2/operational-policy-set-proposal.js',
  'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
  'lib/canonical-v2/phase1-authority-boundary-inventory.js',
  'lib/query/dark-authority-fence.js',
  // The review-parity harness: it compares the legacy and Canonical V2 views of
  // a family and reports whether they say the same thing. It proposes a
  // verdict and changes nothing -- no database, no network, no writes. The two
  // CLI entry points that do write are classified as artefact writers below.
  'lib/review-parity/case-file.js',
  'lib/review-parity/compare.js',
  'lib/review-parity/mapping.js',
  'lib/review-parity/normalise.js',
  'lib/review-parity/report.js',
  'lib/review-parity/run.js',
  'lib/review-parity/views.js',
  'lib/canonical-v2/representations-dark-bridge.js',
  'lib/canonical-v2/review-preview-assembly.js',
  'lib/canonical-v2/routine-primary-source-disposition-policy.js',
  'lib/canonical-v2/source-intake-readiness.js',
  'lib/canonical-v2/source-verification-state.js',
  'lib/canonical-v2/source-exception-approval-contract.js',
  'lib/canonical-v2/source-universe-inventory-candidate.js',
  'lib/canonical-v2/source-universe-inventory-planner.js',
  // Same species as dark-bridge-gate.js, canonical-v2-preview-lane.js and
  // review-preview-assembly.js already in this list: env-gated preview/serving
  // machinery that is unreachable in production, reads files and hashes them,
  // and exercises none of the seven authority capabilities.
  'lib/canonical-v2/termination-fee-serving-source.js',
  'lib/canonical-v2/topbuild-legal-text-delta.js',
  'lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet.js',
  'lib/canonical-v2/topbuild-section-delta-review-queue.js',
  'lib/canonical-v2/topbuild-two-occurrence-review-packet.js',
  'lib/canonical-v2/v1-capture-evidence-proposal.js',
  'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
  'lib/canonical-v2/v1-replay-evidence-proposal.js',
  'lib/canonical-v2/v1-trusted-capture-control-contracts.js',
  'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js',
  'lib/programme-gates/p9-acceptance-definition-authority.js',
  'lib/programme-gates/p9-acceptance-evidence-engineering-queue.js',
  'lib/programme-gates/p9-acceptance-evidence-inventory.js',
  'lib/programme-gates/p9-definition-proposal-layer.js',
  'scripts/canonical-v2-corpus-source-discovery-capture.js',
  'scripts/plan-v1-render-capture.js',
  'scripts/reprocess/v1-apply-guard.js',
]);

const LOCAL_ARTIFACT_WRITERS = Object.freeze([
  'lib/canonical-v2/metsera-comprehensive-selection-review-writer.js',
  'lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer.js',
  'lib/canonical-v2/source-intake-readiness-writer.js',
  'lib/programme-gates/p9-acceptance-evidence-inventory-writer.js',
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
  'scripts/write-current-source-intake-readiness.js',
  'scripts/write-full-corpus-routing-prompt-cost-audit.js',
  'scripts/write-governed-identity-proposal-packet.js',
  'scripts/write-p9-proposal-only-acceptance-evidence.js',
  'scripts/write-topbuild-legal-text-delta.js',
  'scripts/write-topbuild-section-delta-review-queue.js',
  'scripts/write-topbuild-two-occurrence-review-packet.js',
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
]);

const READ_ONLY_GIT_INSPECTORS = Object.freeze([
  'lib/canonical-v2/successor-m1-readiness-packet.js',
  'lib/canonical-v2/v1-render-capture-preflight.js',
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
  LOCAL_ARTIFACT_WRITER: LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTOR: READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS: PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
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
  LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  classifyChangedProductionSources,
};
