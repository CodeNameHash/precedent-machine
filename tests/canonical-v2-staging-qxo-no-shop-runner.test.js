const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop.mjs';
const REVIEWED = 'lib/canonical-v2/reviewed-qxo-admitted-no-shop-slice.js';
const ACTIONS = 'lib/canonical-v2/reviewed-qxo-admitted-no-shop-actions-slice.js';
const REMATCH = 'lib/canonical-v2/reviewed-qxo-admitted-no-shop-rematch-slice.js';

test('QXO no-shop runner is staging-only, rollback-first and writer-only', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /DEAL_SCOPE_RUN/);
  assert.match(source, /canonical_v2_write/);
  assert.match(source, /Rollback-first QXO no-shop semantic run changed staging state/);
  assert.doesNotMatch(source, /production/i);
  assert.doesNotMatch(source, /UPDATE canonical_v2_staging|DELETE FROM canonical_v2_staging/);
});

test('QXO no-shop runner pins source, review and closure identities without printing source text', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /expectedDealAdmissionId/);
  assert.match(source, /expectedSourceAdmissionId/);
  assert.match(source, /expectedReviewedMappingId/);
  assert.match(source, /expectedClosureId/);
  assert.match(source, /633cf0ff19c762125f51df2d2b36da182a61d23ea7193ef8e2898134dc980f1b/);
  assert.match(source, /89683e5ff72a570948bfadda123254719d848310b5c50ad3720645e2cbd6291b/);
  assert.match(source, /c5e168edd134b80f9310fd831e86d950a43e1329dc2903c869e51ec0f4d42322/);
  assert.match(source, /dd232aa8077fd0d4158cd19c7fa5e8b439fceb8d97b578682c41936889808af8/);
  assert.match(source, /writer_request_byte_length/);
  assert.doesNotMatch(source, /exact_text|raw_value|canonical_text\.text/);
});

test('reviewed QXO subsequent match restarts four business days for changed proposal terms', () => {
  const source = fs.readFileSync(REMATCH, 'utf8');
  assert.match(source, /each and every change to any of the financial terms/);
  assert.match(source, /any other material terms of such Company Superior Proposal/);
  assert.match(source, /a new four \(4\) business day notice period/);
  assert.match(source, /rawMagnitude: '4'/);
  assert.match(source, /dayBasis: 'BUSINESS'/);
  assert.match(source, /MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL/);
  assert.match(source, /NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS/);
});

test('reviewed QXO prohibited actions retain terms and governed exceptions without inventing change recommendation', () => {
  const source = fs.readFileSync(ACTIONS, 'utf8');
  assert.match(source, /SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE/);
  assert.match(source, /ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS/);
  assert.match(source, /ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT/);
  assert.match(source, /APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION/);
  assert.doesNotMatch(source, /CHANGE_RECOMMENDATION/);
  assert.match(source, /PERMITS_LIMITED_INFORMATION_SHARING/);
  assert.match(source, /PERMITS_DISCUSSIONS_OR_NEGOTIATIONS/);
  assert.match(source, /BEFORE_STOCKHOLDER_APPROVAL/);
  assert.match(source, /FIDUCIARY_DUTIES_REQUIRE_ACTION/);
});

test('reviewed QXO no-shop slice uses admitted intervals and distinct day bases', () => {
  const source = fs.readFileSync(REVIEWED, 'utf8');
  assert.match(source, /ADMITTED_SEMANTIC_SOURCE_CONTEXT\/V1/);
  assert.match(source, /SECTION_4_3_SHA256/);
  assert.match(source, /NOTICE_SHA256/);
  assert.match(source, /MATCH_SHA256/);
  assert.match(source, /rawUnit: 'HOURS'/);
  assert.match(source, /dayBasis: 'ELAPSED'/);
  assert.match(source, /rawUnit: 'DAYS'/);
  assert.match(source, /dayBasis: 'BUSINESS'/);
  assert.match(source, /clauseExcerpt, 'OPERATIVE_TEXT'/);
  assert.match(source, /clockExcerpt, 'DERIVATION_INPUT'/);
  assert.doesNotMatch(source, /buildFixtureSourceAdmission|REVIEWED_MERGER_AGREEMENT_EXCERPT/);
});
