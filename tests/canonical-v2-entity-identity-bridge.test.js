const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildEntityIdentityBridge,
  buildEntityIdentityBridgeRevision,
  validateEntityIdentityBridge,
  validateEntityIdentityBridgeRevision,
} = require('../lib/canonical-v2/entity-identity-bridge');

const id = (value) => contentId('ENTITY_IDENTITY_BRIDGE_TEST/V1', value);

function bridge(overrides = {}) {
  return buildEntityIdentityBridge({
    bridge_rule_key: 'EXACT_SOURCE_IDENTIFIER',
    expected_identity_bridge_slot_key: 'PROCESS_PARTY_IDENTITY',
    governed_ordinal: 0,
    source_local_subject_occurrence_id: id('party-3-source-local-subject'),
    ...overrides,
  });
}

function reviewEvidence(overrides = {}) {
  return {
    decision: 'PASS',
    review_record_id: id('review-record'),
    reviewer_eligibility_evidence_id: id('reviewer-eligibility'),
    complete_scope_id: null,
    applicability_evidence_ids: [],
    failure_detail: null,
    ...overrides,
  };
}

function namedRevision(entityIdentityBridge, overrides = {}) {
  const evidenceEdgeId = id('exact-identifier-evidence');
  return buildEntityIdentityBridgeRevision({
    entity_identity_bridge: entityIdentityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: entityIdentityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [{
      check_key: 'INCOMPATIBLE_IDENTIFIER',
      outcome: 'CLEAR',
      evidence_edge_ids: [evidenceEdgeId],
    }],
    evidence_edges: [evidenceEdgeId],
    identity_disposition: 'NAMED',
    review_evidence: reviewEvidence(),
    selected_entity_subject_id: id('pfizer-entity-subject'),
    state: 'PRESENT',
    supersession: null,
    ...overrides,
  });
}

test('builds a deterministic, closed and deeply frozen bridge occurrence', () => {
  const identityBridge = bridge();

  assert.equal(validateEntityIdentityBridge(identityBridge), true);
  assert.equal(canonicalJson(identityBridge), canonicalJson(bridge()));
  assert.equal(Object.isFrozen(identityBridge), true);
});

test('normalised names cannot create a bridge occurrence or terminal revision', () => {
  const identityBridge = bridge();

  assert.throws(() => bridge({ normalised_name: 'pfizer inc' }),
    (error) => error.code === 'INVALID_ENTITY_IDENTITY_BRIDGE');
  assert.throws(() => buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [],
    evidence_edges: [],
    identity_disposition: 'NAMED',
    review_evidence: reviewEvidence(),
    selected_entity_subject_id: id('pfizer-entity-subject'),
    state: 'PRESENT',
    supersession: null,
    normalised_name: 'pfizer inc',
  }), (error) => error.code === 'INVALID_ENTITY_IDENTITY_BRIDGE');
  assert.throws(() => namedRevision(identityBridge, {
    conflict_checks: [],
  }), (error) => error.code === 'ENTITY_BRIDGE_EVIDENCE_REQUIRED');
});

test('a reviewed exact bridge can select one entity subject', () => {
  const identityBridge = bridge();
  const revision = namedRevision(identityBridge);

  assert.equal(revision.terminal_eligible, true);
  assert.equal(revision.identity_disposition, 'NAMED');
  assert.equal(validateEntityIdentityBridgeRevision({
    revision,
    entity_identity_bridge: identityBridge,
  }), true);
});

test('conflicting evidence creates a non-terminal candidate and blocks selection', () => {
  const identityBridge = bridge();
  const evidenceEdgeId = id('conflicting-identifier-evidence');
  const conflicting = buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [{
      check_key: 'INCOMPATIBLE_IDENTIFIER',
      outcome: 'CONFLICT',
      evidence_edge_ids: [evidenceEdgeId],
    }],
    evidence_edges: [evidenceEdgeId],
    identity_disposition: 'CONFLICTING',
    review_evidence: reviewEvidence({ decision: 'BLOCK' }),
    selected_entity_subject_id: null,
    state: 'PRESENT',
    supersession: null,
  });

  assert.equal(conflicting.terminal_eligible, false);
  assert.equal(conflicting.selected_entity_subject_id, null);
  assert.throws(() => namedRevision(identityBridge, {
    conflict_checks: [{
      check_key: 'INCOMPATIBLE_IDENTIFIER',
      outcome: 'CONFLICT',
      evidence_edge_ids: [evidenceEdgeId],
    }],
    evidence_edges: [evidenceEdgeId],
  }), (error) => error.code === 'ENTITY_BRIDGE_CONFLICT_BLOCKS_SELECTION');
  assert.throws(() => buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [{
      check_key: 'INCOMPATIBLE_IDENTIFIER',
      outcome: 'CONFLICT',
      evidence_edge_ids: [evidenceEdgeId],
    }],
    evidence_edges: [evidenceEdgeId],
    identity_disposition: 'CONFLICTING',
    review_evidence: reviewEvidence({ decision: 'BLOCK' }),
    selected_entity_subject_id: id('improper-selection'),
    state: 'PRESENT',
    supersession: null,
  }), (error) => error.code === 'INVALID_CONFLICTING_ENTITY_BRIDGE');
});

test('no bridge witness requires a complete reviewed scope', () => {
  const identityBridge = bridge();
  const evidenceEdgeId = id('complete-bridge-search-evidence');
  const absent = buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [],
    evidence_edges: [evidenceEdgeId],
    identity_disposition: 'NO_BRIDGE_WITNESS',
    review_evidence: reviewEvidence({
      complete_scope_id: id('complete-bridge-scope'),
    }),
    selected_entity_subject_id: null,
    state: 'ABSENT',
    supersession: null,
  });

  assert.equal(absent.terminal_eligible, true);
  assert.throws(() => buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [],
    evidence_edges: [evidenceEdgeId],
    identity_disposition: 'NO_BRIDGE_WITNESS',
    review_evidence: reviewEvidence(),
    selected_entity_subject_id: null,
    state: 'ABSENT',
    supersession: null,
  }), (error) => error.code === 'INCOMPLETE_ENTITY_BRIDGE_ABSENCE');
});

test('source-local and failed states do not select an entity', () => {
  const identityBridge = bridge();
  const notExamined = buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [],
    evidence_edges: [],
    identity_disposition: 'SOURCE_LOCAL_ONLY',
    review_evidence: reviewEvidence({
      decision: 'NOT_REVIEWED',
      review_record_id: null,
      reviewer_eligibility_evidence_id: null,
    }),
    selected_entity_subject_id: null,
    state: 'NOT_EXAMINED',
    supersession: null,
  });
  const failed = buildEntityIdentityBridgeRevision({
    entity_identity_bridge: identityBridge,
    bridge_rule_and_version: {
      bridge_rule_key: identityBridge.bridge_rule_key,
      bridge_rule_version: 1,
    },
    conflict_checks: [],
    evidence_edges: [],
    identity_disposition: null,
    review_evidence: reviewEvidence({
      decision: 'NOT_REVIEWED',
      review_record_id: null,
      reviewer_eligibility_evidence_id: null,
      failure_detail: {
        failure_code: 'EXTRACTOR_TIMEOUT',
        attempted_rule: 'EXACT_SOURCE_IDENTIFIER',
      },
    }),
    selected_entity_subject_id: null,
    state: 'FAILED',
    supersession: null,
  });

  assert.equal(notExamined.selected_entity_subject_id, null);
  assert.equal(failed.identity_disposition, null);
  assert.equal(notExamined.terminal_eligible, true);
  assert.equal(failed.terminal_eligible, true);
});

test('validators reject stale revisions, rule changes and unbound conflict evidence', () => {
  const identityBridge = bridge();
  const revision = namedRevision(identityBridge);

  assert.throws(() => validateEntityIdentityBridgeRevision({
    revision: {
      ...structuredClone(revision),
      entity_identity_bridge_revision_id: id('stale-revision'),
    },
    entity_identity_bridge: identityBridge,
  }), (error) => error.code === 'STALE_ENTITY_IDENTITY_BRIDGE_REVISION');
  assert.throws(() => namedRevision(identityBridge, {
    bridge_rule_and_version: {
      bridge_rule_key: 'NORMALISED_NAME_MATCH',
      bridge_rule_version: 1,
    },
  }), (error) => error.code === 'UNBOUND_ENTITY_BRIDGE_RULE');
  assert.throws(() => namedRevision(identityBridge, {
    conflict_checks: [{
      check_key: 'INCOMPATIBLE_IDENTIFIER',
      outcome: 'CLEAR',
      evidence_edge_ids: [id('outside-revision-evidence')],
    }],
  }), (error) => error.code === 'UNBOUND_ENTITY_BRIDGE_CONFLICT_EVIDENCE');
  assert.throws(() => namedRevision(identityBridge, {
    review_evidence: reviewEvidence({
      complete_scope_id: id('irrelevant-complete-scope'),
    }),
  }), (error) => error.code === 'INVALID_ENTITY_BRIDGE_REVIEW');
});
