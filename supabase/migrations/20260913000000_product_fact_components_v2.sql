-- FACT_COMPONENTS/V2 storage (Phase 5B.3, storage half). Contract:
-- contracts/product/fact-components.v2.json. Adds two tables holding a
-- fact's component tree and headline as rows alongside its proposal, and
-- extends the existing product_phase2_commit_section RPC additively so the
-- rows are written in the same atomic section commit, following the
-- rename-and-wrap pattern in 20260905201000_product_residual_pass_persistence.sql.

CREATE TABLE IF NOT EXISTS public.product_fact_components (
  run_id uuid NOT NULL,
  proposal_id text NOT NULL,
  component_id text NOT NULL,
  parent_component_id text,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  kind text NOT NULL CHECK (kind IN (
    'TERM', 'ACTOR', 'OBJECT', 'OPERATION', 'TRIGGER', 'CONDITION', 'EXCEPTION', 'QUALIFIER',
    'STANDARD', 'EFFORTS_STANDARD', 'MATERIALITY_QUALIFIER', 'THRESHOLD', 'PERIOD', 'PERCENTAGE',
    'DATE', 'AMOUNT', 'FORUM', 'LIST', 'LIST_ELEMENT', 'LITANY', 'CROSS_REFERENCE', 'DEFINED_TERM'
  )),
  label text NOT NULL,
  text text NOT NULL,
  source_span_id text NOT NULL,
  start_byte bigint NOT NULL CHECK (start_byte >= 0),
  end_byte bigint NOT NULL CHECK (end_byte > start_byte),
  origin text NOT NULL CHECK (origin IN ('OWN', 'CHAPEAU', 'INTRO', 'DEFINITION', 'CROSS_REFERENCED')),
  origin_structure_node_id text,
  gap_before boolean NOT NULL DEFAULT false,
  value jsonb,
  members jsonb,
  resolves_to jsonb,
  PRIMARY KEY (run_id, proposal_id, component_id),
  FOREIGN KEY (run_id, proposal_id) REFERENCES public.product_proposals(run_id, proposal_id)
);

CREATE TABLE IF NOT EXISTS public.product_fact_headlines (
  run_id uuid NOT NULL,
  proposal_id text NOT NULL,
  label text NOT NULL,
  distinguishing_component_ids jsonb NOT NULL,
  coverage_only boolean NOT NULL DEFAULT false,
  PRIMARY KEY (run_id, proposal_id),
  FOREIGN KEY (run_id, proposal_id) REFERENCES public.product_proposals(run_id, proposal_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_fact_components_immutable') THEN
    CREATE TRIGGER product_fact_components_immutable BEFORE UPDATE OR DELETE ON public.product_fact_components
    FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_fact_headlines_immutable') THEN
    CREATE TRIGGER product_fact_headlines_immutable BEFORE UPDATE OR DELETE ON public.product_fact_headlines
    FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
  END IF;
END;
$$;

ALTER TABLE public.product_fact_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_fact_headlines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_fact_components FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.product_fact_headlines FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_fact_components TO service_role;
GRANT SELECT ON public.product_fact_headlines TO service_role;

-- Extend product_phase2_commit_section additively: delegate to the prior
-- version for everything it already does, then write any fact component and
-- headline rows the caller attached to p_result. Both new arrays are
-- optional so a V1 section commit (no components) is unaffected. Rows are
-- content-addressed (component_id, and the proposal/run pair for the
-- headline), so ON CONFLICT DO NOTHING keeps a retried commit idempotent
-- even though the delegated legacy call short-circuits before re-running.
DO $$
BEGIN
  IF to_regprocedure('product_private.product_phase2_commit_section_pre_fact_components(uuid,text,text,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
      RENAME TO product_phase2_commit_section_pre_fact_components;
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
  result := product_private.product_phase2_commit_section_pre_fact_components(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result
  );

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_result->'fact_component_rows', '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND p.proposal_id = item->>'proposal_id') THEN
      RAISE EXCEPTION 'fact component proposal not found' USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.product_fact_components(run_id, proposal_id, component_id, parent_component_id, ordinal, kind,
      label, text, source_span_id, start_byte, end_byte, origin, origin_structure_node_id, gap_before, value, members, resolves_to)
    VALUES (p_run_id, item->>'proposal_id', item->>'component_id', item->>'parent_component_id',
      (item->>'ordinal')::integer, item->>'kind', item->>'label', item->>'text', item->>'source_span_id',
      (item->>'start_byte')::bigint, (item->>'end_byte')::bigint, item->>'origin', item->>'origin_structure_node_id',
      (item->>'gap_before')::boolean, item->'value', item->'members', item->'resolves_to')
    ON CONFLICT (run_id, proposal_id, component_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_result->'fact_headline_rows', '[]'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND p.proposal_id = item->>'proposal_id') THEN
      RAISE EXCEPTION 'fact headline proposal not found' USING ERRCODE = '23503';
    END IF;
    INSERT INTO public.product_fact_headlines(run_id, proposal_id, label, distinguishing_component_ids, coverage_only)
    VALUES (p_run_id, item->>'proposal_id', item->>'label', item->'distinguishing_component_ids',
      coalesce((item->>'coverage_only')::boolean, false))
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
