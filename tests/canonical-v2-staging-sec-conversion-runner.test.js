const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-sec-conversion.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('staging SEC conversion runner is pinned and read-only', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout='10000ms'/);
  assert.match(source, /intake_capture_receipts/);
  assert.match(source, /response_bytes_sha256: 'abba0430/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE|canonical_v2_write)\b/i);
});

test('staging SEC conversion attestation excludes source text, bytes and credentials', () => {
  const body = source.slice(source.indexOf('function attest'), source.indexOf('if (process.argv.length'));
  assert.doesNotMatch(body, /response_bytes_base64|retrieval_url[^_]|password|service_role/i);
  assert.doesNotMatch(body, /^\s+canonical_text:/m);
  assert.match(body, /canonical_text_sha256/);
  assert.match(body, /source_map_digest/);
  assert.match(body, /verification_manifest_id/);
  assert.match(body, /independent_verification_status/);
  assert.match(body, /prepared_source_admission/);
  assert.match(body, /persistence_status: 'NOT_WRITTEN'/);
  assert.match(body, /qxo_anchor_offsets/);
  assert.match(body, /qxo_governed_spans/);
  assert.match(body, /sha256Hex/);
});

test('staging SEC conversion runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
