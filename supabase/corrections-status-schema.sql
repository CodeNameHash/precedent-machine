-- Correct-tab: editor roles, pending queue, weekly review.
-- Spec: docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md
--
-- Additive to supabase/corrections-schema.sql. Run this in the Supabase SQL
-- editor (manual apply, like every other file in this directory — DO NOT
-- run this from an agent session).
--
-- The DEFAULT 'applied' on `status` means every row written by the existing
-- logCorrection() insert path (pages/api/provisions.js's v1 PATCH flow)
-- keeps working completely unchanged: no application code has to set
-- status explicitly to preserve today's behavior. The 26 existing rows all
-- backfill to 'applied' too, per the product decision that they were direct
-- edits, not queued proposals.

ALTER TABLE corrections
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied',
  ADD COLUMN IF NOT EXISTS submitted_by text,
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES provision_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_attribute text;

DO $$
BEGIN
  ALTER TABLE corrections
    ADD CONSTRAINT corrections_status_check
    CHECK (status IN ('pending', 'applied', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS corrections_status_created_idx
  ON corrections(status, created_at);
