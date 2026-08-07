// PLAN.md Step 2A's acceptance criterion: every registered family has a
// pinned section list for Modiv. Before 2026-08-07 exactly one did, so rungs
// 2-4 of the Stage 2 ladder could not run at all.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');

const RUNNER = path.join(__dirname, '..', 'scripts/canonical-v2-live-extraction-run.mjs');

// The runner is an .mjs script that does not export DEAL_PINS, and importing
// it runs main(). Reading the pinned block out of the source is deliberate:
// the alternative is exporting internals purely so a test can see them, which
// widens the script's surface for no product reason.
function modivPins() {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const block = source.match(
    /modiv:[\s\S]*?default_section_refs_by_family: Object\.freeze\(\{([\s\S]*?)\n {4}\}\)/,
  );
  assert.ok(block, 'could not locate modiv default_section_refs_by_family');
  const pins = {};
  for (const line of block[1].split('\n')) {
    const match = line.match(/^ {6}([A-Z_]+): Object\.freeze\((\[[^\]]*\])\)/);
    if (match) pins[match[1]] = JSON.parse(match[2].replace(/'/g, '"'));
  }
  return pins;
}

test('every registered family has a pinned Modiv section list', () => {
  const pins = modivPins();
  const families = listRegisteredSectionFamilies();
  const missing = families.filter((family) => !Array.isArray(pins[family]));
  assert.deepEqual(missing, [], `families with no pinned section list: ${missing.join(', ')}`);
  assert.equal(Object.keys(pins).length, families.length, 'no pins for unregistered families');
});

test('no pinned list is empty', () => {
  // resolveRunConfig throws on an empty list, so an empty pin is a family
  // that cannot be run -- worse than an absent one, because it looks pinned.
  const pins = modivPins();
  for (const [family, refs] of Object.entries(pins)) {
    assert.ok(refs.length > 0, `${family} is pinned to an empty list`);
  }
});

test('the pins match what the committed runs actually used', () => {
  // Twenty-four families are harvested from committed evidence rather than
  // authored. If a pin drifts from the run that produced the baseline, the
  // ladder's round-1-to-4 diffs stop comparing like with like, and that
  // failure is silent.
  const pins = modivPins();
  const root = path.join(__dirname, '..', 'evidence/canonical-v2');
  let compared = 0;
  for (const entry of fs.readdirSync(root)) {
    if (!entry.startsWith('modiv-')) continue;
    const manifestPath = path.join(root, entry, 'run-manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const family = manifest.section_family;
    const refs = manifest.section_references;
    if (!family || !Array.isArray(refs) || !pins[family]) continue;
    // A family may have several committed runs with different lists; the pin
    // takes the longest. Assert containment rather than equality so an older,
    // narrower run does not fail the check.
    if (refs.length > pins[family].length) continue;
    for (const ref of refs) {
      assert.ok(
        pins[family].includes(ref),
        `${family} pin is missing ${ref}, which ${entry} actually ran`,
      );
    }
    compared += 1;
  }
  assert.ok(compared >= 15, `expected to compare at least 15 committed runs, compared ${compared}`);
});

test('MAE_DEFINITION is pinned but flagged as generator-proposed', () => {
  // It is the one family never run against Modiv, so its list is the stage-1
  // generator's proposal rather than harvested human judgement. PLAN.md
  // Step 2A requires it be read against the document before its result is
  // trusted. This test exists so that requirement cannot be quietly lost.
  const pins = modivPins();
  assert.ok(Array.isArray(pins.MAE_DEFINITION) && pins.MAE_DEFINITION.length > 0);
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(
    source,
    /Never run against Modiv[\s\S]{0,400}MAE_DEFINITION/,
    'the MAE_DEFINITION pin must keep the comment recording that it is unreviewed',
  );
});
