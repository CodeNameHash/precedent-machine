import React from 'react';
import { cardFeatures, partySide, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';
import { BOARD_CHANGE_STANDARD_LABELS } from './board-change-standard.js';

// Rebuilt per REBUILD-SPECS.md §7. Kept as its own standalone span block
// (Ben likes Intervening Event separate from the other No-Solicitation
// tables). The five original rows keep their exact ids/keys/fallback
// regexes/detail synthesis unchanged (existing tests assert on both the
// array order and individual `.detail` values). Three rows are new --
// Board-change standard, Notice period, Matching period -- inserted so the
// final reading order matches the precedent Ben asked for: definition ->
// scope -> board-change standard -> notice/match -> (existing) exceptions
// -> termination. The Definition row (and any other row whose synthesized
// text runs long) collapses to a truncated "see text" preview instead of a
// giant pill; `detail` stays wired into ProvisionTable's FULL_TEXT_COLUMNS
// per-row "see text" expander exactly as before.

const ROWS = [
  { id: 'provision', label: 'Intervening Event provision', keys: ['interveningEventProvision', 'boardChangeForInterveningEvent'], fallback: provisionFromText },
  { id: 'definition', label: 'Definition', keys: ['interveningEventDefinition', 'deal.nosol.definitions.interveningEvent'], fallback: definitionFromText },
  { id: 'scope', label: 'Scope', keys: ['interveningEventScope'], fallback: scopeFromText },
  { id: 'exceptions', label: 'Exceptions', keys: ['interveningEventExceptions'], fallback: exceptionsFromText },
  { id: 'termination', label: 'Termination right', keys: ['interveningEventTermination'], fallback: terminationFromText },
];

// New rows (spec: board-change standard, notice/match periods). Reading
// order handled separately below (ORDERED_IDS) so the old five keep their
// exact relative order for the existing array-order assertions.
const NEW_ROWS = [
  { id: 'board-change-standard', label: 'Board-change standard', keys: ['boardChangeStandard'], format: boardChangeStandardLabel },
  { id: 'notice-period', label: 'Notice period', keys: ['noticePeriod'], format: daysLabel },
  { id: 'matching-period', label: 'Matching period', keys: ['matchingPeriod'], format: daysLabel },
];

// definition -> scope -> board-change standard -> notice/match, per
// precedent; provision/exceptions/termination (existing rows, not in the
// spec's explicit list but genuinely substantive) keep their original
// relative position around the new rows.
const ORDERED_IDS = ['provision', 'definition', 'scope', 'board-change-standard', 'notice-period', 'matching-period', 'exceptions', 'termination'];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function isInterveningCard(card) {
  const code = cardCode(card);
  if (['NOSOL-INTERVENING', 'DEF-INTERVENING'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /intervening\s+event/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
// textOf is imported from card-utils.js (see above) rather than defined
// locally, for the same reason as valueText below.
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
// Ben (round 6): render "Yes"/"No", never a bare "true"/"false".
function yesNo(detail) {
  const t = String(detail || '').trim().toLowerCase();
  if (t === 'true') return 'Yes';
  if (t === 'false') return 'No';
  return detail;
}
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const detail = yesNo(firstFeature(cards, spec.keys) || spec.fallback(evidence));
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

// ── New-row synthesis (short codes -> friendly labels) ─────────────────────
function prettifyCode(code) {
  const s = String(code || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}
function boardChangeStandardLabel(raw) {
  const text = valueText(raw);
  if (!text) return null;
  return BOARD_CHANGE_STANDARD_LABELS[text.trim().toUpperCase()] || prettifyCode(text);
}
function unitForDays(evidenceText) {
  const text = String(evidenceText || '').toLowerCase();
  if (/business\s*day/.test(text)) return 'business day';
  if (/calendar\s*day/.test(text)) return 'calendar day';
  return 'day';
}
function daysLabel(raw, evidenceText) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const unit = unitForDays(evidenceText);
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}
function firstHit(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const raw = features[key];
      if (raw === null || raw === undefined || raw === '' || raw === false) continue;
      return { card, raw };
    }
  }
  return null;
}
function newRow(spec, cards) {
  const hit = firstHit(cards, spec.keys);
  if (!hit) return null;
  const formatted = spec.format(hit.raw, textOf(hit.card));
  if (!formatted) return null;
  return {
    id: `nosol-intervening-${spec.id}`,
    label: spec.label,
    party: partySide(hit.card),
    detail: formatted,
    evidence: textOf(hit.card),
    sourceCards: [hit.card],
    present: true,
  };
}

function rowSignal(row) {
  if (!row?.detail) return null;
  const tone = row.id.endsWith('exceptions') || row.id.endsWith('termination') ? 'warning' : 'info';
  // Bare value only -- the Term column already names this row.
  return { id: `${row.id}-signal`, label: row.detail, value: row.detail, tone, evidence: row.evidence, source: row.sourceCards?.[0] };
}
// Long text (the Definition row, occasionally Exceptions/Termination)
// collapses to a truncated preview + click-to-open instead of one giant pill
// (spec: Definition must be collapsed, key portion only, never dumped).
function collapsedTextNode(text) {
  const { value, short, truncated } = splitForCell(text, 90);
  if (!value) return null;
  if (!truncated) return React.createElement('span', { className: 'text-[11px] text-ink' }, value);
  return React.createElement(
    'span',
    null,
    React.createElement('span', { className: 'text-[11px] text-ink' }, `${short}…`),
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see definition'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        value,
      ),
    ),
  );
}
function renderSignals(row, ctx) {
  const signal = rowSignal(row);
  if (!signal) return '';
  if (String(signal.label).length > 90) return collapsedTextNode(signal.label);
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return signal.label;
  return React.createElement(PillCell, {
    label: signal.label,
    value: signal.value,
    tone: signal.tone,
    color: standardColorKey(signal.label),
    evidence: signal.evidence,
    source: signal.source,
  });
}
function renderDetail(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.detail;
  return React.createElement(EvidenceHoverSource, { value: row.detail, evidence: row.evidence, source: row.sourceCards?.[0], as: 'span' }, row.detail);
}
// Party is uniform across this family -- hoisted into a header note instead
// of its own column, matching the two-column TERM | PROVISION default.
function deriveHeaderNote(rows) {
  const parties = [...new Set((rows || []).map((row) => row.party).filter(Boolean))];
  return parties.length ? `Party: ${parties.join(', ')}` : null;
}

const nosolInterveningConfig = {
  id: 'nosol-intervening',
  title: 'Intervening Event Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isInterveningCard);
    if (!cards.length) return [];
    const byId = {};
    for (const row of ROWS) byId[row.id] = rowForSpec(row, cards);
    for (const spec of NEW_ROWS) byId[spec.id] = newRow(spec, cards);
    return ORDERED_IDS.map((id) => byId[id]).filter(Boolean);
  },
  deriveHeaderNote,
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No Intervening Event mechanics found.' },
};

export { nosolInterveningConfig, renderDetail, renderSignals, rowSignal };
