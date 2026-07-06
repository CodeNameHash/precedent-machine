#!/usr/bin/env node

const fs = require('fs');
const { activeRegistryFile, isPreFreeze, registryRows } = require('../lint/market-registry-completeness');
const { norm } = require('./dedupe');

function duplicateGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = norm(row.key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].filter((group) => {
    if (group.length <= 1) return false;
    return !group.every((row) => row.review_flag === 'REQUIRES_REVIEWER_DECISION');
  });
}

function missingMergedFrom(rows) {
  return rows.filter((row) => !Array.isArray(row.merged_from));
}

function main() {
  const file = activeRegistryFile();
  if (!file || isPreFreeze(file)) {
    process.stdout.write('INVARIANT-8: PASS\n');
    return;
  }
  const rows = registryRows(file);
  const dupes = duplicateGroups(rows);
  const missing = missingMergedFrom(rows);
  if (dupes.length || missing.length) {
    const reason = dupes.length
      ? `duplicate normalized keys: ${dupes.slice(0, 3).map((group) => group[0].key).join(', ')}`
      : `rows missing merged_from: ${missing.slice(0, 3).map((row) => row.key).join(', ')}`;
    process.stdout.write(`INVARIANT-8: FAIL ${reason}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-8: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { duplicateGroups, missingMergedFrom };
