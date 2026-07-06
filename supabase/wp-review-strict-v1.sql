-- WP-REVIEW-STRICT-V1 additive schema.
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS consideration_type_canonical text;

ALTER TABLE public.deals
  DROP CONSTRAINT IF EXISTS deals_consideration_type_canonical_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_consideration_type_canonical_check CHECK (
    consideration_type_canonical IS NULL OR consideration_type_canonical IN (
      'ALL_CASH',
      'ALL_STOCK_FIXED_EXCHANGE',
      'ALL_STOCK_FIXED_VALUE',
      'CASH_AND_STOCK_MIX',
      'CASH_AND_CVR',
      'STOCK_AND_CVR',
      'CASH_STOCK_AND_CVR',
      'CASH_AND_ELECTION',
      'STOCK_AND_ELECTION',
      'MIXED_ELECTION',
      'OTHER'
    )
  );

ALTER TABLE public.consideration_treatments
  ADD COLUMN IF NOT EXISTS cvr_entitlement text,
  ADD COLUMN IF NOT EXISTS party text;

ALTER TABLE public.consideration_treatments
  DROP CONSTRAINT IF EXISTS consideration_treatments_cvr_entitlement_check;

ALTER TABLE public.consideration_treatments
  ADD CONSTRAINT consideration_treatments_cvr_entitlement_check CHECK (
    cvr_entitlement IS NULL OR cvr_entitlement IN ('YES', 'NO', 'ITM_ONLY', 'NA')
  );

ALTER TABLE public.consideration_treatments
  DROP CONSTRAINT IF EXISTS consideration_treatments_party_check;

ALTER TABLE public.consideration_treatments
  ADD CONSTRAINT consideration_treatments_party_check CHECK (
    party IS NULL OR party IN ('COMPANY', 'PARENT', 'BOTH', 'NA')
  );

ALTER TABLE public.provisions
  ADD COLUMN IF NOT EXISTS category_canonical text;

CREATE INDEX IF NOT EXISTS provisions_category_canonical_idx
  ON public.provisions(category_canonical);

CREATE TABLE IF NOT EXISTS public.outside_date_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  base_months integer NOT NULL,
  base_date_iso date NOT NULL,
  extensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_verbatim text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT outside_date_specs_unique_deal UNIQUE (deal_id),
  CONSTRAINT outside_date_specs_base_months_positive CHECK (base_months > 0),
  CONSTRAINT outside_date_specs_extensions_array CHECK (jsonb_typeof(extensions) = 'array')
);

CREATE TABLE IF NOT EXISTS public.absence_of_certain_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  mae_since_date date,
  mae_since_text_verbatim text,
  ioc_compliance_since_date date,
  ioc_compliance_since_text_verbatim text,
  ioc_covenants_incorporated jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_aoc_provisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT aoc_ioc_covenants_array CHECK (jsonb_typeof(ioc_covenants_incorporated) = 'array'),
  CONSTRAINT aoc_other_provisions_array CHECK (jsonb_typeof(other_aoc_provisions) = 'array')
);

CREATE TABLE IF NOT EXISTS public.stockholder_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  definition_text_verbatim text,
  required_vote_canonical text,
  class_vote_required boolean,
  governing_law_standard text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT stockholder_approval_vote_check CHECK (
    required_vote_canonical IS NULL OR required_vote_canonical IN (
      'MAJORITY_OUTSTANDING',
      'TWO_THIRDS_OUTSTANDING',
      'MAJORITY_VOTES_CAST',
      'SUPERMAJORITY_OTHER',
      'OTHER'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.adjournment_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE UNIQUE,
  company_can_adjourn boolean,
  parent_can_adjourn boolean,
  quorum_failure_days integer,
  proxy_solicitation_days integer,
  regulatory_approval_days integer,
  max_total_adjournment_days integer,
  requires_parent_consent boolean,
  text_verbatim text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.closing_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  condition_key text,
  party text,
  text_verbatim text,
  bring_down_reps_scope text,
  bring_down_reps_excepted jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT closing_conditions_party_check CHECK (
    party IS NULL OR party IN ('COMPANY', 'PARENT', 'BOTH', 'NA')
  ),
  CONSTRAINT closing_conditions_bringdown_scope_check CHECK (
    bring_down_reps_scope IS NULL OR bring_down_reps_scope IN (
      'ALL_REPS_NOT_OTHERWISE_SPECIFIED',
      'SPECIFIC_REPS_LISTED',
      'FUNDAMENTAL_REPS_ONLY',
      'NONE'
    )
  ),
  CONSTRAINT closing_conditions_bringdown_excepted_array CHECK (jsonb_typeof(bring_down_reps_excepted) = 'array')
);

ALTER TABLE public.closing_conditions
  ADD COLUMN IF NOT EXISTS bring_down_reps_scope text,
  ADD COLUMN IF NOT EXISTS bring_down_reps_excepted jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS outside_date_specs_deal_idx
  ON public.outside_date_specs(deal_id);
CREATE INDEX IF NOT EXISTS absence_of_certain_changes_deal_idx
  ON public.absence_of_certain_changes(deal_id);
CREATE INDEX IF NOT EXISTS stockholder_approval_deal_idx
  ON public.stockholder_approval(deal_id);
CREATE INDEX IF NOT EXISTS adjournment_rights_deal_idx
  ON public.adjournment_rights(deal_id);
CREATE INDEX IF NOT EXISTS closing_conditions_deal_idx
  ON public.closing_conditions(deal_id);
