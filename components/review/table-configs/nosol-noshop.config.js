import React from 'react';
import { cardFeatures, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';

// Rebuilt per REBUILD-SPECS.md §7: "core mechanics like old" -- the
// restriction/cease/exceptions/standstill rows below are the existing,
// tested content (kept byte-for-byte: same ids, same detail synthesis, same
// rowSignal/renderSignals/renderDetail pipeline) and MECHANIC_ROWS is the
// new pill strip Ben asked for -- Matching period, Notice, Superior- and
// Acquisition-proposal thresholds, Fiduciary-out standard, Change-of-
// Recommendation item count (+ collapsed list), Subsequent match period,
// plus the Acquisition Proposal definition collapsed underneath its
// threshold. Mechanic rows render first (the "core mechanics" lede); the
// restriction rows follow. selectRows/columns/exported name unchanged so
// pages/review/[id].js and the existing regression tests keep passing.

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

// New core-mechanics pill rows (spec §7). Structured-key lookups only (no
// regex-sentence fallback -- these are always short numbers/percentages/
// codes on real deals, never freeform prose), so on a fixture that doesn't
// carry these keys they simply don't render (existing ROWS above are
// unaffected and keep their exact ids/order/detail).
const MECHANIC_ROWS = [
  { id: 'matching-period', label: 'Matching period', keys: ['matchingPeriod'], format: daysLabel },
  { id: 'notice-hours', label: 'Notice', keys: ['discussionInitiationNoticeHours'], format: (raw) => hoursLabel(raw) },
  { id: 'superior-threshold', label: 'Superior-proposal threshold', keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], format: (raw) => pctLabel(raw) },
  { id: 'acquisition-threshold', label: 'Acquisition-proposal threshold', keys: ['acquisitionTransactionPctThreshold'], format: (raw) => pctLabel(raw) },
  { id: 'fiduciary-standard', label: 'Fiduciary-out standard', keys: ['fiduciaryOutStandard'], format: (raw) => fiduciaryStandardSummary(raw) },
  { id: 'subsequent-match', label: 'Subsequent match period', keys: ['subsequentMatchPeriodDays'], format: daysLabel },
  { id: 'acquisition-definition', label: 'Acquisition Proposal — definition', keys: ['acquisitionTransactionDefinition'], format: (raw) => valueText(raw) },
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function isNosolCard(card) {
  return card?.provision_type === 'COVENANT_NO_SOLICITATION' || /^NOSOL(?:-|$)/.test(cardCode(card));
}
function partySide(card) {
  const scope = String(card?.party_scope || '').toUpperCase();
  return scope === 'BUYER' || scope === 'PARENT' ? 'Buyer / Parent' : 'Target / Company';
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
// FEEDBACK-4-PUNCHLIST.md WS-G #1b: the prohibited-act list must render as
// individual pills (solicit / initiate / knowingly facilitate / provide
// information / engage in discussions), never one run-on blob. Real deals
// (e.g. Metsera) leave ceaseDiscussionsProhibitedList unpopulated, so the
// atomic acts have to be pulled out of the verbatim "shall not ... (i)
// solicit, initiate or knowingly facilitate ... or (ii) participate in
// discussions ... furnish ... information" prohibition sentence itself via
// keyword detection -- each pattern matches only the literal verbatim phrase
// already in the clause, nothing is invented.
const PROHIBITED_ACT_SPECS = [
  { id: 'solicit', label: 'Solicit', pattern: /\bsolicit(?:ation|ing)?\b/i },
  { id: 'initiate', label: 'Initiate', pattern: /\binitiat(?:e|ion|ing)\b/i },
  { id: 'facilitate', label: 'Knowingly facilitate / encourage', pattern: /knowingly\s+(?:facilitate|encourage)/i },
  { id: 'information', label: 'Provide information', pattern: /furnish[^.]*information|provid(?:e|ing)[^.]*information/i },
  { id: 'discussions', label: 'Engage in discussions or negotiations', pattern: /(?:participate|engage)\s+in\s+(?:any\s+)?discussions?(?:\s+or\s+negotiations?)?/i },
];

function prohibitedActsFor(matches) {
  // Prefer an already-itemized claim (ceaseDiscussionsProhibitedList
  // extracted as more than one distinct list entry) -- each entry IS already
  // one discrete prohibited act, so just render each as its own pill rather
  // than re-deriving from the raw clause.
  for (const card of matches) {
    const raw = cardFeatures(card).ceaseDiscussionsProhibitedList;
    if (Array.isArray(raw) && raw.length > 1) {
      const items = raw.map((item) => valueText(item)).filter(Boolean);
      if (items.length > 1) {
        return items.map((label, index) => ({ id: `claimed-${index}`, label, evidence: textOf(card), source: card }));
      }
    }
  }
  const text = matches.map(textOf).filter(Boolean).join('\n\n');
  const acts = PROHIBITED_ACT_SPECS
    .filter((spec) => spec.pattern.test(text))
    .map((spec) => ({ id: spec.id, label: spec.label, evidence: text, source: matches[0] }));
  return acts.length > 1 ? acts : null;
}

// WS-G #1c: exceptions must read as plain lawyer language ("what the
// exception actually permits"), not the raw statutory clause. These three
// patterns match the standard fiduciary-out carve-out drafting (clarify
// terms / furnish info under an Acceptable Confidentiality Agreement /
// negotiate) -- when a deal's exceptions clause doesn't match any of them,
// exceptionItemsFor() returns null and the row falls back to the existing
// collapsed-raw-text rendering rather than fabricating a plain-language gloss.
const EXCEPTION_SPECS = [
  { id: 'clarify', pattern: /contact[^.]*clarify|clarify the terms/i, label: "Contact the bidder solely to clarify the proposal's terms, or request that an oral proposal be put in writing" },
  { id: 'furnish-info', pattern: /furnish[^.]*information[^.]*Acceptable Confidentiality Agreement/i, label: 'Furnish confidential information to a Qualifying bidder under an Acceptable Confidentiality Agreement (Parent must receive the same information within 24 hours)' },
  { id: 'negotiate', pattern: /participate in discussions or negotiations/i, label: 'Participate in discussions or negotiations with a Qualifying bidder' },
];

function exceptionItemsFor(matches) {
  const text = matches.map(textOf).filter(Boolean).join('\n\n');
  const items = EXCEPTION_SPECS.filter((spec) => spec.pattern.test(text)).map((spec) => spec.label);
  return items.length ? items : null;
}

function rowForSpec(spec, cards) {
  const matches = cards.filter((card) => spec.codes.includes(cardCode(card)) || fallbackMatch(spec, card));
  if (!matches.length) return null;
  const detail = matches
    .map((card) => featureSummary(card, spec.keys) || textOf(card))
    .filter(Boolean)
    .join('\n\n');
  const parties = [...new Set(matches.map(partySide))].join(', ');
  const row = {
    id: `nosol-noshop-${spec.id}`,
    label: spec.label,
    party: parties || 'Target / Company',
    detail: detail || 'Present, detail not extracted',
    evidence: matches.map(textOf).filter(Boolean).join('\n\n'),
    sourceCards: matches,
    present: true,
  };
  if (spec.id === 'prohibit') row.acts = prohibitedActsFor(matches);
  if (spec.id === 'exceptions') row.exceptionItems = exceptionItemsFor(matches);
  return row;
}

// ── Core-mechanics pill synthesis ──────────────────────────────────────────
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
function hoursLabel(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? `${n} hour${n === 1 ? '' : 's'}` : null;
}
function pctLabel(raw) {
  const n = Number(raw);
  if (Number.isFinite(n)) return `${n}%`;
  const text = valueText(raw);
  if (!text) return null;
  return /%\s*$/.test(text) ? text : `${text}%`;
}
// Dash-case fiduciaryOutStandard codes seen on real deals -> a friendly
// phrase. Falls back to a lightly-prettified version of the raw code rather
// than ever showing it verbatim (global rule: codes are hover-title only).
const FIDUCIARY_STANDARD_LABELS = {
  'is-superior-proposal': 'Superior Proposal only',
  'constitutes-or-could-lead-to-superior': 'Constitutes or could lead to a Superior Proposal',
  'constitutes-or-could-reasonably-be-expected-to-lead-to-superior': 'Constitutes or could reasonably be expected to lead to a Superior Proposal',
  'continues-to-constitute-superior': 'Continues to constitute a Superior Proposal',
};
function prettifyCode(code) {
  const s = String(code || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}
function fiduciaryStandardLabel(raw) {
  const text = valueText(raw);
  if (!text) return null;
  const key = text.trim().toLowerCase();
  return FIDUCIARY_STANDARD_LABELS[key] || prettifyCode(text);
}
// A card can carry more than one fiduciaryOutStandard claim (e.g. engagement-
// stage vs match-stage wording) -- dedupe and join; the render layer
// auto-collapses this behind "see text" once it's long.
function fiduciaryStandardSummary(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  const labels = [...new Set(items.map(fiduciaryStandardLabel).filter(Boolean))];
  return labels.length ? labels.join(' / ') : null;
}

function firstHit(cards, keys) {
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const raw = features[key];
      if (raw === null || raw === undefined || raw === '' || raw === false) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      return { card, key, raw };
    }
  }
  return null;
}
function mechanicRow(spec, cards) {
  const hit = firstHit(cards, spec.keys);
  if (!hit) return null;
  const formatted = spec.format(hit.raw, textOf(hit.card));
  if (!formatted) return null;
  return {
    id: `nosol-noshop-${spec.id}`,
    label: spec.label,
    party: partySide(hit.card),
    detail: formatted,
    evidence: textOf(hit.card),
    sourceCards: [hit.card],
    present: true,
  };
}
// Change of Recommendation prohibited-action count: a "5 items" pill with
// the full A-E list behind a "see list" expander, never dumped inline.
function changeOfRecRow(cards) {
  const hit = firstHit(cards, ['changeOfRecommendationItems']);
  if (!hit) return null;
  const items = (Array.isArray(hit.raw) ? hit.raw : [hit.raw]).map((item) => valueText(item)).filter(Boolean);
  if (!items.length) return null;
  return {
    id: 'nosol-noshop-change-of-rec-count',
    label: 'Change of Recommendation — prohibited actions',
    party: partySide(hit.card),
    detail: `${items.length} item${items.length === 1 ? '' : 's'}`,
    evidence: textOf(hit.card),
    sourceCards: [hit.card],
    present: true,
    listItems: items,
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
function countListNode(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const pill = PillCell
    ? React.createElement(PillCell, { label: row.detail, tone: 'info', evidence: row.evidence, source: row.sourceCards?.[0] })
    : row.detail;
  return React.createElement(
    'div',
    { className: 'space-y-1' },
    pill,
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see list'),
      React.createElement(
        'ul',
        { className: 'mt-1 max-w-[36rem] list-disc pl-4 text-[11px] leading-5 text-inkLight' },
        row.listItems.map((text, index) => React.createElement('li', { key: index }, text)),
      ),
    ),
  );
}
// Long synthesized text (e.g. the Acquisition Proposal definition, or a
// fiduciary-out standard summary that concatenated two claims) collapses to
// a truncated preview + click-to-open, instead of one giant pill -- spec:
// "never a full-sentence text dump inline".
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
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see text'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        value,
      ),
    ),
  );
}
// Each prohibited act (or plain-language exception) renders as its own
// PillCell in a wrapping row, rather than one pill with a semicolon-joined
// label -- WS-G #1b/#1c.
function chipRowNode(chips, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return chips.map((chip) => chip.label).join(' · ');
  return React.createElement(
    'div',
    { className: 'flex flex-wrap gap-1' },
    chips.map((chip, index) => React.createElement(PillCell, {
      key: chip.id || index,
      label: chip.label,
      tone: 'info',
      evidence: chip.evidence,
      source: chip.source,
    })),
  );
}
function exceptionsListNode(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const label = `${row.exceptionItems.length} exception${row.exceptionItems.length === 1 ? '' : 's'}`;
  const pill = PillCell
    ? React.createElement(PillCell, { label, tone: 'warning', evidence: row.evidence, source: row.sourceCards?.[0] })
    : label;
  return React.createElement(
    'div',
    { className: 'space-y-1' },
    pill,
    React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see exceptions'),
      React.createElement(
        'ul',
        { className: 'mt-1 max-w-[36rem] list-disc pl-4 text-[11px] leading-5 text-inkLight' },
        row.exceptionItems.map((text, index) => React.createElement('li', { key: index }, text)),
      ),
    ),
  );
}
function renderSignals(row, ctx) {
  if (row.listItems) return countListNode(row, ctx);
  if (row.acts && row.acts.length) return chipRowNode(row.acts, ctx);
  if (row.exceptionItems && row.exceptionItems.length) return exceptionsListNode(row, ctx);
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
// Per user feedback: the obligated party (Target / Company on nearly every
// deal) was repeated on every row. Hoist it into a single section-level note
// instead of a per-row column -- still fully visible, just shown once.
function deriveHeaderNote(rows) {
  const parties = [...new Set((rows || []).map((row) => row.party).filter(Boolean))];
  if (parties.length === 0) return null;
  return `Party: ${parties.join(', ')}`;
}

const nosolNoshopConfig = {
  id: 'nosol-noshop',
  title: 'No-Shop Core Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isNosolCard);
    if (!cards.length) return [];
    const mechanicRows = [
      ...MECHANIC_ROWS.map((spec) => mechanicRow(spec, cards)),
      changeOfRecRow(cards),
    ].filter(Boolean);
    const restrictionRows = ROWS.map((row) => rowForSpec(row, cards)).filter(Boolean);
    return [...mechanicRows, ...restrictionRows];
  },
  deriveHeaderNote,
  columns: [
    { id: 'term', header: 'Term', width: '18rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', width: '18rem', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No no-shop core mechanics found.' },
};

export { deriveHeaderNote, nosolNoshopConfig, renderDetail, renderSignals, rowSignal };
