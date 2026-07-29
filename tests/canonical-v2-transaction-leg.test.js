const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildSourceTransactionLegOccurrence,
  buildSourceTransactionLegRevision,
  buildTransactionLegResolutionOccurrence,
  buildTransactionLegResolutionRevision,
  validateSourceTransactionLegOccurrence,
  validateSourceTransactionLegRevision,
  validateTransactionLegResolutionOccurrence,
  validateTransactionLegResolutionRevision,
} = require('../lib/canonical-v2/transaction-leg');

const id = (value) => contentId('TRANSACTION_LEG_TEST/V1', value);

function sourceOccurrence(ordinal = 0, overrides = {}) {
  return buildSourceTransactionLegOccurrence({
    admitted_source_occurrence_id: id(`source-${ordinal}`),
    expected_source_leg_slot_key: `SOURCE_LEG_${ordinal}`,
    governed_deal_id: id('deal'),
    governed_repeatable_ordinal: ordinal,
    leg_definition_and_version: {
      definition_key: 'SOURCE_TRANSACTION_LEG',
      definition_version: 1,
    },
    ...overrides,
  });
}

function participantRefs() {
  return [
    {
      deal_participant_relationship_revision_id: id('buyer-role-revision'),
      role_code: 'BUYER',
      role_layer: 'TRANSACTION_ROLE',
    },
    {
      deal_participant_relationship_revision_id: id('target-role-revision'),
      role_code: 'TARGET',
      role_layer: 'TRANSACTION_ROLE',
    },
  ];
}

function endpoints() {
  return [
    {
      endpoint_slot_key: 'SOURCE_ENDPOINT',
      endpoint_role: 'BUYER',
      entity_subject_id: id('buyer-entity'),
      source_local_subject_occurrence_id: null,
    },
    {
      endpoint_slot_key: 'TARGET_ENDPOINT',
      endpoint_role: 'TARGET',
      entity_subject_id: id('target-entity'),
      source_local_subject_occurrence_id: null,
    },
  ];
}

function sourceRevision(occurrence, legType, overrides = {}) {
  return buildSourceTransactionLegRevision({
    source_transaction_leg_occurrence: occurrence,
    closing_condition: id('closing-condition'),
    effective_time_expression: id('effective-time'),
    evidence_edges: [id(`evidence-${occurrence.governed_repeatable_ordinal}`)],
    leg_type: legType,
    observed_participant_roles: participantRefs(),
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [],
    },
    resolver_version: 'source-leg-resolver/v1',
    source_endpoints: endpoints(),
    source_order: occurrence.governed_repeatable_ordinal,
    state: { code: 'PRESENT' },
    ...overrides,
  });
}

function resolutionOccurrence(ordinal = 0, overrides = {}) {
  return buildTransactionLegResolutionOccurrence({
    expected_deal_leg_slot_key: `DEAL_LEG_${ordinal}`,
    governed_deal_id: id('deal'),
    governed_repeatable_ordinal: ordinal,
    leg_definition_and_version: {
      definition_key: 'TRANSACTION_LEG_RESOLUTION',
      definition_version: 1,
    },
    ...overrides,
  });
}

function sourceLegRef(revision) {
  return {
    source_transaction_leg_revision_id:
      revision.source_transaction_leg_revision_id,
    leg_type: revision.leg_type,
    source_order: revision.source_order,
  };
}

function resolvedRevision(occurrence, sourceRevisions, overrides = {}) {
  return buildTransactionLegResolutionRevision({
    transaction_leg_resolution_occurrence: occurrence,
    closing_conditions: [id('resolved-closing-condition')],
    conflict_disposition: 'CLEAR',
    effective_time_expression: id('resolved-effective-time'),
    evidence_edges: [id('resolved-leg-evidence')],
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [],
    },
    resolved_participant_relationships: participantRefs(),
    resolved_source_and_target_entities: {
      source_entity_ids: [id('buyer-entity')],
      target_entity_ids: [id('target-entity')],
    },
    resolver_version: 'transaction-leg-resolver/v1',
    state: { code: 'PRESENT' },
    supporting_source_leg_revisions: sourceRevisions.map(sourceLegRef),
    ...overrides,
  });
}

test('source and resolved leg occurrences are deterministic and value-independent', () => {
  const source = sourceOccurrence();
  const resolved = resolutionOccurrence();

  assert.equal(validateSourceTransactionLegOccurrence(source), true);
  assert.equal(validateTransactionLegResolutionOccurrence(resolved), true);
  assert.equal(canonicalJson(source), canonicalJson(sourceOccurrence()));
  assert.throws(() => sourceOccurrence(0, { leg_type: 'DIRECT_MERGER' }),
    (error) => error.code === 'INVALID_TRANSACTION_LEG');
  assert.throws(() => resolutionOccurrence(0, { participant_name: 'Pfizer' }),
    (error) => error.code === 'INVALID_TRANSACTION_LEG');
});

test('a source occurrence can receive a new leg classification only through a revision', () => {
  const occurrence = sourceOccurrence();
  const direct = sourceRevision(occurrence, 'DIRECT_MERGER');
  const reverseTriangular = sourceRevision(occurrence, 'REVERSE_TRIANGULAR_MERGER');

  assert.equal(
    direct.source_transaction_leg_occurrence_id,
    reverseTriangular.source_transaction_leg_occurrence_id,
  );
  assert.notEqual(
    direct.source_transaction_leg_revision_id,
    reverseTriangular.source_transaction_leg_revision_id,
  );
});

test('Reverse Morris Trust steps remain three separate linked occurrences', () => {
  const distributionOccurrence = sourceOccurrence(0);
  const contributionOccurrence = sourceOccurrence(1);
  const mergerOccurrence = sourceOccurrence(2);
  const distribution = sourceRevision(
    distributionOccurrence,
    'DISTRIBUTION_OR_SPIN_OFF',
    {
      predecessor_and_successor_occurrence_ids: {
        predecessor_occurrence_ids: [],
        successor_occurrence_ids: [
          contributionOccurrence.source_transaction_leg_occurrence_id,
        ],
      },
    },
  );
  const contribution = sourceRevision(contributionOccurrence, 'CONTRIBUTION', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [
        distributionOccurrence.source_transaction_leg_occurrence_id,
      ],
      successor_occurrence_ids: [
        mergerOccurrence.source_transaction_leg_occurrence_id,
      ],
    },
  });
  const merger = sourceRevision(mergerOccurrence, 'REVERSE_TRIANGULAR_MERGER', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [
        contributionOccurrence.source_transaction_leg_occurrence_id,
      ],
      successor_occurrence_ids: [],
    },
  });

  assert.deepEqual(
    [distribution.leg_type, contribution.leg_type, merger.leg_type],
    ['DISTRIBUTION_OR_SPIN_OFF', 'CONTRIBUTION', 'REVERSE_TRIANGULAR_MERGER'],
  );
  assert.equal(new Set([
    distribution.source_transaction_leg_occurrence_id,
    contribution.source_transaction_leg_occurrence_id,
    merger.source_transaction_leg_occurrence_id,
  ]).size, 3);
});

test('tender offer and second-step merger remain separate legs', () => {
  const offerOccurrence = sourceOccurrence(0);
  const mergerOccurrence = sourceOccurrence(1);
  const offer = sourceRevision(offerOccurrence, 'TENDER_OFFER', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [
        mergerOccurrence.source_transaction_leg_occurrence_id,
      ],
    },
  });
  const merger = sourceRevision(mergerOccurrence, 'SECOND_STEP_MERGER', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [
        offerOccurrence.source_transaction_leg_occurrence_id,
      ],
      successor_occurrence_ids: [],
    },
  });

  assert.notEqual(
    offer.source_transaction_leg_occurrence_id,
    merger.source_transaction_leg_occurrence_id,
  );
  assert.deepEqual([offer.leg_type, merger.leg_type], [
    'TENDER_OFFER',
    'SECOND_STEP_MERGER',
  ]);
});

test('several agreeing source statements can support one terminal resolved leg', () => {
  const first = sourceRevision(sourceOccurrence(0), 'SHARE_PURCHASE');
  const second = sourceRevision(sourceOccurrence(1), 'SHARE_PURCHASE');
  const occurrence = resolutionOccurrence();
  const revision = resolvedRevision(occurrence, [second, first]);

  assert.equal(revision.resolved_leg_type, 'SHARE_PURCHASE');
  assert.equal(revision.terminal_eligible, true);
  assert.equal(validateTransactionLegResolutionRevision({
    revision,
    transaction_leg_resolution_occurrence: occurrence,
  }), true);
});

test('conflicting source-leg types block terminal resolution', () => {
  const direct = sourceRevision(sourceOccurrence(0), 'DIRECT_MERGER');
  const reverse = sourceRevision(sourceOccurrence(1), 'REVERSE_TRIANGULAR_MERGER');
  const occurrence = resolutionOccurrence();

  assert.throws(() => resolvedRevision(occurrence, [direct, reverse]),
    (error) => error.code === 'TRANSACTION_LEG_RESOLUTION_INCOMPLETE');
  const blocked = resolvedRevision(occurrence, [direct, reverse], {
    conflict_disposition: 'CONFLICTING',
  });
  assert.equal(blocked.resolved_leg_type, null);
  assert.equal(blocked.terminal_eligible, false);
});

test('unresolved endpoints and duplicate source revisions cannot become terminal legs', () => {
  const source = sourceRevision(sourceOccurrence(), 'ASSET_TRANSFER');
  const occurrence = resolutionOccurrence();

  assert.throws(() => resolvedRevision(occurrence, [source], {
    resolved_source_and_target_entities: {
      source_entity_ids: [id('buyer-entity')],
      target_entity_ids: [],
    },
  }), (error) => error.code === 'TRANSACTION_LEG_RESOLUTION_INCOMPLETE');
  assert.throws(() => resolvedRevision(occurrence, [source, source]),
    (error) => error.code === 'DUPLICATE_TRANSACTION_LEG_INPUT');
});

test('links cannot be self-referential or both predecessor and successor', () => {
  const occurrence = sourceOccurrence();

  assert.throws(() => sourceRevision(occurrence, 'DIRECT_MERGER', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [
        occurrence.source_transaction_leg_occurrence_id,
      ],
      successor_occurrence_ids: [],
    },
  }), (error) => error.code === 'INVALID_TRANSACTION_LEG_TOPOLOGY');
  assert.throws(() => sourceRevision(occurrence, 'DIRECT_MERGER', {
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [id('another-leg')],
      successor_occurrence_ids: [id('another-leg')],
    },
  }), (error) => error.code === 'INVALID_TRANSACTION_LEG_TOPOLOGY');
  assert.throws(() => buildSourceTransactionLegRevision({
    source_transaction_leg_occurrence: occurrence,
    closing_condition: null,
    effective_time_expression: null,
    evidence_edges: [],
    leg_type: null,
    observed_participant_roles: [],
    predecessor_and_successor_occurrence_ids: {
      predecessor_occurrence_ids: [],
      successor_occurrence_ids: [id('invented-successor')],
    },
    resolver_version: 'source-leg-resolver/v1',
    source_endpoints: [],
    source_order: null,
    state: {
      code: 'NOT_EXAMINED',
      reason: 'The source family was not examined.',
    },
  }), (error) => error.code === 'NON_PRESENT_TRANSACTION_LEG_VALUE');
});

test('validators reject stale source and resolved revision identities', () => {
  const sourceLegOccurrence = sourceOccurrence();
  const sourceLegRevision = sourceRevision(sourceLegOccurrence, 'DIRECT_MERGER');
  const resolvedLegOccurrence = resolutionOccurrence();
  const resolvedLegRevision = resolvedRevision(
    resolvedLegOccurrence,
    [sourceLegRevision],
  );

  assert.equal(validateSourceTransactionLegRevision({
    revision: sourceLegRevision,
    source_transaction_leg_occurrence: sourceLegOccurrence,
  }), true);
  assert.throws(() => validateSourceTransactionLegRevision({
    revision: {
      ...structuredClone(sourceLegRevision),
      source_transaction_leg_revision_id: id('stale-source-revision'),
    },
    source_transaction_leg_occurrence: sourceLegOccurrence,
  }), (error) => error.code === 'STALE_SOURCE_TRANSACTION_LEG_REVISION');
  assert.throws(() => validateTransactionLegResolutionRevision({
    revision: {
      ...structuredClone(resolvedLegRevision),
      transaction_leg_resolution_revision_id: id('stale-resolved-revision'),
    },
    transaction_leg_resolution_occurrence: resolvedLegOccurrence,
  }), (error) => error.code === 'STALE_TRANSACTION_LEG_RESOLUTION_REVISION');
});
