#!/usr/bin/env node
'use strict';

const { buildAndWriteContentAddressedAudit } = require('../lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit-writer');

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--artifact-root' || !argv[1]) {
    throw new Error('Usage: write-full-corpus-routing-prompt-cost-audit.js --artifact-root <absolute-durable-path>');
  }
  return argv[1];
}

try {
  const result = buildAndWriteContentAddressedAudit({ artifact_root: parseArgs(process.argv.slice(2)) });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
