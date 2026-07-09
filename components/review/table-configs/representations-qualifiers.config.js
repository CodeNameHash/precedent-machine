import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { knowledgeQualifierDisplay, normalizeQualifierScope, sortByAgreementOrder, withScopeParens } from '../table-logic.js';
import { standardColorKey } from './standard-colors.js';
import { cardCode, cardType, firstFeature, labelOf, selectCards, textOf, valueText } from './card-utils.js';

const { labelForCode, taxonomyForFeatureKey } = taxonomy;

// This section IS the Company's and Parent's representations and warranties
// -- not a separate "qualifiers" concept layered on top of them. One row per
// REPRESENTATION card (one row per rep), never per-attribute: TERM |
// MATERIALITY QUALIFIER | LOOKBACK. Knowledge is presented separately (see
// R2/R4 below) -- never as a per-rep column.
//
// R5 (Feedback round 4): Company (REP-T-*) and Parent/Buyer (REP-B-*) reps
// were commingled in one table under provision_type=REPRESENTATION. They now
// render as TWO independent tables built by buildRepresentationsConfig()
// below, parametrized by the card-code party prefix rather than duplicating
// the selection/render logic per party.
//
// R1/R2/R4: each table renders as THREE stacked blocks via renderBody()
// rather than one flat <table> --
//   1. General Exceptions -- its own labelled sub-table (SEC-filings
//      cut-off/portions-excluded + Disclosure Letter), same "old scheme"
//      bringdown-box shape as RepGeneralExceptionsTable, sitting at the TOP
//      of the section. Sourced from that party's own preamble card
//      (REP-T-PREAMBLE / REP-B-PREAMBLE) -- Parent's preamble carries no
//      SEC-filings data on Metsera, so this block is simply absent there.
//   2. Knowledge -- its own labelled sub-table of ROWS (Standard / Persons /
//      Scope, then one row per knowledge-qualified rep), never a squeezed
//      column alongside Materiality/Lookback -- that column was distorting
//      the per-rep table's formatting.
//   3. The per-rep table itself -- now just TERM | MATERIALITY | LOOKBACK.

// -- selection ---------------------------------------------------------------

function isRepresentationCard(card) {
  return cardType(card) === 'REPRESENTATION' || cardCode(card).startsWith('REP-');
}

// Strict provision_type match (not isRepresentationCard's looser code-prefix
// OR) -- REP-B-ANTIRELIANCE carries a REP-B- coded subtype but its
// provision_type is MISC_BOILERPLATE (it lives under Anti-Reliance in that
// section, not the Parent reps table); the loose OR would otherwise pull it
// into this table by code prefix alone. See R5 note in FEEDBACK-4-PUNCHLIST.
function isPartyRepresentationCard(card, partyPrefix) {
  return cardType(card) === 'REPRESENTATION' && cardCode(card).startsWith(partyPrefix);
}

// The Article III / IV preamble cards (REP-T-PREAMBLE, REP-B-PREAMBLE) carry
// the SEC-filings carve-out, disclosure-letter and knowledge-scope data for
// the whole section -- they are not themselves a "rep" with its own
// materiality/knowledge/lookback, so they're excluded from the per-rep rows
// and consumed separately below for the General Exceptions block and the
// Knowledge block.
function isPreambleCard(card) {
  return /PREAMBLE$/.test(cardCode(card));
}

function selectRepCards(reviewDeal, partyPrefix) {
  const cards = selectCards(reviewDeal, (card) => isPartyRepresentationCard(card, partyPrefix)).filter((card) => !isPreambleCard(card));
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

// Per-rep knowledge resolution stays exactly as before -- the DATA (which
// reps are knowledge-qualified, and how) is unchanged. What changed (R2) is
// only where it renders: this stays attached to each rep's row (row.knowledge)
// so it survives for the Knowledge block below, but it is never rendered as
// its own column in the per-rep table anymore.
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

// #17: `lookbackPeriod` day-counts are UNRELIABLE (the same anchor date has
// produced 127 vs 1,282 "days" across rows on the same deal) -- there is no
// safe way to trust that field, even as a fallback. The absolute
// `lookbackDateISO` is the only trustworthy signal, so it is used for EVERY
// row; a rep with no `lookbackDateISO` renders no lookback at all rather
// than falling back to a day-count that might be wrong, which would also
// produce the "N days" / "Since <date>" mixture this fix removes.
function resolveLookback(card) {
  const dateHit = firstFeature([card], ['lookbackDateISO']);
  if (!dateHit) return null;
  const formatted = formatIsoDate(dateHit.value);
  if (!formatted) return null;
  return { label: `Since ${formatted}`, evidence: textOf(card) };
}

// -- term ------------------------------------------------------------------------

function resolveTerm(card) {
  const party = cardCode(card).startsWith('REP-B-') ? 'Parent' : null;
  const mainConcept = valueText(firstFeature([card], ['mainConcept'])?.value) || textOf(card);
  return { label: labelOf(card), party, mainConcept };
}

// -- section-level Knowledge standard / persons / scope (R4) -----------------

// "actual-knowledge" -> "Actual knowledge" (spec's literal example phrasing).
function humanizeKnowledgeStandard(raw) {
  const words = String(raw || '').trim().replace(/[-_]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return words.map((w, i) => (i === 0 ? `${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}` : w.toLowerCase())).join(' ');
}

function knowledgeStandardNote(cards) {
  const hit = firstFeature(cards, ['knowledgeStandard']);
  if (!hit) return null;
  const dict = taxonomyForFeatureKey('knowledgeStandard');
  const code = codeOf(hit.value);
  const dictLabel = code && labelForCode(code, dict);
  if (dictLabel) return dictLabel;
  // The claims pipeline's `canonical` is the schema's kebab-case enum
  // ("actual-knowledge") -- a different vocabulary from taxonomy.js's short
  // dict keys ("ACTUAL"), so `code` above often misses. The tagged value's
  // own verbatim `.text` usually carries that short form directly (Metsera:
  // canonical="actual-knowledge", text="ACTUAL") -- try it before falling
  // back to a humanized guess, so this doesn't render "Label: RAW_CODE".
  const rawText = hit.value && typeof hit.value === 'object' ? hit.value.text : null;
  const textDictLabel = rawText && labelForCode(String(rawText).trim().toUpperCase(), dict);
  if (textDictLabel) return textDictLabel;
  if (typeof hit.value === 'string') return humanizeKnowledgeStandard(hit.value);
  if (code) return humanizeKnowledgeStandard(code);
  if (rawText) return humanizeKnowledgeStandard(rawText);
  return valueText(hit.value);
}

// `knowledgePersons` is a LIST feature (schema valueType 'list', listItemType
// 'string') restricted to DEF-type cards -- extract.js emits it as bare
// taxonomy codes ("EXECUTIVE_OFFICERS") rather than tagged {code,label}
// objects, so each item is humanized through the same taxonomy dict/fallback
// chain the other qualifier labels use instead of relying on a tagged shape.
function knowledgePersonsLabel(cards) {
  const hit = firstFeature(cards, ['knowledgePersons']);
  if (!hit) return null;
  const items = Array.isArray(hit.value) ? hit.value : [hit.value];
  const dict = taxonomyForFeatureKey('knowledgePersons');
  const labels = items
    .map((item) => {
      const code = typeof item === 'string' ? item : codeOf(item);
      if (!code) return textOfValue(item) || valueText(item);
      const dictLabel = labelForCode(code, dict);
      if (dictLabel) return dictLabel;
      return /^[A-Z0-9_]+$/.test(code) ? humanizeCode(code) : code;
    })
    .filter(Boolean);
  return labels.length ? labels.join(', ') : null;
}

// `knowledgeScope` is the verbatim core of the deal's "Knowledge" defined
// term, stamped deterministically (post-pass) onto every knowledge-qualified
// rep clause. Falls back across every rep card (not just the first) so one
// rep's corrupted/absent scope text doesn't blank the whole section-level
// value.
function knowledgeScopeText(cards) {
  for (const card of cards || []) {
    const hit = firstFeature([card], ['knowledgeScope']);
    if (!hit) continue;
    const text = textOfValue(hit.value) || (typeof hit.value === 'string' ? hit.value : null);
    if (text) return text;
  }
  return null;
}

// The deal-wide "Knowledge" DEFINITION card (provision_subtype DEF-KNOWLEDGE)
// is the single most reliable source for Standard/Persons/Scope -- it's
// where knowledgePersons actually lives (the feature is DEF-only per the
// schema registry), and Metsera confirms REP-B-* reps carry the scope/
// scope-type stamp but not their own knowledgeStandard duplicate. Falls back
// to defined_term text match in case a deal's DEF-KNOWLEDGE card ever ships
// under a different subtype.
function findKnowledgeDefinitionCard(reviewDeal) {
  const cards = reviewDeal?.cards || [];
  return cards.find((c) => cardCode(c) === 'DEF-KNOWLEDGE')
    || cards.find((c) => cardType(c) === 'DEFINITION' && String(c?.defined_term || '').trim().toLowerCase() === 'knowledge');
}

function knowledgeScopeTextAcross(reviewDeal, cards) {
  const repScope = knowledgeScopeText(cards);
  if (repScope) return repScope;
  const defCard = findKnowledgeDefinitionCard(reviewDeal);
  if (!defCard) return null;
  const hit = firstFeature([defCard], ['definitionText']);
  if (!hit) return null;
  return textOfValue(hit.value) || (typeof hit.value === 'string' ? hit.value : null);
}

// R4: moves the Knowledge standard OUT of the section header note and INTO
// this party's Knowledge sub-table, alongside WHO it attaches to (Persons)
// and the verbatim definition (Scope). Searches the DEF-KNOWLEDGE card first
// (see findKnowledgeDefinitionCard), then this party's own rep cards, so a
// deck without a standalone Knowledge definition still surfaces whatever the
// per-rep stamps carry.
function buildKnowledgeSummaryRow(reviewDeal, idPrefix, cards) {
  const defCard = findKnowledgeDefinitionCard(reviewDeal);
  const searchCards = [defCard, ...cards].filter(Boolean);
  const standard = knowledgeStandardNote(searchCards);
  const persons = knowledgePersonsLabel(searchCards);
  const scope = knowledgeScopeTextAcross(reviewDeal, cards);
  if (!standard && !persons && !scope) return null;
  return {
    id: `${idPrefix}-knowledge-summary`,
    kind: 'knowledge-summary',
    present: true,
    label: 'Knowledge',
    knowledgeStandard: standard,
    knowledgePersons: persons,
    knowledgeScope: scope,
  };
}

// -- General Exceptions (SEC filings + disclosure letter) --------------------

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

// #16: the Company Disclosure Letter IS referenced throughout the reps
// (e.g. secs. 3.13(a), 9.03(a)) -- `disclosureLetterReference` on the
// REP-T-PREAMBLE card is the structured signal for that. Returns null (row
// omitted by the caller) rather than asserting absence when the field truly
// is empty -- silence is a data gap, not evidence the letter doesn't exist.
function disclosureLetterInfo(preamble) {
  if (!preamble) return null;
  const hit = firstFeature([preamble], ['disclosureLetterReference']);
  if (!hit) return null;
  const text = textOfValue(hit.value) || (typeof hit.value === 'string' ? hit.value : valueText(hit.value));
  if (!text) return null;
  return { label: text, evidence: text };
}

// R1: General Exceptions is its OWN row/block -- SEC-filings cut-off,
// portions-excluded, and the disclosure letter reference. Knowledge (the
// group/standard) is a SEPARATE block (buildKnowledgeSummaryRow below); the
// two used to be folded into one combined "Knowledge & General Exceptions"
// top row, which read as General Exceptions being an offshoot of Knowledge
// rather than its own thing.
// R5: parametrized by preambleCode so each party reads its OWN preamble card
// (REP-T-PREAMBLE / REP-B-PREAMBLE) -- Parent's preamble carries no SEC-
// filings or disclosure-letter data on Metsera, so the Parent table's
// General Exceptions block is simply absent rather than showing Company's.
function buildGeneralExceptionsRow(reviewDeal, idPrefix, preambleCode) {
  const preamble = (reviewDeal?.cards || []).find((card) => cardCode(card) === preambleCode);
  const cutoffHit = preamble ? firstFeature([preamble], ['secFilingsExceptionLookback']) : null;
  const excludedHit = preamble ? firstFeature([preamble], ['secFilingsExcludedSections']) : null;
  const cutoff = cutoffHit ? valueText(cutoffHit.value) : null;
  const dict = taxonomyForFeatureKey('secFilingsExcludedSections');
  const excludedRaw = excludedHit ? excludedHit.value : null;
  const excluded = Array.isArray(excludedRaw)
    ? excludedRaw.map((item) => excludedPortionText(item, dict)).filter(Boolean)
    : (excludedRaw ? [excludedPortionText(excludedRaw, dict)].filter(Boolean) : []);
  const disclosureLetter = disclosureLetterInfo(preamble);
  if (!cutoff && !excluded.length && !disclosureLetter) return null;
  return {
    id: `${idPrefix}-general-exceptions`,
    kind: 'general-exceptions',
    present: true,
    card: preamble,
    label: 'General Exceptions',
    secCutoff: cutoff,
    secCutoffQuote: cutoffHit ? textOfValue(cutoffHit.value) : null,
    secExcluded: excluded,
    disclosureLetter,
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

// Term cell -- per-rep rows only now (General Exceptions / Knowledge each
// have their own dedicated block, built separately below).
function renderTerm(row) {
  const label = row.party ? `${row.label} (${row.party})` : row.label;
  return React.createElement(
    'div',
    null,
    React.createElement('span', { className: 'font-medium text-ink', title: cardCode(row.card) || undefined }, label),
    clauseSeeText(row.mainConcept),
  );
}

function renderMateriality(row, ctx) {
  const m = row.materiality;
  if (!m) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return m.label;
  return React.createElement(PillCell, { label: m.label, tone: 'neutral', color: m.color, evidence: m.evidence, source: row.card });
}

function renderLookback(row, ctx) {
  const l = row.lookback;
  if (!l) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return l.label;
  return React.createElement(PillCell, { label: l.label, tone: 'neutral', evidence: l.evidence, source: row.card });
}

// The per-rep Knowledge pill -- used ONLY inside the Knowledge block's rows
// (knowledgeTableNode), never as a per-rep table column (R2).
function renderKnowledgePill(row, ctx) {
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

// `evidence` is a shared quote for every pill in the list (e.g. the SEC
// scope sentence backing a single cut-off pill); when absent, each pill
// falls back to its OWN label as its evidence -- portions-excluded items are
// already verbatim excerpt text (see excludedPortionText above), so the pill
// text itself is the correct hover quote rather than borrowing an unrelated
// sibling's evidence.
function pillList(PillCell, items, evidence, keyPrefix, tone = 'neutral') {
  if (!items || !items.length) return null;
  const pills = items.map((label, index) => {
    const itemEvidence = evidence || label;
    return PillCell
      ? React.createElement(PillCell, { key: `${keyPrefix}-${index}`, label, tone, evidence: itemEvidence })
      : React.createElement('span', { key: `${keyPrefix}-${index}` }, label);
  });
  return React.createElement('div', { className: 'flex flex-wrap gap-1' }, pills);
}

// A small labelled Term | Provision box -- the "old scheme" bringdown-table
// shape (RepGeneralExceptionsTable), reused for both the General Exceptions
// block and the Knowledge block so the two read as siblings, not one
// squeezed into the other.
function sectionBox(key, heading, items) {
  return React.createElement(
    'div',
    { key, className: 'overflow-hidden rounded border border-border' },
    React.createElement(
      'div',
      { className: 'border-b border-border bg-bg/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-inkFaint' },
      heading,
    ),
    React.createElement(
      'div',
      { className: 'overflow-x-auto' },
      React.createElement(
        'table',
        { className: 'min-w-full text-xs font-ui' },
        React.createElement(
          'tbody',
          { className: 'divide-y divide-border' },
          items.map((item) => React.createElement(
            'tr',
            { key: item.key, className: 'align-top' },
            React.createElement('td', { className: 'w-[14rem] px-3 py-2 font-medium text-ink whitespace-nowrap' }, item.term),
            React.createElement('td', { className: 'px-3 py-2 text-ink whitespace-pre-wrap break-words' }, item.node),
          )),
        ),
      ),
    ),
  );
}

// R1: General Exceptions as its own labelled sub-table at the TOP of the
// section -- SEC Filings (cut-off + portions-excluded sub-lines) and the
// Disclosure Letter reference, each its own row. Never folded into the
// per-rep table or glued to the Knowledge block.
function generalExceptionsTableNode(row, ctx) {
  if (!row) return null;
  const PillCell = ctx?.primitives?.PillCell;
  const cutoffNode = pillList(PillCell, row.secCutoff ? [row.secCutoff] : null, row.secCutoffQuote, 'cutoff');
  const excludedNode = pillList(PillCell, row.secExcluded, null, 'excl');
  const secBody = (cutoffNode || excludedNode)
    ? React.createElement(
        'div',
        { className: 'space-y-1.5' },
        subLabelBlock('sec-cutoff', 'Cut-off', cutoffNode),
        subLabelBlock('sec-excluded', 'Portions excluded', excludedNode),
      )
    : null;
  const disclosureNode = row.disclosureLetter
    ? pillList(PillCell, [row.disclosureLetter.label], row.disclosureLetter.evidence, 'disclosure')
    : null;
  const items = [];
  if (secBody) items.push({ key: 'sec', term: 'SEC Filings', node: secBody });
  if (disclosureNode) items.push({ key: 'disclosure', term: 'Disclosure Letter', node: disclosureNode });
  if (!items.length) return null;
  return sectionBox('general-exceptions', 'General Exceptions', items);
}

// R4: Knowledge as its own ROWS -- Standard / Persons / Scope (the section-
// level facts about the deal's "Knowledge" defined term), then one row per
// rep that actually carries a knowledge qualifier. This replaces the old
// squeezed per-rep Knowledge column (and the regex-derived "Knowledge group"
// pill list) with the structured knowledgeStandard/knowledgePersons/
// knowledgeScope claims themselves.
function knowledgeTableNode(knowledgeSummaryRow, repRows, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  const items = [];
  if (knowledgeSummaryRow) {
    if (knowledgeSummaryRow.knowledgeStandard) {
      const node = PillCell
        ? React.createElement(PillCell, { label: knowledgeSummaryRow.knowledgeStandard, tone: 'info', evidence: knowledgeSummaryRow.knowledgeScope })
        : knowledgeSummaryRow.knowledgeStandard;
      items.push({ key: 'standard', term: 'Standard', node });
    }
    if (knowledgeSummaryRow.knowledgePersons) {
      const node = PillCell
        ? React.createElement(PillCell, { label: knowledgeSummaryRow.knowledgePersons, tone: 'info', evidence: knowledgeSummaryRow.knowledgeScope })
        : knowledgeSummaryRow.knowledgePersons;
      items.push({ key: 'persons', term: 'Persons', node });
    }
    if (knowledgeSummaryRow.knowledgeScope) {
      items.push({
        key: 'scope',
        term: 'Scope',
        node: React.createElement('span', { className: 'whitespace-pre-wrap break-words' }, knowledgeSummaryRow.knowledgeScope),
      });
    }
  }
  for (const row of repRows || []) {
    if (!row.knowledge) continue;
    const label = row.party ? `${row.label} (${row.party})` : row.label;
    items.push({ key: row.id, term: label, node: renderKnowledgePill(row, ctx) });
  }
  if (!items.length) return null;
  return sectionBox('knowledge', 'Knowledge', items);
}

const REP_TABLE_COLUMNS = [
  { id: 'term', header: 'Term', width: '18rem' },
  { id: 'materiality', header: 'Materiality Qualifier', width: '14rem' },
  { id: 'lookback', header: 'Lookback' },
];

// The per-rep table -- now just TERM | MATERIALITY | LOOKBACK (R2 drops the
// Knowledge column; Knowledge renders in its own block above instead).
function repsTableNode(repRows, ctx) {
  if (!repRows || !repRows.length) return null;
  return React.createElement(
    'table',
    { className: 'min-w-full text-xs font-ui' },
    React.createElement(
      'thead',
      { className: 'border-b border-border bg-bg/60' },
      React.createElement(
        'tr',
        null,
        REP_TABLE_COLUMNS.map((column) => React.createElement(
          'th',
          {
            key: column.id,
            className: 'px-3 py-2 text-left font-medium uppercase tracking-wider text-inkFaint',
            style: column.width ? { width: column.width } : undefined,
          },
          column.header,
        )),
      ),
    ),
    React.createElement(
      'tbody',
      { className: 'divide-y divide-border' },
      repRows.map((row) => React.createElement(
        'tr',
        { key: row.id, className: 'align-top hover:bg-bg/40' },
        React.createElement('td', { className: 'px-3 py-2 whitespace-normal break-words text-ink' }, renderTerm(row)),
        React.createElement('td', { className: 'px-3 py-2 whitespace-pre-wrap break-words text-ink' }, renderMateriality(row, ctx)),
        React.createElement('td', { className: 'px-3 py-2 whitespace-pre-wrap break-words text-ink' }, renderLookback(row, ctx)),
      )),
    ),
  );
}

// Assembles the three stacked blocks: General Exceptions (R1), Knowledge
// (R2), then the (now three-column) per-rep table.
function renderBody(rows, ctx) {
  const generalExceptions = (rows || []).find((row) => row.kind === 'general-exceptions');
  const knowledgeSummary = (rows || []).find((row) => row.kind === 'knowledge-summary');
  const repRows = (rows || []).filter((row) => row.kind === 'rep');

  const sections = [];
  const geNode = generalExceptionsTableNode(generalExceptions, ctx);
  if (geNode) sections.push(geNode);
  const knowledgeNode = knowledgeTableNode(knowledgeSummary, repRows, ctx);
  if (knowledgeNode) sections.push(knowledgeNode);
  const repsNode = repsTableNode(repRows, ctx);
  if (repsNode) sections.push(React.createElement('div', { key: 'reps', className: 'overflow-x-auto' }, repsNode));

  return React.createElement('div', { className: 'space-y-4' }, sections);
}

// -- config --------------------------------------------------------------------

// Legacy Term/Materiality/Lookback column shape is kept for direct
// column-level testing and as the data contract other tooling may still
// inspect, but the live page renders via renderBody (below) instead of
// ProvisionTable's generic single-table body -- see the ProvisionTable.jsx
// renderBody hook (same pattern as mae-definitions.config.js). Shared by both
// party configs -- the renderCell functions read from the row, not the party.
const REP_COLUMNS = [
  { id: 'term', header: 'Term', width: '16rem', renderCell: renderTerm },
  { id: 'materiality', header: 'Materiality Qualifier', width: '13rem', renderCell: renderMateriality },
  { id: 'lookback', header: 'Lookback', renderCell: renderLookback },
];

// R5: builds ONE party's reps table (General Exceptions + Knowledge +
// per-rep rows), parametrized by that party's card-code prefix and preamble
// code rather than duplicating the selection/assembly logic per party.
function buildRepresentationsConfig({ id, title, partyPrefix, preambleCode }) {
  return {
    id,
    title,
    layoutSlot: 'reps',
    selectRows(reviewDeal) {
      const cards = selectRepCards(reviewDeal, partyPrefix);
      const rows = [];
      const generalExceptionsRow = buildGeneralExceptionsRow(reviewDeal, id, preambleCode);
      if (generalExceptionsRow) rows.push(generalExceptionsRow);
      const knowledgeSummaryRow = buildKnowledgeSummaryRow(reviewDeal, id, cards);
      if (knowledgeSummaryRow) rows.push(knowledgeSummaryRow);
      for (const card of cards) {
        const term = resolveTerm(card);
        rows.push({
          id: `${id}-${card.id}`,
          kind: 'rep',
          present: true,
          card,
          label: term.label,
          party: term.party,
          mainConcept: term.mainConcept,
          materiality: resolveMateriality(card),
          knowledge: resolveKnowledge(card),
          lookback: resolveLookback(card),
        });
      }
      return rows;
    },
    columns: REP_COLUMNS,
    renderBody,
  };
}

const representationsQualifiersConfig = buildRepresentationsConfig({
  id: 'representations-qualifiers',
  title: 'Representations & Warranties — Company',
  partyPrefix: 'REP-T-',
  preambleCode: 'REP-T-PREAMBLE',
});

// R5: Buyer/Parent reps (REP-B-*) were previously commingled into the
// Company table above -- they now render as their own section, mounted
// immediately after Company reps (see pages/review/[id].js).
const parentRepresentationsConfig = buildRepresentationsConfig({
  id: 'parent-representations-qualifiers',
  title: 'Representations & Warranties — Parent',
  partyPrefix: 'REP-B-',
  preambleCode: 'REP-B-PREAMBLE',
});

export {
  isRepresentationCard,
  parentRepresentationsConfig,
  renderBody,
  renderKnowledgePill,
  representationsQualifiersConfig,
  resolveKnowledge,
  resolveLookback,
  resolveMateriality,
  resolveTerm,
  selectRepCards,
};
