import {
  deriveSecMeetingSummary,
  enumLabel,
  formatAdjournmentLimits,
  formatDeadline,
} from '../../../lib/sec-meeting.js';

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
function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') return value.value || value.text || value.label || value.code || formatDeadline(value) || null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
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
  return { id: `sec-meeting-${id}`, label, subject: 'Proxy / meeting', detail: formatDeadline(deadline), evidence: deadline.text || formatDeadline(deadline), present: true };
}
function adjournmentRows(rights) {
  return (rights || []).map((right, idx) => {
    const reasons = (right.reasons || []).map((reason) => valueText(reason)).filter(Boolean).join('; ');
    const limits = formatAdjournmentLimits(right).join('; ');
    return {
      id: `sec-meeting-adjournment-${idx}`,
      label: 'Adjournment rights',
      subject: right.party ? enumLabel(right.party) : 'Meeting',
      detail: [reasons, limits, right.text].filter(Boolean).join('\n'),
      evidence: right.text || reasons || limits,
      present: true,
    };
  });
}
function directRows(cards) {
  const rows = [];
  for (const [key, label] of DIRECT_ROWS) {
    const hit = firstFeature(cards, key);
    if (!hit) continue;
    rows.push({
      id: `sec-meeting-${key}`,
      label,
      subject: key === 'tenderOfferMinimumCondition' ? 'Condition' : 'SEC / offer',
      detail: hit.text,
      evidence: textOf(hit.card),
      present: true,
    });
  }
  return rows;
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
      summary.meetingControlNotes ? { id: 'sec-meeting-control', label: 'Meeting control notes', subject: 'Meeting', detail: summary.meetingControlNotes, evidence: summary.meetingControlNotes, present: true } : null,
      ...directRows(cards),
    ].filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'subject', header: 'Subject', width: '12rem', renderCell: (row) => row.subject },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { secMeetingConfig };
