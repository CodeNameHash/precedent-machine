'use strict';

/**
 * lib/review-parity/report.js
 *
 * Aggregation and rendering. Byte-deterministic by construction: no clock,
 * no locale, no unordered iteration. Two runs over the same inputs produce
 * the same bytes, which is what makes the report checkable into a repo and
 * diffable across a migration.
 *
 * The report leads with row-level V2_LOSS. A row that legacy renders and
 * Canonical V2 does not is the failure mode nobody can eyeball their way to,
 * so it gets its own headline, its own section, and its own line in the
 * one-line summary -- it can never be buried inside a total.
 */

const { contentId } = require('../canonical-v2/canonical-bytes');
const { compareCodeUnits, sortStrings } = require('./normalise');
const { OUTCOMES, OUTCOME_ORDER, emptyCounts } = require('./compare');

const REPORT_SCHEMA = 'REVIEW_PARITY_REPORT/V1';

// Exit codes. Documented here because the CLI is the contract.
const EXIT = Object.freeze({
  CLEAN: 0,
  SUBSTANTIVE_DIFFERENCE: 1,
  INCOMPLETE_COVERAGE: 2,
  USAGE_ERROR: 3,
});

const TEXT_VALUE_LIMIT = 240;

function truncate(value) {
  if (value === null || value === undefined) return '(absent)';
  const text = String(value);
  if (text.length <= TEXT_VALUE_LIMIT) return text;
  return `${text.slice(0, TEXT_VALUE_LIMIT)}… (+${text.length - TEXT_VALUE_LIMIT} chars)`;
}

function renderRowKey(rowKey) {
  const keys = sortStrings(Object.keys(rowKey || {}));
  if (!keys.length) return '(no key)';
  return keys.map((key) => `${key}=${rowKey[key] === null ? '(absent)' : rowKey[key]}`).join(', ');
}

/**
 * Build the aggregate report.
 *
 * @param {object}   args
 * @param {object}   args.mapping         compiled mapping
 * @param {object[]} args.deals           results from compareDeal / uncomparableDeal
 * @param {object=}  args.corpus          { declared_deal_count, declared_deal_ids, source }
 */
function buildReport({ mapping, deals, corpus = {} }) {
  const ordered = [...deals].sort((left, right) => compareCodeUnits(left.deal_id, right.deal_id));

  const totals = emptyCounts();
  let substantiveCount = 0;
  let rowLossCount = 0;
  let rowAdditionCount = 0;
  let identicalFieldCount = 0;
  const findings = [];

  for (const deal of ordered) {
    for (const outcome of OUTCOME_ORDER) totals[outcome] += deal.outcome_counts[outcome] || 0;
    substantiveCount += deal.substantive_count || 0;
    rowLossCount += deal.row_counts.legacy_only || 0;
    rowAdditionCount += deal.row_counts.v2_only || 0;
    identicalFieldCount += deal.identical_field_count || 0;
    findings.push(...deal.findings);
  }

  const compared = ordered.filter((deal) => deal.status === 'COMPARED');
  const uncomparable = ordered.filter((deal) => deal.status !== 'COMPARED');

  const declaredIds = Array.isArray(corpus.declared_deal_ids) ? sortStrings(corpus.declared_deal_ids) : null;
  const comparedIds = sortStrings(compared.map((deal) => deal.deal_id));
  const declaredCount = Number.isInteger(corpus.declared_deal_count)
    ? corpus.declared_deal_count
    : (declaredIds ? declaredIds.length : null);
  const notReached = declaredIds
    ? declaredIds.filter((id) => !comparedIds.includes(id))
    : null;

  const rowLossFindings = findings.filter((finding) => finding.scope === 'row' && finding.outcome === OUTCOMES.V2_LOSS);

  const body = {
    schema: REPORT_SCHEMA,
    mapping: {
      mapping_id: mapping.mapping_id,
      mapping_version: mapping.mapping_version,
      family_id: mapping.family_id,
      field_count: mapping.fields.length,
      row_key: [...mapping.row_key],
    },
    corpus: {
      declared_deal_count: declaredCount,
      declared_deal_ids: declaredIds,
      source: typeof corpus.source === 'string' ? corpus.source : null,
      deals_in_run: ordered.length,
      deals_compared: compared.length,
      deals_uncomparable: uncomparable.length,
      deals_not_reached: notReached,
      coverage_complete: declaredCount === null ? null : compared.length === declaredCount,
    },
    headline: {
      row_level_v2_loss: rowLossCount,
      row_level_v2_addition: rowAdditionCount,
      substantive_findings: substantiveCount,
      clean: substantiveCount === 0,
    },
    totals: {
      ...totals,
      identical_fields: identicalFieldCount,
      substantive: substantiveCount,
    },
    deals: ordered.map((deal) => ({
      deal_id: deal.deal_id,
      deal_label: deal.deal_label,
      status: deal.status,
      reason: deal.reason || null,
      missing_sides: deal.missing_sides || [],
      row_counts: deal.row_counts,
      outcome_counts: deal.outcome_counts,
      identical_field_count: deal.identical_field_count,
      row_order_matches: deal.row_order_matches,
      substantive_count: deal.substantive_count,
    })),
    row_level_losses: rowLossFindings,
    findings,
  };

  return Object.freeze({ ...body, report_id: contentId(REPORT_SCHEMA, body) });
}

function exitCodeFor(report) {
  if (report.headline.substantive_findings > 0) return EXIT.SUBSTANTIVE_DIFFERENCE;
  if (report.corpus.deals_uncomparable > 0) return EXIT.INCOMPLETE_COVERAGE;
  if (report.corpus.coverage_complete === false) return EXIT.INCOMPLETE_COVERAGE;
  return EXIT.CLEAN;
}

function renderFinding(finding) {
  const scope = finding.scope === 'row' ? 'ROW' : `field ${finding.field_id}`;
  const lines = [
    `  [${finding.outcome}] ${finding.deal_id} :: ${renderRowKey(finding.row_key)} :: ${scope}`,
    `      reason  ${finding.reason}`,
    `      legacy  ${truncate(finding.legacy_value)}`,
    `      v2      ${truncate(finding.v2_value)}`,
  ];
  const extraKeys = sortStrings(Object.keys(finding.detail || {})).filter((key) => key !== 'reason');
  for (const key of extraKeys) {
    const value = finding.detail[key];
    lines.push(`      ${key}  ${Array.isArray(value) ? value.join(', ') : String(value)}`);
  }
  return lines.join('\n');
}

/** Deterministic plain-text rendering. */
function renderText(report) {
  const lines = [];
  const bar = '='.repeat(72);
  lines.push(bar);
  lines.push(`REVIEW PARITY  --  family ${report.mapping.family_id}`);
  lines.push(`mapping ${report.mapping.mapping_version} (${report.mapping.mapping_id.slice(0, 16)}…)`);
  lines.push(`report  ${report.report_id.slice(0, 16)}…`);
  lines.push(bar);

  // Headline. Row-level loss first, always, even when zero -- so its
  // absence is an assertion rather than an omission.
  lines.push('');
  lines.push('HEADLINE');
  lines.push(`  rows legacy renders and V2 does not (V2_LOSS)   ${report.headline.row_level_v2_loss}`);
  lines.push(`  rows V2 renders and legacy does not (V2_ADDITION) ${report.headline.row_level_v2_addition}`);
  lines.push(`  substantive findings                             ${report.headline.substantive_findings}`);

  lines.push('');
  lines.push('CORPUS COVERAGE');
  lines.push(`  deals compared        ${report.corpus.deals_compared}`);
  lines.push(`  deals uncomparable    ${report.corpus.deals_uncomparable}`);
  const declared = report.corpus.declared_deal_count;
  lines.push(`  declared corpus size  ${declared === null ? '(not declared)' : declared}${report.corpus.source ? ` [${report.corpus.source}]` : ''}`);
  if (declared !== null && report.corpus.deals_compared < declared) {
    lines.push(`  !! THIS RUN PROVES NOTHING ABOUT ${declared - report.corpus.deals_compared} OF ${declared} DEALS`);
  }
  if (report.corpus.deals_not_reached && report.corpus.deals_not_reached.length) {
    lines.push(`  not reached: ${report.corpus.deals_not_reached.join(', ')}`);
  }

  lines.push('');
  lines.push('OUTCOME TOTALS');
  for (const outcome of OUTCOME_ORDER) {
    lines.push(`  ${outcome.padEnd(14)} ${report.totals[outcome]}`);
  }

  if (report.row_level_losses.length) {
    lines.push('');
    lines.push('!'.repeat(72));
    lines.push(`ROW-LEVEL LOSS -- ${report.row_level_losses.length} row(s) present in legacy and absent from Canonical V2`);
    lines.push('!'.repeat(72));
    for (const finding of report.row_level_losses) {
      lines.push(renderFinding(finding));
    }
  }

  const otherFindings = report.findings.filter((finding) => !(finding.scope === 'row' && finding.outcome === OUTCOMES.V2_LOSS));
  const substantive = otherFindings.filter((finding) => finding.outcome !== OUTCOMES.COSMETIC);
  const cosmetic = otherFindings.filter((finding) => finding.outcome === OUTCOMES.COSMETIC);

  if (substantive.length) {
    lines.push('');
    lines.push(`SUBSTANTIVE FINDINGS (${substantive.length})`);
    for (const finding of substantive) lines.push(renderFinding(finding));
  }
  if (cosmetic.length) {
    lines.push('');
    lines.push(`COSMETIC (${cosmetic.length}) -- normalised away, not failures`);
    for (const finding of cosmetic) {
      lines.push(`  [COSMETIC] ${finding.deal_id} :: ${renderRowKey(finding.row_key)} :: ${finding.field_id} (${finding.reason})`);
    }
  }

  lines.push('');
  lines.push('PER DEAL');
  for (const deal of report.deals) {
    if (deal.status !== 'COMPARED') {
      lines.push(`  ${deal.deal_id}  UNCOMPARABLE  ${deal.reason || ''} [missing: ${deal.missing_sides.join(', ') || 'unknown'}]`);
      continue;
    }
    const counts = deal.outcome_counts;
    lines.push(
      `  ${deal.deal_id}  rows L=${deal.row_counts.legacy} V=${deal.row_counts.v2} paired=${deal.row_counts.paired}`
      + `  loss=${counts[OUTCOMES.V2_LOSS]} add=${counts[OUTCOMES.V2_ADDITION]} disagree=${counts[OUTCOMES.DISAGREEMENT]}`
      + ` cosmetic=${counts[OUTCOMES.COSMETIC]} identical=${counts[OUTCOMES.IDENTICAL]}`,
    );
  }

  lines.push('');
  lines.push(bar);
  const verdict = report.headline.substantive_findings === 0
    ? (report.corpus.deals_uncomparable === 0 ? 'PASS -- no substantive difference in the deals compared' : 'INCOMPLETE -- no substantive difference found, but coverage is short')
    : `FAIL -- ${report.headline.substantive_findings} substantive finding(s)`;
  lines.push(verdict);
  lines.push(bar);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  EXIT,
  REPORT_SCHEMA,
  buildReport,
  exitCodeFor,
  renderText,
};
