/* ─────────────────────────────────────────────────────────────────────────
   lib/reports/render-helpers.js — pure, DB-free data-shaping for the
   /admin/reports UI (pages/admin/reports/index.js + [kind].js).

   Kept OUT of the page files (which are JSX and can't be `require()`d by
   the plain `node --test` runner this repo uses — no JSX/TS transform in
   the test pipeline) so these are fixture-testable in
   tests/admin/reports-kind-renderers.spec.js. The page components import
   and call these, then wire the output into JSX.
   ───────────────────────────────────────────────────────────────────────── */

// Kept in sync with the run_reports.kind CHECK constraint
// (supabase/schema-06-run-reports.sql) and VALID_KINDS in
// lib/reports/persist-report.js — every known producer gets a card on the
// index page, even before its first run.
const REPORT_KINDS = [
  { kind: 'ingest-qa', label: 'Ingest QA', description: 'Post-ingest gate scorecards, per deal.' },
  { kind: 'coverage-audit', label: 'Coverage audit', description: 'LLM review of excluded/gap regions.' },
  { kind: 'rematerialize-claims', label: 'Rematerialize claims', description: 'Claims-only rematerialize runs.' },
  { kind: 'mint-cards', label: 'Mint cards', description: 'Ben-gated card minting for card-less provisions.' },
  { kind: 'span-residual', label: 'Span residual', description: 'Schema-loss / span-accounting audits.' },
  { kind: 'demo-dryrun', label: 'Demo dry-run', description: 'End-to-end demo smoke test (WP-7).' },
];

// A run's summary carries its own pass/fail signal under different keys
// depending on producer (ingest-qa/coverage-audit/rematerialize-claims use
// `pass`; mint-cards has no pass/fail concept — it's a mint count). Resolve
// a badge tone without assuming every kind agrees on a shape.
function summaryStatus(summary) {
  if (!summary || typeof summary !== 'object') return { label: 'UNKNOWN', tone: 'neutral' };
  if (typeof summary.pass === 'boolean') return summary.pass ? { label: 'PASS', tone: 'good' } : { label: 'FAIL', tone: 'bad' };
  if (typeof summary.flaggedExclusions === 'number') {
    return summary.flaggedExclusions === 0 ? { label: 'CLEAN', tone: 'good' } : { label: 'FLAGGED', tone: 'bad' };
  }
  if (typeof summary.dealErrors === 'number') {
    return summary.dealErrors === 0 ? { label: 'OK', tone: 'good' } : { label: 'ERRORS', tone: 'bad' };
  }
  return { label: 'DONE', tone: 'neutral' };
}

// ── per-kind payload -> render-ready shape ──────────────────────────────
// Every producer whose payload doesn't match a builder's expectations
// degrades gracefully (empty arrays / nulls) — the [kind] page always falls
// back to a raw-JSON <details>, so a malformed/unrecognized payload never
// renders a blank page.

function buildIngestQaRows(payload) {
  const deals = Array.isArray(payload && payload.deals) ? payload.deals : [];
  return deals.map((d) => ({
    dealId: d.dealId || null,
    label: d.label || d.dealId || '(unknown deal)',
    pass: !!d.pass,
    staging: !!d.staging,
    error: d.error || null,
    gateChecks: Array.isArray(d.checks) ? d.checks.filter((c) => c.group === 'gate') : [],
    metaChecks: Array.isArray(d.checks) ? d.checks.filter((c) => c.group === 'metadata') : [],
  }));
}

function buildCoverageAuditView(payload) {
  const flaggedExclusions = Array.isArray(payload && payload.flaggedExclusions) ? payload.flaggedExclusions : [];
  const missedContent = Array.isArray(payload && payload.missedContent) ? payload.missedContent : [];
  return { flaggedExclusions, missedContent };
}

// Shared by mint-cards and rematerialize-claims: both write
// {generatedAt, apply, summary, deals: [...]}. Per-deal entry counts differ
// in shape (mint-cards: entries[]; rematerialize-claims: matched/claimsToUpsert)
// so this normalizes to one row per deal with a best-effort entry count.
function buildMaterializeView(payload) {
  const deals = Array.isArray(payload && payload.deals) ? payload.deals : [];
  const rows = deals.map((d) => {
    const entryCount = Array.isArray(d.entries)
      ? d.entries.length
      : (typeof d.claimsToUpsert === 'number' ? d.claimsToUpsert : (typeof d.matched === 'number' ? d.matched : null));
    return {
      dealId: d.dealId || null,
      ok: d.ok !== false,
      entryCount,
      target: d.target || null,
      acquirer: d.acquirer || null,
    };
  });
  return {
    apply: !!(payload && payload.apply),
    summary: (payload && payload.summary) || null,
    deals: rows,
  };
}

function buildDemoDryrunSteps(payload) {
  const steps = Array.isArray(payload && payload.steps) ? payload.steps : null;
  if (!steps) return null;
  return steps.map((s) => ({
    name: s.name || s.step || '(unnamed step)',
    ok: s.ok !== false,
    durationMs: typeof s.durationMs === 'number' ? s.durationMs : null,
    detail: s.detail || s.message || null,
  }));
}

module.exports = {
  REPORT_KINDS,
  summaryStatus,
  buildIngestQaRows,
  buildCoverageAuditView,
  buildMaterializeView,
  buildDemoDryrunSteps,
};
