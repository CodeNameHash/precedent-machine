import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['efforts', 'Efforts standard', 'Efforts', ['effortsStandard', 'antitrustEffortsStandard']],
  ['filings', 'Regulatory filings', 'Timing', ['hsrFilingDeadline', 'foreignFilings', 'regulatoryFilingsDeadline']],
  ['approvals', 'Required approvals', 'Approvals', ['antitrustApprovals', 'regulatoryApprovals']],
  ['litigation', 'Regulatory litigation obligation', 'Litigation', ['litigationObligation', 'parentLitigationObligation']],
  ['consultation', 'Consultation / cooperation tier', 'Process', ['consultationTier', 'cooperationStandard']],
  ['remedies', 'Remedy obligation', 'Remedies', ['remedyObligation', 'divestitureObligation']],
  ['burden-cap', 'Burdensome-condition cap', 'Caps', ['burdensomeConditionLimit', 'burdenBaseline', 'hellOrHighWater']],
  ['clear-skies', 'Clear-skies covenant', 'Conduct', ['clearSkies', 'clearSkiesObligation']],
  ['timing-agreements', 'Timing agreements', 'Conduct', ['timingAgreement', 'timingAgreementText', 'noInconsistentAction']],
  ['outside-date', 'Regulatory outside-date linkage', 'Termination', ['outsideDateExtension', 'antitrustOutsideDateExtension', 'tickingFee']],
];

function isAntitrust(card) {
  return cardType(card) === 'ANTITRUST_REGULATORY' || cardCode(card).startsWith('ANTI') || /antitrust|regulatory|HSR|competition/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
    Efforts: 'Efforts',
    Timing: 'Timing',
    Approvals: 'Approval',
    Litigation: 'Litigation',
    Process: 'Process',
    Remedies: 'Remedy',
    Caps: 'Cap',
    Conduct: 'Conduct',
    Termination: 'Termination',
  };
  return {
    id: `${row.id}-signal`,
    label: `${labels[row.kind] || row.kind}: ${readableValue(row.featureKey, row.value) || row.detail}`,
    value: row.value || row.detail,
    tone: row.kind === 'Caps' || row.kind === 'Termination' ? 'warning' : row.kind === 'Approvals' ? 'present' : 'info',
    evidence: row.evidence,
    source: row.sourceCard,
  };
}

function mappedAntitrustRows(cards) {
  return ROWS
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow('antitrust-regulatory', id, label, kind, hit);
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

const antitrustRegulatoryConfig = {
  id: 'antitrust-regulatory',
  title: 'Antitrust / Regulatory',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    return mappedAntitrustRows(selectCards(reviewDeal, isAntitrust));
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '10rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { antitrustRegulatoryConfig, mappedAntitrustRows, renderDetail, renderSignals, signalFor };
