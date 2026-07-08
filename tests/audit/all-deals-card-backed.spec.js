const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertReviewPageBranch,
  auditDeals,
  markdownReport,
  parseArgs,
  thresholdFromPlan,
  thresholdFromReviewPage,
  verdictFor,
} = require('../../scripts/audit/all-deals-card-backed');

const DEALS = [
  { id: 'deal-1', acquirer: 'Buyer', target: 'Alpha Target' },
  { id: 'deal-2', acquirer: 'Buyer', target: 'Beta Target' },
];

test('audit passes when every deal meets the card-backed threshold', () => {
  const rows = auditDeals(DEALS, new Map([
    ['deal-1', 41],
    ['deal-2', 40],
  ]), 40);

  assert.equal(verdictFor(rows), 'PASS');
  assert.deepEqual(rows.map((row) => row.entered_legacy_branch), [false, false]);
});

test('audit fails when any deal would enter legacy fallback by default', () => {
  const rows = auditDeals(DEALS, new Map([
    ['deal-1', 39],
    ['deal-2', 40],
  ]), 40);

  assert.equal(verdictFor(rows), 'FAIL');
  assert.equal(rows[0].threshold_met, false);
  assert.equal(rows[0].entered_legacy_branch, true);
  assert.match(markdownReport(rows, { generatedAt: '2026-07-08T00:00:00.000Z', threshold: 40 }), /under threshold \(39\/40 cards\)/);
});

test('threshold parsers read the M2 plan and review page constants', () => {
  assert.equal(thresholdFromPlan('Every deal has provision_cards.count(deal_id) >= 40.'), 40);
  assert.equal(thresholdFromPlan('Every deal has `provision_cards.count(deal_id) ≥ 40`.'), 40);
  assert.equal(thresholdFromReviewPage('const SCHEMA_RENDER_MIN_CARDS = 40;'), 40);
});

test('review page branch assertion recognises schema-only render path', () => {
  assert.doesNotThrow(() => assertReviewPageBranch(`
    <ProvisionCardTable reviewDeal={schemaReviewDeal || { sections: [] }} />
  `));
});

test('review page branch assertion rejects retired legacy render switches', () => {
  assert.throws(() => assertReviewPageBranch(`
    const useSchemaRender = forcedRenderMode === 'legacy' ? false : schemaCardCount >= SCHEMA_RENDER_MIN_CARDS;
    <ProvisionCardTable reviewDeal={schemaReviewDeal || { sections: [] }} />
  `), /legacy render-switch/);
});

test('parseArgs accepts env, report, and no-write flags', () => {
  assert.deepEqual(parseArgs([
    '--env-file', '.env.local',
    '--report', 'tmp/card-backed.md',
    '--no-write',
  ]), {
    envFile: '.env.local',
    reportPath: 'tmp/card-backed.md',
    write: false,
  });
});
