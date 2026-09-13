'use strict';

// Validation and rendering helpers for FACT_CONCLUSIONS/V1, the coded
// per-table readout decided 2026-09-12/13 (Ben) as an additional, optional
// layer on top of FACT_COMPONENTS/V2. Contract:
// contracts/product/fact-conclusions.v1.json. Table shapes and vocabularies:
// contracts/product/table-shapes.v3.json, validated by lib/product/table-shapes.js.
// Pure functions; no database or model access.

const contract = require('../../contracts/product/fact-conclusions.v1.json');
const { walk, parseComponentValue } = require('./fact-components');

const VALUE_RENDER_KINDS = new Set(['verbatim', 'term']);

// Every column of `table`, resolving a shared vocabulary reference to the
// actual vocabulary entries so callers never need `table-shapes.json`'s
// top-level `shared_vocabularies` separately.
function columnVocabulary(column, tableShapes) {
  if (Array.isArray(column.vocabulary)) return column.vocabulary;
  if (column.vocabulary_ref) return (tableShapes.shared_vocabularies || {})[column.vocabulary_ref] || [];
  return [];
}

function findTableByKey(tableShapes, tableKey) {
  for (const section of tableShapes.sections || []) {
    for (const table of section.tables || []) {
      if (table.table_key === tableKey) return { table, section };
    }
  }
  return null;
}

// Every { table, section } whose section covers `familyKey`.
function tablesForFamily(familyKey, tableShapes) {
  const candidates = [];
  for (const section of tableShapes.sections || []) {
    if (!(section.v2_family_keys || []).some((entry) => entry.key === familyKey)) continue;
    for (const table of section.tables || []) candidates.push({ table, section });
  }
  return candidates;
}

function familyHasTableShape(familyKey, tableShapes) {
  return tablesForFamily(familyKey, tableShapes).length > 0;
}

// Resolves the one table `fact.conclusions` targets (or would target): by
// explicit table_key when given, checked against the fact's family_key
// through the table's section.v2_family_keys; otherwise by family_key alone
// when it names exactly one table, or by row_label against a fixed-list
// table's row labels when the family has more than one. Returns
// { table, section } or null when no table resolves.
function tableForFact(fact, tableShapes) {
  const conclusions = fact.conclusions || null;
  if (conclusions && conclusions.table_key) {
    const found = findTableByKey(tableShapes, conclusions.table_key);
    if (!found) return null;
    if (!(found.section.v2_family_keys || []).some((entry) => entry.key === fact.family_key)) return null;
    return found;
  }
  const candidates = tablesForFamily(fact.family_key, tableShapes);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && conclusions && conclusions.row_label) {
    const matches = candidates.filter(({ table }) => (
      (table.fixed_row_labels || []).includes(conclusions.row_label)
      || (table.additional_fixed_row_labels || []).some((row) => row.label === conclusions.row_label)
    ));
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function rowLabelProblem(table, rowLabel) {
  if (table.rows_are !== 'fixed list' || table.open_rows === true) return null;
  const legal = [
    ...(table.fixed_row_labels || []),
    ...((table.additional_fixed_row_labels || []).map((row) => row.label)),
  ];
  return legal.includes(rowLabel) ? null : `row_label "${rowLabel}" is not one of ${table.table_key}'s fixed row labels`;
}

// Returns a list of problems; an empty list means `fact.conclusions`
// satisfies the contract (rules C1-C9), or `fact` carries no conclusions at
// all (optional layer -- nothing to check).
// C4: a verbatim/term cell's text is the cited component's exact text or a
// contiguous run of whole words cut from it (no paraphrase, no added words).
function verbatimRun(componentText, cellText) {
  if (typeof componentText !== 'string' || typeof cellText !== 'string' || !cellText.trim()) return false;
  if (componentText === cellText) return true;
  const index = componentText.indexOf(cellText);
  if (index < 0) return false;
  const before = index === 0 ? '' : componentText[index - 1];
  const after = componentText[index + cellText.length] || '';
  return /^[\s([“"'‘,;:.]?$/.test(before) && /^[\s)\]”"'’,;:.]?$/.test(after);
}

function validateFactConclusions(fact, { tableShapes } = {}) {
  const problems = [];
  const conclusions = fact?.conclusions;
  if (!conclusions) return problems;
  if (!tableShapes) return ['tableShapes required to validate conclusions'];
  if (typeof conclusions.table_key !== 'string' || !conclusions.table_key) problems.push('table_key missing');
  if (typeof conclusions.row_label !== 'string' || !conclusions.row_label.trim()) problems.push('row_label missing');
  if (conclusions.row_detail !== undefined && (typeof conclusions.row_detail !== 'string' || !conclusions.row_detail.trim())) problems.push('row_detail must be a non-empty string when present');
  if (!Array.isArray(conclusions.cells)) {
    problems.push('cells missing');
    return problems;
  }
  const resolved = tableForFact(fact, tableShapes);
  if (!resolved) {
    problems.push(`no table-shapes table "${conclusions.table_key}" for family ${fact.family_key}`);
    return problems;
  }
  const { table } = resolved;
  if (conclusions.row_label) {
    const problem = rowLabelProblem(table, conclusions.row_label);
    if (problem) problems.push(problem);
  }
  const columnsById = new Map((table.columns || []).map((column) => [column.column_id, column]));
  const componentsById = new Map([...walk(fact.components || [])].map(([component]) => [component.component_id, component]));
  const seenColumns = new Set();

  conclusions.cells.forEach((cell, index) => {
    const where = `cells[${index}]`;
    if (!cell || typeof cell !== 'object') { problems.push(`${where}: not an object`); return; }
    const column = columnsById.get(cell.column_id);
    if (!column) { problems.push(`${where}: unknown column ${cell.column_id}`); return; }
    if (seenColumns.has(cell.column_id)) problems.push(`${where}: duplicate column ${cell.column_id}`);
    seenColumns.add(cell.column_id);

    const componentIds = Array.isArray(cell.component_ids) ? cell.component_ids : [];
    if (componentIds.length === 0) problems.push(`${where}: needs at least one component_id`);
    // C6: every cited component belongs to this fact. The column's fill_from
    // kinds are advisory (they drive the no-conclusions fallback rendering);
    // a component of another kind is accepted.
    const citedComponents = [];
    for (const componentId of componentIds) {
      const component = componentsById.get(componentId);
      if (!component) { problems.push(`${where}: component ${componentId} is not part of this fact`); continue; }
      citedComponents.push(component);
    }

    if (column.render === 'vocabulary') {
      if (typeof cell.code !== 'string' || !cell.code) problems.push(`${where}: vocabulary column needs a code`);
      else if (!columnVocabulary(column, tableShapes).some((entry) => entry.code === cell.code)) {
        problems.push(`${where}: unknown code "${cell.code}" for column ${cell.column_id}`);
      }
    } else if (column.render === 'value') {
      if (!cell.value || typeof cell.value !== 'object' || cell.value.canonical === undefined) {
        problems.push(`${where}: value column needs { canonical, unit }`);
      } else if (!citedComponents.some((component) => {
        // The number is parsed from the cited words as the column's own value
        // kind (a period cited from a TRIGGER component still parses as a
        // PERIOD), falling back to the component's kind.
        const kinds = [...new Set([column.value_kind, component.kind].filter(Boolean))];
        return kinds.some((kind) => {
          const parsed = parseComponentValue(kind, component.text);
          return parsed && parsed.canonical === cell.value.canonical && parsed.unit === cell.value.unit;
        });
      })) {
        problems.push(`${where}: value does not match parseComponentValue of any cited component`);
      }
    } else if (VALUE_RENDER_KINDS.has(column.render)) {
      if (typeof cell.text !== 'string' || !cell.text) problems.push(`${where}: ${column.render} column needs text`);
      else if (!citedComponents.some((component) => verbatimRun(component.text, cell.text))
        && !verbatimRun(citedComponents.map((component) => component.text).join(' '), cell.text)) {
        problems.push(`${where}: text is not the verbatim text, or a run of words cut from it, of any cited component`);
      }
    } else if (column.render === 'boolean') {
      if (typeof cell.present !== 'boolean') problems.push(`${where}: boolean column needs present`);
    } else {
      problems.push(`${where}: unsupported render kind ${column.render}`);
    }
  });

  return problems;
}

function formatValue(value, valueKind) {
  if (!value || value.canonical === undefined || value.canonical === null) return null;
  if (valueKind === 'AMOUNT') return `$${Number(value.canonical).toLocaleString('en-US')}`;
  if (valueKind === 'PERCENTAGE') return `${value.canonical}%`;
  if (valueKind === 'PERIOD') return `${value.canonical} ${String(value.unit || '').toLowerCase().replace(/_/g, ' ')}`.trim();
  return String(value.canonical);
}

// One row for the published/Query page: { column_id, header, pill_label |
// value_text | text | '—' } per column of the fact's resolved table, in
// column order. Returns [] when no table resolves for the fact.
function renderConclusionCells(fact, tableShapes) {
  const resolved = tableForFact(fact, tableShapes);
  if (!resolved) return [];
  const { table } = resolved;
  // The contract shape is an array of cells; a fact carrying any other shape renders as absent cells.
  const cells = Array.isArray(fact.conclusions?.cells) ? fact.conclusions.cells : [];
  const cellsByColumn = new Map(cells.map((cell) => [cell.column_id, cell]));
  return (table.columns || []).map((column) => {
    const header = column.header;
    const cell = cellsByColumn.get(column.column_id);
    if (!cell) return { column_id: column.column_id, header, text: '—' };
    if (column.render === 'vocabulary') {
      const entry = columnVocabulary(column, tableShapes).find((item) => item.code === cell.code);
      return { column_id: column.column_id, header, pill_label: entry ? entry.label : cell.code };
    }
    if (column.render === 'value') {
      return { column_id: column.column_id, header, value_text: formatValue(cell.value, column.value_kind) || '—' };
    }
    if (VALUE_RENDER_KINDS.has(column.render)) {
      return { column_id: column.column_id, header, text: cell.text || '—' };
    }
    if (column.render === 'boolean') {
      return { column_id: column.column_id, header, text: cell.present ? 'Present' : '—' };
    }
    return { column_id: column.column_id, header, text: '—' };
  });
}

module.exports = {
  contract,
  columnVocabulary,
  findTableByKey,
  tablesForFamily,
  familyHasTableShape,
  tableForFact,
  validateFactConclusions,
  renderConclusionCells,
  formatValue,
};
