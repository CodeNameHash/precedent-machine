#!/usr/bin/env node
'use strict';

// The product's move to another database, prepared on Ben's decision
// (plan finding (166): "I'm not sure what you mean but I don't care boaut
// the old site, you can move over whener you like"): the migrations, the
// rows of one run, the proof the target reads as the source does
// (lib/product/production-move.js). Dry run by default; --apply writes.
//
//   node scripts/product/move-to-production.js --run <run-id> --source-url <postgres url> --target-url <postgres url> [--dry-run]
//   node scripts/product/move-to-production.js --run <run-id> --source-url ... --target-url ... --apply --confirm-target <target project ref>
//
// The URLs are direct Postgres connection strings (the Supabase project's
// database connection, the postgres role), read from the arguments or from
// MOVE_SOURCE_DATABASE_URL and MOVE_TARGET_DATABASE_URL; they are never
// printed. --apply refuses to run unless --confirm-target names a project
// ref that appears in the target URL's host, so a production apply is a
// deliberate act. Run this against the production project only on the
// manager's word after reading the dry run.
//
// Exit codes: 0 dry run printed or move complete; 2 the move ran and a
// check failed; 1 a connection or query failed.

const { Client } = require('pg');
const { moveRunToTarget, renderMoveReport } = require('../../lib/product/production-move');

function parseArgs(argv) {
  const args = { run: null, sourceUrl: process.env.MOVE_SOURCE_DATABASE_URL || null, targetUrl: process.env.MOVE_TARGET_DATABASE_URL || null, apply: false, confirmTarget: null, json: false, createRoles: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--source-url') args.sourceUrl = argv[i += 1];
    else if (argv[i] === '--target-url') args.targetUrl = argv[i += 1];
    else if (argv[i] === '--confirm-target') args.confirmTarget = argv[i += 1];
    else if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--dry-run') args.apply = false;
    else if (argv[i] === '--create-roles') args.createRoles = true;
    else if (argv[i] === '--json') args.json = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  return args;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run || !args.sourceUrl || !args.targetUrl) {
    console.error('usage: move-to-production.js --run <run-id> --source-url <postgres url> --target-url <postgres url> [--apply --confirm-target <project ref>] [--create-roles] [--json]');
    process.exit(64);
  }
  if (args.apply) {
    const host = hostOf(args.targetUrl);
    if (!args.confirmTarget || !host.includes(args.confirmTarget)) {
      console.error(`--apply needs --confirm-target naming the target project ref found in the target host (${host || 'no host parsed'})`);
      process.exit(64);
    }
  }
  const source = new Client({ connectionString: args.sourceUrl });
  const target = new Client({ connectionString: args.targetUrl });
  await source.connect();
  await target.connect();
  let report;
  try {
    report = await moveRunToTarget({ source, target, runId: args.run, apply: args.apply, createRoles: args.createRoles });
  } finally {
    await source.end();
    await target.end();
  }
  console.log(args.json ? JSON.stringify(report, null, 2) : renderMoveReport(report));
  process.exit(!args.apply || report.complete ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
