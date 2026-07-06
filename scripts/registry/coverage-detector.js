#!/usr/bin/env node

const { FEATURES } = require('../../lib/schema/features');
const { activeRegistryFile, isPreFreeze, registryRows } = require('../lint/market-registry-completeness');

function coverageProblems(rows) {
  const registryKeys = new Map();
  for (const row of rows) {
    registryKeys.set(row.key, (registryKeys.get(row.key) || 0) + 1);
  }
  const missing = Object.keys(FEATURES).filter((key) => !registryKeys.has(key));
  const duplicated = [...registryKeys.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  const excess = rows.filter((row) => {
    if (FEATURES[row.key]) return false;
    return !['appendix-a-priority', 'ioc-categories'].includes(row.origin);
  }).map((row) => row.key);
  return { missing, duplicated, excess };
}

function main() {
  const file = activeRegistryFile();
  if (!file || isPreFreeze(file)) {
    process.stdout.write('INVARIANT-10: PASS\n');
    return;
  }
  const problems = coverageProblems(registryRows(file));
  if (problems.missing.length || problems.duplicated.length || problems.excess.length) {
    process.stdout.write(`INVARIANT-10: FAIL missing=${problems.missing.length} duplicated=${problems.duplicated.length} excess=${problems.excess.length}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-10: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { coverageProblems };
