const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProductServingInputs,
} = require(
  '../lib/canonical-v2/product-serving-contract-input-validator',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const PATHS = [
  'product/query/product-query-serving-execution.v1.json',
  'product/query/product-shared-serving-row.v1.json',
];

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return PATHS.map(loadMember);
}

function byId(stableId) {
  return members().find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('validates the closed Product serving contract set', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductServingInputs(members()),
  );
  assert.deepEqual(
    members().map((member) => member.canonical_value.stable_id),
    [
      'PRODUCT_QUERY_SERVING_EXECUTION',
      'PRODUCT_SHARED_SERVING_ROW',
    ],
  );
});

test('closes SharedServingRow to three exact variants', () => {
  const row = byId('PRODUCT_SHARED_SERVING_ROW');

  assert.deepEqual(row.row_contract.closed_variants, [
    'CANONICAL_RESULT',
    'INCOMPLETE_CANONICAL_RESULT',
    'REVIEWED_SOURCE_SPECIFIC',
  ]);
  assert.equal(row.row_contract.exactly_one_variant_payload_required, true);
  assert.equal(row.row_contract.additional_variant_permitted, false);
  assert.equal(
    row.row_contract.null_placeholder_for_forbidden_field_permitted,
    false,
  );
  assert.equal(row.row_contract.failed_or_blocked_variant_permitted, false);
  assert.equal(
    row.variant_contract.INCOMPLETE_CANONICAL_RESULT
      .market_observation_forbidden,
    true,
  );
  assert.equal(
    row.variant_contract.REVIEWED_SOURCE_SPECIFIC
      .canonical_result_fields_forbidden,
    true,
  );
});

test('requires Product-wide indexed set-based serving and bounded caching', () => {
  const serving = byId('PRODUCT_QUERY_SERVING_EXECUTION');

  assert.equal(serving.scope_contract.applies_to_all_product_domains, true);
  assert.equal(
    serving.execution_contract.request_shape,
    'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
  );
  assert.equal(
    serving.execution_contract.maximum_admission_database_calls,
    1,
  );
  assert.equal(
    serving.execution_contract.maximum_route_serving_database_calls,
    1,
  );
  assert.equal(
    serving.execution_contract.corpus_proportional_database_calls_permitted,
    false,
  );
  assert.equal(
    serving.execution_contract
      .broad_canonical_cards_or_claims_loaded_into_application_memory,
    false,
  );
  assert.equal(serving.route_budget_contract.maximum_page_size, 50);
  assert.equal(
    serving.route_budget_contract.maximum_initial_response_bytes,
    1048576,
  );
  assert.equal(serving.cache_contract.release_aware_cache_required, true);
  assert.equal(
    serving.cache_contract.fresh_admission_required_before_cache_lookup,
    true,
  );
  assert.equal(
    serving.cache_contract.error_partial_or_schema_invalid_result_cacheable,
    false,
  );
  assert.equal(
    serving.cache_contract.unset_cache_limit_disposition,
    'FAIL_CLOSED',
  );
});

test('isolates invalid rows and grants no execution or production authority', () => {
  for (const member of members()) {
    const authority = member.canonical_value.definition.authority_contract;
    assert.equal(
      Object.values(authority).every((value) => value === false),
      true,
    );
  }
  const row = byId('PRODUCT_SHARED_SERVING_ROW');
  assert.equal(row.failure_contract.invalid_row_fails_only_its_result_slot, true);
  assert.equal(row.failure_contract.invalid_row_can_be_silently_omitted, false);
  assert.equal(row.failure_contract.valid_sibling_rows_remain_publishable, true);
});

test('rejects incomplete, expanded or weakened Product serving contracts', () => {
  assert.throws(
    () => validateAuthoredProductServingInputs(members().slice(1)),
    { code: 'PRODUCT_SERVING_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const expanded = clone(members());
  byDefinition(expanded, 'PRODUCT_SHARED_SERVING_ROW')
    .row_contract.closed_variants.push('GENERIC_RESULT');
  assert.throws(
    () => validateAuthoredProductServingInputs(expanded),
    { code: 'INVALID_PRODUCT_SHARED_SERVING_ROW_INPUT' },
  );

  const weakened = clone(members());
  byDefinition(weakened, 'PRODUCT_QUERY_SERVING_EXECUTION')
    .execution_contract.corpus_proportional_database_calls_permitted = true;
  assert.throws(
    () => validateAuthoredProductServingInputs(weakened),
    { code: 'INVALID_PRODUCT_QUERY_SERVING_EXECUTION_INPUT' },
  );
});

function byDefinition(values, stableId) {
  return values.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}
