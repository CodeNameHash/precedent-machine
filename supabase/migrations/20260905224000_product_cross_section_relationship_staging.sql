CREATE FUNCTION product_private.product_phase2_stage_cross_section_relationships(
  p_run_id uuid, p_staging jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  run_row public.product_analysis_runs;
  source_text text;
  item jsonb;
  nested_record record;
BEGIN
  IF coalesce(p_staging->>'schema_version', '') <>
      'PRODUCT_CROSS_SECTION_RELATIONSHIP_STAGING/V1'
    OR coalesce(p_staging->>'source_document_id', '') !~ '^[0-9a-f]{64}$'
    OR coalesce(pg_catalog.jsonb_typeof(p_staging->'spans'), '') <> 'array'
    OR coalesce(pg_catalog.jsonb_typeof(p_staging->'source_closure_spans'), '') <> 'array'
    OR coalesce(pg_catalog.jsonb_typeof(p_staging->'links'), '') <> 'array' THEN
    RAISE EXCEPTION 'invalid cross-section relationship staging input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'analysis run not found' USING ERRCODE = '23503'; END IF;
  IF run_row.source_document_id IS DISTINCT FROM p_staging->>'source_document_id'
    OR EXISTS (SELECT 1 FROM public.product_section_work WHERE run_id = p_run_id AND status <> 'COMPLETE')
    OR EXISTS (SELECT 1 FROM public.product_draft_analyses WHERE run_id = p_run_id) THEN
    RAISE EXCEPTION 'cross-section relationships cannot be staged for this run' USING ERRCODE = '55000';
  END IF;
  SELECT payload->>'canonical_text' INTO source_text
  FROM public.product_source_documents WHERE source_document_id = run_row.source_document_id;
  IF source_text IS NULL THEN
    RAISE EXCEPTION 'cross-section relationship source text is unavailable' USING ERRCODE = '22023';
  END IF;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_staging->'spans') LOOP
    IF coalesce(item->>'schema_version', '') <> 'PRODUCT_SOURCE_SPAN/V1'
      OR coalesce(item->>'span_id', '') !~ '^[0-9a-f]{64}$'
      OR item->>'source_document_id' IS DISTINCT FROM run_row.source_document_id
      OR coalesce(item->>'kind', '') = ''
      OR coalesce(item->>'coordinate_system', '') <> 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      OR (item->>'start_byte')::bigint < 0
      OR (item->>'end_byte')::bigint <= (item->>'start_byte')::bigint
      OR item->>'text_sha256' IS DISTINCT FROM pg_catalog.encode(extensions.digest(
        pg_catalog.convert_to(item->>'exact_text', 'UTF8'), 'sha256'::text), 'hex')
      OR pg_catalog.octet_length(pg_catalog.convert_to(item->>'exact_text', 'UTF8')) <>
        (item->>'end_byte')::bigint - (item->>'start_byte')::bigint
      OR pg_catalog.substring(pg_catalog.convert_to(source_text, 'UTF8'),
        (item->>'start_byte')::integer + 1,
        (item->>'end_byte')::integer - (item->>'start_byte')::integer) <>
        pg_catalog.convert_to(item->>'exact_text', 'UTF8') THEN
      RAISE EXCEPTION 'cross-section relationship span does not match source' USING ERRCODE = '22023';
    END IF;
    IF coalesce(item->>'kind', '') <> 'SUPPORTING_EVIDENCE' AND NOT EXISTS (
      SELECT 1 FROM public.product_source_spans stored
      WHERE stored.run_id = p_run_id AND stored.span_id = item->>'span_id'
    ) THEN
      RAISE EXCEPTION 'cross-section relationship staging cannot create closure components'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_source_spans(
      run_id, span_id, source_document_id, structure_node_id, kind,
      coordinate_system, start_byte, end_byte, text_sha256, exact_text
    ) VALUES (
      p_run_id, item->>'span_id', item->>'source_document_id', item->>'structure_node_id',
      item->>'kind', item->>'coordinate_system', (item->>'start_byte')::bigint,
      (item->>'end_byte')::bigint, item->>'text_sha256', item->>'exact_text'
    ) ON CONFLICT (run_id, span_id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_source_spans stored
      WHERE stored.run_id = p_run_id AND stored.span_id = item->>'span_id'
        AND stored.source_document_id = item->>'source_document_id'
        AND stored.structure_node_id = item->>'structure_node_id'
        AND stored.kind = item->>'kind' AND stored.coordinate_system = item->>'coordinate_system'
        AND stored.start_byte = (item->>'start_byte')::bigint
        AND stored.end_byte = (item->>'end_byte')::bigint
        AND stored.text_sha256 = item->>'text_sha256' AND stored.exact_text = item->>'exact_text'
    ) THEN RAISE EXCEPTION 'cross-section relationship span collision' USING ERRCODE = '23505'; END IF;
  END LOOP;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_staging->'source_closure_spans') LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_source_closures closure
      JOIN public.product_source_spans span ON span.run_id = closure.run_id
        AND span.span_id = item->>'span_id'
      WHERE closure.run_id = p_run_id
        AND closure.source_closure_id = item->>'source_closure_id'
    ) THEN RAISE EXCEPTION 'cross-section relationship closure span mismatch' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_source_closure_spans stored
      WHERE stored.run_id = p_run_id
        AND stored.source_closure_id = item->>'source_closure_id'
        AND stored.span_id = item->>'span_id'
    ) AND EXISTS (
      SELECT 1 FROM public.product_source_spans span
      WHERE span.run_id = p_run_id AND span.span_id = item->>'span_id'
        AND span.kind <> 'SUPPORTING_EVIDENCE'
    ) THEN
      RAISE EXCEPTION 'cross-section relationship staging cannot add closure components'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.product_source_closure_spans(run_id, source_closure_id, span_id)
    VALUES (p_run_id, item->>'source_closure_id', item->>'span_id')
    ON CONFLICT (run_id, source_closure_id, span_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_staging->'links') LOOP
    IF coalesce(item->>'schema_version', '') <> 'PRODUCT_FACT_LINK/V2'
      OR coalesce(item->>'fact_link_id', '') !~ '^[0-9a-f]{64}$'
      OR coalesce(item->>'from_proposal_id', '') = ''
      OR coalesce(item->>'to_proposal_id', '') = ''
      OR item->>'from_proposal_id' = item->>'to_proposal_id'
      OR coalesce(item->>'relationship_type', '') NOT IN (
        'QUALIFIES', 'EXCEPTS', 'TRIGGERS', 'DEFINED_BY',
        'ALTERNATIVE_TO', 'EXTENDS', 'REQUIRES'
      )
      OR coalesce(item->>'source_closure_id', '') = ''
      OR coalesce(pg_catalog.jsonb_typeof(item->'source_span_ids'), '') <> 'array'
      OR pg_catalog.jsonb_array_length(item->'source_span_ids') = 0
      OR pg_catalog.jsonb_array_length(item->'source_span_ids') <> (
        SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids')
      )
      OR coalesce(pg_catalog.jsonb_typeof(item->'target_source_span_ids'), '') <> 'array'
      OR pg_catalog.jsonb_array_length(item->'target_source_span_ids') = 0
      OR pg_catalog.jsonb_array_length(item->'target_source_span_ids') <> (
        SELECT count(DISTINCT value) FROM pg_catalog.jsonb_array_elements_text(item->'target_source_span_ids')
      ) THEN
      RAISE EXCEPTION 'invalid cross-section relationship link' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_proposals origin
      JOIN public.product_proposals target ON target.run_id = origin.run_id
      JOIN public.product_source_closures closure ON closure.run_id = origin.run_id
        AND closure.source_closure_id = item->>'source_closure_id'
      WHERE origin.run_id = p_run_id AND origin.proposal_id = item->>'from_proposal_id'
        AND target.proposal_id = item->>'to_proposal_id'
        AND origin.source_closure_id = item->>'source_closure_id'
        AND origin.structure_node_id <> target.structure_node_id
        AND product_private.product_phase3_relationship_types(
          origin.family_key, origin.subtype_key
        ) ? (item->>'relationship_type')
    ) THEN RAISE EXCEPTION 'cross-section relationship endpoint mismatch' USING ERRCODE = '22023'; END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') selected(span_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.product_proposals origin
        JOIN public.product_source_closure_spans closure_span
          ON closure_span.run_id = origin.run_id
          AND closure_span.source_closure_id = item->>'source_closure_id'
          AND closure_span.span_id = selected.span_id
        JOIN public.product_source_spans span ON span.run_id = closure_span.run_id
          AND span.span_id = closure_span.span_id
        WHERE origin.run_id = p_run_id AND origin.proposal_id = item->>'from_proposal_id'
          AND span.kind = 'SUPPORTING_EVIDENCE'
          AND span.structure_node_id = origin.structure_node_id
          AND EXISTS (
            SELECT 1 FROM public.product_source_closure_spans component_link
            JOIN public.product_source_spans component ON component.run_id = component_link.run_id
              AND component.span_id = component_link.span_id
            WHERE component_link.run_id = origin.run_id
              AND component_link.source_closure_id = item->>'source_closure_id'
              AND component.kind IN ('FULL_SECTION', 'OPERATIVE', 'CHAPEAU')
              AND component.structure_node_id = origin.structure_node_id
              AND component.start_byte <= span.start_byte AND component.end_byte >= span.end_byte
          )
      )
    ) THEN RAISE EXCEPTION 'cross-section relationship source mismatch' USING ERRCODE = '22023'; END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements_text(item->'target_source_span_ids') selected(span_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.product_proposals target
        JOIN public.product_source_closure_spans closure_span
          ON closure_span.run_id = target.run_id
          AND closure_span.source_closure_id = item->>'source_closure_id'
          AND closure_span.span_id = selected.span_id
        JOIN public.product_source_spans locator ON locator.run_id = closure_span.run_id
          AND locator.span_id = closure_span.span_id
        WHERE target.run_id = p_run_id AND target.proposal_id = item->>'to_proposal_id'
          AND locator.kind = 'SUPPORTING_EVIDENCE'
          AND locator.structure_node_id = target.structure_node_id
          AND EXISTS (
            SELECT 1 FROM public.product_source_closure_spans component_link
            JOIN public.product_source_spans component ON component.run_id = component_link.run_id
              AND component.span_id = component_link.span_id
            WHERE component_link.run_id = target.run_id
              AND component_link.source_closure_id = item->>'source_closure_id'
              AND component.kind = 'CROSS_REFERENCE'
              AND component.structure_node_id = target.structure_node_id
              AND component.start_byte <= locator.start_byte AND component.end_byte >= locator.end_byte
          )
          AND EXISTS (
            SELECT 1 FROM public.product_proposal_spans target_link
            JOIN public.product_source_spans evidence ON evidence.run_id = target_link.run_id
              AND evidence.span_id = target_link.span_id
            WHERE target_link.run_id = target.run_id
              AND target_link.proposal_id = target.proposal_id
              AND evidence.structure_node_id = locator.structure_node_id
              AND evidence.start_byte <= locator.start_byte
              AND evidence.end_byte >= locator.end_byte
          )
      )
    ) THEN RAISE EXCEPTION 'cross-section relationship target mismatch' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.product_fact_links(
      run_id, fact_link_id, from_proposal_id, to_proposal_id, relationship_type, payload
    ) VALUES (
      p_run_id, item->>'fact_link_id', item->>'from_proposal_id', item->>'to_proposal_id',
      item->>'relationship_type', item
    ) ON CONFLICT (run_id, fact_link_id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1 FROM public.product_fact_links stored
      WHERE stored.run_id = p_run_id AND stored.fact_link_id = item->>'fact_link_id'
        AND stored.from_proposal_id = item->>'from_proposal_id'
        AND stored.to_proposal_id = item->>'to_proposal_id'
        AND stored.relationship_type = item->>'relationship_type' AND stored.payload = item
    ) THEN RAISE EXCEPTION 'cross-section relationship collision' USING ERRCODE = '23505'; END IF;
    FOR nested_record IN
      SELECT value #>> '{}' AS span_id, ordinality - 1 AS ordinal
      FROM pg_catalog.jsonb_array_elements(item->'source_span_ids') WITH ORDINALITY
    LOOP
      INSERT INTO public.product_fact_link_spans(run_id, fact_link_id, span_id, ordinal)
      VALUES (p_run_id, item->>'fact_link_id', nested_record.span_id, nested_record.ordinal)
      ON CONFLICT (run_id, fact_link_id, span_id) DO NOTHING;
      IF NOT EXISTS (
        SELECT 1 FROM public.product_fact_link_spans stored
        WHERE stored.run_id = p_run_id AND stored.fact_link_id = item->>'fact_link_id'
          AND stored.span_id = nested_record.span_id AND stored.ordinal = nested_record.ordinal
      ) THEN RAISE EXCEPTION 'cross-section relationship source collision' USING ERRCODE = '23505'; END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE FUNCTION public.product_phase2_stage_cross_section_relationships(
  p_run_id uuid, p_staging jsonb
) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase2_stage_cross_section_relationships(p_run_id, p_staging)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase2_stage_cross_section_relationships(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase2_stage_cross_section_relationships(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase2_stage_cross_section_relationships(uuid,jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase2_stage_cross_section_relationships(uuid,jsonb)
  TO service_role;
