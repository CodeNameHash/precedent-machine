DO $$
DECLARE definition text;
DECLARE old_progress text := '''failed'', count(*) FILTER (WHERE status = ''FAILED''), ''cost_microusd''';
DECLARE new_progress text := '''failed'', count(*) FILTER (WHERE status = ''FAILED''),
    ''running'', count(*) FILTER (WHERE status = ''RUNNING''), ''cost_microusd''';
BEGIN
  definition := pg_catalog.pg_get_functiondef(
    'product_private.product_phase2_get_analysis(uuid)'::pg_catalog.regprocedure
  );
  IF pg_catalog.strpos(definition, new_progress) > 0 THEN
    RETURN;
  END IF;
  IF pg_catalog.strpos(definition, old_progress) = 0 THEN
    RAISE EXCEPTION 'product_phase2_get_analysis progress projection is not recognised';
  END IF;
  definition := pg_catalog.replace(definition, old_progress, new_progress);
  EXECUTE definition;
END;
$$;
