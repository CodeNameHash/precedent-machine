const assert = require('node:assert/strict');
const test = require('node:test');

const contract = require(
  '../contracts/canonical-v2/successor/product/query/agreement-candidate-envelope.v1.json',
);
const {
  validateAuthoredAgreementCandidateEnvelopeInputs,
} = require(
  '../lib/canonical-v2/agreement-candidate-envelope-contract-input-validator',
);

function member(value = contract) {
  return {
    object_kind: value.object_kind,
    canonical_value: value,
  };
}

test('accepts one complete generic Agreement envelope contract', () => {
  assert.equal(
    validateAuthoredAgreementCandidateEnvelopeInputs([member()]),
    true,
  );
  assert.deepEqual(
    contract.definition.runtime_contract.admitted_family_profiles.map(
      (profile) => profile.profile_id,
    ),
    [
      'CAPITALISATION_BRING_DOWN_V3',
      'IOC_CAPEX_RESTRICTION_V1',
    ],
  );
});

test('rejects missing, duplicated and semantically changed contracts', () => {
  assert.throws(
    () => validateAuthoredAgreementCandidateEnvelopeInputs([]),
    /missing or duplicated/,
  );
  assert.throws(
    () => validateAuthoredAgreementCandidateEnvelopeInputs([
      member(),
      member(),
    ]),
    /missing or duplicated/,
  );
  const changed = structuredClone(contract);
  changed.definition.runtime_contract.authority.creates_serving_authority =
    true;
  assert.throws(
    () => validateAuthoredAgreementCandidateEnvelopeInputs([member(changed)]),
    /definition has changed/,
  );
});
