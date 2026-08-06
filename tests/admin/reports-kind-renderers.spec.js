/* Fixture-driven tests for the /admin/reports/[kind] pure data-shaping
   helpers (docs/archive/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md §7 item 4).
   No React rendering harness exists in this repo (see tests/admin/*.spec.js
   precedent — page-source regex assertions, not component rendering), and
   this repo's `node --test` runner can't require() JSX pages directly — so
   the pure builders live in lib/reports/render-helpers.js (imported by both
   pages/admin/reports/index.js and [kind].js) and are fixture-tested here. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  REPORT_KINDS,
  summaryStatus,
  buildIngestQaRows,
  buildCoverageAuditView,
  buildMaterializeView,
  buildDemoDryrunSteps,
} = require('../../lib/reports/render-helpers');
const { VALID_KINDS } = require('../../lib/reports/persist-report');

test('buildIngestQaRows splits checks into gate/metadata groups and carries pass/staging/error', () => {
  const payload = {
    generatedAt: '2026-07-19T00:00:00Z',
    deals: [
      {
        dealId: 'd1',
        label: 'Acme / Widget',
        pass: true,
        staging: false,
        checks: [
          { label: 'REP-T', group: 'gate', pass: true },
          { label: 'buyer_display', group: 'metadata', pass: true },
        ],
      },
      { dealId: 'd2', label: 'Bad Deal', error: 'boom', pass: false },
    ],
  };
  const rows = buildIngestQaRows(payload);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].gateChecks.length, 1);
  assert.equal(rows[0].metaChecks.length, 1);
  assert.equal(rows[0].pass, true);
  assert.equal(rows[1].error, 'boom');
  assert.equal(rows[1].pass, false);
});

test('buildIngestQaRows degrades gracefully on malformed/missing payload', () => {
  assert.deepEqual(buildIngestQaRows(null), []);
  assert.deepEqual(buildIngestQaRows({}), []);
  assert.deepEqual(buildIngestQaRows({ deals: 'not-an-array' }), []);
});

test('buildCoverageAuditView returns flaggedExclusions/missedContent arrays, defaulting to empty', () => {
  const view = buildCoverageAuditView({
    flaggedExclusions: [{ deal: 'X', label: 'cover_toc', length: 500, verdict: { rationale: 'r' } }],
    missedContent: [],
  });
  assert.equal(view.flaggedExclusions.length, 1);
  assert.equal(view.missedContent.length, 0);
  assert.deepEqual(buildCoverageAuditView({}), { flaggedExclusions: [], missedContent: [] });
  assert.deepEqual(buildCoverageAuditView(null), { flaggedExclusions: [], missedContent: [] });
});

test('buildMaterializeView normalizes mint-cards entries[] and rematerialize-claims claimsToUpsert/matched into one entryCount shape', () => {
  const mintPayload = {
    apply: true,
    summary: { minted: 3 },
    deals: [{ dealId: 'd1', ok: true, entries: [{ status: 'MINTED' }, { status: 'MINTED' }] }],
  };
  const mintView = buildMaterializeView(mintPayload);
  assert.equal(mintView.apply, true);
  assert.equal(mintView.deals[0].entryCount, 2);

  const rematerializePayload = {
    apply: false,
    summary: { dealCount: 1 },
    deals: [{ dealId: 'd2', acquirer: 'A', target: 'B', ok: true, claimsToUpsert: 12, matched: 9 }],
  };
  const rematView = buildMaterializeView(rematerializePayload);
  assert.equal(rematView.apply, false);
  assert.equal(rematView.deals[0].entryCount, 12); // claimsToUpsert wins over matched
  assert.equal(rematView.deals[0].acquirer, 'A');
});

test('buildMaterializeView defaults ok:true when unspecified, false only when explicitly false', () => {
  const view = buildMaterializeView({ deals: [{ dealId: 'a' }, { dealId: 'b', ok: false }] });
  assert.equal(view.deals[0].ok, true);
  assert.equal(view.deals[1].ok, false);
});

test('buildDemoDryrunSteps returns null when there is no steps[] (kind not yet producing this shape)', () => {
  assert.equal(buildDemoDryrunSteps({}), null);
  assert.equal(buildDemoDryrunSteps(null), null);
});

test('buildDemoDryrunSteps normalizes step name/ok/duration/detail', () => {
  const steps = buildDemoDryrunSteps({
    steps: [
      { name: 'ingest', ok: true, durationMs: 1200 },
      { step: 'qa-gate', ok: false, message: 'gate failed' },
    ],
  });
  assert.equal(steps.length, 2);
  assert.equal(steps[0].name, 'ingest');
  assert.equal(steps[0].durationMs, 1200);
  assert.equal(steps[1].name, 'qa-gate');
  assert.equal(steps[1].ok, false);
  assert.equal(steps[1].detail, 'gate failed');
});

test('summaryStatus resolves the right badge tone per producer summary shape', () => {
  assert.deepEqual(summaryStatus({ pass: true }), { label: 'PASS', tone: 'good' });
  assert.deepEqual(summaryStatus({ pass: false }), { label: 'FAIL', tone: 'bad' });
  assert.deepEqual(summaryStatus({ flaggedExclusions: 0 }), { label: 'CLEAN', tone: 'good' });
  assert.deepEqual(summaryStatus({ flaggedExclusions: 2 }), { label: 'FLAGGED', tone: 'bad' });
  assert.deepEqual(summaryStatus({ dealErrors: 0 }), { label: 'OK', tone: 'good' });
  assert.deepEqual(summaryStatus({ dealErrors: 1 }), { label: 'ERRORS', tone: 'bad' });
  assert.deepEqual(summaryStatus({ minted: 3 }), { label: 'DONE', tone: 'neutral' });
  assert.deepEqual(summaryStatus(null), { label: 'UNKNOWN', tone: 'neutral' });
});

test('every REPORT_KINDS entry is a valid run_reports kind', () => {
  for (const { kind } of REPORT_KINDS) {
    assert.ok(VALID_KINDS.has(kind), `${kind} must be in VALID_KINDS`);
  }
  assert.equal(REPORT_KINDS.length, VALID_KINDS.size);
});

test('pages/admin/reports/[kind].js always renders a raw-JSON <details> fallback', () => {
  const src = fs.readFileSync('pages/admin/reports/[kind].js', 'utf8');
  assert.match(src, /<details className="rk-raw">/);
  assert.match(src, /<RawJsonFallback payload={report\.payload} \/>/);
});
