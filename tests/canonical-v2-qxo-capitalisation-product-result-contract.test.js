const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProductQueryResultInputs,
} = require('../lib/canonical-v2/product-query-result-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/product/query',
);
const CURRENT_PATHS = [
  'process-phrasebook-product-result-adapter.v1.json',
  'process-phrasebook-product-result-set-adapter.v1.json',
  'product-query-result-definition.v1.json',
  'qxo-capitalisation-f28-product-result-adapter.v1.json',
  'qxo-capitalisation-f28-product-result-adapter.v2.json',
  'qxo-capitalisation-product-result-adapter.v1.json',
];

function members() {
  return CURRENT_PATHS.map((file) => {
    const canonicalValue = JSON.parse(
      fs.readFileSync(path.join(ROOT, file), 'utf8'),
    );
    return {
      object_kind: canonicalValue.object_kind,
      canonical_value: canonicalValue,
    };
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(values, stableId) {
  return values.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('retires F27 without breaking its historical binding and activates F28', () => {
  assert.doesNotThrow(() => validateAuthoredProductQueryResultInputs(members()));
  const values = members();
  const f27 = byId(values, 'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER');
  const f28 = byId(values, 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER');
  assert.deepEqual(f27.lifecycle_contract, {
    lifecycle_state: 'RETIRED_NOT_RELEASE_ADMITTED',
    active_successor_stable_id:
      'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER',
    active_successor_contract_version: 1,
    historical_validation_reference_permitted: true,
    release_admission_permitted: false,
    serving_permitted: false,
    activation_permitted: false,
  });
  assert.equal(f28.lifecycle_contract.lifecycle_state, 'ACTIVE_SUCCESSOR');
  assert.equal(
    f28.lifecycle_contract.retired_predecessor_stable_id,
    'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
  );
  assert.equal(f28.source_contract.source_result_definition_version, 3);
  assert.equal(f28.source_contract.required_market_metric_slot_count, 14);
  assert.equal(f28.cross_view_contract.generic_no_market_data_authority, 'FORBIDDEN');
});

test('rejects any attempt to release-admit, serve or reactivate F27', () => {
  const mutations = [
    (values) => {
      byId(
        values,
        'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
      ).lifecycle_contract.release_admission_permitted = true;
    },
    (values) => {
      byId(
        values,
        'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
      ).lifecycle_contract.serving_permitted = true;
    },
    (values) => {
      byId(
        values,
        'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER',
      ).lifecycle_contract.lifecycle_state = 'ACTIVE_SUCCESSOR';
    },
    (values) => {
      byId(
        values,
        'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER',
      ).lifecycle_contract.release_admission_must_use_this_successor = false;
    },
  ];
  for (const mutate of mutations) {
    const values = clone(members());
    mutate(values);
    assert.throws(
      () => validateAuthoredProductQueryResultInputs(values),
      (error) => [
        'INVALID_QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER_INPUT',
        'INVALID_QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER_INPUT',
        'INVALID_QXO_CAPITALISATION_ADAPTER_LIFECYCLE',
      ].includes(error.code),
    );
  }
});
