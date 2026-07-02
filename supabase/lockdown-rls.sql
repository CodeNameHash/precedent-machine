-- Precedent Machine — RLS lockdown. APPLIED to production 2026-07-02.
-- ════════════════════════════════════════════════════════════════════════
-- Kept for reference / disaster recovery. The browser never talks to
-- Supabase directly (all reads AND writes go through /api/* with the
-- service role, which bypasses RLS) — so dropping every permissive policy
-- closes the public direct-to-database path without touching the app.
--
-- Drop every allow_all policy that actually exists (DROP POLICY IF EXISTS
-- still errors on MISSING TABLES, so iterate pg_policies instead of
-- hardcoding table names):
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies
           WHERE schemaname = 'public' AND policyname = 'allow_all'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- corrections was created with RLS DISABLED entirely (worse than a
-- permissive policy — dropped policies wouldn't have protected it):
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- Verification (both must return zero rows):
--   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
--
-- Verified post-apply 2026-07-02: anon READ → [], anon WRITE → 401,
-- anon DELETE → 0-row no-op; app API + service role unaffected (791 rows).
