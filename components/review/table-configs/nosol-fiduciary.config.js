import React from 'react';
import { valueText } from './card-utils.js';

const ROWS = [
  { id: 'engage', label: 'Engagement standard', keys: ['fiduciaryEngageStandard', 'engagementStandard'], fallback: engageFromText },
  { id: 'final', label: 'Final determination standard', keys: ['fiduciaryFinalStandard', 'changeRecStandard'], fallback: finalFromText },
  { id: 'board-change', label: 'Board change right', keys: ['boardChangeForSuperiorProposal', 'boardChangeStandard'], fallback: boardChangeFromText },
  { id: 'notice-period', label: 'Notice period', keys: ['noticePeriod'], fallback: noticePeriodFromText },
  { id: 'notice-content', label: 'Notice content', keys: ['noticeContent'], fallback: noticeContentFromText },
  { id: 'initial-match', label: 'Initial match period', keys: ['initialMatchPeriodDays', 'matchingPeriod'], fallback: matchFromText },
  { id: 'subsequent-match', label: 'Subsequent match period', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'], fallback: subsequentMatchFromText },
  { id: 'force-vote', label: 'Force the vote', keys: ['forceTheVote', 'forceTheVoteDetails'], fallback: forceVoteFromText },
  { id: 'termination', label: 'Company termination for Superior Proposal', keys: ['companyTerminationForSuperior', 'companyTerminationForSuperiorConditions'], fallback: terminationFromText },
  { id: 'reps', label: 'Representative control standard', keys: ['representativesStandard', 'representativeBreachIsCompanyBreach'], fallback: repsFromText },
  { id: 'buyer-termination', label: 'Buyer termination for nonsolicit breach', keys: ['parentTerminationRightForNonsolicitBreach'], fallback: buyerTerminationFromText },
  { id: 'change-of-rec-items', label: 'Change of Recommendation — prohibited actions', keys: ['changeOfRecommendationItems'], fallback: () => null },
  { id: 'not-change-of-rec-items', label: 'Not a Change of Recommendation', keys: ['notChangeOfRecommendationItems'], fallback: () => null },
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function isFiduciaryCard(card) {
  const code = cardCode(card);
  if (['NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-RECOMMEND', 'NOSOL-EXCEPT'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /fiduciary|recommendation|match|notice|representatives?|terminate/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
function partySide(card) {
  const scope = String(card?.party_scope || '').toUpperCase();
  return scope === 'BUYER' || scope === 'PARENT' ? 'Buyer / Parent' : 'Target / Company';
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
// valueText is imported from card-utils.js (see above) rather than defined
// locally: this config's own copy read `.text` before `.label`/`.code` with
// no redundancy check, so it could leak a raw canonical code or double up
// text that already matched the label. card-utils.js's version prioritizes
// label/code and suppresses a `.text` that's a literal echo.
function firstFeature(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const text = valueText(features[key]);
      if (text) return text;
    }
  }
  return null;
}
function sentence(text, pattern) {
  const match = text.match(pattern);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}
function engageFromText(text) {
  return sentence(text, /(?:constitutes|could\s+reasonably\s+be\s+expected|is\s+reasonably\s+likely)[^.]{0,180}lead\s+to\s+a\s+Superior\s+Proposal/i);
}
function finalFromText(text) {
  return sentence(text, /(?:constitutes|is|would\s+result\s+in)\s+a\s+Superior\s+Proposal/i);
}
function boardChangeFromText(text) {
  return sentence(text, /[^.]*(?:Change\s+of\s+Recommendation|Adverse\s+Recommendation\s+Change)[^.]*Superior\s+Proposal[^.]*\.?/i);
}
function noticePeriodFromText(text) {
  const match = text.match(/(\d+|one|two|three|four|five)\s+(?:\(\d+\)\s+)?(?:Business\s+)?Days?/i);
  return match ? match[0] : null;
}
function noticeContentFromText(text) {
  return sentence(text, /[^.]*notice[^.]*identity[^.]*terms[^.]*\.?/i);
}
function matchFromText(text) {
  return sentence(text, /[^.]*(?:match|matching|negotiate|amend)[^.]*?(\d+|one|two|three|four|five)\s+(?:\(\d+\)\s+)?(?:Business\s+)?Days?[^.]*\.?/i);
}
function subsequentMatchFromText(text) {
  return sentence(text, /[^.]*(?:subsequent|material\s+amendment|revised)[^.]*?(\d+|one|two|three|four|five)\s+(?:\(\d+\)\s+)?(?:Business\s+)?Days?[^.]*\.?/i);
}
function forceVoteFromText(text) {
  return sentence(text, /[^.]*submit[^.]*stockholders?[^.]*notwithstanding[^.]*(?:Change\s+of\s+Recommendation|Adverse\s+Recommendation\s+Change)[^.]*\.?/i);
}
function terminationFromText(text) {
  return sentence(text, /[^.]*terminat[^.]*Superior\s+Proposal[^.]*\.?/i);
}
function repsFromText(text) {
  return sentence(text, /[^.]*(?:cause|instruct|not\s+permit)[^.]*Representatives?[^.]*\.?/i);
}
function buyerTerminationFromText(text) {
  return sentence(text, /[^.]*Parent[^.]*terminat[^.]*(?:breach|No\s+Solicitation|nonsolicit)[^.]*\.?/i);
}
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const detail = firstFeature(cards, spec.keys) || spec.fallback(evidence);
  if (!detail) return null;
  return {
    id: `nosol-fiduciary-${spec.id}`,
    label: spec.label,
    party: [...new Set(cards.map(partySide))].join(', ') || 'Target / Company',
    detail,
    evidence,
    sourceCards: cards,
    present: true,
  };
}
function rowSignal(row) {
  if (!row?.detail) return null;
  const isTiming = /notice|match/i.test(row.label);
  const isTermination = /termination/i.test(row.label);
  // Bare value only -- the Term column already names this row.
  return {
    id: `${row.id}-signal`,
    label: row.detail,
    value: row.detail,
    tone: isTermination ? 'warning' : isTiming ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCards?.[0],
  };
}
function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const signal = rowSignal(row);
  if (!signal) return '';
  if (!PillCell) return signal.label;
  return React.createElement(PillCell, {
    label: signal.label,
    value: signal.value,
    tone: signal.tone,
    evidence: signal.evidence,
    source: signal.source,
  });
}
function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.sourceCards?.[0], as: 'span' }, row.detail);
}

const nosolFiduciaryConfig = {
  id: 'nosol-fiduciary',
  title: 'Fiduciary-Out Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isFiduciaryCard);
    if (!cards.length) return [];
    return ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '19rem', renderCell: (row) => row.label },
    { id: 'party', header: 'Party', width: '12rem', renderCell: (row) => row.party },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No fiduciary-out mechanics found.' },
};

export { nosolFiduciaryConfig, renderDetail, renderSignals, rowSignal };
