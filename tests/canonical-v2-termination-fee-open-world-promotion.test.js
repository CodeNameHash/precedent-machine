'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FEE_AMOUNT_CLAIM_KEY,
  shapeTerminationFeeProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');

const OPEN_WORLD_CLAIM_KEY = 'OPEN_WORLD_PROPOSITION';
const MODIV_COMPANY_BASE_AMOUNT = '(f) “Company Base Amount” means (x) if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii), $10,000,000, or (y) if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v), $15,000,000.00.';
const MODIV_PARENT_BASE_AMOUNT = '(gg) “Parent Base Amount” means $15,000,000.00.';
const RECORDED_MODIV_OPEN_WORLD_CANDIDATES = [
  {
    observed_quote: MODIV_COMPANY_BASE_AMOUNT,
    nearest_concept: 'fee_amount_assertions',
    why_unmapped: 'It states conditional base amounts resembling a seller termination fee, but does not identify the payer party in this text.',
  },
  {
    observed_quote: MODIV_PARENT_BASE_AMOUNT,
    nearest_concept: 'fee_amount_assertions',
    why_unmapped: 'It states a base amount resembling a buyer termination fee, but does not identify the payer party in this text.',
  },
];

function shapeOpenWorldCandidate(candidate, sourceText = candidate.observed_quote) {
  return shapeTerminationFeeProposals({
    fee_amount_assertions: [],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [],
    open_world_candidates: [candidate],
  }, sourceText, { section_reference: '8.12' });
}

test('recorded Modiv 8.12 Base Amount observations promote to three fee-amount proposals with no open-world copies', () => {
  const sourceText = RECORDED_MODIV_OPEN_WORLD_CANDIDATES.map((candidate) => candidate.observed_quote).join('\n');
  const shaped = shapeTerminationFeeProposals({
    fee_amount_assertions: [],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [],
    open_world_candidates: RECORDED_MODIV_OPEN_WORLD_CANDIDATES,
  }, sourceText, { section_reference: '8.12' });

  assert.equal(shaped.evidence_residuals.length, 0);
  assert.equal(shaped.proposals.length, 3);
  assert.ok(shaped.proposals.every((proposal) => proposal.claim_definition_key === FEE_AMOUNT_CLAIM_KEY));
  assert.equal(shaped.proposals.filter((proposal) => proposal.claim_definition_key === OPEN_WORLD_CLAIM_KEY).length, 0);
  assert.deepEqual(
    shaped.proposals.map((proposal) => proposal.attributes),
    [
      {
        section_reference: '8.12', fee_side: 'SELLER', payer_party: 'the Company',
        fee_term_ref: 'Company Base Amount', limb_amount_quote: '$10,000,000',
      },
      {
        section_reference: '8.12', fee_side: 'SELLER', payer_party: 'the Company',
        fee_term_ref: 'Company Base Amount', limb_amount_quote: '$15,000,000.00',
      },
      {
        section_reference: '8.12', fee_side: 'BUYER', payer_party: 'Parent',
        fee_term_ref: 'Parent Base Amount',
      },
    ],
  );
});

test('Base Amount promotion rejects every boundary case and preserves a verified candidate as open world', () => {
  const cases = [
    {
      name: 'wrong nearest concept',
      candidate: {
        observed_quote: '“Company Base Amount” means $10,000,000.',
        nearest_concept: 'fee_trigger_assertions', why_unmapped: 'wrong route',
      },
    },
    {
      name: 'non-definition mention',
      candidate: {
        observed_quote: 'The “Company Base Amount” is $10,000,000.',
        nearest_concept: 'fee_amount_assertions', why_unmapped: 'not a definition',
      },
    },
    {
      name: 'missing amount',
      candidate: {
        observed_quote: '“Company Base Amount” means the amount set out in the schedule.',
        nearest_concept: 'fee_amount_assertions', why_unmapped: 'no dollar figure',
      },
    },
    {
      name: 'other party term',
      candidate: {
        observed_quote: '“Target Base Amount” means $10,000,000.',
        nearest_concept: 'fee_amount_assertions', why_unmapped: 'other party',
      },
    },
    {
      name: 'similar plural term',
      candidate: {
        observed_quote: '“Company Base Amounts” means $10,000,000.',
        nearest_concept: 'fee_amount_assertions', why_unmapped: 'similar name',
      },
    },
    {
      name: 'similar expanded term',
      candidate: {
        observed_quote: '“Company Adjusted Base Amount” means $10,000,000.',
        nearest_concept: 'fee_amount_assertions', why_unmapped: 'similar name',
      },
    },
  ];

  for (const { name, candidate } of cases) {
    const shaped = shapeOpenWorldCandidate(candidate);
    assert.equal(shaped.evidence_residuals.length, 0, name);
    assert.equal(shaped.proposals.length, 1, name);
    assert.equal(shaped.proposals[0].claim_definition_key, OPEN_WORLD_CLAIM_KEY, name);
  }
});

test('an unverified Base Amount quote is not promoted and remains an evidence residual', () => {
  const candidate = {
    observed_quote: '“Company Base Amount” means $10,000,000.',
    nearest_concept: 'fee_amount_assertions',
    why_unmapped: 'unverified',
  };
  const shaped = shapeOpenWorldCandidate(candidate, 'A different sentence is the admitted source.');
  assert.equal(shaped.proposals.length, 0);
  assert.deepEqual(shaped.evidence_residuals, [{
    reason: 'OPEN_WORLD_QUOTE_UNVERIFIED',
    quote_preview: candidate.observed_quote,
  }]);
});

test('Base Amount promotion rejects malformed decimals and multi-proposition quotes', () => {
  const cases = [
    '“Company Base Amount” means $10.5.',
    '“Company Base Amount” means $10,000,000. “Parent Base Amount” means $15,000,000.',
    'An escrow amount is $2,000,000. “Company Base Amount” means $10,000,000.',
    '“Company Base Amount” means $10,000,000. An escrow amount is $2,000,000.',
  ];

  for (const observedQuote of cases) {
    const shaped = shapeOpenWorldCandidate({
      observed_quote: observedQuote,
      nearest_concept: 'fee_amount_assertions',
      why_unmapped: 'hostile boundary',
    });
    assert.equal(shaped.evidence_residuals.length, 0, observedQuote);
    assert.equal(shaped.proposals.length, 1, observedQuote);
    assert.equal(shaped.proposals[0].claim_definition_key, OPEN_WORLD_CLAIM_KEY, observedQuote);
  }
});

test('a Base Amount quote already shaped as a fee amount is not promoted a second time from open world', () => {
  const shaped = shapeTerminationFeeProposals({
    fee_amount_assertions: [{
      section_reference: '8.12',
      fee_side: 'BUYER',
      payer_party: 'Parent',
      fee_term_ref: 'Parent Base Amount',
      quote: MODIV_PARENT_BASE_AMOUNT,
    }],
    fee_trigger_assertions: [],
    tail_period_assertions: [],
    wave_b_mechanics: [],
    open_world_candidates: [RECORDED_MODIV_OPEN_WORLD_CANDIDATES[1]],
  }, MODIV_PARENT_BASE_AMOUNT, { section_reference: '8.12' });

  assert.equal(shaped.evidence_residuals.length, 0);
  assert.equal(shaped.proposals.length, 1);
  assert.equal(shaped.proposals[0].claim_definition_key, FEE_AMOUNT_CLAIM_KEY);
});
