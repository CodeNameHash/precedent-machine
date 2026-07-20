const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const { calculateMarketStats } = require('../lib/row-market-stats/service');
const { collectSourceRequirements } = require('../lib/row-market-stats/source');
const { bringDownTreatmentCodes, recoverBringDownTiers } = require('../lib/bring-down-tiers');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

let conditionsMod;
let marketRowsMod;

test.before(async () => {
  conditionsMod = await import(path.join('..', 'components', 'review', 'table-configs', 'conditions.config.js'));
  marketRowsMod = await import(path.join('..', 'lib', 'market-metrics', 'section-rows.js'));
});

function qxoCard(overrides = {}) {
  return {
    id: 'c5b50bfe-source-card',
    deal_id: 'qxo',
    excerpt_id: 'qxo-section-5-2',
    provision_type: 'CLOSING_CONDITION',
    provision_subtype: 'COND-B-MAE',
    section_ref: 'Section 5.2',
    short_title: 'No Company Material Adverse Effect',
    primary_quote: QXO_5_2_TEXT,
    features: { continuingRequirement: false },
    ...overrides,
  };
}

test('QXO bundled Section 5.2 deterministically recovers its four Company rep bring-down tiers', () => {
  const tiers = recoverBringDownTiers(QXO_5_2_TEXT);
  assert.equal(tiers.length, 4);
  assert.deepEqual(tiers.map((tier) => tier.standard), [
    'MAT_ALL_RESPECTS',
    'MAT_ALL_RESPECTS_DE_MINIMIS',
    'MAT_ALL_MATERIAL',
    'MAT_MAE_QUALIFIED',
  ]);
  assert.deepEqual(bringDownTreatmentCodes(tiers[2]), ['MAT_ALL_MATERIAL', 'MAT_MATERIALITY_SCRAPE']);
  assert.deepEqual(bringDownTreatmentCodes(tiers[3]), ['MAT_MAE_QUALIFIED', 'MAT_MATERIALITY_SCRAPE']);
});

test('QXO review renders Company Accuracy from the bundled MAE source card with exact source and semantic market rows', () => {
  const sourceCard = qxoCard();
  const buyer = conditionsMod.conditionGroups({ cards: [sourceCard] }, {}).find((group) => group.id === 'buyer');
  const accuracy = buyer.rows.find((row) => row.id === 'conditions-b-Reps Bring-Down');
  assert.ok(accuracy);
  assert.equal(accuracy.card, sourceCard);
  assert.equal(accuracy.seeTextContent, QXO_5_2_TEXT);
  assert.deepEqual(accuracy.marketSubterms.map((metric) => metric.label), [
    'True in all respects',
    'True except for de minimis inaccuracies',
    'True in all material respects',
    'Materiality qualifiers disregarded',
    'True except where failure would not cause an MAE',
  ]);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, accuracy.children));
  assert.match(html, /True in all respects/);
  assert.match(html, /True except for de minimis inaccuracies/);
  assert.match(html, /True in all material respects/);
  assert.match(html, /True except where failure would not cause an MAE/);
  assert.match(html, /Materiality qualifiers disregarded/);
});

test('a stored scrape tier whose exception text carries the accuracy standard emits both treatments', () => {
  const card = qxoCard({
    id: 'parent-accuracy',
    provision_subtype: 'COND-S-REP',
    short_title: 'Accuracy of Parent Reps',
    primary_quote: 'The representations and warranties of Parent shall be true and correct (disregarding all materiality qualifications) in all material respects at Closing.',
    features: {
      bringDownTiers: [{
        standard: 'MAT_MATERIALITY_SCRAPE',
        reps_covered: 'All Parent representations',
        exceptions: 'True and correct (disregarding all qualifications as to materiality) in all material respects.',
      }],
    },
  });
  const seller = conditionsMod.conditionGroups({ cards: [card] }, {}).find((group) => group.id === 'seller');
  const accuracy = seller.rows.find((row) => row.id === 'conditions-s-Reps Bring-Down (Parent)');
  assert.ok(accuracy);
  assert.deepEqual(accuracy.marketSubterms.map((metric) => metric.label), [
    'True in all material respects',
    'Materiality qualifiers disregarded',
  ]);
});

test('row-market stats recover QXO treatments from the bundled card and retain its exact deep-link card id', () => {
  const reviewDeal = { cards: [qxoCard()] };
  const section = marketRowsMod.resolveMarketSectionRows(
    { id: 'conditions', title: 'Closing Conditions', config: { id: 'conditions' } },
    reviewDeal,
  );
  const accuracy = section.rows.find((row) => row.row.id === 'conditions-b-Reps Bring-Down');
  assert.ok(accuracy);
  const result = calculateMarketStats({
    contractVersion: 1,
    subjectDealId: 'qxo',
    filters: {},
    specs: accuracy.metrics,
  }, {
    deals: [{ id: 'qxo', acquirer: 'QXO', target: 'Beacon', announce_date: '2025-02-10', metadata: {} }],
    cards: [qxoCard()],
    claims: [],
  });

  const metrics = result.byRow[accuracy.rowKey].metrics;
  for (const metric of accuracy.metrics) {
    assert.equal(metrics[metric.metricKey].subject.present, true, metric.label);
    assert.equal(metrics[metric.metricKey].subject.cardId, 'c5b50bfe-source-card', metric.label);
  }
  const requirements = collectSourceRequirements(accuracy.metrics);
  assert.ok(requirements.provisionFamilies.includes('COND'));
});
