const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProductServingInputs,
} = require(
  '../lib/canonical-v2/product-serving-contract-input-validator',
);
const productQueryIr = require('../lib/canonical-v2/product-query-ir');
const sharedServingRow = require('../lib/canonical-v2/shared-serving-row');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const PATHS = [
  'product/query/product-query-result-serving-projection.v1.json',
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
      'PRODUCT_QUERY_RESULT_SERVING_PROJECTION',
      'PRODUCT_QUERY_SERVING_EXECUTION',
      'PRODUCT_SHARED_SERVING_ROW',
    ],
  );
});

test('requires one generic release-bound Product result projection', () => {
  const projection = byId('PRODUCT_QUERY_RESULT_SERVING_PROJECTION');

  assert.equal(projection.scope_contract.applies_to_all_product_domains, true);
  assert.deepEqual(projection.scope_contract.initial_required_domains, [
    'AGREEMENT',
    'PROCESS',
  ]);
  assert.equal(
    projection.scope_contract.second_domain_specific_projection_permitted,
    false,
  );
  assert.equal(
    projection.record_contract.candidate_record_identity_and_payload_digest_required,
    true,
  );
  assert.equal(
    projection.release_contract
      .record_root_in_product_release_partition_manifest_required,
    true,
  );
  assert.equal(
    projection.release_contract
      .product_release_partition_manifest_binds_base_candidate_release_manifest,
    true,
  );
  assert.equal(
    projection.release_contract.active_pointer_import_plan_join_required,
    true,
  );
  assert.equal(
    projection.release_contract.active_pointer_join_required_for_serving,
    true,
  );
  assert.equal(
    projection.query_contract.request_shape,
    'ONE_INDEXED_SET_BASED_SQL_OR_RPC',
  );
  assert.equal(projection.query_contract.maximum_database_calls, 1);
  assert.equal(projection.query_contract.maximum_immediate_retries, 0);
  assert.equal(projection.query_contract.maximum_page_size, 50);
  assert.equal(
    projection.query_contract.complete_candidate_sidecar_loaded_in_page_query,
    false,
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
  for (const rowKind of row.row_contract.closed_variants) {
    const variant = row.variant_contract[rowKind];
    assert.equal(variant.runtime_schema_version, 'SHARED_SERVING_ROW/V1');
    assert.equal(variant.runtime_validator_module, 'lib/canonical-v2/shared-serving-row.js');
    assert.equal(variant.runtime_validator_export, 'validateSharedServingRow');
    assert.equal(variant.required_source_lineage_fields.includes('CORPUS_RELEASE_ID'), true);
    assert.equal(variant.required_source_lineage_fields.includes('CANONICAL_PAYLOAD_DIGEST'), true);
  }
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
  assert.deepEqual(serving.product_query_ir_runtime_binding, {
    definition_stable_id: 'PRODUCT_QUERY_IR',
    schema_version: 'PRODUCT_QUERY_IR/V1',
    runtime_module: 'lib/canonical-v2/product-query-ir.js',
    construction_export: 'compileProductQueryIr',
    closed_validation_export: 'canonicalProductQueryIrBytes',
    process_query_ir_is_product_query_ir: false,
    process_query_ir_relabelling_permitted: false,
    product_ir_construction_and_validation_required_before_serving: true,
  });
  assert.equal(
    typeof productQueryIr[
      serving.product_query_ir_runtime_binding.construction_export
    ],
    'function',
  );
  assert.equal(
    typeof productQueryIr[
      serving.product_query_ir_runtime_binding.closed_validation_export
    ],
    'function',
  );
  assert.deepEqual(serving.governed_budget_reference_contract, {
    capacity_manifest: {
      stable_id: 'CAPACITY_MANIFEST',
      schema_version: 'CAPACITY_MANIFEST/V1',
      route_class: 'PRODUCT_QUERY_SERVING',
      exact_numeric_limit_bindings: {
        maximum_admission_database_calls: 1,
        maximum_route_serving_database_calls: 1,
        maximum_immediate_retries: 0,
      },
    },
    route_budget_manifest: {
      stable_id: 'ROUTE_BUDGET_MANIFEST',
      schema_version: 'ROUTE_BUDGET_MANIFEST/V1',
      route_class: 'PRODUCT_QUERY_SERVING',
      exact_numeric_limit_bindings: {
        maximum_request_bytes: 32768,
        maximum_page_size: 50,
        maximum_initial_response_bytes: 1048576,
        maximum_database_rows_per_request: 51,
        maximum_http_rows_per_response: 50,
      },
    },
    cache_budget_manifest: {
      stable_id: 'CACHE_BUDGET_MANIFEST',
      schema_version: 'CACHE_BUDGET_MANIFEST/V1',
      cache_class: 'PRODUCT_QUERY_SERVING',
      exact_numeric_limit_bindings: {
        maximum_value_ttl_seconds: 3600,
        maximum_cached_value_bytes: 1048576,
      },
    },
    exact_manifest_identity_and_payload_digest_required_before_serving: true,
    manifest_limit_mismatch_disposition: 'FAIL_CLOSED',
    manifest_reference_grants_runtime_or_serving_authority: false,
  });
});

test('uses the existing closed shared-row validator for every permitted row variant', () => {
  const row = byId('PRODUCT_SHARED_SERVING_ROW');
  for (const rowKind of row.row_contract.closed_variants) {
    assert.equal(
      typeof sharedServingRow[
        row.variant_contract[rowKind].runtime_validator_export
      ],
      'function',
    );
  }
});

test('isolates invalid rows and grants no execution or production authority', () => {
  for (const member of members()) {
    const authority = member.canonical_value.definition.authority_contract;
    assert.equal(
      Object.entries(authority).every(
        ([key, value]) => key === 'creates_projection_records'
          ? value === true
          : value === false,
      ),
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

  const relabelledProcess = clone(members());
  byDefinition(relabelledProcess, 'PRODUCT_QUERY_SERVING_EXECUTION')
    .product_query_ir_runtime_binding.process_query_ir_relabelling_permitted = true;
  assert.throws(
    () => validateAuthoredProductServingInputs(relabelledProcess),
    { code: 'INVALID_PRODUCT_QUERY_SERVING_EXECUTION_INPUT' },
  );

  const unboundVariant = clone(members());
  delete byDefinition(unboundVariant, 'PRODUCT_SHARED_SERVING_ROW')
    .variant_contract.CANONICAL_RESULT.runtime_validator_export;
  assert.throws(
    () => validateAuthoredProductServingInputs(unboundVariant),
    { code: 'INVALID_PRODUCT_SHARED_SERVING_ROW_INPUT' },
  );

  const weakenedBudget = clone(members());
  byDefinition(weakenedBudget, 'PRODUCT_QUERY_SERVING_EXECUTION')
    .governed_budget_reference_contract.cache_budget_manifest
    .exact_numeric_limit_bindings.maximum_value_ttl_seconds = 0;
  assert.throws(
    () => validateAuthoredProductServingInputs(weakenedBudget),
    { code: 'INVALID_PRODUCT_QUERY_SERVING_EXECUTION_INPUT' },
  );

  const secondProjection = clone(members());
  byDefinition(secondProjection, 'PRODUCT_QUERY_RESULT_SERVING_PROJECTION')
    .scope_contract.second_domain_specific_projection_permitted = true;
  assert.throws(
    () => validateAuthoredProductServingInputs(secondProjection),
    { code: 'INVALID_PRODUCT_QUERY_RESULT_SERVING_PROJECTION_INPUT' },
  );
});

function byDefinition(values, stableId) {
  return values.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}
