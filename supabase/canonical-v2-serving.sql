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
  correction_input_seal_id text CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  correction_input_root text CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$'),
  frozen_pair_root_id text NOT NULL CHECK (frozen_pair_root_id ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  projection_version text NOT NULL CHECK (projection_version IN (
    'canonical-v2-serving/v1',
    'canonical-v2-serving/v2'
  )),
  query_projection_contract_digest text CHECK (
    query_projection_contract_digest IS NULL
    OR query_projection_contract_digest ~ '^[a-f0-9]{64}$'
  ),
  response_schema_version text NOT NULL CHECK (response_schema_version = 'MARKET_COHORT_RESULT/V1'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$')
);

ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  ADD COLUMN IF NOT EXISTS query_projection_contract_digest text;
ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  DROP CONSTRAINT IF EXISTS fixture_corpus_releases_projection_version_check;
ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  ADD CONSTRAINT fixture_corpus_releases_projection_version_check
  CHECK (projection_version IN ('canonical-v2-serving/v1', 'canonical-v2-serving/v2'));
ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  DROP CONSTRAINT IF EXISTS fixture_corpus_releases_projection_contract_check;
ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  ADD CONSTRAINT fixture_corpus_releases_projection_contract_check CHECK (
    (projection_version = 'canonical-v2-serving/v1' AND query_projection_contract_digest IS NULL)
    OR (
      projection_version = 'canonical-v2-serving/v2'
      AND query_projection_contract_digest = '048394ed05f7b810b0688e8cc0324f6270196b0c531e50d37fa9ac537efed827'
    )
  );

CREATE TABLE IF NOT EXISTS canonical_v2_staging.deal_serving_directory (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  application_deal_id uuid NOT NULL,
  governed_deal_key text NOT NULL,
  deal_admission_id text NOT NULL CHECK (deal_admission_id ~ '^[a-f0-9]{64}$'),
  deal_serving_directory_record_id text NOT NULL CHECK (deal_serving_directory_record_id ~ '^[a-f0-9]{64}$'),
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, application_deal_id),
  UNIQUE (serving_namespace_id, corpus_release_id, governed_deal_key),
  UNIQUE (serving_namespace_id, corpus_release_id, deal_serving_directory_record_id)
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
  payment_timings text[] NOT NULL DEFAULT '{}',
  trigger_conditions text[] NOT NULL DEFAULT '{}',
  criterion_code text,
  contract_scope_code text,
  cash_flow_direction_code text,
  measurement_period_code text,
  comparison_operator text,
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, row_serving_key)
);

ALTER TABLE canonical_v2_staging.shared_serving_rows
  ADD COLUMN IF NOT EXISTS payment_timings text[] NOT NULL DEFAULT '{}';
ALTER TABLE canonical_v2_staging.shared_serving_rows
  ADD COLUMN IF NOT EXISTS trigger_conditions text[] NOT NULL DEFAULT '{}';

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

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_release_semantic_graphs (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  validated_semantic_graph_id text NOT NULL CHECK (validated_semantic_graph_id ~ '^[a-f0-9]{64}$'),
  governed_deal_key text NOT NULL,
  deal_admission_id text NOT NULL CHECK (deal_admission_id ~ '^[a-f0-9]{64}$'),
  source_admission_manifest_id text NOT NULL CHECK (source_admission_manifest_id ~ '^[a-f0-9]{64}$'),
  document_hash text NOT NULL CHECK (document_hash ~ '^[a-f0-9]{64}$'),
  canonical_text_id text NOT NULL CHECK (canonical_text_id ~ '^[a-f0-9]{64}$'),
  definition_cue_count integer NOT NULL CHECK (definition_cue_count >= 0),
  definition_use_cue_count integer NOT NULL CHECK (definition_use_cue_count >= 0),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, validated_semantic_graph_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_release_correction_input_seals (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  correction_input_seal_id text NOT NULL CHECK (correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  correction_input_root text NOT NULL CHECK (correction_input_root ~ '^[a-f0-9]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id),
  UNIQUE (serving_namespace_id, corpus_release_id, correction_input_seal_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_release_correction_discharges (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  correction_application_id text NOT NULL CHECK (correction_application_id ~ '^[a-f0-9]{64}$'),
  correction_discharge_id text NOT NULL CHECK (correction_discharge_id ~ '^[a-f0-9]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (serving_namespace_id, corpus_release_id, correction_application_id),
  UNIQUE (serving_namespace_id, corpus_release_id, correction_discharge_id)
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.candidate_release_import_receipts (
  candidate_manifest_id text PRIMARY KEY CHECK (candidate_manifest_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL UNIQUE REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  correction_input_seal_id text CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  correction_input_root text CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$'),
  candidate_input_contract_fingerprint text
    CHECK (candidate_input_contract_fingerprint IS NULL OR candidate_input_contract_fingerprint ~ '^[a-f0-9]{64}$'),
  candidate_input_head_id text
    CHECK (candidate_input_head_id IS NULL OR candidate_input_head_id ~ '^[a-f0-9]{64}$'),
  candidate_input_head_payload_digest text
    CHECK (candidate_input_head_payload_digest IS NULL OR candidate_input_head_payload_digest ~ '^[a-f0-9]{64}$'),
  correction_discharge_map_id text
    CHECK (correction_discharge_map_id IS NULL OR correction_discharge_map_id ~ '^[a-f0-9]{64}$'),
  correction_discharge_map_payload_digest text
    CHECK (correction_discharge_map_payload_digest IS NULL OR correction_discharge_map_payload_digest ~ '^[a-f0-9]{64}$'),
  candidate_release_import_plan_id text NOT NULL UNIQUE CHECK (candidate_release_import_plan_id ~ '^[a-f0-9]{64}$'),
  import_state text NOT NULL CHECK (import_state = 'IMPORTED_COMPLETE'),
  expected_counts jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.active_corpus_release_pointer_history (
  pointer_id text PRIMARY KEY CHECK (pointer_id ~ '^[a-f0-9]{64}$'),
  environment text NOT NULL CHECK (environment = 'staging'),
  generation integer NOT NULL CHECK (generation > 0),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  candidate_manifest_id text NOT NULL REFERENCES canonical_v2_staging.candidate_release_import_receipts(candidate_manifest_id),
  correction_input_seal_id text CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  correction_input_root text CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$'),
  candidate_release_import_plan_id text NOT NULL REFERENCES canonical_v2_staging.candidate_release_import_receipts(candidate_release_import_plan_id),
  previous_pointer_id text NOT NULL CHECK (previous_pointer_id ~ '^[a-f0-9]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  activated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.active_corpus_release_pointers (
  environment text PRIMARY KEY CHECK (environment = 'staging'),
  generation integer NOT NULL CHECK (generation > 0),
  pointer_id text NOT NULL UNIQUE REFERENCES canonical_v2_staging.active_corpus_release_pointer_history(pointer_id),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  candidate_manifest_id text NOT NULL REFERENCES canonical_v2_staging.candidate_release_import_receipts(candidate_manifest_id),
  correction_input_seal_id text CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  correction_input_root text CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$'),
  candidate_release_import_plan_id text NOT NULL REFERENCES canonical_v2_staging.candidate_release_import_receipts(candidate_release_import_plan_id),
  previous_pointer_id text NOT NULL CHECK (previous_pointer_id ~ '^[a-f0-9]{64}$'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$'),
  activated_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

ALTER TABLE canonical_v2_staging.fixture_corpus_releases
  ADD COLUMN IF NOT EXISTS correction_input_seal_id text
    CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_input_root text
    CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$');
ALTER TABLE canonical_v2_staging.candidate_release_import_receipts
  ADD COLUMN IF NOT EXISTS correction_input_seal_id text
    CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_input_root text
    CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS candidate_input_contract_fingerprint text
    CHECK (candidate_input_contract_fingerprint IS NULL OR candidate_input_contract_fingerprint ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS candidate_input_head_id text
    CHECK (candidate_input_head_id IS NULL OR candidate_input_head_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS candidate_input_head_payload_digest text
    CHECK (candidate_input_head_payload_digest IS NULL OR candidate_input_head_payload_digest ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_discharge_map_id text
    CHECK (correction_discharge_map_id IS NULL OR correction_discharge_map_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_discharge_map_payload_digest text
    CHECK (correction_discharge_map_payload_digest IS NULL OR correction_discharge_map_payload_digest ~ '^[a-f0-9]{64}$');
ALTER TABLE canonical_v2_staging.active_corpus_release_pointer_history
  ADD COLUMN IF NOT EXISTS correction_input_seal_id text
    CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_input_root text
    CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$');
ALTER TABLE canonical_v2_staging.active_corpus_release_pointers
  ADD COLUMN IF NOT EXISTS correction_input_seal_id text
    CHECK (correction_input_seal_id IS NULL OR correction_input_seal_id ~ '^[a-f0-9]{64}$'),
  ADD COLUMN IF NOT EXISTS correction_input_root text
    CHECK (correction_input_root IS NULL OR correction_input_root ~ '^[a-f0-9]{64}$');

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
CREATE INDEX IF NOT EXISTS canonical_v2_deal_serving_directory_lookup_idx
  ON canonical_v2_staging.deal_serving_directory (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    application_deal_id,
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
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_payment_timings_idx
  ON canonical_v2_staging.shared_serving_rows USING gin (payment_timings);
CREATE INDEX IF NOT EXISTS canonical_v2_shared_rows_trigger_conditions_idx
  ON canonical_v2_staging.shared_serving_rows USING gin (trigger_conditions);
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
CREATE INDEX IF NOT EXISTS canonical_v2_candidate_release_semantic_graph_lineage_idx
  ON canonical_v2_staging.candidate_release_semantic_graphs (
    serving_namespace_id,
    corpus_release_id,
    contract_fingerprint,
    governed_deal_key,
    document_hash,
    canonical_text_id
  );

CREATE OR REPLACE FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    length(NEW.serving_namespace_id)::text || ':' || NEW.serving_namespace_id
      || length(NEW.corpus_release_id)::text || ':' || NEW.corpus_release_id
      || length(NEW.metric_slot_key)::text || ':' || NEW.metric_slot_key,
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
ALTER TABLE canonical_v2_staging.deal_serving_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_metric_slot_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.shared_serving_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.reviewed_source_specific_serving_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.exact_detail_serving_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_release_semantic_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_release_correction_input_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_release_correction_discharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.candidate_release_import_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.active_corpus_release_pointer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.active_corpus_release_pointers ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.canonical_v2_rollback_inactive_candidate_release(
  p_environment text,
  p_candidate_manifest_id text,
  p_corpus_release_id text,
  p_serving_namespace_id text,
  p_candidate_release_import_plan_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '10000ms'
AS $$
DECLARE
  expected jsonb;
  active_pointer_id_before text;
  active_pointer_id_after text;
  deleted_count integer;
  deleted_query_count integer;
  deleted_incomplete_count integer;
  deleted_counts jsonb := '{}'::jsonb;
  rolled_back_at_value timestamptz := transaction_timestamp();
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_rollback_inactive_candidate_release is staging-only'
      USING ERRCODE = '42501';
  END IF;
  IF p_candidate_manifest_id !~ '^[a-f0-9]{64}$'
    OR p_corpus_release_id !~ '^[a-f0-9]{64}$'
    OR p_serving_namespace_id !~ '^[a-f0-9]{64}$'
    OR p_candidate_release_import_plan_id !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid inactive candidate rollback identity' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_candidate_manifest_id, 0));

  SELECT receipt.expected_counts INTO expected
  FROM canonical_v2_staging.candidate_release_import_receipts receipt
  WHERE receipt.candidate_manifest_id = p_candidate_manifest_id
    AND receipt.corpus_release_id = p_corpus_release_id
    AND receipt.serving_namespace_id = p_serving_namespace_id
    AND receipt.candidate_release_import_plan_id = p_candidate_release_import_plan_id
    AND receipt.import_state = 'IMPORTED_COMPLETE'
  FOR UPDATE OF receipt;
  IF NOT FOUND OR jsonb_typeof(expected) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'inactive candidate rollback receipt identity does not exist'
      USING ERRCODE = '02000';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM canonical_v2_staging.fixture_corpus_releases release
    WHERE release.corpus_release_id = p_corpus_release_id
      AND release.candidate_manifest_id = p_candidate_manifest_id
      AND release.canonical_payload->>'serving_namespace_id' = p_serving_namespace_id
  ) THEN
    RAISE EXCEPTION 'inactive candidate release record does not match its receipt'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM canonical_v2_staging.active_corpus_release_pointers pointer
    WHERE pointer.corpus_release_id = p_corpus_release_id
      OR pointer.serving_namespace_id = p_serving_namespace_id
      OR pointer.candidate_manifest_id = p_candidate_manifest_id
      OR pointer.candidate_release_import_plan_id = p_candidate_release_import_plan_id
  ) OR EXISTS (
    SELECT 1
    FROM canonical_v2_staging.active_corpus_release_pointer_history history
    WHERE history.corpus_release_id = p_corpus_release_id
      OR history.serving_namespace_id = p_serving_namespace_id
      OR history.candidate_manifest_id = p_candidate_manifest_id
      OR history.candidate_release_import_plan_id = p_candidate_release_import_plan_id
  ) THEN
    RAISE EXCEPTION 'an active or historically active release cannot be removed as an inactive candidate'
      USING ERRCODE = '55000';
  END IF;

  SELECT pointer.pointer_id INTO active_pointer_id_before
  FROM canonical_v2_staging.active_corpus_release_pointers pointer
  WHERE pointer.environment = 'staging';
  IF active_pointer_id_before !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'active staging release pointer is unavailable' USING ERRCODE = '02000';
  END IF;

  DELETE FROM canonical_v2_staging.candidate_release_correction_discharges row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('correction_discharge_records', deleted_count);

  DELETE FROM canonical_v2_staging.candidate_release_correction_input_seals row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('correction_input_seal_records', deleted_count);

  DELETE FROM canonical_v2_staging.deal_serving_directory row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('deal_directory_records', deleted_count);

  DELETE FROM canonical_v2_staging.market_observations row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('market_observations', deleted_count);

  DELETE FROM canonical_v2_staging.market_metric_slot_exclusions row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('market_exclusions', deleted_count);

  SELECT
    count(*) FILTER (WHERE row.canonical_payload->>'row_kind' = 'CANONICAL_RESULT'),
    count(*) FILTER (WHERE row.canonical_payload->>'row_kind' = 'INCOMPLETE_CANONICAL_RESULT')
  INTO deleted_query_count, deleted_incomplete_count
  FROM canonical_v2_staging.shared_serving_rows row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;

  DELETE FROM canonical_v2_staging.shared_serving_rows row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count IS DISTINCT FROM deleted_query_count + deleted_incomplete_count THEN
    RAISE EXCEPTION 'inactive candidate rollback found an unknown shared-row variant'
      USING ERRCODE = '23514';
  END IF;
  deleted_counts := deleted_counts || jsonb_build_object('query_records', deleted_query_count);
  IF expected ? 'incomplete_canonical_records' THEN
    deleted_counts := deleted_counts || jsonb_build_object(
      'incomplete_canonical_records', deleted_incomplete_count
    );
  ELSIF deleted_incomplete_count <> 0 THEN
    RAISE EXCEPTION 'legacy candidate rollback found incomplete canonical rows'
      USING ERRCODE = '23514';
  END IF;

  DELETE FROM canonical_v2_staging.reviewed_source_specific_serving_rows row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('source_specific_records', deleted_count);

  DELETE FROM canonical_v2_staging.exact_detail_serving_packages row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('exact_detail_packages', deleted_count);

  DELETE FROM canonical_v2_staging.candidate_release_semantic_graphs row
  WHERE row.serving_namespace_id = p_serving_namespace_id
    AND row.corpus_release_id = p_corpus_release_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('validated_semantic_graph_records', deleted_count);

  DELETE FROM canonical_v2_staging.candidate_release_import_receipts receipt
  WHERE receipt.candidate_manifest_id = p_candidate_manifest_id
    AND receipt.corpus_release_id = p_corpus_release_id
    AND receipt.serving_namespace_id = p_serving_namespace_id
    AND receipt.candidate_release_import_plan_id = p_candidate_release_import_plan_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('import_receipts', deleted_count);

  DELETE FROM canonical_v2_staging.fixture_corpus_releases release
  WHERE release.corpus_release_id = p_corpus_release_id
    AND release.candidate_manifest_id = p_candidate_manifest_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('release_records', deleted_count);

  IF (deleted_counts->>'correction_input_seal_records')::integer
      IS DISTINCT FROM (expected->>'correction_input_seal_records')::integer
    OR (deleted_counts->>'correction_discharge_records')::integer
      IS DISTINCT FROM (expected->>'correction_discharge_records')::integer
    OR (deleted_counts->>'deal_directory_records')::integer
      IS DISTINCT FROM (expected->>'deal_directory_records')::integer
    OR (deleted_counts->>'market_observations')::integer
      IS DISTINCT FROM (expected->>'market_observations')::integer
    OR (deleted_counts->>'market_exclusions')::integer
      IS DISTINCT FROM (expected->>'market_exclusions')::integer
    OR (deleted_counts->>'query_records')::integer
      IS DISTINCT FROM (expected->>'query_records')::integer
    OR (expected ? 'incomplete_canonical_records' AND
      (deleted_counts->>'incomplete_canonical_records')::integer
        IS DISTINCT FROM (expected->>'incomplete_canonical_records')::integer)
    OR (deleted_counts->>'source_specific_records')::integer
      IS DISTINCT FROM (expected->>'source_specific_records')::integer
    OR (deleted_counts->>'exact_detail_packages')::integer
      IS DISTINCT FROM (expected->>'exact_detail_packages')::integer
    OR (deleted_counts->>'validated_semantic_graph_records')::integer
      IS DISTINCT FROM (expected->>'validated_semantic_graph_records')::integer
    OR (deleted_counts->>'import_receipts')::integer IS DISTINCT FROM 1
    OR (deleted_counts->>'release_records')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'inactive candidate rollback did not remove the exact certified partition'
      USING ERRCODE = '23514';
  END IF;

  SELECT pointer.pointer_id INTO active_pointer_id_after
  FROM canonical_v2_staging.active_corpus_release_pointers pointer
  WHERE pointer.environment = 'staging';
  IF active_pointer_id_after IS DISTINCT FROM active_pointer_id_before THEN
    RAISE EXCEPTION 'inactive candidate rollback changed the active release pointer'
      USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'CANDIDATE_RELEASE_ROLLBACK_RECEIPT/V1',
    'rollback_state', 'REMOVED_INACTIVE',
    'candidate_manifest_id', p_candidate_manifest_id,
    'corpus_release_id', p_corpus_release_id,
    'serving_namespace_id', p_serving_namespace_id,
    'candidate_release_import_plan_id', p_candidate_release_import_plan_id,
    'active_pointer_id', active_pointer_id_after,
    'deleted_counts', deleted_counts,
    'rolled_back_at', rolled_back_at_value
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION public.canonical_v2_active_release(p_environment text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, canonical_v2_staging
SET statement_timeout = '1000ms'
AS $$
  SELECT CASE
    WHEN p_environment IS DISTINCT FROM 'staging'
    THEN NULL
    ELSE (
      SELECT pointer.canonical_payload
      FROM canonical_v2_staging.active_corpus_release_pointers pointer
      WHERE pointer.environment = p_environment
    )
  END
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
  IF p_environment IS DISTINCT FROM 'staging' THEN
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

DROP FUNCTION IF EXISTS public.canonical_v2_query_page(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, integer, text, text
);

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
  p_payment_timing text DEFAULT NULL,
  p_trigger_condition text DEFAULT NULL,
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
  IF p_environment IS DISTINCT FROM 'staging' THEN
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
      AND row.canonical_payload->>'row_kind' = 'CANONICAL_RESULT'
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
      AND (p_trigger_code IS NULL OR row.trigger_codes @> ARRAY[p_trigger_code]::text[])
      AND (p_payment_timing IS NULL OR row.payment_timings @> ARRAY[p_payment_timing]::text[])
      AND (p_trigger_condition IS NULL OR row.trigger_conditions @> ARRAY[p_trigger_condition]::text[])
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

DROP FUNCTION IF EXISTS public.canonical_v2_active_query_page(
  text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text, text, integer, text, text
);

CREATE OR REPLACE FUNCTION public.canonical_v2_active_query_page(
  p_environment text,
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
  p_payment_timing text DEFAULT NULL,
  p_trigger_condition text DEFAULT NULL,
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
  active_pointer canonical_v2_staging.active_corpus_release_pointers%ROWTYPE;
  release_contract_fingerprint text;
  result jsonb;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_active_query_page is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_contract_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid active query page request' USING ERRCODE = '22023';
  END IF;

  SELECT pointer.* INTO active_pointer
  FROM canonical_v2_staging.active_corpus_release_pointers pointer
  WHERE pointer.environment = p_environment;
  IF active_pointer.pointer_id IS NULL THEN
    RAISE EXCEPTION 'no active canonical corpus release' USING ERRCODE = '02000';
  END IF;

  -- Release-declared fingerprint (2026-07-23 contract-amendment serving fix;
  -- see docs/handoffs/SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md option 1).
  -- The ACTIVE release governs what is served; the caller-supplied
  -- p_contract_fingerprint reflects whatever contract the CALLING app
  -- currently has compiled, which may have moved ahead of (or behind) the
  -- fingerprint the active release was actually built and activated under.
  -- We resolve and filter against the fingerprint the release itself
  -- declares, not against equality with what the caller asked for, so
  -- serving stays correct across freeze-gate amendments by construction.
  SELECT release.contract_fingerprint INTO release_contract_fingerprint
  FROM canonical_v2_staging.fixture_corpus_releases release
  WHERE release.corpus_release_id = active_pointer.corpus_release_id;
  IF release_contract_fingerprint IS NULL THEN
    RAISE EXCEPTION 'active canonical corpus release has no declared contract fingerprint' USING ERRCODE = '02000';
  END IF;

  SELECT public.canonical_v2_query_page(
    p_environment => p_environment,
    p_serving_namespace_id => active_pointer.serving_namespace_id,
    p_corpus_release_id => active_pointer.corpus_release_id,
    p_contract_fingerprint => release_contract_fingerprint,
    p_query_semantics_digest => p_query_semantics_digest,
    p_metric_key => p_metric_key,
    p_metric_version => p_metric_version,
    p_concept_key => p_concept_key,
    p_party_role => p_party_role,
    p_party_value => p_party_value,
    p_party_capacity => p_party_capacity,
    p_basis_key => p_basis_key,
    p_sector => p_sector,
    p_buyer => p_buyer,
    p_merger_form => p_merger_form,
    p_adviser_either => p_adviser_either,
    p_lawyer_either => p_lawyer_either,
    p_year_from => p_year_from,
    p_year_to => p_year_to,
    p_min_value_usd => p_min_value_usd,
    p_max_value_usd => p_max_value_usd,
    p_min_canonical_value => p_min_canonical_value,
    p_max_canonical_value => p_max_canonical_value,
    p_fee_side => p_fee_side,
    p_payer_capacity => p_payer_capacity,
    p_payee_capacity => p_payee_capacity,
    p_trigger_code => p_trigger_code,
    p_payment_timing => p_payment_timing,
    p_trigger_condition => p_trigger_condition,
    p_criterion_code => p_criterion_code,
    p_contract_scope_code => p_contract_scope_code,
    p_cash_flow_direction_code => p_cash_flow_direction_code,
    p_measurement_period_code => p_measurement_period_code,
    p_comparison_operator => p_comparison_operator,
    p_page_size => p_page_size,
    p_after_governed_deal_key => p_after_governed_deal_key,
    p_after_row_serving_key => p_after_row_serving_key
  ) INTO result;

  RETURN result || jsonb_build_object('pointer_id', active_pointer.pointer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_active_review_context(
  p_environment text,
  p_contract_fingerprint text,
  p_request_digest text,
  p_application_deal_id uuid,
  p_page_size integer DEFAULT 100,
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
  active_pointer canonical_v2_staging.active_corpus_release_pointers%ROWTYPE;
  selected_deal canonical_v2_staging.deal_serving_directory%ROWTYPE;
  result jsonb;
BEGIN
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_active_review_context is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_contract_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_request_digest !~ '^[a-f0-9]{64}$'
    OR p_application_deal_id IS NULL
    OR p_page_size < 1
    OR p_page_size > 200
    OR (p_after_row_serving_key IS NOT NULL AND p_after_row_serving_key !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'invalid active Review context request' USING ERRCODE = '22023';
  END IF;

  SELECT pointer.* INTO active_pointer
  FROM canonical_v2_staging.active_corpus_release_pointers pointer
  WHERE pointer.environment = p_environment;
  IF active_pointer.pointer_id IS NULL THEN
    RAISE EXCEPTION 'no active canonical corpus release' USING ERRCODE = '02000';
  END IF;

  SELECT directory.* INTO selected_deal
  FROM canonical_v2_staging.deal_serving_directory directory
  WHERE directory.serving_namespace_id = active_pointer.serving_namespace_id
    AND directory.corpus_release_id = active_pointer.corpus_release_id
    AND directory.contract_fingerprint = p_contract_fingerprint
    AND directory.application_deal_id = p_application_deal_id;
  IF selected_deal.governed_deal_key IS NULL THEN
    RAISE EXCEPTION 'deal is not admitted to the active canonical release' USING ERRCODE = '02000';
  END IF;

  WITH matching_rows AS MATERIALIZED (
    SELECT row.row_serving_key, row.canonical_payload
    FROM canonical_v2_staging.shared_serving_rows row
    WHERE row.serving_namespace_id = active_pointer.serving_namespace_id
      AND row.corpus_release_id = active_pointer.corpus_release_id
      AND row.contract_fingerprint = p_contract_fingerprint
      AND row.governed_deal_key = selected_deal.governed_deal_key
    UNION ALL
    SELECT row.row_serving_key, row.canonical_payload
    FROM canonical_v2_staging.reviewed_source_specific_serving_rows row
    WHERE row.serving_namespace_id = active_pointer.serving_namespace_id
      AND row.corpus_release_id = active_pointer.corpus_release_id
      AND row.contract_fingerprint = p_contract_fingerprint
      AND row.governed_deal_key = selected_deal.governed_deal_key
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
  )
  SELECT jsonb_build_object(
    'schema_version', 'ACTIVE_REVIEW_CONTEXT_RESULT/V1',
    'request_digest', p_request_digest,
    'pointer_id', active_pointer.pointer_id,
    'serving_namespace_id', active_pointer.serving_namespace_id,
    'corpus_release_id', active_pointer.corpus_release_id,
    'contract_fingerprint', p_contract_fingerprint,
    'application_deal_id', selected_deal.application_deal_id::text,
    'governed_deal_key', selected_deal.governed_deal_key,
    'deal_admission_id', selected_deal.deal_admission_id,
    'total_count', (SELECT count(*)::integer FROM matching_rows),
    'page_count', page_payload.page_count,
    'rows', page_payload.rows,
    'next_cursor', CASE
      WHEN (SELECT count(*) FROM page_candidates) > p_page_size
      THEN (SELECT row.row_serving_key FROM page_rows row ORDER BY row.row_serving_key DESC LIMIT 1)
      ELSE NULL
    END
  ) INTO result
  FROM page_payload;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_v2_exact_detail(
  p_environment text,
  p_serving_namespace_id text,
  p_corpus_release_id text,
  p_contract_fingerprint text,
  p_application_deal_id uuid,
  p_row_serving_key text,
  p_source_detail_reference_id text
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
  IF p_environment IS DISTINCT FROM 'staging' THEN
    RAISE EXCEPTION 'canonical_v2_exact_detail is staging-only' USING ERRCODE = '42501';
  END IF;
  IF p_serving_namespace_id !~ '^[a-f0-9]{64}$'
    OR p_corpus_release_id !~ '^[a-f0-9]{64}$'
    OR p_contract_fingerprint !~ '^[a-f0-9]{64}$'
    OR p_application_deal_id IS NULL
    OR p_row_serving_key !~ '^[a-f0-9]{64}$'
    OR p_source_detail_reference_id !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid exact-detail request' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'schema_version', 'SERVING_EXACT_DETAIL_RESULT/V1',
    'serving_namespace_id', package.serving_namespace_id,
    'corpus_release_id', package.corpus_release_id,
    'contract_fingerprint', package.contract_fingerprint,
    'application_deal_id', directory.application_deal_id::text,
    'governed_deal_key', directory.governed_deal_key,
    'row_serving_key', package.row_serving_key,
    'source_detail_reference_id', p_source_detail_reference_id,
    'exact_detail_package_digest', package.exact_detail_package_digest,
    'package', package.canonical_payload
  ) INTO result
  FROM canonical_v2_staging.deal_serving_directory directory
  JOIN canonical_v2_staging.exact_detail_serving_packages package
    ON package.serving_namespace_id = directory.serving_namespace_id
    AND package.corpus_release_id = directory.corpus_release_id
    AND package.contract_fingerprint = directory.contract_fingerprint
    AND package.governed_deal_key = directory.governed_deal_key
  WHERE directory.serving_namespace_id = p_serving_namespace_id
    AND directory.corpus_release_id = p_corpus_release_id
    AND directory.contract_fingerprint = p_contract_fingerprint
    AND directory.application_deal_id = p_application_deal_id
    AND package.row_serving_key = p_row_serving_key
    AND p_source_detail_reference_id = ANY(package.source_detail_reference_ids);

  IF result IS NULL THEN
    RAISE EXCEPTION 'exact source is not available for the selected row' USING ERRCODE = '02000';
  END IF;
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
  IF p_environment IS DISTINCT FROM 'staging' THEN
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
REVOKE ALL ON TABLE canonical_v2_staging.deal_serving_directory
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
REVOKE ALL ON TABLE canonical_v2_staging.candidate_release_semantic_graphs
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.candidate_release_correction_input_seals
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.candidate_release_correction_discharges
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.candidate_release_import_receipts
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.active_corpus_release_pointer_history
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON TABLE canonical_v2_staging.active_corpus_release_pointers
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.enforce_market_metric_slot_partition()
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_import_candidate_release(text, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
GRANT EXECUTE ON FUNCTION public.canonical_v2_import_candidate_release(text, jsonb)
  TO canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_rollback_inactive_candidate_release(
  text, text, text, text, text
) FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
GRANT EXECUTE ON FUNCTION public.canonical_v2_rollback_inactive_candidate_release(
  text, text, text, text, text
) TO canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_activate_candidate_release(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
GRANT EXECUTE ON FUNCTION public.canonical_v2_activate_candidate_release(text, jsonb, jsonb)
  TO canonical_v2_writer;
REVOKE ALL ON FUNCTION public.canonical_v2_active_release(text)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_active_release(text)
  TO canonical_v2_serving;
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
  text, text, text, text, text, text, text, text, text, text, text, integer, text, text
) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.canonical_v2_query_page(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text, text, integer, text, text
) FROM canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_active_query_page(
  text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text, text, integer, text, text
) FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_active_query_page(
  text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, integer, integer, numeric, numeric, numeric, numeric,
  text, text, text, text, text, text, text, text, text, text, text, integer, text, text
) TO canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_active_review_context(
  text, text, text, uuid, integer, text
) FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_active_review_context(
  text, text, text, uuid, integer, text
) TO canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_exact_detail(
  text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
GRANT EXECUTE ON FUNCTION public.canonical_v2_exact_detail(
  text, text, text, text, uuid, text, text
) TO canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_reviewed_deal_context(
  text, text, text, text, text, text, integer, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_v2_reviewed_deal_context(
  text, text, text, text, text, text, integer, text
) TO canonical_v2_serving;
