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
    const text = String(component.text || '').trim();
    if (!text) continue;
    if (previous && anchored && component.start_byte > previous.end_byte + 1) parts.push('…');
    parts.push(text);
    previous = component;
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
      const text = joinInSourceOrder(only.summary);
      out.push({ subtype_key: group.subtype_key, span_id: group.span_id, common_text: text, branches: [{ fact_id: factIdOf(only.fact), section_reference: only.fact.section_reference || null, text }] });
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
      return { fact_id: factIdOf(member.fact), section_reference: member.fact.section_reference || null, text: joinInSourceOrder(core.length ? core : rest) };
    });
    out.push({ subtype_key: group.subtype_key, span_id: group.span_id, common_text: commonText, branches });
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
    if (column.render === 'vocabulary') {
      const vocabulary = factConclusions && typeof factConclusions.columnVocabulary === 'function'
        ? factConclusions.columnVocabulary(column, tableShapes) : [];
      const entry = vocabulary.find((item) => item.code === cell.code);
      label = entry ? entry.label : cell.code;
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
      // A detail column shows the fact's own words as drafted, the cited
      // words being the click target (Ben, 2026-09-13: "there is great
      // detail here on the right but it isn't shown on the left").
      kind = 'text';
      label = factSummaryText(fact) || (typeof cell.text === 'string' ? cell.text : null);
    } else if (column.display === 'party') {
      // A party column names the entity the fact is about (its own ACTOR
      // words), with the cited term after it: "the Company (the “Surviving
      // Corporation”)" rather than the bare defined term (Ben, 2026-09-14:
      // "needs to say which entity is the surviving entity").
      kind = 'text';
      const actor = (fact.components || []).find((component) => component && component.kind === 'ACTOR' && (component.origin === 'OWN' || !component.origin) && component.text);
      const term = typeof cell.text === 'string' ? cell.text.trim() : '';
      label = actor ? (term && term !== actor.text.trim() ? `${actor.text.trim()} (${term})` : actor.text.trim()) : (term || null);
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
      ...(column.render === 'vocabulary' ? { code: cell.code } : {}),
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

function computeCellsForFact(fact, table, tableShapes) {
  const conclusionCells = conclusionCellsForFact(fact, table, tableShapes);
  const result = {};
  for (const column of table.columns) {
    if (conclusionCells) {
      result[column.column_id] = conclusionCells.get(column.column_id) || dashCell(column.column_id);
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
      ? { column_id: column.column_id, kind: 'text', label: factSummaryText(source), tone: 'neutral', component_ids: own.map((component) => component.component_id), fact_ids: [factIdOf(source)] }
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

function deriveCellForRow({ row, column, facts, tableShapes }) {
  const spec = column.derived;
  if (spec.join === 'presence') {
    if (Array.isArray(spec.rows) && !spec.rows.includes(row.subject)) return null;
    return derivePresenceCell({ column, facts });
  }
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

  for (const fact of facts || []) {
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
    const hasReadout = !!fact.conclusions && !!fact.conclusions.cells && typeof fact.conclusions.cells === 'object';
    if (!hasReadout && table.rows_are === 'one per agreement') {
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
    // A fact cut from an article introduction (III-INTRO) with no readout
    // belongs under the section's general-qualifications table as an other
    // provision (Ben, 2026-09-14: "This is the standard intro to the reps
    // that provides the exceptions for all reps").
    const introTable = !hasReadout && /-INTRO$/.test(String(fact.section_reference || ''))
      ? (section.tables || []).find((candidate) => candidate.intro_facts_of_family === fact.family_key) : null;
    if (introTable) {
      ensureBucket(section, introTable).other_facts.push(fact);
      continue;
    }
    if (!hasReadout) {
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
      bucket.footer.push(footerEntryForFact(fact, table, tableShapes));
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
        subRow = { subject: detail, cellsByColumn: new Map(), backing_facts: [] };
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
      sectionTables.push({
        table_key: table.table_key,
        group_header: table.group_header,
        layout: table.layout || 'rows',
        ...(table.per_step_structure ? { per_step_structure: table.per_step_structure } : {}),
        term_column: table.term_column,
        columns: shownColumns.map((column) => ({ column_id: column.column_id, header: column.header })),
        ...(table.absent_row_label ? { absent_row_label: table.absent_row_label } : {}),
        ...(combined ? { combined_definition: combined } : {}),
        ...(table.footer_from_subtype ? { footer: { label: table.footer_from_subtype.label, entries: bucket.footer } } : {}),
        ...(bucket.other_facts.length ? { other_provisions: groupOtherProvisions(bucket.other_facts) } : {}),
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
      });
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
  subjectForFact,
  resolveTableForFact,
  walkComponents,
  findComponentsByKind,
  shortenText,
  factIdOf,
};
