CREATE FUNCTION product_private.product_phase2_finalize_saved_run(
  p_run_id uuid, p_finalization jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  run_row public.product_analysis_runs;
  draft_row public.product_drafts;
  existing public.product_draft_analyses;
  expected_sections integer;
  item jsonb;
  next_version integer;
  summary_hash text;
  stored_totals jsonb;
  component_name text;
BEGIN
  IF coalesce(p_finalization->>'schema_version', '') <> 'PRODUCT_DRAFT_FINALIZATION/V1'
    OR coalesce(p_finalization->>'draft_analysis_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_finalization->>'source_document_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_finalization->>'agreement_structure_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(p_finalization->>'legal_schema_version', '') = ''
    OR coalesce(jsonb_typeof(p_finalization->'totals'), '') <> 'object'
    OR coalesce(jsonb_typeof(p_finalization->'global_issues'), '') <> 'array'
    OR coalesce(jsonb_typeof(p_finalization->'global_coverage_assertions'), '') <> 'array'
    OR coalesce(jsonb_typeof(p_finalization->'components'), '') <> 'object' THEN
    RAISE EXCEPTION 'invalid AgreementDraft finalization' USING ERRCODE = '22023';
  END IF;
  FOREACH component_name IN ARRAY ARRAY[
    'sections', 'residual_pass_ids', 'model_call_ids', 'source_closure_ids', 'span_ids',
    'source_closure_spans', 'section_routing_ids', 'proposition_group_ids', 'proposal_ids',
    'proposal_spans', 'fact_link_ids', 'fact_link_spans', 'section_issue_ids',
    'section_coverage_assertion_ids'
  ] LOOP
    IF coalesce(jsonb_typeof(p_finalization->'components'->component_name), '') <> 'array' THEN
      RAISE EXCEPTION 'invalid AgreementDraft finalization component %', component_name USING ERRCODE = '22023';
    END IF;
  END LOOP;

  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  IF run_row.source_document_id IS DISTINCT FROM p_finalization->>'source_document_id'
    OR run_row.schema_version IS DISTINCT FROM p_finalization->>'legal_schema_version'
    OR NOT EXISTS (
      SELECT 1 FROM public.product_run_structures rs
      WHERE rs.run_id = p_run_id AND rs.structure_id = p_finalization->>'agreement_structure_id'
    ) THEN
    RAISE EXCEPTION 'AgreementDraft identity mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_document_identity_reviews WHERE run_id = p_run_id AND status = 'OPEN') THEN
    RAISE EXCEPTION 'document identity review is open' USING ERRCODE = '55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE') THEN
    RAISE EXCEPTION 'section work is incomplete' USING ERRCODE = '55000';
  END IF;

  summary_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_finalization::text, 'UTF8'), 'sha256'::text), 'hex'
  );
  SELECT * INTO existing FROM public.product_draft_analyses WHERE run_id = p_run_id;
  IF FOUND THEN
    IF existing.draft_analysis_id IS DISTINCT FROM p_finalization->>'draft_analysis_id'
      OR existing.payload_sha256 IS DISTINCT FROM summary_hash THEN
      RAISE EXCEPTION 'AgreementDraft collision' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('run', to_jsonb(run_row), 'draft_analysis_id', existing.draft_analysis_id);
  END IF;

  SELECT count(*) INTO expected_sections
  FROM public.product_run_structures rs
  JOIN public.product_agreement_structures a ON a.structure_id = rs.structure_id,
  jsonb_array_elements(a.payload->'nodes') n
  WHERE rs.run_id = p_run_id AND n->>'kind' = 'SECTION'
    AND coalesce(n->>'reference', '') <> '' AND n->>'reference' !~ '-INTRO$'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.payload->'nodes') child
      WHERE child->>'kind' = 'SECTION' AND child->>'node_id' <> n->>'node_id'
        AND child->>'reference' LIKE (n->>'reference') || '::%'
    );

  IF expected_sections <> (SELECT count(*) FROM public.product_section_work WHERE run_id = p_run_id)
    OR expected_sections <> (SELECT count(*) FROM public.product_section_results WHERE run_id = p_run_id)
    OR expected_sections <> (SELECT count(*) FROM public.product_residual_passes WHERE run_id = p_run_id)
    OR expected_sections <> (SELECT count(*) FROM public.product_section_routings WHERE run_id = p_run_id)
    OR expected_sections <> (SELECT count(*) FROM public.product_source_closures WHERE run_id = p_run_id)
    OR p_finalization->'components'->'sections' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'node_id', structure_node_id,
        'section_routing_id', section_routing_id,
        'source_closure_id', source_closure_id
      ) ORDER BY structure_node_id)
      FROM public.product_section_results WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'residual_pass_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(residual_pass_id ORDER BY residual_pass_id)
      FROM public.product_residual_passes WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'model_call_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(model_call_id ORDER BY model_call_id)
      FROM public.product_model_calls WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'source_closure_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(source_closure_id ORDER BY source_closure_id)
      FROM public.product_source_closures WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'span_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(span_id ORDER BY span_id)
      FROM public.product_source_spans WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'source_closure_spans' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(jsonb_build_object('source_closure_id', source_closure_id, 'span_id', span_id)
        ORDER BY source_closure_id, span_id)
      FROM public.product_source_closure_spans WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'section_routing_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(section_routing_id ORDER BY section_routing_id)
      FROM public.product_section_routings WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'proposition_group_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(proposition_group_id ORDER BY proposition_group_id)
      FROM public.product_proposition_groups WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'proposal_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(proposal_id ORDER BY proposal_id)
      FROM public.product_proposals WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'proposal_spans' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(jsonb_build_object('proposal_id', proposal_id, 'span_id', span_id, 'ordinal', ordinal)
        ORDER BY proposal_id, span_id, ordinal)
      FROM public.product_proposal_spans WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'fact_link_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(fact_link_id ORDER BY fact_link_id)
      FROM public.product_fact_links WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'fact_link_spans' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(jsonb_build_object('fact_link_id', fact_link_id, 'span_id', span_id, 'ordinal', ordinal)
        ORDER BY fact_link_id, span_id, ordinal)
      FROM public.product_fact_link_spans WHERE run_id = p_run_id
    ), '[]'::jsonb)
    OR p_finalization->'components'->'section_issue_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(issue_id ORDER BY issue_id)
      FROM public.product_issues WHERE run_id = p_run_id AND structure_node_id IS NOT NULL
    ), '[]'::jsonb)
    OR p_finalization->'components'->'section_coverage_assertion_ids' IS DISTINCT FROM coalesce((
      SELECT jsonb_agg(coverage_assertion_id ORDER BY coverage_assertion_id)
      FROM public.product_coverage_assertions WHERE run_id = p_run_id AND structure_node_id IS NOT NULL
    ), '[]'::jsonb) THEN
    RAISE EXCEPTION 'AgreementDraft persisted component set mismatch' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_finalization->'global_issues') LOOP
    IF coalesce(item->>'issue_id', '') !~ '^[0-9a-f]{64}$' OR item->>'structure_node_id' IS NOT NULL THEN
      RAISE EXCEPTION 'invalid agreement-level issue' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_issues(run_id, issue_id, kind, state, family_key, structure_node_id, proposal_id, payload)
    VALUES (p_run_id, item->>'issue_id', item->>'kind', item->>'state', item->>'family_key', NULL, NULL, item)
    ON CONFLICT (run_id, issue_id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_issues stored
      WHERE stored.run_id = p_run_id AND stored.issue_id = item->>'issue_id'
        AND stored.structure_node_id IS NULL AND stored.payload = item
    ) THEN RAISE EXCEPTION 'agreement-level issue collision' USING ERRCODE = '23505'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(p_finalization->'global_coverage_assertions') LOOP
    IF coalesce(item->>'coverage_assertion_id', '') !~ '^[0-9a-f]{64}$' OR item->>'structure_node_id' IS NOT NULL THEN
      RAISE EXCEPTION 'invalid agreement-level coverage assertion' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_coverage_assertions(
      run_id, coverage_assertion_id, subject_kind, subject_id, family_key,
      structure_node_id, model_call_id, state, lawyer_confirmed, payload
    ) VALUES (
      p_run_id, item->>'coverage_assertion_id', item->>'subject_kind', item->>'subject_id', item->>'family_key',
      NULL, NULL, item->>'state', false, item
    ) ON CONFLICT (run_id, coverage_assertion_id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_coverage_assertions stored
      WHERE stored.run_id = p_run_id AND stored.coverage_assertion_id = item->>'coverage_assertion_id'
        AND stored.structure_node_id IS NULL AND stored.payload = item
    ) THEN RAISE EXCEPTION 'agreement-level coverage collision' USING ERRCODE = '23505'; END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.product_issues WHERE run_id = p_run_id AND structure_node_id IS NULL)
      <> jsonb_array_length(p_finalization->'global_issues')
    OR (SELECT count(*) FROM public.product_coverage_assertions WHERE run_id = p_run_id AND structure_node_id IS NULL)
      <> jsonb_array_length(p_finalization->'global_coverage_assertions') THEN
    RAISE EXCEPTION 'AgreementDraft agreement-level component set mismatch' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'substantive_sections', (SELECT count(*) FROM public.product_section_results WHERE run_id = p_run_id),
    'routed_sections', (SELECT count(*) FROM public.product_section_routings
      WHERE run_id = p_run_id AND jsonb_array_length(families) > 0),
    'model_calls', (SELECT count(*) FROM public.product_model_calls WHERE run_id = p_run_id),
    'proposals', (SELECT count(*) FROM public.product_proposals WHERE run_id = p_run_id),
    'residual_paragraphs', (SELECT coalesce(sum(jsonb_array_length(payload->'dispositions')), 0)
      FROM public.product_residual_passes WHERE run_id = p_run_id),
    'unresolved_unusual_provisions', (SELECT count(*) FROM public.product_issues
      WHERE run_id = p_run_id AND payload->>'code' = 'UNRESOLVED_UNUSUAL_PROVISION'),
    'open_issues', (SELECT count(*) FROM public.product_issues WHERE run_id = p_run_id),
    'cost_microusd', (SELECT coalesce(sum(cost_microusd), 0) FROM public.product_model_calls WHERE run_id = p_run_id),
    'input_tokens', (SELECT coalesce(sum(input_tokens), 0) FROM public.product_model_calls WHERE run_id = p_run_id),
    'output_tokens', (SELECT coalesce(sum(output_tokens), 0) FROM public.product_model_calls WHERE run_id = p_run_id)
  ) INTO stored_totals;
  IF stored_totals IS DISTINCT FROM p_finalization->'totals' THEN
    RAISE EXCEPTION 'AgreementDraft totals mismatch' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.product_draft_analyses(run_id, draft_analysis_id, legal_schema_version, payload_sha256)
  VALUES (p_run_id, p_finalization->>'draft_analysis_id', p_finalization->>'legal_schema_version', summary_hash);
  SELECT * INTO draft_row FROM public.product_drafts WHERE run_id = p_run_id FOR UPDATE;
  next_version := draft_row.version + 1;
  UPDATE public.product_drafts SET version = next_version,
    state = jsonb_build_object(
      'schema_version', 'PRODUCT_DRAFT_STATE/V1',
      'draft_analysis_id', p_finalization->>'draft_analysis_id',
      'product_state', 'DRAFT',
      'open_issue_count', (stored_totals->>'open_issues')::integer,
      'totals', stored_totals,
      'residual_passes', coalesce((
        SELECT jsonb_agg(r.payload ORDER BY routing.authored_order)
        FROM public.product_residual_passes r
        JOIN public.product_section_routings routing
          ON routing.run_id = r.run_id AND routing.structure_node_id = r.structure_node_id
        WHERE r.run_id = p_run_id
      ), '[]'::jsonb)
    ), updated_at = now()
  WHERE draft_id = draft_row.draft_id RETURNING * INTO draft_row;
  INSERT INTO public.product_draft_revisions(draft_id, version, state, actor)
  VALUES (draft_row.draft_id, next_version, draft_row.state, 'system:phase2');
  INSERT INTO public.product_draft_audit_events(draft_id, version, actor, event_type)
  VALUES (draft_row.draft_id, next_version, 'system:phase2', 'SAVE');
  UPDATE public.product_analysis_runs SET status = 'READY', stage = 'READY', error = NULL, updated_at = now()
  WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN jsonb_build_object('run', to_jsonb(run_row), 'draft_analysis_id', p_finalization->>'draft_analysis_id');
END;
$$;

CREATE FUNCTION public.product_phase2_finalize_saved_run(
  p_run_id uuid, p_finalization jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_finalize_saved_run(p_run_id, p_finalization)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_finalize_saved_run(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_finalize_saved_run(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_finalize_saved_run(uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_finalize_saved_run(uuid,jsonb)
  TO service_role;
