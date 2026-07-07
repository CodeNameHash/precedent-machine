#!/usr/bin/env node

const fs = require('fs');
const { normalizeValue } = require('../../lib/schema-shape/normalize-value');

const QUEUE_FILE = 'docs/schema-shape/reconciliation-queue.json';
const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';

function queueId(field, rawValue) {
  return `${field}:${String(rawValue || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+$/g, '');
}

function buildQueue(normalized, existing = { entries: [] }) {
  const seen = new Map((existing.entries || []).map((entry) => [entry.id, entry]));
  for (const entry of normalized.entries || []) {
    const vocabRef = entry.vocab_ref || entry.vocabRef;
    if (!vocabRef || !entry.value?.extractorRawValue) continue;
    const normalizedValue = normalizeValue(entry.value.extractorRawValue, vocabRef, entry.value.sourceProvisionId);
    if (normalizedValue.canonicalKey !== 'FREEFORM') continue;
    const id = queueId(entry.key, entry.value.extractorRawValue);
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        field: entry.key,
        rawValue: entry.value.extractorRawValue,
        status: 'NEW',
        occurrences: [{ deal_id: entry.deal_id || null, provision_id: entry.value.sourceProvisionId || null }],
      });
    }
  }
  return { schema_version: 1, entries: [...seen.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

function main() {
  const normalized = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const existing = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')) : { entries: [] };
  const output = `${JSON.stringify(buildQueue(normalized, existing), null, 2)}\n`;
  if (process.argv.includes('--write')) fs.writeFileSync(QUEUE_FILE, output);
  else process.stdout.write(output);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildQueue,
  queueId,
};
