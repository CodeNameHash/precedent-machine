-- WP-SCHEMA-03 card model and per-type child tables.
-- Additive only. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.provision_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  provision_type text NOT NULL,
  provision_subtype text,
  section_ref text NOT NULL,
  short_title text NOT NULL,
  party_scope text NOT NULL,
  region_id uuid NOT NULL REFERENCES public.parser_regions(id),
  region_full_text text NOT NULL,
  region_hash text NOT NULL,
  primary_quote_start integer NOT NULL,
  primary_quote_end integer NOT NULL,
  primary_quote text NOT NULL,
  extracted_by text NOT NULL,
  extraction_version text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  needs_review boolean NOT NULL DEFAULT false,
  review_notes text,
  CONSTRAINT provision_cards_type_check CHECK (
    provision_type IN (
      'CONSIDERATION',
      'REPRESENTATION',
      'MATERIAL_CONTRACT',
      'CLOSING_CONDITION',
      'COVENANT_INTERIM_OPERATING',
      'COVENANT_NO_SOLICITATION',
      'COVENANT_OTHER',
      'TERMINATION_RIGHT',
      'TERMINATION_FEE',
      'DEFINITION',
      'ANTITRUST_REGULATORY',
      'SEC_FILING_MEETING',
      'EMPLOYEE_BENEFITS',
      'STRUCTURE_MECHANICS',
      'MAE',
      'NO_OTHER_REPS',
      'MISC_BOILERPLATE'
    )
  ),
  CONSTRAINT provision_cards_party_scope_check CHECK (
    party_scope IN ('COMPANY', 'PARENT', 'BUYER', 'MERGER_SUB', 'MUTUAL', 'N_A')
  ),
  CONSTRAINT provision_cards_extracted_by_check CHECK (
    extracted_by IN ('CODEX', 'CLAUDE', 'BOTH')
  ),
  CONSTRAINT provision_cards_primary_quote_span_valid CHECK (
    primary_quote_start >= 0 AND primary_quote_end > primary_quote_start
  ),
  CONSTRAINT provision_cards_deal_region_hash_unique UNIQUE (deal_id, region_hash),
  CONSTRAINT provision_cards_deal_section_type_unique UNIQUE (deal_id, section_ref, provision_type)
);

CREATE INDEX IF NOT EXISTS provision_cards_deal_idx
  ON public.provision_cards(deal_id);
CREATE INDEX IF NOT EXISTS provision_cards_type_idx
  ON public.provision_cards(provision_type);
CREATE INDEX IF NOT EXISTS provision_cards_region_idx
  ON public.provision_cards(region_id);
CREATE INDEX IF NOT EXISTS provision_cards_region_hash_idx
  ON public.provision_cards(region_hash);
CREATE INDEX IF NOT EXISTS provision_cards_section_idx
  ON public.provision_cards(deal_id, section_ref);

CREATE TABLE IF NOT EXISTS public.provision_field_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  display_order integer NOT NULL,
  is_collapsed_by_default boolean NOT NULL DEFAULT false,
  CONSTRAINT provision_field_groups_order_positive CHECK (display_order >= 1),
  CONSTRAINT provision_field_groups_group_name_present CHECK (length(trim(group_name)) > 0),
  CONSTRAINT provision_field_groups_card_group_unique UNIQUE (card_id, group_name),
  CONSTRAINT provision_field_groups_card_order_unique UNIQUE (card_id, display_order)
);

CREATE UNIQUE INDEX IF NOT EXISTS provision_field_groups_primary_unique
  ON public.provision_field_groups(card_id)
  WHERE group_name = 'primary';
CREATE INDEX IF NOT EXISTS provision_field_groups_card_idx
  ON public.provision_field_groups(card_id);

CREATE TABLE IF NOT EXISTS public.provision_analytical_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  flag_kind text NOT NULL,
  flag_severity text NOT NULL,
  text text NOT NULL,
  source_span_start integer,
  source_span_end integer,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provision_analytical_flags_kind_check CHECK (
    flag_kind IN (
      'DRAFTING_OBSERVATION',
      'QUALIFIER_INTERACTION',
      'CARVEOUT_NOTE',
      'DEVIATION_FROM_STANDARD',
      'BLANK_OR_MISSING_FIELD',
      'CROSS_DEAL_INTEREST'
    )
  ),
  CONSTRAINT provision_analytical_flags_severity_check CHECK (
    flag_severity IN ('INFO', 'ATTENTION', 'HIGH_ATTENTION')
  ),
  CONSTRAINT provision_analytical_flags_order_positive CHECK (display_order >= 1),
  CONSTRAINT provision_analytical_flags_span_pair_check CHECK (
    (source_span_start IS NULL AND source_span_end IS NULL)
    OR (source_span_start IS NOT NULL AND source_span_end IS NOT NULL AND source_span_start >= 0 AND source_span_end > source_span_start)
  )
);

CREATE INDEX IF NOT EXISTS provision_analytical_flags_card_idx
  ON public.provision_analytical_flags(card_id);

CREATE TABLE IF NOT EXISTS public.provision_cross_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  ref_kind text NOT NULL,
  ref_text text NOT NULL,
  to_card_id uuid REFERENCES public.provision_cards(id),
  to_definition_card_id uuid REFERENCES public.provision_cards(id),
  to_disclosure_schedule_ref text,
  to_exhibit_ref text,
  external_citation text,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  resolution_status text NOT NULL,
  resolution_confidence text,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provision_cross_references_kind_check CHECK (
    ref_kind IN (
      'SECTION',
      'DISCLOSURE_SCHEDULE',
      'EXHIBIT',
      'DEFINED_TERM',
      'EXTERNAL_STATUTE',
      'EXTERNAL_REGULATION',
      'EXTERNAL_DOCUMENT'
    )
  ),
  CONSTRAINT provision_cross_references_status_check CHECK (
    resolution_status IN ('RESOLVED', 'UNRESOLVED', 'EXTERNAL', 'AMBIGUOUS')
  ),
  CONSTRAINT provision_cross_references_confidence_check CHECK (
    resolution_confidence IS NULL OR resolution_confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  CONSTRAINT provision_cross_references_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT provision_cross_references_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS provision_cross_references_from_card_idx
  ON public.provision_cross_references(from_card_id);
CREATE INDEX IF NOT EXISTS provision_cross_references_to_card_idx
  ON public.provision_cross_references(to_card_id);
CREATE INDEX IF NOT EXISTS provision_cross_references_to_definition_idx
  ON public.provision_cross_references(to_definition_card_id);

CREATE TABLE IF NOT EXISTS public.provision_bring_downs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE UNIQUE,
  standard text NOT NULL,
  standard_verbatim_quote text,
  source_span_start integer,
  source_span_end integer,
  bring_down_section_ref text,
  bring_down_card_id uuid REFERENCES public.provision_cards(id),
  confidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provision_bring_downs_standard_check CHECK (
    standard IN (
      'TRUE_EXCEPT_MAE',
      'TRUE_IN_ALL_RESPECTS',
      'TRUE_IN_ALL_MATERIAL_RESPECTS',
      'TRUE_IN_ALL_RESPECTS_DE_MINIMIS_EXCEPTION',
      'FULL_MATERIALITY_SCRAPE',
      'CUSTOM',
      'N_A'
    )
  ),
  CONSTRAINT provision_bring_downs_confidence_check CHECK (
    confidence IN ('HIGH', 'MEDIUM', 'LOW')
  ),
  CONSTRAINT provision_bring_downs_quote_span_pair_check CHECK (
    (standard_verbatim_quote IS NULL AND source_span_start IS NULL AND source_span_end IS NULL)
    OR (standard_verbatim_quote IS NOT NULL AND source_span_start IS NOT NULL AND source_span_end IS NOT NULL AND source_span_start >= 0 AND source_span_end > source_span_start)
  )
);

CREATE INDEX IF NOT EXISTS provision_bring_downs_card_idx
  ON public.provision_bring_downs(card_id);
CREATE INDEX IF NOT EXISTS provision_bring_downs_bring_down_card_idx
  ON public.provision_bring_downs(bring_down_card_id);

CREATE TABLE IF NOT EXISTS public.representation_mae_subclauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  subclause_ref text NOT NULL,
  is_mae_qualified boolean NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT representation_mae_subclauses_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT representation_mae_subclauses_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS representation_mae_subclauses_card_idx
  ON public.representation_mae_subclauses(card_id);

CREATE TABLE IF NOT EXISTS public.material_contract_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  category_label text NOT NULL,
  category_kind text NOT NULL,
  threshold_amount numeric,
  threshold_amount_unit text,
  threshold_verbatim_quote text,
  is_included boolean NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT material_contract_categories_kind_check CHECK (
    category_kind IN (
      'CUSTOMER',
      'SUPPLIER',
      'REAL_PROPERTY_LEASE',
      'PERSONAL_PROPERTY_LEASE',
      'LICENSE_IN',
      'LICENSE_OUT',
      'JOINT_VENTURE',
      'PARTNERSHIP',
      'INDEBTEDNESS',
      'GUARANTY',
      'DERIVATIVE',
      'EMPLOYMENT',
      'CONSULTING',
      'NON_COMPETE',
      'CIP_OR_CAPEX',
      'SETTLEMENT',
      'GOVERNMENT_CONTRACT',
      'AFFILIATE_TRANSACTION',
      'OTHER'
    )
  ),
  CONSTRAINT material_contract_categories_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT material_contract_categories_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS material_contract_categories_card_idx
  ON public.material_contract_categories(card_id);
CREATE INDEX IF NOT EXISTS material_contract_categories_kind_idx
  ON public.material_contract_categories(category_kind);

CREATE TABLE IF NOT EXISTS public.closing_condition_bring_down_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  tier_label text NOT NULL,
  tier_standard text NOT NULL,
  tier_standard_quote text,
  cited_provision_card_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT closing_condition_bring_down_tiers_standard_check CHECK (
    tier_standard IN (
      'TRUE_EXCEPT_MAE',
      'TRUE_IN_ALL_RESPECTS',
      'TRUE_IN_ALL_MATERIAL_RESPECTS',
      'TRUE_IN_ALL_RESPECTS_DE_MINIMIS_EXCEPTION',
      'FULL_MATERIALITY_SCRAPE',
      'CUSTOM'
    )
  ),
  CONSTRAINT closing_condition_bring_down_tiers_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT closing_condition_bring_down_tiers_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS closing_condition_bring_down_tiers_card_idx
  ON public.closing_condition_bring_down_tiers(card_id);

CREATE TABLE IF NOT EXISTS public.closing_condition_cited_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.closing_condition_bring_down_tiers(id) ON DELETE CASCADE,
  cited_card_id uuid REFERENCES public.provision_cards(id),
  cited_ref_text text NOT NULL,
  cited_short_title text,
  display_order integer NOT NULL,
  CONSTRAINT closing_condition_cited_provisions_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS closing_condition_cited_provisions_tier_idx
  ON public.closing_condition_cited_provisions(tier_id);
CREATE INDEX IF NOT EXISTS closing_condition_cited_provisions_card_idx
  ON public.closing_condition_cited_provisions(cited_card_id);

CREATE TABLE IF NOT EXISTS public.ioc_positive_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  obligation_kind text NOT NULL,
  obligation_summary text NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT ioc_positive_obligations_kind_check CHECK (
    obligation_kind IN (
      'PRESERVE_BUSINESS',
      'MAINTAIN_INSURANCE',
      'MAINTAIN_LICENSES',
      'RETAIN_KEY_EMPLOYEES',
      'MAINTAIN_RELATIONSHIPS',
      'COMPLY_WITH_LAWS',
      'PAY_TAXES',
      'MAINTAIN_BOOKS_RECORDS',
      'PROTECT_IP',
      'OTHER'
    )
  ),
  CONSTRAINT ioc_positive_obligations_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT ioc_positive_obligations_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS ioc_positive_obligations_card_idx
  ON public.ioc_positive_obligations(card_id);
CREATE INDEX IF NOT EXISTS ioc_positive_obligations_kind_idx
  ON public.ioc_positive_obligations(obligation_kind);

CREATE TABLE IF NOT EXISTS public.ioc_negative_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  obligation_kind text NOT NULL,
  threshold_amount numeric,
  threshold_amount_unit text,
  threshold_verbatim_quote text,
  has_consent_carveout boolean NOT NULL,
  consent_standard text,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT ioc_negative_obligations_kind_check CHECK (
    obligation_kind IN (
      'ISSUE_EQUITY',
      'PAY_DIVIDENDS',
      'INCUR_DEBT',
      'INCUR_LIENS',
      'ACQUIRE_ASSETS',
      'DISPOSE_ASSETS',
      'AMEND_ORGANIZATIONAL_DOCS',
      'AMEND_MATERIAL_CONTRACTS',
      'ENTER_MATERIAL_CONTRACTS',
      'SETTLE_LITIGATION',
      'INCREASE_COMPENSATION',
      'HIRE_TERMINATE_KEY_EMPLOYEES',
      'CHANGE_ACCOUNTING',
      'MAKE_TAX_ELECTIONS',
      'CAPITAL_EXPENDITURES',
      'OTHER'
    )
  ),
  CONSTRAINT ioc_negative_obligations_consent_standard_check CHECK (
    consent_standard IS NULL OR consent_standard IN ('NONE', 'REASONABLE_DISCRETION', 'ABSOLUTE_DISCRETION', 'CUSTOM')
  ),
  CONSTRAINT ioc_negative_obligations_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT ioc_negative_obligations_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS ioc_negative_obligations_card_idx
  ON public.ioc_negative_obligations(card_id);
CREATE INDEX IF NOT EXISTS ioc_negative_obligations_kind_idx
  ON public.ioc_negative_obligations(obligation_kind);

CREATE TABLE IF NOT EXISTS public.termination_fee_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  trigger_kind text NOT NULL,
  fee_multiplier numeric,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT termination_fee_triggers_kind_check CHECK (
    trigger_kind IN (
      'TARGET_CHANGE_OF_RECOMMENDATION',
      'TARGET_ACCEPTS_SUPERIOR_PROPOSAL',
      'BUYER_ANTITRUST_FAILURE',
      'BUYER_FINANCING_FAILURE',
      'BUYER_BREACH',
      'TARGET_BREACH',
      'OUTSIDE_DATE_WITH_INTERVENING_ACQUISITION',
      'SHAREHOLDER_VOTE_FAILURE_WITH_TOP_UP',
      'OTHER'
    )
  ),
  CONSTRAINT termination_fee_triggers_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT termination_fee_triggers_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS termination_fee_triggers_card_idx
  ON public.termination_fee_triggers(card_id);
CREATE INDEX IF NOT EXISTS termination_fee_triggers_kind_idx
  ON public.termination_fee_triggers(trigger_kind);

CREATE TABLE IF NOT EXISTS public.definition_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.provision_cards(id) ON DELETE CASCADE,
  component_kind text NOT NULL,
  component_label text NOT NULL,
  component_summary text NOT NULL,
  source_span_start integer NOT NULL,
  source_span_end integer NOT NULL,
  verbatim_quote text NOT NULL,
  display_order integer NOT NULL,
  CONSTRAINT definition_components_kind_check CHECK (
    component_kind IN (
      'INCLUSION',
      'EXCLUSION',
      'CARVEOUT_TO_CARVEOUT',
      'QUALIFIER',
      'PROCEDURAL_STEP'
    )
  ),
  CONSTRAINT definition_components_span_valid CHECK (
    source_span_start >= 0 AND source_span_end > source_span_start
  ),
  CONSTRAINT definition_components_order_positive CHECK (display_order >= 1)
);

CREATE INDEX IF NOT EXISTS definition_components_card_idx
  ON public.definition_components(card_id);
CREATE INDEX IF NOT EXISTS definition_components_kind_idx
  ON public.definition_components(component_kind);
