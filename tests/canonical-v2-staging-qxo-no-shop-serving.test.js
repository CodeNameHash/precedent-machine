const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-serving.mjs';

test('QXO no-shop serving verifier is read-only, release-pinned and bounded', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /BEGIN TRANSACTION READ ONLY/);
  assert.match(source, /statement_timeout='10000ms'/);
  assert.match(source, /MAX_RESULT_BYTES = 256 \* 1024/);
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

test('QXO no-shop action serving verifier pins all four terms and their exact evidence', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--actions-verify/);
  assert.match(source, /91cdee1d2cca11fdaa7141069c3daf9d048deabdbe36573bb214cafc7cf34430/);
  assert.match(source, /NO_SHOP_PROHIBITED_ACTION/);
  assert.match(source, /SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE/);
  assert.match(source, /ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS/);
  assert.match(source, /ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT/);
  assert.match(source, /APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION/);
  assert.match(source, /typed_exception_rows/);
  assert.match(source, /before stockholder approval/);
  assert.match(source, /fiduciary duties/);
  assert.match(source, /exactTexts\.some/);
});

test('QXO no-shop action serving verifier proves one bounded set-based market read', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /p_page_size => \$\{ACTION_MODE \? 4 : REMATCH_MODE \? 1 : 2\}/);
  assert.match(source, /inventory\.counts\.observation_slots !== ACTION_SPECS\.length/);
  assert.match(source, /rpc_calls: 8/);
  assert.match(source, /candidate_remains_inactive: true/);
});

test('QXO no-shop rematch serving verifier preserves the four-business-day amendment trigger', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--rematch-verify/);
  assert.match(source, /d9157984ee4948046c3cf7d3195cb0136502cdf739fc24dfd05d0ae7c60f1f5a/);
  assert.match(source, /NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS/);
  assert.match(source, /DAYS:BUSINESS:MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL/);
  assert.match(source, /a new four \(4\) business day notice period/);
  assert.match(source, /subsequent_match_business_days/);
  assert.match(source, /rpc_calls: 5/);
});
