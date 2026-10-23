'use strict';

// Builds the table view behind the published/Query "coded conclusions as
// pills per subject" pages (docs/core/CODEBASE-GUIDE.md "Layered fact model,
// V2"; mockup approved by Ben 2026-09-12/13). Pure function; no database or
// model access. Table shapes: contracts/product/table-shapes.v3.json
// (lib/product/table-shapes.js validates the contract; this module reads it
// as data, it does not re-validate it).
//
// A parallel worker is adding a `conclusions` layer to each fact
// (contracts/product/fact-conclusions.v1.json, lib/product/fact-conclusions.js
// with renderConclusionCells(fact, tableShapes) and tableForFact) that is not
// merged yet. This module codes against that interface defensively: it tries
// to require the module and, when present, prefers its resolution of a
// fact's table and cells; when the module is unavailable but a fact already
// carries a plain `conclusions` object (`{ table_key, row_label, cells }`),
// that data is used directly; otherwise a fact's cells are rendered from its
// components by each column's `fill_from` kind (the component's `label` as
// the pill label, its `text` as the hover/evidence words).

let factConclusions = null;
try {
  // eslint-disable-next-line global-require
  factConclusions = require('./fact-conclusions');
} catch (err) {
  factConclusions = null;
}
const { hidePageFooters, factWithoutPageFooters } = require('./source-display');

function walkComponents(components, out = []) {
  for (const component of components || []) {
    out.push(component);
    walkComponents(component.children, out);
  }
  return out;
}

// The fact's own words: its top-level OWN-origin components in source
// order (the inherited context lines of the tree are not the fact's words;
// nested children repeat their parent's text).
function factOwnText(fact) {
  return hidePageFooters((fact?.components || []).filter((component) => component && (component.origin === 'OWN' || !component.origin) && component.text)
    .map((component) => component.text.trim()).join(' '));
}

// Ben, 2026-09-14, on the closing row: "we shouldn't just be dumping in the
// full text in the summary". An as-drafted cell shows the fact's operative
// core, not every component: its own top-level ACTOR, OPERATION, OBJECT and
// TERM words plus whatever the headline marks as distinguishing (the
// threshold, period, date, standard or trigger that sets this deal apart),
// in source order, with an ellipsis where words are skipped. Inherited
// chapeau or introduction words and the remaining qualifiers, conditions,
// exceptions and triggers stay behind "See provision".
const SUMMARY_CORE_KINDS = new Set(['ACTOR', 'OPERATION', 'OBJECT', 'TERM', 'LIST', 'LITANY', 'DEFINED_TERM']);

function isOwn(component) {
  return !!component && (component.origin === 'OWN' || !component.origin) && !!component.text;
}

function anchoredAll(components) {
  return components.every((component) => Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte));
}

function inSourceOrder(components) {
  return anchoredAll(components) ? [...components].sort((left, right) => left.start_byte - right.start_byte) : [...components];
}

// The fact's own top-level components (its words, not the inherited
// context lines), in source order.
function ownComponents(fact) {
  return inSourceOrder((fact?.components || []).filter(isOwn));
}

// The operative core of a fact: its own ACTOR, OPERATION, OBJECT and TERM
// components plus whatever the headline marks as distinguishing; every own
// component when none of those is present. Source order.
function summaryComponents(fact) {
  const own = ownComponents(fact);
  if (own.length === 0) return [];
  const distinguishing = new Set(Array.isArray(fact?.headline?.distinguishing_component_ids) ? fact.headline.distinguishing_component_ids : []);
  const chosen = own.filter((component) => SUMMARY_CORE_KINDS.has(component.kind) || distinguishing.has(component.component_id));
  return chosen.length === 0 ? own : chosen;
}

// Joins components' words in source order, an ellipsis where words between
// two of them were skipped.
function joinInSourceOrder(components) {
  const ordered = inSourceOrder(components);
  const anchored = anchoredAll(ordered);
  const parts = [];
  let previous = null;
  for (const component of ordered) {
    let text = String(component.text || '').trim();
    if (!text) continue;
    // Two components that cover the same bytes (an ACTOR "The Company shall
    // treat" beside an OPERATION "shall treat any shares") are one run of
    // words: the overlap is written once (generation 6, 2.03: "The Company
    // shall treat shall treat any shares", "the Closing Amount the Closing
    // Amount").
    if (previous && anchored && Number.isSafeInteger(previous.end_byte) && component.start_byte < previous.end_byte) {
      if (component.end_byte <= previous.end_byte) continue;
      const overlap = previous.end_byte - component.start_byte;
      const bytes = Buffer.from(String(component.text || ''), 'utf8');
      text = bytes.subarray(Math.min(overlap, bytes.length)).toString('utf8').trim();
      if (!text) continue;
    } else if (previous && anchored && component.start_byte > previous.end_byte + 1) {
      parts.push('…');
    }
    parts.push(text);
    previous = component.end_byte > (previous?.end_byte ?? -1) ? component : previous;
  }
  return parts.join(' ').replace(/ … /g, ' … ');
}

function factSummaryText(fact) {
  return hidePageFooters(joinInSourceOrder(summaryComponents(fact)));
}

// Ben, 2026-09-14, on the § 1.03 transaction-step facts (the Certificate of
// Merger filing) sitting under "facts without a coded readout": "hand off to
// an agent but I think you do a great job of splitting up the obligations
// that need to happen and I'd try to render them as a hidden 'other
// provisions' section under the main structure and mechanics parts - needs
// to be high level - Company files CoM and other required docs which must
// be acceptable to Parent". And on the same five: "you have 5 different
// facts here which I understand given the sentence structure but consider
// if you can show them as one fact in the layer tree with 'Branches' for
// the different clauses/'or's etc on UI".
//
// Facts of a one-row family that add no cell of their own are grouped by
// (subtype, the source span of their first own component): the facts cut
// from one sentence become one line carrying the words every one of them
// shares, with a branch per fact carrying only that fact's own words. A
// group of one is a plain line. Each line is high level: the operative core
// (summaryComponents), never the full fact text.
// The Term of an other-provision row (Ben, 2026-09-14, on the first table:
// "it needs to be a summary of the provision on the right etc - like in the
// normal course. Not just a sec ref...!"). First choice is the extractor's
// own headline.summary (contract FACT_COMPONENTS/V2 summary_rule; asked
// whether the extractor should write a short summary per fact as part of
// the fact contract, Ben: "1. for now - yes"; standing rule: "everything to
// be driven by coding and not just a layer on top so all edits need to be
// repeatable across corpus"). Older generations have no summary, so the
// term is then built from the labels the extractor gave the fact's own
// components: the labels of the ACTOR, OPERATION and OBJECT components in
// that order (the standard, condition, exception, trigger or term labels
// when the words carry none of those), generic labels dropped and a leading
// "Subject:" / "Operation:" tag stripped, at most three, joined with a
// middle dot; the headline label when nothing remains.
const TERM_KINDS_PRIMARY = ['ACTOR', 'OPERATION', 'OBJECT'];
const TERM_KINDS_FALLBACK = ['STANDARD', 'CONDITION', 'EXCEPTION', 'TRIGGER', 'QUALIFIER', 'TERM', 'DEFINED_TERM', 'PERIOD', 'DATE', 'LIST', 'LITANY'];
const GENERIC_TERM_LABEL = /^(subject|object|actor|operation|shall be|is|are|naming convention|defined term|section (heading|subject))$/i;
const TERM_LABEL_TAG = /^(subject|object|actor|operation|status|timing|form|version taken|replacement|carve-out|governing limb)(\s*[^:]*)?:\s*/i;
function cleanTermLabel(label) {
  const cleaned = String(label || '').replace(TERM_LABEL_TAG, '').trim();
  return cleaned && !GENERIC_TERM_LABEL.test(cleaned) ? cleaned : '';
}
// Ben, 2026-09-14, after the Summary column was named: the Term stays the
// short label-built term; the extractor's headline.summary is the row's
// Summary text (provisionSummary), the drafted words shown only when a
// fact has no summary (older generations).
function provisionSummary(fact, components) {
  const summary = fact?.headline?.summary;
  if (typeof summary === 'string' && summary.trim()) return summary.trim();
  return joinInSourceOrder(components);
}

function provisionTerm(fact, components) {
  const pool = (components || []).filter((component) => component && component.label);
  const pick = (kinds) => kinds.flatMap((kind) => pool.filter((component) => component.kind === kind).map((component) => cleanTermLabel(component.label))).filter(Boolean);
  let labels = pick(TERM_KINDS_PRIMARY);
  if (!labels.length) labels = pick(TERM_KINDS_FALLBACK);
  const unique = [...new Set(labels)].slice(0, 3);
  if (unique.length) return unique.join(' · ');
  return fact?.headline?.label || fact?.subtype_key || '';
}

function groupOtherProvisions(facts) {
  const groups = new Map();
  for (const fact of facts || []) {
    if (!fact) continue;
    const own = ownComponents(fact);
    const spanId = own[0]?.source_span_id || null;
    const key = `${fact.subtype_key || ''}|${spanId || `fact:${factIdOf(fact)}`}`;
    if (!groups.has(key)) groups.set(key, { subtype_key: fact.subtype_key || null, span_id: spanId, facts: [] });
    groups.get(key).facts.push(fact);
  }
  const out = [];
  for (const group of groups.values()) {
    const members = group.facts.map((fact) => ({ fact, own: ownComponents(fact), summary: summaryComponents(fact) }));
    members.sort((left, right) => (left.own[0]?.start_byte ?? Infinity) - (right.own[0]?.start_byte ?? Infinity));
    if (members.length === 1) {
      const [only] = members;
      const text = provisionSummary(only.fact, only.summary);
      const term = provisionTerm(only.fact, only.own);
      out.push({ subtype_key: group.subtype_key, span_id: group.span_id, common_text: text, term, branches: [{ fact_id: factIdOf(only.fact), section_reference: only.fact.section_reference || null, text, term }] });
      continue;
    }
    // Words common to every fact of the group: a component text present in
    // each member's own words. Taken from the first member for position.
    const textsOf = (components) => new Set(components.map((component) => component.text.trim()));
    const shared = members.slice(1).reduce((common, member) => {
      const texts = textsOf(member.own);
      return common.filter((component) => texts.has(component.text.trim()));
    }, members[0].own);
    const commonTexts = textsOf(shared);
    const commonCore = shared.filter((component) => members[0].summary.includes(component));
    const commonText = joinInSourceOrder(commonCore.length ? commonCore : shared);
    // Branches in source order of their own (non-common) words: the 'or'
    // clauses come out as the sentence lists them.
    const ownStart = (member) => {
      const rest = member.own.filter((component) => !commonTexts.has(component.text.trim()));
      return (rest[0] || member.own[0])?.start_byte ?? Infinity;
    };
    members.sort((left, right) => ownStart(left) - ownStart(right));
    const branches = members.map((member) => {
      const core = member.summary.filter((component) => !commonTexts.has(component.text.trim()));
      const rest = member.own.filter((component) => !commonTexts.has(component.text.trim()));
      return { fact_id: factIdOf(member.fact), section_reference: member.fact.section_reference || null, text: provisionSummary(member.fact, core.length ? core : rest), term: provisionTerm(member.fact, rest) };
    });
    out.push({ subtype_key: group.subtype_key, span_id: group.span_id, common_text: commonText, term: provisionTerm(members[0].fact, shared), branches });
  }
  return out;
}

function findComponentsByKind(fact, kind) {
  return walkComponents(fact.components).filter((component) => component.kind === kind);
}

function shortenText(text, maxLength = 60) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

// A fact's identifier: `fact_id` on FACT_COMPONENTS/V2 fixtures and the
// fact-conclusions interface, `review_item_id` on a real published fact
// (lib/product/review-state.js compileReviewSummary). Both are accepted so
// this module works against either shape.
function factIdOf(fact) {
  return fact?.fact_id || fact?.review_item_id || null;
}

// Row subject: the fact's conclusions row_label when present, otherwise the
// ACTOR component's label/text, otherwise a shortened form of the fact's own
// (OWN-origin) text, otherwise the headline label.
function subjectForFact(fact) {
  const rowLabel = fact?.conclusions?.row_label;
  if (typeof rowLabel === 'string' && rowLabel.trim()) return rowLabel.trim();
  const actor = findComponentsByKind(fact, 'ACTOR')[0];
  if (actor) return actor.label || shortenText(actor.text);
  const ownComponent = walkComponents(fact.components).find((component) => component.origin === 'OWN' && component.text);
  if (ownComponent) return shortenText(ownComponent.text);
  return shortenText(fact.headline?.label || factIdOf(fact) || '');
}

function isCoverageOnly(fact, legalSchema) {
  if (fact.coverage_only) return true;
  const family = (legalSchema?.families || []).find((entry) => entry.family_key === fact.family_key);
  return !!family?.coverage_only;
}

function sectionCandidateTables(tableShapes) {
  const out = [];
  for (const section of tableShapes.sections || []) {
    if (section.excluded_from_fact_tables) continue;
    for (const table of section.tables || []) out.push({ section, table });
  }
  return out;
}

function candidateTablesForFamily(tableShapes, familyKey) {
  return sectionCandidateTables(tableShapes).filter(
    (candidate) => (candidate.section.v2_family_keys || []).some((entry) => entry.key === familyKey),
  );
}

function findTableByKey(tableShapes, tableKey) {
  return sectionCandidateTables(tableShapes).find((candidate) => candidate.table.table_key === tableKey) || null;
}

// Fallback table resolution, used only while lib/product/fact-conclusions.js
// (or an explicit fact.conclusions.table_key) is unavailable: prefer a
// 'fixed list' table among the fact's family whose fixed_row_labels contains
// this fact's computed subject (e.g. a TERMINATION/MUTUAL_CONSENT fact whose
// subject is literally "Mutual consent"); otherwise the family's first
// 'one per subject' table; otherwise the family's first table in shape order.
function fallbackTableForFamily(tableShapes, familyKey, subject) {
  // A family's own section (confidence high) comes before a section it only
  // lends a row to (MATERIAL_CONTRACTS on the representations table, work
  // package 6): a material contract fact with no readout and no rule is
  // listed under Material Contracts, not under the representations.
  const confidenceOf = (candidate) => ((candidate.section.v2_family_keys || []).find((entry) => entry.key === familyKey) || {}).confidence;
  const candidates = [...candidateTablesForFamily(tableShapes, familyKey)]
    .sort((a, b) => (confidenceOf(a) === 'high' ? 0 : 1) - (confidenceOf(b) === 'high' ? 0 : 1));
  if (candidates.length === 0) return null;
  const subjectLower = String(subject || '').trim().toLowerCase();
  if (subjectLower) {
    const fixedMatch = candidates.find((candidate) => (candidate.table.fixed_row_labels || [])
      .some((label) => String(label).trim().toLowerCase() === subjectLower));
    if (fixedMatch) return fixedMatch;
  }
  const onePerSubject = candidates.find((candidate) => candidate.table.rows_are === 'one per subject');
  return onePerSubject || candidates[0];
}

// A fact of a footer subtype with no readout of its own (the MAE
// underlying-cause proviso, Metsera generation 7, 9.03) belongs under the
// table whose footer takes its subtype; between the two parties' carve-out
// tables, the fact's own words name the party.
function footerTableForFact(fact, tableShapes) {
  const candidates = candidateTablesForFamily(tableShapes, fact.family_key)
    .filter((candidate) => footerTakesFact(candidate.table, fact));
  if (candidates.length <= 1) return candidates[0] || null;
  const words = `${fact.statement || ''} ${factOwnText(fact)}`;
  const party = /\bParent Material Adverse Effect\b/.test(words) ? 'parent' : 'company';
  return candidates.find((candidate) => String(candidate.table.table_key).includes(party)) || candidates[0];
}

// Work package 7 (d): a table may take facts of named subtypes whose words
// match a pattern as its Other provisions, never as rows (the sentence that
// an Adverse Recommendation Change does not withdraw the board's approval
// for the takeover statutes, under the change-of-recommendation table).
function otherProvisionsTakesFact(table, fact) {
  const spec = table?.other_provisions_from_subtype;
  if (!spec || !Array.isArray(spec.subtype_keys) || !spec.subtype_keys.includes(fact?.subtype_key)) return false;
  let pattern;
  try { pattern = new RegExp(spec.when, 'i'); } catch { return false; }
  return pattern.test(`${fact.statement || ''} ${fact.headline?.summary || ''} ${factOwnText(fact)}`);
}

function otherProvisionsTableForFact(fact, tableShapes) {
  if (hasReadout(fact)) return null;
  return candidateTablesForFamily(tableShapes, fact.family_key).find((candidate) => otherProvisionsTakesFact(candidate.table, fact)) || null;
}

function resolveTableForFact(fact, tableShapes) {
  // A closing-condition fact the page rule has given a side (work package
  // 30, plan finding (243)) resolves to that side's table even when no
  // readout row could be built, so its evidence sits with its side.
  const sideKey = fact?.conditions_side ? CONDITIONS_SIDE_TABLE[fact.conditions_side] : null;
  if (sideKey) {
    const sideTable = findTableByKey(tableShapes, sideKey);
    if (sideTable) return sideTable;
  }
  const explicitKey = fact?.conclusions?.table_key;
  if (explicitKey) {
    const found = findTableByKey(tableShapes, explicitKey);
    if (found) return found;
  }
  const footerTable = footerTableForFact(fact, tableShapes);
  if (footerTable) return footerTable;
  const otherProvisionsTable = otherProvisionsTableForFact(fact, tableShapes);
  if (otherProvisionsTable) return otherProvisionsTable;
  if (factConclusions && typeof factConclusions.tableForFact === 'function') {
    const resolved = factConclusions.tableForFact(fact, tableShapes);
    if (resolved) {
      if (resolved.table_key) return findTableByKey(tableShapes, resolved.table_key) || resolved;
      if (resolved.table) return resolved;
    }
  }
  return fallbackTableForFamily(tableShapes, fact.family_key, subjectForFact(fact));
}

// ---------------------------------------------------------------------------
// Work package 30 (plan finding (243), Ben 2026-10-23). The closing
// conditions are two tables by the side whose obligation is conditioned:
// "Conditions to the Company's Obligations" and "Conditions to Parent's
// Obligations". A condition fact is routed by the side named in its own
// words, never by its section number and never by its actor: for a 6.2 fact
// the actor is Parent (the party whose representations the condition tests)
// while the obligation conditioned is the Company's.
//
// The words that name the side are the condition's own CONDITION
// components, falling back to its chapeau/qualifier components:
//   "The obligation of the Company to effect the Closing is further subject
//    to the satisfaction (or waiver by the Company to the extent permitted
//    by applicable Law"  -> the Company's obligations;
//   "further subject to the satisfaction (or waiver by Parent, on its own
//    behalf and on behalf of Merger Sub, to the extent permitted by
//    applicable Law"  -> Parent's obligations.
// A fact whose words name both sides or neither side keeps the table its
// readout names; the rule does not guess. A fact already on the mutual
// conditions table is left there whatever its chapeau says (that chapeau's
// "waiver by Parent ... and the Company" is a joint waiver).
//
// The 5.9 negative is the one exception the decision names: its own words
// ("... is not a condition precedent to any of Parent's or Merger Sub's
// obligations to consummate the Closing") place it on Parent's table as
// "Filing, notice or consent — expressly not a condition precedent", never
// under a catch-all. The catch-all, where a shape needs one, says what it
// is ("Other conditions (not otherwise classified)").
const CONDITIONS_MUTUAL_TABLE_KEY = 'conditions-table';
const CONDITIONS_SIDE_TABLE = Object.freeze({ company: 'conditions-s-table', parent: 'conditions-b-table' });
const CONDITIONS_PARTY_TABLE_KEYS = new Set(Object.values(CONDITIONS_SIDE_TABLE));
const CONDITIONS_NEGATIVE_ROW = 'Filing, notice or consent — expressly not a condition precedent';
const COMPANY_CONDITION_WORDS = /\b(?:obligations? of|waiver by) (?:the )?Company\b|\bthe Company'?s obligations?\b/i;
const PARENT_CONDITION_WORDS = /\b(?:obligations? of|waiver by) (?:the )?Parent\b|\bParent'?s obligations?\b/i;

function conditionSideWords(fact) {
  const components = walkComponents(fact.components).filter((component) => component && component.text);
  const conditions = components.filter((component) => component.kind === 'CONDITION');
  if (conditions.length) return conditions.map((component) => component.text).join(' ');
  // The fallback reads the chapeau/qualifier only for a fact the page
  // already holds on a party table; a mutual-table fact's chapeau names a
  // joint waiver ("... waiver by Parent ... and the Company") and is not a
  // side.
  if (!CONDITIONS_PARTY_TABLE_KEYS.has(fact?.conclusions?.table_key)) return '';
  return components
    .filter((component) => component.kind === 'CHAPEAU' || component.kind === 'QUALIFIER' || component.origin === 'CHAPEAU')
    .map((component) => component.text)
    .join(' ');
}

function conditionsSideForFact(fact) {
  if (!fact || fact.family_key !== 'CLOSING_CONDITIONS') return null;
  if (fact.conclusions?.table_key === CONDITIONS_MUTUAL_TABLE_KEY) return null;
  const words = conditionSideWords(fact);
  if (!words) return null;
  const company = COMPANY_CONDITION_WORDS.test(words);
  const parent = PARENT_CONDITION_WORDS.test(words);
  // Both sides named, or neither: the words do not name one side.
  if (company === parent) return null;
  return company ? 'company' : 'parent';
}

// A negative condition-precedent fact names whose obligations are not
// conditioned in its own sentence ("not a condition precedent to any of
// Parent's or Merger Sub's obligations"); the side is not read from its
// actor. It takes its own row on that side's table.
function conditionsNegativeSideForFact(fact) {
  if (!fact || fact.family_key !== 'CLOSING_CONDITIONS') return null;
  if (fact.conclusions?.table_key === CONDITIONS_MUTUAL_TABLE_KEY) return null;
  const words = [fact.statement, fact.headline?.summary, ...walkComponents(fact.components).map((component) => component?.text)]
    .filter((item) => typeof item === 'string').join(' ');
  if (!/\bnot a condition precedent\b/i.test(words)) return null;
  const parent = /\b(?:Parent|Merger Sub)\b/i.test(words);
  const company = /\bCompany\b/i.test(words);
  if (parent === company) return null;
  return parent ? 'parent' : 'company';
}

// The page rule itself: a copy of the fact with the side's table (and, for
// the negative, its own row), or a copy carrying the side for the default
// readout that follows, or null when the rule decides nothing.
function conditionsPageRule(fact) {
  const negative = conditionsNegativeSideForFact(fact);
  const side = negative || conditionsSideForFact(fact);
  if (!side) return null;
  const tableKey = CONDITIONS_SIDE_TABLE[side];
  if (hasReadout(fact)) {
    return {
      ...fact,
      conclusions: { ...fact.conclusions, table_key: tableKey, ...(negative ? { row_label: CONDITIONS_NEGATIVE_ROW } : {}) },
      page_rule: 'conditions_by_side',
      conditions_side: side,
    };
  }
  return { ...fact, conditions_side: side, ...(negative ? { conditions_row: CONDITIONS_NEGATIVE_ROW } : {}) };
}

function dashCell(columnId) {
  return { column_id: columnId, kind: 'dash', label: null, tone: null, component_ids: [], fact_ids: [] };
}

// Normalizes conclusions cell data -- either an object keyed by column_id or
// an array of { column_id, ... } entries -- into a column_id -> cell map,
// filling in fact_ids when the producer omitted them.
function normalizeConclusionCells(rawCells, fact) {
  const entries = Array.isArray(rawCells)
    ? rawCells.map((cell) => [cell.column_id, cell])
    : Object.entries(rawCells || {}).map(([columnId, cell]) => [columnId, { ...cell, column_id: columnId }]);
  const byColumn = new Map();
  for (const [columnId, cell] of entries) {
    if (!cell) continue;
    byColumn.set(columnId, {
      column_id: columnId,
      kind: cell.kind || 'pill',
      label: cell.label ?? null,
      tone: cell.tone ?? 'neutral',
      component_ids: cell.component_ids || [],
      fact_ids: cell.fact_ids && cell.fact_ids.length ? cell.fact_ids : [factIdOf(fact)],
    });
  }
  return byColumn;
}

const TONE_BY_RENDER = Object.freeze({ vocabulary: 'standard', value: 'value', verbatim: 'neutral', term: 'term', boolean: 'condition' });

// Contract-shaped cells (fact-conclusions.v1.json: { column_id, code | value |
// text | present, component_ids }) become display cells: a vocabulary code
// shows its vocabulary label, a value its formatted number, verbatim/term
// text its words, a boolean "Present"; every cell keeps its component_ids so
// the evidence sidebar can open on the cited words. (Metsera V9, 2026-09-13:
// the first render passed the module's display rows through unmapped and
// every coded cell came out as a blank pill.)
const CONTINUED_SERVICE = /\bcontinued\s+(service|employment)\b/i;
function hasContinuedServiceCondition(fact) {
  return walkComponents(fact.components).some((component) => CONTINUED_SERVICE.test(String(component.text || '')));
}

function draftedText(fact) {
  const summary = fact?.headline?.summary;
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null;
}

// Ben, 2026-09-14: "can we kill 'as drafted' columns throughout". A detail
// (fact_text) column that no row of the table fills with a summary is
// removed with its cells; the table keeps the coded columns only.
// Ben, 2026-10-17 (plan finding (42)), on the no-shop notice table: "why do
// we have a summary column here? Also 'period' as a column is wasteful as
// it only applies to one provision? Consider that point generally?" and on
// its pills: "I know the pills are likely helpful for background comparison
// work etc but do we need to show them here? Consider this more generally
// on the UI pills etc". One rule for every table, applied when the table is
// built: (a) a value or vocabulary column filled on only one line of a
// table with several rows folds into that line as a trailing detail after
// its subject ("Notice period · 4 business days") instead of a column; (b)
// a vocabulary pill whose label the line's summary already states is not
// shown beside the summary (the code stays on the cell, under
// stated_in_summary, for comparison); (c) the summary column stays the
// one-line reading. A column that (a) or (b) leaves with no filled cell is
// dropped. docs/core/CODEBASE-GUIDE.md, table section.
function normaliseWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9%$. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function pillStatedInSummary(label, summary) {
  const pill = normaliseWords(label);
  if (pill.length < 4) return false;
  return ` ${normaliseWords(summary)} `.includes(` ${pill} `);
}

function applyColumnRules(table, shapeColumns) {
  const rows = table.rows || [];
  if (table.layout !== 'rows' || !table.term_column || rows.length === 0) return table;
  const renderOf = new Map((shapeColumns || []).map((column) => [column.column_id, column.render]));
  const summaryColumns = new Set((table.columns || []).filter((column) => column.display === 'fact_text').map((column) => column.column_id));
  const lines = (row) => [row, ...(row.sub_rows || [])];
  const filled = (cell) => cell && cell.kind !== 'dash' && (Array.isArray(cell.values) ? cell.values.length > 0 : !!cell.label);

  // (b) pills the summary states.
  const withPills = rows.map((row) => {
    const mapLine = (line) => {
      const summary = (line.cells || []).filter((cell) => summaryColumns.has(cell.column_id) && cell.kind === 'text' && cell.label).map((cell) => cell.label).join(' ');
      if (!summary) return line;
      const cells = (line.cells || []).map((cell) => {
        if (renderOf.get(cell.column_id) !== 'vocabulary' || !filled(cell)) return cell;
        const values = Array.isArray(cell.values) && cell.values.length > 1 ? cell.values : [cell];
        const stated = values.filter((value) => value.kind === 'pill' && pillStatedInSummary(value.label, summary));
        if (stated.length === 0) return cell;
        const kept = values.filter((value) => !stated.includes(value));
        const codes = stated.map((value) => value.code || value.label);
        if (kept.length === 0) return { ...dashCell(cell.column_id), stated_in_summary: codes };
        if (kept.length === 1 && values.length > 1) return { ...kept[0], column_id: cell.column_id, stated_in_summary: codes };
        return kept.length === values.length ? cell : { ...cell, values: kept, stated_in_summary: codes };
      });
      return { ...line, cells };
    };
    const mapped = mapLine(row);
    return row.sub_rows ? { ...mapped, sub_rows: row.sub_rows.map(mapLine) } : mapped;
  });

  // (a) a value or vocabulary column filled on one line of a table with
  // several rows (an absent row, "None", is not a row for this count).
  const fold = new Set();
  const allLines = withPills.flatMap(lines);
  const cellIn = (line, columnId) => (line.cells || []).find((cell) => cell.column_id === columnId);
  if (withPills.filter((row) => !row.absent).length >= 2) {
    for (const column of table.columns || []) {
      if (!['value', 'vocabulary'].includes(renderOf.get(column.column_id))) continue;
      const filledLines = allLines.filter((line) => filled(cellIn(line, column.column_id)));
      if (filledLines.length === 1) fold.add(column.column_id);
    }
  }
  // A column that (b) emptied (filled before, no filled cell after).
  const emptiedBy = (columnId) => rows.flatMap(lines).some((line) => filled(cellIn(line, columnId))) && !allLines.some((line) => filled(cellIn(line, columnId)));
  const empty = new Set((table.columns || []).filter((column) => !summaryColumns.has(column.column_id) && emptiedBy(column.column_id)).map((column) => column.column_id));
  if (fold.size === 0 && empty.size === 0) return { ...table, rows: withPills };
  const headerOf = new Map((table.columns || []).map((column) => [column.column_id, column.header]));
  // The detail names its column unless the line's subject already does
  // ("Notice period · 4 business days"; "Common Stock · Authorised 800,000,000").
  const detailLabel = (line, cell) => {
    const header = headerOf.get(cell.column_id) || '';
    const label = Array.isArray(cell.values) && cell.values.length > 1 ? cell.values.map((value) => value.label).join(', ') : cell.label;
    const subjectNames = header && String(line.subject || '').toLowerCase().includes(header.toLowerCase());
    return subjectNames || !header ? label : `${header} ${label}`;
  };
  const foldLine = (line) => {
    const details = (line.cells || []).filter((cell) => fold.has(cell.column_id) && filled(cell)).map((cell) => ({ column_id: cell.column_id, header: headerOf.get(cell.column_id) || null, label: detailLabel(line, cell), cell }));
    const cells = (line.cells || []).filter((cell) => !fold.has(cell.column_id) && !empty.has(cell.column_id));
    return { ...line, cells, ...(details.length ? { trailing_details: [...(line.trailing_details || []), ...details] } : {}) };
  };
  return {
    ...table,
    columns: (table.columns || []).filter((column) => !fold.has(column.column_id) && !empty.has(column.column_id)),
    rows: withPills.map((row) => ({ ...foldLine(row), ...(row.sub_rows ? { sub_rows: row.sub_rows.map(foldLine) } : {}) })),
  };
}

// Work package 12 (plan finding (76)). Ben, 2026-10-17, on the no-shop
// notice table: "odd under ongoing updates to have required within a
// stated period and required promptly. Also weird to have the 48 hours
// there. I know the pills are likely helpful for background comparison
// work etc but do we need to show them here? Consider this more generally
// on the UI pills etc." On the provisions page the coded pills are
// secondary: a coded cell shows the words it was read from first, and the
// code pills come up behind one page-wide "Show codes" control. The pills
// stay in the data (and on Query). This constant is the page's default;
// Ben decides it.
const SHOW_CODES_BY_DEFAULT = false;

// The words a coded cell was read from: the cited components' text in the
// order the cell names them, page footers hidden, cut to one short line.
const WORDS_MAX_LENGTH = 90;

function attachWords(table, componentTextById) {
  if (!componentTextById || componentTextById.size === 0) return table;
  const wordsOf = (cell) => {
    const ids = Array.isArray(cell?.component_ids) ? cell.component_ids : [];
    const text = ids.map((id) => componentTextById.get(id)).filter(Boolean).map((item) => item.trim()).join(' ');
    return text ? shortenText(hidePageFooters(text), WORDS_MAX_LENGTH) : null;
  };
  const withWords = (cell) => {
    if (!cell || cell.kind !== 'pill' && !(Array.isArray(cell.values) && cell.values.length > 1)) return cell;
    if (Array.isArray(cell.values) && cell.values.length > 1) {
      const values = cell.values.map((value) => (value.kind === 'pill' && !value.words && wordsOf(value) ? { ...value, words: wordsOf(value) } : value));
      return values.every((value, index) => value === cell.values[index]) ? cell : { ...cell, values };
    }
    const words = wordsOf(cell);
    return words && !cell.words ? { ...cell, words } : cell;
  };
  const mapLine = (line) => ({
    ...line,
    ...(Array.isArray(line.cells) ? { cells: line.cells.map(withWords) } : {}),
    ...(Array.isArray(line.trailing_details) ? { trailing_details: line.trailing_details.map((detail) => ({ ...detail, cell: withWords(detail.cell) })) } : {}),
    ...(Array.isArray(line.sub_rows) ? { sub_rows: line.sub_rows.map((sub) => ({ ...sub, cells: (sub.cells || []).map(withWords), ...(Array.isArray(sub.trailing_details) ? { trailing_details: sub.trailing_details.map((detail) => ({ ...detail, cell: withWords(detail.cell) })) } : {}) })) } : {}),
  });
  return { ...table, rows: (table.rows || []).map(mapLine) };
}

// Ben, 2026-10-17: "why do we have a summary column here? Also 'period' as
// a column is wasteful as it only applies to one provision? Consider that
// point generally?" The general rule, after the fold of (a) and the pill
// rule of (b): a column with no filled cell on any line of a table in this
// run's output is not rendered, whatever it renders; an as-drafted
// (fact_text) column whose every filled cell is the line's own label, or
// is empty, is not rendered either. The columns taken out are named on
// the table (hidden_columns) so a reader of the view can see what this
// run did not fill.
function pruneEmptyColumns(table) {
  if (table.layout !== 'rows' || !Array.isArray(table.columns) || table.columns.length === 0) return table;
  const rows = table.rows || [];
  const lines = rows.flatMap((row) => [row, ...(row.sub_rows || [])]);
  const filled = (cell) => cell && cell.kind !== 'dash' && (Array.isArray(cell.values) ? cell.values.length > 0 : !!cell.label);
  const normalise = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hidden = [];
  for (const column of table.columns) {
    const cells = lines.map((line) => [line, (line.cells || []).find((cell) => cell.column_id === column.column_id)]).filter(([, cell]) => filled(cell));
    if (cells.length === 0) { hidden.push({ column_id: column.column_id, header: column.header, reason: 'empty' }); continue; }
    if (column.display === 'fact_text' && cells.every(([line, cell]) => normalise(cell.label) === normalise(line.subject))) {
      hidden.push({ column_id: column.column_id, header: column.header, reason: 'summary_is_label' });
    }
  }
  if (hidden.length === 0) return table;
  const drop = new Set(hidden.map((item) => item.column_id));
  const strip = (line) => ({ ...line, cells: (line.cells || []).filter((cell) => !drop.has(cell.column_id)) });
  return {
    ...table,
    columns: table.columns.filter((column) => !drop.has(column.column_id)),
    rows: rows.map((row) => ({ ...strip(row), ...(row.sub_rows ? { sub_rows: row.sub_rows.map(strip) } : {}) })),
    hidden_columns: [...(table.hidden_columns || []), ...hidden],
  };
}

function pruneDraftedColumns(table) {
  const drafted = (table.columns || []).filter((column) => column.display === 'fact_text').map((column) => column.column_id);
  if (!drafted.length) return table;
  const filled = new Set();
  const rows = table.rows || [];
  for (const row of rows) {
    for (const line of [row, ...(row.sub_rows || [])]) {
      for (const cell of line.cells || []) {
        if (drafted.includes(cell.column_id) && (cell.values || [cell]).some((value) => value.label)) filled.add(cell.column_id);
      }
    }
  }
  const drop = new Set(drafted.filter((id) => !filled.has(id)));
  if (!drop.size) return table;
  const strip = (line) => ({ ...line, cells: (line.cells || []).filter((cell) => !drop.has(cell.column_id)), ...(line.sub_rows ? { sub_rows: line.sub_rows.map((sub) => ({ ...sub, cells: (sub.cells || []).filter((cell) => !drop.has(cell.column_id)) })) } : {}) });
  return { ...table, columns: table.columns.filter((column) => !drop.has(column.column_id)), rows: rows.map(strip) };
}

function contractCellsForFact(fact, table, tableShapes) {
  const byColumn = new Map();
  const columnsById = new Map((table.columns || []).map((column) => [column.column_id, column]));
  const componentsById = new Map(walkComponents(fact.components).map((component) => [component.component_id, component]));
  for (const cell of fact.conclusions.cells) {
    const column = columnsById.get(cell?.column_id);
    if (!column) continue;
    let label = null;
    let kind = 'pill';
    let linkSection = null;
    let displayCode = null;
    let shownValue = null;
    let reparsed = false;
    if (column.render === 'vocabulary') {
      const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function'
        ? factConclusions.columnVocabulary(column, tableShapes) : [];
      let code = cell.code;
      // Ben, 2026-09-14, on an unvested option sub-row: "While fully vested
      // is normally right I know why this is coded as such but it should
      // say Fully Vested (Conditional Upon Service) or similar". A
      // "Fully vested (accelerated)" cell whose fact carries a continued
      // service or employment condition reads as conditional upon service;
      // generation 7 codes it directly, stored generations read the same.
      if (code === 'FULLY_VESTED_ACCELERATED' && hasContinuedServiceCondition(fact)
        && vocabulary.some((item) => item.code === 'FULLY_VESTED_CONDITIONAL_UPON_SERVICE')) {
        code = 'FULLY_VESTED_CONDITIONAL_UPON_SERVICE';
      }
      const entry = vocabulary.find((item) => item.code === code);
      displayCode = code;
      label = entry ? entry.label : code;
      // Work package 18 (f) (Ben: "if the shareholders have to do something,
      // okay for them to be an obligor"): the other-party code shows the
      // party's own words, the cited ACTOR else the fact's own.
      if (column.other_party_code && code === column.other_party_code) {
        const citedActor = (Array.isArray(cell.component_ids) ? cell.component_ids : []).map((id) => componentsById.get(id)).find((component) => component && component.text);
        const words = otherPartyWords(fact, citedActor);
        if (words) label = words;
      }
      if (entry?.links_to_section) linkSection = entry.links_to_section;
    } else if (column.render === 'value') {
      kind = 'value';
      // Work package 8 (manager, 2026-10-18): the cited words are the truth,
      // the stored number a reading of them. A stored value cell whose
      // cited component parses, under the current parser, to a different
      // value shows the parsed value and is marked reparsed (generation
      // 8's subsequent match period stored 4 business days from "the
      // references to four (4) business days will be deemed two (2)
      // business days"); a cell whose cited words do not parse keeps the
      // stored value.
      const citedForValue = (Array.isArray(cell.component_ids) ? cell.component_ids : []).map((id) => componentsById.get(id)).filter((component) => component && component.text);
      let parsedValue = null;
      for (const component of citedForValue) {
        for (const valueKind of [...new Set([column.value_kind, component.kind].filter(Boolean))]) {
          const parsed = factConclusions && typeof factConclusions.parseComponentValue === 'function' ? factConclusions.parseComponentValue(valueKind, component.text) : null;
          if (parsed) { parsedValue = { canonical: parsed.canonical, unit: parsed.unit }; break; }
        }
        if (parsedValue) break;
      }
      const stored = cell.value && cell.value.canonical !== undefined ? cell.value : null;
      if (parsedValue && (!stored || parsedValue.canonical !== stored.canonical || parsedValue.unit !== stored.unit)) {
        shownValue = parsedValue;
        reparsed = true;
      } else {
        shownValue = stored;
      }
      label = factConclusions && typeof factConclusions.formatValue === 'function'
        ? factConclusions.formatValue(shownValue, column.value_kind) : null;
      if (!label && shownValue && shownValue.canonical !== undefined) label = String(shownValue.canonical);
    } else if (column.render === 'boolean') {
      if (cell.present !== true) continue;
      label = 'Present';
    } else if (column.display === 'fact_text') {
      // Ben, 2026-09-14: "can we kill 'as drafted' columns throughout - the
      // whole point is to only summarize the key parts!! particularly
      // important in the superior proposal sections but also everywhere.
      // Also same comment on 'provision' columns". A detail column shows
      // the fact's one-line summary (headline.summary, written by the
      // extractor from generation 7) and nothing else; the words stay
      // behind the row in the sidebar. A column with no summary in any
      // row is dropped from the table (pruneDraftedColumns).
      kind = 'text';
      label = draftedText(fact);
    } else if (column.display === 'party') {
      // A party column names the entity the fact is about (its own ACTOR
      // words), with the cited term after it: "the Company (the “Surviving
      // Corporation”)" rather than the bare defined term (Ben, 2026-09-14:
      // "needs to say which entity is the surviving entity").
      kind = 'text';
      // The extractor is now asked to cite the entity's own words with the
      // term on a party column (the shape's guidance reaches it; Ben,
      // 2026-09-14: "do you have an agent looking at all of our tweaks and
      // seeing if they should be made systematically/throughout the code
      // base back to extraction? I don't want to make surface level/one
      // deal level fixes"), so the entity is the cited ACTOR or OBJECT
      // component when there is one, else the fact's own ACTOR (stored
      // generations, whose cell cites the term alone); the term is the
      // cited TERM or DEFINED_TERM component, else the cell text.
      const cited = (Array.isArray(cell.component_ids) ? cell.component_ids : []).map((id) => componentsById.get(id)).filter((component) => component && component.text);
      const text = typeof cell.text === 'string' ? cell.text.trim() : '';
      const entityComponent = cited.find((component) => component.kind === 'ACTOR' || component.kind === 'OBJECT')
        || (fact.components || []).find((component) => component && component.kind === 'ACTOR' && (component.origin === 'OWN' || !component.origin) && component.text);
      const termComponent = cited.find((component) => component.kind === 'TERM' || component.kind === 'DEFINED_TERM');
      const entity = entityComponent ? entityComponent.text.trim() : '';
      const term = termComponent ? termComponent.text.trim() : text;
      label = entity ? (term && term !== entity ? `${entity} (${term})` : entity) : (text || null);
    } else if (column.display === 'resolved_reference') {
      // A reference column shows what the cross-references resolve to (the
      // representation's title), never the bare section number.
      kind = 'text';
      const cited = (Array.isArray(cell.component_ids) ? cell.component_ids : []).map((id) => componentsById.get(id)).filter(Boolean);
      const resolved = cited.filter((component) => component.kind === 'CROSS_REFERENCE')
        .map((component) => (component.resolves_to?.text ? `${component.text} (${component.resolves_to.text})` : component.text));
      label = resolved.length ? resolved.join('; ') : (typeof cell.text === 'string' ? cell.text : null);
    } else {
      kind = 'text';
      label = typeof cell.text === 'string' ? cell.text : null;
    }
    if (!label) continue;
    const display = {
      column_id: column.column_id,
      kind,
      label,
      ...(column.render === 'vocabulary' ? { code: displayCode ?? cell.code } : {}),
      ...(column.render === 'value' && shownValue ? { value: shownValue } : {}),
      ...(reparsed ? { reparsed: true, stored_value: cell.value } : {}),
      ...(linkSection ? { link_section: linkSection } : {}),
      tone: TONE_BY_RENDER[column.render] || 'neutral',
      component_ids: Array.isArray(cell.component_ids) ? cell.component_ids : [],
      fact_ids: [factIdOf(fact)],
    };
    // Two codes on one vocabulary column (knowledge and materiality
    // qualifiers on one representation) are two readings of one cell.
    const existing = byColumn.get(column.column_id);
    byColumn.set(column.column_id, existing && column.render === 'vocabulary' ? mergeCellInto(existing, display) : display);
  }
  return byColumn;
}

function conclusionCellsForFact(fact, table, tableShapes) {
  // Contract shape (fact-conclusions.v1.json): cells is an array of
  // { column_id, code | value | text | present, component_ids }, mapped to
  // display cells here. A cells object keyed by column id is an already
  // rendered display shape and is normalised directly.
  if (Array.isArray(fact.conclusions?.cells)) return contractCellsForFact(fact, table, tableShapes);
  if (fact.conclusions && fact.conclusions.cells && !Array.isArray(fact.conclusions.cells)) {
    return normalizeConclusionCells(fact.conclusions.cells, fact);
  }
  return null;
}

// Fallback per-column cell: the first component matching one of the
// column's fill_from kinds, as a pill labelled with the component's label
// (falling back to a shortened form of its text) and carrying the
// component's own text for hover/evidence display.
function fallbackCellForColumn(fact, column) {
  for (const kind of column.fill_from || []) {
    const component = findComponentsByKind(fact, kind)[0];
    if (component) {
      return {
        column_id: column.column_id,
        kind: 'pill',
        label: component.label || shortenText(component.text),
        tone: 'neutral',
        component_ids: [component.component_id],
        fact_ids: [factIdOf(fact)],
      };
    }
  }
  return dashCell(column.column_id);
}

// A value column the extractor left without a cell is filled from the
// fact's own component of one of the column's fill_from kinds when its
// words parse as the column's value (Metsera generation 6, 3.08: the
// absence-of-changes fact cites "Since January 1, 2025" as a DATE and the
// Lookback cell was omitted). The cell carries that component as evidence.
function derivedValueCell(fact, column, table = null) {
  if (column.render !== 'value' || !column.value_kind) return null;
  if (!factConclusions || typeof factConclusions.parseComponentValue !== 'function') return null;
  // A component the fact's readout already reads into another value column
  // of the same kind is not read again (generation 7, 8.01: the outside
  // date's one DATE filled the extension column and the extension's the
  // outside date column; the same rule as completeOmittedValueCells).
  const alreadyRead = new Set();
  for (const cell of Array.isArray(fact.conclusions?.cells) ? fact.conclusions.cells : []) {
    const other = (table?.columns || []).find((candidate) => candidate.column_id === cell?.column_id);
    if (!other || other.render !== 'value' || other.value_kind !== column.value_kind || other.column_id === column.column_id) continue;
    for (const id of Array.isArray(cell.component_ids) ? cell.component_ids : []) alreadyRead.add(id);
  }
  // A column filled only by named subtypes (the capitalization table's
  // authorised, issued and reserved counts) is never completed from
  // another subtype's number (Ben, 2026-09-14: "sure add a table").
  if (Array.isArray(column.from_subtype_keys) && !column.from_subtype_keys.includes(fact.subtype_key)) return null;
  for (const kind of column.fill_from || []) {
    for (const component of findComponentsByKind(fact, kind)) {
      if (alreadyRead.has(component.component_id)) continue;
      // A count column never reads a money amount (generation 6: Merger Sub's
      // "par value $0.01 per share" filled the authorised column with 0.01).
      if (column.value_kind === 'COUNT' && /\$/.test(String(component.text || ''))) continue;
      for (const valueKind of [...new Set([column.value_kind, component.kind])]) {
        const parsed = factConclusions.parseComponentValue(valueKind, component.text);
        if (!parsed) continue;
        if (column.value_kind === 'COUNT' && (parsed.unit !== 'COUNT' || !Number.isInteger(parsed.canonical))) continue;
        const value = { canonical: parsed.canonical, unit: parsed.unit };
        return {
          column_id: column.column_id,
          kind: 'value',
          label: factConclusions.formatValue(value, column.value_kind) || String(value.canonical),
          tone: 'value',
          value,
          component_ids: [component.component_id],
          fact_ids: [factIdOf(fact)],
          derived: true,
        };
      }
    }
  }
  return null;
}

// A NO_OTHER_REPS_FRAUD fact whose own words disclaim a representation
// "with respect to" one subject and never speak of "other" representations
// is a representation's exclusion (Metsera generation 6, 3.09: "No
// representation or warranty is made in this Agreement with respect to the
// amount, sufficiency or availability of any Tax asset"); it keeps no
// readout on the page. compileExtraction drops the readout at extraction
// by the section heading; this is the same rule for stored generations.
const SUBJECT_LIMITED_DISCLAIMER = /\b(with\s+respect\s+to|as\s+to|regarding|concerning)\b/i;
const OTHER_REPRESENTATIONS = /\b(any\s+)?other\s+(express\s+or\s+implied\s+)?representations?\b|representations?\s+or\s+warrant(y|ies)\s+(other\s+than|except)|except\s+(for\s+)?the\s+representations/i;
function isSubjectLimitedDisclaimer(fact) {
  if (fact?.family_key !== 'NO_OTHER_REPS_FRAUD') return false;
  const words = walkComponents(fact.components || []).filter((component) => component.origin === 'OWN' || !component.origin).map((component) => String(component.text || '')).join(' ');
  return SUBJECT_LIMITED_DISCLAIMER.test(words) && !OTHER_REPRESENTATIONS.test(words);
}

// Work package 7 (c) (manager, 2026-10-18; generation 8, 5.02(f)): a
// vocabulary cell the readout leaves empty on a row the shape names in
// code_from_words_by_row is coded from the fact's own words, the first rule
// that matches ("reasonably likely to be inconsistent" before "inconsistent"
// alone). The cell is marked derived: 'code_from_words' and cites the
// words that named the code.
function codeFromWordsCell(fact, column, table, tableShapes) {
  const rowLabel = fact?.conclusions?.row_label;
  const rules = rowLabel && column.render === 'vocabulary' ? column.code_from_words_by_row?.[rowLabel] : null;
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const own = ownComponentsDeep(fact);
  const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function' ? factConclusions.columnVocabulary(column, tableShapes) : (column.vocabulary || []);
  for (const rule of rules) {
    let pattern;
    try { pattern = new RegExp(rule.words, 'i'); } catch { continue; }
    const matched = anyWords(own, pattern);
    const inSummary = matched.length === 0 && pattern.test([fact.statement, fact.headline?.summary].filter(Boolean).join(' '));
    if (matched.length === 0 && !inSummary) continue;
    const entry = vocabulary.find((item) => item.code === rule.code);
    if (!entry) continue;
    return {
      column_id: column.column_id,
      kind: 'pill',
      label: entry.label,
      code: rule.code,
      ...(entry.links_to_section ? { link_section: entry.links_to_section } : {}),
      tone: entry.tone || 'neutral',
      component_ids: matched.map((component) => component.component_id),
      fact_ids: [factIdOf(fact)],
      derived: 'code_from_words',
    };
  }
  return null;
}

// Work package 18 (f): the words of a party that is neither the Company nor
// Parent (the Specified Stockholders; a sponsor; a guarantor), from the
// cited component else the fact's own ACTOR; null when the actor is one of
// the deal's own parties.
const DEAL_PARTIES = /^(?:(?:each\s+of\s+)?(?:the\s+)?(?:Company|Parent|Merger\s+Sub|Buyer|Purchaser|Acquiror|Acquirer|Target)(?:\s+(?:and|or)\s+(?:the\s+)?(?:Company|Parent|Merger\s+Sub))*|each\s+(?:of\s+the\s+)?part(?:y|ies)(?:\s+hereto)?|the\s+parties(?:\s+hereto)?)[,.]?$/i;
// The words must name a person or body (NCS 5.17's "Statement (or any
// prospectus ...), as initially filed", the model's ACTOR for the filing
// covenant, is a document, not an obligor).
const PARTY_NOUN = /\b(?:stockholders?|shareholders?|holders?|sponsors?|guarantors?|investors?|lenders?|financing\s+sources?|representatives?|affiliates?|persons?|parties|party|company|corporation|partnership|fund|trust|bank|agent|advent|[A-Z][a-z]+\s+(?:Inc\.|LLC|L\.P\.|Ltd\.?|plc|Corp\.|S\.A\.))/i;
function otherPartyWords(fact, cited = null) {
  const actor = cited || (fact.components || []).find((component) => component && component.kind === 'ACTOR' && (component.origin === 'OWN' || !component.origin) && component.text);
  const words = actor ? String(actor.text).trim() : '';
  if (!words || DEAL_PARTIES.test(words) || !PARTY_NOUN.test(words)) return null;
  return words;
}
function otherPartyCell(fact, column) {
  if (!column.other_party_code || column.render !== 'vocabulary') return null;
  const actor = (fact.components || []).find((component) => component && component.kind === 'ACTOR' && (component.origin === 'OWN' || !component.origin) && component.text);
  const words = otherPartyWords(fact, actor);
  if (!words) return null;
  return { column_id: column.column_id, kind: 'pill', label: words, code: column.other_party_code, tone: 'neutral', component_ids: [actor.component_id], fact_ids: [factIdOf(fact)], derived: 'other_party' };
}

// Work package 18 (g) (Ben: "Ok on ETA on covenants"): a verbatim column
// marked fill_from_components takes the fact's own components of its
// fill_from kinds, in source order, when the readout leaves it empty; a
// component a value column of the table already reads (the financing
// table's Period) is not repeated.
// A TRIGGER fills By when only when it states a time ("Promptly following
// the Closing Date", "After the Registration Statement becomes effective",
// "Prior to the filing"); a trigger that names an event alone ("upon the
// discovery of the happening of any event", "insofar as such losses arise
// out of") is a condition, not a deadline. A PERIOD always does.
const TIMING_WORDS = /\b(?:days?|business\s+days?|months?|years?|hours?|date|closing|effective\s+time|promptly|within|prior\s+to|following|after|before|no\s+later\s+than|until|by\s+the|as\s+soon\s+as|simultaneously|concurrently|at\s+or\s+prior)\b/i;
function fillFromComponentsCell(fact, column, table) {
  if (!column.fill_from_components || column.render !== 'verbatim') return null;
  const kinds = new Set(column.fill_from || []);
  const read = new Set();
  for (const cell of Array.isArray(fact.conclusions?.cells) ? fact.conclusions.cells : []) {
    const other = (table?.columns || []).find((candidate) => candidate.column_id === cell?.column_id);
    if (other && other.render === 'value') for (const id of Array.isArray(cell.component_ids) ? cell.component_ids : []) read.add(id);
  }
  for (const other of table?.columns || []) {
    if (other.render !== 'value') continue;
    const derived = derivedValueCell(fact, other, table);
    if (derived) for (const id of derived.component_ids || []) read.add(id);
  }
  const parts = (fact.components || [])
    .filter((component) => component && kinds.has(component.kind) && (component.origin === 'OWN' || !component.origin) && component.text && !read.has(component.component_id))
    .filter((component) => component.kind !== 'TRIGGER' || TIMING_WORDS.test(String(component.text)))
    .sort((left, right) => (left.start_byte ?? 0) - (right.start_byte ?? 0));
  if (parts.length === 0) return null;
  return { column_id: column.column_id, kind: 'text', label: parts.map((component) => String(component.text).trim()).join(' '), tone: 'neutral', component_ids: parts.map((component) => component.component_id), fact_ids: [factIdOf(fact)], derived: 'fill_from_components' };
}

function computeCellsForFact(fact, table, tableShapes) {
  const conclusionCells = conclusionCellsForFact(fact, table, tableShapes);
  const result = {};
  for (const column of table.columns) {
    if (conclusionCells) {
      result[column.column_id] = conclusionCells.get(column.column_id) || derivedValueCell(fact, column, table) || fillFromComponentsCell(fact, column, table) || otherPartyCell(fact, column) || codeFromWordsCell(fact, column, table, tableShapes) || dashCell(column.column_id);
    } else {
      result[column.column_id] = fallbackCellForColumn(fact, column);
    }
  }
  return result;
}

// Two facts landing in the same row and column: the same reading merges
// (union of the evidence); a different reading is kept as a second value so
// the cell shows both, each with its own evidence (Ben, 2026-09-13: an
// out-of-the-money exclusion must not silently overwrite the in-the-money
// row's CVR entitlement).
function cellValue(cell) {
  // A reading keeps how it was derived (work package 16: a linked value
  // term's `derived` and `via` survive the merge into a cell of several).
  return {
    label: cell.label, ...(cell.code ? { code: cell.code } : {}), ...(cell.link_section ? { link_section: cell.link_section } : {}), kind: cell.kind, tone: cell.tone,
    component_ids: cell.component_ids || [], fact_ids: cell.fact_ids || [], source_order: Number.isFinite(cell.source_order) ? cell.source_order : Number.POSITIVE_INFINITY,
    ...(cell.derived ? { derived: cell.derived } : {}), ...(cell.via ? { via: cell.via } : {}),
  };
}

// Where a cell's words sit in the source: the first byte of its cited
// components, else of the fact's own words. Two readings in one cell are
// shown in source order (Ben, 2026-09-13: "such other place, time and
// date" is the second alternative and so appears second), never in the
// order the facts happened to arrive.
function sourceOrderOf(fact, componentIds) {
  const components = walkComponents(fact.components);
  const cited = components.filter((component) => (componentIds || []).includes(component.component_id));
  const pool = cited.length ? cited : components.filter((component) => component.origin === 'OWN' || !component.origin);
  const bytes = pool.map((component) => component.start_byte).filter((byte) => Number.isSafeInteger(byte));
  return bytes.length ? Math.min(...bytes) : Number.POSITIVE_INFINITY;
}

function mergeCellInto(existing, incoming) {
  if (incoming.kind === 'dash') return existing;
  if (existing.kind === 'dash') return incoming;
  const values = existing.values ? [...existing.values] : [cellValue(existing)];
  const sameReading = values.find((value) => value.label === incoming.label && (value.code || null) === (incoming.code || null));
  if (sameReading) {
    sameReading.component_ids = [...new Set([...sameReading.component_ids, ...(incoming.component_ids || [])])];
    sameReading.fact_ids = [...new Set([...sameReading.fact_ids, ...(incoming.fact_ids || [])])];
  } else {
    values.push(cellValue(incoming));
  }
  values.sort((left, right) => (left.source_order ?? Infinity) - (right.source_order ?? Infinity));
  const first = values[0];
  return {
    ...existing,
    label: first.label,
    ...(first.code ? { code: first.code } : {}),
    component_ids: [...new Set(values.flatMap((value) => value.component_ids))],
    fact_ids: [...new Set(values.flatMap((value) => value.fact_ids))],
    ...(values.length > 1 ? { values } : {}),
  };
}

// Ben, 2026-09-14, on the Defined Terms table: "the term should [be] in
// [the] LH column and the definition on RH". A DEFINED_TERM component's
// words come in three shapes: a definition sentence ("“CVR Agreement”
// means the Contingent Value Rights Agreement ..."), an inline naming
// ("(such shares, “Appraisal Shares”)", "the “Closing Amount”") whose
// meaning is the words it names, or a usage whose definition the
// component resolves to. The term is the quoted phrase; the definition is
// the words after "means" (or "shall mean", "shall be deemed to refer
// to"), else the words the inline naming names (the component it sits in,
// or the words just before it in the same fact), else the resolved text.
const QUOTED_TERM = /[“"]([^”"]+)[”"]/;
const DEFINES = /^\s*(?:(?:the|a|an)\s+)?(?:[“"][^”"]+[”"]|(?:word|phrase|term)s? [“"][^”"]+[”"](?: or [“"][^”"]+[”"])*)\s*(?:,\s*)?(?:means|shall mean|shall be deemed to (?:refer to|mean)|refers? to|has the meaning|shall have the meaning)\s+/i;
// The term and its definition from a DEFINED_TERM component, with where the
// definition came from (`source`): 'defines' when the component's own words
// define the term ("“Rewind” means ..."), 'resolves_to' when the model gave
// the definition's words in resolves_to (the extractor is told to: "the
// definition's own words ... never the term repeated"), 'inline' when it is
// a guess from the parent's or the preceding component's words, null when
// there is none. Work package 13 (plan finding (79), NCS generation 5, 1.2
// and 2.1): the inline guess ran before resolves_to, so "Tolling Period"
// read "shall not occur on any date that falls on ..." and "Closing Date"
// read "is referred to in this Agreement as" while resolves_to held the
// definitions; the model's definition words come first, the component's
// own defining words next, the guess last.
// Work package 17 (manager, 2026-10-18, from the NCS read): "Adverse
// Recommendation Change" entered Defined Terms as "any of the foregoing
// actions", the resolved words, correct as drafted and useless without the
// list. A resolved definition that is a back-reference is shown with the
// words it refers to: the fact's own words before the term in source order
// (the sentence that lists the actions), else the fact's statement; the
// back-reference is kept in front and the entry's note says which was used.
const BACK_REFERENCE = /^\s*(?:(?:any|all|each|either|none)\s+(?:one\s+)?(?:of\s+)?)?(?:the\s+)?(?:foregoing|aforesaid|aforementioned|above)\b|^\s*(?:any\s+)?such\s+(?:an?\s+)?(?:action|actions|event|events|matter|matters|determination|determinations|transaction|transactions)\b/i;

function backReferenceListing(component, fact) {
  const start = Number.isSafeInteger(component.start_byte) ? component.start_byte : null;
  const before = (fact.components || []).filter((candidate) => candidate && candidate !== component && candidate.kind !== 'DEFINED_TERM' && candidate.text
    && (candidate.origin === 'OWN' || !candidate.origin) && (start === null || !Number.isSafeInteger(candidate.start_byte) || candidate.start_byte < start));
  const words = before.map((candidate) => String(candidate.text).trim()).join(' ').replace(/\s+/g, ' ').trim();
  if (words) return { listing: words, used: 'the fact\'s own words before the term' };
  const statement = typeof fact.statement === 'string' ? fact.statement.trim() : '';
  if (statement) return { listing: statement, used: 'the fact\'s statement' };
  return null;
}

function definedTermParts(component, fact) {
  const text = String(component.text || '').trim();
  const quoted = text.match(QUOTED_TERM);
  // An unquoted short text is the term itself (a component that names the
  // term plainly); a long unquoted text is a definition, named by its label.
  const term = quoted ? quoted[1].trim() : (text.length <= 80 && !DEFINES.test(text) ? text : (component.label || text));
  const stripDefines = (value) => value.replace(DEFINES, '').replace(/[.;]\s*$/, '').trim();
  const resolved = component.resolves_to?.text;
  if (typeof resolved === 'string' && resolved.trim() && resolved.trim() !== term) {
    const definition = DEFINES.test(resolved) ? stripDefines(resolved) : resolved.trim();
    if (BACK_REFERENCE.test(definition)) {
      const listing = backReferenceListing(component, fact);
      if (listing) return { term, definition: `${definition}: ${listing.listing}`, source: 'resolves_to', note: `The resolved words are a back-reference; the list shown is ${listing.used}.` };
    }
    return { term, definition, source: 'resolves_to' };
  }
  if (DEFINES.test(text)) return { term, definition: stripDefines(text), source: 'defines' };
  const inline = /^\(|^(?:the|a|an|such|collectively,?)\s+[“"]|^[“"][^”"]+[”"]\)?$/i.test(text) || (quoted && text.length <= quoted[0].length + 40);
  if (inline) {
    const top = fact.components || [];
    const parent = walkComponents(fact.components).find((candidate) => (candidate.children || []).some((child) => child.component_id === component.component_id));
    if (parent && parent.text && parent.text.trim() !== text) return { term, definition: parent.text.replace(text, '').replace(/\s+/g, ' ').trim(), source: 'inline' };
    const index = top.findIndex((candidate) => candidate.component_id === component.component_id);
    const before = index > 0 ? top.slice(0, index).reverse().find((candidate) => candidate.text && candidate.kind !== 'DEFINED_TERM') : null;
    if (before) return { term, definition: before.text.trim(), source: 'inline' };
  }
  return { term, definition: null, source: null };
}

// The row's line: a general-case cell when a fact without a sub-item gave
// one, else the merged overview of the sub-items (a representation with
// nothing but limbs still shows its qualifiers), else a dash.
function rowLineCell(row, column) {
  const general = row.cellsByColumn.get(column.column_id);
  if (general && general.kind !== 'dash') return general;
  const hasGeneral = [...row.cellsByColumn.values()].some((cell) => cell && cell.kind !== 'dash');
  if (hasGeneral) return general || dashCell(column.column_id);
  const overview = row.overviewCells ? row.overviewCells.get(column.column_id) : null;
  return overview || dashCell(column.column_id);
}

// A definition fact of its own (KEY_DEFINED_TERMS / OTHER_DEFINED_TERM:
// "ERISA", "ERISA Affiliate", "Proceeding"; Metsera generation 7, 3.11 and
// 3.14) has no table; it is a defined term of the Defined Terms section,
// its term the DEFINED_TERM component's words (else the headline's) and
// its definition the fact's summary.
// `seen` maps the lower-cased term to { entry, kind } ('definition' for a
// definition fact, 'component' for a DEFINED_TERM component reading).
// Work package 6 (manager, 2026-10-18, generation 8): a second definition
// fact for a term already entered was dropped (3.11's "Company Benefit
// Plan excludes Law-mandated plans" behind "Company Benefit Plan covers
// ..."; 3.09's "Tax means ..." behind a component reading from an earlier
// section). A definition fact replaces a component reading of its term
// (the definition is the better source); two definition facts of one term
// merge into one entry, their summaries joined by "; ".
function collectDefinitionFact(fact, definedTerms, seen) {
  // Any definition fact without a readout (OTHER_DEFINED_TERM always; the
  // willful-breach definition and its knowledge standard of Metsera 8.02,
  // whose family has no table for them) is a Defined Terms entry.
  if (fact.family_key !== 'KEY_DEFINED_TERMS' || fact.validation_status === 'INVALID') return false;
  if (fact.subtype_key !== 'OTHER_DEFINED_TERM' && hasReadout(fact)) return false;
  const named = walkComponents(fact.components).find((component) => component.kind === 'DEFINED_TERM');
  const parts = named ? definedTermParts(named, fact) : null;
  // The term is the quoted name wherever the fact's own words carry it
  // ((“ERISA”) after the Act's full name), else the subject of the summary
  // ("Proceeding covers ..."), else the DEFINED_TERM component's reading.
  const summary = typeof fact.headline?.summary === 'string' ? fact.headline.summary.trim() : '';
  const quotedAnywhere = walkComponents(fact.components).map((component) => String(component.text || '').match(QUOTED_TERM)).find(Boolean);
  const fromSummary = summary.match(/^(.{2,60}?)\s+(?:means|covers|is|includes|refers to)\b/);
  const term = (quotedAnywhere && quotedAnywhere[1].trim()) || (fromSummary && fromSummary[1].trim()) || (parts && parts.term) || (fact.headline?.label && fact.headline.label !== 'Other defined term' ? fact.headline.label : '');
  if (!term) return false;
  const key = term.toLowerCase();
  const entry = {
    term,
    label: named?.label || null,
    definition: summary || (parts && parts.definition) || factSummaryText(fact),
    component_id: named ? named.component_id : ((fact.components || [])[0]?.component_id || null),
    fact_id: factIdOf(fact),
    section_reference: fact.section_reference || null,
  };
  const existing = seen.get(key);
  if (existing && existing.kind === 'component') {
    Object.assign(existing.entry, entry);
    existing.kind = 'definition';
    return true;
  }
  if (existing) {
    const already = String(existing.entry.definition || '');
    if (entry.definition && already !== entry.definition && !already.split('; ').includes(entry.definition)) {
      existing.entry.definition = already ? `${already}; ${entry.definition}` : entry.definition;
    }
    return true;
  }
  seen.set(key, { entry, kind: 'definition' });
  definedTerms.push(entry);
  return true;
}

// Returns true when the fact itself is a Defined Terms entry (a definition
// fact collectDefinitionFact took): such a fact is never also listed under
// a section as "without a readout" (work package 7, 2026-10-18: 45
// generation 8 definition facts whose readout named the retired
// `defined-terms-table` sat in Defined Terms and under Intervening Event).
// A fact that is not a definition enters Defined Terms only through a
// DEFINED_TERM component that resolves to its definition (resolves_to, or
// its own defining words); a component with only an inline guess, or no
// definition, adds no entry (work package 13: 1.2's Closing and 2.1's
// Default Stock, Rewind and Share Election Stock facts showed arbitrary
// components as definitions). Such a fact stays under its family's table,
// "without a readout" when it has none.
function collectDefinedTerms(fact, definedTerms, seen) {
  if (collectDefinitionFact(fact, definedTerms, seen)) return true;
  for (const component of walkComponents(fact.components)) {
    if (component.kind !== 'DEFINED_TERM') continue;
    const { term, definition, source, note } = definedTermParts(component, fact);
    if (!definition || source === 'inline') continue;
    const key = term.toLowerCase();
    const existing = seen.get(key);
    if (existing) {
      // Two facts that define one term by a back-reference each list their
      // own actions (NCS 5.3: the two Adverse Recommendation Change
      // sentences); the entry shows both, joined with "; ".
      if (existing.kind === 'component' && note && existing.entry.note && existing.entry.definition !== definition && !existing.entry.definition.includes(definition)) {
        existing.entry.definition = `${existing.entry.definition}; ${definition}`;
        existing.entry.fact_ids = [...new Set([...(existing.entry.fact_ids || [existing.entry.fact_id]), factIdOf(fact)])];
      }
      continue;
    }
    const entry = {
      term,
      label: component.label || null,
      definition,
      ...(note ? { note } : {}),
      component_id: component.component_id,
      fact_id: factIdOf(fact),
      section_reference: fact.section_reference || null,
    };
    seen.set(key, { entry, kind: 'component' });
    definedTerms.push(entry);
  }
  return false;
}

function crossReferenceTargets(fact) {
  return walkComponents(fact.components).filter((component) => component.kind === 'CROSS_REFERENCE' && component.resolves_to)
    .map((component) => ({ component, structure_node_id: component.resolves_to.structure_node_id || null, text: component.resolves_to.text || component.text || '' }));
}

function referenceNamesSection(reference, sectionReference) {
  if (!sectionReference) return false;
  const pattern = new RegExp(`Section\\s+${sectionReference.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![0-9])`, 'i');
  return pattern.test(reference.text);
}

// A presence-derived cell (decision 34): whenever a fact of the named
// family (and subtype, when given) exists, the cell is a Yes pill citing
// that fact, or the fact as drafted when the column displays fact_text
// (the appraisal-rights line from the APPRAISAL_DISSENTERS_RIGHTS
// provision; Company termination for a Superior Proposal from the
// TERMINATION right). Never filled by the extractor.
function derivePresenceCell({ column, facts }) {
  const spec = column.derived;
  const candidates = [spec, ...(Array.isArray(spec.alternatives) ? spec.alternatives : [])];
  let sources = [];
  for (const candidate of candidates) {
    sources = (facts || []).filter((fact) => fact.family_key === candidate.from_family
      && (!candidate.from_subtype || fact.subtype_key === candidate.from_subtype)
      && fact.validation_status !== 'INVALID');
    if (sources.length > 0) break;
  }
  let derived = null;
  for (const source of sources) {
    const own = (source.components || []).filter((component) => component && (component.origin === 'OWN' || !component.origin));
    const incoming = column.display === 'fact_text'
      ? { column_id: column.column_id, kind: 'text', label: draftedText(source), tone: 'neutral', component_ids: own.map((component) => component.component_id), fact_ids: [factIdOf(source)] }
      // A boolean column answers "Present" (Ben, 2026-09-14, on the
      // appraisal-rights line: "this should just say 'present'"); other
      // renders keep the Yes pill.
      : { column_id: column.column_id, kind: 'pill', label: column.render === 'boolean' ? 'Present' : 'Yes', code: column.render === 'boolean' ? 'PRESENT' : 'YES', tone: TONE_BY_RENDER[column.render] || 'neutral', component_ids: own.slice(0, 1).map((component) => component.component_id), fact_ids: [factIdOf(source)] };
    if (!incoming.label) continue;
    incoming.source_order = sourceOrderOf(source, incoming.component_ids);
    derived = derived ? mergeCellInto(derived, incoming) : incoming;
  }
  return derived;
}

// The MAE summary from the row's own prong facts (Metsera generation 6,
// 9.03): a prong whose own words speak of consummating is the ability
// limb, any other the business limb; one of each is both.
function deriveLimbsCell({ row, column, facts, tableShapes }) {
  const spec = column.derived;
  const ids = new Set((row.backing_facts || []).map((backing) => backing.fact_id));
  const prongs = (facts || []).filter((fact) => ids.has(factIdOf(fact)) && fact.family_key === spec.from_family
    && (!spec.from_subtype || fact.subtype_key === spec.from_subtype) && fact.validation_status !== 'INVALID');
  if (prongs.length === 0) return null;
  const ability = new RegExp(spec.ability_words, 'i');
  const kinds = new Set(prongs.map((fact) => {
    const own = (fact.components || []).filter((component) => component && (component.origin === 'OWN' || !component.origin));
    const words = own.map((component) => component.text || '').join(' ') || fact.statement || '';
    return ability.test(words) ? 'ABILITY' : 'EFFECT';
  }));
  const code = spec.codes[kinds.size === 2 ? 'BOTH' : [...kinds][0]];
  const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function'
    ? factConclusions.columnVocabulary(column, tableShapes) : (column.vocabulary || []);
  const entry = vocabulary.find((item) => item.code === code);
  return {
    column_id: column.column_id, kind: 'pill', label: entry ? entry.label : code, code,
    tone: TONE_BY_RENDER[column.render] || 'neutral',
    component_ids: prongs.flatMap((fact) => (fact.components || []).slice(0, 1).map((component) => component.component_id)),
    fact_ids: prongs.map((fact) => factIdOf(fact)),
  };
}

function deriveCellForRow({ row, column, facts, tableShapes }) {
  const spec = column.derived;
  if (spec.join === 'presence') {
    if (Array.isArray(spec.rows) && !spec.rows.includes(row.subject)) return null;
    return derivePresenceCell({ column, facts });
  }
  if (spec.join === 'limbs') return deriveLimbsCell({ row, column, facts, tableShapes });
  const targets = row.backing_facts;
  const sources = (facts || []).filter((fact) => fact.family_key === spec.from_family && fact.conclusions && Array.isArray(fact.conclusions.cells));
  let derived = null;
  for (const source of sources) {
    const cell = source.conclusions.cells.find((candidate) => candidate.column_id === spec.from_column);
    if (!cell) continue;
    const references = crossReferenceTargets(source);
    const hit = references.find((reference) => targets.some((target) => (
      (reference.structure_node_id && target.structure_node_id && reference.structure_node_id === target.structure_node_id)
      || referenceNamesSection(reference, target.section_reference)
    )));
    if (!hit) continue;
    const sourceTable = resolveTableForFact(source, tableShapes);
    const sourceColumn = sourceTable?.table?.columns?.find((candidate) => candidate.column_id === spec.from_column);
    const vocabulary = sourceColumn && factConclusions && typeof factConclusions.columnVocabulary === 'function'
      ? factConclusions.columnVocabulary(sourceColumn, tableShapes) : [];
    const entry = vocabulary.find((item) => item.code === cell.code);
    const incoming = {
      column_id: column.column_id,
      kind: 'pill',
      label: entry ? entry.label : (cell.code || cell.text || null),
      ...(cell.code ? { code: cell.code } : {}),
      ...(entry?.links_to_section ? { link_section: entry.links_to_section } : {}),
      tone: TONE_BY_RENDER[column.render] || 'neutral',
      component_ids: [...new Set([hit.component.component_id, ...(cell.component_ids || [])])],
      fact_ids: [factIdOf(source)],
    };
    if (!incoming.label) continue;
    derived = derived ? mergeCellInto(derived, incoming) : incoming;
  }
  return derived;
}

function absentCodeCell(fact, column, tableShapes) {
  const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function'
    ? factConclusions.columnVocabulary(column, tableShapes) : (column.vocabulary || []);
  const entry = vocabulary.find((item) => item.code === column.absent_code);
  return {
    column_id: column.column_id,
    kind: 'pill',
    label: entry ? entry.label : column.absent_code,
    code: column.absent_code,
    ...(entry?.links_to_section ? { link_section: entry.links_to_section } : {}),
    tone: TONE_BY_RENDER[column.render] || 'neutral',
    defaulted: true,
    component_ids: [],
    fact_ids: [factIdOf(fact)],
  };
}

// The footer entry shows the fact as drafted: the readout's verbatim cell
// when it has one, otherwise the fact's own words (its components' text in
// source order), with the fact behind it for "See provision".
function footerSubtypeKeys(table) {
  const footer = table?.footer_from_subtype;
  if (!footer) return [];
  return Array.isArray(footer.subtype_keys) ? footer.subtype_keys : (footer.subtype_key ? [footer.subtype_key] : []);
}

function footerTakesFact(table, fact) {
  return footerSubtypeKeys(table).includes(fact.subtype_key);
}

function footerEntryForFact(fact, table, tableShapes) {
  const cells = computeCellsForFact(fact, table, tableShapes);
  const verbatim = (table.columns || []).map((column) => cells[column.column_id])
    .find((cell) => cell && cell.kind === 'text' && cell.label);
  const components = walkComponents(fact.components);
  // The footer is the one place the fact stays in full (decision 34: the
  // carve-back "as drafted"); the cells carry the summary.
  const text = factOwnText(fact) || (verbatim ? verbatim.label : null);
  return {
    fact_id: factIdOf(fact),
    section_reference: fact.section_reference || null,
    structure_node_id: fact.structure_node_id || null,
    text: text || null,
    component_ids: verbatim ? verbatim.component_ids : components.slice(0, 1).map((component) => component.component_id),
  };
}

// ==========================================================================
// Page rules for stored generations: a fact whose readout the extractor
// did not write (or wrote elsewhere) is placed by a deterministic rule
// over the words its components carry. Generation 7 codes these rows
// directly (the shape's guidance reaches the extractor); the rules stay as
// the safety net for every stored generation.
// ==========================================================================

// The fact's own components, at every depth (a LIST's elements are its
// own words too), never the inherited definition or chapeau lines.
function ownComponentsDeep(fact) {
  return walkComponents(fact.components).filter(isOwn);
}

function anyWords(components, pattern) {
  return components.filter((component) => pattern.test(String(component.text || '')));
}

function hasReadout(fact) {
  if (isSubjectLimitedDisclaimer(fact)) return false;
  return !!fact.conclusions && !!fact.conclusions.cells && typeof fact.conclusions.cells === 'object';
}

// The family's tables that carry a page-rule row, the parent party's table
// (a section keyed parent-*) when `parent` is asked for.
// Whether a readout names a row the shapes have: a table of the fact's
// family's sections and, on a fixed-list table without open rows, one of
// its fixed, additional or subtype rows (work package 8).
function readoutLandsOnRow(fact, tableShapes) {
  const target = findTableByKey(tableShapes, fact?.conclusions?.table_key);
  if (!target) return false;
  if (!(target.section.v2_family_keys || []).some((entry) => entry.key === fact.family_key)) return false;
  const { table } = target;
  if (table.rows_are !== 'fixed list' || table.open_rows === true || table.row_from_column) return true;
  const legal = new Set([
    ...(table.fixed_row_labels || []),
    ...((table.additional_fixed_row_labels || []).map((row) => row.label)),
    ...Object.values(table.subtype_rows || {}),
    ...(table.footer_from_subtype?.label ? [table.footer_from_subtype.label] : []),
  ]);
  return legal.has(fact.conclusions.row_label);
}

function pageRuleTable(tableShapes, familyKey, key, parent) {
  const candidates = candidateTablesForFamily(tableShapes, familyKey).filter((candidate) => candidate.table[key]);
  if (candidates.length === 0) return null;
  const isParent = (candidate) => /^parent-/.test(String(candidate.section.section_key || ''));
  return (parent ? candidates.find(isParent) : candidates.find((candidate) => !isParent(candidate))) || candidates[0];
}

function vocabularyColumnForRow(table, rowLabel) {
  return (table.columns || []).find((column) => column.render === 'vocabulary' && column.vocabulary_by_row && Array.isArray(column.vocabulary_by_row[rowLabel])) || null;
}

// Ben, 2026-09-14, on the Article III introduction rendered as seven status
// and document representations: "all of this is miscoded. THis is the
// standard intro to the reps that provides the exceptions for all reps -
// look at the old system - we should be able to show the reader the
// general categories of the exceptions (SEC filings) and as they click
// into deeper levels show more detail (last X days) etc"; and, on the
// separate table that followed: "by miscoded I meant oyu currentl have it
// messed up and you need to move it over to what we had in the old
// vesrion....". A REPRESENTATIONS fact cut from an article introduction
// (a node whose reference ends in -INTRO; generation 6 read them as status
// and document representations) with no readout is placed on the table's
// intro_facts_row ("General Exceptions"), its sub-item by the words it
// carries: the Filed SEC Documents exception under "SEC Filings", the
// Disclosure Letter exception under "Disclosure Letter", anything else
// under "Other". The excluded portions (forward-looking statements, risk
// factors, exhibits, the historical-facts carve-back) and the letter's
// arrangement rule become the Qualifiers codes the shape lists for the row,
// each citing the words that name it; the cut-off comes out of the DATE or
// PERIOD component through the value-cell path (derivedValueCell).
const SEC_FILINGS_WORDS = /\bSEC\b|Securities and Exchange Commission/i;
const DISCLOSURE_LETTER_WORDS = /Disclosure (?:Letter|Schedule)s?/i;
const INTRO_DETAILS = Object.freeze({ sec: 'SEC Filings', letter: 'Disclosure Letter', other: 'Other' });
const INTRO_CODE_RULES = Object.freeze([
  { code: 'EXCLUDES_FORWARD_LOOKING_STATEMENTS', detail: 'sec', words: /forward[- ]looking/i },
  { code: 'EXCLUDES_RISK_FACTORS', detail: 'sec', words: /risk factors/i },
  { code: 'EXCLUDES_EXHIBITS', detail: 'sec', words: /\bexhibits?\b/i },
  { code: 'SPECIFIC_HISTORICAL_FACTS_NOT_EXCLUDED', detail: 'sec', words: /historical fact/i },
  { code: 'ARRANGED_BY_SECTION', detail: 'letter', words: /arranged in\b[^.]{0,60}\bsections?\b/i },
  { code: 'CROSS_SECTION_WHERE_REASONABLY_APPARENT', detail: 'letter', words: /reasonably apparent/i },
]);
const PARENT_PARTY = /^(?:the\s+)?(?:Parent|Merger Sub|Buyer|Acquiror|Acquirer|Purchaser)\b/i;

function isArticleIntroductionFact(fact) {
  return /-INTRO$/.test(String(fact?.section_reference || ''));
}

function introReadout(fact, table) {
  const rowLabel = table.intro_facts_row;
  const own = ownComponentsDeep(fact);
  const column = vocabularyColumnForRow(table, rowLabel);
  const allowed = new Set(column ? column.vocabulary_by_row[rowLabel] : []);
  const cells = [];
  let detailFromCode = null;
  for (const rule of INTRO_CODE_RULES) {
    if (!allowed.has(rule.code)) continue;
    const matched = anyWords(own, rule.words);
    if (matched.length === 0) continue;
    cells.push({ column_id: column.column_id, code: rule.code, component_ids: matched.map((component) => component.component_id) });
    if (!detailFromCode) detailFromCode = rule.detail;
  }
  const category = anyWords(own, SEC_FILINGS_WORDS).length ? 'sec'
    : anyWords(own, DISCLOSURE_LETTER_WORDS).length ? 'letter'
      : (detailFromCode || 'other');
  const details = table.detail_labels_by_row?.[rowLabel] || [];
  const detail = details.includes(INTRO_DETAILS[category]) ? INTRO_DETAILS[category] : (details[details.length - 1] || INTRO_DETAILS.other);
  return { table_key: table.table_key, row_label: rowLabel, row_detail: detail, cells };
}

// The Knowledge row of the old version's representations table (Standard:
// "Knowledge after reasonable inquiry"; Persons: "Persons listed on
// Disclosure Letter"). A KEY_DEFINED_TERMS/KNOWLEDGE fact (the "Knowledge"
// definition) whose readout is not on a representations table is placed on
// the table's knowledge_facts_row: the standard it states as a "Standard"
// sub-item, whose knowledge counts as a "Persons" sub-item, each code
// citing the words that name it; the definition of Parent's knowledge goes
// to the parent table.
const KNOWLEDGE_CODE_RULES = Object.freeze([
  { code: 'KNOWLEDGE_AFTER_REASONABLE_INQUIRY', detail: 'Standard', words: /reasonable (?:inquiry|investigation)|due inquiry/i },
  { code: 'ACTUAL_KNOWLEDGE', detail: 'Standard', words: /actual knowledge/i },
  { code: 'CONSTRUCTIVE_KNOWLEDGE', detail: 'Standard', words: /should (?:reasonably )?have known|constructive knowledge/i },
  { code: 'PERSONS_LISTED_ON_DISCLOSURE_LETTER', detail: 'Persons', words: DISCLOSURE_LETTER_WORDS },
  { code: 'OFFICERS', detail: 'Persons', words: /\bofficers?\b/i },
]);
const PARENT_KNOWLEDGE = /knowledge of (?:the )?(?:Parent|Buyer|Acquiror|Acquirer|Purchaser|Merger Sub)\b/i;

function isKnowledgeDefinition(fact) {
  return fact?.family_key === 'KEY_DEFINED_TERMS' && fact?.subtype_key === 'KNOWLEDGE' && fact?.validation_status !== 'INVALID';
}

function knowledgeReadouts(fact, table) {
  const rowLabel = table.knowledge_facts_row;
  const own = ownComponentsDeep(fact);
  const column = vocabularyColumnForRow(table, rowLabel);
  const allowed = new Set(column ? column.vocabulary_by_row[rowLabel] : []);
  const details = table.detail_labels_by_row?.[rowLabel] || [];
  const byDetail = new Map();
  for (const rule of KNOWLEDGE_CODE_RULES) {
    if (!allowed.has(rule.code) || !details.includes(rule.detail)) continue;
    const matched = anyWords(own, rule.words);
    if (matched.length === 0) continue;
    if (!byDetail.has(rule.detail)) byDetail.set(rule.detail, []);
    byDetail.get(rule.detail).push({ column_id: column.column_id, code: rule.code, component_ids: matched.map((component) => component.component_id) });
  }
  if (byDetail.size === 0) return [{ table_key: table.table_key, row_label: rowLabel, cells: [] }];
  return [...byDetail.entries()].map(([detail, cells]) => ({ table_key: table.table_key, row_label: rowLabel, row_detail: detail, cells }));
}

// Work package 6 (manager, 2026-10-18, generation 8's 3.13(b) and (c)): the
// material contracts representation's limbs (MATERIAL_CONTRACTS facts of
// the disclosure-list, status and no-default subtypes) were on no table.
// A table's limb_rows_from_subtype names, by family and subtype, the row
// and sub-item such a fact takes without a readout (the representations
// table's Material Contracts row: Disclosure list / Validity and
// enforceability / No default); its Qualifiers cell is read from the
// qualifier words the fact carries, as the extractor codes it on any
// representation row. Codes outside the column's vocabulary are never used.
const LIMB_QUALIFIER_RULES = Object.freeze([
  { code: 'MAE_AGGREGATE', words: /Material Adverse Effect/i },
  { code: 'TRUE_IN_ALL_MATERIAL_RESPECTS_PARTIAL', words: /in all material respects/i },
  { code: 'KNOWLEDGE_QUALIFIED_PARTIAL', words: /\bknowledge\b/i },
  { code: 'MATERIAL_TO_THE_REP', words: /\bmaterial(?:ly)?\b(?! Adverse Effect)(?! Contract)(?! respects)/i },
]);
const LIMB_QUALIFIER_KINDS = new Set(['MATERIALITY_QUALIFIER', 'QUALIFIER', 'STANDARD', 'EXCEPTION', 'CONDITION']);

function limbRowTable(tableShapes, fact) {
  if (!fact?.family_key || !fact?.subtype_key) return null;
  return candidateTablesForFamily(tableShapes, fact.family_key)
    .find((candidate) => candidate.table.limb_rows_from_subtype?.[fact.family_key]?.[fact.subtype_key]) || null;
}

function limbRowReadout(fact, table) {
  const target = table.limb_rows_from_subtype[fact.family_key][fact.subtype_key];
  // The qualifier column: the vocabulary column the page does not derive
  // (the bring-down column is derived from the conditions and carries no
  // codes of its own) whose codes include a qualifier code.
  const codesOf = (candidate) => candidate.vocabulary_by_row?.[target.row_label] || (candidate.vocabulary || []).map((entry) => entry.code);
  const column = (table.columns || []).find((candidate) => candidate.render === 'vocabulary' && !candidate.derived
    && LIMB_QUALIFIER_RULES.some((rule) => codesOf(candidate).includes(rule.code))) || null;
  const allowed = new Set(column ? codesOf(column) : []);
  const qualifiers = ownComponentsDeep(fact).filter((component) => LIMB_QUALIFIER_KINDS.has(component.kind));
  const cells = [];
  for (const rule of LIMB_QUALIFIER_RULES) {
    if (!allowed.has(rule.code)) continue;
    const matched = anyWords(qualifiers, rule.words);
    if (matched.length === 0) continue;
    cells.push({ column_id: column.column_id, code: rule.code, component_ids: matched.map((component) => component.component_id) });
    break; // one qualifier code per limb: the strongest the words state
  }
  return { table_key: table.table_key, row_label: target.row_label, row_detail: target.row_detail, cells };
}

// Ben, 2026-09-14: "sure add a table". A CAPITALISATION fact with no
// readout is placed on the capitalization table (row_from_security_class)
// by the security class its words name: the award class (Restricted Stock
// Awards, PSUs, RSUs, Stock Options, the ESPP, Warrants) for an award
// inventory or a reserve, else the class the counted words name (Preferred
// Stock, Common Stock), the count parsed from the cited words through the
// value-cell path; a valid-issuance fact marks its class Validly issued; an
// absence fact goes under the table as drafted (footer_from_subtype); a
// subsidiary-equity fact is the Subsidiary equity row. A counted fact
// without a count, or a fact naming no class, stays without a readout.
const AWARD_CLASS_RULES = Object.freeze([
  ['Company Restricted Stock Awards', /Restricted Stock Awards?|\bRSAs?\b/i],
  ['Company PSUs', /\bPSUs?\b|Performance (?:Stock|Share) Units?/i],
  ['Company RSUs', /\bRSUs?\b|Restricted Stock Units?/i],
  ['Company Stock Options', /Stock Options?|\bOptions?\b/i],
  ['ESPP', /\bESPP\b|Employee Stock Purchase/i],
  ['Warrants', /\bWarrants?\b/i],
]);
const STOCK_CLASS_RULES = Object.freeze([
  ['Preferred Stock', /Preferred (?:Stock|Shares)/i],
  ['Common Stock', /Common (?:Stock|Shares)|Ordinary Shares/i],
]);
const MERGER_SUB_CLASS = 'Merger Sub capital stock';
const SUBSIDIARY_CLASS = 'Subsidiary equity';
const COUNTED_SUBTYPES = new Set(['AUTHORISED_CAPITAL', 'ISSUED_AND_OUTSTANDING', 'RESERVED_OR_ISSUABLE_SECURITIES', 'EQUITY_AWARD_INVENTORY']);
const AWARD_SUBTYPES = new Set(['EQUITY_AWARD_INVENTORY', 'RESERVED_OR_ISSUABLE_SECURITIES']);

function securityClassOf(fact, table) {
  const rows = new Set(table.fixed_row_labels || []);
  const own = ownComponentsDeep(fact).filter((component) => component.kind !== 'EXCEPTION');
  const counted = own.filter((component) => component.kind === 'AMOUNT' || component.kind === 'THRESHOLD');
  // The first component, in source order, that names a class decides (the
  // authorised-capital sentence counts the common stock before the
  // preferred: its row is Common Stock).
  const firstMatch = (pool, rules) => {
    for (const component of inSourceOrder(pool)) {
      for (const [label, words] of rules) {
        if (rows.has(label) && words.test(String(component.text || ''))) return label;
      }
    }
    return null;
  };
  if (fact.subtype_key === 'PARTNERSHIP_OR_SUBSIDIARY_EQUITY') return rows.has(SUBSIDIARY_CLASS) ? SUBSIDIARY_CLASS : null;
  // Merger Sub's own capital (Article IV: "The authorized capital stock of
  // Merger Sub consists of 1,000 shares") is its own row, never the
  // Company's Common Stock (generation 6 merged the two).
  if (rows.has(MERGER_SUB_CLASS) && own.some((component) => /\bMerger Sub\b/.test(String(component.text || '')))) return MERGER_SUB_CLASS;
  if (AWARD_SUBTYPES.has(fact.subtype_key)) {
    const award = firstMatch(own, AWARD_CLASS_RULES);
    if (award) return award;
  }
  return firstMatch(counted, STOCK_CLASS_RULES) || firstMatch(own, STOCK_CLASS_RULES) || firstMatch(own, AWARD_CLASS_RULES);
}

function capitalizationReadout(fact, table) {
  const footer = table.footer_from_subtype;
  if (footer && fact.subtype_key === footer.subtype_key) return { table_key: table.table_key, row_label: footer.label, cells: [] };
  if (COUNTED_SUBTYPES.has(fact.subtype_key) && !ownComponentsDeep(fact).some((component) => (component.kind === 'AMOUNT' || component.kind === 'THRESHOLD')
    && factConclusions && factConclusions.parseComponentValue('COUNT', component.text))) return null;
  const rowLabel = securityClassOf(fact, table);
  if (!rowLabel) return null;
  const own = ownComponents(fact);
  const cells = [];
  const drafted = (table.columns || []).find((column) => column.display === 'fact_text');
  if (drafted && own.length) cells.push({ column_id: drafted.column_id, text: own[0].text, component_ids: own.map((component) => component.component_id) });
  const presence = (table.columns || []).find((column) => column.render === 'boolean' && Array.isArray(column.from_subtype_keys) && column.from_subtype_keys.includes(fact.subtype_key));
  if (presence && own.length) cells.push({ column_id: presence.column_id, present: true, component_ids: own.slice(0, 1).map((component) => component.component_id) });
  return { table_key: table.table_key, row_label: rowLabel, cells };
}

// An article introduction's facts are placed as one: the party whose
// introduction it is (Parent's when any of them names Parent or Merger Sub
// as the representing party) picks the table. Keyed by the introduction's
// section reference (III-INTRO, IV-INTRO).
function articleIntroductionParties(list) {
  const introParty = new Map();
  for (const fact of list) {
    if (fact.family_key !== 'REPRESENTATIONS' || !isArticleIntroductionFact(fact)) continue;
    const reference = String(fact.section_reference);
    const actor = ownComponents(fact).find((component) => component.kind === 'ACTOR');
    if (actor && PARENT_PARTY.test(String(actor.text || '').trim())) introParty.set(reference, 'parent');
    else if (!introParty.has(reference)) introParty.set(reference, 'company');
  }
  return introParty;
}

// Work package 26 (plan finding (232), 2026-10-22), placement of the
// representation qualifiers. Ben, on the three placements put to him:
// "Option a on placement": the article's REPRESENTATION_QUALIFICATION facts
// are extracted once, on the introduction node ((207): one voice there),
// and the page shows them above each representation section's table,
// joined by code from the introduction node, not repeated per section by
// the extractor. One entry per valid qualification fact, in the fact's own
// words (its statement; the OWN words when a statement is missing), keyed
// by the table the introduction's party picks (the same rule as the
// General Exceptions row, intro_facts_row); nothing for a table whose
// article has no such fact. The entries open the fact in the sidebar.
const QUALIFICATION_SUBTYPE = 'REPRESENTATION_QUALIFICATION';

function articleOf(reference) {
  const match = /^([IVXLC]+|\d+)-INTRO$/i.exec(String(reference || '').trim());
  return match ? match[1] : null;
}

function articleQualifications(facts, tableShapes) {
  const list = (facts || []).filter(Boolean);
  const parties = articleIntroductionParties(list);
  const byTable = new Map();
  for (const fact of list) {
    if (fact.family_key !== 'REPRESENTATIONS' || fact.subtype_key !== QUALIFICATION_SUBTYPE || !isArticleIntroductionFact(fact)) continue;
    if (fact.validation_status === 'INVALID') continue;
    const target = pageRuleTable(tableShapes, 'REPRESENTATIONS', 'intro_facts_row', parties.get(String(fact.section_reference)) === 'parent');
    if (!target) continue;
    const words = typeof fact.statement === 'string' && fact.statement.trim() ? fact.statement : factOwnText(fact);
    const text = hidePageFooters(String(words || '')).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const key = target.table.table_key;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push({ fact_id: factIdOf(fact), section_reference: fact.section_reference || null, article: articleOf(fact.section_reference), text });
  }
  for (const entries of byTable.values()) {
    entries.sort((left, right) => String(left.section_reference).localeCompare(String(right.section_reference), undefined, { numeric: true }));
  }
  return byTable;
}

// Applies the page rules to the facts handed to buildTableView: a fact the
// rules place is replaced by (or, for a knowledge definition that already
// has a readout elsewhere, joined by) copies carrying the rule's readout.
// Every other fact passes through untouched.
function applyPageRules(facts, tableShapes) {
  const list = (facts || []).filter(Boolean);
  const introParty = articleIntroductionParties(list);
  const out = [];
  for (const stored of list) {
    // A readout that names a table the shapes no longer carry (generation
    // 6, IV-INTRO: "parent-representations-general-qualifications", retired
    // when the General Exceptions row took its place) is no readout; the
    // page rules place the fact as they would a fact without one.
    const retired = hasReadout(stored) && stored.conclusions.table_key && !findTableByKey(tableShapes, stored.conclusions.table_key);
    let fact = retired ? { ...stored, conclusions: null, retired_table_key: stored.conclusions.table_key } : stored;
    // Work package 8 (manager, 2026-10-18; generation 8, 8.02(a)'s willful
    // breach definition): a KEY_DEFINED_TERMS fact whose readout lands on
    // no row (an unknown or retired table, a table of another family, or a
    // row a fixed-list table does not have) is a Defined Terms entry, never
    // dropped: its readout is treated as none and collectDefinitionFact
    // takes it as it would a definition fact without one.
    if (fact.family_key === 'KEY_DEFINED_TERMS' && hasReadout(fact) && !readoutLandsOnRow(fact, tableShapes)) {
      fact = { ...fact, conclusions: null, dropped_readout: { table_key: fact.conclusions.table_key, row_label: fact.conclusions.row_label || null } };
    }
    // Work package 30 (plan finding (243)): a closing-condition fact takes
    // the table of the side its own words name, and the 5.9 negative takes
    // its own row on Parent's table. A fact naming neither side keeps its
    // readout's table.
    const conditionsPlaced = conditionsPageRule(fact);
    if (conditionsPlaced) fact = conditionsPlaced;
    // Work package 18 (d): a words_rows rule marked over_readout moves a
    // stored fact to its row when the fact's words match (NCS generation
    // 5, 5.17's registration-rights covenants off "General notification").
    if (hasReadout(fact) && factConclusions && typeof factConclusions.rowFromWords === 'function') {
      const home = findTableByKey(tableShapes, fact.conclusions.table_key);
      const rule = home ? factConclusions.rowFromWords(fact, home.table) : null;
      if (rule) fact = { ...fact, conclusions: { ...fact.conclusions, row_label: rule.row_label, ...(rule.table_key ? { table_key: rule.table_key } : {}) }, page_rule: 'words_rows', row_from: fact.conclusions.row_label };
    }
    if (fact.family_key === 'REPRESENTATIONS' && !hasReadout(fact) && isArticleIntroductionFact(fact)) {
      const target = pageRuleTable(tableShapes, fact.family_key, 'intro_facts_row', introParty.get(String(fact.section_reference)) === 'parent');
      if (target) { out.push({ ...fact, conclusions: introReadout(fact, target.table), page_rule: 'intro_facts_row' }); continue; }
    }
    if (isKnowledgeDefinition(fact)) {
      const parent = ownComponentsDeep(fact).some((component) => PARENT_KNOWLEDGE.test(String(component.text || '')));
      const target = pageRuleTable(tableShapes, fact.family_key, 'knowledge_facts_row', parent);
      const alreadyThere = hasReadout(fact) && findTableByKey(tableShapes, fact.conclusions.table_key)?.table?.knowledge_facts_row;
      if (target && !alreadyThere) {
        if (hasReadout(fact)) out.push(fact);
        for (const readout of knowledgeReadouts(fact, target.table)) out.push({ ...fact, conclusions: readout, page_rule: 'knowledge_facts_row' });
        continue;
      }
    }
    if (!hasReadout(fact) && fact.validation_status !== 'INVALID') {
      const limbTarget = limbRowTable(tableShapes, fact);
      if (limbTarget) { out.push({ ...fact, conclusions: limbRowReadout(fact, limbTarget.table), page_rule: 'limb_rows_from_subtype' }); continue; }
    }
    if (fact.family_key === 'CAPITALISATION' && !hasReadout(fact) && fact.validation_status !== 'INVALID') {
      const target = candidateTablesForFamily(tableShapes, fact.family_key).find((candidate) => candidate.table.row_from_security_class === true);
      const readout = target ? capitalizationReadout(fact, target.table) : null;
      if (readout) { out.push({ ...fact, conclusions: readout, page_rule: 'row_from_security_class' }); continue; }
    }
    // A fact with no readout whose fact type names a row of its family's
    // table takes that row (the same rule the extractor applies to a
    // proposal returned without conclusions; Metsera generation 6, 7.02).
    // The intro row's exception codes never sit on a representation row
    // (stored generations; the extractor drops them at admission).
    if (hasReadout(fact) && factConclusions && typeof factConclusions.stripIntroRowCodes === 'function') {
      const target = findTableByKey(tableShapes, fact.conclusions.table_key);
      const stripped = target ? factConclusions.stripIntroRowCodes(fact.conclusions, target.table) : null;
      if (stripped && stripped.dropped.length) { out.push({ ...fact, conclusions: stripped.conclusions, page_rule: 'intro_codes_stripped' }); continue; }
    }
    if (!hasReadout(fact) && fact.validation_status !== 'INVALID' && fact.conditions_row) {
      // The negative the decision names is a row whatever readout the
      // extractor returned, because a negative hidden under a catch-all is
      // how a reader misses it (finding (243)).
      out.push({
        ...fact,
        conclusions: { table_key: CONDITIONS_SIDE_TABLE[fact.conditions_side], row_label: fact.conditions_row, cells: [] },
        page_rule: 'conditions_by_side',
      });
      continue;
    }
    if (!hasReadout(fact) && fact.validation_status !== 'INVALID' && factConclusions && typeof factConclusions.defaultConclusions === 'function') {
      const readout = factConclusions.defaultConclusions(fact, tableShapes);
      if (readout) {
        const sideTable = fact.conditions_side ? CONDITIONS_SIDE_TABLE[fact.conditions_side] : null;
        out.push({
          ...fact,
          conclusions: { ...readout, ...(sideTable ? { table_key: sideTable } : {}) },
          page_rule: sideTable ? 'conditions_by_side' : 'fact_type_rows',
        });
        continue;
      }
    }
    out.push(fact);
  }
  return out;
}

// `buildTableView({ facts, tableShapes, legalSchema })` -> { sections, defined_terms }.
// A one-per-agreement table also carries `other_provisions` (groupOtherProvisions)
// when facts of its family add no cell of their own.
// `tableShapes` is the parsed contracts/product/table-shapes.v3.json.
// `legalSchema` is the parsed contracts/product/legal-schema.v2.json, used
// only as an extra (belt-and-braces) coverage_only check.
// Work package 13 (c) (manager, 2026-10-18, plan finding (79), NCS
// generation 5, 2.1): "The consideration tables carry the election type
// (Mixed election) and the mechanics rows but no per-share economics: the
// three exchange ratios and the cash value sit in Defined Terms while the
// consideration-components table shows 'Stock election' and 'Acquirer stock'
// rows with no ratio or value. The shape needs the election options as rows
// (cash election, share election, mixed election: ratio, cash, value per
// share) filled from the facts, with a value fallback from a defined ratio
// that carries a number". The rule, data in the table's election_options
// (scripts/product/table-shapes-decision-34.js), applied the same way on
// every agreement:
//   1. A VALID fact of the section's families and the table's subtypes is an
//      option's when its readout carries the option's form code (the
//      components table's STOCK_ELECTION) or its words match the option's
//      pattern, and never when they match `unless` (a no-election default is
//      the mechanics table's "If no election" row).
//   2. The option's exchange ratio is the fact's value cell in shares (unit
//      COUNT) on any table, else a numeric AMOUNT or THRESHOLD component
//      without a dollar sign; its cash per share the fact's value cell in
//      dollars, else a dollar component; its defined term the readout's term
//      cell, else the fact's first DEFINED_TERM.
//   3. Every value term the fact's words name (a Defined Terms entry whose
//      term matches value_terms, other than the option's own term): a
//      definition that is a bare number fills the empty ratio (a count) or
//      cash (dollars) cell, citing the definition; any other definition is
//      shown under the value terms column with, after it, the numbers of
//      the value terms it names in turn ("Cash Consideration means the Cash
//      Exchange Ratio multiplied by the Parent Closing Price", then "Cash
//      Exchange Ratio: 0.1371").
//   A row exists only once a ratio, cash or value-terms cell is filled; a
//   readout's own cell is never overwritten. Ben decides whether an option
//   with no fact reads as not offered.
const NUMERIC_DEFINITION = /^(?:.*?\bmeans\s+)?(\$?\d[\d,]*(?:\.\d+)?)(?:\s+(?:shares?|per share|in cash))?\.?$/i;

function definitionNumber(definition) {
  if (!factConclusions || typeof factConclusions.parseComponentValue !== 'function') return null;
  const match = String(definition || '').trim().match(NUMERIC_DEFINITION);
  if (!match) return null;
  const parsed = factConclusions.parseComponentValue('AMOUNT', match[1]);
  return parsed && Number.isFinite(Number(parsed.canonical)) ? { canonical: parsed.canonical, unit: parsed.unit } : null;
}

function factWords(fact) {
  return hidePageFooters(walkComponents(fact.components).filter((component) => component && component.text).map((component) => String(component.text).trim()).join(' '));
}

function termPattern(term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'g');
}

function termNamedIn(words, term) {
  return termPattern(term).test(words);
}

// The defined terms a text names, longest first, each occurrence counted
// once: "Mixed Share Consideration" names neither "Share Consideration" nor
// "Consideration" (NCS 2.1), so a longer term's words are blanked before a
// shorter term is looked for. Returned in the order the text names them.
function termsNamedIn(text, entries) {
  let remaining = String(text || '');
  const found = [];
  for (const entry of [...entries].sort((left, right) => right.term.length - left.term.length)) {
    const index = remaining.search(termPattern(entry.term));
    if (index === -1) continue;
    found.push({ entry, index });
    remaining = remaining.replace(termPattern(entry.term), (match) => ' '.repeat(match.length));
  }
  return found.sort((left, right) => left.index - right.index).map(({ entry }) => entry);
}

function fillElectionOptions({ facts, heldFacts = [], tableShapes, buckets, ensureBucket, definedTerms }) {
  const factById = new Map((facts || []).map((fact) => [factIdOf(fact), fact]));
  if (!factConclusions || typeof factConclusions.formatValue !== 'function') return;
  const valueCell = (columnId, value, componentIds, factIds, derived) => ({
    column_id: columnId,
    kind: 'value',
    label: factConclusions.formatValue(value, 'AMOUNT') || String(value.canonical),
    tone: 'value',
    value,
    component_ids: componentIds,
    fact_ids: factIds,
    derived,
  });
  const filled = (row, columnId) => { const cell = row.cellsByColumn.get(columnId); return !!cell && cell.kind !== 'dash'; };
  for (const { section, table } of sectionCandidateTables(tableShapes)) {
    const spec = table.election_options;
    if (!spec) continue;
    const familyKeys = new Set((section.v2_family_keys || []).map((entry) => entry.key));
    const rules = Object.entries(spec.rows).map(([label, rule]) => ({ label, formCode: rule.form_code || null, words: rule.words ? new RegExp(rule.words, 'i') : null }));
    const unless = spec.unless ? new RegExp(spec.unless, 'i') : null;
    const valueTerms = new RegExp(spec.value_terms, 'i');
    const entryByTerm = new Map((definedTerms || []).map((entry) => [String(entry.term).toLowerCase(), entry]));
    const entryCitation = (entry) => ({ component_ids: entry.component_ids ? [...entry.component_ids] : (entry.component_id ? [entry.component_id] : []), fact_ids: [entry.fact_id] });
    // The value terms a text names, longest first.
    const named = (text) => termsNamedIn(text, [...entryByTerm.values()].filter((entry) => valueTerms.test(entry.term)));
    // The option a fact is for: its readout's form code, else its words;
    // never a no-election default; nothing outside the section's families
    // and the table's subtypes.
    const optionOf = (fact) => {
      if (!fact || !familyKeys.has(fact.family_key)) return null;
      if (Array.isArray(table.subtype_keys) && !table.subtype_keys.includes(fact.subtype_key)) return null;
      const words = factWords(fact);
      if (unless && unless.test(words)) return null;
      const readoutCells = Array.isArray(fact.conclusions?.cells) ? fact.conclusions.cells : [];
      const codes = new Set(readoutCells.map((cell) => cell && cell.code).filter(Boolean));
      const rule = rules.find((candidate) => (candidate.formCode && codes.has(candidate.formCode)) || (candidate.words && candidate.words.test(words)));
      return rule ? { rule, words, readoutCells } : null;
    };
    for (const fact of facts || []) {
      if (!fact || fact.validation_status === 'INVALID') continue;
      const option = optionOf(fact);
      if (!option) continue;
      const { rule, words, readoutCells } = option;
      const factId = factIdOf(fact);
      const cells = new Map();
      // 2. The fact's own numbers: a readout value cell by its unit, else a
      // numeric component.
      const readoutValue = (unit) => readoutCells.find((cell) => cell && cell.value && cell.value.unit === unit && Number.isFinite(Number(cell.value.canonical)));
      const componentValue = (dollars) => {
        for (const kind of ['AMOUNT', 'THRESHOLD']) {
          for (const component of findComponentsByKind(fact, kind)) {
            if (/\$/.test(String(component.text || '')) !== dollars) continue;
            const parsed = factConclusions.parseComponentValue('AMOUNT', component.text);
            if (parsed && Number.isFinite(Number(parsed.canonical)) && (parsed.unit === 'USD') === dollars) return { value: { canonical: parsed.canonical, unit: parsed.unit }, component_ids: [component.component_id] };
          }
        }
        return null;
      };
      for (const [columnId, unit, dollars] of [[spec.ratio_column, 'COUNT', false], [spec.cash_column, 'USD', true]]) {
        const own = readoutValue(unit);
        const source = own ? { value: { canonical: own.value.canonical, unit: own.value.unit }, component_ids: Array.isArray(own.component_ids) ? own.component_ids : [] } : componentValue(dollars);
        if (source) cells.set(columnId, valueCell(columnId, source.value, source.component_ids, [factId], own ? undefined : true));
      }
      const termColumn = (table.columns || []).find((column) => column.render === 'term');
      const readoutTerm = readoutCells.find((cell) => cell && termColumn && cell.column_id === termColumn.column_id && typeof cell.text === 'string' && cell.text.trim());
      const ownTermComponent = walkComponents(fact.components).find((component) => component.kind === 'DEFINED_TERM' && component.text);
      const ownTerm = readoutTerm ? readoutTerm.text.trim() : (ownTermComponent ? definedTermParts(ownTermComponent, fact).term : null);
      if (ownTerm) cells.set(spec.term_column, { column_id: spec.term_column, kind: 'text', label: ownTerm, tone: 'term', component_ids: readoutTerm ? (readoutTerm.component_ids || []) : [ownTermComponent.component_id], fact_ids: [factId] });
      // 3. The value terms the fact names, from the agreement's own
      // definitions. A term named only inside a formula component (work
      // package 14: the cash leg's "“Cash Consideration” means ... the
      // product of (x) the Cash Exchange Ratio, multiplied by (y) the
      // Parent Closing Price") is a factor of that formula, never the
      // option's own ratio or cash: its number is listed under the value
      // terms instead.
      const termEntries = [];
      const formulaTexts = walkComponents(fact.components).filter((component) => component && component.value && component.value.form === 'FORMULA' && component.text).map((component) => hidePageFooters(String(component.text).trim()));
      const cellWords = formulaTexts.reduce((text, formula) => text.split(formula).join(' '), words);
      const inFormulasOnly = named(formulaTexts.join(' ')).filter((entry) => !termNamedIn(cellWords, entry.term));
      for (const entry of named(cellWords)) {
        if (ownTerm && entry.term.toLowerCase() === ownTerm.toLowerCase()) continue;
        const number = definitionNumber(entry.definition);
        if (number) {
          const columnId = number.unit === 'USD' ? spec.cash_column : spec.ratio_column;
          if (!cells.has(columnId)) cells.set(columnId, valueCell(columnId, number, entryCitation(entry).component_ids, [entry.fact_id, factId], 'defined_term'));
          continue;
        }
        const definition = String(entry.definition || '').trim();
        if (!definition) continue;
        termEntries.push({ label: termNamedIn(definition, entry.term) ? definition : `${entry.term}: ${definition}`, ...entryCitation(entry) });
        for (const nested of named(definition)) {
          if (nested.term.toLowerCase() === entry.term.toLowerCase()) continue;
          const nestedNumber = definitionNumber(nested.definition);
          if (!nestedNumber) continue;
          termEntries.push({ label: `${nested.term}: ${factConclusions.formatValue(nestedNumber, 'AMOUNT') || String(nestedNumber.canonical)}`, ...entryCitation(nested) });
        }
      }
      for (const entry of inFormulasOnly) {
        if (ownTerm && entry.term.toLowerCase() === ownTerm.toLowerCase()) continue;
        const number = definitionNumber(entry.definition);
        const label = number ? `${entry.term}: ${factConclusions.formatValue(number, 'AMOUNT') || String(number.canonical)}` : null;
        if (label && !termEntries.some((candidate) => candidate.label === label)) termEntries.push({ label, ...entryCitation(entry) });
      }
      if (termEntries.length) {
        let cell = null;
        for (const entry of termEntries) {
          const incoming = { column_id: spec.terms_column, kind: 'text', label: entry.label, tone: 'neutral', component_ids: entry.component_ids, fact_ids: entry.fact_ids, source_order: termEntries.indexOf(entry) };
          cell = cell ? mergeCellInto(cell, incoming) : incoming;
        }
        cells.set(spec.terms_column, cell);
      }
      if (![spec.ratio_column, spec.cash_column, spec.terms_column].some((columnId) => cells.has(columnId))) continue;
      const bucket = ensureBucket(section, table);
      let row = bucket.rows.find((candidate) => candidate.subject === rule.label);
      if (!row) {
        row = { subject: rule.label, cellsByColumn: new Map(), backing_facts: [], sub_rows: [], option_terms: new Set(), linked_terms: new Set() };
        bucket.rows.push(row);
      }
      if (!row.backing_facts.some((entry) => entry.fact_id === factId)) row.backing_facts.push({ fact_id: factId, section_reference: fact.section_reference || null, structure_node_id: fact.structure_node_id || null });
      // The option's own term and its ratio or cash terms (the numeric
      // definitions its words name), for the definition link below.
      if (ownTerm) row.option_terms.add(ownTerm);
      for (const entry of named(cellWords)) if (definitionNumber(entry.definition)) row.option_terms.add(entry.term);
      for (const entry of termEntries) row.linked_terms.add(entry.label.toLowerCase());
      for (const [columnId, cell] of cells) {
        if (filled(row, columnId)) {
          // Two facts of one option (the cash and the stock leg of a mixed
          // election) are two readings of its cells, never overwritten.
          const existing = row.cellsByColumn.get(columnId);
          if (existing.label !== cell.label) row.cellsByColumn.set(columnId, mergeCellInto(existing, cell));
          continue;
        }
        row.cellsByColumn.set(columnId, cell);
      }
    }
    const bucket = buckets.get(table.table_key);
    // Ben, 2026-10-18 (plan finding (85)): "SHOYUULDN'T ALL THE INFO BE
    // LINKED/ACCURTE?" A value term whose definition names an option's own
    // term or one of its ratio or cash terms belongs on that option's row:
    // the code reads the definition fact's own words (not its summary) and
    // links it, the derivation cited (`via` names the term that links it,
    // the cell cites the definition). A term ending in the value pattern
    // goes under the value column; any other under Value terms; a numeric
    // term the definition names in turn is listed after it.
    if (bucket) {
      // Every defined term is a candidate for the longest match, so
      // "Share Consideration Exchange Ratio" is not found inside "Mixed
      // Share Consideration Exchange Ratio" (NCS 2.1: the stock row took the
      // mixed terms on the first render).
      const allTerms = new Map([...entryByTerm.values()].map((entry) => [entry.term, { term: entry.term }]));
      for (const row of bucket.rows) {
        if (row.absent || !row.option_terms || row.option_terms.size === 0) continue;
        const candidates = new Map(allTerms);
        for (const term of row.option_terms) if (!candidates.has(term)) candidates.set(term, { term });
        for (const entry of entryByTerm.values()) {
          if (!valueTerms.test(entry.term)) continue;
          if (row.option_terms.has(entry.term) || row.linked_terms.has(String(entry.term).toLowerCase())) continue;
          const definitionFact = factById.get(entry.fact_id);
          const definitionWords = definitionFact ? factWords(definitionFact) : String(entry.definition || '');
          const via = termsNamedIn(definitionWords, [...candidates.values()]).find((candidate) => row.option_terms.has(candidate.term));
          if (!via) continue;
          const definition = String(entry.definition || '').trim();
          if (!definition) continue;
          // The derivation: the definition and the option's facts.
          const factIds = [entry.fact_id, ...row.backing_facts.map((backing) => backing.fact_id)];
          const number = definitionNumber(definition);
          if (number && spec.value_column && !filled(row, spec.value_column)) {
            // A bare-number definition is the option's value per share.
            row.cellsByColumn.set(spec.value_column, { ...valueCell(spec.value_column, number, entryCitation(entry).component_ids, factIds, 'definition_link'), via: via.term });
            row.linked_terms.add(String(entry.term).toLowerCase());
            continue;
          }
          const entries = [{ label: termNamedIn(definition, entry.term) ? definition : `${entry.term}: ${definition}`, ...entryCitation(entry) }];
          for (const nested of named(definitionWords)) {
            if (nested.term === entry.term || row.option_terms.has(nested.term)) continue;
            const nestedNumber = definitionNumber(nested.definition);
            if (nestedNumber) entries.push({ label: `${nested.term}: ${factConclusions.formatValue(nestedNumber, 'AMOUNT') || String(nestedNumber.canonical)}`, ...entryCitation(nested) });
          }
          for (const [index, linked] of entries.entries()) {
            const incoming = { column_id: spec.terms_column, kind: 'text', label: linked.label, tone: 'neutral', component_ids: linked.component_ids, fact_ids: index === 0 ? factIds : linked.fact_ids, derived: 'definition_link', via: via.term, source_order: 1000 + index };
            const existing = row.cellsByColumn.get(spec.terms_column);
            row.cellsByColumn.set(spec.terms_column, existing && existing.kind !== 'dash' ? mergeCellInto(existing, incoming) : incoming);
          }
          row.linked_terms.add(String(entry.term).toLowerCase());
        }
      }
    }
    // A held fact of an option (INVALID, its words kept): an option with no
    // filled row reads held, never "Not a deal feature" (the manager, plan
    // finding (85): "a held fact is 'held', never 'not a feature'").
    const heldRows = new Map();
    for (const fact of heldFacts || []) {
      const option = optionOf(fact);
      if (!option) continue;
      const filled = bucket && bucket.rows.find((candidate) => candidate.subject === option.rule.label && !candidate.absent);
      const backing = { fact_id: factIdOf(fact), section_reference: fact.section_reference || null, structure_node_id: fact.structure_node_id || null, held: true };
      if (filled) { if (!filled.backing_facts.some((entry) => entry.fact_id === backing.fact_id)) filled.backing_facts.push(backing); continue; }
      if (!heldRows.has(option.rule.label)) heldRows.set(option.rule.label, []);
      heldRows.get(option.rule.label).push(backing);
    }
    if (heldRows.size > 0) {
      const target = ensureBucket(section, table);
      for (const [label, backing] of heldRows) {
        target.rows.push({ subject: label, absent: true, absent_label: spec.held_row_label || 'Held by validation', held: true, cellsByColumn: new Map(), backing_facts: backing, sub_rows: [] });
      }
    }
  }
}

// Ben, 2026-10-18 (plan finding (85)), on the per-share table keeping its
// election rows beside the election options table: "KEEP ELECTIONS BUT
// ONLY WHEN THERE IS AN ELECTIOB". A table's election_forms names the
// options table and, for each election form code, the plain form it is
// when the deal has no election (no filled option row): the row folds into
// the plain form's row, its form cell recoded with `folded_from`.
function foldElectionForms({ tableShapes, buckets }) {
  for (const { table } of sectionCandidateTables(tableShapes)) {
    const spec = table.election_forms;
    if (!spec || !table.row_from_column) continue;
    const options = buckets.get(spec.options_table_key);
    if (options && options.rows.some((row) => !row.absent)) continue;
    const bucket = buckets.get(table.table_key);
    if (!bucket) continue;
    const formColumn = (table.columns || []).find((column) => column.column_id === table.row_from_column);
    const labelByCode = new Map(((formColumn && formColumn.vocabulary) || []).map((entry) => [entry.code, entry.label]));
    for (const [electionCode, plainCode] of Object.entries(spec.plain_form_by_code || {})) {
      const electionLabel = labelByCode.get(electionCode);
      const plainLabel = labelByCode.get(plainCode);
      if (!electionLabel || !plainLabel) continue;
      const index = bucket.rows.findIndex((row) => row.subject === electionLabel && !row.absent);
      if (index === -1) continue;
      const [row] = bucket.rows.splice(index, 1);
      const recode = (cell) => (cell && cell.kind !== 'dash' && cell.column_id === table.row_from_column && cell.code === electionCode
        ? { ...cell, code: plainCode, label: plainLabel, folded_from: electionCode } : cell);
      for (const [columnId, cell] of row.cellsByColumn) row.cellsByColumn.set(columnId, recode(cell));
      if (row.overviewCells) for (const [columnId, cell] of row.overviewCells) row.overviewCells.set(columnId, recode(cell));
      let plain = bucket.rows.find((candidate) => candidate.subject === plainLabel && !candidate.absent);
      if (!plain) {
        bucket.rows.push({ ...row, subject: plainLabel, folded_from: electionCode });
        continue;
      }
      for (const [columnId, cell] of row.cellsByColumn) {
        const existing = plain.cellsByColumn.get(columnId);
        plain.cellsByColumn.set(columnId, existing && existing.kind !== 'dash' ? mergeCellInto(existing, cell) : cell);
      }
      for (const backing of row.backing_facts) if (!plain.backing_facts.some((entry) => entry.fact_id === backing.fact_id)) plain.backing_facts.push(backing);
      plain.sub_rows.push(...row.sub_rows);
      plain.folded_from = electionCode;
    }
  }
}

// heldFacts (work package 16): the run's layered facts held by validation,
// with the words the model wrote; read only by the election options rule,
// so an option whose only fact is held reads held, never "not a feature".
function buildTableView({ facts: storedFacts, heldFacts = [], tableShapes, legalSchema = null }) {
  // Every word the tables show comes from the components' text; the SEC
  // page footers in it are hidden here, once, for every table (the stored
  // facts, their bytes and ids are untouched).
  const facts = (storedFacts || []).map(factWithoutPageFooters);
  const definedTerms = [];
  const seenTerms = new Map();
  // table_key -> { section, table, rows: [{ subject, cells: Map, backing_facts }] }
  const buckets = new Map();
  const ensureBucket = (section, table) => {
    if (!buckets.has(table.table_key)) buckets.set(table.table_key, { section, table, rows: [], footer: [], other_facts: [] });
    return buckets.get(table.table_key);
  };
  // section_key -> facts of the section's families that carry no readout
  const unplaced = new Map();

  const placed = applyPageRules(facts, tableShapes);
  // Work package 26: the article's qualification facts, above each
  // representation table (articleQualifications).
  const qualificationsByTable = articleQualifications(facts, tableShapes);
  // The words behind every coded cell (work package 12): one map of
  // component id to text over the page's facts.
  const componentTextById = new Map((facts || []).flatMap((fact) => walkComponents(fact.components).filter((component) => component && component.text).map((component) => [component.component_id, component.text])));
  for (const fact of placed) {
    if (!fact) continue;
    if (collectDefinedTerms(fact, definedTerms, seenTerms)) continue;
    // A coverage-only family (Miscellaneous / Boilerplate) still has its
    // precedent rows (decision 34; Ben, 2026-09-12: shown as one collapsed,
    // expandable section after the operative families). Its section is
    // flagged coverage_only so the page starts it collapsed.

    const target = resolveTableForFact(fact, tableShapes);
    if (!target || target.section.excluded_from_fact_tables) continue;
    const { section, table } = target;
    // A fact without a readout never becomes a row: a row keyed by a fact's
    // grammatical subject with its verbs as cells is not a conclusion (Ben,
    // 2026-09-13, on employee benefits and general covenants). It is listed
    // under the section as evidence without a readout instead.
    const readout = hasReadout(fact);
    // A table may take one or more subtypes' facts as its footer (the MAE
    // disproportionality carve-back and the underlying-cause proviso shown,
    // as drafted, under the carve-out table; Ben, 2026-09-13: "we should
    // show how the disproportionate carve out is drafted at the bottom of
    // the table"). Such a fact is never a row and needs no readout.
    if (footerTakesFact(table, fact)) {
      const bucket = ensureBucket(section, table);
      // style other_provisions: the facts are the table's Other provisions
      // (Term / Summary rows) under the footer's label (capitalization's
      // No other securities; Ben, 2026-09-14: "tidy up this no other
      // securities other provisions like in the other sections").
      if (table.footer_from_subtype.style === 'other_provisions') bucket.other_facts.push(fact);
      else bucket.footer.push(footerEntryForFact(fact, table, tableShapes));
      continue;
    }
    if (!readout && otherProvisionsTakesFact(table, fact)) {
      ensureBucket(section, table).other_facts.push(fact);
      continue;
    }
    if (!readout && table.rows_are === 'one per agreement') {
      // Ben, 2026-09-14, on "the separate corporate existence of Merger Sub
      // shall cease": a fact of a one-row family with no coded cell of its
      // own is still part of the reading of that row (it is the structure
      // that describes the reverse triangular merger), so it backs the row
      // and sits behind "See provision", never under "without a readout".
      const bucket = ensureBucket(section, table);
      const subject = table.subject_label || 'The deal';
      let row = bucket.rows.find((candidate) => candidate.subject === subject);
      if (!row) {
        row = { subject, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] };
        bucket.rows.push(row);
      }
      row.backing_facts.push({ fact_id: factIdOf(fact), section_reference: fact.section_reference || null, structure_node_id: fact.structure_node_id || null });
      // It is also an "other provision" of the row (Ben, 2026-09-14: "a
      // hidden 'other provisions' section under the main structure and
      // mechanics parts"), grouped and summarised by groupOtherProvisions.
      bucket.other_facts.push(fact);
      continue;
    }
    if (!readout) {
      if (!unplaced.has(section.section_key)) unplaced.set(section.section_key, []);
      unplaced.get(section.section_key).push({ fact_id: factIdOf(fact), section_reference: fact.section_reference || null, headline: fact.headline?.label || null });
      continue;
    }

    const bucket = ensureBucket(section, table);

    // A one-per-agreement table has a single row that every fact of the
    // family fills in together (the legacy Structure & Mechanics grid).
    // A table that derives its rows from the fact's subtype (general
    // covenants) names the row from the schema's subtype, never from the
    // words the model chose; the model's own label becomes the sub-item.
    // A fact a words_rows rule moved (work package 19 (g)) keeps the rule's
    // row: on the stored NCS 5.17 rows the general covenants table named
    // the row from the subtype (GENERAL_NOTIFICATION) and made the rule's
    // row the sub-item, which the fixtures' made-up subtype never showed.
    const subtypeRow = fact.page_rule !== 'words_rows' && table.row_from_subtype && table.subtype_rows ? table.subtype_rows[fact.subtype_key] || null : null;
    // A table may name its rows from one of its coded columns (the
    // per-share consideration rows from the form code: Cash, CVR), so two
    // facts about the same form share a row whatever words they use.
    const cellsForRow = computeCellsForFact(fact, table, tableShapes);
    const columnRow = table.row_from_column && cellsForRow[table.row_from_column] && cellsForRow[table.row_from_column].kind !== 'dash'
      ? cellsForRow[table.row_from_column].label : null;
    const subject = table.rows_are === 'one per agreement' ? (table.subject_label || 'The deal') : (columnRow || subtypeRow || subjectForFact(fact));
    let row = bucket.rows.find((candidate) => candidate.subject === subject);
    if (!row) {
      row = { subject, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] };
      bucket.rows.push(row);
    }
    const backing = { fact_id: factIdOf(fact), section_reference: fact.section_reference || null, structure_node_id: fact.structure_node_id || null };
    row.backing_facts.push(backing);

    const cells = cellsForRow;
    // A one-row fact whose readout adds no cell of its own joins the row's
    // "other provisions" alongside the facts with no readout at all.
    if (table.rows_are === 'one per agreement' && Object.values(cells).every((cell) => !cell || cell.kind === 'dash')) bucket.other_facts.push(fact);
    for (const cell of Object.values(cells)) {
      if (cell && cell.kind !== 'dash') cell.source_order = sourceOrderOf(fact, cell.component_ids);
    }
    const ownLabel = typeof fact.conclusions?.row_label === 'string' ? fact.conclusions.row_label.trim() : '';
    // A table may split a row into sub-items by one of its columns (the
    // bring-down tiers by their standard): each fact becomes a line keyed
    // by that cell, and the row's line keeps the overview.
    const columnDetail = table.sub_row_from_column && cells[table.sub_row_from_column] && cells[table.sub_row_from_column].kind !== 'dash'
      ? cells[table.sub_row_from_column].label : null;
    // Work package 18 (c): a row with detail_from_words_by_row names the
    // sub-item from the fact's own words, for stored generations as at
    // extraction (NCS generation 5, 5.14's twelve publicity facts).
    const ruleDetail = factConclusions && typeof factConclusions.detailFromWords === 'function' ? factConclusions.detailFromWords(fact, table) : null;
    // A table marked no_sub_items (the registration-rights row; Ben: "I
    // wouldn't go into anywhere near this depth in this product") is one
    // line per row whatever detail a fact carries.
    const detail = table.no_sub_items ? null : (ruleDetail || (typeof fact.conclusions?.row_detail === 'string' && fact.conclusions.row_detail.trim()
      ? fact.conclusions.row_detail.trim()
      : (subtypeRow && ownLabel && ownLabel !== subtypeRow ? ownLabel : columnDetail)));
    // The row's own line carries the general case: the cells of the facts
    // with no sub-item. A sub-item's cells go to its own line and to the
    // row's fallback overview, used only when no general-case fact exists
    // (Ben, 2026-09-14, on the option row showing "conflicting treatment":
    // "Consider showing those as the main row ... and then say
    // 'Exceptions' and show the sub rows").
    if (!row.overviewCells) row.overviewCells = new Map();
    for (const column of table.columns) {
      // A column with absent_code answers a blank cell with that code (the
      // MAE carve-back column says Yes or No and nothing else; Ben,
      // 2026-09-13: "the disproportionate carve out must say yes or no").
      if (column.absent_code && (!cells[column.column_id] || cells[column.column_id].kind === 'dash')) {
        cells[column.column_id] = absentCodeCell(fact, column, tableShapes);
      }
      const incoming = cells[column.column_id];
      const target = detail ? row.overviewCells : row.cellsByColumn;
      const existing = target.get(column.column_id);
      target.set(column.column_id, existing ? mergeCellInto(existing, incoming) : incoming);
    }
    if (detail) {
      let subRow = row.sub_rows.find((candidate) => candidate.subject === detail);
      if (!subRow) {
        subRow = { subject: detail, cellsByColumn: new Map(), backing_facts: [], from_column: !ruleDetail && !(fact.conclusions?.row_detail) && !(subtypeRow && ownLabel && ownLabel !== subtypeRow) };
        row.sub_rows.push(subRow);
      }
      subRow.backing_facts.push(backing);
      for (const column of table.columns) {
        const incoming = cells[column.column_id];
        const existing = subRow.cellsByColumn.get(column.column_id);
        subRow.cellsByColumn.set(column.column_id, existing ? mergeCellInto(existing, incoming) : incoming);
      }
    }
  }

  // Work package 13 (c): the consideration election options, one row per
  // election a holder may make, from the component facts and the
  // agreement's own numeric definitions.
  fillElectionOptions({ facts, heldFacts: (heldFacts || []).map(factWithoutPageFooters), tableShapes, buckets, ensureBucket, definedTerms });
  // Ben, 2026-10-18 (plan finding (85)): "KEEP ELECTIONS BUT ONLY WHEN
  // THERE IS AN ELECTIOB": without a filled option, the per-share table's
  // election-coded rows fold into their plain forms.
  foldElectionForms({ tableShapes, buckets });
  // Work package 17 (manager, 2026-10-18): a held fact is shown under its
  // family's section with its reason in plain words (the preview's
  // held_reason, from the run's issues), so an empty table says why
  // (NCS 3.4: ten facts held on an unknown span) rather than nothing.
  const heldBySection = new Map();
  for (const fact of heldFacts || []) {
    const target = fact && resolveTableForFact(fact, tableShapes);
    if (!target || target.section.excluded_from_fact_tables) continue;
    if (!heldBySection.has(target.section.section_key)) heldBySection.set(target.section.section_key, []);
    heldBySection.get(target.section.section_key).push({
      fact_id: factIdOf(fact), section_reference: fact.section_reference || null, headline: fact.headline?.label || null,
      summary: typeof fact.headline?.summary === 'string' ? fact.headline.summary : null,
      reason: typeof fact.held_reason === 'string' && fact.held_reason ? fact.held_reason : 'held by validation',
    });
  }

  // Derived columns: a bring-down standard on a representation row comes
  // from the CLOSING_CONDITIONS bring-down fact whose CROSS_REFERENCE
  // resolves to that representation's section (Ben, 2026-09-13: "a
  // bringdown standard is what is said in the conditions, not the rep").
  // A rule over the facts, applied the same way on every agreement.
  // A fixed row whose only content is presence-derived (Company termination
  // for a Superior Proposal, with no no-shop fact on that row) still needs
  // its row: it is created here, in its table, before the columns derive.
  for (const { section, table } of sectionCandidateTables(tableShapes)) {
    for (const column of table.columns || []) {
      if (!column.derived || column.derived.join !== 'presence') continue;
      if (table.rows_are === 'one per agreement') {
        if (!derivePresenceCell({ column, facts })) continue;
        const bucket = ensureBucket(section, table);
        const subject = table.subject_label || 'The deal';
        if (!bucket.rows.some((row) => row.subject === subject)) bucket.rows.push({ subject, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] });
        continue;
      }
      if (table.rows_are !== 'fixed list') continue;
      const rowLabels = Array.isArray(column.derived.rows) ? column.derived.rows : [];
      for (const label of rowLabels) {
        if (!derivePresenceCell({ column, facts })) continue;
        const bucket = ensureBucket(section, table);
        if (!bucket.rows.some((row) => row.subject === label)) bucket.rows.push({ subject: label, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] });
      }
    }
  }
  // A column the page derives for some rows only (derived.rows: the
  // intervening and superior tables' provision column, derived on their
  // termination rows alone) keeps the readouts' own cells on every other
  // row. Work package 7 (c), 2026-10-18: every row's cell was overwritten
  // with a dash here, so a Board determination standard code the model
  // returned, or the page derived, never reached the intervening table.
  for (const bucket of buckets.values()) {
    for (const column of bucket.table.columns) {
      if (!column.derived) continue;
      const rowsOnly = Array.isArray(column.derived.rows) ? column.derived.rows : null;
      const setDerived = (row) => {
        if (rowsOnly && !rowsOnly.includes(row.subject)) return;
        const derived = deriveCellForRow({ row, column, facts, tableShapes, bucket });
        row.cellsByColumn.set(column.column_id, derived || dashCell(column.column_id));
      };
      for (const row of bucket.rows) {
        setDerived(row);
        for (const subRow of row.sub_rows) setDerived(subRow);
      }
    }
  }

  // A sub-item made from a column's value (the bring-down tiers by their
  // standard) is worth a line only beside another: a row whose one fact
  // gave it one such sub-item is the row itself (Metsera generation 6,
  // 7.02: Performance of Covenants repeated as "True in all material
  // respects" beneath itself).
  for (const bucket of buckets.values()) {
    for (const row of bucket.rows) {
      if (row.sub_rows.length === 1 && row.sub_rows[0].from_column) row.sub_rows = [];
    }
  }

  // Sub-items follow the table's detail_labels order (Vested, Unvested ...)
  // when it has one; a detail not in the list comes after, in arrival order.
  for (const bucket of buckets.values()) {
    for (const row of bucket.rows) {
      const labels = bucket.table.detail_labels_by_row?.[row.subject] || bucket.table.detail_labels;
      if (!Array.isArray(labels)) continue;
      const order = new Map(labels.map((label, index) => [label, index]));
      row.sub_rows.sort((left, right) => (order.has(left.subject) ? order.get(left.subject) : order.size) - (order.has(right.subject) ? order.get(right.subject) : order.size));
    }
  }

  const sections = [];
  for (const section of tableShapes.sections || []) {
    if (section.excluded_from_fact_tables) continue;
    const sectionTables = [];
    for (const table of section.tables || []) {
      const bucket = buckets.get(table.table_key);
      if (!bucket || (bucket.rows.length === 0 && bucket.footer.length === 0 && bucket.other_facts.length === 0)) continue;
      // A subject-note column is shown under the row's subject, not as a
      // column (Ben, 2026-09-14: the defined term "under the word 'cash'
      // and 'CVR' in component").
      const noteColumns = (table.columns || []).filter((column) => column.display === 'subject_note');
      const shownColumns = (table.columns || []).filter((column) => column.display !== 'subject_note');
      const subjectNote = (row) => noteColumns.map((column) => row.cellsByColumn.get(column.column_id)).filter((cell) => cell && cell.kind !== 'dash' && cell.label).map((cell) => cell.label).join('; ') || null;
      // The combined definition: the package fact's defined term and its
      // operative words (the “Merger Consideration”: the cash and the CVR).
      let combined = null;
      if (table.combined_definition_from) {
        const spec = table.combined_definition_from;
        const source = (facts || []).find((candidate) => candidate && candidate.family_key === spec.family_key && candidate.subtype_key === spec.subtype_key
          && candidate.validation_status !== 'INVALID' && walkComponents(candidate.components).some((component) => component.kind === 'DEFINED_TERM'));
        if (source) {
          // The term: the first DEFINED_TERM component, or with term_words
          // (work package 13 (c)) the first component, DEFINED_TERM first,
          // whose quoted term matches it (NCS 2.1: the package fact's first
          // defined term is “Eligible Shares”; the “Merger Consideration” is
          // quoted in its OBJECT's words).
          const components = walkComponents(source.components).filter((component) => component && component.text);
          let term = null;
          let termName = null;
          if (spec.term_words) {
            const pattern = new RegExp(spec.term_words, 'i');
            const quotedTerms = (component) => [...String(component.text).matchAll(/[“"]([^”"]+)[”"]/g)].map((match) => match[1].trim());
            for (const component of [...components.filter((component) => component.kind === 'DEFINED_TERM'), ...components.filter((component) => component.kind !== 'DEFINED_TERM')]) {
              const match = quotedTerms(component).find((candidate) => pattern.test(candidate));
              if (match) { term = component; termName = match; break; }
            }
          } else {
            term = components.find((component) => component.kind === 'DEFINED_TERM');
            termName = term ? definedTermParts(term, source).term : null;
          }
          if (term) combined = { label: spec.label, term: termName, text: factSummaryText(source), fact_id: factIdOf(source), section_reference: source.section_reference || null, component_ids: [term.component_id] };
        }
      }
      // A fixed-list table with absent_row_label shows each fixed row that
      // no fact fills as that label (the MAE definitions table: "None" for
      // a party with no MAE; Ben, 2026-09-13: "if there is no MAE for
      // parent just say none"). Only once the table has at least one
      // filled row: an empty table is not evidence of absence.
      if (table.absent_row_label && bucket.rows.length > 0) {
        for (const label of table.fixed_row_labels || []) {
          if (bucket.rows.some((row) => row.subject === label)) continue;
          bucket.rows.push({ subject: label, absent: true, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] });
        }
      }
      // A fixed-list table's rows come out in the precedent's order (the
      // print's row order), a row outside the list after them in arrival
      // order (decision 34: every table is the precedent's row list).
      if (table.rows_are === 'fixed list') {
        const order = new Map((table.fixed_row_labels || []).map((label, index) => [label, index]));
        bucket.rows.sort((left, right) => (order.has(left.subject) ? order.get(left.subject) : order.size) - (order.has(right.subject) ? order.get(right.subject) : order.size));
      }
      sectionTables.push(attachWords(pruneEmptyColumns(applyColumnRules(pruneDraftedColumns({
        table_key: table.table_key,
        group_header: table.group_header,
        layout: table.layout || 'rows',
        ...(table.per_step_structure ? { per_step_structure: table.per_step_structure } : {}),
        term_column: table.term_column,
        columns: shownColumns.map((column) => ({ column_id: column.column_id, header: column.header, ...(column.display === 'fact_text' ? { display: 'fact_text' } : {}) })),
        ...(table.absent_row_label ? { absent_row_label: table.absent_row_label } : {}),
        ...(combined ? { combined_definition: combined } : {}),
        ...(table.footer_from_subtype && table.footer_from_subtype.style !== 'other_provisions' ? { footer: { label: table.footer_from_subtype.label, entries: bucket.footer } } : {}),
        ...(bucket.other_facts.length ? { other_provisions: groupOtherProvisions(bucket.other_facts) } : {}),
        ...(bucket.other_facts.length && table.footer_from_subtype?.style === 'other_provisions' ? { other_provisions_label: table.footer_from_subtype.label } : {}),
        ...(bucket.other_facts.length && !table.footer_from_subtype && table.other_provisions_from_subtype?.label ? { other_provisions_label: table.other_provisions_from_subtype.label } : {}),
        ...(table.collapsible_rows ? { collapsible_rows: true } : {}),
        ...(table.sub_rows_label ? { sub_rows_label: table.sub_rows_label } : {}),
        ...(qualificationsByTable.has(table.table_key) ? { article_qualifications: qualificationsByTable.get(table.table_key) } : {}),
        rows: bucket.rows.map((row) => ({
          subject: row.subject,
          ...(subjectNote(row) ? { subject_note: subjectNote(row) } : {}),
          ...(row.absent ? { absent: true } : {}),
          ...(row.absent && row.absent_label ? { absent_label: row.absent_label } : {}),
          ...(row.held ? { held: true } : {}),
          ...(row.folded_from ? { folded_from: row.folded_from } : {}),
          cells: shownColumns.map((column) => rowLineCell(row, column)),
          backing_facts: row.backing_facts,
          ...(row.sub_rows && row.sub_rows.length ? {
            sub_rows: row.sub_rows.map((subRow) => ({
              subject: subRow.subject,
              cells: shownColumns.map((column) => subRow.cellsByColumn.get(column.column_id) || dashCell(column.column_id)),
              backing_facts: subRow.backing_facts,
            })),
          } : {}),
        })),
      }), table.columns)), componentTextById));
    }
    const withoutReadout = unplaced.get(section.section_key) || [];
    const held = heldBySection.get(section.section_key) || [];
    if (sectionTables.length === 0 && withoutReadout.length === 0 && held.length === 0) continue;
    // The section's first family is its own (a later one is a family it
    // also hosts, like specific performance under boilerplate).
    const primaryFamily = (section.v2_family_keys || [])[0]?.key;
    const coverageOnly = !!primaryFamily && (legalSchema?.families || []).some((family) => family.family_key === primaryFamily && family.coverage_only);
    sections.push({ section_key: section.section_key, title: section.title, ...(section.rail ? { rail: section.rail } : {}), ...(coverageOnly ? { coverage_only: true } : {}), tables: sectionTables, facts_without_readout: withoutReadout, ...(held.length ? { held_facts: held } : {}) });
  }

  definedTerms.sort((left, right) => left.term.localeCompare(right.term));

  return { sections, defined_terms: definedTerms };
}

module.exports = {
  SHOW_CODES_BY_DEFAULT,
  applyColumnRules,
  attachWords,
  pruneEmptyColumns,
  pillStatedInSummary,
  definedTermParts,
  buildTableView,
  articleQualifications,
  factOwnText,
  factSummaryText,
  summaryComponents,
  groupOtherProvisions,
  isSubjectLimitedDisclaimer,
  provisionTerm,
  subjectForFact,
  resolveTableForFact,
  applyPageRules,
  walkComponents,
  findComponentsByKind,
  shortenText,
  factIdOf,
};
