#!/usr/bin/env node
'use strict';

// The sentence-level silent-absence read of a finished run (work package 43,
// plan finding (260)). Prints every sentence of a section's own text that
// names an operative verb and that no proposal's components touch, so a
// reader can see what the machine left alone rather than inferring it from a
// count.
//
//   node scripts/product/audit-uncited-sentences.js --analysis <file> [--json]
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/product/audit-uncited-sentences.js --run <run-id> [--json]
//
// --analysis reads a stored analysis read (the preview payload's `analysis`,
// or the analysis object itself; a PRODUCT_PREVIEW_WORKSPACE/V2 file works).
// --run reads the run through ProductPhase3Store#getAgreementAnalysis, as
// scripts/product/reconcile-ben-samples.js does. --min-bytes changes the
// sentence floor (default 80). Exit code 0 always: this is a read, not a
// gate — a sentence can be cited only as context for another fact, and the
// verb list is a heuristic.
//
// Result on 2026-10-25: Apogee on Claude 88d4032a has none; Apogee on
// DeepSeek 34847358 has six (5.16's five, all of them — the section the page
// lists as empty — and one of 5.4(a) that the section-level read does not
// show).

const fs = require('fs');
const { uncitedOperativeSentences, renderUncitedReport, DEFAULTS } = require('../../lib/product/uncited-sentences');

function parseArgs(argv) {
  const args = { analysis: null, run: null, json: false, minBytes: DEFAULTS.minBytes };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--analysis') { args.analysis = next; index += 1; continue; }
    if (argument === '--run') { args.run = next; index += 1; continue; }
    if (argument === '--min-bytes') { args.minBytes = Number.parseInt(next, 10); index += 1; continue; }
    if (argument === '--json') { args.json = true; continue; }
    throw new TypeError(`unknown argument: ${argument}`);
  }
  if (!args.analysis && !args.run) throw new TypeError('one of --analysis <file> or --run <run-id> is required');
  if (args.analysis && args.run) throw new TypeError('--analysis and --run are alternatives');
  if (!Number.isInteger(args.minBytes) || args.minBytes < 1) throw new TypeError('--min-bytes must be a positive integer');
  return args;
}

function analysisFromFile(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw && raw.analysis ? raw.analysis : raw;
}

async function analysisFromRun(runId) {
  const { createClient } = require('@supabase/supabase-js');
  const { ProductPhase3Store } = require('../../lib/product/phase-3-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --run');
  const store = new ProductPhase3Store({
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  });
  return store.getAgreementAnalysis(runId);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const analysis = args.analysis ? analysisFromFile(args.analysis) : await analysisFromRun(args.run);
  const sections = uncitedOperativeSentences({ analysis, minBytes: args.minBytes });
  if (args.json) {
    console.log(JSON.stringify({ sections, total: sections.reduce((sum, section) => sum + section.sentences.length, 0) }, null, 2));
  } else {
    console.log(renderUncitedReport(sections));
  }
})().catch((error) => {
  console.error(error.message || error);
  process.exit(2);
});
