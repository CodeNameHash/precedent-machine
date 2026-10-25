#!/usr/bin/env node
'use strict';

// The live checks of a deployed preview, in one command (work packages 46
// and 47, plan findings (264) and (265)):
//
//   PRODUCT_INTERNAL_TOKEN=... VERCEL_PROTECTION_BYPASS=... \
//     node scripts/product/check-preview.js --run <run-id> [--run <run-id>] [--base-url <url>]
//
// The second credential may instead be a `pm_session` value (pass it as
// PRODUCT_INTERNAL_TOKEN; the shape tells them apart). The base URL defaults
// to the preview alias. Nothing but statuses, sizes, timings and section
// references is printed.
//
// With the two Apogee runs:
//   PRODUCT_INTERNAL_TOKEN=... VERCEL_PROTECTION_BYPASS=... node scripts/product/check-preview.js \
//     --run 34847358-ae50-41e9-a4a1-82eb41d4d282 --run 88d4032a-d92c-407d-8c2f-9656a85f3916

const { DEFAULT_BASE_URL, runPreviewChecks, renderPreviewChecks } = require('../../lib/product/preview-checks');

function parseArgs(argv) {
  const args = { runs: [], baseUrl: DEFAULT_BASE_URL };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run' || argv[index] === '--base-url') {
      const value = argv[index + 1];
      if (typeof value !== 'string' || value === '' || value.startsWith('--')) throw new TypeError(`${argv[index]} needs a value`);
      if (argv[index] === '--run') args.runs.push(value); else args.baseUrl = value;
      index += 1;
      continue;
    }
    throw new TypeError(`unknown argument ${argv[index]}`);
  }
  if (args.runs.length === 0) throw new TypeError('usage: check-preview.js --run <run-id> [--run <run-id>] [--base-url <url>]');
  return args;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const report = await runPreviewChecks({
    baseUrl: args.baseUrl,
    token: process.env.PRODUCT_INTERNAL_TOKEN || null,
    bypass: process.env.VERCEL_PROTECTION_BYPASS || null,
    runs: args.runs,
    fetchImpl: globalThis.fetch,
  });
  console.log(renderPreviewChecks(report));
  process.exit(report.every((entry) => entry.status === 200) ? 0 : 2);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
