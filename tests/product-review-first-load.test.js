'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { ProductPhase1StoreError } = require('../lib/product/phase-1-store');
const { createProductReviewHandler } = require('../lib/product/review-handler');

const runId = '2935661c-3cb5-45cf-98fd-570c73be8e2a';

function analysisFixture() {
  return {
    kind: 'draftAnalysis',
    analysis_run_id: runId,
    draft_analysis_id: 'draft-1',
    fact_links: [],
    proposals: [],
    issues: [],
    coverage_assertions: [],
    sections: [],
  };
}

function reviewState() {
  return {
    schema_version: 'PRODUCT_REVIEW_STATE/V1',
    draft_analysis_id: 'draft-1',
    analysis_run_id: runId,
    status: 'DRAFT',
    items: [],
  };
}

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request() {
  return { method: 'GET', query: { id: runId }, headers: {} };
}

test('first review GET refetches the complete review after bare initialisation', async () => {
  const analysis = analysisFixture();
  const state = reviewState();
  const completeReview = {
    version: 0,
    status: 'DRAFT',
    state,
    revisions: [{ version: 0, event_type: 'INITIALISE' }],
    publications: [],
    release_history: [],
  };
  let getReviewCalls = 0;
  let initialiseCalls = 0;
  const store = {
    assertAccess: async () => {},
    getAgreementAnalysis: async () => analysis,
    getReview: async () => {
      getReviewCalls += 1;
      return getReviewCalls === 1 ? null : completeReview;
    },
    initialiseReview: async ({ state: initialState }) => {
      initialiseCalls += 1;
      assert.equal(initialState.status, 'DRAFT');
      return { version: 0, status: 'DRAFT', state: initialState };
    },
  };
  const handler = createProductReviewHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
  });

  const response = responseDouble();
  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(initialiseCalls, 1);
  assert.equal(getReviewCalls, 2);
  assert.deepEqual(response.body.review.revisions, completeReview.revisions);
  assert.deepEqual(response.body.review.publications, completeReview.publications);
  assert.deepEqual(response.body.review.release_history, completeReview.release_history);
});

test('existing review GET does not initialise and returns its complete review', async () => {
  const analysis = analysisFixture();
  const completeReview = {
    version: 4,
    status: 'DRAFT',
    state: reviewState(),
    revisions: [{ version: 0, event_type: 'INITIALISE' }, { version: 4, event_type: 'SAVE' }],
    publications: [],
    release_history: [],
  };
  let initialiseCalls = 0;
  const store = {
    assertAccess: async () => {},
    getAgreementAnalysis: async () => analysis,
    getReview: async () => completeReview,
    initialiseReview: async () => { initialiseCalls += 1; return completeReview; },
  };
  const handler = createProductReviewHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'lawyer@example.test',
  });

  const response = responseDouble();
  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(initialiseCalls, 0);
  assert.equal(response.body.review.version, 4);
  assert.equal(response.body.review.revisions.length, 2);
});

test('review GET preserves access denial', async () => {
  let getAnalysisCalls = 0;
  const store = {
    assertAccess: async () => { throw new ProductPhase1StoreError('ACCESS_DENIED', 'run access denied'); },
    getAgreementAnalysis: async () => { getAnalysisCalls += 1; return analysisFixture(); },
  };
  const handler = createProductReviewHandler({
    getClient: () => ({}), storeFactory: () => store, actorResolver: async () => 'other@example.test',
  });

  const response = responseDouble();
  await handler(request(), response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'Analysis run not found' });
  assert.equal(getAnalysisCalls, 0);
});
