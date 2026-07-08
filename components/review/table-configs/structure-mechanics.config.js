import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, labelOf, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['deal-structure', 'Deal structure', 'Transaction form', ['dealStructure']],
  ['merger-form', 'Merger form', 'Transaction form', ['mergerForm']],
  ['surviving-entity', 'Surviving entity', 'Merger mechanics', ['survivingEntity']],
  ['closing-location', 'Closing location', 'Closing', ['closingLocation']],
  ['closing-timing', 'Closing timing', 'Closing', ['closingTimingProvisions', 'closingTiming', 'closingDeadline']],
  ['effective-time', 'Effective time', 'Closing', ['effectiveTimeShort', 'effectiveTime', 'mainConcept']],
  ['effects', 'Effects of merger', 'Merger mechanics', ['effectsOfMergerReference']],
  ['section-251h', 'DGCL 251(h) / back-end merger', 'Tender offer', ['section251h', 'backendMergerMechanic']],
  ['short-form', 'Short-form / 90% mechanic', 'Tender offer', ['shortFormMergerMechanic']],
  ['board-designation', 'Post-acceptance board designation', 'Tender offer', ['buyerBoardDesignation']],
  ['charter-bylaws', 'Charter / bylaws at close', 'Governance', ['certificateOfIncorporation', 'bylaws', 'governanceAtEffectiveTime']],
  ['directors-officers', 'Directors / officers at close', 'Governance', ['directorsAtEffectiveTime', 'officersAtEffectiveTime']],
  ['payment-agent', 'Payment / exchange mechanics', 'Consideration mechanics', ['paymentAgent', 'exchangeProcedures', 'lostCertificates', 'appraisalRightsAvailable']],
];

// Employee Equity-Award per-instrument table (Metsera parity gap root cause
// 4): outstandingInstruments / instrumentTreatments / instrumentVesting are
// parallel lists on the same CONSID-EQUITY card, but the claims layer stores
// each list item as its own claim row with no positional linkage back to the
// other two lists (see claims-adapter.js buildAttributeValue — claim order is
// id-lexicographic, not extraction order). Rather than fabricate a false
// per-instrument pairing, each list renders as its own set of per-claim rows
// (one row per item) so every claim stays visible and honestly labelled.
const EQUITY_LIST_ROWS = [
  ['equity-instrument', 'Outstanding instrument', 'Equity awards', ['outstandingInstruments']],
  ['equity-treatment', 'Treatment per instrument', 'Equity awards', ['instrumentTreatments']],
  ['equity-vesting', 'Vesting per instrument', 'Equity awards', ['instrumentVesting']],
];

// cutoffTreatment (e.g. ESPP contribution cutoff) lives on the same
// CONSID-EQUITY card as the instrument lists above for deals that have it
// (Skechers cross-deal parity gap; no Metsera claim).
const EQUITY_SCALAR_ROWS = [
  ['equity-cutoff', 'Award / contribution cutoff treatment', 'Equity awards', ['cutoffTreatment']],
];

function isStructure(card) {
  const code = cardCode(card);
  return cardType(card) === 'STRUCTURE_MECHANICS' || code.startsWith('STRUCT') || /merger|closing|effective time|tender offer/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function isEquityAward(card) {
  const code = cardCode(card);
  return code === 'CONSID-EQUITY' || (cardType(card) === 'CONSIDERATION' && /equity award|stock plan/i.test(`${card?.short_title || ''} ${textOf(card)}`));
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

function signalFor(row) {
  if (!row?.detail) return null;
  const labels = {
    'Transaction form': 'Form',
    'Merger mechanics': 'Mechanic',
    Closing: 'Closing',
    'Tender offer': 'Tender offer',
    Governance: 'Governance',
    'Consideration mechanics': 'Consideration',
    'Equity awards': 'Equity award',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Tender offer' ? 'warning' : row.kind === 'Transaction form' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedStructureRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('structure-mechanics', id, label, kind, hit);
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

// One row PER LIST ITEM (not per card/claim-group) for each parallel list
// (see EQUITY_LIST_ROWS comment above): claims-adapter.js reconstructs a
// list-valued attribute as a single array feature on the card, so the usual
// allFeatures()/makeRow() per-CARD pattern (representations-qualifiers.
// config.js, termination-rights.config.js) would still collapse all 3 items
// into 1 row here. Flatten the array instead so all 9 Metsera claims (3
// instruments x 3 attributes) render as distinct rows.
function equityAwardListRows(cards) {
  const rows = [];
  for (const [id, label, kind, keys] of EQUITY_LIST_ROWS) {
    for (const card of cards || []) {
      const features = cardFeatures(card);
      const matchedKey = keys.find((key) => features[key] !== undefined && features[key] !== null && features[key] !== '');
      if (!matchedKey) continue;
      const raw = features[matchedKey];
      const items = Array.isArray(raw) ? raw : [raw];
      items.forEach((item, index) => {
        const detail = valueText(item);
        if (!detail) return;
        const row = {
          id: `structure-mechanics-${id}-${card.id || 'card'}-${index}`,
          label: `${label} — ${labelOf(card)}`,
          kind,
          detail,
          evidence: textOf(card),
          source: labelOf(card),
          value: item,
          featureKey: matchedKey,
          sourceCard: card,
          present: true,
        };
        rows.push({ ...row, signals: [signalFor(row)].filter(Boolean) });
      });
    }
  }
  return rows;
}

function equityAwardScalarRows(cards) {
  return EQUITY_SCALAR_ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('structure-mechanics', id, label, kind, hit);
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
  return React.createElement(EvidenceHoverSource, { value: row.value, evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const structureMechanicsConfig = {
  id: 'structure-mechanics',
  title: 'Structure & Mechanics',
  layoutSlot: 'deal-mechanics',
  selectRows(reviewDeal) {
    const equityCards = selectCards(reviewDeal, isEquityAward);
    return [
      ...mappedStructureRows(selectCards(reviewDeal, isStructure)),
      ...equityAwardListRows(equityCards),
      ...equityAwardScalarRows(equityCards),
    ];
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '12rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { mappedStructureRows, renderDetail, renderSignals, signalFor, structureMechanicsConfig };
