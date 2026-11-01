'use strict';

// The coded comparison: one row per provision, one column per run, every
// reading taken from the built page view (lib/product/comparison-view.js,
// which wraps lib/product/table-view.js buildTableView). This is the
// package 1 review's blocker 1/2/3: a comparison cell and a how-common
// count are the page's own cells, not a second reading of the conclusions.
//
// Pure functions. The APIs load views; these builders align and count them.

const { answerFor } = require('./provision-presentation');
const { viewReadings, marketDistribution } = require('./comparison-view');

const ROW_SEPARATOR = '\u001f';

function humanize(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tableDirectory(shapes) {
  const directory = new Map();
  const sections = Array.isArray(shapes?.sections) ? shapes.sections : [];
  sections.forEach((section, sectionIndex) => {
    const tables = Array.isArray(section.tables) ? section.tables : [];
    tables.forEach((table, tableIndex) => {
      if (!table?.table_key) return;
      const sectionTitle = section.title || humanize(section.section_key);
      const suffix = String(table.table_key).startsWith(`${section.section_key}-`)
        ? String(table.table_key).slice(String(section.section_key).length + 1)
        : table.table_key;
      const label = table.group_header
        ? `${sectionTitle} · ${table.group_header}`
        : (tables.length > 1 ? `${sectionTitle} · ${humanize(suffix)}` : sectionTitle);
      directory.set(table.table_key, {
        table_key: table.table_key,
        section_key: section.section_key || null,
        section_title: sectionTitle,
        group_header: table.group_header || null,
        label,
        order: sectionIndex * 1000 + tableIndex,
        column_count: Array.isArray(table.columns) ? table.columns.length : 0,
      });
    });
  });
  return directory;
}

function factIdOf(fact) {
  return fact?.fact_id || fact?.proposal_id || fact?.review_item_id || fact?.source_id || null;
}

function distributionOf(byRun) {
  const answers = new Map();
  for (const cells of Object.values(byRun || {})) {
    const seen = new Set();
    for (const cell of cells || []) {
      const value = cell?.answer?.text;
      if (!value || seen.has(value)) continue;
      seen.add(value);
      answers.set(value, (answers.get(value) || 0) + 1);
    }
  }
  return [...answers.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function compareRowLabel(left, right) {
  return String(left?.row_label || '').localeCompare(String(right?.row_label || ''), undefined, { numeric: true });
}

/**
 * Align built views into tables and rows. Each reading in a run's column is
 * one cell from the page: a pill, a value, a sub-row, or a coded Other
 * provision. A run with no reading for a row is absent from it (the page
 * renders that as "Not stated").
 * @param {Array} views objects from lib/product/comparison-view.js
 */
function buildComparisonTablesFromViews(views = []) {
  const tables = new Map();
  for (const view of views) {
    for (const table of view?.tables || []) {
      if (!tables.has(table.table_key)) {
        tables.set(table.table_key, {
          table_key: table.table_key,
          label: table.label,
          section_key: table.section_key || null,
          section_title: table.section_title || null,
          group_header: table.group_header || null,
          order: table.order ?? Number.MAX_SAFE_INTEGER,
          column_count: table.column_count || 0,
          rows: new Map(),
        });
      }
      const target = tables.get(table.table_key);
      for (const row of table.rows || []) {
        if (!target.rows.has(row.row_label)) {
          target.rows.set(row.row_label, { table_key: row.table_key, row_label: row.row_label, details: new Set(), by_run: {} });
        }
        const targetRow = target.rows.get(row.row_label);
        if (row.row_detail) targetRow.details.add(row.row_detail);
        if (!targetRow.by_run[view.run_id]) targetRow.by_run[view.run_id] = [];
        for (const reading of row.cells || []) {
          targetRow.by_run[view.run_id].push({
            fact_id: (reading.fact_ids || [])[0] || null,
            run_id: view.run_id,
            table_key: reading.table_key,
            row_label: reading.row_label,
            row_detail: reading.row_detail || null,
            column_id: reading.column_id || null,
            column_header: reading.column_header || null,
            code: reading.code || null,
            answer: { text: reading.label, tone: reading.tone || 'neutral', words: reading.words || null },
            condition: null,
            extras: [],
            words: reading.words || null,
            qualifier: reading.qualifier || null,
            suffix: reading.suffix || null,
            component_ids: reading.component_ids || [],
            statement: null,
            summary: null,
          });
        }
      }
    }
  }
  return [...tables.values()]
    .map((table) => {
      const rows = [...table.rows.values()].map((row) => ({
        table_key: row.table_key,
        row_label: row.row_label,
        row_details: [...row.details].sort(),
        by_run: row.by_run,
        n: Object.keys(row.by_run).length,
        distribution: distributionOf(row.by_run),
      })).sort(compareRowLabel);
      return { ...table, rows, row_count: rows.length };
    })
    .filter((table) => table.rows.length > 0)
    .sort((left, right) => left.order - right.order || left.table_key.localeCompare(right.table_key));
}

/**
 * How common each coded answer is for one table over a reference set of
 * built views. A run counts once per value per row; each value of a
 * multi-value cell counts; a sub-row and a coded Other provision count as
 * their own rows. The denominator is answering runs and not-stated is kept
 * apart, never a "No".
 */
function howCommonFromViews(views = [], tableKey = null) {
  const runIds = (views || []).map((view) => view.run_id).filter(Boolean);
  const rows = new Map();
  for (const view of views || []) {
    const table = (view.tables || []).find((candidate) => candidate.table_key === tableKey) || null;
    if (!table) continue;
    for (const row of table.rows || []) {
      if (!rows.has(row.row_label)) rows.set(row.row_label, new Map());
      const byRun = rows.get(row.row_label);
      if (!byRun.has(view.run_id)) byRun.set(view.run_id, new Set());
      for (const reading of row.cells || []) {
        const value = reading.code || reading.label;
        if (value) byRun.get(view.run_id).add(value);
      }
    }
  }
  const firstTable = (views || []).map((view) => (view.tables || []).find((candidate) => candidate.table_key === tableKey)).find(Boolean) || null;
  const out = [...rows.entries()].map(([rowLabel, byRun]) => {
    const entries = new Map();
    for (const [runId, values] of byRun.entries()) {
      for (const value of values) {
        if (!entries.has(value)) entries.set(value, new Set());
        entries.get(value).add(runId);
      }
    }
    const answered = byRun.size;
    const labels = new Map();
    for (const view of views || []) {
      const table = (view.tables || []).find((candidate) => candidate.table_key === tableKey) || null;
      const row = (table?.rows || []).find((candidate) => candidate.row_label === rowLabel);
      for (const reading of row?.cells || []) {
        if (reading.code && !labels.has(reading.code)) labels.set(reading.code, reading.label);
      }
    }
    return {
      row_label: rowLabel,
      answered,
      runs_total: runIds.length,
      not_stated: Math.max(0, runIds.length - answered),
      entries: [...entries.entries()]
        .map(([value, ids]) => ({
          value: labels.get(value) || value,
          code: value,
          count: ids.size,
          share: runIds.length ? ids.size / runIds.length : 0,
          run_ids: [...ids].sort(),
        }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
    };
  }).sort((left, right) => left.row_label.localeCompare(right.row_label, undefined, { numeric: true }));
  return {
    table_key: tableKey,
    table_label: firstTable?.label || (tableKey ? humanize(tableKey) : null),
    section_key: firstTable?.section_key || null,
    section_title: firstTable?.section_title || null,
    runs_total: runIds.length,
    rows: out,
  };
}

// The quiet line under a coded answer. Value cells compare by label; code
// cells by code. A tie for modal is the selected deal's own reading
// (Ben's "market" when the deal is at the top of the distribution).
function marketLine(distribution, value) {
  const total = Number(distribution?.total || 0);
  if (total <= 1) return { kind: 'alone', text: 'No comparison · only deal with this row' };
  const entries = Object.entries(distribution?.codes || {})
    .map(([code, entry]) => ({ code, label: entry.label || code, count: Number(entry.count || 0) }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  if (entries.length === 0) return { kind: 'alone', text: 'No comparison · only deal with this row' };
  const selected = entries.find((entry) => entry.code === value || entry.label === value) || null;
  const max = Math.max(...entries.map((entry) => entry.count));
  const modal = entries.find((entry) => entry.count === max && selected && (entry.code === selected.code || entry.label === selected.label))
    || entries.find((entry) => entry.count === max);
  if (selected && modal && selected.code === modal.code && selected.count === modal.count) {
    return { kind: 'market', text: `Market · ${modal.count} of ${total} deals` };
  }
  const others = entries.filter((entry) => !selected || entry.code !== selected.code).slice(0, 2).map((entry) => entry.label).join(', ');
  return { kind: 'off', text: `Off-market · ${selected?.count || 0} of ${total} · others: ${others}` };
}

// The runs endpoint's coded counts. A fact without a readout is a fact, not a
// coded cell; the index says "coded" rather than "facts" for that reason.
function codedFactStats(facts, shapes) {
  const tableKeys = new Set();
  const rowKeys = new Set();
  let coded = 0;
  for (const fact of facts || []) {
    const conclusion = fact?.conclusions;
    if (!conclusion?.table_key || !conclusion?.row_label) continue;
    const { answer, condition, extras } = answerFor(fact, shapes);
    if (!answer && !condition && extras.length === 0) continue;
    coded += 1;
    tableKeys.add(conclusion.table_key);
    rowKeys.add(`${conclusion.table_key}${ROW_SEPARATOR}${conclusion.row_label}`);
  }
  return { coded_fact_count: coded, table_count: tableKeys.size, row_count: rowKeys.size };
}

module.exports = {
  ROW_SEPARATOR,
  humanize,
  tableDirectory,
  factIdOf,
  buildComparisonTablesFromViews,
  howCommonFromViews,
  marketLine,
  marketDistribution,
  codedFactStats,
  viewReadings,
};
