ALTER TABLE public.product_agreement_structures
  DROP CONSTRAINT product_agreement_structures_source_document_id_key;

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
    IF existing.structure_id IS DISTINCT FROM p_structure_id
      OR existing.payload IS DISTINCT FROM p_structure
      OR existing.payload_sha256 IS DISTINCT FROM structure_sha256 THEN
      RAISE EXCEPTION 'AgreementStructure collision' USING ERRCODE = '23505';
    END IF;
    IF (p_identity_review IS NULL) <> NOT EXISTS (
      SELECT 1 FROM public.product_document_identity_reviews WHERE run_id = p_run_id
    ) THEN
      RAISE EXCEPTION 'document identity review collision' USING ERRCODE = '23505';
    END IF;
    IF p_identity_review IS NOT NULL AND p_identity_review IS DISTINCT FROM (
      SELECT reasons FROM public.product_document_identity_reviews WHERE run_id = p_run_id
    ) THEN
      RAISE EXCEPTION 'document identity review collision' USING ERRCODE = '23505';
    END IF;
    RETURN to_jsonb(run_row);
  END IF;
  IF coalesce(p_structure->>'schema_version', '') <> 'AGREEMENT_STRUCTURE/V1'
    OR p_structure->>'agreement_id' IS DISTINCT FROM run_row.source_document_id
    OR coalesce(p_structure_id, '') !~ '^[0-9a-f]{64}$'
    OR coalesce(jsonb_typeof(p_structure->'nodes'), '') <> 'array' THEN
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

  INSERT INTO public.product_agreement_structures(structure_id, source_document_id, payload, payload_sha256)
  VALUES (p_structure_id, run_row.source_document_id, p_structure, structure_sha256)
  ON CONFLICT (structure_id) DO NOTHING;
  SELECT * INTO existing FROM public.product_agreement_structures WHERE structure_id = p_structure_id FOR SHARE;
  IF NOT FOUND OR existing.source_document_id IS DISTINCT FROM run_row.source_document_id
    OR existing.payload IS DISTINCT FROM p_structure
    OR existing.payload_sha256 IS DISTINCT FROM structure_sha256 THEN
    RAISE EXCEPTION 'AgreementStructure collision' USING ERRCODE = '23505';
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
