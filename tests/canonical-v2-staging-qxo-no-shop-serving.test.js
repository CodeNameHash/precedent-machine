const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-serving.mjs';

test('QXO no-shop serving verifier is read-only, release-pinned and bounded', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout='10000ms'/);
  assert.match(source, /MAX_RESULT_BYTES = 128 \* 1024/);
  assert.match(source, /fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE canonical_v2_staging|DELETE FROM/);
});

test('QXO no-shop serving verifier exercises both normalised clocks and exact detail', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /NO_SHOP_NOTICE_PERIOD_DAYS/);
  assert.match(source, /NO_SHOP_INITIAL_MATCH_PERIOD_DAYS/);
  assert.match(source, /DAYS:ELAPSED:RECEIPT_OF_COMPETING_PROPOSAL/);
  assert.match(source, /DAYS:BUSINESS:SUPERIOR_PROPOSAL_NOTICE/);
  assert.match(source, /canonical_v2_query_page/);
  assert.match(source, /canonical_v2_market_cohort/);
  assert.match(source, /canonical_v2_exact_detail/);
  assert.match(source, /adaptSharedServingRow/);
  assert.match(source, /response\?\.relationships\?\.length !== 0/);
  assert.match(source, /response\?\.excerpts\?\.length !== 2/);
});

test('QXO no-shop serving verifier proves the candidate remains inactive', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /EXPECTED_RELEASE\.generation/);
  assert.match(source, /candidate_remains_inactive: true/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(source, /canonical_v2_activate|activateCandidateRelease/);
});
