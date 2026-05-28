-- Phase 1 of the learning system: capture corrections.
-- Run this in the Supabase SQL editor to enable correction logging.
--
-- Every edit to a provision (via PATCH /api/provisions) automatically inserts
-- a row here. Future learning phases will read from this table to retrain
-- classifiers, surface common mistakes, etc.

CREATE TABLE IF NOT EXISTS corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  provision_id uuid REFERENCES provisions(id) ON DELETE SET NULL,
  correction_type text NOT NULL,
  before jsonb,
  after jsonb,
  context jsonb,  -- section title, article context, original AI classification, etc.
  reason text,
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corrections_deal_idx ON corrections(deal_id);
CREATE INDEX IF NOT EXISTS corrections_type_idx ON corrections(correction_type);
CREATE INDEX IF NOT EXISTS corrections_created_idx ON corrections(created_at DESC);
