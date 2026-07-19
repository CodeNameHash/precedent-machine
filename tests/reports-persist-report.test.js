/* Tests for lib/reports/persist-report.js — pure helpers + a fake Supabase
   client (no real DB). Covers: ~1MB payload truncation, fail-soft behavior
   when the run_reports table doesn't exist yet, the report-db default-on
   resolution, and kind validation. */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VALID_KINDS,
  capPayload,
  tableUnavailable,
  resolveReportDbFlag,
  persistReport,
} = require('../lib/reports/persist-report');

function fakeSupabase({ insertResult }) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        insert(row) {
          calls.push({ table, row });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve(insertResult);
                },
              };
            },
          };
        },
      };
    },
  };
}

test('VALID_KINDS matches the run_reports CHECK constraint', () => {
  assert.deepEqual(
    [...VALID_KINDS].sort(),
    ['coverage-audit', 'demo-dryrun', 'ingest-qa', 'mint-cards', 'rematerialize-claims', 'span-residual'].sort(),
  );
});

test('capPayload leaves small payloads untouched', () => {
  const payload = { generatedAt: '2026-01-01T00:00:00Z', deals: [{ dealId: 'a' }, { dealId: 'b' }] };
  const capped = capPayload(payload, 1_000_000);
  assert.deepEqual(capped, payload);
  assert.equal(capped.truncated, undefined);
});

test('capPayload truncates deals[] beyond the cap and marks truncated:true', () => {
  const bigText = 'x'.repeat(5000);
  const deals = Array.from({ length: 500 }, (_, i) => ({ dealId: `deal-${i}`, blob: bigText }));
  const payload = { generatedAt: '2026-01-01T00:00:00Z', deals };
  const capped = capPayload(payload, 50_000); // tiny cap forces truncation
  assert.equal(capped.truncated, true);
  assert.equal(capped.truncatedDealCount, 500);
  assert.ok(capped.deals.length < deals.length, 'deals[] must shrink');
  assert.ok(Buffer.byteLength(JSON.stringify(capped), 'utf8') <= 50_000 || capped.deals.length <= 1);
});

test('capPayload with no deals[] array returns payload unchanged even over cap (nothing to truncate)', () => {
  const payload = { generatedAt: '2026-01-01T00:00:00Z', note: 'x'.repeat(200) };
  const capped = capPayload(payload, 50);
  assert.deepEqual(capped, payload);
});

test('tableUnavailable recognizes Postgres 42P01 and PostgREST "does not exist" messages', () => {
  assert.equal(tableUnavailable({ code: '42P01', message: 'relation "run_reports" does not exist' }), true);
  assert.equal(tableUnavailable({ message: 'Could not find the table \'public.run_reports\' in the schema cache' }), true);
  assert.equal(tableUnavailable({ code: '23505', message: 'duplicate key value' }), false);
  assert.equal(tableUnavailable(null), false);
});

test('resolveReportDbFlag defaults ON when a service-role key is present, respects explicit overrides', () => {
  assert.equal(resolveReportDbFlag({}, { hasServiceRoleKey: true }), true);
  assert.equal(resolveReportDbFlag({}, { hasServiceRoleKey: false }), false);
  assert.equal(resolveReportDbFlag({ reportDb: false }, { hasServiceRoleKey: true }), false);
  assert.equal(resolveReportDbFlag({ reportDb: true }, { hasServiceRoleKey: false }), true);
});

test('persistReport fails soft (no throw) when the table does not exist', async () => {
  const sb = fakeSupabase({
    insertResult: { data: null, error: { code: '42P01', message: 'relation "run_reports" does not exist' } },
  });
  const result = await persistReport(sb, {
    kind: 'ingest-qa',
    summary: { pass: true },
    payload: { generatedAt: '2026-01-01T00:00:00Z', deals: [] },
  });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'table-unavailable');
});

test('persistReport fails soft on an unexpected DB error, does not throw', async () => {
  const sb = fakeSupabase({ insertResult: { data: null, error: { code: '500', message: 'connection reset' } } });
  const result = await persistReport(sb, { kind: 'mint-cards', summary: {}, payload: {} });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'db-error');
});

test('persistReport rejects an invalid kind without touching the client', async () => {
  const sb = fakeSupabase({ insertResult: { data: { id: 'x' }, error: null } });
  const result = await persistReport(sb, { kind: 'not-a-real-kind', summary: {}, payload: {} });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'invalid-kind');
  assert.equal(sb.calls.length, 0);
});

test('persistReport writes successfully and returns the inserted id', async () => {
  const sb = fakeSupabase({ insertResult: { data: { id: 'report-123' }, error: null } });
  const result = await persistReport(sb, {
    kind: 'coverage-audit',
    generatedAt: '2026-07-19T00:00:00Z',
    summary: { flagged: 0 },
    payload: { flaggedExclusions: [], missedContent: [], deals: [] },
  });
  assert.equal(result.written, true);
  assert.equal(result.id, 'report-123');
  assert.equal(sb.calls.length, 1);
  assert.equal(sb.calls[0].table, 'run_reports');
  assert.equal(sb.calls[0].row.kind, 'coverage-audit');
  assert.equal(sb.calls[0].row.generated_at, '2026-07-19T00:00:00Z');
});

test('persistReport with no client fails soft', async () => {
  const result = await persistReport(null, { kind: 'ingest-qa', summary: {}, payload: {} });
  assert.equal(result.written, false);
  assert.equal(result.reason, 'no-client');
});
