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
  SELECT encode(digest(convert_to(value::text, 'UTF8'), 'sha256'), 'hex')
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

CREATE TABLE IF NOT EXISTS canonical_v2_staging.write_receipts (
  operation text NOT NULL CHECK (operation = 'FIXTURE_DEAL_EXTRACTION_RUN'),
  idempotency_key text NOT NULL,
  input_digest text NOT NULL,
  receipt_id text NOT NULL UNIQUE,
  canonical_payload jsonb NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canonical_v2_excerpts_closure_idx
  ON canonical_v2_staging.excerpts(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_provisions_closure_idx
  ON canonical_v2_staging.provision_instances(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_components_closure_idx
  ON canonical_v2_staging.provision_components(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_claims_closure_idx
  ON canonical_v2_staging.claim_revisions(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_relationships_closure_idx
  ON canonical_v2_staging.relationship_revisions(closure_id);
CREATE INDEX IF NOT EXISTS canonical_v2_residuals_closure_idx
  ON canonical_v2_staging.residuals(closure_id);
CREATE UNIQUE INDEX IF NOT EXISTS canonical_v2_quarantines_closure_unique
  ON canonical_v2_staging.quarantines(closure_id);

ALTER TABLE canonical_v2_staging.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.immutable_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.source_admission_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.excerpts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.provision_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.provision_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.claim_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.relationship_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.residuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.quarantines ENABLE ROW LEVEL SECURITY;
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
  item jsonb;
  item_id text;
  existing_digest text;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_write is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_operation IS DISTINCT FROM 'FIXTURE_DEAL_EXTRACTION_RUN' THEN
    RAISE EXCEPTION 'unsupported canonical operation' USING ERRCODE = '22023';
  END IF;
  IF coalesce(length(trim(p_idempotency_key)), 0) = 0 OR coalesce(length(trim(p_input_digest)), 0) = 0 THEN
    RAISE EXCEPTION 'idempotency key and input digest are required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_operation || E'\u0000' || p_idempotency_key, 0));
  SELECT * INTO existing_receipt
  FROM canonical_v2_staging.write_receipts
  WHERE operation = p_operation AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF existing_receipt.input_digest IS DISTINCT FROM p_input_digest THEN
      RAISE EXCEPTION 'idempotency key already names different canonical input' USING ERRCODE = '23505';
    END IF;
    RETURN existing_receipt.canonical_payload || jsonb_build_object('replayed', true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      coalesce(p_write_set->'excerpts', '[]'::jsonb)
      || coalesce(p_write_set->'provisions', '[]'::jsonb)
      || coalesce(p_write_set->'components', '[]'::jsonb)
      || coalesce(p_write_set->'claims', '[]'::jsonb)
      || coalesce(p_write_set->'relationships', '[]'::jsonb)
    ) AS publishable(item)
    JOIN canonical_v2_staging.quarantines quarantine
      ON quarantine.closure_id = publishable.item->>'closure_id'
  ) THEN
    RAISE EXCEPTION 'quarantined semantic closure cannot publish under the same identity'
      USING ERRCODE = '23514';
  END IF;

  item := p_write_set->'source';
  item_id := item->>'immutable_source_document_id';
  SELECT canonical_payload_digest INTO existing_digest
  FROM canonical_v2_staging.immutable_source_documents
  WHERE immutable_source_document_id = item_id;
  IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical immutable source identity conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.immutable_source_documents(immutable_source_document_id, canonical_payload)
  VALUES (item_id, item) ON CONFLICT (immutable_source_document_id) DO NOTHING;

  item := p_write_set->'source_admission';
  item_id := item->>'source_admission_manifest_id';
  SELECT canonical_payload_digest INTO existing_digest
  FROM canonical_v2_staging.source_admission_manifests
  WHERE source_admission_manifest_id = item_id;
  IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical source admission identity conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.source_admission_manifests(source_admission_manifest_id, canonical_payload)
  VALUES (item_id, item) ON CONFLICT (source_admission_manifest_id) DO NOTHING;

  item := p_write_set->'deal';
  item_id := item->>'deal_key';
  SELECT canonical_payload_digest INTO existing_digest FROM canonical_v2_staging.deals WHERE deal_key = item_id;
  IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
    RAISE EXCEPTION 'canonical deal identity conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO canonical_v2_staging.deals(deal_key, canonical_payload)
  VALUES (item_id, item) ON CONFLICT (deal_key) DO NOTHING;

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

REVOKE ALL ON SCHEMA canonical_v2_staging FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA canonical_v2_staging
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA canonical_v2_staging
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_write(text, text, text, text, jsonb, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA canonical_v2_staging TO canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_write(text, text, text, text, jsonb, jsonb, jsonb, jsonb)
  TO canonical_v2_writer;
