BEGIN;

CREATE TABLE IF NOT EXISTS canonical_v2_staging.product_candidate_results (
  candidate_product_result_id text PRIMARY KEY
    CHECK (candidate_product_result_id ~ '^[0-9a-f]{64}$'),
  candidate_release_manifest_id text NOT NULL
    CHECK (candidate_release_manifest_id ~ '^[0-9a-f]{64}$'),
  corpus_release_id text NOT NULL
    CHECK (corpus_release_id ~ '^[0-9a-f]{64}$'),
  product_query_result_identity text NOT NULL
    CHECK (product_query_result_identity ~ '^[0-9a-f]{64}$'),
  domain_result_identity text NOT NULL
    CHECK (domain_result_identity ~ '^[0-9a-f]{64}$'),
  candidate_state text NOT NULL
    CHECK (candidate_state = 'CANDIDATE_NOT_ACTIVE'),
  canonical_payload jsonb NOT NULL,
  canonical_payload_digest text GENERATED ALWAYS AS (
    canonical_v2_staging.payload_digest(canonical_payload)
  ) STORED
);
ALTER TABLE canonical_v2_staging.product_candidate_results
  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE canonical_v2_staging.product_candidate_results
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;

ALTER TABLE canonical_v2_staging.write_receipts
  DROP CONSTRAINT IF EXISTS write_receipts_operation_check;
ALTER TABLE canonical_v2_staging.write_receipts
  ADD CONSTRAINT write_receipts_operation_check CHECK (operation IN (
    'FIXTURE_DEAL_EXTRACTION_RUN',
    'FIXTURE_CORRECTION_AUTHORITY',
    'INTAKE_CAPTURE',
    'STAGE_SOURCE_ARTIFACT_CHUNK',
    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN',
    'PRODUCT_RESULT_CANDIDATE_RUN'
  ));

CREATE INDEX IF NOT EXISTS canonical_v2_product_candidate_release_idx
  ON canonical_v2_staging.product_candidate_results(
    candidate_release_manifest_id,
    product_query_result_identity
  );

CREATE OR REPLACE FUNCTION canonical_v2_staging.validate_process_phrasebook_product_carrier(
  p_carrier jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, canonical_v2_staging
AS $$
DECLARE
  c jsonb := p_carrier->'pilot_product_authority_context';
  i jsonb := p_carrier->'pilot_product_authority_context_input';
  b jsonb := p_carrier->'pilot_product_authority_context_input'->'compiled_contract_bundle';
  m jsonb := p_carrier->'pilot_product_authority_context_input'->'candidate_release_manifest';
  w jsonb := p_carrier->'complete_write_set';
BEGIN
  IF jsonb_typeof(p_carrier) IS DISTINCT FROM 'object'
    OR p_carrier - ARRAY['schema_version','process_phrasebook_product_chain_id','process_phrasebook_product_chain_payload_digest','complete_write_set','pilot_product_authority_context','pilot_product_authority_context_input']::text[] <> '{}'::jsonb
    OR NOT p_carrier ?& ARRAY['schema_version','process_phrasebook_product_chain_id','process_phrasebook_product_chain_payload_digest','complete_write_set','pilot_product_authority_context','pilot_product_authority_context_input']
    OR p_carrier->>'schema_version' IS DISTINCT FROM 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1'
    OR jsonb_typeof(c) IS DISTINCT FROM 'object'
    OR jsonb_typeof(i) IS DISTINCT FROM 'object'
    OR jsonb_typeof(b) IS DISTINCT FROM 'object'
    OR jsonb_typeof(m) IS DISTINCT FROM 'object'
    OR jsonb_typeof(w) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'invalid SQL-native Process Product authority carrier' USING ERRCODE = '23514'; END IF;

  IF c - ARRAY['schema_version','authority_context_id','approved_pm_data_version_id','canonical_contract_bundle','candidate_release_manifest','product_field_catalogue_manifest','product_field_catalogue_query_admission','product_navigation_catalogue_manifest','product_navigation_catalogue_query_admission','predicate_catalogue_bindings','predicate_admissions','product_query_admission_context','certification_identities','authority_limits']::text[] <> '{}'::jsonb
    OR NOT c ?& ARRAY['schema_version','authority_context_id','approved_pm_data_version_id','canonical_contract_bundle','candidate_release_manifest','product_field_catalogue_manifest','product_field_catalogue_query_admission','product_navigation_catalogue_manifest','product_navigation_catalogue_query_admission','predicate_catalogue_bindings','predicate_admissions','product_query_admission_context','certification_identities','authority_limits']
    OR c->>'schema_version' IS DISTINCT FROM 'PILOT_PRODUCT_AUTHORITY_CONTEXT/V1'
    OR c->>'authority_context_id' IS DISTINCT FROM '2eb112eadb276fec43be7c86bab26b9abc65d584ae1a23ba041965ed4fe0a669'
    OR c->>'authority_context_id' IS DISTINCT FROM canonical_v2_staging.content_id('PILOT_PRODUCT_AUTHORITY_CONTEXT/V1',c-'authority_context_id')
    OR c->>'approved_pm_data_version_id' IS DISTINCT FROM '750d74d401f174d5c9437d7f5fb7e6ac908dab8ae1366ca73c1e34c0d7e873fd'
    OR c->'authority_limits' IS DISTINCT FROM '{"activation":"NONE","database_write":"NONE","extraction":"NONE","import":"NONE","materialisation":"NONE","production":"NONE","query_execution":"NONE","release":"NONE","serving":"NONE","source_read":"NONE","writer":"NONE"}'::jsonb
  THEN RAISE EXCEPTION 'invalid SQL-native Process Product authority carrier' USING ERRCODE = '23514'; END IF;

  IF i - ARRAY['canonical_contract_input_compilation','compiled_contract_bundle','candidate_release_manifest']::text[] <> '{}'::jsonb
    OR NOT i ?& ARRAY['canonical_contract_input_compilation','compiled_contract_bundle','candidate_release_manifest']
    OR i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_id' IS DISTINCT FROM '0d74f2f40600863ae474efdaa876215fb752c44463fc5aa0ec8114db61477416'
    OR i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_payload_digest' IS DISTINCT FROM '4dd9971ff5954b879b5b079e4a154a1175f8c61f3882ef68d02d9e2174df8343'
    OR b->>'schema_version' IS DISTINCT FROM 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1'
    OR b->>'contract_bundle_id' IS DISTINCT FROM 'd222eba830fefad4772e358041e36f8818dbf227e4c7e13c77f4228514a37d8e'
    OR b->>'contract_bundle_digest' IS DISTINCT FROM 'a953a215f9ff4cf94a204580b3b9a2b559fa531d1f3be16a3e787032257e87b3'
    OR b->>'canonical_payload_digest' IS DISTINCT FROM '36762abe8f4dd666df0d9aa66760d8c4e41971fab633764108ee54f73d5c8d73'
    OR b->>'canonical_payload_digest' IS DISTINCT FROM canonical_v2_staging.content_id('CANONICAL_CONTRACT_BUNDLE_COMPILATION_PAYLOAD/V1',b-ARRAY['schema_version','canonical_payload_digest','disposition']::text[])
    OR b->'compile_report'->>'status' IS DISTINCT FROM 'PASS'
    OR b->'dependency_cycle_report'->>'status' IS DISTINCT FROM 'PASS'
    OR (b->'compile_report'->>'missing_member_count')::integer IS DISTINCT FROM 0
    OR (b->'compile_report'->>'extra_member_count')::integer IS DISTINCT FROM 0
    OR (b->'compile_report'->>'duplicate_identity_count')::integer IS DISTINCT FROM 0
    OR (b->'compile_report'->>'conflict_count')::integer IS DISTINCT FROM 0
    OR (b->'dependency_cycle_report'->>'unresolved_dependency_count')::integer IS DISTINCT FROM 0
    OR (b->'dependency_cycle_report'->>'cycle_count')::integer IS DISTINCT FROM 0
    OR b->'disposition' IS DISTINCT FROM '{"activation_authority":"NONE","database_authority":"NONE","freeze_authority":"NONE","production_authority":"NONE","release_authority":"NONE","schema_version":"CANONICAL_CONTRACT_BUNDLE_COMPILATION_DISPOSITION/V1","serving_authority":"NONE","signing_authority":"NONE","status":"COMPILED_NOT_FROZEN","writer_authority":"NONE"}'::jsonb
    OR c->'canonical_contract_bundle' IS DISTINCT FROM jsonb_build_object('contract_bundle_id',b->>'contract_bundle_id','contract_bundle_digest',b->>'contract_bundle_digest','canonical_payload_digest',b->>'canonical_payload_digest')
  THEN RAISE EXCEPTION 'invalid SQL-native Process Product authority carrier' USING ERRCODE = '23514'; END IF;

  IF m->>'schema_version' IS DISTINCT FROM 'FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3'
    OR m->>'candidate_release_manifest_id' IS DISTINCT FROM canonical_v2_staging.content_id('FIXTURE_CANDIDATE_RELEASE_MANIFEST/V3',m-ARRAY['candidate_release_manifest_id','canonical_payload_digest']::text[])
    OR m->>'canonical_payload_digest' IS DISTINCT FROM canonical_v2_staging.content_id('FIXTURE_CANDIDATE_RELEASE_MANIFEST_PAYLOAD/V3',m-ARRAY['candidate_release_manifest_id','canonical_payload_digest']::text[])
    OR c->'candidate_release_manifest' IS DISTINCT FROM jsonb_build_object('candidate_release_manifest_id',m->>'candidate_release_manifest_id','canonical_payload_digest',m->>'canonical_payload_digest','corpus_release_id',m->>'corpus_release_id')
    OR c->'product_query_admission_context'->>'approved_pm_data_version_id' IS DISTINCT FROM c->>'approved_pm_data_version_id'
    OR c->'product_query_admission_context'->>'candidate_release_manifest_id' IS DISTINCT FROM m->>'candidate_release_manifest_id'
    OR c->'product_query_admission_context'->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM m->>'canonical_payload_digest'
    OR c->'product_query_admission_context'->'canonical_contract_identity'->>'payload_digest' IS DISTINCT FROM b->>'canonical_payload_digest'
    OR w->'candidate_release_binding'->>'candidate_release_manifest_id' IS DISTINCT FROM m->>'candidate_release_manifest_id'
    OR w->'candidate_release_binding'->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM m->>'canonical_payload_digest'
    OR w->'candidate_release_binding'->>'corpus_release_id' IS DISTINCT FROM m->>'corpus_release_id'
    OR w->'product_row'->'product_query_ir'->'release_contract'->>'approved_pm_data_version_id' IS DISTINCT FROM c->>'approved_pm_data_version_id'
    OR w->'product_row'->'product_query_ir'->'release_contract'->>'candidate_release_manifest_id' IS DISTINCT FROM m->>'candidate_release_manifest_id'
    OR w->'product_row'->'product_query_ir'->'release_contract'->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM m->>'canonical_payload_digest'
  THEN RAISE EXCEPTION 'invalid SQL-native Process Product authority carrier' USING ERRCODE = '23514'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(
  p_carrier jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, canonical_v2_staging
AS $$
DECLARE
  e jsonb := p_carrier->'agreement_candidate_envelope';
  m jsonb := p_carrier->'product_materialisation';
  q jsonb := p_carrier->'product_materialisation'->'product_query_ir';
  r jsonb := p_carrier->'product_materialisation'->'product_query_result';
  o jsonb := p_carrier->'product_materialisation'->'agreement_ordering_projection';
  s jsonb := p_carrier->'product_materialisation'->'product_result_set';
  p jsonb := p_carrier->'product_materialisation'->'product_result_presentation';
  u jsonb := p_carrier->'product_materialisation'->'product_result_surfaces';
  v jsonb := p_carrier->'product_materialisation'->'product_evaluation_evidence';
  b jsonb := p_carrier->'product_materialisation'->'candidate_release_binding';
  x jsonb := p_carrier->'product_materialisation'->'evidence_sidecar';
  action text;
  result_id text;
  result_version integer;
  profile_digest text;
  slots jsonb;
  core jsonb;
  summary jsonb;
BEGIN
  IF jsonb_typeof(p_carrier) IS DISTINCT FROM 'object'
    OR p_carrier - ARRAY['schema_version','agreement_candidate_envelope_id','agreement_candidate_envelope_carrier_id','agreement_candidate_envelope_carrier_payload_digest','agreement_candidate_envelope_payload_digest','agreement_candidate_envelope','product_materialisation']::text[] <> '{}'::jsonb
    OR NOT p_carrier ?& ARRAY['schema_version','agreement_candidate_envelope_id','agreement_candidate_envelope_carrier_id','agreement_candidate_envelope_carrier_payload_digest','agreement_candidate_envelope_payload_digest','agreement_candidate_envelope','product_materialisation']
    OR p_carrier->>'schema_version' IS DISTINCT FROM 'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1'
    OR jsonb_typeof(e) IS DISTINCT FROM 'object' OR jsonb_typeof(m) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF e - ARRAY['schema_version','agreement_candidate_envelope_id','contract_stable_id','contract_definition_digest','family_profile_id','family_profile_digest','source_projection_id','source_projection_payload_digest','source_projection','provision_row','ordered_terminals','product_membership','candidate_state','authority_state']::text[] <> '{}'::jsonb
    OR NOT e ?& ARRAY['schema_version','agreement_candidate_envelope_id','contract_stable_id','contract_definition_digest','family_profile_id','family_profile_digest','source_projection_id','source_projection_payload_digest','source_projection','provision_row','ordered_terminals','product_membership','candidate_state','authority_state']
    OR e->>'schema_version' IS DISTINCT FROM 'AGREEMENT_CANDIDATE_ENVELOPE/V1'
    OR e->>'candidate_state' IS DISTINCT FROM 'VALIDATED_NOT_MATERIALISED'
    OR e->>'authority_state' IS DISTINCT FROM 'NONE'
    OR jsonb_typeof(e->'ordered_terminals') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF e->>'family_profile_id' = 'CAPITALISATION_BRING_DOWN_V3' THEN
    action := 'RESULT_COMPOSITION_EVIDENCE'; result_id := 'TARGET_CAPITALISATION_BRING_DOWN'; result_version := 3;
    profile_digest := 'b50cd48ed037aecb5b294a01f80232e558695f433f0b7ee78ff21c3e0bdb1b1f';
    slots := '[{"ordinal":0,"metric_key":"REPRESENTATION_ACCURACY_STANDARD","value_slot_key":"CAPITALISATION_CLAUSE_B_LIMBS_I_III","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":1,"metric_key":"REPRESENTATION_ACCURACY_EXCEPTION","value_slot_key":"CAPITALISATION_CLAUSE_B_LIMBS_I_III","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":2,"metric_key":"REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR","value_slot_key":"CAPITALISATION_CLAUSE_B_LIMBS_I_III","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":3,"metric_key":"DATED_REPRESENTATION_TREATMENT","value_slot_key":"CAPITALISATION_CLAUSE_B_LIMBS_I_III","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":4,"metric_key":"REPRESENTATION_MATERIALITY_SCRAPE","value_slot_key":"CAPITALISATION_CLAUSE_B_LIMBS_I_III","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":5,"metric_key":"REPRESENTATION_ACCURACY_STANDARD","value_slot_key":"CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":6,"metric_key":"REPRESENTATION_ACCURACY_EXCEPTION","value_slot_key":"CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":7,"metric_key":"REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR","value_slot_key":"CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V","subject_terminal_kind":"MARKET_METRIC_SLOT_EXCLUSION"},{"ordinal":8,"metric_key":"DATED_REPRESENTATION_TREATMENT","value_slot_key":"CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":9,"metric_key":"REPRESENTATION_MATERIALITY_SCRAPE","value_slot_key":"CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":10,"metric_key":"REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET","value_slot_key":"CAPITALISATION_MEASUREMENT_DATE","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":11,"metric_key":"KNOWLEDGE_QUALIFIER_STATE","value_slot_key":"GENERAL_KNOWLEDGE_QUALIFIER","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":12,"metric_key":"GENERAL_MATERIALITY_QUALIFIER_STATE","value_slot_key":"GENERAL_MATERIALITY_QUALIFIER","subject_terminal_kind":"MARKET_OBSERVATION"},{"ordinal":13,"metric_key":"RETROSPECTIVE_LOOKBACK_STATE","value_slot_key":"RETROSPECTIVE_LOOKBACK","subject_terminal_kind":"MARKET_OBSERVATION"}]'::jsonb;
  ELSIF e->>'family_profile_id' = 'IOC_CAPEX_RESTRICTION_V1' THEN
    action := 'RESULT_COMPONENT_CLAIM_EVIDENCE'; result_id := 'TARGET_CAPEX_RESTRICTION'; result_version := 1;
    profile_digest := '0feb56b59f9d1016940c817e114c6214e7fc9f1cf9f82e7bed77e6855ddf2a93';
    slots := '[{"ordinal":0,"metric_key":"IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE","value_slot_key":"CAPEX_THRESHOLD","subject_terminal_kind":"MARKET_OBSERVATION"}]'::jsonb;
  ELSE RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF e->>'family_profile_digest' IS DISTINCT FROM profile_digest
    OR jsonb_typeof(e->'provision_row') IS DISTINCT FROM 'object'
    OR e->'provision_row' IS DISTINCT FROM e->'source_projection'->'provision_row'->'payload'
    OR jsonb_typeof(e->'product_membership') IS DISTINCT FROM 'object'
    OR (e->'product_membership') - ARRAY['domain_key','membership_state','result_definition_stable_id','result_definition_version','domain_result_identity','domain_result_payload_digest']::text[] <> '{}'::jsonb
    OR NOT (e->'product_membership') ?& ARRAY['domain_key','membership_state','result_definition_stable_id','result_definition_version','domain_result_identity','domain_result_payload_digest']
    OR e->'product_membership'->>'domain_key' IS DISTINCT FROM 'AGREEMENT'
    OR e->'product_membership'->>'membership_state' IS DISTINCT FROM 'CANDIDATE_ENVELOPE_ONLY'
    OR e->'product_membership'->>'result_definition_stable_id' IS DISTINCT FROM result_id
    OR (e->'product_membership'->>'result_definition_version')::integer IS DISTINCT FROM result_version
    OR e->>'agreement_candidate_envelope_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_CANDIDATE_ENVELOPE/V1',e-ARRAY['schema_version','agreement_candidate_envelope_id']::text[])
    OR p_carrier->>'agreement_candidate_envelope_carrier_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1',p_carrier-ARRAY['agreement_candidate_envelope_carrier_id','agreement_candidate_envelope_carrier_payload_digest']::text[])
    OR p_carrier->>'agreement_candidate_envelope_carrier_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(p_carrier-ARRAY['agreement_candidate_envelope_carrier_id','agreement_candidate_envelope_carrier_payload_digest']::text[]),'UTF8'),'sha256'::text),'hex')
    OR e->'source_projection'->>'source_projection_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_CANDIDATE_ENVELOPE_SOURCE_PROJECTION/V1',(e->'source_projection')-ARRAY['schema_version','source_projection_id','source_projection_payload_digest']::text[])
    OR e->'source_projection'->>'source_projection_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json((e->'source_projection')-ARRAY['schema_version','source_projection_id','source_projection_payload_digest']::text[]),'UTF8'),'sha256'::text),'hex')
    OR e->>'source_projection_id' IS DISTINCT FROM e->'source_projection'->>'source_projection_id'
    OR e->>'source_projection_payload_digest' IS DISTINCT FROM e->'source_projection'->>'source_projection_payload_digest'
    OR e->'source_projection'->'provision_row'->>'payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(e->'source_projection'->'provision_row'->'payload'),'UTF8'),'sha256'::text),'hex')
    OR e->'product_membership'->>'domain_result_identity' IS DISTINCT FROM e->'source_projection'->'provision_row'->>'id'
    OR e->'product_membership'->>'domain_result_payload_digest' IS DISTINCT FROM e->'source_projection'->'provision_row'->>'payload_digest'
    OR jsonb_array_length(e->'ordered_terminals') <> jsonb_array_length(slots)
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(e->'ordered_terminals') WITH ORDINALITY AS a(value,n)
    JOIN jsonb_array_elements(slots) WITH ORDINALITY AS z(value,n) USING(n)
    JOIN jsonb_array_elements(e->'source_projection'->'ordered_terminals') WITH ORDINALITY AS y(value,n) USING(n)
    WHERE jsonb_typeof(a.value) IS DISTINCT FROM 'object'
      OR a.value-ARRAY['schema_version','terminal_id','terminal_payload_digest','family_profile_id','ordinal','metric_key','value_slot_key','subject_terminal_kind','subject_terminal_id','subject_terminal_payload_digest','subject_terminal']::text[] <> '{}'::jsonb
      OR a.value->>'schema_version' IS DISTINCT FROM 'AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1'
      OR (a.value->>'ordinal')::integer IS DISTINCT FROM n-1
      OR a.value->>'family_profile_id' IS DISTINCT FROM e->>'family_profile_id'
      OR a.value->>'metric_key' IS DISTINCT FROM z.value->>'metric_key'
      OR a.value->>'value_slot_key' IS DISTINCT FROM z.value->>'value_slot_key'
      OR a.value->>'subject_terminal_kind' IS DISTINCT FROM z.value->>'subject_terminal_kind'
      OR jsonb_typeof(a.value->'subject_terminal') IS DISTINCT FROM 'object'
      OR a.value->>'subject_terminal_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(a.value->'subject_terminal'),'UTF8'),'sha256'::text),'hex')
      OR a.value->>'subject_terminal_id' IS DISTINCT FROM COALESCE(
        a.value->'subject_terminal'->>'market_observation_id',
        a.value->'subject_terminal'->>'market_observation_serving_key',
        a.value->'subject_terminal'->>'market_metric_slot_exclusion_id'
      )
      OR a.value->>'terminal_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_CANDIDATE_ENVELOPE_TERMINAL/V1',a.value-ARRAY['schema_version','terminal_id','terminal_payload_digest','subject_terminal']::text[])
      OR a.value->>'terminal_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(a.value-ARRAY['schema_version','terminal_id','terminal_payload_digest','subject_terminal']::text[]),'UTF8'),'sha256'::text),'hex')
      OR a.value->>'subject_terminal_id' IS DISTINCT FROM y.value->>'id')
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF m-ARRAY['schema_version','agreement_candidate_product_materialisation_id','agreement_candidate_envelope_id','candidate_release_binding','product_query_ir','product_query_result','agreement_ordering_projection','product_result_set','product_result_presentation','product_result_surfaces','product_evaluation_evidence','evidence_sidecar','materialisation_state','authority_state']::text[] <> '{}'::jsonb
    OR m->>'agreement_candidate_product_materialisation_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1',m-ARRAY['schema_version','agreement_candidate_product_materialisation_id']::text[])
    OR m->>'agreement_candidate_envelope_id' IS DISTINCT FROM e->>'agreement_candidate_envelope_id'
    OR m->>'materialisation_state' IS DISTINCT FROM 'VALIDATED_NOT_PERSISTED' OR m->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    OR b-ARRAY['approved_pm_data_version_id','candidate_release_manifest_id','candidate_release_manifest_payload_digest','corpus_release_id','product_query_definition_id','release_state','authority_state']::text[] <> '{}'::jsonb
    OR b->>'release_state' IS DISTINCT FROM 'CANDIDATE_NOT_ACTIVE' OR b->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    OR b->>'corpus_release_id' IS DISTINCT FROM '81afb231fdd2884e4f643ec90f9f71efb6e201c9b4d350e8394f4a020bb235ed'
    OR q-ARRAY['schema_version','query_definition_id','release_contract','semantic_contract','cohort_contract','filter_contract','presentation_contract','pagination_contract','detail_action_contract','coverage_contract']::text[] <> '{}'::jsonb
    OR q->>'query_definition_id' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_QUERY_IR/V1',q-'query_definition_id')
    OR q->'release_contract'->>'approved_pm_data_version_id' IS DISTINCT FROM '34f6a3c0471f8265b021c46251b0cc5da554e58da0c8f953aa3baaeea3fc6435'
    OR q->'release_contract'->>'candidate_release_manifest_id' IS DISTINCT FROM 'e88a71afe109f789b26dafe25200c8994fe92db02ae71c76107c00da3c0a6944'
    OR q->'release_contract'->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM '5db5d788480c9c2202650f9efc854e57e42c0f8e4c3a8c19b346847537406da0'
    OR q->'semantic_contract'->>'domain_key' IS DISTINCT FROM 'AGREEMENT'
    OR q->'semantic_contract'->>'predicate_key' IS DISTINCT FROM result_id
    OR q->'semantic_contract'->'result_definition'->>'stable_id' IS DISTINCT FROM result_id
    OR (q->'semantic_contract'->'result_definition'->>'version')::integer IS DISTINCT FROM result_version
    OR q->'detail_action_contract'->'actions' IS DISTINCT FROM jsonb_build_array(action)
    OR b->>'product_query_definition_id' IS DISTINCT FROM q->>'query_definition_id'
    OR b->>'candidate_release_manifest_id' IS DISTINCT FROM q->'release_contract'->>'candidate_release_manifest_id'
    OR b->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM q->'release_contract'->>'candidate_release_manifest_payload_digest'
    OR (e->>'family_profile_id'='IOC_CAPEX_RESTRICTION_V1' AND (q->'presentation_contract'->'sort' IS DISTINCT FROM '[]'::jsonb OR q->'presentation_contract'->'requested_columns' IS DISTINCT FROM '[{"field_key":"deal","field_version":1}]'::jsonb))
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF r-ARRAY['schema_version','product_query_result_identity','product_query_definition_id','approved_pm_data_version_id','candidate_release_manifest_id','candidate_release_manifest_payload_digest','domain_key','domain_result_definition','domain_result_identity','domain_result_payload','domain_result_payload_digest','domain_result_validation','domain_result_source_representation_kind','exact_citation','exact_detail_action','query_provenance','result_fields']::text[] <> '{}'::jsonb
    OR r->>'product_query_result_identity' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_QUERY_RESULT/V1',jsonb_build_object('schema_version','PRODUCT_QUERY_RESULT/V1','product_query_definition_id',q->>'query_definition_id','approved_pm_data_version_id',q->'release_contract'->>'approved_pm_data_version_id','candidate_release_manifest_id',q->'release_contract'->>'candidate_release_manifest_id','candidate_release_manifest_payload_digest',q->'release_contract'->>'candidate_release_manifest_payload_digest','domain_key','AGREEMENT','domain_result_definition_stable_id',r->'domain_result_definition'->>'stable_id','domain_result_definition_version',(r->'domain_result_definition'->>'version')::integer,'domain_result_identity',r->>'domain_result_identity'))
    OR r->>'product_query_definition_id' IS DISTINCT FROM q->>'query_definition_id'
    OR r->>'domain_result_identity' IS DISTINCT FROM e->'product_membership'->>'domain_result_identity'
    OR r->>'domain_result_payload_digest' IS DISTINCT FROM e->'product_membership'->>'domain_result_payload_digest'
    OR r->>'domain_result_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(r->'domain_result_payload'),'UTF8'),'sha256'::text),'hex')
    OR r->>'exact_detail_action' IS DISTINCT FROM action
    OR r->'exact_citation'->>'citation_target_identity' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_EXACT_CITATION/V1',jsonb_build_object('product_query_result_identity',r->>'product_query_result_identity','candidate_release_manifest_id',r->>'candidate_release_manifest_id','candidate_release_manifest_payload_digest',r->>'candidate_release_manifest_payload_digest','source_document_identity',r->'exact_citation'->>'source_document_identity','source_evidence_identity',r->'exact_citation'->>'source_evidence_identity'))
    OR r->'exact_citation'->'source_interval' IS DISTINCT FROM 'null'::jsonb
    OR x->'exact_citation' IS DISTINCT FROM r->'exact_citation'
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  summary := jsonb_build_object('schema_version','PRODUCT_QUERY_EXECUTION_SUMMARY/V1','product_query_definition_id',q->>'query_definition_id','query_coverage_identity',q->'coverage_contract'->>'coverage_identity','coverage_certification_state',v->'coverage_certification'->>'coverage_certification_state','coverage_certification_identity',v->'coverage_certification'->>'coverage_certification_identity','covered_deal_count',(v->'coverage_certification'->>'covered_deal_count')::integer,'excluded_deal_count',(v->'coverage_certification'->>'excluded_deal_count')::integer,'valid_result_count',1,'failed_result_count',0,'excluded_result_count',0,'total_result_count',1,'operational_state','COMPLETE');
  IF o-ARRAY['schema_version','ordering_projection_id','canonical_payload_digest','ordering_validator_stable_id','ordering_validator_version','product_query_definition_id','approved_pm_data_version_id','candidate_release_manifest_id','candidate_release_manifest_payload_digest','product_field_catalogue_id','product_field_catalogue_payload_digest','ordered_query_sort_vector','query_diversity_definition_id','query_diversity_payload_digest','ordering_contract_definition_digest','canonical_ordering_fact_set_digest','product_query_ir','product_field_catalogue_manifest','validated_ordering_facts','candidate_count','page_size','ordered_agreement_result_identities','first_page_agreement_result_identities','ordered_failed_agreement_result_identities','comparator_state','diversification_state','failure_state','no_padding_or_repetition','projection_state','serving_state','authority_limits']::text[] <> '{}'::jsonb
    OR NOT o ?& ARRAY['schema_version','ordering_projection_id','canonical_payload_digest','ordering_validator_stable_id','ordering_validator_version','product_query_definition_id','approved_pm_data_version_id','candidate_release_manifest_id','candidate_release_manifest_payload_digest','product_field_catalogue_id','product_field_catalogue_payload_digest','ordered_query_sort_vector','query_diversity_definition_id','query_diversity_payload_digest','ordering_contract_definition_digest','canonical_ordering_fact_set_digest','product_query_ir','product_field_catalogue_manifest','validated_ordering_facts','candidate_count','page_size','ordered_agreement_result_identities','first_page_agreement_result_identities','ordered_failed_agreement_result_identities','comparator_state','diversification_state','failure_state','no_padding_or_repetition','projection_state','serving_state','authority_limits']
    OR o->>'schema_version' IS DISTINCT FROM 'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION/V1'
    OR o->>'ordering_validator_stable_id' IS DISTINCT FROM 'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION'
    OR (o->>'ordering_validator_version')::integer IS DISTINCT FROM 1
    OR o->>'approved_pm_data_version_id' IS DISTINCT FROM q->'release_contract'->>'approved_pm_data_version_id'
    OR o->>'candidate_release_manifest_id' IS DISTINCT FROM q->'release_contract'->>'candidate_release_manifest_id'
    OR o->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM q->'release_contract'->>'candidate_release_manifest_payload_digest'
    OR o->>'product_field_catalogue_id' IS DISTINCT FROM '0248b28f36f69ba2cf08a6e4d648cfda5a1caed4a87a4f94ad134a4bab8093ee'
    OR o->>'product_field_catalogue_payload_digest' IS DISTINCT FROM 'e399949c1758b003a0f9155fe97dc8cea4d10941c3d665b7a42551f526246d52'
    OR o->'product_field_catalogue_manifest'->>'manifest_id' IS DISTINCT FROM o->>'product_field_catalogue_id'
    OR o->'product_field_catalogue_manifest'->>'canonical_payload_digest' IS DISTINCT FROM o->>'product_field_catalogue_payload_digest'
    OR o->'product_field_catalogue_manifest'->>'manifest_id' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_FIELD_CATALOGUE_MANIFEST/V1',(o->'product_field_catalogue_manifest')-ARRAY['manifest_id','canonical_payload_digest']::text[])
    OR o->'product_field_catalogue_manifest'->>'canonical_payload_digest' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_FIELD_CATALOGUE_MANIFEST_PAYLOAD/V1',(o->'product_field_catalogue_manifest')-ARRAY['manifest_id','canonical_payload_digest']::text[])
    OR o->'ordered_query_sort_vector' IS DISTINCT FROM q->'presentation_contract'->'sort'
    OR o->>'query_diversity_definition_id' IS DISTINCT FROM q->'presentation_contract'->'diversity'->>'definition_id'
    OR o->>'query_diversity_payload_digest' IS DISTINCT FROM q->'presentation_contract'->'diversity'->>'payload_digest'
    OR o->>'ordering_contract_definition_digest' IS DISTINCT FROM '17eb9ac896e0898febaf06618b6cbf0d23b43b9fedcbd204be325c52af8d8df0'
    OR o->>'canonical_ordering_fact_set_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(o->'validated_ordering_facts'),'UTF8'),'sha256'::text),'hex')
    OR (o->>'candidate_count')::integer IS DISTINCT FROM 1
    OR (o->>'page_size')::integer IS DISTINCT FROM 12
    OR o->'ordered_agreement_result_identities' IS DISTINCT FROM jsonb_build_array(r->>'domain_result_identity')
    OR o->'first_page_agreement_result_identities' IS DISTINCT FROM jsonb_build_array(r->>'domain_result_identity')
    OR o->'ordered_failed_agreement_result_identities' IS DISTINCT FROM '[]'::jsonb
    OR o->>'comparator_state' IS DISTINCT FROM 'GOVERNED_TYPED_TOTAL_COMPARATOR_APPLIED'
    OR o->>'diversification_state' IS DISTINCT FROM 'STABLE_GOVERNED_DEAL_ROUND_ROBIN_APPLIED'
    OR o->>'failure_state' IS DISTINCT FROM 'NO_ORDERING_FAILURES'
    OR (o->>'no_padding_or_repetition')::boolean IS DISTINCT FROM true
    OR o->>'projection_state' IS DISTINCT FROM 'ORDERING_ONLY'
    OR o->>'serving_state' IS DISTINCT FROM 'NOT_SERVED'
    OR o->'authority_limits' IS DISTINCT FROM '{"activation":"NONE","canonical_write":"NONE","database":"NONE","domain_result":"NONE","execution":"NONE","import":"NONE","ordering_fact_validation":"NONE","production":"NONE","query":"NONE","release":"NONE","result_materialisation":"NONE","serving":"NONE","source_read":"NONE","writer":"NONE"}'::jsonb
    OR o->'validated_ordering_facts' IS DISTINCT FROM v->'agreement_ordering_facts'
    OR (o->'validated_ordering_facts'->0)-ARRAY['schema_version','ordering_fact_id','fact_state','product_query_result_identity','agreement_comparable_result_identity','governed_deal_admission_id','sort_projections','external_field_projection_validation_receipt_id','external_candidate_membership_validation_receipt_id','ordering_failure','authority_state']::text[] <> '{}'::jsonb
    OR NOT (o->'validated_ordering_facts'->0) ?& ARRAY['schema_version','ordering_fact_id','fact_state','product_query_result_identity','agreement_comparable_result_identity','governed_deal_admission_id','sort_projections','external_field_projection_validation_receipt_id','external_candidate_membership_validation_receipt_id','ordering_failure','authority_state']
    OR o->'validated_ordering_facts'->0->>'schema_version' IS DISTINCT FROM 'AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT/V1'
    OR o->'validated_ordering_facts'->0->>'fact_state' IS DISTINCT FROM 'VALIDATED_SORT_PROJECTION'
    OR o->'validated_ordering_facts'->0->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    OR o->'validated_ordering_facts'->0->>'agreement_comparable_result_identity' IS DISTINCT FROM r->>'domain_result_identity'
    OR o->'validated_ordering_facts'->0->'ordering_failure' IS DISTINCT FROM 'null'::jsonb
    OR o->'validated_ordering_facts'->0->>'ordering_fact_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT/V1',(o->'validated_ordering_facts'->0)-'ordering_fact_id')
    OR o->>'ordering_projection_id' IS DISTINCT FROM canonical_v2_staging.content_id('AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION/V1',o-ARRAY['ordering_projection_id','canonical_payload_digest']::text[])
    OR o->>'canonical_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(o-ARRAY['ordering_projection_id','canonical_payload_digest']::text[]),'UTF8'),'sha256'::text),'hex')
    OR o->>'product_query_definition_id' IS DISTINCT FROM q->>'query_definition_id'
    OR o->'product_query_ir' IS DISTINCT FROM q OR jsonb_array_length(o->'validated_ordering_facts') <> 1
    OR o->'validated_ordering_facts'->0->>'product_query_result_identity' IS DISTINCT FROM r->>'product_query_result_identity'
    OR s-ARRAY['ordered_result_slots','query_execution_summary']::text[] <> '{}'::jsonb OR jsonb_array_length(s->'ordered_result_slots') <> 1
    OR s->'ordered_result_slots'->0->>'slot_identity' IS DISTINCT FROM r->>'product_query_result_identity'
    OR s->'ordered_result_slots'->0->'product_query_result' IS DISTINCT FROM r
    OR s->'query_execution_summary'->>'query_execution_summary_id' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_QUERY_EXECUTION_SUMMARY/V1',summary)
    OR (s->'query_execution_summary')-'query_execution_summary_id' IS DISTINCT FROM summary
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  core := jsonb_build_object('product_query_definition_id',q->>'query_definition_id','product_query_result_identity',r->>'product_query_result_identity','domain_result_identity',r->>'domain_result_identity','product_result_presentation_id',p->>'product_result_presentation_id','candidate_release_manifest_id',r->>'candidate_release_manifest_id','candidate_release_manifest_payload_digest',r->>'candidate_release_manifest_payload_digest','exact_citation_target_identity',r->'exact_citation'->>'citation_target_identity','exact_detail_action',action);
  IF p-ARRAY['schema_version','product_result_presentation_id','canonical_payload_digest','contract_bindings','identity_inputs','understood_legal_question','filter_sentence','view_contract','columns','ordered_product_result_slot_identities','result_slots','coverage','counts','empty_result','query_execution_summary_id','renderer_contract','authority_state']::text[] <> '{}'::jsonb
    OR u-ARRAY['schema_version','product_result_surface_binding_id','renderer_neutral_content_identity','surface_bindings','surface_state','authority_state']::text[] <> '{}'::jsonb
    OR p->>'product_result_presentation_id' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_RESULT_PRESENTATION/V1',p->'identity_inputs')
    OR p->>'canonical_payload_digest' IS DISTINCT FROM pg_catalog.encode(extensions.digest(pg_catalog.convert_to(canonical_v2_staging.canonical_json(p-ARRAY['product_result_presentation_id','canonical_payload_digest']::text[]),'UTF8'),'sha256'::text),'hex')
    OR p->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    OR p->'understood_legal_question' IS DISTINCT FROM v->'understood_legal_question'
    OR p->'filter_sentence' IS DISTINCT FROM jsonb_build_object('decorative_pill_collection',false,'edit_disposition','REQUIRES_NEW_CHECKED_QUERY','ordered_filter_segments','[]'::jsonb,'rendering_mode','ONE_COMPACT_PRACTITIONER_SENTENCE','subject',jsonb_build_object('domain_key','AGREEMENT','editable',true,'label',result_id,'predicate_key',result_id,'predicate_version',(q->'semantic_contract'->>'predicate_version')::integer))
    OR p->'view_contract' IS DISTINCT FROM '{"default_view":"ANSWER_FIRST_PASSAGES","permitted_views":["ANSWER_FIRST_PASSAGES","DENSE_TABLE"],"second_query_required_for_view_switch":false,"selected_view_is_payload_identity_input":false}'::jsonb
    OR p->'ordered_product_result_slot_identities' IS DISTINCT FROM jsonb_build_array(r->>'product_query_result_identity')
    OR p->'counts' IS DISTINCT FROM '{"emitted_result_slot_count":1,"excluded_result_count":0,"failed_result_count":0,"total_result_count":1,"valid_result_count":1}'::jsonb
    OR p->'empty_result' IS DISTINCT FROM '{"disposition":null,"market_absence_claim":false,"user_message":null}'::jsonb
    OR p->>'query_execution_summary_id' IS DISTINCT FROM s->'query_execution_summary'->>'query_execution_summary_id'
    OR p->'renderer_contract' IS DISTINCT FROM '{"generated_narrative_permitted":false,"passage_and_table_use_same_payload":true,"renderer_can_add_omit_reorder_or_change_content":false,"renderer_can_query_or_read_source":false}'::jsonb
    OR p->'result_slots'->0->>'product_query_result_identity' IS DISTINCT FROM r->>'product_query_result_identity'
    OR p->'result_slots'->0->'exact_citation' IS DISTINCT FROM r->'exact_citation'
    OR p->'result_slots'->0->>'exact_detail_action' IS DISTINCT FROM action
    OR u->>'renderer_neutral_content_identity' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_RESULT_SURFACE_BINDING/V1',core)
    OR u->>'product_result_surface_binding_id' IS DISTINCT FROM canonical_v2_staging.content_id('PRODUCT_RESULT_SURFACE_BINDING/V1',u-ARRAY['schema_version','product_result_surface_binding_id']::text[])
    OR u->>'surface_state' IS DISTINCT FROM 'VALIDATED_NOT_SERVED'
    OR u->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    OR (u->'surface_bindings')-ARRAY['COMPARE','CORPUS_CONTEXT','QUERY','REVIEW']::text[] <> '{}'::jsonb
    OR NOT u->'surface_bindings' ?& ARRAY['COMPARE','CORPUS_CONTEXT','QUERY','REVIEW']
    OR EXISTS (SELECT 1 FROM jsonb_each(u->'surface_bindings') AS h(name,value) WHERE value->>'surface' IS DISTINCT FROM name OR value->>'product_query_result_identity' IS DISTINCT FROM r->>'product_query_result_identity' OR value->>'product_result_presentation_id' IS DISTINCT FROM p->>'product_result_presentation_id' OR value->>'exact_detail_action' IS DISTINCT FROM action OR value->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED')
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;

  IF v->>'schema_version' IS DISTINCT FROM 'AGREEMENT_CANDIDATE_PRODUCT_EVALUATION_EVIDENCE/V1'
    OR v-ARRAY['schema_version','raw_product_query','ordered_result_fields','product_query_result_admission_receipt','agreement_ordering_facts','product_query_result_ordering_receipt','coverage_certification','understood_legal_question']::text[] <> '{}'::jsonb
    OR v->'raw_product_query'->>'predicate_key' IS DISTINCT FROM result_id
    OR v->'product_query_result_admission_receipt'->>'product_query_definition_id' IS DISTINCT FROM q->>'query_definition_id'
    OR v->'product_query_result_ordering_receipt'->>'domain_ordering_projection_identity' IS DISTINCT FROM o->>'ordering_projection_id'
    OR v->'coverage_certification'->>'query_coverage_identity' IS DISTINCT FROM q->'coverage_contract'->>'coverage_identity'
    OR x->>'source_projection_id' IS DISTINCT FROM e->>'source_projection_id'
    OR x->>'source_projection_payload_digest' IS DISTINCT FROM e->>'source_projection_payload_digest'
    OR x-ARRAY['exact_citation','source_projection_id','source_projection_payload_digest','exact_detail_package']::text[] <> '{}'::jsonb
  THEN RAISE EXCEPTION 'invalid SQL-native Agreement candidate Product materialisation' USING ERRCODE = '23514'; END IF;
END
$$;

REVOKE ALL ON FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.validate_process_phrasebook_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;

DO $migration$
DECLARE
  writer_definition text := pg_get_functiondef(
    'public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure
  );
  old_operation_tail text :=
$old$    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN'
  ) THEN$old$;
  new_operation_tail text :=
$new$    'PREPARE_SOURCE_ADMISSION',
    'DEAL_SCOPE_RUN',
    'PRODUCT_RESULT_CANDIDATE_RUN'
  ) THEN$new$;
  intake_marker text := '  IF p_operation = ''INTAKE_CAPTURE'' THEN';
  candidate_branch text :=
$branch$  IF p_operation = 'PRODUCT_RESULT_CANDIDATE_RUN' THEN
    IF p_write_set - ARRAY[
        'schema_version', 'adapter_identifier', 'domain_carrier'
      ]::text[] <> '{}'::jsonb
      OR NOT p_write_set ?& ARRAY[
        'schema_version', 'adapter_identifier', 'domain_carrier'
      ]
      OR p_write_set->>'schema_version'
        IS DISTINCT FROM 'PRODUCT_CANDIDATE_RESULT_WRITE_ENVELOPE/V1'
    THEN
      RAISE EXCEPTION 'invalid Product candidate-result write envelope'
        USING ERRCODE = '23514';
    END IF;
    IF p_write_set->>'adapter_identifier'
        = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' THEN
      PERFORM canonical_v2_staging.validate_process_phrasebook_product_carrier(
        p_write_set->'domain_carrier'
      );
      IF (p_write_set->'domain_carrier') - ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set',
          'pilot_product_authority_context',
          'pilot_product_authority_context_input'
        ]::text[] <> '{}'::jsonb
        OR NOT (p_write_set->'domain_carrier') ?& ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set',
          'pilot_product_authority_context',
          'pilot_product_authority_context_input'
        ]
        OR p_write_set->'domain_carrier'->>'schema_version'
          IS DISTINCT FROM 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1'
        OR p_write_set->'domain_carrier'
            ->>'process_phrasebook_product_chain_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1',
            (p_write_set->'domain_carrier') - ARRAY[
              'process_phrasebook_product_chain_id',
              'process_phrasebook_product_chain_payload_digest'
            ]::text[]
          )
        OR p_write_set->'domain_carrier'
            ->>'process_phrasebook_product_chain_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  (p_write_set->'domain_carrier') - ARRAY[
                    'process_phrasebook_product_chain_id',
                    'process_phrasebook_product_chain_payload_digest'
                  ]::text[]
                ),
                'UTF8'
              ),
              'sha256'::text
            ),
            'hex'
          )
      THEN
        RAISE EXCEPTION 'invalid Process Phrasebook Product chain carrier'
          USING ERRCODE = '23514';
      END IF;
      p_write_set := p_write_set->'domain_carrier'->'complete_write_set';
    ELSIF p_write_set->>'adapter_identifier'
        = 'AGREEMENT_CANDIDATE_ENVELOPE' THEN
      PERFORM canonical_v2_staging.validate_agreement_candidate_product_carrier(
        p_write_set->'domain_carrier'
      );
      IF p_write_set->'domain_carrier'->>'schema_version'
          IS DISTINCT FROM 'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1'
        OR p_write_set->'domain_carrier'
            ->>'agreement_candidate_envelope_carrier_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1',
            (p_write_set->'domain_carrier') - ARRAY[
              'agreement_candidate_envelope_carrier_id',
              'agreement_candidate_envelope_carrier_payload_digest'
            ]::text[]
          )
        OR p_write_set->'domain_carrier'
            ->>'agreement_candidate_envelope_carrier_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  (p_write_set->'domain_carrier') - ARRAY[
                    'agreement_candidate_envelope_carrier_id',
                    'agreement_candidate_envelope_carrier_payload_digest'
                  ]::text[]
                ),
                'UTF8'
              ),
              'sha256'::text
            ),
            'hex'
          )
        OR p_write_set->'domain_carrier'
            ->>'agreement_candidate_envelope_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  p_write_set->'domain_carrier'->'agreement_candidate_envelope'
                ),
                'UTF8'
              ),
              'sha256'::text
            ),
            'hex'
          )
        OR p_write_set->'domain_carrier'->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->'agreement_candidate_envelope'->>'agreement_candidate_envelope_id'
        OR p_write_set->'domain_carrier'->'agreement_candidate_envelope'
            ->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_ENVELOPE/V1',
            (p_write_set->'domain_carrier'->'agreement_candidate_envelope')
              - ARRAY['agreement_candidate_envelope_id', 'schema_version']::text[]
          )
      THEN
        RAISE EXCEPTION 'invalid Agreement candidate envelope carrier'
          USING ERRCODE = '23514';
      END IF;
      IF (p_write_set->'domain_carrier') - ARRAY[
          'schema_version', 'agreement_candidate_envelope_id',
          'agreement_candidate_envelope_carrier_id',
          'agreement_candidate_envelope_carrier_payload_digest',
          'agreement_candidate_envelope_payload_digest',
          'agreement_candidate_envelope', 'product_materialisation'
        ]::text[] <> '{}'::jsonb
        OR NOT (p_write_set->'domain_carrier') ?& ARRAY[
          'schema_version', 'agreement_candidate_envelope_id',
          'agreement_candidate_envelope_carrier_id',
          'agreement_candidate_envelope_carrier_payload_digest',
          'agreement_candidate_envelope_payload_digest',
          'agreement_candidate_envelope', 'product_materialisation'
        ]
        OR (p_write_set->'domain_carrier'->'product_materialisation') - ARRAY[
          'agreement_candidate_envelope_id',
          'agreement_candidate_product_materialisation_id',
          'agreement_ordering_projection', 'authority_state',
          'candidate_release_binding', 'evidence_sidecar',
          'materialisation_state', 'product_evaluation_evidence', 'product_query_ir',
          'product_query_result', 'product_result_presentation', 'product_result_set',
          'product_result_surfaces', 'schema_version'
        ]::text[] <> '{}'::jsonb
        OR NOT (p_write_set->'domain_carrier'->'product_materialisation') ?& ARRAY[
          'agreement_candidate_envelope_id',
          'agreement_candidate_product_materialisation_id',
          'agreement_ordering_projection', 'authority_state',
          'candidate_release_binding', 'evidence_sidecar',
          'materialisation_state', 'product_evaluation_evidence', 'product_query_ir',
          'product_query_result', 'product_result_presentation', 'product_result_set',
          'product_result_surfaces', 'schema_version'
        ]
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->>'schema_version'
          IS DISTINCT FROM 'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->>'agreement_candidate_envelope_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->>'materialisation_state'
          IS DISTINCT FROM 'VALIDATED_NOT_PERSISTED'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->>'authority_state'
          IS DISTINCT FROM 'NOT_GRANTED'
        OR (p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding') - ARRAY[
              'approved_pm_data_version_id', 'candidate_release_manifest_id',
              'candidate_release_manifest_payload_digest', 'corpus_release_id',
              'product_query_definition_id', 'release_state', 'authority_state'
            ]::text[] <> '{}'::jsonb
        OR NOT (p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding') ?& ARRAY[
              'approved_pm_data_version_id', 'candidate_release_manifest_id',
              'candidate_release_manifest_payload_digest', 'corpus_release_id',
              'product_query_definition_id', 'release_state', 'authority_state'
            ]
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->>'agreement_candidate_product_materialisation_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1',
            (p_write_set->'domain_carrier'->'product_materialisation') - ARRAY[
              'agreement_candidate_product_materialisation_id', 'schema_version'
            ]::text[]
          )
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'semantic_contract'->>'domain_key'
          IS DISTINCT FROM 'AGREEMENT'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'approved_pm_data_version_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'release_contract'->>'approved_pm_data_version_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'candidate_release_manifest_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'release_contract'->>'candidate_release_manifest_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'
              ->>'candidate_release_manifest_payload_digest'
          IS DISTINCT FROM p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'release_contract'
              ->>'candidate_release_manifest_payload_digest'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'product_query_definition_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->>'query_definition_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'release_state'
          IS DISTINCT FROM 'CANDIDATE_NOT_ACTIVE'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'authority_state'
          IS DISTINCT FROM 'NOT_GRANTED'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'candidate_release_binding'->>'corpus_release_id'
              !~ '^[0-9a-f]{64}$'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_result'->>'product_query_definition_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->>'query_definition_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_result'->>'domain_result_identity'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->'agreement_candidate_envelope'->'product_membership'
              ->>'domain_result_identity'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_result'->>'domain_result_payload_digest'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->'agreement_candidate_envelope'->'product_membership'
              ->>'domain_result_payload_digest'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'semantic_contract'->'result_definition'
              ->>'stable_id'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->'agreement_candidate_envelope'->'product_membership'
              ->>'result_definition_stable_id'
        OR p_write_set->'domain_carrier'->'product_materialisation'
            ->'product_query_ir'->'semantic_contract'->'result_definition'
              ->>'version'
          IS DISTINCT FROM p_write_set->'domain_carrier'
            ->'agreement_candidate_envelope'->'product_membership'
              ->>'result_definition_version'
        OR p_residuals IS DISTINCT FROM '[]'::jsonb
        OR p_quarantines IS DISTINCT FROM '[]'::jsonb
        OR (p_receipt->>'publishableObjectCount')::integer <> 1
        OR (p_receipt->>'residualCount')::integer <> 0
        OR (p_receipt->>'quarantinedClosureCount')::integer <> 0
      THEN
        RAISE EXCEPTION 'invalid Agreement candidate Product materialisation'
          USING ERRCODE = '23514';
      END IF;
      p_write_set := jsonb_build_object(
        'schema_version', 'PRODUCT_CANDIDATE_RESULT_RECORD/V1',
        'candidate_product_result_id', canonical_v2_staging.content_id(
          'PRODUCT_CANDIDATE_RESULT_RECORD/V1', p_write_set->'domain_carrier'
        ),
        'writer_contract_stable_id', 'PRODUCT_CANDIDATE_RESULT_WRITER',
        'writer_contract_version', 1,
        'operation', 'PRODUCT_RESULT_CANDIDATE_RUN',
        'candidate_release_manifest_id', p_write_set->'domain_carrier'
          ->'product_materialisation'->'product_query_ir'->'release_contract'
            ->>'candidate_release_manifest_id',
        'candidate_release_manifest_payload_digest', p_write_set->'domain_carrier'
          ->'product_materialisation'->'product_query_ir'->'release_contract'
            ->>'candidate_release_manifest_payload_digest',
        'corpus_release_id', p_write_set->'domain_carrier'
          ->'product_materialisation'->'candidate_release_binding'
            ->>'corpus_release_id',
        'product_query_definition_id', p_write_set->'domain_carrier'
          ->'product_materialisation'->'product_query_ir'->>'query_definition_id',
        'product_query_result_identity', p_write_set->'domain_carrier'
          ->'product_materialisation'->'product_query_result'
            ->>'product_query_result_identity',
        'domain_result_identity', p_write_set->'domain_carrier'
          ->'product_materialisation'->'product_query_result'
            ->>'domain_result_identity',
        'process_phrasebook_result_identity', NULL,
        'candidate_state', 'CANDIDATE_NOT_ACTIVE',
        'authority_state', 'NOT_GRANTED',
        'complete_write_set', p_write_set->'domain_carrier'
      );
    ELSE
      RAISE EXCEPTION 'unknown Product candidate-result adapter'
        USING ERRCODE = '23514';
    END IF;
    IF p_write_set->>'schema_version' = 'PRODUCT_CANDIDATE_RESULT_WRITE_SET/V1' AND (
      p_write_set - ARRAY[
        'schema_version',
        'candidate_release_binding',
        'process_pilot_materialisation_receipt',
        'product_admission',
        'product_row',
        'product_result_set',
        'product_presentation',
        'product_surfaces'
      ]::text[] <> '{}'::jsonb
      OR NOT p_write_set ?& ARRAY[
        'schema_version',
        'candidate_release_binding',
        'process_pilot_materialisation_receipt',
        'product_admission',
        'product_row',
        'product_result_set',
        'product_presentation',
        'product_surfaces'
      ]
      OR p_write_set->>'schema_version'
        IS DISTINCT FROM 'PRODUCT_CANDIDATE_RESULT_WRITE_SET/V1'
      OR p_residuals IS DISTINCT FROM '[]'::jsonb
      OR p_quarantines IS DISTINCT FROM '[]'::jsonb
      OR (p_receipt->>'publishableObjectCount')::integer <> 1
      OR (p_receipt->>'residualCount')::integer <> 0
      OR (p_receipt->>'quarantinedClosureCount')::integer <> 0
      OR p_write_set->'candidate_release_binding'->>'release_state'
        IS DISTINCT FROM 'CANDIDATE_NOT_ACTIVE'
      OR p_write_set->'candidate_release_binding'->>'authority_state'
        IS DISTINCT FROM 'NOT_GRANTED'
      OR p_write_set->'product_admission'->>'adapter_state'
        IS DISTINCT FROM 'VALIDATED_NOT_SERVED'
      OR p_write_set->'product_row'->>'row_state'
        IS DISTINCT FROM 'VALIDATED_NOT_SERVED'
      OR p_write_set->'product_result_set'->>'result_set_state'
        IS DISTINCT FROM 'VALIDATED_NOT_SERVED'
      OR p_write_set->'product_presentation'->>'presentation_state'
        IS DISTINCT FROM 'VALIDATED_NOT_RENDERED'
      OR p_write_set->'product_surfaces'->>'surface_state'
        IS DISTINCT FROM 'VALIDATED_NOT_SERVED'
    ) THEN
      RAISE EXCEPTION 'invalid Product candidate-result write set'
        USING ERRCODE = '23514';
    END IF;
    IF p_write_set->>'schema_version' = 'PRODUCT_CANDIDATE_RESULT_WRITE_SET/V1' AND (
      p_write_set->'candidate_release_binding'->>'candidate_release_manifest_id'
          !~ '^[0-9a-f]{64}$'
      OR p_write_set->'candidate_release_binding'
          ->>'candidate_release_manifest_payload_digest' !~ '^[0-9a-f]{64}$'
      OR p_write_set->'candidate_release_binding'->>'corpus_release_id'
          !~ '^[0-9a-f]{64}$'
      OR p_write_set->'product_row'->'product_query_ir'
          ->'release_contract'->>'candidate_release_manifest_id'
        IS DISTINCT FROM p_write_set->'candidate_release_binding'
          ->>'candidate_release_manifest_id'
      OR p_write_set->'product_row'->'product_query_ir'
          ->'release_contract'->>'candidate_release_manifest_payload_digest'
        IS DISTINCT FROM p_write_set->'candidate_release_binding'
          ->>'candidate_release_manifest_payload_digest'
      OR p_write_set->'product_row'->'product_query_ir'
          ->>'query_definition_id'
        IS DISTINCT FROM p_write_set->'candidate_release_binding'
          ->>'product_query_definition_id'
      OR p_write_set->'product_admission'
          ->>'candidate_release_manifest_id'
        IS DISTINCT FROM p_write_set->'candidate_release_binding'
          ->>'candidate_release_manifest_id'
      OR p_write_set->'product_admission'->>'corpus_release_id'
        IS DISTINCT FROM p_write_set->'candidate_release_binding'
          ->>'corpus_release_id'
      OR p_write_set->'product_row'
          ->>'product_admission_adapter_receipt_id'
        IS DISTINCT FROM p_write_set->'product_admission'
          ->>'product_admission_adapter_receipt_id'
      OR p_write_set->'product_result_set'->>'product_row_receipt_id'
        IS DISTINCT FROM p_write_set->'product_row'
          ->>'product_row_receipt_id'
      OR p_write_set->'product_presentation'
          ->>'product_result_set_receipt_id'
        IS DISTINCT FROM p_write_set->'product_result_set'
          ->>'product_result_set_receipt_id'
      OR p_write_set->'product_surfaces'
          ->>'product_presentation_receipt_id'
        IS DISTINCT FROM p_write_set->'product_presentation'
          ->>'product_presentation_receipt_id'
    ) THEN
      RAISE EXCEPTION 'Product candidate-result release or lineage mismatch'
        USING ERRCODE = '23514';
    END IF;
    item_id := COALESCE(
      p_write_set->>'candidate_product_result_id',
      canonical_v2_staging.content_id('PRODUCT_CANDIDATE_RESULT_RECORD/V1', p_write_set)
    );
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.product_candidate_results
    WHERE candidate_product_result_id = item_id;
    IF FOUND
      AND existing_digest <> canonical_v2_staging.payload_digest(p_write_set)
    THEN
      RAISE EXCEPTION 'Product candidate-result identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.product_candidate_results(
      candidate_product_result_id,
      candidate_release_manifest_id,
      corpus_release_id,
      product_query_result_identity,
      domain_result_identity,
      candidate_state,
      canonical_payload
    ) VALUES (
      item_id,
      COALESCE(p_write_set->'candidate_release_binding'
        ->>'candidate_release_manifest_id', p_write_set->>'candidate_release_manifest_id'),
      COALESCE(p_write_set->'candidate_release_binding'->>'corpus_release_id',
        p_write_set->>'corpus_release_id'),
      COALESCE(p_write_set->'product_row'->'shared_row_adapter_receipt'
        ->'product_query_result'->>'product_query_result_identity',
        p_write_set->>'product_query_result_identity'),
      COALESCE(p_write_set->'product_row'->'shared_row_adapter_receipt'
        ->'product_query_result'->>'domain_result_identity',
        p_write_set->>'domain_result_identity'),
      'CANDIDATE_NOT_ACTIVE',
      p_write_set
    ) ON CONFLICT (candidate_product_result_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.product_candidate_results
    WHERE candidate_product_result_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(
      p_write_set
    ) THEN
      RAISE EXCEPTION 'Product candidate-result identity conflict'
        USING ERRCODE = '23505';
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

$branch$;
BEGIN
  IF writer_definition IS NULL
    OR position('PRODUCT_RESULT_CANDIDATE_RUN' in writer_definition) <> 0
    OR length(writer_definition)
      - length(replace(writer_definition, old_operation_tail, ''))
      <> length(old_operation_tail)
    OR length(writer_definition)
      - length(replace(writer_definition, intake_marker, ''))
      <> length(intake_marker)
  THEN
    RAISE EXCEPTION 'canonical writer basis does not match the bounded migration';
  END IF;
  writer_definition := replace(
    writer_definition,
    old_operation_tail,
    new_operation_tail
  );
  writer_definition := replace(
    writer_definition,
    intake_marker,
    candidate_branch || intake_marker
  );
  EXECUTE writer_definition;
  IF position(
    'PRODUCT_RESULT_CANDIDATE_RUN'
    in pg_get_functiondef(
      'public.canonical_v2_write(text,text,text,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure
    )
  ) = 0 THEN
    RAISE EXCEPTION 'Product candidate-result writer migration did not apply';
  END IF;
END;
$migration$;

COMMIT;
