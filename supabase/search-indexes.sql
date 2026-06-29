-- Precedent Machine — Cross-deal search indexes + helper RPC
-- ════════════════════════════════════════════════════════════════════════
-- Run once in the Supabase SQL Editor. These are PERFORMANCE objects only —
-- the /api/search/* endpoints query correctly without them (just slower).
-- They make cross-deal queries by full-text, provision type/code, category
-- and feature-key presence fast as the corpus grows past a few thousand
-- provisions.
-- ════════════════════════════════════════════════════════════════════════

-- Trigram extension powers fast case-insensitive ILIKE '%term%' substring
-- search on clause text (what the search box does today).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Full-text search vector on clause text (ranked relevance search).
CREATE INDEX IF NOT EXISTS idx_provisions_fts
  ON provisions USING gin (to_tsvector('english', coalesce(full_text, '')));

-- 2. Trigram index for substring ILIKE on clause text + category label.
CREATE INDEX IF NOT EXISTS idx_provisions_fulltext_trgm
  ON provisions USING gin (full_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_provisions_category_trgm
  ON provisions USING gin (category gin_trgm_ops);

-- 3. Legacy text-type filter (e.g. type IN ('TERMR','TERMR-M',…)).
CREATE INDEX IF NOT EXISTS idx_provisions_type_text ON provisions (type);

-- 4. Canonical code lives in ai_metadata->>'code'. Expression index makes
--    `WHERE ai_metadata->>'code' = 'DEF-MAE'` and IN-lists fast.
CREATE INDEX IF NOT EXISTS idx_provisions_code
  ON provisions ((ai_metadata->>'code'));

-- 5. Favorability filter.
CREATE INDEX IF NOT EXISTS idx_provisions_favorability ON provisions (ai_favorability);

-- 6. General JSONB containment / key-presence on the feature bag
--    (`ai_metadata->'features' ? 'carveouts'`, containment queries, etc.).
CREATE INDEX IF NOT EXISTS idx_provisions_ai_metadata_gin
  ON provisions USING gin (ai_metadata jsonb_path_ops);

-- ════════════════════════════════════════════════════════════════════════
-- Optional ranked-search RPC. /api/search/provisions uses the PostgREST query
-- builder by default; if this function exists it can be called via
-- supabase.rpc('search_provisions', {...}) for ts_rank-ordered results with a
-- highlighted snippet. Safe to create now; the API degrades gracefully if absent.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_provisions(
  q            text   DEFAULT NULL,
  type_filter  text[] DEFAULT NULL,
  code_filter  text[] DEFAULT NULL,
  deal_filter  uuid[] DEFAULT NULL,
  fav_filter   text   DEFAULT NULL,
  feature_key  text   DEFAULT NULL,
  max_rows     int    DEFAULT 50,
  row_offset   int    DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  deal_id uuid,
  acquirer text,
  target text,
  sector text,
  announce_date date,
  type text,
  code text,
  category text,
  favorability text,
  snippet text,
  rank real,
  total_count bigint
)
LANGUAGE sql STABLE AS $$
  WITH filtered AS (
    SELECT p.*, d.acquirer, d.target, d.sector, d.announce_date,
           (p.ai_metadata->>'code') AS code_val
    FROM provisions p
    JOIN deals d ON d.id = p.deal_id
    WHERE (q IS NULL OR q = ''
           OR to_tsvector('english', coalesce(p.full_text,'')) @@ plainto_tsquery('english', q)
           OR p.full_text ILIKE '%'||q||'%'
           OR p.category ILIKE '%'||q||'%')
      AND (type_filter IS NULL OR p.type = ANY(type_filter))
      AND (code_filter IS NULL OR (p.ai_metadata->>'code') = ANY(code_filter))
      AND (deal_filter IS NULL OR p.deal_id = ANY(deal_filter))
      AND (fav_filter  IS NULL OR p.ai_favorability = fav_filter)
      AND (feature_key IS NULL OR (p.ai_metadata->'features') ? feature_key)
  ), counted AS (
    SELECT count(*) AS n FROM filtered
  )
  SELECT f.id, f.deal_id, f.acquirer, f.target, f.sector, f.announce_date,
         f.type, f.code_val AS code, f.category, f.ai_favorability AS favorability,
         left(coalesce(f.full_text,''), 320) AS snippet,
         CASE WHEN q IS NULL OR q = '' THEN 0
              ELSE ts_rank(to_tsvector('english', coalesce(f.full_text,'')),
                           plainto_tsquery('english', q)) END AS rank,
         counted.n AS total_count
  FROM filtered f, counted
  ORDER BY rank DESC, f.announce_date DESC NULLS LAST
  LIMIT greatest(1, least(max_rows, 200)) OFFSET greatest(0, row_offset);
$$;
