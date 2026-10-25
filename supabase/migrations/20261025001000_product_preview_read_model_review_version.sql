-- The preview read model's review version (work package 39, plan finding
-- (255); work package 40, the second review, finding 11f).
--
-- 20261025000000_product_preview_read_model.sql created the table with
-- review_version in place. That file was also edited in place once while
-- the table was being built, so a database that applied the first form of
-- it has the table without the column, and the handler's read and write
-- would both fail and fall back to live reads with the cache off. This
-- migration makes the column exist either way: on a database that applied
-- the current file it changes nothing.

ALTER TABLE public.product_preview_reads
  ADD COLUMN IF NOT EXISTS review_version integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.product_preview_reads'::regclass
      AND conname = 'product_preview_reads_review_version_check'
  ) THEN
    ALTER TABLE public.product_preview_reads
      ADD CONSTRAINT product_preview_reads_review_version_check CHECK (review_version >= 0);
  END IF;
END;
$$;

COMMENT ON COLUMN public.product_preview_reads.review_version IS
  'The review session version the stored projection was built from; the page is served only while it matches (lib/product/preview-read-model.js).';
