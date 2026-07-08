import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['ordinary-course', 'Ordinary-course covenant', 'Interim operating', ['ordinaryCourseConduct', 'absenceConductedOrdinaryCourse']],
  ['no-mae', 'No MAE / no changes limb', 'Interim operating', ['absenceNoMAE', 'aocNoMaePresent']],
  ['specified-iocs', 'Specified interim operating covenants', 'Interim operating', ['absenceSpecifiedIOCs', 'negativeCovenantBaskets']],
  ['negative', 'Negative covenant restrictions', 'Restrictions', ['negativeCovenant', 'restrictedActions']],
  ['affirmative', 'Affirmative covenants', 'Affirmative', ['affirmativeCovenants', 'positiveObligations']],
  ['efforts', 'General efforts standard', 'Efforts', ['effortsStandard', 'reasonableBestEfforts']],
  ['access', 'Access / information rights', 'Access', ['accessRights', 'informationAccess']],
  ['public-statements', 'Public statements', 'Communications', ['publicStatements', 'publicStatementExceptions']],
  ['insurance', 'D&O / insurance covenant', 'Insurance', ['insuranceCap', 'insurancePeriod', 'doInsurance']],
  ['financing', 'Financing cooperation', 'Financing', ['financingCooperation']],
];

function isGeneralCovenant(card) {
  const type = cardType(card);
  const code = cardCode(card);
  return type === 'COVENANT_OTHER' || type === 'COVENANT_INTERIM_OPERATING' || code.startsWith('COV') || code.startsWith('IOC') || /covenant|ordinary course|access|public statements/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function readableSignal(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  const dict = taxonomyForFeatureKey(key);
  return (dict && labelForCode(String(value?.code || value?.value || value), dict)) || rendered;
}

function signal(key, label, value, card, tone = 'info') {
  const readable = readableSignal(key, value);
  if (!readable) return null;
  return {
    id: `${card?.id || cardCode(card)}-${key}-${readable}`,
    label: `${label}: ${readable}`,
    value,
    tone,
    evidence: value?.text || textOf(card),
    source: card,
  };
}

function rowSignals(card) {
  const f = cardFeatures(card);
  return [
    signal('effortsStandard', 'Efforts', f.iocEffortsStandard || f.effortsStandard || f.reasonableBestEfforts, card, 'info'),
    signal('consentStandard', 'Consent', f.iocConsentStandard || f.consentStandard, card, 'info'),
    signal('knowledgeQualifier', 'Knowledge', f.knowledgeQualifier, card, 'warning'),
    signal('dayCountDeadline', 'Deadline', f.dayCountDeadline || f.leadInPeriodDays || f.deadlineDays, card, 'neutral'),
  ].filter(Boolean);
}

function mappedCovenantRows(prefix, cards, specs) {
  return specs
    .map(([id, label, kind, keys]) => {
      const hit = firstFeature(cards, keys || id);
      const row = makeRow(prefix, id, label, kind, hit);
      if (!row) return null;
      return {
        ...row,
        signals: rowSignals(hit.card),
        sourceCard: hit.card,
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
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.sourceCard, as: 'span' }, row.detail);
}

const generalCovenantsConfig = {
  id: 'general-covenants',
  title: 'General Covenants',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    return mappedCovenantRows('general-covenants', selectCards(reviewDeal, isGeneralCovenant), ROWS);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Kind', width: '12rem', renderCell: (row) => row.kind },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { generalCovenantsConfig, renderDetail, renderSignals, rowSignals };
