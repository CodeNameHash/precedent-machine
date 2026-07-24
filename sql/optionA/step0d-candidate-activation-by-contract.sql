BEGIN;
SET LOCAL statement_timeout='120000ms';
-- Governed function SHA-256: 53578257036aa9e5d0c8b6eb2f200a44d04e014a070ccb2334a56fd8775c1734
CREATE OR REPLACE FUNCTION public.canonical_v2_activate_candidate_release(
  p_environment text,
  p_expected_current_pointer jsonb,
  p_next_pointer jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '2500ms'
AS $$
DECLARE
  stored_pointer jsonb;
  imported_plan_id text;
  imported_correction_seal_id text;
  imported_correction_input_root_id text;
  imported_input_contract_fingerprint text;
  imported_input_head_id text;
  imported_input_head_payload_digest text;
  imported_discharge_map_id text;
  imported_discharge_map_payload_digest text;
  current_input_contract_fingerprint text;
  current_input_head_id text;
  current_input_head_payload_digest text;
  current_discharge_map_id text;
  current_discharge_map_payload_digest text;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging'
    OR p_expected_current_pointer->>'environment' IS DISTINCT FROM 'staging'
    OR p_next_pointer->>'environment' IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_activate_candidate_release is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_expected_current_pointer->>'schema_version' NOT IN (
      'FIXTURE_ACTIVE_RELEASE_POINTER/V1',
      'FIXTURE_ACTIVE_RELEASE_POINTER/V2'
    )
    OR p_next_pointer->>'schema_version' IS DISTINCT FROM 'FIXTURE_ACTIVE_RELEASE_POINTER/V2'
    OR p_expected_current_pointer->>'pointer_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'pointer_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'canonical_payload_digest' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'corpus_release_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'serving_namespace_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'candidate_release_manifest_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'correction_input_seal_id' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'correction_input_root' !~ '^[a-f0-9]{64}$'
    OR p_next_pointer->>'previous_pointer_id' !~ '^[a-f0-9]{64}$'
    OR (
      p_expected_current_pointer->>'schema_version' = 'FIXTURE_ACTIVE_RELEASE_POINTER/V2'
      AND (
        p_expected_current_pointer->>'correction_input_seal_id' !~ '^[a-f0-9]{64}$'
        OR p_expected_current_pointer->>'correction_input_root' !~ '^[a-f0-9]{64}$'
      )
    )
    OR (p_next_pointer->>'generation')::integer
      IS DISTINCT FROM (p_expected_current_pointer->>'generation')::integer + 1
    OR p_next_pointer->>'previous_pointer_id' IS DISTINCT FROM p_expected_current_pointer->>'pointer_id' THEN
    RAISE EXCEPTION 'invalid active release pointer transition' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('canonical-v2-active-release:' || p_environment, 0));
  SELECT pointer.canonical_payload
  INTO stored_pointer
  FROM canonical_v2_staging.active_corpus_release_pointers pointer
  WHERE pointer.environment = p_environment;
  IF stored_pointer IS NULL THEN
    IF (p_expected_current_pointer->>'generation')::integer IS DISTINCT FROM 0
      OR p_expected_current_pointer->'corpus_release_id' IS DISTINCT FROM 'null'::jsonb
      OR p_expected_current_pointer->'serving_namespace_id' IS DISTINCT FROM 'null'::jsonb
      OR p_expected_current_pointer->'candidate_release_manifest_id' IS DISTINCT FROM 'null'::jsonb
      OR p_expected_current_pointer->'previous_pointer_id' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'active release pointer does not match the empty store' USING ERRCODE = '40001';
    END IF;
  ELSIF stored_pointer IS DISTINCT FROM p_expected_current_pointer THEN
    RAISE EXCEPTION 'active release pointer changed before compare-and-swap' USING ERRCODE = '40001';
  END IF;

  SELECT
    receipt.candidate_release_import_plan_id,
    receipt.correction_input_seal_id,
    receipt.correction_input_root,
    receipt.candidate_input_contract_fingerprint,
    receipt.candidate_input_head_id,
    receipt.candidate_input_head_payload_digest,
    receipt.correction_discharge_map_id,
    receipt.correction_discharge_map_payload_digest
  INTO
    imported_plan_id,
    imported_correction_seal_id,
    imported_correction_input_root_id,
    imported_input_contract_fingerprint,
    imported_input_head_id,
    imported_input_head_payload_digest,
    imported_discharge_map_id,
    imported_discharge_map_payload_digest
  FROM canonical_v2_staging.candidate_release_import_receipts receipt
  WHERE receipt.import_state = 'IMPORTED_COMPLETE'
    AND receipt.candidate_manifest_id = p_next_pointer->>'candidate_release_manifest_id'
    AND receipt.corpus_release_id = p_next_pointer->>'corpus_release_id'
    AND receipt.serving_namespace_id = p_next_pointer->>'serving_namespace_id';
  IF imported_plan_id IS NULL THEN
    RAISE EXCEPTION 'candidate release has no complete import receipt' USING ERRCODE = '23514';
  END IF;
  IF imported_input_contract_fingerprint =
      '5cc5607bee8fc816e8682f71b9482ff839ff744cebaaf0f26bfcfa54ea64512c' THEN
    RAISE EXCEPTION 'the rejected F3 contract cannot be activated' USING ERRCODE = '23514';
  END IF;
  IF imported_correction_seal_id IS DISTINCT FROM p_next_pointer->>'correction_input_seal_id'
    OR imported_correction_input_root_id IS DISTINCT FROM p_next_pointer->>'correction_input_root' THEN
    RAISE EXCEPTION 'active release pointer does not match the imported correction seal' USING ERRCODE = '23514';
  END IF;

  SELECT
    current_head.contract_fingerprint,
    current_head.candidate_input_head_id,
    current_head.candidate_input_head_payload_digest,
    current_head.correction_discharge_map_id,
    current_head.correction_discharge_map_payload_digest
  INTO
    current_input_contract_fingerprint,
    current_input_head_id,
    current_input_head_payload_digest,
    current_discharge_map_id,
    current_discharge_map_payload_digest
  FROM canonical_v2_staging.candidate_input_heads current_head
  WHERE current_head.singleton_key = 'CURRENT'
    AND current_head.environment = 'staging'
    AND current_head.contract_fingerprint = imported_input_contract_fingerprint
  FOR SHARE OF current_head;
  IF NOT FOUND
    OR imported_input_contract_fingerprint IS NULL
    OR imported_input_head_id IS NULL
    OR imported_input_head_payload_digest IS NULL
    OR imported_discharge_map_id IS NULL
    OR imported_discharge_map_payload_digest IS NULL
    OR current_input_contract_fingerprint IS DISTINCT FROM imported_input_contract_fingerprint
    OR current_input_head_id IS DISTINCT FROM imported_input_head_id
    OR current_input_head_payload_digest IS DISTINCT FROM imported_input_head_payload_digest
    OR current_discharge_map_id IS DISTINCT FROM imported_discharge_map_id
    OR current_discharge_map_payload_digest IS DISTINCT FROM imported_discharge_map_payload_digest THEN
    RAISE EXCEPTION 'candidate input authority changed before active release activation'
      USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM canonical_v2_staging.active_corpus_release_pointer_history history
    WHERE history.pointer_id = p_next_pointer->>'pointer_id'
      AND history.canonical_payload IS DISTINCT FROM p_next_pointer
  ) THEN
    RAISE EXCEPTION 'active release pointer identity conflicts with different content' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.active_corpus_release_pointer_history(
    pointer_id,
    environment,
    generation,
    corpus_release_id,
    serving_namespace_id,
    candidate_manifest_id,
    correction_input_seal_id,
    correction_input_root,
    candidate_release_import_plan_id,
    previous_pointer_id,
    canonical_payload,
    canonical_payload_digest
  ) VALUES (
    p_next_pointer->>'pointer_id',
    p_environment,
    (p_next_pointer->>'generation')::integer,
    p_next_pointer->>'corpus_release_id',
    p_next_pointer->>'serving_namespace_id',
    p_next_pointer->>'candidate_release_manifest_id',
    p_next_pointer->>'correction_input_seal_id',
    p_next_pointer->>'correction_input_root',
    imported_plan_id,
    p_next_pointer->>'previous_pointer_id',
    p_next_pointer,
    p_next_pointer->>'canonical_payload_digest'
  ) ON CONFLICT (pointer_id) DO NOTHING;

  INSERT INTO canonical_v2_staging.active_corpus_release_pointers(
    environment,
    generation,
    pointer_id,
    corpus_release_id,
    serving_namespace_id,
    candidate_manifest_id,
    correction_input_seal_id,
    correction_input_root,
    candidate_release_import_plan_id,
    previous_pointer_id,
    canonical_payload,
    canonical_payload_digest
  ) VALUES (
    p_environment,
    (p_next_pointer->>'generation')::integer,
    p_next_pointer->>'pointer_id',
    p_next_pointer->>'corpus_release_id',
    p_next_pointer->>'serving_namespace_id',
    p_next_pointer->>'candidate_release_manifest_id',
    p_next_pointer->>'correction_input_seal_id',
    p_next_pointer->>'correction_input_root',
    imported_plan_id,
    p_next_pointer->>'previous_pointer_id',
    p_next_pointer,
    p_next_pointer->>'canonical_payload_digest'
  )
  ON CONFLICT (environment) DO UPDATE SET
    generation = EXCLUDED.generation,
    pointer_id = EXCLUDED.pointer_id,
    corpus_release_id = EXCLUDED.corpus_release_id,
    serving_namespace_id = EXCLUDED.serving_namespace_id,
    candidate_manifest_id = EXCLUDED.candidate_manifest_id,
    correction_input_seal_id = EXCLUDED.correction_input_seal_id,
    correction_input_root = EXCLUDED.correction_input_root,
    candidate_release_import_plan_id = EXCLUDED.candidate_release_import_plan_id,
    previous_pointer_id = EXCLUDED.previous_pointer_id,
    canonical_payload = EXCLUDED.canonical_payload,
    canonical_payload_digest = EXCLUDED.canonical_payload_digest,
    activated_at = transaction_timestamp();

  RETURN p_next_pointer;
END;
$$;
COMMIT;
