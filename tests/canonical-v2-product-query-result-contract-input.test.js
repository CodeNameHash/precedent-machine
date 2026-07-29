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

function loadMember() {
  const canonicalValue = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers one closed PM-wide Product query-result definition', () => {
  const member = loadMember();
  assert.doesNotThrow(
    () => validateAuthoredProductQueryResultInputs([member]),
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
      loadMember(),
      clone(loadMember()),
    ]),
    { code: 'PRODUCT_QUERY_RESULT_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changed = loadMember();
  changed.canonical_value.definition.release_contract
    .silent_redirect_or_result_substitution_permitted = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([changed]),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
  );

  const nested = loadMember();
  nested.canonical_value.definition.identity_contract
    .invented_authority = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([nested]),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_DEFINITION_INPUT' },
  );

  const unknown = loadMember();
  unknown.canonical_value.stable_id = 'PRODUCT_UNKNOWN_RESULT';
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([unknown]),
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
});
