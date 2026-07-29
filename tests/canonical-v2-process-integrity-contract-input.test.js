const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessIntegrityInputs,
} = require('../lib/canonical-v2/process-integrity-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function integrityMembers() {
  return [
    loadMember(
      'process/integrity/process-semantic-or-source-integrity-revocation-cause.v1.json',
    ),
    loadMember(
      'process/integrity/process-serving-containment-policy.v1.json',
    ),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the Process integrity cause and containment policy as one closed pair', () => {
  const members = integrityMembers();
  assert.doesNotThrow(() => validateAuthoredProcessIntegrityInputs(members));

  const cause = byId(
    members,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
  const policy = byId(members, 'PROCESS_SERVING_CONTAINMENT_POLICY');
  assert.equal(
    cause.registry_contract.proposed_cause_code,
    policy.policy_binding_contract.required_registered_cause_code,
  );
  assert.equal(
    policy.policy_binding_contract.required_revocation_cause_definition,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
});

test('admits only the three governed, source-backed material defect classes', () => {
  const cause = byId(
    integrityMembers(),
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
  assert.deepEqual(cause.trigger_contract.defect_classes, [
    'MATERIAL_UNSUPPORTED_FACT',
    'SOURCE_MAP_DEFECT',
    'CROSS_TRACK_ATTRIBUTION_ERROR',
  ]);
  assert.equal(cause.trigger_contract.validated_material_trigger_required, true);
  assert.equal(cause.trigger_contract.source_backed_evidence_required, true);
  assert.equal(cause.trigger_contract.unknown_defect_class_has_runtime_path, false);
  assert.equal(
    cause.trigger_contract.unvalidated_suspicion_can_revoke_release,
    false,
  );
});

test('keeps the Process fence separate from whole-release disposition', () => {
  const members = integrityMembers();
  const cause = byId(
    members,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
  const policy = byId(members, 'PROCESS_SERVING_CONTAINMENT_POLICY');

  assert.equal(cause.serving_fence_contract.scope, 'PROCESS');
  assert.equal(cause.serving_fence_contract.alters_canonical_release_state, false);
  assert.equal(cause.serving_fence_contract.counts_as_revocation, false);
  assert.equal(policy.release_disposition_contract.whole_release_tuple_only, true);
  assert.equal(
    policy.release_disposition_contract
      .certified_active_tuple_invalidation_required,
    true,
  );
  assert.equal(
    policy.failure_isolation_contract.valid_sibling_rows_remain_publishable,
    true,
  );
});

test('leaves every deadline with the selected OperationalPolicySet', () => {
  const members = integrityMembers();
  const cause = byId(
    members,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
  const policy = byId(members, 'PROCESS_SERVING_CONTAINMENT_POLICY');

  assert.equal(
    cause.serving_fence_contract.maximum_acknowledgement_time_source,
    'OperationalPolicySet',
  );
  assert.equal(
    cause.canonical_disposition_contract
      .canonical_disposition_deadline_source,
    'OperationalPolicySet',
  );
  assert.equal(
    policy.policy_binding_contract.domain_contract_can_select_numeric_deadline,
    false,
  );
  assert.equal(
    policy.release_disposition_contract
      .domain_local_shorter_deadline_permitted,
    false,
  );
});

test('requires exact evidence, acknowledged blocking and explicit recovery', () => {
  const members = integrityMembers();
  const cause = byId(
    members,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  );
  const policy = byId(members, 'PROCESS_SERVING_CONTAINMENT_POLICY');

  assert.deepEqual(cause.evidence_contract.required_identity_bindings, [
    'served_process_row_identity',
    'source_document_identity',
    'source_detail_identity',
    'exact_ordered_evidence_spans',
    'defect_class',
    'severity',
    'discovery_authority',
    'active_before_release_tuple',
    'exposure_off_release_tuple',
  ]);
  assert.equal(policy.fence_contract.acknowledged_blocked_fence_required, true);
  assert.equal(policy.recovery_contract.validated_resolution_required, true);
  assert.equal(policy.recovery_contract.affected_predicates_recertified, true);
  assert.equal(policy.recovery_contract.authorised_reopen_required, true);
  assert.equal(
    policy.recovery_contract.silent_automatic_reopen_permitted,
    false,
  );
});

test('grants no runtime, fence, revocation, rollback, write, release or freeze authority', () => {
  for (const member of integrityMembers()) {
    assert.deepEqual(
      Object.values(member.canonical_value.definition.authority_contract),
      [false, false, false, false, false, false, false, false, false, false],
    );
  }
});

test('rejects incomplete, unregistered, partial and caller-timed contracts', () => {
  assert.throws(
    () => validateAuthoredProcessIntegrityInputs(integrityMembers().slice(1)),
    (error) => error.code === 'PROCESS_INTEGRITY_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const unregistered = clone(integrityMembers());
  byId(
    unregistered,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  ).registry_contract.closed_registry_entry_required_before_runtime = false;
  assert.throws(
    () => validateAuthoredProcessIntegrityInputs(unregistered),
    (error) => (
      error.code === 'INVALID_PROCESS_INTEGRITY_REVOCATION_CAUSE_INPUT'
    ),
  );

  const partial = clone(integrityMembers());
  byId(
    partial,
    'PROCESS_SERVING_CONTAINMENT_POLICY',
  ).release_disposition_contract.whole_release_tuple_only = false;
  assert.throws(
    () => validateAuthoredProcessIntegrityInputs(partial),
    (error) => error.code === 'INVALID_PROCESS_SERVING_CONTAINMENT_POLICY_INPUT',
  );

  const callerTimed = clone(integrityMembers());
  byId(
    callerTimed,
    'PROCESS_SERVING_CONTAINMENT_POLICY',
  ).fence_contract.maximum_acknowledgement_seconds = 30;
  assert.throws(
    () => validateAuthoredProcessIntegrityInputs(callerTimed),
    (error) => error.code === 'INVALID_PROCESS_SERVING_CONTAINMENT_POLICY_INPUT',
  );
});
