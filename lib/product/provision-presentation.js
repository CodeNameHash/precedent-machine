'use strict';

// The presentation schema for a provision page (work package 54, plan finding
// (300)). One module decides what a reader sees and where, so every family and
// every surface obey the same rules.
//
//   1. One fact, one answer. The main page shows the operative answer once; the
//      drafting that spells it out belongs in the sidebar.
//   2. An answer is a period, a value, a code or a named condition. Only those
//      can be a pill. A phrase that merely says where a term sits ("after the
//      agreement date") is drafting and is never a pill.
//   3. A springing condition is its own field beside the answer, not one cell
//      among many: "within 10 business days · if a CMA Phase 2 reference".
//   4. The sidebar explains once: the as-drafted words, the table and the read.
//
// Pure functions. The vocabulary comes from contracts/product/table-shapes.v3
// so a code is shown in the words the schema defines for it, not as a snake.

const DRAFTING_COLUMNS = ['asdrafted', 'as_drafted', 'verbatim'];
const ANSWER_COLUMN_ORDER = ['period', 'duration', 'time', 'amount', 'value', 'fee', 'threshold', 'standard'];
const CONDITION_COLUMNS = ['condition', 'trigger', 'springing', 'prerequisite'];

function tablesOf(shapes) {
  const sections = Array.isArray(shapes?.sections) ? shapes.sections : [];
  return sections.flatMap((section) => (Array.isArray(section.tables) ? section.tables : []));
}

function columnOf(shapes, tableKey, columnId) {
  const table = tablesOf(shapes).find((candidate) => candidate.table_key === tableKey);
  if (!table) return null;
  return (table.columns || []).find((column) => column.column_id === columnId) || null;
}

/** The schema's own words for a code, or a readable fall-back. */
function labelForCode(code, { shapes = null, tableKey = null, columnId = null } = {}) {
  if (!code) return '';
  const column = shapes && tableKey && columnId ? columnOf(shapes, tableKey, columnId) : null;
  const entry = (column?.vocabulary || []).find((candidate) => candidate.code === code);
  if (entry?.label) return entry.label;
  const shared = shapes?.shared_vocabularies?.[column?.vocabulary_key];
  const sharedEntry = Array.isArray(shared) ? shared.find((candidate) => candidate.code === code) : null;
  if (sharedEntry?.label) return sharedEntry.label;
  return String(code).toLowerCase().split('_').filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function toneForCode(code, { shapes = null, tableKey = null, columnId = null } = {}) {
  const column = shapes && tableKey && columnId ? columnOf(shapes, tableKey, columnId) : null;
  const entry = (column?.vocabulary || []).find((candidate) => candidate.code === code);
  return entry?.tone || 'neutral';
}

function columnKind(cell, context) {
  const columnId = String(cell?.column_id || '');
  const lower = columnId.toLowerCase();
  if (DRAFTING_COLUMNS.includes(lower)) return 'drafting';
  // The schema's own column type wins: a "trigger" column on a fee table is a
  // coded trigger, not the springing condition of a covenant. A condition is
  // a column of that name carrying words.
  const column = context.shapes && context.tableKey ? columnOf(context.shapes, context.tableKey, columnId) : null;
  if (column?.render === 'vocabulary') return 'code';
  if (column?.render === 'value') return 'value';
  if (CONDITION_COLUMNS.some((name) => lower.includes(name)) && (cell?.text || cell?.label) && !cell?.code) return 'condition';
  if (cell?.code) return 'code';
  return 'drafting';
}

function textOf(cell, context) {
  if (!cell) return '';
  if (cell.code) return labelForCode(cell.code, { ...context, columnId: cell.column_id });
  return String(cell.label || cell.text || cell.words || '').trim();
}

function rankOf(columnId) {
  const lower = String(columnId || '').toLowerCase();
  const index = ANSWER_COLUMN_ORDER.findIndex((name) => lower.includes(name));
  return index === -1 ? ANSWER_COLUMN_ORDER.length : index;
}

/**
 * The answer for one fact: one operative reading, the condition it hangs on,
 * and the coded extras beside it.
 */
function answerFor(fact, shapes = null) {
  const tableKey = fact?.conclusions?.table_key || null;
  const context = { shapes, tableKey };
  const cells = (Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells : [])
    .filter((cell) => cell && (cell.code || cell.text || cell.label));
  const classified = cells.map((cell) => ({ cell, kind: columnKind(cell, context) }));
  const conditions = classified.filter((entry) => entry.kind === 'condition');
  const answers = classified
    .filter((entry) => entry.kind === 'code' || entry.kind === 'value')
    .sort((left, right) => rankOf(left.cell.column_id) - rankOf(right.cell.column_id));
  const chosen = answers[0] || null;
  const answer = chosen ? {
    text: textOf(chosen.cell, context),
    kind: chosen.kind,
    pill: true,
    tone: chosen.kind === 'code' ? toneForCode(chosen.cell.code, { ...context, columnId: chosen.cell.column_id }) : 'neutral',
    column_id: chosen.cell.column_id || null,
    words: String(chosen.cell.text || '').trim() || null,
  } : null;
  const condition = conditions.length ? {
    text: textOf(conditions[0].cell, context),
    kind: 'condition',
    pill: true,
    tone: 'info',
    words: String(conditions[0].cell.text || '').trim() || null,
  } : null;
  const seen = new Set(answer ? [answer.text.toLowerCase()] : []);
  const extras = answers.slice(1).reduce((list, entry) => {
    const text = textOf(entry.cell, context);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return list;
    seen.add(key);
    list.push({ text, kind: entry.kind, pill: true, tone: toneForCode(entry.cell.code, { ...context, columnId: entry.cell.column_id }), column_id: entry.cell.column_id || null });
    return list;
  }, []);
  return { answer, condition, extras };
}

/** The sidebar's explanation, once: drafting, table and read together. */
function explanationFor(fact) {
  const cells = Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells : [];
  const drafted = cells
    .filter((cell) => DRAFTING_COLUMNS.includes(String(cell?.column_id || '').toLowerCase()))
    .map((cell) => String(cell.text || cell.words || '').trim())
    .filter(Boolean);
  return {
    statement: String(fact?.statement || '').trim(),
    headline: fact?.headline || null,
    as_drafted: drafted.length ? drafted.join(' / ') : String(fact?.statement || '').trim(),
    components: Array.isArray(fact?.components) ? fact.components : [],
    interpretation: fact?.conclusions?.row_label ? String(fact.conclusions.row_label) : null,
    table_key: fact?.conclusions?.table_key || null,
  };
}

module.exports = { answerFor, explanationFor, labelForCode, CONDITION_COLUMNS, ANSWER_COLUMN_ORDER };
