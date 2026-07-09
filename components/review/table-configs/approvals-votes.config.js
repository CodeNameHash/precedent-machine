import React from 'react';
import { cardCode, cardType, mappedRows, selectCards, textOf } from './card-utils.js';

const ROWS = [
  ['company-method', 'Company approval method', 'Approval', ['shareholderApprovalMethodCompany', 'companyApprovalMethod']],
  ['parent-method', 'Parent approval method', 'Approval', ['shareholderApprovalMethodParent', 'parentApprovalMethod']],
  ['approval-definition', 'Approval definition', 'Approval', ['approvalDefinition', 'stockholderApprovalDefinition']],
  ['stockholder-approval-required', 'Stockholder approval required', 'Approval', ['stockholderApprovalRequired']],
  ['written-consent-required', 'Written consent required', 'Approval', ['writtenConsentRequired']],
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

// No 'signals' column here (unlike most families, ROWS is rendered straight
// via card-utils.js mappedRows/makeRow with no per-row pill), so 'detail' is
// the only place the value is visible at all — truncate per-cell and wire up
// the evidence hover makeRow() already computes but this config never used.
function renderDetail(row, ctx) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!TruncatedWithSeeText) return row.detail;
  return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence });
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
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { approvalsVotesConfig, renderDetail };
