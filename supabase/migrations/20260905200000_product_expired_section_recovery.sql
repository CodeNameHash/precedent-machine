CREATE OR REPLACE FUNCTION public.product_phase1_recover_expired_sections(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recovered integer; exhausted boolean; run_row public.product_analysis_runs;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  UPDATE public.product_section_work
  SET status = 'FAILED', worker_id = NULL, attempt_token = NULL, lease_expires_at = NULL,
    error = jsonb_build_object('code', 'SECTION_LEASE_EXPIRED')
  WHERE run_id = p_run_id AND status = 'RUNNING' AND lease_expires_at <= now();
  GET DIAGNOSTICS recovered = ROW_COUNT;
  IF recovered > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.product_section_work
      WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts
    ) INTO exhausted;
    UPDATE public.product_analysis_runs
    SET status = CASE WHEN exhausted THEN 'FAILED' ELSE 'PARTIAL' END,
      stage = 'SECTION_ANALYSIS',
      error = CASE WHEN exhausted THEN jsonb_build_object('code', 'SECTION_LEASE_EXPIRED') ELSE NULL END,
      updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO run_row;
  END IF;
  RETURN jsonb_build_object('run_id', p_run_id, 'recovered_sections', recovered, 'run', to_jsonb(run_row));
END;
$$;

REVOKE ALL ON FUNCTION public.product_phase1_recover_expired_sections(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase1_recover_expired_sections(uuid) TO service_role;
