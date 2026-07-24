const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLandosIocCapexServingFixture,
} = require('../__fixtures__/canonical-v2/landos-ioc-capex-row');
const {
  buildLandosMaterialContractsServingFixture,
} = require('../__fixtures__/canonical-v2/landos-material-contracts-row');
const {
  compileFixtureContractV5,
} = require('../lib/canonical-v2/contract-bundle');
const {
  adaptSharedServingRow,
} = require('../lib/canonical-v2/shared-row-adapter');
const {
  validateSharedServingRow,
} = require('../lib/canonical-v2/shared-serving-row');

const CASES = Object.freeze([
  Object.freeze({
    build: buildLandosIocCapexServingFixture,
    claimKey: 'thresholdClaim',
    metricKey: 'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    label: 'Approximately 0.07% of headline deal value',
  }),
  Object.freeze({
    build: buildLandosMaterialContractsServingFixture,
    claimKey: 'thresholdClaim',
    metricKey: 'MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE',
    label: 'Approximately 0.07% of headline deal value',
  }),
]);

test('F5 Landos capex and material-contract producers classify source-described denominators as approximate', () => {
  const contractBundle = compileFixtureContractV5();
  for (const entry of CASES) {
    const fixture = entry.build({ contractBundle });
    const claim = fixture[entry.claimKey];
    assert.equal(claim.denominator.precision, 'APPROXIMATE');
    assert.equal(claim.attributes.denominator_precision, 'APPROXIMATE');
    assert.equal(validateSharedServingRow(fixture.row), true);
    const metric = adaptSharedServingRow(fixture.row).data.byRow[fixture.row.row_serving_key]
      .metrics[entry.metricKey];
    assert.equal(metric.subject.denominatorPrecision, 'APPROXIMATE');
    assert.equal(metric.subject.label, entry.label);
  }
});
