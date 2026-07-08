import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

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

const terminationFeesConfig = {
  id: 'termination-fees',
  title: 'Termination Fees',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    return mappedRows('termination-fees', selectCards(reviewDeal, isTerminationFee), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { terminationFeesConfig };
