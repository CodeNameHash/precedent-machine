CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.product_source_documents (
  source_document_id text PRIMARY KEY,
  retrieval_url text NOT NULL UNIQUE,
  raw_sha256 text NOT NULL,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_analysis_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id text NOT NULL REFERENCES public.product_source_documents(source_document_id),
  retrieval_url text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  submission_fingerprint text NOT NULL,
  schema_version text NOT NULL,
  prompt_bundle_version text NOT NULL,
  model_config jsonb NOT NULL,
  explicit_generation integer NOT NULL CHECK (explicit_generation >= 0),
  source_generation integer NOT NULL CHECK (source_generation >= 1),
  max_attempts integer NOT NULL CHECK (max_attempts >= 1),
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'PARTIAL', 'FAILED', 'READY')),
  stage text NOT NULL,
  error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_document_id, source_generation),
  UNIQUE (source_document_id, submission_fingerprint)
);

CREATE TABLE public.product_submission_requests (
  idempotency_key text PRIMARY KEY,
  submission_fingerprint text NOT NULL,
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_agreement_structures (
  structure_id text PRIMARY KEY,
  source_document_id text NOT NULL UNIQUE REFERENCES public.product_source_documents(source_document_id),
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_run_structures (
  run_id uuid PRIMARY KEY REFERENCES public.product_analysis_runs(run_id),
  structure_id text NOT NULL REFERENCES public.product_agreement_structures(structure_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_document_identity_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.product_analysis_runs(run_id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  reasons jsonb NOT NULL,
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE public.product_section_work (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  node_id text NOT NULL,
  authored_order integer NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'FAILED', 'COMPLETE')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts >= 1),
  worker_id text,
  attempt_token uuid,
  lease_expires_at timestamptz,
  error jsonb,
  cost_microusd bigint NOT NULL DEFAULT 0 CHECK (cost_microusd >= 0),
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (run_id, node_id),
  UNIQUE (run_id, authored_order)
);

CREATE TABLE public.product_drafts (
  draft_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.product_analysis_runs(run_id),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_draft_revisions (
  draft_id uuid NOT NULL REFERENCES public.product_drafts(draft_id),
  version integer NOT NULL CHECK (version >= 0),
  state jsonb NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, version)
);

CREATE TABLE public.product_draft_audit_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.product_drafts(draft_id),
  version integer NOT NULL CHECK (version >= 0),
  actor text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('CREATE', 'SAVE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION public.product_reject_immutable_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'immutable product record' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER product_source_documents_immutable
BEFORE UPDATE OR DELETE ON public.product_source_documents
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_agreement_structures_immutable
BEFORE UPDATE OR DELETE ON public.product_agreement_structures
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_draft_revisions_immutable
BEFORE UPDATE OR DELETE ON public.product_draft_revisions
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_draft_audit_events_immutable
BEFORE UPDATE OR DELETE ON public.product_draft_audit_events
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();

CREATE FUNCTION public.product_phase1_persist_source(p_source jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.product_source_documents; source_payload_sha256 text;
BEGIN
  IF p_source->>'schema_version' <> 'SOURCE_DOCUMENT/V1'
    OR coalesce(p_source->>'source_document_id', '') = ''
    OR coalesce(p_source->>'retrieval_url', '') = ''
    OR coalesce(p_source->>'raw_sha256', '') = '' THEN
    RAISE EXCEPTION 'invalid SourceDocument' USING ERRCODE = '22023';
  END IF;
  IF p_source->>'retrieval_url' !~ '^https://www\.sec\.gov/Archives/edgar/data/[0-9]+/[0-9]{18}/[^/?#]+\.html?$'
    OR p_source->>'raw_sha256' !~ '^[0-9a-f]{64}$'
    OR p_source->>'canonical_text_sha256' !~ '^[0-9a-f]{64}$'
    OR pg_catalog.encode(extensions.digest(pg_catalog.decode(p_source->>'raw_bytes_base64', 'base64'), 'sha256'::text), 'hex') <> p_source->>'raw_sha256'
    OR pg_catalog.octet_length(pg_catalog.decode(p_source->>'raw_bytes_base64', 'base64')) <> (p_source->>'raw_byte_length')::bigint
    OR pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_source->>'canonical_text', 'UTF8'), 'sha256'::text), 'hex') <> p_source->>'canonical_text_sha256'
    OR pg_catalog.octet_length(pg_catalog.convert_to(p_source->>'canonical_text', 'UTF8')) <> (p_source->>'canonical_text_byte_length')::bigint THEN
    RAISE EXCEPTION 'SourceDocument bytes or hashes do not match' USING ERRCODE = '22023';
  END IF;
  source_payload_sha256 := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_source::text, 'UTF8'), 'sha256'::text), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source->>'retrieval_url', 0));
  SELECT * INTO existing FROM public.product_source_documents
    WHERE source_document_id = p_source->>'source_document_id' OR retrieval_url = p_source->>'retrieval_url'
    FOR SHARE;
  IF FOUND THEN
    IF existing.source_document_id <> p_source->>'source_document_id' OR existing.payload <> p_source
      OR existing.payload_sha256 <> source_payload_sha256 THEN
      RAISE EXCEPTION 'SourceDocument collision' USING ERRCODE = '23505';
    END IF;
    RETURN existing.payload;
  END IF;
  INSERT INTO public.product_source_documents(source_document_id, retrieval_url, raw_sha256, payload, payload_sha256)
  VALUES (p_source->>'source_document_id', p_source->>'retrieval_url', p_source->>'raw_sha256', p_source, source_payload_sha256);
  RETURN p_source;
END;
$$;

CREATE FUNCTION public.product_phase1_create_run(
  p_source_document_id text, p_retrieval_url text, p_idempotency_key text,
  p_schema_version text, p_prompt_bundle_version text, p_model_config jsonb,
  p_explicit_generation integer, p_max_attempts integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  fingerprint text;
  existing_request public.product_submission_requests;
  existing_run public.product_analysis_runs;
  next_generation integer;
  created public.product_analysis_runs;
BEGIN
  IF coalesce(p_idempotency_key, '') = '' OR coalesce(p_schema_version, '') = ''
    OR coalesce(p_prompt_bundle_version, '') = '' OR p_model_config IS NULL
    OR p_explicit_generation < 0 OR p_max_attempts < 1 THEN
    RAISE EXCEPTION 'invalid analysis run input' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.product_source_documents
    WHERE source_document_id = p_source_document_id AND retrieval_url = p_retrieval_url FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SourceDocument not found' USING ERRCODE = '23503'; END IF;
  fingerprint := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    p_source_document_id || chr(31) || p_schema_version || chr(31) || p_prompt_bundle_version
    || chr(31) || p_model_config::text || chr(31) || p_explicit_generation::text
    || chr(31) || p_max_attempts::text, 'UTF8'), 'sha256'::text), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_document_id, 0));
  SELECT * INTO existing_request FROM public.product_submission_requests WHERE idempotency_key = p_idempotency_key FOR UPDATE;
  IF FOUND THEN
    IF existing_request.submission_fingerprint <> fingerprint THEN
      RAISE EXCEPTION 'idempotency key reused with different submission' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO existing_run FROM public.product_analysis_runs WHERE run_id = existing_request.run_id;
    RETURN to_jsonb(existing_run);
  END IF;
  SELECT * INTO existing_run FROM public.product_analysis_runs
    WHERE source_document_id = p_source_document_id AND submission_fingerprint = fingerprint;
  IF FOUND THEN
    INSERT INTO public.product_submission_requests(idempotency_key, submission_fingerprint, run_id)
    VALUES (p_idempotency_key, fingerprint, existing_run.run_id);
    RETURN to_jsonb(existing_run);
  END IF;
  SELECT coalesce(max(source_generation), 0) + 1 INTO next_generation
    FROM public.product_analysis_runs WHERE source_document_id = p_source_document_id;
  INSERT INTO public.product_analysis_runs(
    source_document_id, retrieval_url, idempotency_key, submission_fingerprint, schema_version,
    prompt_bundle_version, model_config, explicit_generation, source_generation,
    max_attempts, status, stage
  ) VALUES (
    p_source_document_id, p_retrieval_url, p_idempotency_key, fingerprint, p_schema_version,
    p_prompt_bundle_version, p_model_config, p_explicit_generation, next_generation,
    p_max_attempts, 'QUEUED', 'STRUCTURE'
  ) RETURNING * INTO created;
  INSERT INTO public.product_submission_requests(idempotency_key, submission_fingerprint, run_id)
  VALUES (p_idempotency_key, fingerprint, created.run_id);
  RETURN to_jsonb(created);
END;
$$;

CREATE FUNCTION public.product_phase1_attach_structure(
  p_run_id uuid, p_structure_id text, p_structure jsonb, p_identity_review jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run_row public.product_analysis_runs; existing public.product_agreement_structures;
DECLARE draft_row public.product_drafts; node jsonb; structure_sha256 text;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  structure_sha256 := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_structure::text, 'UTF8'), 'sha256'::text), 'hex');
  SELECT s.* INTO existing FROM public.product_run_structures rs
    JOIN public.product_agreement_structures s ON s.structure_id = rs.structure_id WHERE rs.run_id = p_run_id;
  IF FOUND THEN
    IF existing.structure_id <> p_structure_id OR existing.payload <> p_structure OR existing.payload_sha256 <> structure_sha256 THEN
      RAISE EXCEPTION 'AgreementStructure collision' USING ERRCODE = '23505';
    END IF;
    IF (p_identity_review IS NULL) <> NOT EXISTS (
      SELECT 1 FROM public.product_document_identity_reviews WHERE run_id = p_run_id
    ) THEN
      RAISE EXCEPTION 'document identity review collision' USING ERRCODE = '23505';
    END IF;
    IF p_identity_review IS NOT NULL AND p_identity_review <> (
      SELECT reasons FROM public.product_document_identity_reviews WHERE run_id = p_run_id
    ) THEN
      RAISE EXCEPTION 'document identity review collision' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(run_row);
  END IF;
  IF p_structure->>'schema_version' <> 'AGREEMENT_STRUCTURE/V1'
    OR p_structure->>'agreement_id' <> run_row.source_document_id OR p_structure_id !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid AgreementStructure' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_structure->'nodes') item
    WHERE item->>'kind' = 'SECTION'
      AND coalesce(item->>'reference', '') <> ''
      AND item->>'reference' !~ '-INTRO$'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_structure->'nodes') child
        WHERE child->>'kind' = 'SECTION'
          AND child->>'node_id' <> item->>'node_id'
          AND child->>'reference' LIKE (item->>'reference') || '::%'
      )
  ) THEN
    RAISE EXCEPTION 'AgreementStructure has no section work' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO existing FROM public.product_agreement_structures WHERE source_document_id = run_row.source_document_id FOR SHARE;
  IF FOUND THEN
    IF existing.structure_id <> p_structure_id OR existing.payload <> p_structure OR existing.payload_sha256 <> structure_sha256 THEN
      RAISE EXCEPTION 'AgreementStructure collision' USING ERRCODE = '23505';
    END IF;
  ELSE
    INSERT INTO public.product_agreement_structures(structure_id, source_document_id, payload, payload_sha256)
    VALUES (p_structure_id, run_row.source_document_id, p_structure, structure_sha256);
  END IF;
  INSERT INTO public.product_run_structures(run_id, structure_id) VALUES (p_run_id, p_structure_id);
  INSERT INTO public.product_drafts(run_id) VALUES (p_run_id) RETURNING * INTO draft_row;
  INSERT INTO public.product_draft_revisions(draft_id, version, state, actor)
  VALUES (draft_row.draft_id, 0, draft_row.state, 'system');
  INSERT INTO public.product_draft_audit_events(draft_id, version, actor, event_type)
  VALUES (draft_row.draft_id, 0, 'system', 'CREATE');
  IF p_identity_review IS NOT NULL THEN
    INSERT INTO public.product_document_identity_reviews(run_id, reasons)
    VALUES (p_run_id, p_identity_review);
    UPDATE public.product_analysis_runs SET status = 'QUEUED', stage = 'DOCUMENT_IDENTITY_REVIEW', updated_at = now()
      WHERE run_id = p_run_id RETURNING * INTO run_row;
  ELSE
    FOR node IN SELECT value FROM jsonb_array_elements(p_structure->'nodes') LOOP
      IF node->>'kind' = 'SECTION'
        AND coalesce(node->>'reference', '') <> ''
        AND node->>'reference' !~ '-INTRO$'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_structure->'nodes') child
          WHERE child->>'kind' = 'SECTION'
            AND child->>'node_id' <> node->>'node_id'
            AND child->>'reference' LIKE (node->>'reference') || '::%'
        ) THEN
        INSERT INTO public.product_section_work(run_id, node_id, authored_order, max_attempts)
        VALUES (p_run_id, node->>'node_id', (node->>'authored_order')::integer, run_row.max_attempts);
      END IF;
    END LOOP;
    UPDATE public.product_analysis_runs SET status = 'QUEUED', stage = 'SECTION_ANALYSIS', updated_at = now()
      WHERE run_id = p_run_id RETURNING * INTO run_row;
  END IF;
  RETURN to_jsonb(run_row);
END;
$$;

CREATE FUNCTION public.product_phase1_fail_run(p_run_id uuid, p_stage text, p_error jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.product_analysis_runs;
BEGIN
  UPDATE public.product_analysis_runs SET status = 'FAILED', stage = p_stage, error = p_error, updated_at = now()
  WHERE run_id = p_run_id AND status NOT IN ('READY', 'FAILED') RETURNING * INTO result;
  IF NOT FOUND THEN SELECT * INTO result FROM public.product_analysis_runs WHERE run_id = p_run_id; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  RETURN to_jsonb(result);
END;
$$;

CREATE FUNCTION public.product_phase1_resolve_identity(p_run_id uuid, p_resolution jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run_row public.product_analysis_runs; structure_row public.product_agreement_structures; node jsonb;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  IF run_row.stage <> 'DOCUMENT_IDENTITY_REVIEW' THEN
    IF EXISTS (SELECT 1 FROM public.product_document_identity_reviews
      WHERE run_id = p_run_id AND status = 'RESOLVED' AND resolution = p_resolution) THEN
      RETURN to_jsonb(run_row);
    END IF;
    RAISE EXCEPTION 'identity review is not open' USING ERRCODE = '55000';
  END IF;
  IF p_resolution IS NULL OR p_resolution = '{}'::jsonb THEN
    RAISE EXCEPTION 'identity resolution is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.product_document_identity_reviews SET status = 'RESOLVED', resolution = p_resolution, resolved_at = now()
    WHERE run_id = p_run_id AND status = 'OPEN';
  IF NOT FOUND THEN RAISE EXCEPTION 'identity review is not open' USING ERRCODE = '55000'; END IF;
  SELECT s.* INTO structure_row FROM public.product_run_structures rs
    JOIN public.product_agreement_structures s ON s.structure_id = rs.structure_id WHERE rs.run_id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'AgreementStructure not found' USING ERRCODE = '23503'; END IF;
  FOR node IN SELECT value FROM jsonb_array_elements(structure_row.payload->'nodes') LOOP
    IF node->>'kind' = 'SECTION'
      AND coalesce(node->>'reference', '') <> ''
      AND node->>'reference' !~ '-INTRO$'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(structure_row.payload->'nodes') child
        WHERE child->>'kind' = 'SECTION'
          AND child->>'node_id' <> node->>'node_id'
          AND child->>'reference' LIKE (node->>'reference') || '::%'
      ) THEN
      INSERT INTO public.product_section_work(run_id, node_id, authored_order, max_attempts)
      VALUES (p_run_id, node->>'node_id', (node->>'authored_order')::integer, run_row.max_attempts)
      ON CONFLICT (run_id, node_id) DO NOTHING;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id) THEN
    RAISE EXCEPTION 'AgreementStructure has no section work' USING ERRCODE = '22023';
  END IF;
  UPDATE public.product_analysis_runs SET status = 'QUEUED', stage = 'SECTION_ANALYSIS', updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN to_jsonb(run_row);
END;
$$;

CREATE FUNCTION public.product_phase1_claim_section(p_run_id uuid, p_worker_id text, p_lease_seconds integer DEFAULT 300) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work; run_row public.product_analysis_runs;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_lease_seconds < 1 OR p_lease_seconds > 3600 THEN
    RAISE EXCEPTION 'invalid section claim input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  IF run_row.status IN ('FAILED', 'READY') OR run_row.stage = 'DOCUMENT_IDENTITY_REVIEW' THEN RETURN NULL; END IF;
  SELECT * INTO work FROM public.product_section_work
  WHERE run_id = p_run_id AND attempts < max_attempts
    AND (status IN ('PENDING', 'FAILED') OR (status = 'RUNNING' AND lease_expires_at < now()))
  ORDER BY authored_order FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.product_section_work SET status = 'RUNNING', attempts = attempts + 1,
    worker_id = p_worker_id, attempt_token = extensions.gen_random_uuid(), lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    started_at = now(), error = NULL WHERE run_id = work.run_id AND node_id = work.node_id RETURNING * INTO work;
  UPDATE public.product_analysis_runs SET status = 'RUNNING', stage = 'SECTION_ANALYSIS', updated_at = now() WHERE run_id = p_run_id;
  RETURN to_jsonb(work);
END;
$$;

CREATE FUNCTION public.product_phase1_complete_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid,
  p_cost_microusd bigint, p_input_tokens bigint, p_output_tokens bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work; run_row public.product_analysis_runs;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_cost_microusd < 0 OR p_input_tokens < 0 OR p_output_tokens < 0 THEN
    RAISE EXCEPTION 'invalid section completion input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO work FROM public.product_section_work WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status = 'COMPLETE' AND work.worker_id = p_worker_id AND work.attempt_token = p_attempt_token THEN
    SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
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
  UPDATE public.product_analysis_runs SET
    status = CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE') THEN 'READY'
      WHEN EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status = 'FAILED') THEN 'PARTIAL'
      ELSE 'RUNNING' END,
    stage = CASE WHEN NOT EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE') THEN 'READY' ELSE 'SECTION_ANALYSIS' END,
    updated_at = now() WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
END;
$$;

CREATE FUNCTION public.product_phase1_fail_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_error jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE work public.product_section_work; run_row public.product_analysis_runs;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_error IS NULL THEN
    RAISE EXCEPTION 'invalid section failure input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO work FROM public.product_section_work WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  IF work.status = 'FAILED' AND work.worker_id = p_worker_id AND work.attempt_token = p_attempt_token THEN
    SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
    RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
  END IF;
  IF work.status <> 'RUNNING' OR work.worker_id <> p_worker_id OR work.attempt_token <> p_attempt_token
    OR work.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
  END IF;
  UPDATE public.product_section_work SET status = 'FAILED', lease_expires_at = NULL, error = p_error
    WHERE run_id = p_run_id AND node_id = p_node_id RETURNING * INTO work;
  UPDATE public.product_analysis_runs SET
    status = CASE WHEN work.attempts >= work.max_attempts THEN 'FAILED' ELSE 'PARTIAL' END,
    stage = 'SECTION_ANALYSIS', error = CASE WHEN work.attempts >= work.max_attempts THEN p_error ELSE error END,
    updated_at = now() WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work), 'run', to_jsonb(run_row));
END;
$$;

CREATE FUNCTION public.product_phase1_save_draft(
  p_draft_id uuid, p_expected_version integer, p_state jsonb, p_actor text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE draft public.product_drafts; next_version integer;
BEGIN
  SELECT * INTO draft FROM public.product_drafts WHERE draft_id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'draft not found' USING ERRCODE = '23503'; END IF;
  IF draft.version <> p_expected_version THEN RAISE EXCEPTION 'optimistic lock conflict' USING ERRCODE = '40001'; END IF;
  next_version := draft.version + 1;
  UPDATE public.product_drafts SET version = next_version, state = p_state, updated_at = now()
    WHERE draft_id = p_draft_id RETURNING * INTO draft;
  INSERT INTO public.product_draft_revisions(draft_id, version, state, actor) VALUES (draft.draft_id, next_version, p_state, p_actor);
  INSERT INTO public.product_draft_audit_events(draft_id, version, actor, event_type) VALUES (draft.draft_id, next_version, p_actor, 'SAVE');
  RETURN to_jsonb(draft);
END;
$$;

ALTER TABLE public.product_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_submission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_agreement_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_run_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_document_identity_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_section_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_draft_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_draft_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_source_documents, public.product_analysis_runs,
  public.product_submission_requests, public.product_agreement_structures, public.product_run_structures, public.product_document_identity_reviews,
  public.product_section_work, public.product_drafts, public.product_draft_revisions,
  public.product_draft_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.product_source_documents, public.product_analysis_runs,
  public.product_submission_requests, public.product_agreement_structures, public.product_run_structures, public.product_document_identity_reviews,
  public.product_section_work, public.product_drafts, public.product_draft_revisions,
  public.product_draft_audit_events FROM service_role;
GRANT SELECT ON public.product_source_documents, public.product_analysis_runs,
  public.product_submission_requests, public.product_agreement_structures, public.product_run_structures, public.product_document_identity_reviews,
  public.product_section_work, public.product_drafts, public.product_draft_revisions,
  public.product_draft_audit_events TO service_role;

REVOKE ALL ON FUNCTION public.product_reject_immutable_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_persist_source(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_create_run(text,text,text,text,text,jsonb,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_attach_structure(uuid,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_fail_run(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_resolve_identity(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_claim_section(uuid,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_complete_section(uuid,text,text,uuid,bigint,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_fail_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase1_save_draft(uuid,integer,jsonb,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.product_phase1_persist_source(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_create_run(text,text,text,text,text,jsonb,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_attach_structure(uuid,text,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_fail_run(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_resolve_identity(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_claim_section(uuid,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_complete_section(uuid,text,text,uuid,bigint,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_fail_section(uuid,text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase1_save_draft(uuid,integer,jsonb,text) TO service_role;
