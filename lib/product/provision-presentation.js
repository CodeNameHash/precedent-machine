'use strict';

// The presentation schema for a provision page (work package 54, plan finding
// (300)). One module decides what a reader sees and where, so every family and
// both the review page and the released page obey the same rules.
//
// The rules, in order:
//   1. One fact, one answer. The main page shows the operative answer once;
//      the drafting that spells it out is a sidebar, not a row.
//   2. An answer is a period, a value, a code or a named condition. Only those
//      can be a pill. A phrase that merely qualifies where a term sits
//      ("after the agreement date") is drafting and never a pill.
//   3. A springing condition is its own field beside the answer, not a cell
//      among many: "within 10 business days · if a CMA Phase 2 reference is
//      made".
//   4. The sidebar explains the answer once: the as-drafted words with their
//      components, the interpretation, and how the corpus read it. Those are
//      one section, not two.
//
// Everything here is pure: it takes a fact with its conclusions and returns
// the presentation. No database, no model, no React.

const ANSWER_COLUMNS = ['period', 'duration', 'amount', 'value', 'fee', 'threshold', 'standard'];
const CONDITION_COLUMNS = ['condition', 'trigger', 'springing', 'prerequisite'];

function isBlank(cell) {
  return !cell || cell.kind === 'dash' || (!cell.label && !cell.words && !cell.text);
}

function textOf(cell) {
  return String(cell?.label || cell?.words || cell?.text || '').trim();
}

// The answer's kind decides whether it may wear a pill and which tone.
function kindOf(cell) {
  if (!cell) return null;
  // A condition column is a condition whatever shape the cell takes: the
  // trigger is the point, and it must not be swallowed as just another code.
  const column = String(cell.column_id || '').toLowerCase();
  if (column && CONDITION_COLUMNS.some((name) => column.includes(name))) return 'condition';
  if (cell.kind === 'value') return 'value';
  if (cell.kind === 'pill') return 'code';
  return 'drafting';
}

// Column priority: a period beats a value beats a code; a condition is kept
// separately rather than competing with the answer.
function rankOf(cell) {
  const column = String(cell?.column_id || '').toLowerCase();
  const index = ANSWER_COLUMNS.findIndex((name) => column.includes(name));
  return index === -1 ? ANSWER_COLUMNS.length : index;
}

/**
 * The answer for one fact: the single operative reading, the condition it
 * hangs on, and the coded extras that may be shown as pills beside it.
 */
function answerFor(fact) {
  const cells = Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells.filter((cell) => !isBlank(cell)) : [];
  const conditions = cells.filter((cell) => kindOf(cell) === 'condition');
  const answers = cells
    .filter((cell) => kindOf(cell) !== 'condition' && kindOf(cell) !== 'drafting')
    .sort((left, right) => rankOf(left) - rankOf(right));
  const chosen = answers[0] || null;
  const rest = answers.slice(1);
  const answer = chosen
    ? { text: textOf(chosen), kind: kindOf(chosen), pill: kindOf(chosen) !== 'drafting', tone: chosen.tone || 'neutral', column_id: chosen.column_id || null, words: String(chosen.words || '').trim() || null }
    : null;
  const condition = conditions.length
    ? { text: textOf(conditions[0]), kind: 'condition', pill: true, tone: conditions[0].tone || 'info', words: String(conditions[0].words || '').trim() || null }
    : null;
  // Extras are coded answers beside the chosen one; identical restatements are
  // dropped, which is what turned one deadline into three.
  const seen = new Set(answer ? [answer.text.toLowerCase()] : []);
  const extras = rest.reduce((list, cell) => {
    const text = textOf(cell);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return list;
    seen.add(key);
    list.push({ text, kind: kindOf(cell), pill: true, tone: cell.tone || 'neutral', column_id: cell.column_id || null });
    return list;
  }, []);
  return { answer, condition, extras };
}

/**
 * The sidebar's explanation, once: the drafting, the interpretation, the read.
 * `interpretation` and `reading` are the same question, so they are one block.
 */
function explanationFor(fact) {
  const cells = Array.isArray(fact?.conclusions?.cells) ? fact.conclusions.cells : [];
  const drafted = cells.filter((cell) => String(cell?.column_id || '').toLowerCase().includes('asdrafted'));
  const draftedText = drafted.map((cell) => String(cell.text || cell.words || '').trim()).filter(Boolean);
  return {
    statement: String(fact?.statement || '').trim(),
    headline: fact?.headline || null,
    as_drafted: draftedText.length ? draftedText.join(' / ') : String(fact?.statement || '').trim(),
    components: Array.isArray(fact?.components) ? fact.components : [],
    interpretation: fact?.conclusions?.row_label ? String(fact.conclusions.row_label) : null,
    table_key: fact?.conclusions?.table_key || null,
  };
}

module.exports = { answerFor, explanationFor, CONDITION_COLUMNS, ANSWER_COLUMNS };
