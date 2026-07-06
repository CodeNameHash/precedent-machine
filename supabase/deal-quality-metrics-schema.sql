-- Stored quality metrics for /admin/gaps summary.
-- Apply through the Supabase SQL Editor. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.deal_quality_metrics (
  deal_id uuid PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  metrics_version int NOT NULL DEFAULT 1,
  provision_count int NOT NULL DEFAULT 0 CHECK (provision_count >= 0),
  source_chars int NOT NULL DEFAULT 0 CHECK (source_chars >= 0),
  source_text_hash text,
  provisions_fingerprint text,
  coverage_pct numeric(5,2),
  reviewable_coverage_pct numeric(5,2),
  raw_coverage_pct numeric(5,2),
  reviewable_gap_chars int NOT NULL DEFAULT 0 CHECK (reviewable_gap_chars >= 0),
  reviewable_effective_chars int NOT NULL DEFAULT 0 CHECK (reviewable_effective_chars >= 0),
  canonical_rate numeric(8,6),
  unverified_quotes int CHECK (unverified_quotes IS NULL OR unverified_quotes >= 0),
  gap_count int NOT NULL DEFAULT 0 CHECK (gap_count >= 0),
  ignored_gap_count int NOT NULL DEFAULT 0 CHECK (ignored_gap_count >= 0),
  parser_structural_gap_count int CHECK (parser_structural_gap_count IS NULL OR parser_structural_gap_count >= 0),
  definition_warning_count int CHECK (definition_warning_count IS NULL OR definition_warning_count >= 0),
  data_model_flag_count int CHECK (data_model_flag_count IS NULL OR data_model_flag_count >= 0),
  needs_code_count int NOT NULL DEFAULT 0 CHECK (needs_code_count >= 0),
  needs_code_proposed_count int NOT NULL DEFAULT 0 CHECK (needs_code_proposed_count >= 0),
  needs_code_type_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  uncoded_count int NOT NULL DEFAULT 0 CHECK (uncoded_count >= 0),
  uncoded_proposed_count int NOT NULL DEFAULT 0 CHECK (uncoded_proposed_count >= 0),
  uncoded_type_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  largest_gap_chars int NOT NULL DEFAULT 0 CHECK (largest_gap_chars >= 0),
  largest_gap_preview text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_quality_metrics_coverage
  ON public.deal_quality_metrics(coverage_pct ASC NULLS LAST, largest_gap_chars DESC);

CREATE INDEX IF NOT EXISTS idx_deal_quality_metrics_computed
  ON public.deal_quality_metrics(computed_at DESC);

CREATE OR REPLACE FUNCTION public.set_deal_quality_metrics_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_quality_metrics_updated ON public.deal_quality_metrics;
CREATE TRIGGER trg_deal_quality_metrics_updated
  BEFORE UPDATE ON public.deal_quality_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_deal_quality_metrics_updated_at();

CREATE OR REPLACE FUNCTION public.invalidate_deal_quality_metrics_for_provision()
RETURNS trigger AS $$
DECLARE
  affected_deal_id uuid;
BEGIN
  affected_deal_id := COALESCE(NEW.deal_id, OLD.deal_id);
  IF affected_deal_id IS NOT NULL THEN
    DELETE FROM public.deal_quality_metrics WHERE deal_id = affected_deal_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_deal_quality_metrics_provisions_changed ON public.provisions;
CREATE TRIGGER trg_deal_quality_metrics_provisions_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.provisions
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_deal_quality_metrics_for_provision();

CREATE OR REPLACE FUNCTION public.invalidate_deal_quality_metrics_for_deal()
RETURNS trigger AS $$
BEGIN
  IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    DELETE FROM public.deal_quality_metrics WHERE deal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_deal_quality_metrics_deals_changed ON public.deals;
CREATE TRIGGER trg_deal_quality_metrics_deals_changed
  AFTER UPDATE OF metadata ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_deal_quality_metrics_for_deal();

ALTER TABLE public.deal_quality_metrics ENABLE ROW LEVEL SECURITY;
