BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
SELECT jsonb_build_object(
  'agreement_capture', (
    SELECT canonical_payload - 'response_bytes_base64'
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE retrieval_url_sha256='c089e4896d7d1486f7d86ebe5b854b0cf2d4afcd2afcbcf9b8483133435d4f2e'
      AND response_bytes_sha256='abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d'
  ),
  'deal_value_capture', (
    SELECT canonical_payload - 'response_bytes_base64'
    FROM canonical_v2_staging.intake_capture_receipts
    WHERE retrieval_url_sha256='0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442'
      AND response_bytes_sha256='343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827'
  ),
  'active_pointer', (
    SELECT canonical_payload
    FROM canonical_v2_staging.active_corpus_release_pointers
    WHERE environment='staging'
  )
) AS block00;
ROLLBACK;
