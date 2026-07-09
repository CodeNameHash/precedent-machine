#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { SURFACES } = require('./layout-slot-inventory');

const REVIEW_PAGE = 'pages/review/[id].js';
const OUT = 'docs/audit/m2-08-coverage.md';

const CONFIGS_BY_SURFACE = {
  'Structure & Mechanics': ['structure-mechanics.config.js'],
  'Antitrust / Regulatory Summary': ['antitrust-regulatory.config.js'],
  'MAE Definition Summary': ['mae-definitions.config.js'],
  'Termination Rights Summary': ['termination-rights.config.js'],
  'Termination Fee Matrix': ['termination-fees.config.js'],
  'General Covenants': ['general-covenants.config.js'],
  // Consolidated into ONE combined Votes/Approvals + SEC Filing/Meeting
  // section per user feedback -- both surfaces are now covered by
  // votes-approvals-meeting.config.js (which wraps approvals-votes.config.js
  // and sec-meeting.config.js internally; those two keep their own exports
  // and tests but are no longer mounted directly in the review page).
  'Approvals / Votes': ['votes-approvals-meeting.config.js'],
  // Ben (round 6): the thin fee/expense-allocation row folded INTO the
  // Miscellaneous / Boilerplate table -- misc-boilerplate.config.js imports
  // advisers-fees-expenses.config.js's buildExpenseExceptionsRow and renders
  // it there. advisers-fees-expenses.config.js keeps its own exports/tests but
  // is no longer mounted directly in the review page.
  'Advisers / Fees / Expenses': ['misc-boilerplate.config.js'],
  'Representation Qualifiers': ['representations-qualifiers.config.js'],
  'Consideration Hero': ['consideration-hero.config.js'],
  // Consolidated into ONE grouped table per user feedback -- covered by
  // conditions.config.js (which wraps conditions-m/b/s.config.js internally;
  // those three keep their own exports and tests but are no longer mounted
  // directly in the review page).
  'Closing Conditions': ['conditions.config.js'],
  'Material Contracts': ['material-contracts.config.js'],
  // Consolidated into ONE "No-Solicitation / No-Shop" section per user
  // feedback (FEEDBACK-2-PUNCHLIST.md #42) -- covered by
  // nosol-section.config.js (which wraps nosol-noshop/nosol-superior/
  // nosol-intervening/nosol-fiduciary.config.js internally as ordered
  // sub-groups; those four keep their own exports and tests but are no
  // longer mounted directly in the review page).
  'No-Shop / Fiduciary-Out Stack': ['nosol-section.config.js'],
  'Employee Benefits': ['employee-benefits.config.js'],
  'SEC Meeting / Tender-Offer Filings': ['votes-approvals-meeting.config.js'],
  'No Other Reps / Fraud': ['no-other-reps-fraud.config.js'],
};

function camelConfigName(file) {
  const base = file.replace(/\.config\.js$/, '');
  return `${base.replace(/-([a-z])/g, (_, chr) => chr.toUpperCase())}Config`;
}

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function buildCoverage(repoRoot = process.cwd()) {
  const pageSource = fs.readFileSync(path.join(repoRoot, REVIEW_PAGE), 'utf8');
  // Phase A shell-restore: the per-family tables now mount through a single
  // accordion map over the REVIEW_TABLE_CONFIGS array instead of 23 literal
  // <ProvisionTable> tags. A config counts as "mounted" when it's enumerated
  // in that ordered array (which the accordion renders).
  const arrayStart = pageSource.indexOf('const REVIEW_TABLE_CONFIGS = [');
  const arrayEnd = arrayStart >= 0 ? pageSource.indexOf('];', arrayStart) : -1;
  const configArrayLiteral = arrayStart >= 0 && arrayEnd >= 0 ? pageSource.slice(arrayStart, arrayEnd) : '';
  return SURFACES.map((surface) => {
    const configs = CONFIGS_BY_SURFACE[surface.name] || [];
    const checks = configs.map((file) => {
      const filePath = path.join(repoRoot, 'components/review/table-configs', file);
      const symbol = camelConfigName(file);
      return {
        file,
        symbol,
        exists: fs.existsSync(filePath),
        imported: pageSource.includes(`{ ${symbol} }`),
        mounted: configArrayLiteral.includes(`  ${symbol},`),
      };
    });
    const covered = checks.length > 0 && checks.every((check) => check.exists && check.imported && check.mounted);
    return {
      rank: surface.rank,
      surface: surface.name,
      legacy_status: surface.status,
      slot: surface.slot,
      configs,
      checks,
      coverage_pct: covered ? 100 : 0,
      status: covered ? 'covered' : 'uncovered',
      justification: covered
        ? 'Schema-first config is present and mounted before the raw card table.'
        : 'No mounted schema-first config found. Queue follow-up before legacy deletion.',
    };
  });
}

function coverageMarkdown(rows, generatedAt) {
  const covered = rows.filter((row) => row.status === 'covered').length;
  const gapRows = rows.filter((row) => row.legacy_status === 'gap');
  const coveredGapRows = gapRows.filter((row) => row.status === 'covered').length;
  const uncovered = rows.filter((row) => row.status !== 'covered');
  const lines = [
    `# M2-08 Coverage — ${generatedAt}`,
    '',
    'WP-M2-08 Step 3 verification of the Step 1 legacy layout inventory after the Step 2 schema-first config additions.',
    '',
    `Surface coverage: ${covered}/${rows.length} (${Math.round((covered / rows.length) * 100)}%).`,
    `Step 1 gap coverage: ${coveredGapRows}/${gapRows.length} (${Math.round((coveredGapRows / gapRows.length) * 100)}%).`,
    '',
    '| Rank | Legacy surface | Step 1 status | Slot | Schema-first config(s) | Coverage | Justification |',
    '|---:|---|---|---|---|---:|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${row.rank} | ${mdCell(row.surface)} | ${row.legacy_status} | ${mdCell(row.slot)} | ${mdCell(row.configs.join(', '))} | ${row.coverage_pct}% | ${mdCell(row.justification)} |`);
  }
  lines.push('');
  lines.push('## Uncovered');
  lines.push('');
  if (uncovered.length === 0) {
    lines.push('None.');
  } else {
    for (const row of uncovered) {
      const failed = row.checks
        .filter((check) => !check.exists || !check.imported || !check.mounted)
        .map((check) => `${check.file} exists=${check.exists} imported=${check.imported} mounted=${check.mounted}`)
        .join('; ');
      lines.push(`- ${row.surface}: ${failed || 'no config mapping'}`);
    }
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- No intentionally uncovered legacy surface remains.');
  lines.push('- Detailed CVR modelling stays outside M2-08; the consideration surface itself is covered by `consideration-hero.config.js`.');
  lines.push('- Full-corpus schema parity remains enforced separately by the `schema-parity` CI check.');
  lines.push('');
  return lines.join('\n');
}

function writeFile(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${text.replace(/\s+$/, '')}\n`);
}

function main() {
  const generatedAt = new Date().toISOString();
  const rows = buildCoverage();
  writeFile(OUT, coverageMarkdown(rows, generatedAt));
  const uncovered = rows.filter((row) => row.status !== 'covered');
  process.stdout.write(`M2-08 coverage: ${rows.length - uncovered.length}/${rows.length} surfaces covered\n`);
  if (uncovered.length) {
    for (const row of uncovered) process.stderr.write(`UNCOVERED: ${row.surface}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  CONFIGS_BY_SURFACE,
  buildCoverage,
  coverageMarkdown,
};
