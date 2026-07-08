import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['test', 'MAE test', 'Definition', ['maeTest', 'mainConcept']],
  ['limbs', 'MAE limbs', 'Definition', ['maeLimbType', 'maeLimbs']],
  ['carveouts', 'Carve-outs', 'Carve-outs', ['carveouts', 'maeCarveouts']],
  ['exceptions', 'Exceptions to carve-outs', 'Carve-outs', ['carveoutExceptions', 'maeCarveoutExceptions']],
  ['disproportionate', 'Disproportionate-impact clause', 'Exceptions', ['disproportionateImpactClause', 'disproportionalityClause']],
  ['prevent-delay', 'Prevent / delay prong', 'Definition', ['preventDelayProng', 'maePreventDelay']],
  ['target-parent', 'Target / parent split', 'Scope', ['maeParty', 'partyScope']],
];

function isMae(card) {
  const code = cardCode(card);
  return cardType(card) === 'MAE' || code.includes('MAE') || /material adverse effect|\bMAE\b/i.test(`${card?.short_title || ''} ${card?.defined_term || ''} ${textOf(card)}`);
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

function signalFor(row) {
  if (!row?.detail) return null;
  const labels = {
    Definition: 'Definition',
    'Carve-outs': 'Carve-out',
    Exceptions: 'Exception',
    Scope: 'Scope',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Exceptions' ? 'warning' : row.kind === 'Carve-outs' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedMaeRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('mae-definitions', id, label, kind, hit);
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

const maeDefinitionsConfig = {
  id: 'mae-definitions',
  title: 'Material Adverse Effect',
  layoutSlot: 'mae',
  selectRows(reviewDeal) {
    return mappedMaeRows(selectCards(reviewDeal, isMae));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { maeDefinitionsConfig, mappedMaeRows, renderDetail, renderSignals, signalFor };
