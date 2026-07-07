#!/usr/bin/env node

const fs = require('fs');
const { activeRegistryFile, isPreFreeze, registryRows } = require('../lint/market-registry-completeness');

function sourceText() {
  return [
    'lib/schema/features.js',
    'lib/rubric.js',
    'lib/vocab/ioc-categories.js',
  ].filter((file) => fs.existsSync(file)).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

function orphanRows(rows, source = sourceText()) {
  return rows.filter((row) => {
    if (row.resolver || row.resolver_stub || row.source_file) return false;
    if (!row.key) return true;
    return !source.includes(row.key);
  });
}

function main() {
  const file = activeRegistryFile();
  if (!file || isPreFreeze(file)) {
    process.stdout.write('INVARIANT-9: PASS\n');
    return;
  }
  const orphans = orphanRows(registryRows(file));
  if (orphans.length) {
    process.stdout.write(`INVARIANT-9: FAIL orphaned rows: ${orphans.slice(0, 5).map((row) => row.key).join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-9: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { orphanRows, sourceText };
