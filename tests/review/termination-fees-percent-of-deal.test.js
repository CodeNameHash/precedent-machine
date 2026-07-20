// r13 (Ben, "% of deal value"): pins the review-page termination-fees table
// row's behavior — show a computed % of deal value next to the fee amount
// when reviewDeal.value_usd is available and the fee carries no extracted
// percent; suppress it when value_usd is missing; and never show a computed
// figure alongside an extracted one (the agreement's own number wins).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', '..', 'components', 'review', 'table-configs', 'termination-fees.config.js'));
});

function termfCard({ amount, percentageOfEquity } = {}) {
  return {
    id: 'termf-target',
    provision_type: 'TERMINATION_FEE',
    provision_subtype: 'TERMF-TARGET',
    primary_quote: 'Company Termination Fee provision.',
    features: {
      terminationFees: {
        amount,
        percentage_of_equity: percentageOfEquity,
        triggers: [],
      },
    },
  };
}

test('shows the computed % of deal value when value_usd is present and no extracted percent exists', () => {
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: 1000000000,
    cards: [termfCard({ amount: '$30,000,000' })],
  });
  const fee = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(fee.detail, /\$30,000,000/);
  assert.match(fee.detail, /3\.0% of deal value/);
  const amountSignal = fee.signals.find((s) => s.id === 'COMPANY_TERMINATION_FEE-amount');
  assert.equal(amountSignal.label, '$30,000,000 (3.0% of deal value)');
});

test('suppresses the percentage entirely when value_usd is missing — amount renders alone', () => {
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: null,
    cards: [termfCard({ amount: '$30,000,000' })],
  });
  const fee = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(fee.detail, /\$30,000,000/);
  assert.doesNotMatch(fee.detail, /% of deal value/);
  const amountSignal = fee.signals.find((s) => s.id === 'COMPANY_TERMINATION_FEE-amount');
  assert.equal(amountSignal.label, '$30,000,000');
});

test('the agreement\'s own extracted percent wins over the computed one — never shows both', () => {
  const rows = mod.terminationFeesConfig.selectRows({
    value_usd: 1000000000, // would compute to 3.0%, but the deal has its own extracted 3.5%
    cards: [termfCard({ amount: '$30,000,000', percentageOfEquity: '3.5%' })],
  });
  const fee = rows.find((row) => row.id === 'termination-fees-COMPANY_TERMINATION_FEE');
  assert.match(fee.detail, /3\.5% of equity value/);
  assert.doesNotMatch(fee.detail, /of deal value/);
  const amountSignal = fee.signals.find((s) => s.id === 'COMPANY_TERMINATION_FEE-amount');
  assert.equal(amountSignal.label, '$30,000,000 (3.5% of equity value)');
});

test('dealPercentText helper: extracted percent always wins, computed percent only when eligible fee type + amount + deal value all present', () => {
  const { dealPercentText } = mod;
  assert.equal(dealPercentText({ feeType: 'COMPANY_TERMINATION_FEE', amount: '$30,000,000', percentEquityValue: null }, 1000000000), '3.0% of deal value');
  assert.equal(dealPercentText({ feeType: 'COMPANY_TERMINATION_FEE', amount: '$30,000,000', percentEquityValue: '5%' }, 1000000000), null);
  assert.equal(dealPercentText({ feeType: 'COMPANY_TERMINATION_FEE', amount: '$30,000,000', percentEquityValue: null }, null), null);
  // Out of scope per spec (price/consideration/deal-value fields, IOC
  // thresholds) never get a computed percent even if a deal value is known.
  assert.equal(dealPercentText({ feeType: 'NAKED_NO_VOTE_FEE', amount: '$5,000,000', percentEquityValue: null }, 1000000000), null);
});
