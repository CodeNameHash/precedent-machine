-- Passive SEC EDGAR deal-candidate catalogue.
-- Apply through Supabase SQL Editor. Access stays service-role-only through /api/*.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.deal_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cik text NOT NULL,
  filing_accession text NOT NULL,
  filing_date date NOT NULL,
  form_type text NOT NULL,
  filed_by_party text,
  target_name text,
  acquirer_name text,
  deal_value_usd bigint,
  announced_at date,
  agreement_exhibit_url text,
  agreement_text_hash text NOT NULL,
  discovered_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  skip_reason text,
  ingested_deal_id uuid REFERENCES public.deals(id),
  CONSTRAINT deal_candidates_status_check
    CHECK (status IN ('pending', 'queued', 'ingested', 'skipped', 'error')),
  CONSTRAINT deal_candidates_agreement_text_hash_key UNIQUE (agreement_text_hash),
  CONSTRAINT deal_candidates_cik_filing_accession_key UNIQUE (cik, filing_accession)
);

CREATE INDEX IF NOT EXISTS idx_deal_candidates_filing_date
  ON public.deal_candidates(filing_date DESC);

CREATE INDEX IF NOT EXISTS idx_deal_candidates_status
  ON public.deal_candidates(status);

CREATE INDEX IF NOT EXISTS idx_deal_candidates_agreement_text_hash
  ON public.deal_candidates(agreement_text_hash);

ALTER TABLE public.deal_candidates ENABLE ROW LEVEL SECURITY;
