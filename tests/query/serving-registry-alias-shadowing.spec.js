// Regression coverage for the query serving-registry alias-shadowing defect.
//
// The bug: lib/query/resolve.js's readRegistry() builds one alias->entry map
// by walking the 699 registry entries in array order and keeping the FIRST
// claimant of every alias string, including each entry's own `key`. For 104
// of those entries, an EARLIER entry's own `aliases` list happened to
// contain the LATER entry's canonical `key` (a stale cross-reference, or a
// `rubric.<family>.<snake_case>` shadow-row duplicating a clean camelCase
// entry) -- so the later entry's own key permanently resolved to the
// earlier entry instead of to itself. A query naming the shadowed field by
// its exact, correct name silently returned a different legal term.
//
// The fix lives in scripts/generate-query-serving-registry.js, not in the
// generated JSON: buildServingRegistry() now strips, from every entry's own
// alias list, any alias string that is a DIFFERENT entry's canonical key,
// before the registry is ever written. This file proves that fix from three
// angles: every entry resolves to itself (general), the specific named
// inversions from the defect report resolve correctly (concrete), and the
// invariant is a structural property of the transform that survives being
// fed a freshly-corrupted source (robustness) -- not a one-off patch of
// today's 104 cases.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  SOURCE_PATH,
  TARGET_PATH,
  TYPE_CORRECTIONS,
  applyTypeCorrections,
  buildServingRegistry,
  generate,
  serializeServingRegistry,
  stripCrossEntryKeyShadowing,
} = require('../../scripts/generate-query-serving-registry');
const { entryForKey, readRegistry, resetRegistryCache, resolveKey } = require('../../lib/query/resolve');

function regeneratedEntries() {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  return buildServingRegistry(source).entries;
}

test('every regenerated entry resolves through its own canonical key to itself', () => {
  resetRegistryCache();
  const registry = readRegistry();
  assert.equal(registry.file, TARGET_PATH);
  assert.equal(registry.entries.length, 699);
  for (const entry of registry.entries) {
    assert.equal(resolveKey(entry.key), entry.key, `${entry.key} must resolve to itself`);
    // Reference equality, not deep equality: entryForKey must return THIS
    // exact row, not merely a row that happens to look the same -- that is
    // precisely how a shadowed key silently returned a different entry's
    // data while looking superficially fine.
    assert.equal(entryForKey(entry.key), entry, `${entry.key} must resolve to its own entry object`);
  }
});

test('the six reported inversions now resolve to themselves, not to the field that shadowed them', () => {
  resetRegistryCache();
  const inversions = [
    // [shadowed key, the entry it used to silently return instead]
    ['publicStatementsCarveoutParent', 'publicStatementsCarveoutCompany'],
    ['fiduciaryOutStandard', 'fiduciaryEngageStandard'],
    ['divestitureCap', 'burdenCap'],
    ['curePeriod', 'cureDays'],
    ['tailPeriod', 'tailFeeWindowMonths'],
    ['terminationFeePercentEquityValue', 'feePercentage'],
  ];
  for (const [shadowedKey, formerlyReturnedKey] of inversions) {
    const resolved = resolveKey(shadowedKey);
    assert.equal(resolved, shadowedKey, `${shadowedKey} must resolve to itself`);
    assert.notEqual(resolved, formerlyReturnedKey, `${shadowedKey} must not resolve to ${formerlyReturnedKey}`);
  }
});

test('the two currency-mistyped fields from the report are now typed correctly', () => {
  resetRegistryCache();
  assert.equal(entryForKey('tailPeriod').type, 'number', 'tailPeriod is a duration, not currency');
  assert.equal(
    entryForKey('terminationFeePercentEquityValue').type,
    'percent',
    'terminationFeePercentEquityValue is a percentage, not currency',
  );
});

test('all 5 unambiguous type corrections apply exactly once, changing nothing else on the row', () => {
  const entries = regeneratedEntries();
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const expected = {
    tailFeeWindowMonths: 'number',
    feePercentage: 'percent',
    terminationFeePercentEquityValue: 'percent',
    goShopWindow: 'number',
    cap: 'usd',
  };
  assert.deepEqual(TYPE_CORRECTIONS, expected);
  for (const [key, type] of Object.entries(expected)) {
    assert.equal(byKey.get(key).type, type);
  }
  // applyTypeCorrections is scoped to exactly these 5 keys -- every other
  // entry's type is untouched.
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const untouched = stripCrossEntryKeyShadowing(source.entries);
  const corrected = applyTypeCorrections(untouched);
  let changedCount = 0;
  for (let i = 0; i < untouched.length; i += 1) {
    if (untouched[i].type !== corrected[i].type) changedCount += 1;
  }
  assert.equal(changedCount, 5);
});

test('the generator is deterministic: two runs from the same source produce byte-identical output', () => {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const first = serializeServingRegistry(buildServingRegistry(source));
  const second = serializeServingRegistry(buildServingRegistry(JSON.parse(JSON.stringify(source))));
  assert.equal(first, second);

  const firstRun = generate();
  const secondRun = generate();
  assert.deepEqual(firstRun, secondRun);
  assert.equal(firstRun.changed, false, 'the committed registry is already the regenerated output');
});

test('no entry\'s own canonical key ever survives inside a DIFFERENT entry\'s alias list', () => {
  const entries = regeneratedEntries();
  const canonicalKeys = new Set(entries.map((entry) => entry.key));
  for (const entry of entries) {
    for (const alias of entry.aliases || []) {
      if (alias === entry.key) continue;
      assert.equal(
        canonicalKeys.has(alias),
        false,
        `${entry.key} lists "${alias}" as an alias, but that is a DIFFERENT entry's canonical key`,
      );
    }
  }
});

test('hand-editing the served JSON is silently reverted by the next regeneration (the trap the fix avoids)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serving-registry-hand-edit-'));
  try {
    const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
    const corrupted = JSON.parse(JSON.stringify(buildServingRegistry(source)));
    // Reintroduce a shadowing collision by hand, exactly as a well-meaning
    // but doomed direct edit of lib/query/serving-registry-v1.json would.
    const victim = corrupted.entries.find((entry) => entry.key === 'curePeriod');
    const aggressor = corrupted.entries.find((entry) => entry.key === 'cureDays');
    aggressor.aliases = [...new Set([...aggressor.aliases, victim.key])];
    const handEditedPath = path.join(tmpDir, 'hand-edited.json');
    fs.writeFileSync(handEditedPath, serializeServingRegistry(corrupted));

    resetRegistryCache();
    const handEditedRegistry = readRegistry(handEditedPath);
    assert.equal(
      handEditedRegistry.byAlias.get('curePeriod').key,
      'cureDays',
      'the hand-edited file is genuinely broken -- curePeriod is shadowed again',
    );

    // The next `npm run generate:query-registry` reads SOURCE_PATH, not the
    // hand-edited file, and rebuilds cleanly -- the manual "fix" (or, here,
    // manual corruption) never survives regeneration.
    const regenerated = buildServingRegistry(JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')));
    const regeneratedCurePeriod = regenerated.entries.find((entry) => entry.key === 'curePeriod');
    assert.ok(regeneratedCurePeriod.aliases.includes('curePeriod'));
    resetRegistryCache();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetRegistryCache();
  }
});

test('a regeneration cannot reintroduce shadowing, even from a freshly-corrupted source (structural, not a 104-case patch list)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serving-registry-adversarial-'));
  try {
    // A synthetic source with a shadowing pattern that does NOT occur in
    // today's real data: three entries that all cross-claim each other's
    // canonical keys as aliases, plus a clean, uninvolved entry as a
    // control. If the fix were a lookup table of the 104 known cases, this
    // would still shadow; because it is a structural invariant over
    // whatever `entries` it is handed, it must not.
    const adversarialSource = {
      _meta: { version: 'test-fixture', entry_count: 4 },
      entries: [
        { key: 'alpha', displayName: 'Alpha', type: 'string', aliases: ['alpha', 'beta', 'gamma', 'alpha_snake'] },
        { key: 'beta', displayName: 'Beta', type: 'string', aliases: ['beta', 'alpha', 'gamma'] },
        { key: 'gamma', displayName: 'Gamma', type: 'string', aliases: ['gamma', 'alpha', 'beta'] },
        { key: 'delta', displayName: 'Delta', type: 'string', aliases: ['delta', 'delta_snake'] },
      ],
    };
    const adversarialPath = path.join(tmpDir, 'adversarial-normalized.json');
    fs.writeFileSync(adversarialPath, JSON.stringify(adversarialSource));

    const rebuilt = buildServingRegistry(JSON.parse(fs.readFileSync(adversarialPath, 'utf8')));
    const rebuiltPath = path.join(tmpDir, 'adversarial-serving.json');
    fs.writeFileSync(rebuiltPath, serializeServingRegistry(rebuilt));

    resetRegistryCache();
    const registry = readRegistry(rebuiltPath);
    for (const entry of rebuilt.entries) {
      assert.equal(registry.byAlias.get(entry.key).key, entry.key, `${entry.key} must resolve to itself post-fix`);
    }
    // The uninvolved control entry, and each entry's genuinely-own extra
    // alias, are untouched.
    assert.ok(rebuilt.entries.find((entry) => entry.key === 'alpha').aliases.includes('alpha_snake'));
    assert.ok(rebuilt.entries.find((entry) => entry.key === 'delta').aliases.includes('delta_snake'));
    resetRegistryCache();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetRegistryCache();
  }
});
