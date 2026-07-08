import React from 'react';
import { deriveAbrySummary } from '../../../lib/abry.js';

const ABRY_CODES = ['MISC-ENTIRE', 'REP-T-NOREP', 'REP-B-NOREP', 'REP-B-ANTIRELIANCE'];
const FEATURE_KEYS = [
  'noOtherRepsPresent',
  'noOtherRepsParty',
  'nonRelianceClause',
  'extraContractualClaimsWaived',
  'fraudCarveout',
  'willfulBreachDefinition',
];
// Q1/Q3 are the "non-reliance" side of the pairing, Q2/Q4 the "no-other-reps"
// side — see lib/abry.js's module header. deriveAbrySummary only computes a
// `scope` label (extra-contractual materials named in the clause) for the
// no-other-reps questions (Q2/Q4); Q1/Q3 carry no scope field in the current
// schema, so no scope pill is rendered for them (documented in the PR, not
// fabricated).
const QUESTIONS = [
  ['q1', 'Buyer non-reliance', 'Non-reliance'],
  ['q2', 'Seller no-other-reps', 'No-other-reps'],
  ['q3', 'Seller non-reliance', 'Non-reliance'],
  ['q4', 'Buyer no-other-reps', 'No-other-reps'],
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') return value.value || value.text || value.label || value.code || null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
function pseudoProvision(card) {
  const features = cardFeatures(card);
  return { ...card, code: cardCode(card), category: card?.short_title, ai_metadata: { code: cardCode(card), features } };
}
function hasAbrySignal(card) {
  if (ABRY_CODES.includes(cardCode(card))) return true;
  const features = cardFeatures(card);
  if (FEATURE_KEYS.some((key) => valueText(features[key]))) return true;
  return /no\s+other\s+reps?|non[-\s]?reliance|extra-contractual|fraud|willful\s+breach/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function quoteOrDetail(entry) {
  if (!entry || entry.status !== 'yes') return 'Not present';
  return [entry.scope ? `Scope: ${entry.scope}` : null, entry.quote || 'Present'].filter(Boolean).join('\n');
}
function questionRow(key, label, kind, entry) {
  const present = entry?.status === 'yes';
  return {
    id: `no-other-reps-fraud-${key}`,
    label,
    kind,
    status: present ? 'Present' : 'Not present',
    detail: quoteOrDetail(entry),
    evidence: present ? entry.quote || '' : '',
    source: present ? entry.provision : null,
    scope: present ? entry.scope || null : null,
    present,
  };
}
function fraudRow(fraud) {
  const present = fraud?.status === 'present';
  return {
    id: 'no-other-reps-fraud-fraud',
    label: 'Fraud carve-out',
    kind: 'Fraud',
    status: present ? 'Present' : 'Silent',
    detail: present ? fraud.quote : 'Silent on fraud',
    evidence: present ? fraud.quote : '',
    source: present ? fraud.provision : null,
    scope: null,
    present: true,
    emptyState: !present,
  };
}
function willfulBreachRow(willfulBreach) {
  if (willfulBreach?.status !== 'defined') return null;
  return {
    id: 'no-other-reps-fraud-willful-breach',
    label: 'Willful breach definition',
    kind: 'Willful breach',
    status: 'Defined',
    detail: willfulBreach.quote,
    evidence: willfulBreach.quote,
    source: willfulBreach.provision,
    scope: null,
    present: true,
  };
}
// The Abry "four questions" (Q1-Q4) read most efficiently as a single
// coverage checklist before the detail rows below spell out each one —
// mirrors material-contracts.config.js's rollup-header-then-rows shape.
function checklistRow(questionRows) {
  return {
    id: 'no-other-reps-fraud-checklist',
    label: 'Four-question coverage',
    kind: 'Checklist',
    status: `${questionRows.filter((row) => row.present).length}/4 present`,
    detail: 'See rows below for the underlying quote and scope on each question.',
    evidence: null,
    source: null,
    scope: null,
    present: true,
    checklistItems: questionRows.map((row) => ({
      id: row.id,
      label: row.label,
      present: row.present,
      evidence: row.evidence,
      source: row.source,
    })),
  };
}

function renderStatus(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return row.status;
  return React.createElement(PillCell, {
    label: row.status,
    tone: row.present ? 'present' : row.emptyState ? 'missing' : 'missing',
    evidence: row.evidence,
    source: row.source,
  });
}

function renderDetail(row, ctx) {
  const { PillCell, EvidenceHoverSource, CoverageChecklist, EmptyStateBranch } = ctx?.primitives || {};
  if (row.checklistItems) {
    if (!CoverageChecklist) return row.checklistItems.map((item) => `${item.label}: ${item.present ? 'Present' : 'Missing'}`).join('\n');
    return React.createElement(CoverageChecklist, { items: row.checklistItems, emptyCopy: 'No ABRY signal captured.' });
  }
  if (row.emptyState) {
    return EmptyStateBranch ? React.createElement(EmptyStateBranch, { copy: row.detail }) : row.detail;
  }
  const scopePill = row.scope && PillCell
    ? React.createElement(PillCell, { key: 'scope', label: row.scope, tone: 'info', evidence: row.evidence, source: row.source })
    : null;
  const text = EvidenceHoverSource && row.evidence
    ? React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.source, as: 'span' }, row.detail)
    : row.detail;
  if (!scopePill) return text;
  return React.createElement('div', { className: 'space-y-1' }, scopePill, text);
}

const noOtherRepsFraudConfig = {
  id: 'no-other-reps-fraud',
  title: 'No Other Reps / Fraud',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasAbrySignal);
    if (!cards.length) return [];
    const summary = deriveAbrySummary(cards.map(pseudoProvision));
    const questionRows = QUESTIONS.map(([key, label, kind]) => questionRow(key, label, kind, summary[key]));
    return [
      checklistRow(questionRows),
      ...questionRows,
      fraudRow(summary.fraud),
      willfulBreachRow(summary.willfulBreach),
    ].filter(Boolean);
  },
  columns: [
    { id: 'question', header: 'Question', width: '18rem', renderCell: (row) => row.label },
    { id: 'kind', header: 'Type', width: '10rem', renderCell: (row) => row.kind },
    { id: 'status', header: 'Status', width: '8rem', renderCell: renderStatus },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
};

export { noOtherRepsFraudConfig, renderDetail, renderStatus };
