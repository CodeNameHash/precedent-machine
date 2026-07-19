import React from 'react';
import { normalizeTermfFeatures } from '../../../lib/termf.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

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
// Punchlist TF1 (round 3): "Termination scenarios" must render as
// individual PILLS, simplified -- not a long prose blob (the previous
// '\n\n'-joined single string, shown via TruncatedWithSeeText's "see text"
// expander, read as a wall of legal prose). Each scenario becomes its own
// short label:
//  - a bracketed short name attached to a section ref ("§8.01(d) [No-Vote]")
//    surfaces just the bracketed name ("No-Vote");
//  - a bare leading section reference ("Section 8.01(d): ...") is stripped;
//  - anything still long after that (e.g. the raw-text fallback path, which
//    has no structured scenario list to draw on) is capped at a short
//    label length -- the full clause is never lost, it stays reachable as
//    the pill's hover evidence.
function simplifyScenario(raw, max = 70) {
  const text = String(scalar(raw) ?? raw ?? '').trim();
  if (!text) return null;
  // Ben (round 6): summarize the tail-arming scenario to a crisp pill rather
  // than a truncated prose clause (the full clause stays as hover evidence).
  if (/(?:un-?withdrawn|not[^.]{0,20}withdrawn)/i.test(text) && /(?:takeover|acquisition)\s+proposal/i.test(text) && /terminat/i.test(text)) {
    return 'Terminated after an unwithdrawn Takeover Proposal';
  }
  const bracket = text.match(/\[([^\]]+)\]/);
  if (bracket && bracket[1].trim()) return bracket[1].trim();
  const stripped = text.replace(/^\s*(?:§|Section)\s*[\w.()-]+[:\-]?\s*/i, '').trim() || text;
  if (stripped.length <= max) return stripped;
  const cut = stripped.slice(0, max).replace(/\s+\S*$/, '').trim();
  return `${cut || stripped.slice(0, max)}…`;
}

function formatClauses(value) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  return list.map((item) => simplifyScenario(item)).filter(Boolean);
}

// Punchlist #40: the old "Triggering proposal" row derived a Same-proposal
// vs Any-proposal binary off tailFeeSameProposalRequired (and, in the old
// pre-rebuild UI, off text-sniffing "a bona fide" vs "the/such bona fide"
// phrasing). That framing is wrong for how a tail fee actually works: the
// fee is triggered by ANY qualifying transaction -- it need NOT be the same
// proposal that was on the table when the tail period started -- so long as
// a definitive agreement for it is SIGNED (executed) before the tail window
// closes; consummation itself can happen after the window ends.
//
// Punchlist TF2 (round 3): render that mechanic as ONE short, clear
// statement, not the verbose full-sentence explanation above (which read as
// a legal-drafting paragraph, not a table cell). tailFeeRecognitionEvent
// (when the extractor captured a short one) is appended as a brief
// parenthetical; a long/unparsed value is dropped from the cell rather than
// inflating it back into prose -- it's still reachable via the pill's hover
// evidence (primary_quote).
function formatTriggerScope(recognitionEvent) {
  const base = 'Any qualifying transaction signed within the tail period';
  const inner = scalar(recognitionEvent);
  const recognition = typeof inner === 'string' ? inner.trim() : (inner === null || inner === undefined ? '' : String(inner).trim());
  if (recognition && recognition.length <= 60) return `${base} (recognition event: ${recognition})`;
  return base;
}

function signalTone(id) {
  if (id === 'tail-window' || id === 'tail-threshold') return 'info';
  return 'neutral';
}

// Punchlist #38/#39: collapse the old Signals + Mechanic columns into ONE
// "Signals" column -- the two used to show the SAME value twice (once as a
// pill, once as a Mechanic-column echo) for every row. Punchlist TF1 (round
// 3) revises the 'tail-arming' row specifically: it no longer joins its
// scenarios into one long string behind a "see text" expander -- each
// scenario in row.value (an array; see formatClauses/simplifyScenario
// above) renders as its OWN short pill, so the row reads as a set of
// discrete facts rather than a prose blob. Falls back to a plain
// '·'-joined text line when no PillCell primitive is supplied (matches the
// fallback convention used elsewhere in this file).
function renderSignals(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (row.id === 'tail-arming') {
    const items = Array.isArray(row.value) ? row.value.filter(Boolean) : [];
    if (!items.length) return 'Not specified';
    if (!PillCell) return items.join(' · ');
    return React.createElement(
      'div',
      { className: 'flex flex-wrap gap-1' },
      items.map((item, index) => React.createElement(PillCell, {
        key: index,
        label: item,
        tone: 'neutral',
        evidence: row.evidence,
        source: row.sourceCard,
      })),
    );
  }
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
      { id: 'tail-arming', label: 'Termination scenarios', value: formatClauses(features.tailFeeActivatingClauses), evidence: textOf(source), sourceCard: source, present: true },
      { id: 'tail-trigger-scope', label: 'Qualifying transaction scope', value: formatTriggerScope(features.tailFeeRecognitionEvent), evidence: textOf(source), sourceCard: source, present: true },
    ];
  },
  // Tidy per REBUILD-SPECS.md §11, revised per punchlist #38: TWO columns
  // (Term / Signals) -- the old third "Mechanic" column duplicated whatever
  // Signals already showed for every row but one. Evidence is still one
  // hover away: PillCell and TruncatedWithSeeText both wrap their content in
  // EvidenceHoverSource already.
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
  empty: { copy: 'No tail-fee mechanics found.' },
};

export { formatTriggerScope, renderSignals, tailFeeConfig };
