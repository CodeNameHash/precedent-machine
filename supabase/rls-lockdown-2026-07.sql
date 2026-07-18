-- RLS lockdown for tables created after the 2026-07-02 lockdown.
-- Verified 2026-07-18: no client-side (anon) reads of these tables exist —
-- every access path goes through server-side API routes using the service
-- role, which bypasses RLS. Enabling RLS with NO policies therefore blocks
-- the world-readable anon access without affecting the app.
ALTER TABLE public.provision_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_mechanisms  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proration_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections          ENABLE ROW LEVEL SECURITY;
-- Belt & braces: revoke direct grants from anon/authenticated as well.
REVOKE ALL ON public.provision_cards, public.claims, public.election_mechanisms,
           public.election_options, public.proration_rules, public.corrections
  FROM anon, authenticated;
