import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['party', 'Party who can terminate', 'Right', ['partyWhoCanTerminate']],
  ['triggers', 'Termination trigger', 'Right', ['terminationTriggers', 'mainConcept']],
  ['outside-date', 'Outside date', 'Timing', ['outsideDate', 'outsideDateISO']],
  ['outside-months', 'Months post-signing', 'Timing', ['outsideDateMonthsPostSigning', 'outsideDateMonths']],
  ['extension', 'Extension right', 'Timing', ['extensionAvailable', 'extensionPeriod', 'extensionTrigger']],
  ['vote', 'Vote failure', 'Approval', ['voteThreshold', 'shareholderApprovalFailure']],
  ['breach', 'Breach standard / cure', 'Breach', ['breachStandard', 'curePeriod', 'faultBasedExclusion']],
  ['recommendation', 'Change of recommendation', 'Fiduciary', ['recommendationChangeTermination', 'parentTerminationRightForNonsolicitBreach']],
  ['superior', 'Superior proposal termination', 'Fiduciary', ['superiorProposalTermination']],
];

function isTerminationRight(card) {
  return cardType(card) === 'TERMINATION_RIGHT' || cardCode(card).startsWith('TERMR') || /termination right|outside date|superior proposal/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
    Right: 'Right',
    Timing: 'Timing',
    Approval: 'Approval',
    Breach: 'Breach',
    Fiduciary: 'Fiduciary',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Breach' || row.kind === 'Fiduciary' ? 'warning' : row.kind === 'Timing' ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedTerminationRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('termination-rights', id, label, kind, hit);
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

const terminationRightsConfig = {
  id: 'termination-rights',
  title: 'Termination Rights',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    return mappedTerminationRows(selectCards(reviewDeal, isTerminationRight));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { mappedTerminationRows, renderDetail, renderSignals, signalFor, terminationRightsConfig };
