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

-- Governed function SHA-256: a03c57a1f3990c61365dc628619735853aec29d168834240e2f836c514bd06b4
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
    OR c->>'authority_context_id' IS DISTINCT FROM '067811cd46aff7d35ace7ff3c49551533ae9822940567a9b276152fcafc2a173'
    OR c->>'authority_context_id' IS DISTINCT FROM canonical_v2_staging.content_id('PILOT_PRODUCT_AUTHORITY_CONTEXT/V1',c-'authority_context_id')
    OR c->>'approved_pm_data_version_id' IS DISTINCT FROM 'baa2bf3b6d097e6d5e28faa0bc2e55f3cf8026e3ad4122fa83cec599390d6a54'
    OR c->'authority_limits' IS DISTINCT FROM '{"activation":"NONE","database_write":"NONE","extraction":"NONE","import":"NONE","materialisation":"NONE","production":"NONE","query_execution":"NONE","release":"NONE","serving":"NONE","source_read":"NONE","writer":"NONE"}'::jsonb
  THEN RAISE EXCEPTION 'invalid SQL-native Process Product authority carrier' USING ERRCODE = '23514'; END IF;

  IF i - ARRAY['canonical_contract_input_compilation','compiled_contract_bundle','candidate_release_manifest']::text[] <> '{}'::jsonb
    OR NOT i ?& ARRAY['canonical_contract_input_compilation','compiled_contract_bundle','candidate_release_manifest']
    OR i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_id' IS DISTINCT FROM 'adb9f4f0945fb525a79c1be9cdec6be578e28c34688e89991700e686bc4ee07f'
    OR i->'canonical_contract_input_compilation'->'canonical_bundle_input_identity'->>'root_input_manifest_payload_digest' IS DISTINCT FROM '27adc0c72381db5b2a48679a28625a56fd1dd6ab5659fc32d4c29d89a32f4702'
    OR b->>'schema_version' IS DISTINCT FROM 'CANONICAL_CONTRACT_BUNDLE_COMPILATION/V1'
    OR b->>'contract_bundle_id' IS DISTINCT FROM '901d45871b90d0677dd3fdfa6b718cba1795c5393cbbe91412e05e9ea3f7bd76'
    OR b->>'contract_bundle_digest' IS DISTINCT FROM '3b24070932af4ed946eb72b41fbaf9d9e77dd0eaa191af4dedbaeb7fe3f8f632'
    OR b->>'canonical_payload_digest' IS DISTINCT FROM 'b8c1d79b6f8e9e7d403246804d52f10c5b6976a8928ce7bb95ae6a3687045a9d'
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

-- Governed function SHA-256: 023d5f9310e8402ea1d2798c68cb81494719a4e8d9fe2db9ff138927aa068170
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
    OR q->'release_contract'->>'approved_pm_data_version_id' IS DISTINCT FROM '7d641abbf52680340d315f521cf883baa1eba3bb8c8d70b8d870e21063c39abf'
    OR q->'release_contract'->>'candidate_release_manifest_id' IS DISTINCT FROM 'd6e9817e1515c3946eab3810cf8d88c748183704eb9b2aedbc6833f910afddcb'
    OR q->'release_contract'->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM '396e895cf2a8ef219a6c10b3cc7f964a7e14f48a01aea101ddb624fa476c2d60'
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
    OR (e->>'family_profile_id' = 'IOC_CAPEX_RESTRICTION_V1' AND (
      (r->'exact_citation') - ARRAY['schema_version','citation_target_identity','human_readable_source_label','result_component_evidence_identity','source_accession_or_equivalent_identity','source_document_identity','source_evidence_identity','source_filing_date','source_filing_type','source_interval','source_location_label','source_representation_kind']::text[] <> '{}'::jsonb
      OR NOT (r->'exact_citation') ?& ARRAY['schema_version','citation_target_identity','human_readable_source_label','result_component_evidence_identity','source_accession_or_equivalent_identity','source_document_identity','source_evidence_identity','source_filing_date','source_filing_type','source_interval','source_location_label','source_representation_kind']
      OR jsonb_array_length(x->'exact_detail_package'->'references') <> 1
      OR jsonb_array_length(x->'exact_detail_package'->'detail_payloads') <> 1
      OR x->'exact_detail_package'->'references'->0->>'action_slot_key' IS DISTINCT FROM action
      OR x->'exact_detail_package'->'references'->0->>'source_detail_payload_id' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->>'source_detail_payload_id'
      OR x->'exact_detail_package'->'references'->0->>'contextual_use_key' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->>'contextual_use_key'
      OR x->'exact_detail_package'->'detail_payloads'->0->>'detail_kind' IS DISTINCT FROM 'CLAIM_EVIDENCE'
      OR x->'exact_detail_package'->'detail_payloads'->0->>'terminal_object_type' IS DISTINCT FROM 'CLAIM_EVIDENCE'
      OR x->'exact_detail_package'->'references'->0->'ordered_path'->1->>'object_type' IS DISTINCT FROM 'ClaimEvidence'
      OR x->'exact_detail_package'->'references'->0->'ordered_path'->2->>'object_type' IS DISTINCT FROM 'Excerpt'
      OR r->'exact_citation'->>'result_component_evidence_identity' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->>'terminal_object_id'
      OR r->'exact_citation'->>'result_component_evidence_identity' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->'response_body'->>'claim_evidence_id'
      OR r->'exact_citation'->>'result_component_evidence_identity' IS DISTINCT FROM x->'exact_detail_package'->'references'->0->'ordered_path'->1->>'object_id'
      OR r->'exact_citation'->>'source_evidence_identity' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->'response_body'->'excerpt'->>'excerpt_id'
      OR r->'exact_citation'->>'source_evidence_identity' IS DISTINCT FROM x->'exact_detail_package'->'references'->0->'ordered_path'->2->>'object_id'
      OR r->'exact_citation'->>'source_document_identity' IS DISTINCT FROM x->'exact_detail_package'->'detail_payloads'->0->'response_body'->'source_lineage'->>'document_hash'
      OR r->'domain_result_payload'->'canonical_result'->'components'->0->'denominator'->>'precision' IS DISTINCT FROM 'APPROXIMATE'
      OR r->'domain_result_payload'->'canonical_result'->'components'->0->'claim_attributes'->>'denominator_precision' IS DISTINCT FROM 'APPROXIMATE'
      OR r->'domain_result_payload'->'canonical_result'->'market_context'->'subject_observation'->'denominator'->>'precision' IS DISTINCT FROM 'APPROXIMATE'
      OR e->'ordered_terminals'->0->'subject_terminal'->'denominator'->>'precision' IS DISTINCT FROM 'APPROXIMATE'
      OR e->'ordered_terminals'->0->'subject_terminal'->'claim_attributes'->>'denominator_precision' IS DISTINCT FROM 'APPROXIMATE'
    ))
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
    OR o->>'product_field_catalogue_id' IS DISTINCT FROM '76d96b836a5baba7f28875686673b6ad1afac9bffc2abd81fc040e7cadfb742f'
    OR o->>'product_field_catalogue_payload_digest' IS DISTINCT FROM '167857e513a7adc5bb986d47c6cfea6517343fd69589ebb1f60c8b4d633d4695'
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
    OR EXISTS (
      SELECT 1
      FROM jsonb_each(u->'surface_bindings') AS h(name,value)
      WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
        OR value - ARRAY[
          'surface','product_query_definition_id','product_query_result_identity',
          'domain_result_identity','product_result_presentation_id',
          'candidate_release_manifest_id','candidate_release_manifest_payload_digest',
          'exact_citation_target_identity','exact_detail_action',
          'renderer_neutral_content_identity','source_document_identity',
          'source_evidence_identity','authority_state'
        ]::text[] <> '{}'::jsonb
        OR NOT value ?& ARRAY[
          'surface','product_query_definition_id','product_query_result_identity',
          'domain_result_identity','product_result_presentation_id',
          'candidate_release_manifest_id','candidate_release_manifest_payload_digest',
          'exact_citation_target_identity','exact_detail_action',
          'renderer_neutral_content_identity','source_document_identity',
          'source_evidence_identity','authority_state'
        ]
        OR value->>'surface' IS DISTINCT FROM name
        OR value->>'product_query_definition_id' IS DISTINCT FROM q->>'query_definition_id'
        OR value->>'product_query_result_identity' IS DISTINCT FROM r->>'product_query_result_identity'
        OR value->>'domain_result_identity' IS DISTINCT FROM r->>'domain_result_identity'
        OR value->>'product_result_presentation_id' IS DISTINCT FROM p->>'product_result_presentation_id'
        OR value->>'candidate_release_manifest_id' IS DISTINCT FROM r->>'candidate_release_manifest_id'
        OR value->>'candidate_release_manifest_payload_digest' IS DISTINCT FROM r->>'candidate_release_manifest_payload_digest'
        OR value->>'exact_citation_target_identity' IS DISTINCT FROM r->'exact_citation'->>'citation_target_identity'
        OR value->>'exact_detail_action' IS DISTINCT FROM action
        OR value->>'renderer_neutral_content_identity' IS DISTINCT FROM u->>'renderer_neutral_content_identity'
        OR value->>'source_document_identity' IS DISTINCT FROM r->'exact_citation'->>'source_document_identity'
        OR value->>'source_evidence_identity' IS DISTINCT FROM r->'exact_citation'->>'source_evidence_identity'
        OR value->>'authority_state' IS DISTINCT FROM 'NOT_GRANTED'
    )
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

-- Governed function SHA-256: ea375cd49b170c6ecd504241d9d28a5db2bbb43f2782518c6c2ef3f40e808a28
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
  domain_carrier jsonb;
  adapter_identifier text;
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
    'DEAL_SCOPE_RUN',
    'PRODUCT_RESULT_CANDIDATE_RUN'
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
      + pg_catalog.pg_column_size(p_receipt) > 16777216 THEN
    RAISE EXCEPTION 'canonical writer persistence envelope exceeds 16 MiB'
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

  IF p_operation = 'PRODUCT_RESULT_CANDIDATE_RUN' THEN
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
    adapter_identifier := p_write_set->>'adapter_identifier';
    domain_carrier := p_write_set->'domain_carrier';
    IF adapter_identifier = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' THEN
      PERFORM canonical_v2_staging.validate_process_phrasebook_product_carrier(
        domain_carrier
      );
      IF domain_carrier - ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set',
          'pilot_product_authority_context',
          'pilot_product_authority_context_input'
        ]::text[] <> '{}'::jsonb
        OR NOT domain_carrier ?& ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set',
          'pilot_product_authority_context',
          'pilot_product_authority_context_input'
        ]
        OR domain_carrier->>'schema_version'
          IS DISTINCT FROM 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1'
        OR domain_carrier->>'process_phrasebook_product_chain_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'PROCESS_PHRASEBOOK_PRODUCT_CHAIN/V1',
            domain_carrier - ARRAY[
              'process_phrasebook_product_chain_id',
              'process_phrasebook_product_chain_payload_digest'
            ]::text[]
          )
        OR domain_carrier->>'process_phrasebook_product_chain_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  domain_carrier - ARRAY[
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
      p_write_set := domain_carrier->'complete_write_set';
    ELSIF adapter_identifier = 'AGREEMENT_CANDIDATE_ENVELOPE' THEN
      PERFORM canonical_v2_staging.validate_agreement_candidate_product_carrier(
        domain_carrier
      );
      IF domain_carrier - ARRAY[
        'schema_version', 'agreement_candidate_envelope_id',
          'agreement_candidate_envelope_carrier_id',
          'agreement_candidate_envelope_carrier_payload_digest',
          'agreement_candidate_envelope_payload_digest',
          'agreement_candidate_envelope', 'product_materialisation'
        ]::text[] <> '{}'::jsonb
        OR NOT domain_carrier ?& ARRAY[
        'schema_version', 'agreement_candidate_envelope_id',
          'agreement_candidate_envelope_carrier_id',
          'agreement_candidate_envelope_carrier_payload_digest',
          'agreement_candidate_envelope_payload_digest',
          'agreement_candidate_envelope', 'product_materialisation'
        ]
        OR domain_carrier->>'schema_version'
          IS DISTINCT FROM 'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1'
        OR domain_carrier->>'agreement_candidate_envelope_carrier_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_ENVELOPE_CARRIER/V1',
            domain_carrier - ARRAY[
              'agreement_candidate_envelope_carrier_id',
              'agreement_candidate_envelope_carrier_payload_digest'
            ]::text[]
          )
        OR domain_carrier->>'agreement_candidate_envelope_carrier_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  domain_carrier - ARRAY[
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
        OR domain_carrier->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM domain_carrier->'agreement_candidate_envelope'
            ->>'agreement_candidate_envelope_id'
        OR domain_carrier->>'agreement_candidate_envelope_payload_digest'
          IS DISTINCT FROM pg_catalog.encode(
            extensions.digest(
              pg_catalog.convert_to(
                canonical_v2_staging.canonical_json(
                  domain_carrier->'agreement_candidate_envelope'
                ),
                'UTF8'
              ),
              'sha256'::text
            ),
            'hex'
          )
        OR domain_carrier->'agreement_candidate_envelope'
            ->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_ENVELOPE/V1',
            (domain_carrier->'agreement_candidate_envelope')
              - ARRAY['agreement_candidate_envelope_id', 'schema_version']::text[]
          )
      THEN
        RAISE EXCEPTION 'invalid Agreement candidate envelope carrier'
          USING ERRCODE = '23514';
      END IF;
      IF (domain_carrier->'product_materialisation') - ARRAY[
          'agreement_candidate_envelope_id',
          'agreement_candidate_product_materialisation_id',
          'agreement_ordering_projection', 'authority_state',
          'candidate_release_binding', 'evidence_sidecar',
          'materialisation_state', 'product_evaluation_evidence', 'product_query_ir',
          'product_query_result', 'product_result_presentation', 'product_result_set',
          'product_result_surfaces', 'schema_version'
        ]::text[] <> '{}'::jsonb
        OR NOT (domain_carrier->'product_materialisation') ?& ARRAY[
          'agreement_candidate_envelope_id',
          'agreement_candidate_product_materialisation_id',
          'agreement_ordering_projection', 'authority_state',
          'candidate_release_binding', 'evidence_sidecar',
          'materialisation_state', 'product_evaluation_evidence', 'product_query_ir',
          'product_query_result', 'product_result_presentation', 'product_result_set',
          'product_result_surfaces', 'schema_version'
        ]
        OR domain_carrier->'product_materialisation'->>'schema_version'
          IS DISTINCT FROM 'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1'
        OR domain_carrier->'product_materialisation'
            ->>'agreement_candidate_envelope_id'
          IS DISTINCT FROM domain_carrier->>'agreement_candidate_envelope_id'
        OR domain_carrier->'product_materialisation'->>'materialisation_state'
          IS DISTINCT FROM 'VALIDATED_NOT_PERSISTED'
        OR domain_carrier->'product_materialisation'->>'authority_state'
          IS DISTINCT FROM 'NOT_GRANTED'
        OR (domain_carrier->'product_materialisation'->'candidate_release_binding')
            - ARRAY[
              'approved_pm_data_version_id', 'candidate_release_manifest_id',
              'candidate_release_manifest_payload_digest', 'corpus_release_id',
              'product_query_definition_id', 'release_state', 'authority_state'
            ]::text[] <> '{}'::jsonb
        OR NOT (domain_carrier->'product_materialisation'->'candidate_release_binding') ?& ARRAY[
          'approved_pm_data_version_id', 'candidate_release_manifest_id',
          'candidate_release_manifest_payload_digest', 'corpus_release_id',
          'product_query_definition_id', 'release_state', 'authority_state'
        ]
        OR domain_carrier->'product_materialisation'
            ->>'agreement_candidate_product_materialisation_id'
          IS DISTINCT FROM canonical_v2_staging.content_id(
            'AGREEMENT_CANDIDATE_PRODUCT_MATERIALISATION/V1',
            (domain_carrier->'product_materialisation') - ARRAY[
              'agreement_candidate_product_materialisation_id', 'schema_version'
            ]::text[]
          )
        OR domain_carrier->'product_materialisation'->'product_query_ir'
            ->'semantic_contract'->>'domain_key'
          IS DISTINCT FROM 'AGREEMENT'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'approved_pm_data_version_id'
          IS DISTINCT FROM domain_carrier->'product_materialisation'
            ->'product_query_ir'->'release_contract'->>'approved_pm_data_version_id'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'candidate_release_manifest_id'
          IS DISTINCT FROM domain_carrier->'product_materialisation'
            ->'product_query_ir'->'release_contract'->>'candidate_release_manifest_id'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'candidate_release_manifest_payload_digest'
          IS DISTINCT FROM domain_carrier->'product_materialisation'
            ->'product_query_ir'->'release_contract'
              ->>'candidate_release_manifest_payload_digest'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'product_query_definition_id'
          IS DISTINCT FROM domain_carrier->'product_materialisation'
            ->'product_query_ir'->>'query_definition_id'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'release_state'
          IS DISTINCT FROM 'CANDIDATE_NOT_ACTIVE'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'authority_state'
          IS DISTINCT FROM 'NOT_GRANTED'
        OR domain_carrier->'product_materialisation'->'candidate_release_binding'
            ->>'corpus_release_id' !~ '^[0-9a-f]{64}$'
        OR domain_carrier->'product_materialisation'->'product_query_result'
            ->>'product_query_definition_id'
          IS DISTINCT FROM domain_carrier->'product_materialisation'
            ->'product_query_ir'->>'query_definition_id'
        OR domain_carrier->'product_materialisation'->'product_query_result'
            ->>'domain_result_identity'
          IS DISTINCT FROM domain_carrier->'agreement_candidate_envelope'
            ->'product_membership'->>'domain_result_identity'
        OR domain_carrier->'product_materialisation'->'product_query_result'
            ->>'domain_result_payload_digest'
          IS DISTINCT FROM domain_carrier->'agreement_candidate_envelope'
            ->'product_membership'->>'domain_result_payload_digest'
        OR domain_carrier->'product_materialisation'->'product_query_ir'
            ->'semantic_contract'->'result_definition'->>'stable_id'
          IS DISTINCT FROM domain_carrier->'agreement_candidate_envelope'
            ->'product_membership'->>'result_definition_stable_id'
        OR domain_carrier->'product_materialisation'->'product_query_ir'
            ->'semantic_contract'->'result_definition'->>'version'
          IS DISTINCT FROM domain_carrier->'agreement_candidate_envelope'
            ->'product_membership'->>'result_definition_version'
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
          'PRODUCT_CANDIDATE_RESULT_RECORD/V1', domain_carrier
        ),
        'writer_contract_stable_id', 'PRODUCT_CANDIDATE_RESULT_WRITER',
        'writer_contract_version', 1,
        'operation', 'PRODUCT_RESULT_CANDIDATE_RUN',
        'candidate_release_manifest_id', domain_carrier->'product_materialisation'
          ->'product_query_ir'->'release_contract'->>'candidate_release_manifest_id',
        'candidate_release_manifest_payload_digest', domain_carrier
          ->'product_materialisation'->'product_query_ir'->'release_contract'
            ->>'candidate_release_manifest_payload_digest',
        'corpus_release_id', domain_carrier->'product_materialisation'
          ->'candidate_release_binding'->>'corpus_release_id',
        'product_query_definition_id', domain_carrier->'product_materialisation'
          ->'product_query_ir'->>'query_definition_id',
        'product_query_result_identity', domain_carrier->'product_materialisation'
          ->'product_query_result'->>'product_query_result_identity',
        'domain_result_identity', domain_carrier->'product_materialisation'
          ->'product_query_result'->>'domain_result_identity',
        'process_phrasebook_result_identity', NULL,
        'candidate_state', 'CANDIDATE_NOT_ACTIVE',
        'authority_state', 'NOT_GRANTED',
        'complete_write_set', domain_carrier
      );
    ELSE
      RAISE EXCEPTION 'unknown Product candidate-result adapter'
        USING ERRCODE = '23514';
    END IF;
    IF adapter_identifier = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' AND (
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
        IS DISTINCT FROM 'VALIDATED_NOT_RELEASE_BOUND'
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

    IF adapter_identifier = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' AND (
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
      OR p_write_set->'product_admission'->'corpus_release_id'
        IS DISTINCT FROM 'null'::jsonb
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
      OR p_write_set->'product_admission'
          ->>'product_admission_adapter_receipt_id'
        IS DISTINCT FROM canonical_v2_staging.content_id(
          'METSERA_EXCLUSIVITY_PRODUCT_ADMISSION/V1',
          (p_write_set->'product_admission')
            - 'product_admission_adapter_receipt_id'
        )
      OR p_write_set->'product_row'->>'product_row_receipt_id'
        IS DISTINCT FROM canonical_v2_staging.content_id(
          'METSERA_EXCLUSIVITY_PRODUCT_ROW/V1',
          (p_write_set->'product_row') - 'product_row_receipt_id'
        )
      OR p_write_set->'product_result_set'->>'product_result_set_receipt_id'
        IS DISTINCT FROM canonical_v2_staging.content_id(
          'METSERA_EXCLUSIVITY_PRODUCT_RESULT_SET/V1',
          (p_write_set->'product_result_set') - 'product_result_set_receipt_id'
        )
      OR p_write_set->'product_presentation'
          ->>'product_presentation_receipt_id'
        IS DISTINCT FROM canonical_v2_staging.content_id(
          'METSERA_EXCLUSIVITY_PRODUCT_PRESENTATION/V1',
          (p_write_set->'product_presentation')
            - 'product_presentation_receipt_id'
        )
      OR p_write_set->'product_surfaces'->>'product_surfaces_receipt_id'
        IS DISTINCT FROM canonical_v2_staging.content_id(
          'METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1',
          (p_write_set->'product_surfaces') - 'product_surfaces_receipt_id'
        )
    ) THEN
      RAISE EXCEPTION 'Product candidate-result release or lineage mismatch'
        USING ERRCODE = '23514';
    END IF;

    IF adapter_identifier = 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN' THEN
      p_write_set := jsonb_build_object(
        'schema_version', 'PRODUCT_CANDIDATE_RESULT_RECORD/V1',
        'candidate_product_result_id', canonical_v2_staging.content_id(
          'PRODUCT_CANDIDATE_RESULT_RECORD/V1', p_write_set
        ),
        'writer_contract_stable_id', 'PRODUCT_CANDIDATE_RESULT_WRITER',
        'writer_contract_version', 1,
        'operation', 'PRODUCT_RESULT_CANDIDATE_RUN',
        'candidate_release_manifest_id', p_write_set->'candidate_release_binding'
          ->>'candidate_release_manifest_id',
        'candidate_release_manifest_payload_digest', p_write_set
          ->'candidate_release_binding'->>'candidate_release_manifest_payload_digest',
        'corpus_release_id', p_write_set->'candidate_release_binding'
          ->>'corpus_release_id',
        'product_query_definition_id', p_write_set->'product_row'
          ->'product_query_ir'->>'query_definition_id',
        'product_query_result_identity', p_write_set->'product_row'
          ->'shared_row_adapter_receipt'->'product_query_result'
            ->>'product_query_result_identity',
        'domain_result_identity', p_write_set->'product_row'
          ->'shared_row_adapter_receipt'->'product_query_result'
            ->>'domain_result_identity',
        'process_phrasebook_result_identity', p_write_set
          ->'product_admission'->'admission_receipt'
            ->>'process_phrasebook_passage_result_id',
        'candidate_state', 'CANDIDATE_NOT_ACTIVE',
        'authority_state', 'NOT_GRANTED',
        'complete_write_set', p_write_set
      );
    END IF;
    item_id := p_write_set->>'candidate_product_result_id';
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
        'definition_occurrences', 'provisions', 'components', 'condition_groups',
        'claims', 'relationships',
        'open_world_candidates', 'open_world_candidate_occurrences',
        'open_world_evidence_references', 'open_world_candidate_dispositions',
        'open_world_primitives', 'semantic_impact_closures',
        'reviewed_source_specific_rows', 'incomplete_canonical_result_rows'
      ])
      OR p_write_set - ARRAY[
        'source_references', 'deal', 'excerpts', 'validated_semantic_graphs',
        'definition_occurrences', 'provisions', 'components', 'condition_groups',
        'claims', 'relationships',
        'open_world_candidates', 'open_world_candidate_occurrences',
        'open_world_evidence_references', 'open_world_candidate_dispositions',
        'open_world_primitives', 'semantic_impact_closures',
        'reviewed_source_specific_rows', 'incomplete_canonical_result_rows',
        'persisted_object_references', 'conditional_termination_fee_values'
      ]::text[] <> '{}'::jsonb
      OR jsonb_typeof(p_write_set->'source_references') IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_write_set->'deal') IS DISTINCT FROM 'object'
      OR (
        p_write_set ? 'persisted_object_references'
        AND jsonb_typeof(p_write_set->'persisted_object_references') IS DISTINCT FROM 'array'
      )
      -- conditional_termination_fee_values (PLAN.md Step 4A2) is OPTIONAL,
      -- like persisted_object_references above: most deals have no Modiv-
      -- style formula fee (lib/canonical-v2/native-producer/modiv-
      -- termination-fee-source-parser.js resolveModivConditionalFees is the
      -- only producer today), so the key is entirely absent rather than an
      -- empty array for every other deal -- the same "OMITTED, not zero"
      -- convention candidate-resolution.js uses for this field. It is
      -- excluded from the required ?& list above but included in the
      -- subtraction list, exactly like persisted_object_references. When
      -- present it must be an array; the generic EXISTS check just below
      -- already enforces that for every key outside ('source_references',
      -- 'deal'), so no bespoke typeof check is needed here.
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
      SELECT supplied.input_ordinal, 'definition_occurrences',
        stored.definition_occurrence_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.definition_occurrences stored
        ON supplied.reference->>'object_kind' = 'definition_occurrences'
        AND stored.definition_occurrence_id = supplied.reference->>'object_id'
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
      SELECT supplied.input_ordinal, 'condition_groups',
        stored.condition_group_revision_id, stored.closure_id,
        stored.canonical_payload_digest, stored.canonical_payload
      FROM supplied_persisted_references supplied
      JOIN canonical_v2_staging.condition_group_revisions stored
        ON supplied.reference->>'object_kind' = 'condition_groups'
        AND stored.condition_group_revision_id = supplied.reference->>'object_id'
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
        'excerpts', 'validated_semantic_graphs', 'definition_occurrences',
        'provisions', 'components', 'condition_groups',
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
        WHEN 'definition_occurrences'
          THEN stored.canonical_payload->>'definition_occurrence_id'
        WHEN 'provisions' THEN stored.canonical_payload->>'provision_instance_id'
        WHEN 'components' THEN stored.canonical_payload->>'provision_component_id'
        WHEN 'condition_groups'
          THEN stored.canonical_payload->>'condition_group_revision_id'
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
      WITH supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_instances stored
          ON persisted.reference->>'object_kind' = 'provisions'
          AND stored.provision_instance_id = persisted.reference->>'object_id'
      ),
      -- Two provision object kinds are legitimate on the JS side
      -- (lib/canonical-v2/source-structure.js buildProvisionInstance /
      -- buildStructuralProvisionInstance, both validated by
      -- lib/canonical-v2/validate-write-set.js): PROVISION_INSTANCE/V1 names
      -- a party; STRUCTURAL_PROVISION_INSTANCE/V1 is the same shape with
      -- `party` absent, for provisions that are not party-attributed. This
      -- shape check is evaluated and raised on *before* any lineage check
      -- below, so a shape rejection and a lineage rejection are always
      -- reported with distinct messages.
      typed_provision_shapes AS (
        SELECT
          supplied.provision,
          CASE
            WHEN jsonb_typeof(supplied.provision) <> 'object' THEN false
            WHEN supplied.provision->>'schema_version' = 'STRUCTURAL_PROVISION_INSTANCE/V1'
            THEN (
              supplied.provision ?& ARRAY[
                'schema_version', 'source_occurrence_id', 'canonical_text_id',
                'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
                'ordinal', 'source_anchor_id', 'provision_instance_id',
                'closure_id'
              ]
              AND supplied.provision - ARRAY[
                'schema_version', 'source_occurrence_id', 'canonical_text_id',
                'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
                'ordinal', 'source_anchor_id', 'provision_instance_id',
                'closure_id'
              ]::text[] = '{}'::jsonb
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
              AND supplied.provision->>'concept_key' ~ '^[A-Z0-9][A-Z0-9_-]*$'
            )
            ELSE (
              supplied.provision ?& ARRAY[
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
              AND supplied.provision->>'concept_key' ~ '^[A-Z0-9][A-Z0-9_-]*$'
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
            )
          END AS shape_valid
        FROM supplied_provisions supplied
      )
      SELECT 1
      FROM typed_provision_shapes
      WHERE NOT shape_valid
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN provision shape is invalid'
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
          (supplied.provision->>'schema_version' = 'STRUCTURAL_PROVISION_INSTANCE/V1')
            AS is_structural,
          -- Mirrors typed_provision_shapes.shape_valid above; recomputed
          -- here (rather than reused) because the lineage check runs in an
          -- independent IF EXISTS/WITH statement, and this repository's
          -- convention throughout this function is that every WHERE CASE
          -- gates its own downstream checks on its own shape_valid. The two
          -- can never disagree: both read the same p_write_set within the
          -- same statement.
          CASE
            WHEN jsonb_typeof(supplied.provision) <> 'object' THEN false
            WHEN supplied.provision->>'schema_version' = 'STRUCTURAL_PROVISION_INSTANCE/V1'
            THEN (
              supplied.provision ?& ARRAY[
                'schema_version', 'source_occurrence_id', 'canonical_text_id',
                'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
                'ordinal', 'source_anchor_id', 'provision_instance_id',
                'closure_id'
              ]
              AND supplied.provision - ARRAY[
                'schema_version', 'source_occurrence_id', 'canonical_text_id',
                'document_hash', 'absolute_start', 'absolute_end', 'concept_key',
                'ordinal', 'source_anchor_id', 'provision_instance_id',
                'closure_id'
              ]::text[] = '{}'::jsonb
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
              AND supplied.provision->>'concept_key' ~ '^[A-Z0-9][A-Z0-9_-]*$'
            )
            ELSE (
              supplied.provision ?& ARRAY[
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
              AND supplied.provision->>'concept_key' ~ '^[A-Z0-9][A-Z0-9_-]*$'
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
            )
          END AS shape_valid
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
                  CASE
                    WHEN supplied.is_structural THEN 'STRUCTURAL_PROVISION_INSTANCE/V1'
                    ELSE 'PROVISION_INSTANCE/V1'
                  END,
                  CASE
                    WHEN supplied.is_structural THEN jsonb_build_object(
                      'schema_version', supplied.provision->'schema_version',
                      'source_occurrence_id',
                        supplied.provision->'source_occurrence_id',
                      'canonical_text_id', supplied.provision->'canonical_text_id',
                      'document_hash', supplied.provision->'document_hash',
                      'absolute_start', supplied.provision->'absolute_start',
                      'absolute_end', supplied.provision->'absolute_end',
                      'concept_key', supplied.provision->'concept_key',
                      'ordinal', supplied.provision->'ordinal'
                    )
                    ELSE jsonb_build_object(
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
                  END
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
              OR (
                (
                  claim.claim->'denominator' ? 'value'
                  OR claim.claim->'denominator' ? 'currency'
                )
                AND (
                  jsonb_typeof(
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
                  ) NOT BETWEEN 1 AND 4096
                  OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(
                      CASE
                        WHEN jsonb_typeof(
                          claim.claim->'denominator'->'source_lineage_ids'
                        ) = 'array'
                        AND jsonb_array_length(
                          claim.claim->'denominator'->'source_lineage_ids'
                        ) <= 4096
                        THEN claim.claim->'denominator'->'source_lineage_ids'
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_components stored
          ON persisted.reference->>'object_kind' = 'components'
          AND stored.provision_component_id = persisted.reference->>'object_id'
      ),
      supplied_definition_occurrences AS (
        SELECT definition.value AS definition
        FROM jsonb_array_elements(p_write_set->'definition_occurrences') definition(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.definition_occurrences stored
          ON persisted.reference->>'object_kind' = 'definition_occurrences'
          AND stored.definition_occurrence_id = persisted.reference->>'object_id'
      ),
      supplied_relationship_occurrences AS (
        SELECT
          relationship.value->>'relationship_occurrence_id'
            AS relationship_occurrence_id
        FROM jsonb_array_elements(p_write_set->'relationships')
          relationship(value)
        UNION ALL
        SELECT stored.canonical_payload->>'relationship_occurrence_id'
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.relationship_revisions stored
          ON persisted.reference->>'object_kind' = 'relationships'
          AND stored.relationship_revision_id
            = persisted.reference->>'object_id'
      ),
      available_occurrences AS (
        SELECT provision->>'provision_instance_id' AS occurrence_id
        FROM supplied_provisions
        UNION
        SELECT component->>'provision_component_id'
        FROM supplied_components
        UNION
        SELECT definition->>'definition_occurrence_id'
        FROM supplied_definition_occurrences
        UNION
        SELECT relationship_occurrence_id
        FROM supplied_relationship_occurrences
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
      WITH admitted_sources AS (
        SELECT
          reference.value->>'canonical_text_id' AS canonical_text_id,
          immutable_source.canonical_payload->>'response_bytes_sha256' AS document_hash,
          conversion.canonical_text_byte_length
        FROM jsonb_array_elements(p_write_set->'source_references') reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id = reference.value->>'canonical_text_id'
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.excerpts stored
          ON persisted.reference->>'object_kind' = 'excerpts'
          AND stored.excerpt_id = persisted.reference->>'object_id'
      ),
      supplied_definitions AS (
        SELECT definition.value AS definition, definition.ordinality AS input_ordinal
        FROM jsonb_array_elements(p_write_set->'definition_occurrences')
          WITH ORDINALITY definition(value, ordinality)
      ),
      definition_body_spans AS (
        SELECT
          definition.input_ordinal,
          span.value AS span,
          evidence.value #>> '{}' AS evidence_excerpt_id,
          span.ordinality AS body_ordinal,
          lag((span.value->>'absolute_end')::bigint) OVER (
            PARTITION BY definition.input_ordinal ORDER BY span.ordinality
          ) AS prior_absolute_end
        FROM supplied_definitions definition
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(definition.definition->'ordered_body_spans') = 'array'
            THEN definition.definition->'ordered_body_spans' ELSE '[]'::jsonb END
        ) WITH ORDINALITY span(value, ordinality)
        LEFT JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(definition.definition->'body_evidence_excerpt_ids') = 'array'
            THEN definition.definition->'body_evidence_excerpt_ids' ELSE '[]'::jsonb END
        ) WITH ORDINALITY evidence(value, ordinality)
          ON evidence.ordinality = span.ordinality
      )
      SELECT 1
      FROM supplied_definitions supplied
      LEFT JOIN admitted_sources source
        ON source.canonical_text_id = supplied.definition->>'canonical_text_id'
        AND source.document_hash = supplied.definition->>'document_hash'
      WHERE jsonb_typeof(supplied.definition) IS DISTINCT FROM 'object'
        OR NOT (supplied.definition ?& ARRAY[
          'schema_version', 'definition_occurrence_id', 'document_hash',
          'canonical_text_id', 'exact_declaration_span', 'ordered_body_spans',
          'neutral_definition_key', 'governed_ordinal',
          'declaration_evidence_excerpt_id', 'body_evidence_excerpt_ids', 'closure_id'
        ])
        OR supplied.definition - ARRAY[
          'schema_version', 'definition_occurrence_id', 'document_hash',
          'canonical_text_id', 'exact_declaration_span', 'ordered_body_spans',
          'neutral_definition_key', 'governed_ordinal',
          'declaration_evidence_excerpt_id', 'body_evidence_excerpt_ids', 'closure_id'
        ]::text[] <> '{}'::jsonb
        OR supplied.definition->>'schema_version' IS DISTINCT FROM 'DEFINITION_OCCURRENCE/V1'
        OR supplied.definition->>'definition_occurrence_id' !~ '^[0-9a-f]{64}$'
        OR supplied.definition->>'document_hash' !~ '^[0-9a-f]{64}$'
        OR supplied.definition->>'canonical_text_id' !~ '^[0-9a-f]{64}$'
        OR supplied.definition->>'closure_id' !~ '^[0-9a-f]{64}$'
        OR supplied.definition->>'declaration_evidence_excerpt_id' !~ '^[0-9a-f]{64}$'
        OR jsonb_typeof(supplied.definition->'neutral_definition_key') IS DISTINCT FROM 'string'
        OR coalesce(length(supplied.definition->>'neutral_definition_key'), 0) = 0
        OR jsonb_typeof(supplied.definition->'governed_ordinal') IS DISTINCT FROM 'number'
        OR supplied.definition->>'governed_ordinal' !~ '^(0|[1-9][0-9]{0,15})$'
        OR jsonb_typeof(supplied.definition->'exact_declaration_span') IS DISTINCT FROM 'object'
        OR jsonb_typeof(supplied.definition->'ordered_body_spans') IS DISTINCT FROM 'array'
        OR jsonb_array_length(CASE WHEN jsonb_typeof(supplied.definition->'ordered_body_spans') = 'array'
          THEN supplied.definition->'ordered_body_spans' ELSE '[]'::jsonb END) NOT BETWEEN 1 AND 4096
        OR jsonb_typeof(supplied.definition->'body_evidence_excerpt_ids') IS DISTINCT FROM 'array'
        OR jsonb_array_length(CASE WHEN jsonb_typeof(supplied.definition->'body_evidence_excerpt_ids') = 'array'
          THEN supplied.definition->'body_evidence_excerpt_ids' ELSE '[]'::jsonb END)
          IS DISTINCT FROM jsonb_array_length(CASE WHEN jsonb_typeof(supplied.definition->'ordered_body_spans') = 'array'
            THEN supplied.definition->'ordered_body_spans' ELSE '[]'::jsonb END)
        OR source.canonical_text_id IS NULL
        OR supplied.definition->'exact_declaration_span' IS DISTINCT FROM jsonb_build_object(
          'canonical_text_id', supplied.definition->'canonical_text_id',
          'absolute_start', supplied.definition->'exact_declaration_span'->'absolute_start',
          'absolute_end', supplied.definition->'exact_declaration_span'->'absolute_end'
        )
        OR supplied.definition->'exact_declaration_span'->>'canonical_text_id'
          IS DISTINCT FROM supplied.definition->>'canonical_text_id'
        OR supplied.definition->'exact_declaration_span'->>'absolute_start'
          !~ '^(0|[1-9][0-9]{0,15})$'
        OR supplied.definition->'exact_declaration_span'->>'absolute_end'
          !~ '^[1-9][0-9]{0,15}$'
        OR (supplied.definition->'exact_declaration_span'->>'absolute_end')::bigint
          <= (supplied.definition->'exact_declaration_span'->>'absolute_start')::bigint
        OR (supplied.definition->'exact_declaration_span'->>'absolute_end')::bigint
          > source.canonical_text_byte_length
        OR supplied.definition->>'definition_occurrence_id' IS DISTINCT FROM
          canonical_v2_staging.content_id('DEFINITION_OCCURRENCE/V1', jsonb_build_object(
            'document_hash', supplied.definition->'document_hash',
            'exact_declaration_span', supplied.definition->'exact_declaration_span',
            'ordered_body_spans', supplied.definition->'ordered_body_spans',
            'neutral_definition_key', supplied.definition->'neutral_definition_key',
            'governed_ordinal', supplied.definition->'governed_ordinal'
          ))
        OR NOT EXISTS (
          SELECT 1 FROM supplied_excerpts declaration
          WHERE declaration.excerpt->>'excerpt_id'
              = supplied.definition->>'declaration_evidence_excerpt_id'
            AND declaration.excerpt->>'closure_id'
              = supplied.definition->>'closure_id'
            AND declaration.excerpt->>'document_hash'
              = supplied.definition->>'document_hash'
            AND declaration.excerpt->'canonical_text_id'
              = supplied.definition->'exact_declaration_span'->'canonical_text_id'
            AND declaration.excerpt->'absolute_start'
              = supplied.definition->'exact_declaration_span'->'absolute_start'
            AND declaration.excerpt->'absolute_end'
              = supplied.definition->'exact_declaration_span'->'absolute_end'
        )
        OR EXISTS (
          SELECT 1 FROM definition_body_spans body
          WHERE body.input_ordinal = supplied.input_ordinal
            AND (
              jsonb_typeof(body.span) IS DISTINCT FROM 'object'
              OR body.span IS DISTINCT FROM jsonb_build_object(
                'canonical_text_id', body.span->'canonical_text_id',
                'absolute_start', body.span->'absolute_start',
                'absolute_end', body.span->'absolute_end'
              )
              OR body.span->>'canonical_text_id' IS DISTINCT FROM supplied.definition->>'canonical_text_id'
              OR body.span->>'absolute_start' !~ '^(0|[1-9][0-9]{0,15})$'
              OR body.span->>'absolute_end' !~ '^[1-9][0-9]{0,15}$'
              OR (body.span->>'absolute_end')::bigint <= (body.span->>'absolute_start')::bigint
              OR (body.span->>'absolute_end')::bigint > source.canonical_text_byte_length
              OR body.prior_absolute_end IS NOT NULL
                AND (body.span->>'absolute_start')::bigint < body.prior_absolute_end
              OR body.evidence_excerpt_id !~ '^[0-9a-f]{64}$'
              OR NOT EXISTS (
                SELECT 1 FROM supplied_excerpts evidence
                WHERE evidence.excerpt->>'excerpt_id' = body.evidence_excerpt_id
                  AND evidence.excerpt->>'closure_id'
                    = supplied.definition->>'closure_id'
                  AND evidence.excerpt->>'document_hash'
                    = supplied.definition->>'document_hash'
                  AND evidence.excerpt->'canonical_text_id'
                    = body.span->'canonical_text_id'
                  AND evidence.excerpt->'absolute_start'
                    = body.span->'absolute_start'
                  AND evidence.excerpt->'absolute_end'
                    = body.span->'absolute_end'
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(supplied.definition->'body_evidence_excerpt_ids') evidence(value)
          GROUP BY evidence.value #>> '{}'
          HAVING count(*) > 1
        )
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN definition occurrence identity, source evidence or closure is invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH supplied_provisions AS (
        SELECT provision.value AS provision
        FROM jsonb_array_elements(p_write_set->'provisions') provision(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
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
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.provision_components stored
          ON persisted.reference->>'object_kind' = 'components'
          AND stored.provision_component_id = persisted.reference->>'object_id'
      ),
      supplied_claims AS (
        SELECT claim.value AS claim
        FROM jsonb_array_elements(p_write_set->'claims') claim(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.claim_revisions stored
          ON persisted.reference->>'object_kind' = 'claims'
          AND stored.claim_revision_id = persisted.reference->>'object_id'
      ),
      supplied_excerpts AS (
        SELECT excerpt.value AS excerpt
        FROM jsonb_array_elements(p_write_set->'excerpts') excerpt(value)
        UNION ALL
        SELECT jsonb_set(
          stored.canonical_payload,
          '{closure_id}',
          to_jsonb(persisted.reference->>'validation_closure_id')
        )
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) persisted(reference)
        JOIN canonical_v2_staging.excerpts stored
          ON persisted.reference->>'object_kind' = 'excerpts'
          AND stored.excerpt_id = persisted.reference->>'object_id'
      ),
      inline_relationships AS (
        SELECT relationship.value AS relationship
        FROM jsonb_array_elements(p_write_set->'relationships')
          relationship(value)
        WHERE relationship.value->>'state' = 'PRESENT'
          AND relationship.value->>'relationship_definition_key'
            = 'EXCEPTED_BY'
          AND relationship.value->>'relationship_definition_version' = '2'
      ),
      qualified_actions AS (
        SELECT
          relationship.relationship,
          qualified.value #>> '{}' AS component_id,
          qualified.ordinality,
          component.component
        FROM inline_relationships relationship
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(
              relationship.relationship
                ->'effect'->'qualified_action_occurrence_ids'
            ) = 'array'
              AND jsonb_array_length(
                relationship.relationship
                  ->'effect'->'qualified_action_occurrence_ids'
              ) <= 16
            THEN relationship.relationship
              ->'effect'->'qualified_action_occurrence_ids'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY qualified(value, ordinality)
        LEFT JOIN supplied_components component
          ON component.component->>'provision_component_id'
            = qualified.value #>> '{}'
      )
      SELECT 1
      FROM inline_relationships relationship
      LEFT JOIN supplied_provisions source
        ON source.provision->>'provision_instance_id'
          = relationship.relationship->>'source_occurrence_id'
      WHERE source.provision->>'concept_key' = 'NOSOL-PROHIBIT'
        AND CASE
        WHEN relationship.relationship->'effect'->>'legal_operation'
          IS DISTINCT FROM
            'PERMITS_INFORMING_PERSONS_OF_NO_SHOP_PROVISIONS'
        THEN true
        WHEN jsonb_typeof(relationship.relationship->'effect') = 'object'
          AND jsonb_typeof(
            relationship.relationship
              ->'effect'->'qualified_action_occurrence_ids'
          ) = 'array'
          AND jsonb_typeof(
            relationship.relationship->'effect'->'evidence_excerpt_ids'
          ) = 'array'
          AND jsonb_typeof(
            relationship.relationship->'target_occurrence_ids'
          ) = 'array'
        THEN
          NOT coalesce((
            relationship.relationship->>'relationship_definition_key'
              = 'EXCEPTED_BY'
            AND relationship.relationship->>'relationship_definition_version'
              = '2'
            AND (relationship.relationship->'effect') ?& ARRAY[
              'effect_mode',
              'legal_operation',
              'permitted_action_code',
              'qualified_action_occurrence_ids',
              'permitted_actor_party',
              'information_subject_code',
              'temporal_scope_inheritance',
              'cross_reference_excerpt_id',
              'evidence_excerpt_ids',
              'scope_closure_id'
            ]
            AND (relationship.relationship->'effect') - ARRAY[
              'effect_mode',
              'legal_operation',
              'permitted_action_code',
              'qualified_action_occurrence_ids',
              'permitted_actor_party',
              'information_subject_code',
              'temporal_scope_inheritance',
              'cross_reference_excerpt_id',
              'evidence_excerpt_ids',
              'scope_closure_id'
            ]::text[] = '{}'::jsonb
            AND relationship.relationship->'effect'->>'effect_mode'
              = 'TYPED_LEGAL_EFFECT'
            AND relationship.relationship->'effect'->>'permitted_action_code'
              = 'INFORM_PERSONS_OF_NO_SHOP_PROVISIONS'
            AND relationship.relationship
              ->'effect'->>'information_subject_code'
              = 'GOVERNING_NO_SHOP_PROVISIONS'
            AND relationship.relationship
              ->'effect'->>'temporal_scope_inheritance'
              = 'INHERITS_PARENT_NO_SHOP_RESTRICTION'
            AND relationship.relationship->'effect'->'permitted_actor_party'
              = source.provision->'party'
            AND jsonb_typeof(
              relationship.relationship
                ->'effect'->'permitted_actor_party'
            ) = 'object'
            AND (
              relationship.relationship->'effect'->'permitted_actor_party'
            ) ?& ARRAY[
                'role', 'value', 'capacity'
              ]
            AND (
              relationship.relationship->'effect'->'permitted_actor_party'
            ) - ARRAY[
                'role', 'value', 'capacity'
              ]::text[] = '{}'::jsonb
            AND jsonb_array_length(
              relationship.relationship
                ->'effect'->'qualified_action_occurrence_ids'
            ) BETWEEN 1 AND 16
            AND (
              SELECT count(*)
              FROM qualified_actions qualified
              WHERE qualified.relationship = relationship.relationship
                AND qualified.component_id ~ '^[0-9a-f]{64}$'
            ) = jsonb_array_length(
              relationship.relationship
                ->'effect'->'qualified_action_occurrence_ids'
            )
            AND (
              SELECT count(DISTINCT qualified.component_id)
              FROM qualified_actions qualified
              WHERE qualified.relationship = relationship.relationship
            ) = jsonb_array_length(
              relationship.relationship
                ->'effect'->'qualified_action_occurrence_ids'
            )
            AND NOT EXISTS (
              SELECT 1
              FROM qualified_actions qualified
              WHERE qualified.relationship = relationship.relationship
                AND (
                  qualified.component IS NULL
                  OR qualified.component->>'component_key'
                    <> 'RESTRICTED_ACTION'
                  OR qualified.component->>'parent_provision_instance_id'
                    <> relationship.relationship->>'source_occurrence_id'
                  OR (
                    SELECT count(*)
                    FROM supplied_claims claim
                    WHERE claim.claim->>'subject_occurrence_id'
                      = qualified.component_id
                      AND claim.claim->>'claim_definition_key'
                        = 'NO_SHOP_PROHIBITED_ACTION'
                      AND claim.claim->>'claim_definition_version' = '2'
                      AND claim.claim->>'state' = 'PRESENT'
                  ) <> 1
                  OR EXISTS (
                    SELECT 1
                    FROM qualified_actions prior
                    WHERE prior.relationship = relationship.relationship
                      AND prior.ordinality < qualified.ordinality
                      AND (
                        prior.component IS NULL
                        OR (
                          prior.component->>'ordinal'
                        )::bigint >= (
                          qualified.component->>'ordinal'
                        )::bigint
                      )
                  )
                )
            )
            AND relationship.relationship
              ->'attributes'->'qualified_action_claim_revision_ids'
              = (
                SELECT jsonb_agg(
                  to_jsonb(claim.claim->>'claim_revision_id')
                  ORDER BY qualified.ordinality
                )
                FROM qualified_actions qualified
                JOIN supplied_claims claim
                  ON claim.claim->>'subject_occurrence_id'
                    = qualified.component_id
                  AND claim.claim->>'claim_definition_key'
                    = 'NO_SHOP_PROHIBITED_ACTION'
                  AND claim.claim->>'claim_definition_version' = '2'
                  AND claim.claim->>'state' = 'PRESENT'
                WHERE qualified.relationship = relationship.relationship
              )
            AND jsonb_array_length(
              relationship.relationship->'target_occurrence_ids'
            ) = 1
            AND EXISTS (
              SELECT 1
              FROM supplied_components target
              JOIN supplied_excerpts excerpt
                ON excerpt.excerpt->>'excerpt_id'
                  = relationship.relationship
                    ->'effect'->>'cross_reference_excerpt_id'
              WHERE target.component->>'provision_component_id'
                = relationship.relationship
                  ->'target_occurrence_ids'->>0
                AND target.component->>'component_key' = 'EXCEPTION_LIMB'
                AND target.component->>'parent_provision_instance_id'
                  = relationship.relationship->>'source_occurrence_id'
                AND excerpt.excerpt->>'canonical_text_id'
                  = target.component->>'canonical_text_id'
                AND excerpt.excerpt->>'absolute_start'
                  = target.component->>'absolute_start'
                AND excerpt.excerpt->>'absolute_end'
                  = target.component->>'absolute_end'
                AND excerpt.excerpt
                  ->'ordered_component_assignments'->0->>'semantic_span_id'
                  = target.component->>'source_anchor_id'
            )
            AND jsonb_array_length(
              relationship.relationship->'effect'->'evidence_excerpt_ids'
            ) BETWEEN 1 AND 8
            AND (
              SELECT count(DISTINCT evidence_excerpt_id.value #>> '{}')
              FROM jsonb_array_elements(
                relationship.relationship
                  ->'effect'->'evidence_excerpt_ids'
              ) evidence_excerpt_id(value)
              WHERE jsonb_typeof(evidence_excerpt_id.value) = 'string'
            ) = jsonb_array_length(
              relationship.relationship->'effect'->'evidence_excerpt_ids'
            )
            AND relationship.relationship->'effect'->'evidence_excerpt_ids'
              = (
                SELECT coalesce(
                  jsonb_agg(evidence.value->'excerpt_id'
                    ORDER BY evidence.ordinality),
                  '[]'::jsonb
                )
                FROM jsonb_array_elements(
                  relationship.relationship->'evidence'
                ) WITH ORDINALITY evidence(value, ordinality)
              )
            AND (
              relationship.relationship->'effect'->'evidence_excerpt_ids'
            ) ? (
                relationship.relationship
                  ->'effect'->>'cross_reference_excerpt_id'
              )
            AND relationship.relationship->'effect'->>'scope_closure_id'
              = relationship.relationship->'scope'->>'scope_closure_id'
            AND relationship.relationship->'scope'->>'coverage_status'
              = 'PARTIAL_POSITIVE_GRAPH'
            AND relationship.relationship->'scope'->'required_interval_ids'
              = relationship.relationship
                ->'effect'->'evidence_excerpt_ids'
            AND relationship.relationship->'scope'->'examined_interval_ids'
              = relationship.relationship
                ->'effect'->'evidence_excerpt_ids'
            AND relationship.relationship->'scope'->'target_interval_ids'
              = jsonb_build_array(
                relationship.relationship
                  ->'effect'->'cross_reference_excerpt_id'
              )
          ), false)
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN no-shop exception effect is invalid or unsupported'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      WITH admitted_sources AS (
        SELECT
          reference.value->>'canonical_text_id' AS canonical_text_id,
          immutable_source.canonical_payload->>'response_bytes_sha256'
            AS document_hash,
          conversion.canonical_text_byte_length,
          pg_catalog.convert_to(
            conversion.canonical_payload->>'canonical_text',
            'UTF8'
          ) AS canonical_text_bytes
        FROM jsonb_array_elements(p_write_set->'source_references')
          AS reference(value)
        JOIN canonical_v2_staging.immutable_source_documents immutable_source
          ON immutable_source.immutable_source_document_id
            = reference.value->>'immutable_source_document_id'
        JOIN canonical_v2_staging.canonical_text_conversions conversion
          ON conversion.canonical_text_id
            = reference.value->>'canonical_text_id'
      ),
      supplied_graphs AS (
        SELECT
          graph.value AS graph,
          graph.input_ordinal::bigint AS graph_input_ordinal
        FROM jsonb_array_elements(
          p_write_set->'validated_semantic_graphs'
        ) WITH ORDINALITY AS graph(value, input_ordinal)
        UNION ALL
        SELECT
          stored.canonical_payload,
          4096 + persisted.input_ordinal::bigint
        FROM jsonb_array_elements(
          coalesce(p_write_set->'persisted_object_references', '[]'::jsonb)
        ) WITH ORDINALITY AS persisted(reference, input_ordinal)
        JOIN canonical_v2_staging.validated_semantic_graphs stored
          ON persisted.reference->>'object_kind'
            = 'validated_semantic_graphs'
          AND stored.validated_semantic_graph_id
            = persisted.reference->>'object_id'
      ),
      typed_graphs AS (
        SELECT
          supplied.graph,
          supplied.graph_input_ordinal,
          CASE
            WHEN jsonb_typeof(supplied.graph->'definition_cues') = 'array'
            THEN jsonb_array_length(supplied.graph->'definition_cues')
          END AS cue_count,
          CASE
            WHEN jsonb_typeof(
              supplied.graph->'definition_use_cues'
            ) = 'array'
            THEN jsonb_array_length(
              supplied.graph->'definition_use_cues'
            )
          END AS use_count,
          CASE
            WHEN jsonb_typeof(
              supplied.graph->'definition_cue_ids'
            ) = 'array'
            THEN jsonb_array_length(
              supplied.graph->'definition_cue_ids'
            )
          END AS cue_id_count,
          CASE
            WHEN jsonb_typeof(
              supplied.graph->'definition_use_cue_ids'
            ) = 'array'
            THEN jsonb_array_length(
              supplied.graph->'definition_use_cue_ids'
            )
          END AS use_id_count,
          CASE
            WHEN jsonb_typeof(supplied.graph) = 'object'
            THEN (
            supplied.graph ?& ARRAY[
              'schema_version', 'validated_semantic_graph_id',
              'document_hash', 'canonical_text_id',
              'definition_cue_ids', 'definition_use_cue_ids',
              'definition_cues', 'definition_use_cues', 'closure_id'
            ]
            AND supplied.graph - ARRAY[
              'schema_version', 'validated_semantic_graph_id',
              'document_hash', 'canonical_text_id',
              'definition_cue_ids', 'definition_use_cue_ids',
              'definition_cues', 'definition_use_cues', 'closure_id'
            ]::text[] = '{}'::jsonb
            AND supplied.graph->>'schema_version'
              = 'VALIDATED_SEMANTIC_GRAPH/V1'
            AND jsonb_typeof(supplied.graph->'schema_version') = 'string'
            AND jsonb_typeof(
              supplied.graph->'validated_semantic_graph_id'
            ) = 'string'
            AND jsonb_typeof(supplied.graph->'document_hash') = 'string'
            AND jsonb_typeof(supplied.graph->'canonical_text_id') = 'string'
            AND jsonb_typeof(
              supplied.graph->'definition_cue_ids'
            ) = 'array'
            AND jsonb_typeof(
              supplied.graph->'definition_use_cue_ids'
            ) = 'array'
            AND jsonb_typeof(
              supplied.graph->'definition_cues'
            ) = 'array'
            AND jsonb_typeof(
              supplied.graph->'definition_use_cues'
            ) = 'array'
            AND jsonb_typeof(supplied.graph->'closure_id') = 'string'
            AND supplied.graph->>'validated_semantic_graph_id'
              ~ '^[0-9a-f]{64}$'
            AND supplied.graph->>'document_hash' ~ '^[0-9a-f]{64}$'
            AND supplied.graph->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND supplied.graph->>'closure_id' ~ '^[0-9a-f]{64}$'
          )
            ELSE false
          END AS shape_valid
        FROM supplied_graphs supplied
      ),
      request_child_counts AS (
        SELECT coalesce(sum(
          CASE
            WHEN graph.shape_valid
              AND graph.cue_count BETWEEN 0 AND 4096
              AND graph.use_count BETWEEN 0 AND 4096
              AND graph.cue_id_count BETWEEN 0 AND 4096
              AND graph.use_id_count BETWEEN 0 AND 4096
            THEN graph.cue_count + graph.use_count
            ELSE 16385
          END
        ), 0)::bigint AS child_count
        FROM typed_graphs graph
      ),
      request_top_level_id_counts AS (
        SELECT coalesce(sum(
          CASE
            WHEN graph.shape_valid
              AND graph.cue_id_count BETWEEN 0 AND 4096
              AND graph.use_id_count BETWEEN 0 AND 4096
            THEN graph.cue_id_count + graph.use_id_count
            ELSE 16385
          END
        ), 0)::bigint AS id_member_count
        FROM typed_graphs graph
      ),
      graph_cue_members AS (
        SELECT
          graph.graph_input_ordinal,
          cue.value AS cue,
          cue.array_ordinal::bigint AS cue_array_ordinal
        FROM typed_graphs graph
        CROSS JOIN request_child_counts request_counts
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN graph.cue_count BETWEEN 0 AND 4096
              AND request_counts.child_count <= 16384
            THEN graph.graph->'definition_cues'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS cue(value, array_ordinal)
      ),
      graph_nested_counts AS (
        SELECT
          graph.graph_input_ordinal,
          coalesce(graph.cue_count, 0)
            + coalesce(graph.use_count, 0)
            + coalesce(sum(
              CASE
                WHEN cue.cue IS NULL THEN 0
                WHEN jsonb_typeof(cue.cue->'body_spans') = 'array'
                THEN CASE
                  WHEN jsonb_array_length(cue.cue->'body_spans') <= 4096
                  THEN jsonb_array_length(cue.cue->'body_spans')
                  ELSE 16385
                END
                ELSE 16385
              END
            ), 0)::bigint AS nested_member_count
        FROM typed_graphs graph
        LEFT JOIN graph_cue_members cue
          ON cue.graph_input_ordinal = graph.graph_input_ordinal
        GROUP BY
          graph.graph_input_ordinal,
          graph.cue_count,
          graph.use_count
      ),
      request_nested_counts AS (
        SELECT coalesce(sum(graph.nested_member_count), 0)::bigint
          AS nested_member_count
        FROM graph_nested_counts graph
      ),
      typed_cues AS (
        SELECT
          member.graph_input_ordinal,
          member.cue,
          member.cue_array_ordinal,
          CASE
            WHEN jsonb_typeof(member.cue->'source_order_ordinal') = 'number'
              AND member.cue->>'source_order_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (member.cue->>'source_order_ordinal')::bigint
          END AS source_order_ordinal,
          CASE
            WHEN jsonb_typeof(member.cue->'body_spans') = 'array'
            THEN jsonb_array_length(member.cue->'body_spans')
          END AS body_span_count,
          CASE
            WHEN jsonb_typeof(member.cue->'body_span_ids') = 'array'
            THEN jsonb_array_length(member.cue->'body_span_ids')
          END AS body_span_id_count,
          CASE
            WHEN jsonb_typeof(member.cue) = 'object'
            THEN (
            member.cue ?& ARRAY[
              'schema_version', 'definition_cue_id', 'document_hash',
              'canonical_text_id', 'source_anchor_id', 'term_span_id',
              'body_span_ids', 'raw_term_digest', 'syntactic_role',
              'source_order_ordinal', 'raw_term', 'term_span', 'body_spans'
            ]
            AND member.cue - ARRAY[
              'schema_version', 'definition_cue_id', 'document_hash',
              'canonical_text_id', 'source_anchor_id', 'term_span_id',
              'body_span_ids', 'raw_term_digest', 'syntactic_role',
              'source_order_ordinal', 'raw_term', 'term_span', 'body_spans'
            ]::text[] = '{}'::jsonb
            AND member.cue->>'schema_version' = 'DEFINITION_CUE/V1'
            AND jsonb_typeof(member.cue->'schema_version') = 'string'
            AND jsonb_typeof(member.cue->'definition_cue_id') = 'string'
            AND jsonb_typeof(member.cue->'document_hash') = 'string'
            AND jsonb_typeof(member.cue->'canonical_text_id') = 'string'
            AND jsonb_typeof(member.cue->'source_anchor_id') = 'string'
            AND jsonb_typeof(member.cue->'term_span_id') = 'string'
            AND jsonb_typeof(member.cue->'body_span_ids') = 'array'
            AND jsonb_typeof(member.cue->'raw_term_digest') = 'string'
            AND jsonb_typeof(member.cue->'syntactic_role') = 'string'
            AND jsonb_typeof(member.cue->'source_order_ordinal') = 'number'
            AND jsonb_typeof(member.cue->'raw_term') = 'string'
            AND jsonb_typeof(member.cue->'term_span') = 'object'
            AND jsonb_typeof(member.cue->'body_spans') = 'array'
            AND member.cue->>'definition_cue_id' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'document_hash' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'source_anchor_id' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'term_span_id' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'raw_term_digest' ~ '^[0-9a-f]{64}$'
            AND member.cue->>'syntactic_role'
              IN ('NESTED_INLINE', 'POSTFIX_INLINE')
            AND length(member.cue->>'raw_term') > 0
          )
            ELSE false
          END AS shape_valid
        FROM graph_cue_members member
      ),
      request_body_id_counts AS (
        SELECT coalesce(sum(
          CASE
            WHEN cue.shape_valid
              AND cue.body_span_id_count BETWEEN 0 AND 4096
            THEN cue.body_span_id_count
            ELSE 16385
          END
        ), 0)::bigint AS id_member_count
        FROM typed_cues cue
      ),
      request_id_counts AS (
        SELECT
          top_level.id_member_count + body.id_member_count
            AS id_member_count
        FROM request_top_level_id_counts top_level
        CROSS JOIN request_body_id_counts body
      ),
      cue_body_members AS (
        SELECT
          cue.graph_input_ordinal,
          cue.cue_array_ordinal,
          body.value AS body_span,
          body.array_ordinal::bigint AS body_array_ordinal
        FROM typed_cues cue
        JOIN graph_nested_counts nested
          ON nested.graph_input_ordinal = cue.graph_input_ordinal
        CROSS JOIN request_nested_counts request_nested
        CROSS JOIN request_id_counts request_ids
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN cue.body_span_count BETWEEN 1 AND 4096
              AND cue.body_span_id_count BETWEEN 1 AND 4096
              AND nested.nested_member_count <= 16384
              AND request_nested.nested_member_count <= 16384
              AND request_ids.id_member_count <= 16384
            THEN cue.cue->'body_spans'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS body(value, array_ordinal)
      ),
      graph_use_members AS (
        SELECT
          graph.graph_input_ordinal,
          use_cue.value AS use_cue,
          use_cue.array_ordinal::bigint AS use_array_ordinal
        FROM typed_graphs graph
        JOIN graph_nested_counts nested
          ON nested.graph_input_ordinal = graph.graph_input_ordinal
        CROSS JOIN request_nested_counts request_nested
        CROSS JOIN request_id_counts request_ids
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN graph.use_count BETWEEN 0 AND 4096
              AND nested.nested_member_count <= 16384
              AND request_nested.nested_member_count <= 16384
              AND request_ids.id_member_count <= 16384
            THEN graph.graph->'definition_use_cues'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS use_cue(value, array_ordinal)
      ),
      typed_uses AS (
        SELECT
          member.graph_input_ordinal,
          member.use_cue,
          member.use_array_ordinal,
          CASE
            WHEN jsonb_typeof(
              member.use_cue->'source_order_ordinal'
            ) = 'number'
              AND member.use_cue->>'source_order_ordinal'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (member.use_cue->>'source_order_ordinal')::bigint
          END AS source_order_ordinal,
          CASE
            WHEN jsonb_typeof(member.use_cue) = 'object'
            THEN (
            member.use_cue ?& ARRAY[
              'schema_version', 'definition_use_cue_id', 'document_hash',
              'canonical_text_id', 'definition_cue_id', 'use_span_id',
              'use_role', 'source_order_ordinal', 'use_span'
            ]
            AND member.use_cue - ARRAY[
              'schema_version', 'definition_use_cue_id', 'document_hash',
              'canonical_text_id', 'definition_cue_id', 'use_span_id',
              'use_role', 'source_order_ordinal', 'use_span'
            ]::text[] = '{}'::jsonb
            AND member.use_cue->>'schema_version'
              = 'DEFINITION_USE_CUE/V1'
            AND jsonb_typeof(
              member.use_cue->'schema_version'
            ) = 'string'
            AND jsonb_typeof(
              member.use_cue->'definition_use_cue_id'
            ) = 'string'
            AND jsonb_typeof(member.use_cue->'document_hash') = 'string'
            AND jsonb_typeof(
              member.use_cue->'canonical_text_id'
            ) = 'string'
            AND jsonb_typeof(
              member.use_cue->'definition_cue_id'
            ) = 'string'
            AND jsonb_typeof(member.use_cue->'use_span_id') = 'string'
            AND jsonb_typeof(member.use_cue->'use_role') = 'string'
            AND jsonb_typeof(
              member.use_cue->'source_order_ordinal'
            ) = 'number'
            AND jsonb_typeof(member.use_cue->'use_span') = 'object'
            AND member.use_cue->>'definition_use_cue_id'
              ~ '^[0-9a-f]{64}$'
            AND member.use_cue->>'document_hash' ~ '^[0-9a-f]{64}$'
            AND member.use_cue->>'canonical_text_id'
              ~ '^[0-9a-f]{64}$'
            AND member.use_cue->>'definition_cue_id'
              ~ '^[0-9a-f]{64}$'
            AND member.use_cue->>'use_span_id' ~ '^[0-9a-f]{64}$'
            AND member.use_cue->>'use_role'
              IN ('OPERATIVE_REFERENCE', 'DECLARATION_REFERENCE')
          )
            ELSE false
          END AS shape_valid
        FROM graph_use_members member
      ),
      span_members AS (
        SELECT
          cue.graph_input_ordinal,
          'TERM'::text AS member_kind,
          cue.cue_array_ordinal AS owner_array_ordinal,
          0::bigint AS span_array_ordinal,
          cue.cue->'term_span' AS span
        FROM typed_cues cue
        UNION ALL
        SELECT
          body.graph_input_ordinal,
          'BODY',
          body.cue_array_ordinal,
          body.body_array_ordinal,
          body.body_span
        FROM cue_body_members body
        UNION ALL
        SELECT
          use_cue.graph_input_ordinal,
          'USE',
          use_cue.use_array_ordinal,
          0,
          use_cue.use_cue->'use_span'
        FROM typed_uses use_cue
      ),
      typed_spans AS (
        SELECT
          member.*,
          CASE
            WHEN jsonb_typeof(member.span->'absolute_start') = 'number'
              AND member.span->>'absolute_start'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (member.span->>'absolute_start')::bigint
          END AS absolute_start,
          CASE
            WHEN jsonb_typeof(member.span->'absolute_end') = 'number'
              AND member.span->>'absolute_end'
                ~ '^(0|[1-9][0-9]{0,15})$'
            THEN (member.span->>'absolute_end')::bigint
          END AS absolute_end,
          CASE
            WHEN jsonb_typeof(member.span) = 'object'
            THEN (
            member.span ?& ARRAY[
              'schema_version', 'canonical_text_id', 'absolute_start',
              'absolute_end', 'semantic_span_id', 'exact_bytes_digest'
            ]
            AND member.span - ARRAY[
              'schema_version', 'canonical_text_id', 'absolute_start',
              'absolute_end', 'semantic_span_id', 'exact_bytes_digest'
            ]::text[] = '{}'::jsonb
            AND member.span->>'schema_version' = 'SEMANTIC_SPAN/V1'
            AND jsonb_typeof(member.span->'schema_version') = 'string'
            AND jsonb_typeof(member.span->'canonical_text_id') = 'string'
            AND jsonb_typeof(member.span->'absolute_start') = 'number'
            AND jsonb_typeof(member.span->'absolute_end') = 'number'
            AND jsonb_typeof(member.span->'semantic_span_id') = 'string'
            AND jsonb_typeof(
              member.span->'exact_bytes_digest'
            ) = 'string'
            AND member.span->>'canonical_text_id' ~ '^[0-9a-f]{64}$'
            AND member.span->>'semantic_span_id' ~ '^[0-9a-f]{64}$'
            AND member.span->>'exact_bytes_digest' ~ '^[0-9a-f]{64}$'
          )
            ELSE false
          END AS shape_valid
        FROM span_members member
      ),
      source_bound_spans AS (
        SELECT
          span.*,
          admitted.canonical_text_byte_length,
          CASE
            WHEN span.shape_valid
              AND span.absolute_start IS NOT NULL
              AND span.absolute_end IS NOT NULL
              AND span.absolute_start <= 9007199254740991
              AND span.absolute_end <= 9007199254740991
              AND span.absolute_end > span.absolute_start
              AND span.absolute_end <= admitted.canonical_text_byte_length
              AND span.absolute_start <= 2147483647
              AND span.absolute_end <= 2147483647
            THEN true
            ELSE false
          END AS source_bounds_valid,
          admitted.canonical_text_bytes,
          CASE
            WHEN span.shape_valid
              AND span.absolute_start IS NOT NULL
              AND span.absolute_end IS NOT NULL
              AND span.absolute_start <= 9007199254740991
              AND span.absolute_end <= 9007199254740991
              AND span.absolute_end > span.absolute_start
            THEN canonical_v2_staging.content_id(
              'SEMANTIC_SPAN/V1',
              jsonb_build_object(
                'schema_version', span.span->'schema_version',
                'canonical_text_id', span.span->'canonical_text_id',
                'absolute_start', span.span->'absolute_start',
                'absolute_end', span.span->'absolute_end'
              )
            )
          END AS expected_span_id
        FROM typed_spans span
        LEFT JOIN typed_graphs graph
          ON graph.graph_input_ordinal = span.graph_input_ordinal
        LEFT JOIN admitted_sources admitted
          ON admitted.canonical_text_id = graph.graph->>'canonical_text_id'
          AND admitted.document_hash = graph.graph->>'document_hash'
          AND admitted.canonical_text_id
            = span.span->>'canonical_text_id'
      ),
      utf8_checked_spans AS (
        SELECT
          span.*,
          CASE
            WHEN span.source_bounds_valid
            THEN CASE
              WHEN get_byte(
                span.canonical_text_bytes,
                span.absolute_start::integer
              ) BETWEEN 128 AND 191
              THEN false
              WHEN span.absolute_end < span.canonical_text_byte_length
              THEN get_byte(
                span.canonical_text_bytes,
                span.absolute_end::integer
              ) NOT BETWEEN 128 AND 191
              ELSE true
            END
            ELSE false
          END AS utf8_boundary_valid
        FROM source_bound_spans span
      ),
      resolved_spans AS (
        SELECT
          span.*,
          CASE
            WHEN span.utf8_boundary_valid
            THEN pg_catalog.substring(
              span.canonical_text_bytes,
              span.absolute_start::integer + 1,
              (span.absolute_end - span.absolute_start)::integer
            )
          END AS exact_bytes
        FROM utf8_checked_spans span
      ),
      checked_spans AS (
        SELECT
          span.*,
          (
            span.exact_bytes IS NULL
            OR span.expected_span_id IS NULL
            OR span.span->>'semantic_span_id'
              IS DISTINCT FROM span.expected_span_id
            OR span.span->>'exact_bytes_digest' IS DISTINCT FROM
              pg_catalog.encode(
                extensions.digest(span.exact_bytes, 'sha256'::text),
                'hex'
              )
          ) AS invalid
        FROM resolved_spans span
      ),
      positioned_bodies AS (
        SELECT
          body.*,
          lag(body.absolute_end) OVER (
            PARTITION BY body.graph_input_ordinal, body.owner_array_ordinal
            ORDER BY body.span_array_ordinal
          ) AS prior_absolute_end
        FROM checked_spans body
        WHERE body.member_kind = 'BODY'
      ),
      body_rollups AS (
        SELECT
          body.graph_input_ordinal,
          body.owner_array_ordinal AS cue_array_ordinal,
          count(*)::bigint AS body_count,
          count(DISTINCT body.span->>'semantic_span_id')::bigint
            AS distinct_body_id_count,
          jsonb_agg(
            body.span ORDER BY body.span_array_ordinal
          ) AS bodies_in_input_order,
          jsonb_agg(
            body.span
            ORDER BY
              body.absolute_start,
              body.span->>'semantic_span_id' COLLATE "C"
          ) AS bodies_in_canonical_order,
          jsonb_agg(
            to_jsonb(body.span->>'semantic_span_id')
            ORDER BY body.span_array_ordinal
          ) AS body_ids_in_input_order,
          bool_or(body.invalid) AS contains_invalid_span,
          bool_or(
            body.prior_absolute_end IS NOT NULL
            AND body.absolute_start < body.prior_absolute_end
          ) AS contains_overlap
        FROM positioned_bodies body
        GROUP BY body.graph_input_ordinal, body.owner_array_ordinal
      ),
      prepared_cues AS (
        SELECT
          cue.*,
          graph.graph AS graph_payload,
          term.span AS term_span,
          term.absolute_start AS term_start,
          term.absolute_end AS term_end,
          term.exact_bytes AS term_exact_bytes,
          term.invalid AS term_invalid,
          body.body_count,
          body.distinct_body_id_count,
          body.contains_invalid_span,
          body.contains_overlap,
          body.bodies_in_input_order,
          body.bodies_in_canonical_order,
          body.body_ids_in_input_order,
          coalesce(body.body_count, 0) AS expanded_body_count,
          CASE
            WHEN cue.shape_valid
              AND cue.source_order_ordinal BETWEEN 0 AND 9007199254740991
              AND cue.body_span_count BETWEEN 1 AND 4096
              AND cue.body_span_id_count = cue.body_span_count
              AND body.body_count = cue.body_span_count::bigint
              AND body.distinct_body_id_count = body.body_count
              AND body.contains_invalid_span IS NOT DISTINCT FROM false
              AND body.contains_overlap IS NOT DISTINCT FROM false
              AND body.body_ids_in_input_order IS NOT NULL
            THEN canonical_v2_staging.content_id(
              'DEFINITION_CUE/V1',
              jsonb_build_object(
                'document_hash', cue.cue->'document_hash',
                'canonical_text_id', cue.cue->'canonical_text_id',
                'source_anchor_id', cue.cue->'source_anchor_id',
                'term_span_id', cue.cue->'term_span_id',
                'body_span_ids', body.body_ids_in_input_order,
                'raw_term_digest', cue.cue->'raw_term_digest',
                'syntactic_role', cue.cue->'syntactic_role',
                'source_order_ordinal',
                  cue.cue->'source_order_ordinal'
              )
            )
          END AS expected_cue_id,
          CASE
            WHEN cue.shape_valid
            THEN canonical_v2_staging.content_id(
              'RAW_DEFINITION_TERM/V1',
              to_jsonb(cue.cue->>'raw_term')
            )
          END AS expected_raw_term_digest,
          CASE
            WHEN cue.shape_valid
            THEN pg_catalog.convert_to(cue.cue->>'raw_term', 'UTF8')
          END AS raw_term_bytes
        FROM typed_cues cue
        JOIN typed_graphs graph
          ON graph.graph_input_ordinal = cue.graph_input_ordinal
        LEFT JOIN checked_spans term
          ON term.graph_input_ordinal = cue.graph_input_ordinal
          AND term.member_kind = 'TERM'
          AND term.owner_array_ordinal = cue.cue_array_ordinal
        LEFT JOIN body_rollups body
          ON body.graph_input_ordinal = cue.graph_input_ordinal
          AND body.cue_array_ordinal = cue.cue_array_ordinal
      ),
      cue_checks AS (
        SELECT
          cue.*,
          (
            NOT cue.shape_valid
            OR cue.source_order_ordinal IS NULL
            OR cue.source_order_ordinal > 9007199254740991
            OR cue.body_span_count NOT BETWEEN 1 AND 4096
            OR cue.body_span_id_count NOT BETWEEN 1 AND 4096
            OR cue.body_span_id_count IS DISTINCT FROM cue.body_span_count
            OR cue.term_invalid IS DISTINCT FROM false
            OR cue.body_count IS DISTINCT FROM cue.body_span_count::bigint
            OR cue.distinct_body_id_count
              IS DISTINCT FROM cue.body_count
            OR cue.contains_invalid_span IS DISTINCT FROM false
            OR cue.contains_overlap IS DISTINCT FROM false
            OR cue.bodies_in_input_order
              IS DISTINCT FROM cue.cue->'body_spans'
            OR cue.bodies_in_canonical_order
              IS DISTINCT FROM cue.cue->'body_spans'
            OR cue.body_ids_in_input_order
              IS DISTINCT FROM cue.cue->'body_span_ids'
            OR cue.cue->>'document_hash'
              IS DISTINCT FROM cue.graph_payload->>'document_hash'
            OR cue.cue->>'canonical_text_id'
              IS DISTINCT FROM cue.graph_payload->>'canonical_text_id'
            OR cue.cue->>'source_anchor_id'
              IS DISTINCT FROM cue.term_span->>'semantic_span_id'
            OR cue.cue->>'term_span_id'
              IS DISTINCT FROM cue.term_span->>'semantic_span_id'
            OR cue.expected_raw_term_digest IS NULL
            OR cue.cue->>'raw_term_digest'
              IS DISTINCT FROM cue.expected_raw_term_digest
            OR cue.expected_cue_id IS NULL
            OR cue.cue->>'definition_cue_id'
              IS DISTINCT FROM cue.expected_cue_id
            OR cue.raw_term_bytes IS DISTINCT FROM cue.term_exact_bytes
            OR EXISTS (
              SELECT 1
              FROM positioned_bodies positioned
              WHERE positioned.graph_input_ordinal
                = cue.graph_input_ordinal
                AND positioned.owner_array_ordinal
                  = cue.cue_array_ordinal
                AND CASE cue.cue->>'syntactic_role'
                  WHEN 'POSTFIX_INLINE'
                    THEN positioned.absolute_end > cue.term_start
                  WHEN 'NESTED_INLINE'
                    THEN positioned.absolute_start < cue.term_end
                  ELSE true
                END
            )
          ) AS invalid
        FROM prepared_cues cue
      ),
      prepared_uses AS (
        SELECT
          use_cue.*,
          graph.graph AS graph_payload,
          use_span.span AS use_span,
          use_span.invalid AS use_span_invalid,
          cue.cue->>'definition_cue_id' AS linked_cue_id,
          cue.invalid AS linked_cue_invalid,
          CASE
            WHEN use_cue.shape_valid
              AND use_cue.source_order_ordinal
                BETWEEN 0 AND 9007199254740991
            THEN canonical_v2_staging.content_id(
              'DEFINITION_USE_CUE/V1',
              jsonb_build_object(
                'document_hash', use_cue.use_cue->'document_hash',
                'canonical_text_id',
                  use_cue.use_cue->'canonical_text_id',
                'definition_cue_id',
                  use_cue.use_cue->'definition_cue_id',
                'use_span_id', use_cue.use_cue->'use_span_id',
                'use_role', use_cue.use_cue->'use_role',
                'source_order_ordinal',
                  use_cue.use_cue->'source_order_ordinal'
              )
            )
          END AS expected_use_id
        FROM typed_uses use_cue
        JOIN typed_graphs graph
          ON graph.graph_input_ordinal = use_cue.graph_input_ordinal
        LEFT JOIN checked_spans use_span
          ON use_span.graph_input_ordinal = use_cue.graph_input_ordinal
          AND use_span.member_kind = 'USE'
          AND use_span.owner_array_ordinal = use_cue.use_array_ordinal
        LEFT JOIN cue_checks cue
          ON cue.graph_input_ordinal = use_cue.graph_input_ordinal
          AND cue.cue->>'definition_cue_id'
            = use_cue.use_cue->>'definition_cue_id'
      ),
      use_checks AS (
        SELECT
          use_cue.*,
          (
            NOT use_cue.shape_valid
            OR use_cue.source_order_ordinal IS NULL
            OR use_cue.source_order_ordinal > 9007199254740991
            OR use_cue.use_span_invalid IS DISTINCT FROM false
            OR use_cue.use_cue->>'document_hash'
              IS DISTINCT FROM use_cue.graph_payload->>'document_hash'
            OR use_cue.use_cue->>'canonical_text_id'
              IS DISTINCT FROM use_cue.graph_payload->>'canonical_text_id'
            OR use_cue.use_cue->>'use_span_id'
              IS DISTINCT FROM use_cue.use_span->>'semantic_span_id'
            OR use_cue.linked_cue_id IS NULL
            OR use_cue.linked_cue_invalid IS DISTINCT FROM false
            OR use_cue.expected_use_id IS NULL
            OR use_cue.use_cue->>'definition_use_cue_id'
              IS DISTINCT FROM use_cue.expected_use_id
          ) AS invalid
        FROM prepared_uses use_cue
      ),
      cue_rollups AS (
        SELECT
          graph.graph_input_ordinal,
          count(cue.cue)::bigint AS cue_count,
          count(DISTINCT cue.cue->>'definition_cue_id')::bigint
            AS distinct_cue_id_count,
          coalesce(
            jsonb_agg(
              cue.cue ORDER BY cue.cue_array_ordinal
            ) FILTER (WHERE cue.cue IS NOT NULL),
            '[]'::jsonb
          ) AS cues_in_input_order,
          coalesce(
            jsonb_agg(
              cue.cue
              ORDER BY
                cue.source_order_ordinal,
                cue.cue->>'definition_cue_id' COLLATE "C"
            ) FILTER (WHERE cue.cue IS NOT NULL),
            '[]'::jsonb
          ) AS cues_in_canonical_order,
          coalesce(
            jsonb_agg(
              to_jsonb(cue.cue->>'definition_cue_id')
              ORDER BY cue.cue_array_ordinal
            ) FILTER (WHERE cue.cue IS NOT NULL),
            '[]'::jsonb
          ) AS cue_ids_in_input_order,
          coalesce(bool_or(cue.invalid), false) AS contains_invalid_cue
        FROM typed_graphs graph
        LEFT JOIN cue_checks cue
          ON cue.graph_input_ordinal = graph.graph_input_ordinal
        GROUP BY graph.graph_input_ordinal
      ),
      use_rollups AS (
        SELECT
          graph.graph_input_ordinal,
          count(use_cue.use_cue)::bigint AS use_count,
          count(DISTINCT use_cue.use_cue->>'definition_use_cue_id')::bigint
            AS distinct_use_id_count,
          coalesce(
            jsonb_agg(
              use_cue.use_cue ORDER BY use_cue.use_array_ordinal
            ) FILTER (WHERE use_cue.use_cue IS NOT NULL),
            '[]'::jsonb
          ) AS uses_in_input_order,
          coalesce(
            jsonb_agg(
              use_cue.use_cue
              ORDER BY
                use_cue.source_order_ordinal,
                use_cue.use_cue->>'definition_use_cue_id' COLLATE "C"
            ) FILTER (WHERE use_cue.use_cue IS NOT NULL),
            '[]'::jsonb
          ) AS uses_in_canonical_order,
          coalesce(
            jsonb_agg(
              to_jsonb(use_cue.use_cue->>'definition_use_cue_id')
              ORDER BY use_cue.use_array_ordinal
            ) FILTER (WHERE use_cue.use_cue IS NOT NULL),
            '[]'::jsonb
          ) AS use_ids_in_input_order,
          coalesce(bool_or(use_cue.invalid), false) AS contains_invalid_use
        FROM typed_graphs graph
        LEFT JOIN use_checks use_cue
          ON use_cue.graph_input_ordinal = graph.graph_input_ordinal
        GROUP BY graph.graph_input_ordinal
      ),
      prepared_graph_ids AS (
        SELECT
          graph.graph_input_ordinal,
          CASE
            WHEN graph.shape_valid
              AND graph.cue_count BETWEEN 0 AND 4096
              AND graph.use_count BETWEEN 0 AND 4096
              AND graph.cue_id_count BETWEEN 0 AND 4096
              AND graph.use_id_count BETWEEN 0 AND 4096
              AND nested.nested_member_count <= 16384
              AND request_children.child_count <= 16384
              AND request_nested.nested_member_count <= 16384
              AND request_ids.id_member_count <= 16384
              AND admitted.canonical_text_id IS NOT NULL
              AND cues.cue_count = graph.cue_count
              AND uses.use_count = graph.use_count
              AND cues.distinct_cue_id_count = cues.cue_count
              AND uses.distinct_use_id_count = uses.use_count
              AND cues.contains_invalid_cue IS NOT DISTINCT FROM false
              AND uses.contains_invalid_use IS NOT DISTINCT FROM false
              AND cues.cues_in_input_order
                IS NOT DISTINCT FROM graph.graph->'definition_cues'
              AND cues.cues_in_canonical_order
                IS NOT DISTINCT FROM graph.graph->'definition_cues'
              AND cues.cue_ids_in_input_order
                IS NOT DISTINCT FROM graph.graph->'definition_cue_ids'
              AND uses.uses_in_input_order
                IS NOT DISTINCT FROM graph.graph->'definition_use_cues'
              AND uses.uses_in_canonical_order
                IS NOT DISTINCT FROM graph.graph->'definition_use_cues'
              AND uses.use_ids_in_input_order
                IS NOT DISTINCT FROM graph.graph->'definition_use_cue_ids'
            THEN canonical_v2_staging.content_id(
              'VALIDATED_SEMANTIC_GRAPH/V1',
              jsonb_build_object(
                'document_hash', graph.graph->'document_hash',
                'canonical_text_id', graph.graph->'canonical_text_id',
                'definition_cue_ids', cues.cue_ids_in_input_order,
                'definition_use_cue_ids', uses.use_ids_in_input_order
              )
            )
          END AS expected_graph_id
        FROM typed_graphs graph
        JOIN graph_nested_counts nested
          ON nested.graph_input_ordinal = graph.graph_input_ordinal
        CROSS JOIN request_child_counts request_children
        CROSS JOIN request_nested_counts request_nested
        CROSS JOIN request_id_counts request_ids
        JOIN cue_rollups cues
          ON cues.graph_input_ordinal = graph.graph_input_ordinal
        JOIN use_rollups uses
          ON uses.graph_input_ordinal = graph.graph_input_ordinal
        LEFT JOIN admitted_sources admitted
          ON admitted.canonical_text_id = graph.graph->>'canonical_text_id'
          AND admitted.document_hash = graph.graph->>'document_hash'
      )
      SELECT 1
      FROM typed_graphs graph
      JOIN graph_nested_counts nested
        ON nested.graph_input_ordinal = graph.graph_input_ordinal
      CROSS JOIN request_child_counts request_children
      CROSS JOIN request_nested_counts request_nested
      CROSS JOIN request_id_counts request_ids
      JOIN cue_rollups cues
        ON cues.graph_input_ordinal = graph.graph_input_ordinal
      JOIN use_rollups uses
        ON uses.graph_input_ordinal = graph.graph_input_ordinal
      JOIN prepared_graph_ids prepared
        ON prepared.graph_input_ordinal = graph.graph_input_ordinal
      LEFT JOIN admitted_sources admitted
        ON admitted.canonical_text_id = graph.graph->>'canonical_text_id'
        AND admitted.document_hash = graph.graph->>'document_hash'
      WHERE CASE
        WHEN graph.shape_valid
          AND graph.cue_count BETWEEN 0 AND 4096
          AND graph.use_count BETWEEN 0 AND 4096
          AND graph.cue_id_count BETWEEN 0 AND 4096
          AND graph.use_id_count BETWEEN 0 AND 4096
          AND nested.nested_member_count <= 16384
          AND request_children.child_count <= 16384
          AND request_nested.nested_member_count <= 16384
          AND request_ids.id_member_count <= 16384
        THEN
          admitted.canonical_text_id IS NULL
          OR cues.cue_count <> graph.cue_count
          OR uses.use_count <> graph.use_count
          OR cues.distinct_cue_id_count <> cues.cue_count
          OR uses.distinct_use_id_count <> uses.use_count
          OR cues.contains_invalid_cue
          OR uses.contains_invalid_use
          OR cues.cues_in_input_order
            IS DISTINCT FROM graph.graph->'definition_cues'
          OR cues.cues_in_canonical_order
            IS DISTINCT FROM graph.graph->'definition_cues'
          OR cues.cue_ids_in_input_order
            IS DISTINCT FROM graph.graph->'definition_cue_ids'
          OR uses.uses_in_input_order
            IS DISTINCT FROM graph.graph->'definition_use_cues'
          OR uses.uses_in_canonical_order
            IS DISTINCT FROM graph.graph->'definition_use_cues'
          OR uses.use_ids_in_input_order
            IS DISTINCT FROM graph.graph->'definition_use_cue_ids'
          OR prepared.expected_graph_id IS NULL
          OR graph.graph->>'validated_semantic_graph_id'
            IS DISTINCT FROM prepared.expected_graph_id
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN validated semantic graph identity, child identity or source bytes are invalid'
        USING ERRCODE = '23514';
    END IF;

    -- PLAN.md Step 4A2. conditional_termination_fee_values carries no
    -- closure_id (see the table's own comment above), so it is checked in
    -- its own self-contained block rather than folded into the generic
    -- closure-keyed loops that follow: those loops assume every collection
    -- object has a closure_id field, and this kind genuinely does not have
    -- one -- silently including it there would make every one of those
    -- checks pass vacuously (NULL, not TRUE) for this collection instead of
    -- validating it, which is worse than a missing check because it reads
    -- as covered. The exact 11-key contract and every field constraint below
    -- mirror lib/canonical-v2/native-producer/conditional-termination-fee-
    -- value.js's buildConditionalTerminationFeeValue exactly: SIDES,
    -- BRANCHES, the base_amount regex, currency/operator literals, and the
    -- >=2-length lineage/citation arrays it requires. Fails closed: an
    -- unrecognised schema_version, an extra key, a wrong-shaped array
    -- element or a mismatched content-addressed id are all rejected by the
    -- same single message, which names the shape rather than any lineage --
    -- this kind has no lineage to name.
    IF EXISTS (
      WITH supplied_conditional_termination_fee_values AS (
        SELECT conditional_fee.value AS conditional_fee
        FROM jsonb_array_elements(
          coalesce(p_write_set->'conditional_termination_fee_values', '[]'::jsonb)
        ) conditional_fee(value)
      ),
      typed_conditional_termination_fee_values AS (
        SELECT
          supplied.conditional_fee,
          (
            jsonb_typeof(supplied.conditional_fee) = 'object'
            AND supplied.conditional_fee ?& ARRAY[
              'schema_version', 'fee_side', 'triggering_branch', 'base_amount',
              'currency', 'operator', 'reit_limit_cap_term_ref',
              'defined_term_lineage', 'source_citations', 'raw_formula',
              'conditional_termination_fee_value_id'
            ]
            AND supplied.conditional_fee - ARRAY[
              'schema_version', 'fee_side', 'triggering_branch', 'base_amount',
              'currency', 'operator', 'reit_limit_cap_term_ref',
              'defined_term_lineage', 'source_citations', 'raw_formula',
              'conditional_termination_fee_value_id'
            ]::text[] = '{}'::jsonb
            AND supplied.conditional_fee->>'schema_version'
              = 'CONDITIONAL_TERMINATION_FEE_VALUE/V1'
            AND supplied.conditional_fee->>'fee_side' IN ('SELLER', 'BUYER')
            AND supplied.conditional_fee->>'triggering_branch' IN (
              '7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)', '7.3(b)(iv)',
              '7.3(b)(v)', '7.3(c)'
            )
            AND jsonb_typeof(supplied.conditional_fee->'base_amount') = 'string'
            AND supplied.conditional_fee->>'base_amount' ~ '^[0-9]+(\.[0-9]+)?$'
            AND supplied.conditional_fee->>'currency' = 'USD'
            AND supplied.conditional_fee->>'operator' = 'LOWER_OF'
            AND jsonb_typeof(supplied.conditional_fee->'reit_limit_cap_term_ref')
              = 'string'
            AND coalesce(
              length(supplied.conditional_fee->>'reit_limit_cap_term_ref'), 0
            ) > 0
            AND jsonb_typeof(supplied.conditional_fee->'raw_formula') = 'string'
            AND coalesce(length(supplied.conditional_fee->>'raw_formula'), 0) > 0
            AND jsonb_typeof(supplied.conditional_fee->'defined_term_lineage')
              = 'array'
            AND jsonb_array_length(
              supplied.conditional_fee->'defined_term_lineage'
            ) >= 2
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                supplied.conditional_fee->'defined_term_lineage'
              ) lineage_entry(value)
              WHERE jsonb_typeof(lineage_entry.value) <> 'string'
            )
            AND jsonb_typeof(supplied.conditional_fee->'source_citations')
              = 'array'
            AND jsonb_array_length(supplied.conditional_fee->'source_citations')
              >= 2
            AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                supplied.conditional_fee->'source_citations'
              ) citation_entry(value)
              WHERE jsonb_typeof(citation_entry.value) <> 'string'
            )
            AND jsonb_typeof(
              supplied.conditional_fee->'conditional_termination_fee_value_id'
            ) = 'string'
            AND supplied.conditional_fee->>'conditional_termination_fee_value_id'
              ~ '^[0-9a-f]{64}$'
          ) AS shape_valid
        FROM supplied_conditional_termination_fee_values supplied
      )
      SELECT 1
      FROM typed_conditional_termination_fee_values supplied
      WHERE CASE
        WHEN supplied.shape_valid THEN
          supplied.conditional_fee->>'conditional_termination_fee_value_id'
            IS DISTINCT FROM canonical_v2_staging.content_id(
              'CONDITIONAL_TERMINATION_FEE_VALUE/V1',
              supplied.conditional_fee - 'conditional_termination_fee_value_id'
            )
        ELSE true
      END
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN conditional termination fee value shape is invalid'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        coalesce(p_write_set->'conditional_termination_fee_values', '[]'::jsonb)
      ) conditional_fee(value)
      GROUP BY conditional_fee.value->>'conditional_termination_fee_value_id'
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'DEAL_SCOPE_RUN contains duplicate conditional termination fee values'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_each(p_write_set) AS collection(key, value)
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN collection.key NOT IN (
          'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
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
          WHEN 'definition_occurrences'
            THEN object.value->>'definition_occurrence_id'
          WHEN 'provisions' THEN object.value->>'provision_instance_id'
          WHEN 'components' THEN object.value->>'provision_component_id'
          WHEN 'condition_groups'
            THEN object.value->>'condition_group_revision_id'
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
          'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
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
            'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
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
          'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
      )
        AND (
          jsonb_typeof(object.value) <> 'object'
          OR object.value->>'closure_id' !~ '^[0-9a-f]{64}$'
          OR (CASE collection.key
            WHEN 'excerpts' THEN object.value->>'excerpt_id'
            WHEN 'validated_semantic_graphs' THEN object.value->>'validated_semantic_graph_id'
            WHEN 'definition_occurrences' THEN object.value->>'definition_occurrence_id'
            WHEN 'provisions' THEN object.value->>'provision_instance_id'
            WHEN 'components' THEN object.value->>'provision_component_id'
            WHEN 'condition_groups'
              THEN object.value->>'condition_group_revision_id'
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
          'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
      )
      GROUP BY collection.key, CASE collection.key
        WHEN 'excerpts' THEN object.value->>'excerpt_id'
        WHEN 'validated_semantic_graphs' THEN object.value->>'validated_semantic_graph_id'
        WHEN 'definition_occurrences' THEN object.value->>'definition_occurrence_id'
        WHEN 'provisions' THEN object.value->>'provision_instance_id'
        WHEN 'components' THEN object.value->>'provision_component_id'
        WHEN 'condition_groups'
          THEN object.value->>'condition_group_revision_id'
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
          'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
        ) THEN collection.value
        ELSE '[]'::jsonb
      END) AS object(value)
      JOIN jsonb_array_elements(p_quarantines) AS quarantine(value)
        ON quarantine.value->>'closure_id' = object.value->>'closure_id'
      WHERE collection.key NOT IN (
        'source_references', 'deal', 'persisted_object_references', 'conditional_termination_fee_values'
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
      || coalesce(p_write_set->'definition_occurrences', '[]'::jsonb)
      || coalesce(p_write_set->'provisions', '[]'::jsonb)
      || coalesce(p_write_set->'components', '[]'::jsonb)
      || coalesce(p_write_set->'condition_groups', '[]'::jsonb)
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
  IF p_operation = 'DEAL_SCOPE_RUN' THEN
    item_id := item->>'deal_admission_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.deal_admission_records
    WHERE deal_admission_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical deal admission identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.deal_admission_records(
      deal_admission_id,
      deal_key,
      document_hash,
      canonical_payload
    ) VALUES (
      item_id,
      item->>'deal_key',
      item->>'document_hash',
      item
    ) ON CONFLICT (deal_admission_id) DO NOTHING;
    IF NOT EXISTS (
      SELECT 1
      FROM canonical_v2_staging.deal_admission_records admission
      WHERE admission.deal_admission_id = item_id
        AND admission.deal_key = item->>'deal_key'
        AND admission.document_hash = item->>'document_hash'
        AND admission.canonical_payload_digest =
          canonical_v2_staging.payload_digest(item)
    ) THEN
      RAISE EXCEPTION 'canonical deal admission identity conflict'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    item_id := item->>'deal_key';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.deals
    WHERE deal_key = item_id;
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
    FROM jsonb_array_elements(
      coalesce(p_write_set->'definition_occurrences', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'definition_occurrence_id'
  LOOP
    item_id := item->>'definition_occurrence_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.definition_occurrences
    WHERE definition_occurrence_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical definition occurrence identity conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.definition_occurrences(
      definition_occurrence_id, closure_id, canonical_text_id, document_hash, canonical_payload
    ) VALUES (
      item_id, item->>'closure_id', item->>'canonical_text_id', item->>'document_hash', item
    ) ON CONFLICT (definition_occurrence_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.definition_occurrences
    WHERE definition_occurrence_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical definition occurrence identity conflict' USING ERRCODE = '23505';
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
    FROM jsonb_array_elements(coalesce(p_write_set->'condition_groups', '[]'::jsonb))
      AS ordered_item(value)
    ORDER BY ordered_item.value->>'condition_group_revision_id'
  LOOP
    item_id := item->>'condition_group_revision_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.condition_group_revisions
    WHERE condition_group_revision_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical condition group identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.condition_group_revisions(
      condition_group_revision_id, closure_id, canonical_payload
    ) VALUES (
      item_id, item->>'closure_id', item
    ) ON CONFLICT (condition_group_revision_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.condition_group_revisions
    WHERE condition_group_revision_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical condition group identity conflict'
        USING ERRCODE = '23505';
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
    FROM jsonb_array_elements(
      coalesce(p_write_set->'conditional_termination_fee_values', '[]'::jsonb)
    ) AS ordered_item(value)
    ORDER BY ordered_item.value->>'conditional_termination_fee_value_id'
  LOOP
    item_id := item->>'conditional_termination_fee_value_id';
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.conditional_termination_fee_values
    WHERE conditional_termination_fee_value_id = item_id;
    IF FOUND AND existing_digest <> canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical conditional termination fee value identity conflict'
        USING ERRCODE = '23505';
    END IF;
    INSERT INTO canonical_v2_staging.conditional_termination_fee_values(
      conditional_termination_fee_value_id, fee_side, triggering_branch, canonical_payload
    ) VALUES (
      item_id, item->>'fee_side', item->>'triggering_branch', item
    ) ON CONFLICT (conditional_termination_fee_value_id) DO NOTHING;
    SELECT canonical_payload_digest INTO existing_digest
    FROM canonical_v2_staging.conditional_termination_fee_values
    WHERE conditional_termination_fee_value_id = item_id;
    IF existing_digest IS DISTINCT FROM canonical_v2_staging.payload_digest(item) THEN
      RAISE EXCEPTION 'canonical conditional termination fee value identity conflict'
        USING ERRCODE = '23505';
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
REVOKE ALL ON FUNCTION canonical_v2_staging.validate_process_phrasebook_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
REVOKE ALL ON FUNCTION canonical_v2_staging.validate_agreement_candidate_product_carrier(jsonb)
  FROM PUBLIC, anon, authenticated, service_role, canonical_v2_writer;
COMMIT;
