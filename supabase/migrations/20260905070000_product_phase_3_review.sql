CREATE TABLE public.product_run_access (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  actor text NOT NULL,
  access_role text NOT NULL CHECK (access_role IN ('OWNER', 'REVIEWER', 'PUBLISHER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, actor)
);

CREATE TABLE public.product_run_retry_events (
  run_id uuid NOT NULL REFERENCES public.product_analysis_runs(run_id),
  idempotency_key text NOT NULL,
  actor text NOT NULL,
  retried_sections integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, idempotency_key)
);

CREATE TABLE public.product_review_sessions (
  run_id uuid PRIMARY KEY REFERENCES public.product_analysis_runs(run_id),
  draft_analysis_id text NOT NULL,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  status text NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED')),
  state jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_review_revisions (
  run_id uuid NOT NULL REFERENCES public.product_review_sessions(run_id),
  version integer NOT NULL CHECK (version >= 0),
  state jsonb NOT NULL,
  actor text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('INITIALISE', 'SAVE', 'PUBLISH', 'EVALUATE_RELEASE', 'ACTIVATE_RELEASE', 'ROLLBACK_RELEASE', 'REOPEN', 'RESTORE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, version)
);

CREATE TABLE public.product_review_publications (
  run_id uuid NOT NULL REFERENCES public.product_review_sessions(run_id),
  publication_version integer NOT NULL CHECK (publication_version >= 1),
  review_version integer NOT NULL,
  summary_id text NOT NULL,
  summary jsonb NOT NULL,
  metrics jsonb NOT NULL,
  published_at timestamptz NOT NULL,
  PRIMARY KEY (run_id, publication_version),
  UNIQUE (run_id, review_version)
);

CREATE TABLE public.product_review_actions (
  run_id uuid NOT NULL REFERENCES public.product_review_sessions(run_id),
  action_id text NOT NULL,
  idempotency_key text NOT NULL,
  review_version integer NOT NULL,
  actor text NOT NULL,
  command jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, action_id),
  UNIQUE (run_id, idempotency_key)
);

CREATE TABLE public.product_agreement_releases (
  release_id text PRIMARY KEY,
  source_document_id text NOT NULL REFERENCES public.product_source_documents(source_document_id),
  run_id uuid NOT NULL REFERENCES public.product_review_sessions(run_id),
  publication_version integer NOT NULL,
  review_version integer NOT NULL,
  supersedes_release_id text REFERENCES public.product_agreement_releases(release_id),
  summary jsonb NOT NULL,
  metrics jsonb NOT NULL,
  published_by text NOT NULL,
  published_at timestamptz NOT NULL,
  UNIQUE (run_id, publication_version)
);

CREATE TABLE public.product_agreement_release_heads (
  source_document_id text PRIMARY KEY REFERENCES public.product_source_documents(source_document_id),
  release_id text NOT NULL REFERENCES public.product_agreement_releases(release_id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER product_review_revisions_immutable BEFORE UPDATE OR DELETE ON public.product_review_revisions
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_review_publications_immutable BEFORE UPDATE OR DELETE ON public.product_review_publications
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_review_actions_immutable BEFORE UPDATE OR DELETE ON public.product_review_actions
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_agreement_releases_immutable BEFORE UPDATE OR DELETE ON public.product_agreement_releases
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();
CREATE TRIGGER product_run_retry_events_immutable BEFORE UPDATE OR DELETE ON public.product_run_retry_events
FOR EACH ROW EXECUTE FUNCTION public.product_reject_immutable_change();

CREATE FUNCTION product_private.product_phase3_validate_review(p_run_id uuid, p_state jsonb, p_for_publish boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(p_state->'items') <> 'array'
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' NOT IN ('PROPOSAL', 'USER_FACT', 'EXCEPTION_LINK', 'ISSUE', 'COVERAGE', 'IMMATERIAL_ROUTING')
        OR item->>'decision' NOT IN ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED')
        OR item->>'item_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
          (item->>'kind') || chr(31) || (item->>'source_id'), 'UTF8'), 'sha256'::text), 'hex'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_state->'items')) <>
      (SELECT count(DISTINCT item->>'item_id') FROM jsonb_array_elements(p_state->'items') item) THEN
    RAISE EXCEPTION 'invalid review items' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'PROPOSAL' AND item->>'source_id' = p.proposal_id
        AND item->>'source_closure_id' = p.source_closure_id
        AND item->'source_span_ids' = p.payload->'source_span_ids'
        AND item->'original' = p.payload))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'PROPOSAL' AND NOT EXISTS (
        SELECT 1 FROM public.product_proposals p WHERE p.run_id = p_run_id AND p.proposal_id = item->>'source_id')) THEN
    RAISE EXCEPTION 'review proposal graph mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_fact_links l WHERE l.run_id = p_run_id AND l.relationship_type = 'EXCEPTS'
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'source_id' = l.fact_link_id
          AND item->'original' = l.payload))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'EXCEPTION_LINK' AND NOT EXISTS (
        SELECT 1 FROM public.product_fact_links l WHERE l.run_id = p_run_id
          AND l.relationship_type = 'EXCEPTS' AND l.fact_link_id = item->>'source_id'
          AND l.payload = item->'original'))
    OR EXISTS (SELECT 1 FROM public.product_issues i WHERE i.run_id = p_run_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'ISSUE' AND item->>'source_id' = i.issue_id))
    OR EXISTS (SELECT 1 FROM public.product_coverage_assertions c WHERE c.run_id = p_run_id
      AND (c.state = 'UNRESOLVED'
        OR (c.state = 'NOT_FOUND' AND c.subject_kind IN ('FAMILY', 'FACT_TYPE'))
        OR (c.subject_kind = 'RESIDUAL_PARAGRAPH' AND c.payload->>'reason' = 'IMMATERIAL'))
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'COVERAGE'
          AND item->>'source_id' = c.coverage_assertion_id))
    OR EXISTS (SELECT 1 FROM public.product_section_routings r WHERE r.run_id = p_run_id AND r.disposition = 'IMMATERIAL'
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' = 'IMMATERIAL_ROUTING' AND item->>'source_id' = r.section_routing_id)) THEN
    RAISE EXCEPTION 'required review item is missing' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
    WHERE item->>'kind' = 'USER_FACT' AND (
      coalesce(item->>'structure_node_id', '') = '' OR coalesce(item->>'source_closure_id', '') = ''
      OR jsonb_array_length(item->'source_span_ids') = 0
      OR NOT EXISTS (SELECT 1 FROM public.product_source_closures c WHERE c.run_id = p_run_id
        AND c.source_closure_id = item->>'source_closure_id' AND c.structure_node_id = item->>'structure_node_id')
      OR item->>'source_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        (p_state->>'draft_analysis_id') || chr(31) || (item->>'structure_node_id') || chr(31)
        || (item->>'family_key') || chr(31) || (item->'original'->>'subtype_key') || chr(31)
        || (item->'original'->>'fact_type') || chr(31) || (item->'original'->>'statement') || chr(31)
        || (SELECT string_agg(value, ',' ORDER BY value) FROM jsonb_array_elements_text(item->'source_span_ids')), 'UTF8'), 'sha256'::text), 'hex')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(item->'source_span_ids') span_id WHERE NOT EXISTS (
        SELECT 1 FROM public.product_source_closure_spans cs WHERE cs.run_id = p_run_id
          AND cs.source_closure_id = item->>'source_closure_id' AND cs.span_id = span_id)))) THEN
    RAISE EXCEPTION 'user fact source mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item JOIN public.product_proposals p
      ON p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' = 'EDITED' AND (
      coalesce(item->>'edited_statement', '') = '' OR jsonb_typeof(item->'edited_roles') <> 'object'
      OR EXISTS (SELECT 1 FROM public.product_coverage_assertions c WHERE c.run_id = p_run_id
        AND c.subject_kind = 'ROLE' AND c.subject_id LIKE p.fact_occurrence_id || ':%'
        AND coalesce(item->'edited_roles'->>(c.payload->>'required_role'), '') = ''))) THEN
    RAISE EXCEPTION 'edited proposal is incomplete' USING ERRCODE = '22023';
  END IF;
  IF p_for_publish THEN
    IF p_state->'agreement_coverage'->>'decision' <> 'ACCEPTED'
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'PENDING')
      OR jsonb_typeof(p_state->'summary'->'families') <> 'array'
      OR (SELECT count(*) FROM jsonb_array_elements(p_state->'summary'->'families') family,
          jsonb_array_elements(family->'facts')) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED'))
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED')
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'summary'->'families') family,
          jsonb_array_elements(family->'facts') fact WHERE fact->>'review_item_id' = item->>'item_id'
            AND fact->>'source_closure_id' = item->>'source_closure_id'
            AND fact->'source_span_ids' = item->'source_span_ids'))
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') link_item
        WHERE link_item->>'kind' = 'EXCEPTION_LINK' AND link_item->>'decision' = 'ACCEPTED'
          AND (NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'from_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))
            OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'to_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))))
      OR (SELECT count(*) FROM jsonb_array_elements(p_state->'summary'->'relationships')) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED'
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'summary'->'relationships') relationship
            WHERE relationship->>'review_item_id' = item->>'item_id'
              AND (relationship - 'review_item_id' - 'source_closure_id' - 'source_span_ids') = (item->'original') - 'source_span_ids'
              AND relationship->>'source_closure_id' = item->>'source_closure_id'
              AND relationship->'source_span_ids' = item->'source_span_ids'))
      OR coalesce((p_state->'metrics'->>'proposal_count')::integer, -1) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'PROPOSAL')
      OR coalesce((p_state->'metrics'->>'proposal_errors')::integer, -1) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' IN ('EDITED', 'REJECTED'))
      OR coalesce((p_state->'metrics'->>'proposal_omissions')::integer, -1) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'USER_FACT')
      OR coalesce((p_state->'metrics'->>'unresolved_count')::integer, -1) <>
        (SELECT count(*) FROM jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'UNRESOLVED')
      OR coalesce((p_state->'metrics'->>'review_time_seconds')::integer, -1) < 0 THEN
      RAISE EXCEPTION 'published review summary mismatch' USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;

CREATE FUNCTION product_private.product_phase3_register_run_access(p_run_id uuid, p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(p_actor, '') = '' OR NOT EXISTS (SELECT 1 FROM public.product_analysis_runs WHERE run_id = p_run_id) THEN
    RAISE EXCEPTION 'invalid run access' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor <> p_actor) THEN
    RAISE EXCEPTION 'run already belongs to another actor' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.product_run_access(run_id, actor, access_role) VALUES (p_run_id, p_actor, 'OWNER')
    ON CONFLICT (run_id, actor) DO NOTHING;
  RETURN jsonb_build_object('run_id', p_run_id, 'actor', p_actor, 'access_role', 'OWNER');
END;
$$;

CREATE FUNCTION product_private.product_phase3_retry_run(p_run_id uuid, p_actor text, p_idempotency_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE changed integer; run_row public.product_analysis_runs;
BEGIN
  IF coalesce(p_idempotency_key, '') = '' OR NOT EXISTS (
    SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor
  ) THEN RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_run_retry_events WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key) THEN
    SELECT * INTO run_row FROM public.product_analysis_runs WHERE run_id = p_run_id;
    RETURN to_jsonb(run_row);
  END IF;
  UPDATE public.product_section_work SET status = 'PENDING', attempts = 0, worker_id = NULL,
    attempt_token = NULL, lease_expires_at = NULL, error = NULL
    WHERE run_id = p_run_id AND status = 'FAILED';
  GET DIAGNOSTICS changed = ROW_COUNT;
  INSERT INTO public.product_run_retry_events(run_id, idempotency_key, actor, retried_sections)
  VALUES (p_run_id, p_idempotency_key, p_actor, changed);
  UPDATE public.product_analysis_runs SET status = CASE WHEN changed > 0 THEN 'RUNNING' ELSE status END,
    stage = CASE WHEN changed > 0 THEN 'SECTION_ANALYSIS' ELSE stage END, error = NULL, updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO run_row;
  RETURN to_jsonb(run_row);
END;
$$;

CREATE FUNCTION product_private.product_phase3_initialise_review(p_run_id uuid, p_state jsonb, p_actor text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE analysis_row public.product_draft_analyses; session_row public.product_review_sessions;
BEGIN
  IF coalesce(p_actor, '') = '' OR p_state->>'schema_version' <> 'PRODUCT_REVIEW_STATE/V1'
    OR p_state->>'analysis_run_id' <> p_run_id::text OR p_state->>'status' <> 'DRAFT' THEN
    RAISE EXCEPTION 'invalid review state' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO analysis_row FROM public.product_draft_analyses WHERE run_id = p_run_id;
  IF NOT FOUND OR analysis_row.draft_analysis_id <> p_state->>'draft_analysis_id' THEN
    RAISE EXCEPTION 'draft analysis is not ready' USING ERRCODE = '55000';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor) THEN
    RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM product_private.product_phase3_validate_review(p_run_id, p_state, false);
  SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id FOR UPDATE;
  IF FOUND THEN
    IF session_row.draft_analysis_id <> p_state->>'draft_analysis_id'
      OR session_row.state->>'schema_version' <> p_state->>'schema_version' THEN
      RAISE EXCEPTION 'review initialisation collision' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
  END IF;
  INSERT INTO public.product_review_sessions(run_id, draft_analysis_id, version, status, state, started_at)
  VALUES (p_run_id, analysis_row.draft_analysis_id, 0, 'DRAFT', p_state, (p_state->>'started_at')::timestamptz)
  ;
  INSERT INTO public.product_review_revisions(run_id, version, state, actor, event_type)
  VALUES (p_run_id, 0, p_state, p_actor, 'INITIALISE') ON CONFLICT (run_id, version) DO NOTHING;
  SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id;
  RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
END;
$$;

CREATE FUNCTION product_private.product_phase3_save_review(
  p_run_id uuid, p_expected_version integer, p_state jsonb, p_actor text, p_event_type text,
  p_action_id text, p_idempotency_key text, p_command jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_row public.product_review_sessions; next_version integer; publication_version integer;
DECLARE existing_action public.product_review_actions; source_id text; prior_release text; created_release text;
DECLARE candidate_release public.product_agreement_releases; active_release public.product_agreement_releases;
BEGIN
  IF coalesce(p_actor, '') = '' OR p_event_type NOT IN ('SAVE', 'PUBLISH', 'EVALUATE_RELEASE', 'ACTIVATE_RELEASE', 'ROLLBACK_RELEASE', 'REOPEN')
    OR coalesce(p_action_id, '') = '' OR coalesce(p_idempotency_key, '') = '' OR p_command IS NULL
    OR p_state->>'schema_version' <> 'PRODUCT_REVIEW_STATE/V1'
    OR p_state->>'analysis_run_id' <> p_run_id::text
    OR p_state->>'status' NOT IN ('DRAFT', 'PUBLISHED') THEN
    RAISE EXCEPTION 'invalid review save' USING ERRCODE = '22023';
  END IF;
  IF p_action_id <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    p_run_id::text || chr(31) || p_actor || chr(31) || p_idempotency_key, 'UTF8'), 'sha256'::text), 'hex') THEN
    RAISE EXCEPTION 'invalid review action identity' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_run_access WHERE run_id = p_run_id AND actor = p_actor) THEN
    RAISE EXCEPTION 'run access denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO existing_action FROM public.product_review_actions
    WHERE run_id = p_run_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF existing_action.action_id <> p_action_id OR existing_action.actor <> p_actor OR existing_action.command <> p_command THEN
      RAISE EXCEPTION 'review action idempotency collision' USING ERRCODE = '23505';
    END IF;
    SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id;
    RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
  END IF;
  SELECT * INTO session_row FROM public.product_review_sessions WHERE run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'review session not found' USING ERRCODE = '23503'; END IF;
  IF session_row.version <> p_expected_version THEN RAISE EXCEPTION 'review optimistic lock conflict' USING ERRCODE = '40001'; END IF;
  IF session_row.draft_analysis_id <> p_state->>'draft_analysis_id' THEN RAISE EXCEPTION 'review draft collision' USING ERRCODE = '23505'; END IF;
  IF p_event_type = 'PUBLISH' THEN
    IF session_row.status <> 'DRAFT' OR p_state->>'status' <> 'PUBLISHED'
      OR p_state->'agreement_coverage'->>'decision' <> 'ACCEPTED'
      OR p_state->'summary' IS NULL OR p_state->'metrics' IS NULL
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'PENDING') THEN
      RAISE EXCEPTION 'review is not publishable' USING ERRCODE = '55000';
    END IF;
  ELSIF p_event_type = 'REOPEN' THEN
    IF session_row.status <> 'PUBLISHED' OR p_state->>'status' <> 'DRAFT'
      OR p_state->'agreement_coverage'->>'decision' <> 'PENDING'
      OR p_state->>'summary' IS NOT NULL OR p_state->>'metrics' IS NOT NULL
      OR p_state->>'published_at' IS NOT NULL
      OR p_state->>'release_evaluation_input' IS NOT NULL
      OR p_state->>'release_evaluation' IS NOT NULL THEN
      RAISE EXCEPTION 'published review was not reopened correctly' USING ERRCODE = '55000';
    END IF;
  ELSIF p_event_type = 'EVALUATE_RELEASE' THEN
    IF session_row.status <> 'PUBLISHED' OR p_state->>'status' <> 'PUBLISHED'
      OR p_state->'release_evaluation'->>'passed' IS NULL
      OR p_state->'release_evaluation_input' IS NULL THEN
      RAISE EXCEPTION 'release evaluation is incomplete' USING ERRCODE = '55000';
    END IF;
  ELSIF p_event_type = 'ACTIVATE_RELEASE' THEN
    IF session_row.status <> 'PUBLISHED' OR p_state->>'status' <> 'PUBLISHED'
      OR p_state->'release_evaluation'->>'passed' <> 'true'
      OR coalesce(p_command->>'release_id', '') = '' THEN
      RAISE EXCEPTION 'release is not eligible for activation' USING ERRCODE = '55000';
    END IF;
  ELSIF p_event_type = 'ROLLBACK_RELEASE' THEN
    IF p_state->>'status' <> session_row.status THEN
      RAISE EXCEPTION 'rollback cannot change review status' USING ERRCODE = '55000';
    END IF;
  ELSIF p_state->>'status' <> session_row.status THEN
    RAISE EXCEPTION 'status transition needs an explicit event' USING ERRCODE = '55000';
  END IF;
  PERFORM product_private.product_phase3_validate_review(p_run_id, p_state, p_event_type = 'PUBLISH');
  next_version := session_row.version + 1;
  UPDATE public.product_review_sessions SET version = next_version, status = p_state->>'status', state = p_state, updated_at = now()
    WHERE run_id = p_run_id RETURNING * INTO session_row;
  INSERT INTO public.product_review_revisions(run_id, version, state, actor, event_type)
  VALUES (p_run_id, next_version, p_state, p_actor, p_event_type);
  INSERT INTO public.product_review_actions(run_id, action_id, idempotency_key, review_version, actor, command)
  VALUES (p_run_id, p_action_id, p_idempotency_key, next_version, p_actor, p_command);
  IF p_event_type = 'PUBLISH' THEN
    SELECT coalesce(max(p.publication_version), 0) + 1 INTO publication_version
      FROM public.product_review_publications p WHERE p.run_id = p_run_id;
    INSERT INTO public.product_review_publications(run_id, publication_version, review_version, summary_id, summary, metrics, published_at)
    VALUES (p_run_id, publication_version, next_version, p_state->'summary'->>'summary_id', p_state->'summary', p_state->'metrics',
      (p_state->>'published_at')::timestamptz);
    SELECT source_document_id INTO source_id FROM public.product_analysis_runs WHERE run_id = p_run_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(source_id, 3));
    SELECT release_id INTO prior_release FROM public.product_agreement_release_heads WHERE source_document_id = source_id FOR UPDATE;
    created_release := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
      source_id || chr(31) || p_run_id::text || chr(31) || publication_version::text || chr(31)
      || (p_state->'summary'->>'summary_id'), 'UTF8'), 'sha256'::text), 'hex');
    INSERT INTO public.product_agreement_releases(release_id, source_document_id, run_id, publication_version,
      review_version, supersedes_release_id, summary, metrics, published_by, published_at)
    VALUES (created_release, source_id, p_run_id, publication_version, next_version, prior_release,
      p_state->'summary', p_state->'metrics', p_actor, (p_state->>'published_at')::timestamptz);
  ELSIF p_event_type = 'ACTIVATE_RELEASE' THEN
    SELECT source_document_id INTO source_id FROM public.product_analysis_runs WHERE run_id = p_run_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(source_id, 3));
    SELECT * INTO candidate_release FROM public.product_agreement_releases
      WHERE release_id = p_command->>'release_id' AND run_id = p_run_id FOR SHARE;
    IF NOT FOUND OR candidate_release.source_document_id <> source_id
      OR candidate_release.summary->>'summary_id' <> p_state->'summary'->>'summary_id' THEN
      RAISE EXCEPTION 'release candidate does not match this reviewed summary' USING ERRCODE = '55000';
    END IF;
    SELECT release_id INTO prior_release FROM public.product_agreement_release_heads
      WHERE source_document_id = source_id FOR UPDATE;
    IF prior_release IS DISTINCT FROM candidate_release.supersedes_release_id THEN
      RAISE EXCEPTION 'release candidate is stale' USING ERRCODE = '40001';
    END IF;
    INSERT INTO public.product_agreement_release_heads(source_document_id, release_id)
    VALUES (source_id, candidate_release.release_id) ON CONFLICT (source_document_id) DO UPDATE
      SET release_id = excluded.release_id, updated_at = now();
  ELSIF p_event_type = 'ROLLBACK_RELEASE' THEN
    SELECT source_document_id INTO source_id FROM public.product_analysis_runs WHERE run_id = p_run_id;
    PERFORM pg_advisory_xact_lock(hashtextextended(source_id, 3));
    SELECT r.* INTO active_release FROM public.product_agreement_release_heads h
      JOIN public.product_agreement_releases r ON r.release_id = h.release_id
      WHERE h.source_document_id = source_id FOR UPDATE OF h;
    IF NOT FOUND OR active_release.supersedes_release_id IS NULL THEN
      RAISE EXCEPTION 'no prior active release exists' USING ERRCODE = '55000';
    END IF;
    UPDATE public.product_agreement_release_heads SET release_id = active_release.supersedes_release_id, updated_at = now()
      WHERE source_document_id = source_id;
  END IF;
  RETURN jsonb_build_object('run_id', p_run_id, 'version', session_row.version, 'status', session_row.status, 'state', session_row.state);
END;
$$;

CREATE FUNCTION product_private.product_phase3_restore_review(
  p_run_id uuid, p_expected_version integer, p_restore_version integer, p_actor text,
  p_action_id text, p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE session_row public.product_review_sessions; restored jsonb; next_version integer; command jsonb;
DECLARE existing_action public.product_review_actions;
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

CREATE FUNCTION product_private.product_phase3_get_review(p_run_id uuid, p_actor text) RETURNS jsonb
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
    'revisions', coalesce((SELECT jsonb_agg(jsonb_build_object('version', version, 'actor', actor,
      'event_type', event_type, 'created_at', created_at) ORDER BY version DESC)
      FROM public.product_review_revisions WHERE run_id = p_run_id), '[]'::jsonb),
    'publications', coalesce((SELECT jsonb_agg(jsonb_build_object('publication_version', publication_version,
      'review_version', review_version, 'summary_id', summary_id, 'summary', summary, 'metrics', metrics,
      'published_at', published_at) ORDER BY publication_version DESC)
      FROM public.product_review_publications WHERE run_id = p_run_id), '[]'::jsonb),
    'release_history', coalesce((SELECT jsonb_agg(jsonb_build_object('release_id', release_id,
      'publication_version', publication_version, 'review_version', review_version,
      'supersedes_release_id', supersedes_release_id, 'published_by', published_by, 'published_at', published_at,
      'active', release_id = (SELECT h.release_id FROM public.product_agreement_release_heads h
        WHERE h.source_document_id = product_agreement_releases.source_document_id))
      ORDER BY publication_version DESC) FROM public.product_agreement_releases WHERE run_id = p_run_id), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.product_phase3_initialise_review(p_run_id uuid, p_state jsonb, p_actor text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_initialise_review(p_run_id, p_state, p_actor)
$$;
CREATE FUNCTION public.product_phase3_register_run_access(p_run_id uuid, p_actor text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_register_run_access(p_run_id, p_actor)
$$;
CREATE FUNCTION public.product_phase3_retry_run(p_run_id uuid, p_actor text, p_idempotency_key text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_retry_run(p_run_id, p_actor, p_idempotency_key)
$$;
CREATE FUNCTION public.product_phase3_save_review(p_run_id uuid, p_expected_version integer, p_state jsonb, p_actor text, p_event_type text,
  p_action_id text, p_idempotency_key text, p_command jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_save_review(p_run_id, p_expected_version, p_state, p_actor, p_event_type,
    p_action_id, p_idempotency_key, p_command)
$$;
CREATE FUNCTION public.product_phase3_restore_review(p_run_id uuid, p_expected_version integer, p_restore_version integer, p_actor text,
  p_action_id text, p_idempotency_key text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_restore_review(p_run_id, p_expected_version, p_restore_version, p_actor,
    p_action_id, p_idempotency_key)
$$;
CREATE FUNCTION public.product_phase3_get_review(p_run_id uuid, p_actor text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_phase3_get_review(p_run_id, p_actor)
$$;

ALTER TABLE public.product_review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_run_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_run_retry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_agreement_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_agreement_release_heads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_run_access, public.product_run_retry_events, public.product_review_sessions, public.product_review_revisions,
  public.product_review_publications, public.product_review_actions, public.product_agreement_releases, public.product_agreement_release_heads
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_run_access, public.product_run_retry_events, public.product_review_sessions, public.product_review_revisions,
  public.product_review_publications, public.product_review_actions, public.product_agreement_releases, public.product_agreement_release_heads TO service_role;

REVOKE ALL ON FUNCTION public.product_phase3_initialise_review(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase3_register_run_access(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase3_retry_run(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase3_restore_review(uuid,integer,integer,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_phase3_get_review(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_initialise_review(uuid,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_register_run_access(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_retry_run(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_restore_review(uuid,integer,integer,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_phase3_get_review(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.product_phase3_initialise_review(uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase3_register_run_access(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase3_retry_run(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase3_restore_review(uuid,integer,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_phase3_get_review(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_initialise_review(uuid,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_register_run_access(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_retry_run(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_save_review(uuid,integer,jsonb,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_restore_review(uuid,integer,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_phase3_get_review(uuid,text) TO service_role;
