const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-qxo-deal-value-source.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('QXO deal-value source runner is pinned to the governed staging source', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /bld-20260418xex99d1\.htm/);
  assert.match(source, /retrieval_url_sha256: '0444cefff473dca7b294d16b04f83db66574ae2f164829919f2cb4d34a5f3442'/);
  assert.match(source, /response_bytes_sha256: '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827'/);
  assert.match(source, /response_byte_length: 151092/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
});

test('QXO deal-value source writes only through the bounded canonical writer', () => {
  assert.match(source, /MAX_WRITER_REQUEST_BYTES = 512 \* 1024/);
  assert.match(source, /SET LOCAL statement_timeout='60000ms'/);
  assert.match(source, /SELECT public\.canonical_v2_write/);
  assert.match(source, /runSql\(writerSql\(built\.intake\)\);[\s\S]*runSql\(writerSql\(built\.intake\), \{ commit: true \}\)/);
  assert.match(source, /runSql\(writerSql\(chunk\)\);[\s\S]*runSql\(writerSql\(chunk\), \{ commit: true \}\)/);
  assert.match(source, /runSql\(writerSql\(built\.admission\)\);[\s\S]*runSql\(writerSql\(built\.admission\), \{ commit: true \}\)/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i);
});

test('QXO deal-value source attestation excludes source bytes, URL and credentials', () => {
  const body = source.slice(source.indexOf('function attestation'), source.indexOf('const invocation'));
  assert.doesNotMatch(body, /response_bytes_base64|retrieval_url[^_]|retrieved_at|password|service_role/i);
  assert.match(body, /document_hash/);
  assert.match(body, /canonical_text_sha256/);
  assert.match(body, /source_admission_manifest_id/);
  assert.match(body, /maximum_writer_request_byte_length/);
  assert.match(source, /redacted-database-url/);
});

test('QXO deal-value source runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
