'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  validateApprovedFamilyRoleSchema,
} = require('../lib/canonical-v2/family-role-schema-authority');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_ROOT = 'evidence/canonical-v2/stage-2y-structure-migration';
const POLICY_RELATIVE = `${MIGRATION_ROOT}/control/m5-calibration-policy.json`;
const AUTHORITY_RELATIVE = `${MIGRATION_ROOT}/control/m5-preparation-authority.json`;
const REVIEW_RELATIVE = `${MIGRATION_ROOT}/reviews/stage-2y-structure-m5-preparation-sol-freeze.json`;
const POLICY_SHA256 = '102534446774dfa0661ad186d27c25507befedca80807e42cf584fa412e6bf78';
const AUTHORITY_SHA256 = 'd10f095429cdbb1006bfbe1e789c267ffa3a98b12b4bd33c2afb550e7beeea79';
const REVIEW_SHA256 = '0df3384046347bc0f80bb7a7e36b44928ba67f0b9134632b6e6f9e2923549b8f';
const POLICY_DIGEST = '29235e0a0fac4b5a3096f11f84c0c05e681a031191ef9588fe2745f3b3572a91';
const AUTHORITY_DIGEST = '81410800c956e8f4dfa6ff20b23fdf9a8f8b1340f0dbaa664c3ca9b8d54f6942';
const REVIEW_ID = '66c84855ae665b4297e49b9a860687248ebb0a69a70e7c779e4ca23c20504013';
const HEX_256 = /^[0-9a-f]{64}$/;

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readBytes(relativePath) {
  return fs.readFileSync(absolute(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(readBytes(relativePath).toString('utf8'));
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

function assertBinding(binding, label) {
  assertExactKeys(binding, ['path', 'byte_length', 'sha256'], `${label} members`);
  const bytes = readBytes(binding.path);
  assert.equal(bytes.length, binding.byte_length, `${label} byte length`);
  assert.equal(sha256Hex(bytes), binding.sha256, `${label} sha256`);
  return JSON.parse(bytes.toString('utf8'));
}

function assertExtendedBinding(binding, label) {
  const bytes = readBytes(binding.path);
  assert.equal(bytes.length, binding.byte_length, `${label} byte length`);
  assert.equal(sha256Hex(bytes), binding.sha256, `${label} sha256`);
  return JSON.parse(bytes.toString('utf8'));
}

function unsigned(value, ...identityMembers) {
  const copy = structuredClone(value);
  identityMembers.forEach((member) => delete copy[member]);
  return copy;
}

function assertContentRecord(record, digestMember, idMember) {
  const payload = unsigned(record, digestMember, idMember);
  const digest = sha256Hex(canonicalJson(payload));
  assert.equal(record[digestMember], digest, digestMember);
  assert.equal(
    record[idMember],
    contentId(record.schema_version, { ...payload, [digestMember]: digest }),
    idMember,
  );
}

function familyOutputPaths(policy) {
  return policy.family_order_contract.families.flatMap((family) => [
    family.calibration_pack_path,
    family.proposed_role_schema_path,
  ]);
}

function role(roleKey, requiredForComplete = true) {
  return {
    role_key: roleKey,
    value_type: 'SOURCE_BACKED_TEXT',
    cardinality: 'EXACTLY_ONE',
    required_for_complete: requiredForComplete,
    allowed_sources: ['M2_SOURCE_NODE'],
    provenance_requirements: [
      'agreement_id',
      'source_node_occurrence_id',
      'source_span',
      'source_text_sha256',
      'source_role',
    ],
    definition_or_reference_edge_requirement: null,
    scope_requirement: 'EXACT_AUTHORED_SCOPE',
    missing_disposition: 'MISSING_REQUIRED_ROLE',
    renderability_on_missing: 'NON_RENDERABLE_MISSING_REQUIRED_ROLE',
  };
}

function approvedFixture(familyKey = 'TERMINATION_FEE') {
  const schema = {
    schema_version: 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1',
    family_role_schema_id: null,
    payload_digest: null,
    family_key: familyKey,
    role_schema_version: 1,
    approval_state: 'BEN_APPROVED_AND_SEALED',
    approval_id: 'ben-ruling-m5-test-001',
    approver: 'BEN_GOODCHILD',
    approved_at: '2026-08-11T20:00:00.000Z',
    source_proposal_binding: {
      path: `${MIGRATION_ROOT}/preparation/m5/proposed-role-schemas/${familyKey}.json`,
      byte_length: 101,
      sha256: '1'.repeat(64),
    },
    calibration_pack_binding: {
      path: `${MIGRATION_ROOT}/preparation/m5/calibration-packs/${familyKey}.json`,
      byte_length: 102,
      sha256: '2'.repeat(64),
    },
    ruling_bindings: [],
    claim_definition_scope: {
      included_claim_definition_keys: ['TERMINATION_FEE_AMOUNT'],
      excluded_claim_definition_keys: [],
      source_first_rule: 'USE_SEALED_M2_M3_M4_EVIDENCE_ONLY',
      proposition_unit_rule: 'ONE_SIDE_SPECIFIC_FEE_OBLIGATION',
    },
    subtype_profiles: [{
      profile_id: 'TERMINATION_FEE_AMOUNT_V1',
      profile_version: 1,
      claim_definition_keys: ['TERMINATION_FEE_AMOUNT'],
      proposition_unit: 'ONE_SIDE_SPECIFIC_FEE_OBLIGATION',
      applicability_rule: 'EXACT_CLAIM_DEFINITION_KEY',
      required_roles: [role('PAYER'), role('PAYEE'), role('AMOUNT')],
      optional_roles: [role('PAYMENT_TIMING', false)],
      role_order: ['PAYER', 'PAYEE', 'AMOUNT', 'PAYMENT_TIMING'],
      cross_family_rules: [],
      unresolved_legal_question_ids: [],
    }],
    cross_family_dependencies: [],
    prohibitions: [
      'NO_RUNNER_INPUT',
      'NO_COMPLETE_TRANSITION',
      'NO_RENDERING',
      'NO_APPROVAL_INFERENCE',
      'NO_RAW_SOURCE_REPARSE',
      'NO_PROJECTION_ROLE_FILL',
      'NO_CROSS_FAMILY_CONTENT_DUPLICATION',
    ],
  };
  const payload = unsigned(schema, 'family_role_schema_id', 'payload_digest');
  schema.payload_digest = sha256Hex(canonicalJson(payload));
  schema.family_role_schema_id = contentId(schema.schema_version, {
    ...payload,
    payload_digest: schema.payload_digest,
  });
  const bytes = Buffer.from(`${JSON.stringify(schema, null, 2)}\n`);
  const authority = {
    schema_version: 'STAGE_2Y_M5_FAMILY_EXECUTION_AUTHORITY/V1',
    authority_digest: null,
    authority_state: 'ACTIVE_FOR_ONE_APPROVED_FAMILY_SHADOW_COMPARISON',
    stage: 'M5',
    family_key: familyKey,
    approval_id: schema.approval_id,
    approver: 'BEN_GOODCHILD',
    approved_role_schema_binding: {
      path: `${MIGRATION_ROOT}/control/family-role-schemas/${familyKey}.json`,
      byte_length: bytes.length,
      sha256: sha256Hex(bytes),
      schema_version: schema.schema_version,
      family_key: familyKey,
      family_role_schema_id: schema.family_role_schema_id,
      payload_digest: schema.payload_digest,
      approval_id: schema.approval_id,
    },
  };
  authority.authority_digest = sha256Hex(canonicalJson(unsigned(authority, 'authority_digest')));
  return { schema, bytes, authority };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
}

const policy = readJson(POLICY_RELATIVE);
const authority = readJson(AUTHORITY_RELATIVE);
const review = readJson(REVIEW_RELATIVE);

test('sealed M5 preparation controls have exact bytes and recursive identities', () => {
  assert.equal(sha256Hex(readBytes(POLICY_RELATIVE)), POLICY_SHA256);
  assert.equal(sha256Hex(readBytes(AUTHORITY_RELATIVE)), AUTHORITY_SHA256);
  assert.equal(sha256Hex(readBytes(REVIEW_RELATIVE)), REVIEW_SHA256);
  assert.equal(policy.policy_digest, POLICY_DIGEST);
  assert.equal(authority.authority_digest, AUTHORITY_DIGEST);
  assert.equal(review.review_id, REVIEW_ID);
  assert.equal(
    policy.policy_digest,
    sha256Hex(canonicalJson(unsigned(policy, 'policy_digest'))),
  );
  assert.equal(
    authority.authority_digest,
    sha256Hex(canonicalJson(unsigned(authority, 'authority_digest'))),
  );
  assert.equal(
    review.review_id,
    contentId(review.schema_version, unsigned(review, 'review_id')),
  );
  assert.deepEqual(authority.bindings.full_contract_review, policy.full_contract_review_binding);
  assert.deepEqual(authority.bindings.calibration_policy, {
    path: POLICY_RELATIVE,
    byte_length: readBytes(POLICY_RELATIVE).length,
    sha256: POLICY_SHA256,
    schema_version: policy.schema_version,
    policy_version: policy.policy_version,
    policy_digest: policy.policy_digest,
  });
});

test('M2, M3 and M4 predecessor receipts and every bound output retain exact bytes', () => {
  for (const binding of policy.dependency_contract.required_receipts) {
    const receipt = assertExtendedBinding(binding, `${binding.stage} receipt`);
    assert.equal(receipt.schema_version, binding.schema_version);
    assert.equal(receipt.stage, binding.stage);
    assert.equal(receipt.lifecycle_state, 'SEALED');
    assert.equal(receipt.status, 'PASS');
    assert.equal(receipt.output_set_digest, binding.output_set_digest);
    assert.equal(receipt.output_bindings.length, binding.output_count);
    for (const output of receipt.output_bindings) {
      assertExtendedBinding(output, `${binding.stage} ${output.path}`);
    }
    assert.equal(
      receipt.output_set_digest,
      sha256Hex(canonicalJson(receipt.output_bindings)),
      `${binding.stage} output set digest`,
    );
  }
});

test('the family registry is a closed 25-family, four-wave, 130-comparator partition', () => {
  const families = policy.family_order_contract.families;
  assert.equal(families.length, 25);
  assert.deepEqual(families.map((family) => family.ordinal), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.deepEqual([...new Set(families.map((family) => family.wave))], [1, 2, 3, 4]);
  assert.equal(
    families.reduce((total, family) => total + family.exact_comparator_run_count, 0),
    130,
  );
  assert.equal(new Set(families.map((family) => family.family_key)).size, 25);
  assert.equal(policy.comparator_contract.exact_run_count, 130);
  const analysisPolicy = assertExtendedBinding(authority.bindings.analysis_policy, 'analysis policy');
  const runs = analysisPolicy.input_contract.legacy_run_bindings;
  assert.equal(runs.length, 130);
  assert.equal(
    sha256Hex(canonicalJson(runs)),
    policy.comparator_contract.binding_set_digest,
  );
  for (const family of families) {
    const selected = runs.filter((run) => run.family === family.family_key);
    assert.equal(selected.length, family.exact_comparator_run_count, family.family_key);
    for (const run of selected) {
      assertExtendedBinding(run.resolution_binding, `${run.run_identifier} resolution`);
      assertExtendedBinding(run.adapter_result_binding, `${run.run_identifier} adapter result`);
      assertExtendedBinding(run.validation_binding, `${run.run_identifier} validation`);
    }
  }
});

test('the preparation allow-list is exact and excludes every execution output', () => {
  const outputs = familyOutputPaths(policy);
  assert.equal(outputs.length, 50);
  assert.deepEqual(outputs, policy.repository_contract.preparation_outputs);
  assert.equal(authority.permitted_changed_files.length, 58);
  assert.deepEqual(authority.permitted_changed_files.slice(8), outputs);
  assert.equal(authority.changed_file_contract.exact_count, 58);
  assert.equal(authority.changed_file_contract.family_artefact_count, 50);
  assert.equal(authority.permitted_output.family_role_schema_count, 0);
  assert.equal(authority.permitted_output.shadow_m5_output_count, 0);
  assert.equal(authority.permitted_output.family_receipt_count, 0);
  assert.equal(authority.permitted_output.aggregate_receipt_count, 0);
  for (const prohibited of policy.no_run_contract.required_absent_paths) {
    const authorised = authority.permitted_changed_files.some((repositoryPath) => (
      repositoryPath === prohibited || repositoryPath.startsWith(`${prohibited}/`)
    ));
    assert.equal(authorised, false, prohibited);
    const historicalPath = spawnSync(
      '/usr/bin/git',
      ['ls-tree', '--name-only', authority.base_commit, '--', prohibited],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    assert.equal(historicalPath.status, 0, historicalPath.stderr);
    assert.equal(historicalPath.stdout.trim(), '', prohibited);
  }
});

test('all preparation artefacts obey the closed schemas, order and proposal-only state', () => {
  const packContract = policy.calibration_pack_contract;
  const proposalContract = policy.proposed_role_schema_contract;
  const registry = assertExtendedBinding(authority.bindings.analysis_policy, 'analysis policy')
    .input_contract.legacy_run_bindings;

  for (const family of policy.family_order_contract.families) {
    const pack = readJson(family.calibration_pack_path);
    const proposal = readJson(family.proposed_role_schema_path);
    assertExactKeys(pack, packContract.exact_top_level_members, `${family.family_key} pack`);
    assertExactKeys(proposal, proposalContract.exact_top_level_members, `${family.family_key} proposal`);
    assert.equal(pack.schema_version, packContract.schema_version);
    assert.equal(proposal.schema_version, proposalContract.schema_version);
    assert.equal(pack.family_key, family.family_key);
    assert.equal(proposal.family_key, family.family_key);
    assert.equal(pack.wave, family.wave);
    assert.equal(pack.status, 'PROPOSED_AWAITING_BEN_APPROVAL');
    assert.equal(proposal.status, 'PROPOSED_AWAITING_BEN_APPROVAL');
    assert.equal(proposal.runner_eligible, false);
    assert.equal(proposal.complete_transition_authorised, false);
    assert.equal(proposal.approval_id, null);
    assert.equal(proposal.schema_authority, null);
    assert.equal(proposal.renderability_rule, 'NEVER_RENDER_FROM_PROPOSAL');
    assertContentRecord(pack, 'calibration_pack_digest', 'calibration_pack_id');
    assertContentRecord(proposal, 'proposal_digest', 'proposed_role_schema_id');
    assert.ok(pack.provision_examples.length >= 3 && pack.provision_examples.length <= 10);
    assert.equal(pack.preparation_effects.model_calls, 0);
    assert.ok(Object.values(pack.preparation_effects).every((value) => value === 0));
    const expectedRuns = registry.filter((run) => run.family === family.family_key);
    assert.deepEqual(pack.comparator_run_bindings, expectedRuns);
    assert.equal(pack.comparator_run_bindings.length, family.exact_comparator_run_count);
    for (const supplemental of pack.supplemental_input_bindings) {
      assert.equal(supplemental.classification, 'SUPPLEMENTAL_NON_COMPARATOR');
      assert.equal(supplemental.may_affect_comparator_metrics, false);
    }
    assert.deepEqual(proposal.open_legal_question_ids, [...proposal.open_legal_question_ids].sort());
    for (const profile of proposal.subtype_profiles) {
      const declaredRoles = [...profile.required_roles, ...profile.optional_roles]
        .map((entry) => entry.role_key);
      assert.deepEqual(profile.role_order, declaredRoles, `${profile.profile_id} role order`);
      for (const requiredRole of profile.required_roles) {
        assert.equal(requiredRole.required_for_complete, true);
        assert.deepEqual(
          requiredRole.provenance_requirements,
          ['agreement_id', 'source_node_occurrence_id', 'source_span', 'source_text_sha256', 'source_role'],
        );
        assert.equal(requiredRole.missing_disposition, 'MISSING_REQUIRED_ROLE');
        assert.equal(requiredRole.renderability_on_missing, 'NON_RENDERABLE_MISSING_REQUIRED_ROLE');
      }
    }
  }
});

test('every complete provision example reconstructs from its sealed M2 nodes and exact bytes', () => {
  const m2Receipt = assertExtendedBinding(authority.bindings.m2_receipt, 'M2 receipt');
  const indexes = new Map(m2Receipt.output_bindings.map((binding) => {
    const index = assertExtendedBinding(binding, `M2 ${binding.path}`);
    return [index.source_binding.agreement_id, index];
  }));
  for (const family of policy.family_order_contract.families) {
    const pack = readJson(family.calibration_pack_path);
    for (const example of pack.provision_examples) {
      const index = indexes.get(example.agreement_id);
      assert.ok(index, `${example.example_id} agreement index`);
      assert.equal(example.complete_source_node_occurrence_ids.length, example.source_spans.length);
      assert.equal(example.source_spans.length, example.source_text_sha256s.length);
      assert.equal(example.source_spans.length, example.structure_revision_ids.length);
      const nodes = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
      for (const [ordinal, nodeId] of example.complete_source_node_occurrence_ids.entries()) {
        const node = nodes.get(nodeId);
        assert.ok(node, `${example.example_id} node ${nodeId}`);
        const span = example.source_spans[ordinal];
        assert.deepEqual(span, node.extent_span, `${example.example_id} span ${ordinal}`);
        assert.equal(example.source_text_sha256s[ordinal], span.text_sha256);
        assert.equal(example.structure_revision_ids[ordinal], node.structure_revision_id);
        const bytes = Buffer.from(index.source_binding.canonical_text, 'utf8')
          .subarray(span.start_byte, span.end_byte);
        assert.equal(sha256Hex(bytes), span.text_sha256, `${example.example_id} source ${ordinal}`);
      }
    }
  }
});

test('an exact approved schema and one-family execution authority pass the public gate', () => {
  const { schema, bytes, authority: executionAuthority } = approvedFixture();
  const result = validateApprovedFamilyRoleSchema(bytes, executionAuthority);
  assert.equal(result.family_key, 'TERMINATION_FEE');
  assert.equal(result.approval_state, 'BEN_APPROVED_AND_SEALED');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.subtype_profiles[0].required_roles[0]), true);
  assert.throws(() => { result.family_key = 'TERMINATION'; }, TypeError);
  schema.family_key = 'TERMINATION';
  bytes.fill(0);
  executionAuthority.family_key = 'TERMINATION';
  assert.equal(result.family_key, 'TERMINATION_FEE');
  assert.equal(result.subtype_profiles[0].required_roles[0].role_key, 'PAYER');
});

test('the public gate rejects direct proposals and copied proposals before execution', () => {
  const proposal = {
    schema_version: 'STAGE_2Y_PROPOSED_FAMILY_REQUIRED_ROLE_SCHEMA/V1',
    family_key: 'TERMINATION_FEE',
    status: 'PROPOSED_AWAITING_BEN_APPROVAL',
  };
  expectCode(
    () => validateApprovedFamilyRoleSchema(Buffer.from(JSON.stringify(proposal)), authority),
    'PROPOSED_SCHEMA_NOT_RUNNER_ELIGIBLE',
  );
  expectCode(
    () => validateApprovedFamilyRoleSchema(Buffer.from(JSON.stringify(proposal)), {}),
    'PROPOSED_SCHEMA_VERSION_FORBIDDEN',
  );
  proposal.schema_version = 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
  expectCode(
    () => validateApprovedFamilyRoleSchema(Buffer.from(JSON.stringify(proposal)), {}),
    'BEN_APPROVAL_BINDING_MISSING',
  );
});

test('the public gate rejects status edits, fake approvals and unresolved rulings', () => {
  for (const mutate of [
    (schema) => { schema.approval_state = 'PROPOSED_AWAITING_BEN_APPROVAL'; },
    (schema) => { schema.approver = 'NOT_BEN'; },
    (schema) => { delete schema.approval_id; },
  ]) {
    const fixture = approvedFixture();
    mutate(fixture.schema);
    const bytes = Buffer.from(`${JSON.stringify(fixture.schema, null, 2)}\n`);
    expectCode(
      () => validateApprovedFamilyRoleSchema(bytes, fixture.authority),
      'BEN_APPROVAL_BINDING_MISSING',
    );
  }

  const missingAuthority = approvedFixture();
  expectCode(
    () => validateApprovedFamilyRoleSchema(missingAuthority.bytes, {}),
    'BEN_APPROVAL_BINDING_MISSING',
  );

  const unresolved = approvedFixture();
  unresolved.schema.subtype_profiles[0].unresolved_legal_question_ids = ['TF-Q1'];
  assert.throws(() => validateApprovedFamilyRoleSchema(
    Buffer.from(`${JSON.stringify(unresolved.schema, null, 2)}\n`),
    unresolved.authority,
  ));
});

test('the public gate rejects missing role provenance and raw-source reparsing authority', () => {
  const missing = approvedFixture();
  missing.schema.subtype_profiles[0].required_roles[0].provenance_requirements.pop();
  assert.throws(
    () => validateApprovedFamilyRoleSchema(
      Buffer.from(`${JSON.stringify(missing.schema, null, 2)}\n`),
      missing.authority,
    ),
  );

  const reparse = approvedFixture();
  reparse.schema.prohibitions = reparse.schema.prohibitions
    .filter((entry) => entry !== 'NO_RAW_SOURCE_REPARSE');
  assert.throws(
    () => validateApprovedFamilyRoleSchema(
      Buffer.from(`${JSON.stringify(reparse.schema, null, 2)}\n`),
      reparse.authority,
    ),
  );
});

test('the public gate rejects payload, cross-family, byte and authority-digest drift', () => {
  const payloadDrift = approvedFixture();
  payloadDrift.schema.claim_definition_scope.proposition_unit_rule = 'ALTERED_RULE';
  expectCode(
    () => validateApprovedFamilyRoleSchema(
      Buffer.from(`${JSON.stringify(payloadDrift.schema, null, 2)}\n`),
      payloadDrift.authority,
    ),
    'ROLE_SCHEMA_DIGEST_MISMATCH',
  );

  const crossFamily = approvedFixture();
  crossFamily.authority.family_key = 'TERMINATION';
  crossFamily.authority.authority_digest = sha256Hex(canonicalJson(
    unsigned(crossFamily.authority, 'authority_digest'),
  ));
  expectCode(
    () => validateApprovedFamilyRoleSchema(crossFamily.bytes, crossFamily.authority),
    'AUTHORITY_BINDING_MISMATCH',
  );

  const byteDrift = approvedFixture();
  byteDrift.authority.approved_role_schema_binding.byte_length += 1;
  byteDrift.authority.authority_digest = sha256Hex(canonicalJson(
    unsigned(byteDrift.authority, 'authority_digest'),
  ));
  expectCode(
    () => validateApprovedFamilyRoleSchema(byteDrift.bytes, byteDrift.authority),
    'AUTHORITY_BINDING_MISMATCH',
  );

  const digestDrift = approvedFixture();
  digestDrift.authority.authority_digest = '0'.repeat(64);
  expectCode(
    () => validateApprovedFamilyRoleSchema(digestDrift.bytes, digestDrift.authority),
    'AUTHORITY_BINDING_MISMATCH',
  );
});

test('preparation remains zero-effect and cannot unlock M5 execution', () => {
  assert.equal(policy.effect.may_resolve_claims, false);
  assert.equal(policy.effect.may_change_complete_state, false);
  assert.equal(policy.effect.may_render, false);
  assert.equal(policy.effect.may_run_family_adapter, false);
  assert.equal(policy.no_run_contract.family_runner_invocation_limit, 0);
  assert.equal(policy.no_run_contract.aggregate_runner_invocation_limit, 0);
  assert.equal(policy.no_run_contract.model_call_limit, 0);
  assert.equal(policy.no_run_contract.phase_b_call_limit, 0);
  assert.equal(policy.no_run_contract.approved_role_schema_count, 0);
  assert.equal(policy.no_run_contract.runner_eligible_family_count, 0);
  assert.equal(policy.approval_transition_contract.proposal_never_mutates_in_place, true);
  assert.equal(policy.approval_transition_contract.proposal_can_unlock_runner, false);
  assert.ok(Object.values(authority.zero_effect_expectations).every((value) => value === 0));
  assert.equal(authority.command_run_limit.family_runner, 0);
  assert.equal(authority.command_run_limit.aggregate_runner, 0);
  assert.equal(authority.permitted_command.family_runner, null);
  assert.equal(authority.permitted_command.aggregate_runner, null);
});
