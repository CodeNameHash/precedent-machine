-- product_private.product_phase2_fail_section still raised the stale
-- attempt as SQLSTATE 40001 (see 20260914123000): P0001 like the others.
CREATE OR REPLACE FUNCTION product_private.product_phase2_fail_section(p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_error jsonb, p_model_calls jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE work public.product_section_work; run_row public.product_analysis_runs; item jsonb;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_attempt_token IS NULL
    OR coalesce(pg_catalog.jsonb_typeof(p_error), '') <> 'object'
    OR coalesce(pg_catalog.jsonb_typeof(p_model_calls), '') <> 'array' THEN
    RAISE EXCEPTION 'invalid section failure input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO work FROM public.product_section_work
    WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status = 'FAILED' AND work.worker_id IS NOT DISTINCT FROM p_worker_id
    AND work.attempt_token IS NOT DISTINCT FROM p_attempt_token THEN
    RETURN public.product_phase1_fail_section(p_run_id, p_node_id, p_worker_id, p_attempt_token, p_error);
  END IF;
  IF work.status IS DISTINCT FROM 'RUNNING' OR work.worker_id IS DISTINCT FROM p_worker_id
    OR work.attempt_token IS DISTINCT FROM p_attempt_token
    OR work.lease_expires_at IS NULL OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001';
  END IF;
  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_model_calls) LOOP
    PERFORM product_private.product_phase2_admit_model_call(
      p_run_id, p_node_id, p_worker_id, p_attempt_token, item, true
    );
  END LOOP;
  RETURN public.product_phase1_fail_section(p_run_id, p_node_id, p_worker_id, p_attempt_token, p_error);
END;
$function$;
