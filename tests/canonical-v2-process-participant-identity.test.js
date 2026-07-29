const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessParticipantIdentity,
  validateProcessParticipantIdentity,
} = require('../lib/canonical-v2/process-participant-identity');
const participantContract = require(
  '../contracts/canonical-v2/successor/process/participants/process-participant.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    process_event_slot_key: 'EVENT_SLOT_001',
    process_participant_slot_key: 'PARTICIPANT_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed Process contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    participantContract.definition.participant_identity.stable_id_inputs,
  );
});

test('builds one deterministic participant identity from the five frozen inputs', () => {
  const first = buildProcessParticipantIdentity(baseIdentity());
  const second = buildProcessParticipantIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_PARTICIPANT_IDENTITY/V1');
  assert.equal(first.logical_type, 'ProcessParticipant');
  assert.equal(
    first.process_participant_id,
    contentId('PROCESS_PARTICIPANT/V1', baseIdentity()),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authority_limits), true);
  assert.doesNotThrow(() => validateProcessParticipantIdentity(first));
});

test('keeps merger of equals, reverse merger, RMT and share purchase slots neutral', () => {
  const structures = [
    ['MOE_COMBINATION_EVENT', 'COMBINATION_PARTY_A'],
    ['REVERSE_MERGER_EVENT', 'SURVIVING_ENTITY'],
    ['RMT_CONTRIBUTION_EVENT', 'CONTRIBUTING_PARTY'],
    ['SHARE_PURCHASE_EVENT', 'SELLING_SHAREHOLDER'],
  ];

  const identities = structures.map(([eventSlot, participantSlot], governedOrdinal) => (
    buildProcessParticipantIdentity(baseIdentity({
      process_event_slot_key: eventSlot,
      process_participant_slot_key: participantSlot,
      governed_ordinal: governedOrdinal,
    }))
  ));

  assert.equal(new Set(
    identities.map((identity) => identity.process_participant_id),
  ).size, structures.length);
  for (const identity of identities) {
    assert.equal(Object.hasOwn(identity, 'event_role_code'), false);
    assert.equal(Object.hasOwn(identity, 'transaction_role_code'), false);
    assert.equal(Object.hasOwn(identity, 'legal_role_code'), false);
    assert.equal(Object.hasOwn(identity, 'entity_subject_id'), false);
  }
});

test('does not unify participants across deals, event slots or participant slots', () => {
  const baseline = buildProcessParticipantIdentity(baseIdentity());
  const changedDeal = buildProcessParticipantIdentity(baseIdentity({
    governed_deal_admission_id: 'c'.repeat(64),
  }));
  const changedEvent = buildProcessParticipantIdentity(baseIdentity({
    process_event_slot_key: 'EVENT_SLOT_002',
  }));
  const changedParticipant = buildProcessParticipantIdentity(baseIdentity({
    process_participant_slot_key: 'PARTICIPANT_SLOT_002',
  }));

  assert.equal(new Set([
    baseline.process_participant_id,
    changedDeal.process_participant_id,
    changedEvent.process_participant_id,
    changedParticipant.process_participant_id,
  ]).size, 4);
});

test('rejects names, roles, bidder tracks, extracted values and model output', () => {
  const prohibitedInputs = [
    'bidder_track_id',
    'candidate_values',
    'cleaned_name',
    'display_name',
    'entity_subject_id',
    'event_role_code',
    'extracted_attributes',
    'legal_role_code',
    'model_output',
    'source_local_label',
    'transaction_role_code',
  ];

  for (const key of prohibitedInputs) {
    assert.throws(
      () => buildProcessParticipantIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'PROCESS_PARTICIPANT_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects malformed frozen identities and undeclared fields', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ process_event_slot_key: 'not governed' }),
    baseIdentity({ process_participant_slot_key: 'participant slot' }),
    baseIdentity({ process_event_slot_key: `EVENT_${'A'.repeat(123)}` }),
    baseIdentity({ process_participant_slot_key: `PARTICIPANT_${'A'.repeat(117)}` }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), event_date: '2026-01-01' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildProcessParticipantIdentity(input),
      (error) => error.code === 'INVALID_PROCESS_PARTICIPANT_IDENTITY',
    );
  }
});

test('detects participant ID, payload and authority mutations', () => {
  const changedId = clone(buildProcessParticipantIdentity(baseIdentity()));
  changedId.process_participant_slot_key = 'PARTICIPANT_SLOT_002';
  assert.throws(
    () => validateProcessParticipantIdentity(changedId),
    (error) => error.code === 'PROCESS_PARTICIPANT_ID_MISMATCH',
  );

  const changedPayload = clone(buildProcessParticipantIdentity(baseIdentity()));
  changedPayload.authority_limits.writer = 'ALLOWED';
  assert.throws(
    () => validateProcessParticipantIdentity(changedPayload),
    (error) => error.code === 'INVALID_PROCESS_PARTICIPANT_IDENTITY',
  );

  const changedDigest = clone(buildProcessParticipantIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'c'.repeat(64);
  assert.throws(
    () => validateProcessParticipantIdentity(changedDigest),
    (error) => error.code === 'PROCESS_PARTICIPANT_PAYLOAD_MISMATCH',
  );
});

test('grants no extraction, role, subject, track, write, release or production authority', () => {
  const identity = buildProcessParticipantIdentity(baseIdentity());

  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    participant_role: 'NONE',
    subject_binding: 'NONE',
    bidder_track: 'NONE',
    event_materialisation: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    import: 'NONE',
    activation: 'NONE',
  });
  for (const key of [
    'bidder_track_id',
    'event_role_code',
    'entity_subject_id',
    'source_local_subject_occurrence_id',
    'deal_participant_relationship_revision_id',
    'revision_state',
    'evidence_edges',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
