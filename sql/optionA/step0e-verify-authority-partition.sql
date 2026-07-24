BEGIN;
SET LOCAL statement_timeout='120000ms';
DO $authority_definition_assert$
DECLARE
  primary_key_columns name[];
  writer_definition text := pg_get_functiondef('public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  importer_definition text := pg_get_functiondef('public.canonical_v2_import_candidate_release(text,jsonb)'::regprocedure);
  activation_definition text := pg_get_functiondef('public.canonical_v2_activate_candidate_release(text,jsonb,jsonb)'::regprocedure);
BEGIN
  SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)
  INTO primary_key_columns
  FROM pg_constraint constraint_record
  CROSS JOIN LATERAL unnest(constraint_record.conkey) WITH ORDINALITY
    AS key_column(attnum, ordinality)
  JOIN pg_attribute attribute
    ON attribute.attrelid = constraint_record.conrelid
   AND attribute.attnum = key_column.attnum
  WHERE constraint_record.conrelid = 'canonical_v2_staging.candidate_input_heads'::regclass
    AND constraint_record.contype = 'p';
  IF primary_key_columns IS DISTINCT FROM ARRAY['environment', 'contract_fingerprint']::name[] THEN
    RAISE EXCEPTION 'candidate input head authority partition key is not exact';
  END IF;
  IF writer_definition NOT LIKE '%environment = next_candidate_input_head->>''environment''%'
    OR writer_definition NOT LIKE '%contract_fingerprint = next_candidate_input_head->>''contract_fingerprint''%' THEN
    RAISE EXCEPTION 'canonical writer is not contract-partitioned';
  END IF;
  IF importer_definition NOT LIKE '%current_head.contract_fingerprint = contract_id%' THEN
    RAISE EXCEPTION 'candidate importer is not contract-partitioned';
  END IF;
  IF activation_definition NOT LIKE '%current_head.contract_fingerprint = imported_input_contract_fingerprint%' THEN
    RAISE EXCEPTION 'candidate activation is not contract-partitioned';
  END IF;
  IF (SELECT count(*) FROM canonical_v2_staging.candidate_input_heads
      WHERE environment='staging' AND contract_fingerprint='56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d'
        AND candidate_input_head_id='47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf'
        AND candidate_input_head_payload_digest='6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47') <> 1 THEN
    RAISE EXCEPTION 'authority partition migration moved the pinned F1 head';
  END IF;
END;
$authority_definition_assert$;
COMMIT;
