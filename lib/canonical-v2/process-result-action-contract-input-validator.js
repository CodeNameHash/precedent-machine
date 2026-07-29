const { canonicalJson } = require('./canonical-bytes');

const PROCESS_RESULT_ACTION_CONTRACT_INPUT_KIND =
  'PROCESS_RESULT_ACTION_CONTRACT_INPUT';
const PROCESS_RESULT_ACTION_CONTRACT_INPUT_SCHEMA =
  'PROCESS_RESULT_ACTION_CONTRACT_INPUT/V1';
const PROCESS_RESULT_ACTION_CONTRACT_IDS = Object.freeze([
  'PROCESS_RELEASE_PINNED_CITATION_AND_SHARE',
  'PROCESS_RERUN_ON_ACTIVE_RELEASE',
  'PROCESS_SAVED_QUERY_DEFINITION',
  'PROCESS_SELECTED_RESULT_EXPORT',
]);

class ProcessResultActionContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessResultActionContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessResultActionContractInputError(code, message, details);
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
  const code = 'INVALID_PROCESS_RESULT_ACTION_CONTRACT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process result-action contract input', code);
  if (
    value.object_kind !== PROCESS_RESULT_ACTION_CONTRACT_INPUT_KIND
    || value.schema_version !== PROCESS_RESULT_ACTION_CONTRACT_INPUT_SCHEMA
    || value.stable_id !== stableId
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== contractType
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process result-action contract identity is not registered.');
  }
  return value.definition;
}

function requireNoAuthority(value, runtimeField, label, code) {
  requireExactObject(value, {
    [runtimeField]: false,
    creates_query_execution_authority: false,
    creates_serving_authority: false,
    creates_writer_authority: false,
    creates_release_authority: false,
    creates_activation_authority: false,
    creates_contract_freeze_authority: false,
  }, label, code);
}

function validateSavedQuery(member) {
  const code = 'INVALID_PROCESS_SAVED_QUERY_DEFINITION_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_SAVED_QUERY_DEFINITION',
    'SAVED_QUERY_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'definition_contract',
    'pinned_release_contract',
    'follow_active_contract',
    'execution_preflight_contract',
    'authority_contract',
  ], 'Process saved-query definition', code);
  requireExactObject(definition.definition_contract, {
    logical_type: 'SavedQueryDefinition',
    immutable_version_required: true,
    stable_id_and_canonical_definition_digest_required: true,
    cursor_free_semantic_template_required: true,
    query_ir_definition_stable_id: 'PROCESS_QUERY_IR',
    release_modes: [
      'PINNED',
      'FOLLOW_ACTIVE',
    ],
    bare_release_id_permitted: false,
    cursor_permitted: false,
    serving_fence_version_permitted: false,
    resolved_active_tuple_permitted: false,
  }, 'Process saved-query definition contract', code);
  requireExactObject(definition.pinned_release_contract, {
    exact_candidate_release_manifest_id_required: true,
    exact_candidate_release_manifest_payload_digest_required: true,
    active_manifest_byte_equality_required: true,
    inactive_disposition: 'RELEASE_NOT_ACTIVE',
    historical_serving_permitted: false,
    silent_active_release_substitution_permitted: false,
  }, 'Process pinned saved-query contract', code);
  requireExactObject(definition.follow_active_contract, {
    fresh_external_fence_resolution_required: true,
    fresh_active_manifest_admission_required: true,
    recompile_against_admitted_manifest_required: true,
    save_time_validation_can_authorise_execution: false,
  }, 'Process follow-active saved-query contract', code);
  requireExactObject(definition.execution_preflight_contract, {
    candidate_semantic_template_validation_required: true,
    saved_definition_ownership_required: true,
    saved_definition_digest_and_byte_equality_required: true,
    execution_class_resolution_before_database_checkout: true,
    incompatible_template_disposition: 'TYPED_REFUSAL',
    read_execution_can_update_mutable_counters_synchronously: false,
  }, 'Process saved-query execution preflight', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_saved_query',
    'Process saved-query authority',
    code,
  );
}

function validateCitationAndShare(member) {
  const code = 'INVALID_PROCESS_CITATION_AND_SHARE_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_RELEASE_PINNED_CITATION_AND_SHARE',
    'CITATION_AND_SHARE_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'parent_binding_contract',
    'citation_contract',
    'share_contract',
    'failure_contract',
    'authority_contract',
  ], 'Process citation-and-share definition', code);
  requireExactObject(definition.parent_binding_contract, {
    permitted_parent_kind: 'RESULT_ROW',
    exact_parent_row_identity_required: true,
    exact_candidate_release_manifest_id_and_payload_digest_required: true,
    exact_corpus_release_identity_required: true,
    exact_detail_reference_required: true,
    object_level_authorisation_required: true,
  }, 'Process citation parent binding', code);
  requireExactObject(definition.citation_contract, {
    verbatim_passage_required: true,
    exact_source_document_identity_required: true,
    exact_source_interval_and_digest_required: true,
    source_local_narration_identity_required: true,
    human_readable_source_label_required: true,
    citation_can_rewrite_source_text: false,
    citation_reference_is_bearer_token: false,
  }, 'Process citation contract', code);
  requireExactObject(definition.share_contract, {
    share_link_binds_exact_candidate_release_manifest: true,
    share_link_binds_exact_parent_and_action_identity: true,
    active_release_required: true,
    inactive_disposition: 'RELEASE_NOT_ACTIVE',
    historical_serving_permitted: false,
    silent_redirect_or_result_substitution_permitted: false,
    fresh_authentication_and_object_authorisation_required: true,
  }, 'Process share contract', code);
  requireExactObject(definition.failure_contract, {
    invalid_citation_fails_parent_action_only: true,
    valid_sibling_rows_remain_publishable: true,
    operational_failure_can_render_as_empty_citation: false,
  }, 'Process citation failure contract', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_citation_or_share',
    'Process citation-and-share authority',
    code,
  );
}

function validateSelectedResultExport(member) {
  const code = 'INVALID_PROCESS_SELECTED_RESULT_EXPORT_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_SELECTED_RESULT_EXPORT',
    'SELECTED_RESULT_EXPORT_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'selection_contract',
    'content_contract',
    'execution_contract',
    'failure_contract',
    'authority_contract',
  ], 'Process selected-result export definition', code);
  requireExactObject(definition.selection_contract, {
    query_ir_definition_stable_id: 'PROCESS_QUERY_IR',
    exact_query_semantics_digest_required: true,
    exact_candidate_release_manifest_id_and_payload_digest_required: true,
    typed_selected_row_keys_required: true,
    mixed_release_selection_permitted: false,
    physical_database_identifiers_permitted: false,
  }, 'Process export selection contract', code);
  requireExactObject(definition.content_contract, {
    generated_result_schema_required: true,
    exact_row_and_source_identity_required: true,
    coverage_and_exclusions_required: true,
    certification_and_provenance_required: true,
    canonical_states_preserved: true,
    source_text_rewrite_permitted: false,
    page_one_only_export_permitted: false,
    browser_corpus_hydration_permitted: false,
    silent_truncation_permitted: false,
  }, 'Process export content contract', code);
  requireExactObject(definition.execution_contract, {
    server_side_bounded_execution_required: true,
    fresh_admission_per_chunk_required: true,
    one_set_based_statement_per_chunk_required: true,
    global_route_and_capacity_manifests_own_numeric_limits: true,
    domain_contract_can_select_numeric_limit: false,
    exact_total_and_final_checksum_required: true,
    publish_only_after_complete_validation: true,
    failed_or_partial_artefact_visible: false,
  }, 'Process export execution contract', code);
  requireExactObject(definition.failure_contract, {
    unsupported_format_disposition: 'TYPED_REFUSAL',
    budget_excess_disposition: 'EXPORT_TOO_LARGE',
    operational_failure_can_render_as_empty_export: false,
    automatic_retry_policy_source: 'RouteBudgetManifest',
    immediate_retry_permitted: false,
    retry_without_typed_envelope_permission_permitted: false,
  }, 'Process export failure contract', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_export',
    'Process selected-result export authority',
    code,
  );
}

function validateRerun(member) {
  const code = 'INVALID_PROCESS_ACTIVE_RELEASE_RERUN_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_RERUN_ON_ACTIVE_RELEASE',
    'ACTIVE_RELEASE_RERUN_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'eligibility_contract',
    'compilation_contract',
    'result_contract',
    'failure_contract',
    'authority_contract',
  ], 'Process active-release rerun definition', code);
  requireExactObject(definition.eligibility_contract, {
    source_definition_stable_id: 'PROCESS_SAVED_QUERY_DEFINITION',
    source_release_is_no_longer_active: true,
    explicit_user_action_required: true,
    changed_results_warning_required_before_action: true,
    automatic_rerun_permitted: false,
    durable_historical_serving_permitted: false,
  }, 'Process rerun eligibility contract', code);
  requireExactObject(definition.compilation_contract, {
    query_ir_definition_stable_id: 'PROCESS_QUERY_IR',
    original_cursor_free_semantic_template_required: true,
    fresh_active_candidate_release_manifest_admission_required: true,
    fresh_compilation_against_active_contract_required: true,
    same_query_door_required: true,
    unsupported_or_incompatible_disposition: 'TYPED_REFUSAL',
    nearest_predicate_substitution_permitted: false,
  }, 'Process rerun compilation contract', code);
  requireExactObject(definition.result_contract, {
    new_execution_identity_required: true,
    new_active_release_identity_required: true,
    original_saved_definition_remains_immutable: true,
    original_citation_or_result_substitution_permitted: false,
    silent_redirect_permitted: false,
    result_difference_warning_retained: true,
  }, 'Process rerun result contract', code);
  requireExactObject(definition.failure_contract, {
    active_release_resolution_failure_fails_closed: true,
    failed_rerun_can_mutate_saved_definition: false,
    failed_rerun_can_hide_original_reference: false,
    operational_failure_can_render_as_empty_result: false,
  }, 'Process rerun failure contract', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_rerun',
    'Process active-release rerun authority',
    code,
  );
}

function validateAuthoredProcessResultActionInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_RESULT_ACTION_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PROCESS_RESULT_ACTION_CONTRACT_IDS,
    'Process result-action contract member set',
    'PROCESS_RESULT_ACTION_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const validators = {
    PROCESS_RELEASE_PINNED_CITATION_AND_SHARE: validateCitationAndShare,
    PROCESS_RERUN_ON_ACTIVE_RELEASE: validateRerun,
    PROCESS_SAVED_QUERY_DEFINITION: validateSavedQuery,
    PROCESS_SELECTED_RESULT_EXPORT: validateSelectedResultExport,
  };
  for (const member of members) {
    validators[member.canonical_value.stable_id](member);
  }
}

module.exports = {
  PROCESS_RESULT_ACTION_CONTRACT_IDS,
  PROCESS_RESULT_ACTION_CONTRACT_INPUT_KIND,
  PROCESS_RESULT_ACTION_CONTRACT_INPUT_SCHEMA,
  ProcessResultActionContractInputError,
  validateAuthoredProcessResultActionInputs,
};
