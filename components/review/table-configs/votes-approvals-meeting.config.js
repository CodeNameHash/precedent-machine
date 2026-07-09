import React from 'react';
import { approvalsVotesConfig } from './approvals-votes.config.js';
import { secMeetingConfig } from './sec-meeting.config.js';
import { enumLabel, formatAdjournmentLimits } from '../../../lib/sec-meeting.js';

// Rebuild target: REBUILD-SPECS.md section 9 ("Ben: really good" in the old
// site). The old deadline-pill pattern is number + [unit pill] + "after" +
// [reference pill] -- e.g. "Meeting: 30 [calendar days] after [mailing]" --
// not a flattened prose sentence. Reuses approvalsVotesConfig /
// secMeetingConfig's row-building UNCHANGED (both configs keep their own
// exports + tests, including the underlying deadline/adjournment prose
// parsing added to lib/sec-meeting.js for this rebuild); this module picks
// specific rows out of their output by id and re-renders them as the curated
// TERM | PROVISION list REBUILD-SPECS.md #9 calls for, dropping the
// generic/duplicate rows (quorum, record date, company/parent approval
// method, vote-failure termination, the old raw "meeting" text dump) that
// the pre-rebuild wrapper surfaced indiscriminately.

// Synthesizes the actual stockholder-vote standard from a definition/
// threshold sentence, so the pill reads "Majority of outstanding shares"
// (the thing that matters) instead of the full defined-term prose. Copied
// from conditions.config.js's voteStandard() (the locked exemplar for this
// approach) rather than imported -- that file's exports are the closing-
// conditions contract, and this is a small (6-line) pure function, not a
// shared primitive.
function voteStandard(def) {
  if (!def) return null;
  const t = String(def).toLowerCase();
  if (/two-?thirds|2\/3|66\s*2\/3|sixty-?six and two-?thirds/.test(t)) return 'Two-thirds of outstanding shares';
  if (/majority of (the )?(issued and )?outstanding/.test(t)) return 'Majority of outstanding shares';
  if (/majority of[^.]*(votes? cast|voting power)/.test(t)) return 'Majority of voting power';
  if (/majority/.test(t)) return 'Majority stockholder approval';
  return null;
}

function byId(rows, id) {
  return (rows || []).find((row) => row.id === id) || null;
}

// number + [unit pill] + "after" + [reference pill]. Falls back to the
// existing TruncatedWithSeeText "see text" affordance (never a raw prose
// dump) when the underlying deadline has no parseable count -- genuinely
// unparseable prose, not the common case now that lib/sec-meeting.js parses
// verbatim deadline sentences.
function deadlinePillNode(deadline, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!deadline) return null;
  if (typeof deadline.days === 'number' && deadline.unit) {
    const nodes = [
      React.createElement('span', { key: 'n', className: 'text-[12px] font-semibold text-ink' }, String(deadline.days)),
    ];
    if (PillCell) {
      nodes.push(React.createElement(PillCell, {
        key: 'unit', label: enumLabel(deadline.unit), tone: 'neutral', evidence: deadline.text || evidence, source,
      }));
    }
    if (deadline.trigger) {
      nodes.push(React.createElement('span', { key: 'after', className: 'text-[11px] text-inkFaint' }, 'after'));
      if (PillCell) {
        nodes.push(React.createElement(PillCell, {
          key: 'ref', label: enumLabel(deadline.trigger), tone: 'info', evidence: deadline.text || evidence, source,
        }));
      }
    }
    return React.createElement('div', { className: 'flex flex-wrap items-center gap-1' }, nodes);
  }
  if (!deadline.text) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: deadline.text, evidence: evidence || deadline.text, source })
    : deadline.text;
}

// [reason pill(s)][party pill]["N days total"/"N days each" pill(s)] -- e.g.
// "[Insufficient votes][Company][15 days total]".
function adjournmentPillNode(right, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!right) return null;
  const pills = [];
  if (PillCell) {
    (right.reasons || []).forEach((reason, index) => {
      const label = reason?.label || (reason?.code ? enumLabel(reason.code) : null);
      if (label) pills.push(React.createElement(PillCell, { key: `reason-${index}`, label, tone: 'warning', evidence: right.text || evidence, source }));
    });
    const partyLabel = right.party ? enumLabel(right.party) : null;
    if (partyLabel) pills.push(React.createElement(PillCell, { key: 'party', label: partyLabel, tone: 'neutral', evidence: right.text || evidence, source }));
    formatAdjournmentLimits(right).forEach((label, index) => {
      pills.push(React.createElement(PillCell, { key: `limit-${index}`, label, tone: 'info', evidence: right.text || evidence, source }));
    });
  }
  if (!pills.length) {
    if (!right.text) return null;
    return TruncatedWithSeeText
      ? React.createElement(TruncatedWithSeeText, { text: right.text, evidence: evidence || right.text, source })
      : right.text;
  }
  return React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills);
}

// Approval-definition / vote-threshold: synthesized vote-standard pill when
// the text resolves to one, else "see text" (never the raw defined-term
// sentence inline).
function voteStandardNode(text, fallbackText, ctx, evidence, source) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  const PillCell = ctx?.primitives?.PillCell;
  const std = voteStandard(text) || (fallbackText ? voteStandard(fallbackText) : null);
  const raw = text || fallbackText;
  if (std) {
    return PillCell
      ? React.createElement(PillCell, { label: std, tone: 'present', evidence: raw || evidence, source })
      : std;
  }
  if (!raw) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text: raw, evidence: evidence || raw, source })
    : raw;
}

function boolPillNode(text, ctx, evidence, source) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!text) return null;
  return PillCell
    ? React.createElement(PillCell, { label: text, tone: text === 'Yes' ? 'present' : 'neutral', evidence, source })
    : text;
}

function textNode(text, ctx, evidence, source) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!text) return null;
  return TruncatedWithSeeText
    ? React.createElement(TruncatedWithSeeText, { text, evidence: evidence || text, source })
    : text;
}

// Curated row list: Approval definition, Written consent, Vote threshold,
// Proxy filing deadline, Mailing, Meeting, Adjournment rights (one row per
// party/reason combination), Meeting control notes. Each row carries enough
// of the underlying data (not just a pre-rendered node) for the 'provision'
// column's renderCell to build the right pill shape per `kind`.
function buildRows(reviewDeal) {
  const approvalRows = approvalsVotesConfig.selectRows(reviewDeal) || [];
  const meetingRows = secMeetingConfig.selectRows(reviewDeal) || [];

  const approvalDefRow = byId(approvalRows, 'approvals-votes-approval-definition');
  const consentRow = byId(approvalRows, 'approvals-votes-written-consent-required');
  const voteThresholdRow = byId(approvalRows, 'approvals-votes-vote-threshold');
  const proxyRow = byId(meetingRows, 'sec-meeting-proxy-filing');
  const mailingRow = byId(meetingRows, 'sec-meeting-mailing');
  const meetingRow = byId(meetingRows, 'sec-meeting-meeting');
  const adjournmentRowList = meetingRows.filter((row) => row.id.startsWith('sec-meeting-adjournment-'));
  const controlRow = byId(meetingRows, 'sec-meeting-control');

  const rows = [];
  if (approvalDefRow) {
    rows.push({
      id: 'votes-approvals-meeting-approval-definition', label: 'Approval definition', kind: 'vote-standard',
      text: approvalDefRow.detail, evidence: approvalDefRow.evidence, source: approvalDefRow.source,
    });
  }
  if (consentRow) {
    rows.push({
      id: 'votes-approvals-meeting-written-consent', label: consentRow.label, kind: 'bool',
      text: consentRow.detail, evidence: consentRow.evidence, source: consentRow.source,
    });
  }
  if (voteThresholdRow) {
    // DATA GAP (flagged in the work-package report, not fixed here): the
    // voteThreshold claim on this deal is mis-routed -- its verbatim is the
    // vote-FAILURE termination condition, not a threshold description. It
    // never resolves to a vote-standard match, so this row falls back to
    // the (correct) standard already synthesized on the approval-definition
    // row rather than showing a "see text" link to unrelated prose.
    rows.push({
      id: 'votes-approvals-meeting-vote-threshold', label: 'Vote threshold', kind: 'vote-standard',
      text: voteThresholdRow.detail, fallbackText: approvalDefRow?.detail, evidence: voteThresholdRow.evidence, source: voteThresholdRow.source,
    });
  }
  if (proxyRow) {
    rows.push({
      id: 'votes-approvals-meeting-proxy-filing', label: proxyRow.label, kind: 'deadline',
      deadline: proxyRow.deadline, evidence: proxyRow.evidence, source: proxyRow.sourceCard,
    });
  }
  if (mailingRow) {
    rows.push({
      id: 'votes-approvals-meeting-mailing', label: 'Mailing', kind: 'deadline',
      deadline: mailingRow.deadline, evidence: mailingRow.evidence, source: mailingRow.sourceCard,
    });
  }
  if (meetingRow) {
    rows.push({
      id: 'votes-approvals-meeting-meeting', label: 'Meeting', kind: 'deadline',
      deadline: meetingRow.deadline, evidence: meetingRow.evidence, source: meetingRow.sourceCard,
    });
  }
  adjournmentRowList.forEach((row, index) => {
    rows.push({
      id: `votes-approvals-meeting-adjournment-${index}`, label: 'Adjournment rights', kind: 'adjournment',
      adjournment: row.adjournment, evidence: row.evidence, source: row.sourceCard,
    });
  });
  if (controlRow) {
    rows.push({
      id: 'votes-approvals-meeting-control', label: 'Meeting control notes', kind: 'text',
      text: controlRow.detail, evidence: controlRow.evidence, source: controlRow.sourceCard,
    });
  }
  return rows;
}

function renderProvisionCell(row, ctx) {
  switch (row.kind) {
    case 'bool': return boolPillNode(row.text, ctx, row.evidence, row.source);
    case 'vote-standard': return voteStandardNode(row.text, row.fallbackText, ctx, row.evidence, row.source);
    case 'deadline': return deadlinePillNode(row.deadline, ctx, row.evidence, row.source);
    case 'adjournment': return adjournmentPillNode(row.adjournment, ctx, row.evidence, row.source);
    case 'text': return textNode(row.text, ctx, row.evidence, row.source);
    default: return row.text || null;
  }
}

const votesApprovalsMeetingConfig = {
  id: 'votes-approvals-meeting',
  title: 'Votes / Approvals / SEC Filing / Meeting Requirements',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    return buildRows(reviewDeal);
  },
  columns: [
    { id: 'term', header: 'Term', width: '16rem', renderCell: (row) => row.label },
    { id: 'provision', header: 'Provision', renderCell: renderProvisionCell },
  ],
};

export { buildRows, votesApprovalsMeetingConfig };
