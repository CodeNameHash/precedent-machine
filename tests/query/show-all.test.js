// r15 (Ben: "I should be able to just get a list of ALL deals whether they
// have FTV or not — an 'either/all' mode. Same for fees — just see all."):
// FILTER_THEN_LIST's SHOW_ALL mode (filter.mode === 'all') returns every
// deal in the peer set, has:true/false annotated, with graded siblings
// (forceTheVote -> forceTheVoteType) surfaced as grade/gradeLabel.
const test = require('node:test');
const assert = require('node:assert/strict');

const { executeFilterThenList } = require('../../lib/query/executors/filter-then-list.js');
const { runQuery } = require('../../lib/query/engine');

const feature = (value, quotes) => ({ value, ...(quotes ? { quotes } : {}) });

const FTV_LANGUAGE = 'Notwithstanding any Company Adverse Recommendation Change, the Company shall submit this Agreement to its stockholders at the Company Stockholder Meeting.';

const deals = [
  { id: 'd-hard', acquirer: 'Buyer Hard', target: 'Target Hard', announce_date: '2026-01-01', metadata: {} },
  { id: 'd-soft', acquirer: 'Buyer Soft', target: 'Target Soft', announce_date: '2026-02-01', metadata: {} },
  { id: 'd-absent', acquirer: 'Buyer Absent', target: 'Target Absent', announce_date: '2026-03-01', metadata: {} },
];

const provisions = [
  {
    id: 'p-hard',
    deal_id: 'd-hard',
    type: 'NOSOL',
    category: 'Change of Recommendation',
    full_text: `Clause. ${FTV_LANGUAGE} More.`,
    ai_metadata: {
      features: {
        forceTheVote: feature(true, [FTV_LANGUAGE]),
        forceTheVoteDetails: feature(FTV_LANGUAGE),
        forceTheVoteType: feature('FTV_HARD', [FTV_LANGUAGE]),
      },
    },
  },
  {
    id: 'p-soft',
    deal_id: 'd-soft',
    type: 'NOSOL',
    category: 'Change of Recommendation',
    full_text: `Clause. ${FTV_LANGUAGE} More.`,
    ai_metadata: {
      features: {
        forceTheVote: feature(true, [FTV_LANGUAGE]),
        forceTheVoteDetails: feature(FTV_LANGUAGE),
        forceTheVoteType: feature('FTV_SOFT', [FTV_LANGUAGE]),
      },
    },
  },
  // d-absent has NO NOSOL provision carrying forceTheVote at all.
];

test('show-all boolean with graded sibling: every deal returns a hit, has flags and grades right', () => {
  const result = executeFilterThenList(
    { filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', mode: 'all' }], columns: [] },
    { deals, provisions },
  );
  assert.equal(result.rows.length, 3, 'every deal in the peer set returns, present or not');
  const byDeal = Object.fromEntries(result.rows.map((r) => [r.deal_id, r.matched_provision_hits[0]]));

  assert.equal(byDeal['d-hard'].has, true);
  assert.equal(byDeal['d-hard'].value, true);
  assert.equal(byDeal['d-hard'].grade, 'FTV_HARD');
  assert.match(byDeal['d-hard'].gradeLabel, /Hard force-the-vote/);
  assert.match(byDeal['d-hard'].quote.text, /shall submit this Agreement/);

  assert.equal(byDeal['d-soft'].has, true);
  assert.equal(byDeal['d-soft'].grade, 'FTV_SOFT');
  assert.match(byDeal['d-soft'].gradeLabel, /Soft force-the-vote/);

  assert.equal(byDeal['d-absent'].has, false);
  assert.equal(byDeal['d-absent'].value, null);
  assert.equal(byDeal['d-absent'].grade, undefined, 'no sibling data, no grade annotation');
  assert.equal(byDeal['d-absent'].quote, undefined, 'absent deal carries no quote');

  // Sort: has:true first, then by deal name.
  assert.deepEqual(result.rows.map((r) => r.deal_id), ['d-hard', 'd-soft', 'd-absent']);
});

test('show-all money field: every deal returns its fee value, absent deals still listed', () => {
  const feeDeals = [
    { id: 'd-fee-a', acquirer: 'A', target: 'A Target', announce_date: '2026-01-01', metadata: {} },
    { id: 'd-fee-b', acquirer: 'B', target: 'B Target', announce_date: '2026-02-01', metadata: {} },
    { id: 'd-fee-none', acquirer: 'C', target: 'C Target', announce_date: '2026-03-01', metadata: {} },
  ];
  const feeProvisions = [
    {
      id: 'p-fee-a', deal_id: 'd-fee-a', type: 'TERMF', category: 'Termination fee',
      full_text: 'Company termination fee of $50,000,000.',
      ai_metadata: { features: { feeAmount: feature(50000000, ['$50,000,000']) } },
    },
    {
      id: 'p-fee-b', deal_id: 'd-fee-b', type: 'TERMF', category: 'Termination fee',
      full_text: 'Company termination fee of $75,000,000.',
      ai_metadata: { features: { feeAmount: feature(75000000, ['$75,000,000']) } },
    },
  ];
  const result = executeFilterThenList(
    { filters: [{ provision_type: 'TERMINATION_FEE', field: 'feeAmount', mode: 'all' }], columns: [] },
    { deals: feeDeals, provisions: feeProvisions },
  );
  assert.equal(result.rows.length, 3);
  const byDeal = Object.fromEntries(result.rows.map((r) => [r.deal_id, r.matched_provision_hits[0]]));
  assert.equal(byDeal['d-fee-a'].has, true);
  assert.equal(byDeal['d-fee-a'].value, 50000000);
  assert.equal(byDeal['d-fee-b'].value, 75000000);
  assert.equal(byDeal['d-fee-none'].has, false);
  assert.equal(byDeal['d-fee-none'].value, null);
});

test('mode validation: unknown filter modes are rejected', async () => {
  await assert.rejects(
    () => runQuery('FILTER_THEN_LIST', {
      filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', mode: 'bogus' }],
      columns: [],
    }, { context: { deals, provisions } }),
    /invalid filter mode: bogus/,
  );
});

test('mode validation: mode:"all" is accepted end-to-end through runQuery', async () => {
  const result = await runQuery('FILTER_THEN_LIST', {
    filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', mode: 'all' }],
    columns: [],
  }, { context: { deals, provisions } });
  assert.equal(result.rows.length, 3);
});
