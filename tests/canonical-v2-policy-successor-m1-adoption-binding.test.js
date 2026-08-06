'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA,
  REQUIRED_BLOCKER_CODES,
  STATUS,
  buildCurrentPolicySuccessorM1AdoptionBinding,
  requireAdoptedPolicySuccessorM1Binding,
  validatePolicySuccessorM1AdoptionBinding,
} = require('../lib/canonical-v2/policy-successor-m1-adoption-binding');

function rehash(binding, changes) {
  const forged = { ...structuredClone(binding), ...changes };
  const { policy_successor_m1_adoption_binding_id: ignored, ...body } = forged;
  forged.policy_successor_m1_adoption_binding_id = contentId(POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA, body);
  return forged;
}

test('binds the exact complete V2 policy pair into a proposal-only successor-M1 record', () => {
  const binding = buildCurrentPolicySuccessorM1AdoptionBinding();
  assert.equal(binding.schema_version, POLICY_SUCCESSOR_M1_ADOPTION_BINDING_SCHEMA);
  assert.equal(binding.status, STATUS);
  assert.equal(binding.authority, 'NONE');
  assert.equal(binding.policy_adoption_authority, 'NONE');
  assert.equal(binding.adopted, false);
  assert.equal(binding.successor_m1_pass_receipt_id, null);
  assert.deepEqual(binding.required_blocker_codes, REQUIRED_BLOCKER_CODES);
  assert.equal(binding.policy_set_members.operational_policy_set_schema, 'OPERATIONAL_POLICY_SET_PROPOSAL/V2');
  assert.equal(binding.policy_set_members.certification_policy_manifest_schema, 'CERTIFICATION_POLICY_MANIFEST_PROPOSAL/V2');
  assert.match(binding.policy_set_members.operational_policy_set_proposal_id, /^[a-f0-9]{64}$/);
  assert.match(binding.policy_set_members.certification_policy_manifest_proposal_id, /^[a-f0-9]{64}$/);
  assert.deepEqual(validatePolicySuccessorM1AdoptionBinding(binding), binding);
  assert.throws(() => requireAdoptedPolicySuccessorM1Binding(binding), /externally verified passed successor M1 receipt/);
});

test('rejects caller-supplied policy identities before a successor-M1 record is built', () => {
  assert.throws(
    () => buildCurrentPolicySuccessorM1AdoptionBinding({ policy_set_digest: '0'.repeat(64) }),
    /accepts no caller values/,
  );
});

test('rejects rehashed forged digests, stale proposal IDs, self-issued PASS, partial sets and old policy schemas', () => {
  const binding = buildCurrentPolicySuccessorM1AdoptionBinding();
  const attempts = [
    rehash(binding, { policy_set_digest: '0'.repeat(64) }),
    rehash(binding, {
      policy_set_members: {
        ...binding.policy_set_members,
        operational_policy_set_proposal_id: '1'.repeat(64),
      },
    }),
    rehash(binding, { successor_m1_pass_receipt_id: '2'.repeat(64), adopted: true }),
    rehash(binding, {
      policy_set_members: {
        operational_policy_set_schema: binding.policy_set_members.operational_policy_set_schema,
        operational_policy_set_proposal_id: binding.policy_set_members.operational_policy_set_proposal_id,
      },
    }),
    rehash(binding, {
      policy_set_members: {
        ...binding.policy_set_members,
        certification_policy_manifest_schema: 'CERTIFICATION_POLICY_MANIFEST_PROPOSAL/V1',
      },
    }),
  ];
  for (const forged of attempts) {
    assert.throws(() => validatePolicySuccessorM1AdoptionBinding(forged));
  }
});
