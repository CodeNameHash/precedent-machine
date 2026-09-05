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
  UPDATE public.product_section_work SET status = 'FAILED', lease_expires_at = NULL, error = p_error
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

CREATE OR REPLACE FUNCTION public.product_phase1_complete_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_cost_microusd bigint, p_input_tokens bigint, p_output_tokens bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
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
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_fail_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_error jsonb, p_model_calls jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
  END IF;
  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_model_calls) LOOP
    PERFORM product_private.product_phase2_admit_model_call(
      p_run_id, p_node_id, p_worker_id, p_attempt_token, item, true
    );
  END LOOP;
  RETURN public.product_phase1_fail_section(p_run_id, p_node_id, p_worker_id, p_attempt_token, p_error);
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; residual jsonb; run_row public.product_analysis_runs; exhausted boolean; exhausted_error jsonb; all_complete boolean;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
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
      WHEN EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status = 'FAILED') THEN 'PARTIAL'
      ELSE 'RUNNING' END,
    stage = CASE WHEN all_complete THEN 'DRAFT_FINALIZATION' ELSE 'SECTION_ANALYSIS' END,
    error = CASE WHEN NOT exhausted THEN NULL
      ELSE coalesce(CASE WHEN run_row.status = 'FAILED' THEN run_row.error END,
        exhausted_error, jsonb_build_object('code', 'SECTION_ATTEMPTS_EXHAUSTED')) END,
    updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN pg_catalog.jsonb_set(result, '{run}', to_jsonb(run_row));
END;
$$;

CREATE OR REPLACE FUNCTION public.product_phase1_recover_expired_sections(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recovered integer; run_row public.product_analysis_runs; exhausted boolean; exhausted_error jsonb;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  UPDATE public.product_section_work
  SET status = 'FAILED', worker_id = NULL, attempt_token = NULL, lease_expires_at = NULL,
    error = jsonb_build_object('code', 'SECTION_LEASE_EXPIRED')
  WHERE run_id = p_run_id AND status = 'RUNNING' AND lease_expires_at <= now();
  GET DIAGNOSTICS recovered = ROW_COUNT;
  IF recovered > 0 THEN
    SELECT EXISTS (SELECT 1 FROM public.product_section_work
        WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts),
      (SELECT error FROM public.product_section_work
        WHERE run_id = p_run_id AND status = 'FAILED' AND attempts >= max_attempts
        ORDER BY authored_order LIMIT 1)
      INTO exhausted, exhausted_error;
    UPDATE public.product_analysis_runs SET
      status = CASE WHEN exhausted THEN 'FAILED' ELSE 'PARTIAL' END,
      stage = 'SECTION_ANALYSIS',
      error = CASE WHEN NOT exhausted THEN NULL
        ELSE coalesce(CASE WHEN run_row.status = 'FAILED' THEN run_row.error END,
          exhausted_error, jsonb_build_object('code', 'SECTION_ATTEMPTS_EXHAUSTED')) END,
      updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO run_row;
  END IF;
  RETURN jsonb_build_object('run_id', p_run_id, 'recovered_sections', recovered, 'run', to_jsonb(run_row));
END;
$$;

REVOKE ALL ON FUNCTION public.product_phase1_fail_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_complete_section(uuid,text,text,uuid,bigint,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_recover_expired_sections(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase1_fail_section(uuid,text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_complete_section(uuid,text,text,uuid,bigint,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_recover_expired_sections(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
