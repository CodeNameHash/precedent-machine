import React from 'react';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['target-fee', 'Target termination fee', 'Amount', ['targetTerminationFee', 'terminationFeeAmount', 'feeAmount']],
  ['reverse-fee', 'Reverse termination fee', 'Amount', ['reverseTerminationFee', 'reverseFeeAmount']],
  ['regulatory-fee', 'Regulatory termination fee', 'Amount', ['regulatoryTerminationFee', 'tickingFee']],
  ['percent', 'Fee percentage', 'Amount', ['feePercent', 'terminationFeePercent']],
  ['required', 'Fee required to terminate', 'Condition', ['feeRequired', 'terminationFeeRequired']],
  ['naked-no-vote', 'Naked no-vote fee', 'Condition', ['nakedNoVoteFeePresent']],
  ['triggers', 'Fee triggers', 'Trigger', ['terminationFees', 'feeTriggers', 'triggerRules']],
  ['tail', 'Tail fee mechanics', 'Tail', ['tailProvision', 'tailFeeSameProposalRequired']],
  ['remedy', 'Remedy effect', 'Remedy', ['remedyEffect', 'exclusiveRemedy']],
];

function isTerminationFee(card) {
  return cardType(card) === 'TERMINATION_FEE' || cardCode(card).startsWith('TERMF') || /termination fee|reverse termination|tail fee|ticking fee/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function feeSignal(row) {
  if (!row?.detail) return null;
  const labels = {
    Amount: 'Amount',
    Condition: 'Condition',
    Trigger: 'Trigger',
    Tail: 'Tail',
    Remedy: 'Remedy',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${row.detail}`,
    value: row.detail,
    tone: row.kind === 'Condition' ? 'warning' : 'info',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedFeeRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('termination-fees', id, label, kind, hit);
      if (!row) return null;
      return { ...row, sourceCard: hit.card, signals: [feeSignal({ ...row, sourceCard: hit.card })].filter(Boolean) };
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

const terminationFeesConfig = {
  id: 'termination-fees',
  title: 'Termination Fees',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    return mappedFeeRows(selectCards(reviewDeal, isTerminationFee));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { feeSignal, renderDetail, renderSignals, terminationFeesConfig };
