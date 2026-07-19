// r10 (Ben, force-the-vote query): when a section-level boolean is stamped
// on several provisions of a family, the hit must anchor to the provision
// whose claim carries its OWN evidence quote — and the quote shown must be
// the field's evidence (or its `<field>Details` sibling), never whichever
// card happened to sort first.
const test = require('node:test');
const assert = require('node:assert');

const { executeFilterThenList } = require('../../lib/query/executors/filter-then-list.js');

const feature = (value, quotes) => ({ value, ...(quotes ? { quotes } : {}) });

const deals = [{ id: 'd1', acquirer: 'Buyer', target: 'Target', announce_date: '2026-01-01', metadata: {} }];

const FTV_LANGUAGE = 'Notwithstanding any Company Adverse Recommendation Change, the Company shall submit this Agreement to its stockholders at the Company Stockholder Meeting.';

const provisions = [
  {
    // The Rule 14d-9 disclosure carve-out — carries the section-level
    // boolean but NO claim quote for it. Sorts first on purpose.
    id: 'p-disclose',
    deal_id: 'd1',
    type: 'NOSOL',
    category: 'Disclosure of Terms',
    full_text: 'Nothing shall prohibit the Company from taking and disclosing a position contemplated by Rule 14d-9.',
    ai_metadata: { features: { forceTheVote: feature(true) } },
  },
  {
    // The real change-of-recommendation card: boolean WITH its own quote,
    // plus the Details sibling carrying the verbatim FTV language.
    id: 'p-recommend',
    deal_id: 'd1',
    type: 'NOSOL',
    category: 'Change of Recommendation',
    full_text: `Longer clause. ${FTV_LANGUAGE} More text.`,
    ai_metadata: {
      features: {
        forceTheVote: feature(true, [FTV_LANGUAGE]),
        forceTheVoteDetails: feature(FTV_LANGUAGE),
      },
    },
  },
];

test('hit anchors to the provision with its own claim quote, and quotes the FTV evidence', () => {
  const result = executeFilterThenList(
    { filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: true }], columns: [] },
    { deals, provisions },
  );
  assert.equal(result.rows.length, 1);
  const [hit] = result.rows[0].matched_provision_hits;
  assert.equal(hit.card_id, 'p-recommend', 'anchors to the card whose claim carries evidence, not the first card with the flag');
  assert.match(hit.quote.text, /shall submit this Agreement to its stockholders/, 'quotes the force-the-vote language itself');
  assert.doesNotMatch(hit.quote.text, /Rule 14d-9/, 'never the disclosure carve-out');
});

test('details-sibling fallback: no claim quote anywhere still quotes the Details verbatim over full_text', () => {
  const noQuoteProvisions = [
    {
      id: 'p-only',
      deal_id: 'd1',
      type: 'NOSOL',
      category: 'Change of Recommendation',
      full_text: 'Massive full text without the operative language surfaced.',
      ai_metadata: { features: { forceTheVote: feature(true), forceTheVoteDetails: feature(FTV_LANGUAGE) } },
    },
  ];
  const result = executeFilterThenList(
    { filters: [{ provision_type: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', op: 'eq', value: true }], columns: [] },
    { deals, provisions: noQuoteProvisions },
  );
  const [hit] = result.rows[0].matched_provision_hits;
  assert.match(hit.quote.text, /shall submit this Agreement/, 'Details sibling wins over raw full_text');
});
