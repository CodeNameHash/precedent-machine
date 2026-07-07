const fs = require('fs');

function readRegistry(file = 'docs/schema-shape/feature-key-aliases.json') {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function aliasRows(registry) {
  return Array.isArray(registry?.aliases) ? registry.aliases : [];
}

function resolveKey(key, registry = readRegistry()) {
  const target = String(key || '');
  const seen = new Set();
  let current = target;
  while (true) {
    if (seen.has(current)) {
      throw new Error(`Feature-key alias cycle detected at ${current}`);
    }
    seen.add(current);
    const row = aliasRows(registry).find((alias) => alias.from === current && !alias.reversed_at);
    if (!row) return current;
    current = row.to;
  }
}

function historicalKeys(key, registry = readRegistry()) {
  const canonical = resolveKey(key, registry);
  return aliasRows(registry)
    .filter((alias) => !alias.reversed_at && resolveKey(alias.to, registry) === canonical)
    .map((alias) => alias.from)
    .sort();
}

function assertKeyKnown(key, currentKeys = [], registry = readRegistry()) {
  const resolved = resolveKey(key, registry);
  if (!currentKeys.includes(resolved)) {
    throw new Error(`Unknown feature key: ${key}`);
  }
  return resolved;
}

module.exports = {
  assertKeyKnown,
  historicalKeys,
  readRegistry,
  resolveKey,
};
