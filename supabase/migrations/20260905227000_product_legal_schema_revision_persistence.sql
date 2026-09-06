ALTER TABLE public.product_draft_analyses
  ADD COLUMN IF NOT EXISTS legal_schema_revision text;

DO $$
DECLARE definition text;
DECLARE old_validation text := 'OR coalesce(p_finalization->>''legal_schema_version'', '''') = ''''
    OR coalesce(jsonb_typeof(p_finalization->''totals''), '''') <> ''object''';
DECLARE new_validation text := 'OR coalesce(p_finalization->>''legal_schema_version'', '''') = ''''
    OR (p_finalization ? ''legal_schema_revision''
      AND coalesce(jsonb_typeof(p_finalization->''legal_schema_revision''), '''') NOT IN (''string'', ''null''))
    OR (jsonb_typeof(p_finalization->''legal_schema_revision'') = ''string''
      AND btrim(p_finalization->>''legal_schema_revision'') = '''')
    OR coalesce(jsonb_typeof(p_finalization->''totals''), '''') <> ''object''';
DECLARE old_insert text := 'INSERT INTO public.product_draft_analyses(run_id, draft_analysis_id, legal_schema_version, payload_sha256)
  VALUES (p_run_id, p_finalization->>''draft_analysis_id'', p_finalization->>''legal_schema_version'', summary_hash);';
DECLARE new_insert text := 'INSERT INTO public.product_draft_analyses(
    run_id, draft_analysis_id, legal_schema_version, legal_schema_revision, payload_sha256
  ) VALUES (
    p_run_id, p_finalization->>''draft_analysis_id'', p_finalization->>''legal_schema_version'',
    p_finalization->>''legal_schema_revision'', summary_hash
  );';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_finalize_saved_run(uuid,jsonb)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, new_insert) > 0 THEN
    RETURN;
  END IF;
  IF pg_catalog.strpos(definition, old_validation) = 0
    OR pg_catalog.strpos(definition, old_insert) = 0 THEN
    RAISE EXCEPTION 'product_phase2_finalize_saved_run revision seams are not recognised';
  END IF;
  definition := pg_catalog.replace(definition, old_validation, new_validation);
  definition := pg_catalog.replace(definition, old_insert, new_insert);
  EXECUTE definition;
END;
$$;

DO $$
DECLARE definition text;
DECLARE old_tail text := '''review_revision'', jsonb_build_object(''draft_id'', draft_row.draft_id, ''version'', draft_row.version, ''state'', draft_row.state)
  );';
DECLARE new_tail text := '''review_revision'', jsonb_build_object(''draft_id'', draft_row.draft_id, ''version'', draft_row.version, ''state'', draft_row.state)
  ) || CASE WHEN analysis_row.legal_schema_revision IS NULL THEN ''{}''::jsonb
    ELSE jsonb_build_object(''legal_schema_revision'', analysis_row.legal_schema_revision) END;';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_get_analysis(uuid)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, new_tail) > 0 THEN
    RETURN;
  END IF;
  IF pg_catalog.strpos(definition, old_tail) = 0 THEN
    RAISE EXCEPTION 'product_phase2_get_analysis revision projection is not recognised';
  END IF;
  definition := pg_catalog.replace(definition, old_tail, new_tail);
  EXECUTE definition;
END;
$$;
