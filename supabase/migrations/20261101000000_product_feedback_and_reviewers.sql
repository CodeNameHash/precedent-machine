-- Work package 3: feedback anywhere, and the reviewer directory.
-- Written, not applied by the agent; the manager applies it.
--
-- product_feedback records one piece of reader feedback with the exact
-- context the reader was looking at: the run, page, section, table, row,
-- column, the coded cell and its facts, the author and their level.
-- product_reviewers is the account structure: a name, a level and an
-- active flag. It is not authentication; the session login stays as it is.

CREATE TABLE IF NOT EXISTS public.product_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('PARTNER', 'SENIOR_ASSOCIATE', 'MID_LEVEL_ASSOCIATE', 'JUNIOR_ASSOCIATE')),
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_reviewers_name_key ON public.product_reviewers (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS product_reviewers_email_key ON public.product_reviewers (lower(email)) WHERE email IS NOT NULL;

INSERT INTO public.product_reviewers (name, level, email, active)
SELECT 'Ben Goodchild', 'PARTNER', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM public.product_reviewers WHERE lower(name) = lower('Ben Goodchild'));

CREATE TABLE IF NOT EXISTS public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  page_path text,
  section_key text,
  table_key text,
  row_subject text,
  column_id text,
  cell_code text,
  cell_label text,
  fact_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  kind text NOT NULL CHECK (kind IN ('WRONG_ANSWER', 'MISSING', 'UNCLEAR', 'OTHER')),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  author_id text,
  author_name text,
  author_level text CHECK (author_level IN ('PARTNER', 'SENIOR_ASSOCIATE', 'MID_LEVEL_ASSOCIATE', 'JUNIOR_ASSOCIATE')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected', 'done')),
  resolved_by text,
  resolved_at timestamptz,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS product_feedback_status_created_idx ON public.product_feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_feedback_run_idx ON public.product_feedback (run_id, created_at DESC);

ALTER TABLE public.product_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_reviewers FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.product_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.product_reviewers TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.product_feedback TO service_role;

COMMENT ON TABLE public.product_feedback IS 'Reader feedback with the exact review context; status review is an admin page.';
COMMENT ON TABLE public.product_reviewers IS 'Reviewer directory and level; not authentication.';
