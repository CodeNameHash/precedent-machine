import React from 'react';
import { approvalsVotesConfig } from './approvals-votes.config.js';
import { secMeetingConfig } from './sec-meeting.config.js';

// Combines Votes/Approvals and SEC Filing/Meeting Requirements into ONE
// section -- both are the same shareholder-meeting/proxy/vote cluster and
// the legacy page treated them as one story. Reuses approvalsVotesConfig /
// secMeetingConfig's row-building UNCHANGED (both configs keep their own
// exports + tests); this module only reshapes how their rows are grouped
// and labelled for display, dropping the redundant Kind/Subject columns and
// the "<Kind>: " signal-label prefix (the row already names itself in the
// group's Term column).

const GROUP_SPECS = [
  { id: 'votes-approvals', label: 'Votes & Approvals', config: approvalsVotesConfig },
  { id: 'meeting-sec', label: 'Meeting / SEC Filings', config: secMeetingConfig },
];

function renderRowBody(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  const bareLabel = row.detail;
  const pill = PillCell && bareLabel
    ? React.createElement(PillCell, {
      label: bareLabel,
      value: bareLabel,
      tone: 'neutral',
      evidence: row.evidence,
      source: row.sourceCard || row.source,
    })
    : null;
  const detail = TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.sourceCard || row.source })
    : row.detail;
  return React.createElement(
    'div',
    { className: 'space-y-1' },
    pill,
    React.createElement('div', { className: 'text-inkLight' }, detail),
  );
}

function groupRow(row, ctx) {
  return {
    id: row.id,
    label: row.label,
    value: row.detail,
    evidence: row.evidence,
    source: row.sourceCard || row.source,
    children: renderRowBody(row, ctx),
  };
}

function meetingGroups(reviewDeal, ctx) {
  return GROUP_SPECS
    .map((spec) => {
      const rows = spec.config.selectRows(reviewDeal) || [];
      return { id: spec.id, label: spec.label, rows: rows.map((row) => groupRow(row, ctx)) };
    })
    .filter((group) => group.rows.length > 0);
}

const votesApprovalsMeetingConfig = {
  id: 'votes-approvals-meeting',
  title: 'Votes / Approvals / SEC Filing / Meeting Requirements',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    const hasAny = GROUP_SPECS.some((spec) => (spec.config.selectRows(reviewDeal) || []).length > 0);
    if (!hasAny) return [];
    return [{ id: 'votes-approvals-meeting-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const groups = meetingGroups(row.reviewDeal, ctx);
        return React.createElement(GroupedSubRows, { groups, emptyCopy: 'No votes, approvals, or meeting/SEC-filing requirements found.' });
      },
    },
  ],
};

export { meetingGroups, votesApprovalsMeetingConfig };
