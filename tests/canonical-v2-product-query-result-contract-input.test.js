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

function loadMembers() {
  return [loadProcessAdapter(), loadMember()];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers the closed PM-wide Product result definition and Process adapter', () => {
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
  assert.equal(definition.payload_mapping.exact_bytes_and_digest_required, true);
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
    citation.source_interval_source,
    'process_admission_input.matched_passage_preview.exact_source_interval',
  );
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
    'EXTERNAL_PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1',
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
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([
      loadProcessAdapter(),
      changedResult,
    ]),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
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
});
