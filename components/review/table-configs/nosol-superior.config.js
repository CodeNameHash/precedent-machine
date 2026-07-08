const ROWS = [
  { id: 'threshold', label: 'Superior Proposal threshold', keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], fallback: thresholdFromText },
  { id: 'test', label: 'Superior Proposal test', keys: ['superiorProposalTest'], fallback: testFromText },
  { id: 'determiner', label: 'Determiner', keys: ['superiorProposalDeterminer'], fallback: determinerFromText },
  { id: 'engage', label: 'Engagement standard', keys: ['fiduciaryEngageStandard', 'engagementStandard'], fallback: engageFromText },
  { id: 'final', label: 'Final determination standard', keys: ['fiduciaryFinalStandard', 'changeRecStandard'], fallback: finalFromText },
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
function isSuperiorCard(card) {
  const code = cardCode(card);
  if (['NOSOL-SUPERIOR', 'DEF-SUPERIOR'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /superior\s+(?:company\s+)?proposal/i.test(textOf(card)) || /superior/i.test(String(card?.short_title || ''));
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
function firstFeature(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const text = valueText(features[key]);
      if (text) return text;
    }
  }
  return null;
}
function thresholdFromText(text) {
  const match = text.match(/(\d{1,3})\s*%\s+(?:or\s+more\s+)?(?:of\s+(?:(?:the|its|Company)\s+){0,3})?(?:assets|equity|shares|stock|voting|revenues|earnings)/i);
  return match ? `${match[1]}%` : null;
}
function testFromText(text) {
  const match = text.match(/(?:more\s+favo[u]?rable|superior|greater\s+value)[^.]{0,240}/i);
  return match ? match[0].trim() : null;
}
function determinerFromText(text) {
  const match = text.match(/(?:Company\s+Board|Board|Special\s+Committee)[^.]{0,180}(?:financial advisor|outside legal counsel|good faith|determin)/i);
  return match ? match[0].trim() : null;
}
function engageFromText(text) {
  const match = text.match(/(?:constitutes|could\s+reasonably\s+be\s+expected|is\s+reasonably\s+likely)[^.]{0,160}lead\s+to\s+a\s+Superior\s+Proposal/i);
  return match ? match[0].trim() : null;
}
function finalFromText(text) {
  const match = text.match(/(?:constitutes|is|would\s+result\s+in)\s+a\s+Superior\s+Proposal/i);
  return match ? match[0].trim() : null;
}
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const detail = firstFeature(cards, spec.keys) || spec.fallback(evidence);
  if (!detail) return null;
  return {
    id: `nosol-superior-${spec.id}`,
    label: spec.label,
    party: [...new Set(cards.map(partySide))].join(', ') || 'Target / Company',
    detail,
    evidence,
    present: true,
  };
}

const nosolSuperiorConfig = {
  id: 'nosol-superior',
  title: 'Superior Proposal Definition and Standards',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isSuperiorCard);
    if (!cards.length) return [];
    return ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'party', header: 'Party', width: '12rem', renderCell: (row) => row.party },
    { id: 'detail', header: 'Detail', renderCell: (row) => row.detail },
  ],
  empty: { copy: 'No Superior Proposal mechanics found.' },
};

export { nosolSuperiorConfig };
