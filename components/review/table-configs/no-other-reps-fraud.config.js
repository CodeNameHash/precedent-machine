import { deriveAbrySummary } from '../../../lib/abry.js';
import { valueText } from './card-utils.js';

const ABRY_CODES = ['MISC-ENTIRE', 'REP-T-NOREP', 'REP-B-NOREP', 'REP-B-ANTIRELIANCE'];
const FEATURE_KEYS = [
  'noOtherRepsPresent',
  'noOtherRepsParty',
  'nonRelianceClause',
  'extraContractualClaimsWaived',
  'fraudCarveout',
  'willfulBreachDefinition',
];
const QUESTIONS = [
  ['q1', 'Buyer non-reliance', 'Non-reliance'],
  ['q2', 'Seller no-other-reps', 'No-other-reps'],
  ['q3', 'Seller non-reliance', 'Non-reliance'],
  ['q4', 'Buyer no-other-reps', 'No-other-reps'],
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
// locally: this config's own copy read `.text` before `.label`/`.code` with
// no redundancy check, so it could leak a raw canonical code or double up
// text that already matched the label. card-utils.js's version prioritizes
// label/code and suppresses a `.text` that's a literal echo.
function pseudoProvision(card) {
  const features = cardFeatures(card);
  return { ...card, code: cardCode(card), category: card?.short_title, ai_metadata: { code: cardCode(card), features } };
}
function hasAbrySignal(card) {
  if (ABRY_CODES.includes(cardCode(card))) return true;
  const features = cardFeatures(card);
  if (FEATURE_KEYS.some((key) => valueText(features[key]))) return true;
  return /no\s+other\s+reps?|non[-\s]?reliance|extra-contractual|fraud|willful\s+breach/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function quoteOrDetail(entry) {
  if (!entry || entry.status !== 'yes') return 'Not present';
  return [entry.scope ? `Scope: ${entry.scope}` : null, entry.quote || 'Present'].filter(Boolean).join('\n');
}
function questionRow(key, label, kind, entry) {
  const present = entry?.status === 'yes';
  return {
    id: `no-other-reps-fraud-${key}`,
    label,
    kind,
    status: present ? 'Present' : 'Not present',
    detail: quoteOrDetail(entry),
    evidence: present ? entry.quote || '' : '',
    present,
  };
}
function fraudRow(fraud) {
  const present = fraud?.status === 'present';
  return {
    id: 'no-other-reps-fraud-fraud',
    label: 'Fraud carve-out',
    kind: 'Fraud',
    status: present ? 'Present' : 'Silent',
    detail: present ? fraud.quote : 'Silent on fraud',
    evidence: present ? fraud.quote : '',
    present: true,
  };
}
function willfulBreachRow(willfulBreach) {
  if (willfulBreach?.status !== 'defined') return null;
  return {
    id: 'no-other-reps-fraud-willful-breach',
    label: 'Willful breach definition',
    kind: 'Willful breach',
    status: 'Defined',
    detail: willfulBreach.quote,
    evidence: willfulBreach.quote,
    present: true,
  };
}

const noOtherRepsFraudConfig = {
  id: 'no-other-reps-fraud',
  title: 'No Other Reps / Fraud',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasAbrySignal);
    if (!cards.length) return [];
    const summary = deriveAbrySummary(cards.map(pseudoProvision));
    return [
      ...QUESTIONS.map(([key, label, kind]) => questionRow(key, label, kind, summary[key])),
      fraudRow(summary.fraud),
      willfulBreachRow(summary.willfulBreach),
    ].filter(Boolean);
  },
  columns: [
    { id: 'question', header: 'Question', width: '18rem', renderCell: (row) => row.label },
    { id: 'status', header: 'Status', width: '8rem', renderCell: (row) => row.status },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
};

export { noOtherRepsFraudConfig };
