import React from 'react';
import { valueText } from './card-utils.js';

const ROWS = [
  { id: 'provision', label: 'Intervening Event provision', keys: ['interveningEventProvision', 'boardChangeForInterveningEvent'], fallback: provisionFromText },
  { id: 'definition', label: 'Definition', keys: ['interveningEventDefinition', 'deal.nosol.definitions.interveningEvent'], fallback: definitionFromText },
  { id: 'scope', label: 'Scope', keys: ['interveningEventScope'], fallback: scopeFromText },
  { id: 'exceptions', label: 'Exceptions', keys: ['interveningEventExceptions'], fallback: exceptionsFromText },
  { id: 'termination', label: 'Termination right', keys: ['interveningEventTermination'], fallback: terminationFromText },
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
function isInterveningCard(card) {
  const code = cardCode(card);
  if (['NOSOL-INTERVENING', 'DEF-INTERVENING'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /intervening\s+event/i.test(`${card?.short_title || ''} ${textOf(card)}`);
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
      if (text) return prettifyScope(text);
    }
  }
  return null;
}
function sentence(text, pattern) {
  const match = text.match(pattern);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}
function provisionFromText(text) {
  if (/intervening\s+event/i.test(text) && /change|withdraw|modify|recommendation/i.test(text)) return 'Board change permitted for an Intervening Event';
  return /intervening\s+event/i.test(text) ? 'Yes' : null;
}
function definitionFromText(text) {
  return sentence(text, /Intervening\s+Event\s+means[^.]+(?:\.)?/i);
}
function scopeFromText(text) {
  if (/shall\s+not\s+include[^.]+Acquisition\s+Proposal/i.test(text) || /does\s+not\s+relate\s+to[^.]+Acquisition\s+Proposal/i.test(text)) return 'Positive / non-Acquisition Proposal events only';
  if (/intervening\s+event/i.test(text)) return 'Not limited to Acquisition Proposal events on the face of the card';
  return null;
}
function exceptionsFromText(text) {
  return sentence(text, /(?:shall\s+not\s+include|does\s+not\s+relate\s+to|provided\s+that)[^.]+(?:\.)?/i);
}
function terminationFromText(text) {
  if (/terminate[^.]+Intervening\s+Event/i.test(text)) return sentence(text, /[^.]*terminate[^.]+Intervening\s+Event[^.]*\.?/i);
  if (/Intervening\s+Event[^.]+termination/i.test(text)) return sentence(text, /[^.]*Intervening\s+Event[^.]+termination[^.]*\.?/i);
  return null;
}
function prettifyScope(text) {
  const code = String(text).trim().toUpperCase();
  if (code === 'POSITIVE_ONLY') return 'Positive / non-Acquisition Proposal events only';
  if (code === 'BOTH') return 'Positive and negative events';
  if (code === 'NA') return 'No Intervening Event provision';
  return text;
}
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const detail = firstFeature(cards, spec.keys) || spec.fallback(evidence);
  if (!detail) return null;
  return {
    id: `nosol-intervening-${spec.id}`,
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
  const tone = row.id.endsWith('exceptions') || row.id.endsWith('termination') ? 'warning' : 'info';
  // Bare value only -- the Term column already names this row.
  return { id: `${row.id}-signal`, label: row.detail, value: row.detail, tone, evidence: row.evidence, source: row.sourceCards?.[0] };
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

const nosolInterveningConfig = {
  id: 'nosol-intervening',
  title: 'Intervening Event Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isInterveningCard);
    if (!cards.length) return [];
    return ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
  },
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'party', header: 'Party', width: '12rem', renderCell: (row) => row.party },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No Intervening Event mechanics found.' },
};

export { nosolInterveningConfig, renderDetail, renderSignals, rowSignal };
