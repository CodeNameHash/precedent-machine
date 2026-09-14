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
  return (fact?.components || []).filter((component) => component && (component.origin === 'OWN' || !component.origin) && component.text)
    .map((component) => component.text.trim()).join(' ');
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
  return joinInSourceOrder(summaryComponents(fact));
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
  const candidates = candidateTablesForFamily(tableShapes, familyKey);
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

function resolveTableForFact(fact, tableShapes) {
  const explicitKey = fact?.conclusions?.table_key;
  if (explicitKey) {
    const found = findTableByKey(tableShapes, explicitKey);
    if (found) return found;
  }
  if (factConclusions && typeof factConclusions.tableForFact === 'function') {
    const resolved = factConclusions.tableForFact(fact, tableShapes);
    if (resolved) {
      if (resolved.table_key) return findTableByKey(tableShapes, resolved.table_key) || resolved;
      if (resolved.table) return resolved;
    }
  }
  return fallbackTableForFamily(tableShapes, fact.family_key, subjectForFact(fact));
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
      if (entry?.links_to_section) linkSection = entry.links_to_section;
    } else if (column.render === 'value') {
      kind = 'value';
      label = factConclusions && typeof factConclusions.formatValue === 'function'
        ? factConclusions.formatValue(cell.value, column.value_kind) : null;
      if (!label && cell.value && cell.value.canonical !== undefined) label = String(cell.value.canonical);
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
function derivedValueCell(fact, column) {
  if (column.render !== 'value' || !column.value_kind) return null;
  if (!factConclusions || typeof factConclusions.parseComponentValue !== 'function') return null;
  // A column filled only by named subtypes (the capitalization table's
  // authorised, issued and reserved counts) is never completed from
  // another subtype's number (Ben, 2026-09-14: "sure add a table").
  if (Array.isArray(column.from_subtype_keys) && !column.from_subtype_keys.includes(fact.subtype_key)) return null;
  for (const kind of column.fill_from || []) {
    for (const component of findComponentsByKind(fact, kind)) {
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

function computeCellsForFact(fact, table, tableShapes) {
  const conclusionCells = conclusionCellsForFact(fact, table, tableShapes);
  const result = {};
  for (const column of table.columns) {
    if (conclusionCells) {
      result[column.column_id] = conclusionCells.get(column.column_id) || derivedValueCell(fact, column) || dashCell(column.column_id);
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
  return { label: cell.label, ...(cell.code ? { code: cell.code } : {}), ...(cell.link_section ? { link_section: cell.link_section } : {}), kind: cell.kind, tone: cell.tone, component_ids: cell.component_ids || [], fact_ids: cell.fact_ids || [], source_order: Number.isFinite(cell.source_order) ? cell.source_order : Number.POSITIVE_INFINITY };
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
function definedTermParts(component, fact) {
  const text = String(component.text || '').trim();
  const quoted = text.match(QUOTED_TERM);
  // An unquoted short text is the term itself (a component that names the
  // term plainly); a long unquoted text is a definition, named by its label.
  const term = quoted ? quoted[1].trim() : (text.length <= 80 && !DEFINES.test(text) ? text : (component.label || text));
  const candidates = [text, component.resolves_to?.text].filter((value) => typeof value === 'string' && value.trim());
  for (const candidate of candidates) {
    if (DEFINES.test(candidate)) return { term, definition: candidate.replace(DEFINES, '').replace(/[.;]\s*$/, '').trim() };
  }
  const inline = /^\(|^(?:the|a|an|such|collectively,?)\s+[“"]|^[“"][^”"]+[”"]\)?$/i.test(text) || (quoted && text.length <= quoted[0].length + 40);
  if (inline) {
    const top = fact.components || [];
    const parent = walkComponents(fact.components).find((candidate) => (candidate.children || []).some((child) => child.component_id === component.component_id));
    if (parent && parent.text && parent.text.trim() !== text) return { term, definition: parent.text.replace(text, '').replace(/\s+/g, ' ').trim() };
    const index = top.findIndex((candidate) => candidate.component_id === component.component_id);
    const before = index > 0 ? top.slice(0, index).reverse().find((candidate) => candidate.text && candidate.kind !== 'DEFINED_TERM') : null;
    if (before) return { term, definition: before.text.trim() };
  }
  const resolved = component.resolves_to?.text;
  if (typeof resolved === 'string' && resolved.trim() && resolved.trim() !== term) return { term, definition: resolved.trim() };
  return { term, definition: null };
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

function collectDefinedTerms(fact, definedTerms, seen) {
  for (const component of walkComponents(fact.components)) {
    if (component.kind !== 'DEFINED_TERM') continue;
    const { term, definition } = definedTermParts(component, fact);
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    definedTerms.push({
      term,
      label: component.label || null,
      definition,
      component_id: component.component_id,
      fact_id: factIdOf(fact),
      section_reference: fact.section_reference || null,
    });
  }
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

// Applies the page rules to the facts handed to buildTableView: a fact the
// rules place is replaced by (or, for a knowledge definition that already
// has a readout elsewhere, joined by) copies carrying the rule's readout.
// Every other fact passes through untouched.
function applyPageRules(facts, tableShapes) {
  const list = (facts || []).filter(Boolean);
  // An article introduction's facts are placed as one: the party whose
  // introduction it is (Parent's when any of them names Parent or Merger
  // Sub as the representing party) picks the table.
  const introParty = new Map();
  for (const fact of list) {
    if (fact.family_key !== 'REPRESENTATIONS' || !isArticleIntroductionFact(fact)) continue;
    const reference = String(fact.section_reference);
    const actor = ownComponents(fact).find((component) => component.kind === 'ACTOR');
    if (actor && PARENT_PARTY.test(String(actor.text || '').trim())) introParty.set(reference, 'parent');
    else if (!introParty.has(reference)) introParty.set(reference, 'company');
  }
  const out = [];
  for (const stored of list) {
    // A readout that names a table the shapes no longer carry (generation
    // 6, IV-INTRO: "parent-representations-general-qualifications", retired
    // when the General Exceptions row took its place) is no readout; the
    // page rules place the fact as they would a fact without one.
    const retired = hasReadout(stored) && stored.conclusions.table_key && !findTableByKey(tableShapes, stored.conclusions.table_key);
    const fact = retired ? { ...stored, conclusions: null, retired_table_key: stored.conclusions.table_key } : stored;
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
    if (!hasReadout(fact) && fact.validation_status !== 'INVALID' && factConclusions && typeof factConclusions.defaultConclusions === 'function') {
      const readout = factConclusions.defaultConclusions(fact, tableShapes);
      if (readout) { out.push({ ...fact, conclusions: readout, page_rule: 'fact_type_rows' }); continue; }
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
function buildTableView({ facts, tableShapes, legalSchema = null }) {
  const definedTerms = [];
  const seenTerms = new Set();
  // table_key -> { section, table, rows: [{ subject, cells: Map, backing_facts }] }
  const buckets = new Map();
  const ensureBucket = (section, table) => {
    if (!buckets.has(table.table_key)) buckets.set(table.table_key, { section, table, rows: [], footer: [], other_facts: [] });
    return buckets.get(table.table_key);
  };
  // section_key -> facts of the section's families that carry no readout
  const unplaced = new Map();

  const placed = applyPageRules(facts, tableShapes);
  for (const fact of placed) {
    if (!fact) continue;
    collectDefinedTerms(fact, definedTerms, seenTerms);
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

    // A table may take one subtype's facts as its footer (the MAE
    // disproportionality carve-back shown, as drafted, under the carve-out
    // table; Ben, 2026-09-13: "we should show how the disproportionate
    // carve out is drafted at the bottom of the table"). Such a fact is
    // never a row.
    if (table.footer_from_subtype && fact.subtype_key === table.footer_from_subtype.subtype_key) {
      // style other_provisions: the facts are the table's Other provisions
      // (Term / Summary rows) under the footer's label (capitalization's
      // No other securities; Ben, 2026-09-14: "tidy up this no other
      // securities other provisions like in the other sections").
      if (table.footer_from_subtype.style === 'other_provisions') bucket.other_facts.push(fact);
      else bucket.footer.push(footerEntryForFact(fact, table, tableShapes));
      continue;
    }

    // A one-per-agreement table has a single row that every fact of the
    // family fills in together (the legacy Structure & Mechanics grid).
    // A table that derives its rows from the fact's subtype (general
    // covenants) names the row from the schema's subtype, never from the
    // words the model chose; the model's own label becomes the sub-item.
    const subtypeRow = table.row_from_subtype && table.subtype_rows ? table.subtype_rows[fact.subtype_key] || null : null;
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
    const detail = typeof fact.conclusions?.row_detail === 'string' && fact.conclusions.row_detail.trim()
      ? fact.conclusions.row_detail.trim()
      : (subtypeRow && ownLabel && ownLabel !== subtypeRow ? ownLabel : columnDetail);
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
        subRow = { subject: detail, cellsByColumn: new Map(), backing_facts: [], from_column: !(fact.conclusions?.row_detail) && !(subtypeRow && ownLabel && ownLabel !== subtypeRow) };
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
  for (const bucket of buckets.values()) {
    for (const column of bucket.table.columns) {
      if (!column.derived) continue;
      for (const row of bucket.rows) {
        const derived = deriveCellForRow({ row, column, facts, tableShapes, bucket });
        row.cellsByColumn.set(column.column_id, derived || dashCell(column.column_id));
        for (const subRow of row.sub_rows) {
          const subDerived = deriveCellForRow({ row: subRow, column, facts, tableShapes, bucket });
          subRow.cellsByColumn.set(column.column_id, subDerived || dashCell(column.column_id));
        }
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
          const term = walkComponents(source.components).find((component) => component.kind === 'DEFINED_TERM');
          combined = { label: spec.label, term: definedTermParts(term, source).term, text: factSummaryText(source), fact_id: factIdOf(source), section_reference: source.section_reference || null, component_ids: [term.component_id] };
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
      sectionTables.push(pruneDraftedColumns({
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
        ...(table.collapsible_rows ? { collapsible_rows: true } : {}),
        ...(table.sub_rows_label ? { sub_rows_label: table.sub_rows_label } : {}),
        rows: bucket.rows.map((row) => ({
          subject: row.subject,
          ...(subjectNote(row) ? { subject_note: subjectNote(row) } : {}),
          ...(row.absent ? { absent: true } : {}),
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
      }));
    }
    const withoutReadout = unplaced.get(section.section_key) || [];
    if (sectionTables.length === 0 && withoutReadout.length === 0) continue;
    // The section's first family is its own (a later one is a family it
    // also hosts, like specific performance under boilerplate).
    const primaryFamily = (section.v2_family_keys || [])[0]?.key;
    const coverageOnly = !!primaryFamily && (legalSchema?.families || []).some((family) => family.family_key === primaryFamily && family.coverage_only);
    sections.push({ section_key: section.section_key, title: section.title, ...(section.rail ? { rail: section.rail } : {}), ...(coverageOnly ? { coverage_only: true } : {}), tables: sectionTables, facts_without_readout: withoutReadout });
  }

  definedTerms.sort((left, right) => left.term.localeCompare(right.term));

  return { sections, defined_terms: definedTerms };
}

module.exports = {
  definedTermParts,
  buildTableView,
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
