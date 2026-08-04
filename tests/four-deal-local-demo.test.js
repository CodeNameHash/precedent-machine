'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  DEMO_DEAL_IDS,
  getFourDealLocalDemo,
  reviewDealFromDirectory,
} = require('../lib/four-deal-local-demo');

test('four-deal demo is an immutable, exact subset of the frozen home directory', () => {
  const demo = getFourDealLocalDemo();
  assert.equal(demo.write_authority, 'NONE');
  assert.equal(Object.isFrozen(demo), true);
  assert.deepEqual(demo.deals.map((deal) => deal.id), DEMO_DEAL_IDS);
  assert.deepEqual(demo.deals.map((deal) => deal.target_display), ['TopBuild', 'Skechers', 'Modiv', 'Metsera']);
});

test('review adapter admits only a selected frozen demo deal', () => {
  const deal = getFourDealLocalDemo().deals[0];
  const adapted = reviewDealFromDirectory(deal);
  assert.equal(adapted.target, 'TopBuild');
  assert.equal(adapted.metadata.headline_consideration_type, deal.consideration_type);
  assert.throws(() => reviewDealFromDirectory({ id: 'outside-demo' }), /outside the four-deal local demo/);
});

test('four-deal page separates work-item legal review from row review and labels frozen rows truthfully', () => {
  const page = readFileSync(join(__dirname, '..', 'pages', 'demo', 'four-deal.js'), 'utf8');
  assert.match(page, /Work item legal review:/);
  assert.match(page, /Row legal review:/);
  assert.match(page, /NOT_SEPARATELY_REVIEWED/);
  assert.match(page, /Frozen review rows/);
  assert.doesNotMatch(page, />Final review output</);
  assert.doesNotMatch(page, /Legal: \{stateLabel\(row\.legal_review_state\)\}/);
});
