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

// scripts/generate-query-serving-registry.js used to be a pure _meta/entries
// projection of the source: serving.entries and source.entries were
// byte-identical, and alias resolution behaved identically whether you read
// the source or the serving file. That was the bug -- the source carries,
// for 104 entries, an alias that collides with a DIFFERENT entry's own
// canonical key (e.g. burdenCap's aliases list divestitureCap's key), and a
// straight passthrough copied the collision (and thus the shadowing)
// verbatim into what search actually serves. The generator now SANITIZES
// the projection: same _meta, same entries in the same order and count,
// but each entry's aliases has any foreign canonical key stripped out, and
// 5 entries whose declared type plainly contradicted their own
// displayName's stated unit are corrected. This file locks in that the
// projection is still fully deterministic, and specifically that it is no
// longer a byte-identical copy.
test('Query serving registry is a deterministic, shadowing-safe projection of _meta and entries', () => {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const serving = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));

  assert.deepEqual(serving, buildServingRegistry(source));
  assert.equal(fs.readFileSync(TARGET_PATH, 'utf8'), serializeServingRegistry(serving));
  assert.deepEqual(Object.keys(serving), ['_meta', 'entries']);
  assert.equal(serving.entries.length, 699);
  assert.equal(source.triples.length, 71576);
  assert.equal(serving._meta.version, source._meta.version);
  // Same entries, same order, same count -- the generator never adds,
  // removes, or reorders a row, it only sanitizes aliases/type in place.
  assert.deepEqual(serving.entries.map((entry) => entry.key), source.entries.map((entry) => entry.key));
  // No longer a raw copy: at least the 104 previously-shadowed entries'
  // alias lists differ from the source (a foreign canonical key was
  // stripped), so the two entries arrays are NOT byte-identical.
  assert.notEqual(digest(serving.entries), digest(source.entries));
  assert.deepEqual(generate({ check: true }), {
    changed: false,
    bytes: Buffer.byteLength(serializeServingRegistry(serving)),
    entries: source.entries.length,
  });
});

test('Serving-registry alias resolution fixes exactly the shadowed keys; the untouched source still exhibits the defect', () => {
  resetRegistryCache();
  const source = readRegistry(SOURCE_PATH);
  const serving = readRegistry(TARGET_PATH);

  // Every entry still exists in both, unreordered -- only aliases/type moved.
  assert.deepEqual(
    serving.entries.map((entry) => entry.key),
    source.entries.map((entry) => entry.key),
  );

  const sourceResolution = new Map([...source.byAlias].map(([alias, entry]) => [alias, entry.key]));
  const servingResolution = new Map([...serving.byAlias].map(([alias, entry]) => [alias, entry.key]));

  // Both registries know the same universe of alias strings -- the fix never
  // deletes or invents an alias, it only re-points ones that were claimed by
  // the wrong entry.
  assert.deepEqual([...sourceResolution.keys()].sort(), [...servingResolution.keys()].sort());

  const changed = [...servingResolution].filter(([alias, key]) => sourceResolution.get(alias) !== key);
  // docs/schema-shape/normalized-v1.json is out of this fix's lane and is
  // left exactly as-is, so reading it directly still reproduces the original
  // 104-entry shadowing defect -- proof the fix lives in the generator, not
  // in a hand-patched copy of the JSON.
  assert.equal(changed.length, 104);
  // Every entry whose resolution changed now resolves to ITSELF: the
  // signature of "this was a shadowed canonical key, now fixed", never a
  // reassignment to some third entry.
  assert.ok(changed.every(([alias, key]) => alias === key));

  resetRegistryCache();
  assert.equal(readRegistry().file, TARGET_PATH);
  assert.equal(registryVersion(), serving.parsed._meta.version);
});
