ALTER FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  RENAME TO product_phase3_validate_review_immutable_sources;

CREATE FUNCTION product_private.product_phase3_validate_review(p_run_id uuid, p_state jsonb, p_for_publish boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE legacy_state jsonb;
BEGIN
  SELECT pg_catalog.jsonb_set(p_state, '{items}', pg_catalog.jsonb_agg(
    CASE WHEN item->>'kind' = 'PROPOSAL'
      THEN pg_catalog.jsonb_set(item, '{source_span_ids}', item->'original'->'source_span_ids', false)
      ELSE item END ORDER BY ordinality
  ), false) INTO legacy_state
  FROM pg_catalog.jsonb_array_elements(p_state->'items') WITH ORDINALITY entries(item, ordinality);

  PERFORM product_private.product_phase3_validate_review_immutable_sources(p_run_id, legacy_state, false);

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    JOIN public.product_proposals p ON p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL' AND CASE
      WHEN coalesce(pg_catalog.jsonb_typeof(item->'source_span_ids'), '') <> 'array' THEN true
      ELSE (item->>'decision' <> 'EDITED' AND item->'source_span_ids' <> p.payload->'source_span_ids')
        OR (item->>'decision' = 'ACCEPTED' AND p.payload->>'validation_status' <> 'VALID')
        OR (item->>'decision' = 'EDITED' AND pg_catalog.jsonb_array_length(item->'source_span_ids') = 0)
        OR pg_catalog.jsonb_array_length(item->'source_span_ids') <>
          (SELECT count(DISTINCT span_id) FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') selected(span_id))
        OR EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') selected(span_id)
          WHERE NOT EXISTS (
            SELECT 1 FROM public.product_source_closure_spans cs
            WHERE cs.run_id = p_run_id
              AND cs.source_closure_id = item->>'source_closure_id'
              AND cs.span_id = selected.span_id
          )
        )
    END
  ) THEN
    RAISE EXCEPTION 'review proposal source mismatch' USING ERRCODE = '22023';
  END IF;

  IF p_for_publish THEN
    IF p_state->'agreement_coverage'->>'decision' <> 'ACCEPTED'
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'decision' IN ('PENDING', 'UNRESOLVED'))
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

REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
