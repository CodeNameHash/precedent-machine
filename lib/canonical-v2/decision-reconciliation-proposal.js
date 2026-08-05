'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  DECISIONS,
  PENDING_USER_RATIFICATION_RULING_IDS,
  RECORDED_RULINGS,
  VALIDATED_RULING_CHOICES,
  validateRecordedRulingProvenance,
} = require('../programme-decision-console');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  dispositionForV1Surface,
  validateAntitrustV1SurfaceDispositions,
} = require('./antitrust-v1-surface-disposition');
const {
  CURRENT_M3_FAMILY_PARITY_STATUS,
  validateM3FamilyParityStatus,
} = require('./native-producer/m3-family-parity-register');

const PROPOSAL_SCHEMA = 'CANONICAL_V2_DECISION_RECONCILIATION_PROPOSAL/V1';
const FAMILY_STATUS_SCHEMA = 'CANONICAL_V2_DECISION_CONDITIONAL_FAMILY_STATUS/V1';
const AUTHORITY = 'NONE';
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const LATER_RECORDED_RULING_IDS = Object.freeze([
  'closing-dissent-threshold-retirement',
  'closing-termination-linking',
  'consideration-cvr-presence',
  'consideration-election-mechanism',
  'defined-terms-first-comparable',
  'defined-terms-misclassified-reclassification',
  'defined-terms-neutral-long-tail',
  'defined-terms-next-slices',
]);
const ANTITRUST_V1_SURFACE_IDS = Object.freeze([
  'ANTI-BURDEN', 'ANTI-CONSULT', 'ANTI-COOPERATE', 'ANTI-EFFORTS',
  'ANTI-FILING', 'ANTI-FOREIGN', 'ANTI-INFO', 'ANTI-INTERIM',
  'ANTI-LITIGATION', 'ANTI-NOACTION', 'ANTI-NOTIFY', 'ANTI-TIMING',
  'UNCLASSIFIED_NULL_SUBTYPE',
]);

const DECLARED_IMPLEMENTATION_AUDIT = Object.freeze({
  'db-apply': Object.freeze({
    state: 'CODE_READY_EXECUTION_NOT_ISSUED',
    gaps: Object.freeze(['FIXTURE_FIRST_EXECUTION_RECEIPT_NOT_ISSUED']),
  }),
  'topbuild-mae': Object.freeze({
    state: 'APPROVED_IMPLEMENTATION_PENDING',
    gaps: Object.freeze(['TOPBUILD_PER_LIMB_AND_TRAILING_UNION_IMPLEMENTATION_REQUIRED']),
  }),
  'tax-opinion': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'bd-card': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'closing-dissent-threshold-retirement': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'consideration-cvr-presence': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'consideration-election-mechanism': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'closing-termination-linking': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'defined-terms-first-comparable': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'defined-terms-next-slices': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'defined-terms-neutral-long-tail': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'defined-terms-misclassified-reclassification': Object.freeze({
    state: 'IMPLEMENTED',
    gaps: Object.freeze([]),
  }),
  'antitrust-expanded-taxonomy': Object.freeze({
    state: 'IMPLEMENTED_APPROVED_EXPANDED_PACKAGE',
    gaps: Object.freeze([]),
  }),
  'p9-programme-completion-terminal': Object.freeze({ state: 'IMPLEMENTED_POLICY_ONLY_NO_PASS_AUTHORITY', gaps: Object.freeze([]) }),
  'p9-security-production-access': Object.freeze({ state: 'IMPLEMENTED_POLICY_ONLY_NO_PRODUCTION_AUTHORITY', gaps: Object.freeze([]) }),
  'identity-initial-import-foundation': Object.freeze({ state: 'IMPLEMENTED_POLICY_ONLY_NO_IDENTITY_ISSUANCE', gaps: Object.freeze([]) }),
  'identity-batch-mapping-signature': Object.freeze({ state: 'IMPLEMENTED_POLICY_ONLY_BATCH_SIGNATURE_NOT_ISSUED', gaps: Object.freeze([]) }),
  'production-policy-package-v2': Object.freeze({
    state: 'IMPLEMENTED_DIGEST_BOUND_SUCCESSOR_M1_PASS_REQUIRED',
    gaps: Object.freeze([]),
  }),
});

const IMPLEMENTATION_AUDIT = Object.freeze(Object.fromEntries(
  Object.entries(DECLARED_IMPLEMENTATION_AUDIT).map(([rulingId, audit]) => [
    rulingId,
    Object.freeze({
      state: audit.gaps.length > 0
        ? audit.state
        : (rulingId === 'production-policy-package-v2'
          ? 'CODE_PRESENT_TEST_BINDINGS_DECLARED_SUCCESSOR_M1_PASS_REQUIRED'
          : 'CODE_PRESENT_TEST_BINDINGS_DECLARED'),
      verification_state: 'FINAL_INTEGRATED_RECEIPT_REQUIRED',
      gaps: audit.gaps,
    }),
  ]),
));

const BINDING_PROFILES = Object.freeze([
  Object.freeze({
    ids: Object.freeze(['db-apply']),
    code_paths: Object.freeze(['scripts/reprocess.js', 'scripts/reprocess/v1-apply-sequence.js', 'scripts/reprocess/v1-apply-receipt.js', 'scripts/reprocess/v1-apply-backup.js', 'scripts/reprocess/v1-apply-guard.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-v1-reclassification-design.md']),
    test_paths: Object.freeze(['tests/safety-check-reclass-rules.test.js', 'tests/v1-apply-sequence.test.js', 'tests/v1-apply-receipt.test.js', 'tests/v1-apply-backup.test.js', 'tests/v1-apply-guard.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['termr-concepts', 'either-party-capacity', 'outside-date-extension-shape', 'restraint-finality-states', 'closing-termination-linking']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/termination-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-termination-rights-design.md', 'docs/superpowers/specs/2026-08-03-family-termination-wave-b-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-termination-rights-resolution.test.js', 'tests/canonical-v2-termination-wave-b.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['nosol-tier', 'nosol-day-kind']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/no-shop-product-parity.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-no-shop-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-no-shop-resolution.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['capital-rank']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/capitalisation-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-p1-captable-numerics-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-capitalisation-producer-prompt.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['rem-cap', 'sole-remedy-ownership']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/specific-performance-remedies-producer-prompt.js', 'lib/canonical-v2/native-producer/termination-fee-producer-prompt.js', 'lib/canonical-v2/native-producer/sole-remedy-resolution.js', 'lib/canonical-v2/termination-product-projection.js', 'lib/canonical-v2/remedies-misc-product-projection.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-specific-performance-remedies-design.md', 'docs/superpowers/specs/2026-08-02-family-termination-fee-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-specific-performance-remedies-prompt-adapter.test.js', 'tests/canonical-v2-termination-fee-resolution.test.js', 'tests/canonical-v2-sole-remedy-resolution.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['bd-card']),
    code_paths: Object.freeze(['lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-specific-performance-remedies-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-bd837f1d-financing-source-open-world-pin.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['closing-revisit', 'closing-core-taxonomy', 'closing-dissent-threshold-retirement']),
    code_paths: Object.freeze([
      'lib/canonical-v2/closing-conditions-follow-on-source-pack.js',
      'lib/canonical-v2/closing-conditions-product-projection.js',
      'lib/canonical-v2/native-producer/closing-conditions-parity.js',
      'lib/canonical-v2/native-producer/closing-conditions-producer-prompt.js',
    ]),
    specification_paths: Object.freeze([
      'docs/superpowers/specs/2026-08-02-family-closing-conditions-design.md',
      'docs/superpowers/specs/2026-08-03-family-appraisal-dissenters-rights-design.md',
    ]),
    test_paths: Object.freeze([
      'tests/canonical-v2-closing-conditions-follow-on-source-pack.test.js',
      'tests/canonical-v2-closing-conditions-wave-b-resolution.test.js',
      'tests/canonical-v2-closing-conditions.test.js',
      'tests/programme-gates/m3-family-parity-register.spec.js',
    ]),
  }),
  Object.freeze({
    ids: Object.freeze(['topbuild-mae']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/mae-definition-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-mae-definition-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-mae-definition-resolution.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['tax-opinion']),
    code_paths: Object.freeze(['lib/canonical-v2/contract-bundle.js', 'lib/canonical-v2/native-producer/candidate-resolution.js', 'lib/canonical-v2/native-producer/tax-matters-producer-prompt.js', 'lib/canonical-v2/tax-dividends-appraisal-product-projection.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-tax-matters-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-tax-dividends-appraisal-product-projection.test.js', 'tests/canonical-v2-tax-dividends-appraisal-resolution.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['rank-88', 'appraisal-dispatch-ownership']),
    code_paths: Object.freeze(['lib/canonical-v2/merger-structure-product-projection.js', 'lib/canonical-v2/native-producer/appraisal-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-merger-structure-closing-design.md', 'docs/superpowers/specs/2026-08-03-family-appraisal-dissenters-rights-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-merger-structure-product-projection.test.js', 'tests/appraisal-rights-codebook.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['guaranty-codes']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/guaranty-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-guaranty-financing-party-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-guaranty.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['proxy-compatible-pair', 'proxy-record-date-broker-search', 'proxy-parent-adoption', 'proxy-adjournment-reasons']),
    code_paths: Object.freeze(['lib/canonical-v2/proxy-meeting-product-projection.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-proxy-meeting-covenants-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-proxy-meeting-follow-on.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['whole-letter']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/qualifier-kind-lexicon.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-p2-qualifier-kinds-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-p2-qualifier-kinds.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['ioc-partyless-provision', 'ioc-core-taxonomy', 'ioc-long-tail-promotion', 'ioc-qualifier-attachment', 'ioc-numeric-shape']),
    code_paths: Object.freeze(['lib/canonical-v2/ioc-wave-a-product-projection.js', 'lib/canonical-v2/consideration-ioc-evidence-product-projection.js', 'lib/canonical-v2/native-producer/ioc-producer-prompt.js', 'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-ioc-design.md', 'docs/superpowers/specs/2026-08-03-family-ioc-remaining-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-ioc-parent-child-resolution.test.js', 'tests/canonical-v2-ioc-remaining.test.js', 'tests/canonical-v2-ioc-mechanic-resolution.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['antitrust-expanded-taxonomy', 'antitrust-hohw', 'rank-65-collision']),
    code_paths: Object.freeze(['lib/canonical-v2/antitrust-product-projection.js', 'lib/canonical-v2/antitrust-v1-surface-disposition.js', 'lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt.js', 'lib/canonical-v2/native-producer/m3-certification-control.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-antitrust-regulatory-efforts-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-antitrust-expanded-package.test.js', 'tests/canonical-v2-antitrust-regulatory-efforts.test.js', 'tests/canonical-v2-m3-certification-control.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['consideration-mechanics-promotion', 'consideration-cvr-presence', 'consideration-election-mechanism', 'appraisal-necessary-implication']),
    code_paths: Object.freeze(['lib/canonical-v2/consideration-ioc-evidence-product-projection.js', 'lib/canonical-v2/consideration-wave-a-product-projection.js', 'lib/canonical-v2/native-producer/consideration-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-consideration-design.md', 'docs/superpowers/specs/2026-08-03-family-appraisal-dissenters-rights-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-consideration-family-seam.test.js', 'tests/canonical-v2-consideration-ioc-product-parity.test.js', 'tests/canonical-v2-consideration-ioc-real-replay.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['dividend-concept-scope', 'rank-85-dividend-dno']),
    code_paths: Object.freeze(['lib/canonical-v2/tax-dividends-appraisal-product-projection.js', 'lib/canonical-v2/employee-dno-product-projection.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-dividends-design.md', 'docs/superpowers/specs/2026-08-03-family-dno-indemnification-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-tax-dividend-appraisal-follow-on.test.js', 'tests/canonical-v2-employee-dno-follow-on.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['derived-comparison-layer']),
    code_paths: Object.freeze(['lib/programme-decision-console.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-ioc-remaining-design.md']),
    test_paths: Object.freeze(['tests/programme-decision-console.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['remaining-family-ranks']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/candidate-resolution.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-m3-product-parity-completion-layer.md']),
    test_paths: Object.freeze(['tests/programme-decision-console.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['fee-tail-shape', 'late-interest-shape']),
    code_paths: Object.freeze(['lib/canonical-v2/termination-product-projection.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-termination-fee-design.md', 'docs/superpowers/specs/2026-08-03-family-termination-wave-b-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-termination-product-parity.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['key-defined-terms-ranks', 'family-routing-key', 'defined-terms-first-comparable', 'defined-terms-next-slices']),
    code_paths: Object.freeze(['lib/canonical-v2/company-employee-definition-owner-routing.js', 'lib/canonical-v2/contract-bundle.js', 'lib/canonical-v2/key-terms-mae-product-projection.js', 'lib/canonical-v2/native-producer/candidate-resolution.js', 'lib/canonical-v2/native-producer/defined-terms-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-key-defined-terms-design.md', 'docs/superpowers/specs/2026-08-03-family-key-terms-mae-follow-on-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-company-employee-definition-owner-routing.test.js', 'tests/canonical-v2-contract-bundle-versions.test.js', 'tests/canonical-v2-key-terms-mae-follow-on.test.js', 'tests/canonical-v2-defined-terms-family-seam.test.js', 'tests/canonical-v2-defined-terms-later-slices.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['defined-terms-neutral-long-tail']),
    code_paths: Object.freeze(['lib/canonical-v2/neutral-defined-term-comparison-consumer.js', 'lib/canonical-v2/native-producer/anthropic-provider.js', 'lib/canonical-v2/native-producer/defined-terms-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-key-defined-terms-design.md', 'docs/superpowers/specs/2026-08-03-family-key-terms-mae-follow-on-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-neutral-defined-term-comparison-consumer.test.js', 'tests/canonical-v2-defined-terms-family-seam.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['defined-terms-misclassified-reclassification']),
    code_paths: Object.freeze(['lib/canonical-v2/content-reviewed-definition-reclassification-contract.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-key-defined-terms-design.md', 'docs/superpowers/specs/2026-08-03-family-key-terms-mae-follow-on-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-content-reviewed-definition-reclassification-contract.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['p9-programme-completion-terminal', 'p9-security-production-access']),
    code_paths: Object.freeze([
      'lib/programme-gates/governing-registry.js',
      'lib/programme-gates/p9-acceptance-definition-authority.js',
      'lib/programme-gates/p9-acceptance-evidence-inventory.js',
      'lib/programme-gates/p9-definition-proposal-layer.js',
    ]),
    specification_paths: Object.freeze([
      'docs/codex-program/canonical-contracts.md',
      'docs/codex-program/programme-gates.yaml',
    ]),
    test_paths: Object.freeze([
      'tests/programme-gates/governing-registry.spec.js',
      'tests/programme-gates/p9-acceptance-definition-authority.spec.js',
      'tests/programme-gates/p9-acceptance-evidence-inventory.spec.js',
      'tests/programme-gates/p9-definition-proposal-layer.spec.js',
    ]),
  }),
  Object.freeze({
    ids: Object.freeze(['identity-initial-import-foundation', 'identity-batch-mapping-signature']),
    code_paths: Object.freeze([
      'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
      'lib/canonical-v2/governed-identity-proposal-packet.js',
      'lib/canonical-v2/governed-identity-trust-contracts.js',
      'lib/canonical-v2/governed-identity-readiness-descriptor.js',
      'lib/canonical-v2/identity-human-review-projection.js',
    ]),
    specification_paths: Object.freeze(['docs/codex-program/canonical-contracts.md']),
    test_paths: Object.freeze([
      'tests/canonical-v2-literal-trusted-key-registry-patch.test.js',
      'tests/canonical-v2-governed-identity-proposal-packet.test.js',
      'tests/canonical-v2-governed-identity-trust-contracts.test.js',
      'tests/canonical-v2-governed-identity-readiness-descriptor.test.js',
      'tests/canonical-v2-identity-human-review-projection.test.js',
    ]),
  }),
  Object.freeze({
    ids: Object.freeze(['production-policy-package-v2']),
    code_paths: Object.freeze([
      'lib/canonical-v2/operational-policy-set-proposal.js',
      'lib/canonical-v2/certification-policy-manifest-proposal.js',
      'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
      'lib/canonical-v2/successor-m1-readiness-packet.js',
    ]),
    specification_paths: Object.freeze(['docs/codex-program/canonical-contracts.md']),
    test_paths: Object.freeze([
      'tests/canonical-v2-policy-proposals.test.js',
      'tests/canonical-v2-policy-successor-m1-adoption-binding.test.js',
      'tests/canonical-v2-successor-m1-readiness-packet.test.js',
    ]),
  }),
]);

class DecisionReconciliationProposalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DecisionReconciliationProposalError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new DecisionReconciliationProposalError(code, message);
}

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(frozen);
  return Object.freeze(value);
}

function profileIndex(profiles) {
  const index = new Map();
  for (const profile of profiles) {
    for (const id of profile.ids) {
      if (index.has(id)) fail('DUPLICATE_DECISION_BINDING_PROFILE', `Decision ${id} has more than one binding profile.`);
      index.set(id, profile);
    }
  }
  return index;
}

function pathBindings(paths, repositoryRoot, readFileSync) {
  return Object.freeze([...new Set(paths)].sort().map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    let bytes;
    try {
      bytes = readFileSync(absolutePath);
    } catch (_) {
      fail('DECISION_BINDING_SOURCE_UNAVAILABLE', `Decision binding source is unavailable: ${relativePath}`);
    }
    return Object.freeze({ path: relativePath, sha256: sha256Hex(bytes) });
  }));
}

function rulingSets(recordedRulings) {
  const entries = Array.isArray(recordedRulings) ? recordedRulings : Object.entries(recordedRulings || {});
  const choices = new Map();
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || typeof entry[1] !== 'string') {
      fail('INVALID_RECORDED_RULING', 'Each recorded ruling must be a decision and choice pair.');
    }
    if (!choices.has(entry[0])) choices.set(entry[0], new Set());
    choices.get(entry[0]).add(entry[1]);
  }
  return choices;
}

function rejectCallerCompilationOptions(options) {
  if (!options || typeof options !== 'object' || Object.keys(options).length > 0) {
    fail('DECISION_RECONCILIATION_OPTIONS_FORBIDDEN', 'Decision reconciliation uses only its canonical repository bindings.');
  }
}

function compileDecisionReconciliationProposal(options = {}) {
  rejectCallerCompilationOptions(options);
  const bindingProfiles = BINDING_PROFILES;
  const repositoryRoot = REPOSITORY_ROOT;
  const readFileSync = fs.readFileSync;
  const decisions = DECISIONS;
  if (!Array.isArray(decisions)) fail('INVALID_DECISION_UNIVERSE', 'The decision universe must be an array.');
  const decisionIds = decisions.map((decision) => decision.id);
  if (decisionIds.some((id) => typeof id !== 'string') || new Set(decisionIds).size !== decisionIds.length) {
    fail('INVALID_DECISION_UNIVERSE', 'Decision identifiers must be complete and unique.');
  }
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
  validateRecordedRulingProvenance();
  const choices = rulingSets(VALIDATED_RULING_CHOICES);
  const conflicts = [...choices.entries()]
    .filter(([, values]) => values.size !== 1)
    .map(([id]) => id)
    .sort();
  const unknownRulings = [...choices.keys()].filter((id) => !decisionsById.has(id)).sort();
  const invalidChoices = [...choices.entries()].filter(([id, values]) => {
    const decision = decisionsById.get(id);
    return decision && [...values].some((choice) => !decision.options.some((option) => option.id === choice));
  }).map(([id]) => id).sort();
  const profiles = profileIndex(bindingProfiles);
  const missingBindings = [...choices.keys()].filter((id) => !profiles.has(id)).sort();
  const recorded = [...choices.entries()]
    .filter(([id, values]) => decisionsById.has(id) && values.size === 1)
    .map(([id, values]) => {
      const profile = profiles.get(id);
      const audit = IMPLEMENTATION_AUDIT[id] || Object.freeze({
        state: 'IMPLEMENTATION_AUDIT_REQUIRED',
        verification_state: 'FINAL_INTEGRATED_RECEIPT_REQUIRED',
        gaps: Object.freeze(['IMPLEMENTATION_AUDIT_REQUIRED']),
      });
      return Object.freeze({
        ruling_id: id,
        choice_id: [...values][0],
        evidence_source: 'lib/programme-decision-console.js#PRIMARY_RULING_PROVENANCE_BY_ID',
        code_bindings: profile ? pathBindings(['lib/programme-decision-console.js', ...profile.code_paths], repositoryRoot, readFileSync) : Object.freeze([]),
        specification_bindings: profile ? pathBindings(profile.specification_paths, repositoryRoot, readFileSync) : Object.freeze([]),
        test_bindings: profile ? pathBindings(['tests/programme-decision-console.test.js', ...profile.test_paths], repositoryRoot, readFileSync) : Object.freeze([]),
        implementation_state: audit.state,
        verification_state: audit.verification_state,
        implementation_gap_codes: audit.gaps,
      });
    }).sort((left, right) => left.ruling_id.localeCompare(right.ruling_id));
  const missingRulings = PENDING_USER_RATIFICATION_RULING_IDS.slice().sort();
  const futureDecisionIds = decisions
    .filter((decision) => decision.horizon === 'later' && !choices.has(decision.id))
    .map((decision) => decision.id)
    .sort();
  const implementationGapRulingIds = recorded
    .filter((entry) => entry.implementation_gap_codes.length > 0)
    .map((entry) => entry.ruling_id)
    .sort();
  const antitrust = decisionsById.get('antitrust-expanded-taxonomy');
  if (!antitrust || canonicalJson(antitrust.resolved_topics?.at(-1)?.rendered_v1_surfaces) !== canonicalJson(ANTITRUST_V1_SURFACE_IDS)) {
    fail('ANTITRUST_DOCKET_INCOMPLETE', 'The updated antitrust docket must bind every rendered V1 surface.');
  }
  validateAntitrustV1SurfaceDispositions();
  const foreignSurface = dispositionForV1Surface('ANTI-FOREIGN');
  const namedRegimeRoute = foreignSurface?.conditional_routes?.find(
    (route) => route.atomic_fact === 'NAMED_REGIME_FILING_OR_DEADLINE',
  );
  if (foreignSurface?.disposition !== 'RETIRED_CONTENT_RECLASSIFY'
    || namedRegimeRoute?.target !== 'ANTI-FILING'
    || foreignSurface.residual_disposition !== 'EXACT_OPEN_WORLD_EVIDENCE') {
    fail('ANTITRUST_FOREIGN_FILING_PRESERVATION_INCOMPLETE', 'Retiring ANTI-FOREIGN requires a canonical ANTI-FILING route and exact residual evidence.');
  }
  for (const rulingId of LATER_RECORDED_RULING_IDS) {
    if (!choices.has(rulingId)) fail('LATER_BEN_RULING_MISSING', `Later Ben ruling is not recorded: ${rulingId}`);
  }
  const rulingEvidenceFreezeReady = missingRulings.length === 0
    && conflicts.length === 0
    && unknownRulings.length === 0
    && invalidChoices.length === 0
    && missingBindings.length === 0;
  const implementationReconciliationReady = implementationGapRulingIds.length === 0;
  // Kept for older consumers, but it is deliberately the conjunction.
  // A complete set of user rulings is not a complete implementation state.
  const decisionRegisterFreezeReady = rulingEvidenceFreezeReady && implementationReconciliationReady;
  const familyCompletionBlockerCodes = [
    ...(!rulingEvidenceFreezeReady ? ['RULING_EVIDENCE_RECONCILIATION_REQUIRED'] : []),
    ...(!implementationReconciliationReady ? ['RECORDED_RULING_IMPLEMENTATION_GAPS'] : []),
    'RATIFIED_DECISION_REGISTER_FREEZE_REQUIRED',
  ];
  const sourceBinding = pathBindings([
    'lib/canonical-v2/decision-reconciliation-proposal.js',
    'lib/programme-decision-console.js',
    'docs/codex-program/m3-family-parity-register.json',
  ], repositoryRoot, readFileSync);
  const body = {
    schema_version: PROPOSAL_SCHEMA,
    status: 'PROPOSAL_ONLY_BLOCKED_NOT_DECISION_REGISTER_AUTHORITY',
    authority: AUTHORITY,
    decision_register_freeze_authority: AUTHORITY,
    successor_m1_authority: AUTHORITY,
    source_bindings: sourceBinding,
    declared_ruling_count: Object.keys(RECORDED_RULINGS).length,
    recorded_ruling_count: recorded.length,
    recorded_rulings: Object.freeze(recorded),
    missing_ruling_ids: Object.freeze(missingRulings),
    conflicting_ruling_ids: Object.freeze(conflicts),
    unknown_ruling_ids: Object.freeze(unknownRulings),
    invalid_choice_ruling_ids: Object.freeze(invalidChoices),
    missing_binding_ruling_ids: Object.freeze(missingBindings),
    implementation_gap_ruling_ids: Object.freeze(implementationGapRulingIds),
    pending_user_ratification_ruling_ids: Object.freeze(missingRulings),
    blocking_unresolved_decision_ids: Object.freeze(missingRulings),
    nonblocking_future_decision_ids: Object.freeze(futureDecisionIds),
    antitrust_docket: frozen({
      decision_id: antitrust.id,
      question: antitrust.question,
      current: antitrust.current,
      recommendation: antitrust.recommendation,
      option_ids: antitrust.options.map((option) => option.id),
      resolved_topics: antitrust.resolved_topics,
      foreign_filing_preservation: Object.freeze({
        source_surface: foreignSurface.v1_surface,
        disposition: foreignSurface.disposition,
        atomic_fact: namedRegimeRoute.atomic_fact,
        governed_target: namedRegimeRoute.target,
        residual_disposition: foreignSurface.residual_disposition,
      }),
    }),
    ruling_evidence_freeze_ready: rulingEvidenceFreezeReady,
    implementation_reconciliation_ready: implementationReconciliationReady,
    // Deprecated compatibility field. It is true only when both explicit
    // readiness conditions are true, so it cannot be read as evidence-only.
    decision_register_freeze_ready: decisionRegisterFreezeReady,
    family_completion_ready: false,
    family_completion_blocker_codes: Object.freeze([...new Set(familyCompletionBlockerCodes)].sort()),
  };
  return frozen({
    ...body,
    decision_reconciliation_proposal_id: contentId(PROPOSAL_SCHEMA, body),
  });
}

function validateDecisionReconciliationProposal(proposal, options = {}) {
  rejectCallerCompilationOptions(options);
  if (!proposal || proposal.schema_version !== PROPOSAL_SCHEMA
    || proposal.authority !== AUTHORITY
    || proposal.decision_register_freeze_authority !== AUTHORITY
    || proposal.successor_m1_authority !== AUTHORITY
    || proposal.family_completion_ready !== false) {
    fail('DECISION_RECONCILIATION_AUTHORITY_VIOLATION', 'The decision reconciliation gate must remain a blocked non-authority proposal.');
  }
  const { decision_reconciliation_proposal_id: proposalId, ...body } = proposal;
  if (proposalId !== contentId(PROPOSAL_SCHEMA, body)) {
    fail('DECISION_RECONCILIATION_IDENTITY_INVALID', 'The decision reconciliation proposal identity does not match its content.');
  }
  for (const ruling of proposal.recorded_rulings || []) {
    if (![ruling.code_bindings, ruling.specification_bindings, ruling.test_bindings]
      .every((bindings) => Array.isArray(bindings) && bindings.length > 0)) {
      fail('DECISION_BINDING_INCOMPLETE', `Ruling ${ruling.ruling_id} lacks a code, specification or test binding.`);
    }
  }
  if (canonicalJson(proposal.pending_user_ratification_ruling_ids) !== canonicalJson(PENDING_USER_RATIFICATION_RULING_IDS)
    || proposal.declared_ruling_count !== Object.keys(RECORDED_RULINGS).length
    || proposal.recorded_ruling_count !== Object.keys(VALIDATED_RULING_CHOICES).length) {
    fail('DECISION_RECONCILIATION_RULING_SET_INVALID', 'The closed ruling set does not match the primary user evidence.');
  }
  if (PENDING_USER_RATIFICATION_RULING_IDS.length > 0 && proposal.ruling_evidence_freeze_ready) {
    fail('DECISION_RECONCILIATION_PENDING_RATIFICATION_REQUIRED', 'A pending direct ratification must block decision-register freeze.');
  }
  if (proposal.decision_register_freeze_ready !== (
    proposal.ruling_evidence_freeze_ready && proposal.implementation_reconciliation_ready
  )) {
    fail('DECISION_RECONCILIATION_FREEZE_SEMANTICS_INVALID', 'The deprecated freeze flag must be the conjunction of evidence and implementation readiness.');
  }
  const expected = compileDecisionReconciliationProposal();
  if (canonicalJson(proposal) !== canonicalJson(expected)) {
    fail('DECISION_RECONCILIATION_STALE', 'The decision reconciliation proposal is stale or conflicts with current decisions and source bindings.');
  }
  return expected;
}

function bindDecisionConditionalFamilyStatus(rawFamilyStatus, proposal) {
  validateM3FamilyParityStatus(rawFamilyStatus);
  validateM3FamilyParityStatus(CURRENT_M3_FAMILY_PARITY_STATUS);
  if (canonicalJson(rawFamilyStatus) !== canonicalJson(CURRENT_M3_FAMILY_PARITY_STATUS)) {
    fail('FAMILY_STATUS_BINDING_STALE', 'The family status must be the canonical current content-addressed status.');
  }
  validateDecisionReconciliationProposal(proposal);
  const body = {
    schema_version: FAMILY_STATUS_SCHEMA,
    raw_family_status_id: rawFamilyStatus.m3_family_parity_status_id,
    raw_family_state: rawFamilyStatus.state,
    decision_reconciliation_proposal_id: proposal.decision_reconciliation_proposal_id,
    ruling_evidence_freeze_ready: proposal.ruling_evidence_freeze_ready,
    implementation_reconciliation_ready: proposal.implementation_reconciliation_ready,
    decision_register_freeze_ready: proposal.decision_register_freeze_ready,
    decision_register_freeze_authority: proposal.decision_register_freeze_authority,
    state: rawFamilyStatus.state === 'FAMILY_COMPLETE' && proposal.family_completion_ready
      ? 'FAMILY_COMPLETE'
      : 'BLOCKED',
    blocker_codes: proposal.family_completion_blocker_codes,
  };
  return frozen({
    ...body,
    decision_conditional_family_status_id: contentId(FAMILY_STATUS_SCHEMA, body),
  });
}

function decisionReconciliationBinding(proposal) {
  validateDecisionReconciliationProposal(proposal);
  return frozen({
    proposal_id: proposal.decision_reconciliation_proposal_id,
    status: proposal.status,
    authority: proposal.authority,
    recorded_ruling_count: proposal.recorded_ruling_count,
    missing_ruling_ids: proposal.missing_ruling_ids,
    conflicting_ruling_ids: proposal.conflicting_ruling_ids,
    missing_binding_ruling_ids: proposal.missing_binding_ruling_ids,
    implementation_gap_ruling_ids: proposal.implementation_gap_ruling_ids,
    pending_user_ratification_ruling_ids: proposal.pending_user_ratification_ruling_ids,
    blocking_unresolved_decision_ids: proposal.blocking_unresolved_decision_ids,
    ruling_evidence_freeze_ready: proposal.ruling_evidence_freeze_ready,
    implementation_reconciliation_ready: proposal.implementation_reconciliation_ready,
    decision_register_freeze_ready: proposal.decision_register_freeze_ready,
    decision_register_freeze_authority: proposal.decision_register_freeze_authority,
    family_completion_ready: proposal.family_completion_ready,
  });
}

module.exports = {
  ANTITRUST_V1_SURFACE_IDS,
  AUTHORITY,
  BINDING_PROFILES,
  DecisionReconciliationProposalError,
  FAMILY_STATUS_SCHEMA,
  IMPLEMENTATION_AUDIT,
  LATER_RECORDED_RULING_IDS,
  PROPOSAL_SCHEMA,
  REPOSITORY_ROOT,
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
  decisionReconciliationBinding,
  validateDecisionReconciliationProposal,
};
