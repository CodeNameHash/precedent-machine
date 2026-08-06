'use strict';

/**
 * lib/review-parity/run.js
 *
 * Wires case files -> views -> comparison -> report. Kept out of the CLI so
 * the whole pipeline is callable (and testable) without a process.
 */

const { compileMapping } = require('./mapping');
const { compareDeal, uncomparableDeal } = require('./compare');
const { buildReport } = require('./report');
const { buildLegacyRows, buildV2Rows } = require('./views');

/**
 * Run one family's comparison across a set of cases.
 *
 * @param {object}   args
 * @param {object}   args.mapping   raw or compiled mapping table
 * @param {object[]} args.cases     from loadCaseSet()
 * @param {object=}  args.corpus    { declared_deal_count, declared_deal_ids, source }
 */
function runComparison({ mapping: mappingInput, cases, corpus = {} }) {
  const mapping = mappingInput && mappingInput.mapping_id ? mappingInput : compileMapping(mappingInput);
  const deals = [];

  for (const item of cases) {
    if (item.family_id !== mapping.family_id) {
      deals.push(uncomparableDeal({
        deal_id: item.deal_id,
        deal_label: item.deal_label,
        family_id: mapping.family_id,
        reason: `case declares family "${item.family_id}" but the mapping is for "${mapping.family_id}"`,
        missing_sides: ['legacy', 'v2'],
      }));
      continue;
    }

    const missingSides = [];
    if (item.legacy.unavailable) missingSides.push('legacy');
    if (item.v2.unavailable) missingSides.push('v2');
    if (missingSides.length) {
      deals.push(uncomparableDeal({
        deal_id: item.deal_id,
        deal_label: item.deal_label,
        family_id: mapping.family_id,
        reason: [item.legacy.unavailable, item.v2.unavailable].filter(Boolean).join(' | '),
        missing_sides: missingSides,
      }));
      continue;
    }

    let legacyRows;
    let v2Rows;
    try {
      legacyRows = buildLegacyRows({
        mapping,
        deal_id: item.deal_id,
        cards: item.legacy.cards || [],
        review_deal_extra: item.review_deal_extra,
      });
    } catch (error) {
      deals.push(uncomparableDeal({
        deal_id: item.deal_id,
        deal_label: item.deal_label,
        family_id: mapping.family_id,
        reason: `legacy view failed: ${error && error.message}`,
        missing_sides: ['legacy'],
      }));
      continue;
    }
    try {
      v2Rows = buildV2Rows({
        mapping,
        deal_id: item.deal_id,
        cards: item.v2.cards,
        projection: item.v2.projection,
        resolution: item.v2.resolution,
        review_deal_extra: item.review_deal_extra,
      });
    } catch (error) {
      deals.push(uncomparableDeal({
        deal_id: item.deal_id,
        deal_label: item.deal_label,
        family_id: mapping.family_id,
        reason: `v2 view failed: ${error && error.message}`,
        missing_sides: ['v2'],
      }));
      continue;
    }

    deals.push(compareDeal({
      mapping,
      deal_id: item.deal_id,
      deal_label: item.deal_label,
      legacy_rows: legacyRows,
      v2_rows: v2Rows,
    }));
  }

  return buildReport({ mapping, deals, corpus });
}

module.exports = { runComparison };
