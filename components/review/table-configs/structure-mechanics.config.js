import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['deal-structure', 'Deal structure', 'Transaction form', ['dealStructure']],
  ['merger-form', 'Merger form', 'Transaction form', ['mergerForm']],
  ['surviving-entity', 'Surviving entity', 'Merger mechanics', ['survivingEntity']],
  ['closing-location', 'Closing location', 'Closing', ['closingLocation']],
  ['closing-timing', 'Closing timing', 'Closing', ['closingTiming', 'closingDeadline']],
  ['effective-time', 'Effective time', 'Closing', ['effectiveTimeShort', 'effectiveTime', 'mainConcept']],
  ['effects', 'Effects of merger', 'Merger mechanics', ['effectsOfMergerReference']],
  ['section-251h', 'DGCL 251(h) / back-end merger', 'Tender offer', ['section251h', 'backendMergerMechanic']],
  ['short-form', 'Short-form / 90% mechanic', 'Tender offer', ['shortFormMergerMechanic']],
  ['board-designation', 'Post-acceptance board designation', 'Tender offer', ['buyerBoardDesignation']],
  ['charter-bylaws', 'Charter / bylaws at close', 'Governance', ['certificateOfIncorporation', 'bylaws', 'governanceAtEffectiveTime']],
  ['directors-officers', 'Directors / officers at close', 'Governance', ['directorsAtEffectiveTime', 'officersAtEffectiveTime']],
  ['payment-agent', 'Payment / exchange mechanics', 'Consideration mechanics', ['paymentAgent', 'exchangeProcedures', 'lostCertificates', 'appraisalRightsAvailable']],
];

function isStructure(card) {
  const code = cardCode(card);
  return cardType(card) === 'STRUCTURE_MECHANICS' || code.startsWith('STRUCT') || /merger|closing|effective time|tender offer/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
    return mappedStructureRows(selectCards(reviewDeal, isStructure));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '12rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { mappedStructureRows, renderDetail, renderSignals, signalFor, structureMechanicsConfig };
