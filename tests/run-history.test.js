/* Tests for lib/run-history.js — run records and run-to-run diffs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildRunRecord,
  appendRunRecord,
  diffSnapshots,
  formatDiff,
  snapshotProvision,
  snapshotStoredProvision,
  MAX_RUNS_PER_DEAL,
} = require('../lib/run-history');

const mem = (category, text, features = {}) => ({ type: 'TERMF', category, text, features });

test('buildRunRecord snapshots in-memory provisions with hashes and sorted feature keys', () => {
  const rec = buildRunRecord({
    type: 'TERMF',
    backend: 'claude-cli',
    model: 'sonnet',
    timingMs: 1234,
    inserted: 2,
    deleted: 5,
    provisions: [mem('Company Termination Fee', 'fee text', { b: 1, a: 2 })],
  });
  assert.equal(rec.backend, 'claude-cli');
  assert.equal(rec.inserted, 2);
  assert.match(rec.run_id, /-TERMF$/);
  assert.deepEqual(rec.snapshot[0].feature_keys, ['a', 'b']);
  assert.equal(rec.snapshot[0].text_hash.length, 12);
});

test('appendRunRecord caps at MAX_RUNS_PER_DEAL keeping newest', () => {
  let meta = {};
  for (let i = 0; i < MAX_RUNS_PER_DEAL + 5; i++) {
    meta = appendRunRecord(meta, { run_id: `r${i}` });
  }
  assert.equal(meta.extraction_runs.length, MAX_RUNS_PER_DEAL);
  assert.equal(meta.extraction_runs[meta.extraction_runs.length - 1].run_id, `r${MAX_RUNS_PER_DEAL + 4}`);
  assert.equal(meta.extraction_runs[0].run_id, 'r5');
});

test('diffSnapshots reports added, removed, changed, unchanged', () => {
  const before = [
    snapshotProvision(mem('Company Termination Fee', 'fee text', { companyTerminationFee: {} })),
    snapshotProvision(mem('Acquirer Expense Reimbursement', 'enforcement costs', { mainConcept: 'x' })),
    snapshotProvision(mem('Tail Provision', 'tail text', { tailProvision: {} })),
  ];
  const after = [
    snapshotProvision(mem('Company Termination Fee', 'fee text', { companyTerminationFee: {}, interestOnLatePayment: {} })),
    snapshotProvision(mem('Tail Provision', 'tail text', { tailProvision: {} })),
    snapshotProvision(mem('Sole and Exclusive Remedy', 'remedy text', { soleAndExclusiveRemedy: true })),
  ];
  const d = diffSnapshots(before, after);
  assert.equal(d.added.length, 1);
  assert.equal(d.added[0].category, 'Sole and Exclusive Remedy');
  assert.equal(d.removed.length, 1);
  assert.equal(d.removed[0].category, 'Acquirer Expense Reimbursement');
  assert.equal(d.changed.length, 1);
  assert.deepEqual(d.changed[0].deltas, ['+features interestOnLatePayment']);
  assert.equal(d.unchanged, 1);
  const out = formatDiff(d);
  assert.match(out, /\+ \[TERMF\] Sole and Exclusive Remedy/);
  assert.match(out, /- \[TERMF\] Acquirer Expense Reimbursement/);
  assert.match(out, /= 1 unchanged/);
});

test('diffSnapshots pairs duplicate categories without inventing changes', () => {
  const two = [
    snapshotProvision(mem('Superior Proposal', 'text one', { a: 1 })),
    snapshotProvision(mem('Superior Proposal', 'text two', { a: 1 })),
  ];
  const d = diffSnapshots(two, two);
  assert.equal(d.added.length + d.removed.length + d.changed.length, 0);
  assert.equal(d.unchanged, 2);
});

test('snapshotStoredProvision maps DB shape to the same snapshot shape', () => {
  const dbRow = {
    type: 'TERMF',
    category: 'Company Termination Fee',
    full_text: 'fee text',
    ai_metadata: { features: { companyTerminationFee: {} } },
  };
  const s = snapshotStoredProvision(dbRow);
  const m = snapshotProvision(mem('Company Termination Fee', 'fee text', { companyTerminationFee: {} }));
  assert.deepEqual(s, m);
});
