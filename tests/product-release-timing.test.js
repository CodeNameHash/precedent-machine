'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSupervisedRelease } = require('../lib/product/release-evaluation');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const legalSchema = require('../contracts/product/legal-schema.v1.json');

function input(overrides = {}) {
  const roleNames = ['terminating_party', 'action', 'outside_date', 'transaction_not_completed_condition'];
  const roleCoverage = roleNames.map((role) => ({ subject_kind: 'ROLE', subject_id: `occ:${role}`, required_role: role, state: 'FOUND' }));
  const roles = Object.fromEntries(roleNames.map((role) => [role, role]));
  return {
    inventory: [{ inventory_item_id: 'i', severity: 'CRITICAL' }],
    reconciliation: [{ inventory_item_id: 'i', disposition: 'PUBLISHED_FACT', review_item_id: 'f', reviewed_by_role: 'LAWYER' }],
    analysis: { issues: [], sections: [{ structure_node_id: 's' }], proposals: [{ fact_occurrence_id: 'occ', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE' }], coverage_assertions: [{ subject_kind: 'SECTION', subject_id: 's', structure_node_id: 's', state: 'FOUND' }, ...roleCoverage] },
    reviewState: { items: [{ item_id: 'f', kind: 'PROPOSAL', decision: 'ACCEPTED', decided_by_role: 'LAWYER' }], agreement_coverage: { decision: 'ACCEPTED', confirmed_by_role: 'LAWYER' }, metrics: { review_time_seconds: 1200 }, summary: { families: [{ family_key: 'TERMINATION', facts: [{ review_item_id: 'f', family_key: 'TERMINATION', subtype_key: 'OUTSIDE_DATE', fact_type: 'OUTSIDE_DATE', roles, source_span_ids: ['sp'] }] }] } },
    legalSchema, citationAssessments: [{ review_item_id: 'f', exact: true, legally_sufficient: true, narrow: true, reviewed_by_role: 'LAWYER' }],
    elapsedMinutes: 80, developerAssisted: false, processingStartedAt: '2026-01-01T00:00:00Z', processingCompletedAt: '2026-01-01T01:20:00Z', ...overrides,
  };
}

test('effective elapsed rejects under-reported total', () => {
  const result = evaluateSupervisedRelease(input({ elapsedMinutes: 10 }));
  assert.equal(result.diagnostics.processing_minutes, 80);
  assert.equal(result.diagnostics.effective_elapsed_minutes, 100);
  assert.equal(result.bars.review_within_ninety_minutes_without_developer, false);
});

test('missing, reversed and negative timing fail closed', () => {
  for (const timing of [{ processingStartedAt: undefined }, { processingStartedAt: '2026-01-02T00:00:00Z', processingCompletedAt: '2026-01-01T00:00:00Z' }, { elapsedMinutes: -1 }]) {
    assert.equal(evaluateSupervisedRelease(input(timing)).bars.review_within_ninety_minutes_without_developer, false);
  }
});

test('valid total remains eligible', () => {
  const result = evaluateSupervisedRelease(input({ elapsedMinutes: 90, reviewState: { ...input().reviewState, metrics: { review_time_seconds: 600 } } }));
  assert.equal(result.diagnostics.effective_elapsed_minutes, 90);
  assert.equal(result.bars.review_within_ninety_minutes_without_developer, true);
});

test('store reads trusted run and draft timestamps', async () => {
  const store = new ProductPhase3Store({ client: { rpc: async () => ({}), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { created_at: '2026-01-01T01:20:00Z' }, error: null }) }) }) }) } });
  store.getRun = async () => ({ created_at: '2026-01-01T00:00:00Z' });
  assert.deepEqual(await store.getReleaseTiming({ runId: 'run' }), {
    processingStartedAt: '2026-01-01T00:00:00Z', processingCompletedAt: '2026-01-01T01:20:00Z',
  });
});
