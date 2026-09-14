-- A long section is extracted in parts (lib/product/agreement-draft.js
-- longSectionGroups); each part is its own EXTRACTION call whose
-- invocation identity is derived from "<attempt token>:part-<n>" so that
-- the parts of one attempt do not collide on (run_id, invocation_id).
-- The admission check derived the identity from the bare attempt token and
-- refused every part ("invalid product model invocation identity"), so no
-- split section ever recorded a model call or its own failure (Metsera
-- generation 6, 2026-09-14: 2.02, 3.09, 3.11, 3.13, 3.17). The expected
-- identity now follows the part number the call's request carries. The
-- stale attempt raises P0001 like the other lease functions.
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
    OR (p_call->>'duration_ms')::bigint < 0 THEN
    RAISE EXCEPTION 'invalid product model call' USING ERRCODE = '22023';
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
    extraction_part := p_call->'request'->'source_closure'->'extraction_part'->>'part';
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
$function$;
