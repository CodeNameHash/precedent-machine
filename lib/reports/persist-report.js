/* ─────────────────────────────────────────────────────────────────────────
   lib/reports/persist-report.js — shared writer for `run_reports`
   (supabase/schema-06-run-reports.sql, WP-6 / M5-05).

   Every producer (scripts/ingest-qa.js, scripts/coverage-audit.js,
   scripts/curation/mint-cards.js, scripts/reprocess/rematerialize-claims.js,
   and later scripts/demo-dryrun.js) already writes a JSON report file under
   the gitignored reports/ dir. This module adds a second, durable sink: one
   row per run in `run_reports`, so /admin/reports can render history
   without needing repo/Vercel access to the local file.

   FAIL SOFT: the migration (supabase/schema-06-run-reports.sql) is Ben-run,
   by hand, and may not exist yet in a given environment. Any error that
   looks like "table not found" must NOT crash the calling producer — log a
   warning and return { written: false }. Any other DB error also fails
   soft (a broken report write must never fail a producer whose real job is
   ingestion/QA/materialization), but is surfaced distinctly for debugging.
   ───────────────────────────────────────────────────────────────────────── */

const { execSync } = require('child_process');

const VALID_KINDS = new Set([
  'ingest-qa',
  'coverage-audit',
  'rematerialize-claims',
  'mint-cards',
  'span-residual',
  'demo-dryrun',
  'v1-reclass-apply',
]);

const TABLE = 'run_reports';

// ~1MB payload cap (Postgres jsonb / API-response friendliness). Truncation
// only ever touches `payload.deals` — `summary` is defined by callers to
// already be small (top-level counts / pass-fail) and is never truncated.
const PAYLOAD_CAP_BYTES = 1_000_000;

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

// Shrink payload.deals (if present) until the serialized payload fits the
// cap, marking `truncated: true` so the UI can say "N of M deals shown".
// Non-destructive: returns a new object, never mutates the input.
function capPayload(payload, capBytes = PAYLOAD_CAP_BYTES) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (byteLength(payload) <= capBytes) return payload;
  if (!Array.isArray(payload.deals) || payload.deals.length === 0) {
    // Nothing obviously truncatable — return as-is; the DB write may still
    // fail on size, which persistReport treats as a soft failure.
    return payload;
  }

  let deals = payload.deals;
  let candidate = { ...payload, deals, truncated: true, truncatedDealCount: payload.deals.length };
  // Halve until it fits, then do a final linear trim for a tighter cap.
  while (deals.length > 1 && byteLength(candidate) > capBytes) {
    deals = deals.slice(0, Math.ceil(deals.length / 2));
    candidate = { ...payload, deals, truncated: true, truncatedDealCount: payload.deals.length };
  }
  while (deals.length > 0 && byteLength(candidate) > capBytes) {
    deals = deals.slice(0, deals.length - 1);
    candidate = { ...payload, deals, truncated: true, truncatedDealCount: payload.deals.length };
  }
  return candidate;
}

// Best-effort git ref for provenance. Vercel-style env vars first (no
// subprocess in serverless), then a local `git rev-parse HEAD` for CLI runs.
// Never throws — provenance is nice-to-have, not load-bearing.
function resolveGitRef() {
  const envRef = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (envRef) return envRef;
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim() || null;
  } catch {
    return null;
  }
}

// Recognize a missing-table error the same way pages/api/admin/ingest-runs.js
// does for ingest_runs/ingest_jobs: Postgres 42P01, or the two message
// substrings Supabase/PostgREST use for "relation does not exist".
function tableUnavailable(error) {
  if (!error) return false;
  const message = error.message || '';
  return error.code === '42P01' || message.includes('does not exist') || message.includes('Could not find the table');
}

// Default: ON whenever a service-role Supabase client is available (all
// four current producers already require SUPABASE_SERVICE_ROLE_KEY to run
// at all). `--report-db` / `--no-report-db` on the CLI override explicitly.
function resolveReportDbFlag(args, { hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY } = {}) {
  if (args && args.reportDb === false) return false;
  if (args && args.reportDb === true) return true;
  return hasServiceRoleKey;
}

/**
 * Persist one producer run to `run_reports`. Fails soft: never throws.
 *
 * @param {object} sb - a Supabase client with service-role access (bypasses
 *   RLS, matching every other write path in this repo).
 * @param {object} report
 * @param {string} report.kind - one of VALID_KINDS.
 * @param {string} [report.generatedAt] - ISO timestamp; defaults to now.
 * @param {string} [report.gitRef] - explicit git ref; defaults to resolveGitRef().
 * @param {object} report.summary - small top-level counts / pass-fail.
 * @param {object} report.payload - full report; capped to ~1MB (deals[] truncated).
 * @returns {Promise<{written: boolean, id?: string, reason?: string, error?: string}>}
 */
async function persistReport(sb, report) {
  const { kind, generatedAt, gitRef, summary, payload } = report || {};

  if (!sb) {
    console.warn(`[persist-report] no Supabase client provided — skipping run_reports write for kind=${kind}`);
    return { written: false, reason: 'no-client' };
  }
  if (!VALID_KINDS.has(kind)) {
    console.warn(`[persist-report] unknown report kind "${kind}" — skipping run_reports write`);
    return { written: false, reason: 'invalid-kind' };
  }

  const row = {
    kind,
    generated_at: generatedAt || new Date().toISOString(),
    git_ref: gitRef !== undefined ? gitRef : resolveGitRef(),
    summary: summary && typeof summary === 'object' ? summary : {},
    payload: capPayload(payload && typeof payload === 'object' ? payload : {}),
  };

  try {
    const { data, error } = await sb.from(TABLE).insert(row).select('id').single();
    if (error) {
      if (tableUnavailable(error)) {
        console.warn(
          `[persist-report] run_reports table not found — skipping DB write for kind=${kind}. `
          + 'Run supabase/schema-06-run-reports.sql to enable persistence.',
        );
        return { written: false, reason: 'table-unavailable' };
      }
      console.warn(`[persist-report] run_reports insert failed for kind=${kind}: ${error.message}`);
      return { written: false, reason: 'db-error', error: error.message };
    }
    return { written: true, id: data && data.id };
  } catch (err) {
    console.warn(`[persist-report] run_reports insert threw for kind=${kind}: ${err.message}`);
    return { written: false, reason: 'exception', error: err.message };
  }
}

module.exports = {
  VALID_KINDS,
  PAYLOAD_CAP_BYTES,
  byteLength,
  capPayload,
  resolveGitRef,
  tableUnavailable,
  resolveReportDbFlag,
  persistReport,
};
