const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function member(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return [
    member('process/agreements/process-agreement.v1.json'),
    member('process/bidder-tracks/bidder-track.v1.json'),
    member('process/domain/process-domain-registry.v1.json'),
    member('process/events/process-event.v1.json'),
    member('process/narration/process-narration-occurrence.v1.json'),
    member('process/occurrence-slots/process-narration.v1.json'),
    member('process/participants/process-participant.v1.json'),
    member('process/passages/process-passage.v1.json'),
    member('process/phases/process-phase.v1.json'),
    member('process/positions/process-position.v1.json'),
    member('process/relationships/process-relationship.v1.json'),
  ];
}

function definition(values, stableId) {
  return values.find(
    (entry) => entry.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('validates the complete bounded Process contract input set', () => {
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members()));
});

test('keeps BidderTrack identity independent from names, dates and economics', () => {
  const track = definition(members(), 'BIDDER_TRACK');

  assert.deepEqual(track.track_identity.stable_id_inputs, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'bidder_track_slot_key',
    'governed_ordinal',
  ]);
  assert.deepEqual(track.track_identity.prohibited_inputs, [
    'cleaned_name',
    'display_name',
    'entity_identity_bridge_revision_id',
    'entity_subject_id',
    'first_event_date',
    'matching_economics',
    'model_output',
    'process_participant_ids',
    'source_local_label',
  ]);
  assert.deepEqual(track.occurrence_slot_contract, {
    slot_key_field: 'bidder_track_slot_key',
    slot_frozen_before_candidate_values: true,
    slot_key_is_self_authorising: false,
    precomputed_expected_occurrence_id_binding_required: true,
    unresolved_or_missing_slot_blocks_materialisation: true,
    identity_only_kernel_grants_materialisation_authority: false,
  });
  assert.equal(track.track_subject_contract.source_local_track_permitted, true);
  assert.equal(track.track_subject_contract.governed_identity_bridge_only, true);
  assert.equal(
    track.track_subject_contract.matching_date_and_economics_can_establish_track_identity,
    false,
  );
  assert.equal(
    track.event_membership_contract.matching_date_and_economics_can_merge_tracks,
    false,
  );
});

test('requires typed evidence-backed BidderTrack event membership', () => {
  const track = definition(members(), 'BIDDER_TRACK');

  assert.equal(track.event_membership_contract.typed_relationship_required, true);
  assert.equal(track.event_membership_contract.membership_evidence_required, true);
  assert.equal(track.event_membership_contract.chronology_alone_can_establish_membership, false);
  assert.equal(track.event_membership_contract.event_ids_are_revision_values_not_track_identity, true);
  assert.deepEqual(track.track_state_contract, {
    track_state_is_revision_value_not_identity: true,
    track_state_registry_required_before_materialisation: true,
    track_state_label_can_create_code: false,
    unknown_track_state_has_runtime_path: false,
  });
});

test('keeps ProcessPhase identity independent from codes, labels, dates and events', () => {
  const phase = definition(members(), 'PROCESS_PHASE');

  assert.deepEqual(phase.phase_identity.stable_id_inputs, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'phase_scope_kind_and_id',
    'process_phase_slot_key',
    'governed_ordinal',
  ]);
  assert.deepEqual(phase.phase_identity.prohibited_inputs, [
    'event_ids',
    'extracted_attributes',
    'model_output',
    'phase_code',
    'phase_end',
    'phase_label',
    'phase_start',
  ]);
  assert.deepEqual(phase.occurrence_slot_contract, {
    slot_key_field: 'process_phase_slot_key',
    slot_frozen_before_candidate_values: true,
    slot_key_is_self_authorising: false,
    precomputed_expected_occurrence_id_binding_required: true,
    unresolved_or_missing_slot_blocks_materialisation: true,
    identity_only_kernel_grants_materialisation_authority: false,
  });
  assert.deepEqual(phase.scope_contract.allowed_scope_kinds, ['DEAL', 'BIDDER_TRACK']);
  assert.equal(phase.scope_contract.chronology_alone_can_select_scope, false);
  assert.deepEqual(
    phase.scope_contract.phase_scope_kind_and_id_schema.closed_variants,
    [
      {
        scope_kind: 'DEAL',
        exact_fields: ['scope_kind', 'governed_deal_admission_id'],
        governed_deal_admission_id_must_equal_phase_deal: true,
      },
      {
        scope_kind: 'BIDDER_TRACK',
        exact_fields: ['scope_kind', 'bidder_track_id'],
        bidder_track_frozen_contract_pair_digest_must_equal_phase_pair: true,
        bidder_track_governed_deal_admission_id_must_equal_phase_deal: true,
      },
    ],
  );
  assert.equal(
    phase.scope_contract.phase_scope_kind_and_id_schema.arbitrary_ids_permitted,
    false,
  );
  assert.equal(
    phase.scope_contract.phase_scope_kind_and_id_schema.cross_deal_binding_permitted,
    false,
  );
  assert.equal(
    phase.scope_contract.phase_scope_kind_and_id_schema.cross_contract_binding_permitted,
    false,
  );
});

test('requires governed ProcessPhase codes and typed event membership', () => {
  const phase = definition(members(), 'PROCESS_PHASE');

  assert.equal(phase.phase_code_contract.phase_code_registry_required_before_materialisation, true);
  assert.equal(phase.phase_code_contract.phase_label_can_create_code, false);
  assert.equal(phase.event_membership_contract.typed_relationship_required, true);
  assert.equal(phase.event_membership_contract.event_membership_evidence_required, true);
  assert.equal(phase.event_membership_contract.same_date_can_establish_membership, false);
  assert.equal(
    phase.event_membership_contract.phase_order_uses_governed_ordinal_not_inferred_date,
    true,
  );
});

test('makes the event-slot-to-final-event-ID bridge an unresolved governed dependency', () => {
  const values = members();
  const event = definition(values, 'PROCESS_EVENT');
  const participant = definition(values, 'PROCESS_PARTICIPANT');

  assert.equal(
    event.composition_contract
      .governed_discovery_freeze_carrier_required_before_candidate_materialisation,
    true,
  );
  assert.equal(
    event.composition_contract.caller_occurrence_array_can_prove_deal_wide_completeness,
    false,
  );
  assert.equal(
    event.composition_contract.identity_only_kernel_grants_materialisation_authority,
    false,
  );
  assert.equal(
    participant.event_binding_contract
      .event_slot_binding_definition_required_before_materialisation,
    true,
  );
  assert.equal(
    participant.event_binding_contract.process_event_slot_key_equals_process_event_id,
    false,
  );
  assert.equal(
    participant.event_binding_contract
      .precomputed_event_id_must_equal_materialised_event_id,
    true,
  );
  assert.equal(
    participant.event_binding_contract.unresolved_event_slot_binding_blocks_materialisation,
    true,
  );
});

test('grants no runtime, writer, serving, release or freeze authority', () => {
  const values = members();
  const track = definition(values, 'BIDDER_TRACK');
  const phase = definition(values, 'PROCESS_PHASE');

  assert.deepEqual(track.authority_contract, {
    creates_runtime_bidder_track: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  });
  assert.deepEqual(phase.authority_contract, {
    creates_runtime_phase: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  });
});

test('rejects identity inference and event-slot semantic drift', () => {
  const inferredTrack = clone(members());
  definition(inferredTrack, 'BIDDER_TRACK')
    .track_subject_contract.matching_date_and_economics_can_establish_track_identity = true;
  assert.throws(
    () => validateAuthoredProcessInputs(inferredTrack),
    (error) => error.code === 'INVALID_BIDDER_TRACK_INPUT',
  );

  const freeTextTrackState = clone(members());
  definition(freeTextTrackState, 'BIDDER_TRACK')
    .track_state_contract.track_state_label_can_create_code = true;
  assert.throws(
    () => validateAuthoredProcessInputs(freeTextTrackState),
    (error) => error.code === 'INVALID_BIDDER_TRACK_INPUT',
  );

  const selfAuthorisingTrackSlot = clone(members());
  definition(selfAuthorisingTrackSlot, 'BIDDER_TRACK')
    .occurrence_slot_contract.slot_key_is_self_authorising = true;
  assert.throws(
    () => validateAuthoredProcessInputs(selfAuthorisingTrackSlot),
    (error) => error.code === 'INVALID_BIDDER_TRACK_INPUT',
  );

  const inferredPhase = clone(members());
  definition(inferredPhase, 'PROCESS_PHASE')
    .event_membership_contract.same_date_can_establish_membership = true;
  assert.throws(
    () => validateAuthoredProcessInputs(inferredPhase),
    (error) => error.code === 'INVALID_PROCESS_PHASE_INPUT',
  );

  const crossDealPhase = clone(members());
  definition(crossDealPhase, 'PROCESS_PHASE')
    .scope_contract.phase_scope_kind_and_id_schema
    .closed_variants[1].bidder_track_governed_deal_admission_id_must_equal_phase_deal = false;
  assert.throws(
    () => validateAuthoredProcessInputs(crossDealPhase),
    (error) => error.code === 'INVALID_PROCESS_PHASE_INPUT',
  );

  const crossContractPhase = clone(members());
  definition(crossContractPhase, 'PROCESS_PHASE')
    .scope_contract.phase_scope_kind_and_id_schema
    .closed_variants[1].bidder_track_frozen_contract_pair_digest_must_equal_phase_pair = false;
  assert.throws(
    () => validateAuthoredProcessInputs(crossContractPhase),
    (error) => error.code === 'INVALID_PROCESS_PHASE_INPUT',
  );

  const arbitraryScope = clone(members());
  definition(arbitraryScope, 'PROCESS_PHASE')
    .scope_contract.phase_scope_kind_and_id_schema.arbitrary_ids_permitted = true;
  assert.throws(
    () => validateAuthoredProcessInputs(arbitraryScope),
    (error) => error.code === 'INVALID_PROCESS_PHASE_INPUT',
  );

  const selfAuthorisingPhaseSlot = clone(members());
  definition(selfAuthorisingPhaseSlot, 'PROCESS_PHASE')
    .occurrence_slot_contract.precomputed_expected_occurrence_id_binding_required = false;
  assert.throws(
    () => validateAuthoredProcessInputs(selfAuthorisingPhaseSlot),
    (error) => error.code === 'INVALID_PROCESS_PHASE_INPUT',
  );

  const conflatedEventKey = clone(members());
  definition(conflatedEventKey, 'PROCESS_PARTICIPANT')
    .event_binding_contract.process_event_slot_key_equals_process_event_id = true;
  assert.throws(
    () => validateAuthoredProcessInputs(conflatedEventKey),
    (error) => error.code === 'INVALID_PROCESS_PARTICIPANT_INPUT',
  );
});

test('extends authored inputs but remains incomplete and non-freezable', () => {
  const compiled = compileCanonicalContractInput({ root_directory: ROOT });

  assert.equal(compiled.authored_members.length, 109);
  assert.equal(compiled.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(compiled.disposition.freeze_eligible, false);
  assert.equal(compiled.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(compiled.disposition.p1_gate_status, 'NOT_EVALUATED');
});
