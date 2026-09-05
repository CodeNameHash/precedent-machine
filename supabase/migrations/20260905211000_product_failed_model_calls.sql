ALTER TABLE public.product_model_calls
  ADD COLUMN invocation_id text,
  ADD CONSTRAINT product_model_calls_invocation_id_shape
    CHECK (invocation_id IS NULL OR invocation_id ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX product_model_calls_run_invocation_unique
  ON public.product_model_calls(run_id, invocation_id)
  WHERE invocation_id IS NOT NULL;

CREATE FUNCTION product_private.product_phase2_admit_model_call(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_call jsonb, p_require_invocation boolean DEFAULT true
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  work public.product_section_work;
  existing public.product_model_calls;
  expected_invocation_id text;
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
    OR (p_call->>'duration_ms')::bigint < 0 THEN
    RAISE EXCEPTION 'invalid product model call' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO work FROM public.product_section_work
  WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status IS DISTINCT FROM 'RUNNING' OR work.worker_id IS DISTINCT FROM p_worker_id
    OR work.attempt_token IS DISTINCT FROM p_attempt_token
    OR work.lease_expires_at IS NULL OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
  END IF;

  IF p_call->>'invocation_id' IS NOT NULL THEN
    expected_invocation_id := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      'PRODUCT_MODEL_INVOCATION/V1' || chr(31) || p_attempt_token::text || chr(31)
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
      OR existing.duration_ms IS DISTINCT FROM (p_call->>'duration_ms')::bigint THEN
      RAISE EXCEPTION 'product model call collision' USING ERRCODE = '23505';
    END IF;
    RETURN false;
  END IF;

  INSERT INTO public.product_model_calls(
    run_id, model_call_id, invocation_id, structure_node_id, call_kind, prompt_version,
    provider_id, model_id, request, response, input_tokens, output_tokens, cost_microusd, duration_ms
  ) VALUES (
    p_run_id, p_call->>'model_call_id', p_call->>'invocation_id', p_node_id,
    p_call->>'call_kind', p_call->>'prompt_version', p_call->>'provider_id', p_call->>'model_id',
    p_call->'request', p_call->'response', (p_call->>'input_tokens')::bigint,
    (p_call->>'output_tokens')::bigint, (p_call->>'cost_microusd')::bigint,
    (p_call->>'duration_ms')::bigint
  );
  UPDATE public.product_section_work SET
    cost_microusd = cost_microusd + (p_call->>'cost_microusd')::bigint,
    input_tokens = input_tokens + (p_call->>'input_tokens')::bigint,
    output_tokens = output_tokens + (p_call->>'output_tokens')::bigint
  WHERE run_id = p_run_id AND node_id = p_node_id;
  RETURN true;
END;
$$;

CREATE FUNCTION product_private.product_phase2_record_model_call(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_call jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE inserted boolean;
BEGIN
  inserted := product_private.product_phase2_admit_model_call(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_call, true
  );
  RETURN jsonb_build_object('inserted', inserted, 'model_call_id', p_call->>'model_call_id');
END;
$$;

CREATE FUNCTION public.product_phase2_record_model_call(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_call jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_record_model_call(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_call
  )
$$;

CREATE FUNCTION product_private.product_phase2_fail_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_error jsonb, p_model_calls jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work; item jsonb;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_attempt_token IS NULL
    OR coalesce(pg_catalog.jsonb_typeof(p_error), '') <> 'object'
    OR coalesce(pg_catalog.jsonb_typeof(p_model_calls), '') <> 'array' THEN
    RAISE EXCEPTION 'invalid section failure input' USING ERRCODE = '22023';
  END IF;
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

CREATE FUNCTION public.product_phase2_fail_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_error jsonb, p_model_calls jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_fail_section(
    p_run_id, p_node_id, p_worker_id, p_attempt_token, p_error, p_model_calls
  )
$$;

DO $$
DECLARE definition text; start_at integer; end_at integer; tail text;
DECLARE replacement text := 'FOR item IN SELECT value FROM jsonb_array_elements(p_result->''model_calls'') LOOP
    PERFORM product_private.product_phase2_admit_model_call(
      p_run_id, p_node_id, p_worker_id, p_attempt_token, item, false
    );
  END LOOP;';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_commit_section_legacy(uuid,text,text,uuid,jsonb)'::pg_catalog.regprocedure
  );
  start_at := pg_catalog.strpos(definition,
    'FOR item IN SELECT value FROM jsonb_array_elements(p_result->''model_calls'') LOOP');
  IF start_at = 0 THEN RAISE EXCEPTION 'product_phase2_commit_section_legacy model loop is not recognised'; END IF;
  tail := pg_catalog.substr(definition, start_at);
  end_at := pg_catalog.strpos(tail, '  END LOOP;');
  IF end_at = 0 THEN RAISE EXCEPTION 'product_phase2_commit_section_legacy model loop end is not recognised'; END IF;
  definition := pg_catalog.substr(definition, 1, start_at - 1)
    || replacement || pg_catalog.substr(tail, end_at + pg_catalog.length('  END LOOP;'));
  EXECUTE definition;
END;
$$;

DO $$
DECLARE definition text;
DECLARE old_start text := 'jsonb_build_object(''model_call_id'', model_call_id, ''structure_node_id'', structure_node_id';
DECLARE old_end text := '''cost_microusd'', cost_microusd, ''duration_ms'', duration_ms)';
DECLARE new_end text := '''cost_microusd'', cost_microusd, ''duration_ms'', duration_ms)
        || CASE WHEN invocation_id IS NULL THEN ''{}''::jsonb
          ELSE jsonb_build_object(''invocation_id'', invocation_id) END';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_get_analysis(uuid)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, old_start) = 0 OR pg_catalog.strpos(definition, old_end) = 0 THEN
    RAISE EXCEPTION 'product_phase2_get_analysis model-call projection is not recognised';
  END IF;
  definition := pg_catalog.replace(definition, old_end, new_end);
  EXECUTE definition;
END;
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_admit_model_call(uuid,text,text,uuid,jsonb,boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_record_model_call(uuid,text,text,uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_fail_section(uuid,text,text,uuid,jsonb,jsonb)
  TO service_role;
