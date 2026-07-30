const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PRODUCT_RESULT_PRESENTATION_CONTRACT_IDS,
  validateAuthoredProductResultPresentationInputs,
} = require(
  '../lib/canonical-v2/product-result-presentation-contract-input-validator',
);

const CONTRACT_PATH = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/product/query/product-result-presentation-definition.v1.json',
);

function loadValue() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function loadMembers() {
  const canonicalValue = loadValue();
  return [{
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  }];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers one PM-wide Product result-presentation definition', () => {
  const members = loadMembers();
  assert.doesNotThrow(
    () => validateAuthoredProductResultPresentationInputs(members),
  );
  assert.deepEqual(
    PRODUCT_RESULT_PRESENTATION_CONTRACT_IDS,
    ['PRODUCT_RESULT_PRESENTATION_DEFINITION'],
  );
  assert.equal(
    members[0].canonical_value.schema_version,
    'PRODUCT_RESULT_PRESENTATION_CONTRACT_INPUT/V1',
  );
  assert.equal(
    members[0].canonical_value.definition.presentation_contract
      .schema_version,
    'PRODUCT_RESULT_PRESENTATION/V1',
  );
});

test('binds one exact result set, release and field catalogue', () => {
  const definition = loadValue().definition;
  const presentation = definition.presentation_contract;
  const parent = definition.parent_binding_contract;

  assert.equal(
    presentation.parent_definition_stable_id,
    'PRODUCT_QUERY_RESULT_DEFINITION',
  );
  assert.equal(presentation.parent_schema_version, 'PRODUCT_QUERY_RESULT/V1');
  assert.equal(presentation.query_ir_definition_stable_id, 'PRODUCT_QUERY_IR');
  assert.equal(
    presentation.field_catalogue_schema_version,
    'PRODUCT_FIELD_CATALOGUE_MANIFEST/V1',
  );
  assert.equal(
    parent.exact_candidate_release_manifest_id_and_payload_digest_required,
    true,
  );
  assert.equal(
    parent.exact_parent_definition_stable_id_version_and_digest_required,
    true,
  );
  assert.equal(
    parent.exact_product_query_ir_definition_id_and_digest_required,
    true,
  );
  assert.equal(
    parent.exact_product_field_catalogue_id_and_payload_digest_required,
    true,
  );
  assert.equal(parent.presentation_can_create_or_replace_result_identity, false);
});

test('uses one canonical payload for passage and table renderers', () => {
  const definition = loadValue().definition;
  const payload = definition.payload_contract;
  const identity = definition.identity_contract;

  assert.equal(payload.canonical_json_payload_required, true);
  assert.equal(
    payload.one_canonical_payload_shared_by_all_view_renderers,
    true,
  );
  assert.equal(payload.passage_and_table_renderers_are_derived_views_only, true);
  assert.equal(
    payload.view_renderer_can_add_omit_reorder_or_change_payload_content,
    false,
  );
  assert.equal(payload.view_renderer_can_execute_query_or_source_read, false);
  assert.equal(
    identity.required_identity_inputs.includes(
      'ordered_product_result_slot_identities',
    ),
    true,
  );
  assert.equal(identity.prohibited_identity_inputs.includes('selected_view'), true);
});

test('uses an answer-first passage view and one optional dense table', () => {
  const view = loadValue().definition.view_contract;

  assert.equal(view.default_view, 'ANSWER_FIRST_PASSAGES');
  assert.deepEqual(
    view.permitted_views,
    ['ANSWER_FIRST_PASSAGES', 'DENSE_TABLE'],
  );
  assert.equal(view.view_switch_executes_second_query, false);
  assert.equal(view.view_switch_changes_result_identity_or_order, false);
  assert.equal(view.answer_first_requires_deals_table_navigation, false);
  assert.equal(view.generated_narrative_answer_permitted, false);
});

test('shows 8 to 12 governed results without padding or silent loss', () => {
  const firstPage = loadValue().definition.first_page_contract;

  assert.equal(firstPage.preferred_minimum_valid_results, 8);
  assert.equal(firstPage.maximum_valid_results, 12);
  assert.equal(
    firstPage.fewer_than_preferred_minimum_shows_every_valid_result,
    true,
  );
  assert.equal(firstPage.result_padding_or_repetition_permitted, false);
  assert.equal(firstPage.query_governed_order_required, true);
  assert.equal(firstPage.query_governed_diversification_required, true);
  assert.equal(firstPage.application_can_rerank_or_rediversify, false);
  assert.equal(
    firstPage.invalid_result_slot_retained_as_typed_unavailable,
    true,
  );
  assert.equal(firstPage.invalid_result_slot_can_be_silently_omitted, false);
});

test('keeps exact precedent language and admitted deal metadata', () => {
  const passage = loadValue().definition.answer_first_passage_contract;

  assert.equal(passage.verbatim_domain_result_content_required, true);
  assert.equal(passage.bounded_preview_retains_truncation_state, true);
  assert.equal(
    passage.shortened_preview_can_replace_full_copy_or_source_content,
    false,
  );
  assert.equal(
    passage.field_catalogue_admission_required_for_every_metadata_field,
    true,
  );
  assert.equal(
    passage.unrequested_or_unadmitted_metadata_field_can_be_added,
    false,
  );
  assert.deepEqual(
    passage.required_metadata_when_admitted,
    [
      'applicable_transaction_parties',
      'counsel_and_advisers',
      'equity_value_and_value_basis',
      'filing_date',
      'filing_type',
      'legal_pattern',
      'process_event_and_bidder_track',
      'source_and_citation',
    ],
  );
  assert.equal(passage.source_text_can_be_rewritten_or_summarised, false);
});

test('uses the same rows and field values in passage and table views', () => {
  const table = loadValue().definition.table_contract;

  assert.equal(
    table.ordered_product_result_identities_equal_passage_view,
    true,
  );
  assert.equal(table.row_count_equals_passage_view_result_slot_count, true);
  assert.equal(table.columns_equal_query_requested_columns, true);
  assert.equal(
    table.column_labels_and_values_use_exact_field_catalogue,
    true,
  );
  assert.equal(table.field_value_equals_same_passage_metadata_value, true);
  assert.equal(table.table_can_execute_independent_query, false);
  assert.equal(
    table.table_can_add_unrequested_or_physical_database_field,
    false,
  );
});

test('uses one editable filter sentence instead of a pill forest', () => {
  const filter = loadValue().definition.filter_sentence_contract;

  assert.equal(filter.one_compact_practitioner_sentence_required, true);
  assert.equal(
    filter.checked_legal_question_or_pattern_is_sentence_subject,
    true,
  );
  assert.equal(
    filter.ordered_filter_segments_equal_ordered_checked_filter_clauses,
    true,
  );
  assert.equal(
    filter.one_editable_segment_per_checked_filter_clause,
    true,
  );
  assert.equal(
    filter.subject_and_each_filter_segment_can_be_edited,
    true,
  );
  assert.equal(filter.each_filter_segment_can_be_cleared, true);
  assert.equal(filter.practitioner_operator_language_required, true);
  assert.equal(filter.raw_database_operator_permitted, false);
  assert.equal(
    filter.decorative_pill_collection_is_main_information_structure,
    false,
  );
  assert.equal(
    filter.sentence_can_hide_or_change_active_filter_meaning,
    false,
  );
  assert.equal(filter.filter_edit_requires_new_checked_query, true);
});

test('states exact coverage and never converts failure to zero results', () => {
  const coverage = loadValue().definition.coverage_contract;

  assert.equal(coverage.exact_covered_set_and_exclusions_required, true);
  assert.equal(coverage.certification_state_required, true);
  assert.equal(
    coverage.zero_result_disposition,
    'NO_RESULTS_IN_COVERED_DEALS',
  );
  assert.equal(
    coverage.zero_result_user_message,
    'No results in the covered deals',
  );
  assert.equal(coverage.zero_results_can_claim_market_absence, false);
  assert.equal(coverage.incomplete_coverage_can_render_as_complete, false);
  assert.equal(coverage.operational_failure_can_render_as_zero_results, false);
});

test('shows checked missing and conflict states instead of blank text', () => {
  const states = loadValue().definition.missing_and_conflict_contract;

  assert.deepEqual(
    states.permitted_typed_states,
    [
      'CONFLICT',
      'KNOWN_MISSING',
      'NOT_APPLICABLE',
      'NOT_EXAMINED',
      'UNKNOWN',
    ],
  );
  assert.equal(states.known_typed_state_can_render_as_blank_text, false);
  assert.equal(states.not_examined_can_render_as_no_or_false, false);
  assert.equal(states.unknown_can_render_as_empty_set, false);
  assert.equal(states.not_applicable_requires_checked_evidence, true);
  assert.equal(
    states.conflict_preserves_each_checked_candidate_and_source,
    true,
  );
  assert.equal(states.presentation_can_select_one_conflicting_value, false);
  assert.equal(
    states
      .same_shared_fact_value_and_state_required_across_filter_passage_table_and_export,
    true,
  );
});

test('keeps shared facts, roles, structures and source actions exact', () => {
  const shared = loadValue().definition.shared_fact_display_contract;

  assert.equal(
    shared
      .shared_fact_occurrence_identity_preserved_across_filter_passage_table_export_and_source_action,
    true,
  );
  assert.equal(shared.shared_fact_value_basis_role_and_source_preserved, true);
  assert.equal(
    shared
      .equity_value_from_press_release_keeps_exact_press_release_source_action,
    true,
  );
  assert.equal(
    shared.professional_name_keeps_represented_party_role_and_exact_source,
    true,
  );
  assert.equal(
    shared
      .merger_of_equals_uses_combination_parties_and_checked_control_outcome,
    true,
  );
  assert.equal(shared.merger_of_equals_can_invent_buyer, false);
  assert.equal(
    shared
      .reverse_merger_reverse_morris_trust_and_share_purchase_components_remain_separate,
    true,
  );
  assert.equal(
    shared
      .presentation_can_combine_separate_components_into_false_transaction_value,
    false,
  );
});

test('keeps machine terms off normal screens without dropping identity', () => {
  const display = loadValue().definition.practitioner_display_contract;

  assert.equal(
    display.normal_screen_can_show_internal_id_digest_or_pipeline_term,
    false,
  );
  assert.equal(
    display.machine_identity_carriers_remain_available_to_checked_actions,
    true,
  );
  assert.equal(
    display.machine_identity_carrier_is_bearer_authorisation,
    false,
  );
  assert.equal(display.pm_design_language_required_for_later_ui, true);
  assert.equal(display.colour_only_state_or_selection_permitted, false);
  assert.equal(
    display.every_visible_action_requires_accessible_name_and_state,
    true,
  );
});

test('adds future CVR and fields without a second presentation engine', () => {
  const extensibility = loadValue().definition.extensibility_contract;

  assert.equal(
    extensibility
      .agreement_process_and_future_cvr_use_same_presentation_schema,
    true,
  );
  assert.equal(extensibility.field_and_navigation_catalogues_are_pm_wide, true);
  assert.equal(
    extensibility
      .new_admitted_field_with_supported_display_type_requires_no_presentation_code_change,
    true,
  );
  assert.equal(
    extensibility.unsupported_display_type_remains_unavailable_until_product_review,
    true,
  );
  assert.equal(
    extensibility.new_domain_can_create_second_presentation_engine,
    false,
  );
});

test('rejects duplicate and semantically changed presentation definitions', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductResultPresentationInputs([]),
  );
  assert.throws(
    () => validateAuthoredProductResultPresentationInputs([
      ...loadMembers(),
      clone(loadMembers()[0]),
    ]),
    { code: 'PRODUCT_RESULT_PRESENTATION_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changedView = loadMembers();
  changedView[0].canonical_value.definition.view_contract
    .generated_narrative_answer_permitted = true;
  assert.throws(
    () => validateAuthoredProductResultPresentationInputs(changedView),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_DEFINITION_INPUT' },
  );

  const changedRows = loadMembers();
  changedRows[0].canonical_value.definition.table_contract
    .table_can_execute_independent_query = true;
  assert.throws(
    () => validateAuthoredProductResultPresentationInputs(changedRows),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_DEFINITION_INPUT' },
  );

  const nested = loadMembers();
  nested[0].canonical_value.definition.authority_contract
    .invented_authority = false;
  assert.throws(
    () => validateAuthoredProductResultPresentationInputs(nested),
    { code: 'INVALID_PRODUCT_RESULT_PRESENTATION_DEFINITION_INPUT' },
  );
});

test('grants no rendering, data, query, write or production authority', () => {
  const authority = loadValue().definition.authority_contract;
  assert.equal(
    Object.values(authority).every((value) => value === false),
    true,
  );

  const sources = [
    fs.readFileSync(CONTRACT_PATH, 'utf8'),
    fs.readFileSync(
      path.join(
        __dirname,
        '../lib/canonical-v2/product-result-presentation-contract-input-validator.js',
      ),
      'utf8',
    ),
  ];
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
});
