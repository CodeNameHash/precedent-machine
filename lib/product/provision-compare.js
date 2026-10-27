'use strict';

// Coded-cell comparison (work package 54, plan finding (301)). Rows are the
// schema's own provisions (table_key + row_label); columns are agreements; a
// cell is the presentation schema's answer for the fact that lands on that row
// — the same answer the deal page shows, so the two surfaces cannot disagree.
// A row that an agreement does not answer is a first-class result ("not
// stated"), and the distribution counts the answers across the compared set,
// which is the market position at n=2 and grows with the corpus.
const { answerFor } = require('./provision-presentation');

function keyOf(conclusion) {
  return `${conclusion?.table_key || ''}\u001f${conclusion?.row_label || ''}`;
}

/**
 * @param {Array} agreements [{ source_document_id, agreement_label, facts }]
 * @param {object} shapes contracts/product/table-shapes.v3.json
 */
function compareAcross(agreements, shapes) {
  const rows = new Map();
  for (const agreement of agreements || []) {
    for (const fact of agreement.facts || []) {
      const conclusion = fact.conclusions;
      if (!conclusion?.table_key) continue;
      const { answer, condition, extras } = answerFor(fact, shapes);
      if (!answer && !condition) continue;
      const key = keyOf(conclusion);
      if (!rows.has(key)) {
        rows.set(key, {
          table_key: conclusion.table_key,
          row_label: conclusion.row_label || '',
          by_source: {},
          answers: [],
        });
      }
      const row = rows.get(key);
      const cell = {
        answer: answer ? answer.text : null,
        condition: condition ? condition.text : null,
        extras: extras.map((entry) => entry.text),
        tone: answer?.tone || 'neutral',
        words: answer?.words || null,
      };
      if (!row.by_source[agreement.source_document_id]) row.by_source[agreement.source_document_id] = [];
      row.by_source[agreement.source_document_id].push(cell);
      if (cell.answer) row.answers.push(cell.answer);
    }
  }
  return [...rows.values()].map((row) => {
    const distribution = row.answers.reduce((counts, answer) => {
      counts[answer] = (counts[answer] || 0) + 1;
      return counts;
    }, {});
    return { ...row, n: row.answers.length, distribution };
  }).sort((left, right) => `${left.table_key}\u001f${left.row_label}`.localeCompare(`${right.table_key}\u001f${right.row_label}`));
}

module.exports = { compareAcross };
