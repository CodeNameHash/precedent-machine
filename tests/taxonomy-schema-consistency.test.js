/* Consistency check between the two feature-key registries: lib/taxonomy.js
   (which feature keys carry a closed-vocab code dictionary) and
   lib/schema/features.js's FEATURES map (the canonical schema registry, used
   for display metadata, provisionTypes, benchmarking, etc). Every feature
   key that taxonomyForFeatureKey() recognizes should also have a schema
   entry, otherwise the UI/extraction layers have a taxonomy dictionary for a
   field the schema doesn't know exists.

   The taxonomy key list is read by introspecting the live
   taxonomyForFeatureKey() function source (its `case '<key>':` labels)
   rather than hand-copying the switch, so this test can't silently drift
   from lib/taxonomy.js as cases are added/removed.

   Two keys currently fail this check — see KNOWN_TAXONOMY_ONLY_KEYS below.
   Per the task instructions, these are NOT "fixed" by editing taxonomy.js or
   features.js (that's a legal/product judgment call, not a mechanical one);
   they're allowlisted here with a TODO so the test stays green while the gap
   stays visible.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');

const taxonomy = require('../lib/taxonomy.js');
const { FEATURES } = require('../lib/schema/features.js');

// TODO(taxonomy/schema reconciliation): these two feature keys are wired
// into taxonomy.js's taxonomyForFeatureKey() switch (and, for
// assignmentProvisos, LIST_TAXONOMY_KEYS) but have no lib/schema/features.js
// entry and no other call site in the codebase (grepped: no extract.js
// codebook reference, no review table-config usage, no other lib/ usage) as
// of this writing. They read as orphaned/never-finished wiring rather than
// intentional taxonomy-only fields. Needs a human call: either register a
// FEATURES entry (if the field is still meant to ship) or delete the dead
// switch cases from taxonomy.js. Left un-fixed here per task scope.
const KNOWN_TAXONOMY_ONLY_KEYS = new Set([
  'assignmentProvisos', // -> ASSIGNMENT_PROVISO dict; no schema entry, no other usage found.
  'primaryForum', // -> PRIMARY_FORUM dict; schema has forumCourts/forumFallback instead, no direct primaryForum entry or other usage found.
]);

function taxonomyFeatureKeys() {
  const src = taxonomy.taxonomyForFeatureKey.toString();
  const keys = [...src.matchAll(/case '([A-Za-z0-9]+)':/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, 'expected to find at least one case label in taxonomyForFeatureKey source');
  return keys;
}

test('every feature key with a taxonomy dictionary has a matching lib/schema/features.js entry', () => {
  const keys = taxonomyFeatureKeys();
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(FEATURES, key));
  const unexpectedlyMissing = missing.filter((key) => !KNOWN_TAXONOMY_ONLY_KEYS.has(key));

  assert.deepEqual(
    unexpectedlyMissing,
    [],
    `taxonomy keys with no lib/schema/features.js entry (not in KNOWN_TAXONOMY_ONLY_KEYS): ${unexpectedlyMissing.join(', ')}`,
  );
});

test('KNOWN_TAXONOMY_ONLY_KEYS stays accurate: every allowlisted key is still taxonomy-only', () => {
  const keys = new Set(taxonomyFeatureKeys());
  for (const key of KNOWN_TAXONOMY_ONLY_KEYS) {
    assert.ok(keys.has(key), `${key} is allowlisted but no longer appears in taxonomyForFeatureKey — remove it from KNOWN_TAXONOMY_ONLY_KEYS`);
    assert.ok(
      !Object.prototype.hasOwnProperty.call(FEATURES, key),
      `${key} is allowlisted as taxonomy-only but now has a lib/schema/features.js entry — remove it from KNOWN_TAXONOMY_ONLY_KEYS`,
    );
  }
});
