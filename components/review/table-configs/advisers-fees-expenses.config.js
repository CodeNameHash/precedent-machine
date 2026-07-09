import React from 'react';
import { cardCode, cardType, firstFeature, labelOf, makeRow, selectCards, textOf } from './card-utils.js';

// REBUILD-SPECS.md section 13 ("complete garbage" per Ben), tightened again
// per FEEDBACK-2-PUNCHLIST.md item 45: this table is scoped to genuinely
// adviser/fee/expense-allocation content only -- Financial advisor and
// Fee/expense allocation. Specific performance and the Assignment group are
// generic Miscellaneous/boilerplate provisions (not adviser/fee content) and
// now live on misc-boilerplate.config.js's "Miscellaneous / Boilerplate"
// table alongside governing law, forum, and third-party beneficiaries.
const ROWS = [
  ['fee-expense', 'Fee / expense allocation', 'Expenses', ['feeExpenseAllocation', 'expensesAllocation']],
  ['expense-exceptions', 'Expense exceptions', 'Expenses', ['feeExpenseAllocationExceptions', 'feeExpenseExceptions', 'expenseExceptions']],
];

function isAdvisersFeesCard(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'MISC_BOILERPLATE' || code.startsWith('MISC') || /fees|expenses|adviser|advisor|broker/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Financial advisor is a SINGLE clean row per the spec, not three ("Adviser
// fees" / "Company adviser" / "Parent adviser"). Company/Parent advisor
// identity and the fee itself render as sub-fact pills under it (global
// design rule: sub-labelled facts, not separate rows, when a cell has >1
// fact for the same concept).
// DATA GAP: no ingestion schema key currently captures adviser identity
// (no companyFinancialAdvisor/parentFinancialAdvisor/adviserFees key exists
// in lib/schema/features.generated.js as of this WP) -- this row will not
// populate until that's added upstream. The nearest real signal today is the
// no-broker reps (REP-T-BROKERS / REP-B-BROKERS) and the fairness-opinion
// rep (REP-T-FAIRNESS, which names the advisor in prose, e.g. "Goldman
// Sachs"), but those live in Representations and are out of this WP's scope
// to reroute.
function buildFinancialAdvisorRow(cards) {
  const companyHit = firstFeature(cards, ['companyFinancialAdvisor', 'companyAdvisor']);
  const parentHit = firstFeature(cards, ['parentFinancialAdvisor', 'parentAdvisor']);
  const feesHit = firstFeature(cards, ['adviserFees', 'brokerFees', 'financialAdvisorFees']);
  if (!companyHit && !parentHit && !feesHit) return null;
  const primary = companyHit || parentHit || feesHit;
  const signals = [];
  if (companyHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-company',
      label: `Company: ${companyHit.detail}`,
      value: companyHit.detail,
      tone: 'neutral',
      evidence: textOf(companyHit.card),
      source: companyHit.card,
    });
  }
  if (parentHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-parent',
      label: `Parent: ${parentHit.detail}`,
      value: parentHit.detail,
      tone: 'neutral',
      evidence: textOf(parentHit.card),
      source: parentHit.card,
    });
  }
  if (feesHit) {
    signals.push({
      id: 'advisers-fees-expenses-financial-advisor-fees',
      label: `Fees: ${feesHit.detail}`,
      value: feesHit.detail,
      tone: 'info',
      evidence: textOf(feesHit.card),
      source: feesHit.card,
    });
  }
  return {
    id: 'advisers-fees-expenses-financial-advisor',
    label: 'Financial advisor',
    kind: 'Advisers',
    detail: primary.detail,
    evidence: textOf(primary.card),
    source: labelOf(primary.card),
    sourceCard: primary.card,
    present: true,
    signals,
  };
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
    const cards = selectCards(reviewDeal, isAdvisersFeesCard);
    const advisorRow = buildFinancialAdvisorRow(cards);
    return [...(advisorRow ? [advisorRow] : []), ...mappedMiscRows(cards)];
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { advisersFeesExpensesConfig, miscSignal, renderDetail, renderSignals };
