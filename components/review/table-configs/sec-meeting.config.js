import React from 'react';
import {
  deriveSecMeetingSummary,
  enumLabel,
  formatAdjournmentLimits,
  formatDeadline,
} from '../../../lib/sec-meeting.js';
import { valueText } from './card-utils.js';

const DIRECT_ROWS = [
  ['offerCommencementDeadline', 'Offer commencement'],
  ['scheduleTOFiling', 'Schedule TO / offer documents'],
  ['schedule14D9Filing', 'Schedule 14D-9'],
  ['stockholderListCovenant', 'Stockholder list / holder communications'],
  ['tenderOfferMinimumCondition', 'Tender-offer minimum condition'],
  ['acceptanceAndPaymentMechanics', 'Acceptance / payment'],
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy read `.text` before `.label`/`.code` (no
// redundancy check) and also fell back to formatDeadline(value) for a bare
// deadline-shaped object with no label/code/text. DIRECT_ROWS keys are all
// schema `string`-typed in practice, so that formatDeadline fallback was
// dead code here; deadline rows (proxy/mailing/meeting) format via
// formatDeadline() directly in deadlineRow(), not through valueText.
function pseudoProvision(card) {
  const features = cardFeatures(card);
  return { ...card, code: cardCode(card), category: card?.short_title, ai_metadata: { code: cardCode(card), features } };
}
function firstFeature(cards, key) {
  for (const card of cards) {
    const text = valueText(cardFeatures(card)[key]);
    if (text) return { text, card };
  }
  return null;
}
function hasSecSignal(card) {
  const code = cardCode(card);
  if (['COV-PROXY', 'COV-MEETING', 'STRUCT-OFFER'].includes(code)) return true;
  const features = cardFeatures(card);
  if (DIRECT_ROWS.some(([key]) => valueText(features[key]))) return true;
  if (['proxyFilingDeadline', 'mailingDeadline', 'meetingDeadline', 'adjournmentRights', 'meetingControlNotes'].some((key) => valueText(features[key]))) return true;
  return /proxy|stockholder|shareholder|Schedule\s+(?:TO|14D-9)|tender\s+offer|adjourn/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function deadlineRow(id, label, deadline) {
  if (!deadline) return null;
  const row = { id: `sec-meeting-${id}`, label, subject: 'Proxy / meeting', detail: formatDeadline(deadline), evidence: deadline.text || formatDeadline(deadline), present: true };
  return withSignal(row);
}
function adjournmentRows(rights) {
  return (rights || []).map((right, idx) => {
    const reasons = (right.reasons || []).map((reason) => valueText(reason)).filter(Boolean).join('; ');
    const limits = formatAdjournmentLimits(right).join('; ');
    return withSignal({
      id: `sec-meeting-adjournment-${idx}`,
      label: 'Adjournment rights',
      subject: right.party ? enumLabel(right.party) : 'Meeting',
      detail: [reasons, limits, right.text].filter(Boolean).join('\n'),
      evidence: right.text || reasons || limits,
      present: true,
    });
  });
}
function directRows(cards) {
  const rows = [];
  for (const [key, label] of DIRECT_ROWS) {
    const hit = firstFeature(cards, key);
    if (!hit) continue;
    rows.push(withSignal({
      id: `sec-meeting-${key}`,
      label,
      subject: key === 'tenderOfferMinimumCondition' ? 'Condition' : 'SEC / offer',
      detail: hit.text,
      evidence: textOf(hit.card),
      sourceCard: hit.card,
      present: true,
    }));
  }
  return rows;
}
function signalFor(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: `${row.subject}: ${row.detail}`,
    value: row.detail,
    tone: row.subject === 'Condition' ? 'warning' : row.subject === 'Proxy / meeting' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}
function withSignal(row) {
  return { ...row, signals: [signalFor(row)].filter(Boolean) };
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
  return React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const secMeetingConfig = {
  id: 'sec-meeting',
  title: 'Shareholder Meeting / Proxy / Tender-Offer SEC Matters',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasSecSignal);
    if (!cards.length) return [];
    const summary = deriveSecMeetingSummary(cards.map(pseudoProvision));
    return [
      deadlineRow('proxy-filing', summary.proxyFilingDeadline?.term || 'Proxy filing deadline', summary.proxyFilingDeadline),
      deadlineRow('mailing', summary.mailingDeadline?.term || 'Proxy mailing', summary.mailingDeadline),
      deadlineRow('meeting', summary.meetingDeadline?.term || 'Shareholder meeting', summary.meetingDeadline),
      ...adjournmentRows(summary.adjournmentRights),
      summary.meetingControlNotes ? withSignal({ id: 'sec-meeting-control', label: 'Meeting control notes', subject: 'Meeting', detail: summary.meetingControlNotes, evidence: summary.meetingControlNotes, present: true }) : null,
      ...directRows(cards),
    ].filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'subject', header: 'Subject', width: '12rem', renderCell: (row) => row.subject },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { renderDetail, renderSignals, secMeetingConfig, signalFor };
