#!/usr/bin/env node
'use strict';

// Phase 6: "Compare the rendered V1 and V2 result. Explain differences
// rather than requiring false equality." Writes a Markdown report that
// pairs the V1 generation's facts with the V2 generation's on the
// agreement's bytes, by section and by table, and names every difference
// with its reason (lib/product/generation-comparison.js).
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/compare-generations.js --base-url <deployment> --v1-run <run-id> --v2-run <run-id> --out report.md
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/compare-generations.js --v1-run <run-id> --v2-run <run-id> --out report.md
//   node scripts/product/compare-generations.js --v1-file v1.json --v2-file v2.json --out report.md
//
// A --v1-file / --v2-file is { analysis, review? } as the review read
// returns them (GET /api/product/review/:id), or a bare analysis read.
// --dump-dir <dir> writes the two inputs read from a deployment or
// database as files, for a rerun without the network. The review read is
// used for both runs because it carries the reviewer's decisions and
// comments beside the analysis; like opening the review page, it
// initialises a review session for a run that has none.

const fs = require('node:fs');
const path = require('node:path');
const { cutoverClientFromEnvironment } = require('../../lib/product/cutover-client');
const { compareGenerations, renderGenerationComparison } = require('../../lib/product/generation-comparison');

function parseArgs(argv) {
  const args = { v1Run: null, v2Run: null, v1File: null, v2File: null, out: null, baseUrl: null, actor: null, dumpDir: null, json: false, noTables: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--v1-run') args.v1Run = argv[i += 1];
    else if (argv[i] === '--v2-run') args.v2Run = argv[i += 1];
    else if (argv[i] === '--v1-file') args.v1File = argv[i += 1];
    else if (argv[i] === '--v2-file') args.v2File = argv[i += 1];
    else if (argv[i] === '--out') args.out = argv[i += 1];
    else if (argv[i] === '--base-url') args.baseUrl = argv[i += 1];
    else if (argv[i] === '--actor') args.actor = argv[i += 1];
    else if (argv[i] === '--dump-dir') args.dumpDir = argv[i += 1];
    else if (argv[i] === '--json') args.json = true;
    else if (argv[i] === '--no-tables') args.noTables = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  return args;
}

function readInput(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (parsed.analysis) return { analysis: parsed.analysis, review: parsed.review || null };
  return { analysis: parsed, review: null };
}

async function readRun(client, runId) {
  const workspace = await client.getReview(runId);
  return { analysis: workspace.analysis, review: workspace.review || null };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const byFile = args.v1File && args.v2File;
  const byRun = args.v1Run && args.v2Run;
  if (!byFile && !byRun) { console.error('usage: compare-generations.js (--v1-run <id> --v2-run <id> [--base-url <url> | SUPABASE env] | --v1-file <json> --v2-file <json>) [--out <report.md>] [--dump-dir <dir>] [--no-tables] [--json]'); process.exit(64); }
  let v1; let v2;
  if (byFile) {
    v1 = readInput(args.v1File);
    v2 = readInput(args.v2File);
  } else {
    const client = cutoverClientFromEnvironment({ baseUrl: args.baseUrl, actor: args.actor });
    v1 = await readRun(client, args.v1Run);
    v2 = await readRun(client, args.v2Run);
    if (args.dumpDir) {
      fs.mkdirSync(args.dumpDir, { recursive: true });
      fs.writeFileSync(path.join(args.dumpDir, `${args.v1Run}.json`), JSON.stringify(v1));
      fs.writeFileSync(path.join(args.dumpDir, `${args.v2Run}.json`), JSON.stringify(v2));
    }
  }
  if (v1.analysis?.kind !== 'draftAnalysis' || v2.analysis?.kind !== 'draftAnalysis') {
    console.error(`both runs need a completed analysis (V1 ${v1.analysis?.kind || 'absent'}, V2 ${v2.analysis?.kind || 'absent'})`);
    process.exit(2);
  }
  const tableShapes = args.noTables ? null : require('../../contracts/product/table-shapes.v3.json');
  const legalSchema = require('../../contracts/product/legal-schema.v2.json');
  const model = compareGenerations({ v1, v2, tableShapes, legalSchema });
  const output = args.json ? JSON.stringify(model, null, 2) : renderGenerationComparison(model);
  if (args.out) {
    fs.writeFileSync(args.out, `${output}\n`);
    console.log(`wrote ${args.out}: V1 ${model.totals.v1_valid} valid facts (${model.totals.v1_matched} matched, ${model.totals.v1_partial} partial, ${model.totals.v1_unmatched} unmatched); V2 ${model.totals.v2_valid} valid (${model.totals.v2_new} new), ${model.totals.v2_held} held`);
  } else process.stdout.write(`${output}\n`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
