CREATE OR REPLACE FUNCTION product_private.product_phase3_retry_run(
  p_run_id uuid, p_actor text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  changed integer;
  run_row public.product_analysis_runs;
  resume_finalization boolean := false;
BEGIN
  IF coalesce(p_idempotency_key, '') = '' OR NOT EXISTS (
    SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor
  ) THEN RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_run_retry_events WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key) THEN
    SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
    RETURN to_jsonb(run_row);
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_run_retry_events WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key) THEN
    RETURN to_jsonb(run_row);
  END IF;
  UPDATE public.product_section_work SET status = 'PENDING', attempts = 0, worker_id = NULL,
    attempt_token = NULL, lease_expires_at = NULL, error = NULL
    WHERE run_id = p_run_id AND status = 'FAILED';
  GET DIAGNOSTICS changed = ROW_COUNT;
  resume_finalization := changed = 0
    AND run_row.status = 'FAILED'
    AND run_row.stage = 'DRAFT_FINALIZATION'
    AND EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id)
    AND NOT EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE');
  INSERT INTO public.product_run_retry_events(run_id, idempotency_key, actor, retried_sections)
  VALUES (p_run_id, p_idempotency_key, p_actor, changed);
  UPDATE public.product_analysis_runs SET
    status = CASE WHEN changed > 0 OR resume_finalization THEN 'RUNNING' ELSE status END,
    stage = CASE WHEN changed > 0 THEN 'SECTION_ANALYSIS' WHEN resume_finalization THEN 'DRAFT_FINALIZATION' ELSE stage END,
    error = CASE WHEN changed > 0 OR resume_finalization THEN NULL ELSE error END,
    updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN to_jsonb(run_row);
END;
$$;
