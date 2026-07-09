import React from 'react';
import { valueText } from './card-utils.js';

const ROWS = [
  // `noShopType`/`prohibitedActions`/`mainRestriction` were guessed aliases
  // with zero registered/claimed attributes behind them (Metsera parity
  // audit root cause 1). The real schema attribute for the going-forward
  // solicitation prohibition is `ceaseDiscussionsProhibitedList` — the same
  // key the 'cease' row below already used correctly; it also carries claims
  // on the NOSOL-PROHIBIT card (scoped per-row via `codes`, so 'prohibit' and
  // 'cease' still render distinct card-specific values).
  { id: 'prohibit', label: 'No-shop / non-solicit restriction', codes: ['NOSOL-PROHIBIT'], keys: ['ceaseDiscussionsProhibitedList'] },
  { id: 'cease', label: 'Cease discussions', codes: ['NOSOL-CEASE'], keys: ['ceaseDiscussionsProhibitedList', 'ceaseDiscussionsAffiliateStandard', 'ceaseDiscussionsLiability'] },
  { id: 'exceptions', label: 'No-shop exceptions', codes: ['NOSOL-EXCEPT'], keys: ['ceaseDiscussionsExceptions', 'permittedExceptions', 'fiduciaryCarveoutThreshold'] },
  // Don't-ask-don't-waive / standstill enforcement (Skechers cross-deal
  // parity gap; no Metsera claim) — lives on its own NOSOL-ENFORCE card.
  { id: 'standstill-enforce', label: "Don't-ask-don't-waive / standstill enforcement", codes: ['NOSOL-ENFORCE'], keys: ['dontAskDontWaive', 'standstillWaiverConditions'] },
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
function isNosolCard(card) {
  return card?.provision_type === 'COVENANT_NO_SOLICITATION' || /^NOSOL(?:-|$)/.test(cardCode(card));
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
function featureSummary(card, keys) {
  const features = cardFeatures(card);
  const parts = [];
  for (const key of keys) {
    const text = valueText(features[key]);
    if (text) parts.push(text);
  }
  return parts.join('\n');
}
function fallbackMatch(row, card) {
  const text = `${card?.short_title || ''} ${textOf(card)}`;
  if (row.id === 'prohibit') return /no[\s-]*shop|solicit|encourage|initiate|knowingly facilitate/i.test(text);
  if (row.id === 'cease') return /cease|terminate|discontinue/i.test(text) && /discussion|negotiation/i.test(text);
  if (row.id === 'standstill-enforce') return /standstill|don.?t[- ]ask[- ]don.?t[- ]waive/i.test(text);
  return /except|provided|fiduciary|superior proposal/i.test(text);
}
function rowForSpec(spec, cards) {
  const matches = cards.filter((card) => spec.codes.includes(cardCode(card)) || fallbackMatch(spec, card));
  if (!matches.length) return null;
  const detail = matches
    .map((card) => featureSummary(card, spec.keys) || textOf(card))
    .filter(Boolean)
    .join('\n\n');
  const parties = [...new Set(matches.map(partySide))].join(', ');
  return {
    id: `nosol-noshop-${spec.id}`,
    label: spec.label,
    party: parties || 'Target / Company',
    detail: detail || 'Present, detail not extracted',
    evidence: matches.map(textOf).filter(Boolean).join('\n\n'),
    sourceCards: matches,
    present: true,
  };
}
function rowSignal(row) {
  if (!row?.detail) return null;
  const tone = row.id.endsWith('exceptions') ? 'warning' : 'info';
  // Read-view pill shows the resolved value alone -- the Term column already
  // names the row (e.g. "Cease discussions"), so a repeated "<Term>: " prefix
  // was pure noise.
  return { id: `${row.id}-signal`, label: row.detail, value: row.detail, tone, evidence: row.evidence, source: row.sourceCards?.[0] };
}
// Per user feedback: the obligated party (Target / Company on nearly every
// deal) was repeated on every row. Hoist it into a single section-level note
// instead of a per-row column -- still fully visible, just shown once.
function deriveHeaderNote(rows) {
  const parties = [...new Set((rows || []).map((row) => row.party).filter(Boolean))];
  if (parties.length === 0) return null;
  return `Party: ${parties.join(', ')}`;
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

const nosolNoshopConfig = {
  id: 'nosol-noshop',
  title: 'No-Shop Core Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isNosolCard);
    if (!cards.length) return [];
    return ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
  },
  deriveHeaderNote,
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No no-shop core mechanics found.' },
};

export { deriveHeaderNote, nosolNoshopConfig, renderDetail, renderSignals, rowSignal };
