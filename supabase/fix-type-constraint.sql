-- Fix provisions type constraint
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- The provisions table has a check constraint that only allows 'MAE' and 'IOC'
-- as type values. This script drops the constraint and decodes the workaround
-- encoding (real type was stored as prefix in category field: "REP-T::Organization").

-- Step 1: Drop the restrictive check constraint
ALTER TABLE provisions DROP CONSTRAINT IF EXISTS provisions_type_check;

-- Step 2: Decode the encoded type from category field
-- During ingestion, real type was stored as "REAL_TYPE::category" in the category column
-- and type was set to 'MAE' to pass the constraint. Now fix both columns.
UPDATE provisions
SET type = split_part(category, '::', 1),
    category = substring(category from position('::' in category) + 2)
WHERE category LIKE '%::%';

-- Step 3: Add missing columns that exist in schema.sql but not in deployed DB
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS display_tier smallint DEFAULT 2;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS ai_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS text_hash text;
ALTER TABLE provisions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 4: Populate display_tier based on type
UPDATE provisions SET display_tier = CASE
  WHEN type IN ('MAE','NOSOL','ANTI','COND-M','COND-B','COND-S','TERMR','TERMF') THEN 1
  WHEN type IN ('STRUCT','CONSID','REP-T','REP-B','IOC','COV') THEN 2
  WHEN type IN ('DEF','MISC') THEN 3
  ELSE 2
END;

-- Step 5: Also fix SUPABASE_SERVICE_ROLE_KEY in .env.local
-- The current key is the anon key (role: "anon"). Get the actual service_role key from:
-- Supabase Dashboard → Settings → API → service_role key
