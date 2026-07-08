import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { allFeatures, cardCode, cardType, firstFeature, labelOf, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// 'party' (partyWhoCanTerminate) is a PER-RIGHT attribute: Metsera has 9
// TERMINATION_RIGHT cards each with their own claim (Target Breach -> Buyer,
// Superior Proposal -> Target, Outside Date -> Mutual, ...). firstFeature()
// would collapse all 9 into a single value; render one row per card instead
// (see PER_RIGHT_ROW_IDS below) so the party+right pairing survives.
const ROWS = [
  ['party', 'Party who can terminate', 'Right', ['partyWhoCanTerminate']],
  ['triggers', 'Termination trigger', 'Right', ['terminationTriggers', 'mainConcept']],
  ['outside-date', 'Outside date', 'Timing', ['outsideDate', 'outsideDateISO']],
  ['outside-months', 'Months post-signing', 'Timing', ['outsideDateMonthsPostSigning', 'outsideDateMonths']],
  ['extension', 'Extension right', 'Timing', ['extensionMonths', 'outsideDateExtension', 'outsideDateExtensionConditions', 'extensionAvailable', 'extensionPeriod', 'extensionTrigger']],
  ['restraint-finality', 'Legal restraint finality', 'Right', ['restraintFinality']],
  ['vote', 'Vote failure', 'Approval', ['voteThreshold', 'shareholderApprovalFailure']],
  ['breach', 'Breach standard / cure', 'Breach', ['breachStandard', 'curePeriod', 'faultBasedExclusion']],
  ['willful-breach', 'Willful breach defn / exception', 'Breach', ['willfulBreachDefinition', 'willfulBreachException']],
  ['recommendation', 'Change of recommendation', 'Fiduciary', ['triggerEvents', 'recommendationChangeTermination', 'parentTerminationRightForNonsolicitBreach']],
  ['superior', 'Superior proposal termination', 'Fiduciary', ['companyTerminationForSuperior', 'superiorProposalTermination', 'feeRequired']],
  ['specific-performance', 'Specific performance (mutual)', 'Remedies', ['specificPerformanceMutual', 'specificPerformance']],
];

const PER_RIGHT_ROW_IDS = new Set(['party']);

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

function perRightRows(cards, id, label, kind, keys) {
  return allFeatures(cards, keys)
    .map((hit) => {
      const row = makeRow('termination-rights', `${id}-${hit.card?.id || ''}`, `${label} — ${labelOf(hit.card)}`, kind, hit);
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

function mappedTerminationRows(cards) {
  const rows = [];
  for (const [id, label, kind, keys] of ROWS) {
    if (PER_RIGHT_ROW_IDS.has(id)) {
      rows.push(...perRightRows(cards, id, label, kind, keys || id));
      continue;
    }
    const hit = firstFeature(cards, keys || id);
    const row = makeRow('termination-rights', id, label, kind, hit);
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
