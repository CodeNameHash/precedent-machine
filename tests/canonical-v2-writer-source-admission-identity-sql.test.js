const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const start = sql.indexOf("IF p_operation = 'PREPARE_SOURCE_ADMISSION' THEN");
const end = sql.indexOf("IF p_operation = 'DEAL_SCOPE_RUN' THEN", start + 1);
const branch = sql.slice(start, end);
const firstInsert = branch.indexOf(
  'INSERT INTO canonical_v2_staging.canonical_text_conversions',
);

function assertIdentityBeforeInsert(pattern, label) {
  const match = pattern.exec(branch);
  assert.ok(match, `${label} recomputation must be present`);
  assert.ok(match.index < firstInsert, `${label} recomputation must precede DML`);
}

test('all source-admission identities are recomputed from exact bodies before DML', () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.notEqual(firstInsert, -1);

  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SEC_CANONICAL_TEXT\/V2',\s*jsonb_build_object\(\s*'source_response_content_id', conversion->'source_response_content_id',\s*'converter_digest', conversion->'converter_digest',\s*'converter_config_digest', conversion->'converter_config_digest',\s*'canonical_text_sha256', conversion->'canonical_text_sha256',\s*'canonical_text_byte_length', conversion->'canonical_text_byte_length',\s*'source_map_digest', conversion->'source_map_digest'\s*\)\s*\)/,
    'canonical text',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'CANONICAL_TEXT_VERIFICATION_MANIFEST\/V1',\s*verification - 'verification_manifest_id'\s*\)/,
    'verification manifest',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'IMMUTABLE_SOURCE_DOCUMENT\/V2',\s*immutable_source - 'immutable_source_document_id'\s*\)/,
    'immutable source',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SOURCE_ADMISSION_COVERAGE_PROOF\/V2',\s*jsonb_build_object\(\s*'canonical_text_id', conversion->'canonical_text_id',\s*'canonical_text_byte_length', conversion->'canonical_text_byte_length',\s*'source_map_digest', conversion->'source_map_digest',\s*'admitted_intervals', source_admission->'admitted_intervals',\s*'excluded_intervals', source_admission->'excluded_intervals',\s*'discrepancy_count', source_admission->'discrepancy_count'\s*\)\s*\)/,
    'coverage proof',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SOURCE_ADMISSION_MANIFEST\/V2',\s*source_admission - 'source_admission_manifest_id'\s*\)/,
    'source admission manifest',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SOURCE_ADMISSION_PREPARATION_SLOT\/V1',\s*jsonb_build_object\(\s*'intake_capture_receipt_id', capture->'intake_capture_receipt_id',\s*'source_admission_manifest_id',\s*source_admission->'source_admission_manifest_id'\s*\)\s*\)/,
    'preparation slot',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SOURCE_ADMISSION_PREPARATION_RECEIPT\/V1',\s*preparation_receipt - 'source_admission_preparation_receipt_id'\s*\)/,
    'preparation receipt',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'SEMANTIC_EXTRACTION_INPUT_ENVELOPE\/V1',\s*semantic_input - 'semantic_extraction_input_envelope_id'\s*\)/,
    'semantic input envelope',
  );
  assertIdentityBeforeInsert(
    /canonical_v2_staging\.content_id\(\s*'VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE\/V1',\s*source_admission_bundle - 'verified_sec_source_admission_bundle_id'\s*\)/,
    'verified source admission bundle',
  );
});

test('identity failures remain explicit check violations before operation receipt validation', () => {
  const operationReceipt = branch.indexOf(
    'invalid source admission preparation write receipt',
  );
  const identityMessages = [
    'canonical text conversion identity does not match its payload',
    'canonical text verification identity does not match its payload',
    'immutable source document identity does not match its payload',
    'source admission coverage proof identity does not match its payload',
    'source admission manifest identity does not match its payload',
    'source admission preparation slot identity does not match its payload',
    'source admission preparation receipt identity does not match its payload',
    'semantic extraction input envelope identity does not match its payload',
    'verified source admission bundle identity does not match its payload',
  ];

  assert.notEqual(operationReceipt, -1);
  for (const message of identityMessages) {
    const position = branch.indexOf(message);
    assert.notEqual(position, -1);
    assert.ok(position < operationReceipt);
    assert.match(
      branch.slice(position, operationReceipt),
      /USING ERRCODE = '23514'/,
    );
  }
});
