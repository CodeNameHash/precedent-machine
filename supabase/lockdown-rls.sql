-- Precedent Machine — RLS lockdown
-- ════════════════════════════════════════════════════════════════════════
-- Run once in the Supabase SQL Editor.
--
-- WHY: every table currently has a permissive `allow_all` policy (USING true
-- WITH CHECK true) while the anon key ships to the browser — so anyone with
-- the site URL can read, write, or DELETE the entire database directly via
-- PostgREST, bypassing the app.
--
-- SAFE TO APPLY: audited 2026-07 — the browser never talks to Supabase
-- directly. Every read AND write goes through /api/* routes using the
-- SERVICE ROLE key (getServiceSupabase). lib/supabase.js's anon client has
-- zero non-API consumers. The service role bypasses RLS entirely, so the app
-- is unaffected; this only closes the public direct-to-database path.
--
-- ALSO: rotate the service key (Dashboard → Settings → API) — it was shared
-- in a chat session and should be treated as leaked. Update
-- SUPABASE_SERVICE_ROLE_KEY in Vercel env after rotating.
-- ════════════════════════════════════════════════════════════════════════

-- Drop the allow-all policies (leaves RLS ENABLED with no policies, which
-- denies anon/authenticated by default; service_role bypasses RLS).
DROP POLICY IF EXISTS "allow_all" ON agreement_types;
DROP POLICY IF EXISTS "allow_all" ON provision_types;
DROP POLICY IF EXISTS "allow_all" ON provision_categories;
DROP POLICY IF EXISTS "allow_all" ON agreement_sources;
DROP POLICY IF EXISTS "allow_all" ON users;
DROP POLICY IF EXISTS "allow_all" ON deals;
DROP POLICY IF EXISTS "allow_all" ON provisions;
DROP POLICY IF EXISTS "allow_all" ON annotations;
DROP POLICY IF EXISTS "allow_all" ON comments;
DROP POLICY IF EXISTS "allow_all" ON signoffs;
DROP POLICY IF EXISTS "allow_all" ON comparisons;

-- corrections table (added by corrections-schema.sql) may carry its own
-- permissive policy — drop defensively if present.
DROP POLICY IF EXISTS "allow_all" ON corrections;

-- Verification (expected: zero rows — no permissive policies remain):
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--
-- Post-apply smoke test (should now FAIL with a permissions error):
--   curl -s "https://<project>.supabase.co/rest/v1/deals?select=id" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
-- And the app itself should be unaffected (all traffic is service-role).
