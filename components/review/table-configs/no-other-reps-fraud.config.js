import React from 'react';
import { deriveAbrySummary } from '../../../lib/abry.js';
import { valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

// v1 reclassification (2026-08-02, R3): the old family-level codes
// (REP-T-NOREP / REP-B-NOREP / REP-B-ANTIRELIANCE) are retired but kept
// here for historic rows that still carry them; the eight new element
// codes (REP-T-/REP-B- x NOOTHERREPS/NONRELIANCE/INDEPINVEST/
// FRAUDCARVEOUT) are the current landing spots for freshly-extracted
// anti-reliance cards. This table is agnostic to which set a card carries.
const ABRY_CODES = [
  'MISC-ENTIRE',
  'REP-T-NOREP', 'REP-B-NOREP', 'REP-B-ANTIRELIANCE',
  'REP-T-NOOTHERREPS', 'REP-T-NONRELIANCE', 'REP-T-INDEPINVEST', 'REP-T-FRAUDCARVEOUT',
  'REP-B-NOOTHERREPS', 'REP-B-NONRELIANCE', 'REP-B-INDEPINVEST', 'REP-B-FRAUDCARVEOUT',
];
const FEATURE_KEYS = [
  'noOtherRepsPresent',
  'noOtherRepsParty',
  'nonRelianceClause',
  'extraContractualClaimsWaived',
  'fraudCarveout',
  'willfulBreachDefinition',
];
const QUESTIONS = [
  ['q1', 'Buyer non-reliance', 'Non-reliance'],
  ['q2', 'Seller no-other-reps', 'No-other-reps'],
  ['q3', 'Seller non-reliance', 'Non-reliance'],
  ['q4', 'Buyer no-other-reps', 'No-other-reps'],
];
const QUESTION_PARTIES = {
  q1: ['COMPANY', 'BOTH'],
  q2: ['COMPANY', 'BOTH'],
  q3: ['PARENT', 'BOTH'],
  q4: ['PARENT', 'BOTH'],
};
const ABRY_COHORT = {
  scope: 'provision_codes',
  provisionCodes: ABRY_CODES,
  eligibility: 'code_present',
};

function questionMarket(key) {
  const partyValues = QUESTION_PARTIES[key];
  const marketPresence = {
    strategy: 'feature_matches',
    featureKeys: ['noOtherRepsParty'],
    values: partyValues,
    missingState: 'absent',
  };
  return {
    featureKeys: ['noOtherRepsParty', 'nonRelianceClause', 'extraContractualClaimsWaived', 'fraudCarveout'],
    marketProvisionCodes: ABRY_CODES,
    marketPrevalenceCohort: ABRY_COHORT,
    marketPresence,
    marketSubterms: [
      {
        key: 'scope',
        label: 'Non-reliance scope',
        featureKeys: ['nonRelianceClause', 'fraudCarveout'],
        kind: 'multi_select',
        value: {
          strategy: 'feature_value',
          featureKeys: ['nonRelianceClause', 'fraudCarveout'],
          normalizer: 'abry_scope',
          partyValues,
        },
      },
      {
        key: 'extra-contractual-waiver',
        label: 'Express extra-contractual disclaimer',
        featureKeys: ['extraContractualClaimsWaived'],
        kind: 'presence',
        presence: {
          strategy: 'feature_matches',
          featureKeys: ['extraContractualClaimsWaived'],
          values: [true],
          missingState: 'absent',
        },
      },
    ],
  };
}

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
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy read `.text` before `.label`/`.code` with
// no redundancy check, so it could leak a raw canonical code or double up
// text that already matched the label. card-utils.js's version prioritizes
// label/code and suppresses a `.text` that's a literal echo.
// The §9.07 "Anti-Reliance / Exclusivity of Representations" card (code
// REP-B-ANTIRELIANCE, already in ABRY_CODES) stores noOtherRepsParty as a
// TAGGED value ({ code: 'BOTH', label: 'Both', text: 'BOTH', quotes: [...] })
// rather than the bare string lib/abry.js's partyOf() expects -- so its Q1-Q4
// rows silently fell through to "Not present" even though the card WAS being
// selected. Unwrap to the tagged .code (or .value/.label) before handing the
// provision to deriveAbrySummary; a plain string passes through untouched.
function partyCodeOf(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (typeof raw.code === 'string' && raw.code) return raw.code;
    if (typeof raw.value === 'string' && raw.value) return raw.value;
    if (typeof raw.label === 'string' && raw.label) return raw.label;
  }
  return raw;
}
function pseudoProvision(card) {
  const features = cardFeatures(card);
  const normalizedFeatures = 'noOtherRepsParty' in features
    ? { ...features, noOtherRepsParty: partyCodeOf(features.noOtherRepsParty) }
    : features;
  return { ...card, code: cardCode(card), category: card?.short_title, ai_metadata: { code: cardCode(card), features: normalizedFeatures } };
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
    // Item 2 (r5): lib/abry.js's deriveAbrySummary threads the ORIGINATING
    // card back as entry.provision (a spread copy of the card via
    // pseudoProvision -- see lib/abry.js's q1-q4 builders) even though the
    // summary itself is a cross-provision rollup. Wiring it here is what
    // makes each Q1-Q4/fraud/willful-breach row clickable to the actual
    // card that answered it, instead of staying an inert rollup row.
    sourceCard: present ? (entry.provision || null) : null,
    present,
    ...questionMarket(key),
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
    sourceCard: present ? (fraud.provision || null) : null,
    present: true,
    featureKeys: ['fraudCarveout'],
    marketProvisionCodes: ABRY_CODES,
    marketPrevalenceCohort: ABRY_COHORT,
    marketPresence: {
      strategy: 'feature_non_empty',
      featureKeys: ['fraudCarveout'],
      missingState: 'absent',
    },
    marketSubterms: [{
      key: 'scope',
      label: 'Fraud carve-out scope',
      featureKeys: ['fraudCarveout'],
      kind: 'multi_select',
      value: {
        strategy: 'feature_value',
        featureKeys: ['fraudCarveout'],
        normalizer: 'fraud_carveout_scope',
      },
    }],
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
    sourceCard: willfulBreach.provision || null,
    present: true,
    featureKeys: ['willfulBreachDefinition'],
    marketPresence: {
      strategy: 'feature_non_empty',
      featureKeys: ['willfulBreachDefinition'],
      missingState: 'absent',
    },
    marketSubterms: [{
      key: 'defined',
      label: 'Willful breach defined',
      featureKeys: ['willfulBreachDefinition'],
      kind: 'presence',
      presence: {
        strategy: 'feature_non_empty',
        featureKeys: ['willfulBreachDefinition'],
        missingState: 'absent',
      },
    }],
  };
}
const noOtherRepsFraudConfig = {
  id: 'no-other-reps-fraud',
  title: 'No Other Reps / Fraud',
  layoutSlot: 'misc',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(hasAbrySignal);
    if (!cards.length) return [];
    const summary = deriveAbrySummary(cards.map(pseudoProvision));
    return [
      ...QUESTIONS.map(([key, label, kind]) => questionRow(key, label, kind, summary[key])),
      fraudRow(summary.fraud),
      // extraContractualClaimsWaived row removed (spec #48): it's a
      // conclusion that follows from the non-reliance / no-other-reps rows
      // above, not a distinct fact worth its own row.
      willfulBreachRow(summary.willfulBreach),
    ].filter(Boolean);
  },
  fixedLayout: true,
  columns: [
    { id: 'question', header: 'Question', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    {
      id: 'status',
      header: 'Status',
      width: '8rem',
      renderCell(row, ctx) {
        const PillCell = ctx?.primitives?.PillCell;
        if (!PillCell) return row.status;
        const isYes = row.status === 'Present' || row.status === 'Defined';
        return React.createElement(PillCell, {
          label: isYes ? 'Yes' : row.status,
          tone: isYes ? 'present' : 'missing',
          evidence: row.evidence,
          source: row.source,
        });
      },
    },
    {
      id: 'detail',
      header: 'Detail',
      renderCell(row, ctx) {
        const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
        if (!TruncatedWithSeeText) return row.detail;
        return React.createElement(TruncatedWithSeeText, { text: row.detail, evidence: row.evidence, source: row.source });
      },
    },
  ],
};

export { noOtherRepsFraudConfig };
