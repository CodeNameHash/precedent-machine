const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PRODUCT_RESULT_ACTION_CONTRACT_IDS,
  validateAuthoredProductResultActionInputs,
} = require(
  '../lib/canonical-v2/product-result-action-contract-input-validator',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/product/query',
);
const PATHS = Object.freeze({
  PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE:
    'product-release-pinned-citation-and-share.v1.json',
  PRODUCT_SELECTED_RESULT_EXPORT:
    'product-selected-result-export.v1.json',
});

function loadValue(stableId) {
  return JSON.parse(fs.readFileSync(
    path.join(ROOT, PATHS[stableId]),
    'utf8',
  ));
}

function loadMembers() {
  return PRODUCT_RESULT_ACTION_CONTRACT_IDS.map((stableId) => {
    const canonicalValue = loadValue(stableId);
    return {
      object_kind: canonicalValue.object_kind,
      canonical_value: canonicalValue,
    };
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers exactly two PM-wide Product result actions', () => {
  const members = loadMembers();
  assert.doesNotThrow(
    () => validateAuthoredProductResultActionInputs(members),
  );
  assert.deepEqual(
    members.map((member) => member.canonical_value.stable_id),
    [
      'PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE',
      'PRODUCT_SELECTED_RESULT_EXPORT',
    ],
  );
  assert.equal(
    members.every(
      (member) => member.canonical_value.schema_version
        === 'PRODUCT_RESULT_ACTION_CONTRACT_INPUT/V1',
    ),
    true,
  );
});

test('binds each action to one exact Product query result', () => {
  const citation = loadValue(
    'PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE',
  ).definition.parent_binding_contract;
  const selection = loadValue(
    'PRODUCT_SELECTED_RESULT_EXPORT',
  ).definition.selection_contract;

  for (const binding of [citation, selection]) {
    assert.equal(
      binding.parent_definition_stable_id,
      'PRODUCT_QUERY_RESULT_DEFINITION',
    );
    assert.equal(binding.parent_schema_version, 'PRODUCT_QUERY_RESULT/V1');
    assert.equal(binding.exact_product_query_definition_id_required, true);
  }
  assert.equal(
    citation.exact_parent_product_result_identity_required,
    true,
  );
  assert.equal(
    citation.exact_domain_result_definition_and_identity_required,
    true,
  );
  assert.equal(selection.selected_product_result_identities_required, true);
});

test('keeps citations and share references on the pinned release', () => {
  const definition = loadValue(
    'PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE',
  ).definition;

  assert.equal(
    definition.citation_contract
      .citation_open_preserves_release_result_and_source_identity,
    true,
  );
  assert.equal(
    definition.citation_contract
      .citation_can_rewrite_or_summarise_source_text,
    false,
  );
  assert.equal(
    definition.citation_contract
      .source_accession_or_equivalent_identity_required,
    true,
  );
  assert.equal(
    definition.citation_contract
      .source_filing_type_and_filing_date_required_when_applicable,
    true,
  );
  assert.equal(
    definition.citation_contract
      .citation_label_derived_from_admitted_source_metadata,
    true,
  );
  assert.equal(
    definition.citation_contract
      .citation_link_binds_exact_source_document_and_release,
    true,
  );
  assert.equal(definition.share_contract.active_release_required, true);
  assert.equal(
    definition.share_contract.inactive_disposition,
    'RELEASE_NOT_ACTIVE',
  );
  assert.equal(
    definition.share_contract
      .silent_redirect_or_result_substitution_permitted,
    false,
  );
  assert.equal(
    definition.share_contract
      .explicit_active_release_rerun_is_separate_action,
    true,
  );
  assert.equal(
    definition.share_contract.share_reference_is_bearer_authorisation,
    false,
  );
});

test('copies exact domain content and never creates a narrative', () => {
  const definition = loadValue(
    'PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE',
  ).definition;

  assert.equal(
    definition.copy_contract
      .verbatim_text_copy_requires_exact_domain_result_text,
    true,
  );
  assert.equal(
    definition.copy_contract
      .structured_result_copy_requires_exact_domain_result_value_and_evidence,
    true,
  );
  assert.equal(definition.copy_contract.citation_required_in_copy, true);
  assert.equal(definition.copy_contract.generated_narrative_permitted, false);
  assert.equal(
    definition.copy_contract
      .non_textual_result_can_be_rendered_as_invented_passage,
    false,
  );
});

test('exports one bounded exact selected-result subset', () => {
  const definition = loadValue(
    'PRODUCT_SELECTED_RESULT_EXPORT',
  ).definition;

  assert.equal(definition.selection_contract.minimum_selected_results, 1);
  assert.equal(definition.selection_contract.maximum_selected_results, 50);
  assert.equal(
    definition.selection_contract
      .selected_result_identities_must_be_unique_and_in_query_order,
    true,
  );
  assert.equal(
    definition.selection_contract
      .selected_results_must_belong_to_same_query_and_release,
    true,
  );
  assert.equal(
    definition.selection_contract.unselected_result_can_enter_export,
    false,
  );
  assert.equal(
    definition.field_contract.unrequested_field_can_be_added,
    false,
  );
  assert.equal(
    definition.field_contract.requested_field_must_be_query_admitted,
    true,
  );
  assert.equal(
    definition.field_contract.generated_narrative_can_be_exported,
    false,
  );
  assert.deepEqual(
    definition.field_contract.required_provenance_fields,
    [
      'product_query_definition_id',
      'product_query_result_identity',
      'approved_pm_data_version_id',
      'candidate_release_manifest_id',
      'candidate_release_manifest_payload_digest',
      'domain_key',
      'domain_result_definition',
      'domain_result_identity',
      'exact_citation',
    ],
  );
  assert.equal(
    definition.payload_contract.schema_version,
    'PRODUCT_SELECTED_RESULT_EXPORT_PAYLOAD/V1',
  );
  assert.equal(
    definition.payload_contract
      .one_canonical_payload_shared_by_all_render_formats,
    true,
  );
  assert.equal(
    definition.payload_contract
      .render_format_can_add_omit_or_reorder_payload_content,
    false,
  );
  assert.equal(
    definition.payload_contract
      .pdf_clipboard_and_download_are_derived_renderers_only,
    true,
  );
  assert.equal(
    definition.payload_contract.renderer_can_execute_query_or_source_read,
    false,
  );
});

test('fails the whole export instead of hiding a selected result', () => {
  const completeness = loadValue(
    'PRODUCT_SELECTED_RESULT_EXPORT',
  ).definition.completeness_contract;

  assert.equal(
    completeness
      .export_result_identity_set_equals_selected_result_identity_set,
    true,
  );
  assert.equal(completeness.missing_selected_result_fails_entire_export, true);
  assert.equal(completeness.invalid_selected_result_fails_entire_export, true);
  assert.equal(completeness.partial_export_after_failure_permitted, false);
  assert.equal(completeness.duplicate_result_can_pad_export, false);
  assert.equal(
    completeness.failed_result_can_be_replaced_by_valid_sibling,
    false,
  );
  assert.equal(
    completeness.export_count_reconciles_selected_and_emitted_results,
    true,
  );
});

test('adds a future CVR domain without a second action engine', () => {
  for (const stableId of PRODUCT_RESULT_ACTION_CONTRACT_IDS) {
    const extensibility = loadValue(stableId)
      .definition.extensibility_contract;
    assert.equal(
      extensibility.agreement_process_and_future_cvr_use_same_action_schema
        || extensibility
          .agreement_process_and_future_cvr_use_same_export_schema,
      true,
    );
    assert.equal(
      extensibility.new_domain_can_create_second_share_or_citation_engine
        ?? extensibility.new_domain_can_create_second_export_engine,
      false,
    );
  }
});

test('rejects incomplete, duplicate and semantically changed action sets', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductResultActionInputs([]),
  );
  assert.throws(
    () => validateAuthoredProductResultActionInputs([
      loadMembers()[0],
    ]),
    { code: 'PRODUCT_RESULT_ACTION_CONTRACT_MEMBERSHIP_MISMATCH' },
  );
  assert.throws(
    () => validateAuthoredProductResultActionInputs([
      ...loadMembers(),
      clone(loadMembers()[0]),
    ]),
    { code: 'PRODUCT_RESULT_ACTION_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changedCitation = loadMembers();
  changedCitation[0].canonical_value.definition.share_contract
    .silent_redirect_or_result_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProductResultActionInputs(changedCitation),
    {
      code:
        'INVALID_PRODUCT_RELEASE_PINNED_CITATION_AND_SHARE_INPUT',
    },
  );

  const changedExport = loadMembers();
  changedExport[1].canonical_value.definition.completeness_contract
    .partial_export_after_failure_permitted = true;
  assert.throws(
    () => validateAuthoredProductResultActionInputs(changedExport),
    { code: 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_INPUT' },
  );

  const nested = loadMembers();
  nested[1].canonical_value.definition.identity_contract
    .invented_authority = true;
  assert.throws(
    () => validateAuthoredProductResultActionInputs(nested),
    { code: 'INVALID_PRODUCT_SELECTED_RESULT_EXPORT_INPUT' },
  );
});

test('grants no runtime, data, export, write or production authority', () => {
  for (const stableId of PRODUCT_RESULT_ACTION_CONTRACT_IDS) {
    const authority = loadValue(stableId).definition.authority_contract;
    assert.equal(
      Object.values(authority).every((value) => value === false),
      true,
    );
  }

  const sources = [
    ...Object.values(PATHS).map((relativePath) => (
      fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
    )),
    fs.readFileSync(
      path.join(
        __dirname,
        '../lib/canonical-v2/product-result-action-contract-input-validator.js',
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
