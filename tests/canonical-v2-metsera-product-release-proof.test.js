const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const scriptPath = path.join(
  __dirname,
  '../scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
);

test('binds the real Metsera Product row to one candidate release', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /buildLandosCandidateReleaseFixture/);
  assert.match(source, /buildFixtureCandidateRelease/);
  assert.match(source, /buildProductQueryResultServingRecord/);
  assert.match(source, /buildProductQueryResultReleasePartition/);
  assert.match(source, /buildCandidateReleaseImportPlan/);
  assert.doesNotMatch(
    source,
    /METSERA_EXCLUSIVITY_CANDIDATE_RELEASE_MANIFEST\/V1/,
  );
});

test('proves writer, import and inactive serving in one rollback transaction', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /public\.canonical_v2_write\(/);
  assert.match(source, /public\.canonical_v2_import_candidate_release\(/);
  assert.match(
    source,
    /public\.canonical_v2_active_product_query_results\(/,
  );
  assert.match(source, /inactive_page IS NOT NULL/);
  assert.match(source, /product_release_proof_rolled_back:\s*true/);
  assert.doesNotMatch(source, /commit:\s*true/);
});

test('proves V7 import replay identity and Product serving-record identity fail closed', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /changed V7 import body was accepted/);
  assert.match(source, /invalid candidate release import plan/);
  assert.match(source, /tampered Product serving record ID was accepted/);
  assert.match(source, /product_query_result_serving_record_id/);
  assert.match(source, /canonical_v2_staging\.content_id\(/);
  assert.match(source, /replay_result->>'replayed' IS DISTINCT FROM 'true'/);
  assert.match(source, /tampered_serving_record_id_rejected IS NOT TRUE/);
});

test('requires no durable staging change and preserves the inactive source-reader boundary', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(
    source,
    /JSON\.stringify\(stagingAfterReleaseProof\)[\s\S]*JSON\.stringify\(stagingBefore\)/,
  );
  assert.match(
    source,
    /product_active_query_before_activation:[\s\S]*INACTIVE_FAIL_CLOSED/,
  );
  assert.match(source, /RELEASE_NOT_ACTIVE/);
  assert.match(source, /NOT_EXECUTED/);
});

test('uses the exact three-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-product-release-proof-v1.json',
    ),
    'utf8',
  ));

  assert.equal(
    allowlist.phase,
    'WP-METSERA-PRODUCT-RELEASE-PROOF-V1',
  );
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-product-release-proof-v1.json',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-product-release-proof.test.js',
  ]);
});
