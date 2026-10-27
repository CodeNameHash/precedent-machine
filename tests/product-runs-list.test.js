'use strict';

// Work package 53 (plan finding (288)): the run list the review page shows.
// The store reads product_run_access for the actor and returns the runs
// newest first; the route maps them to the shape the page renders.
const assert = require('node:assert/strict');
const test = require('node:test');
const { ProductPhase1Store } = require('../lib/product/phase-1-store');

function clientWith(rows) {
  const builder = {
    select() { return builder; },
    eq(column, value) {
      assert.equal(column, 'actor');
      assert.equal(value, 'ben');
      return Promise.resolve({ data: rows, error: null });
    },
  };
  return { from(table) { assert.equal(table, 'product_run_access'); return builder; }, rpc: async () => ({ data: null, error: null }) };
}

test('the run list is the actor\'s runs, newest first, and a missing embedding is dropped', async () => {
  const store = new ProductPhase1Store({ client: clientWith([
    { run_id: 'a', access_role: 'OWNER', product_analysis_runs: { run_id: 'a', status: 'READY', created_at: '2026-10-01T00:00:00Z' } },
    { run_id: 'b', access_role: 'OWNER', product_analysis_runs: [{ run_id: 'b', status: 'RUNNING', created_at: '2026-10-05T00:00:00Z' }] },
    { run_id: 'c', access_role: 'OWNER', product_analysis_runs: null },
  ]) });
  const runs = await store.listRuns({ actor: 'ben', limit: 10 });
  assert.deepEqual(runs.map((run) => run.run_id), ['b', 'a']);
  assert.equal(runs[0].access_role, 'OWNER');
  assert.equal(runs[0].status, 'RUNNING');
  // The limit is applied after the ordering.
  assert.deepEqual((await store.listRuns({ actor: 'ben', limit: 1 })).map((run) => run.run_id), ['b']);
});
