const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessAgreementIdentity,
  validateProcessAgreementIdentity,
} = require('../lib/canonical-v2/process-agreement-identity');
const agreementContract = require(
  '../contracts/canonical-v2/successor/process/agreements/process-agreement.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    process_agreement_slot_key: 'PROCESS_AGREEMENT_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed ProcessAgreement contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    agreementContract.definition.agreement_identity.stable_id_inputs,
  );
});

test('builds one deterministic frozen identity without treating the slot as materialisation proof', () => {
  const first = buildProcessAgreementIdentity(baseIdentity());
  const second = buildProcessAgreementIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_AGREEMENT_IDENTITY/V1');
  assert.equal(first.logical_type, 'ProcessAgreement');
  assert.equal(
    first.process_agreement_id,
    contentId('PROCESS_AGREEMENT/V1', baseIdentity()),
  );
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.equal(first.agreement_type_registry_state, 'UNRESOLVED');
  assert.equal(first.document_stage_registry_state, 'UNRESOLVED');
  assert.equal(first.party_relationship_state, 'UNRESOLVED');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authority_limits), true);
  assert.doesNotThrow(() => validateProcessAgreementIdentity(first));
});

test('keeps confidentiality, standstill, exclusivity and other agreements in separate neutral slots', () => {
  const slots = [
    'AGREEMENT_CONFIDENTIALITY',
    'AGREEMENT_STANDSTILL',
    'AGREEMENT_EXCLUSIVITY',
    'AGREEMENT_OTHER',
  ];
  const identities = slots.map((slot, governedOrdinal) => (
    buildProcessAgreementIdentity(baseIdentity({
      process_agreement_slot_key: slot,
      governed_ordinal: governedOrdinal,
    }))
  ));

  assert.equal(
    new Set(identities.map((identity) => identity.process_agreement_id)).size,
    slots.length,
  );
  for (const identity of identities) {
    assert.equal(Object.hasOwn(identity, 'agreement_type_code'), false);
    assert.equal(Object.hasOwn(identity, 'document_stage_code'), false);
    assert.equal(Object.hasOwn(identity, 'version_number'), false);
    assert.equal(Object.hasOwn(identity, 'party_relationship_revision_ids'), false);
  }
});

test('does not unify agreements across contracts, deals, slots or ordinals', () => {
  const identities = [
    buildProcessAgreementIdentity(baseIdentity()),
    buildProcessAgreementIdentity(baseIdentity({
      frozen_contract_pair_digest: 'c'.repeat(64),
    })),
    buildProcessAgreementIdentity(baseIdentity({
      governed_deal_admission_id: 'd'.repeat(64),
    })),
    buildProcessAgreementIdentity(baseIdentity({
      process_agreement_slot_key: 'PROCESS_AGREEMENT_SLOT_002',
    })),
    buildProcessAgreementIdentity(baseIdentity({ governed_ordinal: 1 })),
  ];

  assert.equal(
    new Set(identities.map((identity) => identity.process_agreement_id)).size,
    identities.length,
  );
});

test('rejects types, stages, parties, versions, passages and timing as identity inputs', () => {
  const prohibited = [...new Set([
    ...agreementContract.definition.agreement_identity.prohibited_inputs,
    'agreement_state',
    'candidate_values',
    'evidence_edges',
    'expected_occurrence_id',
    'failure_detail',
    'precomputed_process_agreement_id',
    'process_relationship_revision_ids',
    'slot_binding',
    'version_number',
  ])];

  for (const key of prohibited) {
    assert.throws(
      () => buildProcessAgreementIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'PROCESS_AGREEMENT_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects malformed frozen identities, oversized keys and undeclared fields', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ process_agreement_slot_key: 'not governed' }),
    baseIdentity({
      process_agreement_slot_key: `AGREEMENT_${'A'.repeat(119)}`,
    }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), target_party: 'BUYER' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildProcessAgreementIdentity(input),
      (error) => error.code === 'INVALID_PROCESS_AGREEMENT_IDENTITY',
    );
  }
});

test('detects identity, boundary, payload and authority mutations', () => {
  const changedId = clone(buildProcessAgreementIdentity(baseIdentity()));
  changedId.process_agreement_slot_key = 'PROCESS_AGREEMENT_SLOT_002';
  assert.throws(
    () => validateProcessAgreementIdentity(changedId),
    (error) => error.code === 'PROCESS_AGREEMENT_ID_MISMATCH',
  );

  const changedBoundary = clone(buildProcessAgreementIdentity(baseIdentity()));
  changedBoundary.agreement_type_registry_state = 'ADMITTED';
  assert.throws(
    () => validateProcessAgreementIdentity(changedBoundary),
    (error) => error.code === 'INVALID_PROCESS_AGREEMENT_IDENTITY',
  );

  const changedAuthority = clone(buildProcessAgreementIdentity(baseIdentity()));
  changedAuthority.authority_limits.party_relationship = 'ALLOWED';
  assert.throws(
    () => validateProcessAgreementIdentity(changedAuthority),
    (error) => error.code === 'INVALID_PROCESS_AGREEMENT_IDENTITY',
  );

  const changedDigest = clone(buildProcessAgreementIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'c'.repeat(64);
  assert.throws(
    () => validateProcessAgreementIdentity(changedDigest),
    (error) => error.code === 'PROCESS_AGREEMENT_PAYLOAD_MISMATCH',
  );
});

test('grants no slot, classification, relationship, materialisation, write or release authority', () => {
  const identity = buildProcessAgreementIdentity(baseIdentity());

  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    expected_occurrence_slot_binding: 'NONE',
    agreement_type_registry: 'NONE',
    document_stage_registry: 'NONE',
    party_relationship: 'NONE',
    version_relationship: 'NONE',
    passage_binding: 'NONE',
    temporal_binding: 'NONE',
    agreement_revision: 'NONE',
    materialisation: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    import: 'NONE',
    activation: 'NONE',
  });
  for (const key of [
    'precomputed_expected_occurrence_id',
    'agreement_state',
    'agreement_type_code',
    'document_stage_code',
    'effective_temporal_expression_revision_id',
    'evidence_edges',
    'party_relationship_revision_ids',
    'process_passage_revision_ids',
    'process_relationship_revision_ids',
    'version_number',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
