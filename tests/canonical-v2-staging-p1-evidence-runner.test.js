const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-p1-evidence.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('P1 evidence runner is isolated, read-only and executes one bounded query RPC', () => {
  assert.match(source, /sjumbznveyyiizhwvixj/);
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout='5000ms'/);
  assert.match(source, /canonical_v2_query_page/);
  assert.match(source, /calls !== 1/);
  assert.match(source, /first\.cache/);
  assert.match(source, /second\.cache/);
  assert.doesNotMatch(source, /\b(?:INSERT\s+INTO|UPDATE\s+canonical_v2|DELETE\s+FROM|TRUNCATE\s+TABLE|canonical_v2_write)\b/i);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy|beddepjkshmgenhsrnno/);
});

test('P1 evidence runner binds the exact executable fixture and content-addressed attestation', () => {
  assert.match(source, /spawnSync\(process\.execPath, \['--test', TEST_FILE\]/);
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /buildVerticalSliceAttestation/);
  assert.match(source, /differs from the immutable reviewed evidence/);
  assert.match(source, /state changed or the market read exceeded one RPC/);
});

test('P1 evidence runner rejects ambiguous invocation before database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
