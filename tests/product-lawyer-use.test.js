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

const projectRoot = path.join(__dirname, '..');
const originalJsLoader = require.extensions['.js'];
require.extensions['.js'] = function compileProjectEsm(module, filename) {
  if (!filename.startsWith(projectRoot) || filename.includes(`${path.sep}node_modules${path.sep}`)) {
    return originalJsLoader(module, filename);
  }
  const source = fs.readFileSync(filename, 'utf8');
  if (!/(^|\n)\s*(import\s|export\s)/.test(source)) return originalJsLoader(module, filename);
  const transformed = transformSync(source, {
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
  createProductFeedbackHandler, KINDS, STATUSES, readFilters,
} = require('../lib/product/feedback-handler');
const {
  reviewerCookieId, levelLabel, adminActor, reviewerFromRow, reviewerCookie, REVIEWER_COOKIE,
  reviewerForRequest, reviewersResponse, publicReviewer,
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
    reviewerResolver: async () => ({ id: 'r1', name: 'Ben Goodchild', level: 'PARTNER', active: true, trusted: true }),
  };
}

const RUN_ID = '11111111-1111-4111-8111-111111111111';
const FACT_ID = '44444444-4444-4444-8444-444444444444';

async function postFeedback(handler, body) {
  const res = mockRes();
  await handler({ method: 'POST', headers: { 'x-pm-csrf': 'same-origin' }, body: { kind: 'WRONG_ANSWER', run_id: RUN_ID, body: 'x', ...body } }, res);
  return res;
}

// A product_reviewers client: rows by id, or a thrown / returned error.
function reviewersClient({ rows = [], throws = false, error = null } = {}) {
  return {
    from(table) {
      assert.equal(table, 'product_reviewers');
      let id = null;
      const builder = {
        select() { return builder; },
        eq(column, value) { if (column === 'id') id = value; return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() {
          if (throws) return Promise.reject(new Error('database down'));
          if (error) return Promise.resolve({ data: null, error });
          return Promise.resolve({ data: rows.find((row) => row.id === id) || null, error: null });
        },
      };
      return builder;
    },
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
      cell_code: 'MATERIAL', cell_label: 'Material', fact_ids: [FACT_ID], kind: 'WRONG_ANSWER', body: 'The qualifier is wrong.',
    },
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.schema_version, 'PRODUCT_FEEDBACK/V1');
  assert.equal(res.body.trusted, true);
  assert.equal(client.state.inserted.author_name, 'Ben Goodchild');
  assert.equal(client.state.inserted.author_level, 'PARTNER');
  assert.equal(client.state.inserted.status, 'open');
  assert.equal(client.state.inserted.trusted, true);
  assert.deepEqual(client.state.inserted.fact_ids, [FACT_ID]);
});

test('reviewerForRequest returns null, not a partner, without a valid cookie', async () => {
  const rows = [
    { id: 'p1', name: 'Pat Partner', level: 'PARTNER', email: 'p@example.com', active: true },
    { id: 'j1', name: 'Jo Junior', level: 'JUNIOR_ASSOCIATE', email: null, active: true },
    { id: 'old', name: 'Old Partner', level: 'PARTNER', email: null, active: false },
  ];
  const req = (id) => ({ headers: id ? { cookie: `${REVIEWER_COOKIE}=${id}` } : {} });
  assert.equal(await reviewerForRequest({ req: req(null), client: reviewersClient({ rows }) }), null);
  assert.equal(await reviewerForRequest({ req: req('nobody'), client: reviewersClient({ rows }) }), null);
  assert.equal(await reviewerForRequest({ req: req('old'), client: reviewersClient({ rows }) }), null);
  assert.equal(await reviewerForRequest({ req: req('p1'), client: reviewersClient({ throws: true }) }), null);
  assert.equal(await reviewerForRequest({ req: req('p1'), client: reviewersClient({ error: { message: 'x' } }) }), null);
  assert.equal(await reviewerForRequest({ req: req('p1'), client: null }), null);
  const partner = await reviewerForRequest({ req: req('p1'), client: reviewersClient({ rows }) });
  assert.equal(partner.level, 'PARTNER');
  assert.equal(partner.trusted, true);
  const junior = await reviewerForRequest({ req: req('j1'), client: reviewersClient({ rows }) });
  assert.equal(junior.level, 'JUNIOR_ASSOCIATE');
  assert.equal(junior.trusted, false);
  assert.equal(reviewerFromRow({ id: 'old', name: 'Old', level: 'PARTNER', active: false }).trusted, false);
  const source = fs.readFileSync(path.join(__dirname, '../lib/product/reviewers.js'), 'utf8');
  assert.doesNotMatch(source, /defaultReviewer|Ben Goodchild/);
});

test('POST feedback with no declared reviewer stores the actor, no level and untrusted', async () => {
  for (const resolved of [null, { id: 'x', name: 'Ghost', level: 'NOT_A_LEVEL', active: true }, { id: 'o', name: 'Old', level: 'PARTNER', active: false }]) {
    const client = feedbackClient();
    const handler = createProductFeedbackHandler({ ...handlerArgs(client, { actor: 'session-user' }), reviewerResolver: async () => resolved });
    const res = await postFeedback(handler, {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.trusted, false);
    assert.equal(client.state.inserted.author_id, 'session-user');
    assert.equal(client.state.inserted.author_name, 'session-user');
    assert.equal(client.state.inserted.author_level, null);
    assert.equal(client.state.inserted.trusted, false);
  }
  const client = feedbackClient();
  const handler = createProductFeedbackHandler({ ...handlerArgs(client, { actor: 'session-user' }), reviewerResolver: async () => ({ id: 'j', name: 'Jo Junior', level: 'JUNIOR_ASSOCIATE', active: true, trusted: true }) });
  const res = await postFeedback(handler, {});
  assert.equal(res.body.trusted, false);
  assert.equal(client.state.inserted.author_id, 'session-user');
  assert.equal(client.state.inserted.author_level, 'JUNIOR_ASSOCIATE');
  assert.equal(client.state.inserted.trusted, false);
});

test('the reviewers response hides emails from non-admins and keeps the switcher rendering', () => {
  const rows = [{ id: 'p1', name: 'Pat', level: 'PARTNER', email: 'p@example.com', active: true }];
  const declared = reviewerFromRow(rows[0]);
  const reader = reviewersResponse({ rows, declared, actor: 'reader', admin: false });
  assert.equal(reader.schema_version, 'PRODUCT_REVIEWERS/V1');
  assert.equal('email' in reader.reviewers[0], false);
  assert.equal('email' in reader.current, false);
  assert.deepEqual([reader.reviewers[0].id, reader.reviewers[0].name, reader.reviewers[0].level], ['p1', 'Pat', 'PARTNER']);
  assert.equal(reader.current.id, 'p1');
  assert.equal(reader.current.declared, true);
  const admin = reviewersResponse({ rows, declared, actor: 'ben', admin: true });
  assert.equal(admin.reviewers[0].email, 'p@example.com');
  const undeclared = reviewersResponse({ rows, declared: null, actor: 'reader', admin: false });
  assert.equal(undeclared.current.id, null);
  assert.equal(undeclared.current.name, 'reader');
  assert.equal(undeclared.current.level, null);
  assert.equal(undeclared.current.trusted, false);
  assert.equal(undeclared.current.declared, false);
  assert.equal(publicReviewer(null), null);
});

test('POST feedback validates the run, the fact ids and the field lengths', async () => {
  const client = feedbackClient();
  const handler = createProductFeedbackHandler(handlerArgs(client));
  for (const runId of ['run-1', 42, '', '11111111-1111-4111-8111-11111111111']) {
    assert.equal((await postFeedback(handler, { run_id: runId })).statusCode, 400);
  }
  assert.equal(client.state.inserted, null);
  assert.equal((await postFeedback(handler, { body: 'x'.repeat(10001) })).statusCode, 400);
  assert.equal((await postFeedback(handler, { body: 'x'.repeat(10000) })).statusCode, 201);
  for (const name of ['page_path', 'section_key', 'table_key', 'row_subject', 'column_id', 'cell_code', 'cell_label']) {
    assert.equal((await postFeedback(handler, { [name]: 'y'.repeat(501) })).statusCode, 400, name);
  }
  const ok = await postFeedback(handler, { cell_label: 'y'.repeat(500), fact_ids: [FACT_ID, 'f1', 7, null, FACT_ID, '../x'] });
  assert.equal(ok.statusCode, 201);
  assert.equal(client.state.inserted.cell_label.length, 500);
  assert.deepEqual(client.state.inserted.fact_ids, [FACT_ID]);
});

test('feedback GET filters must be a UUID run and known status, level and kind', async () => {
  const client = feedbackClient([{ id: 'a', run_id: RUN_ID, status: 'open', kind: 'MISSING', author_level: 'PARTNER' }]);
  const handler = createProductFeedbackHandler(handlerArgs(client));
  for (const query of [{ run: 'abc' }, { status: 'closed' }, { level: 'INTERN' }, { kind: 'PRAISE' }]) {
    const res = mockRes();
    await handler({ method: 'GET', headers: {}, query }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
  }
  const res = mockRes();
  await handler({ method: 'GET', headers: {}, query: { run: RUN_ID, status: 'open', level: 'PARTNER', kind: 'MISSING' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.feedback.length, 1);
  assert.deepEqual(readFilters({}).filters, { status: null, run_id: null, author_level: null, kind: null });
});

test('PATCH reopening clears the resolver, time and note', async () => {
  const id = '55555555-5555-4555-8555-555555555555';
  const client = feedbackClient([{ id, status: 'done', resolved_by: 'ben', resolved_at: '2026-11-01T00:00:00.000Z', resolution_note: 'Fixed.' }]);
  const handler = createProductFeedbackHandler(handlerArgs(client));
  const res = mockRes();
  await handler({ method: 'PATCH', headers: { 'x-pm-csrf': 'same-origin' }, body: { id, status: 'open', resolution_note: 'stale' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.state.updated, { status: 'open', resolved_by: null, resolved_at: null, resolution_note: null });
  const noNote = mockRes();
  await createProductFeedbackHandler(handlerArgs(feedbackClient([{ id, status: 'open' }])))({ method: 'PATCH', headers: { 'x-pm-csrf': 'same-origin' }, body: { id, status: 'accepted', resolution_note: '   ' } }, noNote);
  assert.equal(noNote.statusCode, 400);
});

test('the admin page needs a typed note and ignores a partial Run filter', () => {
  const page = require('../pages/admin/feedback.js');
  assert.equal(page.feedbackQuery({ status: 'open', run: '1111', level: '', kind: '' }), 'status=open');
  assert.equal(page.feedbackQuery({ status: '', run: RUN_ID, level: 'PARTNER', kind: 'MISSING' }), `run=${RUN_ID}&level=PARTNER&kind=MISSING`);
  const source = fs.readFileSync(path.join(__dirname, '../pages/admin/feedback.js'), 'utf8');
  assert.doesNotMatch(source, /Reviewed in the feedback list/);
  assert.equal((source.match(/disabled=\{busy \|\| !\(notes\[item\.id\] \|\| ''\)\.trim\(\)\}/g) || []).length, 3);
});

test('the feedback migration bounds the text fields and ties trusted to a trusted level', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261101000000_product_feedback_and_reviewers.sql'), 'utf8');
  assert.match(sql, /body text NOT NULL CHECK \(length\(trim\(body\)\) > 0 AND length\(body\) <= 10000\)/);
  for (const name of ['page_path', 'section_key', 'table_key', 'row_subject', 'column_id', 'cell_code', 'cell_label', 'author_id', 'author_name']) {
    assert.match(sql, new RegExp(`${name} text CHECK \\(${name} IS NULL OR length\\(${name}\\) <= 500\\)`), name);
  }
  assert.match(sql, /trusted boolean NOT NULL DEFAULT false/);
  assert.match(sql, /CHECK \(NOT trusted OR author_level IN \('PARTNER', 'SENIOR_ASSOCIATE'\)\)/);
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
