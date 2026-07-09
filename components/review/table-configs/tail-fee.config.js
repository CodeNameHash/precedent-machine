import React from 'react';
import { normalizeTermfFeatures } from '../../../lib/termf.js';

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function isTermfCard(card) {
  return card?.provision_type === 'TERMINATION_FEE' || /^TERMF(?:-|$)/.test(cardCode(card));
}
function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}
function scalar(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value.value ?? value.text ?? value.label ?? value.code ?? null;
  return value;
}
function combineFeatures(cards) {
  let combined = {};
  for (const card of cards) combined = { ...combined, ...normalizeTermfFeatures(cardFeatures(card), cardCode(card)) };
  return combined;
}
function sourceCard(cards, features) {
  return cards.find((card) => cardCode(card) === 'TERMF-TAIL') ||
    cards.find((card) => Object.keys(normalizeTermfFeatures(cardFeatures(card), cardCode(card))).some((key) => key.startsWith('tailFee'))) ||
    cards.find((card) => /tail|within\s+\d+\s+months|takeover\s+proposal/i.test(textOf(card)));
}
function fallbackFromText(card) {
  const text = textOf(card);
  if (!text) return {};
  const window = text.match(/within\s+(\d+)\s+months?/i);
  const threshold = text.match(/(\d{1,3})\s*%\s+(?:or\s+more\s+)?(?:of\s+(?:the|its)\s+)?(?:equity|stock|shares|assets|voting)/i);
  return {
    tailFeeWindowMonths: window ? window[1] : null,
    tailFeeThresholdPct: threshold ? threshold[1] : null,
    tailFeeActivatingClauses: /takeover|acquisition|alternative\s+transaction|superior\s+proposal/i.test(text) ? [text] : [],
  };
}
function formatWindow(value) {
  const inner = scalar(value);
  if (inner === null) return 'Not specified';
  return /^\d+(\.\d+)?$/.test(String(inner).trim()) ? `${inner} months` : String(inner);
}
function formatPct(value) {
  const inner = scalar(value);
  if (inner === null) return 'Not specified';
  return /^\d+(\.\d+)?$/.test(String(inner).trim()) ? `${inner}%` : String(inner);
}
function formatBool(value) {
  const inner = scalar(value);
  if (inner === true || inner === 'true' || inner === 'yes') return 'Same proposal required';
  if (inner === false || inner === 'false' || inner === 'no') return 'Any later qualifying proposal can trigger';
  return inner === null ? 'Not specified' : String(inner);
}
function formatClauses(value) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!list.length) return 'Not specified';
  return list.map((item) => String(scalar(item) || item).trim()).filter(Boolean).join('\n\n');
}
function mechanicTone(id) {
  if (id === 'tail-same-proposal') return 'warning';
  if (id === 'tail-window' || id === 'tail-threshold') return 'info';
  return 'neutral';
}
// 'tail-window'/'tail-threshold'/'tail-same-proposal' values are short
// scalars (e.g. "12 months") and pass through TruncatedWithSeeText
// unchanged. 'tail-arming' is the one row whose value is the full joined
// activating-clauses text (up to ~1,500 chars) — truncation keeps the
// Mechanic column compact for every row without a per-row special case;
// the untruncated list is still one click away via "see text".
function renderMechanic(row, ctx) {
  const ThresholdCellWithHoverQuote = ctx?.primitives?.ThresholdCellWithHoverQuote;
  const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
  if (row.id === 'tail-threshold' && ThresholdCellWithHoverQuote) {
    return React.createElement(ThresholdCellWithHoverQuote, {
      threshold: row.value,
      evidence: row.evidence,
      source: row.sourceCard,
    });
  }
  if (!TruncatedWithSeeText) return row.value;
  return React.createElement(TruncatedWithSeeText, { text: row.value, evidence: row.evidence, source: row.sourceCard });
}
// Bare value only -- the Term column already names this row, and the
// Mechanic column already shows the full value; the pill is just a scannable
// echo of it, not a second, differently-labeled copy. 'tail-arming' is
// skipped here: its value is the full joined activating-clauses prose (up to
// ~1,500 chars), and a pill is the wrong shape for a text dump (global rule:
// pills are for enum/quantitative signals, not full-sentence prose) -- the
// Mechanic column's truncated "see text" already carries it.
function renderSignals(row, ctx) {
  if (row.id === 'tail-arming') return null;
  const PillCell = ctx?.primitives?.PillCell;
  const label = row.value;
  if (!PillCell) return label;
  return React.createElement(PillCell, {
    label,
    value: row.value,
    tone: mechanicTone(row.id),
    evidence: row.evidence,
    source: row.sourceCard,
  });
}

const tailFeeConfig = {
  id: 'tail-fee',
  title: 'Tail Fee Mechanics',
  layoutSlot: 'termination-fees',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isTermfCard);
    if (!cards.length) return [];
    const source = sourceCard(cards, {});
    const features = { ...fallbackFromText(source), ...combineFeatures(cards) };
    const hasTail = [
      features.tailFeeWindowMonths,
      features.tailFeeThresholdPct,
      ...(Array.isArray(features.tailFeeActivatingClauses) ? features.tailFeeActivatingClauses : []),
      features.tailFeeSameProposalRequired,
    ].some((value) => value !== null && value !== undefined && value !== '');
    if (!hasTail) return [];
    return [
      { id: 'tail-window', label: 'Tail window', value: formatWindow(features.tailFeeWindowMonths), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-threshold', label: 'Threshold % for Company Takeover Proposal', value: formatPct(features.tailFeeThresholdPct), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-arming', label: 'Termination scenarios that arm the tail', value: formatClauses(features.tailFeeActivatingClauses), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-same-proposal', label: 'Triggering proposal', value: formatBool(features.tailFeeSameProposalRequired), evidence: textOf(source), sourceCard: source, present: true },
    ];
  },
  // Tidy per REBUILD-SPECS.md §11: three columns (Term / Signals / Mechanic),
  // matching the rest of the app's clean-row shape -- the old fourth
  // "Evidence" column always-rendered the SAME card quote, verbatim, on
  // every one of the four rows (a straight text dump repeated 4x). Evidence
  // is still one hover away: PillCell and the Mechanic-column primitives
  // (ThresholdCellWithHoverQuote / TruncatedWithSeeText) all wrap their
  // content in EvidenceHoverSource already.
  columns: [
    { id: 'term', header: 'Term', width: '20rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Signals', width: '18rem', renderCell: renderSignals },
    { id: 'value', header: 'Mechanic', renderCell: renderMechanic },
  ],
  empty: { copy: 'No tail-fee mechanics found.' },
};

export { renderMechanic, renderSignals, tailFeeConfig };
