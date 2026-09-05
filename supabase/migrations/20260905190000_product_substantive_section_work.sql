CREATE OR REPLACE FUNCTION public.product_phase1_attach_structure(
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

CREATE OR REPLACE FUNCTION public.product_phase1_resolve_identity(p_run_id uuid, p_resolution jsonb) RETURNS jsonb
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

DO $$
DECLARE definition text;
DECLARE old_condition text := 'AND n->>''kind'' = ''SECTION'' AND n->>''reference'' !~ ''-INTRO$''';
DECLARE commit_condition text := 'AND n->>''kind'' = ''SECTION''
      AND coalesce(n->>''reference'', '''') <> '''' AND n->>''reference'' !~ ''-INTRO$''
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.payload->''nodes'') child
        WHERE child->>''kind'' = ''SECTION'' AND child->>''node_id'' <> n->>''node_id''
          AND child->>''reference'' LIKE (n->>''reference'') || ''::%''
      )';
DECLARE finalize_condition text := 'AND n->>''kind'' = ''SECTION''
    AND coalesce(n->>''reference'', '''') <> '''' AND n->>''reference'' !~ ''-INTRO$''
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.payload->''nodes'') child
      WHERE child->>''kind'' = ''SECTION'' AND child->>''node_id'' <> n->>''node_id''
        AND child->>''reference'' LIKE (n->>''reference'') || ''::%''
    )';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_commit_section(uuid,text,text,uuid,jsonb)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, 'child->>''reference'' LIKE (n->>''reference'') || ''::%''') = 0 THEN
    IF pg_catalog.strpos(definition, old_condition) = 0 THEN
      RAISE EXCEPTION 'product_phase2_commit_section substantive predicate is not recognised';
    END IF;
    EXECUTE pg_catalog.replace(definition, old_condition, commit_condition);
  END IF;

  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_finalize_draft(uuid,jsonb)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, 'child->>''reference'' LIKE (n->>''reference'') || ''::%''') = 0 THEN
    IF pg_catalog.strpos(definition, old_condition) = 0 THEN
      RAISE EXCEPTION 'product_phase2_finalize_draft substantive predicate is not recognised';
    END IF;
    EXECUTE pg_catalog.replace(definition, old_condition, finalize_condition);
  END IF;
END;
$$;

DELETE FROM public.product_section_work work
USING public.product_run_structures mapping, public.product_agreement_structures structure
WHERE mapping.run_id = work.run_id
  AND structure.structure_id = mapping.structure_id
  AND work.status = 'PENDING'
  AND work.attempts = 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(structure.payload->'nodes') item
    WHERE item->>'node_id' = work.node_id
      AND (
        item->>'kind' <> 'SECTION'
        OR coalesce(item->>'reference', '') = ''
        OR item->>'reference' ~ '-INTRO$'
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(structure.payload->'nodes') child
          WHERE child->>'kind' = 'SECTION'
            AND child->>'node_id' <> item->>'node_id'
            AND child->>'reference' LIKE (item->>'reference') || '::%'
        )
      )
  );
