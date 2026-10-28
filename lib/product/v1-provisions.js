'use strict';

// Reading the V1 corpus for a comparison (work package 54, finding (304)).
// The V1 provisions live in their own project, so this module takes a client
// rather than reaching for the product database: one deployment, two
// databases, and the comparison says which is which.
const { answerFromV1 } = require('./v1-answer-adapter');

const MAX_DEALS = 3;

/**
 * @param {object} client supabase client for the V1 corpus project
 * @param {string[]} dealIds
 * @returns {Promise<Array<{id, label, generation, rows}>>}
 */
async function v1Agreements(client, dealIds = []) {
  const ids = [...new Set((dealIds || []).filter(Boolean))].slice(0, MAX_DEALS);
  if (!client || ids.length === 0) return [];
  const deals = await client.from('deals').select('id, acquirer, target').in('id', ids);
  if (deals.error) throw new Error(`v1 deals: ${deals.error.message}`);
  const provisions = await client.from('provisions')
    .select('id, deal_id, type, category, ai_metadata, exceptions')
    .in('deal_id', ids);
  if (provisions.error) throw new Error(`v1 provisions: ${provisions.error.message}`);
  const byDeal = new Map(ids.map((id) => [id, []]));
  for (const provision of provisions.data || []) {
    const adapted = answerFromV1(provision);
    if (!adapted.answer && !adapted.condition) continue;
    byDeal.get(provision.deal_id)?.push(adapted);
  }
  return (deals.data || []).map((deal) => ({
    id: deal.id,
    label: [deal.target, deal.acquirer].filter(Boolean).join(' / ') || deal.id,
    generation: 'V1',
    rows: byDeal.get(deal.id) || [],
  })).sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * The comparison in one shape: V2 provision rows and V1 provision rows in the
 * same row space, each cell stamped with its generation so a pooled code is
 * never mistaken for agreement between the two vocabularies.
 */
function mergeGenerations(v2Rows = [], v1AgreementsList = []) {
  const rows = new Map();
  const ensure = (key, label) => {
    if (!rows.has(key)) rows.set(key, { key, label, cells: [] });
    return rows.get(key);
  };
  for (const row of v2Rows) {
    const key = `V2\u001f${row.table_key}\u001f${row.row_label}`;
    const entry = ensure(key, row.row_label || row.table_key);
    for (const [sourceId, cells] of Object.entries(row.by_source || {})) {
      for (const cell of cells) entry.cells.push({ ...cell, generation: 'V2', source_id: sourceId });
    }
  }
  for (const agreement of v1AgreementsList) {
    for (const adapted of agreement.rows) {
      const key = `V1\u001f${adapted.row_key}\u001f${adapted.row_label}`;
      const entry = ensure(key, adapted.row_label || adapted.row_key);
      if (adapted.answer) entry.cells.push({ answer: adapted.answer.text, condition: adapted.condition?.text || null, generation: 'V1', source_id: agreement.id });
    }
  }
  return [...rows.values()].sort((left, right) => left.label.localeCompare(right.label));
}

module.exports = { v1Agreements, mergeGenerations, MAX_DEALS };
