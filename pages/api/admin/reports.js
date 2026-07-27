/* ─────────────────────────────────────────────────────────────────────────
   pages/api/admin/reports.js — read API for `run_reports` (WP-6 / M5-05).

   Gated exactly like the other pages/api/admin/* routes (e.g.
   pages/api/admin/ingest-runs.js): a server-side service-role Supabase
   client (bypasses RLS — this route IS the gate, there is no separate
   session/role check in this codebase's admin routes), GET-only, and the
   same "table not available yet" soft-fail shape so the UI never 500s while
   Ben hasn't run supabase/schema-06-run-reports.sql.

   Query modes:
     GET /api/admin/reports              -> { latest: {kind: row}, history: [row...] } (no payload; list-weight only)
     GET /api/admin/reports?kind=<kind>  -> { kind, reports: [row...] } (no payload)
     GET /api/admin/reports?id=<uuid>    -> { report: row } (full row incl. payload)
   ───────────────────────────────────────────────────────────────────────── */

import { getServiceSupabase } from '../../../lib/supabase.js';
import { VALID_KINDS } from '../../../lib/reports/persist-report.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LIST_SELECT = 'id, kind, generated_at, git_ref, summary, created_at';
const HISTORY_LIMIT = 200;
const KIND_HISTORY_LIMIT = 100;

function fail(res, status, error, detail) {
  return res.status(status).json({ error, ...(detail ? { detail } : {}) });
}

function tableUnavailable(error) {
  if (!error) return null;
  const message = error.message || '';
  if (error.code === '42P01' || message.includes('does not exist') || message.includes('Could not find the table')) {
    return {
      code: 'RUN_REPORTS_UNAVAILABLE',
      message: 'run_reports table is not available in this database yet.',
      detail: message,
    };
  }
  return null;
}

async function getById(req, res, sb) {
  const id = String(req.query.id);
  if (!UUID_RE.test(id)) return fail(res, 400, 'Invalid id');

  const { data, error } = await sb.from('run_reports').select('*').eq('id', id).single();
  const unavailable = tableUnavailable(error);
  if (unavailable) return res.status(200).json({ report: null, unavailable });
  if (error) return fail(res, error.code === 'PGRST116' ? 404 : 500, error.message);

  return res.status(200).json({ report: data });
}

async function getByKind(req, res, sb) {
  const kind = String(req.query.kind);
  if (!VALID_KINDS.has(kind)) return fail(res, 400, `Unknown kind "${kind}"`);

  const { data, error } = await sb
    .from('run_reports')
    .select(LIST_SELECT)
    .eq('kind', kind)
    .order('generated_at', { ascending: false })
    .limit(KIND_HISTORY_LIMIT);
  const unavailable = tableUnavailable(error);
  if (unavailable) return res.status(200).json({ kind, reports: [], unavailable });
  if (error) return fail(res, 500, error.message);

  return res.status(200).json({ kind, reports: data || [] });
}

async function listAll(req, res, sb) {
  const { data, error } = await sb
    .from('run_reports')
    .select(LIST_SELECT)
    .order('generated_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  const unavailable = tableUnavailable(error);
  if (unavailable) return res.status(200).json({ latest: {}, history: [], unavailable });
  if (error) return fail(res, 500, error.message);

  const history = data || [];
  const latest = {};
  for (const row of history) {
    if (!latest[row.kind]) latest[row.kind] = row;
  }
  return res.status(200).json({ latest, history });
}

export function createReportsHandler({ getSupabase = getServiceSupabase } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return fail(res, 405, 'GET only');
    }

    if (req.query.id && !UUID_RE.test(String(req.query.id))) {
      return fail(res, 400, 'Invalid id');
    }
    if (req.query.kind && !VALID_KINDS.has(String(req.query.kind))) {
      return fail(res, 400, `Unknown kind "${String(req.query.kind)}"`);
    }

    const sb = getSupabase();
    if (!sb) return fail(res, 500, 'Supabase not configured');

    if (req.query.id) return getById(req, res, sb);
    if (req.query.kind) return getByKind(req, res, sb);
    return listAll(req, res, sb);
  };
}

export default createReportsHandler();
