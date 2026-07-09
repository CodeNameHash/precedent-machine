import React from 'react';
import {
  buildPerShareParts,
  deriveHeadlineConsiderationType,
  headlineConsiderationLabel,
  numericDollarOnly,
} from '../table-logic.js';
import taxonomy from '../../../lib/taxonomy.js';
import { valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Consideration headline card, spec REBUILD-SPECS.md §2. Old page = a
// HEADLINE card (per-share economics + appraisal rights + a Cash/Stock/CVR
// tag) plus a SEPARATE "Employee Equity Treatment" table plus a payment-
// mechanics LINK. This config now owns ONLY the headline: every equity
// attribute (equityAwardTreatment, instrumentTreatments, instrumentVesting,
// outstandingInstruments, espp_treatment, doubleTrigger, vestingAcceleration,
// optionsCvrEarnIn, optionSpread) lives exclusively on equity-awards.config.js
// -- CONSID-EQUITY is excluded from this config's card selector below so the
// same card can never double-render its equity facts on both the headline
// and the equity table.
const CONSID_CODES = ['CONSID', 'CONSID-CVR', 'CONSID-CONVERT'];
const EQUITY_CODE = 'CONSID-EQUITY';
const EXCHANGE_CODE = 'CONSID-EXCHANGE';
const STRUCT_OFFER = 'STRUCT-OFFER';
const HEADLINE_ROW_ID = 'consideration-hero-headline';
const PER_SHARE_ROW_ID = 'consideration-hero-per-share';
const APPRAISAL_ROW_ID = 'consideration-hero-appraisalRightsAvailable';
const ROLLUP_ROW_ID = 'consideration-hero-rollup';
const OTHER_PROVISIONS_ROW_ID = 'consideration-hero-other-provisions';
// Rendered as coloured PillCell chips (not run through TruncatedWithSeeText):
// short enum/quantitative facts per the global "pills for enum/quantitative
// signals" rule. Everything else on this card stays on the existing
// TruncatedWithSeeText path (mixed-shape family -- some rows carry long
// structured-mechanics text with no pill equivalent, e.g. collar/proration).
const PILL_DETAIL_IDS = new Set([HEADLINE_ROW_ID, APPRAISAL_ROW_ID]);

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
  ['cvrMilestonePayments', 'CVR milestone payments', 'CVR'],
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
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy was stale -- it rendered `.text` whenever
// present (no label/code-first priority, no text-vs-code redundancy check),
// which is what leaked raw `{"espp":"...",...}` JSON for equityAwardTreatment
// and appended the raw code after the label for vestingAcceleration (e.g.
// "Accelerates ... : ACCEL_ELSE_DOUBLE_TRIGGER"). card-utils.js's version
// fixes both. (Both of those fields have since moved to equity-awards.config.js
// entirely -- see the header comment above -- but the import stays as the
// single source of truth for every remaining structured-value row here.)
function hasConsiderationSignal(card) {
  const code = cardCode(card);
  // Equity is owned exclusively by equity-awards.config.js. Excluded up
  // front so it can never re-enter via the regex/feature fallback below
  // (equity clauses routinely mention "consideration" and "per share").
  if (code === EQUITY_CODE) return false;
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
// Shared with the rollup: CVR max is normally read off a dedicated
// CONSID-CVR card, but several deals (Metsera included) fold the CVR max
// payment onto the SAME card as perShareAmount (CONSID-CONVERT) with no
// separate CONSID-CVR card at all -- fall back to any card's maxPayment
// feature so both shapes resolve the same computed value.
function resolveCvrMax(cards) {
  const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
  if (cvrCard) return { text: numericDollarOnly(cardFeatures(cvrCard).maxPayment), card: cvrCard };
  const hit = firstFeature(cards, 'maxPayment');
  return hit ? { text: numericDollarOnly(hit.value), card: hit.card } : { text: null, card: null };
}
function perShareParts(features, cards) {
  const perShare = valueText(features.perShareAmount) || valueText(features.cashAmount) || valueText(features.offerPrice);
  const joined = `${valueText(features.considerationType) || ''} ${cards.map(textOf).join(' ')}`;
  const hasCvr = /\bCVR\b|contingent value right/i.test(joined) || cards.some((card) => cardCode(card) === 'CONSID-CVR');
  const hasCash = Boolean(perShare) || /\bcash\b|\$\s?\d/i.test(joined);
  const cvrMax = resolveCvrMax(cards).text;
  return buildPerShareParts({ perShareText: perShare, hasCvr, hasCash, cvrMaxText: cvrMax });
}
function firstFeature(cards, key) {
  for (const card of cards) {
    const features = cardFeatures(card);
    if (valueText(features[key])) return { value: features[key], card };
  }
  return undefined;
}
// cvrMilestonePayments items ({code, label, text}) sometimes arrive with an
// empty `label` (the defined-term parse in extract.js's exhibit scan came
// back blank for that item) -- valueText() then falls back to the bare
// taxonomy code ("CVR_MILESTONE"), which reads as a raw enum error, not a
// value. cvrMilestonePayments has no taxonomy dict (taxonomyForFeatureKey
// returns null for it -- there is no CVR_MILESTONE -> friendly-label
// mapping anywhere in lib/taxonomy.js), so labelForCode is tried first for
// forward-compatibility but is expected to come back empty here; items that
// resolve to nothing better than the bare code are dropped rather than
// rendered. If every item on the card is code-only, the whole row is
// dropped -- a bare code adds nothing.
function meaningfulCvrMilestones(value) {
  const items = Array.isArray(value) ? value : [value];
  const dict = taxonomyForFeatureKey('cvrMilestonePayments');
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return Boolean(valueText(item));
    const code = item.code || null;
    const resolved = item.label || (code && dict && labelForCode(String(code), dict)) || null;
    return Boolean(resolved) && resolved !== code;
  });
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

// IMPROVEMENT (spec §2): a computed rollup pill showing the maximum
// per-share value a holder could receive (base cash/stock consideration +
// the CVR's maximum contingent payment), e.g. "Up to $70.00 / share" for
// Metsera's $47.50 cash + up to $22.50 CVR. Only renders when BOTH amounts
// resolve to real numbers -- never fabricates a total from a partial figure.
function parseDollarNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const inner = typeof raw === 'object' ? (raw.value ?? raw.text ?? raw.label) : raw;
  if (inner === null || inner === undefined || inner === '') return null;
  const digits = String(inner).replace(/[^0-9.\-]/g, '');
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}
function rollupRow(cards) {
  const perShareHit = firstFeature(cards, 'perShareAmount') || firstFeature(cards, 'cashAmount');
  const { text: cvrMaxText, card: cvrMaxCard } = resolveCvrMax(cards);
  const perShareNum = perShareHit ? parseDollarNumber(perShareHit.value) : null;
  const cvrMaxNum = parseDollarNumber(cvrMaxText);
  if (perShareNum === null || cvrMaxNum === null) return null;
  const total = perShareNum + cvrMaxNum;
  const evidence = [perShareHit?.card, cvrMaxCard].filter(Boolean).map(textOf).filter(Boolean).join(' ');
  return {
    id: ROLLUP_ROW_ID,
    label: 'Maximum consideration (cash + CVR)',
    kind: 'Computed',
    detail: `Up to $${total.toFixed(2)} / share`,
    isRollup: true,
    evidence,
    present: true,
  };
}

// "Other provisions in this section" (spec §2): payment/exchange mechanics
// is a LINK off the CONSID-EXCHANGE card, never a "Yes" boolean row --
// structure-mechanics.config.js deliberately dropped that row entirely on
// the same basis (see its header comment).
function otherProvisionsRow(exchangeCard) {
  if (!exchangeCard) return null;
  return {
    id: OTHER_PROVISIONS_ROW_ID,
    label: 'Other provisions in this section',
    kind: 'Link',
    detail: 'Exchange of Certificates / Payment Mechanics',
    isLink: true,
    evidence: textOf(exchangeCard),
    sourceCard: exchangeCard,
    present: true,
  };
}

function renderPillDetail(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return row.detail;
  const tone = row.id === APPRAISAL_ROW_ID ? (row.detail === 'Yes' ? 'present' : 'missing') : 'neutral';
  return React.createElement(PillCell, { label: row.detail, tone, evidence: row.evidence });
}

// Per-share row: the pattern the DESIGN-REFERENCE / spec both call for --
// "[$47.50 in cash] + [1 CVR (up to $22.50)]" as distinct pills joined by a
// plain "+", not one flattened string. row.parts (attached in selectRows)
// carries buildPerShareParts' own pill/plus split so this stays a pure
// render of already-computed data.
function renderPerShareDetail(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell || !Array.isArray(row.parts) || !row.parts.length) return row.detail;
  return React.createElement(
    'span',
    { className: 'inline-flex flex-wrap items-center gap-1' },
    row.parts.map((part, index) => (
      part.type === 'plus'
        ? React.createElement('span', { key: `plus-${index}`, className: 'text-[11px] text-inkFaint' }, part.text)
        : React.createElement(PillCell, { key: `pill-${index}`, label: part.text, tone: 'present', evidence: row.evidence })
    )),
  );
}

function renderRollupDetail(row, ctx) {
  const ComputedRollupHeader = ctx?.primitives?.ComputedRollupHeader;
  if (ComputedRollupHeader) {
    return React.createElement(ComputedRollupHeader, { label: 'Computed maximum', value: row.detail, evidence: row.evidence, tone: 'info' });
  }
  const PillCell = ctx?.primitives?.PillCell;
  if (PillCell) return React.createElement(PillCell, { label: row.detail, tone: 'info', evidence: row.evidence });
  return row.detail;
}

// Link, not a "Yes" pill: EvidenceHoverSource is the existing lightweight
// hover affordance (reused, not a new primitive) so the link still surfaces
// the CONSID-EXCHANGE card's evidence on hover; the anchor itself has no
// real target in this schema-driven layout (there is no separate payment-
// mechanics section to scroll to), so its click is a no-op -- the value is
// naming the other provision and its evidence, matching the old page's
// "Other provisions in this section" line.
function renderLinkDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  const linkNode = React.createElement(
    'a',
    {
      href: '#',
      onClick: (event) => event.preventDefault(),
      className: 'inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800',
    },
    row.detail,
    React.createElement('span', { 'aria-hidden': 'true' }, '→'),
  );
  if (!EvidenceHoverSource) return linkNode;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, linkNode);
}

function renderDetail(row, ctx) {
  if (row.isLink) return renderLinkDetail(row, ctx);
  if (row.isRollup) return renderRollupDetail(row, ctx);
  if (row.id === PER_SHARE_ROW_ID && Array.isArray(row.parts)) return renderPerShareDetail(row, ctx);
  if (PILL_DETAIL_IDS.has(row.id)) return renderPillDetail(row, ctx);
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!TruncatedWithSeeText) return row.detail;
  return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence });
}

const considerationHeroConfig = {
  id: 'consideration-hero',
  title: 'Consideration',
  layoutSlot: 'consideration',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    const cards = allCards.filter(hasConsiderationSignal);
    const exchangeCard = allCards.find((card) => cardCode(card) === EXCHANGE_CODE);
    if (!cards.length && !exchangeCard) return [];
    const featuresList = cards.map(cardFeatures);
    const headlineType = deriveHeadlineConsiderationType(featuresList);
    const headline = headlineLabel(headlineType, cards, featuresList) || valueText(firstFeature(cards, 'considerationType')?.value);
    const rows = [];
    if (headline) rows.push(makeRow('headline', 'Consideration type', 'Summary', headline, cards[0]));

    const parts = perShareParts(featuresList.reduce((acc, features) => ({ ...acc, ...features }), {}), cards);
    const perShareText = parts.map((part) => part.text).join(' ');
    if (perShareText) {
      const row = makeRow('per-share', 'Per-share consideration', 'Economics', perShareText, cards[0]);
      if (row) {
        row.parts = parts;
        rows.push(row);
      }
    }

    const rollup = rollupRow(cards);
    if (rollup) rows.push(rollup);

    for (const [key, label, kind] of DIRECT_ROWS) {
      const hit = firstFeature(cards, key);
      if (!hit) continue;
      if (key === 'cvrMilestonePayments') {
        const items = meaningfulCvrMilestones(hit.value);
        if (items.length) rows.push(makeRow(key, label, kind, items, hit.card));
        continue;
      }
      rows.push(makeRow(key, label, kind, hit.value, hit.card));
    }
    const cvrCard = cards.find((card) => cardCode(card) === 'CONSID-CVR');
    if (cvrCard) {
      for (const [key, label] of CVR_ROWS) {
        rows.push(makeRow(`cvr-${key}`, label, 'CVR', cardFeatures(cvrCard)[key], cvrCard));
      }
    }

    const otherProvisions = otherProvisionsRow(exchangeCard);
    if (otherProvisions) rows.push(otherProvisions);

    return rows.filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { considerationHeroConfig, renderDetail };
