import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt to match the pre-schema legacy render (dc46bef parent, see
// TermrRebuiltSummary / TERMR_CANONICAL): ONE consolidated table grouped by
// which side may exercise the right (Mutual / Buyer / Target), each row a
// canonical termination right with a short bullet list of its key negotiated
// terms -- not a flat concept-by-concept grid with a redundant Kind column.
const TERMR_CANONICAL = [
  { key: 'mutual', label: 'Mutual consent', codes: ['TERMR-MUTUAL'], family: 'mutual' },
  { key: 'outside', label: 'Outside / End Date', codes: ['TERMR-OUTSIDE', 'TERMR-EXTENSION'], family: 'mutual' },
  { key: 'legal', label: 'Legal restraint / order', codes: ['TERMR-LEGAL'], family: 'mutual' },
  { key: 'vote', label: 'Stockholder vote not obtained', codes: ['TERMR-VOTE'], family: 'mutual' },
  { key: 'breachT', label: 'Company (Target) breach', codes: ['TERMR-BREACH-T'], family: 'buyer' },
  { key: 'recommend', label: 'Change of Recommendation', codes: ['TERMR-RECOMMEND'], family: 'buyer' },
  { key: 'breachB', label: 'Parent (Buyer) breach', codes: ['TERMR-BREACH-B'], family: 'target' },
  { key: 'superior', label: 'Superior Proposal', codes: ['TERMR-SUPERIOR'], family: 'target' },
];

const FAMILY_LABELS = {
  mutual: 'Mutual / Either Party',
  buyer: 'Buyer / Parent May Terminate',
  target: 'Company / Target May Terminate',
};
const FAMILY_ORDER = ['mutual', 'buyer', 'target'];

function isTerminationRight(card) {
  return cardType(card) === 'TERMINATION_RIGHT' || cardCode(card).startsWith('TERMR') || /termination right|outside date|superior proposal/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}

function isBoilerplateCard(card) {
  return /amendment|waiver|expenses|effect\s+of\s+termination|fees\s+and\s+expenses/i.test(String(card?.short_title || ''));
}

// Prefer a non-boilerplate card carrying this code; TERMR codes occasionally
// land on an amendment/expenses clause that happens to share the same
// canonical code as the substantive right.
function cardForCodes(cards, codes) {
  const matches = cards.filter((card) => codes.includes(cardCode(card)));
  if (!matches.length) return null;
  const nonBoiler = matches.filter((card) => !isBoilerplateCard(card));
  return (nonBoiler.length ? nonBoiler : matches)[0];
}

function readableValue(key, value) {
  const rendered = valueText(value);
  if (!rendered) return null;
  const code = value?.code || value?.value || (typeof value === 'string' ? value : null);
  const dict = taxonomyForFeatureKey(key);
  return (dict && code && labelForCode(String(code), dict)) || rendered;
}

// Compose the short "key terms" bullet list for a canonical right from its
// card's features -- the legacy TermrRebuiltSummary's termrKeyTerms(),
// trimmed to the fields available on the claims-backed card model.
function keyTermsForRight(key, card) {
  if (!card) return [];
  const f = cardFeatures(card);
  const bits = [];
  if (key === 'outside') {
    const outsideDate = readableValue('outsideDate', f.outsideDate || f.outsideDateISO);
    if (outsideDate) bits.push(`Outside date: ${outsideDate}`);
    const months = readableValue('outsideDateMonthsPostSigning', f.outsideDateMonthsPostSigning || f.outsideDateMonths);
    if (months) bits.push(`Period from signing: ${months}`);
    const extensionAvail = readableValue('extensionAvailable', f.extensionAvailable);
    const extensionMonths = readableValue('extensionMonths', f.extensionMonths || f.extensionPeriod);
    if (extensionMonths) bits.push(`Extension: ${extensionMonths}`);
    else if (extensionAvail) bits.push(`Extension available: ${extensionAvail}`);
    const extensionConditions = readableValue('outsideDateExtensionConditions', f.outsideDateExtensionConditions || f.extensionConditions);
    if (extensionConditions) bits.push(`Extension terms: ${extensionConditions}`);
  } else if (key === 'legal') {
    const finality = readableValue('restraintFinality', f.restraintFinality);
    bits.push(finality ? `Order must be final & non-appealable: ${finality}` : 'Legal restraint in effect');
  } else if (key === 'vote') {
    const threshold = readableValue('voteThreshold', f.voteThreshold);
    bits.push(threshold ? `Required vote: ${threshold}` : 'Required stockholder vote not obtained');
  } else if (key === 'breachT' || key === 'breachB') {
    const cure = readableValue('curePeriod', f.curePeriod);
    if (cure) bits.push(`Cure period: ${cure}`);
    const standard = readableValue('breachStandard', f.breachStandard);
    if (standard) bits.push(standard);
    const fault = readableValue('faultBasedExclusion', f.faultBasedExclusion);
    if (fault) bits.push(`Fault-based carve-out: ${fault}`);
  } else if (key === 'superior') {
    const fee = readableValue('feeRequired', f.feeRequired);
    bits.push(fee ? `Termination fee payable: ${fee}` : 'No fee specified');
  } else if (key === 'recommend') {
    const trigger = readableValue('triggerEvents', f.triggerEvents || f.recommendationChangeTermination);
    if (trigger) bits.push(trigger);
    const preVote = readableValue('preVoteOnlyWindow', f.preVoteOnlyWindow);
    if (preVote) bits.push(`Available pre-stockholder-vote only: ${preVote}`);
  }
  if (bits.length === 0) {
    const mainConcept = readableValue('mainConcept', f.mainConcept) || readableValue('terminationTriggers', f.terminationTriggers);
    if (mainConcept) bits.push(mainConcept);
  }
  return bits;
}

function termsChildren(terms) {
  const items = terms.length > 0
    ? terms.map((term, index) => React.createElement('li', { key: index }, term))
    : [React.createElement('li', { key: 'none', className: 'italic text-inkFaint' }, 'Present, detail not extracted')];
  return React.createElement('ul', { className: 'space-y-0.5' }, items);
}

function rowForSpec(spec, cards) {
  const card = cardForCodes(cards, spec.codes);
  const terms = keyTermsForRight(spec.key, card);
  return {
    id: `termination-rights-${spec.key}`,
    spec,
    label: spec.label,
    value: terms,
    evidence: card ? textOf(card) : null,
    source: card,
    present: Boolean(card),
    children: card
      ? termsChildren(terms)
      : React.createElement('span', { className: 'italic text-inkFaint' }, 'Not present in this agreement'),
  };
}

function familyGroups(cards) {
  return FAMILY_ORDER
    .map((family) => ({
      id: family,
      label: FAMILY_LABELS[family],
      rows: TERMR_CANONICAL.filter((spec) => spec.family === family).map((spec) => rowForSpec(spec, cards)),
    }))
    .filter((group) => group.rows.some((row) => row.present));
}

const terminationRightsConfig = {
  id: 'termination-rights',
  title: 'Termination Rights',
  layoutSlot: 'termination',
  selectRows(reviewDeal) {
    const cards = selectCards(reviewDeal, isTerminationRight);
    const groups = familyGroups(cards);
    if (!groups.length) return [];
    return [{ id: 'termination-rights-body', groups }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        return React.createElement(GroupedSubRows, { groups: row.groups, emptyCopy: 'No termination rights found.' });
      },
    },
  ],
};

export {
  FAMILY_LABELS,
  TERMR_CANONICAL,
  familyGroups,
  keyTermsForRight,
  rowForSpec,
  terminationRightsConfig,
};
