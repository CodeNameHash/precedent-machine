const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DENOMINATOR_PRECISION,
  resolveDenominatorPrecision,
  qualifyDerivedValue,
  qualifyDealValueBasis,
} = require('../lib/canonical-v2/denominator-precision-presentation');

test('authoritative denominator precision wins over the compatibility claim attribute', () => {
  assert.equal(resolveDenominatorPrecision({
    denominator: { precision: 'EXACT' },
    claim_attributes: { denominator_precision: 'APPROXIMATE' },
  }), DENOMINATOR_PRECISION.EXACT);
  assert.equal(resolveDenominatorPrecision({
    denominator: { precision: 'APPROXIMATE' },
    claim_attributes: { denominator_precision: 'EXACT' },
  }), DENOMINATOR_PRECISION.APPROXIMATE);
});

test('claim attributes are a compatibility fallback and missing history is explicit', () => {
  assert.equal(resolveDenominatorPrecision({
    denominator: { value: '1000000' },
    claim_attributes: { denominator_precision: 'APPROXIMATE' },
  }), DENOMINATOR_PRECISION.APPROXIMATE);
  assert.equal(resolveDenominatorPrecision({
    denominator: { value: '1000000' },
    claim_attributes: {},
  }), DENOMINATOR_PRECISION.NOT_CAPTURED);
  assert.equal(resolveDenominatorPrecision({
    denominator: { precision: 'UNRECOGNISED' },
    claim_attributes: { denominator_precision: 'EXACT' },
  }), DENOMINATOR_PRECISION.NOT_CAPTURED);
});

test('derived percentages and bases distinguish exact, approximate and uncaptured precision', () => {
  assert.equal(qualifyDerivedValue('5.09%', 'EXACT'), '5.09%');
  assert.equal(qualifyDerivedValue('5.09%', 'APPROXIMATE'), 'Approximately 5.09%');
  assert.equal(
    qualifyDerivedValue('5.09%', null),
    '5.09% (denominator precision not captured)',
  );
  assert.equal(
    qualifyDealValueBasis('SEC-reported headline transaction value', 'APPROXIMATE'),
    'SEC-reported approximate headline transaction value',
  );
  assert.equal(
    qualifyDealValueBasis('USD 137,500,000 · headline transaction value', null),
    'USD 137,500,000 · headline transaction value (denominator precision not captured)',
  );
});
