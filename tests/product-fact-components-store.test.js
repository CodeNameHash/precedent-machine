'use strict';

// Storage and read-path tests for FACT_COMPONENTS/V2
// (contracts/product/fact-components.v2.json), Phase 5B.3 storage half.
// Exercises ProductPhase2Store.commitSection / loadCompletedSectionResults
// against an in-memory fake Postgrest client, following the double pattern
// already used in tests/product-phase-2.test.js (see 'completed section
// reconstruction reads every row beyond a capped database page' and
// 'draft finalisation sends only identities...').

const assert = require('node:assert/strict');
const test = require('node:test');

const { ProductPhase2Store, RESULT_TABLE_ORDER } = require('../lib/product/phase-2-store');

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const NODE_ID = 'n'.repeat(64);
const SPAN_ID = 's'.repeat(64);

// A minimal in-memory double for the tables product_phase2_commit_section
// and loadCompletedSectionResults touch. `rpc` mimics the RPC's row inserts
// (including the ON CONFLICT DO NOTHING / early-return idempotency the real
// migration provides) closely enough to prove the store's own logic --
// prepareSectionResultForCommit's validation and flattening, and
// loadCompletedSectionResults' tree rebuild -- round-trips correctly.
function createFakeClient() {
  const tables = {
    product_section_results: [],
    product_model_calls: [],
    product_source_closures: [],
    product_source_spans: [],
    product_source_closure_spans: [],
    product_section_routings: [],
    product_proposition_groups: [],
    product_proposals: [],
    product_fact_links: [],
    product_issues: [],
    product_coverage_assertions: [],
    product_residual_passes: [],
    product_fact_components: [],
    product_fact_headlines: [],
    product_fact_conclusions: [],
  };

  function fromTable(table) {
    let runIdFilter = null;
    const query = {
      select() { return query; },
      eq(column, value) { if (column === 'run_id') runIdFilter = value; return query; },
      order() { return query; },
      range(from, to) {
        const rows = tables[table] || [];
        const filtered = runIdFilter == null ? rows : rows.filter((row) => row.run_id === runIdFilter);
        return Promise.resolve({ data: filtered.slice(from, to + 1), error: null });
      },
    };
    return query;
  }

  return {
    tables,
    async rpc(name, params) {
      if (name !== 'product_phase2_commit_section') throw new Error(`unexpected rpc ${name}`);
      const runId = params.p_run_id;
      const nodeId = params.p_node_id;
      const prepared = params.p_result;
      if (tables.product_section_results.some((row) => row.run_id === runId && row.structure_node_id === nodeId)) {
        return { data: { ok: true }, error: null };
      }
      for (const call of prepared.model_calls) tables.product_model_calls.push({ run_id: runId, structure_node_id: nodeId, ...call });
      tables.product_source_closures.push({
        run_id: runId, source_closure_id: prepared.source_closure.source_closure_id,
        payload: { ...prepared.source_closure, spans: undefined },
      });
      for (const span of prepared.spans) {
        tables.product_source_spans.push({ run_id: runId, ...span });
        tables.product_source_closure_spans.push({ run_id: runId, source_closure_id: prepared.source_closure.source_closure_id, span_id: span.span_id });
      }
      tables.product_section_routings.push({ run_id: runId, structure_node_id: nodeId, authored_order: 0, payload: prepared.routing });
      for (const group of prepared.groups) tables.product_proposition_groups.push({ run_id: runId, structure_node_id: nodeId, proposition_group_id: group.proposition_group_id, payload: group });
      for (const proposal of prepared.proposals) tables.product_proposals.push({ run_id: runId, structure_node_id: nodeId, proposal_id: proposal.proposal_id, payload: proposal });
      for (const link of prepared.links) tables.product_fact_links.push({ run_id: runId, fact_link_id: link.fact_link_id, from_proposal_id: link.from_proposal_id, payload: link });
      for (const issue of prepared.issues) tables.product_issues.push({ run_id: runId, issue_id: issue.issue_id, structure_node_id: issue.structure_node_id, payload: issue });
      for (const item of prepared.coverage) tables.product_coverage_assertions.push({ run_id: runId, structure_node_id: nodeId, coverage_assertion_id: item.coverage_assertion_id, payload: item });
      tables.product_residual_passes.push({ run_id: runId, structure_node_id: nodeId, payload: prepared.residual_pass });
      tables.product_section_results.push({
        run_id: runId, structure_node_id: nodeId, section_result_id: prepared.section_result_id,
        source_closure_id: prepared.source_closure.source_closure_id,
      });
      for (const row of (prepared.fact_component_rows || [])) tables.product_fact_components.push({ run_id: runId, ...row });
      for (const row of (prepared.fact_headline_rows || [])) tables.product_fact_headlines.push({ run_id: runId, ...row });
      for (const row of (prepared.fact_conclusion_rows || [])) tables.product_fact_conclusions.push({ run_id: runId, ...row });
      return { data: { ok: true }, error: null };
    },
    from: fromTable,
  };
}

function baseResult({ proposals }) {
  return {
    schema_version: 'AGREEMENT_SECTION_DRAFT/V1',
    node_id: NODE_ID,
    section_reference: '1.1',
    source_closure: { source_closure_id: 'c'.repeat(64), section_reference: '1.1' },
    model_calls: [],
    routing: { section_routing_id: 'r'.repeat(64), section_reference: '1.1' },
    residual_pass: { residual_pass_id: 'q'.repeat(64) },
    spans: [{
      span_id: SPAN_ID, start_byte: 0, end_byte: 200, source_document_id: 'd'.repeat(64),
      structure_node_id: NODE_ID, kind: 'FULL_SECTION', coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
      text_sha256: 'x'.repeat(64), exact_text: 'irrelevant for this fixture',
    }],
    proposals,
    groups: [],
    links: [],
    issues: [],
    coverage: [],
    section_result_id: 'z'.repeat(64),
  };
}

function baseProposal(overrides) {
  return {
    proposal_id: 'p'.repeat(64),
    fact_occurrence_id: 'o'.repeat(64),
    model_call_id: 'm'.repeat(64),
    source_closure_id: 'c'.repeat(64),
    proposition_group_id: 'g'.repeat(64),
    family_key: 'MAE_DEFINITION',
    subtype_key: 'EXCLUSION',
    fact_type: 'EXCLUSION',
    state: 'PROPOSED',
    validation_status: 'VALID',
    source_span_ids: [SPAN_ID],
    ...overrides,
  };
}

// A component tree exercising nesting (LIST > LIST_ELEMENT > LIST_ELEMENT),
// a LITANY with members, a THRESHOLD with a canonical value, and a
// CROSS_REFERENCE with resolves_to -- one instance of every shape the
// migration's columns need to carry.
function nestedComponents() {
  return [
    {
      component_id: 'c-litany', kind: 'LITANY', label: 'affected matters',
      text: 'any event, change, circumstance', origin: 'CHAPEAU', origin_structure_node_id: 'intro-1',
      source_span_id: SPAN_ID, start_byte: 0, end_byte: 32, gap_before: false,
      members: ['event', 'change', 'circumstance'], children: [],
    },
    {
      component_id: 'c-war', kind: 'LIST', label: 'war and sabotage',
      text: 'war and sabotage', origin: 'OWN', source_span_id: SPAN_ID,
      start_byte: 32, end_byte: 49, gap_before: true,
      children: [
        {
          component_id: 'c-war-1', kind: 'LIST_ELEMENT', label: 'war', text: 'war', origin: 'OWN',
          source_span_id: SPAN_ID, start_byte: 32, end_byte: 35, gap_before: false,
          children: [
            {
              component_id: 'c-war-1a', kind: 'LIST_ELEMENT', label: 'declared', text: 'declared war',
              origin: 'OWN', source_span_id: SPAN_ID, start_byte: 32, end_byte: 44, gap_before: false, children: [],
            },
          ],
        },
        {
          component_id: 'c-war-2', kind: 'LIST_ELEMENT', label: 'sabotage', text: 'sabotage', origin: 'OWN',
          source_span_id: SPAN_ID, start_byte: 41, end_byte: 49, gap_before: false, children: [],
        },
      ],
    },
    {
      component_id: 'c-threshold', kind: 'THRESHOLD', label: 'materiality threshold', text: '$50,000,000',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 50, end_byte: 61, gap_before: false,
      value: { canonical: '50000000', unit: 'USD' }, children: [],
    },
    {
      component_id: 'c-xref', kind: 'CROSS_REFERENCE', label: 'fee amount', text: 'Section 8.3',
      origin: 'OWN', source_span_id: SPAN_ID, start_byte: 62, end_byte: 73, gap_before: false,
      resolves_to: { structure_node_id: 'n'.repeat(64), fact_id: null, text: 'Company Termination Fee' },
      children: [],
    },
  ];
}

test('a fact component tree round-trips through commit and read: order and nesting preserved', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const components = nestedComponents();
  const headline = { label: 'MAE carve-out', distinguishing_component_ids: ['c-war'] };
  const proposal = baseProposal({ components, headline });
  const result = baseResult({ proposals: [proposal] });

  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result });

  assert.ok(client.tables.product_fact_components.length > 0, 'component rows must be written');
  assert.ok(client.tables.product_fact_headlines.length === 1, 'one headline row must be written');
  assert.equal(client.tables.product_issues.length, 0, 'a valid tree raises no issue');

  const sections = await store.loadCompletedSectionResults(RUN_ID);
  const readProposal = sections[0].proposals[0];
  assert.deepEqual(readProposal.components, components);
  assert.deepEqual(readProposal.headline, headline);
  assert.equal(readProposal.coverage_only, false);
  assert.equal(readProposal.proposal_id, proposal.proposal_id);
  assert.equal(readProposal.validation_status, 'VALID');
});

test('a component tree with problems is rejected: not written, proposal marked INVALID, problems listed', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const components = [{
    component_id: 'c-only', kind: 'TERM', label: 'topic', text: 'geopolitical conditions', origin: 'OWN',
    source_span_id: SPAN_ID, start_byte: 0, end_byte: 20, gap_before: false, children: [],
  }];
  // No distinguishing component named -- the headline rule requires at least one.
  const headline = { label: 'Untethered headline', distinguishing_component_ids: [] };
  const proposal = baseProposal({ components, headline });
  const result = baseResult({ proposals: [proposal] });

  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result });

  assert.equal(client.tables.product_fact_components.length, 0, 'an invalid tree is never written');
  assert.equal(client.tables.product_fact_headlines.length, 0);
  const storedProposal = client.tables.product_proposals.find((row) => row.proposal_id === proposal.proposal_id);
  assert.equal(storedProposal.payload.validation_status, 'INVALID');
  const issue = client.tables.product_issues.find((row) => row.payload.code === 'INVALID_FACT_COMPONENTS');
  assert.ok(issue, 'an issue records the rejected tree');
  assert.equal(issue.payload.proposal_id, proposal.proposal_id);
  const problems = JSON.parse(issue.payload.message);
  assert.ok(problems.some((problem) => /no distinguishing component/.test(problem)));

  // The rejected tree stays in the payload: the proposal_id was hashed over
  // it, so the proposal must read back exactly as written.
  const sections = await store.loadCompletedSectionResults(RUN_ID);
  const readProposal = sections[0].proposals[0];
  assert.deepEqual(readProposal.components, components);
  assert.deepEqual(readProposal.headline, headline);
  assert.equal(readProposal.validation_status, 'INVALID');
});

test('a V1 proposal without components reads back without the components/headline keys', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const proposal = baseProposal({
    statement: 'The Company must not solicit a Competing Proposal.',
    roles: { covenant_obligor: 'Company' },
  });
  const result = baseResult({ proposals: [proposal] });

  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result });

  assert.equal(client.tables.product_fact_components.length, 0);
  assert.equal(client.tables.product_fact_headlines.length, 0);

  const sections = await store.loadCompletedSectionResults(RUN_ID);
  const readProposal = sections[0].proposals[0];
  assert.equal('components' in readProposal, false);
  assert.equal('headline' in readProposal, false);
  assert.equal(readProposal.statement, proposal.statement);
  assert.deepEqual(readProposal.roles, proposal.roles);
});

// FACT_CONCLUSIONS/V1 (contracts/product/fact-conclusions.v1.json), Part 3
// storage: product_fact_conclusions is written in the same atomic section
// commit as components, guarded the same way -- a fact whose conclusions
// fail contract validation is rejected (not written, proposal marked
// INVALID), and a valid one round-trips through commit and read.

function equityAwardComponents() {
  return [
    {
      component_id: 'c-term', kind: 'TERM', label: 'Equity type', text: 'RSUs', origin: 'OWN',
      source_span_id: SPAN_ID, start_byte: 0, end_byte: 4, gap_before: false, children: [],
    },
    {
      component_id: 'c-standard', kind: 'STANDARD', label: 'treatment',
      text: 'converted into the right to receive shares of Parent common stock', origin: 'OWN',
      source_span_id: SPAN_ID, start_byte: 5, end_byte: 72, gap_before: true, children: [],
    },
  ];
}

test('a fact conclusions readout round-trips through commit and read', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const components = equityAwardComponents();
  const headline = { label: 'Equity award', distinguishing_component_ids: ['c-term'] };
  const conclusions = {
    table_key: 'equity-awards-table',
    row_label: 'RSUs',
    cells: [{ column_id: 'consideration', code: 'PARENT_STOCK_ROLLOVER', component_ids: ['c-standard'] }],
  };
  const proposal = baseProposal({
    family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', components, headline, conclusions,
  });
  const result = baseResult({ proposals: [proposal] });

  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result });

  assert.equal(client.tables.product_fact_conclusions.length, 1, 'one conclusions row must be written');
  assert.equal(client.tables.product_issues.length, 0, 'a valid conclusions readout raises no issue');

  const sections = await store.loadCompletedSectionResults(RUN_ID);
  const readProposal = sections[0].proposals[0];
  assert.deepEqual(readProposal.conclusions, conclusions);
  assert.equal(readProposal.validation_status, 'VALID');
});

test('a conclusions readout with an unknown vocabulary code is not written; the proposal stays as compiled with a CONCLUSIONS_DROPPED note', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const components = equityAwardComponents();
  const headline = { label: 'Equity award', distinguishing_component_ids: ['c-term'] };
  const conclusions = {
    table_key: 'equity-awards-table',
    row_label: 'RSUs',
    cells: [{ column_id: 'consideration', code: 'BOGUS_CODE', component_ids: ['c-standard'] }],
  };
  const proposal = baseProposal({
    family_key: 'CONSIDERATION', subtype_key: 'EQUITY_AWARD', components, headline, conclusions,
  });
  const result = baseResult({ proposals: [proposal] });

  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result });

  assert.equal(client.tables.product_fact_conclusions.length, 0, 'an invalid conclusions readout is never written');
  assert.ok(client.tables.product_fact_components.length > 0, 'the (valid) component rows are unaffected');
  const storedProposal = client.tables.product_proposals.find((row) => row.proposal_id === proposal.proposal_id);
  assert.equal(storedProposal.payload.validation_status, 'VALID');
  const issue = client.tables.product_issues.find((row) => row.payload.code === 'CONCLUSIONS_DROPPED');
  assert.equal(issue.payload.kind, 'NOTE');
  assert.ok(issue, 'an issue records the rejected conclusions readout');
  const problems = JSON.parse(issue.payload.message);
  assert.ok(problems.some((problem) => /unknown code "BOGUS_CODE"/.test(problem)));

  // The payload reads back exactly as compiled (its id was hashed over the
  // conclusions); only the readout row is absent.
  const sections = await store.loadCompletedSectionResults(RUN_ID);
  const readProposal = sections[0].proposals[0];
  assert.deepEqual(readProposal.conclusions, conclusions);
  assert.equal(readProposal.validation_status, 'VALID');
});

// headline.summary round-trips through the headline row's nullable
// `summary` column (migration 20260914140000; Ben, 2026-09-14: "it needs to
// be a summary of the provision on the right etc - like in the normal
// course. Not just a sec ref...!"; "1. for now - yes"). A headline without
// one reads back without the key, so older generations are unchanged.
test('headline.summary is written to the headline row and read back into headline.summary', async () => {
  const client = createFakeClient();
  const store = new ProductPhase2Store({ client });
  const components = nestedComponents();
  const headline = { label: 'MAE carve-out', distinguishing_component_ids: ['c-war'], summary: 'Material Adverse Effect excludes effects of war, terrorism and sabotage' };
  const proposal = baseProposal({ components, headline });
  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result: baseResult({ proposals: [proposal] }) });
  assert.equal(client.tables.product_fact_headlines.length, 1);
  assert.equal(client.tables.product_fact_headlines[0].summary, headline.summary);
  assert.equal(client.tables.product_issues.length, 0);
  const sections = await store.loadCompletedSectionResults(RUN_ID);
  assert.deepEqual(sections[0].proposals[0].headline, headline);

  const older = createFakeClient();
  const olderStore = new ProductPhase2Store({ client: older });
  await olderStore.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result: baseResult({ proposals: [baseProposal({ components: nestedComponents(), headline: { label: 'MAE carve-out', distinguishing_component_ids: ['c-war'] } })] }) });
  assert.equal(older.tables.product_fact_headlines[0].summary, null, 'the column is nullable');
  const olderSections = await olderStore.loadCompletedSectionResults(RUN_ID);
  assert.equal(Object.hasOwn(olderSections[0].proposals[0].headline, 'summary'), false);
});

// Metsera generation 7, 2026-09-14: loadCompletedSectionResults pages the
// component rows 500 at a time, ordered by (proposal_id, ordinal). A child
// and a top-level sibling share an ordinal, so the order was not total; the
// tie fell across the 2500-row page boundary, Postgres returned the tied
// rows in a different order on each page, one row came back twice and one
// never, and draft finalisation failed with DRAFT_NESTED_IDENTITY. This
// double resolves ties differently on odd and even pages, as Postgres may.
function createTieFlippingClient(base) {
  return {
    ...base,
    from(table) {
      let runIdFilter = null;
      let orderColumns = [];
      const query = {
        select() { return query; },
        eq(column, value) { if (column === 'run_id') runIdFilter = value; return query; },
        order(column) { orderColumns.push(column); return query; },
        range(from, to) {
          const rows = (base.tables[table] || []).filter((row) => runIdFilter == null || row.run_id === runIdFilter);
          const pageParity = Math.floor(from / (to - from + 1)) % 2;
          const sorted = rows.map((row, index) => ({ row, index })).sort((left, right) => {
            for (const column of orderColumns) {
              const l = left.row[column]; const r = right.row[column];
              if (l < r) return -1;
              if (l > r) return 1;
            }
            return pageParity === 0 ? left.index - right.index : right.index - left.index;
          }).map(({ row }) => row);
          return Promise.resolve({ data: sorted.slice(from, to + 1), error: null });
        },
      };
      return query;
    },
  };
}

test('component rows page in a total order: a tied ordinal across a page boundary still rebuilds every tree', async () => {
  const base = createFakeClient();
  const store = new ProductPhase2Store({ client: base });
  // 80 proposals x 7 rows = 560 rows, so one page boundary at 500, which
  // falls inside proposal 71's rows, between its two tied ordinal-1 rows.
  // Every proposal has a top-level sibling and a child that share ordinal 0
  // and another pair that share ordinal 1.
  const proposals = [];
  for (let i = 0; i < 80; i += 1) {
    const id = String(i).padStart(2, '0');
    const own = (n) => `${id}-${n}`;
    const components = [
      { component_id: own('a'), kind: 'ACTOR', label: 'party', text: 'the Company', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 0, end_byte: 11, gap_before: false, children: [] },
      { component_id: own('b'), kind: 'OPERATION', label: 'operation', text: 'shall pay the fee', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 12, end_byte: 29, gap_before: false, children: [
        { component_id: own('b1'), kind: 'OBJECT', label: 'object', text: 'the fee', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 22, end_byte: 29, gap_before: false, children: [] },
        { component_id: own('b2'), kind: 'QUALIFIER', label: 'qualifier', text: 'promptly', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 30, end_byte: 38, gap_before: true, children: [] },
      ] },
      { component_id: own('c'), kind: 'TERM', label: 'term one', text: 'one', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 40, end_byte: 43, gap_before: true, children: [] },
      { component_id: own('d'), kind: 'TERM', label: 'term two', text: 'two', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 44, end_byte: 47, gap_before: true, children: [] },
      { component_id: own('e'), kind: 'TERM', label: 'term three', text: 'three', origin: 'OWN', source_span_id: SPAN_ID, start_byte: 48, end_byte: 53, gap_before: true, children: [] },
    ];
    proposals.push(baseProposal({
      proposal_id: `${id}${'p'.repeat(62)}`, fact_occurrence_id: `${id}${'o'.repeat(62)}`,
      components, headline: { label: 'Fee', distinguishing_component_ids: [own('b1')] },
    }));
  }
  await store.commitSection({ runId: RUN_ID, nodeId: NODE_ID, workerId: 'worker', attemptToken: 't'.repeat(8), result: baseResult({ proposals }) });
  assert.equal(base.tables.product_fact_components.length, 560);

  const flipping = new ProductPhase2Store({ client: createTieFlippingClient(base) });
  const [section] = await flipping.loadCompletedSectionResults(RUN_ID);
  assert.equal(section.proposals.length, 80);
  for (const proposal of section.proposals) {
    const original = proposals.find((item) => item.proposal_id === proposal.proposal_id);
    assert.deepEqual(
      proposal.components.map((component) => [component.component_id, component.children.map((child) => child.component_id)]),
      original.components.map((component) => [component.component_id, component.children.map((child) => child.component_id)]),
      `proposal ${proposal.proposal_id} must rebuild its tree from paged rows`,
    );
  }
});

test('every paged result table is read in a total order that ends in its own key', () => {
  for (const [table, columns] of Object.entries(RESULT_TABLE_ORDER)) {
    const last = columns[columns.length - 1];
    assert.ok(/_id$/.test(last) || table === 'product_section_results' || table === 'product_fact_headlines' || table === 'product_fact_conclusions', `${table} pages by ${columns.join(', ')}`);
  }
  assert.deepEqual(RESULT_TABLE_ORDER.product_fact_components, ['proposal_id', 'ordinal', 'component_id']);
});
