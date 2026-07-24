BEGIN;
SET LOCAL statement_timeout='120000ms';
DO $authority_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM canonical_v2_staging.candidate_input_heads
    WHERE environment='staging'
      AND contract_fingerprint='56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d'
      AND candidate_input_head_id='47e58bdccc8712e52538e001d69237cbe0d5c1d3ab4a8bdd5fcfac57439220bf'
      AND candidate_input_head_payload_digest='6235cfd8f97babed44c1a4666008c239aec08983eb2d186bb00ad527a4f95c47'
  ) THEN
    RAISE EXCEPTION 'pinned F1 candidate input head is missing before authority partition migration';
  END IF;
  IF EXISTS (
    SELECT environment, contract_fingerprint
    FROM canonical_v2_staging.candidate_input_heads
    GROUP BY environment, contract_fingerprint HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'candidate input heads are not unique by environment and contract';
  END IF;
END;
$authority_preflight$;

ALTER TABLE canonical_v2_staging.candidate_input_heads
  DROP CONSTRAINT IF EXISTS candidate_input_heads_pkey;
ALTER TABLE canonical_v2_staging.candidate_input_heads
  ADD CONSTRAINT candidate_input_heads_pkey
  PRIMARY KEY (environment, contract_fingerprint);

DO $authority_partition_assert$
DECLARE
  primary_key_columns name[];
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
END;
$authority_partition_assert$;
COMMIT;
