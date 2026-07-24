BEGIN;
SET LOCAL statement_timeout='120000ms';
-- Governed function SHA-256: bc429a898a3f8d9fc2133b4b6c4a9b598dc24b8d4492ed327f132e65eca4da31
CREATE OR REPLACE FUNCTION public.canonical_v2_import_candidate_release(
  p_environment text,
  p_import_plan jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '15000ms'
AS $$
DECLARE
  release_record jsonb := p_import_plan->'release_record';
  expected jsonb := p_import_plan->'expected_counts';
  input_authority jsonb := p_import_plan->'candidate_input_authority';
  release_id text := release_record->>'corpus_release_id';
  namespace_id text := release_record->'canonical_payload'->>'serving_namespace_id';
  contract_id text := release_record->>'contract_fingerprint';
  projection_version_id text := release_record->>'projection_version';
  query_projection_contract_id text := release_record->>'query_projection_contract_digest';
  manifest_schema text := release_record->'canonical_payload'->>'schema_version';
  manifest_id text := release_record->>'candidate_manifest_id';
  correction_seal_id text := release_record->>'correction_input_seal_id';
  correction_input_root_id text := release_record->>'correction_input_root';
  input_head_id text := input_authority->>'candidate_input_head_id';
  input_head_payload_digest text := input_authority->>'candidate_input_head_payload_digest';
  discharge_map_id text := input_authority->>'correction_discharge_map_id';
  discharge_map_payload_digest text := input_authority->>'correction_discharge_map_payload_digest';
  import_plan_id text := p_import_plan->>'candidate_release_import_plan_id';
  is_v5 boolean := p_import_plan->>'schema_version' = 'CANDIDATE_RELEASE_IMPORT_PLAN/V5';
  is_v6 boolean := p_import_plan->>'schema_version' = 'CANDIDATE_RELEASE_IMPORT_PLAN/V6';
  carries_incomplete_partition boolean := p_import_plan->>'schema_version' IN (
    'CANDIDATE_RELEASE_IMPORT_PLAN/V5',
    'CANDIDATE_RELEASE_IMPORT_PLAN/V6'
  );
  receipt_schema text := CASE
    WHEN p_import_plan->>'schema_version' = 'CANDIDATE_RELEASE_IMPORT_PLAN/V6'
      THEN 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V6'
    WHEN p_import_plan->>'schema_version' = 'CANDIDATE_RELEASE_IMPORT_PLAN/V5'
      THEN 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V5'
    ELSE 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V4'
  END;
  existing_plan_id text;
  existing_release_id text;
  existing_namespace_id text;
  existing_correction_seal_id text;
  existing_correction_input_root_id text;
  existing_input_contract_fingerprint text;
  existing_input_head_id text;
  existing_input_head_payload_digest text;
  existing_discharge_map_id text;
  existing_discharge_map_payload_digest text;
  existing_expected_counts jsonb;
  current_input_contract_fingerprint text;
  current_input_head_id text;
  current_input_head_payload_digest text;
  current_discharge_map_id text;
  current_discharge_map_payload_digest text;
  imported_at_value timestamptz;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging'
    OR p_import_plan->>'environment' IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_import_candidate_release is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_import_plan->>'schema_version' NOT IN (
      'CANDIDATE_RELEASE_IMPORT_PLAN/V4',
      'CANDIDATE_RELEASE_IMPORT_PLAN/V5',
      'CANDIDATE_RELEASE_IMPORT_PLAN/V6'
    )
    OR jsonb_typeof(release_record) IS DISTINCT FROM 'object'
    OR jsonb_typeof(expected) IS DISTINCT FROM 'object'
    OR jsonb_typeof(input_authority) IS DISTINCT FROM 'object'
    OR NOT (input_authority ?& ARRAY[
      'contract_fingerprint',
      'candidate_input_head_id',
      'candidate_input_head_payload_digest',
      'correction_discharge_map_id',
      'correction_discharge_map_payload_digest'
    ])
    OR input_authority - ARRAY[
      'contract_fingerprint',
      'candidate_input_head_id',
      'candidate_input_head_payload_digest',
      'correction_discharge_map_id',
      'correction_discharge_map_payload_digest'
    ]::text[] <> '{}'::jsonb
    OR release_id !~ '^[a-f0-9]{64}$'
    OR namespace_id !~ '^[a-f0-9]{64}$'
    OR contract_id !~ '^[a-f0-9]{64}$'
    OR manifest_id !~ '^[a-f0-9]{64}$'
    OR correction_seal_id !~ '^[a-f0-9]{64}$'
    OR correction_input_root_id !~ '^[a-f0-9]{64}$'
    OR input_authority->>'contract_fingerprint' !~ '^[a-f0-9]{64}$'
    OR input_head_id !~ '^[a-f0-9]{64}$'
    OR input_head_payload_digest !~ '^[a-f0-9]{64}$'
    OR discharge_map_id !~ '^[a-f0-9]{64}$'
    OR discharge_map_payload_digest !~ '^[a-f0-9]{64}$'
    OR import_plan_id !~ '^[a-f0-9]{64}$'
    OR (
      manifest_schema IN ('FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1', 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2')
      AND (
        projection_version_id IS DISTINCT FROM 'canonical-v2-serving/v1'
        OR query_projection_contract_id IS NOT NULL
      )
    )
    OR (
      manifest_schema = 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3'
      AND (
        projection_version_id IS DISTINCT FROM release_record->'canonical_payload'->>'serving_projection_version'
        OR query_projection_contract_id IS DISTINCT FROM release_record->'canonical_payload'->>'query_projection_contract_digest'
        OR projection_version_id IS DISTINCT FROM 'canonical-v2-serving/v2'
        OR query_projection_contract_id IS DISTINCT FROM '048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827'
      )
    )
    OR manifest_schema NOT IN (
      'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1',
      'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2',
      'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3'
    ) THEN
    RAISE EXCEPTION 'invalid candidate release import plan' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_import_plan->'correction_input_seal_record') IS DISTINCT FROM 'object'
    OR jsonb_typeof(
      p_import_plan->'correction_input_seal_record'->'canonical_payload'
    ) IS DISTINCT FROM 'object'
    OR p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'schema_version'
      IS DISTINCT FROM 'CANDIDATE_CORRECTION_INPUT_SEAL/V2'
    OR input_authority->>'contract_fingerprint' IS DISTINCT FROM contract_id
    OR input_authority->>'contract_fingerprint'
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'contract_fingerprint'
    OR input_head_id
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'candidate_input_head_id'
    OR input_head_payload_digest
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'candidate_input_head_payload_digest'
    OR discharge_map_id
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'correction_discharge_map_id'
    OR discharge_map_payload_digest
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'correction_discharge_map_payload_digest' THEN
    RAISE EXCEPTION 'candidate input authority does not equal the certified correction seal'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(manifest_id, 0));

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
    AND current_head.contract_fingerprint = contract_id
  FOR SHARE OF current_head;
  IF NOT FOUND
    OR current_input_contract_fingerprint IS DISTINCT FROM contract_id
    OR current_input_contract_fingerprint IS DISTINCT FROM input_authority->>'contract_fingerprint'
    OR current_input_head_id IS DISTINCT FROM input_head_id
    OR current_input_head_payload_digest IS DISTINCT FROM input_head_payload_digest
    OR current_discharge_map_id IS DISTINCT FROM discharge_map_id
    OR current_discharge_map_payload_digest IS DISTINCT FROM discharge_map_payload_digest THEN
    RAISE EXCEPTION 'candidate input authority changed before release import'
      USING ERRCODE = '40001';
  END IF;

  SELECT
    receipt.candidate_release_import_plan_id,
    receipt.corpus_release_id,
    receipt.serving_namespace_id,
    receipt.correction_input_seal_id,
    receipt.correction_input_root,
    receipt.candidate_input_contract_fingerprint,
    receipt.candidate_input_head_id,
    receipt.candidate_input_head_payload_digest,
    receipt.correction_discharge_map_id,
    receipt.correction_discharge_map_payload_digest,
    receipt.expected_counts,
    receipt.imported_at
  INTO
    existing_plan_id,
    existing_release_id,
    existing_namespace_id,
    existing_correction_seal_id,
    existing_correction_input_root_id,
    existing_input_contract_fingerprint,
    existing_input_head_id,
    existing_input_head_payload_digest,
    existing_discharge_map_id,
    existing_discharge_map_payload_digest,
    existing_expected_counts,
    imported_at_value
  FROM canonical_v2_staging.candidate_release_import_receipts receipt
  WHERE receipt.candidate_manifest_id = manifest_id;
  IF existing_plan_id IS NOT NULL THEN
    IF existing_plan_id IS DISTINCT FROM import_plan_id
      OR existing_release_id IS DISTINCT FROM release_id
      OR existing_namespace_id IS DISTINCT FROM namespace_id
      OR existing_correction_seal_id IS DISTINCT FROM correction_seal_id
      OR existing_correction_input_root_id IS DISTINCT FROM correction_input_root_id
      OR existing_input_contract_fingerprint IS DISTINCT FROM input_authority->>'contract_fingerprint'
      OR existing_input_head_id IS DISTINCT FROM input_head_id
      OR existing_input_head_payload_digest IS DISTINCT FROM input_head_payload_digest
      OR existing_discharge_map_id IS DISTINCT FROM discharge_map_id
      OR existing_discharge_map_payload_digest IS DISTINCT FROM discharge_map_payload_digest
      OR existing_expected_counts IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'candidate manifest already imported under different content' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'schema_version', receipt_schema,
      'import_state', 'IMPORTED_COMPLETE',
      'replayed', true,
      'candidate_manifest_id', manifest_id,
      'candidate_input_authority', input_authority,
      'correction_input_seal_id', correction_seal_id,
      'correction_input_root', correction_input_root_id,
      'corpus_release_id', release_id,
      'serving_namespace_id', namespace_id,
      'candidate_release_import_plan_id', import_plan_id,
      'expected_counts', expected,
      'imported_at', imported_at_value
    );
  END IF;

  IF jsonb_typeof(p_import_plan->'correction_input_seal_record') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_import_plan->'correction_discharge_records') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'deal_directory_records') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'market_observations') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'market_exclusions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'query_records') IS DISTINCT FROM 'array'
    OR (carries_incomplete_partition AND jsonb_typeof(p_import_plan->'incomplete_canonical_records') IS DISTINCT FROM 'array')
    OR (NOT carries_incomplete_partition AND p_import_plan ? 'incomplete_canonical_records')
    OR jsonb_typeof(p_import_plan->'source_specific_records') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'exact_detail_packages') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'validated_semantic_graph_records') IS DISTINCT FROM 'array'
    OR (expected->>'correction_input_seal_records')::integer IS DISTINCT FROM 1
    OR jsonb_array_length(p_import_plan->'correction_discharge_records')
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer
    OR jsonb_array_length(p_import_plan->'deal_directory_records')
      IS DISTINCT FROM (expected->>'deal_directory_records')::integer
    OR jsonb_array_length(p_import_plan->'market_observations')
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR jsonb_array_length(p_import_plan->'market_exclusions')
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR jsonb_array_length(p_import_plan->'query_records')
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR (carries_incomplete_partition AND jsonb_array_length(p_import_plan->'incomplete_canonical_records')
      IS DISTINCT FROM (expected->>'incomplete_canonical_records')::integer)
    OR (NOT carries_incomplete_partition AND expected ? 'incomplete_canonical_records')
    OR jsonb_array_length(p_import_plan->'source_specific_records')
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR jsonb_array_length(p_import_plan->'exact_detail_packages')
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer
    OR jsonb_array_length(p_import_plan->'validated_semantic_graph_records')
      IS DISTINCT FROM (expected->>'validated_semantic_graph_records')::integer THEN
    RAISE EXCEPTION 'candidate release import counts do not match the plan' USING ERRCODE = '22023';
  END IF;
  IF (expected->>'correction_discharge_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'correction_discharges')::integer
    OR correction_seal_id IS DISTINCT FROM release_record->'canonical_payload'->>'correction_input_seal_id'
    OR correction_input_root_id IS DISTINCT FROM release_record->'canonical_payload'->'roots'->>'correction_input_root'
    OR (expected->>'deal_directory_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'deal_directory_records')::integer
    OR (expected->>'market_observations')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'observations')::integer
    OR (expected->>'market_exclusions')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'exclusions')::integer
    OR (expected->>'query_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'query_records')::integer
    OR (carries_incomplete_partition AND (expected->>'incomplete_canonical_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'incomplete_canonical_rows')::integer)
    OR (is_v5 AND release_record->'canonical_payload'->>'schema_version'
      IS DISTINCT FROM 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V2')
    OR (is_v6 AND release_record->'canonical_payload'->>'schema_version'
      IS DISTINCT FROM 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3')
    OR (NOT carries_incomplete_partition AND release_record->'canonical_payload'->>'schema_version'
      IS DISTINCT FROM 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V1')
    OR (expected->>'source_specific_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'source_specific_serving_records')::integer
    OR (expected->>'exact_detail_packages')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'exact_detail_packages')::integer
    OR (expected->>'validated_semantic_graph_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'validated_semantic_graphs')::integer THEN
    RAISE EXCEPTION 'candidate release import counts do not match the certified manifest' USING ERRCODE = '22023';
  END IF;

  IF p_import_plan->'correction_input_seal_record'->>'serving_namespace_id' IS DISTINCT FROM namespace_id
    OR p_import_plan->'correction_input_seal_record'->>'corpus_release_id' IS DISTINCT FROM release_id
    OR p_import_plan->'correction_input_seal_record'->>'contract_fingerprint' IS DISTINCT FROM contract_id
    OR p_import_plan->'correction_input_seal_record'->>'correction_input_seal_id' IS DISTINCT FROM correction_seal_id
    OR p_import_plan->'correction_input_seal_record'->>'correction_input_root' IS DISTINCT FROM correction_input_root_id
    OR p_import_plan->'correction_input_seal_record'->>'canonical_payload_digest'
      IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'canonical_payload_digest'
    OR p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'candidate_correction_input_seal_id'
      IS DISTINCT FROM correction_seal_id
    OR p_import_plan->'correction_input_seal_record'->'canonical_payload'->>'contract_fingerprint'
      IS DISTINCT FROM contract_id
    OR (p_import_plan->'correction_input_seal_record'->'canonical_payload'->'counts'->>'expected_active_applications')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'correction_applications')::integer
    OR (p_import_plan->'correction_input_seal_record'->'canonical_payload'->'counts'->>'correction_discharges')::integer
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer THEN
    RAISE EXCEPTION 'candidate correction input seal does not close over the certified manifest' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'correction_application_id', entry->>'correction_application_id',
      'correction_discharge_id', entry->>'correction_discharge_id',
      'canonical_payload_digest', entry->>'correction_discharge_payload_digest'
    ) ORDER BY entry->>'correction_application_id'), '[]'::jsonb)
    FROM jsonb_array_elements(
      p_import_plan->'correction_input_seal_record'->'canonical_payload'->'correction_entries'
    ) entry
  ) IS DISTINCT FROM (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'correction_application_id', discharge->>'correction_application_id',
      'correction_discharge_id', discharge->>'correction_discharge_id',
      'canonical_payload_digest', discharge->>'canonical_payload_digest'
    ) ORDER BY discharge->>'correction_application_id'), '[]'::jsonb)
    FROM jsonb_array_elements(p_import_plan->'correction_discharge_records') discharge
  ) THEN
    RAISE EXCEPTION 'candidate correction discharge import set does not equal its seal' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT p_import_plan->'correction_input_seal_record' AS value
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'correction_discharge_records')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'deal_directory_records')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'market_observations')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'market_exclusions')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'query_records')
      UNION ALL SELECT value FROM jsonb_array_elements(
        coalesce(p_import_plan->'incomplete_canonical_records', '[]'::jsonb)
      )
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'source_specific_records')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'exact_detail_packages')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'validated_semantic_graph_records')
    ) item
    WHERE item.value->>'serving_namespace_id' IS DISTINCT FROM namespace_id
      OR item.value->>'corpus_release_id' IS DISTINCT FROM release_id
      OR item.value->>'contract_fingerprint' IS DISTINCT FROM contract_id
  ) THEN
    RAISE EXCEPTION 'candidate release import crosses a serving partition' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT item->>'metric_slot_key'
    FROM jsonb_array_elements(p_import_plan->'market_observations') item
    INTERSECT
    SELECT item->>'metric_slot_key'
    FROM jsonb_array_elements(p_import_plan->'market_exclusions') item
  ) THEN
    RAISE EXCEPTION 'candidate release metric slot has both observation and exclusion' USING ERRCODE = '23505';
  END IF;
  IF carries_incomplete_partition AND (
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_import_plan->'incomplete_canonical_records') item
      WHERE item->'canonical_payload'->>'row_kind' IS DISTINCT FROM 'INCOMPLETE_CANONICAL_RESULT'
        OR item->>'row_serving_key'
          IS DISTINCT FROM item->'canonical_payload'->>'row_serving_key'
        OR item->>'canonical_payload_digest'
          IS DISTINCT FROM item->'canonical_payload'->>'canonical_payload_digest'
        OR item->'canonical_payload' ? 'canonical_result'
        OR item->'canonical_payload' ? 'reviewed_source_specific'
        OR item->'canonical_payload'->'incomplete_canonical_result'->>'market_comparability'
          IS DISTINCT FROM 'NOT_CERTIFIED'
        OR item->>'metric_key' IS DISTINCT FROM
          item->'canonical_payload'->'incomplete_canonical_result'->'metric_exclusion'->>'metric_key'
        OR (item->>'metric_version')::integer IS DISTINCT FROM
          (item->'canonical_payload'->'incomplete_canonical_result'->'metric_exclusion'->>'metric_version')::integer
        OR item->'canonical_payload'->'incomplete_canonical_result'->'metric_exclusion'->>'cohort_membership'
          IS DISTINCT FROM 'NO_COHORT_MEMBERSHIP'
        OR item->'canonical_payload'->'incomplete_canonical_result'->'metric_exclusion'->>'aggregate_authority'
          IS DISTINCT FROM 'NO_AGGREGATE_AUTHORITY'
        OR item->'canonical_payload'->'incomplete_canonical_result' ? 'market_context'
        OR NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_import_plan->'market_exclusions') exclusion
          WHERE exclusion->>'governed_deal_key' = item->>'governed_deal_key'
            AND exclusion->>'deal_admission_id'
              = item->'canonical_payload'->>'deal_admission_id'
            AND exclusion->>'concept_key' = item->>'concept_key'
            AND exclusion->>'metric_key' = item->>'metric_key'
            AND (exclusion->>'metric_version')::integer = (item->>'metric_version')::integer
            AND exclusion->>'party_role' = item->>'party_role'
            AND exclusion->>'party_value' = item->>'party_value'
            AND exclusion->>'party_capacity' = item->>'party_capacity'
            AND exclusion->>'basis_key' = item->>'basis_key'
            AND exclusion->>'comparability_state' = 'NOT_CERTIFIED'
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_import_plan->'market_observations') observation
          WHERE observation->>'governed_deal_key' = item->>'governed_deal_key'
            AND observation->>'concept_key' = item->>'concept_key'
            AND observation->>'metric_key' = item->>'metric_key'
            AND (observation->>'metric_version')::integer = (item->>'metric_version')::integer
            AND observation->>'party_role' = item->>'party_role'
            AND observation->>'party_value' = item->>'party_value'
            AND observation->>'party_capacity' = item->>'party_capacity'
            AND observation->>'basis_key' = item->>'basis_key'
        )
    )
    OR EXISTS (
      SELECT item->>'row_serving_key'
      FROM jsonb_array_elements(p_import_plan->'incomplete_canonical_records') item
      INTERSECT
      SELECT item->>'row_serving_key'
      FROM jsonb_array_elements(p_import_plan->'query_records') item
    )
    OR EXISTS (
      SELECT item->>'row_serving_key'
      FROM jsonb_array_elements(p_import_plan->'incomplete_canonical_records') item
      INTERSECT
      SELECT item->>'row_serving_key'
      FROM jsonb_array_elements(p_import_plan->'source_specific_records') item
    )
  ) THEN
    RAISE EXCEPTION 'incomplete canonical records cannot receive market cohort access'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'correction_discharge_records') discharge
    WHERE discharge->>'correction_application_id'
        IS DISTINCT FROM discharge->'canonical_payload'->>'correction_application_id'
      OR discharge->>'correction_discharge_id'
        IS DISTINCT FROM discharge->'canonical_payload'->>'correction_discharge_id'
      OR discharge->'canonical_payload'->>'contract_fingerprint' IS DISTINCT FROM contract_id
      OR discharge->>'canonical_payload_digest'
        IS DISTINCT FROM discharge->'canonical_payload'->>'canonical_payload_digest'
  ) THEN
    RAISE EXCEPTION 'candidate correction discharge projection is invalid' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'validated_semantic_graph_records') graph
    WHERE graph->>'validated_semantic_graph_id'
        IS DISTINCT FROM graph->'canonical_payload'->>'validated_semantic_graph_id'
      OR graph->>'document_hash' IS DISTINCT FROM graph->'canonical_payload'->>'document_hash'
      OR graph->>'canonical_text_id' IS DISTINCT FROM graph->'canonical_payload'->>'canonical_text_id'
      OR (graph->>'definition_cue_count')::integer
        IS DISTINCT FROM jsonb_array_length(graph->'canonical_payload'->'definition_cues')
      OR (graph->>'definition_use_cue_count')::integer
        IS DISTINCT FROM jsonb_array_length(graph->'canonical_payload'->'definition_use_cues')
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_import_plan->'deal_directory_records') deal
        WHERE deal->>'governed_deal_key' = graph->>'governed_deal_key'
          AND deal->>'deal_admission_id' = graph->>'deal_admission_id'
      )
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_import_plan->'exact_detail_packages') package
        CROSS JOIN LATERAL jsonb_array_elements(
          coalesce(package->'canonical_payload'->'detail_payloads', '[]'::jsonb)
        ) detail
        WHERE package->'canonical_payload'->'row'->>'governed_deal_key'
            = graph->>'governed_deal_key'
          AND package->'canonical_payload'->'row'->>'deal_admission_id'
            = graph->>'deal_admission_id'
          AND detail->'response_body'->'source_lineage'->>'source_admission_manifest_id'
            = graph->>'source_admission_manifest_id'
          AND detail->'response_body'->'source_lineage'->>'document_hash'
            = graph->>'document_hash'
          AND detail->'response_body'->'source_lineage'->>'canonical_text_id'
            = graph->>'canonical_text_id'
      )
  ) THEN
    RAISE EXCEPTION 'candidate release semantic graph lineage is invalid' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT item->>'correction_application_id') FROM jsonb_array_elements(p_import_plan->'correction_discharge_records') item)
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer
    OR (SELECT count(DISTINCT item->>'correction_discharge_id') FROM jsonb_array_elements(p_import_plan->'correction_discharge_records') item)
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer
    OR (SELECT count(DISTINCT item->>'application_deal_id') FROM jsonb_array_elements(p_import_plan->'deal_directory_records') item)
      IS DISTINCT FROM (expected->>'deal_directory_records')::integer
    OR (SELECT count(DISTINCT item->>'governed_deal_key') FROM jsonb_array_elements(p_import_plan->'deal_directory_records') item)
      IS DISTINCT FROM (expected->>'deal_directory_records')::integer
    OR (SELECT count(DISTINCT item->>'metric_slot_key') FROM jsonb_array_elements(p_import_plan->'market_observations') item)
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR (SELECT count(DISTINCT item->>'metric_slot_key') FROM jsonb_array_elements(p_import_plan->'market_exclusions') item)
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'query_records') item)
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR (carries_incomplete_partition AND (SELECT count(DISTINCT item->>'row_serving_key')
      FROM jsonb_array_elements(p_import_plan->'incomplete_canonical_records') item)
      IS DISTINCT FROM (expected->>'incomplete_canonical_records')::integer)
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'source_specific_records') item)
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'exact_detail_packages') item)
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer
    OR (SELECT count(DISTINCT item->>'validated_semantic_graph_id') FROM jsonb_array_elements(p_import_plan->'validated_semantic_graph_records') item)
      IS DISTINCT FROM (expected->>'validated_semantic_graph_records')::integer THEN
    RAISE EXCEPTION 'candidate release import contains duplicate identities' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = release_id
      AND (
        release.correction_input_seal_id IS DISTINCT FROM correction_seal_id
        OR release.correction_input_root IS DISTINCT FROM correction_input_root_id
        OR release.canonical_payload_digest IS DISTINCT FROM release_record->>'canonical_payload_digest'
      )
  ) OR EXISTS (
    SELECT 1
    FROM canonical_v2_staging.candidate_release_correction_input_seals existing
    WHERE existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND (
        existing.correction_input_seal_id IS DISTINCT FROM correction_seal_id
        OR existing.correction_input_root IS DISTINCT FROM correction_input_root_id
        OR existing.canonical_payload_digest
          IS DISTINCT FROM p_import_plan->'correction_input_seal_record'->>'canonical_payload_digest'
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'correction_discharge_records') item
    JOIN canonical_v2_staging.candidate_release_correction_discharges existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.correction_application_id = item->>'correction_application_id'
    WHERE existing.correction_discharge_id IS DISTINCT FROM item->>'correction_discharge_id'
      OR existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'deal_directory_records') item
    JOIN canonical_v2_staging.deal_serving_directory existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.application_deal_id = (item->>'application_deal_id')::uuid
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'market_observations') item
    JOIN canonical_v2_staging.market_observations existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.metric_observation_occurrence_id = item->>'metric_observation_occurrence_id'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'market_exclusions') item
    JOIN canonical_v2_staging.market_metric_slot_exclusions existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.metric_slot_key = item->>'metric_slot_key'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'query_records') item
    JOIN canonical_v2_staging.shared_serving_rows existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.row_serving_key = item->>'row_serving_key'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(p_import_plan->'incomplete_canonical_records', '[]'::jsonb)) item
    JOIN canonical_v2_staging.shared_serving_rows existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.row_serving_key = item->>'row_serving_key'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'source_specific_records') item
    JOIN canonical_v2_staging.reviewed_source_specific_serving_rows existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.row_serving_key = item->>'row_serving_key'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'exact_detail_packages') item
    JOIN canonical_v2_staging.exact_detail_serving_packages existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.row_serving_key = item->>'row_serving_key'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_import_plan->'validated_semantic_graph_records') item
    JOIN canonical_v2_staging.candidate_release_semantic_graphs existing
      ON existing.serving_namespace_id = namespace_id
      AND existing.corpus_release_id = release_id
      AND existing.validated_semantic_graph_id = item->>'validated_semantic_graph_id'
    WHERE existing.canonical_payload_digest IS DISTINCT FROM item->>'canonical_payload_digest'
  ) THEN
    RAISE EXCEPTION 'candidate release import identity conflicts with different content' USING ERRCODE = '23505';
  END IF;

  INSERT INTO canonical_v2_staging.fixture_corpus_releases
  SELECT * FROM jsonb_populate_record(NULL::canonical_v2_staging.fixture_corpus_releases, release_record)
  ON CONFLICT (corpus_release_id) DO NOTHING;
  INSERT INTO canonical_v2_staging.candidate_release_correction_input_seals
  SELECT * FROM jsonb_populate_record(
    NULL::canonical_v2_staging.candidate_release_correction_input_seals,
    p_import_plan->'correction_input_seal_record'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id) DO NOTHING;
  INSERT INTO canonical_v2_staging.candidate_release_correction_discharges
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.candidate_release_correction_discharges,
    p_import_plan->'correction_discharge_records'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, correction_application_id) DO NOTHING;
  INSERT INTO canonical_v2_staging.deal_serving_directory
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.deal_serving_directory,
    p_import_plan->'deal_directory_records'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, application_deal_id) DO NOTHING;
  INSERT INTO canonical_v2_staging.market_observations
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.market_observations,
    p_import_plan->'market_observations'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, metric_observation_occurrence_id) DO NOTHING;
  INSERT INTO canonical_v2_staging.market_metric_slot_exclusions
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.market_metric_slot_exclusions,
    p_import_plan->'market_exclusions'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, metric_slot_key) DO NOTHING;
  INSERT INTO canonical_v2_staging.shared_serving_rows
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.shared_serving_rows,
    p_import_plan->'query_records'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, row_serving_key) DO NOTHING;
  INSERT INTO canonical_v2_staging.shared_serving_rows
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.shared_serving_rows,
    coalesce(p_import_plan->'incomplete_canonical_records', '[]'::jsonb)
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, row_serving_key) DO NOTHING;
  INSERT INTO canonical_v2_staging.reviewed_source_specific_serving_rows
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.reviewed_source_specific_serving_rows,
    p_import_plan->'source_specific_records'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, row_serving_key) DO NOTHING;
  INSERT INTO canonical_v2_staging.exact_detail_serving_packages
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.exact_detail_serving_packages,
    p_import_plan->'exact_detail_packages'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, row_serving_key) DO NOTHING;
  INSERT INTO canonical_v2_staging.candidate_release_semantic_graphs
  SELECT * FROM jsonb_populate_recordset(
    NULL::canonical_v2_staging.candidate_release_semantic_graphs,
    p_import_plan->'validated_semantic_graph_records'
  ) ON CONFLICT (serving_namespace_id, corpus_release_id, validated_semantic_graph_id) DO NOTHING;

  IF (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_input_seals row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM 1
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_release_correction_discharges row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.deal_serving_directory row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'deal_directory_records')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.market_observations row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'query_records')::integer
        + coalesce((expected->>'incomplete_canonical_records')::integer, 0)
    OR (SELECT count(*) FROM canonical_v2_staging.reviewed_source_specific_serving_rows row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.candidate_release_semantic_graphs row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'validated_semantic_graph_records')::integer THEN
    RAISE EXCEPTION 'candidate release import did not close over every certified serving object' USING ERRCODE = '23514';
  END IF;

  INSERT INTO canonical_v2_staging.candidate_release_import_receipts(
    candidate_manifest_id,
    corpus_release_id,
    serving_namespace_id,
    correction_input_seal_id,
    correction_input_root,
    candidate_input_contract_fingerprint,
    candidate_input_head_id,
    candidate_input_head_payload_digest,
    correction_discharge_map_id,
    correction_discharge_map_payload_digest,
    candidate_release_import_plan_id,
    import_state,
    expected_counts
  ) VALUES (
    manifest_id,
    release_id,
    namespace_id,
    correction_seal_id,
    correction_input_root_id,
    input_authority->>'contract_fingerprint',
    input_head_id,
    input_head_payload_digest,
    discharge_map_id,
    discharge_map_payload_digest,
    import_plan_id,
    'IMPORTED_COMPLETE',
    expected
  )
  RETURNING imported_at INTO imported_at_value;

  RETURN jsonb_build_object(
    'schema_version', receipt_schema,
    'import_state', 'IMPORTED_COMPLETE',
    'replayed', false,
    'candidate_manifest_id', manifest_id,
    'candidate_input_authority', input_authority,
    'correction_input_seal_id', correction_seal_id,
    'correction_input_root', correction_input_root_id,
    'corpus_release_id', release_id,
    'serving_namespace_id', namespace_id,
    'candidate_release_import_plan_id', import_plan_id,
    'expected_counts', expected,
    'imported_at', imported_at_value
  );
END;
$$;
COMMIT;
