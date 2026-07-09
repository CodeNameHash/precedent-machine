import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['test', 'MAE test', 'Definition', ['maeTest', 'mainConcept']],
  ['limbs', 'MAE limbs', 'Definition', ['maeLimbType', 'maeLimbs']],
  ['carveouts', 'Carve-outs', 'Carve-outs', ['carveouts', 'maeCarveouts']],
  ['exceptions', 'Exceptions to carve-outs', 'Carve-outs', ['carveoutExceptions', 'maeCarveoutExceptions']],
  ['disproportionate-carveouts', 'Disproportionate-impact carve-backs', 'Carve-outs', ['disproportionateImpactCarveouts']],
  ['non-disproportionate-carveouts', 'Non-disproportionate carve-backs', 'Carve-outs', ['nonDisproportionateImpactCarveouts']],
  ['disproportionate', 'Disproportionate-impact clause', 'Exceptions', ['disproportionateImpactClause', 'disproportionalityClause']],
  ['disproportionate-scope', 'Disproportionate-impact scope', 'Exceptions', ['disproportionateImpact', 'disproportionateImpactScope']],
  ['pandemic-cyber', 'Pandemic / cyber carve-outs', 'Carve-outs', ['pandemicCarveout', 'cyberSecurityCarveout']],
  ['prevent-delay', 'Prevent / delay prong', 'Definition', ['preventDelayProng', 'maePreventDelay']],
];

function isMae(card) {
  const code = cardCode(card);
  return cardType(card) === 'MAE' || code.includes('MAE') || /material adverse effect|\bMAE\b/i.test(`${card?.short_title || ''} ${card?.defined_term || ''} ${textOf(card)}`);
}

// DEF-MAE is the actual defined-term card for "Material Adverse Effect"; a
// deal typically carries TWO of these (Company MAE, Parent MAE) that are
// otherwise indistinguishable to isMae()'s broader regex (which also nets
// e.g. a "No Target MAE" closing-condition card). Distinguish sides from
// card.defined_term / short_title ("Company Material Adverse Effect" vs
// "Parent Material Adverse Effect").
function isMaeDefinitionCard(card) {
  return cardCode(card) === 'DEF-MAE';
}

function maeSide(card) {
  const text = `${card?.defined_term || ''} ${card?.short_title || ''}`;
  if (/\bparent\b/i.test(text)) return 'Parent';
  if (/\bcompany\b/i.test(text)) return 'Company';
  return null;
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  if (Array.isArray(value)) return value.map((item) => readableValue(key, item)).filter(Boolean).join('; ');
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

// Read-view pill is the resolved value alone -- the Term column already
// names the row, so a "<Kind>: " prefix only repeated it.
function signalFor(row) {
  if (!row?.detail) return null;
  return {
    id: `${row.id}-signal`,
    label: readableValue(row.featureKey, row.value) || row.detail,
    value: row.value || row.detail,
    tone: row.kind === 'Exceptions' ? 'warning' : row.kind === 'Carve-outs' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function buildRowsForCards(cards, sidePrefix) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const rowLabel = sidePrefix ? `${sidePrefix}: ${label}` : label;
      const rowId = sidePrefix ? `${sidePrefix.toLowerCase()}-${id}` : id;
      const row = makeRow('mae-definitions', rowId, rowLabel, kind, hit);
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

// Company and Parent each get their own DEF-MAE card carrying their OWN
// carve-outs/limbs/etc. firstFeature() across the combined card list would
// let whichever side's card comes first in the array silently absorb rows
// the OTHER side also has data for (e.g. maeLimbs, present on both). Split
// into one row-set per side when a genuine two-sided split exists; fall back
// to the old single-pass behaviour for single-party MAE definitions.
function mappedMaeRows(cards) {
  const defCards = cards.filter(isMaeDefinitionCard);
  const otherCards = cards.filter((card) => !isMaeDefinitionCard(card));
  const sides = [...new Set(defCards.map(maeSide).filter(Boolean))];

  if (sides.length < 2) return buildRowsForCards(cards, null);

  return sides.flatMap((side) => {
    const sideCards = [...defCards.filter((card) => maeSide(card) === side), ...otherCards];
    return buildRowsForCards(sideCards, side);
  });
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
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { maeDefinitionsConfig, mappedMaeRows, renderDetail, renderSignals, signalFor };
