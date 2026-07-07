const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const {
  groupDeferredRows,
  readDeferredRows,
  readDroppedRows,
  toCsv,
} = require('../../lib/reprocess/reconciliation-surfaces');

test('dropped reconciliation surface reads 44 moved or dropped entries', () => {
  const rows = readDroppedRows();
  assert.equal(rows.length, 44);
  assert.ok(rows.every((row) => row.field_key === 'absenceOfChangesExceptions'));
  assert.ok(rows.every((row) => row.queue_entry_id));
  assert.ok(rows.every((row) => Number.isInteger(row.queue_line)));
});

test('schema deferred surface reads 175 waitlist entries grouped by waiting_on', () => {
  const rows = readDeferredRows();
  const groups = groupDeferredRows(rows);
  assert.equal(rows.length, 175);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].waiting_on, 'employment_compensation_structured_object');
  assert.equal(groups[0].count, 175);
  assert.equal(groups[0].target_wp, 'M3 residual schema review');
  assert.equal(groups[0].drain_status, 'Waiting');
  assert.ok(rows.every((row) => row.queue_entry_id));
  assert.ok(rows.every((row) => Number.isInteger(row.queue_line)));
});

test('reconciliation CSV export includes requested visible columns', () => {
  const rows = readDroppedRows().slice(0, 1);
  const csv = toCsv(rows, [
    { key: 'field_key', label: 'field_key' },
    { key: 'raw_value', label: 'raw_value' },
    { key: 'rationale', label: 'rationale' },
    { key: 'source_deals', label: 'source deals' },
    { key: 'resolved_at', label: 'resolved_at' },
  ]);
  assert.match(csv, /^field_key,raw_value,rationale,source deals,resolved_at\n/);
});

test('reconciliation admin pages expose filters, CSV buttons, and queue links', () => {
  const dropped = fs.readFileSync('pages/admin/reconciliation/dropped.js', 'utf8');
  const deferred = fs.readFileSync('pages/admin/reconciliation/deferred.js', 'utf8');
  assert.match(dropped, /data-testid="reconciliation-dropped-page"/);
  assert.match(dropped, /Download CSV/);
  assert.match(dropped, /reconciliation-queue\.json:\{row\.queue_line/);
  assert.match(deferred, /data-testid="reconciliation-deferred-page"/);
  assert.match(deferred, /Download CSV/);
  assert.match(deferred, /waiting_on/);
  assert.match(deferred, /drain_status/);
});
