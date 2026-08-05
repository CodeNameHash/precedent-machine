#!/usr/bin/env node
'use strict';

/**
 * scripts/review-parity-check.js
 *
 * Proves -- or refuses to prove -- that the Canonical V2 view of a review
 * family says the same thing as the legacy view, deal by deal.
 *
 *   node scripts/review-parity-check.js \
 *     --mapping lib/review-parity/mappings/material-contracts.example.json \
 *     --cases   tests/fixtures/review-parity/cases/material-contracts
 *
 * Options
 *   --mapping <file>        REQUIRED. The declarative field-mapping table.
 *                           Its content is an INPUT, determined elsewhere.
 *   --cases <dir|file>      REQUIRED. Case files (REVIEW_PARITY_CASE/V1).
 *   --json <file>           Write the full report as canonical JSON.
 *   --corpus-deals <n>      Declared corpus size, for the coverage line.
 *   --corpus-ids <file>     JSON array (or {deal_ids:[...]}) of every deal
 *                           the family is supposed to cover. Named deals
 *                           with no case file are reported as NOT REACHED.
 *   --corpus-source <text>  Provenance note for the declared corpus size.
 *   --quiet                 Suppress the text report (exit code only).
 *
 * Exit codes
 *   0  clean: every compared deal agrees, coverage complete (if declared)
 *   1  at least one substantive difference (V2_LOSS / V2_ADDITION /
 *      DISAGREEMENT)
 *   2  no substantive difference found, but coverage is incomplete -- some
 *      deal could not be compared. A run that proves nothing must not look
 *      like a run that proves everything.
 *   3  usage or configuration error
 *
 * Authority: reads files only. No database, no credentials, no network, no
 * model call. Nothing here writes to the corpus.
 */

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { loadCaseSet } = require('../lib/review-parity/case-file');
const { compileMapping } = require('../lib/review-parity/mapping');
const { EXIT, exitCodeFor, renderText } = require('../lib/review-parity/report');
const { runComparison } = require('../lib/review-parity/run');
const { REPO_ROOT } = require('../lib/review-parity/views');

const FLAGS_WITH_VALUES = new Set(['--mapping', '--cases', '--json', '--corpus-deals', '--corpus-ids', '--corpus-source']);
const BOOLEAN_FLAGS = new Set(['--quiet', '--help', '-h']);

// The header comment above IS the usage text -- one source, so `--help` can
// never drift from the documentation.
function usageText() {
  const lines = fs.readFileSync(__filename, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith('/**'));
  const end = lines.findIndex((line, index) => index > start && line.trim() === '*/');
  if (start === -1 || end === -1) return 'usage: review-parity-check --mapping <file> --cases <dir>';
  return lines.slice(start + 1, end).map((line) => line.replace(/^ \* ?/, '')).join('\n');
}

function usage(message) {
  if (message) process.stderr.write(`review-parity-check: ${message}\n\n`);
  process.stderr.write(`${usageText()}\n`);
  return EXIT.USAGE_ERROR;
}

function parseArgs(argv) {
  const options = { quiet: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (BOOLEAN_FLAGS.has(token)) {
      if (token === '--quiet') options.quiet = true;
      else options.help = true;
      continue;
    }
    if (!FLAGS_WITH_VALUES.has(token)) {
      const error = new Error(`unknown argument "${token}"`);
      error.usage = true;
      throw error;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      const error = new Error(`${token} needs a value`);
      error.usage = true;
      throw error;
    }
    options[token.slice(2).replace(/-/g, '_')] = value;
    index += 1;
  }
  return options;
}

/**
 * Read a file named on the command line. Absolute paths are allowed here --
 * the operator typed it. The repo-root guard deliberately stays in
 * case-file.js and mapping.js, where the paths come from DATA rather than
 * from a person.
 */
function readJsonFile(target) {
  const absolute = path.isAbsolute(target) ? target : path.resolve(REPO_ROOT, target);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    return usage(error.message);
  }
  if (options.help) return usage(null);
  if (!options.mapping) return usage('--mapping is required');
  if (!options.cases) return usage('--cases is required');

  let mapping;
  try {
    mapping = compileMapping(readJsonFile(options.mapping));
  } catch (error) {
    process.stderr.write(`review-parity-check: bad mapping (${error.code || 'ERROR'}): ${error.message}\n`);
    return EXIT.USAGE_ERROR;
  }

  let cases;
  try {
    cases = loadCaseSet(options.cases);
  } catch (error) {
    process.stderr.write(`review-parity-check: bad case set (${error.code || 'ERROR'}): ${error.message}\n`);
    return EXIT.USAGE_ERROR;
  }
  if (!cases.length) {
    process.stderr.write('review-parity-check: the case set is empty; there is nothing to prove\n');
    return EXIT.USAGE_ERROR;
  }

  const corpus = { source: options.corpus_source || null };
  if (options.corpus_deals !== undefined) {
    const count = Number.parseInt(options.corpus_deals, 10);
    if (!Number.isInteger(count) || count < 0) return usage('--corpus-deals must be a non-negative integer');
    corpus.declared_deal_count = count;
  }
  if (options.corpus_ids !== undefined) {
    let loaded;
    try {
      loaded = readJsonFile(options.corpus_ids);
    } catch (error) {
      process.stderr.write(`review-parity-check: cannot read --corpus-ids: ${error.message}\n`);
      return EXIT.USAGE_ERROR;
    }
    const ids = Array.isArray(loaded) ? loaded : (loaded && loaded.deal_ids);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      process.stderr.write('review-parity-check: --corpus-ids must be a JSON array of strings, or {"deal_ids": [...]}\n');
      return EXIT.USAGE_ERROR;
    }
    corpus.declared_deal_ids = ids;
    if (corpus.declared_deal_count === undefined) corpus.declared_deal_count = ids.length;
  }

  let report;
  try {
    report = runComparison({ mapping, cases, corpus });
  } catch (error) {
    process.stderr.write(`review-parity-check: comparison failed: ${error && error.stack ? error.stack : error}\n`);
    return EXIT.USAGE_ERROR;
  }

  if (options.json) {
    const target = path.isAbsolute(options.json) ? options.json : path.resolve(REPO_ROOT, options.json);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Canonical JSON: byte-stable across runs and machines.
    fs.writeFileSync(target, `${canonicalJson(JSON.parse(JSON.stringify(report)))}\n`, 'utf8');
  }

  if (!options.quiet) process.stdout.write(renderText(report));

  return exitCodeFor(report);
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { main, parseArgs };
