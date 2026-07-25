const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');

function operationBranch(operation, nextOperation) {
  const start = sql.indexOf(`IF p_operation = '${operation}' THEN`);
  const end = sql.indexOf(`IF p_operation = '${nextOperation}' THEN`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return sql.slice(start, end);
}

test('intake identities are recomputed from their exact canonical bodies before DML', () => {
  const branch = operationBranch('INTAKE_CAPTURE', 'STAGE_SOURCE_ARTIFACT_CHUNK');
  const insert = branch.indexOf(
    'INSERT INTO canonical_v2_staging.intake_capture_receipts',
  );
  const responseFormula = /canonical_v2_staging\.content_id\(\s*'SEC_HTTP_RESPONSE_CONTENT\/V1',\s*jsonb_build_object\(\s*'authority_representation', item->'authority_representation',\s*'response_content_type', item->'response_content_type',\s*'response_bytes_sha256', item->'response_bytes_sha256',\s*'response_byte_length', item->'response_byte_length'\s*\)\s*\)/;
  const receiptFormula = /canonical_v2_staging\.content_id\(\s*'INTAKE_CAPTURE_RECEIPT\/V1',\s*item - 'intake_capture_receipt_id'\s*\)/;
  const responseIdentity = responseFormula.exec(branch);
  const receiptIdentity = receiptFormula.exec(branch);

  assert.notEqual(insert, -1);
  assert.ok(responseIdentity);
  assert.ok(receiptIdentity);
  assert.ok(responseIdentity.index < insert);
  assert.ok(receiptIdentity.index < insert);
  assert.match(branch, /intake capture content-addressed identity does not match its payload/);
});

test('source artifact identities are recomputed from exact canonical bodies before DML', () => {
  const branch = operationBranch('STAGE_SOURCE_ARTIFACT_CHUNK', 'PREPARE_SOURCE_ADMISSION');
  const insert = branch.indexOf(
    'INSERT INTO canonical_v2_staging.source_artifact_manifests',
  );
  const manifestFormula = /canonical_v2_staging\.content_id\(\s*'SOURCE_ARTIFACT_MANIFEST\/V1',\s*artifact_manifest - 'artifact_manifest_id'\s*\)/;
  const chunkFormula = /canonical_v2_staging\.content_id\(\s*'SOURCE_ARTIFACT_CHUNK\/V1',\s*artifact_chunk - 'chunk_id'\s*\)/;
  const manifestIdentity = manifestFormula.exec(branch);
  const chunkIdentity = chunkFormula.exec(branch);

  assert.notEqual(insert, -1);
  assert.ok(manifestIdentity);
  assert.ok(chunkIdentity);
  assert.ok(manifestIdentity.index < insert);
  assert.ok(chunkIdentity.index < insert);
  assert.match(branch, /source artifact manifest identity does not match its payload/);
  assert.match(branch, /source artifact chunk identity does not match its payload/);
});
