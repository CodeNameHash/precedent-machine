'use strict';

// Work package 2 (note DEEPSEEK-WORK-PACKAGE-2-COMPARE-2026-11-01) and the
// package 1 review: the comparison cells come from buildTableView, the
// how-common count reads every coded reading, the routes keep their
// 400/401/404/405 contract, and the market line is a line under the page's
// own answer.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { transformSync } = require('next/dist/build/swc');

const {
  agreementLabelFromParties, agreementLabelFromUrl, isAnalysedRun, parseRunIdList, runPhase, statusLabel,
} = require('../lib/product/comparison-runs');
const { buildComparisonView, marketDistribution } = require('../lib/product/comparison-view');
const {
  buildComparisonTablesFromViews, howCommonFromViews, marketLine,
} = require('../lib/product/comparison-tables');
const {
  createComparisonRunsHandler, createComparisonTablesHandler,
  createComparisonHowCommonHandler,
} = require('../lib/product/comparison-handlers');
const { ProductRequestAuthError } = require('../lib/product/request-auth');

require.extensions['.jsx'] = function compileJsx(module, filename) {
  const transformed = transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
};
const HowCommon = require('../components/product/HowCommon').default || require('../components/product/HowCommon');

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

const tableShapes = require('../contracts/product/table-shapes.v3.json');
const legalSchema = require('../contracts/product/legal-schema.v2.json');

const FINAL_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const TABLE = 'material-contracts-table';
const ROW = 'Real estate leases';

function fact({ id = 'f1', code = 'MATERIAL', rowLabel = ROW } = {}) {
  return {
    fact_id: id,
    family_key: 'MATERIAL_CONTRACTS',
    subtype_key: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
    statement: 'Any real property lease.',
    headline: { label: 'Material Contracts category', summary: 'Real estate leases above the threshold' },
    components: [{
      component_id: `${id}-c1`, kind: 'TERM', label: 'Contract category', text: 'any real property lease',
      source_span_id: 's1', start_byte: 0, end_byte: 24, origin: 'OWN', gap_before: false, children: [],
    }],
    conclusions: {
      table_key: TABLE,
      row_label: rowLabel,
      cells: [{ column_id: 'qualifier', code, component_ids: [`${id}-c1`] }],
    },
  };
}

function publishedAgreement({ runId = FINAL_ID, facts = [fact({ id: 'final-fact', code: 'MATERIAL' })] } = {}) {
  return {
    run_id: runId,
    source_document_id: 'doc-final',
    agreement_label: 'Apogee Therapeutics, Inc. / Andor LLC',
    retrieval_url: 'https://www.sec.gov/Archives/final.htm',
    agreement_date: '2026-09-01',
    parties: [{ role: 'COMPANY', name: 'Apogee Therapeutics, Inc.' }, { role: 'PARENT', name: 'Andor LLC' }],
    released_at: '2026-10-20T00:00:00.000Z',
    released_with_warning: false,
    release_warning: null,
    facts,
  };
}

function draftContext() {
  const proposal = {
    proposal_id: 'draft-proposal',
    structure_node_id: 'n1',
    family_key: 'MATERIAL_CONTRACTS',
    subtype_key: 'MATERIAL_CONTRACT_CATEGORY_CRITERION',
    validation_status: 'VALID',
    statement: 'Any real property lease outside the ordinary course.',
    headline: { label: 'Material Contracts category', summary: 'Real estate leases outside the ordinary course' },
    components: [{
      component_id: 'draft-c1', kind: 'TERM', text: 'any lease outside the ordinary course', source_span_id: 's1',
      origin: 'OWN', children: [],
    }],
    conclusions: {
      table_key: TABLE,
      row_label: ROW,
      cells: [{ column_id: 'qualifier', code: 'OUTSIDE_ORDINARY_COURSE', component_ids: ['draft-c1'] }],
    },
    proposition_group_id: 'g1',
    source_closure_id: 'cl1',
    source_span_ids: ['s1'],
  };
  return {
    run: {
      run_id: DRAFT_ID,
      source_document_id: 'doc-draft',
      status: 'READY',
      stage: 'EXTRACT',
      schema_version: 'PRODUCT_LEGAL_SCHEMA/V2',
      source_generation: 7,
      model_config: { provider_id: 'DEEPSEEK' },
      retrieval_url: 'https://www.sec.gov/Archives/draft-merger-agreement.htm',
      created_at: '2026-10-25T00:00:00.000Z',
      updated_at: '2026-10-25T00:10:00.000Z',
    },
    sourceDocument: {
      parties: [{ role: 'COMPANY', name: 'Target Inc.' }, { role: 'PARENT', name: 'Acquirer LLC' }],
      agreement_date: '2026-10-01',
    },
    agreementStructure: {
      nodes: [{ node_id: 'n1', reference: '3.14', kind: 'SECTION', authored_order: 1, title: 'Material Contracts' }],
    },
    sections: [{
      node_id: 'n1',
      section_reference: '3.14',
      routing: { structure_node_id: 'n1', section_reference: '3.14', authored_order: 1, families: ['MATERIAL_CONTRACTS'], disposition: 'FAMILY_ASSIGNED' },
      source_closure: { source_closure_id: 'cl1', structure_node_id: 'n1', section_reference: '3.14', full_section_span_id: 's1' },
      spans: [{
        span_id: 's1', exact_text: 'Section 3.14 Material Contracts. Any real property lease outside the ordinary course.',
        kind: 'FULL_SECTION', structure_node_id: 'n1', source_closure_ids: ['cl1'],
      }],
      proposals: [proposal],
      groups: [],
      links: [],
      issues: [],
      coverage: [],
    }],
  };
}

function fakeClient(tables = {}) {
  return {
    from(table) {
      const rows = Array.isArray(tables[table]) ? tables[table] : [];
      const filters = [];
      let fromIndex = 0;
      let toIndex = Infinity;
      const matches = () => rows.filter((row) => filters.every((filter) => {
        if (filter.type === 'in') return filter.values.includes(row[filter.column]);
        return row[filter.column] === filter.value;
      })).slice(fromIndex, toIndex + 1);
      const builder = {
        select() { return builder; },
        eq(column, value) { filters.push({ type: 'eq', column, value }); return builder; },
        in(column, values) { filters.push({ type: 'in', column, values }); return builder; },
        range(start, end) { fromIndex = start; toIndex = end; return builder; },
        maybeSingle() { return Promise.resolve({ data: matches()[0] || null, error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: matches(), error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

function fakeStore({ runs = [], published = [], tables = {}, draft = null } = {}) {
  return {
    client: fakeClient(tables),
    async listRuns() { return runs; },
    async listPublishedLayeredFacts() { return published; },
    async getRun(runId) {
      if (draft && draft.run.run_id === runId) return draft.run;
      return null;
    },
    async assertAccess({ runId }) {
      if (draft && draft.run.run_id === runId) return 'OWNER';
      const error = new Error('run access denied');
      error.code = 'ACCESS_DENIED';
      throw error;
    },
    async getRunContext(runId) {
      if (draft && draft.run.run_id === runId) {
        return { run: draft.run, sourceDocument: draft.sourceDocument, agreementStructure: draft.agreementStructure };
      }
      throw new Error('analysis run not found');
    },
    async loadPreviewSectionResults(runId) {
      if (draft && draft.run.run_id === runId) return draft.sections;
      return [];
    },
    async getReview() { return null; },
    async loadDraftIssues() { return []; },
  };
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function handlerArgs(store, { actorError = null } = {}) {
  return {
    getClient: () => ({ fake: true }),
    storeFactory: () => store,
    actorResolver: async () => { if (actorError) throw actorError; return 'ben'; },
  };
}

function viewsForTests() {
  const finalView = buildComparisonView({ facts: [fact({ id: 'final-fact', code: 'MATERIAL' })], tableShapes, legalSchema });
  const draftView = buildComparisonView({ facts: [fact({ id: 'draft-fact', code: 'OUTSIDE_ORDINARY_COURSE' })], tableShapes, legalSchema });
  return [
    { run_id: FINAL_ID, agreement_label: 'Apogee / Andor', ...finalView },
    { run_id: DRAFT_ID, agreement_label: 'Target / Acquirer', ...draftView },
  ];
}

test('run labels, phases and the run-id parser are the comparison\'s identity rules', () => {
  assert.equal(agreementLabelFromParties([
    { role: 'COMPANY', name: 'Target Inc.' }, { role: 'PARENT', name: 'Acquirer LLC' },
  ]), 'Target Inc. / Acquirer LLC');
  assert.equal(agreementLabelFromUrl('https://www.sec.gov/Archives/edgar/ncs-merger-agreement.htm'), 'ncs merger agreement');
  assert.equal(runPhase({ status: 'READY' }), 'DRAFT');
  assert.equal(runPhase({ released_at: '2026-10-01' }), 'FINAL');
  assert.equal(isAnalysedRun({ status: 'RUNNING' }), true);
  assert.equal(isAnalysedRun({ status: 'QUEUED' }), false);
  assert.equal(statusLabel('PARTIAL'), 'Partly analysed');
  assert.deepEqual(parseRunIdList(`${FINAL_ID},${DRAFT_ID}`).ids, [FINAL_ID, DRAFT_ID]);
  assert.match(parseRunIdList('not-a-run').error, /invalid run id/);
  assert.match(parseRunIdList('').error, /required/);
  const seven = Array.from({ length: 7 }, (_, index) => `0000000${index}-0000-4000-8000-000000000000`);
  assert.match(parseRunIdList(seven.join(','), { max: 6 }).error, /at most 6/);
});

test('the built page view supplies every comparison cell, including values and sub-rows', () => {
  const view = buildComparisonView({ facts: [fact({ id: 'a', code: 'MATERIAL' })], tableShapes, legalSchema });
  const table = view.tables.find((entry) => entry.table_key === TABLE);
  assert.ok(table);
  const row = table.rows.find((entry) => entry.row_label === ROW);
  assert.ok(row);
  assert.equal(row.cells.length, 1);
  assert.equal(row.cells[0].code, 'MATERIAL');
  assert.equal(row.cells[0].label, 'Material');
  assert.equal(row.cells[0].kind, 'pill');
  assert.equal(row.cells[0].fact_ids[0], 'a');
  const tables = buildComparisonTablesFromViews(viewsForTests());
  assert.equal(tables.length, 1);
  const built = tables[0].rows.find((entry) => entry.row_label === ROW);
  assert.equal(built.by_run[FINAL_ID][0].answer.text, 'Material');
  assert.equal(built.by_run[DRAFT_ID][0].answer.text, 'Not entered into in the ordinary course of business');
  assert.equal(built.n, 2);
});

test('how common counts runs, not facts, and keeps not stated out of the denominator', () => {
  const views = viewsForTests();
  const result = howCommonFromViews(views, TABLE);
  assert.equal(result.runs_total, 2);
  const row = result.rows.find((entry) => entry.row_label === ROW);
  assert.equal(row.answered, 2);
  assert.equal(row.not_stated, 0);
  assert.deepEqual(row.entries.map((entry) => [entry.value, entry.count]), [
    ['Material', 1],
    ['Not entered into in the ordinary course of business', 1],
  ]);
  // A view that has no reading for the table counts as not stated, never a No.
  const empty = buildComparisonView({ facts: [], tableShapes, legalSchema });
  const withEmpty = howCommonFromViews([...views, { run_id: OTHER_ID, ...empty }], TABLE);
  assert.equal(withEmpty.rows.find((entry) => entry.row_label === ROW).not_stated, 1);
});

test('marketDistribution counts a run once per code, and marketLine says Market, Off-market or alone', () => {
  const views = viewsForTests();
  const market = marketDistribution(views, FINAL_ID);
  assert.equal(market.total_runs, 2);
  const key = `${TABLE}|${ROW}|qualifier`;
  assert.equal(market.cells[key].total, 2);
  assert.deepEqual(market.cells[key].codes.MATERIAL, { label: 'Material', count: 1, run_ids: [FINAL_ID] });
  assert.deepEqual(marketLine(market.cells[key], 'MATERIAL'), { kind: 'market', text: 'Market · 1 of 2 deals' });
  assert.deepEqual(marketLine({ total: 3, codes: { MATERIAL: { label: 'Material', count: 2 }, OUTSIDE_ORDINARY_COURSE: { label: 'Not entered into in the ordinary course of business', count: 1 } } }, 'OUTSIDE_ORDINARY_COURSE'), {
    kind: 'off', text: 'Off-market · 1 of 3 · others: Material',
  });
  assert.deepEqual(marketLine({ total: 1, codes: { ONLY: { label: 'Only', count: 1 } } }, 'ONLY'), {
    kind: 'alone', text: 'No comparison · only deal with this row',
  });
  const value = marketDistribution(views, FINAL_ID);
  assert.equal(value.cells[`${TABLE}|${ROW}|qualifier`].codes.MATERIAL.label, 'Material');
});

test('HowCommon renders the count, the not-stated line and the panel form', () => {
  const distribution = {
    row_label: ROW, answered: 3, runs_total: 5, not_stated: 2,
    entries: [
      { value: 'Material', count: 3, share: 0.6, run_ids: ['a', 'b', 'c'] },
      { value: 'Outside ordinary course', count: 1, share: 0.2, run_ids: ['d'] },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(HowCommon, { distribution }));
  assert.match(html, /3 of 5 runs answer/);
  assert.match(html, /Material/);
  assert.match(html, /3 of 3/);
  assert.match(html, /Not stated in 2/);
  assert.match(html, /not a/);
  const panel = renderToStaticMarkup(React.createElement(HowCommon, { distribution, variant: 'panel' }));
  assert.match(panel, /data-variant="panel"/);
});

test('GET /api/product/compare/runs lists a final release and a draft, not a queued run', async () => {
  const draft = draftContext();
  const store = fakeStore({
    runs: [
      { run_id: DRAFT_ID, status: 'READY', created_at: '2026-10-25T00:00:00.000Z', updated_at: '2026-10-25T00:10:00.000Z', source_generation: 7, model_config: { provider_id: 'DEEPSEEK' }, retrieval_url: draft.run.retrieval_url, access_role: 'OWNER' },
      { run_id: OTHER_ID, status: 'QUEUED', created_at: '2026-10-26T00:00:00.000Z', retrieval_url: 'https://example.com/queued.htm', access_role: 'OWNER' },
    ],
    published: [publishedAgreement()],
    tables: {
      product_fact_conclusions: [{ run_id: DRAFT_ID, table_key: TABLE, row_label: ROW, cells: [{ column_id: 'qualifier', code: 'OUTSIDE_ORDINARY_COURSE' }] }],
      product_fact_headlines: [{ run_id: DRAFT_ID }, { run_id: DRAFT_ID }],
    },
  });
  const handler = createComparisonRunsHandler(handlerArgs(store));
  const res = mockRes();
  await handler({ method: 'GET', query: {}, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schema_version, 'PRODUCT_COMPARE_RUNS/V1');
  assert.deepEqual(res.body.runs.map((run) => run.run_id), [DRAFT_ID, FINAL_ID]);
  const draftRow = res.body.runs[0];
  assert.equal(draftRow.phase, 'DRAFT');
  assert.equal(draftRow.analysed, true);
  assert.equal(draftRow.comparable, true);
  assert.equal(draftRow.coded_fact_count, 1);
  assert.equal(draftRow.table_count, 1);
  assert.equal(draftRow.fact_count, 2);
  const finalRow = res.body.runs[1];
  assert.equal(finalRow.phase, 'FINAL');
  assert.equal(finalRow.agreement_label, 'Apogee Therapeutics, Inc. / Andor LLC');
  assert.equal(finalRow.coded_fact_count, 1);
});

test('GET /api/product/compare/runs refuses a non-GET and an unauthenticated reader', async () => {
  const store = fakeStore({});
  const post = mockRes();
  await createComparisonRunsHandler(handlerArgs(store))({ method: 'POST', query: {}, headers: {} }, post);
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.Allow, 'GET');
  const unauth = mockRes();
  await createComparisonRunsHandler(handlerArgs(store, { actorError: new ProductRequestAuthError('UNAUTHENTICATED') }))({ method: 'GET', query: {}, headers: {} }, unauth);
  assert.equal(unauth.statusCode, 401);
});

test('GET /api/product/compare/tables puts a final release and a draft side by side on the page\'s own row', async () => {
  const draft = draftContext();
  const store = fakeStore({ published: [publishedAgreement()], draft });
  const handler = createComparisonTablesHandler(handlerArgs(store));
  const res = mockRes();
  await handler({ method: 'GET', query: { runs: `${FINAL_ID},${DRAFT_ID}` }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schema_version, 'PRODUCT_COMPARE_TABLES/V1');
  assert.equal(res.body.table_shapes_version, 'PRODUCT_TABLE_SHAPES/V3');
  assert.deepEqual(res.body.runs.map((run) => run.phase), ['FINAL', 'DRAFT']);
  assert.equal(res.body.runs[1].agreement_label, 'Target Inc. / Acquirer LLC');
  const table = res.body.tables.find((entry) => entry.table_key === TABLE);
  assert.ok(table);
  const row = table.rows.find((entry) => entry.row_label === ROW);
  assert.ok(row);
  assert.equal(row.by_run[FINAL_ID][0].answer.text, 'Material');
  assert.equal(row.by_run[DRAFT_ID][0].answer.text, 'Not entered into in the ordinary course of business');
  assert.equal(row.by_run[DRAFT_ID][0].fact_id, 'draft-proposal');
});

test('GET /api/product/compare/tables validates the run list and refuses an unreadable draft', async () => {
  const store = fakeStore({ published: [publishedAgreement()] });
  const bad = mockRes();
  await createComparisonTablesHandler(handlerArgs(store))({ method: 'GET', query: { runs: 'nope' }, headers: {} }, bad);
  assert.equal(bad.statusCode, 400);
  const denied = mockRes();
  await createComparisonTablesHandler(handlerArgs(store))({ method: 'GET', query: { runs: DRAFT_ID }, headers: {} }, denied);
  assert.equal(denied.statusCode, 404);
});

test('GET /api/product/compare/how-common reads all comparable runs, or only the selected set', async () => {
  const draft = draftContext();
  const store = fakeStore({
    runs: [{ run_id: DRAFT_ID, status: 'READY', created_at: '2026-10-25T00:00:00.000Z', updated_at: '2026-10-25T00:10:00.000Z', access_role: 'OWNER' }],
    published: [publishedAgreement()],
    draft,
  });
  const all = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: TABLE }, headers: {} }, all);
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.schema_version, 'PRODUCT_COMPARE_HOW_COMMON/V1');
  assert.equal(all.body.scope, 'ALL');
  assert.deepEqual(all.body.reference.run_ids.sort(), [DRAFT_ID, FINAL_ID].sort());
  assert.equal(all.body.rows.find((row) => row.row_label === ROW).answered, 2);
  const selected = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: TABLE, runs: FINAL_ID }, headers: {} }, selected);
  assert.equal(selected.statusCode, 200);
  assert.equal(selected.body.scope, 'SELECTED');
  assert.deepEqual(selected.body.reference.run_ids, [FINAL_ID]);
  assert.equal(selected.body.rows.find((row) => row.row_label === ROW).answered, 1);
});

test('GET /api/product/compare/how-common requires a valid table and a known run', async () => {
  const store = fakeStore({ published: [publishedAgreement()] });
  const noTable = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: {}, headers: {} }, noTable);
  assert.equal(noTable.statusCode, 400);
  const badTable = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: '../etc/passwd' }, headers: {} }, badTable);
  assert.equal(badTable.statusCode, 400);
  const unknownRun = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: TABLE, runs: OTHER_ID }, headers: {} }, unknownRun);
  assert.equal(unknownRun.statusCode, 404);
});

test('the analysed index body renders draft and final rows and the compare action', () => {
  const { AnalysedIndexBody } = require('../pages/analysed/index.js');
  const html = renderToStaticMarkup(React.createElement(AnalysedIndexBody, {
    runs: [
      { run_id: FINAL_ID, phase: 'FINAL', phase_label: 'Final', status: 'FINAL', status_label: 'Final', agreement_label: 'Apogee / Andor', coded_fact_count: 4, table_count: 2, released_at: '2026-10-20T00:00:00.000Z', generation: 5 },
      { run_id: DRAFT_ID, phase: 'DRAFT', phase_label: 'Draft', status: 'READY', status_label: 'Ready', agreement_label: 'Target / Acquirer', coded_fact_count: 3, table_count: 1, created_at: '2026-10-25T00:00:00.000Z', generation: 7 },
    ],
    selected: [FINAL_ID, DRAFT_ID],
  }));
  assert.match(html, /Every run, draft and final/);
  assert.match(html, /Apogee \/ Andor/);
  assert.match(html, /Target \/ Acquirer/);
  assert.match(html, /data-phase="FINAL"/);
  assert.match(html, /data-phase="DRAFT"/);
  assert.match(html, /Compare selected/);
  assert.match(html, /analysed\/compare\?runs=/);
});

// PR 490 re-review: how-common gives one distribution per row, parent row
// and column, never a pool of several columns' readings (the per-share
// "Cash" row mixed the form, the per and the amount).
test('how-common keeps each column of a row apart, and a sub-row apart from its row', () => {
  const view = (runId, cells, sub = []) => ({
    run_id: runId,
    tables: [{ table_key: 'consideration-components', rows: [
      { table_key: 'consideration-components', row_label: 'Cash', row_detail: null, cells },
      ...sub.map((subCells) => ({ table_key: 'consideration-components', row_label: 'Out of the money', row_detail: 'Cash', cells: subCells })),
    ] }],
  });
  const form = { column_id: 'form', code: 'CASH', label: 'Cash' };
  const per = { column_id: 'per', code: 'PER_SHARE_OF_COMPANY_COMMON_STOCK', label: 'Per share of Company Common Stock' };
  const amount = (label) => ({ column_id: 'amount', label });
  const result = howCommonFromViews([
    view('a', [form, per, amount('$135.11')], [[{ column_id: 'form', code: 'NONE', label: 'None' }]]),
    view('b', [form, per, amount('$63')]),
  ], 'consideration-components');
  const keyed = result.rows.map((row) => [row.row_label, row.row_detail, row.column_id, row.entries.map((entry) => `${entry.code}:${entry.count}`).join(',')]);
  assert.deepEqual(keyed, [
    ['Cash', null, 'amount', '$135.11:1,$63:1'],
    ['Cash', null, 'form', 'CASH:2'],
    ['Cash', null, 'per', 'PER_SHARE_OF_COMPANY_COMMON_STOCK:2'],
    ['Out of the money', 'Cash', 'form', 'NONE:1'],
  ]);
  assert.equal(result.rows.find((row) => row.column_id === 'form' && !row.row_detail).entries[0].value, 'Cash');
});
