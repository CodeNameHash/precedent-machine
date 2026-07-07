#!/usr/bin/env node

const fs = require('fs');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const WORKLOG_FILE = 'WORKLOG-P0-C.md';

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
          if (entry.value && entry.deal_id === touched.deal_id && entry.provision_id === touched.provision_id && entry.value.extractorRawValue === row.rawValue) {
            entry.value.canonicalKey = row.targetCanonicalKey;
          }
        }
      }
    }
    if (row.decision === 'RENAME_KEY' && row.field_key && row.to) {
      for (const entry of output.entries || []) {
        if (entry.key !== row.field_key) continue;
        if (row.to.displayName) entry.displayName = row.to.displayName;
        if (row.to.type) entry.type = row.to.type;
        if (Array.isArray(row.to.aliases)) entry.aliases = row.to.aliases;
      }
    }
  }
  return output;
}

function appendWorklog(line) {
  const current = fs.existsSync(WORKLOG_FILE) ? fs.readFileSync(WORKLOG_FILE, 'utf8') : '# WORKLOG-P0-C\n';
  const next = current.includes(line) ? current : `${current.replace(/\s*$/, '')}\n\n${line}\n`;
  fs.writeFileSync(WORKLOG_FILE, next);
}

function main() {
  const write = process.argv.includes('--write');
  const args = process.argv.slice(2).filter((arg) => arg !== '--write');
  const normalizedPath = args[0] || NORMALIZED_FILE;
  const logPath = args[1];
  const normalized = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
  const logRows = readLog(logPath);
  const output = replay(normalized, logRows);
  const text = `${JSON.stringify(output, null, 2)}\n`;
  if (write) {
    fs.writeFileSync(normalizedPath, text);
    const renameCount = logRows.filter((row) => row.decision === 'RENAME_KEY').length;
    appendWorklog(`REPLAY_RECONCILIATION: applied ${renameCount} RENAME_KEY rows from reconciliation-log.jsonl`);
  } else {
    process.stdout.write(text);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  readLog,
  replay,
};
