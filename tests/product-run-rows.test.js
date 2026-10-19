'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { IN_FILTER_CHUNK, loadRunRows, loadTableRows, readRunSnapshot, resolveRunRows, runLabel, sectionReferencesByNode, writeRunSnapshot } = require('../lib/product/run-rows');

const RUN = '72d94dd2-cb59-49cf-8f46-c89d161b7769';

// A supabase-js-shaped client over in-memory rows: from().select().eq()
// .in().order().range() resolves to { data, error } the way the real one
// does, and records what was asked.
function fakeClient(tables) {
  const calls = [];
  return {
    calls,
    from(table) {
      const state = { table, filters: [], order: [], range: null, columns: '*' };
      const query = {
        select(columns) { state.columns = columns; return query; },
        eq(column, value) { state.filters.push({ column, value, kind: 'eq' }); return query; },
        in(column, values) { state.filters.push({ column, value: values, kind: 'in' }); return query; },
        order(column) { state.order.push(column); return query; },
        range(from, to) {
          state.range = [from, to];
          calls.push(state);
          const rows = (tables[table] || []).filter((row) => state.filters.every((filter) => (
            filter.kind === 'eq' ? row[filter.column] === filter.value : filter.value.includes(row[filter.column])
          )));
          return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
        },
      };
      return query;
    },
  };
}

test('loadRunRows pages each table by run id with the table order and the filter', async () => {
  const proposals = Array.from({ length: 7 }, (_, index) => ({ run_id: RUN, proposal_id: `p${index}`, family_key: index % 2 ? 'REPRESENTATIONS' : 'TERMINATION' }));
  const client = fakeClient({ product_proposals: proposals, product_analysis_runs: [{ run_id: RUN, source_generation: 8 }] });
  const run = await loadRunRows({ client, runId: RUN, tables: { product_analysis_runs: {}, product_proposals: { filter: { family_key: 'REPRESENTATIONS' }, pageSize: 2 } } });
  assert.equal(run.run_id, RUN);
  assert.equal(run.tables.product_analysis_runs.length, 1);
  assert.deepEqual(run.tables.product_proposals.map((row) => row.proposal_id), ['p1', 'p3', 'p5']);
  const pages = client.calls.filter((call) => call.table === 'product_proposals');
  assert.equal(pages.length, 2, 'three rows at a page size of two: two pages');
  assert.deepEqual(pages[0].order, ['proposal_id']);
  assert.ok(pages[0].filters.some((filter) => filter.column === 'run_id' && filter.value === RUN));
});

test('loadRunRows refuses an unknown table and a run id that is not a uuid', async () => {
  const client = fakeClient({});
  await assert.rejects(loadRunRows({ client, runId: RUN, tables: ['product_secrets'] }), /unknown run table/);
  await assert.rejects(loadRunRows({ client, runId: 'gen8', tables: ['product_proposals'] }), /must be a uuid/);
});

test('a snapshot round-trips and a row of another run is refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-rows-'));
  const file = path.join(dir, 'run.snapshot.json');
  writeRunSnapshot(file, { run_id: RUN, tables: { product_source_closures: [{ run_id: RUN, structure_node_id: 'n1', section_reference: '6.01' }] } });
  const run = readRunSnapshot(file);
  assert.equal(run.run_id, RUN);
  assert.equal(sectionReferencesByNode(run).get('n1'), '6.01');
  fs.writeFileSync(file, JSON.stringify({ run_id: RUN, tables: { product_issues: [{ run_id: '00000000-0000-0000-0000-000000000000' }] } }));
  assert.throws(() => readRunSnapshot(file), /holds a row of run/);
  fs.writeFileSync(file, JSON.stringify({ run_id: RUN }));
  assert.throws(() => readRunSnapshot(file), /a run snapshot is/);
});

test('resolveRunRows takes snapshots as they are and reads run ids through the client it is given', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-rows-'));
  const file = path.join(dir, 'a.snapshot.json');
  writeRunSnapshot(file, { run_id: RUN, tables: { product_analysis_runs: [{ run_id: RUN, source_generation: 8, retrieval_url: 'https://www.sec.gov/x/d921605dex21.htm' }] } });
  const other = '8c53fb92-06c9-40f1-b6b3-f9da5cdf7b3d';
  const client = fakeClient({ product_analysis_runs: [{ run_id: other, source_generation: 7 }] });
  const runs = await resolveRunRows({ runIds: [other], snapshotFiles: [file], tables: ['product_analysis_runs'], client });
  assert.deepEqual(runs.map((run) => run.run_id), [RUN, other]);
  assert.equal(runLabel(runs[0]), `d921605dex21.htm generation 8 (${RUN.slice(0, 8)})`);
  await assert.rejects(resolveRunRows({ tables: ['product_analysis_runs'], client }), /at least one --run/);
  await assert.rejects(resolveRunRows({ runIds: [other], tables: ['product_analysis_runs'], createClient: () => { throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'); } }), /SUPABASE_URL/);
});

// Plan finding (215): a list filter longer than IN_FILTER_CHUNK is sent in
// chunks (the whole-agreement ablation's proposal ids) and the rows come
// back whole, in the table's order, with no chunk's ids in another's query.
test('a long list filter is sent in chunks and the rows are joined in table order', async () => {
  const count = IN_FILTER_CHUNK * 2 + 7;
  const ids = Array.from({ length: count }, (_, index) => `p${String(count - index).padStart(4, '0')}`);
  const components = ids.map((proposal_id) => ({ run_id: RUN, proposal_id, component_id: 'c1' }));
  const client = fakeClient({ product_fact_components: components });
  const rows = await loadTableRows(client, 'product_fact_components', RUN, { filter: { proposal_id: ids } });
  assert.equal(rows.length, count);
  assert.deepEqual(rows.map((row) => row.proposal_id), [...ids].sort());
  const queries = client.calls.filter((call) => call.table === 'product_fact_components');
  assert.equal(queries.length, 3);
  for (const query of queries) assert.ok(query.filters.find((f) => f.kind === 'in').value.length <= IN_FILTER_CHUNK);
});
