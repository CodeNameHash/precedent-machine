import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';
import { knowledgeQualifierDisplay, normalizeQualifierScope, sortByAgreementOrder, withScopeParens } from '../table-logic.js';
import { standardColorKey } from './standard-colors.js';
import { buildRepBringDownMap, hasRecoverableBringDownContext, normRepName } from './conditions.config.js';
import { cardCode, cardFeatures, cardType, firstFeature, labelOf, selectCards, textOf, valueText } from './card-utils.js';
import { TERM_COL_WIDTH, TERM_COL_MAX } from './layout.js';
import { resolveRowFocus } from '../../review-v2/provisionIndexHelpers.js';

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
// v1 reclassification (2026-08-02, R3): the same is true of REP-B-ANTIRELIANCE's
// eight element successors (REP-B-/REP-T- x NOOTHERREPS/NONRELIANCE/
// INDEPINVEST/FRAUDCARVEOUT) -- they land wherever the anti-reliance
// element scan found them (often MISC_BOILERPLATE, not a REPRESENTATION
// section), so this strict provision_type check keeps them out of the
// per-rep table the same way it always kept REP-B-ANTIRELIANCE out.
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

// -- bring-down standard (what the rep is brought down to at closing) ----------
// IMPORTANT: the per-rep `linkedBringDownStandard` claim is a UNIFORM MAE
// mis-stamp on Metsera (all 27 reps read MAT_MAE_QUALIFIED), so it can't be
// trusted. The AUTHORITATIVE per-rep standard is the accuracy-of-reps closing
// condition's `bringDownTiers` (in-all-material-respects / de-minimis / MAE,
// each with a section-cited reps_covered list). We resolve it via the SAME
// map the Conditions section uses (buildRepBringDownMap) so the two agree, and
// use MAE only when the matching side has an explicit catch-all tier.
function resolveBringDown(card, bringDownMap) {
  if (!bringDownMap) return null;
  const code = String(cardCode(card) || '');
  const repType = code.startsWith('REP-T-') ? 'REP-T'
    : code.startsWith('REP-B-') ? 'REP-B' : null;
  if (!repType) return null;
  const key = normRepName(labelOf(card));
  let hit = bringDownMap.get(`${repType}:${key}`);
  if (!hit) {
    for (const [name, meta] of bringDownMap) {
      const prefix = `${repType}:`;
      if (name.startsWith(prefix)) {
        const candidate = name.slice(prefix.length);
        if (candidate && (key.includes(candidate) || candidate.includes(key))) { hit = meta; break; }
      }
    }
  }
  // An unlisted rep is MAE only when its OWN side has an explicit catch-all.
  // Missing or contradictory closing-condition data is unknown, not MAE.
  if (!hit) hit = bringDownMap.catchAllByRepType?.get(repType);
  if (!hit) return null;
  const short = hit.short;
  const colorKey = hit.colorKey;
  return { label: `Bringdown: ${short}`, colorKey, evidence: textOf(card) };
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
  // "see text" must expand to the ACTUAL rep clause, not the mainConcept
  // paraphrase (Ben round 6: the summary "isn't the full rep"). textOf(card)
  // is the card's full primary_quote / region_full_text.
  const mainConcept = textOf(card) || valueText(firstFeature([card], ['mainConcept'])?.value);
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
// FIX 6 (Fable investigation): per-party NAMED_SCHEDULE_LIST claims (one for
// the Company's own schedule, one for the Parent's) resolve through the same
// taxonomy dict to the IDENTICAL label ("Persons listed on Disclosure
// Letter"), so a straight join produced that label twice on SkyWater. Dedupe
// identical resolved labels; when an item's own verbatim text distinguishes
// Company vs Parent, suffix the (deduped) label accordingly rather than
// silently collapsing genuinely different schedules into one line.
const PARTY_HINT_RE = /\b(company|target)\b|\b(parent|buyer|acquiror|acquirer)\b/i;
function partySuffixFor(item) {
  const text = textOfValue(item) || (item && typeof item === 'object' ? `${item.text || ''} ${(item.quotes || []).join(' ')}` : '');
  if (!text) return null;
  if (/\b(company|target)\b/i.test(text)) return 'Company';
  if (/\b(parent|buyer|acquiror|acquirer)\b/i.test(text)) return 'Parent';
  return null;
}
// Ben (Skechers r16, item 3): "EVERY named person gets their own pill --
// never 'other named person(s)' grouping." knowledgePersons items are bare
// taxonomy codes; the OTHER code resolves through the dict to the generic
// "Other named person", so a deal naming several individuals (Apollo/Bridge:
// six people, six OTHER items) collapsed into ONE generic pill. The actual
// names/roles live in the Knowledge DEFINITION's own text on the same card
// the feature came from -- extract them deterministically from the two
// clause shapes the corpus uses:
//   (a) a numbered role list -- "(i) the Company's Chief Financial Officer
//       or General Counsel, (ii) Director, Tax or (iii) Senior Vice
//       President, Global Controller" (Skechers);
//   (b) a personal-name list after "knowledge ... of (each of)" -- "of each
//       of Robert Morse, Jonathan Slager, ..." (Apollo/Bridge, AbbVie/
//       Landos).
// Extracted candidates fill the OTHER slots in order; when extraction
// cannot supply a candidate, each remaining OTHER item still renders as its
// OWN pill (per-item, never merged). Corpus-validated against every deck
// whose knowledgePersons carries OTHER (Verizon/Frontier, Apollo/Bridge,
// Skechers, AbbVie/Landos).
const NAME_STOPWORDS = new Set(['company', 'parent', 'merger', 'sub', 'board', 'disclosure', 'letter', 'schedule', 'schedules', 'section', 'agreement', 'committee', 'person', 'persons', 'stockholder', 'stockholders', 'officer', 'officers', 'director', 'directors', 'knowledge', 'entity', 'subsidiaries', 'affiliates', 'business', 'days', 'effective', 'time',
  // Title words: "Global Controller" / "Vice President" etc. are ROLE
  // fragments, not personal names -- they may only enter via the numbered
  // role-list branch, never the name-shaped-chunk branch.
  'chief', 'executive', 'financial', 'operating', 'general', 'counsel', 'president', 'vice', 'senior', 'global', 'controller', 'treasurer', 'secretary', 'tax', 'legal']);
const TITLE_CODE_RES = {
  CEO: /chief\s+executive\s+officer/i,
  CFO: /chief\s+financial\s+officer/i,
  GENERAL_COUNSEL: /general\s+counsel/i,
  COO: /chief\s+operating\s+officer/i,
};
function looksLikePersonName(chunk) {
  const words = chunk.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Z][\w'’.-]*$/.test(w) && !NAME_STOPWORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
}
function extractKnowledgeNamedPersons(defText) {
  const text = String(defText || '');
  if (!text) return [];
  const candidates = [];
  const push = (raw) => {
    const cleaned = String(raw || '')
      .replace(/^\s*(?:the\s+Company[’']s\s+|the\s+|its\s+|any\s+of\s+the\s+|each\s+of\s+)/i, '')
      .replace(/\s*(?:,|;|\bor\b|\band\b)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned && cleaned.length <= 60 && !candidates.some((c) => c.toLowerCase() === cleaned.toLowerCase())) candidates.push(cleaned);
  };
  // Shape (a): numbered role list. Split on the (i)/(ii)/(A)/(1) markers and
  // stop each segment before the next marker or a boilerplate tail.
  const markerRe = /\((?:i{1,3}|iv|v|vi{0,3})\)\s*/g;
  const windowStartRe = /knowledge[^.;]{0,120}?\bof\b\s+(?:each\s+of\s+)?/gi;
  let start;
  while ((start = windowStartRe.exec(text))) {
    const rest = text.slice(start.index + start[0].length);
    // The window ends at boilerplate tails, sentence punctuation, or the
    // NEXT per-party limb marker (", and (ii) with respect to Parent ...").
    const endMatch = rest.match(/,?\s*(?:in each case|after (?:due|reasonable)|solely with respect|as of the date|set forth|listed|identified|described)\b|,?\s*and\s*\(|[.;]/);
    const window = endMatch ? rest.slice(0, endMatch.index) : rest;
    if (/^\s*\((?:i{1,3}|iv|v|vi{0,3})\)/.test(window)) {
      // Shape (a): the enumerated list follows "knowledge of" DIRECTLY --
      // each numbered segment is one person/role.
      markerRe.lastIndex = 0;
      const segments = window.split(markerRe).slice(1);
      for (const segment of segments) push(segment);
    } else {
      const chunks = window.split(/\s*,\s*(?:and\s+)?|\s+and\s+/);
      let namedAny = false;
      for (const chunk of chunks) {
        if (looksLikePersonName(chunk.trim())) { push(chunk.trim()); namedAny = true; }
      }
      // Generic-group phrasing ("any of the officers or directors of
      // Parent") -- an honest descriptive label straight off the clause.
      if (!namedAny && /officers?\s+or\s+directors?/i.test(window)) {
        push('Officers or directors');
      }
    }
  }
  return candidates;
}
// Definition text backing the persons feature: the card's own quote first
// (verbatim, complete), falling back to the structured definitionText.
function knowledgeDefinitionTextOf(card) {
  if (!card) return '';
  const features = cardFeatures(card);
  return `${textOfValue(features.definitionText) || ''}\n${textOf(card)}`;
}
function knowledgePersonsEntries(cards) {
  const hit = firstFeature(cards, ['knowledgePersons']);
  if (!hit) return null;
  const items = Array.isArray(hit.value) ? hit.value : [hit.value];
  const dict = taxonomyForFeatureKey('knowledgePersons');
  const defText = knowledgeDefinitionTextOf(hit.card);
  const resolved = items
    .map((item) => {
      const code = typeof item === 'string' ? item : codeOf(item);
      let label;
      if (!code) label = textOfValue(item) || valueText(item);
      else {
        const dictLabel = labelForCode(code, dict);
        label = dictLabel || (/^[A-Z0-9_]+$/.test(code) ? humanizeCode(code) : code);
      }
      return label ? { code: code || null, label, suffix: partySuffixFor(item) } : null;
    })
    .filter(Boolean);
  // Named-person queue for the OTHER slots: extracted candidates that are
  // not already represented by a title-coded item (e.g. Skechers' segment
  // "(i) ... Chief Financial Officer or General Counsel" duplicates the
  // CFO / GENERAL_COUNSEL codes and must not also claim an OTHER slot).
  const titleCoveredRes = resolved
    .map((r) => r.code && TITLE_CODE_RES[r.code])
    .filter(Boolean);
  const queue = extractKnowledgeNamedPersons(defText)
    .filter((candidate) => !titleCoveredRes.some((re) => re.test(candidate)));
  // Dedupe by (label, suffix) for coded/titled items (two per-party
  // NAMED_SCHEDULE_LIST claims resolving to the identical label still
  // collapse) -- but OTHER items always resolve per-item: a name off the
  // queue when available, else the generic label kept as its OWN pill.
  const seen = new Set();
  const entries = [];
  for (const { code, label, suffix } of resolved) {
    if (code === 'OTHER') {
      const name = queue.shift();
      const display = name || (suffix ? `${label} (${suffix})` : label);
      entries.push({ label: name ? (suffix ? `${name} (${suffix})` : name) : display, evidence: defText.trim() || null });
      continue;
    }
    const display = suffix ? `${label} (${suffix})` : label;
    const key = `${label}::${suffix || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ label: display, evidence: defText.trim() || null });
  }
  return entries.length ? entries : null;
}
function knowledgePersonsLabel(cards) {
  const entries = knowledgePersonsEntries(cards);
  return entries ? entries.map((entry) => entry.label).join(', ') : null;
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
//
// Party-scope bug (found during the Cox/Charter live IOC fix's spot-check,
// same defect class as negativeCovenantGroups' sectionBand): some decks
// define "Knowledge" TWICE, once per party -- Cox/Charter has two
// DEF-KNOWLEDGE cards, defined_term "Cabot's Knowledge" and "Columbus's
// Knowledge" respectively, both stamped party_scope 'N_A' and section_ref
// 'DEF' (no reliable structured party signal), sitting at ADJACENT indices
// in reviewDeal.cards (both in the back-of-agreement Definitions article,
// nowhere near either party's own Article of reps -- so document-order
// proximity to partyCards is NOT a usable signal here, unlike
// negativeCovenantGroups' section-number band). The old unconditional
// `.find()` handed BOTH the Company AND Parent Knowledge rows the SAME
// first-found card, so e.g. the Parent table's "Standard" row could show
// the Company's ("Cabot") scope text.
//
// The one reliable signal left is the candidate's OWN defined_term: when a
// deal party-qualifies "Knowledge" at all, it does so with a leading proper
// noun ("Cabot's Knowledge") that also appears throughout that same party's
// OTHER cards (rep clauses reference "Cabot" by name constantly). Score
// each candidate by how often its leading defined_term token appears across
// partyCards' own text and pick the best match; ties/zero-signal fall back
// to the first candidate (old behaviour) rather than guessing further.
function candidateNameToken(card) {
  const match = String(card?.defined_term || '').match(/^([A-Z][A-Za-z.&]{2,})/);
  return match ? match[1] : null;
}

function findKnowledgeDefinitionCard(reviewDeal, partyCards) {
  const allCards = reviewDeal?.cards || [];
  const candidates = allCards.filter((c) => cardCode(c) === 'DEF-KNOWLEDGE'
    || (cardType(c) === 'DEFINITION' && String(c?.defined_term || '').trim().toLowerCase() === 'knowledge'));
  if (candidates.length <= 1) return candidates[0] || null;
  const partyText = (Array.isArray(partyCards) ? partyCards : [])
    .map((c) => `${c?.short_title || ''} ${textOf(c)}`)
    .join(' ');
  let best = candidates[0];
  let bestScore = 0;
  for (const candidate of candidates) {
    const token = candidateNameToken(candidate);
    if (!token || !partyText) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = partyText.match(new RegExp(`\\b${escaped}\\b`, 'g'));
    const score = matches ? matches.length : 0;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return best;
}

function knowledgeScopeTextAcross(reviewDeal, cards) {
  const repScope = knowledgeScopeText(cards);
  if (repScope) return repScope;
  const defCard = findKnowledgeDefinitionCard(reviewDeal, cards);
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
  const defCard = findKnowledgeDefinitionCard(reviewDeal, cards);
  const searchCards = [defCard, ...cards].filter(Boolean);
  const standard = knowledgeStandardNote(searchCards);
  const personsEntries = knowledgePersonsEntries(searchCards);
  const persons = personsEntries ? personsEntries.map((entry) => entry.label).join(', ') : null;
  const scope = knowledgeScopeTextAcross(reviewDeal, cards);
  if (!standard && !persons && !scope) return null;
  // Item 2 (r5): most decks have no standalone DEF-KNOWLEDGE card (Standard/
  // Persons come off a per-rep stamp instead -- see the doc comment above),
  // so defCard alone left the Standard/Persons rows permanently un-clickable
  // on those decks. firstFeature() already resolves (and discards) the
  // actual backing card for each fact -- re-derive it here per sub-fact so
  // "no DEF-KNOWLEDGE card" doesn't mean "no click affordance".
  const standardHit = firstFeature(searchCards, ['knowledgeStandard']);
  const personsHit = firstFeature(searchCards, ['knowledgePersons']);
  const marketPresence = {
    strategy: 'feature_non_empty',
    featureKeys: ['knowledgeStandard', 'knowledgePersons'],
    missingState: 'unknown',
  };
  return {
    id: `${idPrefix}-knowledge-summary`,
    kind: 'knowledge-summary',
    present: true,
    label: 'Knowledge',
    value: [standard, persons].filter(Boolean).join(' · ') || 'Definition captured',
    knowledgeStandard: standard,
    knowledgePersons: persons,
    knowledgePersonsEntries: personsEntries,
    knowledgeScope: scope,
    featureKeys: ['knowledgeStandard', 'knowledgePersons'],
    marketProvisionCodes: ['DEF-KNOWLEDGE'],
    marketPresence,
    marketSubterms: [
      {
        key: 'standard',
        label: 'Knowledge standard',
        featureKeys: ['knowledgeStandard'],
        kind: 'categorical',
        presence: {
          strategy: 'feature_non_empty',
          featureKeys: ['knowledgeStandard'],
          missingState: 'unknown',
        },
      },
      {
        key: 'persons',
        label: 'Persons included',
        featureKeys: ['knowledgePersons'],
        kind: 'multi_select',
        presence: {
          strategy: 'feature_non_empty',
          featureKeys: ['knowledgePersons'],
          missingState: 'unknown',
        },
      },
    ],
    sourceCard: defCard,
    standardCard: (standardHit && standardHit.card) || defCard || null,
    personsCard: (personsHit && personsHit.card) || defCard || null,
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

// Ben (round 4): the portions-excluded entries render as verbose verbatim
// ("any exhibits to any Filed Company SEC Documents", "disclosures ... entitled
// Risk Factors", two forward-looking variants) -- tighten each to a crisp
// lawyer label, then dedupe (the two forward-looking entries collapse to one).
function crispExcludedLabel(text) {
  const t = String(text || '');
  if (/exhibit/i.test(t)) return 'Exhibits to SEC filings';
  if (/risk factor/i.test(t)) return 'Risk Factors';
  if (/forward[- ]?looking/i.test(t)) return 'Forward-looking statements';
  if (/market risk|quantitative and qualitative/i.test(t)) return 'Market-risk disclosures';
  return t.trim();
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

// Item 12 (round 3, Theravance): secFilingsExceptionLookback often stores
// the raw phrase ("since the Applicable Date") rather than the literal date
// -- but the resolving fact usually exists elsewhere on the deal (e.g.
// REP-T-SEC's/DEF-GENERAL's own clause text: '...since January 1, 2024 (the
// "Applicable Date")...'). This is a render-time resolution over data
// already on the deal -- no new extraction.
const DATE_LOOKBACK_TERM_RE = /\bthe\s+([A-Z][A-Za-z ]*?Date)\b/;
const LITERAL_DATE_RE = /\b(?:19|20)\d{2}\b|January|February|March|April|May|June|July|August|September|October|November|December/;
const MONTH_ABBREV = {
  january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
  july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
};
function formatShortDate(dateText) {
  const m = String(dateText || '').match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return dateText;
  const abbrev = MONTH_ABBREV[m[1].toLowerCase()] || m[1];
  return `${abbrev} ${Number(m[2])}, ${m[3]}`;
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Only resolve when the stored phrase names a "the <Something> Date" term
// AND carries no literal date itself -- a cutoff that already has a real
// date should never be overwritten.
function resolveDateLookback(cutoff, reviewDeal) {
  if (!cutoff || LITERAL_DATE_RE.test(cutoff)) return null;
  const termMatch = cutoff.match(DATE_LOOKBACK_TERM_RE);
  if (!termMatch) return null;
  const term = termMatch[1].trim();
  const escapedTerm = escapeRegExp(term);
  const sinceRe = new RegExp(`since\\s+([A-Za-z]+\\s+\\d{1,2},\\s*\\d{4})\\s*\\(the\\s+[“"]${escapedTerm}[”"]\\)`, 'i');
  const meansRe = new RegExp(`[“"]${escapedTerm}[”"]\\s+means\\s+([A-Za-z]+\\s+\\d{1,2},\\s*\\d{4})`, 'i');
  const sources = [
    ...(reviewDeal?.cards || []).map((card) => textOf(card)),
    ...(Array.isArray(reviewDeal?.definitions) ? reviewDeal.definitions : []).map((def) => String(def?.defined_value || '')),
  ];
  for (const text of sources) {
    if (!text) continue;
    const hit = text.match(sinceRe) || text.match(meansRe);
    if (hit) {
      const sentenceMatch = text.slice(0, hit.index + hit[0].length).match(/[^.]*$/);
      const tailMatch = text.slice(hit.index + hit[0].length).match(/^[^.]*\./);
      const sentence = `${(sentenceMatch ? sentenceMatch[0] : '')}${tailMatch ? tailMatch[0] : ''}`.trim();
      return { term, date: hit[1], sentence: sentence || hit[0] };
    }
  }
  return null;
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
  let cutoff = cutoffHit ? valueText(cutoffHit.value) : null;
  let cutoffQuote = cutoffHit ? textOfValue(cutoffHit.value) : null;
  const resolvedLookback = cutoff ? resolveDateLookback(cutoff, reviewDeal) : null;
  if (resolvedLookback) {
    cutoff = `since ${formatShortDate(resolvedLookback.date)} (the "${resolvedLookback.term}")`;
    cutoffQuote = resolvedLookback.sentence;
  }
  const dict = taxonomyForFeatureKey('secFilingsExcludedSections');
  const excludedRaw = excludedHit ? excludedHit.value : null;
  const excludedRawList = Array.isArray(excludedRaw) ? excludedRaw : (excludedRaw ? [excludedRaw] : []);
  // Item 1c (r6): these items are frequently tagged `code: "OTHER"` (SkyWater:
  // both "Risk factors" and "Forward-looking statements" carve-outs land on
  // the generic OTHER code, since secFilingsExcludedSections' dict only
  // covers a handful of named buckets) -- crispExcludedLabel() collapses the
  // raw verbatim clause fragment down to a short lawyer label for DISPLAY,
  // but the pill's clickable evidence must still be the item's own verbatim
  // text, not the crisp label repeated back at itself (that read as an
  // unclickable/opaque dead-end, especially for OTHER-coded items with no
  // dict label of their own). Keep {label, evidence} pairs per item instead
  // of collapsing to a flat label-only array.
  const seenExcludedLabels = new Set();
  const excluded = [];
  for (const item of excludedRawList) {
    const verbatim = excludedPortionText(item, dict);
    if (!verbatim) continue;
    const label = crispExcludedLabel(verbatim);
    if (!label || seenExcludedLabels.has(label)) continue;
    seenExcludedLabels.add(label);
    excluded.push({ label, evidence: verbatim });
  }
  const disclosureLetter = disclosureLetterInfo(preamble);
  if (!cutoff && !excluded.length && !disclosureLetter) return null;
  return {
    id: `${idPrefix}-general-exceptions`,
    kind: 'general-exceptions',
    present: true,
    card: preamble,
    label: 'General Exceptions',
    secCutoff: cutoff,
    secCutoffQuote: cutoffQuote,
    secExcluded: excluded,
    disclosureLetter,
  };
}

// -- rendering ---------------------------------------------------------------

// Item 1a/2 (r6): the per-rep "See provision" toggle used to render an
// inline <details> right beside the bring-down pill (clauseSeeText, now
// removed) -- moved to the SAME full-width <tr><td colSpan> expansion
// pattern the General Exceptions/Knowledge blocks now use above, ported
// from ProvisionTable.jsx's generic path (ctx.SeeProvisionToggle /
// ctx.ExpansionRow). The toggle itself still sits on the row's own line
// below the bring-down pill (block-level, not squeezed beside label text);
// the expansion content is appended by repsTableNode as a sibling <tr>.
function renderTerm(row, ctx) {
  // r9: the section title already carries the party — no per-row suffix.
  const label = row.label;
  const PillCell = ctx?.primitives?.PillCell;
  const SeeProvisionToggle = ctx?.SeeProvisionToggle;
  const bd = row.bringDown;
  const bdPill = bd
    ? (PillCell
        ? React.createElement(PillCell, { label: bd.label, tone: 'neutral', color: bd.colorKey, evidence: bd.evidence, source: row.card })
        : React.createElement('span', { className: 'text-[10px]' }, bd.label))
    : null;
  const hasExpansion = Boolean(row.mainConcept) && Boolean(SeeProvisionToggle);
  const isExpanded = hasExpansion && ctx?.expandedRowId === row.id;
  const toggle = hasExpansion
    ? React.createElement(SeeProvisionToggle, {
        open: isExpanded,
        onToggle: () => ctx.setExpandedRowId((cur) => (cur === row.id ? null : row.id)),
      })
    : null;
  const inlineRow = (bdPill || toggle)
    ? React.createElement('div', { className: 'mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1' }, bdPill, toggle)
    : null;
  return React.createElement(
    'div',
    null,
    React.createElement('span', { className: 'font-medium text-ink', title: cardCode(row.card) || undefined }, label),
    inlineRow,
  );
}

// Item 13: the rep-qualifier pill's popover otherwise opens on the full
// clause (evidence: textOfValue(hit.value) || textOf(card)) with no
// indication of WHICH rep it belongs to -- pass the row's own rep label
// explicitly so the popover's first line reads e.g. "Organization;
// Qualification; Standing — MAE qualifier" instead of a bare quote.
function repSourceLabel(row, qualifierName) {
  const repLabel = row.label;
  return repLabel ? `${repLabel} — ${qualifierName}` : qualifierName;
}

function renderMateriality(row, ctx) {
  const m = row.materiality;
  if (!m) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return m.label;
  return React.createElement(PillCell, { label: m.label, tone: 'neutral', color: m.color, evidence: m.evidence, source: row.card, sourceLabel: repSourceLabel(row, 'materiality qualifier') });
}

// Ben (Mergertrace round 1): one QUALIFIERS column per rep row — the
// materiality pill and the rep's own knowledge-qualifier pill side by side,
// identical for the Company and Parent tables (shared renderer). Knowledge
// stops being listed per-rep inside the Knowledge block above; that block
// keeps only the deal-level Standard / Persons facts.
function renderQualifiers(row, ctx) {
  const materiality = renderMateriality(row, ctx);
  const knowledge = renderKnowledgePill(row, ctx);
  if (!materiality && !knowledge) return null;
  return React.createElement(
    'div',
    { className: 'flex flex-wrap items-start gap-1' },
    materiality,
    knowledge,
  );
}

function renderLookback(row, ctx) {
  const l = row.lookback;
  if (!l) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return l.label;
  return React.createElement(PillCell, { label: l.label, tone: 'neutral', evidence: l.evidence, source: row.card, sourceLabel: repSourceLabel(row, 'lookback') });
}

// The per-rep Knowledge pill -- used ONLY inside the Knowledge block's rows
// (knowledgeTableNode), never as a per-rep table column (R2).
function renderKnowledgePill(row, ctx) {
  const k = row.knowledge;
  if (!k) return null;
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return k.label;
  return React.createElement(PillCell, { label: k.label, tone: 'info', evidence: k.evidence, source: row.card, sourceLabel: repSourceLabel(row, 'knowledge qualifier') });
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
// Item 1c (r6): items may now be plain label strings (legacy shape) OR
// {label, evidence} pairs -- buildGeneralExceptionsRow's secExcluded entries
// carry their OWN verbatim per item (an OTHER-coded item's crisp label
// alone was a dead end: hovering/clicking it just echoed the same label
// back). An object entry's own evidence always wins over the shared
// `evidence` param.
function pillList(PillCell, items, evidence, keyPrefix, tone = 'neutral') {
  if (!items || !items.length) return null;
  const pills = items.map((entry, index) => {
    const isEntryObject = entry && typeof entry === 'object';
    const label = isEntryObject ? entry.label : entry;
    const itemEvidence = (isEntryObject && entry.evidence) || evidence || label;
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
// Item 3 (round 3): table-fixed + the SAME shared TERM_COL token as the
// per-rep table below (REP_TABLE_COLUMNS) -- the old `w-[14rem]` +
// `whitespace-nowrap` box never shrank at any viewport (fixed 14rem
// regardless of screen width) while every sibling table's first column DID
// shrink, which is exactly the "reps boxes don't shrink at all" jitter
// Ben flagged. `whitespace-normal break-words` (replacing `whitespace-
// nowrap`) lets long Knowledge Standard/Persons labels wrap instead of
// forcing the column wide.
// Item 2 (r5): optional ctx (resolveCard/onSelectCard/selectedCardId, same
// contract as ProvisionTable.jsx's generic <tr> loop) wires each item to the
// ClauseSidebar when the item carries a `card` -- used by the Knowledge
// block's Standard/Persons rows (General Exceptions items don't set `card`,
// so they render exactly as before: no click affordance).
// Item 1/2 (r6): "See provision" moves OUT of the label cell's inline
// <details> and into the SAME full-width <tr><td colSpan> expansion pattern
// ProvisionTable.jsx's generic path uses (ctx.SeeProvisionToggle /
// ctx.ExpansionRow, threaded onto bodyCtx by ProvisionTable.jsx) -- own line
// below the row instead of squeezed beside the label text, and it always
// shows the FULL backing provision (item.fullText), with the specific
// sub-fact the row's pill is keyed off rendered as a highlighted "portion"
// callout beneath rather than standing in for the whole clause.
function sectionBox(key, heading, items, ctx) {
  const SeeProvisionToggle = ctx?.SeeProvisionToggle;
  const ExpansionRow = ctx?.ExpansionRow;
  const PortionExcludedNote = ctx?.PortionExcludedNote;
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
        { className: 'min-w-full table-fixed text-xs font-ui' },
        React.createElement(
          'colgroup',
          null,
          React.createElement('col', { style: { width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX } }),
          React.createElement('col', null),
        ),
        React.createElement(
          'tbody',
          { className: 'divide-y divide-border' },
          items.map((item) => {
            const rowCard = ctx?.onSelectCard && item.card ? item.card : null;
            const rowCardKey = rowCard ? (rowCard.id || rowCard.provision_instance_id) : null;
            const isSelectedRow = Boolean(rowCardKey) && ctx?.selectedCardId === rowCardKey;
            const rowKey = item.key;
            const hasExpansion = Boolean(item.fullText) && Boolean(SeeProvisionToggle) && Boolean(ExpansionRow);
            const isExpanded = hasExpansion && ctx?.expandedRowId === rowKey;
            return React.createElement(
              React.Fragment,
              { key: rowKey },
              React.createElement(
                'tr',
                {
                  className: `align-top${rowCard ? ' mtx-row-clickable' : ''}`,
                  onClick: rowCard ? () => ctx.onSelectCard(rowCard, resolveRowFocus({
                    label: item.term,
                    evidence: item.quote,
                    featureKeys: item.featureKeys,
                    itemCode: cardCode(rowCard),
                  })) : undefined,
                  style: rowCard ? { cursor: 'pointer', ...(isSelectedRow ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' } : {}) } : undefined,
                },
                React.createElement(
                  'td',
                  { className: 'px-3 py-2 font-medium text-ink whitespace-normal break-words' },
                  item.term,
                  // Item 1a/2 (r6): the toggle is a block-level element on
                  // its own line below the label, not inline beside it, and
                  // its expansion renders as a full-width row below (never
                  // squeezed into this cell).
                  hasExpansion ? React.createElement(SeeProvisionToggle, {
                    open: isExpanded,
                    onToggle: () => ctx.setExpandedRowId((cur) => (cur === rowKey ? null : rowKey)),
                  }) : null,
                ),
                React.createElement('td', { className: 'px-3 py-2 text-ink whitespace-pre-wrap break-words' }, item.node),
              ),
              isExpanded ? React.createElement(
                ExpansionRow,
                { rowKey, colSpan: 2 },
                React.createElement(
                  React.Fragment,
                  null,
                  item.fullText,
                  item.portionText ? React.createElement(PortionExcludedNote, { label: item.portionLabel, text: item.portionText }) : null,
                ),
              ) : null,
            );
          }),
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
  // Item 1b (r6): "See provision" must show the FULL backing provision, not
  // the sub-fact quote alone (was: cutoffQuote, a ~7-word fragment like
  // "prior to the date of this agreement" standing in for the whole
  // preamble clause). The preamble card's own full quote is that provision;
  // the sub-fact that the row's pill is actually keyed off (the cut-off
  // phrase / the disclosure-letter reference) renders as a highlighted
  // "portion excluded" callout beneath it instead of replacing it.
  const fullCardText = textOf(row.card);
  const items = [];
  if (secBody) items.push({ key: 'sec', term: 'SEC Filings', node: secBody, card: row.card, quote: row.secCutoffQuote, fullText: fullCardText, portionLabel: 'Cut-off phrase excluded', portionText: row.secCutoffQuote });
  if (disclosureNode) items.push({ key: 'disclosure', term: 'Disclosure Letter', node: disclosureNode, card: row.card, quote: row.disclosureLetter?.evidence, fullText: fullCardText, portionLabel: 'Disclosure letter reference', portionText: row.disclosureLetter?.evidence !== fullCardText ? row.disclosureLetter?.evidence : null });
  if (!items.length) return null;
  return sectionBox('general-exceptions', 'General Exceptions', items, ctx);
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
      // Item 2 (r5): "knowledge standard rows" must be clickable per the
      // sidebar feedback package -- sourceCard/quote wired above in
      // buildKnowledgeSummaryRow flow through sectionBox's ctx wiring.
      items.push({
        key: 'standard',
        term: 'Standard',
        node,
        card: knowledgeSummaryRow.standardCard,
        quote: knowledgeSummaryRow.knowledgeScope,
        fullText: knowledgeSummaryRow.knowledgeScope,
        featureKeys: ['knowledgeStandard'],
      });
    }
    if (knowledgeSummaryRow.knowledgePersons) {
      // Ben (Skechers r16, item 3): one pill PER person/role, never a single
      // joined pill (and never an "Other named person(s)" grouping) --
      // knowledgePersonsEntries resolves each item individually, with the
      // actual names extracted from the Knowledge definition where the item
      // codes are the generic OTHER. pillList's flex-wrap container lets a
      // long list (Apollo/Bridge: six names) wrap across lines.
      const entries = Array.isArray(knowledgeSummaryRow.knowledgePersonsEntries) && knowledgeSummaryRow.knowledgePersonsEntries.length
        ? knowledgeSummaryRow.knowledgePersonsEntries.map((entry) => ({ label: entry.label, evidence: entry.evidence || knowledgeSummaryRow.knowledgeScope }))
        : [{ label: knowledgeSummaryRow.knowledgePersons, evidence: knowledgeSummaryRow.knowledgeScope }];
      const node = PillCell
        ? pillList(PillCell, entries, knowledgeSummaryRow.knowledgeScope, 'knowledge-person', 'info')
        : knowledgeSummaryRow.knowledgePersons;
      items.push({
        key: 'persons',
        term: 'Persons',
        node,
        card: knowledgeSummaryRow.personsCard,
        quote: knowledgeSummaryRow.knowledgeScope,
        fullText: knowledgeSummaryRow.knowledgeScope,
        featureKeys: ['knowledgePersons'],
      });
    }
    // R5-round4 (Ben): Scope dropped from the Knowledge block -- Standard +
    // Persons carry it; the full scope sentence stays as the pill hover
    // evidence rather than its own row.
  }
  // Per-rep knowledge qualifiers moved into the main table's QUALIFIERS
  // column (Ben, Mergertrace round 1) — this block keeps only the
  // deal-level Standard / Persons facts about the defined term.
  if (!items.length) return null;
  return sectionBox('knowledge', 'Knowledge', items, ctx);
}

// Item 3: the per-rep table's Term column uses the SAME shared token as
// every other family's first column (and sectionBox's Knowledge/General-
// Exceptions boxes above, via table-fixed + colgroup) -- Ben's specific ask
// was that these two match exactly.
const REP_TABLE_COLUMNS = [
  { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX },
  { id: 'materiality', header: 'Qualifiers' },
  { id: 'lookback', header: 'Lookback' },
];

// The per-rep table -- now just TERM | MATERIALITY | LOOKBACK (R2 drops the
// Knowledge column; Knowledge renders in its own block above instead).
function repsTableNode(repRows, ctx) {
  if (!repRows || !repRows.length) return null;
  return React.createElement(
    'table',
    { className: 'min-w-full table-fixed text-xs font-ui' },
    React.createElement(
      'colgroup',
      null,
      REP_TABLE_COLUMNS.map((column) => React.createElement('col', {
        key: `col-${column.id}`,
        style: column.width ? { width: column.width, maxWidth: column.maxWidth } : undefined,
      })),
    ),
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
      repRows.map((row) => {
        // Item 1/2 (r5): one row IS one rep card here (unlike MAE/equity-
        // awards, where several rows share a parent card) -- resolveRowFocus
        // has no row-specific quote to add beyond the card's own
        // primary_quote, so ClauseSidebar's existing parent-quote fallback
        // is already the correct row-scoped content.
        const rowCard = ctx.onSelectCard && row.card ? row.card : null;
        const rowCardKey = rowCard ? (rowCard.id || rowCard.provision_instance_id) : null;
        const isSelectedRow = Boolean(rowCardKey) && ctx.selectedCardId === rowCardKey;
        const canonicalBinding = typeof ctx.canonicalBindingForRow === 'function'
          ? ctx.canonicalBindingForRow(row)
          : null;
        const canonicalSelectable = Boolean(canonicalBinding)
          && typeof ctx.onSelectCanonicalBinding === 'function';
        const isSelectedCanonical = canonicalSelectable
          && ctx.selectedCanonicalBindingKey === canonicalBinding.binding_key;
        const rowSelectable = canonicalSelectable || Boolean(rowCard);
        // Item 2 (r6): full-width expansion row, ported from
        // ProvisionTable.jsx's generic path -- ctx.ExpansionRow is threaded
        // onto bodyCtx by ProvisionTable.jsx itself, same as
        // ctx.SeeProvisionToggle consumed inside renderTerm() above.
        const ExpansionRow = ctx.ExpansionRow;
        const isExpanded = Boolean(row.mainConcept) && Boolean(ExpansionRow) && ctx.expandedRowId === row.id;
        return React.createElement(
        React.Fragment,
        { key: row.id },
        React.createElement(
        'tr',
        {
          className: `align-top hover:bg-bg/40${rowSelectable ? ' mtx-row-clickable' : ''}`,
          // Sidebar redesign item 3: thread the rep's own qualifier
          // attributes through so ClauseSidebar can break the row into
          // labelled bits (materiality standard, knowledge qualifier,
          // lookback date) each with its own corpus distribution, instead
          // of a single undifferentiated "this row" block.
          onClick: canonicalSelectable
            ? () => ctx.onSelectCanonicalBinding(canonicalBinding, row.label)
            : rowCard ? () => ctx.onSelectCard(rowCard, resolveRowFocus(row)) : undefined,
          style: rowSelectable ? {
            cursor: 'pointer',
            ...((isSelectedCanonical || isSelectedRow)
              ? { background: 'rgba(47,109,181,.07)', boxShadow: 'inset 2px 0 0 #2F6DB5' }
              : {}),
          } : undefined,
          'data-canonical-review-binding': canonicalBinding?.binding_key,
        },
        React.createElement('td', { className: 'px-3 py-2 whitespace-normal break-words text-ink' }, renderTerm(row, ctx)),
        React.createElement('td', { className: 'px-3 py-2 whitespace-pre-wrap break-words text-ink' }, renderQualifiers(row, ctx)),
        React.createElement('td', { className: 'px-3 py-2 whitespace-pre-wrap break-words text-ink' }, renderLookback(row, ctx)),
        ),
        isExpanded ? React.createElement(ExpansionRow, { rowKey: row.id, colSpan: REP_TABLE_COLUMNS.length }, row.mainConcept) : null,
        );
      }),
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
  { id: 'term', header: 'Term', width: TERM_COL_WIDTH, maxWidth: TERM_COL_MAX, renderCell: renderTerm },
  { id: 'materiality', header: 'Qualifiers', renderCell: renderQualifiers },
  { id: 'lookback', header: 'Lookback', renderCell: renderLookback },
];

function repMarketSubterms({ card, term, materiality, knowledge, lookback, bringDown, bringDownCode }) {
  const subterms = [];
  if (materiality) {
    subterms.push({
      key: 'materiality',
      label: 'Materiality qualifier',
      featureKeys: ['materialityQualifier'],
      kind: 'categorical',
    });
  }
  if (knowledge) {
    subterms.push({
      key: 'knowledge',
      label: 'Knowledge qualifier',
      featureKeys: ['knowledgeQualifier'],
      kind: 'categorical',
    });
  }
  if (lookback) {
    subterms.push({
      key: 'lookback',
      label: 'Lookback period',
      featureKeys: ['lookbackDateISO'],
      kind: 'duration',
      role: 'metric',
      value: {
        strategy: 'feature_value',
        featureKeys: ['lookbackDateISO'],
        normalizer: 'relative_period_months',
      },
      semantics: {
        unit: 'months',
        calendarBasis: 'elapsed',
        trigger: 'signing_date',
        requiredDimensions: ['unit', 'calendarBasis'],
        normalisation: { type: 'relative_period_to_months' },
      },
    });
  }
  if (bringDown) {
    subterms.push({
      key: 'bring-down',
      label: 'Bring-down standard',
      featureKeys: ['bringDownTiers'],
      kind: 'multi_select',
      provisionCodes: [bringDownCode],
      value: {
        strategy: 'feature_value',
        featureKeys: ['bringDownTiers'],
        normalizer: 'bring_down_for_rep',
        repLabel: term.label,
        repCode: cardCode(card),
        repSection: cardFeatures(card).sectionNumber
          || String(card?.section_number || card?.section_ref || '').split('|')[0].trim(),
      },
    });
  }
  return subterms;
}

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
      const bringDownMap = buildRepBringDownMap(reviewDeal);
      const bringDownCode = partyPrefix === 'REP-B-' ? 'COND-S-REP' : 'COND-B-REP';
      const hasBringDownContext = hasRecoverableBringDownContext(reviewDeal);
      for (const card of cards) {
        const term = resolveTerm(card);
        const materiality = resolveMateriality(card);
        const knowledge = resolveKnowledge(card);
        const lookback = resolveLookback(card);
        const bringDown = hasBringDownContext ? resolveBringDown(card, bringDownMap) : null;
        const featureKeys = [];
        if (materiality) featureKeys.push('materialityQualifier');
        if (knowledge) featureKeys.push('knowledgeQualifier');
        if (lookback) featureKeys.push('lookbackDateISO');
        rows.push({
          id: `${id}-${card.id}`,
          kind: 'rep',
          present: true,
          card,
          label: term.label,
          party: term.party,
          mainConcept: term.mainConcept,
          materiality,
          knowledge,
          lookback,
          bringDown,
          featureKeys,
          itemCode: featureKeys.length ? cardCode(card) : null,
          marketSubterms: repMarketSubterms({ card, term, materiality, knowledge, lookback, bringDown, bringDownCode }),
          currentTreatments: bringDown ? [{
            label: 'Bringdown',
            value: bringDown.label.replace(/^Bringdown:\s*/, ''),
            quote: bringDown.evidence || null,
          }] : [],
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
  extractKnowledgeNamedPersons,
  isRepresentationCard,
  knowledgePersonsEntries,
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
