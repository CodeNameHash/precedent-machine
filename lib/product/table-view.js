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
      label = factOwnText(fact) || (typeof cell.text === 'string' ? cell.text : null);
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

function collectDefinedTerms(fact, definedTerms, seen) {
  for (const component of walkComponents(fact.components)) {
    if (component.kind !== 'DEFINED_TERM') continue;
    const key = component.text;
    if (seen.has(key)) continue;
    seen.add(key);
    definedTerms.push({
      term: component.text,
      label: component.label || null,
      definition: component.resolves_to?.text || null,
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

function deriveCellForRow({ row, column, facts, tableShapes }) {
  const spec = column.derived;
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
  const text = verbatim ? verbatim.label : factOwnText(fact);
  return {
    fact_id: factIdOf(fact),
    section_reference: fact.section_reference || null,
    structure_node_id: fact.structure_node_id || null,
    text: text || null,
    component_ids: verbatim ? verbatim.component_ids : components.slice(0, 1).map((component) => component.component_id),
  };
}

// `buildTableView({ facts, tableShapes, legalSchema })` -> { sections, defined_terms }.
// `tableShapes` is the parsed contracts/product/table-shapes.v3.json.
// `legalSchema` is the parsed contracts/product/legal-schema.v2.json, used
// only as an extra (belt-and-braces) coverage_only check.
function buildTableView({ facts, tableShapes, legalSchema = null }) {
  const definedTerms = [];
  const seenTerms = new Set();
  // table_key -> { section, table, rows: [{ subject, cells: Map, backing_facts }] }
  const buckets = new Map();
  // section_key -> facts of the section's families that carry no readout
  const unplaced = new Map();

  for (const fact of facts || []) {
    if (!fact) continue;
    collectDefinedTerms(fact, definedTerms, seenTerms);
    if (isCoverageOnly(fact, legalSchema)) continue;

    const target = resolveTableForFact(fact, tableShapes);
    if (!target || target.section.excluded_from_fact_tables) continue;
    const { section, table } = target;
    // A fact without a readout never becomes a row: a row keyed by a fact's
    // grammatical subject with its verbs as cells is not a conclusion (Ben,
    // 2026-09-13, on employee benefits and general covenants). It is listed
    // under the section as evidence without a readout instead.
    const hasReadout = !!fact.conclusions && !!fact.conclusions.cells && typeof fact.conclusions.cells === 'object';
    if (!hasReadout) {
      if (!unplaced.has(section.section_key)) unplaced.set(section.section_key, []);
      unplaced.get(section.section_key).push({ fact_id: factIdOf(fact), section_reference: fact.section_reference || null, headline: fact.headline?.label || null });
      continue;
    }

    if (!buckets.has(table.table_key)) buckets.set(table.table_key, { section, table, rows: [], footer: [] });
    const bucket = buckets.get(table.table_key);

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
    for (const cell of Object.values(cells)) {
      if (cell && cell.kind !== 'dash') cell.source_order = sourceOrderOf(fact, cell.component_ids);
    }
    for (const column of table.columns) {
      // A column with absent_code answers a blank cell with that code (the
      // MAE carve-back column says Yes or No and nothing else; Ben,
      // 2026-09-13: "the disproportionate carve out must say yes or no").
      if (column.absent_code && (!cells[column.column_id] || cells[column.column_id].kind === 'dash')) {
        cells[column.column_id] = absentCodeCell(fact, column, tableShapes);
      }
      const incoming = cells[column.column_id];
      const existing = row.cellsByColumn.get(column.column_id);
      row.cellsByColumn.set(column.column_id, existing ? mergeCellInto(existing, incoming) : incoming);
    }
    // A fact with row_detail is a sub-item of its row (a limb of a
    // representation): it gets its own indented line with the same
    // columns, and the row's line keeps the overview (the merge above).
    const ownLabel = typeof fact.conclusions?.row_label === 'string' ? fact.conclusions.row_label.trim() : '';
    // A table may split a row into sub-items by one of its columns (the
    // bring-down tiers by their standard): each fact becomes a line keyed
    // by that cell, and the row's line keeps the overview.
    const columnDetail = table.sub_row_from_column && cells[table.sub_row_from_column] && cells[table.sub_row_from_column].kind !== 'dash'
      ? cells[table.sub_row_from_column].label : null;
    const detail = typeof fact.conclusions?.row_detail === 'string' && fact.conclusions.row_detail.trim()
      ? fact.conclusions.row_detail.trim()
      : (subtypeRow && ownLabel && ownLabel !== subtypeRow ? ownLabel : columnDetail);
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
      if (!bucket || (bucket.rows.length === 0 && bucket.footer.length === 0)) continue;
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
        const order = new Map((table.fixed_row_labels || []).map((label, index) => [label, index]));
        bucket.rows.sort((left, right) => (order.has(left.subject) ? order.get(left.subject) : order.size) - (order.has(right.subject) ? order.get(right.subject) : order.size));
      }
      sectionTables.push({
        table_key: table.table_key,
        group_header: table.group_header,
        layout: table.layout || 'rows',
        ...(table.per_step_structure ? { per_step_structure: table.per_step_structure } : {}),
        term_column: table.term_column,
        columns: table.columns.map((column) => ({ column_id: column.column_id, header: column.header })),
        ...(table.absent_row_label ? { absent_row_label: table.absent_row_label } : {}),
        ...(table.footer_from_subtype ? { footer: { label: table.footer_from_subtype.label, entries: bucket.footer } } : {}),
        rows: bucket.rows.map((row) => ({
          subject: row.subject,
          ...(row.absent ? { absent: true } : {}),
          cells: table.columns.map((column) => row.cellsByColumn.get(column.column_id) || dashCell(column.column_id)),
          backing_facts: row.backing_facts,
          ...(row.sub_rows && row.sub_rows.length ? {
            sub_rows: row.sub_rows.map((subRow) => ({
              subject: subRow.subject,
              cells: table.columns.map((column) => subRow.cellsByColumn.get(column.column_id) || dashCell(column.column_id)),
              backing_facts: subRow.backing_facts,
            })),
          } : {}),
        })),
      });
    }
    const withoutReadout = unplaced.get(section.section_key) || [];
    if (sectionTables.length === 0 && withoutReadout.length === 0) continue;
    sections.push({ section_key: section.section_key, title: section.title, ...(section.rail ? { rail: section.rail } : {}), tables: sectionTables, facts_without_readout: withoutReadout });
  }

  definedTerms.sort((left, right) => left.term.localeCompare(right.term));

  return { sections, defined_terms: definedTerms };
}

module.exports = {
  buildTableView,
  factOwnText,
  subjectForFact,
  resolveTableForFact,
  walkComponents,
  findComponentsByKind,
  shortenText,
  factIdOf,
};
