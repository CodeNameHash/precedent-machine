import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { knowledgeQualifierDisplay, normalizeQualifierScope, sortByAgreementOrder, withScopeParens } from '../table-logic.js';
import { standardColorKey } from './standard-colors.js';
import { cardCode, cardType, firstFeature, labelOf, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// This section IS the Company's (and Parent's) representations and
// warranties -- not a separate "qualifiers" concept layered on top of them.
// One row per REPRESENTATION card (one row per rep), never per-attribute:
// TERM | MATERIALITY QUALIFIER | KNOWLEDGE QUALIFIER | LOOKBACK.

// -- selection ---------------------------------------------------------------

function isRepresentationCard(card) {
  return cardType(card) === 'REPRESENTATION' || cardCode(card).startsWith('REP-');
}

// The Article III / IV preamble cards (REP-T-PREAMBLE, REP-B-PREAMBLE) carry
// the SEC-filings carve-out and knowledge-scope data for the whole section --
// they are not themselves a "rep" with its own materiality/knowledge/lookback,
// so they're excluded from the per-rep rows and consumed separately below for
// the section's SEC-carve-out summary row and Knowledge-standard header note.
function isPreambleCard(card) {
  return /PREAMBLE$/.test(cardCode(card));
}

function selectRepCards(reviewDeal) {
  const cards = selectCards(reviewDeal, isRepresentationCard).filter((card) => !isPreambleCard(card));
  return sortByAgreementOrder(cards, (card) => firstFeature([card], ['sectionNumber'])?.value ?? card.section_ref);
}

// -- tagged-value helpers ------------------------------------------------------

// Claims data sometimes wraps a tagged {code,text} value in a citable
// {value:{...}} envelope (materialityQualifier does this on Metsera:
// {"value":{"code":"MAT_MAE_AGGREGATE","text":"..."}}); unwrap it once so
// every reader below sees the same {code,text}/{code,label,text} shape.
function unwrapValue(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw && !('code' in raw)) return raw.value;
  return raw;
}

function codeOf(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (typeof raw.code === 'string') return raw.code;
    const inner = unwrapValue(raw);
    if (inner && typeof inner === 'object' && typeof inner.code === 'string') return inner.code;
  }
  return null;
}

function textOfValue(raw) {
  const inner = unwrapValue(raw);
  if (inner && typeof inner === 'object' && typeof inner.text === 'string' && inner.text.trim()) return inner.text.trim();
  if (typeof raw === 'string') return raw;
  return null;
}

// Codes never render to the user (hover title only) -- last-resort fallback
// when a code has no taxonomy label, so an unmapped code still reads as
// words rather than a raw enum token.
function humanizeCode(code) {
  return String(code || '')
    .replace(/^(MAT_|KQ_)/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function scopeOf(card, key) {
  const hit = firstFeature([card], [key]);
  if (!hit) return null;
  const raw = typeof hit.value === 'string' ? hit.value : valueText(hit.value);
  return normalizeQualifierScope(raw);
}

// -- materiality qualifier -----------------------------------------------------

const MATERIALITY_DICT = taxonomyForFeatureKey('materialityQualifier');

// taxonomy.js's MATERIALITY_CODES labels are full explanatory sentences
// ("True except where failure would not have an MAE") -- meant for
// bring-down prose, not a compact pill. This table's pills follow the old
// design reference's short, noun-phrase style ("MAE (aggregate)", "Except
// for de minimis inaccuracies") instead, one entry per code actually seen on
// Metsera's per-rep materialityQualifier claims. Falls back to the taxonomy
// dict, then the raw claim, for any code not covered here.
const MATERIALITY_SHORT_LABELS = {
  MAT_ALL_RESPECTS: 'True in all respects',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'Except for de minimis inaccuracies',
  MAT_ALL_MATERIAL: 'True in all material respects',
  MAT_MATERIAL_TO_COMPANY: 'Material (to the Company)',
  MAT_MATERIAL_INLINE: 'Material (to the rep)',
  MAT_MAE_QUALIFIED: 'MAE-qualified',
  MAT_MAE_AGGREGATE: 'MAE (aggregate)',
  MAT_DE_MINIMIS: 'Except for de minimis inaccuracies',
};

// standardColorKey() colour-matches on the RENDERED label. Most of the short
// labels above already read naturally enough to match on their own (e.g.
// "MAE-qualified" -> amber via the mae-qualified pattern), but "MAE
// (aggregate)" and the two "Material (to ...)" variants don't contain any of
// the shared regex's phrases -- a tiny code-keyed override keeps them the
// same family colour as their siblings without touching the shared
// standard-colors.js regex.
const MATERIALITY_COLOR_OVERRIDES = {
  MAT_MAE_AGGREGATE: 'amber',
  MAT_MATERIAL_TO_COMPANY: 'sky',
  MAT_MATERIAL_INLINE: 'sky',
};

function materialityColor(code, label) {
  return (code && MATERIALITY_COLOR_OVERRIDES[code]) || standardColorKey(label) || (code ? standardColorKey(code) : null);
}

function materialityLabel(code, raw) {
  if (code && MATERIALITY_SHORT_LABELS[code]) return MATERIALITY_SHORT_LABELS[code];
  const dictLabel = code && labelForCode(code, MATERIALITY_DICT);
  if (dictLabel) return dictLabel;
  const inner = unwrapValue(raw);
  if (inner && typeof inner === 'object' && typeof inner.label === 'string' && inner.label.trim()) return inner.label.trim();
  if (typeof raw === 'string') return raw;
  if (code) return humanizeCode(code);
  return valueText(raw);
}

function resolveMateriality(card) {
  const hit = firstFeature([card], ['materialityQualifier']);
  if (!hit) return null;
  const code = codeOf(hit.value);
  const baseLabel = materialityLabel(code, hit.value);
  if (!baseLabel) return null;
  const label = withScopeParens(baseLabel, scopeOf(card, 'materialityScopeType'));
  return {
    label,
    color: materialityColor(code, baseLabel),
    evidence: textOfValue(hit.value) || textOf(card),
  };
}

// -- knowledge qualifier --------------------------------------------------------

function resolveKnowledge(card) {
  const hit = firstFeature([card], ['knowledgeQualifier']);
  if (!hit) return null;
  const display = knowledgeQualifierDisplay(hit.value);
  if (!display || !display.label) return null;
  // knowledgeQualifierDisplay echoes a bare enum string straight through as
  // `label` when the source stores the raw code (e.g. "KNOWLEDGE_QUALIFIED")
  // rather than a tagged {code,label} object -- humanize it, same rule as
  // materiality: codes never visible.
  const label = /^[A-Z0-9_]+$/.test(display.label)
    ? (display.label === 'KNOWLEDGE_QUALIFIED' ? 'Knowledge-qualified' : humanizeCode(display.label))
    : display.label;
  const scope = display.scope || scopeOf(card, 'knowledgeScopeType');
  return {
    label: withScopeParens(label, scope),
    evidence: display.quote || textOf(card),
  };
}

// -- lookback --------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a stored YYYY-MM-DD string without going through Date/timezone
// conversion (a UTC-midnight ISO date parsed in a behind-UTC timezone can
// silently roll back a day).
function formatIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return `${MONTHS[monthIndex]} ${Number(m[3])}, ${m[1]}`;
}

function resolveLookback(card) {
  const dateHit = firstFeature([card], ['lookbackDateISO']);
  if (dateHit) {
    const formatted = formatIsoDate(dateHit.value);
    if (formatted) return { label: `Since ${formatted}`, evidence: textOf(card) };
  }
  const daysHit = firstFeature([card], ['lookbackPeriod']);
  if (daysHit) {
    const n = Number(daysHit.value);
    const label = Number.isFinite(n) ? `${n.toLocaleString('en-US')} days` : valueText(daysHit.value);
    if (label) return { label, evidence: textOf(card) };
  }
  return null;
}

// -- term ------------------------------------------------------------------------

function resolveTerm(card) {
  const party = cardCode(card).startsWith('REP-B-') ? 'Parent' : null;
  const mainConcept = valueText(firstFeature([card], ['mainConcept'])?.value) || textOf(card);
  return { label: labelOf(card), party, mainConcept };
}

// -- section-level Knowledge-standard header note ----------------------------

// "actual-knowledge" -> "Actual knowledge" (spec's literal example phrasing).
function humanizeKnowledgeStandard(raw) {
  const words = String(raw || '').trim().replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.map((w, i) => (i === 0 ? `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}` : w.toLowerCase())).join(' ');
}

function knowledgeStandardNote(cards) {
  const hit = firstFeature(cards, ['knowledgeStandard']);
  if (!hit) return null;
  const code = codeOf(hit.value);
  const dictLabel = code && labelForCode(code, taxonomyForFeatureKey('knowledgeStandard'));
  if (dictLabel) return dictLabel;
  if (typeof hit.value === 'string') return humanizeKnowledgeStandard(hit.value);
  return valueText(hit.value);
}

// -- SEC filings / disclosure-schedule carve-out summary row -----------------

// Portions-excluded entries are typically stored as verbatim excerpt text
// (not codes) -- render the text as-is; fall back to the SEC_FILING_EXCLUSION_
// CODES taxonomy label only when an item is a bare code, and to valueText()
// as a last resort so nothing silently disappears.
function excludedPortionText(item, dict) {
  const text = textOfValue(item);
  if (text) return text;
  const code = codeOf(item);
  if (code) return labelForCode(code, dict) || humanizeCode(code);
  return valueText(item);
}

function secCarveoutRow(reviewDeal) {
  const preamble = (reviewDeal?.cards || []).find((card) => cardCode(card) === 'REP-T-PREAMBLE');
  if (!preamble) return null;
  const cutoffHit = firstFeature([preamble], ['secFilingsExceptionLookback']);
  const excludedHit = firstFeature([preamble], ['secFilingsExcludedSections']);
  const cutoff = cutoffHit ? valueText(cutoffHit.value) : null;
  const dict = taxonomyForFeatureKey('secFilingsExcludedSections');
  const excludedRaw = excludedHit ? excludedHit.value : null;
  const excluded = Array.isArray(excludedRaw)
    ? excludedRaw.map((item) => excludedPortionText(item, dict)).filter(Boolean)
    : (excludedRaw ? [excludedPortionText(excludedRaw, dict)].filter(Boolean) : []);
  if (!cutoff && !excluded.length) return null;
  return {
    id: 'representations-qualifiers-sec-carveout',
    kind: 'summary',
    present: true,
    card: preamble,
    label: 'SEC Filings & Disclosure Schedules',
    secCutoff: cutoff,
    secExcluded: excluded,
  };
}

// -- rendering ---------------------------------------------------------------

function clauseSeeText(text) {
  if (!text) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see text'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      text,
    ),
  );
}

function renderTerm(row) {
  if (row.kind === 'summary') {
    return React.createElement('span', { className: 'font-medium text-ink' }, row.label);
  }
  const label = row.party ? `${row.label} (${row.party})` : row.label;
  return React.createElement(
    'div',
    null,
    React.createElement('span', { className: 'font-medium text-ink', title: cardCode(row.card) || undefined }, label),
    clauseSeeText(row.mainConcept),
  );
}

function renderMateriality(row, ctx) {
  if (row.kind === 'summary') return null;
  const m = row.materiality;
  if (!m) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return m.label;
  return React.createElement(PillCell, { label: m.label, tone: 'neutral', color: m.color, evidence: m.evidence, source: row.card });
}

function renderKnowledge(row, ctx) {
  if (row.kind === 'summary') return null;
  const k = row.knowledge;
  if (!k) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return k.label;
  return React.createElement(PillCell, { label: k.label, tone: 'info', evidence: k.evidence, source: row.card });
}

function subLabelBlock(key, label, node) {
  if (!node) return null;
  return React.createElement(
    'div',
    { key, className: 'space-y-0.5' },
    React.createElement('div', { className: 'text-[10px] font-medium uppercase tracking-wide text-inkFaint' }, label),
    React.createElement('div', { className: 'text-[11px] text-ink' }, node),
  );
}

function renderLookback(row, ctx) {
  if (row.kind === 'summary') {
    const excludedNode = row.secExcluded && row.secExcluded.length
      ? React.createElement(
          'ul',
          { className: 'list-disc space-y-0.5 pl-4' },
          row.secExcluded.map((item, index) => React.createElement('li', { key: index }, item)),
        )
      : null;
    return React.createElement(
      'div',
      { className: 'space-y-1.5' },
      subLabelBlock('cutoff', 'Cut-off', row.secCutoff),
      subLabelBlock('excluded', 'Portions excluded', excludedNode),
      // The Disclosure Schedule / Company Disclosure Letter is cross-referenced
      // throughout the reps but its own content is never ingested as a
      // provision in its own right -- this line reports that data-availability
      // gap, not a claim that the deal has no disclosure schedules.
      React.createElement('div', { key: 'schedules', className: 'text-[11px] text-ink' }, 'Disclosure Schedules: Not present'),
    );
  }
  const l = row.lookback;
  if (!l) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return l.label;
  return React.createElement(PillCell, { label: l.label, tone: 'neutral', evidence: l.evidence, source: row.card });
}

// -- config --------------------------------------------------------------------

const representationsQualifiersConfig = {
  id: 'representations-qualifiers',
  title: 'Representations & Warranties — Company',
  layoutSlot: 'reps',
  selectRows(reviewDeal) {
    const cards = selectRepCards(reviewDeal);
    const rows = [];
    const carveout = secCarveoutRow(reviewDeal);
    if (carveout) rows.push(carveout);
    const standardNote = knowledgeStandardNote(cards);
    for (const card of cards) {
      const term = resolveTerm(card);
      rows.push({
        id: `representations-qualifiers-${card.id}`,
        kind: 'rep',
        present: true,
        card,
        label: term.label,
        party: term.party,
        mainConcept: term.mainConcept,
        materiality: resolveMateriality(card),
        knowledge: resolveKnowledge(card),
        lookback: resolveLookback(card),
        knowledgeStandardNote: standardNote,
      });
    }
    return rows;
  },
  // "Knowledge standard: Actual knowledge" -- a section-level fact identical
  // across every rep row, hoisted into the section chrome (ProvisionTable's
  // headerNote slot) instead of repeated per row.
  deriveHeaderNote(rows) {
    const hit = (rows || []).find((row) => row.knowledgeStandardNote);
    return hit ? `Knowledge standard: ${hit.knowledgeStandardNote}` : null;
  },
  columns: [
    { id: 'term', header: 'Term', width: '16rem', renderCell: renderTerm },
    { id: 'materiality', header: 'Materiality Qualifier', width: '13rem', renderCell: renderMateriality },
    { id: 'knowledge', header: 'Knowledge Qualifier', width: '13rem', renderCell: renderKnowledge },
    { id: 'lookback', header: 'Lookback', renderCell: renderLookback },
  ],
};

export {
  isRepresentationCard,
  representationsQualifiersConfig,
  resolveKnowledge,
  resolveLookback,
  resolveMateriality,
  resolveTerm,
  selectRepCards,
};
