'use strict';

// The coded comparison: one row per provision (table_key + row_label), one
// column per run, each cell the presentation schema's answer for the fact
// that lands there. The table shapes and the answer rule are the same ones
// the released page uses, so the comparison cannot disagree with a deal page.
//
// Pure functions only. The APIs pass published facts and draft facts into
// these builders; the pages render the result.

const { answerFor } = require('./provision-presentation');

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

function componentIdsOf(fact) {
  const cells = Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells : [];
  return [...new Set(cells.flatMap((cell) => (Array.isArray(cell?.component_ids) ? cell.component_ids : [])))];
}

// One fact's coded reading. A fact whose conclusions carry only drafting is
// not a coded cell: it must not become a pill or a row.
function codedCellForFact(fact, shapes) {
  const conclusions = fact?.conclusions;
  if (!conclusions?.table_key || !conclusions?.row_label) return null;
  const { answer, condition, extras } = answerFor(fact, shapes);
  if (!answer && !condition && extras.length === 0) return null;
  return {
    fact_id: factIdOf(fact),
    run_id: fact?.run_id || null,
    table_key: conclusions.table_key,
    row_label: conclusions.row_label,
    row_detail: typeof conclusions.row_detail === 'string' && conclusions.row_detail.trim() ? conclusions.row_detail.trim() : null,
    family_key: fact?.family_key || null,
    subtype_key: fact?.subtype_key || null,
    section_reference: fact?.section_reference || null,
    statement: typeof fact?.statement === 'string' ? fact.statement : null,
    summary: typeof fact?.headline?.summary === 'string' ? fact.headline.summary : null,
    headline: typeof fact?.headline?.label === 'string' ? fact.headline.label : null,
    answer: answer ? { text: answer.text, tone: answer.tone || 'neutral', words: answer.words || null } : null,
    condition: condition ? { text: condition.text, words: condition.words || null } : null,
    extras: extras.map((entry) => ({ text: entry.text, tone: entry.tone || 'neutral' })),
    words: answer?.words || condition?.words || null,
    component_ids: componentIdsOf(fact),
  };
}

function rowKeyOf(tableKey, rowLabel) {
  return `${tableKey || ''}${ROW_SEPARATOR}${rowLabel || ''}`;
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
 * Align every run's coded facts into tables and rows.
 * @param {{ runs: Array<{run_id: string, facts: Array}>, shapes: object }} input
 * @returns {Array} tables, each with rows and each row with by_run and a distribution.
 */
function buildComparisonTables({ runs = [], shapes = null } = {}) {
  const directory = tableDirectory(shapes);
  const rows = new Map();
  for (const run of runs) {
    if (!run?.run_id) continue;
    for (const fact of run.facts || []) {
      const cell = codedCellForFact(fact, shapes);
      if (!cell) continue;
      cell.run_id = run.run_id;
      const key = rowKeyOf(cell.table_key, cell.row_label);
      if (!rows.has(key)) {
        rows.set(key, {
          table_key: cell.table_key,
          row_label: cell.row_label,
          details: new Set(),
          by_run: {},
        });
      }
      const row = rows.get(key);
      if (cell.row_detail) row.details.add(cell.row_detail);
      if (!row.by_run[run.run_id]) row.by_run[run.run_id] = [];
      row.by_run[run.run_id].push(cell);
    }
  }
  const tables = new Map();
  for (const row of rows.values()) {
    if (!tables.has(row.table_key)) {
      const meta = directory.get(row.table_key) || null;
      tables.set(row.table_key, {
        table_key: row.table_key,
        label: meta?.label || humanize(row.table_key),
        section_key: meta?.section_key || null,
        section_title: meta?.section_title || null,
        group_header: meta?.group_header || null,
        order: meta?.order ?? Number.MAX_SAFE_INTEGER,
        column_count: meta?.column_count || 0,
        rows: [],
      });
    }
    tables.get(row.table_key).rows.push({
      table_key: row.table_key,
      row_label: row.row_label,
      row_details: [...row.details].sort(),
      by_run: row.by_run,
      n: Object.keys(row.by_run).length,
      distribution: distributionOf(row.by_run),
    });
  }
  return [...tables.values()]
    .map((table) => ({ ...table, rows: table.rows.sort(compareRowLabel), row_count: table.rows.length }))
    .sort((left, right) => left.order - right.order || left.table_key.localeCompare(right.table_key));
}

// The runs endpoint's coded counts. A fact without a readout is a fact, not a
// coded cell; the index says "coded" rather than "facts" for that reason.
function codedFactStats(facts, shapes) {
  const tableKeys = new Set();
  const rowKeys = new Set();
  let coded = 0;
  for (const fact of facts || []) {
    const cell = codedCellForFact(fact, shapes);
    if (!cell) continue;
    coded += 1;
    tableKeys.add(cell.table_key);
    rowKeys.add(rowKeyOf(cell.table_key, cell.row_label));
  }
  return { coded_fact_count: coded, table_count: tableKeys.size, row_count: rowKeys.size };
}

/**
 * How common each coded answer is for one table, over a reference set of
 * runs. The denominator is the answering runs for the row; runs that do not
 * state the provision are counted as "not stated", never as a "No".
 * @param {{ conclusions: Array, tableKey: string, shapes: object, runIds: Array<string> }} input
 */
function howCommonFromConclusions({ conclusions = [], tableKey = null, shapes = null, runIds = [] } = {}) {
  const reference = [...new Set((runIds || []).filter(Boolean))];
  const referenceSet = new Set(reference);
  const rows = new Map();
  for (const conclusion of conclusions) {
    if (!conclusion?.table_key || conclusion.table_key !== tableKey) continue;
    if (!conclusion.row_label) continue;
    if (conclusion.run_id && referenceSet.size > 0 && !referenceSet.has(conclusion.run_id)) continue;
    const { answer } = answerFor({
      conclusions: {
        table_key: conclusion.table_key,
        row_label: conclusion.row_label,
        cells: conclusion.cells,
      },
    }, shapes);
    if (!answer?.text) continue;
    if (!rows.has(conclusion.row_label)) rows.set(conclusion.row_label, new Map());
    const byRun = rows.get(conclusion.row_label);
    const runId = conclusion.run_id || 'unknown';
    if (!byRun.has(runId)) byRun.set(runId, new Set());
    byRun.get(runId).add(answer.text);
  }
  const directory = tableDirectory(shapes);
  const meta = tableKey ? directory.get(tableKey) || null : null;
  const out = [...rows.entries()].map(([rowLabel, byRun]) => {
    const entries = new Map();
    for (const [runId, values] of byRun.entries()) {
      for (const value of values) {
        if (!entries.has(value)) entries.set(value, new Set());
        entries.get(value).add(runId);
      }
    }
    const answered = byRun.size;
    return {
      row_label: rowLabel,
      answered,
      runs_total: reference.length,
      not_stated: Math.max(0, reference.length - answered),
      entries: [...entries.entries()]
        .map(([value, ids]) => ({
          value,
          count: ids.size,
          share: reference.length ? ids.size / reference.length : 0,
          run_ids: [...ids].sort(),
        }))
        .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
    };
  }).sort((left, right) => left.row_label.localeCompare(right.row_label, undefined, { numeric: true }));
  return {
    table_key: tableKey,
    table_label: meta?.label || (tableKey ? humanize(tableKey) : null),
    section_key: meta?.section_key || null,
    section_title: meta?.section_title || null,
    runs_total: reference.length,
    rows: out,
  };
}

module.exports = {
  ROW_SEPARATOR,
  humanize,
  tableDirectory,
  factIdOf,
  codedCellForFact,
  buildComparisonTables,
  codedFactStats,
  howCommonFromConclusions,
};
