const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  AUTHORITY_LIMITS,
  MATERIALISATION_INPUT_SCHEMA,
  MATERIALISATION_RECEIPT_SCHEMA,
  compileProcessExclusivityPilotMaterialisation,
  validateProcessExclusivityPilotMaterialisation,
} = require('../lib/canonical-v2/process-exclusivity-pilot');
const predicateCatalogueContract = require(
  '../contracts/canonical-v2/successor/process/predicates/exclusivity-predicate-catalogue.v2.json',
);

function digest(label) {
  return contentId('SYNTHETIC_METSERA_PROCESS_PILOT_TEST/V1', { label });
}

function sourceDocument(label, sourceText, documentOrdinal) {
  return {
    admitted_source_occurrence_id: digest(`${label}:source-occurrence`),
    source_document_identity: digest(`${label}:source-document`),
    source_revision_id: digest(`${label}:source-revision`),
    document_hash: digest(`${label}:document-hash`),
    document_ordinal: documentOrdinal,
    source_text: sourceText,
    source_text_digest: sha256Hex(Buffer.from(sourceText, 'utf8')),
    citation_identity: {
      citation_key: `METSERA_SYNTHETIC_${label.toUpperCase()}`,
      fixture_state: 'SYNTHETIC_NOT_PUBLIC_SOURCE',
    },
    evidence_validation_receipt_id:
      digest(`${label}:source-validation-receipt`),
  };
}

function byteInterval(document, exactText, occurrence = 0) {
  let characterStart = -1;
  let fromIndex = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    characterStart = document.source_text.indexOf(exactText, fromIndex);
    if (characterStart < 0) {
      throw new Error(`Fixture text not found: ${exactText}`);
    }
    fromIndex = characterStart + exactText.length;
  }
  const absoluteStart = Buffer.byteLength(
    document.source_text.slice(0, characterStart),
    'utf8',
  );
  return {
    source_document_identity: document.source_document_identity,
    absolute_start: absoluteStart,
    absolute_end: absoluteStart + Buffer.byteLength(exactText, 'utf8'),
  };
}

function evidence(evidenceRoleKey, ...intervals) {
  return {
    evidence_role_key: evidenceRoleKey,
    intervals,
  };
}

function typedLinkEvidence(
  predicateKey,
  terminalType,
  slotKey,
  ...intervals
) {
  return {
    terminal_type: terminalType,
    slot_key: slotKey,
    evidence: evidence(
      `${predicateKey}_${terminalType}`,
      ...intervals,
    ),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function metseraFixture() {
  const narrationText =
    'On September 4, 2025, Metsera granted Pfizer exclusivity '
    + 'until September 8, 2025.';
  const draftingText =
    'During the Exclusivity Period, Metsera shall not solicit or engage '
    + 'in discussions with any other bidder.';
  const proxy = sourceDocument(
    'proxy',
    `Context 🧭 before. ${narrationText} Context after.`,
    0,
  );
  const agreement = sourceDocument(
    'agreement',
    `Drafting context before. ${draftingText} Drafting context after.`,
    1,
  );
  const narrationInterval = byteInterval(proxy, narrationText);
  const draftingInterval = byteInterval(agreement, draftingText);
  const metseraInterval = byteInterval(proxy, 'Metsera');
  const pfizerInterval = byteInterval(proxy, 'Pfizer');
  const positionText = 'granted Pfizer exclusivity';
  const positionInterval = byteInterval(proxy, positionText);
  const temporalText = 'until September 8, 2025';
  const temporalInterval = byteInterval(proxy, temporalText);

  return {
    schema_version: MATERIALISATION_INPUT_SCHEMA,
    frozen_contract_pair_digest: digest('frozen-contract-pair'),
    governed_deal_admission_id: digest('metsera-deal-admission'),
    source_documents: [proxy, agreement],
    frozen_scope: {
      narration_slots: [{
        canonical_source_intervals: [narrationInterval],
      }],
      event_slots: [{
        process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
        narration_ordinals: [0],
        event_grouping_evidence: evidence(
          'EVENT_GROUPING',
          narrationInterval,
        ),
        expected_result_slot_key: 'METSERA_EXCLUSIVITY_RESULT',
      }],
      participant_slots: [
        {
          process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'METSERA_GRANTOR',
          governed_ordinal: 0,
        },
        {
          process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
          process_participant_slot_key: 'PFIZER_BENEFICIARY',
          governed_ordinal: 1,
        },
      ],
      bidder_track_slots: [{
        bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
        governed_ordinal: 0,
      }],
      phase_slots: [{
        phase_scope: {
          scope_kind: 'BIDDER_TRACK',
          bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
        },
        process_phase_slot_key: 'PFIZER_EXCLUSIVITY_PHASE',
        governed_ordinal: 0,
      }],
      position_slots: [{
        process_position_slot_key: 'METSERA_EXCLUSIVITY_GRANT_POSITION',
        governed_ordinal: 0,
      }],
      agreement_slots: [{
        process_agreement_slot_key: 'METSERA_EXCLUSIVITY_AGREEMENT',
        governed_ordinal: 0,
      }],
      relationship_slots: [
        {
          process_relationship_slot_key:
            'PFIZER_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          source_endpoint: {
            logical_type: 'BidderTrack',
            slot_key: 'PFIZER_BIDDER_TRACK',
          },
          target_endpoint: {
            logical_type: 'ProcessEvent',
            slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
          },
          governed_ordinal: 0,
          relationship_evidence: evidence(
            'BIDDER_TRACK_EVENT_MEMBERSHIP',
            narrationInterval,
          ),
        },
        {
          process_relationship_slot_key: 'GRANT_POSITION_TO_AGREEMENT',
          source_endpoint: {
            logical_type: 'ProcessPosition',
            slot_key: 'METSERA_EXCLUSIVITY_GRANT_POSITION',
          },
          target_endpoint: {
            logical_type: 'ProcessAgreement',
            slot_key: 'METSERA_EXCLUSIVITY_AGREEMENT',
          },
          governed_ordinal: 0,
          relationship_evidence: evidence(
            'PROCESS_RELATIONSHIP',
            draftingInterval,
          ),
        },
      ],
      temporal_slots: [{
        expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        governed_ordinal: 0,
        governed_subject: {
          logical_type: 'ProcessEvent',
          slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
        },
      }],
      predicate_witness_slots: [{
        predicate_witness_slot_key: 'METSERA_EXCLUSIVITY_GRANTED_WITNESS',
        narration_ordinal: 0,
        predicate_definition_key_and_version: {
          key: 'EXCLUSIVITY_GRANTED',
          version: 1,
        },
        predicate_evidence_role_slot_key:
          'METSERA_EXCLUSIVITY_GRANTED_EVIDENCE',
        governed_ordinal: 0,
        governed_subject_code: 'NEGOTIATION_EXCLUSIVITY',
      }],
      passage_slots: [
        {
          process_passage_slot_key: 'METSERA_PROXY_NARRATION_PASSAGE',
          canonical_source_intervals: [narrationInterval],
        },
        {
          process_passage_slot_key: 'METSERA_ACTUAL_DRAFTING_PASSAGE',
          canonical_source_intervals: [draftingInterval],
        },
      ],
    },
    typed_values: {
      narrations: [{
        narration_ordinal: 0,
        revision_status: 'PRESENT',
        claim_revision_ids: [],
        source_role_code: 'PRIMARY_PROCESS_NARRATION',
        source_backed_attributes: {
          source_role_code: 'PRIMARY_PROCESS_NARRATION',
          verbatim_text: narrationText,
        },
        evidence: evidence('PROCESS_NARRATION', narrationInterval),
      }],
      events: [{
        process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
        event_type_code: 'EXCLUSIVITY_GRANT',
        channel_code: 'WRITTEN_COMMUNICATION',
        event_state: 'PRESENT',
        claim_revision_ids: [],
        temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        participant_slot_keys: [
          'METSERA_GRANTOR',
          'PFIZER_BENEFICIARY',
        ],
        evidence: evidence('PROCESS_EVENT', narrationInterval),
      }],
      participants: [
        {
          process_participant_slot_key: 'METSERA_GRANTOR',
          revision_state: 'PRESENT',
          identity_state: 'NAMED',
          entity_subject_id: digest('metsera-entity-subject'),
          source_local_subject_occurrence_id: null,
          entity_identity_bridge_revision_id: null,
          deal_participant_relationship_revision_id:
            digest('metsera-target-relationship-revision'),
          bidder_track_slot_key: null,
          event_role_code: 'GRANTOR',
          evidence: evidence('EVENT_ROLE_GRANTOR', metseraInterval),
        },
        {
          process_participant_slot_key: 'PFIZER_BENEFICIARY',
          revision_state: 'PRESENT',
          identity_state: 'NAMED',
          entity_subject_id: digest('pfizer-entity-subject'),
          source_local_subject_occurrence_id: null,
          entity_identity_bridge_revision_id: null,
          deal_participant_relationship_revision_id:
            digest('pfizer-bidder-relationship-revision'),
          bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
          event_role_code: 'BENEFICIARY',
          evidence: evidence('EVENT_ROLE_BENEFICIARY', pfizerInterval),
        },
      ],
      bidder_tracks: [{
        bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
        entity_identity_bridge_revision_id: null,
        entity_subject_id: digest('pfizer-entity-subject'),
        source_local_subject_occurrence_ids: [],
        identity_state: 'NAMED',
        track_state: 'ACTIVE',
        evidence: evidence('BIDDER_TRACK', pfizerInterval),
      }],
      phases: [{
        process_phase_slot_key: 'PFIZER_EXCLUSIVITY_PHASE',
        phase_code: 'EXCLUSIVITY',
        phase_state: 'PRESENT',
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME'],
        evidence: evidence('PROCESS_PHASE', narrationInterval),
      }],
      positions: [{
        process_position_slot_key: 'METSERA_EXCLUSIVITY_GRANT_POSITION',
        position_code: 'GRANTED',
        position_state: 'PRESENT',
        term_code: 'EXCLUSIVITY_SUBJECT',
        exact_source_formulation: positionText,
        bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
        process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_key: 'METSERA_GRANTOR',
        temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        evidence: evidence('PROCESS_POSITION', positionInterval),
      }],
      agreements: [{
        process_agreement_slot_key: 'METSERA_EXCLUSIVITY_AGREEMENT',
        agreement_state: 'PRESENT',
        agreement_type_code: 'EXCLUSIVITY',
        document_stage_code: 'EXECUTED',
        version_number: 1,
        effective_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        party_participant_slot_keys: [
          'METSERA_GRANTOR',
          'PFIZER_BENEFICIARY',
        ],
        process_passage_slot_keys: [
          'METSERA_ACTUAL_DRAFTING_PASSAGE',
        ],
        evidence: evidence('PROCESS_AGREEMENT', draftingInterval),
      }],
      relationships: [
        {
          process_relationship_slot_key:
            'PFIZER_TRACK_TO_EXCLUSIVITY_GRANT_EVENT',
          relationship_type_code: 'BIDDER_TRACK_EVENT_MEMBERSHIP',
          relationship_effect: {
            effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
          },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence(
            'BIDDER_TRACK_EVENT_MEMBERSHIP',
            narrationInterval,
          ),
        },
        {
          process_relationship_slot_key: 'GRANT_POSITION_TO_AGREEMENT',
          relationship_type_code: 'CROSS_REFERENCE',
          relationship_effect: {
            effect_code: 'POSITION_EVIDENCES_EXCLUSIVITY_AGREEMENT',
          },
          relationship_state: 'PRESENT',
          temporal_slot_key: null,
          evidence: evidence('PROCESS_RELATIONSHIP', draftingInterval),
        },
      ],
      temporal_expressions: [{
        expected_temporal_slot_key: 'METSERA_EXCLUSIVITY_END_TIME',
        coarse_temporal_state: 'EXPLICIT_DATE',
        raw_source_expression: temporalText,
        evidence: evidence('TEMPORAL_EXPRESSION', temporalInterval),
      }],
      predicate_witnesses: [{
        predicate_witness_slot_key: 'METSERA_EXCLUSIVITY_GRANTED_WITNESS',
        predicate_key: 'EXCLUSIVITY_GRANTED',
        predicate_state: 'PRESENT',
        atomic_response_predicate_key: null,
        atomic_response_predicate_witness_slot_key: null,
        source_semantic_kind: 'GRANT',
        subject_code: 'NEGOTIATION_EXCLUSIVITY',
        bidder_track_slot_key: 'PFIZER_BIDDER_TRACK',
        process_event_slot_key: 'METSERA_EXCLUSIVITY_GRANT_EVENT',
        process_participant_slot_keys: [
          'METSERA_GRANTOR',
          'PFIZER_BENEFICIARY',
        ],
        process_passage_slot_keys: [
          'METSERA_ACTUAL_DRAFTING_PASSAGE',
          'METSERA_PROXY_NARRATION_PASSAGE',
        ],
        process_position_slot_keys: [
          'METSERA_EXCLUSIVITY_GRANT_POSITION',
        ],
        process_agreement_slot_keys: [
          'METSERA_EXCLUSIVITY_AGREEMENT',
        ],
        process_relationship_slot_keys: [
          'GRANT_POSITION_TO_AGREEMENT',
        ],
        temporal_slot_keys: ['METSERA_EXCLUSIVITY_END_TIME'],
        evidence: evidence('EXCLUSIVITY_GRANTED', narrationInterval),
        typed_link_evidence: [
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'BIDDER_TRACK_REVISION',
            'PFIZER_BIDDER_TRACK',
            pfizerInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_AGREEMENT_REVISION',
            'METSERA_EXCLUSIVITY_AGREEMENT',
            draftingInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_EVENT_REVISION',
            'METSERA_EXCLUSIVITY_GRANT_EVENT',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PARTICIPANT_REVISION',
            'METSERA_GRANTOR',
            metseraInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PARTICIPANT_REVISION',
            'PFIZER_BENEFICIARY',
            pfizerInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PASSAGE_REVISION',
            'METSERA_ACTUAL_DRAFTING_PASSAGE',
            draftingInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_PASSAGE_REVISION',
            'METSERA_PROXY_NARRATION_PASSAGE',
            narrationInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_POSITION_REVISION',
            'METSERA_EXCLUSIVITY_GRANT_POSITION',
            positionInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'PROCESS_RELATIONSHIP_REVISION',
            'GRANT_POSITION_TO_AGREEMENT',
            draftingInterval,
          ),
          typedLinkEvidence(
            'EXCLUSIVITY_GRANTED',
            'TEMPORAL_EXPRESSION_REVISION',
            'METSERA_EXCLUSIVITY_END_TIME',
            temporalInterval,
          ),
        ],
        complete_scope_evidence: null,
        applicability_evidence: null,
        failure_detail: null,
      }],
      passages: [
        {
          process_passage_slot_key: 'METSERA_PROXY_NARRATION_PASSAGE',
          passage_role_codes: ['PROCESS_NARRATION'],
          passage_state: 'PRESENT',
          evidence: evidence('PROCESS_PASSAGE', narrationInterval),
        },
        {
          process_passage_slot_key: 'METSERA_ACTUAL_DRAFTING_PASSAGE',
          passage_role_codes: ['ACTUAL_DRAFTING'],
          passage_state: 'PRESENT',
          evidence: evidence('PROCESS_PASSAGE', draftingInterval),
        },
      ],
    },
  };
}

function setPredicateDimensions(value, bindings) {
  const slots = Object.fromEntries(bindings.map(
    (binding) => [binding.terminal_type, binding.slot_key],
  ));
  value.bidder_track_slot_key =
    slots.BIDDER_TRACK_REVISION || null;
  value.process_event_slot_key =
    slots.PROCESS_EVENT_REVISION || null;
  value.process_agreement_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'PROCESS_AGREEMENT_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.process_participant_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'PROCESS_PARTICIPANT_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.process_passage_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'PROCESS_PASSAGE_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.process_position_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'PROCESS_POSITION_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.process_relationship_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'PROCESS_RELATIONSHIP_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.temporal_slot_keys = bindings
    .filter((binding) => (
      binding.terminal_type === 'TEMPORAL_EXPRESSION_REVISION'
    ))
    .map((binding) => binding.slot_key).sort();
  value.typed_link_evidence = bindings;
}

function configureSuccessorPredicate(input, definition) {
  const witness = input.typed_values.predicate_witnesses[0];
  const slot = input.frozen_scope.predicate_witness_slots[0];
  const originalBindings = witness.typed_link_evidence;
  const selected = definition.machine_rule.required_typed_link_families.map(
    (family) => {
      const binding = originalBindings.find(
        (candidate) => candidate.terminal_type === family.terminal_type,
      );
      if (!binding) {
        throw new Error(`Fixture lacks ${family.terminal_type}`);
      }
      const result = clone(binding);
      result.evidence.evidence_role_key =
        `${definition.predicate_key}_${family.terminal_type}`;
      return result;
    },
  );
  slot.predicate_definition_key_and_version.key =
    definition.predicate_key;
  witness.predicate_key = definition.predicate_key;
  witness.source_semantic_kind = definition.machine_rule.semantic_kind;
  witness.evidence.evidence_role_key = definition.predicate_key;
  setPredicateDimensions(witness, selected);
}

function configureNonPresentPredicate(input, state) {
  const witness = input.typed_values.predicate_witnesses[0];
  witness.predicate_state = state;
  witness.source_semantic_kind = null;
  witness.atomic_response_predicate_key = null;
  witness.atomic_response_predicate_witness_slot_key = null;
  witness.evidence = null;
  setPredicateDimensions(witness, []);
  witness.complete_scope_evidence = state === 'ABSENT'
    ? evidence(
      'EXCLUSIVITY_GRANTED_COMPLETE_SCOPE',
      input.frozen_scope.narration_slots[0].canonical_source_intervals[0],
    )
    : null;
  witness.applicability_evidence = state === 'NOT_APPLICABLE'
    ? evidence(
      'EXCLUSIVITY_GRANTED_APPLICABILITY',
      input.frozen_scope.narration_slots[0].canonical_source_intervals[0],
    )
    : null;
  witness.failure_detail = state === 'FAILED'
    ? {
      failure_code: 'SYNTHETIC_VALIDATION_FAILURE',
      failure_message: 'The synthetic witness could not be validated.',
    }
    : null;
}

function addResponseUnion(input, narrationOrdinal = 0) {
  const atomic = input.typed_values.predicate_witnesses[0];
  const union = clone(atomic);
  union.predicate_witness_slot_key =
    'METSERA_EXCLUSIVITY_RESPONSE_ANY_WITNESS';
  union.predicate_key = 'EXCLUSIVITY_RESPONSE_ANY';
  union.atomic_response_predicate_key = 'EXCLUSIVITY_GRANTED';
  union.atomic_response_predicate_witness_slot_key =
    atomic.predicate_witness_slot_key;
  input.typed_values.predicate_witnesses.push(union);
  input.frozen_scope.predicate_witness_slots.push({
    predicate_witness_slot_key:
      'METSERA_EXCLUSIVITY_RESPONSE_ANY_WITNESS',
    narration_ordinal: narrationOrdinal,
    predicate_definition_key_and_version: {
      key: 'EXCLUSIVITY_RESPONSE_ANY',
      version: 1,
    },
    predicate_evidence_role_slot_key:
      'METSERA_EXCLUSIVITY_RESPONSE_ANY_EVIDENCE',
    governed_ordinal: 1,
    governed_subject_code: 'NEGOTIATION_EXCLUSIVITY',
  });
  return { atomic, union };
}

function addUnlinkedEvent(input) {
  const processEventSlotKey = 'UNLINKED_PROCESS_EVENT';
  const processParticipantSlotKey = 'UNLINKED_EVENT_PARTICIPANT';
  const narrationInterval = input.frozen_scope.passage_slots[1]
    .canonical_source_intervals[0];
  input.frozen_scope.narration_slots.push({
    canonical_source_intervals: [narrationInterval],
  });
  const narrationValue = clone(input.typed_values.narrations[0]);
  narrationValue.narration_ordinal = 1;
  narrationValue.evidence = evidence(
    'PROCESS_NARRATION',
    narrationInterval,
  );
  input.typed_values.narrations.push(narrationValue);

  const eventSlot = clone(input.frozen_scope.event_slots[0]);
  eventSlot.process_event_slot_key = processEventSlotKey;
  eventSlot.narration_ordinals = [1];
  eventSlot.event_grouping_evidence = evidence(
    'EVENT_GROUPING',
    narrationInterval,
  );
  eventSlot.expected_result_slot_key = 'UNLINKED_PROCESS_EVENT_RESULT';
  input.frozen_scope.event_slots.push(eventSlot);

  const participantSlot = clone(input.frozen_scope.participant_slots[0]);
  participantSlot.process_event_slot_key = processEventSlotKey;
  participantSlot.process_participant_slot_key =
    processParticipantSlotKey;
  participantSlot.governed_ordinal = 2;
  input.frozen_scope.participant_slots.push(participantSlot);

  const eventValue = clone(input.typed_values.events[0]);
  eventValue.process_event_slot_key = processEventSlotKey;
  eventValue.temporal_slot_key = null;
  eventValue.participant_slot_keys = [processParticipantSlotKey];
  eventValue.evidence = evidence('PROCESS_EVENT', narrationInterval);
  input.typed_values.events.push(eventValue);

  const participantValue = clone(input.typed_values.participants[0]);
  participantValue.process_participant_slot_key =
    processParticipantSlotKey;
  participantValue.bidder_track_slot_key = null;
  input.typed_values.participants.push(participantValue);

  return processEventSlotKey;
}

function addUnlinkedBidderTrack(input) {
  const bidderTrackSlotKey = 'UNLINKED_BIDDER_TRACK';
  const slot = clone(input.frozen_scope.bidder_track_slots[0]);
  slot.bidder_track_slot_key = bidderTrackSlotKey;
  slot.governed_ordinal = 1;
  input.frozen_scope.bidder_track_slots.push(slot);

  const value = clone(input.typed_values.bidder_tracks[0]);
  value.bidder_track_slot_key = bidderTrackSlotKey;
  value.entity_subject_id = digest('unlinked-bidder-track-subject');
  input.typed_values.bidder_tracks.push(value);
  return bidderTrackSlotKey;
}

test('materialises the complete typed Metsera exclusivity sidecar deterministically', () => {
  const input = metseraFixture();
  const first = compileProcessExclusivityPilotMaterialisation(input);
  const second = compileProcessExclusivityPilotMaterialisation(input);

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, MATERIALISATION_RECEIPT_SCHEMA);
  assert.equal(first.materialisation_state, 'VALIDATED_SIDECAR_ONLY');
  assert.equal(first.external_operation_state, 'NOT_PERFORMED');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.revisions), true);
  assert.doesNotThrow(() => (
    validateProcessExclusivityPilotMaterialisation(first, input)
  ));

  const expectedCounts = {
    narration_revisions: 1,
    event_revisions: 1,
    participant_revisions: 2,
    bidder_track_revisions: 1,
    phase_revisions: 1,
    position_revisions: 1,
    agreement_revisions: 1,
    relationship_revisions: 2,
    temporal_expression_revisions: 1,
    predicate_witness_revisions: 1,
    passage_revisions: 2,
  };
  assert.deepEqual(
    Object.fromEntries(Object.entries(first.revisions).map(
      ([key, values]) => [key, values.length],
    )),
    expectedCounts,
  );
});

test('retains one acyclic membership revision in both stable endpoints', () => {
  const result = compileProcessExclusivityPilotMaterialisation(
    metseraFixture(),
  );
  const [membership, crossReference] =
    result.revisions.relationship_revisions;
  const membershipIdentity = result.identities.relationships.find(
    (identity) => identity.process_relationship_id
      === membership.process_relationship_id,
  );
  const track = result.revisions.bidder_track_revisions[0];
  const event = result.revisions.event_revisions[0];

  assert.equal(
    membership.relationship_type_code,
    'BIDDER_TRACK_EVENT_MEMBERSHIP',
  );
  assert.deepEqual(membership.relationship_effect, {
    effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
  });
  assert.equal(membership.relationship_state, 'PRESENT');
  assert.equal(membership.temporal_expression_revision_id, null);
  assert.deepEqual(
    membership.source_process_object_kind_and_id,
    membershipIdentity.source_process_object_kind_and_id,
  );
  assert.deepEqual(
    membership.target_process_object_kind_and_id,
    membershipIdentity.target_process_object_kind_and_id,
  );
  assert.equal(Object.hasOwn(membership, 'source_revision_id'), false);
  assert.equal(Object.hasOwn(membership, 'target_revision_id'), false);
  assert.equal(
    Object.keys(membership).some((key) => (
      key === 'bidder_track_revision_id'
      || key === 'process_event_revision_id'
    )),
    false,
  );
  assert.deepEqual(
    track.ordered_process_event_relationship_revision_ids,
    [membership.process_relationship_revision_id],
  );
  assert.deepEqual(
    event.process_relationship_revision_ids,
    [membership.process_relationship_revision_id],
  );
  assert.equal(crossReference.relationship_type_code, 'CROSS_REFERENCE');
});

test('keeps an undeclared event unlinked without leaking membership', () => {
  const input = metseraFixture();
  addUnlinkedEvent(input);
  const result = compileProcessExclusivityPilotMaterialisation(input);
  const membership = result.revisions.relationship_revisions[0];
  const [linkedEvent, unlinkedEvent] = result.revisions.event_revisions;
  const track = result.revisions.bidder_track_revisions[0];
  const membershipRevisionId =
    membership.process_relationship_revision_id;

  assert.deepEqual(
    linkedEvent.process_relationship_revision_ids,
    [membershipRevisionId],
  );
  assert.deepEqual(
    track.ordered_process_event_relationship_revision_ids,
    [membershipRevisionId],
  );
  assert.deepEqual(unlinkedEvent.process_relationship_revision_ids, []);
  assert.equal(
    JSON.stringify(unlinkedEvent).includes(membershipRevisionId),
    false,
  );
  assert.doesNotThrow(
    () => validateProcessExclusivityPilotMaterialisation(result, input),
  );
});

test('still rejects a present bidder track without event membership', () => {
  const input = metseraFixture();
  addUnlinkedBidderTrack(input);
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(input),
    { code: 'PROCESS_PILOT_BIDDER_TRACK_MEMBERSHIP_UNRESOLVED' },
  );
});

test('rejects missing, reversed, unknown and duplicate memberships', () => {
  const missing = metseraFixture();
  missing.frozen_scope.relationship_slots.shift();
  missing.typed_values.relationships.shift();
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(missing),
    { code: 'MISSING_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP' },
  );

  const reversed = metseraFixture();
  const reversedSlot = reversed.frozen_scope.relationship_slots[0];
  [
    reversedSlot.source_endpoint,
    reversedSlot.target_endpoint,
  ] = [
    reversedSlot.target_endpoint,
    reversedSlot.source_endpoint,
  ];
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(reversed),
    { code: 'PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_ENDPOINT_MISMATCH' },
  );

  const unknownType = metseraFixture();
  unknownType.typed_values.relationships[0].relationship_type_code =
    'BIDDER_TRACK_EVENT_MEMBER';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(unknownType),
    { code: 'UNRESOLVED_PROCESS_CONTROLLED_CODE' },
  );

  const substitutedType = metseraFixture();
  substitutedType.typed_values.relationships[0].relationship_type_code =
    'CROSS_REFERENCE';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(substitutedType),
    { code: 'MISSING_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP' },
  );

  const duplicate = metseraFixture();
  const duplicateSlot = clone(duplicate.frozen_scope.relationship_slots[0]);
  duplicateSlot.process_relationship_slot_key =
    'DUPLICATE_TRACK_TO_EXCLUSIVITY_GRANT_EVENT';
  duplicateSlot.governed_ordinal = 1;
  duplicate.frozen_scope.relationship_slots.push(duplicateSlot);
  const duplicateValue = clone(duplicate.typed_values.relationships[0]);
  duplicateValue.process_relationship_slot_key =
    duplicateSlot.process_relationship_slot_key;
  duplicate.typed_values.relationships.push(duplicateValue);
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(duplicate),
    { code: 'DUPLICATE_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP' },
  );
});

test('rejects unresolved, revision-ID and scope-substituted endpoints', () => {
  const unresolved = metseraFixture();
  unresolved.frozen_scope.relationship_slots[0]
    .target_endpoint.slot_key = 'UNKNOWN_PROCESS_EVENT';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(unresolved),
    { code: 'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT' },
  );

  const revisionEndpoint = metseraFixture();
  revisionEndpoint.frozen_scope.relationship_slots[0]
    .source_endpoint.source_revision_id = digest('source-revision');
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(revisionEndpoint),
    { code: 'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT' },
  );

  for (const key of [
    'governed_deal_admission_id',
    'frozen_contract_pair_digest',
  ]) {
    const changedScope = metseraFixture();
    changedScope.frozen_scope.relationship_slots[0]
      .source_endpoint[key] = digest(`other-${key}`);
    assert.throws(
      () => compileProcessExclusivityPilotMaterialisation(changedScope),
      { code: 'INVALID_PROCESS_PILOT_RELATIONSHIP_ENDPOINT' },
    );
  }
});

test('rejects membership effect, state, evidence and inference substitution', () => {
  const changedEffect = metseraFixture();
  changedEffect.typed_values.relationships[0].relationship_effect = {
    effect_code: 'FOLLOWS_PROCESS_EVENT',
  };
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(changedEffect),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EFFECT' },
  );

  const changedState = metseraFixture();
  changedState.typed_values.relationships[0].relationship_state = 'ABSENT';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(changedState),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_STATE' },
  );

  const changedTemporal = metseraFixture();
  changedTemporal.typed_values.relationships[0].temporal_slot_key =
    'METSERA_EXCLUSIVITY_END_TIME';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(changedTemporal),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_TEMPORAL' },
  );

  const changedEvidence = metseraFixture();
  changedEvidence.typed_values.relationships[0].evidence = evidence(
    'BIDDER_TRACK_EVENT_MEMBERSHIP',
    changedEvidence.typed_values.temporal_expressions[0]
      .evidence.intervals[0],
  );
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(changedEvidence),
    { code: 'PROCESS_PILOT_RELATIONSHIP_EVIDENCE_SUBSTITUTION' },
  );

  const relabelledEvidence = metseraFixture();
  relabelledEvidence.frozen_scope.relationship_slots[0]
    .relationship_evidence.evidence_role_key = 'PROCESS_CHRONOLOGY';
  relabelledEvidence.typed_values.relationships[0]
    .evidence.evidence_role_key = 'PROCESS_CHRONOLOGY';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(
      relabelledEvidence,
    ),
    {
      code:
        'INVALID_PROCESS_PILOT_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE',
    },
  );

  for (const [key, value] of [
    ['event_date', '2025-09-04'],
    ['matching_economics', true],
    ['display_name', 'Pfizer'],
    ['source_local_label', 'Bidder A'],
  ]) {
    const inferred = metseraFixture();
    inferred.typed_values.relationships[0][key] = value;
    assert.throws(
      () => compileProcessExclusivityPilotMaterialisation(inferred),
      { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
    );
  }
});

test('consumes all 18 successor predicate machine rules exactly', () => {
  const definitions = predicateCatalogueContract.definition
    .successor_predicate_definition_contract.definitions;
  assert.equal(definitions.length, 18);
  for (const definition of definitions) {
    const input = metseraFixture();
    configureSuccessorPredicate(input, definition);
    const result = compileProcessExclusivityPilotMaterialisation(input);
    const revision = result.revisions.predicate_witness_revisions[0];
    assert.equal(revision.predicate_key, definition.predicate_key);
    assert.equal(
      revision.source_semantic_kind,
      definition.machine_rule.semantic_kind,
    );
    assert.equal(
      revision.dimension_revision_bindings.length,
      definition.machine_rule.required_typed_link_families.length,
    );
  }
});

test('retains every non-present state without inventing a value', () => {
  for (const predicateState of [
    'ABSENT',
    'NOT_APPLICABLE',
    'NOT_EXAMINED',
    'FAILED',
  ]) {
    const input = metseraFixture();
    configureNonPresentPredicate(input, predicateState);
    const revision = compileProcessExclusivityPilotMaterialisation(input)
      .revisions.predicate_witness_revisions[0];
    assert.equal(revision.predicate_state, predicateState);
    assert.equal(revision.source_semantic_kind, null);
    assert.equal(revision.evidence_edges.length, 0);
    assert.equal(revision.dimension_revision_bindings.length, 0);
    assert.equal(
      revision.complete_scope_identity !== null,
      predicateState === 'ABSENT',
    );
    assert.equal(
      revision.applicability_evidence_edges.length > 0,
      predicateState === 'NOT_APPLICABLE',
    );
    assert.equal(
      revision.failure_detail !== null,
      predicateState === 'FAILED',
    );
  }
});

test('binds a response union to one admitted atomic witness without widening', () => {
  const input = metseraFixture();
  const { union } = addResponseUnion(input);

  const revisions = compileProcessExclusivityPilotMaterialisation(input)
    .revisions.predicate_witness_revisions;
  const atomicRevision = revisions.find(
    (revision) => revision.predicate_key === 'EXCLUSIVITY_GRANTED',
  );
  const unionRevision = revisions.find(
    (revision) => revision.predicate_key === 'EXCLUSIVITY_RESPONSE_ANY',
  );
  assert.equal(
    unionRevision.atomic_response_predicate_witness_revision_id,
    atomicRevision.predicate_witness_revision_id,
  );
  assert.deepEqual(
    unionRevision.dimension_revision_bindings,
    atomicRevision.dimension_revision_bindings,
  );
  assert.deepEqual(unionRevision.evidence_edges, atomicRevision.evidence_edges);

  union.subject_code = 'EXCLUSIVE_DATA_ACCESS';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(input),
    { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
  );
});

test('rejects cross-narration, self and chained response unions', () => {
  const crossNarration = metseraFixture();
  const secondNarrationInterval = crossNarration.frozen_scope
    .passage_slots[1].canonical_source_intervals[0];
  crossNarration.frozen_scope.narration_slots.push({
    canonical_source_intervals: [secondNarrationInterval],
  });
  const secondNarration = clone(
    crossNarration.typed_values.narrations[0],
  );
  secondNarration.narration_ordinal = 1;
  secondNarration.evidence = evidence(
    'PROCESS_NARRATION',
    secondNarrationInterval,
  );
  crossNarration.typed_values.narrations.push(secondNarration);
  crossNarration.frozen_scope.event_slots[0]
    .narration_ordinals.push(1);
  addResponseUnion(crossNarration, 1);
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(crossNarration),
    { code: 'INVALID_PROCESS_PILOT_RESPONSE_UNION' },
  );

  const self = metseraFixture();
  const selfUnion = addResponseUnion(self).union;
  selfUnion.atomic_response_predicate_witness_slot_key =
    selfUnion.predicate_witness_slot_key;
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(self),
    { code: 'INVALID_PROCESS_PILOT_RESPONSE_UNION' },
  );

  const chained = metseraFixture();
  addResponseUnion(chained);
  chained.typed_values.predicate_witnesses[0]
    .atomic_response_predicate_key = 'EXCLUSIVITY_GRANTED';
  chained.typed_values.predicate_witnesses[0]
    .atomic_response_predicate_witness_slot_key =
      chained.typed_values.predicate_witnesses[0]
        .predicate_witness_slot_key;
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(chained),
    { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
  );
});

test('derives ABSENT scope identity and rejects caller or evidence substitution', () => {
  const valid = metseraFixture();
  configureNonPresentPredicate(valid, 'ABSENT');
  const revision = compileProcessExclusivityPilotMaterialisation(valid)
    .revisions.predicate_witness_revisions[0];
  assert.equal(
    revision.complete_scope_identity,
    contentId(
      'PROCESS_PREDICATE_COMPLETE_SCOPE/V1',
      revision.complete_scope_payload,
    ),
  );
  assert.equal(
    revision.complete_scope_payload.scoped_witness_members.length,
    1,
  );
  assert.equal(
    revision.complete_scope_payload.governed_subject_code,
    'NEGOTIATION_EXCLUSIVITY',
  );

  const callerDigest = metseraFixture();
  configureNonPresentPredicate(callerDigest, 'ABSENT');
  callerDigest.typed_values.predicate_witnesses[0]
    .complete_scope_identity = digest('caller-scope');
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(callerDigest),
    { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
  );

  const callerPayload = metseraFixture();
  configureNonPresentPredicate(callerPayload, 'ABSENT');
  callerPayload.typed_values.predicate_witnesses[0]
    .complete_scope_payload = {
      scoped_witness_members: [],
    };
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(callerPayload),
    { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
  );

  const duplicateUniverse = metseraFixture();
  const duplicateSlot = clone(
    duplicateUniverse.frozen_scope.predicate_witness_slots[0],
  );
  duplicateSlot.predicate_witness_slot_key =
    'DUPLICATE_EXCLUSIVITY_GRANTED_WITNESS';
  duplicateUniverse.frozen_scope.predicate_witness_slots.push(
    duplicateSlot,
  );
  const duplicateValue = clone(
    duplicateUniverse.typed_values.predicate_witnesses[0],
  );
  duplicateValue.predicate_witness_slot_key =
    duplicateSlot.predicate_witness_slot_key;
  duplicateUniverse.typed_values.predicate_witnesses.push(
    duplicateValue,
  );
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(
      duplicateUniverse,
    ),
    { code: 'INVALID_PROCESS_PILOT_COMPLETE_SCOPE' },
  );

  for (const alteredIntervals of [
    [valid.frozen_scope.passage_slots[1].canonical_source_intervals[0]],
    [{
      ...valid.frozen_scope.narration_slots[0].canonical_source_intervals[0],
      absolute_end:
        valid.frozen_scope.narration_slots[0]
          .canonical_source_intervals[0].absolute_end - 1,
    }],
    [{
      source_document_identity:
        valid.source_documents[0].source_document_identity,
      absolute_start: 0,
      absolute_end: Buffer.byteLength(
        valid.source_documents[0].source_text,
        'utf8',
      ),
    }],
    [
      valid.frozen_scope.narration_slots[0].canonical_source_intervals[0],
      valid.frozen_scope.narration_slots[0].canonical_source_intervals[0],
    ],
  ]) {
    const hostile = metseraFixture();
    configureNonPresentPredicate(hostile, 'ABSENT');
    hostile.typed_values.predicate_witnesses[0]
      .complete_scope_evidence = evidence(
        'EXCLUSIVITY_GRANTED_COMPLETE_SCOPE',
        ...alteredIntervals,
      );
    assert.throws(
      () => compileProcessExclusivityPilotMaterialisation(hostile),
    );
  }
});

test('fails closed when a successor machine rule changes', () => {
  const rule = predicateCatalogueContract.definition
    .successor_predicate_definition_contract.definitions[0].machine_rule;
  const original = rule.semantic_kind;
  rule.semantic_kind = 'NOTICE_REQUIREMENT';
  try {
    assert.throws(
      () => compileProcessExclusivityPilotMaterialisation(
        metseraFixture(),
      ),
      { code: 'INVALID_PROCESS_PILOT_CONTRACT_BINDING' },
    );
  } finally {
    rule.semantic_kind = original;
  }
});

test('rejects near predicate keys, relabelled grant evidence and refusal invention', () => {
  const nearKey = metseraFixture();
  nearKey.frozen_scope.predicate_witness_slots[0]
    .predicate_definition_key_and_version.key =
      'EXCLUSIVITY_GRANT';
  nearKey.typed_values.predicate_witnesses[0].predicate_key =
    'EXCLUSIVITY_GRANT';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(nearKey),
    { code: 'INVALID_PROCESS_PILOT_FROZEN_SCOPE' },
  );

  const relabelledGrant = metseraFixture();
  relabelledGrant.typed_values.predicate_witnesses[0]
    .evidence.evidence_role_key = 'EXCLUSIVITY_REQUESTED';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(
      relabelledGrant,
    ),
    { code: 'PROCESS_PILOT_PREDICATE_EVIDENCE_ROLE_MISMATCH' },
  );

  for (const semanticKind of [
    'SILENCE',
    'REQUEST',
    'SHORTENED_TERM',
    'NO_RECORDED_GRANT',
  ]) {
    const refusal = metseraFixture();
    const slot = refusal.frozen_scope.predicate_witness_slots[0];
    const witness = refusal.typed_values.predicate_witnesses[0];
    slot.predicate_definition_key_and_version.key =
      'EXCLUSIVITY_EXPRESS_REFUSAL';
    witness.predicate_key = 'EXCLUSIVITY_EXPRESS_REFUSAL';
    witness.source_semantic_kind = semanticKind;
    witness.evidence.evidence_role_key =
      'EXCLUSIVITY_EXPRESS_REFUSAL';
    witness.typed_link_evidence.forEach((binding) => {
      binding.evidence.evidence_role_key =
        `EXCLUSIVITY_EXPRESS_REFUSAL_${binding.terminal_type}`;
    });
    assert.throws(
      () => compileProcessExclusivityPilotMaterialisation(refusal),
      { code: 'INVALID_PROCESS_PILOT_TYPED_VALUE' },
    );
  }
});

test('preserves exact proxy narration, timing and actual drafting bytes', () => {
  const input = metseraFixture();
  const result = compileProcessExclusivityPilotMaterialisation(input);
  const slices = result.exact_source_slices;
  const exactTexts = new Set(slices.map((slice) => slice.exact_text));

  assert.equal(
    exactTexts.has(
      'On September 4, 2025, Metsera granted Pfizer exclusivity '
      + 'until September 8, 2025.',
    ),
    true,
  );
  assert.equal(exactTexts.has('until September 8, 2025'), true);
  assert.equal(
    exactTexts.has(
      'During the Exclusivity Period, Metsera shall not solicit or engage '
      + 'in discussions with any other bidder.',
    ),
    true,
  );
  for (const slice of slices) {
    assert.equal(
      sha256Hex(Buffer.from(slice.exact_text, 'utf8')),
      slice.exact_text_digest,
    );
  }

  const draftingRevision = result.revisions.passage_revisions.find(
    (revision) => revision.passage_role_codes.includes('ACTUAL_DRAFTING'),
  );
  assert.ok(draftingRevision);
  assert.equal(
    draftingRevision.source_map.coordinate_space,
    'ADMITTED_SOURCE_UTF8_BYTES',
  );
});

test('binds each participant slot to the exact precomputed ProcessEvent ID', () => {
  const result = compileProcessExclusivityPilotMaterialisation(
    metseraFixture(),
  );
  assert.equal(result.event_slot_bindings.length, 1);
  const eventBinding = result.event_slot_bindings[0];
  assert.equal(eventBinding.binding_state, 'RESOLVED');
  assert.equal(
    eventBinding.precomputed_process_event_id,
    result.identities.events[0].process_event_id,
  );
  assert.equal(result.participant_event_bindings.length, 2);
  for (const binding of result.participant_event_bindings) {
    assert.equal(binding.binding_state, 'RESOLVED');
    assert.equal(binding.process_event_id, eventBinding.precomputed_process_event_id);
    const participantRevision = result.revisions.participant_revisions.find(
      (revision) => revision.process_participant_id
        === binding.process_participant_id,
    );
    assert.equal(
      participantRevision.process_event_id,
      eventBinding.precomputed_process_event_id,
    );
  }
});

test('retains Shared Authority party links without copying role codes', () => {
  const input = metseraFixture();
  const result = compileProcessExclusivityPilotMaterialisation(input);
  const agreement = result.revisions.agreement_revisions[0];
  const expectedSharedRevisions = input.typed_values.participants.map(
    (participant) => participant.deal_participant_relationship_revision_id,
  ).sort();

  assert.deepEqual(
    agreement.party_relationship_revision_ids,
    expectedSharedRevisions,
  );
  assert.equal(
    result.revisions.participant_revisions.every(
      (revision) => !Object.hasOwn(revision, 'transaction_role_code')
        && !Object.hasOwn(revision, 'legal_role_code'),
    ),
    true,
  );
});

test('blocks unknown and near Process codes without mapping them', () => {
  const input = metseraFixture();
  input.typed_values.events[0].event_type_code =
    'EXCLUSIVITY_DECLINED';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(input),
    (error) => (
      error.code === 'UNRESOLVED_PROCESS_CONTROLLED_CODE'
      && error.details.registry_stable_id
        === 'PROCESS_EVENT_TYPE_REGISTRY'
      && error.details.unresolved_source_value
        === 'EXCLUSIVITY_DECLINED'
      && error.details.materialisation_state === 'BLOCKED'
      && error.details.near_code_mapping_permitted === false
    ),
  );
});

test('blocks clipped UTF-8 intervals and changed source wording', () => {
  const clipped = metseraFixture();
  const proxy = clipped.source_documents[0];
  const emojiCharacterIndex = proxy.source_text.indexOf('🧭');
  const emojiByteStart = Buffer.byteLength(
    proxy.source_text.slice(0, emojiCharacterIndex),
    'utf8',
  );
  clipped.frozen_scope.narration_slots[0].canonical_source_intervals[0] = {
    source_document_identity: proxy.source_document_identity,
    absolute_start: emojiByteStart + 1,
    absolute_end: emojiByteStart + 3,
  };
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(clipped),
    { code: 'INVALID_PROCESS_PILOT_SOURCE_INTERVAL' },
  );

  const changedTemporal = metseraFixture();
  changedTemporal.typed_values.temporal_expressions[0]
    .raw_source_expression = 'September 8, 2025';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(changedTemporal),
    { code: 'PROCESS_PILOT_TEMPORAL_SOURCE_MISMATCH' },
  );
});

test('blocks narration evidence with the same text at different coordinates', () => {
  const input = metseraFixture();
  const proxy = input.source_documents[0];
  const narrationInterval = input.frozen_scope.narration_slots[0]
    .canonical_source_intervals[0];
  const narrationText = Buffer.from(proxy.source_text, 'utf8').subarray(
    narrationInterval.absolute_start,
    narrationInterval.absolute_end,
  ).toString('utf8');
  proxy.source_text += ` Duplicate: ${narrationText}`;
  proxy.source_text_digest = sha256Hex(
    Buffer.from(proxy.source_text, 'utf8'),
  );
  input.typed_values.narrations[0].evidence = evidence(
    'PROCESS_NARRATION',
    byteInterval(proxy, narrationText, 1),
  );

  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(input),
    { code: 'PROCESS_PILOT_NARRATION_EVIDENCE_MISMATCH' },
  );
});

test('blocks passage evidence with the same text at different coordinates', () => {
  const input = metseraFixture();
  const agreement = input.source_documents[1];
  const passageInterval = input.frozen_scope.passage_slots[1]
    .canonical_source_intervals[0];
  const draftingText = Buffer.from(agreement.source_text, 'utf8').subarray(
    passageInterval.absolute_start,
    passageInterval.absolute_end,
  ).toString('utf8');
  agreement.source_text += ` Duplicate: ${draftingText}`;
  agreement.source_text_digest = sha256Hex(
    Buffer.from(agreement.source_text, 'utf8'),
  );
  input.typed_values.passages[1].evidence = evidence(
    'PROCESS_PASSAGE',
    byteInterval(agreement, draftingText, 1),
  );

  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(input),
    { code: 'PROCESS_PILOT_PASSAGE_EVIDENCE_MISMATCH' },
  );
});

test('blocks unresolved event bindings and missing shared party-role links', () => {
  const unresolvedEvent = metseraFixture();
  unresolvedEvent.frozen_scope.participant_slots[0]
    .process_event_slot_key = 'UNKNOWN_EVENT_SLOT';
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(unresolvedEvent),
    { code: 'PROCESS_EVENT_SLOT_BINDING_UNRESOLVED' },
  );

  const missingSharedRole = metseraFixture();
  missingSharedRole.typed_values.participants[0]
    .deal_participant_relationship_revision_id = null;
  assert.throws(
    () => compileProcessExclusivityPilotMaterialisation(missingSharedRole),
    { code: 'PROCESS_PILOT_SHARED_PARTY_ROLE_UNRESOLVED' },
  );
});

test('grants no external, extraction, writer, release or production authority', () => {
  const result = compileProcessExclusivityPilotMaterialisation(
    metseraFixture(),
  );
  assert.deepEqual(result.authority_limits, AUTHORITY_LIMITS);
  assert.equal(
    Object.values(result.authority_limits)
      .every((value) => value === 'NONE'),
    true,
  );
  for (const revisions of Object.values(result.revisions)) {
    for (const revision of revisions) {
      assert.equal(revision.validation_state, 'VALIDATED_PURE_RUNTIME');
      assert.equal(revision.authority_state, 'NOT_GRANTED');
    }
  }
});

test('uses one exact three-file canonical-work-start allowlist', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/'
        + 'wp-process-exclusivity-pilot-v1.json',
    ),
    'utf8',
  ));
  assert.equal(allowlist.required_work_class, 'canonical_work_start');
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-process-exclusivity-pilot-v1.json',
    'lib/canonical-v2/process-exclusivity-pilot.js',
    'tests/canonical-v2-process-exclusivity-pilot.test.js',
  ]);
});
