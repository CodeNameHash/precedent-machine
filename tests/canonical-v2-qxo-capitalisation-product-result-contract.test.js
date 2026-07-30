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

test('retires the stale F27 adapter and retains the exact F28 adapter', () => {
  assert.equal(
    fs.existsSync(path.join(
      ROOT,
      'qxo-capitalisation-product-result-adapter.v1.json',
    )),
    false,
  );
  assert.doesNotThrow(() => validateAuthoredProductQueryResultInputs(members()));
  const f28 = members().find(
    (member) => member.canonical_value.stable_id
      === 'QXO_CAPITALISATION_F28_PRODUCT_RESULT_ADAPTER',
  ).canonical_value.definition;
  assert.equal(f28.source_contract.source_result_definition_version, 3);
  assert.equal(f28.source_contract.required_market_metric_slot_count, 14);
  assert.equal(f28.cross_view_contract.generic_no_market_data_authority, 'FORBIDDEN');
});

test('rejects any reintroduced unregistered F27 adapter', () => {
  const reintroduced = JSON.parse(JSON.stringify(members()[3]));
  reintroduced.canonical_value.stable_id =
    'QXO_CAPITALISATION_PRODUCT_RESULT_ADAPTER';
  assert.throws(
    () => validateAuthoredProductQueryResultInputs([
      ...members(),
      reintroduced,
    ]),
    { code: 'PRODUCT_QUERY_RESULT_CONTRACT_MEMBERSHIP_MISMATCH' },
  );
});
