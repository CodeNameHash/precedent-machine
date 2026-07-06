-- Parser hierarchy persistence + WP-SCHEMA-01 consideration equity schema.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.parser_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  region_key text NOT NULL,
  region_type text NOT NULL,
  start_char integer NOT NULL,
  end_char integer NOT NULL,
  section_ref text,
  title text,
  raw_text text NOT NULL,
  text_hash text NOT NULL,
  atomic boolean NOT NULL DEFAULT false,
  atomic_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parser_regions_span_valid CHECK (start_char >= 0 AND end_char > start_char),
  CONSTRAINT parser_regions_deal_key_unique UNIQUE (deal_id, region_key)
);

CREATE INDEX IF NOT EXISTS parser_regions_deal_idx
  ON public.parser_regions(deal_id);
CREATE INDEX IF NOT EXISTS parser_regions_deal_span_idx
  ON public.parser_regions(deal_id, start_char, end_char);
CREATE INDEX IF NOT EXISTS parser_regions_type_idx
  ON public.parser_regions(region_type);

CREATE TABLE IF NOT EXISTS public.consideration_equity_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  section_ref text,
  region_id uuid REFERENCES public.parser_regions(id) ON DELETE SET NULL,
  region_full_text text NOT NULL,
  region_hash text NOT NULL,
  treatment_grouping text NOT NULL,
  needs_reextraction boolean NOT NULL DEFAULT false,
  extracted_by text NOT NULL DEFAULT 'CODEX',
  extraction_version text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consideration_equity_grouping_check CHECK (
    treatment_grouping IN ('SEPARATE_SUBPROVISIONS', 'GROUPED_PROSE', 'HYBRID')
  ),
  CONSTRAINT consideration_equity_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  ),
  CONSTRAINT consideration_equity_deal_region_hash_unique UNIQUE (deal_id, region_hash),
  CONSTRAINT consideration_equity_deal_section_region_hash_unique UNIQUE (deal_id, section_ref, region_hash)
);

CREATE INDEX IF NOT EXISTS consideration_equity_deal_idx
  ON public.consideration_equity_provisions(deal_id);
CREATE INDEX IF NOT EXISTS consideration_equity_region_idx
  ON public.consideration_equity_provisions(region_id);
CREATE INDEX IF NOT EXISTS consideration_equity_region_hash_idx
  ON public.consideration_equity_provisions(region_hash);

CREATE TABLE IF NOT EXISTS public.consideration_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid NOT NULL REFERENCES public.consideration_equity_provisions(id) ON DELETE CASCADE,
  instrument_type text NOT NULL,
  vesting_treatment text NOT NULL DEFAULT 'UNSPECIFIED',
  consideration_type text NOT NULL DEFAULT 'N_A',
  cash_formula text,
  stock_formula text,
  in_the_money_only boolean,
  performance_treatment text,
  tax_treatment_note text,
  span_type text NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  bring_down_section_ref text,
  bring_down_verbatim_quote text,
  bring_down_region_id uuid REFERENCES public.parser_regions(id) ON DELETE SET NULL,
  extracted_by text NOT NULL DEFAULT 'CODEX',
  confidence text NOT NULL DEFAULT 'LOW',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consideration_treatment_instrument_check CHECK (
    instrument_type IN (
      'STOCK_OPTIONS',
      'RSA',
      'RSU',
      'PSU',
      'ESPP',
      'SAR',
      'PHANTOM_STOCK',
      'DSU',
      'DIRECTOR_EQUITY',
      'OTHER_EQUITY'
    )
  ),
  CONSTRAINT consideration_treatment_vesting_check CHECK (
    vesting_treatment IN (
      'FULLY_VESTED_ACCELERATED',
      'CONTINUED_VESTING',
      'PRO_RATA_ACCELERATION',
      'CANCELLED_FOR_CONSIDERATION',
      'CANCELLED_NO_CONSIDERATION',
      'ASSUMED_BY_PARENT',
      'ROLLOVER',
      'UNSPECIFIED'
    )
  ),
  CONSTRAINT consideration_treatment_consideration_check CHECK (
    consideration_type IN ('CASH', 'STOCK', 'MIXED', 'CANCELLATION', 'N_A')
  ),
  CONSTRAINT consideration_treatment_performance_check CHECK (
    performance_treatment IS NULL OR performance_treatment IN (
      'DEEMED_TARGET',
      'DEEMED_MAXIMUM',
      'ACTUAL_PERFORMANCE',
      'PRO_RATA',
      'BOARD_DETERMINATION',
      'N_A'
    )
  ),
  CONSTRAINT consideration_treatment_span_type_check CHECK (
    span_type IN ('OWN_SUBPROVISION', 'SHARED_SENTENCE', 'SHARED_PARAGRAPH')
  ),
  CONSTRAINT consideration_treatment_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  ),
  CONSTRAINT consideration_treatment_confidence_check CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  CONSTRAINT consideration_treatment_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT consideration_treatment_unique UNIQUE (provision_id, instrument_type, source_span_start)
);

CREATE INDEX IF NOT EXISTS consideration_treatments_provision_idx
  ON public.consideration_treatments(provision_id);
CREATE INDEX IF NOT EXISTS consideration_treatments_instrument_idx
  ON public.consideration_treatments(instrument_type);

ALTER TABLE public.provisions
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.parser_regions(id) ON DELETE SET NULL;

ALTER TABLE public.provisions
  ADD COLUMN IF NOT EXISTS consideration_equity_provision_id uuid
  REFERENCES public.consideration_equity_provisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS provisions_region_id_idx
  ON public.provisions(region_id);
CREATE INDEX IF NOT EXISTS provisions_consideration_equity_provision_id_idx
  ON public.provisions(consideration_equity_provision_id);

CREATE TABLE IF NOT EXISTS public.provisions_archive_20260706 (
  archive_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_provision_id uuid,
  deal_id uuid,
  archive_reason text NOT NULL,
  row_data jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provisions_archive_20260706_deal_idx
  ON public.provisions_archive_20260706(deal_id);
CREATE INDEX IF NOT EXISTS provisions_archive_20260706_original_idx
  ON public.provisions_archive_20260706(original_provision_id);
