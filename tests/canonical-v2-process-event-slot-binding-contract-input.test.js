const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PROCESS_EXPECTED_OCCURRENCE_SLOT_IDS,
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(fs.readFileSync(
    path.join(ROOT, relativePath),
    'utf8',
  ));
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function processMembers() {
  return [
    loadMember('process/agreements/process-agreement.v1.json'),
    loadMember('process/bidder-tracks/bidder-track.v1.json'),
    loadMember('process/domain/process-domain-registry.v1.json'),
    loadMember('process/events/process-event.v1.json'),
    loadMember('process/fields/process-field-definition-catalogue.v1.json'),
    loadMember('process/narration/process-narration-occurrence.v1.json'),
    loadMember('process/occurrence-slots/process-event.v1.json'),
    loadMember('process/occurrence-slots/process-narration.v1.json'),
    loadMember('process/participants/process-participant.v1.json'),
    loadMember('process/passages/process-passage.v1.json'),
    loadMember('process/phases/process-phase.v1.json'),
    loadMember('process/positions/process-position.v1.json'),
    loadMember('process/predicates/process-predicate-witness.v2.json'),
    loadMember('process/registries/process-controlled-code-registry.v2.json'),
    loadMember('process/relationships/process-relationship.v2.json'),
  ];
}

function eventSlot(members) {
  return members.find(
    (member) => member.canonical_value.stable_id
      === 'PROCESS_EVENT_SLOT_BINDING',
  ).canonical_value;
}

test('binds one governed event slot to its precomputed ProcessEvent ID', () => {
  const members = processMembers();
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members));

  const binding = eventSlot(members).definition;
  assert.deepEqual(PROCESS_EXPECTED_OCCURRENCE_SLOT_IDS, [
    'PROCESS_EVENT_SLOT_BINDING',
    'PROCESS_NARRATION',
  ]);
  assert.equal(binding.runtime_logical_type, 'ExpectedOccurrenceSlot');
  assert.deepEqual(
    binding.process_event_identity_binding_contract.stable_id_inputs,
    members.find(
      (member) => member.canonical_value.stable_id === 'PROCESS_EVENT',
    ).canonical_value.definition.event_identity.stable_id_inputs,
  );
  assert.equal(
    binding.process_event_identity_binding_contract
      .precomputed_process_event_id_exact_equality_required,
    true,
  );
  assert.equal(
    binding.process_event_identity_binding_contract
      .process_event_slot_key_equals_process_event_id,
    false,
  );
});

test('supplies the explicit ProcessParticipant slot-to-event bridge', () => {
  const binding = eventSlot(processMembers()).definition;
  assert.deepEqual(binding.participant_bridge_contract, {
    participant_definition_stable_id: 'PROCESS_PARTICIPANT',
    participant_identity_slot_field: 'process_event_slot_key',
    participant_identity_slot_value_source:
      'expected_occurrence_slot.process_event_slot_key',
    participant_revision_event_field: 'process_event_id',
    participant_revision_event_value_source:
      'expected_occurrence_slot.precomputed_process_event_id',
    slot_and_event_id_bridge_required_before_materialisation: true,
    participant_slot_key_can_substitute_for_final_event_id: false,
    final_event_id_can_replace_participant_slot_identity_input: false,
  });
});

test('rejects a missing, duplicate or changed event-slot binding', () => {
  const missing = processMembers().filter(
    (member) => member.canonical_value.stable_id
      !== 'PROCESS_EVENT_SLOT_BINDING',
  );
  assert.throws(
    () => validateAuthoredProcessInputs(missing),
    { code: 'PROCESS_BASE_CONTRACT_CARDINALITY_MISMATCH' },
  );

  const duplicate = processMembers();
  duplicate.push(clone(eventSlot(duplicate)));
  duplicate[duplicate.length - 1] = {
    object_kind: duplicate[duplicate.length - 1].object_kind,
    canonical_value: duplicate[duplicate.length - 1],
  };
  assert.throws(
    () => validateAuthoredProcessInputs(duplicate),
    { code: 'PROCESS_BASE_CONTRACT_CARDINALITY_MISMATCH' },
  );

  const crossDeal = processMembers();
  eventSlot(crossDeal).definition.expected_occurrence_slot_contract
    .slot_binding_is_cross_deal = true;
  assert.throws(
    () => validateAuthoredProcessInputs(crossDeal),
    { code: 'INVALID_PROCESS_EVENT_SLOT_BINDING_INPUT' },
  );

  const substitutedId = processMembers();
  eventSlot(substitutedId).definition
    .process_event_identity_binding_contract
    .process_event_slot_key_equals_process_event_id = true;
  assert.throws(
    () => validateAuthoredProcessInputs(substitutedId),
    { code: 'INVALID_PROCESS_EVENT_SLOT_BINDING_INPUT' },
  );
});

test('fails closed for unresolved, cross-boundary and identity mismatch', () => {
  const failure = eventSlot(processMembers()).definition.failure_contract;
  assert.deepEqual(failure, {
    missing_binding_blocks_materialisation: true,
    unresolved_binding_blocks_materialisation: true,
    unknown_slot_blocks_materialisation: true,
    event_identity_mismatch_blocks_materialisation: true,
    cross_deal_binding_blocks_materialisation: true,
    cross_contract_pair_binding_blocks_materialisation: true,
    failure_can_fall_back_to_source_label_or_model_output: false,
  });
});

test('grants no runtime, writer, serving, release or production authority', () => {
  const authority = eventSlot(processMembers()).definition
    .authority_contract;
  assert.equal(
    Object.values(authority).every((value) => value === false),
    true,
  );
});

test('uses one exact four-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-process-event-slot-binding-contract-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/'
      + 'wp-process-event-slot-binding-contract-v1.json',
    'contracts/canonical-v2/successor/process/'
      + 'occurrence-slots/process-event.v1.json',
    'lib/canonical-v2/process-contract-input-validator.js',
    'tests/canonical-v2-process-event-slot-binding-contract-input.test.js',
  ]);
});
