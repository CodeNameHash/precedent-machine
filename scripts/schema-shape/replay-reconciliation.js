#!/usr/bin/env node

const fs = require('fs');

function readLog(file = 'docs/schema-shape/reconciliation-log.jsonl') {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function replay(normalized, logRows = []) {
  const output = JSON.parse(JSON.stringify(normalized));
  for (const row of logRows) {
    if (row.action === 'MERGE') {
      for (const touched of row.touched || []) {
        for (const entry of output.entries || []) {
          if (entry.deal_id === touched.deal_id && entry.provision_id === touched.provision_id && entry.value?.extractorRawValue === row.rawValue) {
            entry.value.canonicalKey = row.targetCanonicalKey;
          }
        }
      }
    }
  }
  return output;
}

function main() {
  const normalized = JSON.parse(fs.readFileSync(process.argv[2] || 'docs/schema-shape/normalized-v1.json', 'utf8'));
  process.stdout.write(`${JSON.stringify(replay(normalized, readLog(process.argv[3])), null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  readLog,
  replay,
};
