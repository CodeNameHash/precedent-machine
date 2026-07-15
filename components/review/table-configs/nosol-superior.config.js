import React from 'react';
import { cardFeatures, partySide, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';
import { BOARD_CHANGE_STANDARD_LABELS } from './board-change-standard.js';
import { FIDUCIARY_STANDARD_LABELS } from './fiduciary-standard-labels.js';
import taxonomy from '../../../lib/taxonomy.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt per REBUILD-SPECS.md §7. The five original rows (threshold, test,
// determiner, engage, final) keep their exact ids/keys/fallback-regex/detail
// synthesis -- unchanged data, so existing tests keep passing. Two rows are
// new: Fiduciary-out standard and Board-change standard (spec's explicit
// field list for this table), sourced from the WIDER no-solicitation family
// (they live on NOSOL-EXCEPT/NOSOL-RECOMMEND/NOSOL-MATCH cards, not the
// narrower Superior-Proposal-only card set `cards` below is filtered to).
// Rendering-only changes: long rows (the Superior Proposal test, the
// determiner/engagement sentences) collapse to a truncated "see text"
// preview instead of one giant pill, standard-shaped pills get the shared
// standard->colour treatment, and the Party column is dropped in favour of
// a header note (spec: two-column TERM | PROVISION by default).

const ROWS = [
  { id: 'threshold', label: 'Superior Proposal threshold', keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], fallback: thresholdFromText },
  { id: 'test', label: 'Superior Proposal test', keys: ['superiorProposalTest'], fallback: testFromText },
  { id: 'determiner', label: 'Determiner', keys: ['superiorProposalDeterminer'], fallback: determinerFromText },
  { id: 'engage', label: 'Engagement standard', keys: ['fiduciaryEngageStandard', 'engagementStandard'], fallback: engageFromText },
  { id: 'final', label: 'Final determination standard', keys: ['fiduciaryFinalStandard', 'changeRecStandard'], fallback: finalFromText },
];

// New rows (spec: fiduciaryOutStandard, boardChangeStandard). Structured-key
// lookup only -- these are always short codes on real deals, never prose.
const NEW_ROWS = [
  { id: 'fiduciary-standard', label: 'Fiduciary-out standard', keys: ['fiduciaryOutStandard'], format: fiduciaryStandardSummary },
  { id: 'board-change-standard', label: 'Board-change standard', keys: ['boardChangeStandard'], format: boardChangeStandardLabel },
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardType(card) {
  return String(card?.provision_type || '').trim().toUpperCase();
}
function isSuperiorCard(card) {
  const code = cardCode(card);
  if (['NOSOL-SUPERIOR', 'DEF-SUPERIOR'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /superior\s+(?:company\s+)?proposal/i.test(textOf(card)) || /superior/i.test(String(card?.short_title || ''));
}
// Broader than isSuperiorCard(): the two new cross-cutting fields
// (fiduciaryOutStandard, boardChangeStandard) live on NOSOL-EXCEPT /
// NOSOL-RECOMMEND / NOSOL-MATCH cards, which don't always mention "Superior
// Proposal" in their own text and so don't satisfy isSuperiorCard's regex.
function isNosolFamilyCard(card) {
  return cardType(card) === 'COVENANT_NO_SOLICITATION' || /^NOSOL(?:-|$)/.test(cardCode(card));
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
function thresholdFromText(text) {
  const match = text.match(/(\d{1,3})\s*%\s+(?:or\s+more\s+)?(?:of\s+(?:(?:the|its|Company)\s+){0,3})?(?:assets|equity|shares|stock|voting|revenues|earnings)/i);
  return match ? `${match[1]}%` : null;
}
function testFromText(text) {
  const match = text.match(/(?:more\s+favo[u]?rable|superior|greater\s+value)[^.]{0,240}/i);
  return match ? match[0].trim() : null;
}
function determinerFromText(text) {
  const match = text.match(/(?:Company\s+Board|Board|Special\s+Committee)[^.]{0,180}(?:financial advisor|outside legal counsel|good faith|determin)/i);
  return match ? match[0].trim() : null;
}
function engageFromText(text) {
  const match = text.match(/(?:constitutes|could\s+reasonably\s+be\s+expected|is\s+reasonably\s+likely)[^.]{0,160}lead\s+to\s+a\s+Superior\s+Proposal/i);
  return match ? match[0].trim() : null;
}
function finalFromText(text) {
  const match = text.match(/(?:constitutes|is|would\s+result\s+in)\s+a\s+Superior\s+Proposal/i);
  return match ? match[0].trim() : null;
}
// WS-G T6: "Company termination for Superior Proposal" now renders INSIDE
// this box instead of as a standalone termination-rights row (see
// termination-rights.config.js's TERMR_CANONICAL, where the 'superior' spec
// was removed). Sourced by exact code match against the TERMR-SUPERIOR
// card(s) directly -- NOT via nosol-fiduciary's cross-family regex fallback,
// which on real deals (e.g. Metsera) fails to match against the concatenated
// multi-card evidence blob and returns nothing. cardForCodes-style exact
// matching is reliable regardless of card text content.
function isTerminationSuperiorCard(card) {
  return String(card?.provision_subtype || '').trim().toUpperCase() === 'TERMR-SUPERIOR';
}
function terminationRow(allCards) {
  const matches = allCards.filter(isTerminationSuperiorCard);
  if (!matches.length) return null;
  // Prefer the fuller of the (typically two) TERMR-SUPERIOR cards -- the
  // Section 8.01(f) cross-reference is usually a one-line pointer, while the
  // Section 8.05(b) card carries the actual conditions (board authorization,
  // §5.02 compliance, concurrent fee payment).
  const card = matches.reduce((best, candidate) => (textOf(candidate).length > textOf(best).length ? candidate : best));
  const detail = textOf(card);
  if (!detail) return null;
  // Ben (round 6): "just say yes or 'yes if it simultaneously signs up'." Kept
  // under the pill length so it renders as a pill, not a collapsed preview.
  const summary = 'Yes — if it concurrently signs the alternative agreement (§5.02(a) not breached)';
  return {
    id: 'nosol-superior-termination',
    label: 'Company termination for Superior Proposal',
    party: partySide(card),
    detail: summary,
    evidence: matches.map(textOf).filter(Boolean).join('\n\n'),
    sourceCards: matches,
    present: true,
  };
}

// Ben (round 6): the Superior Proposal test is a two-limb standard -- surface
// each limb as its own crisp pill (Value / Deliverability), like the old
// scheme's superiorProposalLimbs, rather than dumping the whole definition.
function superiorTestLimbs(text) {
  const t = String(text || '');
  const items = [];
  if (/greater\s+value|more\s+favo|financial\s+point\s+of\s+view|financially\s+superior/i.test(t)) {
    items.push({ id: 'nosol-superior-test-value', label: 'Value — greater financial value to stockholders than the deal', tone: 'neutral' });
  }
  if (/reasonably\s+likely\s+to\s+be\s+(?:completed|consummated)|deliverab|reasonable\s+likelihood/i.test(t)) {
    items.push({ id: 'nosol-superior-test-deliverability', label: 'Deliverability — reasonably likely to be completed (financing / regulatory / timing)', tone: 'neutral' });
  }
  return items.length ? items : null;
}
function cleanDeterminer(text) {
  const t = String(text || '');
  if (/good\s+faith/i.test(t) && /(?:outside\s+(?:legal\s+)?counsel|financial\s+advisor)/i.test(t)) {
    return 'Company Board — in good faith, after outside counsel + financial advisor';
  }
  return t;
}
function pctFmt(raw) {
  const t = String(raw || '').trim();
  return /^\d+$/.test(t) ? `${t}%` : t;
}
// Canonical layer: superiorProposalDeterminer can carry an extraction-
// assigned SUPERIOR_DETERMINER code (either on a tagged {code,label,text}
// object, or -- back-compat -- as a bare code string). labelForCode()
// validates against the dict before returning, so a real prose determiner
// sentence (which never matches a dict key) safely falls through to null,
// leaving cleanDeterminer()'s regex-based summary as the transition-safe
// fallback.
function determinerCodeLabel(cards) {
  const dict = taxonomyForFeatureKey('superiorProposalDeterminer');
  for (const card of cards) {
    const raw = cardFeatures(card).superiorProposalDeterminer;
    if (raw === null || raw === undefined || raw === '') continue;
    const code = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw.code || raw.value)
      : (typeof raw === 'string' ? raw : null);
    const label = code ? labelForCode(String(code), dict) : null;
    if (label) return label;
  }
  return null;
}
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const raw = firstFeature(cards, spec.keys) || spec.fallback(evidence);
  if (!raw) return null;
  const detail = spec.id === 'determiner'
    ? (determinerCodeLabel(cards) || cleanDeterminer(raw))
    : spec.id === 'threshold' ? pctFmt(raw) : raw;
  const row = {
    id: `nosol-superior-${spec.id}`,
    label: spec.label,
    party: [...new Set(cards.map(partySide))].join(', ') || 'Target / Company',
    detail,
    evidence,
    sourceCards: cards,
    present: true,
  };
  if (spec.id === 'test') row.items = superiorTestLimbs(raw);
  return row;
}

// ── New-row synthesis (short codes -> friendly labels) ─────────────────────
function prettifyCode(code) {
  const s = String(code || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}
function fiduciaryStandardLabel(raw) {
  const text = valueText(raw);
  if (!text) return null;
  return FIDUCIARY_STANDARD_LABELS[text.trim().toLowerCase()] || prettifyCode(text);
}
function fiduciaryStandardSummary(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  const labels = [...new Set(items.map(fiduciaryStandardLabel).filter(Boolean))];
  return labels.length ? labels.join(' / ') : null;
}
function boardChangeStandardLabel(raw) {
  const text = valueText(raw);
  if (!text) return null;
  return BOARD_CHANGE_STANDARD_LABELS[text.trim().toUpperCase()] || prettifyCode(text);
}
function firstHit(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const raw = features[key];
      if (raw === null || raw === undefined || raw === '' || raw === false) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      return { card, raw };
    }
  }
  return null;
}
function newRow(spec, familyCards) {
  const hit = firstHit(familyCards, spec.keys);
  if (!hit) return null;
  const formatted = spec.format(hit.raw);
  if (!formatted) return null;
  return {
    id: `nosol-superior-${spec.id}`,
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
  const tone = row.id.endsWith('threshold') ? 'info' : row.id.endsWith('termination') ? 'warning' : 'neutral';
  // Bare value only -- the Term column already names this row.
  return { id: `${row.id}-signal`, label: row.detail, value: row.detail, tone, evidence: row.evidence, source: row.sourceCards?.[0] };
}
// Long definitional/prose rows (the Superior Proposal test, the
// determiner/engagement sentences) collapse to a truncated preview +
// click-to-open instead of one giant pill (spec: definitions collapsed,
// never dumped inline).
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
  // Two-limb Superior Proposal test -> one pill per limb (Value / Deliverability).
  if (Array.isArray(row.items) && row.items.length) {
    const PillCell = ctx?.primitives?.PillCell;
    if (!PillCell) return row.items.map((item) => item.label).join('; ');
    return React.createElement(
      'div',
      { className: 'flex flex-col items-start gap-1' },
      row.items.map((item) => React.createElement(PillCell, { key: item.id, label: item.label, tone: item.tone || 'neutral', evidence: row.evidence, source: row.sourceCards?.[0], wrap: true })),
    );
  }
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
// Party is uniform across this family (Target / Company on nearly every
// deal) -- hoisted into a header note instead of its own column, matching
// the two-column TERM | PROVISION default.
function deriveHeaderNote(rows) {
  const parties = [...new Set((rows || []).map((row) => row.party).filter(Boolean))];
  return parties.length ? `Party: ${parties.join(', ')}` : null;
}

const nosolSuperiorConfig = {
  id: 'nosol-superior',
  title: 'Superior Proposal Definition and Standards',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    const cards = allCards.filter(isSuperiorCard);
    const familyCards = allCards.filter(isNosolFamilyCard);
    const rows = ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
    const terminationRowResult = terminationRow(allCards);
    if (!rows.length && !familyCards.length && !terminationRowResult) return [];
    const newRows = NEW_ROWS.map((spec) => newRow(spec, familyCards)).filter(Boolean);
    return [...rows, ...newRows, ...(terminationRowResult ? [terminationRowResult] : [])];
  },
  deriveHeaderNote,
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
  empty: { copy: 'No Superior Proposal mechanics found.' },
};

export { nosolSuperiorConfig, renderSignals, rowSignal };
