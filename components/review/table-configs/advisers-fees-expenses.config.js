import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['fee-expense', 'Fee / expense allocation', 'Expenses', ['feeExpenseAllocation', 'expensesAllocation']],
  ['expense-exceptions', 'Expense exceptions', 'Expenses', ['feeExpenseExceptions', 'expenseExceptions']],
  ['adviser-fees', 'Adviser fees', 'Advisers', ['adviserFees', 'brokerFees', 'financialAdvisorFees']],
  ['company-adviser', 'Company adviser', 'Advisers', ['companyFinancialAdvisor', 'companyAdvisor']],
  ['parent-adviser', 'Parent adviser', 'Advisers', ['parentFinancialAdvisor', 'parentAdvisor']],
  ['governing-law', 'Governing law', 'Boilerplate', ['governingLaw']],
  ['forum', 'Forum / jurisdiction', 'Boilerplate', ['jurisdictionExclusive', 'jurisdictionExclusiveText']],
  ['specific-performance', 'Specific performance', 'Remedies', ['specificPerformance']],
  ['third-party', 'Third-party beneficiaries', 'Boilerplate', ['thirdPartyBeneficiaryExceptions']],
];

function isMiscFee(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /fees|expenses|adviser|advisor|governing law|jurisdiction|specific performance/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const advisersFeesExpensesConfig = {
  id: 'advisers-fees-expenses',
  title: 'Advisers / Fees / Expenses',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    return mappedRows('advisers-fees-expenses', selectCards(reviewDeal, isMiscFee), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { advisersFeesExpensesConfig };
