const assert = require('node:assert/strict');
const test = require('node:test');

const {
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  ENDPOINT_DEFINITIONS,
  buildProcessRelationshipIdentity,
} = require('../lib/canonical-v2/process-relationship');
const {
  EVIDENCE_EDGE_SCHEMA,
  MEMBERSHIP_INPUT_SCHEMA,
  RELATIONSHIP_EFFECT,
  buildProcessBidderTrackEventMembershipRevision,
  buildProcessBidderTrackEventMembershipRevisions,
  validateProcessBidderTrackEventMembershipRevision,
} = require(
  '../lib/canonical-v2/process-bidder-track-event-membership',
);

function digest(label) {
  return contentId('SYNTHETIC_BIDDER_TRACK_EVENT_MEMBERSHIP_TEST/V1', {
    label,
  });
}

const FROZEN_PAIR = digest('frozen-pair');
const DEAL = digest('deal');
const BIDDER_TRACK_ID = digest('bidder-track');
const PROCESS_EVENT_ID = digest('process-event');

function endpoint(logicalType, stableObjectId, overrides = {}) {
  return {
    logical_type: logicalType,
    definition_stable_id: ENDPOINT_DEFINITIONS[logicalType],
    stable_object_id: stableObjectId,
    frozen_contract_pair_digest: FROZEN_PAIR,
    governed_deal_admission_id: DEAL,
    ...overrides,
  };
}

function relationshipIdentity(overrides = {}) {
  return buildProcessRelationshipIdentity({
    frozen_contract_pair_digest: FROZEN_PAIR,
    governed_deal_admission_id: DEAL,
    relationship_definition_key_and_version: {
      definition_key: 'PROCESS_RELATIONSHIP',
      definition_version: 1,
    },
    source_process_object_kind_and_id:
      endpoint('BidderTrack', BIDDER_TRACK_ID),
    target_process_object_kind_and_id:
      endpoint('ProcessEvent', PROCESS_EVENT_ID),
    process_relationship_slot_key: 'BIDDER_TRACK_EVENT_MEMBERSHIP_001',
    governed_ordinal: 0,
    ...overrides,
  });
}

function evidenceEdge(label, overrides = {}) {
  const body = {
    schema_version: EVIDENCE_EDGE_SCHEMA,
    evidence_role_key: 'BIDDER_TRACK_EVENT_MEMBERSHIP',
    admitted_source_occurrence_id: digest(`${label}:source-occurrence`),
    source_document_identity: digest(`${label}:source-document`),
    source_revision_id: digest(`${label}:source-revision`),
    document_hash: digest(`${label}:document-hash`),
    document_ordinal: 0,
    start_utf8_byte: 10,
    end_utf8_byte: 24,
    exact_text_digest: sha256Hex(Buffer.from('synthetic link', 'utf8')),
    evidence_validation_receipt_id: digest(`${label}:validation`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
    ...overrides,
  };
  return {
    schema_version: body.schema_version,
    evidence_edge_id: contentId(EVIDENCE_EDGE_SCHEMA, body),
    ...body,
  };
}

function input(overrides = {}) {
  return {
    schema_version: MEMBERSHIP_INPUT_SCHEMA,
    process_relationship_identity: relationshipIdentity(),
    bidder_track_id: BIDDER_TRACK_ID,
    process_event_id: PROCESS_EVENT_ID,
    relationship_state: 'PRESENT',
    relationship_effect: RELATIONSHIP_EFFECT,
    evidence_edges: [evidenceEdge('membership')],
    temporal_expression_revision_id: null,
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('builds one deterministic acyclic ProcessRelationshipRevision v2', () => {
  const first = buildProcessBidderTrackEventMembershipRevision(input());
  const second = buildProcessBidderTrackEventMembershipRevision(input());

  assert.deepEqual(first, second);
  assert.equal(first.schema_version, 'PROCESS_RELATIONSHIP_REVISION/V2');
  assert.equal(
    first.relationship_type_code,
    'BIDDER_TRACK_EVENT_MEMBERSHIP',
  );
  assert.deepEqual(first.relationship_effect, {
    effect_code: 'EVENT_MEMBER_OF_BIDDER_TRACK',
  });
  assert.equal(first.relationship_state, 'PRESENT');
  assert.equal(first.temporal_expression_revision_id, null);
  assert.equal(first.validation_state, 'VALIDATED_PURE_RUNTIME');
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(Object.hasOwn(first, 'source_revision_id'), false);
  assert.equal(Object.hasOwn(first, 'target_revision_id'), false);
  assert.deepEqual(
    first.source_process_object_kind_and_id,
    input().process_relationship_identity
      .source_process_object_kind_and_id,
  );
  assert.deepEqual(
    first.target_process_object_kind_and_id,
    input().process_relationship_identity
      .target_process_object_kind_and_id,
  );
  assert.equal(Object.isFrozen(first), true);
  assert.doesNotThrow(
    () => validateProcessBidderTrackEventMembershipRevision(first, input()),
  );
});

test('retains exact externally validated evidence in canonical order', () => {
  const earlier = evidenceEdge('earlier', {
    start_utf8_byte: 1,
    end_utf8_byte: 5,
  });
  const later = evidenceEdge('later', {
    start_utf8_byte: 6,
    end_utf8_byte: 9,
  });
  const result = buildProcessBidderTrackEventMembershipRevision(input({
    evidence_edges: [earlier, later],
  }));

  assert.deepEqual(result.evidence_edges, [earlier, later]);
  assert.equal(
    result.evidence_edges.every(
      (edge) => (
        edge.validation_state === 'EXTERNALLY_VALIDATED'
        && edge.authority_state === 'NOT_GRANTED'
      ),
    ),
    true,
  );
});

test('rejects reversed or mismatched stable endpoints', () => {
  const reversed = relationshipIdentity({
    source_process_object_kind_and_id:
      endpoint('ProcessEvent', PROCESS_EVENT_ID),
    target_process_object_kind_and_id:
      endpoint('BidderTrack', BIDDER_TRACK_ID),
  });
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      process_relationship_identity: reversed,
    })),
    { code: 'PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_ENDPOINT_MISMATCH' },
  );

  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      bidder_track_id: digest('different-track'),
    })),
    { code: 'PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_ENDPOINT_MISMATCH' },
  );
});

test('rejects cross-deal and cross-contract endpoint records', () => {
  for (const key of [
    'governed_deal_admission_id',
    'frozen_contract_pair_digest',
  ]) {
    const changed = clone(relationshipIdentity());
    changed.source_process_object_kind_and_id[key] = digest(`other-${key}`);
    assert.throws(
      () => buildProcessBidderTrackEventMembershipRevision(input({
        process_relationship_identity: changed,
      })),
      { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT' },
    );
  }
});

test('rejects endpoint revision fields and semantic shortcuts', () => {
  const endpointRevision = clone(relationshipIdentity());
  endpointRevision.source_process_object_kind_and_id.source_revision_id =
    digest('source-revision');
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      process_relationship_identity: endpointRevision,
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT' },
  );

  for (const [key, value] of [
    ['event_date', '2025-09-04'],
    ['matching_economics', true],
    ['display_name', 'Synthetic bidder'],
    ['source_local_label', 'Bidder A'],
  ]) {
    assert.throws(
      () => buildProcessBidderTrackEventMembershipRevision({
        ...input(),
        [key]: value,
      }),
      { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_INPUT' },
    );
  }
});

test('rejects empty, changed, duplicate and unsorted evidence', () => {
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      evidence_edges: [],
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE' },
  );

  const changed = evidenceEdge('changed');
  changed.exact_text_digest = digest('changed-text');
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      evidence_edges: [changed],
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE' },
  );

  const duplicate = evidenceEdge('duplicate');
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      evidence_edges: [duplicate, clone(duplicate)],
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE' },
  );

  const earlier = evidenceEdge('earlier', {
    start_utf8_byte: 1,
    end_utf8_byte: 5,
  });
  const later = evidenceEdge('later', {
    start_utf8_byte: 6,
    end_utf8_byte: 9,
  });
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      evidence_edges: [later, earlier],
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EVIDENCE' },
  );
});

test('rejects changed effect, non-present state and pilot timing', () => {
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      relationship_effect: { effect_code: 'FOLLOWS' },
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_EFFECT' },
  );
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      relationship_state: 'ABSENT',
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_STATE' },
  );
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevision(input({
      temporal_expression_revision_id: digest('temporal-revision'),
    })),
    { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_TEMPORAL' },
  );
});

test('rejects duplicate stable BidderTrack and ProcessEvent pairs', () => {
  assert.throws(
    () => buildProcessBidderTrackEventMembershipRevisions([
      input(),
      input(),
    ]),
    { code: 'DUPLICATE_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP' },
  );
});

test('tampered revision IDs, endpoint records and payload digests fail closed', () => {
  const original = buildProcessBidderTrackEventMembershipRevision(input());
  for (const [key, value] of [
    ['process_relationship_revision_id', digest('forged-revision')],
    ['canonical_payload_digest', digest('forged-payload')],
    ['source_process_object_kind_and_id', endpoint(
      'BidderTrack',
      digest('forged-track'),
    )],
  ]) {
    const changed = clone(original);
    changed[key] = value;
    assert.throws(
      () => validateProcessBidderTrackEventMembershipRevision(
        changed,
        input(),
      ),
      { code: 'INVALID_PROCESS_BIDDER_TRACK_EVENT_MEMBERSHIP_REVISION' },
    );
  }
});
