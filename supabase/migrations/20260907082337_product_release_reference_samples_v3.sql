CREATE OR REPLACE FUNCTION product_private.product_phase3_list_reference_sources(p_actor text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'source_document_id', source.source_document_id,
    'retrieval_url', source.retrieval_url,
    'parties', coalesce(source.payload->'parties', '[]'::jsonb)
  ) ORDER BY source.retrieval_url, source.source_document_id), '[]'::jsonb)
  FROM public.product_source_documents source
  WHERE coalesce(p_actor, '') <> '' AND EXISTS (
    SELECT 1
    FROM public.product_analysis_runs run
    JOIN public.product_run_access access ON access.run_id = run.run_id
    WHERE run.source_document_id = source.source_document_id
      AND run.status = 'READY'
      AND access.actor = p_actor
  )
$$;

CREATE OR REPLACE FUNCTION public.product_phase3_list_reference_sources(p_actor text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_list_reference_sources(p_actor)
$$;

REVOKE ALL ON FUNCTION public.product_phase3_list_reference_sources(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_list_reference_sources(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase3_list_reference_sources(text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_list_reference_sources(text) TO service_role;

CREATE OR REPLACE FUNCTION product_private.product_phase3_save_review(
  p_run_id uuid, p_expected_version integer, p_state jsonb, p_actor text, p_event_type text,
  p_action_id text, p_idempotency_key text, p_command jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  session_row public.product_review_sessions;
  processing_started_at timestamptz;
  processing_completed_at timestamptz;
  evaluation_state jsonb;
  submitted_minutes numeric;
  measured_review_seconds numeric;
  processing_minutes numeric;
  effective_elapsed_minutes numeric;
  reported_processing_minutes numeric;
  reported_effective_minutes numeric;
  evaluation_version text;
  reported_timing_bar boolean;
  expected_timing_bar boolean;
  expected_reference_sample_bar boolean;
  reference_sample_count integer;
  reference_sample_missed_count integer;
  reference_sample_incorrect_count integer;
  reference_sample_unresolved_count integer;
  reference_sample_total_weight numeric;
  reference_sample_found_weight numeric;
  expected_reference_sample_success_rate numeric;
BEGIN
  IF p_event_type IN ('EVALUATE_RELEASE', 'ACTIVATE_RELEASE') THEN
    IF EXISTS (
      SELECT 1 FROM public.product_review_actions
      WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN product_private.product_phase3_save_review_legacy(
        p_run_id, p_expected_version, p_state, p_actor, p_event_type,
        p_action_id, p_idempotency_key, p_command
      );
    END IF;
    SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'review session not found' USING ERRCODE = '23503'; END IF;
    SELECT run.created_at, analysis.created_at
      INTO processing_started_at, processing_completed_at
    FROM public.product_analysis_runs run
    JOIN public.product_draft_analyses analysis ON analysis.run_id = run.run_id
    WHERE run.run_id = p_run_id;
    IF processing_started_at IS NULL OR processing_completed_at IS NULL
      OR processing_completed_at < processing_started_at THEN
      RAISE EXCEPTION 'release timing is not available' USING ERRCODE = '55000';
    END IF;

    IF p_event_type = 'EVALUATE_RELEASE' THEN
      evaluation_state := p_state;
      IF p_command->'elapsed_minutes' IS DISTINCT FROM p_state->'release_evaluation_input'->'elapsed_minutes'
        OR p_command->'developer_assisted' IS DISTINCT FROM p_state->'release_evaluation_input'->'developer_assisted' THEN
        RAISE EXCEPTION 'release timing input mismatch' USING ERRCODE = '22023';
      END IF;
    ELSE
      evaluation_state := session_row.state;
      IF p_state->'release_evaluation_input' IS DISTINCT FROM session_row.state->'release_evaluation_input'
        OR p_state->'release_evaluation' IS DISTINCT FROM session_row.state->'release_evaluation' THEN
        RAISE EXCEPTION 'release timing state mismatch' USING ERRCODE = '22023';
      END IF;
    END IF;

    evaluation_version := evaluation_state->'release_evaluation'->>'schema_version';
    IF evaluation_version IS NULL
      OR evaluation_version NOT IN ('PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1', 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2', 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V3')
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation_input'->'elapsed_minutes'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation_input'->'developer_assisted'), '') <> 'boolean'
      OR coalesce(jsonb_typeof(session_row.state->'metrics'->'review_time_seconds'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'processing_minutes'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'effective_elapsed_minutes'), '') <> 'number'
      OR (evaluation_version = 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1'
        AND coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'bars'->'review_within_ninety_minutes_without_developer'), '') <> 'boolean')
      OR (evaluation_version IN ('PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2', 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V3')
        AND coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'bars'->'timing_measured_without_developer'), '') <> 'boolean') THEN
      RAISE EXCEPTION 'release timing is incomplete' USING ERRCODE = '55000';
    END IF;

    IF evaluation_version = 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V3' THEN
      IF evaluation_state->'release_evaluation_input'->>'reference_samples_attested' IS DISTINCT FROM 'true'
        OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation_input'->'reference_samples'), '') <> 'array'
        OR jsonb_array_length(evaluation_state->'release_evaluation_input'->'reference_samples') = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(evaluation_state->'release_evaluation_input'->'reference_samples') sample
          WHERE coalesce(sample->>'reference_sample_id', '') = ''
            OR coalesce(sample->>'source_document_id', '') = ''
            OR coalesce(sample->>'source_section', '') = ''
            OR coalesce(sample->>'description', '') = ''
            OR coalesce(sample->>'source_url', '') !~ '^https://[^/@[:space:]]+(:[0-9]+)?(/|$)'
            OR coalesce(sample->>'severity', '') NOT IN ('CRITICAL', 'MATERIAL')
            OR coalesce(sample->>'assessment', '') NOT IN ('FOUND', 'MISSED', 'INCORRECT', 'UNRESOLVED')
            OR coalesce(sample->>'reviewed_by_role', '') <> 'LAWYER'
            OR (sample->>'assessment' = 'FOUND' AND coalesce(sample->>'comparison', '') = '')
            OR (sample->>'assessment' <> 'FOUND' AND coalesce(sample->>'reviewed_limitation', '') = '')
            OR NOT EXISTS (
              SELECT 1
              FROM public.product_analysis_runs source_run
              JOIN public.product_run_access source_access ON source_access.run_id = source_run.run_id
              WHERE source_run.source_document_id = sample->>'source_document_id'
                AND source_run.retrieval_url = sample->>'source_url'
                AND source_run.status = 'READY'
                AND source_access.actor = p_actor
            )
        )
        OR (SELECT count(*) FROM jsonb_array_elements(evaluation_state->'release_evaluation_input'->'reference_samples')) <>
          (SELECT count(DISTINCT sample->>'reference_sample_id') FROM jsonb_array_elements(evaluation_state->'release_evaluation_input'->'reference_samples') sample)
        OR EXISTS (SELECT 1 FROM jsonb_object_keys(evaluation_state->'release_evaluation'->'diagnostics') key
          WHERE key ~ '(recall|precision)')
        OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'reference_sample_success_rate'), '') <> 'number'
        OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'reference_sample_count'), '') <> 'number'
        OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'reference_sample_unresolved_count'), '') <> 'number'
        OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'bars'->'reference_samples_reviewed'), '') <> 'boolean' THEN
        RAISE EXCEPTION 'release reference samples are incomplete' USING ERRCODE = '55000';
      END IF;
      SELECT count(*)::integer,
        count(*) FILTER (WHERE sample->>'assessment' = 'MISSED')::integer,
        count(*) FILTER (WHERE sample->>'assessment' = 'INCORRECT')::integer,
        count(*) FILTER (WHERE sample->>'assessment' = 'UNRESOLVED')::integer,
        sum(CASE sample->>'severity' WHEN 'CRITICAL' THEN 3 ELSE 1 END),
        sum(CASE WHEN sample->>'assessment' = 'FOUND'
          THEN CASE sample->>'severity' WHEN 'CRITICAL' THEN 3 ELSE 1 END ELSE 0 END)
        INTO reference_sample_count, reference_sample_missed_count, reference_sample_incorrect_count,
          reference_sample_unresolved_count, reference_sample_total_weight, reference_sample_found_weight
      FROM jsonb_array_elements(evaluation_state->'release_evaluation_input'->'reference_samples') sample;
      expected_reference_sample_success_rate := reference_sample_found_weight / reference_sample_total_weight;
      IF (evaluation_state->'release_evaluation'->'diagnostics'->>'reference_sample_count')::integer <> reference_sample_count
        OR coalesce((evaluation_state->'release_evaluation'->'diagnostics'->>'reference_sample_missed_count')::integer, -1) <> reference_sample_missed_count
        OR coalesce((evaluation_state->'release_evaluation'->'diagnostics'->>'reference_sample_incorrect_count')::integer, -1) <> reference_sample_incorrect_count
        OR (evaluation_state->'release_evaluation'->'diagnostics'->>'reference_sample_unresolved_count')::integer <> reference_sample_unresolved_count
        OR abs((evaluation_state->'release_evaluation'->'diagnostics'->>'reference_sample_success_rate')::numeric
          - expected_reference_sample_success_rate) > 0.000001 THEN
        RAISE EXCEPTION 'release reference sample diagnostics mismatch' USING ERRCODE = '55000';
      END IF;
      expected_reference_sample_bar := NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(evaluation_state->'release_evaluation_input'->'reference_samples') sample
        WHERE sample->>'assessment' = 'UNRESOLVED'
      );
      IF (evaluation_state->'release_evaluation'->'bars'->>'reference_samples_reviewed')::boolean
          IS DISTINCT FROM expected_reference_sample_bar
        OR (NOT expected_reference_sample_bar AND evaluation_state->'release_evaluation'->>'passed' = 'true') THEN
        RAISE EXCEPTION 'release reference sample result mismatch' USING ERRCODE = '55000';
      END IF;
    END IF;

    submitted_minutes := (evaluation_state->'release_evaluation_input'->>'elapsed_minutes')::numeric;
    measured_review_seconds := (session_row.state->'metrics'->>'review_time_seconds')::numeric;
    processing_minutes := extract(epoch FROM (processing_completed_at - processing_started_at)) / 60.0;
    effective_elapsed_minutes := greatest(submitted_minutes, processing_minutes + measured_review_seconds / 60.0);
    reported_processing_minutes := (evaluation_state->'release_evaluation'->'diagnostics'->>'processing_minutes')::numeric;
    reported_effective_minutes := (evaluation_state->'release_evaluation'->'diagnostics'->>'effective_elapsed_minutes')::numeric;
    reported_timing_bar := CASE evaluation_version
      WHEN 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1' THEN
        (evaluation_state->'release_evaluation'->'bars'->>'review_within_ninety_minutes_without_developer')::boolean
      ELSE (evaluation_state->'release_evaluation'->'bars'->>'timing_measured_without_developer')::boolean
    END;
    expected_timing_bar := submitted_minutes >= 0
      AND measured_review_seconds >= 0
      AND (evaluation_version <> 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1'
        OR (measured_review_seconds <= 5400 AND effective_elapsed_minutes <= 90))
      AND (evaluation_state->'release_evaluation_input'->>'developer_assisted')::boolean = false;

    IF abs(reported_processing_minutes - processing_minutes) > 0.001
      OR abs(reported_effective_minutes - effective_elapsed_minutes) > 0.001
      OR reported_timing_bar IS DISTINCT FROM expected_timing_bar
      OR (NOT expected_timing_bar AND evaluation_state->'release_evaluation'->>'passed' = 'true')
      OR (p_event_type = 'ACTIVATE_RELEASE' AND (
        NOT expected_timing_bar OR evaluation_state->'release_evaluation'->>'passed' IS DISTINCT FROM 'true'
      )) THEN
      RAISE EXCEPTION 'release timing mismatch' USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN product_private.product_phase3_save_review_legacy(
    p_run_id, p_expected_version, p_state, p_actor, p_event_type,
    p_action_id, p_idempotency_key, p_command
  );
END;
$$;
