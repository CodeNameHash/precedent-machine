-- Every failed attempt of a section stays on the row. Metsera generation 6:
-- 3.02 (Capitalization) was on its third and last attempt before anyone
-- could say why the first two had failed, because the claim of the next
-- attempt clears `error` and the hosted worker's stdout is not kept. The
-- history is appended by product_phase1_fail_section and never cleared.
ALTER TABLE public.product_section_work
  ADD COLUMN IF NOT EXISTS error_history jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.product_phase1_fail_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_error jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
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
$$;
