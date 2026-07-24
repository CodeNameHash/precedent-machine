-- Block 00b — read-only follow-up: staged admission-chain payloads, so the
-- generator can diff its re-derivation field-by-field against what staging
-- actually holds (the re-derived agreement admission id did not match the
-- pinned f31cad8c…). Excludes the two bulky fields (canonical_text,
-- source_map_payload_base64) — every remaining field is digest-checkable.
-- Run in the STAGING SQL Editor (sjumbznveyyiizhwvixj); paste the JSON back.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='60000ms';
SELECT jsonb_build_object(
  'agreement', jsonb_build_object(
    'conversion', (SELECT canonical_payload - 'canonical_text' - 'source_map_payload_base64'
      FROM canonical_v2_staging.canonical_text_conversions
      WHERE canonical_text_id='bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1'),
    'verification', (SELECT canonical_payload
      FROM canonical_v2_staging.canonical_text_verification_manifests
      WHERE canonical_payload->>'canonical_text_id'='bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1'),
    'immutable', (SELECT canonical_payload
      FROM canonical_v2_staging.immutable_source_documents
      WHERE canonical_payload->>'canonical_text_id'='bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1'),
    'admission', (SELECT canonical_payload
      FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id='f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819'),
    'envelope', (SELECT canonical_payload - 'admitted_intervals' - 'excluded_intervals'
      FROM canonical_v2_staging.semantic_extraction_input_envelopes
      WHERE source_admission_manifest_id='f31cad8c3813ededa01c644891b0b2e14c6a475d868ba89f6b60b597f0e1d819')
  ),
  'deal_value', jsonb_build_object(
    'conversion', (SELECT canonical_payload - 'canonical_text' - 'source_map_payload_base64'
      FROM canonical_v2_staging.canonical_text_conversions
      WHERE canonical_text_id='d7c3caff402ccb2912ce35e1a0fbfaff722316590686cead385a93e3466141cd'),
    'verification', (SELECT canonical_payload
      FROM canonical_v2_staging.canonical_text_verification_manifests
      WHERE canonical_payload->>'canonical_text_id'='d7c3caff402ccb2912ce35e1a0fbfaff722316590686cead385a93e3466141cd'),
    'immutable', (SELECT canonical_payload
      FROM canonical_v2_staging.immutable_source_documents
      WHERE canonical_payload->>'canonical_text_id'='d7c3caff402ccb2912ce35e1a0fbfaff722316590686cead385a93e3466141cd'),
    'admission', (SELECT canonical_payload
      FROM canonical_v2_staging.source_admission_manifests
      WHERE source_admission_manifest_id='8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c'),
    'envelope', (SELECT canonical_payload - 'admitted_intervals' - 'excluded_intervals'
      FROM canonical_v2_staging.semantic_extraction_input_envelopes
      WHERE source_admission_manifest_id='8f34cf68078f669f9abac88ce5d5ac5cd1c331803beead14c55ec72a5bb3398c')
  )
) AS block00b;
ROLLBACK;
