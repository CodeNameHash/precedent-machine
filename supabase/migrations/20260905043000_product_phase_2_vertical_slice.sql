CREATE SCHEMA IF NOT EXISTS product_private;
REVOKE ALL ON SCHEMA product_private FROM PUBLIC, anon, authenticated;

CREATE TABLE public.product_draft_analyses (
  run_id uuid PRIMARY KEY REFERENCES public.product_analysis_runs(run_id),
  draft_analysis_id text NOT NULL UNIQUE,
  legal_schema_version text NOT NULL,
  payload_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_model_calls (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  model_call_id text NOT NULL,
  structure_node_id text NOT NULL,
  call_kind text NOT NULL CHECK (call_kind IN ('ROUTING', 'RESIDUAL', 'EXTRACTION')),
  prompt_version text NOT NULL,
  provider_id text NOT NULL,
  model_id text NOT NULL,
  request jsonb NOT NULL,
  response jsonb NOT NULL,
  input_tokens bigint NOT NULL CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL CHECK (output_tokens >= 0),
  cost_microusd bigint NOT NULL CHECK (cost_microusd >= 0),
  duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, model_call_id)
);

CREATE TABLE public.product_source_closures (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  source_closure_id text NOT NULL,
  structure_node_id text NOT NULL,
  section_reference text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, source_closure_id)
);

CREATE TABLE public.product_source_spans (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  span_id text NOT NULL,
  source_document_id text NOT NULL REFERENCES public.product_source_documents(source_document_id),
  structure_node_id text NOT NULL,
  kind text NOT NULL,
  coordinate_system text NOT NULL CHECK (coordinate_system = 'UTF8_CANONICAL_TEXT_HALF_OPEN'),
  start_byte bigint NOT NULL CHECK (start_byte >= 0),
  end_byte bigint NOT NULL CHECK (end_byte > start_byte),
  text_sha256 text NOT NULL,
  exact_text text NOT NULL,
  PRIMARY KEY (run_id, span_id)
);

CREATE TABLE public.product_source_closure_spans (
  run_id uuid NOT NULL,
  source_closure_id text NOT NULL,
  span_id text NOT NULL,
  PRIMARY KEY (run_id, source_closure_id, span_id),
  FOREIGN KEY (run_id, source_closure_id) REFERENCES public.product_source_closures(run_id, source_closure_id),
  FOREIGN KEY (run_id, span_id) REFERENCES public.product_source_spans(run_id, span_id)
);

CREATE TABLE public.product_section_routings (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  section_routing_id text NOT NULL,
  structure_node_id text NOT NULL,
  model_call_id text NOT NULL,
  authored_order integer NOT NULL,
  disposition text NOT NULL CHECK (disposition IN ('FAMILY_ASSIGNED', 'IMMATERIAL', 'UNRESOLVED_UNUSUAL_PROVISION')),
  families jsonb NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, section_routing_id),
  UNIQUE (run_id, structure_node_id),
  FOREIGN KEY (run_id, model_call_id) REFERENCES public.product_model_calls(run_id, model_call_id)
);

CREATE TABLE public.product_proposition_groups (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  proposition_group_id text NOT NULL,
  structure_node_id text NOT NULL,
  source_closure_id text NOT NULL,
  family_key text NOT NULL,
  subtype_key text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, proposition_group_id),
  FOREIGN KEY (run_id, source_closure_id) REFERENCES public.product_source_closures(run_id, source_closure_id)
);

CREATE TABLE public.product_proposals (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  proposal_id text NOT NULL,
  fact_occurrence_id text NOT NULL,
  structure_node_id text NOT NULL,
  model_call_id text NOT NULL,
  source_closure_id text NOT NULL,
  proposition_group_id text NOT NULL,
  family_key text NOT NULL,
  subtype_key text NOT NULL,
  fact_type text NOT NULL,
  state text NOT NULL CHECK (state IN ('PROPOSED', 'REJECTED', 'SUPERSEDED')),
  validation_status text NOT NULL CHECK (validation_status IN ('VALID', 'INVALID')),
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, proposal_id),
  UNIQUE (run_id, fact_occurrence_id),
  FOREIGN KEY (run_id, model_call_id) REFERENCES public.product_model_calls(run_id, model_call_id),
  FOREIGN KEY (run_id, source_closure_id) REFERENCES public.product_source_closures(run_id, source_closure_id),
  FOREIGN KEY (run_id, proposition_group_id) REFERENCES public.product_proposition_groups(run_id, proposition_group_id)
);

CREATE TABLE public.product_proposal_spans (
  run_id uuid NOT NULL,
  proposal_id text NOT NULL,
  span_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (run_id, proposal_id, span_id),
  UNIQUE (run_id, proposal_id, ordinal),
  FOREIGN KEY (run_id, proposal_id) REFERENCES public.product_proposals(run_id, proposal_id),
  FOREIGN KEY (run_id, span_id) REFERENCES public.product_source_spans(run_id, span_id)
);

CREATE TABLE public.product_fact_links (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  fact_link_id text NOT NULL,
  from_proposal_id text NOT NULL,
  to_proposal_id text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('QUALIFIES', 'EXCEPTS', 'TRIGGERS', 'DEFINED_BY', 'ALTERNATIVE_TO', 'EXTENDS', 'REQUIRES')),
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, fact_link_id),
  FOREIGN KEY (run_id, from_proposal_id) REFERENCES public.product_proposals(run_id, proposal_id),
  FOREIGN KEY (run_id, to_proposal_id) REFERENCES public.product_proposals(run_id, proposal_id),
  CHECK (from_proposal_id <> to_proposal_id)
);

CREATE TABLE public.product_fact_link_spans (
  run_id uuid NOT NULL,
  fact_link_id text NOT NULL,
  span_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (run_id, fact_link_id, span_id),
  UNIQUE (run_id, fact_link_id, ordinal),
  FOREIGN KEY (run_id, fact_link_id) REFERENCES public.product_fact_links(run_id, fact_link_id),
  FOREIGN KEY (run_id, span_id) REFERENCES public.product_source_spans(run_id, span_id)
);

CREATE TABLE public.product_issues (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  issue_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('EXTRACTION', 'VALIDATION', 'COVERAGE')),
  state text NOT NULL CHECK (state IN ('OPEN', 'RESOLVED')),
  family_key text,
  structure_node_id text,
  proposal_id text,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, issue_id),
  FOREIGN KEY (run_id, proposal_id) REFERENCES public.product_proposals(run_id, proposal_id)
);

CREATE TABLE public.product_coverage_assertions (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  coverage_assertion_id text NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('FAMILY', 'FACT_TYPE', 'ROLE', 'SECTION', 'SECTION_FAMILY', 'RESIDUAL_PARAGRAPH')),
  subject_id text NOT NULL,
  family_key text,
  structure_node_id text,
  model_call_id text,
  state text NOT NULL CHECK (state IN ('FOUND', 'NOT_FOUND', 'UNRESOLVED', 'NOT_RUN')),
  lawyer_confirmed boolean NOT NULL DEFAULT false CHECK (lawyer_confirmed = false),
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, coverage_assertion_id),
  UNIQUE (run_id, subject_kind, subject_id),
  FOREIGN KEY (run_id, model_call_id) REFERENCES public.product_model_calls(run_id, model_call_id)
);

CREATE TABLE public.product_section_results (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  structure_node_id text NOT NULL,
  section_result_id text NOT NULL,
  section_routing_id text NOT NULL,
  source_closure_id text NOT NULL,
  payload_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, structure_node_id),
  UNIQUE (run_id, section_result_id),
  FOREIGN KEY (run_id, section_routing_id) REFERENCES public.product_section_routings(run_id, section_routing_id),
  FOREIGN KEY (run_id, source_closure_id) REFERENCES public.product_source_closures(run_id, source_closure_id)
);

CREATE TABLE public.product_residual_passes (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  residual_pass_id text NOT NULL,
  structure_node_id text NOT NULL,
  model_call_id text NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (run_id, residual_pass_id),
  UNIQUE (run_id, structure_node_id),
  FOREIGN KEY (run_id, model_call_id) REFERENCES public.product_model_calls(run_id, model_call_id)
);

CREATE TRIGGER product_draft_analyses_immutable BEFORE UPDATE OR DELETE ON public.product_draft_analyses
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_model_calls_immutable BEFORE UPDATE OR DELETE ON public.product_model_calls
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_source_closures_immutable BEFORE UPDATE OR DELETE ON public.product_source_closures
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_source_spans_immutable BEFORE UPDATE OR DELETE ON public.product_source_spans
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_source_closure_spans_immutable BEFORE UPDATE OR DELETE ON public.product_source_closure_spans
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_section_routings_immutable BEFORE UPDATE OR DELETE ON public.product_section_routings
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_proposition_groups_immutable BEFORE UPDATE OR DELETE ON public.product_proposition_groups
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_proposals_immutable BEFORE UPDATE OR DELETE ON public.product_proposals
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_proposal_spans_immutable BEFORE UPDATE OR DELETE ON public.product_proposal_spans
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_fact_links_immutable BEFORE UPDATE OR DELETE ON public.product_fact_links
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_fact_link_spans_immutable BEFORE UPDATE OR DELETE ON public.product_fact_link_spans
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_issues_immutable BEFORE UPDATE OR DELETE ON public.product_issues
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_coverage_assertions_immutable BEFORE UPDATE OR DELETE ON public.product_coverage_assertions
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_section_results_immutable BEFORE UPDATE OR DELETE ON public.product_section_results
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_residual_passes_immutable BEFORE UPDATE OR DELETE ON public.product_residual_passes
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();

CREATE FUNCTION product_private.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  run_row public.product_analysis_runs;
  work_row public.product_section_work;
  existing_result public.product_section_results;
  item jsonb;
  nested_record record;
  source_text text;
  payload_hash text;
  result_cost bigint := 0;
  result_input bigint := 0;
  result_output bigint := 0;
BEGIN
  IF coalesce(p_worker_id, '') = '' OR p_result->>'schema_version' <> 'AGREEMENT_SECTION_DRAFT/V1'
    OR p_result->>'section_result_id' !~ '^[0-9a-f]{64}$' OR p_result->>'node_id' <> p_node_id
    OR coalesce(p_result->'residual_pass'->>'schema_version', '') <> 'PRODUCT_PARAGRAPH_RESIDUAL_PASS/V1'
    OR coalesce(p_result->'residual_pass'->>'structure_node_id', '') <> p_node_id
    OR coalesce(p_result->'residual_pass'->>'residual_pass_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_result->'residual_pass'->>'model_call_id', '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid section draft input' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO work_row FROM public.product_section_work WHERE run_id = p_run_id AND node_id = p_node_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'section work not found' USING ERRCODE = '23503'; END IF;
  SELECT * INTO existing_result FROM public.product_section_results WHERE run_id = p_run_id AND structure_node_id = p_node_id;
  payload_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_result::text, 'UTF8'), 'sha256'::text), 'hex');
  IF FOUND THEN
    IF existing_result.section_result_id <> p_result->>'section_result_id' OR existing_result.payload_sha256 <> payload_hash THEN
      RAISE EXCEPTION 'section draft collision' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
    RETURN jsonb_build_object('work', to_jsonb(work_row), 'run', to_jsonb(run_row));
  END IF;
  IF work_row.status <> 'RUNNING' OR work_row.worker_id <> p_worker_id OR work_row.attempt_token <> p_attempt_token
    OR work_row.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'stale section attempt' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
  SELECT payload->>'canonical_text' INTO source_text FROM public.product_source_documents
    WHERE source_document_id = run_row.source_document_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.product_run_structures rs JOIN public.product_agreement_structures s ON s.structure_id = rs.structure_id,
      jsonb_array_elements(s.payload->'nodes') n
    WHERE rs.run_id = p_run_id AND n->>'node_id' = p_node_id AND n->>'kind' = 'SECTION'
      AND coalesce(n->>'reference', '') <> '' AND n->>'reference' !~ '-INTRO$'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->'nodes') child
        WHERE child->>'kind' = 'SECTION' AND child->>'node_id' <> n->>'node_id'
          AND child->>'reference' LIKE (n->>'reference') || '::%'
      )
  ) THEN RAISE EXCEPTION 'section draft node is not substantive' USING ERRCODE = '22023'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'model_calls') LOOP
    INSERT INTO public.product_model_calls(run_id, model_call_id, structure_node_id, call_kind, prompt_version,
      provider_id, model_id, request, response, input_tokens, output_tokens, cost_microusd, duration_ms)
    VALUES (p_run_id, item->>'model_call_id', p_node_id, item->>'call_kind', item->>'prompt_version',
      item->>'provider_id', item->>'model_id', item->'request', item->'response',
      (item->>'input_tokens')::bigint, (item->>'output_tokens')::bigint,
      (item->>'cost_microusd')::bigint, (item->>'duration_ms')::bigint);
    result_cost := result_cost + (item->>'cost_microusd')::bigint;
    result_input := result_input + (item->>'input_tokens')::bigint;
    result_output := result_output + (item->>'output_tokens')::bigint;
  END LOOP;
  item := p_result->'source_closure';
  INSERT INTO public.product_source_closures(run_id, source_closure_id, structure_node_id, section_reference, payload)
  VALUES (p_run_id, item->>'source_closure_id', p_node_id, item->>'section_reference', item - 'spans');
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'spans') LOOP
    IF item->>'source_document_id' <> run_row.source_document_id
      OR item->>'text_sha256' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(item->>'exact_text', 'UTF8'), 'sha256'::text), 'hex')
      OR pg_catalog.octet_length(pg_catalog.convert_to(item->>'exact_text', 'UTF8')) <> (item->>'end_byte')::bigint - (item->>'start_byte')::bigint
      OR pg_catalog.substring(pg_catalog.convert_to(source_text, 'UTF8'), (item->>'start_byte')::integer + 1,
        (item->>'end_byte')::integer - (item->>'start_byte')::integer) <> pg_catalog.convert_to(item->>'exact_text', 'UTF8') THEN
      RAISE EXCEPTION 'source span bytes do not match' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_source_spans(run_id, span_id, source_document_id, structure_node_id, kind,
      coordinate_system, start_byte, end_byte, text_sha256, exact_text)
    VALUES (p_run_id, item->>'span_id', item->>'source_document_id', item->>'structure_node_id', item->>'kind',
      item->>'coordinate_system', (item->>'start_byte')::bigint, (item->>'end_byte')::bigint,
      item->>'text_sha256', item->>'exact_text') ON CONFLICT (run_id, span_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.product_source_spans s WHERE s.run_id = p_run_id AND s.span_id = item->>'span_id'
      AND s.source_document_id = item->>'source_document_id' AND s.start_byte = (item->>'start_byte')::bigint
      AND s.end_byte = (item->>'end_byte')::bigint AND s.text_sha256 = item->>'text_sha256' AND s.exact_text = item->>'exact_text') THEN
      RAISE EXCEPTION 'source span collision' USING ERRCODE = '23505';
    END IF;
  END LOOP;
  item := p_result->'source_closure';
  FOR nested_record IN SELECT DISTINCT value->>'span_id' AS span_id FROM jsonb_array_elements(p_result->'spans') LOOP
    INSERT INTO public.product_source_closure_spans(run_id, source_closure_id, span_id)
    VALUES (p_run_id, item->>'source_closure_id', nested_record.span_id);
  END LOOP;
  item := p_result->'routing';
  INSERT INTO public.product_section_routings(run_id, section_routing_id, structure_node_id, model_call_id,
    authored_order, disposition, families, payload)
  VALUES (p_run_id, item->>'section_routing_id', p_node_id, item->>'model_call_id', work_row.authored_order,
    item->>'disposition', item->'families', item);
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'groups') LOOP
    INSERT INTO public.product_proposition_groups(run_id, proposition_group_id, structure_node_id, source_closure_id,
      family_key, subtype_key, payload)
    VALUES (p_run_id, item->>'proposition_group_id', p_node_id, item->>'source_closure_id', item->>'family_key', item->>'subtype_key', item);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'proposals') LOOP
    INSERT INTO public.product_proposals(run_id, proposal_id, fact_occurrence_id, structure_node_id, model_call_id,
      source_closure_id, proposition_group_id, family_key, subtype_key, fact_type, state, validation_status, payload)
    VALUES (p_run_id, item->>'proposal_id', item->>'fact_occurrence_id', p_node_id, item->>'model_call_id',
      item->>'source_closure_id', item->>'proposition_group_id', item->>'family_key', item->>'subtype_key',
      item->>'fact_type', item->>'state', item->>'validation_status', item);
    FOR nested_record IN SELECT value #>> '{}' AS span_id, ordinality - 1 AS ordinal
      FROM jsonb_array_elements(item->'source_span_ids') WITH ORDINALITY LOOP
      IF NOT EXISTS (SELECT 1 FROM public.product_source_closure_spans cs WHERE cs.run_id = p_run_id
        AND cs.source_closure_id = item->>'source_closure_id' AND cs.span_id = nested_record.span_id) THEN
        RAISE EXCEPTION 'proposal span is outside source closure' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.product_proposal_spans(run_id, proposal_id, span_id, ordinal)
      VALUES (p_run_id, item->>'proposal_id', nested_record.span_id, nested_record.ordinal);
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'links') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_proposals fp JOIN public.product_proposals tp
        ON tp.run_id = fp.run_id AND tp.proposal_id = item->>'to_proposal_id'
      WHERE fp.run_id = p_run_id AND fp.proposal_id = item->>'from_proposal_id'
        AND fp.source_closure_id = tp.source_closure_id
    ) THEN RAISE EXCEPTION 'fact link endpoints are outside one source closure' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.product_fact_links(run_id, fact_link_id, from_proposal_id, to_proposal_id, relationship_type, payload)
    VALUES (p_run_id, item->>'fact_link_id', item->>'from_proposal_id', item->>'to_proposal_id', item->>'relationship_type', item);
    FOR nested_record IN SELECT value #>> '{}' AS span_id, ordinality - 1 AS ordinal
      FROM jsonb_array_elements(item->'source_span_ids') WITH ORDINALITY LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.product_proposals fp JOIN public.product_source_closure_spans cs
          ON cs.run_id = fp.run_id AND cs.source_closure_id = fp.source_closure_id
        WHERE fp.run_id = p_run_id AND fp.proposal_id = item->>'from_proposal_id'
          AND cs.span_id = nested_record.span_id
      ) THEN RAISE EXCEPTION 'fact link span is outside source closure' USING ERRCODE = '22023'; END IF;
      INSERT INTO public.product_fact_link_spans(run_id, fact_link_id, span_id, ordinal)
      VALUES (p_run_id, item->>'fact_link_id', nested_record.span_id, nested_record.ordinal);
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'issues') LOOP
    INSERT INTO public.product_issues(run_id, issue_id, kind, state, family_key, structure_node_id, proposal_id, payload)
    VALUES (p_run_id, item->>'issue_id', item->>'kind', item->>'state', item->>'family_key', item->>'structure_node_id', item->>'proposal_id', item);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_result->'coverage') LOOP
    INSERT INTO public.product_coverage_assertions(run_id, coverage_assertion_id, subject_kind, subject_id, family_key,
      structure_node_id, model_call_id, state, lawyer_confirmed, payload)
    VALUES (p_run_id, item->>'coverage_assertion_id', item->>'subject_kind', item->>'subject_id', item->>'family_key',
      item->>'structure_node_id', item->>'model_call_id', item->>'state', false, item);
  END LOOP;
  item := p_result->'residual_pass';
  INSERT INTO public.product_residual_passes(run_id, residual_pass_id, structure_node_id, model_call_id, payload)
  VALUES (p_run_id, item->>'residual_pass_id', p_node_id, item->>'model_call_id', item);
  INSERT INTO public.product_section_results(run_id, structure_node_id, section_result_id, section_routing_id,
    source_closure_id, payload_sha256)
  VALUES (p_run_id, p_node_id, p_result->>'section_result_id', p_result->'routing'->>'section_routing_id',
    p_result->'source_closure'->>'source_closure_id', payload_hash);
  UPDATE public.product_section_work SET status = 'COMPLETE', lease_expires_at = NULL, error = NULL,
    cost_microusd = cost_microusd + result_cost, input_tokens = input_tokens + result_input,
    output_tokens = output_tokens + result_output, completed_at = now()
  WHERE run_id = p_run_id AND node_id = p_node_id RETURNING * INTO work_row;
  UPDATE public.product_analysis_runs SET status = 'RUNNING', stage = CASE WHEN EXISTS (
    SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE'
  ) THEN 'SECTION_ANALYSIS' ELSE 'DRAFT_FINALIZATION' END, updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('work', to_jsonb(work_row), 'run', to_jsonb(run_row));
END;
$$;

CREATE FUNCTION product_private.product_phase2_get_analysis(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run_row public.product_analysis_runs; source_row public.product_source_documents;
DECLARE structure_row public.product_agreement_structures; draft_row public.product_drafts; analysis_row public.product_draft_analyses;
DECLARE progress jsonb;
BEGIN
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT jsonb_build_object('total', count(*), 'completed', count(*) FILTER (WHERE status = 'COMPLETE'),
    'failed', count(*) FILTER (WHERE status = 'FAILED'), 'cost_microusd', coalesce(sum(cost_microusd), 0),
    'input_tokens', coalesce(sum(input_tokens), 0), 'output_tokens', coalesce(sum(output_tokens), 0)) INTO progress
  FROM public.product_section_work WHERE run_id = p_run_id;
  SELECT * INTO source_row FROM public.product_source_documents WHERE source_document_id = run_row.source_document_id;
  SELECT * INTO analysis_row FROM public.product_draft_analyses WHERE run_id = p_run_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('schema_version', 'AGREEMENT_ANALYSIS_READ/V1', 'kind', 'runStatus',
      'analysis_run_id', p_run_id, 'status', run_row.status, 'stage', run_row.stage,
      'progress', progress, 'error', run_row.error,
      'source_identity', jsonb_build_object('retrieval_url', source_row.retrieval_url,
        'filing_accession', source_row.payload->>'filing_accession', 'exhibit_filename', source_row.payload->>'exhibit_filename',
        'parties', source_row.payload->'parties', 'agreement_date', source_row.payload->>'agreement_date',
        'revision_status', source_row.payload->>'revision_status'),
      'identity_review', (SELECT jsonb_build_object('status', status, 'reasons', coalesce(reasons->'reasons', reasons))
        FROM public.product_document_identity_reviews WHERE run_id = p_run_id));
  END IF;
  SELECT s.* INTO structure_row FROM public.product_run_structures rs JOIN public.product_agreement_structures s
    ON s.structure_id = rs.structure_id WHERE rs.run_id = p_run_id;
  SELECT * INTO draft_row FROM public.product_drafts WHERE run_id = p_run_id;
  RETURN jsonb_build_object(
    'schema_version', 'AGREEMENT_ANALYSIS_READ/V1', 'kind', 'draftAnalysis', 'analysis_run_id', p_run_id,
    'status', run_row.status, 'stage', run_row.stage, 'progress', progress,
    'draft_analysis_id', analysis_row.draft_analysis_id, 'legal_schema_version', analysis_row.legal_schema_version,
    'source_document', jsonb_build_object('source_document_id', source_row.source_document_id,
      'retrieval_url', source_row.retrieval_url, 'filing_accession', source_row.payload->>'filing_accession',
      'exhibit_filename', source_row.payload->>'exhibit_filename', 'parties', source_row.payload->'parties',
      'agreement_date', source_row.payload->>'agreement_date', 'revision_status', source_row.payload->>'revision_status'),
    'agreement_structure', structure_row.payload,
    'sections', coalesce((SELECT jsonb_agg(payload ORDER BY authored_order) FROM public.product_section_routings WHERE run_id = p_run_id), '[]'::jsonb),
    'residual_passes', coalesce(draft_row.state->'residual_passes', '[]'::jsonb),
    'model_calls', coalesce((SELECT jsonb_agg(jsonb_build_object('model_call_id', model_call_id, 'structure_node_id', structure_node_id,
      'call_kind', call_kind, 'prompt_version', prompt_version, 'provider_id', provider_id, 'model_id', model_id,
      'input_tokens', input_tokens, 'output_tokens', output_tokens, 'cost_microusd', cost_microusd, 'duration_ms', duration_ms)
      ORDER BY created_at, model_call_id) FROM public.product_model_calls WHERE run_id = p_run_id), '[]'::jsonb),
    'source_closures', coalesce((SELECT jsonb_agg(payload ORDER BY section_reference, source_closure_id) FROM public.product_source_closures WHERE run_id = p_run_id), '[]'::jsonb),
    'spans', coalesce((SELECT jsonb_agg(jsonb_build_object('span_id', span_id, 'source_closure_ids',
      (SELECT coalesce(jsonb_agg(cs.source_closure_id ORDER BY cs.source_closure_id), '[]'::jsonb)
        FROM public.product_source_closure_spans cs WHERE cs.run_id = s.run_id AND cs.span_id = s.span_id),
      'source_document_id', source_document_id, 'structure_node_id', structure_node_id, 'kind', kind,
      'coordinate_system', coordinate_system, 'start_byte', start_byte, 'end_byte', end_byte,
      'text_sha256', text_sha256, 'exact_text', exact_text) ORDER BY start_byte, end_byte, span_id)
      FROM public.product_source_spans s WHERE run_id = p_run_id), '[]'::jsonb),
    'proposition_groups', coalesce((SELECT jsonb_agg(payload || jsonb_build_object('structure_node_id', structure_node_id)
      ORDER BY proposition_group_id) FROM public.product_proposition_groups WHERE run_id = p_run_id), '[]'::jsonb),
    'proposals', coalesce((SELECT jsonb_agg(payload || jsonb_build_object('structure_node_id', structure_node_id)
      ORDER BY family_key, subtype_key, proposal_id) FROM public.product_proposals WHERE run_id = p_run_id), '[]'::jsonb),
    'fact_links', coalesce((SELECT jsonb_agg(payload ORDER BY fact_link_id) FROM public.product_fact_links WHERE run_id = p_run_id), '[]'::jsonb),
    'issues', coalesce((SELECT jsonb_agg(payload ORDER BY kind, issue_id) FROM public.product_issues WHERE run_id = p_run_id), '[]'::jsonb),
    'coverage_assertions', coalesce((SELECT jsonb_agg(payload ORDER BY subject_kind, subject_id) FROM public.product_coverage_assertions WHERE run_id = p_run_id), '[]'::jsonb),
    'review_revision', jsonb_build_object('draft_id', draft_row.draft_id, 'version', draft_row.version, 'state', draft_row.state)
  );
END;
$$;

CREATE FUNCTION product_private.product_phase2_finalize_draft(p_run_id uuid, p_draft jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run_row public.product_analysis_runs; structure_id text; draft_row public.product_drafts;
DECLARE existing public.product_draft_analyses; payload_hash text; expected_sections integer; item jsonb; next_version integer;
BEGIN
  IF p_draft->>'schema_version' <> 'AGREEMENT_DRAFT/V1' OR p_draft->>'draft_analysis_id' !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid AgreementDraft' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  SELECT rs.structure_id INTO structure_id FROM public.product_run_structures rs WHERE rs.run_id = p_run_id;
  IF run_row.source_document_id <> p_draft->>'source_document_id' OR structure_id <> p_draft->>'agreement_structure_id'
    OR run_row.schema_version <> p_draft->>'legal_schema_version' THEN
    RAISE EXCEPTION 'AgreementDraft identity mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_document_identity_reviews WHERE run_id = p_run_id AND status = 'OPEN') THEN
    RAISE EXCEPTION 'document identity review is open' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE') THEN
    RAISE EXCEPTION 'section work is incomplete' USING ERRCODE = '55000';
  END IF;
  SELECT count(*) INTO expected_sections FROM public.product_run_structures rs
  JOIN public.product_agreement_structures a ON a.structure_id = rs.structure_id,
  jsonb_array_elements(a.payload->'nodes') n
  WHERE rs.run_id = p_run_id AND n->>'kind' = 'SECTION'
    AND coalesce(n->>'reference', '') <> '' AND n->>'reference' !~ '-INTRO$'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.payload->'nodes') child
      WHERE child->>'kind' = 'SECTION' AND child->>'node_id' <> n->>'node_id'
        AND child->>'reference' LIKE (n->>'reference') || '::%'
    );
  IF expected_sections <> jsonb_array_length(p_draft->'sections')
    OR expected_sections <> jsonb_array_length(p_draft->'residual_passes')
    OR expected_sections <> (SELECT count(*) FROM public.product_section_results WHERE run_id = p_run_id)
    OR expected_sections <> (SELECT count(*) FROM public.product_residual_passes WHERE run_id = p_run_id)
    OR EXISTS (SELECT 1 FROM public.product_residual_passes r WHERE r.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'residual_passes') j
      WHERE j->>'residual_pass_id' = r.residual_pass_id AND j = r.payload))
    OR EXISTS (
      SELECT 1 FROM public.product_run_structures rs
      JOIN public.product_agreement_structures a ON a.structure_id = rs.structure_id,
      jsonb_array_elements(a.payload->'nodes') n
      WHERE rs.run_id = p_run_id AND n->>'kind' = 'SECTION'
        AND coalesce(n->>'reference', '') <> '' AND n->>'reference' !~ '-INTRO$'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(a.payload->'nodes') child
          WHERE child->>'kind' = 'SECTION' AND child->>'node_id' <> n->>'node_id'
            AND child->>'reference' LIKE (n->>'reference') || '::%'
        )
        AND NOT EXISTS (SELECT 1 FROM public.product_section_results r
          WHERE r.run_id = p_run_id AND r.structure_node_id = n->>'node_id')
    ) OR EXISTS (
    SELECT 1 FROM public.product_section_results r WHERE r.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'sections') s
      WHERE s->>'node_id' = r.structure_node_id AND s->>'section_routing_id' = r.section_routing_id
        AND s->>'source_closure_id' = r.source_closure_id
    )
  ) THEN RAISE EXCEPTION 'AgreementDraft section set mismatch' USING ERRCODE = '22023'; END IF;

  IF (SELECT count(*) FROM public.product_model_calls WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'model_calls')
    OR EXISTS (SELECT 1 FROM public.product_model_calls c WHERE c.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'model_calls') j WHERE j->>'model_call_id' = c.model_call_id
        AND j->>'structure_node_id' = c.structure_node_id AND j->>'call_kind' = c.call_kind
        AND j->>'prompt_version' = c.prompt_version AND j->>'provider_id' = c.provider_id
        AND j->>'model_id' = c.model_id AND j->'request' = c.request AND j->'response' = c.response
        AND (j->>'input_tokens')::bigint = c.input_tokens AND (j->>'output_tokens')::bigint = c.output_tokens
        AND (j->>'cost_microusd')::bigint = c.cost_microusd AND (j->>'duration_ms')::bigint = c.duration_ms))
    OR (SELECT count(*) FROM public.product_section_routings WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'section_routings')
    OR EXISTS (SELECT 1 FROM public.product_section_routings r WHERE r.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'section_routings') j WHERE j->>'section_routing_id' = r.section_routing_id AND j = r.payload))
    OR (SELECT count(*) FROM public.product_source_closures WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'source_closures')
    OR EXISTS (SELECT 1 FROM public.product_source_closures c WHERE c.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'source_closures') j WHERE j->>'source_closure_id' = c.source_closure_id AND j - 'spans' = c.payload))
    OR (SELECT count(*) FROM public.product_source_spans WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'spans')
    OR EXISTS (SELECT 1 FROM public.product_source_spans s WHERE s.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'spans') j WHERE j->>'span_id' = s.span_id
        AND j->>'source_document_id' = s.source_document_id AND j->>'structure_node_id' = s.structure_node_id
        AND j->>'kind' = s.kind AND j->>'coordinate_system' = s.coordinate_system
        AND (j->>'start_byte')::bigint = s.start_byte AND (j->>'end_byte')::bigint = s.end_byte
        AND j->>'text_sha256' = s.text_sha256 AND j->>'exact_text' = s.exact_text))
    OR (SELECT count(*) FROM public.product_source_closure_spans WHERE run_id = p_run_id) <>
      (SELECT count(*) FROM jsonb_array_elements(p_draft->'source_closures') c, jsonb_array_elements(c->'spans'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft->'source_closures') c,
      jsonb_array_elements(c->'spans') s WHERE NOT EXISTS (
        SELECT 1 FROM public.product_source_closure_spans cs WHERE cs.run_id = p_run_id
          AND cs.source_closure_id = c->>'source_closure_id' AND cs.span_id = s->>'span_id'))
    OR (SELECT count(*) FROM public.product_proposals WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'proposals')
    OR EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'proposals') j WHERE j->>'proposal_id' = p.proposal_id AND j = p.payload))
    OR (SELECT count(*) FROM public.product_proposal_spans WHERE run_id = p_run_id) <>
      (SELECT count(*) FROM jsonb_array_elements(p_draft->'proposals') p, jsonb_array_elements(p->'source_span_ids'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft->'proposals') p,
      jsonb_array_elements(p->'source_span_ids') WITH ORDINALITY s(value, ordinality) WHERE NOT EXISTS (
        SELECT 1 FROM public.product_proposal_spans ps WHERE ps.run_id = p_run_id
          AND ps.proposal_id = p->>'proposal_id' AND ps.span_id = s.value #>> '{}'
          AND ps.ordinal = s.ordinality - 1))
    OR (SELECT count(*) FROM public.product_fact_links WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'fact_links')
    OR EXISTS (SELECT 1 FROM public.product_fact_links l WHERE l.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'fact_links') j WHERE j->>'fact_link_id' = l.fact_link_id AND j = l.payload))
    OR (SELECT count(*) FROM public.product_fact_link_spans WHERE run_id = p_run_id) <>
      (SELECT count(*) FROM jsonb_array_elements(p_draft->'fact_links') l, jsonb_array_elements(l->'source_span_ids'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_draft->'fact_links') l,
      jsonb_array_elements(l->'source_span_ids') WITH ORDINALITY s(value, ordinality) WHERE NOT EXISTS (
        SELECT 1 FROM public.product_fact_link_spans ls WHERE ls.run_id = p_run_id
          AND ls.fact_link_id = l->>'fact_link_id' AND ls.span_id = s.value #>> '{}'
          AND ls.ordinal = s.ordinality - 1))
    OR (SELECT count(*) FROM public.product_proposition_groups WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'proposition_groups')
    OR EXISTS (SELECT 1 FROM public.product_proposition_groups g WHERE g.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'proposition_groups') j WHERE j->>'proposition_group_id' = g.proposition_group_id AND j = g.payload)) THEN
    RAISE EXCEPTION 'AgreementDraft component set mismatch' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_draft->'issues') WHERE value->>'structure_node_id' IS NULL LOOP
    INSERT INTO public.product_issues(run_id, issue_id, kind, state, family_key, structure_node_id, proposal_id, payload)
    VALUES (p_run_id, item->>'issue_id', item->>'kind', item->>'state', item->>'family_key', NULL, NULL, item)
    ON CONFLICT (run_id, issue_id) DO NOTHING;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_draft->'coverage_assertions') WHERE value->>'structure_node_id' IS NULL LOOP
    INSERT INTO public.product_coverage_assertions(run_id, coverage_assertion_id, subject_kind, subject_id, family_key,
      structure_node_id, model_call_id, state, lawyer_confirmed, payload)
    VALUES (p_run_id, item->>'coverage_assertion_id', item->>'subject_kind', item->>'subject_id', item->>'family_key',
      NULL, NULL, item->>'state', false, item) ON CONFLICT (run_id, coverage_assertion_id) DO NOTHING;
  END LOOP;
  IF (SELECT count(*) FROM public.product_issues WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'issues')
    OR EXISTS (SELECT 1 FROM public.product_issues i WHERE i.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'issues') j WHERE j->>'issue_id' = i.issue_id AND j = i.payload))
    OR (SELECT count(*) FROM public.product_coverage_assertions WHERE run_id = p_run_id) <> jsonb_array_length(p_draft->'coverage_assertions')
    OR EXISTS (SELECT 1 FROM public.product_coverage_assertions c WHERE c.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_draft->'coverage_assertions') j
      WHERE j->>'coverage_assertion_id' = c.coverage_assertion_id AND j = c.payload)) THEN
    RAISE EXCEPTION 'AgreementDraft issue or coverage set mismatch' USING ERRCODE = '22023';
  END IF;

  payload_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_draft::text, 'UTF8'), 'sha256'::text), 'hex');
  SELECT * INTO existing FROM public.product_draft_analyses WHERE run_id = p_run_id;
  IF FOUND THEN
    IF existing.draft_analysis_id <> p_draft->>'draft_analysis_id' OR existing.payload_sha256 <> payload_hash THEN
      RAISE EXCEPTION 'AgreementDraft collision' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('run', to_jsonb(run_row), 'draft_analysis_id', existing.draft_analysis_id);
  END IF;
  INSERT INTO public.product_draft_analyses(run_id, draft_analysis_id, legal_schema_version, payload_sha256)
  VALUES (p_run_id, p_draft->>'draft_analysis_id', p_draft->>'legal_schema_version', payload_hash);
  SELECT * INTO draft_row FROM public.product_drafts WHERE run_id = p_run_id FOR UPDATE;
  next_version := draft_row.version + 1;
  UPDATE public.product_drafts SET version = next_version,
    state = jsonb_build_object('schema_version', 'PRODUCT_DRAFT_STATE/V1', 'draft_analysis_id', p_draft->>'draft_analysis_id',
      'product_state', 'DRAFT', 'open_issue_count', jsonb_array_length(p_draft->'issues'), 'totals', p_draft->'totals',
      'residual_passes', p_draft->'residual_passes'),
    updated_at = now() WHERE draft_id = draft_row.draft_id RETURNING * INTO draft_row;
  INSERT INTO public.product_draft_revisions(draft_id, version, state, actor)
  VALUES (draft_row.draft_id, next_version, draft_row.state, 'system:phase2');
  INSERT INTO public.product_draft_audit_events(draft_id, version, actor, event_type)
  VALUES (draft_row.draft_id, next_version, 'system:phase2', 'SAVE');
  UPDATE public.product_analysis_runs SET status = 'READY', stage = 'READY', error = NULL, updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('run', to_jsonb(run_row), 'draft_analysis_id', p_draft->>'draft_analysis_id');
END;
$$;

CREATE FUNCTION public.product_phase2_commit_section(
  p_run_id uuid, p_node_id text, p_worker_id text, p_attempt_token uuid, p_result jsonb
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_commit_section(p_run_id, p_node_id, p_worker_id, p_attempt_token, p_result)
$$;

CREATE FUNCTION public.product_phase2_get_analysis(p_run_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_get_analysis(p_run_id)
$$;

CREATE FUNCTION public.product_phase2_finalize_draft(p_run_id uuid, p_draft jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_finalize_draft(p_run_id, p_draft)
$$;

ALTER TABLE public.product_draft_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_model_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_source_closure_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_section_routings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_proposition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_proposal_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_fact_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_fact_link_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_coverage_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_section_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_residual_passes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.product_draft_analyses, public.product_model_calls, public.product_source_closures,
  public.product_source_spans, public.product_source_closure_spans, public.product_section_routings, public.product_proposition_groups,
  public.product_proposals, public.product_proposal_spans, public.product_fact_links,
  public.product_fact_link_spans, public.product_issues, public.product_coverage_assertions, public.product_section_results,
  public.product_residual_passes
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_draft_analyses, public.product_model_calls, public.product_source_closures,
  public.product_source_spans, public.product_source_closure_spans, public.product_section_routings, public.product_proposition_groups,
  public.product_proposals, public.product_proposal_spans, public.product_fact_links,
  public.product_fact_link_spans, public.product_issues, public.product_coverage_assertions, public.product_section_results,
  public.product_residual_passes TO service_role;

REVOKE ALL ON FUNCTION public.product_phase2_get_analysis(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_finalize_draft(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_get_analysis(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase2_finalize_draft(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA product_private TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_get_analysis(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_finalize_draft(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_get_analysis(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_finalize_draft(uuid,jsonb) TO service_role;
