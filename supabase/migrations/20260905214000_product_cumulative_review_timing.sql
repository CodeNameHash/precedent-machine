CREATE FUNCTION product_private.product_phase3_restore_review_cumulative_timing(
  p_run_id uuid, p_expected_version integer, p_restore_version integer, p_actor text,
  p_action_id text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  session_row public.product_review_sessions;
  restored jsonb;
  live_timing jsonb;
  next_version integer;
  command jsonb;
  existing_action public.product_review_actions;
  latest_publication public.product_review_publications;
  accumulated_seconds bigint;
  active_draft_started_at timestamptz;
  restored_at timestamptz := statement_timestamp();
BEGIN
  IF coalesce(p_actor, '') = '' OR coalesce(p_action_id, '') = '' OR coalesce(p_idempotency_key, '') = '' THEN
    RAISE EXCEPTION 'actor and action identity are required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor) THEN
    RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501';
  END IF;
  command := jsonb_build_object('type', 'RESTORE', 'restore_version', p_restore_version);
  IF p_action_id <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    p_run_id::text || chr(31) || p_actor || chr(31) || p_idempotency_key, 'UTF8'), 'sha256'::text), 'hex') THEN
    RAISE EXCEPTION 'invalid review action identity' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO existing_action FROM public.product_review_actions
    WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_action.action_id <> p_action_id OR existing_action.actor <> p_actor OR existing_action.command <> command THEN
      RAISE EXCEPTION 'review action idempotency collision' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id;
    RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
  END IF;

  SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'review session not found' USING ERRCODE = '23503'; END IF;
  IF session_row.version <> p_expected_version THEN RAISE EXCEPTION 'review optimistic lock conflict' USING ERRCODE = '40001'; END IF;
  SELECT state INTO restored FROM public.product_review_revisions
    WHERE run_id = p_run_id AND version = p_restore_version;
  IF restored IS NULL OR restored->>'status' <> 'DRAFT' THEN
    RAISE EXCEPTION 'only a draft revision can be restored' USING ERRCODE = '22023';
  END IF;

  IF session_row.state->'review_timing' IS NOT NULL
    AND session_row.state->'review_timing' IS DISTINCT FROM 'null'::jsonb THEN
    IF session_row.state->'review_timing'->>'schema_version' IS DISTINCT FROM 'PRODUCT_REVIEW_TIMING/V1' THEN
      RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
    END IF;
    IF coalesce(session_row.state->'review_timing'->>'accumulated_draft_seconds', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
    END IF;
    accumulated_seconds := (session_row.state->'review_timing'->>'accumulated_draft_seconds')::bigint;
    IF session_row.status = 'DRAFT' THEN
      BEGIN
        active_draft_started_at := (session_row.state->'review_timing'->>'active_draft_started_at')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
      END;
    ELSIF session_row.status = 'PUBLISHED' THEN
      IF session_row.state->'review_timing'->'active_draft_started_at' IS DISTINCT FROM 'null'::jsonb THEN
        RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
      END IF;
      active_draft_started_at := restored_at;
    ELSE
      RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
    END IF;
  ELSE
    SELECT * INTO latest_publication FROM public.product_review_publications
      WHERE run_id = p_run_id ORDER BY publication_version DESC LIMIT 1;
    IF FOUND THEN
      IF coalesce(latest_publication.metrics->>'review_time_seconds', '') !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
      END IF;
      accumulated_seconds := (latest_publication.metrics->>'review_time_seconds')::bigint;
      IF session_row.status = 'PUBLISHED' THEN
        active_draft_started_at := restored_at;
      ELSIF session_row.status = 'DRAFT' THEN
        SELECT revision.created_at INTO active_draft_started_at
        FROM public.product_review_revisions revision
        WHERE revision.run_id = p_run_id
          AND revision.version > latest_publication.review_version
          AND revision.state->>'status' = 'DRAFT'
        ORDER BY revision.version ASC LIMIT 1;
      END IF;
    ELSIF session_row.status = 'DRAFT' THEN
      accumulated_seconds := 0;
      BEGIN
        active_draft_started_at := (session_row.state->>'started_at')::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
      END;
    END IF;
  END IF;

  IF accumulated_seconds IS NULL OR accumulated_seconds < 0
    OR active_draft_started_at IS NULL OR active_draft_started_at > restored_at
    OR session_row.state->'started_at' IS NULL THEN
    RAISE EXCEPTION 'review timing is unavailable' USING ERRCODE = '55000';
  END IF;
  live_timing := jsonb_build_object(
    'schema_version', 'PRODUCT_REVIEW_TIMING/V1',
    'accumulated_draft_seconds', accumulated_seconds,
    'active_draft_started_at', active_draft_started_at
  );
  restored := jsonb_set(restored, '{review_timing}', live_timing, true);
  restored := jsonb_set(restored, '{started_at}', session_row.state->'started_at', true);
  restored := jsonb_set(restored, '{updated_at}', to_jsonb(restored_at), true);

  PERFORM product_private.product_phase3_validate_review(p_run_id, restored, false);
  next_version := session_row.version + 1;
  UPDATE public.product_review_sessions SET version = next_version, status = 'DRAFT', state = restored, updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO session_row;
  INSERT INTO public.product_review_revisions(run_id, version, state, actor, event_type)
  VALUES (p_run_id, next_version, restored, p_actor, 'RESTORE');
  INSERT INTO public.product_review_actions(run_id, action_id, idempotency_key, review_version, actor, command)
  VALUES (p_run_id, p_action_id, p_idempotency_key, next_version, p_actor, command);
  RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
END;
$$;

CREATE OR REPLACE FUNCTION public.product_phase3_restore_review(
  p_run_id uuid, p_expected_version integer, p_restore_version integer, p_actor text,
  p_action_id text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_restore_review_cumulative_timing(
    p_run_id, p_expected_version, p_restore_version, p_actor, p_action_id, p_idempotency_key
  )
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_restore_review_cumulative_timing(uuid,integer,integer,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_restore_review_cumulative_timing(uuid,integer,integer,text,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.product_phase3_restore_review(uuid,integer,integer,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase3_restore_review(uuid,integer,integer,text,text,text)
  TO service_role;

CREATE FUNCTION product_private.product_phase3_get_review_with_timing_history(p_run_id uuid, p_actor text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_row public.product_review_sessions;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor) THEN
    RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'schema_version', 'PRODUCT_REVIEW_READ/V1', 'run_id', p_run_id,
    'version', session_row.version, 'status', session_row.status, 'state', session_row.state,
    'active_release_id', (SELECT h.release_id FROM public.product_agreement_release_heads h
      JOIN public.product_analysis_runs r ON r.source_document_id = h.source_document_id WHERE r.run_id = p_run_id),
    'revisions', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'version', version, 'actor', actor, 'event_type', event_type, 'created_at', created_at,
      'release_evaluation_diagnostics', state->'release_evaluation'->'diagnostics'
    ) ORDER BY version DESC) FROM public.product_review_revisions WHERE run_id = p_run_id), '[]'::jsonb),
    'publications', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'publication_version', publication_version, 'review_version', review_version,
      'summary_id', summary_id, 'summary', summary, 'metrics', metrics, 'published_at', published_at
    ) ORDER BY publication_version DESC) FROM public.product_review_publications WHERE run_id = p_run_id), '[]'::jsonb),
    'release_history', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'release_id', release_id, 'publication_version', publication_version, 'review_version', review_version,
      'supersedes_release_id', supersedes_release_id, 'published_by', published_by, 'published_at', published_at,
      'active', release_id = (SELECT h.release_id FROM public.product_agreement_release_heads h
        WHERE h.source_document_id = product_agreement_releases.source_document_id)
    ) ORDER BY publication_version DESC) FROM public.product_agreement_releases WHERE run_id = p_run_id), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.product_phase3_get_review(p_run_id uuid, p_actor text)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_get_review_with_timing_history(p_run_id, p_actor)
$$;

REVOKE ALL ON FUNCTION product_private.product_phase3_get_review_with_timing_history(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_get_review_with_timing_history(uuid,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.product_phase3_get_review(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase3_get_review(uuid,text)
  TO service_role;
