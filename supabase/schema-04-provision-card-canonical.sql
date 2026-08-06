-- WP-M2-00 Step 2 canonical provision-card fields.
-- Additive only. Safe to run more than once after supabase/schema-03-card-model.sql.

DO $$
BEGIN
  CREATE TYPE public.provision_card_kind AS ENUM ('standard', 'definition', 'cross-reference');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.provision_cards
  ADD COLUMN IF NOT EXISTS provision_instance_id text,
  ADD COLUMN IF NOT EXISTS excerpt_id text,
  ADD COLUMN IF NOT EXISTS kind public.provision_card_kind NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS defined_term text,
  ADD COLUMN IF NOT EXISTS defined_value text,
  ADD COLUMN IF NOT EXISTS "references" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.provision_cards
SET provision_instance_id = concat_ws(':', deal_id::text, section_ref, region_hash)
WHERE provision_instance_id IS NULL;

UPDATE public.provision_cards
SET excerpt_id = provision_instance_id || ':0'
WHERE excerpt_id IS NULL;

-- CAUTION (docs/codex-program/ROADMAP.md P5, lib/parser-v2/resolve-source-span.js
-- header): primary_quote_start/primary_quote_end are region_full_text-relative
-- (store-cards.js's quoteSpan()), not a full-document offset pair, and can be
-- the {0, quote.length} placeholder quoteSpan() writes when it cannot locate
-- the quote in region_full_text at all. Relabeling them here as
-- source_doc_offset_start/end for any row backfilled by this UPDATE
-- propagates that ambiguity into provenance under a name that reads as
-- "verified full-document offset." Any row provenance touches from here on
-- also carries primary_quote_span_verified / primary_quote_span_coordinate_space
-- (lib/parser-v2/store-cards.js buildProvenance) precisely so a consumer can
-- tell a live write's pair apart from this one-time backfill's; rows only
-- ever touched by this migration do not have those two keys and must not be
-- trusted as full-document offsets without independently verifying
-- full_text.slice(source_doc_offset_start, source_doc_offset_end).
UPDATE public.provision_cards
SET provenance = jsonb_build_object(
  'source_doc_id', deal_id::text,
  'source_doc_page', 0,
  'source_doc_offset_start', primary_quote_start,
  'source_doc_offset_end', primary_quote_end,
  'extractor_name', extracted_by,
  'extractor_version', extraction_version,
  'model', 'legacy',
  'prompt_hash', 'legacy',
  'run_id', 'legacy-schema-04-backfill',
  'extracted_at', extracted_at
) || provenance
WHERE NOT (
  provenance ?& array[
    'source_doc_id',
    'source_doc_page',
    'source_doc_offset_start',
    'source_doc_offset_end',
    'extractor_name',
    'extractor_version',
    'model',
    'prompt_hash',
    'run_id',
    'extracted_at'
  ]
);

ALTER TABLE public.provision_cards
  ALTER COLUMN provision_instance_id SET NOT NULL,
  ALTER COLUMN excerpt_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.provision_cards
    ADD CONSTRAINT provision_cards_provision_instance_id_present
    CHECK (length(trim(provision_instance_id)) > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.provision_cards
    ADD CONSTRAINT provision_cards_excerpt_id_present
    CHECK (length(trim(excerpt_id)) > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.provision_cards
    ADD CONSTRAINT provision_cards_kind_payload_check
    CHECK (
      (kind <> 'definition' OR (defined_term IS NOT NULL AND length(trim(defined_term)) > 0 AND defined_value IS NOT NULL AND length(trim(defined_value)) > 0))
      AND (kind <> 'cross-reference' OR jsonb_array_length("references") > 0)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.provision_cards
    ADD CONSTRAINT provision_cards_references_array_check
    CHECK (jsonb_typeof("references") = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.provision_cards
    ADD CONSTRAINT provision_cards_provenance_object_check
    CHECK (
      jsonb_typeof(provenance) = 'object'
      AND provenance ?& array[
        'source_doc_id',
        'source_doc_page',
        'source_doc_offset_start',
        'source_doc_offset_end',
        'extractor_name',
        'extractor_version',
        'model',
        'prompt_hash',
        'run_id',
        'extracted_at'
      ]
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS provision_cards_provision_instance_unique
  ON public.provision_cards(provision_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS provision_cards_excerpt_unique
  ON public.provision_cards(excerpt_id);

CREATE INDEX IF NOT EXISTS provision_cards_provision_instance_idx
  ON public.provision_cards(provision_instance_id);

CREATE INDEX IF NOT EXISTS provision_cards_kind_idx
  ON public.provision_cards(kind);
