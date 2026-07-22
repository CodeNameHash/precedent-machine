const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-sec-intake.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('SEC intake runner is pinned to isolated staging projects and one writer', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging-snapshot/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /BEGIN\$\{readOnly \? ' TRANSACTION READ ONLY'/);
  assert.match(source, /WHERE id='\$\{QXO_DEAL_ID\}'::uuid/);
  assert.match(source, /public\.canonical_v2_write/);
  assert.match(source, /'INTAKE_CAPTURE'/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i);
});

test('SEC intake runner is rollback-first and pins original response bytes', () => {
  assert.match(source, /response_bytes_sha256: 'abba0430/);
  assert.match(source, /response_byte_length: 958459/);
  assert.match(source, /query\(ROOT, writeSql\(write\)\)/);
  assert.match(source, /query\(ROOT, writeSql\(write\), \{ commit: true \}\)/);
  assert.match(source, /canonical_text_status/);
  assert.match(source, /source_admission_status/);
});

test('SEC intake runner does not emit the URL, bytes or credentials', () => {
  const body = source.slice(source.indexOf('function attestation'), source.indexOf('const mode'));
  assert.doesNotMatch(body, /response_bytes_base64|retrieval_url[^_]|password|service_role/i);
  assert.match(body, /retrieval_url_sha256/);
  assert.match(source, /redacted-database-url/);
});

test('SEC intake runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--dry-run', '--extra'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
