DO $$
DECLARE
  signature text;
  definition text;
  revised text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.product_phase1_attach_structure(uuid,text,jsonb,jsonb)',
    'public.product_phase1_resolve_identity(uuid,jsonb)',
    'product_private.product_phase2_commit_section_legacy(uuid,text,text,uuid,jsonb)',
    'product_private.product_phase2_finalize_draft_legacy(uuid,jsonb)',
    'product_private.product_phase2_finalize_saved_run(uuid,jsonb)'
  ] LOOP
    definition := pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(signature));
    IF definition IS NULL THEN
      RAISE EXCEPTION 'required product function is absent: %', signature;
    END IF;
    revised := pg_catalog.replace(definition, 'AND item->>''reference'' !~ ''-INTRO$''', '');
    revised := pg_catalog.replace(revised, 'AND node->>''reference'' !~ ''-INTRO$''', '');
    revised := pg_catalog.replace(revised, 'AND n->>''reference'' !~ ''-INTRO$''', '');
    IF pg_catalog.strpos(revised, '!~ ''-INTRO$''') > 0 THEN
      RAISE EXCEPTION 'product article-introduction exclusion remains: %', signature;
    END IF;
    IF revised <> definition THEN EXECUTE revised; END IF;
  END LOOP;
END;
$$;

DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure(
    'product_private.product_phase3_validate_review(uuid,jsonb,boolean)'
  ) IS NULL THEN
    RAISE EXCEPTION 'required product review validator is absent';
  END IF;
  IF pg_catalog.to_regprocedure(
    'product_private.product_phase3_validate_review_before_article_intro_coverage(uuid,jsonb,boolean)'
  ) IS NULL THEN
    ALTER FUNCTION product_private.product_phase3_validate_review(uuid,jsonb,boolean)
      RENAME TO product_phase3_validate_review_before_article_intro_coverage;
  END IF;

  EXECUTE $definition$
    CREATE OR REPLACE FUNCTION product_private.product_phase3_validate_review(
      p_run_id uuid, p_state jsonb, p_for_publish boolean
    ) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
    BEGIN
      PERFORM product_private.product_phase3_validate_review_before_article_intro_coverage(
        p_run_id, p_state, p_for_publish
      );
      IF p_for_publish AND (
        EXISTS (
          SELECT 1
          FROM public.product_run_structures mapping
          JOIN public.product_agreement_structures structure
            ON structure.structure_id = mapping.structure_id,
            pg_catalog.jsonb_array_elements(structure.payload->'nodes') node
          WHERE mapping.run_id = p_run_id
            AND node->>'kind' = 'SECTION'
            AND coalesce(node->>'reference', '') <> ''
            AND NOT EXISTS (
              SELECT 1
              FROM pg_catalog.jsonb_array_elements(structure.payload->'nodes') child
              WHERE child->>'kind' = 'SECTION'
                AND child->>'node_id' <> node->>'node_id'
                AND child->>'reference' LIKE (node->>'reference') || '::%'
            )
            AND (
              NOT EXISTS (
                SELECT 1 FROM public.product_section_results result
                WHERE result.run_id = p_run_id
                  AND result.structure_node_id = node->>'node_id'
              )
              OR NOT EXISTS (
                SELECT 1 FROM public.product_coverage_assertions coverage
                WHERE coverage.run_id = p_run_id
                  AND coverage.subject_kind = 'SECTION'
                  AND coverage.structure_node_id = node->>'node_id'
                  AND coverage.subject_id = node->>'node_id'
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.product_section_results result
          WHERE result.run_id = p_run_id
            AND NOT EXISTS (
              SELECT 1
              FROM public.product_run_structures mapping
              JOIN public.product_agreement_structures structure
                ON structure.structure_id = mapping.structure_id,
                pg_catalog.jsonb_array_elements(structure.payload->'nodes') node
              WHERE mapping.run_id = p_run_id
                AND node->>'node_id' = result.structure_node_id
                AND node->>'kind' = 'SECTION'
                AND coalesce(node->>'reference', '') <> ''
                AND NOT EXISTS (
                  SELECT 1
                  FROM pg_catalog.jsonb_array_elements(structure.payload->'nodes') child
                  WHERE child->>'kind' = 'SECTION'
                    AND child->>'node_id' <> node->>'node_id'
                    AND child->>'reference' LIKE (node->>'reference') || '::%'
                )
            )
        )
        OR EXISTS (
          SELECT 1 FROM public.product_coverage_assertions coverage
          WHERE coverage.run_id = p_run_id
            AND coverage.subject_kind = 'SECTION'
            AND NOT EXISTS (
              SELECT 1
              FROM public.product_run_structures mapping
              JOIN public.product_agreement_structures structure
                ON structure.structure_id = mapping.structure_id,
                pg_catalog.jsonb_array_elements(structure.payload->'nodes') node
              WHERE mapping.run_id = p_run_id
                AND node->>'node_id' = coverage.structure_node_id
                AND node->>'node_id' = coverage.subject_id
                AND node->>'kind' = 'SECTION'
                AND coalesce(node->>'reference', '') <> ''
                AND NOT EXISTS (
                  SELECT 1
                  FROM pg_catalog.jsonb_array_elements(structure.payload->'nodes') child
                  WHERE child->>'kind' = 'SECTION'
                    AND child->>'node_id' <> node->>'node_id'
                    AND child->>'reference' LIKE (node->>'reference') || '::%'
                )
            )
        )
      ) THEN
        RAISE EXCEPTION 'published review source coverage is incomplete' USING ERRCODE = '22023';
      END IF;
    END;
    $$
  $definition$;

  REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review(uuid,jsonb,boolean)
    FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION product_private.product_phase3_validate_review_before_article_intro_coverage(uuid,jsonb,boolean)
    FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION product_private.product_phase3_validate_review(uuid,jsonb,boolean)
    TO service_role;
  GRANT EXECUTE ON FUNCTION product_private.product_phase3_validate_review_before_article_intro_coverage(uuid,jsonb,boolean)
    TO service_role;
END;
$migration$;
