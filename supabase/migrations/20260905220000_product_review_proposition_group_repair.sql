ALTER FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean) RENAME TO product_phase3_validate_review_before_group_repair;

CREATE FUNCTION product_private.product_phase3_validate_review(
  p_run_id uuid, p_state jsonb, p_for_publish boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM product_private.product_phase3_validate_review_before_group_repair(
    p_run_id, p_state, p_for_publish
  );

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    JOIN public.product_proposals proposal
      ON proposal.run_id = p_run_id AND proposal.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL'
      AND item ? 'edited_proposition_group_id'
      AND item->'edited_proposition_group_id' <> 'null'::jsonb
      AND (
        pg_catalog.jsonb_typeof(item->'edited_proposition_group_id') <> 'string'
        OR NOT EXISTS (
          SELECT 1 FROM public.product_proposition_groups candidate
          WHERE candidate.run_id = p_run_id
            AND candidate.proposition_group_id = item->>'edited_proposition_group_id'
            AND candidate.family_key = proposal.family_key
            AND candidate.subtype_key = proposal.subtype_key
        )
      )
  ) THEN
    RAISE EXCEPTION 'review proposition group mismatch' USING ERRCODE = '22023';
  END IF;

  IF p_for_publish AND EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    JOIN public.product_proposals proposal
      ON proposal.run_id = p_run_id AND proposal.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL'
      AND item->>'decision' IN ('ACCEPTED', 'EDITED')
      AND (
        (
          CASE WHEN item ? 'edited_proposition_group_id'
            THEN item->'edited_proposition_group_id'
            ELSE coalesce(pg_catalog.to_jsonb(proposal.proposition_group_id), 'null'::jsonb)
          END <> 'null'::jsonb
          AND NOT EXISTS (
            SELECT 1 FROM public.product_proposition_groups candidate
            WHERE candidate.run_id = p_run_id
              AND candidate.proposition_group_id = CASE
                WHEN item ? 'edited_proposition_group_id' THEN item->>'edited_proposition_group_id'
                ELSE proposal.proposition_group_id
              END
              AND candidate.family_key = proposal.family_key
              AND candidate.subtype_key = proposal.subtype_key
          )
        )
        OR NOT EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'families') family,
            pg_catalog.jsonb_array_elements(family->'facts') fact
          WHERE fact->>'review_item_id' = item->>'item_id'
            AND fact->>'family_key' = proposal.family_key
            AND fact->>'subtype_key' = proposal.subtype_key
            AND fact->'proposition_group_id' IS NOT DISTINCT FROM CASE
              WHEN item ? 'edited_proposition_group_id'
                THEN item->'edited_proposition_group_id'
              ELSE coalesce(pg_catalog.to_jsonb(proposal.proposition_group_id), 'null'::jsonb)
            END
        )
      )
  ) THEN
    RAISE EXCEPTION 'published review proposition group mismatch' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review_before_group_repair(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  TO service_role;
