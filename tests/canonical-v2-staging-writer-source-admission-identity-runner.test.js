const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-writer-source-admission-identity.mjs',
  'utf8',
);

test('source-admission identity acceptance is staging-only and rollback-bound', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /buildSecEdgarIntakeCapture/);
  assert.match(source, /convertSecHtmlToCanonicalText/);
  assert.match(source, /verifySecHtmlCanonicalText/);
  assert.match(source, /buildVerifiedSecSourceAdmission/);
  assert.match(source, /buildSourceArtifactChunks/);
  assert.match(source, /buildCanonicalWriteInputDigest/);
  assert.match(source, /WHEN SQLSTATE '23514'/);
  assert.match(source, /observed_sqlstate IS DISTINCT FROM '23514'/);
  assert.match(source, /first_result->>'replayed' IS DISTINCT FROM 'false'/);
  assert.match(source, /replay_result->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /conversion_mismatch_count/);
  assert.match(source, /verification_mismatch_count/);
  assert.match(source, /immutable_mismatch_count/);
  assert.match(source, /admission_mismatch_count/);
  assert.match(source, /preparation_mismatch_count/);
  assert.match(source, /semantic_mismatch_count/);
  assert.match(source, /canonical-text/);
  assert.match(source, /verification/);
  assert.match(source, /immutable-source/);
  assert.match(source, /coverage-proof/);
  assert.match(source, /admission-manifest/);
  assert.match(source, /preparation-slot/);
  assert.match(source, /preparation-receipt/);
  assert.match(source, /semantic-input/);
  assert.match(source, /bundle/);
  assert.doesNotMatch(source, /commit:\s*true/);
  assert.doesNotMatch(source, /\bCOMMIT;/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
});
