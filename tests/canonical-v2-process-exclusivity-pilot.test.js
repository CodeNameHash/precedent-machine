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
      relationship_slots: [{
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
      }],
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
      relationships: [{
        process_relationship_slot_key: 'GRANT_POSITION_TO_AGREEMENT',
        relationship_type_code: 'CROSS_REFERENCE',
        relationship_effect: {
          effect_code: 'POSITION_EVIDENCES_EXCLUSIVITY_AGREEMENT',
        },
        relationship_state: 'PRESENT',
        temporal_slot_key: null,
        evidence: evidence('PROCESS_RELATIONSHIP', draftingInterval),
      }],
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
    relationship_revisions: 1,
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
