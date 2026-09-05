ALTER FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  RENAME TO product_phase3_validate_review_before_finding_resolution;

CREATE FUNCTION product_private.product_phase3_validate_review(
  p_run_id uuid, p_state jsonb, p_for_publish boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE resolutions jsonb;
BEGIN
  PERFORM product_private.product_phase3_validate_review_before_finding_resolution(
    p_run_id, p_state, p_for_publish
  );

  IF p_state->'release_evaluation_input' IS NULL THEN RETURN; END IF;
  resolutions := coalesce(p_state->'release_evaluation_input'->'finding_resolutions', '[]'::jsonb);
  IF pg_catalog.jsonb_typeof(resolutions) <> 'array'
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(resolutions)) <>
      (SELECT count(DISTINCT resolution->>'finding_item_id')
        FROM pg_catalog.jsonb_array_elements(resolutions) resolution) THEN
    RAISE EXCEPTION 'invalid finding resolutions' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(resolutions) resolution
    WHERE resolution->>'reviewed_by_role' IS DISTINCT FROM 'LAWYER'
      OR resolution->>'disposition' NOT IN ('PUBLISHED_FACT', 'REVIEWED_OMISSION')
      OR (SELECT count(*) FROM pg_catalog.jsonb_object_keys(resolution)) <> 4
      OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') finding
        WHERE finding->>'item_id' = resolution->>'finding_item_id'
          AND finding->>'kind' IN ('COVERAGE', 'ISSUE')
          AND finding->>'decision' = 'ACCEPTED'
          AND finding->>'decided_by_role' = 'LAWYER'
          AND CASE finding->>'kind'
            WHEN 'COVERAGE' THEN EXISTS (
              SELECT 1 FROM public.product_coverage_assertions coverage
              WHERE coverage.run_id = p_run_id
                AND coverage.coverage_assertion_id = finding->>'source_id'
                AND coverage.state = 'UNRESOLVED'
            )
            WHEN 'ISSUE' THEN EXISTS (
              SELECT 1 FROM public.product_issues issue
              WHERE issue.run_id = p_run_id
                AND issue.issue_id = finding->>'source_id'
                AND issue.state = 'OPEN'
                AND coalesce(issue.payload->>'code', '') ~* 'CONTRADICT'
            )
            ELSE false
          END
      )
      OR CASE resolution->>'disposition'
        WHEN 'PUBLISHED_FACT' THEN
          NOT resolution ? 'published_fact_review_item_id'
          OR resolution ? 'omission_reason'
          OR NOT EXISTS (
            SELECT 1
            FROM public.product_review_publications publication,
              pg_catalog.jsonb_array_elements(publication.summary->'families') family,
              pg_catalog.jsonb_array_elements(family->'facts') fact,
              pg_catalog.jsonb_array_elements(p_state->'items') finding
            LEFT JOIN public.product_coverage_assertions coverage
              ON coverage.run_id = p_run_id
              AND coverage.coverage_assertion_id = finding->>'source_id'
              AND finding->>'kind' = 'COVERAGE'
            LEFT JOIN public.product_issues issue
              ON issue.run_id = p_run_id
              AND issue.issue_id = finding->>'source_id'
              AND finding->>'kind' = 'ISSUE'
            WHERE publication.run_id = p_run_id
              AND publication.summary = p_state->'summary'
              AND finding->>'item_id' = resolution->>'finding_item_id'
              AND fact->>'review_item_id' = resolution->>'published_fact_review_item_id'
              AND (coalesce(coverage.structure_node_id, issue.structure_node_id) IS NULL
                OR fact->>'structure_node_id' = coalesce(coverage.structure_node_id, issue.structure_node_id))
              AND (coalesce(coverage.family_key, issue.family_key) IS NULL
                OR fact->>'family_key' = coalesce(coverage.family_key, issue.family_key))
              AND (coverage.subject_kind IS DISTINCT FROM 'FACT_TYPE'
                OR fact->>'fact_type' = coalesce(
                  nullif(pg_catalog.split_part(coverage.payload->>'reason', 'FACT_TYPE:', 2), ''),
                  pg_catalog.regexp_replace(coverage.subject_id, '^.*:', '')
                ))
          )
        WHEN 'REVIEWED_OMISSION' THEN
          NOT resolution ? 'omission_reason'
          OR resolution ? 'published_fact_review_item_id'
          OR pg_catalog.btrim(coalesce(resolution->>'omission_reason', '')) = ''
        ELSE true
      END
  ) THEN
    RAISE EXCEPTION 'invalid finding resolutions' USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review_before_finding_resolution(uuid, jsonb, boolean)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_validate_review(uuid, jsonb, boolean)
  TO service_role;
