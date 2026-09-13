-- FACT_CONCLUSIONS/V1 storage (Phase 5B, conclusions layer). Contract:
-- contracts/product/fact-conclusions.v1.json. Adds one table holding a
-- fact's coded conclusions readout alongside its proposal, and extends the
-- existing product_phase2_commit_section RPC additively so the rows are
-- written in the same atomic section commit as components, following the
-- rename-and-wrap pattern in 20260913000000_product_fact_components_v2.sql.

CREATE TABLE IF NOT EXISTS public.product_fact_conclusions (
  run_id uuid NOT NULL,
  proposal_id text NOT NULL,
  table_key text NOT NULL,
  row_label text NOT NULL,
  cells jsonb NOT NULL,
  PRIMARY KEY (run_id, proposal_id),
  FOREIGN KEY (run_id, proposal_id) REFERENCES public.product_proposals(run_id, proposal_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_fact_conclusions_immutable') THEN
    CREATE TRIGGER product_fact_conclusions_immutable BEFORE UPDATE OR DELETE ON public.product_fact_conclusions
    FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
  END IF;
END;
$$;

ALTER TABLE public.product_fact_conclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_fact_conclusions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_fact_conclusions TO service_role;

-- Extend product_phase2_commit_section additively: delegate to the prior
-- version for everything it already does (including components and
-- headlines), then write any fact conclusion rows the caller attached to
-- p_result. The new array is optional so a section commit with no
-- conclusions (V1, or V2 without a table shape for its family) is
-- unaffected. Rows are content-addressed on (run_id, proposal_id), so
-- ON CONFLICT DO NOTHING keeps a retried commit idempotent even though the
-- delegated legacy call short-circuits before re-running.
DO $$
BEGIN
  IF to_regprocedure('product_private.product_phase2_commit_section_pre_fact_conclusions(uuid,text,text,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
      RENAME TO product_phase2_commit_section_pre_fact_conclusions;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
  item jsonb;
BEGIN
  result := product_private.product_phase2_commit_section_pre_fact_conclusions(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result
  );

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_result->'fact_conclusion_rows', '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND p.proposal_id = item->>'proposal_id') THEN
      RAISE EXCEPTION 'fact conclusion proposal not found' USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.product_fact_conclusions(run_id, proposal_id, table_key, row_label, cells)
    VALUES (p_run_id, item->>'proposal_id', item->>'table_key', item->>'row_label', item->'cells')
    ON CONFLICT (run_id, proposal_id) DO NOTHING;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_commit_section(p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
