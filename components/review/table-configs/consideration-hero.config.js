import React from 'react';
import {
  buildPerShareParts,
  deriveHeadlineConsiderationType,
  headlineConsiderationLabel,
  numericDollarOnly,
} from '../table-logic.js';

const CONSID_CODES = ['CONSID', 'CONSID-CVR', 'CONSID-EQUITY'];
const STRUCT_OFFER = 'STRUCT-OFFER';
const DIRECT_ROWS = [
  ['exchangeRatio', 'Exchange ratio', 'Stock'],
  ['exchangeRatioText', 'Exchange-ratio formula', 'Stock'],
  ['offerConsideration', 'Offer consideration', 'Tender offer'],
  ['offerPrice', 'Offer price', 'Tender offer'],
  ['prorationMechanics', 'Proration / election mechanics', 'Election'],
  ['electionMechanics', 'Election mechanics', 'Election'],
  ['collar', 'Collar', 'Stock'],
  ['walkAwayRight', 'Walk-away right', 'Stock'],
  ['appraisalRightsAvailable', 'Appraisal rights', 'Rights'],
  ['withholdingProvision', 'Withholding', 'Mechanics'],
  ['equityAwardTreatment', 'Equity-award treatment', 'Awards'],
  ['vestingAcceleration', 'Vesting acceleration', 'Awards'],
];
const CVR_ROWS = [
  ['triggers', 'CVR triggers'],
  ['maxPayment', 'CVR maximum payment'],
  ['term', 'CVR term'],
  ['transferable', 'CVR transferable'],
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
  if (typeof value === 'object') {
    if (value.value !== undefined) return valueText(value.value);
    if (value.text || value.label || value.code) return [value.label || value.code, value.text].filter(Boolean).join(': ');
    return Object.entries(value).map(([key, val]) => `${key}: ${valueText(val)}`).filter((part) => !part.endsWith(': null')).join('; ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
function hasConsiderationSignal(card) {
  const code = cardCode(card);
  if (CONSID_CODES.includes(code) || code === STRUCT_OFFER) return true;
  const features = cardFeatures(card);
  if (['considerationType', 'perShareAmount', 'cashAmount', 'exchangeRatio', 'offerConsideration', 'offerPrice'].some((key) => valueText(features[key]))) return true;
  return /\bconsideration|per share|exchange ratio|CVR|offer price/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function makeRow(id, label, kind, value, card) {
  const detail = valueText(value);
  if (!detail) return null;
  return { id: `consideration-hero-${id}`, label, kind, detail, evidence: textOf(card), present: true };
}
function perShareDetail(features, cards) {
  const perShare = valueText(features.perShareAmount) || valueText(features.cashAmount) || valueText(features.offerPrice);
  const joined = `${valueText(features.considerationType) || ''} ${cards.map(textOf).join(' ')}`;
  const hasCvr = /\bCVR\b|contingent value right/i.test(joined) || cards.some((card) => cardCode(card) === 'CONSID-CVR');
  const hasCash = Boolean(perShare) || /\bcash\b|\$\s?\d/i.test(joined);
  const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
  const cvrMax = cvrCard ? numericDollarOnly(cardFeatures(cvrCard).maxPayment) : null;
  const parts = buildPerShareParts({ perShareText: perShare, hasCvr, hasCash, cvrMaxText: cvrMax });
  return parts.map((part) => part.text).join(' ');
}
function firstFeature(cards, key) {
  for (const card of cards) {
    const features = cardFeatures(card);
    if (valueText(features[key])) return { value: features[key], card };
  }
  return null;
}
function hasCvrSignal(cards) {
  return cards.some((card) => cardCode(card) === 'CONSID-CVR' || /\bCVR\b|contingent value right/i.test(`${valueText(cardFeatures(card).considerationType) || ''} ${textOf(card)}`));
}
function headlineLabel(headlineType, cards, featuresList) {
  if (hasCvrSignal(cards)) {
    if (headlineType === 'CASH') return 'Cash + CVR';
    if (headlineType === 'STOCK') return 'Stock + CVR';
    if (headlineType === 'MIXED') return 'Mixed + CVR';
  }
  return headlineConsiderationLabel(headlineType, featuresList);
}

// equityAwardTreatment and similar structured attributes fall through
// valueText()'s "no code/label" branch as a semicolon-joined dump of every
// field (espp/stockOptions/restrictedStock etc.) — the only place that value
// is shown at all, so truncate per-cell rather than hide the column.
function renderDetail(row, ctx) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!TruncatedWithSeeText) return row.detail;
  return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence });
}

const considerationHeroConfig = {
  id: 'consideration-hero',
  title: 'Consideration',
  layoutSlot: 'consideration',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasConsiderationSignal);
    if (!cards.length) return [];
    const featuresList = cards.map(cardFeatures);
    const headlineType = deriveHeadlineConsiderationType(featuresList);
    const headline = headlineLabel(headlineType, cards, featuresList) || valueText(firstFeature(cards, 'considerationType')?.value);
    const rows = [];
    if (headline) rows.push(makeRow('headline', 'Headline form', 'Summary', headline, cards[0]));
    const perShare = perShareDetail(featuresList.reduce((acc, features) => ({ ...acc, ...features }), {}), cards);
    if (perShare) rows.push(makeRow('per-share', 'Per-share / offer price', 'Economics', perShare, cards[0]));
    for (const [key, label, kind] of DIRECT_ROWS) {
      const hit = firstFeature(cards, key);
      if (hit) rows.push(makeRow(key, label, kind, hit.value, hit.card));
    }
    const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
    if (cvrCard) {
      for (const [key, label] of CVR_ROWS) {
        rows.push(makeRow(`cvr-${key}`, label, 'CVR', cardFeatures(cvrCard)[key], cvrCard));
      }
    }
    return rows.filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { considerationHeroConfig, renderDetail };
