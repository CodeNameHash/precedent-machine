const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessPositionIdentity,
  validateProcessPositionIdentity,
} = require('../lib/canonical-v2/process-position-identity');
const positionContract = require(
  '../contracts/canonical-v2/successor/process/positions/process-position.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    process_position_slot_key: 'PROCESS_POSITION_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed ProcessPosition contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    positionContract.definition.position_identity.stable_id_inputs,
  );
});

test('builds one deterministic frozen identity without treating the slot as materialisation proof', () => {
  const first = buildProcessPositionIdentity(baseIdentity());
  const second = buildProcessPositionIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_POSITION_IDENTITY/V1');
  assert.equal(first.logical_type, 'ProcessPosition');
  assert.equal(
    first.process_position_id,
    contentId('PROCESS_POSITION/V1', baseIdentity()),
  );
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.equal(first.subject_binding_state, 'UNRESOLVED');
  assert.equal(first.term_registry_state, 'UNRESOLVED');
  assert.equal(first.position_value_registry_state, 'UNRESOLVED');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authority_limits), true);
  assert.doesNotThrow(() => validateProcessPositionIdentity(first));
});

test('keeps requests, refusals, counterproposals and grants in separate neutral slots', () => {
  const slots = [
    'POSITION_REQUEST',
    'POSITION_REFUSAL',
    'POSITION_COUNTERPROPOSAL',
    'POSITION_GRANT',
  ];
  const identities = slots.map((slot, governedOrdinal) => (
    buildProcessPositionIdentity(baseIdentity({
      process_position_slot_key: slot,
      governed_ordinal: governedOrdinal,
    }))
  ));

  assert.equal(
    new Set(identities.map((identity) => identity.process_position_id)).size,
    slots.length,
  );
  for (const identity of identities) {
    assert.equal(Object.hasOwn(identity, 'position_code'), false);
    assert.equal(Object.hasOwn(identity, 'term_code'), false);
    assert.equal(Object.hasOwn(identity, 'process_participant_id'), false);
    assert.equal(Object.hasOwn(identity, 'bidder_track_id'), false);
  }
});

test('does not unify positions across contracts, deals, slots or ordinals', () => {
  const identities = [
    buildProcessPositionIdentity(baseIdentity()),
    buildProcessPositionIdentity(baseIdentity({
      frozen_contract_pair_digest: 'c'.repeat(64),
    })),
    buildProcessPositionIdentity(baseIdentity({
      governed_deal_admission_id: 'd'.repeat(64),
    })),
    buildProcessPositionIdentity(baseIdentity({
      process_position_slot_key: 'PROCESS_POSITION_SLOT_002',
    })),
    buildProcessPositionIdentity(baseIdentity({ governed_ordinal: 1 })),
  ];

  assert.equal(
    new Set(identities.map((identity) => identity.process_position_id)).size,
    identities.length,
  );
});

test('rejects subjects, values, links, evidence and model output as identity inputs', () => {
  const prohibited = [...new Set([
    ...positionContract.definition.position_identity.prohibited_inputs,
    'candidate_values',
    'evidence_edges',
    'expected_occurrence_id',
    'exact_source_formulation',
    'failure_detail',
    'position_state',
    'precomputed_process_position_id',
    'slot_binding',
    'subject_reference',
  ])];

  for (const key of prohibited) {
    assert.throws(
      () => buildProcessPositionIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'PROCESS_POSITION_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects malformed frozen identities, oversized keys and undeclared fields', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ process_position_slot_key: 'not governed' }),
    baseIdentity({
      process_position_slot_key: `POSITION_${'A'.repeat(120)}`,
    }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), transaction_structure: 'REVERSE_MERGER' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildProcessPositionIdentity(input),
      (error) => error.code === 'INVALID_PROCESS_POSITION_IDENTITY',
    );
  }
});

test('detects identity, boundary, payload and authority mutations', () => {
  const changedId = clone(buildProcessPositionIdentity(baseIdentity()));
  changedId.process_position_slot_key = 'PROCESS_POSITION_SLOT_002';
  assert.throws(
    () => validateProcessPositionIdentity(changedId),
    (error) => error.code === 'PROCESS_POSITION_ID_MISMATCH',
  );

  const changedBoundary = clone(buildProcessPositionIdentity(baseIdentity()));
  changedBoundary.term_registry_state = 'ADMITTED';
  assert.throws(
    () => validateProcessPositionIdentity(changedBoundary),
    (error) => error.code === 'INVALID_PROCESS_POSITION_IDENTITY',
  );

  const changedAuthority = clone(buildProcessPositionIdentity(baseIdentity()));
  changedAuthority.authority_limits.subject_binding = 'ALLOWED';
  assert.throws(
    () => validateProcessPositionIdentity(changedAuthority),
    (error) => error.code === 'INVALID_PROCESS_POSITION_IDENTITY',
  );

  const changedDigest = clone(buildProcessPositionIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'c'.repeat(64);
  assert.throws(
    () => validateProcessPositionIdentity(changedDigest),
    (error) => error.code === 'PROCESS_POSITION_PAYLOAD_MISMATCH',
  );
});

test('grants no slot, value, link, materialisation, write or release authority', () => {
  const identity = buildProcessPositionIdentity(baseIdentity());

  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    expected_occurrence_slot_binding: 'NONE',
    subject_binding: 'NONE',
    term_registry: 'NONE',
    position_value_registry: 'NONE',
    event_link: 'NONE',
    consideration_link: 'NONE',
    temporal_binding: 'NONE',
    position_revision: 'NONE',
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
    'bidder_track_revision_id',
    'consideration_package_revision_id',
    'evidence_edges',
    'exact_source_formulation',
    'position_code',
    'position_state',
    'process_event_revision_id',
    'process_participant_revision_id',
    'term_code',
    'temporal_expression_revision_id',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
