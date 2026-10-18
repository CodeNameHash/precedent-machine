#!/usr/bin/env node
'use strict';

// Phase 6: "Execute rollback once and prove the prior view returns." Sends
// the review page's ROLLBACK_RELEASE for the run whose release is current,
// reads the published read to prove the prior release is what a reader
// sees, then (unless --no-restore) sends ACTIVATE_RELEASE for the same
// candidate and proves it is current again (lib/product/rollback-drill.js).
// The production switch is never run from here.
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/rollback-drill.js --run <run-id> --base-url <deployment> [--no-restore]
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/rollback-drill.js --run <run-id> [--actor ben] [--no-restore]
//
// Exit codes: 0 drill complete; 2 the drill could not run (blockers
// printed) or a check failed; 1 a request failed.

const { cutoverClientFromEnvironment } = require('../../lib/product/cutover-client');
const { rollbackDrill, renderDrill } = require('../../lib/product/rollback-drill');

function parseArgs(argv) {
  const args = { run: null, baseUrl: null, actor: null, restore: true, json: false, prefix: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--base-url') args.baseUrl = argv[i += 1];
    else if (argv[i] === '--actor') args.actor = argv[i += 1];
    else if (argv[i] === '--idempotency-prefix') args.prefix = argv[i += 1];
    else if (argv[i] === '--no-restore') args.restore = false;
    else if (argv[i] === '--json') args.json = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run) { console.error('usage: rollback-drill.js --run <run-id> [--base-url <url> | SUPABASE env] [--actor <name>] [--no-restore] [--json]'); process.exit(64); }
  const client = cutoverClientFromEnvironment({ baseUrl: args.baseUrl, actor: args.actor });
  const result = await rollbackDrill({ client, runId: args.run, restore: args.restore, idempotencyPrefix: args.prefix });
  console.log(args.json ? JSON.stringify(result, null, 2) : renderDrill(result));
  process.exit(result.completed ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
