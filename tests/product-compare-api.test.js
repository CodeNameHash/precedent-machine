'use strict';

// Work package 55 (note DEEPSEEK-NAV-INDEX-COMPARE-2026-11-01): the comparison
// helpers, the three read-only routes and the HowCommon component. The routes
// are exercised in-process over fake stores, the same pattern as
// tests/product-runs-list.test.js and tests/product-published-facts-query.test.js.

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
const {
  buildComparisonTables, codedFactStats, howCommonFromConclusions,
} = require('../lib/product/comparison-tables');
const {
  createComparisonRunsHandler, createComparisonTablesHandler, createComparisonHowCommonHandler,
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

// The page bodies are ESM; the repo's test pattern transforms project .js
// files that carry import/export with SWC (tests/product-published-facts-query.test.js).
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

const FINAL_ID = '11111111-1111-4111-8111-111111111111';
const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

const shapes = {
  schema_version: 'PRODUCT_TABLE_SHAPES/V3',
  sections: [{
    section_key: 'termination-fees',
    title: 'Termination Fees',
    v2_family_keys: [{ key: 'TERMINATION' }],
    tables: [{
      table_key: 'termination-fees-table',
      columns: [{
        column_id: 'trigger',
        render: 'vocabulary',
        vocabulary: [
          { code: 'NO_VOTE', label: 'No-vote termination' },
          { code: 'SUPERIOR_PROPOSAL', label: 'Superior proposal' },
        ],
      }],
    }],
  }],
};

function fact({ id = 'f1', code = 'NO_VOTE', rowLabel = 'Termination fee', runId = null } = {}) {
  return {
    ...(runId ? { run_id: runId } : {}),
    fact_id: id,
    statement: 'The Company shall pay the fee.',
    headline: { label: 'Termination fee', summary: 'The Company pays a fee' },
    components: [{
      component_id: `${id}-c1`, kind: 'TERM', text: 'subject to the termination fee', source_span_id: 's1',
      origin: 'OWN', children: [],
    }],
    conclusions: {
      table_key: 'termination-fees-table',
      row_label: rowLabel,
      cells: [{ column_id: 'trigger', code }],
    },
  };
}

function publishedAgreement({ runId = FINAL_ID, facts = [fact({ id: 'final-fact', code: 'CHANGE_OF_RECOMMENDATION_TERMINATION' })] } = {}) {
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
    family_key: 'TERMINATION',
    subtype_key: 'MUTUAL_CONSENT',
    validation_status: 'VALID',
    statement: 'The Company may terminate on mutual consent.',
    headline: { label: 'Mutual consent', summary: 'The parties may terminate by mutual consent' },
    components: [{
      component_id: 'draft-c1', kind: 'TERM', text: 'by mutual written consent', source_span_id: 's1',
      origin: 'OWN', children: [],
    }],
    conclusions: {
      table_key: 'termination-fees-table',
      row_label: 'Termination fee',
      cells: [{ column_id: 'trigger', code: 'SUPERIOR_PROPOSAL_TERMINATION' }],
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
    },
    sourceDocument: {
      parties: [{ role: 'COMPANY', name: 'Target Inc.' }, { role: 'PARENT', name: 'Acquirer LLC' }],
      agreement_date: '2026-10-01',
    },
    agreementStructure: {
      nodes: [{ node_id: 'n1', reference: '7.1', kind: 'SECTION', authored_order: 1, title: 'Termination' }],
    },
    sections: [{
      node_id: 'n1',
      section_reference: '7.1',
      routing: { structure_node_id: 'n1', section_reference: '7.1', authored_order: 1, families: ['TERMINATION'], disposition: 'FAMILY_ASSIGNED' },
      source_closure: { source_closure_id: 'cl1', structure_node_id: 'n1', section_reference: '7.1', full_section_span_id: 's1' },
      spans: [{
        span_id: 's1', exact_text: 'Section 7.1 Termination. The Company may terminate by mutual written consent.',
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
      const matches = () => rows.filter((row) => filters.every((filter) => {
        if (filter.type === 'in') return filter.values.includes(row[filter.column]);
        return row[filter.column] === filter.value;
      }));
      const builder = {
        select() { return builder; },
        in(column, values) { filters.push({ type: 'in', column, values }); return builder; },
        eq(column, value) { filters.push({ type: 'eq', column, value }); return builder; },
        maybeSingle() { return Promise.resolve({ data: matches()[0] || null, error: null }); },
        then(resolve, reject) { return Promise.resolve({ data: matches(), error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

function fakeStore({
  runs = [], published = [], tables = {}, draft = null, actorResolved = 'ben',
} = {}) {
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
    actorResolved,
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

test('coded tables line up the same provision across runs and a run with no answer stays absent', () => {
  const tables = buildComparisonTables({
    runs: [
      { run_id: 'a', facts: [fact({ id: 'a1', code: 'NO_VOTE' })] },
      { run_id: 'b', facts: [fact({ id: 'b1', code: 'SUPERIOR_PROPOSAL' })] },
      { run_id: 'c', facts: [] },
    ],
    shapes,
  });
  assert.equal(tables.length, 1);
  assert.equal(tables[0].table_key, 'termination-fees-table');
  assert.equal(tables[0].label, 'Termination Fees');
  assert.equal(tables[0].rows.length, 1);
  const row = tables[0].rows[0];
  assert.equal(row.row_label, 'Termination fee');
  assert.equal(row.by_run.a[0].answer.text, 'No-vote termination');
  assert.equal(row.by_run.b[0].answer.text, 'Superior proposal');
  assert.equal(row.by_run.c, undefined);
  assert.equal(row.n, 2);
  assert.deepEqual(row.distribution, [
    { value: 'No-vote termination', count: 1 },
    { value: 'Superior proposal', count: 1 },
  ]);
  assert.deepEqual(codedFactStats([fact({ id: 'a1' }), fact({ id: 'a2', code: 'SUPERIOR_PROPOSAL' })], shapes), {
    coded_fact_count: 2, table_count: 1, row_count: 1,
  });
});

test('how common counts answering runs, not facts, and keeps not stated out of the denominator', () => {
  const conclusions = [
    { run_id: 'a', table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'NO_VOTE' }] },
    { run_id: 'a', table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'NO_VOTE' }] },
    { run_id: 'b', table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'NO_VOTE' }] },
    { run_id: 'c', table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'SUPERIOR_PROPOSAL' }] },
  ];
  const result = howCommonFromConclusions({
    conclusions, tableKey: 'termination-fees-table', shapes, runIds: ['a', 'b', 'c', 'd'],
  });
  assert.equal(result.runs_total, 4);
  assert.equal(result.rows.length, 1);
  const row = result.rows[0];
  assert.equal(row.answered, 3);
  assert.equal(row.not_stated, 1);
  assert.deepEqual(row.entries.map((entry) => [entry.value, entry.count]), [
    ['No-vote termination', 2],
    ['Superior proposal', 1],
  ]);
  // A run with no conclusion for the row counts as not stated, never as a No.
  assert.equal(row.entries.some((entry) => entry.value === 'No'), false);
});

test('HowCommon renders the count, the not-stated line and the panel form', () => {
  const distribution = {
    row_label: 'Termination fee', answered: 3, runs_total: 5, not_stated: 2,
    entries: [
      { value: 'No-vote termination', count: 3, share: 0.6, run_ids: ['a', 'b', 'c'] },
      { value: 'Superior proposal', count: 1, share: 0.2, run_ids: ['d'] },
    ],
  };
  const html = renderToStaticMarkup(React.createElement(HowCommon, { distribution }));
  assert.match(html, /3 of 5 runs answer/);
  assert.match(html, /No-vote termination/);
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
      { run_id: DRAFT_ID, status: 'READY', created_at: '2026-10-25T00:00:00.000Z', source_generation: 7, model_config: { provider_id: 'DEEPSEEK' }, retrieval_url: draft.run.retrieval_url, access_role: 'OWNER' },
      { run_id: OTHER_ID, status: 'QUEUED', created_at: '2026-10-26T00:00:00.000Z', retrieval_url: 'https://example.com/queued.htm', access_role: 'OWNER' },
    ],
    published: [publishedAgreement()],
    tables: {
      product_fact_conclusions: [{ run_id: DRAFT_ID, table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'SUPERIOR_PROPOSAL_TERMINATION' }] }],
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

test('GET /api/product/compare/tables puts a final release and a draft side by side on the coded row', async () => {
  const draft = draftContext();
  const store = fakeStore({
    published: [publishedAgreement()],
    draft,
  });
  const handler = createComparisonTablesHandler(handlerArgs(store));
  const res = mockRes();
  await handler({ method: 'GET', query: { runs: `${FINAL_ID},${DRAFT_ID}` }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.schema_version, 'PRODUCT_COMPARE_TABLES/V1');
  assert.equal(res.body.table_shapes_version, 'PRODUCT_TABLE_SHAPES/V3');
  assert.deepEqual(res.body.runs.map((run) => run.phase), ['FINAL', 'DRAFT']);
  assert.equal(res.body.runs[1].agreement_label, 'Target Inc. / Acquirer LLC');
  const table = res.body.tables.find((entry) => entry.table_key === 'termination-fees-table');
  assert.ok(table);
  const row = table.rows.find((entry) => entry.row_label === 'Termination fee');
  assert.ok(row);
  assert.equal(row.by_run[FINAL_ID][0].answer.text, 'Parent terminates for a Change of Recommendation');
  assert.equal(row.by_run[DRAFT_ID][0].answer.text, 'Company terminates to enter a Superior Proposal agreement');
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

test('GET /api/product/compare/how-common reads all analysed runs, or only the selected set', async () => {
  const draft = draftContext();
  const store = fakeStore({
    runs: [{ run_id: DRAFT_ID, status: 'READY', created_at: '2026-10-25T00:00:00.000Z', access_role: 'OWNER' }],
    published: [publishedAgreement()],
    tables: {
      product_fact_conclusions: [
        { run_id: FINAL_ID, table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'NO_VOTE' }] },
        { run_id: DRAFT_ID, table_key: 'termination-fees-table', row_label: 'Termination fee', cells: [{ column_id: 'trigger', code: 'SUPERIOR_PROPOSAL' }] },
      ],
    },
  });
  const all = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: 'termination-fees-table' }, headers: {} }, all);
  assert.equal(all.statusCode, 200);
  assert.equal(all.body.schema_version, 'PRODUCT_COMPARE_HOW_COMMON/V1');
  assert.equal(all.body.scope, 'ALL');
  assert.deepEqual(all.body.reference.run_ids.sort(), [DRAFT_ID, FINAL_ID].sort());
  assert.equal(all.body.rows[0].answered, 2);
  const selected = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: 'termination-fees-table', runs: FINAL_ID }, headers: {} }, selected);
  assert.equal(selected.statusCode, 200);
  assert.equal(selected.body.scope, 'SELECTED');
  assert.deepEqual(selected.body.reference.run_ids, [FINAL_ID]);
  assert.equal(selected.body.rows[0].answered, 1);
});

test('GET /api/product/compare/how-common requires a valid table and a known run', async () => {
  const store = fakeStore({ published: [publishedAgreement()], tables: { product_fact_conclusions: [] } });
  const noTable = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: {}, headers: {} }, noTable);
  assert.equal(noTable.statusCode, 400);
  const badTable = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: '../etc/passwd' }, headers: {} }, badTable);
  assert.equal(badTable.statusCode, 400);
  const unknownRun = mockRes();
  await createComparisonHowCommonHandler(handlerArgs(store))({ method: 'GET', query: { table: 'termination-fees-table', runs: OTHER_ID }, headers: {} }, unknownRun);
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
