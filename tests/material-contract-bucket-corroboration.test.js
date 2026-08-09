'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { MATERIAL_CONTRACT_BUCKET_META } = require('../lib/taxonomy');

const NONCOMPETE_QUOTES = [
  'materially restricts the ability of the Company or any Company Subsidiary to compete in any business or with any Person in any geographical area',
  'contains covenants of the Company or any of the Company Subsidiaries purporting to limit, in any material respect, either the type of business in which the Company or any of the Company Subsidiaries or any of their controlled affiliates may engage or the geographic area in which any of them may so engage',
  'materially limits the right or ability of the Company, any of its Subsidiaries or any affiliate of any of them to compete with any other person in any line of business or geographic region that is material to the Company and its Subsidiaries, taken as a whole',
  'any Contract that purports to prohibit the Company or any of its Subsidiaries from competing in any material respect in any business line, with any Person or in any geographic area that, in either case, is material to the operation of the Company’s and its Subsidiaries’ business, taken as a whole',
];

test('Step 2X-G recurring noncompetition material-contract candidates corroborate', () => {
  for (const quote of NONCOMPETE_QUOTES) {
    const matchingBuckets = Object.entries(MATERIAL_CONTRACT_BUCKET_META)
      .filter(([, meta]) => meta.synonyms.some((pattern) => pattern.test(quote)))
      .map(([bucket]) => bucket)
      .sort();
    assert.deepEqual(matchingBuckets, ['NONCOMPETE'], quote);
  }
});

test('HOSTILE: adjacent competition, budget and regulator language do not corroborate as noncompetition', () => {
  const { synonyms } = MATERIAL_CONTRACT_BUCKET_META.NONCOMPETE;
  for (const quote of [
    'The Company competes with other businesses in several geographical areas.',
    'The agreement prohibits a competing bidder from receiving the payment.',
    'The covenants require the Company to limit its marketing budget for the next fiscal year.',
    'The covenants limit the manner in which the Company may engage with a regulator in connection with its business.',
  ]) {
    assert.equal(synonyms.some((pattern) => pattern.test(quote)), false, quote);
  }
});

test('Step 2X-K exact Terra IP licence formulations corroborate only their directed bucket', () => {
  const cases = [
    [
      'any material Contract pursuant to which (i) the Company or any of the Company Subsidiaries licenses, acquires or is otherwise permitted to use the Intellectual Property of any third party',
      'IP_LICENSES_IN',
    ],
    [
      'pursuant to which a third party licenses or is otherwise permitted to use any Company Intellectual Property',
      'IP_LICENSES_OUT',
    ],
  ];
  for (const [quote, expectedBucket] of cases) {
    const matchingBuckets = Object.entries(MATERIAL_CONTRACT_BUCKET_META)
      .filter(([, meta]) => meta.synonyms.some((pattern) => pattern.test(quote)))
      .map(([bucket]) => bucket)
      .sort();
    assert.deepEqual(matchingBuckets, [expectedBucket], quote);
  }
});

test('HOSTILE: generic licence and affiliate wording does not corroborate as Terra IP formulations', () => {
  const inbound = MATERIAL_CONTRACT_BUCKET_META.IP_LICENSES_IN.synonyms;
  const outbound = MATERIAL_CONTRACT_BUCKET_META.IP_LICENSES_OUT.synonyms;
  const affiliate = MATERIAL_CONTRACT_BUCKET_META.AFFILIATE_TRANSACTIONS.synonyms;
  for (const quote of [
    'The Company may use a third party service provider under an ordinary commercial contract.',
    'A third party is otherwise permitted to use any Company asset for maintenance work.',
    'The Company licenses, acquires or is otherwise permitted to use a third party data feed.',
  ]) {
    assert.equal(inbound.some((pattern) => pattern.test(quote)), false, quote);
    assert.equal(outbound.some((pattern) => pattern.test(quote)), false, quote);
  }
  assert.equal(affiliate.some((pattern) => pattern.test(
    'The Company shall provide notice to an affiliate before a public announcement.',
  )), false);
});
