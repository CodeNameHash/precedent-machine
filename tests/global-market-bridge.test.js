const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const BRIDGE = fs.readFileSync('components/review-v2/GlobalMarketBridge.jsx', 'utf8');
const SIDEBAR = fs.readFileSync('components/review-v2/MarketDrilldownSidebar.jsx', 'utf8');

test('market drilldown remains exempt from the bridge aside hider before and after selection', () => {
  assert.equal((SIDEBAR.match(/data-testid="market-drilldown-sidebar"/g) || []).length, 2);
});

test('typed market cells resolve their exact row key before the legacy text fallback', () => {
  const exact = BRIDGE.indexOf('exactMarketContextForRowKey(contexts, rowKey)');
  const fallback = BRIDGE.indexOf('contexts.find((context) => contextMatchesCell(context, text))');
  assert.ok(exact >= 0);
  assert.ok(fallback > exact);
});
