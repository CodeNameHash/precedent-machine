-- The lawyer preview read model (work package 38, plan finding (251)).
--
-- The preview page read rebuilt the same projection on every request from
-- a finished run's stored analysis: about 16 s on a 97-section run, nearly
-- all of it the database scanning section results, closures, routings,
-- proposals, components, headlines, conclusions and full-section spans
-- (finding (244): 31 sections take 8 s, a light query 0.7 s). The page's
-- payload is 3.9 MB after work package 32's projection, and it does not
-- change once the run is READY or FAILED unless a lawyer saves a review,
-- which sets stale = true here and makes the next read rebuild once.
--
-- The delivery rule is lib/product/preview-read-model.js; the handler
-- (lib/product/preview-handler.js) writes this row and serves it. A run
-- still analysing reads live and stores nothing.
--
-- Security: the row holds exactly the payload the preview route already
-- returns to an authenticated reviewer after its own access check, so the
-- table is service-role only (RLS on, no policy for anon or authenticated;
-- no grant to either). The store methods are
-- lib/product/phase-2-store.js getPreviewReadModel, savePreviewReadModel
-- and markPreviewReadModelStale.

CREATE TABLE public.product_preview_reads (
  run_id uuid PRIMARY KEY REFERENCES public.product_analysis_runs(run_id) ON DELETE CASCADE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  built_at timestamptz NOT NULL DEFAULT now(),
  stale boolean NOT NULL DEFAULT false
);

ALTER TABLE public.product_preview_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.product_preview_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_preview_reads TO service_role;

COMMENT ON TABLE public.product_preview_reads IS
  'The lawyer preview read model (plan finding (251)): the projected preview payload of a finished run, rebuilt once and marked stale by every review save.';
