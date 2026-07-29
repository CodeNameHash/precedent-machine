const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const PAGE = fs.readFileSync('pages/review/[id].js', 'utf8');
const CANONICAL = fs.readFileSync('components/review-v2/CanonicalReviewSection.jsx', 'utf8');
const COMPARE = fs.readFileSync('components/review-v2/CompareColumn.jsx', 'utf8');
const TABLE = fs.readFileSync('components/review/ProvisionTable.jsx', 'utf8');
const GROUPED = fs.readFileSync('components/review/primitives/ProvisionTablePrimitives.jsx', 'utf8');
const REPS = fs.readFileSync('components/review/table-configs/representations-qualifiers.config.js', 'utf8');

test('canonical Review mode disables every legacy market request path', () => {
  assert.equal((PAGE.match(/&& !CANONICAL_REVIEW_ENABLED/g) || []).length, 5);
  assert.match(PAGE, /const typedMarketEnabled = marketMode[\s\S]*&& !CANONICAL_REVIEW_ENABLED/);
  assert.match(PAGE, /const legacyMarketEnabled = marketMode[\s\S]*&& !CANONICAL_REVIEW_ENABLED/);
  assert.doesNotMatch(PAGE, /useDealToMarket|\/api\/query\/run/);
  assert.match(PAGE, /rows:\s*marketOffMarketRows/);
  assert.match(PAGE, /standalone=\{false\}/);
  assert.match(PAGE, /autoLoadAll/);
  assert.match(PAGE, /reloadKey=\{canonicalReloadKey\}/);
  assert.match(PAGE, /onContextStateChange=\{setCanonicalReviewState\}/);
  assert.match(CANONICAL, /state\.envelope\?\.next_cursor[\s\S]*loadMore\(\)/);
});

test('normal Review and Compare rows receive exact canonical binding interactions', () => {
  assert.match(PAGE, /bindPreparedRowsToReviewRows/);
  assert.match(PAGE, /findPreparedReviewBinding/);
  assert.match(PAGE, /canonicalReviewIdentity\(section\.id, row, groupId\)/);
  assert.match(
    PAGE,
    /<UnifiedCompareSection[\s\S]*canonicalMarket=\{canonicalMarket\}[\s\S]*canonicalBindingForRow=\{canonicalBindingForRow\}/,
  );
  assert.match(TABLE, /data-canonical-review-binding/);
  assert.match(TABLE, /ctx\.canonicalBindingForRow = canonicalBindingForRow/);
  assert.match(TABLE, /ctx\.onSelectCanonicalBinding = onSelectCanonicalBinding/);
  assert.match(GROUPED, /canonicalBindingForRow\(row, group\.id \|\| null\)/);
  assert.match(REPS, /ctx\.onSelectCanonicalBinding\(canonicalBinding, row\.label\)/);
  assert.match(COMPARE, /const primaryGroupId = primaryGroupReviewId\(ge\)/);
  assert.match(COMPARE, /canonicalBindingForRow\(primaryRow, primaryGroupId\)/);
  assert.match(COMPARE, /primaryClickProps\(d, row, primaryGroupId\)/);
  assert.match(COMPARE, /View corpus context/);
});

test('canonical market output is explicit when a Review row has no governed comparable', () => {
  assert.match(COMPARE, /Not yet canonical market comparable\./);
  assert.match(COMPARE, /data-canonical-market-unmapped/);
  assert.doesNotMatch(COMPARE, /No canonical market data/);
  assert.match(CANONICAL, /combineCanonicalSidebarContexts/);
  assert.match(CANONICAL, /function CanonicalReviewRemainder/);
  assert.match(CANONICAL, /item\.render_kind !== 'ROW' \|\| !boundRowKeys\.has/);
  assert.match(PAGE, /<CanonicalReviewRemainder/);
  assert.match(COMPARE, /<CanonicalRetry retry=\{canonicalMarket\.retry\}/);
});
