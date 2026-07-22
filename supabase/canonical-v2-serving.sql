-- Additive, staging-only serving projection. This file is not a production migration.

CREATE SCHEMA IF NOT EXISTS canonical_v2_staging;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canonical_v2_serving') THEN
    CREATE ROLE canonical_v2_serving NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canonical_v2_writer') THEN
    CREATE ROLE canonical_v2_writer NOLOGIN;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS canonical_v2_staging.fixture_corpus_releases (
  corpus_release_id text PRIMARY KEY CHECK (corpus_release_id ~ '^[a-f0-9]{64}$'),
  candidate_manifest_id text NOT NULL UNIQUE CHECK (candidate_manifest_id ~ '^[a-f0-9]{64}$'),
  frozen_pair_root_id text NOT NULL CHECK (frozen_pair_root_id ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  projection_version text NOT NULL CHECK (projection_version = 'canonical-v2-serving/v1'),
  response_schema_version text NOT NULL CHECK (response_schema_version = 'MARKET_COHORT_RESULT/V1'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.market_observations (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  metric_observation_occurrence_id text NOT NULL CHECK (metric_observation_occurrence_id ~ '^[a-f0-9]{64}$'),
  market_observation_serving_key text NOT NULL CHECK (market_observation_serving_key ~ '^[a-f0-9]{64}$'),
  metric_slot_key text NOT NULL CHECK (metric_slot_key ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  deal_admission_id text NOT NULL CHECK (deal_admission_id ~ '^[a-f0-9]{64}$'),
  concept_key text NOT NULL,
  metric_key text NOT NULL,
  metric_version integer NOT NULL CHECK (metric_version > 0),
  party_role text NOT NULL,
  party_value text NOT NULL,
  party_capacity text NOT NULL,
  result_key text NOT NULL,
  result_version integer NOT NULL CHECK (result_version > 0),
  owner_type text NOT NULL CHECK (owner_type IN ('CLAIM_OCCURRENCE', 'RESULT_COMPONENT_OCCURRENCE')),
  owner_occurrence_id text NOT NULL CHECK (owner_occurrence_id ~ '^[a-f0-9]{64}$'),
  owner_revision_id text NOT NULL CHECK (owner_revision_id ~ '^[a-f0-9]{64}$'),
  scope_type text NOT NULL,
  scope_id text NOT NULL CHECK (scope_id ~ '^[a-f0-9]{64}$'),
  value_slot_key text NOT NULL,
  governed_ordinal integer NOT NULL CHECK (governed_ordinal >= 0),
  claim_state text NOT NULL CHECK (claim_state IN ('PRESENT', 'ABSENT')),
  raw_value jsonb,
  canonical_value jsonb,
  value_dimension text NOT NULL,
  canonical_unit text NOT NULL,
  basis_key text NOT NULL,
  eligibility_state text NOT NULL CHECK (eligibility_state = 'ELIGIBLE'),
  applicability_state text NOT NULL CHECK (applicability_state = 'APPLICABLE'),
  examination_state text NOT NULL CHECK (examination_state = 'EXAMINED'),
  comparability_state text NOT NULL CHECK (comparability_state = 'COMPARABLE'),
  sector text,
  buyer text,
  merger_form text,
  adviser_firms text[] NOT NULL DEFAULT '{}',
  lawyers text[] NOT NULL DEFAULT '{}',
  announce_year integer CHECK (announce_year IS NULL OR announce_year BETWEEN 1900 AND 2200),
  deal_value_usd numeric CHECK (deal_value_usd IS NULL OR deal_value_usd >= 0),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, metric_observation_occurrence_id),
  UNIQUE (serving_namespace_id, corpus_release_id, market_observation_serving_key),
  UNIQUE (serving_namespace_id, corpus_release_id, metric_slot_key)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.market_metric_slot_exclusions (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  exclusion_serving_key text NOT NULL CHECK (exclusion_serving_key ~ '^[a-f0-9]{64}$'),
  metric_slot_key text NOT NULL CHECK (metric_slot_key ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  deal_admission_id text NOT NULL CHECK (deal_admission_id ~ '^[a-f0-9]{64}$'),
  concept_key text NOT NULL,
  metric_key text NOT NULL,
  metric_version integer NOT NULL CHECK (metric_version > 0),
  party_role text NOT NULL,
  party_value text NOT NULL,
  party_capacity text NOT NULL,
  basis_key text NOT NULL,
  claim_state text NOT NULL CHECK (claim_state IN ('PRESENT', 'ABSENT', 'NOT_APPLICABLE', 'NOT_EXAMINED', 'FAILED')),
  eligibility_state text NOT NULL CHECK (eligibility_state IN ('ELIGIBLE', 'INELIGIBLE')),
  applicability_state text NOT NULL CHECK (applicability_state IN ('APPLICABLE', 'NOT_APPLICABLE')),
  examination_state text NOT NULL CHECK (examination_state IN ('EXAMINED', 'NOT_EXAMINED', 'FAILED')),
  comparability_state text NOT NULL CHECK (comparability_state IN ('COMPARABLE', 'NOT_CERTIFIED', 'NOT_COMPARABLE')),
  exclusion_reason text NOT NULL,
  sector text,
  buyer text,
  merger_form text,
  adviser_firms text[] NOT NULL DEFAULT '{}',
  lawyers text[] NOT NULL DEFAULT '{}',
  announce_year integer CHECK (announce_year IS NULL OR announce_year BETWEEN 1900 AND 2200),
  deal_value_usd numeric CHECK (deal_value_usd IS NULL OR deal_value_usd >= 0),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, metric_slot_key),
  UNIQUE (serving_namespace_id, corpus_release_id, exclusion_serving_key)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.shared_serving_rows (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  row_serving_key text NOT NULL CHECK (row_serving_key ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  concept_key text NOT NULL,
  metric_key text NOT NULL,
  metric_version integer NOT NULL CHECK (metric_version > 0),
  party_role text NOT NULL,
  party_value text NOT NULL,
  party_capacity text NOT NULL,
  basis_key text NOT NULL,
  sector text,
  buyer text,
  merger_form text,
  adviser_firms text[] NOT NULL DEFAULT '{}',
  lawyers text[] NOT NULL DEFAULT '{}',
  announce_year integer CHECK (announce_year IS NULL OR announce_year BETWEEN 1900 AND 2200),
  deal_value_usd numeric CHECK (deal_value_usd IS NULL OR deal_value_usd >= 0),
  canonical_numeric_value numeric CHECK (canonical_numeric_value IS NULL OR canonical_numeric_value >= 0),
  fee_side text,
  payer_capacity text,
  payee_capacity text,
  trigger_codes text[] NOT NULL DEFAULT '{}',
  criterion_code text,
  contract_scope_code text,
  cash_flow_direction_code text,
  measurement_period_code text,
  comparison_operator text,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, row_serving_key)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.reviewed_source_specific_serving_rows (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  reviewed_source_specific_serving_key text NOT NULL CHECK (reviewed_source_specific_serving_key ~ '^[a-f0-9]{64}$'),
  row_serving_key text NOT NULL CHECK (row_serving_key ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  open_world_candidate_occurrence_id text NOT NULL CHECK (open_world_candidate_occurrence_id ~ '^[a-f0-9]{64}$'),
  final_disposition_id text NOT NULL CHECK (final_disposition_id ~ '^[a-f0-9]{64}$'),
  disposition_code text NOT NULL CHECK (disposition_code = 'REVIEWED_SOURCE_SPECIFIC'),
  market_cohort_eligible boolean NOT NULL CHECK (market_cohort_eligible = false),
  aggregate_authority text NOT NULL CHECK (aggregate_authority = 'NO_AGGREGATE_AUTHORITY'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, row_serving_key),
  UNIQUE (serving_namespace_id, corpus_release_id, reviewed_source_specific_serving_key),
  UNIQUE (serving_namespace_id, corpus_release_id, open_world_candidate_occurrence_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.exact_detail_serving_packages (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  row_serving_key text NOT NULL CHECK (row_serving_key ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  source_detail_reference_ids text[] NOT NULL,
  exact_detail_package_digest text NOT NULL CHECK (exact_detail_package_digest ~ '^[a-f0-9]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, row_serving_key),
  UNIQUE (serving_namespace_id, corpus_release_id, exact_detail_package_digest)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_release_import_receipts (
  candidate_manifest_id text PRIMARY KEY CHECK (candidate_manifest_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL UNIQUE REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  candidate_release_import_plan_id text NOT NULL UNIQUE CHECK (candidate_release_import_plan_id ~ '^[a-f0-9]{64}$'),
  import_state text NOT NULL CHECK (import_state = 'IMPORTED_COMPLETE'),
  expected_counts jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE INDEX IF NOT EXISTS canonical_v2_market_observation_cohort_idx
  ON canonical_v2_staging.market_observations (
    serving_namespace_id,
    corpus_release_id,
    concept_key,
    metric_key,
    metric_version,
    party_role,
    party_value,
    party_capacity,
    basis_key,
    governed_deal_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_market_exclusion_cohort_idx
  ON canonical_v2_staging.market_metric_slot_exclusions (
    serving_namespace_id,
    corpus_release_id,
    concept_key,
    metric_key,
    metric_version,
    party_role,
    party_value,
    party_capacity,
    basis_key,
    governed_deal_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_market_observation_advisers_idx
  ON canonical_v2_staging.market_observations USING gin (adviser_firms);
CREATE INDEX IF NOT EXISTS canonical_v2_market_observation_lawyers_idx
  ON canonical_v2_staging.market_observations USING gin (lawyers);
CREATE INDEX IF NOT EXISTS canonical_v2_market_exclusion_advisers_idx
  ON canonical_v2_staging.market_metric_slot_exclusions USING gin (adviser_firms);
CREATE INDEX IF NOT EXISTS canonical_v2_market_exclusion_lawyers_idx
  ON canonical_v2_staging.market_metric_slot_exclusions USING gin (lawyers);
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_query_idx
  ON canonical_v2_staging.shared_serving_rows (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    concept_key,
    metric_key,
    metric_version,
    party_role,
    party_value,
    party_capacity,
    basis_key,
    governed_deal_key,
    row_serving_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_numeric_idx
  ON canonical_v2_staging.shared_serving_rows (
    serving_namespace_id,
    corpus_release_id,
    metric_key,
    canonical_numeric_value,
    governed_deal_key,
    row_serving_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_attributes_idx
  ON canonical_v2_staging.shared_serving_rows (
    serving_namespace_id,
    corpus_release_id,
    metric_key,
    fee_side,
    payer_capacity,
    payee_capacity,
    criterion_code,
    contract_scope_code,
    cash_flow_direction_code,
    measurement_period_code,
    comparison_operator
  );
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_advisers_idx
  ON canonical_v2_staging.shared_serving_rows USING gin (adviser_firms);
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_lawyers_idx
  ON canonical_v2_staging.shared_serving_rows USING gin (lawyers);
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_triggers_idx
  ON canonical_v2_staging.shared_serving_rows USING gin (trigger_codes);
CREATE INDEX IF NOT EXISTS canonical_v2_reviewed_source_specific_deal_idx
  ON canonical_v2_staging.reviewed_source_specific_serving_rows (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    governed_deal_key,
    row_serving_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_exact_detail_deal_idx
  ON canonical_v2_staging.exact_detail_serving_packages (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    governed_deal_key,
    row_serving_key
  );
CREATE INDEX IF NOT EXISTS canonical_v2_exact_detail_reference_idx
  ON canonical_v2_staging.exact_detail_serving_packages USING gin (source_detail_reference_ids);

CREATE OR REPLACE FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.serving_namespace_id || E'\u0000' || NEW.corpus_release_id || E'\u0000' || NEW.metric_slot_key,
    0
  ));
  IF TG_TABLE_NAME = 'market_observations' AND EXISTS (
    SELECT 1 FROM canonical_v2_staging.market_metric_slot_exclusions exclusion
    WHERE exclusion.serving_namespace_id = NEW.serving_namespace_id
      AND exclusion.corpus_release_id = NEW.corpus_release_id
      AND exclusion.metric_slot_key = NEW.metric_slot_key
  ) THEN
    RAISE EXCEPTION 'market metric slot already has an exclusion' USING ERRCODE = '23505';
  END IF;
  IF TG_TABLE_NAME = 'market_metric_slot_exclusions' AND EXISTS (
    SELECT 1 FROM canonical_v2_staging.market_observations observation
    WHERE observation.serving_namespace_id = NEW.serving_namespace_id
      AND observation.corpus_release_id = NEW.corpus_release_id
      AND observation.metric_slot_key = NEW.metric_slot_key
  ) THEN
    RAISE EXCEPTION 'market metric slot already has an observation' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS canonical_v2_market_observation_partition_guard
  ON canonical_v2_staging.market_observations;
CREATE TRIGGER canonical_v2_market_observation_partition_guard
BEFORE INSERT OR UPDATE OF serving_namespace_id, corpus_release_id, metric_slot_key
ON canonical_v2_staging.market_observations
FOR EACH ROW EXECUTE FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition();

DROP TRIGGER IF EXISTS canonical_v2_market_exclusion_partition_guard
  ON canonical_v2_staging.market_metric_slot_exclusions;
CREATE TRIGGER canonical_v2_market_exclusion_partition_guard
BEFORE INSERT OR UPDATE OF serving_namespace_id, corpus_release_id, metric_slot_key
ON canonical_v2_staging.market_metric_slot_exclusions
FOR EACH ROW EXECUTE FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition();

ALTER TABLE canonical_v2_staging.fixture_corpus_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_metric_slot_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.shared_serving_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.reviewed_source_specific_serving_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.exact_detail_serving_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_release_import_receipts ENABLE ROW LEVEL SECURITY;

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
  release_id text := release_record->>'corpus_release_id';
  namespace_id text := release_record->'canonical_payload'->>'serving_namespace_id';
  contract_id text := release_record->>'contract_fingerprint';
  manifest_id text := release_record->>'candidate_manifest_id';
  import_plan_id text := p_import_plan->>'candidate_release_import_plan_id';
  existing_plan_id text;
  imported_at_value timestamptz;
BEGIN
  IF current_setting('app.canonical_v2_environment', true) IS DISTINCT FROM 'staging'
    OR p_environment IS DISTINCT FROM 'staging'
    OR p_import_plan->>'environment' IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_import_candidate_release is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_import_plan->>'schema_version' IS DISTINCT FROM 'CANDIDATE_RELEASE_IMPORT_PLAN/V1'
    OR jsonb_typeof(release_record) IS DISTINCT FROM 'object'
    OR jsonb_typeof(expected) IS DISTINCT FROM 'object'
    OR release_id !~ '^[a-f0-9]{64}$'
    OR namespace_id !~ '^[a-f0-9]{64}$'
    OR contract_id !~ '^[a-f0-9]{64}$'
    OR manifest_id !~ '^[a-f0-9]{64}$'
    OR import_plan_id !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid candidate release import plan' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(manifest_id, 0));

  SELECT receipt.candidate_release_import_plan_id, receipt.imported_at
  INTO existing_plan_id, imported_at_value
  FROM canonical_v2_staging.candidate_release_import_receipts receipt
  WHERE receipt.candidate_manifest_id = manifest_id;
  IF existing_plan_id IS NOT NULL THEN
    IF existing_plan_id IS DISTINCT FROM import_plan_id THEN
      RAISE EXCEPTION 'candidate manifest already imported under different content' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object(
      'schema_version', 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V1',
      'import_state', 'IMPORTED_COMPLETE',
      'replayed', true,
      'candidate_manifest_id', manifest_id,
      'corpus_release_id', release_id,
      'serving_namespace_id', namespace_id,
      'candidate_release_import_plan_id', import_plan_id,
      'expected_counts', expected,
      'imported_at', imported_at_value
    );
  END IF;

  IF jsonb_typeof(p_import_plan->'market_observations') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'market_exclusions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'query_records') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'source_specific_records') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_import_plan->'exact_detail_packages') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_import_plan->'market_observations')
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR jsonb_array_length(p_import_plan->'market_exclusions')
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR jsonb_array_length(p_import_plan->'query_records')
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR jsonb_array_length(p_import_plan->'source_specific_records')
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR jsonb_array_length(p_import_plan->'exact_detail_packages')
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer THEN
    RAISE EXCEPTION 'candidate release import counts do not match the plan' USING ERRCODE = '22023';
  END IF;
  IF (expected->>'market_observations')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'observations')::integer
    OR (expected->>'market_exclusions')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'exclusions')::integer
    OR (expected->>'query_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'query_records')::integer
    OR (expected->>'source_specific_records')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'source_specific_serving_records')::integer
    OR (expected->>'exact_detail_packages')::integer
      IS DISTINCT FROM (release_record->'canonical_payload'->'counts'->>'exact_detail_packages')::integer THEN
    RAISE EXCEPTION 'candidate release import counts do not match the certified manifest' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT value FROM jsonb_array_elements(p_import_plan->'market_observations')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'market_exclusions')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'query_records')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'source_specific_records')
      UNION ALL SELECT value FROM jsonb_array_elements(p_import_plan->'exact_detail_packages')
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
  IF (SELECT count(DISTINCT item->>'metric_slot_key') FROM jsonb_array_elements(p_import_plan->'market_observations') item)
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR (SELECT count(DISTINCT item->>'metric_slot_key') FROM jsonb_array_elements(p_import_plan->'market_exclusions') item)
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'query_records') item)
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'source_specific_records') item)
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR (SELECT count(DISTINCT item->>'row_serving_key') FROM jsonb_array_elements(p_import_plan->'exact_detail_packages') item)
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer THEN
    RAISE EXCEPTION 'candidate release import contains duplicate identities' USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1 FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = release_id
      AND release.canonical_payload_digest IS DISTINCT FROM release_record->>'canonical_payload_digest'
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
  ) THEN
    RAISE EXCEPTION 'candidate release import identity conflicts with different content' USING ERRCODE = '23505';
  END IF;

  INSERT INTO canonical_v2_staging.fixture_corpus_releases
  SELECT * FROM jsonb_populate_record(NULL::canonical_v2_staging.fixture_corpus_releases, release_record)
  ON CONFLICT (corpus_release_id) DO NOTHING;
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

  IF (SELECT count(*) FROM canonical_v2_staging.market_observations row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.market_metric_slot_exclusions row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.shared_serving_rows row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.reviewed_source_specific_serving_rows row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR (SELECT count(*) FROM canonical_v2_staging.exact_detail_serving_packages row
      WHERE row.serving_namespace_id = namespace_id AND row.corpus_release_id = release_id)
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer THEN
    RAISE EXCEPTION 'candidate release import did not close over every certified serving object' USING ERRCODE = '23514';
  END IF;

  INSERT INTO canonical_v2_staging.candidate_release_import_receipts(
    candidate_manifest_id,
    corpus_release_id,
    serving_namespace_id,
    candidate_release_import_plan_id,
    import_state,
    expected_counts
  ) VALUES (
    manifest_id,
    release_id,
    namespace_id,
    import_plan_id,
    'IMPORTED_COMPLETE',
    expected
  )
  RETURNING imported_at INTO imported_at_value;

  RETURN jsonb_build_object(
    'schema_version', 'CANDIDATE_RELEASE_IMPORT_RECEIPT/V1',
    'import_state', 'IMPORTED_COMPLETE',
    'replayed', false,
    'candidate_manifest_id', manifest_id,
    'corpus_release_id', release_id,
    'serving_namespace_id', namespace_id,
    'candidate_release_import_plan_id', import_plan_id,
    'expected_counts', expected,
    'imported_at', imported_at_value
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_market_cohort(
  p_environment text,
  p_serving_namespace_id text,
  p_corpus_release_id text,
  p_contract_fingerprint text,
  p_cohort_digest text,
  p_metric_key text,
  p_metric_version integer,
  p_concept_key text,
  p_party_role text,
  p_party_value text,
  p_party_capacity text,
  p_basis_key text,
  p_subject_deal_key text DEFAULT NULL,
  p_sector text DEFAULT NULL,
  p_buyer text DEFAULT NULL,
  p_merger_form text DEFAULT NULL,
  p_adviser_either text DEFAULT NULL,
  p_lawyer_either text DEFAULT NULL,
  p_year_from integer DEFAULT NULL,
  p_year_to integer DEFAULT NULL,
  p_min_value_usd numeric DEFAULT NULL,
  p_max_value_usd numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '2500ms'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF current_setting('app.canonical_v2_environment', true) IS DISTINCT FROM 'staging'
    OR p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_market_cohort is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_serving_namespace_id !~ '^[a-f0-9]{64}$'
    OR p_corpus_release_id !~ '^[a-f0-9]{64}$'
    OR p_contract_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_cohort_digest !~ '^[a-f0-9]{64}$'
    OR coalesce(length(trim(p_metric_key)), 0) = 0
    OR p_metric_version < 1
    OR coalesce(length(trim(p_concept_key)), 0) = 0
    OR coalesce(length(trim(p_party_role)), 0) = 0
    OR coalesce(length(trim(p_party_value)), 0) = 0
    OR coalesce(length(trim(p_party_capacity)), 0) = 0
    OR coalesce(length(trim(p_basis_key)), 0) = 0 THEN
    RAISE EXCEPTION 'invalid canonical market cohort request' USING ERRCODE = '22023';
  END IF;
  IF p_year_from IS NOT NULL AND p_year_to IS NOT NULL AND p_year_from > p_year_to THEN
    RAISE EXCEPTION 'invalid year range' USING ERRCODE = '22023';
  END IF;
  IF p_min_value_usd IS NOT NULL AND p_max_value_usd IS NOT NULL AND p_min_value_usd > p_max_value_usd THEN
    RAISE EXCEPTION 'invalid value range' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = p_corpus_release_id
      AND release.contract_fingerprint = p_contract_fingerprint
  ) THEN
    RAISE EXCEPTION 'unknown fixture corpus release' USING ERRCODE = '22023';
  END IF;

  WITH matching_observations AS (
    SELECT
      observation.governed_deal_key,
      observation.metric_slot_key,
      observation.claim_state,
      observation.canonical_value
    FROM canonical_v2_staging.market_observations observation
    WHERE observation.serving_namespace_id = p_serving_namespace_id
      AND observation.corpus_release_id = p_corpus_release_id
      AND observation.metric_key = p_metric_key
      AND observation.metric_version = p_metric_version
      AND observation.concept_key = p_concept_key
      AND observation.party_role = p_party_role
      AND observation.party_value = p_party_value
      AND observation.party_capacity = p_party_capacity
      AND observation.basis_key = p_basis_key
      AND (p_subject_deal_key IS NULL OR observation.governed_deal_key <> p_subject_deal_key)
      AND (p_sector IS NULL OR observation.sector = p_sector)
      AND (p_buyer IS NULL OR observation.buyer = p_buyer)
      AND (p_merger_form IS NULL OR observation.merger_form = p_merger_form)
      AND (p_adviser_either IS NULL OR p_adviser_either = ANY(observation.adviser_firms))
      AND (p_lawyer_either IS NULL OR p_lawyer_either = ANY(observation.lawyers))
      AND (p_year_from IS NULL OR observation.announce_year >= p_year_from)
      AND (p_year_to IS NULL OR observation.announce_year <= p_year_to)
      AND (p_min_value_usd IS NULL OR observation.deal_value_usd >= p_min_value_usd)
      AND (p_max_value_usd IS NULL OR observation.deal_value_usd <= p_max_value_usd)
  ), matching_exclusions AS (
    SELECT
      exclusion.governed_deal_key,
      exclusion.metric_slot_key,
      exclusion.claim_state,
      exclusion.eligibility_state,
      exclusion.applicability_state,
      exclusion.examination_state,
      exclusion.exclusion_reason
    FROM canonical_v2_staging.market_metric_slot_exclusions exclusion
    WHERE exclusion.serving_namespace_id = p_serving_namespace_id
      AND exclusion.corpus_release_id = p_corpus_release_id
      AND exclusion.metric_key = p_metric_key
      AND exclusion.metric_version = p_metric_version
      AND exclusion.concept_key = p_concept_key
      AND exclusion.party_role = p_party_role
      AND exclusion.party_value = p_party_value
      AND exclusion.party_capacity = p_party_capacity
      AND exclusion.basis_key = p_basis_key
      AND (p_subject_deal_key IS NULL OR exclusion.governed_deal_key <> p_subject_deal_key)
      AND (p_sector IS NULL OR exclusion.sector = p_sector)
      AND (p_buyer IS NULL OR exclusion.buyer = p_buyer)
      AND (p_merger_form IS NULL OR exclusion.merger_form = p_merger_form)
      AND (p_adviser_either IS NULL OR p_adviser_either = ANY(exclusion.adviser_firms))
      AND (p_lawyer_either IS NULL OR p_lawyer_either = ANY(exclusion.lawyers))
      AND (p_year_from IS NULL OR exclusion.announce_year >= p_year_from)
      AND (p_year_to IS NULL OR exclusion.announce_year <= p_year_to)
      AND (p_min_value_usd IS NULL OR exclusion.deal_value_usd >= p_min_value_usd)
      AND (p_max_value_usd IS NULL OR exclusion.deal_value_usd <= p_max_value_usd)
  ), slot_states AS (
    SELECT
      governed_deal_key,
      metric_slot_key,
      claim_state,
      'ELIGIBLE'::text AS eligibility_state,
      'APPLICABLE'::text AS applicability_state,
      'EXAMINED'::text AS examination_state,
      true AS comparable,
      false AS excluded
    FROM matching_observations
    UNION ALL
    SELECT
      governed_deal_key,
      metric_slot_key,
      claim_state,
      eligibility_state,
      applicability_state,
      examination_state,
      false AS comparable,
      true AS excluded
    FROM matching_exclusions
  ), counts AS (
    SELECT
      count(DISTINCT governed_deal_key) FILTER (WHERE eligibility_state = 'ELIGIBLE')::integer AS eligible_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE eligibility_state = 'ELIGIBLE' AND applicability_state = 'APPLICABLE')::integer AS applicable_deals,
      count(DISTINCT governed_deal_key) FILTER (
        WHERE eligibility_state = 'ELIGIBLE' AND applicability_state = 'APPLICABLE' AND examination_state = 'EXAMINED'
      )::integer AS examined_deals,
      count(DISTINCT governed_deal_key) FILTER (
        WHERE eligibility_state = 'ELIGIBLE' AND applicability_state = 'APPLICABLE'
          AND examination_state = 'EXAMINED' AND claim_state = 'PRESENT'
      )::integer AS present_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE comparable)::integer AS comparable_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE comparable AND claim_state = 'PRESENT')::integer AS distribution_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE excluded)::integer AS excluded_deals,
      count(*) FILTER (WHERE NOT excluded)::integer AS observation_slots,
      count(*) FILTER (WHERE excluded)::integer AS excluded_slots
    FROM slot_states
  ), distribution AS (
    SELECT jsonb_agg(jsonb_build_object(
      'canonical_value', grouped.canonical_value,
      'subject_count', grouped.subject_count,
      'deal_count', grouped.deal_count
    ) ORDER BY grouped.deal_count DESC, grouped.canonical_value::text) AS body
    FROM (
      SELECT
        canonical_value,
        count(*)::integer AS subject_count,
        count(DISTINCT governed_deal_key)::integer AS deal_count
      FROM matching_observations
      WHERE claim_state = 'PRESENT' AND canonical_value IS NOT NULL
      GROUP BY canonical_value
      ORDER BY deal_count DESC, canonical_value::text
      LIMIT 50
    ) grouped
  ), exclusions AS (
    SELECT jsonb_agg(jsonb_build_object(
      'reason_code', grouped.exclusion_reason,
      'slot_count', grouped.slot_count,
      'deal_count', grouped.deal_count
    ) ORDER BY grouped.slot_count DESC, grouped.exclusion_reason) AS body
    FROM (
      SELECT
        exclusion_reason,
        count(*)::integer AS slot_count,
        count(DISTINCT governed_deal_key)::integer AS deal_count
      FROM matching_exclusions
      GROUP BY exclusion_reason
      ORDER BY slot_count DESC, exclusion_reason
      LIMIT 50
    ) grouped
  )
  SELECT jsonb_build_object(
    'schema_version', 'MARKET_COHORT_RESULT/V1',
    'serving_namespace_id', p_serving_namespace_id,
    'corpus_release_id', p_corpus_release_id,
    'contract_fingerprint', p_contract_fingerprint,
    'cohort_digest', p_cohort_digest,
    'metric_key', p_metric_key,
    'metric_version', p_metric_version,
    'concept_key', p_concept_key,
    'subject_deal_key', p_subject_deal_key,
    'counts', jsonb_build_object(
      'eligible_deals', counts.eligible_deals,
      'applicable_deals', counts.applicable_deals,
      'examined_deals', counts.examined_deals,
      'present_deals', counts.present_deals,
      'comparable_deals', counts.comparable_deals,
      'distribution_deals', counts.distribution_deals,
      'excluded_deals', counts.excluded_deals,
      'observation_slots', counts.observation_slots,
      'excluded_slots', counts.excluded_slots
    ),
    'distribution', coalesce(distribution.body, '[]'::jsonb),
    'exclusions', coalesce(exclusions.body, '[]'::jsonb)
  ) INTO result
  FROM counts CROSS JOIN distribution CROSS JOIN exclusions;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_query_page(
  p_environment text,
  p_serving_namespace_id text,
  p_corpus_release_id text,
  p_contract_fingerprint text,
  p_query_semantics_digest text,
  p_metric_key text,
  p_metric_version integer,
  p_concept_key text,
  p_party_role text,
  p_party_value text,
  p_party_capacity text,
  p_basis_key text,
  p_sector text DEFAULT NULL,
  p_buyer text DEFAULT NULL,
  p_merger_form text DEFAULT NULL,
  p_adviser_either text DEFAULT NULL,
  p_lawyer_either text DEFAULT NULL,
  p_year_from integer DEFAULT NULL,
  p_year_to integer DEFAULT NULL,
  p_min_value_usd numeric DEFAULT NULL,
  p_max_value_usd numeric DEFAULT NULL,
  p_min_canonical_value numeric DEFAULT NULL,
  p_max_canonical_value numeric DEFAULT NULL,
  p_fee_side text DEFAULT NULL,
  p_payer_capacity text DEFAULT NULL,
  p_payee_capacity text DEFAULT NULL,
  p_trigger_code text DEFAULT NULL,
  p_criterion_code text DEFAULT NULL,
  p_contract_scope_code text DEFAULT NULL,
  p_cash_flow_direction_code text DEFAULT NULL,
  p_measurement_period_code text DEFAULT NULL,
  p_comparison_operator text DEFAULT NULL,
  p_page_size integer DEFAULT 25,
  p_after_governed_deal_key text DEFAULT NULL,
  p_after_row_serving_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '2500ms'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF current_setting('app.canonical_v2_environment', true) IS DISTINCT FROM 'staging'
    OR p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_query_page is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_serving_namespace_id !~ '^[a-f0-9]{64}$'
    OR p_corpus_release_id !~ '^[a-f0-9]{64}$'
    OR p_contract_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_query_semantics_digest !~ '^[a-f0-9]{64}$'
    OR coalesce(length(trim(p_metric_key)), 0) = 0
    OR p_metric_version < 1
    OR coalesce(length(trim(p_concept_key)), 0) = 0
    OR coalesce(length(trim(p_party_role)), 0) = 0
    OR coalesce(length(trim(p_party_value)), 0) = 0
    OR coalesce(length(trim(p_party_capacity)), 0) = 0
    OR coalesce(length(trim(p_basis_key)), 0) = 0
    OR p_page_size < 1
    OR p_page_size > 50
    OR ((p_after_governed_deal_key IS NULL) <> (p_after_row_serving_key IS NULL))
    OR (p_after_row_serving_key IS NOT NULL AND p_after_row_serving_key !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'invalid canonical query page request' USING ERRCODE = '22023';
  END IF;
  IF p_year_from IS NOT NULL AND p_year_to IS NOT NULL AND p_year_from > p_year_to THEN
    RAISE EXCEPTION 'invalid year range' USING ERRCODE = '22023';
  END IF;
  IF p_min_value_usd IS NOT NULL AND p_max_value_usd IS NOT NULL AND p_min_value_usd > p_max_value_usd THEN
    RAISE EXCEPTION 'invalid value range' USING ERRCODE = '22023';
  END IF;
  IF p_min_canonical_value IS NOT NULL
    AND p_max_canonical_value IS NOT NULL
    AND p_min_canonical_value > p_max_canonical_value THEN
    RAISE EXCEPTION 'invalid canonical value range' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = p_corpus_release_id
      AND release.contract_fingerprint = p_contract_fingerprint
  ) THEN
    RAISE EXCEPTION 'unknown fixture corpus release' USING ERRCODE = '22023';
  END IF;

  WITH matching_rows AS MATERIALIZED (
    SELECT row.*
    FROM canonical_v2_staging.shared_serving_rows row
    WHERE row.serving_namespace_id = p_serving_namespace_id
      AND row.corpus_release_id = p_corpus_release_id
      AND row.contract_fingerprint = p_contract_fingerprint
      AND row.metric_key = p_metric_key
      AND row.metric_version = p_metric_version
      AND row.concept_key = p_concept_key
      AND row.party_role = p_party_role
      AND row.party_value = p_party_value
      AND row.party_capacity = p_party_capacity
      AND row.basis_key = p_basis_key
      AND (p_sector IS NULL OR row.sector = p_sector)
      AND (p_buyer IS NULL OR row.buyer = p_buyer)
      AND (p_merger_form IS NULL OR row.merger_form = p_merger_form)
      AND (p_adviser_either IS NULL OR p_adviser_either = ANY(row.adviser_firms))
      AND (p_lawyer_either IS NULL OR p_lawyer_either = ANY(row.lawyers))
      AND (p_year_from IS NULL OR row.announce_year >= p_year_from)
      AND (p_year_to IS NULL OR row.announce_year <= p_year_to)
      AND (p_min_value_usd IS NULL OR row.deal_value_usd >= p_min_value_usd)
      AND (p_max_value_usd IS NULL OR row.deal_value_usd <= p_max_value_usd)
      AND (p_min_canonical_value IS NULL OR row.canonical_numeric_value >= p_min_canonical_value)
      AND (p_max_canonical_value IS NULL OR row.canonical_numeric_value <= p_max_canonical_value)
      AND (p_fee_side IS NULL OR row.fee_side = p_fee_side)
      AND (p_payer_capacity IS NULL OR row.payer_capacity = p_payer_capacity)
      AND (p_payee_capacity IS NULL OR row.payee_capacity = p_payee_capacity)
      AND (p_trigger_code IS NULL OR p_trigger_code = ANY(row.trigger_codes))
      AND (p_criterion_code IS NULL OR row.criterion_code = p_criterion_code)
      AND (p_contract_scope_code IS NULL OR row.contract_scope_code = p_contract_scope_code)
      AND (p_cash_flow_direction_code IS NULL OR row.cash_flow_direction_code = p_cash_flow_direction_code)
      AND (p_measurement_period_code IS NULL OR row.measurement_period_code = p_measurement_period_code)
      AND (p_comparison_operator IS NULL OR row.comparison_operator = p_comparison_operator)
  ), page_candidates AS MATERIALIZED (
    SELECT row.*
    FROM matching_rows row
    WHERE p_after_governed_deal_key IS NULL
      OR (row.governed_deal_key, row.row_serving_key) > (p_after_governed_deal_key, p_after_row_serving_key)
    ORDER BY row.governed_deal_key, row.row_serving_key
    LIMIT p_page_size + 1
  ), page_rows AS MATERIALIZED (
    SELECT row.*
    FROM page_candidates row
    ORDER BY row.governed_deal_key, row.row_serving_key
    LIMIT p_page_size
  ), page_payload AS (
    SELECT
      count(*)::integer AS page_count,
      coalesce(jsonb_agg(row.canonical_payload ORDER BY row.governed_deal_key, row.row_serving_key), '[]'::jsonb) AS rows
    FROM page_rows row
  ), last_row AS (
    SELECT row.governed_deal_key, row.row_serving_key
    FROM page_rows row
    ORDER BY row.governed_deal_key DESC, row.row_serving_key DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'schema_version', 'CANONICAL_QUERY_PAGE_RESULT/V1',
    'serving_namespace_id', p_serving_namespace_id,
    'corpus_release_id', p_corpus_release_id,
    'contract_fingerprint', p_contract_fingerprint,
    'query_semantics_digest', p_query_semantics_digest,
    'total_count', (SELECT count(*)::integer FROM matching_rows),
    'page_count', page_payload.page_count,
    'rows', page_payload.rows,
    'next_cursor', CASE
      WHEN (SELECT count(*) FROM page_candidates) > p_page_size THEN (
        SELECT jsonb_build_object(
          'governed_deal_key', last_row.governed_deal_key,
          'row_serving_key', last_row.row_serving_key
        ) FROM last_row
      )
      ELSE NULL
    END
  ) INTO result
  FROM page_payload;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_reviewed_deal_context(
  p_environment text,
  p_serving_namespace_id text,
  p_corpus_release_id text,
  p_contract_fingerprint text,
  p_request_digest text,
  p_governed_deal_key text,
  p_page_size integer DEFAULT 25,
  p_after_row_serving_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '2500ms'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF current_setting('app.canonical_v2_environment', true) IS DISTINCT FROM 'staging'
    OR p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_reviewed_deal_context is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_serving_namespace_id !~ '^[a-f0-9]{64}$'
    OR p_corpus_release_id !~ '^[a-f0-9]{64}$'
    OR p_contract_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_request_digest !~ '^[a-f0-9]{64}$'
    OR coalesce(length(trim(p_governed_deal_key)), 0) = 0
    OR p_page_size < 1
    OR p_page_size > 50
    OR (p_after_row_serving_key IS NOT NULL AND p_after_row_serving_key !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'invalid reviewed-deal context request' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = p_corpus_release_id
      AND release.contract_fingerprint = p_contract_fingerprint
  ) THEN
    RAISE EXCEPTION 'unknown fixture corpus release' USING ERRCODE = '22023';
  END IF;

  WITH matching_rows AS MATERIALIZED (
    SELECT row.row_serving_key, row.canonical_payload
    FROM canonical_v2_staging.reviewed_source_specific_serving_rows row
    WHERE row.serving_namespace_id = p_serving_namespace_id
      AND row.corpus_release_id = p_corpus_release_id
      AND row.contract_fingerprint = p_contract_fingerprint
      AND row.governed_deal_key = p_governed_deal_key
      AND row.disposition_code = 'REVIEWED_SOURCE_SPECIFIC'
      AND row.market_cohort_eligible = false
      AND row.aggregate_authority = 'NO_AGGREGATE_AUTHORITY'
  ), page_candidates AS MATERIALIZED (
    SELECT row.row_serving_key, row.canonical_payload
    FROM matching_rows row
    WHERE p_after_row_serving_key IS NULL OR row.row_serving_key > p_after_row_serving_key
    ORDER BY row.row_serving_key
    LIMIT p_page_size + 1
  ), page_rows AS MATERIALIZED (
    SELECT row.row_serving_key, row.canonical_payload
    FROM page_candidates row
    ORDER BY row.row_serving_key
    LIMIT p_page_size
  ), page_payload AS (
    SELECT
      count(*)::integer AS page_count,
      coalesce(jsonb_agg(row.canonical_payload ORDER BY row.row_serving_key), '[]'::jsonb) AS rows
    FROM page_rows row
  ), last_row AS (
    SELECT row.row_serving_key
    FROM page_rows row
    ORDER BY row.row_serving_key DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'schema_version', 'REVIEWED_DEAL_CONTEXT_RESULT/V1',
    'serving_namespace_id', p_serving_namespace_id,
    'corpus_release_id', p_corpus_release_id,
    'contract_fingerprint', p_contract_fingerprint,
    'request_digest', p_request_digest,
    'governed_deal_key', p_governed_deal_key,
    'total_count', (SELECT count(*)::integer FROM matching_rows),
    'page_count', page_payload.page_count,
    'rows', page_payload.rows,
    'next_cursor', CASE
      WHEN (SELECT count(*) FROM page_candidates) > p_page_size
      THEN (SELECT last_row.row_serving_key FROM last_row)
      ELSE NULL
    END
  ) INTO result
  FROM page_payload;

  RETURN result;
END;
$$;

REVOKE ALL ON TABLE canonical_v2_staging.fixture_corpus_releases
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.market_observations
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.market_metric_slot_exclusions
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.shared_serving_rows
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.reviewed_source_specific_serving_rows
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.exact_detail_serving_packages
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.candidate_release_import_receipts
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition()
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_import_candidate_release(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
GRANT EXECUTE ON FUNCTION public.canonical_v2_import_candidate_release(text, jsonb)
  TO canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_market_cohort(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, text, integer, integer, numeric, numeric
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_v2_market_cohort(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, text, integer, integer, numeric, numeric
) TO canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_query_page(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, integer, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_v2_query_page(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, integer, text, text
) TO canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_reviewed_deal_context(
  text, text, text, text, text, text, integer, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_v2_reviewed_deal_context(
  text, text, text, text, text, text, integer, text
) TO canonical_v2_serving;
