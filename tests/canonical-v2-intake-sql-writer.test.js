const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/canonical-v2-foundation.sql', 'utf8');
const schemaRunner = fs.readFileSync('scripts/canonical-v2-staging-schema.mjs', 'utf8');

test('the staging SQL writer persists intake receipts through its closed operation', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_v2_staging\.intake_capture_receipts/);
  assert.match(sql, /ALTER TABLE canonical_v2_staging\.intake_capture_receipts ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /'FIXTURE_CORRECTION_AUTHORITY',\s*'INTAKE_CAPTURE'/);
  assert.match(sql, /IF p_operation = 'INTAKE_CAPTURE' THEN/);
  assert.match(sql, /p_write_set - 'intake_capture' <> '\{\}'::jsonb/);
  assert.match(sql, /p_residuals IS DISTINCT FROM '\[\]'::jsonb[\s\S]*p_quarantines IS DISTINCT FROM '\[\]'::jsonb/);
  assert.match(sql, /'SEC_EDGAR_INTAKE_CAPTURE\/V1'[\s\S]*'ORIGINAL_HTTP_RESPONSE_BYTES'[\s\S]*'www\.sec\.gov'/);
  assert.match(sql, /replace\(encode\(decode\(item->>'response_bytes_base64', 'base64'\), 'base64'\)/);
  assert.match(sql, /octet_length\(decode\(item->>'response_bytes_base64', 'base64'\)\)/);
  assert.match(sql, /extensions\.digest\([\s\S]*decode\(item->>'response_bytes_base64', 'base64'\),[\s\S]*'sha256'/);
  assert.match(sql, /intake capture receipt identity conflict/);
  assert.match(sql, /INSERT INTO canonical_v2_staging\.intake_capture_receipts[\s\S]*INSERT INTO canonical_v2_staging\.write_receipts/);
});

test('intake storage stays behind the writer and schema verification checks denial', () => {
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA canonical_v2_staging[\s\S]*canonical_v2_writer/);
  assert.doesNotMatch(sql, /GRANT (?:SELECT|INSERT|UPDATE|DELETE)[\s\S]{0,200}intake_capture_receipts/);
  assert.match(schemaRunner, /intake_capture_receipt_table_exists/);
  assert.match(schemaRunner, /service_role_intake_capture_table_denied/);
  assert.match(schemaRunner, /serving_intake_capture_table_denied/);
  assert.match(schemaRunner, /writer_intake_capture_table_denied/);
});

test('the schema runner pins the exact intake-capable foundation', () => {
  const digest = crypto.createHash('sha256').update(sql).digest('hex');
  assert.match(schemaRunner, new RegExp(`'canonical-v2-foundation\\.sql': '${digest}'`));
});
