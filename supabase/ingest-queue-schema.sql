-- Resumable local ingest queue. Apply through Supabase SQL Editor.
-- Extraction workers run locally with service-role credentials; Vercel remains
-- read-only/admin observability for this queue.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.deal_candidates
  DROP CONSTRAINT IF EXISTS deal_candidates_status_check;

ALTER TABLE public.deal_candidates
  ADD CONSTRAINT deal_candidates_status_check
  CHECK (status IN ('pending', 'queued', 'ingested', 'skipped', 'needs_review', 'error'));

ALTER TABLE public.deal_candidates
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE IF NOT EXISTS public.ingest_runs (
  id text PRIMARY KEY,
  mode text NOT NULL DEFAULT 'seed',
  backend text NOT NULL DEFAULT 'codex',
  model text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'queued', 'running', 'succeeded', 'needs_review', 'failed', 'cancelled')),
  manifest jsonb,
  manifest_hash text,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  concurrency jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ingest_jobs (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES public.ingest_runs(id) ON DELETE CASCADE,
  kind text NOT NULL
    CHECK (kind IN ('deal-prepare', 'family-extract', 'deal-qa', 'finalize-candidate')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'needs_review', 'failed', 'cancelled')),
  candidate_id uuid REFERENCES public.deal_candidates(id),
  deal_id uuid REFERENCES public.deals(id),
  family text,
  lock_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 1,
  locked_by text,
  locked_until timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT ingest_jobs_attempts_check CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE TABLE IF NOT EXISTS public.ingest_job_dependencies (
  job_id text NOT NULL REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  depends_on_job_id text NOT NULL REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, depends_on_job_id),
  CONSTRAINT ingest_job_dependencies_no_self CHECK (job_id <> depends_on_job_id)
);

CREATE TABLE IF NOT EXISTS public.ingest_job_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.ingest_runs(id) ON DELETE CASCADE,
  job_id text REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  json jsonb,
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ingest_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.ingest_runs(id) ON DELETE CASCADE,
  job_id text REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  event text NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_runs_status_created
  ON public.ingest_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_run_status
  ON public.ingest_jobs(run_id, status);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_claim
  ON public.ingest_jobs(status, kind, locked_until, created_at);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_candidate
  ON public.ingest_jobs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_ingest_jobs_deal
  ON public.ingest_jobs(deal_id);

CREATE INDEX IF NOT EXISTS idx_ingest_job_dependencies_depends
  ON public.ingest_job_dependencies(depends_on_job_id);

CREATE INDEX IF NOT EXISTS idx_ingest_job_events_run_created
  ON public.ingest_job_events(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_job_artifacts_run_created
  ON public.ingest_job_artifacts(run_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_ingest_queue_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ingest_runs_updated ON public.ingest_runs;
CREATE TRIGGER trg_ingest_runs_updated
  BEFORE UPDATE ON public.ingest_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_ingest_queue_updated_at();

DROP TRIGGER IF EXISTS trg_ingest_jobs_updated ON public.ingest_jobs;
CREATE TRIGGER trg_ingest_jobs_updated
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_ingest_queue_updated_at();

CREATE OR REPLACE FUNCTION public.claim_ingest_jobs(
  p_worker_id text,
  p_kinds text[] DEFAULT NULL,
  p_limit int DEFAULT 1,
  p_lease_seconds int DEFAULT 900,
  p_run_id text DEFAULT NULL
)
RETURNS SETOF public.ingest_jobs AS $$
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT j.id
    FROM public.ingest_jobs j
    WHERE j.status = 'pending'
      AND (p_run_id IS NULL OR j.run_id = p_run_id)
      AND (p_kinds IS NULL OR j.kind = ANY(p_kinds))
      AND j.attempts < j.max_attempts
      AND (j.locked_until IS NULL OR j.locked_until < now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.ingest_job_dependencies d
        JOIN public.ingest_jobs dep ON dep.id = d.depends_on_job_id
        WHERE d.job_id = j.id
          AND dep.status <> 'succeeded'
      )
    ORDER BY j.created_at, j.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, COALESCE(p_limit, 1))
  )
  UPDATE public.ingest_jobs j
  SET status = 'running',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => GREATEST(60, COALESCE(p_lease_seconds, 900))),
      attempts = j.attempts + 1,
      started_at = COALESCE(j.started_at, now()),
      error_message = NULL
  FROM claimable
  WHERE j.id = claimable.id
  RETURNING j.*;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_job_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_job_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_job_events ENABLE ROW LEVEL SECURITY;
