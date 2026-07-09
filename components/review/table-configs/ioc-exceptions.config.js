import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { cardCode, cardFeatures, cardType, textOf, valueText } from './card-utils.js';

const { EXCEPTION_CODES, IOC_AFFIRMATIVE_SCOPE_CODES, IOC_CATEGORY_CODES, labelForCode } = taxonomy;

// REBUILD-SPECS.md section 6 ("IOC" -- Ben: "a shit show"). Old shape was a
// Target/Buyer split of ONLY the general-exceptions preamble text; the other
// 20-odd IOC cards (the actual negative covenants, the affirmative limbs)
// were rendered nowhere on this table. New shape is the full 24-card IOC
// family, organized the way a lawyer reads Section 5.01 -- and in the same
// TOP-TO-BOTTOM order the old site used (IocAffirmativeCovenantsTable ahead
// of IocNegativeCovenantsTable; FEEDBACK-2-PUNCHLIST.md #29):
//   - the 3 affirmative limbs (IOC-ORDINARY/PRESERVE/MAINTAIN) FIRST, as
//     their own small "Affirmative covenants" band,
//   - one TERM|RESTRICTION row per NAMED negative covenant (grouped by
//     canonical code -- Metsera has 3 separate IOC-MERGE cards (the M&A /
//     dispositions / recapitalization covenant) that collapse into ONE row
//     with combined pills),
//   - the near-empty "[PROPOSED] Unclassified 5.01(i)-(o)" fragments (no
//     provision_subtype, so no covenant name) collapsed under a single
//     lowest-priority "Other restrictions" band instead of rendering as
//     empty rows,
//   - the section-wide General Exceptions preamble (IOC-GENERAL-EXCEPTIONS /
//     IOC-NEGATIVE-PREAMBLE) as a FOOTER strip, never per-row.
// mainObligation prose never dumps inline -- it always sits behind an
// always-collapsed "see text", mirroring conditions.config.js's
// clauseSeeText (the locked exemplar this file is patterned on).

function isIocCard(card) {
  return cardType(card) === 'COVENANT_INTERIM_OPERATING' || /^IOC(?:-|$)/.test(cardCode(card));
}

// Container codes that carry the section-wide exceptions preamble (rendered
// as the footer strip, never as a negative-covenant row) vs. the affirmative
// limbs (rendered as their own band, never as a negative-covenant row).
const GENERAL_EXCEPTION_CODES = new Set(['IOC-GENERAL-EXCEPTIONS', 'IOC-EXCEPTIONS', 'IOC-NEGATIVE-PREAMBLE']);
const AFFIRMATIVE_CODES = new Set([
  'IOC-ORDINARY', 'IOC-PRESERVE', 'IOC-MAINTAIN', 'IOC-NOACTION',
  'IOC-AFFIRMATIVE', 'IOC-OTHER-AFFIRMATIVE', 'IOC-POSITIVE-PREAMBLE',
]);

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

// Resolves a taxonomy-tagged list feature (permittedExceptions,
// restrictionComponents, appliesTo) into { code, label, evidence, source }
// entries. Handles both bare UPPER_SNAKE code strings (restrictionComponents,
// appliesTo) and tagged {code,label,text} objects (permittedExceptions is a
// LIST_TAXONOMY_KEY -- see lib/taxonomy.js).
function exceptionEntries(list, dict, card) {
  const arr = Array.isArray(list) ? list : (list !== null && list !== undefined && list !== '' ? [list] : []);
  return arr.map((item) => {
    const tagged = item && typeof item === 'object';
    const code = tagged ? String(item.code || '').toUpperCase() : String(item || '').toUpperCase();
    const dictLabel = code && dict ? labelForCode(code, dict) : null;
    const label = (tagged && item.label) || dictLabel || (!tagged ? String(item).trim() : null);
    if (!label) return null;
    const evidence = (tagged && item.text) || textOf(card);
    return { code: code || label, label, evidence, source: card };
  }).filter(Boolean);
}

function dedupeEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    if (!entry?.label) continue;
    const key = entry.code || entry.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

// dollarThreshold is a raw number/numeric-string on the card (Metsera
// 5.01(d): 2000000 -- the ONLY IOC card carrying one, per
// FEEDBACK-2-PUNCHLIST.md's DATA FINDINGS #25/#28: 0 canonical claims, the
// figure only ever landed in the claim's verbatim capture). Always renders
// as currency, never a bare numeral (parity with the IOC threshold fix
// elsewhere in the app -- table-logic.js's formatIocThresholdAmount).
function formatMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    // Citable-wrapper shape { value: null, quotes: [...] } -- a verbatim-only
    // claim (no canonical numeral) still carries the figure inside its first
    // supporting quote. Try that before falling through to the other object
    // shapes (tagged {code,label,text}, legacy {amount}/{threshold}).
    if (Array.isArray(raw.quotes) && raw.quotes.length) {
      const fromQuote = formatMoney(raw.quotes[0]);
      if (fromQuote) return fromQuote;
    }
    return formatMoney(raw.value ?? raw.amount ?? raw.threshold ?? raw.text ?? null);
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(num) && num > 0) return `$${num.toLocaleString('en-US')}`;
  // The claims-adapter (lib/queries/claims-adapter.js's buildRawValue) already
  // falls back to `claim.verbatim` when `claim.canonical` is null, so most
  // verbatim-only numbers arrive here as a clean numeral string and are
  // caught above. This is the last-resort path for the rare case a longer
  // verbatim sentence slips through uncoerced ("...not to exceed $2,000,000
  // in the aggregate...") -- pull the first dollar figure out of it directly
  // instead of dropping the pill.
  if (typeof raw === 'string') {
    const match = raw.match(/\$\s?[\d,]+(?:\.\d+)?/);
    if (match) return match[0].replace(/\s+/g, '');
  }
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function pillFor(PillCell, keyId, label, tone, evidence, source) {
  if (!PillCell || !label) return null;
  return React.createElement(PillCell, { key: keyId, label, tone, evidence, source });
}

// AC (raw code hidden, exposed only on hover) -- same convention as
// conditions.config.js's conditionLabelNode.
function covenantLabelNode(label, code) {
  return React.createElement('span', { title: code || undefined }, label);
}

// Small, always-collapsed "see text" affordance for mainObligation prose --
// ported verbatim from conditions.config.js's clauseSeeText so the AI's
// clause sentence never dumps inline (REBUILD-SPECS.md global rule + the
// section-6-specific "mainObligation prose behind see text (NEVER dump)").
function seeTextNode(texts) {
  const joined = texts.filter(Boolean).join('\n\n');
  if (!joined) return null;
  return React.createElement(
    'details',
    { className: 'mt-1' },
    React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, 'see text'),
    React.createElement(
      'div',
      { className: 'mt-1 max-w-[42rem] whitespace-pre-wrap break-words text-[11px] leading-5 text-inkLight' },
      joined,
    ),
  );
}

// Groups the NAMED negative covenants (has a real provision_subtype, is not
// a general-exceptions/affirmative container) by canonical code. Metsera has
// 3 separate IOC-MERGE cards at 5.01(g)/(d)/(p) that collapse into ONE row
// here with combined pills, instead of 3 duplicate rows for the same
// covenant name.
function negativeCovenantGroups(cards) {
  const order = [];
  const byCode = new Map();
  for (const card of cards) {
    const code = cardCode(card);
    if (!code || code === 'IOC' || GENERAL_EXCEPTION_CODES.has(code) || AFFIRMATIVE_CODES.has(code)) continue;
    if (!byCode.has(code)) {
      byCode.set(code, []);
      order.push(code);
    }
    byCode.get(code).push(card);
  }
  return order.map((code) => ({ code, cards: byCode.get(code) }));
}

// The "[PROPOSED] Unclassified" 5.01(i)-(o) fragments: no provision_subtype
// was ever assigned, so there is no covenant name to hang a row on. Some
// carry a deterministically-stamped restrictionComponents tag, most carry
// nothing beyond a section reference.
function fragmentCards(cards) {
  return cards.filter((card) => {
    const code = cardCode(card);
    if (GENERAL_EXCEPTION_CODES.has(code) || AFFIRMATIVE_CODES.has(code)) return false;
    return !code || code === 'IOC';
  });
}

function buildNegativeRow(group) {
  return {
    id: `ioc-neg-${group.code}`,
    code: group.code,
    cards: group.cards,
  };
}

function renderNegativeRow(entry, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const { cards } = entry;
  const primary = cards[0];
  const label = primary?.short_title || primary?.defined_term || entry.code;
  const restrictionEntries = dedupeEntries(cards.flatMap((c) => exceptionEntries(cardFeatures(c).restrictionComponents, IOC_CATEGORY_CODES, c)));
  const thresholdEntries = dedupeEntries(cards.map((c) => {
    const money = formatMoney(cardFeatures(c).dollarThreshold);
    return money ? { code: `threshold-${money}`, label: `Threshold: ${money}`, evidence: textOf(c), source: c } : null;
  }).filter(Boolean));
  const permittedEntries = dedupeEntries(cards.flatMap((c) => exceptionEntries(cardFeatures(c).permittedExceptions, EXCEPTION_CODES, c)));
  const obligations = cards.map((c) => valueText(cardFeatures(c).mainObligation)).filter(Boolean);

  const pills = [
    ...restrictionEntries.map((e, i) => pillFor(PillCell, `${entry.code}-rc-${i}`, e.label, 'neutral', e.evidence, e.source)),
    ...thresholdEntries.map((e, i) => pillFor(PillCell, `${entry.code}-dt-${i}`, e.label, 'info', e.evidence, e.source)),
    ...permittedEntries.map((e, i) => pillFor(PillCell, `${entry.code}-pe-${i}`, e.label, 'present', e.evidence, e.source)),
  ].filter(Boolean);

  return {
    id: entry.id,
    label: covenantLabelNode(label, entry.code),
    children: React.createElement(
      'div',
      { className: 'space-y-1.5' },
      pills.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills) : null,
      obligations.length ? seeTextNode(obligations) : null,
    ),
  };
}

function buildOtherRestrictionsRow(fragments, ctx) {
  if (!fragments.length) return null;
  const PillCell = ctx?.primitives?.PillCell;
  const sections = fragments.map((c) => valueText(cardFeatures(c).sectionNumber)).filter(Boolean);
  const rangeLabel = sections.length ? `§${sections[0]}–${sections[sections.length - 1]}` : `${fragments.length} items`;
  const items = fragments.map((card, index) => {
    const entries = exceptionEntries(cardFeatures(card).restrictionComponents, IOC_CATEGORY_CODES, card);
    const section = valueText(cardFeatures(card).sectionNumber) || `Item ${index + 1}`;
    return React.createElement(
      'li',
      { key: card.id || index, className: 'flex flex-wrap items-center gap-1 text-[11px]' },
      React.createElement('span', { className: 'text-inkFaint' }, `§${section}`),
      entries.length && PillCell
        ? entries.map((e, j) => pillFor(PillCell, `frag-${card.id || index}-${j}`, e.label, 'neutral', e.evidence, e.source))
        : React.createElement('span', { className: 'italic text-inkFaint' }, 'no structured signal extracted'),
    );
  });
  return {
    id: 'ioc-other-restrictions',
    label: covenantLabelNode(`${rangeLabel} (${fragments.length} fragments)`, null),
    children: React.createElement(
      'details',
      { className: 'mt-1' },
      React.createElement('summary', { className: 'term-cell-seetext', style: { listStyle: 'none' } }, `${fragments.length} unclassified fragments — see items`),
      React.createElement('ul', { className: 'mt-1 space-y-1 list-none pl-0' }, items),
    ),
  };
}

function affirmativeRows(cards, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const rows = [];
  for (const card of cards) {
    const code = cardCode(card);
    if (!AFFIRMATIVE_CODES.has(code)) continue;
    const features = cardFeatures(card);
    const limbs = asList(features.positiveObligations);
    if (!limbs.length) continue;
    limbs.forEach((limb, limbIndex) => {
      const scopeEntries = exceptionEntries(limb?.appliesTo, IOC_AFFIRMATIVE_SCOPE_CODES, card);
      const carveout = features.ordinaryCourseCarveout === true || limb?.ordinaryCourseCarveout === true;
      const pills = [
        ...scopeEntries.map((e, i) => pillFor(PillCell, `${card.id}-scope-${limbIndex}-${i}`, e.label, 'neutral', e.evidence, e.source)),
        carveout ? pillFor(PillCell, `${card.id}-carveout-${limbIndex}`, 'Ordinary-course carve-out applies', 'present', textOf(card), card) : null,
      ].filter(Boolean);
      const obligationText = valueText(limb?.obligation) || textOf(card);
      rows.push({
        id: `ioc-aff-${card.id || code}-${limbIndex}`,
        label: covenantLabelNode(card.short_title || card.defined_term || 'Affirmative covenant', code),
        children: React.createElement(
          'div',
          { className: 'space-y-1.5' },
          pills.length ? React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills) : null,
          obligationText ? seeTextNode([obligationText]) : null,
        ),
      });
    });
  }
  return rows;
}

const GENERAL_EXCEPTION_CANONICAL_CODES = ['COMPANY_DISCLOSURE_LETTER', 'PRIOR_WRITTEN_CONSENT', 'REQUIRED_BY_AGREEMENT', 'REQUIRED_BY_LAW'];

function renderIocFooter(rows, ctx) {
  const CoverageFooter = ctx?.primitives?.CoverageFooter;
  const PillCell = ctx?.primitives?.PillCell;
  const reviewDeal = rows && rows[0] && rows[0].reviewDeal;
  if (!CoverageFooter || !reviewDeal) return null;
  const geCards = (reviewDeal.cards || []).filter((card) => GENERAL_EXCEPTION_CODES.has(cardCode(card)));
  if (!geCards.length) return null;
  const entries = dedupeEntries(geCards.flatMap((c) => exceptionEntries(cardFeatures(c).permittedExceptions, EXCEPTION_CODES, c)));
  const presentCodes = new Set(entries.map((e) => e.code));
  const presentCount = GENERAL_EXCEPTION_CANONICAL_CODES.filter((code) => presentCodes.has(code)).length;
  const absentItems = GENERAL_EXCEPTION_CANONICAL_CODES
    .filter((code) => !presentCodes.has(code))
    .map((code) => ({ id: code, code, label: labelForCode(code, EXCEPTION_CODES) || code }));
  const requiredByLawCarveout = geCards.some((c) => cardFeatures(c).requiredByLawCarveout === true);
  return React.createElement(
    'div',
    null,
    React.createElement(CoverageFooter, {
      presentCount,
      totalCount: GENERAL_EXCEPTION_CANONICAL_CODES.length,
      absentItems,
      label: 'general exceptions apply to the covenants above',
    }),
    requiredByLawCarveout && PillCell
      ? React.createElement(
          'div',
          { className: 'flex flex-wrap gap-1 border-t border-border bg-bg/40 px-3 py-2' },
          pillFor(PillCell, 'required-by-law-carveout', 'Required-by-law carve-out applies', 'info'),
        )
      : null,
  );
}

const iocExceptionsConfig = {
  id: 'ioc-exceptions',
  title: 'Interim Operating Covenants',
  layoutSlot: 'ioc',
  // Row-shape independent of ctx (primitives) so hasRows checks in
  // pages/review/[id].js (which call selectRows without ctx) still work; the
  // actual grouped body is rebuilt with primitives at render time via the
  // 'body' column below (same contract as conditions.config.js).
  selectRows(reviewDeal) {
    const cards = (reviewDeal?.cards || []).filter(isIocCard);
    if (!cards.length) return [];
    return [{ id: 'ioc-body', reviewDeal }];
  },
  columns: [
    {
      id: 'body',
      header: '',
      renderCell(row, ctx) {
        const GroupedSubRows = ctx?.primitives?.GroupedSubRows;
        if (!GroupedSubRows) return null;
        const cards = (row.reviewDeal?.cards || []).filter(isIocCard);
        const negativeRows = negativeCovenantGroups(cards).map((group) => renderNegativeRow(buildNegativeRow(group), ctx));
        const otherRow = buildOtherRestrictionsRow(fragmentCards(cards), ctx);
        // Old-site render order (OLD-review-page.js's IocAffirmativeCovenantsTable
        // ahead of IocNegativeCovenantsTable) puts the affirmative limbs FIRST --
        // REBUILD-SPECS.md section 6 / FEEDBACK-2-PUNCHLIST.md #29. Negative
        // covenants (the named rows) come next, with the near-empty fragments
        // collapsed into the lowest-priority "Other restrictions" band last.
        const groups = [
          { id: 'affirmative', label: 'Affirmative covenants', rows: affirmativeRows(cards, ctx) },
          { id: 'negative', label: 'Negative covenants', rows: negativeRows },
          { id: 'other', label: 'Other restrictions', rows: otherRow ? [otherRow] : [] },
        ];
        return React.createElement(GroupedSubRows, { groups, emptyCopy: 'No interim operating covenants found.' });
      },
    },
  ],
  renderFooter: renderIocFooter,
  empty: { copy: 'No IOC cards found.' },
};

export {
  affirmativeRows,
  buildOtherRestrictionsRow,
  exceptionEntries,
  fragmentCards,
  formatMoney,
  iocExceptionsConfig,
  isIocCard,
  negativeCovenantGroups,
  renderIocFooter,
  renderNegativeRow,
};
