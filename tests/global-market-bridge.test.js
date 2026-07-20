const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const BRIDGE = fs.readFileSync('components/review-v2/GlobalMarketBridge.jsx', 'utf8');
const SIDEBAR = fs.readFileSync('components/review-v2/MarketDrilldownSidebar.jsx', 'utf8');
const MARKET_COLUMN = fs.readFileSync('components/review-v2/MarketColumn.jsx', 'utf8');
const COMPARE_COLUMN = fs.readFileSync('components/review-v2/CompareColumn.jsx', 'utf8');
const REVIEW_PAGE = fs.readFileSync('pages/review/[id].js', 'utf8');

test('market drilldown remains exempt from the bridge aside hider before and after selection', () => {
  assert.equal((SIDEBAR.match(/data-testid="market-drilldown-sidebar"/g) || []).length, 2);
});

test('typed market cells resolve their exact row key before the legacy text fallback', () => {
  const exact = BRIDGE.indexOf('exactMarketContextForRowKey(contexts, rowKey)');
  const fallback = BRIDGE.indexOf('contexts.find((context) => contextMatchesCell(context, text))');
  assert.ok(exact >= 0);
  assert.ok(fallback > exact);
});

test('market cells render substantive term detail before fallback and prevalence', () => {
  const substantive = MARKET_COLUMN.indexOf('{availableSubstantive.map((spec) => (');
  const fallback = MARKET_COLUMN.indexOf('{!availableSubstantive.length && fallbackSummary ?');
  const prevalence = MARKET_COLUMN.indexOf('{availablePrevalence.map((spec) => (');
  assert.ok(substantive >= 0);
  assert.ok(fallback > substantive);
  assert.ok(prevalence > fallback);
  assert.match(COMPARE_COLUMN, /fallbackSummary=\{marketSummaryForRow\(row, marketColumn\)\}/);
});

test('market detail sidebar can hide, restore, and reopen for a newly selected row', () => {
  assert.match(BRIDGE, /const \[sidebarHidden, setSidebarHidden\] = useState\(false\)/);
  assert.match(BRIDGE, /onClose=\{\(\) => setSidebarHidden\(true\)\}/);
  assert.match(BRIDGE, /data-testid="market-sidebar-show"/);
  assert.match(BRIDGE, /onClick=\{\(\) => setSidebarHidden\(false\)\}/);
  const selectContext = BRIDGE.indexOf('setMarketContext(sanitizeContext(match, label))');
  const reopen = BRIDGE.indexOf('setSidebarHidden(false)', selectContext);
  assert.ok(selectContext >= 0);
  assert.ok(reopen > selectContext);
});

test('market review tables remain capped and fixed-width instead of expanding to content', () => {
  assert.match(REVIEW_PAGE, /wideLayout \? 'space-y-10 max-w-5xl'/);
  assert.match(COMPARE_COLUMN, /<table className="w-full table-fixed text-xs font-ui">/);
});
