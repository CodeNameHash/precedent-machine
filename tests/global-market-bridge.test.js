const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const BRIDGE = fs.readFileSync('components/review-v2/GlobalMarketBridge.jsx', 'utf8');
const SIDEBAR = fs.readFileSync('components/review-v2/MarketDrilldownSidebar.jsx', 'utf8');
const MARKET_COLUMN = fs.readFileSync('components/review-v2/MarketColumn.jsx', 'utf8');
const COMPARE_COLUMN = fs.readFileSync('components/review-v2/CompareColumn.jsx', 'utf8');
const REVIEW_PAGE = fs.readFileSync('pages/review/[id].js', 'utf8');
const COMPARE_DATA = fs.readFileSync('components/review-v2/compareData.js', 'utf8');
const CANONICAL_REVIEW = fs.readFileSync('components/review-v2/CanonicalReviewSection.jsx', 'utf8');

test('market drilldown renders both its empty and selected states as the right review column', () => {
  assert.equal((SIDEBAR.match(/data-testid="market-drilldown-sidebar"/g) || []).length, 2);
  assert.match(SIDEBAR, /const SIDEBAR_CLASS = 'hidden lg:block w-56 xl:w-\[280px\]/);
  assert.equal((SIDEBAR.match(/aria-label="Close market detail"/g) || []).length, 2);
});

test('supporting-deal links deep-link to the exact attributed provision card', () => {
  assert.match(SIDEBAR, /const cardId = deal\.cardId \|\| deal\.card_id/);
  assert.match(SIDEBAR, /\?card=\$\{encodeURIComponent\(cardId\)\}/);
});

test('exact-card deep links follow deal and card route changes without retaining stale overlays', () => {
  assert.match(REVIEW_PAGE, /const openedRouteCardRef = useRef\(null\)/);
  assert.doesNotMatch(REVIEW_PAGE, /openedFromQueryRef/);
  assert.match(REVIEW_PAGE, /openedRouteCardRef\.current = null;[\s\S]*setOverlayCard\(null\);[\s\S]*setSelection\(\{ card: null, rowFocus: null \}\);[\s\S]*\}, \[dealId\]\)/);
  assert.match(REVIEW_PAGE, /const routeCardKey = dealId && cardParam \? `\$\{dealId\}:\$\{String\(cardParam\)\}` : null/);
  assert.match(REVIEW_PAGE, /String\(reviewDealId\) !== String\(dealId\)/);
  assert.match(REVIEW_PAGE, /openedRouteCardRef\.current === routeCardKey/);
  assert.match(REVIEW_PAGE, /openedRouteCardRef\.current = routeCardKey;[\s\S]*openSourceOverlay\(match\)/);
});

test('typed market cells resolve their attached exact context before the legacy text fallback', () => {
  assert.match(MARKET_COLUMN, /attachTypedRowMarketContext\(node, resolution, data, fallbackSummary\)/);
  const exact = BRIDGE.indexOf('exactMarketContextForCell(currentCell, contexts, rowKey)');
  const fallback = BRIDGE.indexOf('contexts.find((context) => contextMatchesCell(context, text))');
  assert.ok(exact >= 0);
  assert.ok(fallback > exact);
});

test('production canonical rows use the standard typed cell and select the real right sidebar', () => {
  assert.match(CANONICAL_REVIEW, /<MarketMetricCell resolution=\{adapted\.resolution\} data=\{adapted\.data\}/);
  assert.match(CANONICAL_REVIEW, /data-canonical-row-key=\{adapted\.row_key\}/);
  assert.match(CANONICAL_REVIEW, /canonicalSidebarContext\(adapted\)/);
  assert.match(CANONICAL_REVIEW, /REVIEWED_SOURCE_SPECIFIC/);
  assert.match(REVIEW_PAGE, /setCanonicalSelection\(null\);[\s\S]*setSelection\(\(cur\)/);
  assert.match(REVIEW_PAGE, /setSelection\(\{ card: null, rowFocus: null \}\);[\s\S]*setCanonicalSelection\(\{ context, rowKey \}\)/);
  assert.match(REVIEW_PAGE, /canonicalSelection \? \([\s\S]*<MarketDrilldownSidebar context=\{canonicalSelection\.context\}/);
  assert.match(BRIDGE, /mtx:canonical-market-context-selected/);
  assert.match(BRIDGE, /!primarySummary && !currentDealTerms\.length/);
  assert.match(CANONICAL_REVIEW, /data-canonical-context-select/);
  assert.doesNotMatch(CANONICAL_REVIEW, /role: 'button'/);
  assert.doesNotMatch(CANONICAL_REVIEW, /tabIndex: 0/);
});

test('legacy market selection clears stale canonical highlighting without treating canonical cells as legacy', () => {
  assert.match(BRIDGE, /!td\.closest\('\[data-canonical-row-key\]'\)/);
  assert.match(BRIDGE, /mtx:legacy-market-context-selected/);
  assert.match(REVIEW_PAGE, /addEventListener\('mtx:legacy-market-context-selected', clearCanonicalSelection\)/);
  assert.match(REVIEW_PAGE, /const clearCanonicalSelection = \(\) => setCanonicalSelection\(null\)/);
});

test('market cells render substantive term detail before fallback and prevalence', () => {
  const substantive = MARKET_COLUMN.indexOf('{availableSubstantive.map((spec) => (');
  const fallback = MARKET_COLUMN.indexOf('{!availableSubstantive.length && fallbackSummary ?');
  const prevalence = MARKET_COLUMN.indexOf('{availablePrevalence.map((spec) => (');
  assert.ok(substantive >= 0);
  assert.ok(fallback > substantive);
  assert.ok(prevalence > fallback);
  assert.match(COMPARE_COLUMN, /fallbackSummary=\{marketSummaryForRow\(row, marketColumn\)\}/);
  assert.match(MARKET_COLUMN, /data\?\.loading && !responseRow && !fallbackSummary/);
  assert.match(MARKET_COLUMN, /data\?\.error && !responseRow && !fallbackSummary/);
  assert.match(MARKET_COLUMN, /!availableSubstantive\.length && !availablePrevalence\.length && !fallbackSummary/);
  assert.match(MARKET_COLUMN, /<SubjectLegalTerms result=\{result\}/);
  assert.match(SIDEBAR, /<CurrentDealTerms terms=\{context\.currentDealTerms\}/);
  assert.match(SIDEBAR, /data-testid="market-current-deal-terms"/);
});

test('money market cells present deal-relative percentages without raw dollar summaries', () => {
  assert.match(MARKET_COLUMN, /formatPercent\(subject\.percentOfDealValue\).*of \$\{formatBasis/);
  assert.match(MARKET_COLUMN, /No same-basis percentage cohort yet/);
  assert.doesNotMatch(MARKET_COLUMN, /Raw median|formatMoney\(subject\.rawUsd\)|formatMoney\(raw/);
  assert.doesNotMatch(SIDEBAR, /Raw median|formatMoney\(summary\.raw|formatMoney\(raw/);
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
  assert.match(BRIDGE, /setMarketContext\(null\);[\s\S]*setSidebarHidden\(false\);[\s\S]*\[marketMode, router\.asPath\]/);
  assert.match(BRIDGE, /MarketSidebarBoundary[\s\S]*onClose=\{\(\) => setSidebarHidden\(true\)\}/);
  assert.match(BRIDGE, /mtx:row-market-context-updated/);
  assert.match(BRIDGE, /current\.marketRowKey !== rowKey/);
});

test('failed market batches remain explicit and retryable at row level', () => {
  assert.match(COMPARE_DATA, /failedRowKeys/);
  assert.match(COMPARE_DATA, /item\.status === 'rejected'[\s\S]*requests\[index\]/);
  assert.match(MARKET_COLUMN, /data\?\.failedRowKeys/);
  assert.match(MARKET_COLUMN, /Detailed market terms could not be loaded/);
  assert.match(MARKET_COLUMN, /<ErrorNote onRetry=\{onRetry\}>/);
});

test('market page bounds typed request pressure and stages lower-priority corpus reads', () => {
  assert.match(COMPARE_DATA, /const MARKET_BATCH_METRIC_LIMIT = 300/);
  assert.match(COMPARE_DATA, /const MARKET_BATCH_CONCURRENCY = 1/);
  assert.match(COMPARE_DATA, /const MARKET_BATCH_RETRIES = 0/);
  const typed = REVIEW_PAGE.indexOf('useRowMarketStats(');
  const legacy = REVIEW_PAGE.indexOf('useSectionMarketStats(legacyMarketEnabled');
  const scorecard = REVIEW_PAGE.indexOf('useDealToMarket(');
  assert.ok(typed >= 0);
  assert.ok(legacy > typed);
  assert.ok(scorecard > legacy);
  assert.match(REVIEW_PAGE, /rowMarketStats\.attempted && !rowMarketStats\.loading/);
  assert.match(REVIEW_PAGE, /sectionMarketStats\.attempted && !sectionMarketStats\.loading/);
});

test('legacy corpus fallback never fans a backend 5xx into per-code requests', () => {
  const match = COMPARE_DATA.match(/export function shouldFallbackToPerCode\(error\) \{([\s\S]*?)\n\}/);
  assert.ok(match);
  // eslint-disable-next-line no-new-func
  const shouldFallback = new Function('error', match[1]);
  assert.equal(shouldFallback({ status: 404 }), true);
  assert.equal(shouldFallback({ status: 405 }), true);
  assert.equal(shouldFallback({ status: 501 }), true);
  assert.equal(shouldFallback({ status: 500 }), false);
  assert.equal(shouldFallback({ status: 503 }), false);
  assert.equal(shouldFallback(new Error('network failure')), false);
  assert.match(COMPARE_DATA, /Math\.min\(2, codes\.length\)/);
});

test('market drilldown CTA is kept as the final, quiet element in its cell after React rerenders', () => {
  assert.match(BRIDGE, /cta\.style\.fontSize = '8\.5px'/);
  assert.match(BRIDGE, /cta\.style\.borderTop = '1px solid #EDEDEC'/);
  const moveToBottom = BRIDGE.indexOf('if (cell.lastElementChild !== cta) cell.appendChild(cta)');
  const existingHandlerExit = BRIDGE.indexOf('if (handlers.has(td)) return', moveToBottom);
  assert.ok(moveToBottom >= 0);
  assert.ok(existingHandlerExit > moveToBottom, 'existing cells must be reordered before the handler fast-path exits');
  assert.match(BRIDGE, /cta\.className = 'hidden lg:block'/);
  assert.match(BRIDGE, /if \(window\.innerWidth < 1024\) return/);
  assert.match(BRIDGE, /const currentCell = td\.querySelector\('\[data-testid="market-cell"\]'\)/);
});

test('market mode uses a natural three-column review layout without hiding the provision nav', () => {
  assert.match(REVIEW_PAGE, /<ProvisionNav[^>]+marketMode=\{marketMode\}/);
  assert.match(REVIEW_PAGE, /data-global-market-sidebar-host/);
  assert.match(BRIDGE, /const \[sidebarHost, setSidebarHost\] = useState\(null\)/);
  assert.match(BRIDGE, /sidebarHost,\s*\) : null/);
  assert.doesNotMatch(BRIDGE, /querySelectorAll\('aside'\)/);
  assert.doesNotMatch(BRIDGE, /position: 'fixed'/);
});

test('market review content stays centred and side columns use matching responsive widths', () => {
  assert.match(REVIEW_PAGE, /wideLayout \? 'space-y-10 max-w-5xl w-full mx-auto'/);
  const NAV = fs.readFileSync('components/review-v2/ProvisionNav.jsx', 'utf8');
  assert.match(NAV, /marketMode \? 'w-56 xl:w-\[280px\]'/);
  assert.match(SIDEBAR, /w-56 xl:w-\[280px\]/);
  assert.match(COMPARE_COLUMN, /<table className="w-full table-fixed text-xs font-ui">/);
  assert.match(REVIEW_PAGE, /removeProperty\('--mtx-head-h'\)/);
});

test('market launcher delegates payload encoding to the UTF-8-safe helper', () => {
  assert.match(BRIDGE, /import \{ encodeMarketPayload \} from '\.\/marketPayload'/);
  assert.match(BRIDGE, /payload=\$\{encodeMarketPayload\(payload\)\}/);
  assert.doesNotMatch(BRIDGE, /btoa\(JSON\.stringify/);
});
