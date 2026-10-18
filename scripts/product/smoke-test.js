#!/usr/bin/env node
'use strict';

// Phase 6: "Run an outside-in smoke test." Submits a URL through the
// intake (dry run: the run route that wakes the worker is never called, so
// no model call follows), reads the run status, the provisions page read
// and the published read, and fetches the page shells
// (lib/product/smoke-test.js). Starting a generation stays
// scripts/product/start-generation.js's job.
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/smoke-test.js --base-url <deployment> --sec-url <exhibit url> [--generation N]
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/smoke-test.js --base-url <deployment> --run <run-id>
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/smoke-test.js --run <run-id> [--actor ben]
//
// Exit codes: 0 every step passed; 2 a step failed; 1 the client could
// not be built.

const { cutoverClientFromEnvironment } = require('../../lib/product/cutover-client');
const { runSmokeTest, renderSmokeTest } = require('../../lib/product/smoke-test');

function parseArgs(argv) {
  const args = { run: null, secUrl: null, generation: 0, baseUrl: null, actor: null, json: false, pages: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--run') args.run = argv[i += 1];
    else if (argv[i] === '--sec-url') args.secUrl = argv[i += 1];
    else if (argv[i] === '--generation') args.generation = Number.parseInt(argv[i += 1], 10);
    else if (argv[i] === '--base-url') args.baseUrl = argv[i += 1];
    else if (argv[i] === '--actor') args.actor = argv[i += 1];
    else if (argv[i] === '--no-pages') args.pages = false;
    else if (argv[i] === '--json') args.json = true;
    else { console.error(`unknown argument ${argv[i]}`); process.exit(64); }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.run && !args.secUrl) { console.error('usage: smoke-test.js (--sec-url <exhibit url> [--generation N] | --run <run-id>) [--base-url <url> | SUPABASE env] [--actor <name>] [--no-pages] [--json]'); process.exit(64); }
  if (args.secUrl && !/^https:\/\/www\.sec\.gov\//.test(args.secUrl)) { console.error('--sec-url must be an https://www.sec.gov/ exhibit URL'); process.exit(64); }
  if (!Number.isInteger(args.generation) || args.generation < 0) { console.error('--generation must be a non-negative integer'); process.exit(64); }
  const client = cutoverClientFromEnvironment({ baseUrl: args.baseUrl, actor: args.actor });
  const result = await runSmokeTest({ client, secUrl: args.secUrl, generation: args.generation, runId: args.run, pages: args.pages });
  console.log(args.json ? JSON.stringify(result, null, 2) : renderSmokeTest(result));
  process.exit(result.ok ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
