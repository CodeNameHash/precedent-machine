#!/usr/bin/env node

const fs = require('fs');

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';

function isTriple(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'canonicalKey')
    && Object.prototype.hasOwnProperty.call(value, 'extractorRawValue')
    && Object.prototype.hasOwnProperty.call(value, 'sourceProvisionId');
}

function migrateValue(value, sourceProvisionId = null) {
  if (isTriple(value)) return value;
  if (typeof value === 'string') {
    return { canonicalKey: value, extractorRawValue: null, sourceProvisionId };
  }
  if (Array.isArray(value)) return value.map((item) => migrateValue(item, sourceProvisionId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, migrateValue(item, value.sourceProvisionId || sourceProvisionId)]));
  }
  return value;
}

function migrateDocument(doc) {
  const migrated = JSON.parse(JSON.stringify(doc));
  migrated._meta = {
    ...(migrated._meta || {}),
    stored_value_shape: 'triples-v1',
    migrated_by_phase: '0-C',
  };
  migrated.entries = (migrated.entries || []).map((entry) => {
    if (!entry.vocab_ref && !entry.vocabRef) return entry;
    return migrateValue(entry, entry.sourceProvisionId || null);
  });
  return migrated;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function main() {
  const input = JSON.parse(fs.readFileSync(NORMALIZED_FILE, 'utf8'));
  const output = `${JSON.stringify(migrateDocument(input), null, 2)}\n`;
  if (process.argv.includes('--write')) {
    fs.writeFileSync(NORMALIZED_FILE, output);
  } else {
    process.stdout.write(output);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  isTriple,
  migrateDocument,
  migrateValue,
  stable,
};
