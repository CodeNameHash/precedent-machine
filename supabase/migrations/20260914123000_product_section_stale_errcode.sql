-- "stale section attempt" was raised with SQLSTATE 40001 (serialization
-- failure), which PostgREST treats as retryable: a stale renewal from the
-- sandbox hung for over a minute instead of failing at once (Metsera
-- generation 6, 2026-09-14, probed from the sandbox: a renewal of a
-- nonexistent attempt never returned within 60 s while the same function
-- raising 22023 returned in 0.3 s). The three lease functions raise the
-- default P0001 with the same message; the runner recognises the message.
CREATE OR REPLACE FUNCTION public.product_phase1_renew_section_lease(p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_lease_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE work public.product_section_work;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid section lease renewal input' USING ERRCODE = '22023';
  END IF;
  UPDATE public.product_section_work
  SET lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  WHERE run_id = p_run_id AND node_id = p_node_id AND status = 'RUNNING'
    AND worker_id = p_worker_id AND attempt_token = p_attempt_token AND lease_expires_at > now()
  RETURNING * INTO work;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001'; END IF;
  RETURN to_jsonb(work);
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_phase1_complete_section(p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_cost_microusd bigint, p_input_tokens bigint, p_output_tokens bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE work public.product_section_work; run_row public.product_analysis_runs; exhausted boolean; exhausted_error jsonb; all_complete boolean;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_cost_microusd < 0 OR p_input_tokens < 0 OR p_output_tokens < 0 THEN
    RAISE EXCEPTION 'invalid section completion input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO work FROM public.product_section_work
    WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status = 'COMPLETE' AND work.worker_id = p_worker_id AND work.attempt_token = p_attempt_token THEN
    RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
  END IF;
  IF work.status <> 'RUNNING' OR work.worker_id <> p_worker_id OR work.attempt_token <> p_attempt_token
    OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.product_section_work SET status = 'COMPLETE', lease_expires_at = NULL,
    cost_microusd = cost_microusd + p_cost_microusd, input_tokens = input_tokens + p_input_tokens,
    output_tokens = output_tokens + p_output_tokens, completed_at = now()
    WHERE run_id = p_run_id AND node_id = p_node_id RETURNING * INTO work;
  SELECT NOT EXISTS (
    SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE'
  ) INTO all_complete;
  SELECT EXISTS (SELECT 1 FROM public.product_section_work
      WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts),
    (SELECT error FROM public.product_section_work
      WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts
      ORDER BY authored_order LIMIT 1)
    INTO exhausted, exhausted_error;
  UPDATE public.product_analysis_runs SET
    status = CASE
      WHEN exhausted THEN 'FAILED'
      WHEN all_complete THEN 'READY'
      WHEN EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status = 'FAILED') THEN 'PARTIAL'
      ELSE 'RUNNING' END,
    stage = CASE WHEN all_complete THEN 'READY' ELSE 'SECTION_ANALYSIS' END,
    error = CASE WHEN NOT exhausted THEN NULL
      ELSE coalesce(CASE WHEN run_row.status = 'FAILED' THEN run_row.error END,
        exhausted_error, jsonb_build_object('code', 'SECTION_ATTEMPTS_EXHAUSTED')) END,
    updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
END;
$function$;

CREATE OR REPLACE FUNCTION public.product_phase1_fail_section(p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_error jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE work public.product_section_work; run_row public.product_analysis_runs; exhausted boolean; exhausted_error jsonb;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_error IS NULL THEN
    RAISE EXCEPTION 'invalid section failure input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO work FROM public.product_section_work
    WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status = 'FAILED' AND work.worker_id = p_worker_id AND work.attempt_token = p_attempt_token THEN
    RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
  END IF;
  IF work.status <> 'RUNNING' OR work.worker_id <> p_worker_id OR work.attempt_token <> p_attempt_token
    OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.product_section_work SET status = 'FAILED', lease_expires_at = NULL, error = p_error,
    error_history = error_history || jsonb_build_array(jsonb_build_object(
      'attempt', work.attempts, 'worker_id', p_worker_id, 'started_at', work.started_at,
      'failed_at', now(), 'error', p_error))
    WHERE run_id = p_run_id AND node_id = p_node_id RETURNING * INTO work;
  SELECT EXISTS (SELECT 1 FROM public.product_section_work
      WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts),
    (SELECT error FROM public.product_section_work
      WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts
      ORDER BY authored_order LIMIT 1)
    INTO exhausted, exhausted_error;
  UPDATE public.product_analysis_runs SET
    status = CASE
      WHEN exhausted THEN 'FAILED'
      WHEN EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status = 'FAILED') THEN 'PARTIAL'
      ELSE 'RUNNING' END,
    stage = 'SECTION_ANALYSIS',
    error = CASE WHEN NOT exhausted THEN NULL
      ELSE coalesce(CASE WHEN run_row.status = 'FAILED' THEN run_row.error END,
        exhausted_error, jsonb_build_object('code', 'SECTION_ATTEMPTS_EXHAUSTED')) END,
    updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
END;
$function$;
