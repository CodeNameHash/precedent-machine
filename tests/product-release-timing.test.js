'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSupervisedRelease } = require('../lib/product/release-evaluation');
const { ProductPhase3Store } = require('../lib/product/phase-3-store');
const { applyReviewCommand, REVIEW_STATE_VERSION } = require('../lib/product/review-state');
const { createProductReviewHandler } = require('../lib/product/review-handler');
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

function publishableReview(startedAt) {
  return {
    schema_version: REVIEW_STATE_VERSION,
    draft_analysis_id: 'draft',
    analysis_run_id: '00000000-0000-4000-8000-000000000001',
    status: 'DRAFT',
    started_at: startedAt,
    updated_at: startedAt,
    published_at: null,
    agreement_coverage: { decision: 'ACCEPTED', reviewed_at: startedAt },
    items: [],
    summary: null,
    metrics: null,
    release_evaluation_input: null,
    release_evaluation: null,
  };
}

const emptyAnalysis = { proposals: [], source_closures: [], spans: [] };
const at = (value) => () => new Date(value);

function responseDouble() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('Friday publication and Monday reopen count only cumulative draft intervals', () => {
  let state = publishableReview('2026-01-02T09:00:00Z');
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T09:30:00Z'),
  });
  assert.equal(state.metrics.review_time_seconds, 1800);

  state = applyReviewCommand(state, { type: 'REOPEN' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-05T09:00:00Z'),
  });
  state.agreement_coverage = { decision: 'ACCEPTED', reviewed_at: '2026-01-05T09:04:00Z' };
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-05T09:05:00Z'),
  });

  assert.equal(state.metrics.review_time_seconds, 2100);
  assert.deepEqual(state.review_timing, {
    schema_version: 'PRODUCT_REVIEW_TIMING/V1',
    accumulated_draft_seconds: 2100,
    active_draft_started_at: null,
  });
  const evaluation = evaluateSupervisedRelease(input({
    elapsedMinutes: 1,
    processingStartedAt: '2026-01-02T08:10:00Z',
    processingCompletedAt: '2026-01-02T09:00:00Z',
    reviewState: { ...input().reviewState, metrics: state.metrics },
  }));
  assert.equal(evaluation.diagnostics.processing_minutes, 50);
  assert.equal(evaluation.diagnostics.effective_elapsed_minutes, 85);
  assert.equal(evaluation.bars.timing_measured_without_developer, true);
});

test('repeated reopen accumulates each draft interval without counting published intervals', () => {
  let state = publishableReview('2026-01-02T09:00:00Z');
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T09:10:00Z'),
  });
  state = applyReviewCommand(state, { type: 'REOPEN' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-05T09:00:00Z'),
  });
  state.agreement_coverage = { decision: 'ACCEPTED', reviewed_at: '2026-01-05T09:04:00Z' };
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-05T09:05:00Z'),
  });
  state = applyReviewCommand(state, { type: 'REOPEN' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-06T11:00:00Z'),
  });
  state.agreement_coverage = { decision: 'ACCEPTED', reviewed_at: '2026-01-06T11:01:00Z' };
  state = applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-06T11:02:00Z'),
  });

  assert.equal(state.metrics.review_time_seconds, 1020);
});

test('review clock rejects publication or reopen timestamps that move backwards', () => {
  const initial = publishableReview('2026-01-02T09:00:00Z');
  assert.throws(() => applyReviewCommand(initial, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T08:59:00Z'),
  }), /REVIEW_TIMING/);

  const published = applyReviewCommand(initial, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T09:10:00Z'),
  });
  assert.throws(() => applyReviewCommand(published, { type: 'REOPEN' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T09:09:00Z'),
  }), /REVIEW_TIMING/);
});

test('published snapshots from before cumulative timing reopen from stored review metrics', () => {
  const initial = publishableReview('2026-01-02T09:00:00Z');
  const published = applyReviewCommand(initial, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-02T09:10:00Z'),
  });
  delete published.review_timing;
  const reopened = applyReviewCommand(published, { type: 'REOPEN' }, {
    analysis: emptyAnalysis, legalSchema, clock: at('2026-01-05T09:00:00Z'),
  });
  assert.deepEqual(reopened.review_timing, {
    schema_version: 'PRODUCT_REVIEW_TIMING/V1',
    accumulated_draft_seconds: 600,
    active_draft_started_at: '2026-01-05T09:00:00.000Z',
  });
});

test('review API upgrades an old restored draft from publication metrics and draft transition time', async () => {
  const oldReopened = {
    ...publishableReview('2026-01-02T09:00:00Z'),
    updated_at: '2026-01-05T09:00:00Z',
    agreement_coverage: { decision: 'ACCEPTED', reviewed_at: '2026-01-05T09:04:00Z' },
  };
  const analysis = {
    ...emptyAnalysis,
    kind: 'draftAnalysis',
    draft_analysis_id: oldReopened.draft_analysis_id,
  };
  let review = {
    version: 4,
    state: oldReopened,
    revisions: [{ version: 4, event_type: 'RESTORE', created_at: '2026-01-05T09:00:00Z' }],
    publications: [{ publication_version: 1, review_version: 3, metrics: { review_time_seconds: 600 } }],
  };
  const store = {
    assertAccess: async () => 'OWNER',
    getAgreementAnalysis: async () => analysis,
    getReview: async () => review,
    saveReview: async ({ state }) => {
      review = { ...review, version: 5, status: state.status, state };
      return review;
    },
  };
  const handler = createProductReviewHandler({
    getClient: () => ({}),
    storeFactory: () => store,
    actorResolver: async () => 'lawyer@example.test',
    clock: at('2026-01-05T09:05:00Z'),
  });
  const response = responseDouble();
  await handler({
    method: 'POST', query: { id: oldReopened.analysis_run_id },
    headers: { 'x-pm-csrf': 'same-origin' },
    body: { expected_version: 4, idempotency_key: 'publish-old-reopen', command: { type: 'PUBLISH' } },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.review.state.metrics.review_time_seconds, 900);
  assert.equal(response.body.review.state.review_timing.accumulated_draft_seconds, 900);
});

test('old reopened draft fails closed when historical timing is incomplete', () => {
  const state = publishableReview('2026-01-02T09:00:00Z');
  assert.throws(() => applyReviewCommand(state, { type: 'PUBLISH' }, {
    analysis: emptyAnalysis,
    legalSchema,
    clock: at('2026-01-05T09:05:00Z'),
    reviewHistory: {
      hasPriorPublication: true,
      accumulatedDraftSeconds: undefined,
      activeDraftStartedAt: '2026-01-05T09:00:00Z',
    },
  }), /REVIEW_TIMING/);
});

test('effective elapsed reports an under-stated total without imposing a duration limit', () => {
  const result = evaluateSupervisedRelease(input({ elapsedMinutes: 10 }));
  assert.equal(result.diagnostics.processing_minutes, 80);
  assert.equal(result.diagnostics.effective_elapsed_minutes, 100);
  assert.equal(result.bars.timing_measured_without_developer, true);
  assert.equal(result.passed, true);
});

test('missing, reversed and negative timing fail closed', () => {
  for (const timing of [{ processingStartedAt: undefined }, { processingStartedAt: '2026-01-02T00:00:00Z', processingCompletedAt: '2026-01-01T00:00:00Z' }, { elapsedMinutes: -1 }]) {
    assert.equal(evaluateSupervisedRelease(input(timing)).bars.timing_measured_without_developer, false);
  }
});

test('valid timing over ninety minutes remains eligible without developer assistance', () => {
  const result = evaluateSupervisedRelease(input({ elapsedMinutes: 120, reviewState: { ...input().reviewState, metrics: { review_time_seconds: 6000 } } }));
  assert.equal(result.diagnostics.effective_elapsed_minutes, 180);
  assert.equal(result.bars.timing_measured_without_developer, true);
  assert.equal(result.passed, true);
});

test('store reads trusted run and draft timestamps', async () => {
  const store = new ProductPhase3Store({ client: { rpc: async () => ({}), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { created_at: '2026-01-01T01:20:00Z' }, error: null }) }) }) }) } });
  store.getRun = async () => ({ created_at: '2026-01-01T00:00:00Z' });
  assert.deepEqual(await store.getReleaseTiming({ runId: 'run' }), {
    processingStartedAt: '2026-01-01T00:00:00Z', processingCompletedAt: '2026-01-01T01:20:00Z',
  });
});
