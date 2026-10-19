-- Attempt resume after a worker stop (work package D3, plan finding (142)).
-- A section attempt's calls are recorded as they complete; a restart
-- between the parts of a long section lost them all because the next
-- attempt ran the section again and the lease recovery wrote no record
-- (NCS generation 5, 5.8: two parts done, $2.69, nothing on the row).
-- (1) product_model_calls.resumed_from_model_call_id: a later attempt's
--     record of a call it reused from an earlier attempt (the original's
--     request and raw response under the new attempt's invocation
--     identity, zero tokens, zero cost); the admission checks it names a
--     call of the same section and kind and spends nothing.
-- (2) Every failure record on error_history carries the attempt token, so
--     a later attempt can tell which stored calls were that attempt's.
-- (3) The lease recovery writes the expired attempt on the history.
-- (4) product_phase2_release_section hands a claim back without a failure:
--     PENDING, the attempt refunded, the reason and the parts done recorded.
ALTER TABLE public.product_model_calls
  ADD COLUMN IF NOT EXISTS resumed_from_model_call_id text
  CHECK (resumed_from_model_call_id IS NULL OR resumed_from_model_call_id ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION product_private.product_phase2_admit_model_call(p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_call jsonb, p_require_invocation boolean DEFAULT true)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  work public.product_section_work;
  existing public.product_model_calls;
  expected_invocation_id text;
  invocation_token text;
  extraction_part text;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_attempt_token IS NULL OR p_call IS NULL
    OR p_call->>'schema_version' IS DISTINCT FROM 'PRODUCT_MODEL_CALL/V1'
    OR coalesce(p_call->>'model_call_id', '') !~ '^[0-9a-f]{64}$'
    OR p_call->>'structure_node_id' IS DISTINCT FROM p_node_id
    OR coalesce(p_call->>'call_kind', '') NOT IN ('ROUTING', 'RESIDUAL', 'EXTRACTION')
    OR coalesce(p_call->>'prompt_version', '') = ''
    OR coalesce(p_call->>'provider_id', '') = ''
    OR coalesce(p_call->>'model_id', '') = ''
    OR NOT p_call ? 'request' OR NOT p_call ? 'response'
    OR coalesce(pg_catalog.jsonb_typeof(p_call->'input_tokens'), '') <> 'number'
    OR coalesce(pg_catalog.jsonb_typeof(p_call->'output_tokens'), '') <> 'number'
    OR coalesce(pg_catalog.jsonb_typeof(p_call->'cost_microusd'), '') <> 'number'
    OR coalesce(pg_catalog.jsonb_typeof(p_call->'duration_ms'), '') <> 'number'
    OR (p_call->>'input_tokens')::bigint < 0
    OR (p_call->>'output_tokens')::bigint < 0
    OR (p_call->>'cost_microusd')::bigint < 0
    OR (p_call->>'duration_ms')::bigint < 0
    OR (p_call ? 'resumed_from_model_call_id' AND coalesce(p_call->>'resumed_from_model_call_id', '') !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'invalid product model call' USING ERRCODE = '22023';
  END IF;
  -- A resumed call (work package D3, plan finding (142)) names the call of
  -- an earlier attempt of the same section whose answer it carries, and
  -- spends nothing.
  IF p_call ? 'resumed_from_model_call_id' THEN
    IF NOT EXISTS (SELECT 1 FROM public.product_model_calls source
        WHERE source.run_id = p_run_id AND source.model_call_id = p_call->>'resumed_from_model_call_id'
          AND source.structure_node_id = p_node_id AND source.call_kind = p_call->>'call_kind')
      OR (p_call->>'cost_microusd')::bigint <> 0 OR (p_call->>'input_tokens')::bigint <> 0 OR (p_call->>'output_tokens')::bigint <> 0 THEN
      RAISE EXCEPTION 'invalid resumed product model call' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO work FROM public.product_section_work
  WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status IS DISTINCT FROM 'RUNNING' OR work.worker_id IS DISTINCT FROM p_worker_id
    OR work.attempt_token IS DISTINCT FROM p_attempt_token
    OR work.lease_expires_at IS NULL OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001';
  END IF;

  IF p_call->>'invocation_id' IS NOT NULL THEN
    extraction_part := product_private.product_phase2_model_call_extraction_part(p_call);
    invocation_token := p_attempt_token::text;
    IF extraction_part ~ '^[1-9][0-9]*$' AND p_call->>'call_kind' = 'EXTRACTION' THEN
      invocation_token := invocation_token || ':part-' || extraction_part;
    END IF;
    expected_invocation_id := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'PRODUCT_MODEL_INVOCATION/V1' || chr(31) || invocation_token || chr(31)
      || (p_call->>'call_kind'), 'UTF8'), 'sha256'::text), 'hex');
    IF p_call->>'invocation_id' IS DISTINCT FROM expected_invocation_id THEN
      RAISE EXCEPTION 'invalid product model invocation identity' USING ERRCODE = '22023';
    END IF;
  ELSIF p_require_invocation THEN
    RAISE EXCEPTION 'product model invocation identity is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing FROM public.product_model_calls
  WHERE run_id = p_run_id AND (
    model_call_id = p_call->>'model_call_id'
    OR (p_call->>'invocation_id' IS NOT NULL AND invocation_id = p_call->>'invocation_id')
  ) FOR SHARE;
  IF FOUND THEN
    IF existing.model_call_id IS DISTINCT FROM p_call->>'model_call_id'
      OR existing.structure_node_id IS DISTINCT FROM p_node_id
      OR existing.call_kind IS DISTINCT FROM p_call->>'call_kind'
      OR existing.prompt_version IS DISTINCT FROM p_call->>'prompt_version'
      OR existing.provider_id IS DISTINCT FROM p_call->>'provider_id'
      OR existing.model_id IS DISTINCT FROM p_call->>'model_id'
      OR existing.invocation_id IS DISTINCT FROM p_call->>'invocation_id'
      OR existing.request IS DISTINCT FROM p_call->'request'
      OR existing.response IS DISTINCT FROM p_call->'response'
      OR existing.input_tokens IS DISTINCT FROM (p_call->>'input_tokens')::bigint
      OR existing.output_tokens IS DISTINCT FROM (p_call->>'output_tokens')::bigint
      OR existing.cost_microusd IS DISTINCT FROM (p_call->>'cost_microusd')::bigint
      OR existing.duration_ms IS DISTINCT FROM (p_call->>'duration_ms')::bigint
      OR existing.resumed_from_model_call_id IS DISTINCT FROM (p_call->>'resumed_from_model_call_id') THEN
      RAISE EXCEPTION 'product model call collision' USING ERRCODE = '23505';
    END IF;
    RETURN false;
  END IF;

  INSERT INTO public.product_model_calls(
    run_id, model_call_id, invocation_id, structure_node_id, call_kind, prompt_version,
    provider_id, model_id, request, response, input_tokens, output_tokens, cost_microusd, duration_ms,
    resumed_from_model_call_id
  ) VALUES (
    p_run_id, p_call->>'model_call_id', p_call->>'invocation_id', p_node_id,
    p_call->>'call_kind', p_call->>'prompt_version', p_call->>'provider_id', p_call->>'model_id',
    p_call->'request', p_call->'response', (p_call->>'input_tokens')::bigint,
    (p_call->>'output_tokens')::bigint, (p_call->>'cost_microusd')::bigint,
    (p_call->>'duration_ms')::bigint, p_call->>'resumed_from_model_call_id'
  );
  UPDATE public.product_section_work SET
    cost_microusd = cost_microusd + (p_call->>'cost_microusd')::bigint,
    input_tokens = input_tokens + (p_call->>'input_tokens')::bigint,
    output_tokens = output_tokens + (p_call->>'output_tokens')::bigint
  WHERE run_id = p_run_id AND node_id = p_node_id;
  RETURN true;
END;
$function$;

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
      'attempt', work.attempts, 'attempt_token', work.attempt_token, 'worker_id', p_worker_id, 'started_at', work.started_at,
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

CREATE OR REPLACE FUNCTION public.product_phase1_recover_expired_sections(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recovered integer; run_row public.product_analysis_runs; exhausted boolean; exhausted_error jsonb;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  -- The expired attempt goes on the row's history with its token (work
  -- package D3, plan finding (142)): the next claim clears `error`, and NCS
  -- generation 5's 5.8 lost two parts to a restart with nothing on the row.
  UPDATE public.product_section_work
  SET status = 'FAILED', worker_id = NULL, attempt_token = NULL, lease_expires_at = NULL,
    error = jsonb_build_object('code', 'SECTION_LEASE_EXPIRED'),
    error_history = error_history || jsonb_build_array(jsonb_build_object(
      'attempt', attempts, 'attempt_token', attempt_token, 'worker_id', worker_id, 'started_at', started_at,
      'failed_at', now(), 'error', jsonb_build_object('code', 'SECTION_LEASE_EXPIRED', 'lease_expired_at', lease_expires_at)))
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

-- A worker hands a claim back without failing the section (work package
-- D3, plan finding (142)): it is stopping (a signal, the sandbox session's
-- end) or it found a claim of a dead process of its own sandbox after a
-- restart. The row returns to PENDING with the attempt refunded, the calls
-- the attempt recorded stay (the next attempt reuses them,
-- lib/product/attempt-resume.js), and the reason, with the parts done,
-- goes on the history with the attempt token. The lease may already have
-- expired: a dead claim is released by its own worker id and token.
CREATE FUNCTION public.product_phase2_release_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_reason jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work; run_row public.product_analysis_runs;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_attempt_token IS NULL
    OR coalesce(pg_catalog.jsonb_typeof(p_reason), '') <> 'object' OR coalesce(p_reason->>'code', '') = '' THEN
    RAISE EXCEPTION 'invalid section release input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO work FROM public.product_section_work
    WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status IS DISTINCT FROM 'RUNNING' OR work.worker_id IS DISTINCT FROM p_worker_id
    OR work.attempt_token IS DISTINCT FROM p_attempt_token THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.product_section_work SET status = 'PENDING', attempts = greatest(attempts - 1, 0),
    worker_id = NULL, attempt_token = NULL, lease_expires_at = NULL, error = NULL,
    error_history = error_history || jsonb_build_array(jsonb_build_object(
      'attempt', work.attempts, 'attempt_token', work.attempt_token, 'worker_id', p_worker_id, 'started_at', work.started_at,
      'released_at', now(), 'reason', p_reason))
    WHERE run_id = p_run_id AND node_id = p_node_id RETURNING * INTO work;
  UPDATE public.product_analysis_runs SET updated_at = now() WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
END;
$$;

REVOKE ALL ON FUNCTION public.product_phase2_release_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase2_release_section(uuid,text,text,uuid,jsonb) TO service_role;
