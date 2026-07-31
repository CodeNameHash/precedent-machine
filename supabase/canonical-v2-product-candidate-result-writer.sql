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
      IF (p_write_set->'domain_carrier') - ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set'
        ]::text[] <> '{}'::jsonb
        OR NOT (p_write_set->'domain_carrier') ?& ARRAY[
          'schema_version', 'process_phrasebook_product_chain_id',
          'process_phrasebook_product_chain_payload_digest', 'complete_write_set'
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
