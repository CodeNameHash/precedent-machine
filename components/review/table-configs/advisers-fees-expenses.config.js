import React from 'react';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['fee-expense', 'Fee / expense allocation', 'Expenses', ['feeExpenseAllocation', 'expensesAllocation']],
  ['expense-exceptions', 'Expense exceptions', 'Expenses', ['feeExpenseAllocationExceptions', 'feeExpenseExceptions', 'expenseExceptions']],
  ['adviser-fees', 'Adviser fees', 'Advisers', ['adviserFees', 'brokerFees', 'financialAdvisorFees']],
  ['company-adviser', 'Company adviser', 'Advisers', ['companyFinancialAdvisor', 'companyAdvisor']],
  ['parent-adviser', 'Parent adviser', 'Advisers', ['parentFinancialAdvisor', 'parentAdvisor']],
  ['governing-law', 'Governing law', 'Boilerplate', ['governingLaw']],
  ['forum', 'Forum / jurisdiction', 'Boilerplate', ['jurisdictionExclusive', 'jurisdictionExclusiveText']],
  ['specific-performance', 'Specific performance', 'Remedies', ['specificPerformance']],
  ['specific-performance-limitations', 'Specific performance limitations', 'Remedies', ['specificPerformanceLimitations']],
  ['third-party', 'Third-party beneficiaries', 'Boilerplate', ['thirdPartyBeneficiaryExceptions']],
  // Assignment group (Metsera parity gap root cause 4: "whole sub-section,
  // no rows" — all five sit on the same MISC-ASSIGN boilerplate card).
  ['assignment-parent-right', 'Parent assignment right', 'Assignment', ['parentAssignmentRight']],
  ['assignment-parent-conditions', 'Parent assignment conditions', 'Assignment', ['parentAssignmentConditions']],
  ['assignment-company-consent', 'Company consent for assignment', 'Assignment', ['companyConsentForAssignment']],
  ['assignment-exceptions', 'Assignment exceptions', 'Assignment', ['assignmentExceptions']],
  ['assignment-restrictions', 'Assignment restrictions', 'Assignment', ['assignmentRestrictions']],
];

function isMiscFee(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /fees|expenses|adviser|advisor|governing law|jurisdiction|specific performance/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Read-view pill is the resolved value alone -- the Term column already
// names the row, so a "<Kind>: " prefix only repeated it.
function miscSignal(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: row.detail,
    value: row.detail,
    tone: row.kind === 'Expenses' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedMiscRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('advisers-fees-expenses', id, label, kind, hit);
      if (!row) return null;
      return { ...row, sourceCard: hit.card, signals: [miscSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
    })
    .filter(Boolean);
}

function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return (row.signals || []).map((item) => item.label).join('\n');
  return (row.signals || []).map((item) => React.createElement(PillCell, {
    key: item.id,
    label: item.label,
    value: item.value,
    tone: item.tone,
    evidence: item.evidence,
    source: item.source,
  }));
}

function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const advisersFeesExpensesConfig = {
  id: 'advisers-fees-expenses',
  title: 'Advisers / Fees / Expenses',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    return mappedMiscRows(selectCards(reviewDeal, isMiscFee));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { advisersFeesExpensesConfig, miscSignal, renderDetail, renderSignals };
