const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'scripts/canonical-v2-staging-writer-structure-identity.mjs',
  'utf8',
);

test('structural identity acceptance is staging-only, bounded and rollback-bound', () => {
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /buildQxoReviewedCapitalisationSlice/);
  assert.match(source, /buildProvisionComponent/);
  assert.match(source, /buildCanonicalWriteInputDigest/);
  assert.match(source, /WHEN SQLSTATE '23514'/);
  assert.match(source, /observed_sqlstate IS DISTINCT FROM '23514'/);
  assert.match(source, /first_result->>'replayed' IS DISTINCT FROM 'false'/);
  assert.match(source, /replay_result->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /provision_mismatch_count/);
  assert.match(source, /component_mismatch_count/);
  assert.match(source, /forged provision identity/);
  assert.match(source, /forged provision anchor/);
  assert.match(source, /re-signed wrong source occurrence/);
  assert.match(source, /whitespace-only provision concept/);
  assert.match(source, /provision splitting a UTF-8 code point/);
  assert.match(source, /forged component identity/);
  assert.match(source, /forged component anchor/);
  assert.match(source, /re-signed component outside parent/);
  assert.match(source, /re-signed component on unadmitted text/);
  assert.match(source, /whitespace-only component key/);
  assert.match(source, /component splitting a UTF-8 code point/);
  assert.match(source, /persisted parent with zero-length continuation-offset component/);
  assert.match(source, /malformed persisted provision was accepted/);
  assert.match(source, /INSERT INTO canonical_v2_staging\.provision_instances/);
  assert.doesNotMatch(source, /commit:\s*true/);
  assert.doesNotMatch(source, /\bCOMMIT;/);
  assert.doesNotMatch(source, /tzulhdasmioeechxapdy/);
});
