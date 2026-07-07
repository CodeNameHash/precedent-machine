#!/usr/bin/env node

const { activeRegistryFile, isPreFreeze, registryRows } = require('../lint/market-registry-completeness');

function provenanceProblems(rows) {
  return rows.filter((row) => {
    if (!Array.isArray(row.merged_from) || row.merged_from.length === 0) return false;
    return row.merged_from.some((entry) => !entry.origin || !entry.key || !entry.merge_rule);
  });
}

function main() {
  const file = activeRegistryFile();
  if (!file || isPreFreeze(file)) {
    process.stdout.write('INVARIANT-11: PASS\n');
    return;
  }
  const bad = provenanceProblems(registryRows(file));
  if (bad.length) {
    process.stdout.write(`INVARIANT-11: FAIL incomplete provenance: ${bad.slice(0, 5).map((row) => row.key).join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-11: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { provenanceProblems };
