-- The note exemption in the database, matching the rule the review page and
-- lib/product/review-state.js already apply (Ben, 2026-10-25: "Notes stop
-- blocking publication").
--
-- A NOTE is an ISSUE whose original.kind is 'NOTE': the machine explaining
-- how it built a fact (a dropped conclusion cell, a normalised lean answer, a
-- list word order), not a decision about the fact. The review's publication
-- gate and its validator both refused while ANY item was PENDING, so the page
-- offered a publication the database then rejected with "review is not
-- publishable" (plan finding (281)). Both tests now exclude a PENDING note;
-- an UNRESOLVED note still blocks, as every other unresolved decision does.
--
-- The two functions replaced here are the ones that carry the rule today:
-- product_phase3_save_review_legacy (the PUBLISH gate) and
-- product_phase3_validate_review_immutable_sources (the publish-time
-- validator). Bodies are the current definitions with only those two
-- predicates changed. Apply, then verify with a publish of a review holding
-- one PENDING note (it must succeed) and one UNRESOLVED note (it must be
-- refused).

CREATE OR REPLACE FUNCTION product_private.product_phase3_validate_review_immutable_sources(
  p_run_id uuid, p_state jsonb, p_for_publish boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE immutable_items jsonb;
BEGIN
  IF pg_catalog.jsonb_typeof(p_state->'items') <> 'array'
    OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' NOT IN ('PROPOSAL', 'USER_FACT', 'EXCEPTION_LINK', 'ISSUE', 'COVERAGE', 'IMMATERIAL_ROUTING')
        OR item->>'decision' NOT IN ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED', 'UNRESOLVED')
        OR item->>'item_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
          (item->>'kind') || chr(31) || (item->>'source_id'), 'UTF8'), 'sha256'::text), 'hex'))
    OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items')) <>
      (SELECT count(DISTINCT item->>'item_id') FROM pg_catalog.jsonb_array_elements(p_state->'items') item) THEN
    RAISE EXCEPTION 'invalid review items' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_object_agg(
    (item->>'kind') || chr(31) || (item->>'source_id'), item
  ), '{}'::jsonb)
  INTO immutable_items
  FROM pg_catalog.jsonb_array_elements(p_state->'items') item
  WHERE item->>'kind' IS NOT NULL AND item->>'source_id' IS NOT NULL;

  IF EXISTS (
      SELECT 1 FROM public.product_proposals p
      WHERE p.run_id = p_run_id AND (
        immutable_items->('PROPOSAL' || chr(31) || p.proposal_id) IS NULL
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->>'source_closure_id'
          IS DISTINCT FROM p.source_closure_id
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->'source_span_ids'
          IS DISTINCT FROM p.payload->'source_span_ids'
        OR immutable_items->('PROPOSAL' || chr(31) || p.proposal_id)->'original'
          IS DISTINCT FROM p.payload
      )
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'PROPOSAL' AND NOT EXISTS (
        SELECT 1 FROM public.product_proposals p
        WHERE p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
      )
    ) THEN
    RAISE EXCEPTION 'review proposal graph mismatch' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
      SELECT 1 FROM public.product_fact_links l
      WHERE l.run_id = p_run_id AND l.relationship_type = 'EXCEPTS'
        AND immutable_items->('EXCEPTION_LINK' || chr(31) || l.fact_link_id)->'original'
          IS DISTINCT FROM l.payload
    ) OR EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
      WHERE item->>'kind' = 'EXCEPTION_LINK' AND NOT EXISTS (
        SELECT 1 FROM public.product_fact_links l
        WHERE l.run_id = p_run_id AND l.relationship_type = 'EXCEPTS'
          AND l.fact_link_id = item->>'source_id' AND l.payload = item->'original'
      )
    ) OR EXISTS (
      SELECT 1 FROM public.product_issues i
      WHERE i.run_id = p_run_id
        AND immutable_items->('ISSUE' || chr(31) || i.issue_id) IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.product_coverage_assertions c
      WHERE c.run_id = p_run_id
        AND (c.state = 'UNRESOLVED'
          OR (c.state = 'NOT_FOUND' AND c.subject_kind IN ('FAMILY', 'FACT_TYPE'))
          OR (c.subject_kind = 'RESIDUAL_PARAGRAPH' AND c.payload->>'reason' = 'IMMATERIAL'))
        AND immutable_items->('COVERAGE' || chr(31) || c.coverage_assertion_id) IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.product_section_routings r
      WHERE r.run_id = p_run_id AND r.disposition = 'IMMATERIAL'
        AND immutable_items->('IMMATERIAL_ROUTING' || chr(31) || r.section_routing_id) IS NULL
    ) THEN
    RAISE EXCEPTION 'required review item is missing' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
    WHERE item->>'kind' = 'USER_FACT' AND (
      coalesce(item->>'structure_node_id', '') = '' OR coalesce(item->>'source_closure_id', '') = ''
      OR pg_catalog.jsonb_array_length(item->'source_span_ids') = 0
      OR NOT EXISTS (SELECT 1 FROM public.product_source_closures c WHERE c.run_id = p_run_id
        AND c.source_closure_id = item->>'source_closure_id' AND c.structure_node_id = item->>'structure_node_id')
      OR item->>'source_id' <> pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        (p_state->>'draft_analysis_id') || chr(31) || (item->>'structure_node_id') || chr(31)
        || (item->>'family_key') || chr(31) || (item->'original'->>'subtype_key') || chr(31)
        || (item->'original'->>'fact_type') || chr(31) || (item->'original'->>'statement') || chr(31)
        || (SELECT pg_catalog.string_agg(value, ',' ORDER BY value)
          FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids')), 'UTF8'), 'sha256'::text), 'hex')
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements_text(item->'source_span_ids') span_id WHERE NOT EXISTS (
        SELECT 1 FROM public.product_source_closure_spans cs WHERE cs.run_id = p_run_id
          AND cs.source_closure_id = item->>'source_closure_id' AND cs.span_id = span_id)))) THEN
    RAISE EXCEPTION 'user fact source mismatch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item JOIN public.product_proposals p
      ON p.run_id = p_run_id AND p.proposal_id = item->>'source_id'
    WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' = 'EDITED' AND (
      coalesce(item->>'edited_statement', '') = '' OR pg_catalog.jsonb_typeof(item->'edited_roles') <> 'object'
      OR EXISTS (SELECT 1 FROM public.product_coverage_assertions c WHERE c.run_id = p_run_id
        AND c.subject_kind = 'ROLE' AND c.subject_id LIKE p.fact_occurrence_id || ':%'
        AND coalesce(item->'edited_roles'->>(c.payload->>'required_role'), '') = ''))) THEN
    RAISE EXCEPTION 'edited proposal is incomplete' USING ERRCODE = '22023';
  END IF;
  IF p_for_publish THEN
    IF p_state->'agreement_coverage'->>'decision' <> 'ACCEPTED'
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'PENDING'
        AND NOT (item->>'kind' = 'ISSUE' AND item->'original'->>'kind' = 'NOTE'))
      OR pg_catalog.jsonb_typeof(p_state->'summary'->'families') <> 'array'
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'families') family,
          pg_catalog.jsonb_array_elements(family->'facts')) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED'))
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' IN ('PROPOSAL', 'USER_FACT') AND item->>'decision' IN ('ACCEPTED', 'EDITED')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'families') family,
          pg_catalog.jsonb_array_elements(family->'facts') fact WHERE fact->>'review_item_id' = item->>'item_id'
            AND fact->>'source_closure_id' = item->>'source_closure_id'
            AND fact->'source_span_ids' = item->'source_span_ids'))
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') link_item
        WHERE link_item->>'kind' = 'EXCEPTION_LINK' AND link_item->>'decision' = 'ACCEPTED'
          AND (NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'from_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))
            OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') endpoint
              WHERE endpoint->>'source_id' = link_item->'original'->>'to_proposal_id'
                AND endpoint->>'decision' IN ('ACCEPTED', 'EDITED'))))
      OR (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships')) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED')
      OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'items') item
        WHERE item->>'kind' = 'EXCEPTION_LINK' AND item->>'decision' = 'ACCEPTED'
          AND NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(p_state->'summary'->'relationships') relationship
            WHERE relationship->>'review_item_id' = item->>'item_id'
              AND (relationship - 'review_item_id' - 'source_closure_id' - 'source_span_ids') = (item->'original') - 'source_span_ids'
              AND relationship->>'source_closure_id' = item->>'source_closure_id'
              AND relationship->'source_span_ids' = item->'source_span_ids'))
      OR coalesce((p_state->'metrics'->>'proposal_count')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'PROPOSAL')
      OR coalesce((p_state->'metrics'->>'proposal_errors')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item
          WHERE item->>'kind' = 'PROPOSAL' AND item->>'decision' IN ('EDITED', 'REJECTED'))
      OR coalesce((p_state->'metrics'->>'proposal_omissions')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'kind' = 'USER_FACT')
      OR coalesce((p_state->'metrics'->>'unresolved_count')::integer, -1) <>
        (SELECT count(*) FROM pg_catalog.jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'UNRESOLVED')
      OR coalesce((p_state->'metrics'->>'review_time_seconds')::integer, -1) < 0 THEN
      RAISE EXCEPTION 'published review summary mismatch' USING ERRCODE = '22023';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION product_private.product_phase3_save_review_legacy(
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
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_state->'items') item WHERE item->>'decision' = 'PENDING'
        AND NOT (item->>'kind' = 'ISSUE' AND item->'original'->>'kind' = 'NOTE')) THEN
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
