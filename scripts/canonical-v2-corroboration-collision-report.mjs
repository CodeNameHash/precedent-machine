#!/usr/bin/env node
/**
 * scripts/canonical-v2-corroboration-collision-report.mjs
 *
 * Step 2X-C, report-only phase (PLAN.md Step 2X-C; Fable, 2026-08-08:
 * "land it report-only first ... run it in report mode over all importable
 * runs by replay ... enforce only once that report is read").
 *
 * general-covenant-corroboration.js and tax-cooperation-corroboration.js
 * each assert in a comment that their per-code/per-kind patterns are
 * written to avoid cross-code collision on the same quote. That claim was
 * never checked at run time. This script checks it, over every committed
 * evidence run for the two families, by running the SAME functions
 * candidate-resolution.js runs (`generalCovenantPrimaryMatchingCodes`,
 * `taxCooperationPrimaryMatchingKinds`) against every candidate's own
 * verbatim quote -- never a re-implemented copy of the pattern tables.
 *
 * Zero model calls, zero network, zero writes to evidence/. Read-only over
 * committed run directories; the only write is the Markdown report this
 * script prints (or, with --write, saves under docs/codex-program/notes/).
 *
 * SCOPE AND ITS LIMITS.
 * - "General covenants" quotes come from `resolution.json`'s `resolved` and
 *   `open_world` arrays, whose `claim.raw_value` / `raw_value` field is the
 *   byte-verified verbatim quote -- exactly what
 *   `generalCovenantPrimaryMatchingCodes` is called against in
 *   candidate-resolution.js.
 * - "Tax cooperation" quotes are the same two arrays, filtered to
 *   `attributes.assertion_kind` of TAX_OPINION_COOPERATION or
 *   TRANSFER_COOPERATION -- the only two kinds
 *   `taxCooperationPrimaryMatchingKinds` is ever run against in production.
 * - `review_queue` entries are DELIBERATELY EXCLUDED, not silently
 *   dropped: `resolution.json`'s review_queue rows carry a
 *   `normalised_phrase`, not the byte-verified `raw_value`, and a collision
 *   check against a non-verbatim string would not be the same claim this
 *   script exists to prove or disprove. Their count is reported so the gap
 *   is visible, never hidden.
 *
 * Usage:
 *   node scripts/canonical-v2-corroboration-collision-report.mjs
 *   node scripts/canonical-v2-corroboration-collision-report.mjs --json
 *   node scripts/canonical-v2-corroboration-collision-report.mjs --write <path>
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const {
  generalCovenantPrimaryMatchingCodes,
} = require('../lib/canonical-v2/native-producer/general-covenant-corroboration');
const {
  taxCooperationPrimaryMatchingKinds,
} = require('../lib/canonical-v2/native-producer/tax-cooperation-corroboration');

const EVIDENCE_ROOT = path.join(REPO_ROOT, 'evidence/canonical-v2');
const TAX_COOPERATION_KINDS = Object.freeze(['TAX_OPINION_COOPERATION', 'TRANSFER_COOPERATION']);

function parseArgs(argv) {
  const args = { json: false, write: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') { args.json = true; continue; }
    if (argv[i] === '--write') { args.write = argv[i += 1]; continue; }
    throw new Error(`UNKNOWN_ARGUMENT: ${argv[i]}`);
  }
  return args;
}

function readJsonIfPresent(absolutePath) {
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
}

function listRunDirs(suffixMatch) {
  return fs.readdirSync(EVIDENCE_ROOT)
    .filter((name) => name.includes(suffixMatch))
    .filter((name) => fs.existsSync(path.join(EVIDENCE_ROOT, name, 'resolution.json')))
    .sort();
}

// Every general-covenant candidate's own quote, from the two sources that
// carry the byte-verified `raw_value` (never `normalised_phrase`).
function generalCovenantQuotes(resolution, run) {
  const rows = [];
  for (const row of resolution.resolved || []) {
    if (!String(row.generic_claim_key || '').startsWith('NATIVE_GENERAL_COVENANT_')) continue;
    rows.push({
      run,
      source: 'resolved',
      section_reference: row.section_reference,
      asserted_code: row.concept_key,
      quote: row.claim?.raw_value,
    });
  }
  for (const row of resolution.open_world || []) {
    if (!String(row.claim_definition_key || '').startsWith('NATIVE_GENERAL_COVENANT_')) continue;
    rows.push({
      run,
      source: 'open_world',
      section_reference: row.section_reference,
      asserted_code: row.attributes?.covenant_code ?? null,
      quote: row.raw_value,
    });
  }
  return rows.filter((row) => typeof row.quote === 'string' && row.quote.length > 0);
}

function taxCooperationQuotes(resolution, run) {
  const rows = [];
  for (const row of resolution.resolved || []) {
    const kind = row.claim?.attributes?.assertion_kind;
    if (!TAX_COOPERATION_KINDS.includes(kind)) continue;
    rows.push({
      run,
      source: 'resolved',
      section_reference: row.section_reference,
      asserted_kind: kind,
      quote: row.claim?.raw_value,
    });
  }
  for (const row of resolution.open_world || []) {
    const kind = row.attributes?.assertion_kind;
    if (!TAX_COOPERATION_KINDS.includes(kind)) continue;
    rows.push({
      run,
      source: 'open_world',
      section_reference: row.section_reference,
      asserted_kind: kind,
      quote: row.raw_value,
    });
  }
  return rows.filter((row) => typeof row.quote === 'string' && row.quote.length > 0);
}

function buildReport() {
  const generalCovenantRuns = listRunDirs('-general-covenants-');
  const taxMattersRuns = listRunDirs('-tax-matters-');

  const generalCovenantRows = [];
  let generalCovenantReviewQueueExcluded = 0;
  for (const run of generalCovenantRuns) {
    const resolution = readJsonIfPresent(path.join(EVIDENCE_ROOT, run, 'resolution.json'));
    if (!resolution) continue;
    generalCovenantRows.push(...generalCovenantQuotes(resolution, run));
    generalCovenantReviewQueueExcluded += (resolution.review_queue || [])
      .filter((row) => String(row.generic_claim_key || '').startsWith('NATIVE_GENERAL_COVENANT_'))
      .length;
  }

  const taxCooperationRows = [];
  let taxCooperationReviewQueueExcluded = 0;
  for (const run of taxMattersRuns) {
    const resolution = readJsonIfPresent(path.join(EVIDENCE_ROOT, run, 'resolution.json'));
    if (!resolution) continue;
    taxCooperationRows.push(...taxCooperationQuotes(resolution, run));
    taxCooperationReviewQueueExcluded += (resolution.review_queue || [])
      .filter((row) => TAX_COOPERATION_KINDS.includes(row.concept_family) || TAX_COOPERATION_KINDS.includes(row.concept_key))
      .length;
  }

  const generalCovenantCollisions = [];
  for (const row of generalCovenantRows) {
    const matches = generalCovenantPrimaryMatchingCodes(row.quote);
    if (matches.length > 1) {
      generalCovenantCollisions.push({ ...row, matching_codes: matches });
    }
  }

  const taxCooperationCollisions = [];
  for (const row of taxCooperationRows) {
    const matches = taxCooperationPrimaryMatchingKinds(row.quote);
    if (matches.length > 1) {
      taxCooperationCollisions.push({ ...row, matching_kinds: matches });
    }
  }

  return {
    schema_version: 'CANONICAL_V2_CORROBORATION_COLLISION_REPORT/V1',
    note: 'Re-derived by scripts/canonical-v2-corroboration-collision-report.mjs. Zero model '
      + 'calls. Checks the SAME functions candidate-resolution.js calls against every '
      + "candidate's own byte-verified quote. review_queue rows are excluded (see the "
      + 'script header) and counted separately, never silently dropped.',
    general_covenants: {
      runs_scanned: generalCovenantRuns.length,
      quotes_checked: generalCovenantRows.length,
      review_queue_excluded: generalCovenantReviewQueueExcluded,
      collisions: generalCovenantCollisions,
    },
    tax_cooperation: {
      runs_scanned: taxMattersRuns.length,
      quotes_checked: taxCooperationRows.length,
      review_queue_excluded: taxCooperationReviewQueueExcluded,
      collisions: taxCooperationCollisions,
    },
  };
}

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Step 2X-C collision report');
  lines.push('');
  lines.push(
    'Generated by `node scripts/canonical-v2-corroboration-collision-report.mjs`. '
    + 'Re-derived from committed evidence, zero model calls; regenerate rather than '
    + 'hand-edit this file, and keep the exact command with the number if you cite it '
    + 'elsewhere.',
  );
  lines.push('');
  lines.push('## What this checks');
  lines.push('');
  lines.push(
    'PLAN.md Step 2X-C: `guaranty-corroboration.js` and `ioc-corroboration.js` already '
    + 'run every code\'s pattern against a candidate\'s quote and refuse when more than '
    + 'one matches. `general-covenant-corroboration.js` and `tax-cooperation-'
    + 'corroboration.js` asserted the same property in a comment, never checked at run '
    + 'time. This script runs `generalCovenantPrimaryMatchingCodes` and '
    + '`taxCooperationPrimaryMatchingKinds` -- the exact functions candidate-resolution.js '
    + 'calls -- against every committed candidate\'s own byte-verified quote, and counts '
    + 'how many quotes match more than one code or kind. It changes nothing: this is the '
    + 'report Fable\'s 2026-08-08 ruling required before any enforcement lands.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| family | runs scanned | quotes checked (resolved + open_world) | review_queue excluded | collisions |');
  lines.push('|---|---:|---:|---:|---:|');
  lines.push(
    `| general_covenants | ${report.general_covenants.runs_scanned} | `
    + `${report.general_covenants.quotes_checked} | `
    + `${report.general_covenants.review_queue_excluded} | `
    + `${report.general_covenants.collisions.length} |`,
  );
  lines.push(
    `| tax_cooperation | ${report.tax_cooperation.runs_scanned} | `
    + `${report.tax_cooperation.quotes_checked} | `
    + `${report.tax_cooperation.review_queue_excluded} | `
    + `${report.tax_cooperation.collisions.length} |`,
  );
  lines.push('');

  function renderCollisions(title, collisions, matchesKey) {
    lines.push(`## ${title}`);
    lines.push('');
    if (collisions.length === 0) {
      lines.push(
        'Zero collisions across every scanned run. The comment this step exists to check '
        + 'was true, for every quote this script can see.',
      );
      lines.push('');
      return;
    }
    for (const [index, row] of collisions.entries()) {
      lines.push(`### ${index + 1}. \`${row.run}\` § ${row.section_reference} (${row.source})`);
      lines.push('');
      lines.push(`- asserted: \`${row.asserted_code ?? row.asserted_kind}\``);
      lines.push(`- matches: \`${row[matchesKey].join('`, `')}\``);
      lines.push(`- quote: "${row.quote}"`);
      lines.push('');
    }
  }

  renderCollisions('General covenants collisions', report.general_covenants.collisions, 'matching_codes');
  renderCollisions('Tax cooperation collisions', report.tax_cooperation.collisions, 'matching_kinds');

  lines.push('## What this does not check');
  lines.push('');
  lines.push(
    `- **review_queue rows** (${report.general_covenants.review_queue_excluded} general-covenant, `
    + `${report.tax_cooperation.review_queue_excluded} tax-cooperation): `
    + '`resolution.json` only carries a `normalised_phrase` for these, not the '
    + 'byte-verified quote, so a collision check against it would not be checking the same '
    + 'claim. If the resolved+open_world count above is zero collisions, extending coverage '
    + 'to review_queue is the natural next step before enforcing, not after.',
  );
  lines.push(
    '- **Runs with no committed `resolution.json`** are not counted at all (there were '
    + 'none at the time this report was generated).',
  );
  lines.push('');
  lines.push('## Disposition');
  lines.push('');
  lines.push(
    'Report-only. No enforcement change accompanies this report. '
    + 'See `general-covenant-corroboration.js` and `tax-cooperation-corroboration.js`: '
    + 'both already compute the full-pattern-set match (`generalCovenantPrimaryMatchingCodes`, '
    + '`taxCooperationPrimaryMatchingKinds`) and candidate-resolution.js already records every '
    + 'collision it finds into an in-memory report object on every run -- but neither refuses '
    + 'a quote merely for colliding on the primary-hit path. Enforcing that refusal is the '
    + 'next step, gated on this report showing what it would move.',
  );
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const report = buildReport();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const markdown = formatMarkdown(report);
  if (args.write) {
    const outPath = path.resolve(REPO_ROOT, args.write);
    fs.writeFileSync(outPath, markdown);
    process.stderr.write(
      `[collision-report] wrote ${args.write}: `
      + `general_covenants ${report.general_covenants.collisions.length} collisions / `
      + `${report.general_covenants.quotes_checked} quotes, `
      + `tax_cooperation ${report.tax_cooperation.collisions.length} collisions / `
      + `${report.tax_cooperation.quotes_checked} quotes\n`,
    );
    return;
  }
  process.stdout.write(markdown);
}

main();
