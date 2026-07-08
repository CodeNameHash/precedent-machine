const ROWS = [
  { id: 'prohibit', label: 'No-shop / non-solicit restriction', codes: ['NOSOL-PROHIBIT'], keys: ['noShopType', 'prohibitedActions', 'mainRestriction'] },
  { id: 'cease', label: 'Cease discussions', codes: ['NOSOL-CEASE'], keys: ['ceaseDiscussionsProhibitedList', 'ceaseDiscussionsAffiliateStandard', 'ceaseDiscussionsLiability'] },
  { id: 'exceptions', label: 'No-shop exceptions', codes: ['NOSOL-EXCEPT'], keys: ['ceaseDiscussionsExceptions', 'permittedExceptions', 'fiduciaryCarveoutThreshold'] },
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function isNosolCard(card) {
  return card?.provision_type === 'COVENANT_NO_SOLICITATION' || /^NOSOL(?:-|$)/.test(cardCode(card));
}
function partySide(card) {
  const scope = String(card?.party_scope || '').toUpperCase();
  return scope === 'BUYER' || scope === 'PARENT' ? 'Buyer / Parent' : 'Target / Company';
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') return value.value || value.label || value.text || value.code || null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
function featureSummary(card, keys) {
  const features = cardFeatures(card);
  const parts = [];
  for (const key of keys) {
    const text = valueText(features[key]);
    if (text) parts.push(text);
  }
  return parts.join('\n');
}
function fallbackMatch(row, card) {
  const text = `${card?.short_title || ''} ${textOf(card)}`;
  if (row.id === 'prohibit') return /no[\s-]*shop|solicit|encourage|initiate|knowingly facilitate/i.test(text);
  if (row.id === 'cease') return /cease|terminate|discontinue/i.test(text) && /discussion|negotiation/i.test(text);
  return /except|provided|fiduciary|superior proposal/i.test(text);
}
function rowForSpec(spec, cards) {
  const matches = cards.filter((card) => spec.codes.includes(cardCode(card)) || fallbackMatch(spec, card));
  if (!matches.length) return null;
  const detail = matches
    .map((card) => featureSummary(card, spec.keys) || textOf(card))
    .filter(Boolean)
    .join('\n\n');
  const parties = [...new Set(matches.map(partySide))].join(', ');
  return {
    id: `nosol-noshop-${spec.id}`,
    label: spec.label,
    party: parties || 'Target / Company',
    detail: detail || 'Present, detail not extracted',
    evidence: matches.map(textOf).filter(Boolean).join('\n\n'),
    present: true,
  };
}

const nosolNoshopConfig = {
  id: 'nosol-noshop',
  title: 'No-Shop Core Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isNosolCard);
    if (!cards.length) return [];
    return ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'party', header: 'Party', width: '12rem', renderCell: (row) => row.party },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
  empty: { copy: 'No no-shop core mechanics found.' },
};

export { nosolNoshopConfig };
