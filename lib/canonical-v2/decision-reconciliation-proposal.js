'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { DECISIONS, RECORDED_RULINGS } = require('../programme-decision-console');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');

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

const IMPLEMENTATION_AUDIT = Object.freeze({
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
    state: 'BLOCKED_UNRATIFIED',
    gaps: Object.freeze([
      'EXPANDED_ANTITRUST_TAXONOMY_RATIFICATION_REQUIRED',
      'RENDERED_V1_ANTITRUST_TERMINAL_DISPOSITIONS_REQUIRED',
    ]),
  }),
});

const BINDING_PROFILES = Object.freeze([
  Object.freeze({
    ids: Object.freeze(['db-apply']),
    code_paths: Object.freeze(['scripts/reprocess.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-v1-reclassification-design.md']),
    test_paths: Object.freeze(['tests/safety-check-reclass-rules.test.js']),
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
    ids: Object.freeze(['rem-cap', 'bd-card', 'sole-remedy-ownership']),
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/specific-performance-remedies-producer-prompt.js', 'lib/canonical-v2/native-producer/termination-fee-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-specific-performance-remedies-design.md', 'docs/superpowers/specs/2026-08-02-family-termination-fee-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-specific-performance-remedies-prompt-adapter.test.js', 'tests/canonical-v2-termination-fee-resolution.test.js']),
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
    code_paths: Object.freeze(['lib/canonical-v2/native-producer/tax-matters-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-03-family-tax-matters-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-tax-dividends-appraisal-resolution.test.js']),
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
    code_paths: Object.freeze(['lib/canonical-v2/ioc-wave-a-product-projection.js', 'lib/canonical-v2/native-producer/ioc-producer-prompt.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-ioc-design.md', 'docs/superpowers/specs/2026-08-03-family-ioc-remaining-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-ioc-parent-child-resolution.test.js', 'tests/canonical-v2-ioc-remaining.test.js']),
  }),
  Object.freeze({
    ids: Object.freeze(['antitrust-expanded-taxonomy', 'antitrust-hohw', 'rank-65-collision']),
    code_paths: Object.freeze(['lib/canonical-v2/antitrust-product-projection.js', 'lib/canonical-v2/native-producer/antitrust-regulatory-producer-prompt.js', 'lib/canonical-v2/native-producer/m3-certification-control.js']),
    specification_paths: Object.freeze(['docs/superpowers/specs/2026-08-02-family-antitrust-regulatory-efforts-design.md']),
    test_paths: Object.freeze(['tests/canonical-v2-antitrust-regulatory-efforts.test.js', 'tests/canonical-v2-m3-certification-control.test.js']),
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

function compileDecisionReconciliationProposal({
  decisions = DECISIONS,
  recorded_rulings: recordedRulings = RECORDED_RULINGS,
  binding_profiles: bindingProfiles = BINDING_PROFILES,
  repository_root: repositoryRoot = REPOSITORY_ROOT,
  readFileSync = fs.readFileSync,
} = {}) {
  if (!Array.isArray(decisions)) fail('INVALID_DECISION_UNIVERSE', 'The decision universe must be an array.');
  const decisionIds = decisions.map((decision) => decision.id);
  if (decisionIds.some((id) => typeof id !== 'string') || new Set(decisionIds).size !== decisionIds.length) {
    fail('INVALID_DECISION_UNIVERSE', 'Decision identifiers must be complete and unique.');
  }
  const decisionsById = new Map(decisions.map((decision) => [decision.id, decision]));
  const choices = rulingSets(recordedRulings);
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
        state: 'BOUND_TO_CURRENT_FAMILY_EVIDENCE',
        gaps: Object.freeze([]),
      });
      return Object.freeze({
        ruling_id: id,
        choice_id: [...values][0],
        authority_source: 'lib/programme-decision-console.js#RECORDED_RULINGS',
        code_bindings: profile ? pathBindings(['lib/programme-decision-console.js', ...profile.code_paths], repositoryRoot, readFileSync) : Object.freeze([]),
        specification_bindings: profile ? pathBindings(profile.specification_paths, repositoryRoot, readFileSync) : Object.freeze([]),
        test_bindings: profile ? pathBindings(['tests/programme-decision-console.test.js', ...profile.test_paths], repositoryRoot, readFileSync) : Object.freeze([]),
        implementation_state: audit.state,
        implementation_gap_codes: audit.gaps,
      });
    }).sort((left, right) => left.ruling_id.localeCompare(right.ruling_id));
  const missingRulings = decisions
    .filter((decision) => decision.horizon !== 'later' && !choices.has(decision.id))
    .map((decision) => decision.id)
    .sort();
  const futureDecisionIds = decisions
    .filter((decision) => decision.horizon === 'later' && !choices.has(decision.id))
    .map((decision) => decision.id)
    .sort();
  const implementationGapRulingIds = recorded
    .filter((entry) => entry.implementation_gap_codes.length > 0)
    .map((entry) => entry.ruling_id)
    .sort();
  const antitrust = decisionsById.get('antitrust-expanded-taxonomy');
  if (!antitrust || canonicalJson(antitrust.unresolved_topics?.at(-1)?.rendered_v1_surfaces) !== canonicalJson(ANTITRUST_V1_SURFACE_IDS)) {
    fail('ANTITRUST_DOCKET_INCOMPLETE', 'The updated antitrust docket must bind every rendered V1 surface.');
  }
  for (const rulingId of LATER_RECORDED_RULING_IDS) {
    if (!choices.has(rulingId)) fail('LATER_BEN_RULING_MISSING', `Later Ben ruling is not recorded: ${rulingId}`);
  }
  const decisionRegisterFreezeReady = missingRulings.length === 0
    && conflicts.length === 0
    && unknownRulings.length === 0
    && invalidChoices.length === 0
    && missingBindings.length === 0;
  const familyCompletionBlockerCodes = [
    ...(!decisionRegisterFreezeReady ? ['DECISION_RECONCILIATION_REQUIRED'] : []),
    ...(implementationGapRulingIds.length > 0 ? ['RECORDED_RULING_IMPLEMENTATION_GAPS'] : []),
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
    recorded_ruling_count: recorded.length,
    recorded_rulings: Object.freeze(recorded),
    missing_ruling_ids: Object.freeze(missingRulings),
    conflicting_ruling_ids: Object.freeze(conflicts),
    unknown_ruling_ids: Object.freeze(unknownRulings),
    invalid_choice_ruling_ids: Object.freeze(invalidChoices),
    missing_binding_ruling_ids: Object.freeze(missingBindings),
    implementation_gap_ruling_ids: Object.freeze(implementationGapRulingIds),
    blocking_unresolved_decision_ids: Object.freeze(missingRulings),
    nonblocking_future_decision_ids: Object.freeze(futureDecisionIds),
    antitrust_docket: frozen({
      decision_id: antitrust.id,
      question: antitrust.question,
      current: antitrust.current,
      recommendation: antitrust.recommendation,
      option_ids: antitrust.options.map((option) => option.id),
      unresolved_topics: antitrust.unresolved_topics,
    }),
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
  const expected = compileDecisionReconciliationProposal(options);
  if (canonicalJson(proposal) !== canonicalJson(expected)) {
    fail('DECISION_RECONCILIATION_STALE', 'The decision reconciliation proposal is stale or conflicts with current decisions and source bindings.');
  }
  return expected;
}

function bindDecisionConditionalFamilyStatus(rawFamilyStatus, proposal) {
  if (!rawFamilyStatus || typeof rawFamilyStatus.m3_family_parity_status_id !== 'string') {
    fail('FAMILY_STATUS_BINDING_INVALID', 'A content-addressed M3 family parity status is required.');
  }
  validateDecisionReconciliationProposal(proposal);
  const body = {
    schema_version: FAMILY_STATUS_SCHEMA,
    raw_family_status_id: rawFamilyStatus.m3_family_parity_status_id,
    raw_family_state: rawFamilyStatus.state,
    decision_reconciliation_proposal_id: proposal.decision_reconciliation_proposal_id,
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
    blocking_unresolved_decision_ids: proposal.blocking_unresolved_decision_ids,
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
