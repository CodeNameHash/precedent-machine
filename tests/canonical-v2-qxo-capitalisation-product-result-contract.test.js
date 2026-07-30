const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProductQueryResultInputs,
} = require('../lib/canonical-v2/product-query-result-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '..',
  'contracts',
  'canonical-v2',
  'successor',
  'product',
  'query',
);
const PATHS = [
  'process-phrasebook-product-result-adapter.v1.json',
  'process-phrasebook-product-result-set-adapter.v1.json',
  'product-query-result-definition.v1.json',
  'qxo-capitalisation-f28-product-result-adapter.v1.json',
  'qxo-capitalisation-product-result-adapter.v1.json',
];

function members() {
  return PATHS.map((file) => {
    const canonicalValue = JSON.parse(
      fs.readFileSync(path.join(ROOT, file), 'utf8'),
    );
    return {
      object_kind: canonicalValue.object_kind,
      canonical_value: canonicalValue,
    };
  });
}

function qxo(values = members()) {
  return values.find(
    (member) => member.canonical_value.stable_id
      === 'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
  ).canonical_value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('admits the exact QXO Agreement Product result adapter contract', () => {
  assert.doesNotThrow(() => validateAuthoredProductQueryResultInputs(members()));
});

test('preserves all six QXO subrows and the two legal comparison classes', () => {
  const source = qxo().definition.source_contract;
  assert.deepEqual(source.required_comparison_classes, [
    'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
    'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
  ]);
  assert.deepEqual(source.required_value_slots, [
    'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
    'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
    'CAPITALISATION_MEASUREMENT_DATE',
    'GENERAL_KNOWLEDGE_QUALIFIER',
    'GENERAL_MATERIALITY_QUALIFIER',
    'RETROSPECTIVE_LOOKBACK',
  ]);
  assert.equal(source.class_aggregation_forbidden, true);
  assert.equal(source.invalid_subrow_isolated_as_typed_failure, true);
});

test('maps the exact F27 row identity and bytes without a second row architecture', () => {
  const contract = qxo().definition;
  assert.equal(
    contract.identity_mapping.source_field,
    'qxo_release.provision_row.provision_row_id',
  );
  assert.equal(contract.identity_mapping.adapter_can_mint_or_replace_identity, false);
  assert.equal(contract.payload_mapping.source_field, 'qxo_release.provision_row');
  assert.equal(contract.payload_mapping.representation_kind, 'STRUCTURED_RESULT');
  assert.equal(contract.payload_mapping.all_six_subrows_required, true);
  assert.equal(
    contract.cross_view_contract.product_wrapper_can_create_second_row_or_source_architecture,
    false,
  );
});

test('requires the same row, release and source bindings on all four surfaces', () => {
  const contract = qxo().definition.cross_view_contract;
  assert.deepEqual(contract.required_surfaces, [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  assert.equal(contract.all_surfaces_use_exact_same_provision_row_object, true);
  assert.equal(contract.all_surfaces_use_exact_same_provision_row_identity, true);
  assert.equal(contract.all_surfaces_use_exact_same_release_identity, true);
  assert.equal(contract.generic_no_market_data_authority, 'NONE');
});

test('keeps Product query, field, cohort and membership PASS states external', () => {
  const contract = qxo().definition;
  assert.equal(
    contract.external_input_contract.product_query_result_admission_source,
    'PRODUCT_QUERY_RESULT_ADMISSION_RECEIPT/V1',
  );
  assert.deepEqual(contract.prohibited_state_contract, {
    adapter_can_manufacture_query_pass: false,
    adapter_can_manufacture_cohort_pass: false,
    adapter_can_manufacture_filter_pass: false,
    adapter_can_manufacture_field_pass: false,
    adapter_can_manufacture_membership_pass: false,
    adapter_can_upgrade_validated_not_materialised_to_materialised: false,
    adapter_can_upgrade_inactive_candidate_to_active: false,
  });
});

test('rejects correctly rehashed semantic drift because the complete definition is pinned', () => {
  const changed = clone(members());
  qxo(changed).definition.payload_mapping.all_six_subrows_required = false;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changed),
    (error) => error.code
      === 'INVALID_QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_INPUT',
  );
});

test('rejects source rewriting and any release activation authority', () => {
  const changed = clone(members());
  qxo(changed).definition.citation_and_source_contract
    .adapter_can_invent_rewrite_or_summarise_source = true;
  qxo(changed).definition.authority_contract.creates_activation_authority = true;
  assert.throws(
    () => validateAuthoredProductQueryResultInputs(changed),
    (error) => error.code
      === 'INVALID_QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_INPUT',
  );
});
