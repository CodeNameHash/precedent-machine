const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contract = require(
  '../contracts/canonical-v2/successor/product/query/product-result-surface-binding.v1.json',
);
const {
  PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_STABLE_ID,
  validateProductResultSurfaceBindingContractInput,
} = require(
  '../lib/canonical-v2/product-result-surface-binding-contract-input-validator',
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('accepts the exact closed Product result-surface binding contract', () => {
  assert.equal(
    contract.stable_id,
    PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_STABLE_ID,
  );
  assert.doesNotThrow(() => (
    validateProductResultSurfaceBindingContractInput(contract)
  ));
  assert.deepEqual(
    contract.definition.binding_contract.required_surfaces,
    ['COMPARE', 'CORPUS_CONTEXT', 'QUERY', 'REVIEW'],
  );
  assert.equal(
    contract.definition.market_state_contract.generic_no_market_data_fallback_permitted,
    false,
  );
  assert.equal(
    contract.definition.authority_contract.creates_serving_authority,
    false,
  );
});

test('rejects a correctly rehashed nested contract substitution', () => {
  const changed = clone(contract);
  changed.definition.binding_contract.required_surfaces[0] = 'OTHER';
  assert.throws(
    () => validateProductResultSurfaceBindingContractInput(changed),
    { code: 'INVALID_PRODUCT_RESULT_SURFACE_BINDING_CONTRACT_INPUT' },
  );
});

test('uses the exact six-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(path.join(
    __dirname,
    '../.github/phase-allowlists/wp-p8-product-surface-binding-v1.json',
  ), 'utf8'));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-p8-product-surface-binding-v1.json',
    'contracts/canonical-v2/successor/product/query/product-result-surface-binding.v1.json',
    'lib/canonical-v2/product-result-surface-binding-contract-input-validator.js',
    'lib/canonical-v2/product-result-surface-bindings.js',
    'tests/canonical-v2-product-result-surface-binding-contract-input.test.js',
    'tests/canonical-v2-product-result-surface-bindings.test.js',
  ]);
});
