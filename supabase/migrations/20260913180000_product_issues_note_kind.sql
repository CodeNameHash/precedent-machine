-- Issue kind NOTE: a recorded observation that holds nothing (CONCLUSIONS_MISSING,
-- CONCLUSIONS_DROPPED). Ben, 2026-09-13: a readout that fails validation is
-- dropped with a note and the fact stays valid. The Phase 2 check constraint
-- listed only EXTRACTION, VALIDATION and COVERAGE, so the first NOTE issue
-- failed the section commit (Metsera generation 2, 18:0x UTC).
ALTER TABLE public.product_issues DROP CONSTRAINT IF EXISTS product_issues_kind_check;
ALTER TABLE public.product_issues
  ADD CONSTRAINT product_issues_kind_check CHECK (kind IN ('EXTRACTION', 'VALIDATION', 'COVERAGE', 'NOTE'));
