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
function formatClauses(value) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!list.length) return 'Not specified';
  return list.map((item) => String(scalar(item) || item).trim()).filter(Boolean).join('\n\n');
}

// Punchlist #40: the old "Triggering proposal" row derived a Same-proposal
// vs Any-proposal binary off tailFeeSameProposalRequired (and, in the old
// pre-rebuild UI, off text-sniffing "a bona fide" vs "the/such bona fide"
// phrasing). That framing is wrong for how a tail fee actually works: the
// fee is triggered by ANY qualifying transaction -- it need NOT be the same
// proposal that was on the table when the tail period started -- so long as
// a definitive agreement for it is SIGNED (executed) before the tail window
// closes; consummation itself can happen after the window ends. Render that
// fixed, legally-accurate description rather than branching on a flag whose
// "same vs any" premise doesn't match the mechanic. tailFeeRecognitionEvent
// (when the extractor captured it) names the deal's actual recognition
// event ("consummation" vs "definitive agreement later consummated") and is
// appended as a real per-deal fact on top of the base description.
function formatTriggerScope(recognitionEvent) {
  const base = 'Any qualifying transaction triggers the fee -- it need not be the proposal on the table when the tail period began -- so long as a definitive agreement is signed before the tail window closes; closing itself may follow later.';
  const inner = scalar(recognitionEvent);
  const recognition = typeof inner === 'string' ? inner.trim() : (inner === null || inner === undefined ? '' : String(inner).trim());
  return recognition ? `${base} Recognition event per the agreement: ${recognition}.` : base;
}

function signalTone(id) {
  if (id === 'tail-window' || id === 'tail-threshold') return 'info';
  return 'neutral';
}

// Punchlist #38/#39: collapse the old Signals + Mechanic columns into ONE
// "Signals" column -- the two used to show the SAME value twice (once as a
// pill, once as a Mechanic-column echo) for every row except 'tail-arming',
// whose long activating-clauses prose only ever showed up in Mechanic (its
// old Signals cell rendered nothing). Now every row renders its full value
// in this single column: short scalar rows as a pill, the long-prose
// 'tail-arming' row through TruncatedWithSeeText's truncate + "see text"
// affordance (the "termination scenarios" content now lives in the signals
// column, not a second column).
function renderSignals(row, ctx) {
  if (row.id === 'tail-arming') {
    const TruncatedWithSeeText = ctx?.primitives?.TruncatedWithSeeText;
    if (!TruncatedWithSeeText) return row.value;
    return React.createElement(TruncatedWithSeeText, { text: row.value, evidence: row.evidence, source: row.sourceCard });
  }
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return row.value;
  return React.createElement(PillCell, {
    label: row.value,
    value: row.value,
    tone: signalTone(row.id),
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
      features.tailFeeRecognitionEvent,
    ].some((value) => value !== null && value !== undefined && value !== '');
    if (!hasTail) return [];
    return [
      { id: 'tail-window', label: 'Tail window', value: formatWindow(features.tailFeeWindowMonths), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-threshold', label: 'Threshold % for Company Takeover Proposal', value: formatPct(features.tailFeeThresholdPct), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-arming', label: 'Termination scenarios that arm the tail', value: formatClauses(features.tailFeeActivatingClauses), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-trigger-scope', label: 'Qualifying transaction scope', value: formatTriggerScope(features.tailFeeRecognitionEvent), evidence: textOf(source), sourceCard: source, present: true },
    ];
  },
  // Tidy per REBUILD-SPECS.md §11, revised per punchlist #38: TWO columns
  // (Term / Signals) -- the old third "Mechanic" column duplicated whatever
  // Signals already showed for every row but one. Evidence is still one
  // hover away: PillCell and TruncatedWithSeeText both wrap their content in
  // EvidenceHoverSource already.
  columns: [
    { id: 'term', header: 'Term', width: '20rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
  empty: { copy: 'No tail-fee mechanics found.' },
};

export { formatTriggerScope, renderSignals, tailFeeConfig };
