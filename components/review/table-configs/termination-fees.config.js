import React from 'react';
import { buildTerminationFees, normalizeTermfFeatures } from '../../../lib/termf.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';

// Scalar rows read straight off a flat claim attribute that already matches
// its legacy/UI name 1:1 — no nested-shape bridging needed (that bridging
// lives in lib/termf.js's routeRawTerminationFees, used by feeTableRows()
// below for the amount/trigger/tail rows).
const SCALAR_ROWS = [
  ['required', 'Fee required to terminate', 'Condition', ['feeRequired', 'terminationFeeRequired']],
  ['naked-no-vote', 'Naked no-vote fee', 'Condition', ['nakedNoVoteFeePresent', 'nakedNoVoteFee']],
  ['sole-remedy', 'Sole and exclusive remedy', 'Remedy', ['soleRemedy', 'soleAndExclusiveRemedy']],
  ['effect', 'Effect of termination', 'Remedy', ['effectOfTermination']],
  ['interest', 'Interest on late payment', 'Remedy', ['interestOnLatePayment']],
  ['willful-breach', 'Willful-breach exception', 'Remedy', ['willfulBreachException']],
];

const FEE_TYPE_LABELS = {
  COMPANY_TERMINATION_FEE: 'Company termination fee',
  REVERSE_TERMINATION_FEE: 'Reverse termination fee',
  EXPENSE_REIMBURSEMENT: 'Expense reimbursement',
  NAKED_NO_VOTE_FEE: 'Naked no-vote fee',
  TAIL_FEE: 'Tail fee (see Tail Fee Mechanics)',
};

const PARTY_LABELS = { TARGET: 'Company / Target', BUYER: 'Parent / Buyer' };

const SOURCE_CARD_CODE_BY_KEY = {
  companyTerminationFee: 'TERMF-TARGET',
  feeAmount: 'TERMF-TARGET',
  reverseTerminationFee: 'TERMF-REVERSE',
  reverseFeeAmount: 'TERMF-REVERSE',
  expenseReimbursement: 'TERMF-EXPENSE',
  expenseReimbursementCap: 'TERMF-EXPENSE',
  tailProvision: 'TERMF-TAIL',
  tailFeeWindowMonths: 'TERMF-TAIL',
};

function isTerminationFee(card) {
  return cardType(card) === 'TERMINATION_FEE' || cardCode(card).startsWith('TERMF') || /termination fee|reverse termination|tail fee|ticking fee/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

// Merge every TERMF card's features into one bag, routing each card's flat
// `terminationFees` claim into the legacy nested key buildTerminationFees()
// expects (see lib/termf.js) BEFORE the merge, so e.g. TERMF-TARGET's and
// TERMF-TAIL's same-named `terminationFees` attribute don't clobber each
// other.
function combineTermfFeatures(cards) {
  let combined = {};
  for (const card of cards) combined = { ...combined, ...normalizeTermfFeatures(cardFeatures(card), cardCode(card)) };
  return combined;
}

function findSourceCard(cards, sourceKey) {
  const wantCode = SOURCE_CARD_CODE_BY_KEY[sourceKey];
  return (wantCode && cards.find((card) => cardCode(card) === wantCode)) || cards[0];
}

// Renders the structured fee row (amount, % of equity, payer/payee,
// deadline, sole-remedy flag) as a short readable line instead of the raw
// { amount, triggers, payment_deadline, ... } object the claims-adapter
// hands back.
function formatFeeDetail(feeRow) {
  const parts = [];
  if (feeRow.amount) parts.push(String(feeRow.amount));
  if (feeRow.percentEquityValue) parts.push(`${feeRow.percentEquityValue} of equity value`);
  if (feeRow.payableBy && feeRow.payableTo) {
    parts.push(`Payable by ${PARTY_LABELS[feeRow.payableBy] || feeRow.payableBy} to ${PARTY_LABELS[feeRow.payableTo] || feeRow.payableTo}`);
  }
  if (feeRow.paymentDeadline) parts.push(`Deadline: ${feeRow.paymentDeadline}`);
  if (feeRow.soleRemedy === true) parts.push('Sole and exclusive remedy');
  return parts.filter(Boolean).join(' · ') || 'Amount not specified';
}

// One pill per trigger (short plain-English name), not the trigger's full
// verbatim clause text — the clause itself is still reachable via the
// pill's evidence hover.
function feeTriggerSignals(feeRow) {
  return (feeRow.triggers || []).map((trigger, index) => ({
    id: `${feeRow.feeType}-trigger-${index}`,
    label: trigger.name,
    value: trigger.name,
    tone: 'info',
    evidence: trigger.sourceText,
  }));
}

function feeTableRows(cards) {
  const combined = combineTermfFeatures(cards);
  return buildTerminationFees(combined).map((feeRow) => {
    const sourceCard = findSourceCard(cards, feeRow.sourceKey);
    return {
      id: `termination-fees-${feeRow.feeType}`,
      label: FEE_TYPE_LABELS[feeRow.feeType] || feeRow.feeType,
      kind: 'Amount',
      detail: formatFeeDetail(feeRow),
      evidence: textOf(sourceCard),
      sourceCard,
      present: true,
      signals: feeTriggerSignals(feeRow),
    };
  });
}

function scalarRows(cards) {
  return SCALAR_ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('termination-fees', id, label, kind, hit);
      if (!row) return null;
      return {
        ...row,
        sourceCard: hit.card,
        // Bare value only -- the Term column already names this row.
        signals: [{
          id: `${row.id}-signal`,
          label: row.detail,
          value: row.detail,
          tone: kind === 'Condition' ? 'warning' : 'neutral',
          evidence: row.evidence,
          source: row.sourceCard,
        }],
      };
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

// feeTableRows()' detail (formatFeeDetail) is the ONLY place the fee
// amount/payer/deadline summary is visible — scalarRows' signals mirror
// their own detail, but the fee rows' signals are trigger-name pills with
// different content, so the column can't be wholesale relocated behind the
// row-level expander without hiding the amount itself. Truncate per-cell so
// the (usually short) computed summary stays inline and only a genuinely
// long payment-deadline clause spills into "see text".
function renderDetail(row, ctx) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!TruncatedWithSeeText) return row.detail;
  return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.sourceCard });
}

const terminationFeesConfig = {
  id: 'termination-fees',
  title: 'Termination Fees',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isTerminationFee);
    if (!cards.length) return [];
    return [...feeTableRows(cards), ...scalarRows(cards)];
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export {
  combineTermfFeatures,
  feeTableRows,
  formatFeeDetail,
  renderDetail,
  renderSignals,
  scalarRows,
  terminationFeesConfig,
};
