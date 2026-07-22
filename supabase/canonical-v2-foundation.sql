-- Additive staging-only foundation for the canonical v2 vertical slice.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS canonical_v2_staging;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canonical_v2_writer') THEN
    CREATE ROLE canonical_v2_writer NOLOGIN;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION canonical_v2_staging.payload_digest(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'::text),
    'hex'
  )
$$;

CREATE TABLE IF NOT EXISTS canonical_v2_staging.deals (
  deal_key text PRIMARY KEY,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.immutable_source_documents (
  immutable_source_document_id text PRIMARY KEY,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.source_admission_manifests (
  source_admission_manifest_id text PRIMARY KEY,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.intake_capture_receipts (
  intake_capture_receipt_id text PRIMARY KEY
    CHECK (intake_capture_receipt_id ~ '^[0-9a-f]{64}$'),
  retrieval_url_sha256 text NOT NULL
    CHECK (retrieval_url_sha256 ~ '^[0-9a-f]{64}$'),
  response_bytes_sha256 text NOT NULL
    CHECK (response_bytes_sha256 ~ '^[0-9a-f]{64}$'),
  response_byte_length bigint NOT NULL CHECK (response_byte_length > 0),
  source_response_content_id text NOT NULL
    CHECK (source_response_content_id ~ '^[0-9a-f]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.validated_semantic_graphs (
  validated_semantic_graph_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.excerpts (
  excerpt_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.provision_instances (
  provision_instance_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.provision_components (
  provision_component_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.claim_revisions (
  claim_revision_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.relationship_revisions (
  relationship_revision_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.open_world_candidates (
  candidate_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.open_world_candidate_occurrences (
  open_world_candidate_occurrence_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.open_world_evidence_references (
  evidence_reference_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.open_world_candidate_dispositions (
  final_disposition_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.open_world_primitives (
  primitive_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.semantic_impact_closures (
  semantic_impact_closure_id text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.reviewed_source_specific_rows (
  reviewed_source_specific_row_serving_key text PRIMARY KEY,
  closure_id text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.residuals (
  residual_id text PRIMARY KEY,
  closure_id text NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN (
    'UNKNOWN_ATTRIBUTE',
    'INVALID_TAXONOMY_CODE',
    'PRESENT_WITHOUT_EVIDENCE',
    'ABSENT_WITHOUT_COMPLETE_SCOPE',
    'NON_PRESENT_ASSERTED_VALUE',
    'PRESENT_WITHOUT_RESOLVED_TARGET',
    'PRESENT_WITHOUT_EFFECT',
    'STATE_DETAIL_REQUIRED',
    'INVALID_CANONICAL_VALUE',
    'CANONICAL_IDENTITY_MISMATCH',
    'EVIDENCE_REFERENCE_UNRESOLVED',
    'SEMANTIC_REFERENCE_UNRESOLVED'
  )),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.quarantines (
  quarantine_id text PRIMARY KEY,
  closure_id text NOT NULL,
  reason_code text NOT NULL CHECK (reason_code = 'UNRESOLVED_RESIDUAL'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (canonical_v2_staging.payload_digest(canonical_payload)) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.correction_authority_materialisations (
  correction_authority_materialisation_id text PRIMARY KEY
    CHECK (correction_authority_materialisation_id ~ '^[0-9a-f]{64}$'),
  correction_authority_materialisation_payload_digest text NOT NULL
    CHECK (correction_authority_materialisation_payload_digest ~ '^[0-9a-f]{64}$'),
  correction_application_id text NOT NULL UNIQUE
    CHECK (correction_application_id ~ '^[0-9a-f]{64}$'),
  correction_discharge_id text NOT NULL UNIQUE
    CHECK (correction_discharge_id ~ '^[0-9a-f]{64}$'),
  correction_discharge_payload_digest text NOT NULL
    CHECK (correction_discharge_payload_digest ~ '^[0-9a-f]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.correction_discharge_maps (
  correction_discharge_map_id text PRIMARY KEY
    CHECK (correction_discharge_map_id ~ '^[0-9a-f]{64}$'),
  correction_discharge_map_payload_digest text NOT NULL
    CHECK (correction_discharge_map_payload_digest ~ '^[0-9a-f]{64}$'),
  contract_fingerprint text NOT NULL
    CHECK (contract_fingerprint ~ '^[0-9a-f]{64}$'),
  entry_count integer NOT NULL CHECK (entry_count BETWEEN 0 AND 512),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.correction_discharge_map_entries (
  correction_discharge_map_id text NOT NULL REFERENCES canonical_v2_staging.correction_discharge_maps,
  entry_ordinal integer NOT NULL CHECK (entry_ordinal BETWEEN 0 AND 511),
  correction_application_id text NOT NULL,
  correction_discharge_id text NOT NULL,
  correction_authority_materialisation_id text NOT NULL
    REFERENCES canonical_v2_staging.correction_authority_materialisations,
  correction_authority_materialisation_payload_digest text NOT NULL,
  PRIMARY KEY (correction_discharge_map_id, entry_ordinal),
  UNIQUE (correction_discharge_map_id, correction_application_id),
  UNIQUE (correction_discharge_map_id, correction_discharge_id),
  UNIQUE (correction_discharge_map_id, correction_authority_materialisation_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_input_events (
  candidate_input_event_id text PRIMARY KEY
    CHECK (candidate_input_event_id ~ '^[0-9a-f]{64}$'),
  candidate_input_event_payload_digest text NOT NULL
    CHECK (candidate_input_event_payload_digest ~ '^[0-9a-f]{64}$'),
  environment text NOT NULL CHECK (environment = 'staging'),
  contract_fingerprint text NOT NULL
    CHECK (contract_fingerprint ~ '^[0-9a-f]{64}$'),
  input_generation bigint NOT NULL CHECK (input_generation > 0),
  predecessor_candidate_input_head_id text,
  predecessor_candidate_input_head_payload_digest text,
  successor_candidate_input_head_id text NOT NULL
    CHECK (successor_candidate_input_head_id ~ '^[0-9a-f]{64}$'),
  successor_candidate_input_head_payload_digest text NOT NULL
    CHECK (successor_candidate_input_head_payload_digest ~ '^[0-9a-f]{64}$'),
  correction_discharge_map_id text NOT NULL
    REFERENCES canonical_v2_staging.correction_discharge_maps,
  correction_discharge_map_payload_digest text NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED,
  CHECK (
    (predecessor_candidate_input_head_id IS NULL
      AND predecessor_candidate_input_head_payload_digest IS NULL)
    OR
    (predecessor_candidate_input_head_id ~ '^[0-9a-f]{64}$'
      AND predecessor_candidate_input_head_payload_digest ~ '^[0-9a-f]{64}$')
  )
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_input_head_versions (
  candidate_input_head_id text PRIMARY KEY
    CHECK (candidate_input_head_id ~ '^[0-9a-f]{64}$'),
  candidate_input_head_payload_digest text NOT NULL
    CHECK (candidate_input_head_payload_digest ~ '^[0-9a-f]{64}$'),
  environment text NOT NULL CHECK (environment = 'staging'),
  contract_fingerprint text NOT NULL
    CHECK (contract_fingerprint ~ '^[0-9a-f]{64}$'),
  input_generation bigint NOT NULL CHECK (input_generation > 0),
  correction_discharge_map_id text NOT NULL
    REFERENCES canonical_v2_staging.correction_discharge_maps,
  correction_discharge_map_payload_digest text NOT NULL,
  previous_candidate_input_head_id text
    REFERENCES canonical_v2_staging.candidate_input_head_versions(candidate_input_head_id),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED,
  CHECK (
    previous_candidate_input_head_id IS NULL
    OR previous_candidate_input_head_id ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_input_heads (
  singleton_key text PRIMARY KEY CHECK (singleton_key = 'CURRENT'),
  environment text NOT NULL CHECK (environment = 'staging'),
  contract_fingerprint text NOT NULL
    CHECK (contract_fingerprint ~ '^[0-9a-f]{64}$'),
  candidate_input_head_id text NOT NULL
    CHECK (candidate_input_head_id ~ '^[0-9a-f]{64}$'),
  candidate_input_head_payload_digest text NOT NULL
    CHECK (candidate_input_head_payload_digest ~ '^[0-9a-f]{64}$'),
  input_generation bigint NOT NULL CHECK (input_generation > 0),
  correction_discharge_map_id text NOT NULL
    REFERENCES canonical_v2_staging.correction_discharge_maps,
  correction_discharge_map_payload_digest text NOT NULL,
  candidate_input_event_id text NOT NULL
    REFERENCES canonical_v2_staging.candidate_input_events,
  FOREIGN KEY (candidate_input_head_id)
    REFERENCES canonical_v2_staging.candidate_input_head_versions(candidate_input_head_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.write_receipts (
  operation text NOT NULL CHECK (operation IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE'
  )),
  idempotency_key text NOT NULL,
  input_digest text NOT NULL,
  receipt_id text NOT NULL UNIQUE,
  canonical_payload jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (operation, idempotency_key)
);

ALTER TABLE canonical_v2_staging.write_receipts
  DROP CONSTRAINT IF EXISTS write_receipts_operation_check;
ALTER TABLE canonical_v2_staging.write_receipts
  ADD CONSTRAINT write_receipts_operation_check CHECK (operation IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE'
  ));

CREATE INDEX IF NOT EXISTS canonical_v2_excerpts_closure_idx
  ON canonical_v2_staging.excerpts(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_validated_semantic_graphs_closure_idx
  ON canonical_v2_staging.validated_semantic_graphs(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_provisions_closure_idx
  ON canonical_v2_staging.provision_instances(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_components_closure_idx
  ON canonical_v2_staging.provision_components(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_claims_closure_idx
  ON canonical_v2_staging.claim_revisions(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_relationships_closure_idx
  ON canonical_v2_staging.relationship_revisions(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_open_world_candidates_closure_idx
  ON canonical_v2_staging.open_world_candidates(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_open_world_occurrences_closure_idx
  ON canonical_v2_staging.open_world_candidate_occurrences(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_open_world_evidence_closure_idx
  ON canonical_v2_staging.open_world_evidence_references(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_open_world_dispositions_closure_idx
  ON canonical_v2_staging.open_world_candidate_dispositions(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_open_world_primitives_closure_idx
  ON canonical_v2_staging.open_world_primitives(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_semantic_impact_closures_closure_idx
  ON canonical_v2_staging.semantic_impact_closures(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_reviewed_source_specific_rows_closure_idx
  ON canonical_v2_staging.reviewed_source_specific_rows(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_residuals_closure_idx
  ON canonical_v2_staging.residuals(closure_id);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_v2_quarantines_closure_unique
  ON canonical_v2_staging.quarantines(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_correction_map_entries_materialisation_idx
  ON canonical_v2_staging.correction_discharge_map_entries(correction_authority_materialisation_id);

ALTER TABLE canonical_v2_staging.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.immutable_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.source_admission_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.intake_capture_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.validated_semantic_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.excerpts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.provision_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.provision_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.claim_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.relationship_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.open_world_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.open_world_candidate_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.open_world_evidence_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.open_world_candidate_dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.open_world_primitives ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.semantic_impact_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.reviewed_source_specific_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.residuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.quarantines ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.correction_authority_materialisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.correction_discharge_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.correction_discharge_map_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_input_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_input_head_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_input_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.write_receipts ENABLE ROW LEVEL SECURITY;

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
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_write is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_operation NOT IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE'
  ) THEN
    RAISE EXCEPTION 'unsupported canonical operation' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(trim(p_idempotency_key)), 0) = 0 OR coalesce(length(trim(p_input_digest)), 0) = 0 THEN
    RAISE EXCEPTION 'idempotency key and input digest are required' USING ERRCODE = '22023';
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
    RETURN existing_receipt.canonical_payload || jsonb_build_object('replayed', true);
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

    FOR item IN SELECT value FROM jsonb_array_elements(
      p_write_set->'correction_authority_materialisations'
    ) LOOP
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
    ) AS publishable(item)
    JOIN canonical_v2_staging.quarantines quarantine
      ON quarantine.closure_id = publishable.item->>'closure_id'
  ) THEN
    RAISE EXCEPTION 'quarantined semantic closure cannot publish under the same identity'
      USING ERRCODE = '23514';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(
    CASE WHEN p_write_set ? 'sources'
      THEN p_write_set->'sources'
      ELSE jsonb_build_array(p_write_set->'source')
    END
  ) LOOP
    item_id := item->>'immutable_source_document_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.immutable_source_documents
    WHERE immutable_source_document_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.immutable_source_documents(immutable_source_document_id, canonical_payload)
    VALUES (item_id, item) ON CONFLICT (immutable_source_document_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(
    CASE WHEN p_write_set ? 'source_admissions'
      THEN p_write_set->'source_admissions'
      ELSE jsonb_build_array(p_write_set->'source_admission')
    END
  ) LOOP
    item_id := item->>'source_admission_manifest_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.source_admission_manifests
    WHERE source_admission_manifest_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.source_admission_manifests(source_admission_manifest_id, canonical_payload)
    VALUES (item_id, item) ON CONFLICT (source_admission_manifest_id) DO NOTHING;
  END LOOP;

  item := p_write_set->'deal';
  item_id := item->>'deal_key';
  SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.deals WHERE deal_key = item_id;
  IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical deal identity conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.deals(deal_key, canonical_payload)
  VALUES (item_id, item) ON CONFLICT (deal_key) DO NOTHING;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'validated_semantic_graphs', '[]'::jsonb)) LOOP
    item_id := item->>'validated_semantic_graph_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.validated_semantic_graphs
    WHERE validated_semantic_graph_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'validated semantic graph identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.validated_semantic_graphs(validated_semantic_graph_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (validated_semantic_graph_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'excerpts', '[]'::jsonb)) LOOP
    item_id := item->>'excerpt_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.excerpts WHERE excerpt_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical excerpt identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.excerpts(excerpt_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (excerpt_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'provisions', '[]'::jsonb)) LOOP
    item_id := item->>'provision_instance_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.provision_instances WHERE provision_instance_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical provision identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.provision_instances(provision_instance_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (provision_instance_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'components', '[]'::jsonb)) LOOP
    item_id := item->>'provision_component_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.provision_components WHERE provision_component_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical component identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.provision_components(provision_component_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (provision_component_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'claims', '[]'::jsonb)) LOOP
    item_id := item->>'claim_revision_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.claim_revisions WHERE claim_revision_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical claim identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.claim_revisions(claim_revision_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (claim_revision_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'relationships', '[]'::jsonb)) LOOP
    item_id := item->>'relationship_revision_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.relationship_revisions WHERE relationship_revision_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'canonical relationship identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.relationship_revisions(relationship_revision_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (relationship_revision_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'open_world_candidates', '[]'::jsonb)) LOOP
    item_id := item->>'candidate_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidates WHERE candidate_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world candidate identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidates(candidate_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (candidate_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'open_world_candidate_occurrences', '[]'::jsonb)) LOOP
    item_id := item->>'open_world_candidate_occurrence_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidate_occurrences WHERE open_world_candidate_occurrence_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world candidate occurrence identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidate_occurrences(open_world_candidate_occurrence_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (open_world_candidate_occurrence_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'open_world_evidence_references', '[]'::jsonb)) LOOP
    item_id := item->>'evidence_reference_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_evidence_references WHERE evidence_reference_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world evidence identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_evidence_references(evidence_reference_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (evidence_reference_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'open_world_candidate_dispositions', '[]'::jsonb)) LOOP
    item_id := item->>'final_disposition_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_candidate_dispositions WHERE final_disposition_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world disposition identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_candidate_dispositions(final_disposition_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (final_disposition_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'open_world_primitives', '[]'::jsonb)) LOOP
    item_id := item->>'primitive_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.open_world_primitives WHERE primitive_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'open-world primitive identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.open_world_primitives(primitive_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (primitive_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'semantic_impact_closures', '[]'::jsonb)) LOOP
    item_id := item->>'semantic_impact_closure_id';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.semantic_impact_closures WHERE semantic_impact_closure_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'semantic impact closure identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.semantic_impact_closures(semantic_impact_closure_id, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (semantic_impact_closure_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_write_set->'reviewed_source_specific_rows', '[]'::jsonb)) LOOP
    item_id := item->>'reviewed_source_specific_row_serving_key';
    SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.reviewed_source_specific_rows WHERE reviewed_source_specific_row_serving_key = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN RAISE EXCEPTION 'reviewed source-specific row identity conflict' USING ERRCODE = '23505'; END IF;
    INSERT INTO canonical_v2_staging.reviewed_source_specific_rows(reviewed_source_specific_row_serving_key, closure_id, canonical_payload)
    VALUES (item_id, item->>'closure_id', item) ON CONFLICT (reviewed_source_specific_row_serving_key) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_residuals, '[]'::jsonb)) LOOP
    INSERT INTO canonical_v2_staging.residuals(residual_id, closure_id, reason_code, canonical_payload)
    VALUES (item->>'residual_id', item->>'closure_id', item->>'reason_code', item)
    ON CONFLICT (residual_id) DO NOTHING;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_quarantines, '[]'::jsonb)) LOOP
    INSERT INTO canonical_v2_staging.quarantines(quarantine_id, closure_id, reason_code, canonical_payload)
    VALUES (item->>'quarantine_id', item->>'closure_id', item->>'reason_code', item)
    ON CONFLICT (quarantine_id) DO NOTHING;
  END LOOP;

  INSERT INTO canonical_v2_staging.write_receipts(operation, idempotency_key, input_digest, receipt_id, canonical_payload)
  VALUES (p_operation, p_idempotency_key, p_input_digest, p_receipt->>'receiptId', p_receipt);
  RETURN p_receipt || jsonb_build_object('replayed', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_select_candidate_inputs(
  p_environment text,
  p_contract_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
DECLARE
  selected_head jsonb;
  selected_map jsonb;
  selected_materialisations jsonb;
  expected_count integer;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging'
    OR p_contract_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'candidate input selector is staging-only and contract-bound'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    head_version.canonical_payload,
    discharge_map.canonical_payload,
    coalesce(materialisations.ordered_payloads, '[]'::jsonb),
    discharge_map.entry_count
  INTO selected_head, selected_map, selected_materialisations, expected_count
  FROM canonical_v2_staging.candidate_input_heads current_head
  JOIN canonical_v2_staging.candidate_input_head_versions head_version
    ON head_version.candidate_input_head_id = current_head.candidate_input_head_id
    AND head_version.candidate_input_head_payload_digest
      = current_head.candidate_input_head_payload_digest
    AND head_version.environment = current_head.environment
    AND head_version.contract_fingerprint = current_head.contract_fingerprint
    AND head_version.input_generation = current_head.input_generation
    AND head_version.correction_discharge_map_id = current_head.correction_discharge_map_id
    AND head_version.correction_discharge_map_payload_digest
      = current_head.correction_discharge_map_payload_digest
  JOIN canonical_v2_staging.correction_discharge_maps discharge_map
    ON discharge_map.correction_discharge_map_id = current_head.correction_discharge_map_id
    AND discharge_map.correction_discharge_map_payload_digest
      = current_head.correction_discharge_map_payload_digest
    AND discharge_map.contract_fingerprint = current_head.contract_fingerprint
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(
      materialisation.canonical_payload
      ORDER BY map_entry.entry_ordinal
    ) AS ordered_payloads
    FROM canonical_v2_staging.correction_discharge_map_entries map_entry
    JOIN canonical_v2_staging.correction_authority_materialisations materialisation
      ON materialisation.correction_authority_materialisation_id
        = map_entry.correction_authority_materialisation_id
      AND materialisation.correction_authority_materialisation_payload_digest
        = map_entry.correction_authority_materialisation_payload_digest
      AND materialisation.correction_application_id = map_entry.correction_application_id
      AND materialisation.correction_discharge_id = map_entry.correction_discharge_id
    WHERE map_entry.correction_discharge_map_id = discharge_map.correction_discharge_map_id
  ) materialisations
  WHERE current_head.singleton_key = 'CURRENT'
    AND current_head.environment = p_environment
    AND current_head.contract_fingerprint = p_contract_fingerprint;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no current candidate input head exists for the frozen contract'
      USING ERRCODE = 'P0002';
  END IF;
  IF jsonb_array_length(selected_materialisations) <> expected_count
    OR expected_count > 512 THEN
    RAISE EXCEPTION 'current correction authority is incomplete or exceeds its bound'
      USING ERRCODE = '23514';
  END IF;

  RETURN jsonb_build_object(
    'captured_candidate_input_head', selected_head,
    'correction_discharge_map', selected_map,
    'ordered_materialisations', selected_materialisations
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_recheck_candidate_input_head(
  p_environment text,
  p_contract_fingerprint text,
  p_expected_candidate_input_head_id text,
  p_expected_candidate_input_head_payload_digest text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
DECLARE
  rechecked_head jsonb;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging'
    OR p_contract_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_expected_candidate_input_head_id !~ '^[0-9a-f]{64}$'
    OR p_expected_candidate_input_head_payload_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'candidate input recheck is staging-only and identity-bound'
      USING ERRCODE = '42501';
  END IF;

  SELECT head_version.canonical_payload INTO rechecked_head
  FROM canonical_v2_staging.candidate_input_heads current_head
  JOIN canonical_v2_staging.candidate_input_head_versions head_version
    ON head_version.candidate_input_head_id = current_head.candidate_input_head_id
    AND head_version.candidate_input_head_payload_digest
      = current_head.candidate_input_head_payload_digest
  WHERE current_head.singleton_key = 'CURRENT'
    AND current_head.environment = p_environment
    AND current_head.contract_fingerprint = p_contract_fingerprint;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no current candidate input head exists for the frozen contract'
      USING ERRCODE = 'P0002';
  END IF;
  IF rechecked_head->>'candidate_input_head_id'
      IS DISTINCT FROM p_expected_candidate_input_head_id
    OR rechecked_head->>'canonical_payload_digest'
      IS DISTINCT FROM p_expected_candidate_input_head_payload_digest THEN
    RAISE EXCEPTION 'candidate input head changed after selection'
      USING ERRCODE = '40001';
  END IF;
  RETURN jsonb_build_object('current_candidate_input_head', rechecked_head);
END;
$$;

REVOKE ALL ON SCHEMA canonical_v2_staging FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA canonical_v2_staging
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA canonical_v2_staging
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_write(text, text, text, text, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.canonical_v2_select_candidate_inputs(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.canonical_v2_recheck_candidate_input_head(text, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA canonical_v2_staging TO canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_write(text, text, text, text, jsonb, jsonb, jsonb, jsonb)
  TO canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_select_candidate_inputs(text, text)
  TO canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_recheck_candidate_input_head(text, text, text, text)
  TO canonical_v2_writer;
