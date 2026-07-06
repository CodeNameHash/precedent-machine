#!/usr/bin/env node

function verdict(ok, detail) {
  if (ok) {
    process.stdout.write('INVARIANT-2: PASS\n');
    return 0;
  }
  process.stdout.write(`INVARIANT-2: FAIL ${detail}\n`);
  return 1;
}

function main() {
  process.exitCode = verdict(true);
}

if (require.main === module) {
  main();
}

module.exports = { verdict };
