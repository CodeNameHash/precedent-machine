'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
  getFrozenFourDealLocalDemoResult,
} = require('../lib/four-deal-local-demo-preview');

test('four-deal preview binds immutable M3 rows and the sealed Metsera Process result into one read-only contract', () => {
  const result = getFrozenFourDealLocalDemoResult();
  assert.equal(result.schema_version, FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA);
  assert.equal(result.mode, 'FROZEN_READ_ONLY_PREVIEW');
  assert.equal(result.write_authority, 'NONE');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.deals.length, 4);
  assert.equal(result.m3_artifact.relative_path, 'final-output/execution-result.json');

  const topBuild = result.deals.find((deal) => deal.deal_name === 'TopBuild');
  const skechers = result.deals.find((deal) => deal.deal_name === 'Skechers');
  const modiv = result.deals.find((deal) => deal.deal_name === 'Modiv');
  const metsera = result.deals.find((deal) => deal.deal_name === 'Metsera');
  for (const deal of [topBuild, skechers, modiv]) {
    assert.equal(deal.result_domain, 'M3_CANONICAL_REVIEW');
    assert.ok(deal.rows.some((row) => row.result_type === 'GOVERNED_VALUE'
      && row.source_quote && row.source_citation));
    assert.ok(deal.rows.every((row) => row.review_state && row.source_citation));
  }
  assert.ok(topBuild.rows.some((row) => row.result_type === 'OPEN_WORLD_WARNING'
    && row.warning));
  assert.equal(metsera.result_domain, 'PROCESS_PRODUCT');
  assert.equal(metsera.rows[0].governed_value, 'EXCLUSIVITY_GRANTED');
  assert.match(metsera.rows[0].source_citation, /Metsera DEFM14A/);
  assert.equal(metsera.product_component.slot_state, 'VALID');
});
