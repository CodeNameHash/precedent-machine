const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const PROCESS_SERVING_CONTRACT_INPUT_KIND = 'SERVING_PROCESS_CONTRACT_INPUT';
const PROCESS_SERVING_CONTRACT_INPUT_SCHEMA = 'SERVING_PROCESS_CONTRACT_INPUT/V1';
const PROCESS_SERVING_CONTRACT_IDS = Object.freeze([
  'BOUNDED_INLINE_PASSAGE_PREVIEW',
  'PARENT_BOUND_PARAGRAPH_CONTEXT',
  'PROCESS_EXCLUSIVITY_EVENT_RESULT',
  'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  'RELATED_PASSAGE_CHILD_COLLECTION',
]);

class ProcessServingContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessServingContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessServingContractInputError(code, message, details);
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
  const code = 'INVALID_PROCESS_SERVING_CONTRACT_INPUT';
  const value = member.canonical_value;
  requireExactKeys(value, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Process serving contract input', code);
  if (
    value.object_kind !== PROCESS_SERVING_CONTRACT_INPUT_KIND
    || value.schema_version !== PROCESS_SERVING_CONTRACT_INPUT_SCHEMA
    || value.stable_id !== stableId
    || value.definition?.domain_key !== 'PROCESS'
    || value.definition?.contract_type !== contractType
    || value.definition?.contract_version !== 1
  ) {
    fail(code, 'The Process serving contract identity is not registered.');
  }
  return value.definition;
}

function requireNoAuthority(value, expectedRuntimeField, label, code) {
  requireExactObject(value, {
    [expectedRuntimeField]: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  }, label, code);
}

function validateExclusivityEventResult(member) {
  const code = 'INVALID_PROCESS_EXCLUSIVITY_EVENT_RESULT_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_EXCLUSIVITY_EVENT_RESULT',
    'RESULT_DEFINITION',
  );
  const expectedDigest =
    'ae0d567ab67be4ae5064f984b6be3e81175db79136da56be70033fa51cc05b6a';
  let actualDigest;
  try {
    actualDigest = sha256Hex(Buffer.from(canonicalJson(definition), 'utf8'));
  } catch (error) {
    fail(code, 'The Process exclusivity event result is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== expectedDigest) {
    fail(
      code,
      'The Process exclusivity event result does not match its complete governed definition.',
      {
        expected_definition_digest: expectedDigest,
        actual_definition_digest: actualDigest,
      },
    );
  }
}

function validatePhrasebookResult(member) {
  const code = 'INVALID_PROCESS_PHRASEBOOK_RESULT_INPUT';
  const definition = validateEnvelope(
    member,
    'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
    'RESULT_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'result_contract',
    'occurrence_identity',
    'lineage_contract',
    'preview_contract',
    'ordering_contract',
    'release_treatment',
    'authority_contract',
  ], 'Process phrasebook result definition', code);
  requireExactObject(definition.result_contract, {
    logical_type: 'ProcessPhrasebookPassageResult',
    output_grain: 'RESULT',
    parent_kind: 'RESULT_ROW',
    one_occurrence_per_admitted_predicate_witness_narration: true,
    claim_or_application_join_can_mint_result: false,
    result_definition_required_before_materialisation: true,
  }, 'Process phrasebook result contract', code);
  requireExactObject(definition.occurrence_identity, {
    stable_id_domain: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT/V1',
    stable_id_inputs: [
      'frozen_contract_pair_digest',
      'governed_deal_admission_id',
      'precomputed_process_narration_occurrence_id',
      'exact_evidence_role_slot_key',
      'governed_ordinal',
    ],
    prohibited_inputs: [
      'application_join_order',
      'candidate_values',
      'display_text',
      'model_output',
      'query_text',
      'selected_revision_id',
    ],
    ordinal_comparator: 'CANONICAL_SOURCE_INTERVAL_COMPARATOR/V1',
    expected_result_slot_required_before_materialisation: true,
  }, 'Process phrasebook result identity', code);
  requireExactObject(definition.lineage_contract, {
    required_terminal_types: [
      'PROCESS_NARRATION_REVISION',
      'PREDICATE_WITNESS_REVISION',
    ],
    selected_narration_required: true,
    predicate_witness_required: true,
    complete_result_input_lineage_required: true,
    source_local_narration_identity_required: true,
    retelling_relationship_retained: true,
  }, 'Process phrasebook result lineage', code);
  requireExactObject(definition.preview_contract, {
    definition_stable_id: 'BOUNDED_INLINE_PASSAGE_PREVIEW',
    matched_passage_preview_required: true,
    inline_with_result_row: true,
    one_detail_request_per_visible_passage_permitted: false,
  }, 'Process phrasebook preview binding', code);
  requireExactObject(definition.ordering_contract, {
    total_comparator: [
      'DIRECT_PREDICATE_WITNESS_BEFORE_CONTEXTUAL_OR_RETOLD_EVIDENCE',
      'SOURCE_LOCAL_PRIMARY_NARRATION_BEFORE_LATER_RETELLING',
      'GOVERNED_SOURCE_ORDER',
    ],
    diversification_applies_after_total_comparator: true,
    diversification_keys: [
      'governed_deal_admission_id',
      'bidder_track_id',
    ],
    application_memory_can_recreate_ranking_authority: false,
  }, 'Process phrasebook ordering', code);
  requireExactObject(definition.release_treatment, {
    candidate_membership_required: true,
    release_pinned: true,
    immutable_after_release: true,
    exact_release_citation_redirect: false,
  }, 'Process phrasebook release treatment', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_result',
    'Process phrasebook result authority',
    code,
  );
}

function validateInlinePreview(member) {
  const code = 'INVALID_PROCESS_INLINE_PREVIEW_INPUT';
  const definition = validateEnvelope(
    member,
    'BOUNDED_INLINE_PASSAGE_PREVIEW',
    'INLINE_PREVIEW_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'parent_contract',
    'preview_contract',
    'delivery_contract',
    'trace_contract',
    'authority_contract',
  ], 'Process inline preview definition', code);
  requireExactObject(definition.parent_contract, {
    parent_definition_stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
    parent_kind: 'RESULT_ROW',
    exactly_one_parent_required: true,
    parent_release_identity_required: true,
  }, 'Process inline preview parent contract', code);
  requireExactObject(definition.preview_contract, {
    field_name: 'matched_passage_preview',
    content_mode: 'VERBATIM_CANONICAL_TEXT',
    maximum_utf8_bytes: 8192,
    exact_ordered_source_interval_set_required: true,
    source_interval_order_must_match_parent: true,
    multi_interval_flattening_permitted: false,
    canonical_text_digest_required: true,
    evidence_role_required: true,
    source_local_narration_id_required: true,
    exact_detail_reference_required: true,
    truncation_state_required: true,
    source_text_rewrite_permitted: false,
  }, 'Process inline preview contract', code);
  requireExactObject(definition.delivery_contract, {
    delivered_with_parent_row: true,
    separate_detail_request_required: false,
    one_preview_per_result: true,
    malformed_preview_blocks_parent_only: true,
    valid_sibling_rows_remain_publishable: true,
  }, 'Process inline preview delivery', code);
  requireExactObject(definition.trace_contract, {
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    source_revision_id_required: true,
    segmentation_projection_id_required: true,
    release_identity_required: true,
  }, 'Process inline preview trace', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_preview',
    'Process inline preview authority',
    code,
  );
}

function validateParagraphContext(member) {
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT';
  const definition = validateEnvelope(
    member,
    'PARENT_BOUND_PARAGRAPH_CONTEXT',
    'EXACT_DETAIL_ACTION_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'action_contract',
    'segmentation_contract',
    'expansion_contract',
    'cursor_contract',
    'failure_contract',
    'authority_contract',
  ], 'Process paragraph context definition', code);
  requireExactObject(definition.action_contract, {
    action_key: 'PROCESS_PARAGRAPH_CONTEXT',
    action_version: 1,
    parent_definition_stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
    parent_kind: 'RESULT_ROW',
    response_schema: 'PROCESS_PARAGRAPH_CONTEXT_RESPONSE/V1',
    route: 'BOUNDED_PARENT_DETAIL',
    object_level_authorisation_required: true,
  }, 'Process paragraph context action', code);
  requireExactObject(definition.segmentation_contract, {
    projection_kind: 'VERSIONED_CANONICAL_TEXT_PARAGRAPH_PROJECTION',
    projection_identity_required: true,
    source_map_lineage_required: true,
    browser_whitespace_can_define_paragraph: false,
    unversioned_string_split_permitted: false,
  }, 'Process paragraph segmentation', code);
  requireExactObject(definition.expansion_contract, {
    directions: ['ABOVE', 'BELOW'],
    paragraphs_per_request: 1,
    maximum_paragraphs_per_direction: 12,
    repeat_click_permitted: true,
    selected_evidence_remains_highlighted: true,
    selected_evidence_remains_visible: true,
  }, 'Process paragraph expansion', code);
  requireExactObject(definition.cursor_contract, {
    cursor_kind: 'OPAQUE_SERVER_ISSUED_PARENT_BOUND_CURSOR',
    caller_input_fields: [
      'direction',
      'opaque_cursor',
      'parent_result_id',
    ],
    maximum_encoded_bytes: 2048,
    server_derives_every_paragraph_ordinal: true,
    caller_byte_offset_permitted: false,
    caller_paragraph_ordinal_permitted: false,
    caller_maximum_context_permitted: false,
    cursor_binds_parent_release_projection_and_boundary: true,
  }, 'Process paragraph context cursor', code);
  requireExactObject(definition.failure_contract, {
    invalid_cursor_fails_request_only: true,
    valid_sibling_rows_remain_available: true,
    whole_document_permission: false,
  }, 'Process paragraph context failure treatment', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_context',
    'Process paragraph context authority',
    code,
  );
}

function validateRelatedPassages(member) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_INPUT';
  const definition = validateEnvelope(
    member,
    'RELATED_PASSAGE_CHILD_COLLECTION',
    'CHILD_COLLECTION_DEFINITION',
  );
  requireExactKeys(definition, [
    'domain_key',
    'contract_type',
    'contract_version',
    'action_contract',
    'parent_contract',
    'collection_contract',
    'child_contract',
    'failure_contract',
    'authority_contract',
  ], 'Process related-passage definition', code);
  requireExactObject(definition.action_contract, {
    action_key: 'PROCESS_RELATED_PASSAGES',
    action_version: 1,
    response_schema: 'PROCESS_RELATED_PASSAGES_RESPONSE/V1',
    route: 'BOUNDED_PARENT_CHILD_COLLECTION',
    object_level_authorisation_required: true,
  }, 'Process related-passage action', code);
  requireExactObject(definition.parent_contract, {
    parent_definition_stable_id: 'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
    parent_kind: 'RESULT_ROW',
    exactly_one_parent_required: true,
    same_source_document_required: true,
    parent_release_identity_required: true,
  }, 'Process related-passage parent', code);
  requireExactObject(definition.collection_contract, {
    collection_key: 'PROCESS_RELATED_PASSAGES',
    maximum_children: 12,
    precomputed_release_projection_required: true,
    application_side_graph_traversal_permitted: false,
    deterministic_order_required: true,
    duplicate_child_result_ids_permitted: false,
  }, 'Process related-passage collection', code);
  requireExactObject(definition.child_contract, {
    required_fields: [
      'exact_detail_reference',
      'relationship_definition_key_and_version',
      'relationship_label',
      'related_result_id',
      'verbatim_passage_preview',
    ],
    typed_relationship_label_required: true,
    verbatim_preview_definition_stable_id: 'BOUNDED_INLINE_PASSAGE_PREVIEW',
    exact_detail_reference_required: true,
    classification_is_secondary: true,
    classification_can_replace_actual_drafting: false,
  }, 'Process related-passage child', code);
  requireExactObject(definition.failure_contract, {
    malformed_child_isolated: true,
    malformed_child_can_remove_valid_siblings: false,
    unresolved_relationship_is_publishable_as_related: false,
  }, 'Process related-passage failure treatment', code);
  requireNoAuthority(
    definition.authority_contract,
    'creates_runtime_relationship',
    'Process related-passage authority',
    code,
  );
}

function validateAuthoredProcessServingInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === PROCESS_SERVING_CONTRACT_INPUT_KIND,
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  requireExactArray(
    stableIds,
    PROCESS_SERVING_CONTRACT_IDS,
    'Process serving contract member set',
    'PROCESS_SERVING_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const validators = {
    BOUNDED_INLINE_PASSAGE_PREVIEW: validateInlinePreview,
    PARENT_BOUND_PARAGRAPH_CONTEXT: validateParagraphContext,
    PROCESS_EXCLUSIVITY_EVENT_RESULT: validateExclusivityEventResult,
    PROCESS_PHRASEBOOK_PASSAGE_RESULT: validatePhrasebookResult,
    RELATED_PASSAGE_CHILD_COLLECTION: validateRelatedPassages,
  };
  for (const member of members) {
    validators[member.canonical_value.stable_id](member);
  }
}

module.exports = {
  PROCESS_SERVING_CONTRACT_IDS,
  PROCESS_SERVING_CONTRACT_INPUT_KIND,
  PROCESS_SERVING_CONTRACT_INPUT_SCHEMA,
  ProcessServingContractInputError,
  validateAuthoredProcessServingInputs,
};
