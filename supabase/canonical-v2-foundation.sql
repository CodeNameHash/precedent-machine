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

CREATE TABLE IF NOT EXISTS canonical_v2_staging.source_artifact_manifests (
  artifact_manifest_id text PRIMARY KEY
    CHECK (artifact_manifest_id ~ '^[0-9a-f]{64}$'),
  artifact_kind text NOT NULL
    CHECK (artifact_kind = 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'),
  payload_encoding text NOT NULL
    CHECK (payload_encoding = 'CANONICAL_JSON_UTF8/V1'),
  payload_byte_length bigint NOT NULL CHECK (payload_byte_length > 0),
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  chunk_count integer NOT NULL CHECK (chunk_count > 0),
  chunk_max_byte_length integer NOT NULL
    CHECK (chunk_max_byte_length = 196608),
  ordered_chunk_sha256 jsonb NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED,
  CHECK (jsonb_typeof(ordered_chunk_sha256) = 'array'),
  CHECK (jsonb_array_length(ordered_chunk_sha256) = chunk_count),
  CHECK (payload_byte_length > (chunk_count::bigint - 1) * chunk_max_byte_length),
  CHECK (payload_byte_length <= chunk_count::bigint * chunk_max_byte_length)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.source_artifact_chunks (
  artifact_manifest_id text NOT NULL
    REFERENCES canonical_v2_staging.source_artifact_manifests(artifact_manifest_id),
  chunk_ordinal integer NOT NULL CHECK (chunk_ordinal >= 0),
  artifact_kind text NOT NULL
    CHECK (artifact_kind = 'SEC_HTML_CANONICAL_TEXT_CONVERSION/V2'),
  chunk_byte_length integer NOT NULL
    CHECK (chunk_byte_length BETWEEN 1 AND 196608),
  chunk_sha256 text NOT NULL CHECK (chunk_sha256 ~ '^[0-9a-f]{64}$'),
  chunk_id text NOT NULL UNIQUE CHECK (chunk_id ~ '^[0-9a-f]{64}$'),
  chunk_payload bytea NOT NULL,
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED,
  PRIMARY KEY (artifact_manifest_id, chunk_ordinal),
  CHECK (octet_length(chunk_payload) = chunk_byte_length),
  CHECK (
    encode(extensions.digest(chunk_payload, 'sha256'::text), 'hex') = chunk_sha256
  )
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.canonical_text_conversions (
  canonical_text_id text PRIMARY KEY CHECK (canonical_text_id ~ '^[0-9a-f]{64}$'),
  intake_capture_receipt_id text NOT NULL
    REFERENCES canonical_v2_staging.intake_capture_receipts(intake_capture_receipt_id),
  source_response_content_id text NOT NULL CHECK (source_response_content_id ~ '^[0-9a-f]{64}$'),
  canonical_text_sha256 text NOT NULL CHECK (canonical_text_sha256 ~ '^[0-9a-f]{64}$'),
  canonical_text_byte_length bigint NOT NULL CHECK (canonical_text_byte_length > 0),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.canonical_text_verification_manifests (
  verification_manifest_id text PRIMARY KEY CHECK (verification_manifest_id ~ '^[0-9a-f]{64}$'),
  canonical_text_id text NOT NULL
    REFERENCES canonical_v2_staging.canonical_text_conversions(canonical_text_id),
  intake_capture_receipt_id text NOT NULL
    REFERENCES canonical_v2_staging.intake_capture_receipts(intake_capture_receipt_id),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.source_admission_preparation_receipts (
  source_admission_preparation_receipt_id text PRIMARY KEY
    CHECK (source_admission_preparation_receipt_id ~ '^[0-9a-f]{64}$'),
  immutable_source_document_id text NOT NULL
    REFERENCES canonical_v2_staging.immutable_source_documents(immutable_source_document_id),
  source_admission_manifest_id text NOT NULL
    REFERENCES canonical_v2_staging.source_admission_manifests(source_admission_manifest_id),
  verification_manifest_id text NOT NULL
    REFERENCES canonical_v2_staging.canonical_text_verification_manifests(verification_manifest_id),
  canonical_payload jsonb NOT NULL,
  canonical_payload_storage_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.semantic_extraction_input_envelopes (
  semantic_extraction_input_envelope_id text PRIMARY KEY
    CHECK (semantic_extraction_input_envelope_id ~ '^[0-9a-f]{64}$'),
  immutable_source_document_id text NOT NULL
    REFERENCES canonical_v2_staging.immutable_source_documents(immutable_source_document_id),
  source_admission_manifest_id text NOT NULL
    REFERENCES canonical_v2_staging.source_admission_manifests(source_admission_manifest_id),
  verification_manifest_id text NOT NULL
    REFERENCES canonical_v2_staging.canonical_text_verification_manifests(verification_manifest_id),
  canonical_text_id text NOT NULL
    REFERENCES canonical_v2_staging.canonical_text_conversions(canonical_text_id),
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

CREATE TABLE IF NOT EXISTS canonical_v2_staging.incomplete_canonical_result_rows (
  incomplete_result_review_row_serving_key text PRIMARY KEY,
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

-- Contract amendments keep the reviewed authority chain for each frozen
-- contract independently current. The original singleton primary key made a
-- second contract genesis impossible even though every selector and recheck is
-- contract-bound. Preserve CURRENT as the row kind while partitioning the
-- pointer identity by environment and contract fingerprint.
ALTER TABLE canonical_v2_staging.candidate_input_heads
  DROP CONSTRAINT IF EXISTS candidate_input_heads_pkey;
ALTER TABLE canonical_v2_staging.candidate_input_heads
  ADD CONSTRAINT candidate_input_heads_pkey
  PRIMARY KEY (environment, contract_fingerprint);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.write_receipts (
  operation text NOT NULL CHECK (operation IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN'
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
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN'
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
CREATE INDEX IF NOT EXISTS canonical_v2_incomplete_canonical_result_rows_closure_idx
  ON canonical_v2_staging.incomplete_canonical_result_rows(closure_id);
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
ALTER TABLE canonical_v2_staging.source_artifact_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.source_artifact_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.canonical_text_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.canonical_text_verification_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.source_admission_preparation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.semantic_extraction_input_envelopes ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE canonical_v2_staging.incomplete_canonical_result_rows ENABLE ROW LEVEL SECURITY;
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

    IF conversion->>'canonical_text_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SEC_CANONICAL_TEXT/V2',
          jsonb_build_object(
            'source_response_content_id', conversion->'source_response_content_id',
            'converter_digest', conversion->'converter_digest',
            'converter_config_digest', conversion->'converter_config_digest',
            'canonical_text_sha256', conversion->'canonical_text_sha256',
            'canonical_text_byte_length', conversion->'canonical_text_byte_length',
            'source_map_digest', conversion->'source_map_digest'
          )
        ) THEN
      RAISE EXCEPTION 'canonical text conversion identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF verification->>'verification_manifest_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'CANONICAL_TEXT_VERIFICATION_MANIFEST/V1',
          verification - 'verification_manifest_id'
        ) THEN
      RAISE EXCEPTION 'canonical text verification identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF immutable_source->>'immutable_source_document_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'IMMUTABLE_SOURCE_DOCUMENT/V2',
          immutable_source - 'immutable_source_document_id'
        ) THEN
      RAISE EXCEPTION 'immutable source document identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF source_admission->>'coverage_proof_digest' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ADMISSION_COVERAGE_PROOF/V2',
          jsonb_build_object(
            'canonical_text_id', conversion->'canonical_text_id',
            'canonical_text_byte_length', conversion->'canonical_text_byte_length',
            'source_map_digest', conversion->'source_map_digest',
            'admitted_intervals', source_admission->'admitted_intervals',
            'excluded_intervals', source_admission->'excluded_intervals',
            'discrepancy_count', source_admission->'discrepancy_count'
          )
        ) THEN
      RAISE EXCEPTION 'source admission coverage proof identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF source_admission->>'source_admission_manifest_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ADMISSION_MANIFEST/V2',
          source_admission - 'source_admission_manifest_id'
        ) THEN
      RAISE EXCEPTION 'source admission manifest identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF preparation_receipt->>'preparation_slot_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ADMISSION_PREPARATION_SLOT/V1',
          jsonb_build_object(
            'intake_capture_receipt_id', capture->'intake_capture_receipt_id',
            'source_admission_manifest_id',
              source_admission->'source_admission_manifest_id'
          )
        ) THEN
      RAISE EXCEPTION 'source admission preparation slot identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF preparation_receipt->>'source_admission_preparation_receipt_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SOURCE_ADMISSION_PREPARATION_RECEIPT/V1',
          preparation_receipt - 'source_admission_preparation_receipt_id'
        ) THEN
      RAISE EXCEPTION 'source admission preparation receipt identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF semantic_input->>'semantic_extraction_input_envelope_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'SEMANTIC_EXTRACTION_INPUT_ENVELOPE/V1',
          semantic_input - 'semantic_extraction_input_envelope_id'
        ) THEN
      RAISE EXCEPTION 'semantic extraction input envelope identity does not match its payload'
        USING ERRCODE = '23514';
    END IF;
    IF source_admission_bundle->>'verified_sec_source_admission_bundle_id' IS DISTINCT FROM
        canonical_v2_staging.content_id(
          'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1',
          source_admission_bundle - 'verified_sec_source_admission_bundle_id'
        ) THEN
      RAISE EXCEPTION 'verified source admission bundle identity does not match its payload'
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
      WITH excerpt_definition AS (
        SELECT
          definition.body,
          canonical_v2_staging.content_id(
            'EXCERPT_DEFINITION/V1',
            definition.body
          ) AS excerpt_definition_id,
          canonical_v2_staging.content_id(
            'EXCERPT_DEFINITION_PAYLOAD/V1',
            definition.body
          ) AS excerpt_definition_payload_digest
        FROM (
          SELECT jsonb_build_object(
            'schema_version', 'EXCERPT_DEFINITION/V1',
            'excerpt_definition_key', 'SINGLE_OPERATIVE_SPAN',
            'excerpt_definition_version', 1,
            'component_slots', jsonb_build_array(jsonb_build_object(
              'component_slot_key', 'PRIMARY',
              'governed_slot_ordinal', 0,
              'cardinality', 'EXACTLY_ONE'
            )),
            'excerpt_purpose', 'LEGAL_EVIDENCE',
            'transformation_or_redaction_version', 'IDENTITY_UTF8/V1'
          ) AS body
        ) definition
      ),
      source_lineage AS (
        SELECT
          reference.value AS reference,
          immutable_source.canonical_payload AS immutable_payload,
          conversion.canonical_text_byte_length,
          pg_catalog.convert_to(
            conversion.canonical_payload->>'canonical_text',
            'UTF8'
          ) AS canonical_text_bytes,
          canonical_v2_staging.content_id(
            'ADMITTED_SOURCE_OCCURRENCE_KEY/V1',
            jsonb_build_object(
              'deal_admission_id', reference.value->'deal_admission_id',
              'source_ordinal', reference.value->'source_ordinal',
              'immutable_source_document_id',
                reference.value->'immutable_source_document_id'
            )
          ) AS source_occurrence_key
        FROM jsonb_array_elements(p_write_set->'source_references') reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id = reference.value->>'canonical_text_id'
      ),
      admitted_occurrences AS (
        SELECT
          source_lineage.reference->>'canonical_text_id' AS canonical_text_id,
          source_lineage.immutable_payload->>'source_response_content_id'
            AS source_content_id,
          source_lineage.immutable_payload->>'response_bytes_sha256'
            AS document_hash,
          source_lineage.canonical_text_byte_length,
          source_lineage.canonical_text_bytes,
          canonical_v2_staging.content_id(
            'SOURCE_OCCURRENCE/V1',
            jsonb_build_object(
              'source_content_id',
                source_lineage.immutable_payload->'source_response_content_id',
              'source_occurrence_key', source_lineage.source_occurrence_key
            )
          ) AS source_occurrence_id
        FROM source_lineage
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.excerpts stored
          ON persisted.reference->>'object_kind' = 'excerpts'
          AND stored.excerpt_id = persisted.reference->>'object_id'
      ),
      typed_excerpts AS (
        SELECT
          supplied.excerpt,
          CASE
            WHEN jsonb_typeof(supplied.excerpt->'absolute_start') = 'number'
              AND supplied.excerpt->>'absolute_start'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.excerpt->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(supplied.excerpt->'absolute_end') = 'number'
              AND supplied.excerpt->>'absolute_end'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.excerpt->>'absolute_end')::bigint
          END AS absolute_end,
          (
            jsonb_typeof(supplied.excerpt) = 'object'
            AND supplied.excerpt ?& ARRAY[
              'schema_version', 'excerpt_id', 'excerpt_definition_id',
              'excerpt_definition_key', 'excerpt_definition_version',
              'excerpt_definition_payload_digest',
              'ordered_component_assignments', 'excerpt_purpose',
              'transformation_or_redaction_version', 'output_text_hash',
              'source_content_id', 'source_occurrence_id', 'canonical_text_id',
              'document_hash', 'absolute_start', 'absolute_end',
              'exact_bytes_digest', 'exact_text', 'closure_id'
            ]
            AND supplied.excerpt - ARRAY[
              'schema_version', 'excerpt_id', 'excerpt_definition_id',
              'excerpt_definition_key', 'excerpt_definition_version',
              'excerpt_definition_payload_digest',
              'ordered_component_assignments', 'excerpt_purpose',
              'transformation_or_redaction_version', 'output_text_hash',
              'source_content_id', 'source_occurrence_id', 'canonical_text_id',
              'document_hash', 'absolute_start', 'absolute_end',
              'exact_bytes_digest', 'exact_text', 'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.excerpt->>'schema_version' = 'EXCERPT/V1'
            AND jsonb_typeof(supplied.excerpt->'schema_version') = 'string'
            AND jsonb_typeof(supplied.excerpt->'excerpt_id') = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'excerpt_definition_id'
            ) = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'excerpt_definition_key'
            ) = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'excerpt_definition_version'
            ) = 'number'
            AND jsonb_typeof(
              supplied.excerpt->'excerpt_definition_payload_digest'
            ) = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'ordered_component_assignments'
            ) = 'array'
            AND jsonb_typeof(supplied.excerpt->'excerpt_purpose') = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'transformation_or_redaction_version'
            ) = 'string'
            AND jsonb_typeof(supplied.excerpt->'output_text_hash') = 'string'
            AND jsonb_typeof(supplied.excerpt->'source_content_id') = 'string'
            AND jsonb_typeof(
              supplied.excerpt->'source_occurrence_id'
            ) = 'string'
            AND jsonb_typeof(supplied.excerpt->'canonical_text_id') = 'string'
            AND jsonb_typeof(supplied.excerpt->'document_hash') = 'string'
            AND jsonb_typeof(supplied.excerpt->'exact_bytes_digest') = 'string'
            AND jsonb_typeof(supplied.excerpt->'exact_text') = 'string'
            AND jsonb_typeof(supplied.excerpt->'closure_id') = 'string'
            AND supplied.excerpt->>'excerpt_id' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'excerpt_definition_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'excerpt_definition_payload_digest'
              ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'output_text_hash' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'source_content_id' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'source_occurrence_id' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'document_hash' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'exact_bytes_digest' ~ '^[0-9a-f]{64}$'
            AND supplied.excerpt->>'closure_id' ~ '^[0-9a-f]{64}$'
          ) AS shape_valid
        FROM supplied_excerpts supplied
      )
      SELECT 1
      FROM typed_excerpts supplied
      CROSS JOIN excerpt_definition definition
      LEFT JOIN admitted_occurrences admitted
        ON admitted.canonical_text_id = supplied.excerpt->>'canonical_text_id'
        AND admitted.source_occurrence_id
          = supplied.excerpt->>'source_occurrence_id'
      WHERE CASE
        WHEN supplied.shape_valid
          AND supplied.absolute_start IS NOT NULL
          AND supplied.absolute_end IS NOT NULL
        THEN
          CASE
            WHEN admitted.canonical_text_id IS NULL THEN true
            WHEN supplied.absolute_start > supplied.absolute_end
              OR supplied.absolute_end > admitted.canonical_text_byte_length
            THEN true
            WHEN supplied.absolute_start < supplied.absolute_end
              AND (
                (
                  supplied.absolute_start < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_start::integer
                  ) BETWEEN 128 AND 191
                ) OR (
                  supplied.absolute_end < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_end::integer
                  ) BETWEEN 128 AND 191
                )
              )
            THEN true
            ELSE
              supplied.excerpt->>'excerpt_definition_id' IS DISTINCT FROM
                definition.excerpt_definition_id
              OR supplied.excerpt->>'excerpt_definition_key'
                IS DISTINCT FROM definition.body->>'excerpt_definition_key'
              OR supplied.excerpt->'excerpt_definition_version'
                IS DISTINCT FROM definition.body->'excerpt_definition_version'
              OR supplied.excerpt->>'excerpt_definition_payload_digest'
                IS DISTINCT FROM definition.excerpt_definition_payload_digest
              OR supplied.excerpt->'ordered_component_assignments'
                IS DISTINCT FROM jsonb_build_array(jsonb_build_object(
                  'component_slot_key', 'PRIMARY',
                  'governed_slot_ordinal', 0,
                  'semantic_span_id',
                    canonical_v2_staging.content_id(
                      'SEMANTIC_SPAN/V1',
                      jsonb_build_object(
                        'schema_version', 'SEMANTIC_SPAN/V1',
                        'canonical_text_id',
                          supplied.excerpt->'canonical_text_id',
                        'absolute_start', supplied.excerpt->'absolute_start',
                        'absolute_end', supplied.excerpt->'absolute_end'
                      )
                    )
                ))
              OR supplied.excerpt->>'excerpt_purpose'
                IS DISTINCT FROM definition.body->>'excerpt_purpose'
              OR supplied.excerpt->>'transformation_or_redaction_version'
                IS DISTINCT FROM
                  definition.body->>'transformation_or_redaction_version'
              OR supplied.excerpt->>'source_content_id'
                IS DISTINCT FROM admitted.source_content_id
              OR supplied.excerpt->>'document_hash'
                IS DISTINCT FROM admitted.document_hash
              OR supplied.excerpt->>'output_text_hash' IS DISTINCT FROM
                pg_catalog.encode(
                  extensions.digest(
                    pg_catalog.substring(
                      admitted.canonical_text_bytes,
                      supplied.absolute_start::integer + 1,
                      (
                        supplied.absolute_end - supplied.absolute_start
                      )::integer
                    ),
                    'sha256'::text
                  ),
                  'hex'
                )
              OR supplied.excerpt->>'exact_bytes_digest' IS DISTINCT FROM
                pg_catalog.encode(
                  extensions.digest(
                    pg_catalog.substring(
                      admitted.canonical_text_bytes,
                      supplied.absolute_start::integer + 1,
                      (
                        supplied.absolute_end - supplied.absolute_start
                      )::integer
                    ),
                    'sha256'::text
                  ),
                  'hex'
                )
              OR supplied.excerpt->>'exact_text' IS DISTINCT FROM
                pg_catalog.convert_from(
                  pg_catalog.substring(
                    admitted.canonical_text_bytes,
                    supplied.absolute_start::integer + 1,
                    (
                      supplied.absolute_end - supplied.absolute_start
                    )::integer
                  ),
                  'UTF8'
                )
              OR supplied.excerpt->>'excerpt_id' IS DISTINCT FROM
                canonical_v2_staging.content_id(
                  'EXCERPT/V1',
                  jsonb_build_object(
                    'excerpt_definition_key',
                      supplied.excerpt->'excerpt_definition_key',
                    'excerpt_definition_version',
                      supplied.excerpt->'excerpt_definition_version',
                    'excerpt_definition_payload_digest',
                      supplied.excerpt->'excerpt_definition_payload_digest',
                    'ordered_component_assignments',
                      supplied.excerpt->'ordered_component_assignments',
                    'excerpt_purpose', supplied.excerpt->'excerpt_purpose',
                    'transformation_or_redaction_version',
                      supplied.excerpt->'transformation_or_redaction_version',
                    'output_text_hash', supplied.excerpt->'output_text_hash'
                  )
                )
          END
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN excerpt identity or source bytes are invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH source_lineage AS (
        SELECT
          reference.value AS reference,
          immutable_source.canonical_payload AS immutable_payload,
          conversion.canonical_text_byte_length,
          canonical_v2_staging.content_id(
            'ADMITTED_SOURCE_OCCURRENCE_KEY/V1',
            jsonb_build_object(
              'deal_admission_id', reference.value->'deal_admission_id',
              'source_ordinal', reference.value->'source_ordinal',
              'immutable_source_document_id',
                reference.value->'immutable_source_document_id'
            )
          ) AS source_occurrence_key
        FROM jsonb_array_elements(p_write_set->'source_references') reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id = reference.value->>'canonical_text_id'
      ),
      admitted_occurrences AS (
        SELECT
          source_lineage.reference->>'canonical_text_id' AS canonical_text_id,
          source_lineage.immutable_payload->>'response_bytes_sha256' AS document_hash,
          source_lineage.canonical_text_byte_length,
          pg_catalog.convert_to(
            conversion.canonical_payload->>'canonical_text',
            'UTF8'
          ) AS canonical_text_bytes,
          canonical_v2_staging.content_id(
            'SOURCE_OCCURRENCE/V1',
            jsonb_build_object(
              'source_content_id',
                source_lineage.immutable_payload->'source_response_content_id',
              'source_occurrence_key', source_lineage.source_occurrence_key
            )
          ) AS source_occurrence_id
        FROM source_lineage
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id=
            source_lineage.reference->>'canonical_text_id'
      ),
      supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_instances stored
          ON persisted.reference->>'object_kind' = 'provisions'
          AND stored.provision_instance_id = persisted.reference->>'object_id'
      ),
      typed_provisions AS (
        SELECT
          supplied.provision,
          CASE
            WHEN jsonb_typeof(supplied.provision->'absolute_start') = 'number'
              AND supplied.provision->>'absolute_start' ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.provision->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(supplied.provision->'absolute_end') = 'number'
              AND supplied.provision->>'absolute_end' ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.provision->>'absolute_end')::bigint
          END AS absolute_end,
          CASE
            WHEN jsonb_typeof(supplied.provision->'ordinal') = 'number'
              AND supplied.provision->>'ordinal' ~ '^[1-9][0-9]{0,15}$'
            THEN (supplied.provision->>'ordinal')::bigint
          END AS governed_ordinal,
          (
            jsonb_typeof(supplied.provision) = 'object'
            AND supplied.provision ?& ARRAY[
              'schema_version', 'source_occurrence_id', 'canonical_text_id',
              'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
              'party', 'ordinal', 'source_anchor_id', 'provision_instance_id',
              'closure_id'
            ]
            AND supplied.provision - ARRAY[
              'schema_version', 'source_occurrence_id', 'canonical_text_id',
              'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
              'party', 'ordinal', 'source_anchor_id', 'provision_instance_id',
              'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.provision->>'schema_version' = 'PROVISION_INSTANCE/V1'
            AND jsonb_typeof(supplied.provision->'schema_version') = 'string'
            AND jsonb_typeof(supplied.provision->'source_occurrence_id') = 'string'
            AND jsonb_typeof(supplied.provision->'canonical_text_id') = 'string'
            AND jsonb_typeof(supplied.provision->'document_hash') = 'string'
            AND jsonb_typeof(supplied.provision->'concept_key') = 'string'
            AND jsonb_typeof(supplied.provision->'source_anchor_id') = 'string'
            AND jsonb_typeof(supplied.provision->'provision_instance_id') = 'string'
            AND jsonb_typeof(supplied.provision->'closure_id') = 'string'
            AND supplied.provision->>'source_occurrence_id' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'document_hash' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'source_anchor_id' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'provision_instance_id' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'closure_id' ~ '^[0-9a-f]{64}$'
            AND supplied.provision->>'concept_key'
              ~ '^[A-Z0-9][A-Z0-9_-]*$'
            AND jsonb_typeof(supplied.provision->'party') = 'object'
            AND supplied.provision->'party' ?& ARRAY['role', 'value', 'capacity']
            AND (supplied.provision->'party')
              - ARRAY['role', 'value', 'capacity']::text[] = '{}'::jsonb
            AND jsonb_typeof(supplied.provision->'party'->'role') = 'string'
            AND jsonb_typeof(supplied.provision->'party'->'value') = 'string'
            AND jsonb_typeof(supplied.provision->'party'->'capacity') = 'string'
            AND coalesce(length(supplied.provision->'party'->>'role'), 0) > 0
            AND coalesce(length(supplied.provision->'party'->>'value'), 0) > 0
            AND coalesce(length(supplied.provision->'party'->>'capacity'), 0) > 0
          ) AS shape_valid
        FROM supplied_provisions supplied
      )
      SELECT 1
      FROM typed_provisions supplied
      LEFT JOIN admitted_occurrences admitted
        ON admitted.canonical_text_id = supplied.provision->>'canonical_text_id'
        AND admitted.source_occurrence_id
          = supplied.provision->>'source_occurrence_id'
        AND admitted.document_hash = supplied.provision->>'document_hash'
      WHERE CASE
        WHEN supplied.shape_valid
          AND supplied.absolute_start IS NOT NULL
          AND supplied.absolute_end IS NOT NULL
          AND supplied.governed_ordinal IS NOT NULL
          AND supplied.governed_ordinal <= 9007199254740991
        THEN
          CASE
            WHEN admitted.canonical_text_id IS NULL THEN true
            WHEN supplied.absolute_start > supplied.absolute_end
              OR supplied.absolute_end > admitted.canonical_text_byte_length
            THEN true
            WHEN supplied.absolute_start < supplied.absolute_end
              AND (
                (
                  supplied.absolute_start < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_start::integer
                  ) BETWEEN 128 AND 191
                ) OR (
                  supplied.absolute_end < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_end::integer
                  ) BETWEEN 128 AND 191
                )
              )
            THEN true
            ELSE
              supplied.provision->>'source_anchor_id' IS DISTINCT FROM
                canonical_v2_staging.content_id(
                  'SEMANTIC_SPAN/V1',
                  jsonb_build_object(
                    'schema_version', 'SEMANTIC_SPAN/V1',
                    'canonical_text_id', supplied.provision->'canonical_text_id',
                    'absolute_start', supplied.provision->'absolute_start',
                    'absolute_end', supplied.provision->'absolute_end'
                  )
                )
              OR supplied.provision->>'provision_instance_id' IS DISTINCT FROM
                canonical_v2_staging.content_id(
                  'PROVISION_INSTANCE/V1',
                  jsonb_build_object(
                    'schema_version', supplied.provision->'schema_version',
                    'source_occurrence_id',
                      supplied.provision->'source_occurrence_id',
                    'canonical_text_id', supplied.provision->'canonical_text_id',
                    'document_hash', supplied.provision->'document_hash',
                    'absolute_start', supplied.provision->'absolute_start',
                    'absolute_end', supplied.provision->'absolute_end',
                    'concept_key', supplied.provision->'concept_key',
                    'party', supplied.provision->'party',
                    'ordinal', supplied.provision->'ordinal'
                  )
                )
          END
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN provision identity or source lineage is invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH admitted_sources AS (
        SELECT
          reference.value->>'canonical_text_id' AS canonical_text_id,
          conversion.canonical_text_byte_length,
          pg_catalog.convert_to(
            conversion.canonical_payload->>'canonical_text',
            'UTF8'
          ) AS canonical_text_bytes
        FROM jsonb_array_elements(p_write_set->'source_references') reference(value)
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id = reference.value->>'canonical_text_id'
      ),
      supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_instances stored
          ON persisted.reference->>'object_kind' = 'provisions'
          AND stored.provision_instance_id = persisted.reference->>'object_id'
      ),
      supplied_components AS (
        SELECT component.value AS component
        FROM jsonb_array_elements(p_write_set->'components') component(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_components stored
          ON persisted.reference->>'object_kind' = 'components'
          AND stored.provision_component_id = persisted.reference->>'object_id'
      ),
      typed_components AS (
        SELECT
          supplied.component,
          CASE
            WHEN jsonb_typeof(supplied.component->'absolute_start') = 'number'
              AND supplied.component->>'absolute_start' ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.component->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(supplied.component->'absolute_end') = 'number'
              AND supplied.component->>'absolute_end' ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.component->>'absolute_end')::bigint
          END AS absolute_end,
          CASE
            WHEN jsonb_typeof(supplied.component->'ordinal') = 'number'
              AND supplied.component->>'ordinal' ~ '^[1-9][0-9]{0,15}$'
            THEN (supplied.component->>'ordinal')::bigint
          END AS governed_ordinal,
          (
            jsonb_typeof(supplied.component) = 'object'
            AND supplied.component ?& ARRAY[
              'schema_version', 'parent_provision_instance_id', 'canonical_text_id',
              'absolute_start', 'absolute_end', 'component_key', 'ordinal',
              'source_anchor_id', 'provision_component_id', 'closure_id'
            ]
            AND supplied.component - ARRAY[
              'schema_version', 'parent_provision_instance_id', 'canonical_text_id',
              'absolute_start', 'absolute_end', 'component_key', 'ordinal',
              'source_anchor_id', 'provision_component_id', 'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.component->>'schema_version' = 'PROVISION_COMPONENT/V1'
            AND jsonb_typeof(supplied.component->'schema_version') = 'string'
            AND jsonb_typeof(
              supplied.component->'parent_provision_instance_id'
            ) = 'string'
            AND jsonb_typeof(supplied.component->'canonical_text_id') = 'string'
            AND jsonb_typeof(supplied.component->'component_key') = 'string'
            AND jsonb_typeof(supplied.component->'source_anchor_id') = 'string'
            AND jsonb_typeof(supplied.component->'provision_component_id') = 'string'
            AND jsonb_typeof(supplied.component->'closure_id') = 'string'
            AND supplied.component->>'parent_provision_instance_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.component->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND supplied.component->>'source_anchor_id' ~ '^[0-9a-f]{64}$'
            AND supplied.component->>'provision_component_id' ~ '^[0-9a-f]{64}$'
            AND supplied.component->>'closure_id' ~ '^[0-9a-f]{64}$'
            AND supplied.component->>'component_key'
              ~ '^[A-Z0-9][A-Z0-9_-]*$'
          ) AS shape_valid
        FROM supplied_components supplied
      )
      SELECT 1
      FROM typed_components supplied
      LEFT JOIN admitted_sources admitted
        ON admitted.canonical_text_id = supplied.component->>'canonical_text_id'
      LEFT JOIN supplied_provisions parent
        ON parent.provision->>'provision_instance_id'
          = supplied.component->>'parent_provision_instance_id'
      WHERE CASE
        WHEN supplied.shape_valid
          AND supplied.absolute_start IS NOT NULL
          AND supplied.absolute_end IS NOT NULL
          AND supplied.governed_ordinal IS NOT NULL
          AND supplied.governed_ordinal <= 9007199254740991
        THEN
          CASE
            WHEN admitted.canonical_text_id IS NULL
              OR parent.provision IS NULL
            THEN true
            WHEN supplied.absolute_start > supplied.absolute_end
              OR supplied.absolute_end > admitted.canonical_text_byte_length
            THEN true
            WHEN supplied.absolute_start < supplied.absolute_end
              AND (
                (
                  supplied.absolute_start < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_start::integer
                  ) BETWEEN 128 AND 191
                ) OR (
                  supplied.absolute_end < admitted.canonical_text_byte_length
                  AND get_byte(
                    admitted.canonical_text_bytes,
                    supplied.absolute_end::integer
                  ) BETWEEN 128 AND 191
                )
              )
            THEN true
            ELSE
              supplied.component->>'canonical_text_id' IS DISTINCT FROM
                parent.provision->>'canonical_text_id'
              OR supplied.absolute_start <
                CASE
                  WHEN parent.provision->>'absolute_start'
                    ~ '^(0|[1-9][0-9]{0,15})$'
                  THEN (parent.provision->>'absolute_start')::bigint
                END
              OR supplied.absolute_end >
                CASE
                  WHEN parent.provision->>'absolute_end'
                    ~ '^(0|[1-9][0-9]{0,15})$'
                  THEN (parent.provision->>'absolute_end')::bigint
                END
              OR supplied.component->>'source_anchor_id' IS DISTINCT FROM
                canonical_v2_staging.content_id(
                  'SEMANTIC_SPAN/V1',
                  jsonb_build_object(
                    'schema_version', 'SEMANTIC_SPAN/V1',
                    'canonical_text_id', supplied.component->'canonical_text_id',
                    'absolute_start', supplied.component->'absolute_start',
                    'absolute_end', supplied.component->'absolute_end'
                  )
                )
              OR supplied.component->>'provision_component_id' IS DISTINCT FROM
                canonical_v2_staging.content_id(
                  'PROVISION_COMPONENT/V1',
                  jsonb_build_object(
                    'schema_version', supplied.component->'schema_version',
                    'parent_provision_instance_id',
                      supplied.component->'parent_provision_instance_id',
                    'canonical_text_id', supplied.component->'canonical_text_id',
                    'absolute_start', supplied.component->'absolute_start',
                    'absolute_end', supplied.component->'absolute_end',
                    'component_key', supplied.component->'component_key',
                    'ordinal', supplied.component->'ordinal'
                  )
                )
          END
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN component identity or parent lineage is invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH source_lineage AS (
        SELECT
          reference.value AS reference,
          immutable_source.canonical_payload AS immutable_payload,
          canonical_v2_staging.content_id(
            'ADMITTED_SOURCE_OCCURRENCE_KEY/V1',
            jsonb_build_object(
              'deal_admission_id', reference.value->'deal_admission_id',
              'source_ordinal', reference.value->'source_ordinal',
              'immutable_source_document_id',
                reference.value->'immutable_source_document_id'
            )
          ) AS source_occurrence_key
        FROM jsonb_array_elements(p_write_set->'source_references')
          reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
      ),
      admitted_occurrences AS (
        SELECT
          source_lineage.reference->>'canonical_text_id' AS canonical_text_id,
          canonical_v2_staging.content_id(
            'SOURCE_OCCURRENCE/V1',
            jsonb_build_object(
              'source_content_id',
                source_lineage.immutable_payload->'source_response_content_id',
              'source_occurrence_key', source_lineage.source_occurrence_key
            )
          ) AS source_occurrence_id,
          CASE
            WHEN jsonb_typeof(source_lineage.reference->'source_ordinal')
              = 'number'
              AND source_lineage.reference->>'source_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (source_lineage.reference->>'source_ordinal')::bigint
          END AS source_ordinal
        FROM source_lineage
      ),
      supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_instances stored
          ON persisted.reference->>'object_kind' = 'provisions'
          AND stored.provision_instance_id = persisted.reference->>'object_id'
      ),
      supplied_components AS (
        SELECT component.value AS component
        FROM jsonb_array_elements(p_write_set->'components') component(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_components stored
          ON persisted.reference->>'object_kind' = 'components'
          AND stored.provision_component_id = persisted.reference->>'object_id'
      ),
      available_subjects AS (
        SELECT provision->>'provision_instance_id' AS occurrence_id
        FROM supplied_provisions
        UNION
        SELECT component->>'provision_component_id'
        FROM supplied_components
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.excerpts stored
          ON persisted.reference->>'object_kind' = 'excerpts'
          AND stored.excerpt_id = persisted.reference->>'object_id'
      ),
      available_excerpts AS (
        SELECT DISTINCT ON (excerpt->>'excerpt_id')
          excerpt->>'excerpt_id' AS excerpt_id,
          excerpt->>'canonical_text_id' AS canonical_text_id,
          excerpt->>'source_occurrence_id' AS source_occurrence_id,
          excerpt->'absolute_start' AS absolute_start,
          excerpt->'absolute_end' AS absolute_end
        FROM supplied_excerpts
        ORDER BY excerpt->>'excerpt_id'
      ),
      raw_claims AS (
        SELECT claim.value AS claim
        FROM jsonb_array_elements(p_write_set->'claims') claim(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.claim_revisions stored
          ON persisted.reference->>'object_kind' = 'claims'
          AND stored.claim_revision_id = persisted.reference->>'object_id'
      ),
      supplied_claims AS (
        SELECT
          row_number() OVER () AS claim_input_ordinal,
          raw_claims.claim
        FROM raw_claims
      ),
      typed_claims AS (
        SELECT
          supplied.claim_input_ordinal,
          supplied.claim,
          CASE
            WHEN jsonb_typeof(supplied.claim->'claim_definition_version')
              = 'number'
              AND supplied.claim->>'claim_definition_version'
                ~ '^[1-9][0-9]{0,15}$'
            THEN (supplied.claim->>'claim_definition_version')::bigint
          END AS claim_definition_version,
          CASE
            WHEN jsonb_typeof(supplied.claim->'ordinal') = 'number'
              AND supplied.claim->>'ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.claim->>'ordinal')::bigint
          END AS governed_ordinal,
          (
            jsonb_typeof(supplied.claim) = 'object'
            AND supplied.claim ?& ARRAY[
              'schema_version', 'claim_revision_id', 'claim_occurrence_id',
              'subject_occurrence_id', 'claim_definition_key',
              'claim_definition_version', 'ordinal', 'state', 'raw_value',
              'canonical_value', 'unit', 'day_basis', 'denominator', 'scope',
              'applicability', 'not_examined', 'failure', 'evidence_ids',
              'attributes', 'taxonomy_codes', 'extraction_version',
              'normalisation_version', 'derivation_version', 'evidence',
              'publication_state', 'retained_residuals', 'quarantine',
              'closure_id'
            ]
            AND supplied.claim - ARRAY[
              'schema_version', 'claim_revision_id', 'claim_occurrence_id',
              'subject_occurrence_id', 'claim_definition_key',
              'claim_definition_version', 'ordinal', 'state', 'raw_value',
              'canonical_value', 'unit', 'day_basis', 'denominator', 'scope',
              'applicability', 'not_examined', 'failure', 'evidence_ids',
              'attributes', 'taxonomy_codes', 'extraction_version',
              'normalisation_version', 'derivation_version', 'evidence',
              'publication_state', 'retained_residuals', 'quarantine',
              'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.claim->>'schema_version' = 'CLAIM_REVISION/V1'
            AND jsonb_typeof(supplied.claim->'claim_revision_id') = 'string'
            AND jsonb_typeof(supplied.claim->'claim_occurrence_id') = 'string'
            AND jsonb_typeof(supplied.claim->'subject_occurrence_id') = 'string'
            AND jsonb_typeof(supplied.claim->'claim_definition_key') = 'string'
            AND jsonb_typeof(supplied.claim->'state') = 'string'
            AND jsonb_typeof(supplied.claim->'evidence_ids') = 'array'
            AND jsonb_typeof(supplied.claim->'attributes') = 'object'
            AND jsonb_typeof(supplied.claim->'taxonomy_codes') = 'object'
            AND jsonb_typeof(supplied.claim->'extraction_version') = 'string'
            AND jsonb_typeof(
              supplied.claim->'normalisation_version'
            ) = 'string'
            AND jsonb_typeof(supplied.claim->'derivation_version') = 'string'
            AND jsonb_typeof(supplied.claim->'evidence') = 'array'
            AND jsonb_typeof(supplied.claim->'publication_state') = 'string'
            AND jsonb_typeof(supplied.claim->'retained_residuals') = 'array'
            AND jsonb_typeof(supplied.claim->'closure_id') = 'string'
            AND supplied.claim->>'claim_revision_id' ~ '^[0-9a-f]{64}$'
            AND supplied.claim->>'claim_occurrence_id' ~ '^[0-9a-f]{64}$'
            AND supplied.claim->>'subject_occurrence_id' ~ '^[0-9a-f]{64}$'
            AND supplied.claim->>'claim_definition_key'
              ~ '^[A-Z0-9][A-Z0-9_-]*$'
            AND supplied.claim->>'closure_id' ~ '^[0-9a-f]{64}$'
            AND supplied.claim->>'state' IN (
              'PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'
            )
            AND supplied.claim->>'publication_state' = 'VALIDATED'
            AND supplied.claim->'retained_residuals' = '[]'::jsonb
            AND supplied.claim->'quarantine' = 'null'::jsonb
            AND length(supplied.claim->>'extraction_version') > 0
            AND length(supplied.claim->>'normalisation_version') > 0
            AND length(supplied.claim->>'derivation_version') > 0
            AND jsonb_array_length(
              CASE
                WHEN jsonb_typeof(supplied.claim->'evidence') = 'array'
                THEN supplied.claim->'evidence'
                ELSE '[]'::jsonb
              END
            ) <= 4096
            AND jsonb_array_length(
              CASE
                WHEN jsonb_typeof(supplied.claim->'evidence_ids') = 'array'
                THEN supplied.claim->'evidence_ids'
                ELSE '[]'::jsonb
              END
            ) <= 4096
          ) AS shape_valid
        FROM supplied_claims supplied
      ),
      raw_claim_evidence AS (
        SELECT
          claim.claim_input_ordinal,
          evidence.value AS edge,
          evidence.ordinality - 1 AS edge_array_ordinal
        FROM typed_claims claim
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(claim.claim->'evidence') = 'array'
            THEN CASE
              WHEN jsonb_array_length(claim.claim->'evidence') <= 4096
              THEN claim.claim->'evidence'
              ELSE '[]'::jsonb
            END
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY evidence(value, ordinality)
      ),
      typed_claim_evidence AS (
        SELECT
          evidence.claim_input_ordinal,
          evidence.edge,
          evidence.edge_array_ordinal,
          CASE
            WHEN jsonb_typeof(evidence.edge->'document_ordinal') = 'number'
              AND evidence.edge->>'document_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'document_ordinal')::bigint
          END AS document_ordinal,
          CASE
            WHEN jsonb_typeof(evidence.edge->'absolute_start') = 'number'
              AND evidence.edge->>'absolute_start'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(evidence.edge->'absolute_end') = 'number'
              AND evidence.edge->>'absolute_end'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'absolute_end')::bigint
          END AS absolute_end,
          CASE
            WHEN jsonb_typeof(evidence.edge->'ordinal') = 'number'
              AND evidence.edge->>'ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'ordinal')::bigint
          END AS governed_ordinal,
          CASE evidence.edge->>'evidence_role'
            WHEN 'CROSS_REFERENCE' THEN 0
            WHEN 'DEFINITION' THEN 1
            WHEN 'DERIVATION_INPUT' THEN 2
            WHEN 'EXCEPTION' THEN 3
            WHEN 'OPERATIVE_TEXT' THEN 4
          END AS evidence_role_rank,
          (
            jsonb_typeof(evidence.edge) = 'object'
            AND evidence.edge ?& ARRAY[
              'schema_version', 'claim_evidence_id', 'evidence_role',
              'excerpt_id', 'document_ordinal', 'absolute_start',
              'absolute_end', 'ordinal'
            ]
            AND evidence.edge - ARRAY[
              'schema_version', 'claim_evidence_id', 'evidence_role',
              'excerpt_id', 'document_ordinal', 'absolute_start',
              'absolute_end', 'ordinal'
            ]::text[] = '{}'::jsonb
            AND evidence.edge->>'schema_version' = 'CLAIM_EVIDENCE/V1'
            AND jsonb_typeof(evidence.edge->'claim_evidence_id') = 'string'
            AND jsonb_typeof(evidence.edge->'evidence_role') = 'string'
            AND jsonb_typeof(evidence.edge->'excerpt_id') = 'string'
            AND evidence.edge->>'claim_evidence_id' ~ '^[0-9a-f]{64}$'
            AND evidence.edge->>'excerpt_id' ~ '^[0-9a-f]{64}$'
            AND evidence.edge->>'evidence_role' IN (
              'OPERATIVE_TEXT', 'DEFINITION', 'EXCEPTION',
              'CROSS_REFERENCE', 'DERIVATION_INPUT'
            )
          ) AS shape_valid
        FROM raw_claim_evidence evidence
      ),
      resolved_claim_evidence AS (
        SELECT
          evidence.*,
          excerpt.excerpt_id AS resolved_excerpt_id,
          excerpt.absolute_start AS excerpt_absolute_start,
          excerpt.absolute_end AS excerpt_absolute_end,
          admitted.source_ordinal AS admitted_source_ordinal,
          canonical_v2_staging.content_id(
            'CLAIM_EVIDENCE/V1',
            jsonb_build_object(
              'occurrence_id', claim.claim->'claim_occurrence_id',
              'evidence_role', evidence.edge->'evidence_role',
              'excerpt_id', evidence.edge->'excerpt_id',
              'ordinal', to_jsonb(evidence.edge_array_ordinal)
            )
          ) AS expected_evidence_id
        FROM typed_claim_evidence evidence
        JOIN typed_claims claim
          ON claim.claim_input_ordinal = evidence.claim_input_ordinal
        LEFT JOIN available_excerpts excerpt
          ON excerpt.excerpt_id = evidence.edge->>'excerpt_id'
        LEFT JOIN admitted_occurrences admitted
          ON admitted.canonical_text_id = excerpt.canonical_text_id
          AND admitted.source_occurrence_id = excerpt.source_occurrence_id
      )
      SELECT 1
      FROM typed_claims claim
      LEFT JOIN available_subjects subject
        ON subject.occurrence_id = claim.claim->>'subject_occurrence_id'
      WHERE CASE
        WHEN claim.shape_valid
          AND claim.claim_definition_version IS NOT NULL
          AND claim.claim_definition_version <= 9007199254740991
          AND claim.governed_ordinal IS NOT NULL
          AND claim.governed_ordinal <= 9007199254740991
        THEN
          subject.occurrence_id IS NULL
          OR claim.claim->>'claim_occurrence_id' IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'CLAIM_OCCURRENCE/V1',
              jsonb_build_object(
                'subject_occurrence_id',
                  claim.claim->'subject_occurrence_id',
                'claim_definition_key',
                  claim.claim->'claim_definition_key',
                'claim_definition_version',
                  claim.claim->'claim_definition_version',
                'ordinal', claim.claim->'ordinal'
              )
            )
          OR claim.claim->>'claim_revision_id' IS DISTINCT FROM
            canonical_v2_staging.content_id(
              'CLAIM_REVISION/V1',
              jsonb_build_object(
                'claim_occurrence_id', claim.claim->'claim_occurrence_id',
                'subject_occurrence_id',
                  claim.claim->'subject_occurrence_id',
                'claim_definition_key',
                  claim.claim->'claim_definition_key',
                'claim_definition_version',
                  claim.claim->'claim_definition_version',
                'ordinal', claim.claim->'ordinal',
                'state', claim.claim->'state',
                'raw_value', claim.claim->'raw_value',
                'canonical_value', claim.claim->'canonical_value',
                'unit', claim.claim->'unit',
                'day_basis', claim.claim->'day_basis',
                'denominator', claim.claim->'denominator',
                'scope', claim.claim->'scope',
                'applicability', claim.claim->'applicability',
                'not_examined', claim.claim->'not_examined',
                'failure', claim.claim->'failure',
                'evidence_ids', claim.claim->'evidence_ids',
                'attributes', claim.claim->'attributes',
                'taxonomy_codes', claim.claim->'taxonomy_codes',
                'extraction_version', claim.claim->'extraction_version',
                'normalisation_version',
                  claim.claim->'normalisation_version',
                'derivation_version', claim.claim->'derivation_version'
              )
            )
          OR EXISTS (
            SELECT 1
            FROM resolved_claim_evidence evidence
            WHERE evidence.claim_input_ordinal = claim.claim_input_ordinal
              AND (
                NOT evidence.shape_valid
                OR evidence.document_ordinal IS NULL
                OR evidence.document_ordinal > 9007199254740991
                OR evidence.absolute_start IS NULL
                OR evidence.absolute_start > 9007199254740991
                OR evidence.absolute_end IS NULL
                OR evidence.absolute_end > 9007199254740991
                OR evidence.absolute_end <= evidence.absolute_start
                OR evidence.governed_ordinal IS NULL
                OR evidence.governed_ordinal > 9007199254740991
                OR evidence.governed_ordinal
                  <> evidence.edge_array_ordinal
                OR evidence.resolved_excerpt_id IS NULL
                OR evidence.admitted_source_ordinal IS NULL
                OR evidence.document_ordinal
                  <> evidence.admitted_source_ordinal
                OR evidence.edge->'absolute_start'
                  IS DISTINCT FROM evidence.excerpt_absolute_start
                OR evidence.edge->'absolute_end'
                  IS DISTINCT FROM evidence.excerpt_absolute_end
                OR evidence.edge->>'claim_evidence_id'
                  IS DISTINCT FROM evidence.expected_evidence_id
              )
          )
          OR claim.claim->'evidence_ids' IS DISTINCT FROM (
            SELECT coalesce(
              jsonb_agg(
                to_jsonb(evidence.expected_evidence_id)
                ORDER BY evidence.edge_array_ordinal
              ),
              '[]'::jsonb
            )
            FROM resolved_claim_evidence evidence
            WHERE evidence.claim_input_ordinal = claim.claim_input_ordinal
          )
          OR claim.claim->'evidence' IS DISTINCT FROM (
            SELECT coalesce(
              jsonb_agg(
                evidence.edge
                ORDER BY
                  evidence.document_ordinal,
                  evidence.absolute_start,
                  evidence.absolute_end,
                  evidence.evidence_role_rank,
                  evidence.edge->>'excerpt_id' COLLATE "C",
                  evidence.edge_array_ordinal
              ),
              '[]'::jsonb
            )
            FROM resolved_claim_evidence evidence
            WHERE evidence.claim_input_ordinal = claim.claim_input_ordinal
          )
          OR (
            claim.claim->>'state' = 'PRESENT'
            AND jsonb_array_length(claim.claim->'evidence') = 0
          )
          OR (
            claim.claim->>'state' <> 'PRESENT'
            AND (
              claim.claim->'raw_value' <> 'null'::jsonb
              OR claim.claim->'canonical_value' <> 'null'::jsonb
              OR claim.claim->'unit' <> 'null'::jsonb
              OR claim.claim->'day_basis' <> 'null'::jsonb
              OR claim.claim->'denominator' <> 'null'::jsonb
            )
          )
          OR (
            claim.claim->>'state' = 'ABSENT'
            AND (
              jsonb_typeof(claim.claim->'scope') <> 'object'
              OR coalesce(
                claim.claim->'scope'->>'coverage_status' <> 'COMPLETE',
                true
              )
              OR coalesce(
                claim.claim->'scope'->>'scope_closure_id'
                  !~ '^[0-9a-f]{64}$',
                true
              )
              OR jsonb_typeof(
                claim.claim->'scope'->'required_interval_ids'
              ) <> 'array'
              OR jsonb_typeof(
                claim.claim->'scope'->'examined_interval_ids'
              ) <> 'array'
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'scope'->'required_interval_ids'
                  ) = 'array'
                  THEN claim.claim->'scope'->'required_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'scope'->'examined_interval_ids'
                  ) = 'array'
                  THEN claim.claim->'scope'->'examined_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'scope'->'required_interval_ids'
                  ) = 'array'
                  THEN claim.claim->'scope'->'required_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) = 0
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'scope'->'required_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'scope'->'required_interval_ids'
                      ) <= 4096
                      THEN claim.claim->'scope'->'required_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) required(value)
                WHERE jsonb_typeof(required.value) <> 'string'
                  OR required.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'scope'->'examined_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'scope'->'examined_interval_ids'
                      ) <= 4096
                      THEN claim.claim->'scope'->'examined_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) examined(value)
                WHERE jsonb_typeof(examined.value) <> 'string'
                  OR examined.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
              OR (
                SELECT coalesce(
                  jsonb_agg(required.value ORDER BY required.value #>> '{}'),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'scope'->'required_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'scope'->'required_interval_ids'
                      ) <= 4096
                      THEN claim.claim->'scope'->'required_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) required(value)
              ) IS DISTINCT FROM (
                SELECT coalesce(
                  jsonb_agg(examined.value ORDER BY examined.value #>> '{}'),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'scope'->'examined_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'scope'->'examined_interval_ids'
                      ) <= 4096
                      THEN claim.claim->'scope'->'examined_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) examined(value)
              )
            )
          )
          OR (
            claim.claim->>'state' = 'NOT_APPLICABLE'
            AND (
              jsonb_typeof(claim.claim->'applicability') <> 'object'
              OR jsonb_typeof(
                claim.claim->'applicability'->'rule'
              ) <> 'string'
              OR coalesce(
                length(claim.claim->'applicability'->>'rule'),
                0
              ) = 0
              OR jsonb_typeof(
                claim.claim->'applicability'->'source_fact_ids'
              ) <> 'array'
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'applicability'->'source_fact_ids'
                  ) = 'array'
                  THEN claim.claim->'applicability'->'source_fact_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'applicability'->'source_fact_ids'
                  ) = 'array'
                  THEN claim.claim->'applicability'->'source_fact_ids'
                  ELSE '[]'::jsonb
                END
              ) = 0
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'applicability'->'source_fact_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'applicability'->'source_fact_ids'
                      ) <= 4096
                      THEN claim.claim->'applicability'->'source_fact_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) fact(value)
                WHERE jsonb_typeof(fact.value) <> 'string'
                  OR fact.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
            )
          )
          OR (
            claim.claim->>'state' = 'NOT_EXAMINED'
            AND (
              jsonb_typeof(claim.claim->'not_examined') <> 'object'
              OR jsonb_typeof(
                claim.claim->'not_examined'->'reason'
              ) <> 'string'
              OR coalesce(
                length(claim.claim->'not_examined'->>'reason'),
                0
              ) = 0
              OR NOT (claim.claim->'not_examined' ? 'intended_scope')
              OR claim.claim->'not_examined'->'intended_scope' = 'null'::jsonb
            )
          )
          OR (
            claim.claim->>'state' = 'FAILED'
            AND (
              jsonb_typeof(claim.claim->'failure') <> 'object'
              OR jsonb_typeof(
                claim.claim->'failure'->'failure_code'
              ) <> 'string'
              OR coalesce(
                length(claim.claim->'failure'->>'failure_code'),
                0
              ) = 0
              OR jsonb_typeof(
                claim.claim->'failure'->'attempted_extractor'
              ) <> 'string'
              OR coalesce(
                length(claim.claim->'failure'->>'attempted_extractor'),
                0
              ) = 0
            )
          )
          OR (
            claim.claim->'denominator' <> 'null'::jsonb
            AND (
              jsonb_typeof(claim.claim->'denominator') <> 'object'
              OR jsonb_typeof(
                claim.claim->'denominator'->'source_lineage_ids'
              ) <> 'array'
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'denominator'->'source_lineage_ids'
                  ) = 'array'
                  THEN claim.claim->'denominator'->'source_lineage_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    claim.claim->'denominator'->'source_lineage_ids'
                  ) = 'array'
                  THEN claim.claim->'denominator'->'source_lineage_ids'
                  ELSE '[]'::jsonb
                END
              ) = 0
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      claim.claim->'denominator'->'source_lineage_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        claim.claim->'denominator'->'source_lineage_ids'
                      ) <= 4096
                      THEN claim.claim->'denominator'->'source_lineage_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) lineage(value)
                WHERE jsonb_typeof(lineage.value) <> 'string'
                  OR lineage.value #>> '{}' !~ '^[0-9a-f]{64}$'
                  OR NOT EXISTS (
                    SELECT 1
                    FROM resolved_claim_evidence evidence
                    WHERE evidence.claim_input_ordinal
                      = claim.claim_input_ordinal
                      AND evidence.edge->>'evidence_role'
                        = 'DERIVATION_INPUT'
                      AND evidence.edge->>'excerpt_id'
                        = lineage.value #>> '{}'
                  )
              )
            )
          )
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN claim identity, state or evidence lineage is invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH source_lineage AS (
        SELECT
          reference.value AS reference,
          immutable_source.canonical_payload AS immutable_payload,
          canonical_v2_staging.content_id(
            'ADMITTED_SOURCE_OCCURRENCE_KEY/V1',
            jsonb_build_object(
              'deal_admission_id', reference.value->'deal_admission_id',
              'source_ordinal', reference.value->'source_ordinal',
              'immutable_source_document_id',
                reference.value->'immutable_source_document_id'
            )
          ) AS source_occurrence_key
        FROM jsonb_array_elements(p_write_set->'source_references')
          reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
      ),
      admitted_occurrences AS (
        SELECT
          source_lineage.reference->>'canonical_text_id' AS canonical_text_id,
          canonical_v2_staging.content_id(
            'SOURCE_OCCURRENCE/V1',
            jsonb_build_object(
              'source_content_id',
                source_lineage.immutable_payload->'source_response_content_id',
              'source_occurrence_key', source_lineage.source_occurrence_key
            )
          ) AS source_occurrence_id,
          CASE
            WHEN jsonb_typeof(source_lineage.reference->'source_ordinal')
              = 'number'
              AND source_lineage.reference->>'source_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (source_lineage.reference->>'source_ordinal')::bigint
          END AS source_ordinal
        FROM source_lineage
      ),
      supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_instances stored
          ON persisted.reference->>'object_kind' = 'provisions'
          AND stored.provision_instance_id = persisted.reference->>'object_id'
      ),
      supplied_components AS (
        SELECT component.value AS component
        FROM jsonb_array_elements(p_write_set->'components') component(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_components stored
          ON persisted.reference->>'object_kind' = 'components'
          AND stored.provision_component_id = persisted.reference->>'object_id'
      ),
      available_occurrences AS (
        SELECT provision->>'provision_instance_id' AS occurrence_id
        FROM supplied_provisions
        UNION
        SELECT component->>'provision_component_id'
        FROM supplied_components
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.excerpts stored
          ON persisted.reference->>'object_kind' = 'excerpts'
          AND stored.excerpt_id = persisted.reference->>'object_id'
      ),
      available_excerpts AS (
        SELECT DISTINCT ON (excerpt->>'excerpt_id')
          excerpt->>'excerpt_id' AS excerpt_id,
          excerpt->>'canonical_text_id' AS canonical_text_id,
          excerpt->>'source_occurrence_id' AS source_occurrence_id,
          excerpt->'absolute_start' AS absolute_start,
          excerpt->'absolute_end' AS absolute_end
        FROM supplied_excerpts
        ORDER BY excerpt->>'excerpt_id'
      ),
      raw_relationships AS (
        SELECT relationship.value AS relationship
        FROM jsonb_array_elements(p_write_set->'relationships')
          relationship(value)
        UNION ALL
        SELECT stored.canonical_payload
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.relationship_revisions stored
          ON persisted.reference->>'object_kind' = 'relationships'
          AND stored.relationship_revision_id
            = persisted.reference->>'object_id'
      ),
      supplied_relationships AS (
        SELECT
          row_number() OVER () AS relationship_input_ordinal,
          raw_relationships.relationship
        FROM raw_relationships
      ),
      typed_relationships AS (
        SELECT
          supplied.relationship_input_ordinal,
          supplied.relationship,
          CASE
            WHEN jsonb_typeof(
              supplied.relationship->'relationship_definition_version'
            ) = 'number'
              AND supplied.relationship->>'relationship_definition_version'
                ~ '^[1-9][0-9]{0,15}$'
            THEN (
              supplied.relationship->>'relationship_definition_version'
            )::bigint
          END AS relationship_definition_version,
          CASE
            WHEN jsonb_typeof(supplied.relationship->'ordinal') = 'number'
              AND supplied.relationship->>'ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (supplied.relationship->>'ordinal')::bigint
          END AS governed_ordinal,
          (
            jsonb_typeof(supplied.relationship) = 'object'
            AND supplied.relationship ?& ARRAY[
              'schema_version', 'relationship_revision_id',
              'relationship_occurrence_id', 'source_occurrence_id',
              'relationship_definition_key',
              'relationship_definition_version', 'ordinal', 'state',
              'raw_scope', 'scope', 'applicability', 'not_examined',
              'failure', 'target_occurrence_ids', 'effect', 'evidence_ids',
              'attributes', 'taxonomy_codes', 'resolver_version', 'evidence',
              'publication_state', 'retained_residuals', 'quarantine',
              'closure_id'
            ]
            AND supplied.relationship - ARRAY[
              'schema_version', 'relationship_revision_id',
              'relationship_occurrence_id', 'source_occurrence_id',
              'relationship_definition_key',
              'relationship_definition_version', 'ordinal', 'state',
              'raw_scope', 'scope', 'applicability', 'not_examined',
              'failure', 'target_occurrence_ids', 'effect', 'evidence_ids',
              'attributes', 'taxonomy_codes', 'resolver_version', 'evidence',
              'publication_state', 'retained_residuals', 'quarantine',
              'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.relationship->>'schema_version'
              = 'RELATIONSHIP_REVISION/V1'
            AND jsonb_typeof(
              supplied.relationship->'relationship_revision_id'
            ) = 'string'
            AND jsonb_typeof(
              supplied.relationship->'relationship_occurrence_id'
            ) = 'string'
            AND jsonb_typeof(
              supplied.relationship->'source_occurrence_id'
            ) = 'string'
            AND jsonb_typeof(
              supplied.relationship->'relationship_definition_key'
            ) = 'string'
            AND jsonb_typeof(supplied.relationship->'state') = 'string'
            AND jsonb_typeof(
              supplied.relationship->'target_occurrence_ids'
            ) = 'array'
            AND jsonb_typeof(
              supplied.relationship->'evidence_ids'
            ) = 'array'
            AND jsonb_typeof(supplied.relationship->'attributes') = 'object'
            AND jsonb_typeof(
              supplied.relationship->'taxonomy_codes'
            ) = 'object'
            AND jsonb_typeof(
              supplied.relationship->'resolver_version'
            ) = 'string'
            AND jsonb_typeof(supplied.relationship->'evidence') = 'array'
            AND jsonb_typeof(
              supplied.relationship->'publication_state'
            ) = 'string'
            AND jsonb_typeof(
              supplied.relationship->'retained_residuals'
            ) = 'array'
            AND jsonb_typeof(supplied.relationship->'closure_id') = 'string'
            AND supplied.relationship->>'relationship_revision_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.relationship->>'relationship_occurrence_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.relationship->>'source_occurrence_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.relationship->>'relationship_definition_key'
              ~ '^[A-Z0-9][A-Z0-9_-]*$'
            AND supplied.relationship->>'closure_id' ~ '^[0-9a-f]{64}$'
            AND supplied.relationship->>'state' IN (
              'PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED'
            )
            AND supplied.relationship->>'publication_state' = 'VALIDATED'
            AND supplied.relationship->'retained_residuals' = '[]'::jsonb
            AND supplied.relationship->'quarantine' = 'null'::jsonb
            AND length(supplied.relationship->>'resolver_version') > 0
            AND jsonb_array_length(
              CASE
                WHEN jsonb_typeof(supplied.relationship->'evidence') = 'array'
                THEN supplied.relationship->'evidence'
                ELSE '[]'::jsonb
              END
            ) <= 4096
            AND jsonb_array_length(
              CASE
                WHEN jsonb_typeof(
                  supplied.relationship->'evidence_ids'
                ) = 'array'
                THEN supplied.relationship->'evidence_ids'
                ELSE '[]'::jsonb
              END
            ) <= 4096
            AND jsonb_array_length(
              CASE
                WHEN jsonb_typeof(
                  supplied.relationship->'target_occurrence_ids'
                ) = 'array'
                THEN supplied.relationship->'target_occurrence_ids'
                ELSE '[]'::jsonb
              END
            ) <= 4096
          ) AS shape_valid
        FROM supplied_relationships supplied
      ),
      raw_relationship_targets AS (
        SELECT
          relationship.relationship_input_ordinal,
          target.value AS target,
          target.ordinality - 1 AS target_array_ordinal
        FROM typed_relationships relationship
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(
              relationship.relationship->'target_occurrence_ids'
            ) = 'array'
            THEN CASE
              WHEN jsonb_array_length(
                relationship.relationship->'target_occurrence_ids'
              ) <= 4096
              THEN relationship.relationship->'target_occurrence_ids'
              ELSE '[]'::jsonb
            END
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY target(value, ordinality)
      ),
      resolved_relationship_targets AS (
        SELECT
          target.*,
          occurrence.occurrence_id AS resolved_occurrence_id
        FROM raw_relationship_targets target
        LEFT JOIN available_occurrences occurrence
          ON occurrence.occurrence_id = target.target #>> '{}'
      ),
      raw_relationship_evidence AS (
        SELECT
          relationship.relationship_input_ordinal,
          evidence.value AS edge,
          evidence.ordinality - 1 AS edge_array_ordinal
        FROM typed_relationships relationship
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(relationship.relationship->'evidence') = 'array'
            THEN CASE
              WHEN jsonb_array_length(
                relationship.relationship->'evidence'
              ) <= 4096
              THEN relationship.relationship->'evidence'
              ELSE '[]'::jsonb
            END
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY evidence(value, ordinality)
      ),
      typed_relationship_evidence AS (
        SELECT
          evidence.relationship_input_ordinal,
          evidence.edge,
          evidence.edge_array_ordinal,
          CASE
            WHEN jsonb_typeof(evidence.edge->'document_ordinal') = 'number'
              AND evidence.edge->>'document_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'document_ordinal')::bigint
          END AS document_ordinal,
          CASE
            WHEN jsonb_typeof(evidence.edge->'absolute_start') = 'number'
              AND evidence.edge->>'absolute_start'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(evidence.edge->'absolute_end') = 'number'
              AND evidence.edge->>'absolute_end'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'absolute_end')::bigint
          END AS absolute_end,
          CASE
            WHEN jsonb_typeof(evidence.edge->'ordinal') = 'number'
              AND evidence.edge->>'ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (evidence.edge->>'ordinal')::bigint
          END AS governed_ordinal,
          CASE evidence.edge->>'evidence_role'
            WHEN 'CROSS_REFERENCE' THEN 0
            WHEN 'DEFINITION' THEN 1
            WHEN 'DERIVATION_INPUT' THEN 2
            WHEN 'EXCEPTION' THEN 3
            WHEN 'OPERATIVE_TEXT' THEN 4
          END AS evidence_role_rank,
          (
            jsonb_typeof(evidence.edge) = 'object'
            AND evidence.edge ?& ARRAY[
              'schema_version', 'relationship_evidence_id', 'evidence_role',
              'excerpt_id', 'document_ordinal', 'absolute_start',
              'absolute_end', 'ordinal'
            ]
            AND evidence.edge - ARRAY[
              'schema_version', 'relationship_evidence_id', 'evidence_role',
              'excerpt_id', 'document_ordinal', 'absolute_start',
              'absolute_end', 'ordinal'
            ]::text[] = '{}'::jsonb
            AND evidence.edge->>'schema_version'
              = 'RELATIONSHIP_EVIDENCE/V1'
            AND jsonb_typeof(
              evidence.edge->'relationship_evidence_id'
            ) = 'string'
            AND jsonb_typeof(evidence.edge->'evidence_role') = 'string'
            AND jsonb_typeof(evidence.edge->'excerpt_id') = 'string'
            AND evidence.edge->>'relationship_evidence_id'
              ~ '^[0-9a-f]{64}$'
            AND evidence.edge->>'excerpt_id' ~ '^[0-9a-f]{64}$'
            AND evidence.edge->>'evidence_role' IN (
              'OPERATIVE_TEXT', 'DEFINITION', 'EXCEPTION',
              'CROSS_REFERENCE', 'DERIVATION_INPUT'
            )
          ) AS shape_valid
        FROM raw_relationship_evidence evidence
      ),
      resolved_relationship_evidence AS (
        SELECT
          evidence.*,
          excerpt.excerpt_id AS resolved_excerpt_id,
          excerpt.absolute_start AS excerpt_absolute_start,
          excerpt.absolute_end AS excerpt_absolute_end,
          admitted.source_ordinal AS admitted_source_ordinal,
          canonical_v2_staging.content_id(
            'RELATIONSHIP_EVIDENCE/V1',
            jsonb_build_object(
              'occurrence_id',
                relationship.relationship->'relationship_occurrence_id',
              'evidence_role', evidence.edge->'evidence_role',
              'excerpt_id', evidence.edge->'excerpt_id',
              'ordinal', to_jsonb(evidence.edge_array_ordinal)
            )
          ) AS expected_evidence_id
        FROM typed_relationship_evidence evidence
        JOIN typed_relationships relationship
          ON relationship.relationship_input_ordinal
            = evidence.relationship_input_ordinal
        LEFT JOIN available_excerpts excerpt
          ON excerpt.excerpt_id = evidence.edge->>'excerpt_id'
        LEFT JOIN admitted_occurrences admitted
          ON admitted.canonical_text_id = excerpt.canonical_text_id
          AND admitted.source_occurrence_id = excerpt.source_occurrence_id
      )
      SELECT 1
      FROM typed_relationships relationship
      LEFT JOIN available_occurrences source
        ON source.occurrence_id
          = relationship.relationship->>'source_occurrence_id'
      WHERE CASE
        WHEN relationship.shape_valid
          AND relationship.relationship_definition_version IS NOT NULL
          AND relationship.relationship_definition_version
            <= 9007199254740991
          AND relationship.governed_ordinal IS NOT NULL
          AND relationship.governed_ordinal <= 9007199254740991
        THEN
          source.occurrence_id IS NULL
          OR relationship.relationship->>'relationship_occurrence_id'
            IS DISTINCT FROM canonical_v2_staging.content_id(
              'RELATIONSHIP_OCCURRENCE/V1',
              jsonb_build_object(
                'source_occurrence_id',
                  relationship.relationship->'source_occurrence_id',
                'relationship_definition_key',
                  relationship.relationship->'relationship_definition_key',
                'relationship_definition_version',
                  relationship.relationship
                    ->'relationship_definition_version',
                'ordinal', relationship.relationship->'ordinal'
              )
            )
          OR relationship.relationship->>'relationship_revision_id'
            IS DISTINCT FROM canonical_v2_staging.content_id(
              'RELATIONSHIP_REVISION/V1',
              jsonb_build_object(
                'relationship_occurrence_id',
                  relationship.relationship->'relationship_occurrence_id',
                'source_occurrence_id',
                  relationship.relationship->'source_occurrence_id',
                'relationship_definition_key',
                  relationship.relationship->'relationship_definition_key',
                'relationship_definition_version',
                  relationship.relationship
                    ->'relationship_definition_version',
                'ordinal', relationship.relationship->'ordinal',
                'state', relationship.relationship->'state',
                'raw_scope', relationship.relationship->'raw_scope',
                'scope', relationship.relationship->'scope',
                'applicability', relationship.relationship->'applicability',
                'not_examined', relationship.relationship->'not_examined',
                'failure', relationship.relationship->'failure',
                'target_occurrence_ids',
                  relationship.relationship->'target_occurrence_ids',
                'effect', relationship.relationship->'effect',
                'evidence_ids', relationship.relationship->'evidence_ids',
                'attributes', relationship.relationship->'attributes',
                'taxonomy_codes', relationship.relationship->'taxonomy_codes',
                'resolver_version',
                  relationship.relationship->'resolver_version'
              )
            )
          OR EXISTS (
            SELECT 1
            FROM resolved_relationship_targets target
            WHERE target.relationship_input_ordinal
              = relationship.relationship_input_ordinal
              AND (
                jsonb_typeof(target.target) <> 'string'
                OR target.target #>> '{}' !~ '^[0-9a-f]{64}$'
                OR target.resolved_occurrence_id IS NULL
              )
          )
          OR EXISTS (
            SELECT 1
            FROM resolved_relationship_evidence evidence
            WHERE evidence.relationship_input_ordinal
              = relationship.relationship_input_ordinal
              AND (
                NOT evidence.shape_valid
                OR evidence.document_ordinal IS NULL
                OR evidence.document_ordinal > 9007199254740991
                OR evidence.absolute_start IS NULL
                OR evidence.absolute_start > 9007199254740991
                OR evidence.absolute_end IS NULL
                OR evidence.absolute_end > 9007199254740991
                OR evidence.absolute_end <= evidence.absolute_start
                OR evidence.governed_ordinal IS NULL
                OR evidence.governed_ordinal > 9007199254740991
                OR evidence.governed_ordinal
                  <> evidence.edge_array_ordinal
                OR evidence.resolved_excerpt_id IS NULL
                OR evidence.admitted_source_ordinal IS NULL
                OR evidence.document_ordinal
                  <> evidence.admitted_source_ordinal
                OR evidence.edge->'absolute_start'
                  IS DISTINCT FROM evidence.excerpt_absolute_start
                OR evidence.edge->'absolute_end'
                  IS DISTINCT FROM evidence.excerpt_absolute_end
                OR evidence.edge->>'relationship_evidence_id'
                  IS DISTINCT FROM evidence.expected_evidence_id
              )
          )
          OR relationship.relationship->'evidence_ids' IS DISTINCT FROM (
            SELECT coalesce(
              jsonb_agg(
                to_jsonb(evidence.expected_evidence_id)
                ORDER BY evidence.edge_array_ordinal
              ),
              '[]'::jsonb
            )
            FROM resolved_relationship_evidence evidence
            WHERE evidence.relationship_input_ordinal
              = relationship.relationship_input_ordinal
          )
          OR relationship.relationship->'evidence' IS DISTINCT FROM (
            SELECT coalesce(
              jsonb_agg(
                evidence.edge
                ORDER BY
                  evidence.document_ordinal,
                  evidence.absolute_start,
                  evidence.absolute_end,
                  evidence.evidence_role_rank,
                  evidence.edge->>'excerpt_id' COLLATE "C",
                  evidence.edge_array_ordinal
              ),
              '[]'::jsonb
            )
            FROM resolved_relationship_evidence evidence
            WHERE evidence.relationship_input_ordinal
              = relationship.relationship_input_ordinal
          )
          OR (
            relationship.relationship->>'state' = 'PRESENT'
            AND (
              jsonb_array_length(
                relationship.relationship->'evidence'
              ) = 0
              OR jsonb_array_length(
                relationship.relationship->'target_occurrence_ids'
              ) = 0
              OR jsonb_typeof(
                relationship.relationship->'effect'
              ) IS DISTINCT FROM 'object'
              OR coalesce(
                relationship.relationship->'effect'->>'effect_mode'
                  NOT IN ('NON_SEMANTIC', 'TYPED_LEGAL_EFFECT'),
                true
              )
              OR jsonb_typeof(
                relationship.relationship->'effect'->'legal_operation'
              ) IS DISTINCT FROM 'string'
              OR length(
                relationship.relationship->'effect'->>'legal_operation'
              ) = 0
            )
          )
          OR (
            relationship.relationship->>'state' <> 'PRESENT'
            AND (
              relationship.relationship->'target_occurrence_ids'
                <> '[]'::jsonb
              OR relationship.relationship->'effect' <> 'null'::jsonb
            )
          )
          OR (
            relationship.relationship->>'state' = 'ABSENT'
            AND (
              jsonb_typeof(relationship.relationship->'scope') <> 'object'
              OR coalesce(
                relationship.relationship->'scope'->>'coverage_status'
                  <> 'COMPLETE',
                true
              )
              OR coalesce(
                relationship.relationship->'scope'->>'scope_closure_id'
                  !~ '^[0-9a-f]{64}$',
                true
              )
              OR jsonb_typeof(
                relationship.relationship
                  ->'scope'->'required_interval_ids'
              ) <> 'array'
              OR jsonb_typeof(
                relationship.relationship
                  ->'scope'->'examined_interval_ids'
              ) <> 'array'
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    relationship.relationship
                      ->'scope'->'required_interval_ids'
                  ) = 'array'
                  THEN relationship.relationship
                    ->'scope'->'required_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    relationship.relationship
                      ->'scope'->'examined_interval_ids'
                  ) = 'array'
                  THEN relationship.relationship
                    ->'scope'->'examined_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    relationship.relationship
                      ->'scope'->'required_interval_ids'
                  ) = 'array'
                  THEN relationship.relationship
                    ->'scope'->'required_interval_ids'
                  ELSE '[]'::jsonb
                END
              ) = 0
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      relationship.relationship
                        ->'scope'->'required_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        relationship.relationship
                          ->'scope'->'required_interval_ids'
                      ) <= 4096
                      THEN relationship.relationship
                        ->'scope'->'required_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) required(value)
                WHERE jsonb_typeof(required.value) <> 'string'
                  OR required.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      relationship.relationship
                        ->'scope'->'examined_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        relationship.relationship
                          ->'scope'->'examined_interval_ids'
                      ) <= 4096
                      THEN relationship.relationship
                        ->'scope'->'examined_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) examined(value)
                WHERE jsonb_typeof(examined.value) <> 'string'
                  OR examined.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
              OR (
                SELECT coalesce(
                  jsonb_agg(required.value ORDER BY required.value #>> '{}'),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      relationship.relationship
                        ->'scope'->'required_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        relationship.relationship
                          ->'scope'->'required_interval_ids'
                      ) <= 4096
                      THEN relationship.relationship
                        ->'scope'->'required_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) required(value)
              ) IS DISTINCT FROM (
                SELECT coalesce(
                  jsonb_agg(examined.value ORDER BY examined.value #>> '{}'),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      relationship.relationship
                        ->'scope'->'examined_interval_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        relationship.relationship
                          ->'scope'->'examined_interval_ids'
                      ) <= 4096
                      THEN relationship.relationship
                        ->'scope'->'examined_interval_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) examined(value)
              )
            )
          )
          OR (
            relationship.relationship->>'state' = 'NOT_APPLICABLE'
            AND (
              jsonb_typeof(
                relationship.relationship->'applicability'
              ) <> 'object'
              OR jsonb_typeof(
                relationship.relationship->'applicability'->'rule'
              ) <> 'string'
              OR coalesce(
                length(
                  relationship.relationship->'applicability'->>'rule'
                ),
                0
              ) = 0
              OR jsonb_typeof(
                relationship.relationship
                  ->'applicability'->'source_fact_ids'
              ) <> 'array'
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    relationship.relationship
                      ->'applicability'->'source_fact_ids'
                  ) = 'array'
                  THEN relationship.relationship
                    ->'applicability'->'source_fact_ids'
                  ELSE '[]'::jsonb
                END
              ) > 4096
              OR jsonb_array_length(
                CASE
                  WHEN jsonb_typeof(
                    relationship.relationship
                      ->'applicability'->'source_fact_ids'
                  ) = 'array'
                  THEN relationship.relationship
                    ->'applicability'->'source_fact_ids'
                  ELSE '[]'::jsonb
                END
              ) = 0
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements(
                  CASE
                    WHEN jsonb_typeof(
                      relationship.relationship
                        ->'applicability'->'source_fact_ids'
                    ) = 'array'
                    THEN CASE
                      WHEN jsonb_array_length(
                        relationship.relationship
                          ->'applicability'->'source_fact_ids'
                      ) <= 4096
                      THEN relationship.relationship
                        ->'applicability'->'source_fact_ids'
                      ELSE '[]'::jsonb
                    END
                    ELSE '[]'::jsonb
                  END
                ) fact(value)
                WHERE jsonb_typeof(fact.value) <> 'string'
                  OR fact.value #>> '{}' !~ '^[0-9a-f]{64}$'
              )
            )
          )
          OR (
            relationship.relationship->>'state' = 'NOT_EXAMINED'
            AND (
              jsonb_typeof(
                relationship.relationship->'not_examined'
              ) <> 'object'
              OR jsonb_typeof(
                relationship.relationship->'not_examined'->'reason'
              ) <> 'string'
              OR coalesce(
                length(
                  relationship.relationship->'not_examined'->>'reason'
                ),
                0
              ) = 0
              OR NOT (
                relationship.relationship->'not_examined' ? 'intended_scope'
              )
              OR relationship.relationship
                ->'not_examined'->'intended_scope' = 'null'::jsonb
            )
          )
          OR (
            relationship.relationship->>'state' = 'FAILED'
            AND (
              jsonb_typeof(relationship.relationship->'failure') <> 'object'
              OR jsonb_typeof(
                relationship.relationship->'failure'->'failure_code'
              ) <> 'string'
              OR coalesce(
                length(
                  relationship.relationship->'failure'->>'failure_code'
                ),
                0
              ) = 0
              OR jsonb_typeof(
                relationship.relationship->'failure'->'attempted_extractor'
              ) <> 'string'
              OR coalesce(
                length(
                  relationship.relationship
                    ->'failure'->>'attempted_extractor'
                ),
                0
              ) = 0
            )
          )
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN relationship identity, endpoints, state or evidence lineage is invalid'
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
    AND current_head.contract_fingerprint = p_contract_fingerprint
  FOR SHARE OF current_head;

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
    AND current_head.contract_fingerprint = p_contract_fingerprint
  FOR SHARE OF current_head;

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
REVOKE ALL ON FUNCTION canonical_v2_staging.canonical_json(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.content_id(text, jsonb)
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
