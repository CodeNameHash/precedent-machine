-- Precedent Machine v2 — Schema
-- Run in Supabase SQL Editor

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acquirer text,
  target text,
  value_usd numeric,
  announce_date date,
  sector text,
  metadata jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PROVISIONS
-- ============================================================
CREATE TABLE provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES deals(id),
  type text CHECK (type IN ('MAE', 'IOC')),
  category text,
  full_text text,
  prohibition text,
  exceptions jsonb,
  ai_favorability text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- ANNOTATIONS
-- ============================================================
CREATE TABLE annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provision_id uuid REFERENCES provisions(id),
  phrase text,
  favorability text,
  note text,
  user_id uuid REFERENCES users(id),
  is_ai_generated boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  overrides_id uuid REFERENCES annotations(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid REFERENCES annotations(id),
  user_id uuid REFERENCES users(id),
  body text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- SIGNOFFS
-- ============================================================
CREATE TABLE signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  user_id uuid REFERENCES users(id),
  prior_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- COMPARISONS
-- ============================================================
CREATE TABLE comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_ids uuid[],
  category text,
  summary text,
  ai_generated_at timestamptz,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO users (name, is_admin) VALUES
  ('Ben', true),
  ('Junior Associate', false),
  ('Mid Associate', false);
