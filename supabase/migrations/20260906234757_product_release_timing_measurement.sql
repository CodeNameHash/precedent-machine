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
      OR evaluation_version NOT IN ('PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1', 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2')
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation_input'->'elapsed_minutes'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation_input'->'developer_assisted'), '') <> 'boolean'
      OR coalesce(jsonb_typeof(session_row.state->'metrics'->'review_time_seconds'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'processing_minutes'), '') <> 'number'
      OR coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'diagnostics'->'effective_elapsed_minutes'), '') <> 'number'
      OR (evaluation_version = 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V1'
        AND coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'bars'->'review_within_ninety_minutes_without_developer'), '') <> 'boolean')
      OR (evaluation_version = 'PRODUCT_SUPERVISED_RELEASE_EVALUATION/V2'
        AND coalesce(jsonb_typeof(evaluation_state->'release_evaluation'->'bars'->'timing_measured_without_developer'), '') <> 'boolean') THEN
      RAISE EXCEPTION 'release timing is incomplete' USING ERRCODE = '55000';
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
