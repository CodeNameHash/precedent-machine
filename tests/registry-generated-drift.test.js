const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Drift guard for the generated feature-schema registry.
//
// lib/rubric.js is the source of truth. The pipeline
//   scripts/schema-inventory.js  (rubric + taxonomy + UI  -> inventory.jsonl)
//   scripts/generate-registry.js (inventory              -> features.generated.js / tags.generated.js)
// deterministically produces the committed generated files. This test re-runs
// that full pipeline into a throwaway temp dir and asserts the committed
// lib/schema/features.generated.js and lib/schema/tags.generated.js are byte-
// for-byte what a fresh regen produces. If someone hand-edits a generated file
// (as happened historically), or edits rubric.js without regenerating, this
// fails.
//
// It also enforces the persistence-gate safety invariant: every key in the
// hand-maintained lib/schema/features.js (the map store-claims.js gates DB
// writes on) must exist in the generator output, so a future "regenerate then
// reseed features.js" can never silently drop a persisted feature key.

const REPO_ROOT = path.join(__dirname, '..');

function regenerateIntoTemp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-registry-guard-'));
  const invDir = path.join(tmp, 'inventory');
  const outDir = path.join(tmp, 'generated');
  fs.mkdirSync(invDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  execFileSync(process.execPath, ['scripts/schema-inventory.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, SCHEMA_INVENTORY_OUT: invDir },
    stdio: 'ignore',
  });
  execFileSync(process.execPath, ['scripts/generate-registry.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, SCHEMA_REGISTRY_IN: invDir, SCHEMA_REGISTRY_OUT: outDir },
    stdio: 'ignore',
  });

  return {
    tmp,
    freshFeaturesPath: path.join(outDir, 'features.generated.js'),
    freshTagsPath: path.join(outDir, 'tags.generated.js'),
  };
}

function loadMap(filePath, exportName) {
  // Bust require cache so repeated loads of same-named temp paths are safe.
  delete require.cache[require.resolve(filePath)];
  return require(filePath)[exportName];
}

function assertMapsEqual(fresh, committed, label) {
  const freshKeys = Object.keys(fresh).sort();
  const committedKeys = Object.keys(committed).sort();

  const missing = committedKeys.filter((k) => !(k in fresh));
  const extra = freshKeys.filter((k) => !(k in committed));
  assert.deepEqual(
    missing,
    [],
    `${label}: committed has keys a fresh regen does NOT produce (stale generated file — regenerate): ${missing.join(', ')}`,
  );
  assert.deepEqual(
    extra,
    [],
    `${label}: a fresh regen produces keys the committed file lacks (stale generated file — regenerate): ${extra.join(', ')}`,
  );

  for (const key of committedKeys) {
    assert.deepStrictEqual(
      committed[key],
      fresh[key],
      `${label}: entry "${key}" drifted from generator output. Regenerate with \`node scripts/schema-inventory.js && node scripts/generate-registry.js\` instead of hand-editing the generated file.`,
    );
  }
}

test('committed generated registry matches a fresh regen (no drift)', () => {
  const { tmp, freshFeaturesPath, freshTagsPath } = regenerateIntoTemp();
  try {
    const freshFeatures = loadMap(freshFeaturesPath, 'FEATURES');
    const freshTags = loadMap(freshTagsPath, 'TAGS');
    const committedFeatures = loadMap(
      path.join(REPO_ROOT, 'lib/schema/features.generated.js'),
      'FEATURES',
    );
    const committedTags = loadMap(
      path.join(REPO_ROOT, 'lib/schema/tags.generated.js'),
      'TAGS',
    );

    assertMapsEqual(freshFeatures, committedFeatures, 'features.generated.js');
    assertMapsEqual(freshTags, committedTags, 'tags.generated.js');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('generator output is a superset of the persistence-gate key set', () => {
  const { tmp, freshFeaturesPath } = regenerateIntoTemp();
  try {
    const freshFeatures = loadMap(freshFeaturesPath, 'FEATURES');
    // The persistence gate: store-claims.js only materializes DB claims for
    // keys present in this map. A regen must never drop one of its keys.
    const persisted = require(path.join(REPO_ROOT, 'lib/schema/features.js')).FEATURES;

    const droppedByRegen = Object.keys(persisted).filter((k) => !(k in freshFeatures));
    assert.deepEqual(
      droppedByRegen,
      [],
      `A regen would drop these persisted feature keys (they persist across all deals but the generator no longer emits them — add them to rubric.js or the generator's supplemental sets before regenerating): ${droppedByRegen.join(', ')}`,
    );

    // Explicit high-stakes keys that were historically hand-inserted.
    assert.ok(
      'interestRateBasis' in freshFeatures,
      'interestRateBasis (rubric TERMF) must survive a regen',
    );
    for (const key of [
      'antitrustEffortsStandard',
      'buyerEffortsCap',
      'targetEffortsCap',
      'divestitureInCondition',
      'tenderOffer',
      'nominalTargetParty',
      'notificationCovenantFailureStandard',
      'interveningEventExceptions',
      'feeExpenseAllocationExceptions',
      'absenceConductedOrdinaryCourse',
      'absenceSpecifiedIOCReferences',
      'absenceSpecifiedIOCs',
    ]) {
      assert.ok(
        key in freshFeatures,
        `phase-0-C reconciliation key ${key} must survive a regen`,
      );
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
