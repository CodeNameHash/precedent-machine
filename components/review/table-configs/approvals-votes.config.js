import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// NOTE on quorumRequirement / dualClassTreatment / recordDate: the per-family
// spec (docs/audit/m2-09-per-family-plan.md, "Approvals / Votes") lists these
// as required augmentations, but lib/rubric.js has no field under any of
// these names (or the pre-existing quorum/meetingRecordDate fallback keys
// below) — verified by grepping the full rubric. They render defensively:
// the rows below simply never resolve a hit for them today rather than
// fabricating a value. If a future schema version adds a matching field
// under one of these keys, the row appears automatically.
const ROWS = [
  ['company-method', 'Company approval method', 'Approval', ['shareholderApprovalMethodCompany', 'companyApprovalMethod']],
  ['parent-method', 'Parent approval method', 'Approval', ['shareholderApprovalMethodParent', 'parentApprovalMethod']],
  ['approval-definition', 'Approval definition', 'Approval', ['approvalDefinition', 'stockholderApprovalDefinition']],
  ['vote-threshold', 'Vote threshold', 'Vote', ['voteThreshold', 'requiredVote']],
  ['dual-class', 'Dual-class treatment', 'Vote', ['dualClassTreatment']],
  ['quorum', 'Quorum requirement', 'Meeting', ['quorumRequirement', 'quorum']],
  ['record-date', 'Record date', 'Meeting', ['recordDate', 'meetingRecordDate']],
  ['meeting', 'Meeting timing', 'Meeting', ['meetingDeadline', 'stockholderMeetingDeadline']],
  ['vote-failure', 'Vote-failure termination', 'Termination', ['shareholderApprovalFailure', 'voteFailureTermination']],
];

function isApproval(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'CLOSING_CONDITION' || type === 'STRUCTURE_MECHANICS' || type === 'SEC_FILING_MEETING' || code.includes('VOTE') || /stockholder|shareholder|approval|vote|meeting/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

function signalFor(row) {
  if (!row?.detail) return null;
  const labels = {
    Approval: 'Approval',
    Vote: 'Vote',
    Meeting: 'Meeting',
    Termination: 'Termination',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Termination' ? 'warning' : row.kind === 'Vote' ? 'present' : 'info',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedApprovalsRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('approvals-votes', id, label, kind, hit);
      if (!row) return null;
      return {
        ...row,
        value: hit.value,
        featureKey: hit.key,
        sourceCard: hit.card,
        signals: [signalFor({ ...row, value: hit.value, featureKey: hit.key, sourceCard: hit.card })].filter(Boolean),
      };
    })
    .filter(Boolean);
}

// adjournmentRights is a real rubric field (COV-PROXY / COV-MEETING) shaped
// as one entry PER PARTY that can force an adjournment, each carrying its
// own array of reason codes plus numeric limits — exactly the "related
// variants in one analytical surface" case the per-family spec calls out
// for GroupedSubRows, so each party's entry becomes a group and each reason
// becomes a subrow (falling back to a single "Limits" subrow when a right
// has numeric caps but no enumerated reasons).
function adjournmentGroups(cards) {
  const groups = [];
  cards.forEach((card, cardIdx) => {
    const rights = cardFeatures(card).adjournmentRights;
    if (!Array.isArray(rights)) return;
    rights.forEach((right, rightIdx) => {
      if (!right || typeof right !== 'object') return;
      const party = right.party ? String(right.party) : 'MEETING';
      const reasons = Array.isArray(right.reasons) ? right.reasons : [];
      const subRows = reasons.map((reason, reasonIdx) => ({
        id: `approvals-votes-adjournment-${cardIdx}-${rightIdx}-${reasonIdx}`,
        label: (reason && (reason.label || reason.code)) || `Reason ${reasonIdx + 1}`,
        value: reason,
        evidence: (reason && reason.text) || right.text || textOf(card),
        source: card,
      }));
      if (!subRows.length && (right.text || right.maxAdjournments || right.maxDaysTotal)) {
        subRows.push({
          id: `approvals-votes-adjournment-${cardIdx}-${rightIdx}-limits`,
          label: 'Limits',
          value: right.text || null,
          evidence: right.text || textOf(card),
          source: card,
        });
      }
      if (subRows.length) {
        groups.push({ id: `approvals-votes-adjournment-group-${cardIdx}-${rightIdx}`, label: `${party} adjournment rights`, rows: subRows });
      }
    });
  });
  return groups;
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
  const { EvidenceHoverSource, GroupedSubRows } = ctx?.primitives || {};
  if (row.groups) {
    if (!GroupedSubRows) return row.groups.map((group) => group.label).join('; ');
    return React.createElement(GroupedSubRows, { groups: row.groups, emptyCopy: 'No adjournment rights captured.' });
  }
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.value, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const approvalsVotesConfig = {
  id: 'approvals-votes',
  title: 'Approvals / Votes',
  layoutSlot: 'conditions',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isApproval);
    const rows = mappedApprovalsRows(cards);
    const groups = adjournmentGroups(cards);
    if (groups.length) {
      rows.push({
        id: 'approvals-votes-adjournment',
        label: 'Adjournment rights',
        kind: 'Meeting',
        detail: 'See grouped adjournment mechanics.',
        evidence: null,
        present: true,
        signals: [],
        groups,
      });
    }
    return rows;
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { adjournmentGroups, approvalsVotesConfig, mappedApprovalsRows, renderDetail, renderSignals, signalFor };
