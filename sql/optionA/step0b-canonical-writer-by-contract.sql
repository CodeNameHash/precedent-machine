BEGIN;
SET LOCAL statement_timeout='120000ms';
-- Governed function SHA-256: 69088248539e99c13b8344cd9a5e78ce7729f1a7b47f5595bec0c83cb2e7b95c
CREATE OR REPLACE FUNCTION canonical_v2_staging.canonical_json(value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
DECLARE
  value_kind text := pg_catalog.jsonb_typeof(value);
  encoded text;
  numeric_value numeric;
BEGIN
  IF value_kind = 'null' THEN
    RETURN 'null';
  ELSIF value_kind = 'boolean' THEN
    RETURN value::text;
  ELSIF value_kind = 'number' THEN
    numeric_value := (value #>> '{}')::numeric;
    IF pg_catalog.abs(numeric_value) > 9007199254740991
      OR numeric_value <> pg_catalog.trunc(numeric_value) THEN
      RAISE EXCEPTION 'canonical JSON numbers must be JavaScript-safe integers'
        USING ERRCODE = '22003';
    END IF;
    RETURN pg_catalog.trim_scale(numeric_value)::text;
  ELSIF value_kind = 'string' THEN
    RETURN pg_catalog.to_jsonb(value #>> '{}')::text;
  ELSIF value_kind = 'array' THEN
    SELECT '[' || coalesce(
      pg_catalog.string_agg(
        canonical_v2_staging.canonical_json(element.value),
        ','
        ORDER BY element.ordinal
      ),
      ''
    ) || ']'
    INTO encoded
    FROM pg_catalog.jsonb_array_elements(value)
      WITH ORDINALITY AS element(value, ordinal);
    RETURN encoded;
  ELSIF value_kind = 'object' THEN
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(value) AS object_key(key)
      WHERE pg_catalog.octet_length(object_key.key)
        <> pg_catalog.char_length(object_key.key)
    ) THEN
      RAISE EXCEPTION 'canonical JSON object keys must be ASCII'
        USING ERRCODE = '22023';
    END IF;
    SELECT '{' || coalesce(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(entry.key)::text
          || ':'
          || canonical_v2_staging.canonical_json(entry.value),
        ','
        ORDER BY entry.key COLLATE "C"
      ),
      ''
    ) || '}'
    INTO encoded
    FROM pg_catalog.jsonb_each(value) AS entry(key, value);
    RETURN encoded;
  END IF;
  RAISE EXCEPTION 'canonical JSON received an unsupported JSON kind'
    USING ERRCODE = '22023';
END
$$;

-- Governed function SHA-256: 04da1eab5614a2ff3bd9057cfd1f20a19c5a816def10676b4736a1e13e826a91
CREATE OR REPLACE FUNCTION canonical_v2_staging.content_id(domain text, payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, extensions
AS $$
DECLARE
  domain_bytes bytea;
  canonical_payload text;
BEGIN
  IF domain IS NULL
    OR domain = ''
    OR domain IS DISTINCT FROM pg_catalog.btrim(domain)
    OR pg_catalog.octet_length(domain) > 160
    OR domain ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'content ID domain must be bounded, trimmed, non-empty text'
      USING ERRCODE = '22023';
  END IF;
  IF payload IS NULL THEN
    RAISE EXCEPTION 'content ID payload must be JSON'
      USING ERRCODE = '22023';
  END IF;
  domain_bytes := pg_catalog.convert_to(domain, 'UTF8');
  canonical_payload := canonical_v2_staging.canonical_json(payload);
  RETURN pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to('CANONICAL_CONTENT_ID/V1', 'UTF8')
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(
          pg_catalog.octet_length(domain_bytes)::text,
          'UTF8'
        )
        || pg_catalog.convert_to(':', 'UTF8')
        || domain_bytes
        || pg_catalog.decode('00', 'hex')
        || pg_catalog.convert_to(canonical_payload, 'UTF8'),
      'sha256'::text
    ),
    'hex'
  );
END
$$;

-- Governed function SHA-256: 0cf5cb3804b8ccafa9b63b6628d5b66fc826c5658115ca08160cfb6bc41b2422
CREATE OR REPLACE FUNCTION public.canonical_v2_write(
  p_environment text,
  p_operation text,
  p_idempotency_key text,
  p_input_digest text,
  p_write_set jsonb,
  p_residuals jsonb,
  p_quarantines jsonb,
  p_receipt jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
DECLARE
  existing_receipt canonical_v2_staging.write_receipts%ROWTYPE;
  current_candidate_input_head canonical_v2_staging.candidate_input_heads%ROWTYPE;
  current_candidate_input_head_exists boolean;
  item jsonb;
  expected_candidate_input_head jsonb;
  next_candidate_input_head jsonb;
  candidate_input_event jsonb;
  correction_discharge_map jsonb;
  item_id text;
  existing_digest text;
  previous_application_id text;
  item_ordinal integer;
  correction_materialisation_count integer;
  correction_map_entry_count integer;
  affected_rows integer;
  source_reference_count integer;
  persisted_reference_count integer;
  resolved_persisted_reference_count integer;
  distinct_persisted_reference_count integer;
  resolved_source_reference_count integer;
  distinct_source_ordinal_count integer;
  distinct_source_document_count integer;
  distinct_canonical_text_count integer;
  publishable_object_count integer;
  residual_count integer;
  quarantine_count integer;
  source_reference_chain_valid boolean;
  deal_document_hash_admitted boolean;
  capture jsonb;
  capture_reference jsonb;
  artifact_manifest jsonb;
  staged_artifact_manifest jsonb;
  artifact_chunk jsonb;
  assembled_artifact bytea;
  assembled_chunk_count integer;
  assembled_chunk_sha256 jsonb;
  conversion jsonb;
  verification jsonb;
  source_admission_bundle jsonb;
  immutable_source jsonb;
  source_admission jsonb;
  preparation_receipt jsonb;
  semantic_input jsonb;
  canonical_v1_input_digest text;
  canonical_v2_input_digest text;
  input_envelope_version text;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_write is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_operation NOT IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN'
  ) THEN
    RAISE EXCEPTION 'unsupported canonical operation' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(trim(p_idempotency_key)), 0) = 0
    OR p_idempotency_key IS DISTINCT FROM trim(p_idempotency_key)
    OR coalesce(length(trim(p_input_digest)), 0) = 0 THEN
    RAISE EXCEPTION 'idempotency key and input digest are required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_residuals) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_quarantines) IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'canonical writer requires a closed persistence envelope'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.pg_column_size(p_write_set)
      + pg_catalog.pg_column_size(p_residuals)
      + pg_catalog.pg_column_size(p_quarantines)
      + pg_catalog.pg_column_size(p_receipt) > 4194304 THEN
    RAISE EXCEPTION 'canonical writer persistence envelope exceeds 4 MiB'
      USING ERRCODE = '54000';
  END IF;
  canonical_v2_input_digest := canonical_v2_staging.content_id(
    'CANONICAL_WRITE_INPUT/V2',
    jsonb_build_object(
      'operation', p_operation,
      'idempotencyKey', p_idempotency_key,
      'writeSet', p_write_set,
      'residuals', p_residuals,
      'quarantines', p_quarantines
    )
  );
  canonical_v1_input_digest := canonical_v2_staging.content_id(
    'CANONICAL_WRITE_INPUT/V1',
    jsonb_build_object(
      'operation', p_operation,
      'idempotencyKey', p_idempotency_key,
      'writeSet', p_write_set
    )
  );
  IF p_input_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'canonical writer input digest does not match the exact write envelope'
      USING ERRCODE = '23514';
  ELSIF p_input_digest = canonical_v2_input_digest THEN
    input_envelope_version := 'V2';
  ELSIF p_input_digest = canonical_v1_input_digest THEN
    input_envelope_version := 'V1';
  ELSE
    RAISE EXCEPTION 'canonical writer input digest does not match the exact write envelope'
      USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
    OR NOT (p_receipt ?& ARRAY[
      'receiptId',
      'operation',
      'idempotencyKey',
      'inputDigest',
      'status',
      'publishableObjectCount',
      'residualCount',
      'quarantinedClosureCount'
    ])
    OR p_receipt - ARRAY[
      'receiptId',
      'operation',
      'idempotencyKey',
      'inputDigest',
      'status',
      'publishableObjectCount',
      'residualCount',
      'quarantinedClosureCount'
    ]::text[] <> '{}'::jsonb
    OR p_receipt->>'receiptId' !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_receipt->'operation') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_receipt->'idempotencyKey') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_receipt->'inputDigest') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_receipt->'status') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_receipt->'publishableObjectCount') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_receipt->'residualCount') IS DISTINCT FROM 'number'
    OR jsonb_typeof(p_receipt->'quarantinedClosureCount') IS DISTINCT FROM 'number'
    OR p_receipt->>'operation' IS DISTINCT FROM p_operation
    OR p_receipt->>'idempotencyKey' IS DISTINCT FROM p_idempotency_key
    OR p_receipt->>'inputDigest' IS DISTINCT FROM p_input_digest
    OR p_receipt->>'status' IS DISTINCT FROM 'COMMITTED' THEN
    RAISE EXCEPTION 'canonical writer receipt does not match its closed envelope'
      USING ERRCODE = '23514';
  END IF;
  IF p_receipt->>'receiptId' IS DISTINCT FROM canonical_v2_staging.content_id(
    'CANONICAL_WRITE_RECEIPT/V1',
    p_receipt - 'receiptId'
  ) THEN
    RAISE EXCEPTION 'canonical writer receipt ID does not match its canonical body'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    length(p_operation)::text || ':' || p_operation
      || length(p_idempotency_key)::text || ':' || p_idempotency_key,
    0
  ));
  SELECT * INTO existing_receipt
  FROM canonical_v2_staging.write_receipts
  WHERE operation = p_operation AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF existing_receipt.input_digest IS DISTINCT FROM p_input_digest THEN
      RAISE EXCEPTION 'idempotency key already names different canonical input' USING ERRCODE = '23505';
    END IF;
    IF existing_receipt.canonical_payload IS DISTINCT FROM p_receipt THEN
      RAISE EXCEPTION 'idempotency key already names a different canonical receipt'
        USING ERRCODE = '23505';
    END IF;
    IF input_envelope_version = 'V1' OR p_operation <> 'DEAL_SCOPE_RUN' THEN
      RETURN existing_receipt.canonical_payload || jsonb_build_object('replayed', true);
    END IF;
  END IF;
  IF input_envelope_version = 'V1' THEN
    RAISE EXCEPTION 'legacy canonical write input can only replay an existing receipt'
      USING ERRCODE = '23514';
  END IF;

  IF p_operation = 'INTAKE_CAPTURE' THEN
    IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
      OR NOT (p_write_set ? 'intake_capture')
      OR p_write_set - 'intake_capture' <> '{}'::jsonb
      OR jsonb_typeof(p_write_set->'intake_capture') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid intake capture write set' USING ERRCODE = '22023';
    END IF;
    IF p_residuals IS DISTINCT FROM '[]'::jsonb
      OR p_quarantines IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'intake capture does not accept residuals or quarantines'
        USING ERRCODE = '22023';
    END IF;

    item := p_write_set->'intake_capture';
    IF NOT (item ?& ARRAY[
        'schema_version',
        'receipt_stage',
        'authority_representation',
        'source_host',
        'retrieval_url_sha256',
        'retrieved_at',
        'retrieval_policy_digest',
        'http_status',
        'response_content_type',
        'redirect_count',
        'response_bytes_sha256',
        'response_byte_length',
        'response_bytes_base64',
        'source_response_content_id',
        'canonical_text_status',
        'source_admission_status',
        'intake_capture_receipt_id'
      ])
      OR item - ARRAY[
        'schema_version',
        'receipt_stage',
        'authority_representation',
        'source_host',
        'retrieval_url_sha256',
        'retrieved_at',
        'retrieval_policy_digest',
        'http_status',
        'response_content_type',
        'redirect_count',
        'response_bytes_sha256',
        'response_byte_length',
        'response_bytes_base64',
        'source_response_content_id',
        'canonical_text_status',
        'source_admission_status',
        'intake_capture_receipt_id'
      ]::text[] <> '{}'::jsonb
      OR item->>'schema_version' IS DISTINCT FROM 'SEC_EDGAR_INTAKE_CAPTURE/V1'
      OR item->>'receipt_stage' IS DISTINCT FROM 'INTAKE_CAPTURE'
      OR item->>'authority_representation' IS DISTINCT FROM 'ORIGINAL_HTTP_RESPONSE_BYTES'
      OR item->>'source_host' IS DISTINCT FROM 'www.sec.gov'
      OR item->>'http_status' IS DISTINCT FROM '200'
      OR item->>'response_content_type' IS DISTINCT FROM 'text/html'
      OR item->>'redirect_count' IS DISTINCT FROM '0'
      OR item->>'canonical_text_status' IS DISTINCT FROM 'NOT_CREATED'
      OR item->>'source_admission_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(item) AS capture_field(key, value)
        WHERE capture_field.key = ANY(ARRAY[
          'schema_version',
          'receipt_stage',
          'authority_representation',
          'source_host',
          'retrieval_url_sha256',
          'retrieved_at',
          'retrieval_policy_digest',
          'response_content_type',
          'response_bytes_sha256',
          'response_bytes_base64',
          'source_response_content_id',
          'canonical_text_status',
          'source_admission_status',
          'intake_capture_receipt_id'
        ])
          AND jsonb_typeof(capture_field.value) IS DISTINCT FROM 'string'
      )
      OR jsonb_typeof(item->'http_status') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'redirect_count') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'response_byte_length') IS DISTINCT FROM 'number'
      OR item->>'retrieval_url_sha256' !~ '^[0-9a-f]{64}$'
      OR item->>'retrieval_policy_digest' !~ '^[0-9a-f]{64}$'
      OR item->>'response_bytes_sha256' !~ '^[0-9a-f]{64}$'
      OR item->>'source_response_content_id' !~ '^[0-9a-f]{64}$'
      OR item->>'intake_capture_receipt_id' !~ '^[0-9a-f]{64}$'
      OR item->>'retrieved_at'
        !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
      OR item->>'response_byte_length' !~ '^[1-9][0-9]{0,18}$'
    THEN
      RAISE EXCEPTION 'intake capture fields do not match the closed receipt contract'
        USING ERRCODE = '23514';
    END IF;
    PERFORM (item->>'retrieved_at')::timestamptz;
    IF replace(encode(decode(item->>'response_bytes_base64', 'base64'), 'base64'), E'\n', '')
        IS DISTINCT FROM item->>'response_bytes_base64'
      OR octet_length(decode(item->>'response_bytes_base64', 'base64'))
        <> (item->>'response_byte_length')::bigint
      OR encode(extensions.digest(
          decode(item->>'response_bytes_base64', 'base64'),
          'sha256'::text
        ), 'hex') IS DISTINCT FROM item->>'response_bytes_sha256' THEN
      RAISE EXCEPTION 'intake capture bytes, length and digest do not agree'
        USING ERRCODE = '23514';
    END IF;
    IF item->>'source_response_content_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SEC_HTTP_RESPONSE_CONTENT/V1',
          jsonb_build_object(
            'authority_representation', item->'authority_representation',
            'response_content_type', item->'response_content_type',
            'response_bytes_sha256', item->'response_bytes_sha256',
            'response_byte_length', item->'response_byte_length'
          )
        )
      OR item->>'intake_capture_receipt_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'INTAKE_CAPTURE_RECEIPT/V1',
          item - 'intake_capture_receipt_id'
        ) THEN
      RAISE EXCEPTION 'intake capture content-addressed identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF p_input_digest !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
      OR NOT (p_receipt ?& ARRAY[
        'receiptId',
        'operation',
        'idempotencyKey',
        'inputDigest',
        'status',
        'publishableObjectCount',
        'residualCount',
        'quarantinedClosureCount'
      ])
      OR p_receipt - ARRAY[
        'receiptId',
        'operation',
        'idempotencyKey',
        'inputDigest',
        'status',
        'publishableObjectCount',
        'residualCount',
        'quarantinedClosureCount'
      ]::text[] <> '{}'::jsonb
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(p_receipt) AS receipt_field(key, value)
        WHERE receipt_field.key = ANY(ARRAY[
          'receiptId',
          'operation',
          'idempotencyKey',
          'inputDigest',
          'status'
        ])
          AND jsonb_typeof(receipt_field.value) IS DISTINCT FROM 'string'
      )
      OR jsonb_typeof(p_receipt->'publishableObjectCount') IS DISTINCT FROM 'number'
      OR jsonb_typeof(p_receipt->'residualCount') IS DISTINCT FROM 'number'
      OR jsonb_typeof(p_receipt->'quarantinedClosureCount') IS DISTINCT FROM 'number'
      OR p_receipt->>'receiptId' !~ '^[0-9a-f]{64}$'
      OR p_receipt->>'operation' IS DISTINCT FROM p_operation
      OR p_receipt->>'idempotencyKey' IS DISTINCT FROM p_idempotency_key
      OR p_receipt->>'inputDigest' IS DISTINCT FROM p_input_digest
      OR p_receipt->>'status' IS DISTINCT FROM 'COMMITTED'
      OR p_receipt->>'publishableObjectCount' IS DISTINCT FROM '1'
      OR p_receipt->>'residualCount' IS DISTINCT FROM '0'
      OR p_receipt->>'quarantinedClosureCount' IS DISTINCT FROM '0' THEN
      RAISE EXCEPTION 'invalid intake capture write receipt' USING ERRCODE = '23514';
    END IF;

    item_id := item->>'intake_capture_receipt_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE intake_capture_receipt_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'intake capture receipt identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.intake_capture_receipts(
      intake_capture_receipt_id,
      retrieval_url_sha256,
      response_bytes_sha256,
      response_byte_length,
      source_response_content_id,
      canonical_payload
    ) VALUES (
      item_id,
      item->>'retrieval_url_sha256',
      item->>'response_bytes_sha256',
      (item->>'response_byte_length')::bigint,
      item->>'source_response_content_id',
      item
    ) ON CONFLICT (intake_capture_receipt_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE intake_capture_receipt_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'intake capture receipt identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.write_receipts(
      operation,
      idempotency_key,
      input_digest,
      receipt_id,
      canonical_payload
    ) VALUES (
      p_operation,
      p_idempotency_key,
      p_input_digest,
      p_receipt->>'receiptId',
      p_receipt
    );
    RETURN p_receipt || jsonb_build_object('replayed', false);
  END IF;

  IF p_operation = 'STAGE_SOURCE_ARTIFACT_CHUNK' THEN
    IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
      OR NOT (p_write_set ?& ARRAY['source_artifact_manifest', 'source_artifact_chunk'])
      OR p_write_set - ARRAY[
        'source_artifact_manifest', 'source_artifact_chunk'
      ]::text[] <> '{}'::jsonb
      OR jsonb_typeof(p_write_set->'source_artifact_manifest') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_write_set->'source_artifact_chunk') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'invalid source artifact chunk staging write set'
        USING ERRCODE = '22023';
    END IF;
    IF p_residuals IS DISTINCT FROM '[]'::jsonb
      OR p_quarantines IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'source artifact chunk staging does not accept residuals or quarantines'
        USING ERRCODE = '22023';
    END IF;

    artifact_manifest := p_write_set->'source_artifact_manifest';
    artifact_chunk := p_write_set->'source_artifact_chunk';
    IF NOT (artifact_manifest ?& ARRAY[
        'schema_version', 'artifact_kind', 'payload_encoding', 'payload_byte_length',
        'payload_sha256', 'chunk_count', 'chunk_max_byte_length',
        'ordered_chunk_sha256', 'artifact_manifest_id'
      ])
      OR artifact_manifest - ARRAY[
        'schema_version', 'artifact_kind', 'payload_encoding', 'payload_byte_length',
        'payload_sha256', 'chunk_count', 'chunk_max_byte_length',
        'ordered_chunk_sha256', 'artifact_manifest_id'
      ]::text[] <> '{}'::jsonb
      OR artifact_manifest->>'schema_version' IS DISTINCT FROM 'SOURCE_ARTIFACT_MANIFEST/V1'
      OR artifact_manifest->>'artifact_kind'
        IS DISTINCT FROM 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
      OR artifact_manifest->>'payload_encoding' IS DISTINCT FROM 'CANONICAL_JSON_UTF8/V1'
      OR jsonb_typeof(artifact_manifest->'payload_byte_length') IS DISTINCT FROM 'number'
      OR jsonb_typeof(artifact_manifest->'chunk_count') IS DISTINCT FROM 'number'
      OR jsonb_typeof(artifact_manifest->'chunk_max_byte_length') IS DISTINCT FROM 'number'
      OR jsonb_typeof(artifact_manifest->'ordered_chunk_sha256') IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(artifact_manifest) AS manifest_field(key, value)
        WHERE manifest_field.key = ANY(ARRAY[
          'schema_version', 'artifact_kind', 'payload_encoding', 'payload_sha256',
          'artifact_manifest_id'
        ])
          AND jsonb_typeof(manifest_field.value) IS DISTINCT FROM 'string'
      )
      OR artifact_manifest->>'payload_byte_length' !~ '^[1-9][0-9]{0,8}$'
      OR (artifact_manifest->>'payload_byte_length')::bigint > 134217728
      OR artifact_manifest->>'chunk_count' !~ '^[1-9][0-9]{0,3}$'
      OR (artifact_manifest->>'chunk_count')::integer > 683
      OR artifact_manifest->>'chunk_max_byte_length' IS DISTINCT FROM '196608'
      OR (artifact_manifest->>'payload_byte_length')::bigint
        <= ((artifact_manifest->>'chunk_count')::bigint - 1) * 196608
      OR (artifact_manifest->>'payload_byte_length')::bigint
        > (artifact_manifest->>'chunk_count')::bigint * 196608
      OR artifact_manifest->>'payload_sha256' !~ '^[0-9a-f]{64}$'
      OR artifact_manifest->>'artifact_manifest_id' !~ '^[0-9a-f]{64}$'
      OR jsonb_array_length(artifact_manifest->'ordered_chunk_sha256')
        <> (artifact_manifest->>'chunk_count')::integer
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(artifact_manifest->'ordered_chunk_sha256') AS chunk_digest(value)
        WHERE jsonb_typeof(chunk_digest.value) IS DISTINCT FROM 'string'
          OR chunk_digest.value #>> '{}' !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'source artifact manifest does not match its closed contract'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (artifact_chunk ?& ARRAY[
        'schema_version', 'artifact_manifest_id', 'artifact_kind', 'chunk_ordinal',
        'chunk_byte_length', 'chunk_sha256', 'chunk_payload_base64', 'chunk_id'
      ])
      OR artifact_chunk - ARRAY[
        'schema_version', 'artifact_manifest_id', 'artifact_kind', 'chunk_ordinal',
        'chunk_byte_length', 'chunk_sha256', 'chunk_payload_base64', 'chunk_id'
      ]::text[] <> '{}'::jsonb
      OR artifact_chunk->>'schema_version' IS DISTINCT FROM 'SOURCE_ARTIFACT_CHUNK/V1'
      OR artifact_chunk->>'artifact_manifest_id'
        IS DISTINCT FROM artifact_manifest->>'artifact_manifest_id'
      OR artifact_chunk->>'artifact_kind' IS DISTINCT FROM artifact_manifest->>'artifact_kind'
      OR jsonb_typeof(artifact_chunk->'chunk_ordinal') IS DISTINCT FROM 'number'
      OR jsonb_typeof(artifact_chunk->'chunk_byte_length') IS DISTINCT FROM 'number'
      OR jsonb_typeof(artifact_chunk->'chunk_payload_base64') IS DISTINCT FROM 'string'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(artifact_chunk) AS chunk_field(key, value)
        WHERE chunk_field.key = ANY(ARRAY[
          'schema_version', 'artifact_manifest_id', 'artifact_kind', 'chunk_sha256',
          'chunk_payload_base64', 'chunk_id'
        ])
          AND jsonb_typeof(chunk_field.value) IS DISTINCT FROM 'string'
      )
      OR artifact_chunk->>'chunk_ordinal' !~ '^(0|[1-9][0-9]{0,3})$'
      OR (artifact_chunk->>'chunk_ordinal')::integer
        >= (artifact_manifest->>'chunk_count')::integer
      OR artifact_chunk->>'chunk_byte_length' !~ '^[1-9][0-9]{0,5}$'
      OR (artifact_chunk->>'chunk_byte_length')::integer > 196608
      OR (artifact_chunk->>'chunk_byte_length')::integer IS DISTINCT FROM (CASE
        WHEN (artifact_chunk->>'chunk_ordinal')::integer
          < ((artifact_manifest->>'chunk_count')::integer - 1) THEN 196608
        ELSE (
          (artifact_manifest->>'payload_byte_length')::bigint
          - ((artifact_manifest->>'chunk_count')::bigint - 1) * 196608
        )::integer
      END)
      OR artifact_chunk->>'chunk_sha256' !~ '^[0-9a-f]{64}$'
      OR artifact_chunk->>'chunk_id' !~ '^[0-9a-f]{64}$'
      OR artifact_manifest->'ordered_chunk_sha256'
          ->> (artifact_chunk->>'chunk_ordinal')::integer
        IS DISTINCT FROM artifact_chunk->>'chunk_sha256'
      OR replace(encode(
          decode(artifact_chunk->>'chunk_payload_base64', 'base64'), 'base64'
        ), E'\n', '') IS DISTINCT FROM artifact_chunk->>'chunk_payload_base64'
      OR octet_length(decode(artifact_chunk->>'chunk_payload_base64', 'base64'))
        <> (artifact_chunk->>'chunk_byte_length')::integer
      OR encode(extensions.digest(
          decode(artifact_chunk->>'chunk_payload_base64', 'base64'), 'sha256'::text
        ), 'hex') IS DISTINCT FROM artifact_chunk->>'chunk_sha256' THEN
      RAISE EXCEPTION 'source artifact chunk does not match its closed contract'
        USING ERRCODE = '23514';
    END IF;
    IF artifact_manifest->>'artifact_manifest_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ARTIFACT_MANIFEST/V1',
          artifact_manifest - 'artifact_manifest_id'
        ) THEN
      RAISE EXCEPTION 'source artifact manifest identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF artifact_chunk->>'chunk_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ARTIFACT_CHUNK/V1',
          artifact_chunk - 'chunk_id'
        ) THEN
      RAISE EXCEPTION 'source artifact chunk identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;

    IF p_input_digest !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
      OR NOT (p_receipt ?& ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ])
      OR p_receipt - ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ]::text[] <> '{}'::jsonb
      OR p_receipt->>'receiptId' !~ '^[0-9a-f]{64}$'
      OR p_receipt->>'operation' IS DISTINCT FROM p_operation
      OR p_receipt->>'idempotencyKey' IS DISTINCT FROM p_idempotency_key
      OR p_receipt->>'inputDigest' IS DISTINCT FROM p_input_digest
      OR p_receipt->>'status' IS DISTINCT FROM 'COMMITTED'
      OR p_receipt->>'publishableObjectCount' IS DISTINCT FROM '2'
      OR p_receipt->>'residualCount' IS DISTINCT FROM '0'
      OR p_receipt->>'quarantinedClosureCount' IS DISTINCT FROM '0' THEN
      RAISE EXCEPTION 'invalid source artifact chunk staging receipt'
        USING ERRCODE = '23514';
    END IF;

    item_id := artifact_manifest->>'artifact_manifest_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_artifact_manifests
    WHERE artifact_manifest_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(artifact_manifest) THEN
      RAISE EXCEPTION 'source artifact manifest identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.source_artifact_manifests(
      artifact_manifest_id, artifact_kind, payload_encoding, payload_byte_length,
      payload_sha256, chunk_count, chunk_max_byte_length, ordered_chunk_sha256,
      canonical_payload
    ) VALUES (
      item_id, artifact_manifest->>'artifact_kind', artifact_manifest->>'payload_encoding',
      (artifact_manifest->>'payload_byte_length')::bigint,
      artifact_manifest->>'payload_sha256', (artifact_manifest->>'chunk_count')::integer,
      (artifact_manifest->>'chunk_max_byte_length')::integer,
      artifact_manifest->'ordered_chunk_sha256', artifact_manifest
    ) ON CONFLICT (artifact_manifest_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_artifact_manifests
    WHERE artifact_manifest_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(artifact_manifest) THEN
      RAISE EXCEPTION 'source artifact manifest identity conflict' USING ERRCODE = '23505';
    END IF;

    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_artifact_chunks
    WHERE artifact_manifest_id = item_id
      AND chunk_ordinal = (artifact_chunk->>'chunk_ordinal')::integer;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(artifact_chunk) THEN
      RAISE EXCEPTION 'source artifact chunk ordinal identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.source_artifact_chunks(
      artifact_manifest_id, chunk_ordinal, artifact_kind, chunk_byte_length,
      chunk_sha256, chunk_id, chunk_payload, canonical_payload
    ) VALUES (
      item_id, (artifact_chunk->>'chunk_ordinal')::integer,
      artifact_chunk->>'artifact_kind', (artifact_chunk->>'chunk_byte_length')::integer,
      artifact_chunk->>'chunk_sha256', artifact_chunk->>'chunk_id',
      decode(artifact_chunk->>'chunk_payload_base64', 'base64'), artifact_chunk
    ) ON CONFLICT (artifact_manifest_id, chunk_ordinal) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_artifact_chunks
    WHERE artifact_manifest_id = item_id
      AND chunk_ordinal = (artifact_chunk->>'chunk_ordinal')::integer;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(artifact_chunk) THEN
      RAISE EXCEPTION 'source artifact chunk ordinal identity conflict' USING ERRCODE = '23505';
    END IF;

    INSERT INTO canonical_v2_staging.write_receipts(
      operation, idempotency_key, input_digest, receipt_id, canonical_payload
    ) VALUES (
      p_operation, p_idempotency_key, p_input_digest, p_receipt->>'receiptId', p_receipt
    );
    RETURN p_receipt || jsonb_build_object('replayed', false);
  END IF;

  IF p_operation = 'PREPARE_SOURCE_ADMISSION' THEN
    IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
      OR NOT (p_write_set ?& ARRAY[
        'capture_reference', 'conversion_artifact_manifest',
        'verification', 'source_admission_bundle'
      ])
      OR p_write_set - ARRAY[
        'capture_reference', 'conversion_artifact_manifest',
        'verification', 'source_admission_bundle'
      ]::text[] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'invalid source admission preparation write set'
        USING ERRCODE = '22023';
    END IF;
    IF p_residuals IS DISTINCT FROM '[]'::jsonb
      OR p_quarantines IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION 'source admission preparation does not accept residuals or quarantines'
        USING ERRCODE = '22023';
    END IF;

    capture_reference := p_write_set->'capture_reference';
    artifact_manifest := p_write_set->'conversion_artifact_manifest';
    verification := p_write_set->'verification';
    source_admission_bundle := p_write_set->'source_admission_bundle';
    IF jsonb_typeof(capture_reference) IS DISTINCT FROM 'object'
      OR jsonb_typeof(artifact_manifest) IS DISTINCT FROM 'object'
      OR jsonb_typeof(verification) IS DISTINCT FROM 'object'
      OR jsonb_typeof(source_admission_bundle) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'source admission preparation objects are required'
        USING ERRCODE = '22023';
    END IF;

    IF NOT (capture_reference ?& ARRAY[
        'schema_version', 'intake_capture_receipt_id', 'source_response_content_id'
      ])
      OR capture_reference - ARRAY[
        'schema_version', 'intake_capture_receipt_id', 'source_response_content_id'
      ]::text[] <> '{}'::jsonb
      OR capture_reference->>'schema_version' IS DISTINCT FROM 'INTAKE_CAPTURE_REFERENCE/V1'
      OR capture_reference->>'intake_capture_receipt_id' !~ '^[0-9a-f]{64}$'
      OR capture_reference->>'source_response_content_id' !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'intake capture reference does not match its closed contract'
        USING ERRCODE = '23514';
    END IF;

    SELECT canonical_payload INTO capture
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE intake_capture_receipt_id = capture_reference->>'intake_capture_receipt_id';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'source admission capture was not written by INTAKE_CAPTURE'
        USING ERRCODE = '23503';
    END IF;
    IF capture->>'source_response_content_id'
        IS DISTINCT FROM capture_reference->>'source_response_content_id' THEN
      RAISE EXCEPTION 'stored intake capture does not match the supplied reference'
        USING ERRCODE = '23514';
    END IF;

    SELECT canonical_payload INTO staged_artifact_manifest
    FROM canonical_v2_staging.source_artifact_manifests
    WHERE artifact_manifest_id = artifact_manifest->>'artifact_manifest_id';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'conversion artifact manifest was not staged'
        USING ERRCODE = '23503';
    END IF;
    IF staged_artifact_manifest IS DISTINCT FROM artifact_manifest THEN
      RAISE EXCEPTION 'staged conversion artifact manifest does not match the supplied manifest'
        USING ERRCODE = '23514';
    END IF;
    IF artifact_manifest->>'schema_version' IS DISTINCT FROM 'SOURCE_ARTIFACT_MANIFEST/V1'
      OR artifact_manifest->>'artifact_kind'
        IS DISTINCT FROM 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
      OR artifact_manifest->>'payload_encoding' IS DISTINCT FROM 'CANONICAL_JSON_UTF8/V1'
      OR artifact_manifest->>'chunk_max_byte_length' IS DISTINCT FROM '196608' THEN
      RAISE EXCEPTION 'conversion artifact manifest has invalid kind or encoding'
        USING ERRCODE = '23514';
    END IF;

    SELECT
      count(*)::integer,
      jsonb_agg(to_jsonb(staged_chunk.chunk_sha256) ORDER BY staged_chunk.chunk_ordinal),
      decode(
        string_agg(encode(staged_chunk.chunk_payload, 'hex'), '' ORDER BY staged_chunk.chunk_ordinal),
        'hex'
      )
    INTO assembled_chunk_count, assembled_chunk_sha256, assembled_artifact
    FROM canonical_v2_staging.source_artifact_chunks AS staged_chunk
    WHERE staged_chunk.artifact_manifest_id = artifact_manifest->>'artifact_manifest_id'
      AND staged_chunk.artifact_kind = artifact_manifest->>'artifact_kind';

    IF assembled_chunk_count IS DISTINCT FROM (artifact_manifest->>'chunk_count')::integer
      OR assembled_chunk_sha256 IS DISTINCT FROM artifact_manifest->'ordered_chunk_sha256'
      OR assembled_artifact IS NULL
      OR octet_length(assembled_artifact)
        <> (artifact_manifest->>'payload_byte_length')::bigint
      OR encode(extensions.digest(assembled_artifact, 'sha256'::text), 'hex')
        IS DISTINCT FROM artifact_manifest->>'payload_sha256' THEN
      RAISE EXCEPTION 'staged conversion artifact is missing, extra, mixed or tampered'
        USING ERRCODE = '23514';
    END IF;

    conversion := convert_from(assembled_artifact, 'UTF8')::jsonb;
    IF jsonb_typeof(conversion) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'assembled conversion artifact is not one canonical JSON object'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (conversion ?& ARRAY[
        'schema_version', 'conversion_stage', 'verification_status',
        'source_admission_status', 'source_response_content_id',
        'intake_capture_receipt_id', 'converter_digest', 'converter_config_digest',
        'canonical_text', 'canonical_text_sha256', 'canonical_text_byte_length',
        'source_map_encoding', 'source_map_payload_base64',
        'source_map_compressed_sha256', 'source_map_uncompressed_byte_length',
        'input_region_count', 'output_mapping_count', 'source_map_digest',
        'canonical_text_id'
      ])
      OR conversion - ARRAY[
        'schema_version', 'conversion_stage', 'verification_status',
        'source_admission_status', 'source_response_content_id',
        'intake_capture_receipt_id', 'converter_digest', 'converter_config_digest',
        'canonical_text', 'canonical_text_sha256', 'canonical_text_byte_length',
        'source_map_encoding', 'source_map_payload_base64',
        'source_map_compressed_sha256', 'source_map_uncompressed_byte_length',
        'input_region_count', 'output_mapping_count', 'source_map_digest',
        'canonical_text_id'
      ]::text[] <> '{}'::jsonb
      OR conversion->>'schema_version' IS DISTINCT FROM 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
      OR conversion->>'conversion_stage' IS DISTINCT FROM 'CONVERSION_ONLY'
      OR conversion->>'verification_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR conversion->>'source_admission_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR conversion->>'source_map_encoding'
        IS DISTINCT FROM 'DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1'
      OR jsonb_typeof(conversion->'canonical_text') IS DISTINCT FROM 'string'
      OR jsonb_typeof(conversion->'source_map_payload_base64') IS DISTINCT FROM 'string'
      OR jsonb_typeof(conversion->'canonical_text_byte_length') IS DISTINCT FROM 'number'
      OR jsonb_typeof(conversion->'source_map_uncompressed_byte_length')
        IS DISTINCT FROM 'number'
      OR jsonb_typeof(conversion->'input_region_count') IS DISTINCT FROM 'number'
      OR jsonb_typeof(conversion->'output_mapping_count') IS DISTINCT FROM 'number'
      OR conversion->>'canonical_text_byte_length' !~ '^[1-9][0-9]{0,18}$'
      OR conversion->>'source_map_uncompressed_byte_length' !~ '^[1-9][0-9]{0,7}$'
      OR (conversion->>'source_map_uncompressed_byte_length')::bigint > 67108864
      OR conversion->>'input_region_count' !~ '^(0|[1-9][0-9]{0,7})$'
      OR conversion->>'output_mapping_count' !~ '^(0|[1-9][0-9]{0,7})$'
      OR octet_length(convert_to(conversion->>'canonical_text', 'UTF8'))
        <> (conversion->>'canonical_text_byte_length')::bigint
      OR encode(extensions.digest(
          convert_to(conversion->>'canonical_text', 'UTF8'), 'sha256'::text
        ), 'hex') IS DISTINCT FROM conversion->>'canonical_text_sha256'
      OR replace(encode(
          decode(conversion->>'source_map_payload_base64', 'base64'), 'base64'
        ), E'\n', '') IS DISTINCT FROM conversion->>'source_map_payload_base64'
      OR octet_length(decode(conversion->>'source_map_payload_base64', 'base64'))
        NOT BETWEEN 1 AND 67108864
      OR encode(extensions.digest(
          decode(conversion->>'source_map_payload_base64', 'base64'), 'sha256'::text
        ), 'hex') IS DISTINCT FROM conversion->>'source_map_compressed_sha256'
      OR conversion->>'source_response_content_id'
        IS DISTINCT FROM capture->>'source_response_content_id'
      OR conversion->>'intake_capture_receipt_id'
        IS DISTINCT FROM capture->>'intake_capture_receipt_id'
      OR EXISTS (
        SELECT 1 FROM jsonb_each(conversion) AS conversion_field(key, value)
        WHERE conversion_field.key = ANY(ARRAY[
          'schema_version', 'conversion_stage', 'verification_status',
          'source_admission_status', 'source_response_content_id',
          'intake_capture_receipt_id', 'converter_digest', 'converter_config_digest',
          'canonical_text', 'canonical_text_sha256', 'source_map_encoding',
          'source_map_payload_base64', 'source_map_compressed_sha256',
          'source_map_digest', 'canonical_text_id'
        ]) AND jsonb_typeof(conversion_field.value) IS DISTINCT FROM 'string'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          conversion->>'source_response_content_id', conversion->>'intake_capture_receipt_id',
          conversion->>'converter_digest', conversion->>'converter_config_digest',
          conversion->>'canonical_text_sha256', conversion->>'source_map_compressed_sha256',
          conversion->>'source_map_digest', conversion->>'canonical_text_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'conversion does not match the closed canonical text contract'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (verification ?& ARRAY[
        'schema_version', 'verification_stage', 'verification_status',
        'source_admission_status', 'source_response_content_id',
        'intake_capture_receipt_id', 'canonical_text_id', 'converter_digest',
        'converter_config_digest', 'verifier_digest', 'canonical_text_sha256',
        'canonical_text_byte_length', 'source_map_digest', 'input_region_count',
        'output_mapping_count', 'verification_manifest_id'
      ])
      OR verification - ARRAY[
        'schema_version', 'verification_stage', 'verification_status',
        'source_admission_status', 'source_response_content_id',
        'intake_capture_receipt_id', 'canonical_text_id', 'converter_digest',
        'converter_config_digest', 'verifier_digest', 'canonical_text_sha256',
        'canonical_text_byte_length', 'source_map_digest', 'input_region_count',
        'output_mapping_count', 'verification_manifest_id'
      ]::text[] <> '{}'::jsonb
      OR verification->>'schema_version'
        IS DISTINCT FROM 'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1'
      OR verification->>'verification_stage'
        IS DISTINCT FROM 'INDEPENDENT_CANONICAL_TEXT_VERIFICATION'
      OR verification->>'verification_status' IS DISTINCT FROM 'PASS'
      OR verification->>'source_admission_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR jsonb_typeof(verification->'canonical_text_byte_length') IS DISTINCT FROM 'number'
      OR jsonb_typeof(verification->'input_region_count') IS DISTINCT FROM 'number'
      OR jsonb_typeof(verification->'output_mapping_count') IS DISTINCT FROM 'number'
      OR verification->>'canonical_text_byte_length'
        IS DISTINCT FROM conversion->>'canonical_text_byte_length'
      OR verification->>'input_region_count'
        IS DISTINCT FROM conversion->>'input_region_count'
      OR verification->>'output_mapping_count'
        IS DISTINCT FROM conversion->>'output_mapping_count'
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          verification->>'source_response_content_id', verification->>'intake_capture_receipt_id',
          verification->>'canonical_text_id', verification->>'converter_digest',
          verification->>'converter_config_digest', verification->>'verifier_digest',
          verification->>'canonical_text_sha256', verification->>'source_map_digest',
          verification->>'verification_manifest_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      )
      OR verification->>'source_response_content_id'
        IS DISTINCT FROM conversion->>'source_response_content_id'
      OR verification->>'intake_capture_receipt_id'
        IS DISTINCT FROM conversion->>'intake_capture_receipt_id'
      OR verification->>'canonical_text_id' IS DISTINCT FROM conversion->>'canonical_text_id'
      OR verification->>'converter_digest' IS DISTINCT FROM conversion->>'converter_digest'
      OR verification->>'converter_config_digest'
        IS DISTINCT FROM conversion->>'converter_config_digest'
      OR verification->>'canonical_text_sha256'
        IS DISTINCT FROM conversion->>'canonical_text_sha256'
      OR verification->>'source_map_digest' IS DISTINCT FROM conversion->>'source_map_digest' THEN
      RAISE EXCEPTION 'verification does not match the closed PASS manifest contract'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (source_admission_bundle ?& ARRAY[
        'schema_version', 'immutable_source_document', 'source_admission_manifest',
        'source_admission_preparation_receipt', 'semantic_extraction_input_envelope',
        'verified_sec_source_admission_bundle_id'
      ])
      OR source_admission_bundle - ARRAY[
        'schema_version', 'immutable_source_document', 'source_admission_manifest',
        'source_admission_preparation_receipt', 'semantic_extraction_input_envelope',
        'verified_sec_source_admission_bundle_id'
      ]::text[] <> '{}'::jsonb
      OR source_admission_bundle->>'schema_version'
        IS DISTINCT FROM 'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1'
      OR source_admission_bundle->>'verified_sec_source_admission_bundle_id'
        !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'source admission bundle does not match its closed contract'
        USING ERRCODE = '23514';
    END IF;

    immutable_source := source_admission_bundle->'immutable_source_document';
    source_admission := source_admission_bundle->'source_admission_manifest';
    preparation_receipt := source_admission_bundle->'source_admission_preparation_receipt';
    semantic_input := source_admission_bundle->'semantic_extraction_input_envelope';
    IF jsonb_typeof(immutable_source) IS DISTINCT FROM 'object'
      OR NOT (immutable_source ?& ARRAY[
        'schema_version', 'source_kind', 'authority_representation',
        'source_response_content_id', 'intake_capture_receipt_id', 'response_content_type',
        'response_bytes_sha256', 'response_byte_length', 'canonical_text_id',
        'canonical_text_sha256', 'canonical_text_byte_length', 'converter_digest',
        'converter_config_digest', 'source_map_encoding', 'source_map_compressed_sha256',
        'source_map_uncompressed_byte_length', 'input_region_count',
        'output_mapping_count', 'source_map_digest', 'verifier_digest',
        'verification_manifest_id', 'immutable_source_document_id'
      ])
      OR immutable_source - ARRAY[
        'schema_version', 'source_kind', 'authority_representation',
        'source_response_content_id', 'intake_capture_receipt_id', 'response_content_type',
        'response_bytes_sha256', 'response_byte_length', 'canonical_text_id',
        'canonical_text_sha256', 'canonical_text_byte_length', 'converter_digest',
        'converter_config_digest', 'source_map_encoding', 'source_map_compressed_sha256',
        'source_map_uncompressed_byte_length', 'input_region_count',
        'output_mapping_count', 'source_map_digest', 'verifier_digest',
        'verification_manifest_id', 'immutable_source_document_id'
      ]::text[] <> '{}'::jsonb
      OR immutable_source->>'schema_version' IS DISTINCT FROM 'IMMUTABLE_SOURCE_DOCUMENT/V2'
      OR immutable_source->>'source_kind' IS DISTINCT FROM 'ORIGINAL_BYTES'
      OR immutable_source->>'authority_representation'
        IS DISTINCT FROM 'ORIGINAL_HTTP_RESPONSE_BYTES'
      OR immutable_source->>'response_content_type' IS DISTINCT FROM 'text/html'
      OR immutable_source->>'source_response_content_id'
        IS DISTINCT FROM capture->>'source_response_content_id'
      OR immutable_source->>'intake_capture_receipt_id'
        IS DISTINCT FROM capture->>'intake_capture_receipt_id'
      OR immutable_source->>'response_bytes_sha256'
        IS DISTINCT FROM capture->>'response_bytes_sha256'
      OR immutable_source->>'response_byte_length'
        IS DISTINCT FROM capture->>'response_byte_length'
      OR immutable_source->>'canonical_text_id' IS DISTINCT FROM conversion->>'canonical_text_id'
      OR immutable_source->>'canonical_text_sha256'
        IS DISTINCT FROM conversion->>'canonical_text_sha256'
      OR immutable_source->>'canonical_text_byte_length'
        IS DISTINCT FROM conversion->>'canonical_text_byte_length'
      OR immutable_source->>'converter_digest' IS DISTINCT FROM conversion->>'converter_digest'
      OR immutable_source->>'converter_config_digest'
        IS DISTINCT FROM conversion->>'converter_config_digest'
      OR immutable_source->'source_map_encoding'
        IS DISTINCT FROM conversion->'source_map_encoding'
      OR immutable_source->'source_map_compressed_sha256'
        IS DISTINCT FROM conversion->'source_map_compressed_sha256'
      OR immutable_source->'source_map_uncompressed_byte_length'
        IS DISTINCT FROM conversion->'source_map_uncompressed_byte_length'
      OR immutable_source->'input_region_count'
        IS DISTINCT FROM conversion->'input_region_count'
      OR immutable_source->'output_mapping_count'
        IS DISTINCT FROM conversion->'output_mapping_count'
      OR immutable_source->'source_map_digest' IS DISTINCT FROM conversion->'source_map_digest'
      OR immutable_source->>'verifier_digest' IS DISTINCT FROM verification->>'verifier_digest'
      OR immutable_source->>'verification_manifest_id'
        IS DISTINCT FROM verification->>'verification_manifest_id'
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          immutable_source->>'source_response_content_id',
          immutable_source->>'intake_capture_receipt_id',
          immutable_source->>'response_bytes_sha256', immutable_source->>'canonical_text_id',
          immutable_source->>'canonical_text_sha256', immutable_source->>'converter_digest',
          immutable_source->>'converter_config_digest',
          immutable_source->>'source_map_compressed_sha256', immutable_source->>'source_map_digest',
          immutable_source->>'verifier_digest', immutable_source->>'verification_manifest_id',
          immutable_source->>'immutable_source_document_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'immutable source does not match verified source lineage'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(source_admission) IS DISTINCT FROM 'object'
      OR NOT (source_admission ?& ARRAY[
        'schema_version', 'admission_state', 'source_kind', 'immutable_source_document_id',
        'source_response_content_id', 'canonical_text_id', 'verification_manifest_id',
        'admitted_intervals', 'excluded_intervals', 'conversion_loss_residual_ids',
        'discrepancy_count', 'blocking_discrepancy_count', 'coverage_proof_digest',
        'source_admission_manifest_id'
      ])
      OR source_admission - ARRAY[
        'schema_version', 'admission_state', 'source_kind', 'immutable_source_document_id',
        'source_response_content_id', 'canonical_text_id', 'verification_manifest_id',
        'admitted_intervals', 'excluded_intervals', 'conversion_loss_residual_ids',
        'discrepancy_count', 'blocking_discrepancy_count', 'coverage_proof_digest',
        'source_admission_manifest_id'
      ]::text[] <> '{}'::jsonb
      OR source_admission->>'schema_version' IS DISTINCT FROM 'SOURCE_ADMISSION_MANIFEST/V2'
      OR source_admission->>'admission_state' IS DISTINCT FROM 'VERIFIED'
      OR source_admission->>'source_kind' IS DISTINCT FROM 'ORIGINAL_BYTES'
      OR source_admission->>'immutable_source_document_id'
        IS DISTINCT FROM immutable_source->>'immutable_source_document_id'
      OR source_admission->>'source_response_content_id'
        IS DISTINCT FROM capture->>'source_response_content_id'
      OR source_admission->>'canonical_text_id' IS DISTINCT FROM conversion->>'canonical_text_id'
      OR source_admission->>'verification_manifest_id'
        IS DISTINCT FROM verification->>'verification_manifest_id'
      OR source_admission->'admitted_intervals' IS DISTINCT FROM jsonb_build_array(
        jsonb_build_object('start', 0, 'end', conversion->'canonical_text_byte_length')
      )
      OR source_admission->'excluded_intervals' IS DISTINCT FROM '[]'::jsonb
      OR source_admission->'conversion_loss_residual_ids' IS DISTINCT FROM '[]'::jsonb
      OR source_admission->>'discrepancy_count' IS DISTINCT FROM '0'
      OR source_admission->>'blocking_discrepancy_count' IS DISTINCT FROM '0'
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          source_admission->>'immutable_source_document_id',
          source_admission->>'source_response_content_id', source_admission->>'canonical_text_id',
          source_admission->>'verification_manifest_id', source_admission->>'coverage_proof_digest',
          source_admission->>'source_admission_manifest_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'source admission must be VERIFIED with complete zero-discrepancy coverage'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(preparation_receipt) IS DISTINCT FROM 'object'
      OR NOT (preparation_receipt ?& ARRAY[
        'schema_version', 'operation', 'action', 'preparation_slot_id',
        'immutable_source_document_id', 'canonical_text_id', 'verification_manifest_id',
        'source_admission_manifest_id', 'semantic_extraction_status', 'terminal_status',
        'source_admission_preparation_receipt_id'
      ])
      OR preparation_receipt - ARRAY[
        'schema_version', 'operation', 'action', 'preparation_slot_id',
        'immutable_source_document_id', 'canonical_text_id', 'verification_manifest_id',
        'source_admission_manifest_id', 'semantic_extraction_status', 'terminal_status',
        'source_admission_preparation_receipt_id'
      ]::text[] <> '{}'::jsonb
      OR preparation_receipt->>'schema_version'
        IS DISTINCT FROM 'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1'
      OR preparation_receipt->>'operation' IS DISTINCT FROM 'DEAL_SCOPE_RUN'
      OR preparation_receipt->>'action' IS DISTINCT FROM 'PREPARE_SOURCE_ADMISSION'
      OR preparation_receipt->>'semantic_extraction_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR preparation_receipt->>'terminal_status' IS DISTINCT FROM 'PASS'
      OR preparation_receipt->>'immutable_source_document_id'
        IS DISTINCT FROM immutable_source->>'immutable_source_document_id'
      OR preparation_receipt->>'canonical_text_id' IS DISTINCT FROM conversion->>'canonical_text_id'
      OR preparation_receipt->>'verification_manifest_id'
        IS DISTINCT FROM verification->>'verification_manifest_id'
      OR preparation_receipt->>'source_admission_manifest_id'
        IS DISTINCT FROM source_admission->>'source_admission_manifest_id'
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          preparation_receipt->>'preparation_slot_id',
          preparation_receipt->>'immutable_source_document_id',
          preparation_receipt->>'canonical_text_id', preparation_receipt->>'verification_manifest_id',
          preparation_receipt->>'source_admission_manifest_id',
          preparation_receipt->>'source_admission_preparation_receipt_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'source admission preparation receipt has invalid lineage or status'
        USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(semantic_input) IS DISTINCT FROM 'object'
      OR NOT (semantic_input ?& ARRAY[
        'schema_version', 'input_status', 'coordinate_system', 'immutable_source_document_id',
        'source_admission_manifest_id', 'canonical_text_id', 'canonical_text_sha256',
        'canonical_text_byte_length', 'source_map_encoding', 'source_map_compressed_sha256',
        'source_map_uncompressed_byte_length', 'input_region_count',
        'output_mapping_count', 'source_map_digest', 'verification_manifest_id',
        'admitted_intervals', 'excluded_intervals', 'semantic_extraction_status',
        'semantic_extraction_input_envelope_id'
      ])
      OR semantic_input - ARRAY[
        'schema_version', 'input_status', 'coordinate_system', 'immutable_source_document_id',
        'source_admission_manifest_id', 'canonical_text_id', 'canonical_text_sha256',
        'canonical_text_byte_length', 'source_map_encoding', 'source_map_compressed_sha256',
        'source_map_uncompressed_byte_length', 'input_region_count',
        'output_mapping_count', 'source_map_digest', 'verification_manifest_id',
        'admitted_intervals', 'excluded_intervals', 'semantic_extraction_status',
        'semantic_extraction_input_envelope_id'
      ]::text[] <> '{}'::jsonb
      OR semantic_input->>'schema_version'
        IS DISTINCT FROM 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1'
      OR semantic_input->>'input_status' IS DISTINCT FROM 'READY_FOR_OFFLINE_PROPOSAL'
      OR semantic_input->>'coordinate_system' IS DISTINCT FROM 'UTF8_CANONICAL_TEXT_HALF_OPEN'
      OR semantic_input->>'semantic_extraction_status' IS DISTINCT FROM 'NOT_ATTEMPTED'
      OR semantic_input->>'immutable_source_document_id'
        IS DISTINCT FROM immutable_source->>'immutable_source_document_id'
      OR semantic_input->>'source_admission_manifest_id'
        IS DISTINCT FROM source_admission->>'source_admission_manifest_id'
      OR semantic_input->>'canonical_text_id' IS DISTINCT FROM conversion->>'canonical_text_id'
      OR semantic_input->>'canonical_text_sha256'
        IS DISTINCT FROM conversion->>'canonical_text_sha256'
      OR semantic_input->>'canonical_text_byte_length'
        IS DISTINCT FROM conversion->>'canonical_text_byte_length'
      OR semantic_input->'source_map_encoding'
        IS DISTINCT FROM conversion->'source_map_encoding'
      OR semantic_input->'source_map_compressed_sha256'
        IS DISTINCT FROM conversion->'source_map_compressed_sha256'
      OR semantic_input->'source_map_uncompressed_byte_length'
        IS DISTINCT FROM conversion->'source_map_uncompressed_byte_length'
      OR semantic_input->'input_region_count'
        IS DISTINCT FROM conversion->'input_region_count'
      OR semantic_input->'output_mapping_count'
        IS DISTINCT FROM conversion->'output_mapping_count'
      OR semantic_input->'source_map_digest' IS DISTINCT FROM conversion->'source_map_digest'
      OR semantic_input->>'verification_manifest_id'
        IS DISTINCT FROM verification->>'verification_manifest_id'
      OR semantic_input->'admitted_intervals'
        IS DISTINCT FROM source_admission->'admitted_intervals'
      OR semantic_input->'excluded_intervals' IS DISTINCT FROM '[]'::jsonb
      OR EXISTS (
        SELECT 1 FROM unnest(ARRAY[
          semantic_input->>'immutable_source_document_id',
          semantic_input->>'source_admission_manifest_id', semantic_input->>'canonical_text_id',
          semantic_input->>'canonical_text_sha256',
          semantic_input->>'source_map_compressed_sha256', semantic_input->>'source_map_digest',
          semantic_input->>'verification_manifest_id',
          semantic_input->>'semantic_extraction_input_envelope_id'
        ]) AS digest(value) WHERE digest.value !~ '^[0-9a-f]{64}$'
      ) THEN
      RAISE EXCEPTION 'semantic extraction input is not the exact admitted source envelope'
        USING ERRCODE = '23514';
    END IF;

    IF p_input_digest !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
      OR NOT (p_receipt ?& ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ])
      OR p_receipt - ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ]::text[] <> '{}'::jsonb
      OR p_receipt->>'receiptId' !~ '^[0-9a-f]{64}$'
      OR p_receipt->>'operation' IS DISTINCT FROM p_operation
      OR p_receipt->>'idempotencyKey' IS DISTINCT FROM p_idempotency_key
      OR p_receipt->>'inputDigest' IS DISTINCT FROM p_input_digest
      OR p_receipt->>'status' IS DISTINCT FROM 'COMMITTED'
      OR p_receipt->>'publishableObjectCount' IS DISTINCT FROM '6'
      OR p_receipt->>'residualCount' IS DISTINCT FROM '0'
      OR p_receipt->>'quarantinedClosureCount' IS DISTINCT FROM '0' THEN
      RAISE EXCEPTION 'invalid source admission preparation write receipt'
        USING ERRCODE = '23514';
    END IF;

    item_id := conversion->>'canonical_text_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.canonical_text_conversions WHERE canonical_text_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(conversion) THEN
      RAISE EXCEPTION 'canonical text conversion identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.canonical_text_conversions(
      canonical_text_id, intake_capture_receipt_id, source_response_content_id,
      canonical_text_sha256, canonical_text_byte_length, canonical_payload
    ) VALUES (
      item_id, conversion->>'intake_capture_receipt_id',
      conversion->>'source_response_content_id', conversion->>'canonical_text_sha256',
      (conversion->>'canonical_text_byte_length')::bigint, conversion
    ) ON CONFLICT (canonical_text_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.canonical_text_conversions
    WHERE canonical_text_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(conversion) THEN
      RAISE EXCEPTION 'canonical text conversion identity conflict' USING ERRCODE = '23505';
    END IF;

    item_id := verification->>'verification_manifest_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.canonical_text_verification_manifests
    WHERE verification_manifest_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(verification) THEN
      RAISE EXCEPTION 'canonical text verification identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.canonical_text_verification_manifests(
      verification_manifest_id, canonical_text_id, intake_capture_receipt_id, canonical_payload
    ) VALUES (
      item_id, verification->>'canonical_text_id', verification->>'intake_capture_receipt_id',
      verification
    ) ON CONFLICT (verification_manifest_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.canonical_text_verification_manifests
    WHERE verification_manifest_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(verification) THEN
      RAISE EXCEPTION 'canonical text verification identity conflict' USING ERRCODE = '23505';
    END IF;

    item_id := immutable_source->>'immutable_source_document_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.immutable_source_documents
    WHERE immutable_source_document_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(immutable_source) THEN
      RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.immutable_source_documents(
      immutable_source_document_id, canonical_payload
    ) VALUES (item_id, immutable_source)
    ON CONFLICT (immutable_source_document_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.immutable_source_documents
    WHERE immutable_source_document_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(immutable_source) THEN
      RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
    END IF;

    item_id := source_admission->>'source_admission_manifest_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.source_admission_manifests
    WHERE source_admission_manifest_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(source_admission) THEN
      RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.source_admission_manifests(
      source_admission_manifest_id, canonical_payload
    ) VALUES (item_id, source_admission)
    ON CONFLICT (source_admission_manifest_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.source_admission_manifests
    WHERE source_admission_manifest_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(source_admission) THEN
      RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
    END IF;

    item_id := preparation_receipt->>'source_admission_preparation_receipt_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_admission_preparation_receipts
    WHERE source_admission_preparation_receipt_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(preparation_receipt) THEN
      RAISE EXCEPTION 'source admission preparation receipt identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.source_admission_preparation_receipts(
      source_admission_preparation_receipt_id, immutable_source_document_id,
      source_admission_manifest_id, verification_manifest_id, canonical_payload
    ) VALUES (
      item_id, preparation_receipt->>'immutable_source_document_id',
      preparation_receipt->>'source_admission_manifest_id',
      preparation_receipt->>'verification_manifest_id', preparation_receipt
    ) ON CONFLICT (source_admission_preparation_receipt_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.source_admission_preparation_receipts
    WHERE source_admission_preparation_receipt_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(preparation_receipt) THEN
      RAISE EXCEPTION 'source admission preparation receipt identity conflict'
        USING ERRCODE = '23505';
    END IF;

    item_id := semantic_input->>'semantic_extraction_input_envelope_id';
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.semantic_extraction_input_envelopes
    WHERE semantic_extraction_input_envelope_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(semantic_input) THEN
      RAISE EXCEPTION 'semantic extraction input envelope identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.semantic_extraction_input_envelopes(
      semantic_extraction_input_envelope_id, immutable_source_document_id,
      source_admission_manifest_id, verification_manifest_id, canonical_text_id,
      canonical_payload
    ) VALUES (
      item_id, semantic_input->>'immutable_source_document_id',
      semantic_input->>'source_admission_manifest_id', semantic_input->>'verification_manifest_id',
      semantic_input->>'canonical_text_id', semantic_input
    ) ON CONFLICT (semantic_extraction_input_envelope_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.semantic_extraction_input_envelopes
    WHERE semantic_extraction_input_envelope_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(semantic_input) THEN
      RAISE EXCEPTION 'semantic extraction input envelope identity conflict'
        USING ERRCODE = '23505';
    END IF;

    INSERT INTO canonical_v2_staging.write_receipts(
      operation, idempotency_key, input_digest, receipt_id, canonical_payload
    ) VALUES (
      p_operation, p_idempotency_key, p_input_digest, p_receipt->>'receiptId', p_receipt
    );
    RETURN p_receipt || jsonb_build_object('replayed', false);
  END IF;

  IF p_operation = 'DEAL_SCOPE_RUN' THEN
    IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
      OR NOT (p_write_set ?& ARRAY[
        'source_references', 'deal', 'excerpts', 'validated_semantic_graphs',
        'provisions', 'components', 'claims', 'relationships',
        'open_world_candidates', 'open_world_candidate_occurrences',
        'open_world_evidence_references', 'open_world_candidate_dispositions',
        'open_world_primitives', 'semantic_impact_closures',
        'reviewed_source_specific_rows', 'incomplete_canonical_result_rows'
      ])
      OR p_write_set - ARRAY[
        'source_references', 'deal', 'excerpts', 'validated_semantic_graphs',
        'provisions', 'components', 'claims', 'relationships',
        'open_world_candidates', 'open_world_candidate_occurrences',
        'open_world_evidence_references', 'open_world_candidate_dispositions',
        'open_world_primitives', 'semantic_impact_closures',
        'reviewed_source_specific_rows', 'incomplete_canonical_result_rows',
        'persisted_object_references'
      ]::text[] <> '{}'::jsonb
      OR jsonb_typeof(p_write_set->'source_references') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_write_set->'deal') IS DISTINCT FROM 'object'
      OR (
        p_write_set ? 'persisted_object_references'
        AND jsonb_typeof(p_write_set->'persisted_object_references') IS DISTINCT FROM 'array'
      )
      OR EXISTS (
        SELECT 1 FROM jsonb_each(p_write_set) AS write_field(key, value)
        WHERE write_field.key NOT IN ('source_references', 'deal')
          AND jsonb_typeof(write_field.value) IS DISTINCT FROM 'array'
      ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN write set must match the closed reference-only contract'
        USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_residuals) IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_quarantines) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN residuals and quarantines must be arrays'
        USING ERRCODE = '22023';
    END IF;

    source_reference_count := jsonb_array_length(p_write_set->'source_references');
    persisted_reference_count := jsonb_array_length(
      coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
    );
    residual_count := jsonb_array_length(p_residuals);
    quarantine_count := jsonb_array_length(p_quarantines);
    SELECT coalesce(sum(jsonb_array_length(value)), 0)::integer
    INTO publishable_object_count
    FROM jsonb_each(p_write_set)
    WHERE key NOT IN ('source_references', 'deal', 'persisted_object_references');
    IF source_reference_count NOT BETWEEN 1 AND 32
      OR persisted_reference_count > 4096
      OR residual_count > 16384
      OR quarantine_count > 4096
      OR publishable_object_count > 16384
      OR publishable_object_count + persisted_reference_count > 16384
      OR EXISTS (
        SELECT 1 FROM jsonb_each(p_write_set) AS collection(key, value)
        WHERE collection.key NOT IN ('source_references', 'deal')
          AND jsonb_array_length(collection.value) > 4096
      ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN exceeds a bounded source or object collection limit'
        USING ERRCODE = '54000';
    END IF;

    item := p_write_set->'deal';
    IF coalesce(length(trim(item->>'deal_key')), 0) = 0
      OR item->>'deal_admission_id' !~ '^[0-9a-f]{64}$'
      OR item->>'document_hash' !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(item->'deal_key') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'deal_admission_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(item->'document_hash') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN deal identity is invalid' USING ERRCODE = '23514';
    END IF;

    WITH supplied_references AS (
      SELECT reference.value AS reference
      FROM jsonb_array_elements(p_write_set->'source_references')
        WITH ORDINALITY AS reference(value, input_ordinal)
    )
    SELECT
      count(*)::integer,
      count(*) FILTER (WHERE
        immutable_source.immutable_source_document_id IS NOT NULL
        AND admission.source_admission_manifest_id IS NOT NULL
        AND semantic_input.semantic_extraction_input_envelope_id IS NOT NULL
        AND conversion.canonical_text_id IS NOT NULL
      )::integer,
      count(DISTINCT supplied.reference->>'source_ordinal')::integer,
      count(DISTINCT supplied.reference->>'immutable_source_document_id')::integer,
      count(DISTINCT supplied.reference->>'canonical_text_id')::integer,
      bool_and(
        jsonb_typeof(supplied.reference) = 'object'
        AND supplied.reference ?& ARRAY[
          'schema_version', 'immutable_source_document_id',
          'source_admission_manifest_id', 'semantic_extraction_input_envelope_id',
          'canonical_text_id', 'governed_deal_key', 'deal_admission_id', 'source_ordinal'
        ]
        AND supplied.reference - ARRAY[
          'schema_version', 'immutable_source_document_id',
          'source_admission_manifest_id', 'semantic_extraction_input_envelope_id',
          'canonical_text_id', 'governed_deal_key', 'deal_admission_id', 'source_ordinal'
        ]::text[] = '{}'::jsonb
        AND supplied.reference->>'schema_version' = 'ADMITTED_SOURCE_REFERENCE/V1'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each(supplied.reference) AS reference_field(key, value)
          WHERE reference_field.key <> 'source_ordinal'
            AND jsonb_typeof(reference_field.value) <> 'string'
        )
        AND supplied.reference->>'governed_deal_key' = item->>'deal_key'
        AND supplied.reference->>'deal_admission_id' = item->>'deal_admission_id'
        AND supplied.reference->>'source_ordinal' ~ '^(0|[1-9][0-9]{0,8})$'
        AND jsonb_typeof(supplied.reference->'source_ordinal') = 'number'
        AND supplied.reference->>'immutable_source_document_id' ~ '^[0-9a-f]{64}$'
        AND supplied.reference->>'source_admission_manifest_id' ~ '^[0-9a-f]{64}$'
        AND supplied.reference->>'semantic_extraction_input_envelope_id' ~ '^[0-9a-f]{64}$'
        AND supplied.reference->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
        AND immutable_source.canonical_payload->>'schema_version' = 'IMMUTABLE_SOURCE_DOCUMENT/V2'
        AND immutable_source.canonical_payload->>'source_kind' = 'ORIGINAL_BYTES'
        AND immutable_source.canonical_payload->>'authority_representation'
          = 'ORIGINAL_HTTP_RESPONSE_BYTES'
        AND immutable_source.canonical_payload->>'immutable_source_document_id'
          = supplied.reference->>'immutable_source_document_id'
        AND immutable_source.canonical_payload->>'canonical_text_id'
          = supplied.reference->>'canonical_text_id'
        AND immutable_source.canonical_payload->>'response_bytes_sha256' ~ '^[0-9a-f]{64}$'
        AND admission.canonical_payload->>'schema_version' = 'SOURCE_ADMISSION_MANIFEST/V2'
        AND admission.canonical_payload->>'admission_state' = 'VERIFIED'
        AND admission.canonical_payload->>'source_kind' = 'ORIGINAL_BYTES'
        AND admission.canonical_payload->>'immutable_source_document_id'
          = supplied.reference->>'immutable_source_document_id'
        AND admission.canonical_payload->>'source_admission_manifest_id'
          = supplied.reference->>'source_admission_manifest_id'
        AND admission.canonical_payload->>'canonical_text_id'
          = supplied.reference->>'canonical_text_id'
        AND admission.canonical_payload->>'discrepancy_count' = '0'
        AND admission.canonical_payload->>'blocking_discrepancy_count' = '0'
        AND admission.canonical_payload->'excluded_intervals' = '[]'::jsonb
        AND admission.canonical_payload->'conversion_loss_residual_ids' = '[]'::jsonb
        AND semantic_input.canonical_payload->>'schema_version'
          = 'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1'
        AND semantic_input.canonical_payload->>'input_status' = 'READY_FOR_OFFLINE_PROPOSAL'
        AND semantic_input.canonical_payload->>'coordinate_system'
          = 'UTF8_CANONICAL_TEXT_HALF_OPEN'
        AND semantic_input.canonical_payload->>'semantic_extraction_status' = 'NOT_ATTEMPTED'
        AND semantic_input.canonical_payload->>'immutable_source_document_id'
          = supplied.reference->>'immutable_source_document_id'
        AND semantic_input.canonical_payload->>'source_admission_manifest_id'
          = supplied.reference->>'source_admission_manifest_id'
        AND semantic_input.canonical_payload->>'semantic_extraction_input_envelope_id'
          = supplied.reference->>'semantic_extraction_input_envelope_id'
        AND semantic_input.canonical_payload->>'canonical_text_id'
          = supplied.reference->>'canonical_text_id'
        AND semantic_input.canonical_payload->'excluded_intervals' = '[]'::jsonb
        AND conversion.canonical_payload->>'schema_version'
          = 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'
        AND conversion.canonical_payload->>'canonical_text_id'
          = supplied.reference->>'canonical_text_id'
        AND conversion.canonical_payload->>'canonical_text_sha256'
          = immutable_source.canonical_payload->>'canonical_text_sha256'
        AND conversion.canonical_payload->>'canonical_text_sha256'
          = semantic_input.canonical_payload->>'canonical_text_sha256'
        AND conversion.canonical_payload->>'canonical_text_byte_length'
          = immutable_source.canonical_payload->>'canonical_text_byte_length'
        AND conversion.canonical_payload->>'canonical_text_byte_length'
          = semantic_input.canonical_payload->>'canonical_text_byte_length'
        AND conversion.canonical_payload->>'source_response_content_id'
          = immutable_source.canonical_payload->>'source_response_content_id'
        AND conversion.canonical_payload->>'source_response_content_id'
          = admission.canonical_payload->>'source_response_content_id'
        AND conversion.canonical_payload->>'source_map_digest'
          = immutable_source.canonical_payload->>'source_map_digest'
        AND conversion.canonical_payload->>'source_map_digest'
          = semantic_input.canonical_payload->>'source_map_digest'
        AND conversion.canonical_payload->>'verification_status' = 'NOT_ATTEMPTED'
        AND octet_length(convert_to(
          conversion.canonical_payload->>'canonical_text', 'UTF8'
        ))::text = conversion.canonical_payload->>'canonical_text_byte_length'
        AND encode(extensions.digest(convert_to(
          conversion.canonical_payload->>'canonical_text', 'UTF8'
        ), 'sha256'::text), 'hex') = conversion.canonical_payload->>'canonical_text_sha256'
        AND admission.canonical_payload->'admitted_intervals' = jsonb_build_array(
          jsonb_build_object('start', 0, 'end', conversion.canonical_payload->'canonical_text_byte_length')
        )
        AND semantic_input.canonical_payload->'admitted_intervals'
          = admission.canonical_payload->'admitted_intervals'
      ),
      bool_or(immutable_source.canonical_payload->>'response_bytes_sha256'
        = item->>'document_hash')
    INTO
      source_reference_count,
      resolved_source_reference_count,
      distinct_source_ordinal_count,
      distinct_source_document_count,
      distinct_canonical_text_count,
      source_reference_chain_valid,
      deal_document_hash_admitted
    FROM supplied_references supplied
    LEFT JOIN canonical_v2_staging.immutable_source_documents immutable_source
      ON immutable_source.immutable_source_document_id
        = supplied.reference->>'immutable_source_document_id'
    LEFT JOIN canonical_v2_staging.source_admission_manifests admission
      ON admission.source_admission_manifest_id
        = supplied.reference->>'source_admission_manifest_id'
    LEFT JOIN canonical_v2_staging.semantic_extraction_input_envelopes semantic_input
      ON semantic_input.semantic_extraction_input_envelope_id
        = supplied.reference->>'semantic_extraction_input_envelope_id'
    LEFT JOIN canonical_v2_staging.canonical_text_conversions conversion
      ON conversion.canonical_text_id = supplied.reference->>'canonical_text_id';

    IF resolved_source_reference_count <> source_reference_count
      OR distinct_source_ordinal_count <> source_reference_count
      OR distinct_source_document_count <> source_reference_count
      OR distinct_canonical_text_count <> source_reference_count
      OR source_reference_chain_valid IS DISTINCT FROM true
      OR deal_document_hash_admitted IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN source references are unresolved, mixed or incomplete'
        USING ERRCODE = '23514';
    END IF;

    WITH supplied_persisted_references AS (
      SELECT reference.value AS reference, reference.input_ordinal
      FROM jsonb_array_elements(
        coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
      ) WITH ORDINALITY AS reference(value, input_ordinal)
    ),
    stored_persisted_objects AS (
      SELECT supplied.input_ordinal, 'excerpts'::text AS object_kind,
        stored.excerpt_id AS object_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.excerpts stored
        ON supplied.reference->>'object_kind' = 'excerpts'
        AND stored.excerpt_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'validated_semantic_graphs',
        stored.validated_semantic_graph_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.validated_semantic_graphs stored
        ON supplied.reference->>'object_kind' = 'validated_semantic_graphs'
        AND stored.validated_semantic_graph_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'provisions', stored.provision_instance_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.provision_instances stored
        ON supplied.reference->>'object_kind' = 'provisions'
        AND stored.provision_instance_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'components', stored.provision_component_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.provision_components stored
        ON supplied.reference->>'object_kind' = 'components'
        AND stored.provision_component_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'claims', stored.claim_revision_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.claim_revisions stored
        ON supplied.reference->>'object_kind' = 'claims'
        AND stored.claim_revision_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'relationships', stored.relationship_revision_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.relationship_revisions stored
        ON supplied.reference->>'object_kind' = 'relationships'
        AND stored.relationship_revision_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'open_world_candidates', stored.candidate_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.open_world_candidates stored
        ON supplied.reference->>'object_kind' = 'open_world_candidates'
        AND stored.candidate_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'open_world_candidate_occurrences',
        stored.open_world_candidate_occurrence_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.open_world_candidate_occurrences stored
        ON supplied.reference->>'object_kind' = 'open_world_candidate_occurrences'
        AND stored.open_world_candidate_occurrence_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'open_world_evidence_references',
        stored.evidence_reference_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.open_world_evidence_references stored
        ON supplied.reference->>'object_kind' = 'open_world_evidence_references'
        AND stored.evidence_reference_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'open_world_candidate_dispositions',
        stored.final_disposition_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.open_world_candidate_dispositions stored
        ON supplied.reference->>'object_kind' = 'open_world_candidate_dispositions'
        AND stored.final_disposition_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'open_world_primitives', stored.primitive_id,
        stored.closure_id, stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.open_world_primitives stored
        ON supplied.reference->>'object_kind' = 'open_world_primitives'
        AND stored.primitive_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'semantic_impact_closures',
        stored.semantic_impact_closure_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.semantic_impact_closures stored
        ON supplied.reference->>'object_kind' = 'semantic_impact_closures'
        AND stored.semantic_impact_closure_id = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'reviewed_source_specific_rows',
        stored.reviewed_source_specific_row_serving_key, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.reviewed_source_specific_rows stored
        ON supplied.reference->>'object_kind' = 'reviewed_source_specific_rows'
        AND stored.reviewed_source_specific_row_serving_key
          = supplied.reference->>'object_id'
      UNION ALL
      SELECT supplied.input_ordinal, 'incomplete_canonical_result_rows',
        stored.incomplete_result_review_row_serving_key, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.incomplete_canonical_result_rows stored
        ON supplied.reference->>'object_kind' = 'incomplete_canonical_result_rows'
        AND stored.incomplete_result_review_row_serving_key
          = supplied.reference->>'object_id'
    )
    SELECT
      count(stored.object_id)::integer,
      count(DISTINCT (
        supplied.reference->>'object_kind',
        supplied.reference->>'object_id'
      ))::integer
    INTO
      resolved_persisted_reference_count,
      distinct_persisted_reference_count
    FROM supplied_persisted_references supplied
    LEFT JOIN stored_persisted_objects stored
      ON stored.input_ordinal = supplied.input_ordinal
    WHERE jsonb_typeof(supplied.reference) = 'object'
      AND supplied.reference ?& ARRAY[
        'schema_version', 'object_kind', 'object_id', 'stored_closure_id',
        'canonical_payload_digest', 'validation_closure_id'
      ]
      AND supplied.reference - ARRAY[
        'schema_version', 'object_kind', 'object_id', 'stored_closure_id',
        'canonical_payload_digest', 'validation_closure_id'
      ]::text[] = '{}'::jsonb
      AND supplied.reference->>'schema_version'
        = 'PERSISTED_CANONICAL_OBJECT_REFERENCE/V1'
      AND supplied.reference->>'object_kind' IN (
        'excerpts', 'validated_semantic_graphs', 'provisions', 'components',
        'claims', 'relationships', 'open_world_candidates',
        'open_world_candidate_occurrences', 'open_world_evidence_references',
        'open_world_candidate_dispositions', 'open_world_primitives',
        'semantic_impact_closures', 'reviewed_source_specific_rows',
        'incomplete_canonical_result_rows'
      )
      AND supplied.reference->>'object_id' ~ '^[0-9a-f]{64}$'
      AND supplied.reference->>'stored_closure_id' ~ '^[0-9a-f]{64}$'
      AND supplied.reference->>'canonical_payload_digest' ~ '^[0-9a-f]{64}$'
      AND supplied.reference->>'validation_closure_id' ~ '^[0-9a-f]{64}$'
      AND stored.object_kind = supplied.reference->>'object_kind'
      AND stored.object_id = supplied.reference->>'object_id'
      AND stored.closure_id = supplied.reference->>'stored_closure_id'
      AND stored.canonical_payload_digest
        = supplied.reference->>'canonical_payload_digest'
      AND stored.canonical_payload->>'closure_id' = stored.closure_id
      AND (CASE stored.object_kind
        WHEN 'excerpts' THEN stored.canonical_payload->>'excerpt_id'
        WHEN 'validated_semantic_graphs'
          THEN stored.canonical_payload->>'validated_semantic_graph_id'
        WHEN 'provisions' THEN stored.canonical_payload->>'provision_instance_id'
        WHEN 'components' THEN stored.canonical_payload->>'provision_component_id'
        WHEN 'claims' THEN stored.canonical_payload->>'claim_revision_id'
        WHEN 'relationships' THEN stored.canonical_payload->>'relationship_revision_id'
        WHEN 'open_world_candidates' THEN stored.canonical_payload->>'candidate_id'
        WHEN 'open_world_candidate_occurrences'
          THEN stored.canonical_payload->>'open_world_candidate_occurrence_id'
        WHEN 'open_world_evidence_references'
          THEN stored.canonical_payload->>'evidence_reference_id'
        WHEN 'open_world_candidate_dispositions'
          THEN stored.canonical_payload->>'final_disposition_id'
        WHEN 'open_world_primitives' THEN stored.canonical_payload->>'primitive_id'
        WHEN 'semantic_impact_closures'
          THEN stored.canonical_payload->>'semantic_impact_closure_id'
        WHEN 'reviewed_source_specific_rows'
          THEN stored.canonical_payload->>'reviewed_source_specific_row_serving_key'
        WHEN 'incomplete_canonical_result_rows'
          THEN stored.canonical_payload->>'incomplete_result_review_row_serving_key'
      END) = stored.object_id;

    IF resolved_persisted_reference_count <> persisted_reference_count
      OR distinct_persisted_reference_count <> persisted_reference_count THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN persisted object references are unresolved or invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      JOIN jsonb_array_elements(
        coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
      ) AS persisted(reference)
        ON persisted.reference->>'object_kind' = collection.key
        AND persisted.reference->>'object_id' = CASE collection.key
          WHEN 'excerpts' THEN object.value->>'excerpt_id'
          WHEN 'validated_semantic_graphs'
            THEN object.value->>'validated_semantic_graph_id'
          WHEN 'provisions' THEN object.value->>'provision_instance_id'
          WHEN 'components' THEN object.value->>'provision_component_id'
          WHEN 'claims' THEN object.value->>'claim_revision_id'
          WHEN 'relationships' THEN object.value->>'relationship_revision_id'
          WHEN 'open_world_candidates' THEN object.value->>'candidate_id'
          WHEN 'open_world_candidate_occurrences'
            THEN object.value->>'open_world_candidate_occurrence_id'
          WHEN 'open_world_evidence_references'
            THEN object.value->>'evidence_reference_id'
          WHEN 'open_world_candidate_dispositions'
            THEN object.value->>'final_disposition_id'
          WHEN 'open_world_primitives' THEN object.value->>'primitive_id'
          WHEN 'semantic_impact_closures'
            THEN object.value->>'semantic_impact_closure_id'
          WHEN 'reviewed_source_specific_rows'
            THEN object.value->>'reviewed_source_specific_row_serving_key'
          WHEN 'incomplete_canonical_result_rows'
            THEN object.value->>'incomplete_result_review_row_serving_key'
        END
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      JOIN jsonb_array_elements(
        coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
      ) AS persisted(reference)
        ON object.value->>'closure_id' = persisted.reference->>'stored_closure_id'
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN persisted references overlap or extend stored closure identity'
        USING ERRCODE = '23514';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(locked.closure_id, 0))
    FROM (
      SELECT DISTINCT closure_id
      FROM (
        SELECT reference->>'stored_closure_id' AS closure_id
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        UNION ALL
        SELECT reference->>'validation_closure_id'
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        UNION ALL
        SELECT object.value->>'closure_id'
        FROM jsonb_each(p_write_set) AS collection(key, value)
        CROSS JOIN LATERAL jsonb_array_elements(CASE
          WHEN collection.key NOT IN (
            'source_references', 'deal', 'persisted_object_references'
          ) THEN collection.value
          ELSE '[]'::jsonb
        END) object(value)
        UNION ALL
        SELECT quarantine.value->>'closure_id'
        FROM jsonb_array_elements(p_quarantines) quarantine(value)
      ) closure_ids
      WHERE closure_id ~ '^[0-9a-f]{64}$'
    ) locked
    ORDER BY locked.closure_id;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
      ) persisted(reference)
      JOIN canonical_v2_staging.quarantines quarantine
        ON quarantine.closure_id = persisted.reference->>'stored_closure_id'
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN cannot reuse a quarantined persisted object'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references'
      )
        AND (
          jsonb_typeof(object.value) <> 'object'
          OR object.value->>'closure_id' !~ '^[0-9a-f]{64}$'
          OR (CASE collection.key
            WHEN 'excerpts' THEN object.value->>'excerpt_id'
            WHEN 'validated_semantic_graphs' THEN object.value->>'validated_semantic_graph_id'
            WHEN 'provisions' THEN object.value->>'provision_instance_id'
            WHEN 'components' THEN object.value->>'provision_component_id'
            WHEN 'claims' THEN object.value->>'claim_revision_id'
            WHEN 'relationships' THEN object.value->>'relationship_revision_id'
            WHEN 'open_world_candidates' THEN object.value->>'candidate_id'
            WHEN 'open_world_candidate_occurrences'
              THEN object.value->>'open_world_candidate_occurrence_id'
            WHEN 'open_world_evidence_references' THEN object.value->>'evidence_reference_id'
            WHEN 'open_world_candidate_dispositions' THEN object.value->>'final_disposition_id'
            WHEN 'open_world_primitives' THEN object.value->>'primitive_id'
            WHEN 'semantic_impact_closures' THEN object.value->>'semantic_impact_closure_id'
            WHEN 'reviewed_source_specific_rows'
              THEN object.value->>'reviewed_source_specific_row_serving_key'
            WHEN 'incomplete_canonical_result_rows'
              THEN object.value->>'incomplete_result_review_row_serving_key'
          END) !~ '^[0-9a-f]{64}$'
        )
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references'
      )
      GROUP BY collection.key, CASE collection.key
        WHEN 'excerpts' THEN object.value->>'excerpt_id'
        WHEN 'validated_semantic_graphs' THEN object.value->>'validated_semantic_graph_id'
        WHEN 'provisions' THEN object.value->>'provision_instance_id'
        WHEN 'components' THEN object.value->>'provision_component_id'
        WHEN 'claims' THEN object.value->>'claim_revision_id'
        WHEN 'relationships' THEN object.value->>'relationship_revision_id'
        WHEN 'open_world_candidates' THEN object.value->>'candidate_id'
        WHEN 'open_world_candidate_occurrences'
          THEN object.value->>'open_world_candidate_occurrence_id'
        WHEN 'open_world_evidence_references' THEN object.value->>'evidence_reference_id'
        WHEN 'open_world_candidate_dispositions' THEN object.value->>'final_disposition_id'
        WHEN 'open_world_primitives' THEN object.value->>'primitive_id'
        WHEN 'semantic_impact_closures' THEN object.value->>'semantic_impact_closure_id'
        WHEN 'reviewed_source_specific_rows'
          THEN object.value->>'reviewed_source_specific_row_serving_key'
        WHEN 'incomplete_canonical_result_rows'
          THEN object.value->>'incomplete_result_review_row_serving_key'
      END
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN contains invalid or duplicate semantic objects'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_residuals) AS residual(value)
      WHERE jsonb_typeof(residual.value) <> 'object'
        OR NOT (residual.value ?& ARRAY[
          'residual_id', 'source_kind', 'source_object_id', 'closure_id', 'reason_code',
          'contract_key', 'upstream_residual', 'source_object'
        ])
        OR residual.value - ARRAY[
          'residual_id', 'source_kind', 'source_object_id', 'closure_id', 'reason_code',
          'contract_key', 'upstream_residual', 'source_object'
        ]::text[] <> '{}'::jsonb
        OR residual.value->>'residual_id' !~ '^[0-9a-f]{64}$'
        OR residual.value->>'source_object_id' !~ '^[0-9a-f]{64}$'
        OR residual.value->>'closure_id' !~ '^[0-9a-f]{64}$'
        OR coalesce(length(residual.value->>'reason_code'), 0) = 0
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
      WHERE jsonb_typeof(quarantine.value) <> 'object'
        OR NOT (quarantine.value ?& ARRAY[
          'quarantine_id', 'reason_code', 'closure_id', 'affected_objects', 'residual_ids'
        ])
        OR quarantine.value - ARRAY[
          'quarantine_id', 'reason_code', 'closure_id', 'affected_objects', 'residual_ids'
        ]::text[] <> '{}'::jsonb
        OR quarantine.value->>'quarantine_id' !~ '^[0-9a-f]{64}$'
        OR quarantine.value->>'closure_id' !~ '^[0-9a-f]{64}$'
        OR quarantine.value->>'reason_code' <> 'UNRESOLVED_RESIDUAL'
        OR jsonb_typeof(quarantine.value->'affected_objects') <> 'array'
        OR jsonb_typeof(quarantine.value->'residual_ids') <> 'array'
    ) OR (
      SELECT count(DISTINCT residual.value->>'residual_id')
      FROM jsonb_array_elements(p_residuals) AS residual(value)
    ) <> residual_count OR (
      SELECT count(DISTINCT quarantine.value->>'closure_id')
      FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
    ) <> quarantine_count OR (
      SELECT count(DISTINCT quarantine.value->>'quarantine_id')
      FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
    ) <> quarantine_count OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
      WHERE jsonb_array_length(quarantine.value->'residual_ids') <> (
        SELECT count(DISTINCT residual_id)
        FROM jsonb_array_elements_text(quarantine.value->'residual_ids') residual_id
      )
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_residuals) AS residual(value)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
        WHERE quarantine.value->>'closure_id' = residual.value->>'closure_id'
          AND quarantine.value->'residual_ids' ? (residual.value->>'residual_id')
      )
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_quarantines) AS quarantine(value)
      CROSS JOIN LATERAL jsonb_array_elements_text(quarantine.value->'residual_ids') residual_id
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_residuals) AS residual(value)
        WHERE residual.value->>'closure_id' = quarantine.value->>'closure_id'
          AND residual.value->>'residual_id' = residual_id
      )
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      JOIN jsonb_array_elements(p_quarantines) AS quarantine(value)
        ON quarantine.value->>'closure_id' = object.value->>'closure_id'
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references'
      )
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN residual and quarantine outputs do not close exactly'
        USING ERRCODE = '23514';
    END IF;

    IF p_input_digest !~ '^[0-9a-f]{64}$'
      OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object'
      OR NOT (p_receipt ?& ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ])
      OR p_receipt - ARRAY[
        'receiptId', 'operation', 'idempotencyKey', 'inputDigest', 'status',
        'publishableObjectCount', 'residualCount', 'quarantinedClosureCount'
      ]::text[] <> '{}'::jsonb
      OR p_receipt->>'receiptId' !~ '^[0-9a-f]{64}$'
      OR p_receipt->>'operation' <> p_operation
      OR p_receipt->>'idempotencyKey' <> p_idempotency_key
      OR p_receipt->>'inputDigest' <> p_input_digest
      OR p_receipt->>'status' <> 'COMMITTED'
      OR jsonb_typeof(p_receipt->'publishableObjectCount') <> 'number'
      OR jsonb_typeof(p_receipt->'residualCount') <> 'number'
      OR jsonb_typeof(p_receipt->'quarantinedClosureCount') <> 'number'
      OR p_receipt->>'publishableObjectCount' <> publishable_object_count::text
      OR p_receipt->>'residualCount' <> residual_count::text
      OR p_receipt->>'quarantinedClosureCount' <> quarantine_count::text THEN
      RAISE EXCEPTION 'invalid DEAL_SCOPE_RUN write receipt' USING ERRCODE = '23514';
    END IF;

    IF existing_receipt.operation IS NOT NULL THEN
      RETURN existing_receipt.canonical_payload || jsonb_build_object('replayed', true);
    END IF;
  END IF;

  IF p_operation = 'FIXTURE_CORRECTION_AUTHORITY' THEN
    IF jsonb_typeof(p_write_set) IS DISTINCT FROM 'object'
      OR NOT (p_write_set ?& ARRAY[
        'correction_authority_materialisations',
        'correction_discharge_map',
        'candidate_input_event',
        'expected_candidate_input_head',
        'next_candidate_input_head'
      ])
      OR p_write_set - ARRAY[
        'correction_authority_materialisations',
        'correction_discharge_map',
        'candidate_input_event',
        'expected_candidate_input_head',
        'next_candidate_input_head'
      ]::text[] <> '{}'::jsonb
      OR jsonb_typeof(p_write_set->'correction_authority_materialisations') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_write_set->'correction_discharge_map') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_write_set->'candidate_input_event') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_write_set->'next_candidate_input_head') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_write_set->'expected_candidate_input_head') NOT IN ('object', 'null') THEN
      RAISE EXCEPTION 'invalid fixture correction authority write set' USING ERRCODE = '22023';
    END IF;
    IF coalesce(p_residuals, '[]'::jsonb) <> '[]'::jsonb
      OR coalesce(p_quarantines, '[]'::jsonb) <> '[]'::jsonb THEN
      RAISE EXCEPTION 'fixture correction authority does not accept residuals or quarantines'
        USING ERRCODE = '22023';
    END IF;

    correction_discharge_map := p_write_set->'correction_discharge_map';
    candidate_input_event := p_write_set->'candidate_input_event';
    expected_candidate_input_head := p_write_set->'expected_candidate_input_head';
    next_candidate_input_head := p_write_set->'next_candidate_input_head';
    correction_materialisation_count := jsonb_array_length(
      p_write_set->'correction_authority_materialisations'
    );
    IF jsonb_typeof(correction_discharge_map->'ordered_entries') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'correction discharge map ordered_entries must be an array'
        USING ERRCODE = '22023';
    END IF;
    correction_map_entry_count := jsonb_array_length(correction_discharge_map->'ordered_entries');
    IF correction_materialisation_count > 512 OR correction_map_entry_count > 512 THEN
      RAISE EXCEPTION 'fixture correction authority exceeds the 512-materialisation bound'
        USING ERRCODE = '54000';
    END IF;
    IF correction_materialisation_count <> correction_map_entry_count
      OR (correction_discharge_map->'counts'->>'ordered_entries')::integer
        <> correction_map_entry_count THEN
      RAISE EXCEPTION 'correction authority materialisations do not close the discharge map'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (correction_discharge_map ?& ARRAY[
        'schema_version',
        'stage',
        'contract_fingerprint',
        'ordered_entries',
        'counts',
        'roots',
        'status',
        'canonical_payload_digest',
        'correction_discharge_map_id'
      ])
      OR correction_discharge_map - ARRAY[
        'schema_version',
        'stage',
        'contract_fingerprint',
        'ordered_entries',
        'counts',
        'roots',
        'status',
        'canonical_payload_digest',
        'correction_discharge_map_id'
      ]::text[] <> '{}'::jsonb
      OR (correction_discharge_map->'counts') - 'ordered_entries' <> '{}'::jsonb
      OR NOT (correction_discharge_map->'counts' ? 'ordered_entries')
      OR (correction_discharge_map->'roots') - ARRAY[
        'active_correction_application_root',
        'correction_authority_materialisation_root'
      ]::text[] <> '{}'::jsonb
      OR NOT (correction_discharge_map->'roots' ?& ARRAY[
        'active_correction_application_root',
        'correction_authority_materialisation_root'
      ])
      OR correction_discharge_map->'roots'->>'active_correction_application_root'
        !~ '^[0-9a-f]{64}$'
      OR correction_discharge_map->'roots'->>'correction_authority_materialisation_root'
        !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'correction discharge map fields do not match the authority contract'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (next_candidate_input_head ?& ARRAY[
        'schema_version',
        'environment',
        'contract_fingerprint',
        'generation',
        'correction_discharge_map_id',
        'correction_discharge_map_payload_digest',
        'previous_candidate_input_head_id',
        'status',
        'canonical_payload_digest',
        'candidate_input_head_id'
      ])
      OR next_candidate_input_head - ARRAY[
        'schema_version',
        'environment',
        'contract_fingerprint',
        'generation',
        'correction_discharge_map_id',
        'correction_discharge_map_payload_digest',
        'previous_candidate_input_head_id',
        'status',
        'canonical_payload_digest',
        'candidate_input_head_id'
      ]::text[] <> '{}'::jsonb
      OR NOT (candidate_input_event ?& ARRAY[
        'schema_version',
        'environment',
        'contract_fingerprint',
        'generation',
        'transition',
        'predecessor_candidate_input_head_id',
        'predecessor_candidate_input_head_payload_digest',
        'successor_candidate_input_head_id',
        'successor_candidate_input_head_payload_digest',
        'correction_discharge_map_id',
        'correction_discharge_map_payload_digest',
        'status',
        'canonical_payload_digest',
        'candidate_input_event_id'
      ])
      OR candidate_input_event - ARRAY[
        'schema_version',
        'environment',
        'contract_fingerprint',
        'generation',
        'transition',
        'predecessor_candidate_input_head_id',
        'predecessor_candidate_input_head_payload_digest',
        'successor_candidate_input_head_id',
        'successor_candidate_input_head_payload_digest',
        'correction_discharge_map_id',
        'correction_discharge_map_payload_digest',
        'status',
        'canonical_payload_digest',
        'candidate_input_event_id'
      ]::text[] <> '{}'::jsonb THEN
      RAISE EXCEPTION 'candidate input head or event fields do not match the authority contract'
        USING ERRCODE = '23514';
    END IF;

    SELECT * INTO current_candidate_input_head
    FROM canonical_v2_staging.candidate_input_heads
    WHERE singleton_key = 'CURRENT'
      AND environment = next_candidate_input_head->>'environment'
      AND contract_fingerprint = next_candidate_input_head->>'contract_fingerprint'
    FOR UPDATE;
    current_candidate_input_head_exists := FOUND;

    IF current_candidate_input_head_exists THEN
      IF jsonb_typeof(expected_candidate_input_head) IS DISTINCT FROM 'object'
        OR expected_candidate_input_head->>'candidate_input_head_id'
          IS DISTINCT FROM current_candidate_input_head.candidate_input_head_id
        OR expected_candidate_input_head->>'canonical_payload_digest'
          IS DISTINCT FROM current_candidate_input_head.candidate_input_head_payload_digest THEN
        RAISE EXCEPTION 'stale candidate input head compare-and-swap'
          USING ERRCODE = '40001';
      END IF;
      IF next_candidate_input_head->>'contract_fingerprint'
          IS DISTINCT FROM current_candidate_input_head.contract_fingerprint
        OR next_candidate_input_head->>'environment'
          IS DISTINCT FROM current_candidate_input_head.environment THEN
        RAISE EXCEPTION 'candidate input head cannot cross environment or contract'
          USING ERRCODE = '23514';
      END IF;
    ELSIF jsonb_typeof(expected_candidate_input_head) IS DISTINCT FROM 'null' THEN
      RAISE EXCEPTION 'candidate input head genesis requires an explicit null predecessor'
        USING ERRCODE = '40001';
    END IF;

    IF correction_discharge_map->>'schema_version' IS DISTINCT FROM 'CORRECTION_DISCHARGE_MAP/V1'
      OR correction_discharge_map->>'stage' IS DISTINCT FROM 'POST_SCOPE'
      OR correction_discharge_map->>'status' IS DISTINCT FROM 'PASS'
      OR correction_discharge_map->>'contract_fingerprint'
        IS DISTINCT FROM next_candidate_input_head->>'contract_fingerprint'
      OR correction_discharge_map->>'correction_discharge_map_id'
        IS DISTINCT FROM next_candidate_input_head->>'correction_discharge_map_id'
      OR correction_discharge_map->>'canonical_payload_digest'
        IS DISTINCT FROM next_candidate_input_head->>'correction_discharge_map_payload_digest'
      OR correction_discharge_map->>'correction_discharge_map_id' !~ '^[0-9a-f]{64}$'
      OR correction_discharge_map->>'canonical_payload_digest' !~ '^[0-9a-f]{64}$'
      OR correction_discharge_map->>'contract_fingerprint' !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'candidate input head does not bind the exact correction discharge map'
        USING ERRCODE = '23514';
    END IF;

    IF next_candidate_input_head->>'schema_version' IS DISTINCT FROM 'CANDIDATE_INPUT_HEAD/V1'
      OR next_candidate_input_head->>'environment' IS DISTINCT FROM 'staging'
      OR next_candidate_input_head->>'status' IS DISTINCT FROM 'SEALED'
      OR next_candidate_input_head->>'candidate_input_head_id' !~ '^[0-9a-f]{64}$'
      OR next_candidate_input_head->>'canonical_payload_digest' !~ '^[0-9a-f]{64}$'
      OR (next_candidate_input_head->>'generation')::bigint < 1
      OR (
        current_candidate_input_head_exists
        AND (
          next_candidate_input_head->>'previous_candidate_input_head_id'
            IS DISTINCT FROM current_candidate_input_head.candidate_input_head_id
          OR (next_candidate_input_head->>'generation')::bigint
            <> current_candidate_input_head.input_generation + 1
        )
      )
      OR (
        NOT current_candidate_input_head_exists
        AND (
          next_candidate_input_head->'previous_candidate_input_head_id' <> 'null'::jsonb
          OR (next_candidate_input_head->>'generation')::bigint <> 1
        )
      ) THEN
      RAISE EXCEPTION 'invalid successor candidate input head' USING ERRCODE = '23514';
    END IF;

    IF candidate_input_event->>'schema_version' IS DISTINCT FROM 'CANDIDATE_INPUT_EVENT/V1'
      OR candidate_input_event->>'environment' IS DISTINCT FROM 'staging'
      OR candidate_input_event->>'contract_fingerprint'
        IS DISTINCT FROM next_candidate_input_head->>'contract_fingerprint'
      OR (candidate_input_event->>'generation')::bigint
        <> (next_candidate_input_head->>'generation')::bigint
      OR candidate_input_event->>'transition'
        IS DISTINCT FROM (CASE
          WHEN current_candidate_input_head_exists THEN 'ADVANCE'
          ELSE 'INITIALISE'
        END)
      OR candidate_input_event->>'status' IS DISTINCT FROM 'PASS'
      OR candidate_input_event->>'successor_candidate_input_head_id'
        IS DISTINCT FROM next_candidate_input_head->>'candidate_input_head_id'
      OR candidate_input_event->>'successor_candidate_input_head_payload_digest'
        IS DISTINCT FROM next_candidate_input_head->>'canonical_payload_digest'
      OR candidate_input_event->>'correction_discharge_map_id'
        IS DISTINCT FROM correction_discharge_map->>'correction_discharge_map_id'
      OR candidate_input_event->>'correction_discharge_map_payload_digest'
        IS DISTINCT FROM correction_discharge_map->>'canonical_payload_digest'
      OR candidate_input_event->>'candidate_input_event_id' !~ '^[0-9a-f]{64}$'
      OR candidate_input_event->>'canonical_payload_digest' !~ '^[0-9a-f]{64}$'
      OR (
        current_candidate_input_head_exists
        AND (
          candidate_input_event->>'predecessor_candidate_input_head_id'
            IS DISTINCT FROM current_candidate_input_head.candidate_input_head_id
          OR candidate_input_event->>'predecessor_candidate_input_head_payload_digest'
            IS DISTINCT FROM current_candidate_input_head.candidate_input_head_payload_digest
        )
      )
      OR (
        NOT current_candidate_input_head_exists
        AND (
          candidate_input_event->'predecessor_candidate_input_head_id' <> 'null'::jsonb
          OR candidate_input_event->'predecessor_candidate_input_head_payload_digest' <> 'null'::jsonb
        )
      ) THEN
      RAISE EXCEPTION 'candidate input event does not prove the exact head transition'
        USING ERRCODE = '23514';
    END IF;

    FOR item IN
      SELECT ordered_item.value
      FROM jsonb_array_elements(
        p_write_set->'correction_authority_materialisations'
      ) AS ordered_item(value)
      ORDER BY ordered_item.value->>'correction_authority_materialisation_id'
    LOOP
      item_id := item->>'correction_authority_materialisation_id';
      IF NOT (item ?& ARRAY[
          'schema_version',
          'correction_application_id',
          'correction_discharge_id',
          'correction_output',
          'correction_discharge',
          'canonical_payload_digest',
          'correction_authority_materialisation_id'
        ])
        OR item - ARRAY[
          'schema_version',
          'correction_application_id',
          'correction_discharge_id',
          'correction_output',
          'correction_discharge',
          'canonical_payload_digest',
          'correction_authority_materialisation_id'
        ]::text[] <> '{}'::jsonb
        OR item->>'schema_version' IS DISTINCT FROM 'CORRECTION_AUTHORITY_MATERIALISATION/V1'
        OR item_id !~ '^[0-9a-f]{64}$'
        OR item->>'canonical_payload_digest' !~ '^[0-9a-f]{64}$'
        OR item->>'correction_application_id' !~ '^[0-9a-f]{64}$'
        OR item->>'correction_discharge_id' !~ '^[0-9a-f]{64}$'
        OR item->'correction_discharge'->>'correction_application_id'
          IS DISTINCT FROM item->>'correction_application_id'
        OR item->'correction_discharge'->>'correction_discharge_id'
          IS DISTINCT FROM item->>'correction_discharge_id'
        OR item->'correction_discharge'->>'canonical_payload_digest' !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'invalid correction authority materialisation'
          USING ERRCODE = '23514';
      END IF;
      SELECT canonical_payload_storage_digest INTO existing_digest
      FROM canonical_v2_staging.correction_authority_materialisations
      WHERE correction_authority_materialisation_id = item_id;
      IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'correction authority materialisation identity conflict'
          USING ERRCODE = '23505';
      END IF;
      INSERT INTO canonical_v2_staging.correction_authority_materialisations(
        correction_authority_materialisation_id,
        correction_authority_materialisation_payload_digest,
        correction_application_id,
        correction_discharge_id,
        correction_discharge_payload_digest,
        canonical_payload
      ) VALUES (
        item_id,
        item->>'canonical_payload_digest',
        item->>'correction_application_id',
        item->>'correction_discharge_id',
        item->'correction_discharge'->>'canonical_payload_digest',
        item
      ) ON CONFLICT (correction_authority_materialisation_id) DO NOTHING;
      SELECT canonical_payload_storage_digest INTO existing_digest
      FROM canonical_v2_staging.correction_authority_materialisations
      WHERE correction_authority_materialisation_id = item_id;
      IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'correction authority materialisation identity conflict'
          USING ERRCODE = '23505';
      END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(correction_discharge_map->'ordered_entries') AS entry(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          p_write_set->'correction_authority_materialisations'
        ) AS materialisation(value)
        WHERE materialisation.value->>'correction_application_id'
          = entry.value->>'correction_application_id'
          AND materialisation.value->>'correction_discharge_id'
          = entry.value->>'correction_discharge_id'
          AND materialisation.value->>'correction_authority_materialisation_id'
          = entry.value->>'correction_authority_materialisation_id'
          AND materialisation.value->>'canonical_payload_digest'
          = entry.value->>'correction_authority_materialisation_payload_digest'
      )
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        p_write_set->'correction_authority_materialisations'
      ) AS materialisation(value)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(correction_discharge_map->'ordered_entries') AS entry(value)
        WHERE entry.value->>'correction_authority_materialisation_id'
          = materialisation.value->>'correction_authority_materialisation_id'
      )
    ) THEN
      RAISE EXCEPTION 'correction discharge map does not exactly equal supplied materialisations'
        USING ERRCODE = '23514';
    END IF;

    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.correction_discharge_maps
    WHERE correction_discharge_map_id = correction_discharge_map->>'correction_discharge_map_id';
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(correction_discharge_map) THEN
      RAISE EXCEPTION 'correction discharge map identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.correction_discharge_maps(
      correction_discharge_map_id,
      correction_discharge_map_payload_digest,
      contract_fingerprint,
      entry_count,
      canonical_payload
    ) VALUES (
      correction_discharge_map->>'correction_discharge_map_id',
      correction_discharge_map->>'canonical_payload_digest',
      correction_discharge_map->>'contract_fingerprint',
      correction_map_entry_count,
      correction_discharge_map
    ) ON CONFLICT (correction_discharge_map_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.correction_discharge_maps
    WHERE correction_discharge_map_id = correction_discharge_map->>'correction_discharge_map_id';
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(
      correction_discharge_map
    ) THEN
      RAISE EXCEPTION 'correction discharge map identity conflict' USING ERRCODE = '23505';
    END IF;

    previous_application_id := NULL;
    FOR item, item_ordinal IN
      SELECT value, (ordinality - 1)::integer
      FROM jsonb_array_elements(correction_discharge_map->'ordered_entries') WITH ORDINALITY
    LOOP
      IF item - ARRAY[
          'correction_application_id',
          'correction_discharge_id',
          'correction_authority_materialisation_id',
          'correction_authority_materialisation_payload_digest'
      ]::text[] <> '{}'::jsonb
        OR NOT item ?& ARRAY[
          'correction_application_id',
          'correction_discharge_id',
          'correction_authority_materialisation_id',
          'correction_authority_materialisation_payload_digest'
        ]
        OR item->>'correction_application_id' !~ '^[0-9a-f]{64}$'
        OR item->>'correction_discharge_id' !~ '^[0-9a-f]{64}$'
        OR item->>'correction_authority_materialisation_id' !~ '^[0-9a-f]{64}$'
        OR item->>'correction_authority_materialisation_payload_digest' !~ '^[0-9a-f]{64}$'
        OR (previous_application_id IS NOT NULL
          AND item->>'correction_application_id' <= previous_application_id)
        OR NOT EXISTS (
          SELECT 1
          FROM canonical_v2_staging.correction_authority_materialisations materialisation
          WHERE materialisation.correction_authority_materialisation_id
            = item->>'correction_authority_materialisation_id'
            AND materialisation.correction_authority_materialisation_payload_digest
              = item->>'correction_authority_materialisation_payload_digest'
            AND materialisation.correction_application_id = item->>'correction_application_id'
            AND materialisation.correction_discharge_id = item->>'correction_discharge_id'
        ) THEN
        RAISE EXCEPTION 'invalid or non-canonical correction discharge map entry'
          USING ERRCODE = '23514';
      END IF;
      INSERT INTO canonical_v2_staging.correction_discharge_map_entries(
        correction_discharge_map_id,
        entry_ordinal,
        correction_application_id,
        correction_discharge_id,
        correction_authority_materialisation_id,
        correction_authority_materialisation_payload_digest
      ) VALUES (
        correction_discharge_map->>'correction_discharge_map_id',
        item_ordinal,
        item->>'correction_application_id',
        item->>'correction_discharge_id',
        item->>'correction_authority_materialisation_id',
        item->>'correction_authority_materialisation_payload_digest'
      ) ON CONFLICT (correction_discharge_map_id, entry_ordinal) DO NOTHING;
      IF NOT EXISTS (
        SELECT 1
        FROM canonical_v2_staging.correction_discharge_map_entries AS stored_entry
        WHERE stored_entry.correction_discharge_map_id
            = correction_discharge_map->>'correction_discharge_map_id'
          AND stored_entry.entry_ordinal = item_ordinal
          AND stored_entry.correction_application_id
            IS NOT DISTINCT FROM item->>'correction_application_id'
          AND stored_entry.correction_discharge_id
            IS NOT DISTINCT FROM item->>'correction_discharge_id'
          AND stored_entry.correction_authority_materialisation_id
            IS NOT DISTINCT FROM item->>'correction_authority_materialisation_id'
          AND stored_entry.correction_authority_materialisation_payload_digest
            IS NOT DISTINCT FROM item->>'correction_authority_materialisation_payload_digest'
      ) THEN
        RAISE EXCEPTION 'correction discharge map entry identity conflict'
          USING ERRCODE = '23505';
      END IF;
      previous_application_id := item->>'correction_application_id';
    END LOOP;

    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.candidate_input_head_versions
    WHERE candidate_input_head_id = next_candidate_input_head->>'candidate_input_head_id';
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(next_candidate_input_head) THEN
      RAISE EXCEPTION 'candidate input head identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.candidate_input_head_versions(
      candidate_input_head_id,
      candidate_input_head_payload_digest,
      environment,
      contract_fingerprint,
      input_generation,
      correction_discharge_map_id,
      correction_discharge_map_payload_digest,
      previous_candidate_input_head_id,
      canonical_payload
    ) VALUES (
      next_candidate_input_head->>'candidate_input_head_id',
      next_candidate_input_head->>'canonical_payload_digest',
      'staging',
      next_candidate_input_head->>'contract_fingerprint',
      (next_candidate_input_head->>'generation')::bigint,
      next_candidate_input_head->>'correction_discharge_map_id',
      next_candidate_input_head->>'correction_discharge_map_payload_digest',
      next_candidate_input_head->>'previous_candidate_input_head_id',
      next_candidate_input_head
    ) ON CONFLICT (candidate_input_head_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.candidate_input_head_versions
    WHERE candidate_input_head_id = next_candidate_input_head->>'candidate_input_head_id';
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(
      next_candidate_input_head
    ) THEN
      RAISE EXCEPTION 'candidate input head identity conflict' USING ERRCODE = '23505';
    END IF;

    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.candidate_input_events
    WHERE candidate_input_event_id = candidate_input_event->>'candidate_input_event_id';
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(candidate_input_event) THEN
      RAISE EXCEPTION 'candidate input event identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.candidate_input_events(
      candidate_input_event_id,
      candidate_input_event_payload_digest,
      environment,
      contract_fingerprint,
      input_generation,
      predecessor_candidate_input_head_id,
      predecessor_candidate_input_head_payload_digest,
      successor_candidate_input_head_id,
      successor_candidate_input_head_payload_digest,
      correction_discharge_map_id,
      correction_discharge_map_payload_digest,
      canonical_payload
    ) VALUES (
      candidate_input_event->>'candidate_input_event_id',
      candidate_input_event->>'canonical_payload_digest',
      'staging',
      candidate_input_event->>'contract_fingerprint',
      (candidate_input_event->>'generation')::bigint,
      candidate_input_event->>'predecessor_candidate_input_head_id',
      candidate_input_event->>'predecessor_candidate_input_head_payload_digest',
      candidate_input_event->>'successor_candidate_input_head_id',
      candidate_input_event->>'successor_candidate_input_head_payload_digest',
      candidate_input_event->>'correction_discharge_map_id',
      candidate_input_event->>'correction_discharge_map_payload_digest',
      candidate_input_event
    ) ON CONFLICT (candidate_input_event_id) DO NOTHING;
    SELECT canonical_payload_storage_digest INTO existing_digest
    FROM canonical_v2_staging.candidate_input_events
    WHERE candidate_input_event_id = candidate_input_event->>'candidate_input_event_id';
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(
      candidate_input_event
    ) THEN
      RAISE EXCEPTION 'candidate input event identity conflict' USING ERRCODE = '23505';
    END IF;

    IF current_candidate_input_head_exists THEN
      UPDATE canonical_v2_staging.candidate_input_heads SET
        environment = 'staging',
        contract_fingerprint = next_candidate_input_head->>'contract_fingerprint',
        candidate_input_head_id = next_candidate_input_head->>'candidate_input_head_id',
        candidate_input_head_payload_digest = next_candidate_input_head->>'canonical_payload_digest',
        input_generation = (next_candidate_input_head->>'generation')::bigint,
        correction_discharge_map_id = next_candidate_input_head->>'correction_discharge_map_id',
        correction_discharge_map_payload_digest
          = next_candidate_input_head->>'correction_discharge_map_payload_digest',
        candidate_input_event_id = candidate_input_event->>'candidate_input_event_id'
      WHERE singleton_key = 'CURRENT'
        AND environment = next_candidate_input_head->>'environment'
        AND contract_fingerprint = next_candidate_input_head->>'contract_fingerprint'
        AND candidate_input_head_id = expected_candidate_input_head->>'candidate_input_head_id'
        AND candidate_input_head_payload_digest
          = expected_candidate_input_head->>'canonical_payload_digest';
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN
        RAISE EXCEPTION 'candidate input head changed before compare-and-swap'
          USING ERRCODE = '40001';
      END IF;
    ELSE
      INSERT INTO canonical_v2_staging.candidate_input_heads(
        singleton_key,
        environment,
        contract_fingerprint,
        candidate_input_head_id,
        candidate_input_head_payload_digest,
        input_generation,
        correction_discharge_map_id,
        correction_discharge_map_payload_digest,
        candidate_input_event_id
      ) VALUES (
        'CURRENT',
        'staging',
        next_candidate_input_head->>'contract_fingerprint',
        next_candidate_input_head->>'candidate_input_head_id',
        next_candidate_input_head->>'canonical_payload_digest',
        (next_candidate_input_head->>'generation')::bigint,
        next_candidate_input_head->>'correction_discharge_map_id',
        next_candidate_input_head->>'correction_discharge_map_payload_digest',
        candidate_input_event->>'candidate_input_event_id'
      );
    END IF;

    INSERT INTO canonical_v2_staging.write_receipts(
      operation,
      idempotency_key,
      input_digest,
      receipt_id,
      canonical_payload
    ) VALUES (
      p_operation,
      p_idempotency_key,
      p_input_digest,
      p_receipt->>'receiptId',
      p_receipt
    );
    RETURN p_receipt || jsonb_build_object('replayed', false);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      coalesce(p_write_set->'excerpts', '[]'::jsonb)
      || coalesce(p_write_set->'validated_semantic_graphs', '[]'::jsonb)
      || coalesce(p_write_set->'provisions', '[]'::jsonb)
      || coalesce(p_write_set->'components', '[]'::jsonb)
      || coalesce(p_write_set->'claims', '[]'::jsonb)
      || coalesce(p_write_set->'relationships', '[]'::jsonb)
      || coalesce(p_write_set->'open_world_candidates', '[]'::jsonb)
      || coalesce(p_write_set->'open_world_candidate_occurrences', '[]'::jsonb)
      || coalesce(p_write_set->'open_world_evidence_references', '[]'::jsonb)
      || coalesce(p_write_set->'open_world_candidate_dispositions', '[]'::jsonb)
      || coalesce(p_write_set->'open_world_primitives', '[]'::jsonb)
      || coalesce(p_write_set->'semantic_impact_closures', '[]'::jsonb)
      || coalesce(p_write_set->'reviewed_source_specific_rows', '[]'::jsonb)
      || coalesce(p_write_set->'incomplete_canonical_result_rows', '[]'::jsonb)
    ) AS publishable(item)
    JOIN canonical_v2_staging.quarantines quarantine
      ON quarantine.closure_id = publishable.item->>'closure_id'
  ) THEN
    RAISE EXCEPTION 'quarantined semantic closure cannot publish under the same identity'
      USING ERRCODE = '23514';
  END IF;

  IF p_operation <> 'DEAL_SCOPE_RUN' THEN
    FOR item IN
      SELECT ordered_item.value
      FROM jsonb_array_elements(
        CASE WHEN p_write_set ? 'sources'
          THEN p_write_set->'sources'
          ELSE jsonb_build_array(p_write_set->'source')
        END
      ) AS ordered_item(value)
      ORDER BY ordered_item.value->>'immutable_source_document_id'
    LOOP
      item_id := item->>'immutable_source_document_id';
      SELECT canonical_payload_digest INTO existing_digest
      FROM canonical_v2_staging.immutable_source_documents
      WHERE immutable_source_document_id = item_id;
      IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
      END IF;
      INSERT INTO canonical_v2_staging.immutable_source_documents(immutable_source_document_id, canonical_payload)
      VALUES (item_id, item) ON CONFLICT (immutable_source_document_id) DO NOTHING;
      SELECT canonical_payload_digest INTO existing_digest
      FROM canonical_v2_staging.immutable_source_documents
      WHERE immutable_source_document_id = item_id;
      IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
      END IF;
    END LOOP;

    FOR item IN
      SELECT ordered_item.value
      FROM jsonb_array_elements(
        CASE WHEN p_write_set ? 'source_admissions'
          THEN p_write_set->'source_admissions'
          ELSE jsonb_build_array(p_write_set->'source_admission')
        END
      ) AS ordered_item(value)
      ORDER BY ordered_item.value->>'source_admission_manifest_id'
    LOOP
      item_id := item->>'source_admission_manifest_id';
      SELECT canonical_payload_digest INTO existing_digest
      FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id = item_id;
      IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
      END IF;
      INSERT INTO canonical_v2_staging.source_admission_manifests(source_admission_manifest_id, canonical_payload)
      VALUES (item_id, item) ON CONFLICT (source_admission_manifest_id) DO NOTHING;
      SELECT canonical_payload_digest INTO existing_digest
      FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id = item_id;
      IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
        RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
      END IF;
    END LOOP;
  END IF;

  item := p_write_set->'deal';
  item_id := item->>'deal_key';
  SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.deals WHERE deal_key = item_id;
  IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical deal identity conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.deals(deal_key, canonical_payload)
  VALUES (item_id, item) ON CONFLICT (deal_key) DO NOTHING;
  SELECT canonical_payload_digest INTO existing_digest
  FROM canonical_v2_staging.deals
  WHERE deal_key = item_id;
  IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical deal identity conflict' USING ERRCODE = '23505';
  END IF;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'validated_semantic_graphs', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'validated_semantic_graph_id'
  LOOP
    item_id := item->>'validated_semantic_graph_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.validated_semantic_graphs
    WHERE validated_semantic_graph_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'validated semantic graph identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.validated_semantic_graphs(validated_semantic_graph_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (validated_semantic_graph_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.validated_semantic_graphs
    WHERE validated_semantic_graph_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'validated semantic graph identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'excerpts', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'excerpt_id'
  LOOP
    item_id := item->>'excerpt_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.excerpts WHERE excerpt_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical excerpt identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.excerpts(excerpt_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (excerpt_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.excerpts WHERE excerpt_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical excerpt identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'provisions', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'provision_instance_id'
  LOOP
    item_id := item->>'provision_instance_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.provision_instances WHERE provision_instance_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical provision identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.provision_instances(provision_instance_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (provision_instance_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.provision_instances WHERE provision_instance_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical provision identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'components', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'provision_component_id'
  LOOP
    item_id := item->>'provision_component_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.provision_components WHERE provision_component_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical component identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.provision_components(provision_component_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (provision_component_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.provision_components WHERE provision_component_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical component identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'claims', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'claim_revision_id'
  LOOP
    item_id := item->>'claim_revision_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.claim_revisions WHERE claim_revision_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical claim identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.claim_revisions(claim_revision_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (claim_revision_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.claim_revisions WHERE claim_revision_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical claim identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'relationships', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'relationship_revision_id'
  LOOP
    item_id := item->>'relationship_revision_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.relationship_revisions WHERE relationship_revision_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical relationship identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.relationship_revisions(relationship_revision_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (relationship_revision_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.relationship_revisions WHERE relationship_revision_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical relationship identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'open_world_candidates', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'candidate_id'
  LOOP
    item_id := item->>'candidate_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidates WHERE candidate_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world candidate identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidates(candidate_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (candidate_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.open_world_candidates WHERE candidate_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'open-world candidate identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'open_world_candidate_occurrences', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'open_world_candidate_occurrence_id'
  LOOP
    item_id := item->>'open_world_candidate_occurrence_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidate_occurrences WHERE open_world_candidate_occurrence_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world candidate occurrence identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidate_occurrences(open_world_candidate_occurrence_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (open_world_candidate_occurrence_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.open_world_candidate_occurrences
    WHERE open_world_candidate_occurrence_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'open-world candidate occurrence identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'open_world_evidence_references', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'evidence_reference_id'
  LOOP
    item_id := item->>'evidence_reference_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_evidence_references WHERE evidence_reference_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world evidence identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_evidence_references(evidence_reference_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (evidence_reference_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.open_world_evidence_references
    WHERE evidence_reference_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'open-world evidence identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'open_world_candidate_dispositions', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'final_disposition_id'
  LOOP
    item_id := item->>'final_disposition_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidate_dispositions WHERE final_disposition_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world disposition identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidate_dispositions(final_disposition_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (final_disposition_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.open_world_candidate_dispositions
    WHERE final_disposition_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'open-world disposition identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_write_set->'open_world_primitives', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'primitive_id'
  LOOP
    item_id := item->>'primitive_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_primitives WHERE primitive_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world primitive identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_primitives(primitive_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (primitive_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.open_world_primitives WHERE primitive_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'open-world primitive identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'semantic_impact_closures', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'semantic_impact_closure_id'
  LOOP
    item_id := item->>'semantic_impact_closure_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.semantic_impact_closures WHERE semantic_impact_closure_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'semantic impact closure identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.semantic_impact_closures(semantic_impact_closure_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (semantic_impact_closure_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.semantic_impact_closures
    WHERE semantic_impact_closure_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'semantic impact closure identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'reviewed_source_specific_rows', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'reviewed_source_specific_row_serving_key'
  LOOP
    item_id := item->>'reviewed_source_specific_row_serving_key';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.reviewed_source_specific_rows WHERE reviewed_source_specific_row_serving_key = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'reviewed source-specific row identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.reviewed_source_specific_rows(reviewed_source_specific_row_serving_key, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (reviewed_source_specific_row_serving_key) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.reviewed_source_specific_rows
    WHERE reviewed_source_specific_row_serving_key = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'reviewed source-specific row identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(
      coalesce(p_write_set->'incomplete_canonical_result_rows', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'incomplete_result_review_row_serving_key'
  LOOP
    item_id := item->>'incomplete_result_review_row_serving_key';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.incomplete_canonical_result_rows WHERE incomplete_result_review_row_serving_key = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'incomplete canonical result row identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.incomplete_canonical_result_rows(incomplete_result_review_row_serving_key, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (incomplete_result_review_row_serving_key) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.incomplete_canonical_result_rows
    WHERE incomplete_result_review_row_serving_key = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'incomplete canonical result row identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_residuals, '[]'::jsonb)) AS ordered_item(value)
    ORDER BY ordered_item.value->>'residual_id'
  LOOP
    INSERT INTO canonical_v2_staging.residuals(residual_id, closure_id, reason_code, canonical_payload)
    VALUES (item->>'residual_id', item->>'closure_id', item->>'reason_code', item)
    ON CONFLICT (residual_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.residuals
    WHERE residual_id = item->>'residual_id';
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical residual identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  FOR item IN
    SELECT ordered_item.value
    FROM jsonb_array_elements(coalesce(p_quarantines, '[]'::jsonb)) AS ordered_item(value)
    ORDER BY ordered_item.value->>'quarantine_id'
  LOOP
    INSERT INTO canonical_v2_staging.quarantines(quarantine_id, closure_id, reason_code, canonical_payload)
    VALUES (item->>'quarantine_id', item->>'closure_id', item->>'reason_code', item)
    ON CONFLICT (quarantine_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.quarantines
    WHERE quarantine_id = item->>'quarantine_id';
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical quarantine identity conflict' USING ERRCODE = '23505';
    END IF;
  END LOOP;

  INSERT INTO canonical_v2_staging.write_receipts(operation, idempotency_key, input_digest, receipt_id, canonical_payload)
  VALUES (p_operation, p_idempotency_key, p_input_digest, p_receipt->>'receiptId', p_receipt);
  RETURN p_receipt || jsonb_build_object('replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION canonical_v2_staging.canonical_json(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.content_id(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
COMMIT;
