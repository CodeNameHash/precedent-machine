-- Durable queue for admin Needs Code review notes.
-- Admin writes tasks here; CLI workers claim and audit rubric/parser changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.coding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'needs_review', 'applied', 'ignored', 'failed', 'cancelled')),
  suggested_action text NOT NULL
    CHECK (suggested_action IN ('assign_existing', 'split', 'ignore', 'propose_new_code')),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  provision_id uuid REFERENCES public.provisions(id) ON DELETE SET NULL,
  current_type text,
  current_category text,
  current_code text,
  full_text text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  suggested_code text,
  lock_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 1,
  locked_by text,
  locked_until timestamptz,
  error_message text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT coding_tasks_attempts_check CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE INDEX IF NOT EXISTS idx_coding_tasks_status_created
  ON public.coding_tasks(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coding_tasks_claim
  ON public.coding_tasks(status, locked_until, created_at);

CREATE INDEX IF NOT EXISTS idx_coding_tasks_deal
  ON public.coding_tasks(deal_id);

CREATE INDEX IF NOT EXISTS idx_coding_tasks_provision
  ON public.coding_tasks(provision_id);

CREATE INDEX IF NOT EXISTS idx_coding_tasks_action
  ON public.coding_tasks(suggested_action);

CREATE OR REPLACE FUNCTION public.set_coding_tasks_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coding_tasks_updated ON public.coding_tasks;
CREATE TRIGGER trg_coding_tasks_updated
  BEFORE UPDATE ON public.coding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_coding_tasks_updated_at();

CREATE OR REPLACE FUNCTION public.claim_coding_tasks(
  p_worker_id text,
  p_limit int DEFAULT 1,
  p_lease_seconds int DEFAULT 3600
)
RETURNS SETOF public.coding_tasks AS $$
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
    RAISE EXCEPTION 'worker id is required';
  END IF;

  RETURN QUERY
  WITH claimable AS (
    SELECT t.id
    FROM public.coding_tasks t
    WHERE t.status = 'pending'
      AND t.attempts < t.max_attempts
      AND (t.locked_until IS NULL OR t.locked_until < now())
    ORDER BY t.created_at, t.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, COALESCE(p_limit, 1))
  )
  UPDATE public.coding_tasks t
  SET status = 'claimed',
      locked_by = p_worker_id,
      locked_until = now() + make_interval(secs => GREATEST(60, COALESCE(p_lease_seconds, 3600))),
      attempts = t.attempts + 1,
      claimed_at = COALESCE(t.claimed_at, now()),
      error_message = NULL
  FROM claimable
  WHERE t.id = claimable.id
  RETURNING t.*;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.coding_tasks ENABLE ROW LEVEL SECURITY;
