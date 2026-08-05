'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { PROFILES } = require('../lib/canonical-v2/native-producer/codex-cli-provider');

const ROOT = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json',
), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'tests/fixtures/canonical-v2/m3-12-call-pilot-controls.json',
), 'utf8'));

test('pilot controls bind every pilot item to one pinned low-cost profile', () => {
  assert.equal(controls.schema_version, 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1');
  assert.equal(controls.work_item_controls.length, 12);
  assert.deepEqual(
    controls.work_item_controls.map((row) => row.work_item_id).sort(),
    manifest.work_items.map((row) => row.work_item_id).sort(),
  );
  assert.equal(new Set(controls.work_item_controls.map((row) => row.work_item_id)).size, 12);
  for (const row of controls.work_item_controls) {
    assert.equal(row.profile_id, 'TERRA_MEDIUM');
    assert.deepEqual(PROFILES[row.profile_id], {
      profile_id: 'TERRA_MEDIUM',
      model: 'gpt-5.6-terra',
      reasoning_effort: 'medium',
    });
  }
});

test('only the target-side IOC item carries a covenant-side control', () => {
  const withSide = controls.work_item_controls.filter((row) => row.covenant_side !== null);
  assert.deepEqual(withSide, [{
    work_item_id: 'topbuild-ioc-company-4-1',
    profile_id: 'TERRA_MEDIUM',
    covenant_side: 'TARGET',
  }]);
});
