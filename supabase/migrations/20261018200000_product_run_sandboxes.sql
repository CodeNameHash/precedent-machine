-- Parallel hosted worker sandboxes (implementer D, plan finding (140)). The
-- hosted worker ran on one persistent sandbox, pm-codex-preview-worker, so
-- one agreement ran at a time. The wake now chooses from a pool of named
-- sandboxes, and a run owns one sandbox from its first wake until it is
-- READY or FAILED: a wake for a run that owns a sandbox goes to that
-- sandbox; a wake for a run without one takes a free sandbox, or is told
-- the pool is BUSY (the run route answers PRODUCT_SANDBOX_POOL_BUSY). The
-- rule is lib/product/sandbox-pool.js decideSandboxAssignment; this
-- function is its atomic implementation (one advisory lock per decision,
-- one live row per sandbox name by the partial unique index).

CREATE TABLE public.product_run_sandboxes (
  run_id uuid PRIMARY KEY REFERENCES public.product_analysis_runs(run_id),
  sandbox_name text NOT NULL CHECK (sandbox_name ~ '^pm-codex-preview-worker(-[1-9][0-9]*)?$'),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  CHECK ((released_at IS NULL) = (release_reason IS NULL))
);

CREATE UNIQUE INDEX product_run_sandboxes_one_live_run_per_sandbox
  ON public.product_run_sandboxes (sandbox_name) WHERE released_at IS NULL;

-- The pool after a decision: one entry per name with the run that holds it.
CREATE FUNCTION product_private.product_sandbox_occupancy(p_pool text[]) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'sandbox_name', names.sandbox_name,
    'run_id', s.run_id,
    'run_status', r.status,
    'assigned_at', s.assigned_at
  ) ORDER BY names.ordinality), '[]'::jsonb)
  FROM pg_catalog.unnest(p_pool) WITH ORDINALITY AS names(sandbox_name, ordinality)
  LEFT JOIN public.product_run_sandboxes s ON s.sandbox_name = names.sandbox_name AND s.released_at IS NULL
  LEFT JOIN public.product_analysis_runs r ON r.run_id = s.run_id
$$;

-- Ends the ownership of every run that is READY or FAILED. Returns the run
-- ids released.
CREATE FUNCTION product_private.product_sandbox_release_ended() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE released jsonb;
BEGIN
  WITH ended AS (
    UPDATE public.product_run_sandboxes s SET released_at = pg_catalog.now(), release_reason = r.status
    FROM public.product_analysis_runs r
    WHERE r.run_id = s.run_id AND s.released_at IS NULL AND r.status IN ('READY', 'FAILED')
    RETURNING s.run_id
  )
  SELECT COALESCE(pg_catalog.jsonb_agg(run_id), '[]'::jsonb) INTO released FROM ended;
  RETURN released;
END;
$$;

CREATE FUNCTION product_private.product_sandbox_assign(p_run_id uuid, p_pool text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run_status text; released jsonb; own_name text; free_name text; name text;
BEGIN
  IF p_pool IS NULL OR pg_catalog.cardinality(p_pool) = 0 THEN
    RAISE EXCEPTION 'sandbox pool is empty' USING ERRCODE = '22023';
  END IF;
  FOREACH name IN ARRAY p_pool LOOP
    IF name !~ '^pm-codex-preview-worker(-[1-9][0-9]*)?$' THEN
      RAISE EXCEPTION 'invalid sandbox name %', name USING ERRCODE = '22023';
    END IF;
  END LOOP;
  -- One decision at a time: two wakes for two new runs never take the same
  -- free sandbox.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.product_run_sandboxes'));
  SELECT status INTO run_status FROM public.product_analysis_runs WHERE run_id = p_run_id;
  IF run_status IS NULL THEN
    RAISE EXCEPTION 'analysis run not found' USING ERRCODE = 'P0002';
  END IF;
  released := product_private.product_sandbox_release_ended();
  IF run_status IN ('READY', 'FAILED') THEN
    RETURN pg_catalog.jsonb_build_object('run_id', p_run_id, 'state', 'RUN_ENDED', 'sandbox_name', NULL,
      'releases', released, 'sandboxes', product_private.product_sandbox_occupancy(p_pool));
  END IF;
  SELECT sandbox_name INTO own_name FROM public.product_run_sandboxes WHERE run_id = p_run_id AND released_at IS NULL;
  IF own_name IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('run_id', p_run_id, 'state', 'KEPT', 'sandbox_name', own_name,
      'releases', released, 'sandboxes', product_private.product_sandbox_occupancy(p_pool));
  END IF;
  SELECT names.sandbox_name INTO free_name
  FROM pg_catalog.unnest(p_pool) WITH ORDINALITY AS names(sandbox_name, ordinality)
  WHERE NOT EXISTS (SELECT 1 FROM public.product_run_sandboxes s WHERE s.sandbox_name = names.sandbox_name AND s.released_at IS NULL)
  ORDER BY names.ordinality LIMIT 1;
  IF free_name IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('run_id', p_run_id, 'state', 'BUSY', 'sandbox_name', NULL,
      'releases', released, 'sandboxes', product_private.product_sandbox_occupancy(p_pool));
  END IF;
  INSERT INTO public.product_run_sandboxes (run_id, sandbox_name) VALUES (p_run_id, free_name)
  ON CONFLICT (run_id) DO UPDATE SET sandbox_name = EXCLUDED.sandbox_name, assigned_at = pg_catalog.now(), released_at = NULL, release_reason = NULL;
  RETURN pg_catalog.jsonb_build_object('run_id', p_run_id, 'state', 'ASSIGNED', 'sandbox_name', free_name,
    'releases', released, 'sandboxes', product_private.product_sandbox_occupancy(p_pool));
END;
$$;

-- Ends one run's ownership now, with a reason (the wake found its sandbox
-- gone; an operator freed an abandoned run). Returns whether a live row
-- was released and which sandbox it held.
CREATE FUNCTION product_private.product_sandbox_release(p_run_id uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE held text;
BEGIN
  IF coalesce(p_reason, '') = '' THEN
    RAISE EXCEPTION 'release reason is required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.product_run_sandboxes'));
  UPDATE public.product_run_sandboxes SET released_at = pg_catalog.now(), release_reason = p_reason
  WHERE run_id = p_run_id AND released_at IS NULL
  RETURNING sandbox_name INTO held;
  RETURN pg_catalog.jsonb_build_object('run_id', p_run_id, 'released', held IS NOT NULL, 'sandbox_name', held);
END;
$$;

CREATE FUNCTION public.product_sandbox_assign(p_run_id uuid, p_pool text[]) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_sandbox_assign(p_run_id, p_pool)
$$;

CREATE FUNCTION public.product_sandbox_release(p_run_id uuid, p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT product_private.product_sandbox_release(p_run_id, p_reason)
$$;

ALTER TABLE public.product_run_sandboxes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_run_sandboxes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_run_sandboxes TO service_role;

REVOKE ALL ON FUNCTION product_private.product_sandbox_occupancy(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_sandbox_release_ended() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_sandbox_assign(uuid,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION product_private.product_sandbox_release(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_sandbox_assign(uuid,text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.product_sandbox_release(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION product_private.product_sandbox_assign(uuid,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION product_private.product_sandbox_release(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_sandbox_assign(uuid,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.product_sandbox_release(uuid,text) TO service_role;

-- The one sandbox that existed before this migration holds the worker of
-- whichever run is live on it now: the most recently updated RUNNING or
-- PARTIAL run is recorded on pm-codex-preview-worker, so its next wake and
-- keepalive go there and no new run takes that sandbox under it. Any other
-- unfinished run has no worker (one lock, one worker) and is assigned at
-- its next wake.
INSERT INTO public.product_run_sandboxes (run_id, sandbox_name)
SELECT run_id, 'pm-codex-preview-worker' FROM public.product_analysis_runs
WHERE status IN ('RUNNING', 'PARTIAL') ORDER BY updated_at DESC LIMIT 1;
