const test = require('node:test');
const assert = require('node:assert/strict');

const { jaccard, levenshtein, rankCandidates } = require('../../lib/schema-shape/similarity');

test('PH0C-F: similarity engine is deterministic and explainable', () => {
  const definitions = [
    { vocab: 'FROZEN-triggerCode-v1', key: 'OUTSIDE_DATE_ELAPSED', label: 'Outside date elapsed', body: 'terminationFees[] outside date' },
    { vocab: 'FROZEN-triggerCode-v1', key: 'BUYER_REG_FAILURE', label: 'Buyer regulatory failure', body: 'antitrust regulatory' },
  ];
  const first = rankCandidates('End Date', { vocab: 'FROZEN-triggerCode-v1', shape: 'terminationFees[]' }, { definitions });
  const second = rankCandidates('End Date', { vocab: 'FROZEN-triggerCode-v1', shape: 'terminationFees[]' }, { definitions });
  assert.deepEqual(second, first);
  assert.equal(first[0].key, 'OUTSIDE_DATE_ELAPSED');
  assert.deepEqual(Object.keys(first[0].score), ['string', 'context', 'priors', 'total']);
});

test('PH0C-F: string metrics are bounded', () => {
  assert.equal(jaccard('outside date', 'outside date'), 1);
  assert.equal(levenshtein('outside date', 'outside date'), 1);
  assert.ok(jaccard('outside date', 'buyer breach') < 1);
});
