#!/usr/bin/env node

async function main() {
  throw new Error('CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE: Phase 1 contains no source-capture command. Use the proposal-only planning modules until successor M1 and the trusted capture controller are adopted.');
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
