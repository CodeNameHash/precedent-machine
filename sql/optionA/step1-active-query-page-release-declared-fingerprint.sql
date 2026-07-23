-- Step-1 widening: canonical_v2_active_query_page (release-declared
-- fingerprint fix, SPEC-CONTRACT-AMENDMENT-PATH-2026-07-23.md option 1).
-- Extracted VERBATIM from supabase/canonical-v2-serving.sql; extractor-
-- enforced sha256 a50721d5ed81c3d4c57af9d32b7558fd296fa8060d35c31959e1c8a4f1fdece4.
-- Idempotent CREATE OR REPLACE, additive; F1 serving unaffected. Run in the
-- STAGING SQL Editor, then the verification SELECT below must return
-- three true values.
BEGIN;
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
COMMIT;

select
  to_regprocedure('public.canonical_v2_active_query_page(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)') is not null as active_query_rpc_exists,
  pg_get_functiondef('public.canonical_v2_active_query_page(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)'::regprocedure) like '%release_contract_fingerprint%' as resolves_release_declared_fingerprint,
  pg_get_functiondef('public.canonical_v2_active_query_page(text,text,text,text,integer,text,text,text,text,text,text,text,text,text,text,integer,integer,numeric,numeric,numeric,numeric,text,text,text,text,text,text,text,text,text,text,text,integer,text,text)'::regprocedure) like '%FROM canonical_v2_staging.fixture_corpus_releases release%' as reads_fixture_corpus_releases;
