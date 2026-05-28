-- ai-metadata-schema.sql
--
-- Adds an ai_metadata JSONB column to the provisions table so the v2 parser
-- can persist structured, type-specific features alongside each provision.
-- Once applied, /lib/parser-v2/store.js will automatically start writing
-- { features, code, relatedDefinitions, ... } into this column.
--
-- Safe to run multiple times: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

ALTER TABLE provisions ADD COLUMN IF NOT EXISTS ai_metadata JSONB;
CREATE INDEX IF NOT EXISTS provisions_ai_metadata_idx ON provisions USING GIN (ai_metadata);
