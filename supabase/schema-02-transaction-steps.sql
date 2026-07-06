-- WP-SCHEMA-02 transaction steps.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.transaction_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_kind text NOT NULL,
  disappearing_entity text NOT NULL,
  surviving_entity text NOT NULL,
  parent_entity text,
  effective_time_ref text NOT NULL,
  effective_time_definition_quote text NOT NULL,
  is_taxable boolean,
  tax_treatment_note text,
  region_id uuid REFERENCES public.parser_regions(id) ON DELETE SET NULL,
  section_refs text[] NOT NULL DEFAULT '{}'::text[],
  extracted_by text NOT NULL DEFAULT 'CODEX',
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_steps_order_positive CHECK (step_order >= 1),
  CONSTRAINT transaction_steps_kind_check CHECK (
    step_kind IN (
      'MERGER',
      'EXCHANGE',
      'CONTRIBUTION',
      'TENDER_OFFER',
      'BACK_END_MERGER',
      'SUBSEQUENT_MERGER',
      'OTHER'
    )
  ),
  CONSTRAINT transaction_steps_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  ),
  CONSTRAINT transaction_steps_deal_order_unique UNIQUE (deal_id, step_order)
);

CREATE INDEX IF NOT EXISTS transaction_steps_deal_idx
  ON public.transaction_steps(deal_id);
CREATE INDEX IF NOT EXISTS transaction_steps_kind_idx
  ON public.transaction_steps(step_kind);
CREATE INDEX IF NOT EXISTS transaction_steps_region_idx
  ON public.transaction_steps(region_id);

CREATE TABLE IF NOT EXISTS public.deal_topology (
  deal_id uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  topology text NOT NULL,
  step_count integer NOT NULL,
  primary_step_id uuid NOT NULL REFERENCES public.transaction_steps(id) ON DELETE CASCADE,
  topology_needs_review boolean NOT NULL DEFAULT false,
  review_note text,
  extracted_by text NOT NULL DEFAULT 'CODEX',
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_topology_topology_check CHECK (
    topology IN (
      'SINGLE_MERGER',
      'FORWARD_TRIANGULAR',
      'REVERSE_TRIANGULAR',
      'TWO_STEP_TENDER',
      'DOUBLE_DUMMY',
      'MULTI_STEP_REORG',
      'OTHER'
    )
  ),
  CONSTRAINT deal_topology_step_count_positive CHECK (step_count >= 1),
  CONSTRAINT deal_topology_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  )
);

ALTER TABLE public.consideration_equity_provisions
  ADD COLUMN IF NOT EXISTS transaction_step_id uuid REFERENCES public.transaction_steps(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS consideration_equity_transaction_step_idx
  ON public.consideration_equity_provisions(transaction_step_id);
