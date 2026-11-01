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
  // Ben, 2026-11-01: the as-drafted column is behind "Show specifics" unless
  // it is the table's only content (markSpecifics). A pill is "stated by the
  // summary" only when that summary is on the page: a hidden summary cannot
  // stand in for the code ("'In board determination standard' would be
  // inconsistent, so the 'would' is the important part there. I think that's
  // kind of interesting stuff that you don't pick up").
  const summaryColumns = new Set(visibleSummaryColumns(table).map((column) => column.column_id));
  const lines = (row) => [row, ...(row.sub_rows || [])];
  const filled = (cell) => cell && cell.kind !== 'dash' && (Array.isArray(cell.values) ? cell.values.length > 0 : !!cell.label);

  // Ben, 2026-11-01: (c) a reading another reading of the same cell
  // supersedes is dropped ("You can't have the 'only' right."), and (d) a
  // cell of several distinct readings in a many_as column reads that word
  // ("where it says 'bring down standard' and there are multiple standards
  // for one thing, I would say 'various'"), the readings kept behind it.
  const conflictsOf = new Map((shapeColumns || []).filter((column) => Array.isArray(column.drop_when_present)).map((column) => [column.column_id, column.drop_when_present]));
  const manyAsOf = new Map((shapeColumns || []).filter((column) => column.many_as).map((column) => [column.column_id, column.many_as]));
  const resolveCodeConflicts = (cell) => {
    const rules = conflictsOf.get(cell.column_id);
    if (!rules || !filled(cell) || !Array.isArray(cell.values) || cell.values.length < 2) return cell;
    const codes = new Set(cell.values.map((value) => value.code));
    const dropped = cell.values.filter((value) => rules.some((rule) => rule.drop === value.code && codes.has(rule.when)));
    if (dropped.length === 0) return cell;
    const kept = cell.values.filter((value) => !dropped.includes(value));
    const superseded = dropped.map((value) => value.code);
    if (kept.length === 1) return { ...kept[0], column_id: cell.column_id, superseded };
    return { ...cell, label: kept[0].label, ...(kept[0].code ? { code: kept[0].code } : {}), values: kept, superseded };
  };
  // Round 4 (Ben: "where they are multiple qualifiers try and say Generally
  // X but certain portions Y"): in 'generally' mode the reading that backs
  // most of the row (its sub-items, else its facts) is the general one and
  // the others are "certain portions"; with no clear majority the readings
  // are listed. A cell the derivation already phrased is left alone.
  const collapseManyAs = (cell, line) => {
    const word = manyAsOf.get(cell.column_id);
    if (!word || !filled(cell) || !Array.isArray(cell.values) || cell.values.length < 2 || cell.generally) return cell;
    const distinct = new Set(cell.values.map((value) => value.code || value.label));
    if (distinct.size < 2) return cell;
    if (word !== 'generally') return { column_id: cell.column_id, kind: 'text', label: word, tone: 'neutral', many: cell.values, component_ids: cell.component_ids || [], fact_ids: cell.fact_ids || [] };
    const subs = (line && Array.isArray(line.sub_rows)) ? line.sub_rows : [];
    const weight = (value) => {
      const key = value.code || value.label;
      if (subs.length) return subs.filter((sub) => (sub.cells || []).some((candidate) => candidate.column_id === cell.column_id && (Array.isArray(candidate.values) ? candidate.values : [candidate]).some((reading) => (reading.code || reading.label) === key))).length;
      return (value.fact_ids || []).length;
    };
    const ranked = cell.values.map((value) => ({ value, weight: weight(value) })).sort((left, right) => right.weight - left.weight);
    const total = subs.length || new Set(cell.values.flatMap((value) => value.fact_ids || [])).size;
    const general = ranked[0];
    const majority = general.weight > 0 && general.weight * 2 > total && general.weight > (ranked[1]?.weight || 0);
    // Without a clear majority the readings are a list (the exclusions of
    // the SEC filings exception, two knowledge standards), left as they are.
    if (!majority) return cell;
    const label = `Generally ${lowerFirst(general.value.label)}; certain portions ${ranked.slice(1).map((entry) => lowerFirst(entry.value.label)).join(', ')}`;
    return { column_id: cell.column_id, kind: 'text', label, tone: 'neutral', many: cell.values, generally: general.value.code || general.value.label, component_ids: cell.component_ids || [], fact_ids: cell.fact_ids || [] };
  };
  const mapCells = (line) => ({ ...line, cells: (line.cells || []).map((cell) => collapseManyAs(resolveCodeConflicts(cell), line)) });
  const resolved = rows.map((row) => ({ ...mapCells(row), ...(row.sub_rows ? { sub_rows: row.sub_rows.map(mapCells) } : {}) }));

  // (b) pills the summary states.
  const withPills = resolved.map((row) => {
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
  const emptiedBy = (columnId) => resolved.flatMap(lines).some((line) => filled(cellIn(line, columnId))) && !allLines.some((line) => filled(cellIn(line, columnId)));
  const empty = new Set((table.columns || []).filter((column) => !summaryColumns.has(column.column_id) && emptiedBy(column.column_id)).map((column) => column.column_id));
  if (fold.size === 0 && empty.size === 0) return { ...table, rows: withPills };
  const headerOf = new Map((table.columns || []).map((column) => [column.column_id, column.header]));
  // The detail names its column unless the line's subject, or the label
  // itself, already does ("Notice period · 4 business days"; "Common Stock ·
  // Authorised 800,000,000"; "Materiality qualifiers disregarded", never
  // "Materiality Qualifiers Disregarded Materiality qualifiers disregarded").
  const detailLabel = (line, cell) => {
    const header = headerOf.get(cell.column_id) || '';
    const label = Array.isArray(cell.values) && cell.values.length > 1 ? cell.values.map((value) => value.label).join(', ') : cell.label;
    const subjectNames = header && String(line.subject || '').toLowerCase().includes(header.toLowerCase());
    const labelNames = header && String(label || '').toLowerCase().includes(header.toLowerCase());
    return subjectNames || labelNames || !header ? label : `${header} ${label}`;
  };
  // Ben, 2026-11-01, on the intervening-event table: "'Intervening event
  // mechanics' has 5 business days in the column with the matching period.
  // Why isn't that in the next column? You get it right in 'superior
  // proposal.'" A folded value takes the line's first empty content cell
  // (the Summary column of that row) when there is one; it trails the
  // subject only when every content cell of the line is filled.
  const contentColumns = (table.columns || []).filter((column) => !fold.has(column.column_id) && !empty.has(column.column_id) && column.display !== 'fact_text' && renderOf.get(column.column_id) === 'vocabulary');
  // Ben, 2026-11-01, round 2: "In notice, why is the notice period 24 hours
  // in the left-hand column? Why isn't it in the answer on the right?" When
  // every content cell of the line is filled, the folded value joins the
  // line's first filled answer cell as a further reading (stacked under
  // it), and trails the subject only when the line has no answer cell.
  const answerColumns = (table.columns || []).filter((column) => !fold.has(column.column_id) && !empty.has(column.column_id) && column.display !== 'fact_text' && ['vocabulary', 'value'].includes(renderOf.get(column.column_id)));
  const foldLine = (line) => {
    const folded = (line.cells || []).filter((cell) => fold.has(cell.column_id) && filled(cell));
    let cells = (line.cells || []).filter((cell) => !fold.has(cell.column_id) && !empty.has(cell.column_id));
    const details = [];
    for (const cell of folded) {
      const home = contentColumns.find((column) => { const current = cells.find((candidate) => candidate.column_id === column.column_id); return current && current.kind === 'dash'; });
      if (home) {
        cells = cells.map((candidate) => (candidate.column_id === home.column_id
          ? { ...cell, column_id: home.column_id, kind: cell.kind === 'pill' ? 'pill' : 'value', folded_from_column: cell.column_id, folded_header: headerOf.get(cell.column_id) || null }
          : candidate));
        continue;
      }
      const answer = answerColumns.find((column) => { const current = cells.find((candidate) => candidate.column_id === column.column_id); return current && filled(current); });
      if (answer) {
        // The reading names its column under it ("800,000,000" / Authorised)
        // unless the subject or the words name it already.
        const header = headerOf.get(cell.column_id) || null;
        const named = header && (String(line.subject || '').toLowerCase().includes(header.toLowerCase()) || String(cell.label || '').toLowerCase().includes(header.toLowerCase()));
        const folded = Array.isArray(cell.values) && cell.values.length > 1 ? cell.values : [cell];
        const readings = folded.map((value) => ({ ...cellValue(value), kind: value.kind === 'pill' ? 'pill' : 'value', folded_from_column: cell.column_id, folded_header: header, ...(header && !named ? { qualifier: header } : {}) }));
        cells = cells.map((candidate) => {
          if (candidate.column_id !== answer.column_id) return candidate;
          const values = Array.isArray(candidate.values) && candidate.values.length > 1 ? candidate.values : [cellValue(candidate)];
          return { ...candidate, values: [...values, ...readings], component_ids: [...new Set([...(candidate.component_ids || []), ...(cell.component_ids || [])])], fact_ids: [...new Set([...(candidate.fact_ids || []), ...(cell.fact_ids || [])])] };
        });
        continue;
      }
      details.push({ column_id: cell.column_id, header: headerOf.get(cell.column_id) || null, label: detailLabel(line, cell), cell });
    }
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

function wordsOfCell(cell, componentTextById) {
  const ids = Array.isArray(cell?.component_ids) ? cell.component_ids : [];
  const text = ids.map((id) => componentTextById.get(id)).filter(Boolean).map((item) => item.trim()).join(' ');
  return text ? shortenText(hidePageFooters(text), WORDS_MAX_LENGTH) : null;
}

function attachWords(table, componentTextById) {
  if (!componentTextById || componentTextById.size === 0) return table;
  const wordsOf = (cell) => wordsOfCell(cell, componentTextById);
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

// Ben, 2026-11-01, on the as-drafted column, table after table:
// "Capitalization: I don't like this 'as drafted' column. I'm not really
// sure why that's there. Isn't that the whole thing when you click on a
// row?"; "'Material contracts': again, I don't know why you've got 'as
// drafted' here. If you want to have specifics, I get it, but I wouldn't in
// this one ... Maybe a little toggle which says 'show specifics.' Then I
// wouldn't have both."; "'Interim operating covenants' ... I don't like the
// 'as drafted' on the summary. Just have one, right? Not both."; "'Negative
// covenant': same position on the 'as drafted.' Here, it's often a bit more
// important to see it, but again, do the same thing and say 'see more
// detail.'"; "'No short call mechanics': again, I don't know why we have the
// 'as drafted' column, and that sort of goes all the way through."
// The rule, for every table: a fact_text column is `specifics` (rendered
// only behind the page's "Show specifics" control) when any other column of
// the table has a filled cell; when it is the table's only content it stays
// and is headed "Summary". A table marked summary_only shows the summary
// alone ("[Registration] rights. Need a summary here. You don't need it as
// drafted.").
function visibleSummaryColumns(table) {
  const columns = table.columns || [];
  const lines = (table.rows || []).flatMap((row) => [row, ...(row.sub_rows || [])]);
  const filled = (cell) => cell && cell.kind !== 'dash' && (Array.isArray(cell.values) ? cell.values.length > 0 : !!cell.label);
  const anyFilled = (columnId) => lines.some((line) => filled((line.cells || []).find((cell) => cell.column_id === columnId)));
  const othersFilled = columns.some((column) => column.display !== 'fact_text' && anyFilled(column.column_id));
  return columns.filter((column) => column.display === 'fact_text' && (table.summary_only || !othersFilled));
}

// A summary_only table keeps its coded columns in the data but shows them
// only behind "Show specifics"; the summary is what the page shows.
function markSummaryOnly(table) {
  if (!table.summary_only || !Array.isArray(table.columns)) return table;
  return { ...table, columns: table.columns.map((column) => (column.display === 'fact_text' ? column : { ...column, specifics: true })) };
}

function markSpecifics(table) {
  if (!Array.isArray(table.columns) || !table.columns.some((column) => column.display === 'fact_text')) return table;
  const visible = new Set(visibleSummaryColumns(table).map((column) => column.column_id));
  return {
    ...table,
    columns: table.columns.map((column) => {
      if (column.display !== 'fact_text') return column;
      return visible.has(column.column_id)
        ? { ...column, header: 'Summary', specifics: undefined }
        : { ...column, specifics: true };
    }),
  };
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
  refineByWords(fact, result, table, tableShapes);
  addPeriodSuffixFromWords(fact, result, table);
  return result;
}

// Ben, 2026-11-01: "Same on the data room: it should say 'immediately.'";
// "In regulatory litigation, you say 'must defend,' but it also says
// 'contest and resist.' I think that includes appeals." A column's
// refine_by_words rules sharpen a coded cell by the fact's own words: a
// cell coded `code` on a fact whose words match `when` becomes `to`, with
// the matched words cited. The stored fact is untouched.
function refineByWords(fact, cells, table, tableShapes) {
  for (const column of table.columns || []) {
    const rules = Array.isArray(column.refine_by_words) ? column.refine_by_words : [];
    const cell = cells[column.column_id];
    if (rules.length === 0 || !cell || cell.kind !== 'pill' || !cell.code) continue;
    for (const rule of rules) {
      if (cell.code !== rule.code) continue;
      let pattern;
      try { pattern = new RegExp(rule.when, 'i'); } catch { continue; }
      const matched = anyWords(ownComponentsDeep(fact), pattern);
      if (matched.length === 0 && !pattern.test(String(fact.statement || ''))) continue;
      const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function' ? factConclusions.columnVocabulary(column, tableShapes) : (column.vocabulary || []);
      const entry = vocabulary.find((item) => item.code === rule.to);
      if (!entry) continue;
      cells[column.column_id] = {
        ...cell, code: rule.to, label: entry.label, tone: entry.tone || cell.tone,
        component_ids: [...new Set([...(cell.component_ids || []), ...matched.map((component) => component.component_id)])],
        refined_from: rule.code, derived: 'refined_by_words',
      };
      break;
    }
  }
}

// Ben, 2026-11-01: "return or destruction information, it should say
// 'required' and the time period." A table with period_suffix_from_words
// and no period column says the stated period after the coded answer
// ("Required, within two (2) business days"), read from the fact's own
// words.
const PERIOD_WORDS = /\b((?:within|no later than|not later than|not more than)\s+(?:(?:[a-z]+(?:-[a-z]+)?|\d+)\s+)?(?:\(\d+\)\s*)?(?:business\s+|calendar\s+|trading\s+)?(?:days?|hours?|weeks?|months?|years?))\b/i;

function addPeriodSuffixFromWords(fact, cells, table) {
  const spec = table.period_suffix_from_words;
  if (!spec) return;
  const cell = cells[spec.column_id];
  if (!cell || cell.kind !== 'pill' || cell.suffix) return;
  if (Array.isArray(spec.codes) && !spec.codes.includes(cell.code)) return;
  // A period the fact's own period cell carries (a re-extraction against
  // the shape's period column) is that cell's, not a suffix as well.
  const periodColumn = (table.columns || []).find((column) => column.render === 'value' && column.value_kind === 'PERIOD');
  if (periodColumn && cells[periodColumn.column_id] && cells[periodColumn.column_id].kind !== 'dash') return;
  const component = ownComponentsDeep(fact).find((candidate) => PERIOD_WORDS.test(String(candidate.text || '')));
  const match = PERIOD_WORDS.exec(component ? String(component.text) : String(fact.statement || ''));
  if (!match) return;
  cells[spec.column_id] = { ...cell, suffix: { label: `, ${match[1].toLowerCase()}`, column_id: null, from_words: true, component_ids: component ? [component.component_id] : [], fact_ids: [factIdOf(fact)] } };
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
    ...(Array.isArray(cell.refs) ? { refs: [...cell.refs] } : {}),
    ...(cell.suffix ? { suffix: cell.suffix } : {}),
    ...(cell.value ? { value: cell.value } : {}),
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
    if (Array.isArray(incoming.refs)) sameReading.refs = [...new Set([...(sameReading.refs || []), ...incoming.refs])];
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
      refs: sectionNumbersIn(hit.component.text),
    };
    if (!incoming.label) continue;
    derived = derived ? mergeCellInto(derived, incoming) : incoming;
  }
  if (column.bring_down_default) return deriveBringDownForRow({ row, column, sources, tableShapes, facts }) || resolveBringDownConflict(derived);
  return column.vocabulary_ref === 'BRING_DOWN_STANDARD' ? resolveBringDownConflict(derived) : derived;
}

// Round 4 (Ben, 2026-11-01): "only a small number of reps come down de
// minimis or material, the vast majority are MAE and they're not subdivided
// within the reps except in very special situations. For the detailed view,
// we should retain the precision as much as we can (but sometimes a
// sentence is brought down to X but other are brought to Y)." Before: a
// reference to "3.1(a)" named every rep of an agreement whose reps are one
// section (QXO: twenty-five reps in 3.1 (a) to (s)), so every rep took every
// tier, and the general "all other representations" tier reached none.
// Now, per rep row:
//   - the rep's own section is the section most of its facts sit in;
//   - a tier names the rep when its reference names that section (whole),
//     or a part of it ("3.3(a)" of 3.3: partial); where several reps share
//     one section, a subsection reference names the rep whose subject
//     shares a word with the subsection's heading ("3.1(b) (Capital
//     Structure)" is Capitalization), headings learned from every
//     reference of the side's tiers;
//   - the general tier is the side's tier whose references are none or an
//     Article only ("all other representations"), else the whole tiers;
//   - the cell is the general tier, and with partial tiers it reads
//     "Generally X; 3.3(a): Y", every reading kept under `many`.
const ARTICLE_ONLY = /^\s*(?:the\s+)?(?:Article\s+[IVXLC0-9]+|this\s+Agreement)\b[^0-9]*$/i;
const SIDE_STOPWORDS = new Set(['and', 'or', 'of', 'the', 'other', 'certain', 'its', 'with', 'for', 'to', 'in', 'on', 'by', 'company', 'parent', 'events', 'matters']);

function sectionOfReference(text) {
  const plain = String(text || '').replace(/\bSections?\s+/gi, '');
  const match = plain.match(/^\s*(\d+\.\d+(?:\([a-z0-9]+\))*)/i);
  return match ? match[1].toLowerCase() : null;
}

function referenceSections(text) {
  // "Sections 3.3(b), (c) and (e)" names 3.3(b), 3.3(c) and 3.3(e).
  const out = [];
  const raw = String(text || '');
  const re = /(\d+\.\d+)((?:\([a-z0-9]+\))*)((?:\s*(?:,|and|or)\s*\([a-z0-9]+\))*)/gi;
  let match;
  while ((match = re.exec(raw))) {
    out.push(`${match[1]}${match[2]}`.toLowerCase());
    for (const extra of (match[3].match(/\([a-z0-9]+\)/gi) || [])) {
      const parent = match[2] ? match[2].replace(/\([a-z0-9]+\)$/i, '') : '';
      out.push(`${match[1]}${parent}${extra}`.toLowerCase());
    }
  }
  return [...new Set(out)];
}

function headingWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((word) => word.length > 3 && !SIDE_STOPWORDS.has(word)).map((word) => word.slice(0, 6));
}

function deriveBringDownForRow({ row, column, sources, tableShapes }) {
  const sideTable = column.bring_down_default.side_table;
  // Only the accuracy-of-representations tiers; the covenant performance
  // condition ("in all material respects", no references) is not a
  // bring-down of any rep.
  const tiers = (sources || []).filter((source) => source.conclusions?.table_key === sideTable && /representation/i.test(String(source.conclusions?.row_label || '')))
    .map((source) => {
      const referenceComponents = walkComponents(source.components).filter((component) => component.kind === 'CROSS_REFERENCE');
      return { source, cell: source.conclusions.cells.find((candidate) => candidate.column_id === column.derived.from_column), references: referenceComponents.map((component) => component.text || ''), referenceComponents };
    })
    .filter((tier) => tier.cell && tier.cell.code);
  if (tiers.length === 0) return null;
  const sections = (row.backing_facts || []).map((backing) => String(backing.section_reference || '').toLowerCase()).filter((ref) => /^\d+\.\d+/.test(ref));
  if (sections.length === 0) return null;
  const counts = new Map();
  for (const ref of sections) counts.set(ref, (counts.get(ref) || 0) + 1);
  const rowSection = [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
  // Headings of subsections, from every reference that carries one.
  const headings = new Map();
  for (const tier of tiers) for (const text of tier.references) {
    const section = sectionOfReference(text);
    const heading = (String(text).match(/\(([A-Z][^()]{3,})\)\s*$/) || [])[1];
    if (section && heading) headings.set(section, heading);
  }
  const subjectWords = new Set(headingWords(row.subject));
  const headingFor = (section) => {
    for (let current = section; current; current = current.includes('(') ? current.replace(/\([a-z0-9]+\)$/i, '') : null) {
      if (headings.has(current)) return headings.get(current);
    }
    return null;
  };
  const vocabulary = (tier) => {
    const sourceTable = resolveTableForFact(tier.source, tableShapes);
    const sourceColumn = sourceTable?.table?.columns?.find((candidate) => candidate.column_id === column.derived.from_column);
    const list = sourceColumn && factConclusions && typeof factConclusions.columnVocabulary === 'function' ? factConclusions.columnVocabulary(sourceColumn, tableShapes) : [];
    return list.find((item) => item.code === tier.cell.code)?.label || tier.cell.code;
  };
  const general = [];
  const whole = [];
  const partial = [];
  for (const tier of tiers) {
    const named = tier.references.flatMap(referenceSections);
    // The general tier: no references, an Article only, or a tier whose
    // words make it the rest ("the representations of the Company, other
    // than those in the second and third tiers"; "all other
    // representations"), its references then being exclusions.
    const restWords = /,\s*other than (?:those|the representations)|\b(?:all|any)\s+other\s+representations|\bother\s+(?:Company|Parent|Buyer)\s+representations/i.test(String(tier.source.statement || ''));
    const articleOnly = restWords || tier.references.length === 0 || tier.references.every((text) => ARTICLE_ONLY.test(text) || referenceSections(text).length === 0 && !/\(/.test(text) && /article/i.test(text));
    const headingOnly = tier.references.length > 0 && named.length === 0 && !articleOnly;
    if (articleOnly) { general.push(tier); continue; }
    let parts = [];
    let isWhole = false;
    if (headingOnly) {
      // References by heading alone ("Capital Structure").
      if (tier.references.some((text) => headingWords(text).some((word) => subjectWords.has(word)))) isWhole = true;
    }
    for (const ref of named) {
      if (ref === rowSection || rowSection.startsWith(`${ref}(`)) { isWhole = true; continue; }
      if (ref.startsWith(`${rowSection}(`)) {
        // A subsection of the rep's section: where reps share the section,
        // it names this rep only if its heading names this rep.
        const shared = (row.shared_section_count || 0) > 1;
        const heading = headingFor(ref);
        if (shared) {
          if (heading && headingWords(heading).some((word) => subjectWords.has(word))) {
            const depth = (ref.match(/\(/g) || []).length;
            const headingDepth = [...headings.keys()].filter((key) => ref.startsWith(key)).map((key) => (key.match(/\(/g) || []).length).sort((left, right) => right - left)[0] || depth;
            if (depth <= headingDepth) isWhole = true; else parts.push(ref);
          }
        } else {
          parts.push(ref);
        }
      }
    }
    if (isWhole) whole.push(tier);
    else if (parts.length) partial.push({ tier, parts: [...new Set(parts)] });
  }
  // A derived cell cites the tier's standard and the references that name
  // this rep (or, for the general tier, all of them).
  const citing = (tier) => (tier.referenceComponents || []).filter((component) => {
    const named = referenceSections(component.text || '');
    return named.length === 0 || named.some((ref) => ref === rowSection || rowSection.startsWith(`${ref}(`) || ref.startsWith(`${rowSection}(`));
  }).map((component) => component.component_id);
  const make = (tier, extra = {}) => ({
    column_id: column.column_id, kind: 'pill', label: vocabulary(tier), code: tier.cell.code, tone: TONE_BY_RENDER[column.render] || 'neutral',
    component_ids: [...new Set([...citing(tier), ...(tier.cell.component_ids || [])])], fact_ids: [factIdOf(tier.source)], source_order: Number.POSITIVE_INFINITY, ...extra,
  });
  // The general standard: the whole tiers (both readings of a double
  // materiality scrape, resolved as before), else the "all other" tier.
  let base = null;
  for (const tier of whole.length ? whole : general) {
    const cell = make(tier, { refs: tier.references.flatMap(referenceSections) });
    base = base ? mergeCellInto(base, cell) : cell;
  }
  base = resolveBringDownConflict(base);
  if (!base) return null;
  if (partial.length === 0) return base;
  const portions = partial.map(({ tier, parts }) => make(tier, { portion: parts }));
  const baseLabel = Array.isArray(base.values) && base.values.length > 1 ? base.values.map((value) => lowerFirst(value.label)).join(' / ') : lowerFirst(base.label);
  const label = `Generally ${baseLabel}; ${portions.map((portion) => `${portion.portion.join(', ')}: ${lowerFirst(portion.label)}`).join('; ')}`;
  return {
    ...base, kind: 'text', label, generally: base.code || null, many: [...(Array.isArray(base.values) && base.values.length > 1 ? base.values : [cellValue(base)]), ...portions],
    values: undefined,
    component_ids: [...new Set([...(base.component_ids || []), ...portions.flatMap((portion) => portion.component_ids)])],
    fact_ids: [...new Set([...(base.fact_ids || []), ...portions.flatMap((portion) => portion.fact_ids)])],
  };
}

// Ben, 2026-11-01, on the representations table: "If you look at authority
// and enforceability, you hit more detail. You have two bring-downs: 'true
// and all material respect' and 'true and all respect.' I don't think it
// can be both. That's kind of confusing to me". The conditions clause reads
// "true and correct in all material respects"; one condition fact codes the
// "true and correct" words as TRUE_IN_ALL_RESPECTS and another the "in all
// material respects" words as the qualified standard, both cross-referring
// to the same section. The qualifier governs: when every section the
// unqualified reading cites is also cited by a qualified reading, the
// unqualified reading is dropped (its codes kept on the cell as
// `superseded`). Where it cites a section of its own (Capitalization's
// 3.3(d) "true and correct" beside 3.3(b), (c) and (e) "in all material
// respects"), both tiers are real and both stay.
const UNQUALIFIED_BRING_DOWN = 'TRUE_IN_ALL_RESPECTS';

function sectionNumbersIn(text) {
  const matches = String(text || '').match(/\b\d+\.\d+(?:\([a-z0-9]+\))*/gi) || [];
  return [...new Set(matches.map((match) => match.toLowerCase()))];
}

function resolveBringDownConflict(cell) {
  if (!cell || !Array.isArray(cell.values) || cell.values.length < 2) return cell;
  const unqualified = cell.values.find((value) => value.code === UNQUALIFIED_BRING_DOWN);
  if (!unqualified) return cell;
  const others = cell.values.filter((value) => value !== unqualified);
  const covered = new Set(others.flatMap((value) => value.refs || []));
  const own = unqualified.refs || [];
  if (own.length === 0 || own.some((ref) => !covered.has(ref))) return cell;
  const values = others;
  const first = values[0];
  return {
    ...cell,
    label: first.label,
    ...(first.code ? { code: first.code } : { code: undefined }),
    component_ids: [...new Set(values.flatMap((value) => value.component_ids))],
    fact_ids: [...new Set(values.flatMap((value) => value.fact_ids))],
    ...(values.length > 1 ? { values } : { values: undefined }),
    superseded: [UNQUALIFIED_BRING_DOWN],
  };
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
    // Ben, 2026-11-01: a renamed row keeps its stored readouts (row_aliases:
    // "Remedy commitment (divestiture cap)" is "Remedies cap"), and a fact
    // whose own words a table's route_by_words names is not a row of that
    // table but one of its Other provisions ("You have this control of
    // operations by the company ... It's boilerplate… so it's in the wrong
    // place.").
    if (hasReadout(fact)) {
      const home = findTableByKey(tableShapes, fact.conclusions.table_key)?.table || null;
      const alias = home?.row_aliases?.[fact.conclusions.row_label];
      if (alias) fact = { ...fact, conclusions: { ...fact.conclusions, row_label: alias }, row_alias_from: fact.conclusions.row_label };
      const route = (home?.route_by_words || []).find((rule) => { try { return anyWords(ownComponentsDeep(fact), new RegExp(rule.when, 'i')).length > 0 || new RegExp(rule.when, 'i').test(String(fact.statement || '')); } catch { return false; } });
      if (route && route.to === 'other_provisions') fact = { ...fact, route_other_provisions: true, page_rule: 'route_by_words' };
    }
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

// Ben, 2026-11-01, on the consideration grid: "why is consideration type
// empty? We know it's cash below. Phrase it right." When no fact coded the
// type, the page reads it from the per-share forms below (and from the
// election options, where the deal has any): one form is "All cash" or
// "All stock"; cash with Parent stock is a fixed mix; a CVR beside cash or
// stock is the CVR code; any election row or option is "Mixed election".
// The cell cites every form cell it read and is marked derived
// ('from_components'). A cash-in-lieu-of-fractional-shares row is payment
// mechanics, not a form of the package, and is not counted.
const TYPE_FROM_FORMS = Object.freeze([
  { forms: ['CASH'], code: 'ALL_CASH' },
  { forms: ['PARENT_STOCK'], code: 'ALL_STOCK' },
  { forms: ['CASH', 'PARENT_STOCK'], code: 'CASH_AND_STOCK_FIXED' },
  { forms: ['CASH', 'CVR'], code: 'CASH_AND_CVR' },
  { forms: ['PARENT_STOCK', 'CVR'], code: 'STOCK_AND_CVR' },
  { forms: ['CASH', 'PARENT_STOCK', 'CVR'], code: 'CASH_AND_STOCK_FIXED' },
]);
const ELECTION_FORMS = new Set(['CASH_ELECTION', 'STOCK_ELECTION', 'MIXED_ELECTION']);
const ELECTION_TYPES = new Set(['MIXED_ELECTION', 'ALL_CASH_ELECTION', 'ALL_STOCK_ELECTION']);

function deriveConsiderationType({ tableShapes, buckets, ensureBucket }) {
  for (const { section, table } of sectionCandidateTables(tableShapes)) {
    const spec = table.type_from_components;
    if (!spec) continue;
    const column = (table.columns || []).find((candidate) => candidate.column_id === spec.column_id);
    if (!column) continue;
    const components = buckets.get(spec.components_table_key);
    const rows = components ? components.rows.filter((row) => !row.absent && !/in lieu of fractional/i.test(String(row.subject || ''))) : [];
    const formCells = rows.map((row) => row.cellsByColumn.get(spec.form_column)).filter((cell) => cell && cell.kind !== 'dash' && cell.code);
    const options = buckets.get(spec.options_table_key);
    const hasOptions = !!options && options.rows.some((row) => !row.absent);
    if (formCells.length === 0 && !hasOptions) continue;
    const forms = new Set(formCells.map((cell) => cell.code));
    const election = hasOptions || [...forms].some((code) => ELECTION_FORMS.has(code));
    const plain = [...forms].filter((code) => !ELECTION_FORMS.has(code)).sort();
    const rule = election ? { code: 'MIXED_ELECTION' } : TYPE_FROM_FORMS.find((candidate) => candidate.forms.length === plain.length && candidate.forms.every((code) => forms.has(code)));
    if (!rule) continue;
    const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function' ? factConclusions.columnVocabulary(column, tableShapes) : (column.vocabulary || []);
    const entry = vocabulary.find((item) => item.code === rule.code);
    if (!entry) continue;
    const bucket = ensureBucket(section, table);
    const subject = table.subject_label || 'The deal';
    let row = bucket.rows.find((candidate) => candidate.subject === subject);
    if (!row) { row = { subject, cellsByColumn: new Map(), backing_facts: [], sub_rows: [] }; bucket.rows.push(row); }
    const existing = row.cellsByColumn.get(spec.column_id);
    if (existing && existing.kind !== 'dash') continue;
    const cited = formCells.length ? formCells : options.rows.flatMap((optionRow) => [...optionRow.cellsByColumn.values()]).filter((cell) => cell && cell.kind !== 'dash');
    row.cellsByColumn.set(spec.column_id, {
      column_id: spec.column_id, kind: 'pill', label: entry.label, code: rule.code, tone: TONE_BY_RENDER[column.render] || 'neutral',
      component_ids: [...new Set(cited.flatMap((cell) => cell.component_ids || []))],
      fact_ids: [...new Set(cited.flatMap((cell) => cell.fact_ids || []))],
      derived: 'from_components',
    });
    for (const cell of cited) for (const factId of cell.fact_ids || []) if (!row.backing_facts.some((backing) => backing.fact_id === factId)) row.backing_facts.push({ fact_id: factId, section_reference: null, structure_node_id: null });
  }
}

// Ben, 2026-11-01, on the Skechers per-share table: "I think you have to
// make it so clear it's an election. You do say 'mixed election.' In
// 'consideration per share,' I think it needs to be really clear: there's
// an election. It's this thing or it's this thing. I'm even thinking maybe
// put 'consideration type: mixed election' immediately below it." On an
// election deal the per-share table carries a lead note naming the type and
// each row names the option it belongs to (election_group) so the page can
// set the rows out option by option. The option is read from the row's
// defined term or subject against the options table's own row words
// ("Mixed Election Cash Consideration" is the mixed option, "Cash Election
// Consideration" the cash option); the option's cash and ratio come from
// the options table where it has a row.
function electionGroupsFor({ tableShapes, buckets }) {
  for (const { table } of sectionCandidateTables(tableShapes)) {
    if (!table.election_note) continue;
    const bucket = buckets.get(table.table_key);
    if (!bucket) continue;
    const typeTable = sectionCandidateTables(tableShapes).find((candidate) => candidate.table.type_from_components)?.table;
    const typeBucket = typeTable ? buckets.get(typeTable.table_key) : null;
    const typeCell = typeBucket ? typeBucket.rows[0]?.cellsByColumn.get(typeTable.type_from_components.column_id) : null;
    const optionsTable = typeTable ? sectionCandidateTables(tableShapes).find((candidate) => candidate.table.table_key === typeTable.type_from_components.options_table_key)?.table : null;
    const options = optionsTable ? buckets.get(optionsTable.table_key) : null;
    const optionRows = options ? options.rows.filter((row) => !row.absent) : [];
    const election = (typeCell && typeCell.kind !== 'dash' && ELECTION_TYPES.has(typeCell.code)) || optionRows.length > 0;
    if (!election) continue;
    bucket.lead_note = `Consideration type: ${typeCell && typeCell.kind !== 'dash' ? typeCell.label : 'Election'}. Each share receives, at the holder's election, one of the options below.`;
    const spec = optionsTable?.election_options;
    const rules = spec ? Object.entries(spec.rows).map(([label, rule]) => ({ label, code: rule.form_code || null, words: new RegExp(`\\b${label.split(' ')[0]}\\s+election\\b`, 'i') })) : [];
    const valueOf = (optionRow, columnId) => { const cell = optionRow && columnId ? optionRow.cellsByColumn.get(columnId) : null; return cell && cell.kind !== 'dash' ? cell.label : null; };
    for (const row of bucket.rows) {
      if (row.absent) continue;
      const note = [...row.cellsByColumn.values()].filter((cell) => cell && cell.kind !== 'dash' && cell.label).map((cell) => cell.label).join(' ');
      const formCode = row.cellsByColumn.get(table.row_from_column || 'form')?.code || null;
      const rule = rules.find((candidate) => candidate.code && candidate.code === formCode) || rules.find((candidate) => candidate.words.test(`${row.subject} ${note}`));
      if (!rule) continue;
      const optionRow = optionRows.find((candidate) => candidate.subject === rule.label) || null;
      const cash = spec ? valueOf(optionRow, spec.cash_column) : null;
      const ratio = spec ? valueOf(optionRow, spec.ratio_column) : null;
      const parts = [cash ? `${cash} in cash` : null, ratio ? `${ratio} Parent shares` : null].filter(Boolean);
      row.election_group = parts.length ? `${rule.label}: ${parts.join(' plus ')} per share` : rule.label;
    }
  }
}

// Ben, 2026-11-01, round 2: "As I said before, I'd rather have
// 'consideration type' and then, immediately under it, have the components
// laid out. I think that would be much better, maybe as a subrow or
// something"; on Skechers: "think visually about how to make this mix
// selection, cast selection thing clearer. There are two options." With
// embed_components on the type rule, the per-share rows become the type
// cell's options: on an election, one option per election group ("Mixed
// election: $57 in cash and one Parent Unit per share of Company Common
// Stock"), each component's amount and form joined with "and"; otherwise
// one line per component ("Cash: $135.11 per share of Company Common
// Stock"). The per-share and election-options tables are then marked
// embedded (shown behind "Show specifics"); their data is unchanged.
function embedConsiderationOptions({ tableShapes, buckets, componentTextById }) {
  for (const { table } of sectionCandidateTables(tableShapes)) {
    const spec = table.type_from_components;
    if (!spec || !spec.embed_components) continue;
    const typeBucket = buckets.get(table.table_key);
    const row = typeBucket ? typeBucket.rows[0] : null;
    const typeCell = row ? row.cellsByColumn.get(spec.column_id) : null;
    if (!typeCell || typeCell.kind === 'dash') continue;
    const components = buckets.get(spec.components_table_key);
    const componentsTable = components ? components.table : null;
    const rows = components ? components.rows.filter((candidate) => !candidate.absent && !/in lieu of fractional/i.test(String(candidate.subject || ''))) : [];
    if (rows.length === 0) continue;
    const formColumn = componentsTable.row_from_column || spec.form_column;
    const perColumn = (componentsTable.columns || []).find((column) => column.display === 'suffix_of');
    const labelOf = (cell) => (cell && cell.kind !== 'dash' ? (Array.isArray(cell.values) && cell.values.length > 1 ? cell.values.map((value) => value.label).join(' or ') : cell.label) : null);
    const partOf = (candidate) => {
      const form = candidate.cellsByColumn.get(formColumn);
      const amountCell = candidate.cellsByColumn.get(perColumn?.suffix_of || 'amount');
      const amount = labelOf(amountCell) || (form && form.kind !== 'dash' ? wordsOfCell(form, componentTextById) : null);
      const code = form && form.kind !== 'dash' ? form.code : null;
      // The form is said after a number ("$57 in cash", "0.5 shares of
      // Parent stock"), never after words that name it already ("one
      // Parent Unit").
      const numeric = !!amount && /^\$?\d/.test(amount.trim());
      const noun = !numeric ? '' : (/CASH/.test(code || '') && !/\bcash\b/i.test(amount) ? 'in cash' : (/STOCK/.test(code || '') ? 'shares of Parent stock' : (code === 'CVR' ? 'as a CVR' : '')));
      const text = amount ? [amount, noun].filter(Boolean).join(' ') : (labelOf(form) || candidate.subject);
      const per = lowerFirst(labelOf(candidate.cellsByColumn.get(perColumn?.column_id)) || '');
      const cells = [form, amountCell, candidate.cellsByColumn.get(perColumn?.column_id)].filter((cell) => cell && cell.kind !== 'dash');
      return { text, amount: amount || text, per, component_ids: [...new Set(cells.flatMap((cell) => cell.component_ids || []))], fact_ids: [...new Set(cells.flatMap((cell) => cell.fact_ids || []))], fact_id: candidate.backing_facts[0]?.fact_id || null };
    };
    const groups = [];
    for (const candidate of rows) {
      const label = candidate.election_group ? String(candidate.election_group).split(':')[0].trim() : null;
      let group = groups.find((entry) => entry.label === label);
      if (!group) { group = { label, parts: [] }; groups.push(group); }
      group.parts.push(partOf(candidate));
    }
    // An election whose per-share rows carry no option words (QXO: "the
    // applicable Stock Consideration or Cash Consideration", the rows Cash
    // and Acquirer stock) is one option per form.
    if (!groups.some((group) => group.label) && ELECTION_TYPES.has(typeCell.code) && rows.length > 1) {
      const OPTION_BY_FORM = { CASH: 'Cash election', PARENT_STOCK: 'Stock election', CASH_ELECTION: 'Cash election', STOCK_ELECTION: 'Stock election', MIXED_ELECTION: 'Mixed election' };
      groups.splice(0, groups.length, ...rows.map((candidate) => {
        const form = candidate.cellsByColumn.get(formColumn);
        const code = form && form.kind !== 'dash' ? form.code : null;
        return { label: OPTION_BY_FORM[code] || `${labelOf(form) || candidate.subject} election`, parts: [partOf(candidate)] };
      }));
    }
    const election = groups.some((group) => group.label);
    // A component of no option on an election deal (a CVR beside the
    // options) is part of every option.
    if (election && groups.some((group) => !group.label)) {
      const shared = groups.filter((group) => !group.label).flatMap((group) => group.parts);
      groups.splice(0, groups.length, ...groups.filter((group) => group.label).map((group) => ({ ...group, parts: [...group.parts, ...shared] })));
    }
    const options = groups.map((group) => {
      const per = group.parts.map((part) => part.per).find(Boolean) || '';
      const amounts = group.parts.map((part) => part.text);
      const joined = amounts.length > 1 ? `${amounts.slice(0, -1).join(', ')} and ${amounts[amounts.length - 1]}` : amounts[0];
      return {
        label: group.label || null,
        text: per ? `${joined}, ${per}` : joined,
        component_ids: [...new Set(group.parts.flatMap((part) => part.component_ids))],
        fact_ids: [...new Set(group.parts.flatMap((part) => part.fact_ids))],
        fact_id: group.parts.map((part) => part.fact_id).find(Boolean) || null,
      };
    });
    if (!election) {
      // A plain package: one line per component, named by its form.
      const named = rows.map((candidate) => {
        const part = partOf(candidate);
        const code = candidate.cellsByColumn.get(formColumn)?.code || '';
        const said = /STOCK/.test(code) ? part.text : part.amount;
        return { label: labelOf(candidate.cellsByColumn.get(formColumn)) || candidate.subject, text: part.per ? `${said} ${part.per}` : said, component_ids: part.component_ids, fact_ids: part.fact_ids, fact_id: part.fact_id };
      });
      row.cellsByColumn.set(spec.column_id, { ...typeCell, options: named, options_kind: 'components' });
    } else {
      row.cellsByColumn.set(spec.column_id, { ...typeCell, options, options_kind: 'election' });
    }
    components.embedded_in = table.table_key;
    const optionsBucket = buckets.get(spec.options_table_key);
    if (optionsBucket) optionsBucket.embedded_in = table.table_key;
  }
}

// Ben, 2026-11-01, round 2: "In subsequent match period, you can't have 2
// business days and 3 business days… look at why you have an inconsistent
// thing there." (the two readings are two facts: three business days for a
// new proposal, two after amended materials) and "'shall cause' and…
// 'shall instruct.' Why do we get two different things? It is because
// there are different obligations, which should be clear." A cell of
// several readings read from different facts says, under each reading,
// what that fact says (the fact's summary, shortened): on every value
// column, and on the vocabulary columns of a table marked qualify_readings.
function qualifyReadings(table, shapeTable, factsById) {
  if (table.layout !== 'rows' || !Array.isArray(table.rows)) return table;
  const renderOf = new Map((shapeTable.columns || []).map((column) => [column.column_id, column.render]));
  const eligible = (columnId) => renderOf.get(columnId) === 'value' || (shapeTable.qualify_readings && renderOf.get(columnId) === 'vocabulary');
  const summaryOf = (factId) => {
    const fact = factsById.get(factId);
    if (!fact) return null;
    const summary = typeof fact.headline?.summary === 'string' && fact.headline.summary.trim() ? fact.headline.summary.trim() : factSummaryText(fact);
    return summary ? shortenText(summary, 90) : null;
  };
  const mapLine = (line) => ({
    ...line,
    cells: (line.cells || []).map((cell) => {
      if (!eligible(cell.column_id) || !Array.isArray(cell.values) || cell.values.length < 2) return cell;
      // A reading a folded column brought in is told apart by its own name
      // (applyColumnRules); the others are judged on their own.
      const own = cell.values.filter((value) => !value.folded_from_column);
      // Each reading its own fact's, and a few of them: a cell whose
      // readings share facts, or a list of five or more (the prohibited
      // acts of a no-shop clause), is a list, not several obligations.
      const firstFacts = own.map((value) => (value.fact_ids || [])[0] || null);
      if (own.length < 2 || own.length > 4 || firstFacts.some((factId) => !factId) || new Set(firstFacts).size !== own.length) return cell;
      return { ...cell, values: cell.values.map((value) => { if (value.folded_from_column) return value; const summary = summaryOf((value.fact_ids || [])[0]); return summary ? { ...value, qualifier: summary } : value; }) };
    }),
  });
  return { ...table, rows: table.rows.map((row) => ({ ...mapLine(row), ...(row.sub_rows ? { sub_rows: row.sub_rows.map(mapLine) } : {}) })) };
}

// Ben, 2026-11-01, round 2: "I'd say 'representative breach' is 'company
// breach.' I'd have that showing at the same time." A table marked
// sub_rows_as_rows shows each sub-item as a row of its own, after its row,
// open and at the same level (from_row names the row it came from).
function flattenSubRows(table, shapeTable) {
  if (!shapeTable.sub_rows_as_rows || table.layout !== 'rows' || !Array.isArray(table.rows)) return table;
  const rows = table.rows.flatMap((row) => [
    { ...row, sub_rows: undefined },
    ...(row.sub_rows || []).map((sub) => ({ ...sub, from_row: row.subject })),
  ]).map((row) => { const { sub_rows, ...rest } = row; return rest; });
  return { ...table, rows };
}

// Ben, 2026-11-01, on the Structure & Mechanics grid: "I just show deal
// structure, merger form, and then just say 'Other provisions.' I put the
// other ones into 'Other provisions' and just show those too." An attribute
// grid with headline_columns keeps those lines; every other filled line of
// the grid becomes an Other provisions line (the attribute as its term, the
// cell's words as its summary, each alternative a branch), so nothing read
// is lost and the grid says the two things a reader wants first. A step-2
// line of a one-step deal is empty and leaves nothing behind.
function moveHeadlineRest(table) {
  if (table.layout !== 'attribute grid' || !Array.isArray(table.headline_columns) || !table.rows?.length) return table;
  const keep = new Set(table.headline_columns);
  const row = table.rows[0];
  const moved = [];
  const sectionOf = (factId) => (row.backing_facts || []).find((backing) => backing.fact_id === factId)?.section_reference || null;
  const textOf = (cell) => (cell.kind === 'pill' && ['PRESENT', 'YES'].includes(cell.code) && cell.words ? cell.words : cell.label);
  for (const column of table.columns || []) {
    if (keep.has(column.column_id)) continue;
    const cell = (row.cells || []).find((candidate) => candidate.column_id === column.column_id);
    if (!cell || cell.kind === 'dash' || !cell.label) continue;
    const values = Array.isArray(cell.values) && cell.values.length > 1 ? cell.values : [cell];
    const branches = values.map((value) => ({ term: values.length > 1 ? '' : column.header, text: textOf(value), fact_id: (value.fact_ids || cell.fact_ids || [])[0] || null, section_reference: sectionOf((value.fact_ids || cell.fact_ids || [])[0]) }));
    moved.push({ subtype_key: column.column_id, span_id: null, term: column.header, common_text: values.length > 1 ? '' : branches[0].text, branches, from_attribute: true });
  }
  // The row keeps every cell (the data behind the grid is whole; the page
  // renders the columns it is given); the moved columns are named on the
  // table as rest_columns.
  const columns = (table.columns || []).filter((column) => keep.has(column.column_id));
  const rest = (table.columns || []).filter((column) => !keep.has(column.column_id));
  return {
    ...table,
    columns,
    rest_columns: rest,
    ...(moved.length || table.other_provisions ? { other_provisions: [...moved, ...(table.other_provisions || [])] } : {}),
  };
}

// A column with display suffix_of is said after another column's cell
// ("$135.11 per share of Company Common Stock"; "14 calendar days after the
// agreement date"), never a cell of its own (Ben, 2026-11-01: "the 'per' is
// kind of weird as well"; "It's weird to have 14 calendar days, then a
// separate column after the agreement date. I think those two things need
// to be shown together"). When the host cell is empty the suffix stands as
// the cell's words.
function lowerFirst(text) {
  const value = String(text || '');
  return /^[A-Z][a-z]/.test(value) ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function attachSuffixes(cells, columns) {
  const suffixColumns = (columns || []).filter((column) => column.display === 'suffix_of' && column.suffix_of);
  if (suffixColumns.length === 0) return cells;
  let out = [...cells];
  for (const column of suffixColumns) {
    const suffix = out.find((cell) => cell.column_id === column.column_id);
    if (!suffix || suffix.kind === 'dash' || !suffix.label) continue;
    const label = Array.isArray(suffix.values) && suffix.values.length > 1 ? suffix.values.map((value) => lowerFirst(value.label)).join(' or ') : lowerFirst(suffix.label);
    out = out.map((cell) => {
      if (cell.column_id !== column.suffix_of) return cell;
      if (cell.kind === 'dash') return { ...suffix, column_id: column.suffix_of, kind: 'text', label: suffix.label, suffix_only: true };
      return { ...cell, suffix: { label, column_id: column.column_id, component_ids: suffix.component_ids || [], fact_ids: suffix.fact_ids || [] } };
    });
  }
  return out;
}

// Ben, 2026-11-01, on the representations table: "have a separate table
// first. It's like general exception ... SEC filings, disclosure, which makes
// sense. There isn't a bring-down standard for the exceptions, though, so
// those columns should be empty. The qualifiers: it's not really a
// qualifier, right? It's more like, I don't know, a different word." A
// table with leading_table hands the named rows to a table of their own,
// set before it: a row listed in rows_from_sub_rows contributes its
// sub-items as the rows (SEC Filings, Disclosure Letter), the others
// themselves; the dropped columns (the bring-down) are not carried and the
// Qualifiers column is headed as the spec says ("Exception").
function splitLeadingTable(table) {
  const spec = table.leading_table;
  if (!spec || !Array.isArray(table.rows) || table.rows.length === 0) return [table];
  const from = new Set(spec.from_rows || []);
  const flatten = new Set(spec.rows_from_sub_rows || []);
  const taken = table.rows.filter((row) => from.has(row.subject) && !row.absent);
  if (taken.length === 0) return [table];
  const drop = new Set(spec.drop_columns || []);
  const strip = (line) => ({ ...line, cells: (line.cells || []).filter((cell) => !drop.has(cell.column_id)), ...(line.trailing_details ? { trailing_details: line.trailing_details.filter((detail) => !drop.has(detail.column_id)) } : {}) });
  const rows = taken.flatMap((row) => (flatten.has(row.subject) && Array.isArray(row.sub_rows) && row.sub_rows.length
    ? row.sub_rows.map((sub) => strip({ ...sub, sub_rows: undefined, from_row: row.subject }))
    : [strip(row)]));
  const columns = (table.columns || []).filter((column) => !drop.has(column.column_id)).map((column) => (spec.column_headers?.[column.column_id] ? { ...column, header: spec.column_headers[column.column_id] } : column));
  const leading = pruneEmptyColumns({
    table_key: spec.table_key || `${table.table_key}-leading`,
    group_header: spec.group_header || null,
    layout: 'rows',
    term_column: { ...(table.term_column || {}), header: spec.term_header || table.term_column?.header || 'Term' },
    columns,
    rows: rows.map((row) => ({ ...row, cells: columns.map((column) => (row.cells || []).find((cell) => cell.column_id === column.column_id) || dashCell(column.column_id)) })),
    leading_of: table.table_key,
  });
  const rest = { ...table, rows: table.rows.filter((row) => !from.has(row.subject)) };
  return [leading, rest];
}

// Ben, 2026-11-01, on the equity awards table: "Warrants: are there only
// warrants, or no warrants or whatever?" A row every cell of which is empty
// says what its facts say (the first backing fact's summary) across the
// columns, instead of a line of dashes a reader cannot interpret.
function addEmptyRowSummaries(table, factsById) {
  if (table.layout !== 'rows' || !Array.isArray(table.rows)) return table;
  const filled = (cell) => cell && cell.kind !== 'dash' && (Array.isArray(cell.values) ? cell.values.length > 0 : !!cell.label);
  const shown = new Set((table.columns || []).map((column) => column.column_id));
  const rows = table.rows.map((row) => {
    if (row.absent || (row.sub_rows && row.sub_rows.length) || (row.trailing_details && row.trailing_details.length) || (row.cells || []).some((cell) => shown.has(cell.column_id) && filled(cell))) return row;
    const fact = (row.backing_facts || []).map((backing) => factsById.get(backing.fact_id)).find(Boolean);
    const summary = fact ? (typeof fact.headline?.summary === 'string' && fact.headline.summary.trim() ? fact.headline.summary.trim() : factSummaryText(fact)) : '';
    return summary ? { ...row, summary_fallback: summary } : row;
  });
  return { ...table, rows };
}

// heldFacts (work package 16): the run's layered facts held by validation,
// with the words the model wrote; read only by the election options rule,
// so an option whose only fact is held reads held, never "not a feature".
// Round 4 (Ben, 2026-11-01): "for lookback periods do we calculate the
// approximate period (e.g. X months)? don't need to show it just will want
// it for comparisons". A lookback cell carries approx_months: a period in
// years, months or days converted; a date measured to the agreement date
// when the caller knows it (the run's source document); not shown.
function approxMonthsOf(value, agreementDate) {
  if (!value || value.canonical === undefined || value.canonical === null) return null;
  const amount = Number(value.canonical);
  if (value.unit === 'YEAR' && Number.isFinite(amount)) return amount * 12;
  if (value.unit === 'MONTH' && Number.isFinite(amount)) return amount;
  if (value.unit === 'DAY' && Number.isFinite(amount)) return Math.round((amount / 30.44) * 10) / 10;
  if (value.unit === 'ISO_DATE' && agreementDate) {
    const from = new Date(`${value.canonical}T00:00:00Z`);
    const to = new Date(`${String(agreementDate).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
    return Math.round(((to - from) / (1000 * 60 * 60 * 24 * 30.44)) * 10) / 10;
  }
  return null;
}

function addLookbackMonths(table, agreementDate) {
  if (!Array.isArray(table.rows)) return table;
  const mark = (cell) => {
    if (!cell || cell.column_id !== 'lookback' || cell.kind === 'dash') return cell;
    if (Array.isArray(cell.values) && cell.values.length > 1) {
      return { ...cell, values: cell.values.map((value) => { const months = approxMonthsOf(value.value, agreementDate); return months === null ? value : { ...value, approx_months: months }; }) };
    }
    const months = approxMonthsOf(cell.value, agreementDate);
    return months === null ? cell : { ...cell, approx_months: months };
  };
  const mapLine = (line) => ({ ...line, ...(Array.isArray(line.cells) ? { cells: line.cells.map(mark) } : {}) });
  return { ...table, rows: table.rows.map((row) => ({ ...mapLine(row), ...(Array.isArray(row.sub_rows) ? { sub_rows: row.sub_rows.map(mapLine) } : {}) })) };
}

function buildTableView({ facts: storedFacts, heldFacts = [], tableShapes, legalSchema = null, agreementDate = null }) {
  // Every word the tables show comes from the components' text; the SEC
  // page footers in it are hidden here, once, for every table (the stored
  // facts, their bytes and ids are untouched).
  const facts = (storedFacts || []).map(factWithoutPageFooters);
  const factsById = new Map(facts.map((fact) => [factIdOf(fact), fact]));
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
    // Ben, 2026-11-01: a fact route_by_words sent to Other provisions, and
    // every fact of a table shown only as Other provisions ("'Registration
    // rights,' I sort of hide as an other thing."), is one of the table's
    // other facts, never a row.
    if (fact.route_other_provisions || fact.conclusions?.placement === 'other_provisions' || table.rows_as_other_provisions) {
      ensureBucket(section, table).other_facts.push(fact);
      continue;
    }
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
  // Ben, 2026-11-01: the consideration type read from the forms below when
  // no fact coded it, and the per-share rows grouped by election option.
  deriveConsiderationType({ tableShapes, buckets, ensureBucket });
  electionGroupsFor({ tableShapes, buckets });
  // Ben, 2026-11-01, round 2: the components laid out under the type.
  embedConsiderationOptions({ tableShapes, buckets, componentTextById });
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
  // Round 4 (Ben: "in period you should say outside date rather than
  // giving the date"): a period cell of a table with outside_date_words that
  // is the agreement's Outside Date (the termination table's outsideDate
  // value) reads "Outside Date", the date kept on the cell.
  const outsideDates = new Set((facts || []).flatMap((fact) => (Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells : [])
    .filter((cell) => cell.column_id === 'outsideDate' && cell.value && cell.value.unit === 'ISO_DATE').map((cell) => String(cell.value.canonical))));
  if (outsideDates.size) {
    for (const bucket of buckets.values()) {
      const spec = bucket.table.outside_date_words;
      if (!spec) continue;
      const relabel = (cellsByColumn) => {
        const cell = cellsByColumn.get(spec.column_id);
        if (!cell || cell.kind === 'dash' || !cell.value || cell.value.unit !== 'ISO_DATE' || !outsideDates.has(String(cell.value.canonical))) return;
        cellsByColumn.set(spec.column_id, { ...cell, date_label: cell.label, label: spec.label, derived: 'outside_date' });
      };
      for (const row of bucket.rows) { relabel(row.cellsByColumn); for (const sub of row.sub_rows || []) relabel(sub.cellsByColumn); }
    }
  }
  // Round 4: how many rows of a table share each row's main section (QXO's
  // reps are all 3.1), for the bring-down derivation.
  for (const bucket of buckets.values()) {
    const mainOf = (row) => {
      const counts = new Map();
      for (const backing of row.backing_facts || []) { const ref = String(backing.section_reference || '').toLowerCase(); if (ref) counts.set(ref, (counts.get(ref) || 0) + 1); }
      return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    };
    const tally = new Map();
    for (const row of bucket.rows) { const main = mainOf(row); if (main) tally.set(main, (tally.get(main) || 0) + 1); }
    for (const row of bucket.rows) row.shared_section_count = tally.get(mainOf(row)) || 0;
  }
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

  // Ben, 2026-11-01, round 3 ("Is there no cap on election in Sketchers"):
  // there is, as a defined term ("Maximum Equity Election Cap" means
  // 29,920,623 shares) that no mechanics fact carried. A table with
  // caps_from_defined_terms shows every defined term whose name matches on
  // its caps row when the table has rows (an election deal) and no fact
  // filled that row; the definition fact is the row's backing.
  for (const { section, table } of sectionCandidateTables(tableShapes)) {
    const spec = table.caps_from_defined_terms;
    if (!spec) continue;
    const bucket = buckets.get(table.table_key);
    if (!bucket || bucket.rows.length === 0 || bucket.rows.some((row) => row.subject === spec.row_label)) continue;
    let pattern;
    try { pattern = new RegExp(spec.term_words, 'i'); } catch { continue; }
    const matches = definedTerms.filter((entry) => entry.term && pattern.test(entry.term) && entry.definition);
    if (matches.length === 0) continue;
    const column = (table.columns || []).find((candidate) => candidate.display === 'fact_text') || (table.columns || [])[0];
    if (!column) continue;
    const row = { subject: spec.row_label, cellsByColumn: new Map(), backing_facts: [], sub_rows: [], from_defined_terms: true };
    for (const entry of matches) {
      const cell = { column_id: column.column_id, kind: 'text', label: String(entry.definition).toLowerCase().startsWith(String(entry.term).toLowerCase()) ? entry.definition : `${entry.term}: ${entry.definition}`, tone: 'neutral', component_ids: entry.component_ids || [], fact_ids: entry.fact_id ? [entry.fact_id] : [], derived: 'defined_term', source_order: Number.POSITIVE_INFINITY };
      const existing = row.cellsByColumn.get(column.column_id);
      row.cellsByColumn.set(column.column_id, existing ? mergeCellInto(existing, cell) : cell);
      if (entry.fact_id) row.backing_facts.push({ fact_id: entry.fact_id, section_reference: entry.section_reference || null, structure_node_id: null });
    }
    bucket.rows.push(row);
    void section;
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
      // Ben, 2026-11-01: a suffix_of column is said after its host cell; the
      // column a table names its rows from is the subject already ("you got
      // component, and then the next thing is form cash. It's a bit weird")
      // unless the shape keeps it (show_row_column); a summary_only table
      // shows its as-drafted summary and nothing else.
      const rowColumn = table.show_row_column === false ? table.row_from_column : null;
      const cellColumns = (table.columns || []).filter((column) => column.display !== 'subject_note');
      // Ben, 2026-11-01, round 2, on the negative covenants ("The thresholds
      // and exceptions: the formatting here is just super weird"): the
      // as-drafted (specifics) column is always the last column.
      const shownColumns = cellColumns.filter((column) => column.display !== 'suffix_of' && column.column_id !== rowColumn)
        .sort((left, right) => Number(left.display === 'fact_text') - Number(right.display === 'fact_text'));
      const orderedColumns = [...cellColumns].sort((left, right) => Number(left.display === 'fact_text') - Number(right.display === 'fact_text'));
      const lineCells = (cellsOf) => {
        let all = orderedColumns.map((column) => cellsOf(column));
        // The hidden row column's words stand in for an empty host cell
        // ("one Parent Unit" where the stock leg's ratio would be).
        if (rowColumn && table.row_column_words_fill) {
          const source = all.find((cell) => cell.column_id === rowColumn);
          const sourceWords = source && source.kind !== 'dash' ? wordsOfCell(source, componentTextById) : null;
          if (sourceWords) all = all.map((cell) => (cell.column_id === table.row_column_words_fill && cell.kind === 'dash'
            ? { column_id: cell.column_id, kind: 'text', label: sourceWords, tone: 'neutral', component_ids: source.component_ids || [], fact_ids: source.fact_ids || [], from_row_column: true }
            : cell));
        }
        // Every cell stays on the line (a hidden row column or suffix column
        // is still data); the page renders the table's shown columns.
        return attachSuffixes(all, cellColumns);
      };
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
      const built = attachWords(pruneEmptyColumns(applyColumnRules(pruneDraftedColumns({
        table_key: table.table_key,
        group_header: table.group_header,
        layout: table.layout || 'rows',
        ...(table.per_step_structure ? { per_step_structure: table.per_step_structure } : {}),
        ...(Array.isArray(table.headline_columns) ? { headline_columns: table.headline_columns } : {}),
        ...(table.leading_table ? { leading_table: table.leading_table } : {}),
        ...(table.summary_only ? { summary_only: true } : {}),
        ...(bucket.lead_note ? { lead_note: bucket.lead_note } : {}),
        ...(bucket.embedded_in ? { embedded_in: bucket.embedded_in } : {}),
        term_column: table.term_column,
        columns: shownColumns.map((column) => ({ column_id: column.column_id, header: column.header, ...(column.display === 'fact_text' ? { display: 'fact_text' } : {}) })),
        ...(table.absent_row_label ? { absent_row_label: table.absent_row_label } : {}),
        ...(combined ? { combined_definition: combined } : {}),
        ...(table.footer_from_subtype && table.footer_from_subtype.style !== 'other_provisions' ? { footer: { label: table.footer_from_subtype.label, entries: bucket.footer } } : {}),
        ...(bucket.other_facts.length ? { other_provisions: groupOtherProvisions(bucket.other_facts) } : {}),
        ...(bucket.other_facts.length && table.footer_from_subtype?.style === 'other_provisions' ? { other_provisions_label: table.footer_from_subtype.label } : {}),
        ...(bucket.other_facts.length && !table.footer_from_subtype && table.other_provisions_from_subtype?.label ? { other_provisions_label: table.other_provisions_from_subtype.label } : {}),
        ...(bucket.other_facts.length && table.rows_as_other_provisions?.label ? { other_provisions_label: table.rows_as_other_provisions.label, other_provisions_only: true } : {}),
        ...(table.collapsible_rows ? { collapsible_rows: true } : {}),
        ...(table.rows_start_collapsed ? { rows_start_collapsed: true } : {}),
        ...(table.sub_rows_label ? { sub_rows_label: table.sub_rows_label } : {}),
        ...(qualificationsByTable.has(table.table_key) ? { article_qualifications: qualificationsByTable.get(table.table_key) } : {}),
        rows: bucket.rows.map((row) => ({
          subject: row.subject,
          ...(subjectNote(row) ? { subject_note: subjectNote(row) } : {}),
          ...(row.absent ? { absent: true } : {}),
          ...(row.absent && row.absent_label ? { absent_label: row.absent_label } : {}),
          ...(row.held ? { held: true } : {}),
          ...(row.folded_from ? { folded_from: row.folded_from } : {}),
          ...(row.election_group ? { election_group: row.election_group } : {}),
          cells: lineCells((column) => rowLineCell(row, column)),
          backing_facts: row.backing_facts,
          ...(row.sub_rows && row.sub_rows.length ? {
            sub_rows: row.sub_rows.map((subRow) => ({
              subject: subRow.subject,
              cells: lineCells((column) => subRow.cellsByColumn.get(column.column_id) || dashCell(column.column_id)),
              backing_facts: subRow.backing_facts,
            })),
          } : {}),
        })),
      }), table.columns)), componentTextById);
      // Ben, 2026-11-01: the as-drafted column behind "Show specifics"
      // (markSpecifics), the grid's non-headline lines under Other
      // provisions (moveHeadlineRest), an empty row saying what its fact
      // says (addEmptyRowSummaries), the General Exceptions rows as a table
      // of their own before the representations (splitLeadingTable).
      // Round 2: a reading's qualifier where a cell carries several facts'
      // readings (qualifyReadings), sub-items as rows (flattenSubRows).
      const shaped = addLookbackMonths(flattenSubRows(qualifyReadings(built, table, factsById), table), agreementDate);
      for (const part of splitLeadingTable(addEmptyRowSummaries(moveHeadlineRest(markSummaryOnly(markSpecifics(shaped))), factsById))) sectionTables.push(part);
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
