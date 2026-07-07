#!/usr/bin/env node

const fs = require('fs');

function checkVersionPins() {
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  const aliases = JSON.parse(fs.readFileSync('docs/schema-shape/feature-key-aliases.json', 'utf8'));
  const failures = [];
  if (normalized._meta?.stored_value_shape !== 'triples-v1') failures.push('normalized-v1 missing triples-v1 marker');
  if (aliases.schema_version !== 1) failures.push('feature-key-aliases schema_version must be 1');
  return { ok: failures.length === 0, failures };
}

function main() {
  const result = checkVersionPins();
  if (!result.ok) {
    process.stderr.write(`${result.failures.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('version pins: PASS\n');
}

if (require.main === module) main();

module.exports = { checkVersionPins };
