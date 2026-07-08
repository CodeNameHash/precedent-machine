import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['materiality', 'Materiality qualifier', 'Qualifier', ['materialityQualifier', 'materialityScopeType']],
  ['knowledge', 'Knowledge qualifier', 'Qualifier', ['knowledgeQualifier', 'knowledgeStandard', 'knowledgeScopeType']],
  ['threshold', 'Dollar threshold', 'Qualifier', ['dollarThreshold']],
  ['lookback', 'Lookback period', 'Qualifier', ['lookbackPeriod']],
  ['schedule', 'Disclosure schedule exception', 'Exceptions', ['scheduleReference', 'disclosureScheduleException']],
  ['sec-filings', 'SEC filings carve-out', 'Exceptions', ['secFilingsExceptionCarvedOutReps', 'secFilingsCarvedOutReps']],
  ['bringdown', 'Linked bring-down standard', 'Bring-down', ['linkedBringDownStandard', 'bringDownStandard']],
  ['bringdown-tiers', 'Bring-down tiers', 'Bring-down', ['bringDownTiers']],
  ['scrape', 'Materiality scrape', 'Bring-down', ['materialityScrape', 'materialityScrapeScope']],
  ['specific', 'Specific features', 'Rep-specific', ['specificFeatures']],
];

function isRepQualifier(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'REPRESENTATION' || code.startsWith('REP') || code === 'COND-B-REP' || code === 'COND-S-REP' || /representation|bring.?down|knowledge|materiality/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
    Qualifier: 'Qualifier',
    Exceptions: 'Exception',
    'Bring-down': 'Bring-down',
    'Rep-specific': 'Rep-specific',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Exceptions' ? 'warning' : row.kind === 'Bring-down' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedQualifierRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('representations-qualifiers', id, label, kind, hit);
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

const representationsQualifiersConfig = {
  id: 'representations-qualifiers',
  title: 'Representation Qualifiers',
  layoutSlot: 'reps',
  selectRows(reviewDeal) {
    return mappedQualifierRows(selectCards(reviewDeal, isRepQualifier));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { mappedQualifierRows, renderDetail, renderSignals, representationsQualifiersConfig, signalFor };
