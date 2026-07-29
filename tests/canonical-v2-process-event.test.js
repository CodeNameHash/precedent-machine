const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  buildProcessEventIdentity,
  freezeProcessEventIdentitySet,
  freezeProcessEventSlotUniverse,
  validateProcessEventIdentity,
  validateProcessEventSlotUniverse,
} = require('../lib/canonical-v2/process-event');
const {
  freezeProcessNarrationOccurrenceSet,
} = require('../lib/canonical-v2/process-narration-occurrence');
const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');

function digest(label) {
  return crypto.createHash('sha256').update(label).digest('hex');
}

const FROZEN_PAIR = digest('frozen-pair');
const DEAL = digest('deal');
const EVENT_DEFINITION = Object.freeze({
  definition_key: 'PROCESS_EVENT',
  definition_version: 1,
});

function narrationOccurrences({
  frozenContractPairDigest = FROZEN_PAIR,
  governedDealAdmissionId = DEAL,
} = {}) {
  return freezeProcessNarrationOccurrenceSet({
    frozen_contract_pair_digest: frozenContractPairDigest,
    governed_deal_admission_id: governedDealAdmissionId,
    narration_definition_key_and_version: {
      definition_key: 'PROCESS_NARRATION_OCCURRENCE',
      definition_version: 1,
    },
    candidates: [100, 200, 300].map((absoluteStart, documentOrdinal) => ({
      canonical_source_interval_set: {
        coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
        intervals: [{
          admitted_source_occurrence_id: digest(`source-${documentOrdinal}`),
          document_hash: digest(`document-${documentOrdinal}`),
          document_ordinal: documentOrdinal,
          absolute_start: absoluteStart,
          absolute_end: absoluteStart + 40,
          exact_bytes_digest: digest(`bytes-${documentOrdinal}`),
        }],
      },
    })),
  });
}

function candidate(slotKey, narrations, evidenceLabel) {
  return {
    process_event_slot_key: slotKey,
    event_definition_key_and_version: EVENT_DEFINITION,
    process_narration_occurrences: narrations,
    event_grouping_evidence_ids: [digest(evidenceLabel)],
    expected_result_slot_key: 'PROCESS_EVENT_RESULT',
  };
}

function frozenFixture() {
  const narrations = narrationOccurrences();
  const slots = freezeProcessEventSlotUniverse({
    frozen_contract_pair_digest: FROZEN_PAIR,
    governed_deal_admission_id: DEAL,
    frozen_narration_occurrence_universe: narrations,
    candidates: [
      candidate('EVENT_SLOT_B', [narrations[2]], 'group-b'),
      candidate('EVENT_SLOT_A', [narrations[1], narrations[0]], 'group-a'),
    ],
  });
  return { narrations, slots };
}

function buildInput(fixture = frozenFixture(), slotKey = 'EVENT_SLOT_A') {
  return {
    frozen_event_slot_universe: fixture.slots,
    frozen_narration_occurrence_universe: fixture.narrations,
    process_event_slot_key: slotKey,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('freezes one deterministic exact expected-slot universe before event identity', () => {
  const first = frozenFixture();
  const second = frozenFixture();

  assert.deepEqual(first.slots, second.slots);
  assert.doesNotThrow(() => validateProcessEventSlotUniverse(first.slots));
  assert.equal(first.slots.partition_status, 'COMPLETE_EXACT');
  assert.equal(first.slots.unresolved_member_count, 0);
  assert.equal(Object.isFrozen(first.slots), true);
  assert.equal(first.slots.expected_event_slots.length, 2);
});

test('builds only the precomputed ProcessEvent ID for a governed event slot', () => {
  const fixture = frozenFixture();
  const event = buildProcessEventIdentity(buildInput(fixture));
  const expectedSlot = fixture.slots.expected_event_slots.find(
    (slot) => slot.process_event_slot_key === 'EVENT_SLOT_A',
  );

  assert.equal(event.process_event_id, expectedSlot.precomputed_process_event_id);
  assert.equal(event.process_event_slot_key, 'EVENT_SLOT_A');
  assert.equal(
    event.scope_stage_freeze.scope_stage_freeze_id,
    fixture.slots.scope_stage_freeze_id,
  );
  assert.equal(
    event.scope_stage_freeze.expected_slot_digest,
    expectedSlot.expected_slot_digest,
  );
  assert.doesNotThrow(() => validateProcessEventIdentity(event, fixture.slots));
  assert.equal(event.materialisation_state, 'IDENTITY_ONLY');
});

test('orders narrations and event slots by frozen governed source ordinals', () => {
  const fixture = frozenFixture();
  const events = freezeProcessEventIdentitySet({
    frozen_event_slot_universe: fixture.slots,
    frozen_narration_occurrence_universe: fixture.narrations,
  });

  assert.deepEqual(events.map((event) => event.governed_ordinal), [0, 1]);
  assert.deepEqual(events.map((event) => event.process_event_slot_key), [
    'EVENT_SLOT_A',
    'EVENT_SLOT_B',
  ]);
  assert.deepEqual(events[0].ordered_process_narration_occurrence_ids, [
    fixture.narrations[0].process_narration_occurrence_id,
    fixture.narrations[1].process_narration_occurrence_id,
  ]);
});

test('dates, event labels, participants and extracted values cannot create slots', () => {
  const narrations = narrationOccurrences();
  for (const [field, value] of [
    ['event_date', '2026-01-01'],
    ['event_type_code', 'MEETING'],
    ['participant_revision_ids', [digest('participant')]],
    ['candidate_values', { label: 'meeting' }],
    ['extracted_attributes', { date: '2026-01-01' }],
    ['model_output', 'same event'],
    ['selected_revision_id', digest('revision')],
  ]) {
    assert.throws(
      () => freezeProcessEventSlotUniverse({
        frozen_contract_pair_digest: FROZEN_PAIR,
        governed_deal_admission_id: DEAL,
        frozen_narration_occurrence_universe: narrations,
        candidates: [{
          ...candidate('EVENT_SLOT_A', narrations, 'group'),
          [field]: value,
        }],
      }),
      (error) => error.code === 'PROCESS_EVENT_VALUE_DERIVED_IDENTITY',
    );
  }
});

test('paragraph boundaries and same-day grouping cannot create slots', () => {
  const narrations = narrationOccurrences();
  for (const [field, value] of [
    ['paragraph_id', 'paragraph-12'],
    ['paragraph_number', 12],
    ['same_date_group', '2026-01-01'],
  ]) {
    assert.throws(
      () => freezeProcessEventSlotUniverse({
        frozen_contract_pair_digest: FROZEN_PAIR,
        governed_deal_admission_id: DEAL,
        frozen_narration_occurrence_universe: narrations,
        candidates: [{
          ...candidate('EVENT_SLOT_A', narrations, 'group'),
          [field]: value,
        }],
      }),
      (error) => error.code === 'PROCESS_EVENT_GRANULARITY_DERIVED_IDENTITY',
    );
  }
});

test('missing, reused and outside narrations fail the exact partition', () => {
  const narrations = narrationOccurrences();
  assert.throws(
    () => freezeProcessEventSlotUniverse({
      frozen_contract_pair_digest: FROZEN_PAIR,
      governed_deal_admission_id: DEAL,
      frozen_narration_occurrence_universe: narrations,
      candidates: [
        candidate('EVENT_SLOT_A', [narrations[0], narrations[1]], 'partial'),
      ],
    }),
    (error) => error.code === 'INCOMPLETE_PROCESS_EVENT_NARRATION_PARTITION',
  );
  assert.throws(
    () => freezeProcessEventSlotUniverse({
      frozen_contract_pair_digest: FROZEN_PAIR,
      governed_deal_admission_id: DEAL,
      frozen_narration_occurrence_universe: narrations,
      candidates: [
        candidate('EVENT_SLOT_A', [narrations[0], narrations[1]], 'first'),
        candidate('EVENT_SLOT_B', [narrations[1], narrations[2]], 'second'),
      ],
    }),
    (error) => error.code === 'PROCESS_EVENT_NARRATION_MEMBER_REUSED',
  );
  const otherDealNarration = narrationOccurrences({
    governedDealAdmissionId: digest('other-deal'),
  })[0];
  assert.throws(
    () => freezeProcessEventSlotUniverse({
      frozen_contract_pair_digest: FROZEN_PAIR,
      governed_deal_admission_id: DEAL,
      frozen_narration_occurrence_universe: narrations,
      candidates: [
        candidate('EVENT_SLOT_A', [
          narrations[0],
          narrations[1],
          otherDealNarration,
        ], 'outside'),
      ],
    }),
    (error) => error.code === 'PROCESS_EVENT_NARRATION_SCOPE_MISMATCH',
  );
});

test('a caller boolean or arbitrary freeze digest cannot replace the slot universe', () => {
  const fixture = frozenFixture();
  assert.throws(
    () => buildProcessEventIdentity({
      ...buildInput(fixture),
      member_universe_complete: true,
    }),
    (error) => error.code === 'INVALID_PROCESS_EVENT_IDENTITY',
  );
  const altered = clone(fixture.slots);
  altered.scope_stage_freeze_id = digest('arbitrary-freeze');
  assert.throws(
    () => buildProcessEventIdentity({
      ...buildInput(fixture),
      frozen_event_slot_universe: altered,
    }),
    (error) => error.code === 'PROCESS_EVENT_SLOT_UNIVERSE_DIGEST_MISMATCH',
  );
});

test('identity construction requires the exact supplied frozen narration universe', () => {
  const fixture = frozenFixture();
  assert.throws(
    () => buildProcessEventIdentity({
      ...buildInput(fixture),
      frozen_narration_occurrence_universe: fixture.narrations.slice(0, 2),
    }),
    (error) => error.code === 'PROCESS_EVENT_NARRATION_UNIVERSE_MISMATCH',
  );
});

test('a later retelling remains a separate expected slot and event identity', () => {
  const fixture = frozenFixture();
  const first = buildProcessEventIdentity(buildInput(fixture, 'EVENT_SLOT_A'));
  const retelling = buildProcessEventIdentity(buildInput(fixture, 'EVENT_SLOT_B'));

  assert.notEqual(first.process_event_id, retelling.process_event_id);
  assert.equal(Object.hasOwn(first, 'process_relationship_revision_ids'), false);
  assert.equal(Object.hasOwn(retelling, 'event_type_code'), false);
});

test('validation rejects slot, precomputed-ID and event payload drift', () => {
  const fixture = frozenFixture();
  const alteredSlots = clone(fixture.slots);
  alteredSlots.expected_event_slots[0].precomputed_process_event_id =
    digest('replacement-event');
  assert.throws(
    () => validateProcessEventSlotUniverse(alteredSlots),
    (error) => error.code === 'PROCESS_EVENT_SLOT_ID_MISMATCH',
  );

  const event = buildProcessEventIdentity(buildInput(fixture));
  const changedEvent = clone(event);
  changedEvent.scope_stage_freeze.expected_slot_digest = digest('other-slot');
  assert.throws(
    () => validateProcessEventIdentity(changedEvent, fixture.slots),
    (error) => error.code === 'INVALID_PROCESS_EVENT_IDENTITY',
  );
});

test('standalone validation rejects a reordered and re-digested narration universe', () => {
  const fixture = frozenFixture();
  const altered = clone(fixture.slots);
  altered.narration_occurrence_references.reverse();
  const body = { ...altered };
  delete body.scope_stage_freeze_id;
  delete body.canonical_payload_digest;
  altered.scope_stage_freeze_id = contentId(
    'PROCESS_EVENT_SLOT_UNIVERSE/V1',
    body,
  );
  altered.canonical_payload_digest = contentId(
    'PROCESS_EVENT_SLOT_UNIVERSE_PAYLOAD/V1',
    body,
  );

  assert.throws(
    () => validateProcessEventSlotUniverse(altered),
    (error) => error.code === 'INVALID_PROCESS_EVENT_SLOT_UNIVERSE',
  );
});

test('grants no event revision, writer, serving, release or database authority', () => {
  const fixture = frozenFixture();
  const event = buildProcessEventIdentity(buildInput(fixture));

  assert.deepEqual(event.authority_limits, {
    runtime_event: 'NONE',
    event_revision: 'NONE',
    writer: 'NONE',
    serving: 'NONE',
    release: 'NONE',
    canonical_write: 'NONE',
    database_write: 'NONE',
    activation: 'NONE',
  });
  assert.equal(Object.hasOwn(event, 'process_event_revision_id'), false);
  assert.equal(Object.hasOwn(event, 'candidate_values'), false);
  assert.equal(Object.hasOwn(event, 'event_date'), false);
});
