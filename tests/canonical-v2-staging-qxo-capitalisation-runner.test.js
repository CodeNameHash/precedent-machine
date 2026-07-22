const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-qxo-capitalisation.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('QXO capitalisation runner is staging-only, rollback-first and writer-only', () => {
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /BEGIN\$\{readOnly \? ' TRANSACTION READ ONLY'/);
  assert.match(source, /statement_timeout='60000ms'/);
  assert.match(source, /public\.canonical_v2_write/);
  assert.match(source, /DEAL_SCOPE_RUN/);
  assert.match(source, /MAX_WRITER_REQUEST_BYTES = 512 \* 1024/);
  assert.match(source, /runSql\(writerSql\(write\)\)/);
  assert.match(source, /runSql\(writerSql\(write\), \{ commit: true \}\)/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE)\b/i);
});

test('QXO capitalisation attestation exposes identities and counts, never source payloads', () => {
  const body = source.slice(source.indexOf('function attest'), source.indexOf('const mode'));
  assert.doesNotMatch(body, /response_bytes_base64|canonical_text[,}]|source_map_payload|password|service_role/i);
  assert.match(body, /reviewed_mapping_id/);
  assert.match(body, /semantic_closure_id/);
  assert.match(body, /result_input_count/);
  assert.match(body, /writer_request_byte_length/);
});

test('QXO capitalisation runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--dry-run', '--extra'], {
    cwd: process.cwd(), encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
