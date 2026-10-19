#!/usr/bin/env node
'use strict';

// The pre-intake structure check (work package B5, plan finding (108)): the
// intake route's own path on one SEC exhibit with no database and no model
// call, so an exhibit is checked before any run is paid for. Exactly the
// intake's steps (lib/product/structure-check.js): the SEC adapter's fetch,
// the canonical text, the document identity, buildAgreementStructure.
//
//   node scripts/product/structure-check.js <sec exhibit url> [--json] [--schema LEGAL_SCHEMA/V2] [--provider ANTHROPIC_API] [--generation N] [--attempts N]
//
// Prints the node count, the article and annex boundaries, the identity
// status with its reasons, and the submission fingerprint the intake would
// compute for these bytes under the schema (the environment's active
// schema, or --schema), the prompt bundle that schema selects and the model
// config (the environment's PRODUCT_MODEL_PROVIDER, or --provider, one of
// the hosted providers as the intake's own `provider` field). Nothing is
// submitted; no run, worker or sandbox is touched.
//
// Exit codes: 0 the structure built; 2 the intake or the structure failed
// (the report says which); 64 bad arguments.

const { checkStructure, renderStructureCheck } = require('../../lib/product/structure-check');

function parseArgs(argv) {
  const args = { url: null, json: false, schema: null, provider: null, generation: 0, attempts: 3 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--schema') args.schema = argv[i += 1];
    else if (arg === '--provider') args.provider = argv[i += 1];
    else if (arg === '--generation') args.generation = Number(argv[i += 1]);
    else if (arg === '--attempts') args.attempts = Number(argv[i += 1]);
    else if (arg.startsWith('--')) { console.error(`unknown argument ${arg}`); process.exit(64); }
    else if (args.url === null) args.url = arg;
    else { console.error(`unexpected argument ${arg}`); process.exit(64); }
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('usage: structure-check.js <sec exhibit url> [--json] [--schema <version>] [--provider <hosted provider>] [--generation N] [--attempts N]');
    process.exit(64);
  }
  const env = args.schema ? { ...process.env, PRODUCT_LEGAL_SCHEMA_VERSION: args.schema, NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION: args.schema } : process.env;
  const report = await checkStructure({ url: args.url, provider: args.provider, explicitGeneration: args.generation, maxAttempts: args.attempts, env });
  console.log(args.json ? JSON.stringify(report, null, 2) : renderStructureCheck(report));
  process.exit(report.ok ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(64);
});
