CREATE OR REPLACE FUNCTION product_private.product_phase3_validate_review_immutable_sources(
  p_run_id uuid, p_state jsonb, p_for_publish boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE immutable_items jsonb;
BEGIN
  IF pg_catalog.jsonb_typeof(p_state->'items') <> 'array'
    OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' NOT IN ('PROPOSAL', 'USER_FACT', 'EXCEPTION_LINK', 'ISSUE', 'COVERAGE', 'IMMATERIAL_ROUTING')
        OR item->>'decision' NOT IN ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED')
        OR item->>'item_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
          (item->>'kind') || chr(31) || (item->>'source_id'), 'UTF8'), 'sha256'::text), 'hex'))
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items')) <>
      (SELECT count(DISTINCT item->>'item_id') FROM pg_catalog.jsonb_array_elements(p_state->'items') item) THEN
    RAISE EXCEPTION 'invalid review items' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_object_agg(
    (item->>'kind') || chr(31) || (item->>'source_id'), item
  ), '{}'::jsonb)
  INTO immutable_items
  FROM pg_catalog.jsonb_array_elements(p_state->'items') item
  WHERE item->>'kind' IS NOT NULL AND item->>'source_id' IS NOT NULL;

  IF EXISTS (
      SELECT 1 FROM public.product_proposals p
      WHERE p.run_id = p_run_id AND (
        immutable_items->('PROPOSAL' || chr(31) || p.proposal_id) IS NULL
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->>'source_closure_id'
          IS DISTINCT FROM p.source_closure_id
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->'source_span_ids'
          IS DISTINCT FROM p.payload->'source_span_ids'
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->'original'
          IS DISTINCT FROM p.payload
      )
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'PROPOSAL' AND NOT EXISTS (
        SELECT 1 FROM public.product_proposals p
        WHERE p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
      )
    ) THEN
    RAISE EXCEPTION 'review proposal graph mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
      SELECT 1 FROM public.product_fact_links l
      WHERE l.run_id = p_run_id AND l.relationship_type = 'EXCEPTS'
        AND immutable_items->('EXCEPTION_LINK' || chr(31) || l.fact_link_id)->'original'
          IS DISTINCT FROM l.payload
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'EXCEPTION_LINK' AND NOT EXISTS (
        SELECT 1 FROM public.product_fact_links l
        WHERE l.run_id = p_run_id AND l.relationship_type = 'EXCEPTS'
          AND l.fact_link_id = item->>'source_id' AND l.payload = item->'original'
      )
    ) OR EXISTS (
      SELECT 1 FROM public.product_issues i
      WHERE i.run_id = p_run_id
        AND immutable_items->('ISSUE' || chr(31) || i.issue_id) IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.product_coverage_assertions c
      WHERE c.run_id = p_run_id
        AND (c.state = 'UNRESOLVED'
          OR (c.state = 'NOT_FOUND' AND c.subject_kind IN ('FAMILY', 'FACT_TYPE'))
          OR (c.subject_kind = 'RESIDUAL_PARAGRAPH' AND c.payload->>'reason' = 'IMMATERIAL'))
        AND immutable_items->('COVERAGE' || chr(31) || c.coverage_assertion_id) IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.product_section_routings r
      WHERE r.run_id = p_run_id AND r.disposition = 'IMMATERIAL'
        AND immutable_items->('IMMATERIAL_ROUTING' || chr(31) || r.section_routing_id) IS NULL
    ) THEN
    RAISE EXCEPTION 'required review item is missing' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    WHERE item->>'kind' = 'USER_FACT' AND (
      coalesce(item->>'structure_node_id', '') = '' OR coalesce(item->>'source_closure_id', '') = ''
      OR pg_catalog.jsonb_array_length(item->'source_span_ids') = 0
      OR NOT EXISTS (SELECT 1 FROM public.product_source_closures c WHERE c.run_id = p_run_id
        AND c.source_closure_id = item->>'source_closure_id' AND c.structure_node_id = item->>'structure_node_id')
      OR item->>'source_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        (p_state->>'draft_analysis_id') || chr(31) || (item->>'structure_node_id') || chr(31)
        || (item->>'family_key') || chr(31) || (item->'original'->>'subtype_key') || chr(31)
        || (item->'original'->>'fact_type') || chr(31) || (item->'original'->>'statement') || chr(31)
        || (SELECT pg_catalog.string_agg(value, ',' ORDER BY value)
          FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids')), 'UTF8'), 'sha256'::text), 'hex')
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') span_id WHERE NOT EXISTS (
        SELECT 1 FROM public.product_source_closure_spans cs WHERE cs.run_id = p_run_id
          AND cs.source_closure_id = item->>'source_closure_id' AND cs.span_id = span_id)))) THEN
    RAISE EXCEPTION 'user fact source mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item JOIN public.product_proposals p
      ON p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' = 'EDITED' AND (
      coalesce(item->>'edited_statement', '') = '' OR pg_catalog.jsonb_typeof(item->'edited_roles') <> 'object'
      OR EXISTS (SELECT 1 FROM public.product_coverage_assertions c WHERE c.run_id = p_run_id
        AND c.subject_kind = 'ROLE' AND c.subject_id LIKE p.fact_occurrence_id || ':%'
        AND coalesce(item->'edited_roles'->>(c.payload->>'required_role'), '') = ''))) THEN
    RAISE EXCEPTION 'edited proposal is incomplete' USING ERRCODE = '22023';
  END IF;
  IF p_for_publish THEN
    IF p_state->'agreement_coverage'->>'decision' <> 'ACCEPTED'
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'PENDING')
      OR pg_catalog.jsonb_typeof(p_state->'summary'->'families') <> 'array'
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'families') family,
          pg_catalog.jsonb_array_elements(family->'facts')) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED'))
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'families') family,
          pg_catalog.jsonb_array_elements(family->'facts') fact WHERE fact->>'review_item_id' = item->>'item_id'
            AND fact->>'source_closure_id' = item->>'source_closure_id'
            AND fact->'source_span_ids' = item->'source_span_ids'))
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') link_item
        WHERE link_item->>'kind' = 'EXCEPTION_LINK' AND link_item->>'decision' = 'ACCEPTED'
          AND (NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'from_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))
            OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'to_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))))
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships')) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED')
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED'
          AND NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships') relationship
            WHERE relationship->>'review_item_id' = item->>'item_id'
              AND (relationship - 'review_item_id' - 'source_closure_id' - 'source_span_ids') = (item->'original') - 'source_span_ids'
              AND relationship->>'source_closure_id' = item->>'source_closure_id'
              AND relationship->'source_span_ids' = item->'source_span_ids'))
      OR coalesce((p_state->'metrics'->>'proposal_count')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'PROPOSAL')
      OR coalesce((p_state->'metrics'->>'proposal_errors')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' IN ('EDITED', 'REJECTED'))
      OR coalesce((p_state->'metrics'->>'proposal_omissions')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'USER_FACT')
      OR coalesce((p_state->'metrics'->>'unresolved_count')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'UNRESOLVED')
      OR coalesce((p_state->'metrics'->>'review_time_seconds')::integer, -1) < 0 THEN
      RAISE EXCEPTION 'published review summary mismatch' USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;
