const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildBidderTrackIdentity,
  validateBidderTrackIdentity,
} = require('../lib/canonical-v2/process-bidder-track-identity');
const bidderTrackContract = require(
  '../contracts/canonical-v2/successor/process/bidder-tracks/bidder-track.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    bidder_track_slot_key: 'BIDDER_TRACK_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed BidderTrack contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    bidderTrackContract.definition.track_identity.stable_id_inputs,
  );
});

test('builds one deterministic identity without treating the slot as materialisation proof', () => {
  const first = buildBidderTrackIdentity(baseIdentity());
  const second = buildBidderTrackIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'BIDDER_TRACK_IDENTITY/V1');
  assert.equal(first.logical_type, 'BidderTrack');
  assert.equal(
    first.bidder_track_id,
    contentId('BIDDER_TRACK/V1', baseIdentity()),
  );
  assert.equal(first.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(first.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.equal(
    bidderTrackContract.definition.occurrence_slot_contract
      .slot_key_is_self_authorising,
    false,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.authority_limits), true);
  assert.doesNotThrow(() => validateBidderTrackIdentity(first));
});

test('keeps two bidders, a consortium and an umbrella counterparty as separate neutral slots', () => {
  const slots = [
    'BIDDER_TRACK_PARTY_1',
    'BIDDER_TRACK_PARTY_2',
    'BIDDER_TRACK_CONSORTIUM',
    'BIDDER_TRACK_UMBRELLA_COUNTERPARTY',
  ];
  const identities = slots.map((slot, governedOrdinal) => (
    buildBidderTrackIdentity(baseIdentity({
      bidder_track_slot_key: slot,
      governed_ordinal: governedOrdinal,
    }))
  ));

  assert.equal(new Set(
    identities.map((identity) => identity.bidder_track_id),
  ).size, slots.length);
  for (const identity of identities) {
    assert.equal(Object.hasOwn(identity, 'display_name'), false);
    assert.equal(Object.hasOwn(identity, 'entity_subject_id'), false);
    assert.equal(Object.hasOwn(identity, 'process_participant_ids'), false);
    assert.equal(Object.hasOwn(identity, 'event_ids'), false);
    assert.equal(Object.hasOwn(identity, 'track_state'), false);
  }
});

test('does not unify tracks across deals, slots or governed ordinals', () => {
  const baseline = buildBidderTrackIdentity(baseIdentity());
  const changedDeal = buildBidderTrackIdentity(baseIdentity({
    governed_deal_admission_id: 'c'.repeat(64),
  }));
  const changedSlot = buildBidderTrackIdentity(baseIdentity({
    bidder_track_slot_key: 'BIDDER_TRACK_SLOT_002',
  }));
  const changedOrdinal = buildBidderTrackIdentity(baseIdentity({
    governed_ordinal: 1,
  }));

  assert.equal(new Set([
    baseline.bidder_track_id,
    changedDeal.bidder_track_id,
    changedSlot.bidder_track_id,
    changedOrdinal.bidder_track_id,
  ]).size, 4);
});

test('rejects names, dates, economics, subjects, memberships, state and model output', () => {
  const prohibitedInputs = [...new Set([
    ...bidderTrackContract.definition.track_identity.prohibited_inputs,
    'candidate_values',
    'event_ids',
    'extracted_attributes',
    'identity_state',
    'track_state',
  ])];

  for (const key of prohibitedInputs) {
    assert.throws(
      () => buildBidderTrackIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'BIDDER_TRACK_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects malformed frozen identities, oversized keys and undeclared fields', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ bidder_track_slot_key: 'not governed' }),
    baseIdentity({ bidder_track_slot_key: `TRACK_${'A'.repeat(123)}` }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), transaction_structure: 'REVERSE_MERGER' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildBidderTrackIdentity(input),
      (error) => error.code === 'INVALID_BIDDER_TRACK_IDENTITY',
    );
  }
});

test('detects identity, boundary-state, payload and authority mutations', () => {
  const changedId = clone(buildBidderTrackIdentity(baseIdentity()));
  changedId.bidder_track_slot_key = 'BIDDER_TRACK_SLOT_002';
  assert.throws(
    () => validateBidderTrackIdentity(changedId),
    (error) => error.code === 'BIDDER_TRACK_ID_MISMATCH',
  );

  const changedBoundary = clone(buildBidderTrackIdentity(baseIdentity()));
  changedBoundary.expected_occurrence_slot_binding_state = 'VERIFIED';
  assert.throws(
    () => validateBidderTrackIdentity(changedBoundary),
    (error) => error.code === 'INVALID_BIDDER_TRACK_IDENTITY',
  );

  const changedAuthority = clone(buildBidderTrackIdentity(baseIdentity()));
  changedAuthority.authority_limits.event_membership = 'ALLOWED';
  assert.throws(
    () => validateBidderTrackIdentity(changedAuthority),
    (error) => error.code === 'INVALID_BIDDER_TRACK_IDENTITY',
  );

  const changedDigest = clone(buildBidderTrackIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'c'.repeat(64);
  assert.throws(
    () => validateBidderTrackIdentity(changedDigest),
    (error) => error.code === 'BIDDER_TRACK_PAYLOAD_MISMATCH',
  );
});

test('grants no slot-binding, extraction, membership, write, release or production authority', () => {
  const identity = buildBidderTrackIdentity(baseIdentity());

  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    expected_occurrence_slot_binding: 'NONE',
    subject_binding: 'NONE',
    identity_bridge: 'NONE',
    participant_membership: 'NONE',
    event_membership: 'NONE',
    track_state: 'NONE',
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
    'entity_subject_id',
    'source_local_subject_occurrence_ids',
    'process_participant_ids',
    'ordered_process_event_relationship_revision_ids',
    'track_state',
    'evidence_edges',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
