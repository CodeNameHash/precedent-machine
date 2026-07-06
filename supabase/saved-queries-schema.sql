CREATE TABLE IF NOT EXISTS public.saved_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.users(id),
  query_kind text NOT NULL CHECK (query_kind IN (
    'DEAL_COMPARE',
    'PROVISION_CROSS_CUT',
    'MARKET_RANGE',
    'FILTER_THEN_LIST',
    'DEAL_TO_MARKET'
  )),
  title text NOT NULL,
  description text,
  query_payload jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS saved_queries_owner_kind_idx
  ON public.saved_queries(owner_user_id, query_kind);

CREATE INDEX IF NOT EXISTS saved_queries_featured_idx
  ON public.saved_queries(is_featured)
  WHERE is_featured = true;
