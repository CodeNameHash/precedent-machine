'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { RECORDED_RULINGS } = require('../lib/programme-decision-console');

const {
  GOVERNING_FILE_PATHS,
  PHASE1_BASE_COMMIT,
  PHASE1_CONTROL_SOURCE_ROOTS,
  REQUIRED_BLOCKER_CODES,
  SUCCESSOR_M1_READINESS_PACKET_SCHEMA,
  buildCurrentSuccessorM1ReadinessPacket,
  buildTransitiveControlSourceInventory,
  validateCurrentSuccessorM1ReadinessPacket,
} = require('../lib/canonical-v2/successor-m1-readiness-packet');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_CURRENT_BLOCKER_CODES = Object.freeze([
  'APPROVED_READ_ONLY_DATABASE_AUTHORITY',
  'CERTIFICATION_METHODS_UNRESOLVED',
  'COMPLETE_40_BY_19_RENDER_SURFACE_CAPTURE',
  'CONTROLLED_CAPTURE_WORKER_EXECUTION',
  'DURABLE_ARTIFACT_ROOT_REQUIRED',
  'EXACT_POLICY_MANIFEST_DIGEST_ADOPTION_REQUIRED',
  'EXTERNAL_CONTROLLER_AND_WORKER_REGISTRATIONS',
  'EXTERNAL_ISSUER_REGISTRY_TRUST_ANCHOR_REQUIRED',
  'FINAL_INTEGRATED_COMMIT_BUILD_RECEIPT_REQUIRED',
  'FINAL_SIGNATURE_VERIFICATION',
  'HIGH_RISK_FAMILY_UNIVERSE_UNRESOLVED',
  'IDENTITY_ALLOCATION_AND_BRIDGE_CONTROLLER_REQUIRED',
  'IDENTITY_BEN_BATCH_MAPPING_SIGNATURE_REQUIRED',
  'IDENTITY_CONSUMERS_REAL_VERIFIER_REQUIRED',
  'IDENTITY_CURRENT_HEAD_VERIFIER_REQUIRED',
  'IDENTITY_EXPLICIT_40_DEAL_41_OCCURRENCE_MAPPING_REVIEW_REQUIRED',
  'IDENTITY_KEY_REGISTRY_AMENDMENT_REQUIRED',
  'IDENTITY_REAL_SERIALISABLE_PERSISTENCE_REQUIRED',
  'IDENTITY_SIGNATURE_VERIFIER_REQUIRED',
  'OPERATIONAL_POLICY_MANIFEST_SET_UNRESOLVED',
  'OPERATIONAL_POLICY_SET_UNRESOLVED',
  'P9_ACCEPTANCE_DEFINITIONS_UNADOPTED',
  'PASS_ISSUANCE_CONTROLLER',
  'PASS_THRESHOLDS_UNRESOLVED',
  'RECORDED_RULING_IMPLEMENTATION_GAPS',
  'RECOVERY_COUNTER_INVENTORY_UNRESOLVED',
  'REGISTRY_DISPOSITION_ENUM_UNRESOLVED',
  'RESTORE_OR_ROLLBACK_CRITERIA_UNRESOLVED',
  'ROUTINE_PRIMARY_POLICY_NOT_ADOPTED',
  'SEMANTIC_DIFF_CLASSIFICATIONS_UNRESOLVED',
  'SOAK_TEST_FORMULA_UNRESOLVED',
  'SOURCE_ADMISSION_AND_SCOPE_FREEZE_REQUIRED',
  'SOURCE_EXCEPTION_TRUSTED_CONTROLLER_AND_REGISTRY_AMENDMENT_REQUIRED',
  'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED',
  'SUCCESSOR_M1_ADOPTION_BINDING_UNRESOLVED',
  'SUCCESSOR_M1_APPROVAL_REQUIRED',
  'SUCCESSOR_M1_CERTIFICATION_BINDING_UNRESOLVED',
  'TOPBUILD_MULTI_OCCURRENCE_DISPOSITION_NOT_ISSUED',
  'TRUST_REGISTRY_AMENDMENT_FOR_CONTROLLER_AND_WORKER_SIGNATURES',
  'TWO_INDEPENDENT_REPLAY_EXECUTIONS',
  'V1_SNAPSHOT_CLOSED_ALLOCATION_EVIDENCE_REQUIRED',
]);

test('builds a content-addressed current proposal-only M1 successor packet with all required blockers', () => {
  const packet = buildCurrentSuccessorM1ReadinessPacket({ repository_root: ROOT });
  assert.equal(packet.schema_version, SUCCESSOR_M1_READINESS_PACKET_SCHEMA);
  assert.equal(packet.status, 'PROPOSAL_ONLY_BLOCKED_NOT_M1_AUTHORITY');
  assert.equal(packet.family_register.family_count, 22);
  assert.equal(packet.family_register.raw_status, 'BLOCKED');
  assert.equal(packet.family_register.status, 'BLOCKED');
  assert.equal(packet.family_register.decision_reconciliation_proposal_id, packet.decision_reconciliation.proposal_id);
  assert.equal(packet.decision_reconciliation.status, 'PROPOSAL_ONLY_BLOCKED_NOT_DECISION_REGISTER_AUTHORITY');
  assert.equal(packet.decision_reconciliation.authority, 'NONE');
  assert.equal(packet.decision_reconciliation.recorded_ruling_count, Object.keys(RECORDED_RULINGS).length);
  assert.deepEqual(packet.decision_reconciliation.missing_ruling_ids, []);
  assert.deepEqual(packet.decision_reconciliation.conflicting_ruling_ids, []);
  assert.deepEqual(packet.decision_reconciliation.missing_binding_ruling_ids, []);
  assert.ok(packet.decision_reconciliation.implementation_gap_ruling_ids.includes('topbuild-mae'));
  assert.ok(packet.decision_reconciliation.implementation_gap_ruling_ids.includes('db-apply'));
  assert.equal(packet.decision_reconciliation.ruling_evidence_freeze_ready, true);
  assert.equal(packet.decision_reconciliation.implementation_reconciliation_ready, false);
  assert.equal(packet.decision_reconciliation.decision_register_freeze_ready, false);
  assert.equal(packet.decision_reconciliation.decision_register_freeze_authority, 'NONE');
  assert.equal(packet.decision_reconciliation.family_completion_ready, false);
  assert.equal(packet.policy_proposals.policy_adoption_status, 'PROPOSAL_ONLY_BLOCKED_NOT_ADOPTED');
  assert.equal(packet.policy_proposals.policy_adoption_authority, 'NONE');
  assert.equal(packet.policy_proposals.policy_successor_m1_adoption_binding.adopted, false);
  assert.equal(packet.policy_proposals.policy_successor_m1_adoption_binding.successor_m1_pass_receipt_id, null);
  assert.match(packet.policy_proposals.policy_set_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(packet.family_register.status, 'BLOCKED');
  assert.deepEqual(packet.blockers.map(({ code }) => code), EXPECTED_CURRENT_BLOCKER_CODES);
  assert.equal(packet.dissent_retirement.disposition, 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(packet.dissent_retirement.ruling_id, 'closing-dissent-threshold-retirement');
  assert.equal(packet.dissent_retirement.recorded_choice, 'APPROVED_RETIRED_OPEN_WORLD');
  assert.equal(
    packet.dissent_retirement.decision_reconciliation_proposal_id,
    packet.decision_reconciliation.proposal_id,
  );
  assert.equal(packet.dissent_retirement.authority, 'M3_PRODUCT_PARITY_ONLY_NOT_M1_AUTHORITY');
  assert.equal(packet.p9_binding.live_gate_count, 23);
  assert.equal(packet.p9_binding.complete_gate_count, 23);
  assert.equal(packet.p9_binding.governing_inventory_decision.code, 'P9_COMPLETION_LEAF_RATIFIED');
  assert.equal(packet.p9_binding.registry_schema, 'canonical-programme-gates/v2');
  assert.equal(packet.p9_binding.registry_live_gate_count, 23);
  assert.equal(packet.p9_binding.security_prerequisite_gate_id, 'P9_SECURITY_AUTH');
  assert.equal(packet.p9_binding.completion_gate_id, 'P9_PROGRAMME_COMPLETION_ATTESTATION');
  assert.equal(packet.p9_binding.completion_gate_live, true);
  assert.equal(packet.p9_binding.evidence_map_state, 'CORRECTED_CURRENT_CATALOGUE_REFERENCES_PROPOSAL_ONLY');
  assert.deepEqual(packet.p9_binding.database_soak_scenario_ids, ['CAPACITY-LOAD-01', 'QUERY-EXEC-01']);
  assert.equal(packet.p9_binding.acceptance_definition_and_predicate_state, 'UNADOPTED_NO_EXECUTABLE_PREDICATES');
  assert.equal(packet.p9_binding.definition_live_record_count, 23);
  assert.equal(packet.p9_binding.definition_completion_terminal_count, 1);
  assert.equal(packet.p9_binding.definition_formal_definition_authority, 'NONE');
  assert.equal(packet.p9_binding.definition_predicate_authority, 'NONE');
  assert.equal(packet.p9_binding.definition_pass_authority, 'NONE');
  assert.ok(packet.p9_binding.definition_threshold_blocker_gate_ids.includes('P9_DATABASE_SOAK'));
  assert.equal(packet.v2_identity_binding.adopted_namespace, 'BEN_APPROVED_IMPORT/V2');
  assert.equal(packet.v2_identity_binding.adopted_seed_schema, 'BEN_APPROVED_IMPORT_SEED/V2');
  assert.equal(packet.v2_identity_binding.adopted_transaction_count, 40);
  assert.equal(packet.v2_identity_binding.batch_mapping_approval_signature_domain, 'GOVERNED_IDENTITY_BEN_BATCH_MAPPING_APPROVAL/V1');
  assert.equal(packet.v2_identity_binding.literal_trusted_key_registry_patch_schema, 'GOVERNED_IDENTITY_LITERAL_TRUSTED_KEY_REGISTRY_PATCH_PROPOSAL/V1');
  assert.equal(packet.v2_identity_binding.key_registry_amendment_approval_state, 'PENDING_EXACT_DIFF_APPROVAL_NOT_ACTIVE');
  assert.equal(packet.v2_identity_binding.authority_status, 'POLICY_RATIFIED_KEY_AMENDMENT_AND_REAL_VERIFIER_PENDING_NOT_ACTIVE');
  assert.equal(packet.v1_trusted_capture_readiness.status, 'BLOCKED_NOT_EXECUTABLE');
  assert.equal(packet.v1_trusted_capture_readiness.authority, 'NONE');
  assert.equal(packet.v1_trusted_capture_readiness.schema_count, 18);
  assert.equal(packet.v1_trusted_capture_readiness.reconstructed_reference_commit, '484c40a9515366d8efbfdcc72b71aaaa3aafe6e0');
  assert.match(packet.v1_trusted_capture_readiness.reconstructed_reference_git_tree_id, /^[a-f0-9]{40}$/);
  assert.equal(packet.v1_trusted_capture_readiness.reconstructed_reference_truth_state, 'RECONSTRUCTED_REFERENCE_NOT_LIVE_PRODUCTION_TRUTH');
  assert.equal(packet.v1_trusted_capture_readiness.missing_requirement_codes.length, 8);
  assert.equal(packet.governed_identity_readiness.status, 'BLOCKED_NOT_EXECUTABLE');
  assert.equal(packet.governed_identity_readiness.authority, 'NONE');
  assert.equal(packet.governed_identity_readiness.schema_count, 9);
  assert.equal(packet.governed_identity_readiness.frozen_key_registry_authority, 'NONE');
  assert.equal(packet.governed_identity_readiness.frozen_key_registry_role_domain_grant_count, 6);
  assert.equal(packet.governed_identity_readiness.frozen_key_registry_amendment_approval_state, 'PENDING_EXACT_DIFF_APPROVAL_NOT_ACTIVE');
  assert.equal(packet.governed_identity_readiness.adopted_initial_import_identity_policy.transaction_identifiers.length, 40);
  assert.equal(packet.governed_identity_readiness.missing_requirement_codes.length, 7);
  assert.equal(packet.source_intake_authority_readiness.status, 'BLOCKED_EXTERNAL_TRUSTED_VERIFIER_NOT_IMPLEMENTED');
  assert.equal(packet.source_intake_authority_readiness.authority, 'NONE');
  assert.equal(packet.source_intake_authority_readiness.trusted_controller_verifier, 'UNAVAILABLE_IN_PHASE1');
  assert.equal(packet.source_intake_authority_readiness.trusted_registry_verifier, 'UNAVAILABLE_IN_PHASE1');
  assert.deepEqual(packet.source_intake_authority_readiness.blocker_codes, [
    'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED',
    'ROUTINE_PRIMARY_POLICY_NOT_ADOPTED',
    'TOPBUILD_MULTI_OCCURRENCE_DISPOSITION_NOT_ISSUED',
  ]);
  assert.equal(packet.test_status.status, 'INCOMPLETE_FINAL_INTEGRATED_RECEIPT_REQUIRED');
  assert.equal(packet.worktree_binding.phase1_worktree_base_commit, PHASE1_BASE_COMMIT);
  assert.match(packet.worktree_binding.phase1_worktree_base_tree, /^[a-f0-9]{40}$/);
  assert.match(packet.worktree_binding.observed_worktree_head_commit, /^[a-f0-9]{40}$/);
  assert.match(packet.worktree_binding.observed_worktree_tree, /^[a-f0-9]{40}$/);
  assert.equal(packet.worktree_binding.final_integrated_head_commit, null);
  assert.equal(packet.worktree_binding.final_integrated_tree, null);
  assert.equal(packet.worktree_binding.final_integrated_commit_state, 'UNAVAILABLE_REAL_INTEGRATED_COMMIT_REQUIRED');
  assert.ok(packet.worktree_binding.transitive_control_source_inventory.length > PHASE1_CONTROL_SOURCE_ROOTS.length);
  for (const controlPath of PHASE1_CONTROL_SOURCE_ROOTS) {
    assert.ok(packet.worktree_binding.transitive_control_source_inventory.some((entry) => entry.path === controlPath), controlPath);
  }
  assert.ok(packet.worktree_binding.changed_governing_files.length > 0);
  for (const file of packet.worktree_binding.changed_governing_files) {
    assert.ok(GOVERNING_FILE_PATHS.includes(file.path)
      || packet.worktree_binding.transitive_control_source_inventory.some((entry) => entry.path === file.path));
    assert.match(file.current_sha256, /^[a-f0-9]{64}$/);
    assert.equal(file.changed_from_phase1_base, true);
  }
  for (const code of REQUIRED_BLOCKER_CODES) assert.ok(packet.blockers.some((entry) => entry.code === code), code);
  assert.equal(packet.blockers.some((entry) => entry.code === 'TRUSTED_V1_CAPTURE_AND_REPLAY_EXECUTOR_NOT_IMPLEMENTED'), false);
  assert.equal(packet.bundle_compilation_authority, 'NONE');
  assert.equal(packet.bundle_freeze_authority, 'NONE');
  assert.equal(packet.signing_authority, 'NONE');
  assert.equal(packet.approval_authority, 'NONE');
  assert.equal(packet.m1_authority, 'NONE');
  assert.deepEqual(validateCurrentSuccessorM1ReadinessPacket(packet, { repository_root: ROOT }), packet);
});

test('fails closed on a changed governing digest, authority field, family count, or omitted blocker', () => {
  const packet = buildCurrentSuccessorM1ReadinessPacket({ repository_root: ROOT });
  for (const mutate of [
    (value) => { value.worktree_binding.changed_governing_files[0].current_sha256 = '0'.repeat(64); },
    (value) => { value.m1_authority = 'GRANTED'; },
    (value) => { value.family_register.family_count = 20; },
    (value) => { value.decision_reconciliation.authority = 'GRANTED'; },
    (value) => { value.v1_trusted_capture_readiness.schema_count = 16; },
    (value) => { value.governed_identity_readiness.schema_count = 8; },
    (value) => { value.source_intake_authority_readiness.authority = 'GRANTED'; },
    (value) => { value.p9_binding.definition_proposal_layer_id = '0'.repeat(64); },
    (value) => { value.worktree_binding.phase1_worktree_base_commit = '0'.repeat(40); },
    (value) => { value.worktree_binding.final_integrated_head_commit = '0'.repeat(40); },
    (value) => { value.blockers = value.blockers.filter((entry) => entry.code !== 'P9_ACCEPTANCE_DEFINITIONS_UNADOPTED'); },
    (value) => { value.blockers = value.blockers.filter((entry) => entry.code !== 'SOURCE_INTAKE_TRUSTED_CONTROLLER_AND_REGISTRY_VERIFIER_REQUIRED'); },
  ]) {
    const changed = structuredClone(packet);
    mutate(changed);
    assert.throws(() => validateCurrentSuccessorM1ReadinessPacket(changed, { repository_root: ROOT }));
  }
});

test('transitive control inventory detects mutations to Phase 1 sources that were previously omitted', () => {
  const previouslyOmittedPaths = [
    'lib/canonical-v2/corpus-source-discovery-capture.js',
    'lib/canonical-v2/dark-integration-preflight.js',
    'lib/canonical-v2/deal-identity-persistence-controller-interface.js',
    'lib/canonical-v2/identity-consumer-closure-audit.js',
    'lib/canonical-v2/phase1-authority-boundary-inventory.js',
    'lib/canonical-v2/source-universe-inventory-planner.js',
    'lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js',
    'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
    'lib/canonical-v2/native-producer/v1v2-comparator.js',
    'lib/canonical-v2/v1-output-routing-reconciliation-audit.js',
    'scripts/canonical-v2-corpus-source-discovery-capture.js',
    'scripts/export-v1-provision-snapshot.mjs',
    'tests/canonical-v2-phase1-authority-boundary.test.js',
  ];
  const current = buildTransitiveControlSourceInventory({ repository_root: ROOT });
  for (const relativePath of previouslyOmittedPaths) {
    const absolutePath = path.join(ROOT, relativePath);
    const original = fs.readFileSync(absolutePath);
    const mutated = buildTransitiveControlSourceInventory({
      repository_root: ROOT,
      readFileSync: (candidate) => path.resolve(candidate) === absolutePath
        ? Buffer.concat([original, Buffer.from('\n// freshness mutation\n')])
        : fs.readFileSync(candidate),
    });
    const before = current.find((entry) => entry.path === relativePath);
    const after = mutated.find((entry) => entry.path === relativePath);
    assert.ok(before, `Current inventory must include ${relativePath}`);
    assert.ok(after, `Mutated inventory must include ${relativePath}`);
    assert.notEqual(after.current_sha256, before.current_sha256, `${relativePath} mutation must invalidate the inventory`);
  }
});

test('has no bundle compiler, durable writer, network, database, signing, or approval execution path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/successor-m1-readiness-packet.js'), 'utf8');
  assert.doesNotMatch(source, /writeFile|mkdir|createCodexCliProvider|executeUnifiedRun|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|verifySignature|activate_candidate_release/i);
});

test('successor packet rejects temporary repository roots before any Git binding', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'successor-m1-readiness-'));
  try {
    assert.throws(() => buildCurrentSuccessorM1ReadinessPacket({ repository_root: temporaryRoot }), (error) => error.code === 'WORKTREE_TEMPORARY_ROOT_FORBIDDEN');
  } finally { fs.rmSync(temporaryRoot, { recursive: true, force: true }); }
});
