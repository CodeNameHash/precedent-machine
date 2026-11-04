'use strict';

// Work package 3: reviewer levels, feedback, the section specifics pill,
// the Other provisions colgroup, the review-mode See reason panel and the
// feedback form.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};

const ProvisionTables = require('../components/product/ProvisionTables.jsx').default;
const { ReviewReasonPanel } = require('../components/product/ProvisionTables.jsx');
const FeedbackDialog = require('../components/product/FeedbackDialog.jsx').default;
const {
  createProductFeedbackHandler, KINDS, STATUSES,
} = require('../lib/product/feedback-handler');
const {
  reviewerCookieId, levelLabel, adminActor, reviewerFromRow, reviewerCookie, REVIEWER_COOKIE,
} = require('../lib/product/reviewers');
const { ProductRequestAuthError } = require('../lib/product/request-auth');

function feedbackClient(rows = []) {
  const state = { rows: rows.map((row) => ({ ...row })), inserted: null, updated: null };
  return {
    state,
    from(table) {
      assert.equal(table, 'product_feedback');
      const filters = [];
      const builder = {
        select() { return builder; },
        insert(row) { state.inserted = { ...row }; return builder; },
        update(row) { state.updated = { ...row }; return builder; },
        eq(column, value) { filters.push({ column, value }); return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() {
          if (state.inserted) return Promise.resolve({ data: { id: 'feedback-1', ...state.inserted }, error: null });
          if (state.updated) {
            const found = state.rows.find((row) => filters.every((filter) => row[filter.column] === filter.value));
            return Promise.resolve({ data: found ? { ...found, ...state.updated } : null, error: null });
          }
          const found = state.rows.find((row) => filters.every((filter) => row[filter.column] === filter.value)) || null;
          return Promise.resolve({ data: found, error: null });
        },
        then(resolve, reject) {
          const data = state.rows.filter((row) => filters.every((filter) => row[filter.column] === filter.value));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function mockRes() {
  return {
    statusCode: null, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function handlerArgs(client, { actor = 'ben', admin = true } = {}) {
  return {
    getClient: () => client,
    actorResolver: async () => { if (actor === null) throw new ProductRequestAuthError('UNAUTHENTICATED'); return actor; },
    adminCheck: () => admin,
    reviewerResolver: async () => ({ id: 'r1', name: 'Ben Goodchild', level: 'PARTNER', trusted: true }),
  };
}

const tableShapes = require('../contracts/product/table-shapes.v3.json');

function viewWithSpecifics() {
  return {
    sections: [{
      section_key: 'material-contracts', title: 'Material Contracts',
      tables: [{
        table_key: 'material-contracts-table', layout: 'rows', term_column: { header: 'Contract category' },
        columns: [
          { column_id: 'qualifier', header: 'Qualifier' },
          { column_id: 'asDrafted', header: 'As drafted', specifics: true, display: 'fact_text' },
        ],
        rows: [{
          subject: 'Real estate leases', backing_facts: [{ fact_id: 'f1', section_reference: '3.14' }],
          cells: [
            { column_id: 'qualifier', kind: 'pill', code: 'MATERIAL', label: 'Material', tone: 'buyer', component_ids: ['c1'], fact_ids: ['f1'], words: 'any real property lease' },
            { column_id: 'asDrafted', kind: 'text', label: 'Real estate leases above the threshold', tone: 'neutral', component_ids: ['c1'], fact_ids: ['f1'] },
          ],
        }],
        other_provisions: [{ term: 'Registration rights', common_text: 'A quiet line.', branches: [{ fact_id: 'f1', term: 'Registration rights', text: 'A quiet line.' }] }],
      }],
    }],
    defined_terms: [],
  };
}

const reviewFact = {
  fact_id: 'f1', section_reference: '3.14',
  headline: { label: 'Material Contracts category', summary: 'Real estate leases above the threshold' },
  components: [{ component_id: 'c1', kind: 'TERM', label: 'Contract category', text: 'any real property lease', children: [] }],
};

test('reviewer levels, the cookie and the admin actor are the account rules', () => {
  assert.equal(reviewerCookieId({ headers: { cookie: `${REVIEWER_COOKIE}=abc` } }), 'abc');
  assert.equal(levelLabel('PARTNER'), 'Partner');
  assert.equal(levelLabel('SENIOR_ASSOCIATE'), 'Senior associate');
  assert.equal(adminActor('ben', { AUTH_USERNAME: 'ben' }), true);
  assert.equal(adminActor('someone', { AUTH_USERNAME: 'ben' }), false);
  assert.match(reviewerCookie('abc'), /pm_reviewer=abc/);
  const reviewer = reviewerFromRow({ id: '1', name: 'Ben', level: 'PARTNER', active: true });
  assert.equal(reviewer.trusted, true);
  assert.equal(reviewerFromRow({ id: '2', name: 'A', level: 'JUNIOR_ASSOCIATE' }).trusted, false);
});

test('POST feedback records the context, author and level', async () => {
  const client = feedbackClient();
  const handler = createProductFeedbackHandler(handlerArgs(client));
  const res = mockRes();
  await handler({
    method: 'POST',
    headers: { 'x-pm-csrf': 'same-origin' },
    body: {
      run_id: '11111111-1111-4111-8111-111111111111', page_path: '/review/product/x', section_key: 'material-contracts',
      table_key: 'material-contracts-table', row_subject: 'Real estate leases', column_id: 'qualifier',
      cell_code: 'MATERIAL', cell_label: 'Material', fact_ids: ['f1'], kind: 'WRONG_ANSWER', body: 'The qualifier is wrong.',
    },
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.schema_version, 'PRODUCT_FEEDBACK/V1');
  assert.equal(res.body.trusted, true);
  assert.equal(client.state.inserted.author_name, 'Ben Goodchild');
  assert.equal(client.state.inserted.author_level, 'PARTNER');
  assert.equal(client.state.inserted.status, 'open');
  assert.deepEqual(client.state.inserted.fact_ids, ['f1']);
});

test('POST feedback refuses a missing kind, body or run, and an anonymous reader', async () => {
  const client = feedbackClient();
  const handler = createProductFeedbackHandler(handlerArgs(client));
  for (const body of [{ body: 'x' }, { kind: 'WRONG_ANSWER', body: 'x' }, { kind: 'WRONG_ANSWER', run_id: 'r' }]) {
    const res = mockRes();
    await handler({ method: 'POST', headers: { 'x-pm-csrf': 'same-origin' }, body }, res);
    assert.equal(res.statusCode, 400);
  }
  const anon = mockRes();
  await createProductFeedbackHandler(handlerArgs(client, { actor: null }))({ method: 'POST', headers: { 'x-pm-csrf': 'same-origin' }, body: { kind: 'WRONG_ANSWER', run_id: 'r', body: 'x' } }, anon);
  assert.equal(anon.statusCode, 401);
});

test('feedback GET and PATCH are admin only and keep the status/note', async () => {
  const client = feedbackClient([{ id: '11111111-1111-4111-8111-111111111111', status: 'open', body: 'x', created_at: '2026-11-01T00:00:00.000Z' }]);
  const handler = createProductFeedbackHandler(handlerArgs(client));
  const list = mockRes();
  await handler({ method: 'GET', headers: {}, query: { status: 'open' } }, list);
  assert.equal(list.statusCode, 200);
  assert.equal(list.body.feedback.length, 1);
  const patch = mockRes();
  await handler({ method: 'PATCH', headers: { 'x-pm-csrf': 'same-origin' }, body: { id: '11111111-1111-4111-8111-111111111111', status: 'accepted', resolution_note: 'Fixed in the next run.' } }, patch);
  assert.equal(patch.statusCode, 200);
  assert.equal(patch.body.feedback.status, 'accepted');
  const denied = mockRes();
  await createProductFeedbackHandler(handlerArgs(client, { admin: false }))({ method: 'GET', headers: {}, query: {} }, denied);
  assert.equal(denied.statusCode, 403);
  assert.deepEqual([...KINDS].sort(), ['MISSING', 'OTHER', 'UNCLEAR', 'WRONG_ANSWER']);
  assert.deepEqual([...STATUSES].sort(), ['accepted', 'done', 'open', 'rejected']);
});

test('the section Specifics pill, Other provisions colgroup and scroll margin render', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: viewWithSpecifics(), facts: [] }));
  assert.match(html, /data-testid="section-specifics"/);
  assert.match(html, /scroll-mt-\[70px\]/);
  assert.match(html, /data-testid="other-provisions-table"/);
  assert.match(html, /<col class="w-\[34%\] md:w-\[26%\]"\/>/);
  assert.match(html, /data-show-specifics="false"/);
  const withSpecifics = renderToStaticMarkup(React.createElement(ProvisionTables, { tableView: viewWithSpecifics(), facts: [], initialShowSpecifics: true }));
  assert.match(withSpecifics, /aria-pressed="true"[^>]*data-testid="section-specifics"/);
  assert.match(withSpecifics, /As drafted/);
});

test('review mode shows See reason, and the panel carries the text, tree and actions', () => {
  const html = renderToStaticMarkup(React.createElement(ProvisionTables, {
    tableView: viewWithSpecifics(),
    facts: [reviewFact],
    mode: 'review',
    reviewItemsByFactId: new Map([['f1', { item_id: 'item-1', decision: 'PENDING' }]]),
    sectionTextByFactId: new Map([['f1', { exact_text: 'Section 3.14 Material Contracts. Any real property lease.' }]]),
    onDecision: () => {},
    onComment: () => {},
  }));
  assert.match(html, /data-testid="see-reason"/);
  const panel = renderToStaticMarkup(React.createElement(ReviewReasonPanel, {
    fact: reviewFact,
    reviewItem: { item_id: 'item-1', decision: 'PENDING' },
    sectionText: { exact_text: 'Section 3.14 Material Contracts. Any real property lease.' },
    onDecision: () => {},
    onComment: () => {},
  }));
  assert.match(panel, /data-testid="review-reason"/);
  assert.match(panel, /Provision text/);
  assert.match(panel, /Interpretation tree/);
  assert.match(panel, /Any real property lease/);
  assert.match(panel, /Agree/);
  assert.match(panel, /Disagree/);
  assert.match(panel, /Comment/);
});

test('the feedback form carries the context and the four kinds', () => {
  const html = renderToStaticMarkup(React.createElement(FeedbackDialog, {
    open: true, runId: 'run-1', context: { section_key: 'material-contracts', row_subject: 'Real estate leases', cell_label: 'Material' },
  }));
  assert.match(html, /data-testid="feedback-dialog"/);
  assert.match(html, /data-testid="feedback-context"/);
  assert.match(html, /Wrong answer/);
  assert.match(html, /Missing/);
  assert.match(html, /Unclear/);
  assert.match(html, /Other/);
  assert.match(html, /Send feedback/);
});
