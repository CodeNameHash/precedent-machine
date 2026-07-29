const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildProcessPhaseIdentity,
  validateProcessPhaseIdentity,
} = require('../lib/canonical-v2/process-phase-identity');
const {
  buildBidderTrackIdentity,
} = require('../lib/canonical-v2/process-bidder-track-identity');
const phaseContract = require(
  '../contracts/canonical-v2/successor/process/phases/process-phase.v1.json',
);

const FROZEN_CONTRACT_PAIR_DIGEST = 'a'.repeat(64);
const GOVERNED_DEAL_ADMISSION_ID = 'b'.repeat(64);

function dealScope() {
  return {
    scope_kind: 'DEAL',
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
  };
}

function bidderTrackIdentity(overrides = {}) {
  return buildBidderTrackIdentity({
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    bidder_track_slot_key: 'BIDDER_TRACK_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  });
}

function bidderTrackScope(track = bidderTrackIdentity()) {
  return {
    scope_kind: 'BIDDER_TRACK',
    bidder_track_id: track.bidder_track_id,
  };
}

function baseIdentity(overrides = {}) {
  return {
    frozen_contract_pair_digest: FROZEN_CONTRACT_PAIR_DIGEST,
    governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID,
    phase_scope_kind_and_id: dealScope(),
    process_phase_slot_key: 'PHASE_SLOT_001',
    governed_ordinal: 0,
    ...overrides,
  };
}

function bidderTrackBindings(track = bidderTrackIdentity(), overrides = {}) {
  return {
    bidder_track_identity: track,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('uses exactly the stable identity inputs in the signed Process contract', () => {
  assert.deepEqual(
    Object.keys(baseIdentity()),
    phaseContract.definition.phase_identity.stable_id_inputs,
  );
});

test('builds one deterministic deal-scoped phase identity', () => {
  const first = buildProcessPhaseIdentity(baseIdentity());
  const second = buildProcessPhaseIdentity(baseIdentity());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_PHASE_IDENTITY/V1');
  assert.equal(first.logical_type, 'ProcessPhase');
  assert.equal(
    first.process_phase_id,
    contentId('PROCESS_PHASE/V1', baseIdentity()),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.phase_scope_kind_and_id), true);
  assert.equal(Object.isFrozen(first.authority_limits), true);
  assert.doesNotThrow(() => validateProcessPhaseIdentity(first));
});

test('requires the deal-scoped phase to bind the exact admitted deal', () => {
  assert.throws(
    () => buildProcessPhaseIdentity(baseIdentity({
      phase_scope_kind_and_id: {
        scope_kind: 'DEAL',
        governed_deal_admission_id: 'd'.repeat(64),
      },
    })),
    (error) => error.code === 'PROCESS_PHASE_DEAL_SCOPE_MISMATCH',
  );
});

test('binds bidder-track scope through a governed identity validator', () => {
  const input = baseIdentity({
    phase_scope_kind_and_id: bidderTrackScope(),
  });
  const bindings = bidderTrackBindings();
  const phase = buildProcessPhaseIdentity(input, bindings);

  assert.equal(
    phase.phase_scope_kind_and_id.bidder_track_id,
    bindings.bidder_track_identity.bidder_track_id,
  );
  assert.doesNotThrow(() => validateProcessPhaseIdentity(phase, bindings));
});

test('rejects missing, invalid, cross-deal and cross-contract bidder-track bindings', () => {
  const input = baseIdentity({
    phase_scope_kind_and_id: bidderTrackScope(),
  });
  const wrongDeal = bidderTrackIdentity({
    governed_deal_admission_id: 'd'.repeat(64),
  });
  const wrongPair = bidderTrackIdentity({
    frozen_contract_pair_digest: 'e'.repeat(64),
  });
  const wrongTrack = bidderTrackIdentity({
    bidder_track_slot_key: 'BIDDER_TRACK_SLOT_002',
  });
  const invalidPayload = clone(bidderTrackIdentity());
  invalidPayload.canonical_payload_digest = 'f'.repeat(64);
  const invalidBindings = [
    undefined,
    bidderTrackBindings(wrongDeal),
    bidderTrackBindings(wrongPair),
    bidderTrackBindings(wrongTrack),
    bidderTrackBindings(invalidPayload),
  ];

  for (const bindings of invalidBindings) {
    assert.throws(
      () => buildProcessPhaseIdentity(input, bindings),
      (error) => [
        'INVALID_PROCESS_PHASE_BIDDER_TRACK_SCOPE',
        'PROCESS_PHASE_BIDDER_TRACK_SCOPE_MISMATCH',
      ].includes(error.code),
    );
  }
});

test('rejects forged BidderTrack identity, payload, authority and injected validator fields', () => {
  const track = bidderTrackIdentity();
  const input = baseIdentity({
    phase_scope_kind_and_id: bidderTrackScope(track),
  });
  const forgedId = clone(track);
  forgedId.bidder_track_id = 'd'.repeat(64);
  const forgedPayload = clone(track);
  forgedPayload.canonical_payload_digest = 'e'.repeat(64);
  const forgedAuthority = clone(track);
  forgedAuthority.authority_limits.event_membership = 'ALLOWED';

  for (const bidder_track_identity of [
    forgedId,
    forgedPayload,
    forgedAuthority,
  ]) {
    assert.throws(
      () => buildProcessPhaseIdentity(
        input,
        bidderTrackBindings(bidder_track_identity),
      ),
      (error) => error.code === 'INVALID_PROCESS_PHASE_BIDDER_TRACK_SCOPE',
    );
  }
  assert.throws(
    () => buildProcessPhaseIdentity(input, {
      bidder_track_identity: track,
      validate_bidder_track_identity(value) {
        return value;
      },
    }),
    (error) => error.code === 'INVALID_PROCESS_PHASE_BIDDER_TRACK_SCOPE',
  );
});

test('rejects arbitrary and structurally widened scope variants', () => {
  const track = bidderTrackIdentity();
  const invalidScopes = [
    { scope_kind: 'PROVISION', provision_id: 'd'.repeat(64) },
    { scope_kind: 'DEAL', governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID, bidder_track_id: track.bidder_track_id },
    { scope_kind: 'BIDDER_TRACK', bidder_track_id: track.bidder_track_id, governed_deal_admission_id: GOVERNED_DEAL_ADMISSION_ID },
  ];

  for (const phase_scope_kind_and_id of invalidScopes) {
    assert.throws(
      () => buildProcessPhaseIdentity(
        baseIdentity({ phase_scope_kind_and_id }),
        phase_scope_kind_and_id.scope_kind === 'BIDDER_TRACK'
          ? bidderTrackBindings()
          : undefined,
      ),
      (error) => error.code === 'INVALID_PROCESS_PHASE_SCOPE',
    );
  }
});

test('keeps deal and bidder-track phases distinct without using phase values', () => {
  const dealPhase = buildProcessPhaseIdentity(baseIdentity());
  const trackPhase = buildProcessPhaseIdentity(
    baseIdentity({ phase_scope_kind_and_id: bidderTrackScope() }),
    bidderTrackBindings(),
  );

  assert.notEqual(dealPhase.process_phase_id, trackPhase.process_phase_id);
  for (const phase of [dealPhase, trackPhase]) {
    for (const key of [
      'event_ids',
      'phase_code',
      'phase_end',
      'phase_label',
      'phase_start',
    ]) {
      assert.equal(Object.hasOwn(phase, key), false);
    }
  }
});

test('rejects values, events, model output and self-asserted slot resolution', () => {
  const prohibitedInputs = [
    'candidate_values',
    'event_ids',
    'expected_occurrence_id',
    'extracted_attributes',
    'model_output',
    'phase_code',
    'phase_end',
    'phase_label',
    'phase_start',
    'precomputed_process_phase_id',
    'slot_binding',
  ];

  for (const key of prohibitedInputs) {
    assert.throws(
      () => buildProcessPhaseIdentity({
        ...baseIdentity(),
        [key]: 'forbidden',
      }),
      (error) => (
        error.code === 'PROCESS_PHASE_VALUE_DERIVED_IDENTITY'
        && error.details.prohibited_identity_inputs.includes(key)
      ),
    );
  }
});

test('rejects malformed frozen identities, unbounded slot keys and undeclared fields', () => {
  const invalidInputs = [
    baseIdentity({ frozen_contract_pair_digest: 'not-a-digest' }),
    baseIdentity({ governed_deal_admission_id: '' }),
    baseIdentity({ process_phase_slot_key: 'not governed' }),
    baseIdentity({ process_phase_slot_key: `PHASE_${'A'.repeat(123)}` }),
    baseIdentity({ governed_ordinal: -1 }),
    baseIdentity({ governed_ordinal: Number.MAX_SAFE_INTEGER + 1 }),
    { ...baseIdentity(), source_date: '2026-01-01' },
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => buildProcessPhaseIdentity(input),
      (error) => error.code === 'INVALID_PROCESS_PHASE_IDENTITY',
    );
  }
});

test('detects phase ID, payload, scope and authority mutations', () => {
  const changedId = clone(buildProcessPhaseIdentity(baseIdentity()));
  changedId.process_phase_slot_key = 'PHASE_SLOT_002';
  assert.throws(
    () => validateProcessPhaseIdentity(changedId),
    (error) => error.code === 'PROCESS_PHASE_ID_MISMATCH',
  );

  const changedScope = clone(buildProcessPhaseIdentity(baseIdentity()));
  changedScope.phase_scope_kind_and_id.governed_deal_admission_id =
    'd'.repeat(64);
  assert.throws(
    () => validateProcessPhaseIdentity(changedScope),
    (error) => error.code === 'PROCESS_PHASE_DEAL_SCOPE_MISMATCH',
  );

  const changedBoundary = clone(buildProcessPhaseIdentity(baseIdentity()));
  changedBoundary.expected_occurrence_slot_binding_state = 'VERIFIED';
  assert.throws(
    () => validateProcessPhaseIdentity(changedBoundary),
    (error) => error.code === 'INVALID_PROCESS_PHASE_IDENTITY',
  );

  const changedAuthority = clone(buildProcessPhaseIdentity(baseIdentity()));
  changedAuthority.authority_limits.materialisation = 'ALLOWED';
  assert.throws(
    () => validateProcessPhaseIdentity(changedAuthority),
    (error) => error.code === 'INVALID_PROCESS_PHASE_IDENTITY',
  );

  const changedDigest = clone(buildProcessPhaseIdentity(baseIdentity()));
  changedDigest.canonical_payload_digest = 'd'.repeat(64);
  assert.throws(
    () => validateProcessPhaseIdentity(changedDigest),
    (error) => error.code === 'PROCESS_PHASE_PAYLOAD_MISMATCH',
  );
});

test('grants no phase values, slot resolution, materialisation or downstream authority', () => {
  const identity = buildProcessPhaseIdentity(baseIdentity());

  assert.equal(identity.materialisation_state, 'IDENTITY_ONLY');
  assert.equal(identity.expected_occurrence_slot_binding_state, 'UNRESOLVED');
  assert.deepEqual(identity.authority_limits, {
    execution: 'NONE',
    phase_code: 'NONE',
    phase_state: 'NONE',
    event_membership: 'NONE',
    temporal_expression: 'NONE',
    occurrence_slot_resolution: 'NONE',
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
    'phase_code',
    'phase_state',
    'ordered_process_event_relationship_revision_ids',
    'temporal_expression_revision_ids',
    'evidence_edges',
    'precomputed_process_phase_id',
  ]) {
    assert.equal(Object.hasOwn(identity, key), false);
  }
});
