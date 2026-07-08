import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['party', 'Party who can terminate', 'Right', ['partyWhoCanTerminate']],
  ['triggers', 'Termination trigger', 'Right', ['terminationTriggers', 'mainConcept']],
  ['outside-date', 'Outside date', 'Timing', ['outsideDate', 'outsideDateISO']],
  ['outside-months', 'Months post-signing', 'Timing', ['outsideDateMonthsPostSigning', 'outsideDateMonths']],
  ['extension', 'Extension right', 'Timing', ['extensionAvailable', 'extensionPeriod', 'extensionTrigger']],
  ['vote', 'Vote failure', 'Approval', ['voteThreshold', 'shareholderApprovalFailure']],
  ['breach', 'Breach standard / cure', 'Breach', ['breachStandard', 'curePeriod', 'faultBasedExclusion']],
  ['recommendation', 'Change of recommendation', 'Fiduciary', ['recommendationChangeTermination', 'parentTerminationRightForNonsolicitBreach']],
  ['superior', 'Superior proposal termination', 'Fiduciary', ['superiorProposalTermination']],
];

function isTerminationRight(card) {
  return cardType(card) === 'TERMINATION_RIGHT' || cardCode(card).startsWith('TERMR') || /termination right|outside date|superior proposal/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const terminationRightsConfig = {
  id: 'termination-rights',
  title: 'Termination Rights',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    return mappedRows('termination-rights', selectCards(reviewDeal, isTerminationRight), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { terminationRightsConfig };
