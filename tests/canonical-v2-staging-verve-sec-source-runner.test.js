const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const RUNNER = 'scripts/canonical-v2-staging-verve-sec-source.mjs';
const source = fs.readFileSync(RUNNER, 'utf8');

test('Verve SEC source runner is a thin immutable profile over the shared engine', () => {
  assert.match(source, /runStagingSecSource/);
  assert.match(source, /VERVE_AGREEMENT/);
  assert.match(source, /320a3899-0d74-42d6-a412-3a962997d6ca/);
  assert.match(source, /d30505dex21\.htm/);
  assert.match(source, /response_byte_length: 600876/);
  assert.match(source, /artifact_chunk_count: 11/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
  assert.doesNotMatch(source, /canonical_v2_write|canonical_v2_import|canonical_v2_activate/);
});

test('Verve runner refuses ambiguous invocation before any database work', () => {
  const result = spawnSync(process.execPath, [RUNNER, '--verify', '--extra'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage:/);
  assert.equal(result.stdout, '');
});
