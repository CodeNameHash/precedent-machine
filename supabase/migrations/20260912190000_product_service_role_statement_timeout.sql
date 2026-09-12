-- Review saves run product_phase3_save_review, which validates the complete
-- review state (about 1,700 items on a 104-section agreement) inside the
-- database. On the private preview database that takes 2 to 13 seconds, over
-- the 8 second default inherited from the authenticator role, so every
-- Accept, Reject or comment failed with a statement timeout. The product API
-- uses the service role only. Applied to the private preview database on
-- 2026-09-12 by hand; recorded here so a rebuilt database matches.
ALTER ROLE service_role SET statement_timeout = '60s';
NOTIFY pgrst, 'reload config';
