#!/usr/bin/env node

const fs = require('fs');
const { resolveKey } = require('../../lib/schema-shape/resolve-feature-key');

const KEY_RE = /^[A-Za-z][A-Za-z0-9.[\]_-]*$/;

function checkAliasIntegrity(file = 'docs/schema-shape/feature-key-aliases.json', currentKeys = []) {
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  const aliases = Array.isArray(registry.aliases) ? registry.aliases : [];
  const failures = [];
  for (const alias of aliases) {
    if (!KEY_RE.test(alias.from) || !KEY_RE.test(alias.to)) failures.push(`invalid key syntax: ${alias.from} -> ${alias.to}`);
    if (alias.from === alias.to) failures.push(`self-alias: ${alias.from}`);
    if (!alias.rationale_ref) failures.push(`missing rationale_ref: ${alias.from}`);
    if (alias.reversal_of && !aliases.some((row) => row.id === alias.reversal_of)) failures.push(`invalid reversal_of: ${alias.id}`);
    try {
      resolveKey(alias.from, registry);
    } catch (error) {
      failures.push(error.message);
    }
  }
  const historical = new Set(aliases.filter((alias) => !alias.reversed_at).map((alias) => alias.from));
  for (const key of currentKeys) {
    if (historical.has(key)) failures.push(`historical key still current: ${key}`);
  }
  return { ok: failures.length === 0, failures };
}

function main() {
  const result = checkAliasIntegrity(process.argv[2]);
  if (!result.ok) {
    process.stderr.write(`${result.failures.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('feature-key-aliases: PASS\n');
}

if (require.main === module) {
  main();
}

module.exports = { checkAliasIntegrity };
