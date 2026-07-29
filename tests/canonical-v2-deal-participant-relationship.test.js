const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildDealParticipantRelationship,
  buildDealParticipantRelationshipRevision,
  validateDealParticipantRelationship,
  validateDealParticipantRelationshipRevision,
} = require('../lib/canonical-v2/deal-participant-relationship');

const id = (value) => contentId('DEAL_PARTICIPANT_TEST/V1', value);

function relationship(overrides = {}) {
  return buildDealParticipantRelationship({
    bidder_track_slot_key: null,
    expected_participant_slot_key: 'PRIMARY_BUYER',
    governed_deal_id: id('deal'),
    governed_ordinal: 0,
    participant_endpoint_slot_key: 'BUYER_ENDPOINT',
    role_code: 'BUYER',
    role_layer: 'TRANSACTION_ROLE',
    transaction_leg_slot_key: null,
    ...overrides,
  });
}

function presentRevision(dealParticipantRelationship, overrides = {}) {
  return buildDealParticipantRelationshipRevision({
    deal_participant_relationship: dealParticipantRelationship,
    bidder_track_id: dealParticipantRelationship.bidder_track_slot_key
      ? id('bidder-track')
      : null,
    effective_time_scope: id('effective-time'),
    entity_subject_id: id('participant-entity'),
    evidence_edges: [id('participant-evidence')],
    relationship_definition_and_version: {
      relationship_definition_key:
        dealParticipantRelationship.expected_participant_slot_key,
      relationship_definition_version: 1,
    },
    resolver_version: 'participant-resolver/v1',
    source_local_subject_occurrence_id: null,
    state: { code: 'PRESENT' },
    transaction_leg_resolution_occurrence_id:
      dealParticipantRelationship.transaction_leg_slot_key
        ? id('transaction-leg')
        : null,
    ...overrides,
  });
}

test('builds a deterministic, closed and deeply frozen participant occurrence', () => {
  const participant = relationship();

  assert.equal(validateDealParticipantRelationship(participant), true);
  assert.equal(canonicalJson(participant), canonicalJson(relationship()));
  assert.equal(Object.isFrozen(participant), true);
});

test('legal-document and transaction roles cannot be exchanged', () => {
  const survivor = relationship({
    expected_participant_slot_key: 'SURVIVING_ENTITY',
    participant_endpoint_slot_key: 'SURVIVOR_ENDPOINT',
    role_code: 'SURVIVING_ENTITY',
    role_layer: 'LEGAL_DOCUMENT_ROLE',
  });
  assert.equal(validateDealParticipantRelationship(survivor), true);

  assert.throws(() => relationship({
    role_code: 'SURVIVING_ENTITY',
    role_layer: 'TRANSACTION_ROLE',
  }), (error) => error.code === 'INVALID_DEAL_PARTICIPANT_ROLE');
  assert.throws(() => relationship({
    role_code: 'BUYER',
    role_layer: 'LEGAL_DOCUMENT_ROLE',
  }), (error) => error.code === 'INVALID_DEAL_PARTICIPANT_ROLE');
});

test('merger-of-equals participants need no invented target or buyer', () => {
  const first = relationship({
    expected_participant_slot_key: 'COMBINATION_PARTY_A',
    governed_ordinal: 0,
    participant_endpoint_slot_key: 'COMBINATION_ENDPOINT_A',
    role_code: 'COMBINATION_PARTY',
  });
  const second = relationship({
    expected_participant_slot_key: 'COMBINATION_PARTY_B',
    governed_ordinal: 1,
    participant_endpoint_slot_key: 'COMBINATION_ENDPOINT_B',
    role_code: 'COMBINATION_PARTY',
  });

  assert.equal(presentRevision(first).role_code, 'COMBINATION_PARTY');
  assert.equal(presentRevision(second, {
    entity_subject_id: id('second-combination-party'),
  }).role_code, 'COMBINATION_PARTY');
});

test('endpoint changes create a revision and cannot rekey the role occurrence', () => {
  const participant = relationship();
  const first = presentRevision(participant);
  const second = presentRevision(participant, {
    entity_subject_id: null,
    source_local_subject_occurrence_id: id('source-local-buyer'),
  });

  assert.equal(
    first.deal_participant_relationship_id,
    second.deal_participant_relationship_id,
  );
  assert.notEqual(
    first.deal_participant_relationship_revision_id,
    second.deal_participant_relationship_revision_id,
  );
  assert.throws(() => relationship({ display_name: 'Pfizer Inc.' }),
    (error) => error.code === 'INVALID_DEAL_PARTICIPANT');
});

test('bidder-track and transaction-leg slots require matching revision scope', () => {
  const bidder = relationship({
    bidder_track_slot_key: 'BIDDER_TRACK',
    expected_participant_slot_key: 'TRACK_BIDDER',
    participant_endpoint_slot_key: 'BIDDER_ENDPOINT',
    role_code: 'BIDDER',
    transaction_leg_slot_key: 'TENDER_OFFER_LEG',
  });
  assert.equal(presentRevision(bidder).bidder_track_id, id('bidder-track'));

  assert.throws(() => presentRevision(bidder, {
    bidder_track_id: null,
  }), (error) => error.code === 'UNBOUND_DEAL_PARTICIPANT_BIDDER_TRACK');
  assert.throws(() => presentRevision(bidder, {
    transaction_leg_resolution_occurrence_id: null,
  }), (error) => error.code === 'UNBOUND_DEAL_PARTICIPANT_LEG');
});

test('present roles require exactly one endpoint and exact evidence', () => {
  const participant = relationship();

  assert.throws(() => presentRevision(participant, {
    source_local_subject_occurrence_id: id('second-endpoint'),
  }), (error) => error.code === 'DEAL_PARTICIPANT_EVIDENCE_REQUIRED');
  assert.throws(() => presentRevision(participant, {
    evidence_edges: [],
  }), (error) => error.code === 'DEAL_PARTICIPANT_EVIDENCE_REQUIRED');
});

test('absence needs complete scope and evidence and cannot assert a participant', () => {
  const participant = relationship();
  const absent = buildDealParticipantRelationshipRevision({
    deal_participant_relationship: participant,
    bidder_track_id: null,
    effective_time_scope: null,
    entity_subject_id: null,
    evidence_edges: [id('complete-role-search-evidence')],
    relationship_definition_and_version: {
      relationship_definition_key: participant.expected_participant_slot_key,
      relationship_definition_version: 1,
    },
    resolver_version: 'participant-resolver/v1',
    source_local_subject_occurrence_id: null,
    state: {
      code: 'ABSENT',
      complete_scope_id: id('complete-role-search'),
    },
    transaction_leg_resolution_occurrence_id: null,
  });

  assert.equal(absent.state.code, 'ABSENT');
  assert.throws(() => buildDealParticipantRelationshipRevision({
    ...structuredClone({
      deal_participant_relationship: participant,
      bidder_track_id: null,
      effective_time_scope: null,
      entity_subject_id: id('improper-participant'),
      evidence_edges: [id('complete-role-search-evidence')],
      relationship_definition_and_version: {
        relationship_definition_key: participant.expected_participant_slot_key,
        relationship_definition_version: 1,
      },
      resolver_version: 'participant-resolver/v1',
      source_local_subject_occurrence_id: null,
      state: {
        code: 'ABSENT',
        complete_scope_id: id('complete-role-search'),
      },
      transaction_leg_resolution_occurrence_id: null,
    }),
  }), (error) => error.code === 'NON_PRESENT_DEAL_PARTICIPANT_VALUE');
});

test('validators reject stale identities', () => {
  const participant = relationship();
  const revision = presentRevision(participant);

  assert.throws(() => validateDealParticipantRelationship({
    ...structuredClone(participant),
    deal_participant_relationship_id: id('stale-participant'),
  }), (error) => error.code === 'STALE_DEAL_PARTICIPANT');
  assert.throws(() => validateDealParticipantRelationshipRevision({
    revision: {
      ...structuredClone(revision),
      deal_participant_relationship_revision_id: id('stale-revision'),
    },
    deal_participant_relationship: participant,
  }), (error) => error.code === 'STALE_DEAL_PARTICIPANT_REVISION');
});
