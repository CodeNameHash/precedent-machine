const { canonicalJson } = require('./canonical-bytes');

const PROCESS_DOMAIN_REGISTRY_INPUT_KIND = 'PROCESS_DOMAIN_REGISTRY_INPUT';
const PROCESS_DOMAIN_REGISTRY_INPUT_SCHEMA = 'PROCESS_DOMAIN_REGISTRY_INPUT/V1';
const PROCESS_LOGICAL_TYPE_INPUT_KIND = 'PROCESS_LOGICAL_TYPE_INPUT';
const PROCESS_LOGICAL_TYPE_INPUT_SCHEMA = 'PROCESS_LOGICAL_TYPE_INPUT/V1';
const PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND =
  'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT';
const PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_SCHEMA =
  'PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT/V1';

const PROCESS_INPUT_KINDS = Object.freeze([
  PROCESS_DOMAIN_REGISTRY_INPUT_KIND,
  PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND,
  PROCESS_LOGICAL_TYPE_INPUT_KIND,
]);

const OCCURRENCE_IDENTITY_INPUTS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'narration_definition_key_and_version',
  'canonical_source_interval_set',
  'governed_ordinal',
]);

const VALUE_IDENTITY_INPUTS = Object.freeze([
  'candidate_values',
  'extracted_attributes',
  'inferred_event_id',
  'model_output',
  'selected_revision_id',
]);

const PROCESS_LOGICAL_TYPE_IDS = Object.freeze([
  'PROCESS_EVENT',
  'PROCESS_NARRATION_OCCURRENCE',
  'PROCESS_PARTICIPANT',
]);

const EVENT_IDENTITY_INPUTS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'event_definition_key_and_version',
  'ordered_process_narration_occurrence_ids',
  'governed_ordinal',
]);

const EVENT_PROHIBITED_IDENTITY_INPUTS = Object.freeze([
  'candidate_values',
  'event_date',
  'event_type_code',
  'extracted_attributes',
  'model_output',
  'participant_revision_ids',
  'selected_revision_id',
]);

const PARTICIPANT_IDENTITY_INPUTS = Object.freeze([
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'process_event_slot_key',
  'process_participant_slot_key',
  'governed_ordinal',
]);

const PARTICIPANT_PROHIBITED_IDENTITY_INPUTS = Object.freeze([
  'bidder_track_id',
  'cleaned_name',
  'display_name',
  'entity_subject_id',
  'event_role_code',
  'model_output',
  'source_local_label',
]);

const CANONICAL_STATES = Object.freeze([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);

const VALUE_RULE_BY_STATE = Object.freeze({
  PRESENT: 'VALUE_AND_EVIDENCE_REQUIRED',
  ABSENT: 'COMPLETE_SCOPE_AND_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_APPLICABLE: 'APPLICABILITY_EVIDENCE_REQUIRED_NO_VALUE',
  NOT_EXAMINED: 'NO_VALUE',
  FAILED: 'FAILURE_DETAIL_REQUIRED_NO_VALUE',
});

class ProcessContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessContractInputError(code, message, details);
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

function validateDomainRegistry(member) {
  const code = 'INVALID_PROCESS_DOMAIN_REGISTRY_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'domain_key',
    'domain_version',
    'logical_namespace',
    'consumed_authorities',
    'registry_contract',
  ], 'Process domain registry input', code);
  if (
    value.object_kind !== PROCESS_DOMAIN_REGISTRY_INPUT_KIND
    || value.stable_id !== 'PROCESS'
    || value.schema_version !== PROCESS_DOMAIN_REGISTRY_INPUT_SCHEMA
    || value.domain_key !== 'PROCESS'
    || value.domain_version !== 1
    || value.logical_namespace !== 'CANONICAL_V2_PROCESS'
  ) {
    fail('UNREGISTERED_PROCESS_DOMAIN', 'The Process domain identity is not registered.');
  }
  requireExactArray(
    value.consumed_authorities,
    ['AGREEMENT_CONTRACT', 'SHARED_AUTHORITY'],
    'Process consumed authorities',
    code,
  );
  requireExactObject(value.registry_contract, {
    definitions_are_authored_inputs_only: true,
    definitions_create_writer_authority: false,
    definitions_create_serving_authority: false,
    definitions_create_release_authority: false,
    unknown_domain_fails_closed: true,
    runtime_taxonomy_admission_permitted: false,
    published_release_taxonomy_closed: true,
    successor_taxonomy_extension_permitted: true,
    shared_authority_can_be_consumed_but_not_reauthored: true,
  }, 'Process domain registry contract', code);
}

function validateNarrationOccurrence(member) {
  const code = 'INVALID_PROCESS_LOGICAL_TYPE_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process logical type input', code);
  if (
    value.object_kind !== PROCESS_LOGICAL_TYPE_INPUT_KIND
    || value.stable_id !== 'PROCESS_NARRATION_OCCURRENCE'
    || value.schema_version !== PROCESS_LOGICAL_TYPE_INPUT_SCHEMA
    || value.definition?.logical_type !== 'ProcessNarrationOccurrence'
  ) {
    fail(
      'UNREGISTERED_PROCESS_LOGICAL_TYPE',
      'The Process logical type identity is not registered.',
    );
  }

  const definition = value.definition;
  requireExactKeys(definition, [
    'domain_key',
    'logical_type',
    'logical_type_version',
    'expected_occurrence_slot_key',
    'occurrence_identity',
    'source_interval_contract',
    'ordinal_contract',
    'revision_identity',
    'state_rules',
    'evidence_rules',
    'ownership_contract',
    'physical_carrier',
    'writer_action',
    'release_treatment',
    'import_treatment',
    'trace_treatment',
    'exact_detail_treatment',
    'consumer_projection_rule',
    'type_contract',
  ], 'Process narration definition', code);
  if (
    definition.domain_key !== 'PROCESS'
    || definition.logical_type_version !== 1
    || definition.expected_occurrence_slot_key !== 'PROCESS_NARRATION'
  ) {
    fail(code, 'The Process narration definition is outside its registered domain or slot.');
  }

  requireExactKeys(definition.occurrence_identity, [
    'stable_id_domain',
    'stable_id_inputs',
    'prohibited_inputs',
  ], 'Process narration occurrence identity', code);
  const forbiddenIdentityInputs = definition.occurrence_identity.stable_id_inputs
    ?.filter((input) => VALUE_IDENTITY_INPUTS.includes(input)) || [];
  if (forbiddenIdentityInputs.length > 0) {
    fail(
      'PROCESS_VALUE_DERIVED_OCCURRENCE_ID',
      'Extracted values cannot define a Process narration occurrence ID.',
      { forbidden_identity_inputs: forbiddenIdentityInputs },
    );
  }
  if (definition.occurrence_identity.stable_id_domain !== 'PROCESS_NARRATION_OCCURRENCE/V1') {
    fail(code, 'The Process narration stable ID domain is invalid.');
  }
  requireExactArray(
    definition.occurrence_identity.stable_id_inputs,
    OCCURRENCE_IDENTITY_INPUTS,
    'Process narration stable ID inputs',
    code,
  );
  requireExactArray(
    definition.occurrence_identity.prohibited_inputs,
    VALUE_IDENTITY_INPUTS,
    'Process narration prohibited identity inputs',
    code,
  );

  requireExactObject(definition.source_interval_contract, {
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    exact_ordered_intervals_required: true,
    occurrence_independent: true,
    paragraph_boundary_defines_occurrence: false,
    unresolved_member_universe_blocks_context: true,
  }, 'Process narration source interval contract', code);
  requireExactObject(definition.ordinal_contract, {
    comparator: 'CANONICAL_SOURCE_INTERVAL_COMPARATOR/V1',
    frozen_before_candidate_values: true,
    candidate_value_order_permitted: false,
    insertion_order_permitted: false,
    worker_order_permitted: false,
    model_output_order_permitted: false,
  }, 'Process narration ordinal contract', code);
  requireExactObject(definition.revision_identity, {
    revision_type: 'ProcessNarrationRevision',
    revision_id_domain: 'PROCESS_NARRATION_REVISION/V1',
    immutable_inputs: [
      'claim_revision_ids',
      'evidence_edges',
      'process_narration_occurrence_id',
      'relationship_revision_ids',
      'revision_status',
      'source_backed_attributes',
    ],
  }, 'Process narration revision identity', code);
  requireExactObject(definition.state_rules, {
    allowed_states: CANONICAL_STATES,
    value_rule_by_state: VALUE_RULE_BY_STATE,
  }, 'Process narration state rules', code);
  requireExactObject(definition.evidence_rules, {
    exact_evidence_required: true,
    source_occurrence_required: true,
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    complete_scope_required_for_absent: true,
  }, 'Process narration evidence rules', code);
  requireExactObject(definition.ownership_contract, {
    claim_owner_permitted: true,
    relationship_endpoint_permitted: true,
    result_input_lineage_permitted: true,
    event_identity_equivalence_implied: false,
  }, 'Process narration ownership contract', code);
  requireExactObject(definition.physical_carrier, {
    carrier_kind: 'CANDIDATE_RELEASE_TABLE',
    carrier_name: 'process_narration_occurrences',
    release_partitioned: true,
  }, 'Process narration physical carrier', code);
  requireExactObject(definition.writer_action, {
    action_key: 'MATERIALISE_PROCESS_NARRATION_OCCURRENCE',
    action_version: 1,
    candidate_only: true,
    current_release_writer_path: false,
    definition_grants_execution_authority: false,
  }, 'Process narration writer action', code);
  requireExactObject(definition.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    exact_release_citation_redirect: false,
  }, 'Process narration release treatment', code);
  requireExactObject(definition.import_treatment, {
    mode: 'WHOLE_RELEASE_ONLY',
    stable_id_preserved: true,
    revision_id_preserved: true,
  }, 'Process narration import treatment', code);
  requireExactObject(definition.trace_treatment, {
    terminal_type: 'PROCESS_NARRATION_REVISION',
    occurrence_id_required: true,
    revision_id_required: true,
    evidence_edges_required: true,
  }, 'Process narration trace treatment', code);
  requireExactObject(definition.exact_detail_treatment, {
    action_key: 'PROCESS_NARRATION_EVIDENCE',
    exact_evidence_only: true,
    preserve_release_identity: true,
  }, 'Process narration exact-detail treatment', code);
  requireExactObject(definition.consumer_projection_rule, {
    projection_type: 'ProcessPhrasebookPassageResult',
    terminal_type: 'PROCESS_NARRATION_REVISION',
    typed_state_required: true,
    release_identity_required: true,
    conflict_indicator_required: true,
    projection_definition_required_before_serving: true,
  }, 'Process narration consumer projection rule', code);
  requireExactObject(definition.type_contract, {
    source_local: true,
    event_composition_required_for_real_world_event: true,
    paragraph_boundary_defines_identity: false,
    continuation_and_retelling_are_relationships: true,
    later_retelling_deletes_source_narration: false,
    candidate_values_can_create_identity: false,
    unresolved_scope_blocks_publication: true,
  }, 'Process narration type contract', code);
}

function validateProcessEvent(member) {
  const code = 'INVALID_PROCESS_EVENT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process event logical type input', code);
  if (
    value.object_kind !== PROCESS_LOGICAL_TYPE_INPUT_KIND
    || value.stable_id !== 'PROCESS_EVENT'
    || value.schema_version !== PROCESS_LOGICAL_TYPE_INPUT_SCHEMA
    || value.definition?.logical_type !== 'ProcessEvent'
  ) {
    fail('UNREGISTERED_PROCESS_LOGICAL_TYPE', 'The Process event type is not registered.');
  }

  const definition = value.definition;
  requireExactKeys(definition, [
    'domain_key',
    'logical_type',
    'logical_type_version',
    'event_identity',
    'composition_contract',
    'granularity_contract',
    'revision_identity',
    'state_rules',
    'dimension_contract',
    'temporal_contract',
    'evidence_rules',
    'physical_carrier',
    'writer_action',
    'release_treatment',
    'import_treatment',
    'trace_treatment',
    'exact_detail_treatment',
    'authority_contract',
  ], 'Process event definition', code);
  if (
    definition.domain_key !== 'PROCESS'
    || definition.logical_type_version !== 1
  ) {
    fail(code, 'The Process event definition is outside its registered domain.');
  }

  requireExactObject(definition.event_identity, {
    stable_id_domain: 'PROCESS_EVENT/V1',
    stable_id_inputs: EVENT_IDENTITY_INPUTS,
    prohibited_inputs: EVENT_PROHIBITED_IDENTITY_INPUTS,
  }, 'Process event identity', code);
  requireExactObject(definition.composition_contract, {
    member_logical_type: 'ProcessNarrationOccurrence',
    member_definition_stable_id: 'PROCESS_NARRATION_OCCURRENCE',
    one_or_more_narrations_required: true,
    ordered_unique_member_ids_required: true,
    complete_member_universe_required_before_candidate_values: true,
    scope_stage_freeze_required: true,
    unresolved_member_universe_blocks_context: true,
    paragraph_boundary_defines_event: false,
    event_definition_required_before_result: true,
    expected_result_slot_required_before_materialisation: true,
  }, 'Process event composition contract', code);
  requireExactObject(definition.granularity_contract, {
    boundary_rule: 'SMALLEST_REAL_WORLD_OCCURRENCE_WITH_DISTINCT_PROCESS_QUESTION',
    continuous_multi_paragraph_meeting_is_one_event: true,
    same_date_implies_same_event: false,
    new_occasion_actor_proposal_response_or_decision_may_start_new_event: true,
    continuation_and_retelling_are_relationships: true,
    later_retelling_deletes_source_narration: false,
  }, 'Process event granularity contract', code);
  requireExactObject(definition.revision_identity, {
    revision_type: 'ProcessEventRevision',
    revision_id_domain: 'PROCESS_EVENT_REVISION/V1',
    immutable_inputs: [
      'claim_revision_ids',
      'event_definition_key_and_version',
      'event_state',
      'evidence_edges',
      'ordered_process_narration_occurrence_ids',
      'participant_relationship_revision_ids',
      'process_event_id',
      'process_relationship_revision_ids',
      'temporal_expression_revision_id',
    ],
  }, 'Process event revision identity', code);
  requireExactObject(definition.state_rules, {
    allowed_states: CANONICAL_STATES,
    value_rule_by_state: VALUE_RULE_BY_STATE,
  }, 'Process event state rules', code);
  requireExactObject(definition.dimension_contract, {
    required_dimensions_where_applicable: [
      'event_type_and_governed_family',
      'temporal_expression',
      'actor_counterparty_present_party_and_recipient',
      'participant_side_capacity_and_cardinality',
      'bidder_track',
      'deal_phase',
      'channel',
      'outcome_or_valence',
      'publicity',
      'cause_or_trigger',
      'agreement_type_and_document_stage',
      'linked_position_or_consideration_package',
      'process_relationships',
      'complete_evidence_and_derivation_lineage',
    ],
    unsupported_or_unclear_dimension_policy: 'PRESERVE_TYPED_STATE_NEVER_FABRICATE',
    unknown_event_type_has_runtime_path: false,
    event_type_registry_required_before_materialisation: true,
    participant_role_registry_required_before_materialisation: true,
  }, 'Process event dimension contract', code);
  requireExactObject(definition.temporal_contract, {
    consumed_shared_logical_type: 'TemporalExpression',
    shared_definition_stable_id: 'TEMPORAL_EXPRESSION',
    exact_stated_formulation_retained: true,
    computed_value_replaces_source_formulation: false,
    unresolved_temporal_state_permitted: true,
  }, 'Process event temporal contract', code);
  requireExactObject(definition.evidence_rules, {
    exact_evidence_required: true,
    all_member_narrations_required: true,
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    complete_scope_required_for_absent: true,
    event_grouping_evidence_required: true,
  }, 'Process event evidence rules', code);
  requireExactObject(definition.physical_carrier, {
    carrier_kind: 'CANDIDATE_RELEASE_RESULT_TABLE',
    carrier_name: 'process_event_results',
    release_partitioned: true,
    result_definition_required: true,
  }, 'Process event physical carrier', code);
  requireExactObject(definition.writer_action, {
    action_key: 'MATERIALISE_PROCESS_EVENT_RESULT',
    action_version: 1,
    candidate_only: true,
    current_release_writer_path: false,
    definition_grants_execution_authority: false,
  }, 'Process event writer action', code);
  requireExactObject(definition.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    complete_result_input_lineage_required: true,
  }, 'Process event release treatment', code);
  requireExactObject(definition.import_treatment, {
    mode: 'WHOLE_RELEASE_ONLY',
    stable_id_preserved: true,
    revision_id_preserved: true,
  }, 'Process event import treatment', code);
  requireExactObject(definition.trace_treatment, {
    terminal_type: 'PROCESS_EVENT_REVISION',
    event_id_required: true,
    revision_id_required: true,
    narration_lineage_required: true,
    evidence_edges_required: true,
  }, 'Process event trace treatment', code);
  requireExactObject(definition.exact_detail_treatment, {
    action_key: 'PROCESS_EVENT_EVIDENCE',
    exact_member_evidence_only: true,
    preserve_release_identity: true,
  }, 'Process event exact-detail treatment', code);
  requireExactObject(definition.authority_contract, {
    creates_runtime_event: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  }, 'Process event authority contract', code);
}

function validateProcessParticipant(member) {
  const code = 'INVALID_PROCESS_PARTICIPANT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process participant logical type input', code);
  if (
    value.object_kind !== PROCESS_LOGICAL_TYPE_INPUT_KIND
    || value.stable_id !== 'PROCESS_PARTICIPANT'
    || value.schema_version !== PROCESS_LOGICAL_TYPE_INPUT_SCHEMA
    || value.definition?.logical_type !== 'ProcessParticipant'
  ) {
    fail(
      'UNREGISTERED_PROCESS_LOGICAL_TYPE',
      'The Process participant type is not registered.',
    );
  }

  const definition = value.definition;
  requireExactKeys(definition, [
    'domain_key',
    'logical_type',
    'logical_type_version',
    'participant_identity',
    'event_binding_contract',
    'subject_binding_contract',
    'identity_state_contract',
    'event_role_contract',
    'shared_participant_contract',
    'revision_identity',
    'state_rules',
    'evidence_rules',
    'physical_carrier',
    'writer_action',
    'release_treatment',
    'import_treatment',
    'trace_treatment',
    'exact_detail_treatment',
    'authority_contract',
  ], 'Process participant definition', code);
  if (
    definition.domain_key !== 'PROCESS'
    || definition.logical_type_version !== 1
  ) {
    fail(code, 'The Process participant definition is outside its registered domain.');
  }

  requireExactObject(definition.participant_identity, {
    stable_id_domain: 'PROCESS_PARTICIPANT/V1',
    stable_id_inputs: PARTICIPANT_IDENTITY_INPUTS,
    prohibited_inputs: PARTICIPANT_PROHIBITED_IDENTITY_INPUTS,
  }, 'Process participant identity', code);
  requireExactObject(definition.event_binding_contract, {
    owner_logical_type: 'ProcessEvent',
    owner_definition_stable_id: 'PROCESS_EVENT',
    event_slot_frozen_before_candidate_values: true,
    participant_slot_frozen_before_candidate_values: true,
    one_event_required: true,
    one_or_more_participants_per_event_permitted: true,
    same_entity_multiple_event_roles_permitted: true,
  }, 'Process participant event binding', code);
  requireExactObject(definition.subject_binding_contract, {
    consumed_authority: 'SHARED_AUTHORITY',
    named_subject_logical_type: 'EntitySubject',
    named_subject_definition_stable_id: 'ENTITY_SUBJECT',
    source_local_subject_logical_type: 'EntityNameOccurrence',
    source_local_subject_definition_stable_id: 'ENTITY_NAME_OCCURRENCE',
    exactly_one_named_or_source_local_subject_required_when_present: true,
    governed_identity_bridge_only: true,
    identity_bridge_definition_stable_id: 'ENTITY_IDENTITY_BRIDGE',
    matching_date_and_economics_can_establish_identity: false,
    shared_fact_reauthoring_permitted: false,
  }, 'Process participant subject binding', code);
  requireExactObject(definition.identity_state_contract, {
    allowed_states: [
      'NAMED',
      'GOVERNED_BRIDGE_CONFIRMED',
      'SOURCE_LOCAL_ONLY',
      'CONFLICTING',
    ],
    conflicting_state_blocks_grouping_and_filtering: true,
    source_local_state_cross_deal_grouping_permitted: false,
    source_local_display_rule: 'SOURCE_LABEL_WITH_NOT_PUBLICLY_IDENTIFIED_QUALIFIER',
  }, 'Process participant identity states', code);
  requireExactObject(definition.event_role_contract, {
    typed_event_role_required_when_present: true,
    event_role_code_is_revision_value_not_identity: true,
    event_role_evidence_required: true,
    event_role_registry_required_before_materialisation: true,
    unknown_event_role_has_runtime_path: false,
    legal_or_transaction_role_infers_event_role: false,
    side_label_infers_event_role: false,
  }, 'Process participant event role contract', code);
  requireExactObject(definition.shared_participant_contract, {
    consumed_relationship_logical_type: 'DealParticipantRelationship',
    consumed_relationship_definition_stable_id: 'DEAL_PARTICIPANT_RELATIONSHIP',
    deal_participant_relationship_required_when_available: true,
    process_event_role_is_distinct_from_legal_and_transaction_roles: true,
    bidder_track_binding_required_when_role_or_identity_varies_by_track: true,
    bidder_track_definition_required_before_track_binding: true,
  }, 'Process shared participant contract', code);
  requireExactObject(definition.revision_identity, {
    revision_type: 'ProcessParticipantRevision',
    revision_id_domain: 'PROCESS_PARTICIPANT_REVISION/V1',
    immutable_inputs: [
      'bidder_track_id',
      'deal_participant_relationship_revision_id',
      'entity_identity_bridge_revision_id',
      'entity_subject_id',
      'event_role_code',
      'evidence_edges',
      'identity_state',
      'process_event_id',
      'process_participant_id',
      'revision_state',
      'source_local_subject_occurrence_id',
    ],
  }, 'Process participant revision identity', code);
  requireExactObject(definition.state_rules, {
    allowed_states: CANONICAL_STATES,
    value_rule_by_state: VALUE_RULE_BY_STATE,
  }, 'Process participant state rules', code);
  requireExactObject(definition.evidence_rules, {
    exact_evidence_required: true,
    event_role_evidence_separate_from_identity_bridge_evidence: true,
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    complete_scope_required_for_absent: true,
  }, 'Process participant evidence rules', code);
  requireExactObject(definition.physical_carrier, {
    carrier_kind: 'CANDIDATE_RELEASE_RELATIONSHIP_TABLE',
    carrier_name: 'process_event_participants',
    release_partitioned: true,
  }, 'Process participant physical carrier', code);
  requireExactObject(definition.writer_action, {
    action_key: 'ADMIT_PROCESS_EVENT_PARTICIPANT',
    action_version: 1,
    candidate_only: true,
    current_release_writer_path: false,
    definition_grants_execution_authority: false,
  }, 'Process participant writer action', code);
  requireExactObject(definition.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    event_and_subject_lineage_required: true,
  }, 'Process participant release treatment', code);
  requireExactObject(definition.import_treatment, {
    mode: 'WHOLE_RELEASE_ONLY',
    stable_id_preserved: true,
    revision_id_preserved: true,
  }, 'Process participant import treatment', code);
  requireExactObject(definition.trace_treatment, {
    terminal_type: 'PROCESS_PARTICIPANT_REVISION',
    participant_id_required: true,
    revision_id_required: true,
    event_id_required: true,
    subject_lineage_required: true,
    evidence_edges_required: true,
  }, 'Process participant trace treatment', code);
  requireExactObject(definition.exact_detail_treatment, {
    action_key: 'PROCESS_PARTICIPANT_EVIDENCE',
    event_role_evidence_only: true,
    identity_evidence_uses_own_action: true,
    preserve_release_identity: true,
  }, 'Process participant exact-detail treatment', code);
  requireExactObject(definition.authority_contract, {
    creates_runtime_participant: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  }, 'Process participant authority contract', code);
}

function validateNarrationSlot(member) {
  const code = 'INVALID_PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process expected occurrence slot input', code);
  if (
    value.object_kind !== PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND
    || value.stable_id !== 'PROCESS_NARRATION'
    || value.schema_version !== PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_SCHEMA
  ) {
    fail(
      'UNREGISTERED_PROCESS_EXPECTED_OCCURRENCE_SLOT',
      'The Process expected occurrence slot identity is not registered.',
    );
  }
  const definition = value.definition;
  requireExactKeys(definition, [
    'domain_key',
    'slot_key',
    'slot_version',
    'slot_schema',
    'owner_logical_type',
    'owner_definition_stable_id',
    'cardinality',
    'identity_inputs',
    'value_fields_excluded_from_identity',
    'owner_and_endpoint_permissions',
    'scope_and_freeze_contract',
    'authority_contract',
    'open_world_contract',
  ], 'Process narration expected slot definition', code);
  if (
    definition.domain_key !== 'PROCESS'
    || definition.slot_key !== 'PROCESS_NARRATION'
    || definition.slot_version !== 1
    || definition.slot_schema !== 'PROCESS_NARRATION_EXPECTED_OCCURRENCE_SLOT/V1'
    || definition.owner_logical_type !== 'ProcessNarrationOccurrence'
    || definition.owner_definition_stable_id !== 'PROCESS_NARRATION_OCCURRENCE'
    || definition.cardinality !== 'REPEATABLE'
  ) {
    fail(code, 'The Process narration expected slot identity is invalid.');
  }
  requireExactArray(
    definition.identity_inputs,
    OCCURRENCE_IDENTITY_INPUTS,
    'Process narration slot identity inputs',
    code,
  );
  requireExactArray(
    definition.value_fields_excluded_from_identity,
    VALUE_IDENTITY_INPUTS,
    'Process narration slot excluded value fields',
    code,
  );
  requireExactObject(definition.owner_and_endpoint_permissions, {
    claim_owner: true,
    relationship_endpoint: true,
    result_input_lineage: true,
  }, 'Process narration owner and endpoint permissions', code);
  requireExactObject(definition.scope_and_freeze_contract, {
    scope_stage_required: true,
    complete_member_universe_required_before_extraction: true,
    deterministic_ordinal_required: true,
    unresolved_member_universe_blocks_context: true,
    candidate_values_can_create_slot: false,
  }, 'Process narration scope and freeze contract', code);
  requireExactObject(definition.authority_contract, {
    creates_runtime_occurrence: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    current_release_writer_path: false,
  }, 'Process narration slot authority contract', code);
  requireExactObject(definition.open_world_contract, {
    new_semantic_or_slot_proposal_has_current_release_writer_path: false,
    successor_bundle_required: true,
    freeze_review_required: true,
    fresh_same_pair_slice_required: true,
  }, 'Process narration slot open-world contract', code);
}

function validateAuthoredProcessInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const processMembers = authoredMembers.filter(
    (member) => typeof member?.object_kind === 'string'
      && member.object_kind.startsWith('PROCESS_'),
  );
  if (processMembers.length === 0) return;

  const unknownKinds = processMembers
    .map((member) => member.object_kind)
    .filter((kind) => !PROCESS_INPUT_KINDS.includes(kind));
  if (unknownKinds.length > 0) {
    fail(
      'UNREGISTERED_PROCESS_CONTRACT_INPUT_KIND',
      'A Process authored input kind is not registered.',
      { object_kinds: [...new Set(unknownKinds)].sort() },
    );
  }

  const domainMembers = processMembers.filter(
    (member) => member.object_kind === PROCESS_DOMAIN_REGISTRY_INPUT_KIND,
  );
  const slotMembers = processMembers.filter(
    (member) => member.object_kind === PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND,
  );
  if (domainMembers.length !== 1 || slotMembers.length !== 1) {
    fail(
      'PROCESS_BASE_CONTRACT_CARDINALITY_MISMATCH',
      'The Process base contract requires one domain registry and one narration slot.',
      {
        domain_registry_count: domainMembers.length,
        narration_slot_count: slotMembers.length,
      },
    );
  }
  validateDomainRegistry(domainMembers[0]);
  validateNarrationSlot(slotMembers[0]);

  const logicalMembers = processMembers.filter(
    (member) => member.object_kind === PROCESS_LOGICAL_TYPE_INPUT_KIND,
  );
  const actualLogicalTypeIds = logicalMembers
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(actualLogicalTypeIds) !== canonicalJson(PROCESS_LOGICAL_TYPE_IDS)) {
    fail(
      'PROCESS_LOGICAL_TYPE_MEMBERSHIP_MISMATCH',
      'The Process logical type member set is incomplete, duplicated, or unregistered.',
      {
        actual_stable_ids: actualLogicalTypeIds,
        expected_stable_ids: PROCESS_LOGICAL_TYPE_IDS,
      },
    );
  }
  const logicalValidators = {
    PROCESS_EVENT: validateProcessEvent,
    PROCESS_NARRATION_OCCURRENCE: validateNarrationOccurrence,
    PROCESS_PARTICIPANT: validateProcessParticipant,
  };
  for (const member of logicalMembers) {
    logicalValidators[member.canonical_value.stable_id](member);
  }

  const narration = logicalMembers.find(
    (member) => member.canonical_value.stable_id === 'PROCESS_NARRATION_OCCURRENCE',
  ).canonical_value;
  const slot = slotMembers.find(
    (member) => member.object_kind === PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND,
  ).canonical_value;
  if (
    narration.definition.expected_occurrence_slot_key !== slot.stable_id
    || slot.definition.owner_definition_stable_id !== narration.stable_id
    || canonicalJson(narration.definition.occurrence_identity.stable_id_inputs)
      !== canonicalJson(slot.definition.identity_inputs)
  ) {
    fail(
      'PROCESS_NARRATION_SLOT_BINDING_MISMATCH',
      'The Process narration logical type and expected occurrence slot do not bind exactly.',
    );
  }
}

module.exports = {
  PROCESS_DOMAIN_REGISTRY_INPUT_KIND,
  PROCESS_DOMAIN_REGISTRY_INPUT_SCHEMA,
  PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND,
  PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_SCHEMA,
  PROCESS_LOGICAL_TYPE_IDS,
  PROCESS_LOGICAL_TYPE_INPUT_KIND,
  PROCESS_LOGICAL_TYPE_INPUT_SCHEMA,
  ProcessContractInputError,
  validateAuthoredProcessInputs,
};
