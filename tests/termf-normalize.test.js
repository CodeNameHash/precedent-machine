const assert = require('node:assert/strict');
const test = require('node:test');

test('normalizeTermfFeatures derives structured terminationFees rows', async () => {
  const { normalizeTermfFeatures } = await import('../lib/termf.js');
  const features = normalizeTermfFeatures({
    companyTerminationFee: {
      amount: '$100,000,000',
      percentage_of_equity: '3.2%',
      triggers: [
        {
          code: 'SUPERIOR_PROPOSAL',
          label: 'Company terminates to accept a Superior Proposal',
          text: 'Company terminates pursuant to Section 8.01(f)',
        },
      ],
      payment_deadline: 'within two business days',
    },
    reverseTerminationFee: {
      amount: '$200,000,000',
      triggers: ['Parent terminates pursuant to Section 8.01(b) (Regulatory Failure)'],
    },
    expenseReimbursement: {
      amount_cap: '$10,000,000',
      triggers: ['Company terminates pursuant to Section 8.01(d)'],
    },
    nakedNoVoteFee: true,
    nakedNoVoteFeeAmount: '$25,000,000',
    tailProvision: {
      period_months: 12,
      threshold_percentage: '50%',
      triggers: ['Tail fee: alternative transaction consummated within 12 months'],
    },
  });

  assert.deepEqual(features.terminationFees.map((row) => row.feeType), [
    'COMPANY_TERMINATION_FEE',
    'REVERSE_TERMINATION_FEE',
    'EXPENSE_REIMBURSEMENT',
    'NAKED_NO_VOTE_FEE',
    'TAIL_FEE',
  ]);
  assert.equal(features.terminationFees[0].payableBy, 'TARGET');
  assert.equal(features.terminationFees[0].payableTo, 'BUYER');
  assert.equal(features.terminationFees[0].triggers[0].feeAmount, '$100,000,000');
  assert.equal(features.terminationFees[1].payableBy, 'BUYER');
  assert.equal(features.terminationFees[1].paymentDeadline, null);
  assert.equal(features.terminationFees[4].tail.periodMonths, 12);
});
