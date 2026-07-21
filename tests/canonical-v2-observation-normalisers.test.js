const test = require('node:test');
const assert = require('node:assert/strict');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  normaliseDurationToDays,
  normaliseMoneyRelativeToDealValue,
  validateObservationNormalisation,
} = require('../lib/canonical-v2/observation-normalisers');

const VERSION = 'CANONICAL_NUMERIC/V1';

test('money keeps the exact dollars and publishes a governed deal-relative percentage', () => {
  const value = normaliseMoneyRelativeToDealValue({
    rawAmount: '100000',
    currency: 'USD',
    denominator: {
      value: '137500000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [contentId('SOURCE_FACT/V1', 'landos-announced-closing-value')],
    },
    derivationVersion: VERSION,
  });

  assert.deepEqual(value.raw_value, { amount: '100000', currency: 'USD' });
  assert.equal(value.canonical_value, '0.07272727');
  assert.equal(value.canonical_unit, 'PERCENT_OF_DEAL_VALUE');
  assert.equal(value.basis_key, 'PERCENT_OF_DEAL_VALUE:HEADLINE_TRANSACTION_VALUE:USD');
  assert.equal(value.comparability_state, 'COMPARABLE');
  assert.doesNotThrow(() => validateObservationNormalisation(value));
});

test('money never guesses a missing, incompatible or untraceable denominator', () => {
  const missing = normaliseMoneyRelativeToDealValue({
    rawAmount: '100000', currency: 'USD', derivationVersion: VERSION,
  });
  assert.deepEqual(missing.raw_value, { amount: '100000', currency: 'USD' });
  assert.equal(missing.exclusion_reason, 'MISSING_DENOMINATOR');

  const wrongCurrency = normaliseMoneyRelativeToDealValue({
    rawAmount: '100000',
    currency: 'USD',
    denominator: {
      value: '137500000', currency: 'GBP', basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [contentId('SOURCE_FACT/V1', 'value')],
    },
    derivationVersion: VERSION,
  });
  assert.equal(wrongCurrency.exclusion_reason, 'CURRENCY_MISMATCH');

  const noLineage = normaliseMoneyRelativeToDealValue({
    rawAmount: '100000',
    currency: 'USD',
    denominator: {
      value: '137500000', currency: 'USD', basis: 'HEADLINE_TRANSACTION_VALUE', source_lineage_ids: [],
    },
    derivationVersion: VERSION,
  });
  assert.equal(noLineage.exclusion_reason, 'MISSING_DENOMINATOR_LINEAGE');
});

test('twenty-four elapsed hours becomes one elapsed day without changing its legal trigger', () => {
  const value = normaliseDurationToDays({
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    derivationVersion: VERSION,
  });

  assert.deepEqual(value.raw_value, { magnitude: '24', unit: 'HOURS', day_basis: 'ELAPSED' });
  assert.equal(value.canonical_value, '1');
  assert.equal(value.canonical_unit, 'DAYS');
  assert.equal(value.basis_key, 'DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL');
  assert.doesNotThrow(() => validateObservationNormalisation(value));
});

test('business-day periods remain business-day periods and do not mix with elapsed days', () => {
  const initial = normaliseDurationToDays({
    rawMagnitude: '4', rawUnit: 'DAYS', dayBasis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE', derivationVersion: VERSION,
  });
  const subsequent = normaliseDurationToDays({
    rawMagnitude: '2', rawUnit: 'DAYS', dayBasis: 'BUSINESS',
    trigger: 'MATERIAL_AMENDMENT', derivationVersion: VERSION,
  });

  assert.equal(initial.canonical_value, '4');
  assert.equal(subsequent.canonical_value, '2');
  assert.equal(initial.day_basis, 'BUSINESS');
  assert.notEqual(initial.basis_key, subsequent.basis_key);
});

test('unsupported duration conversions remain visible but excluded', () => {
  const value = normaliseDurationToDays({
    rawMagnitude: '24', rawUnit: 'HOURS', dayBasis: 'BUSINESS',
    trigger: 'NOTICE', derivationVersion: VERSION,
  });
  assert.deepEqual(value.raw_value, { magnitude: '24', unit: 'HOURS', day_basis: 'BUSINESS' });
  assert.equal(value.canonical_value, null);
  assert.equal(value.exclusion_reason, 'UNSUPPORTED_UNIT_BASIS_COMBINATION');
  assert.doesNotThrow(() => validateObservationNormalisation(value));
});
