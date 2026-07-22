const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');

const {
  SOURCE_PATH,
  TARGET_PATH,
  buildServingRegistry,
  generate,
  serializeServingRegistry,
} = require('../../scripts/generate-query-serving-registry');
const { readRegistry, registryVersion, resetRegistryCache } = require('../../lib/query/resolve');

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

test('Query serving registry is the deterministic _meta and entries projection', () => {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const serving = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));

  assert.deepEqual(serving, buildServingRegistry(source));
  assert.equal(fs.readFileSync(TARGET_PATH, 'utf8'), serializeServingRegistry(serving));
  assert.deepEqual(Object.keys(serving), ['_meta', 'entries']);
  assert.equal(serving.entries.length, 696);
  assert.equal(source.triples.length, 71576);
  assert.equal(serving._meta.version, source._meta.version);
  assert.equal(digest(serving.entries), digest(source.entries));
  assert.deepEqual(generate({ check: true }), {
    changed: false,
    bytes: Buffer.byteLength(serializeServingRegistry(serving)),
    entries: source.entries.length,
  });
});

test('Query alias resolution is identical for the source and serving registries', () => {
  resetRegistryCache();
  const source = readRegistry(SOURCE_PATH);
  const serving = readRegistry(TARGET_PATH);
  assert.deepEqual(serving.entries, source.entries);
  assert.deepEqual(
    [...serving.byAlias].map(([alias, entry]) => [alias, entry.key]),
    [...source.byAlias].map(([alias, entry]) => [alias, entry.key]),
  );
  resetRegistryCache();
  assert.equal(readRegistry().file, TARGET_PATH);
  assert.equal(registryVersion(), serving.parsed._meta.version);
});
