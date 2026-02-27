-- Precedent Machine — Full Schema v2
-- Run in Supabase SQL Editor (drop existing tables first if migrating)

-- ════════════════════════════════════════════════════
-- EXTENSIONS
-- ════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ════════════════════════════════════════════════════
-- LOOKUP TABLES
-- ════════════════════════════════════════════════════

-- Agreement types: merger, stock_purchase, asset_purchase, etc.
CREATE TABLE IF NOT EXISTS agreement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Provision types: MAE, IOC, REP, COND, TERM, etc.
CREATE TABLE IF NOT EXISTS provision_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Self-referencing category tree for arbitrary-depth taxonomy
CREATE TABLE IF NOT EXISTS provision_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_type_id uuid NOT NULL REFERENCES provision_types(id),
  parent_id uuid REFERENCES provision_categories(id),
  label text NOT NULL,
  depth int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(provision_type_id, label, parent_id)
);

-- ════════════════════════════════════════════════════
-- CORE TABLES
-- ════════════════════════════════════════════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Full scraped agreement text with SHA-256 hash
CREATE TABLE IF NOT EXISTS agreement_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  full_text text NOT NULL,
  text_hash text NOT NULL,
  source_url text,
  filing_date date,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Deals
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquirer text,
  target text,
  value_usd numeric,
  announce_date date,
  sector text,
  jurisdiction text,
  structure text,
  term_fee text,
  agreement_type_id uuid REFERENCES agreement_types(id),
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Provisions (self-referencing tree for sub-provisions/exceptions)
CREATE TABLE IF NOT EXISTS provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id),
  provision_type_id uuid REFERENCES provision_types(id),
  category_id uuid REFERENCES provision_categories(id),
  parent_id uuid REFERENCES provisions(id),
  -- Keep legacy text columns for backward compat
  type text,
  category text,
  full_text text,
  text_hash text,
  prohibition text,
  exceptions jsonb,
  ai_favorability text,
  depth int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  agreement_source_id uuid REFERENCES agreement_sources(id),
  ai_metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Annotations (with character-level offsets)
CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid REFERENCES provisions(id),
  phrase text,
  start_offset int,
  end_offset int,
  favorability text,
  note text,
  user_id uuid REFERENCES users(id),
  is_ai_generated boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  overrides_id uuid REFERENCES annotations(id),
  created_at timestamptz DEFAULT now()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid REFERENCES annotations(id),
  user_id uuid REFERENCES users(id),
  body text,
  created_at timestamptz DEFAULT now()
);

-- Signoffs
CREATE TABLE IF NOT EXISTS signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  user_id uuid REFERENCES users(id),
  prior_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Comparisons
CREATE TABLE IF NOT EXISTS comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_ids uuid[],
  category text,
  provision_type_id uuid REFERENCES provision_types(id),
  summary text,
  ai_generated_at timestamptz,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════

-- Auto-compute SHA-256 hash on provision text
CREATE OR REPLACE FUNCTION compute_provision_hash()
RETURNS trigger AS $$
BEGIN
  IF NEW.full_text IS NOT NULL THEN
    NEW.text_hash := encode(digest(NEW.full_text, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_provision_hash ON provisions;
CREATE TRIGGER trg_provision_hash
  BEFORE INSERT OR UPDATE OF full_text ON provisions
  FOR EACH ROW EXECUTE FUNCTION compute_provision_hash();

-- Auto-compute depth on provision_categories
CREATE OR REPLACE FUNCTION compute_category_depth()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.depth := 0;
  ELSE
    SELECT depth + 1 INTO NEW.depth
    FROM provision_categories WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_category_depth ON provision_categories;
CREATE TRIGGER trg_category_depth
  BEFORE INSERT OR UPDATE OF parent_id ON provision_categories
  FOR EACH ROW EXECUTE FUNCTION compute_category_depth();

-- Auto-set updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_updated ON deals;
CREATE TRIGGER trg_deals_updated
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_provisions_updated ON provisions;
CREATE TRIGGER trg_provisions_updated
  BEFORE UPDATE ON provisions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════

-- FK indexes
CREATE INDEX IF NOT EXISTS idx_deals_agreement_type ON deals(agreement_type_id);
CREATE INDEX IF NOT EXISTS idx_deals_announce_date ON deals(announce_date DESC);
CREATE INDEX IF NOT EXISTS idx_provisions_deal ON provisions(deal_id);
CREATE INDEX IF NOT EXISTS idx_provisions_type ON provisions(provision_type_id);
CREATE INDEX IF NOT EXISTS idx_provisions_category ON provisions(category_id);
CREATE INDEX IF NOT EXISTS idx_provisions_parent ON provisions(parent_id);
CREATE INDEX IF NOT EXISTS idx_provisions_source ON provisions(agreement_source_id);
CREATE INDEX IF NOT EXISTS idx_provisions_hash ON provisions(text_hash);
CREATE INDEX IF NOT EXISTS idx_provision_categories_type ON provision_categories(provision_type_id);
CREATE INDEX IF NOT EXISTS idx_provision_categories_parent ON provision_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_annotations_provision ON annotations(provision_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_annotation ON comments(annotation_id);
CREATE INDEX IF NOT EXISTS idx_signoffs_entity ON signoffs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_type ON comparisons(provision_type_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_provisions_deal_type ON provisions(deal_id, provision_type_id);
CREATE INDEX IF NOT EXISTS idx_provisions_deal_legacy_type ON provisions(deal_id, type);
CREATE INDEX IF NOT EXISTS idx_provision_categories_type_sort ON provision_categories(provision_type_id, sort_order);

-- ════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE signoffs;

-- ════════════════════════════════════════════════════
-- RLS (permissive for now)
-- ════════════════════════════════════════════════════

ALTER TABLE agreement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE provision_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE provision_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON agreement_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON provision_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON provision_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON agreement_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON provisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON annotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON signoffs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comparisons FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════
-- SEED: Lookup tables
-- ════════════════════════════════════════════════════

-- Agreement types
INSERT INTO agreement_types (key, label) VALUES
  ('merger', 'Merger Agreement'),
  ('stock_purchase', 'Stock Purchase Agreement'),
  ('asset_purchase', 'Asset Purchase Agreement')
ON CONFLICT (key) DO NOTHING;

-- Provision types
INSERT INTO provision_types (key, label) VALUES
  ('MAE', 'Material Adverse Effect'),
  ('IOC', 'Interim Operating Covenants')
ON CONFLICT (key) DO NOTHING;

-- Provision categories: MAE sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Base Definition', 1),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'General Economic / Market Conditions', 2),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Changes in Law / GAAP', 3),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Industry Conditions', 4),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'War / Terrorism', 5),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Acts of God / Pandemic', 6),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Failure to Meet Projections', 7),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Announcement / Pendency Effects', 8),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Actions at Parent Request', 9),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Disproportionate Impact Qualifier', 10),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Changes in Stock Price', 11),
  ((SELECT id FROM provision_types WHERE key = 'MAE'), 'Customer / Supplier Relationships', 12)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;

-- Provision categories: IOC sub-provisions
INSERT INTO provision_categories (provision_type_id, label, sort_order) VALUES
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'M&A / Acquisitions', 1),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Dividends / Distributions', 2),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Equity Issuances', 3),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Indebtedness', 4),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Capital Expenditures', 5),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Employee Compensation', 6),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Material Contracts', 7),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Accounting / Tax Changes', 8),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Ordinary Course Standard', 9),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Charter / Organizational Amendments', 10),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Stock Repurchases / Splits', 11),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Labor Agreements', 12),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Litigation Settlements', 13),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Liquidation / Dissolution', 14),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Stockholder Rights Plans', 15),
  ((SELECT id FROM provision_types WHERE key = 'IOC'), 'Catch-All / General', 16)
ON CONFLICT (provision_type_id, label, parent_id) DO NOTHING;
