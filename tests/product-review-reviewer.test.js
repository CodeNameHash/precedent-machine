'use strict';

// Review decisions record the declared reviewer (the pm_reviewer cookie,
// work package 3 section D). The cookie is a preference, not
// authentication: no cookie means a null reviewer and the decision still
// applies; stored items without the field still load and decide.

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyReviewCommand, initialiseReviewState, reviewerStamp } = require('../lib/product/review-state');
const { createProductReviewHandler } = require('../lib/product/review-handler');
const legalSchema = require('../contracts/product/legal-schema.v1.json');

const runId = '00000000-0000-4000-8000-000000000001';
const nodeOne = 'n'.repeat(64);
const closureId = 'c'.repeat(64);
const spanId = 's'.repeat(64);
const proposalId = 'p'.repeat(64);
const reviewerId = '11111111-1111-4111-8111-111111111111';

function analysisFixture() {
  return {
    schema_version: 'AGREEMENT_ANALYSIS_READ/V1', kind: 'draftAnalysis', analysis_run_id: runId,
    legal_schema_version: legalSchema.schema_version,
    draft_analysis_id: 'd'.repeat(64),
    source_document: { source_document_id: 'e'.repeat(64), parties: ['Buyer', 'Target'] },
    agreement_structure: { nodes: [{ node_id: nodeOne, kind: 'SECTION', reference: '7.1', authored_order: 1, title: 'Termination' }] },
    sections: [{ section_routing_id: 'r'.repeat(64), structure_node_id: nodeOne, section_reference: '7.1', disposition: 'FAMILY_ASSIGNED', families: ['TERMINATION'] }],
    proposals: [{
      proposal_id: proposalId, fact_occurrence_id: 'f'.repeat(64), structure_node_id: nodeOne, source_closure_id: closureId,
      proposition_group_id: null, family_key: 'TERMINATION', subtype_key: 'MUTUAL_CONSENT', fact_type: 'TERMINATION_RIGHT',
      statement: 'The parties may terminate by mutual consent.', roles: { action: 'terminate', trigger: 'mutual written consent', terminating_parties: 'Parent and the Company', writing_requirement: 'written consent' },
      canonical_value: null, validation_status: 'VALID', source_span_ids: [spanId], unmatched_evidence: [], context_only_evidence: [],
    }],
    proposition_groups: [], fact_links: [], issues: [], coverage_assertions: [],
    source_closures: [{ source_closure_id: closureId, structure_node_id: nodeOne }],
    spans: [{ span_id: spanId, structure_node_id: nodeOne, source_closure_ids: [closureId], exact_text: 'by mutual written consent', start_byte: 0, end_byte: 25, kind: 'SUPPORTING_EVIDENCE' }],
  };
}

const clock = () => new Date('2026-11-04T10:00:00.000Z');

// A Supabase-shaped client holding one product_reviewers row.
function clientWith(rows) {
  return {
    from(table) {
      assert.equal(table, 'product_reviewers');
      let id = null;
      const query = {
        select() { return query; },
        eq(column, value) { assert.equal(column, 'id'); id = value; return query; },
        async maybeSingle() { return { data: rows.find((row) => row.id === id) || null, error: null }; },
      };
      return query;
    },
  };
}

function storeDouble(analysis, state) {
  const store = {
    review: { version: 1, status: 'DRAFT', state, revisions: [], publications: [], release_history: [] },
    saved: [],
    assertAccess: async () => {},
    getAgreementAnalysis: async () => analysis,
    getRunContext: async () => ({ sourceDocument: { canonical_text: '' } }),
    getReview: async () => store.review,
    initialiseReview: async () => { throw new Error('not expected'); },
    listReferenceSources: async () => [],
    saveReview: async ({ state: next, command, expectedVersion }) => {
      assert.equal(expectedVersion, store.review.version);
      store.saved.push(command);
      store.review = { ...store.review, version: store.review.version + 1, state: next };
      return store.review;
    },
  };
  return store;
}

function responseDouble() {
  return {
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function post(body, cookie) {
  return {
    method: 'POST', query: { id: runId }, body,
    headers: { 'x-pm-csrf': 'same-origin', ...(cookie ? { cookie } : {}) },
  };
}

function handlerFor(store, client) {
  return createProductReviewHandler({
    getClient: () => client, storeFactory: () => store, actorResolver: async () => 'ben', clock,
  });
}

const partnerRow = { id: reviewerId, name: 'Ben Goodchild', level: 'PARTNER', email: 'ben@example.test', active: true };

test('with a reviewer cookie, decide, comment and reset record the declared reviewer', async () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const store = storeDouble(analysis, state);
  const handler = handlerFor(store, clientWith([partnerRow]));
  const cookie = `pm_reviewer=${reviewerId}`;
  const expected = { id: reviewerId, name: 'Ben Goodchild', level: 'PARTNER', trusted: true };

  const decided = responseDouble();
  // A reviewer sent in the body is replaced by the one the cookie names.
  await handler(post({ expected_version: 1, idempotency_key: 'k1', command: {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    reviewer: { id: 'forged', name: 'Someone', level: 'PARTNER', trusted: true },
  } }, cookie), decided);
  assert.equal(decided.statusCode, 200);
  const afterDecide = decided.body.review.state.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(afterDecide.decision, 'ACCEPTED');
  assert.deepEqual(afterDecide.decided_by_reviewer, expected);
  assert.equal(Object.hasOwn(afterDecide.decided_by_reviewer, 'email'), false);
  assert.deepEqual(store.saved[0].reviewer, expected);

  const commented = responseDouble();
  await handler(post({ expected_version: 2, idempotency_key: 'k2', commands: [
    { type: 'COMMENT_ITEM', item_id: item.item_id, comment: 'Check the tail.' },
  ] }, cookie), commented);
  assert.equal(commented.statusCode, 200);
  const afterComment = commented.body.review.state.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(afterComment.comment, 'Check the tail.');
  assert.deepEqual(afterComment.comment_reviewer, expected);
  assert.deepEqual(store.saved[1].commands[0].reviewer, expected);

  const reset = responseDouble();
  await handler(post({ expected_version: 3, idempotency_key: 'k3', command: { type: 'RESET_ITEM', item_id: item.item_id } }, cookie), reset);
  assert.equal(reset.statusCode, 200);
  const afterReset = reset.body.review.state.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(afterReset.decision, 'PENDING');
  assert.equal(Object.hasOwn(afterReset, 'decided_by_reviewer'), false);
  assert.deepEqual(afterReset.reset_by_reviewer, expected);
  assert.deepEqual(afterReset.comment_reviewer, expected);
});

test('a junior reviewer is recorded as untrusted', async () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const store = storeDouble(analysis, state);
  const junior = { ...partnerRow, name: 'Alex Junior', level: 'JUNIOR_ASSOCIATE' };
  const response = responseDouble();
  await handlerFor(store, clientWith([junior]))(post({ expected_version: 1, idempotency_key: 'k1', command: {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'REJECTED',
  } }, `pm_reviewer=${reviewerId}`), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.review.state.items.find((candidate) => candidate.item_id === item.item_id).decided_by_reviewer,
    { id: reviewerId, name: 'Alex Junior', level: 'JUNIOR_ASSOCIATE', trusted: false });
});

test('without a cookie (or with an unknown or inactive one) the reviewer is null and the decision still applies', async () => {
  for (const [cookie, rows] of [[null, [partnerRow]], ['pm_reviewer=unknown', [partnerRow]], [`pm_reviewer=${reviewerId}`, [{ ...partnerRow, active: false }]]]) {
    const analysis = analysisFixture();
    const state = initialiseReviewState(analysis, { clock });
    const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
    const store = storeDouble(analysis, state);
    const response = responseDouble();
    await handlerFor(store, clientWith(rows))(post({ expected_version: 1, idempotency_key: 'k1', command: {
      type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
    } }, cookie), response);
    assert.equal(response.statusCode, 200);
    const after = response.body.review.state.items.find((candidate) => candidate.item_id === item.item_id);
    assert.equal(after.decision, 'ACCEPTED');
    assert.equal(after.decided_by_reviewer, null);
    assert.equal(store.saved[0].reviewer, null);
  }
});

test('a command applied without a reviewer field stores a null reviewer', () => {
  const analysis = analysisFixture();
  const state = initialiseReviewState(analysis, { clock });
  const item = state.items.find((candidate) => candidate.kind === 'PROPOSAL');
  const decided = applyReviewCommand(state, { type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED' }, { analysis, legalSchema, clock });
  assert.equal(decided.items.find((candidate) => candidate.item_id === item.item_id).decided_by_reviewer, null);
  const commented = applyReviewCommand(state, { type: 'COMMENT_ITEM', item_id: item.item_id, comment: 'x' }, { analysis, legalSchema, clock });
  assert.equal(commented.items.find((candidate) => candidate.item_id === item.item_id).comment_reviewer, null);
  assert.equal(reviewerStamp({ id: 'x', name: 'y', level: 'NOT_A_LEVEL' }), null);
  assert.equal(reviewerStamp('x'), null);
});

test('an old stored state without reviewer fields still loads and decides', async () => {
  const analysis = analysisFixture();
  const fresh = initialiseReviewState(analysis, { clock });
  const item = fresh.items.find((candidate) => candidate.kind === 'PROPOSAL');
  // A state saved before this change: decided and commented, with no reviewer fields.
  const old = {
    ...fresh,
    items: fresh.items.map((candidate) => candidate.item_id === item.item_id
      ? { ...candidate, decision: 'REJECTED', reviewed_at: '2026-10-01T00:00:00.000Z', comment: 'old', commented_at: '2026-10-01T00:00:00.000Z' }
      : candidate),
  };
  for (const candidate of old.items) {
    assert.equal(Object.hasOwn(candidate, 'decided_by_reviewer'), false);
    assert.equal(Object.hasOwn(candidate, 'comment_reviewer'), false);
  }
  const store = storeDouble(analysis, old);
  const handler = handlerFor(store, clientWith([partnerRow]));

  const loaded = responseDouble();
  await handler({ method: 'GET', query: { id: runId }, headers: {} }, loaded);
  assert.equal(loaded.statusCode, 200);
  assert.equal(loaded.body.review.state.items.find((candidate) => candidate.item_id === item.item_id).decision, 'REJECTED');

  const decided = responseDouble();
  await handler(post({ expected_version: 1, idempotency_key: 'k1', command: {
    type: 'DECIDE_ITEM', item_id: item.item_id, decision: 'ACCEPTED',
  } }, `pm_reviewer=${reviewerId}`), decided);
  assert.equal(decided.statusCode, 200);
  const after = decided.body.review.state.items.find((candidate) => candidate.item_id === item.item_id);
  assert.equal(after.decision, 'ACCEPTED');
  assert.equal(after.comment, 'old');
  assert.equal(Object.hasOwn(after, 'comment_reviewer'), false);
  assert.equal(after.decided_by_reviewer.name, 'Ben Goodchild');
});
