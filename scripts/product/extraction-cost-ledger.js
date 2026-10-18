#!/usr/bin/env node
'use strict';

// Work package E1 (plan finding (167), implementer E). The cost and time
// ledger of one or more analysis runs from their stored rows
// (lib/product/extraction-cost-ledger.js): tokens by call kind and section,
// what the calls sent and how many times each agreement byte went, what
// the output tokens were spent on, the failed attempts, the wall clock and
// the idle gaps, the floor and the ratio to it, and the per-run gate
// metrics. Ben: "everything to be driven by coding and not just a layer on
// top so all edits need to be repeatable across corpus".
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/extraction-cost-ledger.js --run <run-id> [--run <run-id>] [--out ledger.md] [--json ledger.json]
//   node scripts/product/extraction-cost-ledger.js --snapshot <file> [--out ledger.md]
//   node scripts/product/extraction-cost-ledger.js --run <run-id> --dump-snapshot <file>   (the rows, for a rerun without the database)
//   node scripts/product/extraction-cost-ledger.js --snapshot <file> --baseline <metrics.json> [--explain metric=reason]
//
// With --baseline the gate runs: a rise over the baseline's metrics beyond
// the tolerance (GATE_METRICS) exits 3 unless --explain names the metric.

const fs = require('node:fs');
const { ledgerFromRows, renderLedger, runCostMetrics, assertNoUnexplainedRise, GATE_METRICS } = require('../../lib/product/extraction-cost-ledger');
const { resolveRunRows, writeRunSnapshot } = require('../../lib/product/run-rows');

const TABLES = [
  'product_analysis_runs', 'product_model_calls', 'product_section_work', 'product_source_closures', 'product_source_spans',
  'product_proposals', 'product_fact_components',
];

function parseArgs(argv) {
  const args = { runs: [], snapshots: [], out: null, json: null, dumpSnapshot: null, baseline: null, explain: {} };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.runs.push(argv[i += 1]);
    else if (argv[i] === '--snapshot') args.snapshots.push(argv[i += 1]);
    else if (argv[i] === '--out') args.out = argv[i += 1];
    else if (argv[i] === '--json') args.json = argv[i += 1];
    else if (argv[i] === '--dump-snapshot') args.dumpSnapshot = argv[i += 1];
    else if (argv[i] === '--baseline') args.baseline = argv[i += 1];
    else if (argv[i] === '--explain') {
      const [metric, ...reason] = String(argv[i += 1] || '').split('=');
      args.explain[metric] = reason.join('=');
    } else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  if (!args.runs.length && !args.snapshots.length) {
    console.error('usage: extraction-cost-ledger.js (--run <id> | --snapshot <file>)... [--out ledger.md] [--json ledger.json] [--dump-snapshot <file>] [--baseline metrics.json] [--explain metric=reason]');
    process.exit(64);
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const runs = await resolveRunRows({ runIds: args.runs, snapshotFiles: args.snapshots, tables: TABLES });
  if (args.dumpSnapshot) {
    if (runs.length !== 1) throw new Error('--dump-snapshot takes one run');
    writeRunSnapshot(args.dumpSnapshot, runs[0]);
    console.log(`wrote ${args.dumpSnapshot}`);
  }
  const ledgers = runs.map((run) => ledgerFromRows(run));
  const markdown = ledgers.map((ledger) => renderLedger(ledger)).join('\n\n');
  if (args.out) { fs.writeFileSync(args.out, `${markdown}\n`); console.log(`wrote ${args.out}`); } else if (!args.json) process.stdout.write(`${markdown}\n`);
  if (args.json) { fs.writeFileSync(args.json, `${JSON.stringify(ledgers.length === 1 ? ledgers[0] : ledgers, null, 2)}\n`); console.log(`wrote ${args.json}`); }
  for (const ledger of ledgers) {
    console.log(JSON.stringify({ run_id: ledger.run_id, metrics: runCostMetrics(ledger) }));
  }
  if (args.baseline) {
    const baseline = JSON.parse(fs.readFileSync(args.baseline, 'utf8'));
    const baselineMetrics = baseline.metrics || baseline;
    for (const ledger of ledgers) {
      try {
        const verdict = assertNoUnexplainedRise(runCostMetrics(ledger), baselineMetrics, { tolerances: GATE_METRICS, explanations: args.explain });
        console.log(JSON.stringify({ run_id: ledger.run_id, gate: 'PASS', explained_rises: verdict.explained_rises }));
      } catch (error) {
        console.error(JSON.stringify({ run_id: ledger.run_id, gate: 'FAIL', failures: error.failures || [], message: error.message }));
        process.exitCode = 3;
      }
    }
  }
  return ledgers;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { TABLES, main, parseArgs };
