'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  terminationRightsReviewCacheControl,
} = require('../lib/canonical-v2/termination-rights-review-serving-source');

const ROUTE = 'pages/api/review/[id]/cards.js';

test('the cards route attaches Termination Rights review state before wire trimming', () => {
  const source = fs.readFileSync(ROUTE, 'utf8');
  const importAt = source.indexOf('termination-rights-review-serving-source');
  const feeAt = source.indexOf('attachCanonicalTerminationFeeServing(previewedReviewDeal');
  const rightsAt = source.indexOf('attachCanonicalTerminationRightsReview(servedReviewDeal');
  const cacheAt = source.indexOf('terminationRightsReviewCacheControl(rightsReviewDeal)');
  const trimAt = source.indexOf('trimReviewDealForWire(rightsReviewDeal)');

  assert.notEqual(importAt, -1);
  assert.notEqual(feeAt, -1);
  assert.notEqual(rightsAt, -1);
  assert.notEqual(cacheAt, -1);
  assert.notEqual(trimAt, -1);
  assert.ok(importAt < rightsAt);
  assert.ok(feeAt < rightsAt);
  assert.ok(rightsAt < cacheAt);
  assert.ok(cacheAt < trimAt);
  assert.ok(rightsAt < trimAt);
});

test('the cards route disables shared caching whenever Termination review state is activated', () => {
  const shared = 's-maxage=300, stale-while-revalidate=3600';
  assert.equal(terminationRightsReviewCacheControl({ cards: [] }), shared);

  for (const state of ['ATTACHED', 'FAILED']) {
    assert.equal(terminationRightsReviewCacheControl({
      cards: [],
      canonical_v2_termination_rights_review_source_status: { state },
    }), 'private, no-store');
  }

  const inherited = Object.create({
    canonical_v2_termination_rights_review_source_status: { state: 'ATTACHED' },
  });
  assert.equal(terminationRightsReviewCacheControl(inherited), shared);
});
