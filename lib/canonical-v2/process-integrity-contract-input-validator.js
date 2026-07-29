const { canonicalJson } = require('./canonical-bytes');

const PROCESS_INTEGRITY_CONTRACT_INPUT_KIND =
  'PROCESS_INTEGRITY_CONTRACT_INPUT';
const PROCESS_INTEGRITY_CONTRACT_INPUT_SCHEMA =
  'PROCESS_INTEGRITY_CONTRACT_INPUT/V1';
const PROCESS_INTEGRITY_CONTRACT_IDS = Object.freeze([
  'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
  'PROCESS_SERVING_CONTAINMENT_POLICY',
]);

class ProcessIntegrityContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessIntegrityContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessIntegrityContractInputError(code, message, details);
}

function requireObject(value, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireExactArray(value, expected, label, code) {
  if (!Array.isArray(value) || canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed ordered values.`, {
      actual: value,
      expected,
    });
  }
}

function requireExactObject(value, expected, label, code) {
  requireObject(value, label, code);
  if (canonicalJson(value) !== canonicalJson(expected)) {
    fail(code, `${label} does not match the governed value.`, {
      actual: value,
      expected,
    });
  }
}

function validateEnvelope(member, stableId, contractType) {
  const code = 'INVALID_PROCESS_INTEGRITY_CONTRACT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process integrity contract input', code);
  if (
    value.object_kind !== PROCESS_INTEGRITY_CONTRACT_INPUT_KIND
    || value.schema_version !== PROCESS_INTEGRITY_CONTRACT_INPUT_SCHEMA
    || value.stable_id !== stableId
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== contractType
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process integrity contract identity is not registered.');
  }
  return value.definition;
}

function requireNoAuthority(value, runtimeField, label, code) {
  requireExactObject(value, {
    [runtimeField]: false,
    creates_extraction_authority: false,
    creates_serving_authority: false,
    creates_serving_fence_authority: false,
    creates_revocation_authority: false,
    creates_rollback_authority: false,
    creates_writer_authority: false,
    creates_release_authority: false,
    creates_activation_authority: false,
    creates_contract_freeze_authority: false,
  }, label, code);
}

function validateRevocationCause(member) {
  const code = 'INVALID_PROCESS_INTEGRITY_REVOCATION_CAUSE_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
    'REVOCATION_CAUSE_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'registry_contract',
    'trigger_contract',
    'evidence_contract',
    'serving_fence_contract',
    'canonical_disposition_contract',
    'authority_contract',
  ], 'Process integrity revocation-cause definition', code);
  requireExactObject(definition.registry_contract, {
    required_registry: 'ActiveReleaseRevocationActionRegistry',
    proposed_cause_code: 'SEMANTIC_OR_SOURCE_INTEGRITY',
    closed_registry_entry_required_before_runtime: true,
    typed_trigger_evidence_required: true,
    authoritative_producer_definition_required: true,
    permitted_release_tuple_difference_required: true,
    generated_lock_plan_required: true,
    receipt_contract_required: true,
    label_or_model_output_can_create_cause: false,
    unregistered_cause_has_runtime_path: false,
  }, 'Process integrity registry contract', code);
  requireExactObject(definition.trigger_contract, {
    defect_classes: [
      'MATERIAL_UNSUPPORTED_FACT',
      'SOURCE_MAP_DEFECT',
      'CROSS_TRACK_ATTRIBUTION_ERROR',
    ],
    validated_material_trigger_required: true,
    governed_severity_required: true,
    governed_discovery_authority_required: true,
    exact_released_process_row_required: true,
    source_backed_evidence_required: true,
    unknown_defect_class_has_runtime_path: false,
    unvalidated_suspicion_can_revoke_release: false,
  }, 'Process integrity trigger contract', code);
  requireExactObject(definition.evidence_contract, {
    schema_key: 'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_EVIDENCE/V1',
    required_identity_bindings: [
      'served_process_row_identity',
      'source_document_identity',
      'source_detail_identity',
      'exact_ordered_evidence_spans',
      'defect_class',
      'severity',
      'discovery_authority',
      'active_before_release_tuple',
      'exposure_off_release_tuple',
    ],
    content_addressed: true,
    immutable: true,
    release_pinned: true,
    generic_reason_permitted: false,
    caller_selected_release_tuple_permitted: false,
  }, 'Process integrity evidence contract', code);
  requireExactObject(definition.serving_fence_contract, {
    scope: 'PROCESS',
    validated_material_trigger_raises_fence: true,
    maximum_acknowledgement_time_source: 'OperationalPolicySet',
    blocks_new_process_exposure: true,
    drains_process_serving_leases: true,
    alters_canonical_release_state: false,
    counts_as_revocation: false,
    resume_while_defect_unresolved_permitted: false,
  }, 'Process integrity serving-fence contract', code);
  requireExactObject(definition.canonical_disposition_contract, {
    required_only_if_certified_active_tuple_invalidated: true,
    registered_action_required: true,
    permitted_outcomes: [
      'REVOKE_WHOLE_RELEASE_TUPLE',
      'ROLL_BACK_WHOLE_RELEASE_TUPLE',
    ],
    canonical_disposition_deadline_source: 'OperationalPolicySet',
    rehearsed_incident_procedure_required: true,
    serialisable_compare_and_swap_required: true,
    partial_process_release_transition_permitted: false,
    successor_preparation_counts_as_containment: false,
    active_row_mutation_permitted: false,
  }, 'Process integrity canonical disposition', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_cause',
    'Process integrity revocation-cause authority',
    code,
  );
}

function validateServingContainmentPolicy(member) {
  const code = 'INVALID_PROCESS_SERVING_CONTAINMENT_POLICY_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_SERVING_CONTAINMENT_POLICY',
    'SERVING_CONTAINMENT_POLICY_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'policy_binding_contract',
    'fence_contract',
    'release_disposition_contract',
    'recovery_contract',
    'failure_isolation_contract',
    'authority_contract',
  ], 'Process serving-containment policy definition', code);
  requireExactObject(definition.policy_binding_contract, {
    required_policy_set: 'OperationalPolicySet',
    required_revocation_cause_definition:
      'PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE',
    required_registered_cause_code: 'SEMANTIC_OR_SOURCE_INTEGRITY',
    exact_selected_policy_set_required: true,
    request_supplied_policy_can_authorise_action: false,
    domain_contract_can_select_numeric_deadline: false,
  }, 'Process containment policy binding', code);
  requireExactObject(definition.fence_contract, {
    scope: 'PROCESS',
    before_state: 'OPEN',
    after_state: 'BLOCKED',
    validated_material_trigger_required: true,
    maximum_acknowledgement_time_source: 'OperationalPolicySet',
    new_process_admission_blocked: true,
    process_serving_lease_drain_required: true,
    acknowledged_blocked_fence_required: true,
    canonical_release_state_unchanged: true,
    revocation_receipt_created_by_fence: false,
    unresolved_defect_can_resume_exposure: false,
  }, 'Process serving fence policy', code);
  requireExactObject(definition.release_disposition_contract, {
    certified_active_tuple_invalidation_required: true,
    registered_revocation_action_required: true,
    whole_release_tuple_only: true,
    canonical_disposition_deadline_source: 'OperationalPolicySet',
    domain_local_shorter_deadline_permitted: false,
    serialisable_compare_and_swap_required: true,
    exact_active_before_and_exposure_off_tuples_required: true,
    partial_process_release_transition_permitted: false,
    successor_preparation_counts_as_containment: false,
  }, 'Process release disposition policy', code);
  requireExactObject(definition.recovery_contract, {
    validated_resolution_required: true,
    affected_predicates_recertified: true,
    fresh_certified_active_tuple_or_proven_rollback_required: true,
    rehearsed_recovery_procedure_required: true,
    authorised_reopen_required: true,
    silent_automatic_reopen_permitted: false,
  }, 'Process containment recovery policy', code);
  requireExactObject(definition.failure_isolation_contract, {
    request_row_and_detail_failures_fail_closed_locally: true,
    valid_sibling_rows_remain_publishable: true,
    release_wide_containment_requires_certified_tuple_invalidation: true,
    local_failure_can_expand_without_validated_release_invalidation: false,
  }, 'Process containment failure isolation', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_policy',
    'Process serving-containment policy authority',
    code,
  );
}

function validateAuthoredProcessIntegrityInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_INTEGRITY_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PROCESS_INTEGRITY_CONTRACT_IDS,
    'Process integrity contract member set',
    'PROCESS_INTEGRITY_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const validators = {
    PROCESS_SEMANTIC_OR_SOURCE_INTEGRITY_REVOCATION_CAUSE:
      validateRevocationCause,
    PROCESS_SERVING_CONTAINMENT_POLICY: validateServingContainmentPolicy,
  };
  for (const member of members) {
    validators[member.canonical_value.stable_id](member);
  }
}

module.exports = {
  PROCESS_INTEGRITY_CONTRACT_IDS,
  PROCESS_INTEGRITY_CONTRACT_INPUT_KIND,
  PROCESS_INTEGRITY_CONTRACT_INPUT_SCHEMA,
  ProcessIntegrityContractInputError,
  validateAuthoredProcessIntegrityInputs,
};
