const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredSharedAuthorityInputs,
} = require('../lib/canonical-v2/shared-authority-contract-input-validator');

const CONTRACT_PATH = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/shared/transactions/consideration-package.v1.json',
);

function member() {
  const canonicalValue = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('accepts the closed shared ConsiderationPackage contract', () => {
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs([member()]));
});

test('keeps cash, dividend, CVR, stock and tiered-price components separate', () => {
  const contract = member().canonical_value.definition.type_contract;

  assert.deepEqual(contract.component_types, [
    'CASH_PER_SHARE',
    'CVR',
    'OTHER_GOVERNED',
    'STOCK',
    'TARGET_PAID_DIVIDEND_PER_SHARE',
    'TIERED_PRICE',
  ]);
  assert.equal(contract.cash_dividend_cvr_and_stock_components_remain_separate, true);
  assert.equal(contract.target_paid_dividend_automatically_added_to_offer_price, false);
  assert.equal(contract.cvr_ceiling_automatically_added_to_offer_price, false);
  assert.equal(contract.tiered_prices_collapsed_to_one_price, false);
});

test('rejects value-derived package identity', () => {
  const changed = clone(member());
  changed.canonical_value.definition.occurrence_identity.stable_id_inputs[0] =
    'components';

  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([changed]),
    (error) => error.code === 'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
  );
});

test('rejects automatic CVR value addition even after a self-consistent edit', () => {
  const changed = clone(member());
  changed.canonical_value.definition.type_contract
    .cvr_ceiling_automatically_added_to_offer_price = true;

  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([changed]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects Process re-authoring of the shared economic fact', () => {
  const changed = clone(member());
  changed.canonical_value.definition.type_contract
    .process_can_reauthor_shared_economic_fact = true;

  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([changed]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});
