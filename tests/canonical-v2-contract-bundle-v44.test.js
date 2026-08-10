'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIXTURE_CONTRACT_INPUT_V43,
  FIXTURE_CONTRACT_INPUT_V44,
  compileFixtureContractV43,
  compileFixtureContractV44,
  validateContractBundle,
} = require('../lib/canonical-v2/contract-bundle');

const FROZEN_V43_FINGERPRINT = '24410edadc126f922e2d14a81a9aff9c7d16b1b268153ed9efdb37947b28943b';
const FROZEN_V44_FINGERPRINT = '60de951ad9655372a106b3c16b8a25be9ca3a8936004bc27306d1362e98dd1d3';

function frustrationDefinition(contract) {
  return contract.claim_definitions.find((definition) => (
    definition.claim_definition_key === 'FRUSTRATION_CAUSATION_STANDARD'
  ));
}

test('V44 admits PRIMARILY_CAUSED without rewriting V43', () => {
  const v43 = compileFixtureContractV43();
  const v44 = compileFixtureContractV44();
  const prior = frustrationDefinition(v43);
  const current = frustrationDefinition(v44);

  assert.equal(v43.fingerprint, FROZEN_V43_FINGERPRINT);
  assert.equal(validateContractBundle(v43), true);
  assert.equal(validateContractBundle(v44), true);
  assert.equal(v44.fingerprint, FROZEN_V44_FINGERPRINT);
  assert.equal(prior.version, 1);
  assert.equal(current.version, 1);
  assert.equal(prior.allowed_canonical_values.includes('PRIMARILY_CAUSED'), false);
  assert.deepEqual(
    current.allowed_canonical_values,
    [...prior.allowed_canonical_values, 'PRIMARILY_CAUSED'],
  );
});

test('V44 changes only the frustration-causation definition', () => {
  assert.deepEqual(FIXTURE_CONTRACT_INPUT_V44.concepts, FIXTURE_CONTRACT_INPUT_V43.concepts);
  assert.deepEqual(
    FIXTURE_CONTRACT_INPUT_V44.claim_definitions
      .filter((definition) => definition.claim_definition_key !== 'FRUSTRATION_CAUSATION_STANDARD'),
    FIXTURE_CONTRACT_INPUT_V43.claim_definitions
      .filter((definition) => definition.claim_definition_key !== 'FRUSTRATION_CAUSATION_STANDARD'),
  );
});
