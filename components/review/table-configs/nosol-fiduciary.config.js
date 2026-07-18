import React from 'react';
import { cardFeatures, partySide, splitForCell, textOf, valueText } from './card-utils.js';
import { standardColorKey } from './standard-colors.js';
import { BOARD_CHANGE_STANDARD_LABELS } from './board-change-standard.js';
import { FIDUCIARY_STANDARD_LABELS } from './fiduciary-standard-labels.js';
import taxonomy from '../../../lib/taxonomy.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// Rebuilt per REBUILD-SPECS.md §7. The original thirteen rows keep their
// exact ids/keys/fallback regexes/detail synthesis unchanged (existing
// tests assert on array order and individual `.detail` values). New rows
// (spec's explicit field list for this table): Superior-proposal threshold,
// Superior Proposal test (collapsed), Fiduciary-out standard, Board-change
// standard, plus the Acceptable Confidentiality Agreement definition
// (collapsed) -- all structured-key lookups across the wider no-solicitation
// family, since these live on NOSOL-SUPERIOR/NOSOL-EXCEPT/NOSOL-RECOMMEND/
// NOSOL-CONFID cards that don't always satisfy this file's narrower
// isFiduciaryCard() filter. Rendering-only changes: long rows (engagement/
// final-determination sentences, notice content, the CoR item-list rows)
// collapse to a truncated "see text" preview instead of one giant pill; the
// Representatives standard row's raw code (e.g. RBE_NOT_TO) renders as a
// friendly, coloured label instead of the bare code (global rule: codes are
// hover-title only); the Party column is dropped in favour of a header note.

const ROWS = [
  { id: 'engage', label: 'Engagement standard', keys: ['fiduciaryEngageStandard', 'engagementStandard'], fallback: engageFromText },
  { id: 'final', label: 'Final determination standard', keys: ['fiduciaryFinalStandard', 'changeRecStandard'], fallback: finalFromText },
  { id: 'board-change', label: 'Board change right', keys: ['boardChangeForSuperiorProposal', 'boardChangeStandard'], fallback: boardChangeFromText },
  { id: 'notice-period', label: 'Notice period', keys: ['noticePeriod'], fallback: noticePeriodFromText },
  { id: 'notice-content', label: 'Notice content', keys: ['noticeContent'], fallback: noticeContentFromText },
  { id: 'initial-match', label: 'Initial match period', keys: ['initialMatchPeriodDays', 'matchingPeriod'], fallback: matchFromText },
  { id: 'subsequent-match', label: 'Subsequent match period', keys: ['subsequentMatchPeriodDays', 'subsequentMatchingPeriod'], fallback: subsequentMatchFromText },
  { id: 'force-vote', label: 'Force the vote', keys: ['forceTheVote', 'forceTheVoteDetails', 'forceTheVoteType'], fallback: forceVoteFromText },
  { id: 'termination', label: 'Company termination for Superior Proposal', keys: ['companyTerminationForSuperior', 'companyTerminationForSuperiorConditions'], fallback: terminationFromText },
  { id: 'reps', label: 'Representative control standard', keys: ['representativesStandard', 'representativeBreachIsCompanyBreach'], fallback: repsFromText },
  { id: 'buyer-termination', label: 'Buyer termination for nonsolicit breach', keys: ['parentTerminationRightForNonsolicitBreach'], fallback: buyerTerminationFromText },
  { id: 'change-of-rec-items', label: 'Change of Recommendation — prohibited actions', keys: ['changeOfRecommendationItems'], fallback: () => null },
  { id: 'not-change-of-rec-items', label: 'Not a Change of Recommendation', keys: ['notChangeOfRecommendationItems'], fallback: () => null },
];

// New rows (spec's explicit field list for this table + the confidentiality
// definition). Structured-key lookup only.
const NEW_ROWS = [
  { id: 'superior-threshold', label: 'Superior-proposal threshold', keys: ['superiorProposalThresholdPct', 'superiorProposalPercentage'], format: pctLabel },
  { id: 'superior-test', label: 'Superior Proposal test', keys: ['superiorProposalTest'], format: (raw) => valueText(raw) },
  { id: 'fiduciary-standard', label: 'Fiduciary-out standard', keys: ['fiduciaryOutStandard'], format: fiduciaryStandardSummary },
  { id: 'board-change-standard', label: 'Board-change standard', keys: ['boardChangeStandard'], format: boardChangeStandardLabel },
  { id: 'acceptable-confidentiality', label: 'Acceptable Confidentiality Agreement — definition', keys: ['acceptableConfidentialityAgreementDefinition'], format: (raw) => valueText(raw) },
];

// Reading order: standards/thresholds up front, then the existing mechanics
// rows in their original relative order (required for the array-order
// assertion in provision-table-configs.test.js), with the confidentiality
// definition slotted in next to notice content (both gate engaging a
// bidder).
const ORDERED_IDS = [
  'superior-threshold', 'superior-test', 'fiduciary-standard', 'board-change-standard',
  'engage', 'final', 'board-change', 'notice-period', 'notice-content', 'acceptable-confidentiality',
  'initial-match', 'subsequent-match', 'force-vote', 'termination', 'reps', 'buyer-termination',
  'change-of-rec-items', 'not-change-of-rec-items',
];

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardType(card) {
  return String(card?.provision_type || '').trim().toUpperCase();
}
function isFiduciaryCard(card) {
  const code = cardCode(card);
  if (['NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-RECOMMEND', 'NOSOL-EXCEPT'].includes(code)) return true;
  if (card?.provision_type !== 'COVENANT_NO_SOLICITATION' && !/^NOSOL(?:-|$)/.test(code)) return false;
  return /fiduciary|recommendation|match|notice|representatives?|terminate/i.test(`${card?.short_title || ''} ${textOf(card)}`);
}
// Broader than isFiduciaryCard(): the new threshold/test/standard/
// confidentiality fields live on NOSOL-SUPERIOR / NOSOL-CONFID cards, whose
// own text doesn't always satisfy isFiduciaryCard's regex.
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
// Ben (round 6): the standard rows must read as clean PILLS, not raw clause
// dumps behind "see text". Each summarizes its verbatim standard to the
// canonical phrase (derived from the clause language, not hardcoded).
function cleanEngageStandard(detail) {
  const t = String(detail || '');
  if (/reasonably\s+be\s+expected\s+to\s+lead\s+to\s+a\s+Superior/i.test(t)) return 'Constitutes or could reasonably be expected to lead to a Superior Proposal';
  if (/constitutes?[^.]*lead\s+to\s+a\s+Superior/i.test(t)) return 'Constitutes or could lead to a Superior Proposal';
  return t;
}
function cleanFinalStandard(detail) {
  const t = String(detail || '');
  if (/inconsistent\s+with[^.]*fiduciary\s+duties/i.test(t)) return 'Reasonably likely to be inconsistent with fiduciary duties under applicable law';
  return t;
}
// Bare numeric periods get their unit (Ben round 6: "4" -> "4 business days").
function withBusinessDays(detail) {
  const t = String(detail || '').trim();
  return /^\d+$/.test(t) ? `${t} business day${t === '1' ? '' : 's'}` : t;
}
const ROW_CLEANERS = {
  engage: cleanEngageStandard,
  final: cleanFinalStandard,
  'notice-period': withBusinessDays,
  'initial-match': withBusinessDays,
  'subsequent-match': withBusinessDays,
};
function rowForSpec(spec, cards) {
  const evidence = cards.map(textOf).filter(Boolean).join('\n\n');
  const raw = firstFeature(cards, spec.keys) || spec.fallback(evidence);
  if (!raw) return null;
  const cleaner = ROW_CLEANERS[spec.id];
  const detail = cleaner ? cleaner(raw) : raw;
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

// ── New-row synthesis (short codes -> friendly labels) ─────────────────────
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
  return FIDUCIARY_STANDARD_LABELS[text.trim().toLowerCase()] || prettifyCode(text);
}
// Canonical-layer (Phase 0): fiduciaryOutStandard already carries an extraction-
// assigned CODE per stage. Resolve to the single definitive gate by CODE
// (prefer is-superior-proposal) and map through FIDUCIARY_STANDARD_LABELS --
// never regex the clause prose. Same code -> same label on any deal.
function fiduciaryOutCode(item) {
  if (item && typeof item === 'object') return item.code || item.value || null;
  return typeof item === 'string' ? item : null;
}
function fiduciaryStandardSummary(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  const codes = items.map(fiduciaryOutCode).filter(Boolean).map((code) => String(code).trim().toLowerCase());
  if (!codes.length) return null;
  const pick = codes.find((code) => code === 'is-superior-proposal') || codes[0];
  return FIDUCIARY_STANDARD_LABELS[pick] || prettifyCode(pick);
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
    id: `nosol-fiduciary-${spec.id}`,
    label: spec.label,
    party: partySide(hit.card),
    detail: formatted,
    evidence: textOf(hit.card),
    sourceCards: [hit.card],
    present: true,
  };
}

// ── Change-of-Recommendation A–E list ──────────────────────────────────────
// The (A)–(E) prohibitions of §5.02(e) are stored verbatim (one string per
// limb) in changeOfRecommendationItems. rowForSpec/firstFeature only ever
// surfaced the FIRST limb as a giant "see text" pill; Ben wants the whole
// list, SUMMARIZED. Each verbatim limb maps to a crisp pill (verbatim kept as
// hover evidence); the (D) reaffirm deadline (arcReaffirmDeadlineDays) is
// folded into its own pill.
// Patterns are order-independent and non-colliding (early drafts matched a
// bare "change"/"modify", which item (D)'s "material change" wrongly tripped).
const COR_ITEM_SPECS = [
  { test: /\bwithdraw\b|modify in a manner adverse/i, label: 'Withdraw, qualify or modify the Board Recommendation' },
  { test: /fail to make the.*recommendation.*proxy|recommendation in the proxy statement/i, label: 'Fail to include the Recommendation in the Proxy Statement' },
  { test: /approve, recommend or declare advisable|declare advisable/i, label: 'Approve or recommend a Takeover Proposal' },
  { test: /publicly recommend against|publicly disclosed|reaffirm/i, label: 'Fail to reject a publicly-disclosed Takeover Proposal' },
  { test: /tender or exchange offer/i, label: 'Fail to recommend against a related tender/exchange offer' },
];
// Labels ported from the old scheme's NOSOL_PILL_VOCAB.notChangeOfRecommendationItems.
const NOT_COR_SPECS = [
  { test: /14d-9|14e-2|1012|regulation m-a|stop,? ?look/i, label: '14d-9 / 14e-2 stop-look-listen compliance' },
  { test: /factual|accurate|describes|receipt of[^.]*proposal|identity of[^.]*party|material terms/i, label: 'Factually accurate disclosure' },
  { test: /required by applicable law|comply with applicable law|inconsistent with applicable law|informing any person|existence of the provisions/i, label: 'Routine communications' },
];
function summarizeItem(text, specs) {
  const t = String(text || '');
  const letter = (t.match(/^\(([A-Za-z0-9]+)\)/) || [])[1];
  const spec = specs.find((s) => s.test.test(t));
  return { letter: letter ? letter.toUpperCase() : null, label: spec ? spec.label : `${splitForCell(t, 70).short}…` };
}
function allFeatureItems(cards, keys) {
  const out = [];
  const seen = new Set();
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of keys) {
      const raw = features[key];
      if (raw === null || raw === undefined) continue;
      for (const item of (Array.isArray(raw) ? raw : [raw])) {
        const text = valueText(item);
        const k = String(text || '').trim();
        // `item` (the raw tagged value, carrying `.code` when the canonical
        // layer assigned one) is kept alongside `text` so corItemsRow() can
        // prefer labelForCode() over the regex-summarized fallback -- an
        // additive field existing callers (which only destructure
        // {text, card}) are unaffected by.
        if (text && !seen.has(k)) { seen.add(k); out.push({ text, card, item }); }
      }
    }
  }
  return out;
}
function reaffirmDaysFor(cards) {
  const n = Number(firstFeature(cards, ['arcReaffirmDeadlineDays']));
  return Number.isFinite(n) && n > 0 ? n : null;
}
// Canonical layer: only changeOfRecommendationItems carries a
// SOLICITATION_ACT code today; notChangeOfRecommendationItems has no
// taxonomy mapping (taxonomyForFeatureKey returns null for it), so this
// naturally no-ops for that spec and corItemsRow() falls through to
// summarizeItem() unchanged.
function corItemCodeLabel(spec, item) {
  const dict = taxonomyForFeatureKey(spec.keys?.[0]);
  const code = dict && item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
  return code ? labelForCode(String(code), dict) : null;
}
function corItemsRow(spec, cards, specs, { reaffirm = false, tone = 'neutral' } = {}) {
  const raw = allFeatureItems(cards, spec.keys);
  if (!raw.length) return null;
  const days = reaffirm ? reaffirmDaysFor(cards) : null;
  const mapped = raw.map(({ text, card, item }, index) => {
    const s = summarizeItem(text, specs);
    const canonical = corItemCodeLabel(spec, item);
    const baseLabel = canonical || s.label;
    let label = s.letter ? `${s.letter}. ${baseLabel}` : baseLabel;
    if (days && /reject a publicly-disclosed/i.test(s.label)) label += ` (within ${days} business days)`;
    const code = item && typeof item === 'object' && !Array.isArray(item) ? item.code : null;
    return { id: `nosol-fiduciary-${spec.id}-${s.letter || index}`, letter: s.letter, label, baseLabel, code, tone, evidence: text, source: card };
  });
  // (Items 6 & 15) Two cards can carry the SAME list -- e.g. QXO's
  // NOSOL-DISCLOSE repeats NOSOL-RECOMMEND's changeOfRecommendationItems
  // verbatim, its texts prefixed "(A) "/"(B) "/... where NOSOL-RECOMMEND's
  // are bare -- and Theravance's notChangeOfRecommendationItems can hold two
  // genuinely-different verbatims that both match the SAME regex spec
  // (label collision, not a text collision). allFeatureItems' exact-
  // verbatim-text dedup catches neither case. Dedupe here by canonical
  // identity instead: item.code when the canonical layer assigned one, else
  // the final rendered label with its letter prefix stripped (baseLabel).
  // Keep the lettered entry (its A-E ordering drives the sort below) and
  // fold the other's text into evidence so nothing captured is lost.
  const seen = new Map();
  const items = [];
  for (const it of mapped) {
    const key = it.code || it.baseLabel.toLowerCase();
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, it);
      items.push(it);
      continue;
    }
    if (!existing.letter && it.letter) {
      existing.letter = it.letter;
      existing.id = it.id;
      existing.label = it.label;
    }
    if (it.evidence && it.evidence !== existing.evidence) {
      existing.evidence = `${existing.evidence}\n\n${it.evidence}`;
    }
  }
  // Show them in the clause's own A→E order, not the DB feature-array order.
  items.sort((a, b) => (a.letter || 'Z').localeCompare(b.letter || 'Z'));
  return {
    id: `nosol-fiduciary-${spec.id}`,
    label: spec.label,
    party: [...new Set(cards.map(partySide))].join(', ') || 'Target / Company',
    items,
    evidence: cards.map(textOf).filter(Boolean).join('\n\n'),
    sourceCards: cards,
    present: true,
  };
}

// Notice-content canonical pills, ported from the old scheme's
// NOSOL_PILL_VOCAB.noticeContent -- the notice-content clause enumerates which
// facts the notice must carry; each match renders as its own pill (Ben round 6:
// "you don't have as much detail as the old schema -- get to those pills").
const NOTICE_CONTENT_VOCAB = [
  { code: 'IDENTITY', label: 'Identity of the bidder', test: /identity|name of such person|person or group|party making|person making/i },
  { code: 'MATERIAL_TERMS', label: 'Material terms & conditions', test: /material terms|terms and conditions|basis for|details/i },
  { code: 'COPIES', label: 'Copies of the proposal', test: /copies|copy|draft|proposed agreements|ancillary documents|relevant documents|documentation|financing commitments|written/i },
  { code: 'DESCRIPTION', label: 'Description if not in writing', test: /not in writing|oral|description of (?:the )?(?:material )?terms|written summary/i },
  { code: 'MODIFICATIONS', label: 'Amendments / status updates', test: /amendment|modification|changes?|subsequent|status of any discussions|developments/i },
];
function noticeContentRow(cards) {
  const raw = allFeatureItems(cards, ['noticeContent']);
  if (!raw.length) return null;
  const joined = raw.map((entry) => entry.text).join(' ');
  const items = NOTICE_CONTENT_VOCAB
    .filter((vocab) => vocab.test.test(joined))
    .map((vocab) => ({ id: `nosol-fiduciary-notice-content-${vocab.code}`, label: vocab.label, tone: 'info', evidence: raw[0].text, source: raw[0].card }));
  if (!items.length) return null;
  return {
    id: 'nosol-fiduciary-notice-content',
    label: 'Notice content',
    party: [...new Set(cards.map(partySide))].join(', ') || 'Target / Company',
    items,
    evidence: raw.map((entry) => entry.text).join('\n\n'),
    sourceCards: cards,
    present: true,
  };
}

// Representatives-standard codes (RBE_NOT_TO / INSTRUCT_NOT_TO / CAUSE_NOT_TO /
// NA) -> a friendly phrase. Resolves PURELY by the extraction-assigned code.
// The former `||` regex fallbacks over clause prose (/reasonable best efforts/,
// /instruct|direct/, /cause/) were Metsera-calibrated bandaids that a
// differently-drafted, legally-identical clause would mis-hit -- deleted so the
// same code yields the same label on any deal. Codes are hover-title only; an
// unrecognized value renders nothing here. Render-only: `row.detail` (the
// tested data field) is untouched.
//
// NOTE: these short display labels are deliberately NOT the longer
// REPRESENTATIVES_STANDARDS taxonomy labels (e.g. "Company must use reasonable
// best efforts to cause Representatives not to engage"). Routing through
// labelForCode(code, taxonomyForFeatureKey('representativesStandard')) would
// change what the pill shows, so the existing display strings are preserved
// here verbatim.
const REPRESENTATIVES_STANDARD_DISPLAY = {
  RBE_NOT_TO: 'Reasonable best efforts',
  INSTRUCT_NOT_TO: 'Instruct / direct',
  CAUSE_NOT_TO: 'Cause',
  NA: 'Not applicable',
};
function representativesStandardLabel(detail) {
  const code = String(detail || '').trim().toUpperCase();
  return REPRESENTATIVES_STANDARD_DISPLAY[code] || null;
}
const LABEL_OVERRIDES = {
  'nosol-fiduciary-reps': representativesStandardLabel,
};

function rowSignal(row) {
  if (!row?.detail) return null;
  const isTiming = /notice|match/i.test(row.label);
  const isTermination = /termination/i.test(row.label);
  const override = LABEL_OVERRIDES[row.id];
  const label = (override && override(row.detail)) || row.detail;
  return {
    id: `${row.id}-signal`,
    label,
    value: label,
    tone: isTermination ? 'warning' : isTiming ? 'info' : 'neutral',
    evidence: row.evidence,
    source: row.sourceCards?.[0],
  };
}
// Long text (engagement/final-determination sentences, notice content, the
// CoR item-list rows) collapses to a truncated preview + click-to-open
// instead of one giant pill (spec: no big text rows).
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
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'See provision'),
      React.createElement(
        'div',
        { className: 'mt-1 max-w-[36rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
        value,
      ),
    ),
  );
}
function renderSignals(row, ctx) {
  // A–E Change-of-Recommendation rows carry a summarized item list -> one pill
  // per limb (verbatim on hover), not a single first-limb "see text" pill.
  if (Array.isArray(row.items) && row.items.length) {
    const PillCell = ctx?.primitives?.PillCell;
    if (!PillCell) return row.items.map((item) => item.label).join('; ');
    // Ben (round 6): stack the A–E limbs vertically (one above the other) so
    // the row doesn't blow out horizontally.
    return React.createElement(
      'div',
      { className: 'flex flex-col items-start gap-1' },
      row.items.map((item) => React.createElement(PillCell, {
        key: item.id,
        label: item.label,
        value: item.label,
        tone: item.tone || 'neutral',
        evidence: item.evidence,
        source: item.source,
        wrap: true,
      })),
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
// Party is uniform across this family -- hoisted into a header note instead
// of its own column, matching the two-column TERM | PROVISION default.
function deriveHeaderNote(rows) {
  const parties = [...new Set((rows || []).map((row) => row.party).filter(Boolean))];
  return parties.length ? `Party: ${parties.join(', ')}` : null;
}

const nosolFiduciaryConfig = {
  id: 'nosol-fiduciary',
  title: 'Fiduciary-Out Mechanics',
  layoutSlot: 'nosol',
  selectRows(reviewDeal) {
    const allCards = reviewDeal?.cards || [];
    const cards = allCards.filter(isFiduciaryCard);
    if (!cards.length) return [];
    const familyCards = allCards.filter(isNosolFamilyCard);
    const byId = {};
    for (const row of ROWS) {
      if (row.id === 'change-of-rec-items') byId[row.id] = corItemsRow(row, cards, COR_ITEM_SPECS, { reaffirm: true, tone: 'warning' });
      else if (row.id === 'not-change-of-rec-items') byId[row.id] = corItemsRow(row, cards, NOT_COR_SPECS, { tone: 'info' });
      else if (row.id === 'notice-content') byId[row.id] = noticeContentRow(cards);
      else byId[row.id] = rowForSpec(row, cards);
    }
    for (const spec of NEW_ROWS) byId[spec.id] = newRow(spec, familyCards);
    return ORDERED_IDS.map((id) => byId[id]).filter(Boolean);
  },
  deriveHeaderNote,
  columns: [
    { id: 'term', header: 'Term', width: '19rem', renderCell: (row) => row.label },
    { id: 'signals', header: 'Provision', renderCell: renderSignals },
  ],
  empty: { copy: 'No fiduciary-out mechanics found.' },
};

export { nosolFiduciaryConfig, renderSignals, rowSignal };
