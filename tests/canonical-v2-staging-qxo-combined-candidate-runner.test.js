const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-combined-candidate.mjs';

test('combined QXO candidate runner reads two exact semantic closures and never activates them', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /CAPITALISATION_CLOSURE_ID/);
  assert.match(source, /NO_SHOP_CLOSURE_ID/);
  assert.match(source, /assertFamilyParity/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(source, /activateCandidateRelease|canonical_v2_activate/);
  assert.doesNotMatch(source, /production/i);
});

test('combined QXO candidate identities and release counts are pinned', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36/);
  assert.match(source, /620bcbba3b072f1a475989adad9e4ce708b4fce288fa59036e549dc82544b48d/);
  assert.match(source, /cb2d9e9db4e059b28d29f60012d25efec77b3eda2d33cf9911c434bcbb667b44/);
  assert.match(source, /capitalisationServing\.candidate_release_members/);
  assert.match(source, /noShopServing\.candidate_release_members/);
  assert.match(source, /release\.market_observations\.length/);
  assert.match(source, /release\.market_exclusions\.length/);
  assert.match(source, /release\.exact_detail_packages\.length/);
});

test('combined QXO candidate import is rollback-first and has exact inactive rollback', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /RECHECK_AUTHORITY_FOR_ROLLBACK/);
  assert.match(source, /ROLLBACK_IMPORT/);
  assert.match(source, /Rollback-first QXO combined candidate import changed staging state/);
  assert.match(source, /canonical_v2_rollback_inactive_candidate_release/);
  assert.match(source, /ROLLED_BACK_AND_REIMPORTED/);
  assert.doesNotMatch(source, /UPDATE canonical_v2_staging|DELETE FROM canonical_v2_staging/);
});
