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

ALTER TABLE canonical_v2_staging.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.immutable_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.source_admission_manifests ENABLE ROW LEVEL SECURITY;
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

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      coalesce(p_write_set->'excerpts', '[]'::jsonb)
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
