-- WP-6 (M5-05) — run_reports persistence.
--
-- Ben decision (B-schema, docs/handoffs/M4-M5-RECONCILED-PLAN-2026-07-18.md
-- §7): one new table for producer run reports. `reports/` on disk is
-- gitignored deliberately (commits c5935cf, ba600ea) so it is invisible to
-- Vercel — this table is the durable, admin-visible substitute. Ben runs
-- this by hand; nothing in the app executes DDL.
--
-- Producers: scripts/ingest-qa.js, scripts/coverage-audit.js,
-- scripts/curation/mint-cards.js, scripts/reprocess/rematerialize-claims.js,
-- (future) a span-residual audit script, scripts/demo-dryrun.js (WP-7).
-- Written by the shared lib/reports/persist-report.js writer.

CREATE TABLE IF NOT EXISTS public.run_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN (
                  'ingest-qa',
                  'coverage-audit',
                  'rematerialize-claims',
                  'mint-cards',
                  'span-residual',
                  'demo-dryrun'
                )),
  generated_at  timestamptz NOT NULL,
  git_ref       text,
  summary       jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS run_reports_kind_generated_at_idx
  ON public.run_reports (kind, generated_at DESC);

-- RLS lockdown — same posture as supabase/rls-lockdown-2026-07.sql: every
-- access path to this table goes through server-side API routes / scripts
-- using the service role, which bypasses RLS. Enabling RLS with NO policies
-- blocks anon/authenticated access without affecting the app.
ALTER TABLE public.run_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.run_reports FROM anon, authenticated;
