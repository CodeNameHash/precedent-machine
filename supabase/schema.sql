-- Precedent Machine v2 — Full Schema (Phase 1-3)
-- Run in Supabase SQL Editor

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- DEALS
CREATE TABLE IF NOT EXISTS deals (
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

-- PROVISIONS
CREATE TABLE IF NOT EXISTS provisions (
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

-- ANNOTATIONS
CREATE TABLE IF NOT EXISTS annotations (
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

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id uuid REFERENCES annotations(id),
  user_id uuid REFERENCES users(id),
  body text,
  created_at timestamptz DEFAULT now()
);

-- SIGNOFFS
CREATE TABLE IF NOT EXISTS signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text,
  entity_id uuid,
  user_id uuid REFERENCES users(id),
  prior_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- COMPARISONS (Phase 3)
CREATE TABLE IF NOT EXISTS comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_ids uuid[],
  category text,
  summary text,
  ai_generated_at timestamptz,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ENABLE REALTIME (Phase 3)
ALTER PUBLICATION supabase_realtime ADD TABLE annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE signoffs;

-- RLS — Allow all via service role key
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE signoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON deals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON provisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON annotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON signoffs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON comparisons FOR ALL USING (true) WITH CHECK (true);

-- SEED USERS
INSERT INTO users (name, is_admin) VALUES
  ('Ben', true),
  ('Junior Associate', false),
  ('Mid Associate', false)
ON CONFLICT DO NOTHING;
