const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProductQueryResultInputs,
} = require(
  '../lib/canonical-v2/product-query-result-contract-input-validator',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const CONTRACT_PATH = path.join(
  ROOT,
  'product/query/product-query-result-definition.v1.json',
);
const PROCESS_ADAPTER_PATH = path.join(
  ROOT,
  'product/query/process-phrasebook-product-result-adapter.v1.json',
);
const PROCESS_RESULT_SET_ADAPTER_PATH = path.join(
  ROOT,
  'product/query/process-phrasebook-product-result-set-adapter.v1.json',
);
const QXO_F28_ADAPTER_PATH = path.join(
  ROOT,
  'product/query/qxo-capitalisation-f28-product-result-adapter.v1.json',
);

function loadPath(filePath) {
  const canonicalValue = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function loadMember() {
  return loadPath(CONTRACT_PATH);
}

function loadProcessAdapter() {
  return loadPath(PROCESS_ADAPTER_PATH);
}

function loadProcessResultSetAdapter() {
  return loadPath(PROCESS_RESULT_SET_ADAPTER_PATH);
}

function loadQxoF28Adapter() {
  return loadPath(QXO_F28_ADAPTER_PATH);
}

function loadMembers() {
  return [
    loadProcessAdapter(),
    loadMember(),
    loadProcessResultSetAdapter(),
    loadQxoF28Adapter(),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers the closed Product result and domain adapter set', () => {
  const member = loadMember();
  assert.doesNotThrow(
    () => validateAuthoredProductQueryResultInputs(loadMembers()),
  );
  assert.equal(
    member.canonical_value.stable_id,
    'PRODUCT_QUERY_RESULT_DEFINITION',
  );
  assert.equal(
    member.canonical_value.definition.result_contract.schema_version,
    'PRODUCT_QUERY_RESULT/V1',
  );
  assert.equal(
    member.canonical_value.definition.result_contract.parent_kind,
    'PRODUCT_QUERY_IR',
  );
});

test('governs the QXO F28 fourteen-metric Product adapter', () => {
  const definition = loadQxoF28Adapter().canonical_value.definition;
  assert.equal(
    definition.source_contract.source_result_definition_version,
    3,
  );
  assert.equal(
    definition.source_contract.required_market_metric_slot_count,
    14,
  );
  assert.equal(
    definition.source_contract.generic_no_market_data_permitted,
    false,
  );
  assert.equal(
    definition.cross_view_contract.generic_no_market_data_authority,
    'FORBIDDEN',
  );
  assert.equal(
    definition.payload_mapping.all_fourteen_metric_contexts_preserved,
    true,
  );
});

test('requires every valid result-set member to retain and revalidate its complete sidecar', () => {
  const definition =
    loadProcessResultSetAdapter().canonical_value.definition;
  const member = definition.valid_member_contract;

  assert.equal(
    definition.target_contract.single_result_adapter_stable_id,
    'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER',
  );
  assert.equal(
    definition.target_contract.product_result_set_compiler,
    'compileProductQueryResultSet',
  );
  assert.deepEqual(member.required_member_fields, [
    'single_result_adapter_input',
    'single_result_adapter_receipt',
  ]);
  assert.equal(member.full_original_single_result_adapter_input_required, true);
  assert.equal(member.full_single_result_adapter_receipt_required, true);
  assert.equal(
    member.single_result_bridge_revalidation_function,
    'validateProcessPhrasebookSharedRowBridgeReceipt',
  );
  assert.equal(member.single_result_bridge_revalidation_required, true);
  assert.equal(
    member.caller_validated_boolean_or_digest_substitution_permitted,
    false,
  );
  assert.equal(member.one_valid_member_per_product_result_identity_required, true);
  assert.equal(member.one_product_valid_slot_per_valid_member_required, true);
  assert.equal(member.duplicate_sidecar_or_product_result_identity_permitted, false);
});

test('accepts only externally checked typed failures and reconciles every slot once', () => {
  const definition =
    loadProcessResultSetAdapter().canonical_value.definition;
  const failure = definition.failure_contract;
  const resultSet = definition.product_result_set_contract;

  assert.equal(failure.failure_schema_version, 'PRODUCT_RESULT_SLOT_FAILURE/V1');
  assert.equal(
    failure.failure_source,
    'EXTERNAL_CHECKED_PRODUCT_RESULT_SLOT_FAILURES',
  );
  assert.equal(
    failure.failure_validation_function,
    'validateProductResultSlotFailure',
  );
  assert.equal(failure.full_failure_value_required, true);
  assert.equal(failure.bridge_can_invent_reclassify_rewrite_or_drop_failure, false);
  assert.equal(failure.valid_sidecar_can_replace_failure, false);
  assert.equal(failure.failure_can_replace_valid_sidecar, false);
  assert.equal(
    resultSet.ordered_valid_slots_reconcile_one_to_one_with_valid_sidecars,
    true,
  );
  assert.equal(
    resultSet.ordered_failed_slots_reconcile_one_to_one_with_external_failures,
    true,
  );
  assert.equal(resultSet.valid_failed_excluded_and_total_counts_reconcile, true);
});

test('leaves order, coverage, bounds and final output with their signed owners', () => {
  const definition =
    loadProcessResultSetAdapter().canonical_value.definition;
  const ordering = definition.ordering_contract;
  const bounds = definition.bounds_and_presentation_contract;

  assert.equal(
    ordering.ordering_authority,
    'PROCESS_PASSAGE_ORDERING_PROJECTION',
  );
  assert.equal(
    ordering.ordering_projection_schema_version,
    'PROCESS_PASSAGE_ORDERING_PROJECTION/V1',
  );
  assert.equal(
    ordering.product_ordering_receipt_schema_version,
    'PRODUCT_QUERY_RESULT_ORDERING_RECEIPT/V1',
  );
  assert.equal(ordering.complete_candidate_partition_required, true);
  assert.equal(ordering.product_result_set_compiler_owns_final_slots_and_summary, true);
  assert.equal(
    ordering.bridge_can_rank_rerank_diversify_reorder_exclude_or_append,
    false,
  );
  assert.equal(
    definition.coverage_contract.full_external_coverage_certification_required,
    true,
  );
  assert.equal(bounds.page_size_source, 'PRODUCT_QUERY_IR');
  assert.equal(
    bounds.first_page_eight_to_twelve_rule_owner,
    'PRODUCT_RESULT_PRESENTATION_DEFINITION',
  );
  assert.equal(bounds.bridge_can_pad_repeat_or_manufacture_minimum_result_count, false);
  assert.equal(bounds.fewer_than_eight_available_results_returns_all_available_results, true);
});

test('authorises one pure handoff into the existing Product presentation compiler', () => {
  const handoff =
    loadProcessResultSetAdapter().canonical_value.definition
      .presentation_handoff_contract;

  assert.equal(
    handoff.handoff_function,
    'compileProcessPhrasebookProductResultPresentation',
  );
  assert.equal(
    handoff.presentation_compiler,
    'compileProductResultPresentation',
  );
  assert.equal(
    handoff.presentation_schema_version,
    'PRODUCT_RESULT_PRESENTATION/V1',
  );
  assert.deepEqual(handoff.required_handoff_input_fields, [
    'validated_result_set_adapter_receipt',
    'product_query_ir',
    'product_field_catalogue_manifest',
    'understood_legal_question',
  ]);
  assert.equal(handoff.result_set_adapter_receipt_validation_required, true);
  assert.equal(handoff.product_query_ir_must_equal_receipt_query_ir, true);
  assert.deepEqual(handoff.presentation_compiler_input_mapping, {
    understood_legal_question: 'understood_legal_question',
    product_query_ir: 'product_query_ir',
    product_field_catalogue_manifest: 'product_field_catalogue_manifest',
    ordered_result_slots:
      'validated_result_set_adapter_receipt.product_result_set.ordered_result_slots',
    query_execution_summary:
      'validated_result_set_adapter_receipt.product_result_set.query_execution_summary',
  });
  assert.deepEqual(
    handoff.only_result_set_values_passed_from_receipt_to_presentation_compiler,
    ['ordered_result_slots', 'query_execution_summary'],
  );
  assert.deepEqual(handoff.handoff_output_fields, [
    'product_result_presentation',
    'result_set_adapter_receipt',
  ]);
  assert.equal(
    handoff.full_process_sidecars_remain_in_result_set_adapter_receipt,
    true,
  );
  assert.equal(
    handoff.process_sidecars_are_not_passed_into_product_presentation_compiler,
    true,
  );
  assert.equal(
    handoff.handoff_creates_new_presentation_identity_or_receipt,
    false,
  );
  assert.equal(
    handoff.handoff_can_query_read_source_reorder_filter_or_rebuild_results,
    false,
  );
  assert.equal(
    handoff.handoff_can_create_result_source_or_presentation_architecture,
    false,
  );
});

test('binds complete lineage, failures, authority inputs and exact Product output into one receipt', () => {
  const carrier =
    loadProcessResultSetAdapter().canonical_value.definition
      .validation_carrier_contract;

  assert.equal(
    carrier.schema_version,
    'PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_RECEIPT/V1',
  );
  assert.deepEqual(carrier.required_fields, [
    'schema_version',
    'result_set_adapter_receipt_id',
    'valid_adapter_members',
    'external_failed_slots',
    'product_result_set_authority_inputs',
    'product_result_set',
    'adapter_state',
    'authority_state',
  ]);
  assert.deepEqual(carrier.identity_inputs, [
    'valid_adapter_members',
    'external_failed_slots',
    'product_result_set_authority_inputs',
    'product_result_set',
  ]);
  assert.equal(
    carrier.valid_adapter_members_retain_full_original_input_and_full_receipt,
    true,
  );
  assert.equal(
    carrier.product_result_set_authority_inputs_retain_full_query_projection_ordering_and_coverage_values,
    true,
  );
  assert.equal(carrier.product_result_set_retains_exact_compiler_output, true);
  assert.equal(
    carrier.receipt_identity_binds_all_sidecars_failures_order_query_release_coverage_and_output,
    true,
  );
  assert.equal(
    carrier.digest_only_substitution_that_loses_lineage_or_authority_input_permitted,
    false,
  );
  assert.equal(carrier.adapter_state, 'VALIDATED_NOT_MATERIALISED');
  assert.equal(carrier.authority_state, 'NOT_GRANTED');
  assert.equal(carrier.carrier_is_product_result_set, false);
  assert.equal(carrier.carrier_is_serving_payload, false);
});

test('maps one admitted Process phrasebook passage into the existing Product result boundary', () => {
  const definition = loadProcessAdapter().canonical_value.definition;

  assert.equal(
    definition.target_contract.product_result_definition_stable_id,
    'PRODUCT_QUERY_RESULT_DEFINITION',
  );
  assert.equal(
    definition.target_contract.product_result_schema_version,
    'PRODUCT_QUERY_RESULT/V1',
  );
  assert.equal(
    definition.target_contract.process_result_definition_stable_id,
    'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  );
  assert.equal(definition.target_contract.creates_new_result_architecture, false);
  assert.equal(
    definition.identity_mapping.source_field,
    'process_admission_input.result_identity.process_phrasebook_passage_result_id',
  );
  assert.equal(
    definition.identity_mapping.target_field,
    'domain_result.domain_result_identity',
  );
  assert.equal(definition.identity_mapping.exact_equality_required, true);
  assert.equal(
    definition.payload_mapping.source_field,
    'process_admission_input.matched_passage_preview.verbatim_text',
  );
  assert.equal(definition.payload_mapping.representation_kind, 'VERBATIM_TEXT');
  assert.equal(definition.payload_mapping.exact_verbatim_bytes_required, true);
  assert.equal(
    definition.payload_mapping.product_payload_digest_derivation,
    'SHA256_CANONICAL_JSON_STRING_UTF8',
  );
  assert.equal(
    definition.payload_mapping.raw_utf8_digest_remains_bound_in_process_receipt,
    true,
  );
  assert.equal(
    definition.payload_mapping.product_payload_digest_can_replace_raw_utf8_digest,
    false,
  );
});

test('retains the exact Process receipt as the authoritative lineage and release proof', () => {
  const carrier =
    loadProcessAdapter().canonical_value.definition.validation_carrier_contract;

  assert.equal(
    carrier.schema_version,
    'PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_RECEIPT/V1',
  );
  assert.deepEqual(carrier.required_fields, [
    'schema_version',
    'adapter_receipt_id',
    'process_admission_receipt',
    'product_query_result',
    'adapter_state',
    'authority_state',
  ]);
  assert.deepEqual(carrier.identity_inputs, [
    'process_admission_receipt',
    'product_query_result',
  ]);
  assert.equal(
    carrier.authoritative_source_receipt_schema_version,
    'PROCESS_PHRASEBOOK_RESULT_ADMISSION_RECEIPT/V1',
  );
  assert.equal(carrier.full_process_admission_receipt_required, true);
  assert.equal(carrier.full_product_query_result_required, true);
  assert.equal(
    carrier.process_receipt_id_and_canonical_bytes_participate_in_carrier_identity,
    true,
  );
  assert.equal(
    carrier.product_domain_validation_must_bind_exact_process_receipt,
    true,
  );
  assert.equal(
    carrier.digest_only_substitution_that_loses_process_lineage_permitted,
    false,
  );
  assert.equal(
    carrier.process_receipt_remains_authoritative_for_lineage_and_release_validation,
    true,
  );
  assert.equal(carrier.adapter_state, 'VALIDATED_NOT_MATERIALISED');
  assert.equal(carrier.authority_state, 'NOT_GRANTED');
  assert.equal(carrier.carrier_is_product_result, false);
  assert.equal(carrier.carrier_is_serving_payload, false);
});

test('maps exact source evidence and keeps selected-source and context actions distinct', () => {
  const definition = loadProcessAdapter().canonical_value.definition;
  const citation = definition.citation_mapping;
  const actions = definition.action_mapping;

  assert.equal(
    citation.source_document_identity_source,
    'process_admission_input.matched_passage_preview.source_document_identity',
  );
  assert.equal(
    citation.source_evidence_identity_source,
    'process_admission_input.matched_passage_preview.preview_id',
  );
  assert.equal(
    citation.source_interval_set_source,
    'process_admission_input.matched_passage_preview.exact_ordered_source_interval_set',
  );
  assert.equal(citation.source_interval_order_preserved, true);
  assert.equal(citation.multi_interval_flattening_permitted, false);
  assert.equal(
    citation.human_readable_source_label_source,
    'process_admission_input.exact_detail_reference.human_readable_source_label',
  );
  assert.equal(
    citation.exact_source_document_evidence_interval_digest_and_label_required,
    true,
  );
  assert.deepEqual(actions.selected_source_action, {
    stable_id: 'PROCESS_NARRATION_EVIDENCE',
    version: 1,
  });
  assert.deepEqual(actions.context_action, {
    stable_id: 'PARENT_BOUND_PARAGRAPH_CONTEXT',
    version: 1,
  });
  assert.equal(actions.selected_source_and_context_actions_are_distinct, true);
  assert.equal(
    actions.context_action_requires_separate_product_source_reader_admission,
    true,
  );
});

test('leaves ordering, fields and Product admission with their existing owners', () => {
  const definition = loadProcessAdapter().canonical_value.definition;

  assert.equal(
    definition.ordering_contract.ordering_authority,
    'PROCESS_PASSAGE_ORDERING_PROJECTION',
  );
  assert.equal(
    definition.ordering_contract.product_result_set_compiler_preserves_governed_order,
    true,
  );
  assert.equal(
    definition.ordering_contract.adapter_can_rank_rerank_diversify_or_recalculate_order,
    false,
  );
  assert.equal(
    definition.external_input_contract.requested_product_fields_source,
    'EXTERNAL_CHECKED_PRODUCT_FIELD_PROJECTION',
  );
  assert.equal(
    definition.external_input_contract.product_query_result_admission_source,
    'PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1',
  );
  assert.equal(
    definition.external_input_contract.adapter_can_create_product_query_result_admission_receipt,
    false,
  );
  assert.equal(
    Object.values(definition.prohibited_state_contract)
      .every((value) => value === false),
    true,
  );
});

test('preserves domain meaning and adds later CVR through registry data', () => {
  const domain = loadMember().canonical_value.definition.domain_contract;

  assert.deepEqual(domain.initial_required_domains, [
    'AGREEMENT',
    'PROCESS',
  ]);
  assert.equal(domain.selected_domain_must_match_product_query_ir, true);
  assert.equal(
    domain
      .domain_result_identity_must_pass_its_release_admitted_domain_validator,
    true,
  );
  assert.equal(
    domain.product_wrapper_can_weaken_domain_evidence_or_lineage,
    false,
  );
  assert.equal(
    domain.product_wrapper_can_relabel_domain_legal_meaning,
    false,
  );
  assert.equal(domain.future_domain_admission_is_registry_driven, true);
  assert.equal(
    domain.future_cvr_domain_requires_no_product_compiler_code_change,
    true,
  );
});

test('binds one exact Product Query IR, release and domain result', () => {
  const definition = loadMember().canonical_value.definition;

  assert.equal(
    definition.query_binding_contract.query_ir_definition_stable_id,
    'PRODUCT_QUERY_IR',
  );
  assert.equal(
    definition.query_binding_contract.query_ir_schema_version,
    'PRODUCT_QUERY_IR/V1',
  );
  assert.equal(
    definition.query_binding_contract.exact_query_definition_id_required,
    true,
  );
  assert.equal(
    definition.release_contract
      .exact_candidate_release_manifest_payload_digest_required,
    true,
  );
  assert.equal(
    definition.release_contract.domain_result_candidate_membership_required,
    true,
  );
  assert.equal(
    definition.identity_contract.required_identity_inputs
      .includes('domain_result_identity'),
    true,
  );
  assert.equal(
    definition.identity_contract.prohibited_identity_inputs
      .includes('source_entry_mode'),
    true,
  );
});

test('keeps citations and share links on the exact released result', () => {
  const definition = loadMember().canonical_value.definition;
  const citation = definition.citation_and_action_contract;

  assert.equal(citation.exact_release_pinned_citation_required, true);
  assert.equal(citation.exact_parent_product_result_identity_required, true);
  assert.equal(citation.exact_domain_result_identity_required, true);
  assert.equal(citation.exact_source_document_and_evidence_identity_required, true);
  assert.equal(citation.query_admitted_exact_detail_action_required, true);
  assert.equal(citation.citation_can_rewrite_or_summarise_source_text, false);
  assert.equal(citation.silent_share_redirect_permitted, false);
  assert.equal(citation.inactive_share_disposition, 'RELEASE_NOT_ACTIVE');
});

test('uses one result identity in answer, table, export and share views', () => {
  const definition = loadMember().canonical_value.definition;

  assert.equal(
    definition.identity_contract
      .passage_table_export_and_share_views_preserve_product_result_identity,
    true,
  );
  assert.equal(
    definition.view_and_export_contract
      .passage_and_table_views_use_same_result_rows,
    true,
  );
  assert.equal(
    definition.view_and_export_contract
      .selected_export_is_exact_result_identity_subset,
    true,
  );
  assert.equal(
    definition.view_and_export_contract
      .copy_passage_requires_exact_verbatim_text_and_citation,
    true,
  );
  assert.equal(
    definition.view_and_export_contract.generated_narrative_output_in_first_product,
    false,
  );
});

test('keeps zero results honest and isolates one invalid result', () => {
  const definition = loadMember().canonical_value.definition;

  assert.equal(
    definition.coverage_and_empty_contract.zero_result_disposition,
    'NO_RESULTS_IN_COVERED_DEALS',
  );
  assert.equal(
    definition.coverage_and_empty_contract
      .zero_results_can_claim_market_absence,
    false,
  );
  assert.equal(
    definition.coverage_and_empty_contract
      .operational_failure_can_render_as_zero_results,
    false,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .invalid_domain_result_fails_only_that_result,
    true,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .invalid_domain_result_retained_as_typed_failure,
    true,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .invalid_domain_result_can_be_silently_omitted,
    false,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .invalid_domain_result_can_be_replaced_by_valid_sibling,
    false,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .result_count_reconciles_valid_failed_and_excluded_slots,
    true,
  );
  assert.equal(
    definition.ordering_and_failure_contract
      .valid_sibling_results_remain_publishable,
    true,
  );
});

test('rejects missing, duplicate and semantically changed definitions', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductQueryResultInputs([]),
  );
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([
      ...loadMembers(),
      clone(loadProcessAdapter()),
    ]),
    { code: 'PRODUCT_QUERY_RESULT_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changed = loadMembers();
  changed[1].canonical_value.definition.release_contract
    .silent_redirect_or_result_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changed),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
  );

  const changedAdapter = loadMembers();
  changedAdapter[0].canonical_value.definition.validation_carrier_contract
    .digest_only_substitution_that_loses_process_lineage_permitted = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changedAdapter),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_INPUT',
    },
  );

  const replacedSourceDigest = loadMembers();
  replacedSourceDigest[0].canonical_value.definition.payload_mapping
    .product_payload_digest_can_replace_raw_utf8_digest = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(replacedSourceDigest),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_INPUT',
    },
  );

  const changedAction = loadMembers();
  changedAction[0].canonical_value.definition.action_mapping
    .context_action = {
      stable_id: 'PROCESS_NARRATION_EVIDENCE',
      version: 1,
    };
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changedAction),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_ADAPTER_INPUT',
    },
  );

  const changedResult = loadMember();
  changedResult.canonical_value.definition.release_contract
    .silent_redirect_or_result_substitution_permitted = true;
  const changedResultMembers = loadMembers();
  changedResultMembers[1] = changedResult;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changedResultMembers),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
  );

  const changedResultSetAdapter = loadMembers();
  changedResultSetAdapter[2].canonical_value.definition.ordering_contract
    .bridge_can_rank_rerank_diversify_reorder_exclude_or_append = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(
      changedResultSetAdapter,
    ),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_INPUT',
    },
  );

  const weakenedLineage = loadMembers();
  weakenedLineage[2].canonical_value.definition.validation_carrier_contract
    .digest_only_substitution_that_loses_lineage_or_authority_input_permitted =
      true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(weakenedLineage),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_INPUT',
    },
  );

  const expandedHandoff = loadMembers();
  expandedHandoff[2].canonical_value.definition.presentation_handoff_contract
    .handoff_creates_new_presentation_identity_or_receipt = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(expandedHandoff),
    {
      code:
        'INVALID_PROCESS_PHRASEBOOK_PRODUCT_RESULT_SET_ADAPTER_INPUT',
    },
  );

  const nested = loadMembers();
  nested[1].canonical_value.definition.identity_contract
    .invented_authority = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(nested),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
  );

  const unknown = loadMembers();
  unknown[0].canonical_value.stable_id = 'PRODUCT_UNKNOWN_RESULT';
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(unknown),
    { code: 'PRODUCT_QUERY_RESULT_CONTRACT_MEMBERSHIP_MISMATCH' },
  );
});

test('grants no runtime, data, write, serving or production authority', () => {
  const authority =
    loadMember().canonical_value.definition.authority_contract;
  assert.equal(
    Object.values(authority).every((value) => value === false),
    true,
  );

  const sources = [
    CONTRACT_PATH,
    PROCESS_ADAPTER_PATH,
    PROCESS_RESULT_SET_ADAPTER_PATH,
    QXO_F28_ADAPTER_PATH,
    path.join(
      __dirname,
      '../lib/canonical-v2/product-query-result-contract-input-validator.js',
    ),
  ].map((file) => fs.readFileSync(file, 'utf8'));
  for (const source of sources) {
    for (const prohibited of [
      'fetch(',
      'XMLHttpRequest',
      'supabase',
      'openai',
      'anthropic',
    ]) {
      assert.equal(source.includes(prohibited), false, prohibited);
    }
  }

  const adapterAuthority =
    loadProcessAdapter().canonical_value.definition.authority_contract;
  assert.equal(
    Object.values(adapterAuthority).every((value) => value === false),
    true,
  );

  const resultSetAdapterAuthority =
    loadProcessResultSetAdapter().canonical_value.definition.authority_contract;
  assert.equal(
    Object.values(resultSetAdapterAuthority)
      .every((value) => value === false),
    true,
  );
});
