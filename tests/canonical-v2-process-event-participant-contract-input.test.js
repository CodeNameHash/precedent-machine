const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredProcessInputs,
} = require('../lib/canonical-v2/process-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function member(relativePath) {
  const canonicalValue = read(relativePath);
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function logicalDefinition(values, stableId) {
  return values.find(
    (entry) => entry.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the complete bounded Process event and participant core', () => {
  assert.doesNotThrow(() => validateAuthoredProcessInputs(members()));
});

test('keeps ProcessEvent identity independent from date, type, participants and values', () => {
  const event = logicalDefinition(members(), 'PROCESS_EVENT');

  assert.deepEqual(event.event_identity.stable_id_inputs, [
    'frozen_contract_pair_digest',
    'governed_deal_admission_id',
    'event_definition_key_and_version',
    'ordered_process_narration_occurrence_ids',
    'governed_ordinal',
  ]);
  assert.deepEqual(event.event_identity.prohibited_inputs, [
    'candidate_values',
    'event_date',
    'event_type_code',
    'extracted_attributes',
    'model_output',
    'participant_revision_ids',
    'selected_revision_id',
  ]);
  assert.equal(event.composition_contract.ordered_unique_member_ids_required, true);
  assert.equal(
    event.composition_contract.complete_member_universe_required_before_candidate_values,
    true,
  );
});

test('preserves legal event granularity instead of using paragraphs or dates', () => {
  const event = logicalDefinition(members(), 'PROCESS_EVENT');

  assert.equal(
    event.granularity_contract.boundary_rule,
    'SMALLEST_REAL_WORLD_OCCURRENCE_WITH_DISTINCT_PROCESS_QUESTION',
  );
  assert.equal(event.granularity_contract.continuous_multi_paragraph_meeting_is_one_event, true);
  assert.equal(event.granularity_contract.same_date_implies_same_event, false);
  assert.equal(
    event.granularity_contract.new_occasion_actor_proposal_response_or_decision_may_start_new_event,
    true,
  );
  assert.equal(event.granularity_contract.continuation_and_retelling_are_relationships, true);
  assert.equal(event.granularity_contract.later_retelling_deletes_source_narration, false);
});

test('requires governed registries and lineage before an event can materialise', () => {
  const event = logicalDefinition(members(), 'PROCESS_EVENT');

  assert.equal(event.dimension_contract.unknown_event_type_has_runtime_path, false);
  assert.equal(event.dimension_contract.event_type_registry_required_before_materialisation, true);
  assert.equal(
    event.dimension_contract.participant_role_registry_required_before_materialisation,
    true,
  );
  assert.equal(event.temporal_contract.consumed_shared_logical_type, 'TemporalExpression');
  assert.equal(event.physical_carrier.result_definition_required, true);
  assert.equal(event.release_treatment.complete_result_input_lineage_required, true);
});

test('preserves source-local participants until a governed identity bridge proves a name', () => {
  const participant = logicalDefinition(members(), 'PROCESS_PARTICIPANT');

  assert.equal(participant.subject_binding_contract.consumed_authority, 'SHARED_AUTHORITY');
  assert.equal(participant.subject_binding_contract.governed_identity_bridge_only, true);
  assert.equal(
    participant.subject_binding_contract.matching_date_and_economics_can_establish_identity,
    false,
  );
  assert.equal(participant.subject_binding_contract.shared_fact_reauthoring_permitted, false);
  assert.deepEqual(participant.identity_state_contract.allowed_states, [
    'NAMED',
    'GOVERNED_BRIDGE_CONFIRMED',
    'SOURCE_LOCAL_ONLY',
    'CONFLICTING',
  ]);
  assert.equal(
    participant.identity_state_contract.source_local_state_cross_deal_grouping_permitted,
    false,
  );
});

test('keeps event roles typed, evidenced and distinct from shared deal roles', () => {
  const participant = logicalDefinition(members(), 'PROCESS_PARTICIPANT');

  assert.equal(participant.event_role_contract.typed_event_role_required_when_present, true);
  assert.equal(participant.event_role_contract.event_role_code_is_revision_value_not_identity, true);
  assert.equal(participant.event_role_contract.event_role_evidence_required, true);
  assert.equal(participant.event_role_contract.unknown_event_role_has_runtime_path, false);
  assert.equal(participant.event_role_contract.legal_or_transaction_role_infers_event_role, false);
  assert.equal(
    participant.shared_participant_contract
      .process_event_role_is_distinct_from_legal_and_transaction_roles,
    true,
  );
  assert.equal(
    participant.evidence_rules.event_role_evidence_separate_from_identity_bridge_evidence,
    true,
  );
});

test('grants no writer, serving, release or freeze authority', () => {
  const values = members();
  const event = logicalDefinition(values, 'PROCESS_EVENT');
  const participant = logicalDefinition(values, 'PROCESS_PARTICIPANT');

  assert.deepEqual(event.authority_contract, {
    creates_runtime_event: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  });
  assert.deepEqual(participant.authority_contract, {
    creates_runtime_participant: false,
    creates_writer_authority: false,
    creates_serving_authority: false,
    creates_release_authority: false,
    creates_contract_freeze_authority: false,
  });
  assert.equal(event.writer_action.current_release_writer_path, false);
  assert.equal(participant.writer_action.current_release_writer_path, false);
});

test('rejects semantic drift and incomplete logical-type membership', () => {
  const dateIdentity = clone(members());
  logicalDefinition(dateIdentity, 'PROCESS_EVENT')
    .event_identity.stable_id_inputs[3] = 'event_date';
  assert.throws(
    () => validateAuthoredProcessInputs(dateIdentity),
    (error) => error.code === 'INVALID_PROCESS_EVENT_INPUT',
  );

  const inferredRole = clone(members());
  logicalDefinition(inferredRole, 'PROCESS_PARTICIPANT')
    .event_role_contract.legal_or_transaction_role_infers_event_role = true;
  assert.throws(
    () => validateAuthoredProcessInputs(inferredRole),
    (error) => error.code === 'INVALID_PROCESS_PARTICIPANT_INPUT',
  );

  const missingParticipant = members().filter(
    (entry) => entry.canonical_value.stable_id !== 'PROCESS_PARTICIPANT',
  );
  assert.throws(
    () => validateAuthoredProcessInputs(missingParticipant),
    (error) => error.code === 'PROCESS_LOGICAL_TYPE_MEMBERSHIP_MISMATCH',
  );
});

test('extends deterministic authored inputs but remains an incomplete, non-freezable universe', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.authored_members.length, 105);
  assert.equal(first.disposition.status, 'INCOMPLETE_UNIVERSE');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
  assert.equal(first.disposition.p1_gate_status, 'NOT_EVALUATED');
});
