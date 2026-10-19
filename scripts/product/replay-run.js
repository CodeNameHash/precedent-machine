#!/usr/bin/env node
'use strict';

// Work package E1 item 4 (plan finding (167), implementer E): finalise a
// run again from its stored model responses with no model call
// (lib/product/run-replay.js), so validator, compiler and page fixes are
// judged on the real answers without a generation. Ben: "everything to
// be driven by coding and not just a layer on top so all edits need to be
// repeatable across corpus".
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/replay-run.js --run <run-id> [--sections 5.2,5.17] [--match exact|loose] [--out replay.json] [--draft draft.json] [--dump-snapshot rows.json]
//   node scripts/product/replay-run.js --snapshot rows.json [...]
//
// The replay never calls a model: a request with no stored answer fails
// the section (REPLAY_MISS) under the exact match, or is answered by the
// stored call of the same section, kind and part under --match loose
// (the drift is listed). --dump-snapshot writes the rows and the run's
// context for a rerun without the database. Exit 0 when every section
// replays and the proposals are identical to the stored run by id and
// status, 2 when they differ (the difference is the fix under test, read
// it), 1 on a failure.

const fs = require('node:fs');
const { renderReplaySummary, replayRun } = require('../../lib/product/run-replay');
const { createEnvironmentClient, loadRunContext, loadRunRows, readRunSnapshot, writeRunSnapshot } = require('../../lib/product/run-rows');

const TABLES = ['product_analysis_runs', 'product_model_calls', 'product_section_work', 'product_source_closures', 'product_proposals', 'product_issues'];

function parseArgs(argv) {
  const args = { run: null, snapshot: null, sections: null, match: 'exact', out: null, draft: null, dumpSnapshot: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--snapshot') args.snapshot = argv[i += 1];
    else if (argv[i] === '--sections') args.sections = String(argv[i += 1] || '').split(',').map((item) => item.trim()).filter(Boolean);
    else if (argv[i] === '--match') args.match = argv[i += 1];
    else if (argv[i] === '--out') args.out = argv[i += 1];
    else if (argv[i] === '--draft') args.draft = argv[i += 1];
    else if (argv[i] === '--dump-snapshot') args.dumpSnapshot = argv[i += 1];
    else if (argv[i] === '--quiet') args.quiet = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  if ((!args.run && !args.snapshot) || (args.run && args.snapshot)) { console.error('usage: replay-run.js (--run <id> | --snapshot <file>) [--sections a,b] [--match exact|loose] [--out replay.json] [--draft draft.json] [--dump-snapshot rows.json]'); process.exit(64); }
  if (!['exact', 'loose'].includes(args.match)) { console.error('--match must be exact or loose'); process.exit(64); }
  return args;
}

async function loadRun(args) {
  if (args.snapshot) {
    const snapshot = readRunSnapshot(args.snapshot);
    if (!snapshot.context) throw new Error(`${args.snapshot} carries no context (run row, source document, structure); dump it with --run <id> --dump-snapshot`);
    return snapshot;
  }
  const client = createEnvironmentClient();
  const rows = await loadRunRows({ client, runId: args.run, tables: TABLES });
  const context = await loadRunContext(client, args.run);
  return { ...rows, context };
}

async function main(argv) {
  const args = parseArgs(argv);
  const run = await loadRun(args);
  if (args.dumpSnapshot) {
    writeRunSnapshot(args.dumpSnapshot, run);
    console.log(`wrote ${args.dumpSnapshot}`);
  }
  const replay = await replayRun({
    run, match: args.match, sections: args.sections,
    log: args.quiet ? null : (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
  });
  const { results: _results, draft_body: draftBody, ...report } = replay;
  console.log(renderReplaySummary(replay));
  if (args.out) { fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`); console.log(`wrote ${args.out}`); }
  if (args.draft && draftBody) { fs.writeFileSync(args.draft, `${JSON.stringify(draftBody)}\n`); console.log(`wrote ${args.draft}`); }
  if (replay.sections_failed.length || replay.draft_error) process.exitCode = 1;
  else if (!replay.proposals.identical) process.exitCode = 2;
  return replay;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { TABLES, main, parseArgs };
