'use strict';

// The built page view, normalised once for the comparison surfaces (work
// package 2, note DEEPSEEK-WORK-PACKAGE-2-COMPARE-2026-11-01; the package 1
// review's blocker 1). Every cell here comes from lib/product/table-view.js
// buildTableView(), the same view the lawyer preview and the released deal
// page render, so a comparison line and the deal page cannot disagree.
//
// A "reading" is one coded answer: a pill or a value cell, one per value of
// a multi-value cell, and the coded cells of Other provisions. A text cell
// (as drafted, party, resolved reference) is not a coded answer and never
// becomes a market line or a comparison reading.

const { buildTableView, factIdOf } = require('./table-view');

function humanize(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tableLabel(section, table, index) {
  const title = section.title || humanize(section.section_key);
  if (table.group_header) return `${title} · ${table.group_header}`;
  if ((section.tables || []).length > 1) {
    const suffix = String(table.table_key || '').startsWith(`${section.section_key}-`)
      ? String(table.table_key).slice(String(section.section_key).length + 1)
      : table.table_key;
    return `${title} · ${humanize(suffix)}`;
  }
  return title;
}

function vocabularyLabel(column, code, tableShapes) {
  if (!column || !code) return code || null;
  const entry = (column.vocabulary || []).find((candidate) => candidate.code === code);
  if (entry?.label) return entry.label;
  const shared = Array.isArray(tableShapes?.shared_vocabularies?.[column.vocabulary_ref])
    ? tableShapes.shared_vocabularies[column.vocabulary_ref] : [];
  const sharedEntry = shared.find((candidate) => candidate.code === code);
  return sharedEntry?.label || humanize(code);
}

function readingFromValue(value, { table, line, column, tableShapes, parentSubject = null }) {
  const label = value?.label ?? value?.text ?? null;
  if (!label) return null;
  const kind = value?.kind || (value?.code ? 'pill' : 'value');
  if (kind !== 'pill' && kind !== 'value') return null;
  return {
    table_key: table.table_key,
    row_label: line.subject,
    row_detail: parentSubject,
    column_id: value?.column_id || column?.column_id || null,
    column_header: column?.header || null,
    code: value?.code || null,
    label,
    kind,
    tone: value?.tone || 'neutral',
    words: value?.words || null,
    qualifier: value?.qualifier || null,
    suffix: value?.suffix || null,
    many: value?.many || null,
    values: value?.values || null,
    component_ids: value?.component_ids || [],
    fact_ids: value?.fact_ids || [],
    source_order: value?.source_order ?? null,
  };
}

function readingsFromCells(cells, { table, line, tableShapes, parentSubject = null }) {
  const out = [];
  for (const cell of cells || []) {
    if (!cell || cell.kind === 'dash') continue;
    const column = (table.columns || []).find((candidate) => candidate.column_id === cell.column_id) || null;
    if (Array.isArray(cell.values) && cell.values.length > 1) {
      for (const value of cell.values) {
        const reading = readingFromValue({ ...value, column_id: cell.column_id }, { table, line, column, tableShapes, parentSubject });
        if (reading) out.push(reading);
      }
      continue;
    }
    if (Array.isArray(cell.many) && cell.many.length > 0) {
      for (const value of cell.many) {
        const reading = readingFromValue({ ...value, column_id: cell.column_id }, { table, line, column, tableShapes, parentSubject });
        if (reading) out.push(reading);
      }
      continue;
    }
    const reading = readingFromValue({ ...cell, column_id: cell.column_id }, { table, line, column, tableShapes, parentSubject });
    if (reading) out.push(reading);
  }
  return out;
}

// Other provisions are lines of a table view, not rows: their built group
// carries the fact id but not its coded cells. The fact's own conclusions
// are read here, through the table's own columns and vocabulary, so a coded
// Other provision still counts and still shows a market line.
function readingsFromOtherProvisionGroup(group, { table, factsById, tableShapes }) {
  const out = [];
  const facts = (group.branches || []).map((branch) => factsById.get(branch.fact_id)).filter(Boolean);
  for (const fact of facts) {
    const conclusions = fact.conclusions;
    if (!conclusions || !Array.isArray(conclusions.cells)) continue;
    const rowLabel = group.term || 'Other provisions';
    for (const cell of conclusions.cells) {
      const column = (table.columns || []).find((candidate) => candidate.column_id === cell?.column_id) || null;
      let label = null;
      let kind = 'pill';
      let code = cell?.code || null;
      if (cell?.code) {
        label = vocabularyLabel(column, cell.code, tableShapes);
        kind = 'pill';
      } else if (cell?.text) {
        label = String(cell.text).trim() || null;
        kind = 'text';
      } else if (cell?.value && cell.value.canonical !== undefined) {
        label = String(cell.value.canonical);
        kind = 'value';
      } else if (cell?.present === true) {
        label = 'Present';
        kind = 'pill';
      }
      if (!label || (kind !== 'pill' && kind !== 'value')) continue;
      out.push({
        table_key: table.table_key,
        row_label: rowLabel,
        row_detail: group.common_text ? group.term || null : null,
        column_id: cell.column_id || null,
        column_header: column?.header || null,
        code,
        label,
        kind,
        tone: kind === 'pill' ? 'standard' : 'value',
        words: cell.text || null,
        qualifier: null,
        suffix: null,
        many: null,
        values: null,
        component_ids: Array.isArray(cell.component_ids) ? cell.component_ids : [],
        fact_ids: [factIdOf(fact)],
        source_order: null,
      });
    }
  }
  return out;
}

/**
 * Normalise one buildTableView() result into the comparison shape.
 * @param {{ view: object, facts: Array, tableShapes: object }} input
 */
function normalizeComparisonView({ view, facts = [], tableShapes = null } = {}) {
  const factsById = new Map((facts || []).filter(Boolean).map((fact) => [factIdOf(fact), fact]));
  const tables = [];
  (view?.sections || []).forEach((section, sectionIndex) => {
    (section.tables || []).forEach((table, tableIndex) => {
      const rows = [];
      for (const row of table.rows || []) {
        const rowReadings = readingsFromCells(row.cells, { table, line: row, tableShapes });
        if (rowReadings.length) rows.push({ table_key: table.table_key, row_label: row.subject, row_detail: null, cells: rowReadings });
        for (const subRow of row.sub_rows || []) {
          const subReadings = readingsFromCells(subRow.cells, { table, line: subRow, tableShapes, parentSubject: row.subject });
          if (subReadings.length) rows.push({ table_key: table.table_key, row_label: subRow.subject, row_detail: row.subject, cells: subReadings });
        }
      }
      for (const group of table.other_provisions || []) {
        const otherReadings = readingsFromOtherProvisionGroup(group, { table, factsById, tableShapes });
        for (const reading of otherReadings) {
          const existing = rows.find((row) => row.table_key === reading.table_key && row.row_label === reading.row_label && row.row_detail === reading.row_detail);
          if (existing) existing.cells.push(reading);
          else rows.push({ table_key: table.table_key, row_label: reading.row_label, row_detail: reading.row_detail, cells: [reading] });
        }
      }
      if (rows.length === 0) return;
      tables.push({
        table_key: table.table_key,
        section_key: section.section_key || null,
        section_title: section.title || humanize(section.section_key),
        group_header: table.group_header || null,
        label: tableLabel(section, table, tableIndex),
        order: sectionIndex * 1000 + tableIndex,
        column_count: (table.columns || []).length,
        rows,
      });
    });
  });
  return { tables };
}

function buildComparisonView({ facts = [], heldFacts = [], tableShapes = null, legalSchema = null } = {}) {
  return normalizeComparisonView({
    view: buildTableView({ facts, heldFacts, tableShapes, legalSchema }),
    facts,
    tableShapes,
  });
}

function viewReadings(view) {
  const out = [];
  for (const table of view?.tables || []) {
    for (const row of table.rows || []) {
      for (const cell of row.cells || []) out.push({ ...cell, table_key: table.table_key, table_label: table.label, section_title: table.section_title });
    }
  }
  return out;
}

function rowKey(tableKey, rowLabel, columnId) {
  return `${tableKey || ''}|${rowLabel || ''}|${columnId || ''}`;
}

/**
 * The market distribution over built views, for one selected run (or all).
 * A run counts once per code on a cell; a multi-value cell contributes each
 * value; a value cell compares by its label. total is the runs that answer
 * that table/row/column, so a row only one deal has is "alone".
 */
function marketDistribution(views = [], selectedRunId = null) {
  const byKey = new Map();
  for (const view of views) {
    for (const reading of viewReadings(view)) {
      const key = rowKey(reading.table_key, reading.row_label, reading.column_id);
      if (!byKey.has(key)) byKey.set(key, { table_key: reading.table_key, row_label: reading.row_label, column_id: reading.column_id, total: new Set(), codes: new Map() });
      const entry = byKey.get(key);
      entry.total.add(view.run_id);
      const value = reading.code || reading.label;
      if (!value) continue;
      if (!entry.codes.has(value)) entry.codes.set(value, { label: reading.label || value, run_ids: new Set() });
      entry.codes.get(value).run_ids.add(view.run_id);
    }
  }
  const selected = selectedRunId ? views.find((view) => view.run_id === selectedRunId) : null;
  const selectedKeys = selected ? new Set(viewReadings(selected).map((reading) => rowKey(reading.table_key, reading.row_label, reading.column_id))) : null;
  const cells = {};
  for (const [key, entry] of byKey.entries()) {
    if (selectedKeys && !selectedKeys.has(key)) continue;
    const codes = {};
    for (const [value, code] of entry.codes.entries()) {
      codes[value] = { label: code.label, count: code.run_ids.size, run_ids: [...code.run_ids].sort() };
    }
    cells[key] = { total: entry.total.size, codes };
  }
  const runs = {};
  for (const view of views) runs[view.run_id] = view.agreement_label || view.run_id;
  return { total_runs: views.length, runs, cells };
}

module.exports = {
  humanize,
  tableLabel,
  normalizeComparisonView,
  buildComparisonView,
  viewReadings,
  rowKey,
  marketDistribution,
};
