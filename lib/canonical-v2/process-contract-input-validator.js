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

  const validators = {
    [PROCESS_DOMAIN_REGISTRY_INPUT_KIND]: validateDomainRegistry,
    [PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT_KIND]: validateNarrationSlot,
    [PROCESS_LOGICAL_TYPE_INPUT_KIND]: validateNarrationOccurrence,
  };
  for (const kind of PROCESS_INPUT_KINDS) {
    const members = processMembers.filter((member) => member.object_kind === kind);
    if (members.length !== 1) {
      fail(
        'PROCESS_BASE_CONTRACT_CARDINALITY_MISMATCH',
        'The Process base contract requires exactly one member of each registered kind.',
        { object_kind: kind, actual_count: members.length },
      );
    }
    validators[kind](members[0]);
  }

  const narration = processMembers.find(
    (member) => member.object_kind === PROCESS_LOGICAL_TYPE_INPUT_KIND,
  ).canonical_value;
  const slot = processMembers.find(
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
  PROCESS_LOGICAL_TYPE_INPUT_KIND,
  PROCESS_LOGICAL_TYPE_INPUT_SCHEMA,
  ProcessContractInputError,
  validateAuthoredProcessInputs,
};
