-- WP-SCHEMA-02 elections.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.consideration_equity_provisions
  ADD COLUMN IF NOT EXISTS election_needs_review boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.proration_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proration_trigger text NOT NULL,
  proration_method text NOT NULL,
  cap_definitions jsonb NOT NULL DEFAULT '{}'::jsonb,
  non_electing_treatment text NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  proration_walkthrough text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proration_trigger_check CHECK (
    proration_trigger IN (
      'OVERSUBSCRIBED_CASH',
      'OVERSUBSCRIBED_STOCK',
      'OVERSUBSCRIBED_EITHER',
      'ALWAYS'
    )
  ),
  CONSTRAINT proration_method_check CHECK (
    proration_method IN (
      'PRO_RATA_REDUCTION',
      'PRO_RATA_ALLOCATION',
      'AUCTION',
      'BOARD_DISCRETION',
      'OTHER'
    )
  ),
  CONSTRAINT proration_non_electing_check CHECK (
    non_electing_treatment IN (
      'FILL_UNDERSUBSCRIBED_SIDE',
      'GET_DEFAULT_TREATMENT',
      'PRO_RATA_MIX',
      'OTHER'
    )
  ),
  CONSTRAINT proration_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  )
);

CREATE TABLE IF NOT EXISTS public.election_mechanisms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid NOT NULL REFERENCES public.consideration_equity_provisions(id) ON DELETE CASCADE,
  transaction_step_id uuid REFERENCES public.transaction_steps(id) ON DELETE SET NULL,
  election_type text NOT NULL,
  is_prorated boolean NOT NULL,
  default_treatment text NOT NULL,
  election_deadline_ref text,
  election_deadline_quote text,
  proration_rule_id uuid REFERENCES public.proration_rules(id) ON DELETE SET NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  extracted_by text NOT NULL DEFAULT 'CODEX',
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT election_mechanisms_type_check CHECK (
    election_type IN (
      'CASH_OR_STOCK',
      'CASH_OR_STOCK_OR_MIXED',
      'CVR_INCLUSION',
      'CONTINGENT_PAYMENT',
      'EARN_OUT',
      'OTHER'
    )
  ),
  CONSTRAINT election_mechanisms_default_check CHECK (
    default_treatment IN (
      'NON_ELECTING_GETS_STOCK',
      'NON_ELECTING_GETS_CASH',
      'NON_ELECTING_GETS_MIXED',
      'NON_ELECTING_TREATED_AS_STOCK_ELECTION',
      'NON_ELECTING_TREATED_AS_CASH_ELECTION',
      'OTHER'
    )
  ),
  CONSTRAINT election_mechanisms_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  ),
  CONSTRAINT election_mechanisms_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT election_mechanisms_proration_consistent CHECK (
    (is_prorated = true AND proration_rule_id IS NOT NULL)
    OR (is_prorated = false AND proration_rule_id IS NULL)
  ),
  CONSTRAINT election_mechanisms_provision_unique UNIQUE (provision_id)
);

CREATE INDEX IF NOT EXISTS election_mechanisms_provision_idx
  ON public.election_mechanisms(provision_id);
CREATE INDEX IF NOT EXISTS election_mechanisms_step_idx
  ON public.election_mechanisms(transaction_step_id);
CREATE INDEX IF NOT EXISTS election_mechanisms_type_idx
  ON public.election_mechanisms(election_type);

CREATE TABLE IF NOT EXISTS public.election_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  election_mechanism_id uuid NOT NULL REFERENCES public.election_mechanisms(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_type text NOT NULL,
  cash_per_share numeric,
  cash_per_share_formula text,
  stock_per_share numeric,
  stock_per_share_formula text,
  cvr_included boolean,
  cvr_note text,
  aggregate_cap_type text NOT NULL,
  aggregate_cap_value text NOT NULL,
  aggregate_cap_formula text,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT election_options_type_check CHECK (
    option_type IN (
      'CASH_ELECTION',
      'STOCK_ELECTION',
      'MIXED_ELECTION',
      'CVR_INCLUDED',
      'CVR_EXCLUDED',
      'OTHER'
    )
  ),
  CONSTRAINT election_options_cap_type_check CHECK (
    aggregate_cap_type IN (
      'FIXED_DOLLAR_AMOUNT',
      'FIXED_SHARE_AMOUNT',
      'PERCENTAGE_OF_CONSIDERATION',
      'PERCENTAGE_OF_SHARES',
      'NO_CAP',
      'OTHER'
    )
  ),
  CONSTRAINT election_options_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT election_options_order_positive CHECK (display_order >= 1),
  CONSTRAINT election_options_mechanism_type_unique UNIQUE (election_mechanism_id, option_type)
);

CREATE INDEX IF NOT EXISTS election_options_mechanism_idx
  ON public.election_options(election_mechanism_id);
CREATE INDEX IF NOT EXISTS election_options_type_idx
  ON public.election_options(option_type);
