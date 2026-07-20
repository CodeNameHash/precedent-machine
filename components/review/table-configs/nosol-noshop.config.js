import React from 'react';
import { cardFeatures, partySide, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';
import { FIDUCIARY_STANDARD_LABELS } from './fiduciary-standard-labels.js';
import taxonomy from '../../../lib/taxonomy.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

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

// Ben (round 6): the ceaseDiscussionsProhibitedList entries are stored as long
// verbatim clause limbs ("directly or indirectly participate in any discussions
// or negotiations regarding, furnish ..."). Tighten each to a crisp pill; the
// verbatim stays as the pill's hover evidence.
const PROHIBIT_ACT_SUMMARY = [
  { test: /participate\s+in\s+(?:any\s+)?discussions|negotiations|furnish|provide[^.]*information|assist/i, label: 'Participate in discussions / furnish information' },
  { test: /solicit|initiate|encourage|facilitate/i, label: 'Solicit, initiate, encourage or facilitate a proposal' },
  { test: /waiver\s+or\s+release|standstill|terminate,?\s+amend|release under any restriction/i, label: 'Grant a waiver / release under a standstill' },
];
function summarizeProhibitedAct(text) {
  const t = String(text || '').trim();
  // Already-crisp list entries (e.g. "solicit") stay verbatim; only long
  // verbatim clause limbs get summarized.
  if (t.length <= 45) return t;
  const spec = PROHIBIT_ACT_SUMMARY.find((s) => s.test.test(t));
  // E (truncation sweep, nosol grouped-sub-row): drop the literal "…" --
  // this label renders as a PillCell with the full clause as hover
  // evidence.
  return spec ? spec.label : splitForCell(t, 60).short;
}
// Canonical layer: an item's `.code` (assigned by extraction against the
// SOLICITATION_ACT vocabulary) resolves to a stable, cross-deal-identical
// label via labelForCode() -- preferred over the regex-driven
// summarizeProhibitedAct() below, which is deal-specific phrasing guesswork.
// Returns null when the item carries no valid code, so callers fall back to
// summarizeProhibitedAct() exactly as before (transition-safe pre-reprocess).
function prohibitedActCodeLabel(item) {
  const code = item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
  return code ? labelForCode(String(code), taxonomyForFeatureKey('ceaseDiscussionsProhibitedList')) : null;
}
function prohibitedActsFor(matches) {
  // Prefer an already-itemized claim (ceaseDiscussionsProhibitedList
  // extracted as one or more distinct list entries). Each entry is one
  // prohibited/cease act -- summarize it to a crisp pill and dedupe.
  // Item 4 (r6): originally required raw.length > 1 AND entries.length > 1,
  // which silently starved any card whose ceaseDiscussionsProhibitedList
  // carries exactly ONE itemized, coded entry (e.g. SkyWater's NOSOL-ENFORCE
  // card: a single WAIVE_STANDSTILL item) back to the long-form text
  // fallback below -- a single coded act is still a pill, not a reason to
  // fall through to raw prose.
  for (const card of matches) {
    const raw = cardFeatures(card).ceaseDiscussionsProhibitedList;
    if (Array.isArray(raw) && raw.length >= 1) {
      const entries = raw
        .map((item) => ({ item, verbatim: valueText(item) }))
        .filter((entry) => entry.verbatim);
      if (entries.length >= 1) {
        const seen = new Set();
        const acts = [];
        entries.forEach(({ item, verbatim }, index) => {
          const label = prohibitedActCodeLabel(item) || summarizeProhibitedAct(verbatim);
          if (!label || seen.has(label)) return;
          seen.add(label);
          acts.push({ id: `claimed-${index}`, label, evidence: verbatim, source: card });
        });
        return acts;
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

// FIX 8 (Fable investigation): the 3 hardcoded EXCEPTION_SPECS regex glosses
// missed most real drafting (SkyWater matches 0/3, QXO 1/3), collapsing to
// the raw-text fallback on the majority of deals. Render canonical taxonomy
// codes off ceaseDiscussionsExceptions/permittedExceptions FIRST -- these
// are the same claim codes extraction already assigns, cross-deal-stable,
// and cover far more drafting variety than 3 hand-picked patterns ever
// could. The legacy regex glosses stay as a second-tier fallback (still
// useful pre-reprocess or on a deck that genuinely carries no coded
// exceptions), and the existing collapsed-raw-text rendering remains the
// final fallback (null) when neither source yields anything.
function taxonomyEntriesFromMatches(matches, keys) {
  const out = [];
  for (const card of matches) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const raw = features[key];
      if (raw === null || raw === undefined || raw === '') continue;
      const dict = taxonomyForFeatureKey(key);
      const list = Array.isArray(raw) ? raw : [raw];
      for (const item of list) {
        const tagged = item && typeof item === 'object' && !Array.isArray(item);
        const code = tagged ? item.code : (typeof item === 'string' ? item : null);
        const dictLabel = code ? labelForCode(String(code), dict) : null;
        const label = dictLabel || (tagged ? item.label : null);
        if (!label) continue;
        const evidence = (tagged && (item.text || (Array.isArray(item.quotes) && item.quotes[0]))) || textOf(card);
        out.push({ code: code || label, label, evidence, source: card });
      }
    }
  }
  const seen = new Set();
  return out.filter((entry) => {
    if (seen.has(entry.label)) return false;
    seen.add(entry.label);
    return true;
  });
}
function exceptionItemsFor(matches) {
  const canonical = taxonomyEntriesFromMatches(matches, ['ceaseDiscussionsExceptions', 'permittedExceptions']);
  if (canonical.length) return canonical;
  // Legacy fallback keeps its original plain-string-array shape (no
  // per-item evidence/source split) -- transition-safe for callers/tests
  // that pre-date FIX 8's canonical path.
  const text = matches.map(textOf).filter(Boolean).join('\n\n');
  const legacy = EXCEPTION_SPECS.filter((spec) => spec.pattern.test(text)).map((spec) => spec.label);
  return legacy.length ? legacy : null;
}

// A card whose own code matches spec.codes is always kept. The regex
// fallback exists only for decks where extraction never assigned one of
// these codes at all -- it must NOT also fire alongside a real code match,
// or a loosely-worded sibling card (e.g. NOSOL-CEASE's "solicitations" text
// also satisfies the 'prohibit' fallback regex) gets pulled into this row's
// matches and, since prohibitedActsFor()/detail-join read off `matches` in
// order, can shadow or blend with the row's own card's content (Metsera:
// the 'prohibit' row rendered NOSOL-CEASE's ceaseDiscussionsProhibitedList
// pills instead of NOSOL-PROHIBIT's own -- a stray, mislabeled pill set).
function rowForSpec(spec, cards) {
  const codeMatches = cards.filter((card) => spec.codes.includes(cardCode(card)));
  const matches = codeMatches.length ? codeMatches : cards.filter((card) => fallbackMatch(spec, card));
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
    // Sidebar redesign item 2/4: thread the row's own claim attribute(s)
    // through to resolveRowFocus/ClauseSidebar so corpus context can be
    // scoped to exactly this row's feature (e.g.
    // ceaseDiscussionsProhibitedList), not a generic parent-card summary.
    featureKeys: spec.keys || null,
    present: true,
  };
  // Item 4 (r6): 'cease' (immediate cease-existing-activity obligations --
  // CEASE_EXISTING_ACTIVITY / TERMINATE_DATAROOM / REQUEST_RETURN_DESTROY)
  // and 'standstill-enforce' (WAIVE_STANDSTILL) carry the exact same
  // itemized, taxonomy-coded ceaseDiscussionsProhibitedList shape as
  // 'prohibit' -- they were just never wired to prohibitedActsFor(), so they
  // fell all the way through to the long-form raw-text row render below even
  // when the coded pills were sitting right there in the claim.
  if (spec.id === 'prohibit' || spec.id === 'cease' || spec.id === 'standstill-enforce') row.acts = prohibitedActsFor(matches);
  if (spec.id === 'exceptions') row.exceptionItems = exceptionItemsFor(matches);
  // Ben (round 6): the don't-ask-don't-waive row showed a raw snippet -- give
  // the actual summary of when the standstill can be waived.
  if (spec.id === 'standstill-enforce') row.detail = summarizeStandstill(row.detail);
  return row;
}
function summarizeStandstill(text) {
  const t = String(text || '');
  if (/inconsistent with[^.]*fiduciary|good\s+faith/i.test(t)) return 'Standstill waivable only on a good-faith fiduciary-duty determination by the Board';
  if (/don.?t[- ]ask[- ]don.?t[- ]waive/i.test(t)) return "Don't-ask-don't-waive: standstill not waived on request";
  return t;
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
// Canonical layer: prefer an item's `.code` (SOLICITATION_ACT vocabulary)
// over its raw verbatim text -- same code reads identically across deals.
// Falls back to valueText(item) (the pre-canonical rendering) when no valid
// code is present, so the item count / listed text stay transition-safe.
function changeOfRecItemLabel(item) {
  const code = item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
  const canonical = code ? labelForCode(String(code), taxonomyForFeatureKey('changeOfRecommendationItems')) : null;
  return canonical || valueText(item);
}
// Change of Recommendation prohibited-action count: a "5 items" pill with
// the full A-E list behind a "see list" expander, never dumped inline.
function changeOfRecRow(cards) {
  const hit = firstHit(cards, ['changeOfRecommendationItems']);
  if (!hit) return null;
  const items = (Array.isArray(hit.raw) ? hit.raw : [hit.raw]).map(changeOfRecItemLabel).filter(Boolean);
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
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
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
// a truncated preview instead of one giant pill -- spec: "never a
// full-sentence text dump inline". This preview never carries its own "see
// text" toggle: this row's full `detail` is always ALSO rendered behind
// exactly one "see text" expander elsewhere -- the standalone table's
// relocated 'detail' column (ProvisionTable.jsx's FULL_TEXT_COLUMNS) or, in
// the merged nosol-section view, rowNode()'s outer seeText(detail) wrap.
// Giving this preview its own second toggle duplicated that same full text
// behind two "see text" disclosures on the same row (Metsera: Cease
// discussions / standstill enforcement).
function collapsedTextNode(text) {
  // E (truncation sweep): drop the literal "…" -- the full text is always
  // also reachable behind the row's own single "see text" expander
  // elsewhere on the page (see comment above), so this preview doesn't need
  // its own ellipsis indicator.
  const { short } = splitForCell(text, 90);
  if (!short) return null;
  return React.createElement('span', { className: 'text-[11px] text-ink' }, short);
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
// Ben (round 6): "just say 3 exceptions -- show them!" Each plain-language
// exception renders as its own pill (stacked, since they're full sentences),
// not a "3 exceptions" count behind a "see exceptions" expander.
// Items are either plain strings (legacy EXCEPTION_SPECS glosses, or the
// pre-FIX-8 shape) or { code, label, evidence, source } entries (FIX 8's
// canonical taxonomy-coded exceptions) -- each entry's own evidence/source
// wins when present so a pill hovers to the specific clause it came from,
// falling back to the row-level evidence/source for plain strings.
function exceptionsListNode(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const items = row.exceptionItems.map((item) => (typeof item === 'string'
    ? { label: item, evidence: row.evidence, source: row.sourceCards?.[0] }
    : { label: item.label, evidence: item.evidence || row.evidence, source: item.source || row.sourceCards?.[0], code: item.code }));
  if (!PillCell) return items.map((item) => item.label).join(' · ');
  return React.createElement(
    'div',
    { className: 'flex flex-col items-start gap-1' },
    items.map((item, index) => React.createElement(PillCell, {
      key: item.code || index,
      label: item.label,
      tone: 'warning',
      evidence: item.evidence,
      source: item.source,
      wrap: true,
    })),
  );
}
function renderSignals(row, ctx) {
  if (row.listItems) return countListNode(row, ctx);
  if (row.acts && row.acts.length) return chipRowNode(row.acts, ctx);
  if (row.exceptionItems && row.exceptionItems.length) return exceptionsListNode(row, ctx);
  const signal = rowSignal(row);
  if (!signal) return '';
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return signal.label;
  // Long signals (e.g. standstill/don't-ask-don't-waive enforcement
  // language) stay in pill form too — a wrapping pill, not truncated
  // prose (Ben r6: "they need to be in pill form").
  const isLong = String(signal.label).length > 90;
  return React.createElement(PillCell, {
    label: signal.label,
    value: signal.value,
    tone: signal.tone,
    color: standardColorKey(signal.label),
    evidence: signal.evidence,
    source: signal.source,
    ...(isLong ? { wrap: true } : {}),
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
  fixedLayout: true,
  columns: [
    { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
    { id: 'detail', header: 'Detail', renderCell: renderDetail },
  ],
  empty: { copy: 'No no-shop core mechanics found.' },
};

export { deriveHeaderNote, nosolNoshopConfig, renderDetail, renderSignals, rowSignal };
