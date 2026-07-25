const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-writer-object-identity.mjs',
  'utf8',
);

test('object identity acceptance is staging-only, rollback-bound and comprehensive', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /buildSecEdgarIntakeCapture/);
  assert.match(source, /buildSourceArtifactChunks/);
  assert.match(source, /buildCanonicalWriteInputDigest/);
  assert.match(source, /CANONICAL_WRITE_RECEIPT\/V1/);
  assert.match(source, /WHEN SQLSTATE '23514'/);
  assert.match(source, /observed_sqlstate IS DISTINCT FROM '23514'/);
  assert.match(source, /forged response content identity/);
  assert.match(source, /forged intake receipt identity/);
  assert.match(source, /forged artifact manifest identity/);
  assert.match(source, /forged artifact chunk identity/);
  assert.match(source, /intake_mismatch_count/);
  assert.match(source, /manifest_mismatch_count/);
  assert.match(source, /chunk_mismatch_count/);
  assert.match(source, /first_result->>'replayed' IS DISTINCT FROM 'false'/);
  assert.match(source, /replay_result->>'replayed' IS DISTINCT FROM 'true'/);
  assert.doesNotMatch(source, /commit:\s*true/);
  assert.doesNotMatch(source, /\bCOMMIT;/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
});
