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

function conclusionCellsForFact(fact, table, tableShapes) {
  // Contract shape (fact-conclusions.v1.json): cells is an array of
  // { column_id, code | value | text, component_ids }. Rendered through the
  // conclusions module. A cells object keyed by column id is an already
  // rendered display shape and is normalised directly.
  if (Array.isArray(fact.conclusions?.cells) && factConclusions && typeof factConclusions.renderConclusionCells === 'function') {
    const rendered = factConclusions.renderConclusionCells(fact, tableShapes);
    if (rendered && rendered.length) return normalizeConclusionCells(rendered, fact);
  }
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

function mergeCellInto(existing, incoming) {
  if (incoming.kind === 'dash') return existing;
  if (existing.kind === 'dash') return incoming;
  return {
    ...existing,
    component_ids: [...new Set([...(existing.component_ids || []), ...(incoming.component_ids || [])])],
    fact_ids: [...new Set([...(existing.fact_ids || []), ...(incoming.fact_ids || [])])],
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

// `buildTableView({ facts, tableShapes, legalSchema })` -> { sections, defined_terms }.
// `tableShapes` is the parsed contracts/product/table-shapes.v3.json.
// `legalSchema` is the parsed contracts/product/legal-schema.v2.json, used
// only as an extra (belt-and-braces) coverage_only check.
function buildTableView({ facts, tableShapes, legalSchema = null }) {
  const definedTerms = [];
  const seenTerms = new Set();
  // table_key -> { section, table, rows: [{ subject, cells: Map, backing_facts }] }
  const buckets = new Map();

  for (const fact of facts || []) {
    if (!fact) continue;
    collectDefinedTerms(fact, definedTerms, seenTerms);
    if (isCoverageOnly(fact, legalSchema)) continue;

    const target = resolveTableForFact(fact, tableShapes);
    if (!target || target.section.excluded_from_fact_tables) continue;
    const { section, table } = target;

    if (!buckets.has(table.table_key)) buckets.set(table.table_key, { section, table, rows: [] });
    const bucket = buckets.get(table.table_key);

    const subject = subjectForFact(fact);
    let row = bucket.rows.find((candidate) => candidate.subject === subject);
    if (!row) {
      row = { subject, cellsByColumn: new Map(), backing_facts: [] };
      bucket.rows.push(row);
    }
    row.backing_facts.push({ fact_id: factIdOf(fact), section_reference: fact.section_reference || null });

    const cells = computeCellsForFact(fact, table, tableShapes);
    for (const column of table.columns) {
      const incoming = cells[column.column_id];
      const existing = row.cellsByColumn.get(column.column_id);
      row.cellsByColumn.set(column.column_id, existing ? mergeCellInto(existing, incoming) : incoming);
    }
  }

  const sections = [];
  for (const section of tableShapes.sections || []) {
    if (section.excluded_from_fact_tables) continue;
    const sectionTables = [];
    for (const table of section.tables || []) {
      const bucket = buckets.get(table.table_key);
      if (!bucket || bucket.rows.length === 0) continue;
      sectionTables.push({
        table_key: table.table_key,
        group_header: table.group_header,
        term_column: table.term_column,
        columns: table.columns.map((column) => ({ column_id: column.column_id, header: column.header })),
        rows: bucket.rows.map((row) => ({
          subject: row.subject,
          cells: table.columns.map((column) => row.cellsByColumn.get(column.column_id) || dashCell(column.column_id)),
          backing_facts: row.backing_facts,
        })),
      });
    }
    if (sectionTables.length === 0) continue;
    sections.push({ section_key: section.section_key, title: section.title, tables: sectionTables });
  }

  definedTerms.sort((left, right) => left.term.localeCompare(right.term));

  return { sections, defined_terms: definedTerms };
}

module.exports = {
  buildTableView,
  subjectForFact,
  resolveTableForFact,
  walkComponents,
  findComponentsByKind,
  shortenText,
  factIdOf,
};
