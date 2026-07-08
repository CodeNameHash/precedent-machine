import { normalizeTermfFeatures } from '../../../lib/termf.js';

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function isTermfCard(card) {
  return card?.provision_type === 'TERMINATION_FEE' || /^TERMF(?:-|$)/.test(cardCode(card));
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function scalar(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value.value ?? value.text ?? value.label ?? value.code ?? null;
  return value;
}
function combineFeatures(cards) {
  let combined = {};
  for (const card of cards) combined = { ...combined, ...normalizeTermfFeatures(cardFeatures(card)) };
  return combined;
}
function sourceCard(cards, features) {
  return cards.find((card) => cardCode(card) === 'TERMF-TAIL') ||
    cards.find((card) => Object.keys(normalizeTermfFeatures(cardFeatures(card))).some((key) => key.startsWith('tailFee'))) ||
    cards.find((card) => /tail|within\s+\d+\s+months|takeover\s+proposal/i.test(textOf(card)));
}
function fallbackFromText(card) {
  const text = textOf(card);
  if (!text) return {};
  const window = text.match(/within\s+(\d+)\s+months?/i);
  const threshold = text.match(/(\d{1,3})\s*%\s+(?:or\s+more\s+)?(?:of\s+(?:the|its)\s+)?(?:equity|stock|shares|assets|voting)/i);
  return {
    tailFeeWindowMonths: window ? window[1] : null,
    tailFeeThresholdPct: threshold ? threshold[1] : null,
    tailFeeActivatingClauses: /takeover|acquisition|alternative\s+transaction|superior\s+proposal/i.test(text) ? [text] : [],
  };
}
function formatWindow(value) {
  const inner = scalar(value);
  if (inner === null) return 'Not specified';
  return /^\d+(\.\d+)?$/.test(String(inner).trim()) ? `${inner} months` : String(inner);
}
function formatPct(value) {
  const inner = scalar(value);
  if (inner === null) return 'Not specified';
  return /^\d+(\.\d+)?$/.test(String(inner).trim()) ? `${inner}%` : String(inner);
}
function formatBool(value) {
  const inner = scalar(value);
  if (inner === true || inner === 'true' || inner === 'yes') return 'Same proposal required';
  if (inner === false || inner === 'false' || inner === 'no') return 'Any later qualifying proposal can trigger';
  return inner === null ? 'Not specified' : String(inner);
}
function formatClauses(value) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!list.length) return 'Not specified';
  return list.map((item) => String(scalar(item) || item).trim()).filter(Boolean).join('\n\n');
}

const tailFeeConfig = {
  id: 'tail-fee',
  title: 'Tail Fee Mechanics',
  layoutSlot: 'termination-fees',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isTermfCard);
    if (!cards.length) return [];
    const source = sourceCard(cards, {});
    const features = { ...fallbackFromText(source), ...combineFeatures(cards) };
    const hasTail = [
      features.tailFeeWindowMonths,
      features.tailFeeThresholdPct,
      ...(Array.isArray(features.tailFeeActivatingClauses) ? features.tailFeeActivatingClauses : []),
      features.tailFeeSameProposalRequired,
    ].some((value) => value !== null && value !== undefined && value !== '');
    if (!hasTail) return [];
    return [
      { id: 'tail-window', label: 'Tail window', value: formatWindow(features.tailFeeWindowMonths), evidence: textOf(source), present: true },
      { id: 'tail-threshold', label: 'Threshold % for Company Takeover Proposal', value: formatPct(features.tailFeeThresholdPct), evidence: textOf(source), present: true },
      { id: 'tail-arming', label: 'Termination scenarios that arm the tail', value: formatClauses(features.tailFeeActivatingClauses), evidence: textOf(source), present: true },
      { id: 'tail-same-proposal', label: 'Triggering proposal', value: formatBool(features.tailFeeSameProposalRequired), evidence: textOf(source), present: true },
    ];
  },
  columns: [
    { id: 'term', header: 'Term', width: '20rem', renderCell: (row) => row.label },
    { id: 'value', header: 'Mechanic', renderCell: (row) => row.value },
    { id: 'evidence', header: 'Evidence', renderCell: (row) => row.evidence },
  ],
  empty: { copy: 'No tail-fee mechanics found.' },
};

export { tailFeeConfig };
