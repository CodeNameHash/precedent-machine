'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  INITIAL_IMPORT_PACKET_SCHEMA,
  MANIFEST_SCHEMA: DEAL_IDENTITY_MANIFEST_SCHEMA,
} = require('./governed-identity-proposal-packet');
const {
  BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN,
} = require('./governed-identity-trust-contracts');
const {
  LITERAL_PATCH_SCHEMA: LITERAL_TRUSTED_KEY_REGISTRY_PATCH_SCHEMA,
  PROPOSAL_SCHEMA: TRUSTED_KEY_DOMAIN_EXTENSION_SCHEMA,
} = require('./deal-identity-trusted-key-registry-proposal');
const {
  buildOperationalPolicySetProposal,
  validateOperationalPolicySetProposal,
} = require('./operational-policy-set-proposal');
const {
  buildCertificationPolicyManifestProposal,
  validateCertificationPolicyManifestProposal,
} = require('./certification-policy-manifest-proposal');
const {
  buildCurrentPolicySuccessorM1AdoptionBinding,
  validatePolicySuccessorM1AdoptionBinding,
} = require('./policy-successor-m1-adoption-binding');
const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  buildM3FamilyParityStatus,
  validateM3FamilyParityRegister,
  validateM3FamilyParityStatus,
} = require('./native-producer/m3-family-parity-register');
const {
  COMPLETION_GATE_ID,
  CURRENT_LIVE_P9_GATE_IDS: GOVERNING_REGISTRY_P9_GATE_IDS,
  PHASE_12_SECURITY_GATE_ID,
  createGoverningRegistryAuthority,
} = require('../programme-gates/governing-registry');
const {
  APPROVED_RETIRED_OPEN_WORLD,
  SOURCE_PACK_SCHEMA,
  STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL,
} = require('./closing-conditions-follow-on-source-pack');
const {
  STATUS: V1_TRUSTED_CAPTURE_READINESS_STATUS,
  MISSING_REQUIREMENTS: V1_TRUSTED_CAPTURE_MISSING_REQUIREMENTS,
  buildV1TrustedCaptureReadinessDescriptor,
  validateV1TrustedCaptureReadinessDescriptor,
} = require('./v1-trusted-capture-readiness-descriptor');
const {
  STATUS: GOVERNED_IDENTITY_READINESS_STATUS,
  MISSING_REQUIREMENTS: GOVERNED_IDENTITY_MISSING_REQUIREMENTS,
  buildGovernedIdentityReadinessDescriptor,
  validateGovernedIdentityReadinessDescriptor,
} = require('./governed-identity-readiness-descriptor');
const {
  SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA,
  TRUSTED_CONTROLLER_BLOCKER: SOURCE_EXCEPTION_CONTROLLER_BLOCKER,
  buildSourceExceptionApprovalReadiness,
} = require('./source-exception-approval-contract');
const {
  AUTHORITY_READINESS_SCHEMA: SOURCE_INTAKE_AUTHORITY_READINESS_SCHEMA,
  SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  buildSourceIntakeAuthorityReadiness,
} = require('./source-intake-readiness');
const {
  bindDecisionConditionalFamilyStatus,
  compileDecisionReconciliationProposal,
  decisionReconciliationBinding,
  validateDecisionReconciliationProposal,
} = require('./decision-reconciliation-proposal');

const SUCCESSOR_M1_READINESS_PACKET_SCHEMA = 'SUCCESSOR_M1_READINESS_PACKET/V1';
const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const PHASE1_BASE_COMMIT = '6c446b171537768a6560534ff6338e048b4eb7cc';
const PHASE1_CONTROL_STATIC_ARTIFACTS = Object.freeze([
  'docs/codex-program/specification-manifest.json',
  'docs/codex-program/m3-family-parity-register.json',
  'docs/codex-program/adversarial-tests.md',
]);
const PHASE1_CONTROL_SOURCE_ROOTS = Object.freeze([
  'lib/canonical-v2/antitrust-v1-surface-disposition.js',
  'lib/canonical-v2/closing-conditions-follow-on-source-pack.js',
  'lib/canonical-v2/governed-identity-proposal-packet.js',
  'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  'lib/canonical-v2/deal-identity-allocation-readiness.js',
  'lib/canonical-v2/deal-identity-persistence-controller-interface.js',
  'lib/canonical-v2/deal-source-binding.js',
  'lib/canonical-v2/decision-reconciliation-proposal.js',
  'lib/canonical-v2/dark-integration-preflight.js',
  'lib/canonical-v2/operational-policy-set-proposal.js',
  'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
  'lib/canonical-v2/phase1-authority-boundary-inventory.js',
  'lib/canonical-v2/certification-policy-manifest-proposal.js',
  'lib/canonical-v2/corpus-source-discovery-capture.js',
  'lib/canonical-v2/successor-m1-readiness-packet.js',
  'lib/canonical-v2/v1-trusted-capture-control-contracts.js',
  'lib/canonical-v2/v1-capture-evidence-proposal.js',
  'lib/canonical-v2/v1-replay-evidence-proposal.js',
  'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
  'lib/canonical-v2/v1-render-capture-preflight.js',
  'lib/canonical-v2/v1-trusted-capture-readiness-descriptor.js',
  'lib/canonical-v2/governed-identity-trust-contracts.js',
  'lib/canonical-v2/governed-identity-readiness-descriptor.js',
  'lib/canonical-v2/identity-consumer-closure-audit.js',
  'lib/canonical-v2/source-universe-inventory-candidate.js',
  'lib/canonical-v2/source-universe-inventory-planner.js',
  'lib/canonical-v2/source-intake-readiness.js',
  'lib/canonical-v2/source-exception-approval-contract.js',
  'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
  'lib/canonical-v2/native-producer/v1v2-comparator.js',
  'lib/programme-gates/governing-registry.js',
  'scripts/canonical-v2-corpus-source-discovery-capture.js',
  'scripts/export-v1-provision-snapshot.mjs',
  'tests/canonical-v2-phase1-authority-boundary.test.js',
]);
const GOVERNING_FILE_PATHS = Object.freeze([...PHASE1_CONTROL_STATIC_ARTIFACTS, ...PHASE1_CONTROL_SOURCE_ROOTS]);
const REQUIRED_BLOCKER_CODES = Object.freeze([
  ...V1_TRUSTED_CAPTURE_MISSING_REQUIREMENTS,
  ...GOVERNED_IDENTITY_MISSING_REQUIREMENTS,
  'P9_ACCEPTANCE_DEFINITIONS_UNADOPTED',
  'EXACT_POLICY_MANIFEST_DIGEST_ADOPTION_REQUIRED',
  'SUCCESSOR_M1_APPROVAL_REQUIRED',
  'IDENTITY_CONSUMERS_REAL_VERIFIER_REQUIRED',
  'SOURCE_ADMISSION_AND_SCOPE_FREEZE_REQUIRED',
  ...SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS,
  'SOURCE_EXCEPTION_TRUSTED_CONTROLLER_AND_REGISTRY_AMENDMENT_REQUIRED',
  'FINAL_INTEGRATED_COMMIT_BUILD_RECEIPT_REQUIRED',
  'V1_SNAPSHOT_CLOSED_ALLOCATION_EVIDENCE_REQUIRED',
  'EXTERNAL_ISSUER_REGISTRY_TRUST_ANCHOR_REQUIRED',
]);

class SuccessorM1ReadinessPacketError extends Error {
  constructor(code, message) { super(message); this.name = 'SuccessorM1ReadinessPacketError'; this.code = code; }
}

function fail(code, message) { throw new SuccessorM1ReadinessPacketError(code, message); }
function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}
function digest(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function requireNonTemporaryRepositoryRoot(repositoryRoot) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) fail('WORKTREE_ROOT_INVALID', 'Successor M1 packet requires an absolute repository root.');
  const resolved = path.resolve(repositoryRoot);
  const temporaryRoots = [os.tmpdir(), '/tmp', '/var/tmp'].map((entry) => path.resolve(entry));
  if (temporaryRoots.some((temporaryRoot) => resolved === temporaryRoot || resolved.startsWith(`${temporaryRoot}${path.sep}`))) {
    fail('WORKTREE_TEMPORARY_ROOT_FORBIDDEN', 'Successor M1 packet cannot bind a temporary repository root.');
  }
  return resolved;
}
function git(repositoryRoot, args) {
  try {
    return childProcess.execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    fail('WORKTREE_GIT_BINDING_UNAVAILABLE', `Cannot read the Phase 1 Git binding: ${error.message}`);
  }
}

function localControlImports(source) {
  const specifiers = new Set();
  const add = (specifier) => { if (specifier.startsWith('.')) specifiers.add(specifier); };
  for (const match of source.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) add(match[1]);
  for (const match of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) add(match[1]);
  for (const match of source.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) add(match[1]);
  return Object.freeze([...specifiers].sort());
}

function resolveLocalControlImport(repositoryRoot, importerPath, specifier) {
  const base = path.resolve(repositoryRoot, path.dirname(importerPath), specifier);
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.js'), path.join(base, 'index.mjs')];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) return null;
  const relativePath = path.relative(repositoryRoot, resolved).split(path.sep).join('/');
  return /^(?:lib|scripts|tests)\//.test(relativePath) ? relativePath : null;
}

function buildTransitiveControlSourceInventory({ repository_root: repositoryRoot, readFileSync = fs.readFileSync } = {}) {
  const root = requireNonTemporaryRepositoryRoot(repositoryRoot);
  const pending = [...PHASE1_CONTROL_SOURCE_ROOTS];
  const visited = new Set();
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (visited.has(relativePath)) continue;
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      fail('CONTROL_SOURCE_UNAVAILABLE', `Phase 1 control source is missing: ${relativePath}`);
    }
    visited.add(relativePath);
    const source = Buffer.from(readFileSync(absolutePath)).toString('utf8');
    for (const specifier of localControlImports(source)) {
      const dependency = resolveLocalControlImport(root, relativePath, specifier);
      if (dependency) pending.push(dependency);
    }
  }
  const inventory = [...visited].sort().map((relativePath) => Object.freeze({
    path: relativePath,
    current_sha256: sha256Hex(readFileSync(path.join(root, relativePath))),
  }));
  for (const requiredPath of PHASE1_CONTROL_SOURCE_ROOTS) {
    if (!inventory.some((entry) => entry.path === requiredPath)) {
      fail('CONTROL_SOURCE_ROOT_OMITTED', `Phase 1 control source inventory omitted ${requiredPath}`);
    }
  }
  return Object.freeze(inventory);
}

function currentWorktreeBinding(repositoryRoot) {
  const base = git(repositoryRoot, ['rev-parse', PHASE1_BASE_COMMIT]);
  const baseTree = git(repositoryRoot, ['rev-parse', `${PHASE1_BASE_COMMIT}^{tree}`]);
  const head = git(repositoryRoot, ['rev-parse', 'HEAD']);
  const headTree = git(repositoryRoot, ['rev-parse', 'HEAD^{tree}']);
  if (base !== PHASE1_BASE_COMMIT || !/^[a-f0-9]{40}$/.test(baseTree) || !/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(headTree)) {
    fail('WORKTREE_GIT_BINDING_INVALID', 'The explicit Phase 1 base and observed worktree Git identifiers must be full commit or tree identifiers.');
  }
  const controlSources = buildTransitiveControlSourceInventory({ repository_root: repositoryRoot });
  const changedSources = controlSources.map((entry) => {
    const relativePath = entry.path;
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolutePath)) fail('GOVERNING_FILE_UNAVAILABLE', `Governing file is missing: ${relativePath}`);
    const currentBytes = fs.readFileSync(absolutePath);
    let baseBytes = null;
    try { baseBytes = childProcess.execFileSync('git', ['show', `${base}:${relativePath}`], { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) {}
    return Object.freeze({
      path: relativePath,
      current_sha256: sha256Hex(currentBytes),
      base_sha256: baseBytes === null ? null : sha256Hex(baseBytes),
      changed_from_phase1_base: baseBytes === null || !Buffer.from(baseBytes).equals(currentBytes),
    });
  }).filter((entry) => entry.changed_from_phase1_base);
  const changedStaticArtifacts = PHASE1_CONTROL_STATIC_ARTIFACTS.map((relativePath) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolutePath)) fail('GOVERNING_FILE_UNAVAILABLE', `Governing file is missing: ${relativePath}`);
    const currentBytes = fs.readFileSync(absolutePath);
    let baseBytes = null;
    try { baseBytes = childProcess.execFileSync('git', ['show', `${PHASE1_BASE_COMMIT}:${relativePath}`], { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) {}
    return Object.freeze({
      path: relativePath,
      current_sha256: sha256Hex(currentBytes),
      base_sha256: baseBytes === null ? null : sha256Hex(baseBytes),
      changed_from_phase1_base: baseBytes === null || !Buffer.from(baseBytes).equals(currentBytes),
    });
  }).filter((entry) => entry.changed_from_phase1_base);
  const changed = Object.freeze([...changedStaticArtifacts, ...changedSources].sort((left, right) => left.path.localeCompare(right.path)));
  if (changed.length === 0) fail('GOVERNING_WORKTREE_DIFF_EMPTY', 'The successor packet must bind changed Phase 1 controls.');
  return Object.freeze({
    phase1_worktree_base_commit: base,
    phase1_worktree_base_tree: baseTree,
    observed_worktree_head_commit: head,
    observed_worktree_tree: headTree,
    final_integrated_head_commit: null,
    final_integrated_tree: null,
    final_integrated_commit_state: 'UNAVAILABLE_REAL_INTEGRATED_COMMIT_REQUIRED',
    transitive_control_source_inventory: controlSources,
    changed_governing_files: Object.freeze(changed),
  });
}

// D3 (2026-08-05): this used to compile and validate the p9-acceptance-*
// proposal layer (definition authority, evidence inventory, definition
// proposal layer) -- three modules whose only "validation" was rebuilding
// their own hardcoded output and comparing it to itself. That layer is
// deleted; see docs/core/DECISIONS.md item 10. What is left here is
// real: the governing registry's own live-derived, evidence-verified
// closure status for the two gates whose work is actually finished
// (governing-registry.js's computePreproductionGateStatus, re-run on every
// load, never trusted from a stored assertion).
function currentP9Binding() {
  const registry = createGoverningRegistryAuthority();
  if (canonicalJson(registry.live_p9_gate_ids) !== canonicalJson(GOVERNING_REGISTRY_P9_GATE_IDS)) {
    fail('P9_GOVERNING_REGISTRY_BINDING_CONFLICT', 'The successor packet and the v2 governing registry disagree on live gate identifiers.');
  }
  const closedPreproductionGateIds = Object.freeze(
    registry.closeable_preproduction_gate_ids
      .filter((gateId) => registry.preproduction_gate_status[gateId].computed_state === 'PASS')
      .sort(),
  );
  return Object.freeze({
    registry_schema: registry.source_registry.schema,
    registry_digest: registry.digest,
    live_gate_count: registry.live_p9_gate_ids.length,
    security_prerequisite_gate_id: registry.security_prerequisite_gate_id,
    completion_gate_id: registry.completion_gate_id,
    completion_gate_live: registry.completion_gate_live,
    closeable_preproduction_gate_ids: registry.closeable_preproduction_gate_ids,
    closed_preproduction_gate_ids: closedPreproductionGateIds,
    acceptance_definition_and_predicate_state: 'UNADOPTED_NO_EXECUTABLE_PREDICATES',
  });
}

function currentFamilyBinding(decisionReconciliation) {
  validateM3FamilyParityRegister(CURRENT_M3_FAMILY_PARITY_REGISTER);
  const status = buildM3FamilyParityStatus(CURRENT_M3_FAMILY_PARITY_REGISTER);
  validateM3FamilyParityStatus(status);
  if (CURRENT_M3_FAMILY_PARITY_REGISTER.families.length !== 22) {
    fail('FAMILY_REGISTER_INCOMPLETE', 'The successor packet requires all 22 registered families.');
  }
  const conditional = bindDecisionConditionalFamilyStatus(status, decisionReconciliation);
  return Object.freeze({
    register_id: contentId('CANONICAL_V2_M3_FAMILY_PARITY_REGISTER/V3', CURRENT_M3_FAMILY_PARITY_REGISTER),
    family_count: CURRENT_M3_FAMILY_PARITY_REGISTER.families.length,
    raw_status_id: status.m3_family_parity_status_id,
    raw_status: status.state,
    decision_conditional_status_id: conditional.decision_conditional_family_status_id,
    decision_reconciliation_proposal_id: decisionReconciliation.decision_reconciliation_proposal_id,
    status: conditional.state,
  });
}

function currentPolicyBindings() {
  const operational = buildOperationalPolicySetProposal();
  const certification = buildCertificationPolicyManifestProposal();
  const adoptionBinding = buildCurrentPolicySuccessorM1AdoptionBinding();
  validateOperationalPolicySetProposal(operational);
  validateCertificationPolicyManifestProposal(certification);
  validatePolicySuccessorM1AdoptionBinding(adoptionBinding);
  return Object.freeze({
    operational_policy_set_proposal_id: operational.operational_policy_set_proposal_id,
    certification_policy_manifest_proposal_id: certification.certification_policy_manifest_proposal_id,
    policy_successor_m1_adoption_binding_id: adoptionBinding.policy_successor_m1_adoption_binding_id,
    policy_set_digest: adoptionBinding.policy_set_digest,
    policy_adoption_status: adoptionBinding.status,
    policy_adoption_authority: adoptionBinding.policy_adoption_authority,
    policy_successor_m1_adoption_binding: adoptionBinding,
    operational_blocker_codes: Object.freeze(operational.blockers.map((entry) => entry.code).sort()),
    certification_blocker_codes: Object.freeze(certification.blockers.map((entry) => entry.code).sort()),
  });
}

function currentV1TrustedCaptureBinding(repositoryRoot) {
  const descriptor = buildV1TrustedCaptureReadinessDescriptor({ repository_root: repositoryRoot });
  validateV1TrustedCaptureReadinessDescriptor(descriptor, { repository_root: repositoryRoot });
  const schemaCount = descriptor.source_modules.reduce((total, entry) => total + entry.schema_versions.length, 0);
  if (descriptor.status !== V1_TRUSTED_CAPTURE_READINESS_STATUS || descriptor.authority !== 'NONE'
    || schemaCount !== 18 || canonicalJson(descriptor.missing_requirements) !== canonicalJson(V1_TRUSTED_CAPTURE_MISSING_REQUIREMENTS)) {
    fail('V1_TRUSTED_CAPTURE_READINESS_INVALID', 'The V1 trusted capture descriptor must bind 18 proposal schemas and its exact blocked requirements.');
  }
  return Object.freeze({
    readiness_descriptor_id: descriptor.readiness_descriptor_id,
    status: descriptor.status,
    authority: descriptor.authority,
    schema_count: schemaCount,
    missing_requirement_codes: descriptor.missing_requirements,
    reconstructed_reference_id: descriptor.reconstructed_reference.reconstructed_reference_id,
    reconstructed_reference_commit: descriptor.reconstructed_reference.git_commit_id,
    reconstructed_reference_git_tree_id: descriptor.reconstructed_reference.git_tree_id,
    reconstructed_reference_truth_state: descriptor.reconstructed_reference.truth_state,
    source_modules: descriptor.source_modules,
  });
}

function currentGovernedIdentityBinding(repositoryRoot) {
  const descriptor = buildGovernedIdentityReadinessDescriptor({ repository_root: repositoryRoot });
  validateGovernedIdentityReadinessDescriptor(descriptor, { repository_root: repositoryRoot });
  if (descriptor.status !== GOVERNED_IDENTITY_READINESS_STATUS || descriptor.authority !== 'NONE'
    || descriptor.source_module.schema_versions.length !== 9
    || canonicalJson(descriptor.missing_requirements) !== canonicalJson(GOVERNED_IDENTITY_MISSING_REQUIREMENTS)) {
    fail('GOVERNED_IDENTITY_READINESS_INVALID', 'The governed identity descriptor must bind nine proposal schemas and its exact blocked requirements.');
  }
  return Object.freeze({
    readiness_descriptor_id: descriptor.readiness_descriptor_id,
    status: descriptor.status,
    authority: descriptor.authority,
    schema_count: descriptor.source_module.schema_versions.length,
    missing_requirement_codes: descriptor.missing_requirements,
    frozen_key_registry_amendment_id: descriptor.frozen_key_registry_amendment.amendment_proposal_id,
    frozen_key_registry_role_domain_grant_count: descriptor.frozen_key_registry_amendment.role_domain_grants.length,
    frozen_key_registry_authority: descriptor.frozen_key_registry_amendment.authority,
    frozen_key_registry_amendment_approval_state: descriptor.frozen_key_registry_amendment_approval_state,
    adopted_initial_import_identity_policy: descriptor.adopted_initial_import_identity_policy,
    source_module: descriptor.source_module,
  });
}

function currentSourceIntakeAuthorityBinding() {
  const readiness = buildSourceIntakeAuthorityReadiness();
  if (readiness.schema_version !== SOURCE_INTAKE_AUTHORITY_READINESS_SCHEMA
    || readiness.status !== 'BLOCKED_EXTERNAL_TRUSTED_VERIFIER_NOT_IMPLEMENTED'
    || readiness.authority !== 'NONE'
    || readiness.trusted_controller_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || readiness.trusted_registry_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || canonicalJson(readiness.blocker_codes) !== canonicalJson(SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS)) {
    fail('SOURCE_INTAKE_AUTHORITY_READINESS_INVALID', 'Source-intake policy adoption and disposition issuance must remain blocked behind unavailable external trusted verifiers.');
  }
  return readiness;
}

function fixedBlockers(policyBindings, v1TrustedCapture, governedIdentity, sourceIntakeAuthority, sourceExceptionApproval, decisionReconciliation) {
  const entries = [
    ...v1TrustedCapture.missing_requirement_codes.map((code) => [code, `V1 trusted-capture descriptor is ${v1TrustedCapture.status}: ${code}.`]),
    ...governedIdentity.missing_requirement_codes.map((code) => [code, `Governed identity descriptor is ${governedIdentity.status}: ${code}.`]),
    ['P9_ACCEPTANCE_DEFINITIONS_UNADOPTED', 'The corrected P9 evidence map remains proposal-only. Acceptance definitions and executable predicates are unadopted and cannot issue PASS.'],
    ['EXACT_POLICY_MANIFEST_DIGEST_ADOPTION_REQUIRED', 'The production-policy direction is adopted, but the exact policy-manifest digest is not adopted.'],
    ['SUCCESSOR_M1_APPROVAL_REQUIRED', 'The production-policy direction does not approve the successor M1 bundle.'],
    ...(!decisionReconciliation.ruling_evidence_freeze_ready
      ? [['RULING_EVIDENCE_RECONCILIATION_REQUIRED', `Ruling evidence is incomplete: missing rulings ${decisionReconciliation.missing_ruling_ids.join(', ') || 'none'}; authority remains ${decisionReconciliation.decision_register_freeze_authority}.`]]
      : []),
    ...(!decisionReconciliation.implementation_reconciliation_ready
      ? [['RECORDED_RULING_IMPLEMENTATION_GAPS', `Recorded rulings still have implementation gaps: ${decisionReconciliation.implementation_gap_ruling_ids.join(', ') || 'none'}.`]]
      : []),
    ['IDENTITY_CONSUMERS_REAL_VERIFIER_REQUIRED', 'Identity consumers remain blocked until a real verifier validates the governed identity bridge.'],
    ['SOURCE_ADMISSION_AND_SCOPE_FREEZE_REQUIRED', 'No source-admission authority or certified corpus-scope freeze has been issued.'],
    ...sourceIntakeAuthority.blocker_codes.map((code) => [code, `Source-intake authority remains ${sourceIntakeAuthority.status} with authority ${sourceIntakeAuthority.authority}: ${code}.`]),
    ['SOURCE_EXCEPTION_TRUSTED_CONTROLLER_AND_REGISTRY_AMENDMENT_REQUIRED', `Source exceptions remain non-authoritative: ${sourceExceptionApproval.controller_blocker}.`],
    ['FINAL_INTEGRATED_COMMIT_BUILD_RECEIPT_REQUIRED', 'No final integrated commit and build receipt binds this successor packet.'],
    ['V1_SNAPSHOT_CLOSED_ALLOCATION_EVIDENCE_REQUIRED', 'V1 snapshot capture must bind independently validated V2 identity allocation evidence.'],
    ['EXTERNAL_ISSUER_REGISTRY_TRUST_ANCHOR_REQUIRED', 'External issuer identities require a pinned approved registry trust anchor.'],
    ...policyBindings.operational_blocker_codes.map((code) => [code, 'Operational policy proposal remains unadopted.']),
    ...policyBindings.certification_blocker_codes.map((code) => [code, 'Certification policy proposal remains unadopted.']),
  ];
  return Object.freeze([...new Map(entries).entries()].map(([code, message]) => Object.freeze({ code, message }))
    .sort((left, right) => left.code.localeCompare(right.code)));
}

function buildCurrentSuccessorM1ReadinessPacket({ repository_root: repositoryRoot = REPOSITORY_ROOT } = {}) {
  const root = requireNonTemporaryRepositoryRoot(repositoryRoot);
  const worktree = currentWorktreeBinding(root);
  const decisionReconciliationProposal = compileDecisionReconciliationProposal();
  validateDecisionReconciliationProposal(decisionReconciliationProposal);
  const decisionReconciliation = decisionReconciliationBinding(decisionReconciliationProposal);
  const family = currentFamilyBinding(decisionReconciliationProposal);
  const p9 = currentP9Binding();
  const policies = currentPolicyBindings();
  const v1TrustedCapture = currentV1TrustedCaptureBinding(root);
  const governedIdentity = currentGovernedIdentityBinding(root);
  const sourceIntakeAuthority = currentSourceIntakeAuthorityBinding();
  const sourceExceptionApproval = buildSourceExceptionApprovalReadiness();
  const blockers = fixedBlockers(policies, v1TrustedCapture, governedIdentity, sourceIntakeAuthority, sourceExceptionApproval, decisionReconciliation);
  const body = {
    schema_version: SUCCESSOR_M1_READINESS_PACKET_SCHEMA,
    status: 'PROPOSAL_ONLY_BLOCKED_NOT_M1_AUTHORITY',
    worktree_binding: worktree,
    decision_reconciliation: decisionReconciliation,
    family_register: family,
    dissent_retirement: Object.freeze({
      ruling_id: 'closing-dissent-threshold-retirement',
      recorded_choice: APPROVED_RETIRED_OPEN_WORLD,
      decision_reconciliation_proposal_id: decisionReconciliation.proposal_id,
      source_pack_schema: SOURCE_PACK_SCHEMA,
      disposition: APPROVED_RETIRED_OPEN_WORLD,
      reintroduction_requirement: STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL,
      authority: 'M3_PRODUCT_PARITY_ONLY_NOT_M1_AUTHORITY',
    }),
    p9_binding: p9,
    v2_identity_binding: Object.freeze({
      identity_manifest_schema: DEAL_IDENTITY_MANIFEST_SCHEMA,
      initial_import_packet_schema: INITIAL_IMPORT_PACKET_SCHEMA,
      batch_mapping_approval_signature_domain: BEN_MAPPING_APPROVAL_SIGNATURE_DOMAIN,
      trusted_key_domain_extension_schema: TRUSTED_KEY_DOMAIN_EXTENSION_SCHEMA,
      literal_trusted_key_registry_patch_schema: LITERAL_TRUSTED_KEY_REGISTRY_PATCH_SCHEMA,
      adopted_namespace: governedIdentity.adopted_initial_import_identity_policy.governed_source_namespace,
      adopted_seed_schema: governedIdentity.adopted_initial_import_identity_policy.seed_schema_version,
      adopted_transaction_count: governedIdentity.adopted_initial_import_identity_policy.transaction_count,
      adopted_ben_mapping_signature_policy: governedIdentity.adopted_initial_import_identity_policy.ben_mapping_signature_policy,
      key_registry_amendment_approval_state: governedIdentity.frozen_key_registry_amendment_approval_state,
      authority_status: 'POLICY_RATIFIED_KEY_AMENDMENT_AND_REAL_VERIFIER_PENDING_NOT_ACTIVE',
    }),
    v1_trusted_capture_readiness: v1TrustedCapture,
    governed_identity_readiness: governedIdentity,
    source_intake_authority_readiness: sourceIntakeAuthority,
    source_exception_approval_readiness: sourceExceptionApproval,
    policy_proposals: policies,
    test_status: Object.freeze({
      status: 'INCOMPLETE_FINAL_INTEGRATED_RECEIPT_REQUIRED',
      final_integrated_commit: null,
      final_build_receipt_id: null,
      authority: 'NONE',
    }),
    blockers,
    bundle_compilation_authority: 'NONE',
    bundle_freeze_authority: 'NONE',
    signing_authority: 'NONE',
    approval_authority: 'NONE',
    m1_authority: 'NONE',
  };
  return Object.freeze({ ...body, successor_m1_readiness_packet_id: contentId(SUCCESSOR_M1_READINESS_PACKET_SCHEMA, body) });
}

function validateCurrentSuccessorM1ReadinessPacket(packet, { repository_root: repositoryRoot = REPOSITORY_ROOT } = {}) {
  const keys = [
    'approval_authority', 'blockers', 'bundle_compilation_authority', 'bundle_freeze_authority',
    'decision_reconciliation', 'dissent_retirement', 'family_register', 'm1_authority', 'p9_binding', 'policy_proposals',
    'schema_version', 'signing_authority', 'status', 'successor_m1_readiness_packet_id', 'test_status',
    'governed_identity_readiness', 'source_intake_authority_readiness', 'source_exception_approval_readiness',
    'v1_trusted_capture_readiness', 'v2_identity_binding', 'worktree_binding',
  ];
  if (!exactKeys(packet, keys) || packet.schema_version !== SUCCESSOR_M1_READINESS_PACKET_SCHEMA
    || packet.status !== 'PROPOSAL_ONLY_BLOCKED_NOT_M1_AUTHORITY'
    || ['bundle_compilation_authority', 'bundle_freeze_authority', 'signing_authority', 'approval_authority', 'm1_authority']
      .some((key) => packet[key] !== 'NONE')) {
    fail('SUCCESSOR_M1_READINESS_PACKET_INVALID', 'The successor M1 packet must remain a closed non-authority proposal.');
  }
  const expected = buildCurrentSuccessorM1ReadinessPacket({ repository_root: repositoryRoot });
  if (canonicalJson(packet) !== canonicalJson(expected)) {
    fail('SUCCESSOR_M1_READINESS_PACKET_STALE', 'The successor M1 packet is stale or does not bind the current Phase 1 state.');
  }
  if (packet.v1_trusted_capture_readiness.status !== V1_TRUSTED_CAPTURE_READINESS_STATUS
    || packet.v1_trusted_capture_readiness.authority !== 'NONE'
    || packet.v1_trusted_capture_readiness.schema_count !== 18
    || canonicalJson(packet.v1_trusted_capture_readiness.missing_requirement_codes) !== canonicalJson(V1_TRUSTED_CAPTURE_MISSING_REQUIREMENTS)) {
    fail('SUCCESSOR_M1_V1_TRUSTED_CAPTURE_BINDING_INVALID', 'The successor M1 packet must retain the exact blocked V1 trusted capture descriptor state.');
  }
  if (packet.governed_identity_readiness.status !== GOVERNED_IDENTITY_READINESS_STATUS
    || packet.governed_identity_readiness.authority !== 'NONE'
    || packet.governed_identity_readiness.schema_count !== 9
    || packet.governed_identity_readiness.frozen_key_registry_authority !== 'NONE'
    || packet.governed_identity_readiness.frozen_key_registry_role_domain_grant_count !== 6
    || canonicalJson(packet.governed_identity_readiness.missing_requirement_codes) !== canonicalJson(GOVERNED_IDENTITY_MISSING_REQUIREMENTS)) {
    fail('SUCCESSOR_M1_GOVERNED_IDENTITY_BINDING_INVALID', 'The successor M1 packet must retain the exact blocked governed identity descriptor state.');
  }
  if (packet.source_exception_approval_readiness.authority !== 'NONE'
    || packet.source_exception_approval_readiness.proposal_schema !== SOURCE_EXCEPTION_APPROVAL_PROPOSAL_SCHEMA
    || packet.source_exception_approval_readiness.controller_blocker !== SOURCE_EXCEPTION_CONTROLLER_BLOCKER) {
    fail('SUCCESSOR_M1_SOURCE_EXCEPTION_BINDING_INVALID', 'The successor M1 packet must retain the blocked source exception contract binding.');
  }
  if (packet.source_intake_authority_readiness.schema_version !== SOURCE_INTAKE_AUTHORITY_READINESS_SCHEMA
    || packet.source_intake_authority_readiness.authority !== 'NONE'
    || packet.source_intake_authority_readiness.status !== 'BLOCKED_EXTERNAL_TRUSTED_VERIFIER_NOT_IMPLEMENTED'
    || packet.source_intake_authority_readiness.trusted_controller_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || packet.source_intake_authority_readiness.trusted_registry_verifier !== 'UNAVAILABLE_IN_PHASE1'
    || canonicalJson(packet.source_intake_authority_readiness.blocker_codes) !== canonicalJson(SOURCE_INTAKE_TRUSTED_AUTHORITY_REQUIRED_BLOCKERS)) {
    fail('SUCCESSOR_M1_SOURCE_INTAKE_AUTHORITY_BINDING_INVALID', 'The successor M1 packet must retain the blocked source-intake trusted-verifier state.');
  }
  if (packet.decision_reconciliation.authority !== 'NONE'
    || packet.decision_reconciliation.decision_register_freeze_authority !== 'NONE'
    || packet.decision_reconciliation.ruling_evidence_freeze_ready !== true
    || packet.decision_reconciliation.implementation_reconciliation_ready !== false
    || packet.decision_reconciliation.decision_register_freeze_ready !== false
    || packet.decision_reconciliation.family_completion_ready !== false
    || packet.family_register.status !== 'BLOCKED') {
    fail('SUCCESSOR_M1_DECISION_RECONCILIATION_INVALID', 'Successor M1 and family completion must remain blocked by the proposal-only decision reconciliation gate.');
  }
  try {
    validatePolicySuccessorM1AdoptionBinding(packet.policy_proposals.policy_successor_m1_adoption_binding);
  } catch (error) {
    fail('SUCCESSOR_M1_POLICY_ADOPTION_BINDING_INVALID', error.message);
  }
  if (packet.policy_proposals.policy_adoption_status !== 'PROPOSAL_ONLY_BLOCKED_NOT_ADOPTED'
    || packet.policy_proposals.policy_adoption_authority !== 'NONE') {
    fail('SUCCESSOR_M1_POLICY_ADOPTION_STATE_INVALID', 'Policy adoption must remain blocked until an external successor M1 PASS is verified.');
  }
  for (const code of REQUIRED_BLOCKER_CODES) {
    if (!packet.blockers.some((entry) => entry.code === code)) {
      fail('SUCCESSOR_M1_REQUIRED_BLOCKER_MISSING', `The successor M1 packet is missing ${code}.`);
    }
  }
  return expected;
}

module.exports = {
  GOVERNING_FILE_PATHS,
  PHASE1_BASE_COMMIT,
  PHASE1_CONTROL_SOURCE_ROOTS,
  PHASE1_CONTROL_STATIC_ARTIFACTS,
  REQUIRED_BLOCKER_CODES,
  REPOSITORY_ROOT,
  SUCCESSOR_M1_READINESS_PACKET_SCHEMA,
  SuccessorM1ReadinessPacketError,
  buildTransitiveControlSourceInventory,
  buildCurrentSuccessorM1ReadinessPacket,
  requireNonTemporaryRepositoryRoot,
  validateCurrentSuccessorM1ReadinessPacket,
};
