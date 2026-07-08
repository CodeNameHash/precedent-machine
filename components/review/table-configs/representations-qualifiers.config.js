import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { allFeatures, cardCode, cardType, firstFeature, labelOf, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Per-rep families: 37 REPRESENTATION cards can each carry their OWN
// knowledgeQualifier / materialityQualifier / linkedBringDownStandard claim
// (16 / 22 / 37 claims respectively on Metsera). firstFeature() would return
// only the first card's value; these three render one row PER card instead
// (see PER_REP_ROW_IDS below).
const ROWS = [
  ['materiality', 'Materiality qualifier', 'Qualifier', ['materialityQualifier', 'materialityScopeType']],
  ['knowledge', 'Knowledge qualifier', 'Qualifier', ['knowledgeQualifier', 'knowledgeStandard', 'knowledgeScopeType']],
  ['threshold', 'Dollar threshold', 'Qualifier', ['dollarThreshold']],
  ['lookback', 'Lookback period', 'Qualifier', ['lookbackPeriod']],
  ['schedule', 'Disclosure schedule exception', 'Exceptions', ['disclosureSchedulesException', 'disclosureSchedulesRequired']],
  ['sec-filings', 'SEC filings carve-out', 'Exceptions', ['secFilingsExcludedSections', 'secFilingsExceptionScope']],
  ['bringdown', 'Linked bring-down standard', 'Bring-down', ['linkedBringDownStandard', 'bringDownStandard']],
  ['bringdown-tiers', 'Bring-down tiers', 'Bring-down', ['bringDownTiers']],
  ['scrape', 'Materiality scrape', 'Bring-down', ['materialityScrape', 'materialityScrapeLanguage', 'materialityScrapePresent']],
  ['mae-qualified', 'MAE-qualified reps', 'Qualifier', ['maeQualifiedReps']],
  ['specific', 'Specific features', 'Rep-specific', ['specificFeatures']],
  // Skechers cross-deal parity gap (PE financing solvency rep) — no config
  // read it before; REP-B-SOLVENCY is a REPRESENTATION card so it already
  // matches isRepQualifier() below.
  ['solvency', 'Solvency representation', 'Rep-specific', ['solvencyRepDetails', 'solvencyRepIncluded', 'solvencyRepPresent']],
];

const PER_REP_ROW_IDS = new Set(['materiality', 'knowledge', 'bringdown']);

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

function perRepRows(cards, id, label, kind, keys) {
  return allFeatures(cards, keys)
    .map((hit) => {
      const row = makeRow('representations-qualifiers', `${id}-${hit.card?.id || ''}`, `${label} — ${labelOf(hit.card)}`, kind, hit);
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

function mappedQualifierRows(cards) {
  const rows = [];
  for (const [id, label, kind, keys] of ROWS) {
    if (PER_REP_ROW_IDS.has(id)) {
      rows.push(...perRepRows(cards, id, label, kind, keys || id));
      continue;
    }
    const hit = firstFeature(cards, keys || id);
    const row = makeRow('representations-qualifiers', id, label, kind, hit);
    if (!row) continue;
    rows.push({
      ...row,
      value: hit.value,
      featureKey: hit.key,
      sourceCard: hit.card,
      signals: [signalFor({ ...row, value: hit.value, featureKey: hit.key, sourceCard: hit.card })].filter(Boolean),
    });
  }
  return rows;
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
