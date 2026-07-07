#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function activeRegistryFile(root = process.cwd()) {
  const candidates = [
    'docs/market-registry/FROZEN-v1.json',
    'docs/market-registry/generated-v1.deduped.json',
    'docs/market-registry/generated-v1.json',
  ];
  return candidates.map((file) => path.join(root, file)).find((file) => fs.existsSync(file));
}

function registryRows(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (Array.isArray(data)) return data;
  return data.fields || data.rows || data.registry || [];
}

function isPreFreeze(file) {
  return /generated-v1\.json$/.test(file);
}

function missingStateTests(rows) {
  return rows.filter((row) => {
    const states = Array.isArray(row.states) ? row.states : [];
    if (!states.length) return false;
    const ids = row.test_deal_ids || row.test_deal_ids_by_state || row.test_deal_ids_required_per_state;
    if (row.status !== 'FROZEN-v1' && typeof ids === 'string') return false;
    if (!ids || typeof ids !== 'object') return true;
    return states.some((state) => !Array.isArray(ids[state]) || ids[state].length === 0);
  });
}

function main() {
  const file = activeRegistryFile();
  if (!file || isPreFreeze(file)) {
    process.stdout.write('INVARIANT-5: PASS\n');
    return;
  }
  const missing = missingStateTests(registryRows(file));
  if (missing.length) {
    process.stdout.write(`INVARIANT-5: FAIL missing test_deal_ids for ${missing.slice(0, 5).map((row) => row.key).join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write('INVARIANT-5: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { activeRegistryFile, isPreFreeze, missingStateTests, registryRows };
