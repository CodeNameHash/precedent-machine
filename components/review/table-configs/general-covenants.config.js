import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, firstFeature, makeRow, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

const ROWS = [
  ['ordinary-course', 'Ordinary-course covenant', 'Interim operating', ['ordinaryCourseConduct', 'absenceConductedOrdinaryCourse']],
  ['no-mae', 'No MAE / no changes limb', 'Interim operating', ['aocNoMaePresent']],
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

// The 10 curated ROWS above collapse the whole covenant pool into one
// generic row per concept (firstFeature-style) — a family that legacy
// rendered as ~38 distinct per-clause rows (one per IOC/COV card) shrinks to
// a fixed 10. IOC-GENERAL-EXCEPTIONS / IOC-NEGATIVE-PREAMBLE are containers
// already rendered in full by ioc-exceptions.config.js, so exclude them here
// to avoid a duplicate/empty row; every OTHER card gets its own row below.
function isPreambleOnlyCard(card) {
  const code = cardCode(card);
  return code === 'IOC-GENERAL-EXCEPTIONS' || code === 'IOC-NEGATIVE-PREAMBLE';
}

function clauseLabel(card) {
  return card?.short_title || card?.defined_term || cardCode(card) || 'Covenant';
}

function clauseKind(card) {
  return cardType(card) === 'COVENANT_INTERIM_OPERATING' ? 'Interim operating' : 'General covenant';
}

function clauseDetail(card) {
  const f = cardFeatures(card);
  return valueText(f.mainConcept) || textOf(card);
}

function perClauseRows(cards) {
  return cards
    .filter((card) => !isPreambleOnlyCard(card))
    .map((card) => {
      const detail = clauseDetail(card);
      if (!detail) return null;
      return {
        id: `general-covenants-clause-${card.id}`,
        label: clauseLabel(card),
        kind: clauseKind(card),
        detail,
        evidence: textOf(card),
        source: clauseLabel(card),
        present: true,
        signals: rowSignals(card),
        sourceCard: card,
      };
    })
    .filter(Boolean);
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

// Unlike the mapped ROWS above, perClauseRows()' detail can fall all the way
// back to the entire raw clause text (clauseDetail() -> textOf(card) when
// mainConcept isn't extracted) — up to the whole covenant's prose. Neither
// row shape has a redundant pill copy of the value (rowSignals() surfaces
// efforts/consent/knowledge/deadline meta, not the clause text itself), so
// the column can't be wholesale relocated like the mae/antitrust/reps
// families; truncate per-cell instead and keep the same "see text" escape
// hatch for whatever got cut.
function renderDetail(row, ctx) {
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (!TruncatedWithSeeText) return row.detail;
  return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.sourceCard });
}

const generalCovenantsConfig = {
  id: 'general-covenants',
  title: 'General Covenants',
  layoutSlot: 'covenants',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isGeneralCovenant);
    return [...mappedCovenantRows('general-covenants', cards, ROWS), ...perClauseRows(cards)];
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { generalCovenantsConfig, perClauseRows, renderDetail, renderSignals, rowSignals };
