import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['company-method', 'Company approval method', 'Approval', ['shareholderApprovalMethodCompany', 'companyApprovalMethod']],
  ['parent-method', 'Parent approval method', 'Approval', ['shareholderApprovalMethodParent', 'parentApprovalMethod']],
  ['approval-definition', 'Approval definition', 'Approval', ['approvalDefinition', 'stockholderApprovalDefinition']],
  ['vote-threshold', 'Vote threshold', 'Vote', ['voteThreshold', 'requiredVote']],
  ['quorum', 'Quorum', 'Meeting', ['quorumRequirement', 'quorum']],
  ['record-date', 'Record date', 'Meeting', ['recordDate', 'meetingRecordDate']],
  ['meeting', 'Meeting timing', 'Meeting', ['meetingDeadline', 'stockholderMeetingDeadline']],
  ['adjournment', 'Adjournment rights', 'Meeting', ['adjournmentRights']],
  ['vote-failure', 'Vote-failure termination', 'Termination', ['shareholderApprovalFailure', 'voteFailureTermination']],
];

function isApproval(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'CLOSING_CONDITION' || type === 'STRUCTURE_MECHANICS' || type === 'SEC_FILING_MEETING' || code.includes('VOTE') || /stockholder|shareholder|approval|vote|meeting/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

const approvalsVotesConfig = {
  id: 'approvals-votes',
  title: 'Approvals / Votes',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    return mappedRows('approvals-votes', selectCards(reviewDeal, isApproval), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { approvalsVotesConfig };
