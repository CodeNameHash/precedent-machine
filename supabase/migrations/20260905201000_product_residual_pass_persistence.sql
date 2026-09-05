CREATE TABLE IF NOT EXISTS public.product_residual_passes (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  residual_pass_id text NOT NULL,
  structure_node_id text NOT NULL,
  model_call_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, residual_pass_id),
  UNIQUE (run_id, structure_node_id),
  FOREIGN KEY (run_id, model_call_id) REFERENCES public.product_model_calls(run_id, model_call_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_residual_passes_immutable') THEN
    CREATE TRIGGER product_residual_passes_immutable BEFORE UPDATE OR DELETE ON public.product_residual_passes
    FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
  END IF;
END;
$$;

ALTER TABLE public.product_residual_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_residual_passes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_residual_passes TO service_role;

DO $$
BEGIN
  IF to_regprocedure('product_private.product_phase2_commit_section_legacy(uuid,text,text,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
      RENAME TO product_phase2_commit_section_legacy;
  END IF;
  IF to_regprocedure('product_private.product_phase2_finalize_draft_legacy(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION product_private.product_phase2_finalize_draft(uuid,jsonb)
      RENAME TO product_phase2_finalize_draft_legacy;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result jsonb;
  residual jsonb;
BEGIN
  residual := p_result->'residual_pass';
  IF coalesce(residual->>'schema_version', '') <> 'PRODUCT_PARAGRAPH_RESIDUAL_PASS/V1'
    OR coalesce(residual->>'structure_node_id', '') <> p_node_id
    OR coalesce(residual->>'residual_pass_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(residual->>'model_call_id', '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid section draft input' USING ERRCODE = '22023';
  END IF;

  result := product_private.product_phase2_commit_section_legacy(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result
  );

  INSERT INTO public.product_residual_passes(
    run_id, residual_pass_id, structure_node_id, model_call_id, payload
  ) VALUES (
    p_run_id, residual->>'residual_pass_id', p_node_id, residual->>'model_call_id', residual
  ) ON CONFLICT (run_id, residual_pass_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_residual_passes stored
    WHERE stored.run_id = p_run_id
      AND stored.residual_pass_id = residual->>'residual_pass_id'
      AND stored.structure_node_id = p_node_id
      AND stored.model_call_id = residual->>'model_call_id'
      AND stored.payload = residual
  ) THEN
    RAISE EXCEPTION 'residual pass collision' USING ERRCODE = '23505';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_finalize_draft(
  p_run_id uuid, p_draft jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_draft->'residual_passes') <> 'array'
    OR (SELECT count(*) FROM public.product_residual_passes WHERE run_id = p_run_id)
      <> jsonb_array_length(p_draft->'residual_passes')
    OR EXISTS (
      SELECT 1 FROM public.product_residual_passes stored
      WHERE stored.run_id = p_run_id AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_draft->'residual_passes') item
        WHERE item->>'residual_pass_id' = stored.residual_pass_id AND item = stored.payload
      )
    ) THEN
    RAISE EXCEPTION 'AgreementDraft section set mismatch' USING ERRCODE = '22023';
  END IF;
  RETURN product_private.product_phase2_finalize_draft_legacy(p_run_id, p_draft);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_commit_section(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result
  )
$$;

CREATE OR REPLACE FUNCTION public.product_phase2_finalize_draft(
  p_run_id uuid, p_draft jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_finalize_draft(p_run_id, p_draft)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_finalize_draft(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_finalize_draft(uuid,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_finalize_draft(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_finalize_draft(uuid,jsonb)
  TO service_role;
