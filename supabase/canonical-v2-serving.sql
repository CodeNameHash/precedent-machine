-- Additive, staging-only serving projection. This file is not a production migration.

CREATE SCHEMA IF NOT EXISTS canonical_v2_staging;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'canonical_v2_serving') THEN
    CREATE ROLE canonical_v2_serving NOLOGIN;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS canonical_v2_staging.fixture_corpus_releases (
  corpus_release_id text PRIMARY KEY CHECK (corpus_release_id ~ '^[a-f0-9]{64}$'),
  candidate_manifest_id text NOT NULL CHECK (candidate_manifest_id ~ '^[a-f0-9]{64}$'),
  frozen_pair_id text NOT NULL CHECK (frozen_pair_id ~ '^[a-f0-9]{64}$'),
  contract_fingerprint text NOT NULL CHECK (contract_fingerprint ~ '^[a-f0-9]{64}$'),
  projection_version text NOT NULL CHECK (projection_version = 'canonical-v2-serving/v1'),
  response_schema_version text NOT NULL CHECK (response_schema_version = 'MARKET_COHORT_RESULT/V1'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text NOT NULL CHECK (canonical_payload_digest ~ '^[a-f0-9]{64}$')
);

CREATE TABLE IF NOT EXISTS canonical_v2_staging.market_observations (
  serving_namespace_id text NOT NULL CHECK (serving_namespace_id ~ '^[a-f0-9]{64}$'),
  corpus_release_id text NOT NULL REFERENCES canonical_v2_staging.fixture_corpus_releases(corpus_release_id),
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

ALTER TABLE canonical_v2_staging.fixture_corpus_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE canonical_v2_staging.market_metric_slot_exclusions ENABLE ROW LEVEL SECURITY;

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
      count(DISTINCT governed_deal_key) FILTER (WHERE examination_state = 'EXAMINED')::integer AS examined_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE claim_state = 'PRESENT' AND examination_state = 'EXAMINED')::integer AS present_deals,
      count(DISTINCT governed_deal_key) FILTER (WHERE comparable)::integer AS comparable_deals,
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

REVOKE ALL ON TABLE canonical_v2_staging.fixture_corpus_releases
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
REVOKE ALL ON TABLE canonical_v2_staging.market_observations
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
REVOKE ALL ON TABLE canonical_v2_staging.market_metric_slot_exclusions
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_serving;
REVOKE ALL ON FUNCTION public.canonical_v2_market_cohort(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, text, integer, integer, numeric, numeric
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_v2_market_cohort(
  text, text, text, text, text, text, integer, text, text, text, text, text,
  text, text, text, text, text, text, integer, integer, numeric, numeric
) TO canonical_v2_serving;
