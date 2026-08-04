'use strict';

const path = require('node:path');

const {
  buildAndWriteP9AcceptanceEvidence,
} = require('../lib/programme-gates/p9-acceptance-evidence-inventory-writer');

function parseArgs(argv) {
  if (argv.length !== 1 || !path.isAbsolute(argv[0])) {
    throw new Error('Usage: node scripts/write-p9-proposal-only-acceptance-evidence.js <absolute-durable-artifact-root>');
  }
  return argv[0];
}

const result = buildAndWriteP9AcceptanceEvidence({
  artifact_root: parseArgs(process.argv.slice(2)),
  repository_root: path.resolve(__dirname, '..'),
});
process.stdout.write(`${JSON.stringify(result)}\n`);
